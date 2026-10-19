<?php
/**
 * Flontmie API - Admin-Only Public Catalog Importer & Audio Sync
 * Strictly restricted to authenticated administrators.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../media_engine.php';

$adminUser = Auth::requireRole(['admin']);
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'search';
$input = get_json_input();
$pdo = Database::getConnection();

if ($method === 'POST') {
    Auth::verifyCsrf($adminUser, $input);
}

if ($action === 'search') {
    $query = trim($_GET['q'] ?? '');
    $country = strtoupper(substr(trim($_GET['country'] ?? 'US'), 0, 2)) ?: 'US';
    if (empty($query)) {
        json_response(['status' => 'error', 'message' => 'Search query is required'], 400);
    }

    $results = [];
    $searchUrl = "https://itunes.apple.com/search?term=" . urlencode($query) . "&entity=song&limit=20&country=" . strtolower($country);
    $raw = MediaEngine::downloadBinary($searchUrl, [], 8);
    if ($raw) {
        $json = json_decode($raw, true);
        foreach (($json['results'] ?? []) as $item) {
            $art = str_replace('100x100bb', '600x600bb', $item['artworkUrl100'] ?? '');
            $durationSec = isset($item['trackTimeMillis']) ? (int)round($item['trackTimeMillis'] / 1000) : 180;
            $relDate = substr($item['releaseDate'] ?? date('Y-m-d'), 0, 10);

            $results[] = [
                'source_id' => 'yt_' . ($item['trackId'] ?? uniqid()),
                'title' => $item['trackName'] ?? 'Unknown Title',
                'artist' => $item['artistName'] ?? 'Unknown Artist',
                'album' => $item['collectionName'] ?? (($item['trackName'] ?? 'Single') . ' - Single'),
                'genre' => $item['primaryGenreName'] ?? 'Pop',
                'country' => $country,
                'release_year' => (int)substr($relDate, 0, 4),
                'release_date' => $relDate,
                'duration' => $durationSec,
                'cover_url' => $art
            ];
        }
    }

    json_response([
        'status' => 'success',
        'query' => $query,
        'count' => count($results),
        'results' => $results
    ]);
}

if ($action === 'import' && $method === 'POST') {
    try {
        $res = MediaEngine::importTrackToCatalog($pdo, $input, $adminUser['id'], [
            'genre' => $input['genre'] ?? 'Pop',
            'country' => $input['country'] ?? 'US',
            'license_status' => $input['license_status'] ?? 'verified_licensed',
            'auto_publish' => true
        ]);
        json_response($res);
    } catch (Exception $e) {
        json_response(['status' => 'error', 'message' => 'Failed to import track: ' . $e->getMessage()], 500);
    }
}

json_response(['status' => 'error', 'message' => 'Invalid action or request method'], 400);
