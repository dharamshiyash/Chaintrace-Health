import localDb from "./db.js";
import { verifyBatchWithFallback } from "./contract.js";

/**
 * Finds a batch by ID from authoritative SQLite/in-memory store.
 * If not present in local store, queries Polygon Amoy blockchain and hydrates DB automatically.
 * Fallback to request metadata if provided.
 */
export async function findOrHydrateBatch(batchId, extraMeta = {}) {
  if (!batchId) return null;
  const cleanId = String(batchId).trim();
  
  // 1. Check local DB first
  let existing = localDb.getBatchById(cleanId);
  if (existing) return existing;

  // 2. Query blockchain via fallback RPC providers
  try {
    const onChain = await verifyBatchWithFallback(cleanId);
    const [exists, medicineName, batchIdStr, mfgDate, expDate, quantity, manufacturer, statusCode, onChainRecallReason] = onChain || [];
    if (exists) {
      const statusMap = ["Active", "Suspicious", "Recalled", "Expired", "Unknown"];
      const onChainStatus = statusMap[Number(statusCode)] || "Active";
      existing = localDb.createBatch({
        batch_id: cleanId,
        medicine_name: medicineName || extraMeta.medicine_name || extraMeta.medicineName || "Medicine Batch",
        manufacturer: manufacturer || extraMeta.manufacturer || extraMeta.actor || "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD",
        quantity: Number(quantity) || Number(extraMeta.quantity) || 100,
        manufacturing_date: Number(mfgDate) || Number(extraMeta.manufacturing_date) || Math.floor(Date.now() / 1000),
        expiry_date: Number(expDate) || Number(extraMeta.expiry_date) || Math.floor(Date.now() / 1000) + 86400 * 365,
        location: extraMeta.location || "Manufacturing Facility",
      });
      if (onChainStatus === "Recalled") {
        localDb.recallBatch({
          batch_id: cleanId,
          reason: onChainRecallReason || "Regulatory Recall",
          recalled_by: manufacturer,
        });
        existing = localDb.getBatchById(cleanId);
      }
      return existing;
    }
  } catch (err) {
    console.warn(`Notice: On-chain auto-hydration skipped for ${cleanId}:`, err.message);
  }

  // 3. Fallback: If extra metadata was passed (e.g. from client request body), auto-create batch
  if (extraMeta && (extraMeta.medicine_name || extraMeta.medicineName || extraMeta.quantity)) {
    existing = localDb.createBatch({
      batch_id: cleanId,
      medicine_name: extraMeta.medicine_name || extraMeta.medicineName || "Medicine Batch",
      manufacturer: extraMeta.manufacturer || extraMeta.actor || "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD",
      quantity: Number(extraMeta.quantity) || 100,
      manufacturing_date: Number(extraMeta.manufacturing_date) || Math.floor(Date.now() / 1000),
      expiry_date: Number(extraMeta.expiry_date) || Math.floor(Date.now() / 1000) + 86400 * 365,
      location: extraMeta.location || "Manufacturing Facility",
    });
    return existing;
  }

  return null;
}
