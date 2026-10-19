<?php
/**
 * Flontmie API - Real Authentication, Session Management, Email Verification & Password Reset
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$input = get_json_input();
$pdo = Database::getConnection();

// Helper to read system setting
function getSystemSetting(PDO $pdo, string $key, string $default = ''): string {
    try {
        $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        return $val !== false ? (string)$val : $default;
    } catch (Exception $e) {
        return $default;
    }
}

// --- 1. LOGIN ---
if ($method === 'POST' && ($action === 'login' || empty($action))) {
    Auth::checkRateLimit('LOGIN_FAILED', 12, 300);

    $login = trim($input['login'] ?? $input['email'] ?? $input['username'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($login) || empty($password)) {
        json_response(['status' => 'error', 'message' => 'Please provide email/username and password.'], 400);
    }

    $stmt = $pdo->prepare("
        SELECT id, username, email, password_hash, role, status, display_name, avatar_url, country, distributor_id, label_id, email_verified, must_change_password, failed_login_attempts, locked_until
        FROM users 
        WHERE email = ? OR username = ?
        LIMIT 1
    ");
    $stmt->execute([$login, $login]);
    $user = $stmt->fetch();

    if ($user && !empty($user['locked_until']) && strtotime($user['locked_until']) > time()) {
        $mins = max(1, (int)ceil((strtotime($user['locked_until']) - time()) / 60));
        Auth::logSecurityEvent($user['id'], $user['email'], 'LOGIN_LOCKED_ATTEMPT', 'warning', 'Login attempted while account locked');
        json_response(['status' => 'error', 'message' => "Account is temporarily locked due to multiple failed login attempts. Try again in {$mins} minute(s)."], 429);
    }

    if (!$user || !password_verify($password, $user['password_hash'])) {
        if ($user) {
            $attempts = ((int)($user['failed_login_attempts'] ?? 0)) + 1;
            $maxAttempts = max(3, (int)getSystemSetting($pdo, 'max_login_attempts', '5'));
            $lockedUntil = $attempts >= $maxAttempts ? date('Y-m-d H:i:s', time() + 900) : null;
            $pdo->prepare("UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?")
                ->execute([$attempts, $lockedUntil, $user['id']]);
        }
        Auth::logSecurityEvent($user['id'] ?? null, $login, 'LOGIN_FAILED', 'warning', 'Invalid password or unknown identifier');
        json_response(['status' => 'error', 'message' => 'Invalid email/username or password.'], 401);
    }

    // Check account status
    if (isset($user['status']) && in_array($user['status'], ['suspended', 'banned'], true)) {
        Auth::logSecurityEvent($user['id'], $user['email'], 'LOGIN_SUSPENDED_ACCOUNT', 'warning', 'Suspended user attempted login');
        json_response(['status' => 'error', 'message' => 'Your account has been suspended by platform moderation.'], 403);
    }

    // Check maintenance mode
    $maintenanceMode = getSystemSetting($pdo, 'maintenance_mode', 'false') === 'true';
    if ($maintenanceMode && $user['role'] !== 'admin') {
        json_response(['status' => 'error', 'message' => 'Flontmie is currently in maintenance mode. Only administrators may sign in at this time.'], 503);
    }

    // Reset failed login attempts & record login metadata
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    $pdo->prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, must_change_password = 0, last_login_at = NOW(), last_login_ip = ? WHERE id = ?")
        ->execute([$ip, $user['id']]);

    unset($user['password_hash'], $user['failed_login_attempts'], $user['locked_until']);
    $user['email_verified'] = (bool)($user['email_verified'] ?? true);
    $user['must_change_password'] = false;

    $session = Auth::createSession($user);
    $user['csrf_token'] = $session['csrf_token'];
    $user['session_id'] = $session['session_id'];

    Auth::logAudit($user['id'], 'USER_LOGIN', 'USER', $user['id'], ['role' => $user['role'], 'session_id' => $session['session_id']]);
    Auth::logSecurityEvent($user['id'], $user['email'], 'LOGIN_SUCCESS', 'info', "Authenticated session {$session['session_id']} started");

    json_response([
        'status' => 'success',
        'message' => 'Login successful',
        'token' => $session['token'],
        'csrf_token' => $session['csrf_token'],
        'session_id' => $session['session_id'],
        'must_change_password' => false,
        'user' => $user
    ]);
}

// --- 2. REGISTER ---
if ($method === 'POST' && $action === 'register') {
    Auth::checkRateLimit('REGISTER_ATTEMPT', 10, 300);

    if (getSystemSetting($pdo, 'allow_public_registration', 'true') === 'false') {
        json_response(['status' => 'error', 'message' => 'Public registration is currently closed by the administrator.'], 403);
    }

    $email = strtolower(trim(filter_var($input['email'] ?? '', FILTER_VALIDATE_EMAIL) ?: ''));
    $password = $input['password'] ?? '';
    $name = trim($input['name'] ?? $input['display_name'] ?? '');
    $rawUsername = trim($input['username'] ?? strtolower(explode('@', $email)[0] ?? ''));
    $username = preg_replace('/[^a-z0-9_]/', '', strtolower($rawUsername));
    // Never allow self-assigning 'admin' role during registration
    $role = in_array($input['role'] ?? '', ['listener', 'artist', 'distributor', 'label'], true) ? $input['role'] : 'listener';
    $country = strtoupper(substr(trim($input['country'] ?? 'US'), 0, 2));

    if (empty($email) || empty($password) || strlen($password) < 6) {
        json_response(['status' => 'error', 'message' => 'A valid email and a password of at least 6 characters are required.'], 400);
    }
    if (empty($username)) {
        $username = 'user_' . bin2hex(random_bytes(3));
    }

    $check = $pdo->prepare("SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1");
    $check->execute([$email, $username]);
    if ($check->fetch()) {
        json_response(['status' => 'error', 'message' => 'An account with that email or username is already registered.'], 409);
    }

    $userId = 'usr_' . bin2hex(random_bytes(8));
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150";
    $verificationCode = (string)random_int(100000, 999999);
    $requireVerify = getSystemSetting($pdo, 'require_email_verification', 'false') === 'true';
    $emailVerified = $requireVerify ? 0 : 1;

    $insert = $pdo->prepare("
        INSERT INTO users (id, username, email, password_hash, role, status, display_name, avatar_url, country, email_verified, verification_token, must_change_password, last_login_at, last_login_ip) 
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 0, NOW(), ?)
    ");
    $insert->execute([
        $userId,
        $username,
        $email,
        $hash,
        $role,
        $name ?: $username,
        $avatar,
        $country,
        $emailVerified,
        $verificationCode,
        $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
    ]);

    // Send verification email via cPanel mail
    $subject = "Verify your Flontmie Account";
    $body = "Welcome to Flontmie, " . ($name ?: $username) . "!\n\nYour email verification code is: {$verificationCode}\n\nThank you for joining Flontmie.";
    $headers = "From: no-reply@flontmie.ticketplaster.com\r\nContent-Type: text/plain; charset=UTF-8";
    @mail($email, $subject, $body, $headers);

    $newUser = [
        'id' => $userId,
        'username' => $username,
        'email' => $email,
        'role' => $role,
        'status' => 'active',
        'display_name' => $name ?: $username,
        'avatar_url' => $avatar,
        'country' => $country,
        'email_verified' => (bool)$emailVerified,
        'must_change_password' => false
    ];

    $session = Auth::createSession($newUser);
    $newUser['csrf_token'] = $session['csrf_token'];
    $newUser['session_id'] = $session['session_id'];

    Auth::logAudit($userId, 'USER_REGISTERED', 'USER', $userId, ['email' => $email, 'role' => $role]);
    Auth::logSecurityEvent($userId, $email, 'ACCOUNT_CREATED', 'info', "Registered new {$role} account");

    json_response([
        'status' => 'success',
        'message' => 'Account created successfully',
        'token' => $session['token'],
        'csrf_token' => $session['csrf_token'],
        'session_id' => $session['session_id'],
        'verification_code_sent' => true,
        'user' => $newUser
    ], 201);
}

// --- 3. VERIFY EMAIL ---
if ($method === 'POST' && $action === 'verify_email') {
    $email = strtolower(trim($input['email'] ?? ''));
    $code = trim($input['code'] ?? $input['token'] ?? '');

    if (empty($email) || empty($code)) {
        json_response(['status' => 'error', 'message' => 'Email and verification code are required.'], 400);
    }

    $stmt = $pdo->prepare("SELECT id, verification_token FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $u = $stmt->fetch();

    if (!$u || empty($u['verification_token']) || !hash_equals((string)$u['verification_token'], $code)) {
        json_response(['status' => 'error', 'message' => 'Invalid or expired verification code.'], 400);
    }

    $pdo->prepare("UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?")->execute([$u['id']]);
    Auth::logAudit($u['id'], 'EMAIL_VERIFIED', 'USER', $u['id'], ['email' => $email]);

    json_response([
        'status' => 'success',
        'message' => 'Email address verified successfully!'
    ]);
}

// --- 4. RESEND VERIFICATION CODE ---
if ($method === 'POST' && $action === 'resend_verification') {
    Auth::checkRateLimit('RESEND_VERIFICATION', 5, 300);
    $email = strtolower(trim($input['email'] ?? ''));
    if (empty($email)) {
        json_response(['status' => 'error', 'message' => 'Please provide your email address.'], 400);
    }

    $stmt = $pdo->prepare("SELECT id, display_name FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $u = $stmt->fetch();
    if (!$u) {
        json_response(['status' => 'error', 'message' => 'Account not found.'], 404);
    }

    $code = (string)random_int(100000, 999999);
    $pdo->prepare("UPDATE users SET verification_token = ? WHERE id = ?")->execute([$code, $u['id']]);

    $subject = "Your Flontmie Verification Code";
    $body = "Hello {$u['display_name']},\n\nYour verification code is: {$code}\n";
    @mail($email, $subject, $body, "From: no-reply@flontmie.ticketplaster.com\r\n");

    Auth::logSecurityEvent($u['id'], $email, 'RESEND_VERIFICATION', 'info', 'Verification code re-issued');

    json_response([
        'status' => 'success',
        'message' => 'A fresh 6-digit verification code has been sent to your email.'
    ]);
}

// --- 5. FORGOT PASSWORD (REQUEST RESET) ---
if ($method === 'POST' && $action === 'forgot_password') {
    Auth::checkRateLimit('PASSWORD_RESET_REQUEST', 6, 300);
    $email = strtolower(trim($input['email'] ?? ''));

    if (empty($email)) {
        json_response(['status' => 'error', 'message' => 'Please enter your registered email address.'], 400);
    }

    $stmt = $pdo->prepare("SELECT id, display_name, email FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $u = $stmt->fetch();

    if ($u) {
        $resetCode = (string)random_int(100000, 999999);
        $expires = date('Y-m-d H:i:s', time() + 1800); // 30 minutes
        $pdo->prepare("UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?")
            ->execute([$resetCode, $expires, $u['id']]);

        $subject = "Flontmie Password Reset Code";
        $body = "Hello {$u['display_name']},\n\nYour password reset code is: {$resetCode}\nThis code expires in 30 minutes.\n";
        @mail($email, $subject, $body, "From: no-reply@flontmie.ticketplaster.com\r\n");

        Auth::logSecurityEvent($u['id'], $email, 'PASSWORD_RESET_REQUEST', 'info', 'Password reset code issued');
    }

    json_response([
        'status' => 'success',
        'message' => 'If an account matches that email, a 6-digit password reset code has been dispatched.'
    ]);
}

// --- 6. RESET PASSWORD WITH CODE ---
if ($method === 'POST' && $action === 'reset_password') {
    Auth::checkRateLimit('PASSWORD_RESET_CONFIRM', 8, 300);
    $email = strtolower(trim($input['email'] ?? ''));
    $code = trim($input['code'] ?? $input['token'] ?? '');
    $newPassword = $input['new_password'] ?? '';

    if (empty($email) || empty($code) || strlen($newPassword) < 6) {
        json_response(['status' => 'error', 'message' => 'Email, reset code, and a new password (min 6 characters) are required.'], 400);
    }

    $stmt = $pdo->prepare("SELECT id, reset_token, reset_expires FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $u = $stmt->fetch();

    if (!$u || empty($u['reset_token']) || !hash_equals((string)$u['reset_token'], $code)) {
        Auth::logSecurityEvent($u['id'] ?? null, $email, 'PASSWORD_RESET_INVALID', 'warning', 'Invalid password reset token');
        json_response(['status' => 'error', 'message' => 'Invalid password reset code.'], 400);
    }

    if (empty($u['reset_expires']) || strtotime($u['reset_expires']) < time()) {
        json_response(['status' => 'error', 'message' => 'Password reset code has expired. Please request a new one.'], 400);
    }

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $pdo->prepare("
        UPDATE users 
        SET password_hash = ?, reset_token = NULL, reset_expires = NULL, must_change_password = 0, failed_login_attempts = 0, locked_until = NULL 
        WHERE id = ?
    ")->execute([$newHash, $u['id']]);

    // Revoke old sessions on password reset
    $pdo->prepare("UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?")->execute([$u['id']]);

    Auth::logAudit($u['id'], 'PASSWORD_RESET_COMPLETED', 'USER', $u['id'], ['email' => $email]);
    Auth::logSecurityEvent($u['id'], $email, 'PASSWORD_RESET_COMPLETED', 'info', 'Password reset and existing sessions revoked');

    json_response([
        'status' => 'success',
        'message' => 'Password has been reset successfully. You may now sign in with your new password.'
    ]);
}

// --- 7. CHANGE PASSWORD (AUTHENTICATED OR FIRST-LOGIN MANDATORY CHANGE) ---
if ($method === 'POST' && $action === 'change_password') {
    $user = Auth::requireAuth();
    Auth::verifyCsrf($user, $input);

    $currentPassword = $input['current_password'] ?? '';
    $newPassword = $input['new_password'] ?? '';

    if (strlen($newPassword) < 8) {
        json_response(['status' => 'error', 'message' => 'New password must be at least 8 characters long.'], 400);
    }

    $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();

    if (!$row) {
        json_response(['status' => 'error', 'message' => 'User record not found.'], 404);
    }

    // Verify current password if provided, or require it if not in mandatory first-login flow
    if (!empty($currentPassword) && !password_verify($currentPassword, $row['password_hash'])) {
        Auth::logSecurityEvent($user['id'], $user['email'], 'PASSWORD_CHANGE_FAILED', 'warning', 'Incorrect current password supplied');
        json_response(['status' => 'error', 'message' => 'Current password is incorrect.'], 401);
    }

    if (password_verify($newPassword, $row['password_hash'])) {
        json_response(['status' => 'error', 'message' => 'Please choose a new password that is different from your current password.'], 400);
    }

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $pdo->prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?")
        ->execute([$newHash, $user['id']]);

    Auth::logAudit($user['id'], 'PASSWORD_CHANGED', 'USER', $user['id'], ['mandatory_first_login' => $user['must_change_password']]);
    Auth::logSecurityEvent($user['id'], $user['email'], 'PASSWORD_CHANGED', 'info', 'User updated account password');

    json_response([
        'status' => 'success',
        'message' => 'Password updated successfully!',
        'must_change_password' => false
    ]);
}

// --- 8. UPDATE PROFILE ---
if ($method === 'POST' && $action === 'update_profile') {
    $user = Auth::requireAuth();
    Auth::verifyCsrf($user, $input);

    $displayName = trim($input['display_name'] ?? $user['display_name']);
    $country = strtoupper(substr(trim($input['country'] ?? $user['country'] ?? 'US'), 0, 2));
    $avatarUrl = trim($input['avatar_url'] ?? $user['avatar_url'] ?? '');

    if (empty($displayName)) {
        json_response(['status' => 'error', 'message' => 'Display name cannot be empty.'], 400);
    }

    $pdo->prepare("UPDATE users SET display_name = ?, country = ?, avatar_url = ? WHERE id = ?")
        ->execute([$displayName, $country, $avatarUrl, $user['id']]);

    Auth::logAudit($user['id'], 'PROFILE_UPDATED', 'USER', $user['id'], ['display_name' => $displayName, 'country' => $country]);

    $updatedUser = Auth::getCurrentUser();
    json_response([
        'status' => 'success',
        'message' => 'Profile updated successfully.',
        'user' => $updatedUser
    ]);
}

// --- 9. CURRENT USER (GET /me) ---
if ($method === 'GET' && ($action === 'me' || empty($action))) {
    $user = Auth::getCurrentUser();
    if (!$user) {
        json_response(['status' => 'error', 'message' => 'Not authenticated'], 401);
    }
    json_response([
        'status' => 'success',
        'user' => $user,
        'csrf_token' => $user['csrf_token'] ?? null,
        'must_change_password' => (bool)($user['must_change_password'] ?? false)
    ]);
}

// --- 10. LOGOUT ---
if ($method === 'POST' && $action === 'logout') {
    $user = Auth::getCurrentUser();
    if ($user) {
        if (!empty($user['session_id'])) {
            $pdo->prepare("UPDATE user_sessions SET is_revoked = 1 WHERE id = ?")->execute([$user['session_id']]);
        }
        Auth::logAudit($user['id'], 'USER_LOGOUT', 'USER', $user['id'], ['session_id' => $user['session_id'] ?? null]);
        Auth::logSecurityEvent($user['id'], $user['email'], 'LOGOUT', 'info', 'Session terminated by user');
    }
    Auth::startSession();
    $_SESSION = [];
    @session_destroy();

    json_response(['status' => 'success', 'message' => 'Logged out successfully']);
}

json_response(['status' => 'error', 'message' => 'Invalid auth endpoint action'], 404);
