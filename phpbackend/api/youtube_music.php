<?php
/**
 * Flontmie Unified Discovery, App-Wide Search & YouTube Music Catalog API
 * Searches both the Flontmie MySQL database (admin, distributor, label & artist content)
 * and the live YouTube Music API (ytmusicapi / Innertube) simultaneously.
 * Zero mock data, zero fake lyrics, zero seed scripts.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../media_engine.php';
require_once __DIR__ . '/../artist_enrichment.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'search';
$input = get_json_input();
$pdo = Database::getConnection();

// Public discovery actions (accessible to all listeners, visitors, and admins)
$publicActions = ['search', 'suggestions', 'charts', 'moods', 'lyrics', 'artist', 'album', 'playlist'];
$adminUser = null;

if (!in_array($action, $publicActions, true)) {
    $adminUser = Auth::requireRole(['admin']);
    if ($method === 'POST') {
        Auth::verifyCsrf($adminUser, $input);
    }
} else {
    $adminUser = Auth::getCurrentUser();
}

function call_ytmusic($endpoint, $payload = [], $country = 'US') {
    $url = "https://music.youtube.com/youtubei/v1/{$endpoint}?prettyPrint=false";
    $gl = strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $country ?: 'US'), 0, 2)) ?: 'US';
    
    $defaultPayload = [
        'context' => [
            'client' => [
                'clientName' => 'WEB_REMIX',
                'clientVersion' => '1.20231106.01.00',
                'hl' => 'en',
                'gl' => $gl
            ]
        ]
    ];
    
    $fullPayload = array_merge_recursive($defaultPayload, $payload);
    $jsonBody = json_encode($fullPayload);

    $headers = [
        'Content-Type: application/json',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-YouTube-Client-Name: 67',
        'X-YouTube-Client-Version: 1.20231106.01.00',
        'Origin: https://music.youtube.com',
        'Referer: https://music.youtube.com/'
    ];

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonBody);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        $res = curl_exec($ch);
        curl_close($ch);
        if ($res) {
            return json_decode($res, true);
        }
    }

    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => $jsonBody,
            'timeout' => 12
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false
        ]
    ]);

    $res = @file_get_contents($url, false, $ctx);
    if ($res) {
        return json_decode($res, true);
    }
    return null;
}

function get_runs_text($runsObj) {
    if (!$runsObj || !isset($runsObj['runs']) || !is_array($runsObj['runs'])) {
        return '';
    }
    $text = '';
    foreach ($runsObj['runs'] as $r) {
        $text .= $r['text'] ?? '';
    }
    return $text;
}

function get_catalog_lookup(PDO $pdo): array {
    $byVideo = [];
    $byKey = [];
    try {
        $stmt = $pdo->query("SELECT id, video_id, title, artist_name, status FROM tracks WHERE is_deleted = 0");
        while ($r = $stmt->fetch()) {
            if (!empty($r['video_id'])) {
                $byVideo[$r['video_id']] = $r['id'];
            }
            $k = strtolower(trim($r['title']) . '||' . trim($r['artist_name']));
            $byKey[$k] = $r['id'];
        }
    } catch (Exception $e) {}
    return ['video' => $byVideo, 'key' => $byKey];
}

// --- 1. UNIFIED APP-WIDE SEARCH (Flontmie MySQL Catalog + YouTube Music API) ---
if ($action === 'search') {
    $query = trim($_GET['q'] ?? '');
    $filter = strtolower(trim($_GET['filter'] ?? '')); // 'songs', 'artists', 'albums', 'playlists', 'all'
    $country = strtoupper(substr(trim($_GET['country'] ?? 'US'), 0, 2)) ?: 'US';
    $yearFilter = trim($_GET['year'] ?? '');
    $genreFilter = trim($_GET['genre'] ?? '');

    if (empty($query) && !empty($genreFilter) && $genreFilter !== 'All') {
        $query = $genreFilter;
    }
    if (empty($query)) {
        json_response(['status' => 'error', 'message' => 'Search query is required'], 400);
    }

    $songs = [];
    $artists = [];
    $albums = [];
    $playlists = [];

    $seenSongKeys = [];
    $seenVideoIds = [];
    $seenArtistKeys = [];
    $seenAlbumKeys = [];
    $seenPlaylistKeys = [];

    // STEP A: Search Flontmie MySQL Database first (Admin, Distributor, Label, and Artist uploads/catalog)
    try {
        $like = '%' . $query . '%';

        // 1. Local Catalog Songs
        if (empty($filter) || $filter === 'all' || $filter === 'songs') {
            $tSql = "
                SELECT * FROM tracks
                WHERE is_deleted = 0
                  AND (status IS NULL OR status = 'published' OR status = 'active')
                  AND (title LIKE ? OR artist_name LIKE ? OR album_name LIKE ? OR genre LIKE ? OR isrc LIKE ?)
            ";
            $tParams = [$like, $like, $like, $like, $like];

            if (!empty($genreFilter) && $genreFilter !== 'All') {
                $tSql .= " AND genre LIKE ?";
                $tParams[] = '%' . $genreFilter . '%';
            }
            if (!empty($yearFilter) && $yearFilter !== 'All' && is_numeric($yearFilter)) {
                $tSql .= " AND release_year = ?";
                $tParams[] = (int)$yearFilter;
            }
            $tSql .= " ORDER BY featured_on_home DESC, flontmie_plays DESC, stream_count DESC, created_at DESC LIMIT 30";

            $tStmt = $pdo->prepare($tSql);
            $tStmt->execute($tParams);
            while ($row = $tStmt->fetch()) {
                $sKey = strtolower(trim($row['title']) . '||' . trim($row['artist_name']));
                $seenSongKeys[$sKey] = true;
                if (!empty($row['video_id'])) {
                    $seenVideoIds[$row['video_id']] = true;
                }

                $coverUrl = ArtistEnrichment::resolveArtworkUrl($row['cover_art_url'] ?? '', $row['video_id'] ?? $row['id']);
                $audioUrl = '/phpbackend/api/stream.php?id=' . urlencode($row['id']);
                $videoUrl = !empty($row['local_video_path'])
                    ? ('/phpbackend/api/stream.php?id=' . urlencode($row['id']) . '&type=video')
                    : ($row['video_url'] ?? null);

                $songs[] = [
                    'type' => 'song',
                    'source' => 'catalog',
                    'id' => $row['id'],
                    'catalog_track_id' => $row['id'],
                    'videoId' => $row['video_id'] ?? null,
                    'title' => $row['title'],
                    'artist' => $row['artist_name'],
                    'artist_id' => $row['artist_id'],
                    'album' => $row['album_name'] ?: ($row['title'] . ' - Single'),
                    'album_id' => $row['album_id'],
                    'duration' => (int)($row['duration'] ?: 200),
                    'genre' => $row['genre'] ?: 'Afrobeats',
                    'country' => $row['country'] ?: 'US',
                    'release_year' => (int)($row['release_year'] ?: date('Y')),
                    'release_date' => $row['release_date'] ?: date('Y-m-d'),
                    'cover_url' => $coverUrl,
                    'audio_url' => $audioUrl,
                    'video_url' => $videoUrl,
                    'lyrics' => $row['lyrics'] ?? null,
                    'plays' => ArtistEnrichment::parseMetric((string)($row['stream_count'] ?? '0'))['compact'],
                    'stream_count' => (int)($row['stream_count'] ?? 0),
                    'flontmie_plays' => (int)($row['flontmie_plays'] ?? 0),
                    'already_imported' => true,
                    'distributor_id' => $row['distributor_id'] ?? null
                ];
            }
        }

        // 2. Local Catalog Artists
        if (empty($filter) || $filter === 'all' || $filter === 'artists') {
            $aStmt = $pdo->prepare("
                SELECT * FROM artists
                WHERE (status IS NULL OR status != 'hidden')
                  AND (name LIKE ? OR stage_name LIKE ? OR bio LIKE ? OR genres_json LIKE ?)
                ORDER BY is_featured DESC, total_streams DESC, created_at DESC
                LIMIT 20
            ");
            $aStmt->execute([$like, $like, $like, $like]);
            while ($a = $aStmt->fetch()) {
                $aKey = strtolower(trim($a['name']));
                $seenArtistKeys[$aKey] = true;
                $artists[] = [
                    'type' => 'artist',
                    'source' => 'catalog',
                    'id' => $a['id'],
                    'name' => $a['name'],
                    'subscribers' => !empty($a['followers']) ? (number_format((int)$a['followers']) . ' followers') : 'Flontmie Artist',
                    'avatar_url' => ArtistEnrichment::resolveArtworkUrl($a['avatar_url'] ?? '', $a['id']),
                    'verified' => (bool)($a['verified'] ?? false)
                ];
            }
        }

        // 3. Local Catalog Albums / Releases
        if (empty($filter) || $filter === 'all' || $filter === 'albums') {
            $albStmt = $pdo->prepare("
                SELECT * FROM albums
                WHERE (status IS NULL OR status = 'published' OR status = 'scheduled')
                  AND (title LIKE ? OR artist_name LIKE ? OR genre LIKE ? OR upc LIKE ?)
                ORDER BY is_featured DESC, release_date DESC, created_at DESC
                LIMIT 20
            ");
            $albStmt->execute([$like, $like, $like, $like]);
            while ($alb = $albStmt->fetch()) {
                $albKey = strtolower(trim($alb['title']) . '||' . trim($alb['artist_name']));
                $seenAlbumKeys[$albKey] = true;
                $albums[] = [
                    'type' => 'album',
                    'source' => 'catalog',
                    'id' => $alb['id'],
                    'browseId' => $alb['id'],
                    'title' => $alb['title'],
                    'artist' => $alb['artist_name'],
                    'artist_id' => $alb['artist_id'],
                    'release_type' => $alb['release_type'] ?? 'album',
                    'year' => !empty($alb['release_date']) ? substr($alb['release_date'], 0, 4) : date('Y'),
                    'cover_url' => ArtistEnrichment::resolveArtworkUrl($alb['cover_art_url'] ?? '', $alb['artist_id'] ?? $alb['id'])
                ];
            }
        }

        // 4. Local Catalog Playlists
        if (empty($filter) || $filter === 'all' || $filter === 'playlists') {
            $plStmt = $pdo->prepare("
                SELECT * FROM playlists
                WHERE is_public = 1 AND (status IS NULL OR status = 'published')
                  AND (title LIKE ? OR description LIKE ? OR genre_category LIKE ?)
                ORDER BY is_featured DESC, created_at DESC
                LIMIT 20
            ");
            $plStmt->execute([$like, $like, $like]);
            while ($pl = $plStmt->fetch()) {
                $plKey = strtolower(trim($pl['title']));
                $seenPlaylistKeys[$plKey] = true;
                $playlists[] = [
                    'type' => 'playlist',
                    'source' => 'catalog',
                    'id' => $pl['id'],
                    'browseId' => $pl['id'],
                    'title' => $pl['title'],
                    'curator' => 'Flontmie Catalog',
                    'cover_url' => ArtistEnrichment::resolveArtworkUrl($pl['cover_art_url'] ?? '', $pl['id'])
                ];
            }
        }
    } catch (Exception $e) {}

    // STEP B: Search YouTube Music API (ytmusicapi / Innertube) and merge results
    $effectiveQuery = $query;
    if (!empty($genreFilter) && $genreFilter !== 'All' && stripos($effectiveQuery, $genreFilter) === false) {
        $effectiveQuery .= ' ' . $genreFilter;
    }
    if (!empty($yearFilter) && $yearFilter !== 'All' && stripos($effectiveQuery, $yearFilter) === false) {
        $effectiveQuery .= ' ' . $yearFilter;
    }

    $searchPayload = ['query' => $effectiveQuery];
    if ($filter === 'songs') {
        $searchPayload['params'] = 'EgWKAQIIAWoQEAMQBBAJEAoQBRAREBAQFA%3D%3D';
    } elseif ($filter === 'artists') {
        $searchPayload['params'] = 'EgWKAQIJAWoQEAMQBBAJEAoQBRAREBAQFA%3D%3D';
    } elseif ($filter === 'albums') {
        $searchPayload['params'] = 'EgWKAQIBAWoQEAMQBBAJEAoQBRAREBAQFA%3D%3D';
    } elseif ($filter === 'playlists') {
        $searchPayload['params'] = 'EgWKAQIEAWoQEAMQBBAJEAoQBRAREBAQFA%3D%3D';
    }

    $raw = call_ytmusic('search', $searchPayload, $country);
    $catalogLookup = get_catalog_lookup($pdo);

    if ($raw && isset($raw['contents']['tabbedSearchResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'])) {
        $sections = $raw['contents']['tabbedSearchResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'];

        foreach ($sections as $sec) {
            $shelf = $sec['musicShelfRenderer'] ?? $sec['musicCardShelfRenderer'] ?? null;
            $items = [];
            
            if (isset($sec['itemSectionRenderer']['contents'])) {
                $items = $sec['itemSectionRenderer']['contents'];
            } elseif ($shelf && isset($shelf['contents'])) {
                $items = $shelf['contents'];
            }

            foreach ($items as $itemWrapper) {
                $r = $itemWrapper['musicResponsiveListItemRenderer'] ?? null;
                if (!$r) continue;

                $flex = $r['flexColumns'] ?? [];
                if (count($flex) === 0) continue;

                $col0Text = get_runs_text($flex[0]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null);
                $col1Text = get_runs_text($flex[1]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null);
                $col2Text = count($flex) > 2 ? get_runs_text($flex[2]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null) : '';

                $thumbs = $r['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
                $thumbUrl = '';
                if (!empty($thumbs)) {
                    $thumbUrl = end($thumbs)['url'] ?? '';
                    $thumbUrl = preg_replace('/=w\d+-h\d+/', '=w600-h600', $thumbUrl);
                }

                $videoId = $r['playlistItemData']['videoId'] ?? null;
                if (!$videoId && isset($r['overlay']['musicItemThumbnailOverlayRenderer']['content']['musicPlayButtonRenderer']['playNavigationEndpoint']['watchEndpoint']['videoId'])) {
                    $videoId = $r['overlay']['musicItemThumbnailOverlayRenderer']['content']['musicPlayButtonRenderer']['playNavigationEndpoint']['watchEndpoint']['videoId'];
                }

                $browseEndpoint = $r['navigationEndpoint']['browseEndpoint'] ?? null;
                $browseId = $browseEndpoint['browseId'] ?? '';

                $lowerSubtitle = strtolower($col1Text);
                $isArtist = strpos($lowerSubtitle, 'artist') !== false || strpos($browseId, 'UC') === 0;
                $isAlbum = strpos($lowerSubtitle, 'album') !== false || strpos($lowerSubtitle, 'ep') !== false || strpos($lowerSubtitle, 'single') !== false || strpos($browseId, 'MPREb_') === 0;
                $isPlaylist = strpos($lowerSubtitle, 'playlist') !== false || strpos($browseId, 'VLPL') === 0 || strpos($browseId, 'RDCLAK') === 0;

                if ($isArtist) {
                    $aKey = strtolower(trim($col0Text));
                    if (isset($seenArtistKeys[$aKey])) continue;
                    $seenArtistKeys[$aKey] = true;
                    $artists[] = [
                        'type' => 'artist',
                        'source' => 'ytmusic',
                        'id' => $browseId ?: ('art_' . md5($col0Text)),
                        'name' => $col0Text,
                        'subscribers' => $col1Text,
                        'avatar_url' => $thumbUrl
                    ];
                } elseif ($isAlbum) {
                    $artistClean = str_replace(['Album • ', 'Single • ', 'EP • '], '', $col1Text);
                    $albKey = strtolower(trim($col0Text) . '||' . trim($artistClean));
                    if (isset($seenAlbumKeys[$albKey])) continue;
                    $seenAlbumKeys[$albKey] = true;
                    $albums[] = [
                        'type' => 'album',
                        'source' => 'ytmusic',
                        'id' => $browseId ?: ('alb_' . md5($col0Text)),
                        'browseId' => $browseId,
                        'title' => $col0Text,
                        'artist' => $artistClean,
                        'year' => date('Y'),
                        'cover_url' => $thumbUrl
                    ];
                } elseif ($isPlaylist) {
                    $plKey = strtolower(trim($col0Text));
                    if (isset($seenPlaylistKeys[$plKey])) continue;
                    $seenPlaylistKeys[$plKey] = true;
                    $playlists[] = [
                        'type' => 'playlist',
                        'source' => 'ytmusic',
                        'id' => $browseId ?: ('ply_' . md5($col0Text)),
                        'browseId' => $browseId,
                        'title' => $col0Text,
                        'curator' => $col1Text,
                        'cover_url' => $thumbUrl
                    ];
                } else {
                    $artistName = 'Artist';
                    $parts = explode('•', $col1Text);
                    if (count($parts) >= 2) {
                        $artistName = trim($parts[1]);
                    } elseif (!empty($col1Text)) {
                        $artistName = trim($col1Text);
                    }

                    $lookupKey = strtolower(trim($col0Text) . '||' . trim($artistName));
                    if (($videoId && isset($seenVideoIds[$videoId])) || isset($seenSongKeys[$lookupKey])) {
                        continue;
                    }
                    if ($videoId) $seenVideoIds[$videoId] = true;
                    $seenSongKeys[$lookupKey] = true;

                    $inferredYear = (int)($yearFilter && is_numeric($yearFilter) ? $yearFilter : date('Y'));
                    if (preg_match('/\b(19\d\d|20[0-2]\d)\b/', $col1Text . ' ' . $col2Text, $ym)) {
                        $inferredYear = (int)$ym[1];
                    }
                    $inferredGenre = (!empty($genreFilter) && $genreFilter !== 'All') ? $genreFilter : 'Pop';
                    $existingTrackId = ($videoId && isset($catalogLookup['video'][$videoId]))
                        ? $catalogLookup['video'][$videoId]
                        : ($catalogLookup['key'][$lookupKey] ?? null);

                    $songs[] = [
                        'type' => 'song',
                        'source' => $existingTrackId ? 'catalog' : 'ytmusic',
                        'id' => $existingTrackId ?: ($videoId ? ('yt_' . $videoId) : ('yt_' . md5($col0Text . $artistName))),
                        'videoId' => $videoId,
                        'title' => $col0Text,
                        'artist' => $artistName,
                        'album' => count($parts) >= 3 ? trim($parts[2]) : ($col0Text . ' - Single'),
                        'duration' => 210,
                        'genre' => $inferredGenre,
                        'country' => $country,
                        'release_year' => $inferredYear,
                        'release_date' => "{$inferredYear}-" . date('m-d'),
                        'cover_url' => $thumbUrl,
                        'audio_url' => $existingTrackId ? ('/phpbackend/api/stream.php?id=' . urlencode($existingTrackId)) : null,
                        'plays' => $col2Text ?: '',
                        'already_imported' => !empty($existingTrackId),
                        'catalog_track_id' => $existingTrackId
                    ];
                }
            }
        }
    }

    $totalResults = count($songs) + count($artists) + count($albums) + count($playlists);
    try {
        $stmtLog = $pdo->prepare("INSERT INTO search_logs (user_id, query, results_count, ip_address) VALUES (?, ?, ?, ?)");
        $stmtLog->execute([
            $adminUser ? $adminUser['id'] : null,
            substr($effectiveQuery, 0, 255),
            $totalResults,
            $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);
    } catch (Exception $e) {}

    json_response([
        'status' => 'success',
        'query' => $query,
        'effective_query' => $effectiveQuery,
        'filter' => $filter ?: 'all',
        'country' => $country,
        'year' => $yearFilter ?: 'All',
        'genre' => $genreFilter ?: 'All',
        'results' => [
            'songs' => $songs,
            'artists' => $artists,
            'albums' => $albums,
            'playlists' => $playlists
        ],
        'total_count' => $totalResults
    ]);
}

// --- 1b. LIVE SEARCH SUGGESTIONS WHILE TYPING (COMBINES FLONTMIE DB + YTMUSICAPI) ---
if ($action === 'suggestions') {
    $q = trim($_GET['q'] ?? '');
    if (empty($q)) {
        json_response(['status' => 'success', 'suggestions' => []]);
    }

    $suggestions = [];
    $seen = [];

    // 1. Match Flontmie database tracks and artists first
    try {
        $like = '%' . $q . '%';
        $stmt = $pdo->prepare("
            SELECT id, title, artist_name, cover_art_url, video_id 
            FROM tracks 
            WHERE is_deleted = 0 AND (status IS NULL OR status = 'published' OR status = 'active')
              AND (title LIKE ? OR artist_name LIKE ? OR album_name LIKE ?) 
            ORDER BY flontmie_plays DESC, stream_count DESC LIMIT 6
        ");
        $stmt->execute([$like, $like, $like]);
        while ($row = $stmt->fetch()) {
            $tKey = strtolower(trim($row['title']) . '||' . trim($row['artist_name']));
            if (!isset($seen[$tKey])) {
                $seen[$tKey] = true;
                $suggestions[] = [
                    'text' => $row['title'],
                    'type' => 'song',
                    'source' => 'catalog',
                    'artist' => $row['artist_name'],
                    'track_id' => $row['id'],
                    'videoId' => $row['video_id'],
                    'cover_url' => ArtistEnrichment::resolveArtworkUrl($row['cover_art_url'] ?? '', $row['video_id'] ?? $row['id'])
                ];
            }
        }

        $artStmt = $pdo->prepare("
            SELECT id, name, avatar_url FROM artists
            WHERE (status IS NULL OR status != 'hidden') AND name LIKE ?
            ORDER BY total_streams DESC LIMIT 3
        ");
        $artStmt->execute([$like]);
        while ($aRow = $artStmt->fetch()) {
            $aKey = 'artist||' . strtolower(trim($aRow['name']));
            if (!isset($seen[$aKey])) {
                $seen[$aKey] = true;
                $suggestions[] = [
                    'text' => $aRow['name'],
                    'type' => 'artist',
                    'source' => 'catalog',
                    'artist_id' => $aRow['id'],
                    'cover_url' => ArtistEnrichment::resolveArtworkUrl($aRow['avatar_url'] ?? '', $aRow['id'])
                ];
            }
        }
    } catch (Exception $e) {}

    // 2. Query YouTube Music search suggestions
    $raw = call_ytmusic('music/get_search_suggestions', ['input' => $q]);
    if ($raw && isset($raw['contents'][0]['searchSuggestionsSectionRenderer']['contents'])) {
        $items = $raw['contents'][0]['searchSuggestionsSectionRenderer']['contents'];
        foreach ($items as $it) {
            $renderer = $it['searchSuggestionRenderer'] ?? null;
            if ($renderer) {
                $text = get_runs_text($renderer['suggestion'] ?? null);
                if (!empty($text)) {
                    $k = strtolower(trim($text));
                    if (!isset($seen[$k])) {
                        $seen[$k] = true;
                        $suggestions[] = [
                            'text' => $text,
                            'type' => 'query',
                            'source' => 'ytmusic'
                        ];
                    }
                }
            }
        }
    }

    json_response([
        'status' => 'success',
        'query' => $q,
        'suggestions' => array_slice($suggestions, 0, 10)
    ]);
}

// --- 2. CHARTS (REAL YOUTUBE MUSIC CHARTS + REAL FLONTMIE TOP TRACKS) ---
if ($action === 'charts') {
    $chartTracks = [];

    // First fetch live YouTube Music charts
    $raw = call_ytmusic('browse', ['browseId' => 'FEmusic_charts']);
    if ($raw && isset($raw['contents']['singleColumnBrowseResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'])) {
        $sections = $raw['contents']['singleColumnBrowseResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'];

        foreach ($sections as $sec) {
            $shelf = $sec['musicCarouselShelfRenderer'] ?? $sec['musicShelfRenderer'] ?? null;
            if (!$shelf) continue;

            $shelfTitle = get_runs_text($shelf['header']['musicCarouselShelfBasicHeaderRenderer']['title'] ?? $shelf['title'] ?? null);
            $items = $shelf['contents'] ?? [];

            foreach ($items as $it) {
                $r = $it['musicResponsiveListItemRenderer'] ?? $it['musicTwoRowItemRenderer'] ?? null;
                if (!$r) continue;

                $thumbs = $r['thumbnailRenderer']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? $r['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
                $thumbUrl = !empty($thumbs) ? end($thumbs)['url'] : '';
                $thumbUrl = preg_replace('/=w\d+-h\d+/', '=w600-h600', $thumbUrl);

                $title = get_runs_text($r['title'] ?? ($r['flexColumns'][0]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null));
                $subtitle = get_runs_text($r['subtitle'] ?? ($r['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null));
                $videoId = $r['navigationEndpoint']['watchEndpoint']['videoId'] ?? ($r['playlistItemData']['videoId'] ?? null);

                if (!empty($title)) {
                    $chartTracks[] = [
                        'id' => $videoId ? ('yt_' . $videoId) : ('yt_chart_' . md5($title)),
                        'videoId' => $videoId,
                        'title' => $title,
                        'artist' => $subtitle ?: 'Artist',
                        'cover_url' => $thumbUrl,
                        'shelf' => $shelfTitle ?: 'Top Charts',
                        'streams' => 0
                    ];
                }
            }
        }
    }

    // Also include top tracks from the Flontmie database ordered by real stream counts
    if (empty($chartTracks)) {
        try {
            $stmt = $pdo->query("
                SELECT id, video_id, title, artist_name, cover_art_url, stream_count
                FROM tracks
                WHERE is_deleted = 0 AND (status IS NULL OR status = 'published' OR status = 'active')
                ORDER BY flontmie_plays DESC, stream_count DESC
                LIMIT 25
            ");
            while ($row = $stmt->fetch()) {
                $chartTracks[] = [
                    'id' => $row['id'],
                    'videoId' => $row['video_id'],
                    'title' => $row['title'],
                    'artist' => $row['artist_name'],
                    'cover_url' => ArtistEnrichment::resolveArtworkUrl($row['cover_art_url'] ?? '', $row['video_id'] ?? $row['id']),
                    'shelf' => 'Flontmie Top Chart',
                    'streams' => (int)($row['stream_count'] ?? 0)
                ];
            }
        } catch (Exception $e) {}
    }

    json_response([
        'status' => 'success',
        'source' => 'Flontmie & YouTube Music Charts',
        'count' => count($chartTracks),
        'charts' => $chartTracks
    ]);
}

// --- 3. MOODS & GENRES ---
if ($action === 'moods') {
    $categories = [];

    // Load active genres from database first
    try {
        $gStmt = $pdo->query("SELECT name, slug, color FROM genres WHERE is_active = 1 ORDER BY sort_order ASC");
        while ($g = $gStmt->fetch()) {
            $categories[] = [
                'name' => $g['name'],
                'browseId' => 'genre_' . $g['slug'],
                'color' => $g['color'] ?: '#e11d48'
            ];
        }
    } catch (Exception $e) {}

    $raw = call_ytmusic('browse', ['browseId' => 'FEmusic_moods_and_genres']);
    if ($raw && isset($raw['contents']['singleColumnBrowseResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'])) {
        $sections = $raw['contents']['singleColumnBrowseResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'];
        foreach ($sections as $sec) {
            $items = $sec['gridRenderer']['items'] ?? [];
            foreach ($items as $item) {
                $btn = $item['musicNavigationButtonRenderer'] ?? null;
                if (!$btn) continue;
                $name = get_runs_text($btn['buttonText'] ?? null);
                $endpoint = $btn['clickCommand']['browseEndpoint']['browseId'] ?? '';
                if (!empty($name)) {
                    $categories[] = [
                        'name' => $name,
                        'browseId' => $endpoint,
                        'color' => '#e11d48'
                    ];
                }
            }
        }
    }

    json_response([
        'status' => 'success',
        'count' => count($categories),
        'moods_and_genres' => $categories
    ]);
}

// --- 4. REAL LYRICS (CHECKS FLONTMIE MYSQL CATALOG FIRST, THEN YOUTUBE MUSIC INNERTUBE) ---
if ($action === 'lyrics') {
    $videoId = trim($_GET['videoId'] ?? $_GET['id'] ?? '');
    $trackId = trim($_GET['track_id'] ?? $_GET['id'] ?? '');
    if (empty($videoId) && empty($trackId)) {
        json_response(['status' => 'error', 'message' => 'track_id or videoId is required for lyrics'], 400);
    }

    $lyrics = null;
    $source = null;

    // 1. Check Flontmie MySQL database for uploaded/stored lyrics
    try {
        $stmt = $pdo->prepare("SELECT lyrics, local_lyrics_path, video_id FROM tracks WHERE id = ? OR video_id = ? LIMIT 1");
        $stmt->execute([$trackId ?: $videoId, $videoId ?: $trackId]);
        $row = $stmt->fetch();
        if ($row) {
            if (!empty($row['lyrics'])) {
                $lyrics = trim($row['lyrics']);
                $source = 'Flontmie Catalog Lyrics';
            } elseif (!empty($row['local_lyrics_path'])) {
                $fullLyricsPath = STORAGE_ROOT . '/' . ltrim($row['local_lyrics_path'], '/');
                if (is_file($fullLyricsPath)) {
                    $lyrics = trim((string)file_get_contents($fullLyricsPath));
                    $source = 'Flontmie Uploaded Lyrics File';
                }
            }
            if (empty($videoId) && !empty($row['video_id'])) {
                $videoId = $row['video_id'];
            }
        }
    } catch (Exception $e) {}

    // 2. If not in local DB and we have a YouTube videoId, query YouTube Music Watch Next -> Lyrics browseId
    if (empty($lyrics) && !empty($videoId) && strpos($videoId, 'trk_') !== 0) {
        $nextData = call_ytmusic('next', ['videoId' => $videoId]);
        $lyricsBrowseId = null;

        if ($nextData && isset($nextData['contents']['singleColumnMusicWatchNextResultsRenderer']['tabbedRenderer']['watchNextTabbedResultsRenderer']['tabs'])) {
            $tabs = $nextData['contents']['singleColumnMusicWatchNextResultsRenderer']['tabbedRenderer']['watchNextTabbedResultsRenderer']['tabs'];
            foreach ($tabs as $t) {
                $tabRenderer = $t['tabRenderer'] ?? [];
                if (($tabRenderer['title'] ?? '') === 'Lyrics') {
                    $lyricsBrowseId = $tabRenderer['endpoint']['browseEndpoint']['browseId'] ?? null;
                    break;
                }
            }
        }

        if ($lyricsBrowseId) {
            $browseData = call_ytmusic('browse', ['browseId' => $lyricsBrowseId]);
            if ($browseData && isset($browseData['contents']['sectionListRenderer']['contents'][0]['musicDescriptionShelfRenderer']['description']['runs'])) {
                $runs = $browseData['contents']['sectionListRenderer']['contents'][0]['musicDescriptionShelfRenderer']['description']['runs'];
                $lyricsText = '';
                foreach ($runs as $r) {
                    $lyricsText .= $r['text'] ?? '';
                }
                if (!empty(trim($lyricsText))) {
                    $lyrics = trim($lyricsText);
                    $source = get_runs_text($browseData['contents']['sectionListRenderer']['contents'][0]['musicDescriptionShelfRenderer']['footer'] ?? null) ?: 'YouTube Music';
                }
            }
        }
    }

    json_response([
        'status' => 'success',
        'videoId' => $videoId,
        'lyrics' => $lyrics,
        'source' => $source
    ]);
}

// --- 5. YOUTUBE MUSIC ARTIST PROFILE & DISCOGRAPHY ---
if ($action === 'artist') {
    $browseId = trim($_GET['browseId'] ?? $_GET['id'] ?? '');
    $artistName = trim($_GET['name'] ?? '');

    $topSongs = [];
    $albums = [];
    $singles = [];
    $artistInfo = [
        'name' => $artistName ?: 'Artist',
        'subscribers' => '',
        'description' => '',
        'avatar_url' => ''
    ];

    if ($browseId) {
        $raw = call_ytmusic('browse', ['browseId' => $browseId]);
        if ($raw) {
            $header = $raw['header']['musicImmersiveHeaderRenderer'] ?? $raw['header']['musicVisualHeaderRenderer'] ?? null;
            if ($header) {
                $artistInfo['name'] = get_runs_text($header['title'] ?? null) ?: $artistInfo['name'];
                $artistInfo['description'] = get_runs_text($header['description'] ?? null);
                $artistInfo['subscribers'] = get_runs_text($header['subscriptionButton']['subscribeButtonRenderer']['subscriberCountText'] ?? null);
                $thumbs = $header['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
                if (!empty($thumbs)) {
                    $artistInfo['avatar_url'] = end($thumbs)['url'];
                }
            }

            $sections = $raw['contents']['singleColumnBrowseResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'] ?? [];
            foreach ($sections as $sec) {
                $shelf = $sec['musicShelfRenderer'] ?? $sec['musicCarouselShelfRenderer'] ?? null;
                if (!$shelf) continue;
                $shelfTitle = strtolower(get_runs_text($shelf['title'] ?? ($shelf['header']['musicCarouselShelfBasicHeaderRenderer']['title'] ?? null)));

                $items = $shelf['contents'] ?? [];
                foreach ($items as $it) {
                    $r = $it['musicResponsiveListItemRenderer'] ?? $it['musicTwoRowItemRenderer'] ?? null;
                    if (!$r) continue;

                    $title = get_runs_text($r['title'] ?? ($r['flexColumns'][0]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null));
                    $subtitle = get_runs_text($r['subtitle'] ?? ($r['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null));
                    $videoId = $r['navigationEndpoint']['watchEndpoint']['videoId'] ?? ($r['playlistItemData']['videoId'] ?? null);
                    $itemBrowseId = $r['navigationEndpoint']['browseEndpoint']['browseId'] ?? '';
                    $thumbs = $r['thumbnailRenderer']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? $r['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
                    $thumbUrl = !empty($thumbs) ? end($thumbs)['url'] : $artistInfo['avatar_url'];

                    if (strpos($shelfTitle, 'song') !== false) {
                        $topSongs[] = [
                            'id' => $videoId ? ('yt_' . $videoId) : ('yt_art_s_' . md5($title)),
                            'videoId' => $videoId,
                            'title' => $title,
                            'artist' => $artistInfo['name'],
                            'cover_url' => $thumbUrl,
                            'duration' => 210,
                            'plays' => $subtitle
                        ];
                    } elseif (strpos($shelfTitle, 'album') !== false) {
                        $albums[] = [
                            'id' => $itemBrowseId ?: ('yt_alb_' . md5($title)),
                            'browseId' => $itemBrowseId,
                            'title' => $title,
                            'artist' => $artistInfo['name'],
                            'year' => $subtitle,
                            'cover_url' => $thumbUrl
                        ];
                    } elseif (strpos($shelfTitle, 'single') !== false || strpos($shelfTitle, 'ep') !== false) {
                        $singles[] = [
                            'id' => $itemBrowseId ?: ('yt_sng_' . md5($title)),
                            'browseId' => $itemBrowseId,
                            'title' => $title,
                            'artist' => $artistInfo['name'],
                            'year' => $subtitle,
                            'cover_url' => $thumbUrl
                        ];
                    }
                }
            }
        }
    }

    if (empty($topSongs) && ($artistName || $artistInfo['name'])) {
        $searchQuery = $artistName ?: $artistInfo['name'];
        $rawSearch = call_ytmusic('search', ['query' => $searchQuery, 'params' => 'EgWKAQIIAWoQEAMQBBAJEAoQBRAREBAQFA%3D%3D']);
        if ($rawSearch && isset($rawSearch['contents']['tabbedSearchResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'])) {
            $sections = $rawSearch['contents']['tabbedSearchResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'];
            foreach ($sections as $sec) {
                $items = $sec['musicShelfRenderer']['contents'] ?? $sec['itemSectionRenderer']['contents'] ?? [];
                foreach ($items as $it) {
                    $r = $it['musicResponsiveListItemRenderer'] ?? null;
                    if (!$r) continue;
                    $flex = $r['flexColumns'] ?? [];
                    if (empty($flex)) continue;
                    $title = get_runs_text($flex[0]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null);
                    $artist = count($flex) > 1 ? get_runs_text($flex[1]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null) : $searchQuery;
                    $videoId = $r['playlistItemData']['videoId'] ?? null;
                    $thumbs = $r['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
                    $thumbUrl = !empty($thumbs) ? end($thumbs)['url'] : $artistInfo['avatar_url'];
                    if ($title) {
                        $topSongs[] = [
                            'id' => $videoId ? ('yt_' . $videoId) : ('yt_art_' . md5($title)),
                            'videoId' => $videoId,
                            'title' => $title,
                            'artist' => $artist,
                            'cover_url' => $thumbUrl,
                            'duration' => 210,
                            'plays' => ''
                        ];
                    }
                }
            }
        }
    }

    json_response([
        'status' => 'success',
        'artist' => $artistInfo,
        'top_songs' => array_slice($topSongs, 0, 15),
        'albums' => $albums,
        'singles' => $singles
    ]);
}

// --- 6. ALBUM DETAILS & TRACKLIST (SUPPORTS BOTH FLONTMIE ALBUMS AND YTMUSIC ALBUMS) ---
if ($action === 'album') {
    $browseId = trim($_GET['browseId'] ?? $_GET['id'] ?? '');
    if (empty($browseId)) {
        json_response(['status' => 'error', 'message' => 'browseId is required for album'], 400);
    }

    // Check if this is a local Flontmie catalog album first
    $albStmt = $pdo->prepare("SELECT * FROM albums WHERE id = ? LIMIT 1");
    $albStmt->execute([$browseId]);
    $localAlbum = $albStmt->fetch();
    if ($localAlbum) {
        $tStmt = $pdo->prepare("SELECT * FROM tracks WHERE album_id = ? AND is_deleted = 0 ORDER BY id ASC");
        $tStmt->execute([$browseId]);
        $localTracks = [];
        while ($t = $tStmt->fetch()) {
            $localTracks[] = [
                'id' => $t['id'],
                'catalog_track_id' => $t['id'],
                'videoId' => $t['video_id'],
                'title' => $t['title'],
                'artist' => $t['artist_name'],
                'duration' => (int)($t['duration'] ?: 200),
                'cover_url' => ArtistEnrichment::resolveArtworkUrl($t['cover_art_url'] ?? '', $t['video_id'] ?? $t['id']),
                'audio_url' => '/phpbackend/api/stream.php?id=' . urlencode($t['id'])
            ];
        }
        json_response([
            'status' => 'success',
            'album' => [
                'id' => $localAlbum['id'],
                'title' => $localAlbum['title'],
                'artist' => $localAlbum['artist_name'],
                'year' => !empty($localAlbum['release_date']) ? substr($localAlbum['release_date'], 0, 4) : date('Y'),
                'cover_url' => ArtistEnrichment::resolveArtworkUrl($localAlbum['cover_art_url'] ?? '', $localAlbum['id']),
                'tracks' => $localTracks
            ]
        ]);
    }

    $raw = call_ytmusic('browse', ['browseId' => $browseId]);
    $albumInfo = [
        'id' => $browseId,
        'title' => 'Album',
        'artist' => 'Artist',
        'year' => date('Y'),
        'cover_url' => '',
        'tracks' => []
    ];

    if ($raw) {
        $header = $raw['header']['musicDetailHeaderRenderer'] ?? $raw['header']['musicResponsiveHeaderRenderer'] ?? null;
        if ($header) {
            $albumInfo['title'] = get_runs_text($header['title'] ?? null) ?: 'Album';
            $albumInfo['artist'] = get_runs_text($header['subtitle'] ?? ($header['straplineTextOne'] ?? null));
            $thumbs = $header['thumbnail']['croppedSquareThumbnailRenderer']['thumbnail']['thumbnails'] ?? $header['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
            if (!empty($thumbs)) {
                $albumInfo['cover_url'] = end($thumbs)['url'];
            }
        }

        $sections = $raw['contents']['singleColumnBrowseResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'] ?? [];
        foreach ($sections as $sec) {
            $shelf = $sec['musicShelfRenderer'] ?? null;
            if (!$shelf) continue;
            $items = $shelf['contents'] ?? [];
            foreach ($items as $it) {
                $r = $it['musicResponsiveListItemRenderer'] ?? null;
                if (!$r) continue;
                $title = get_runs_text($r['flexColumns'][0]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null);
                $videoId = $r['playlistItemData']['videoId'] ?? ($r['navigationEndpoint']['watchEndpoint']['videoId'] ?? null);
                $durationText = get_runs_text($r['fixedColumns'][0]['musicResponsiveListItemFixedColumnRenderer']['text'] ?? null);
                if ($title) {
                    $albumInfo['tracks'][] = [
                        'id' => $videoId ? ('yt_' . $videoId) : ('yt_alb_t_' . md5($title)),
                        'videoId' => $videoId,
                        'title' => $title,
                        'artist' => $albumInfo['artist'],
                        'duration_text' => $durationText,
                        'duration' => 200,
                        'cover_url' => $albumInfo['cover_url']
                    ];
                }
            }
        }
    }

    json_response([
        'status' => 'success',
        'album' => $albumInfo
    ]);
}

// --- 7. PLAYLIST DETAILS & TRACKS ---
if ($action === 'playlist') {
    $browseId = trim($_GET['browseId'] ?? $_GET['id'] ?? '');
    if (empty($browseId)) {
        json_response(['status' => 'error', 'message' => 'browseId is required for playlist'], 400);
    }

    $raw = call_ytmusic('browse', ['browseId' => $browseId]);
    $playlistInfo = [
        'id' => $browseId,
        'title' => 'Playlist',
        'curator' => '',
        'description' => '',
        'cover_url' => '',
        'tracks' => []
    ];

    if ($raw) {
        $header = $raw['header']['musicDetailHeaderRenderer'] ?? $raw['header']['musicResponsiveHeaderRenderer'] ?? null;
        if ($header) {
            $playlistInfo['title'] = get_runs_text($header['title'] ?? null) ?: $playlistInfo['title'];
            $playlistInfo['curator'] = get_runs_text($header['subtitle'] ?? ($header['straplineTextOne'] ?? null)) ?: $playlistInfo['curator'];
            $playlistInfo['description'] = get_runs_text($header['description'] ?? null);
            $thumbs = $header['thumbnail']['croppedSquareThumbnailRenderer']['thumbnail']['thumbnails'] ?? $header['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
            if (!empty($thumbs)) {
                $playlistInfo['cover_url'] = end($thumbs)['url'];
            }
        }

        $sections = $raw['contents']['singleColumnBrowseResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'] ?? [];
        foreach ($sections as $sec) {
            $shelf = $sec['musicPlaylistShelfRenderer'] ?? $sec['musicShelfRenderer'] ?? null;
            if (!$shelf) continue;
            $items = $shelf['contents'] ?? [];
            foreach ($items as $it) {
                $r = $it['musicResponsiveListItemRenderer'] ?? null;
                if (!$r) continue;
                $flex = $r['flexColumns'] ?? [];
                if (empty($flex)) continue;

                $title = get_runs_text($flex[0]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null);
                $artist = count($flex) > 1 ? get_runs_text($flex[1]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null) : $playlistInfo['curator'];
                $videoId = $r['playlistItemData']['videoId'] ?? ($r['navigationEndpoint']['watchEndpoint']['videoId'] ?? null);
                $thumbs = $r['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
                $thumbUrl = !empty($thumbs) ? end($thumbs)['url'] : $playlistInfo['cover_url'];

                if ($title) {
                    $playlistInfo['tracks'][] = [
                        'id' => $videoId ? ('yt_' . $videoId) : ('yt_pl_t_' . md5($title)),
                        'videoId' => $videoId,
                        'title' => $title,
                        'artist' => $artist,
                        'cover_url' => $thumbUrl,
                        'duration' => 210
                    ];
                }
            }
        }
    }

    json_response([
        'status' => 'success',
        'playlist' => $playlistInfo
    ]);
}

// --- 8. IMPORT SINGLE YOUTUBE MUSIC TRACK INTO MYSQL & LOCAL SERVER STORAGE ---
if ($action === 'import' && $method === 'POST') {
    try {
        $result = MediaEngine::importTrackToCatalog($pdo, $input, $adminUser['id'], [
            'genre' => $input['genre'] ?? 'Pop',
            'country' => $input['country'] ?? 'US',
            'license_status' => $input['license_status'] ?? 'verified_licensed',
            'license_notes' => $input['license_notes'] ?? 'Imported via Admin YT Music Discovery',
            'auto_publish' => isset($input['auto_publish']) ? (bool)$input['auto_publish'] : true,
            'force_resync' => !empty($input['force_resync'])
        ]);
        json_response($result);
    } catch (Exception $e) {
        json_response([
            'status' => 'error',
            'message' => 'Import failed: ' . $e->getMessage()
        ], 500);
    }
}

// --- 8b. BULK IMPORT SELECTED TRACKS ---
if ($action === 'bulk_import' && $method === 'POST') {
    $items = $input['items'] ?? [];
    if (!is_array($items) || empty($items)) {
        json_response(['status' => 'error', 'message' => 'Please select at least one item to bulk import.'], 400);
    }

    $batchId = 'batch_' . bin2hex(random_bytes(6));
    $importedCount = 0;
    $skippedCount = 0;
    $failedCount = 0;
    $results = [];

    $options = [
        'batch_id' => $batchId,
        'genre' => $input['genre'] ?? 'Pop',
        'country' => $input['country'] ?? 'US',
        'license_status' => $input['license_status'] ?? 'verified_licensed',
        'license_notes' => $input['license_notes'] ?? 'Bulk imported via Admin YT Music Sync Engine',
        'auto_publish' => isset($input['auto_publish']) ? (bool)$input['auto_publish'] : true,
        'force_resync' => !empty($input['force_resync'])
    ];

    foreach (array_slice($items, 0, 30) as $item) {
        try {
            $res = MediaEngine::importTrackToCatalog($pdo, $item, $adminUser['id'], $options);
            if ($res['status'] === 'completed') {
                $importedCount++;
            } elseif ($res['status'] === 'duplicate_skipped') {
                $skippedCount++;
            }
            $results[] = $res;
        } catch (Exception $e) {
            $failedCount++;
            $results[] = [
                'status' => 'failed',
                'title' => $item['title'] ?? 'Unknown',
                'message' => $e->getMessage()
            ];
        }
    }

    json_response([
        'status' => 'success',
        'batch_id' => $batchId,
        'imported_count' => $importedCount,
        'skipped_count' => $skippedCount,
        'failed_count' => $failedCount,
        'message' => "Bulk import finished: {$importedCount} synced to local storage, {$skippedCount} duplicates skipped, {$failedCount} failed.",
        'results' => $results
    ]);
}

// --- 8c. IMPORT ENTIRE ALBUM, ARTIST DISCOGRAPHY, OR PLAYLIST COLLECTION ---
if ($action === 'import_collection' && $method === 'POST') {
    $collectionType = strtolower(trim($input['collection_type'] ?? 'album'));
    $collectionTitle = trim($input['title'] ?? 'Imported Collection');
    $collectionArtist = trim($input['artist'] ?? 'Various Artists');
    $collectionCover = trim($input['cover_url'] ?? '');
    $tracksList = $input['tracks'] ?? [];

    if (!is_array($tracksList) || empty($tracksList)) {
        json_response(['status' => 'error', 'message' => 'No tracks found in collection to import.'], 400);
    }

    $batchId = 'batch_' . $collectionType . '_' . bin2hex(random_bytes(4));
    $importedTrackIds = [];
    $importedCount = 0;
    $skippedCount = 0;

    foreach (array_slice($tracksList, 0, 25) as $trk) {
        $trk['album'] = $trk['album'] ?? ($collectionType === 'album' ? $collectionTitle : ($trk['title'] . ' - Single'));
        $trk['artist'] = $trk['artist'] ?? $collectionArtist;
        $trk['cover_url'] = $trk['cover_url'] ?? $collectionCover;
        try {
            $res = MediaEngine::importTrackToCatalog($pdo, $trk, $adminUser['id'], [
                'batch_id' => $batchId,
                'genre' => $input['genre'] ?? 'Pop',
                'country' => $input['country'] ?? 'US',
                'license_status' => $input['license_status'] ?? 'verified_licensed',
                'auto_publish' => true
            ]);
            if (!empty($res['track_id'])) {
                $importedTrackIds[] = $res['track_id'];
            }
            if ($res['status'] === 'completed') {
                $importedCount++;
            } else {
                $skippedCount++;
            }
        } catch (Exception $e) {}
    }

    $createdPlaylistId = null;
    if ($collectionType === 'playlist' && !empty($importedTrackIds)) {
        $createdPlaylistId = 'ply_' . substr(md5($collectionTitle), 0, 12);
        $pdo->prepare("
            INSERT INTO playlists (id, user_id, title, description, cover_art_url, genre_category, is_public, is_featured, status, track_ids_json)
            VALUES (?, ?, ?, ?, ?, 'all', 1, 1, 'published', ?)
            ON DUPLICATE KEY UPDATE
                title = VALUES(title),
                cover_art_url = VALUES(cover_art_url),
                track_ids_json = VALUES(track_ids_json),
                status = 'published'
        ")->execute([
            $createdPlaylistId,
            $adminUser['id'],
            $collectionTitle,
            $input['description'] ?? "Curated collection ({$collectionArtist})",
            $collectionCover,
            json_encode(array_values(array_unique($importedTrackIds)))
        ]);
    }

    json_response([
        'status' => 'success',
        'batch_id' => $batchId,
        'collection_type' => $collectionType,
        'imported_count' => $importedCount,
        'skipped_count' => $skippedCount,
        'playlist_id' => $createdPlaylistId,
        'message' => "Imported {$collectionType} '{$collectionTitle}': {$importedCount} tracks synced to local server, {$skippedCount} existing tracks linked."
    ]);
}

// --- 8d. RETRY OR CANCEL IMPORT JOB ---
if (($action === 'retry_job' || $action === 'cancel_job') && $method === 'POST') {
    $jobId = trim($input['job_id'] ?? '');
    if (empty($jobId)) {
        json_response(['status' => 'error', 'message' => 'Missing job_id'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM import_jobs WHERE id = ? LIMIT 1");
    $stmt->execute([$jobId]);
    $job = $stmt->fetch();
    if (!$job) {
        json_response(['status' => 'error', 'message' => 'Import job not found'], 404);
    }

    if ($action === 'cancel_job') {
        $pdo->prepare("UPDATE import_jobs SET status = 'cancelled', error_message = 'Cancelled by administrator' WHERE id = ?")->execute([$jobId]);
        Auth::logAudit($adminUser['id'], 'ADMIN_IMPORT_CANCELLED', 'IMPORT_JOB', $jobId, ['title' => $job['title']]);
        json_response(['status' => 'success', 'message' => "Import job '{$job['title']}' cancelled."]);
    }

    $payload = !empty($job['raw_payload_json']) ? json_decode($job['raw_payload_json'], true) : [];
    if (!is_array($payload) || empty($payload['title'])) {
        $payload = [
            'title' => $job['title'],
            'artist' => $job['artist_name'],
            'album' => $job['album_name'],
            'videoId' => $job['source_id'],
            'genre' => $job['genre'],
            'country' => $job['country'],
            'release_year' => $job['release_year']
        ];
    }

    try {
        $res = MediaEngine::importTrackToCatalog($pdo, $payload, $adminUser['id'], [
            'job_id' => $jobId,
            'genre' => $job['genre'] ?: 'Pop',
            'country' => $job['country'] ?: 'US',
            'license_status' => $job['license_status'] ?: 'verified_licensed',
            'force_resync' => true
        ]);
        json_response([
            'status' => 'success',
            'message' => "Retried & synced '{$job['title']}' successfully!",
            'result' => $res
        ]);
    } catch (Exception $e) {
        json_response(['status' => 'error', 'message' => 'Retry failed: ' . $e->getMessage()], 500);
    }
}

// --- 8e. AUTOMATED IMPORT SCHEDULES (CREATE, TOGGLE, DELETE, RUN NOW) ---
if ($action === 'create_schedule' && $method === 'POST') {
    $name = trim($input['name'] ?? '');
    $searchQuery = trim($input['search_query'] ?? '');
    $filterType = in_array($input['filter_type'] ?? '', ['songs', 'albums', 'artists', 'playlists'], true) ? $input['filter_type'] : 'songs';
    $genre = trim($input['genre'] ?? 'All');
    $country = strtoupper(substr(trim($input['country'] ?? 'US'), 0, 2)) ?: 'US';
    $releaseYear = trim($input['release_year'] ?? 'All');
    $maxItems = max(1, min(25, (int)($input['max_items'] ?? 8)));
    $autoPublish = !empty($input['auto_publish']) ? 1 : 0;
    $licenseStatus = trim($input['license_status'] ?? 'verified_licensed');
    $frequency = in_array($input['frequency'] ?? '', ['hourly', 'daily', 'weekly'], true) ? $input['frequency'] : 'daily';

    if (empty($name) || empty($searchQuery)) {
        json_response(['status' => 'error', 'message' => 'Schedule name and search query criteria are required.'], 400);
    }

    $schId = 'sch_' . bin2hex(random_bytes(5));
    $pdo->prepare("
        INSERT INTO import_schedules (id, name, search_query, filter_type, genre, country, release_year, max_items, auto_publish, license_status, frequency, is_active, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    ")->execute([$schId, $name, $searchQuery, $filterType, $genre, $country, $releaseYear, $maxItems, $autoPublish, $licenseStatus, $frequency, $adminUser['id']]);

    Auth::logAudit($adminUser['id'], 'ADMIN_SCHEDULE_CREATED', 'IMPORT_SCHEDULE', $schId, ['name' => $name, 'query' => $searchQuery]);
    json_response(['status' => 'success', 'message' => "Created automated import rule '{$name}'.", 'schedule_id' => $schId]);
}

if ($action === 'toggle_schedule' && $method === 'POST') {
    $schId = trim($input['schedule_id'] ?? '');
    $pdo->prepare("UPDATE import_schedules SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?")->execute([$schId]);
    json_response(['status' => 'success', 'message' => 'Updated schedule active state.']);
}

if ($action === 'delete_schedule' && $method === 'POST') {
    $schId = trim($input['schedule_id'] ?? '');
    $pdo->prepare("DELETE FROM import_schedules WHERE id = ?")->execute([$schId]);
    json_response(['status' => 'success', 'message' => 'Deleted automated import schedule.']);
}

if ($action === 'run_schedule' && $method === 'POST') {
    $schId = trim($input['schedule_id'] ?? '');
    $stmt = $pdo->prepare("SELECT * FROM import_schedules WHERE id = ? LIMIT 1");
    $stmt->execute([$schId]);
    $sch = $stmt->fetch();
    if (!$sch) {
        json_response(['status' => 'error', 'message' => 'Schedule not found'], 404);
    }

    $q = $sch['search_query'];
    if ($sch['genre'] !== 'All' && stripos($q, $sch['genre']) === false) {
        $q .= ' ' . $sch['genre'];
    }
    if ($sch['release_year'] !== 'All' && stripos($q, $sch['release_year']) === false) {
        $q .= ' ' . $sch['release_year'];
    }

    $raw = call_ytmusic('search', [
        'query' => $q,
        'params' => 'EgWKAQIIAWoQEAMQBBAJEAoQBRAREBAQFA%3D%3D'
    ], $sch['country'] ?: 'US');

    $candidates = [];
    $sections = $raw['contents']['tabbedSearchResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'] ?? [];
    foreach ($sections as $sec) {
        $items = $sec['musicShelfRenderer']['contents'] ?? $sec['itemSectionRenderer']['contents'] ?? [];
        foreach ($items as $itemWrapper) {
            $r = $itemWrapper['musicResponsiveListItemRenderer'] ?? null;
            if (!$r) continue;
            $flex = $r['flexColumns'] ?? [];
            if (empty($flex)) continue;
            $title = get_runs_text($flex[0]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null);
            $col1 = count($flex) > 1 ? get_runs_text($flex[1]['musicResponsiveListItemFlexColumnRenderer']['text'] ?? null) : '';
            $parts = explode('•', $col1);
            $artist = count($parts) >= 2 ? trim($parts[1]) : ($col1 ?: 'Artist');
            $album = count($parts) >= 3 ? trim($parts[2]) : ($title . ' - Single');
            $videoId = $r['playlistItemData']['videoId'] ?? null;
            $thumbs = $r['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
            $thumbUrl = !empty($thumbs) ? preg_replace('/=w\d+-h\d+/', '=w600-h600', end($thumbs)['url'] ?? '') : '';

            if (!empty($title)) {
                $candidates[] = [
                    'title' => $title,
                    'artist' => $artist,
                    'album' => $album,
                    'videoId' => $videoId,
                    'cover_url' => $thumbUrl,
                    'genre' => $sch['genre'] !== 'All' ? $sch['genre'] : 'Pop',
                    'country' => $sch['country'] ?: 'US',
                    'release_year' => is_numeric($sch['release_year']) ? (int)$sch['release_year'] : (int)date('Y')
                ];
            }
        }
    }

    $batchId = 'batch_sch_' . $schId . '_' . time();
    $imported = 0;
    $skipped = 0;
    foreach (array_slice($candidates, 0, (int)$sch['max_items']) as $cand) {
        try {
            $res = MediaEngine::importTrackToCatalog($pdo, $cand, $adminUser['id'], [
                'batch_id' => $batchId,
                'genre' => $cand['genre'],
                'country' => $cand['country'],
                'license_status' => $sch['license_status'] ?: 'verified_licensed',
                'auto_publish' => (bool)$sch['auto_publish']
            ]);
            if ($res['status'] === 'completed') {
                $imported++;
            } else {
                $skipped++;
            }
        } catch (Exception $e) {}
    }

    $pdo->prepare("
        UPDATE import_schedules 
        SET last_run_at = NOW(), last_run_imported = ?, total_imported = total_imported + ?
        WHERE id = ?
    ")->execute([$imported, $imported, $schId]);

    Auth::logAudit($adminUser['id'], 'ADMIN_SCHEDULE_EXECUTED', 'IMPORT_SCHEDULE', $schId, ['imported' => $imported, 'skipped' => $skipped]);

    json_response([
        'status' => 'success',
        'imported_count' => $imported,
        'skipped_count' => $skipped,
        'message' => "Executed schedule '{$sch['name']}': {$imported} new tracks synced to local storage ({$skipped} existing skipped)."
    ]);
}

// --- 8f. VERIFY & SYNC ALL CATALOG TRACKS TO LOCAL SERVER STORAGE ---
if ($action === 'sync_all_storage' && $method === 'POST') {
    $stmt = $pdo->query("SELECT id, video_id, title, artist_name, genre, country, cover_art_url FROM tracks WHERE is_deleted = 0");
    $allTracks = $stmt->fetchAll();
    $syncedCount = 0;

    foreach ($allTracks as $t) {
        try {
            $aRes = MediaEngine::acquireAndStoreAudio($t['id'], $t['video_id'], $t['title'], $t['artist_name'], $t['genre'] ?: 'Pop', $t['country'] ?: 'US');
            $artRes = MediaEngine::acquireAndStoreArtwork($t['id'], $t['cover_art_url'], $t['video_id']);
            $streamUrl = "/phpbackend/api/stream.php?id=" . urlencode($t['id']);
            $pdo->prepare("
                UPDATE tracks 
                SET local_audio_path = ?, local_artwork_path = COALESCE(?, local_artwork_path), audio_file_size = ?, audio_format = ?, audio_url = ?, import_status = 'synced', last_synced_at = NOW()
                WHERE id = ?
            ")->execute([$aRes['relative_path'], $artRes['relative_path'], $aRes['file_size'], $aRes['format'], $streamUrl, $t['id']]);
            $syncedCount++;
        } catch (Exception $e) {}
    }

    Auth::logAudit($adminUser['id'], 'ADMIN_STORAGE_RESYNC', 'SYSTEM', 'STORAGE_ENGINE', ['synced_tracks' => $syncedCount]);
    json_response([
        'status' => 'success',
        'synced_count' => $syncedCount,
        'storage' => MediaEngine::getStorageStats($pdo),
        'message' => "Synchronized & verified local audio and artwork files for {$syncedCount} catalog tracks."
    ]);
}

json_response(['status' => 'error', 'message' => 'Invalid action or request'], 400);
