import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { defineConfig as defineVitestConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(
            __dirname,
            "../../node_modules/@ruffle-rs/ruffle/*",
          ),
          dest: "assets/ruffle",
        },
        {
          src: path.resolve(__dirname, "../../node_modules/ogv/dist/*"),
          dest: "assets/ogv",
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "pdfjs-dist"],
  },
  server: {
    port: 3000,
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
  ...defineVitestConfig({
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/setupTests.ts"],
      include: ["./src/**/*test.ts"],
    },
  }),
});
