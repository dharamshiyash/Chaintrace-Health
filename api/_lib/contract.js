import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// Initialize Provider — prefer local node when HARDHAT_NETWORK=localhost
const network = process.env.HARDHAT_NETWORK || "localhost";
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

// Read deployed artifact
const deploymentEnv = process.env.HARDHAT_NETWORK || "localhost";
const deploymentPath = path.resolve(process.cwd(), `deployments/${deploymentEnv}.json`);
const abiPath = path.resolve(process.cwd(), `deployments/ChainTraceHealth.abi.json`);

let contractAddress = "";
let contractAbi = [];

try {
  if (fs.existsSync(deploymentPath) && fs.existsSync(abiPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    contractAddress = deployment.contractAddress;
    contractAbi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  } else {
    console.warn(`Deployment file not found at ${deploymentPath}`);
  }
} catch (error) {
  console.error("Error loading deployment info:", error);
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
