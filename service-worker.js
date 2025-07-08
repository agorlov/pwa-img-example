// service-worker.js

// Импортируем скрипт для работы с IndexedDB
importScripts('js/db.js');

const CACHE_NAME = 'pwa-app-shell-v1';
const SYNC_TAG = 'upload-queue';

// Файлы, необходимые для работы приложения офлайн ("оболочка")
const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/js/app.js',
    '/js/db.js',
    '/manifest.webmanifest'
    // Если у вас есть иконка, добавьте ее сюда, например: '/assets/icon.png'
];

// --- Событие INSTALL: кэширование оболочки приложения ---
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching app shell');
            return cache.addAll(FILES_TO_CACHE);
        })
    );
});

// --- Событие ACTIVATE: очистка старых кэшей ---
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activated');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('Service Worker: Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

// --- Событие FETCH: отдача ресурсов из кэша или сети ---
self.addEventListener('fetch', (event) => {
    // Мы не кэшируем запросы к API, только статические ассеты
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            // Если ресурс есть в кэше, отдаем его
            if (response) {
                return response;
            }
            // Иначе, пытаемся загрузить из сети
            return fetch(event.request);
        })
    );
});


// --- Событие SYNC: фоновая отправка данных (остается без изменений) ---
self.addEventListener('sync', (event) => {
    if (event.tag === SYNC_TAG) {
        console.log('Service Worker: Sync event triggered for', SYNC_TAG);
        event.waitUntil(sendQueuedRequests());
    }
});

async function sendQueuedRequests() {
    try {
        const requests = await getRequests();
        if (requests.length === 0) {
            return;
        }

        console.log(`Found ${requests.length} requests to send.`);

        for (const request of requests) {
            const { id, file, filename } = request;
            
            const formData = new FormData();
            formData.append('file', file, filename);

            console.log(`Attempting to send file: ${filename}`);

            const response = await fetch('/api/upload.php', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                console.log(`File ${filename} sent successfully.`);
                await deleteRequest(id);
                console.log(`Request ${id} deleted from queue.`);
            } else {
                console.error(`Failed to send ${filename}. Server responded with:`, response.status);
            }
        }
        
        console.log('Finished processing sync queue.');

        // Отправляем сообщение всем клиентам (открытым вкладкам)
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        clients.forEach(client => {
            client.postMessage({ type: 'SYNC_COMPLETE' });
        });

    } catch (error) {
        console.error('Error during sync process:', error);
    }
}
