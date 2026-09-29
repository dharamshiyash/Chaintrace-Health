import { expect } from "chai";
import hre from "hardhat";
import { getDb, localDb } from "../api/_lib/db.js";
import {
  scopeAndEnrichBatches,
  getRequesterContext,
  canAccessBatch,
  deriveRoleStatus,
} from "../api/_lib/visibilityService.js";

describe("ChainTrace Health — Supply Chain Workflow & Scoping Suite", function () {
  let ethers;
  let contract;
  let manufacturer;
  let distributor1;
  let distributor2;
  let pharmacy1;
  let pharmacy2;
  let unauthorizedActor;

  before(async function () {
    const network = await hre.network.create();
    ethers = network.ethers;

    [manufacturer, distributor1, distributor2, pharmacy1, pharmacy2, unauthorizedActor] =
      await ethers.getSigners();

    const ChainTraceHealth = await ethers.getContractFactory("ChainTraceHealth");
    contract = await ChainTraceHealth.deploy();
  });

  describe("1. Smart Contract Canonical State & Recall Enforcement", function () {
    const testBatchId = "BATCH-WORKFLOW-001";
    const now = Math.floor(Date.now() / 1000);

    it("registers genesis batch under manufacturer and sets status to Active (0)", async function () {
      await contract.connect(manufacturer).registerBatch(
        testBatchId,
        "Azithromycin 250mg",
        now - 86400,
        now + 86400 * 180,
        500,
        "Mumbai Facility"
      );

      const batch = await contract.verifyBatch(testBatchId);
      expect(batch[0]).to.be.true; // exists
      expect(Number(batch[7])).to.equal(0); // 0 = Active
      expect(batch[6]).to.equal(manufacturer.address); // manufacturer
    });

    it("allows registered manufacturer to recall batch and updates canonical state to Recalled (2)", async function () {
      await contract.connect(manufacturer).recallBatch(
        testBatchId,
        "Quality control anomaly detected: packaging seal failure"
      );

      const batch = await contract.verifyBatch(testBatchId);
      expect(Number(batch[7])).to.equal(2); // 2 = Recalled
      expect(batch[8]).to.include("packaging seal failure"); // recallReason
    });

    it("reverts any subsequent supply chain event on recalled batch with 'Cannot add events to a recalled batch'", async function () {
      // Distributor attempts to log receipt or transfer on the recalled batch
      await expect(
        contract.connect(distributor1).addSupplyChainEvent(
          testBatchId,
          "DISTRIBUTOR",
          "Delhi Warehouse"
        )
      ).to.be.revertedWith("Cannot add events to a recalled batch");
    });

    it("reverts when a non-manufacturer attempts to recall a batch", async function () {
      const batchId2 = "BATCH-WORKFLOW-002";
      await contract.connect(manufacturer).registerBatch(
        batchId2,
        "Paracetamol 500mg",
        now - 86400,
        now + 86400 * 365,
        1000,
        "Ahmedabad Plant"
      );

      await expect(
        contract.connect(distributor1).recallBatch(batchId2, "Unauthorized recall attempt")
      ).to.be.revertedWith("Only the batch manufacturer can recall");
    });

    it("detects unauthorized intermediary and flags canonical state to Suspicious (1)", async function () {
      const batchId3 = "BATCH-WORKFLOW-003";
      await contract.connect(manufacturer).registerBatch(
        batchId3,
        "Metformin 850mg",
        now - 86400,
        now + 86400 * 365,
        2000,
        "Hyderabad Facility"
      );

      // Manufacturer whitelists distributor1
      await contract.connect(manufacturer).addApprovedPartner(distributor1.address);

      // Unauthorized actor tries to insert itself into custody
      await contract.connect(unauthorizedActor).addSupplyChainEvent(
        batchId3,
        "DISTRIBUTOR",
        "Unknown Depot"
      );

      const batch = await contract.verifyBatch(batchId3);
      expect(Number(batch[7])).to.equal(1); // 1 = Suspicious

      const divergence = await contract.getDivergencePoint(batchId3);
      expect(divergence[0]).to.equal(manufacturer.address);
      expect(divergence[1]).to.equal(unauthorizedActor.address);
    });
  });

  describe("2. Organization-Scoped Inventory Visibility", function () {
    const db = getDb();

    it("scopes manufacturer inventory to only batches manufactured by Apex", function () {
      const apexAddr = "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD".toLowerCase();
      const context = getRequesterContext({
        user_address: apexAddr,
        role: "manufacturer",
        org_name: "Apex BioPharma (Origin Node)",
      });

      const { batches, counts } = scopeAndEnrichBatches(localDb.getAllBatches(), context, "ALL");
      expect(batches.length).to.be.greaterThan(0);

      // Every batch must have Apex as the manufacturer
      for (const b of batches) {
        expect(b.manufacturer.toLowerCase()).to.equal(apexAddr);
      }
      expect(counts.all).to.equal(batches.length);
    });

    it("enforces distributor isolation: Novartis cannot see batches assigned to Central Wholesale", function () {
      const novartisAddr = "0xc26535042E34fDf8E56015f2fB6FE175f9A25365".toLowerCase();
      const centralDistAddr = "0x2Bd8a4078832a8C3775685B643442ffA567b47f3".toLowerCase();

      const novartisContext = getRequesterContext({
        user_address: novartisAddr,
        role: "distributor",
        org_name: "Novartis Global Logistics (Distributor 1)",
      });

      const { batches: novartisBatches } = scopeAndEnrichBatches(localDb.getAllBatches(), novartisContext, "ALL");

      // BATCH-MED-2024-006 is assigned exclusively to Central Wholesale Pharma
      const batch6InNovartis = novartisBatches.find(
        (b) => b.batch_id === "BATCH-MED-2024-006"
      );
      expect(batch6InNovartis).to.be.undefined;

      // Check Central Wholesale context
      const centralContext = getRequesterContext({
        user_address: centralDistAddr,
        role: "distributor",
        org_name: "Central Wholesale Pharma (Distributor 2)",
      });
      const { batches: centralBatches } = scopeAndEnrichBatches(localDb.getAllBatches(), centralContext, "ALL");
      const batch6InCentral = centralBatches.find(
        (b) => b.batch_id === "BATCH-MED-2024-006"
      );
      expect(batch6InCentral).to.not.be.undefined;
    });

    it("enforces pharmacy scoping: Apollo sees received stock, MedPlus sees strictly 0 batches", function () {
      const apolloAddr = "0x4e1E0cb18AE2f56F466513c67969cA4E864dF0F3".toLowerCase();
      const medplusAddr = "0x9fC97E4A860F5F6873523f03b51e50882eFF12a1".toLowerCase();

      // Apollo Pharmacy Delhi
      const apolloContext = getRequesterContext({
        user_address: apolloAddr,
        role: "pharmacy",
        org_name: "Apollo Pharmacy Delhi (Healthcare Provider 1)",
      });
      const { batches: apolloBatches, counts: apolloCounts } = scopeAndEnrichBatches(
        localDb.getAllBatches(),
        apolloContext,
        "ALL"
      );
      expect(apolloBatches.length).to.be.greaterThan(0);
      expect(apolloCounts.all).to.equal(apolloBatches.length);

      // MedPlus Retail Healthcare (Never received any medicine handoff)
      const medplusContext = getRequesterContext({
        user_address: medplusAddr,
        role: "pharmacy",
        org_name: "MedPlus Retail Healthcare (Healthcare Provider 2)",
      });
      const { batches: medplusBatches, counts: medplusCounts } = scopeAndEnrichBatches(
        localDb.getAllBatches(),
        medplusContext,
        "ALL"
      );

      // Critical requirement: empty inventory for pharmacy with no stock
      expect(medplusBatches.length).to.equal(0);
      expect(medplusCounts.all).to.equal(0);
      expect(medplusCounts.fresh).to.equal(0);
      expect(medplusCounts.inTransit).to.equal(0);
      expect(medplusCounts.late).to.equal(0);
      expect(medplusCounts.exceptions).to.equal(0);
    });

    it("blocks unauthorized cross-organization single-batch lookup (403 guard)", function () {
      const apolloAddr = "0x4e1E0cb18AE2f56F466513c67969cA4E864dF0F3".toLowerCase();
      const apolloContext = getRequesterContext({
        user_address: apolloAddr,
        role: "pharmacy",
        org_name: "Apollo Pharmacy Delhi (Healthcare Provider 1)",
      });

      // BATCH-MED-2024-006 belongs to Central Wholesale, not Apollo
      const batch6 = db.prepare("SELECT * FROM batches WHERE batch_id = ?").get("BATCH-MED-2024-006");
      const hasAccess = canAccessBatch(apolloContext, batch6);
      expect(hasAccess).to.be.false;
    });
  });

  describe("3. Role-Specific Status Derivation & Filter Integrity", function () {
    it("derives contextual view statuses for manufacturer vs distributor vs pharmacy", function () {
      const batchActiveInTransit = {
        status: "Active",
        current_custodian: "0xc26535042E34fDf8E56015f2fB6FE175f9A25365".toLowerCase(), // Novartis
        manufacturer: "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD".toLowerCase(), // Apex
        destination_address: "0x4e1E0cb18AE2f56F466513c67969cA4E864dF0F3".toLowerCase(), // Apollo
        stage: "In-Transit",
      };

      const events = [
        {
          role: "Distributor",
          action: "IN_TRANSIT_TO_PHARMACY",
          actor: "0xc26535042E34fDf8E56015f2fB6FE175f9A25365".toLowerCase(),
        },
      ];

      // Manufacturer perspective
      const mfgStatus = deriveRoleStatus(
        batchActiveInTransit,
        { role: "manufacturer", address: "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD".toLowerCase() },
        events
      );
      expect(mfgStatus.view_status).to.equal("Dispatched");

      // Distributor perspective (dispatched downstream to pharmacy)
      const dstStatus = deriveRoleStatus(
        batchActiveInTransit,
        { role: "distributor", address: "0xc26535042E34fDf8E56015f2fB6FE175f9A25365".toLowerCase() },
        events
      );
      expect(dstStatus.view_status).to.equal("Dispatched");

      // Distributor perspective (holding in warehouse without downstream dispatch)
      const batchInWarehouse = {
        ...batchActiveInTransit,
        destination_address: null,
        stage: "Fresh",
      };
      const dstWarehouseStatus = deriveRoleStatus(
        batchInWarehouse,
        { role: "distributor", address: "0xc26535042E34fDf8E56015f2fB6FE175f9A25365".toLowerCase() },
        events
      );
      expect(dstWarehouseStatus.view_status).to.equal("Active");

      // Pharmacy perspective (incoming stock)
      const phmStatus = deriveRoleStatus(
        batchActiveInTransit,
        { role: "pharmacy", address: "0x4e1E0cb18AE2f56F466513c67969cA4E864dF0F3".toLowerCase() },
        events
      );
      expect(phmStatus.view_status).to.equal("Incoming");
    });

    it("derives Recalled view status across all roles regardless of physical location", function () {
      const recalledBatch = {
        status: "Recalled",
        current_custodian: "0xc26535042E34fDf8E56015f2fB6FE175f9A25365".toLowerCase(),
        manufacturer: "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD".toLowerCase(),
      };

      const mfgRes = deriveRoleStatus(recalledBatch, { role: "manufacturer", address: recalledBatch.manufacturer });
      expect(mfgRes.view_status).to.equal("Recalled");
      expect(mfgRes.isException).to.be.true;

      const dstRes = deriveRoleStatus(recalledBatch, { role: "distributor", address: recalledBatch.current_custodian });
      expect(dstRes.view_status).to.equal("Recalled");
      expect(dstRes.isException).to.be.true;

      const phmRes = deriveRoleStatus(recalledBatch, { role: "pharmacy", address: "0x4e1E0cb18AE2f56F466513c67969cA4E864dF0F3".toLowerCase() });
      expect(phmRes.view_status).to.equal("Recalled");
      expect(phmRes.isException).to.be.true;
    });

    it("separates recalled and suspicious batches into EXCEPTIONS filter", function () {
      const apexAddr = "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD".toLowerCase();
      const context = getRequesterContext({
        user_address: apexAddr,
        role: "manufacturer",
        org_name: "Apex BioPharma (Origin Node)",
      });

      const { batches: allBatches, counts } = scopeAndEnrichBatches(localDb.getAllBatches(), context, "ALL");
      const { batches: exceptionBatches } = scopeAndEnrichBatches(localDb.getAllBatches(), context, "EXCEPTIONS");

      expect(exceptionBatches.length).to.equal(counts.exceptions);
      for (const eb of exceptionBatches) {
        expect(["Recalled", "Suspicious"]).to.include(eb.status);
        expect(eb.is_anomaly).to.be.true;
      }
    });
  });

  describe("4. State Synchronization Across Blockchain, DB, and Verification", function () {
    const db = getDb();

    it("verifies canonical recall state persistence across database and verification API", function () {
      const batchId = "BATCH-MED-2024-002";
      
      // Update DB to mark recalled via authoritative helper
      localDb.recallBatch({
        batch_id: batchId,
        reason: "Microbial contamination detected",
        recalled_by: "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD",
        tx_hash: "0x1234567890abcdef",
      });

      // Verify DB record
      const updated = db.prepare("SELECT * FROM batches WHERE batch_id = ?").get(batchId);
      expect(updated.status).to.equal("Recalled");
      expect(updated.recall_reason).to.equal("Microbial contamination detected");

      // Verify that enriched role view derives Recalled
      const context = getRequesterContext({
        user_address: updated.manufacturer,
        role: "manufacturer",
        org_name: "Apex BioPharma (Origin Node)",
      });
      const { batches } = scopeAndEnrichBatches(localDb.getAllBatches(), context, "ALL");
      const recalledBatch = batches.find((b) => b.batch_id === batchId);
      expect(recalledBatch.display_status).to.equal("Recalled");
      expect(recalledBatch.is_anomaly).to.be.true;
    });
  });
});
