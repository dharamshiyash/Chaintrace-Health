import React from 'react';
import { motion } from 'framer-motion';

export default function HeroIllustration({ className = "" }) {
  // Floating animation for inner groups
  const floatAnimation = (delay) => ({
    y: [0, -10, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut",
      delay: delay
    }
  });

  const packetAnimation = (startX, startY, endX, endY, delay) => ({
    initial: { cx: startX, cy: startY, opacity: 0 },
    animate: {
      cx: [startX, endX],
      cy: [startY, endY],
      opacity: [0, 1, 1, 0],
      transition: {
        duration: 2.5,
        repeat: Infinity,
        ease: "linear",
        delay: delay,
        times: [0, 0.2, 0.8, 1]
      }
    }
  });

  const drawPath = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { 
      pathLength: 1, 
      opacity: 1, 
      transition: { duration: 2, ease: "easeInOut" } 
    },
    show: { 
      pathLength: 1, 
      opacity: 1, 
      transition: { duration: 2, ease: "easeInOut" } 
    }
  };

  return (
    <svg 
      className={className} 
      viewBox="0 0 800 600" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="line-gradient" x1="0" y1="0" x2="800" y2="600" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" stopOpacity="0.8" />
          <stop offset="1" stopColor="#2563eb" stopOpacity="0.2" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="strong-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Abstract Background Glow */}
      <motion.circle 
        cx="400" cy="300" r="160" 
        fill="#2563eb" 
        filter="url(#glow)"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: [0.03, 0.08, 0.03], scale: [1, 1.05, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Isometric Grid Base (Solid Lines, PathLength Animation OK) */}
      <g stroke="#2563eb" strokeWidth="1" strokeOpacity="0.15" fill="none">
        <motion.path d="M400 150 L650 275 L400 400 L150 275 Z" initial="hidden" animate="visible" variants={drawPath} />
        <motion.path d="M400 200 L600 300 L400 400 L200 300 Z" initial="hidden" animate="visible" variants={drawPath} />
        <motion.path d="M400 250 L550 325 L400 400 L250 325 Z" initial="hidden" animate="visible" variants={drawPath} />
        <motion.path d="M300 225 L500 325 M500 225 L300 325" initial="hidden" animate="visible" variants={drawPath} />
      </g>

      {/* Connection Lines (Dashed, No PathLength Animation to preserve dasharray) */}
      <motion.g 
        stroke="url(#line-gradient)" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeDasharray="6 8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.5 }}
      >
        <path d="M250 250 L400 175" />
        <path d="M550 250 L400 175" />
        <path d="M250 250 L400 425" />
        <path d="M550 250 L400 425" />
        <path d="M250 250 L250 350" />
        <path d="M550 250 L550 350" />
        <path d="M400 175 L400 425" />
      </motion.g>

      {/* Animated Data Packets Trailing Along Lines */}
      {/* Packets to Database */}
      <motion.circle r="4" fill="#2563eb" filter="url(#strong-glow)" {...packetAnimation(250, 250, 400, 425, 0)} />
      <motion.circle r="4" fill="#2563eb" filter="url(#strong-glow)" {...packetAnimation(550, 250, 400, 425, 1.25)} />
      
      {/* Packets to Top Node */}
      <motion.circle r="4" fill="#10b981" filter="url(#strong-glow)" {...packetAnimation(250, 250, 400, 175, 0.5)} />
      <motion.circle r="4" fill="#10b981" filter="url(#strong-glow)" {...packetAnimation(550, 250, 400, 175, 1.75)} />

      {/* Floating Nodes */}
      {/* We use a static native SVG <g> for translation, and an inner <motion.g> for the floating y-axis animation. 
          This prevents Framer Motion from overwriting or losing the base X/Y offsets. */}
      
      {/* Node 1: Left (Manufacturer) */}
      <g transform="translate(250, 250)">
        <motion.g animate={floatAnimation(0)}>
          <path d="M0 -30 L40 -10 L40 30 L0 50 L-40 30 L-40 -10 Z" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
          <path d="M0 -30 L0 10 M-40 -10 L0 10 M40 -10 L0 10" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.4" />
          <path d="M0 10 L0 50" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.4" />
          <circle cx="0" cy="-30" r="6" fill="#2563eb" filter="url(#strong-glow)" />
          <text x="0" y="25" textAnchor="middle" fill="#2563eb" fontSize="12" fontWeight="bold" fontFamily="monospace" opacity="0.6">MFG</text>
        </motion.g>
      </g>

      {/* Node 2: Top (Distributor) */}
      <g transform="translate(400, 175)">
        <motion.g animate={floatAnimation(1)}>
          <path d="M0 -30 L40 -10 L40 30 L0 50 L-40 30 L-40 -10 Z" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
          <path d="M0 -30 L0 10 M-40 -10 L0 10 M40 -10 L0 10" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.4" />
          <path d="M0 10 L0 50" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.4" />
          <circle cx="0" cy="-30" r="6" fill="#2563eb" filter="url(#strong-glow)" />
          <text x="0" y="25" textAnchor="middle" fill="#2563eb" fontSize="12" fontWeight="bold" fontFamily="monospace" opacity="0.6">DST</text>
        </motion.g>
      </g>

      {/* Node 3: Right (Pharmacy) */}
      <g transform="translate(550, 250)">
        <motion.g animate={floatAnimation(2)}>
          <path d="M0 -30 L40 -10 L40 30 L0 50 L-40 30 L-40 -10 Z" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
          <path d="M0 -30 L0 10 M-40 -10 L0 10 M40 -10 L0 10" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.4" />
          <path d="M0 10 L0 50" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.4" />
          <circle cx="0" cy="-30" r="6" fill="#2563eb" filter="url(#strong-glow)" />
          <text x="0" y="25" textAnchor="middle" fill="#2563eb" fontSize="12" fontWeight="bold" fontFamily="monospace" opacity="0.6">PHM</text>
        </motion.g>
      </g>

      {/* Bottom Node: Blockchain Ledger */}
      <g transform="translate(400, 425)">
        <motion.g animate={floatAnimation(0.5)}>
          <rect x="-40" y="-22" width="80" height="44" rx="10" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
          
          {/* Animated Data Rows */}
          <motion.rect x="-26" y="-8" width="20" height="4" rx="2" fill="#2563eb" fillOpacity="0.5" 
            animate={{ width: [20, 30, 20] }} transition={{ duration: 3, repeat: Infinity }} 
          />
          <motion.rect x="-26" y="4" width="40" height="4" rx="2" fill="#2563eb" fillOpacity="0.5" 
            animate={{ width: [40, 25, 40] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }} 
          />
          <motion.rect x="-26" y="16" width="30" height="4" rx="2" fill="#2563eb" fillOpacity="0.5" 
            animate={{ width: [30, 45, 30] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }} 
          />
          
          {/* Status Indicator */}
          <circle cx="-30" cy="-15" r="3" fill="#10b981">
            <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
          </circle>
        </motion.g>
      </g>

    </svg>
  );
}
