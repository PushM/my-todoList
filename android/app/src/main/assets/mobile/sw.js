const cacheName = "todo-mobile-v1";
const assets = [
  "/mobile/",
  "/mobile/index.html",
  "/mobile/styles.css",
  "/mobile/app.js",
  "/mobile/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request);
    })
  );
});
