/* NarxRadar service worker: ilova internet yoʻq joyda ham ochiladi */
const V = "narxradar-v4";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./ref.json", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./fonts/golos-text-latin-wght-normal.woff2", "./fonts/geologica-latin-wght-normal.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== "GET" || u.pathname.includes("/api/") || u.pathname.includes("/ai/") || u.pathname.includes("/ota/")) return; /* server soʻrovlari keshlanmaydi */
  const put = res => { if (res && (res.ok || res.type === "opaque")) { const cp = res.clone(); caches.open(V).then(c => c.put(req, cp)); } return res; };
  if (req.mode === "navigate" || u.pathname.endsWith("ref.json")) {
    /* avval internet, boʻlmasa kesh */
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req).then(r => r || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(put)));
});
