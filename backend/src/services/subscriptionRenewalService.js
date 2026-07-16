const { getPool } = require('../config/database');
const { createPublicClient, http } = require('viem');
const {
  AUTO_RENEW_APPROVAL_MONTHS,
  BILLING_PERIOD_DAYS,
  ETH_CHAIN_ID,
  ETH_NETWORK_NAME,
  RENEWAL_MODES,
  RENEWAL_PROVIDERS,
  RENEWAL_STATUSES,
  SUBSCRIPTION_CORE_ADDRESS,
  USDC_MONTHLY_PRICE_UNITS,
  USDC_TOKEN_ADDRESS,
  USDC_TOKEN_DECIMALS,
  USDC_TOKEN_SYMBOL,
} = require('./subscriptionConstants');

const ETH_RPC_URL = process.env.ETH_RPC_URL || 'http://anvil:8545';

const subscriptionCoreReadAbi = [
  {
    type: 'function',
    name: 'autoRenewConfigs',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'enabled', type: 'bool' },
      { name: 'maxTokenAmountPerCharge', type: 'uint256' },
      { name: 'nextChargeAt', type: 'uint256' },
      { name: 'paidUntil', type: 'uint256' },
    ],
  },
];

const stableTokenReadAbi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

function normalizeAddress(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveConfiguredContractAddress(candidate = null) {
  if (!SUBSCRIPTION_CORE_ADDRESS) {
    const error = new Error('SubscriptionCore non configuré.');
    error.statusCode = 409;
    throw error;
  }

  if (candidate && normalizeAddress(candidate) !== normalizeAddress(SUBSCRIPTION_CORE_ADDRESS)) {
    const error = new Error('Adresse de contrat invalide.');
    error.statusCode = 400;
    throw error;
  }

  return SUBSCRIPTION_CORE_ADDRESS;
}

function buildRenewalConfig() {
  const autoRenewalAvailable = Boolean(SUBSCRIPTION_CORE_ADDRESS && USDC_TOKEN_ADDRESS);

  return {
    autoRenewalAvailable,
    subscriptionCoreAddress: SUBSCRIPTION_CORE_ADDRESS,
    tokenAddress: USDC_TOKEN_ADDRESS,
    tokenSymbol: USDC_TOKEN_SYMBOL,
    tokenDecimals: USDC_TOKEN_DECIMALS,
    monthlyPriceUnits: USDC_MONTHLY_PRICE_UNITS.toString(),
    approvalMonths: AUTO_RENEW_APPROVAL_MONTHS,
    billingPeriodDays: BILLING_PERIOD_DAYS,
  };
}

function buildPublicClient() {
  return createPublicClient({
    chain: {
      id: ETH_CHAIN_ID,
      name: ETH_NETWORK_NAME,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [ETH_RPC_URL] } },
    },
    transport: http(ETH_RPC_URL),
  });
}

function timestampToSqlDateTime(timestamp) {
  if (!timestamp) {
    return null;
  }

  const date = new Date(Number(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatRenewalSettings(row) {
  const config = buildRenewalConfig();

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
      autoRenewalAvailable: config.autoRenewalAvailable,
      config,
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
    autoRenewalAvailable: config.autoRenewalAvailable,
    config,
  };
}

async function ensureRenewalSettingsRow(userId, executor = null) {
  const db = executor || await getPool();
  // La ligne est créée si besoin sans écraser une configuration existante.
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
  const config = buildRenewalConfig();
  const contractAddress = config.autoRenewalAvailable
    ? resolveConfiguredContractAddress(smartContractAddress)
    : null;

  if (normalizedMode === RENEWAL_MODES.AUTOMATIC && !config.autoRenewalAvailable) {
    const error = new Error('Auto-renew USDC indisponible.');
    error.statusCode = 409;
    throw error;
  }

  if (normalizedMode === RENEWAL_MODES.MANUAL && config.autoRenewalAvailable) {
    const current = await getRenewalSettingsForUser(userId, db);
    if (current.mode === RENEWAL_MODES.AUTOMATIC && current.walletAddress) {
      const onchain = await getOnchainAutoRenewState({ walletAddress: current.walletAddress });
      if (onchain && (onchain.enabled || BigInt(onchain.allowance || '0') > 0n)) {
        const error = new Error('Révoquez d’abord l’autorisation USDC dans votre wallet.');
        error.statusCode = 409;
        throw error;
      }
    }
  }

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
      contractAddress,
      mandateReference,
      userId,
    ],
  );

  return getRenewalSettingsForUser(userId, db);
}

