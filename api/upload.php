<?php
// api/upload.php

require_once 'config.php';

header('Content-Type: application/json');

$requestMethod = $_SERVER['REQUEST_METHOD'];

// Этот скрипт должен отвечать только на POST-запросы
if ($requestMethod !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// --- Создаем папку для загрузок, если ее нет ---
if (!is_dir(UPLOAD_DIR)) {
    $created = mkdir(UPLOAD_DIR, 0777, true);
    if (!$created) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create upload directory.']);
        exit;
    }
}

// --- Обработка POST-запроса: загрузить файл ---
if (isset($_FILES['file'])) {
    $file = $_FILES['file'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'File upload error: ' . $file['error']]);
        exit;
    }

    // Используем оригинальное имя файла, очищенное от опасных символов
    $fileName = basename($file['name']);
    $destination = UPLOAD_DIR . $fileName;

    // Проверяем, чтобы не было попыток выйти из директории
    if (strpos($fileName, '..') !== false || strpos($fileName, '/') !== false || strpos($fileName, '\\') !== false) {
         http_response_code(400);
         echo json_encode(['error' => 'Invalid file name.']);
         exit;
    }

    $moved = move_uploaded_file($file['tmp_name'], $destination);
    if ($moved) {
        echo json_encode(['success' => true, 'message' => 'File uploaded successfully.', 'filename' => $fileName]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to move uploaded file.']);
    }
} else {
    http_response_code(400);
    echo json_encode(['error' => 'No file provided in the request.']);
}
