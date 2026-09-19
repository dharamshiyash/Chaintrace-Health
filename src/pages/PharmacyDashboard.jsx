import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listBatches } from "../lib/api.js";
import { motion, AnimatePresence } from "framer-motion";
import { X, Handshake, Prescription, Camera, ArrowRight, Link as LinkIcon, CheckCircle, WarningCircle, Pill, Package, Warning, Stethoscope, QrCode } from "@phosphor-icons/react";
import BatchTable from "../components/BatchTable.jsx";
import QRScanner from "../components/QRScanner.jsx";
import ProfileQRModal from "../components/ProfileQRModal.jsx";

function Toast({ msg, type, onDismiss }) {
  if (!msg) return null;
  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, x: 50, scale: 0.9 }} 
        animate={{ opacity: 1, x: 0, scale: 1 }} 
        exit={{ opacity: 0, x: 50, scale: 0.9 }}
        className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-lg flex items-start gap-4 z-[9999] max-w-sm border ${
          type === 'success' ? 'bg-white border-status-active/20 text-slate-800' :
          'bg-white border-status-recalled/20 text-slate-800'
        }`}
      >
        <div className={`mt-0.5 rounded-full p-1 ${type === 'success' ? 'bg-status-active/10 text-status-active' : 'bg-status-recalled/10 text-status-recalled'}`}>
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
  const [receiveForm, setReceiveForm] = useState({ batchId: "", location: "" });
  const [dispenseForm, setDispenseForm] = useState({ batchId: "", location: "" });
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [scanningFor, setScanningFor] = useState(null);
  const [isProfileQrOpen, setIsProfileQrOpen] = useState(false);
  const qc = useQueryClient();

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
    queryKey: ["batches"],
    queryFn: () => listBatches(),
  });

  const activeBatches = batches?.filter(b => b.status === "Active" || b.stage === "Delivered") || [];
  const compromisedBatches = batches?.filter(b => b.status === "Suspicious" || b.status === "Recalled") || [];
  const expiringCount = batches ? batches.filter(b => b.isLate).length : 0;

  async function handleReceive(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 700));
      showToast(`Custody of ${receiveForm.batchId} accepted at ${receiveForm.location}.`, "success");
      setReceiveForm({ batchId: "", location: "" });
      qc.invalidateQueries({ queryKey: ["batches"] });
    } catch (err) {
      showToast(err.message || "Failed to accept custody.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDispense(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 700));
      showToast(`Batch ${dispenseForm.batchId} dispensed to patient. Journey complete.`, "success");
      setDispenseForm({ batchId: "", location: "" });
      qc.invalidateQueries({ queryKey: ["batches"] });
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
              <Stethoscope size={14} weight="fill" /> Healthcare Provider
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-2">Pharmacy Terminal</h1>
            <p className="text-slate-500 font-medium text-lg">Manage patient dispensation, verify stock authenticity, and update inventory.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsProfileQrOpen(true)}
              className="px-4 py-2 border border-slate-200 hover:border-emerald-400 rounded-xl bg-white shadow-sm text-sm font-mono text-slate-700 flex items-center gap-2 transition-all hover:bg-slate-50 cursor-pointer"
              title="Click to view and share Pharmacy Node Profile QR"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              0x9fC...2a1
              <QrCode size={16} className="text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          
          {compromisedBatches.length > 0 && (
            <motion.div className="bg-red-50 rounded-3xl p-0 overflow-hidden border border-red-200 shadow-sm">
              <div className="px-6 py-5 border-b border-red-200 flex justify-between items-center bg-white/50">
                <h2 className="text-base font-serif font-bold text-red-900 flex items-center gap-2">
                  <WarningCircle weight="fill" size={24} className="text-red-600" /> Do Not Dispense - Suspicious Batches
                </h2>
              </div>
              <BatchTable 
                batches={compromisedBatches} 
                loading={isLoading} 
                error={isError ? (error?.message || "Failed to load batches") : null}
                onRetry={() => refetch()}
              />
            </motion.div>
          )}

          {/* Pharmacy KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div 
              className="bg-emerald-600 p-6 rounded-3xl border border-emerald-700 shadow-md flex flex-col justify-between h-40 text-white relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => document.getElementById('action-center')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <Prescription size={120} weight="fill" />
              </div>
              <div className="flex justify-between items-start relative z-10">
                <div className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest">Total Dispensed</div>
                <div className="p-2 bg-white/10 text-white rounded-lg"><Prescription size={20} weight="duotone" /></div>
              </div>
              <div className="relative z-10">
                <div className="text-4xl font-bold font-serif">{batches ? batches.filter(b => b.stage === "Delivered" || b.status === "Delivered").length : 0}</div>
                <div className="text-xs font-medium text-emerald-200 mt-1">Successfully delivered to patients</div>
              </div>
            </div>

            <div 
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-40 cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => document.getElementById('ledger-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified Stock</div>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Package size={20} weight="duotone" /></div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 font-serif">{activeBatches.length}</div>
                <div className="text-xs font-medium text-slate-500 mt-1">Authentic units on-hand</div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upcoming Expiries</div>
                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Warning size={20} weight="duotone" /></div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 font-serif">{expiringCount}</div>
                <div className="text-xs font-medium text-orange-600 mt-1">Expiring within 180 days</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daily Demand Rate <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-normal">Demo</span></div>
                <div className="p-2 bg-slate-50 text-slate-600 rounded-lg"><Pill size={20} weight="duotone" /></div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 font-serif">18%</div>
                <div className="text-xs font-medium text-slate-500 mt-1">Steady stock depletion</div>
              </div>
            </div>
          </div>

          {/* Action Center Row - POS Style */}
          <div id="action-center" className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
            
            {/* Dispense to Patient (Primary Focus) */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Prescription size={140} weight="fill" />
              </div>
              <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600">
                  <Prescription size={32} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-bold text-slate-900">Patient Dispensation</h2>
                  <p className="text-sm font-medium text-slate-500">Log medicine delivery to end consumer.</p>
                </div>
              </div>
              <form onSubmit={handleDispense} className="flex flex-col gap-5 relative z-10">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-3">Scan Medicine Batch QR</label>
                  <div className="flex gap-2">
                    <input className="flex-1 px-5 py-4 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-lg" placeholder="BATCH-MED-..." value={dispenseForm.batchId} onChange={e => setDispenseForm(f => ({ ...f, batchId: e.target.value }))} required />
                    <button type="button" className="px-6 border border-slate-200 bg-white hover:bg-emerald-50 rounded-xl transition-colors text-slate-600 hover:text-emerald-600" onClick={() => setScanningFor("dispense")}>
                      <Camera weight="duotone" size={28} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Dispensing Facility</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="e.g. City General Hospital" value={dispenseForm.location} onChange={e => setDispenseForm(f => ({ ...f, location: e.target.value }))} required />
                </div>
                <button type="submit" className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-5 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 text-lg" disabled={submitting}>
                  Complete Journey & Dispense
                </button>
              </form>
            </div>

            {/* Receive Shipment */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700">
                  <Package size={32} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-bold text-slate-900">Inventory Intake</h2>
                  <p className="text-sm font-medium text-slate-500">Scan incoming shipments from distributors.</p>
                </div>
              </div>
              <form onSubmit={handleReceive} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Shipment Batch ID</label>
                  <div className="flex gap-2">
                    <input className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="Enter or scan ID" value={receiveForm.batchId} onChange={e => setReceiveForm(f => ({ ...f, batchId: e.target.value }))} required />
                    <button type="button" className="px-5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-colors text-slate-600" onClick={() => setScanningFor("receive")}>
                      <Camera weight="duotone" size={24} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Receiving Dock / Pharmacy Location</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="e.g. Storage Bay A" value={receiveForm.location} onChange={e => setReceiveForm(f => ({ ...f, location: e.target.value }))} required />
                </div>
                <button type="submit" className="mt-4 bg-slate-900 hover:bg-black text-white px-6 py-4 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2" disabled={submitting}>
                  Verify Authenticity & Accept <ArrowRight size={18} />
                </button>
              </form>
            </div>
            
          </div>

          <motion.div id="ledger-section" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-4">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-serif font-bold text-slate-900">Local Verified Stock</h2>
              <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                {activeBatches ? `${activeBatches.length} Available` : "Syncing..."}
              </span>
            </div>
            <BatchTable 
              batches={activeBatches} 
              loading={isLoading} 
              error={isError ? (error?.message || "Failed to load batches") : null}
              onRetry={() => refetch()}
            />
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
        roleName="Authorized Healthcare / Pharmacy Node"
        address="0x9fC97E4A860F5F6873523f03b51e50882eFF12a1"
        roleType="pharmacy"
      />
    </main>
  );
}
