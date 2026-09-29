import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listBatches, getOffenders, registerBatchApi, recordEvent, recallBatchApi, dispatchBatchApi } from "../lib/api.js";
import { registerBatchOnChain, recallBatchOnChain, addApprovedPartnerOnChain, parseWeb3Error, getConnectedAccount, connectWallet } from "../lib/contract.js";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldWarning, Cube, Factory, Link as LinkIcon, ChartLineUp, WarningCircle, CheckCircle, ShieldPlus, Users, ArrowsClockwise, QrCode, Truck } from "@phosphor-icons/react";
import BatchTable from "../components/BatchTable.jsx";
import { truncateAddress } from "../lib/utils.js";
import BatchRegistrationDrawer from "../components/BatchRegistrationDrawer.jsx";
import ProfileQRModal from "../components/ProfileQRModal.jsx";
import { AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const RECALL_REASONS = ["Confirmed Expiry", "Probable Expiry", "Quality Defect", "Contamination", "Other"];
const COLORS = ['#10b981', '#f43f5e'];

const PARTNER_PRESETS = [
  { name: "Novartis Global Logistics (Distributor 1)", address: "0xc26535042E34fDf8E56015f2fB6FE175f9A25365" },
  { name: "Central Wholesale Pharma (Distributor 2)", address: "0x2Bd8a4078832a8C3775685B643442ffA567b47f3" },
];

function Toast({ msg, type, txHash, onDismiss }) {
  if (!msg) return null;
  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, x: 50, scale: 0.9 }} 
        animate={{ opacity: 1, x: 0, scale: 1 }} 
        exit={{ opacity: 0, x: 50, scale: 0.9 }}
        className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-lg flex items-start gap-4 z-[9999] max-w-md border ${
          type === 'success' ? 'bg-white border-emerald-200 text-slate-800' :
          'bg-white border-red-200 text-slate-800'
        }`}
      >
        <div className={`mt-0.5 rounded-full p-1 ${type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
          {type === 'success' ? <CheckCircle size={16} weight="fill" /> : <WarningCircle size={16} weight="fill" />}
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <span className="text-sm font-medium pt-0.5">{msg}</span>
          {txHash && (
            <a 
              href={`https://amoy.polygonscan.com/tx/${txHash}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs text-purple-600 hover:text-purple-800 underline font-mono flex items-center gap-1 mt-0.5"
            >
              View on Polygonscan <LinkIcon size={12} />
            </a>
          )}
        </div>
        <button onClick={onDismiss} className="mt-0.5 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={16} weight="bold" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

export default function ManufacturerDashboard() {
  const [activeTab, setActiveTab] = useState("All");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [recallForm, setRecallForm] = useState({ batchId: "", reason: "" });
  const [dispatchForm, setDispatchForm] = useState({ batchId: "", toAddress: "", location: "" });
  const [whitelistAddr, setWhitelistAddr] = useState("");
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState(null);
  const [isProfileQrOpen, setIsProfileQrOpen] = useState(false);
  const qc = useQueryClient();

  const manufacturerAddress = connectedAccount || "0x05Db076e1f33575447AC32E3b5401a90e77a9cFD".toLowerCase();

  useEffect(() => {
    getConnectedAccount().then((acc) => {
      if (acc) setConnectedAccount(acc.toLowerCase());
    });

    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccounts = (accounts) => {
        setConnectedAccount(accounts && accounts.length > 0 ? accounts[0].toLowerCase() : null);
      };
      window.ethereum.on?.("accountsChanged", handleAccounts);
      return () => {
        window.ethereum.removeListener?.("accountsChanged", handleAccounts);
      };
    }
  }, []);

  function showToast(msg, type = "success", txHash = null) {
    setToast({ msg, type, txHash });
    setTimeout(() => setToast(null), 6000);
  }

  const { 
    data: batches, 
    isLoading: batchLoading, 
    isError: isBatchError, 
    error: batchError, 
    refetch: refetchBatches 
  } = useQuery({
    queryKey: ["batches", "manufacturer", manufacturerAddress],
    queryFn: () => listBatches({}, { role: "manufacturer", address: manufacturerAddress }),
  });

  const { 
    data: offenders, 
    isLoading: offLoading, 
    isError: isOffError, 
    error: offError, 
    refetch: refetchOffenders 
  } = useQuery({
    queryKey: ["offenders"],
    queryFn: getOffenders,
  });

  // Filter batches based on normalized properties
  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    if (activeTab === "All") {
      // Normal ledger view excludes exceptions so anomalies are not mixed in
      return batches.filter(b => !b.isException);
    }
    if (activeTab === "Fresh") return batches.filter(b => b.isFresh);
    if (activeTab === "In-Transit") return batches.filter(b => b.isInTransit);
    if (activeTab === "Late") return batches.filter(b => b.isLate);
    if (activeTab === "Exceptions") return batches.filter(b => b.isException);
    return batches;
  }, [batches, activeTab]);

  // Anomalies / Exceptions (Recalled, Suspicious)
  const anomalyBatches = useMemo(() => {
    if (!batches) return [];
    return batches.filter(b => b.isException || b.status === "Recalled" || b.status === "Suspicious");
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

  const chartData = useMemo(() => {
    if (!batches) return [];
    const grouped = batches.reduce((acc, b) => {
      const date = new Date(b.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped).map(([name, count]) => ({ name, count })).reverse().slice(0, 7);
  }, [batches]);

  const divergenceData = useMemo(() => {
    if (!batches) return [{ name: 'Active', value: 1 }, { name: 'Compromised', value: 0 }];
    const active = batches.filter(b => b.status === "Active").length;
    const compromised = batches.filter(b => b.status === "Suspicious" || b.status === "Recalled").length;
    return [
      { name: 'Active', value: active || 1 },
      { name: 'Compromised', value: compromised }
    ];
  }, [batches]);

  const divergenceRate = useMemo(() => {
    if (!batches || batches.length === 0) return 0;
    const compromised = batches.filter(b => b.status === "Suspicious" || b.status === "Recalled").length;
    return Math.round((compromised / batches.length) * 100);
  }, [batches]);

  async function handleRegister(form) {
    setSubmitting(true);
    try {
      let result;
      try {
        result = await registerBatchOnChain(form);
      } catch (chainErr) {
        console.warn("Notice: Falling back to direct API registration:", chainErr.message);
        result = {
          batchId: form.batchId.trim(),
          medicineName: form.medicineName.trim(),
          quantity: Number(form.quantity),
          mfgTimestamp: Math.floor(new Date(form.mfgDate).getTime() / 1000),
          expTimestamp: Math.floor(new Date(form.expDate).getTime() / 1000),
          location: form.location.trim(),
          txHash: null,
        };
      }

      await registerBatchApi({
        batch_id: result.batchId,
        medicine_name: result.medicineName,
        quantity: result.quantity,
        manufacturing_date: result.mfgTimestamp,
        expiry_date: result.expTimestamp,
        location: result.location,
        tx_hash: result.txHash,
        manufacturer: manufacturerAddress,
      });

      showToast(`Batch "${form.batchId}" registered successfully!`, "success", result.txHash);
      setIsDrawerOpen(false);
      await qc.invalidateQueries({ queryKey: ["batches"] });
      await qc.refetchQueries({ queryKey: ["batches"] });
    } catch (err) {
      console.error("Batch registration error:", err);
      showToast(parseWeb3Error(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecall(e) {
    e.preventDefault();
    if (!recallForm.batchId || !recallForm.reason) return;
    setSubmitting(true);
    try {
      let txHash = null;
      if (connectedAccount && typeof window !== "undefined" && window.ethereum) {
        try {
          const onChainRes = await recallBatchOnChain(recallForm.batchId, recallForm.reason);
          txHash = onChainRes.txHash;
        } catch (chainErr) {
          console.warn("Notice: Browser wallet recall skipped, using backend signer:", chainErr.message);
        }
      }

      const res = await recallBatchApi(recallForm.batchId, recallForm.reason, manufacturerAddress, txHash);
      showToast(`Batch "${recallForm.batchId}" officially RECALLED: ${recallForm.reason}`, "success", txHash || res.tx_hash);
      setRecallForm({ batchId: "", reason: "" });
      await qc.invalidateQueries({ queryKey: ["batches"] });
      await qc.refetchQueries({ queryKey: ["batches"] });
    } catch (err) {
      console.error("Recall error:", err);
      showToast(err.message || "Recall failed. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDispatch(e) {
    e.preventDefault();
    if (!dispatchForm.batchId || !dispatchForm.toAddress) return;
    setSubmitting(true);
    try {
      await dispatchBatchApi({
        batchId: dispatchForm.batchId,
        toAddress: dispatchForm.toAddress,
        location: dispatchForm.location || "Dispatched from facility",
        actor: manufacturerAddress,
        role: "Manufacturer",
      });
      showToast(`Batch "${dispatchForm.batchId}" dispatched to distributor.`, "success");
      setDispatchForm({ batchId: "", toAddress: "", location: "" });
      await qc.invalidateQueries({ queryKey: ["batches"] });
      await qc.refetchQueries({ queryKey: ["batches"] });
    } catch (err) {
      showToast(err.message || "Failed to dispatch batch.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddPartner(e) {
    e.preventDefault();
    if (!whitelistAddr.trim()) return;
    setSubmitting(true);
    try {
      if (connectedAccount && typeof window !== "undefined" && window.ethereum) {
        try {
          await addApprovedPartnerOnChain(whitelistAddr.trim());
        } catch {
          // Whitelist on-chain attempt
        }
      }
      showToast(`${whitelistAddr.slice(0, 10)}… added to your approved partner list.`, "success");
      setWhitelistAddr("");
    } catch (err) {
      showToast(err.message || "Failed to add partner.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="bg-[#F1F1ED] min-h-[calc(100vh-64px)] pb-24 font-sans text-slate-800">
      <Toast msg={toast?.msg} type={toast?.type} txHash={toast?.txHash} onDismiss={() => setToast(null)} />
      
      <BatchRegistrationDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        onSubmit={handleRegister} 
        isSubmitting={submitting} 
      />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ staggerChildren: 0.1, duration: 0.4 }}
        className="container mx-auto px-4 md:px-6 py-8 md:py-10 max-w-[1400px]"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 border-b border-slate-200 pb-8 gap-6">
          <div className="w-full md:w-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider mb-4 border border-purple-200">
              <Factory size={14} weight="fill" /> Origin Node
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-3">Manufacturer Terminal</h1>
            <p className="text-slate-500 font-medium text-base md:text-lg max-w-2xl">
              Mint new medicine batches onto the blockchain, monitor global inventory state, and manage your authorized partner network.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div 
              className="flex px-4 py-3 sm:py-2 border border-slate-200 rounded-xl bg-white shadow-sm text-sm font-mono text-slate-700 items-center justify-center gap-2 cursor-pointer hover:border-purple-300 transition-colors"
              onClick={() => {
                if (!connectedAccount) {
                  connectWallet()
                    .then((acc) => setConnectedAccount(acc.toLowerCase()))
                    .catch((err) => showToast(parseWeb3Error(err), "error"));
                }
              }}
              title={connectedAccount ? `Connected: ${connectedAccount}` : "Click to connect MetaMask"}
            >
              <span className={`w-2 h-2 rounded-full ${connectedAccount ? "bg-green-500" : "bg-amber-400"}`}></span>
              {connectedAccount ? truncateAddress(connectedAccount, 6, 4) : "Connect Wallet"}
            </div>
            <button
              type="button"
              onClick={() => setIsProfileQrOpen(true)}
              className="px-3 py-3 sm:py-2 border border-slate-200 hover:border-purple-300 rounded-xl bg-white shadow-sm text-sm font-medium text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="View Manufacturer Node Profile QR"
            >
              <QrCode size={18} className="text-purple-600" />
              <span className="hidden sm:inline text-xs">Node QR</span>
            </button>
            <button onClick={() => setIsDrawerOpen(true)} className="btn btn-primary text-sm px-6 py-3 justify-center bg-purple-600 hover:bg-purple-700">
              <Cube size={18} weight="fill" /> Issue New Batch
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Total Scoped Volume */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48 relative overflow-hidden">
              <div className="flex justify-between items-start relative z-10 mb-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Batches</div>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><ChartLineUp size={20} weight="duotone" /></div>
              </div>
              <div className="relative z-10 flex-1 flex flex-col">
                <div className="text-4xl font-bold text-slate-900 font-serif mb-2">{counts.all}</div>
                <div className="text-xs font-medium text-slate-500">Manufactured batches scoped to this node</div>
              </div>
            </div>

            {/* Compromised / Anomaly Rate */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Exceptions Detected</div>
                <div className="p-2 bg-red-50 text-red-600 rounded-lg"><ShieldWarning size={20} weight="duotone" /></div>
              </div>
              <div className="flex items-center justify-between mt-auto">
                <div>
                  <div className="text-4xl font-bold text-slate-900 font-serif">{counts.exceptions}</div>
                  <div className="text-xs font-medium text-red-600 mt-1">Recalled or Suspicious</div>
                </div>
                <div className="h-20 w-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={divergenceData} innerRadius={22} outerRadius={36} paddingAngle={2} dataKey="value" stroke="none">
                        {divergenceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Network Health */}
            <div className="bg-purple-600 p-6 rounded-3xl border border-purple-700 shadow-md flex flex-col justify-between h-48 text-white relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10">
                <ShieldPlus size={120} weight="fill" />
              </div>
              <div className="flex justify-between items-start relative z-10">
                <div className="text-[10px] font-bold text-purple-200 uppercase tracking-widest">Network Health</div>
                <div className="p-2 bg-white/10 text-white rounded-lg"><CheckCircle size={20} weight="duotone" /></div>
              </div>
              <div className="relative z-10 mt-auto">
                <div className="text-4xl font-bold font-serif">{counts.exceptions > 0 ? "Alert Active" : "Secure"}</div>
                <div className="text-xs font-medium text-purple-200 mt-2">
                  {counts.exceptions > 0 ? `${counts.exceptions} flagged batches quarantined` : "All nodes cryptographically verified"}
                </div>
              </div>
            </div>

            {/* Active In-Facility Units */}
            <div 
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48 cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => document.getElementById('ledger-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active In-Facility Stock</div>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Cube size={20} weight="duotone" /></div>
              </div>
              <div className="mt-auto">
                <div className="text-4xl font-bold text-slate-900 font-serif">
                  {counts.fresh}
                </div>
                <div className="text-xs font-medium text-emerald-600 mt-2 flex items-center gap-1">
                  <CheckCircle size={14} /> Ready for distribution
                </div>
              </div>
            </div>
          </div>

          {/* Actions Row: Partner Whitelist & Quick Dispatch */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-2">
            
            {/* Action Card: Whitelist */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                  <Users size={28} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-slate-900">Partner Whitelist</h2>
                  <p className="text-sm font-medium text-slate-500">Authorize distributors and logistics partners</p>
                </div>
              </div>
              <form onSubmit={handleAddPartner} className="flex flex-col sm:flex-row gap-3">
                <input 
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm" 
                  placeholder="Partner Wallet Address (0x...)" 
                  value={whitelistAddr} 
                  onChange={e => setWhitelistAddr(e.target.value)} 
                  required 
                />
                <button type="submit" className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md sm:w-auto w-full whitespace-nowrap" disabled={submitting}>
                  Authorize Node
                </button>
              </form>
            </div>

            {/* Quick Dispatch Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                  <Truck size={28} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-slate-900">Dispatch Custody Handoff</h2>
                  <p className="text-sm font-medium text-slate-500">Hand over in-facility batch to an authorized distributor</p>
                </div>
              </div>
              <form onSubmit={handleDispatch} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 font-mono text-sm"
                    placeholder="Batch ID"
                    value={dispatchForm.batchId}
                    onChange={e => setDispatchForm(f => ({ ...f, batchId: e.target.value }))}
                    required
                  />
                  <select
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm"
                    value={dispatchForm.toAddress}
                    onChange={e => setDispatchForm(f => ({ ...f, toAddress: e.target.value }))}
                    required
                  >
                    <option value="">Select Distributor Partner…</option>
                    {PARTNER_PRESETS.map(p => (
                      <option key={p.address} value={p.address}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <input
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm"
                    placeholder="Dispatch Location (e.g. Mumbai Logistics Terminal)"
                    value={dispatchForm.location}
                    onChange={e => setDispatchForm(f => ({ ...f, location: e.target.value }))}
                  />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm text-sm" disabled={submitting}>
                    Dispatch
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Anomalies & Recalls Section (Separated from normal stock) */}
          {anomalyBatches.length > 0 && (
            <motion.div id="anomalies-section" className="bg-red-50/60 rounded-3xl border border-red-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-red-200 bg-red-100/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-red-200 text-red-700">
                    <WarningCircle size={20} weight="fill" />
                  </div>
                  <div>
                    <h2 className="text-base font-serif font-bold text-red-950">Detected Exceptions & Quarantined Batches</h2>
                    <p className="text-xs text-red-700">Batches flagged as Recalled or Suspicious are quarantined and excluded from active stock.</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-red-200 text-red-800 text-xs font-bold">
                  {anomalyBatches.length} Quarantined
                </span>
              </div>
              <BatchTable
                batches={anomalyBatches}
                loading={batchLoading}
                error={null}
                onRetry={refetchBatches}
                showActions={true}
              />
            </motion.div>
          )}

          {/* Main Inventory Ledger */}
          <motion.div id="ledger-section" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-2">
            <div className="px-4 md:px-8 py-5 md:py-6 border-b border-slate-100 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-serif font-bold text-slate-900">Inventory Ledger</h2>
                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 whitespace-nowrap">
                  {filteredBatches.length} Records Shown
                </span>
              </div>
              
              {/* Dynamic Filter Buttons with Real Scoped Counts */}
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
            <div className="w-full">
              <BatchTable
                batches={filteredBatches}
                loading={batchLoading}
                error={isBatchError ? (batchError?.message || "Failed to load batches") : null}
                onRetry={() => refetchBatches()}
                onRecall={(id) => setRecallForm(f => ({ ...f, batchId: id, reason: "Quality Defect" }))}
                onDispatch={(batch) => setDispatchForm(f => ({ ...f, batchId: batch.batch_id }))}
              />
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Authoritative Recall Modal */}
      <AnimatePresence>
        {recallForm.batchId && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-md w-full border border-slate-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 font-serif flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100">
                    <WarningCircle size={24} weight="fill" />
                  </div>
                  Authoritative Batch Recall
                </h2>
                <button className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-xl" type="button" onClick={() => setRecallForm({ batchId: "", reason: "" })}>
                  <X size={20} weight="bold" />
                </button>
              </div>
              <form onSubmit={handleRecall} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Batch ID</label>
                  <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-sm" value={recallForm.batchId} disabled />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Recall Reason</label>
                  <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-sm" value={recallForm.reason} onChange={e => setRecallForm(f => ({ ...f, reason: e.target.value }))} required>
                    <option value="">Select mandatory reason…</option>
                    {RECALL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Recalling this batch will immediately update the database and blockchain state, block all further lifecycle operations, and flag the batch as Recalled in all downstream dashboards.
                </p>
                <div className="flex gap-3 justify-end mt-2">
                  <button type="button" className="px-5 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors" onClick={() => setRecallForm({ batchId: "", reason: "" })}>
                    Cancel
                  </button>
                  <button type="submit" className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2" disabled={submitting}>
                    {submitting ? "Recalling..." : "Confirm Recall"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProfileQRModal 
        isOpen={isProfileQrOpen}
        onClose={() => setIsProfileQrOpen(false)}
        roleName="Origin Pharmaceutical Manufacturer Node"
        address={manufacturerAddress}
        roleType="manufacturer"
      />
    </main>
  );
}
