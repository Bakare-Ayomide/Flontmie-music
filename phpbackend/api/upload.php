<?php
/**
 * Flontmie API - Multipart Media File Upload Handler (Audio, Artwork, Video & Lyrics)
 * Enforces role permissions, distributor/label/artist scoping, file format & size validation,
 * and connects uploaded files to real MySQL database records.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../media_engine.php';

$user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['status' => 'error', 'message' => 'POST multipart/form-data required'], 405);
}

$pdo = Database::getConnection();
MediaEngine::ensureStorageSecured();

// Enforce role-level upload permissions on backend
if ($user['role'] !== 'admin') {
    try {
        $rpStmt = $pdo->prepare("SELECT can_direct_upload FROM role_permissions WHERE role = ? LIMIT 1");
        $rpStmt->execute([$user['role']]);
        $rp = $rpStmt->fetch();
        if ($rp && (int)$rp['can_direct_upload'] === 0) {
            json_response(['status' => 'error', 'message' => 'Direct upload permission is currently disabled for your account role.'], 403);
        }
    } catch (Exception $e) {}

    if ($user['role'] === 'distributor' && !empty($user['distributor_id'])) {
        $dStmt = $pdo->prepare("SELECT status, can_direct_upload, name FROM distributors WHERE id = ? LIMIT 1");
        $dStmt->execute([$user['distributor_id']]);
        $dRow = $dStmt->fetch();
        if ($dRow && ($dRow['status'] !== 'active' || (int)$dRow['can_direct_upload'] === 0)) {
            json_response(['status' => 'error', 'message' => 'Your distributor account is not currently authorized for direct uploads.'], 403);
        }
    }
}

$audioDir   = UPLOAD_DIR . '/audio';
$artDir     = UPLOAD_DIR . '/artwork';
$videoDir   = UPLOAD_DIR . '/video';
$lyricsDir  = UPLOAD_DIR . '/lyrics';

foreach ([$audioDir, $artDir, $videoDir, $lyricsDir] as $d) {
    if (!is_dir($d)) {
        @mkdir($d, 0755, true);
    }
}

$title       = trim($_POST['title'] ?? '');
$artistId    = trim($_POST['artist_id'] ?? '');
$artistName  = trim($_POST['artist_name'] ?? '');
$albumId     = trim($_POST['album_id'] ?? '');
$albumName   = trim($_POST['album_name'] ?? '');
$releaseType = strtolower(trim($_POST['release_type'] ?? 'single'));
if (!in_array($releaseType, ['single', 'ep', 'album'], true)) {
    $releaseType = 'single';
}
$genre       = trim($_POST['genre'] ?? 'Pop');
$country     = strtoupper(substr(trim($_POST['country'] ?? ($user['country'] ?? 'US')), 0, 2));
$duration    = max(0, (int)($_POST['duration'] ?? 0));
$bpm         = max(40, min(240, (int)($_POST['bpm'] ?? 120)));
$isrc        = trim($_POST['isrc'] ?? '');
$upc         = trim($_POST['upc'] ?? '');
$lyricsText  = trim($_POST['lyrics'] ?? '');
$explicit    = !empty($_POST['explicit']) && $_POST['explicit'] !== 'false' ? 1 : 0;
$releaseDate = trim($_POST['release_date'] ?? date('Y-m-d'));
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $releaseDate)) {
    $releaseDate = date('Y-m-d');
}
$releaseYear = (int)substr($releaseDate, 0, 4);
$labelId     = trim($_POST['label_id'] ?? ($user['label_id'] ?? ''));
$labelName   = trim($_POST['label_name'] ?? '');

if (empty($title)) {
    json_response(['status' => 'error', 'message' => 'Track title is required.'], 400);
}

// Resolve Distributor / Label identity from authenticated user (no hardcoded TuneCore/CDBaby!)
$distributorId = null;
$distributorName = null;
if ($user['role'] === 'distributor') {
    $distributorId = $user['distributor_id'] ?: ('dist_usr_' . $user['id']);
    if (!empty($user['distributor_id'])) {
        $dStmt = $pdo->prepare("SELECT name FROM distributors WHERE id = ? LIMIT 1");
        $dStmt->execute([$user['distributor_id']]);
        $dRow = $dStmt->fetch();
        $distributorName = $dRow['name'] ?? $user['display_name'];
    } else {
        $distributorName = $user['display_name'];
    }
} elseif ($user['role'] === 'admin' && !empty($_POST['distributor_id'])) {
    $distributorId = trim($_POST['distributor_id']);
    $dStmt = $pdo->prepare("SELECT name FROM distributors WHERE id = ? LIMIT 1");
    $dStmt->execute([$distributorId]);
    $dRow = $dStmt->fetch();
    $distributorName = $dRow['name'] ?? null;
}

if (!empty($labelId) && empty($labelName)) {
    $lStmt = $pdo->prepare("SELECT name FROM labels WHERE id = ? LIMIT 1");
    $lStmt->execute([$labelId]);
    $lRow = $lStmt->fetch();
    if ($lRow) {
        $labelName = $lRow['name'];
    }
}

$trackId = !empty($_POST['track_id']) ? MediaEngine::safeId($_POST['track_id']) : ('trk_' . bin2hex(random_bytes(6)));

$audioUrl = trim($_POST['audio_url'] ?? '');
$coverUrl = trim($_POST['cover_art_url'] ?? '');
$videoUrl = trim($_POST['video_url'] ?? '');

$localAudioRel  = null;
$localArtRel    = null;
$localVideoRel  = null;
$localLyricsRel = null;
$audioFileSize  = 0;
$audioFormat    = 'mp3';

// 1. Validate & Process Audio File Upload
if (isset($_FILES['audio_file']) && $_FILES['audio_file']['error'] !== UPLOAD_ERR_NO_FILE) {
    if ($_FILES['audio_file']['error'] !== UPLOAD_ERR_OK) {
        json_response(['status' => 'error', 'message' => 'Audio file upload error (code ' . $_FILES['audio_file']['error'] . ').'], 400);
    }
    $fileTmp  = $_FILES['audio_file']['tmp_name'];
    $fileName = basename($_FILES['audio_file']['name']);
    $fileSize = (int)$_FILES['audio_file']['size'];
    $ext      = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

    $allowedAudio = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus'];
    if (!in_array($ext, $allowedAudio, true)) {
        json_response(['status' => 'error', 'message' => 'Invalid audio format. Allowed formats: MP3, WAV, FLAC, M4A, AAC, OGG, OPUS.'], 400);
    }
    if ($fileSize <= 0 || $fileSize > 100 * 1024 * 1024) {
        json_response(['status' => 'error', 'message' => 'Audio file size must be between 1 byte and 100MB.'], 400);
    }

    $safeAudioName = $trackId . '_' . time() . '.' . $ext;
    $destPath = $audioDir . '/' . $safeAudioName;

    // Also store in private storage/audio for unified stream.php & MediaScanner resolution
    $subDir = 'audio/' . date('Y') . '/' . date('m');
    $storageFullDir = STORAGE_ROOT . '/' . $subDir;
    if (!is_dir($storageFullDir)) {
        @mkdir($storageFullDir, 0755, true);
    }
    $storageDest = $storageFullDir . '/' . $safeAudioName;

    if (!move_uploaded_file($fileTmp, $storageDest)) {
        json_response(['status' => 'error', 'message' => 'Failed to save uploaded audio file on server.'], 500);
    }
    @copy($storageDest, $destPath);

    $localAudioRel = $subDir . '/' . $safeAudioName;
    $audioFileSize = $fileSize;
    $audioFormat   = $ext;
    $audioUrl      = '/phpbackend/api/stream.php?id=' . urlencode($trackId);
}

// 2. Validate & Process Cover Artwork Upload
if (isset($_FILES['cover_file']) && $_FILES['cover_file']['error'] !== UPLOAD_ERR_NO_FILE) {
    if ($_FILES['cover_file']['error'] !== UPLOAD_ERR_OK) {
        json_response(['status' => 'error', 'message' => 'Cover artwork upload error (code ' . $_FILES['cover_file']['error'] . ').'], 400);
    }
    $imgTmp  = $_FILES['cover_file']['tmp_name'];
    $imgName = basename($_FILES['cover_file']['name']);
    $imgSize = (int)$_FILES['cover_file']['size'];
    $imgExt  = strtolower(pathinfo($imgName, PATHINFO_EXTENSION));

    $allowedImg = ['jpg', 'jpeg', 'png', 'webp'];
    if (!in_array($imgExt, $allowedImg, true)) {
        json_response(['status' => 'error', 'message' => 'Invalid artwork format. Allowed formats: JPG, PNG, WEBP.'], 400);
    }
    if ($imgSize <= 0 || $imgSize > 15 * 1024 * 1024) {
        json_response(['status' => 'error', 'message' => 'Cover artwork must be under 15MB.'], 400);
    }

    $safeImgName = 'art_' . $trackId . '_' . time() . '.' . $imgExt;
    $artSubDir = 'artwork/' . date('Y') . '/' . date('m');
    $storageArtDir = STORAGE_ROOT . '/' . $artSubDir;
    if (!is_dir($storageArtDir)) {
        @mkdir($storageArtDir, 0755, true);
    }
    $storageArtDest = $storageArtDir . '/' . $safeImgName;
    $publicArtDest  = $artDir . '/' . $safeImgName;

    if (!move_uploaded_file($imgTmp, $storageArtDest)) {
        json_response(['status' => 'error', 'message' => 'Failed to save cover artwork file on server.'], 500);
    }
    @copy($storageArtDest, $publicArtDest);

    $localArtRel = $artSubDir . '/' . $safeImgName;
    $coverUrl    = '/phpbackend/api/stream.php?type=artwork&id=' . urlencode($trackId);
}

// 3. Validate & Process Video File Upload (.mp4, .webm, .m4v, .mov)
if (isset($_FILES['video_file']) && $_FILES['video_file']['error'] !== UPLOAD_ERR_NO_FILE) {
    if ($_FILES['video_file']['error'] !== UPLOAD_ERR_OK) {
        json_response(['status' => 'error', 'message' => 'Video file upload error (code ' . $_FILES['video_file']['error'] . ').'], 400);
    }
    $vidTmp  = $_FILES['video_file']['tmp_name'];
    $vidName = basename($_FILES['video_file']['name']);
    $vidSize = (int)$_FILES['video_file']['size'];
    $vidExt  = strtolower(pathinfo($vidName, PATHINFO_EXTENSION));

    $allowedVideo = ['mp4', 'webm', 'm4v', 'mov', 'mkv'];
    if (!in_array($vidExt, $allowedVideo, true)) {
        json_response(['status' => 'error', 'message' => 'Invalid video format. Allowed formats: MP4, WEBM, M4V, MOV.'], 400);
    }
    if ($vidSize <= 0 || $vidSize > 250 * 1024 * 1024) {
        json_response(['status' => 'error', 'message' => 'Video file must be under 250MB.'], 400);
    }

    $safeVidName = 'vid_' . $trackId . '_' . time() . '.' . $vidExt;
    $vidSubDir = 'video/' . date('Y') . '/' . date('m');
    $storageVidDir = STORAGE_ROOT . '/' . $vidSubDir;
    if (!is_dir($storageVidDir)) {
        @mkdir($storageVidDir, 0755, true);
    }
    $storageVidDest = $storageVidDir . '/' . $safeVidName;
    $publicVidDest  = $videoDir . '/' . $safeVidName;

    if (!move_uploaded_file($vidTmp, $storageVidDest)) {
        json_response(['status' => 'error', 'message' => 'Failed to save uploaded video file on server.'], 500);
    }
    @copy($storageVidDest, $publicVidDest);

    $localVideoRel = $vidSubDir . '/' . $safeVidName;
    $videoUrl      = '/phpbackend/api/stream.php?type=video&id=' . urlencode($trackId);

    // If no separate audio file was provided, video file can also serve as the track's playable stream
    if (empty($localAudioRel) && empty($audioUrl)) {
        $localAudioRel = $localVideoRel;
        $audioFileSize = $vidSize;
        $audioFormat   = $vidExt;
        $audioUrl      = '/phpbackend/api/stream.php?id=' . urlencode($trackId);
    }
}

// 4. Validate & Process Lyrics File Upload (.lrc, .txt, .srt)
if (isset($_FILES['lyrics_file']) && $_FILES['lyrics_file']['error'] !== UPLOAD_ERR_NO_FILE) {
    if ($_FILES['lyrics_file']['error'] !== UPLOAD_ERR_OK) {
        json_response(['status' => 'error', 'message' => 'Lyrics file upload error (code ' . $_FILES['lyrics_file']['error'] . ').'], 400);
    }
    $lyrTmp  = $_FILES['lyrics_file']['tmp_name'];
    $lyrName = basename($_FILES['lyrics_file']['name']);
    $lyrSize = (int)$_FILES['lyrics_file']['size'];
    $lyrExt  = strtolower(pathinfo($lyrName, PATHINFO_EXTENSION));

    $allowedLyr = ['lrc', 'txt', 'srt'];
    if (!in_array($lyrExt, $allowedLyr, true)) {
        json_response(['status' => 'error', 'message' => 'Invalid lyrics file format. Allowed formats: LRC, TXT, SRT.'], 400);
    }
    if ($lyrSize <= 0 || $lyrSize > 2 * 1024 * 1024) {
        json_response(['status' => 'error', 'message' => 'Lyrics file must be under 2MB.'], 400);
    }

    $rawLyricsContent = (string)@file_get_contents($lyrTmp);
    $safeLyrName = 'lyr_' . $trackId . '_' . time() . '.' . $lyrExt;
    $lyrDest = $lyricsDir . '/' . $safeLyrName;
    if (@move_uploaded_file($lyrTmp, $lyrDest)) {
        $localLyricsRel = 'uploads/lyrics/' . $safeLyrName;
    }
    if (!empty(trim($rawLyricsContent))) {
        $lyricsText = trim($rawLyricsContent);
    }
}

if (empty($localAudioRel) && empty($localVideoRel) && empty($audioUrl)) {
    json_response(['status' => 'error', 'message' => 'Please upload a valid audio or video file.'], 400);
}

// 5. Resolve & Authorize Artist Record
if (!empty($artistId)) {
    $artStmt = $pdo->prepare("SELECT * FROM artists WHERE id = ? LIMIT 1");
    $artStmt->execute([$artistId]);
    $existingArtist = $artStmt->fetch();

    if ($existingArtist) {
        // Enforce Distributor ownership check
        if ($user['role'] === 'distributor') {
            $ownsArtist = ($existingArtist['distributor_id'] ?? '') === $distributorId
                || ($existingArtist['created_by_user_id'] ?? '') === $user['id'];
            if (!$ownsArtist) {
                json_response(['status' => 'error', 'message' => 'You are only authorized to upload releases for artists created or managed by your distributor account.'], 403);
            }
        }
        $artistName = $existingArtist['name'];
        if (empty($labelName) && !empty($existingArtist['label_name'])) {
            $labelName = $existingArtist['label_name'];
        }
    } else {
        if (empty($artistName)) {
            json_response(['status' => 'error', 'message' => 'Selected artist was not found in database.'], 404);
        }
    }
}

if (empty($artistId)) {
    if (empty($artistName)) {
        $artistName = $user['display_name'];
    }
    // Check if an artist with this name already exists for this user/distributor
    $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $artistName)) ?: ('artist-' . bin2hex(random_bytes(3)));
    $findStmt = $pdo->prepare("SELECT * FROM artists WHERE LOWER(name) = LOWER(?) LIMIT 1");
    $findStmt->execute([$artistName]);
    $foundArtist = $findStmt->fetch();

    if ($foundArtist) {
        if ($user['role'] === 'distributor') {
            $ownsArtist = ($foundArtist['distributor_id'] ?? '') === $distributorId
                || ($foundArtist['created_by_user_id'] ?? '') === $user['id'];
            if (!$ownsArtist) {
                json_response(['status' => 'error', 'message' => "Artist '{$artistName}' is managed by another account. Create a distinct artist profile in your roster first."], 403);
            }
        }
        $artistId = $foundArtist['id'];
    } else {
        $artistId = 'art_' . bin2hex(random_bytes(5));
        $uniqueSlug = $slug . '-' . substr($artistId, -4);
        $pdo->prepare("
            INSERT INTO artists (
                id, name, stage_name, slug, avatar_url, header_url, bio, verified,
                monthly_listeners, total_streams, followers, country, primary_genre,
                label_id, label_name, distributor_name, distributor_id, created_by_user_id,
                genres_json, claimed_status, claimed_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            $artistId,
            $artistName,
            $artistName,
            $uniqueSlug,
            $coverUrl,
            $coverUrl,
            '',
            $user['role'] === 'admin' ? 1 : 0,
            $country,
            $genre,
            $labelId ?: null,
            $labelName ?: null,
            $distributorName,
            $distributorId,
            $user['id'],
            json_encode([$genre]),
            $user['role'] === 'artist' ? 'claimed' : 'unclaimed',
            $user['role'] === 'artist' ? $user['id'] : null
        ]);
    }
}

// 6. Resolve or Create Album / EP / Single Record
if (empty($albumName)) {
    $albumName = $title . ($releaseType === 'single' ? ' - Single' : '');
}
if (empty($albumId)) {
    $albCheck = $pdo->prepare("SELECT id FROM albums WHERE artist_id = ? AND LOWER(title) = LOWER(?) LIMIT 1");
    $albCheck->execute([$artistId, $albumName]);
    $existingAlb = $albCheck->fetch();
    if ($existingAlb) {
        $albumId = $existingAlb['id'];
        $pdo->prepare("UPDATE albums SET tracks_count = tracks_count + 1, cover_art_url = COALESCE(NULLIF(cover_art_url, ''), ?) WHERE id = ?")
            ->execute([$coverUrl, $albumId]);
    } else {
        $albumId = 'alb_' . bin2hex(random_bytes(5));
        $pdo->prepare("
            INSERT INTO albums (
                id, title, artist_id, artist_name, cover_art_url, release_date,
                release_type, genre, status, upc, tracks_count, distributor_id, label_id, created_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, 1, ?, ?, ?)
        ")->execute([
            $albumId,
            $albumName,
            $artistId,
            $artistName,
            $coverUrl,
            $releaseDate,
            $releaseType,
            $genre,
            $upc ?: null,
            $distributorId,
            $labelId ?: null,
            $user['id']
        ]);
    }
}

// 7. Insert or Update Track Record in MySQL
$sourceType = $user['role'] === 'admin' ? 'admin_upload' : ($user['role'] . '_upload');
$stmt = $pdo->prepare("
    INSERT INTO tracks (
        id, source_id, source_type, title, artist_id, artist_name, album_id, album_name,
        duration, genre, country, release_year, cover_art_url, audio_url, video_url,
        local_audio_path, local_artwork_path, local_video_path, lyrics_file_path,
        audio_file_size, audio_format, stream_count, flontmie_plays, likes_count, dislikes_count,
        release_date, lyrics, isrc, upc, explicit, bpm, mood_tags_json,
        distributor_id, label_id, created_by_user_id,
        import_status, license_status, license_notes, status, featured_on_home, is_deleted
    ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, 0, 0, 0, 0,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        'synced', 'direct_upload', ?, 'published', 1, 0
    )
    ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        artist_id = VALUES(artist_id),
        artist_name = VALUES(artist_name),
        album_id = VALUES(album_id),
        album_name = VALUES(album_name),
        duration = IF(VALUES(duration) > 0, VALUES(duration), duration),
        genre = VALUES(genre),
        country = VALUES(country),
        release_year = VALUES(release_year),
        cover_art_url = IF(VALUES(cover_art_url) != '', VALUES(cover_art_url), cover_art_url),
        audio_url = IF(VALUES(audio_url) != '', VALUES(audio_url), audio_url),
        video_url = COALESCE(NULLIF(VALUES(video_url), ''), video_url),
        local_audio_path = COALESCE(VALUES(local_audio_path), local_audio_path),
        local_artwork_path = COALESCE(VALUES(local_artwork_path), local_artwork_path),
        local_video_path = COALESCE(VALUES(local_video_path), local_video_path),
        lyrics_file_path = COALESCE(VALUES(lyrics_file_path), lyrics_file_path),
        audio_file_size = IF(VALUES(audio_file_size) > 0, VALUES(audio_file_size), audio_file_size),
        audio_format = COALESCE(VALUES(audio_format), audio_format),
        release_date = VALUES(release_date),
        lyrics = IF(VALUES(lyrics) != '', VALUES(lyrics), lyrics),
        isrc = IF(VALUES(isrc) != '', VALUES(isrc), isrc),
        upc = COALESCE(NULLIF(VALUES(upc), ''), upc),
        explicit = VALUES(explicit),
        bpm = VALUES(bpm)
");

$stmt->execute([
    $trackId,
    $trackId,
    $sourceType,
    $title,
    $artistId,
    $artistName,
    $albumId,
    $albumName,
    $duration > 0 ? $duration : 180,
    $genre,
    $country,
    $releaseYear,
    $coverUrl,
    $audioUrl,
    $videoUrl ?: null,
    $localAudioRel,
    $localArtRel,
    $localVideoRel,
    $localLyricsRel,
    $audioFileSize,
    $audioFormat,
    $releaseDate,
    $lyricsText,
    $isrc,
    $upc ?: null,
    $explicit,
    $bpm,
    json_encode([$genre]),
    $distributorId,
    $labelId ?: null,
    $user['id'],
    "Uploaded by {$user['display_name']} ({$user['role']})"
]);

Auth::logAudit($user['id'], 'MEDIA_TRACK_UPLOADED', 'TRACK', $trackId, [
    'title' => $title,
    'artist' => $artistName,
    'album' => $albumName,
    'audio_format' => $audioFormat,
    'has_video' => !empty($localVideoRel),
    'has_lyrics' => !empty($lyricsText)
]);

json_response([
    'status' => 'success',
    'message' => "Uploaded '{$title}' by {$artistName}.",
    'track' => [
        'id' => $trackId,
        'title' => $title,
        'artist_id' => $artistId,
        'artist_name' => $artistName,
        'album_id' => $albumId,
        'album_name' => $albumName,
        'duration' => $duration > 0 ? $duration : 180,
        'genre' => $genre,
        'country' => $country,
        'cover_art_url' => $coverUrl,
        'audio_url' => $audioUrl,
        'video_url' => $videoUrl ?: null,
        'lyrics' => $lyricsText,
        'isrc' => $isrc,
        'upc' => $upc,
        'release_date' => $releaseDate,
        'stream_count' => 0,
        'likes_count' => 0,
        'distributor_id' => $distributorId,
        'distributor_name' => $distributorName,
        'label_id' => $labelId ?: null,
        'label_name' => $labelName ?: null
    ]
], 201);
