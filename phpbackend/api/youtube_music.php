<?php
/**
 * Flontmie Local Catalog & Lyrics Endpoint (Legacy Endpoint Compatibility)
 * External YouTube Music API / Innertube scraping is completely disabled.
 * Strictly serves Admin, Distributor, Label, and Artist uploaded database records.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'search';
$pdo = Database::getConnection();

if ($method === 'GET' && $action === 'lyrics') {
    $trackId = trim($_GET['track_id'] ?? $_GET['video_id'] ?? '');
    if (!empty($trackId)) {
        $stmt = $pdo->prepare("SELECT lyrics, local_lyrics_path, lyrics_file_path FROM tracks WHERE id = ? OR video_id = ? LIMIT 1");
        $stmt->execute([$trackId, $trackId]);
        $row = $stmt->fetch();
        $lyrics = trim((string)($row['lyrics'] ?? ''));
        if (!empty($lyrics) && strpos($lyrics, 'Synchronized Catalog Lyrics') !== false) {
            $lyrics = '';
        }
        if (empty($lyrics) && !empty($row['local_lyrics_path'] ?? $row['lyrics_file_path'])) {
            $relLyr = ltrim((string)($row['local_lyrics_path'] ?? $row['lyrics_file_path']), '/');
            $projectRoot = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
            foreach ([BASE_DIR . '/storage/' . $relLyr, BASE_DIR . '/' . $relLyr, $projectRoot . '/' . $relLyr] as $candLyr) {
                if (is_file($candLyr) && is_readable($candLyr)) {
                    $lyrics = trim((string)@file_get_contents($candLyr));
                    break;
                }
            }
        }
        json_response(['status' => 'success', 'lyrics' => $lyrics, 'source' => !empty($lyrics) ? 'uploaded_catalog' : 'none']);
    }
    json_response(['status' => 'success', 'lyrics' => '', 'source' => 'none']);
}

if ($method === 'POST') {
    json_response([
        'status' => 'error',
        'message' => 'External YouTube Music API imports are disabled. Please upload authorized master audio, video, and lyrics files directly via the Admin or Distributor portal.'
    ], 410);
}

json_response([
    'status' => 'success',
    'source' => 'flontmie_uploaded_catalog_only',
    'results' => [
        'songs' => [],
        'albums' => [],
        'artists' => [],
        'playlists' => []
    ],
    'charts' => []
]);
