import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Injected at build time so the same source deploys to a subpath on GitHub
  // Pages or to the root on Vercel.
  base: process.env.VITE_BASE ?? "/",
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        // The Stellar SDK dwarfs the app and changes far less often, so it
        // gets its own chunk and stays cached across deploys.
        manualChunks: (id) => (id.includes("@stellar/stellar-sdk") ? "stellar-sdk" : undefined),
      },
    },
    chunkSizeWarningLimit: 1_800,
  },
});
