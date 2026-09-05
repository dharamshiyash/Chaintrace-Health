import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listBatches } from "../lib/api.js";
import { motion, AnimatePresence } from "framer-motion";
import { X, Handshake, Truck, Camera, ArrowRight, Link as LinkIcon, CheckCircle, WarningCircle, Buildings, Warehouse, ArrowsClockwise, Storefront, Package } from "@phosphor-icons/react";
import BatchTable from "../components/BatchTable.jsx";
import QRScanner from "../components/QRScanner.jsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function Toast({ msg, type, onDismiss }) {
  if (!msg) return null;
  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, x: 50, scale: 0.9 }} 
        animate={{ opacity: 1, x: 0, scale: 1 }} 
        exit={{ opacity: 0, x: 50, scale: 0.9 }}
        className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-lg flex items-start gap-4 z-50 max-w-sm border ${
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

export default function DistributorDashboard() {
  const [receiveForm, setReceiveForm] = useState({ batchId: "", location: "" });
  const [transferForm, setTransferForm] = useState({ batchId: "", toAddress: "", location: "" });
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [scanningFor, setScanningFor] = useState(null);
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

  const activeBatches = batches?.filter(b => b.status === "Active" || b.stage === "In-Transit") || [];
  const compromisedBatches = batches?.filter(b => b.status === "Suspicious" || b.status === "Recalled") || [];

  const chartData = useMemo(() => {
    if (!batches) return [];
    const grouped = batches.reduce((acc, b) => {
      const date = new Date(b.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (!acc[date]) acc[date] = { name: date, Received: 0, Transferred: 0 };
      acc[date].Received += 1;
      if (b.stage === "Delivered") acc[date].Transferred += 1;
      return acc;
    }, {});
    return Object.values(grouped).reverse().slice(0, 7);
  }, [batches]);

  async function handleReceive(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 700));
      showToast(`Bulk intake of ${receiveForm.batchId} accepted at warehouse ${receiveForm.location}.`, "success");
      setReceiveForm({ batchId: "", location: "" });
      qc.invalidateQueries({ queryKey: ["batches"] });
    } catch (err) {
      showToast(err.message || "Failed to accept custody.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTransfer(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 700));
      showToast(`Batch ${transferForm.batchId} sold and dispatched to ${transferForm.toAddress.slice(0, 10)}…`, "success");
      setTransferForm({ batchId: "", toAddress: "", location: "" });
      qc.invalidateQueries({ queryKey: ["batches"] });
    } catch (err) {
      showToast(err.message || "Transfer failed.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="bg-[#F9F9F7] min-h-[calc(100vh-64px)] pb-24 font-sans text-slate-800">
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-4 border border-blue-200">
              <Buildings size={14} weight="fill" /> B2B Wholesale Hub
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-2">Wholesale Distributor</h1>
            <p className="text-slate-500 font-medium text-lg">Manage bulk inventory acquisition, warehouse storage, and redistribution to retail pharmacies.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex px-4 py-2 border border-slate-200 rounded-xl bg-white shadow-sm text-sm font-mono text-slate-700 items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              0x2Bd...7f3
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          
          {compromisedBatches.length > 0 && (
            <motion.div className="bg-red-50 rounded-3xl p-0 overflow-hidden border border-red-200 shadow-sm">
              <div className="px-6 py-5 border-b border-red-200 flex justify-between items-center bg-white/50">
                <h2 className="text-base font-serif font-bold text-red-900 flex items-center gap-2">
                  <WarningCircle weight="fill" size={24} className="text-red-600" /> Anomalies Detected in Bulk Supply
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

          {/* Logistics KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div 
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-40 cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => document.getElementById('ledger-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Warehouse Capacity <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-normal">Demo</span></div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Warehouse size={20} weight="duotone" /></div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 font-serif">82%</div>
                <div className="text-xs font-medium text-blue-600 mt-1">Nearing peak capacity</div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inventory Turnover <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-normal">Demo</span></div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><ArrowsClockwise size={20} weight="duotone" /></div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 font-serif">14 <span className="text-xl text-slate-500 font-sans">Days</span></div>
                <div className="text-xs font-medium text-emerald-600 mt-1">High efficiency stock flow</div>
              </div>
            </div>

            <div 
              className="bg-blue-600 p-6 rounded-3xl border border-blue-700 shadow-md flex flex-col justify-between h-40 text-white relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => document.getElementById('action-center')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="absolute -right-4 -top-4 opacity-10">
                <Handshake size={120} weight="fill" />
              </div>
              <div className="flex justify-between items-start relative z-10">
                <div className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Pending Bulk Sales</div>
                <div className="p-2 bg-white/10 text-white rounded-lg"><Package size={20} weight="duotone" /></div>
              </div>
              <div className="relative z-10">
                <div className="text-3xl font-bold font-serif">{activeBatches.length}</div>
                <div className="text-xs font-medium text-blue-200 mt-1">Awaiting dispatch signature</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Retail Partners <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-normal">Demo</span></div>
                <div className="p-2 bg-slate-50 text-slate-600 rounded-lg"><Storefront size={20} weight="duotone" /></div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 font-serif">24</div>
                <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1"><CheckCircle size={14} className="text-emerald-500" /> Active B2B relationships</div>
              </div>
            </div>
          </div>

          {/* Action Center Row */}
          <div id="action-center" className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
            
            {/* Accept Custody */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-blue-50 rounded-2xl text-blue-600">
                  <Warehouse size={32} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-bold text-slate-900">Bulk Inventory Intake</h2>
                  <p className="text-sm font-medium text-slate-500">Sign for and acquire massive medicine batches from manufacturers.</p>
                </div>
              </div>
              <form onSubmit={handleReceive} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Batch Identification</label>
                  <div className="flex gap-2">
                    <input className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Enter or scan ID" value={receiveForm.batchId} onChange={e => setReceiveForm(f => ({ ...f, batchId: e.target.value }))} required />
                    <button type="button" className="px-5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-colors text-slate-600" onClick={() => setScanningFor("receive")}>
                      <Camera weight="duotone" size={24} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Warehouse Storage Zone</label>
                  <div className="relative">
                    <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="e.g. Zone A Pallet Rack" value={receiveForm.location} onChange={e => setReceiveForm(f => ({ ...f, location: e.target.value }))} required />
                  </div>
                </div>
                <button type="submit" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2" disabled={submitting}>
                  Confirm Bulk Acquisition on Ledger
                </button>
              </form>
            </div>

            {/* Transfer Batch */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700">
                  <Handshake size={32} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-bold text-slate-900">B2B Wholesale Dispatch</h2>
                  <p className="text-sm font-medium text-slate-500">Sell and distribute portions of bulk inventory to retail pharmacies.</p>
                </div>
              </div>
              <form onSubmit={handleTransfer} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Batch Identification</label>
                  <div className="flex gap-2">
                    <input className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Enter or scan ID" value={transferForm.batchId} onChange={e => setTransferForm(f => ({ ...f, batchId: e.target.value }))} required />
                    <button type="button" className="px-5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-colors text-slate-600" onClick={() => setScanningFor("transfer")}>
                      <Camera weight="duotone" size={24} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Retailer Address</label>
                    <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="0x..." value={transferForm.toAddress} onChange={e => setTransferForm(f => ({ ...f, toAddress: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Delivery Destination</label>
                    <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="e.g. City Pharmacy Hub" value={transferForm.location} onChange={e => setTransferForm(f => ({ ...f, location: e.target.value }))} required />
                  </div>
                </div>
                <button type="submit" className="mt-4 bg-slate-900 hover:bg-black text-white px-6 py-4 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2" disabled={submitting}>
                  Execute Wholesale Dispatch <ArrowRight size={18} />
                </button>
              </form>
            </div>
          </div>

          <motion.div id="ledger-section" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-4">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-serif font-bold text-slate-900">Wholesale Inventory Ledger</h2>
              <span className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                {activeBatches ? `${activeBatches.length} Units Available` : "Syncing..."}
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
              } else if (scanningFor === "transfer") {
                setTransferForm(f => ({ ...f, batchId: scannedId }));
              }
              setScanningFor(null);
            }}
            onClose={() => setScanningFor(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
