/**
 * @file js/app.js
 * @description Главный скрипт приложения. Управляет UI, взаимодействием с пользователем,
 * регистрацией Service Worker и обработкой статуса сети.
 */
// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    const statusIndicator = document.getElementById('status-indicator');
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');
    const queuedFileList = document.getElementById('queued-file-list');
    const serverFileList = document.getElementById('server-file-list');
    const refreshButton = document.getElementById('refresh-list');

    // --- Регистрация Service Worker ---
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
                // Слушаем сообщения от SW (например, об успешной синхронизации)
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data.type === 'SYNC_COMPLETE') {
                        console.log('UI: Received sync complete message. Refreshing lists.');
                        uploadStatus.textContent = 'Файлы из очереди были успешно синхронизированы.';
                        renderQueuedFiles();
                        fetchServerFiles();
                    }
                });
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    } else {
        console.warn('PWA features (Service Worker or Background Sync) are not supported.');
        uploadStatus.textContent = 'Фоновая синхронизация не поддерживается в вашем браузере.';
    }

    // --- Обработка отправки формы ---
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const file = fileInput.files[0];
        if (!file) {
            uploadStatus.textContent = 'Пожалуйста, выберите файл.';
            return;
        }

        // Пытаемся отправить напрямую, если есть сет��
        if (navigator.onLine) {
            try {
                await sendFileDirectly(file);
                uploadStatus.textContent = `Файл "${file.name}" успешно отправлен!`;
                await fetchServerFiles(); // Обновляем список
            } catch (error) {
                console.warn('Direct send failed, queuing for background sync.', error);
                await queueForSync(file);
                uploadStatus.textContent = `Нет сети. Файл "${file.name}" добавлен в очередь на отправку.`;
            }
        } else {
            // Если сразу офлайн, ставим в очередь
            await queueForSync(file);
            uploadStatus.textContent = `Вы офлайн. Файл "${file.name}" добавлен в очередь на отправку.`;
        }
        uploadForm.reset();
    });

    /**
     * Отправляет файл напрямую на сервер.
     * @param {File} file - Файл для отправки.
     * @returns {Promise<object>} - Promise, который разрешается с JSON-ответом сервера.
     * @throws {Error} - Если ответ сервера не 'ok'.
     */
    function sendFileDirectly(file) {
        const formData = new FormData();
        formData.append('file', file, file.name);
        return fetch('/api/upload.php', {
            method: 'POST',
            body: formData
        }).then(response => {
            if (!response.ok) {
                throw new Error('Server response not ok');
            }
            return response.json();
        });
    }

    /**
     * Сохраняет файл в IndexedDB для последующей фоновой отправки
     * и регистрирует задачу синхронизации.
     * @param {File} file - Файл для постановки в очередь.
     */
    async function queueForSync(file) {
        const request = {
            file: file,
            filename: file.name
        };
        await saveRequest(request);
        await renderQueuedFiles(); // Обновляем UI, чтобы показать файл в очереди
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('upload-queue');
        console.log('Request queued for sync.');
    }

    /**
     * Обновляет индикатор статуса сети (Онлайн/Офлайн).
     */
    function updateOnlineStatus() {
        const isOnline = navigator.onLine;
        statusIndicator.textContent = isOnline ? 'Онлайн' : 'Офлайн';
        statusIndicator.className = isOnline ? 'online' : 'offline';
    }

    /**
     * Получает список файлов из IndexedDB и отображает их в UI.
     * Для изображений создаются превью.
     */
    async function renderQueuedFiles() {
        try {
            const requests = await getRequests();
            queuedFileList.innerHTML = ''; // Очищаем список

            if (requests.length === 0) {
                queuedFileList.innerHTML = '<li>Очередь пуста.</li>';
                return;
            }

            requests.forEach(request => {
                const li = document.createElement('li');
                const span = document.createElement('span');
                span.textContent = request.filename;
                li.appendChild(span);

                // Если это изображение, создаем и добавляем превью
                if (request.file && request.file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(request.file);
                    img.className = 'preview-image';
                    img.onload = () => {
                        // Освобождаем память после загрузки изображения
                        URL.revokeObjectURL(img.src);
                    };
                    li.appendChild(img);
                }
                queuedFileList.appendChild(li);
            });
        } catch (error) {
            console.error('Could not render queued files:', error);
            queuedFileList.innerHTML = '<li>Не удалось отобразить очередь.</li>';
        }
    }

    /**
     * Запрашивает и отображает список файлов, уже загруженных на сервер.
     */
    async function fetchServerFiles() {
        try {
            const response = await fetch('/api/list.php');
            if (!response.ok) throw new Error('Failed to fetch');
            const files = await response.json();
            
            serverFileList.innerHTML = ''; // Очищаем список
            if (files.length === 0) {
                serverFileList.innerHTML = '<li>На сервере пока нет файлов.</li>';
            } else {
                files.forEach(file => {
                    const li = document.createElement('li');
                    li.textContent = file;
                    serverFileList.appendChild(li);
                });
            }
        } catch (error).
            console.error('Could not fetch file list:', error);
            serverFileList.innerHTML = '<li>Не удалось загрузить список файлов.</li>';
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    refreshButton.addEventListener('click', fetchServerFiles);

    // --- Инициализация ---
    updateOnlineStatus();
    renderQueuedFiles();
    fetchServerFiles();
});