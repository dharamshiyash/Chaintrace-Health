import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import StatusBadge from "./StatusBadge.jsx";
import { truncateAddress } from "../lib/utils.js";
import { ArrowsClockwise, WarningCircle } from "@phosphor-icons/react";
import QRModal from "./QRModal.jsx";

export function getRoleDisplayStatus(b, role) {
  if (b.status === "Recalled") return "Recalled";
  if (b.status === "Suspicious") return "Suspicious";
  if (b.status === "Expired") return "Expired";

  const stage = String(b.stage || "").toLowerCase();
  const destOrg = String(b.destination_org || "").toLowerCase();
  const destAddr = String(b.destination_address || "").toLowerCase();
  const currentOrg = String(b.current_org || "").toLowerCase();
  const currentCustodian = String(b.current_custodian || "").toLowerCase();
  const mfg = String(b.manufacturer || "").toLowerCase();
  const hasDestination = Boolean(b.destination_address || b.destination_org);
  const isInTransit = stage === "in-transit" || b.isInTransit || hasDestination;
  const isDispensed = stage === "dispensed" || stage === "delivered";

  const targetDest = `${destOrg} ${destAddr}`;
  const targetCurrent = `${currentOrg} ${currentCustodian}`;

  const isDestPharmacy = Boolean(
    targetDest.includes("pharmacy") ||
    targetDest.includes("apollo") ||
    targetDest.includes("medplus") ||
    targetDest.includes("dispensary") ||
    targetDest.includes("healthcare") ||
    targetDest.includes("retail") ||
    targetDest.includes("0x4e1e0cb18ae2f56f466513c67969ca4e864df0f3") ||
    targetDest.includes("0x9fc97e4a860f5f6873523f03b51e50882eff12a1")
  );

  const isDestDistributor = Boolean(
    targetDest.includes("distributor") ||
    targetDest.includes("wholesale") ||
    targetDest.includes("novartis") ||
    targetDest.includes("central") ||
    targetDest.includes("logistics") ||
    targetDest.includes("warehouse") ||
    targetDest.includes("0xc26535042e34fdf8e56015f2fb6fe175f9a25365") ||
    targetDest.includes("0x2bd8a4078832a8c3775685b643442ffa567b47f3") ||
    targetDest.includes("0x8af0b59ce4f25f5e0af59309a9a25e8e5a7b09d1")
  );

  const isHeldByPharmacy = Boolean(
    targetCurrent.includes("pharmacy") ||
    targetCurrent.includes("apollo") ||
    targetCurrent.includes("medplus") ||
    targetCurrent.includes("dispensary") ||
    targetCurrent.includes("0x4e1e0cb18ae2f56f466513c67969ca4e864df0f3") ||
    targetCurrent.includes("0x9fc97e4a860f5f6873523f03b51e50882eff12a1")
  );

  const isHeldByDistributor = Boolean(
    targetCurrent.includes("distributor") ||
    targetCurrent.includes("wholesale") ||
    targetCurrent.includes("novartis") ||
    targetCurrent.includes("central") ||
    targetCurrent.includes("logistics") ||
    targetCurrent.includes("warehouse") ||
    targetCurrent.includes("0xc26535042e34fdf8e56015f2fb6fe175f9a25365") ||
    targetCurrent.includes("0x2bd8a4078832a8c3775685b643442ffa567b47f3") ||
    targetCurrent.includes("0x8af0b59ce4f25f5e0af59309a9a25e8e5a7b09d1")
  );

  const isHeldByManufacturer = Boolean(
    !isHeldByDistributor && !isHeldByPharmacy && (
      targetCurrent.includes("apex") ||
      targetCurrent.includes("origin") ||
      targetCurrent.includes("facility") ||
      targetCurrent.includes("manufacturer") ||
      targetCurrent.includes("bharat") ||
      !currentCustodian ||
      currentCustodian === mfg
    )
  );

  if (role === "manufacturer") {
    if (isDispensed) return "Completed";
    if (isInTransit) return "Dispatched";
    if (isHeldByDistributor || isHeldByPharmacy || !isHeldByManufacturer) {
      return "Completed";
    }
    return "Active";
  }

  if (role === "distributor") {
    if (isDispensed) return "Completed";
    if (isInTransit) {
      if (isDestPharmacy) return "Dispatched";
      return "In-Transit";
    }
    if (isHeldByPharmacy) return "Completed";
    if (isHeldByDistributor) return "In Custody";
    return "Completed";
  }

  if (role === "pharmacy") {
    if (isDispensed) return "Completed";
    if (isInTransit) {
      if (isDestPharmacy) return "In-Transit";
      return "Dispatched";
    }
    if (isHeldByPharmacy) return "In Custody";
    return "Completed";
  }

  if (isDispensed) return "Completed";
  if (isInTransit) return "In-Transit";
  return b.display_status || b.view_status || b.status || "Active";
}

