import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestJson, useAuth } from '../context/AuthContext.jsx';
import './subscription/SubscriptionPage.css';

const freePlanFeatures = [
  { label: '2 comptes maximum', included: true },
  { label: '7 dépenses par compte', included: true },
  { label: '2 revenus par compte', included: true },
  { label: 'Vue claire des quotas', included: true },
  { label: 'Paiements blockchain', included: false },
  { label: 'Support prioritaire', included: false },
  { label: 'Suppression des limites', included: false },
];

const premiumPlanFeatures = [
  { label: 'Comptes illimités' },
  { label: 'Dépenses illimitées' },
  { label: 'Revenus illimités' },
  { label: 'Paiements blockchain' },
  { label: 'Rapports avancés' },
  { label: 'Support prioritaire 24/7' },
  { label: 'Partage étendu' },
];

const premiumBenefits = [
  {
    icon: 'fa-solid fa-shield-halved',
    title: 'Blockchain',
    description: 'Réglez votre abonnement via Ethereum ou Bitcoin dès l’activation du paiement.',
    tone: 'cyan',
  },
  {
    icon: 'fa-solid fa-users',
    title: 'Partage',
    description: 'Préparez des espaces plus collaboratifs pour gérer un budget en commun.',
    tone: 'indigo',
  },
  {
    icon: 'fa-solid fa-infinity',
    title: 'Illimité',
    description: 'Retirez les limites de comptes, de dépenses et de revenus sur toute l’application.',
    tone: 'violet',
  },
];

function formatUsage(usage) {
  if (!usage) {
    return 'Indisponible';
  }

  if (usage.isUnlimited) {
    return 'Illimité';
  }

  return `${usage.used} / ${usage.limit}`;
}

function getProgressPercent(usage) {
  if (!usage) {
    return 0;
  }

  if (usage.isUnlimited) {
    return 100;
  }

  if (!usage.limit) {
    return 0;
  }

  return Math.min((usage.used / usage.limit) * 100, 100);
}

export default function SubscriptionPage() {
  const { abonnement, isPremium } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      setLoading(true);
      setError(null);

      try {
        const data = await requestJson('/api/me/abonnement-status', { method: 'GET' });
        if (!cancelled) {
          setStatus(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setStatus(null);
          setError(loadError.message || 'Impossible de charger votre abonnement.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const activePlan = status?.abonnement || abonnement;

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

    return {
      accountsUsage,
      depensesUsage,
      revenusUsage,
    };
  }, [activePlan, status]);

  const handlePremiumAction = () => {
    setInfoMessage('Le paiement blockchain sera branché ici. Cette page est prête pour l’intégration.');
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

          <div className="subscription-upsell-banner">
            <strong>Passez à Premium</strong>
            <span> pour débloquer toutes les fonctionnalités et supprimer les limites.</span>
          </div>
        </section>

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

              <ul className="subscription-feature-list">
                {freePlanFeatures.map((feature) => (
                  <li key={feature.label} className={feature.included ? 'included' : 'excluded'}>
                    <i
                      className={`fa-solid ${feature.included ? 'fa-check' : 'fa-xmark'}`}
                      aria-hidden="true"
                    />
                    <span>{feature.label}</span>
                  </li>
                ))}
              </ul>

              <button type="button" className="btn ghost subscription-plan-action" disabled={!isPremium}>
                {!isPremium ? 'Plan actuel' : 'Revenir au gratuit'}
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
                <strong>9.99 €</strong>
                <span>/mois</span>
              </div>
              <p className="subscription-plan-crypto-price">ou 0.00023 BTC / 0.0034 ETH</p>

              <div className="subscription-plan-divider" />

              <ul className="subscription-feature-list">
                {premiumPlanFeatures.map((feature) => (
                  <li key={feature.label} className="included">
                    <i className="fa-solid fa-check" aria-hidden="true" />
                    <span>{feature.label}</span>
                  </li>
                ))}
              </ul>

              <button type="button" className="btn primary subscription-plan-action" onClick={handlePremiumAction}>
                {isPremium ? 'Plan actif' : 'Passer à Premium'}
              </button>
            </article>
          </div>
        </section>

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
      </main>
    </div>
  );
}
