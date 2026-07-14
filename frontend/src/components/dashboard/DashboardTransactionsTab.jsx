import { useMemo, useState } from 'react';
import './DashboardTransactionsTab.css';
import { buildTransactionsFromRules } from '../../utils/transactionHelpers';
import DashboardTransactionsList from './DashboardTransactionsList';
import DashboardTransactionManagerModal from './DashboardTransactionManagerModal';

export default function DashboardTransactionsTab({
  depenses,
  revenus,
  comptes,
  loadingTransactions,
  onCreateDepense,
  onUpdateDepense,
  onDeleteDepense,
  onCreateRevenu,
  onUpdateRevenu,
  onDeleteRevenu,
}) {
  const [activeManagerModal, setActiveManagerModal] = useState(null);
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

  const openDepenseManagerModal = () => setActiveManagerModal('depense');
  const openRevenuManagerModal = () => setActiveManagerModal('revenu');
  const closeManagerModal = () => setActiveManagerModal(null);

  return (
    <>
      <DashboardTransactionsList
        transactions={filteredTransactions}
        loading={loadingTransactions}
        filterText={filterText}
        onFilterChange={setFilterText}
        onOpenDepenseManagerModal={openDepenseManagerModal}
        onOpenRevenuManagerModal={openRevenuManagerModal}
        euroFormatter={euroFormatter}
        showFilterInput={showFilterInput}
        setShowFilterInput={setShowFilterInput}
      />

      {activeManagerModal === 'depense' && (
        <DashboardTransactionManagerModal
          comptes={comptes}
          items={depenses}
          itemType="depense"
          onClose={closeManagerModal}
          onCreateItem={onCreateDepense}
          onUpdateItem={onUpdateDepense}
          onDeleteItem={onDeleteDepense}
          euroFormatter={euroFormatter}
        />
      )}

      {activeManagerModal === 'revenu' && (
        <DashboardTransactionManagerModal
          comptes={comptes}
          items={revenus}
          itemType="revenu"
          onClose={closeManagerModal}
          onCreateItem={onCreateRevenu}
          onUpdateItem={onUpdateRevenu}
          onDeleteItem={onDeleteRevenu}
          euroFormatter={euroFormatter}
        />
      )}
    </>
  );
}
