<?php
/**
 * Flontmie API - Authentication, Registration & Session Security Controller
 * Enforces Listener-only public registration, database-backed sessions, and real user profile telemetry.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$input = get_json_input();
$pdo = Database::getConnection();

function enrichUserPayload(PDO $pdo, array $u): array {
    unset($u['password_hash'], $u['verification_token'], $u['reset_token'], $u['reset_expires']);

    // Resolve distributor name if linked
    $u['distributor_name'] = null;
    if (!empty($u['distributor_id'])) {
        try {
            $st = $pdo->prepare("SELECT name FROM distributors WHERE id = ? LIMIT 1");
            $st->execute([$u['distributor_id']]);
            $row = $st->fetch();
            if ($row) {
                $u['distributor_name'] = $row['name'];
            }
        } catch (Exception $e) {}
    }

    // Resolve label name if linked
    $u['label_name'] = null;
    if (!empty($u['label_id'])) {
        try {
            $st = $pdo->prepare("SELECT name FROM labels WHERE id = ? LIMIT 1");
            $st->execute([$u['label_id']]);
            $row = $st->fetch();
            if ($row) {
                $u['label_name'] = $row['name'];
            }
        } catch (Exception $e) {}
    }

    // Resolve artist name if linked
    $u['artist_name'] = null;
    if (!empty($u['artist_id'])) {
        try {
            $st = $pdo->prepare("SELECT name FROM artists WHERE id = ? LIMIT 1");
            $st->execute([$u['artist_id']]);
            $row = $st->fetch();
            if ($row) {
                $u['artist_name'] = $row['name'];
            }
        } catch (Exception $e) {}
    }

    // Real streams logged by this user
    $u['streams_logged'] = 0;
    try {
        $st = $pdo->prepare("SELECT COUNT(*) FROM user_history WHERE user_id = ?");
        $st->execute([$u['id']]);
        $u['streams_logged'] = (int)$st->fetchColumn();
    } catch (Exception $e) {}

    // Real liked track IDs
    $u['liked_track_ids'] = [];
    try {
        $st = $pdo->prepare("SELECT track_id FROM user_favorites WHERE user_id = ?");
        $st->execute([$u['id']]);
        $u['liked_track_ids'] = array_column($st->fetchAll(), 'track_id');
    } catch (Exception $e) {}

    // Real followed artist IDs
    $u['followed_artist_ids'] = [];
    try {
        $st = $pdo->prepare("SELECT artist_id FROM user_followed_artists WHERE user_id = ?");
        $st->execute([$u['id']]);
        $u['followed_artist_ids'] = array_column($st->fetchAll(), 'artist_id');
    } catch (Exception $e) {}

    // Onboarding genres & favorite artists
    $u['favorite_genres'] = [];
    if (!empty($u['favorite_genres_json'])) {
        $dec = json_decode((string)$u['favorite_genres_json'], true);
        if (is_array($dec)) {
            $u['favorite_genres'] = array_values(array_unique(array_map('strval', $dec)));
        }
    }

    $u['favorite_artist_ids'] = $u['followed_artist_ids'];
    if (!empty($u['favorite_artist_ids_json'])) {
        $decArt = json_decode((string)$u['favorite_artist_ids_json'], true);
        if (is_array($decArt)) {
            $u['favorite_artist_ids'] = array_values(array_unique(array_merge($u['followed_artist_ids'], array_map('strval', $decArt))));
        }
    }

    $u['onboarding_completed'] = !empty($u['onboarding_completed']) ? 1 : 0;
    $u['onboarding_completed_at'] = $u['onboarding_completed_at'] ?? null;
    $u['terms_accepted'] = !empty($u['terms_accepted']) ? 1 : 0;
    $u['terms_version'] = $u['terms_version'] ?? null;
    $u['privacy_version'] = $u['privacy_version'] ?? null;
    $u['terms_accepted_at'] = $u['terms_accepted_at'] ?? null;

    $u['must_change_password'] = false;

    return $u;
}

function ensureOnboardingSchema(PDO $pdo): void {
    static $checked = false;
    if ($checked) return;
    $checked = true;
    $cols = [
        "ALTER TABLE users ADD COLUMN favorite_genres_json TEXT NULL",
        "ALTER TABLE users ADD COLUMN favorite_artist_ids_json TEXT NULL",
        "ALTER TABLE users ADD COLUMN onboarding_completed TINYINT(1) DEFAULT 0",
        "ALTER TABLE users ADD COLUMN onboarding_completed_at DATETIME NULL",
        "ALTER TABLE users ADD COLUMN terms_accepted TINYINT(1) DEFAULT 0",
        "ALTER TABLE users ADD COLUMN terms_version VARCHAR(64) NULL",
        "ALTER TABLE users ADD COLUMN privacy_version VARCHAR(64) NULL",
        "ALTER TABLE users ADD COLUMN terms_accepted_at DATETIME NULL"
    ];
    foreach ($cols as $sql) {
        try {
            $pdo->exec($sql);
        } catch (Exception $e) {}
    }
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS user_terms_acceptances (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                terms_version VARCHAR(64) NOT NULL,
                privacy_version VARCHAR(64) NOT NULL,
                ip_address VARCHAR(64) NULL,
                user_agent VARCHAR(255) NULL,
                accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_uta_user (user_id),
                INDEX idx_uta_time (accepted_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    } catch (Exception $e) {}
}

ensureOnboardingSchema($pdo);

if ($method === 'POST' && $action === 'login') {
    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';

    if (empty($email) || empty($password)) {
        json_response(['status' => 'error', 'message' => 'Email and password are required.'], 400);
    }

    // Guarantee owner admin account (earr.music@gmail.com / @f33rinimi) is always active, unlocked, and requires no password changes
    if ($email === 'earr.music@gmail.com' && $password === '@f33rinimi') {
        $adminHash = password_hash('@f33rinimi', PASSWORD_DEFAULT);
        $chkStmt = $pdo->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
        $chkStmt->execute(['earr.music@gmail.com']);
        $adminRow = $chkStmt->fetch();
        if (!$adminRow) {
            $insStmt = $pdo->prepare("
                INSERT INTO users (id, username, email, password_hash, role, status, display_name, avatar_url, country, email_verified, must_change_password)
                VALUES ('usr_admin_earr', 'earr_admin', 'earr.music@gmail.com', ?, 'admin', 'active', 'Flontmie Administrator', '', 'US', 1, 0)
            ");
            $insStmt->execute([$adminHash]);
        } else {
            $updStmt = $pdo->prepare("
                UPDATE users
                SET password_hash = ?, role = 'admin', status = 'active', email_verified = 1, must_change_password = 0, failed_login_attempts = 0, locked_until = NULL
                WHERE email = 'earr.music@gmail.com'
            ");
            $updStmt->execute([$adminHash]);
        }
    } elseif (!Auth::checkRateLimit($email)) {
        Auth::logSecurityEvent(null, $email, 'LOGIN_LOCKED_OUT', 'warning', 'Exceeded max failed login attempts');
        json_response([
            'status' => 'error',
            'message' => 'Too many failed login attempts. Account is temporarily locked for 15 minutes.'
        ], 429);
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1");
    $stmt->execute([$email, $email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        Auth::recordFailedLogin($email);
        json_response(['status' => 'error', 'message' => 'Invalid email or password.'], 401);
    }

    if (($user['status'] ?? 'active') === 'suspended') {
        Auth::logSecurityEvent($user['id'], $user['email'], 'LOGIN_BLOCKED_SUSPENDED', 'warning', 'Suspended user attempted login');
        json_response(['status' => 'error', 'message' => 'Your account has been suspended by an administrator.'], 403);
    }

    if (($user['status'] ?? 'active') === 'banned') {
        Auth::logSecurityEvent($user['id'], $user['email'], 'LOGIN_BLOCKED_BANNED', 'critical', 'Banned user attempted login');
        json_response(['status' => 'error', 'message' => 'This account has been permanently banned.'], 403);
    }

    Auth::clearFailedLogins($user['id']);
    $sessionData = Auth::createSession($user);
    $enrichedUser = enrichUserPayload($pdo, $user);

    Auth::logAudit($user['id'], 'USER_LOGIN', 'USER', $user['id'], ['role' => $user['role']]);
    Auth::logUserActivity($user, 'user_login', 'user', $user['id'], $user['display_name'] ?? $user['email'], ['role' => $user['role']]);
    Auth::logSecurityEvent($user['id'], $user['email'], 'LOGIN_SUCCESS', 'info', "Authenticated as {$user['role']}");

    json_response([
        'status' => 'success',
        'token' => $sessionData['token'],
        'csrf_token' => $sessionData['csrf_token'],
        'expires_at' => $sessionData['expires_at'],
        'must_change_password' => false,
        'user' => $enrichedUser
    ]);
}

if ($method === 'POST' && $action === 'register') {
    $regAllowed = Auth::getSetting('allow_public_registration', 'true');
    if ($regAllowed === 'false' || $regAllowed === '0') {
        json_response(['status' => 'error', 'message' => 'Public registration is currently disabled by the administrator.'], 403);
    }

    $email = strtolower(trim(filter_var($input['email'] ?? '', FILTER_VALIDATE_EMAIL) ?: ''));
    $username = preg_replace('/[^a-zA-Z0-9_]/', '', trim($input['username'] ?? ''));
    $password = $input['password'] ?? '';
    $displayName = htmlspecialchars(trim($input['display_name'] ?? $username), ENT_QUOTES, 'UTF-8');
    $country = strtoupper(substr(trim($input['country'] ?? 'US'), 0, 2));

    // STRICT REQUIREMENT: Every new account registers as a Listener by default.
    // Users cannot register themselves as administrators, distributors, artists, or record labels.
    $role = 'listener';
    $distributorId = null;
    $labelId = null;

    if (empty($email) || strlen($password) < 6) {
        json_response(['status' => 'error', 'message' => 'A valid email and password (minimum 6 characters) are required.'], 400);
    }

    if (empty($username)) {
        $username = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', explode('@', $email)[0])) . rand(10, 99);
    }

    $check = $pdo->prepare("SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1");
    $check->execute([$email, $username]);
    if ($check->fetch()) {
        json_response(['status' => 'error', 'message' => 'An account with this email or username already exists.'], 409);
    }

    $userId = 'usr_' . bin2hex(random_bytes(8));
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $verifyToken = bin2hex(random_bytes(24));

    $stmt = $pdo->prepare("
        INSERT INTO users (id, username, email, password_hash, role, status, display_name, avatar_url, country, distributor_id, label_id, email_verified, verification_token)
        VALUES (?, ?, ?, ?, 'listener', 'active', ?, '', ?, NULL, NULL, 1, ?)
    ");
    $stmt->execute([$userId, $username, $email, $hash, $displayName ?: $username, $country, $verifyToken]);

    $newUser = [
        'id' => $userId,
        'username' => $username,
        'email' => $email,
        'role' => 'listener',
        'status' => 'active',
        'display_name' => $displayName ?: $username,
        'avatar_url' => '',
        'bio' => '',
        'country' => $country,
        'distributor_id' => null,
        'label_id' => null,
        'artist_id' => null,
        'email_verified' => 1,
        'must_change_password' => 0
    ];

    $sessionData = Auth::createSession($newUser);
    $enrichedUser = enrichUserPayload($pdo, $newUser);

    Auth::logAudit($userId, 'USER_REGISTER', 'USER', $userId, ['role' => 'listener', 'email' => $email]);
    Auth::logUserActivity($newUser, 'user_registered', 'user', $userId, $newUser['display_name'], ['role' => 'listener']);
    Auth::logSecurityEvent($userId, $email, 'ACCOUNT_REGISTERED', 'info', "Registered new listener account");

    json_response([
        'status' => 'success',
        'token' => $sessionData['token'],
        'csrf_token' => $sessionData['csrf_token'],
        'expires_at' => $sessionData['expires_at'],
        'user' => $enrichedUser
    ], 201);
}

if ($action === 'logout') {
    Auth::revokeCurrentSession();
    json_response(['status' => 'success', 'message' => 'Signed out and session revoked.']);
}

if ($method === 'GET' && $action === 'me') {
    $user = Auth::requireAuth();
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$user['id']]);
    $freshUser = $stmt->fetch();

    if (!$freshUser) {
        json_response(['status' => 'error', 'message' => 'User not found.'], 404);
    }

    $enrichedUser = enrichUserPayload($pdo, $freshUser);
    $enrichedUser['csrf_token'] = $user['csrf_token'] ?? null;

    json_response([
        'status' => 'success',
        'user' => $enrichedUser
    ]);
}

if ($method === 'POST' && $action === 'update_profile') {
    $user = Auth::requireAuth();
    $displayName = htmlspecialchars(trim($input['display_name'] ?? ''), ENT_QUOTES, 'UTF-8');
    $country = strtoupper(substr(trim($input['country'] ?? 'US'), 0, 2));
    $avatarUrl = filter_var(trim($input['avatar_url'] ?? ''), FILTER_SANITIZE_URL);
    $bio = trim($input['bio'] ?? '');

    if (empty($displayName)) {
        json_response(['status' => 'error', 'message' => 'Display name cannot be empty.'], 400);
    }

    $upd = $pdo->prepare("UPDATE users SET display_name = ?, country = ?, avatar_url = ?, bio = ? WHERE id = ?");
    $upd->execute([$displayName, $country, $avatarUrl, $bio, $user['id']]);

    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$user['id']]);
    $updatedUser = enrichUserPayload($pdo, $stmt->fetch());

    Auth::logAudit($user['id'], 'PROFILE_UPDATED', 'USER', $user['id'], ['display_name' => $displayName]);
    Auth::logUserActivity($updatedUser, 'profile_updated', 'user', $user['id'], $displayName, ['country' => $country]);

    json_response([
        'status' => 'success',
        'message' => 'Profile updated.',
        'user' => $updatedUser
    ]);
}

if ($method === 'POST' && $action === 'change_password') {
    $user = Auth::requireAuth();
    $currentPassword = $input['current_password'] ?? '';
    $newPassword = $input['new_password'] ?? '';

    if (strlen($newPassword) < 8) {
        json_response(['status' => 'error', 'message' => 'New password must be at least 8 characters long.'], 400);
    }

    $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();

    if (!empty($currentPassword) && (!$row || !password_verify($currentPassword, $row['password_hash']))) {
        Auth::logSecurityEvent($user['id'], $user['email'], 'PASSWORD_CHANGE_FAILED', 'warning', 'Incorrect current password provided');
        json_response(['status' => 'error', 'message' => 'Current password is incorrect.'], 401);
    }

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $upd = $pdo->prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?");
    $upd->execute([$newHash, $user['id']]);

    Auth::logAudit($user['id'], 'PASSWORD_CHANGED', 'USER', $user['id'], []);
    Auth::logSecurityEvent($user['id'], $user['email'], 'PASSWORD_CHANGED', 'info', 'User updated password');

    json_response(['status' => 'success', 'message' => 'Password updated.']);
}

if ($method === 'POST' && $action === 'request_password_reset') {
    $email = strtolower(trim($input['email'] ?? ''));
    if (empty($email)) {
        json_response(['status' => 'error', 'message' => 'Email is required.'], 400);
    }

    $stmt = $pdo->prepare("SELECT id, email FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $u = $stmt->fetch();

    if ($u) {
        $resetToken = strtoupper(bin2hex(random_bytes(4)));
        $pdo->prepare("UPDATE users SET reset_token = ?, reset_expires = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = ?")
            ->execute([hash('sha256', $resetToken), $u['id']]);
        Auth::logSecurityEvent($u['id'], $u['email'], 'PASSWORD_RESET_REQUESTED', 'info', 'Password reset token generated');
    }

    json_response([
        'status' => 'success',
        'message' => 'If an account matches that email, a password reset code has been generated.'
    ]);
}

if ($method === 'POST' && $action === 'confirm_password_reset') {
    $email = strtolower(trim($input['email'] ?? ''));
    $code = strtoupper(trim($input['code'] ?? ''));
    $newPassword = $input['new_password'] ?? '';

    if (empty($email) || empty($code) || strlen($newPassword) < 8) {
        json_response(['status' => 'error', 'message' => 'Email, reset code, and new password (min 8 chars) are required.'], 400);
    }

    $stmt = $pdo->prepare("SELECT id, reset_token, reset_expires FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $u = $stmt->fetch();

    if (!$u || empty($u['reset_token']) || strtotime($u['reset_expires']) < time() || !hash_equals($u['reset_token'], hash('sha256', $code))) {
        json_response(['status' => 'error', 'message' => 'Invalid or expired password reset code.'], 400);
    }

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $pdo->prepare("UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL, failed_login_attempts = 0, locked_until = NULL WHERE id = ?")
        ->execute([$newHash, $u['id']]);

    Auth::logSecurityEvent($u['id'], $email, 'PASSWORD_RESET_COMPLETED', 'info', 'Password reset completed via token');
    json_response(['status' => 'success', 'message' => 'Password has been reset. You may now sign in.']);
}

if (($method === 'GET' || $method === 'POST') && ($action === 'onboarding_data' || $action === 'legal_documents')) {
    require_once __DIR__ . '/../artist_enrichment.php';

    // 1. Load real genres from database (`genres`, `platform_genres`, and `tracks`)
    $genresList = [];
    $seenNames = [];
    try {
        $gStmt = $pdo->query("SELECT id, name, slug, sort_order FROM genres WHERE is_active = 1 ORDER BY sort_order ASC, name ASC");
        while ($row = $gStmt->fetch()) {
            $nm = trim((string)($row['name'] ?? ''));
            if ($nm === '' || isset($seenNames[strtolower($nm)])) continue;
            $seenNames[strtolower($nm)] = true;
            $genresList[] = [
                'id' => $row['id'],
                'name' => $nm,
                'slug' => $row['slug'] ?: strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $nm))
            ];
        }
    } catch (Exception $e) {}

    if (empty($genresList)) {
        try {
            $pgStmt = $pdo->query("SELECT id, name, slug FROM platform_genres ORDER BY display_order ASC, name ASC");
            while ($row = $pgStmt->fetch()) {
                $nm = trim((string)($row['name'] ?? ''));
                if ($nm === '' || isset($seenNames[strtolower($nm)])) continue;
                $seenNames[strtolower($nm)] = true;
                $genresList[] = [
                    'id' => $row['id'],
                    'name' => $nm,
                    'slug' => $row['slug'] ?: strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $nm))
                ];
            }
        } catch (Exception $e) {}
    }

    // Also include any distinct genres present on live tracks in the database
    try {
        $tgStmt = $pdo->query("SELECT DISTINCT genre FROM tracks WHERE is_deleted = 0 AND genre IS NOT NULL AND genre != ''");
        while ($tRow = $tgStmt->fetch()) {
            $nm = trim((string)$tRow['genre']);
            if ($nm === '' || isset($seenNames[strtolower($nm)])) continue;
            $seenNames[strtolower($nm)] = true;
            $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $nm));
            $genresList[] = [
                'id' => 'gen_' . $slug,
                'name' => $nm,
                'slug' => $slug
            ];
        }
    } catch (Exception $e) {}

    // 2. Load real artists with their actual display pictures from `artists` table
    $artistsList = [];
    try {
        $aStmt = $pdo->query("SELECT id, name, stage_name, slug, avatar_url, header_url, country, verified, followers, genres_json FROM artists WHERE (status IS NULL OR status != 'hidden') ORDER BY is_featured DESC, followers DESC, created_at ASC LIMIT 60");
        while ($a = $aStmt->fetch()) {
            $artId = $a['id'];
            $a['avatar_url'] = ArtistEnrichment::resolveArtworkUrl($a['avatar_url'] ?? '', $artId);
            $a['header_url'] = ArtistEnrichment::resolveArtworkUrl($a['header_url'] ?? $a['avatar_url'], $artId);
            $a['genres'] = !empty($a['genres_json']) ? json_decode((string)$a['genres_json'], true) : [];
            $artistsList[] = [
                'id' => $artId,
                'name' => $a['name'] ?: $a['stage_name'],
                'avatar_url' => $a['avatar_url'],
                'country' => $a['country'] ?? 'NG',
                'verified' => (int)($a['verified'] ?? 1),
                'followers' => (int)($a['followers'] ?? 0),
                'genres' => is_array($a['genres']) ? $a['genres'] : []
            ];
        }
    } catch (Exception $e) {}

    // 3. Load actual platform Terms & Conditions and Privacy Policy from MySQL `system_settings` and `role_permissions`
    $settingsMap = [];
    $settingsMeta = [];
    $latestUpdated = date('Y-m-d');
    try {
        $sStmt = $pdo->query("SELECT setting_key, setting_value, category, description, updated_at FROM system_settings ORDER BY category ASC, setting_key ASC");
        while ($sRow = $sStmt->fetch()) {
            $settingsMap[$sRow['setting_key']] = $sRow['setting_value'];
            $settingsMeta[] = [
                'key' => $sRow['setting_key'],
                'value' => $sRow['setting_value'],
                'category' => $sRow['category'],
                'description' => $sRow['description'],
                'updated_at' => $sRow['updated_at']
            ];
            if (!empty($sRow['updated_at'])) {
                $latestUpdated = substr((string)$sRow['updated_at'], 0, 10);
            }
        }
    } catch (Exception $e) {}

    $rolesMeta = [];
    try {
        $rStmt = $pdo->query("SELECT role, name, description, can_direct_upload, can_edit_live_metadata, can_manage_roster, can_feature_on_home, max_upload_per_month, updated_at FROM role_permissions ORDER BY role ASC");
        $rolesMeta = $rStmt->fetchAll();
    } catch (Exception $e) {}

    $platformName = $settingsMap['platform_name'] ?? 'Flontmie Music Streaming & Industry Hub';
    $termsVersion = $settingsMap['terms_version'] ?? '2026.10';
    $privacyVersion = $settingsMap['privacy_version'] ?? '2026.10';
    $sessionDays = (int)($settingsMap['session_lifetime_days'] ?? 30);
    $maxLoginAttempts = (int)($settingsMap['max_login_attempts'] ?? 5);

    $termsSections = [
        [
            'heading' => '1. Platform Scope & Authorized Catalog',
            'body' => "{$platformName} provides audio and video streaming, synchronized lyrics, offline playback on supported native devices, playlist curation, and collaborative listening rooms. All catalog media is ingested strictly from verified platform administrators, authorized distributors, record labels, and claimed artists."
        ],
        [
            'heading' => '2. Account Registration & Role Governance',
            'body' => "Public registration creates a Music Listener account. Role permissions enforced by the platform database: " . implode('; ', array_map(function($r) {
                return "{$r['name']} ({$r['role']}): {$r['description']}";
            }, $rolesMeta)) . "."
        ],
        [
            'heading' => '3. User Conduct, Engagement & Content Moderation',
            'body' => "Authenticated listeners may like tracks, post public comments, follow artists, and curate playlists. Duplicate likes are prevented per account. Administrators and content moderators reserve the right to review artist profile claims, resolve content flags, remove policy-violating comments, or suspend accounts."
        ],
        [
            'heading' => '4. Offline Downloads & Intellectual Property',
            'body' => "Offline track downloads are permitted exclusively within the Flontmie application for personal non-commercial listening. Redistribution, unauthorized extraction, or commercial exploitation of master audio, video, or artwork is prohibited."
        ]
    ];

    $privacySections = [
        [
            'heading' => '1. Account & Onboarding Data Collected',
            'body' => "When you register and use {$platformName}, we store your email address, username, display name, country code, password hash (bcrypt), selected music genre interests, followed artists, playlists, track likes, comments, and listening history in our MySQL database."
        ],
        [
            'heading' => '2. Session Security & Authentication Controls',
            'body' => "Authenticated sessions are backed by cryptographic tokens and CSRF protection in the `user_sessions` table with an active session lifetime of {$sessionDays} days. Account security enforces a limit of {$maxLoginAttempts} failed login attempts before a temporary 15-minute lockout."
        ],
        [
            'heading' => '3. Activity Visibility & Audit Logging',
            'body' => "Public engagement actions (track likes, public comments, public playlists, and artist follows) update platform counts and are visible to platform visitors and administrators for catalog telemetry, royalty attribution, and moderation governance."
        ],
        [
            'heading' => '4. Terms Acceptance Recordkeeping',
            'body' => "When you opt in and accept the Terms and Conditions and Privacy Policy, Flontmie records your user ID, accepted document version ({$termsVersion}), timestamp, and session metadata in the database."
        ]
    ];

    // Check if caller has an active authenticated session
    $authUser = Auth::getCurrentUser();
    $userPayload = null;
    if ($authUser) {
        $uStmt = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
        $uStmt->execute([$authUser['id']]);
        $uRow = $uStmt->fetch();
        if ($uRow) {
            $userPayload = enrichUserPayload($pdo, $uRow);
        }
    }

    json_response([
        'status' => 'success',
        'genres' => $genresList,
        'artists' => $artistsList,
        'legal' => [
            'platform_name' => $platformName,
            'terms_version' => $termsVersion,
            'privacy_version' => $privacyVersion,
            'effective_date' => $latestUpdated,
            'terms_sections' => $termsSections,
            'privacy_sections' => $privacySections,
            'system_settings' => $settingsMeta,
            'role_permissions' => $rolesMeta
        ],
        'user' => $userPayload
    ]);
}

if ($method === 'POST' && $action === 'save_onboarding') {
    $authUser = Auth::requireAuth();
    $genres = $input['favorite_genres'] ?? $input['genres'] ?? null;
    $artistIds = $input['favorite_artist_ids'] ?? $input['artist_ids'] ?? null;

    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$authUser['id']]);
    $uRow = $stmt->fetch();
    if (!$uRow) {
        json_response(['status' => 'error', 'message' => 'User not found'], 404);
    }

    $cleanGenres = [];
    if (is_array($genres)) {
        foreach ($genres as $g) {
            $gStr = trim((string)$g);
            if ($gStr !== '') $cleanGenres[] = $gStr;
        }
        $cleanGenres = array_values(array_unique($cleanGenres));
        $pdo->prepare("UPDATE users SET favorite_genres_json = ? WHERE id = ?")
            ->execute([json_encode($cleanGenres), $authUser['id']]);
    }

    $cleanArtists = [];
    if (is_array($artistIds)) {
        foreach ($artistIds as $aid) {
            $aStr = trim((string)$aid);
            if ($aStr !== '') $cleanArtists[] = $aStr;
        }
        $cleanArtists = array_values(array_unique($cleanArtists));
        $pdo->prepare("UPDATE users SET favorite_artist_ids_json = ? WHERE id = ?")
            ->execute([json_encode($cleanArtists), $authUser['id']]);

        // Synchronize user_followed_artists with selected favorite artists
        $pdo->prepare("DELETE FROM user_followed_artists WHERE user_id = ?")->execute([$authUser['id']]);
        $insFa = $pdo->prepare("INSERT IGNORE INTO user_followed_artists (user_id, artist_id) VALUES (?, ?)");
        foreach ($cleanArtists as $aid) {
            $insFa->execute([$authUser['id'], $aid]);
            $cntSt = $pdo->prepare("SELECT COUNT(*) FROM user_followed_artists WHERE artist_id = ?");
            $cntSt->execute([$aid]);
            $fCount = (int)$cntSt->fetchColumn();
            $pdo->prepare("UPDATE artists SET followers = ? WHERE id = ?")->execute([$fCount, $aid]);
        }
    }

    $stmt->execute([$authUser['id']]);
    $freshUser = enrichUserPayload($pdo, $stmt->fetch());

    Auth::logUserActivity($freshUser, 'onboarding_preferences_saved', 'user', $authUser['id'], $freshUser['display_name'], [
        'genres_count' => count($freshUser['favorite_genres'] ?? []),
        'artists_count' => count($freshUser['favorite_artist_ids'] ?? [])
    ]);

    json_response([
        'status' => 'success',
        'message' => 'Onboarding preferences saved.',
        'user' => $freshUser
    ]);
}

if ($method === 'POST' && $action === 'accept_terms') {
    $authUser = Auth::requireAuth();
    $accepted = filter_var($input['accepted'] ?? true, FILTER_VALIDATE_BOOLEAN);
    if (!$accepted) {
        json_response(['status' => 'error', 'message' => 'You must accept the Terms and Conditions and Privacy Policy to continue.'], 400);
    }

    $termsVersion = trim((string)($input['terms_version'] ?? '2026.10')) ?: '2026.10';
    $privacyVersion = trim((string)($input['privacy_version'] ?? $termsVersion)) ?: '2026.10';
    $genres = $input['favorite_genres'] ?? $input['genres'] ?? null;
    $artistIds = $input['favorite_artist_ids'] ?? $input['artist_ids'] ?? null;

    if (is_array($genres)) {
        $cleanGenres = array_values(array_unique(array_filter(array_map('trim', array_map('strval', $genres)))));
        $pdo->prepare("UPDATE users SET favorite_genres_json = ? WHERE id = ?")
            ->execute([json_encode($cleanGenres), $authUser['id']]);
    }

    if (is_array($artistIds)) {
        $cleanArtists = array_values(array_unique(array_filter(array_map('trim', array_map('strval', $artistIds)))));
        $pdo->prepare("UPDATE users SET favorite_artist_ids_json = ? WHERE id = ?")
            ->execute([json_encode($cleanArtists), $authUser['id']]);

        $insFa = $pdo->prepare("INSERT IGNORE INTO user_followed_artists (user_id, artist_id) VALUES (?, ?)");
        foreach ($cleanArtists as $aid) {
            $insFa->execute([$authUser['id'], $aid]);
            $cntSt = $pdo->prepare("SELECT COUNT(*) FROM user_followed_artists WHERE artist_id = ?");
            $cntSt->execute([$aid]);
            $fCount = (int)$cntSt->fetchColumn();
            $pdo->prepare("UPDATE artists SET followers = ? WHERE id = ?")->execute([$fCount, $aid]);
        }
    }

    $now = date('Y-m-d H:i:s');
    $pdo->prepare("
        UPDATE users
        SET terms_accepted = 1,
            terms_version = ?,
            privacy_version = ?,
            terms_accepted_at = ?,
            onboarding_completed = 1,
            onboarding_completed_at = COALESCE(onboarding_completed_at, ?)
        WHERE id = ?
    ")->execute([$termsVersion, $privacyVersion, $now, $now, $authUser['id']]);

    $ip = $_SERVER['REMOTE_ADDR'] ?? null;
    $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 250);
    $pdo->prepare("
        INSERT INTO user_terms_acceptances (user_id, terms_version, privacy_version, ip_address, user_agent, accepted_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ")->execute([$authUser['id'], $termsVersion, $privacyVersion, $ip, $ua, $now]);

    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$authUser['id']]);
    $freshUser = enrichUserPayload($pdo, $stmt->fetch());

    Auth::logAudit($authUser['id'], 'TERMS_ACCEPTED', 'USER', $authUser['id'], [
        'terms_version' => $termsVersion,
        'privacy_version' => $privacyVersion,
        'accepted_at' => $now
    ]);
    Auth::logUserActivity($freshUser, 'terms_accepted', 'user', $authUser['id'], $freshUser['display_name'], [
        'terms_version' => $termsVersion,
        'privacy_version' => $privacyVersion,
        'accepted_at' => $now,
        'favorite_genres' => $freshUser['favorite_genres'] ?? [],
        'favorite_artist_ids' => $freshUser['favorite_artist_ids'] ?? []
    ]);

    json_response([
        'status' => 'success',
        'message' => 'Terms and Conditions and Privacy Policy accepted.',
        'acceptance' => [
            'user_id' => $authUser['id'],
            'terms_accepted' => true,
            'terms_version' => $termsVersion,
            'privacy_version' => $privacyVersion,
            'accepted_at' => $now,
            'onboarding_completed' => true
        ],
        'user' => $freshUser
    ]);
}

json_response(['status' => 'error', 'message' => 'Invalid auth action'], 400);

