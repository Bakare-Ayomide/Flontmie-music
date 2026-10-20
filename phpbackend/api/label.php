<?php
/**
 * Flontmie API - Authorized Record Label Operations, Roster, Releases & Catalog Analytics
 * Enforces strict label role & ownership scoping. Never falls back to sample companies.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../artist_enrichment.php';

$user = Auth::requireRole(['label', 'admin']);
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'roster';
$pdo = Database::getConnection();
$input = get_json_input();

$isAdmin = ($user['role'] === 'admin');
$labelId = $user['label_id'] ?? null;

$labelEntity = null;
if (!empty($labelId)) {
    $lStmt = $pdo->prepare("SELECT * FROM labels WHERE id = ? LIMIT 1");
    $lStmt->execute([$labelId]);
    $labelEntity = $lStmt->fetch();
}

// Auto-create label entity from the authenticated label user's real profile if not yet linked
if (!$isAdmin && !$labelEntity) {
    $labelId = !empty($labelId) ? $labelId : ('lbl_' . substr(md5($user['id']), 0, 10));
    $pdo->prepare("
        INSERT IGNORE INTO labels (id, name, contact_email, country, status, distributor_id, created_by_user_id)
        VALUES (?, ?, ?, ?, 'active', ?, ?)
    ")->execute([$labelId, $user['display_name'], $user['email'], $user['country'] ?? 'US', $user['distributor_id'] ?? null, $user['id']]);
    $pdo->prepare("UPDATE users SET label_id = ? WHERE id = ?")->execute([$labelId, $user['id']]);
    $user['label_id'] = $labelId;

    $lStmt = $pdo->prepare("SELECT * FROM labels WHERE id = ? LIMIT 1");
    $lStmt->execute([$labelId]);
    $labelEntity = $lStmt->fetch();
}

$labelName = $labelEntity['name'] ?? $user['display_name'];

// --- 1. GET LABEL ROSTER, RELEASES, TRACKS & REAL METRICS ---
if ($method === 'GET' && ($action === 'roster' || $action === 'overview' || empty($action))) {
    if ($isAdmin) {
        $artStmt = $pdo->query("SELECT * FROM artists WHERE label_id IS NOT NULL OR label_name IS NOT NULL ORDER BY created_at DESC LIMIT 200");
    } else {
        $artStmt = $pdo->prepare("
            SELECT * FROM artists
            WHERE label_id = ? OR label_name = ? OR created_by_user_id = ?
            ORDER BY created_at DESC
        ");
        $artStmt->execute([$labelId, $labelName, $user['id']]);
    }
    $artists = $artStmt->fetchAll();

    $artistIds = [];
    foreach ($artists as &$a) {
        $artistIds[] = $a['id'];
        $a['avatar_url'] = ArtistEnrichment::resolveArtworkUrl($a['avatar_url'] ?? '', $a['id']);
        $a['header_url'] = ArtistEnrichment::resolveArtworkUrl($a['header_url'] ?? $a['avatar_url'], $a['id']);
        $a['genres'] = !empty($a['genres_json']) ? json_decode($a['genres_json'], true) : [];
    }

    // Releases for this label
    if ($isAdmin) {
        $albStmt = $pdo->query("SELECT * FROM albums ORDER BY release_date DESC LIMIT 150");
    } elseif (!empty($artistIds)) {
        $in = implode(',', array_fill(0, count($artistIds), '?'));
        $albStmt = $pdo->prepare("SELECT * FROM albums WHERE label_id = ? OR created_by_user_id = ? OR artist_id IN ($in) ORDER BY release_date DESC");
        $albStmt->execute(array_merge([$labelId, $user['id']], $artistIds));
    } else {
        $albStmt = $pdo->prepare("SELECT * FROM albums WHERE label_id = ? OR created_by_user_id = ? ORDER BY release_date DESC");
        $albStmt->execute([$labelId, $user['id']]);
    }
    $releases = $albStmt->fetchAll();
    foreach ($releases as &$r) {
        $r['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($r['cover_art_url'] ?? '', $r['artist_id'] ?? $r['id']);
    }

    // Tracks for this label
    if ($isAdmin) {
        $trkStmt = $pdo->query("SELECT * FROM tracks WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT 200");
    } elseif (!empty($artistIds)) {
        $in = implode(',', array_fill(0, count($artistIds), '?'));
        $trkStmt = $pdo->prepare("SELECT * FROM tracks WHERE is_deleted = 0 AND (label_id = ? OR uploaded_by_user_id = ? OR artist_id IN ($in)) ORDER BY created_at DESC");
        $trkStmt->execute(array_merge([$labelId, $user['id']], $artistIds));
    } else {
        $trkStmt = $pdo->prepare("SELECT * FROM tracks WHERE is_deleted = 0 AND (label_id = ? OR uploaded_by_user_id = ?) ORDER BY created_at DESC");
        $trkStmt->execute([$labelId, $user['id']]);
    }
    $tracks = $trkStmt->fetchAll();

    $totalStreams = 0;
    $totalFlontmiePlays = 0;
    $totalLikes = 0;
    foreach ($tracks as &$t) {
        $t['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($t['cover_art_url'] ?? '', $t['video_id'] ?? $t['id']);
        $t['audio_url'] = '/phpbackend/api/stream.php?id=' . urlencode($t['id']);
        if (!empty($t['local_video_path'])) {
            $t['video_url'] = '/phpbackend/api/stream.php?id=' . urlencode($t['id']) . '&type=video';
        }
        $totalStreams += (int)($t['stream_count'] ?? 0);
        $totalFlontmiePlays += (int)($t['flontmie_plays'] ?? 0);
        $totalLikes += (int)($t['likes_count'] ?? 0);
        unset($t['local_audio_path'], $t['local_artwork_path'], $t['local_video_path'], $t['local_lyrics_path']);
    }

    json_response([
        'status' => 'success',
        'label' => $labelEntity ?: [
            'id' => $labelId,
            'name' => $labelName,
            'contact_email' => $user['email'],
            'country' => $user['country'] ?? 'US',
            'status' => 'active'
        ],
        'roster' => $artists,
        'releases' => $releases,
        'tracks' => $tracks,
        'metrics' => [
            'total_streams' => $totalStreams,
            'total_flontmie_plays' => $totalFlontmiePlays,
            'total_likes' => $totalLikes,
            'active_signed_artists' => count($artists),
            'releases_count' => count($releases),
            'tracks_count' => count($tracks)
        ]
    ]);
}

// --- 2. CREATE OR UPDATE SIGNED ARTIST UNDER THIS LABEL ---
if ($method === 'POST' && $action === 'save_artist') {
    $artistId = trim($input['id'] ?? $input['artist_id'] ?? '');
    $name = trim($input['name'] ?? '');
    $bio = trim($input['bio'] ?? '');
    $country = strtoupper(substr(trim($input['country'] ?? ($user['country'] ?? 'US')), 0, 2)) ?: 'US';
    $avatarUrl = trim($input['avatar_url'] ?? '');
    $genres = is_array($input['genres'] ?? null) ? $input['genres'] : (!empty($input['genre']) ? [trim($input['genre'])] : ['Afrobeats']);

    if (empty($name)) {
        json_response(['status' => 'error', 'message' => 'Artist name is required.'], 400);
    }

    if (empty($artistId)) {
        $artistId = 'art_' . bin2hex(random_bytes(6));
        $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name)) . '-' . rand(100, 999);
        $pdo->prepare("
            INSERT INTO artists (id, name, stage_name, slug, avatar_url, header_url, bio, country, verified, genres_json, label_id, label_name, distributor_id, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        ")->execute([
            $artistId, $name, $name, $slug, $avatarUrl, $avatarUrl, $bio, $country,
            json_encode($genres), $labelId, $labelName, $user['distributor_id'] ?? null, $user['id']
        ]);
        Auth::logAudit($user['id'], 'LABEL_ARTIST_CREATED', 'ARTIST', $artistId, ['name' => $name, 'label_id' => $labelId]);
        json_response(['status' => 'success', 'message' => "Signed artist '{$name}' added to roster.", 'artist_id' => $artistId], 201);
    } else {
        $chk = $pdo->prepare("SELECT label_id, created_by_user_id FROM artists WHERE id = ? LIMIT 1");
        $chk->execute([$artistId]);
        $existing = $chk->fetch();
        if (!$existing || (!$isAdmin && $existing['label_id'] !== $labelId && $existing['created_by_user_id'] !== $user['id'])) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You can only edit artists signed to your label.'], 403);
        }
        $pdo->prepare("
            UPDATE artists SET name = ?, stage_name = ?, bio = ?, country = ?,
            avatar_url = COALESCE(NULLIF(?, ''), avatar_url), genres_json = ?
            WHERE id = ?
        ")->execute([$name, $name, $bio, $country, $avatarUrl, json_encode($genres), $artistId]);
        json_response(['status' => 'success', 'message' => "Updated signed artist '{$name}'."]);
    }
}

// --- 3. CREATE OR UPDATE LABEL RELEASE ---
if ($method === 'POST' && $action === 'save_release') {
    $title = trim($input['title'] ?? '');
    $artistId = trim($input['artist_id'] ?? '');
    $artistName = trim($input['artist_name'] ?? '');
    $releaseDate = !empty($input['release_date']) ? trim($input['release_date']) : date('Y-m-d');
    $releaseType = in_array($input['release_type'] ?? '', ['album', 'ep', 'single'], true) ? $input['release_type'] : 'single';
    $genre = trim($input['genre'] ?? 'Afrobeats');
    $upc = trim($input['upc'] ?? '');
    $coverUrl = trim($input['cover_art_url'] ?? '');

    if (empty($title) || (empty($artistId) && empty($artistName))) {
        json_response(['status' => 'error', 'message' => 'Release title and signed artist are required.'], 400);
    }

    if (!empty($artistId)) {
        $aStmt = $pdo->prepare("SELECT name, label_id, created_by_user_id FROM artists WHERE id = ? LIMIT 1");
        $aStmt->execute([$artistId]);
        $artRow = $aStmt->fetch();
        if (!$artRow || (!$isAdmin && $artRow['label_id'] !== $labelId && $artRow['created_by_user_id'] !== $user['id'])) {
            json_response(['status' => 'error', 'message' => 'Forbidden: Artist is not signed to your label.'], 403);
        }
        $artistName = $artRow['name'];
    }

    $albumId = 'alb_' . bin2hex(random_bytes(6));
    $pdo->prepare("
        INSERT INTO albums (id, title, artist_id, artist_name, cover_art_url, release_date, release_type, genre, status, upc, label_id, distributor_id, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)
    ")->execute([$albumId, $title, $artistId, $artistName, $coverUrl, $releaseDate, $releaseType, $genre, $upc ?: null, $labelId, $user['distributor_id'] ?? null, $user['id']]);

    Auth::logAudit($user['id'], 'LABEL_RELEASE_CREATED', 'ALBUM', $albumId, ['title' => $title]);
    json_response(['status' => 'success', 'message' => "Created release '{$title}'.", 'album_id' => $albumId], 201);
}

json_response(['status' => 'error', 'message' => 'Invalid label action'], 400);
