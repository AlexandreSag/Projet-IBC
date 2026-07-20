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
    uint256 public tokenMonthlyPrice;

    mapping(address => AutoRenewConfig) public autoRenewConfigs;

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
    event TokenMonthlyPriceUpdated(uint256 tokenMonthlyPrice);

    modifier onlyOwner() {
        require(msg.sender == owner, "Owner only");
        _;
    }

    constructor(
        address treasury_,
        address stableToken_,
        uint256 tokenMonthlyPrice_
    ) {
        require(treasury_ != address(0), "Invalid treasury");
        require(stableToken_ != address(0), "Invalid token");
        require(tokenMonthlyPrice_ > 0, "Invalid token price");

        owner = msg.sender;
        treasury = treasury_;
        stableToken = IERC20Like(stableToken_);
        tokenMonthlyPrice = tokenMonthlyPrice_;
    }

    function getPaidUntil(address subscriber) external view returns (uint256) {
        return autoRenewConfigs[subscriber].paidUntil;
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

    function setTokenMonthlyPrice(uint256 tokenMonthlyPrice_) external onlyOwner {
        require(tokenMonthlyPrice_ > 0, "Invalid token price");

        tokenMonthlyPrice = tokenMonthlyPrice_;
        emit TokenMonthlyPriceUpdated(tokenMonthlyPrice_);
    }

    function _extendPaidUntil(uint256 currentPaidUntil, uint256 monthsGranted) private view returns (uint256) {
        uint256 base = currentPaidUntil > block.timestamp ? currentPaidUntil : block.timestamp;
        return base + (monthsGranted * BILLING_PERIOD);
    }
}
