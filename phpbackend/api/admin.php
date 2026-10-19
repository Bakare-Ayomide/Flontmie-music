<?php
/**
 * Flontmie API - Dedicated Protected Administrator Governance & Control Backend
 * Strictly enforced server-side: only authenticated users with role === 'admin' can access.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../media_engine.php';

// Strict Server-Side RBAC Enforcement
$user = Auth::requireRole(['admin']);
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'dashboard';
$input = get_json_input();
$pdo = Database::getConnection();

if ($method === 'POST') {
    Auth::verifyCsrf($user, $input);
}

// Helper for fetching overview metrics
function getOverviewData(PDO $pdo): array {
    $totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $activeUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status = 'active'")->fetchColumn();
    $suspendedUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status IN ('suspended', 'banned')")->fetchColumn();
    $totalArtists = (int)$pdo->query("SELECT COUNT(*) FROM artists")->fetchColumn();
    $totalDistributors = (int)$pdo->query("SELECT COUNT(*) FROM distributors")->fetchColumn();
    $totalLabels = (int)$pdo->query("SELECT COUNT(*) FROM labels")->fetchColumn();
    $totalTracks = (int)$pdo->query("SELECT COUNT(*) FROM tracks WHERE is_deleted = 0")->fetchColumn();
    $totalAlbums = (int)$pdo->query("SELECT COUNT(*) FROM albums")->fetchColumn();
    $totalPlaylists = (int)$pdo->query("SELECT COUNT(*) FROM playlists")->fetchColumn();
    $totalStreams = (int)$pdo->query("SELECT COALESCE(SUM(stream_count), 0) FROM tracks WHERE is_deleted = 0")->fetchColumn();
    $pendingClaims = (int)$pdo->query("SELECT COUNT(*) FROM artist_claims WHERE status IN ('pending', 'escalated', 'disputed')")->fetchColumn();
    $openReports = (int)$pdo->query("SELECT COUNT(*) FROM moderation_reports WHERE status IN ('open', 'investigating', 'appealed')")->fetchColumn();
    $activeSessions = (int)$pdo->query("SELECT COUNT(*) FROM user_sessions WHERE is_revoked = 0 AND expires_at > NOW()")->fetchColumn();

    $recentActivity = $pdo->query("
        SELECT l.*, u.email AS user_email, u.display_name AS user_name, u.role AS user_role
        FROM audit_logs l
        LEFT JOIN users u ON l.user_id = u.id
        ORDER BY l.created_at DESC
        LIMIT 15
    ")->fetchAll();

    return [
        'total_users' => $totalUsers,
        'active_users' => $activeUsers,
        'suspended_users' => $suspendedUsers,
        'total_artists' => $totalArtists,
        'total_distributors' => $totalDistributors,
        'total_labels' => $totalLabels,
        'total_tracks' => $totalTracks,
        'total_albums' => $totalAlbums,
        'total_playlists' => $totalPlaylists,
        'total_streams' => $totalStreams,
        'pending_claims' => $pendingClaims,
        'open_reports' => $openReports,
        'active_sessions' => $activeSessions,
        'recent_activity' => $recentActivity
    ];
}

// --- 1. OVERVIEW / FULL DASHBOARD SNAPSHOT ---
if ($method === 'GET' && ($action === 'stats' || $action === 'overview' || $action === 'dashboard')) {
    $overview = getOverviewData($pdo);

    $users = $pdo->query("
        SELECT id, username, email, role, status, display_name, avatar_url, country, distributor_id, label_id, email_verified, must_change_password, last_login_at, last_login_ip, failed_login_attempts, locked_until, created_at 
        FROM users 
        ORDER BY created_at DESC
    ")->fetchAll();

    $artists = $pdo->query("SELECT * FROM artists ORDER BY total_streams DESC")->fetchAll();
    $claims = $pdo->query("
        SELECT c.*, a.name AS artist_name, a.avatar_url AS artist_avatar, a.verified AS artist_verified
        FROM artist_claims c
        LEFT JOIN artists a ON c.artist_id = a.id
        ORDER BY c.created_at DESC
    ")->fetchAll();

    $tracks = $pdo->query("SELECT * FROM tracks WHERE is_deleted = 0 ORDER BY stream_count DESC")->fetchAll();
    foreach ($tracks as &$t) {
        $t['has_local_audio'] = !empty($t['local_audio_path']);
        $t['has_local_artwork'] = !empty($t['local_artwork_path']);
        $t['audio_url'] = '/phpbackend/api/stream.php?id=' . urlencode($t['id']);
        unset($t['local_audio_path'], $t['local_artwork_path']);
    }

    $albums = $pdo->query("SELECT * FROM albums ORDER BY created_at DESC")->fetchAll();
    $playlists = $pdo->query("SELECT * FROM playlists ORDER BY created_at DESC")->fetchAll();
    foreach ($playlists as &$pl) {
        $pl['track_ids'] = !empty($pl['track_ids_json']) ? json_decode($pl['track_ids_json'], true) : [];
    }

    $distributors = $pdo->query("SELECT * FROM distributors ORDER BY created_at DESC")->fetchAll();
    $labels = $pdo->query("SELECT * FROM labels ORDER BY created_at DESC")->fetchAll();
    $rolePermissions = $pdo->query("SELECT * FROM role_permissions ORDER BY max_upload_per_month DESC")->fetchAll();

    $reports = $pdo->query("SELECT * FROM moderation_reports ORDER BY created_at DESC")->fetchAll();
    $genres = $pdo->query("SELECT * FROM platform_genres ORDER BY display_order ASC")->fetchAll();
    $settingsRows = $pdo->query("SELECT * FROM system_settings ORDER BY category ASC, setting_key ASC")->fetchAll();

    $importJobs = [];
    try {
        $importJobs = $pdo->query("SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 80")->fetchAll();
        foreach ($importJobs as &$jb) {
            $jb['has_local_audio'] = !empty($jb['local_audio_path']);
            unset($jb['local_audio_path'], $jb['local_artwork_path'], $jb['raw_payload_json']);
        }
    } catch (Exception $e) {}

    $importSchedules = [];
    try {
        $importSchedules = $pdo->query("SELECT * FROM import_schedules ORDER BY created_at DESC")->fetchAll();
    } catch (Exception $e) {}

    $storageStats = MediaEngine::getStorageStats($pdo);

    $auditLogs = $pdo->query("
        SELECT l.*, u.email AS user_email, u.display_name AS user_name
        FROM audit_logs l
        LEFT JOIN users u ON l.user_id = u.id
        ORDER BY l.created_at DESC
        LIMIT 100
    ")->fetchAll();

    $sessions = $pdo->query("
        SELECT s.id, s.user_id, s.ip_address, s.user_agent, s.is_revoked, s.created_at, s.last_active_at, s.expires_at,
               u.email, u.display_name, u.role
        FROM user_sessions s
        LEFT JOIN users u ON s.user_id = u.id
        ORDER BY s.last_active_at DESC
        LIMIT 50
    ")->fetchAll();

    $securityEvents = $pdo->query("
        SELECT * FROM security_events ORDER BY created_at DESC LIMIT 80
    ")->fetchAll();

    // Analytics aggregations
    $genreStats = $pdo->query("
        SELECT genre, COUNT(*) AS track_count, COALESCE(SUM(stream_count), 0) AS total_streams, COALESCE(SUM(likes_count), 0) AS total_likes
        FROM tracks
        WHERE is_deleted = 0
        GROUP BY genre
        ORDER BY total_streams DESC
    ")->fetchAll();

    $roleBreakdown = $pdo->query("
        SELECT role, COUNT(*) AS count
        FROM users
        GROUP BY role
    ")->fetchAll();

    $recentSearches = $pdo->query("
        SELECT query, COUNT(*) AS searches, MAX(created_at) AS last_searched
        FROM search_logs
        GROUP BY query
        ORDER BY searches DESC, last_searched DESC
        LIMIT 15
    ")->fetchAll();

    json_response([
        'status' => 'success',
        'stats' => $overview,
        'users' => $users,
        'artists' => $artists,
        'claims' => $claims,
        'tracks' => $tracks,
        'albums' => $albums,
        'playlists' => $playlists,
        'distributors' => $distributors,
        'labels' => $labels,
        'role_permissions' => $rolePermissions,
        'reports' => $reports,
        'genres' => $genres,
        'settings' => $settingsRows,
        'import_jobs' => $importJobs,
        'import_schedules' => $importSchedules,
        'storage' => $storageStats,
        'audit_logs' => $auditLogs,
        'sessions' => $sessions,
        'security_events' => $securityEvents,
        'analytics' => [
            'genre_stats' => $genreStats,
            'role_breakdown' => $roleBreakdown,
            'top_tracks' => array_slice($tracks, 0, 10),
            'top_artists' => array_slice($artists, 0, 10),
            'recent_searches' => $recentSearches
        ]
    ]);
}

// --- 2. USERS MANAGEMENT ---
if ($method === 'GET' && $action === 'users') {
    $q = trim($_GET['q'] ?? '');
    $role = trim($_GET['role'] ?? '');
    $status = trim($_GET['status'] ?? '');

    $sql = "SELECT id, username, email, role, status, display_name, avatar_url, country, distributor_id, label_id, email_verified, must_change_password, last_login_at, last_login_ip, failed_login_attempts, locked_until, created_at FROM users WHERE 1=1";
    $params = [];

    if ($q !== '') {
        $sql .= " AND (email LIKE ? OR username LIKE ? OR display_name LIKE ?)";
        $params[] = "%$q%";
        $params[] = "%$q%";
        $params[] = "%$q%";
    }
    if ($role !== '') {
        $sql .= " AND role = ?";
        $params[] = $role;
    }
    if ($status !== '') {
        $sql .= " AND status = ?";
        $params[] = $status;
    }
    $sql .= " ORDER BY created_at DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    json_response(['status' => 'success', 'users' => $stmt->fetchAll()]);
}

if ($method === 'POST' && ($action === 'update_user' || $action === 'update_role')) {
    $targetUserId = trim($input['user_id'] ?? '');
    if (empty($targetUserId)) {
        json_response(['status' => 'error', 'message' => 'Missing user_id'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$targetUserId]);
    $target = $stmt->fetch();
    if (!$target) {
        json_response(['status' => 'error', 'message' => 'User not found'], 404);
    }

    $newRole = $input['role'] ?? $target['role'];
    $newStatus = $input['status'] ?? $target['status'];
    $newName = trim($input['display_name'] ?? $target['display_name']);
    $emailVerified = isset($input['email_verified']) ? (int)((bool)$input['email_verified']) : (int)$target['email_verified'];

    if (!in_array($newRole, ['listener', 'artist', 'distributor', 'label', 'admin'], true)) {
        json_response(['status' => 'error', 'message' => 'Invalid role specified.'], 400);
    }
    if (!in_array($newStatus, ['active', 'suspended', 'banned'], true)) {
        json_response(['status' => 'error', 'message' => 'Invalid status specified.'], 400);
    }

    // Prevent locking out the last active admin
    if ($target['id'] === $user['id'] && ($newRole !== 'admin' || $newStatus !== 'active')) {
        json_response(['status' => 'error', 'message' => 'You cannot demote or suspend your own active administrator account.'], 400);
    }

    $upd = $pdo->prepare("UPDATE users SET role = ?, status = ?, display_name = ?, email_verified = ? WHERE id = ?");
    $upd->execute([$newRole, $newStatus, $newName, $emailVerified, $targetUserId]);

    if (in_array($newStatus, ['suspended', 'banned'], true)) {
        $pdo->prepare("UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?")->execute([$targetUserId]);
    }

    Auth::logAudit($user['id'], 'ADMIN_USER_UPDATED', 'USER', $targetUserId, [
        'email' => $target['email'],
        'old_role' => $target['role'],
        'new_role' => $newRole,
        'old_status' => $target['status'],
        'new_status' => $newStatus
    ]);

    json_response([
        'status' => 'success',
        'message' => "Account {$target['email']} updated (Role: {$newRole}, Status: {$newStatus})."
    ]);
}

if ($method === 'POST' && $action === 'create_user') {
    $email = strtolower(trim(filter_var($input['email'] ?? '', FILTER_VALIDATE_EMAIL) ?: ''));
    $displayName = trim($input['display_name'] ?? '');
    $username = preg_replace('/[^a-z0-9_]/', '', strtolower(trim($input['username'] ?? explode('@', $email)[0] ?? '')));
    $password = $input['password'] ?? '';
    $role = in_array($input['role'] ?? '', ['listener', 'artist', 'distributor', 'label', 'admin'], true) ? $input['role'] : 'listener';
    $country = strtoupper(substr(trim($input['country'] ?? 'US'), 0, 2));
    $mustChange = !empty($input['must_change_password']) ? 1 : 0;

    if (empty($email) || strlen($password) < 6) {
        json_response(['status' => 'error', 'message' => 'Valid email and password (min 6 chars) are required.'], 400);
    }

    $check = $pdo->prepare("SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1");
    $check->execute([$email, $username]);
    if ($check->fetch()) {
        json_response(['status' => 'error', 'message' => 'Email or username already exists.'], 409);
    }

    $newId = 'usr_' . bin2hex(random_bytes(8));
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $pdo->prepare("
        INSERT INTO users (id, username, email, password_hash, role, status, display_name, avatar_url, country, email_verified, must_change_password)
        VALUES (?, ?, ?, ?, ?, 'active', ?, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', ?, 1, ?)
    ")->execute([$newId, $username, $email, $hash, $role, $displayName ?: $username, $country, $mustChange]);

    Auth::logAudit($user['id'], 'ADMIN_USER_CREATED', 'USER', $newId, ['email' => $email, 'role' => $role]);

    json_response(['status' => 'success', 'message' => "Created {$role} account for {$email}."]);
}

if ($method === 'POST' && $action === 'delete_user') {
    $targetUserId = trim($input['user_id'] ?? '');
    if (empty($targetUserId)) {
        json_response(['status' => 'error', 'message' => 'Missing user_id'], 400);
    }
    if ($targetUserId === $user['id']) {
        json_response(['status' => 'error', 'message' => 'You cannot delete your own active administrator account.'], 400);
    }
    $stmt = $pdo->prepare("SELECT id, email, role FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$targetUserId]);
    $target = $stmt->fetch();
    if (!$target) {
        json_response(['status' => 'error', 'message' => 'User not found'], 404);
    }
    $pdo->prepare("DELETE FROM user_sessions WHERE user_id = ?")->execute([$targetUserId]);
    $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$targetUserId]);
    Auth::logAudit($user['id'], 'ADMIN_USER_DELETED', 'USER', $targetUserId, ['email' => $target['email'], 'role' => $target['role']]);
    json_response(['status' => 'success', 'message' => "Deleted user account {$target['email']}."]);
}

// --- 3. ARTISTS & CLAIMS ---
if ($method === 'POST' && $action === 'review_claim') {
    $claimId = trim($input['claim_id'] ?? '');
    $decision = trim($input['decision'] ?? ''); // approved, rejected, escalated, disputed
    $notes = trim($input['notes'] ?? '');

    if (empty($claimId) || !in_array($decision, ['approved', 'rejected', 'escalated', 'disputed'], true)) {
        json_response(['status' => 'error', 'message' => 'Valid claim_id and decision are required.'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM artist_claims WHERE id = ? LIMIT 1");
    $stmt->execute([$claimId]);
    $claim = $stmt->fetch();
    if (!$claim) {
        json_response(['status' => 'error', 'message' => 'Claim not found.'], 404);
    }

    $pdo->prepare("UPDATE artist_claims SET status = ?, review_notes = ?, reviewed_by = ? WHERE id = ?")
        ->execute([$decision, $notes, $user['id'], $claimId]);

    if ($decision === 'approved') {
        $pdo->prepare("UPDATE artists SET claimed_status = 'claimed', verified = 1, claimed_user_id = ? WHERE id = ?")
            ->execute([$claim['user_id'], $claim['artist_id']]);
        $pdo->prepare("UPDATE users SET role = 'artist' WHERE id = ? AND role = 'listener'")
            ->execute([$claim['user_id']]);
    } elseif ($decision === 'rejected') {
        $pdo->prepare("UPDATE artists SET claimed_status = 'unclaimed' WHERE id = ?")
            ->execute([$claim['artist_id']]);
    } elseif ($decision === 'disputed') {
        $pdo->prepare("UPDATE artists SET claimed_status = 'disputed' WHERE id = ?")
            ->execute([$claim['artist_id']]);
    }

    Auth::logAudit($user['id'], 'ADMIN_CLAIM_' . strtoupper($decision), 'CLAIM', $claimId, [
        'artist_id' => $claim['artist_id'],
        'decision' => $decision,
        'notes' => $notes
    ]);

    json_response(['status' => 'success', 'message' => "Artist claim {$claimId} marked as {$decision}."]);
}

if ($method === 'POST' && $action === 'update_artist') {
    $artistId = trim($input['artist_id'] ?? '');
    if (empty($artistId)) {
        json_response(['status' => 'error', 'message' => 'Missing artist_id'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM artists WHERE id = ? LIMIT 1");
    $stmt->execute([$artistId]);
    $art = $stmt->fetch();
    if (!$art) {
        json_response(['status' => 'error', 'message' => 'Artist not found'], 404);
    }

    $name = trim($input['name'] ?? $art['name']);
    $verified = isset($input['verified']) ? (int)((bool)$input['verified']) : (int)$art['verified'];
    $claimedStatus = in_array($input['claimed_status'] ?? '', ['unclaimed', 'pending', 'claimed', 'disputed'], true) ? $input['claimed_status'] : $art['claimed_status'];
    $labelName = trim($input['label_name'] ?? $art['label_name'] ?? '');
    $bio = trim($input['bio'] ?? $art['bio'] ?? '');

    $pdo->prepare("UPDATE artists SET name = ?, verified = ?, claimed_status = ?, label_name = ?, bio = ? WHERE id = ?")
        ->execute([$name, $verified, $claimedStatus, $labelName, $bio, $artistId]);

    Auth::logAudit($user['id'], 'ADMIN_ARTIST_UPDATED', 'ARTIST', $artistId, [
        'name' => $name,
        'verified' => $verified,
        'claimed_status' => $claimedStatus
    ]);

    json_response(['status' => 'success', 'message' => "Artist profile {$name} updated."]);
}

// --- 4. MUSIC CATALOG GOVERNANCE (TRACKS & ALBUMS) ---
if ($method === 'POST' && $action === 'update_track') {
    $trackId = trim($input['track_id'] ?? '');
    if (empty($trackId)) {
        json_response(['status' => 'error', 'message' => 'Missing track_id'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM tracks WHERE id = ? LIMIT 1");
    $stmt->execute([$trackId]);
    $trk = $stmt->fetch();
    if (!$trk) {
        json_response(['status' => 'error', 'message' => 'Track not found'], 404);
    }

    if (!empty($input['delete_permanently']) || ($input['status'] ?? '') === 'removed') {
        $pdo->prepare("UPDATE tracks SET is_deleted = 1, status = 'unpublished' WHERE id = ?")->execute([$trackId]);
        Auth::logAudit($user['id'], 'ADMIN_TRACK_REMOVED', 'TRACK', $trackId, ['title' => $trk['title']]);
        json_response(['status' => 'success', 'message' => "Track '{$trk['title']}' removed from catalog."]);
    }

    $title = trim($input['title'] ?? $trk['title']);
    $artistName = trim($input['artist_name'] ?? $trk['artist_name']);
    $albumName = trim($input['album_name'] ?? $trk['album_name'] ?? '');
    $genre = trim($input['genre'] ?? $trk['genre']);
    $country = strtoupper(substr(trim($input['country'] ?? $trk['country'] ?? 'US'), 0, 2));
    $releaseYear = (int)($input['release_year'] ?? $trk['release_year'] ?? date('Y'));
    $coverUrl = trim($input['cover_art_url'] ?? $trk['cover_art_url'] ?? '');
    $rawStatus = $input['status'] ?? ($trk['status'] ?? 'published');
    if ($rawStatus === 'active') $rawStatus = 'published';
    $status = in_array($rawStatus, ['published', 'review', 'flagged', 'unpublished', 'rejected'], true) ? $rawStatus : 'published';
    $licenseStatus = in_array($input['license_status'] ?? '', ['verified_licensed', 'pending_verification', 'direct_upload', 'cc_by', 'disputed'], true)
        ? $input['license_status']
        : ($trk['license_status'] ?? 'verified_licensed');
    $licenseNotes = trim($input['license_notes'] ?? $trk['license_notes'] ?? '');
    $featured = isset($input['featured_on_home']) ? (int)((bool)$input['featured_on_home']) : (int)($trk['featured_on_home'] ?? 1);

    $pdo->prepare("
        UPDATE tracks 
        SET title = ?, artist_name = ?, album_name = ?, genre = ?, country = ?, release_year = ?, cover_art_url = ?, status = ?, license_status = ?, license_notes = ?, featured_on_home = ?
        WHERE id = ?
    ")->execute([$title, $artistName, $albumName, $genre, $country, $releaseYear, $coverUrl, $status, $licenseStatus, $licenseNotes, $featured, $trackId]);

    Auth::logAudit($user['id'], 'ADMIN_TRACK_UPDATED', 'TRACK', $trackId, [
        'title' => $title,
        'status' => $status,
        'license_status' => $licenseStatus,
        'featured_on_home' => $featured
    ]);

    json_response(['status' => 'success', 'message' => "Track '{$title}' updated in MySQL."]);
}

if ($method === 'POST' && $action === 'bulk_update_tracks') {
    $trackIds = $input['track_ids'] ?? [];
    $bulkAction = trim($input['bulk_action'] ?? ''); // publish, unpublish, verify_license, resync_audio, delete
    if (!is_array($trackIds) || empty($trackIds) || empty($bulkAction)) {
        json_response(['status' => 'error', 'message' => 'track_ids array and bulk_action are required.'], 400);
    }

    $affected = 0;
    foreach ($trackIds as $tid) {
        $tid = trim((string)$tid);
        if (empty($tid)) continue;

        if ($bulkAction === 'publish') {
            $pdo->prepare("UPDATE tracks SET status = 'published' WHERE id = ?")->execute([$tid]);
            $affected++;
        } elseif ($bulkAction === 'unpublish') {
            $pdo->prepare("UPDATE tracks SET status = 'unpublished' WHERE id = ?")->execute([$tid]);
            $affected++;
        } elseif ($bulkAction === 'verify_license') {
            $pdo->prepare("UPDATE tracks SET license_status = 'verified_licensed', license_notes = 'Bulk verified by Administrator' WHERE id = ?")->execute([$tid]);
            $affected++;
        } elseif ($bulkAction === 'delete') {
            $pdo->prepare("UPDATE tracks SET is_deleted = 1, status = 'unpublished' WHERE id = ?")->execute([$tid]);
            $affected++;
        } elseif ($bulkAction === 'resync_audio') {
            $stmtT = $pdo->prepare("SELECT id, video_id, title, artist_name, genre, country, cover_art_url FROM tracks WHERE id = ? LIMIT 1");
            $stmtT->execute([$tid]);
            $tRow = $stmtT->fetch();
            if ($tRow) {
                $aRes = MediaEngine::acquireAndStoreAudio($tRow['id'], $tRow['video_id'], $tRow['title'], $tRow['artist_name'], $tRow['genre'] ?: 'Pop', $tRow['country'] ?: 'US');
                $streamUrl = "/phpbackend/api/stream.php?id=" . urlencode($tRow['id']);
                $pdo->prepare("UPDATE tracks SET local_audio_path = ?, audio_file_size = ?, audio_format = ?, audio_url = ?, import_status = 'synced', last_synced_at = NOW() WHERE id = ?")
                    ->execute([$aRes['relative_path'], $aRes['file_size'], $aRes['format'], $streamUrl, $tRow['id']]);
                $affected++;
            }
        }
    }

    Auth::logAudit($user['id'], 'ADMIN_BULK_CATALOG_ACTION', 'TRACK', implode(',', array_slice($trackIds, 0, 5)), [
        'bulk_action' => $bulkAction,
        'affected_count' => $affected
    ]);

    json_response([
        'status' => 'success',
        'affected_count' => $affected,
        'message' => "Executed bulk '{$bulkAction}' on {$affected} catalog track(s)."
    ]);
}

if ($method === 'POST' && $action === 'update_album') {
    $albumId = trim($input['album_id'] ?? '');
    if (empty($albumId)) {
        json_response(['status' => 'error', 'message' => 'Missing album_id'], 400);
    }

    if (!empty($input['delete'])) {
        $pdo->prepare("DELETE FROM albums WHERE id = ?")->execute([$albumId]);
        Auth::logAudit($user['id'], 'ADMIN_ALBUM_DELETED', 'ALBUM', $albumId, []);
        json_response(['status' => 'success', 'message' => 'Album deleted.']);
    }

    $status = in_array($input['status'] ?? '', ['draft', 'review', 'published', 'rejected', 'unpublished'], true) ? $input['status'] : 'published';
    $title = trim($input['title'] ?? '');
    if ($title !== '') {
        $pdo->prepare("UPDATE albums SET title = ?, status = ? WHERE id = ?")->execute([$title, $status, $albumId]);
    } else {
        $pdo->prepare("UPDATE albums SET status = ? WHERE id = ?")->execute([$status, $albumId]);
    }

    Auth::logAudit($user['id'], 'ADMIN_ALBUM_UPDATED', 'ALBUM', $albumId, ['status' => $status]);
    json_response(['status' => 'success', 'message' => "Album {$albumId} status updated to {$status}."]);
}

// --- 5. DISTRIBUTORS, LABELS & ROLE PERMISSIONS ---
if ($method === 'POST' && $action === 'update_distributor') {
    $distId = trim($input['id'] ?? '');
    $name = trim($input['name'] ?? '');
    $email = trim($input['contact_email'] ?? '');
    $status = in_array($input['status'] ?? '', ['active', 'suspended', 'pending'], true) ? $input['status'] : 'active';
    $quota = trim($input['quota_type'] ?? 'Unlimited DDEX');
    $canUpload = isset($input['can_direct_upload']) ? (int)((bool)$input['can_direct_upload']) : 1;
    $canEdit = isset($input['can_edit_metadata']) ? (int)((bool)$input['can_edit_metadata']) : 1;

    if (empty($distId)) {
        $distId = 'dist_' . bin2hex(random_bytes(4));
        $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name ?: $distId));
        $pdo->prepare("
            INSERT INTO distributors (id, name, slug, contact_email, status, quota_type, can_direct_upload, can_edit_metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([$distId, $name, $slug, $email, $status, $quota, $canUpload, $canEdit]);
        Auth::logAudit($user['id'], 'ADMIN_DISTRIBUTOR_CREATED', 'DISTRIBUTOR', $distId, ['name' => $name]);
        json_response(['status' => 'success', 'message' => "Distributor '{$name}' created."]);
    } else {
        $pdo->prepare("
            UPDATE distributors 
            SET name = COALESCE(NULLIF(?, ''), name), contact_email = COALESCE(NULLIF(?, ''), contact_email), status = ?, quota_type = ?, can_direct_upload = ?, can_edit_metadata = ?
            WHERE id = ?
        ")->execute([$name, $email, $status, $quota, $canUpload, $canEdit, $distId]);
        Auth::logAudit($user['id'], 'ADMIN_DISTRIBUTOR_UPDATED', 'DISTRIBUTOR', $distId, ['status' => $status, 'can_direct_upload' => $canUpload]);
        json_response(['status' => 'success', 'message' => "Distributor updated."]);
    }
}

if ($method === 'POST' && $action === 'update_label') {
    $labelId = trim($input['id'] ?? '');
    $name = trim($input['name'] ?? '');
    $email = trim($input['contact_email'] ?? '');
    $country = strtoupper(substr(trim($input['country'] ?? 'US'), 0, 2));
    $status = in_array($input['status'] ?? '', ['active', 'suspended', 'pending'], true) ? $input['status'] : 'active';
    $canRoster = isset($input['can_manage_roster']) ? (int)((bool)$input['can_manage_roster']) : 1;

    if (empty($labelId)) {
        $labelId = 'lbl_' . bin2hex(random_bytes(4));
        $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name ?: $labelId));
        $pdo->prepare("
            INSERT INTO labels (id, name, slug, contact_email, country, status, can_manage_roster)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ")->execute([$labelId, $name, $slug, $email, $country, $status, $canRoster]);
        Auth::logAudit($user['id'], 'ADMIN_LABEL_CREATED', 'LABEL', $labelId, ['name' => $name]);
        json_response(['status' => 'success', 'message' => "Label '{$name}' created."]);
    } else {
        $pdo->prepare("
            UPDATE labels 
            SET name = COALESCE(NULLIF(?, ''), name), contact_email = COALESCE(NULLIF(?, ''), contact_email), country = ?, status = ?, can_manage_roster = ?
            WHERE id = ?
        ")->execute([$name, $email, $country, $status, $canRoster, $labelId]);
        Auth::logAudit($user['id'], 'ADMIN_LABEL_UPDATED', 'LABEL', $labelId, ['status' => $status, 'can_manage_roster' => $canRoster]);
        json_response(['status' => 'success', 'message' => "Label updated."]);
    }
}

if ($method === 'POST' && $action === 'update_role_permission') {
    $role = trim($input['role'] ?? '');
    if (empty($role)) {
        json_response(['status' => 'error', 'message' => 'Missing role'], 400);
    }

    $canUpload = !empty($input['canDirectUpload']) || !empty($input['can_direct_upload']) ? 1 : 0;
    $canEdit = !empty($input['canEditLiveMetadata']) || !empty($input['can_edit_live_metadata']) ? 1 : 0;
    $canRoster = !empty($input['canManageRoster']) || !empty($input['can_manage_roster']) ? 1 : 0;
    $canFeature = !empty($input['canFeatureOnHome']) || !empty($input['can_feature_on_home']) ? 1 : 0;
    $maxUpload = (int)($input['maxUploadPerMonth'] ?? $input['max_upload_per_month'] ?? 0);

    $pdo->prepare("
        UPDATE role_permissions 
        SET can_direct_upload = ?, can_edit_live_metadata = ?, can_manage_roster = ?, can_feature_on_home = ?, max_upload_per_month = ?
        WHERE role = ?
    ")->execute([$canUpload, $canEdit, $canRoster, $canFeature, $maxUpload, $role]);

    Auth::logAudit($user['id'], 'ADMIN_ROLE_POLICY_UPDATED', 'ROLE_PERMISSION', $role, [
        'can_direct_upload' => $canUpload,
        'can_edit_live_metadata' => $canEdit,
        'max_upload_per_month' => $maxUpload
    ]);

    json_response(['status' => 'success', 'message' => "Role permissions for '{$role}' saved to MySQL."]);
}

// --- 6. MODERATION & COPYRIGHT REPORTS ---
if ($method === 'POST' && $action === 'resolve_report') {
    $reportId = trim($input['report_id'] ?? '');
    $status = in_array($input['status'] ?? '', ['open', 'investigating', 'resolved', 'dismissed', 'appealed'], true) ? $input['status'] : 'resolved';
    $notes = trim($input['resolution_notes'] ?? '');
    $enforceAction = trim($input['enforce_action'] ?? ''); // e.g., 'unpublish_track', 'suspend_user', 'none'

    if (empty($reportId)) {
        json_response(['status' => 'error', 'message' => 'Missing report_id'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM moderation_reports WHERE id = ? LIMIT 1");
    $stmt->execute([$reportId]);
    $rep = $stmt->fetch();
    if (!$rep) {
        json_response(['status' => 'error', 'message' => 'Report not found'], 404);
    }

    $pdo->prepare("UPDATE moderation_reports SET status = ?, resolution_notes = ?, resolved_by = ? WHERE id = ?")
        ->execute([$status, $notes, $user['id'], $reportId]);

    if ($enforceAction === 'unpublish_track' && $rep['target_type'] === 'track') {
        $pdo->prepare("UPDATE tracks SET status = 'flagged', featured_on_home = 0 WHERE id = ?")->execute([$rep['target_id']]);
    } elseif ($enforceAction === 'suspend_user' && $rep['target_type'] === 'user') {
        $pdo->prepare("UPDATE users SET status = 'suspended' WHERE id = ? AND role != 'admin'")->execute([$rep['target_id']]);
    }

    Auth::logAudit($user['id'], 'ADMIN_MODERATION_UPDATED', 'REPORT', $reportId, [
        'status' => $status,
        'enforce_action' => $enforceAction,
        'notes' => $notes
    ]);

    json_response(['status' => 'success', 'message' => "Moderation report {$reportId} marked as {$status}."]);
}

if ($method === 'POST' && $action === 'create_report') {
    $reportId = 'rep_' . bin2hex(random_bytes(5));
    $targetType = in_array($input['target_type'] ?? '', ['track', 'album', 'artist', 'playlist', 'user'], true) ? $input['target_type'] : 'track';
    $targetId = trim($input['target_id'] ?? 'trk_general');
    $targetName = trim($input['target_name'] ?? 'Reported Content');
    $category = in_array($input['category'] ?? '', ['copyright', 'impersonation', 'inappropriate', 'spam', 'dispute', 'appeal'], true) ? $input['category'] : 'copyright';
    $reason = trim($input['reason'] ?? '');
    $reporterEmail = trim($input['reporter_email'] ?? $user['email']);

    if (empty($reason)) {
        json_response(['status' => 'error', 'message' => 'Reason is required.'], 400);
    }

    $pdo->prepare("
        INSERT INTO moderation_reports (id, reporter_user_id, reporter_email, target_type, target_id, target_name, category, reason, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
    ")->execute([$reportId, $user['id'], $reporterEmail, $targetType, $targetId, $targetName, $category, $reason]);

    Auth::logAudit($user['id'], 'MODERATION_REPORT_LOGGED', 'REPORT', $reportId, ['category' => $category, 'target' => $targetName]);
    json_response(['status' => 'success', 'message' => 'Moderation case logged.']);
}

// --- 8. PLAYLISTS & GENRES ---
if ($method === 'POST' && $action === 'update_playlist') {
    $playlistId = trim($input['playlist_id'] ?? '');
    if (empty($playlistId)) {
        json_response(['status' => 'error', 'message' => 'Missing playlist_id'], 400);
    }

    if (!empty($input['delete'])) {
        $pdo->prepare("DELETE FROM playlists WHERE id = ?")->execute([$playlistId]);
        Auth::logAudit($user['id'], 'ADMIN_PLAYLIST_DELETED', 'PLAYLIST', $playlistId, []);
        json_response(['status' => 'success', 'message' => 'Playlist deleted.']);
    }

    $stmt = $pdo->prepare("SELECT * FROM playlists WHERE id = ? LIMIT 1");
    $stmt->execute([$playlistId]);
    $pl = $stmt->fetch();
    if (!$pl) {
        json_response(['status' => 'error', 'message' => 'Playlist not found'], 404);
    }

    $title = trim($input['title'] ?? $pl['title']);
    $desc = trim($input['description'] ?? $pl['description'] ?? '');
    $category = trim($input['genre_category'] ?? $pl['genre_category'] ?? 'all');
    $isFeatured = isset($input['is_featured']) ? (int)((bool)$input['is_featured']) : (int)($pl['is_featured'] ?? 1);
    $status = in_array($input['status'] ?? '', ['active', 'unpublished', 'flagged'], true) ? $input['status'] : ($pl['status'] ?? 'active');

    $pdo->prepare("
        UPDATE playlists 
        SET title = ?, description = ?, genre_category = ?, is_featured = ?, status = ?
        WHERE id = ?
    ")->execute([$title, $desc, $category, $isFeatured, $status, $playlistId]);

    Auth::logAudit($user['id'], 'ADMIN_PLAYLIST_UPDATED', 'PLAYLIST', $playlistId, ['title' => $title, 'is_featured' => $isFeatured, 'status' => $status]);
    json_response(['status' => 'success', 'message' => "Playlist '{$title}' updated."]);
}

if ($method === 'POST' && $action === 'save_genre') {
    $genreId = trim($input['id'] ?? '');
    $name = trim($input['name'] ?? '');
    $desc = trim($input['description'] ?? '');
    $isFeatured = isset($input['is_featured']) ? (int)((bool)$input['is_featured']) : 1;
    $order = (int)($input['display_order'] ?? 1);

    if (empty($name)) {
        json_response(['status' => 'error', 'message' => 'Genre name is required.'], 400);
    }

    $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name));
    if (empty($genreId)) {
        $genreId = 'gen_' . $slug;
    }

    $pdo->prepare("
        INSERT INTO platform_genres (id, name, slug, description, color_theme, is_featured, display_order)
        VALUES (?, ?, ?, ?, 'from-red-600/30 to-amber-600/20', ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), is_featured = VALUES(is_featured), display_order = VALUES(display_order)
    ")->execute([$genreId, $name, $slug, $desc, $isFeatured, $order]);

    Auth::logAudit($user['id'], 'ADMIN_GENRE_SAVED', 'GENRE', $genreId, ['name' => $name, 'is_featured' => $isFeatured]);
    json_response(['status' => 'success', 'message' => "Genre '{$name}' saved."]);
}

// --- 9. SYSTEM SETTINGS ---
if ($method === 'POST' && $action === 'update_settings') {
    $settings = $input['settings'] ?? [];
    if (!is_array($settings)) {
        json_response(['status' => 'error', 'message' => 'Invalid settings payload'], 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO system_settings (setting_key, setting_value, updated_by)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)
    ");

    foreach ($settings as $k => $v) {
        $valStr = is_bool($v) ? ($v ? 'true' : 'false') : (string)$v;
        $stmt->execute([(string)$k, $valStr, $user['id']]);
    }

    Auth::logAudit($user['id'], 'ADMIN_SETTINGS_UPDATED', 'SYSTEM', 'SETTINGS', $settings);
    json_response(['status' => 'success', 'message' => 'System configuration saved to MySQL.']);
}

// --- 10. AUDIT LOGS ---
if ($method === 'GET' && $action === 'audit_logs') {
    $stmt = $pdo->query("
        SELECT l.*, u.email AS user_email, u.display_name AS user_name
        FROM audit_logs l
        LEFT JOIN users u ON l.user_id = u.id
        ORDER BY l.created_at DESC
        LIMIT 100
    ");
    json_response(['status' => 'success', 'audit_logs' => $stmt->fetchAll()]);
}

// --- 11. SECURITY & SESSIONS ---
if ($method === 'POST' && $action === 'revoke_session') {
    $sessionId = trim($input['session_id'] ?? '');
    $targetUserId = trim($input['user_id'] ?? '');

    if (!empty($sessionId)) {
        $pdo->prepare("UPDATE user_sessions SET is_revoked = 1 WHERE id = ?")->execute([$sessionId]);
        Auth::logAudit($user['id'], 'ADMIN_SESSION_REVOKED', 'SESSION', $sessionId, []);
        json_response(['status' => 'success', 'message' => "Session {$sessionId} revoked."]);
    } elseif (!empty($targetUserId)) {
        $pdo->prepare("UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?")->execute([$targetUserId]);
        Auth::logAudit($user['id'], 'ADMIN_USER_SESSIONS_REVOKED', 'USER', $targetUserId, []);
        json_response(['status' => 'success', 'message' => "All sessions for user {$targetUserId} revoked."]);
    }
    json_response(['status' => 'error', 'message' => 'Provide session_id or user_id'], 400);
}

if ($method === 'POST' && $action === 'unlock_user') {
    $targetUserId = trim($input['user_id'] ?? '');
    if (empty($targetUserId)) {
        json_response(['status' => 'error', 'message' => 'Missing user_id'], 400);
    }
    $pdo->prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, status = 'active' WHERE id = ?")
        ->execute([$targetUserId]);
    Auth::logAudit($user['id'], 'ADMIN_USER_UNLOCKED', 'USER', $targetUserId, []);
    json_response(['status' => 'success', 'message' => 'User account unlocked and restored.']);
}

json_response(['status' => 'error', 'message' => 'Invalid admin action'], 400);
