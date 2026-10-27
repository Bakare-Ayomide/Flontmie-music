<?php
/**
 * Flontmie API - Tracks Catalog, Streaming Counter, Likes, Comments & Authorized Management
 * Connects every track operation to real MySQL records with zero mock fallbacks.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../artist_enrichment.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = trim($_GET['id'] ?? '');
$pdo = Database::getConnection();

// Helper to enrich track row for API output
function formatTrackForOutput(array $t, array $likedMap = []): array {
    $t['mood_tags'] = !empty($t['mood_tags_json']) ? json_decode($t['mood_tags_json'], true) : [];
    $t['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($t['cover_art_url'] ?? '', $t['video_id'] ?? $t['id']);
    $t['yt_plays'] = ArtistEnrichment::parseMetric((string)($t['stream_count'] ?? '0'))['compact'];
    $t['flontmie_plays'] = (int)($t['flontmie_plays'] ?? 0);
    $t['is_liked'] = isset($likedMap[$t['id']]);

    // Never return legacy placeholder lyrics
    if (!empty($t['lyrics']) && strpos($t['lyrics'], 'Synchronized Catalog Lyrics') !== false) {
        $t['lyrics'] = null;
    }

    // Load uploaded lyrics file (.lrc, .srt, .txt) if lyrics column is empty
    if (empty($t['lyrics']) && !empty($t['local_lyrics_path'])) {
        $relLyr = ltrim($t['local_lyrics_path'], '/');
        $projectRoot = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
        foreach ([BASE_DIR . '/storage/' . $relLyr, BASE_DIR . '/' . $relLyr, $projectRoot . '/' . $relLyr] as $candLyr) {
            if (is_file($candLyr) && is_readable($candLyr)) {
                $t['lyrics'] = trim((string)@file_get_contents($candLyr));
                break;
            }
        }
    }

    $audioExt = strtolower(pathinfo($t['local_audio_path'] ?? '', PATHINFO_EXTENSION));
    $isSynthesizedWav = ($audioExt === 'wav' && (int)($t['audio_file_size'] ?? 0) === 705644);
    $isAudioPathVideo = in_array($audioExt, ['mp4', 'webm', 'm4v', 'mov', 'mkv'], true);

    $hasRealAudio = (!empty($t['local_audio_path']) && !$isSynthesizedWav) || !empty($t['local_video_path']);
    $hasRealVideo = !empty($t['local_video_path']) || !empty($t['video_url']) || $isAudioPathVideo;

    $t['has_local_audio'] = $hasRealAudio;
    $t['has_local_video'] = $hasRealVideo;
    $t['audio_url'] = $hasRealAudio ? ('/phpbackend/api/stream.php?id=' . urlencode($t['id'])) : '';
    if ($hasRealVideo) {
        $t['video_url'] = '/phpbackend/api/stream.php?id=' . urlencode($t['id']) . '&type=video';
    } else {
        $t['video_url'] = null;
    }

    unset($t['local_audio_path'], $t['local_artwork_path'], $t['local_video_path'], $t['local_lyrics_path']);
    return $t;
}

// --- 0. GET SYNCHRONIZED OR PLAIN LYRICS FOR TRACK ---
if ($method === 'GET' && $action === 'lyrics') {
    $trackId = trim($_GET['track_id'] ?? $_GET['id'] ?? '');
    if (empty($trackId)) {
        json_response(['status' => 'error', 'message' => 'track_id is required'], 400);
    }

    $stmt = $pdo->prepare("SELECT id, title, artist_name, lyrics, local_lyrics_path, lyrics_file_path FROM tracks WHERE id = ? OR video_id = ? LIMIT 1");
    $stmt->execute([$trackId, $trackId]);
    $row = $stmt->fetch();

    if (!$row) {
        json_response(['status' => 'success', 'lyrics' => '', 'source' => 'not_found']);
    }

    $lyricsText = trim((string)($row['lyrics'] ?? ''));
    if (!empty($lyricsText) && strpos($lyricsText, 'Synchronized Catalog Lyrics') !== false) {
        $lyricsText = '';
    }

    // Check uploaded .lrc/.srt/.txt file if column is empty
    if (empty($lyricsText)) {
        $relLyr = ltrim((string)($row['local_lyrics_path'] ?? $row['lyrics_file_path'] ?? ''), '/');
        if (!empty($relLyr)) {
            $projectRoot = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
            foreach ([BASE_DIR . '/storage/' . $relLyr, BASE_DIR . '/' . $relLyr, $projectRoot . '/' . $relLyr] as $candLyr) {
                if (is_file($candLyr) && is_readable($candLyr)) {
                    $lyricsText = trim((string)@file_get_contents($candLyr));
                    break;
                }
            }
        }
    }

    json_response([
        'status' => 'success',
        'track_id' => $row['id'],
        'lyrics' => $lyricsText,
        'source' => !empty($lyricsText) ? 'uploaded_catalog' : 'none'
    ]);
}

// --- 1. STREAM COUNT INCREMENT & LISTENING HISTORY ---
if ($method === 'POST' && $action === 'stream' && !empty($id)) {
    $stmt = $pdo->prepare("UPDATE tracks SET stream_count = stream_count + 1, flontmie_plays = COALESCE(flontmie_plays, 0) + 1 WHERE id = ? OR video_id = ?");
    $stmt->execute([$id, $id]);

    $user = Auth::getCurrentUser();
    if ($user) {
        try {
            $hist = $pdo->prepare("INSERT INTO user_history (user_id, track_id) VALUES (?, ?)");
            $hist->execute([$user['id'], $id]);
        } catch (Exception $e) {}
    }

    json_response(['status' => 'success', 'message' => 'Stream registered']);
}

// --- 2. TOGGLE LIKE / FAVORITE ---
if ($method === 'POST' && $action === 'like' && !empty($id)) {
    $user = Auth::requireAuth();
    $userId = $user['id'];

    $check = $pdo->prepare("SELECT id FROM user_favorites WHERE user_id = ? AND track_id = ?");
    $check->execute([$userId, $id]);
    $existing = $check->fetch();

    if ($existing) {
        $del = $pdo->prepare("DELETE FROM user_favorites WHERE user_id = ? AND track_id = ?");
        $del->execute([$userId, $id]);
        $pdo->prepare("UPDATE tracks SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ?")->execute([$id]);
        json_response(['status' => 'success', 'liked' => false, 'message' => 'Removed from favorites']);
    } else {
        $ins = $pdo->prepare("INSERT INTO user_favorites (user_id, track_id) VALUES (?, ?)");
        $ins->execute([$userId, $id]);
        $pdo->prepare("UPDATE tracks SET likes_count = likes_count + 1 WHERE id = ?")->execute([$id]);
        json_response(['status' => 'success', 'liked' => true, 'message' => 'Added to favorites']);
    }
}

// --- 3. REAL TRACK COMMENTS (GET & POST) ---
if ($method === 'GET' && $action === 'comments' && !empty($id)) {
    $stmt = $pdo->prepare("SELECT id, track_id, user_id, author_name, author_avatar, body, created_at FROM track_comments WHERE track_id = ? ORDER BY created_at DESC LIMIT 100");
    $stmt->execute([$id]);
    json_response(['status' => 'success', 'comments' => $stmt->fetchAll()]);
}

if ($method === 'POST' && $action === 'comment' && !empty($id)) {
    $user = Auth::requireAuth();
    $input = get_json_input();
    $body = trim($input['body'] ?? '');
    if (empty($body)) {
        json_response(['status' => 'error', 'message' => 'Comment text cannot be empty.'], 400);
    }
    $commentId = 'cmt_' . bin2hex(random_bytes(6));
    $pdo->prepare("
        INSERT INTO track_comments (id, track_id, user_id, author_name, author_avatar, body)
        VALUES (?, ?, ?, ?, ?, ?)
    ")->execute([$commentId, $id, $user['id'], $user['display_name'], $user['avatar_url'] ?? null, substr($body, 0, 1000)]);

    json_response([
        'status' => 'success',
        'comment' => [
            'id' => $commentId,
            'track_id' => $id,
            'user_id' => $user['id'],
            'author_name' => $user['display_name'],
            'author_avatar' => $user['avatar_url'] ?? null,
            'body' => substr($body, 0, 1000),
            'created_at' => date('Y-m-d H:i:s')
        ]
    ], 201);
}

// --- 4. GET LIKED TRACKS ---
if ($method === 'GET' && $action === 'liked') {
    $user = Auth::requireAuth();
    $stmt = $pdo->prepare("
        SELECT t.* FROM tracks t 
        JOIN user_favorites f ON t.id = f.track_id 
        WHERE f.user_id = ? AND t.is_deleted = 0 
        ORDER BY f.created_at DESC
    ");
    $stmt->execute([$user['id']]);
    $tracks = $stmt->fetchAll();

    $likedMap = [];
    foreach ($tracks as $t) {
        $likedMap[$t['id']] = true;
    }
    foreach ($tracks as &$t) {
        $t = formatTrackForOutput($t, $likedMap);
    }
    json_response(['status' => 'success', 'tracks' => $tracks]);
}

// --- 5. GET LISTENING HISTORY ---
if ($method === 'GET' && $action === 'history') {
    $user = Auth::requireAuth();
    $stmt = $pdo->prepare("
        SELECT t.*, MAX(h.played_at) AS last_played_at
        FROM user_history h
        JOIN tracks t ON t.id = h.track_id
        WHERE h.user_id = ? AND t.is_deleted = 0
        GROUP BY t.id
        ORDER BY last_played_at DESC
        LIMIT 50
    ");
    $stmt->execute([$user['id']]);
    $tracks = $stmt->fetchAll();
    foreach ($tracks as &$t) {
        $t = formatTrackForOutput($t);
    }
    json_response(['status' => 'success', 'tracks' => $tracks]);
}

// --- 6. GET SINGLE TRACK ---
if ($method === 'GET' && !empty($id)) {
    $stmt = $pdo->prepare("SELECT * FROM tracks WHERE (id = ? OR video_id = ?) AND is_deleted = 0 LIMIT 1");
    $stmt->execute([$id, $id]);
    $track = $stmt->fetch();

    if (!$track) {
        json_response(['status' => 'error', 'message' => 'Track not found'], 404);
    }

    $user = Auth::getCurrentUser();
    $likedMap = [];
    if ($user) {
        $chk = $pdo->prepare("SELECT id FROM user_favorites WHERE user_id = ? AND track_id = ?");
        $chk->execute([$user['id'], $track['id']]);
        if ($chk->fetch()) {
            $likedMap[$track['id']] = true;
        }
    }

    $track = formatTrackForOutput($track, $likedMap);
    json_response(['status' => 'success', 'track' => $track]);
}

// --- 7. GET TRACKS CATALOG ---
if ($method === 'GET') {
    $genre = trim($_GET['genre'] ?? '');
    $artistId = trim($_GET['artist_id'] ?? '');
    $albumId = trim($_GET['album_id'] ?? '');
    $distributorId = trim($_GET['distributor_id'] ?? '');
    $labelId = trim($_GET['label_id'] ?? '');
    $country = trim($_GET['country'] ?? '');
    $year = trim($_GET['year'] ?? '');
    $search = trim($_GET['q'] ?? '');
    $limit = min(200, max(1, (int)($_GET['limit'] ?? 60)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    $sql = "SELECT * FROM tracks WHERE is_deleted = 0 AND (status IS NULL OR status = 'published' OR status = 'active') AND audio_url NOT LIKE '%soundhelix%'";
    $params = [];

    if (!empty($genre) && strtolower($genre) !== 'all') {
        $sql .= " AND (genre = ? OR mood_tags_json LIKE ?)";
        $params[] = $genre;
        $params[] = '%' . $genre . '%';
    }

    if (!empty($artistId)) {
        $sql .= " AND artist_id = ?";
        $params[] = $artistId;
    }

    if (!empty($albumId)) {
        $sql .= " AND album_id = ?";
        $params[] = $albumId;
    }

    if (!empty($distributorId)) {
        $sql .= " AND distributor_id = ?";
        $params[] = $distributorId;
    }

    if (!empty($labelId)) {
        $sql .= " AND label_id = ?";
        $params[] = $labelId;
    }

    if (!empty($country) && strtolower($country) !== 'all') {
        $sql .= " AND country = ?";
        $params[] = strtoupper($country);
    }

    if (!empty($year) && strtolower($year) !== 'all' && is_numeric($year)) {
        $sql .= " AND release_year = ?";
        $params[] = (int)$year;
    }

    if (!empty($search)) {
        $sql .= " AND (title LIKE ? OR artist_name LIKE ? OR album_name LIKE ? OR genre LIKE ?)";
        $searchTerm = '%' . $search . '%';
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }

    $sql .= " ORDER BY featured_on_home DESC, editorial_boost DESC, flontmie_plays DESC, stream_count DESC, created_at DESC LIMIT {$limit} OFFSET {$offset}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $tracks = $stmt->fetchAll();

    if (!empty($search)) {
        try {
            $authUser = Auth::getCurrentUser();
            $stmtLog = $pdo->prepare("INSERT INTO search_logs (user_id, query, results_count, ip_address) VALUES (?, ?, ?, ?)");
            $stmtLog->execute([
                $authUser['id'] ?? null,
                substr($search, 0, 255),
                count($tracks),
                $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
            ]);
        } catch (Exception $e) {}
    }

    $user = Auth::getCurrentUser();
    $likedMap = [];
    if ($user) {
        $favs = $pdo->prepare("SELECT track_id FROM user_favorites WHERE user_id = ?");
        $favs->execute([$user['id']]);
        while ($row = $favs->fetch()) {
            $likedMap[$row['track_id']] = true;
        }
    }

    foreach ($tracks as &$t) {
        $t = formatTrackForOutput($t, $likedMap);
    }

    json_response([
        'status' => 'success',
        'count' => count($tracks),
        'tracks' => $tracks
    ]);
}

// --- 8. CREATE TRACK METADATA RECORD (POST) ---
if ($method === 'POST') {
    $user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);
    $input = get_json_input();

    $title = trim($input['title'] ?? '');
    $artistName = trim($input['artist_name'] ?? $user['display_name']);
    $artistId = trim($input['artist_id'] ?? ($user['artist_id'] ?? 'art_' . substr(md5(strtolower($artistName)), 0, 12)));
    $audioUrl = trim($input['audio_url'] ?? '');

    if (empty($title)) {
        json_response(['status' => 'error', 'message' => 'Track title is required.'], 400);
    }

    // Verify ownership for distributors
    if ($user['role'] === 'distributor' && !empty($input['artist_id'])) {
        $aChk = $pdo->prepare("SELECT distributor_id, created_by_user_id FROM artists WHERE id = ? LIMIT 1");
        $aChk->execute([$artistId]);
        $aRow = $aChk->fetch();
        if ($aRow && $aRow['distributor_id'] !== $user['distributor_id'] && $aRow['created_by_user_id'] !== $user['id']) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You can only create tracks for artists managed by your distributor account.'], 403);
        }
    }

    $trackId = 'trk_' . bin2hex(random_bytes(6));
    if (empty($audioUrl)) {
        $audioUrl = '/phpbackend/api/stream.php?id=' . urlencode($trackId);
    }

    $albumId = !empty($input['album_id']) ? trim($input['album_id']) : null;
    $albumName = trim($input['album_name'] ?? ($title . ' - Single'));
    $genre = trim($input['genre'] ?? 'Afrobeats');
    $cover = trim($input['cover_art_url'] ?? '');
    $videoUrl = !empty($input['video_url']) ? trim($input['video_url']) : null;
    $duration = (int)($input['duration'] ?? 180);
    $lyrics = trim($input['lyrics'] ?? '');
    $isrc = !empty($input['isrc']) ? trim($input['isrc']) : null;
    $explicit = !empty($input['explicit']) ? 1 : 0;
    $scale = !empty($input['scale']) ? trim($input['scale']) : null;
    $bpm = !empty($input['bpm']) ? (int)$input['bpm'] : null;
    $moodTags = is_array($input['mood_tags'] ?? null) ? $input['mood_tags'] : [$genre];
    $featured = !empty($input['featured_artists']) ? trim($input['featured_artists']) : null;
    $producer = !empty($input['producer']) ? trim($input['producer']) : null;
    $composer = !empty($input['composer']) ? trim($input['composer']) : null;
    $distributorId = $user['distributor_id'] ?? ($input['distributor_id'] ?? null);
    $labelId = $user['label_id'] ?? ($input['label_id'] ?? null);

    $stmt = $pdo->prepare("
        INSERT INTO tracks (
            id, title, artist_id, artist_name, album_id, album_name, duration, genre,
            cover_art_url, audio_url, video_url, lyrics, isrc, explicit, scale, bpm,
            mood_tags_json, featured_artists, producer, composer,
            distributor_id, label_id, uploaded_by_user_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
    ");
    $stmt->execute([
        $trackId, $title, $artistId, $artistName, $albumId, $albumName, $duration, $genre,
        $cover, $audioUrl, $videoUrl, $lyrics, $isrc, $explicit, $scale, $bpm,
        json_encode($moodTags), $featured, $producer, $composer,
        $distributorId, $labelId, $user['id']
    ]);

    Auth::logAudit($user['id'], 'TRACK_CREATED', 'TRACK', $trackId, ['title' => $title, 'artist' => $artistName]);
    json_response([
        'status' => 'success',
        'message' => 'Track saved to database.',
        'track_id' => $trackId
    ], 201);
}

// --- 9. UPDATE TRACK (PUT) ---
if ($method === 'PUT' && !empty($id)) {
    $user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);
    $input = get_json_input();

    $chk = $pdo->prepare("SELECT * FROM tracks WHERE id = ? AND is_deleted = 0 LIMIT 1");
    $chk->execute([$id]);
    $existing = $chk->fetch();
    if (!$existing) {
        json_response(['status' => 'error', 'message' => 'Track not found'], 404);
    }

    if ($user['role'] !== 'admin') {
        $ownsTrack = ($existing['uploaded_by_user_id'] === $user['id'])
            || ($user['role'] === 'distributor' && !empty($user['distributor_id']) && $existing['distributor_id'] === $user['distributor_id'])
            || ($user['role'] === 'label' && !empty($user['label_id']) && $existing['label_id'] === $user['label_id'])
            || ($user['role'] === 'artist' && !empty($user['artist_id']) && $existing['artist_id'] === $user['artist_id']);
        if (!$ownsTrack) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You do not have permission to edit this track.'], 403);
        }
    }

    $stmt = $pdo->prepare("
        UPDATE tracks 
        SET title = COALESCE(NULLIF(?, ''), title),
            genre = COALESCE(NULLIF(?, ''), genre),
            cover_art_url = COALESCE(NULLIF(?, ''), cover_art_url),
            audio_url = COALESCE(NULLIF(?, ''), audio_url),
            video_url = COALESCE(NULLIF(?, ''), video_url),
            lyrics = COALESCE(?, lyrics),
            isrc = COALESCE(NULLIF(?, ''), isrc),
            scale = COALESCE(NULLIF(?, ''), scale),
            bpm = COALESCE(?, bpm),
            explicit = COALESCE(?, explicit)
        WHERE id = ?
    ");
    $stmt->execute([
        $input['title'] ?? null,
        $input['genre'] ?? null,
        $input['cover_art_url'] ?? null,
        $input['audio_url'] ?? null,
        $input['video_url'] ?? null,
        $input['lyrics'] ?? null,
        $input['isrc'] ?? null,
        $input['scale'] ?? null,
        $input['bpm'] ?? null,
        isset($input['explicit']) ? (!empty($input['explicit']) ? 1 : 0) : null,
        $id
    ]);

    json_response(['status' => 'success', 'message' => 'Track updated successfully']);
}

// --- 10. DELETE TRACK (DELETE) ---
if ($method === 'DELETE' && !empty($id)) {
    $user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);

    $chk = $pdo->prepare("SELECT * FROM tracks WHERE id = ? LIMIT 1");
    $chk->execute([$id]);
    $existing = $chk->fetch();
    if (!$existing) {
        json_response(['status' => 'error', 'message' => 'Track not found'], 404);
    }

    if ($user['role'] !== 'admin') {
        $ownsTrack = ($existing['uploaded_by_user_id'] === $user['id'])
            || ($user['role'] === 'distributor' && !empty($user['distributor_id']) && $existing['distributor_id'] === $user['distributor_id'])
            || ($user['role'] === 'label' && !empty($user['label_id']) && $existing['label_id'] === $user['label_id'])
            || ($user['role'] === 'artist' && !empty($user['artist_id']) && $existing['artist_id'] === $user['artist_id']);
        if (!$ownsTrack) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You do not have permission to delete this track.'], 403);
        }
    }

    $stmt = $pdo->prepare("UPDATE tracks SET is_deleted = 1, status = 'removed' WHERE id = ?");
    $stmt->execute([$id]);

    Auth::logAudit($user['id'], 'TRACK_DELETED', 'TRACK', $id, ['soft_delete' => true]);
    json_response(['status' => 'success', 'message' => 'Track deleted.']);
}

json_response(['status' => 'error', 'message' => 'Method not allowed'], 405);
