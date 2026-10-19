<?php
/**
 * Flontmie Authorized Media Streaming Endpoint (HTTP 206 Range Support)
 * Streams locally stored audio and video media from Flontmie's private storage
 * without exposing server filesystem paths or external API credentials.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../media_engine.php';
require_once __DIR__ . '/../artist_enrichment.php';

$type = strtolower(trim($_GET['type'] ?? 'audio'));
$rawId = trim($_GET['id'] ?? '');
$scanFileId = trim($_GET['scan_file_id'] ?? '');
$pdo = Database::getConnection();

// --- Helper: Safely resolve relative file path within allowed roots ---
function resolveSafeServerFile(string $relPath): ?string {
    if (empty($relPath)) return null;

    $cleanRel = ltrim(str_replace('\\', '/', $relPath), '/');

    // Possible root anchors
    $anchors = [
        defined('STORAGE_ROOT') ? realpath(STORAGE_ROOT) : null,
        defined('UPLOAD_DIR') ? realpath(UPLOAD_DIR) : null,
        realpath(__DIR__ . '/..'),          // phpbackend dir
        realpath(__DIR__ . '/../..'),       // project root dir
        realpath(__DIR__ . '/../storage')   // storage dir
    ];
    $anchors = array_filter(array_unique($anchors));

    foreach ($anchors as $anchor) {
        // Try direct anchor + relative path
        $candidate = realpath($anchor . '/' . $cleanRel);
        if ($candidate && is_file($candidate) && filesize($candidate) > 256) {
            // Verify path traversal constraint: candidate must be within anchor
            if (strpos($candidate, $anchor) === 0) {
                return $candidate;
            }
        }

        // If relPath starts with phpbackend/ or storage/, try stripping prefix
        $stripped = preg_replace('#^(phpbackend/|storage/)+#', '', $cleanRel);
        $candidate2 = realpath($anchor . '/' . $stripped);
        if ($candidate2 && is_file($candidate2) && filesize($candidate2) > 256) {
            if (strpos($candidate2, $anchor) === 0) {
                return $candidate2;
            }
        }
    }

    return null;
}

// --- 0. ADMIN PREVIEW OF ANY SCANNED MEDIA FILE ---
if (!empty($scanFileId)) {
    $currentUser = Auth::getCurrentUser();
    // Allow admin preview or check if admin session/token exists
    if (!$currentUser || ($currentUser['role'] ?? '') !== 'admin') {
        // Also check if valid admin token in Authorization header or query param
        $token = $_GET['token'] ?? null;
        if ($token) {
            $userByToken = Auth::getUserFromToken($token);
            if (!$userByToken || ($userByToken['role'] ?? '') !== 'admin') {
                json_response(['status' => 'error', 'message' => 'Admin privileges required for media preview.'], 403);
            }
        } else {
            json_response(['status' => 'error', 'message' => 'Admin privileges required for media preview.'], 403);
        }
    }

    $fileStmt = $pdo->prepare("SELECT * FROM media_scan_files WHERE id = ?");
    $fileStmt->execute([$scanFileId]);
    $scanFile = $fileStmt->fetch();

    if (!$scanFile) {
        json_response(['status' => 'error', 'message' => 'Scanned media file not found.'], 404);
    }

    $fullMedia = resolveSafeServerFile($scanFile['file_path']);
    if (!$fullMedia || !is_file($fullMedia)) {
        json_response(['status' => 'error', 'message' => 'Media file missing on server storage.'], 404);
    }

    serveMediaStream($fullMedia);
    exit;
}

if (empty($rawId)) {
    json_response(['status' => 'error', 'message' => 'Media identifier is required.'], 400);
}

$safeId = MediaEngine::safeId($rawId);

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
    $fullArt = resolveSafeServerFile($relArt);

    if (empty($fullArt)) {
        $artRes = MediaEngine::acquireAndStoreArtwork($track['id'], $resolvedRemoteCover, $track['video_id'] ?? null);
        if (!empty($artRes['relative_path'])) {
            $pdo->prepare("UPDATE tracks SET local_artwork_path = ?, cover_art_url = ? WHERE id = ?")
                ->execute([$artRes['relative_path'], $resolvedRemoteCover, $track['id']]);
            $fullArt = resolveSafeServerFile($artRes['relative_path']);
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

// --- 2. VIDEO STREAM & VIDEO INFO ---
if ($type === 'video' || $type === 'video_info') {
    $relVideo = '';
    try {
        $vidStmt = $pdo->prepare("
            SELECT file_path FROM media_scan_files 
            WHERE (matched_track_id = ? OR matched_track_id = ?) AND is_video = 1 AND match_status = 'matched' 
            LIMIT 1
        ");
        $vidStmt->execute([$track['id'], $track['video_id'] ?? '']);
        $relVideo = $vidStmt->fetchColumn() ?: '';
    } catch (Throwable $e) {}

    if (empty($relVideo)) {
        $ext = strtolower(pathinfo($track['local_audio_path'] ?? '', PATHINFO_EXTENSION));
        if (in_array($ext, ['mp4', 'webm', 'mkv', 'm4v'], true)) {
            $relVideo = $track['local_audio_path'];
        }
    }

    $fullVideo = resolveSafeServerFile($relVideo);
    $hasLocalVideo = !empty($fullVideo) && is_file($fullVideo);

    if ($type === 'video_info') {
        json_response([
            'status'          => 'success',
            'track_id'        => $track['id'],
            'video_id'        => $track['video_id'],
            'has_local_video' => $hasLocalVideo,
            'has_video'       => $hasLocalVideo || !empty($track['video_id']),
            'video_url'       => $hasLocalVideo ? ('/phpbackend/api/stream.php?type=video&id=' . urlencode($track['id'])) : null
        ]);
    }

    if ($hasLocalVideo) {
        serveMediaStream($fullVideo);
        exit;
    }

    json_response(['status' => 'error', 'message' => 'No local video file available for this track.'], 404);
}

// --- 3. STREAM LOCAL AUDIO FILE (HTTP 206 PARTIAL CONTENT SUPPORT) ---
$relAudio = $track['local_audio_path'] ?? '';
$fullAudio = resolveSafeServerFile($relAudio);

// On-demand local audio acquisition if track doesn't have its local file cached yet
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

        $fullAudio = resolveSafeServerFile($audioRes['relative_path']);
    }
}

if (empty($fullAudio) || !is_file($fullAudio)) {
    json_response(['status' => 'error', 'message' => 'Audio stream file unavailable on server storage.'], 404);
}

serveMediaStream($fullAudio);

/**
 * Universal media streaming function supporting HTTP Range requests and seeking
 */
function serveMediaStream(string $filePath): void {
    $fileSize = filesize($filePath);
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

    $mimeMap = [
        'mp3'  => 'audio/mpeg',
        'm4a'  => 'audio/mp4',
        'aac'  => 'audio/aac',
        'wav'  => 'audio/wav',
        'ogg'  => 'audio/ogg',
        'opus' => 'audio/opus',
        'flac' => 'audio/flac',
        'webm' => 'video/webm',
        'mp4'  => 'video/mp4',
        'm4v'  => 'video/mp4',
        'mkv'  => 'video/x-matroska',
        'wma'  => 'audio/x-ms-wma',
        'aiff' => 'audio/x-aiff'
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

    $fp = fopen($filePath, 'rb');
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
}
