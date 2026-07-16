import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, formatEther, getAddress, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  DEFAULT_ANVIL_CHAIN_ID,
  DEFAULT_ANVIL_DEPLOYER_PRIVATE_KEY,
  DEFAULT_FORK_RPC_URL,
  USDC_MAINNET_ADDRESS,
} from '../config/forkConfig.mjs';

const currentFilePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFilePath), '..');
const artifactPath = path.join(rootDir, 'artifacts', 'SubscriptionCore.json');

// L'adresse change après un reset Anvil et doit être recopiée dans le .env.
if (!fs.existsSync(artifactPath)) {
  throw new Error('Artifact SubscriptionCore.json introuvable.');
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const rpcUrl = DEFAULT_FORK_RPC_URL;
const account = privateKeyToAccount(DEFAULT_ANVIL_DEPLOYER_PRIVATE_KEY);
const treasury = getAddress(process.env.SUBSCRIPTION_TREASURY_ADDRESS || account.address);
const usdcAddress = getAddress(USDC_MAINNET_ADDRESS);
const ethMonthlyPriceWei = parseEther(process.env.ETH_MONTHLY_PRICE || '0.0034');
const tokenMonthlyPrice = BigInt(process.env.USDC_MONTHLY_PRICE_UNITS || '9990000');

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
const walletClient = createWalletClient({
  ...clientConfig,
  account,
});

const deployerBalance = await publicClient.getBalance({ address: account.address });

if (deployerBalance < ethMonthlyPriceWei) {
  throw new Error(`ETH insuffisant sur ${account.address}.`);
}

const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: `0x${artifact.bytecode}`,
  args: [treasury, usdcAddress, ethMonthlyPriceWei, tokenMonthlyPrice],
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
const contractAddress = receipt.contractAddress;

if (!contractAddress) {
  throw new Error('Déploiement OK, mais pas d’adresse de contrat.');
}

process.stdout.write(
  [
    `SubscriptionCore déployé : ${contractAddress}`,
    `RPC : ${rpcUrl}`,
    `USDC : ${usdcAddress}`,
    `Trésorerie : ${treasury}`,
    `Prix mensuel ETH : ${formatEther(ethMonthlyPriceWei)} ETH`,
    `Prix mensuel USDC : ${Number(tokenMonthlyPrice) / 1_000_000} USDC`,
    '',
    'Variables utiles :',
    `SUBSCRIPTION_CORE_ADDRESS=${contractAddress}`,
    `USDC_MAINNET_ADDRESS=${usdcAddress}`,
  ].join('\n'),
);
