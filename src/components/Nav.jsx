import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { List, X } from "@phosphor-icons/react";

const NAV_LINKS = [
  { to: "/verify/", label: "Verify Batch" },
  { to: "/dashboard/manufacturer", label: "Manufacturer" },
  { to: "/dashboard/distributor", label: "Distributor" },
  { to: "/dashboard/pharmacy", label: "Pharmacy" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  function handleNav() { setOpen(false); }

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 font-heading text-lg font-bold tracking-tight text-slate-900" onClick={handleNav}>
          <svg viewBox="0 0 100 100" className="w-8 h-8 text-[#4a2b75]" fill="none" stroke="currentColor">
            <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" strokeWidth="5" strokeLinejoin="round" />
            <line x1="50" y1="4" x2="50" y2="18" strokeWidth="5" />
            <line x1="90" y1="27" x2="74" y2="36" strokeWidth="5" />
            <line x1="90" y1="73" x2="74" y2="64" strokeWidth="5" />
            <line x1="50" y1="96" x2="50" y2="82" strokeWidth="5" />
            <line x1="10" y1="73" x2="26" y2="64" strokeWidth="5" />
            <line x1="10" y1="27" x2="26" y2="36" strokeWidth="5" />

            <path d="M 65,30 A 24,24 0 1,0 65,70" strokeWidth="12" strokeLinecap="square" />
            <path d="M 52,42 L 52,58 M 44,50 L 60,50" strokeWidth="10" />
          </svg>
          <div>Chain<span className="text-primary-600">Trace</span> Health</div>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `text-[0.9375rem] font-medium transition-colors hover:text-primary-600 ${isActive ? "text-primary-600" : "text-slate-500"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-slate-900 p-1 hover:bg-slate-100 rounded-md transition-colors"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(o => !o)}
        >
          {open ? <X size={24} weight="regular" /> : <List size={24} weight="regular" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-slate-100 bg-white shadow-lg overflow-hidden absolute w-full"
          >
            <div className="flex flex-col px-6 py-4 gap-4">
              {NAV_LINKS.map(({ to, label }) => {
                const isActive = location.pathname.startsWith(to.split("/").slice(0, 3).join("/"));
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`text-base font-medium transition-colors ${isActive ? "text-primary-600" : "text-slate-600 hover:text-primary-600"}`}
                    onClick={handleNav}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
