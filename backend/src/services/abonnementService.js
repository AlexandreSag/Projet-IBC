const { getPool } = require('../config/database');

const PLAN_CODES = {
  FREE: 'free',
  PREMIUM: 'premium',
};

const QUOTA_RESOURCES = {
  COMPTES: 'comptes',
  DEPENSES: 'depenses',
  REVENUS: 'revenus',
};

function normalizeLimit(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatAbonnement(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    code: row.code,
    nom: row.nom,
    prix: row.prix,
    blockchain_type: row.blockchain_type,
    wallet_address: row.wallet_address,
    smart_contract_address: row.smart_contract_address,
    actif: Boolean(row.actif),
    isFree: row.code === PLAN_CODES.FREE,
    isPremium: row.code === PLAN_CODES.PREMIUM,
    limits: {
      comptes: normalizeLimit(row.max_comptes),
      depensesParCompte: normalizeLimit(row.max_depenses_par_compte),
      revenusParCompte: normalizeLimit(row.max_revenus_par_compte),
    },
  };
}

async function getUserAbonnement(userId) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT
      a.id,
      a.code,
      a.nom,
      a.prix,
      a.blockchain_type,
      a.wallet_address,
      a.smart_contract_address,
      a.max_comptes,
      a.max_depenses_par_compte,
      a.max_revenus_par_compte,
      a.actif
     FROM utilisateur u
     INNER JOIN abonnement a ON a.id = u.abonnement_id
     WHERE u.id = ?`,
    [userId],
  );

  return formatAbonnement(rows[0]);
}

async function getAbonnementByCode(code) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT
      id,
      code,
      nom,
      prix,
      blockchain_type,
      wallet_address,
      smart_contract_address,
      max_comptes,
      max_depenses_par_compte,
      max_revenus_par_compte,
      actif
     FROM abonnement
     WHERE code = ? AND actif = TRUE
     LIMIT 1`,
    [code],
  );

  return formatAbonnement(rows[0]);
}

async function assignPlanToUser(userId, planCode) {
  const db = await getPool();
  const plan = await getAbonnementByCode(planCode);

  if (!plan) {
    const error = new Error(`Plan introuvable ou inactif: ${planCode}`);
    error.statusCode = 404;
    throw error;
  }

  await db.execute('UPDATE utilisateur SET abonnement_id = ? WHERE id = ?', [plan.id, userId]);
  return plan;
}

async function countComptesForUser(userId) {
  const db = await getPool();
  const [rows] = await db.execute(
    'SELECT COUNT(*) AS total FROM compte WHERE utilisateur_id = ?',
    [userId],
  );
  return Number(rows[0]?.total || 0);
}

async function countDepensesForCompte(userId, compteId) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM depense d
     INNER JOIN compte c ON c.id = d.compte_id
     WHERE d.compte_id = ? AND c.utilisateur_id = ?`,
    [compteId, userId],
  );
  return Number(rows[0]?.total || 0);
}

async function countRevenusForCompte(userId, compteId) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM revenu r
     INNER JOIN compte c ON c.id = r.compte_id
     WHERE r.compte_id = ? AND c.utilisateur_id = ?`,
    [compteId, userId],
  );
  return Number(rows[0]?.total || 0);
}

function getLimitForResource(abonnement, resource) {
  if (!abonnement) {
    return 0;
  }

  if (resource === QUOTA_RESOURCES.COMPTES) {
    return abonnement.limits.comptes;
  }

  if (resource === QUOTA_RESOURCES.DEPENSES) {
    return abonnement.limits.depensesParCompte;
  }

  if (resource === QUOTA_RESOURCES.REVENUS) {
    return abonnement.limits.revenusParCompte;
  }

  throw new Error(`Ressource de quota inconnue: ${resource}`);
}

function buildQuotaDecision({ abonnement, resource, used, message }) {
  const limit = getLimitForResource(abonnement, resource);
  const isUnlimited = limit === null;

  return {
    allowed: isUnlimited || used < limit,
    abonnement,
    resource,
    used,
    limit,
    isUnlimited,
    message,
  };
}

