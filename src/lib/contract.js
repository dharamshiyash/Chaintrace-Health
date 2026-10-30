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
 * Returns MetaMask provider or throws an actionable error if unavailable.
 */
export function getEthereum() {
  if (typeof window === "undefined") {
    throw new Error("Window environment is not available.");
  }
  let ethereum = window.ethereum;
  if (ethereum?.providers?.length) {
    ethereum = ethereum.providers.find((p) => p.isMetaMask) || ethereum.providers[0];
  }
  if (!ethereum) {
    throw new Error(
      "MetaMask was not detected. Please ensure the MetaMask extension is installed and enabled."
    );
  }
  return ethereum;
}

/**
 * Ensures the user's browser wallet is switched to the Polygon Amoy Testnet.
 */
export async function ensureAmoyNetwork() {
  const ethereum = getEthereum();
  let currentChainId = null;
  try {
    currentChainId = await ethereum.request({ method: "eth_chainId" });
  } catch (err) {
    console.warn("Could not read eth_chainId:", err.message);
  }

  if (currentChainId && parseInt(currentChainId, 16) === AMOY_CHAIN_ID_DECIMAL) {
    return;
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: AMOY_CHAIN_ID_HEX }],
    });
  } catch (switchError) {
    const isUnrecognized =
      switchError.code === 4902 ||
      switchError.data?.originalError?.code === 4902 ||
      String(switchError.message || "").toLowerCase().includes("unrecognized") ||
      String(switchError.message || "").toLowerCase().includes("not found");

    if (isUnrecognized) {
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
    const ethereum = getEthereum();
    const accounts = await ethereum.request({ method: "eth_accounts" });
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
  // Request account first so MetaMask immediately opens permission modal
  const accounts = await ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts authorized in MetaMask.");
  }
  try {
    await ensureAmoyNetwork();
  } catch (netErr) {
    console.warn("Notice: Network switch check:", netErr.message);
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
    return "Transaction signature rejected in MetaMask.";
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

  const ethereum = getEthereum();

  // 1. Explicitly prompt MetaMask connection if not connected
  let accounts = await ethereum.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    accounts = await ethereum.request({ method: "eth_requestAccounts" });
  }
  if (!accounts || accounts.length === 0) {
    throw new Error("Please connect your MetaMask wallet to sign this batch.");
  }

  // 2. Ensure network is Polygon Amoy
  await ensureAmoyNetwork();

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner(accounts[0]);

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
    signerAddress: accounts[0],
  };
}

/**
 * Performs a REAL on-chain transaction to recall a batch.
 */
export async function recallBatchOnChain(batchId, reason) {
  const cleanId = batchId?.trim();
  const cleanReason = reason?.trim();

  if (!cleanId) throw new Error("Batch ID is required for recall.");
  if (!cleanReason) throw new Error("Recall reason is required.");

  const ethereum = getEthereum();
  let accounts = await ethereum.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    accounts = await ethereum.request({ method: "eth_requestAccounts" });
  }
  if (!accounts || accounts.length === 0) {
    throw new Error("Please connect your MetaMask wallet to sign this recall.");
  }

  await ensureAmoyNetwork();

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner(accounts[0]);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, chainTraceHealthAbi, signer);

  const tx = await contract.recallBatch(cleanId, cleanReason);
  const receipt = await tx.wait(1);

  return {
    txHash: receipt.hash,
    receipt,
    batchId: cleanId,
    reason: cleanReason,
    signerAddress: accounts[0],
  };
}

/**
 * Records a custody change event on the blockchain.
 */
export async function addSupplyChainEventOnChain(batchId, role, location) {
  const cleanId = batchId?.trim();
  const cleanRole = role?.trim();
  const cleanLoc = location?.trim();

  if (!cleanId) throw new Error("Batch ID is required.");
  if (!cleanRole) throw new Error("Role is required.");
  if (!cleanLoc) throw new Error("Location is required.");

  const ethereum = getEthereum();
  let accounts = await ethereum.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    accounts = await ethereum.request({ method: "eth_requestAccounts" });
  }
  if (!accounts || accounts.length === 0) {
    throw new Error("Please connect your MetaMask wallet to record supply chain events.");
  }

  await ensureAmoyNetwork();

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner(accounts[0]);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, chainTraceHealthAbi, signer);

  const tx = await contract.addSupplyChainEvent(cleanId, cleanRole, cleanLoc);
  const receipt = await tx.wait(1);

  return {
    txHash: receipt.hash,
    receipt,
    batchId: cleanId,
    role: cleanRole,
    location: cleanLoc,
    signerAddress: accounts[0],
  };
}

/**
 * Whitelist an approved partner address on the blockchain.
 */
export async function addApprovedPartnerOnChain(partnerAddress) {
  const cleanAddr = partnerAddress?.trim();
  if (!cleanAddr) throw new Error("Partner address is required.");

  const ethereum = getEthereum();
  let accounts = await ethereum.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    accounts = await ethereum.request({ method: "eth_requestAccounts" });
  }
  if (!accounts || accounts.length === 0) {
    throw new Error("Please connect your MetaMask wallet to approve a partner.");
  }

  await ensureAmoyNetwork();

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner(accounts[0]);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, chainTraceHealthAbi, signer);

  const tx = await contract.addApprovedPartner(cleanAddr);
  const receipt = await tx.wait(1);

  return {
    txHash: receipt.hash,
    receipt,
    partner: cleanAddr,
    signerAddress: accounts[0],
  };
}
