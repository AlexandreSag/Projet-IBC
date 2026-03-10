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

  const summaryCards = [
    {
      title: 'Solde total',
      amount: '18 881,25 €',
      detail: '↗ +5.2% ce mois',
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
      icon: 'fa-solid fa-sparkles',
    },
  ];

  const accountRows = [
    { name: 'Compte courant', subtitle: 'Compte bancaire', amount: '3 240,50 €', icon: 'fa-solid fa-building-columns' },
    { name: 'Épargne', subtitle: 'Livret A', amount: '12 850,00 €', icon: 'fa-solid fa-money-bill' },
    { name: 'Portefeuille crypto', subtitle: 'Blockchain', amount: '2 450,75 €', icon: 'fa-solid fa-link' },
    { name: 'Espèces', subtitle: 'Liquidités', amount: '340,00 €', icon: 'fa-solid fa-wallet' },
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
            <button type="button" className="dashboard-add-btn">
              <i className="fa-solid fa-plus" aria-hidden="true" /> Ajouter
            </button>
          </div>
          <div className="dashboard-account-list">
            {accountRows.map((account) => (
              <article key={account.name} className="dashboard-account-item">
                <div className="dashboard-account-main">
                  <span className="dashboard-account-icon">
                    <i className={account.icon} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{account.name}</strong>
                    <p>{account.subtitle}</p>
                  </div>
                </div>
                <strong>{account.amount}</strong>
              </article>
            ))}
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
      </main>
    </div>
  );
}
