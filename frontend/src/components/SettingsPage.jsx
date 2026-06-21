import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { requestJson, useAuth } from '../context/AuthContext.jsx';
import DashboardTopbar from './dashboard/DashboardTopbar.jsx';
import SubscriptionDowngradeModal from './subscription/SubscriptionDowngradeModal.jsx';
import {
  buildProjectedDowngrade,
  isProjectedDowngradeValid,
  normalizeSelection,
} from './subscription/subscriptionUtils.js';
import './settings/SettingsPage.css';

const PASSWORD_HINT =
  '12 caractères minimum avec majuscule, minuscule, chiffre et caractère spécial (! @ # ? % & *).';
const DEFAULT_VISIBLE_PAYMENT_COUNT = 5;

function isStrongPassword(password) {
  if (typeof password !== 'string' || password.length < 12) return false;
  return (
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#?%&*]/.test(password)
  );
}

export default function SettingsPage() {
  const { user, abonnement, updateProfile, changePassword, downgradeToFree } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profileForm, setProfileForm] = useState({
    nom: '',
    prenom: '',
    email: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    mot_de_passe_actuel: '',
    nouveau_mot_de_passe: '',
    confirmation_mot_de_passe: '',
  });
  const [profileMessage, setProfileMessage] = useState(null);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [abonnementStatus, setAbonnementStatus] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [abonnementError, setAbonnementError] = useState(null);
  const [loadingAbonnementStatus, setLoadingAbonnementStatus] = useState(true);
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(true);
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isSubmittingRenewalToggle, setIsSubmittingRenewalToggle] = useState(false);
  const [isLoadingDowngradePreview, setIsLoadingDowngradePreview] = useState(false);
  const [isSubmittingDowngrade, setIsSubmittingDowngrade] = useState(false);
  const [expandedPaymentIds, setExpandedPaymentIds] = useState([]);
  const [visiblePaymentCount, setVisiblePaymentCount] = useState(DEFAULT_VISIBLE_PAYMENT_COUNT);
  const [downgradePreview, setDowngradePreview] = useState(null);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [hasAutoOpenedCleanup, setHasAutoOpenedCleanup] = useState(false);
  const [downgradeSelection, setDowngradeSelection] = useState({
    accountIds: [],
    depenseIds: [],
    revenuIds: [],
  });

  useEffect(() => {
    setProfileForm({
      nom: user?.nom || '',
      prenom: user?.prenom || '',
      email: user?.email || '',
    });
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function loadAbonnementStatus() {
      setLoadingAbonnementStatus(true);
      setLoadingPaymentHistory(true);
      setAbonnementError(null);

      try {
        const [statusData, paymentsData] = await Promise.all([
          requestJson('/api/me/abonnement-status', { method: 'GET' }),
          requestJson('/api/me/abonnement/payments?limit=10', { method: 'GET' }),
        ]);

        if (!cancelled) {
          setAbonnementStatus(statusData);
          setPaymentHistory(Array.isArray(paymentsData?.payments) ? paymentsData.payments : []);
        }
      } catch (error) {
        if (!cancelled) {
          setAbonnementStatus(null);
          setPaymentHistory([]);
          setAbonnementError(error.message || 'Impossible de charger les informations d’abonnement.');
        }
      } finally {
        if (!cancelled) {
          setLoadingAbonnementStatus(false);
          setLoadingPaymentHistory(false);
        }
      }
    }

    void loadAbonnementStatus();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

  const formatUsage = (usage) => {
    if (!usage) return 'Indisponible';
    if (usage.isUnlimited) return `${usage.used} utilisés (illimité)`;
    return `${usage.used}/${usage.limit} utilisés, ${usage.remaining} restants`;
  };

  const formatDateTime = (value) => {
    if (!value) {
      return 'Non disponible';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Non disponible' : date.toLocaleString('fr-FR');
  };

  const formatPrice = (value, suffix = '€') => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return `0 ${suffix}`;
    }

    return `${number.toFixed(suffix === 'ETH' ? 8 : 2)} ${suffix}`;
  };

  const paymentStats = useMemo(() => {
    const confirmedPayments = paymentHistory.filter((payment) => payment.status === 'confirmed');

    return {
      total: confirmedPayments.length,
      confirmed: confirmedPayments.length,
    };
  }, [paymentHistory]);

  const confirmedPaymentHistory = useMemo(
    () => paymentHistory.filter((payment) => payment.status === 'confirmed'),
    [paymentHistory],
  );

  const visibleConfirmedPaymentHistory = useMemo(
    () => confirmedPaymentHistory.slice(0, visiblePaymentCount),
    [confirmedPaymentHistory, visiblePaymentCount],
  );

  useEffect(() => {
    if (!confirmedPaymentHistory.length) {
      setExpandedPaymentIds([]);
      setVisiblePaymentCount(DEFAULT_VISIBLE_PAYMENT_COUNT);
      return;
    }

    setVisiblePaymentCount((current) => Math.min(
      Math.max(current, DEFAULT_VISIBLE_PAYMENT_COUNT),
      confirmedPaymentHistory.length,
    ));

    setExpandedPaymentIds((current) => {
      const validIds = new Set(confirmedPaymentHistory.map((payment) => payment.id));
      const filtered = current.filter((id) => validIds.has(id));

      if (filtered.length > 0) {
        return filtered;
      }

      return [confirmedPaymentHistory[0].id];
    });
  }, [confirmedPaymentHistory]);

  const statusAbonnement = abonnementStatus?.abonnement || abonnement;
  const renewalStatus = statusAbonnement?.renewal || null;

  const reloadSubscriptionData = async () => {
    const [statusData, paymentsData] = await Promise.all([
      requestJson('/api/me/abonnement-status', { method: 'GET' }),
      requestJson('/api/me/abonnement/payments?limit=10', { method: 'GET' }),
    ]);

    setAbonnementStatus(statusData);
    setPaymentHistory(Array.isArray(paymentsData?.payments) ? paymentsData.payments : []);
  };

  const handleOpenDowngradeFlow = async () => {
    setIsLoadingDowngradePreview(true);
    setAbonnementError(null);

    try {
      const preview = await requestJson('/api/me/abonnement/downgrade-preview', { method: 'GET' });
      setDowngradePreview(preview);
      setDowngradeSelection(normalizeSelection(preview?.recommendedSelection));
      setShowDowngradeModal(true);
    } catch (error) {
      setAbonnementError(error.message || 'Impossible de préparer le retour au plan gratuit.');
    } finally {
      setIsLoadingDowngradePreview(false);
    }
  };

  useEffect(() => {
    const shouldOpenCleanupFlow = searchParams.get('cleanup') === '1'
      || Boolean(statusAbonnement?.cleanupRequired);

    if (!shouldOpenCleanupFlow || hasAutoOpenedCleanup || loadingAbonnementStatus || isLoadingDowngradePreview || showDowngradeModal) {
      return;
    }

    setHasAutoOpenedCleanup(true);
    void handleOpenDowngradeFlow();

    if (searchParams.get('cleanup') === '1') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('cleanup');
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    handleOpenDowngradeFlow,
    hasAutoOpenedCleanup,
    isLoadingDowngradePreview,
    loadingAbonnementStatus,
    searchParams,
    setSearchParams,
    showDowngradeModal,
    statusAbonnement?.cleanupRequired,
  ]);

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
    if (!downgradePreview || isSubmittingDowngrade) {
      return;
    }

    setIsSubmittingDowngrade(true);
    setAbonnementError(null);

    try {
      await downgradeToFree(downgradeSelection);
      setShowDowngradeModal(false);
      setDowngradePreview(null);
      await reloadSubscriptionData();
    } catch (error) {
      setAbonnementError(error.message || 'Impossible de revenir au plan gratuit.');
    } finally {
      setIsSubmittingDowngrade(false);
    }
  };

  const handleDisableAutoRenewal = async () => {
    setIsSubmittingRenewalToggle(true);
    setAbonnementError(null);

    try {
      await requestJson('/api/me/abonnement/renewal-settings', {
        method: 'PUT',
        body: JSON.stringify({ mode: 'manual' }),
      });
      await reloadSubscriptionData();
    } catch (error) {
      setAbonnementError(error.message || 'Impossible de désactiver le renouvellement automatique.');
    } finally {
      setIsSubmittingRenewalToggle(false);
    }
  };

  const handleTogglePaymentDetails = (paymentId) => {
    setExpandedPaymentIds((current) => (
      current.includes(paymentId)
        ? current.filter((id) => id !== paymentId)
        : [...current, paymentId]
    ));
  };

  const handleToggleAllPayments = () => {
    if (!confirmedPaymentHistory.length) {
      return;
    }

    setExpandedPaymentIds((current) => (
      current.length === confirmedPaymentHistory.length
        ? []
        : confirmedPaymentHistory.map((payment) => payment.id)
    ));
  };

  const handleToggleVisiblePayments = () => {
    setVisiblePaymentCount((current) => (
      current >= confirmedPaymentHistory.length
        ? DEFAULT_VISIBLE_PAYMENT_COUNT
        : confirmedPaymentHistory.length
    ));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setIsProfileSubmitting(true);
    setProfileMessage(null);

    try {
      const data = await updateProfile({
        nom: profileForm.nom.trim(),
        prenom: profileForm.prenom.trim(),
        email: profileForm.email.trim(),
      });

      setProfileMessage({
        type: 'success',
        text: data.message || 'Profil mis à jour.',
      });
    } catch (error) {
      setProfileMessage({
        type: 'error',
        text: error.message || 'Impossible de mettre à jour le profil.',
      });
    } finally {
      setIsProfileSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setIsPasswordSubmitting(true);
    setPasswordMessage(null);

    if (!isStrongPassword(passwordForm.nouveau_mot_de_passe)) {
      setIsPasswordSubmitting(false);
      setPasswordMessage({ type: 'error', text: PASSWORD_HINT });
      return;
    }

    if (passwordForm.nouveau_mot_de_passe !== passwordForm.confirmation_mot_de_passe) {
      setIsPasswordSubmitting(false);
      setPasswordMessage({ type: 'error', text: 'La confirmation du mot de passe ne correspond pas.' });
      return;
    }

    try {
      const data = await changePassword({
        mot_de_passe_actuel: passwordForm.mot_de_passe_actuel,
        nouveau_mot_de_passe: passwordForm.nouveau_mot_de_passe,
      });

      setPasswordMessage({
        type: 'success',
        text: data.message || 'Mot de passe mis à jour.',
      });
      setPasswordForm({
        mot_de_passe_actuel: '',
        nouveau_mot_de_passe: '',
        confirmation_mot_de_passe: '',
      });
    } catch (error) {
      setPasswordMessage({
        type: 'error',
        text: error.message || 'Impossible de mettre à jour le mot de passe.',
      });
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <DashboardTopbar subtitle="Paramètres du compte" activeAction="settings" />

      <main className="settings-page page-shell">
        <section className="settings-hero dashboard-panel">
          <div>
            <span className="pill">Compte</span>
            <h1>Paramètres</h1>
            <p className="lede">
              Modifiez vos informations personnelles et sécurisez votre compte depuis une seule page.
            </p>
          </div>
          <Link to="/dashboard" className="btn ghost small settings-back-link">
            Retour au tableau de bord
          </Link>
        </section>

        <section className="settings-grid page-grid-2">
          <article className="dashboard-panel settings-card settings-card-wide">
            <div className="dashboard-panel-header settings-card-header">
              <div>
                <h2>
                  <i className="fa-regular fa-gem" aria-hidden="true" />
                  Abonnement et quotas
                </h2>
                <p>Consultez votre plan actuel et les limites appliquées à votre compte.</p>
              </div>
            </div>

            {loadingAbonnementStatus ? (
              <p className="settings-subtle-text">Chargement des quotas...</p>
            ) : abonnementError ? (
              <p className="feedback error">{abonnementError}</p>
            ) : (
              <div className="settings-plan-section">
                <div className="settings-plan-summary">
                  <div>
                    <span className="pill">Plan actuel</span>
                    <h3>{statusAbonnement?.nom || 'Gratuit'}</h3>
                    <p className="settings-subtle-text">
                      {statusAbonnement?.isPremium
                        ? 'Aucune limite de comptes, dépenses ou revenus.'
                        : 'Des quotas s’appliquent à votre utilisation.'}
                    </p>
                    {statusAbonnement?.expiresAt && (
                      <p className="settings-subtle-text">
                        Premium actif jusqu’au {formatDateTime(statusAbonnement.expiresAt)}.
                      </p>
                    )}
                    {statusAbonnement?.cancelAtPeriodEnd && (
                      <p className="settings-subtle-text">
                        L’annulation de l’abonnement est déjà programmée.
                      </p>
                    )}
                    {statusAbonnement?.cleanupRequired && (
                      <p className="feedback error">
                        Votre période Premium est terminée. Un nettoyage est nécessaire pour revenir sous les quotas du plan gratuit.
                      </p>
                    )}
                  </div>
                  <div className="settings-plan-price">
                    {statusAbonnement?.prix === '0.00' || statusAbonnement?.prix === 0 || !statusAbonnement?.prix
                      ? '0 €'
                      : `${statusAbonnement.prix} €`}
                  </div>
                </div>

                {(statusAbonnement?.isPremium || statusAbonnement?.cleanupRequired) && (
                  <div className="settings-plan-actions">
                    <button
                      type="button"
                      className={`btn ${statusAbonnement?.cleanupRequired ? 'ghost' : 'danger'} small`}
                      onClick={handleOpenDowngradeFlow}
                      disabled={isLoadingDowngradePreview || isSubmittingDowngrade}
                    >
                      {statusAbonnement?.cleanupRequired
                        ? 'Mettre le compte en conformité'
                        : isLoadingDowngradePreview
                          ? 'Préparation...'
                          : 'Annuler mon abonnement'}
                    </button>
                  </div>
                )}

                {renewalStatus?.autoRenewalReady && (
                  <div className="settings-renewal-card info-card">
                    <div>
                      <strong>Renouvellement automatique actif</strong>
                      <p className="settings-subtle-text">
                        Le prochain prélèvement est prévu le {formatDateTime(renewalStatus.nextRenewalAt)}.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={handleDisableAutoRenewal}
                      disabled={isSubmittingRenewalToggle}
                    >
                      {isSubmittingRenewalToggle ? 'Désactivation...' : 'Désactiver le renouvellement automatique'}
                    </button>
                  </div>
                )}

                <div className="settings-quota-grid info-card-grid">
                  <article className="settings-quota-card info-card">
                    <strong>Comptes</strong>
                    <p>{formatUsage(abonnementStatus?.usage?.comptes)}</p>
                  </article>
                  <article className="settings-quota-card info-card">
                    <strong>Dépenses par compte</strong>
                    <p>
                      {statusAbonnement?.limits?.depensesParCompte === null
                        ? 'Illimité'
                        : `${statusAbonnement?.limits?.depensesParCompte ?? '-'} maximum`}
                    </p>
                  </article>
                  <article className="settings-quota-card info-card">
                    <strong>Revenus par compte</strong>
                    <p>
                      {statusAbonnement?.limits?.revenusParCompte === null
                        ? 'Illimité'
                        : `${statusAbonnement?.limits?.revenusParCompte ?? '-'} maximum`}
                    </p>
                  </article>
                </div>

                <div className="settings-account-quota-list">
                  <h3>Usage par compte</h3>
                  {abonnementStatus?.usage?.comptesDetails?.length ? (
                    abonnementStatus.usage.comptesDetails.map((compte) => (
                      <article key={compte.id} className="settings-account-quota-item info-card">
                        <div>
                          <strong>{compte.nom_court}</strong>
                        </div>
                        <p>Dépenses: {formatUsage(compte.depenses)}</p>
                        <p>Revenus: {formatUsage(compte.revenus)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="settings-subtle-text">Aucun compte créé pour le moment.</p>
                  )}
                </div>

                <div className="settings-payment-history">
                  <div className="settings-payment-history-head">
                    <div>
                      <h3>Historique des paiements</h3>
                    </div>
                    <div className="settings-payment-history-actions">
                      {confirmedPaymentHistory.length > DEFAULT_VISIBLE_PAYMENT_COUNT && (
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={handleToggleVisiblePayments}
                        >
                          {visiblePaymentCount >= confirmedPaymentHistory.length
                            ? 'Afficher moins de transactions'
                            : `Afficher ${confirmedPaymentHistory.length - visiblePaymentCount} transaction${confirmedPaymentHistory.length - visiblePaymentCount > 1 ? 's' : ''} de plus`}
                        </button>
                      )}
                      {visibleConfirmedPaymentHistory.length > 1 && (
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={handleToggleAllPayments}
                        >
                          {expandedPaymentIds.filter((id) => visibleConfirmedPaymentHistory.some((payment) => payment.id === id)).length === visibleConfirmedPaymentHistory.length
                            ? 'Réduire les détails'
                            : 'Déplier les détails'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="settings-payment-stats info-card-grid">
                    <article className="info-card">
                      <strong>Total</strong>
                      <p>{paymentStats.total} paiement{paymentStats.total > 1 ? 's' : ''}</p>
                    </article>
                    <article className="info-card">
                      <strong>Confirmés</strong>
                      <p>{paymentStats.confirmed}</p>
                    </article>
                  </div>

                  {loadingPaymentHistory ? (
                    <p className="settings-subtle-text">Chargement de l’historique des paiements...</p>
                  ) : confirmedPaymentHistory.length ? (
                    <div className="settings-payment-list">
                      {visibleConfirmedPaymentHistory.map((payment) => (
                        <article key={payment.id} className="settings-payment-item info-card">
                          <div className="settings-payment-item-head">
                            <div>
                              <strong>Paiement #{payment.id}</strong>
                              <p className="settings-subtle-text">
                                {formatDateTime(payment.confirmedAt || payment.createdAt)}
                              </p>
                            </div>
                            <div className="settings-payment-item-actions">
                              <span className={`settings-payment-status ${payment.status}`}>
                                {payment.status}
                              </span>
                              <button
                                type="button"
                                className="btn ghost small"
                                onClick={() => handleTogglePaymentDetails(payment.id)}
                              >
                                {expandedPaymentIds.includes(payment.id) ? 'Réduire' : 'Déplier'}
                              </button>
                            </div>
                          </div>

                          {expandedPaymentIds.includes(payment.id) && (
                            <>
                              <div className="settings-payment-item-grid">
                                <p><strong>Montant:</strong> {formatPrice(payment.montantEur, '€')}</p>
                                <p><strong>Crypto:</strong> {formatPrice(payment.montantCrypto, String(payment.cryptoCode || '').toUpperCase() || 'ETH')}</p>
                                <p><strong>Réseau:</strong> {payment.network}</p>
                                <p><strong>Date:</strong> {formatDateTime(payment.createdAt)}</p>
                              </div>

                              <div className="settings-payment-hash-block">
                                <span>Hash</span>
                                <code>{payment.transactionHash}</code>
                              </div>
                            </>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="settings-subtle-text">Aucun paiement confirmé enregistré pour le moment.</p>
                  )}
                </div>
              </div>
            )}
          </article>

          <article className="dashboard-panel settings-card">
            <div className="dashboard-panel-header settings-card-header">
              <div>
                <h2>
                  <i className="fa-regular fa-user" aria-hidden="true" />
                  Profil
                </h2>
                <p>Nom, prénom et adresse email utilisés sur votre compte.</p>
              </div>
            </div>

            <form className="auth-form settings-form" onSubmit={handleProfileSubmit}>
              <div className="settings-form-grid">
                <div className="field-row">
                  <label htmlFor="settings-nom">Nom</label>
                  <input
                    id="settings-nom"
                    type="text"
                    value={profileForm.nom}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, nom: event.target.value }))}
                    placeholder="Dupont"
                  />
                </div>
                <div className="field-row">
                  <label htmlFor="settings-prenom">Prénom</label>
                  <input
                    id="settings-prenom"
                    type="text"
                    value={profileForm.prenom}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, prenom: event.target.value }))}
                    placeholder="Marie"
                  />
                </div>
              </div>

              <div className="field-row">
                <label htmlFor="settings-email">Adresse email</label>
                <input
                  id="settings-email"
                  type="email"
                  required
                  value={profileForm.email}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="vous@exemple.com"
                />
              </div>

              <div className="settings-actions">
                <button type="submit" className="btn primary small" disabled={isProfileSubmitting}>
                  {isProfileSubmitting ? 'Enregistrement...' : 'Enregistrer le profil'}
                </button>
              </div>

              {profileMessage && <p className={`feedback ${profileMessage.type}`}>{profileMessage.text}</p>}
            </form>
          </article>

          <article className="dashboard-panel settings-card">
            <div className="dashboard-panel-header settings-card-header">
              <div>
                <h2>
                  <i className="fa-solid fa-lock" aria-hidden="true" />
                  Mot de passe
                </h2>
                <p>Définissez un nouveau mot de passe fort pour protéger votre compte.</p>
              </div>
            </div>

            <form className="auth-form settings-form" onSubmit={handlePasswordSubmit}>
              <div className="field-row">
                <label htmlFor="settings-current-password">Mot de passe actuel</label>
                <input
                  id="settings-current-password"
                  type="password"
                  required
                  value={passwordForm.mot_de_passe_actuel}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, mot_de_passe_actuel: event.target.value }))
                  }
                  placeholder="••••••••••••••"
                />
              </div>

              <div className="field-row">
                <label htmlFor="settings-new-password">Nouveau mot de passe</label>
                <input
                  id="settings-new-password"
                  type="password"
                  required
                  value={passwordForm.nouveau_mot_de_passe}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, nouveau_mot_de_passe: event.target.value }))
                  }
                  placeholder="••••••••••••••"
                />
                <p className="field-hint">{PASSWORD_HINT}</p>
              </div>

              <div className="field-row">
                <label htmlFor="settings-confirm-password">Confirmer le nouveau mot de passe</label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  required
                  value={passwordForm.confirmation_mot_de_passe}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, confirmation_mot_de_passe: event.target.value }))
                  }
                  placeholder="••••••••••••••"
                />
              </div>

              <div className="settings-actions">
                <button type="submit" className="btn primary small" disabled={isPasswordSubmitting}>
                  {isPasswordSubmitting ? 'Mise à jour...' : 'Changer le mot de passe'}
                </button>
              </div>

              {passwordMessage && <p className={`feedback ${passwordMessage.type}`}>{passwordMessage.text}</p>}
            </form>
          </article>
        </section>
      </main>

      <SubscriptionDowngradeModal
        downgradePreview={showDowngradeModal ? downgradePreview : null}
        downgradeSelection={downgradeSelection}
        projectedDowngrade={projectedDowngrade}
        canConfirmDowngrade={canConfirmDowngrade}
        downgradeSelectionStats={downgradeSelectionStats}
        recommendedSelectionStats={recommendedSelectionStats}
        isSubmittingPlanChange={isSubmittingDowngrade}
        onToggleSelection={handleDowngradeSelectionToggle}
        onClose={() => setShowDowngradeModal(false)}
        onConfirm={handleConfirmDowngrade}
      />
    </div>
  );
}
