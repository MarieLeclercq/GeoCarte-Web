const CACHE = 'geocarte-v8';

const PRECACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/style-v3.css',
    './css/editor-v3.css',
    './css/components-v3.css',
    './js/app-v3.js',
    './js/editor-v3.js',
    './js/storage-v3.js',
    './lib/leaflet.js',
    './lib/leaflet.css',
    './lib/images/marker-icon.png',
    './lib/images/marker-icon-2x.png',
    './lib/images/marker-shadow.png',
    './lib/images/layers.png',
    './lib/images/layers-2x.png',
    './img/icon-192.png',
    './img/icon-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    if (url.includes('tile.openstreetmap.org') || url.includes('arcgisonline.com') || url.includes('basemaps.cartocdn.com') || url.includes('nominatim.openstreetmap.org')) {
        event.respondWith(
            caches.open('geocarte-tiles').then(cache =>
                cache.match(event.request).then(cached => {
                    if (cached) return cached;
                    return fetch(event.request).then(response => {
                        if (response.ok) cache.put(event.request, response.clone());
                        return response;
                    }).catch(() => new Response('', { status: 503 }));
                })
            )
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});
