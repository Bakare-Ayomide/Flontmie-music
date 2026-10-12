<?php
/**
 * Flontmie API - User & Curated Playlists
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? '';
$pdo = Database::getConnection();

// --- GET SINGLE PLAYLIST ---
if ($method === 'GET' && !empty($id)) {
    $stmt = $pdo->prepare("SELECT * FROM playlists WHERE id = ?");
    $stmt->execute([$id]);
    $playlist = $stmt->fetch();

    if (!$playlist) {
        json_response(['status' => 'error', 'message' => 'Playlist not found'], 404);
    }

    $trackIds = !empty($playlist['track_ids_json']) ? json_decode($playlist['track_ids_json'], true) : [];
    $tracks = [];

    if (!empty($trackIds)) {
        $inQuery = implode(',', array_fill(0, count($trackIds), '?'));
        $trkStmt = $pdo->prepare("SELECT * FROM tracks WHERE id IN ($inQuery) AND is_deleted = 0");
        $trkStmt->execute($trackIds);
        $fetched = $trkStmt->fetchAll();
        $map = [];
        foreach ($fetched as $t) {
            $t['mood_tags'] = !empty($t['mood_tags_json']) ? json_decode($t['mood_tags_json'], true) : [];
            $map[$t['id']] = $t;
        }
        // Preserve order
        foreach ($trackIds as $tid) {
            if (isset($map[$tid])) {
                $tracks[] = $map[$tid];
            }
        }
    }

    $playlist['tracks'] = $tracks;
    json_response(['status' => 'success', 'playlist' => $playlist]);
}

// --- GET PLAYLISTS LIST ---
if ($method === 'GET') {
    $user = Auth::getCurrentUser();
    $userId = $user['id'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM playlists WHERE is_public = 1 OR user_id = ? ORDER BY created_at DESC");
    $stmt->execute([$userId]);
    $playlists = $stmt->fetchAll();

    foreach ($playlists as &$p) {
        $trackIds = !empty($p['track_ids_json']) ? json_decode($p['track_ids_json'], true) : [];
        $p['track_count'] = count($trackIds);
    }

    json_response(['status' => 'success', 'count' => count($playlists), 'playlists' => $playlists]);
}

// --- CREATE PLAYLIST (POST) ---
if ($method === 'POST') {
    $user = Auth::requireAuth();
    $input = get_json_input();

    $title = trim($input['title'] ?? 'My Flontmie Playlist');
    $description = trim($input['description'] ?? '');
    $cover = $input['cover_art_url'] ?? 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
    $tracks = is_array($input['track_ids'] ?? null) ? $input['track_ids'] : [];

    $playlistId = 'ply_' . bin2hex(random_bytes(6));
    $stmt = $pdo->prepare("
        INSERT INTO playlists (id, user_id, title, description, cover_art_url, is_public, track_ids_json)
        VALUES (?, ?, ?, ?, ?, 1, ?)
    ");
    $stmt->execute([$playlistId, $user['id'], $title, $description, $cover, json_encode($tracks)]);

    json_response([
        'status' => 'success',
        'message' => 'Playlist created',
        'playlist_id' => $playlistId
    ], 201);
}

// --- UPDATE PLAYLIST (PUT) ---
if ($method === 'PUT' && !empty($id)) {
    $user = Auth::requireAuth();
    $input = get_json_input();

    // Fetch existing playlist
    $stmt = $pdo->prepare("SELECT * FROM playlists WHERE id = ?");
    $stmt->execute([$id]);
    $playlist = $stmt->fetch();

    if (!$playlist) {
        json_response(['status' => 'error', 'message' => 'Playlist not found'], 404);
    }

    if ($playlist['user_id'] !== $user['id'] && $user['role'] !== 'admin') {
        json_response(['status' => 'error', 'message' => 'Forbidden'], 403);
    }

    $existingTrackIds = !empty($playlist['track_ids_json']) ? json_decode($playlist['track_ids_json'], true) : [];

    // Add track action
    if (!empty($input['add_track_id'])) {
        if (!in_array($input['add_track_id'], $existingTrackIds, true)) {
            $existingTrackIds[] = $input['add_track_id'];
        }
    }

    // Remove track action
    if (!empty($input['remove_track_id'])) {
        $existingTrackIds = array_values(array_filter($existingTrackIds, fn($t) => $t !== $input['remove_track_id']));
    }

    if (isset($input['track_ids']) && is_array($input['track_ids'])) {
        $existingTrackIds = $input['track_ids'];
    }

    $upd = $pdo->prepare("
        UPDATE playlists SET
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            track_ids_json = ?
        WHERE id = ?
    ");
    $upd->execute([
        $input['title'] ?? null,
        $input['description'] ?? null,
        json_encode($existingTrackIds),
        $id
    ]);

    json_response(['status' => 'success', 'message' => 'Playlist updated']);
}

// --- DELETE PLAYLIST (DELETE) ---
if ($method === 'DELETE' && !empty($id)) {
    $user = Auth::requireAuth();
    $stmt = $pdo->prepare("DELETE FROM playlists WHERE id = ? AND (user_id = ? OR ? = 'admin')");
    $stmt->execute([$id, $user['id'], $user['role']]);
    json_response(['status' => 'success', 'message' => 'Playlist deleted']);
}

json_response(['status' => 'error', 'message' => 'Method not allowed'], 405);
