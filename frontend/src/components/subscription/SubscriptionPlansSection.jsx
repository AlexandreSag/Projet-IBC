import { freePlanFeatures, premiumPlanFeatures } from './subscriptionData.js';
import { formatAmount } from './subscriptionUtils.js';

function FeatureList({ features, premium = false }) {
  return (
    <ul className="subscription-feature-list">
      {features.map((feature) => (
        <li key={feature.label} className={premium || feature.included ? 'included' : 'excluded'}>
          <i
            className={`fa-solid ${(premium || feature.included) ? 'fa-check' : 'fa-xmark'}`}
            aria-hidden="true"
          />
          <span>{feature.label}</span>
        </li>
      ))}
    </ul>
  );
}

export default function SubscriptionPlansSection({
  isPremium,
  canActivateUsdcRenewal,
  premiumPlan,
  isLoadingPaymentIntent,
  isLoadingUsdcSubscription,
  onPremiumAction,
}) {
  return (
    <section className="subscription-plans-section">
      <div className="subscription-section-head">
        <h2>Choisissez votre plan</h2>
        <p>Sélectionnez le plan qui correspond à vos besoins.</p>
      </div>

      <div className="subscription-plan-grid page-grid-2">
        <article className={`subscription-plan-card${!isPremium ? ' current' : ''}`}>
          <div className="subscription-plan-card-head">
            <div className="subscription-plan-icon muted">
              <i className="fa-solid fa-wallet" aria-hidden="true" />
            </div>
            <div>
              <h3>Gratuit</h3>
              <p>Pour commencer</p>
            </div>
          </div>

          <div className="subscription-plan-price-block">
            <strong>0.00 €</strong>
            <span>/mois</span>
          </div>

          <div className="subscription-plan-divider" />
          <FeatureList features={freePlanFeatures} />

          <button type="button" className="btn ghost subscription-plan-action" disabled>
            {!isPremium ? 'Plan actuel' : 'Gérer dans les paramètres'}
          </button>
        </article>

        <article className={`subscription-plan-card premium${isPremium ? ' current' : ''}`}>
          <span className="subscription-popular-badge">Populaire</span>

          <div className="subscription-plan-card-head">
            <div className="subscription-plan-icon accent">
              <i className="fa-solid fa-crown" aria-hidden="true" />
            </div>
            <div>
              <h3>Premium</h3>
              <p>Pour les utilisateurs avancés</p>
            </div>
          </div>

          <div className="subscription-plan-price-block">
            <strong>{premiumPlan ? formatAmount(premiumPlan.prix) : '...'}</strong>
            <span>/mois</span>
          </div>
          <p className="subscription-plan-crypto-price">Le montant en ETH est affiché à l’étape de paiement.</p>

          <div className="subscription-plan-divider" />
          <FeatureList features={premiumPlanFeatures} premium />

          <button
            type="button"
            className="btn primary subscription-plan-action"
            onClick={onPremiumAction}
            disabled={
              (isPremium && !canActivateUsdcRenewal)
              || isLoadingPaymentIntent
              || isLoadingUsdcSubscription
            }
          >
            {isPremium
              ? (canActivateUsdcRenewal ? 'Activer le renouvellement USDC' : 'Plan actif')
              : isLoadingPaymentIntent
                ? 'Préparation...'
                : 'Payer'}
          </button>
        </article>
      </div>
    </section>
  );
}
