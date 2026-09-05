import { truncateAddress, formatDateTime } from "../lib/utils.js";
import StatusBadge from "./StatusBadge.jsx";
import { Circle, CheckCircle, WarningCircle, ArrowSquareOut } from "@phosphor-icons/react";

function getStageLabel(role) {
  if (role === 0 || role === "0") return "Manufactured";
  if (role === 1 || role === "1") return "In Transit / Received";
  if (role === 2 || role === "2") return "Dispensed";
  return role || "Processed";
}

export default function EventTimeline({ history = [], loading = false }) {
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
          
          return (
            <div key={i} className="flex gap-5 group relative">
              <div className="flex flex-col items-center pt-1">
                {isAuth ? (
                  <CheckCircle size={20} weight="fill" className="text-primary-600 bg-white" />
                ) : (
                  <WarningCircle size={20} weight="fill" className="text-status-suspicious bg-white" />
                )}
                {!isLast && (
                  <div className={`w-px h-full min-h-[3rem] my-1 ${isAuth ? 'bg-primary-200' : 'bg-status-suspicious-bg border-l border-dashed border-status-suspicious'}`} />
                )}
              </div>
              
              <div className={`flex flex-col gap-1 pb-8 w-full ${!isLast && 'border-b border-slate-50 mb-4'}`}>
                <div className="flex justify-between items-start flex-wrap gap-2 w-full">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{getStageLabel(event.role)} at {event.location}</h4>
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
                    <StatusBadge status={isAuth ? "Active" : "Suspicious"} />
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
