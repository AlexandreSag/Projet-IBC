// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IERC20Like {
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract SubscriptionCore {
    // Une mensualité correspond à 30 jours sur la blockchain de démonstration.
    uint256 public constant BILLING_PERIOD = 30 days;

    struct AutoRenewConfig {
        bool enabled;
        uint256 maxTokenAmountPerCharge;
        uint256 nextChargeAt;
        uint256 paidUntil;
    }

    address public owner;
    address public treasury;
    IERC20Like public immutable stableToken;
    uint256 public ethMonthlyPriceWei;
    uint256 public tokenMonthlyPrice;

    mapping(address => AutoRenewConfig) public autoRenewConfigs;

    event EthPaymentReceived(
        address indexed subscriber,
        uint256 amountWei,
        uint256 chargedWei,
        uint256 refundedWei,
        uint256 monthsGranted,
        uint256 paidUntil
    );
    event AutoRenewEnabled(address indexed subscriber, uint256 maxTokenAmountPerCharge, uint256 nextChargeAt);
    event AutoRenewDisabled(address indexed subscriber);
    event AutoRenewCharged(
        address indexed subscriber,
        uint256 tokenAmount,
        uint256 chargedAt,
        uint256 nextChargeAt,
        uint256 paidUntil
    );
    event TreasuryUpdated(address indexed treasury);
    event PricingUpdated(uint256 ethMonthlyPriceWei, uint256 tokenMonthlyPrice);

    modifier onlyOwner() {
        require(msg.sender == owner, "Owner only");
        _;
    }

    constructor(
        address treasury_,
        address stableToken_,
        uint256 ethMonthlyPriceWei_,
        uint256 tokenMonthlyPrice_
    ) {
        require(treasury_ != address(0), "Invalid treasury");
        require(stableToken_ != address(0), "Invalid token");
        require(ethMonthlyPriceWei_ > 0, "Invalid ETH price");
        require(tokenMonthlyPrice_ > 0, "Invalid token price");

        owner = msg.sender;
        treasury = treasury_;
        stableToken = IERC20Like(stableToken_);
        ethMonthlyPriceWei = ethMonthlyPriceWei_;
        tokenMonthlyPrice = tokenMonthlyPrice_;
    }

    function quoteMonthsForEth(uint256 amountWei) public view returns (uint256 monthsGranted, uint256 refundWei) {
        monthsGranted = amountWei / ethMonthlyPriceWei;
        refundWei = amountWei - (monthsGranted * ethMonthlyPriceWei);
    }

    function getPaidUntil(address subscriber) external view returns (uint256) {
        return autoRenewConfigs[subscriber].paidUntil;
    }

    function payWithEth() external payable returns (uint256 monthsGranted, uint256 refundWei) {
        (monthsGranted, refundWei) = quoteMonthsForEth(msg.value);
        require(monthsGranted > 0, "Amount too low");

        uint256 chargedWei = msg.value - refundWei;
        AutoRenewConfig storage config = autoRenewConfigs[msg.sender];

        // Un paiement en avance prolonge la période déjà payée.
        config.paidUntil = _extendPaidUntil(config.paidUntil, monthsGranted);

        (bool treasurySuccess, ) = treasury.call{value: chargedWei}("");
        require(treasurySuccess, "Treasury transfer failed");

        if (refundWei > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: refundWei}("");
            require(refundSuccess, "Refund failed");
        }

        emit EthPaymentReceived(
            msg.sender,
            msg.value,
            chargedWei,
            refundWei,
            monthsGranted,
            config.paidUntil
        );
    }

    function enableAutoRenew(uint256 maxTokenAmountPerCharge) external {
        // Le client limite le montant autorisé pour chaque prélèvement.
        require(maxTokenAmountPerCharge >= tokenMonthlyPrice, "Max charge too low");

        AutoRenewConfig storage config = autoRenewConfigs[msg.sender];
        uint256 paidUntil = config.paidUntil;
        uint256 nextChargeAt = paidUntil > block.timestamp ? paidUntil : block.timestamp;

        config.enabled = true;
        config.maxTokenAmountPerCharge = maxTokenAmountPerCharge;
        config.nextChargeAt = nextChargeAt;

        emit AutoRenewEnabled(msg.sender, maxTokenAmountPerCharge, nextChargeAt);
    }

    function disableAutoRenew() external {
        AutoRenewConfig storage config = autoRenewConfigs[msg.sender];
        config.enabled = false;
        config.nextChargeAt = 0;
        emit AutoRenewDisabled(msg.sender);
    }

    function canCharge(address subscriber) external view returns (bool) {
        AutoRenewConfig storage config = autoRenewConfigs[subscriber];
        if (!config.enabled || config.nextChargeAt == 0 || config.nextChargeAt > block.timestamp) {
            return false;
        }

        if (config.maxTokenAmountPerCharge < tokenMonthlyPrice) {
            return false;
        }

        if (stableToken.allowance(subscriber, address(this)) < tokenMonthlyPrice) {
            return false;
        }

        if (stableToken.balanceOf(subscriber) < tokenMonthlyPrice) {
            return false;
        }

        return true;
    }

    function chargeAutoRenew(address subscriber) external onlyOwner {
        AutoRenewConfig storage config = autoRenewConfigs[subscriber];
        require(config.enabled, "Auto renew disabled");
        require(config.nextChargeAt > 0 && config.nextChargeAt <= block.timestamp, "Charge not due");
        require(config.maxTokenAmountPerCharge >= tokenMonthlyPrice, "Max charge too low");
        require(stableToken.allowance(subscriber, address(this)) >= tokenMonthlyPrice, "Allowance too low");
        require(stableToken.balanceOf(subscriber) >= tokenMonthlyPrice, "Balance too low");

        // Les USDC passent directement du wallet client à la trésorerie.
        bool success = stableToken.transferFrom(subscriber, treasury, tokenMonthlyPrice);
        require(success, "Token transfer failed");

        config.paidUntil = _extendPaidUntil(config.paidUntil, 1);
        config.nextChargeAt = config.paidUntil;

        emit AutoRenewCharged(
            subscriber,
            tokenMonthlyPrice,
            block.timestamp,
            config.nextChargeAt,
            config.paidUntil
        );
    }

    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "Invalid treasury");
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setPricing(uint256 ethMonthlyPriceWei_, uint256 tokenMonthlyPrice_) external onlyOwner {
        require(ethMonthlyPriceWei_ > 0, "Invalid ETH price");
        require(tokenMonthlyPrice_ > 0, "Invalid token price");

        ethMonthlyPriceWei = ethMonthlyPriceWei_;
        tokenMonthlyPrice = tokenMonthlyPrice_;
        emit PricingUpdated(ethMonthlyPriceWei_, tokenMonthlyPrice_);
    }

    function _extendPaidUntil(uint256 currentPaidUntil, uint256 monthsGranted) private view returns (uint256) {
        uint256 base = currentPaidUntil > block.timestamp ? currentPaidUntil : block.timestamp;
        return base + (monthsGranted * BILLING_PERIOD);
    }
}
