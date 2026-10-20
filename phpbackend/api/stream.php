<?php
/**
 * Flontmie API - Authorized Local Media & Artwork Streaming Endpoint
 * Serves audio, video, and artwork files directly from Flontmie's cPanel storage
 * with full HTTP 206 Partial Content byte-range support.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../media_engine.php';

$type = $_GET['type'] ?? 'audio';
$trackId = trim($_GET['id'] ?? '');
$scanFileId = trim($_GET['scan_file_id'] ?? '');

if (empty($trackId) && empty($scanFileId)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['status' => 'error', 'message' => 'Missing media id or scan_file_id']);
    exit;
}

$pdo = Database::getConnection();
MediaEngine::ensureStorageSecured();

function serveBinaryWithRange(string $filePath, string $mimeType, string $downloadName): void {
    if (!is_file($filePath) || !is_readable($filePath)) {
        http_response_code(404);
        exit;
    }

    $size = (int)filesize($filePath);
    $start = 0;
    $end = $size - 1;
    $length = $size;

    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, HEAD, OPTIONS");
    header("Access-Control-Allow-Headers: Range, Authorization, Content-Type");
    header("Accept-Ranges: bytes");
    header("Content-Type: {$mimeType}");
    header('Content-Disposition: inline; filename="' . addslashes($downloadName) . '"');
    header("Cache-Control: public, max-age=86400");

    if (isset($_SERVER['HTTP_RANGE']) && preg_match('/bytes=(\d*)-(\d*)/i', $_SERVER['HTTP_RANGE'], $matches)) {
        $rangeStart = $matches[1] !== '' ? (int)$matches[1] : 0;
        $rangeEnd = $matches[2] !== '' ? (int)$matches[2] : $end;

        if ($rangeStart >= 0 && $rangeStart <= $end && $rangeEnd >= $rangeStart) {
            $start = $rangeStart;
            $end = min($end, $rangeEnd);
            $length = $end - $start + 1;
            http_response_code(206);
            header("Content-Range: bytes {$start}-{$end}/{$size}");
        }
    } else {
        http_response_code(200);
    }

    header("Content-Length: {$length}");

    if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
        exit;
    }

    $fp = fopen($filePath, 'rb');
    if ($fp) {
        if ($start > 0) {
            fseek($fp, $start);
        }
        $remaining = $length;
        $chunkSize = 65536;
        while (!feof($fp) && $remaining > 0) {
            $read = min($chunkSize, $remaining);
            $buffer = fread($fp, $read);
            if ($buffer === false) break;
            echo $buffer;
            flush();
            $remaining -= strlen($buffer);
        }
        fclose($fp);
    }
    exit;
}

function resolveMimeType(string $ext): string {
    $map = [
        'm4a'  => 'audio/mp4',
        'aac'  => 'audio/aac',
        'mp3'  => 'audio/mpeg',
        'wav'  => 'audio/wav',
        'flac' => 'audio/flac',
        'ogg'  => 'audio/ogg',
        'opus' => 'audio/opus',
        'webm' => 'audio/webm',
        'mp4'  => 'video/mp4',
        'm4v'  => 'video/mp4',
        'mov'  => 'video/quicktime',
        'mkv'  => 'video/x-matroska',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'webp' => 'image/webp'
    ];
    return $map[strtolower($ext)] ?? 'application/octet-stream';
}

// --- 0. STREAM SCANNED MEDIA FILE BY ID ---
if (!empty($scanFileId)) {
    $stmtScan = $pdo->prepare("SELECT * FROM media_scan_files WHERE id = ? LIMIT 1");
    $stmtScan->execute([$scanFileId]);
    $scanFile = $stmtScan->fetch();

    if (!$scanFile) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['status' => 'error', 'message' => 'Scanned media file not found']);
        exit;
    }

    $projectRoot = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
    $relPath = ltrim($scanFile['file_path'], '/');
    $candidates = [
        $projectRoot . '/' . $relPath,
        dirname(__DIR__) . '/' . $relPath,
        STORAGE_ROOT . '/' . $relPath
    ];

    foreach ($candidates as $cand) {
        if (is_file($cand) && is_readable($cand)) {
            $ext = strtolower(pathinfo($cand, PATHINFO_EXTENSION));
            serveBinaryWithRange($cand, resolveMimeType($ext), basename($cand));
        }
    }

    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['status' => 'error', 'message' => 'Media file not found on disk']);
    exit;
}

// --- 1. SERVE ARTWORK ---
if ($type === 'artwork') {
    $stmt = $pdo->prepare("SELECT id, video_id, cover_art_url, local_artwork_path FROM tracks WHERE id = ? OR video_id = ? LIMIT 1");
    $stmt->execute([$trackId, $trackId]);
    $track = $stmt->fetch();

    if ($track && !empty($track['local_artwork_path'])) {
        $fullArtPath = STORAGE_ROOT . '/' . ltrim($track['local_artwork_path'], '/');
        if (is_file($fullArtPath)) {
            $ext = strtolower(pathinfo($fullArtPath, PATHINFO_EXTENSION));
            serveBinaryWithRange($fullArtPath, resolveMimeType($ext), basename($fullArtPath));
        }
    }

    if ($track) {
        $artRes = MediaEngine::acquireAndStoreArtwork($track['id'], $track['cover_art_url'], $track['video_id']);
        if (!empty($artRes['relative_path'])) {
            $pdo->prepare("UPDATE tracks SET local_artwork_path = ? WHERE id = ?")->execute([$artRes['relative_path'], $track['id']]);
            $fullArtPath = STORAGE_ROOT . '/' . ltrim($artRes['relative_path'], '/');
            if (is_file($fullArtPath)) {
                $ext = strtolower(pathinfo($fullArtPath, PATHINFO_EXTENSION));
                serveBinaryWithRange($fullArtPath, resolveMimeType($ext), basename($fullArtPath));
            }
        }
        if (!empty($track['cover_art_url']) && preg_match('/^https?:\/\//i', $track['cover_art_url'])) {
            header("Location: " . $track['cover_art_url'], true, 302);
            exit;
        }
    }

    http_response_code(404);
    exit;
}

// --- 2. SERVE VIDEO STREAM ---
if ($type === 'video') {
    $stmt = $pdo->prepare("SELECT id, local_video_path, local_audio_path FROM tracks WHERE (id = ? OR video_id = ?) AND is_deleted = 0 LIMIT 1");
    $stmt->execute([$trackId, $trackId]);
    $track = $stmt->fetch();

    if ($track) {
        $vidPath = $track['local_video_path'] ?: $track['local_audio_path'];
        if (!empty($vidPath)) {
            $projectRoot = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
            $rel = ltrim($vidPath, '/');
            $candidates = [
                STORAGE_ROOT . '/' . $rel,
                $projectRoot . '/' . $rel,
                dirname(__DIR__) . '/' . $rel
            ];
            foreach ($candidates as $cand) {
                if (is_file($cand) && is_readable($cand)) {
                    $ext = strtolower(pathinfo($cand, PATHINFO_EXTENSION));
                    serveBinaryWithRange($cand, resolveMimeType($ext), basename($cand));
                }
            }
        }
    }
    http_response_code(404);
    exit;
}

// --- 3. SERVE AUDIO STREAM ---
$cleanVid = preg_replace('/^(trk_yt_|yt_)/', '', $trackId);
$stmt = $pdo->prepare("
    SELECT id, video_id, title, artist_name, genre, country, cover_art_url, local_audio_path, audio_format, status 
    FROM tracks 
    WHERE (id = ? OR video_id = ? OR video_id = ?) AND is_deleted = 0 
    LIMIT 1
");
$stmt->execute([$trackId, $trackId, $cleanVid]);
$track = $stmt->fetch();

if (!$track) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['status' => 'error', 'message' => 'Track not found in catalog']);
    exit;
}

if (!isset($_SERVER['HTTP_RANGE']) || strpos($_SERVER['HTTP_RANGE'], 'bytes=0-') === 0) {
    try {
        $pdo->prepare("UPDATE tracks SET stream_count = stream_count + 1, flontmie_plays = COALESCE(flontmie_plays, 0) + 1 WHERE id = ?")->execute([$track['id']]);
    } catch (Exception $e) {}
}

if (!empty($track['local_audio_path'])) {
    $projectRoot = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
    $rel = ltrim($track['local_audio_path'], '/');
    $candidates = [
        STORAGE_ROOT . '/' . $rel,
        $projectRoot . '/' . $rel,
        dirname(__DIR__) . '/' . $rel
    ];
    foreach ($candidates as $fullAudioPath) {
        if (is_file($fullAudioPath) && filesize($fullAudioPath) > 1024) {
            $ext = strtolower(pathinfo($fullAudioPath, PATHINFO_EXTENSION));
            serveBinaryWithRange($fullAudioPath, resolveMimeType($ext), basename($fullAudioPath));
        }
    }
}

try {
    $scanMatchStmt = $pdo->prepare("SELECT file_path FROM media_scan_files WHERE matched_track_id = ? AND match_status = 'matched' LIMIT 1");
    $scanMatchStmt->execute([$track['id']]);
    $scanRow = $scanMatchStmt->fetch();
    if ($scanRow && !empty($scanRow['file_path'])) {
        $projectRoot = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
        $rel = ltrim($scanRow['file_path'], '/');
        foreach ([$projectRoot . '/' . $rel, STORAGE_ROOT . '/' . $rel, dirname(__DIR__) . '/' . $rel] as $candPath) {
            if (is_file($candPath) && filesize($candPath) > 1024) {
                $ext = strtolower(pathinfo($candPath, PATHINFO_EXTENSION));
                $pdo->prepare("UPDATE tracks SET local_audio_path = ?, audio_format = ? WHERE id = ?")->execute([$rel, $ext, $track['id']]);
                serveBinaryWithRange($candPath, resolveMimeType($ext), basename($candPath));
            }
        }
    }
} catch (Exception $e) {}

$audioRes = MediaEngine::acquireAndStoreAudio(
    $track['id'],
    $track['video_id'],
    $track['title'],
    $track['artist_name'],
    $track['genre'] ?: 'Pop',
    $track['country'] ?: 'US'
);

if (!empty($audioRes['relative_path'])) {
    $pdo->prepare("
        UPDATE tracks 
        SET local_audio_path = ?, audio_file_size = ?, audio_format = ?, import_status = 'synced', last_synced_at = NOW() 
        WHERE id = ?
    ")->execute([
        $audioRes['relative_path'],
        $audioRes['file_size'],
        $audioRes['format'],
        $track['id']
    ]);

    $fullAudioPath = STORAGE_ROOT . '/' . ltrim($audioRes['relative_path'], '/');
    if (is_file($fullAudioPath)) {
        $ext = strtolower(pathinfo($fullAudioPath, PATHINFO_EXTENSION));
        serveBinaryWithRange($fullAudioPath, resolveMimeType($ext), basename($fullAudioPath));
    }
}

http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['status' => 'error', 'message' => 'Audio stream unavailable']);
exit;
