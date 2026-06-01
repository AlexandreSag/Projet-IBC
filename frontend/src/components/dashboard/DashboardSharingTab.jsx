import { useEffect, useMemo, useState } from 'react';
import { requestJson } from '../../context/AuthContext.jsx';
import './DashboardSharingTab.css';

function buildInitials(label) {
  const parts = String(label || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'BU';
}

export default function DashboardSharingTab({ comptes = [] }) {
  const [sharedByMe, setSharedByMe] = useState({ shares: [], invitations: [] });
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [selectedShareId, setSelectedShareId] = useState(null);
  const [selectedShareDetail, setSelectedShareDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    compteId: '',
    email: '',
  });
  const [isInviting, setIsInviting] = useState(false);

  const availableComptes = useMemo(
    () => comptes.map((compte) => ({ id: compte.id, nom_court: compte.nom_court })),
    [comptes],
  );

  const loadSharingData = async () => {
    const data = await requestJson('/api/partages', { method: 'GET' });
    setSharedByMe(data?.sharedByMe || { shares: [], invitations: [] });
    setSharedWithMe(Array.isArray(data?.sharedWithMe) ? data.sharedWithMe : []);
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await requestJson('/api/partages', { method: 'GET' });
        if (!cancelled) {
          setSharedByMe(data?.sharedByMe || { shares: [], invitations: [] });
          const incoming = Array.isArray(data?.sharedWithMe) ? data.sharedWithMe : [];
          setSharedWithMe(incoming);
          if (incoming[0]) {
            setSelectedShareId((current) => current || incoming[0].id);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setMessage({ type: 'error', text: error.message || 'Impossible de charger les partages.' });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      if (!selectedShareId) {
        setSelectedShareDetail(null);
        return;
      }

      setDetailLoading(true);
      try {
        const data = await requestJson(`/api/partages/received/${selectedShareId}`, { method: 'GET' });
        if (!cancelled) {
          setSelectedShareDetail(data);
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedShareDetail(null);
          setMessage({ type: 'error', text: error.message || 'Impossible de charger ce compte partagé.' });
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedShareId]);

  const handleInvite = async (event) => {
    event.preventDefault();
    setIsInviting(true);
    setMessage(null);

    try {
      const payload = {
        compteId: Number(inviteForm.compteId),
        email: inviteForm.email.trim(),
      };
      const data = await requestJson('/api/partages/invitations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await loadSharingData();
      setInviteForm({ compteId: '', email: '' });
      setShowInviteForm(false);
      setMessage({ type: 'success', text: data.message || 'Invitation envoyée.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Impossible d’envoyer l’invitation.' });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevokeShare = async (shareId) => {
    if (!window.confirm('Révoquer cet accès ?')) return;
    try {
      await requestJson(`/api/partages/${shareId}`, { method: 'DELETE' });
      await loadSharingData();
      setMessage({ type: 'success', text: 'Accès révoqué.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Impossible de révoquer cet accès.' });
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    if (!window.confirm('Annuler cette invitation ?')) return;
    try {
      await requestJson(`/api/partages/invitations/${invitationId}`, { method: 'DELETE' });
      await loadSharingData();
      setMessage({ type: 'success', text: 'Invitation annulée.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Impossible d’annuler cette invitation.' });
    }
  };

  return (
    <div className="sharing-tab-container">
      <section className="dashboard-panel sharing-main-panel">
        <div className="dashboard-panel-header">
          <div className="sharing-header-info">
            <h2>
              <i className="fa-solid fa-user-group" aria-hidden="true" /> Partage de compte
            </h2>
            <p>Invitez une personne par email pour partager un compte en lecture seule.</p>
          </div>
          <button
            type="button"
            className="dashboard-add-btn sharing-invite-btn"
            onClick={() => setShowInviteForm((value) => !value)}
          >
            <i className="fa-solid fa-plus" aria-hidden="true" /> Inviter
          </button>
        </div>

        {message && <p className={`feedback ${message.type}`}>{message.text}</p>}

        {showInviteForm && (
          <form className="sharing-invite-form" onSubmit={handleInvite}>
            <label>
              <span>Compte à partager</span>
              <select
                value={inviteForm.compteId}
                onChange={(event) => setInviteForm((current) => ({ ...current, compteId: event.target.value }))}
                required
              >
                <option value="">Choisir un compte</option>
                {availableComptes.map((compte) => (
                  <option key={compte.id} value={compte.id}>{compte.nom_court}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Adresse email</span>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="partenaire@exemple.com"
                required
              />
            </label>
            <div className="sharing-invite-actions">
              <button type="button" className="btn ghost small" onClick={() => setShowInviteForm(false)}>
                Fermer
              </button>
              <button type="submit" className="btn primary small" disabled={isInviting}>
                {isInviting ? 'Envoi...' : 'Envoyer l’invitation'}
              </button>
            </div>
          </form>
        )}

        <div className="sharing-sections-grid">
          <div className="sharing-section-block">
            <h3 className="sharing-section-title">Comptes que je partage</h3>
            <div className="sharing-user-list">
              {loading ? (
                <p className="sharing-empty-state">Chargement...</p>
              ) : sharedByMe.shares.length ? (
                sharedByMe.shares.map((share) => (
                  <div key={share.id} className="sharing-user-item">
                    <div className="sharing-user-left">
                      <div className="sharing-user-avatar" style={{ backgroundColor: '#0099c4' }}>
                        {buildInitials(share.inviteeNom || share.inviteeEmail)}
                      </div>
                      <div className="sharing-user-info">
                        <strong>{share.inviteeNom || share.inviteeEmail}</strong>
                        <span>{share.compteNom} • {share.inviteeEmail}</span>
                      </div>
                    </div>
                    <div className="sharing-user-right">
                      <span className="sharing-badge read-only">Lecture seule</span>
                      <button type="button" className="sharing-manage-btn" onClick={() => handleRevokeShare(share.id)}>
                        Révoquer
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="sharing-empty-state">Aucun compte partagé pour le moment.</p>
              )}
            </div>
          </div>

          <div className="sharing-section-block">
            <h3 className="sharing-section-title">Invitations en attente</h3>
            <div className="sharing-user-list">
              {loading ? (
                <p className="sharing-empty-state">Chargement...</p>
              ) : sharedByMe.invitations.filter((invitation) => invitation.status === 'pending').length ? (
                sharedByMe.invitations
                  .filter((invitation) => invitation.status === 'pending')
                  .map((invitation) => (
                    <div key={invitation.id} className="sharing-user-item">
                      <div className="sharing-user-left">
                        <div className="sharing-user-avatar" style={{ backgroundColor: '#0ea5b7' }}>
                          {buildInitials(invitation.inviteeEmail)}
                        </div>
                        <div className="sharing-user-info">
                          <strong>{invitation.inviteeEmail}</strong>
                          <span>{invitation.compteNom} • expire le {new Date(invitation.expiresAt).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                      <div className="sharing-user-right">
                        <span className="sharing-badge pending">En attente</span>
                        <button type="button" className="sharing-manage-btn" onClick={() => handleCancelInvitation(invitation.id)}>
                          Annuler
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="sharing-empty-state">Aucune invitation en attente.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="sharing-bottom-grid">
        <section className="dashboard-panel access-types-panel">
          <h3 className="sharing-section-title">Comptes partagés avec moi</h3>
          <div className="sharing-user-list">
            {loading ? (
              <p className="sharing-empty-state">Chargement...</p>
            ) : sharedWithMe.length ? (
              sharedWithMe.map((share) => (
                <button
                  key={share.id}
                  type="button"
                  className={`sharing-received-item ${selectedShareId === share.id ? 'active' : ''}`}
                  onClick={() => setSelectedShareId(share.id)}
                >
                  <div className="sharing-user-left">
                    <div className="sharing-user-avatar" style={{ backgroundColor: '#2563eb' }}>
                      {buildInitials(share.ownerName)}
                    </div>
                    <div className="sharing-user-info">
                      <strong>{share.compteNom}</strong>
                      <span>Partagé par {share.ownerName}</span>
                    </div>
                  </div>
                  <span className="sharing-badge read-only">Lecture seule</span>
                </button>
              ))
            ) : (
              <p className="sharing-empty-state">Aucun compte reçu pour le moment.</p>
            )}
          </div>
        </section>

        <section className="dashboard-panel security-panel">
          <div className="security-title-row">
            <i className="fa-solid fa-shield-halved security-icon" aria-hidden="true" />
            <h3 className="sharing-section-title">Lecture seule</h3>
          </div>
          {detailLoading ? (
            <p className="sharing-empty-state">Chargement du compte partagé...</p>
          ) : selectedShareDetail ? (
            <div className="sharing-detail-content">
              <div className="sharing-detail-summary">
                <strong>{selectedShareDetail.compte.nom_court}</strong>
                <p>Partagé par {selectedShareDetail.owner.displayName}</p>
                <p>Solde actuel: {Number(selectedShareDetail.compte.solde || 0).toFixed(2)} €</p>
              </div>

              <div className="sharing-detail-grid">
                <div>
                  <h4>Dépenses</h4>
                  {selectedShareDetail.depenses.length ? (
                    <ul className="sharing-detail-list">
                      {selectedShareDetail.depenses.map((depense) => (
                        <li key={depense.id}>
                          <strong>{depense.nom_court}</strong>
                          <span>{Number(depense.montant || 0).toFixed(2)} €</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="sharing-empty-state">Aucune dépense.</p>
                  )}
                </div>

                <div>
                  <h4>Revenus</h4>
                  {selectedShareDetail.revenus.length ? (
                    <ul className="sharing-detail-list">
                      {selectedShareDetail.revenus.map((revenu) => (
                        <li key={revenu.id}>
                          <strong>{revenu.nom_court}</strong>
                          <span>{Number(revenu.montant || 0).toFixed(2)} €</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="sharing-empty-state">Aucun revenu.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="security-text-content">
              <p>Sélectionnez un compte partagé pour voir ses données.</p>
              <p>Les comptes reçus sont toujours accessibles en lecture seule.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
