import { useCallback, useEffect, useMemo, useState } from 'react';
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

function normalizeSelection(selection) {
  return {
    accountIds: Array.isArray(selection?.accountIds) ? selection.accountIds : [],
    depenseIds: Array.isArray(selection?.depenseIds) ? selection.depenseIds : [],
    revenuIds: Array.isArray(selection?.revenuIds) ? selection.revenuIds : [],
  };
}

function buildProjectedDowngrade(preview, selection) {
  if (!preview?.targetPlan) {
    return null;
  }

  const selectedAccounts = new Set(selection?.accountIds || []);
  const selectedDepenses = new Set(selection?.depenseIds || []);
  const selectedRevenus = new Set(selection?.revenuIds || []);
  const keptAccounts = (preview.accounts || [])
    .filter((account) => !selectedAccounts.has(account.id))
    .map((account) => ({
      ...account,
      depenses: (account.depenses || []).filter((depense) => !selectedDepenses.has(depense.id)),
      revenus: (account.revenus || []).filter((revenu) => !selectedRevenus.has(revenu.id)),
    }));

  const accountLimit = preview.targetPlan.limits?.comptes;
  const depensesLimit = preview.targetPlan.limits?.depensesParCompte;
  const revenusLimit = preview.targetPlan.limits?.revenusParCompte;

  const perCompte = keptAccounts.map((account) => ({
    accountId: account.id,
    accountName: account.nom_court,
    depensesUsed: account.depenses.length,
    depensesLimit,
    depensesOverBy: depensesLimit === null ? 0 : Math.max(account.depenses.length - depensesLimit, 0),
    revenusUsed: account.revenus.length,
    revenusLimit,
    revenusOverBy: revenusLimit === null ? 0 : Math.max(account.revenus.length - revenusLimit, 0),
  }));

  return {
    comptesUsed: keptAccounts.length,
    comptesLimit: accountLimit,
    comptesOverBy: accountLimit === null ? 0 : Math.max(keptAccounts.length - accountLimit, 0),
    perCompte,
  };
}

function isProjectedDowngradeValid(projected) {
  if (!projected) {
    return false;
  }

  return projected.comptesOverBy === 0
    && projected.perCompte.every((account) => account.depensesOverBy === 0 && account.revenusOverBy === 0);
}

function formatAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '0 €';
  }

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

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
  const { abonnement, isPremium, upgradeToPremiumTest, downgradeToFreeTest } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [isSubmittingPlanChange, setIsSubmittingPlanChange] = useState(false);
  const [isLoadingDowngradePreview, setIsLoadingDowngradePreview] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [downgradePreview, setDowngradePreview] = useState(null);
  const [downgradeSelection, setDowngradeSelection] = useState({
    accountIds: [],
    depenseIds: [],
    revenuIds: [],
  });

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

    return () => {
      controller.abort();
    };
  }, [loadStatus]);

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

  const handlePremiumAction = async () => {
    if (isPremium || isSubmittingPlanChange) {
      return;
    }

    setIsSubmittingPlanChange(true);
    setError(null);
    setInfoMessage(null);

    try {
      const data = await upgradeToPremiumTest();
      setInfoMessage(data?.message || 'Le plan Premium de test a été activé.');
      await loadStatus();
    } catch (upgradeError) {
      setError(upgradeError.message || 'Impossible d’activer le plan Premium de test.');
    } finally {
      setIsSubmittingPlanChange(false);
    }
  };

  const handleFreeAction = async () => {
    if (!isPremium || isSubmittingPlanChange) {
      return;
    }

    setIsLoadingDowngradePreview(true);
    setError(null);
    setInfoMessage(null);

    try {
      const preview = await requestJson('/api/me/abonnement/downgrade-preview', { method: 'GET' });
      const selection = normalizeSelection(preview?.recommendedSelection);
      setDowngradePreview(preview);
      setDowngradeSelection(selection);
      setShowDowngradeModal(true);
    } catch (previewError) {
      setError(previewError.message || 'Impossible de préparer le retour au plan gratuit.');
    } finally {
      setIsLoadingDowngradePreview(false);
    }
  };

  const handleDowngradeSelectionToggle = (type, id) => {
    setDowngradeSelection((current) => {
      const next = new Set(current[type]);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return {
        ...current,
        [type]: [...next],
      };
    });
  };

  const handleConfirmDowngrade = async () => {
    if (!downgradePreview || isSubmittingPlanChange) {
      return;
    }

    setIsSubmittingPlanChange(true);
    setError(null);
    setInfoMessage(null);

    try {
      const data = await downgradeToFreeTest(downgradeSelection);
      setInfoMessage(data?.message || 'Le retour au plan gratuit de test a été appliqué.');
      setShowDowngradeModal(false);
      setDowngradePreview(null);
      await loadStatus();
    } catch (downgradeError) {
      setError(downgradeError.message || 'Impossible de revenir au plan gratuit de test.');
    } finally {
      setIsSubmittingPlanChange(false);
    }
  };

  const projectedDowngrade = useMemo(
    () => buildProjectedDowngrade(downgradePreview, downgradeSelection),
    [downgradePreview, downgradeSelection],
  );

  const canConfirmDowngrade = isProjectedDowngradeValid(projectedDowngrade);
  const downgradeSelectionStats = useMemo(() => ({
    accounts: downgradeSelection.accountIds.length,
    depenses: downgradeSelection.depenseIds.length,
    revenus: downgradeSelection.revenuIds.length,
  }), [downgradeSelection]);
  const recommendedSelectionStats = useMemo(() => ({
    accounts: downgradePreview?.recommendedSelection?.accountIds?.length || 0,
    depenses: downgradePreview?.recommendedSelection?.depenseIds?.length || 0,
    revenus: downgradePreview?.recommendedSelection?.revenuIds?.length || 0,
  }), [downgradePreview]);

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

          {!isPremium && (
            <div className="subscription-upsell-banner">
              <strong>Passez à Premium</strong>
              <span> pour débloquer toutes les fonctionnalités et supprimer les limites.</span>
            </div>
          )}
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

              <button
                type="button"
                className="btn ghost subscription-plan-action"
                onClick={handleFreeAction}
                disabled={!isPremium || isSubmittingPlanChange || isLoadingDowngradePreview}
              >
                {!isPremium
                  ? 'Plan actuel'
                  : isLoadingDowngradePreview
                    ? 'Préparation...'
                    : isSubmittingPlanChange
                    ? 'Retour...'
                    : 'Revenir au gratuit'}
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

              <button
                type="button"
                className="btn primary subscription-plan-action"
                onClick={handlePremiumAction}
                disabled={isPremium || isSubmittingPlanChange}
              >
                {isPremium ? 'Plan actif' : isSubmittingPlanChange ? 'Activation...' : 'Activer Premium'}
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

      {showDowngradeModal && downgradePreview && (
        <div className="subscription-downgrade-overlay" role="dialog" aria-modal="true" aria-labelledby="downgrade-title">
          <div className="subscription-downgrade-modal card">
            <div className="subscription-downgrade-header">
              <div>
                <p className="subscription-eyebrow">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                  Retour au gratuit
                </p>
                <h2 id="downgrade-title">Choisissez ce qui sera supprimé</h2>
                <p className="subscription-downgrade-intro">
                  Pour revenir au plan gratuit, votre espace doit repasser sous les quotas. Nous avons déjà précoché
                  une sélection recommandée que vous pouvez ajuster.
                </p>
              </div>
              <button
                type="button"
                className="subscription-downgrade-close"
                onClick={() => setShowDowngradeModal(false)}
                aria-label="Fermer"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="subscription-downgrade-layout">
              <div className="subscription-downgrade-list">
                {downgradePreview.accounts.map((account) => {
                  const accountSelected = downgradeSelection.accountIds.includes(account.id);
                  return (
                    <article key={account.id} className={`subscription-downgrade-account${accountSelected ? ' selected' : ''}`}>
                      <div className="subscription-downgrade-account-top">
                        <label className="subscription-downgrade-account-toggle">
                          <input
                            type="checkbox"
                            checked={accountSelected}
                            onChange={() => handleDowngradeSelectionToggle('accountIds', account.id)}
                          />
                          <span>
                            <strong>{account.nom_court}</strong>
                            <small>
                              Supprimer ce compte supprimera aussi {account.depensesCount} dépense{account.depensesCount > 1 ? 's' : ''} et {account.revenusCount} revenu{account.revenusCount > 1 ? 's' : ''}.
                            </small>
                          </span>
                        </label>

                        <div className="subscription-downgrade-account-badges">
                          <span className="subscription-downgrade-account-badge">
                            {account.depensesCount} dép.
                          </span>
                          <span className="subscription-downgrade-account-badge">
                            {account.revenusCount} rev.
                          </span>
                        </div>
                      </div>

                      {!accountSelected && (
                        <div className="subscription-downgrade-transactions">
                          {account.depenses?.length > 0 && (
                            <div className="subscription-downgrade-transaction-group">
                              <h3>Dépenses</h3>
                              <div className="subscription-downgrade-items-list">
                                {account.depenses.map((depense) => (
                                  <label key={depense.id} className="subscription-downgrade-item">
                                    <input
                                      type="checkbox"
                                      checked={downgradeSelection.depenseIds.includes(depense.id)}
                                      onChange={() => handleDowngradeSelectionToggle('depenseIds', depense.id)}
                                    />
                                    <span>{depense.nom_court}</span>
                                    <span className="subscription-downgrade-item-amount">{formatAmount(depense.montant)}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {account.revenus?.length > 0 && (
                            <div className="subscription-downgrade-transaction-group">
                              <h3>Revenus</h3>
                              <div className="subscription-downgrade-items-list">
                                {account.revenus.map((revenu) => (
                                  <label key={revenu.id} className="subscription-downgrade-item">
                                    <input
                                      type="checkbox"
                                      checked={downgradeSelection.revenuIds.includes(revenu.id)}
                                      onChange={() => handleDowngradeSelectionToggle('revenuIds', revenu.id)}
                                    />
                                    <span>{revenu.nom_court}</span>
                                    <span className="subscription-downgrade-item-amount">{formatAmount(revenu.montant)}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              <aside className="subscription-downgrade-sidebar">
                <div className="subscription-downgrade-alert">
                  <i className="fa-solid fa-circle-info" aria-hidden="true" />
                  <p>
                    Les éléments sélectionnés seront définitivement supprimés pour respecter les limites du plan gratuit.
                  </p>
                </div>

                <div className="subscription-downgrade-summary-card">
                  <div className="subscription-downgrade-summary-head">
                    <h3>État des quotas</h3>
                    <span className={`subscription-downgrade-state${canConfirmDowngrade ? ' valid' : ' invalid'}`}>
                      {canConfirmDowngrade ? 'Prêt' : 'Incomplet'}
                    </span>
                  </div>

                  <div className="subscription-downgrade-stat-list">
                    <div className="subscription-downgrade-stat-item">
                      <span className="stat-label">Comptes conservés</span>
                      <strong className={`stat-value ${projectedDowngrade?.comptesOverBy === 0 ? 'valid' : 'invalid'}`}>
                        {projectedDowngrade?.comptesUsed ?? 0} / {projectedDowngrade?.comptesLimit ?? '-'}
                      </strong>
                    </div>

                    <div className="subscription-downgrade-stat-divider" />

                    <div className="subscription-downgrade-per-account">
                      {projectedDowngrade?.perCompte.map((account) => {
                        const isAccountValid = account.depensesOverBy === 0 && account.revenusOverBy === 0;
                        return (
                          <div key={account.accountId} className={`subscription-downgrade-per-account-row ${isAccountValid ? 'valid' : 'invalid'}`}>
                            <span className="account-name">{account.accountName}</span>
                            <span className="account-metrics">
                              <span>{account.depensesUsed}/{account.depensesLimit} dép.</span>
                              <span>•</span>
                              <span>{account.revenusUsed}/{account.revenusLimit} rev.</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="subscription-downgrade-total-to-delete">
                    <span>Éléments à supprimer :</span>
                    <strong>{downgradeSelectionStats.accounts + downgradeSelectionStats.depenses + downgradeSelectionStats.revenus}</strong>
                  </div>

                  {!canConfirmDowngrade && (
                    <div className="subscription-downgrade-error-msg">
                      <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                      <span>Certaines limites sont dépassées. Veuillez sélectionner plus d'éléments à supprimer.</span>
                    </div>
                  )}
                </div>

                <div className="subscription-downgrade-recommendation">
                  <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
                  <div>
                    <h3>Sélection recommandée</h3>
                    <p>
                      {recommendedSelectionStats.accounts} compte{recommendedSelectionStats.accounts > 1 ? 's' : ''},
                      {' '}{recommendedSelectionStats.depenses} dép. et
                      {' '}{recommendedSelectionStats.revenus} rev.
                    </p>
                  </div>
                </div>
              </aside>
            </div>

            <div className="subscription-downgrade-actions">
              <button type="button" className="btn ghost" onClick={() => setShowDowngradeModal(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleConfirmDowngrade}
                disabled={!canConfirmDowngrade || isSubmittingPlanChange}
              >
                {isSubmittingPlanChange ? 'Retour au gratuit...' : 'Confirmer le retour au gratuit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
