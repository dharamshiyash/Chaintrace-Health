import { ethers } from "ethers";
import chainTraceHealthAbi from "../../deployments/ChainTraceHealth.abi.json";
import amoyDeployment from "../../deployments/amoy.json";

export const AMOY_CHAIN_ID_DECIMAL = 80002;
export const AMOY_CHAIN_ID_HEX = "0x13882";

export const AMOY_CHAIN_PARAMS = {
  chainId: AMOY_CHAIN_ID_HEX,
  chainName: "Polygon Amoy Testnet",
  nativeCurrency: {
    name: "MATIC",
    symbol: "MATIC",
    decimals: 18,
  },
  rpcUrls: [
    "https://polygon-amoy.drpc.org",
    "https://polygon-amoy-bor-rpc.publicnode.com",
  ],
  blockExplorerUrls: ["https://amoy.polygonscan.com"],
};

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  amoyDeployment.contractAddress ||
  "0x3E8bBd12a1A614d131Fc227106D2697Df1C0C072";

/**
 * Returns window.ethereum or throws an actionable error if unavailable.
 */
export function getEthereum() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error(
      "MetaMask or compatible browser wallet was not detected. Please install MetaMask to register batches on the blockchain."
    );
  }
  return window.ethereum;
}

/**
 * Ensures the user's browser wallet is switched to the Polygon Amoy Testnet.
 */
export async function ensureAmoyNetwork() {
  const ethereum = getEthereum();
  const currentChainId = await ethereum.request({ method: "eth_chainId" });

  if (currentChainId.toLowerCase() === AMOY_CHAIN_ID_HEX.toLowerCase()) {
    return;
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: AMOY_CHAIN_ID_HEX }],
    });
  } catch (switchError) {
    // Error code 4902 indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [AMOY_CHAIN_PARAMS],
      });
    } else {
      throw switchError;
    }
  }
}

/**
 * Gets currently connected account if any without prompting.
 */
export async function getConnectedAccount() {
  if (typeof window === "undefined" || !window.ethereum) return null;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    return accounts && accounts.length > 0 ? accounts[0] : null;
  } catch {
    return null;
  }
}

/**
 * Requests account connection from user and ensures Polygon Amoy network.
 */
export async function connectWallet() {
  const ethereum = getEthereum();
  await ensureAmoyNetwork();
  const accounts = await ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts authorized in browser wallet.");
  }
  return accounts[0];
}

/**
 * Normalizes Web3 / MetaMask errors into clean, user-friendly messages.
 */
export function parseWeb3Error(err) {
  if (!err) return "An unknown error occurred.";

  const msg = err.message || String(err);
  const code = err.code || err.info?.error?.code;

  // User rejection codes (MetaMask code 4001, ACTION_REJECTED)
  if (
    code === 4001 ||
    code === "ACTION_REJECTED" ||
    msg.toLowerCase().includes("user rejected") ||
    msg.toLowerCase().includes("user denied") ||
    msg.toLowerCase().includes("rejected transaction")
  ) {
    return "Transaction rejected by user.";
  }

  // Contract revert reasons
  if (err.reason) return err.reason;
  if (err.shortMessage) {
    if (err.shortMessage.includes("reverted with reason string")) {
      const match = err.shortMessage.match(/reverted with reason string '([^']+)'/);
      if (match) return match[1];
    }
    return err.shortMessage;
  }

  if (msg.includes("Batch ID already registered")) {
    return "This Batch ID has already been registered on Polygon Amoy. Please choose a unique Batch ID.";
  }
  if (msg.includes("Manufacturing date must be before expiry")) {
    return "Manufacturing date must be earlier than expiry date.";
  }
  if (msg.includes("insufficient funds") || msg.includes("exceeds balance")) {
    return "Insufficient funds (MATIC) in wallet for transaction gas fees on Polygon Amoy.";
  }

  return msg.length > 150 ? `${msg.slice(0, 147)}…` : msg;
}

/**
 * Performs a REAL Polygon Amoy transaction to register a genesis batch.
 */
export async function registerBatchOnChain(form) {
  const batchId = form.batchId?.trim();
  const medicineName = form.medicineName?.trim();
  const location = form.location?.trim() || "Unspecified Facility";
  const quantityNum = Number(form.quantity);

  if (!batchId) throw new Error("Batch ID is required.");
  if (!medicineName) throw new Error("Medicine name is required.");
  if (!quantityNum || quantityNum <= 0) throw new Error("Quantity must be a positive number.");
  if (!form.mfgDate) throw new Error("Manufacturing date is required.");
  if (!form.expDate) throw new Error("Expiry date is required.");

  const mfgTimestamp = Math.floor(new Date(form.mfgDate).getTime() / 1000);
  const expTimestamp = Math.floor(new Date(form.expDate).getTime() / 1000);

  if (isNaN(mfgTimestamp) || isNaN(expTimestamp)) {
    throw new Error("Invalid date format provided.");
  }
  if (mfgTimestamp >= expTimestamp) {
    throw new Error("Manufacturing date must be before expiry date.");
  }

  // Ensure network is Polygon Amoy
  await ensureAmoyNetwork();

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  const contract = new ethers.Contract(CONTRACT_ADDRESS, chainTraceHealthAbi, signer);

  // Trigger MetaMask transaction
  const tx = await contract.registerBatch(
    batchId,
    medicineName,
    mfgTimestamp,
    expTimestamp,
    BigInt(quantityNum),
    location
  );

  // Wait for 1 confirmation block
  const receipt = await tx.wait(1);

  return {
    txHash: receipt.hash,
    receipt,
    contractAddress: CONTRACT_ADDRESS,
    blockNumber: receipt.blockNumber,
    batchId,
    medicineName,
    quantity: quantityNum,
    mfgTimestamp,
    expTimestamp,
    location,
  };
}
