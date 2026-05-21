import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  base: "/",
  server: {
    host: "::",
    port: 8081,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src-admin"),
    },
    // Запрет дублирования React — иначе @radix-ui тянет свою копию
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "dist",
  },
});
