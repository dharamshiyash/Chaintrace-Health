import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROLES = {
  MANUFACTURER: "Manufacturer",
  DISTRIBUTOR: "Distributor",
  PHARMACY: "Pharmacy",
};

const RECALL_REASONS = {
  CONTAMINATION: "Contamination",
  PROBABLE_EXPIRY: "Probable Expiry",
  QUALITY_DEFECT: "Quality Defect",
};

const perfRecords = [];

async function measureTx(label, txPromise) {
  const start = Date.now();
  const tx = await txPromise;
  const receipt = await tx.wait();
  const confirmationMs = Date.now() - start;

  const record = {
    function: label,
    txHash: receipt.hash,
    gasUsed: receipt.gasUsed.toString(),
    confirmationMs,
    success: receipt.status === 1,
    timestamp: new Date().toISOString(),
  };

  perfRecords.push(record);
  console.log(`  ✓ ${label}`);
  console.log(`    Gas: ${record.gasUsed} | Confirmation: ${confirmationMs}ms | TX: ${receipt.hash}`);
  return receipt;
}

async function measureRead(label, readFn) {
  const start = Date.now();
  const result = await readFn();
  const executionMs = Date.now() - start;

  perfRecords.push({
    function: label,
    txHash: null,
    gasUsed: "0",
    executionMs,
    success: true,
    timestamp: new Date().toISOString(),
  });

  console.log(`  ✓ ${label} (read) — ${executionMs}ms`);
  return result;
}

