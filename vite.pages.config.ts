import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const projectRoot = fileURLToPath(new URL("./", import.meta.url));
export default defineConfig(({ mode }) => {
  const publicEnv = loadEnv(mode, projectRoot, "VITE_");
  const apiBase = process.env.VITE_API_BASE_URL ?? publicEnv.VITE_API_BASE_URL ?? "";
  if (apiBase && (!/^https:\/\/[^/]+\/?$/.test(apiBase) || new URL(apiBase).username || new URL(apiBase).password))
    throw new Error("VITE_API_BASE_URL must be a public HTTPS API origin, never a key or credentials.");
  const path = process.env.GITHUB_PAGES_BASE_PATH ?? "/";
  const trimmedPath = path.replace(/^\/+|\/+$/g, "");
  const base = trimmedPath ? `/${trimmedPath}/` : "/";
  return {
    root: fileURLToPath(new URL("./github-pages", import.meta.url)), base,
    publicDir: fileURLToPath(new URL("./public", import.meta.url)),
    resolve: { alias: { "@": projectRoot } }, plugins: [react()],
    define: { __APP_BASE__: JSON.stringify(base), __MATCH_API_BASE__: JSON.stringify(apiBase) },
    build: { outDir: fileURLToPath(new URL("./pages-dist", import.meta.url)), emptyOutDir: true },
  };
});
