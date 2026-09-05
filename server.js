// Local Express API server — mirrors the Vercel serverless routes for local dev
// Run with: node server.js  (separate terminal alongside npm run dev)

import "dotenv/config";
import express from "express";
import cors from "cors";

// ── Route handlers (same files Vercel uses) ───────────────────────────────
import batchesIndex  from "./api/batches/index.js";
import batchesById   from "./api/batches/[id].js";
import verifyById    from "./api/verify/[id].js";
import eventsIndex   from "./api/events/index.js";
import offenders     from "./api/offenders/index.js";
import qrById        from "./api/qr/[id].js";

const app  = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Helper: ensure handlers can read the :id param regardless of how Vercel vs Express delivers it.
// Vercel delivers dynamic segment as req.query.id; Express delivers it as req.params.id.
// We normalise by adding req.query.id = req.params.id using Object.defineProperty to bypass Express 5 immutability.
function withId(handler) {
  return (req, res) => {
    if (req.params.id && !req.query.id) {
      // Express 5 makes req.query a getter — patch via the underlying object
      try {
        Object.defineProperty(req, 'query', {
          value: { ...req.query, id: req.params.id },
          writable: true, configurable: true,
        });
      } catch {
        req._id = req.params.id; // fallback
      }
    }
    return handler(req, res);
  };
}

// ── Routes ────────────────────────────────────────────────────────────────
app.get("/api/batches",         batchesIndex);
app.get("/api/batches/:id",     withId(batchesById));
app.get("/api/verify/:id",      withId(verifyById));
app.post("/api/events",         eventsIndex);
app.get("/api/offenders",       offenders);
app.get("/api/qr/:id",          withId(qrById));

// Health check
app.get("/api/health", (_, res) => res.json({
  ok: true,
  ts: Date.now(),
  network: process.env.HARDHAT_NETWORK,
  rpc: process.env.HARDHAT_NETWORK === "localhost" ? "http://127.0.0.1:8545" : process.env.AMOY_RPC_URL,
}));

app.listen(PORT, () => {
  console.log(`\n🟢  Local API server running at http://localhost:${PORT}`);
  console.log(`    Network: ${process.env.HARDHAT_NETWORK || "localhost"}`);
  console.log(`    Proxied via Vite  /api/* → http://localhost:${PORT}/api/*\n`);
});
