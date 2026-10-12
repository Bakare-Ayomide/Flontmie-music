<?php
/**
 * Flontmie API - Distributor Operations, Artist Hub & Claim Verification
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';

$user = Auth::requireRole(['distributor', 'admin']);
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$pdo = Database::getConnection();

// --- 1. LIST DISTRIBUTOR'S ARTISTS ---
if ($method === 'GET' && ($action === 'artists' || empty($action))) {
    $distId = $user['distributor_id'] ?? 'dist_tunecore';
    $stmt = $pdo->prepare("SELECT * FROM artists WHERE distributor_id = ? OR ? = 'admin' ORDER BY created_at DESC");
    $stmt->execute([$distId, $user['role']]);
    $artists = $stmt->fetchAll();

    foreach ($artists as &$a) {
        $a['genres'] = !empty($a['genres_json']) ? json_decode($a['genres_json'], true) : [];
        $a['social_links'] = !empty($a['social_links_json']) ? json_decode($a['social_links_json'], true) : [];
    }

    json_response(['status' => 'success', 'artists' => $artists]);
}

// --- 2. LIST DISTRIBUTOR'S RELEASES ---
if ($method === 'GET' && $action === 'releases') {
    $distId = $user['distributor_id'] ?? 'dist_tunecore';
    $stmt = $pdo->prepare("SELECT * FROM albums WHERE distributor_id = ? OR ? = 'admin' ORDER BY created_at DESC");
    $stmt->execute([$distId, $user['role']]);
    $albums = $stmt->fetchAll();

    json_response(['status' => 'success', 'releases' => $albums]);
}

// --- 3. LIST CLAIMS PENDING REVIEW ---
if ($method === 'GET' && $action === 'claims') {
    $distId = $user['distributor_id'] ?? 'dist_tunecore';
    $stmt = $pdo->prepare("
        SELECT c.*, a.name AS artist_name, a.avatar_url AS artist_avatar
        FROM artist_claims c
        JOIN artists a ON c.artist_id = a.id
        WHERE (c.distributor_id = ? OR ? = 'admin')
        ORDER BY c.created_at DESC
    ");
    $stmt->execute([$distId, $user['role']]);
    $claims = $stmt->fetchAll();

    json_response(['status' => 'success', 'claims' => $claims]);
}

// --- 4. REVIEW ARTIST CLAIM (APPROVE / REJECT / ESCALATE) ---
if ($method === 'POST' && $action === 'review_claim') {
    $input = get_json_input();
    $claimId = $input['claim_id'] ?? '';
    $decision = $input['decision'] ?? ''; // approved, rejected, escalated
    $reviewNotes = trim($input['notes'] ?? '');

    if (empty($claimId) || !in_array($decision, ['approved', 'rejected', 'escalated'], true)) {
        json_response(['status' => 'error', 'message' => 'Invalid claim decision.'], 400);
    }

    // Fetch claim
    $stmt = $pdo->prepare("SELECT * FROM artist_claims WHERE id = ?");
    $stmt->execute([$claimId]);
    $claim = $stmt->fetch();

    if (!$claim) {
        json_response(['status' => 'error', 'message' => 'Claim not found'], 404);
    }

    // Update claim status
    $upd = $pdo->prepare("UPDATE artist_claims SET status = ?, review_notes = ?, reviewed_by = ? WHERE id = ?");
    $upd->execute([$decision, $reviewNotes, $user['id'], $claimId]);

    // If approved, assign artist profile to the claimant user!
    if ($decision === 'approved') {
        $pdo->prepare("
            UPDATE artists 
            SET claimed_status = 'claimed', 
                claimed_user_id = ? 
            WHERE id = ?
        ")->execute([$claim['user_id'], $claim['artist_id']]);

        // Promote user role to artist if currently listener
        $pdo->prepare("
            UPDATE users 
            SET role = 'artist' 
            WHERE id = ? AND role = 'listener'
        ")->execute([$claim['user_id']]);
    } elseif ($decision === 'rejected') {
        $pdo->prepare("
            UPDATE artists 
            SET claimed_status = 'unclaimed' 
            WHERE id = ?
        ")->execute([$claim['artist_id']]);
    }

    // Audit log
    $log = $pdo->prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address) VALUES (?, ?, ?, ?, ?, ?)");
    $log->execute([$user['id'], 'CLAIM_' . strtoupper($decision), 'CLAIM', $claimId, json_encode(['decision' => $decision, 'notes' => $reviewNotes]), $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1']);

    json_response([
        'status' => 'success',
        'message' => "Artist claim marked as {$decision} successfully."
    ]);
}

json_response(['status' => 'error', 'message' => 'Invalid distributor action'], 400);
