import localDb from "./db.js";

/**
 * Standard Known Default Organization Addresses
 */
export const DEFAULT_ORG_MAP = {
  manufacturer: {
    address: "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD".toLowerCase(),
    name: "Apex BioPharma (Origin Node)",
  },
  manufacturer2: {
    address: "0x76dE5D6Cc4b8305119Ee57eFb7AA68832247595A".toLowerCase(),
    name: "Bharat Biotech Labs",
  },
  distributor: {
    address: "0xc26535042E34fDf8E56015f2fB6FE175f9A25365".toLowerCase(),
    name: "Novartis Global Logistics (Distributor 1)",
  },
  distributor2: {
    address: "0x2Bd8a4078832a8C3775685B643442ffA567b47f3".toLowerCase(),
    name: "Central Wholesale Pharma (Distributor 2)",
  },
  warehouse: {
    address: "0x8aF0B59Ce4F25F5e0AF59309a9a25e8e5a7B09d1".toLowerCase(),
    name: "National Cold Storage Warehouse",
  },
  pharmacy: {
    address: "0x4e1E0cb18AE2f56F466513c67969cA4E864dF0F3".toLowerCase(),
    name: "Apollo Pharmacy Delhi (Healthcare Provider 1)",
  },
  pharmacy2: {
    address: "0x9fC97E4A860F5F6873523f03b51e50882eFF12a1".toLowerCase(),
    name: "MedPlus Retail Healthcare (Healthcare Provider 2)",
  },
};

/**
 * Resolves caller context from incoming request
 */
export function getRequesterContext(req = {}) {
  const headers = req.headers || {};
  const query = req.query || {};

  // Check headers first (standard for API authorization), then query/body params
  const roleHeader = (
    headers["x-user-role"] ||
    headers["x-role"] ||
    query.role ||
    req.role ||
    ""
  ).toLowerCase().trim();

  const addressHeader = (
    headers["x-user-address"] ||
    headers["x-address"] ||
    headers["x-organization-id"] ||
    query.organization_id ||
    query.address ||
    req.address ||
    req.user_address ||
    ""
  ).toLowerCase().trim();

  const orgNameHeader = (
    headers["x-org-name"] ||
    query.org_name ||
    req.org_name ||
    req.orgName ||
    ""
  ).trim();

  // If role is passed without address, resolve to default node for that role
  let role = roleHeader || "all";
  let address = addressHeader;
  let orgName = orgNameHeader;

  if (role === "manufacturer" && !address) {
    address = DEFAULT_ORG_MAP.manufacturer.address;
    orgName = DEFAULT_ORG_MAP.manufacturer.name;
  } else if (role === "distributor" && !address) {
    address = DEFAULT_ORG_MAP.distributor.address;
    orgName = DEFAULT_ORG_MAP.distributor.name;
  } else if (role === "pharmacy" && !address) {
    address = DEFAULT_ORG_MAP.pharmacy.address;
    orgName = DEFAULT_ORG_MAP.pharmacy.name;
  } else if (role === "warehouse" && !address) {
    address = DEFAULT_ORG_MAP.warehouse.address;
    orgName = DEFAULT_ORG_MAP.warehouse.name;
  }

  // Look up profile if address is provided
  if (address) {
    const profile = localDb.getProfile(address);
    if (profile) {
      role = profile.role.toLowerCase();
      orgName = profile.org_name;
    }
  }

  return {
    role,
    address,
    orgName,
    isGlobalAdmin: role === "admin",
    isPublic: role === "public" || role === "all",
  };
}

/**
 * Derives role-specific view status, stage, and normalized filter flags
 */
