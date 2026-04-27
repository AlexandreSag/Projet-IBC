import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardTopbar from './dashboard/DashboardTopbar.jsx';
import './settings/SettingsPage.css';

const PASSWORD_HINT =
  '12 caractères minimum avec majuscule, minuscule, chiffre et caractère spécial (! @ # ? % & *).';

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
  const { user, abonnement, updateProfile, changePassword } = useAuth();
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
  const [abonnementError, setAbonnementError] = useState(null);
  const [loadingAbonnementStatus, setLoadingAbonnementStatus] = useState(true);
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

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
      setAbonnementError(null);

      try {
        const response = await fetch('/api/me/abonnement-status', {
          method: 'GET',
          credentials: 'include',
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || 'Impossible de charger les informations d’abonnement.');
        }

        if (!cancelled) {
          setAbonnementStatus(data);
        }
      } catch (error) {
        if (!cancelled) {
          setAbonnementStatus(null);
          setAbonnementError(error.message || 'Impossible de charger les informations d’abonnement.');
        }
      } finally {
        if (!cancelled) {
          setLoadingAbonnementStatus(false);
        }
      }
    }

    void loadAbonnementStatus();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const formatUsage = (usage) => {
    if (!usage) return 'Indisponible';
    if (usage.isUnlimited) return `${usage.used} utilisés (illimité)`;
    return `${usage.used}/${usage.limit} utilisés, ${usage.remaining} restants`;
  };

  const statusAbonnement = abonnementStatus?.abonnement || abonnement;

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

      <main className="settings-page">
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

        <section className="settings-grid">
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
                  </div>
                  <div className="settings-plan-price">
                    {statusAbonnement?.prix === '0.00' || statusAbonnement?.prix === 0 || !statusAbonnement?.prix
                      ? '0 €'
                      : `${statusAbonnement.prix} €`}
                  </div>
                </div>

                <div className="settings-quota-grid">
                  <article className="settings-quota-card">
                    <strong>Comptes</strong>
                    <p>{formatUsage(abonnementStatus?.usage?.comptes)}</p>
                  </article>
                  <article className="settings-quota-card">
                    <strong>Dépenses par compte</strong>
                    <p>
                      {statusAbonnement?.limits?.depensesParCompte === null
                        ? 'Illimité'
                        : `${statusAbonnement?.limits?.depensesParCompte ?? '-'} maximum`}
                    </p>
                  </article>
                  <article className="settings-quota-card">
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
                      <article key={compte.id} className="settings-account-quota-item">
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
    </div>
  );
}
