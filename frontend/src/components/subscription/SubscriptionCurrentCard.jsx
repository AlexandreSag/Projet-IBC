import { formatUsage, getProgressPercent } from './subscriptionUtils.js';

export default function SubscriptionCurrentCard({
  activePlan,
  isPremium,
  loading,
  metrics,
}) {
  return (
    <section className="subscription-current-card">
      <div className="subscription-current-head">
        <div>
          <p className="subscription-eyebrow">
            <i className="fa-regular fa-sparkles" aria-hidden="true" />
            Votre abonnement actuel
          </p>
          <h1>{activePlan?.nom || 'Gratuit'}</h1>
          <p className="subscription-current-copy">
            {isPremium
              ? 'Votre plan premium est actif. Vous profitez actuellement de l’ensemble des fonctionnalités sans limite.'
              : 'Vous êtes sur le plan gratuit. Passez à Premium pour débloquer toutes les fonctionnalités et supprimer les limites.'}
          </p>
        </div>
        <span className={`subscription-status-badge${isPremium ? ' premium' : ''}`}>
          {isPremium ? 'Premium actif' : 'Actif'}
        </span>
      </div>

      <div className="subscription-current-metrics">
        <article className="subscription-metric">
          <div className="subscription-metric-row">
            <span>Comptes utilisés</span>
            <strong>{loading ? '...' : formatUsage(metrics.accountsUsage)}</strong>
          </div>
          <div className="subscription-progress-track">
            <span
              className="subscription-progress-fill"
              style={{ width: `${getProgressPercent(metrics.accountsUsage)}%` }}
            />
          </div>
        </article>

        <article className="subscription-metric">
          <div className="subscription-metric-row">
            <span>Dépenses max sur un compte</span>
            <strong>{loading ? '...' : formatUsage(metrics.depensesUsage)}</strong>
          </div>
          <div className="subscription-progress-track">
            <span
              className="subscription-progress-fill"
              style={{ width: `${getProgressPercent(metrics.depensesUsage)}%` }}
            />
          </div>
        </article>

        <article className="subscription-metric subscription-metric-aside">
          <span>Revenus max sur un compte</span>
          <strong>{loading ? '...' : formatUsage(metrics.revenusUsage)}</strong>
        </article>
      </div>

      {!isPremium && (
        <div className="subscription-upsell-banner">
          <strong>Passez à Premium</strong>
          <span> pour débloquer toutes les fonctionnalités et supprimer les limites.</span>
        </div>
      )}
    </section>
  );
}