export function deriveRoleStatus(batch, requester, events = []) {
  const canonicalStatus = batch.status || "Active";
  const role = requester.role || "public";
  const reqAddr = (requester.address || "").toLowerCase();
  const reqOrg = (requester.orgName || "").toLowerCase();

  // Check Expiry
  const expiryMs =
    typeof batch.expiry_date === "number" && batch.expiry_date < 1e12
      ? batch.expiry_date * 1000
      : Number(batch.expiry_date) || 0;
  const isExpired = expiryMs > 0 && Date.now() > expiryMs;

  let isLate = false;
  if (expiryMs > 0 && !isExpired) {
    const timeToExpiry = expiryMs - Date.now();
    if (timeToExpiry < 180 * 24 * 60 * 60 * 1000 && timeToExpiry > 0) {
      isLate = true;
    }
  }

  // ─── EXCEPTIONS ─────────────────────────────────────────────────────────────
  if (canonicalStatus === "Recalled") {
    return {
      canonical_status: "Recalled",
      view_status: "Recalled",
      stage: "Exception",
      isFresh: false,
      isInTransit: false,
      isLate: false,
      isException: true,
      canOperate: false,
    };
  }

  if (canonicalStatus === "Suspicious") {
    return {
      canonical_status: "Suspicious",
      view_status: "Suspicious",
      stage: "Exception",
      isFresh: false,
      isInTransit: false,
      isLate: false,
      isException: true,
      canOperate: false,
    };
  }

  if (canonicalStatus === "Expired" || isExpired) {
    return {
      canonical_status: "Expired",
      view_status: "Expired",
      stage: "Exception",
      isFresh: false,
      isInTransit: false,
      isLate: false,
      isException: true,
      canOperate: false,
    };
  }

  // ─── NORMAL LIFECYCLE ───────────────────────────────────────────────────────
  const currentCustodian = (batch.current_custodian || "").toLowerCase();
  const destAddress = (batch.destination_address || "").toLowerCase();
  const batchManufacturer = (batch.manufacturer || "").toLowerCase();
  const batchStage = (batch.stage || "Fresh").toLowerCase();

  let viewStatus = "Active";
  let stage = "Fresh";

  if (role === "manufacturer") {
    // If batch is still with manufacturer and hasn't been received by downstream
    const hasLeftManufacturer =
      currentCustodian !== batchManufacturer ||
      destAddress.length > 0 ||
      batchStage === "in-transit" ||
      batchStage === "received" ||
      batchStage === "delivered" ||
      batchStage === "dispensed";

    if (!hasLeftManufacturer) {
      viewStatus = "Active";
      stage = "Fresh";
    } else if (batchStage === "in-transit") {
      viewStatus = "Dispatched";
      stage = "In-Transit";
    } else {
      // Responsibility completed for this stage
      viewStatus = "Completed";
      stage = "Delivered";
    }
  } else if (role === "distributor") {
    const isDest = reqAddr && destAddress === reqAddr;
    const isCurrent = reqAddr && currentCustodian === reqAddr;
    const hasDispatchedDownstream =
      isCurrent && destAddress.length > 0 && destAddress !== reqAddr;

    if (isDest && currentCustodian !== reqAddr) {
      viewStatus = "Incoming";
      stage = "In-Transit";
    } else if (isCurrent && !hasDispatchedDownstream) {
      viewStatus = "Active";
      stage = "Fresh";
    } else if (isCurrent && hasDispatchedDownstream && batchStage === "in-transit") {
      viewStatus = "Dispatched";
      stage = "In-Transit";
    } else {
      viewStatus = "Completed";
      stage = "Delivered";
    }
  } else if (role === "warehouse") {
    const isDest = reqAddr && destAddress === reqAddr;
    const isCurrent = reqAddr && currentCustodian === reqAddr;

    if (isDest && currentCustodian !== reqAddr) {
      viewStatus = "Incoming";
      stage = "In-Transit";
    } else if (isCurrent && !destAddress) {
      viewStatus = "Active";
      stage = "Fresh";
    } else {
      viewStatus = "Completed";
      stage = "Delivered";
    }
  } else if (role === "pharmacy") {
    const isDest = reqAddr && destAddress === reqAddr;
    const isCurrent = reqAddr && currentCustodian === reqAddr;
    const isDispensed = batchStage === "dispensed";

    if (isDispensed) {
      viewStatus = "Dispensed";
      stage = "Delivered";
    } else if (isDest && currentCustodian !== reqAddr) {
      viewStatus = "Incoming";
      stage = "In-Transit";
    } else if (isCurrent) {
      viewStatus = "Active";
      stage = "Fresh";
    } else {
      viewStatus = "Completed";
      stage = "Delivered";
    }
  } else {
    // Public / All
    if (batchStage === "dispensed") {
      viewStatus = "Dispensed";
      stage = "Delivered";
    } else if (batchStage === "in-transit") {
      viewStatus = "In-Transit";
      stage = "In-Transit";
    } else {
      viewStatus = "Active";
      stage = "Fresh";
    }
  }

  const isException = false;
  const isInTransit =
    viewStatus === "Incoming" ||
    viewStatus === "In-Transit" ||
    viewStatus === "Dispatched" ||
    stage === "In-Transit";

  const isFresh =
    !isException &&
    !isLate &&
    !isInTransit &&
    (viewStatus === "Active" || viewStatus === "Available" || stage === "Fresh");

  return {
    canonical_status: canonicalStatus,
    view_status: viewStatus,
    stage: isInTransit ? "In-Transit" : stage,
    isFresh,
    isInTransit,
    isLate,
    isException,
    canOperate: true,
  };
}

