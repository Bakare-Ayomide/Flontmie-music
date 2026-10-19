<?php
/**
 * Flontmie API - Albums & Discography
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../artist_enrichment.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? '';
$pdo = Database::getConnection();

// --- GET SINGLE ALBUM ---
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
        unset($t['local_audio_path'], $t['local_artwork_path']);
    }
    $album['tracks'] = $tracks;

    json_response(['status' => 'success', 'album' => $album]);
}

// --- GET ALBUMS LIST ---
if ($method === 'GET') {
    $artistId = $_GET['artist_id'] ?? '';
    $genre = $_GET['genre'] ?? '';
    $limit = min(50, max(1, (int)($_GET['limit'] ?? 20)));

    $sql = "SELECT * FROM albums WHERE status = 'published'";
    $params = [];

    if (!empty($artistId)) {
        $sql .= " AND artist_id = ?";
        $params[] = $artistId;
    }
    if (!empty($genre)) {
        $sql .= " AND genre = ?";
        $params[] = $genre;
    }

    $sql .= " ORDER BY release_date DESC LIMIT {$limit}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $albums = $stmt->fetchAll();

    foreach ($albums as &$alb) {
        $alb['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($alb['cover_art_url'] ?? '', $alb['artist_id'] ?? $alb['id']);
    }

    json_response(['status' => 'success', 'count' => count($albums), 'albums' => $albums]);
}

// --- CREATE ALBUM (POST) ---
if ($method === 'POST') {
    $user = Auth::requireRole(['distributor', 'label', 'admin']);
    $input = get_json_input();

    $title = trim($input['title'] ?? '');
    $artistId = trim($input['artist_id'] ?? '');
    $artistName = trim($input['artist_name'] ?? '');

    if (empty($title) || empty($artistName)) {
        json_response(['status' => 'error', 'message' => 'Album title and artist are required.'], 400);
    }

    $albumId = 'alb_' . bin2hex(random_bytes(6));
    $cover = $input['cover_art_url'] ?? 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
    $releaseDate = $input['release_date'] ?? date('Y-m-d');
    $releaseType = $input['release_type'] ?? 'album';
    $genre = $input['genre'] ?? 'Afrobeats';
    $status = $input['status'] ?? 'published';
    $upc = $input['upc'] ?? 'FLNT-UPC-' . rand(1000000, 9999999);
    $tracksCount = (int)($input['tracks_count'] ?? 0);
    $distributorId = $user['distributor_id'] ?? 'dist_tunecore';

    $stmt = $pdo->prepare("
        INSERT INTO albums (id, title, artist_id, artist_name, cover_art_url, release_date, release_type, genre, status, upc, tracks_count, distributor_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $albumId, $title, $artistId, $artistName, $cover, $releaseDate, $releaseType, $genre, $status, $upc, $tracksCount, $distributorId
    ]);

    json_response([
        'status' => 'success',
        'message' => 'Album created successfully',
        'album_id' => $albumId
    ], 201);
}

// --- DELETE ALBUM ---
if ($method === 'DELETE' && !empty($id)) {
    $user = Auth::requireRole(['distributor', 'admin']);
    $pdo->prepare("UPDATE albums SET status = 'draft' WHERE id = ?")->execute([$id]);
    json_response(['status' => 'success', 'message' => 'Album archived']);
}

json_response(['status' => 'error', 'message' => 'Method not allowed'], 405);
