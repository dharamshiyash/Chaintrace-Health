export default function StatusBadge({ status, size = "sm" }) {
  let colorClasses = "bg-status-unknown-bg text-status-unknown";
  
  if (status === "Active") colorClasses = "bg-status-active-bg text-status-active";
  else if (status === "Suspicious") colorClasses = "bg-status-suspicious-bg text-status-suspicious";
  else if (status === "Recalled") colorClasses = "bg-status-recalled-bg text-status-recalled";
  else if (status === "Expired") colorClasses = "bg-status-expired-bg text-status-expired";
  
  const sizeClasses = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs";

  return (
    <span className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${sizeClasses} ${colorClasses}`}>
      {status === "Active" && <span className="w-1.5 h-1.5 rounded-full bg-status-active mr-1.5 opacity-80" />}
      {status === "Suspicious" && <span className="w-1.5 h-1.5 rounded-full bg-status-suspicious mr-1.5 opacity-80" />}
      {status === "Recalled" && <span className="w-1.5 h-1.5 rounded-full bg-status-recalled mr-1.5 opacity-80" />}
      {status || "Unknown"}
    </span>
  );
}