async function activateRenewalSettingsForUser(
  userId,
  {
    walletAddress,
    smartContractAddress = null,
    mandateReference = null,
    executor = null,
  } = {},
) {
  const db = executor || await getPool();
  const config = buildRenewalConfig();

  if (!config.autoRenewalAvailable) {
    const error = new Error('Auto-renew USDC indisponible.');
    error.statusCode = 409;
    throw error;
  }

  if (!walletAddress) {
    const error = new Error('Adresse wallet requise.');
    error.statusCode = 400;
    throw error;
  }

  const contractAddress = resolveConfiguredContractAddress(smartContractAddress);
  const onchain = await getOnchainAutoRenewState({ walletAddress });
  if (
    !onchain?.enabled
    || BigInt(onchain.maxTokenAmountPerCharge || '0') < USDC_MONTHLY_PRICE_UNITS
    || BigInt(onchain.allowance || '0') < USDC_MONTHLY_PRICE_UNITS
  ) {
    const error = new Error('Le renouvellement USDC n’est pas correctement autorisé.');
    error.statusCode = 409;
    throw error;
  }

  const [rows] = await db.execute(
    'SELECT premium_expires_at FROM utilisateur WHERE id = ? LIMIT 1',
    [userId],
  );
  const premiumExpiresAt = rows[0]?.premium_expires_at || null;

  if (!premiumExpiresAt) {
    const error = new Error('Premium actif requis.');
    error.statusCode = 409;
    throw error;
  }

  await ensureRenewalSettingsRow(userId, db);
  await db.execute(
    `UPDATE abonnement_renouvellement
     SET provider = ?,
         mode = ?,
         status = ?,
         wallet_address = ?,
         chain_id = ?,
         network = ?,
         smart_contract_address = ?,
         mandate_reference = ?,
         next_renewal_at = ?,
         failure_reason = NULL
     WHERE utilisateur_id = ?`,
    [
      RENEWAL_PROVIDERS.ETHEREUM_WALLET,
      RENEWAL_MODES.AUTOMATIC,
      RENEWAL_STATUSES.ACTIVE,
      walletAddress,
      ETH_CHAIN_ID,
      ETH_NETWORK_NAME,
      contractAddress,
      mandateReference,
      premiumExpiresAt,
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

async function getOnchainAutoRenewState({
  walletAddress,
  smartContractAddress = null,
} = {}) {
  if (!walletAddress || !SUBSCRIPTION_CORE_ADDRESS || !USDC_TOKEN_ADDRESS) {
    return null;
  }

  const contractAddress = resolveConfiguredContractAddress(smartContractAddress);

  const client = buildPublicClient();
  const bytecode = await client.getBytecode({ address: contractAddress });
  if (!bytecode || bytecode === '0x') {
    return null;
  }

  const [autoRenewConfig, allowance] = await Promise.all([
    client.readContract({
      address: contractAddress,
      abi: subscriptionCoreReadAbi,
      functionName: 'autoRenewConfigs',
      args: [walletAddress],
    }),
    client.readContract({
      address: USDC_TOKEN_ADDRESS,
      abi: stableTokenReadAbi,
      functionName: 'allowance',
      args: [walletAddress, contractAddress],
    }),
  ]);
  const [enabled, maxTokenAmountPerCharge, nextChargeAt, paidUntil] = autoRenewConfig;

  return {
    enabled: Boolean(enabled),
    maxTokenAmountPerCharge: maxTokenAmountPerCharge ? maxTokenAmountPerCharge.toString() : '0',
    allowance: allowance ? allowance.toString() : '0',
    nextChargeAt: Number(nextChargeAt || 0),
    paidUntil: Number(paidUntil || 0),
    nextChargeAtDate: timestampToSqlDateTime(nextChargeAt),
    paidUntilDate: timestampToSqlDateTime(paidUntil),
  };
}

async function syncRenewalCoverageFromChain(userId, executor = null) {
  const db = executor || await getPool();
  await ensureRenewalSettingsRow(userId, db);

  const [rows] = await db.execute(
    `SELECT
       r.wallet_address,
       r.smart_contract_address,
       r.mode,
       r.status
     FROM abonnement_renouvellement r
     WHERE r.utilisateur_id = ?
     LIMIT 1`,
    [userId],
  );

  const row = rows[0];
  if (!row?.wallet_address || row.mode !== RENEWAL_MODES.AUTOMATIC) {
    return null;
  }

  const onchain = await getOnchainAutoRenewState({
    walletAddress: row.wallet_address,
  });

  if (!onchain?.enabled || !onchain.paidUntilDate) {
    return onchain;
  }

  await db.execute(
    `UPDATE utilisateur
     SET abonnement_id = (
       SELECT id FROM abonnement WHERE code = 'premium' LIMIT 1
     ),
         premium_expires_at = ?,
         premium_cancel_at_period_end = FALSE,
         quota_cleanup_required = FALSE
     WHERE id = ?`,
    [onchain.paidUntilDate, userId],
  );

  await db.execute(
    `UPDATE abonnement_renouvellement
     SET status = ?,
         next_renewal_at = ?,
         failure_reason = NULL
     WHERE utilisateur_id = ?`,
    [RENEWAL_STATUSES.ACTIVE, onchain.paidUntilDate, userId],
  );

  return onchain;
}

module.exports = {
  activateRenewalSettingsForUser,
  ensureRenewalSettingsRow,
  formatRenewalSettings,
  getOnchainAutoRenewState,
  getRenewalSettingsForUser,
  markRenewalPausedForCancellation,
  resolveConfiguredContractAddress,
  syncRenewalCoverageFromChain,
  updateRenewalPaymentContext,
  updateRenewalSettingsForUser,
};
