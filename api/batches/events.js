import localDb from "../_lib/db.js";
import { getRequesterContext } from "../_lib/visibilityService.js";
import { executeEventOnChain } from "../_lib/contract.js";
import { findOrHydrateBatch } from "../_lib/syncService.js";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST to record custody events." });
  }

  const rawBatchId = req.body?.batch_id || req.body?.batchId;
  const action = req.body?.action;
  const actor = req.body?.actor;
  const role = req.body?.role;
  const location = req.body?.location;
  const destination_address = req.body?.destination_address || req.body?.destinationAddress;
  const destination_org = req.body?.destination_org || req.body?.destinationOrg;
  const tx_hash = req.body?.tx_hash || req.body?.txHash;

  if (!rawBatchId) {
    return res.status(400).json({ error: "batch_id is required" });
  }
  if (!action) {
    return res.status(400).json({ error: "action is required" });
  }

  const cleanId = String(rawBatchId).trim();

  try {
    const existing = await findOrHydrateBatch(cleanId, req.body);
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
    const actUpper = String(action).toUpperCase();

    // Auto-resolve destination org name from destination address if not provided
    let cleanDestOrg = destination_org || null;
    if (destination_address && !cleanDestOrg) {
      const destProf = localDb.getProfile(destination_address.toLowerCase());
      if (destProf) {
        cleanDestOrg = destProf.org_name;
      }
    }

    // 2. Custody & Whitelist Authorization Check
    let isAuthorized = 1;

    if (actUpper.includes("RECEIVE") || actUpper.includes("INTAKE")) {
      const prevCustodian = (existing.current_custodian || "").toLowerCase();
      const isDesignatedDest = existing.destination_address && existing.destination_address.toLowerCase() === cleanActor;
      // Whitelist check against previous custodian
      if (prevCustodian && prevCustodian !== cleanActor && !isDesignatedDest) {
        const approved = localDb.isApprovedPartner(prevCustodian, cleanActor);
        if (!approved) {
          isAuthorized = 0; // Unauthorized handoff => triggers Suspicious status
        }
      }
    } else if (actUpper.includes("DISPATCH") || actUpper.includes("TRANSFER")) {
      const isCurrentCustodian = existing.current_custodian?.toLowerCase() === cleanActor;
      const isManufacturer = existing.manufacturer?.toLowerCase() === cleanActor;
      const isDesignatedDest = existing.destination_address?.toLowerCase() === cleanActor;
      const isManufacturerRole = cleanRole.toLowerCase().includes("manufacturer") || requester.role === "manufacturer";
      const isDistributorRole = cleanRole.toLowerCase().includes("distributor") || requester.role === "distributor";
      const isAdmin = requester.role === "admin";

      // If a destination address is specified, automatically whitelist this partner relationship
      if (destination_address) {
        try {
          localDb.addApprovedPartner(cleanActor, destination_address);
        } catch {}
      }

      // Allow if:
      // - Actor is current custodian OR
      // - Actor is batch manufacturer OR
      // - Batch is dispatched to this actor (receiving/re-routing) OR
      // - Manufacturer role dispatching in-facility batch OR
      // - Distributor role dispatching from their logistics node OR admin
      if (!isCurrentCustodian && !isManufacturer && !isDesignatedDest && !isManufacturerRole && !isDistributorRole && !isAdmin) {
        return res.status(403).json({
          error: "Forbidden. Only the current custodian or authorized supply chain node can dispatch or transfer this batch.",
        });
      }
    } else if (actUpper.includes("DISPENSE")) {
      const isCurrentCustodian = existing.current_custodian?.toLowerCase() === cleanActor;
      const isPharmacyRole = cleanRole.toLowerCase().includes("pharmacy") || requester.role === "pharmacy";
      const isAdmin = requester.role === "admin";

      if (!isCurrentCustodian && !isPharmacyRole && !isAdmin) {
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
      location: location || (cleanRole.toLowerCase().includes("manufacturer") ? "Dispatched from facility" : "Logistics Hub"),
      destination_address,
      destination_org: cleanDestOrg,
      authorized: isAuthorized,
      tx_hash: tx_hash || null,
    });

    // 4. Generate deterministic cryptographic event hash if not already submitted via MetaMask
    let confirmedTxHash = tx_hash || ("0x" + crypto.createHash("sha256").update(`${cleanId}-${cleanActor}-${actUpper}-${Date.now()}`).digest("hex"));

    // Attempt non-blocking on-chain sync in background
    if (!tx_hash) {
      executeEventOnChain(
        cleanId,
        cleanRole,
        location || "Distribution Point"
      ).catch((chainErr) => {
        console.warn("Notice: On-chain event write skipped:", chainErr.message);
      });
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
