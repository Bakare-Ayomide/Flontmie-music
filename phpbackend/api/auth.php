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

    $u['must_change_password'] = false;

    return $u;
}

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

json_response(['status' => 'error', 'message' => 'Invalid auth action'], 400);
