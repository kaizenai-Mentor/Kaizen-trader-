const { ethers } = require('ethers');
const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Compile KaizenBenchmark.sol from source
function compileContract() {
  const sourcePath = path.join(__dirname, 'KaizenBenchmark.sol');
  const source = fs.readFileSync(sourcePath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      'KaizenBenchmark.sol': {
        content: source
      }
    },
        settings: {
      optimizer: { enabled: false },
      evmVersion: 'london',
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object']
        }
      }
        }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    output.errors.forEach(err => {
      if (err.severity === 'error') {
        console.error('Compilation error:', err.message);
        process.exit(1);
      }
      console.warn('Compilation warning:', err.message);
    });
  }

  const contract = output.contracts['KaizenBenchmark.sol']['KaizenBenchmark'];
  
  if (!contract) {
    console.error('Failed to compile KaizenBenchmark contract');
    process.exit(1);
  }

  console.log('Contract compiled successfully');
  console.log('ABI length:', contract.abi.length, 'entries');
  console.log('Bytecode size:', contract.evm.bytecode.object.length / 2, 'bytes');

  return {
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object
  };
}

// Contract ABI — generated from KaizenBenchmark.sol
const ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "userId", "type": "bytes32"},
      {"indexed": false, "name": "milestoneType", "type": "string"},
      {"indexed": false, "name": "score", "type": "uint8"},
      {"indexed": false, "name": "timestamp", "type": "uint256"}
    ],
    "name": "MilestoneReached",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "userId", "type": "bytes32"},
      {"indexed": false, "name": "patternType", "type": "string"},
      {"indexed": false, "name": "severity", "type": "string"},
      {"indexed": false, "name": "timestamp", "type": "uint256"}
    ],
    "name": "PatternDetected",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "userId", "type": "bytes32"},
      {"indexed": false, "name": "previousScore", "type": "uint8"},
      {"indexed": false, "name": "newScore", "type": "uint8"},
      {"indexed": false, "name": "reason", "type": "string"},
      {"indexed": false, "name": "timestamp", "type": "uint256"}
    ],
    "name": "ScoreChanged",
    "type": "event"
  },
  {
    "inputs": [
      {"name": "userId", "type": "bytes32"},
      {"name": "milestoneType", "type": "string"},
      {"name": "score", "type": "uint8"}
    ],
    "name": "recordMilestone",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "userId", "type": "bytes32"},
      {"name": "patternType", "type": "string"},
      {"name": "severity", "type": "string"}
    ],
    "name": "recordPattern",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "userId", "type": "bytes32"},
      {"name": "previousScore", "type": "uint8"},
      {"name": "newScore", "type": "uint8"},
      {"name": "reason", "type": "string"}
    ],
    "name": "recordScoreChange",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "userId", "type": "bytes32"}
    ],
    "name": "getUserStats",
    "outputs": [
      {"name": "currentScore", "type": "uint8"},
      {"name": "sessionCount", "type": "uint256"},
      {"name": "milestoneCount", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalEvents",
    "outputs": [
      {"name": "scores", "type": "uint256"},
      {"name": "patterns", "type": "uint256"},
      {"name": "milestones", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
];

async function deploy() {
  const PRIVATE_KEY = process.env.MANTLE_PRIVATE_KEY;
  const RPC_URL = process.env.MANTLE_RPC_URL ||
    'https://rpc.sepolia.mantle.xyz';

  if (!PRIVATE_KEY) {
    console.error('MANTLE_PRIVATE_KEY not set');
    console.error('Please set MANTLE_PRIVATE_KEY in your environment');
    console.error('');
    console.error('For manual deployment instructions:');
    console.error('1. Install dependencies: npm install');
    console.error('2. Set MANTLE_PRIVATE_KEY and MANTLE_RPC_URL');
    console.error('3. Run: node contracts/deploy.js');
    process.exit(1);
  }

  // Compile contract from source
  console.log('Compiling KaizenBenchmark.sol...');
  const { abi, bytecode } = compileContract();
  console.log('Using compiled bytecode from KaizenBenchmark.sol');

  console.log('Connecting to Mantle Sepolia...');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log('Deploying from address:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'MNT');

  if (balance === 0n) {
    console.error('No testnet MNT. Get some from faucet.sepolia.mantle.xyz');
    process.exit(1);
  }

  console.log('Deploying KaizenBenchmark contract from source...');

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  const contract = await factory.deploy({
    gasLimit: 3000000
  });

  console.log('Transaction hash:', contract.deploymentTransaction().hash);
  console.log('Waiting for confirmation...');

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log('');
  console.log('===========================================');
  console.log('CONTRACT DEPLOYED SUCCESSFULLY');
  console.log('===========================================');
  console.log('Contract address:', address);
  console.log('');
  console.log('Add to Render environment:');
  console.log('MANTLE_CONTRACT_ADDRESS =', address);
  console.log('');
  console.log('View on explorer:');
  console.log('https://explorer.sepolia.mantle.xyz/address/' + address);
  console.log('');
  console.log('Owner (deployer):', wallet.address);
}

deploy().catch(console.error);
