import { createPublicClient, custom, defineChain, http } from 'viem';

const rpcUrl = import.meta.env.VITE_ETH_RPC_URL || 'http://localhost:8545';

export const anvilLocalChain = defineChain({
  id: 31337,
  name: 'Anvil Mainnet Fork',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Local RPC',
      url: rpcUrl,
    },
  },
  testnet: true,
});

export const anvilPublicClient = createPublicClient({
  chain: anvilLocalChain,
  transport: http(rpcUrl),
});

export function getEthereumProvider() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.ethereum || null;
}

export function createBrowserWalletClient() {
  const provider = getEthereumProvider();

  if (!provider) {
    return null;
  }

  return custom(provider);
}
