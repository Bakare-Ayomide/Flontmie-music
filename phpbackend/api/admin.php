<?php
/**
 * Flontmie API - Owner & Super-Admin Governance Controller
 * Enforces strict server-side RBAC (role = 'admin'), CSRF validation on state changes,
 * and complete database persistence for Users, Roles, Artists, Albums/EPs/Singles,
 * Tracks, Playlists, Record Labels, Distributors, Genres, Claims, Moderation, and Settings.
 * Zero mock data or simulated records.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../media_engine.php';
require_once __DIR__ . '/../artist_enrichment.php';

// Enforce Admin-only access on every action in this endpoint
$admin = Auth::requireRole(['admin']);
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'overview';
$pdo = Database::getConnection();
$input = get_json_input();

if ($method === 'POST' || $method === 'PUT' || $method === 'DELETE') {
    Auth::verifyCsrf($admin, $input);
}

// --- 1. COMPREHENSIVE ADMIN OVERVIEW & CATALOG TELEMETRY ---
if ($method === 'GET' && ($action === 'overview' || $action === 'dashboard')) {
    $totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $activeUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status = 'active'")->fetchColumn();
    $suspendedUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status IN ('suspended', 'banned')")->fetchColumn();
    $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn();
    $distributorUsersCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'distributor'")->fetchColumn();
    $artistUsersCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'artist'")->fetchColumn();
    $labelUsersCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'label'")->fetchColumn();

    $totalTracks = (int)$pdo->query("SELECT COUNT(*) FROM tracks WHERE is_deleted = 0")->fetchColumn();
    $publishedTracks = (int)$pdo->query("SELECT COUNT(*) FROM tracks WHERE is_deleted = 0 AND (status = 'published' OR status = 'active' OR status IS NULL)")->fetchColumn();
    $totalArtists = (int)$pdo->query("SELECT COUNT(*) FROM artists")->fetchColumn();
    $totalAlbums = (int)$pdo->query("SELECT COUNT(*) FROM albums")->fetchColumn();
    $totalPlaylists = (int)$pdo->query("SELECT COUNT(*) FROM playlists")->fetchColumn();
    $totalDistributors = (int)$pdo->query("SELECT COUNT(*) FROM distributors")->fetchColumn();
    $totalLabels = (int)$pdo->query("SELECT COUNT(*) FROM labels")->fetchColumn();
    $pendingClaims = (int)$pdo->query("SELECT COUNT(*) FROM artist_claims WHERE status IN ('pending', 'escalated')")->fetchColumn();
    $openFlags = (int)$pdo->query("SELECT COUNT(*) FROM content_flags WHERE status = 'open'")->fetchColumn();
    $totalStreams = (int)$pdo->query("SELECT COALESCE(SUM(stream_count), 0) FROM tracks WHERE is_deleted = 0")->fetchColumn();
    $totalFlontmiePlays = (int)$pdo->query("SELECT COALESCE(SUM(flontmie_plays), 0) FROM tracks WHERE is_deleted = 0")->fetchColumn();
    $totalLikes = (int)$pdo->query("SELECT COUNT(*) FROM user_favorites")->fetchColumn();
    $totalComments = (int)$pdo->query("SELECT COUNT(*) FROM track_comments")->fetchColumn();
    $totalActivities = 0;
    try {
        $totalActivities = (int)$pdo->query("SELECT COUNT(*) FROM user_activities")->fetchColumn();
    } catch (Exception $e) {}

    // Users list
    $users = $pdo->query("
        SELECT u.id, u.username, u.email, u.role, u.status, u.display_name, u.avatar_url, u.bio, u.country,
               u.distributor_id, u.label_id, u.artist_id, u.email_verified, u.last_login_at, u.created_at,
               (SELECT COUNT(*) FROM playlists p WHERE p.user_id = u.id) AS playlists_count,
               (SELECT COUNT(*) FROM user_favorites uf WHERE uf.user_id = u.id) AS likes_count,
               (SELECT COUNT(*) FROM track_comments tc WHERE tc.user_id = u.id) AS comments_count
        FROM users u
        ORDER BY u.created_at DESC
        LIMIT 250
    ")->fetchAll();

    // Tracks list
    $tracks = $pdo->query("
        SELECT t.id, t.video_id, t.title, t.artist_id, t.artist_name, t.album_id, t.album_name, t.duration, t.genre, t.country, t.release_year, t.release_date,
               t.cover_art_url, t.audio_url, t.video_url, t.local_audio_path, t.local_video_path, t.local_artwork_path, t.local_lyrics_path,
               t.audio_file_size, t.audio_format, t.import_status, t.stream_count, t.flontmie_plays,
               (SELECT COUNT(*) FROM user_favorites uf WHERE uf.track_id = t.id) AS likes_count,
               (SELECT COUNT(*) FROM track_comments tc WHERE tc.track_id = t.id) AS comments_count,
               t.explicit, t.isrc,
               t.status, t.featured_on_home, t.editorial_boost, t.license_status, t.license_notes, t.lyrics, t.distributor_id, t.label_id, t.uploaded_by_user_id, t.created_at
        FROM tracks t
        WHERE t.is_deleted = 0
        ORDER BY t.created_at DESC
        LIMIT 300
    ")->fetchAll();

    foreach ($tracks as &$t) {
        $t['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($t['cover_art_url'] ?? '', $t['video_id'] ?? $t['id']);
        $t['yt_plays'] = ArtistEnrichment::parseMetric((string)($t['stream_count'] ?? '0'))['compact'];
        $t['flontmie_plays'] = (int)($t['flontmie_plays'] ?? 0);
        $t['likes_count'] = (int)($t['likes_count'] ?? 0);
        $t['comments_count'] = (int)($t['comments_count'] ?? 0);
        $t['has_local_audio'] = !empty($t['local_audio_path']);
        $t['has_local_video'] = !empty($t['local_video_path']) || !empty($t['video_url']);
        $t['has_lyrics'] = !empty($t['lyrics']) || !empty($t['local_lyrics_path']);
        $t['audio_url'] = '/phpbackend/api/stream.php?id=' . urlencode($t['id']);
        if (!empty($t['local_video_path'])) {
            $t['video_url'] = '/phpbackend/api/stream.php?id=' . urlencode($t['id']) . '&type=video';
        }
        unset($t['local_audio_path'], $t['local_artwork_path'], $t['local_video_path'], $t['local_lyrics_path']);
    }

    // Artists list
    $artists = $pdo->query("
        SELECT id, name, stage_name, slug, avatar_url, header_url, bio, country, verified, is_featured, status,
               monthly_listeners, total_streams, followers, genres_json, social_links_json,
               created_by_distributor, distributor_name, distributor_id, label_id, label_name,
               claimed_status, claimed_user_id, created_by_user_id, created_at
        FROM artists
        ORDER BY created_at DESC
        LIMIT 250
    ")->fetchAll();
    foreach ($artists as &$a) {
        $a['avatar_url'] = ArtistEnrichment::resolveArtworkUrl($a['avatar_url'] ?? '', $a['id']);
        $a['header_url'] = ArtistEnrichment::resolveArtworkUrl($a['header_url'] ?? $a['avatar_url'], $a['id']);
        $a['genres'] = !empty($a['genres_json']) ? json_decode($a['genres_json'], true) : [];
        $a['social_links'] = !empty($a['social_links_json']) ? json_decode($a['social_links_json'], true) : [];
    }

    // Albums list
    $albums = $pdo->query("
        SELECT id, title, artist_id, artist_name, cover_art_url, release_date, release_type, genre,
               status, is_featured, upc, tracks_count, distributor_id, label_id, created_by_user_id, created_at
        FROM albums
        ORDER BY created_at DESC
        LIMIT 250
    ")->fetchAll();
    foreach ($albums as &$alb) {
        $alb['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($alb['cover_art_url'] ?? '', $alb['artist_id'] ?? $alb['id']);
    }

    // Playlists list with creator details
    $playlists = $pdo->query("
        SELECT p.id, p.user_id, p.title, p.description, p.cover_art_url, p.genre_category, p.is_public, p.is_featured, p.status, p.track_ids_json, p.created_at, p.updated_at,
               COALESCE(NULLIF(u.display_name, ''), u.username, 'Flontmie Admin') AS creator_name,
               u.username AS creator_username,
               u.email AS creator_email,
               COALESCE(u.role, 'admin') AS creator_role
        FROM playlists p
        LEFT JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 200
    ")->fetchAll();
    $adminPlaylistsCount = 0;
    $userPlaylistsCount = 0;
    foreach ($playlists as &$pl) {
        $pl['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($pl['cover_art_url'] ?? '', $pl['id']);
        $tIds = !empty($pl['track_ids_json']) ? json_decode($pl['track_ids_json'], true) : [];
        if (!is_array($tIds) || empty($tIds)) {
            try {
                $ptSt = $pdo->prepare("SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC");
                $ptSt->execute([$pl['id']]);
                $tIds = array_column($ptSt->fetchAll(), 'track_id');
            } catch (Exception $e) {
                $tIds = [];
            }
        }
        $pl['track_ids'] = is_array($tIds) ? array_values($tIds) : [];
        $pl['track_count'] = count($pl['track_ids']);
        $pl['is_admin_created'] = (($pl['creator_role'] ?? '') === 'admin') || empty($pl['user_id']);
        if ($pl['is_admin_created']) {
            $adminPlaylistsCount++;
        } else {
            $userPlaylistsCount++;
        }
    }

    // Genres list
    $genres = $pdo->query("SELECT * FROM genres ORDER BY sort_order ASC, name ASC")->fetchAll();

    // Distributors list
    $distributors = $pdo->query("SELECT * FROM distributors ORDER BY created_at DESC")->fetchAll();

    // Labels list
    $labels = $pdo->query("SELECT * FROM labels ORDER BY created_at DESC")->fetchAll();

    // Claims list
    $claims = $pdo->query("
        SELECT c.*, a.name AS artist_name, a.avatar_url AS artist_avatar
        FROM artist_claims c
        LEFT JOIN artists a ON c.artist_id = a.id
        ORDER BY c.created_at DESC
        LIMIT 100
    ")->fetchAll();

    // Flags / Moderation queue
    $flags = $pdo->query("SELECT * FROM content_flags ORDER BY created_at DESC LIMIT 100")->fetchAll();

    // System settings
    $settingsRows = $pdo->query("SELECT setting_key, setting_value, updated_at FROM system_settings")->fetchAll();
    $settings = [];
    foreach ($settingsRows as $r) {
        $settings[$r['setting_key']] = $r['setting_value'];
    }

    // Top searches & recent searches
    $topSearches = $pdo->query("
        SELECT query, COUNT(*) AS searches, MAX(results_count) AS results_count, MAX(created_at) AS last_searched
        FROM search_logs
        GROUP BY query
        ORDER BY searches DESC
        LIMIT 20
    ")->fetchAll();

    // Top tracks by plays
    $topTracks = $pdo->query("
        SELECT id, title, artist_name, genre, stream_count, flontmie_plays, likes_count, cover_art_url
        FROM tracks
        WHERE is_deleted = 0
        ORDER BY flontmie_plays DESC, stream_count DESC
        LIMIT 15
    ")->fetchAll();

    // Recent audit logs & security events
    $auditLogs = $pdo->query("
        SELECT l.*, u.email AS actor_email, u.display_name AS actor_name
        FROM audit_logs l
        LEFT JOIN users u ON l.user_id = u.id
        ORDER BY l.created_at DESC
        LIMIT 60
    ")->fetchAll();

    $securityEvents = $pdo->query("
        SELECT * FROM security_events
        ORDER BY created_at DESC
        LIMIT 60
    ")->fetchAll();

    // Active sessions
    $activeSessions = $pdo->query("
        SELECT s.id, s.user_id, s.ip_address, s.user_agent, s.last_active_at, s.expires_at, u.email, u.role
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.is_revoked = 0 AND s.expires_at > NOW()
        ORDER BY s.last_active_at DESC
        LIMIT 50
    ")->fetchAll();

    // Import jobs & schedules
    $importJobs = [];
    $importSchedules = [];
    $storageStats = [];
    try {
        $importJobs = $pdo->query("SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 60")->fetchAll();
        $importSchedules = $pdo->query("SELECT * FROM import_schedules ORDER BY created_at DESC LIMIT 30")->fetchAll();
        $storageStats = MediaEngine::getStorageStats($pdo);
    } catch (Exception $e) {}

    // Recent user activities
    $userActivities = [];
    try {
        $userActivities = $pdo->query("
            SELECT ua.id, ua.user_id,
                   COALESCE(NULLIF(u.display_name, ''), ua.user_name, u.username, 'User') AS user_name,
                   COALESCE(u.email, ua.user_email, '') AS user_email,
                   COALESCE(u.role, ua.user_role, 'listener') AS user_role,
                   ua.action_type, ua.target_type, ua.target_id, ua.target_title, ua.metadata_json, ua.created_at
            FROM user_activities ua
            LEFT JOIN users u ON ua.user_id = u.id
            ORDER BY ua.created_at DESC
            LIMIT 80
        ")->fetchAll();
        foreach ($userActivities as &$act) {
            $act['metadata'] = !empty($act['metadata_json']) ? json_decode($act['metadata_json'], true) : [];
        }
    } catch (Exception $e) {}

    $metricsPayload = [
        'total_users' => $totalUsers,
        'active_users' => $activeUsers,
        'suspended_users' => $suspendedUsers,
        'admin_count' => $adminCount,
        'distributor_users_count' => $distributorUsersCount,
        'artist_users_count' => $artistUsersCount,
        'label_users_count' => $labelUsersCount,
        'total_tracks' => $totalTracks,
        'published_tracks' => $publishedTracks,
        'total_artists' => $totalArtists,
        'total_albums' => $totalAlbums,
        'total_playlists' => $totalPlaylists,
        'admin_playlists_count' => $adminPlaylistsCount,
        'user_playlists_count' => $userPlaylistsCount,
        'total_distributors' => $totalDistributors,
        'total_labels' => $totalLabels,
        'pending_claims' => $pendingClaims,
        'open_flags' => $openFlags,
        'open_reports' => $openFlags,
        'total_streams' => $totalStreams,
        'total_flontmie_plays' => $totalFlontmiePlays,
        'total_likes' => $totalLikes,
        'total_comments' => $totalComments,
        'total_activities' => $totalActivities
    ];

    json_response([
        'status' => 'success',
        'metrics' => $metricsPayload,
        'stats' => $metricsPayload,
        'users' => $users,
        'tracks' => $tracks,
        'artists' => $artists,
        'albums' => $albums,
        'playlists' => $playlists,
        'genres' => $genres,
        'distributors' => $distributors,
        'labels' => $labels,
        'claims' => $claims,
        'flags' => $flags,
        'reports' => $flags,
        'settings' => $settings,
        'settings_list' => $settingsRows,
        'analytics' => [
            'top_searches' => $topSearches,
            'top_tracks' => $topTracks
        ],
        'audit_logs' => $auditLogs,
        'user_activities' => $userActivities,
        'security_events' => $securityEvents,
        'active_sessions' => $activeSessions,
        'sessions' => $activeSessions,
        'import_jobs' => $importJobs,
        'import_schedules' => $importSchedules,
        'storage' => $storageStats
    ]);
}

// --- 2. USER & ROLE MANAGEMENT ---
if ($method === 'POST' && $action === 'create_user') {
    $email = strtolower(trim($input['email'] ?? ''));
    $displayName = trim($input['display_name'] ?? '');
    $password = $input['password'] ?? '';
    $role = in_array($input['role'] ?? '', ['listener', 'artist', 'distributor', 'label', 'admin'], true) ? $input['role'] : 'listener';
    $distributorId = !empty($input['distributor_id']) ? trim($input['distributor_id']) : null;
    $labelId = !empty($input['label_id']) ? trim($input['label_id']) : null;
    $artistId = !empty($input['artist_id']) ? trim($input['artist_id']) : null;
    $country = strtoupper(substr(trim($input['country'] ?? 'US'), 0, 2)) ?: 'US';

    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(['status' => 'error', 'message' => 'A valid email address is required.'], 400);
    }
    if (empty($displayName)) {
        json_response(['status' => 'error', 'message' => 'Display name is required.'], 400);
    }
    if (strlen($password) < 8) {
        json_response(['status' => 'error', 'message' => 'Password must be at least 8 characters long.'], 400);
    }

    $chk = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
    $chk->execute([$email]);
    if ($chk->fetch()) {
        json_response(['status' => 'error', 'message' => 'A user with this email already exists.'], 409);
    }

    // If creating a distributor user and no distributor entity ID was passed, create a matching distributor entity automatically
    if ($role === 'distributor' && empty($distributorId)) {
        $distributorId = 'dist_' . bin2hex(random_bytes(5));
        $pdo->prepare("
            INSERT INTO distributors (id, name, contact_email, status, access_level, created_by_user_id)
            VALUES (?, ?, ?, 'approved', 'full_ingestion', ?)
        ")->execute([$distributorId, $displayName, $email, $admin['id']]);
    }

    // If creating a label user and no label entity ID was passed, create a matching label entity automatically
    if ($role === 'label' && empty($labelId)) {
        $labelId = 'lbl_' . bin2hex(random_bytes(5));
        $pdo->prepare("
            INSERT INTO labels (id, name, contact_email, country, status, distributor_id, created_by_user_id)
            VALUES (?, ?, ?, ?, 'active', ?, ?)
        ")->execute([$labelId, $displayName, $email, $country, $distributorId, $admin['id']]);
    }

    // If creating an artist user and no artist entity ID was passed, create an artist profile automatically
    if ($role === 'artist' && empty($artistId)) {
        $artistId = 'art_' . bin2hex(random_bytes(5));
        $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $displayName)) . '-' . rand(100, 999);
        $pdo->prepare("
            INSERT INTO artists (id, name, stage_name, slug, country, verified, claimed_status, distributor_id, label_id, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, 1, 'claimed', ?, ?, ?)
        ")->execute([$artistId, $displayName, $displayName, $slug, $country, $distributorId, $labelId, $admin['id']]);
    }

    $userId = 'usr_' . bin2hex(random_bytes(6));
    $username = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '', explode('@', $email)[0])) . '_' . substr(bin2hex(random_bytes(2)), 0, 4);
    $hash = password_hash($password, PASSWORD_BCRYPT);

    $pdo->prepare("
        INSERT INTO users (id, username, email, password_hash, role, status, display_name, country, distributor_id, label_id, artist_id, email_verified)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 1)
    ")->execute([$userId, $username, $email, $hash, $role, $displayName, $country, $distributorId, $labelId, $artistId]);

    if ($role === 'artist' && !empty($artistId)) {
        $pdo->prepare("UPDATE artists SET claimed_user_id = ?, claimed_status = 'claimed' WHERE id = ?")->execute([$userId, $artistId]);
    }

    Auth::logAudit($admin['id'], 'ADMIN_USER_CREATED', 'USER', $userId, ['email' => $email, 'role' => $role, 'distributor_id' => $distributorId, 'label_id' => $labelId, 'artist_id' => $artistId]);
    json_response([
        'status' => 'success',
        'message' => "Created {$role} account for {$displayName} ({$email}).",
        'user_id' => $userId,
        'distributor_id' => $distributorId,
        'label_id' => $labelId,
        'artist_id' => $artistId
    ], 201);
}

if ($method === 'POST' && $action === 'update_user') {
    $userId = trim($input['user_id'] ?? '');
    if (empty($userId)) {
        json_response(['status' => 'error', 'message' => 'Missing user_id'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $targetUser = $stmt->fetch();
    if (!$targetUser) {
        json_response(['status' => 'error', 'message' => 'User not found'], 404);
    }

    $newRole = in_array($input['role'] ?? '', ['listener', 'artist', 'distributor', 'label', 'admin'], true) ? $input['role'] : $targetUser['role'];
    $newStatus = in_array($input['status'] ?? '', ['active', 'suspended', 'banned'], true) ? $input['status'] : $targetUser['status'];
    $newName = isset($input['display_name']) ? trim($input['display_name']) : $targetUser['display_name'];
    $newEmail = isset($input['email']) ? strtolower(trim($input['email'])) : $targetUser['email'];
    $distributorId = array_key_exists('distributor_id', $input) ? (!empty($input['distributor_id']) ? trim($input['distributor_id']) : null) : $targetUser['distributor_id'];
    $labelId = array_key_exists('label_id', $input) ? (!empty($input['label_id']) ? trim($input['label_id']) : null) : $targetUser['label_id'];
    $artistId = array_key_exists('artist_id', $input) ? (!empty($input['artist_id']) ? trim($input['artist_id']) : null) : $targetUser['artist_id'];

    // Prevent demoting or suspending the last active administrator
    if ($targetUser['role'] === 'admin' && ($newRole !== 'admin' || $newStatus !== 'active')) {
        $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'")->fetchColumn();
        if ($adminCount <= 1) {
            json_response(['status' => 'error', 'message' => 'Cannot demote or suspend the last active administrator account.'], 400);
        }
    }

    // Auto-provision Distributor entity if promoted to distributor without one
    if ($newRole === 'distributor' && empty($distributorId)) {
        $distributorId = 'dist_' . bin2hex(random_bytes(5));
        $pdo->prepare("
            INSERT INTO distributors (id, name, contact_email, status, access_level, created_by_user_id)
            VALUES (?, ?, ?, 'approved', 'full_ingestion', ?)
        ")->execute([$distributorId, $newName, $newEmail, $admin['id']]);
    }

    // Auto-provision Label entity if promoted to label without one
    if ($newRole === 'label' && empty($labelId)) {
        $labelId = 'lbl_' . bin2hex(random_bytes(5));
        $pdo->prepare("
            INSERT INTO labels (id, name, contact_email, status, distributor_id, created_by_user_id)
            VALUES (?, ?, ?, 'active', ?, ?)
        ")->execute([$labelId, $newName, $newEmail, $distributorId, $admin['id']]);
    }

    // Auto-provision Artist entity if promoted to artist without one
    if ($newRole === 'artist' && empty($artistId)) {
        $artistId = 'art_' . bin2hex(random_bytes(5));
        $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $newName)) . '-' . rand(100, 999);
        $pdo->prepare("
            INSERT INTO artists (id, name, stage_name, slug, verified, claimed_status, claimed_user_id, distributor_id, label_id, created_by_user_id)
            VALUES (?, ?, ?, ?, 1, 'claimed', ?, ?, ?, ?)
        ")->execute([$artistId, $newName, $newName, $slug, $userId, $distributorId, $labelId, $admin['id']]);
    } elseif ($newRole === 'artist' && !empty($artistId)) {
        $pdo->prepare("UPDATE artists SET claimed_user_id = ?, claimed_status = 'claimed' WHERE id = ?")->execute([$userId, $artistId]);
    }

    $pdo->prepare("
        UPDATE users
        SET role = ?, status = ?, display_name = ?, email = ?, distributor_id = ?, label_id = ?, artist_id = ?
        WHERE id = ?
    ")->execute([$newRole, $newStatus, $newName, $newEmail, $distributorId, $labelId, $artistId, $userId]);

    if (!empty($input['new_password']) && strlen($input['new_password']) >= 8) {
        $hash = password_hash($input['new_password'], PASSWORD_BCRYPT);
        $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?")->execute([$hash, $userId]);
    }

    if ($newStatus !== 'active') {
        $pdo->prepare("UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?")->execute([$userId]);
    }

    Auth::logAudit($admin['id'], 'ADMIN_USER_UPDATED', 'USER', $userId, [
        'role' => $newRole,
        'status' => $newStatus,
        'distributor_id' => $distributorId,
        'label_id' => $labelId,
        'artist_id' => $artistId
    ]);

    json_response(['status' => 'success', 'message' => "Updated user {$newName} ({$newRole})."]);
}

if ($method === 'POST' && $action === 'delete_user') {
    $userId = trim($input['user_id'] ?? '');
    if (empty($userId) || $userId === $admin['id']) {
        json_response(['status' => 'error', 'message' => 'Cannot delete your own active administrator account.'], 400);
    }

    $stmt = $pdo->prepare("SELECT role, email FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $u = $stmt->fetch();
    if (!$u) {
        json_response(['status' => 'error', 'message' => 'User not found'], 404);
    }
    if ($u['role'] === 'admin') {
        $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn();
        if ($adminCount <= 1) {
            json_response(['status' => 'error', 'message' => 'Cannot delete the last administrator account.'], 400);
        }
    }

    $pdo->prepare("DELETE FROM user_sessions WHERE user_id = ?")->execute([$userId]);
    $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$userId]);
    Auth::logAudit($admin['id'], 'ADMIN_USER_DELETED', 'USER', $userId, ['email' => $u['email']]);
    json_response(['status' => 'success', 'message' => 'User account permanently deleted.']);
}

if ($method === 'POST' && $action === 'revoke_session') {
    $sessionId = trim($input['session_id'] ?? '');
    $pdo->prepare("UPDATE user_sessions SET is_revoked = 1 WHERE id = ?")->execute([$sessionId]);
    Auth::logAudit($admin['id'], 'ADMIN_SESSION_REVOKED', 'SESSION', $sessionId);
    json_response(['status' => 'success', 'message' => 'Session revoked immediately.']);
}

// --- 3. DISTRIBUTOR MANAGEMENT (CREATE, UPDATE, DELETE) ---
if ($method === 'POST' && ($action === 'save_distributor' || $action === 'update_distributor')) {
    $distId = trim($input['id'] ?? $input['distributor_id'] ?? '');
    $name = trim($input['name'] ?? '');
    $contactEmail = strtolower(trim($input['contact_email'] ?? ''));
    $websiteUrl = trim($input['website_url'] ?? '');
    $rawStatus = $input['status'] ?? 'approved';
    if ($rawStatus === 'active') $rawStatus = 'approved';
    $status = in_array($rawStatus, ['approved', 'pending', 'suspended', 'revoked'], true) ? $rawStatus : 'approved';
    $accessLevel = in_array($input['access_level'] ?? '', ['full_ingestion', 'metadata_only', 'read_only'], true) ? $input['access_level'] : 'full_ingestion';
    $autoApprove = !empty($input['auto_approve_releases']) ? 1 : 0;

    if (empty($distId) && (empty($name) || empty($contactEmail))) {
        json_response(['status' => 'error', 'message' => 'Distributor name and contact email are required.'], 400);
    }

    if (empty($distId)) {
        $distId = 'dist_' . bin2hex(random_bytes(5));
        $apiKeyPrefix = 'flnt_live_' . substr(bin2hex(random_bytes(4)), 0, 8);
        $pdo->prepare("
            INSERT INTO distributors (id, name, contact_email, website_url, status, access_level, auto_approve_releases, api_key_prefix, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([$distId, $name, $contactEmail, $websiteUrl, $status, $accessLevel, $autoApprove, $apiKeyPrefix, $admin['id']]);
        Auth::logAudit($admin['id'], 'ADMIN_DISTRIBUTOR_CREATED', 'DISTRIBUTOR', $distId, ['name' => $name]);
        $msg = "Created distributor '{$name}'.";
    } else {
        $pdo->prepare("
            UPDATE distributors
            SET name = COALESCE(NULLIF(?, ''), name),
                contact_email = COALESCE(NULLIF(?, ''), contact_email),
                website_url = COALESCE(NULLIF(?, ''), website_url),
                status = ?,
                access_level = ?,
                auto_approve_releases = ?
            WHERE id = ?
        ")->execute([$name, $contactEmail, $websiteUrl, $status, $accessLevel, $autoApprove, $distId]);
        Auth::logAudit($admin['id'], 'ADMIN_DISTRIBUTOR_UPDATED', 'DISTRIBUTOR', $distId, ['name' => $name, 'status' => $status]);
        $msg = "Updated distributor.";
    }

    // Optionally create or link a user account if password is provided
    if (!empty($contactEmail) && !empty($input['account_password']) && strlen($input['account_password']) >= 8) {
        $chk = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $chk->execute([$contactEmail]);
        $existingUser = $chk->fetch();
        $hash = password_hash($input['account_password'], PASSWORD_BCRYPT);
        if ($existingUser) {
            $pdo->prepare("UPDATE users SET role = 'distributor', distributor_id = ?, password_hash = ?, display_name = COALESCE(NULLIF(?, ''), display_name) WHERE id = ?")
                ->execute([$distId, $hash, $name, $existingUser['id']]);
        } else {
            $uId = 'usr_' . bin2hex(random_bytes(6));
            $uname = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '', $name ?: explode('@', $contactEmail)[0])) . '_' . rand(100, 999);
            $pdo->prepare("
                INSERT INTO users (id, username, email, password_hash, role, status, display_name, distributor_id, email_verified)
                VALUES (?, ?, ?, ?, 'distributor', 'active', ?, ?, 1)
            ")->execute([$uId, $uname, $contactEmail, $hash, $name ?: $uname, $distId]);
        }
    }

    json_response(['status' => 'success', 'message' => $msg, 'distributor_id' => $distId]);
}

if ($method === 'POST' && $action === 'delete_distributor') {
    $distId = trim($input['id'] ?? $input['distributor_id'] ?? '');
    if (empty($distId)) {
        json_response(['status' => 'error', 'message' => 'Missing distributor id'], 400);
    }
    $pdo->prepare("DELETE FROM distributors WHERE id = ?")->execute([$distId]);
    $pdo->prepare("UPDATE users SET distributor_id = NULL WHERE distributor_id = ?")->execute([$distId]);
    Auth::logAudit($admin['id'], 'ADMIN_DISTRIBUTOR_DELETED', 'DISTRIBUTOR', $distId);
    json_response(['status' => 'success', 'message' => 'Distributor deleted.']);
}

// --- 4. RECORD LABEL MANAGEMENT (CREATE, UPDATE, DELETE) ---
if ($method === 'POST' && ($action === 'save_label' || $action === 'update_label')) {
    $labelId = trim($input['id'] ?? $input['label_id'] ?? '');
    $name = trim($input['name'] ?? '');
    $contactEmail = strtolower(trim($input['contact_email'] ?? ''));
    $websiteUrl = trim($input['website_url'] ?? '');
    $country = strtoupper(substr(trim($input['country'] ?? 'US'), 0, 2)) ?: 'US';
    $distributorId = !empty($input['distributor_id']) ? trim($input['distributor_id']) : null;
    $description = trim($input['description'] ?? '');
    $logoUrl = trim($input['logo_url'] ?? '');
    $status = in_array($input['status'] ?? '', ['active', 'pending', 'suspended'], true) ? $input['status'] : 'active';

    if (empty($labelId) && empty($name)) {
        json_response(['status' => 'error', 'message' => 'Record label name is required.'], 400);
    }

    if (empty($labelId)) {
        $labelId = 'lbl_' . bin2hex(random_bytes(5));
        $pdo->prepare("
            INSERT INTO labels (id, name, contact_email, website_url, logo_url, description, country, status, distributor_id, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([$labelId, $name, $contactEmail, $websiteUrl, $logoUrl, $description, $country, $status, $distributorId, $admin['id']]);
        Auth::logAudit($admin['id'], 'ADMIN_LABEL_CREATED', 'LABEL', $labelId, ['name' => $name]);
        $msg = "Created record label '{$name}'.";
    } else {
        $pdo->prepare("
            UPDATE labels
            SET name = COALESCE(NULLIF(?, ''), name),
                contact_email = COALESCE(NULLIF(?, ''), contact_email),
                website_url = COALESCE(NULLIF(?, ''), website_url),
                logo_url = COALESCE(NULLIF(?, ''), logo_url),
                description = COALESCE(NULLIF(?, ''), description),
                country = COALESCE(NULLIF(?, ''), country),
                status = ?,
                distributor_id = COALESCE(?, distributor_id)
            WHERE id = ?
        ")->execute([$name, $contactEmail, $websiteUrl, $logoUrl, $description, $country, $status, $distributorId, $labelId]);
        Auth::logAudit($admin['id'], 'ADMIN_LABEL_UPDATED', 'LABEL', $labelId, ['name' => $name]);
        $msg = "Updated record label.";
    }

    // Optionally create or link a label user account if password is provided
    if (!empty($contactEmail) && !empty($input['account_password']) && strlen($input['account_password']) >= 8) {
        $chk = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $chk->execute([$contactEmail]);
        $existingUser = $chk->fetch();
        $hash = password_hash($input['account_password'], PASSWORD_BCRYPT);
        if ($existingUser) {
            $pdo->prepare("UPDATE users SET role = 'label', label_id = ?, distributor_id = COALESCE(?, distributor_id), password_hash = ?, display_name = COALESCE(NULLIF(?, ''), display_name) WHERE id = ?")
                ->execute([$labelId, $distributorId, $hash, $name, $existingUser['id']]);
        } else {
            $uId = 'usr_' . bin2hex(random_bytes(6));
            $uname = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '', $name ?: explode('@', $contactEmail)[0])) . '_' . rand(100, 999);
            $pdo->prepare("
                INSERT INTO users (id, username, email, password_hash, role, status, display_name, label_id, distributor_id, country, email_verified)
                VALUES (?, ?, ?, ?, 'label', 'active', ?, ?, ?, ?, 1)
            ")->execute([$uId, $uname, $contactEmail, $hash, $name ?: $uname, $labelId, $distributorId, $country]);
        }
    }

    json_response(['status' => 'success', 'message' => $msg, 'label_id' => $labelId]);
}

if ($method === 'POST' && $action === 'delete_label') {
    $labelId = trim($input['id'] ?? $input['label_id'] ?? '');
    if (empty($labelId)) {
        json_response(['status' => 'error', 'message' => 'Missing label id'], 400);
    }
    $pdo->prepare("DELETE FROM labels WHERE id = ?")->execute([$labelId]);
    $pdo->prepare("UPDATE users SET label_id = NULL WHERE label_id = ?")->execute([$labelId]);
    $pdo->prepare("UPDATE artists SET label_id = NULL WHERE label_id = ?")->execute([$labelId]);
    Auth::logAudit($admin['id'], 'ADMIN_LABEL_DELETED', 'LABEL', $labelId);
    json_response(['status' => 'success', 'message' => 'Record label deleted.']);
}

// --- 5. ARTIST MANAGEMENT (CREATE, UPDATE, DELETE) ---
if ($method === 'POST' && ($action === 'save_artist' || $action === 'update_artist')) {
    $artistId = trim($input['id'] ?? $input['artist_id'] ?? '');
    $name = trim($input['name'] ?? '');
    $bio = isset($input['bio']) ? trim($input['bio']) : null;
    $avatarUrl = trim($input['avatar_url'] ?? '');
    $headerUrl = trim($input['header_url'] ?? $avatarUrl);
    $country = !empty($input['country']) ? strtoupper(substr(trim($input['country']), 0, 2)) : null;
    $verified = isset($input['verified']) ? (!empty($input['verified']) ? 1 : 0) : null;
    $isFeatured = isset($input['is_featured']) ? (!empty($input['is_featured']) ? 1 : 0) : null;
    $status = in_array($input['status'] ?? '', ['published', 'draft', 'hidden'], true) ? $input['status'] : null;
    $claimedStatus = in_array($input['claimed_status'] ?? '', ['unclaimed', 'pending', 'claimed', 'disputed'], true) ? $input['claimed_status'] : null;
    $distributorId = !empty($input['distributor_id']) ? trim($input['distributor_id']) : null;
    $labelId = !empty($input['label_id']) ? trim($input['label_id']) : null;
    $labelName = trim($input['label_name'] ?? '');
    $genres = isset($input['genres']) && is_array($input['genres']) ? $input['genres'] : (!empty($input['genre']) ? [trim($input['genre'])] : null);
    $socialLinks = isset($input['social_links']) && is_array($input['social_links']) ? $input['social_links'] : null;

    if (empty($artistId) && empty($name)) {
        json_response(['status' => 'error', 'message' => 'Artist name is required.'], 400);
    }

    if (!empty($labelId) && empty($labelName)) {
        $lStmt = $pdo->prepare("SELECT name FROM labels WHERE id = ? LIMIT 1");
        $lStmt->execute([$labelId]);
        $labelName = (string)($lStmt->fetchColumn() ?: '');
    }

    $distName = '';
    if (!empty($distributorId)) {
        $dStmt = $pdo->prepare("SELECT name FROM distributors WHERE id = ? LIMIT 1");
        $dStmt->execute([$distributorId]);
        $distName = (string)($dStmt->fetchColumn() ?: '');
    }

    if (empty($artistId)) {
        $artistId = 'art_' . bin2hex(random_bytes(6));
        $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name)) . '-' . rand(100, 999);
        $pdo->prepare("
            INSERT INTO artists (id, name, stage_name, slug, avatar_url, header_url, bio, country, verified, is_featured, status, genres_json, social_links_json, distributor_id, distributor_name, created_by_distributor, label_id, label_name, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            $artistId, $name, $name, $slug, $avatarUrl, $headerUrl, $bio ?? '', $country ?: 'US', $verified ?? 1, $isFeatured ?? 0, $status ?: 'published',
            json_encode($genres ?? []), json_encode($socialLinks ?? []), $distributorId, $distName ?: null, $distName ?: null, $labelId, $labelName ?: null, $admin['id']
        ]);
        Auth::logAudit($admin['id'], 'ADMIN_ARTIST_CREATED', 'ARTIST', $artistId, ['name' => $name]);
        json_response(['status' => 'success', 'message' => "Created artist profile '{$name}'.", 'artist_id' => $artistId]);
    } else {
        $pdo->prepare("
            UPDATE artists
            SET name = COALESCE(NULLIF(?, ''), name),
                stage_name = COALESCE(NULLIF(?, ''), stage_name),
                bio = COALESCE(?, bio),
                avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
                header_url = COALESCE(NULLIF(?, ''), header_url),
                country = COALESCE(NULLIF(?, ''), country),
                verified = COALESCE(?, verified),
                is_featured = COALESCE(?, is_featured),
                status = COALESCE(?, status),
                claimed_status = COALESCE(?, claimed_status),
                genres_json = COALESCE(?, genres_json),
                social_links_json = COALESCE(?, social_links_json),
                distributor_id = COALESCE(?, distributor_id),
                distributor_name = COALESCE(NULLIF(?, ''), distributor_name),
                label_id = COALESCE(?, label_id),
                label_name = COALESCE(NULLIF(?, ''), label_name)
            WHERE id = ?
        ")->execute([
            $name, $name, $bio, $avatarUrl, $headerUrl, $country, $verified, $isFeatured, $status, $claimedStatus,
            $genres !== null ? json_encode($genres) : null,
            $socialLinks !== null ? json_encode($socialLinks) : null,
            $distributorId, $distName, $labelId, $labelName, $artistId
        ]);
        if (!empty($name)) {
            $pdo->prepare("UPDATE tracks SET artist_name = ? WHERE artist_id = ?")->execute([$name, $artistId]);
            $pdo->prepare("UPDATE albums SET artist_name = ? WHERE artist_id = ?")->execute([$name, $artistId]);
        }

        Auth::logAudit($admin['id'], 'ADMIN_ARTIST_UPDATED', 'ARTIST', $artistId, ['name' => $name]);
        json_response(['status' => 'success', 'message' => "Updated artist profile.", 'artist_id' => $artistId]);
    }
}

if ($method === 'POST' && $action === 'delete_artist') {
    $artistId = trim($input['artist_id'] ?? $input['id'] ?? '');
    if (empty($artistId)) {
        json_response(['status' => 'error', 'message' => 'Missing artist_id'], 400);
    }
    $pdo->prepare("DELETE FROM artists WHERE id = ?")->execute([$artistId]);
    Auth::logAudit($admin['id'], 'ADMIN_ARTIST_DELETED', 'ARTIST', $artistId);
    json_response(['status' => 'success', 'message' => 'Artist profile deleted.']);
}

// --- 6. ALBUMS, EPs & SINGLES MANAGEMENT (CREATE, UPDATE, DELETE) ---
if ($method === 'POST' && ($action === 'save_album' || $action === 'update_album')) {
    $albumId = trim($input['id'] ?? $input['album_id'] ?? '');
    if (!empty($input['delete']) && !empty($albumId)) {
        $pdo->prepare("DELETE FROM albums WHERE id = ?")->execute([$albumId]);
        Auth::logAudit($admin['id'], 'ADMIN_ALBUM_DELETED', 'ALBUM', $albumId);
        json_response(['status' => 'success', 'message' => 'Album/release deleted.']);
    }

    $title = trim($input['title'] ?? '');
    $artistId = trim($input['artist_id'] ?? '');
    $artistName = trim($input['artist_name'] ?? '');
    $coverUrl = trim($input['cover_art_url'] ?? '');
    $releaseDate = !empty($input['release_date']) ? trim($input['release_date']) : null;
    $releaseType = in_array($input['release_type'] ?? '', ['album', 'ep', 'single'], true) ? $input['release_type'] : null;
    $genre = !empty($input['genre']) ? trim($input['genre']) : null;
    $status = in_array($input['status'] ?? '', ['published', 'draft', 'scheduled', 'archived'], true) ? $input['status'] : null;
    $isFeatured = isset($input['is_featured']) ? (!empty($input['is_featured']) ? 1 : 0) : null;
    $upc = isset($input['upc']) ? trim($input['upc']) : null;
    $distributorId = !empty($input['distributor_id']) ? trim($input['distributor_id']) : null;
    $labelId = !empty($input['label_id']) ? trim($input['label_id']) : null;

    if (!empty($artistId) && empty($artistName)) {
        $aStmt = $pdo->prepare("SELECT name FROM artists WHERE id = ? LIMIT 1");
        $aStmt->execute([$artistId]);
        $artistName = (string)($aStmt->fetchColumn() ?: '');
    }

    if (empty($albumId)) {
        if (empty($title) || empty($artistName)) {
            json_response(['status' => 'error', 'message' => 'Release title and artist are required.'], 400);
        }
        if (empty($artistId)) {
            $artistId = 'art_' . substr(md5(strtolower($artistName)), 0, 12);
        }
        $albumId = 'alb_' . bin2hex(random_bytes(6));
        $pdo->prepare("
            INSERT INTO albums (id, title, artist_id, artist_name, cover_art_url, release_date, release_type, genre, status, is_featured, upc, distributor_id, label_id, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            $albumId, $title, $artistId, $artistName, $coverUrl, $releaseDate ?: date('Y-m-d'), $releaseType ?: 'album', $genre ?: 'Afrobeats',
            $status ?: 'published', $isFeatured ?? 0, $upc ?: null, $distributorId, $labelId, $admin['id']
        ]);
        Auth::logAudit($admin['id'], 'ADMIN_ALBUM_CREATED', 'ALBUM', $albumId, ['title' => $title, 'type' => $releaseType ?: 'album']);
        json_response(['status' => 'success', 'message' => "Created release '{$title}'.", 'album_id' => $albumId]);
    } else {
        $pdo->prepare("
            UPDATE albums
            SET title = COALESCE(NULLIF(?, ''), title),
                artist_id = COALESCE(NULLIF(?, ''), artist_id),
                artist_name = COALESCE(NULLIF(?, ''), artist_name),
                cover_art_url = COALESCE(NULLIF(?, ''), cover_art_url),
                release_date = COALESCE(NULLIF(?, ''), release_date),
                release_type = COALESCE(?, release_type),
                genre = COALESCE(NULLIF(?, ''), genre),
                status = COALESCE(?, status),
                is_featured = COALESCE(?, is_featured),
                upc = COALESCE(?, upc),
                distributor_id = COALESCE(?, distributor_id),
                label_id = COALESCE(?, label_id)
            WHERE id = ?
        ")->execute([
            $title, $artistId, $artistName, $coverUrl, $releaseDate, $releaseType, $genre,
            $status, $isFeatured, $upc, $distributorId, $labelId, $albumId
        ]);
        if (!empty($title)) {
            $pdo->prepare("UPDATE tracks SET album_name = ? WHERE album_id = ?")->execute([$title, $albumId]);
        }
        Auth::logAudit($admin['id'], 'ADMIN_ALBUM_UPDATED', 'ALBUM', $albumId, ['title' => $title]);
        json_response(['status' => 'success', 'message' => "Updated release.", 'album_id' => $albumId]);
    }
}

if ($method === 'POST' && $action === 'delete_album') {
    $albumId = trim($input['album_id'] ?? $input['id'] ?? '');
    if (empty($albumId)) {
        json_response(['status' => 'error', 'message' => 'Missing album_id'], 400);
    }
    $pdo->prepare("DELETE FROM albums WHERE id = ?")->execute([$albumId]);
    Auth::logAudit($admin['id'], 'ADMIN_ALBUM_DELETED', 'ALBUM', $albumId);
    json_response(['status' => 'success', 'message' => 'Album/release deleted.']);
}

// --- 7. TRACKS & SONGS MANAGEMENT (CREATE, UPDATE, DELETE, BULK) ---
if ($method === 'POST' && ($action === 'save_track' || $action === 'update_track')) {
    $trackId = trim($input['track_id'] ?? $input['id'] ?? '');

    if (!empty($input['delete_permanently']) && !empty($trackId)) {
        $pdo->prepare("UPDATE tracks SET is_deleted = 1, status = 'removed' WHERE id = ?")->execute([$trackId]);
        Auth::logAudit($admin['id'], 'ADMIN_TRACK_DELETED', 'TRACK', $trackId);
        json_response(['status' => 'success', 'message' => 'Track removed from catalog.']);
    }
    if (!empty($input['restore']) && !empty($trackId)) {
        $pdo->prepare("UPDATE tracks SET is_deleted = 0, status = 'published' WHERE id = ?")->execute([$trackId]);
        Auth::logAudit($admin['id'], 'ADMIN_TRACK_RESTORED', 'TRACK', $trackId);
        json_response(['status' => 'success', 'message' => 'Track restored to catalog.']);
    }

    $title = trim($input['title'] ?? '');
    $artistId = trim($input['artist_id'] ?? '');
    $artistName = trim($input['artist_name'] ?? '');
    $albumId = !empty($input['album_id']) ? trim($input['album_id']) : null;
    $albumName = trim($input['album_name'] ?? '');
    $genre = trim($input['genre'] ?? '');
    $country = !empty($input['country']) ? strtoupper(substr(trim($input['country']), 0, 2)) : null;
    $releaseDate = !empty($input['release_date']) ? trim($input['release_date']) : null;
    $releaseYear = !empty($input['release_year']) ? (int)$input['release_year'] : ($releaseDate ? (int)substr($releaseDate, 0, 4) : null);
    $duration = !empty($input['duration']) ? (int)$input['duration'] : null;
    $explicit = isset($input['explicit']) ? (!empty($input['explicit']) ? 1 : 0) : null;
    $rawStatus = $input['status'] ?? null;
    if ($rawStatus === 'active') $rawStatus = 'published';
    $status = in_array($rawStatus, ['published', 'draft', 'hidden', 'removed'], true) ? $rawStatus : null;
    $featuredOnHome = isset($input['featured_on_home']) ? (!empty($input['featured_on_home']) ? 1 : 0) : null;
    $editorialBoost = isset($input['editorial_boost']) ? (int)$input['editorial_boost'] : null;
    $licenseStatus = isset($input['license_status']) ? trim($input['license_status']) : null;
    $licenseNotes = isset($input['license_notes']) ? trim($input['license_notes']) : null;
    $lyrics = isset($input['lyrics']) ? trim($input['lyrics']) : null;
    $coverUrl = trim($input['cover_art_url'] ?? '');
    $audioUrl = trim($input['audio_url'] ?? '');
    $videoUrl = trim($input['video_url'] ?? '');
    $videoId = !empty($input['video_id']) ? trim($input['video_id']) : null;
    $isrc = trim($input['isrc'] ?? '');
    $distributorId = !empty($input['distributor_id']) ? trim($input['distributor_id']) : null;
    $labelId = !empty($input['label_id']) ? trim($input['label_id']) : null;

    if (!empty($artistId) && empty($artistName)) {
        $aStmt = $pdo->prepare("SELECT name FROM artists WHERE id = ? LIMIT 1");
        $aStmt->execute([$artistId]);
        $artistName = (string)($aStmt->fetchColumn() ?: '');
    }

    if (empty($trackId)) {
        if (empty($title) || empty($artistName)) {
            json_response(['status' => 'error', 'message' => 'Track title and artist name are required.'], 400);
        }
        $trackId = 'trk_' . bin2hex(random_bytes(6));
        if (empty($artistId)) {
            $artistId = 'art_' . substr(md5(strtolower($artistName)), 0, 12);
        }
        if (empty($audioUrl)) {
            $audioUrl = '/phpbackend/api/stream.php?id=' . urlencode($trackId);
        }
        $pdo->prepare("
            INSERT INTO tracks (
                id, video_id, title, artist_id, artist_name, album_id, album_name, duration, genre, country,
                release_year, release_date, cover_art_url, audio_url, video_url, lyrics, isrc, explicit,
                status, featured_on_home, editorial_boost, license_status, license_notes, distributor_id, label_id, uploaded_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            $trackId, $videoId, $title, $artistId, $artistName, $albumId, $albumName ?: ($title . ' - Single'),
            $duration ?: 210, $genre ?: 'Afrobeats', $country ?: 'US', $releaseYear ?: (int)date('Y'), $releaseDate ?: date('Y-m-d'),
            $coverUrl, $audioUrl, $videoUrl ?: null,
            $lyrics, $isrc ?: null, $explicit ?? 0, $status ?: 'published', $featuredOnHome ?? 0, $editorialBoost ?? 0,
            $licenseStatus ?: 'verified_licensed', $licenseNotes ?: '',
            $distributorId, $labelId, $admin['id']
        ]);
        Auth::logAudit($admin['id'], 'ADMIN_TRACK_CREATED', 'TRACK', $trackId, ['title' => $title, 'artist' => $artistName]);
        json_response(['status' => 'success', 'message' => "Created track '{$title}'.", 'track_id' => $trackId]);
    } else {
        $pdo->prepare("
            UPDATE tracks
            SET title = COALESCE(NULLIF(?, ''), title),
                artist_id = COALESCE(NULLIF(?, ''), artist_id),
                artist_name = COALESCE(NULLIF(?, ''), artist_name),
                album_id = COALESCE(?, album_id),
                album_name = COALESCE(NULLIF(?, ''), album_name),
                genre = COALESCE(NULLIF(?, ''), genre),
                country = COALESCE(NULLIF(?, ''), country),
                release_year = COALESCE(?, release_year),
                duration = COALESCE(?, duration),
                cover_art_url = COALESCE(NULLIF(?, ''), cover_art_url),
                audio_url = COALESCE(NULLIF(?, ''), audio_url),
                video_url = COALESCE(NULLIF(?, ''), video_url),
                video_id = COALESCE(NULLIF(?, ''), video_id),
                lyrics = COALESCE(?, lyrics),
                isrc = COALESCE(NULLIF(?, ''), isrc),
                explicit = COALESCE(?, explicit),
                status = COALESCE(?, status),
                featured_on_home = COALESCE(?, featured_on_home),
                editorial_boost = COALESCE(?, editorial_boost),
                license_status = COALESCE(?, license_status),
                license_notes = COALESCE(?, license_notes),
                distributor_id = COALESCE(?, distributor_id),
                label_id = COALESCE(?, label_id)
            WHERE id = ?
        ")->execute([
            $title, $artistId, $artistName, $albumId, $albumName, $genre, $country, $releaseYear, $duration,
            $coverUrl, $audioUrl, $videoUrl, $videoId, $lyrics, $isrc, $explicit, $status, $featuredOnHome,
            $editorialBoost, $licenseStatus, $licenseNotes, $distributorId, $labelId, $trackId
        ]);
        Auth::logAudit($admin['id'], 'ADMIN_TRACK_UPDATED', 'TRACK', $trackId, ['title' => $title, 'status' => $status]);
        json_response(['status' => 'success', 'message' => "Updated track."]);
    }
}

if ($method === 'POST' && $action === 'delete_track') {
    $trackId = trim($input['track_id'] ?? $input['id'] ?? '');
    if (empty($trackId)) {
        json_response(['status' => 'error', 'message' => 'Missing track_id'], 400);
    }
    $pdo->prepare("UPDATE tracks SET is_deleted = 1, status = 'removed' WHERE id = ?")->execute([$trackId]);
    Auth::logAudit($admin['id'], 'ADMIN_TRACK_DELETED', 'TRACK', $trackId);
    json_response(['status' => 'success', 'message' => 'Track removed from catalog.']);
}

if ($method === 'POST' && $action === 'bulk_track_action') {
    $trackIds = is_array($input['track_ids'] ?? null) ? array_filter($input['track_ids']) : [];
    $bulkAction = trim($input['bulk_action'] ?? '');
    if (empty($trackIds) || empty($bulkAction)) {
        json_response(['status' => 'error', 'message' => 'Missing track_ids or bulk_action'], 400);
    }
    $in = implode(',', array_fill(0, count($trackIds), '?'));
    if ($bulkAction === 'publish') {
        $pdo->prepare("UPDATE tracks SET status = 'published', is_deleted = 0 WHERE id IN ($in)")->execute(array_values($trackIds));
    } elseif ($bulkAction === 'hide') {
        $pdo->prepare("UPDATE tracks SET status = 'hidden' WHERE id IN ($in)")->execute(array_values($trackIds));
    } elseif ($bulkAction === 'feature') {
        $pdo->prepare("UPDATE tracks SET featured_on_home = 1 WHERE id IN ($in)")->execute(array_values($trackIds));
    } elseif ($bulkAction === 'unfeature') {
        $pdo->prepare("UPDATE tracks SET featured_on_home = 0 WHERE id IN ($in)")->execute(array_values($trackIds));
    } elseif ($bulkAction === 'delete') {
        $pdo->prepare("UPDATE tracks SET is_deleted = 1, status = 'removed' WHERE id IN ($in)")->execute(array_values($trackIds));
    }
    Auth::logAudit($admin['id'], 'ADMIN_BULK_TRACK_' . strtoupper($bulkAction), 'TRACK', 'BULK', ['count' => count($trackIds)]);
    json_response(['status' => 'success', 'message' => 'Bulk action applied to ' . count($trackIds) . ' tracks.']);
}

// --- 8. PLAYLIST MANAGEMENT (CREATE, UPDATE, DELETE) ---
function syncAdminPlaylistTracks(PDO $pdo, string $playlistId, array $trackIds): array {
    $cleanIds = [];
    foreach ($trackIds as $tid) {
        $tid = trim((string)$tid);
        if ($tid !== '' && !in_array($tid, $cleanIds, true)) {
            $cleanIds[] = $tid;
        }
    }
    try {
        $pdo->prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?")->execute([$playlistId]);
        if (!empty($cleanIds)) {
            $ins = $pdo->prepare("INSERT IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)");
            foreach ($cleanIds as $idx => $tid) {
                $ins->execute([$playlistId, $tid, $idx]);
            }
        }
    } catch (Exception $e) {}
    return $cleanIds;
}

if ($method === 'POST' && ($action === 'save_playlist' || $action === 'update_playlist')) {
    $playlistId = trim($input['id'] ?? $input['playlist_id'] ?? '');
    if (!empty($input['delete']) && !empty($playlistId)) {
        $pdo->prepare("DELETE FROM playlists WHERE id = ?")->execute([$playlistId]);
        $pdo->prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?")->execute([$playlistId]);
        Auth::logAudit($admin['id'], 'ADMIN_PLAYLIST_DELETED', 'PLAYLIST', $playlistId);
        Auth::logUserActivity($admin, 'playlist_deleted', 'playlist', $playlistId, $playlistId, []);
        json_response(['status' => 'success', 'message' => 'Playlist deleted.']);
    }

    $title = trim($input['title'] ?? '');
    $description = isset($input['description']) ? trim($input['description']) : null;
    $coverUrl = trim($input['cover_art_url'] ?? '');
    $genreCategory = !empty($input['genre_category']) ? trim($input['genre_category']) : null;
    $isPublic = isset($input['is_public']) ? (!empty($input['is_public']) ? 1 : 0) : null;
    $isFeatured = isset($input['is_featured']) ? (!empty($input['is_featured']) ? 1 : 0) : null;
    $status = in_array($input['status'] ?? '', ['published', 'draft', 'hidden', 'active'], true) ? $input['status'] : null;
    $trackIds = is_array($input['track_ids'] ?? null) ? array_values(array_unique($input['track_ids'])) : null;

    if (empty($playlistId)) {
        if (empty($title)) {
            json_response(['status' => 'error', 'message' => 'Playlist title is required.'], 400);
        }
        $playlistId = 'ply_' . bin2hex(random_bytes(6));
        $cleanTracks = syncAdminPlaylistTracks($pdo, $playlistId, $trackIds ?? []);
        $pdo->prepare("
            INSERT INTO playlists (id, user_id, title, description, cover_art_url, genre_category, is_public, is_featured, status, track_ids_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            $playlistId, $admin['id'], $title, $description ?? '', $coverUrl, $genreCategory ?: 'all', $isPublic ?? 1, $isFeatured ?? 0, $status ?: 'published',
            json_encode($cleanTracks)
        ]);
        Auth::logAudit($admin['id'], 'ADMIN_PLAYLIST_CREATED', 'PLAYLIST', $playlistId, ['title' => $title]);
        Auth::logUserActivity($admin, 'playlist_created', 'playlist', $playlistId, $title, [
            'track_count' => count($cleanTracks),
            'is_public' => (bool)($isPublic ?? 1),
            'creator_role' => 'admin'
        ]);
        json_response(['status' => 'success', 'message' => "Created playlist '{$title}'.", 'playlist_id' => $playlistId]);
    } else {
        $sql = "
            UPDATE playlists
            SET title = COALESCE(NULLIF(?, ''), title),
                description = COALESCE(?, description),
                cover_art_url = COALESCE(NULLIF(?, ''), cover_art_url),
                genre_category = COALESCE(NULLIF(?, ''), genre_category),
                is_public = COALESCE(?, is_public),
                is_featured = COALESCE(?, is_featured),
                status = COALESCE(?, status)
        ";
        $params = [$title, $description, $coverUrl, $genreCategory, $isPublic, $isFeatured, $status];
        $cleanTracks = null;
        if ($trackIds !== null) {
            $cleanTracks = syncAdminPlaylistTracks($pdo, $playlistId, $trackIds);
            $sql .= ", track_ids_json = ?";
            $params[] = json_encode($cleanTracks);
        }
        $sql .= " WHERE id = ?";
        $params[] = $playlistId;
        $pdo->prepare($sql)->execute($params);

        Auth::logAudit($admin['id'], 'ADMIN_PLAYLIST_UPDATED', 'PLAYLIST', $playlistId, ['title' => $title]);
        Auth::logUserActivity($admin, 'playlist_updated', 'playlist', $playlistId, $title ?: $playlistId, [
            'track_count' => $cleanTracks !== null ? count($cleanTracks) : null
        ]);
        json_response(['status' => 'success', 'message' => "Updated playlist.", 'playlist_id' => $playlistId]);
    }
}

if ($method === 'POST' && $action === 'delete_playlist') {
    $playlistId = trim($input['playlist_id'] ?? $input['id'] ?? '');
    if (empty($playlistId)) {
        json_response(['status' => 'error', 'message' => 'Missing playlist_id'], 400);
    }
    $pdo->prepare("DELETE FROM playlists WHERE id = ?")->execute([$playlistId]);
    $pdo->prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?")->execute([$playlistId]);
    Auth::logAudit($admin['id'], 'ADMIN_PLAYLIST_DELETED', 'PLAYLIST', $playlistId);
    Auth::logUserActivity($admin, 'playlist_deleted', 'playlist', $playlistId, $playlistId, []);
    json_response(['status' => 'success', 'message' => 'Playlist deleted.']);
}

// --- 9. GENRE MANAGEMENT (CREATE, UPDATE, DELETE) ---
if ($method === 'POST' && $action === 'save_genre') {
    if (!empty($input['delete']) && !empty($input['id'])) {
        $pdo->prepare("DELETE FROM genres WHERE id = ?")->execute([trim($input['id'])]);
        json_response(['status' => 'success', 'message' => 'Genre deleted.']);
    }

    $genreId = trim($input['id'] ?? '');
    $name = trim($input['name'] ?? '');
    $color = trim($input['color'] ?? '#e11d48');
    $sortOrder = (int)($input['sort_order'] ?? $input['display_order'] ?? 10);
    $isActive = isset($input['is_active']) ? (!empty($input['is_active']) ? 1 : 0) : 1;

    if (empty($name)) {
        json_response(['status' => 'error', 'message' => 'Genre name is required.'], 400);
    }

    $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name));
    if (empty($genreId)) {
        $genreId = 'gen_' . $slug;
    }

    $pdo->prepare("
        INSERT INTO genres (id, name, slug, color, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            slug = VALUES(slug),
            color = VALUES(color),
            sort_order = VALUES(sort_order),
            is_active = VALUES(is_active)
    ")->execute([$genreId, $name, $slug, $color, $sortOrder, $isActive]);

    Auth::logAudit($admin['id'], 'ADMIN_GENRE_SAVED', 'GENRE', $genreId, ['name' => $name]);
    json_response(['status' => 'success', 'message' => "Saved genre '{$name}'.", 'genre_id' => $genreId]);
}

if ($method === 'POST' && $action === 'delete_genre') {
    $genreId = trim($input['id'] ?? $input['genre_id'] ?? '');
    if (empty($genreId)) {
        json_response(['status' => 'error', 'message' => 'Missing genre id'], 400);
    }
    $pdo->prepare("DELETE FROM genres WHERE id = ?")->execute([$genreId]);
    Auth::logAudit($admin['id'], 'ADMIN_GENRE_DELETED', 'GENRE', $genreId);
    json_response(['status' => 'success', 'message' => 'Genre deleted.']);
}

// --- 10. ARTIST CLAIMS & MODERATION ---
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
        json_response(['status' => 'error', 'message' => 'Claim not found'], 404);
    }

    $pdo->prepare("UPDATE artist_claims SET status = ?, review_notes = ?, reviewed_by = ? WHERE id = ?")
        ->execute([$decision === 'disputed' ? 'escalated' : $decision, $notes, $admin['id'], $claimId]);

    if ($decision === 'approved') {
        $pdo->prepare("UPDATE artists SET claimed_status = 'claimed', claimed_user_id = ?, verified = 1 WHERE id = ?")
            ->execute([$claim['user_id'], $claim['artist_id']]);
        $pdo->prepare("UPDATE users SET role = CASE WHEN role = 'listener' THEN 'artist' ELSE role END, artist_id = ? WHERE id = ?")
            ->execute([$claim['artist_id'], $claim['user_id']]);
    } elseif ($decision === 'rejected') {
        $pdo->prepare("UPDATE artists SET claimed_status = 'unclaimed' WHERE id = ?")->execute([$claim['artist_id']]);
    }

    Auth::logAudit($admin['id'], 'ADMIN_CLAIM_' . strtoupper($decision), 'CLAIM', $claimId, ['notes' => $notes]);
    json_response(['status' => 'success', 'message' => "Claim marked as {$decision}."]);
}

if ($method === 'POST' && ($action === 'create_flag' || $action === 'create_report')) {
    $targetType = trim($input['target_type'] ?? 'track');
    $targetId = trim($input['target_id'] ?? '');
    $reason = trim($input['reason'] ?? '');
    if (empty($reason)) {
        json_response(['status' => 'error', 'message' => 'Report reason is required.'], 400);
    }
    $flagId = 'flg_' . bin2hex(random_bytes(5));
    $pdo->prepare("
        INSERT INTO content_flags (id, reporter_user_id, target_type, target_id, reason, details, status)
        VALUES (?, ?, ?, ?, ?, ?, 'open')
    ")->execute([$flagId, $admin['id'], $targetType, $targetId ?: 'unspecified', $reason, trim($input['target_name'] ?? '')]);
    Auth::logAudit($admin['id'], 'ADMIN_FLAG_CREATED', 'CONTENT_FLAG', $flagId, ['target_id' => $targetId]);
    json_response(['status' => 'success', 'message' => 'Moderation case logged.', 'flag_id' => $flagId]);
}

if ($method === 'POST' && ($action === 'resolve_flag' || $action === 'resolve_report')) {
    $flagId = trim($input['flag_id'] ?? $input['report_id'] ?? '');
    $status = in_array($input['status'] ?? '', ['resolved', 'dismissed'], true) ? $input['status'] : 'resolved';
    $notes = trim($input['notes'] ?? $input['resolution_notes'] ?? '');

    $pdo->prepare("UPDATE content_flags SET status = ?, resolution_notes = ?, resolved_by = ? WHERE id = ?")
        ->execute([$status, $notes, $admin['id'], $flagId]);

    Auth::logAudit($admin['id'], 'ADMIN_FLAG_' . strtoupper($status), 'CONTENT_FLAG', $flagId, ['notes' => $notes]);
    json_response(['status' => 'success', 'message' => "Content report marked as {$status}."]);
}

if ($method === 'POST' && $action === 'clear_security_events') {
    $pdo->exec("DELETE FROM security_events");
    Auth::logAudit($admin['id'], 'ADMIN_SECURITY_EVENTS_CLEARED', 'SECURITY', 'ALL');
    json_response(['status' => 'success', 'message' => 'Security events log cleared.']);
}

// --- 11. SYSTEM SETTINGS ---
if ($method === 'POST' && ($action === 'save_settings' || $action === 'update_settings')) {
    $settings = $input['settings'] ?? $input;
    if (!is_array($settings)) {
        json_response(['status' => 'error', 'message' => 'Invalid settings payload'], 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO system_settings (setting_key, setting_value, updated_by)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
            setting_value = VALUES(setting_value),
            updated_by = VALUES(updated_by)
    ");

    foreach ($settings as $k => $v) {
        if ($k === 'csrf_token') continue;
        $cleanKey = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$k);
        if (!empty($cleanKey) && (is_scalar($v) || $v === null)) {
            $stmt->execute([$cleanKey, (string)$v, $admin['id']]);
        }
    }

    Auth::logAudit($admin['id'], 'ADMIN_SETTINGS_UPDATED', 'SYSTEM', 'SETTINGS', array_keys($settings));
    json_response(['status' => 'success', 'message' => 'Platform settings saved to database.']);
}

// --- 12. ADMIN VISIBILITY: SEARCHABLE, PAGINATED PLAYLISTS & PLAYLIST CONTENTS ---
if ($method === 'GET' && $action === 'playlists') {
    $q = trim($_GET['q'] ?? '');
    $creatorType = strtolower(trim($_GET['creator_type'] ?? 'all')); // all | admin | user
    $visibility = strtolower(trim($_GET['visibility'] ?? 'all')); // all | public | private
    $filterUserId = trim($_GET['user_id'] ?? '');
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(5, (int)($_GET['per_page'] ?? 25)));
    $offset = ($page - 1) * $perPage;

    $where = ["1=1"];
    $params = [];

    if ($q !== '') {
        $where[] = "(p.title LIKE ? OR p.description LIKE ? OR u.display_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)";
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like, $like, $like);
    }
    if ($creatorType === 'admin') {
        $where[] = "(u.role = 'admin' OR p.user_id IS NULL OR p.user_id = '')";
    } elseif ($creatorType === 'user') {
        $where[] = "(u.role IS NOT NULL AND u.role != 'admin')";
    }
    if ($visibility === 'public') {
        $where[] = "p.is_public = 1";
    } elseif ($visibility === 'private') {
        $where[] = "p.is_public = 0";
    }
    if ($filterUserId !== '') {
        $where[] = "p.user_id = ?";
        $params[] = $filterUserId;
    }

    $whereSql = implode(' AND ', $where);

    $cntStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM playlists p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE $whereSql
    ");
    $cntStmt->execute($params);
    $total = (int)$cntStmt->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT p.*,
               COALESCE(NULLIF(u.display_name, ''), u.username, 'Flontmie Admin') AS creator_name,
               u.username AS creator_username,
               u.email AS creator_email,
               COALESCE(u.role, 'admin') AS creator_role,
               u.avatar_url AS creator_avatar
        FROM playlists p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE $whereSql
        ORDER BY p.created_at DESC
        LIMIT $perPage OFFSET $offset
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$r) {
        $r['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($r['cover_art_url'] ?? '', $r['id']);
        $tIds = !empty($r['track_ids_json']) ? json_decode($r['track_ids_json'], true) : [];
        if (!is_array($tIds) || empty($tIds)) {
            try {
                $ptSt = $pdo->prepare("SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC");
                $ptSt->execute([$r['id']]);
                $tIds = array_column($ptSt->fetchAll(), 'track_id');
            } catch (Exception $e) {
                $tIds = [];
            }
        }
        $r['track_ids'] = is_array($tIds) ? array_values($tIds) : [];
        $r['track_count'] = count($r['track_ids']);
        $r['is_admin_created'] = (($r['creator_role'] ?? '') === 'admin') || empty($r['user_id']);
    }

    $summaryAll = (int)$pdo->query("SELECT COUNT(*) FROM playlists")->fetchColumn();
    $summaryAdmin = (int)$pdo->query("SELECT COUNT(*) FROM playlists p LEFT JOIN users u ON p.user_id = u.id WHERE u.role = 'admin' OR p.user_id IS NULL OR p.user_id = ''")->fetchColumn();
    $summaryUser = max(0, $summaryAll - $summaryAdmin);
    $summaryPublic = (int)$pdo->query("SELECT COUNT(*) FROM playlists WHERE is_public = 1")->fetchColumn();
    $summaryPrivate = max(0, $summaryAll - $summaryPublic);

    json_response([
        'status' => 'success',
        'playlists' => $rows,
        'total' => $total,
        'page' => $page,
        'per_page' => $perPage,
        'total_pages' => max(1, (int)ceil($total / $perPage)),
        'summary' => [
            'total_all' => $summaryAll,
            'total_playlists' => $summaryAll,
            'admin_created' => $summaryAdmin,
            'admin_playlists_count' => $summaryAdmin,
            'user_created' => $summaryUser,
            'user_playlists_count' => $summaryUser,
            'public_count' => $summaryPublic,
            'public_playlists_count' => $summaryPublic,
            'private_count' => $summaryPrivate,
            'private_playlists_count' => $summaryPrivate
        ]
    ]);
}

if ($method === 'GET' && $action === 'playlist_detail') {
    $playlistId = trim($_GET['playlist_id'] ?? $_GET['id'] ?? '');
    if ($playlistId === '') {
        json_response(['status' => 'error', 'message' => 'playlist_id is required'], 400);
    }

    $stmt = $pdo->prepare("
        SELECT p.*,
               COALESCE(NULLIF(u.display_name, ''), u.username, 'Flontmie Admin') AS creator_name,
               u.username AS creator_username,
               u.email AS creator_email,
               COALESCE(u.role, 'admin') AS creator_role,
               u.avatar_url AS creator_avatar,
               u.status AS creator_status
        FROM playlists p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
        LIMIT 1
    ");
    $stmt->execute([$playlistId]);
    $pl = $stmt->fetch();
    if (!$pl) {
        json_response(['status' => 'error', 'message' => 'Playlist not found'], 404);
    }

    $pl['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($pl['cover_art_url'] ?? '', $pl['id']);
    $pl['is_admin_created'] = (($pl['creator_role'] ?? '') === 'admin') || empty($pl['user_id']);
    $pl['creator'] = [
        'id' => $pl['user_id'] ?? null,
        'display_name' => $pl['creator_name'] ?? 'Flontmie Admin',
        'username' => $pl['creator_username'] ?? 'admin',
        'email' => $pl['creator_email'] ?? '',
        'role' => $pl['creator_role'] ?? 'admin',
        'status' => $pl['creator_status'] ?? 'active'
    ];

    // Resolve ordered tracks and added_at timestamps from playlist_tracks + track_ids_json
    $ptMap = [];
    $ptOrderedIds = [];
    try {
        $ptSt = $pdo->prepare("SELECT track_id, position, added_at FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC");
        $ptSt->execute([$playlistId]);
        foreach ($ptSt->fetchAll() as $ptRow) {
            $ptMap[$ptRow['track_id']] = $ptRow;
            $ptOrderedIds[] = $ptRow['track_id'];
        }
    } catch (Exception $e) {}

    $jsonIds = !empty($pl['track_ids_json']) ? json_decode($pl['track_ids_json'], true) : [];
    $orderedIds = (is_array($jsonIds) && !empty($jsonIds)) ? array_values(array_filter(array_map('strval', $jsonIds))) : $ptOrderedIds;

    $pl['track_ids'] = $orderedIds;
    $pl['track_count'] = count($orderedIds);

    $tracks = [];
    if (!empty($orderedIds)) {
        $placeholders = implode(',', array_fill(0, count($orderedIds), '?'));
        $params = array_merge($orderedIds, $orderedIds);
        $tStmt = $pdo->prepare("
            SELECT t.id, t.video_id, t.title, t.artist_id, t.artist_name, t.album_id, t.album_name,
                   t.duration, t.genre, t.release_year, t.cover_art_url, t.local_video_path, t.video_url,
                   t.flontmie_plays, t.stream_count, t.status, t.created_at,
                   (SELECT COUNT(*) FROM user_favorites uf WHERE uf.track_id = t.id) AS likes_count,
                   (SELECT COUNT(*) FROM track_comments tc WHERE tc.track_id = t.id) AS comments_count
            FROM tracks t
            WHERE (t.id IN ($placeholders) OR t.video_id IN ($placeholders))
        ");
        $tStmt->execute($params);
        $rows = $tStmt->fetchAll();

        $byId = [];
        foreach ($rows as $r) {
            $r['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($r['cover_art_url'] ?? '', $r['video_id'] ?? $r['id']);
            $r['audio_url'] = '/phpbackend/api/stream.php?id=' . urlencode($r['id']);
            $r['album_title'] = $r['album_name'] ?? '';
            $r['likes_count'] = (int)($r['likes_count'] ?? 0);
            $r['comments_count'] = (int)($r['comments_count'] ?? 0);
            $r['flontmie_plays'] = (int)($r['flontmie_plays'] ?? 0);
            $r['stream_count'] = (int)($r['flontmie_plays'] ?? $r['stream_count'] ?? 0);
            unset($r['local_video_path']);
            $byId[$r['id']] = $r;
            if (!empty($r['video_id'])) {
                $byId[$r['video_id']] = $r;
            }
        }

        $pos = 1;
        foreach ($orderedIds as $tid) {
            if (isset($byId[$tid])) {
                $item = $byId[$tid];
                $item['position'] = $pos++;
                $item['added_at'] = $ptMap[$tid]['added_at'] ?? ($ptMap[$item['id']]['added_at'] ?? $pl['created_at']);
                $tracks[] = $item;
            } else {
                $tracks[] = [
                    'position' => $pos++,
                    'id' => $tid,
                    'title' => 'Unavailable / Removed Track (' . $tid . ')',
                    'artist_name' => 'Unknown',
                    'album_name' => '',
                    'album_title' => '',
                    'duration' => 0,
                    'genre' => '',
                    'likes_count' => 0,
                    'comments_count' => 0,
                    'flontmie_plays' => 0,
                    'stream_count' => 0,
                    'added_at' => $ptMap[$tid]['added_at'] ?? $pl['created_at']
                ];
            }
        }
    }

    json_response([
        'status' => 'success',
        'playlist' => $pl,
        'tracks' => $tracks
    ]);
}

// --- 13. ADMIN VISIBILITY: USER ACTIVITY LOGS & FILTERS ---
if ($method === 'GET' && $action === 'activities') {
    $q = trim($_GET['q'] ?? '');
    $filterUserId = trim($_GET['user_id'] ?? '');
    $actionType = trim($_GET['action_type'] ?? '');
    $targetType = trim($_GET['target_type'] ?? '');
    $dateFrom = trim($_GET['date_from'] ?? '');
    $dateTo = trim($_GET['date_to'] ?? '');
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(5, (int)($_GET['per_page'] ?? 30)));
    $offset = ($page - 1) * $perPage;

    $where = ["1=1"];
    $params = [];

    if ($q !== '') {
        $where[] = "(ua.target_title LIKE ? OR ua.action_type LIKE ? OR ua.user_name LIKE ? OR ua.user_email LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)";
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like, $like, $like, $like);
    }
    if ($filterUserId !== '') {
        $where[] = "ua.user_id = ?";
        $params[] = $filterUserId;
    }
    if ($actionType !== '' && $actionType !== 'all') {
        $where[] = "ua.action_type = ?";
        $params[] = $actionType;
    }
    if ($targetType !== '' && $targetType !== 'all') {
        $where[] = "ua.target_type = ?";
        $params[] = $targetType;
    }
    if ($dateFrom !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
        $where[] = "ua.created_at >= ?";
        $params[] = $dateFrom . ' 00:00:00';
    }
    if ($dateTo !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
        $where[] = "ua.created_at <= ?";
        $params[] = $dateTo . ' 23:59:59';
    }

    $whereSql = implode(' AND ', $where);

    $cntStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM user_activities ua
        LEFT JOIN users u ON ua.user_id = u.id
        WHERE $whereSql
    ");
    $cntStmt->execute($params);
    $total = (int)$cntStmt->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT ua.id, ua.user_id,
               COALESCE(NULLIF(u.display_name, ''), ua.user_name, u.username, 'User') AS user_name,
               COALESCE(NULLIF(u.display_name, ''), ua.user_name, u.username, 'User') AS display_name,
               COALESCE(u.email, ua.user_email, '') AS user_email,
               COALESCE(u.email, ua.user_email, '') AS email,
               COALESCE(u.role, ua.user_role, 'listener') AS user_role,
               COALESCE(u.role, ua.user_role, 'listener') AS role,
               u.username AS user_username,
               ua.action_type, ua.target_type, ua.target_id, ua.target_title, ua.metadata_json, ua.ip_address, ua.created_at
        FROM user_activities ua
        LEFT JOIN users u ON ua.user_id = u.id
        WHERE $whereSql
        ORDER BY ua.created_at DESC
        LIMIT $perPage OFFSET $offset
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$r) {
        $meta = !empty($r['metadata_json']) ? json_decode($r['metadata_json'], true) : [];
        if (is_array($meta)) {
            unset($meta['password'], $meta['token'], $meta['csrf_token']);
        } else {
            $meta = [];
        }
        $r['metadata'] = $meta;
    }

    $actionTypes = [];
    try {
        $actionTypes = array_column($pdo->query("SELECT DISTINCT action_type FROM user_activities ORDER BY action_type ASC")->fetchAll(), 'action_type');
    } catch (Exception $e) {}

    json_response([
        'status' => 'success',
        'activities' => $rows,
        'total' => $total,
        'page' => $page,
        'per_page' => $perPage,
        'total_pages' => max(1, (int)ceil($total / $perPage)),
        'action_types' => $actionTypes
    ]);
}

// --- 14. ADMIN VISIBILITY: USER PROFILE CREATIONS & ACTIVITY HISTORY ---
if ($method === 'GET' && $action === 'user_detail') {
    $targetUserId = trim($_GET['user_id'] ?? $_GET['id'] ?? '');
    if ($targetUserId === '') {
        json_response(['status' => 'error', 'message' => 'user_id is required'], 400);
    }

    $uStmt = $pdo->prepare("
        SELECT id, username, email, role, status, display_name, avatar_url, bio, country,
               distributor_id, label_id, artist_id, email_verified, last_login_at, created_at
        FROM users
        WHERE id = ?
        LIMIT 1
    ");
    $uStmt->execute([$targetUserId]);
    $userRow = $uStmt->fetch();
    if (!$userRow) {
        json_response(['status' => 'error', 'message' => 'User not found'], 404);
    }

    // 1. User's created playlists
    $plStmt = $pdo->prepare("
        SELECT id, user_id, title, description, cover_art_url, genre_category, is_public, is_featured, status, track_ids_json, created_at, updated_at
        FROM playlists
        WHERE user_id = ?
        ORDER BY created_at DESC
    ");
    $plStmt->execute([$targetUserId]);
    $userPlaylists = $plStmt->fetchAll();
    foreach ($userPlaylists as &$pl) {
        $pl['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($pl['cover_art_url'] ?? '', $pl['id']);
        $tIds = !empty($pl['track_ids_json']) ? json_decode($pl['track_ids_json'], true) : [];
        $pl['track_ids'] = is_array($tIds) ? array_values($tIds) : [];
        $pl['track_count'] = count($pl['track_ids']);
        $pl['is_admin_created'] = ($userRow['role'] === 'admin');
    }

    // 2. User's liked tracks
    $likesStmt = $pdo->prepare("
        SELECT uf.track_id AS id, uf.track_id, uf.created_at AS liked_at,
               t.title, t.artist_name, t.album_name, t.genre, t.cover_art_url,
               (SELECT COUNT(*) FROM user_favorites uf2 WHERE uf2.track_id = t.id) AS likes_count
        FROM user_favorites uf
        LEFT JOIN tracks t ON uf.track_id = t.id
        WHERE uf.user_id = ?
        ORDER BY uf.created_at DESC
        LIMIT 200
    ");
    $likesStmt->execute([$targetUserId]);
    $userLikes = $likesStmt->fetchAll();
    foreach ($userLikes as &$lk) {
        $lk['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($lk['cover_art_url'] ?? '', $lk['track_id']);
    }

    // 3. User's comments
    $cStmt = $pdo->prepare("
        SELECT tc.id, tc.track_id, COALESCE(NULLIF(tc.comment_text, ''), tc.body, '') AS comment_text,
               COALESCE(NULLIF(tc.body, ''), tc.comment_text, '') AS body, tc.created_at,
               t.title AS track_title, t.artist_name
        FROM track_comments tc
        LEFT JOIN tracks t ON tc.track_id = t.id
        WHERE tc.user_id = ?
        ORDER BY tc.created_at DESC
        LIMIT 200
    ");
    $cStmt->execute([$targetUserId]);
    $userComments = $cStmt->fetchAll();

    // 4. User's followed artists
    $fStmt = $pdo->prepare("
        SELECT ufa.artist_id, ufa.created_at, ufa.created_at AS followed_at,
               a.name AS artist_name, a.avatar_url, a.country
        FROM user_followed_artists ufa
        LEFT JOIN artists a ON ufa.artist_id = a.id
        WHERE ufa.user_id = ?
        ORDER BY ufa.created_at DESC
        LIMIT 200
    ");
    $fStmt->execute([$targetUserId]);
    $userFollows = $fStmt->fetchAll();

    // 5. User's uploaded tracks
    $upStmt = $pdo->prepare("
        SELECT id, title, artist_name, album_name, genre, duration, flontmie_plays,
               (SELECT COUNT(*) FROM user_favorites uf WHERE uf.track_id = tracks.id) AS likes_count,
               (SELECT COUNT(*) FROM track_comments tc WHERE tc.track_id = tracks.id) AS comments_count,
               status, created_at
        FROM tracks
        WHERE uploaded_by_user_id = ? AND is_deleted = 0
        ORDER BY created_at DESC
        LIMIT 200
    ");
    $upStmt->execute([$targetUserId]);
    $userUploads = $upStmt->fetchAll();

    // 6. Paginated & filterable activity history for this user
    $actType = trim($_GET['action_type'] ?? '');
    $dateFrom = trim($_GET['date_from'] ?? '');
    $dateTo = trim($_GET['date_to'] ?? '');
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(5, (int)($_GET['per_page'] ?? 25)));
    $offset = ($page - 1) * $perPage;

    $actWhere = ["user_id = ?"];
    $actParams = [$targetUserId];
    if ($actType !== '' && $actType !== 'all') {
        $actWhere[] = "action_type = ?";
        $actParams[] = $actType;
    }
    if ($dateFrom !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
        $actWhere[] = "created_at >= ?";
        $actParams[] = $dateFrom . ' 00:00:00';
    }
    if ($dateTo !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
        $actWhere[] = "created_at <= ?";
        $actParams[] = $dateTo . ' 23:59:59';
    }
    $actWhereSql = implode(' AND ', $actWhere);

    $actCntStmt = $pdo->prepare("SELECT COUNT(*) FROM user_activities WHERE $actWhereSql");
    $actCntStmt->execute($actParams);
    $actTotal = (int)$actCntStmt->fetchColumn();

    $actStmt = $pdo->prepare("
        SELECT id, user_id, action_type, target_type, target_id, target_title, metadata_json, ip_address, created_at
        FROM user_activities
        WHERE $actWhereSql
        ORDER BY created_at DESC
        LIMIT $perPage OFFSET $offset
    ");
    $actStmt->execute($actParams);
    $activities = $actStmt->fetchAll();
    foreach ($activities as &$act) {
        $act['metadata'] = !empty($act['metadata_json']) ? json_decode($act['metadata_json'], true) : [];
    }

    json_response([
        'status' => 'success',
        'user' => $userRow,
        'summary' => [
            'playlists_count' => count($userPlaylists),
            'likes_count' => count($userLikes),
            'comments_count' => count($userComments),
            'follows_count' => count($userFollows),
            'followed_artists_count' => count($userFollows),
            'uploads_count' => count($userUploads),
            'uploaded_tracks_count' => count($userUploads),
            'activities_count' => $actTotal
        ],
        'creations' => [
            'playlists' => $userPlaylists,
            'liked_tracks' => $userLikes,
            'comments' => $userComments,
            'followed_artists' => $userFollows,
            'uploaded_tracks' => $userUploads
        ],
        'playlists' => $userPlaylists,
        'likes' => $userLikes,
        'comments' => $userComments,
        'follows' => $userFollows,
        'uploads' => $userUploads,
        'activities' => [
            'items' => $activities,
            'total' => $actTotal,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => max(1, (int)ceil($actTotal / $perPage))
        ],
        'activities_list' => $activities
    ]);
}

// --- 15. ADMIN VISIBILITY: ENGAGEMENT (ACTUAL LIKE & COMMENT TOTALS & RECORDS) ---
if ($method === 'GET' && $action === 'engagement') {
    $q = trim($_GET['q'] ?? '');
    $filterTrackId = trim($_GET['track_id'] ?? '');
    $filterUserId = trim($_GET['user_id'] ?? '');
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(5, (int)($_GET['per_page'] ?? 25)));
    $offset = ($page - 1) * $perPage;

    $totalLikes = (int)$pdo->query("SELECT COUNT(*) FROM user_favorites")->fetchColumn();
    $totalComments = (int)$pdo->query("SELECT COUNT(*) FROM track_comments")->fetchColumn();
    $uniqueLikers = (int)$pdo->query("SELECT COUNT(DISTINCT user_id) FROM user_favorites")->fetchColumn();
    $uniqueCommenters = (int)$pdo->query("SELECT COUNT(DISTINCT user_id) FROM track_comments")->fetchColumn();

    // 1. Track breakdown
    $tWhere = ["t.is_deleted = 0"];
    $tParams = [];
    if ($q !== '') {
        $tWhere[] = "(t.title LIKE ? OR t.artist_name LIKE ? OR t.album_name LIKE ?)";
        $like = '%' . $q . '%';
        array_push($tParams, $like, $like, $like);
    }
    if ($filterTrackId !== '') {
        $tWhere[] = "t.id = ?";
        $tParams[] = $filterTrackId;
    }
    $tWhereSql = implode(' AND ', $tWhere);

    $tStmt = $pdo->prepare("
        SELECT t.id, t.title, t.artist_id, t.artist_name, t.album_name, t.genre, t.cover_art_url, t.flontmie_plays,
               (SELECT COUNT(*) FROM user_favorites uf WHERE uf.track_id = t.id) AS likes_count,
               (SELECT COUNT(*) FROM track_comments tc WHERE tc.track_id = t.id) AS comments_count
        FROM tracks t
        WHERE $tWhereSql
        ORDER BY likes_count DESC, comments_count DESC, t.flontmie_plays DESC
        LIMIT $perPage OFFSET $offset
    ");
    $tStmt->execute($tParams);
    $trackBreakdown = $tStmt->fetchAll();
    foreach ($trackBreakdown as &$tb) {
        $tb['cover_art_url'] = ArtistEnrichment::resolveArtworkUrl($tb['cover_art_url'] ?? '', $tb['id']);
        $tb['likes_count'] = (int)($tb['likes_count'] ?? 0);
        $tb['comments_count'] = (int)($tb['comments_count'] ?? 0);
        $tb['flontmie_plays'] = (int)($tb['flontmie_plays'] ?? 0);
    }

    // 2. Likes records
    $lWhere = ["1=1"];
    $lParams = [];
    if ($q !== '') {
        $lWhere[] = "(t.title LIKE ? OR t.artist_name LIKE ? OR u.display_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)";
        $like = '%' . $q . '%';
        array_push($lParams, $like, $like, $like, $like, $like);
    }
    if ($filterTrackId !== '') {
        $lWhere[] = "uf.track_id = ?";
        $lParams[] = $filterTrackId;
    }
    if ($filterUserId !== '') {
        $lWhere[] = "uf.user_id = ?";
        $lParams[] = $filterUserId;
    }
    $lWhereSql = implode(' AND ', $lWhere);

    $lCntStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM user_favorites uf
        LEFT JOIN users u ON uf.user_id = u.id
        LEFT JOIN tracks t ON uf.track_id = t.id
        WHERE $lWhereSql
    ");
    $lCntStmt->execute($lParams);
    $likesFilteredTotal = (int)$lCntStmt->fetchColumn();

    $lStmt = $pdo->prepare("
        SELECT uf.user_id, uf.track_id, uf.created_at,
               COALESCE(NULLIF(u.display_name, ''), u.username, 'Listener') AS display_name,
               COALESCE(NULLIF(u.display_name, ''), u.username, 'Listener') AS user_name,
               u.username AS username,
               u.email AS email,
               COALESCE(u.role, 'listener') AS user_role,
               COALESCE(t.title, uf.track_id) AS track_title,
               COALESCE(t.artist_name, '') AS artist_name
        FROM user_favorites uf
        LEFT JOIN users u ON uf.user_id = u.id
        LEFT JOIN tracks t ON uf.track_id = t.id
        WHERE $lWhereSql
        ORDER BY uf.created_at DESC
        LIMIT $perPage OFFSET $offset
    ");
    $lStmt->execute($lParams);
    $likesRecords = $lStmt->fetchAll();

    // 3. Comments records
    $cWhere = ["1=1"];
    $cParams = [];
    if ($q !== '') {
        $cWhere[] = "(tc.body LIKE ? OR tc.comment_text LIKE ? OR t.title LIKE ? OR t.artist_name LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)";
        $like = '%' . $q . '%';
        array_push($cParams, $like, $like, $like, $like, $like, $like);
    }
    if ($filterTrackId !== '') {
        $cWhere[] = "tc.track_id = ?";
        $cParams[] = $filterTrackId;
    }
    if ($filterUserId !== '') {
        $cWhere[] = "tc.user_id = ?";
        $cParams[] = $filterUserId;
    }
    $cWhereSql = implode(' AND ', $cWhere);

    $cCntStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM track_comments tc
        LEFT JOIN users u ON tc.user_id = u.id
        LEFT JOIN tracks t ON tc.track_id = t.id
        WHERE $cWhereSql
    ");
    $cCntStmt->execute($cParams);
    $commentsFilteredTotal = (int)$cCntStmt->fetchColumn();

    $cStmt = $pdo->prepare("
        SELECT tc.id, tc.track_id, tc.user_id,
               COALESCE(NULLIF(tc.comment_text, ''), tc.body, '') AS comment_text,
               COALESCE(NULLIF(tc.body, ''), tc.comment_text, '') AS body,
               tc.created_at,
               COALESCE(NULLIF(u.display_name, ''), u.username, 'Listener') AS display_name,
               COALESCE(NULLIF(u.display_name, ''), u.username, 'Listener') AS user_name,
               u.username AS username,
               u.email AS email,
               COALESCE(u.role, 'listener') AS user_role,
               COALESCE(t.title, tc.track_id) AS track_title,
               COALESCE(t.artist_name, '') AS artist_name
        FROM track_comments tc
        LEFT JOIN users u ON tc.user_id = u.id
        LEFT JOIN tracks t ON tc.track_id = t.id
        WHERE $cWhereSql
        ORDER BY tc.created_at DESC
        LIMIT $perPage OFFSET $offset
    ");
    $cStmt->execute($cParams);
    $commentsRecords = $cStmt->fetchAll();

    json_response([
        'status' => 'success',
        'totals' => [
            'total_likes' => $totalLikes,
            'total_comments' => $totalComments,
            'unique_likers' => $uniqueLikers,
            'unique_commenters' => $uniqueCommenters
        ],
        'summary' => [
            'total_likes' => $totalLikes,
            'total_comments' => $totalComments,
            'unique_likers' => $uniqueLikers,
            'unique_commenters' => $uniqueCommenters
        ],
        'tracks_engagement' => $trackBreakdown,
        'track_breakdown' => $trackBreakdown,
        'likes' => [
            'items' => $likesRecords,
            'total' => $likesFilteredTotal
        ],
        'comments' => [
            'items' => $commentsRecords,
            'total' => $commentsFilteredTotal
        ],
        'page' => $page,
        'per_page' => $perPage
    ]);
}

if ($method === 'POST' && $action === 'delete_comment') {
    $commentId = trim((string)($input['comment_id'] ?? $input['id'] ?? ''));
    if ($commentId === '') {
        json_response(['status' => 'error', 'message' => 'Valid comment_id is required'], 400);
    }

    $cStmt = $pdo->prepare("SELECT * FROM track_comments WHERE id = ? LIMIT 1");
    $cStmt->execute([$commentId]);
    $comment = $cStmt->fetch();
    if (!$comment) {
        json_response(['status' => 'error', 'message' => 'Comment not found'], 404);
    }

    $trackId = $comment['track_id'];
    $pdo->prepare("DELETE FROM track_comments WHERE id = ?")->execute([$commentId]);

    $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM track_comments WHERE track_id = ?");
    $cntStmt->execute([$trackId]);
    $commentsCount = (int)$cntStmt->fetchColumn();
    $pdo->prepare("UPDATE tracks SET comments_count = ? WHERE id = ?")->execute([$commentsCount, $trackId]);

    Auth::logAudit($admin['id'], 'ADMIN_COMMENT_DELETED', 'COMMENT', (string)$commentId, ['track_id' => $trackId]);
    Auth::logUserActivity($admin, 'comment_deleted', 'track', $trackId, $trackId, ['comment_id' => $commentId]);

    json_response([
        'status' => 'success',
        'message' => 'Comment deleted and track comment count synchronized.',
        'comment_id' => $commentId,
        'track_id' => $trackId,
        'comments_count' => $commentsCount
    ]);
}

json_response(['status' => 'error', 'message' => 'Invalid admin action or HTTP method'], 400);
