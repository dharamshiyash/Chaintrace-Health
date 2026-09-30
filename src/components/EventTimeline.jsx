import { truncateAddress, formatDateTime } from "../lib/utils.js";
import StatusBadge from "./StatusBadge.jsx";
import { CheckCircle, WarningCircle, ArrowSquareOut } from "@phosphor-icons/react";

function getStageLabel(role) {
  if (role === 0 || role === "0") return "Manufactured";
  if (role === 1 || role === "1") return "In Transit / Received";
  if (role === 2 || role === "2") return "Dispensed";
  return role || "Processed";
}

function getEventActionTitle(event, index) {
  const action = String(event.action || "").toUpperCase();
  const role = String(event.role || "").toUpperCase();
  const location = event.location ? ` at ${event.location}` : "";

  if (action === "RECALLED" || action.includes("RECALL")) {
    return `Official Batch Recall Issued${location}`;
  }
  if (action === "DISPENSED_TO_PATIENT" || action.includes("DISPENS")) {
    return `Dispensed to Patient${location}`;
  }
  if (action === "RECEIVED_AT_FACILITY" || action.includes("RECEIV") || action.includes("INTAKE")) {
    if (role.includes("PHARMACY")) return `Received at Retail Pharmacy${location}`;
    return `Received at Logistics Hub${location}`;
  }
  if (action === "DISPATCHED_TO_DISTRIBUTOR" || (action.includes("DISPATCH") && role.includes("MANUFACTURER"))) {
    return `Dispatched to Distributor${location}`;
  }
  if (action === "DISPATCHED_TO_PHARMACY" || (action.includes("DISPATCH") && role.includes("DISTRIBUTOR")) || action.includes("TRANSFER")) {
    return `Dispatched to Pharmacy${location}`;
  }
  if (action.includes("INTERCEPT") || (!event.authorized && index > 0)) {
    return `Unauthorized Intermediary Intercept${location}`;
  }
  if (action === "REGISTERED" || index === 0) {
    return `Batch Genesis Registration${location}`;
  }

  return `${getStageLabel(event.role)}${location}`;
}

function getEventBadge(event, index, totalEvents, batchStatus) {
  if (event.authorized === false || !event.authorized) {
    return { status: "suspicious", label: "Unauthorized" };
  }

  const action = String(event.action || "").toUpperCase();
  const role = String(event.role || "").toUpperCase();
  const isLast = index === totalEvents - 1;

  if (action.includes("RECALL") || (isLast && batchStatus === "Recalled")) {
    return { status: "recalled", label: "Recalled" };
  }

  if (action.includes("DISPENS")) {
    return { status: "dispensed", label: "Dispensed" };
  }

  if (action.includes("DISPATCH") || action.includes("TRANSFER") || action.includes("TRANSIT")) {
    return { status: "in-transit", label: "In-Transit" };
  }

  if (action.includes("RECEIV") || action.includes("INTAKE")) {
    return { status: "completed", label: "In Custody" };
  }

  if (action.includes("REGISTER") || index === 0) {
    return { status: "registered", label: "Registered" };
  }

  // Infer by role and milestone position
  if (role.includes("DISTRIBUTOR")) {
    return { status: "completed", label: "In Custody" };
  }
  if (role.includes("PHARMACY")) {
    return isLast ? { status: "dispensed", label: "Dispensed" } : { status: "completed", label: "In Custody" };
  }

  return { status: "available", label: "Verified" };
}

export default function EventTimeline({ history = [], batchStatus = "Active", loading = false }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse p-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-4 h-4 rounded-full bg-slate-200" />
              {i !== 2 && <div className="w-0.5 h-16 bg-slate-100 my-1" />}
            </div>
            <div className="flex flex-col gap-2 mt-0.5 w-full">
              <div className="flex justify-between w-full max-w-sm">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-20 bg-slate-100 rounded" />
              </div>
              <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!history.length) return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-slate-500">
      <div className="text-4xl mb-3 opacity-80">🔗</div>
      <h3 className="text-lg font-medium text-slate-800 mb-1">No events recorded</h3>
      <p className="text-sm">No supply chain events have been added for this batch yet.</p>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex flex-col gap-0">
        {history.map((event, i) => {
          const isLast = i === history.length - 1;
          const isAuth = event.authorized;
          const badge = getEventBadge(event, i, history.length, batchStatus);
          const isRecall = badge.status === "recalled";
          
          return (
            <div key={i} className="flex gap-5 group relative">
              <div className="flex flex-col items-center pt-1">
                {isRecall ? (
                  <WarningCircle size={20} weight="fill" className="text-red-600 bg-white" />
                ) : isAuth ? (
                  <CheckCircle size={20} weight="fill" className="text-primary-600 bg-white" />
                ) : (
                  <WarningCircle size={20} weight="fill" className="text-status-suspicious bg-white" />
                )}
                {!isLast && (
                  <div className={`w-px h-full min-h-[3rem] my-1 ${
                    isRecall
                      ? 'bg-red-200 border-l border-dashed border-red-500'
                      : isAuth 
                      ? 'bg-primary-200' 
                      : 'bg-status-suspicious-bg border-l border-dashed border-status-suspicious'
                  }`} />
                )}
              </div>
              
              <div className={`flex flex-col gap-1 pb-8 w-full ${!isLast && 'border-b border-slate-50 mb-4'}`}>
                <div className="flex justify-between items-start flex-wrap gap-2 w-full">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{getEventActionTitle(event, i)}</h4>
                    <div className="text-sm font-medium text-slate-700 mb-1">{event.orgName || "Unknown"}</div>
                    <div className="font-mono text-xs text-slate-400 mb-1">{truncateAddress(event.actor)}</div>
                    {event.txHash && (
                      <a href={`https://amoy.polygonscan.com/tx/${event.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] text-primary-600 bg-primary-50 hover:bg-primary-100 px-1.5 py-0.5 rounded transition-colors mt-1">
                        tx: {truncateAddress(event.txHash)} <ArrowSquareOut size={10} />
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-xs text-slate-500 font-medium">{formatDateTime(event.timestamp)}</span>
                    <StatusBadge status={badge.status} label={badge.label} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
