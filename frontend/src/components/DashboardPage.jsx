import { useEffect, useState, useRef, useCallback } from 'react';
import DashboardOverviewTab from './dashboard/DashboardOverviewTab.jsx';
import DashboardTransactionsTab from './dashboard/DashboardTransactionsTab.jsx';
import DashboardPlaceholderTab from './dashboard/DashboardPlaceholderTab.jsx';
import DashboardTopbar from './dashboard/DashboardTopbar.jsx';
import './dashboard/DashboardPage.css';

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

const dashboardTabs = [
  { id: 'overview', label: 'Vue d\'ensemble' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'forecasts', label: 'Prévisions' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'sharing', label: 'Partage' },
];

function parseIsoDate(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
  }
  if (typeof dateValue !== 'string') return null;
  const normalizedDate = dateValue.includes('T') ? dateValue.slice(0, 10) : dateValue;
  const [year, month, day] = normalizedDate.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function countOccurrencesInRange(depense, rangeStart, rangeEnd) {
  const start = parseIsoDate(depense.date_debut);
  if (!start) return 0;

  const now = new Date();
  const limitDate = new Date(Math.min(rangeEnd.getTime(), now.getTime()));
  const end = depense.date_fin ? parseIsoDate(depense.date_fin) : null;
  const effectiveEnd = end && end < limitDate ? end : limitDate;

  if (start > effectiveEnd) return 0;

  const frequence = Number(depense.frequence_mois || 0);
  if (frequence === 0) {
    return start >= rangeStart && start <= effectiveEnd ? 1 : 0;
  }

  if (frequence < 1 || !Number.isInteger(frequence)) return 0;

  let count = 0;
  const current = new Date(start);
  while (current <= effectiveEnd) {
    if (current >= rangeStart) {
      count += 1;
    }
    current.setMonth(current.getMonth() + frequence);
  }

  return count;
}

