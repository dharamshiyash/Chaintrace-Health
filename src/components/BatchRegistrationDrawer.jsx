import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Cube, CaretRight, CaretLeft, GasPump, QrCode } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";

export default function BatchRegistrationDrawer({ isOpen, onClose, onSubmit, isSubmitting }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ 
    batchId: "", 
    medicineName: "", 
    mfgDate: "", 
    expDate: "", 
    quantity: "", 
    location: "" 
  });
  const [gasEstimate, setGasEstimate] = useState("0.0042");

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setForm({ batchId: "", medicineName: "", mfgDate: "", expDate: "", quantity: "", location: "" });
      // Simulate live gas estimator fluctuation
      const interval = setInterval(() => {
        setGasEstimate((Math.random() * (0.0050 - 0.0035) + 0.0035).toFixed(4));
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const isStep1Valid = form.medicineName && form.quantity;
  const isStep2Valid = form.location && form.mfgDate && form.expDate && form.batchId;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
            onClick={!isSubmitting ? onClose : undefined}
          />
          
          {/* Drawer */}
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-slate-100"
          >
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <div className="p-1.5 bg-primary-50 text-primary-600 rounded-lg">
                    <Cube size={20} weight="duotone" />
                  </div>
                  Register Genesis Batch
                </h2>
                <p className="text-xs text-slate-500 mt-1">Issue a new batch to the blockchain</p>
              </div>
              <button 
                onClick={onClose}
                disabled={isSubmitting}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Stepper Indicator */}
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center gap-2">
                <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-primary-500' : 'bg-slate-100'}`} />
                <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-primary-500' : 'bg-slate-100'}`} />
                <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? 'bg-primary-500' : 'bg-slate-100'}`} />
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span className={step >= 1 ? 'text-primary-600' : ''}>Medicine</span>
                <span className={step >= 2 ? 'text-primary-600' : ''}>Details</span>
                <span className={step >= 3 ? 'text-primary-600' : ''}>Sign</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-700">Medicine Name</label>
                      <input className="input" placeholder="e.g. Amoxicillin 500mg" value={form.medicineName} onChange={e => setForm({...form, medicineName: e.target.value})} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-700">Quantity (Units)</label>
                      <input type="number" className="input" placeholder="e.g. 10000" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-700">Batch ID</label>
                      <input className="input font-mono text-sm" placeholder="e.g. BATCH-001" value={form.batchId} onChange={e => setForm({...form, batchId: e.target.value.toUpperCase()})} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-700">Manufacturing Location</label>
                      <input className="input" placeholder="Facility Name / City" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-sm font-medium text-slate-700">Mfg Date</label>
                        <input type="date" className="input text-sm" value={form.mfgDate} onChange={e => setForm({...form, mfgDate: e.target.value})} />
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-sm font-medium text-slate-700">Exp Date</label>
                        <input type="date" className="input text-sm" value={form.expDate} onChange={e => setForm({...form, expDate: e.target.value})} />
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-6">
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-200 pb-2">Review Issuance</h3>
                      <div className="grid grid-cols-2 gap-y-3 text-sm">
                        <div className="text-slate-500">Medicine:</div>
                        <div className="font-medium text-slate-900 text-right">{form.medicineName}</div>
                        <div className="text-slate-500">Batch ID:</div>
                        <div className="font-mono text-xs text-slate-900 text-right">{form.batchId}</div>
                        <div className="text-slate-500">Quantity:</div>
                        <div className="font-medium text-slate-900 text-right">{form.quantity} units</div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-6 bg-white border border-slate-100 shadow-sm rounded-xl">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1"><QrCode size={16}/> Generated QR</div>
                      <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/verify/${form.batchId}`} size={120} level="M" />
                      <div className="text-[10px] text-slate-400 mt-2 font-mono">Will be active post-issuance</div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-primary-50/50 rounded-lg border border-primary-100 text-sm">
                      <div className="flex items-center gap-2 text-primary-700 font-medium">
                        <GasPump size={18} /> Est. Gas Fee
                      </div>
                      <div className="font-mono text-primary-700">{gasEstimate} MATIC</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between">
              {step > 1 ? (
                <button type="button" onClick={handleBack} disabled={isSubmitting} className="btn btn-outline px-4">
                  <CaretLeft size={16} /> Back
                </button>
              ) : <div></div>}

              {step < 3 ? (
                <button type="button" onClick={handleNext} disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)} className="btn btn-primary px-6">
                  Next <CaretRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="btn btn-primary px-6">
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-r-white animate-spin" /> Signing...
                    </div>
                  ) : 'Sign & Issue'}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
