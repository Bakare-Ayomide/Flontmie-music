<?php
/**
 * Flontmie API - Record Label Management & Analytics
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';

$user = Auth::requireRole(['label', 'admin']);
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$pdo = Database::getConnection();

// --- LABEL ROSTER & CATALOG ---
if ($method === 'GET' && ($action === 'roster' || empty($action))) {
    $labelId = $user['label_id'] ?? 'lbl_empire';

    $stmt = $pdo->prepare("SELECT * FROM artists WHERE label_name LIKE '%Empire%' OR ? = 'admin'");
    $stmt->execute([$user['role']]);
    $artists = $stmt->fetchAll();

    foreach ($artists as &$a) {
        $a['genres'] = !empty($a['genres_json']) ? json_decode($a['genres_json'], true) : [];
    }

    // Label total stream metrics
    $metricStmt = $pdo->query("SELECT SUM(stream_count) as total_streams, SUM(likes_count) as total_likes FROM tracks");
    $metrics = $metricStmt->fetch();

    json_response([
        'status' => 'success',
        'roster' => $artists,
        'metrics' => [
            'total_streams' => (int)($metrics['total_streams'] ?? 0),
            'total_likes' => (int)($metrics['total_likes'] ?? 0),
            'active_signed_artists' => count($artists)
        ]
    ]);
}

json_response(['status' => 'error', 'message' => 'Invalid action'], 400);
