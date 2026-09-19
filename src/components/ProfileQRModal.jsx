import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Copy, Check, QrCode, ShieldCheck, Buildings, Stethoscope, Factory } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";

export default function ProfileQRModal({ isOpen, onClose, roleName, address, roleType = "pharmacy" }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const qrRef = useRef(null);

  if (!isOpen) return null;

  const roleIcons = {
    manufacturer: <Factory size={22} weight="fill" className="text-purple-600" />,
    distributor: <Buildings size={22} weight="fill" className="text-blue-600" />,
    pharmacy: <Stethoscope size={22} weight="fill" className="text-emerald-600" />,
  };

  const badgeColors = {
    manufacturer: "bg-purple-100 text-purple-700 border-purple-200",
    distributor: "bg-blue-100 text-blue-700 border-blue-200",
    pharmacy: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };

  function handleCopy() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleDownload() {
    try {
      setDownloading(true);
      const svg = qrRef.current?.querySelector("svg");
      if (!svg) throw new Error("SVG not found");

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = 400;
        canvas.height = 400;
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 20, 20, 360, 360);
          const pngUrl = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.href = pngUrl;
          downloadLink.download = `ChainTrace-Node-${roleType}-${address.slice(0, 8)}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        }
        URL.revokeObjectURL(url);
        setDownloading(false);
      };
      img.src = url;
    } catch (err) {
      console.error("Failed to download profile QR PNG:", err);
      setDownloading(false);
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1200] p-4"
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
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
              {roleIcons[roleType] || <ShieldCheck size={22} weight="fill" className="text-primary-600" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-serif">Node Profile QR</h2>
              <p className="text-xs font-medium text-slate-500">Scan to acquire node address</p>
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

        {/* Role Identity Tag */}
        <div className="mb-4 text-center">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${badgeColors[roleType] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
            {roleName}
          </span>
        </div>

        {/* QR Code Container */}
        <div 
          ref={qrRef}
          className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-2xl border border-slate-100 mb-6"
        >
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-4">
            <QRCodeSVG 
              value={address || "0x0000000000000000000000000000000000000000"} 
              size={180}
              level="H"
              marginSize={2}
            />
          </div>
          <p className="font-mono text-xs font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm max-w-[260px] truncate text-center" title={address}>
            {address}
          </p>
          <p className="text-[11px] text-slate-400 mt-2 text-center max-w-[240px]">
            Polygon Amoy Testnet (Chain ID 80002)
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2">
            <button 
              type="button"
              className="btn btn-primary flex-1 justify-center py-3 text-sm font-semibold"
              onClick={handleDownload}
              disabled={downloading}
            >
              <Download size={18} /> {downloading ? "Exporting..." : "Download QR"}
            </button>
            <button 
              type="button"
              className="btn btn-outline py-3 px-4 text-sm font-semibold flex items-center justify-center gap-1.5"
              onClick={handleCopy}
              title="Copy Address"
            >
              {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-1">
            Partners can scan this QR with their camera to fill your address automatically during wholesale handoffs.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
