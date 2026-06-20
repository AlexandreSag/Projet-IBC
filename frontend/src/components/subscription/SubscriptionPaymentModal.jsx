import './SubscriptionPaymentModal.css';
import { anvilLocalChain } from '../../lib/walletConfig.js';
import {
  formatAmount,
  formatCryptoAmount,
  formatExchangeRate,
  formatWalletAddress,
} from './subscriptionUtils.js';

function formatDateTime(value) {
  if (!value) {
    return 'Non disponible';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Non disponible' : date.toLocaleString('fr-FR');
}

function computeEstimatedPremiumEnd(currentExpiry, durationMonths) {
  const currentDate = currentExpiry ? new Date(currentExpiry) : null;
  const baseDate = currentDate && currentDate.getTime() > Date.now()
    ? currentDate
    : new Date();

  const nextDate = new Date(baseDate);
  nextDate.setMonth(nextDate.getMonth() + Number(durationMonths || 1));
  return nextDate;
}

export default function SubscriptionPaymentModal({
  paymentIntent,
  activePlan,
  renewal,
  selectedMethod,
  onMethodChange,
  durationMonths,
  onDurationChange,
  walletAddress,
  isOnAnvilChain,
  isConnected,
  isConnectingWallet,
  isSwitchingChain,
  isSendingTransaction,
  isConfirmingPayment,
  isFinalizingPayment,
  isPaymentConfirmed,
  isLoadingPaymentIntent,
  isSubmittingUsdc,
  paymentHash,
  onClose,
  onCopyAddress,
  onConnectWallet,
  onSwitchWalletAccount,
  onDisconnectWalletSession,
  onEthPaymentAction,
  onUsdcPaymentAction,
  onPaymentSent,
  onAddToken,
}) {
  if (!selectedMethod) {
    return null;
  }

  const chainLabel = anvilLocalChain.name;
  const tokenSymbol = renewal?.config?.tokenSymbol || 'USDC';
  const isEthMethod = selectedMethod === 'eth';
  const isUsdcMethod = selectedMethod === 'usdc';
  const isBusy = isConnectingWallet
    || isSwitchingChain
    || isSendingTransaction
    || isConfirmingPayment
    || isFinalizingPayment
    || isSubmittingUsdc;
  const estimatedPremiumEnd = isEthMethod ? computeEstimatedPremiumEnd(activePlan?.expiresAt, durationMonths) : null;

  const primaryLabel = isEthMethod
    ? (isConnectingWallet
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
                : 'Connecter un wallet')
    : (isSubmittingUsdc ? `Paiement ${tokenSymbol}...` : `Payer en ${tokenSymbol} avec renouvellement`);

  return (
    <div className="dashboard-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="payment-title">
      <div className="dashboard-modal card subscription-payment-modal">
        <div className="card-header subscription-payment-header">
          <div>
            <p className="subscription-eyebrow">
              <i className="fa-solid fa-shield-halved" aria-hidden="true" />
              Paiement sécurisé
            </p>
            <h2 id="payment-title">Choisissez votre mode de paiement</h2>
            <p className="subscription-payment-subtitle">
              Ethereum active le Premium immédiatement. {tokenSymbol} active aussi le renouvellement automatique.
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

        <section className="subscription-payment-methods" aria-label="Modes de paiement">
          <button
            type="button"
            className={`subscription-payment-method${isEthMethod ? ' active' : ''}`}
            onClick={() => onMethodChange('eth')}
          >
            Ethereum
          </button>
          <button
            type="button"
            className={`subscription-payment-method${isUsdcMethod ? ' active' : ''}`}
            onClick={() => onMethodChange('usdc')}
            disabled={!renewal?.autoRenewalAvailable}
          >
            {tokenSymbol} + renouvellement
          </button>
        </section>

        <section className="subscription-payment-wallet-bar">
          <div className="subscription-payment-wallet-main">
            <div className="subscription-payment-wallet-copy">
              <span>Compte sélectionné</span>
              <strong>{formatWalletAddress(walletAddress)}</strong>
            </div>
            <div className="subscription-payment-wallet-meta">
              <span>{isOnAnvilChain ? `Réseau ${chainLabel}` : `Passez sur ${chainLabel}`}</span>
            </div>
          </div>
          <div className="subscription-payment-wallet-actions">
            {isConnected ? (
              <>
                <button type="button" className="btn ghost small" onClick={onSwitchWalletAccount}>
                  Changer de compte
                </button>
                <button type="button" className="btn ghost small" onClick={onDisconnectWalletSession}>
                  Déconnecter
                </button>
              </>
            ) : (
              <button type="button" className="btn ghost small" onClick={onConnectWallet}>
                Connecter mon wallet
              </button>
            )}
          </div>
        </section>

        {isEthMethod ? (
          <>
            <section className="subscription-payment-summary">
              <div className="subscription-payment-summary-head">
                <div>
                  <span className="subscription-payment-summary-label">Montant</span>
                  <strong>
                    {paymentIntent
                      ? formatCryptoAmount(paymentIntent.montantCrypto, paymentIntent.cryptoCode)
                      : 'Calcul en cours...'}
                  </strong>
                </div>
                <div>
                  <span className="subscription-payment-summary-label">Plan</span>
                  <strong>{paymentIntent ? formatAmount(paymentIntent.montantEur) : '...'}</strong>
                </div>
              </div>

              <div className="subscription-payment-duration-row">
                <label htmlFor="subscription-duration-months">Durée</label>
                <select
                  id="subscription-duration-months"
                  value={durationMonths}
                  onChange={(event) => onDurationChange(Number(event.target.value))}
                  disabled={isLoadingPaymentIntent || isBusy}
                >
                  <option value={1}>1 mois</option>
                  <option value={3}>3 mois</option>
                  <option value={6}>6 mois</option>
                  <option value={12}>12 mois</option>
                </select>
              </div>

              {paymentIntent && (
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
                    <span>Fin estimée</span>
                    <strong>{formatDateTime(estimatedPremiumEnd)}</strong>
                  </div>
                  <div className="subscription-payment-detail-row">
                    <span>Demande valable jusqu’au</span>
                    <strong>{formatDateTime(paymentIntent.expiresAt)}</strong>
                  </div>
                </div>
              )}
            </section>

            {paymentIntent && (
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
            )}
          </>
        ) : (
          <section className="subscription-payment-summary">
            <div className="subscription-payment-summary-head">
              <div>
                <span className="subscription-payment-summary-label">Montant mensuel</span>
                <strong>9.99 {tokenSymbol}</strong>
              </div>
              <div>
                <span className="subscription-payment-summary-label">Renouvellement</span>
                <strong>Automatique</strong>
              </div>
            </div>
            <div className="subscription-payment-detail-grid">
              <div className="subscription-payment-detail-row">
                <span>Réseau</span>
                <strong>Ethereum</strong>
              </div>
              <div className="subscription-payment-detail-row">
                <span>Wallet</span>
                <strong>{isConnected ? formatWalletAddress(walletAddress) : 'À connecter'}</strong>
              </div>
              <div className="subscription-payment-detail-row">
                <span>Autorisation</span>
                <strong>Approve + abonnement</strong>
              </div>
            </div>
            <div className="subscription-payment-inline-actions">
              <button type="button" className="btn ghost small" onClick={onAddToken} disabled={isBusy}>
                Ajouter {tokenSymbol}
              </button>
            </div>
          </section>
        )}

        <div className="dashboard-modal-actions subscription-payment-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={isEthMethod ? onEthPaymentAction : onUsdcPaymentAction}
            disabled={isEthMethod ? (!paymentIntent || isLoadingPaymentIntent || isBusy) : isBusy}
          >
            {primaryLabel}
          </button>
        </div>

        {isEthMethod && paymentHash && (
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
            Connecte un wallet sur {chainLabel}.
          </p>
        )}

        {isConnected && !isOnAnvilChain && (
          <p className="subscription-payment-hint">
            Votre wallet est connecté, mais pas sur le bon réseau. Le bouton ci-dessus vous proposera de basculer vers {chainLabel}.
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
