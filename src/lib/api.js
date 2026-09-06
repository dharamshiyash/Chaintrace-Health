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
      throw new Error(errMsg);
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
export function listBatches(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/api/batches${qs ? `?${qs}` : ""}`);
}
export function getOffenders()          { return apiFetch("/api/offenders"); }
export function recordEvent(body)       { return apiFetch("/api/events", { method: "POST", body: JSON.stringify(body) }); }
export function registerBatchApi(body)  { return apiFetch("/api/batches", { method: "POST", body: JSON.stringify(body) }); }
export function qrUrl(batchId)          { return `${BASE_URL}/api/qr/${batchId}`; }

// Download QR as blob for reliable saving
export async function downloadQrBlob(batchId) {
  const res = await fetch(`${BASE_URL}/api/qr/${batchId}`);
  if (!res.ok) throw new Error(`Failed to generate QR code: HTTP ${res.status}`);
  return res.blob();
}
