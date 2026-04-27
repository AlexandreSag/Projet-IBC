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
  getUserAbonnement,
  getUserAbonnementStatus,
  canCreateCompte,
  canCreateDepense,
  canCreateRevenu,
};
