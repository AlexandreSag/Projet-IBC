import './SubscriptionPaymentModal.css';
import {
  formatAmount,
  formatCryptoAmount,
  formatExchangeRate,
  formatWalletAddress,
} from './subscriptionUtils.js';

export default function SubscriptionPaymentModal({
  paymentIntent,
  walletAddress,
  isOnAnvilChain,
  isConnected,
  isConnectingWallet,
  isSwitchingChain,
  isSendingTransaction,
  isConfirmingPayment,
  isFinalizingPayment,
  isPaymentConfirmed,
  paymentHash,
  onClose,
  onCopyAddress,
  onSwitchWalletAccount,
  onDisconnectWalletSession,
  onPaymentAction,
  onPaymentSent,
}) {
  if (!paymentIntent) {
    return null;
  }

  return (
    <div className="dashboard-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="payment-title">
      <div className="dashboard-modal card subscription-payment-modal">
        <div className="card-header subscription-payment-header">
          <div>
            <p className="subscription-eyebrow">
              <i className="fa-solid fa-shield-halved" aria-hidden="true" />
              Paiement sécurisé
            </p>
            <h2 id="payment-title">Payez votre abonnement Premium avec Ethereum</h2>
            <p className="subscription-payment-subtitle">
              Vérifiez les informations ci-dessous avant d’envoyer le paiement sur {paymentIntent.network}.
            </p>
          </div>
          <button
            type="button"
            className="dashboard-modal-close-btn"
            onClick={onClose}
            aria-label="Fermer"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <section className="subscription-payment-wallet-bar">
          <div className="subscription-payment-wallet-main">
            <div className="subscription-payment-wallet-copy">
              <span>Compte sélectionné</span>
              <strong>{formatWalletAddress(walletAddress)}</strong>
            </div>
            <div className="subscription-payment-wallet-meta">
              <span>{isOnAnvilChain ? 'Réseau Anvil Local' : 'Passez sur Anvil Local'}</span>
            </div>
          </div>
          <div className="subscription-payment-wallet-actions">
            <button type="button" className="btn ghost small" onClick={onSwitchWalletAccount}>
              Changer de compte
            </button>
            <button type="button" className="btn ghost small" onClick={onDisconnectWalletSession}>
              Déconnecter
            </button>
          </div>
        </section>

        <section className="subscription-payment-summary">
          <div className="subscription-payment-summary-head">
            <div>
              <span className="subscription-payment-summary-label">Montant</span>
              <strong>{formatCryptoAmount(paymentIntent.montantCrypto, paymentIntent.cryptoCode)}</strong>
            </div>
            <div>
              <span className="subscription-payment-summary-label">Plan</span>
              <strong>{formatAmount(paymentIntent.montantEur)}</strong>
            </div>
          </div>
          <div className="subscription-payment-detail-grid">
            <div className="subscription-payment-detail-row">
              <span>Réseau</span>
              <strong>Ethereum</strong>
            </div>
            <div className="subscription-payment-detail-row">
              <span>Taux de change</span>
              <strong>{formatExchangeRate(paymentIntent.montantEur, paymentIntent.montantCrypto, paymentIntent.cryptoCode)}</strong>
            </div>
            <div className="subscription-payment-detail-row">
              <span>Expiration</span>
              <strong>{paymentIntent.expiresAt ? new Date(paymentIntent.expiresAt).toLocaleString('fr-FR') : '24h'}</strong>
            </div>
          </div>
        </section>

        <section className="subscription-payment-address-block">
          <label htmlFor="subscription-payment-address">Adresse de paiement Ethereum</label>
          <div className="subscription-payment-address-row">
            <input
              id="subscription-payment-address"
              type="text"
              readOnly
              value={paymentIntent.walletAddress}
            />
            <button
              type="button"
              className="subscription-payment-copy-btn"
              onClick={onCopyAddress}
              aria-label="Copier l’adresse"
            >
              <i className="fa-regular fa-copy" aria-hidden="true" />
            </button>
          </div>
          <p>Envoyez {formatCryptoAmount(paymentIntent.montantCrypto, paymentIntent.cryptoCode)} à cette adresse.</p>
        </section>

        <div className="dashboard-modal-actions subscription-payment-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={onPaymentAction}
            disabled={isConnectingWallet || isSwitchingChain || isSendingTransaction || isConfirmingPayment || isFinalizingPayment}
          >
            {isConnectingWallet
              ? 'Connexion...'
              : isSwitchingChain
                ? 'Changement de réseau...'
                : isSendingTransaction
                  ? 'Envoi...'
                  : isConfirmingPayment
                    ? 'Confirmation...'
                    : isFinalizingPayment
                      ? 'Activation...'
                        : isConnected
                        ? 'Payer avec le wallet'
                        : 'Connecter un wallet'}
          </button>
        </div>

        {paymentHash && (
          <div className="subscription-payment-hash">
            <span>Transaction</span>
            <strong>{paymentHash}</strong>
            <button type="button" className="btn ghost small" onClick={onPaymentSent}>
              Marquer comme envoyé
            </button>
          </div>
        )}

        {!isConnected && (
          <p className="subscription-payment-hint">
            Connectez un wallet Ethereum compatible sur le réseau `Anvil Local`. MetaMask est recommandé.
          </p>
        )}

        {isConnected && !isOnAnvilChain && (
          <p className="subscription-payment-hint">
            Votre wallet est connecté, mais pas sur le bon réseau. Le bouton ci-dessus vous proposera de basculer vers `Anvil Local`.
          </p>
        )}

        {isPaymentConfirmed && (
          <p className="feedback success">
            Transaction confirmée sur la blockchain de test.
          </p>
        )}
      </div>
    </div>
  );
}
