import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import StatusBadge from "./StatusBadge.jsx";
import { truncateAddress } from "../lib/utils.js";
import { ArrowsClockwise, WarningCircle } from "@phosphor-icons/react";
import QRModal from "./QRModal.jsx";

export default function BatchTable({
  batches = [],
  loading = false,
  error = null,
  onRetry = null,
  onRecall = null,
  onDispatch = null,
  showActions = true,
}) {
  const [qrBatch, setQrBatch] = useState(null);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="w-full overflow-x-auto">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Medicine</th>
              <th>Current Custody</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="animate-pulse">
            {[0, 1, 2, 3].map((i) => (
              <tr key={i}>
                <td><div className="h-3.5 w-32 bg-slate-200 rounded" /></td>
                <td><div className="h-3.5 w-36 bg-slate-200 rounded" /></td>
                <td><div className="h-3.5 w-40 bg-slate-200 rounded" /></td>
                <td><div className="h-6 w-20 bg-slate-200 rounded-full" /></td>
                <td><div className="h-8 w-24 bg-slate-200 rounded-lg" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-slate-600 bg-red-50/50 rounded-2xl border border-red-100 m-4">
        <div className="p-3 bg-red-100 text-red-600 rounded-full mb-3">
          <WarningCircle size={32} weight="fill" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Failed to load batches</h3>
        <p className="text-sm text-slate-500 max-w-md mb-4">{error}</p>
        {onRetry && (
          <button 
            onClick={onRetry} 
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
          >
            <ArrowsClockwise size={16} /> Retry
          </button>
        )}
      </div>
    );
  }

  if (!batches.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-slate-500">
        <div className="text-4xl mb-3 opacity-80">📦</div>
        <h3 className="text-lg font-medium text-slate-800 mb-1">No batches found</h3>
        <p className="text-sm">Batches registered on the blockchain will appear here once synced or transferred.</p>
        {onRetry && (
          <button 
            onClick={onRetry} 
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
          >
            <ArrowsClockwise size={14} /> Refresh Data
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="w-full overflow-x-auto">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Medicine</th>
              <th>Current Custody</th>
              <th>Status</th>
              {showActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => {
              const displayStatus = b.display_status || b.view_status || b.status;
              const isRecalled = b.status === "Recalled";
              const isSuspicious = b.status === "Suspicious";

              return (
                <tr 
                  key={b.batch_id}
                  className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                  onClick={() => navigate(`/verify/${b.batch_id}`)}
                >
                  <td className="font-mono text-xs">
                    <Link
                      to={`/verify/${b.batch_id}`}
                      className="text-primary-600 hover:text-primary-800 hover:underline font-semibold"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {b.batch_id}
                    </Link>
                  </td>
                  <td>
                    <div className="font-medium text-slate-800">{b.medicine_name}</div>
                    <div className="text-[11px] text-slate-400">Qty: {b.quantity?.toLocaleString() || "N/A"}</div>
                  </td>
                  <td>
                    <div className="text-xs text-slate-700 font-medium truncate max-w-[200px]" title={b.current_org || b.current_custodian}>
                      {b.current_org || truncateAddress(b.current_custodian || b.manufacturer)}
                    </div>
                    {b.destination_org && (
                      <div className="text-[11px] text-blue-600 truncate max-w-[200px]" title={`To: ${b.destination_org}`}>
                        → {b.destination_org}
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={displayStatus} />
                    {isRecalled && b.recall_reason && (
                      <span className="text-[11px] text-red-600 block mt-0.5 font-medium truncate max-w-[160px]" title={b.recall_reason}>
                        Reason: {b.recall_reason}
                      </span>
                    )}
                    {isSuspicious && (
                      <span className="text-[11px] text-amber-700 block mt-0.5 font-medium">
                        Divergence Flagged
                      </span>
                    )}
                  </td>
                  {showActions && (
                    <td>
                      <div className="flex gap-2 flex-wrap items-center">
                        <Link
                          to={`/verify/${b.batch_id}`}
                          className="px-2.5 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                          title="View provenance"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Verify
                        </Link>
                        <button
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                          title="Show QR code"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQrBatch(b.batch_id);
                          }}
                        >
                          QR
                        </button>
                        {onDispatch && !isRecalled && !isSuspicious && (displayStatus === "Active" || displayStatus === "Registered") && (
                          <button
                            className="px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Dispatch batch"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDispatch(b);
                            }}
                          >
                            Dispatch
                          </button>
                        )}
                        {onRecall && !isRecalled && (
                          <button
                            className="px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Recall batch"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRecall(b.batch_id);
                            }}
                          >
                            Recall
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {qrBatch && <QRModal batchId={qrBatch} onClose={() => setQrBatch(null)} />}
    </>
  );
}
