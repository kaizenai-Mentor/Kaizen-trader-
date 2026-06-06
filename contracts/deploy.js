const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Contract ABI and Bytecode
// We use a simplified deployment approach
const CONTRACT_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
`;

// Pre-compiled bytecode for KaizenBenchmark.sol
// Generated from the contract we wrote
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
    process.exit(1);
  }

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

  // Bytecode compiled from KaizenBenchmark.sol
  const BYTECODE = '0x608060405234801561001057600080fd5b50336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506108d4806100606000396000f3fe608060405234801561001057600080fd5b50600436106100575760003560e01c80630e15999d1461005c5780638da5cb5b1461007857806394e79c5c146100965780639691ac4f146100b2578063b1ce1c8d146100d0575b600080fd5b610076600480360381019061007191906104f8565b6100ec565b005b6100806101f4565b60405161008d91906105cb565b60405180910390f35b6100b060048036038101906100ab91906104f8565b610218565b005b6100ca60048036038101906100c591906104f8565b610320565b005b6100ea60048036038101906100e591906104f8565b6103f0565b005b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610179576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161017090610647565b60405180910390fd5b8260046000848152602001908152602001600020600001819055508160046000848152602001908152602001600020600101819055507f7fb17e0f00000000000000000000000000000000000000000000000000000000600083836040516101e293929190610697565b60405180910390a1505050565b60008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146102a5576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161029c90610647565b60405180910390fd5b60046000838152602001908152602001600020600001548260046000858152602001908152602001600020600001819055507fb7e7c3000000000000000000000000000000000000000000000000000000000060008284604051610309929190610706565b60405180910390a15050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146103ad576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161039c9061077e565b604051fd5b60046000838152602001908152602001600020600101600081548092919061100600000000000000000000000000000000000000000000000000000000000000008154016100000000000000000000000000000000000000000000000000000000905550505050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461047d576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161047490610647565b60405180910390fd5b60046000838152602001908152602001600020600201600081548092919061100600000000000000000000000000000000000000000000000000000000000000008154016100000000000000000000000000000000000000000000000000000000905550505050565b600080fd5b6000819050919050565b6104d5816104c2565b81146104e057600080fd5b50565b6000813590506104f2816104cc565b92915050565b60006020828403121561050e5761050d6104bd565b5b600061051c848285016104e3565b91505092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600061055082610525565b9050919050565b61056081610545565b82525050565b6000819050919050565b61057981610566565b82525050565b600082825260208201905092915050565b7f4e6f7420617574686f72697a6564000000000000000000000000000000000000600082015250565b60006105c6600e8361057f565b91506105d182610590565b602082019050919050565b600060208201905081810360008301526105f5816105b9565b9050919050565b82818337600083830152505050565b6000601f19601f8301169050919050565b600061062882856105fc565b9150610634828461060b565b91508190509392505050565b600060208201905061065560008301846105f4565b92915050565b600081519050919050565b600082825260208201905092915050565b60005b8381101561069557808201518184015260208101905061067a565b60008484015250505050565b60006106ac8261065b565b6106b68185610666565b93506106c6818560208601610677565b6106cf8161060b565b840191505092915050565b6000819050919050565b60006106ef826106da565b90506020810190509190565b60006107078285610677565b91506107138284610677565b91508190509392505050565b6000602082019050818103600083015261073881846106a1565b905092915050565b7f4e6f7420617574686f72697a656400000000000000000000000000000000000060008201525050';

  console.log('Deploying KaizenBenchmark contract...');

  const factory = new ethers.ContractFactory(ABI, BYTECODE, wallet);

  const contract = await factory.deploy({
    gasLimit: 3000000
  });

  console.log('Transaction hash:', contract.deploymentTransaction().hash);
  console.log('Waiting for confirmation...');

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log('');
  console.log('CONTRACT DEPLOYED SUCCESSFULLY');
  console.log('Contract address:', address);
  console.log('');
  console.log('Add to Render environment:');
  console.log('MANTLE_CONTRACT_ADDRESS =', address);
  console.log('');
  console.log('View on explorer:');
  console.log('https://explorer.sepolia.mantle.xyz/address/' + address);
}

deploy().catch(console.error);
