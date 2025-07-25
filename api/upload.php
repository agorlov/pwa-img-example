<?php
/**
 * @file api/upload.php
 * @description API-endpoint для загрузки файлов.
 * Скрипт отвечает только на POST-запросы, содержащие файл в поле 'file'.
 * Он сохраняет загруженный файл в директорию UPLOAD_DIR и возвращает JSON-ответ
 * со статусом операции.
 */

require_once 'config.php';

header('Content-Type: application/json');

$requestMethod = $_SERVER['REQUEST_METHOD'];

// Этот скрипт должен отвечать только на POST-запросы
if ($requestMethod !== 'POST') {
    http_response_code(405); // 405 Method Not Allowed
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// --- Создаем папку для загрузок, если ее нет ---
if (!is_dir(UPLOAD_DIR)) {
    $created = mkdir(UPLOAD_DIR, 0777, true);
    if (!$created) {
        http_response_code(500); // 500 Internal Server Error
        echo json_encode(['error' => 'Failed to create upload directory.']);
        exit;
    }
}

// --- Обработка POST-запроса: загрузить файл ---
if (isset($_FILES['file'])) {
    $file = $_FILES['file'];

    // Проверяем на наличие ошибок при загрузке
    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400); // 400 Bad Request
        echo json_encode(['error' => getUploadErrorMessage($file['error'])]);
        exit;
    }

    // Используем оригинальное имя файла, очищенное от пути (для безопасности)
    $fileName = basename($file['name']);
    $destination = UPLOAD_DIR . $fileName;

    // Дополнительная проверка безопасности: убеждаемся, что имя файла не содержит
    // символов, которые могли бы позволить выйти за пределы целевой директории.
    if (strpos($fileName, '..') !== false || strpos($fileName, '/') !== false || strpos($fileName, '\'') !== false) {
         http_response_code(400);
         echo json_encode(['error' => 'Invalid file name.']);
         exit;
    }

    // Перемещаем файл из временной директории в постоянную
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

/**
 * Преобразует код ошибки загрузки файла PHP в человекочитаемое сообщение.
 * @param int $errorCode Код ошибки из $_FILES['file']['error'].
 * @return string Понятное сообщение об ошибке.
 */
function getUploadErrorMessage($errorCode) {
    switch ($errorCode) {
        case UPLOAD_ERR_INI_SIZE:
            return 'Размер файла превышает лимит, установленный на сервере.';
        case UPLOAD_ERR_FORM_SIZE:
            return 'Размер файла превышает лимит, указанный в HTML-форме.';
        case UPLOAD_ERR_PARTIAL:
            return 'Файл был загружен только частично.';
        case UPLOAD_ERR_NO_FILE:
            return 'Файл не был загружен.';
        case UPLOAD_ERR_NO_TMP_DIR:
            return 'Отсутствует временная папка для загрузки.';
        case UPLOAD_ERR_CANT_WRITE:
            return 'Не удалось записать файл на диск.';
        case UPLOAD_ERR_EXTENSION:
            return 'PHP-расширение остановило загрузку файла.';
        default:
            return 'Произошла неизвестная ошибка при загрузке.';
    }
}