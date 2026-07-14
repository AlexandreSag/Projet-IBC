export const subscriptionCoreAbi = [
  {
    type: 'function',
    name: 'enableAutoRenew',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'maxTokenAmountPerCharge', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'disableAutoRenew',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
];

export function formatTokenUnits(units, decimals = 6) {
  const normalized = BigInt(units || '0');
  const divisor = 10n ** BigInt(decimals);
  const whole = normalized / divisor;
  const fraction = normalized % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  return `${whole}.${fraction.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
}
