<?php
/**
 * Flontmie API - Media-to-Metadata Matching & Scanner Controller
 * Provides real-time scanner status, resumable batch execution, ambiguous resolution,
 * manual corrections, and cron compatibility.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../media_matcher.php';

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'status';

// Cron / CLI authentication bypass with secure key
$isCron = false;
$cronKey = $_GET['key'] ?? $_POST['key'] ?? '';
if (!empty($cronKey) && defined('MIGRATION_KEY') && hash_equals(MIGRATION_KEY, $cronKey)) {
    $isCron = true;
}

if (!$isCron && php_sapi_name() !== 'cli') {
    // Require admin session
    $currentUser = Auth::requireRole(['admin']);
    if ($method === 'POST') {
        $input = get_json_input();
        Auth::verifyCsrf($currentUser, $input);
    }
}

MediaMatcher::ensureTables($pdo);

// --- 1. CRON EXECUTION ---
if ($action === 'cron' || (php_sapi_name() === 'cli' && $action === 'cron')) {
    $batches = min(20, max(1, (int)($_GET['batches'] ?? 5)));
    $batchSize = min(50, max(5, (int)($_GET['batch_size'] ?? 25)));
    $result = MediaMatcher::runCron($pdo, $batches, $batchSize);
    json_response([
        'status'  => 'success',
        'message' => 'Cron batch execution complete',
        'cron'    => $result
    ]);
}

// --- 2. GET STATUS & OVERVIEW ---
if ($method === 'GET' && ($action === 'status' || $action === 'overview')) {
    $summary = MediaMatcher::getRunSummary($pdo);
    $dirs = MediaMatcher::getScanDirectories();

    json_response([
        'status'             => 'success',
        'counts'             => $summary['counts'],
        'run'                => $summary['run'],
        'scan_directories'   => $dirs,
        'supported_audio'    => MediaMatcher::SUPPORTED_AUDIO_EXTENSIONS,
        'supported_video'    => MediaMatcher::SUPPORTED_VIDEO_EXTENSIONS,
        'high_conf_threshold'=> MediaMatcher::HIGH_CONFIDENCE_THRESHOLD,
        'ambiguous_threshold'=> MediaMatcher::AMBIGUOUS_THRESHOLD
    ]);
}

// --- 3. GET FILES LIST WITH SEARCH & FILTERS ---
if ($method === 'GET' && $action === 'files') {
    $statusFilter = $_GET['status'] ?? 'all';
    $mediaFilter = $_GET['media_type'] ?? 'all';
    $search = trim($_GET['q'] ?? '');
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(100, max(10, (int)($_GET['limit'] ?? 25)));
    $offset = ($page - 1) * $limit;

    $where = [];
    $params = [];

    if ($statusFilter !== 'all' && in_array($statusFilter, ['matched', 'ambiguous', 'unmatched', 'unsupported', 'error'], true)) {
        $where[] = "f.match_status = ?";
        $params[] = $statusFilter;
    }

    if ($mediaFilter === 'audio') {
        $where[] = "f.is_video = 0";
    } elseif ($mediaFilter === 'video') {
        $where[] = "f.is_video = 1";
    }

    if ($search !== '') {
        $where[] = "(f.filename LIKE ? OR f.file_path LIKE ? OR f.parsed_title LIKE ? OR f.parsed_artist LIKE ? OR t.title LIKE ? OR t.artist_name LIKE ?)";
        $searchTerm = '%' . $search . '%';
        for ($i = 0; $i < 6; $i++) {
            $params[] = $searchTerm;
        }
    }

    $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

    $countSql = "SELECT COUNT(*) FROM media_scan_files f LEFT JOIN tracks t ON f.matched_track_id = t.id {$whereClause}";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalCount = (int)$countStmt->fetchColumn();

    $dataSql = "
        SELECT 
            f.*,
            t.title AS track_title,
            t.artist_name AS track_artist_name,
            t.album_name AS track_album_name,
            t.cover_art_url AS track_cover_art,
            t.genre AS track_genre,
            t.duration AS track_duration
        FROM media_scan_files f
        LEFT JOIN tracks t ON f.matched_track_id = t.id
        {$whereClause}
        ORDER BY 
            CASE 
                WHEN f.match_status = 'ambiguous' THEN 1
                WHEN f.match_status = 'unmatched' THEN 2
                WHEN f.match_status = 'error' THEN 3
                ELSE 4
            END,
            f.last_scanned_at DESC
        LIMIT {$limit} OFFSET {$offset}
    ";
    $dataStmt = $pdo->prepare($dataSql);
    $dataStmt->execute($params);
    $files = $dataStmt->fetchAll();

    foreach ($files as &$file) {
        $file['candidates'] = !empty($file['candidates_json']) ? json_decode($file['candidates_json'], true) : [];
        unset($file['candidates_json']);
        $file['stream_url'] = '/phpbackend/api/stream.php?scan_file_id=' . urlencode($file['id']);
    }

    json_response([
        'status'      => 'success',
        'files'       => $files,
        'total'       => $totalCount,
        'page'        => $page,
        'limit'       => $limit,
        'total_pages' => ceil($totalCount / $limit)
    ]);
}

// --- 4. CATALOG SEARCH (FOR MANUAL LINK MODAL) ---
if ($method === 'GET' && $action === 'catalog_search') {
    $q = trim($_GET['q'] ?? '');
    if (strlen($q) < 1) {
        json_response(['status' => 'success', 'tracks' => []]);
    }

    $searchTerm = '%' . $q . '%';
    $stmt = $pdo->prepare("
        SELECT id, video_id, title, artist_name, album_name, cover_art_url, genre, local_audio_path
        FROM tracks
        WHERE is_deleted = 0 AND (title LIKE ? OR artist_name LIKE ? OR album_name LIKE ? OR id LIKE ? OR video_id LIKE ?)
        ORDER BY (title LIKE ?) DESC, stream_count DESC
        LIMIT 20
    ");
    $stmt->execute([$searchTerm, $searchTerm, $searchTerm, $searchTerm, $searchTerm, $searchTerm]);
    $tracks = $stmt->fetchAll();

    json_response([
        'status' => 'success',
        'tracks' => $tracks
    ]);
}

// --- 5. START / RESTART SCAN NOW ---
if ($method === 'POST' && $action === 'scan_now') {
    $batchSize = min(50, max(5, (int)($_GET['batch_size'] ?? 25)));
    $res = MediaMatcher::processBatch($pdo, $batchSize, true);

    json_response([
        'status'  => 'success',
        'message' => 'New scan initiated',
        'batch'   => $res
    ]);
}

// --- 6. RESUME INCOMPLETE SCAN ---
if ($method === 'POST' && $action === 'resume_scan') {
    $batchSize = min(50, max(5, (int)($_GET['batch_size'] ?? 25)));
    $res = MediaMatcher::processBatch($pdo, $batchSize, false);

    json_response([
        'status'  => 'success',
        'message' => 'Resumed scanning batch',
        'batch'   => $res
    ]);
}

// --- 7. RUN NEXT BATCH (FRONTEND LOOPING) ---
if ($method === 'POST' && $action === 'scan_batch') {
    $batchSize = min(50, max(5, (int)($_GET['batch_size'] ?? 25)));
    $res = MediaMatcher::processBatch($pdo, $batchSize, false);

    json_response([
        'status'  => 'success',
        'batch'   => $res
    ]);
}

// --- 8. MANUAL LINK (LINK FILE TO TRACK OR CORRECT INCORRECT MATCH) ---
if ($method === 'POST' && $action === 'manual_link') {
    $input = get_json_input();
    $fileId = trim($input['file_id'] ?? '');
    $trackId = trim($input['track_id'] ?? '');

    if (empty($fileId) || empty($trackId)) {
        json_response(['status' => 'error', 'message' => 'file_id and track_id are required'], 400);
    }

    try {
        $result = MediaMatcher::manualLink($pdo, $fileId, $trackId);
        json_response($result);
    } catch (Exception $e) {
        json_response(['status' => 'error', 'message' => $e->getMessage()], 400);
    }
}

// --- 9. UNLINK FILE ---
if ($method === 'POST' && $action === 'unlink') {
    $input = get_json_input();
    $fileId = trim($input['file_id'] ?? '');

    if (empty($fileId)) {
        json_response(['status' => 'error', 'message' => 'file_id is required'], 400);
    }

    try {
        $result = MediaMatcher::unlinkFile($pdo, $fileId);
        json_response($result);
    } catch (Exception $e) {
        json_response(['status' => 'error', 'message' => $e->getMessage()], 400);
    }
}

json_response(['status' => 'error', 'message' => 'Invalid action'], 400);
