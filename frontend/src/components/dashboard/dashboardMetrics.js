import { parseDateValue } from '../../utils/dateUtils';

export const euroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
});

function countOccurrencesInRange(rule, rangeStart, rangeEnd) {
  const start = parseDateValue(rule.date_debut);
  if (!start) return 0;

  const now = new Date();
  // On s'arrête à aujourd'hui pour ne pas compter les opérations prévues plus tard dans le mois.
  const limitDate = new Date(Math.min(rangeEnd.getTime(), now.getTime()));
  const end = rule.date_fin ? parseDateValue(rule.date_fin) : null;
  const effectiveEnd = end && end < limitDate ? end : limitDate;

  if (start > effectiveEnd) return 0;

  const frequency = Number(rule.frequence_mois || 0);
  if (frequency === 0) {
    return start >= rangeStart && start <= effectiveEnd ? 1 : 0;
  }

  if (frequency < 1 || !Number.isInteger(frequency)) return 0;

  let count = 0;
  const current = new Date(start);
  while (current <= effectiveEnd) {
    if (current >= rangeStart) {
      count += 1;
    }
    current.setMonth(current.getMonth() + frequency);
  }

  return count;
}

function getMonthlyRuleTotal(rules, monthStart, monthEnd) {
  return rules.reduce((sum, rule) => {
    const occurrences = countOccurrencesInRange(rule, monthStart, monthEnd);
    return sum + Number(rule.montant || 0) * occurrences;
  }, 0);
}

export function buildSummaryCards({ comptes, depenses, revenus }) {
  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const totalSolde = comptes.reduce((acc, compte) => acc + (compte.solde || 0), 0);
  const revenusMois = getMonthlyRuleTotal(revenus, monthStart, monthEnd);
  const depensesMois = getMonthlyRuleTotal(depenses, monthStart, monthEnd);

  return [
    {
      title: 'Solde total',
      amount: euroFormatter.format(totalSolde),
      detail: 'Actualisé aujourd\'hui',
      tone: 'default',
      icon: 'fa-solid fa-dollar-sign',
    },
    {
      title: `Revenus (${monthLabel})`,
      amount: euroFormatter.format(revenusMois),
      detail: 'Basé sur vos revenus actifs',
      tone: 'positive',
      icon: 'fa-solid fa-arrow-up',
    },
    {
      title: `Dépenses (${monthLabel})`,
      amount: euroFormatter.format(depensesMois),
      detail: 'Basé sur vos dépenses actives',
      tone: 'negative',
      icon: 'fa-solid fa-arrow-down',
    },
  ];
}
