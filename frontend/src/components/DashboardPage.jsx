import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const userLabel = user?.prenom || user?.nom || user?.email || 'Utilisateur';
  const userInitials = userLabel
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || '')
    .join('');

  const [comptes, setComptes] = useState([]);
  const [loadingComptes, setLoadingComptes] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAccount, setNewAccount] = useState({
    nom_court: '',
    description: '',
    date_creation: new Date().toISOString().split('T')[0],
    solde_initial: 0,
    taux_remuneration: 0,
    taux_imposition: 0,
  });
  const [customTauxRemu, setCustomTauxRemu] = useState(false);
  const [customTauxImpo, setCustomTauxImpo] = useState(false);
  const tauxRemuInputRef = useRef(null);
  const tauxImpoInputRef = useRef(null);

  const presetsRemuneration = [
    { label: 'Livret A', value: 1.7 },
    { label: 'LDDS', value: 1.7 },
    { label: 'LEP', value: 3.5 },
    { label: 'PEL', value: 1.75 },
  ];

  const presetsImposition = [
    { label: 'PFU', value: 30 },
    { label: 'TMI 0%', value: 0 },
    { label: 'TMI 11%', value: 11 },
    { label: 'TMI 30%', value: 30 },
  ];

  const handleAddAccount = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/comptes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount),
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setComptes([{ ...data.compte, solde: parseFloat(data.compte.solde_initial || 0) }, ...comptes]);
        setShowAddModal(false);
        setNewAccount({
          nom_court: '',
          description: '',
          date_creation: new Date().toISOString().split('T')[0],
          solde_initial: 0,
          taux_remuneration: 0,
          taux_imposition: 0,
        });
        setCustomTauxRemu(false);
        setCustomTauxImpo(false);
      } else {
        const err = await response.json();
        alert(err.error || 'Erreur lors de la création du compte');
      }
    } catch {
      alert('Erreur réseau');
    }
  };

  useEffect(() => {
    async function fetchComptes() {
      try {
        const response = await fetch('/api/comptes', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setComptes(data.comptes || []);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des comptes:', error);
      } finally {
        setLoadingComptes(false);
      }
    }
    fetchComptes();
  }, []);

  const totalSolde = comptes.reduce((acc, compte) => acc + (compte.solde || 0), 0);
  const formattedTotalSolde = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalSolde);


  const summaryCards = [
    {
      title: 'Solde total',
      amount: formattedTotalSolde,
      detail: 'Actualisé aujourd\'hui',
      tone: 'default',
      icon: 'fa-solid fa-dollar-sign',
    },
    {
      title: 'Revenus (Oct)',
      amount: '3 200,00 €',
      detail: 'Salaire + bonus',
      tone: 'positive',
      icon: 'fa-solid fa-arrow-up',
    },
    {
      title: 'Dépenses (Oct)',
      amount: '1 900,00 €',
      detail: '↘ -8.3% vs Sept',
      tone: 'negative',
      icon: 'fa-solid fa-arrow-down',
    },
    {
      title: 'Économies',
      amount: '1 300,00 €',
      detail: '40.6% du revenu',
      tone: 'info',
      icon: 'fa-solid fa-star',
    },
  ];

  const monthlyData = [
    { month: 'Avr', revenus: 3200, depenses: 2100 },
    { month: 'Mai', revenus: 3200, depenses: 2300 },
    { month: 'Juin', revenus: 3400, depenses: 2200 },
    { month: 'Juil', revenus: 3200, depenses: 2400 },
    { month: 'Août', revenus: 3500, depenses: 2800 },
    { month: 'Sept', revenus: 3200, depenses: 2200 },
    { month: 'Oct', revenus: 3200, depenses: 1900 },
  ];

  const chartMax = 3600;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="dashboard-layout">
      <header className="dashboard-topbar">
        <div className="dashboard-brand">
          <div className="brand-icon">
            <i className="fa-solid fa-wallet" aria-hidden="true" />
          </div>
          <div className="dashboard-brand-copy">
            <span className="brand-name">Budgie</span>
            <p>Tableau de bord financier</p>
          </div>
        </div>
        <div className="dashboard-top-actions">
          <button type="button" className="btn primary dashboard-premium-btn">
            Passer à Premium
          </button>
          <button type="button" className="dashboard-icon-btn" aria-label="Notifications">
            <i className="fa-regular fa-bell" aria-hidden="true" />
          </button>
          <button type="button" className="dashboard-icon-btn" aria-label="Paramètres">
            <i className="fa-solid fa-gear" aria-hidden="true" />
          </button>
          <button type="button" className="dashboard-avatar-btn" onClick={handleLogout} title="Se déconnecter">
            {userInitials || 'JD'}
          </button>
        </div>
      </header>

      <main className="dashboard-page">
        <section className="dashboard-metrics">
          {summaryCards.map((card) => (
            <article key={card.title} className="dashboard-metric-card">
              <div className="dashboard-metric-head">
                <p>{card.title}</p>
                <span className={`dashboard-metric-icon ${card.tone}`}>
                  <i className={card.icon} aria-hidden="true" />
                </span>
              </div>
              <strong>{card.amount}</strong>
              <small>{card.detail}</small>
            </article>
          ))}
        </section>

        <nav className="dashboard-tabs" aria-label="Navigation tableau de bord">
          <button type="button" className="active">Vue d'ensemble</button>
          <button type="button">Transactions</button>
          <button type="button">Prévisions</button>
          <button type="button">Exceptions</button>
          <button type="button">Partage</button>
        </nav>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Mes comptes</h2>
              <p>Aperçu de tous vos comptes</p>
            </div>
            <button type="button" className="dashboard-add-btn" onClick={() => setShowAddModal(true)}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Ajouter
            </button>
          </div>
          <div className="dashboard-account-list">
            {loadingComptes ? (
              <p style={{ padding: '1rem', color: '#666' }}>Chargement des comptes...</p>
            ) : comptes.length > 0 ? (
              comptes.map((compte) => (
                <article key={compte.id} className="dashboard-account-item">
                  <div className="dashboard-account-main">
                    <span className="dashboard-account-icon">
                      <i className="fa-solid fa-building-columns" aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{compte.nom_court}</strong>
                      <p>{compte.description || 'Compte bancaire'}</p>
                    </div>
                  </div>
                  <strong>
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(compte.solde)}
                  </strong>
                </article>
              ))
            ) : (
              <p style={{ padding: '1rem', color: '#666' }}>Aucun compte trouvé.</p>
            )}
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>
                <i className="fa-solid fa-chart-column" aria-hidden="true" /> Évolution mensuelle
              </h2>
              <p>Comparaison revenus vs dépenses</p>
            </div>
          </div>
          <div className="dashboard-chart-placeholder">
            <div className="dashboard-chart-grid">
              {monthlyData.map((item) => (
                <div key={item.month} className="dashboard-chart-column">
                  <div
                    className="dashboard-chart-bar revenus"
                    style={{ height: `${(item.revenus / chartMax) * 100}%` }}
                  />
                  <div
                    className="dashboard-chart-bar depenses"
                    style={{ height: `${(item.depenses / chartMax) * 100}%` }}
                  />
                  <span>{item.month}</span>
                </div>
              ))}
            </div>
            <div className="dashboard-chart-legend">
              <span><i className="fa-solid fa-square" aria-hidden="true" /> Dépenses</span>
              <span><i className="fa-solid fa-square" aria-hidden="true" /> Revenus</span>
            </div>
          </div>
        </section>

        {showAddModal && (
          <div className="dashboard-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dashboard-add-account-title">
            <div className="dashboard-modal card">
              <div className="card-header">
                <h3 id="dashboard-add-account-title">Ajouter un compte</h3>
              </div>
              <form onSubmit={handleAddAccount} className="auth-form dashboard-modal-form">
                <div className="field-row">
                  <label htmlFor="account-name">Nom du compte</label>
                  <input
                    id="account-name"
                    type="text"
                    required
                    value={newAccount.nom_court}
                    onChange={(e) => setNewAccount({ ...newAccount, nom_court: e.target.value })}
                  />
                </div>
                <div className="field-row">
                  <label htmlFor="account-description">Description</label>
                  <input
                    id="account-description"
                    type="text"
                    value={newAccount.description}
                    onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
                  />
                </div>
                <div className="field-row">
                  <label htmlFor="account-created-at">Date de création</label>
                  <input
                    id="account-created-at"
                    type="date"
                    required
                    value={newAccount.date_creation}
                    onChange={(e) => setNewAccount({ ...newAccount, date_creation: e.target.value })}
                  />
                </div>
                <div className="field-row">
                  <label htmlFor="account-initial-balance">Solde initial</label>
                  <input
                    id="account-initial-balance"
                    type="number"
                    step="0.01"
                    value={newAccount.solde_initial}
                    onChange={(e) => setNewAccount({ ...newAccount, solde_initial: e.target.value })}
                  />
                </div>
                <div className="field-row">
                  <label>Taux de rémunération (%)</label>
                  <div className="dashboard-preset-row">
                    {presetsRemuneration.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className={`dashboard-preset-btn${!customTauxRemu && newAccount.taux_remuneration === p.value ? ' active' : ''}`}
                        onClick={() => {
                          setCustomTauxRemu(false);
                          setNewAccount({ ...newAccount, taux_remuneration: p.value });
                        }}
                      >
                        {p.label} {p.value}%
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`dashboard-preset-btn${customTauxRemu ? ' active' : ''}`}
                      onClick={() => {
                        setCustomTauxRemu(true);
                        setNewAccount({ ...newAccount, taux_remuneration: '' });
                        setTimeout(() => tauxRemuInputRef.current?.focus(), 0);
                      }}
                    >
                      Personnalisé
                    </button>
                  </div>
                  {customTauxRemu && (
                    <input
                      ref={tauxRemuInputRef}
                      id="account-taux-remuneration"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex : 2.5"
                      value={newAccount.taux_remuneration}
                      onChange={(e) => setNewAccount({ ...newAccount, taux_remuneration: e.target.value })}
                    />
                  )}
                </div>
                <div className="field-row">
                  <label>Taux d'imposition (%)</label>
                  <div className="dashboard-preset-row">
                    {presetsImposition.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className={`dashboard-preset-btn${!customTauxImpo && parseFloat(newAccount.taux_imposition) === p.value ? ' active' : ''}`}
                        onClick={() => {
                          setCustomTauxImpo(false);
                          setNewAccount({ ...newAccount, taux_imposition: p.value });
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`dashboard-preset-btn${customTauxImpo ? ' active' : ''}`}
                      onClick={() => {
                        setCustomTauxImpo(true);
                        setNewAccount({ ...newAccount, taux_imposition: '' });
                        setTimeout(() => tauxImpoInputRef.current?.focus(), 0);
                      }}
                    >
                      Personnalisé
                    </button>
                  </div>
                  {customTauxImpo && (
                    <input
                      ref={tauxImpoInputRef}
                      id="account-taux-imposition"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex : 12.8"
                      value={newAccount.taux_imposition}
                      onChange={(e) => setNewAccount({ ...newAccount, taux_imposition: e.target.value })}
                    />
                  )}
                </div>
                <div className="dashboard-modal-actions">
                  <button type="button" className="btn ghost small" onClick={() => setShowAddModal(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn primary small">Ajouter</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