/**
 * Evaluates whether a requester organization is authorized to view this batch
 */
export function canAccessBatch(batch, requester, events = []) {
  if (requester.isGlobalAdmin || requester.isPublic) {
    return true;
  }

  const reqAddr = (requester.address || "").toLowerCase();
  const reqOrg = (requester.orgName || "").toLowerCase();
  const role = requester.role;

  const mfr = (batch.manufacturer || "").toLowerCase();
  const custodian = (batch.current_custodian || "").toLowerCase();
  const currentOrg = (batch.current_org || "").toLowerCase();
  const destAddr = (batch.destination_address || "").toLowerCase();
  const destOrg = (batch.destination_org || "").toLowerCase();

  // 1. Manufacturer:
  if (role === "manufacturer") {
    // Only sees batches they created or currently hold
    if (reqAddr && (mfr === reqAddr || custodian === reqAddr)) return true;
    if (reqOrg && currentOrg.includes(reqOrg)) return true;
    return false;
  }

  // 2. Distributor:
  if (role === "distributor") {
    // Visible only if dispatched to, held by, or processed in history by this distributor
    if (reqAddr && (custodian === reqAddr || destAddr === reqAddr)) return true;
    if (reqOrg && (currentOrg.includes(reqOrg) || destOrg.includes(reqOrg))) return true;

    // Check history events
    const inHistory = events.some(
      (e) =>
        (reqAddr && e.actor?.toLowerCase() === reqAddr) ||
        (reqOrg && e.location?.toLowerCase().includes(reqOrg))
    );
    return inHistory;
  }

  // 3. Warehouse:
  if (role === "warehouse") {
    if (reqAddr && (custodian === reqAddr || destAddr === reqAddr)) return true;
    if (reqOrg && (currentOrg.includes(reqOrg) || destOrg.includes(reqOrg))) return true;
    return events.some(
      (e) => reqAddr && e.actor?.toLowerCase() === reqAddr
    );
  }

  // 4. Pharmacy:
  if (role === "pharmacy") {
    // A pharmacy that has not received anything sees 0 batches
    if (reqAddr && (custodian === reqAddr || destAddr === reqAddr)) return true;
    if (reqOrg && (currentOrg.includes(reqOrg) || destOrg.includes(reqOrg))) return true;

    return events.some(
      (e) => reqAddr && e.actor?.toLowerCase() === reqAddr
    );
  }

  return false;
}

/**
 * Filter batches according to requester scope and enrich with role view status
 */
export function scopeAndEnrichBatches(rawBatches, requester, filterTab = "All") {
  const visible = [];

  for (const b of rawBatches) {
    const events = localDb.getBatchEvents(b.batch_id);
    if (!canAccessBatch(b, requester, events)) {
      continue;
    }

    const derived = deriveRoleStatus(b, requester, events);
    const enriched = {
      ...b,
      ...derived,
      is_anomaly: Boolean(derived.isException),
      status: b.status, // preserve canonical status
      display_status: derived.view_status, // role-specific display status
    };
    visible.push(enriched);
  }

  // Sort newest first
  visible.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  // Compute exact filter counts for this scoped view
  const counts = {
    all: visible.length,
    fresh: visible.filter((b) => b.isFresh).length,
    inTransit: visible.filter((b) => b.isInTransit).length,
    late: visible.filter((b) => b.isLate).length,
    exceptions: visible.filter((b) => b.isException).length,
    activeStock: visible.filter(
      (b) =>
        (b.view_status === "Active" || b.view_status === "Available") &&
        !b.isException
    ).length,
  };

  // Apply tab filter if specified
  const tabClean = String(filterTab || "All").toLowerCase();
  let filtered = visible;

  if (tabClean === "fresh") {
    filtered = visible.filter((b) => b.isFresh);
  } else if (tabClean === "in-transit") {
    filtered = visible.filter((b) => b.isInTransit);
  } else if (tabClean === "late") {
    filtered = visible.filter((b) => b.isLate);
  } else if (tabClean === "exceptions") {
    filtered = visible.filter((b) => b.isException);
  }

  return {
    batches: filtered,
    allVisible: visible,
    counts,
    requester: {
      role: requester.role,
      address: requester.address,
      orgName: requester.orgName,
    },
  };
}

export default {
  DEFAULT_ORG_MAP,
  getRequesterContext,
  deriveRoleStatus,
  canAccessBatch,
  scopeAndEnrichBatches,
};
