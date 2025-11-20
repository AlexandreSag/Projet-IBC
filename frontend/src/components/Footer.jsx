export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-left">
        <div className="brand-icon">
          <i className="fa-solid fa-wallet" aria-hidden="true" />
        </div>
        <span className="brand-name">Budgie</span>
      </div>
      <div className="footer-links">
        <a href="#apropos">À propos</a>
        <a href="#features">Fonctionnalités</a>
        <a href="#privacy">Confidentialité</a>
        <a href="#contact">Contact</a>
      </div>
      <div className="footer-right">© 2025 Budgie. Tous droits réservés.</div>
    </footer>
  );
}
