const CACHE = 'geocarte-v13';

const PRECACHE_FILES = [
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

function generateTileUrls() {
    const urls = [];
    for (let z = 0; z <= 4; z++) {
        const max = Math.pow(2, z);
        for (let x = 0; x < max; x++) {
            for (let y = 0; y < max; y++) {
                urls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
            }
        }
    }
    return urls;
}

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE).then(cache => {
            return cache.addAll(PRECACHE_FILES).then(() => {
                const tileUrls = generateTileUrls();
                return Promise.allSettled(
                    tileUrls.map(url =>
                        fetch(url).then(r => {
                            if (r.ok) return cache.put(url, r);
                        }).catch(() => {})
                    )
                );
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    if (url.includes('tile.openstreetmap.org') || url.includes('arcgisonline.com') || url.includes('basemaps.cartocdn.com')) {
        event.respondWith(
            caches.open(CACHE).then(cache =>
                cache.match(event.request).then(cached => {
                    if (cached) return cached;
                    return fetch(event.request).then(response => {
                        if (response.ok) cache.put(event.request, response.clone());
                        return response;
                    }).catch(() => new Response('', { status: 503, statusText: 'Offline' }));
                })
            )
        );
        return;
    }

    if (url.includes('nominatim.openstreetmap.org')) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response(JSON.stringify([{ display_name: 'Recherche hors ligne non disponible' }]), {
                    headers: { 'Content-Type': 'application/json' }
                })
            )
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});
