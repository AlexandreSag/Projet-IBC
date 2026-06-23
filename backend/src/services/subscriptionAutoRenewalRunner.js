const { createPublicClient, createWalletClient, formatUnits, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { getPool } = require('../config/database');
const abonnementService = require('./abonnementService');
const subscriptionRenewalService = require('./subscriptionRenewalService');
const {
  ETH_CHAIN_ID,
  ETH_NETWORK_NAME,
  PLAN_CODES,
  RENEWAL_STATUSES,
  SUBSCRIPTION_CORE_ADDRESS,
  USDC_MONTHLY_PRICE_UNITS,
  USDC_TOKEN_ADDRESS,
  USDC_TOKEN_DECIMALS,
  USDC_TOKEN_SYMBOL,
} = require('./subscriptionConstants');

const AUTO_RENEW_RUNNER_ENABLED = String(process.env.AUTO_RENEW_RUNNER_ENABLED || 'true') !== 'false';
const AUTO_RENEW_RUNNER_INTERVAL_MS = Number(process.env.AUTO_RENEW_RUNNER_INTERVAL_MS || 60000);
const AUTO_RENEW_RUNNER_BATCH_SIZE = Number(process.env.AUTO_RENEW_RUNNER_BATCH_SIZE || 20);
const AUTO_RENEW_RUNNER_PRIVATE_KEY = process.env.AUTO_RENEW_RUNNER_PRIVATE_KEY
  || process.env.ANVIL_DEPLOYER_PRIVATE_KEY
  || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ETH_RPC_URL = process.env.ETH_RPC_URL || 'http://anvil:8545';

const subscriptionCoreAbi = [
  {
    type: 'function',
    name: 'chargeAutoRenew',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subscriber', type: 'address' }],
    outputs: [],
  },
];

let intervalHandle = null;
let isRunning = false;

function getRunnerConfig() {
  return {
    enabled: AUTO_RENEW_RUNNER_ENABLED,
    configured: Boolean(SUBSCRIPTION_CORE_ADDRESS && USDC_TOKEN_ADDRESS && AUTO_RENEW_RUNNER_PRIVATE_KEY),
  };
}

function buildClients() {
  const account = privateKeyToAccount(AUTO_RENEW_RUNNER_PRIVATE_KEY);
  const chain = {
    id: ETH_CHAIN_ID,
    name: ETH_NETWORK_NAME,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [ETH_RPC_URL] } },
  };

  return {
    account,
    publicClient: createPublicClient({
      chain,
      transport: http(ETH_RPC_URL),
    }),
    walletClient: createWalletClient({
      account,
      chain,
      transport: http(ETH_RPC_URL),
    }),
  };
}

function normalizeErrorMessage(error) {
  return String(error?.shortMessage || error?.message || 'Erreur de renouvellement automatique.')
    .slice(0, 255);
}

function isChargeNotDueError(error) {
  const message = String(error?.shortMessage || error?.message || error?.details || '');
  const reason = String(error?.reason || '');
  return message.includes('Charge not due') || reason.includes('Charge not due');
}

function tokenUnitsToDecimal(units) {
  return Number(formatUnits(BigInt(units), USDC_TOKEN_DECIMALS));
}

async function assertContractDeployed(publicClient, address, label = 'contrat') {
  const bytecode = await publicClient.getBytecode({ address });
  if (!bytecode || bytecode === '0x') {
    const error = new Error(`${label} ${address} non déployé sur ce fork.`);
    error.statusCode = 409;
    throw error;
  }
}

async function listDueRenewals(limit = AUTO_RENEW_RUNNER_BATCH_SIZE) {
  const db = await getPool();
  const normalizedLimit = Math.min(Math.max(Number(limit) || AUTO_RENEW_RUNNER_BATCH_SIZE, 1), 100);
  const [rows] = await db.execute(
    `SELECT
       r.id,
       r.utilisateur_id,
       r.wallet_address,
       r.smart_contract_address,
       r.next_renewal_at,
       u.abonnement_id,
       u.premium_expires_at,
       a.code AS plan_code,
       a.id AS plan_id,
       a.prix AS plan_price_eur
     FROM abonnement_renouvellement r
     INNER JOIN utilisateur u ON u.id = r.utilisateur_id
     INNER JOIN abonnement a ON a.id = u.abonnement_id
     WHERE r.mode = 'automatic'
       AND r.status = ?
       AND r.wallet_address IS NOT NULL
       AND COALESCE(r.smart_contract_address, ?) <> ''
       AND r.next_renewal_at IS NOT NULL
       AND r.next_renewal_at <= NOW()
       AND a.code = ?
       AND u.premium_expires_at IS NOT NULL
     ORDER BY r.next_renewal_at ASC
     LIMIT ${normalizedLimit}`,
    [RENEWAL_STATUSES.ACTIVE, SUBSCRIPTION_CORE_ADDRESS || '', PLAN_CODES.PREMIUM],
  );

  return rows;
}

