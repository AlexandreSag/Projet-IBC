export default function DashboardTransactionsStats({ budgets, categories }) {
  return (
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
            {categories.map((category) => (
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
          {budgets.map((budget) => {
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
  );
}
