import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const userLabel = user?.prenom || user?.nom || user?.email;

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-brand">
        <div className="brand-icon">
          <i className="fa-solid fa-wallet" aria-hidden="true" />
        </div>
        <span className="brand-name">Budgie</span>
      </div>
      <div className="nav-actions">
        {!isLoading && !isAuthenticated && (
          <>
            <Link to="/login" className="btn ghost small">
              Se connecter
            </Link>
            <Link to="/register" className="btn primary small">
              Créer un compte
            </Link>
          </>
        )}
        {!isLoading && isAuthenticated && (
          <>
            <Link to="/dashboard" className="btn ghost small">
              Tableau de bord
            </Link>
            <button type="button" className="btn primary small" onClick={handleLogout}>
              Déconnexion {userLabel ? `(${userLabel})` : ''}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
