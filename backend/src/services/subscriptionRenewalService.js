const { getPool } = require('../config/database');
const {
  ETH_CHAIN_ID,
  ETH_NETWORK_NAME,
  RENEWAL_MODES,
  RENEWAL_PROVIDERS,
  RENEWAL_STATUSES,
} = require('./subscriptionConstants');

function formatRenewalSettings(row) {
  if (!row) {
    return {
      provider: RENEWAL_PROVIDERS.ETHEREUM_WALLET,
      mode: RENEWAL_MODES.MANUAL,
      status: RENEWAL_STATUSES.DISABLED,
      walletAddress: null,
      chainId: ETH_CHAIN_ID,
      network: ETH_NETWORK_NAME,
      smartContractAddress: null,
      mandateReference: null,
      nextRenewalAt: null,
      lastRenewalAttemptAt: null,
      lastPaymentId: null,
      lastTransactionHash: null,
      failureReason: null,
      autoRenewalReady: false,
      autoRenewalAvailable: false,
    };
  }

  const status = row.status || RENEWAL_STATUSES.DISABLED;
  const mode = row.mode || RENEWAL_MODES.MANUAL;

  return {
    provider: row.provider || RENEWAL_PROVIDERS.ETHEREUM_WALLET,
    mode,
    status,
    walletAddress: row.wallet_address || null,
    chainId: row.chain_id ? Number(row.chain_id) : ETH_CHAIN_ID,
    network: row.network || ETH_NETWORK_NAME,
    smartContractAddress: row.smart_contract_address || null,
    mandateReference: row.mandate_reference || null,
    nextRenewalAt: row.next_renewal_at || null,
    lastRenewalAttemptAt: row.last_renewal_attempt_at || null,
    lastPaymentId: row.last_payment_id ? Number(row.last_payment_id) : null,
    lastTransactionHash: row.last_transaction_hash || null,
    failureReason: row.failure_reason || null,
    autoRenewalReady: mode === RENEWAL_MODES.AUTOMATIC && status === RENEWAL_STATUSES.ACTIVE,
    autoRenewalAvailable: false,
  };
}

async function ensureRenewalSettingsRow(userId, executor = null) {
  const db = executor || await getPool();
  await db.execute(
    `INSERT INTO abonnement_renouvellement (
      utilisateur_id,
      provider,
      mode,
      status,
      chain_id,
      network
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE utilisateur_id = utilisateur_id`,
    [
      userId,
      RENEWAL_PROVIDERS.ETHEREUM_WALLET,
      RENEWAL_MODES.MANUAL,
      RENEWAL_STATUSES.DISABLED,
      ETH_CHAIN_ID,
      ETH_NETWORK_NAME,
    ],
  );
}

async function getRenewalSettingsForUser(userId, executor = null) {
  const db = executor || await getPool();
  await ensureRenewalSettingsRow(userId, db);
  const [rows] = await db.execute(
    'SELECT * FROM abonnement_renouvellement WHERE utilisateur_id = ? LIMIT 1',
    [userId],
  );
  return formatRenewalSettings(rows[0]);
}

async function updateRenewalPaymentContext(
  userId,
  {
    executor = null,
    walletAddress = null,
    nextRenewalAt = null,
    lastPaymentId = null,
    lastTransactionHash = null,
  } = {},
) {
  const db = executor || await getPool();
  await ensureRenewalSettingsRow(userId, db);
  await db.execute(
    `UPDATE abonnement_renouvellement
     SET provider = ?,
         mode = ?,
         status = ?,
         wallet_address = COALESCE(?, wallet_address),
         chain_id = ?,
         network = ?,
         next_renewal_at = ?,
         last_payment_id = ?,
         last_transaction_hash = ?,
         failure_reason = NULL
     WHERE utilisateur_id = ?`,
    [
      RENEWAL_PROVIDERS.ETHEREUM_WALLET,
      RENEWAL_MODES.MANUAL,
      RENEWAL_STATUSES.DISABLED,
      walletAddress,
      ETH_CHAIN_ID,
      ETH_NETWORK_NAME,
      nextRenewalAt,
      lastPaymentId,
      lastTransactionHash,
      userId,
    ],
  );
}

async function updateRenewalSettingsForUser(
  userId,
  {
    mode = RENEWAL_MODES.MANUAL,
    walletAddress = null,
    smartContractAddress = null,
    mandateReference = null,
    executor = null,
  } = {},
) {
  const db = executor || await getPool();
  const normalizedMode = mode === RENEWAL_MODES.AUTOMATIC ? RENEWAL_MODES.AUTOMATIC : RENEWAL_MODES.MANUAL;
  const nextStatus = normalizedMode === RENEWAL_MODES.AUTOMATIC
    ? RENEWAL_STATUSES.PENDING_SETUP
    : RENEWAL_STATUSES.DISABLED;

  await ensureRenewalSettingsRow(userId, db);
  await db.execute(
    `UPDATE abonnement_renouvellement
     SET provider = ?,
         mode = ?,
         status = ?,
         wallet_address = COALESCE(?, wallet_address),
         chain_id = ?,
         network = ?,
         smart_contract_address = ?,
         mandate_reference = ?,
         failure_reason = NULL
     WHERE utilisateur_id = ?`,
    [
      RENEWAL_PROVIDERS.ETHEREUM_WALLET,
      normalizedMode,
      nextStatus,
      walletAddress,
      ETH_CHAIN_ID,
      ETH_NETWORK_NAME,
      smartContractAddress,
      mandateReference,
      userId,
    ],
  );

  return getRenewalSettingsForUser(userId, db);
}

async function markRenewalPausedForCancellation(userId, executor = null) {
  const db = executor || await getPool();
  await ensureRenewalSettingsRow(userId, db);
  await db.execute(
    `UPDATE abonnement_renouvellement
     SET status = CASE
       WHEN mode = ? THEN ?
       ELSE status
     END,
         next_renewal_at = NULL,
         failure_reason = NULL
     WHERE utilisateur_id = ?`,
    [RENEWAL_MODES.AUTOMATIC, RENEWAL_STATUSES.PAUSED, userId],
  );
}

module.exports = {
  ensureRenewalSettingsRow,
  formatRenewalSettings,
  getRenewalSettingsForUser,
  markRenewalPausedForCancellation,
  updateRenewalPaymentContext,
  updateRenewalSettingsForUser,
};
