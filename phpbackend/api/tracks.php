<?php
/**
 * Flontmie API - Tracks Catalog, Streaming Counter, Likes, Comments & Authorized Management
 * Connects every track operation to real MySQL records with zero mock fallbacks.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../artist_enrichment.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = trim($_GET['id'] ?? '');
$pdo = Database::getConnection();

// Helper to verify if a relative storage path points to a real uploaded audio/video file on the server
function resolveUploadedFilePath(?string $rawRelPath): ?string {
    if (empty($rawRelPath)) return null;
    $rel = ltrim(trim($rawRelPath), '/');
    $relStripped = preg_replace('#^phpbackend/storage/#', '', $rel);
    $projectRoot = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
    $candidates = [
        STORAGE_ROOT . '/' . $rel,
        STORAGE_ROOT . '/' . $relStripped,
        BASE_DIR . '/' . $rel,
        $projectRoot . '/' . $rel
    ];
    foreach ($candidates as $cand) {
        if (is_file($cand) && is_readable($cand)) {
            $fsize = (int)@filesize($cand);
            $ext = strtolower(pathinfo($cand, PATHINFO_EXTENSION));
            $bname = basename($cand);
            // Exclude legacy 705644-byte synthesized WAVs and 30s iTunes preview .m4a files
            if ($ext === 'wav' && $fsize === 705644) continue;
            if ($ext === 'm4a' && strpos($bname, 'trk_yt_') === 0 && $fsize < 1500000) continue;
            if ($fsize > 4096) {
                return $cand;
            }
        }
    }
    return null;
}

// Helper to enrich track row for API output
function formatTrackForOutput(array $t, array $likedMap = []): array {
    $realPlays = (int)($t['flontmie_plays'] ?? 0);
    $realLikes = isset($t['real_likes_count']) ? (int)$t['real_likes_count'] : (int)($t['likes_count'] ?? 0);
    $realComments = isset($t['real_comments_count']) ? (int)$t['real_comments_count'] : (int)($t['comments_count'] ?? 0);

    $t['mood_tags'] = !empty($t['mood_tags_json']) ? json_decode($t['mood_tags_json'], true) : [];
    $t['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($t['cover_art_url'] ?? '', $t['video_id'] ?? $t['id']);
    $t['flontmie_plays'] = $realPlays;
    $t['stream_count'] = $realPlays;
    $t['likes_count'] = $realLikes;
    $t['comments_count'] = $realComments;
    $t['yt_plays'] = null;
    $t['is_liked'] = isset($likedMap[$t['id']]);
    unset($t['real_likes_count'], $t['real_comments_count']);

    // Never return legacy placeholder lyrics
    if (!empty($t['lyrics']) && strpos($t['lyrics'], 'Synchronized Catalog Lyrics') !== false) {
        $t['lyrics'] = null;
    }

    // Load uploaded lyrics file (.lrc, .srt, .txt) if lyrics column is empty
    if (empty($t['lyrics']) && !empty($t['local_lyrics_path'])) {
        $relLyr = ltrim($t['local_lyrics_path'], '/');
        $projectRoot = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
        foreach ([BASE_DIR . '/storage/' . $relLyr, BASE_DIR . '/' . $relLyr, $projectRoot . '/' . $relLyr] as $candLyr) {
            if (is_file($candLyr) && is_readable($candLyr)) {
                $t['lyrics'] = trim((string)@file_get_contents($candLyr));
                break;
            }
        }
    }

    $verifiedAudioFile = resolveUploadedFilePath($t['local_audio_path'] ?? null);
    $verifiedVideoFile = resolveUploadedFilePath($t['local_video_path'] ?? null);

    $audioExt = strtolower(pathinfo($verifiedAudioFile ?? '', PATHINFO_EXTENSION));
    $isAudioPathVideo = in_array($audioExt, ['mp4', 'webm', 'm4v', 'mov', 'mkv'], true);

    $hasRealAudio = ($verifiedAudioFile !== null) || ($verifiedVideoFile !== null);
    $hasRealVideo = ($verifiedVideoFile !== null) || ($verifiedAudioFile !== null && $isAudioPathVideo);

    $t['has_local_audio'] = $hasRealAudio;
    $t['has_local_video'] = $hasRealVideo;
    $t['audio_url'] = $hasRealAudio ? ('/phpbackend/api/stream.php?id=' . urlencode($t['id'])) : '';
    if ($hasRealVideo) {
        $t['video_url'] = '/phpbackend/api/stream.php?id=' . urlencode($t['id']) . '&type=video';
    } else {
        $t['video_url'] = null;
    }

    unset($t['local_audio_path'], $t['local_artwork_path'], $t['local_video_path'], $t['local_lyrics_path']);
    return $t;
}

// Helper to resolve canonical track row by id or video_id
function resolveTrackRow(PDO $pdo, string $identifier): ?array {
    if (empty($identifier)) return null;
    $stmt = $pdo->prepare("SELECT id, video_id, title, artist_id, artist_name FROM tracks WHERE (id = ? OR video_id = ?) AND is_deleted = 0 LIMIT 1");
    $stmt->execute([$identifier, $identifier]);
    $row = $stmt->fetch();
    return $row ?: null;
}

// --- 0A. AUTHORITATIVE ENGAGEMENT SYNC (POLLING & REAL-TIME RECONCILIATION) ---
if ($method === 'GET' && $action === 'engagement_sync') {
    $focusTrackId = trim($_GET['track_id'] ?? $_GET['id'] ?? '');
    $stmt = $pdo->query("
        SELECT
            t.id,
            COALESCE(t.flontmie_plays, 0) AS flontmie_plays,
            (SELECT COUNT(*) FROM user_favorites uf WHERE uf.track_id = t.id) AS likes_count,
            (SELECT COUNT(*) FROM track_comments tc WHERE tc.track_id = t.id) AS comments_count
        FROM tracks t
        WHERE t.is_deleted = 0
    ");
    $countsMap = [];
    while ($r = $stmt->fetch()) {
        $countsMap[$r['id']] = [
            'likes_count' => (int)$r['likes_count'],
            'comments_count' => (int)$r['comments_count'],
            'flontmie_plays' => (int)$r['flontmie_plays']
        ];
    }

    $user = Auth::getCurrentUser();
    $likedIds = null;
    if ($user) {
        $favStmt = $pdo->prepare("SELECT track_id FROM user_favorites WHERE user_id = ?");
        $favStmt->execute([$user['id']]);
        $likedIds = array_values(array_unique(array_column($favStmt->fetchAll(), 'track_id')));
    }

    $comments = null;
    if (!empty($focusTrackId)) {
        $resolved = resolveTrackRow($pdo, $focusTrackId);
        $canonicalId = $resolved ? $resolved['id'] : $focusTrackId;
        $cStmt = $pdo->prepare("
            SELECT
                c.id,
                c.track_id,
                c.user_id,
                COALESCE(NULLIF(u.display_name, ''), c.author_name, 'Listener') AS author_name,
                u.username AS author_username,
                COALESCE(u.role, 'listener') AS author_role,
                COALESCE(NULLIF(u.avatar_url, ''), c.author_avatar) AS author_avatar,
                COALESCE(NULLIF(c.body, ''), c.comment_text, '') AS body,
                c.created_at
            FROM track_comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.track_id = ?
            ORDER BY c.created_at DESC, c.id DESC
            LIMIT 200
        ");
        $cStmt->execute([$canonicalId]);
        $comments = $cStmt->fetchAll();
    }

    json_response([
        'status' => 'success',
        'counts' => $countsMap,
        'liked_track_ids' => $likedIds,
        'comments' => $comments,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}

// --- 0B. GET SYNCHRONIZED OR PLAIN LYRICS FOR TRACK ---
if ($method === 'GET' && $action === 'lyrics') {
    $trackId = trim($_GET['track_id'] ?? $_GET['id'] ?? '');
    if (empty($trackId)) {
        json_response(['status' => 'error', 'message' => 'track_id is required'], 400);
    }

    $stmt = $pdo->prepare("SELECT id, title, artist_name, lyrics, local_lyrics_path, lyrics_file_path FROM tracks WHERE id = ? OR video_id = ? LIMIT 1");
    $stmt->execute([$trackId, $trackId]);
    $row = $stmt->fetch();

    if (!$row) {
        json_response(['status' => 'success', 'lyrics' => '', 'source' => 'not_found']);
    }

    $lyricsText = trim((string)($row['lyrics'] ?? ''));
    if (!empty($lyricsText) && strpos($lyricsText, 'Synchronized Catalog Lyrics') !== false) {
        $lyricsText = '';
    }

    // Check uploaded .lrc/.srt/.txt file if column is empty
    if (empty($lyricsText)) {
        $relLyr = ltrim((string)($row['local_lyrics_path'] ?? $row['lyrics_file_path'] ?? ''), '/');
        if (!empty($relLyr)) {
            $projectRoot = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
            foreach ([BASE_DIR . '/storage/' . $relLyr, BASE_DIR . '/' . $relLyr, $projectRoot . '/' . $relLyr] as $candLyr) {
                if (is_file($candLyr) && is_readable($candLyr)) {
                    $lyricsText = trim((string)@file_get_contents($candLyr));
                    break;
                }
            }
        }
    }

    json_response([
        'status' => 'success',
        'track_id' => $row['id'],
        'lyrics' => $lyricsText,
        'source' => !empty($lyricsText) ? 'uploaded_catalog' : 'none'
    ]);
}

// --- 1. STREAM COUNT INCREMENT & LISTENING HISTORY ---
if ($method === 'POST' && $action === 'stream' && !empty($id)) {
    $resolved = resolveTrackRow($pdo, $id);
    $canonicalId = $resolved ? $resolved['id'] : $id;

    $stmt = $pdo->prepare("UPDATE tracks SET stream_count = stream_count + 1, flontmie_plays = COALESCE(flontmie_plays, 0) + 1 WHERE id = ?");
    $stmt->execute([$canonicalId]);

    $user = Auth::getCurrentUser();
    if ($user) {
        try {
            $hist = $pdo->prepare("INSERT INTO user_history (user_id, track_id) VALUES (?, ?)");
            $hist->execute([$user['id'], $canonicalId]);
        } catch (Exception $e) {}
    }

    json_response(['status' => 'success', 'track_id' => $canonicalId, 'message' => 'Stream registered']);
}

// --- 2. TOGGLE LIKE / FAVORITE (AUTHORITATIVE MYSQL PERSISTENCE & DEDUPLICATION) ---
if ($method === 'POST' && $action === 'like') {
    $user = Auth::requireAuth();
    $input = get_json_input();
    $targetId = !empty($id) ? $id : trim($input['track_id'] ?? $input['id'] ?? '');
    if (empty($targetId)) {
        json_response(['status' => 'error', 'message' => 'Track ID is required.'], 400);
    }

    $trackRow = resolveTrackRow($pdo, $targetId);
    if (!$trackRow) {
        json_response(['status' => 'error', 'message' => 'Track not found.'], 404);
    }

    $canonicalId = $trackRow['id'];
    $userId = $user['id'];
    $requestedMode = strtolower(trim((string)($input['mode'] ?? $_GET['mode'] ?? '')));
    if ($requestedMode === '') {
        if (!empty($input['unlike'])) {
            $requestedMode = 'unlike';
        } elseif (isset($input['like'])) {
            $requestedMode = $input['like'] ? 'like' : 'unlike';
        } else {
            $requestedMode = 'toggle';
        }
    }

    $stateChanged = false;
    try {
        $pdo->beginTransaction();

        $check = $pdo->prepare("SELECT id FROM user_favorites WHERE user_id = ? AND track_id = ? FOR UPDATE");
        $check->execute([$userId, $canonicalId]);
        $existing = $check->fetch();

        if ($requestedMode === 'unlike' || ($requestedMode === 'toggle' && $existing)) {
            if ($existing) {
                $del = $pdo->prepare("DELETE FROM user_favorites WHERE user_id = ? AND track_id = ?");
                $del->execute([$userId, $canonicalId]);
                $stateChanged = true;
            }
            $liked = false;
        } else {
            // Prevent duplicate likes from the same authenticated user on the same track
            if (!$existing) {
                $ins = $pdo->prepare("INSERT IGNORE INTO user_favorites (user_id, track_id) VALUES (?, ?)");
                $ins->execute([$userId, $canonicalId]);
                $stateChanged = true;
            }
            $liked = true;
        }

        // Compute authoritative count from database rows (never trusting client counts)
        $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM user_favorites WHERE track_id = ?");
        $cntStmt->execute([$canonicalId]);
        $likesCount = (int)$cntStmt->fetchColumn();

        $pdo->prepare("UPDATE tracks SET likes_count = ? WHERE id = ?")->execute([$likesCount, $canonicalId]);
        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        json_response(['status' => 'error', 'message' => 'Failed to update like status.'], 500);
    }

    if ($stateChanged) {
        Auth::logUserActivity(
            $user,
            $liked ? 'track_liked' : 'track_unliked',
            'track',
            $canonicalId,
            $trackRow['title'],
            [
                'artist' => $trackRow['artist_name'],
                'liked' => $liked,
                'likes_count' => $likesCount
            ]
        );
    }

    json_response([
        'status' => 'success',
        'track_id' => $canonicalId,
        'liked' => $liked,
        'likes_count' => $likesCount,
        'message' => $liked ? 'Added to favorites' : 'Removed from favorites'
    ]);
}

// --- 2B. DISLIKE TRACK ---
if ($method === 'POST' && $action === 'dislike') {
    $user = Auth::getCurrentUser();
    $input = get_json_input();
    $targetId = !empty($id) ? $id : trim($input['track_id'] ?? $input['id'] ?? '');
    $trackRow = resolveTrackRow($pdo, $targetId);
    if (!$trackRow) {
        json_response(['status' => 'error', 'message' => 'Track not found'], 404);
    }
    $canonicalId = $trackRow['id'];
    $pdo->prepare("UPDATE tracks SET dislikes_count = COALESCE(dislikes_count, 0) + 1 WHERE id = ?")->execute([$canonicalId]);
    $dStmt = $pdo->prepare("SELECT COALESCE(dislikes_count, 0) FROM tracks WHERE id = ?");
    $dStmt->execute([$canonicalId]);
    $dislikesCount = (int)$dStmt->fetchColumn();
    if ($user) {
        Auth::logUserActivity($user, 'track_disliked', 'track', $canonicalId, $trackRow['title'], ['artist' => $trackRow['artist_name']]);
    }
    json_response([
        'status' => 'success',
        'track_id' => $canonicalId,
        'dislikes_count' => $dislikesCount
    ]);
}

// --- 3. REAL TRACK COMMENTS (GET, POST & DELETE) ---
if ($method === 'GET' && $action === 'comments') {
    $targetId = !empty($id) ? $id : trim($_GET['track_id'] ?? '');
    if (empty($targetId)) {
        json_response(['status' => 'error', 'message' => 'Track ID is required'], 400);
    }
    $trackRow = resolveTrackRow($pdo, $targetId);
    $canonicalId = $trackRow ? $trackRow['id'] : $targetId;

    $stmt = $pdo->prepare("
        SELECT
            c.id,
            c.track_id,
            c.user_id,
            COALESCE(NULLIF(u.display_name, ''), c.author_name, 'Listener') AS author_name,
            u.username AS author_username,
            COALESCE(u.role, 'listener') AS author_role,
            COALESCE(NULLIF(u.avatar_url, ''), c.author_avatar) AS author_avatar,
            COALESCE(NULLIF(c.body, ''), c.comment_text, '') AS body,
            COALESCE(NULLIF(c.comment_text, ''), c.body, '') AS comment_text,
            c.created_at
        FROM track_comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.track_id = ?
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT 200
    ");
    $stmt->execute([$canonicalId]);
    $comments = $stmt->fetchAll();

    $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM track_comments WHERE track_id = ?");
    $cntStmt->execute([$canonicalId]);
    $commentsCount = (int)$cntStmt->fetchColumn();

    $likeStmt = $pdo->prepare("SELECT COUNT(*) FROM user_favorites WHERE track_id = ?");
    $likeStmt->execute([$canonicalId]);
    $likesCount = (int)$likeStmt->fetchColumn();

    json_response([
        'status' => 'success',
        'track_id' => $canonicalId,
        'comments_count' => $commentsCount,
        'likes_count' => $likesCount,
        'comments' => $comments
    ]);
}

if ($method === 'POST' && ($action === 'comment' || $action === 'add_comment')) {
    $user = Auth::requireAuth();
    $input = get_json_input();
    $targetId = !empty($id) ? $id : trim($input['track_id'] ?? $input['id'] ?? '');
    if (empty($targetId)) {
        json_response(['status' => 'error', 'message' => 'Track ID is required.'], 400);
    }

    $trackRow = resolveTrackRow($pdo, $targetId);
    if (!$trackRow) {
        json_response(['status' => 'error', 'message' => 'Track not found.'], 404);
    }
    $canonicalId = $trackRow['id'];

    $rawBody = trim((string)($input['body'] ?? $input['comment_text'] ?? $input['text'] ?? ''));
    if (empty($rawBody)) {
        json_response(['status' => 'error', 'message' => 'Comment text cannot be empty.'], 400);
    }
    $cleanBody = substr($rawBody, 0, 1000);
    $commentId = 'cmt_' . bin2hex(random_bytes(6));
    $createdAt = date('Y-m-d H:i:s');

    try {
        $pdo->beginTransaction();

        $pdo->prepare("
            INSERT INTO track_comments (id, track_id, user_id, author_name, author_avatar, body, comment_text, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            $commentId,
            $canonicalId,
            $user['id'],
            $user['display_name'],
            $user['avatar_url'] ?? null,
            $cleanBody,
            $cleanBody,
            $createdAt
        ]);

        $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM track_comments WHERE track_id = ?");
        $cntStmt->execute([$canonicalId]);
        $commentsCount = (int)$cntStmt->fetchColumn();

        $pdo->prepare("UPDATE tracks SET comments_count = ? WHERE id = ?")->execute([$commentsCount, $canonicalId]);
        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        json_response(['status' => 'error', 'message' => 'Failed to save comment.'], 500);
    }

    Auth::logUserActivity(
        $user,
        'track_commented',
        'track',
        $canonicalId,
        $trackRow['title'],
        [
            'comment_id' => $commentId,
            'artist' => $trackRow['artist_name'],
            'excerpt' => substr($cleanBody, 0, 120),
            'comments_count' => $commentsCount
        ]
    );

    json_response([
        'status' => 'success',
        'track_id' => $canonicalId,
        'comments_count' => $commentsCount,
        'comment' => [
            'id' => $commentId,
            'track_id' => $canonicalId,
            'user_id' => $user['id'],
            'author_name' => $user['display_name'],
            'author_username' => $user['username'] ?? null,
            'author_role' => $user['role'] ?? 'listener',
            'author_avatar' => $user['avatar_url'] ?? null,
            'body' => $cleanBody,
            'comment_text' => $cleanBody,
            'created_at' => $createdAt
        ]
    ], 201);
}

if (($method === 'POST' || $method === 'DELETE') && $action === 'delete_comment') {
    $user = Auth::requireAuth();
    $input = get_json_input();
    $commentId = trim($_GET['comment_id'] ?? $input['comment_id'] ?? $id ?? '');
    if (empty($commentId)) {
        json_response(['status' => 'error', 'message' => 'comment_id is required'], 400);
    }

    $cStmt = $pdo->prepare("SELECT * FROM track_comments WHERE id = ? LIMIT 1");
    $cStmt->execute([$commentId]);
    $commentRow = $cStmt->fetch();
    if (!$commentRow) {
        json_response(['status' => 'error', 'message' => 'Comment not found'], 404);
    }

    if ($user['role'] !== 'admin' && $commentRow['user_id'] !== $user['id']) {
        json_response(['status' => 'error', 'message' => 'Forbidden: You can only delete your own comments.'], 403);
    }

    $canonicalId = $commentRow['track_id'];
    $pdo->prepare("DELETE FROM track_comments WHERE id = ?")->execute([$commentId]);

    $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM track_comments WHERE track_id = ?");
    $cntStmt->execute([$canonicalId]);
    $commentsCount = (int)$cntStmt->fetchColumn();
    $pdo->prepare("UPDATE tracks SET comments_count = ? WHERE id = ?")->execute([$commentsCount, $canonicalId]);

    Auth::logUserActivity($user, 'comment_deleted', 'comment', $commentId, $canonicalId, ['track_id' => $canonicalId]);

    json_response([
        'status' => 'success',
        'track_id' => $canonicalId,
        'comment_id' => $commentId,
        'comments_count' => $commentsCount,
        'message' => 'Comment deleted.'
    ]);
}

// --- 4. GET LIKED TRACKS ---
if ($method === 'GET' && $action === 'liked') {
    $user = Auth::requireAuth();
    $stmt = $pdo->prepare("
        SELECT
            t.*,
            (SELECT COUNT(*) FROM user_favorites uf WHERE uf.track_id = t.id) AS real_likes_count,
            (SELECT COUNT(*) FROM track_comments tc WHERE tc.track_id = t.id) AS real_comments_count
        FROM tracks t 
        JOIN user_favorites f ON t.id = f.track_id 
        WHERE f.user_id = ? AND t.is_deleted = 0 
        ORDER BY f.created_at DESC
    ");
    $stmt->execute([$user['id']]);
    $tracks = $stmt->fetchAll();

    $likedMap = [];
    foreach ($tracks as $t) {
        $likedMap[$t['id']] = true;
    }
    foreach ($tracks as &$t) {
        $t = formatTrackForOutput($t, $likedMap);
    }
    json_response(['status' => 'success', 'tracks' => $tracks]);
}

// --- 5. GET LISTENING HISTORY ---
if ($method === 'GET' && $action === 'history') {
    $user = Auth::requireAuth();
    $stmt = $pdo->prepare("
        SELECT
            t.*,
            MAX(h.played_at) AS last_played_at,
            (SELECT COUNT(*) FROM user_favorites uf WHERE uf.track_id = t.id) AS real_likes_count,
            (SELECT COUNT(*) FROM track_comments tc WHERE tc.track_id = t.id) AS real_comments_count
        FROM user_history h
        JOIN tracks t ON t.id = h.track_id
        WHERE h.user_id = ? AND t.is_deleted = 0
        GROUP BY t.id
        ORDER BY last_played_at DESC
        LIMIT 50
    ");
    $stmt->execute([$user['id']]);
    $tracks = $stmt->fetchAll();
    foreach ($tracks as &$t) {
        $t = formatTrackForOutput($t);
    }
    json_response(['status' => 'success', 'tracks' => $tracks]);
}

// --- 6. GET SINGLE TRACK ---
if ($method === 'GET' && !empty($id)) {
    $stmt = $pdo->prepare("
        SELECT
            t.*,
            (SELECT COUNT(*) FROM user_favorites uf WHERE uf.track_id = t.id) AS real_likes_count,
            (SELECT COUNT(*) FROM track_comments tc WHERE tc.track_id = t.id) AS real_comments_count
        FROM tracks t
        WHERE (t.id = ? OR t.video_id = ?) AND t.is_deleted = 0
        LIMIT 1
    ");
    $stmt->execute([$id, $id]);
    $track = $stmt->fetch();

    if (!$track) {
        json_response(['status' => 'error', 'message' => 'Track not found'], 404);
    }

    $user = Auth::getCurrentUser();
    $likedMap = [];
    if ($user) {
        $chk = $pdo->prepare("SELECT id FROM user_favorites WHERE user_id = ? AND track_id = ?");
        $chk->execute([$user['id'], $track['id']]);
        if ($chk->fetch()) {
            $likedMap[$track['id']] = true;
        }
    }

    $track = formatTrackForOutput($track, $likedMap);
    json_response(['status' => 'success', 'track' => $track]);
}

// --- 7. GET TRACKS CATALOG ---
if ($method === 'GET') {
    $genre = trim($_GET['genre'] ?? '');
    $artistId = trim($_GET['artist_id'] ?? '');
    $albumId = trim($_GET['album_id'] ?? '');
    $distributorId = trim($_GET['distributor_id'] ?? '');
    $labelId = trim($_GET['label_id'] ?? '');
    $country = trim($_GET['country'] ?? '');
    $year = trim($_GET['year'] ?? '');
    $search = trim($_GET['q'] ?? '');
    $limit = min(200, max(1, (int)($_GET['limit'] ?? 60)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    $sql = "
        SELECT
            t.*,
            (SELECT COUNT(*) FROM user_favorites uf WHERE uf.track_id = t.id) AS real_likes_count,
            (SELECT COUNT(*) FROM track_comments tc WHERE tc.track_id = t.id) AS real_comments_count
        FROM tracks t
        WHERE t.is_deleted = 0 AND (t.status IS NULL OR t.status = 'published' OR t.status = 'active') AND t.audio_url NOT LIKE '%soundhelix%'
    ";
    $params = [];

    if (!empty($genre) && strtolower($genre) !== 'all') {
        $sql .= " AND (t.genre = ? OR t.mood_tags_json LIKE ?)";
        $params[] = $genre;
        $params[] = '%' . $genre . '%';
    }

    if (!empty($artistId)) {
        $sql .= " AND t.artist_id = ?";
        $params[] = $artistId;
    }

    if (!empty($albumId)) {
        $sql .= " AND t.album_id = ?";
        $params[] = $albumId;
    }

    if (!empty($distributorId)) {
        $sql .= " AND t.distributor_id = ?";
        $params[] = $distributorId;
    }

    if (!empty($labelId)) {
        $sql .= " AND t.label_id = ?";
        $params[] = $labelId;
    }

    if (!empty($country) && strtolower($country) !== 'all') {
        $sql .= " AND t.country = ?";
        $params[] = strtoupper($country);
    }

    if (!empty($year) && strtolower($year) !== 'all' && is_numeric($year)) {
        $sql .= " AND t.release_year = ?";
        $params[] = (int)$year;
    }

    if (!empty($search)) {
        $sql .= " AND (t.title LIKE ? OR t.artist_name LIKE ? OR t.album_name LIKE ? OR t.genre LIKE ?)";
        $searchTerm = '%' . $search . '%';
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }

    $sql .= " ORDER BY t.featured_on_home DESC, t.editorial_boost DESC, t.flontmie_plays DESC, t.stream_count DESC, t.created_at DESC LIMIT {$limit} OFFSET {$offset}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $tracks = $stmt->fetchAll();

    if (!empty($search)) {
        try {
            $authUser = Auth::getCurrentUser();
            $stmtLog = $pdo->prepare("INSERT INTO search_logs (user_id, query, results_count, ip_address) VALUES (?, ?, ?, ?)");
            $stmtLog->execute([
                $authUser['id'] ?? null,
                substr($search, 0, 255),
                count($tracks),
                $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
            ]);
        } catch (Exception $e) {}
    }

    $user = Auth::getCurrentUser();
    $likedMap = [];
    if ($user) {
        $favs = $pdo->prepare("SELECT track_id FROM user_favorites WHERE user_id = ?");
        $favs->execute([$user['id']]);
        while ($row = $favs->fetch()) {
            $likedMap[$row['track_id']] = true;
        }
    }

    $verifiedTracks = [];
    foreach ($tracks as $t) {
        $formatted = formatTrackForOutput($t, $likedMap);
        if (!empty($formatted['has_local_audio']) || !empty($formatted['has_local_video'])) {
            $verifiedTracks[] = $formatted;
        }
    }

    json_response([
        'status' => 'success',
        'count' => count($verifiedTracks),
        'liked_track_ids' => $user ? array_keys($likedMap) : null,
        'tracks' => $verifiedTracks
    ]);
}

// --- 8. CREATE TRACK METADATA RECORD (POST) ---
if ($method === 'POST') {
    $user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);
    $input = get_json_input();

    $title = trim($input['title'] ?? '');
    $artistName = trim($input['artist_name'] ?? $user['display_name']);
    $artistId = trim($input['artist_id'] ?? ($user['artist_id'] ?? 'art_' . substr(md5(strtolower($artistName)), 0, 12)));
    $audioUrl = trim($input['audio_url'] ?? '');

    if (empty($title)) {
        json_response(['status' => 'error', 'message' => 'Track title is required.'], 400);
    }

    // Verify ownership for distributors
    if ($user['role'] === 'distributor' && !empty($input['artist_id'])) {
        $aChk = $pdo->prepare("SELECT distributor_id, created_by_user_id FROM artists WHERE id = ? LIMIT 1");
        $aChk->execute([$artistId]);
        $aRow = $aChk->fetch();
        if ($aRow && $aRow['distributor_id'] !== $user['distributor_id'] && $aRow['created_by_user_id'] !== $user['id']) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You can only create tracks for artists managed by your distributor account.'], 403);
        }
    }

    $trackId = 'trk_' . bin2hex(random_bytes(6));
    if (empty($audioUrl)) {
        $audioUrl = '/phpbackend/api/stream.php?id=' . urlencode($trackId);
    }

    $albumId = !empty($input['album_id']) ? trim($input['album_id']) : null;
    $albumName = trim($input['album_name'] ?? ($title . ' - Single'));
    $genre = trim($input['genre'] ?? 'Afrobeats');
    $cover = trim($input['cover_art_url'] ?? '');
    $videoUrl = !empty($input['video_url']) ? trim($input['video_url']) : null;
    $duration = (int)($input['duration'] ?? 180);
    $lyrics = trim($input['lyrics'] ?? '');
    $isrc = !empty($input['isrc']) ? trim($input['isrc']) : null;
    $explicit = !empty($input['explicit']) ? 1 : 0;
    $scale = !empty($input['scale']) ? trim($input['scale']) : null;
    $bpm = !empty($input['bpm']) ? (int)$input['bpm'] : null;
    $moodTags = is_array($input['mood_tags'] ?? null) ? $input['mood_tags'] : [$genre];
    $featured = !empty($input['featured_artists']) ? trim($input['featured_artists']) : null;
    $producer = !empty($input['producer']) ? trim($input['producer']) : null;
    $composer = !empty($input['composer']) ? trim($input['composer']) : null;
    $distributorId = $user['distributor_id'] ?? ($input['distributor_id'] ?? null);
    $labelId = $user['label_id'] ?? ($input['label_id'] ?? null);

    $stmt = $pdo->prepare("
        INSERT INTO tracks (
            id, title, artist_id, artist_name, album_id, album_name, duration, genre,
            cover_art_url, audio_url, video_url, lyrics, isrc, explicit, scale, bpm,
            mood_tags_json, featured_artists, producer, composer,
            distributor_id, label_id, uploaded_by_user_id, created_by_user_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
    ");
    $stmt->execute([
        $trackId, $title, $artistId, $artistName, $albumId, $albumName, $duration, $genre,
        $cover, $audioUrl, $videoUrl, $lyrics, $isrc, $explicit, $scale, $bpm,
        json_encode($moodTags), $featured, $producer, $composer,
        $distributorId, $labelId, $user['id'], $user['id']
    ]);

    Auth::logUserActivity($user, 'track_uploaded', 'track', $trackId, $title, ['artist' => $artistName, 'album' => $albumName, 'genre' => $genre]);
    json_response([
        'status' => 'success',
        'message' => 'Track saved to database.',
        'track_id' => $trackId
    ], 201);
}

// --- 9. UPDATE TRACK (PUT) ---
if ($method === 'PUT' && !empty($id)) {
    $user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);
    $input = get_json_input();

    $chk = $pdo->prepare("SELECT * FROM tracks WHERE id = ? AND is_deleted = 0 LIMIT 1");
    $chk->execute([$id]);
    $existing = $chk->fetch();
    if (!$existing) {
        json_response(['status' => 'error', 'message' => 'Track not found'], 404);
    }

    if ($user['role'] !== 'admin') {
        $ownsTrack = ($existing['uploaded_by_user_id'] === $user['id'])
            || ($user['role'] === 'distributor' && !empty($user['distributor_id']) && $existing['distributor_id'] === $user['distributor_id'])
            || ($user['role'] === 'label' && !empty($user['label_id']) && $existing['label_id'] === $user['label_id'])
            || ($user['role'] === 'artist' && !empty($user['artist_id']) && $existing['artist_id'] === $user['artist_id']);
        if (!$ownsTrack) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You do not have permission to edit this track.'], 403);
        }
    }

    $stmt = $pdo->prepare("
        UPDATE tracks 
        SET title = COALESCE(NULLIF(?, ''), title),
            genre = COALESCE(NULLIF(?, ''), genre),
            cover_art_url = COALESCE(NULLIF(?, ''), cover_art_url),
            audio_url = COALESCE(NULLIF(?, ''), audio_url),
            video_url = COALESCE(NULLIF(?, ''), video_url),
            lyrics = COALESCE(?, lyrics),
            isrc = COALESCE(NULLIF(?, ''), isrc),
            scale = COALESCE(NULLIF(?, ''), scale),
            bpm = COALESCE(?, bpm),
            explicit = COALESCE(?, explicit)
        WHERE id = ?
    ");
    $stmt->execute([
        $input['title'] ?? null,
        $input['genre'] ?? null,
        $input['cover_art_url'] ?? null,
        $input['audio_url'] ?? null,
        $input['video_url'] ?? null,
        $input['lyrics'] ?? null,
        $input['isrc'] ?? null,
        $input['scale'] ?? null,
        $input['bpm'] ?? null,
        isset($input['explicit']) ? (!empty($input['explicit']) ? 1 : 0) : null,
        $id
    ]);

    Auth::logUserActivity($user, 'track_updated', 'track', $id, $input['title'] ?? $existing['title'], ['artist' => $existing['artist_name']]);
    json_response(['status' => 'success', 'message' => 'Track updated successfully']);
}

// --- 10. DELETE TRACK (DELETE) ---
if ($method === 'DELETE' && !empty($id)) {
    $user = Auth::requireRole(['artist', 'distributor', 'label', 'admin']);

    $chk = $pdo->prepare("SELECT * FROM tracks WHERE id = ? LIMIT 1");
    $chk->execute([$id]);
    $existing = $chk->fetch();
    if (!$existing) {
        json_response(['status' => 'error', 'message' => 'Track not found'], 404);
    }

    if ($user['role'] !== 'admin') {
        $ownsTrack = ($existing['uploaded_by_user_id'] === $user['id'])
            || ($user['role'] === 'distributor' && !empty($user['distributor_id']) && $existing['distributor_id'] === $user['distributor_id'])
            || ($user['role'] === 'label' && !empty($user['label_id']) && $existing['label_id'] === $user['label_id'])
            || ($user['role'] === 'artist' && !empty($user['artist_id']) && $existing['artist_id'] === $user['artist_id']);
        if (!$ownsTrack) {
            json_response(['status' => 'error', 'message' => 'Forbidden: You do not have permission to delete this track.'], 403);
        }
    }

    $stmt = $pdo->prepare("UPDATE tracks SET is_deleted = 1, status = 'removed' WHERE id = ?");
    $stmt->execute([$id]);

    Auth::logUserActivity($user, 'track_deleted', 'track', $id, $existing['title'], ['soft_delete' => true]);
    json_response(['status' => 'success', 'message' => 'Track deleted.']);
}

json_response(['status' => 'error', 'message' => 'Method not allowed'], 405);

