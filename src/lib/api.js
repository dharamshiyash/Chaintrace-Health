// Shared API client — resolves base URL from env vars
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    
    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      const errMsg = data.error || data.details || `HTTP ${res.status}`;
      const error = new Error(errMsg);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    
    return data;
  } catch (err) {
    // Network errors (CORS, server down, DNS failure)
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error(`Unable to reach API server. Is the backend running?`);
    }
    throw err;
  }
}

export function verifyBatch(batchId)   { return apiFetch(`/api/verify/${batchId}`); }
export function getBatchById(batchId)  { return apiFetch(`/api/batches/${batchId}`); }

export async function listBatches(params = {}, context = {}) {
  const queryParams = { ...params };
  if (context.filter) queryParams.filter = context.filter;
  if (context.tab) queryParams.tab = context.tab;

  const qs = new URLSearchParams(queryParams).toString();
  const headers = {};
  if (context.role) headers["x-user-role"] = context.role;
  if (context.address) headers["x-user-address"] = context.address;
  if (context.orgName) headers["x-org-name"] = context.orgName;

  const res = await apiFetch(`/api/batches${qs ? `?${qs}` : ""}`, { headers });

  if (res && Array.isArray(res.batches)) {
    const arr = [...res.batches];
    arr.counts = res.counts || {
      all: arr.length,
      fresh: arr.filter(b => b.isFresh).length,
      inTransit: arr.filter(b => b.isInTransit).length,
      late: arr.filter(b => b.isLate).length,
      exceptions: arr.filter(b => b.isException).length,
      activeStock: arr.filter(b => (b.view_status === "Active" || b.view_status === "Available") && !b.isException).length,
    };
    arr.requester = res.requester;
    return arr;
  }

  if (Array.isArray(res)) {
    const arr = [...res];
    arr.counts = {
      all: arr.length,
      fresh: arr.filter(b => b.isFresh || b.stage === "Fresh").length,
      inTransit: arr.filter(b => b.isInTransit || b.stage === "In-Transit").length,
      late: arr.filter(b => b.isLate).length,
      exceptions: arr.filter(b => b.isException || b.status === "Recalled" || b.status === "Suspicious").length,
      activeStock: arr.filter(b => b.status === "Active" && b.stage !== "Exception").length,
    };
    return arr;
  }

  return [];
}

export function getOffenders()          { return apiFetch("/api/offenders"); }
export function recordEvent(body)       { return apiFetch("/api/events", { method: "POST", body: JSON.stringify(body) }); }
export function registerBatchApi(body)  { return apiFetch("/api/batches", { method: "POST", body: JSON.stringify(body) }); }

// Authoritative Recall Operation
export function recallBatchApi(batchId, reason, actor, txHash) {
  return apiFetch("/api/batches/recall", {
    method: "POST",
    body: JSON.stringify({
      batch_id: batchId,
      reason,
      recalled_by: actor,
      tx_hash: txHash,
    }),
  });
}

// Authoritative Supply Chain Custody Actions
export function recordSupplyChainEventApi(body) {
  return apiFetch("/api/batches/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function dispatchBatchApi({ batchId, toAddress, location, actor, role, txHash }) {
  return recordSupplyChainEventApi({
    batch_id: batchId,
    action: "DISPATCH",
    destination_address: toAddress,
    location: location || "Dispatched from facility",
    actor,
    role: role || "Manufacturer",
    tx_hash: txHash,
  });
}

export function receiveBatchApi({ batchId, location, actor, role, txHash }) {
  return recordSupplyChainEventApi({
    batch_id: batchId,
    action: "RECEIVE",
    location: location || "Received at facility",
    actor,
    role: role || "Custodian",
    tx_hash: txHash,
  });
}

export function transferBatchApi({ batchId, toAddress, location, actor, role, txHash }) {
  return recordSupplyChainEventApi({
    batch_id: batchId,
    action: "TRANSFER",
    destination_address: toAddress,
    location: location || "Transferred to partner",
    actor,
    role: role || "Distributor",
    tx_hash: txHash,
  });
}

export function dispenseBatchApi({ batchId, location, actor, role, txHash }) {
  return recordSupplyChainEventApi({
    batch_id: batchId,
    action: "DISPENSE",
    location: location || "Dispensed to patient",
    actor,
    role: role || "Pharmacy",
    tx_hash: txHash,
  });
}

export function getBatchHistoryApi(batchId) {
  return apiFetch(`/api/batches/${batchId}/history`);
}

export function qrUrl(batchId)          { return `${BASE_URL}/api/qr/${batchId}`; }

// Download QR as blob for reliable saving
export async function downloadQrBlob(batchId) {
  const res = await fetch(`${BASE_URL}/api/qr/${batchId}`);
  if (!res.ok) throw new Error(`Failed to generate QR code: HTTP ${res.status}`);
  return res.blob();
}
