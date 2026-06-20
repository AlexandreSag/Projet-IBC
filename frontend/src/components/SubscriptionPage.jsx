import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createWalletClient, encodeFunctionData, erc20Abi, parseEther } from 'viem';
import { requestJson, useAuth } from '../context/AuthContext.jsx';
import {
  anvilLocalChain,
  anvilPublicClient,
  createBrowserWalletClient,
  getEthereumProvider,
} from '../lib/walletConfig.js';
import { subscriptionCoreAbi } from '../lib/subscriptionContracts.js';
import SubscriptionBenefitsSection from './subscription/SubscriptionBenefitsSection.jsx';
import SubscriptionCurrentCard from './subscription/SubscriptionCurrentCard.jsx';
import SubscriptionPaymentModal from './subscription/SubscriptionPaymentModal.jsx';
import SubscriptionPlansSection from './subscription/SubscriptionPlansSection.jsx';
import './subscription/SubscriptionPage.css';

const ETH_DURATION_MONTH_OPTIONS = [1, 3, 6, 12];

export default function SubscriptionPage() {
  const { abonnement, isPremium, refreshSession } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [isLoadingPaymentIntent, setIsLoadingPaymentIntent] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('eth');
  const [ethDurationMonths, setEthDurationMonths] = useState(1);
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletChainId, setWalletChainId] = useState(null);
  const [walletSessionDisconnected, setWalletSessionDisconnected] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);
  const [isSendingTransaction, setIsSendingTransaction] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [isFinalizingPayment, setIsFinalizingPayment] = useState(false);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [isSubmittingAutoRenewal, setIsSubmittingAutoRenewal] = useState(false);
  const [paymentHash, setPaymentHash] = useState(null);

  const isConnected = Boolean(walletAddress) && !walletSessionDisconnected;
  const isOnAnvilChain = walletChainId === anvilLocalChain.id;
  const activePlan = status?.abonnement || abonnement;
  const renewal = activePlan?.renewal || null;

  const loadStatus = useCallback(async (signal) => {
    setLoading(true);
    setError(null);

    try {
      const data = await requestJson('/api/me/abonnement-status', { method: 'GET', signal });
      setStatus(data);
    } catch (loadError) {
      if (loadError.name !== 'AbortError') {
        setStatus(null);
        setError(loadError.message || 'Impossible de charger votre abonnement.');
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadStatus(controller.signal);
    return () => controller.abort();
  }, [loadStatus]);

  const prepareEthPaymentIntent = useCallback(async (durationMonths) => {
    setIsLoadingPaymentIntent(true);
    setError(null);

    try {
      const data = await requestJson('/api/me/abonnement/payment-intent', {
        method: 'POST',
        body: JSON.stringify({ planCode: 'premium', cryptoCode: 'eth', durationMonths }),
      });
      setPaymentIntent(data?.paymentIntent || null);
    } catch (paymentError) {
      setPaymentIntent(null);
      setError(paymentError.message || 'Impossible de préparer le paiement Ethereum.');
    } finally {
      setIsLoadingPaymentIntent(false);
    }
  }, []);

  useEffect(() => {
    const provider = getEthereumProvider();
    if (!provider) {
      return undefined;
    }

    let cancelled = false;

    const syncWalletState = async () => {
      try {
        const [accounts, chainHex] = await Promise.all([
          provider.request({ method: 'eth_accounts' }),
          provider.request({ method: 'eth_chainId' }),
        ]);

        if (cancelled || walletSessionDisconnected) {
          return;
        }

        setWalletAddress(Array.isArray(accounts) && accounts[0] ? accounts[0] : null);
        setWalletChainId(chainHex ? Number.parseInt(chainHex, 16) : null);
      } catch {
        if (!cancelled) {
          setWalletAddress(null);
          setWalletChainId(null);
        }
      }
    };

    const handleAccountsChanged = (accounts) => {
      if (!walletSessionDisconnected) {
        setWalletAddress(Array.isArray(accounts) && accounts[0] ? accounts[0] : null);
      }
    };

    const handleChainChanged = (chainHex) => {
      setWalletChainId(chainHex ? Number.parseInt(chainHex, 16) : null);
    };

    void syncWalletState();
    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);

    return () => {
      cancelled = true;
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [walletSessionDisconnected]);

  const metrics = useMemo(() => {
    const accountsUsage = status?.usage?.comptes || null;
    const accountDetails = status?.usage?.comptesDetails || [];

    const depensesUsage = accountDetails.reduce(
      (accumulator, account) => {
        if (account.depenses.used > accumulator.used) {
          return {
            used: account.depenses.used,
            limit: account.depenses.limit,
            isUnlimited: account.depenses.isUnlimited,
          };
        }

        return accumulator;
      },
      {
        used: 0,
        limit: activePlan?.limits?.depensesParCompte ?? null,
        isUnlimited: activePlan?.limits?.depensesParCompte === null,
      },
    );

    const revenusUsage = accountDetails.reduce(
      (accumulator, account) => {
        if (account.revenus.used > accumulator.used) {
          return {
            used: account.revenus.used,
            limit: account.revenus.limit,
            isUnlimited: account.revenus.isUnlimited,
          };
        }

        return accumulator;
      },
      {
        used: 0,
        limit: activePlan?.limits?.revenusParCompte ?? null,
        isUnlimited: activePlan?.limits?.revenusParCompte === null,
      },
    );

    return { accountsUsage, depensesUsage, revenusUsage };
  }, [activePlan, status]);

  const handlePremiumAction = async () => {
    if (isPremium || isLoadingPaymentIntent) {
      return;
    }

    setError(null);
    setInfoMessage(null);
    setSelectedPaymentMethod('eth');
    setEthDurationMonths(1);
    setPaymentHash(null);
    setIsPaymentConfirmed(false);
    setShowPaymentModal(true);
  };

  useEffect(() => {
    if (!showPaymentModal || selectedPaymentMethod !== 'eth' || isPremium) {
      return;
    }

    void prepareEthPaymentIntent(ethDurationMonths);
  }, [ethDurationMonths, isPremium, prepareEthPaymentIntent, selectedPaymentMethod, showPaymentModal]);

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentHash(null);
    setIsConfirmingPayment(false);
    setIsFinalizingPayment(false);
    setIsPaymentConfirmed(false);
  };

  const handleCopyPaymentAddress = async () => {
    if (!paymentIntent?.walletAddress) {
      return;
    }

    try {
      await navigator.clipboard.writeText(paymentIntent.walletAddress);
      setInfoMessage('Adresse copiée. Vérifiez bien le montant avant d’envoyer le paiement.');
    } catch {
      setInfoMessage('Impossible de copier automatiquement l’adresse. Vous pouvez la sélectionner manuellement.');
    }
  };

  const handlePaymentSent = () => {
    setShowPaymentModal(false);
    setInfoMessage('Transaction envoyée, activation du Premium en cours.');
  };

  const handleConnectWallet = async () => {
    if (isConnected) {
      return;
    }

    const provider = getEthereumProvider();
    if (!provider) {
      setError('Connectez un wallet pour continuer.');
      return;
    }

    setIsConnectingWallet(true);

    try {
      setWalletSessionDisconnected(false);
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const chainHex = await provider.request({ method: 'eth_chainId' });
      setWalletAddress(Array.isArray(accounts) && accounts[0] ? accounts[0] : null);
      setWalletChainId(chainHex ? Number.parseInt(chainHex, 16) : null);
      setInfoMessage('Wallet connecté avec succès.');
    } catch (walletError) {
      setError(walletError.message || 'Impossible de connecter le wallet.');
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleSwitchWalletAccount = async () => {
    const provider = getEthereumProvider();
    if (!provider) {
      setError('Connectez un wallet pour choisir un compte.');
      return;
    }

    setIsConnectingWallet(true);

    try {
      setWalletSessionDisconnected(false);
      await provider.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const chainHex = await provider.request({ method: 'eth_chainId' });
      setWalletAddress(Array.isArray(accounts) && accounts[0] ? accounts[0] : null);
      setWalletChainId(chainHex ? Number.parseInt(chainHex, 16) : null);
      setInfoMessage('Compte wallet mis à jour avec succès.');
    } catch (walletError) {
      setError(walletError.message || 'Impossible de changer de compte.');
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleDisconnectWalletSession = () => {
    setWalletSessionDisconnected(true);
    setWalletAddress(null);
    setWalletChainId(null);
    setInfoMessage('Wallet déconnecté de l’application.');
  };

  const ensureWalletReady = async () => {
    const provider = getEthereumProvider();
    if (!provider) {
      throw new Error('Connectez un wallet pour continuer.');
    }

    if (!isConnected) {
      setWalletSessionDisconnected(false);
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const chainHex = await provider.request({ method: 'eth_chainId' });
      setWalletAddress(Array.isArray(accounts) && accounts[0] ? accounts[0] : null);
      setWalletChainId(chainHex ? Number.parseInt(chainHex, 16) : null);
    }

    if (walletChainId !== anvilLocalChain.id) {
      setIsSwitchingChain(true);
      const chainHex = `0x${anvilLocalChain.id.toString(16)}`;

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainHex }],
        });
      } catch (switchError) {
        if (switchError?.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chainHex,
              chainName: anvilLocalChain.name,
              nativeCurrency: anvilLocalChain.nativeCurrency,
              rpcUrls: anvilLocalChain.rpcUrls.default.http,
            }],
          });
        } else {
          throw switchError;
        }
      } finally {
        setIsSwitchingChain(false);
      }

      const refreshedChainHex = await provider.request({ method: 'eth_chainId' });
      setWalletChainId(refreshedChainHex ? Number.parseInt(refreshedChainHex, 16) : null);
    }

    const accounts = await provider.request({ method: 'eth_accounts' });
    const account = Array.isArray(accounts) && accounts[0] ? accounts[0] : walletAddress;

    if (!account) {
      throw new Error('Aucun compte wallet disponible.');
    }

    const walletClient = createWalletClient({
      chain: anvilLocalChain,
      transport: createBrowserWalletClient(),
    });

    if (!walletClient) {
      throw new Error('Impossible d’initialiser le wallet Ethereum.');
    }

    setWalletAddress(account);
    return { account, walletClient };
  };

  const handleWalletPayment = async () => {
    if (!paymentIntent) {
      return;
    }

    try {
      const { account, walletClient } = await ensureWalletReady();

      setIsSendingTransaction(true);
      setIsPaymentConfirmed(false);
      const hash = await walletClient.sendTransaction({
        account,
        to: paymentIntent.walletAddress,
        value: parseEther(String(paymentIntent.montantCrypto)),
      });

      setPaymentHash(hash);
      setWalletAddress(account);
      setInfoMessage('Transaction envoyée, en attente de confirmation.');

      setIsConfirmingPayment(true);
      await anvilPublicClient.waitForTransactionReceipt({ hash });
      setIsPaymentConfirmed(true);
      setIsFinalizingPayment(true);

      const confirmation = await requestJson('/api/me/abonnement/payment-confirmation', {
        method: 'POST',
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          transactionHash: hash,
        }),
      });

      await refreshSession();
      await loadStatus();
      setShowPaymentModal(false);
      setInfoMessage(confirmation.message || `Transaction confirmée : ${hash.slice(0, 10)}...`);
    } catch (txError) {
      setError(txError.message || 'Impossible d’envoyer la transaction Ethereum.');
    } finally {
      setIsSendingTransaction(false);
      setIsSwitchingChain(false);
      setIsConfirmingPayment(false);
      setIsFinalizingPayment(false);
    }
  };

  const runUsdcAutoRenewFlow = async ({ activatePremiumNow = false } = {}) => {
    const config = renewal?.config;
    if (!renewal?.autoRenewalAvailable || !config?.tokenAddress || !config?.subscriptionCoreAddress) {
      setError('Le paiement USDC avec renouvellement automatique est indisponible.');
      return;
    }

    try {
      setError(null);
      setInfoMessage(null);
      setIsSubmittingAutoRenewal(true);

      const { account, walletClient } = await ensureWalletReady();
      const monthlyPriceUnits = BigInt(config.monthlyPriceUnits || '0');
      const approvalMonths = BigInt(config.approvalMonths || 12);
      const approveAmount = monthlyPriceUnits * approvalMonths;

      const approveHash = await walletClient.sendTransaction({
        account,
        to: config.tokenAddress,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [config.subscriptionCoreAddress, approveAmount],
        }),
      });
      await anvilPublicClient.waitForTransactionReceipt({ hash: approveHash });

      const enableHash = await walletClient.sendTransaction({
        account,
        to: config.subscriptionCoreAddress,
        data: encodeFunctionData({
          abi: subscriptionCoreAbi,
          functionName: 'enableAutoRenew',
          args: [monthlyPriceUnits],
        }),
      });
      await anvilPublicClient.waitForTransactionReceipt({ hash: enableHash });

      const endpoint = activatePremiumNow
        ? '/api/me/abonnement/usdc-auto-subscription'
        : '/api/me/abonnement/renewal-settings/activate';

      const response = await requestJson(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: account,
          smartContractAddress: config.subscriptionCoreAddress,
          mandateReference: enableHash,
        }),
      });

      await refreshSession();
      await loadStatus();
      setShowPaymentModal(false);
      setInfoMessage(
        response?.message
          || (activatePremiumNow
            ? `Paiement ${config.tokenSymbol} confirmé, votre compte Premium avec renouvellement automatique est actif.`
            : `Le renouvellement automatique en ${config.tokenSymbol} est activé.`),
      );
    } catch (renewalError) {
      setError(
        renewalError.message
          || (activatePremiumNow
            ? 'Impossible de finaliser le paiement USDC et d’activer le renouvellement automatique.'
            : 'Impossible d’activer le renouvellement automatique.'),
      );
    } finally {
      setIsSubmittingAutoRenewal(false);
    }
  };

  const handleUsdcSubscriptionAction = async () => {
    if (isPremium) {
      return;
    }

    await runUsdcAutoRenewFlow({ activatePremiumNow: true });
  };

  const handleAddUsdcToWallet = async () => {
    const provider = getEthereumProvider();
    const config = renewal?.config;

    if (!provider) {
      setError('Connectez un wallet pour continuer.');
      return;
    }

    if (!config?.tokenAddress) {
      setError('Token USDC indisponible.');
      return;
    }

    try {
      setError(null);
      const wasAdded = await provider.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: config.tokenAddress,
            symbol: config.tokenSymbol || 'USDC',
            decimals: Number(config.tokenDecimals || 6),
          },
        },
      });

      if (wasAdded) {
        setInfoMessage(`${config.tokenSymbol || 'USDC'} a bien été ajouté à MetaMask.`);
      }
    } catch (walletError) {
      setError(walletError.message || 'Impossible d’ajouter USDC dans MetaMask.');
    }
  };

  return (
    <div className="subscription-layout">
      <header className="subscription-topbar">
        <Link to="/dashboard" className="subscription-back-link" aria-label="Retour au tableau de bord">
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
        </Link>
        <div className="subscription-brand">
          <div className="brand-icon">
            <i className="fa-solid fa-wallet" aria-hidden="true" />
          </div>
          <span className="brand-name">Budgie</span>
        </div>
        <span className="subscription-topbar-label">Abonnement</span>
      </header>

      <main className="subscription-page page-shell">
        {error && <p className="feedback error">{error}</p>}
        {infoMessage && <p className="feedback success">{infoMessage}</p>}

        <SubscriptionCurrentCard
          activePlan={activePlan}
          isPremium={isPremium}
          loading={loading}
          metrics={metrics}
        />

        <SubscriptionPlansSection
          isPremium={isPremium}
          isLoadingPaymentIntent={isLoadingPaymentIntent}
          isLoadingUsdcSubscription={isSubmittingAutoRenewal}
          onPremiumAction={handlePremiumAction}
        />

        <SubscriptionBenefitsSection />
      </main>

      <SubscriptionPaymentModal
        paymentIntent={showPaymentModal ? paymentIntent : null}
        activePlan={activePlan}
        renewal={renewal}
        selectedMethod={showPaymentModal ? selectedPaymentMethod : null}
        onMethodChange={setSelectedPaymentMethod}
        durationMonths={ethDurationMonths}
        onDurationChange={(value) => setEthDurationMonths(ETH_DURATION_MONTH_OPTIONS.includes(value) ? value : 1)}
        walletAddress={walletAddress}
        isOnAnvilChain={isOnAnvilChain}
        isConnected={isConnected}
        isConnectingWallet={isConnectingWallet}
        isSwitchingChain={isSwitchingChain}
        isSendingTransaction={isSendingTransaction}
        isConfirmingPayment={isConfirmingPayment}
        isFinalizingPayment={isFinalizingPayment}
        isPaymentConfirmed={isPaymentConfirmed}
        isLoadingPaymentIntent={isLoadingPaymentIntent}
        isSubmittingUsdc={isSubmittingAutoRenewal}
        paymentHash={paymentHash}
        onClose={handleClosePaymentModal}
        onCopyAddress={handleCopyPaymentAddress}
        onConnectWallet={handleConnectWallet}
        onSwitchWalletAccount={handleSwitchWalletAccount}
        onDisconnectWalletSession={handleDisconnectWalletSession}
        onEthPaymentAction={isConnected ? handleWalletPayment : handleConnectWallet}
        onUsdcPaymentAction={handleUsdcSubscriptionAction}
        onPaymentSent={handlePaymentSent}
        onAddToken={handleAddUsdcToWallet}
      />
    </div>
  );
}
