import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { requestJson, useAuth } from '../context/AuthContext.jsx';

export default function ShareInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isAuthenticated, isLoading, refreshSession } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [loadingInvitation, setLoadingInvitation] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInvitation() {
      if (!token) {
        setMessage({ type: 'error', text: 'Lien d’invitation invalide.' });
        setLoadingInvitation(false);
        return;
      }

      try {
        const data = await requestJson(`/api/partages/invitations/${encodeURIComponent(token)}`, { method: 'GET' });
        if (!cancelled) {
          setInvitation(data?.invitation || null);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage({ type: 'error', text: error.message || 'Impossible de charger l’invitation.' });
        }
      } finally {
        if (!cancelled) {
          setLoadingInvitation(false);
        }
      }
    }

    void loadInvitation();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const redirectState = useMemo(
    () => ({
      from: `/sharing/invitation?token=${encodeURIComponent(token || '')}`,
      fromShareInvitation: true,
    }),
    [token],
  );

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setMessage(null);

    try {
      const data = await requestJson(`/api/partages/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
      });
      await refreshSession();
      setMessage({ type: 'success', text: data.message || 'Le compte a été ajouté à votre espace.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Impossible d’accepter cette invitation.' });
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="auth-page">
      <main className="auth-main">
        <div className="back-link">
          <Link to="/">Retour à l&apos;accueil</Link>
        </div>
        <div className="brand-line">
          <div className="brand-icon">
            <i className="fa-solid fa-share-nodes" aria-hidden="true" />
          </div>
          <span className="brand-name">Budgie</span>
        </div>
        <div className="card auth-card">
          <div className="card-header">
            <h2>Invitation de partage</h2>
            {loadingInvitation ? (
              <p className="lede small">Chargement de l&apos;invitation...</p>
            ) : invitation ? (
              <p className="lede small">
                {invitation.ownerName} vous invite à consulter le compte <strong>{invitation.compteNom}</strong> en lecture seule.
              </p>
            ) : (
              <p className="lede small">Invitation indisponible.</p>
            )}
          </div>

          {invitation && (
            <div className="card-content">
              <p className="lede small">Invitation envoyée à {invitation.inviteeEmailMasked}.</p>
              <p className="lede small">Valable jusqu&apos;au {new Date(invitation.expiresAt).toLocaleString('fr-FR')}.</p>

              {!isLoading && !isAuthenticated ? (
                <>
                  <p className="feedback info">
                    Pour accepter ce partage, connectez-vous ou créez un compte avec l’adresse email qui a reçu l’invitation.
                  </p>
                  <div className="cta-row">
                    <Link to="/register" state={redirectState} className="btn primary">
                      Créer un compte pour accepter
                    </Link>
                    <Link to="/login" state={redirectState} className="btn ghost">
                      J’ai déjà un compte
                    </Link>
                  </div>
                </>
              ) : (
                <button type="button" className="btn primary" onClick={handleAccept} disabled={accepting || !invitation}>
                  {accepting ? 'Ajout du compte...' : 'Accepter le partage'}
                </button>
              )}
            </div>
          )}

          {message && <p className={`feedback ${message.type}`}>{message.text}</p>}
        </div>
      </main>
    </div>
  );
}
