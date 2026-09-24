import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

// In development the Go API runs on :8090; proxying keeps the browser on one origin, so
// the HttpOnly refresh cookie and WebSocket work exactly as behind nginx in production.
const api = process.env.API_ORIGIN ?? "http://localhost:8090";

// /ui is a dev-only route (routes.ts drops it in production), so its showcase-only classes must
// not reach the shipped stylesheet (~1 KB gzip of the core CSS). Runs before Tailwind's own
// "pre" transform, which reads the CSS source handed to it.
function dropShowcaseClasses(): Plugin {
  return {
    name: "jv:drop-showcase-classes",
    enforce: "pre",
    apply: () => process.env.NODE_ENV === "production",
    transform(code, id) {
      if (!/\/app\/styles\/app\.css(\?|$)/.test(id)) return;
      return code.replace('@import "tailwindcss";', '@import "tailwindcss";\n@source not "../routes/ui.tsx";');
    },
  };
}

export default defineConfig({
  plugins: [dropShowcaseClasses(), tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true },
  // Dependencies first imported by lazily loaded routes; pre-bundling them up front avoids
  // Vite's mid-session re-optimization (a full reload) in development.
  optimizeDeps: {
    include: [
      "@tanstack/react-query", "@radix-ui/react-dialog", "@radix-ui/react-checkbox", "@radix-ui/react-switch",
      "@radix-ui/react-radio-group", "@radix-ui/react-tabs", "motion/react",
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
