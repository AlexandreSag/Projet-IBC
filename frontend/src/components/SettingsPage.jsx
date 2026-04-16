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
  const { user, updateProfile, changePassword } = useAuth();
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
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  useEffect(() => {
    setProfileForm({
      nom: user?.nom || '',
      prenom: user?.prenom || '',
      email: user?.email || '',
    });
  }, [user]);

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
