import { formatDateForInput, getTodayIsoDate } from '../../utils/dateUtils';

export const dashboardTabs = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: 'fa-solid fa-house' },
  { id: 'transactions', label: 'Transactions', icon: 'fa-solid fa-wallet' },
  { id: 'previsions', label: 'Prévisions', icon: 'fa-solid fa-chart-line' },
  { id: 'sharing', label: 'Partage', icon: 'fa-solid fa-share-nodes' },
];

export const accountPresets = [
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

export function createEmptyAccountForm() {
  return {
    nom_court: '',
    description: '',
    date_creation: getTodayIsoDate(),
    solde_initial: 0,
    taux_remuneration: 0,
    taux_imposition: 0,
  };
}

export function hasPresetRates(account) {
  const remuneration = parseFloat(account?.taux_remuneration || 0);
  const imposition = parseFloat(account?.taux_imposition || 0);

  return accountPresets.some(
    (preset) => preset.remuneration === remuneration && preset.imposition === imposition,
  );
}

export function createEditableAccountForm(compte) {
  const defaultAccount = createEmptyAccountForm();

  return {
    id: compte.id,
    nom_court: compte.nom_court || '',
    description: compte.description || '',
    date_creation: formatDateForInput(compte.date_creation) || defaultAccount.date_creation,
    solde_initial: compte.solde_initial ?? 0,
    taux_remuneration: compte.taux_remuneration ?? 0,
    taux_imposition: compte.taux_imposition ?? 0,
  };
}
