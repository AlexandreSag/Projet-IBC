import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const currentFilePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFilePath), '..');
const sourcesDir = path.join(rootDir, 'src');
const artifactsDir = path.join(rootDir, 'artifacts');

function readSources() {
  const files = fs.readdirSync(sourcesDir).filter((file) => file.endsWith('.sol'));
  return Object.fromEntries(
    files.map((file) => [
      file,
      {
        content: fs.readFileSync(path.join(sourcesDir, file), 'utf8'),
      },
    ]),
  );
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeArtifacts(output) {
  ensureDirectory(artifactsDir);

  for (const [fileName, contracts] of Object.entries(output.contracts || {})) {
    for (const [contractName, artifact] of Object.entries(contracts)) {
      const targetPath = path.join(artifactsDir, `${contractName}.json`);
      fs.writeFileSync(
        targetPath,
        JSON.stringify(
          {
            contractName,
            sourceName: fileName,
            abi: artifact.abi,
            bytecode: artifact.evm?.bytecode?.object || '',
          },
          null,
          2,
        ),
      );
    }
  }
}

const input = {
  language: 'Solidity',
  sources: readSources(),
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
  },
};

const result = JSON.parse(solc.compile(JSON.stringify(input)));

if (Array.isArray(result.errors)) {
  const fatalErrors = result.errors.filter((entry) => entry.severity === 'error');
  const printableErrors = result.errors.map((entry) => `${entry.severity.toUpperCase()}: ${entry.formattedMessage}`);
  if (printableErrors.length > 0) {
    process.stderr.write(`${printableErrors.join('\n')}\n`);
  }

  if (fatalErrors.length > 0) {
    process.exit(1);
  }
}

writeArtifacts(result);
process.stdout.write('Contracts compiled into contracts/artifacts\n');
