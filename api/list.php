<?php
/**
 * @file api/list.php
 * @description API-endpoint для получения списка загруженных файлов.
 * Скрипт отвечает только на GET-запросы. Он сканирует директорию UPLOAD_DIR,
 * определенную в config.php, и возвращает JSON-массив с именами файлов.
 */

require_once 'config.php';

header('Content-Type: application/json');

$requestMethod = $_SERVER['REQUEST_METHOD'];

// Этот скрипт должен отвечать только на GET-запросы
if ($requestMethod !== 'GET') {
    http_response_code(405); // 405 Method Not Allowed
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// --- Создаем папку для загрузок, если ее нет (для надежности) ---
if (!is_dir(UPLOAD_DIR)) {
    // Пытаемся создать директорию рекурсивно
    $created = mkdir(UPLOAD_DIR, 0777, true);
    if (!$created) {
        http_response_code(500); // 500 Internal Server Error
        echo json_encode(['error' => 'Upload directory does not exist and could not be created.']);
        exit;
    }
}

// --- Отдаем список файлов ---
try {
    // scandir возвращает '.' и '..', которые являются ссылками на текущую и родительскую директории.
    // array_diff убирает их из массива.
    // array_values переиндексирует массив, чтобы он был корректным JSON-массивом.
    $files = array_values(array_diff(scandir(UPLOAD_DIR), ['.', '..']));
    echo json_encode($files);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Could not read directory contents.']);
}