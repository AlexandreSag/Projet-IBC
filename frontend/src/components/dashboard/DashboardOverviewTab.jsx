import './DashboardOverviewTab.css';

export default function DashboardOverviewTab({
  loadingComptes,
  comptes,
  onOpenAddModal,
  onEditAccount,
  onDeleteAccount,
  monthlyData,
  chartMax,
}) {
  const euroFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

  return (
    <>
      <section className="dashboard-panel">
        <div className="dashboard-panel-header">
          <div>
            <h2>Mes comptes</h2>
            <p>Aperçu de tous vos comptes</p>
          </div>
          <button type="button" className="dashboard-add-btn" onClick={onOpenAddModal}>
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
                <div className="dashboard-account-right">
                  <strong className="dashboard-account-balance">{euroFormatter.format(compte.solde)}</strong>
                  <div className="dashboard-account-actions">
                    <button
                      type="button"
                      className="dashboard-account-action-btn"
                      title="Modifier"
                      onClick={() => onEditAccount(compte)}
                    >
                      <i className="fa-solid fa-pen" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="dashboard-account-action-btn delete"
                      title="Supprimer"
                      onClick={() => onDeleteAccount(compte.id)}
                    >
                      <i className="fa-solid fa-trash" aria-hidden="true" />
                    </button>
                  </div>
                </div>
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
    </>
  );
}
