
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },

  plugins: [
    mcpPlugin(),

    VitePWA({
      strategies: "generateSW",
      filename: "sw.js",
      outDir: "dist/client",
      manifest: false,
      injectRegister: null,
      registerType: "autoUpdate",
      devOptions: { enabled: false },

      workbox: {
        // Cache app interface files. Downloaded videos remain in IndexedDB.
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff,woff2}",
          "manifest.json",
        ],

        // Cache pages visited while online for offline reopening.
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/~oauth/],

        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin, url }) =>
              sameOrigin &&
              request.mode === "navigate" &&
              !url.pathname.startsWith("/~oauth"),

            handler: "NetworkFirst",
            options: {
              cacheName: "jk-app-pages",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              (url.pathname.startsWith("/icons/") ||
                url.pathname === "/manifest.json"),

            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "jk-identity",
            },
          },
        ],

        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
