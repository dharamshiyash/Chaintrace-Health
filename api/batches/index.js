import localDb from "../_lib/db.js";
import { getRequesterContext, scopeAndEnrichBatches } from "../_lib/visibilityService.js";
import { contract, verifyBatchWithFallback } from "../_lib/contract.js";
import { supabase, withTimeout } from "../_lib/supabase.js";

export default async function handler(req, res) {
  // Handle POST: Register / index newly confirmed batch
  if (req.method === "POST") {
    const {
      batch_id,
      medicine_name,
      manufacturer,
      quantity,
      manufacturing_date,
      expiry_date,
      location,
      tx_hash,
    } = req.body || {};

    if (!batch_id) {
      return res.status(400).json({ error: "batch_id is required" });
    }

    const cleanId = String(batch_id).trim();

    // 1. Persist to authoritative local DB
    const newBatch = localDb.createBatch({
      batch_id: cleanId,
      medicine_name,
      manufacturer: manufacturer || "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD",
      quantity: quantity || 100,
      manufacturing_date,
      expiry_date,
      location,
      tx_hash,
    });

    // 2. Best-effort mirror to Supabase
    try {
      await withTimeout(
        supabase.from("batches").upsert([
          {
            batch_id: cleanId,
            medicine_name: medicine_name || "Medicine Batch",
            manufacturer: manufacturer || "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD",
            status: "Active",
          },
        ]),
        800
      );
    } catch {
      // Non-critical mirror
    }

    return res.status(201).json({ ok: true, batch: newBatch });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const requester = getRequesterContext(req);
    const filterTab = req.query.filter || req.query.tab || req.query.stage || "All";

    // 1. Get all batches from local authoritative store
    let allBatches = localDb.getAllBatches();

    // 2. Perform fast background blockchain sync for on-chain status changes (e.g. Recalls on Amoy)
    // To keep response times sub-50ms, check up to 3 batches or if specific query
    const statusMap = ["Active", "Suspicious", "Recalled", "Expired", "Unknown"];
    
    // Quick sync for known batches
    for (const b of allBatches.slice(0, 5)) {
      if (b.status !== "Recalled") {
        try {
          const onChain = await verifyBatchWithFallback(b.batch_id);
          const [exists, , , , , , , statusCode, recallReason] = onChain;
          if (exists) {
            const onChainStatus = statusMap[Number(statusCode)];
            if (onChainStatus === "Recalled" && b.status !== "Recalled") {
              localDb.recallBatch({
                batch_id: b.batch_id,
                reason: recallReason || "Quality Defect",
                recalled_by: b.manufacturer,
              });
            }
          }
        } catch {
          // On-chain check skipped on timeout/rate-limit
        }
      }
    }

    // Refresh batches after sync
    allBatches = localDb.getAllBatches();

    // 3. Enforce Role & Organization visibility scoping, view status derivation, and tab filtering
    const result = scopeAndEnrichBatches(allBatches, requester, filterTab);

    // Set count headers for client inspection
    res.setHeader("x-count-all", String(result.counts.all));
    res.setHeader("x-count-fresh", String(result.counts.fresh));
    res.setHeader("x-count-in-transit", String(result.counts.inTransit));
    res.setHeader("x-count-late", String(result.counts.late));
    res.setHeader("x-count-exceptions", String(result.counts.exceptions));
    res.setHeader("x-count-active-stock", String(result.counts.activeStock));

    // Return structured payload containing batches, scoped counts, and caller context
    return res.status(200).json({
      batches: result.batches,
      counts: result.counts,
      requester: result.requester,
    });
  } catch (error) {
    console.error("Error fetching batches:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
