<?php
/**
 * Flontmie API - Playlists Curation & Management Controller
 * Connects every playlist operation to real MySQL records with zero mock defaults.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$input = get_json_input();
$pdo = Database::getConnection();

if ($method === 'GET') {
    if (!empty($_GET['id'])) {
        $plId = trim($_GET['id']);
        $stmt = $pdo->prepare("
            SELECT p.*, u.display_name AS curator_name, u.avatar_url AS curator_avatar
            FROM playlists p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.id = ?
            LIMIT 1
        ");
        $stmt->execute([$plId]);
        $pl = $stmt->fetch();
        if (!$pl) {
            json_response(['status' => 'error', 'message' => 'Playlist not found'], 404);
        }
        $trackIds = !empty($pl['track_ids_json']) ? json_decode($pl['track_ids_json'], true) : [];
        $pl['track_ids'] = is_array($trackIds) ? $trackIds : [];
        $tracks = [];
        if (!empty($pl['track_ids'])) {
            $placeholders = implode(',', array_fill(0, count($pl['track_ids']), '?'));
            $tStmt = $pdo->prepare("SELECT * FROM tracks WHERE id IN ($placeholders) AND is_deleted = 0");
            $tStmt->execute(array_values($pl['track_ids']));
            $tracks = $tStmt->fetchAll();
        }
        json_response([
            'status' => 'success',
            'playlist' => $pl,
            'tracks' => $tracks
        ]);
    }

    $stmt = $pdo->query("
        SELECT p.*, u.display_name AS curator_name, u.avatar_url AS curator_avatar
        FROM playlists p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.is_public = 1 AND (p.status IS NULL OR p.status = 'active')
        ORDER BY p.is_featured DESC, p.created_at DESC
    ");
    $playlists = $stmt->fetchAll();

    foreach ($playlists as &$p) {
        $p['track_ids'] = !empty($p['track_ids_json']) ? json_decode($p['track_ids_json'], true) : [];
    }

    json_response([
        'status' => 'success',
        'count' => count($playlists),
        'playlists' => $playlists
    ]);
}

if ($method === 'POST' && ($action === '' || $action === 'create')) {
    $user = Auth::requireAuth();
    $title = trim($input['title'] ?? '');
    if (empty($title)) {
        json_response(['status' => 'error', 'message' => 'Playlist title is required'], 400);
    }

    $id = !empty($input['id']) ? trim($input['id']) : ('pl_' . bin2hex(random_bytes(5)));
    $trackIds = $input['track_ids'] ?? [];
    $genreCategory = trim($input['genre_category'] ?? ($input['category'] ?? 'all'));
    $isFeatured = ($user['role'] === 'admin' && !empty($input['is_featured'])) ? 1 : 0;

    $stmt = $pdo->prepare("
        INSERT INTO playlists (id, user_id, title, description, cover_art_url, genre_category, is_public, is_featured, status, track_ids_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            description = VALUES(description),
            cover_art_url = IF(VALUES(cover_art_url) != '', VALUES(cover_art_url), cover_art_url),
            genre_category = VALUES(genre_category),
            is_public = VALUES(is_public),
            track_ids_json = VALUES(track_ids_json)
    ");

    $stmt->execute([
        $id,
        $user['id'],
        $title,
        trim($input['description'] ?? ''),
        trim($input['cover_art_url'] ?? ''),
        $genreCategory,
        isset($input['is_public']) ? ($input['is_public'] ? 1 : 0) : 1,
        $isFeatured,
        json_encode(array_values($trackIds))
    ]);

    json_response([
        'status' => 'success',
        'message' => 'Playlist saved to database',
        'id' => $id,
        'playlist' => [
            'id' => $id,
            'title' => $title,
            'description' => trim($input['description'] ?? ''),
            'cover_art_url' => trim($input['cover_art_url'] ?? ''),
            'genre_category' => $genreCategory,
            'curator_name' => $user['display_name'],
            'is_public' => isset($input['is_public']) ? ($input['is_public'] ? 1 : 0) : 1,
            'track_ids' => array_values($trackIds)
        ]
    ], 201);
}

if ($method === 'PUT' || ($method === 'POST' && $action === 'update')) {
    $user = Auth::requireAuth();
    $playlistId = trim($_GET['id'] ?? $input['id'] ?? '');
    $trackIds = $input['track_ids'] ?? null;

    if (empty($playlistId)) {
        json_response(['status' => 'error', 'message' => 'Playlist ID is required'], 400);
    }

    $chk = $pdo->prepare("SELECT * FROM playlists WHERE id = ? LIMIT 1");
    $chk->execute([$playlistId]);
    $pl = $chk->fetch();

    if (!$pl) {
        // If updating a playlist that isn't persisted yet, create it for the user
        $title = trim($input['title'] ?? 'Playlist');
        $stmt = $pdo->prepare("
            INSERT INTO playlists (id, user_id, title, description, cover_art_url, is_public, status, track_ids_json)
            VALUES (?, ?, ?, ?, ?, 1, 'active', ?)
        ");
        $stmt->execute([
            $playlistId,
            $user['id'],
            $title,
            trim($input['description'] ?? ''),
            trim($input['cover_art_url'] ?? ''),
            json_encode(is_array($trackIds) ? array_values($trackIds) : [])
        ]);
        json_response(['status' => 'success', 'message' => 'Playlist created and updated']);
    }

    if ($user['role'] !== 'admin' && $pl['user_id'] !== $user['id']) {
        json_response(['status' => 'error', 'message' => 'You can only modify playlists you created.'], 403);
    }

    if (is_array($trackIds)) {
        $stmt = $pdo->prepare("UPDATE playlists SET track_ids_json = ? WHERE id = ?");
        $stmt->execute([json_encode(array_values($trackIds)), $playlistId]);
    }
    if (isset($input['title']) && trim($input['title']) !== '') {
        $pdo->prepare("UPDATE playlists SET title = ? WHERE id = ?")->execute([trim($input['title']), $playlistId]);
    }
    if (isset($input['description'])) {
        $pdo->prepare("UPDATE playlists SET description = ? WHERE id = ?")->execute([trim($input['description']), $playlistId]);
    }
    if (isset($input['cover_art_url'])) {
        $pdo->prepare("UPDATE playlists SET cover_art_url = ? WHERE id = ?")->execute([trim($input['cover_art_url']), $playlistId]);
    }

    json_response(['status' => 'success', 'message' => 'Playlist updated']);
}

if ($method === 'DELETE' || ($method === 'POST' && $action === 'delete')) {
    $user = Auth::requireAuth();
    $playlistId = trim($_GET['id'] ?? $input['id'] ?? '');
    if (empty($playlistId)) {
        json_response(['status' => 'error', 'message' => 'Playlist ID required'], 400);
    }

    if ($user['role'] === 'admin') {
        $stmt = $pdo->prepare("DELETE FROM playlists WHERE id = ?");
        $stmt->execute([$playlistId]);
    } else {
        $stmt = $pdo->prepare("DELETE FROM playlists WHERE id = ? AND user_id = ?");
        $stmt->execute([$playlistId, $user['id']]);
    }
    json_response(['status' => 'success', 'message' => 'Playlist deleted']);
}

json_response(['status' => 'error', 'message' => 'Invalid playlists request'], 400);
