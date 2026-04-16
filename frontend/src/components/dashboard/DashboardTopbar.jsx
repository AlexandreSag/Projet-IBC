import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function DashboardTopbar({ subtitle, activeAction = 'dashboard' }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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
      <div className="dashboard-top-actions">
        <button type="button" className="btn primary dashboard-premium-btn">
          Passer à Premium
        </button>
        <button type="button" className="dashboard-icon-btn" aria-label="Notifications">
          <i className="fa-regular fa-bell" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`dashboard-icon-btn${activeAction === 'settings' ? ' active' : ''}`}
          aria-label="Paramètres"
          title="Paramètres"
          onClick={() => navigate('/settings')}
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
    </header>
  );
}
