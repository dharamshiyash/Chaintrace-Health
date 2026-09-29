import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

// File path for SQLite database
const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, "chaintrace.db");

let db;
try {
  db = new DatabaseSync(dbPath);
} catch (err) {
  console.warn("Notice: Falling back to in-memory database:", err.message);
  db = new DatabaseSync(":memory:");
}

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    address     TEXT PRIMARY KEY,
    role        TEXT NOT NULL,
    org_name    TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS batches (
    batch_id            TEXT PRIMARY KEY,
    medicine_name       TEXT NOT NULL,
    manufacturer        TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'Active',
    recall_reason       TEXT,
    recalled_at         TEXT,
    recalled_by         TEXT,
    quantity            INTEGER NOT NULL,
    manufacturing_date  INTEGER NOT NULL,
    expiry_date         INTEGER NOT NULL,
    current_custodian   TEXT NOT NULL,
    current_org         TEXT NOT NULL,
    destination_address TEXT,
    destination_org     TEXT,
    stage               TEXT NOT NULL DEFAULT 'Fresh',
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS supply_chain_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id    TEXT NOT NULL,
    actor       TEXT NOT NULL,
    role        TEXT NOT NULL,
    action      TEXT NOT NULL,
    location    TEXT NOT NULL,
    authorized  INTEGER NOT NULL DEFAULT 1,
    tx_hash     TEXT,
    timestamp   INTEGER NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS partner_whitelist (
    custodian TEXT NOT NULL,
    partner   TEXT NOT NULL,
    approved  INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (custodian, partner)
  );

  CREATE TABLE IF NOT EXISTS tx_performance (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    function_name   TEXT NOT NULL,
    tx_hash         TEXT,
    gas_used        INTEGER,
    confirmation_ms INTEGER,
    execution_ms    INTEGER,
    success         INTEGER NOT NULL DEFAULT 1,
    recorded_at     TEXT NOT NULL
  );
`);

// Standard Known Profiles
const SEED_PROFILES = [
  {
    address: "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD".toLowerCase(),
    role: "manufacturer",
    org_name: "Apex BioPharma (Origin Node)",
  },
  {
    address: "0x76dE5D6Cc4b8305119Ee57eFb7AA68832247595A".toLowerCase(),
    role: "manufacturer",
    org_name: "Bharat Biotech Labs",
  },
  {
    address: "0xc26535042E34fDf8E56015f2fB6FE175f9A25365".toLowerCase(),
    role: "distributor",
    org_name: "Novartis Global Logistics (Distributor 1)",
  },
  {
    address: "0x2Bd8a4078832a8C3775685B643442ffA567b47f3".toLowerCase(),
    role: "distributor",
    org_name: "Central Wholesale Pharma (Distributor 2)",
  },
  {
    address: "0x96CA7FdbF427C815FB50d751b69Dd86Fe10f1ff1".toLowerCase(),
    role: "distributor",
    org_name: "Unauthorized Intermediary (Suspicious Node)",
  },
  {
    address: "0x8aF0B59Ce4F25F5e0AF59309a9a25e8e5a7B09d1".toLowerCase(),
    role: "warehouse",
    org_name: "National Cold Storage Warehouse",
  },
  {
    address: "0x4e1E0cb18AE2f56F466513c67969cA4E864dF0F3".toLowerCase(),
    role: "pharmacy",
    org_name: "Apollo Pharmacy Delhi (Healthcare Provider 1)",
  },
  {
    address: "0x9fC97E4A860F5F6873523f03b51e50882eFF12a1".toLowerCase(),
    role: "pharmacy",
    org_name: "MedPlus Retail Healthcare (Healthcare Provider 2)",
  },
];

// Seed profiles
const insertProfile = db.prepare(`
  INSERT OR IGNORE INTO profiles (address, role, org_name, created_at)
  VALUES (?, ?, ?, ?)
`);
const nowIso = new Date().toISOString();
for (const p of SEED_PROFILES) {
  insertProfile.run(p.address, p.role, p.org_name, nowIso);
}

// Seed partner whitelist
const insertWhitelist = db.prepare(`
  INSERT OR IGNORE INTO partner_whitelist (custodian, partner, approved)
  VALUES (?, ?, ?)
`);
const apexAddr = "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD".toLowerCase();
const novartisAddr = "0xc26535042E34fDf8E56015f2fB6FE175f9A25365".toLowerCase();
const centralDistAddr = "0x2Bd8a4078832a8C3775685B643442ffA567b47f3".toLowerCase();
const apolloAddr = "0x4e1E0cb18AE2f56F466513c67969cA4E864dF0F3".toLowerCase();
const medplusAddr = "0x9fC97E4A860F5F6873523f03b51e50882eFF12a1".toLowerCase();

insertWhitelist.run(apexAddr, novartisAddr, 1);
insertWhitelist.run(apexAddr, centralDistAddr, 1);
insertWhitelist.run(novartisAddr, apolloAddr, 1);
insertWhitelist.run(centralDistAddr, medplusAddr, 1);

// Seed initial on-chain batches if empty
const countStmt = db.prepare("SELECT COUNT(*) as count FROM batches");
const currentCount = countStmt.get().count;

if (currentCount === 0) {
  const seedBatches = [
    {
      batch_id: "BATCH-MED-2024-001",
      medicine_name: "Amoxicillin 500mg",
      manufacturer: apexAddr,
      status: "Active",
      recall_reason: null,
      recalled_at: null,
      recalled_by: null,
      quantity: 1000,
      manufacturing_date: Math.floor(Date.now() / 1000) - 86400 * 30,
      expiry_date: Math.floor(Date.now() / 1000) + 86400 * 365,
      current_custodian: apolloAddr,
      current_org: "Apollo Pharmacy Delhi (Healthcare Provider 1)",
      destination_address: apolloAddr,
      destination_org: "Apollo Pharmacy Delhi (Healthcare Provider 1)",
      stage: "Delivered",
      created_at: new Date(Date.now() - 86400 * 30 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      events: [
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "REGISTERED",
          location: "Mumbai Manufacturing Facility",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 30,
        },
        {
          actor: novartisAddr,
          role: "Distributor",
          action: "RECEIVED",
          location: "Delhi Distribution Center",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 20,
        },
        {
          actor: apolloAddr,
          role: "Pharmacy",
          action: "RECEIVED",
          location: "Apollo Pharmacy, Delhi",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 10,
        },
      ],
    },
    {
      batch_id: "BATCH-MED-2024-002",
      medicine_name: "Paracetamol 650mg",
      manufacturer: apexAddr,
      status: "Active",
      recall_reason: null,
      recalled_at: null,
      recalled_by: null,
      quantity: 500,
      manufacturing_date: Math.floor(Date.now() / 1000) - 86400 * 25,
      expiry_date: Math.floor(Date.now() / 1000) + 86400 * 365,
      current_custodian: apolloAddr,
      current_org: "Apollo Pharmacy Delhi (Healthcare Provider 1)",
      destination_address: apolloAddr,
      destination_org: "Apollo Pharmacy Delhi (Healthcare Provider 1)",
      stage: "Delivered",
      created_at: new Date(Date.now() - 86400 * 25 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      events: [
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "REGISTERED",
          location: "Pune Manufacturing Facility",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 25,
        },
        {
          actor: novartisAddr,
          role: "Distributor",
          action: "RECEIVED",
          location: "Chennai Distribution Hub",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 15,
        },
        {
          actor: apolloAddr,
          role: "Pharmacy",
          action: "RECEIVED",
          location: "Apollo Pharmacy, Delhi",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 5,
        },
      ],
    },
    {
      batch_id: "BATCH-MED-2024-003",
      medicine_name: "Atorvastatin 10mg",
      manufacturer: apexAddr,
      status: "Suspicious",
      recall_reason: null,
      recalled_at: null,
      recalled_by: null,
      quantity: 2000,
      manufacturing_date: Math.floor(Date.now() / 1000) - 86400 * 20,
      expiry_date: Math.floor(Date.now() / 1000) + 86400 * 365,
      current_custodian: "0x96CA7FdbF427C815FB50d751b69Dd86Fe10f1ff1".toLowerCase(),
      current_org: "Unauthorized Intermediary (Suspicious Node)",
      destination_address: "0x96CA7FdbF427C815FB50d751b69Dd86Fe10f1ff1".toLowerCase(),
      destination_org: "Unauthorized Intermediary (Suspicious Node)",
      stage: "Exception",
      created_at: new Date(Date.now() - 86400 * 20 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      events: [
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "REGISTERED",
          location: "Hyderabad Manufacturing Plant",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 20,
        },
        {
          actor: novartisAddr,
          role: "Distributor",
          action: "RECEIVED",
          location: "Hyderabad Distribution Center",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 14,
        },
        {
          actor: "0x96CA7FdbF427C815FB50d751b69Dd86Fe10f1ff1".toLowerCase(),
          role: "Distributor",
          action: "RECEIVED",
          location: "Unknown Warehouse, Hyderabad",
          authorized: 0,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 7,
        },
      ],
    },
    {
      batch_id: "BATCH-MED-2024-004",
      medicine_name: "Metformin 1000mg",
      manufacturer: apexAddr,
      status: "Recalled",
      recall_reason: "Contamination",
      recalled_at: new Date(Date.now() - 86400 * 2 * 1000).toISOString(),
      recalled_by: apexAddr,
      quantity: 750,
      manufacturing_date: Math.floor(Date.now() / 1000) - 86400 * 18,
      expiry_date: Math.floor(Date.now() / 1000) + 86400 * 365,
      current_custodian: apexAddr,
      current_org: "Apex BioPharma (Origin Node)",
      destination_address: null,
      destination_org: null,
      stage: "Exception",
      created_at: new Date(Date.now() - 86400 * 18 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      events: [
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "REGISTERED",
          location: "Bengaluru Manufacturing Facility",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 18,
        },
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "RECALLED",
          location: "Quality Control Recall: Contamination",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 2,
        },
      ],
    },
    {
      batch_id: "BATCH-MED-2024-005",
      medicine_name: "Azithromycin 250mg",
      manufacturer: apexAddr,
      status: "Recalled",
      recall_reason: "Probable Expiry",
      recalled_at: new Date(Date.now() - 86400 * 1 * 1000).toISOString(),
      recalled_by: apexAddr,
      quantity: 300,
      manufacturing_date: Math.floor(Date.now() / 1000) - 86400 * 15,
      expiry_date: Math.floor(Date.now() / 1000) + 86400 * 7,
      current_custodian: apexAddr,
      current_org: "Apex BioPharma (Origin Node)",
      destination_address: null,
      destination_org: null,
      stage: "Exception",
      created_at: new Date(Date.now() - 86400 * 15 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      events: [
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "REGISTERED",
          location: "Kolkata Manufacturing Hub",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 15,
        },
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "RECALLED",
          location: "Regulatory Recall: Probable Expiry",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 1,
        },
      ],
    },
    {
      batch_id: "BATCH-MED-2024-006",
      medicine_name: "Ciprofloxacin 500mg",
      manufacturer: "0x76dE5D6Cc4b8305119Ee57eFb7AA68832247595A".toLowerCase(),
      status: "Active",
      recall_reason: null,
      recalled_at: null,
      recalled_by: null,
      quantity: 1200,
      manufacturing_date: Math.floor(Date.now() / 1000) - 86400 * 3,
      expiry_date: Math.floor(Date.now() / 1000) + 86400 * 400,
      current_custodian: "0x76dE5D6Cc4b8305119Ee57eFb7AA68832247595A".toLowerCase(),
      current_org: "Bharat Biotech Labs",
      destination_address: centralDistAddr,
      destination_org: "Central Wholesale Pharma (Distributor 2)",
      stage: "In-Transit",
      created_at: new Date(Date.now() - 86400 * 3 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      events: [
        {
          actor: "0x76dE5D6Cc4b8305119Ee57eFb7AA68832247595A".toLowerCase(),
          role: "Manufacturer",
          action: "REGISTERED",
          location: "Ahmedabad Production Plant",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 3,
        },
        {
          actor: "0x76dE5D6Cc4b8305119Ee57eFb7AA68832247595A".toLowerCase(),
          role: "Manufacturer",
          action: "DISPATCHED_TO_DISTRIBUTOR",
          location: "Transit to Central Wholesale",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 2,
        },
      ],
    },
  ];

  const insertBatch = db.prepare(`
    INSERT INTO batches (
      batch_id, medicine_name, manufacturer, status, recall_reason, recalled_at, recalled_by,
      quantity, manufacturing_date, expiry_date, current_custodian, current_org,
      destination_address, destination_org, stage, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO supply_chain_events (
      batch_id, actor, role, action, location, authorized, tx_hash, timestamp, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const b of seedBatches) {
    insertBatch.run(
      b.batch_id,
      b.medicine_name,
      b.manufacturer,
      b.status,
      b.recall_reason,
      b.recalled_at,
      b.recalled_by,
      b.quantity,
      b.manufacturing_date,
      b.expiry_date,
      b.current_custodian,
      b.current_org,
      b.destination_address,
      b.destination_org,
      b.stage,
      b.created_at,
      b.updated_at
    );

    for (const ev of b.events) {
      insertEvent.run(
        b.batch_id,
        ev.actor,
        ev.role,
        ev.action,
        ev.location,
        ev.authorized,
        null,
        ev.timestamp,
        new Date(ev.timestamp * 1000).toISOString()
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Database Helper Methods
// ─────────────────────────────────────────────────────────────────────────────

export const localDb = {
  // Profiles
  getProfile(address) {
    if (!address) return null;
    return db.prepare("SELECT * FROM profiles WHERE lower(address) = lower(?)").get(address);
  },

  getAllProfiles() {
    return db.prepare("SELECT * FROM profiles").all();
  },

  saveProfile({ address, role, org_name }) {
    const cleanAddr = address.toLowerCase();
    db.prepare(`
      INSERT OR REPLACE INTO profiles (address, role, org_name, created_at)
      VALUES (?, ?, ?, COALESCE((SELECT created_at FROM profiles WHERE lower(address) = lower(?)), ?))
    `).run(cleanAddr, role, org_name, cleanAddr, new Date().toISOString());
    return this.getProfile(cleanAddr);
  },

  // Batches
  getAllBatches() {
    return db.prepare("SELECT * FROM batches ORDER BY created_at DESC").all();
  },

  getBatchById(batchId) {
    if (!batchId) return null;
    return db.prepare("SELECT * FROM batches WHERE lower(batch_id) = lower(?)").get(batchId);
  },

  createBatch({
    batch_id,
    medicine_name,
    manufacturer,
    quantity,
    manufacturing_date,
    expiry_date,
    location,
    tx_hash,
  }) {
    const now = new Date().toISOString();
    const cleanId = String(batch_id).trim();
    const mfrClean = String(manufacturer).toLowerCase();

    const profile = this.getProfile(mfrClean);
    const orgName = profile?.org_name || "Authorized Manufacturer";

    db.prepare(`
      INSERT OR REPLACE INTO batches (
        batch_id, medicine_name, manufacturer, status, recall_reason, recalled_at, recalled_by,
        quantity, manufacturing_date, expiry_date, current_custodian, current_org,
        destination_address, destination_org, stage, created_at, updated_at
      ) VALUES (?, ?, ?, 'Active', NULL, NULL, NULL, ?, ?, ?, ?, ?, NULL, NULL, 'Fresh', ?, ?)
    `).run(
      cleanId,
      medicine_name || "Medicine Batch",
      mfrClean,
      Number(quantity) || 100,
      Number(manufacturing_date) || Math.floor(Date.now() / 1000),
      Number(expiry_date) || Math.floor(Date.now() / 1000) + 86400 * 365,
      mfrClean,
      orgName,
      now,
      now
    );

    // Genesis Event
    db.prepare(`
      INSERT INTO supply_chain_events (
        batch_id, actor, role, action, location, authorized, tx_hash, timestamp, created_at
      ) VALUES (?, ?, 'Manufacturer', 'REGISTERED', ?, 1, ?, ?, ?)
    `).run(
      cleanId,
      mfrClean,
      location || "Manufacturing Facility",
      tx_hash || null,
      Math.floor(Date.now() / 1000),
      now
    );

    return this.getBatchById(cleanId);
  },

  recallBatch({ batch_id, reason, recalled_by, tx_hash }) {
    const cleanId = String(batch_id).trim();
    const existing = this.getBatchById(cleanId);
    if (!existing) {
      throw new Error(`Batch "${cleanId}" does not exist`);
    }
    if (existing.status === "Recalled") {
      return existing; // already recalled
    }

    const now = new Date().toISOString();
    const cleanBy = (recalled_by || existing.manufacturer).toLowerCase();

    db.prepare(`
      UPDATE batches
      SET status = 'Recalled',
          recall_reason = ?,
          recalled_at = ?,
          recalled_by = ?,
          stage = 'Exception',
          updated_at = ?
      WHERE lower(batch_id) = lower(?)
    `).run(reason || "Quality Defect", now, cleanBy, now, cleanId);

    // Record recall event in history
    db.prepare(`
      INSERT INTO supply_chain_events (
        batch_id, actor, role, action, location, authorized, tx_hash, timestamp, created_at
      ) VALUES (?, ?, 'Manufacturer', 'RECALLED', ?, 1, ?, ?, ?)
    `).run(
      cleanId,
      cleanBy,
      `Official Recall Notice: ${reason || "Quality Defect"}`,
      tx_hash || null,
      Math.floor(Date.now() / 1000),
      now
    );

    return this.getBatchById(cleanId);
  },

  addSupplyChainEvent({
    batch_id,
    actor,
    role,
    action,
    location,
    destination_address,
    destination_org,
    authorized = 1,
    tx_hash,
  }) {
    const cleanId = String(batch_id).trim();
    const batch = this.getBatchById(cleanId);
    if (!batch) {
      throw new Error(`Batch "${cleanId}" does not exist`);
    }

    // STRICT CHECK: Cannot perform operations on a recalled batch
    if (batch.status === "Recalled") {
      throw new Error("Cannot add events to a recalled batch. Lifecycle operations are blocked.");
    }

    const now = new Date().toISOString();
    const cleanActor = String(actor).toLowerCase();
    const profile = this.getProfile(cleanActor);
    const actorOrg = profile?.org_name || `${role} Node (${cleanActor.slice(0, 8)})`;

    // Compute new status: if unauthorized and currently Active, flips to Suspicious
    let newStatus = batch.status;
    if (!authorized && batch.status === "Active") {
      newStatus = "Suspicious";
    }

    // Determine stage and custody updates based on action
    let newCustodian = batch.current_custodian;
    let newCurrentOrg = batch.current_org;
    let newDestAddr = batch.destination_address;
    let newDestOrg = batch.destination_org;
    let newStage = batch.stage;

    const actUpper = String(action || "").toUpperCase();

    if (actUpper.includes("DISPATCH") || actUpper.includes("TRANSFER")) {
      newDestAddr = destination_address ? String(destination_address).toLowerCase() : null;
      newDestOrg = destination_org || (newDestAddr ? this.getProfile(newDestAddr)?.org_name || newDestAddr : null);
      newStage = "In-Transit";
    } else if (actUpper.includes("RECEIVE") || actUpper.includes("INTAKE")) {
      newCustodian = cleanActor;
      newCurrentOrg = actorOrg;
      newDestAddr = null;
      newDestOrg = null;
      newStage = "Received";
    } else if (actUpper.includes("DISPENSE")) {
      newStage = "Dispensed";
    }

    if (newStatus === "Suspicious" || newStatus === "Recalled") {
      newStage = "Exception";
    }

    db.prepare(`
      UPDATE batches
      SET status = ?,
          current_custodian = ?,
          current_org = ?,
          destination_address = ?,
          destination_org = ?,
          stage = ?,
          updated_at = ?
      WHERE lower(batch_id) = lower(?)
    `).run(newStatus, newCustodian, newCurrentOrg, newDestAddr, newDestOrg, newStage, now, cleanId);

    // Insert event
    db.prepare(`
      INSERT INTO supply_chain_events (
        batch_id, actor, role, action, location, authorized, tx_hash, timestamp, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cleanId,
      cleanActor,
      role || "Custodian",
      action || "CUSTODY_HANDOFF",
      location || "Logistics Facility",
      authorized ? 1 : 0,
      tx_hash || null,
      Math.floor(Date.now() / 1000),
      now
    );

    return {
      batch: this.getBatchById(cleanId),
      events: this.getBatchEvents(cleanId),
    };
  },

  getBatchEvents(batchId) {
    if (!batchId) return [];
    return db.prepare(`
      SELECT * FROM supply_chain_events
      WHERE lower(batch_id) = lower(?)
      ORDER BY timestamp ASC, id ASC
    `).all(batchId);
  },

  // Whitelist
  isApprovedPartner(custodian, partner) {
    if (!custodian || !partner) return false;
    const row = db.prepare(`
      SELECT approved FROM partner_whitelist
      WHERE lower(custodian) = lower(?) AND lower(partner) = lower(?)
    `).get(custodian, partner);
    return Boolean(row?.approved);
  },

  addApprovedPartner(custodian, partner) {
    db.prepare(`
      INSERT OR REPLACE INTO partner_whitelist (custodian, partner, approved)
      VALUES (lower(?), lower(?), 1)
    `).run(custodian, partner);
    return true;
  },

  getApprovedPartners(custodian) {
    return db.prepare(`
      SELECT partner FROM partner_whitelist
      WHERE lower(custodian) = lower(?) AND approved = 1
    `).all(custodian).map(r => r.partner);
  },
};

export const getDb = () => db;
export { db };
export default localDb;
