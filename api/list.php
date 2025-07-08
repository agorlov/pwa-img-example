<?php
// api/list.php

require_once 'config.php';

header('Content-Type: application/json');

$requestMethod = $_SERVER['REQUEST_METHOD'];

// Этот скрипт должен отвечать только на GET-запросы
if ($requestMethod !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// --- Создаем папку для загрузок, если ее нет (на всякий случай) ---
if (!is_dir(UPLOAD_DIR)) {
    $created = mkdir(UPLOAD_DIR, 0777, true);
    if (!$created) {
        http_response_code(500);
        echo json_encode(['error' => 'Upload directory does not exist and could not be created.']);
        exit;
    }
}

// --- Отдаем список файлов ---
try {
    // scandir возвращает '.' и '..', отфильтровываем их
    $files = array_values(array_diff(scandir(UPLOAD_DIR), ['.', '..']));
    echo json_encode($files);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Could not read directory contents.']);
}
