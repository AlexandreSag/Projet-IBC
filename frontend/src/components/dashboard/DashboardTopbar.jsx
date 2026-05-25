import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function DashboardTopbar({
  subtitle,
  activeAction = 'dashboard',
}) {
  const navigate = useNavigate();
  const { user, abonnement, isPremium, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const userLabel = user?.prenom || user?.nom || user?.email || 'Utilisateur';
  const userInitials = userLabel
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || '')
    .join('');

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleSettingsNavigation = () => {
    setIsMobileMenuOpen(false);
    navigate('/settings');
  };

  const handleSubscriptionNavigation = () => {
    setIsMobileMenuOpen(false);
    navigate('/subscription');
  };

  const abonnementLabel = abonnement?.nom || 'Gratuit';

  return (
    <header className="dashboard-topbar">
      <div className="dashboard-brand">
        <div className="brand-icon">
          <i className="fa-solid fa-wallet" aria-hidden="true" />
        </div>
        <div className="dashboard-brand-copy">
          <span className="brand-name">Budgie</span>
          <p>{subtitle}</p>
        </div>
      </div>
      <button
        type="button"
        className={`dashboard-burger-btn${isMobileMenuOpen ? ' active' : ''}`}
        aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen((open) => !open)}
      >
        <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`} aria-hidden="true" />
      </button>
      <div className="dashboard-top-actions">
        {isPremium ? (
          <div className="dashboard-plan-badge" title={`Plan actuel: ${abonnementLabel}`}>
            Plan {abonnementLabel}
          </div>
        ) : (
          <button
            type="button"
            className="btn primary dashboard-premium-btn"
            onClick={handleSubscriptionNavigation}
          >
            Passer à Premium
          </button>
        )}
        <button type="button" className="dashboard-icon-btn" aria-label="Notifications">
          <i className="fa-regular fa-bell" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`dashboard-icon-btn${activeAction === 'settings' ? ' active' : ''}`}
          aria-label="Paramètres"
          title="Paramètres"
          onClick={handleSettingsNavigation}
        >
          <i className="fa-solid fa-gear" aria-hidden="true" />
        </button>
        <div className="dashboard-user-actions">
          <div
            className="dashboard-avatar-btn"
            aria-label={userLabel ? `Profil de ${userLabel}` : 'Profil utilisateur'}
            title={userLabel}
          >
            {userInitials || 'JD'}
          </div>
          <button
            type="button"
            className="dashboard-logout-btn"
            onClick={handleLogout}
            aria-label="Se déconnecter"
            title="Se déconnecter"
          >
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className={`dashboard-mobile-menu${isMobileMenuOpen ? ' open' : ''}`}>
        <div className="dashboard-mobile-menu-profile">
          <div
            className="dashboard-avatar-btn"
            aria-label={userLabel ? `Profil de ${userLabel}` : 'Profil utilisateur'}
            title={userLabel}
          >
            {userInitials || 'JD'}
          </div>
          <div className="dashboard-mobile-menu-profile-copy">
            <strong>{userLabel}</strong>
            <span>{isPremium ? `Plan ${abonnementLabel}` : 'Plan Gratuit'}</span>
          </div>
        </div>

        <div className="dashboard-mobile-menu-section">
          {isPremium ? (
            <div className="dashboard-plan-badge" title={`Plan actuel: ${abonnementLabel}`}>
              Plan {abonnementLabel}
            </div>
          ) : (
            <button
              type="button"
              className="btn primary dashboard-premium-btn"
              onClick={handleSubscriptionNavigation}
            >
              Passer à Premium
            </button>
          )}
        </div>

        <div className="dashboard-mobile-menu-actions">
          <button
            type="button"
            className={`dashboard-mobile-action-btn${activeAction === 'settings' ? ' active' : ''}`}
            onClick={handleSettingsNavigation}
          >
            <i className="fa-solid fa-gear" aria-hidden="true" />
            Paramètres
          </button>
          <button type="button" className="dashboard-mobile-action-btn" onClick={handleLogout}>
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  );
}
