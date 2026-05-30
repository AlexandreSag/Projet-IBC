export function normalizeSelection(selection) {
  return {
    accountIds: Array.isArray(selection?.accountIds) ? selection.accountIds : [],
    depenseIds: Array.isArray(selection?.depenseIds) ? selection.depenseIds : [],
    revenuIds: Array.isArray(selection?.revenuIds) ? selection.revenuIds : [],
  };
}

export function buildProjectedDowngrade(preview, selection) {
  if (!preview?.targetPlan) {
    return null;
  }

  const selectedAccounts = new Set(selection?.accountIds || []);
  const selectedDepenses = new Set(selection?.depenseIds || []);
  const selectedRevenus = new Set(selection?.revenuIds || []);
  const keptAccounts = (preview.accounts || [])
    .filter((account) => !selectedAccounts.has(account.id))
    .map((account) => ({
      ...account,
      depenses: (account.depenses || []).filter((depense) => !selectedDepenses.has(depense.id)),
      revenus: (account.revenus || []).filter((revenu) => !selectedRevenus.has(revenu.id)),
    }));

  const accountLimit = preview.targetPlan.limits?.comptes;
  const depensesLimit = preview.targetPlan.limits?.depensesParCompte;
  const revenusLimit = preview.targetPlan.limits?.revenusParCompte;

  const perCompte = keptAccounts.map((account) => ({
    accountId: account.id,
    accountName: account.nom_court,
    depensesUsed: account.depenses.length,
    depensesLimit,
    depensesOverBy: depensesLimit === null ? 0 : Math.max(account.depenses.length - depensesLimit, 0),
    revenusUsed: account.revenus.length,
    revenusLimit,
    revenusOverBy: revenusLimit === null ? 0 : Math.max(account.revenus.length - revenusLimit, 0),
  }));

  return {
    comptesUsed: keptAccounts.length,
    comptesLimit: accountLimit,
    comptesOverBy: accountLimit === null ? 0 : Math.max(keptAccounts.length - accountLimit, 0),
    perCompte,
  };
}

export function isProjectedDowngradeValid(projected) {
  if (!projected) {
    return false;
  }

  return projected.comptesOverBy === 0
    && projected.perCompte.every((account) => account.depensesOverBy === 0 && account.revenusOverBy === 0);
}

export function formatAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '0 €';
  }

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatCryptoAmount(value, cryptoCode = 'ETH') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return `0 ${String(cryptoCode).toUpperCase()}`;
  }

  return `${amount.toFixed(8)} ${String(cryptoCode).toUpperCase()}`;
}

export function formatExchangeRate(montantEur, montantCrypto, cryptoCode = 'ETH') {
  const eur = Number(montantEur);
  const crypto = Number(montantCrypto);

  if (!Number.isFinite(eur) || !Number.isFinite(crypto) || crypto <= 0) {
    return `1 ${String(cryptoCode).toUpperCase()} = -- €`;
  }

  return `1 ${String(cryptoCode).toUpperCase()} = ${(eur / crypto).toFixed(2)} €`;
}

export function formatWalletAddress(address) {
  if (!address) {
    return 'Aucun wallet connecté';
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatUsage(usage) {
  if (!usage) {
    return 'Indisponible';
  }

  if (usage.isUnlimited) {
    return 'Illimité';
  }

  return `${usage.used} / ${usage.limit}`;
}

export function getProgressPercent(usage) {
  if (!usage) {
    return 0;
  }

  if (usage.isUnlimited) {
    return 100;
  }

  if (!usage.limit) {
    return 0;
  }

  return Math.min((usage.used / usage.limit) * 100, 100);
}
