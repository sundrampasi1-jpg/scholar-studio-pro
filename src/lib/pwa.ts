/** Register only on the published, top-level app, never in editor previews. */
export async function registerAppWorker() {
  if (!("serviceWorker" in navigator)) return;
  const host = window.location.hostname;
  const previewDomains = ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"];
  const refused = !import.meta.env.PROD || window.self !== window.top ||
    host.startsWith("id-preview--") || host.startsWith("preview--") ||
    previewDomains.some((domain) => host === domain || host.endsWith(`.${domain}`)) ||
    new URLSearchParams(window.location.search).get("sw") === "off";

  if (refused) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter((registration) =>
      [registration.active, registration.waiting, registration.installing].some((worker) =>
        worker && new URL(worker.scriptURL).origin === window.location.origin &&
        new URL(worker.scriptURL).pathname === "/sw.js",
      ),
    ).map((registration) => registration.unregister()));
    return;
  }

  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await registration.update();
}