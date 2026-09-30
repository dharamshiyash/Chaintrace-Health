import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// Initialize Provider — prefer local node when HARDHAT_NETWORK=localhost
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === "production");
const defaultNetwork = isVercel ? "amoy" : "amoy";
const network = process.env.HARDHAT_NETWORK || defaultNetwork;

const rpcUrl =
  network === "localhost"
    ? (process.env.VITE_LOCAL_RPC_URL || "http://127.0.0.1:8545")
    : (process.env.AMOY_RPC_URL || process.env.VITE_AMOY_RPC_URL || "https://polygon-amoy.drpc.org");

const networkConfig =
  network === "localhost"
    ? { chainId: 31337, name: "localhost" }
    : { chainId: 80002, name: "amoy" };

export const provider = new ethers.JsonRpcProvider(rpcUrl, networkConfig, {
  staticNetwork: true,
  batchMaxCount: 1,
});

// Known deployed address on Amoy from deployments/amoy.json
const AMOY_CONTRACT_ADDRESS = "0x3E8bBd12a1A614d131Fc227106D2697Df1C0C072";

// Embedded minimal ABI ensuring contract is always operational even if filesystem cannot read ABI
const FALLBACK_ABI = [
  "function verifyBatch(string batchId) external view returns (bool exists, string medicineName, string bId, uint256 manufacturingDate, uint256 expiryDate, uint256 quantity, address manufacturer, uint8 status, string recallReason)",
  "function getBatchHistory(string batchId) external view returns (tuple(address actor, string role, uint256 timestamp, string location, bool authorized)[])",
  "function recallBatch(string batchId, string reason) external",
  "function addSupplyChainEvent(string batchId, string role, string location) external",
  "function getDivergencePoint(string batchId) external view returns (address lastAuthorized, address firstUnauthorized)",
  "function addApprovedPartner(address partner) external",
  "function isApprovedPartner(address custodian, address partner) external view returns (bool)",
  "function getAllBatchHashes() external view returns (bytes32[])"
];

let contractAddress = network === "localhost" ? "0x5FbDB2315678afecb367f032d93F642f64180aa3" : AMOY_CONTRACT_ADDRESS;
let contractAbi = FALLBACK_ABI;

try {
  const deploymentEnv = network;
  const deploymentPath = path.resolve(process.cwd(), `deployments/${deploymentEnv}.json`);
  const abiPath = path.resolve(process.cwd(), `deployments/ChainTraceHealth.abi.json`);

  if (fs.existsSync(deploymentPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    if (deployment && deployment.contractAddress) {
      contractAddress = deployment.contractAddress;
    }
  }
  if (fs.existsSync(abiPath)) {
    const parsedAbi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
    if (Array.isArray(parsedAbi) && parsedAbi.length > 0) {
      contractAbi = parsedAbi;
    }
  }
} catch (error) {
  console.warn("Notice: Loaded fallback contract configuration:", error.message);
}

// Read-only contract instance
export const contract = new ethers.Contract(contractAddress, contractAbi, provider);

// Secondary fallback provider for Polygon Amoy to guard against RPC hiccups
const fallbackRpcUrl = "https://polygon-amoy-bor-rpc.publicnode.com";
export const fallbackProvider =
  network === "localhost"
    ? provider
    : new ethers.JsonRpcProvider(fallbackRpcUrl, networkConfig, {
        staticNetwork: true,
        batchMaxCount: 1,
      });

export const fallbackContract =
  network === "localhost"
    ? contract
    : new ethers.Contract(contractAddress, contractAbi, fallbackProvider);

export async function verifyBatchWithFallback(batchId) {
  try {
    return await contract.verifyBatch(batchId);
  } catch (primaryErr) {
    try {
      return await fallbackContract.verifyBatch(batchId);
    } catch {
      throw primaryErr;
    }
  }
}

// Formatted read helper
export async function measureRead(label, readFn) {
  const start = Date.now();
  const result = await readFn();
  const executionMs = Date.now() - start;
  
  // Return result with perf metadata for API to log
  return { result, executionMs };
}

// Writable contract instance using deployer wallet if private key is configured
let signer = null;
export let writableContract = null;

if (process.env.DEPLOYER_PRIVATE_KEY && contractAddress && contractAbi.length > 0) {
  try {
    signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    writableContract = new ethers.Contract(contractAddress, contractAbi, signer);
  } catch (err) {
    console.warn("Notice: Writable contract could not be initialized:", err.message);
  }
}

/**
 * Execute on-chain recall if backend signer is configured
 */
export async function executeRecallOnChain(batchId, reason) {
  if (!writableContract) {
    return null;
  }
  try {
    const tx = await writableContract.recallBatch(batchId, reason);
    const receipt = await tx.wait(1);
    return receipt.hash;
  } catch (err) {
    console.warn(`Notice: On-chain recall execution skipped for ${batchId}:`, err.message);
    return null;
  }
}

/**
 * Execute on-chain supply chain event if backend signer is configured
 */
export async function executeEventOnChain(batchId, role, location) {
  if (!writableContract) {
    return null;
  }
  try {
    const tx = await writableContract.addSupplyChainEvent(batchId, role, location);
    const receipt = await tx.wait(1);
    return receipt.hash;
  } catch (err) {
    console.warn(`Notice: On-chain event execution skipped for ${batchId}:`, err.message);
    return null;
  }
}
