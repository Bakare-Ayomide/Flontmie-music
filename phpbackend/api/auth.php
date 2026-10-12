<?php
/**
 * Flontmie API - Authentication & User Profile Management
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_helper.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$input = get_json_input();
$pdo = Database::getConnection();

// --- 1. LOGIN ---
if ($method === 'POST' && ($action === 'login' || empty($action))) {
    $login = trim($input['login'] ?? $input['email'] ?? $input['username'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($login) || empty($password)) {
        json_response(['status' => 'error', 'message' => 'Please provide email/username and password.'], 400);
    }

    $stmt = $pdo->prepare("
        SELECT id, username, email, password_hash, role, display_name, avatar_url, country, distributor_id, label_id 
        FROM users 
        WHERE email = ? OR username = ?
        LIMIT 1
    ");
    $stmt->execute([$login, $login]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        json_response(['status' => 'error', 'message' => 'Invalid email or password.'], 401);
    }

    // Don't leak hash in response
    unset($user['password_hash']);

    $token = Auth::generateToken($user);

    // Audit log
    $log = $pdo->prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address) VALUES (?, ?, ?, ?, ?, ?)");
    $log->execute([$user['id'], 'USER_LOGIN', 'USER', $user['id'], json_encode(['role' => $user['role']]), $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1']);

    json_response([
        'status' => 'success',
        'message' => 'Login successful',
        'token' => $token,
        'user' => $user
    ]);
}

// --- 2. REGISTER ---
if ($method === 'POST' && $action === 'register') {
    $email = trim(filter_var($input['email'] ?? '', FILTER_VALIDATE_EMAIL) ?: '');
    $password = $input['password'] ?? '';
    $name = trim($input['name'] ?? $input['display_name'] ?? '');
    $username = trim($input['username'] ?? strtolower(explode('@', $email)[0] ?? ''));
    $role = in_array($input['role'] ?? '', ['listener', 'artist', 'distributor', 'label'], true) ? $input['role'] : 'listener';
    $country = strtoupper(substr(trim($input['country'] ?? 'US'), 0, 2));

    if (empty($email) || empty($password) || strlen($password) < 6) {
        json_response(['status' => 'error', 'message' => 'Valid email and password (min 6 chars) are required.'], 400);
    }

    // Check if exists
    $check = $pdo->prepare("SELECT id FROM users WHERE email = ? OR username = ?");
    $check->execute([$email, $username]);
    if ($check->fetch()) {
        json_response(['status' => 'error', 'message' => 'Email or username already registered.'], 409);
    }

    $userId = 'usr_' . bin2hex(random_bytes(8));
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150";

    $insert = $pdo->prepare("
        INSERT INTO users (id, username, email, password_hash, role, display_name, avatar_url, country) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $insert->execute([$userId, $username, $email, $hash, $role, $name ?: $username, $avatar, $country]);

    $newUser = [
        'id' => $userId,
        'username' => $username,
        'email' => $email,
        'role' => $role,
        'display_name' => $name ?: $username,
        'avatar_url' => $avatar,
        'country' => $country
    ];

    $token = Auth::generateToken($newUser);

    json_response([
        'status' => 'success',
        'message' => 'Account created successfully',
        'token' => $token,
        'user' => $newUser
    ], 201);
}

// --- 3. CURRENT USER (GET /me) ---
if ($method === 'GET' && ($action === 'me' || empty($action))) {
    $user = Auth::getCurrentUser();
    if (!$user) {
        json_response(['status' => 'error', 'message' => 'Not authenticated'], 401);
    }
    json_response(['status' => 'success', 'user' => $user]);
}

// --- 4. LOGOUT ---
if ($method === 'POST' && $action === 'logout') {
    json_response(['status' => 'success', 'message' => 'Logged out successfully']);
}

json_response(['status' => 'error', 'message' => 'Invalid auth endpoint action'], 404);
