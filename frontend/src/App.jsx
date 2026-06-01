import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { useEffect, useState } from 'react';
import AuthForm from './components/AuthForm.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import DashboardPage from './components/DashboardPage.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import SubscriptionPage from './components/SubscriptionPage.jsx';
import ShareInvitationPage from './components/ShareInvitationPage.jsx';
import { AuthProvider, requestJson, useAuth } from './context/AuthContext.jsx';

const verificationRequests = new Map();

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
                <img src="/src/img/imageindex.jpg" alt="Aperçu de l'application Budgie" />
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
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const comesFromShareInvitation = Boolean(location.state?.fromShareInvitation);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={location.state?.from || '/dashboard'} replace />;
  }

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
              {comesFromShareInvitation
                ? 'Utilisez l’adresse email qui a reçu l’invitation pour accéder au compte partagé.'
                : isRegister
                  ? 'Créez votre compte gratuit Budgie.'
                  : 'Connectez-vous à votre compte Budgie.'}
            </p>
          </div>
          {comesFromShareInvitation && (
            <p className="feedback info auth-context-message">
              Après {isRegister ? 'création et vérification du compte' : 'connexion'}, vous reviendrez automatiquement sur l’invitation.
            </p>
          )}
          <AuthForm
            mode={mode}
            footer={
              <p className="auth-switch">
                {isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
                <Link to={isRegister ? '/login' : '/register'} state={location.state || null}>
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

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Vérification de votre adresse email...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Le lien de vérification est invalide.');
      return;
    }

    let cancelled = false;

    async function verifyEmail() {
      try {
        let request = verificationRequests.get(token);
        if (!request) {
          request = requestJson(`/api/verify-email?token=${encodeURIComponent(token)}`, {
            method: 'GET',
          });
          verificationRequests.set(token, request);
        }

        const data = await request;

        if (!cancelled) {
          setStatus('success');
          setMessage(data.message || 'Adresse email vérifiée.');
        }
      } catch (error) {
        verificationRequests.delete(token);
        if (!cancelled) {
          setStatus('error');
          setMessage(error.message || 'Impossible de vérifier votre adresse email.');
        }
      }
    }

    void verifyEmail();

    return () => {
      cancelled = true;
    };
  }, [token]);

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
            <h2>Vérification de l&apos;email</h2>
            {status === 'loading' ? (
              <p className="lede small">{message}</p>
            ) : (
              <p className={`feedback ${status === 'error' ? 'error' : 'success'}`}>{message}</p>
            )}
          </div>
          <div className="auth-footer">
            <p className="auth-switch">
              <Link to="/login">Aller à la connexion</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-page">
        <p className="lede">Vérification de la session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  const cleanupRequired = Boolean(user?.abonnement?.cleanupRequired);
  const isSettingsRoute = location.pathname.startsWith('/settings');

  if (cleanupRequired && !isSettingsRoute) {
    return <Navigate to="/settings?cleanup=1" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function AppShell() {
  const location = useLocation();
  const isAuthRoute =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/verify-email';
  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  const isSettingsRoute = location.pathname.startsWith('/settings');
  const isSubscriptionRoute = location.pathname.startsWith('/subscription');

  return (
    <>
      {!isAuthRoute && !isDashboardRoute && !isSettingsRoute && !isSubscriptionRoute && <Header />}
      <Routes>
        <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/sharing/invitation" element={<ShareInvitationPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription"
          element={
            <ProtectedRoute>
              <SubscriptionPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}
