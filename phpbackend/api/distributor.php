<?php
/**
 * Flontmie API - Authorized Distributor Operations, Roster, Labels, Releases, Tracks & Claims
 * Strictly enforces distributor role & ownership scoping so each distributor manages only
 * the artists, labels, releases, and tracks they created or are authorized to manage.
 * Zero mock data or prefilled company names.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../artist_enrichment.php';

$user = Auth::requireRole(['distributor', 'admin']);
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'overview';
$pdo = Database::getConnection();
$input = get_json_input();

$isAdmin = ($user['role'] === 'admin');
$distId = $user['distributor_id'] ?? null;

// Resolve distributor entity record if user is a distributor
$distributorEntity = null;
if (!empty($distId)) {
    $dStmt = $pdo->prepare("SELECT * FROM distributors WHERE id = ? LIMIT 1");
    $dStmt->execute([$distId]);
    $distributorEntity = $dStmt->fetch();
}

// If a distributor user doesn't have a linked distributor record yet, auto-create one from their real user profile
if (!$isAdmin && !$distributorEntity) {
    $distId = !empty($distId) ? $distId : ('dist_' . substr(md5($user['id']), 0, 10));
    $pdo->prepare("
        INSERT IGNORE INTO distributors (id, name, contact_email, status, access_level, created_by_user_id)
        VALUES (?, ?, ?, 'approved', 'full_ingestion', ?)
    ")->execute([$distId, $user['display_name'], $user['email'], $user['id']]);
    $pdo->prepare("UPDATE users SET distributor_id = ? WHERE id = ?")->execute([$distId, $user['id']]);
    $user['distributor_id'] = $distId;

    $dStmt = $pdo->prepare("SELECT * FROM distributors WHERE id = ? LIMIT 1");
    $dStmt->execute([$distId]);
    $distributorEntity = $dStmt->fetch();
}

$distName = $distributorEntity['name'] ?? $user['display_name'];

// --- 1. FULL DISTRIBUTOR DASHBOARD OVERVIEW ---
if ($method === 'GET' && ($action === 'overview' || empty($action))) {
    // Artists managed by this distributor
    if ($isAdmin && !empty($_GET['distributor_id'])) {
        $targetDistId = trim($_GET['distributor_id']);
        $artStmt = $pdo->prepare("SELECT * FROM artists WHERE distributor_id = ? ORDER BY created_at DESC");
        $artStmt->execute([$targetDistId]);
    } elseif ($isAdmin) {
        $artStmt = $pdo->query("SELECT * FROM artists ORDER BY created_at DESC LIMIT 200");
    } else {
        $artStmt = $pdo->prepare("SELECT * FROM artists WHERE distributor_id = ? OR created_by_user_id = ? ORDER BY created_at DESC");
        $artStmt->execute([$distId, $user['id']]);
    }
    $artists = $artStmt->fetchAll();
    foreach ($artists as &$a) {
        $a['avatar_url'] = ArtistEnrichment::resolveArtworkUrl($a['avatar_url'] ?? '', $a['id']);
        $a['header_url'] = ArtistEnrichment::resolveArtworkUrl($a['header_url'] ?? $a['avatar_url'], $a['id']);
        $a['genres'] = !empty($a['genres_json']) ? json_decode($a['genres_json'], true) : [];
        $a['social_links'] = !empty($a['social_links_json']) ? json_decode($a['social_links_json'], true) : [];
    }

    // Record Labels managed by this distributor
    if ($isAdmin) {
        $lblStmt = $pdo->query("SELECT * FROM labels ORDER BY created_at DESC LIMIT 200");
    } else {
        $lblStmt = $pdo->prepare("SELECT * FROM labels WHERE distributor_id = ? OR created_by_user_id = ? ORDER BY created_at DESC");
        $lblStmt->execute([$distId, $user['id']]);
    }
    $labels = $lblStmt->fetchAll();

    // Albums / Releases managed by this distributor
    if ($isAdmin) {
        $albStmt = $pdo->query("SELECT * FROM albums ORDER BY created_at DESC LIMIT 200");
    } else {
        $albStmt = $pdo->prepare("SELECT * FROM albums WHERE distributor_id = ? OR created_by_user_id = ? ORDER BY created_at DESC");
        $albStmt->execute([$distId, $user['id']]);
    }
    $releases = $albStmt->fetchAll();
    foreach ($releases as &$r) {
        $r['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($r['cover_art_url'] ?? '', $r['artist_id'] ?? $r['id']);
    }

    // Tracks uploaded/managed by this distributor
    if ($isAdmin) {
        $trkStmt = $pdo->query("
            SELECT id, video_id, title, artist_id, artist_name, album_id, album_name, duration, genre, country,
                   release_year, release_date, cover_art_url, audio_url, video_url, local_audio_path, local_video_path,
                   local_lyrics_path, lyrics, isrc, explicit, status, stream_count, flontmie_plays, likes_count,
                   distributor_id, label_id, uploaded_by_user_id, created_at
            FROM tracks
            WHERE is_deleted = 0
            ORDER BY created_at DESC
            LIMIT 250
        ");
    } else {
        $trkStmt = $pdo->prepare("
            SELECT id, video_id, title, artist_id, artist_name, album_id, album_name, duration, genre, country,
                   release_year, release_date, cover_art_url, audio_url, video_url, local_audio_path, local_video_path,
                   local_lyrics_path, lyrics, isrc, explicit, status, stream_count, flontmie_plays, likes_count,
                   distributor_id, label_id, uploaded_by_user_id, created_at
            FROM tracks
            WHERE is_deleted = 0 AND (distributor_id = ? OR uploaded_by_user_id = ?)
            ORDER BY created_at DESC
        ");
        $trkStmt->execute([$distId, $user['id']]);
    }
    $tracks = $trkStmt->fetchAll();
    $totalStreams = 0;
    $totalFlontmiePlays = 0;
    $totalLikes = 0;

    foreach ($tracks as &$t) {
        $t['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($t['cover_art_url'] ?? '', $t['video_id'] ?? $t['id']);
        $t['has_local_audio'] = !empty($t['local_audio_path']);
        $t['has_local_video'] = !empty($t['local_video_path']) || !empty($t['video_url']);
        $t['has_lyrics'] = !empty($t['lyrics']) || !empty($t['local_lyrics_path']);
        $t['audio_url'] = '/phpbackend/api/stream.php?id=' . urlencode($t['id']);
        if (!empty($t['local_video_path'])) {
            $t['video_url'] = '/phpbackend/api/stream.php?id=' . urlencode($t['id']) . '&type=video';
        }
        $totalStreams += (int)($t['stream_count'] ?? 0);
        $totalFlontmiePlays += (int)($t['flontmie_plays'] ?? 0);
        $totalLikes += (int)($t['likes_count'] ?? 0);
        unset($t['local_audio_path'], $t['local_video_path'], $t['local_lyrics_path']);
    }

    // Claims pending for this distributor's artists
    if ($isAdmin) {
        $clmStmt = $pdo->query("
            SELECT c.*, a.name AS artist_name, a.avatar_url AS artist_avatar
            FROM artist_claims c
            JOIN artists a ON c.artist_id = a.id
            ORDER BY c.created_at DESC
        ");
    } else {
        $clmStmt = $pdo->prepare("
            SELECT c.*, a.name AS artist_name, a.avatar_url AS artist_avatar
            FROM artist_claims c
            JOIN artists a ON c.artist_id = a.id
            WHERE c.distributor_id = ? OR a.distributor_id = ? OR a.created_by_user_id = ?
            ORDER BY c.created_at DESC
        ");
        $clmStmt->execute([$distId, $distId, $user['id']]);
    }
    $claims = $clmStmt->fetchAll();

    json_response([
        'status' => 'success',
        'distributor' => $distributorEntity ?: [
            'id' => $distId,
            'name' => $user['display_name'],
            'contact_email' => $user['email'],
            'status' => 'approved',
            'access_level' => 'full_ingestion'
        ],
        'metrics' => [
            'artists_count' => count($artists),
            'labels_count' => count($labels),
            'releases_count' => count($releases),
            'tracks_count' => count($tracks),
            'pending_claims_count' => count(array_filter($claims, fn($c) => ($c['status'] ?? '') === 'pending')),
            'total_streams' => $totalStreams,
            'total_flontmie_plays' => $totalFlontmiePlays,
            'total_likes' => $totalLikes
        ],
        'artists' => $artists,
        'labels' => $labels,
        'releases' => $releases,
        'tracks' => $tracks,
        'claims' => $claims
    ]);
}

// --- 2. LEGACY / INDIVIDUAL GET ACTIONS ---
if ($method === 'GET' && $action === 'artists') {
    if ($isAdmin) {
        $stmt = $pdo->query("SELECT * FROM artists ORDER BY created_at DESC LIMIT 200");
    } else {
        $stmt = $pdo->prepare("SELECT * FROM artists WHERE distributor_id = ? OR created_by_user_id = ? ORDER BY created_at DESC");
        $stmt->execute([$distId, $user['id']]);
    }
    $artists = $stmt->fetchAll();
    foreach ($artists as &$a) {
        $a['genres'] = !empty($a['genres_json']) ? json_decode($a['genres_json'], true) : [];
        $a['social_links'] = !empty($a['social_links_json']) ? json_decode($a['social_links_json'], true) : [];
    }
    json_response(['status' => 'success', 'artists' => $artists]);
}

if ($method === 'GET' && $action === 'releases') {
    if ($isAdmin) {
        $stmt = $pdo->query("SELECT * FROM albums ORDER BY created_at DESC LIMIT 200");
    } else {
        $stmt = $pdo->prepare("SELECT * FROM albums WHERE distributor_id = ? OR created_by_user_id = ? ORDER BY created_at DESC");
        $stmt->execute([$distId, $user['id']]);
    }
    json_response(['status' => 'success', 'releases' => $stmt->fetchAll()]);
}

if ($method === 'GET' && $action === 'claims') {
    if ($isAdmin) {
        $stmt = $pdo->query("
            SELECT c.*, a.name AS artist_name, a.avatar_url AS artist_avatar
            FROM artist_claims c
            JOIN artists a ON c.artist_id = a.id
            ORDER BY c.created_at DESC
        ");
    } else {
        $stmt = $pdo->prepare("
            SELECT c.*, a.name AS artist_name, a.avatar_url AS artist_avatar
            FROM artist_claims c
            JOIN artists a ON c.artist_id = a.id
            WHERE c.distributor_id = ? OR a.distributor_id = ? OR a.created_by_user_id = ?
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$distId, $distId, $user['id']]);
    }
    json_response(['status' => 'success', 'claims' => $stmt->fetchAll()]);
}

// --- 3. CREATE OR UPDATE ARTIST (SCOPED TO DISTRIBUTOR) ---
if ($method === 'POST' && $action === 'save_artist') {
    $artistId = trim($input['id'] ?? $input['artist_id'] ?? '');
    $name = trim($input['name'] ?? $input['stage_name'] ?? '');
    $bio = trim($input['bio'] ?? '');
    $avatarUrl = trim($input['avatar_url'] ?? '');
    $headerUrl = trim($input['header_url'] ?? $avatarUrl);
    $country = strtoupper(substr(trim($input['country'] ?? 'US'), 0, 2)) ?: 'US';
    $labelId = !empty($input['label_id']) ? trim($input['label_id']) : null;
    $labelName = trim($input['label_name'] ?? '');
    $genres = is_array($input['genres'] ?? null) ? $input['genres'] : (!empty($input['genre']) ? [trim($input['genre'])] : ['Afrobeats']);
    $socials = is_array($input['social_links'] ?? null) ? $input['social_links'] : [];

    if (empty($name)) {
        json_response(['status' => 'error', 'message' => 'Artist name is required.'], 400);
    }

    if (!empty($labelId) && empty($labelName)) {
        $lStmt = $pdo->prepare("SELECT name FROM labels WHERE id = ? LIMIT 1");
        $lStmt->execute([$labelId]);
        $labelName = (string)($lStmt->fetchColumn() ?: '');
    }

    if (empty($artistId)) {
        $artistId = 'art_' . bin2hex(random_bytes(6));
        $slug = strtolower(preg_replace('/[^A-Za-z0-9-]+/', '-', $name)) . '-' . rand(100, 999);
        $pdo->prepare("
            INSERT INTO artists (id, name, stage_name, slug, avatar_url, header_url, bio, country, verified, genres_json, social_links_json, created_by_distributor, distributor_name, distributor_id, label_id, label_name, claimed_status, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 'unclaimed', ?)
        ")->execute([
            $artistId, $name, $name, $slug, $avatarUrl, $headerUrl, $bio, $country,
            json_encode($genres), json_encode($socials), $distName, $distName, $distId, $labelId, $labelName ?: null, $user['id']
        ]);

        Auth::logAudit($user['id'], 'DISTRIBUTOR_ARTIST_CREATED', 'ARTIST', $artistId, ['name' => $name, 'distributor_id' => $distId]);
        json_response([
            'status' => 'success',
            'message' => "Created artist profile '{$name}'.",
            'artist_id' => $artistId
        ], 201);
    } else {
        // Verify ownership
        $chk = $pdo->prepare("SELECT distributor_id, created_by_user_id FROM artists WHERE id = ? LIMIT 1");
        $chk->execute([$artistId]);
        $existing = $chk->fetch();
        if (!$existing) {
            json_response(['status' => 'error', 'message' => 'Artist not found.'], 404);
        }
        if (!$isAdmin && $existing['distributor_id'] !== $distId && $existing['created_by_user_id'] !== $user['id']) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You can only manage artists created under your distributor account.'], 403);
        }

        $pdo->prepare("
            UPDATE artists
            SET name = ?, stage_name = ?, bio = ?,
                avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
                header_url = COALESCE(NULLIF(?, ''), header_url),
                country = ?, genres_json = ?, social_links_json = ?,
                label_id = ?, label_name = ?
            WHERE id = ?
        ")->execute([
            $name, $name, $bio, $avatarUrl, $headerUrl, $country,
            json_encode($genres), json_encode($socials), $labelId, $labelName ?: null, $artistId
        ]);
        $pdo->prepare("UPDATE tracks SET artist_name = ? WHERE artist_id = ?")->execute([$name, $artistId]);
        $pdo->prepare("UPDATE albums SET artist_name = ? WHERE artist_id = ?")->execute([$name, $artistId]);

        Auth::logAudit($user['id'], 'DISTRIBUTOR_ARTIST_UPDATED', 'ARTIST', $artistId, ['name' => $name]);
        json_response(['status' => 'success', 'message' => "Updated artist '{$name}'.", 'artist_id' => $artistId]);
    }
}

if ($method === 'POST' && $action === 'delete_artist') {
    $artistId = trim($input['artist_id'] ?? $input['id'] ?? '');
    $chk = $pdo->prepare("SELECT distributor_id, created_by_user_id FROM artists WHERE id = ? LIMIT 1");
    $chk->execute([$artistId]);
    $existing = $chk->fetch();
    if (!$existing) {
        json_response(['status' => 'error', 'message' => 'Artist not found.'], 404);
    }
    if (!$isAdmin && $existing['distributor_id'] !== $distId && $existing['created_by_user_id'] !== $user['id']) {
        json_response(['status' => 'error', 'message' => 'Forbidden: You can only delete artists you created.'], 403);
    }
    $pdo->prepare("DELETE FROM artists WHERE id = ?")->execute([$artistId]);
    Auth::logAudit($user['id'], 'DISTRIBUTOR_ARTIST_DELETED', 'ARTIST', $artistId);
    json_response(['status' => 'success', 'message' => 'Artist deleted.']);
}

// --- 4. CREATE OR UPDATE RECORD LABEL (SCOPED TO DISTRIBUTOR) ---
if ($method === 'POST' && $action === 'save_label') {
    $labelId = trim($input['id'] ?? $input['label_id'] ?? '');
    $name = trim($input['name'] ?? '');
    $contactEmail = strtolower(trim($input['contact_email'] ?? ''));
    $websiteUrl = trim($input['website_url'] ?? '');
    $country = strtoupper(substr(trim($input['country'] ?? 'US'), 0, 2)) ?: 'US';
    $description = trim($input['description'] ?? '');
    $logoUrl = trim($input['logo_url'] ?? '');

    if (empty($name)) {
        json_response(['status' => 'error', 'message' => 'Record label name is required.'], 400);
    }

    if (empty($labelId)) {
        $labelId = 'lbl_' . bin2hex(random_bytes(5));
        $pdo->prepare("
            INSERT INTO labels (id, name, contact_email, website_url, logo_url, description, country, status, distributor_id, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        ")->execute([$labelId, $name, $contactEmail, $websiteUrl, $logoUrl, $description, $country, $distId, $user['id']]);
        Auth::logAudit($user['id'], 'DISTRIBUTOR_LABEL_CREATED', 'LABEL', $labelId, ['name' => $name, 'distributor_id' => $distId]);
        json_response(['status' => 'success', 'message' => "Created record label '{$name}'.", 'label_id' => $labelId], 201);
    } else {
        $chk = $pdo->prepare("SELECT distributor_id, created_by_user_id FROM labels WHERE id = ? LIMIT 1");
        $chk->execute([$labelId]);
        $existing = $chk->fetch();
        if (!$existing) {
            json_response(['status' => 'error', 'message' => 'Label not found.'], 404);
        }
        if (!$isAdmin && $existing['distributor_id'] !== $distId && $existing['created_by_user_id'] !== $user['id']) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You can only edit labels under your distributor account.'], 403);
        }
        $pdo->prepare("
            UPDATE labels
            SET name = ?, contact_email = ?, website_url = ?,
                logo_url = COALESCE(NULLIF(?, ''), logo_url),
                description = ?, country = ?
            WHERE id = ?
        ")->execute([$name, $contactEmail, $websiteUrl, $logoUrl, $description, $country, $labelId]);
        Auth::logAudit($user['id'], 'DISTRIBUTOR_LABEL_UPDATED', 'LABEL', $labelId, ['name' => $name]);
        json_response(['status' => 'success', 'message' => "Updated record label '{$name}'.", 'label_id' => $labelId]);
    }
}

if ($method === 'POST' && $action === 'delete_label') {
    $labelId = trim($input['label_id'] ?? $input['id'] ?? '');
    $chk = $pdo->prepare("SELECT distributor_id, created_by_user_id FROM labels WHERE id = ? LIMIT 1");
    $chk->execute([$labelId]);
    $existing = $chk->fetch();
    if (!$existing) {
        json_response(['status' => 'error', 'message' => 'Label not found.'], 404);
    }
    if (!$isAdmin && $existing['distributor_id'] !== $distId && $existing['created_by_user_id'] !== $user['id']) {
        json_response(['status' => 'error', 'message' => 'Forbidden.'], 403);
    }
    $pdo->prepare("DELETE FROM labels WHERE id = ?")->execute([$labelId]);
    Auth::logAudit($user['id'], 'DISTRIBUTOR_LABEL_DELETED', 'LABEL', $labelId);
    json_response(['status' => 'success', 'message' => 'Record label deleted.']);
}

// --- 5. CREATE OR UPDATE RELEASE / ALBUM (SCOPED TO DISTRIBUTOR) ---
if ($method === 'POST' && $action === 'save_release') {
    $albumId = trim($input['id'] ?? $input['album_id'] ?? '');
    $title = trim($input['title'] ?? '');
    $artistId = trim($input['artist_id'] ?? '');
    $artistName = trim($input['artist_name'] ?? '');
    $coverUrl = trim($input['cover_art_url'] ?? '');
    $releaseDate = !empty($input['release_date']) ? trim($input['release_date']) : date('Y-m-d');
    $releaseType = in_array($input['release_type'] ?? '', ['album', 'ep', 'single'], true) ? $input['release_type'] : 'single';
    $genre = trim($input['genre'] ?? 'Afrobeats');
    $upc = trim($input['upc'] ?? '');
    $labelId = !empty($input['label_id']) ? trim($input['label_id']) : null;

    if (empty($title) || (empty($artistId) && empty($artistName))) {
        json_response(['status' => 'error', 'message' => 'Release title and artist are required.'], 400);
    }

    // Verify the artist belongs to this distributor
    if (!empty($artistId)) {
        $aStmt = $pdo->prepare("SELECT id, name, distributor_id, created_by_user_id, label_id FROM artists WHERE id = ? LIMIT 1");
        $aStmt->execute([$artistId]);
        $artRow = $aStmt->fetch();
        if (!$artRow) {
            json_response(['status' => 'error', 'message' => 'Selected artist not found.'], 404);
        }
        if (!$isAdmin && $artRow['distributor_id'] !== $distId && $artRow['created_by_user_id'] !== $user['id']) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You can only create releases for artists managed by your distributor account.'], 403);
        }
        $artistName = $artRow['name'];
        if (empty($labelId) && !empty($artRow['label_id'])) {
            $labelId = $artRow['label_id'];
        }
    }

    if (empty($albumId)) {
        $albumId = 'alb_' . bin2hex(random_bytes(6));
        $pdo->prepare("
            INSERT INTO albums (id, title, artist_id, artist_name, cover_art_url, release_date, release_type, genre, status, upc, distributor_id, label_id, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)
        ")->execute([$albumId, $title, $artistId, $artistName, $coverUrl, $releaseDate, $releaseType, $genre, $upc ?: null, $distId, $labelId, $user['id']]);
        Auth::logAudit($user['id'], 'DISTRIBUTOR_RELEASE_CREATED', 'ALBUM', $albumId, ['title' => $title]);
        json_response(['status' => 'success', 'message' => "Created {$releaseType} '{$title}'.", 'album_id' => $albumId], 201);
    } else {
        $chk = $pdo->prepare("SELECT distributor_id, created_by_user_id FROM albums WHERE id = ? LIMIT 1");
        $chk->execute([$albumId]);
        $existing = $chk->fetch();
        if (!$existing) {
            json_response(['status' => 'error', 'message' => 'Release not found.'], 404);
        }
        if (!$isAdmin && $existing['distributor_id'] !== $distId && $existing['created_by_user_id'] !== $user['id']) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You can only edit releases you created.'], 403);
        }
        $pdo->prepare("
            UPDATE albums
            SET title = ?, artist_id = ?, artist_name = ?,
                cover_art_url = COALESCE(NULLIF(?, ''), cover_art_url),
                release_date = ?, release_type = ?, genre = ?, upc = ?, label_id = ?
            WHERE id = ?
        ")->execute([$title, $artistId, $artistName, $coverUrl, $releaseDate, $releaseType, $genre, $upc ?: null, $labelId, $albumId]);
        json_response(['status' => 'success', 'message' => "Updated release '{$title}'.", 'album_id' => $albumId]);
    }
}

if ($method === 'POST' && $action === 'delete_release') {
    $albumId = trim($input['album_id'] ?? $input['id'] ?? '');
    $chk = $pdo->prepare("SELECT distributor_id, created_by_user_id FROM albums WHERE id = ? LIMIT 1");
    $chk->execute([$albumId]);
    $existing = $chk->fetch();
    if (!$existing) {
        json_response(['status' => 'error', 'message' => 'Release not found.'], 404);
    }
    if (!$isAdmin && $existing['distributor_id'] !== $distId && $existing['created_by_user_id'] !== $user['id']) {
        json_response(['status' => 'error', 'message' => 'Forbidden.'], 403);
    }
    $pdo->prepare("DELETE FROM albums WHERE id = ?")->execute([$albumId]);
    Auth::logAudit($user['id'], 'DISTRIBUTOR_RELEASE_DELETED', 'ALBUM', $albumId);
    json_response(['status' => 'success', 'message' => 'Release deleted.']);
}

// --- 6. UPDATE OR DELETE TRACK (SCOPED TO DISTRIBUTOR) ---
if ($method === 'POST' && $action === 'update_track') {
    $trackId = trim($input['track_id'] ?? $input['id'] ?? '');
    $chk = $pdo->prepare("SELECT * FROM tracks WHERE id = ? AND is_deleted = 0 LIMIT 1");
    $chk->execute([$trackId]);
    $existing = $chk->fetch();
    if (!$existing) {
        json_response(['status' => 'error', 'message' => 'Track not found.'], 404);
    }
    if (!$isAdmin && $existing['distributor_id'] !== $distId && $existing['uploaded_by_user_id'] !== $user['id']) {
        json_response(['status' => 'error', 'message' => 'Forbidden: You can only manage tracks uploaded under your distributor account.'], 403);
    }

    $title = trim($input['title'] ?? $existing['title']);
    $genre = trim($input['genre'] ?? $existing['genre']);
    $isrc = trim($input['isrc'] ?? ($existing['isrc'] ?? ''));
    $lyrics = isset($input['lyrics']) ? trim($input['lyrics']) : $existing['lyrics'];
    $explicit = isset($input['explicit']) ? (!empty($input['explicit']) ? 1 : 0) : (int)$existing['explicit'];
    $albumId = array_key_exists('album_id', $input) ? (!empty($input['album_id']) ? trim($input['album_id']) : null) : $existing['album_id'];
    $albumName = trim($input['album_name'] ?? $existing['album_name']);

    $pdo->prepare("
        UPDATE tracks
        SET title = ?, genre = ?, isrc = ?, lyrics = ?, explicit = ?, album_id = ?, album_name = ?
        WHERE id = ?
    ")->execute([$title, $genre, $isrc ?: null, $lyrics, $explicit, $albumId, $albumName, $trackId]);

    Auth::logAudit($user['id'], 'DISTRIBUTOR_TRACK_UPDATED', 'TRACK', $trackId, ['title' => $title]);
    json_response(['status' => 'success', 'message' => "Updated track '{$title}'."]);
}

if ($method === 'POST' && $action === 'delete_track') {
    $trackId = trim($input['track_id'] ?? $input['id'] ?? '');
    $chk = $pdo->prepare("SELECT distributor_id, uploaded_by_user_id FROM tracks WHERE id = ? LIMIT 1");
    $chk->execute([$trackId]);
    $existing = $chk->fetch();
    if (!$existing) {
        json_response(['status' => 'error', 'message' => 'Track not found.'], 404);
    }
    if (!$isAdmin && $existing['distributor_id'] !== $distId && $existing['uploaded_by_user_id'] !== $user['id']) {
        json_response(['status' => 'error', 'message' => 'Forbidden: You can only delete tracks you uploaded.'], 403);
    }
    $pdo->prepare("UPDATE tracks SET is_deleted = 1, status = 'removed' WHERE id = ?")->execute([$trackId]);
    Auth::logAudit($user['id'], 'DISTRIBUTOR_TRACK_DELETED', 'TRACK', $trackId);
    json_response(['status' => 'success', 'message' => 'Track deleted.']);
}

// --- 7. REVIEW ARTIST CLAIM (SCOPED TO DISTRIBUTOR'S ARTISTS) ---
if ($method === 'POST' && $action === 'review_claim') {
    $claimId = trim($input['claim_id'] ?? '');
    $decision = trim($input['decision'] ?? '');
    $reviewNotes = trim($input['notes'] ?? '');

    if (empty($claimId) || !in_array($decision, ['approved', 'rejected', 'escalated'], true)) {
        json_response(['status' => 'error', 'message' => 'Invalid claim decision.'], 400);
    }

    $stmt = $pdo->prepare("
        SELECT c.*, a.distributor_id AS artist_dist_id, a.created_by_user_id AS artist_creator
        FROM artist_claims c
        JOIN artists a ON c.artist_id = a.id
        WHERE c.id = ?
        LIMIT 1
    ");
    $stmt->execute([$claimId]);
    $claim = $stmt->fetch();

    if (!$claim) {
        json_response(['status' => 'error', 'message' => 'Claim not found'], 404);
    }

    if (!$isAdmin && $claim['distributor_id'] !== $distId && $claim['artist_dist_id'] !== $distId && $claim['artist_creator'] !== $user['id']) {
        json_response(['status' => 'error', 'message' => 'Forbidden: You are not authorized to review claims for this artist.'], 403);
    }

    $pdo->prepare("UPDATE artist_claims SET status = ?, review_notes = ?, reviewed_by = ? WHERE id = ?")
        ->execute([$decision, $reviewNotes, $user['id'], $claimId]);

    if ($decision === 'approved') {
        $pdo->prepare("UPDATE artists SET claimed_status = 'claimed', claimed_user_id = ? WHERE id = ?")
            ->execute([$claim['user_id'], $claim['artist_id']]);
        $pdo->prepare("UPDATE users SET role = CASE WHEN role = 'listener' THEN 'artist' ELSE role END, artist_id = ? WHERE id = ?")
            ->execute([$claim['artist_id'], $claim['user_id']]);
    } elseif ($decision === 'rejected') {
        $pdo->prepare("UPDATE artists SET claimed_status = 'unclaimed' WHERE id = ?")->execute([$claim['artist_id']]);
    }

    Auth::logAudit($user['id'], 'CLAIM_' . strtoupper($decision), 'CLAIM', $claimId, ['decision' => $decision, 'notes' => $reviewNotes]);
    json_response([
        'status' => 'success',
        'message' => "Artist claim marked as {$decision} successfully."
    ]);
}

json_response(['status' => 'error', 'message' => 'Invalid distributor action'], 400);