function buildUsageEntry(limit, used) {
  const isUnlimited = limit === null;

  return {
    used,
    limit,
    isUnlimited,
    remaining: isUnlimited ? null : Math.max(limit - used, 0),
  };
}

function toNumericIdList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(
    values
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];
}

function buildSelectionSet(selection) {
  return {
    accountIds: new Set(toNumericIdList(selection?.accountIds)),
    depenseIds: new Set(toNumericIdList(selection?.depenseIds)),
    revenuIds: new Set(toNumericIdList(selection?.revenuIds)),
  };
}

function buildOverageEntry(used, limit) {
  if (limit === null) {
    return {
      used,
      limit,
      overBy: 0,
      exceeds: false,
    };
  }

  return {
    used,
    limit,
    overBy: Math.max(used - limit, 0),
    exceeds: used > limit,
  };
}

function normalizeSelection(selection) {
  return {
    accountIds: toNumericIdList(selection?.accountIds),
    depenseIds: toNumericIdList(selection?.depenseIds),
    revenuIds: toNumericIdList(selection?.revenuIds),
  };
}

function buildProjectedState(accounts, targetPlan, selection) {
  const selected = buildSelectionSet(selection);

  const keptAccounts = accounts
    .filter((account) => !selected.accountIds.has(account.id))
    .map((account) => ({
      ...account,
      depenses: account.depenses.filter((depense) => !selected.depenseIds.has(depense.id)),
      revenus: account.revenus.filter((revenu) => !selected.revenuIds.has(revenu.id)),
    }));

  return {
    comptes: buildOverageEntry(keptAccounts.length, targetPlan?.limits?.comptes ?? null),
    perCompte: keptAccounts.map((account) => ({
      accountId: account.id,
      accountName: account.nom_court,
      depenses: buildOverageEntry(account.depenses.length, targetPlan?.limits?.depensesParCompte ?? null),
      revenus: buildOverageEntry(account.revenus.length, targetPlan?.limits?.revenusParCompte ?? null),
    })),
  };
}

function findRemainingOverages(projectedState) {
  return {
    comptes: projectedState.comptes,
    perCompte: projectedState.perCompte.filter((entry) => entry.depenses.exceeds || entry.revenus.exceeds),
  };
}

function isProjectedStateWithinLimits(projectedState) {
  return !projectedState.comptes.exceeds
    && projectedState.perCompte.every((entry) => !entry.depenses.exceeds && !entry.revenus.exceeds);
}

function buildRecommendation(accounts, targetPlan) {
  const recommended = {
    accountIds: [],
    depenseIds: [],
    revenuIds: [],
  };

  const accountLimit = targetPlan?.limits?.comptes ?? null;
  if (accountLimit !== null && accounts.length > accountLimit) {
    recommended.accountIds = accounts.slice(0, accounts.length - accountLimit).map((account) => account.id);
  }

  const keptAccounts = accounts.filter((account) => !recommended.accountIds.includes(account.id));
  const depensesLimit = targetPlan?.limits?.depensesParCompte ?? null;
  const revenusLimit = targetPlan?.limits?.revenusParCompte ?? null;

  keptAccounts.forEach((account) => {
    if (depensesLimit !== null && account.depenses.length > depensesLimit) {
      recommended.depenseIds.push(
        ...account.depenses.slice(0, account.depenses.length - depensesLimit).map((depense) => depense.id),
      );
    }

    if (revenusLimit !== null && account.revenus.length > revenusLimit) {
      recommended.revenuIds.push(
        ...account.revenus.slice(0, account.revenus.length - revenusLimit).map((revenu) => revenu.id),
      );
    }
  });

  return recommended;
}

