import { premiumBenefits } from './subscriptionData.js';

export default function SubscriptionBenefitsSection() {
  return (
    <section className="subscription-benefits-card">
      <div className="subscription-benefits-head">
        <p className="subscription-eyebrow">
          <i className="fa-solid fa-bolt" aria-hidden="true" />
          Pourquoi passer à Premium ?
        </p>
      </div>

      <div className="subscription-benefits-grid page-grid-3">
        {premiumBenefits.map((benefit) => (
          <article key={benefit.title} className="subscription-benefit-item">
            <div className={`subscription-benefit-icon ${benefit.tone}`}>
              <i className={benefit.icon} aria-hidden="true" />
            </div>
            <h3>{benefit.title}</h3>
            <p>{benefit.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
