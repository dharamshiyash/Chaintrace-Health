export default function StatusBadge({ status, size = "sm" }) {
  const norm = String(status || "").toLowerCase().trim();

  let colorClasses = "bg-slate-100 text-slate-600 border border-slate-200";
  let dotColor = "bg-slate-400";

  if (norm === "active" || norm === "available" || norm === "registered") {
    colorClasses = "bg-emerald-50 text-emerald-700 border border-emerald-200";
    dotColor = "bg-emerald-500";
  } else if (norm === "incoming" || norm === "in-transit") {
    colorClasses = "bg-blue-50 text-blue-700 border border-blue-200";
    dotColor = "bg-blue-500";
  } else if (norm === "completed" || norm === "dispatched" || norm === "delivered") {
    colorClasses = "bg-indigo-50 text-indigo-700 border border-indigo-200";
    dotColor = "bg-indigo-500";
  } else if (norm === "dispensed") {
    colorClasses = "bg-purple-50 text-purple-700 border border-purple-200";
    dotColor = "bg-purple-500";
  } else if (norm === "suspicious") {
    colorClasses = "bg-amber-50 text-amber-700 border border-amber-200";
    dotColor = "bg-amber-500";
  } else if (norm === "recalled") {
    colorClasses = "bg-red-50 text-red-700 border border-red-200";
    dotColor = "bg-red-500";
  } else if (norm === "expired") {
    colorClasses = "bg-orange-50 text-orange-700 border border-orange-200";
    dotColor = "bg-orange-500";
  }

  const sizeClasses = size === "lg" ? "px-3 py-1.5 text-sm font-semibold" : "px-2.5 py-1 text-xs font-medium";

  return (
    <span className={`inline-flex items-center rounded-full whitespace-nowrap ${sizeClasses} ${colorClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} mr-1.5`} />
      {status || "Unknown"}
    </span>
  );
}
