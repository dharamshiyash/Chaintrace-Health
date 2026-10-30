import { motion } from "framer-motion";
import { 
  Factory, 
  Truck, 
  Buildings, 
  Stethoscope, 
  Pill, 
  CheckCircle, 
  WarningCircle, 
  ArrowRight,
  ShieldCheck,
  MapPin,
  Clock,
  Compass
} from "@phosphor-icons/react";
import { formatDateTime, truncateAddress } from "../lib/utils.js";

export default function GeographicalRoute({ history = [], metadata = {}, divergence = null }) {
  const status = metadata?.status || "Active";
  const isRecalled = status === "Recalled";
  const isSuspicious = status === "Suspicious";

  // Determine which waypoints have been reached based on history events
  const hasGenesis = history.some(e => String(e.action || "").toUpperCase().includes("REGISTER") || true);
  
  const hasDispatchedToDistributor = history.some(e => {
    const act = String(e.action || "").toUpperCase();
    const role = String(e.role || "").toUpperCase();
    return act.includes("DISPATCH") && (act.includes("DISTRIBUTOR") || role.includes("MANUFACTURER"));
  });

  const hasReceivedAtDistributor = history.some(e => {
    const act = String(e.action || "").toUpperCase();
    const role = String(e.role || "").toUpperCase();
    return (act.includes("RECEIV") || act.includes("INTAKE")) && role.includes("DISTRIBUTOR");
  });

  const hasDispatchedToPharmacy = history.some(e => {
    const act = String(e.action || "").toUpperCase();
    const role = String(e.role || "").toUpperCase();
    return (act.includes("DISPATCH") && (act.includes("PHARMACY") || role.includes("DISTRIBUTOR"))) || act.includes("TRANSFER");
  });

  const hasReceivedAtPharmacy = history.some(e => {
    const act = String(e.action || "").toUpperCase();
    const role = String(e.role || "").toUpperCase();
    return (act.includes("RECEIV") || act.includes("INTAKE")) && role.includes("PHARMACY");
  });

  const hasDispensed = history.some(e => {
    const act = String(e.action || "").toUpperCase();
    return act.includes("DISPENS") || act.includes("PATIENT");
  });

  // Extract dynamic location names from events
  const genesisEvent = history.find(e => String(e.action || "").toUpperCase().includes("REGISTER")) || history[0];
  const distDispatchEvent = history.find(e => String(e.action || "").toUpperCase().includes("DISPATCHED_TO_DISTRIBUTOR") || (String(e.action || "").toUpperCase().includes("DISPATCH") && String(e.role || "").toUpperCase().includes("MANUFACTURER")));
  const distReceiveEvent = history.find(e => (String(e.action || "").toUpperCase().includes("RECEIV") || String(e.action || "").toUpperCase().includes("INTAKE")) && String(e.role || "").toUpperCase().includes("DISTRIBUTOR"));
  const pharmDispatchEvent = history.find(e => String(e.action || "").toUpperCase().includes("DISPATCHED_TO_PHARMACY") || String(e.action || "").toUpperCase().includes("TRANSFER"));
  const pharmReceiveEvent = history.find(e => (String(e.action || "").toUpperCase().includes("RECEIV") || String(e.action || "").toUpperCase().includes("INTAKE")) && String(e.role || "").toUpperCase().includes("PHARMACY"));
  const dispenseEvent = history.find(e => String(e.action || "").toUpperCase().includes("DISPENS"));

  // Waypoints definition
  const waypoints = [
    {
      id: "genesis",
      title: "Manufacturing Origin",
      subtitle: genesisEvent?.location || "Apex BioPharma Plant (Hyderabad)",
      org: genesisEvent?.orgName || "Origin Pharmaceutical Plant",
      actor: genesisEvent?.actor || metadata?.manufacturer,
      time: genesisEvent?.timestamp,
      icon: Factory,
      status: "completed", // Genesis is always completed once registered
      stageLabel: "Genesis Minted",
    },
    {
      id: "distributor",
      title: "Logistics Hub",
      subtitle: distReceiveEvent?.location || (distDispatchEvent?.location ? distDispatchEvent.location.replace("Dispatched from facility", "In Transit to Hub") : "Novartis Global Logistics (Hub 1)"),
      org: distReceiveEvent?.orgName || (distDispatchEvent?.destination_org || "Wholesale Logistics Terminal"),
      actor: distReceiveEvent?.actor || distDispatchEvent?.actor,
      time: distReceiveEvent?.timestamp || distDispatchEvent?.timestamp,
      icon: Buildings,
      status: hasReceivedAtDistributor || hasDispatchedToPharmacy
        ? "completed"
        : hasDispatchedToDistributor
        ? "in-transit"
        : "pending",
      stageLabel: hasReceivedAtDistributor || hasDispatchedToPharmacy
        ? "In Warehouse Custody"
        : hasDispatchedToDistributor
        ? "En Route to Hub"
        : "Pending Dispatch",
    },
    {
      id: "pharmacy",
      title: "Healthcare Provider",
      subtitle: pharmReceiveEvent?.location || (pharmDispatchEvent?.location ? pharmDispatchEvent.location.replace("Dispatched to Retail Pharmacy", "In Transit to Pharmacy") : "Apollo Pharmacy (Delhi)"),
      org: pharmReceiveEvent?.orgName || (pharmDispatchEvent?.destination_org || "Retail Pharmacy Partner"),
      actor: pharmReceiveEvent?.actor || pharmDispatchEvent?.actor,
      time: pharmReceiveEvent?.timestamp || pharmDispatchEvent?.timestamp,
      icon: Stethoscope,
      status: hasReceivedAtPharmacy || hasDispensed
        ? "completed"
        : hasDispatchedToPharmacy
        ? "in-transit"
        : "pending",
      stageLabel: hasReceivedAtPharmacy || hasDispensed
        ? "In Dispensary Stock"
        : hasDispatchedToPharmacy
        ? "En Route to Pharmacy"
        : "Pending Wholesale Delivery",
    },
    {
      id: "dispense",
      title: "Patient Dispensation",
      subtitle: dispenseEvent?.location || "Retail Dispensary Counter",
      org: "Patient Point-of-Care",
      actor: dispenseEvent?.actor,
      time: dispenseEvent?.timestamp,
      icon: Pill,
      status: hasDispensed
        ? "completed"
        : "pending",
      stageLabel: hasDispensed ? "Dispensed to Patient" : "Awaiting Prescription",
    },
  ];

  // Calculate overall route completion percentage
  let completedCount = 0;
  if (hasGenesis) completedCount++;
  if (hasReceivedAtDistributor || hasDispatchedToPharmacy) completedCount++;
  if (hasReceivedAtPharmacy || hasDispensed) completedCount++;
  if (hasDispensed) completedCount++;
  const completionPct = Math.round((completedCount / 4) * 100);

  // Current active stage label
  let activeStageText = "Genesis Registration";
  if (isRecalled) {
    activeStageText = "Official Batch Recall Issued";
  } else if (isSuspicious) {
    activeStageText = "Unauthorized Custody Divergence Flagged";
  } else if (hasDispensed) {
    activeStageText = "Journey Completed — Patient Dispensed";
  } else if (hasReceivedAtPharmacy) {
    activeStageText = "Stocked at Retail Healthcare Provider";
  } else if (hasDispatchedToPharmacy) {
    activeStageText = "In Transit: Logistics Hub → Retail Pharmacy";
  } else if (hasReceivedAtDistributor) {
    activeStageText = "Acquired at Wholesale Logistics Hub";
  } else if (hasDispatchedToDistributor) {
    activeStageText = "In Transit: Origin Plant → Logistics Hub";
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Route Status Summary Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl flex items-center justify-center ${
            isRecalled 
              ? "bg-red-100 text-red-700" 
              : isSuspicious 
              ? "bg-amber-100 text-amber-700" 
              : hasDispensed 
              ? "bg-emerald-100 text-emerald-700" 
              : "bg-blue-100 text-blue-700"
          }`}>
            <Compass size={24} weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Supply Chain Journey</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                isRecalled 
                  ? "bg-red-100 text-red-800" 
                  : isSuspicious 
                  ? "bg-amber-100 text-amber-800" 
                  : hasDispensed 
                  ? "bg-emerald-100 text-emerald-800" 
                  : "bg-blue-100 text-blue-800 animate-pulse"
              }`}>
                {activeStageText}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-800 mt-0.5">
              {waypoints[0].subtitle.split(",")[0]} → {waypoints[1].subtitle.split(",")[0]} → {waypoints[2].subtitle.split(",")[0]}
            </div>
          </div>
        </div>

        {/* Progress Metric */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Route Progress</span>
            <span className="text-lg font-serif font-bold text-slate-900">{completionPct}% Complete</span>
          </div>
          <div className="w-24 bg-slate-200 h-2.5 rounded-full overflow-hidden">
            <motion.div 
              className={`h-full ${
                isRecalled 
                  ? "bg-red-500" 
                  : isSuspicious 
                  ? "bg-amber-500" 
                  : "bg-primary-600"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${completionPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Stepper Flow Across Waypoints */}
      <div className="relative py-4 px-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-7 left-12 right-12 h-0.5 bg-slate-200 z-0">
            <motion.div 
              className={`h-full ${isRecalled ? "bg-red-500" : isSuspicious ? "bg-amber-500" : "bg-emerald-500"}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, (completedCount - 1) / 3 * 100)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>

          {waypoints.map((wp, idx) => {
            const Icon = wp.icon;
            const isCompleted = wp.status === "completed";
            const isInTransit = wp.status === "in-transit";
            const isPending = wp.status === "pending";

            let circleBg = "bg-slate-100 text-slate-400 border-slate-200";
            let pulseRing = false;

            if (isRecalled && idx === completedCount) {
              circleBg = "bg-red-500 text-white border-red-600 shadow-md";
            } else if (isSuspicious && idx === completedCount) {
              circleBg = "bg-amber-500 text-white border-amber-600 shadow-md";
            } else if (isCompleted) {
              circleBg = "bg-emerald-600 text-white border-emerald-700 shadow-sm";
            } else if (isInTransit) {
              circleBg = "bg-blue-600 text-white border-blue-700 shadow-md";
              pulseRing = true;
            }

            return (
              <div key={wp.id} className="relative z-10 flex flex-col md:items-center text-left md:text-center group">
                
                {/* Node Circle */}
                <div className="flex items-center gap-3 md:flex-col mb-3">
                  <div className="relative flex-shrink-0">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 ${circleBg}`}>
                      <Icon size={24} weight={isCompleted || isInTransit ? "fill" : "duotone"} />
                    </div>
                    {isCompleted && (
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow">
                        <CheckCircle size={16} weight="fill" className="text-emerald-600" />
                      </div>
                    )}
                    {pulseRing && (
                      <div className="absolute inset-0 rounded-2xl border-2 border-blue-400 animate-ping opacity-75 pointer-events-none" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block md:mt-2">
                      Stage 0{idx + 1}
                    </span>
                    <h4 className="text-sm font-serif font-bold text-slate-900">
                      {wp.title}
                    </h4>
                  </div>
                </div>

                {/* Subtitle & Org Details */}
                <div className="flex flex-col gap-1 pl-16 md:pl-0">
                  <p className="text-xs font-medium text-slate-700 line-clamp-2" title={wp.subtitle}>
                    {wp.subtitle}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate" title={wp.org}>
                    {wp.org}
                  </p>
                  
                  {/* Status Badge */}
                  <div className="mt-1">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      isCompleted 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                        : isInTransit 
                        ? "bg-blue-50 text-blue-700 border border-blue-200 animate-pulse" 
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {wp.stageLabel}
                    </span>
                  </div>

                  {wp.time && (
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {formatDateTime(wp.time)}
                    </span>
                  )}
                </div>

              </div>
            );
          })}

        </div>
      </div>

    </div>
  );
}
