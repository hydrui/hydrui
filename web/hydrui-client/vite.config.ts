import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
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
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      includeAssets: ["icon.svg", "thirdparty.html"],
      manifest: {
        name: "Hydrui",
        short_name: "Hydrui",
        description: "A web client for Hydrus",
        theme_color: "#1e293b",
        icons: [
          {
            src: "icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        // There are some big Wasm files, but they compress nicely.
        // It is what it is.
        maximumFileSizeToCacheInBytes: 30 * 1024 ** 2,
      },
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
  worker: {
    format: "es",
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