async function main() {
  console.log("ChainTrace Health — Seed Script\n");
  const networkName = hre.globalOptions.network ?? "localhost";
  const network = await hre.network.connect(networkName);
  const ethers = network.ethers;
  const deploymentPath = path.join(__dirname, `../deployments/${networkName}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`deployments/${networkName}.json not found. Run deploy script first.`);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log("Contract address:", deployment.contractAddress);

  const signers = await ethers.getSigners();

  // On testnets we only have 1 funded signer (the deployer).
  // Derive deterministic wallets for the other roles and fund them from deployer.
  let manufacturer, distributor1, distributor2, pharmacy;

  if (signers.length >= 4) {
    // Local Hardhat node — plenty of pre-funded accounts
    manufacturer = signers[0];
    distributor1 = signers[1];
    distributor2 = signers[2];
    pharmacy     = signers[3];
  } else {
    // Testnet — single deployer, derive additional wallets
    manufacturer = signers[0];
    distributor1 = ethers.Wallet.createRandom().connect(ethers.provider);
    distributor2 = ethers.Wallet.createRandom().connect(ethers.provider);
    pharmacy     = ethers.Wallet.createRandom().connect(ethers.provider);

    // Fund the derived wallets with a small amount of MATIC
    const fundAmount = ethers.parseEther("0.5");
    console.log("Funding derived wallets...");
    for (const w of [distributor1, distributor2, pharmacy]) {
      const tx = await manufacturer.sendTransaction({ to: w.address, value: fundAmount });
      await tx.wait();
      console.log(`  ✓ Funded ${w.address}`);
    }
    console.log("");
  }

  console.log("Accounts:");
  console.log("  Manufacturer:", manufacturer.address);
  console.log("  Distributor1 (authorized):", distributor1.address);
  console.log("  Distributor2 (unauthorized):", distributor2.address);
  console.log("  Pharmacy:", pharmacy.address, "\n");

  const abiPath = path.join(__dirname, "../deployments/ChainTraceHealth.abi.json");
  const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  const contract = new ethers.Contract(deployment.contractAddress, abi, manufacturer);

  // ─── Whitelist setup ────────────────────────────────────────────────────────
  console.log("Setting up whitelists...");
  await measureTx("addApprovedPartner(distributor1)", contract.addApprovedPartner(distributor1.address));
  await measureTx("addApprovedPartner(pharmacy)", contract.addApprovedPartner(pharmacy.address));
  const contractAsD1 = contract.connect(distributor1);
  await measureTx("addApprovedPartner(pharmacy) by distributor1", contractAsD1.addApprovedPartner(pharmacy.address));

  const now = Math.floor(Date.now() / 1000);
  const mfgDate = now - 86400 * 30;
  const expDate  = now + 86400 * 365;

  // ─── Batch 1: Clean chain ───────────────────────────────────────────────────
  console.log("\nBatch 1: Clean authorized chain...");
  const batch1Id = "BATCH-MED-2024-001";
  await measureTx("registerBatch(BATCH-MED-2024-001)", contract.registerBatch(
    batch1Id, "Amoxicillin 500mg", mfgDate, expDate, 1000, "Mumbai, Maharashtra"
  ));
  await measureTx("addSupplyChainEvent(distributor1)", contractAsD1.addSupplyChainEvent(
    batch1Id, ROLES.DISTRIBUTOR, "Delhi Distribution Center"
  ));
  const contractAsPharmacy = contract.connect(pharmacy);
  await measureTx("addSupplyChainEvent(pharmacy)", contractAsPharmacy.addSupplyChainEvent(
    batch1Id, ROLES.PHARMACY, "Apollo Pharmacy, Delhi"
  ));

  // ─── Batch 2: Clean, dispensed ─────────────────────────────────────────────
  console.log("\nBatch 2: Clean chain, dispensed...");
  const batch2Id = "BATCH-MED-2024-002";
  await measureTx("registerBatch(BATCH-MED-2024-002)", contract.registerBatch(
    batch2Id, "Paracetamol 650mg", mfgDate, expDate, 500, "Pune, Maharashtra"
  ));
  await measureTx("addSupplyChainEvent(distributor1)", contractAsD1.addSupplyChainEvent(
    batch2Id, ROLES.DISTRIBUTOR, "Chennai Distribution Hub"
  ));
  await measureTx("addSupplyChainEvent(pharmacy)", contractAsPharmacy.addSupplyChainEvent(
    batch2Id, ROLES.PHARMACY, "Medplus, Chennai"
  ));

  // ─── Batch 3: UNAUTHORIZED HANDOFF ─────────────────────────────────────────
  console.log("\nBatch 3: Injecting unauthorized handoff...");
  const batch3Id = "BATCH-MED-2024-003";
  await measureTx("registerBatch(BATCH-MED-2024-003)", contract.registerBatch(
    batch3Id, "Atorvastatin 10mg", mfgDate, expDate, 2000, "Hyderabad, Telangana"
  ));
  await measureTx("addSupplyChainEvent(distributor1 authorized)", contractAsD1.addSupplyChainEvent(
    batch3Id, ROLES.DISTRIBUTOR, "Hyderabad Distribution Center"
  ));
  const contractAsD2 = contract.connect(distributor2);
  await measureTx("addSupplyChainEvent(distributor2 UNAUTHORIZED)", contractAsD2.addSupplyChainEvent(
    batch3Id, ROLES.DISTRIBUTOR, "Unknown Warehouse, Hyderabad"
  ));

  // ─── Batch 4: Recalled ─────────────────────────────────────────────────────
  console.log("\nBatch 4: Recalled (Contamination)...");
  const batch4Id = "BATCH-MED-2024-004";
  await measureTx("registerBatch(BATCH-MED-2024-004)", contract.registerBatch(
    batch4Id, "Metformin 1000mg", mfgDate, expDate, 750, "Bengaluru, Karnataka"
  ));
  await measureTx("recallBatch(Contamination)", contract.recallBatch(batch4Id, RECALL_REASONS.CONTAMINATION));

  // ─── Batch 5: Recalled (Probable Expiry) ───────────────────────────────────
  console.log("\nBatch 5: Recalled (Probable Expiry)...");
  const batch5Id = "BATCH-MED-2024-005";
  const nearExpiry = now + 86400 * 7;
  await measureTx("registerBatch(BATCH-MED-2024-005)", contract.registerBatch(
    batch5Id, "Azithromycin 250mg", mfgDate, nearExpiry, 300, "Kolkata, West Bengal"
  ));
  await measureTx("recallBatch(Probable Expiry)", contract.recallBatch(batch5Id, RECALL_REASONS.PROBABLE_EXPIRY));

  // ─── Read performance ────────────────────────────────────────────────────────
  console.log("\nMeasuring read function performance...");
  await measureRead("verifyBatch(BATCH-MED-2024-001)", () => contract.verifyBatch(batch1Id));
  await measureRead("verifyBatch(BATCH-MED-2024-003 — Suspicious)", () => contract.verifyBatch(batch3Id));
  await measureRead("getBatchHistory(BATCH-MED-2024-001)", () => contract.getBatchHistory(batch1Id));
  await measureRead("getBatchHistory(BATCH-MED-2024-003)", () => contract.getBatchHistory(batch3Id));
  await measureRead("getDivergencePoint(BATCH-MED-2024-003)", () => contract.getDivergencePoint(batch3Id));

  const [lastAuth, firstUnauth] = await contract.getDivergencePoint(batch3Id);
  console.log("\n✓ Divergence Detection Verification:");
  console.log("  Last authorized:     ", lastAuth);
  console.log("  First unauthorized:  ", firstUnauth);
  console.log("  Expected last auth:  ", distributor1.address);
  console.log("  Expected first unauth:", distributor2.address);
  const divergenceCorrect =
    lastAuth.toLowerCase() === distributor1.address.toLowerCase() &&
    firstUnauth.toLowerCase() === distributor2.address.toLowerCase();
  console.log("  Detection accurate:  ", divergenceCorrect ? "✓ YES" : "✗ NO");

  // ─── Write performance report ──────────────────────────────────────────────
  const reportsDir = path.join(__dirname, "../reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const performanceOutput = {
    network: deployment.network,
    contractAddress: deployment.contractAddress,
    capturedAt: new Date().toISOString(),
    divergenceDetectionAccurate: divergenceCorrect,
    transactions: perfRecords,
    summary: {
      totalTransactions: perfRecords.filter((r) => r.txHash).length,
      totalReads: perfRecords.filter((r) => !r.txHash).length,
      successRate: `${perfRecords.filter((r) => r.success).length}/${perfRecords.length}`,
    },
  };

  fs.writeFileSync(
    path.join(reportsDir, "performance.json"),
    JSON.stringify(performanceOutput, null, 2)
  );

  console.log("\n✓ Performance data written to reports/performance.json");
  console.log("\nSeed complete:");
  console.log("  BATCH-MED-2024-001 — Active (clean chain)");
  console.log("  BATCH-MED-2024-002 — Active (clean, dispensed)");
  console.log("  BATCH-MED-2024-003 — Suspicious (unauthorized handoff injected)");
  console.log("  BATCH-MED-2024-004 — Recalled (Contamination)");
  console.log("  BATCH-MED-2024-005 — Recalled (Probable Expiry)");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