async function persistSuccessfulCharge(
  {
    userId,
    planId,
    planCode,
    planPriceEur,
    walletAddress,
    smartContractAddress = null,
    mandateReference = null,
    transactionHash,
  },
) {
  const db = await getPool();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const amountToken = tokenUnitsToDecimal(USDC_MONTHLY_PRICE_UNITS);
    const [paymentResult] = await connection.execute(
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
        transaction_hash,
        confirmed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, NOW())`,
      [
        userId,
        planId,
        planCode,
        planPriceEur,
        USDC_TOKEN_SYMBOL.toLowerCase(),
        amountToken,
        'ethereum',
        walletAddress,
        transactionHash,
      ],
    );

    await connection.execute(
      `UPDATE utilisateur
       SET abonnement_id = ?,
           premium_expires_at = DATE_ADD(
         CASE
           WHEN premium_expires_at IS NOT NULL AND premium_expires_at > NOW() THEN premium_expires_at
           ELSE NOW()
         END,
         INTERVAL 1 MONTH
       ),
           premium_cancel_at_period_end = FALSE,
           quota_cleanup_required = FALSE
       WHERE id = ?`,
      [planId, userId],
    );

    const [userRows] = await connection.execute(
      'SELECT premium_expires_at FROM utilisateur WHERE id = ? LIMIT 1',
      [userId],
    );
    const nextRenewalAt = userRows[0]?.premium_expires_at || null;

    await connection.execute(
      `UPDATE abonnement_renouvellement
       SET provider = 'ethereum_wallet',
           mode = 'automatic',
           wallet_address = ?,
           chain_id = ?,
           network = ?,
           smart_contract_address = ?,
           mandate_reference = COALESCE(?, mandate_reference),
           last_renewal_attempt_at = NOW(),
           last_payment_id = ?,
           last_transaction_hash = ?,
           next_renewal_at = ?,
           failure_reason = NULL,
           status = ?
       WHERE utilisateur_id = ?`,
      [
        walletAddress,
        ETH_CHAIN_ID,
        ETH_NETWORK_NAME,
        smartContractAddress || SUBSCRIPTION_CORE_ADDRESS,
        mandateReference,
        paymentResult.insertId,
        transactionHash,
        nextRenewalAt,
        RENEWAL_STATUSES.ACTIVE,
        userId,
      ],
    );

    await connection.commit();
    return {
      paymentId: paymentResult.insertId,
      nextRenewalAt,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function recordRenewalSuccess(row, transactionHash) {
  return persistSuccessfulCharge({
    userId: row.utilisateur_id,
    planId: row.plan_id,
    planCode: row.plan_code,
    planPriceEur: row.plan_price_eur,
    walletAddress: row.wallet_address,
    smartContractAddress: row.smart_contract_address || SUBSCRIPTION_CORE_ADDRESS,
    transactionHash,
  });
}

async function ensureRenewalRow(userId) {
  const db = await getPool();
  await db.execute(
    `INSERT INTO abonnement_renouvellement (
      utilisateur_id,
      provider,
      mode,
      status,
      wallet_address,
      chain_id,
      network,
      smart_contract_address
    ) VALUES (?, 'ethereum_wallet', 'automatic', ?, NULL, ?, ?, ?)
    ON DUPLICATE KEY UPDATE utilisateur_id = utilisateur_id`,
    [userId, RENEWAL_STATUSES.ACTIVE, ETH_CHAIN_ID, ETH_NETWORK_NAME, SUBSCRIPTION_CORE_ADDRESS],
  );
}

async function recordRenewalFailure(rowId, failureReason) {
  const db = await getPool();
  await db.execute(
    `UPDATE abonnement_renouvellement
       SET last_renewal_attempt_at = NOW(),
           failure_reason = ?,
           status = ?
     WHERE id = ?`,
    [failureReason, RENEWAL_STATUSES.PAUSED, rowId],
  );
}

async function processDueRenewal(row, clients) {
  const contractAddress = row.smart_contract_address || SUBSCRIPTION_CORE_ADDRESS;
  await assertContractDeployed(clients.publicClient, contractAddress, 'SubscriptionCore');
  let hash;
  try {
    hash = await clients.walletClient.writeContract({
      account: clients.account,
      address: contractAddress,
      abi: subscriptionCoreAbi,
      functionName: 'chargeAutoRenew',
      args: [row.wallet_address],
    });
  } catch (error) {
    if (isChargeNotDueError(error)) {
      await subscriptionRenewalService.syncRenewalCoverageFromChain(row.utilisateur_id);
    }
    throw error;
  }

  await clients.publicClient.waitForTransactionReceipt({ hash });
  await recordRenewalSuccess(row, hash);
  return hash;
}

async function activateUsdcSubscriptionForUser(
  userId,
  {
    walletAddress,
    smartContractAddress = null,
    mandateReference = null,
  } = {},
) {
  if (!walletAddress) {
    const error = new Error('Adresse wallet requise.');
    error.statusCode = 400;
    throw error;
  }

  const config = getRunnerConfig();
  if (!config.enabled || !config.configured) {
    const error = new Error('Auto-renew USDC indisponible.');
    error.statusCode = 409;
    throw error;
  }

  const premiumPlan = await abonnementService.getAbonnementByCode(PLAN_CODES.PREMIUM);
  if (!premiumPlan) {
    const error = new Error('Plan Premium indisponible.');
    error.statusCode = 404;
    throw error;
  }

  await ensureRenewalRow(userId);
  const clients = buildClients();
  await assertContractDeployed(
    clients.publicClient,
    smartContractAddress || SUBSCRIPTION_CORE_ADDRESS,
    'SubscriptionCore',
  );

  const contractAddress = smartContractAddress || SUBSCRIPTION_CORE_ADDRESS;
  const onchainState = await subscriptionRenewalService.getOnchainAutoRenewState({
    walletAddress,
    smartContractAddress: contractAddress,
  });

  if (onchainState?.enabled && onchainState.paidUntilDate && onchainState.paidUntilDate.getTime() > Date.now()) {
    await subscriptionRenewalService.syncRenewalCoverageFromChain(userId);
    return {
      alreadyCovered: true,
      nextRenewalAt: onchainState.paidUntilDate,
      transactionHash: null,
    };
  }

  let hash;
  try {
    hash = await clients.walletClient.writeContract({
      account: clients.account,
      address: contractAddress,
      abi: subscriptionCoreAbi,
      functionName: 'chargeAutoRenew',
      args: [walletAddress],
    });
  } catch (error) {
    if (isChargeNotDueError(error)) {
      const syncedState = await subscriptionRenewalService.syncRenewalCoverageFromChain(userId);
      return {
        alreadyCovered: true,
        nextRenewalAt: syncedState?.paidUntilDate || null,
        transactionHash: null,
      };
    }
    throw error;
  }

  await clients.publicClient.waitForTransactionReceipt({ hash });
  await persistSuccessfulCharge({
    userId,
    planId: premiumPlan.id,
    planCode: premiumPlan.code,
    planPriceEur: premiumPlan.prix,
    walletAddress,
    smartContractAddress,
    mandateReference,
    transactionHash: hash,
  });

  return {
    transactionHash: hash,
  };
}

async function runAutoRenewalCycle() {
  const config = getRunnerConfig();
  if (!config.enabled || !config.configured || isRunning) {
    return;
  }

  isRunning = true;

  try {
    const dueRenewals = await listDueRenewals();
    if (dueRenewals.length === 0) {
      return;
    }

    const clients = buildClients();

    for (const row of dueRenewals) {
      try {
        const hash = await processDueRenewal(row, clients);
        console.log(`[auto-renew] Renouvellement OK pour user=${row.utilisateur_id} tx=${hash}`);
      } catch (error) {
        if (isChargeNotDueError(error)) {
          console.log(`[auto-renew] Couverture déjà active resynchronisée pour user=${row.utilisateur_id}.`);
          continue;
        }
        const failureReason = normalizeErrorMessage(error);
        await recordRenewalFailure(row.id, failureReason);
        console.warn(`[auto-renew] Echec pour user=${row.utilisateur_id}: ${failureReason}`);
      }
    }
  } catch (error) {
    console.error('[auto-renew] Cycle global en erreur:', error);
  } finally {
    isRunning = false;
  }
}

function startAutoRenewalRunner() {
  const config = getRunnerConfig();

  if (!config.enabled) {
    console.log('[auto-renew] Runner désactivé.');
    return;
  }

  if (!config.configured) {
    console.log('[auto-renew] Runner non configuré, démarrage ignoré.');
    return;
  }

  if (intervalHandle) {
    return;
  }

  console.log('[auto-renew] Runner démarré.');
  void runAutoRenewalCycle();
  intervalHandle = setInterval(() => {
    void runAutoRenewalCycle();
  }, AUTO_RENEW_RUNNER_INTERVAL_MS);
}

module.exports = {
  activateUsdcSubscriptionForUser,
  runAutoRenewalCycle,
  startAutoRenewalRunner,
};
