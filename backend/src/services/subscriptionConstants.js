const PLAN_CODES = {
  FREE: 'free',
  PREMIUM: 'premium',
};

const SUBSCRIPTION_STATES = {
  FREE: 'free',
  PREMIUM_ACTIVE: 'premium_active',
  PREMIUM_CANCEL_SCHEDULED: 'premium_cancel_scheduled',
  CLEANUP_REQUIRED: 'cleanup_required',
};

const RENEWAL_MODES = {
  MANUAL: 'manual',
  AUTOMATIC: 'automatic',
};

const RENEWAL_STATUSES = {
  DISABLED: 'disabled',
  PENDING_SETUP: 'pending_setup',
  ACTIVE: 'active',
  PAUSED: 'paused',
};

const RENEWAL_PROVIDERS = {
  ETHEREUM_WALLET: 'ethereum_wallet',
};

const PREMIUM_DURATION_MONTHS = Number(process.env.PREMIUM_DURATION_MONTHS || 1);
const ETH_CHAIN_ID = Number(process.env.ETH_CHAIN_ID || process.env.VITE_ETH_CHAIN_ID || 31337);
const ETH_NETWORK_NAME = process.env.ETH_CHAIN_NAME || process.env.VITE_ETH_CHAIN_NAME || 'Anvil Local';

module.exports = {
  ETH_CHAIN_ID,
  ETH_NETWORK_NAME,
  PLAN_CODES,
  PREMIUM_DURATION_MONTHS,
  RENEWAL_MODES,
  RENEWAL_PROVIDERS,
  RENEWAL_STATUSES,
  SUBSCRIPTION_STATES,
};
