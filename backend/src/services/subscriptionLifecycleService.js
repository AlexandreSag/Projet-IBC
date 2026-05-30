const { getPool } = require('../config/database');
const subscriptionRenewalService = require('./subscriptionRenewalService');
const {
  PLAN_CODES,
  PREMIUM_DURATION_MONTHS,
  SUBSCRIPTION_STATES,
} = require('./subscriptionConstants');

function deriveSubscriptionState(abonnement) {
  if (!abonnement) {
    return SUBSCRIPTION_STATES.FREE;
  }

  if (abonnement.cleanupRequired) {
    return SUBSCRIPTION_STATES.CLEANUP_REQUIRED;
  }

  if (abonnement.isPremium && abonnement.cancelAtPeriodEnd) {
    return SUBSCRIPTION_STATES.PREMIUM_CANCEL_SCHEDULED;
  }

  if (abonnement.isPremium) {
    return SUBSCRIPTION_STATES.PREMIUM_ACTIVE;
  }

  return SUBSCRIPTION_STATES.FREE;
}

function computeNextPremiumExpiry(currentExpiry, durationMonths = PREMIUM_DURATION_MONTHS) {
  const baseDate = currentExpiry && new Date(currentExpiry).getTime() > Date.now()
    ? new Date(currentExpiry)
    : new Date();

  baseDate.setMonth(baseDate.getMonth() + durationMonths);
  return baseDate;
}

async function applyFreePlanState(userId, freePlanId, { cleanupRequired = false, executor = null } = {}) {
  const db = executor || await getPool();
  await db.execute(
    `UPDATE utilisateur
     SET abonnement_id = ?,
         premium_expires_at = NULL,
         premium_cancel_at_period_end = FALSE,
         quota_cleanup_required = ?
     WHERE id = ?`,
    [freePlanId, cleanupRequired, userId],
  );
  await subscriptionRenewalService.markRenewalPausedForCancellation(userId, db);
}

async function scheduleCancellationAtPeriodEnd(userId, executor = null) {
  const db = executor || await getPool();
  await db.execute(
    'UPDATE utilisateur SET premium_cancel_at_period_end = TRUE WHERE id = ?',
    [userId],
  );
  await subscriptionRenewalService.markRenewalPausedForCancellation(userId, db);
}

async function activatePremiumPlan(
  userId,
  {
    planId,
    durationMonths = PREMIUM_DURATION_MONTHS,
    walletAddress = null,
    lastPaymentId = null,
    lastTransactionHash = null,
    executor = null,
  } = {},
) {
  const db = executor || await getPool();

  await db.execute(
    `UPDATE utilisateur
     SET abonnement_id = ?,
         premium_expires_at = DATE_ADD(
           CASE
             WHEN premium_expires_at IS NOT NULL AND premium_expires_at > NOW() THEN premium_expires_at
             ELSE NOW()
           END,
           INTERVAL ? MONTH
         ),
         premium_cancel_at_period_end = FALSE,
         quota_cleanup_required = FALSE
     WHERE id = ?`,
    [planId, durationMonths, userId],
  );

  const [rows] = await db.execute(
    'SELECT premium_expires_at FROM utilisateur WHERE id = ? LIMIT 1',
    [userId],
  );
  const nextRenewalAt = rows[0]?.premium_expires_at || null;

  await subscriptionRenewalService.updateRenewalPaymentContext(userId, {
    executor: db,
    walletAddress,
    nextRenewalAt,
    lastPaymentId,
    lastTransactionHash,
  });
}

async function inferPremiumExpiryFromLatestPayment(userId, executor = null) {
  const db = executor || await getPool();
  const [paymentRows] = await db.execute(
    `SELECT confirmed_at
     FROM abonnement_paiement
     WHERE utilisateur_id = ?
       AND plan_code = ?
       AND status = 'confirmed'
       AND confirmed_at IS NOT NULL
     ORDER BY confirmed_at DESC
     LIMIT 1`,
    [userId, PLAN_CODES.PREMIUM],
  );

  const latestPayment = paymentRows[0];
  if (!latestPayment?.confirmed_at) {
    return null;
  }

  return computeNextPremiumExpiry(latestPayment.confirmed_at);
}

module.exports = {
  activatePremiumPlan,
  applyFreePlanState,
  computeNextPremiumExpiry,
  deriveSubscriptionState,
  inferPremiumExpiryFromLatestPayment,
  scheduleCancellationAtPeriodEnd,
};
