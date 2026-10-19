<?php
/**
 * Flontmie API - Authorized Media Upload & Track Audio Sync Service
 * Validates and stores audio/artwork in private storage and optionally syncs directly to a catalog track.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../media_engine.php';

$user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['status' => 'error', 'message' => 'POST request expected'], 405);
}

Auth::verifyCsrf($user, $_POST);
MediaEngine::ensureStorageSecured();

if (empty($_FILES['file'])) {
    json_response(['status' => 'error', 'message' => 'No file uploaded in "file" form field.'], 400);
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    json_response(['status' => 'error', 'message' => 'Upload error code: ' . $file['error']], 400);
}

$type = ($_POST['type'] ?? 'audio') === 'artwork' ? 'artwork' : 'audio';
$trackId = trim($_POST['track_id'] ?? '');

$allowedExts = [
    'artwork' => ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    'audio'   => ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac', 'webm']
];

$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$validList = $allowedExts[$type];

if (!in_array($ext, $validList, true)) {
    json_response(['status' => 'error', 'message' => "Invalid file extension (.{$ext}). Allowed: " . implode(', ', $validList)], 400);
}

if ($file['size'] > 64 * 1024 * 1024) {
    json_response(['status' => 'error', 'message' => 'File exceeds maximum 64MB limit.'], 400);
}

$subDir = $type . '/' . date('Y') . '/' . date('m');
$fullDir = STORAGE_ROOT . '/' . $subDir;
if (!is_dir($fullDir)) {
    @mkdir($fullDir, 0755, true);
}

$safePrefix = !empty($trackId) ? MediaEngine::safeId($trackId) : ('upl_' . bin2hex(random_bytes(8)));
$newFilename = $safePrefix . '_' . substr(bin2hex(random_bytes(4)), 0, 6) . '.' . $ext;
$relPath = $subDir . '/' . $newFilename;
$destination = $fullDir . '/' . $newFilename;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    json_response(['status' => 'error', 'message' => 'Failed to save uploaded file to server storage.'], 500);
}

$fileSize = (int)filesize($destination);
$pdo = Database::getConnection();

// If track_id is provided, link the uploaded audio/artwork to that catalog track
$publicStreamUrl = "/phpbackend/api/stream.php?type={$type}&id=" . urlencode($safePrefix);
if (!empty($trackId)) {
    $safeTrackId = MediaEngine::safeId($trackId);
    if ($type === 'audio') {
        $publicStreamUrl = "/phpbackend/api/stream.php?id=" . urlencode($safeTrackId);
        $pdo->prepare("
            UPDATE tracks 
            SET local_audio_path = ?,
                audio_file_size = ?,
                audio_format = ?,
                audio_url = ?,
                import_status = 'uploaded',
                source_type = 'direct_upload',
                license_status = 'direct_upload',
                license_notes = 'Authorized audio file uploaded and synced to catalog track',
                last_synced_at = NOW()
            WHERE id = ?
        ")->execute([$relPath, $fileSize, $ext, $publicStreamUrl, $safeTrackId]);

        $pdo->prepare("
            INSERT INTO import_jobs (id, admin_user_id, item_type, source_id, title, status, progress_percent, track_id, local_audio_path, file_size_bytes, audio_source_method, license_status)
            VALUES (?, ?, 'song', ?, ?, 'completed', 100, ?, ?, ?, 'authorized_upload', 'direct_upload')
        ")->execute([
            'job_upl_' . bin2hex(random_bytes(5)),
            $user['id'],
            $safeTrackId,
            basename($file['name']),
            $safeTrackId,
            $relPath,
            $fileSize
        ]);
    } else {
        $publicStreamUrl = "/phpbackend/api/stream.php?type=artwork&id=" . urlencode($safeTrackId);
        $pdo->prepare("
            UPDATE tracks 
            SET local_artwork_path = ?, cover_art_url = ?, last_synced_at = NOW()
            WHERE id = ?
        ")->execute([$relPath, $publicStreamUrl, $safeTrackId]);
    }

    Auth::logAudit($user['id'], 'TRACK_MEDIA_UPLOADED', 'TRACK', $safeTrackId, [
        'type' => $type,
        'format' => $ext,
        'size_bytes' => $fileSize
    ]);
}

json_response([
    'status' => 'success',
    'message' => ucfirst($type) . ' file uploaded and synced to local storage successfully.',
    'url' => $publicStreamUrl,
    'track_id' => $trackId ?: null,
    'size' => $fileSize,
    'format' => $ext,
    'type' => $type
], 201);
