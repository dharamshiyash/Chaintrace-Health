import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createApiApp } from "./apiApp.js";

function viteApiPlugin() {
  const app = createApiApp();
  return {
    name: "vite-api-plugin",
    configureServer(server) {
      // Mount Express API directly into Vite dev server
      server.middlewares.use(app);
    },
  };
}

export default defineConfig({
  plugins: [react(), viteApiPlugin()],
  server: {
    port: 5173,
  },
});
