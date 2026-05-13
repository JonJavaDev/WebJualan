import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ["kedaichilioil.duckdns.org"],
    port: 5173,
    open: "/Main_Page.html",
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