export default function DashboardPage() {
  const [comptes, setComptes] = useState([]);
  const [loadingComptes, setLoadingComptes] = useState(true);
  const [depenses, setDepenses] = useState([]);
  const [loadingDepenses, setLoadingDepenses] = useState(true);
  const [revenus, setRevenus] = useState([]);
  const [loadingRevenus, setLoadingRevenus] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [newAccount, setNewAccount] = useState({
    nom_court: '',
    description: '',
    date_creation: new Date().toISOString().split('T')[0],
    solde_initial: 0,
    taux_remuneration: 0,
    taux_imposition: 0,
  });
  const [customTaux, setCustomTaux] = useState(false);
  const tauxRemuInputRef = useRef(null);
  const tauxImpoInputRef = useRef(null);

  const presetsCompte = [
    { label: 'Livret A', remuneration: 1.5, imposition: 0 },
    { label: 'LDDS', remuneration: 1.5, imposition: 0 },
    { label: 'LEP', remuneration: 2.5, imposition: 0 },
    { label: 'Livret Jeune', remuneration: 1.5, imposition: 0 },
    { label: 'CEL', remuneration: 1, imposition: 30 },
    { label: 'PEL (2026)', remuneration: 2, imposition: 30 },
    { label: 'CTO', remuneration: 5, imposition: 30 },
    { label: 'Assurance-vie', remuneration: 2.6, imposition: 30 },
    { label: 'Livret bancaire', remuneration: 0.75, imposition: 30 },
  ];

  const fetchComptes = useCallback(async () => {
    try {
      const response = await fetch('/api/comptes', { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      setComptes(data.comptes || []);
    } catch (error) {
      console.error('Erreur lors du chargement des comptes:', error);
    } finally {
      setLoadingComptes(false);
    }
  }, []);

  const fetchDepenses = useCallback(async () => {
    try {
      const response = await fetch('/api/depenses', { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      setDepenses(data.depenses || []);
    } catch (error) {
      console.error('Erreur lors du chargement des dépenses:', error);
    } finally {
      setLoadingDepenses(false);
    }
  }, []);

  const fetchRevenus = useCallback(async () => {
    try {
      const response = await fetch('/api/revenus', { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      setRevenus(data.revenus || []);
    } catch (error) {
      console.error('Erreur lors du chargement des revenus:', error);
    } finally {
      setLoadingRevenus(false);
    }
  }, []);

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
        await fetchComptes();
        setShowAddModal(false);
        setNewAccount({
          nom_court: '',
          description: '',
          date_creation: new Date().toISOString().split('T')[0],
          solde_initial: 0,
          taux_remuneration: 0,
          taux_imposition: 0,
        });
        setCustomTaux(false);
      } else {
        const err = await response.json();
        alert(err.error || 'Erreur lors de la création du compte');
      }
    } catch {
      alert('Erreur réseau');
    }
  };

  const handleEditAccount = (compte) => {
    const dateVal = compte.date_creation
      ? (typeof compte.date_creation === 'string' ? compte.date_creation.slice(0, 10) : new Date(compte.date_creation).toISOString().split('T')[0])
      : new Date().toISOString().split('T')[0];
    setEditingAccount({
      id: compte.id,
      nom_court: compte.nom_court || '',
      description: compte.description || '',
      date_creation: dateVal,
      solde_initial: compte.solde_initial ?? 0,
      taux_remuneration: compte.taux_remuneration ?? 0,
      taux_imposition: compte.taux_imposition ?? 0,
    });
    const remu = parseFloat(compte.taux_remuneration || 0);
    const impo = parseFloat(compte.taux_imposition || 0);
    const isPreset = presetsCompte.some((p) => p.remuneration === remu && p.imposition === impo);
    setCustomTaux(!isPreset);
  };

  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      const response = await fetch(`/api/comptes/${editingAccount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAccount),
        credentials: 'include',
      });
      if (response.ok) {
        await fetchComptes();
        setEditingAccount(null);
        setCustomTaux(false);
      } else {
        const err = await response.json();
        alert(err.error || 'Erreur lors de la modification du compte');
      }
    } catch {
      alert('Erreur réseau');
    }
  };

  const handleDeleteAccount = async (compteId) => {
    if (!window.confirm('Supprimer ce compte et toutes ses dépenses/revenus associés ?')) return;
    try {
      const response = await fetch(`/api/comptes/${compteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        await fetchComptes();
      } else {
        const err = await response.json();
        alert(err.error || 'Erreur lors de la suppression du compte');
      }
    } catch {
      alert('Erreur réseau');
    }
  };

  useEffect(() => {
    fetchComptes();
    fetchDepenses();
    fetchRevenus();
  }, [fetchComptes, fetchDepenses, fetchRevenus]);

  const handleCreateDepense = async (payload) => {
    const response = await fetch('/api/depenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erreur lors de la création de la dépense');
    }

    await Promise.all([fetchDepenses(), fetchComptes()]);
  };

  const handleUpdateDepense = async (depenseId, payload) => {
    const response = await fetch(`/api/depenses/${depenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erreur lors de la modification de la dépense');
    }

    await Promise.all([fetchDepenses(), fetchComptes()]);
  };

  const handleDeleteDepense = async (depenseId) => {
    const response = await fetch(`/api/depenses/${depenseId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erreur lors de la suppression de la dépense');
    }

    await Promise.all([fetchDepenses(), fetchComptes()]);
  };

  const handleCreateRevenu = async (payload) => {
    const response = await fetch('/api/revenus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erreur lors de la création du revenu');
    }

    await Promise.all([fetchRevenus(), fetchComptes()]);
  };

  const handleUpdateRevenu = async (revenuId, payload) => {
    const response = await fetch(`/api/revenus/${revenuId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erreur lors de la modification du revenu');
    }

    await Promise.all([fetchRevenus(), fetchComptes()]);
  };

  const handleDeleteRevenu = async (revenuId) => {
    const response = await fetch(`/api/revenus/${revenuId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erreur lors de la suppression du revenu');
    }

    await Promise.all([fetchRevenus(), fetchComptes()]);
  };

  const totalSolde = comptes.reduce((acc, compte) => acc + (compte.solde || 0), 0);
  const euroFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const formattedTotalSolde = euroFormatter.format(totalSolde);
  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const depensesMois = depenses.reduce((sum, depense) => {
    const occurrences = countOccurrencesInRange(depense, monthStart, monthEnd);
    return sum + Number(depense.montant || 0) * occurrences;
  }, 0);
  const revenusMois = revenus.reduce((sum, revenu) => {
    const occurrences = countOccurrencesInRange(revenu, monthStart, monthEnd);
    return sum + Number(revenu.montant || 0) * occurrences;
  }, 0);
  const revenusMoisFormates = euroFormatter.format(revenusMois);
  const depensesMoisFormatees = euroFormatter.format(depensesMois);
  const loadingTransactions = loadingDepenses || loadingRevenus;

  const summaryCards = [
    {
      title: 'Solde total',
      amount: formattedTotalSolde,
      detail: 'Actualisé aujourd\'hui',
      tone: 'default',
      icon: 'fa-solid fa-dollar-sign',
    },
    {
      title: `Revenus (${monthLabel})`,
      amount: revenusMoisFormates,
      detail: 'Basé sur vos revenus actifs',
      tone: 'positive',
      icon: 'fa-solid fa-arrow-up',
    },
    {
      title: `Dépenses (${monthLabel})`,
      amount: depensesMoisFormatees,
      detail: 'Basé sur vos dépenses actives',
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

  const renderTabContent = () => {
    if (activeTab === 'overview') {
      return (
        <DashboardOverviewTab
          loadingComptes={loadingComptes}
          comptes={comptes}
          onOpenAddModal={() => setShowAddModal(true)}
          onEditAccount={handleEditAccount}
          onDeleteAccount={handleDeleteAccount}
          monthlyData={monthlyData}
          chartMax={chartMax}
        />
      );
    }

    if (activeTab === 'transactions') {
      return (
        <DashboardTransactionsTab
          depenses={depenses}
          revenus={revenus}
          comptes={comptes}
          loadingTransactions={loadingTransactions}
          onCreateDepense={handleCreateDepense}
          onUpdateDepense={handleUpdateDepense}
          onDeleteDepense={handleDeleteDepense}
          onCreateRevenu={handleCreateRevenu}
          onUpdateRevenu={handleUpdateRevenu}
          onDeleteRevenu={handleDeleteRevenu}
        />
      );
    }

    return <DashboardPlaceholderTab />;
  };

  return (
    <div className="dashboard-layout">
      <DashboardTopbar subtitle="Tableau de bord financier" activeAction="dashboard" />

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
          {dashboardTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {renderTabContent()}

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
                  <label>Type de compte</label>
                  <div className="dashboard-preset-row">
                    {presetsCompte.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className={`dashboard-preset-btn${!customTaux && parseFloat(newAccount.taux_remuneration) === p.remuneration && parseFloat(newAccount.taux_imposition) === p.imposition ? ' active' : ''}`}
                        onClick={() => {
                          setCustomTaux(false);
                          setNewAccount({ ...newAccount, taux_remuneration: p.remuneration, taux_imposition: p.imposition });
                        }}
                      >
                        {p.label} ({p.remuneration}% / {p.imposition}%)
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`dashboard-preset-btn${customTaux ? ' active' : ''}`}
                      onClick={() => {
                        setCustomTaux(true);
                        setNewAccount({ ...newAccount, taux_remuneration: '', taux_imposition: '' });
                        setTimeout(() => tauxRemuInputRef.current?.focus(), 0);
                      }}
                    >
                      Personnalisé
                    </button>
                  </div>
                </div>
                {customTaux && (
                  <>
                    <div className="field-row">
                      <label htmlFor="account-taux-remuneration">Taux de rémunération (%)</label>
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
                    </div>
                    <div className="field-row">
                      <label htmlFor="account-taux-imposition">Taux d'imposition (%)</label>
                      <input
                        ref={tauxImpoInputRef}
                        id="account-taux-imposition"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Ex : 30"
                        value={newAccount.taux_imposition}
                        onChange={(e) => setNewAccount({ ...newAccount, taux_imposition: e.target.value })}
                      />
                    </div>
                  </>
                )}
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

        {editingAccount && (
          <div className="dashboard-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dashboard-edit-account-title">
            <div className="dashboard-modal card">
              <div className="card-header">
                <h3 id="dashboard-edit-account-title">Modifier le compte</h3>
              </div>
              <form onSubmit={handleUpdateAccount} className="auth-form dashboard-modal-form">
                <div className="field-row">
                  <label htmlFor="edit-account-name">Nom du compte</label>
                  <input
                    id="edit-account-name"
                    type="text"
                    required
                    value={editingAccount.nom_court}
                    onChange={(e) => setEditingAccount({ ...editingAccount, nom_court: e.target.value })}
                  />
                </div>
                <div className="field-row">
                  <label htmlFor="edit-account-description">Description</label>
                  <input
                    id="edit-account-description"
                    type="text"
                    value={editingAccount.description}
                    onChange={(e) => setEditingAccount({ ...editingAccount, description: e.target.value })}
                  />
                </div>
                <div className="field-row">
                  <label htmlFor="edit-account-created-at">Date de création</label>
                  <input
                    id="edit-account-created-at"
                    type="date"
                    required
                    value={editingAccount.date_creation}
                    onChange={(e) => setEditingAccount({ ...editingAccount, date_creation: e.target.value })}
                  />
                </div>
                <div className="field-row">
                  <label htmlFor="edit-account-initial-balance">Solde initial</label>
                  <input
                    id="edit-account-initial-balance"
                    type="number"
                    step="0.01"
                    value={editingAccount.solde_initial}
                    onChange={(e) => setEditingAccount({ ...editingAccount, solde_initial: e.target.value })}
                  />
                </div>
                <div className="field-row">
                  <label>Type de compte</label>
                  <div className="dashboard-preset-row">
                    {presetsCompte.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className={`dashboard-preset-btn${!customTaux && parseFloat(editingAccount.taux_remuneration) === p.remuneration && parseFloat(editingAccount.taux_imposition) === p.imposition ? ' active' : ''}`}
                        onClick={() => {
                          setCustomTaux(false);
                          setEditingAccount({ ...editingAccount, taux_remuneration: p.remuneration, taux_imposition: p.imposition });
                        }}
                      >
                        {p.label} ({p.remuneration}% / {p.imposition}%)
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`dashboard-preset-btn${customTaux ? ' active' : ''}`}
                      onClick={() => {
                        setCustomTaux(true);
                        setEditingAccount({ ...editingAccount, taux_remuneration: '', taux_imposition: '' });
                        setTimeout(() => tauxRemuInputRef.current?.focus(), 0);
                      }}
                    >
                      Personnalisé
                    </button>
                  </div>
                </div>
                {customTaux && (
                  <>
                    <div className="field-row">
                      <label htmlFor="edit-account-taux-remuneration">Taux de rémunération (%)</label>
                      <input
                        ref={tauxRemuInputRef}
                        id="edit-account-taux-remuneration"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Ex : 2.5"
                        value={editingAccount.taux_remuneration}
                        onChange={(e) => setEditingAccount({ ...editingAccount, taux_remuneration: e.target.value })}
                      />
                    </div>
                    <div className="field-row">
                      <label htmlFor="edit-account-taux-imposition">Taux d'imposition (%)</label>
                      <input
                        ref={tauxImpoInputRef}
                        id="edit-account-taux-imposition"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Ex : 30"
                        value={editingAccount.taux_imposition}
                        onChange={(e) => setEditingAccount({ ...editingAccount, taux_imposition: e.target.value })}
                      />
                    </div>
                  </>
                )}
                <div className="dashboard-modal-actions">
                  <button type="button" className="btn ghost small" onClick={() => { setEditingAccount(null); setCustomTaux(false); }}>
                    Annuler
                  </button>
                  <button type="submit" className="btn primary small">Enregistrer</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
