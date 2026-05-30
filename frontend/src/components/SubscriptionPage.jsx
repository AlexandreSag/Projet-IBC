import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createWalletClient, parseEther } from 'viem';
import { requestJson, useAuth } from '../context/AuthContext.jsx';
import {
  anvilLocalChain,
  anvilPublicClient,
  createBrowserWalletClient,
  getEthereumProvider,
} from '../lib/walletConfig.js';
import SubscriptionBenefitsSection from './subscription/SubscriptionBenefitsSection.jsx';
import SubscriptionCurrentCard from './subscription/SubscriptionCurrentCard.jsx';
import SubscriptionPaymentModal from './subscription/SubscriptionPaymentModal.jsx';
import SubscriptionPlansSection from './subscription/SubscriptionPlansSection.jsx';
import './subscription/SubscriptionPage.css';

export default function SubscriptionPage() {
  const { abonnement, isPremium, refreshSession } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [isLoadingPaymentIntent, setIsLoadingPaymentIntent] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [openPaymentIntent, setOpenPaymentIntent] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletChainId, setWalletChainId] = useState(null);
  const [walletSessionDisconnected, setWalletSessionDisconnected] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);
  const [isSendingTransaction, setIsSendingTransaction] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [isFinalizingPayment, setIsFinalizingPayment] = useState(false);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [paymentHash, setPaymentHash] = useState(null);

  const isConnected = Boolean(walletAddress) && !walletSessionDisconnected;
  const isOnAnvilChain = walletChainId === anvilLocalChain.id;
  const activePlan = status?.abonnement || abonnement;

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

  useEffect(() => {
    let cancelled = false;

    async function loadOpenPaymentIntent() {
      try {
        const data = await requestJson('/api/me/abonnement/payment-intent/open', { method: 'GET' });
        if (!cancelled) {
          setOpenPaymentIntent(data?.paymentIntent || null);
        }
      } catch {
        if (!cancelled) {
          setOpenPaymentIntent(null);
        }
      }
    }

    void loadOpenPaymentIntent();
    return () => {
      cancelled = true;
    };
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

    setIsLoadingPaymentIntent(true);
    setError(null);
    setInfoMessage(null);

    try {
      const data = await requestJson('/api/me/abonnement/payment-intent', {
        method: 'POST',
        body: JSON.stringify({ planCode: 'premium', cryptoCode: 'eth' }),
      });
      setPaymentIntent(data?.paymentIntent || null);
      setOpenPaymentIntent(data?.paymentIntent || null);
      setPaymentHash(null);
      setIsPaymentConfirmed(false);
      setShowPaymentModal(true);
    } catch (paymentError) {
      setError(paymentError.message || 'Impossible de préparer le paiement Ethereum.');
    } finally {
      setIsLoadingPaymentIntent(false);
    }
  };

  const handleResumePayment = () => {
    setPaymentIntent(openPaymentIntent);
    setShowPaymentModal(true);
  };

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
    setInfoMessage('La transaction a été envoyée. Le statut Premium est en cours de synchronisation.');
  };

  const handleConnectWallet = async () => {
    if (isConnected) {
      return;
    }

    const provider = getEthereumProvider();
    if (!provider) {
      setError('Un wallet Ethereum compatible est requis pour effectuer ce paiement. MetaMask est recommandé.');
      return;
    }

    setIsConnectingWallet(true);

    try {
      setWalletSessionDisconnected(false);
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const chainHex = await provider.request({ method: 'eth_chainId' });
      setWalletAddress(Array.isArray(accounts) && accounts[0] ? accounts[0] : null);
      setWalletChainId(chainHex ? Number.parseInt(chainHex, 16) : null);
      setInfoMessage('Wallet connecté. Vous pouvez maintenant lancer le paiement.');
    } catch (walletError) {
      setError(walletError.message || 'Impossible de connecter le wallet.');
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleSwitchWalletAccount = async () => {
    const provider = getEthereumProvider();
    if (!provider) {
      setError('Un wallet Ethereum compatible est requis pour sélectionner un autre compte.');
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
      setInfoMessage('Compte du wallet mis à jour.');
    } catch (walletError) {
      setError(walletError.message || 'Impossible de changer de compte sur le wallet.');
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleDisconnectWalletSession = () => {
    setWalletSessionDisconnected(true);
    setWalletAddress(null);
    setWalletChainId(null);
    setInfoMessage('Wallet déconnecté côté application. Le wallet reste ouvert dans le navigateur.');
  };

  const handleWalletPayment = async () => {
    if (!paymentIntent) {
      return;
    }

    const provider = getEthereumProvider();
    if (!provider) {
      setError('Un wallet Ethereum compatible est requis pour effectuer ce paiement. MetaMask est recommandé.');
      return;
    }

    try {
      if (!isConnected) {
        await handleConnectWallet();
        return;
      }

      if (!isOnAnvilChain) {
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
        throw new Error('Aucun compte wallet disponible pour envoyer la transaction.');
      }

      const walletClient = createWalletClient({
        chain: anvilLocalChain,
        transport: createBrowserWalletClient(),
      });

      if (!walletClient) {
        throw new Error('Impossible d’initialiser le wallet Ethereum.');
      }

      setIsSendingTransaction(true);
      setIsPaymentConfirmed(false);
      const hash = await walletClient.sendTransaction({
        account,
        to: paymentIntent.walletAddress,
        value: parseEther(String(paymentIntent.montantCrypto)),
      });

      setPaymentHash(hash);
      setWalletAddress(account);
      setInfoMessage('Transaction envoyée. En attente de confirmation Ethereum.');

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
      setOpenPaymentIntent(null);
      setShowPaymentModal(false);
      setInfoMessage(confirmation.message || `Transaction Ethereum confirmée: ${hash.slice(0, 10)}...`);
    } catch (txError) {
      setError(txError.message || 'Impossible d’envoyer la transaction Ethereum.');
    } finally {
      setIsSendingTransaction(false);
      setIsSwitchingChain(false);
      setIsConfirmingPayment(false);
      setIsFinalizingPayment(false);
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
          openPaymentIntent={openPaymentIntent}
          onPremiumAction={handlePremiumAction}
          onResumePayment={handleResumePayment}
        />

        <SubscriptionBenefitsSection />
      </main>

      <SubscriptionPaymentModal
        paymentIntent={showPaymentModal ? paymentIntent : null}
        walletAddress={walletAddress}
        isOnAnvilChain={isOnAnvilChain}
        isConnected={isConnected}
        isConnectingWallet={isConnectingWallet}
        isSwitchingChain={isSwitchingChain}
        isSendingTransaction={isSendingTransaction}
        isConfirmingPayment={isConfirmingPayment}
        isFinalizingPayment={isFinalizingPayment}
        isPaymentConfirmed={isPaymentConfirmed}
        paymentHash={paymentHash}
        onClose={handleClosePaymentModal}
        onCopyAddress={handleCopyPaymentAddress}
        onSwitchWalletAccount={handleSwitchWalletAccount}
        onDisconnectWalletSession={handleDisconnectWalletSession}
        onPaymentAction={isConnected ? handleWalletPayment : handleConnectWallet}
        onPaymentSent={handlePaymentSent}
      />
    </div>
  );
}
