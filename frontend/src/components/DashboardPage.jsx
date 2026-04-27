import { useState } from 'react';
import DashboardAccountModal from './dashboard/DashboardAccountModal.jsx';
import DashboardOverviewTab from './dashboard/DashboardOverviewTab.jsx';
import DashboardTransactionsTab from './dashboard/DashboardTransactionsTab.jsx';
import DashboardPlaceholderTab from './dashboard/DashboardPlaceholderTab.jsx';
import DashboardTopbar from './dashboard/DashboardTopbar.jsx';
import {
  accountPresets,
  chartMax,
  createEditableAccountForm,
  createEmptyAccountForm,
  dashboardTabs,
  hasPresetRates,
  monthlyData,
} from './dashboard/dashboardConfig.js';
import { buildSummaryCards } from './dashboard/dashboardMetrics.js';
import useDashboardData from './dashboard/useDashboardData.js';
import './dashboard/DashboardPage.css';

export default function DashboardPage() {
  const {
    comptes,
    loadingComptes,
    depenses,
    revenus,
    loadingTransactions,
    createAccount,
    updateAccount,
    deleteAccount,
    createDepense,
    updateDepense,
    deleteDepense,
    createRevenu,
    updateRevenu,
    deleteRevenu,
  } = useDashboardData();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [newAccount, setNewAccount] = useState(createEmptyAccountForm);
  const [customTaux, setCustomTaux] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [accountModalMessage, setAccountModalMessage] = useState(null);

  const showErrorMessage = (error, fallbackText = 'Erreur réseau') => {
    setActionMessage({
      type: 'error',
      text: error.message || fallbackText,
    });
  };

  const handleAddAccount = async (event) => {
    event.preventDefault();
    setActionMessage(null);
    setAccountModalMessage(null);

    try {
      await createAccount(newAccount);
      setShowAddModal(false);
      setNewAccount(createEmptyAccountForm());
      setCustomTaux(false);
    } catch (error) {
      setAccountModalMessage({
        type: 'error',
        text: error.message || 'Erreur réseau',
      });
    }
  };

  const handleEditAccount = (compte) => {
    const editableAccount = createEditableAccountForm(compte);
    setEditingAccount(editableAccount);
    setCustomTaux(!hasPresetRates(editableAccount));
    setAccountModalMessage(null);
  };

  const handleUpdateAccount = async (event) => {
    event.preventDefault();
    if (!editingAccount) return;
    setActionMessage(null);
    setAccountModalMessage(null);

    try {
      await updateAccount(editingAccount.id, editingAccount);
      setEditingAccount(null);
      setCustomTaux(false);
    } catch (error) {
      setAccountModalMessage({
        type: 'error',
        text: error.message || 'Erreur réseau',
      });
    }
  };

  const handleDeleteAccount = async (compteId) => {
    if (!window.confirm('Supprimer ce compte et toutes ses dépenses/revenus associés ?')) return;
    setActionMessage(null);

    try {
      await deleteAccount(compteId);
    } catch (error) {
      showErrorMessage(error);
    }
  };

  const closeEditModal = () => {
    setEditingAccount(null);
    setCustomTaux(false);
    setAccountModalMessage(null);
  };

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
          onCreateDepense={createDepense}
          onUpdateDepense={updateDepense}
          onDeleteDepense={deleteDepense}
          onCreateRevenu={createRevenu}
          onUpdateRevenu={updateRevenu}
          onDeleteRevenu={deleteRevenu}
        />
      );
    }

    return <DashboardPlaceholderTab />;
  };

  return (
    <div className="dashboard-layout">
      <DashboardTopbar subtitle="Tableau de bord financier" activeAction="dashboard" />

      <main className="dashboard-page">
        {actionMessage && <p className={`feedback ${actionMessage.type}`}>{actionMessage.text}</p>}

        <section className="dashboard-metrics">
          {buildSummaryCards({ comptes, depenses, revenus }).map((card) => (
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
          <DashboardAccountModal
            account={newAccount}
            customRates={customTaux}
            message={accountModalMessage}
            mode="add"
            presets={accountPresets}
            onAccountChange={setNewAccount}
            onClose={() => {
              setShowAddModal(false);
              setAccountModalMessage(null);
            }}
            onCustomRatesChange={setCustomTaux}
            onSubmit={handleAddAccount}
          />
        )}

        {editingAccount && (
          <DashboardAccountModal
            account={editingAccount}
            customRates={customTaux}
            message={accountModalMessage}
            mode="edit"
            presets={accountPresets}
            onAccountChange={setEditingAccount}
            onClose={closeEditModal}
            onCustomRatesChange={setCustomTaux}
            onSubmit={handleUpdateAccount}
          />
        )}
      </main>
    </div>
  );
}
