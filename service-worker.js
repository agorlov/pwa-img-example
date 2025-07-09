/**
 * @file service-worker.js
 * @description Service Worker для PWA. Отвечает за кэширование оболочки приложения (app shell),
 * перехват сетевых запросов (для работы офлайн) и обработку фоновой синхронизации (background sync).
 */
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

/**
 * Событие 'install'.
 * Срабатывает при установке Service Worker. Кэширует основные файлы приложения (app shell).
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching app shell');
            return cache.addAll(FILES_TO_CACHE);
        })
    );
});

/**
 * Событие 'activate'.
 * Срабатывает при активации Service Worker. Удаляет старые кэши, чтобы избежать конфликтов.
 */
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

/**
 * Событие 'fetch'.
 * Перехватывает все сетевые запросы от клиента.
 * Отвечает из кэша, если ресурс там найден, иначе выполняет сетевой запрос.
 * Игнорирует запросы к API, чтобы всегда получать свежие данные.
 */
self.addEventListener('fetch', (event) => {
    // Мы не ��эшируем запросы к API, только статические ассеты
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


/**
 * Событие 'sync'.
 * Срабатывает, когда браузер восстанавливает соединение с сетью
 * и есть зарегистрированный тег для синхронизации.
 */
self.addEventListener('sync', (event) => {
    if (event.tag === SYNC_TAG) {
        console.log('Service Worker: Sync event triggered for', SYNC_TAG);
        event.waitUntil(sendQueuedRequests());
    }
});

/**
 * Отправляет все запросы из очереди IndexedDB на сервер.
 * После успешной отправки удаляет запрос из очереди и уведомляет клиентский UI.
 */
async function sendQueuedRequests() {
    try {
        const requests = await getRequests();
        if (requests.length === 0) {
            return;
        }

        console.log(`Found ${requests.length} requests to send.`);
        let hasSuccessfulUploads = false;

        // Helper function to send messages to all clients
        const postMessageToClients = async (message) => {
            const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
            clients.forEach(client => {
                client.postMessage(message);
            });
        };

        for (const request of requests) {
            const { id, file, filename } = request;
            
            const formData = new FormData();
            formData.append('file', file, filename);

            console.log(`Attempting to send file: ${filename}`);

            try {
                const response = await fetch('/api/upload.php', {
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    console.log(`File ${filename} sent successfully.`);
                    await deleteRequest(id);
                    console.log(`Request ${id} deleted from queue.`);
                    hasSuccessfulUploads = true;
                } else {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
                    const errorMessage = errorData.error || `Server responded with status ${response.status}`;
                    const lastAttempt = new Date();
                    console.error(`Failed to send ${filename}. Reason: ${errorMessage}`);
                    
                    // Обновляем запись в БД с информацией об ошибке
                    await updateRequestError(id, errorMessage, lastAttempt);
                    
                    // Отправляем сообщение об ошибке для немедленного обновления UI
                    await postMessageToClients({ 
                        type: 'SYNC_ERROR_UPDATE', 
                        id: id, 
                        error: errorMessage,
                        lastAttempt: lastAttempt.toISOString() 
                    });
                }
            } catch (error) {
                // Это ошибка сети, а не сервера. Просто логируем, браузер попробует снова.
                console.error(`Network error while trying to send ${filename}:`, error);
                // Мы не отправляем сообщение клиенту здесь, т.к. это не "фатальная" ошибка,
                // а временная проблема с сетью, которую sync manager обработает сам.
            }
        }
        
        console.log('Finished processing sync queue.');

        // Если была х��тя бы одна успешная загрузка, уведомляем UI для обновления
        if (hasSuccessfulUploads) {
            await postMessageToClients({ type: 'SYNC_COMPLETE' });
        }

    } catch (error) {
        console.error('Error during sync process:', error);
    }
}