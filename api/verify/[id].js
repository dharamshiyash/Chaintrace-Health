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
    const dbBatch = localDb.getBatchById(cleanId);
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

    // Map status enum: 0: Active, 1: Suspicious, 2: Recalled, 3: Expired
    const statusMap = ["Active", "Suspicious", "Recalled", "Expired", "Unknown"];
    let status = statusMap[Number(statusCode)] || "Unknown";
    let recallReason = onChainRecallReason || (dbBatch?.recall_reason) || null;

    // Authoritative Sync: If DB says Recalled or blockchain says Recalled, status is RECALLED
    if (dbBatch?.status === "Recalled" || status === "Recalled") {
      status = "Recalled";
      if (!recallReason) recallReason = dbBatch?.recall_reason || "Regulatory / Quality Recall";
    } else if (dbBatch?.status === "Suspicious" || status === "Suspicious") {
      status = "Suspicious";
    }

    // 2. Get batch history from on-chain with DB fallback
    let history = [];
    let historyMs = 0;
    try {
      const readResult = await measureRead(`getBatchHistory(${cleanId})`, () =>
        contract.getBatchHistory(cleanId)
      );
      historyMs = readResult.executionMs;
      history = readResult.result.map((h) => ({
        actor: h.actor,
        role: typeof h.role === "number" || typeof h.role === "bigint" ? String(h.role) : h.role,
        timestamp: Number(h.timestamp),
        location: h.location,
        authorized: Boolean(h.authorized),
      }));
    } catch {
      // Use local database event history
      if (dbEvents && dbEvents.length > 0) {
        history = dbEvents.map((e) => ({
          actor: e.actor,
          role: e.role,
          timestamp: Number(e.timestamp),
          location: e.location,
          authorized: Boolean(e.authorized),
          txHash: e.tx_hash,
        }));
      } else {
        history = [
          {
            actor: manufacturer || dbBatch?.manufacturer || "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD",
            role: "Manufacturer",
            timestamp: Number(mfgDate || dbBatch?.manufacturing_date || Math.floor(Date.now() / 1000)),
            location: "Manufacturing Facility",
            authorized: true,
          },
        ];
      }
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

    // Enrich history with organization names from profiles
    const profiles = localDb.getAllProfiles();
    const profileMap = {};
    profiles.forEach((p) => {
      profileMap[p.address.toLowerCase()] = p.org_name;
    });

    const enrichedHistory = history.map((h) => {
      const hashStr = `${cleanId}-${h.actor}-${h.role}-${h.timestamp}`;
      const mockTxHash =
        h.txHash ||
        "0x" + crypto.createHash("sha256").update(hashStr).digest("hex").substring(0, 64);
      return {
        ...h,
        txHash: mockTxHash,
        orgName: profileMap[h.actor?.toLowerCase()] || h.actor,
      };
    });

    return res.status(200).json({
      metadata: {
        batchId: cleanId,
        medicineName: medicineName || dbBatch?.medicine_name || "Medicine Batch",
        manufacturingDate: Number(mfgDate || dbBatch?.manufacturing_date || 0),
        expiryDate: Number(expDate || dbBatch?.expiry_date || 0),
        quantity: Number(quantity || dbBatch?.quantity || 0),
        manufacturer: manufacturer || dbBatch?.manufacturer,
        status,
        recallReason: recallReason || null,
        recalledAt: dbBatch?.recalled_at || null,
      },
      history: enrichedHistory,
      divergence,
      contractAddress: contract?.target || "0x3E8bBd12a1A614d131Fc227106D2697Df1C0C072",
    });
  } catch (error) {
    console.error(`Error verifying batch ${cleanId}:`, error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
