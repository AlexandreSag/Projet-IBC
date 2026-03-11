import { parseDateValue, toIsoDate } from './dateUtils';

export function resolveRuleNom(rule) {
  if (typeof rule.nom === 'string' && rule.nom.trim()) return rule.nom.trim();
  if (typeof rule.nom_court === 'string' && rule.nom_court.trim()) return rule.nom_court.trim();
  return 'Sans nom';
}

export function resolveRuleMontant(rule) {
  const rawAmount = rule.montant ?? rule.amount;
  return Math.abs(Number(rawAmount || 0));
}

export function resolveRuleFrequency(rule) {
  const rawFrequency = rule.frequence_mois ?? rule.frequency_months ?? 0;
  return Number(rawFrequency || 0);
}

export function resolveRuleCompte(rule) {
  return rule.compte_nom_court || rule.compte_nom || 'Compte inconnu';
}

export function buildTransactionsFromRules(
  rules,
  {
    sourceType,
    nature,
    upToDate = new Date(),
    windowStartDate = null,
  },
) {
  return rules.flatMap((rule) => {
    const startDate = parseDateValue(rule.date_debut);
    if (!startDate) return [];

    const endDate = rule.date_fin ? parseDateValue(rule.date_fin) : null;
    const effectiveEnd = endDate && endDate < upToDate ? endDate : upToDate;
    if (startDate > effectiveEnd) return [];

    const frequency = resolveRuleFrequency(rule);
    const amountAbs = resolveRuleMontant(rule);

    if (amountAbs <= 0) return [];

    const occurrenceDates = [];
    if (frequency === 0) {
      if (!windowStartDate || startDate >= windowStartDate) {
        occurrenceDates.push(new Date(startDate));
      }
    } else if (Number.isInteger(frequency) && frequency > 0) {
      const cursor = new Date(startDate);
      while (windowStartDate && cursor < windowStartDate) {
        cursor.setMonth(cursor.getMonth() + frequency);
      }
      while (cursor <= effectiveEnd) {
        occurrenceDates.push(new Date(cursor));
        cursor.setMonth(cursor.getMonth() + frequency);
      }
    } else {
      return [];
    }

    return occurrenceDates
      .filter((occurrenceDate) => occurrenceDate <= effectiveEnd)
      .map((occurrenceDate) => {
        const dateIso = toIsoDate(occurrenceDate);
        const isCredit = nature === 'credit';

        return {
          id: `${sourceType}-${rule.id}-${dateIso}`,
          sourceId: rule.id,
          sourceType,
          typeLabel: sourceType === 'revenu' ? 'Revenu' : 'Dépense',
          nature,
          date: dateIso,
          nom: resolveRuleNom(rule),
          description: rule.description || '',
          compteNom: resolveRuleCompte(rule),
          montant: isCredit ? amountAbs : -amountAbs,
          iconClass: isCredit ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-receipt',
        };
      });
  });
}
