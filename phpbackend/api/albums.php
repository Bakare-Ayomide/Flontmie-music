<?php
/**
 * Flontmie API - Albums, EPs & Singles Discography Controller
 * Zero mock defaults or prefilled company names.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../artist_enrichment.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = trim($_GET['id'] ?? '');
$pdo = Database::getConnection();

// --- 1. GET SINGLE ALBUM ---
if ($method === 'GET' && !empty($id)) {
    $stmt = $pdo->prepare("SELECT * FROM albums WHERE id = ?");
    $stmt->execute([$id]);
    $album = $stmt->fetch();

    if (!$album) {
        json_response(['status' => 'error', 'message' => 'Album not found'], 404);
    }

    $album['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($album['cover_art_url'] ?? '', $album['artist_id'] ?? $album['id']);

    $trkStmt = $pdo->prepare("SELECT * FROM tracks WHERE album_id = ? AND is_deleted = 0 AND (status IS NULL OR status = 'published' OR status = 'active') ORDER BY id ASC");
    $trkStmt->execute([$id]);
    $tracks = $trkStmt->fetchAll();
    foreach ($tracks as &$t) {
        $t['mood_tags'] = !empty($t['mood_tags_json']) ? json_decode($t['mood_tags_json'], true) : [];
        $t['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($t['cover_art_url'] ?? '', $t['video_id'] ?? $t['id']);
        $t['audio_url'] = '/phpbackend/api/stream.php?id=' . urlencode($t['id']);
        if (!empty($t['local_video_path'])) {
            $t['video_url'] = '/phpbackend/api/stream.php?id=' . urlencode($t['id']) . '&type=video';
        }
        unset($t['local_audio_path'], $t['local_artwork_path'], $t['local_video_path'], $t['local_lyrics_path']);
    }
    $album['tracks'] = $tracks;

    json_response(['status' => 'success', 'album' => $album]);
}

// --- 2. GET ALBUMS LIST ---
if ($method === 'GET') {
    $artistId = trim($_GET['artist_id'] ?? '');
    $distributorId = trim($_GET['distributor_id'] ?? '');
    $labelId = trim($_GET['label_id'] ?? '');
    $genre = trim($_GET['genre'] ?? '');
    $search = trim($_GET['q'] ?? '');
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 40)));

    $sql = "SELECT * FROM albums WHERE (status IS NULL OR status = 'published' OR status = 'scheduled')";
    $params = [];

    if (!empty($artistId)) {
        $sql .= " AND artist_id = ?";
        $params[] = $artistId;
    }
    if (!empty($distributorId)) {
        $sql .= " AND distributor_id = ?";
        $params[] = $distributorId;
    }
    if (!empty($labelId)) {
        $sql .= " AND label_id = ?";
        $params[] = $labelId;
    }
    if (!empty($genre) && strtolower($genre) !== 'all') {
        $sql .= " AND genre = ?";
        $params[] = $genre;
    }
    if (!empty($search)) {
        $sql .= " AND (title LIKE ? OR artist_name LIKE ?)";
        $like = '%' . $search . '%';
        $params[] = $like;
        $params[] = $like;
    }

    $sql .= " ORDER BY is_featured DESC, release_date DESC, created_at DESC LIMIT {$limit}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $albums = $stmt->fetchAll();

    foreach ($albums as &$alb) {
        $alb['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($alb['cover_art_url'] ?? '', $alb['artist_id'] ?? $alb['id']);
    }

    json_response(['status' => 'success', 'count' => count($albums), 'albums' => $albums]);
}

// --- 3. CREATE ALBUM / EP / SINGLE (POST) ---
if ($method === 'POST') {
    $user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);
    $input = get_json_input();

    $title = trim($input['title'] ?? '');
    $artistId = trim($input['artist_id'] ?? ($user['artist_id'] ?? ''));
    $artistName = trim($input['artist_name'] ?? ($user['role'] === 'artist' ? $user['display_name'] : ''));

    if (!empty($artistId) && empty($artistName)) {
        $aStmt = $pdo->prepare("SELECT name FROM artists WHERE id = ? LIMIT 1");
        $aStmt->execute([$artistId]);
        $artistName = (string)($aStmt->fetchColumn() ?: '');
    }

    if (empty($title) || empty($artistName)) {
        json_response(['status' => 'error', 'message' => 'Album title and artist are required.'], 400);
    }

    // Verify distributor ownership of artist
    if ($user['role'] === 'distributor' && !empty($artistId)) {
        $aChk = $pdo->prepare("SELECT distributor_id, created_by_user_id FROM artists WHERE id = ? LIMIT 1");
        $aChk->execute([$artistId]);
        $aRow = $aChk->fetch();
        if ($aRow && $aRow['distributor_id'] !== $user['distributor_id'] && $aRow['created_by_user_id'] !== $user['id']) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You can only create releases for artists managed by your distributor account.'], 403);
        }
    }

    if (empty($artistId)) {
        $artistId = 'art_' . substr(md5(strtolower($artistName)), 0, 12);
    }

    $albumId = 'alb_' . bin2hex(random_bytes(6));
    $cover = trim($input['cover_art_url'] ?? '');
    $releaseDate = !empty($input['release_date']) ? trim($input['release_date']) : date('Y-m-d');
    $releaseType = in_array($input['release_type'] ?? '', ['album', 'ep', 'single'], true) ? $input['release_type'] : 'album';
    $genre = trim($input['genre'] ?? 'Afrobeats');
    $status = in_array($input['status'] ?? '', ['published', 'draft', 'scheduled'], true) ? $input['status'] : 'published';
    $upc = !empty($input['upc']) ? trim($input['upc']) : null;
    $tracksCount = (int)($input['tracks_count'] ?? 0);
    $distributorId = $user['distributor_id'] ?? ($input['distributor_id'] ?? null);
    $labelId = $user['label_id'] ?? ($input['label_id'] ?? null);

    $stmt = $pdo->prepare("
        INSERT INTO albums (id, title, artist_id, artist_name, cover_art_url, release_date, release_type, genre, status, upc, tracks_count, distributor_id, label_id, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $albumId, $title, $artistId, $artistName, $cover, $releaseDate, $releaseType, $genre, $status, $upc, $tracksCount, $distributorId, $labelId, $user['id']
    ]);

    Auth::logAudit($user['id'], 'ALBUM_CREATED', 'ALBUM', $albumId, ['title' => $title, 'type' => $releaseType]);

    json_response([
        'status' => 'success',
        'message' => 'Release created successfully',
        'album_id' => $albumId
    ], 201);
}

// --- 4. UPDATE ALBUM (PUT) ---
if ($method === 'PUT' && !empty($id)) {
    $user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);
    $input = get_json_input();

    $chk = $pdo->prepare("SELECT * FROM albums WHERE id = ? LIMIT 1");
    $chk->execute([$id]);
    $existing = $chk->fetch();
    if (!$existing) {
        json_response(['status' => 'error', 'message' => 'Album not found'], 404);
    }

    if ($user['role'] !== 'admin') {
        $canEdit = ($existing['created_by_user_id'] === $user['id'])
            || ($user['role'] === 'distributor' && !empty($user['distributor_id']) && $existing['distributor_id'] === $user['distributor_id'])
            || ($user['role'] === 'label' && !empty($user['label_id']) && $existing['label_id'] === $user['label_id'])
            || ($user['role'] === 'artist' && !empty($user['artist_id']) && $existing['artist_id'] === $user['artist_id']);
        if (!$canEdit) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You do not have permission to edit this release.'], 403);
        }
    }

    $pdo->prepare("
        UPDATE albums
        SET title = COALESCE(NULLIF(?, ''), title),
            cover_art_url = COALESCE(NULLIF(?, ''), cover_art_url),
            release_date = COALESCE(NULLIF(?, ''), release_date),
            release_type = COALESCE(NULLIF(?, ''), release_type),
            genre = COALESCE(NULLIF(?, ''), genre),
            status = COALESCE(NULLIF(?, ''), status),
            upc = COALESCE(NULLIF(?, ''), upc)
        WHERE id = ?
    ")->execute([
        $input['title'] ?? null,
        $input['cover_art_url'] ?? null,
        $input['release_date'] ?? null,
        $input['release_type'] ?? null,
        $input['genre'] ?? null,
        $input['status'] ?? null,
        $input['upc'] ?? null,
        $id
    ]);

    json_response(['status' => 'success', 'message' => 'Release updated']);
}

// --- 5. DELETE ALBUM ---
if ($method === 'DELETE' && !empty($id)) {
    $user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);
    $chk = $pdo->prepare("SELECT * FROM albums WHERE id = ? LIMIT 1");
    $chk->execute([$id]);
    $existing = $chk->fetch();
    if (!$existing) {
        json_response(['status' => 'error', 'message' => 'Release not found'], 404);
    }
    if ($user['role'] !== 'admin' && $existing['created_by_user_id'] !== $user['id'] && $existing['distributor_id'] !== ($user['distributor_id'] ?? '')) {
        json_response(['status' => 'error', 'message' => 'Forbidden'], 403);
    }
    $pdo->prepare("DELETE FROM albums WHERE id = ?")->execute([$id]);
    json_response(['status' => 'success', 'message' => 'Release deleted']);
}

json_response(['status' => 'error', 'message' => 'Method not allowed'], 405);
