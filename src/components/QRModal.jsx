import { useState } from "react";
import { qrUrl, downloadQrBlob } from "../lib/api.js";
import { motion } from "framer-motion";
import { X, Download, QrCode, Copy, Check, LinkSimple } from "@phosphor-icons/react";

export default function QRModal({ batchId, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);

  const verifyUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/verify/${batchId}`;

  async function handleDownload() {
    try {
      setDownloading(true);
      const blob = await downloadQrBlob(batchId);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `ChainTrace-QR-${batchId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } catch (err) {
      console.error("Failed to download QR code blob:", err);
      // Fallback
      const a = document.createElement("a");
      a.href = qrUrl(batchId);
      a.download = `ChainTrace-QR-${batchId}.png`;
      a.click();
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } finally {
      setDownloading(false);
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div 
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" 
      onClick={onClose} 
      role="dialog" 
      aria-modal="true"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }} 
        className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-sm w-full border border-slate-100" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-50 rounded-xl text-primary-600">
              <QrCode size={24} weight="duotone" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-serif">Batch QR Code</h2>
              <p className="text-xs font-medium text-slate-500">Scan to verify authenticity</p>
            </div>
          </div>
          <button 
            className="text-slate-400 hover:text-slate-700 transition-colors p-2 hover:bg-slate-100 rounded-xl" 
            onClick={onClose} 
            aria-label="Close"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-3">
            <img
              src={qrUrl(batchId)}
              alt={`QR code for batch ${batchId}`}
              className="w-48 h-48 object-contain"
            />
          </div>
          <p className="font-mono text-sm font-bold text-slate-700 bg-white px-4 py-1.5 rounded-lg border border-slate-200 shadow-sm mb-2">
            {batchId}
          </p>
          <p className="text-[11px] text-slate-400 font-mono truncate max-w-[260px]" title={verifyUrl}>
            {verifyUrl}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2">
            <button 
              className="btn btn-primary flex-1 justify-center py-3 text-sm font-semibold" 
              onClick={handleDownload}
              disabled={downloading}
            >
              <Download size={18} /> {downloaded ? "Saved Image!" : downloading ? "Saving..." : "Download PNG"}
            </button>
            <button 
              className="btn btn-outline py-3 px-4 text-sm font-semibold flex items-center justify-center gap-1.5" 
              onClick={handleCopyLink}
              title="Copy verification URL"
            >
              {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
              <span>{copied ? "Copied!" : "Copy Link"}</span>
            </button>
          </div>
          <button className="text-xs text-slate-400 hover:text-slate-600 py-1.5 text-center font-medium" onClick={onClose}>
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
