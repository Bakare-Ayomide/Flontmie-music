<?php
/**
 * Flontmie Authorized Media Streaming Endpoint (HTTP 206 Range Support)
 * Streams locally stored audio and artwork from Flontmie's private storage
 * without exposing server filesystem paths or external API credentials.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../media_engine.php';
require_once __DIR__ . '/../artist_enrichment.php';

$type = strtolower(trim($_GET['type'] ?? 'audio'));
$rawId = trim($_GET['id'] ?? '');
if (empty($rawId)) {
    json_response(['status' => 'error', 'message' => 'Media identifier is required.'], 400);
}

$safeId = MediaEngine::safeId($rawId);
$pdo = Database::getConnection();

// Lookup track in MySQL
$stmt = $pdo->prepare("
    SELECT id, video_id, title, artist_name, genre, country, cover_art_url, local_audio_path, local_artwork_path, audio_format, status, is_deleted
    FROM tracks
    WHERE id = ? OR video_id = ?
    LIMIT 1
");
$stmt->execute([$safeId, $safeId]);
$track = $stmt->fetch();

if (!$track || (int)($track['is_deleted'] ?? 0) === 1) {
    json_response(['status' => 'error', 'message' => 'Requested catalog media not found.'], 404);
}

// Enforce publication status for non-admins
$trackStatus = $track['status'] ?? 'published';
if ($trackStatus !== 'published') {
    $currentUser = Auth::getCurrentUser();
    if (!$currentUser || ($currentUser['role'] ?? '') !== 'admin') {
        json_response(['status' => 'error', 'message' => 'This track is currently unpublished or restricted.'], 403);
    }
}

// --- 1. SERVE LOCAL ARTWORK ---
if ($type === 'artwork') {
    $resolvedRemoteCover = ArtistEnrichment::resolveArtworkUrl($track['cover_art_url'] ?? '', $track['video_id'] ?? $track['id']);
    $relArt = $track['local_artwork_path'] ?? '';
    $fullArt = '';
    if (!empty($relArt)) {
        $candidate = realpath(STORAGE_ROOT . '/' . ltrim($relArt, '/'));
        $storageReal = realpath(STORAGE_ROOT);
        if ($candidate && $storageReal && strpos($candidate, $storageReal) === 0 && is_file($candidate) && filesize($candidate) > 512) {
            $fullArt = $candidate;
        }
    }

    if (empty($fullArt)) {
        $artRes = MediaEngine::acquireAndStoreArtwork($track['id'], $resolvedRemoteCover, $track['video_id'] ?? null);
        if (!empty($artRes['relative_path'])) {
            $pdo->prepare("UPDATE tracks SET local_artwork_path = ?, cover_art_url = ? WHERE id = ?")
                ->execute([$artRes['relative_path'], $resolvedRemoteCover, $track['id']]);
            $candidate = realpath(STORAGE_ROOT . '/' . ltrim($artRes['relative_path'], '/'));
            if ($candidate && is_file($candidate)) {
                $fullArt = $candidate;
            }
        }
    }

    if (!empty($fullArt) && is_file($fullArt)) {
        header('Content-Type: image/jpeg');
        header('Content-Length: ' . filesize($fullArt));
        header('Cache-Control: public, max-age=604800');
        readfile($fullArt);
        exit;
    }

    // Fallback redirect only if remote artwork URL is standard HTTPS image
    if (!empty($resolvedRemoteCover) && preg_match('/^https?:\/\//i', $resolvedRemoteCover)) {
        header('Location: ' . $resolvedRemoteCover, true, 302);
        exit;
    }
    http_response_code(404);
    exit;
}

// --- 2. STREAM LOCAL AUDIO FILE (HTTP 206 PARTIAL CONTENT SUPPORT) ---
$relAudio = $track['local_audio_path'] ?? '';
$fullAudio = '';

if (!empty($relAudio)) {
    // Prevent path traversal by verifying realpath is strictly inside STORAGE_ROOT or UPLOAD_DIR
    $candidate = realpath(STORAGE_ROOT . '/' . ltrim($relAudio, '/'));
    $storageReal = realpath(STORAGE_ROOT);
    if ($candidate && $storageReal && strpos($candidate, $storageReal) === 0 && is_file($candidate) && filesize($candidate) > 1024) {
        $fullAudio = $candidate;
    } elseif (defined('UPLOAD_DIR')) {
        $candidateUp = realpath(UPLOAD_DIR . '/' . ltrim($relAudio, '/'));
        $uploadReal = realpath(UPLOAD_DIR);
        if ($candidateUp && $uploadReal && strpos($candidateUp, $uploadReal) === 0 && is_file($candidateUp)) {
            $fullAudio = $candidateUp;
        }
    }
}

// On-demand local audio acquisition if track doesn't have its local audio file cached yet
if (empty($fullAudio)) {
    $audioRes = MediaEngine::acquireAndStoreAudio(
        $track['id'],
        $track['video_id'] ?? null,
        $track['title'] ?? 'Track',
        $track['artist_name'] ?? 'Artist',
        $track['genre'] ?? 'Pop',
        $track['country'] ?? 'US'
    );

    if (!empty($audioRes['relative_path'])) {
        $streamUrl = "/phpbackend/api/stream.php?id=" . urlencode($track['id']);
        $pdo->prepare("
            UPDATE tracks 
            SET local_audio_path = ?, audio_file_size = ?, audio_format = ?, audio_url = ?, import_status = 'synced', last_synced_at = NOW()
            WHERE id = ?
        ")->execute([
            $audioRes['relative_path'],
            $audioRes['file_size'],
            $audioRes['format'],
            $streamUrl,
            $track['id']
        ]);

        $candidate = realpath(STORAGE_ROOT . '/' . ltrim($audioRes['relative_path'], '/'));
        if ($candidate && is_file($candidate)) {
            $fullAudio = $candidate;
        }
    }
}

if (empty($fullAudio) || !is_file($fullAudio)) {
    json_response(['status' => 'error', 'message' => 'Audio stream file unavailable on server storage.'], 404);
}

$fileSize = filesize($fullAudio);
$ext = strtolower(pathinfo($fullAudio, PATHINFO_EXTENSION));
$mimeMap = [
    'mp3'  => 'audio/mpeg',
    'm4a'  => 'audio/mp4',
    'aac'  => 'audio/aac',
    'wav'  => 'audio/wav',
    'ogg'  => 'audio/ogg',
    'flac' => 'audio/flac',
    'webm' => 'audio/webm'
];
$contentType = $mimeMap[$ext] ?? 'audio/mp4';

$start = 0;
$end = $fileSize - 1;
$length = $fileSize;

header("Content-Type: {$contentType}");
header('Accept-Ranges: bytes');
header('Cache-Control: public, max-age=86400');
header('X-Content-Type-Options: nosniff');

if (!empty($_SERVER['HTTP_RANGE'])) {
    if (preg_match('/bytes=(\d*)-(\d*)/i', $_SERVER['HTTP_RANGE'], $matches)) {
        $rangeStart = $matches[1];
        $rangeEnd = $matches[2];

        if ($rangeStart !== '') {
            $start = (int)$rangeStart;
        }
        if ($rangeEnd !== '') {
            $end = min($fileSize - 1, (int)$rangeEnd);
        }

        if ($start > $end || $start >= $fileSize) {
            header("Content-Range: bytes */{$fileSize}");
            http_response_code(416);
            exit;
        }

        $length = ($end - $start) + 1;
        http_response_code(206);
        header("Content-Range: bytes {$start}-{$end}/{$fileSize}");
    }
} else {
    http_response_code(200);
}

header("Content-Length: {$length}");

$fp = fopen($fullAudio, 'rb');
if ($fp) {
    if ($start > 0) {
        fseek($fp, $start);
    }
    $bytesRemaining = $length;
    $chunkSize = 65536;
    while (!feof($fp) && $bytesRemaining > 0 && connection_status() === 0) {
        $readLen = min($chunkSize, $bytesRemaining);
        $buffer = fread($fp, $readLen);
        if ($buffer === false) break;
        echo $buffer;
        flush();
        $bytesRemaining -= strlen($buffer);
    }
    fclose($fp);
}
exit;
