import fs from "fs";
import path from "path";
import os from "os";

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Database Fallback for Environments Without node:sqlite (e.g. Node < 22 or serverless)
// ─────────────────────────────────────────────────────────────────────────────
function createInMemoryDb() {
  const profiles = new Map();
  const batches = new Map();
  const events = [];
  const whitelist = new Map();
  const performance = [];

  return {
    exec(sql) {
      // DDL statements are no-ops in memory
    },
    prepare(sql) {
      const s = sql.trim().toLowerCase();

      // COUNT batches
      if (s.startsWith("select count(*)")) {
        return {
          get: () => ({ count: batches.size }),
        };
      }

      // SELECT profiles
      if (s.includes("from profiles where lower(address) = lower(?)")) {
        return {
          get: (addr) => (addr ? profiles.get(String(addr).toLowerCase()) || null : null),
        };
      }
      if (s.startsWith("select * from profiles")) {
        return {
          all: () => Array.from(profiles.values()),
        };
      }

      // SELECT batches
      if (s.includes("from batches where lower(batch_id) = lower(?)") || s.includes("from batches where batch_id = ?")) {
        return {
          get: (id) => (id ? batches.get(String(id).toLowerCase()) || null : null),
        };
      }
      if (s.startsWith("select * from batches")) {
        return {
          all: () =>
            Array.from(batches.values()).sort(
              (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
            ),
        };
      }

      // SELECT events
      if (s.includes("from supply_chain_events where lower(batch_id) = lower(?)")) {
        return {
          all: (id) =>
            events
              .filter((e) => e.batch_id.toLowerCase() === String(id).toLowerCase())
              .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0) || (a.id || 0) - (b.id || 0)),
        };
      }

      // SELECT partner_whitelist
      if (s.includes("from partner_whitelist where lower(custodian) = lower(?) and lower(partner) = lower(?)")) {
        return {
          get: (custodian, partner) => {
            if (!custodian || !partner) return { approved: 0 };
            const key = `${String(custodian).toLowerCase()}:${String(partner).toLowerCase()}`;
            return { approved: whitelist.has(key) ? 1 : 0 };
          },
        };
      }
      if (s.includes("from partner_whitelist where lower(custodian) = lower(?) and approved = 1")) {
        return {
          all: (custodian) => {
            if (!custodian) return [];
            const prefix = `${String(custodian).toLowerCase()}:`;
            return Array.from(whitelist.keys())
              .filter((k) => k.startsWith(prefix))
              .map((k) => ({ partner: k.split(":")[1] }));
          },
        };
      }

      // INSERT profiles
      if (s.includes("into profiles")) {
        return {
          run: (address, role, org_name, created_at, fallbackCreatedAt) => {
            if (!address) return;
            const clean = String(address).toLowerCase();
            const existing = profiles.get(clean);
            profiles.set(clean, {
              address: clean,
              role: role || existing?.role || "user",
              org_name: org_name || existing?.org_name || "",
              created_at: existing?.created_at || created_at || fallbackCreatedAt || new Date().toISOString(),
            });
          },
        };
      }

      // INSERT whitelist
      if (s.includes("into partner_whitelist")) {
        return {
          run: (custodian, partner, approved) => {
            if (!custodian || !partner) return;
            const key = `${String(custodian).toLowerCase()}:${String(partner).toLowerCase()}`;
            whitelist.set(key, Number(approved) ? 1 : 0);
          },
        };
      }

      // INSERT batches
      if (s.includes("into batches")) {
        return {
          run: (
            batch_id,
            medicine_name,
            manufacturer,
            status,
            recall_reason,
            recalled_at,
            recalled_by,
            quantity,
            manufacturing_date,
            expiry_date,
            current_custodian,
            current_org,
            destination_address,
            destination_org,
            stage,
            created_at,
            updated_at
          ) => {
            const cleanId = String(batch_id).toLowerCase();
            batches.set(cleanId, {
              batch_id: String(batch_id),
              medicine_name: medicine_name || "Medicine Batch",
              manufacturer: String(manufacturer || "").toLowerCase(),
              status: status || "Active",
              recall_reason: recall_reason || null,
              recalled_at: recalled_at || null,
              recalled_by: recalled_by || null,
              quantity: Number(quantity) || 100,
              manufacturing_date: Number(manufacturing_date) || Math.floor(Date.now() / 1000),
              expiry_date: Number(expiry_date) || Math.floor(Date.now() / 1000) + 86400 * 365,
              current_custodian: String(current_custodian || "").toLowerCase(),
              current_org: current_org || "",
              destination_address: destination_address ? String(destination_address).toLowerCase() : null,
              destination_org: destination_org || null,
              stage: stage || "Fresh",
              created_at: created_at || new Date().toISOString(),
              updated_at: updated_at || new Date().toISOString(),
            });
          },
        };
      }

      // INSERT supply_chain_events
      if (s.includes("into supply_chain_events")) {
        return {
          run: (batch_id, actor, role, action, location, authorized, tx_hash, timestamp, created_at) => {
            events.push({
              id: events.length + 1,
              batch_id: String(batch_id),
              actor: String(actor || "").toLowerCase(),
              role: role || "",
              action: action || "",
              location: location || "",
              authorized: Number(authorized) ? 1 : 0,
              tx_hash: tx_hash || null,
              timestamp: Number(timestamp) || Math.floor(Date.now() / 1000),
              created_at: created_at || new Date().toISOString(),
            });
          },
        };
      }

      // UPDATE batches - Recall
      if (s.startsWith("update batches") && s.includes("status = 'recalled'")) {
        return {
          run: (reason, recalled_at, recalled_by, updated_at, batch_id) => {
            const cleanId = String(batch_id).toLowerCase();
            const b = batches.get(cleanId);
            if (b) {
              b.status = "Recalled";
              b.recall_reason = reason;
              b.recalled_at = recalled_at;
              b.recalled_by = recalled_by;
              b.stage = "Exception";
              b.updated_at = updated_at;
            }
          },
        };
      }

      // UPDATE batches - Custody Handoff
      if (s.startsWith("update batches") && s.includes("current_custodian = ?")) {
        return {
          run: (status, current_custodian, current_org, dest_addr, dest_org, stage, updated_at, batch_id) => {
            const cleanId = String(batch_id).toLowerCase();
            const b = batches.get(cleanId);
            if (b) {
              b.status = status;
              b.current_custodian = String(current_custodian || "").toLowerCase();
              b.current_org = current_org;
              b.destination_address = dest_addr ? String(dest_addr).toLowerCase() : null;
              b.destination_org = dest_org || null;
              b.stage = stage;
              b.updated_at = updated_at;
            }
          },
        };
      }

      // UPDATE batches - Suspicious Divergence
      if (s.startsWith("update batches") && s.includes("status = 'suspicious'")) {
        return {
          run: (updated_at, batch_id) => {
            const cleanId = String(batch_id).toLowerCase();
            const b = batches.get(cleanId);
            if (b) {
              b.status = "Suspicious";
              b.stage = "Exception";
              b.updated_at = updated_at;
            }
          },
        };
      }

      // Default safe mock
      return {
        run: () => {},
        get: () => null,
        all: () => [],
      };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Safe Dynamic Initialization: SQLite when available, otherwise In-Memory Store
// ─────────────────────────────────────────────────────────────────────────────

let DatabaseSync = null;
try {
  const sqliteMod = await import("node:sqlite");
  DatabaseSync = sqliteMod.DatabaseSync;
} catch {
  // node:sqlite unavailable on this runtime (e.g. Node < 22 or serverless without native module)
}

let db = null;

if (DatabaseSync) {
  try {
    const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    let targetDir = isVercel ? os.tmpdir() : path.resolve(process.cwd(), "data");

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    } catch {
      targetDir = os.tmpdir();
    }

    const dbPath = path.join(targetDir, "chaintrace.db");
    try {
      db = new DatabaseSync(dbPath);
    } catch {
      db = new DatabaseSync(":memory:");
    }
  } catch (err) {
    try {
      db = new DatabaseSync(":memory:");
    } catch {
      db = null;
    }
  }
}

// Fallback to in-memory store if SQLite is not available
if (!db) {
  db = createInMemoryDb();
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
const currentCount = (countStmt.get() || {}).count || 0;

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
      quantity: 500,
      manufacturing_date: Math.floor(Date.now() / 1000) - 86400 * 20,
      expiry_date: Math.floor(Date.now() / 1000) + 86400 * 300,
      current_custodian: apolloAddr,
      current_org: "Apollo Pharmacy Delhi (Healthcare Provider 1)",
      destination_address: apolloAddr,
      destination_org: "Apollo Pharmacy Delhi (Healthcare Provider 1)",
      stage: "Dispensed",
      created_at: new Date(Date.now() - 86400 * 20 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      events: [
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "REGISTERED",
          location: "Mumbai Plant 1",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 20,
        },
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "DISPATCHED_TO_DISTRIBUTOR",
          location: "Transit to Novartis",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 18,
        },
        {
          actor: novartisAddr,
          role: "Distributor",
          action: "RECEIVED_AT_FACILITY",
          location: "Novartis Logistics Hub Delhi",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 14,
        },
        {
          actor: novartisAddr,
          role: "Distributor",
          action: "DISPATCHED_TO_PHARMACY",
          location: "Transit to Apollo",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 10,
        },
        {
          actor: apolloAddr,
          role: "Pharmacy",
          action: "RECEIVED_AT_FACILITY",
          location: "Apollo Pharmacy Retail Counter",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 5,
        },
        {
          actor: apolloAddr,
          role: "Pharmacy",
          action: "DISPENSED_TO_PATIENT",
          location: "Apollo Pharmacy Delhi",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 2,
        },
      ],
    },
    {
      batch_id: "BATCH-MED-2024-002",
      medicine_name: "Paracetamol 650mg",
      manufacturer: apexAddr,
      status: "Recalled",
      recall_reason: "Microbial contamination detected in packaging",
      recalled_at: new Date(Date.now() - 86400 * 3 * 1000).toISOString(),
      recalled_by: apexAddr,
      quantity: 1000,
      manufacturing_date: Math.floor(Date.now() / 1000) - 86400 * 10,
      expiry_date: Math.floor(Date.now() / 1000) + 86400 * 180,
      current_custodian: apolloAddr,
      current_org: "Apollo Pharmacy Delhi (Healthcare Provider 1)",
      destination_address: apolloAddr,
      destination_org: "Apollo Pharmacy Delhi (Healthcare Provider 1)",
      stage: "Exception",
      created_at: new Date(Date.now() - 86400 * 10 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      events: [
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "REGISTERED",
          location: "Mumbai Plant 2",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 10,
        },
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "DISPATCHED_TO_DISTRIBUTOR",
          location: "Transit to Novartis",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 8,
        },
        {
          actor: novartisAddr,
          role: "Distributor",
          action: "RECEIVED_AT_FACILITY",
          location: "Novartis Logistics Hub Delhi",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 6,
        },
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "RECALLED",
          location: "Official Recall Notice: Microbial contamination",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 3,
        },
      ],
    },
    {
      batch_id: "BATCH-MED-2024-003",
      medicine_name: "Metformin 500mg",
      manufacturer: apexAddr,
      status: "Suspicious",
      recall_reason: null,
      recalled_at: null,
      recalled_by: null,
      quantity: 800,
      manufacturing_date: Math.floor(Date.now() / 1000) - 86400 * 5,
      expiry_date: Math.floor(Date.now() / 1000) + 86400 * 365,
      current_custodian: "0x96CA7FdbF427C815FB50d751b69Dd86Fe10f1ff1".toLowerCase(),
      current_org: "Unauthorized Intermediary (Suspicious Node)",
      destination_address: "0x96CA7FdbF427C815FB50d751b69Dd86Fe10f1ff1".toLowerCase(),
      destination_org: "Unauthorized Intermediary (Suspicious Node)",
      stage: "Exception",
      created_at: new Date(Date.now() - 86400 * 5 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      events: [
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "REGISTERED",
          location: "Mumbai Plant 1",
          authorized: 1,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 5,
        },
        {
          actor: "0x96CA7FdbF427C815FB50d751b69Dd86Fe10f1ff1".toLowerCase(),
          role: "Distributor",
          action: "INTERCEPTED_TRANSIT",
          location: "Unknown Unauthorized Terminal",
          authorized: 0,
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 3,
        },
      ],
    },
    {
      batch_id: "BATCH-MED-2024-004",
      medicine_name: "Lipitor 20mg",
      manufacturer: apexAddr,
      status: "Active",
      recall_reason: null,
      recalled_at: null,
      recalled_by: null,
      quantity: 1500,
      manufacturing_date: Math.floor(Date.now() / 1000) - 86400 * 2,
      expiry_date: Math.floor(Date.now() / 1000) + 86400 * 500,
      current_custodian: apexAddr,
      current_org: "Apex BioPharma (Origin Node)",
      destination_address: null,
      destination_org: null,
      stage: "Fresh",
      created_at: new Date(Date.now() - 86400 * 2 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      events: [
        {
          actor: apexAddr,
          role: "Manufacturer",
          action: "REGISTERED",
          location: "Pune Storage Facility",
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

    if (batch.status === "Recalled") {
      throw new Error("Cannot add event to recalled batch");
    }

    const now = new Date().toISOString();
    const cleanActor = String(actor).toLowerCase();

    // Determine status and custodian
    let newStatus = batch.status;
    let newCustodian = batch.current_custodian;
    let newCurrentOrg = batch.current_org;
    let newDestAddr = destination_address ? String(destination_address).toLowerCase() : batch.destination_address;
    let newDestOrg = destination_org || batch.destination_org;
    let newStage = batch.stage;

    if (!authorized) {
      newStatus = "Suspicious";
      newStage = "Exception";
    }

    const normAction = (action || "").toUpperCase();

    if (normAction.includes("DISPATCH") || normAction.includes("IN_TRANSIT") || normAction.includes("TRANSFER")) {
      newStage = "In-Transit";
      newCustodian = cleanActor;
      const profile = this.getProfile(cleanActor);
      if (profile) newCurrentOrg = profile.org_name;
    } else if (normAction.includes("RECEIV") || normAction.includes("ACCEPT")) {
      newStage = "Fresh";
      newCustodian = cleanActor;
      const profile = this.getProfile(cleanActor);
      if (profile) newCurrentOrg = profile.org_name;
      newDestAddr = null;
      newDestOrg = null;
    } else if (normAction.includes("DISPENS") || normAction.includes("PATIENT")) {
      newStage = "Dispensed";
      newCustodian = cleanActor;
      newDestAddr = null;
      newDestOrg = null;
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
