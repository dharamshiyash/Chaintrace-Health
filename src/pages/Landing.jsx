import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import StatusBadge from "../components/StatusBadge.jsx";
import HeroIllustration from "../components/HeroIllustration.jsx";
import { ShieldCheck, MagnifyingGlass, Globe } from "@phosphor-icons/react";
import CaseStudy from "../components/CaseStudy.jsx";

const FEATURES = [
  {
    title: "Immutable supply chain events",
    body: "Every handoff — from manufacturer to distributor to pharmacy — is recorded on the blockchain. No retroactive edits. No gaps.",
    icon: <Globe className="text-primary-600 mb-4" size={32} weight="fill" />,
    panel: (
      <motion.div 
        className="panel p-6 bg-white/60 backdrop-blur-md relative overflow-hidden"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Subtle scanning highlight */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-50/30 to-transparent w-full h-[50%]"
          animate={{ y: ["-100%", "200%"] }}
          transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
        />
        <div className="font-mono text-sm leading-8 text-slate-600 relative z-10">
          <div className="flex justify-between items-center mb-2">
            <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs">1</span> Manufacturer</span>
            <span className="text-status-active font-semibold bg-status-active-bg px-2 py-0.5 rounded-full text-xs">✓ Authorized</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs">2</span> Distributor 1</span>
            <span className="text-status-active font-semibold bg-status-active-bg px-2 py-0.5 rounded-full text-xs">✓ Authorized</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs">3</span> Pharmacy</span>
            <span className="text-status-active font-semibold bg-status-active-bg px-2 py-0.5 rounded-full text-xs">✓ Authorized</span>
          </div>
          <div className="border-t border-slate-100 mt-4 pt-4 flex items-center gap-2 font-sans">
            <span className="text-slate-500 font-medium">Batch Status:</span> 
            <motion.div animate={{ opacity: [1, 0.7, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
              <StatusBadge status="Active" />
            </motion.div>
          </div>
        </div>
      </motion.div>
    ),
  },
  {
    title: "Automatic divergence detection",
    body: "When a batch passes through an actor not on the previous custodian's approved list, the status flips to Suspicious and the exact point of divergence is recorded on-chain.",
    icon: <ShieldCheck className="text-status-suspicious mb-4" size={32} weight="fill" />,
    panel: (
      <motion.div 
        className="panel p-6 bg-white/60 backdrop-blur-md relative overflow-hidden"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <motion.div 
          className="absolute top-0 left-0 w-1 h-full bg-status-suspicious"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        ></motion.div>
        <div className="font-mono text-sm leading-8 relative z-10">
          <div className="text-slate-600 flex justify-between items-center mb-2">
            <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs">2</span> Distributor 1</span>
            <span className="text-status-active font-semibold bg-status-active-bg px-2 py-0.5 rounded-full text-xs">✓ Authorized</span>
          </div>
          <div className="text-status-suspicious font-semibold flex justify-between items-center">
            <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-status-suspicious-bg text-status-suspicious flex items-center justify-center text-xs">3</span> Unknown Party</span>
            <motion.span 
              className="bg-status-suspicious-bg px-2 py-0.5 rounded-full text-xs"
              animate={{ backgroundColor: ["#fff1f2", "#ffe4e6", "#fff1f2"] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              ✗ Unauthorized
            </motion.span>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2 font-sans">
            <motion.span 
              className="text-xs text-status-suspicious font-bold bg-status-suspicious-bg px-2 py-1 rounded inline-block w-max"
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            >
              Divergence point recorded on-chain
            </motion.span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-slate-500 font-medium">Batch Status:</span> 
              <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <StatusBadge status="Suspicious" />
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    ),
    flip: true,
  },
  {
    title: "Public batch verification",
    body: "Anyone can scan a QR code and instantly verify a batch's authenticity, status, and full provenance history — no login, no app required.",
    icon: <MagnifyingGlass className="text-primary-600 mb-4" size={32} weight="fill" />,
    panel: (
      <motion.div 
        className="panel bg-white/60 backdrop-blur-md text-center p-8 relative overflow-hidden"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <div className="inline-block p-4 border border-slate-200 rounded-xl bg-white shadow-sm mb-4 relative overflow-hidden">
          <div className="w-20 h-20 mx-auto opacity-80" style={{ background: "repeating-conic-gradient(#334155 0% 25%, transparent 0% 50%) 0 / 10px 10px" }} />
          {/* Laser scanning animation */}
          <motion.div 
            className="absolute left-0 right-0 h-0.5 bg-primary-500 shadow-[0_0_8px_2px_rgba(37,99,235,0.5)] z-10"
            animate={{ top: ["10%", "90%", "10%"] }}
            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          />
        </div>
        <div className="flex flex-col gap-1 items-center justify-center">
          <div className="text-sm font-medium text-slate-700">Scan QR Code</div>
          <div className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded">/verify/:id</div>
        </div>
      </motion.div>
    ),
  },
];

const STATS = [
  { num: "5", label: "Batches on-chain" },
  { num: "21", label: "Transactions recorded" },
  { num: "100%", label: "Divergence accuracy" },
];

export default function Landing() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  return (
    <motion.main 
      initial="hidden" 
      animate="show" 
      variants={container}
      className="relative overflow-hidden"
    >
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-400/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-status-active/10 rounded-full blur-[100px] -z-10 pointer-events-none" />
      
      {/* Hero */}
      <section className="relative z-10 pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <motion.div variants={item} className="flex-1 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-sm font-medium mb-6 border border-primary-100 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                </span>
                Blockchain Secured
              </div>
              <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight text-slate-900">
                Medicine supply chains <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-400">you can trust.</span>
              </h1>
              <p className="mt-6 text-xl text-slate-600 leading-relaxed">
                ChainTrace Health records every custody handoff on the blockchain and detects
                counterfeits at the exact moment they enter the supply chain.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link to="/verify/" className="btn btn-primary px-8 py-3 text-base" id="cta-verify">
                  Verify a Batch →
                </Link>
                <Link to="/dashboard/manufacturer" className="btn btn-outline px-8 py-3 text-base" id="cta-dashboard">
                  Enter Dashboard
                </Link>
              </div>
            </motion.div>
            
            <motion.div variants={item} className="flex-1 w-full relative flex items-center justify-center" style={{ perspective: '1000px' }}>
              <motion.div 
                className="bg-[#f3f4f6] rounded-full w-[100%] max-w-[500px] aspect-square relative flex items-center justify-center border border-white/60"
                animate={{ 
                  boxShadow: [
                    "15px 15px 40px rgba(160, 174, 192, 0.3), -15px -15px 40px rgba(255, 255, 255, 0.9), inset 5px 5px 10px rgba(255,255,255,0.5), inset -5px -5px 10px rgba(160,174,192,0.1)",
                    "25px 25px 60px rgba(160, 174, 192, 0.4), -25px -25px 60px rgba(255, 255, 255, 1), inset 5px 5px 10px rgba(255,255,255,0.7), inset -5px -5px 10px rgba(160,174,192,0.2)",
                    "15px 15px 40px rgba(160, 174, 192, 0.3), -15px -15px 40px rgba(255, 255, 255, 0.9), inset 5px 5px 10px rgba(255,255,255,0.5), inset -5px -5px 10px rgba(160,174,192,0.1)"
                  ] 
                }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              >
                {/* Inner ring to enhance the skeumorphic "donut" feel */}
                <div className="absolute inset-4 rounded-full border-[30px] border-[#f3f4f6] shadow-[inset_10px_10px_20px_rgba(160,174,192,0.2),inset_-10px_-10px_20px_rgba(255,255,255,0.8),10px_10px_20px_rgba(160,174,192,0.2),-10px_-10px_20px_rgba(255,255,255,0.8)] opacity-70 pointer-events-none"></div>
                
                {/* 3D Wrapper for Illustration & Shadow */}
                <motion.div 
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  animate={{ rotateX: [10, 15, 10], y: [-5, 5, -5] }}
                  transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                >
                  {/* Floating Shadow (squashed ellipse) */}
                  <motion.div 
                    className="absolute top-[65%] w-[60%] h-[15%] bg-slate-400/40 blur-xl rounded-[100%]"
                    animate={{ scale: [1, 0.9, 1], opacity: [0.6, 0.3, 0.6] }}
                    transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                  />
                  {/* Greatly enlarged image to fit the inner ring */}
                  <HeroIllustration className="w-[160%] h-auto relative z-10 transform scale-125" />
                </motion.div>
              </motion.div>
            </motion.div>
          </div>

          {/* Stats strip */}
          <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24">
            {STATS.map((s, i) => (
              <div key={s.label} className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary-500 transform origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-300"></div>
                <div className="text-4xl font-bold text-slate-900 tracking-tight">{s.num}</div>
                <div className="text-sm font-medium text-slate-500 mt-2">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Feature Alternating Rows */}
      <section className="py-20 md:py-32 bg-slate-50/50 border-y border-slate-100">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">End-to-end transparency</h2>
            <p className="text-lg text-slate-600">Built on modern blockchain technology to ensure cryptographic proof of every transaction in your supply chain.</p>
          </div>
          
          <div className="flex flex-col gap-24">
            {FEATURES.map((f, i) => (
              <motion.div variants={item} key={i} className={`flex flex-col md:flex-row gap-12 md:gap-20 items-center ${f.flip ? "md:flex-row-reverse" : ""}`}>
                <div className="flex-1">
                  {f.icon}
                  <h3 className="text-2xl md:text-3xl font-bold mb-4 text-slate-900">{f.title}</h3>
                  <p className="text-lg text-slate-600 leading-relaxed">{f.body}</p>
                </div>
                <div className="flex-1 w-full relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-100/50 to-transparent rounded-3xl transform -rotate-2 scale-105 -z-10"></div>
                  {f.panel}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Case Study */}
      <CaseStudy />
    </motion.main>
  );
}
