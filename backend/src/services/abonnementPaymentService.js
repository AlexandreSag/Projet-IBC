const { getPool } = require('../config/database');
const abonnementService = require('./abonnementService');
const subscriptionLifecycleService = require('./subscriptionLifecycleService');
const { PLAN_CODES } = require('./subscriptionConstants');

const PAYMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  EXPIRED: 'expired',
};

const ETHEREUM_PAYMENT = {
  cryptoCode: 'eth',
  network: 'ethereum',
  fallbackAmountForPremium: Number(process.env.ETH_PREMIUM_FALLBACK_AMOUNT || 0.0034),
};

const PAYMENT_INTENT_TTL_HOURS = Number(process.env.PAYMENT_INTENT_TTL_HOURS || 24);
const ETH_RPC_URL = process.env.ETH_RPC_URL || 'http://anvil:8545';
const ETH_EUR_RATE_API_URL = process.env.ETH_EUR_RATE_API_URL || 'https://api.coinbase.com/v2/prices/ETH-EUR/spot';
const ETH_EUR_RATE_CACHE_TTL_MS = Number(process.env.ETH_EUR_RATE_CACHE_TTL_MS || 300000);

let cachedEthEurRate = null;
let cachedEthEurRateExpiresAt = 0;

function normalizeCryptoCode(value) {
  return String(value || ETHEREUM_PAYMENT.cryptoCode).trim().toLowerCase();
}

function getWalletAddressForPlan(plan) {
  return process.env.ETH_WALLET_ADDRESS || plan?.wallet_address || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
}

function buildExpiresAt() {
  return new Date(Date.now() + PAYMENT_INTENT_TTL_HOURS * 60 * 60 * 1000);
}

function roundUpToDecimals(value, decimals = 8) {
  const factor = 10 ** decimals;
  return Math.ceil(Number(value) * factor) / factor;
}

function normalizeAddress(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeTransactionHash(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized.startsWith('0x') ? normalized : `0x${normalized}`;
}

function decimalToWei(value) {
  const [wholePartRaw, fractionPartRaw = ''] = String(value ?? '0').trim().split('.');
  const wholePart = wholePartRaw.replace(/\D/g, '') || '0';
  const fractionDigits = fractionPartRaw.replace(/\D/g, '').slice(0, 18).padEnd(18, '0');
  return BigInt(wholePart) * (10n ** 18n) + BigInt(fractionDigits || '0');
}

function parseEthEurRatePayload(payload) {
  const directCandidates = [
    payload?.data?.amount,
    payload?.amount,
    payload?.price,
    payload?.ethereum?.eur,
  ];

  for (const candidate of directCandidates) {
    const amount = Number(candidate);
    if (Number.isFinite(amount) && amount > 0) {
      return amount;
    }
  }

  return null;
}

async function fetchEthEurRate() {
  const now = Date.now();
  if (cachedEthEurRate && cachedEthEurRateExpiresAt > now) {
    return cachedEthEurRate;
  }

  const response = await fetch(ETH_EUR_RATE_API_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error('Impossible de récupérer le taux ETH/EUR.');
  }

  const payload = await response.json();
  const rate = parseEthEurRatePayload(payload);

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Réponse de taux ETH/EUR invalide.');
  }

  cachedEthEurRate = rate;
  cachedEthEurRateExpiresAt = now + ETH_EUR_RATE_CACHE_TTL_MS;
  return rate;
}

async function resolvePremiumEthAmount(montantEur) {
  const eurAmount = Number(montantEur);
  if (!Number.isFinite(eurAmount) || eurAmount <= 0) {
    return ETHEREUM_PAYMENT.fallbackAmountForPremium;
  }

  try {
    const ethEurRate = await fetchEthEurRate();
    const computedAmount = roundUpToDecimals(eurAmount / ethEurRate, 8);
    if (Number.isFinite(computedAmount) && computedAmount > 0) {
      return computedAmount;
    }
  } catch (error) {
    console.warn('[abonnementPaymentService] Fallback montant ETH premium:', error.message);
  }

  return ETHEREUM_PAYMENT.fallbackAmountForPremium;
}

