import { expect } from "chai";
import hre from "hardhat";

describe("ChainTraceHealth", function () {
  let ethers;
  let loadFixture;

  before(async function () {
    const network = await hre.network.create();
    ethers = network.ethers;
    loadFixture = network.networkHelpers.loadFixture;
  });

  // ─── Fixture ─────────────────────────────────────────────────────────────────
  async function deployFixture() {
    const [manufacturer, distributor1, distributor2, pharmacy, other] = await ethers.getSigners();

    const ChainTraceHealth = await ethers.getContractFactory("ChainTraceHealth");
    const contract = await ChainTraceHealth.deploy();

    // Test batch parameters
    const batchId = "BATCH-TEST-001";
    const medicineName = "TestMed 500mg";
    const now = Math.floor(Date.now() / 1000);
    const mfgDate = now - 86400 * 10;   // 10 days ago
    const expDate  = now + 86400 * 365; // 1 year from now
    const quantity = 100;
    const location = "Test City";

    return {
      contract,
      manufacturer,
      distributor1,
      distributor2,
      pharmacy,
      other,
      batchId,
      medicineName,
      mfgDate,
      expDate,
      quantity,
      location,
    };
  }

  async function deployAndRegisterFixture() {
    const f = await deployFixture();
    await f.contract.registerBatch(
      f.batchId, f.medicineName, f.mfgDate, f.expDate, f.quantity, f.location
    );
    return f;
  }

  async function deployRegisterAndWhitelistFixture() {
    const f = await deployAndRegisterFixture();
    // Whitelist distributor1 and pharmacy under manufacturer
    await f.contract.addApprovedPartner(f.distributor1.address);
    await f.contract.addApprovedPartner(f.pharmacy.address);
    // Whitelist pharmacy under distributor1
    await f.contract.connect(f.distributor1).addApprovedPartner(f.pharmacy.address);
    return f;
  }

  // ─── Deployment ──────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("deploys with zero batches", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.getBatchCount()).to.equal(0);
    });
  });

  // ─── registerBatch ────────────────────────────────────────────────────────────
  describe("registerBatch", function () {
    it("registers a batch and creates genesis event", async function () {
      const { contract, manufacturer, batchId, medicineName, mfgDate, expDate, quantity, location } =
        await loadFixture(deployFixture);

      await expect(contract.registerBatch(batchId, medicineName, mfgDate, expDate, quantity, location))
        .to.emit(contract, "BatchRegistered")
        .and.to.emit(contract, "SupplyChainEventAdded");

      expect(await contract.getBatchCount()).to.equal(1);

      const [exists, mName, bId, , , qty, mfr, status] = await contract.verifyBatch(batchId);
      expect(exists).to.be.true;
      expect(mName).to.equal(medicineName);
      expect(bId).to.equal(batchId);
      expect(qty).to.equal(quantity);
      expect(mfr).to.equal(manufacturer.address);
      expect(status).to.equal(0); // Status.Active
    });

    it("creates a genesis event with authorized=true", async function () {
      const { contract, manufacturer, batchId, medicineName, mfgDate, expDate, quantity, location } =
        await loadFixture(deployFixture);

      await contract.registerBatch(batchId, medicineName, mfgDate, expDate, quantity, location);
      const history = await contract.getBatchHistory(batchId);

      expect(history.length).to.equal(1);
      expect(history[0].actor).to.equal(manufacturer.address);
      expect(history[0].role).to.equal("Manufacturer");
      expect(history[0].authorized).to.be.true;
    });

    it("reverts on duplicate batch ID", async function () {
      const { contract, batchId, medicineName, mfgDate, expDate, quantity, location } =
        await loadFixture(deployAndRegisterFixture);

      await expect(
        contract.registerBatch(batchId, medicineName, mfgDate, expDate, quantity, location)
      ).to.be.revertedWith("Batch ID already registered");
    });

    it("reverts with empty batch ID", async function () {
      const { contract, medicineName, mfgDate, expDate, quantity, location } =
        await loadFixture(deployFixture);

      await expect(
        contract.registerBatch("", medicineName, mfgDate, expDate, quantity, location)
      ).to.be.revertedWith("Batch ID required");
    });

    it("reverts with empty medicine name", async function () {
      const { contract, batchId, mfgDate, expDate, quantity, location } =
        await loadFixture(deployFixture);

      await expect(
        contract.registerBatch(batchId, "", mfgDate, expDate, quantity, location)
      ).to.be.revertedWith("Medicine name required");
    });

    it("reverts when manufacturing date >= expiry date", async function () {
      const { contract, batchId, medicineName, expDate, quantity, location } =
        await loadFixture(deployFixture);

      await expect(
        contract.registerBatch(batchId, medicineName, expDate, expDate, quantity, location)
      ).to.be.revertedWith("Manufacturing date must be before expiry");
    });

    it("reverts with zero quantity", async function () {
      const { contract, batchId, medicineName, mfgDate, expDate, location } =
        await loadFixture(deployFixture);

      await expect(
        contract.registerBatch(batchId, medicineName, mfgDate, expDate, 0, location)
      ).to.be.revertedWith("Quantity must be positive");
    });
  });

  // ─── addApprovedPartner / removeApprovedPartner ───────────────────────────────
  describe("Whitelist Management", function () {
    it("allows any address to add a partner to their own whitelist", async function () {
      const { contract, manufacturer, distributor1 } = await loadFixture(deployFixture);

      await expect(contract.addApprovedPartner(distributor1.address))
        .to.emit(contract, "PartnerAdded")
        .withArgs(manufacturer.address, distributor1.address);

      expect(await contract.isApprovedPartner(manufacturer.address, distributor1.address)).to.be.true;
    });

    it("returns correct partner list after add", async function () {
      const { contract, distributor1, distributor2 } = await loadFixture(deployFixture);

      await contract.addApprovedPartner(distributor1.address);
      await contract.addApprovedPartner(distributor2.address);

      const partners = await contract.getApprovedPartners(
        (await ethers.getSigners())[0].address
      );
      expect(partners.length).to.equal(2);
    });

    it("reverts adding self as partner", async function () {
      const { contract, manufacturer } = await loadFixture(deployFixture);

      await expect(contract.addApprovedPartner(manufacturer.address))
        .to.be.revertedWith("Cannot approve self");
    });

    it("reverts adding zero address", async function () {
      const { contract } = await loadFixture(deployFixture);

      await expect(contract.addApprovedPartner(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid partner address");
    });

    it("reverts adding duplicate partner", async function () {
      const { contract, distributor1 } = await loadFixture(deployFixture);

      await contract.addApprovedPartner(distributor1.address);
      await expect(contract.addApprovedPartner(distributor1.address))
        .to.be.revertedWith("Already approved");
    });

    it("removes a partner and updates list", async function () {
      const { contract, manufacturer, distributor1 } = await loadFixture(deployFixture);

      await contract.addApprovedPartner(distributor1.address);
      expect(await contract.isApprovedPartner(manufacturer.address, distributor1.address)).to.be.true;

      await expect(contract.removeApprovedPartner(distributor1.address))
        .to.emit(contract, "PartnerRemoved")
        .withArgs(manufacturer.address, distributor1.address);

      expect(await contract.isApprovedPartner(manufacturer.address, distributor1.address)).to.be.false;

      const partners = await contract.getApprovedPartners(manufacturer.address);
      expect(partners.length).to.equal(0);
    });

    it("reverts removing a non-partner", async function () {
      const { contract, distributor1 } = await loadFixture(deployFixture);

      await expect(contract.removeApprovedPartner(distributor1.address))
        .to.be.revertedWith("Not an approved partner");
    });
  });

  // ─── addSupplyChainEvent — authorized path ────────────────────────────────────
  describe("addSupplyChainEvent — authorized", function () {
    it("authorized distributor can add event, status stays Active", async function () {
      const { contract, distributor1, batchId } =
        await loadFixture(deployRegisterAndWhitelistFixture);

      const contractAsD1 = contract.connect(distributor1);
      await expect(contractAsD1.addSupplyChainEvent(batchId, "Distributor", "Delhi Hub"))
        .to.emit(contract, "SupplyChainEventAdded");

      const [, , , , , , , status] = await contract.verifyBatch(batchId);
      expect(status).to.equal(0); // Status.Active

      const history = await contract.getBatchHistory(batchId);
      expect(history.length).to.equal(2);
      expect(history[1].actor).to.equal(distributor1.address);
      expect(history[1].authorized).to.be.true;
    });

    it("authorized pharmacy can add event after authorized distributor", async function () {
      const { contract, distributor1, pharmacy, batchId } =
        await loadFixture(deployRegisterAndWhitelistFixture);

      await contract.connect(distributor1).addSupplyChainEvent(batchId, "Distributor", "Delhi Hub");
      await contract.connect(pharmacy).addSupplyChainEvent(batchId, "Pharmacy", "Apollo Pharmacy");

      const history = await contract.getBatchHistory(batchId);
      expect(history.length).to.equal(3);
      expect(history[2].authorized).to.be.true;
      expect(history[2].actor).to.equal(pharmacy.address);
    });
  });

  // ─── addSupplyChainEvent — unauthorized path ──────────────────────────────────
  describe("addSupplyChainEvent — unauthorized", function () {
    it("unauthorized actor: authorized=false, status flips to Suspicious", async function () {
      const { contract, distributor2, batchId } =
        await loadFixture(deployRegisterAndWhitelistFixture);

      // distributor2 is NOT on manufacturer's whitelist
      const contractAsD2 = contract.connect(distributor2);
      await expect(contractAsD2.addSupplyChainEvent(batchId, "Distributor", "Unknown Location"))
        .to.emit(contract, "SupplyChainEventAdded");

      const [, , , , , , , status] = await contract.verifyBatch(batchId);
      expect(status).to.equal(1); // Status.Suspicious

      const history = await contract.getBatchHistory(batchId);
      expect(history[history.length - 1].authorized).to.be.false;
    });

    it("second unauthorized event does not re-flip status (already Suspicious)", async function () {
      const { contract, distributor2, other, batchId } =
        await loadFixture(deployRegisterAndWhitelistFixture);

      await contract.connect(distributor2).addSupplyChainEvent(batchId, "Distributor", "Unknown A");
      await contract.connect(other).addSupplyChainEvent(batchId, "Distributor", "Unknown B");

      const [, , , , , , , status] = await contract.verifyBatch(batchId);
      expect(status).to.equal(1); // Still Suspicious, not changed further
    });

    it("reverts adding event to a recalled batch", async function () {
      const { contract, distributor1, batchId } =
        await loadFixture(deployRegisterAndWhitelistFixture);

      await contract.recallBatch(batchId, "Contamination");
      await expect(
        contract.connect(distributor1).addSupplyChainEvent(batchId, "Distributor", "Delhi")
      ).to.be.revertedWith("Cannot add events to a recalled batch");
    });

    it("reverts with empty role", async function () {
      const { contract, distributor1, batchId } =
        await loadFixture(deployRegisterAndWhitelistFixture);

      await expect(
        contract.connect(distributor1).addSupplyChainEvent(batchId, "", "Delhi")
      ).to.be.revertedWith("Role required");
    });

    it("reverts with empty location", async function () {
      const { contract, distributor1, batchId } =
        await loadFixture(deployRegisterAndWhitelistFixture);

      await expect(
        contract.connect(distributor1).addSupplyChainEvent(batchId, "Distributor", "")
      ).to.be.revertedWith("Location required");
    });

    it("reverts on non-existent batch", async function () {
      const { contract, distributor1 } = await loadFixture(deployFixture);

      await expect(
        contract.connect(distributor1).addSupplyChainEvent("NO-SUCH-BATCH", "Distributor", "Delhi")
      ).to.be.revertedWith("Batch does not exist");
    });
  });

  // ─── getDivergencePoint ────────────────────────────────────────────────────────
  describe("getDivergencePoint", function () {
    it("returns (lastAuthorized, firstUnauthorized) correctly", async function () {
      const { contract, distributor1, distributor2, batchId } =
        await loadFixture(deployRegisterAndWhitelistFixture);

      // Authorized handoff: manufacturer → distributor1
      await contract.connect(distributor1).addSupplyChainEvent(batchId, "Distributor", "Delhi");
      // Unauthorized handoff: distributor1 → distributor2 (not on distributor1's whitelist yet)
      await contract.connect(distributor2).addSupplyChainEvent(batchId, "Distributor", "Unknown");

      const [lastAuth, firstUnauth] = await contract.getDivergencePoint(batchId);
      expect(lastAuth.toLowerCase()).to.equal(distributor1.address.toLowerCase());
      expect(firstUnauth.toLowerCase()).to.equal(distributor2.address.toLowerCase());
    });

    it("returns (address(0), address(0)) when no divergence exists", async function () {
      const { contract, distributor1, batchId } =
        await loadFixture(deployRegisterAndWhitelistFixture);

      await contract.connect(distributor1).addSupplyChainEvent(batchId, "Distributor", "Delhi");

      const [lastAuth, firstUnauth] = await contract.getDivergencePoint(batchId);
      expect(lastAuth).to.equal(ethers.ZeroAddress);
      expect(firstUnauth).to.equal(ethers.ZeroAddress);
    });

    it("identifies first divergence point even if multiple unauthorized events exist", async function () {
      const { contract, manufacturer, distributor1, distributor2, other, batchId } =
        await loadFixture(deployRegisterAndWhitelistFixture);

      // manufacturer → distributor1 (authorized)
      await contract.connect(distributor1).addSupplyChainEvent(batchId, "Distributor", "Delhi");
      // distributor1 → distributor2 (unauthorized — distributor2 not on distributor1's list)
      await contract.connect(distributor2).addSupplyChainEvent(batchId, "Distributor", "Unknown A");
      // distributor2 → other (also unauthorized)
      await contract.connect(other).addSupplyChainEvent(batchId, "Distributor", "Unknown B");

      // Divergence point should be at the FIRST break: distributor1 → distributor2
      const [lastAuth, firstUnauth] = await contract.getDivergencePoint(batchId);
      expect(lastAuth.toLowerCase()).to.equal(distributor1.address.toLowerCase());
      expect(firstUnauth.toLowerCase()).to.equal(distributor2.address.toLowerCase());
    });

    it("reverts on non-existent batch", async function () {
      const { contract } = await loadFixture(deployFixture);

      await expect(contract.getDivergencePoint("NO-SUCH-BATCH"))
        .to.be.revertedWith("Batch does not exist");
    });
  });

  // ─── recallBatch ──────────────────────────────────────────────────────────────
  describe("recallBatch", function () {
    it("manufacturer can recall a batch with a reason", async function () {
      const { contract, batchId } = await loadFixture(deployAndRegisterFixture);

      await expect(contract.recallBatch(batchId, "Contamination"))
        .to.emit(contract, "BatchRecalled");

      const [, , , , , , , status, reason] = await contract.verifyBatch(batchId);
      expect(status).to.equal(2); // Status.Recalled
      expect(reason).to.equal("Contamination");
    });

    it("reverts if non-manufacturer tries to recall", async function () {
      const { contract, distributor1, batchId } = await loadFixture(deployAndRegisterFixture);

      await expect(
        contract.connect(distributor1).recallBatch(batchId, "Contamination")
      ).to.be.revertedWith("Only the batch manufacturer can recall");
    });

    it("reverts with empty reason", async function () {
      const { contract, batchId } = await loadFixture(deployAndRegisterFixture);

      await expect(contract.recallBatch(batchId, ""))
        .to.be.revertedWith("Recall reason required");
    });

    it("reverts on non-existent batch", async function () {
      const { contract } = await loadFixture(deployFixture);

      await expect(contract.recallBatch("NO-SUCH-BATCH", "Contamination"))
        .to.be.revertedWith("Batch does not exist");
    });

    it("stores all valid recall reasons correctly", async function () {
      const { contract, manufacturer, medicineName, mfgDate, expDate, quantity, location } =
        await loadFixture(deployFixture);

      const reasons = [
        "Confirmed Expiry",
        "Probable Expiry",
        "Quality Defect",
        "Contamination",
        "Other",
      ];

      for (let i = 0; i < reasons.length; i++) {
        const bid = `BATCH-RECALL-${i}`;
        await contract.registerBatch(bid, medicineName, mfgDate, expDate, quantity, location);
        await contract.recallBatch(bid, reasons[i]);
        const [, , , , , , , status, reason] = await contract.verifyBatch(bid);
        expect(status).to.equal(2); // Status.Recalled
        expect(reason).to.equal(reasons[i]);
      }
    });
  });

  // ─── verifyBatch (read) ────────────────────────────────────────────────────────
  describe("verifyBatch", function () {
    it("returns false exists for unregistered batch", async function () {
      const { contract } = await loadFixture(deployFixture);
      const [exists] = await contract.verifyBatch("NON-EXISTENT");
      expect(exists).to.be.false;
    });

    it("returns correct data for registered batch", async function () {
      const { contract, manufacturer, batchId, medicineName, mfgDate, expDate, quantity } =
        await loadFixture(deployAndRegisterFixture);

      const [exists, mName, bId, mDate, eDate, qty, mfr, status] =
        await contract.verifyBatch(batchId);

      expect(exists).to.be.true;
      expect(mName).to.equal(medicineName);
      expect(bId).to.equal(batchId);
      expect(mDate).to.equal(mfgDate);
      expect(eDate).to.equal(expDate);
      expect(qty).to.equal(quantity);
      expect(mfr).to.equal(manufacturer.address);
      expect(status).to.equal(0); // Active
    });
  });

  // ─── getBatchHistory (read) ────────────────────────────────────────────────────
  describe("getBatchHistory", function () {
    it("returns full event array in order", async function () {
      const { contract, manufacturer, distributor1, pharmacy, batchId } =
        await loadFixture(deployRegisterAndWhitelistFixture);

      await contract.connect(distributor1).addSupplyChainEvent(batchId, "Distributor", "Delhi");
      await contract.connect(pharmacy).addSupplyChainEvent(batchId, "Pharmacy", "Apollo");

      const history = await contract.getBatchHistory(batchId);
      expect(history.length).to.equal(3);
      expect(history[0].actor).to.equal(manufacturer.address);
      expect(history[1].actor).to.equal(distributor1.address);
      expect(history[2].actor).to.equal(pharmacy.address);
    });

    it("reverts on non-existent batch", async function () {
      const { contract } = await loadFixture(deployFixture);

      await expect(contract.getBatchHistory("NO-SUCH-BATCH"))
        .to.be.revertedWith("Batch does not exist");
    });
  });

  // ─── getAllBatchHashes (aggregation support) ───────────────────────────────────
  describe("getAllBatchHashes", function () {
    it("returns all batch hashes after multiple registrations", async function () {
      const { contract, medicineName, mfgDate, expDate, quantity, location } =
        await loadFixture(deployFixture);

      await contract.registerBatch("B1", medicineName, mfgDate, expDate, quantity, location);
      await contract.registerBatch("B2", medicineName, mfgDate, expDate, quantity, location);
      await contract.registerBatch("B3", medicineName, mfgDate, expDate, quantity, location);

      const hashes = await contract.getAllBatchHashes();
      expect(hashes.length).to.equal(3);
    });
  });
});
