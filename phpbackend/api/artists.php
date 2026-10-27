<?php
/**
 * Flontmie API - Artists Roster, Public Profiles, Enriched Discographies, Artist Dashboard & Claims
 * Zero mock defaults or prefilled company names.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../artist_enrichment.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = trim($_GET['id'] ?? '');
$pdo = Database::getConnection();

// --- 1. AUTHENTICATED ARTIST DASHBOARD OVERVIEW (MY PROFILE, TRACKS, RELEASES & CLAIMS) ---
if ($method === 'GET' && $action === 'my_dashboard') {
    $user = Auth::requireRole(['artist', 'admin']);

    // Find artist profile linked to this user
    $artist = null;
    if (!empty($user['artist_id'])) {
        $stmt = $pdo->prepare("SELECT * FROM artists WHERE id = ? LIMIT 1");
        $stmt->execute([$user['artist_id']]);
        $artist = $stmt->fetch();
    }
    if (!$artist) {
        $stmt = $pdo->prepare("SELECT * FROM artists WHERE claimed_user_id = ? OR created_by_user_id = ? ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$user['id'], $user['id']]);
        $artist = $stmt->fetch();
    }
    if (!$artist && $user['role'] === 'artist') {
        // Auto-create artist profile from user account if none exists yet
        $newArtId = 'art_' . substr(md5($user['id']), 0, 10);
        $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $user['display_name'])) . '-' . rand(100, 999);
        $pdo->prepare("
            INSERT IGNORE INTO artists (id, name, stage_name, slug, avatar_url, bio, country, verified, claimed_status, claimed_user_id, distributor_id, label_id, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'claimed', ?, ?, ?, ?)
        ")->execute([
            $newArtId, $user['display_name'], $user['display_name'], $slug,
            $user['avatar_url'] ?? '', $user['bio'] ?? '', $user['country'] ?? 'US',
            $user['id'], $user['distributor_id'] ?? null, $user['label_id'] ?? null, $user['id']
        ]);
        $pdo->prepare("UPDATE users SET artist_id = ? WHERE id = ?")->execute([$newArtId, $user['id']]);
        $stmt = $pdo->prepare("SELECT * FROM artists WHERE id = ? LIMIT 1");
        $stmt->execute([$newArtId]);
        $artist = $stmt->fetch();
    }

    if ($artist) {
        $artist['avatar_url'] = ArtistEnrichment::resolveArtworkUrl($artist['avatar_url'] ?? '', $artist['id']);
        $artist['header_url'] = ArtistEnrichment::resolveArtworkUrl($artist['header_url'] ?? $artist['avatar_url'], $artist['id']);
        $artist['genres'] = !empty($artist['genres_json']) ? json_decode($artist['genres_json'], true) : [];
        $artist['social_links'] = !empty($artist['social_links_json']) ? json_decode($artist['social_links_json'], true) : [];

        // Fetch artist's tracks
        $tStmt = $pdo->prepare("
            SELECT * FROM tracks
            WHERE is_deleted = 0 AND (artist_id = ? OR uploaded_by_user_id = ? OR LOWER(artist_name) = LOWER(?))
            ORDER BY created_at DESC
        ");
        $tStmt->execute([$artist['id'], $user['id'], $artist['name']]);
        $tracks = $tStmt->fetchAll();

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

        // Fetch artist's albums/releases
        $albStmt = $pdo->prepare("
            SELECT * FROM albums
            WHERE artist_id = ? OR created_by_user_id = ? OR LOWER(artist_name) = LOWER(?)
            ORDER BY release_date DESC
        ");
        $albStmt->execute([$artist['id'], $user['id'], $artist['name']]);
        $releases = $albStmt->fetchAll();
        foreach ($releases as &$r) {
            $r['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($r['cover_art_url'] ?? '', $r['artist_id'] ?? $r['id']);
        }

        json_response([
            'status' => 'success',
            'artist' => $artist,
            'tracks' => $tracks,
            'releases' => $releases,
            'metrics' => [
                'total_streams' => max((int)($artist['total_streams'] ?? 0), $totalStreams),
                'flontmie_plays' => $totalFlontmiePlays,
                'total_likes' => $totalLikes,
                'followers' => (int)($artist['followers'] ?? 0),
                'monthly_listeners' => (int)($artist['monthly_listeners'] ?? 0),
                'tracks_count' => count($tracks),
                'releases_count' => count($releases)
            ]
        ]);
    } else {
        json_response([
            'status' => 'success',
            'artist' => null,
            'tracks' => [],
            'releases' => [],
            'metrics' => [
                'total_streams' => 0,
                'flontmie_plays' => 0,
                'total_likes' => 0,
                'followers' => 0,
                'monthly_listeners' => 0,
                'tracks_count' => 0,
                'releases_count' => 0
            ]
        ]);
    }
}

// --- 2. GET RELEASE TRACKLIST (ALBUM, SINGLE/EP, FEATURED ON, OR PLAYLIST) ---
if ($method === 'GET' && $action === 'release') {
    $browseId = trim($_GET['browse_id'] ?? $_GET['id'] ?? '');
    $title = trim($_GET['title'] ?? '');
    $artistName = trim($_GET['artist'] ?? '');
    $coverUrl = trim($_GET['cover_url'] ?? '');

    if (empty($browseId) && empty($title)) {
        json_response(['status' => 'error', 'message' => 'Release browse_id or title is required'], 400);
    }

    $release = ArtistEnrichment::fetchReleaseTracks($pdo, $browseId, $title, $artistName, $coverUrl);
    json_response([
        'status' => 'success',
        'release' => $release
    ]);
}

// --- 3. SUBMIT ARTIST CLAIM ---
if ($method === 'POST' && $action === 'claim' && !empty($id)) {
    $user = Auth::requireAuth();
    $input = get_json_input();

    $evidenceType = trim($input['evidence_type'] ?? 'Official Email & Social Links');
    $evidenceDetails = trim($input['evidence_details'] ?? '');
    $proofUrl = trim($input['proof_url'] ?? '');

    if (empty($evidenceDetails)) {
        json_response(['status' => 'error', 'message' => 'Evidence details are required for artist profile claim.'], 400);
    }

    $artStmt = $pdo->prepare("SELECT * FROM artists WHERE id = ?");
    $artStmt->execute([$id]);
    $artist = $artStmt->fetch();

    if (!$artist) {
        json_response(['status' => 'error', 'message' => 'Artist not found'], 404);
    }

    $claimId = 'clm_' . bin2hex(random_bytes(6));
    $stmt = $pdo->prepare("
        INSERT INTO artist_claims (id, artist_id, user_id, distributor_id, claimant_name, claimant_email, evidence_type, evidence_details, proof_url, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    ");
    $stmt->execute([
        $claimId,
        $id,
        $user['id'],
        $artist['distributor_id'] ?? null,
        $user['display_name'],
        $user['email'],
        $evidenceType,
        $evidenceDetails,
        $proofUrl
    ]);

    $pdo->prepare("UPDATE artists SET claimed_status = 'pending' WHERE id = ?")->execute([$id]);

    Auth::logAudit($user['id'], 'ARTIST_CLAIM_SUBMITTED', 'ARTIST', $id, ['claim_id' => $claimId]);

    json_response([
        'status' => 'success',
        'message' => 'Artist claim submitted successfully. The distributor and administration team will review your verification evidence.',
        'claim_id' => $claimId
    ], 201);
}

// --- 4. FOLLOW ARTIST ---
if ($method === 'POST' && $action === 'follow' && !empty($id)) {
    $user = Auth::requireAuth();
    $pdo->prepare("UPDATE artists SET followers = followers + 1 WHERE id = ?")->execute([$id]);
    json_response(['status' => 'success', 'message' => 'Followed artist']);
}

// --- 5. GET SINGLE ENRICHED ARTIST BY ID, SLUG, BROWSE_ID, OR NAME ---
if ($method === 'GET' && !empty($id)) {
    $enrichedArtist = ArtistEnrichment::getEnrichedArtistProfile($pdo, $id);
    if (!$enrichedArtist) {
        json_response(['status' => 'error', 'message' => 'Artist profile not found'], 404);
    }

    json_response([
        'status' => 'success',
        'artist' => $enrichedArtist
    ]);
}

// --- 6. GET ARTISTS LIST ---
if ($method === 'GET') {
    $search = trim($_GET['q'] ?? '');
    $genre = trim($_GET['genre'] ?? '');
    $distributorId = trim($_GET['distributor_id'] ?? '');
    $labelId = trim($_GET['label_id'] ?? '');
    $limit = min(200, max(1, (int)($_GET['limit'] ?? 60)));

    $sql = "SELECT * FROM artists WHERE (status IS NULL OR status != 'hidden')";
    $params = [];

    if (!empty($search)) {
        $sql .= " AND (name LIKE ? OR stage_name LIKE ? OR bio LIKE ?)";
        $searchTerm = '%' . $search . '%';
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }

    if (!empty($genre) && strtolower($genre) !== 'all') {
        $sql .= " AND genres_json LIKE ?";
        $params[] = '%' . $genre . '%';
    }

    if (!empty($distributorId)) {
        $sql .= " AND distributor_id = ?";
        $params[] = $distributorId;
    }

    if (!empty($labelId)) {
        $sql .= " AND label_id = ?";
        $params[] = $labelId;
    }

    $sql .= " ORDER BY is_featured DESC, total_streams DESC, created_at DESC LIMIT {$limit}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $artists = $stmt->fetchAll();

    $verifiedArtists = [];
    foreach ($artists as $a) {
        $artId = $a['id'];
        // Sum real flontmie_plays and verify artist has at least one uploaded track (or was created by admin/distributor)
        $tStmt = $pdo->prepare("SELECT local_audio_path, local_video_path, COALESCE(flontmie_plays, 0) AS fp FROM tracks WHERE (artist_id = ? OR LOWER(artist_name) = LOWER(?)) AND is_deleted = 0");
        $tStmt->execute([$artId, $a['name']]);
        $tRows = $tStmt->fetchAll();
        $realStreams = 0;
        $uploadedTrackCount = 0;
        foreach ($tRows as $tr) {
            if (ArtistEnrichment::hasVerifiedFile($tr['local_audio_path'] ?? null) !== null || ArtistEnrichment::hasVerifiedFile($tr['local_video_path'] ?? null) !== null) {
                $uploadedTrackCount++;
                $realStreams += (int)$tr['fp'];
            }
        }
        if ($uploadedTrackCount === 0 && empty($a['created_by_user_id'])) {
            continue;
        }

        $a['avatar_url'] = ArtistEnrichment::resolveArtworkUrl($a['avatar_url'] ?? '', $artId);
        $a['header_url'] = ArtistEnrichment::resolveArtworkUrl($a['header_url'] ?? $a['avatar_url'], $artId);
        $a['genres'] = !empty($a['genres_json']) ? json_decode($a['genres_json'], true) : [];
        $a['social_links'] = !empty($a['social_links_json']) ? json_decode($a['social_links_json'], true) : [];
        $a['monthly_listeners'] = $realStreams;
        $a['total_streams'] = $realStreams;
        $a['flontmie_streams'] = $realStreams;
        $a['yt_monthly_audience'] = null;
        $a['yt_subscribers'] = null;
        $a['yt_total_views'] = null;
        $a['country'] = $a['country'] ?? (ArtistEnrichment::$KNOWN_ARTISTS[$artId]['country'] ?? 'NG');
        $verifiedArtists[] = $a;
    }

    json_response(['status' => 'success', 'count' => count($verifiedArtists), 'artists' => $verifiedArtists]);
}

// --- 7. CREATE ARTIST (POST) ---
if ($method === 'POST') {
    $user = Auth::requireRole(['distributor', 'label', 'admin']);
    $input = get_json_input();

    $name = trim($input['name'] ?? $input['stage_name'] ?? '');
    if (empty($name)) {
        json_response(['status' => 'error', 'message' => 'Artist name is required.'], 400);
    }

    $artistId = 'art_' . bin2hex(random_bytes(6));
    $slug = strtolower(preg_replace('/[^A-Za-z0-9-]+/', '-', $name)) . '-' . rand(100, 999);
    $avatar = ArtistEnrichment::resolveArtworkUrl($input['avatar_url'] ?? '');
    $header = ArtistEnrichment::resolveArtworkUrl($input['header_url'] ?? $avatar);
    $bio = trim($input['bio'] ?? '');
    $country = strtoupper(substr(trim($input['country'] ?? ($user['country'] ?? 'US')), 0, 2)) ?: 'US';
    $genres = is_array($input['genres'] ?? null) ? $input['genres'] : (!empty($input['genre']) ? [trim($input['genre'])] : ['Afrobeats']);
    $socials = is_array($input['social_links'] ?? null) ? $input['social_links'] : [];
    $distributorId = $user['distributor_id'] ?? ($input['distributor_id'] ?? null);
    $distributorName = trim($input['distributor_name'] ?? ($user['role'] === 'distributor' ? $user['display_name'] : ''));
    $labelId = $user['label_id'] ?? ($input['label_id'] ?? null);
    $labelName = trim($input['label_name'] ?? ($user['role'] === 'label' ? $user['display_name'] : ''));

    $stmt = $pdo->prepare("
        INSERT INTO artists (id, name, stage_name, slug, avatar_url, header_url, bio, country, verified, genres_json, social_links_json, created_by_distributor, distributor_name, distributor_id, label_id, label_name, claimed_status, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 'unclaimed', ?)
    ");
    $stmt->execute([
        $artistId, $name, $name, $slug, $avatar, $header, $bio, $country,
        json_encode($genres), json_encode($socials),
        $distributorName ?: null, $distributorName ?: null, $distributorId,
        $labelId, $labelName ?: null, $user['id']
    ]);

    Auth::logAudit($user['id'], 'ARTIST_CREATED', 'ARTIST', $artistId, ['name' => $name, 'distributor_id' => $distributorId, 'label_id' => $labelId]);

    json_response([
        'status' => 'success',
        'message' => 'Artist profile created successfully on Flontmie',
        'artist_id' => $artistId,
        'slug' => $slug
    ], 201);
}

// --- 8. UPDATE ARTIST (PUT) ---
if ($method === 'PUT' && !empty($id)) {
    $user = Auth::requireRole(['distributor', 'label', 'admin', 'artist']);
    $input = get_json_input();

    $chk = $pdo->prepare("SELECT * FROM artists WHERE id = ? LIMIT 1");
    $chk->execute([$id]);
    $existing = $chk->fetch();
    if (!$existing) {
        json_response(['status' => 'error', 'message' => 'Artist not found'], 404);
    }

    if ($user['role'] !== 'admin') {
        $canEdit = ($existing['created_by_user_id'] === $user['id'])
            || ($existing['claimed_user_id'] === $user['id'])
            || ($user['role'] === 'artist' && $user['artist_id'] === $id)
            || ($user['role'] === 'distributor' && !empty($user['distributor_id']) && $existing['distributor_id'] === $user['distributor_id'])
            || ($user['role'] === 'label' && !empty($user['label_id']) && $existing['label_id'] === $user['label_id']);
        if (!$canEdit) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You are not authorized to edit this artist profile.'], 403);
        }
    }

    $stmt = $pdo->prepare("
        UPDATE artists SET
            name = COALESCE(NULLIF(?, ''), name),
            stage_name = COALESCE(NULLIF(?, ''), stage_name),
            bio = COALESCE(?, bio),
            country = COALESCE(NULLIF(?, ''), country),
            avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
            header_url = COALESCE(NULLIF(?, ''), header_url),
            genres_json = COALESCE(?, genres_json),
            social_links_json = COALESCE(?, social_links_json)
        WHERE id = ?
    ");
    $stmt->execute([
        $input['name'] ?? null,
        $input['name'] ?? null,
        $input['bio'] ?? null,
        $input['country'] ?? null,
        $input['avatar_url'] ?? null,
        $input['header_url'] ?? null,
        isset($input['genres']) ? json_encode($input['genres']) : null,
        isset($input['social_links']) ? json_encode($input['social_links']) : null,
        $id
    ]);

    json_response(['status' => 'success', 'message' => 'Artist updated successfully']);
}

json_response(['status' => 'error', 'message' => 'Method not allowed'], 405);
