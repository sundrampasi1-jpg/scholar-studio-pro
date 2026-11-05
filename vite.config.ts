// @lovable.dev/vite-tanstack-config already includes the required framework plugins.
// Do not add duplicate TanStack, React, Tailwind or Nitro plugins.
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
        // Cache app code and interface assets, never lesson videos or private API data.
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff,woff2}",
          "manifest.json",
        ],

        // TanStack Start is server-rendered. Cache the actual visited app pages
        // so Profile can reopen offline after it has first been visited online.
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/~oauth/],

        runtimeCaching: [
          {
            urlPattern: ({ request, url, sameOrigin }) =>
              sameOrigin &&
              request.mode === "navigate" &&
              (url.pathname === "/" || url.pathname === "/profile"),

            handler: "NetworkFirst",
            options: {
              cacheName: "jk-app-pages",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 5,
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
