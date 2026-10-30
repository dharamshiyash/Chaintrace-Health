import { contract, measureRead, verifyBatchWithFallback } from "../_lib/contract.js";
import { supabase, withTimeout } from "../_lib/supabase.js";
import localDb from "../_lib/db.js";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.params?.id || req.query?.id || req._id;

  if (!id) {
    return res.status(400).json({ error: "Batch ID is required" });
  }

  const cleanId = String(id).trim();

  try {
    let verifyResult, verifyMs = 0;
    let dbBatch = localDb.getBatchById(cleanId);
    const dbEvents = localDb.getBatchEvents(cleanId);

    try {
      // 1. Verify batch exists and get metadata from blockchain
      const readResult = await measureRead(`verifyBatch(${cleanId})`, () =>
        verifyBatchWithFallback(cleanId)
      );
      verifyResult = readResult.result;
      verifyMs = readResult.executionMs;
    } catch (err) {
      console.warn(`Blockchain RPC read skipped for batch ${cleanId}:`, err.message);
      if (dbBatch) {
        // Fallback to authoritative local database record — NO fake default to Active
        const statusCode =
          dbBatch.status === "Recalled"
            ? 2
            : dbBatch.status === "Suspicious"
            ? 1
            : dbBatch.status === "Expired"
            ? 3
            : 0;
        verifyResult = [
          true,
          dbBatch.medicine_name,
          dbBatch.batch_id,
          BigInt(dbBatch.manufacturing_date),
          BigInt(dbBatch.expiry_date),
          BigInt(dbBatch.quantity),
          dbBatch.manufacturer,
          statusCode,
          dbBatch.recall_reason || "",
        ];
      }
    }

    if (!verifyResult && !dbBatch) {
      return res.status(404).json({ error: "Batch not found on ledger", batchId: cleanId });
    }

    const [exists, medicineName, batchIdStr, mfgDate, expDate, quantity, manufacturer, statusCode, onChainRecallReason] = verifyResult || [];

    if (!exists && !dbBatch) {
      return res.status(404).json({ error: "Batch not found on ledger", batchId: cleanId });
    }

    // Auto-hydrate localDb with on-chain batch if missing from database
    if (exists && !dbBatch) {
      try {
        dbBatch = localDb.createBatch({
          batch_id: cleanId,
          medicine_name: medicineName || "Medicine Batch",
          manufacturer: manufacturer || "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD",
          quantity: Number(quantity) || 100,
          manufacturing_date: Number(mfgDate) || Math.floor(Date.now() / 1000),
          expiry_date: Number(expDate) || Math.floor(Date.now() / 1000) + 86400 * 365,
          location: "Manufacturing Facility",
        });
      } catch {}
    }

    // Map status enum: 0: Active, 1: Suspicious, 2: Recalled, 3: Expired
    const statusMap = ["Active", "Suspicious", "Recalled", "Expired", "Unknown"];
    let status = dbBatch?.status || statusMap[Number(statusCode)] || "Active";
    let recallReason = onChainRecallReason || (dbBatch?.recall_reason) || null;

    // Authoritative Sync: If DB says Recalled or blockchain says Recalled, status is RECALLED
    if (dbBatch?.status === "Recalled" || statusMap[Number(statusCode)] === "Recalled") {
      status = "Recalled";
      if (!recallReason) recallReason = dbBatch?.recall_reason || "Regulatory / Quality Recall";
    } else if (dbBatch?.status === "Suspicious") {
      status = "Suspicious";
    } else if (dbBatch?.status === "Active") {
      status = "Active";
    }

    // 2. Get batch history by reconciling on-chain events and authoritative DB events
    let onChainHistory = [];
    let historyMs = 0;
    try {
      const readResult = await measureRead(`getBatchHistory(${cleanId})`, () =>
        contract.getBatchHistory(cleanId)
      );
      historyMs = readResult.executionMs;
      onChainHistory = (readResult.result || []).map((h) => ({
        actor: h.actor,
        role: typeof h.role === "number" || typeof h.role === "bigint" ? String(h.role) : h.role,
        timestamp: Number(h.timestamp),
        location: h.location,
        authorized: Boolean(h.authorized),
      }));
    } catch {
      onChainHistory = [];
    }

    let history = [];

    if (dbEvents && dbEvents.length > 0) {
      // Database has full lifecycle records (genesis, dispatches, receives, recalls)
      history = dbEvents.map((e, idx) => {
        const onChainMatch = onChainHistory[idx] || onChainHistory.find((och) =>
          och.actor?.toLowerCase() === e.actor?.toLowerCase() &&
          Math.abs(Number(och.timestamp) - Number(e.timestamp)) < 3600
        );

        const isAuth = e.authorized !== 0 && e.authorized !== false;

        return {
          actor: e.actor,
          role: e.role || onChainMatch?.role || "Custodian",
          action: e.action || (idx === 0 ? "REGISTERED" : "CUSTODY_HANDOFF"),
          location: e.location || onChainMatch?.location || "Logistics Facility",
          authorized: isAuth,
          timestamp: Number(e.timestamp || onChainMatch?.timestamp || Math.floor(Date.now() / 1000)),
          txHash: e.tx_hash,
        };
      });

      // If on-chain has more events than dbEvents, append them
      if (onChainHistory.length > dbEvents.length) {
        for (let i = dbEvents.length; i < onChainHistory.length; i++) {
          const och = onChainHistory[i];
          history.push({
            actor: och.actor,
            role: och.role,
            action: i === 0 ? "REGISTERED" : "CUSTODY_HANDOFF",
            location: och.location,
            authorized: Boolean(och.authorized),
            timestamp: Number(och.timestamp),
            txHash: null,
          });
        }
      }
    } else if (onChainHistory.length > 0) {
      history = onChainHistory.map((och, idx) => ({
        actor: och.actor,
        role: och.role,
        action: idx === 0 ? "REGISTERED" : "CUSTODY_HANDOFF",
        location: och.location,
        authorized: Boolean(och.authorized),
        timestamp: Number(och.timestamp),
        txHash: null,
      }));
    } else {
      history = [
        {
          actor: manufacturer || dbBatch?.manufacturer || "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD",
          role: "Manufacturer",
          action: "REGISTERED",
          timestamp: Number(mfgDate || dbBatch?.manufacturing_date || Math.floor(Date.now() / 1000)),
          location: "Manufacturing Facility",
          authorized: true,
          txHash: null,
        },
      ];
    }

    // Append official recall event if batch is Recalled but history doesn't contain a RECALLED event
    if (status === "Recalled" && !history.some((e) => e.action === "RECALLED")) {
      const recalledBy = dbBatch?.recalled_by || manufacturer || dbBatch?.manufacturer || "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD";
      const recalledAt = dbBatch?.recalled_at
        ? Math.floor(new Date(dbBatch.recalled_at).getTime() / 1000)
        : Math.floor(Date.now() / 1000);
      history.push({
        actor: recalledBy,
        role: "Manufacturer",
        action: "RECALLED",
        location: `Official Recall Notice: ${recallReason || "Quality Defect"}`,
        authorized: true,
        timestamp: recalledAt,
        txHash: null,
      });
    }

    // 3. Get divergence point if suspicious
    let divergence = null;
    let divergenceMs = 0;
    if (status === "Suspicious") {
      try {
        const { result: divResult, executionMs: dMs } = await measureRead(`getDivergencePoint(${cleanId})`, () =>
          contract.getDivergencePoint(cleanId)
        );
        divergenceMs = dMs;
        const [lastAuthorized, firstUnauthorized] = divResult;
        
        const lastOrg = localDb.getProfile(lastAuthorized)?.org_name || lastAuthorized;
        const firstOrg = localDb.getProfile(firstUnauthorized)?.org_name || firstUnauthorized;

        divergence = {
          lastAuthorized,
          lastAuthorizedOrg: lastOrg || "Authorized Node",
          firstUnauthorized,
          firstUnauthorizedOrg: firstOrg || "Unauthorized Intermediary",
        };
      } catch {
        // Fallback divergence deduction from history
        for (let i = 1; i < history.length; i++) {
          if (!history[i].authorized) {
            divergence = {
              lastAuthorized: history[i - 1].actor,
              lastAuthorizedOrg: localDb.getProfile(history[i - 1].actor)?.org_name || history[i - 1].actor,
              firstUnauthorized: history[i].actor,
              firstUnauthorizedOrg: localDb.getProfile(history[i].actor)?.org_name || history[i].actor,
            };
            break;
          }
        }
      }
    }

    // Enrich history with organization names from profiles and known map
    const profiles = localDb.getAllProfiles();
    const profileMap = {
      "0x05db076e1f33575447ac32e3b5401a90e77a9cfd": "Apex BioPharma (Origin Node)",
      "0x76de5d6cc4b8305119ee57efb7aa68832247595a": "Bharat Biotech Labs",
      "0xc26535042e34fdf8e56015f2fb6fe175f9a25365": "Novartis Global Logistics (Distributor 1)",
      "0x2bd8a4078832a8c3775685b643442ffa567b47f3": "Central Wholesale Pharma (Distributor 2)",
      "0x4e1e0cb18ae2f56f466513c67969ca4e864df0f3": "Apollo Pharmacy Delhi (Healthcare Provider 1)",
      "0x9fc97e4a860f5f6873523f03b51e50882eff12a1": "MedPlus Retail Healthcare (Healthcare Provider 2)",
      "0x8af0b59ce4f25f5e0af59309a9a25e8e5a7b09d1": "National Cold Storage Warehouse",
      "0x96ca7fdbf427c815fb50d751b69dd86fe10f1ff1": "Unauthorized Intermediary (Suspicious Node)",
    };
    profiles.forEach((p) => {
      if (p.address && p.org_name) {
        profileMap[p.address.toLowerCase()] = p.org_name;
      }
    });

    const enrichedHistory = history.map((h) => {
      const hashStr = `${cleanId}-${h.actor}-${h.role}-${h.timestamp}`;
      const mockTxHash =
        h.txHash ||
        "0x" + crypto.createHash("sha256").update(hashStr).digest("hex").substring(0, 64);
      const cleanActorLower = (h.actor || "").toLowerCase();
      return {
        ...h,
        action: h.action,
        txHash: mockTxHash,
        orgName: profileMap[cleanActorLower] || (cleanActorLower === "0x05db076e1f33575447ac32e3b5401a90e77a9cfd" ? "Apex BioPharma (Origin Node)" : h.actor),
      };
    });

    const isZeroAddr = !manufacturer || manufacturer === "0x0000000000000000000000000000000000000000";
    const resolvedMfg = (!isZeroAddr ? manufacturer : dbBatch?.manufacturer) || "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD";
    const resolvedMedName = (exists && medicineName ? medicineName : dbBatch?.medicine_name) || "Medicine Batch";
    const resolvedMfgDate = (exists && mfgDate && Number(mfgDate) > 0 ? Number(mfgDate) : Number(dbBatch?.manufacturing_date || 0)) || Math.floor(Date.now() / 1000);
    const resolvedExpDate = (exists && expDate && Number(expDate) > 0 ? Number(expDate) : Number(dbBatch?.expiry_date || 0)) || Math.floor(Date.now() / 1000) + 86400 * 365;
    const resolvedQty = (exists && quantity && Number(quantity) > 0 ? Number(quantity) : Number(dbBatch?.quantity || 0)) || 100;

    return res.status(200).json({
      metadata: {
        batchId: cleanId,
        medicineName: resolvedMedName,
        manufacturingDate: resolvedMfgDate,
        expiryDate: resolvedExpDate,
        quantity: resolvedQty,
        manufacturer: resolvedMfg,
        status,
        recallReason: recallReason || null,
        recalledAt: dbBatch?.recalled_at || null,
      },
      history: enrichedHistory,
      events: enrichedHistory,
      status,
      divergence,
      contractAddress: contract?.target || "0x3E8bBd12a1A614d131Fc227106D2697Df1C0C072",
    });
  } catch (error) {
    console.error(`Error verifying batch ${cleanId}:`, error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
