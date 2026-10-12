<?php
/**
 * Flontmie API - Media Upload Service (Artwork & Audio Files)
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';

$user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['status' => 'error', 'message' => 'POST request expected'], 405);
}

if (empty($_FILES['file'])) {
    json_response(['status' => 'error', 'message' => 'No file uploaded in "file" form field.'], 400);
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    json_response(['status' => 'error', 'message' => 'Upload error code: ' . $file['error']], 400);
}

$type = $_POST['type'] ?? 'artwork'; // artwork or audio
$allowedExts = [
    'artwork' => ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    'audio'   => ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac']
];

$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$validList = $allowedExts[$type] ?? $allowedExts['artwork'];

if (!in_array($ext, $validList, true)) {
    json_response(['status' => 'error', 'message' => "Invalid file extension (.{$ext}). Allowed: " . implode(', ', $validList)], 400);
}

// Ensure target directory exists
$targetSubdir = ($type === 'audio') ? 'audio' : 'artwork';
$dir = UPLOAD_DIR . '/' . $targetSubdir;
if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
}

$newFilename = bin2hex(random_bytes(10)) . '.' . $ext;
$destination = $dir . '/' . $newFilename;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    json_response(['status' => 'error', 'message' => 'Failed to save uploaded file to storage.'], 500);
}

$fileUrl = UPLOAD_URL . '/' . $targetSubdir . '/' . $newFilename;

json_response([
    'status' => 'success',
    'message' => 'File uploaded successfully',
    'url' => $fileUrl,
    'original_name' => $file['name'],
    'size' => $file['size'],
    'type' => $type
], 201);
