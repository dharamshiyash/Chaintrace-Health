import { supabase, withTimeout } from "../_lib/supabase.js";
import { contract, verifyBatchWithFallback } from "../_lib/contract.js";

// Global in-memory registry of known batch IDs across requests
const knownBatchIdSet = new Set([
  "BATCH-MED-2024-001",
  "BATCH-MED-2024-002",
  "BATCH-MED-2024-003",
  "BATCH-MED-2024-004",
  "BATCH-MED-2024-005",
  "BATCH-MED-2024-006",
  "BATCH-MED-2024-007",
  "BATCH-MED-2024-008",
  "BATCH-MED-2024-009",
  "BATCH-MED-2024-010",
  "BATCH-001",
  "BATCH-002",
  "BATCH-003",
  "BATCH-004",
  "BATCH-005",
]);

export default async function handler(req, res) {
  // Handle POST: Register / index newly confirmed batch
  if (req.method === "POST") {
    const { batch_id, medicine_name, manufacturer, status, quantity, manufacturing_date, expiry_date, tx_hash } = req.body || {};
    if (!batch_id) {
      return res.status(400).json({ error: "batch_id is required" });
    }

    const cleanId = String(batch_id).trim();
    knownBatchIdSet.add(cleanId);

    // Best effort persistence to Supabase mirror
    try {
      await withTimeout(
        supabase.from("batches").upsert([
          {
            batch_id: cleanId,
            medicine_name: medicine_name || "Medicine Batch",
            manufacturer: manufacturer || null,
            status: status || "Active",
          },
        ]),
        1500
      );
    } catch (err) {
      console.warn("Notice: Supabase batch persistence skipped:", err.message);
    }

    return res.status(201).json({ ok: true, batch_id: cleanId });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { status, manufacturer } = req.query;

  try {
    // 1. Collect candidate batch IDs from in-memory set and Supabase
    const candidateIds = new Set(knownBatchIdSet);

    try {
      const { data: supaBatches } = await withTimeout(
        supabase.from("batches").select("batch_id, medicine_name, status, manufacturer, created_at"),
        800
      );
      if (supaBatches && supaBatches.length > 0) {
        supaBatches.forEach((b) => {
          if (b.batch_id) candidateIds.add(b.batch_id);
        });
      }
    } catch (err) {
      console.warn("Supabase lookup skipped:", err.message);
    }

    // 2. Fetch on-chain verification data in controlled chunks to respect DRPC concurrency
    const statusMap = ["Active", "Suspicious", "Recalled", "Expired", "Unknown"];
    const candidateList = Array.from(candidateIds);
    const verifiedBatches = [];

    const CHUNK_SIZE = 3;
    for (let i = 0; i < candidateList.length; i += CHUNK_SIZE) {
      const chunk = candidateList.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.allSettled(
        chunk.map(async (batchId) => {
          try {
            const result = await verifyBatchWithFallback(batchId);
            const [exists, medicineName, bId, mfgDate, expDate, quantity, mfr, statusCode, recallReason] = result;
            if (exists) {
              return {
                batch_id: bId || batchId,
                medicine_name: medicineName,
                manufacturer: mfr,
                status: statusMap[Number(statusCode)] || "Unknown",
                recall_reason: recallReason || null,
                quantity: Number(quantity),
                manufacturing_date: Number(mfgDate),
                expiry_date: Number(expDate),
                created_at: new Date(Number(mfgDate) * 1000).toISOString(),
                source: "blockchain",
              };
            }
          } catch {
            // Batch doesn't exist on-chain or read reverted, skip
          }
          return null;
        })
      );

      chunkResults.forEach((r) => {
        if (r.status === "fulfilled" && r.value !== null) {
          verifiedBatches.push(r.value);
        }
      });
    }

    // Deduplicate batches by batch_id
    const batchMap = new Map();
    verifiedBatches.forEach((b) => batchMap.set(b.batch_id, b));

    let data = Array.from(batchMap.values());

    // If still no batches found from on-chain verifyBatch, attempt Supabase fallback
    if (data.length === 0) {
      try {
        let query = supabase.from("batches").select("*").order("created_at", { ascending: false });
        if (status) query = query.eq("status", status);
        if (manufacturer) query = query.eq("manufacturer", manufacturer);

        const result = await withTimeout(query, 1000);
        if (result.data && result.data.length > 0) {
          data = result.data;
        }
      } catch (err) {
        console.warn("Supabase fallback failed:", err.message);
      }
    }

    // Apply query filters
    let filtered = data;
    if (status) {
      filtered = filtered.filter((b) => b.status === status);
    }
    if (manufacturer) {
      filtered = filtered.filter(
        (b) => b.manufacturer?.toLowerCase() === manufacturer?.toLowerCase()
      );
    }

    // Enrich with stage & isLate metadata
    const enrichedData = filtered.map((b) => {
      let stage = "Fresh";
      const createdAt = b.created_at || new Date().toISOString();
      const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (b.status === "Suspicious" || b.status === "Recalled") {
        stage = "Exception";
      } else if (ageDays > 2) {
        stage = "Delivered";
      } else if (ageDays > 0.5) {
        stage = "In-Transit";
      }

      let isLate = false;
      if (b.expiry_date) {
        const expiryMs =
          typeof b.expiry_date === "number" && b.expiry_date < 1e12
            ? b.expiry_date * 1000
            : b.expiry_date;
        const timeToExpiry = new Date(expiryMs).getTime() - Date.now();
        if (timeToExpiry < 180 * 24 * 60 * 60 * 1000 && timeToExpiry > 0) isLate = true;
      }

      return {
        ...b,
        stage,
        isLate,
      };
    });

    // Sort newest first
    enrichedData.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return res.status(200).json(enrichedData);
  } catch (error) {
    console.error("Error fetching batches:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
