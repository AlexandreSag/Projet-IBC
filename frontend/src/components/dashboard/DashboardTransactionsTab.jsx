import './DashboardTransactionsTab.css';

const budgetsPlaceholder = [
  { id: 'alimentation', label: 'Alimentation', spent: 450, limit: 600 },
  { id: 'transport', label: 'Transport', spent: 280, limit: 300 },
  { id: 'loisirs', label: 'Loisirs', spent: 180, limit: 250 },
  { id: 'shopping', label: 'Shopping', spent: 120, limit: 200 },
];

const categoriesPlaceholder = [
  { id: 'alimentation', label: 'Alimentation', share: 24 },
  { id: 'logement', label: 'Logement', share: 45 },
  { id: 'transport', label: 'Transport', share: 15 },
  { id: 'loisirs', label: 'Loisirs', share: 9 },
  { id: 'autres', label: 'Autres', share: 7 },
];

const transactionsPlaceholder = [
  {
    id: 1,
    date: '11/10/2025',
    description: 'Courses Carrefour',
    category: 'Alimentation',
    amount: '-82,45 €',
    positive: false,
    icon: 'fa-solid fa-cart-shopping',
  },
  {
    id: 2,
    date: '11/10/2025',
    description: 'Salaire',
    category: 'Revenus',
    amount: '+3 200,00 €',
    positive: true,
    icon: 'fa-solid fa-arrow-trend-up',
  },
  {
    id: 3,
    date: '10/10/2025',
    description: 'Starbucks',
    category: 'Restaurants',
    amount: '-6,50 €',
    positive: false,
    icon: 'fa-solid fa-mug-hot',
  },
  {
    id: 4,
    date: '09/10/2025',
    description: 'Loyer',
    category: 'Logement',
    amount: '-850,00 €',
    positive: false,
    icon: 'fa-solid fa-house',
  },
  {
    id: 5,
    date: '08/10/2025',
    description: 'Essence',
    category: 'Transport',
    amount: '-65,00 €',
    positive: false,
    icon: 'fa-solid fa-car',
  },
  {
    id: 6,
    date: '07/10/2025',
    description: 'Netflix',
    category: 'Abonnements',
    amount: '-15,99 €',
    positive: false,
    icon: 'fa-solid fa-credit-card',
  },
];

export default function DashboardTransactionsTab() {
  return (
    <>
      <section className="dashboard-transaction-grid">
        <article className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>
                <i className="fa-solid fa-chart-pie" aria-hidden="true" /> Dépenses par catégorie
              </h2>
              <p>Répartition du mois d'octobre</p>
            </div>
          </div>
          <div className="dashboard-transaction-placeholder">
            <div className="dashboard-transaction-donut" aria-hidden="true">
              <div className="dashboard-transaction-donut-inner">Oct</div>
            </div>
            <div className="dashboard-transaction-legend">
              {categoriesPlaceholder.map((category) => (
                <p key={category.id}>{category.label} {category.share}%</p>
              ))}
            </div>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Budgets mensuels</h2>
              <p>Suivi de vos objectifs</p>
            </div>
          </div>
          <div className="dashboard-budget-list">
            {budgetsPlaceholder.map((budget) => {
              const progress = Math.min((budget.spent / budget.limit) * 100, 100);
              const remaining = Math.max(budget.limit - budget.spent, 0);

              return (
                <div key={budget.id} className="dashboard-budget-item">
                  <div className="dashboard-budget-row">
                    <strong>{budget.label}</strong>
                    <span>{budget.spent} € / {budget.limit} €</span>
                  </div>
                  <div className="dashboard-budget-track" aria-hidden="true">
                    <div className="dashboard-budget-progress" style={{ width: `${progress}%` }} />
                  </div>
                  <p>Restant: {remaining} €</p>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel-header">
          <div>
            <h2>Transactions récentes</h2>
            <p>Dernières opérations</p>
          </div>
          <button type="button" className="btn ghost small">
            <i className="fa-regular fa-calendar" aria-hidden="true" /> Filtrer
          </button>
        </div>
        <div className="dashboard-transactions-table-wrap">
          <table className="dashboard-transactions-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Description</th>
                <th scope="col">Catégorie</th>
                <th scope="col">Montant</th>
              </tr>
            </thead>
            <tbody>
              {transactionsPlaceholder.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.date}</td>
                  <td>
                    <div className="dashboard-transaction-description">
                      <span className="dashboard-transaction-icon">
                        <i className={transaction.icon} aria-hidden="true" />
                      </span>
                      <span>{transaction.description}</span>
                    </div>
                  </td>
                  <td>
                    <span className="dashboard-transaction-category">{transaction.category}</span>
                  </td>
                  <td className={transaction.positive ? 'positive' : ''}>{transaction.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
