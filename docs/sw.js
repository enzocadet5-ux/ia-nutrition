// Garde l'appli disponible hors connexion (le scan, lui, a besoin d'internet)
const CACHE = "ian-v3";
const FICHIERS = ["./", "index.html", "app.js", "engine.js", "config.js", "manifest.webmanifest", "icone.svg", "icone-180.png", "icone-192.png", "icone-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // réseau d'abord (mises à jour), cache si hors ligne
  e.respondWith(fetch(e.request).then((r) => { const copie = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copie)); return r; }).catch(() => caches.match(e.request)));
});
