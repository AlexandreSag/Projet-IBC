import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import AuthForm from './components/AuthForm.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';

const features = [
  {
    title: 'Confidentialité totale',
    desc: 'Vos données restent sur votre appareil. Aucune connexion bancaire, aucun partage de données personnelles.',
    icon: 'fa-solid fa-shield-halved',
  },
  {
    title: 'Simplicité d’utilisation',
    desc: 'Interface moderne pour suivre dépenses, budgets et objectifs en quelques clics.',
    icon: 'fa-solid fa-bolt',
  },
  {
    title: 'Paiements blockchain',
    desc: 'Intégration crypto pour une gestion financière décentralisée et moderne.',
    icon: 'fa-solid fa-coins',
  },
];

function LandingPage() {
  return (
    <>
      <main className="landing">
        <section className="hero-section" id="apropos">
          <div className="hero-copy">
            <span className="pill">Gérez vos finances en toute simplicité</span>
            <h1>
              Ton partenaire <span className="accent">financier personnel</span>
            </h1>
            <p className="lede">
              Prenez le contrôle de vos finances sans connexion bancaire. Simple, privé et moderne.
            </p>
            <div className="cta-row">
              <Link to="/register" className="btn primary">
                Créer un compte
              </Link>
              <Link to="/login" className="btn ghost">
                Se connecter
              </Link>
            </div>
            <div className="stats-row">
              <div>
                <strong>100%</strong>
                <span>Gratuit</span>
              </div>
              <div>
                <strong>Privé</strong>
                <span>Vos données</span>
              </div>
              <div>
                <strong>Simple</strong>
                <span>À utiliser</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="device-frame">
              <div className="device-glow" />
              <div className="device-screen">
                <img src="/src/img/imageindex.jpg"/>
              </div>
            </div>
          </div>
        </section>

        <section className="features-section" id="features">
          <div className="section-header">
            <span className="pill">Fonctionnalités clés</span>
            <h2>Tout ce dont vous avez besoin</h2>
            <p className="lede center">
              Une expérience financière pensée pour la confidentialité, la simplicité et la tranquillité d’esprit.
            </p>
          </div>
          <div className="features-grid">
            {features.map((feature) => (
              <article key={feature.title} className="feature-card">
                <div className="feature-icon">
                  <i className={feature.icon} aria-hidden="true" />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function AuthPage({ mode }) {
  const isRegister = mode === 'register';

  return (
    <div className="auth-page">
      <main className="auth-main">
        <div className="back-link">
          <Link to="/">Retour à l&apos;accueil</Link>
        </div>
        <div className="brand-line">
          <div className="brand-icon">
            <i className="fa-solid fa-wallet" aria-hidden="true" />
          </div>
          <span className="brand-name">Budgie</span>
        </div>
        <div className="card auth-card">
          <div className="card-header">
            <h2>{isRegister ? 'Créer un compte' : 'Connexion'}</h2>
            <p className="lede small">
              {isRegister ? 'Créez votre compte gratuit Budgie.' : 'Connectez-vous à votre compte Budgie.'}
            </p>
          </div>
          <AuthForm
            mode={mode}
            footer={
              <p className="auth-switch">
                {isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
                <Link to={isRegister ? '/login' : '/register'}>
                  {isRegister ? 'Se connecter' : 'Créer un compte'}
                </Link>
              </p>
            }
          />
        </div>
        <p className="legal">
          En vous connectant, vous acceptez nos conditions d’utilisation et notre politique de confidentialité.
        </p>
      </main>
    </div>
  );
}

function AppShell() {
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';

  return (
    <>
      {!isAuthRoute && <Header />}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}