async function getUserQuotaCleanupData(userId) {
  const db = await getPool();
  const [accountRows, depenseRows, revenuRows] = await Promise.all([
    db.execute(
      `SELECT id, nom_court, description, date_creation
       FROM compte
       WHERE utilisateur_id = ?
       ORDER BY date_creation DESC, id DESC`,
      [userId],
    ),
    db.execute(
      `SELECT d.id, d.compte_id, d.nom_court, d.montant, d.date_debut
       FROM depense d
       INNER JOIN compte c ON c.id = d.compte_id
       WHERE c.utilisateur_id = ?
       ORDER BY d.date_debut DESC, d.id DESC`,
      [userId],
    ),
    db.execute(
      `SELECT r.id, r.compte_id, r.nom_court, r.montant, r.date_debut
       FROM revenu r
       INNER JOIN compte c ON c.id = r.compte_id
       WHERE c.utilisateur_id = ?
       ORDER BY r.date_debut DESC, r.id DESC`,
      [userId],
    ),
  ]);

  const accounts = accountRows[0].map((row) => ({
    id: row.id,
    nom_court: row.nom_court,
    description: row.description,
    date_creation: row.date_creation,
    depenses: [],
    revenus: [],
  }));

  const accountMap = new Map(accounts.map((account) => [account.id, account]));

  depenseRows[0].forEach((row) => {
    const account = accountMap.get(row.compte_id);
    if (account) {
      account.depenses.push({
        id: row.id,
        compte_id: row.compte_id,
        nom_court: row.nom_court,
        montant: row.montant,
        date_debut: row.date_debut,
      });
    }
  });

  revenuRows[0].forEach((row) => {
    const account = accountMap.get(row.compte_id);
    if (account) {
      account.revenus.push({
        id: row.id,
        compte_id: row.compte_id,
        nom_court: row.nom_court,
        montant: row.montant,
        date_debut: row.date_debut,
      });
    }
  });

  return accounts;
}

async function getUserDowngradePreview(userId) {
  const [currentPlan, targetPlan, accounts] = await Promise.all([
    getUserAbonnement(userId),
    getAbonnementByCode(PLAN_CODES.FREE),
    getUserQuotaCleanupData(userId),
  ]);

  const recommendedSelection = buildRecommendation(accounts, targetPlan);
  const currentProjection = buildProjectedState(accounts, targetPlan, null);
  const recommendedProjection = buildProjectedState(accounts, targetPlan, recommendedSelection);

  return {
    currentPlan,
    targetPlan,
    accounts: accounts.map((account) => ({
      ...account,
      depensesCount: account.depenses.length,
      revenusCount: account.revenus.length,
    })),
    overages: findRemainingOverages(currentProjection),
    recommendedSelection,
    projectedAfterRecommendedSelection: recommendedProjection,
    canDowngradeWithoutDeletion: isProjectedStateWithinLimits(currentProjection),
  };
}

