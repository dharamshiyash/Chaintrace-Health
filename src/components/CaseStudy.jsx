import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, WarningCircle, CheckCircle } from "@phosphor-icons/react";

export default function CaseStudy() {
  // State for divergence diagram
  const [isDiverged, setIsDiverged] = useState(false);
  // State for impact slider
  const [adoptionRate, setAdoptionRate] = useState(10);

  return (
    <section className="py-24 bg-white border-t border-slate-200 text-slate-900 font-sans">
      <div className="container mx-auto px-6 max-w-5xl">

        {/* Section Title */}
        <div className="mb-20 text-center">
          <div className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-widest mb-6">
            Product Case Study
          </div>
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-6 leading-tight">
            The mathematical imperative for<br />automated supply chain verification.
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Why cryptographic claims outscale manual enforcement in emerging pharmaceutical markets.
          </p>
        </div>

        {/* 1. THE PROBLEM */}
        <div className="mb-24">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8 border-b border-slate-200 pb-2">1. The Problem</h3>
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1 w-full">
              <div className="text-sm text-slate-500 mb-2 font-medium">Global Counterfeit Drug Market (Annual USD)</div>
              <div className="relative h-8 bg-slate-100 w-full mb-2 flex items-center">
                {/* Visualizing range 0 to $500B */}
                {/* Low estimate $75B (15%), High estimate $432B (86%) */}
                <div className="absolute left-[15%] right-[14%] h-full bg-fuchsia-700/20 border-y border-fuchsia-700"></div>
                <div className="absolute left-[15%] w-0.5 h-10 -top-1 bg-fuchsia-700"></div>
                <div className="absolute right-[14%] w-0.5 h-10 -top-1 bg-fuchsia-700"></div>

                <div className="absolute left-0 bottom-10 text-xs font-mono text-slate-400">$0</div>
                <div className="absolute left-[15%] top-10 -translate-x-1/2 text-sm font-mono font-bold text-fuchsia-800">$75B</div>
                <div className="absolute right-[14%] top-10 -translate-x-1/2 text-sm font-mono font-bold text-fuchsia-800">$432B</div>
                <div className="absolute right-0 bottom-10 text-xs font-mono text-slate-400">$500B+</div>
              </div>
              <div className="text-xs text-slate-400 mt-10 italic">Estimates vary wildly by methodology, underscoring systemic opacity.</div>
            </div>
            <div className="flex-1 md:border-l border-slate-200 md:pl-8">
              <div className="text-2xl font-serif font-bold text-slate-900 mb-2">
                "1 in 10 medical products in emerging markets is substandard or falsified."
              </div>
              <div className="text-lg text-fuchsia-700 font-medium mb-4">
                Rising to up to 30% in some regions.
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Source: WHO, IBA</div>
            </div>
          </div>
        </div>

        {/* 2. WHY NOW */}
        <div className="mb-24">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8 border-b border-slate-200 pb-2">2. Why Now (India Focus)</h3>

          <div className="relative pt-12 pb-8">
            <div className="absolute top-16 left-0 w-full h-0.5 bg-slate-200"></div>
            <div className="flex justify-between relative z-10 gap-4">

              <div className="group relative flex flex-col items-center flex-1">
                <div className="w-3 h-3 bg-slate-400 group-hover:bg-fuchsia-700 transition-colors mb-4"></div>
                <div className="text-sm font-mono font-bold text-slate-900 mb-1">2011</div>
                <div className="text-xs text-slate-500 text-center opacity-0 group-hover:opacity-100 transition-opacity absolute top-12 w-40">
                  DAVA portal introduced for export tracking.
                </div>
              </div>

              <div className="group relative flex flex-col items-center flex-1">
                <div className="w-3 h-3 bg-slate-400 group-hover:bg-fuchsia-700 transition-colors mb-4"></div>
                <div className="text-sm font-mono font-bold text-slate-900 mb-1">2019</div>
                <div className="text-xs text-slate-500 text-center opacity-0 group-hover:opacity-100 transition-opacity absolute top-12 w-40">
                  Active Pharmaceutical Ingredient (API) QR mandate.
                </div>
              </div>

              <div className="group relative flex flex-col items-center flex-1">
                <div className="w-3 h-3 bg-slate-400 group-hover:bg-fuchsia-700 transition-colors mb-4"></div>
                <div className="text-sm font-mono font-bold text-slate-900 mb-1">2022</div>
                <div className="text-xs text-slate-500 text-center opacity-0 group-hover:opacity-100 transition-opacity absolute top-12 w-40">
                  Schedule H2 QR rule for Top 300 selling brands.
                </div>
              </div>

              <div className="group relative flex flex-col items-center flex-1">
                <motion.div
                  className="w-4 h-4 bg-fuchsia-700 mb-3 -mt-0.5 outline outline-4 outline-white shadow-md relative z-10"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                >
                  <motion.div
                    className="absolute inset-0 bg-fuchsia-500 -z-10"
                    animate={{ scale: [1, 2.5, 3], opacity: [0.8, 0, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                  />
                </motion.div>
                <div className="text-sm font-mono font-bold text-fuchsia-700 mb-1">June 2026</div>
                <div className="text-xs text-slate-800 font-medium text-center absolute top-12 w-48">
                  Schedule H2 expanded to vaccines, antimicrobials, anti-cancer drugs, and narcotics.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 p-6 border-l-4 border-fuchsia-700 bg-slate-50 max-w-2xl">
            <p className="text-lg font-medium text-slate-900">
              No central verification portal exists behind this mandate — the QR code proves a claim, not a verified handoff.
            </p>
          </div>
        </div>

        {/* 3. SCALE OF THE ENFORCEMENT GAP */}
        <div className="mb-24">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8 border-b border-slate-200 pb-2">3. Scale of the Enforcement Gap</h3>
          <div className="flex flex-col md:flex-row gap-8 md:items-end mb-8">
            <div className="w-full md:w-32 flex-shrink-0 flex flex-col gap-2">
              <div className="text-sm font-bold text-slate-900">~2,000</div>
              <div className="text-xs text-slate-500 leading-tight">Regulatory Officials (CDSCO + State)</div>
              <div className="h-4 bg-emerald-500 w-2 md:w-full"></div>
            </div>

            <div className="w-full flex flex-col gap-2" style={{ flexGrow: 0.1 }}>
              <div className="text-sm font-bold text-slate-900">10,000+</div>
              <div className="text-xs text-slate-500 leading-tight">Manufacturing Facilities</div>
              <div className="h-4 bg-amber-500 w-16 md:w-full"></div>
            </div>

            <div className="w-full flex flex-col gap-2" style={{ flexGrow: 10 }}>
              <div className="text-sm font-bold text-slate-900">1,000,000+</div>
              <div className="text-xs text-slate-500 leading-tight">Retail Pharmacies</div>
              <div className="h-4 bg-red-500 w-full"></div>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Physical inspection cannot scale to this ratio. Automated, cryptographic verification at the point of handoff is required.
          </p>
        </div>

        {/* 4. COMPETITIVE LANDSCAPE */}
        <div className="mb-24">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8 border-b border-slate-200 pb-2">4. Competitive Landscape</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b-2 border-slate-900 text-sm font-bold text-slate-900">
                  <th className="py-4 pl-0 pr-4"></th>
                  <th className="py-4 px-4 w-1/4">MediLedger</th>
                  <th className="py-4 px-4 w-1/4">Schedule H2 Mandate</th>
                  <th className="py-4 pl-4 pr-0 w-1/4 text-fuchsia-700">ChainTrace Health</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-200">
                <tr className="group hover:bg-slate-50 transition-colors">
                  <td className="py-5 pl-0 pr-4 font-semibold text-slate-700">Network Type</td>
                  <td className="py-5 px-4 text-slate-600">Permissioned consortium</td>
                  <td className="py-5 px-4 text-slate-600">Labeling only (QR)</td>
                  <td className="py-5 pl-4 pr-0 font-medium text-slate-900 border-l border-slate-200/50 bg-white group-hover:bg-white">Public testnet demo</td>
                </tr>
                <tr className="group hover:bg-slate-50 transition-colors">
                  <td className="py-5 pl-0 pr-4 font-semibold text-slate-700">Participant Base</td>
                  <td className="py-5 px-4 text-slate-600">Tier-1 Enterprises (Pfizer, McKesson)</td>
                  <td className="py-5 px-4 text-slate-600">Any manufacturer, no verification</td>
                  <td className="py-5 pl-4 pr-0 font-medium text-slate-900 border-l border-slate-200/50 bg-white group-hover:bg-white">Any manufacturer, whitelist-based</td>
                </tr>
                <tr className="group hover:bg-slate-50 transition-colors">
                  <td className="py-5 pl-0 pr-4 font-semibold text-slate-700">Core Function</td>
                  <td className="py-5 px-4 text-emerald-600 font-medium flex items-center gap-1.5"><CheckCircle weight="fill" /> Verifies Custody</td>
                  <td className="py-5 px-4 text-amber-600 font-medium flex items-center gap-1.5"><WarningCircle weight="fill" /> Claims Only</td>
                  <td className="py-5 pl-4 pr-0 text-emerald-600 font-medium flex items-center gap-1.5 border-l border-slate-200/50 bg-white group-hover:bg-white"><CheckCircle weight="fill" /> Verifies Custody</td>
                </tr>
                <tr className="group hover:bg-slate-50 transition-colors">
                  <td className="py-5 pl-0 pr-4 font-semibold text-slate-700">Scale Proven</td>
                  <td className="py-5 px-4 text-slate-600">1.6B+ txs, 1,275 distributors</td>
                  <td className="py-5 px-4 text-slate-600">National mandate, no ledger</td>
                  <td className="py-5 pl-4 pr-0 font-medium text-slate-900 border-l border-slate-200/50 bg-white group-hover:bg-white">MVP, Testnet</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-6 text-sm text-slate-600 max-w-3xl">
            <p>
              <strong>What this implies:</strong> While enterprise solutions like MediLedger are robust, they are expensive and permissioned—accessible only to massive Tier-1 pharma companies. Conversely, government mandates like Schedule H2 simply require a QR code label, which can be easily duplicated by counterfeiters since there is no underlying ledger to verify the chain of custody. This MVP demonstrates a middle ground: bringing the cryptographic security of a blockchain ledger to the fragmented emerging market using accessible, lightweight web tools, ensuring even small-scale manufacturers and pharmacies can participate in zero-trust traceability.
            </p>
          </div>
        </div>

        {/* 5. HOW IT WORKS */}
        <div className="mb-24">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8 border-b border-slate-200 pb-2">5. How It Works (Divergence Detection)</h3>

          <div className="bg-slate-50 border border-slate-200 p-8 flex flex-col items-center">

            <div className="flex flex-row items-center justify-between w-full max-w-3xl mb-12 relative">

              {/* Manufacturer */}
              <div className="flex flex-col items-center gap-2 z-10 bg-slate-50 px-2 flex-shrink-0">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-white border-2 border-slate-900 flex items-center justify-center font-mono font-bold text-slate-900 text-sm md:text-base">MFG</div>
                <div className="text-[10px] md:text-xs font-bold text-emerald-600">Authorized</div>
              </div>

              {/* Link 1 */}
              <div className="flex-1 h-0.5 bg-slate-900 mx-1 md:mx-2 -mt-5 md:-mt-6"></div>

              {/* Distributor */}
              <div className="flex flex-col items-center gap-2 z-10 bg-slate-50 px-2 flex-shrink-0">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-white border-2 border-slate-900 flex items-center justify-center font-mono font-bold text-slate-900 text-sm md:text-base">DST</div>
                <div className="text-[10px] md:text-xs font-bold text-emerald-600">Authorized</div>
              </div>

              {/* Link 2 (Animated) */}
              <div className="flex-1 h-8 mx-1 md:mx-2 -mt-5 md:-mt-6 relative flex items-center justify-center">
                {/* Left side of the breaking line */}
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-900 origin-left"
                  initial={{ width: "100%", backgroundColor: "#0f172a" }}
                  animate={{
                    width: isDiverged ? "40%" : "100%",
                    backgroundColor: isDiverged ? "#dc2626" : "#0f172a"
                  }}
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                />
                {/* Right side of the breaking line */}
                <motion.div
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-900 origin-right"
                  initial={{ width: "0%", backgroundColor: "#0f172a" }}
                  animate={{
                    width: isDiverged ? "40%" : "0%",
                    backgroundColor: isDiverged ? "#dc2626" : "#0f172a"
                  }}
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                />

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                  <AnimatePresence>
                    {isDiverged && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        transition={{ type: "spring", bounce: 0.6, delay: 0.1 }}
                        className="text-red-600 bg-slate-50 rounded-full p-1 flex items-center justify-center"
                      >
                        <WarningCircle size={24} weight="fill" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Pharmacy */}
              <div className="flex flex-col items-center gap-2 z-10 bg-slate-50 px-2 flex-shrink-0">
                <motion.div
                  className={`w-10 h-10 md:w-12 md:h-12 bg-white border-2 flex items-center justify-center font-mono font-bold transition-colors text-sm md:text-base ${isDiverged ? 'border-red-600 text-red-600 shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'border-slate-900 text-slate-900'}`}
                  animate={isDiverged ? { x: [0, -4, 4, -4, 4, 0] } : { x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  PHM
                </motion.div>
                <div className={`text-[10px] md:text-xs font-bold transition-colors ${isDiverged ? 'text-red-600' : 'text-emerald-600'}`}>
                  {isDiverged ? 'Suspicious' : 'Authorized'}
                </div>
              </div>

            </div>

            <AnimatePresence>
              {isDiverged && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: "spring", bounce: 0.4, delay: 0.3 }}
                  className="mb-8 text-center"
                >
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-50 text-red-700 text-xs font-bold uppercase tracking-widest border border-red-200 rounded-full shadow-sm">
                    <WarningCircle size={16} weight="bold" /> Divergence point recorded on-chain
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setIsDiverged(!isDiverged)}
              className="px-6 py-2.5 border-2 border-slate-900 text-slate-900 font-bold hover:bg-slate-900 hover:text-white transition-colors"
            >
              {isDiverged ? "Reset Handoff" : "Inject Unauthorized Handoff"}
            </button>

          </div>
        </div>

        {/* 6. MODELING THE IMPACT */}
        <div className="mb-24">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8 border-b border-slate-200 pb-2">6. Modeling The Impact</h3>

          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1 w-full flex flex-col">
              <div className="text-sm font-bold text-slate-900 mb-6">Network Verification Scaling Model</div>

              <div className="relative h-48 w-full border-l border-b border-slate-300 mb-8">
                {/* Y Axis Labels */}
                <div className="absolute -left-12 bottom-0 text-[10px] text-slate-400">0</div>
                <div className="absolute -left-12 top-0 text-[10px] text-slate-400">High</div>
                <div className="absolute -left-14 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Capacity / Cost</div>

                {/* X Axis Labels */}
                <div className="absolute left-0 -bottom-6 text-[10px] text-slate-400">0%</div>
                <div className="absolute right-0 -bottom-6 text-[10px] text-slate-400">100% Adoption</div>

                {/* Fixed line: Manual Inspection Capacity */}
                <div className="absolute left-0 right-0 bottom-8 h-px bg-slate-400 border-b border-dashed border-slate-400"></div>
                <div className="absolute left-2 bottom-9 text-[10px] text-slate-500">Fixed Manual Inspection Capacity (~2,000 officials)</div>

                {/* Flat line: Marginal Cost of Crypto Verification */}
                <div className="absolute left-0 right-0 bottom-2 h-0.5 bg-fuchsia-700"></div>
                <div className="absolute left-2 bottom-3 text-[10px] text-fuchsia-700 font-bold">Marginal Cost of Automated Auth Check</div>

                {/* Dynamic Filled Area showing Network Volume handled for free */}
                <div 
                  className="absolute bottom-2 h-16 transition-all duration-75"
                  style={{ left: '0', width: `${adoptionRate}%` }}
                >
                  <div className="absolute inset-0 bg-fuchsia-700/10 overflow-hidden border-t border-fuchsia-700/20">
                    <div className="w-full h-full bg-gradient-to-t from-fuchsia-700/40 to-transparent"></div>
                  </div>
                  <div className="absolute -top-6 right-2 text-[10px] font-bold text-fuchsia-800 opacity-50 whitespace-nowrap">
                    Volume Verified
                  </div>
                </div>

                {/* Slider Indicator Line */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-slate-900 transition-all duration-75"
                  style={{ left: `${adoptionRate}%` }}
                >
                  <div className="absolute -top-3 -translate-x-1/2 w-2 h-2 bg-slate-900 transform rotate-45"></div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-500">0%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={adoptionRate}
                  onChange={(e) => setAdoptionRate(e.target.value)}
                  className="flex-1 h-1 bg-slate-200 appearance-none cursor-pointer accent-slate-900"
                />
                <span className="text-xs font-bold text-slate-500">100%</span>
              </div>
            </div>

            <div className="flex-1 w-full bg-slate-50 p-6 border border-slate-200">
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                As network adoption scales (currently modeled at <strong>{adoptionRate}%</strong> ), the marginal cost of verifying each custody handoff remains mathematically flat near zero.
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">
                Physical enforcement cannot scale horizontally. A decentralized ledger allows compliance verification to scale infinitely without increasing human headcount.
              </p>
              <div className="mt-6 text-[10px] text-slate-400 uppercase tracking-widest">
                * Illustrative model. Not a prediction of adoption or revenue.
              </div>
            </div>
          </div>
        </div>

        {/* 7. THE ROLE OF THIS MVP */}
        <div className="mb-24">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8 border-b border-slate-200 pb-2">7. The Role of This MVP</h3>
          <div className="bg-slate-50 border border-slate-200 p-8">
            <h4 className="text-xl font-serif font-bold text-slate-900 mb-4">Bridging the Gap in Emerging Markets</h4>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed max-w-4xl">
              While massive, permissioned enterprise solutions like MediLedger represent the gold standard for pharma traceability, they are fundamentally inaccessible to the long tail of manufacturers and pharmacies in emerging markets. Their high costs and complex integrations exclude the very actors where counterfeit prevalence is highest.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed max-w-4xl">
              The intention behind this MVP is to demonstrate a highly accessible, lightweight alternative. By leveraging public blockchains and simple web interfaces, we can bring enterprise-grade, zero-trust verification to the fragmented edges of the global supply chain, democratizing patient safety without requiring massive IT budgets.
            </p>
          </div>
        </div>

        {/* 8. HONEST LIMITATIONS */}
        <div className="mb-24 border-l border-slate-300 pl-6 py-2">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3">8. Honest Limitations</h4>
          <p className="text-sm text-slate-500 mb-3 leading-relaxed max-w-3xl">
            This demonstration runs on a public testnet (Polygon Amoy). Enterprise production deployments (like MediLedger) utilize permissioned consortium networks to obscure trade secrets while preserving zero-knowledge verification.
          </p>
          <p className="text-sm text-slate-500 leading-relaxed max-w-3xl">
            The explicit whitelist model used here is a simplification. Real-world distributor relationships are highly dynamic, requiring complex identity management (e.g., decentralized identifiers or verifiable credentials) to manage authorizations at scale. This project does not claim strict regulatory compliance with US DSCSA or India Schedule H2.
          </p>
        </div>

        {/* Citations */}
        <div className="border-t border-slate-200 pt-8 flex flex-col gap-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sources & References</div>
          <a href="#" className="text-xs text-slate-500 hover:text-slate-900 transition-colors">1. World Health Organization (WHO) — Substandard and falsified medical products (2017)</a>
          <a href="#" className="text-xs text-slate-500 hover:text-slate-900 transition-colors">2. Ministry of Health and Family Welfare, Govt. of India — Schedule H2 Notification</a>
          <a href="#" className="text-xs text-slate-500 hover:text-slate-900 transition-colors">3. MediLedger Network — Public scale reporting</a>
        </div>

      </div>
    </section>
  );
}
