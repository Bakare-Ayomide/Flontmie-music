<?php
/**
 * Flontmie Music Streaming Platform - Configuration
 * Production-ready MySQL & Environment Settings
 */

// Disallow direct output of errors in production, but log them
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// Security Headers & CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database Credentials
define('DB_NAME', getenv('DB_NAME') ?: 'aixdqvdz_flontmie');
define('DB_USER', getenv('DB_USER') ?: 'aixdqvdz_flontmie');
define('DB_PASS', getenv('DB_PASS') ?: '@f33rinimi');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_CHARSET', 'utf8mb4');

// Hosts to attempt in order: localhost (fastest within cPanel), 127.0.0.1, then public IP
$possible_hosts = [
    getenv('DB_HOST') ?: null,
    'localhost',
    '127.0.0.1',
    '102.203.116.13'
];
define('DB_HOSTS', array_values(array_filter(array_unique($possible_hosts))));

// Security Secrets
define('JWT_SECRET', getenv('JWT_SECRET') ?: 'flontmie_super_secret_jwt_key_2026_production_stream');
define('MIGRATION_KEY', 'flontmie_deploy_2026');

// Storage Directories
define('BASE_DIR', __DIR__);
define('UPLOAD_DIR', __DIR__ . '/uploads');
define('UPLOAD_URL', '/phpbackend/uploads');

// Helper to respond JSON
function json_response($data, $status_code = 200) {
    http_response_code($status_code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit();
}

// Helper to parse JSON input
function get_json_input() {
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return $_POST;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $_POST;
}
