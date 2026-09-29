import localDb from "../_lib/db.js";
import { getRequesterContext } from "../_lib/visibilityService.js";
import { executeEventOnChain } from "../_lib/contract.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST to record custody events." });
  }

  const {
    batch_id,
    action,
    actor,
    role,
    location,
    destination_address,
    destination_org,
    tx_hash,
  } = req.body || {};

  if (!batch_id) {
    return res.status(400).json({ error: "batch_id is required" });
  }
  if (!action) {
    return res.status(400).json({ error: "action is required" });
  }

  const cleanId = String(batch_id).trim();

  try {
    const existing = localDb.getBatchById(cleanId);
    if (!existing) {
      return res.status(404).json({ error: `Batch "${cleanId}" not found` });
    }

    // 1. STRICT BLOCK: Cannot perform lifecycle operations on recalled batch
    if (existing.status === "Recalled") {
      return res.status(400).json({
        error: "Operation rejected: Cannot perform lifecycle operations on a recalled batch. The batch has been officially recalled.",
      });
    }

    const requester = getRequesterContext(req);
    const cleanActor = (actor || requester.address || existing.current_custodian).toLowerCase();
    const cleanRole = role || requester.role || "Custodian";

    // 2. Custody & Whitelist Authorization Check
    const actUpper = String(action).toUpperCase();
    let isAuthorized = 1;

    if (actUpper.includes("RECEIVE") || actUpper.includes("INTAKE")) {
      const prevCustodian = (existing.current_custodian || "").toLowerCase();
      // Whitelist check against previous custodian
      if (prevCustodian && prevCustodian !== cleanActor) {
        const approved = localDb.isApprovedPartner(prevCustodian, cleanActor);
        if (!approved) {
          isAuthorized = 0; // Unauthorized handoff => triggers Suspicious status
        }
      }
    } else if (actUpper.includes("DISPATCH") || actUpper.includes("TRANSFER")) {
      // Must be current custodian
      if (
        existing.current_custodian.toLowerCase() !== cleanActor &&
        requester.role !== "admin"
      ) {
        return res.status(403).json({
          error: "Forbidden. Only the current custodian can dispatch or transfer this batch.",
        });
      }
    } else if (actUpper.includes("DISPENSE")) {
      // Must be pharmacy holding custody
      if (
        existing.current_custodian.toLowerCase() !== cleanActor &&
        requester.role !== "admin"
      ) {
        return res.status(403).json({
          error: "Forbidden. Only the authorized pharmacy custodian can dispense this batch.",
        });
      }
    }

    // 3. Update Database State
    const result = localDb.addSupplyChainEvent({
      batch_id: cleanId,
      actor: cleanActor,
      role: cleanRole,
      action: actUpper,
      location: location || "Logistics Hub",
      destination_address,
      destination_org,
      authorized: isAuthorized,
      tx_hash: tx_hash || null,
    });

    // 4. On-chain sync if backend signer available and not already submitted via MetaMask
    let confirmedTxHash = tx_hash || null;
    if (!confirmedTxHash) {
      try {
        const onChainTx = await executeEventOnChain(
          cleanId,
          cleanRole,
          location || "Distribution Point"
        );
        if (onChainTx) confirmedTxHash = onChainTx;
      } catch (chainErr) {
        console.warn("Notice: On-chain event write skipped:", chainErr.message);
      }
    }

    return res.status(200).json({
      ok: true,
      message: `Event "${actUpper}" successfully recorded for batch ${cleanId}.`,
      batch: result.batch,
      events: result.events,
      tx_hash: confirmedTxHash,
    });
  } catch (error) {
    console.error(`Error recording event for ${cleanId}:`, error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
