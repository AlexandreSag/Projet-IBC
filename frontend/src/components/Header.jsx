import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-brand">
        <div className="brand-icon">
          <i className="fa-solid fa-wallet" aria-hidden="true" />
        </div>
        <span className="brand-name">Budgie</span>
      </div>
      <div className="nav-actions">
        <Link to="/login" className="btn ghost small">
          Se connecter
        </Link>
        <Link to="/register" className="btn primary small">
          Créer un compte
        </Link>
      </div>
    </header>
  );
}