async function rpcRequest(method, params = []) {
  const response = await fetch(ETH_RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    const error = new Error('Impossible de joindre le noeud Ethereum de test.');
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();
  if (data?.error) {
    const error = new Error(data.error.message || 'Erreur RPC Ethereum.');
    error.statusCode = 502;
    throw error;
  }

  return data?.result ?? null;
}

function formatPaymentIntent(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    utilisateurId: row.utilisateur_id,
    abonnementId: row.abonnement_id,
    planCode: row.plan_code,
    montantEur: Number(row.montant_eur),
    cryptoCode: row.crypto_code,
    montantCrypto: Number(row.montant_crypto),
    network: row.network,
    walletAddress: row.wallet_address,
    status: row.status,
    transactionHash: row.transaction_hash,
    expiresAt: row.expires_at,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getPaymentIntentRowByIdForUser(userId, paymentIntentId) {
  const db = await getPool();
  const [rows] = await db.execute(
    'SELECT * FROM abonnement_paiement WHERE id = ? AND utilisateur_id = ? LIMIT 1',
    [paymentIntentId, userId],
  );

  return rows[0] || null;
}

async function markPaymentIntentAsExpired(paymentIntentId) {
  const db = await getPool();
  await db.execute(
    `UPDATE abonnement_paiement
     SET status = ?
     WHERE id = ? AND status = ?`,
    [PAYMENT_STATUS.EXPIRED, paymentIntentId, PAYMENT_STATUS.PENDING],
  );
}

async function getPaymentIntentForUser(userId, paymentIntentId) {
  const row = await getPaymentIntentRowByIdForUser(userId, paymentIntentId);

  if (!row) {
    const error = new Error('Demande de paiement introuvable.');
    error.statusCode = 404;
    throw error;
  }

  if (row.status === PAYMENT_STATUS.PENDING && row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    await markPaymentIntentAsExpired(row.id);
    row.status = PAYMENT_STATUS.EXPIRED;
  }

  return formatPaymentIntent(row);
}

async function listPaymentsForUser(userId, { limit = 20 } = {}) {
  const db = await getPool();
  const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const [rows] = await db.execute(
    `SELECT *
     FROM abonnement_paiement
     WHERE utilisateur_id = ?
     ORDER BY created_at DESC
     LIMIT ${normalizedLimit}`,
    [userId],
  );

  return rows.map((row) => formatPaymentIntent(row));
}

async function getLatestOpenPaymentIntentForUser(userId) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT *
     FROM abonnement_paiement
     WHERE utilisateur_id = ?
       AND status = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, PAYMENT_STATUS.PENDING],
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    await markPaymentIntentAsExpired(row.id);
    return null;
  }

  return formatPaymentIntent(row);
}

