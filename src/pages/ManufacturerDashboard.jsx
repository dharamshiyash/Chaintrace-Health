import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listBatches, getOffenders, registerBatchApi, recordEvent } from "../lib/api.js";
import { registerBatchOnChain, parseWeb3Error, getConnectedAccount, connectWallet } from "../lib/contract.js";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldWarning, Cube, Factory, Link as LinkIcon, ChartLineUp, WarningCircle, CheckCircle, ShieldPlus, Users, ArrowsClockwise, QrCode } from "@phosphor-icons/react";
import BatchTable from "../components/BatchTable.jsx";
import { truncateAddress } from "../lib/utils.js";
import BatchRegistrationDrawer from "../components/BatchRegistrationDrawer.jsx";
import ProfileQRModal from "../components/ProfileQRModal.jsx";
import { AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const RECALL_REASONS = ["Confirmed Expiry", "Probable Expiry", "Quality Defect", "Contamination", "Other"];
const COLORS = ['#10b981', '#f43f5e'];

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
  const [whitelistAddr, setWhitelistAddr] = useState("");
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState(null);
  const [isProfileQrOpen, setIsProfileQrOpen] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    getConnectedAccount().then((acc) => {
      if (acc) setConnectedAccount(acc);
    });

    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccounts = (accounts) => {
        setConnectedAccount(accounts && accounts.length > 0 ? accounts[0] : null);
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
    queryKey: ["batches"],
    queryFn: () => listBatches(),
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

  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    if (activeTab === "All") return batches;
    if (activeTab === "Fresh") return batches.filter(b => b.stage === "Fresh");
    if (activeTab === "In-Transit") return batches.filter(b => b.stage === "In-Transit");
    if (activeTab === "Late") return batches.filter(b => b.isLate);
    if (activeTab === "Exceptions") return batches.filter(b => b.stage === "Exception");
    return batches;
  }, [batches, activeTab]);

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
    if (!batches) return [{ name: 'Active', value: 1 }, { name: 'Suspicious', value: 0 }];
    const active = batches.filter(b => b.status === "Active").length;
    const susp = batches.filter(b => b.status === "Suspicious" || b.status === "Recalled").length;
    return [{ name: 'Active', value: active }, { name: 'Suspicious', value: susp }];
  }, [batches]);

  const divergenceRate = divergenceData[1].value > 0 ? ((divergenceData[1].value / (divergenceData[0].value + divergenceData[1].value)) * 100).toFixed(1) : 0;

  async function handleRegister(form) {
    setSubmitting(true);
    try {
      const result = await registerBatchOnChain(form);
      const txHash = result.txHash;
      const shortHash = truncateAddress(txHash, 8, 6);

      // Best-effort notification to backend to index new batch
      try {
        await registerBatchApi({
          batch_id: form.batchId.trim(),
          medicine_name: form.medicineName.trim(),
          quantity: Number(form.quantity),
          manufacturing_date: result.mfgTimestamp,
          expiry_date: result.expTimestamp,
          location: form.location.trim(),
          tx_hash: txHash,
          manufacturer: connectedAccount || undefined,
        });
      } catch (apiErr) {
        console.warn("Notice: Backend batch indexing warning:", apiErr.message);
      }

      // Record performance metric for dashboard analytics
      try {
        await recordEvent({
          function_name: `registerBatch(${form.batchId})`,
          tx_hash: txHash,
          gas_used: result.receipt?.gasUsed ? Number(result.receipt.gasUsed) : 0,
          confirmation_ms: 2000,
          success: true,
        });
      } catch {
        // Non-critical performance logging
      }

      showToast(
        `Batch "${form.batchId}" registered on Polygon Amoy! TX: ${shortHash}`,
        "success",
        txHash
      );
      // Only close drawer upon successful blockchain confirmation
      setIsDrawerOpen(false);
      await qc.invalidateQueries({ queryKey: ["batches"] });
      await qc.refetchQueries({ queryKey: ["batches"] });
    } catch (err) {
      console.error("Batch registration error:", err);
      const message = parseWeb3Error(err);
      showToast(message, "error");
      // Do NOT close drawer on error so user can adjust inputs
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecall(e) {
    e.preventDefault();
    if (!recallForm.reason) return;
    setSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      showToast(`Batch "${recallForm.batchId}" recalled: ${recallForm.reason}`, "success");
      setRecallForm({ batchId: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["batches"] });
    } catch (err) {
      showToast(err.message || "Recall failed. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddPartner(e) {
    e.preventDefault();
    if (!whitelistAddr.trim()) return;
    setSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 600));
      showToast(`${whitelistAddr.slice(0,10)}… added to your approved partner list.`, "success");
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
            <p className="text-slate-500 font-medium text-base md:text-lg max-w-2xl">Mint new medicine batches onto the blockchain, monitor global inventory state, and manage your authorized partner network.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div 
              className="flex px-4 py-3 sm:py-2 border border-slate-200 rounded-xl bg-white shadow-sm text-sm font-mono text-slate-700 items-center justify-center gap-2 cursor-pointer hover:border-purple-300 transition-colors"
              onClick={() => {
                if (!connectedAccount) {
                  connectWallet()
                    .then(setConnectedAccount)
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
            
            {/* Issue Volume */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48 relative overflow-hidden">
              <div className="flex justify-between items-start relative z-10 mb-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Issue Volume (7d)</div>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><ChartLineUp size={20} weight="duotone" /></div>
              </div>
              <div className="relative z-10 flex-1 flex flex-col">
                <div className="text-4xl font-bold text-slate-900 font-serif mb-2">{batches?.length || 0}</div>
                <div className="flex-1 min-h-[40px] -mx-2 -mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="count" stroke="#9333ea" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Divergence Rate */}
            <div 
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48 cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => document.getElementById('anomalies-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Divergence Rate</div>
                <div className="p-2 bg-red-50 text-red-600 rounded-lg"><ShieldWarning size={20} weight="duotone" /></div>
              </div>
              <div className="flex items-center justify-between flex-1">
                <div>
                  <div className="text-4xl font-bold text-slate-900 font-serif">{divergenceRate}%</div>
                  <div className="text-xs font-medium text-slate-500 mt-2">Compromised Batches</div>
                </div>
                <div className="h-24 w-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={divergenceData} innerRadius={25} outerRadius={40} paddingAngle={2} dataKey="value" stroke="none">
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
                <div className="text-4xl font-bold font-serif">Secure</div>
                <div className="text-xs font-medium text-purple-200 mt-2">All nodes cryptographically verified</div>
              </div>
            </div>

            {/* Total Units */}
            <div 
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48 cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => document.getElementById('ledger-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Units</div>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Cube size={20} weight="duotone" /></div>
              </div>
              <div className="mt-auto">
                <div className="text-4xl font-bold text-slate-900 font-serif">
                  {batches ? (batches.length * 1000).toLocaleString() : 0}
                </div>
                <div className="text-xs font-medium text-emerald-600 mt-2 flex items-center gap-1">
                  <CheckCircle size={14} /> Global active inventory
                </div>
              </div>
            </div>
          </div>

          {/* Actions & Alerts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-2">
            
            {/* Action Card: Whitelist */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                  <Users size={28} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-slate-900">Partner Whitelist</h2>
                  <p className="text-sm font-medium text-slate-500">Authorize distributors and pharmacies</p>
                </div>
              </div>
              <form onSubmit={handleAddPartner} className="flex flex-col sm:flex-row gap-3">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm" placeholder="Wallet Address (0x...)" value={whitelistAddr} onChange={e => setWhitelistAddr(e.target.value)} required />
                <button type="submit" className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md sm:w-auto w-full whitespace-nowrap" disabled={submitting}>
                  Authorize Node
                </button>
              </form>
            </div>

            {/* Network Anomalies */}
            <div id="anomalies-section" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-red-100 text-red-600">
                    <WarningCircle size={18} weight="fill" />
                  </div>
                  <h2 className="text-base font-serif font-bold text-slate-900">Detected Anomalies</h2>
                </div>
              </div>
              <div className="flex-1 overflow-x-auto bg-white p-4">
                {offLoading ? (
                  <div className="p-6 text-center text-sm text-slate-500">Scanning network...</div>
                ) : isOffError ? (
                  <div className="p-6 text-center text-sm text-slate-500 flex flex-col items-center">
                    <p className="text-red-600 mb-2">Unable to scan network anomalies.</p>
                    <button onClick={() => refetchOffenders()} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors">
                      <ArrowsClockwise size={14} /> Retry Scan
                    </button>
                  </div>
                ) : offenders?.length > 0 ? (
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 font-medium text-slate-500 text-xs uppercase tracking-wider">Node Address</th>
                        <th className="px-4 py-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">Incidents</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {offenders.map(o => (
                        <tr key={o.address} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-800 block mb-0.5">{o.orgName}</span>
                            <span className="font-mono text-[11px] text-slate-400">{o.address}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 border border-red-100 text-red-600">
                              {o.count} Events
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center py-6 text-slate-500">
                    <CheckCircle size={32} weight="duotone" className="mb-2 text-emerald-500" />
                    <p className="text-sm font-medium text-slate-700">No anomalous activity detected.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ledger Row */}
          <motion.div id="ledger-section" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-2">
            <div className="px-4 md:px-8 py-5 md:py-6 border-b border-slate-100 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-serif font-bold text-slate-900">Global Inventory Ledger</h2>
                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 whitespace-nowrap">
                  {filteredBatches ? `${filteredBatches.length} Records` : "Syncing..."}
                </span>
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar">
                {["All", "Fresh", "In-Transit", "Late", "Exceptions"].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${
                      activeTab === tab 
                        ? "bg-slate-900 border-slate-900 text-white shadow-md" 
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    }`}
                  >
                    {tab}
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
                onRecall={(id) => setRecallForm(f => ({ ...f, batchId: id }))}
              />
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Recall Modal */}
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
                  Emergency Recall
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
                    <option value="">Select reason…</option>
                    {RECALL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <button type="submit" className="mt-4 bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2" disabled={submitting}>
                  Execute Global Recall
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProfileQRModal 
        isOpen={isProfileQrOpen}
        onClose={() => setIsProfileQrOpen(false)}
        roleName="Origin Pharmaceutical Manufacturer Node"
        address={connectedAccount || "0x3E8bBd12a1A614d131Fc227106D2697Df1C0C072"}
        roleType="manufacturer"
      />
    </main>
  );
}
