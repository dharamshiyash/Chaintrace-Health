// Local Express API server — mirrors the Vercel serverless routes for local dev
// Run with: node server.js  (or simply use npm run dev, which includes the API)

import "dotenv/config";
import { createApiApp } from "./apiApp.js";

const app = createApiApp();
const PORT = process.env.API_PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n🟢  Local API server running at http://localhost:${PORT}`);
  console.log(`    Network: ${process.env.HARDHAT_NETWORK || "amoy"}`);
  console.log(`    Endpoints available at http://localhost:${PORT}/api/*\n`);
});
