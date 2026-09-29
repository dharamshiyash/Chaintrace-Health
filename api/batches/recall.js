import localDb from "../_lib/db.js";
import { getRequesterContext } from "../_lib/visibilityService.js";
import { executeRecallOnChain } from "../_lib/contract.js";
import { supabase, withTimeout } from "../_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST to recall a batch." });
  }

  const { batch_id, reason, recalled_by, tx_hash } = req.body || {};

  if (!batch_id) {
    return res.status(400).json({ error: "batch_id is required" });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: "Recall reason is mandatory" });
  }

  const cleanId = String(batch_id).trim();
  const cleanReason = String(reason).trim();

  try {
    const existing = localDb.getBatchById(cleanId);
    if (!existing) {
      return res.status(404).json({ error: `Batch "${cleanId}" not found` });
    }

    const requester = getRequesterContext(req);
    const callerAddr = (recalled_by || requester.address || existing.manufacturer).toLowerCase();

    // Authorization check: Only the batch manufacturer can recall
    if (
      existing.manufacturer.toLowerCase() !== callerAddr &&
      requester.role !== "admin" &&
      requester.role !== "manufacturer"
    ) {
      return res.status(403).json({
        error: "Forbidden. Only the batch manufacturer can recall this batch.",
      });
    }

    // 1. Authoritative DB Recall Update
    const updated = localDb.recallBatch({
      batch_id: cleanId,
      reason: cleanReason,
      recalled_by: callerAddr,
      tx_hash: tx_hash || null,
    });

    // 2. Authoritative On-chain Recall (if backend signer configured and not already executed via MetaMask)
    let confirmedTxHash = tx_hash || null;
    if (!confirmedTxHash) {
      try {
        const onChainTx = await executeRecallOnChain(cleanId, cleanReason);
        if (onChainTx) {
          confirmedTxHash = onChainTx;
        }
      } catch (chainErr) {
        console.warn(`Notice: On-chain recall execution error:`, chainErr.message);
      }
    }

    // 3. Best-effort mirror to Supabase
    try {
      await withTimeout(
        supabase
          .from("batches")
          .update({
            status: "Recalled",
          })
          .eq("batch_id", cleanId),
        800
      );
    } catch {
      // Non-critical mirror
    }

    return res.status(200).json({
      ok: true,
      message: `Batch "${cleanId}" officially recalled: ${cleanReason}`,
      batch: updated,
      tx_hash: confirmedTxHash,
    });
  } catch (error) {
    console.error(`Error recalling batch ${cleanId}:`, error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
