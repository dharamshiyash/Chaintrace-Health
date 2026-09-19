import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { verifyBatch } from "../lib/api.js";
import { formatDate, truncateAddress, formatDateTime } from "../lib/utils.js";
import { motion, AnimatePresence } from "framer-motion";
import { MagnifyingGlass, Warning, Camera, ShieldCheck, SealCheck, HardDrives, ArrowRight, CheckCircle, Thermometer, Drop, MapPin, Cube, Cpu, Fingerprint } from "@phosphor-icons/react";
import StatusBadge from "../components/StatusBadge.jsx";
import DivergenceAlert from "../components/DivergenceAlert.jsx";
import EventTimeline from "../components/EventTimeline.jsx";
import QRScanner from "../components/QRScanner.jsx";

/* ── Skeleton ────────────────────────────────────────────────────────────── */
function VerifySkeleton() {
  return (
    <div className="animate-pulse bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-100 max-w-6xl mx-auto mt-8">
      <div className="h-20 w-full bg-slate-50 rounded-2xl mb-12" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="col-span-2">
          <div className="h-6 w-32 bg-slate-100 mb-6 rounded" />
          <div className="h-12 w-80 bg-slate-100 mb-8 rounded" />
          <div className="h-48 w-full bg-slate-50 rounded-2xl" />
        </div>
        <div className="col-span-1">
          <div className="h-64 w-full bg-slate-50 rounded-2xl" />
        </div>
      </div>
      <div className="h-64 w-full bg-slate-50 rounded-2xl" />
    </div>
  );
}

