import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileApiPlugin } from "./server/fileApi";

export default defineConfig(({ command }) => ({
  // A relative base keeps the built site working both at a domain root
  // (Vercel / Netlify) and under a sub-path (GitHub Pages /repo/).
  // The dev server still uses "/" so the local file API keeps working.
  base: command === "build" ? "./" : "/",
  plugins: [react(), tailwindcss(), fileApiPlugin()],
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 5173,
    host: true,
  },
}));
