const CACHE_NAME = 'geocarte-v7';

self.addEventListener('install', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    event.respondWith(fetch(event.request));
});
