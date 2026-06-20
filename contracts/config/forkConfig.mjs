import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFilePath), '..', '..');
const envPath = path.join(rootDir, '.env');

function loadProjectEnv() {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadProjectEnv();

export const DEFAULT_FORK_RPC_URL = process.env.FORK_RPC_URL || process.env.VITE_ETH_RPC_URL || 'http://localhost:8545';
export const USDC_MAINNET_ADDRESS = process.env.USDC_MAINNET_ADDRESS || '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
export const DEFAULT_ANVIL_CHAIN_ID = 31337;
export const DEFAULT_ANVIL_DEPLOYER_PRIVATE_KEY = process.env.ANVIL_DEPLOYER_PRIVATE_KEY
  || process.env.AUTO_RENEW_RUNNER_PRIVATE_KEY
  || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
