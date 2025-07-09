/**
 * @file js/db.js
 * @description Модуль для работы с IndexedDB. Предоставляет простой интерфейс
 * для открытия БД и выполнения CRUD-операций с очередью запросов на отправку.
 */
// js/db.js

const DB_NAME = 'pwa-upload-db';
const STORE_NAME = 'upload-requests';
const DB_VERSION = 1;

let db;

/**
 * Открывает (или создает) и возвращает экземпляр IndexedDB.
 * Реализует паттерн Singleton для предотвращения многократного открытия.
 * @returns {Promise<IDBDatabase>} Promise, который разрешается с экземпляром БД.
 */
function openDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject('Database error');
        };

        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
    });
}

/**
 * Сохраняет объект с данными запроса в хранилище.
 * @param {object} data - Данные для сохранения (например, { file: File, filename: 'name.jpg' }).
 * @returns {Promise<number>} Promise, который разрешается с ID сохраненной записи.
 */
async function saveRequest(data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(data);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => {
            console.error('Error saving request:', event.target.error);
            reject('Failed to save request');
        };
    });
}

/**
 * Получает все записи из хранилища.
 * @returns {Promise<Array<object>>} Promise, который разрешается с массивом всех запросов.
 */
async function getRequests() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => {
            console.error('Error getting requests:', event.target.error);
            reject('Failed to get requests');
        };
    });
}

/**
 * Удаляет запись из хранилища по ее ID.
 * @param {number} id - ID записи для удаления.
 * @returns {Promise<void>} Promise, который разрешается после успешного удаления.
 */
async function deleteRequest(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            console.error('Error deleting request:', event.target.error);
            reject('Failed to delete request');
        };
    });
}

/**
 * Обновляет запись в хранилище, добавляя информацию об ошибке.
 * @param {number} id - ID записи для обновления.
 * @param {string} errorMessage - Сообщение об ошибке.
 * @param {Date} timestamp - Время попытки отправки.
 * @returns {Promise<void>}
 */
async function updateRequestError(id, errorMessage, timestamp) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onerror = (event) => reject('Failed to get request to update');

        getRequest.onsuccess = () => {
            const requestData = getRequest.result;
            if (requestData) {
                requestData.lastAttempt = timestamp;
                requestData.error = errorMessage;
                const updateRequest = store.put(requestData);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = (event) => reject('Failed to update request');
            } else {
                reject('Request not found');
            }
        };
    });
}