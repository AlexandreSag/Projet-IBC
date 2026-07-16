import { createPublicClient, createWalletClient, encodeFunctionData, formatUnits, getAddress, http, parseUnits } from 'viem';
import { erc20Abi } from 'viem';
import {
  DEFAULT_ANVIL_CHAIN_ID,
  DEFAULT_FORK_RPC_URL,
  USDC_MAINNET_ADDRESS,
} from '../config/forkConfig.mjs';

const [, , rawTargetAddress, rawUsdcAmount = '1000'] = process.argv;

if (!rawTargetAddress) {
  throw new Error('Utilisation attendue : npm run fund:fork -- 0xVotreAdresse 1000');
}

const targetAddress = getAddress(rawTargetAddress);
const whaleAddress = process.env.USDC_WHALE_ADDRESS ? getAddress(process.env.USDC_WHALE_ADDRESS) : null;
const usdcAddress = getAddress(USDC_MAINNET_ADDRESS);
const usdcAmount = parseUnits(String(rawUsdcAmount), 6);
const rpcUrl = DEFAULT_FORK_RPC_URL;

if (!whaleAddress) {
  throw new Error('USDC_WHALE_ADDRESS est requis.');
}

const clientConfig = {
  chain: {
    id: DEFAULT_ANVIL_CHAIN_ID,
    name: 'Anvil Mainnet Fork',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  },
  transport: http(rpcUrl),
};

const publicClient = createPublicClient(clientConfig);

const transferData = encodeFunctionData({
  abi: erc20Abi,
  functionName: 'transfer',
  args: [targetAddress, usdcAmount],
});

await publicClient.request({
  method: 'anvil_setBalance',
  params: [targetAddress, '0x3635C9ADC5DEA00000'],
});

await publicClient.request({
  method: 'anvil_setBalance',
  params: [whaleAddress, '0x3635C9ADC5DEA00000'],
});

// Anvil permet d'utiliser temporairement le wallet source sur le fork local.
await publicClient.request({
  method: 'anvil_impersonateAccount',
  params: [whaleAddress],
});

try {
  const whaleClient = createWalletClient({
    ...clientConfig,
    account: whaleAddress,
  });

  const beforeTargetBalance = await publicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [targetAddress],
  });

  const whaleBalance = await publicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [whaleAddress],
  });

  if (whaleBalance < usdcAmount) {
    throw new Error(
      `USDC insuffisants sur ${whaleAddress}. Dispo : ${formatUnits(whaleBalance, 6)} USDC.`,
    );
  }

  const hash = await whaleClient.sendTransaction({
    account: whaleAddress,
    to: usdcAddress,
    data: transferData,
  });

  await publicClient.waitForTransactionReceipt({ hash });

  const afterTargetBalance = await publicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [targetAddress],
  });

  process.stdout.write(
    [
      `Wallet crédité : ${targetAddress}`,
      `Contrat USDC : ${usdcAddress}`,
      `Wallet source : ${whaleAddress}`,
      `Solde avant : ${formatUnits(beforeTargetBalance, 6)} USDC`,
      `Solde après : ${formatUnits(afterTargetBalance, 6)} USDC`,
      `Transaction : ${hash}`,
    ].join('\n'),
  );
} finally {
  // Le wallet source est toujours libéré, même si le transfert échoue.
  await publicClient.request({
    method: 'anvil_stopImpersonatingAccount',
    params: [whaleAddress],
  });
}
