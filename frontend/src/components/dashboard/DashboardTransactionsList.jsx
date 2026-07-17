import { formatDateForDisplay } from '../../utils/dateUtils';

export default function DashboardTransactionsList({
  transactions,
  loading,
  filterText,
  onFilterChange,
  comptes,
  selectedAccountIds,
  onSelectedAccountIdsChange,
  onOpenDepenseManagerModal,
  onOpenRevenuManagerModal,
  euroFormatter,
}) {
  const hasActiveFilters = filterText.trim() || selectedAccountIds.length > 0;

  const toggleAccount = (accountId) => {
    onSelectedAccountIdsChange(
      selectedAccountIds.includes(accountId)
        ? selectedAccountIds.filter((id) => id !== accountId)
        : [...selectedAccountIds, accountId],
    );
  };

  const resetFilters = () => {
    onFilterChange('');
    onSelectedAccountIdsChange([]);
  };

  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-header">
        <div>
          <h2>Transactions récentes</h2>
          <p>Historique des occurrences de transactions</p>
        </div>
        <div className="dashboard-transaction-actions">
          <button type="button" className="btn primary small" onClick={onOpenDepenseManagerModal}>
            <i className="fa-solid fa-wallet" aria-hidden="true" /> Gérer mes dépenses
          </button>
          <button type="button" className="btn primary small" onClick={onOpenRevenuManagerModal}>
            <i className="fa-solid fa-sack-dollar" aria-hidden="true" /> Gérer mes revenus
          </button>
        </div>
      </div>
      <div className="dashboard-transaction-filter-row" aria-label="Filtres des transactions">
        <input
          type="search"
          placeholder="Filtrer par nom ou description"
          value={filterText}
          onChange={(event) => onFilterChange(event.target.value)}
        />
        <div className="dashboard-account-filters">
          {comptes.map((compte) => (
            <label key={compte.id} className="dashboard-account-filter">
              <input
                type="checkbox"
                checked={selectedAccountIds.includes(Number(compte.id))}
                onChange={() => toggleAccount(Number(compte.id))}
              />
              <span>{compte.nom_court}</span>
            </label>
          ))}
        </div>
        {hasActiveFilters && (
          <button type="button" className="btn ghost small" onClick={resetFilters}>
            Réinitialiser
          </button>
        )}
      </div>

      <div className="dashboard-transactions-table-wrap">
        <table className="dashboard-transactions-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Description</th>
              <th scope="col">Type</th>
              <th scope="col">Compte</th>
              <th scope="col">Montant</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="5" className="dashboard-empty-row">Chargement des transactions...</td>
              </tr>
            )}
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan="5" className="dashboard-empty-row">Aucune transaction correspondante trouvée.</td>
              </tr>
            )}
            {!loading && transactions.map((transaction) => {
              const isCredit = transaction.nature === 'credit';
              return (
                <tr key={transaction.id}>
                  <td data-label="Date">{formatDateForDisplay(transaction.date)}</td>
                  <td data-label="Description">
                    <div className="dashboard-transaction-description">
                      <span className="dashboard-transaction-icon">
                        <i className={transaction.iconClass} aria-hidden="true" />
                      </span>
                      <span>
                        {transaction.nom}
                        {transaction.description ? <small>{transaction.description}</small> : null}
                        {transaction.durationLabel ? <small>{transaction.durationLabel}</small> : null}
                      </span>
                    </div>
                  </td>
                  <td data-label="Type">
                    <span className={`dashboard-transaction-type ${transaction.nature}`}>
                      {transaction.typeLabel}
                    </span>
                  </td>
                  <td data-label="Compte">
                    <span className="dashboard-transaction-category">{transaction.compteNom}</span>
                  </td>
                  <td data-label="Montant" className={isCredit ? 'positive' : 'negative'}>
                    {isCredit ? '+' : '-'}{euroFormatter.format(Math.abs(transaction.montant))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
