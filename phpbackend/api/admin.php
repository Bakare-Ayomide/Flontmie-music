<?php
/**
 * Flontmie API - Master Admin Dashboard & Platform Controls
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';

$user = Auth::requireRole(['admin']);
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'stats';
$pdo = Database::getConnection();

// --- 1. OVERALL STATS ---
if ($method === 'GET' && $action === 'stats') {
    $userCount = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $artistCount = (int)$pdo->query("SELECT COUNT(*) FROM artists")->fetchColumn();
    $trackCount = (int)$pdo->query("SELECT COUNT(*) FROM tracks WHERE is_deleted = 0")->fetchColumn();
    $albumCount = (int)$pdo->query("SELECT COUNT(*) FROM albums")->fetchColumn();
    $claimCount = (int)$pdo->query("SELECT COUNT(*) FROM artist_claims WHERE status = 'pending'")->fetchColumn();
    $totalStreams = (int)$pdo->query("SELECT SUM(stream_count) FROM tracks")->fetchColumn();

    json_response([
        'status' => 'success',
        'stats' => [
            'total_users' => $userCount,
            'total_artists' => $artistCount,
            'total_tracks' => $trackCount,
            'total_albums' => $albumCount,
            'pending_claims' => $claimCount,
            'total_streams' => $totalStreams
        ]
    ]);
}

// --- 2. LIST ALL USERS ---
if ($method === 'GET' && $action === 'users') {
    $stmt = $pdo->query("SELECT id, username, email, role, display_name, country, created_at FROM users ORDER BY created_at DESC");
    $users = $stmt->fetchAll();
    json_response(['status' => 'success', 'users' => $users]);
}

// --- 3. UPDATE USER ROLE ---
if ($method === 'POST' && $action === 'update_role') {
    $input = get_json_input();
    $targetUserId = $input['user_id'] ?? '';
    $newRole = $input['role'] ?? '';

    if (empty($targetUserId) || !in_array($newRole, ['listener', 'artist', 'distributor', 'label', 'admin'], true)) {
        json_response(['status' => 'error', 'message' => 'Invalid user ID or role.'], 400);
    }

    $stmt = $pdo->prepare("UPDATE users SET role = ? WHERE id = ?");
    $stmt->execute([$newRole, $targetUserId]);

    // Audit log
    $log = $pdo->prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address) VALUES (?, ?, ?, ?, ?, ?)");
    $log->execute([$user['id'], 'ROLE_UPDATED', 'USER', $targetUserId, json_encode(['new_role' => $newRole]), $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1']);

    json_response(['status' => 'success', 'message' => "User role updated to {$newRole}."]);
}

// --- 4. AUDIT LOGS ---
if ($method === 'GET' && $action === 'audit_logs') {
    $stmt = $pdo->query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50");
    $logs = $stmt->fetchAll();
    json_response(['status' => 'success', 'audit_logs' => $logs]);
}

json_response(['status' => 'error', 'message' => 'Invalid admin action'], 400);
