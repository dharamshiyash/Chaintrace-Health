import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listBatches, receiveBatchApi, dispenseBatchApi } from "../lib/api.js";
import { motion, AnimatePresence } from "framer-motion";
import { X, Handshake, Prescription, Camera, ArrowRight, Link as LinkIcon, CheckCircle, WarningCircle, Pill, Package, Warning, Stethoscope, QrCode } from "@phosphor-icons/react";
import BatchTable from "../components/BatchTable.jsx";
import QRScanner from "../components/QRScanner.jsx";
import ProfileQRModal from "../components/ProfileQRModal.jsx";
import { truncateAddress } from "../lib/utils.js";

const PHARMACY_NODES = [
  { id: "pharmacy-1", name: "Apollo Pharmacy Delhi (Healthcare Provider 1)", address: "0x4e1E0cb18AE2f56F466513c67969cA4E864dF0F3" },
  { id: "pharmacy-2", name: "MedPlus Retail Healthcare (Healthcare Provider 2 - Fresh Node)", address: "0x9fC97E4A860F5F6873523f03b51e50882eFF12a1" },
];

function Toast({ msg, type, onDismiss }) {
  if (!msg) return null;
  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, x: 50, scale: 0.9 }} 
        animate={{ opacity: 1, x: 0, scale: 1 }} 
        exit={{ opacity: 0, x: 50, scale: 0.9 }}
        className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-lg flex items-start gap-4 z-[9999] max-w-sm border ${
          type === 'success' ? 'bg-white border-emerald-200 text-slate-800' :
          'bg-white border-red-200 text-slate-800'
        }`}
      >
        <div className={`mt-0.5 rounded-full p-1 ${type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
          {type === 'success' ? <CheckCircle size={16} weight="fill" /> : <WarningCircle size={16} weight="fill" />}
        </div>
        <span className="text-sm font-medium pt-0.5">{msg}</span>
        <button onClick={onDismiss} className="mt-0.5 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={16} weight="bold" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

export default function PharmacyDashboard() {
  const [selectedNodeIndex, setSelectedNodeIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("All");
  const [receiveForm, setReceiveForm] = useState({ batchId: "", location: "" });
  const [dispenseForm, setDispenseForm] = useState({ batchId: "", location: "" });
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [scanningFor, setScanningFor] = useState(null);
  const [isProfileQrOpen, setIsProfileQrOpen] = useState(false);
  const qc = useQueryClient();

  const activeNode = PHARMACY_NODES[selectedNodeIndex];
  const pharmacyAddress = activeNode.address.toLowerCase();

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const { 
    data: batches, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ["batches", "pharmacy", pharmacyAddress],
    queryFn: () => listBatches({}, { role: "pharmacy", address: pharmacyAddress, orgName: activeNode.name }),
  });

  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    if (activeTab === "All") return batches.filter(b => !b.isException);
    if (activeTab === "Fresh") return batches.filter(b => b.isFresh);
    if (activeTab === "In-Transit") return batches.filter(b => b.isInTransit);
    if (activeTab === "Late") return batches.filter(b => b.isLate);
    if (activeTab === "Exceptions") return batches.filter(b => b.isException);
    return batches;
  }, [batches, activeTab]);

  const compromisedBatches = useMemo(() => {
    if (!batches) return [];
    return batches.filter(b => b.isException || b.status === "Suspicious" || b.status === "Recalled");
  }, [batches]);

  const counts = useMemo(() => {
    if (batches?.counts) return batches.counts;
    const all = batches?.length || 0;
    const fresh = batches?.filter(b => b.isFresh).length || 0;
    const inTransit = batches?.filter(b => b.isInTransit).length || 0;
    const late = batches?.filter(b => b.isLate).length || 0;
    const exceptions = batches?.filter(b => b.isException).length || 0;
    const activeStock = batches?.filter(b => (b.view_status === "Active" || b.view_status === "Available") && !b.isException).length || 0;
    return { all, fresh, inTransit, late, exceptions, activeStock };
  }, [batches]);

  async function handleReceive(e) {
    e.preventDefault();
    if (!receiveForm.batchId.trim()) return;
    setSubmitting(true);
    try {
      await receiveBatchApi({
        batchId: receiveForm.batchId.trim(),
        location: receiveForm.location.trim() || "Retail Dispensary Stock",
        actor: pharmacyAddress,
        role: "Pharmacy",
      });
      showToast(`Custody of ${receiveForm.batchId.trim()} accepted into pharmacy dispensary.`, "success");
      setReceiveForm({ batchId: "", location: "" });
      await qc.invalidateQueries({ queryKey: ["batches"] });
      await qc.refetchQueries({ queryKey: ["batches"] });
    } catch (err) {
      showToast(err.message || "Failed to accept custody.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDispense(e) {
    e.preventDefault();
    if (!dispenseForm.batchId.trim()) return;
    setSubmitting(true);
    try {
      await dispenseBatchApi({
        batchId: dispenseForm.batchId.trim(),
        location: dispenseForm.location.trim() || "Prescription Dispensary Counter",
        actor: pharmacyAddress,
        role: "Pharmacy",
      });
      showToast(`Batch ${dispenseForm.batchId.trim()} dispensed to patient. Journey complete.`, "success");
      setDispenseForm({ batchId: "", location: "" });
      await qc.invalidateQueries({ queryKey: ["batches"] });
      await qc.refetchQueries({ queryKey: ["batches"] });
    } catch (err) {
      showToast(err.message || "Dispense failed.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="bg-[#F1F1ED] min-h-[calc(100vh-64px)] pb-24 font-sans text-slate-800">
      <Toast msg={toast?.msg} type={toast?.type} onDismiss={() => setToast(null)} />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ staggerChildren: 0.1, duration: 0.4 }}
        className="container mx-auto px-6 py-10 max-w-[1400px]"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-slate-200 pb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-200">
              <Stethoscope size={14} weight="fill" /> Healthcare Provider Terminal
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-2">Pharmacy Terminal</h1>
            <p className="text-slate-500 font-medium text-lg">Manage patient dispensation, verify stock authenticity, and maintain strictly scoped inventory.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Pharmacy Node Switcher for Empty Inventory & Cross-Org Testing */}
            <select
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-700 shadow-sm focus:outline-none focus:border-emerald-400"
              value={selectedNodeIndex}
              onChange={(e) => setSelectedNodeIndex(Number(e.target.value))}
              title="Switch Pharmacy Node to verify Empty-Inventory and Scoping behavior"
            >
              {PHARMACY_NODES.map((n, i) => (
                <option key={n.id} value={i}>{n.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsProfileQrOpen(true)}
              className="px-4 py-2 border border-slate-200 hover:border-emerald-400 rounded-xl bg-white shadow-sm text-sm font-mono text-slate-700 flex items-center justify-center gap-2 transition-all hover:bg-slate-50 cursor-pointer"
              title="Click to view and share Pharmacy Node Profile QR"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {truncateAddress(pharmacyAddress, 6, 4)}
              <QrCode size={16} className="text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          
          {/* Quarantined / Do Not Dispense Banner */}
          {compromisedBatches.length > 0 && (
            <motion.div className="bg-red-50/80 rounded-3xl p-0 overflow-hidden border border-red-200 shadow-sm">
              <div className="px-6 py-5 border-b border-red-200 flex justify-between items-center bg-red-100/50">
                <h2 className="text-base font-serif font-bold text-red-950 flex items-center gap-2">
                  <WarningCircle weight="fill" size={24} className="text-red-600" /> Do Not Dispense — Quarantined / Recalled Batches
                </h2>
                <span className="px-2.5 py-1 rounded-full bg-red-200 text-red-800 text-xs font-bold">
                  {compromisedBatches.length} Compromised
                </span>
              </div>
              <BatchTable 
                batches={compromisedBatches} 
                loading={isLoading} 
                error={isError ? (error?.message || "Failed to load batches") : null}
                onRetry={() => refetch()}
                showActions={true}
              />
            </motion.div>
          )}

          {/* KPI Row with dynamic scoped counts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Available Stock</div>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Pill size={20} weight="duotone" /></div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 font-serif">{counts.activeStock}</div>
                <div className="text-xs font-medium text-emerald-600 mt-1">Verified units on shelf</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Incoming Deliveries</div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Package size={20} weight="duotone" /></div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 font-serif">{counts.inTransit}</div>
                <div className="text-xs font-medium text-blue-600 mt-1">En-route from distributors</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expiring Soon</div>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Warning size={20} weight="duotone" /></div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 font-serif">{counts.late}</div>
                <div className="text-xs font-medium text-amber-600 mt-1">Nearing shelf-life limit</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quarantined</div>
                <div className="p-2 bg-red-50 text-red-600 rounded-lg"><WarningCircle size={20} weight="duotone" /></div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 font-serif">{counts.exceptions}</div>
                <div className="text-xs font-medium text-red-600 mt-1">Recalled or suspicious</div>
              </div>
            </div>
          </div>

          {/* Action Center Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-2">
            
            {/* Accept Delivery */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600">
                  <Handshake size={32} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-bold text-slate-900">Accept Retail Delivery</h2>
                  <p className="text-sm font-medium text-slate-500">Scan incoming medicine batches from certified distributors.</p>
                </div>
              </div>
              <form onSubmit={handleReceive} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Batch Identification</label>
                  <div className="flex gap-2">
                    <input className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm" placeholder="Enter or scan Batch ID" value={receiveForm.batchId} onChange={e => setReceiveForm(f => ({ ...f, batchId: e.target.value }))} required />
                    <button type="button" className="px-5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-colors text-slate-600" onClick={() => setScanningFor("receive")}>
                      <Camera weight="duotone" size={24} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Pharmacy Storage Facility</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm" placeholder="e.g. Dispensary Room Shelf B" value={receiveForm.location} onChange={e => setReceiveForm(f => ({ ...f, location: e.target.value }))} required />
                </div>
                <button type="submit" className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2" disabled={submitting}>
                  Verify & Log Handoff on Ledger
                </button>
              </form>
            </div>

            {/* Dispense to Patient */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700">
                  <Prescription size={32} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-bold text-slate-900">Dispense to Patient</h2>
                  <p className="text-sm font-medium text-slate-500">Record final sale to patient, concluding the supply chain journey.</p>
                </div>
              </div>
              <form onSubmit={handleDispense} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Batch Identification</label>
                  <div className="flex gap-2">
                    <input className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm" placeholder="Enter or scan Batch ID" value={dispenseForm.batchId} onChange={e => setDispenseForm(f => ({ ...f, batchId: e.target.value }))} required />
                    <button type="button" className="px-5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-colors text-slate-600" onClick={() => setScanningFor("dispense")}>
                      <Camera weight="duotone" size={24} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Prescription Counter / Store</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm" placeholder="e.g. Apollo Retail Counter #1" value={dispenseForm.location} onChange={e => setDispenseForm(f => ({ ...f, location: e.target.value }))} required />
                </div>
                <button type="submit" className="mt-2 bg-slate-900 hover:bg-black text-white px-6 py-4 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2" disabled={submitting}>
                  Complete Patient Dispensation <ArrowRight size={18} />
                </button>
              </form>
            </div>
          </div>

          {/* Main Pharmacy Ledger */}
          <motion.div id="ledger-section" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-2">
            <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-serif font-bold text-slate-900">Dispensary Stock Ledger</h2>
                <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                  {filteredBatches.length} Units Available
                </span>
              </div>

              {/* Dynamic Filter Buttons with Real Counts */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar">
                {[
                  { id: "All", count: counts.all },
                  { id: "Fresh", count: counts.fresh },
                  { id: "In-Transit", count: counts.inTransit },
                  { id: "Late", count: counts.late },
                  { id: "Exceptions", count: counts.exceptions },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-1.5 ${
                      activeTab === tab.id 
                        ? "bg-slate-900 border-slate-900 text-white shadow-md" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    <span>{tab.id}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {filteredBatches.length === 0 && !isLoading ? (
              <div className="py-16 text-center text-slate-500">
                <div className="text-4xl mb-3 opacity-80">🏥</div>
                <h3 className="text-lg font-medium text-slate-800 mb-1">No Dispensary Stock</h3>
                <p className="text-sm max-w-md mx-auto">
                  This pharmacy organization currently holds zero units. Batches dispatched to this node will appear here once intake is confirmed.
                </p>
              </div>
            ) : (
              <BatchTable 
                batches={filteredBatches} 
                loading={isLoading} 
                error={isError ? (error?.message || "Failed to load batches") : null}
                onRetry={() => refetch()}
              />
            )}
          </motion.div>
        </div>
      </motion.div>

      <AnimatePresence>
        {scanningFor && (
          <QRScanner 
            onScan={(scannedId) => {
              if (scanningFor === "receive") {
                setReceiveForm(f => ({ ...f, batchId: scannedId }));
              } else if (scanningFor === "dispense") {
                setDispenseForm(f => ({ ...f, batchId: scannedId }));
              }
              setScanningFor(null);
            }}
            onClose={() => setScanningFor(null)}
          />
        )}
      </AnimatePresence>

      <ProfileQRModal 
        isOpen={isProfileQrOpen}
        onClose={() => setIsProfileQrOpen(false)}
        roleName={activeNode.name}
        address={activeNode.address}
        roleType="pharmacy"
      />
    </main>
  );
}