async function createPaymentIntentForUser(userId, { planCode, cryptoCode } = {}) {
  const normalizedPlanCode = String(planCode || PLAN_CODES.PREMIUM).trim().toLowerCase();
  const normalizedCryptoCode = normalizeCryptoCode(cryptoCode);

  if (normalizedCryptoCode !== ETHEREUM_PAYMENT.cryptoCode) {
    const error = new Error('Ethereum est la seule crypto supportée pour le moment.');
    error.statusCode = 400;
    throw error;
  }

  const plan = await abonnementService.getAbonnementByCode(normalizedPlanCode);
  if (!plan) {
    const error = new Error('Plan introuvable.');
    error.statusCode = 404;
    throw error;
  }

  if (plan.isFree) {
    const error = new Error('Le plan gratuit ne nécessite pas de paiement.');
    error.statusCode = 400;
    throw error;
  }

  const walletAddress = getWalletAddressForPlan(plan);
  const db = await getPool();
  const expiresAt = buildExpiresAt();
  const montantEur = Number(plan.prix || 0);
  const montantCrypto = await resolvePremiumEthAmount(montantEur);

  const [result] = await db.execute(
    `INSERT INTO abonnement_paiement (
      utilisateur_id,
      abonnement_id,
      plan_code,
      montant_eur,
      crypto_code,
      montant_crypto,
      network,
      wallet_address,
      status,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      plan.id,
      plan.code,
      montantEur,
      normalizedCryptoCode,
      montantCrypto,
      ETHEREUM_PAYMENT.network,
      walletAddress,
      PAYMENT_STATUS.PENDING,
      expiresAt,
    ],
  );

  const [rows] = await db.execute(
    'SELECT * FROM abonnement_paiement WHERE id = ? AND utilisateur_id = ? LIMIT 1',
    [result.insertId, userId],
  );

  return {
    paymentIntent: formatPaymentIntent(rows[0]),
    plan,
  };
}

async function confirmPaymentIntentForUser(userId, paymentIntentId, transactionHash) {
  const row = await getPaymentIntentRowByIdForUser(userId, paymentIntentId);

  if (!row) {
    const error = new Error('Demande de paiement introuvable.');
    error.statusCode = 404;
    throw error;
  }

  if (row.status === PAYMENT_STATUS.PENDING && row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    await markPaymentIntentAsExpired(row.id);
    const error = new Error('La demande de paiement a expiré.');
    error.statusCode = 410;
    throw error;
  }

  if (row.status === PAYMENT_STATUS.CONFIRMED) {
    return {
      paymentIntent: formatPaymentIntent(row),
      plan: await abonnementService.getAbonnementByCode(row.plan_code),
      alreadyConfirmed: true,
    };
  }

  if (row.status !== PAYMENT_STATUS.PENDING) {
    const error = new Error('Cette demande de paiement n’est plus confirmable.');
    error.statusCode = 409;
    throw error;
  }

  const normalizedHash = normalizeTransactionHash(transactionHash);
  const transaction = await rpcRequest('eth_getTransactionByHash', [normalizedHash]);

  if (!transaction) {
    const error = new Error('Transaction Ethereum introuvable.');
    error.statusCode = 404;
    throw error;
  }

  const receipt = await rpcRequest('eth_getTransactionReceipt', [normalizedHash]);
  if (!receipt || !receipt.blockHash) {
    const error = new Error('La transaction Ethereum n’est pas encore confirmée.');
    error.statusCode = 409;
    throw error;
  }

  if (receipt.status !== '0x1') {
    const db = await getPool();
    await db.execute(
      `UPDATE abonnement_paiement
       SET status = ?, transaction_hash = ?
       WHERE id = ? AND utilisateur_id = ?`,
      [PAYMENT_STATUS.FAILED, normalizedHash, row.id, userId],
    );

    const error = new Error('La transaction Ethereum a échoué.');
    error.statusCode = 422;
    throw error;
  }

  const targetAddress = normalizeAddress(transaction.to);
  const expectedAddress = normalizeAddress(row.wallet_address);
  if (!targetAddress || targetAddress !== expectedAddress) {
    const error = new Error('La transaction n’a pas été envoyée vers la bonne adresse Ethereum.');
    error.statusCode = 422;
    throw error;
  }

  const expectedWei = decimalToWei(row.montant_crypto);
  const sentWei = BigInt(transaction.value || '0x0');
  if (sentWei < expectedWei) {
    const error = new Error('Le montant envoyé est insuffisant pour activer le Premium.');
    error.statusCode = 422;
    throw error;
  }

  const db = await getPool();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE abonnement_paiement
       SET status = ?, transaction_hash = ?, confirmed_at = NOW()
       WHERE id = ? AND utilisateur_id = ?`,
      [PAYMENT_STATUS.CONFIRMED, normalizedHash, row.id, userId],
    );
    await subscriptionLifecycleService.activatePremiumPlan(userId, {
      planId: row.abonnement_id,
      walletAddress: transaction.from || null,
      lastPaymentId: row.id,
      lastTransactionHash: normalizedHash,
      executor: connection,
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const refreshedRow = await getPaymentIntentRowByIdForUser(userId, paymentIntentId);

  return {
    paymentIntent: formatPaymentIntent(refreshedRow),
    plan: await abonnementService.getAbonnementByCode(row.plan_code),
    alreadyConfirmed: false,
  };
}

module.exports = {
  PAYMENT_STATUS,
  confirmPaymentIntentForUser,
  createPaymentIntentForUser,
  formatPaymentIntent,
  getPaymentIntentForUser,
  getLatestOpenPaymentIntentForUser,
  listPaymentsForUser,
};
