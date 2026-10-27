<?php
/**
 * Flontmie API - Playlists Curation & Management Controller
 * Connects every playlist operation to real MySQL records with creator metadata,
 * ordered playlist_tracks relational persistence, and user_activities logging.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../artist_enrichment.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$input = get_json_input();
$pdo = Database::getConnection();
$currentUser = Auth::getCurrentUser();

function syncPlaylistTracksTable(PDO $pdo, string $playlistId, array $trackIds): array {
    $cleanIds = [];
    foreach ($trackIds as $tid) {
        $tid = trim((string)$tid);
        if ($tid !== '' && !in_array($tid, $cleanIds, true)) {
            $cleanIds[] = $tid;
        }
    }

    try {
        $pdo->prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?")->execute([$playlistId]);
        if (!empty($cleanIds)) {
            $ins = $pdo->prepare("
                INSERT IGNORE INTO playlist_tracks (playlist_id, track_id, position)
                VALUES (?, ?, ?)
            ");
            foreach ($cleanIds as $idx => $tid) {
                $ins->execute([$playlistId, $tid, $idx]);
            }
        }
    } catch (Exception $e) {
        error_log("syncPlaylistTracksTable warning: " . $e->getMessage());
    }

    return $cleanIds;
}

function resolvePlaylistTrackIds(PDO $pdo, array $pl): array {
    $trackIds = !empty($pl['track_ids_json']) ? json_decode($pl['track_ids_json'], true) : [];
    if (!is_array($trackIds)) {
        $trackIds = [];
    }
    if (empty($trackIds) && !empty($pl['id'])) {
        try {
            $st = $pdo->prepare("SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC");
            $st->execute([$pl['id']]);
            $trackIds = array_column($st->fetchAll(), 'track_id');
        } catch (Exception $e) {}
    }
    return array_values(array_filter(array_map('strval', $trackIds)));
}

function fetchOrderedPlaylistTracks(PDO $pdo, array $trackIds, ?string $userId = null): array {
    if (empty($trackIds)) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($trackIds), '?'));
    $params = array_merge(array_values($trackIds), array_values($trackIds));
    $stmt = $pdo->prepare("
        SELECT t.*,
               (SELECT COUNT(*) FROM user_favorites uf WHERE uf.track_id = t.id) AS real_likes_count,
               (SELECT COUNT(*) FROM track_comments tc WHERE tc.track_id = t.id) AS real_comments_count
        FROM tracks t
        WHERE (t.id IN ($placeholders) OR t.video_id IN ($placeholders))
          AND t.is_deleted = 0
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $likedMap = [];
    if ($userId) {
        try {
            $lStmt = $pdo->prepare("SELECT track_id FROM user_favorites WHERE user_id = ?");
            $lStmt->execute([$userId]);
            foreach ($lStmt->fetchAll() as $lr) {
                $likedMap[$lr['track_id']] = true;
            }
        } catch (Exception $e) {}
    }

    $byId = [];
    foreach ($rows as $r) {
        $r['likes_count'] = (int)($r['real_likes_count'] ?? $r['likes_count'] ?? 0);
        $r['comments_count'] = (int)($r['real_comments_count'] ?? $r['comments_count'] ?? 0);
        $r['is_liked'] = !empty($likedMap[$r['id']]);
        $r['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($r['cover_art_url'] ?? '', $r['video_id'] ?? $r['id']);
        $r['audio_url'] = '/phpbackend/api/stream.php?id=' . urlencode($r['id']);
        if (!empty($r['local_video_path'])) {
            $r['video_url'] = '/phpbackend/api/stream.php?id=' . urlencode($r['id']) . '&type=video';
        }
        unset($r['local_audio_path'], $r['local_artwork_path'], $r['local_video_path'], $r['local_lyrics_path'], $r['real_likes_count'], $r['real_comments_count']);
        $byId[$r['id']] = $r;
        if (!empty($r['video_id'])) {
            $byId[$r['video_id']] = $r;
        }
    }

    $ordered = [];
    $pos = 1;
    foreach ($trackIds as $tid) {
        if (isset($byId[$tid])) {
            $item = $byId[$tid];
            $item['position'] = $pos++;
            $ordered[] = $item;
        }
    }
    return $ordered;
}

if ($method === 'GET') {
    if (!empty($_GET['id'])) {
        $plId = trim($_GET['id']);
        $stmt = $pdo->prepare("
            SELECT p.*,
                   COALESCE(NULLIF(u.display_name, ''), u.username, 'Flontmie Editorial') AS curator_name,
                   u.username AS creator_username,
                   u.role AS creator_role,
                   u.avatar_url AS curator_avatar
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

        // Check visibility if private
        $isOwnerOrAdmin = $currentUser && ($currentUser['role'] === 'admin' || $currentUser['id'] === ($pl['user_id'] ?? ''));
        if (empty($pl['is_public']) && !$isOwnerOrAdmin) {
            json_response(['status' => 'error', 'message' => 'This playlist is private'], 403);
        }

        $trackIds = resolvePlaylistTrackIds($pdo, $pl);
        $pl['track_ids'] = $trackIds;
        $pl['track_count'] = count($trackIds);
        $pl['is_admin_created'] = (($pl['creator_role'] ?? '') === 'admin') || empty($pl['user_id']);
        $pl['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($pl['cover_art_url'] ?? '', $pl['id']);
        $tracks = fetchOrderedPlaylistTracks($pdo, $trackIds, $currentUser['id'] ?? null);

        json_response([
            'status' => 'success',
            'playlist' => $pl,
            'tracks' => $tracks
        ]);
    }

    if ($currentUser) {
        $stmt = $pdo->prepare("
            SELECT p.*,
                   COALESCE(NULLIF(u.display_name, ''), u.username, 'Flontmie Editorial') AS curator_name,
                   u.username AS creator_username,
                   u.role AS creator_role,
                   u.avatar_url AS curator_avatar
            FROM playlists p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE (p.is_public = 1 OR p.user_id = ?)
              AND (p.status IS NULL OR p.status IN ('active', 'published'))
            ORDER BY p.is_featured DESC, p.created_at DESC
        ");
        $stmt->execute([$currentUser['id']]);
    } else {
        $stmt = $pdo->query("
            SELECT p.*,
                   COALESCE(NULLIF(u.display_name, ''), u.username, 'Flontmie Editorial') AS curator_name,
                   u.username AS creator_username,
                   u.role AS creator_role,
                   u.avatar_url AS curator_avatar
            FROM playlists p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.is_public = 1
              AND (p.status IS NULL OR p.status IN ('active', 'published'))
            ORDER BY p.is_featured DESC, p.created_at DESC
        ");
    }
    $playlists = $stmt->fetchAll();

    foreach ($playlists as &$p) {
        $tIds = resolvePlaylistTrackIds($pdo, $p);
        $p['track_ids'] = $tIds;
        $p['track_count'] = count($tIds);
        $p['is_admin_created'] = (($p['creator_role'] ?? '') === 'admin') || empty($p['user_id']);
        $p['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($p['cover_art_url'] ?? '', $p['id']);
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
    $rawTrackIds = is_array($input['track_ids'] ?? null) ? $input['track_ids'] : [];
    $genreCategory = trim($input['genre_category'] ?? ($input['category'] ?? 'all'));
    $isFeatured = ($user['role'] === 'admin' && !empty($input['is_featured'])) ? 1 : 0;
    $isPublic = isset($input['is_public']) ? ($input['is_public'] ? 1 : 0) : 1;
    $description = trim($input['description'] ?? '');
    $coverArtUrl = trim($input['cover_art_url'] ?? '');

    $cleanTrackIds = syncPlaylistTracksTable($pdo, $id, $rawTrackIds);

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
        $description,
        $coverArtUrl,
        $genreCategory,
        $isPublic,
        $isFeatured,
        json_encode($cleanTrackIds)
    ]);

    Auth::logUserActivity($user, 'playlist_created', 'playlist', $id, $title, [
        'track_count' => count($cleanTrackIds),
        'track_ids' => $cleanTrackIds,
        'is_public' => (bool)$isPublic,
        'creator_role' => $user['role']
    ]);

    json_response([
        'status' => 'success',
        'message' => 'Playlist saved to database',
        'id' => $id,
        'playlist' => [
            'id' => $id,
            'user_id' => $user['id'],
            'title' => $title,
            'description' => $description,
            'cover_art_url' => $coverArtUrl,
            'genre_category' => $genreCategory,
            'curator_name' => $user['display_name'],
            'creator_username' => $user['username'] ?? '',
            'creator_role' => $user['role'],
            'is_admin_created' => $user['role'] === 'admin',
            'is_public' => $isPublic,
            'track_ids' => $cleanTrackIds,
            'track_count' => count($cleanTrackIds)
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
        $title = trim($input['title'] ?? 'Playlist');
        $cleanTrackIds = syncPlaylistTracksTable($pdo, $playlistId, is_array($trackIds) ? $trackIds : []);
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
            json_encode($cleanTrackIds)
        ]);

        Auth::logUserActivity($user, 'playlist_created', 'playlist', $playlistId, $title, [
            'track_count' => count($cleanTrackIds),
            'track_ids' => $cleanTrackIds,
            'is_public' => true,
            'creator_role' => $user['role']
        ]);

        json_response([
            'status' => 'success',
            'message' => 'Playlist created and updated',
            'playlist_id' => $playlistId,
            'track_ids' => $cleanTrackIds,
            'track_count' => count($cleanTrackIds)
        ]);
    }

    if ($user['role'] !== 'admin' && $pl['user_id'] !== $user['id']) {
        json_response(['status' => 'error', 'message' => 'You can only modify playlists you created.'], 403);
    }

    $finalTitle = (isset($input['title']) && trim($input['title']) !== '') ? trim($input['title']) : $pl['title'];
    $cleanTrackIds = null;

    if (is_array($trackIds)) {
        $cleanTrackIds = syncPlaylistTracksTable($pdo, $playlistId, $trackIds);
        $stmt = $pdo->prepare("UPDATE playlists SET track_ids_json = ? WHERE id = ?");
        $stmt->execute([json_encode($cleanTrackIds), $playlistId]);
    }
    if (isset($input['title']) && trim($input['title']) !== '') {
        $pdo->prepare("UPDATE playlists SET title = ? WHERE id = ?")->execute([$finalTitle, $playlistId]);
    }
    if (isset($input['description'])) {
        $pdo->prepare("UPDATE playlists SET description = ? WHERE id = ?")->execute([trim($input['description']), $playlistId]);
    }
    if (isset($input['cover_art_url'])) {
        $pdo->prepare("UPDATE playlists SET cover_art_url = ? WHERE id = ?")->execute([trim($input['cover_art_url']), $playlistId]);
    }
    if (isset($input['is_public'])) {
        $pdo->prepare("UPDATE playlists SET is_public = ? WHERE id = ?")->execute([$input['is_public'] ? 1 : 0, $playlistId]);
    }

    $effectiveTracks = $cleanTrackIds !== null ? $cleanTrackIds : resolvePlaylistTrackIds($pdo, $pl);

    Auth::logUserActivity($user, 'playlist_updated', 'playlist', $playlistId, $finalTitle, [
        'track_count' => count($effectiveTracks),
        'track_ids' => $effectiveTracks
    ]);

    json_response([
        'status' => 'success',
        'message' => 'Playlist updated',
        'playlist_id' => $playlistId,
        'track_ids' => $effectiveTracks,
        'track_count' => count($effectiveTracks)
    ]);
}

if ($method === 'DELETE' || ($method === 'POST' && $action === 'delete')) {
    $user = Auth::requireAuth();
    $playlistId = trim($_GET['id'] ?? $input['id'] ?? '');
    if (empty($playlistId)) {
        json_response(['status' => 'error', 'message' => 'Playlist ID required'], 400);
    }

    $chk = $pdo->prepare("SELECT * FROM playlists WHERE id = ? LIMIT 1");
    $chk->execute([$playlistId]);
    $pl = $chk->fetch();
    if (!$pl) {
        json_response(['status' => 'error', 'message' => 'Playlist not found'], 404);
    }

    if ($user['role'] !== 'admin' && $pl['user_id'] !== $user['id']) {
        json_response(['status' => 'error', 'message' => 'Forbidden'], 403);
    }

    $pdo->prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?")->execute([$playlistId]);
    $pdo->prepare("DELETE FROM playlists WHERE id = ?")->execute([$playlistId]);

    Auth::logUserActivity($user, 'playlist_deleted', 'playlist', $playlistId, $pl['title'] ?? $playlistId, []);

    json_response(['status' => 'success', 'message' => 'Playlist deleted']);
}

json_response(['status' => 'error', 'message' => 'Invalid playlists request'], 400);