async function downgradeUserToFreeWithSelection(userId, selection) {
  const db = await getPool();
  const preview = await getUserDowngradePreview(userId);
  const normalizedSelection = normalizeSelection(selection);
  const projectedState = buildProjectedState(preview.accounts, preview.targetPlan, normalizedSelection);

  const accountIds = new Set(preview.accounts.map((account) => account.id));
  const depenseIds = new Set(preview.accounts.flatMap((account) => account.depenses.map((depense) => depense.id)));
  const revenuIds = new Set(preview.accounts.flatMap((account) => account.revenus.map((revenu) => revenu.id)));

  const invalidSelection = normalizedSelection.accountIds.some((id) => !accountIds.has(id))
    || normalizedSelection.depenseIds.some((id) => !depenseIds.has(id))
    || normalizedSelection.revenuIds.some((id) => !revenuIds.has(id));

  if (invalidSelection) {
    const error = new Error('La sélection de suppression est invalide.');
    error.statusCode = 400;
    throw error;
  }

  if (!isProjectedStateWithinLimits(projectedState)) {
    const error = new Error('Vous devez supprimer suffisamment d’éléments pour respecter les quotas du plan gratuit.');
    error.statusCode = 409;
    error.details = {
      preview,
      projectedState,
      remainingOverages: findRemainingOverages(projectedState),
    };
    throw error;
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    if (normalizedSelection.depenseIds.length > 0) {
      await connection.query('DELETE FROM depense WHERE id IN (?)', [normalizedSelection.depenseIds]);
    }

    if (normalizedSelection.revenuIds.length > 0) {
      await connection.query('DELETE FROM revenu WHERE id IN (?)', [normalizedSelection.revenuIds]);
    }

    if (normalizedSelection.accountIds.length > 0) {
      await connection.query('DELETE FROM depense WHERE compte_id IN (?)', [normalizedSelection.accountIds]);
      await connection.query('DELETE FROM revenu WHERE compte_id IN (?)', [normalizedSelection.accountIds]);
      await connection.query('DELETE FROM compte WHERE id IN (?) AND utilisateur_id = ?', [normalizedSelection.accountIds, userId]);
    }

    await connection.query(
      `UPDATE utilisateur u
       INNER JOIN abonnement a ON a.code = ? AND a.actif = TRUE
       SET u.abonnement_id = a.id
       WHERE u.id = ?`,
      [PLAN_CODES.FREE, userId],
    );

    await connection.commit();
    return preview.targetPlan;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function canCreateCompte(userId) {
  const [abonnement, used] = await Promise.all([
    getUserAbonnement(userId),
    countComptesForUser(userId),
  ]);

  return buildQuotaDecision({
    abonnement,
    resource: QUOTA_RESOURCES.COMPTES,
    used,
    message: 'Limite atteinte. Passez à un abonnement premium pour créer plus de comptes.',
  });
}

async function canCreateDepense(userId, compteId) {
  const [abonnement, used] = await Promise.all([
    getUserAbonnement(userId),
    countDepensesForCompte(userId, compteId),
  ]);

  return buildQuotaDecision({
    abonnement,
    resource: QUOTA_RESOURCES.DEPENSES,
    used,
    message: 'Limite atteinte. Passez à un abonnement premium pour créer plus de dépenses sur ce compte.',
  });
}

async function canCreateRevenu(userId, compteId) {
  const [abonnement, used] = await Promise.all([
    getUserAbonnement(userId),
    countRevenusForCompte(userId, compteId),
  ]);

  return buildQuotaDecision({
    abonnement,
    resource: QUOTA_RESOURCES.REVENUS,
    used,
    message: 'Limite atteinte. Passez à un abonnement premium pour créer plus de revenus sur ce compte.',
  });
}

async function getUserAbonnementStatus(userId) {
  const db = await getPool();
  const abonnement = await getUserAbonnement(userId);

  const [comptesCountRows, comptesDetailsRows] = await Promise.all([
    db.execute('SELECT COUNT(*) AS total FROM compte WHERE utilisateur_id = ?', [userId]),
    db.execute(
      `SELECT
        c.id,
        c.nom_court,
        COUNT(DISTINCT d.id) AS depenses_total,
        COUNT(DISTINCT r.id) AS revenus_total
       FROM compte c
       LEFT JOIN depense d ON d.compte_id = c.id
       LEFT JOIN revenu r ON r.compte_id = c.id
       WHERE c.utilisateur_id = ?
       GROUP BY c.id, c.nom_court
       ORDER BY c.date_creation DESC, c.id DESC`,
      [userId],
    ),
  ]);

  const comptesUsed = Number(comptesCountRows[0][0]?.total || 0);
  const comptesLimit = abonnement?.limits.comptes ?? null;
  const depensesLimit = abonnement?.limits.depensesParCompte ?? null;
  const revenusLimit = abonnement?.limits.revenusParCompte ?? null;

  return {
    abonnement,
    usage: {
      comptes: buildUsageEntry(comptesLimit, comptesUsed),
      comptesDetails: comptesDetailsRows[0].map((row) => ({
        id: row.id,
        nom_court: row.nom_court,
        depenses: buildUsageEntry(depensesLimit, Number(row.depenses_total || 0)),
        revenus: buildUsageEntry(revenusLimit, Number(row.revenus_total || 0)),
      })),
    },
  };
}

module.exports = {
  PLAN_CODES,
  QUOTA_RESOURCES,
  getAbonnementByCode,
  getUserAbonnement,
  getUserAbonnementStatus,
  getUserDowngradePreview,
  assignPlanToUser,
  downgradeUserToFreeWithSelection,
  canCreateCompte,
  canCreateDepense,
  canCreateRevenu,
};
