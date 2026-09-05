import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// Initialize Provider — prefer local node when HARDHAT_NETWORK=localhost
const network = process.env.HARDHAT_NETWORK || "localhost";
const rpcUrl =
  network === "localhost"
    ? (process.env.VITE_LOCAL_RPC_URL || "http://127.0.0.1:8545")
    : (process.env.AMOY_RPC_URL || process.env.VITE_AMOY_RPC_URL || "https://polygon-amoy.drpc.org");

export const provider = new ethers.JsonRpcProvider(rpcUrl);

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

// Formatted read helper
export async function measureRead(label, readFn) {
  const start = Date.now();
  const result = await readFn();
  const executionMs = Date.now() - start;
  
  // Return result with perf metadata for API to log
  return { result, executionMs };
}
