<?php
/**
 * Flontmie API - Tracks Catalog, Streaming Counter, Likes & Management
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = $_GET['id'] ?? '';
$pdo = Database::getConnection();

// --- STREAM COUNT INCREMENT ---
if ($method === 'POST' && $action === 'stream' && !empty($id)) {
    $stmt = $pdo->prepare("UPDATE tracks SET stream_count = stream_count + 1 WHERE id = ?");
    $stmt->execute([$id]);

    // Record user history if logged in
    $user = Auth::getCurrentUser();
    if ($user) {
        $hist = $pdo->prepare("INSERT INTO user_history (user_id, track_id) VALUES (?, ?)");
        $hist->execute([$user['id'], $id]);
    }

    json_response(['status' => 'success', 'message' => 'Stream registered']);
}

// --- TOGGLE LIKE / FAVORITE ---
if ($method === 'POST' && $action === 'like' && !empty($id)) {
    $user = Auth::requireAuth();
    $userId = $user['id'];

    // Check if already liked
    $check = $pdo->prepare("SELECT id FROM user_favorites WHERE user_id = ? AND track_id = ?");
    $check->execute([$userId, $id]);
    $existing = $check->fetch();

    if ($existing) {
        // Unlike
        $del = $pdo->prepare("DELETE FROM user_favorites WHERE user_id = ? AND track_id = ?");
        $del->execute([$userId, $id]);
        $pdo->prepare("UPDATE tracks SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ?")->execute([$id]);
        json_response(['status' => 'success', 'liked' => false, 'message' => 'Removed from favorites']);
    } else {
        // Like
        $ins = $pdo->prepare("INSERT INTO user_favorites (user_id, track_id) VALUES (?, ?)");
        $ins->execute([$userId, $id]);
        $pdo->prepare("UPDATE tracks SET likes_count = likes_count + 1 WHERE id = ?")->execute([$id]);
        json_response(['status' => 'success', 'liked' => true, 'message' => 'Added to favorites']);
    }
}

// --- GET LIKED TRACKS ---
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

    foreach ($tracks as &$t) {
        $t['mood_tags'] = !empty($t['mood_tags_json']) ? json_decode($t['mood_tags_json'], true) : [];
        $t['is_liked'] = true;
    }
    json_response(['status' => 'success', 'tracks' => $tracks]);
}

// --- GET SINGLE TRACK ---
if ($method === 'GET' && !empty($id)) {
    $stmt = $pdo->prepare("SELECT * FROM tracks WHERE id = ? AND is_deleted = 0");
    $stmt->execute([$id]);
    $track = $stmt->fetch();

    if (!$track) {
        json_response(['status' => 'error', 'message' => 'Track not found'], 404);
    }

    $track['mood_tags'] = !empty($track['mood_tags_json']) ? json_decode($track['mood_tags_json'], true) : [];

    // Check liked status if user logged in
    $user = Auth::getCurrentUser();
    $track['is_liked'] = false;
    if ($user) {
        $chk = $pdo->prepare("SELECT id FROM user_favorites WHERE user_id = ? AND track_id = ?");
        $chk->execute([$user['id'], $id]);
        $track['is_liked'] = (bool)$chk->fetch();
    }

    json_response(['status' => 'success', 'track' => $track]);
}

// --- GET TRACKS CATALOG ---
if ($method === 'GET') {
    $genre = $_GET['genre'] ?? '';
    $artistId = $_GET['artist_id'] ?? '';
    $albumId = $_GET['album_id'] ?? '';
    $search = $_GET['q'] ?? '';
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    $sql = "SELECT * FROM tracks WHERE is_deleted = 0";
    $params = [];

    if (!empty($genre)) {
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

    if (!empty($search)) {
        $sql .= " AND (title LIKE ? OR artist_name LIKE ? OR album_name LIKE ?)";
        $searchTerm = '%' . $search . '%';
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }

    $sql .= " ORDER BY stream_count DESC, created_at DESC LIMIT {$limit} OFFSET {$offset}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $tracks = $stmt->fetchAll();

    // Check user liked tracks map
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
        $t['mood_tags'] = !empty($t['mood_tags_json']) ? json_decode($t['mood_tags_json'], true) : [];
        $t['is_liked'] = isset($likedMap[$t['id']]);
    }

    json_response([
        'status' => 'success',
        'count' => count($tracks),
        'tracks' => $tracks
    ]);
}

// --- CREATE TRACK (POST) ---
if ($method === 'POST') {
    $user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);
    $input = get_json_input();

    $title = trim($input['title'] ?? '');
    $artistName = trim($input['artist_name'] ?? $user['display_name']);
    $artistId = trim($input['artist_id'] ?? 'art_' . $user['id']);
    $audioUrl = trim($input['audio_url'] ?? '');

    if (empty($title) || empty($audioUrl)) {
        json_response(['status' => 'error', 'message' => 'Track title and audio URL are required.'], 400);
    }

    $trackId = 'trk_' . bin2hex(random_bytes(6));
    $albumId = $input['album_id'] ?? null;
    $albumName = $input['album_name'] ?? null;
    $genre = $input['genre'] ?? 'Afrobeats';
    $cover = $input['cover_art_url'] ?? 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
    $duration = (int)($input['duration'] ?? 180);
    $lyrics = $input['lyrics'] ?? '';
    $isrc = $input['isrc'] ?? 'US-FLN-' . date('y') . '-' . rand(10000, 99999);
    $explicit = !empty($input['explicit']) ? 1 : 0;
    $scale = $input['scale'] ?? 'C Major';
    $bpm = (int)($input['bpm'] ?? 120);
    $moodTags = is_array($input['mood_tags'] ?? null) ? $input['mood_tags'] : [$genre];
    $featured = $input['featured_artists'] ?? null;
    $producer = $input['producer'] ?? null;
    $composer = $input['composer'] ?? null;

    $stmt = $pdo->prepare("
        INSERT INTO tracks (id, title, artist_id, artist_name, album_id, album_name, duration, genre, cover_art_url, audio_url, lyrics, isrc, explicit, scale, bpm, mood_tags_json, featured_artists, producer, composer)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $trackId, $title, $artistId, $artistName, $albumId, $albumName, $duration, $genre, $cover, $audioUrl,
        $lyrics, $isrc, $explicit, $scale, $bpm, json_encode($moodTags), $featured, $producer, $composer
    ]);

    json_response([
        'status' => 'success',
        'message' => 'Track uploaded successfully',
        'track_id' => $trackId
    ], 201);
}

// --- UPDATE TRACK (PUT) ---
if ($method === 'PUT' && !empty($id)) {
    $user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);
    $input = get_json_input();

    $stmt = $pdo->prepare("
        UPDATE tracks 
        SET title = COALESCE(?, title),
            genre = COALESCE(?, genre),
            cover_art_url = COALESCE(?, cover_art_url),
            audio_url = COALESCE(?, audio_url),
            lyrics = COALESCE(?, lyrics),
            isrc = COALESCE(?, isrc),
            scale = COALESCE(?, scale),
            bpm = COALESCE(?, bpm)
        WHERE id = ?
    ");
    $stmt->execute([
        $input['title'] ?? null,
        $input['genre'] ?? null,
        $input['cover_art_url'] ?? null,
        $input['audio_url'] ?? null,
        $input['lyrics'] ?? null,
        $input['isrc'] ?? null,
        $input['scale'] ?? null,
        $input['bpm'] ?? null,
        $id
    ]);

    json_response(['status' => 'success', 'message' => 'Track updated successfully']);
}

// --- DELETE TRACK (DELETE) ---
if ($method === 'DELETE' && !empty($id)) {
    $user = Auth::requireRole(['distributor', 'admin']);
    
    // Soft delete for safety & recoverability
    $stmt = $pdo->prepare("UPDATE tracks SET is_deleted = 1 WHERE id = ?");
    $stmt->execute([$id]);

    // Audit log
    $log = $pdo->prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address) VALUES (?, ?, ?, ?, ?, ?)");
    $log->execute([$user['id'], 'TRACK_DELETED', 'TRACK', $id, json_encode(['soft_delete' => true]), $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1']);

    json_response(['status' => 'success', 'message' => 'Track moved to trash (soft deleted).']);
}

json_response(['status' => 'error', 'message' => 'Method not allowed'], 405);
