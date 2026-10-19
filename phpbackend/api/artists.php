<?php
/**
 * Flontmie API - Artists Roster, Public Profiles, Enriched Discographies, Biographies & Claims
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../artist_enrichment.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = trim($_GET['id'] ?? '');
$pdo = Database::getConnection();

// Ensure tracks table has flontmie_plays column for distinguishing Flontmie analytics from external YT Music figures
try {
    $colCheck = $pdo->query("SHOW COLUMNS FROM tracks LIKE 'flontmie_plays'")->fetch();
    if (!$colCheck) {
        $pdo->exec("ALTER TABLE tracks ADD COLUMN flontmie_plays BIGINT DEFAULT 0 AFTER stream_count");
    }
} catch (Throwable $e) {
    // Ignore if already exists
}

// --- GET RELEASE TRACKLIST (ALBUM, SINGLE/EP, FEATURED ON, OR PLAYLIST) ---
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

// --- SUBMIT ARTIST CLAIM ---
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
        $artist['distributor_id'] ?? 'dist_tunecore',
        $user['display_name'],
        $user['email'],
        $evidenceType,
        $evidenceDetails,
        $proofUrl
    ]);

    $pdo->prepare("UPDATE artists SET claimed_status = 'pending' WHERE id = ?")->execute([$id]);

    $log = $pdo->prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address) VALUES (?, ?, ?, ?, ?, ?)");
    $log->execute([$user['id'], 'ARTIST_CLAIM_SUBMITTED', 'ARTIST', $id, json_encode(['claim_id' => $claimId]), $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1']);

    json_response([
        'status' => 'success',
        'message' => 'Artist claim submitted successfully. The distributor and administration team will review your multi-source evidence.',
        'claim_id' => $claimId
    ], 201);
}

// --- FOLLOW ARTIST ---
if ($method === 'POST' && $action === 'follow' && !empty($id)) {
    $user = Auth::requireAuth();
    $pdo->prepare("UPDATE artists SET followers = followers + 1 WHERE id = ?")->execute([$id]);
    json_response(['status' => 'success', 'message' => 'Followed artist']);
}

// --- GET SINGLE ENRICHED ARTIST BY ID, SLUG, BROWSE_ID, OR NAME ---
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

// --- GET ARTISTS LIST ---
if ($method === 'GET') {
    $search = $_GET['q'] ?? '';
    $genre = $_GET['genre'] ?? '';
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));

    $sql = "SELECT * FROM artists WHERE 1=1";
    $params = [];

    if (!empty($search)) {
        $sql .= " AND (name LIKE ? OR bio LIKE ?)";
        $searchTerm = '%' . $search . '%';
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }

    if (!empty($genre)) {
        $sql .= " AND genres_json LIKE ?";
        $params[] = '%' . $genre . '%';
    }

    $sql .= " ORDER BY total_streams DESC LIMIT {$limit}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $artists = $stmt->fetchAll();

    foreach ($artists as &$a) {
        $artId = $a['id'];
        $a['avatar_url'] = ArtistEnrichment::resolveArtworkUrl($a['avatar_url'] ?? '', $artId);
        $a['header_url'] = ArtistEnrichment::resolveArtworkUrl($a['header_url'] ?? $a['avatar_url'], $artId);
        $a['genres'] = !empty($a['genres_json']) ? json_decode($a['genres_json'], true) : [];
        $a['social_links'] = !empty($a['social_links_json']) ? json_decode($a['social_links_json'], true) : [];
        $a['yt_monthly_audience'] = ArtistEnrichment::parseMetric((string)($a['monthly_listeners'] ?? ''))['compact'];
        $a['yt_subscribers'] = ArtistEnrichment::parseMetric((string)($a['followers'] ?? ''))['compact'];
        $a['yt_total_views'] = ArtistEnrichment::parseMetric((string)($a['total_streams'] ?? ''))['compact'];
        $a['country'] = ArtistEnrichment::$KNOWN_ARTISTS[$artId]['country'] ?? 'US';

        // Check if cached enrichment exists to attach Wikipedia bio & YT stats without network overhead on list view
        $safeCacheId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $artId);
        $cacheFile = STORAGE_ROOT . "/cache/artists/{$safeCacheId}_v2.json";
        if (is_file($cacheFile)) {
            $cached = json_decode((string)file_get_contents($cacheFile), true);
            if (!empty($cached['wiki']['bio'])) {
                $a['bio'] = $cached['wiki']['bio'];
                $a['bio_source'] = $cached['wiki']['bio_source'] ?? 'Wikipedia / Wikidata';
                $a['bio_url'] = $cached['wiki']['bio_url'] ?? null;
                $a['wikidata_id'] = $cached['wiki']['wikidata_id'] ?? null;
            }
            if (!empty($cached['yt']['avatar_url'])) {
                $a['avatar_url'] = $cached['yt']['avatar_url'];
                $a['header_url'] = $cached['yt']['header_url'] ?? $cached['yt']['avatar_url'];
            }
            if (!empty($cached['yt']['monthly_audience_compact'])) {
                $a['yt_monthly_audience'] = $cached['yt']['monthly_audience_compact'];
                $a['monthly_listeners'] = $cached['yt']['monthly_audience_num'] ?? $a['monthly_listeners'];
            }
            if (!empty($cached['yt']['subscribers_compact'])) {
                $a['yt_subscribers'] = $cached['yt']['subscribers_compact'];
            }
            if (!empty($cached['yt']['total_views_compact'])) {
                $a['yt_total_views'] = $cached['yt']['total_views_compact'];
                $a['total_streams'] = $cached['yt']['total_views_num'] ?? $a['total_streams'];
            }
        }
    }

    json_response(['status' => 'success', 'count' => count($artists), 'artists' => $artists]);
}

// --- CREATE ARTIST (POST) ---
if ($method === 'POST') {
    $user = Auth::requireRole(['distributor', 'admin']);
    $input = get_json_input();

    $name = trim($input['name'] ?? $input['stage_name'] ?? '');
    if (empty($name)) {
        json_response(['status' => 'error', 'message' => 'Artist name is required.'], 400);
    }

    $artistId = 'art_' . bin2hex(random_bytes(6));
    $slug = strtolower(preg_replace('/[^A-Za-z0-9-]+/', '-', $name)) . '-' . rand(100, 999);
    $avatar = ArtistEnrichment::resolveArtworkUrl($input['avatar_url'] ?? '');
    $header = ArtistEnrichment::resolveArtworkUrl($input['header_url'] ?? $avatar);
    $bio = $input['bio'] ?? '';
    $genres = is_array($input['genres'] ?? null) ? $input['genres'] : ['Afrobeats'];
    $socials = is_array($input['social_links'] ?? null) ? $input['social_links'] : [];
    $distributorName = $input['distributor_name'] ?? $user['display_name'];
    $distributorId = $user['distributor_id'] ?? 'dist_tunecore';

    $stmt = $pdo->prepare("
        INSERT INTO artists (id, name, stage_name, slug, avatar_url, header_url, bio, verified, genres_json, social_links_json, created_by_distributor, distributor_name, distributor_id, claimed_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'unclaimed')
    ");
    $stmt->execute([
        $artistId, $name, $name, $slug, $avatar, $header, $bio,
        json_encode($genres), json_encode($socials), $distributorName, $distributorName, $distributorId
    ]);

    $log = $pdo->prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address) VALUES (?, ?, ?, ?, ?, ?)");
    $log->execute([$user['id'], 'ARTIST_CREATED', 'ARTIST', $artistId, json_encode(['name' => $name, 'distributor' => $distributorName]), $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1']);

    json_response([
        'status' => 'success',
        'message' => 'Artist profile created successfully on Flontmie',
        'artist_id' => $artistId,
        'slug' => $slug
    ], 201);
}

// --- UPDATE ARTIST (PUT) ---
if ($method === 'PUT' && !empty($id)) {
    $user = Auth::requireRole(['distributor', 'admin', 'artist']);
    $input = get_json_input();

    $stmt = $pdo->prepare("
        UPDATE artists SET
            name = COALESCE(?, name),
            bio = COALESCE(?, bio),
            avatar_url = COALESCE(?, avatar_url),
            header_url = COALESCE(?, header_url),
            genres_json = COALESCE(?, genres_json),
            social_links_json = COALESCE(?, social_links_json)
        WHERE id = ?
    ");
    $stmt->execute([
        $input['name'] ?? null,
        $input['bio'] ?? null,
        $input['avatar_url'] ?? null,
        $input['header_url'] ?? null,
        isset($input['genres']) ? json_encode($input['genres']) : null,
        isset($input['social_links']) ? json_encode($input['social_links']) : null,
        $id
    ]);

    json_response(['status' => 'success', 'message' => 'Artist updated successfully']);
}

json_response(['status' => 'error', 'message' => 'Method not allowed'], 405);
