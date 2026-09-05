// Utility functions

export function truncateAddress(addr = "", start = 6, end = 4) {
  if (!addr || addr.length < start + end + 3) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

export function formatDate(val) {
  if (!val) return "—";
  let d;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === "number" || (!isNaN(Number(val)) && !String(val).includes("-"))) {
    const num = Number(val);
    d = new Date(num < 1e11 ? num * 1000 : num);
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function formatDateTime(val) {
  if (!val) return "—";
  let d;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === "number" || (!isNaN(Number(val)) && !String(val).includes("-"))) {
    const num = Number(val);
    d = new Date(num < 1e11 ? num * 1000 : num);
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function statusClass(status = "") {
  const map = {
    Active: "badge-active",
    Suspicious: "badge-suspicious",
    Recalled: "badge-recalled",
    Expired: "badge-expired",
    Unknown: "badge-unknown",
  };
  return map[status] || "badge-unknown";
}
