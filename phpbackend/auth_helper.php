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
                SELECT id, username, email, role, status, display_name, avatar_url, bio, country, distributor_id, label_id, artist_id, email_verified, must_change_password, last_login_at, created_at 
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
     * Check account & IP rate limiting for login attempts
     */
    public static function checkRateLimit(string $identifier, int $maxAttempts = 10, int $windowSeconds = 300): bool {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT failed_login_attempts, locked_until FROM users WHERE email = ? OR username = ? LIMIT 1");
            $stmt->execute([$identifier, $identifier]);
            $u = $stmt->fetch();
            if ($u && !empty($u['locked_until']) && strtotime($u['locked_until']) > time()) {
                return false;
            }
        } catch (Exception $e) {
            // Proceed if table not yet migrated
        }
        return true;
    }

    /**
     * Record a failed login attempt and lock account after max attempts
     */
    public static function recordFailedLogin(string $identifier): void {
        try {
            $pdo = Database::getConnection();
            $maxAttempts = (int)self::getSetting('max_login_attempts', '8');
            if ($maxAttempts < 3) {
                $maxAttempts = 8;
            }
            $stmt = $pdo->prepare("SELECT id, email, failed_login_attempts FROM users WHERE email = ? OR username = ? LIMIT 1");
            $stmt->execute([$identifier, $identifier]);
            $u = $stmt->fetch();
            if ($u) {
                $attempts = ((int)($u['failed_login_attempts'] ?? 0)) + 1;
                if ($attempts >= $maxAttempts) {
                    $pdo->prepare("UPDATE users SET failed_login_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?")
                        ->execute([$attempts, $u['id']]);
                } else {
                    $pdo->prepare("UPDATE users SET failed_login_attempts = ? WHERE id = ?")
                        ->execute([$attempts, $u['id']]);
                }
                self::logSecurityEvent($u['id'], $u['email'], 'LOGIN_FAILED', 'warning', "Failed login attempt #{$attempts}");
            } else {
                self::logSecurityEvent(null, $identifier, 'LOGIN_FAILED', 'warning', "Failed login attempt for unknown identifier");
            }
        } catch (Exception $e) {}
    }

    /**
     * Clear failed login counter and record last login timestamp/IP
     */
    public static function clearFailedLogins(string $userId): void {
        try {
            $pdo = Database::getConnection();
            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            $pdo->prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = ? WHERE id = ?")
                ->execute([$ip, $userId]);
        } catch (Exception $e) {}
    }

    /**
     * Read a system setting with fallback default
     */
    public static function getSetting(string $key, string $default = ''): string {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1");
            $stmt->execute([$key]);
            $val = $stmt->fetchColumn();
            if ($val !== false && $val !== null) {
                return (string)$val;
            }
        } catch (Exception $e) {}
        return $default;
    }

    /**
     * Revoke the current user session in DB and clear PHP session
     */
    public static function revokeCurrentSession(): void {
        self::startSession();
        $token = self::getBearerToken();
        $sid = $_SESSION['flontmie_sid'] ?? null;
        if ($token) {
            $payload = self::verifyToken($token);
            if ($payload && !empty($payload['sid'])) {
                $sid = $payload['sid'];
            }
        }
        if ($sid) {
            try {
                $pdo = Database::getConnection();
                $pdo->prepare("UPDATE user_sessions SET is_revoked = 1 WHERE id = ?")->execute([$sid]);
            } catch (Exception $e) {}
        }
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            @session_destroy();
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
     * Record a persistent user/platform activity entry for admin visibility
     * Never logs passwords, tokens, or sensitive credentials.
     */
    public static function logUserActivity(?array $user, string $actionType, string $targetType, ?string $targetId, ?string $targetTitle = null, array $metadata = []): void {
        try {
            $pdo = Database::getConnection();
            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

            // Strip any sensitive keys from metadata
            $safeMeta = [];
            foreach ($metadata as $k => $v) {
                $lk = strtolower((string)$k);
                if (
                    strpos($lk, 'password') !== false ||
                    strpos($lk, 'token') !== false ||
                    strpos($lk, 'secret') !== false ||
                    strpos($lk, 'hash') !== false ||
                    strpos($lk, 'csrf') !== false
                ) {
                    continue;
                }
                $safeMeta[$k] = $v;
            }

            $userId = $user['id'] ?? 'anonymous';
            $userEmail = $user['email'] ?? null;
            $userName = $user['display_name'] ?? ($user['username'] ?? null);
            $userRole = $user['role'] ?? 'listener';

            $stmt = $pdo->prepare("
                INSERT INTO user_activities (
                    user_id, user_email, user_name, user_role,
                    action_type, target_type, target_id, target_title,
                    metadata_json, ip_address
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $userId,
                $userEmail,
                $userName,
                $userRole,
                $actionType,
                $targetType,
                $targetId,
                $targetTitle !== null ? substr($targetTitle, 0, 250) : null,
                !empty($safeMeta) ? json_encode($safeMeta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
                $ip
            ]);

            self::logAudit($user['id'] ?? null, strtoupper($actionType), strtoupper($targetType), $targetId, array_merge(
                $targetTitle ? ['title' => $targetTitle] : [],
                $safeMeta
            ));
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

