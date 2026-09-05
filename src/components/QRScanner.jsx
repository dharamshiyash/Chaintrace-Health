import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { motion } from "framer-motion";
import { X, Camera, UploadSimple, Image as ImageIcon, WarningCircle } from "@phosphor-icons/react";

function extractBatchId(rawText) {
  if (!rawText) return "";
  const text = rawText.trim();
  try {
    const url = new URL(text);
    const parts = url.pathname.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (lastPart) return decodeURIComponent(lastPart);
  } catch {
    if (text.includes("/verify/")) {
      const parts = text.split("/verify/");
      return parts[parts.length - 1].split(/[?#]/)[0];
    }
  }
  return text;
}

export default function QRScanner({ onScan, onClose }) {
  const [activeTab, setActiveTab] = useState("camera"); // "camera" | "upload"
  const [cameraError, setCameraError] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const scannerRef = useRef(null);
  const hasScannedRef = useRef(false);

  // Initialize and run camera scanner
  useEffect(() => {
    if (activeTab !== "camera") return;

    let isSubscribed = true;
    hasScannedRef.current = false;
    setCameraError(null);

    const timer = setTimeout(() => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1,
          },
          (decodedText) => {
            if (hasScannedRef.current) return;
            hasScannedRef.current = true;
            const batchId = extractBatchId(decodedText);
            scanner.stop()
              .then(() => onScan(batchId))
              .catch(() => onScan(batchId));
          },
          () => {
            // Ignore frame scan failures
          }
        ).catch((err) => {
          if (!isSubscribed) return;
          console.warn("Camera start failed:", err);
          setCameraError("Camera access denied or device not found. You can upload an image of the QR code instead.");
        });
      } catch (e) {
        if (!isSubscribed) return;
        setCameraError("Failed to initialize camera scanner.");
      }
    }, 100);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
          scannerRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
        scannerRef.current = null;
      }
    };
  }, [activeTab, onScan]);

  // Handle image file upload
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsProcessingFile(true);

    try {
      // Use temporary scanner instance on hidden div or reader element
      const fileScanner = new Html5Qrcode("qr-file-reader");
      const decodedText = await fileScanner.scanFile(file, false);
      fileScanner.clear();

      const batchId = extractBatchId(decodedText);
      if (batchId) {
        onScan(batchId);
      } else {
        setUploadError("Could not recognize a batch identifier from this QR code.");
      }
    } catch (err) {
      console.warn("File QR scan failed:", err);
      setUploadError("No valid QR code found in this image. Please upload a clear QR code image.");
    } finally {
      setIsProcessingFile(false);
    }
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
        className="bg-white rounded-3xl shadow-modal p-6 max-w-md w-full border border-slate-100" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-xl text-primary-600">
              <Camera size={22} weight="duotone" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-serif">Scan Medicine QR</h2>
              <p className="text-xs text-slate-500">Scan or upload to verify batch</p>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-lg" type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-4 text-xs font-bold">
          <button
            type="button"
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === "camera" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("camera")}
          >
            <Camera size={16} /> Live Camera
          </button>
          <button
            type="button"
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === "upload" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("upload")}
          >
            <UploadSimple size={16} /> Upload Image
          </button>
        </div>
        
        {activeTab === "camera" ? (
          <div className="py-2">
            {cameraError ? (
              <div className="p-6 bg-red-50/70 border border-red-100 rounded-2xl text-center">
                <WarningCircle size={32} className="text-red-500 mx-auto mb-2" weight="fill" />
                <p className="text-xs text-red-700 font-medium mb-4">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => setActiveTab("upload")}
                  className="btn btn-primary text-xs py-2 px-4 justify-center mx-auto"
                >
                  <UploadSimple size={16} /> Switch to Upload Image
                </button>
              </div>
            ) : (
              <>
                <div id="qr-reader" className="w-full mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 min-h-[260px] flex items-center justify-center"></div>
                <p className="mt-3 text-xs text-slate-500 text-center font-medium">
                  Point camera directly at the Batch QR code.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="py-2">
            <div className="border-2 border-dashed border-slate-200 hover:border-primary-400 rounded-2xl p-8 text-center transition-colors bg-slate-50/50 flex flex-col items-center justify-center">
              <div className="p-3 bg-white text-primary-600 rounded-2xl shadow-sm border border-slate-100 mb-3">
                <ImageIcon size={32} weight="duotone" />
              </div>
              <p className="text-sm font-bold text-slate-800 mb-1">Choose a QR Code Image</p>
              <p className="text-xs text-slate-500 mb-4 max-w-[220px]">
                Upload downloaded PNG or photo containing the batch QR code.
              </p>
              <label className="btn btn-primary cursor-pointer text-xs py-2.5 px-5">
                <UploadSimple size={16} />
                <span>{isProcessingFile ? "Decoding..." : "Select File"}</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={isProcessingFile}
                />
              </label>
            </div>

            {uploadError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex items-center gap-2">
                <WarningCircle size={16} weight="fill" className="flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
            
            {/* Hidden container for file scanning */}
            <div id="qr-file-reader" className="hidden"></div>
          </div>
        )}

        <button type="button" className="btn btn-outline justify-center w-full mt-4 text-xs py-2.5" onClick={onClose}>
          Cancel
        </button>
      </motion.div>
    </div>
  );
}
