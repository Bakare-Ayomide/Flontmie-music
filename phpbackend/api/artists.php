<?php
/**
 * Flontmie API - Artists Roster, Public Profiles & Claims
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = $_GET['id'] ?? '';
$pdo = Database::getConnection();

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

    // Check artist
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

    // Update artist claim status to pending
    $pdo->prepare("UPDATE artists SET claimed_status = 'pending' WHERE id = ?")->execute([$id]);

    // Audit log
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

// --- GET SINGLE ARTIST BY ID OR SLUG ---
if ($method === 'GET' && !empty($id)) {
    $stmt = $pdo->prepare("SELECT * FROM artists WHERE id = ? OR slug = ?");
    $stmt->execute([$id, $id]);
    $artist = $stmt->fetch();

    if (!$artist) {
        json_response(['status' => 'error', 'message' => 'Artist profile not found'], 404);
    }

    $artist['genres'] = !empty($artist['genres_json']) ? json_decode($artist['genres_json'], true) : [];
    $artist['social_links'] = !empty($artist['social_links_json']) ? json_decode($artist['social_links_json'], true) : [];

    // Get Artist Top Tracks
    $trkStmt = $pdo->prepare("SELECT * FROM tracks WHERE artist_id = ? AND is_deleted = 0 ORDER BY stream_count DESC LIMIT 20");
    $trkStmt->execute([$artist['id']]);
    $tracks = $trkStmt->fetchAll();
    foreach ($tracks as &$t) {
        $t['mood_tags'] = !empty($t['mood_tags_json']) ? json_decode($t['mood_tags_json'], true) : [];
    }
    $artist['tracks'] = $tracks;

    // Get Artist Albums
    $albStmt = $pdo->prepare("SELECT * FROM albums WHERE artist_id = ? AND status = 'published' ORDER BY release_date DESC");
    $albStmt->execute([$artist['id']]);
    $artist['albums'] = $albStmt->fetchAll();

    json_response(['status' => 'success', 'artist' => $artist]);
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
        $a['genres'] = !empty($a['genres_json']) ? json_decode($a['genres_json'], true) : [];
        $a['social_links'] = !empty($a['social_links_json']) ? json_decode($a['social_links_json'], true) : [];
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
    $avatar = $input['avatar_url'] ?? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400';
    $header = $input['header_url'] ?? 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200';
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

    // Audit log
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