export default function BatchTable({
  batches = [],
  loading = false,
  error = null,
  role = "all",
  onRetry = null,
  onRecall = null,
  onDispatch = null,
  onReceive = null,
  onDispense = null,
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
              const displayStatus = getRoleDisplayStatus(b, role);
              const isRecalled = b.status === "Recalled";
              const isSuspicious = b.status === "Suspicious";
              const isRecalledOrSuspicious = isRecalled || isSuspicious;

              const stageLower = String(b.stage || "").toLowerCase();
              const hasDest = Boolean(b.destination_address || b.destination_org);
              const isBatchInTransit = b.isInTransit || stageLower === "in-transit" || hasDest;

              const destOrgLower = String(b.destination_org || "").toLowerCase();
              const destAddrLower = String(b.destination_address || "").toLowerCase();
              const currentOrgLower = String(b.current_org || "").toLowerCase();
              const currentCustLower = String(b.current_custodian || "").toLowerCase();

              const targetDest = `${destOrgLower} ${destAddrLower}`;
              const targetCurrent = `${currentOrgLower} ${currentCustLower}`;

              const isDestPharmacy = Boolean(
                targetDest.includes("pharmacy") ||
                targetDest.includes("apollo") ||
                targetDest.includes("medplus") ||
                targetDest.includes("dispensary") ||
                targetDest.includes("healthcare") ||
                targetDest.includes("retail") ||
                targetDest.includes("0x4e1e0cb18ae2f56f466513c67969ca4e864df0f3") ||
                targetDest.includes("0x9fc97e4a860f5f6873523f03b51e50882eff12a1")
              );

              const isHeldByPharmacy = Boolean(
                targetCurrent.includes("pharmacy") ||
                targetCurrent.includes("apollo") ||
                targetCurrent.includes("medplus") ||
                targetCurrent.includes("dispensary") ||
                targetCurrent.includes("0x4e1e0cb18ae2f56f466513c67969ca4e864df0f3") ||
                targetCurrent.includes("0x9fc97e4a860f5f6873523f03b51e50882eff12a1")
              );

              const isHeldByDistributor = Boolean(
                targetCurrent.includes("distributor") ||
                targetCurrent.includes("wholesale") ||
                targetCurrent.includes("novartis") ||
                targetCurrent.includes("central") ||
                targetCurrent.includes("logistics") ||
                targetCurrent.includes("warehouse") ||
                targetCurrent.includes("0xc26535042e34fdf8e56015f2fb6fe175f9a25365") ||
                targetCurrent.includes("0x2bd8a4078832a8c3775685b643442ffa567b47f3") ||
                targetCurrent.includes("0x8af0b59ce4f25f5e0af59309a9a25e8e5a7b09d1")
              );

              const isHeldByManufacturer = Boolean(
                !isHeldByDistributor && !isHeldByPharmacy && (
                  targetCurrent.includes("apex") ||
                  targetCurrent.includes("origin") ||
                  targetCurrent.includes("facility") ||
                  targetCurrent.includes("manufacturer") ||
                  targetCurrent.includes("bharat") ||
                  !b.current_custodian ||
                  b.current_custodian === b.manufacturer
                )
              );

              // 1. Receive Button:
              // Distributor: only when in-transit AND destined for a distributor (NOT pharmacy)
              // Pharmacy: only when in-transit AND destined for pharmacy (NOT distributor)
              const canDistributorReceive =
                role === "distributor" &&
                onReceive &&
                !isRecalledOrSuspicious &&
                isBatchInTransit &&
                !isDestPharmacy;

              const canPharmacyReceive =
                role === "pharmacy" &&
                onReceive &&
                !isRecalledOrSuspicious &&
                isBatchInTransit &&
                isDestPharmacy;

              const showReceiveBtn = canDistributorReceive || canPharmacyReceive;

              // 2. Dispatch Button:
              // Manufacturer: only when physically holding in facility (not in transit!)
              // Distributor: only when distributor holds the batch (already received, not in transit!)
              const canManufacturerDispatch =
                role === "manufacturer" &&
                onDispatch &&
                !isRecalledOrSuspicious &&
                !isBatchInTransit &&
                isHeldByManufacturer;

              const canDistributorDispatch =
                role === "distributor" &&
                onDispatch &&
                !isRecalledOrSuspicious &&
                !isBatchInTransit &&
                isHeldByDistributor;

              const showDispatchBtn = canManufacturerDispatch || canDistributorDispatch;

              // 3. Dispense Button:
              // Pharmacy only, when physically holding in dispensary (not in transit, not dispensed)
              const canPharmacyDispense =
                role === "pharmacy" &&
                onDispense &&
                !isRecalledOrSuspicious &&
                !isBatchInTransit &&
                isHeldByPharmacy &&
                stageLower !== "dispensed";

              const showDispenseBtn = canPharmacyDispense;

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
                        {showReceiveBtn && (
                          <button
                            className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors border border-emerald-200"
                            title="Accept incoming custody"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReceive(b);
                            }}
                          >
                            Receive
                          </button>
                        )}
                        {showDispatchBtn && (
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
                        {showDispenseBtn && (
                          <button
                            className="px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                            title="Dispense to patient"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDispense(b);
                            }}
                          >
                            Dispense
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
