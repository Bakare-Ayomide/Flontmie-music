<?php
/**
 * Flontmie Authentication, Server-Side Session, CSRF, Rate-Limiting & Role-Based Access Control Helper
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

class Auth {
    /**
     * Start secure PHP session if not already started
     */
    public static function startSession(): void {
        if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
            $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
            session_set_cookie_params([
                'lifetime' => 86400 * 30,
                'path' => '/',
                'secure' => $secure,
                'httponly' => true,
                'samesite' => $secure ? 'None' : 'Lax'
            ]);
            @session_start();
        }
    }

    /**
     * Create a new server-side database session & signed token
     */
    public static function createSession(array $user): array {
        self::startSession();
        $pdo = Database::getConnection();

        $sessionId = 'ses_' . bin2hex(random_bytes(16));
        $csrfToken = bin2hex(random_bytes(24));
        $expTimestamp = time() + (86400 * 30);
        $expiresAt = date('Y-m-d H:i:s', $expTimestamp);

        $header = base64_encode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $payload = base64_encode(json_encode([
            'sid'   => $sessionId,
            'uid'   => $user['id'],
            'email' => $user['email'],
            'role'  => $user['role'],
            'csrf'  => $csrfToken,
            'exp'   => $expTimestamp
        ]));
        $signature = hash_hmac('sha256', "$header.$payload", JWT_SECRET, true);
        $encodedSignature = base64_encode($signature);
        $token = "$header.$payload.$encodedSignature";
        $tokenHash = hash('sha256', $token);

        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Browser', 0, 250);

        try {
            $stmt = $pdo->prepare("
                INSERT INTO user_sessions (id, user_id, token_hash, csrf_token, ip_address, user_agent, is_revoked, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?)
            ");
            $stmt->execute([$sessionId, $user['id'], $tokenHash, $csrfToken, $ip, $ua, $expiresAt]);
        } catch (Exception $e) {
            // Continue if table migration is pending
        }

        $_SESSION['flontmie_uid'] = $user['id'];
        $_SESSION['flontmie_sid'] = $sessionId;
        $_SESSION['flontmie_csrf'] = $csrfToken;

        return [
            'token' => $token,
            'session_id' => $sessionId,
            'csrf_token' => $csrfToken,
            'expires_at' => $expiresAt
        ];
    }

    /**
     * Generate an HMAC-based token (backwards-compatible wrapper around createSession)
     */
    public static function generateToken(array $user): string {
        $sess = self::createSession($user);
        return $sess['token'];
    }

    /**
     * Verify and decode a signed token
     */
    public static function verifyToken(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        [$header, $payload, $signature] = $parts;
        $expectedSignature = base64_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));

        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $data = json_decode(base64_decode($payload), true);
        if (!$data || !isset($data['exp']) || $data['exp'] < time()) {
            return null;
        }

        return $data;
    }

    /**
     * Extract token from HTTP Authorization header or query
     */
    public static function getBearerToken(): ?string {
        $headers = '';
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headers = trim($_SERVER['HTTP_AUTHORIZATION']);
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $headers = trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
        } elseif (isset($_SERVER['Authorization'])) {
            $headers = trim($_SERVER['Authorization']);
        } elseif (function_exists('apache_request_headers')) {
            $requestHeaders = apache_request_headers();
            if (isset($requestHeaders['Authorization'])) {
                $headers = trim($requestHeaders['Authorization']);
            } elseif (isset($requestHeaders['authorization'])) {
                $headers = trim($requestHeaders['authorization']);
            }
        }

        if (!empty($headers) && preg_match('/Bearer\s+(.*)$/i', $headers, $matches)) {
            return trim($matches[1]);
        }

        if (!empty($_GET['token'])) {
            return trim($_GET['token']);
        }

        return null;
    }

    /**
     * Get currently authenticated user from DB & verify server-side session
     */
    public static function getCurrentUser(): ?array {
        self::startSession();
        $token = self::getBearerToken();
        $uid = null;
        $sid = null;
        $csrfFromToken = null;

        if ($token) {
            $payload = self::verifyToken($token);
            if ($payload && isset($payload['uid'])) {
                $uid = $payload['uid'];
                $sid = $payload['sid'] ?? null;
                $csrfFromToken = $payload['csrf'] ?? null;
            }
        } elseif (!empty($_SESSION['flontmie_uid'])) {
            $uid = $_SESSION['flontmie_uid'];
            $sid = $_SESSION['flontmie_sid'] ?? null;
            $csrfFromToken = $_SESSION['flontmie_csrf'] ?? null;
        }

        if (!$uid) {
            return null;
        }

        try {
            $pdo = Database::getConnection();

            // Verify server-side session is active and not revoked if sid exists
            if ($sid) {
                $sessStmt = $pdo->prepare("SELECT id, csrf_token, is_revoked, expires_at FROM user_sessions WHERE id = ? LIMIT 1");
                $sessStmt->execute([$sid]);
                $sess = $sessStmt->fetch();
                if ($sess) {
                    if ((int)$sess['is_revoked'] === 1 || strtotime($sess['expires_at']) < time()) {
                        return null;
                    }
                    $pdo->prepare("UPDATE user_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$sid]);
                    $csrfFromToken = $sess['csrf_token'];
                }
            }

            $stmt = $pdo->prepare("
                SELECT id, username, email, role, status, display_name, avatar_url, country, distributor_id, label_id, email_verified, must_change_password, last_login_at, created_at 
                FROM users 
                WHERE id = ? 
                LIMIT 1
            ");
            $stmt->execute([$uid]);
            $user = $stmt->fetch();
            if (!$user) {
                return null;
            }

            // Enforce account status on the server
            if (isset($user['status']) && in_array($user['status'], ['suspended', 'banned'], true)) {
                return null;
            }

            $user['email_verified'] = (bool)($user['email_verified'] ?? true);
            $user['must_change_password'] = false;
            $user['session_id'] = $sid;
            $user['csrf_token'] = $csrfFromToken;

            return $user;
        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * Require authenticated user, exit with 401 if missing or suspended
     */
    public static function requireAuth(): array {
        $user = self::getCurrentUser();
        if (!$user) {
            json_response([
                'status' => 'error',
                'message' => 'Authentication required. Please log in with an active account.'
            ], 401);
        }
        return $user;
    }

    /**
     * Require one of the specified roles (Server-side RBAC enforcement)
     */
    public static function requireRole(array $allowedRoles): array {
        $user = self::requireAuth();
        if (!in_array($user['role'], $allowedRoles, true)) {
            self::logSecurityEvent($user['id'], $user['email'], 'UNAUTHORIZED_ROLE_ACCESS', 'warning', 'Attempted access requiring roles: ' . implode(',', $allowedRoles));
            json_response([
                'status' => 'error',
                'message' => 'Forbidden. Administrator or authorized role privileges are required to access this resource.'
            ], 403);
        }
        return $user;
    }

    /**
     * Verify CSRF token for state-changing requests
     */
    public static function verifyCsrf(array $user, array $input = []): void {
        if ($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            return;
        }
        $expected = $user['csrf_token'] ?? '';
        if (empty($expected)) {
            return;
        }
        $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $input['csrf_token'] ?? '';
        if (empty($provided) || !hash_equals($expected, (string)$provided)) {
            self::logSecurityEvent($user['id'], $user['email'], 'CSRF_MISMATCH', 'warning', 'Missing or invalid CSRF token provided');
            json_response([
                'status' => 'error',
                'message' => 'Invalid or missing security CSRF token. Please refresh and try again.'
            ], 403);
        }
    }

    /**
     * Enforce IP-based rate limiting using security_events table
     */
    public static function checkRateLimit(string $eventType, int $maxAttempts = 15, int $windowSeconds = 300): void {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                SELECT COUNT(*) FROM security_events 
                WHERE ip_address = ? AND event_type = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
            ");
            $stmt->execute([$ip, $eventType, $windowSeconds]);
            $count = (int)$stmt->fetchColumn();
            if ($count >= $maxAttempts) {
                json_response([
                    'status' => 'error',
                    'message' => 'Too many requests from your IP address. Please wait a few minutes before trying again.'
                ], 429);
            }
        } catch (Exception $e) {
            // Proceed if table not yet migrated
        }
    }

    /**
     * Record an audit log entry
     */
    public static function logAudit(?string $userId, string $action, string $entityType, ?string $entityId, array $details = []): void {
        try {
            $pdo = Database::getConnection();
            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            $stmt = $pdo->prepare("
                INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$userId, $action, $entityType, $entityId, json_encode($details), $ip]);
        } catch (Exception $e) {}
    }

    /**
     * Record a security event entry
     */
    public static function logSecurityEvent(?string $userId, ?string $email, string $eventType, string $severity = 'info', string $details = ''): void {
        try {
            $pdo = Database::getConnection();
            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Browser', 0, 250);
            $stmt = $pdo->prepare("
                INSERT INTO security_events (user_id, email, event_type, severity, ip_address, user_agent, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$userId, $email, $eventType, $severity, $ip, $ua, $details]);
        } catch (Exception $e) {}
    }
}
