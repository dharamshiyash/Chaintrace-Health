import localDb from "../_lib/db.js";
import { getRequesterContext, canAccessBatch, deriveRoleStatus } from "../_lib/visibilityService.js";
import { findOrHydrateBatch } from "../_lib/syncService.js";

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
    const batch = await findOrHydrateBatch(cleanId);
    if (!batch) {
      return res.status(404).json({ error: `Batch "${cleanId}" not found` });
    }

    const events = localDb.getBatchEvents(cleanId);
    const requester = getRequesterContext(req);

    // SECURITY & AUTHORIZATION: Enforce organization-level access control
    if (!canAccessBatch(batch, requester, events)) {
      return res.status(403).json({
        error: "Access denied. Your organization is not authorized to access this batch.",
      });
    }

    const derived = deriveRoleStatus(batch, requester, events);
    const enriched = {
      ...batch,
      ...derived,
      status: batch.status, // preserve canonical status
      display_status: derived.view_status,
      events,
    };

    return res.status(200).json(enriched);
  } catch (error) {
    console.error(`Error fetching batch ${cleanId}:`, error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
