<?php
/**
 * Flontmie API - Health Check & System Status
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

try {
    $pdo = Database::getConnection();
    
    // Quick queries to check table counts
    $counts = [];
    $tables = ['users', 'artists', 'albums', 'tracks', 'playlists', 'artist_claims'];
    foreach ($tables as $t) {
        try {
            $stmt = $pdo->query("SELECT COUNT(*) AS c FROM `{$t}`");
            $counts[$t] = (int)$stmt->fetchColumn();
        } catch (Exception $e) {
            $counts[$t] = 'not_created';
        }
    }

    json_response([
        'status' => 'healthy',
        'app' => 'Flontmie Music Streaming Platform',
        'version' => '1.0.0',
        'php_version' => PHP_VERSION,
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
        'db_status' => 'connected',
        'db_host' => Database::getActiveHost(),
        'db_name' => DB_NAME,
        'table_counts' => $counts,
        'server_time' => date('Y-m-d H:i:s T')
    ]);
} catch (Exception $e) {
    json_response([
        'status' => 'unhealthy',
        'db_status' => 'disconnected',
        'error' => $e->getMessage(),
        'server_time' => date('Y-m-d H:i:s T')
    ], 500);
}
