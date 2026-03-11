import { useMemo, useState } from 'react';
import './DashboardTransactionsTab.css';
import { buildTransactionsFromRules } from '../../utils/transactionHelpers';
import DashboardTransactionsStats from './DashboardTransactionsStats';
import DashboardTransactionsList from './DashboardTransactionsList';
import DashboardTransactionManagerModal from './DashboardTransactionManagerModal';

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

export default function DashboardTransactionsTab({
  depenses,
  comptes,
  loadingDepenses,
  onCreateDepense,
  onUpdateDepense,
  onDeleteDepense,
  revenus = [],
}) {
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showFilterInput, setShowFilterInput] = useState(false);
  const [filterText, setFilterText] = useState('');

  const euroFormatter = useMemo(
    () => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }),
    [],
  );

  const recentTransactions = useMemo(() => {
    const upToDate = new Date();
    const historyStart = new Date(upToDate.getFullYear(), upToDate.getMonth() - 11, 1);

    const depenseTransactions = buildTransactionsFromRules(depenses, {
      sourceType: 'depense',
      nature: 'debit',
      upToDate,
      windowStartDate: historyStart,
    });

    const revenuTransactions = buildTransactionsFromRules(revenus, {
      sourceType: 'revenu',
      nature: 'credit',
      upToDate,
      windowStartDate: historyStart,
    });

    return [...depenseTransactions, ...revenuTransactions]
      .sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.sourceId - a.sourceId;
      });
  }, [depenses, revenus]);

  const filteredTransactions = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return recentTransactions;

    return recentTransactions.filter((transaction) => {
      const nom = (transaction.nom || '').toLowerCase();
      const description = (transaction.description || '').toLowerCase();
      return nom.includes(query) || description.includes(query);
    });
  }, [recentTransactions, filterText]);

  const openManagerModal = () => setShowManagerModal(true);
  const closeManagerModal = () => setShowManagerModal(false);

  return (
    <>
      <DashboardTransactionsStats budgets={budgetsPlaceholder} categories={categoriesPlaceholder} />

      <DashboardTransactionsList
        transactions={filteredTransactions}
        loading={loadingDepenses}
        filterText={filterText}
        onFilterChange={setFilterText}
        onOpenManagerModal={openManagerModal}
        euroFormatter={euroFormatter}
        showFilterInput={showFilterInput}
        setShowFilterInput={setShowFilterInput}
      />

      {showManagerModal && (
        <DashboardTransactionManagerModal
          comptes={comptes}
          depenses={depenses}
          onClose={closeManagerModal}
          onCreateDepense={onCreateDepense}
          onUpdateDepense={onUpdateDepense}
          onDeleteDepense={onDeleteDepense}
          euroFormatter={euroFormatter}
        />
      )}
    </>
  );
}
