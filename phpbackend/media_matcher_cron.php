<?php
/**
 * Flontmie Media Matcher - Scheduled Cron & CLI Background Runner
 * Can be configured in cPanel Cron Jobs:
 *   php -q /home/username/public_html/phpbackend/media_matcher_cron.php
 * or triggered via curl:
 *   curl -s "https://yourdomain.com/phpbackend/media_matcher_cron.php?key=flontmie_deploy_2026"
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/media_matcher.php';

// Check authorization if accessed over HTTP
if (php_sapi_name() !== 'cli') {
    $key = $_GET['key'] ?? $_POST['key'] ?? '';
    if (!defined('MIGRATION_KEY') || !hash_equals(MIGRATION_KEY, $key)) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized cron invocation']);
        exit;
    }
}

// Set time limit for CLI
if (function_exists('set_time_limit')) {
    @set_time_limit(300);
}

$pdo = Database::getConnection();
MediaMatcher::ensureTables($pdo);

$batchSize = 25;
$maxBatches = 20;

$result = MediaMatcher::runCron($pdo, $maxBatches, $batchSize);

if (php_sapi_name() === 'cli') {
    echo "[" . date('Y-m-d H:i:s') . "] Flontmie Media Matcher Cron Finished.\n";
    echo "Batches Executed: " . $result['batches_executed'] . "\n";
    print_r($result['last_batch']);
} else {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'success',
        'cron' => $result,
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
}
