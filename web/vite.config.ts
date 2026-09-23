import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// In development the Go API runs on :8090; proxying keeps the browser on one origin, so
// the HttpOnly refresh cookie and WebSocket work exactly as behind nginx in production.
const api = process.env.API_ORIGIN ?? "http://localhost:8090";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true },
  // Dependencies first imported by lazily loaded routes; pre-bundling them up front avoids
  // Vite's mid-session re-optimization (a full reload) in development.
  optimizeDeps: {
    include: [
      "@tanstack/react-query", "@radix-ui/react-dialog", "@radix-ui/react-checkbox", "@radix-ui/react-switch",
      "@radix-ui/react-radio-group", "@radix-ui/react-tabs", "@radix-ui/react-tooltip", "motion/react",
    ],
  },
  server: {
    port: 5180,
    strictPort: true, // 5173 is often taken by other local projects
    proxy: {
      "/api": { target: api, changeOrigin: false, ws: true },
    },
  },
});
