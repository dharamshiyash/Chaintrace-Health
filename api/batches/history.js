import localDb from "../_lib/db.js";
import { getRequesterContext, canAccessBatch } from "../_lib/visibilityService.js";

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
    const batch = localDb.getBatchById(cleanId);
    if (!batch) {
      return res.status(404).json({ error: `Batch "${cleanId}" not found` });
    }

    const events = localDb.getBatchEvents(cleanId);
    const requester = getRequesterContext(req);

    // Authorization check
    if (!canAccessBatch(batch, requester, events)) {
      return res.status(403).json({
        error: "Forbidden. Your organization is not authorized to view this batch history.",
      });
    }

    const profiles = localDb.getAllProfiles();
    const profileMap = {};
    profiles.forEach((p) => {
      profileMap[p.address.toLowerCase()] = p.org_name;
    });

    const enriched = events.map((e) => ({
      ...e,
      orgName: profileMap[e.actor.toLowerCase()] || e.actor,
    }));

    return res.status(200).json({
      batch_id: cleanId,
      medicine_name: batch.medicine_name,
      status: batch.status,
      history: enriched,
    });
  } catch (error) {
    console.error(`Error fetching history for ${cleanId}:`, error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
