import "dotenv/config";
import express from "express";
import cors from "cors";

import batchesIndex   from "./api/batches/index.js";
import batchesById    from "./api/batches/[id].js";
import batchesRecall  from "./api/batches/recall.js";
import batchesEvents  from "./api/batches/events.js";
import batchesHistory from "./api/batches/history.js";
import verifyById     from "./api/verify/[id].js";
import eventsIndex    from "./api/events/index.js";
import offenders      from "./api/offenders/index.js";
import qrById         from "./api/qr/[id].js";

export function createApiApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  function withId(handler) {
    return (req, res) => {
      if (req.params?.id && !req.query?.id) {
        try {
          Object.defineProperty(req, "query", {
            value: { ...req.query, id: req.params.id },
            writable: true,
            configurable: true,
          });
        } catch {
          req._id = req.params.id;
        }
      }
      return handler(req, res);
    };
  }

  // Routes
  app.get("/api/batches",             batchesIndex);
  app.post("/api/batches",            batchesIndex);
  app.post("/api/batches/recall",     batchesRecall);
  app.post("/api/batches/events",     batchesEvents);
  app.get("/api/batches/:id/history", withId(batchesHistory));
  app.get("/api/batches/:id",         withId(batchesById));
  app.get("/api/verify/:id",          withId(verifyById));
  app.post("/api/events",             eventsIndex);
  app.get("/api/offenders",           offenders);
  app.get("/api/qr/:id",              withId(qrById));

  app.get("/api/health", (_, res) => res.json({
    ok: true,
    ts: Date.now(),
    network: process.env.HARDHAT_NETWORK || "amoy",
    rpc: process.env.HARDHAT_NETWORK === "localhost" ? "http://127.0.0.1:8545" : (process.env.AMOY_RPC_URL || "https://polygon-amoy.drpc.org"),
  }));

  return app;
}