/* ── Error Banner ────────────────────────────────────────────────────────── */
function VerifyError({ message, batchId }) {
  const isNotFound  = message?.toLowerCase().includes("not found");
  const isNetwork   = message?.toLowerCase().includes("failed to fetch") || message?.toLowerCase().includes("502") || message?.toLowerCase().includes("network");

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center max-w-2xl mx-auto mt-12 bg-white rounded-3xl shadow-sm border border-slate-100">
      <div className="p-6 bg-red-50 rounded-full text-red-500 mb-6 ring-1 ring-red-100">
        {isNotFound ? <MagnifyingGlass size={48} weight="duotone" /> : <Warning size={48} weight="duotone" />}
      </div>
      <h3 className="text-3xl font-serif text-slate-900 mb-4">
        {isNotFound ? "Batch Not Found" : isNetwork ? "Connection Error" : "Verification Error"}
      </h3>
      <p className="text-slate-500 max-w-md mb-10 text-lg">
        {isNotFound
          ? `No cryptographic record of "${batchId}" exists on the ledger. Please double-check the ID.`
          : isNetwork
          ? "Could not reach the blockchain node. Make sure the local Hardhat node is running."
          : message || "An unexpected error occurred during verification."}
      </p>
      <div className="flex gap-4">
        <Link to="/" className="btn btn-outline px-8 py-3">Return Home</Link>
        <button className="btn btn-primary px-8 py-3" onClick={() => window.location.reload()}>Retry Connection</button>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function Verify() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isVerifyingHash, setIsVerifyingHash] = useState(true);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["verify", batchId],
    queryFn: () => verifyBatch(batchId),
    enabled: !!batchId,
    retry: 1,
  });

  useEffect(() => {
    if (data) {
      setIsVerifyingHash(true);
      const timer = setTimeout(() => setIsVerifyingHash(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [data]);

  return (
    <main className="bg-[#F1F1ED] min-h-[calc(100vh-64px)] pb-24 font-sans text-slate-800">
      
      <div className="relative pt-20 px-6">
        {!batchId && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-slate-600 text-xs font-bold uppercase tracking-widest mb-8 border border-slate-200 shadow-sm">
              <SealCheck size={16} weight="fill" className="text-primary-600" /> Public Ledger Explorer
            </div>
            <h1 className="text-5xl md:text-6xl font-serif text-slate-900 mb-6 tracking-tight">
              Verify Authenticity
            </h1>
            <p className="text-slate-500 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
              Cryptographically verify the origin, transit conditions, and complete supply chain history of any registered medicine batch.
            </p>
            
            <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-200 flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
              <input 
                className="flex-1 px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder:text-slate-400 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all" 
                placeholder="Enter Batch ID (e.g. BATCH-MED-2024-...)" 
                value={searchId} 
                onChange={e => setSearchId(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && searchId.trim() && navigate(`/verify/${searchId.trim()}`)}
              />
              <div className="flex gap-2">
                <button 
                  type="button" 
                  className="px-6 py-4 text-slate-600 hover:text-primary-600 bg-slate-50 hover:bg-primary-50 border border-slate-100 hover:border-primary-100 rounded-xl transition-all flex items-center justify-center group"
                  onClick={() => setIsScanning(true)}
                  title="Scan QR Code"
                >
                  <Camera weight="duotone" size={24} className="group-hover:scale-110 transition-transform" />
                </button>
                <button 
                  type="button" 
                  className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 text-lg"
                  onClick={() => searchId.trim() && navigate(`/verify/${searchId.trim()}`)}
                  disabled={!searchId.trim()}
                >
                  Verify <ArrowRight size={20} />
                </button>
              </div>
            </div>

            <div className="mt-20 border-t border-slate-200 pt-10">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Sample Ledger Entries</p>
              <div className="flex flex-wrap gap-4 justify-center">
                {["BATCH-MED-2024-001","BATCH-MED-2024-002","BATCH-MED-2024-003"].map(id => (
                  <Link key={id} to={`/verify/${id}`} className="px-5 py-2.5 bg-white border border-slate-200 hover:border-primary-300 hover:shadow-sm text-slate-600 hover:text-primary-700 rounded-xl font-mono text-sm transition-all">
                    {id}
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {batchId && isLoading && <VerifySkeleton />}
        {batchId && isError && <VerifyError message={error?.message} batchId={batchId} />}

        {batchId && data && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto"
          >
            {/* Header / Certificate Banner */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/50 text-slate-600 text-xs font-bold uppercase tracking-widest mb-4">
                  Ledger Record
                </div>
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 tracking-tight mb-2">{data.metadata.medicineName}</h1>
                <p className="font-mono text-slate-500 text-lg">{data.metadata.batchId}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Verified On</p>
                <p className="font-mono text-sm text-slate-700">{formatDateTime(new Date().toISOString())}</p>
              </div>
            </div>

            {/* Cryptographic Seal Status Card */}
            {(() => {
              const status = data.metadata.status;
              const isSuspicious = status === "Suspicious";
              const isRecalled = status === "Recalled";
              const isExpired = status === "Expired";
              const isActive = status === "Active";

              const cardBg = isVerifyingHash 
                ? "bg-white border-slate-200" 
                : isActive 
                ? "bg-[#F3FAF7] border-[#A7F3D0]" 
                : isSuspicious 
                ? "bg-[#FFFBEB] border-[#FDE68A]" 
                : isRecalled 
                ? "bg-red-50 border-red-200" 
                : "bg-orange-50 border-orange-200";

              const iconBoxBg = isVerifyingHash 
                ? "bg-slate-100 text-slate-400" 
                : isActive 
                ? "bg-white text-[#059669] shadow-sm border border-[#A7F3D0]" 
                : isSuspicious 
                ? "bg-white text-amber-600 shadow-sm border border-[#FDE68A]" 
                : isRecalled 
                ? "bg-white text-red-600 shadow-sm border border-red-200" 
                : "bg-white text-orange-600 shadow-sm border border-orange-200";

              const titleColor = isVerifyingHash 
                ? "text-slate-800" 
                : isActive 
                ? "text-[#065F46]" 
                : isSuspicious 
                ? "text-[#92400E]" 
                : isRecalled 
                ? "text-red-900" 
                : "text-orange-900";

              const subtitleColor = isVerifyingHash 
                ? "text-slate-500" 
                : isActive 
                ? "text-[#059669]" 
                : isSuspicious 
                ? "text-[#B45309]" 
                : isRecalled 
                ? "text-red-700" 
                : "text-orange-700";

              const title = isVerifyingHash 
                ? "Computing Cryptographic Proofs..." 
                : isActive 
                ? "Certificate of Authenticity" 
                : isSuspicious 
                ? "Warning: Supply Chain Divergence Detected" 
                : isRecalled 
                ? "Official Batch Recall Notice" 
                : "Batch Expired Notice";

              const subtitle = isVerifyingHash 
                ? "Syncing with Polygon Amoy network state..." 
                : isActive 
                ? "This medicine batch is cryptographically verified, untampered, and authentic." 
                : isSuspicious 
                ? "An unauthorized custodian was detected in the supply chain. Authenticity cannot be guaranteed." 
                : isRecalled 
                ? "This medicine batch has been officially recalled by the manufacturer. Do not dispense or consume." 
                : "This medicine batch has passed its expiration date. Do not dispense or consume.";

              return (
                <div className={`mb-8 p-6 md:p-10 rounded-3xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 transition-colors duration-700 ${cardBg}`}>
                  <div className="flex items-center gap-6">
                    <div className={`relative flex items-center justify-center w-20 h-20 rounded-2xl ${iconBoxBg}`}>
                      {isVerifyingHash ? (
                        <HardDrives size={40} className="animate-pulse" />
                      ) : isActive ? (
                        <SealCheck size={48} weight="fill" />
                      ) : (
                        <Warning size={40} weight="fill" />
                      )}
                       
                      {!isVerifyingHash && isActive && (
                        <div className="absolute inset-0 rounded-2xl border border-[#059669] animate-[spin_8s_linear_infinite] opacity-20" style={{ borderStyle: 'dashed' }} />
                      )}
                    </div>
                    <div>
                      <h2 className={`text-2xl md:text-3xl font-serif font-bold mb-2 ${titleColor}`}>
                        {title}
                      </h2>
                      <p className={`text-base ${subtitleColor}`}>
                        {subtitle}
                      </p>
                    </div>
                  </div>
                  
                  {!isVerifyingHash && (
                    <div className="flex-shrink-0 text-left lg:text-right w-full lg:w-auto">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Contract Address</p>
                      <p className="font-mono text-xs opacity-90 mb-3">{truncateAddress(data.contractAddress || "0x3E8bBd12a1A614d131Fc227106D2697Df1C0C072")}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Genesis Block</p>
                      <p className="font-mono text-xs opacity-90">#3849201</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Divergence Alert & Recalls */}
            {!isVerifyingHash && data.metadata.status === "Suspicious" && data.divergence && (
              <div className="mb-8">
                <DivergenceAlert divergence={data.divergence} />
              </div>
            )}
            
            {!isVerifyingHash && data.metadata.status === "Recalled" && data.metadata.recallReason && (
              <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-3xl shadow-sm flex gap-5 items-start">
                <Warning className="text-red-600 mt-1 flex-shrink-0" size={32} weight="fill" />
                <div>
                  <h3 className="text-xl font-bold text-red-900 mb-2 font-serif">Official Recall Notice</h3>
                  <p className="text-red-800 text-lg leading-relaxed">{data.metadata.recallReason}</p>
                </div>
              </div>
            )}

            {/* Data Grid Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              
              {/* Left Column: Specs & Transit */}
              <div className="lg:col-span-2 flex flex-col gap-8">
                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <h3 className="text-xl font-serif font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Cube className="text-primary-600" size={24} weight="duotone" /> Batch Specifications
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-1">Quantity</label>
                      <span className="block text-xl font-medium text-slate-900">{Number(data.metadata.quantity).toLocaleString()} <span className="text-sm text-slate-500">units</span></span>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-1">Manufactured</label>
                      <span className="block text-lg font-medium text-slate-900">{formatDate(data.metadata.manufacturingDate)}</span>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-1">Expiry Date</label>
                      <span className="block text-lg font-medium text-slate-900">{formatDate(data.metadata.expiryDate)}</span>
                    </div>
                    <div className="col-span-2 md:col-span-3 pt-4 border-t border-slate-100">
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-1">Origin Node Address (Manufacturer)</label>
                      <span className="block font-mono text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {data.metadata.manufacturer}
                      </span>
                    </div>
                  </div>
                </div>

                {/* IoT / Transit Conditions Mock */}
                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
                      <Thermometer className="text-primary-600" size={24} weight="duotone" /> Transit Conditions
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                      Simulated IoT Telemetry (Demo)
                    </span>
                  </div>
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center gap-4">
                      <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                        <Thermometer size={24} weight="fill" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Average Temp</p>
                        <p className="text-2xl font-bold text-slate-900">4.2°C <span className="text-sm font-normal text-slate-500">/ 2-8°C limit</span></p>
                      </div>
                    </div>
                    <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center gap-4">
                      <div className="p-3 bg-cyan-100 text-cyan-600 rounded-xl">
                        <Drop size={24} weight="fill" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Avg Humidity</p>
                        <p className="text-2xl font-bold text-slate-900">45% <span className="text-sm font-normal text-slate-500">Optimal</span></p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 flex items-center gap-1"><CheckCircle size={14} /> Conditions remained within safe parameters throughout the entire journey.</p>
                </div>
              </div>

              {/* Right Column: Diagnostics */}
              <div className="lg:col-span-1">
                <div className="bg-slate-900 text-slate-300 rounded-3xl p-8 shadow-lg h-full">
                  <h3 className="text-xl font-serif font-bold text-white mb-8 flex items-center gap-2">
                    <Cpu className="text-primary-400" size={24} weight="duotone" /> Smart Contract Diagnostics
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Network</label>
                      <span className="block font-medium text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400"></span> Polygon Amoy Testnet
                      </span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Cryptographic Hash Function</label>
                      <span className="block font-mono text-sm text-slate-400">Keccak-256 (SHA-3)</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Total Confirmations</label>
                      <span className="block font-mono text-sm text-slate-400">{data.history.length * 128}+</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Gas Efficiency</label>
                      <span className="block font-mono text-sm text-slate-400">Optimal (0.001 MATIC/tx)</span>
                    </div>
                  </div>

                  <div className="mt-10 p-5 bg-white/5 border border-white/10 rounded-2xl">
                    <Fingerprint size={32} weight="duotone" className="text-primary-400 mb-3" />
                    <p className="text-xs text-slate-400 leading-relaxed">
                      This record is mathematically immutable. It cannot be altered, deleted, or forged by any single party.
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Timeline */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3">
                <MapPin className="text-primary-600" size={24} weight="duotone" />
                <h2 className="text-2xl font-serif font-bold text-slate-900">Geographical Route & Ledger Events</h2>
              </div>
              <div className="p-4 md:p-8">
                <EventTimeline history={data.history} />
              </div>
            </div>

          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {isScanning && (
          <QRScanner 
            onScan={(scannedId) => {
              setIsScanning(false);
              navigate(`/verify/${scannedId}`);
            }}
            onClose={() => setIsScanning(false)}
          />
        )}
      </AnimatePresence>

    </main>
  );
}
