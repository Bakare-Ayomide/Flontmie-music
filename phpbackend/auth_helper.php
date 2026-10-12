<?php
/**
 * Flontmie Authentication & Role-Based Access Control Helper
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

class Auth {
    /**
     * Generate an HMAC-based token for a user session
     */
    public static function generateToken(array $user): string {
        $header = base64_encode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $payload = base64_encode(json_encode([
            'uid'   => $user['id'],
            'email' => $user['email'],
            'role'  => $user['role'],
            'exp'   => time() + (86400 * 30) // 30 days
        ]));
        $signature = hash_hmac('sha256', "$header.$payload", JWT_SECRET, true);
        $encodedSignature = base64_encode($signature);
        return "$header.$payload.$encodedSignature";
    }

    /**
     * Verify and decode a token
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
     * Extract token from HTTP Authorization header
     */
    public static function getBearerToken(): ?string {
        $headers = '';
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headers = trim($_SERVER['HTTP_AUTHORIZATION']);
        } elseif (isset($_SERVER['Authorization'])) {
            $headers = trim($_SERVER['Authorization']);
        } elseif (function_exists('apache_request_headers')) {
            $requestHeaders = apache_request_headers();
            if (isset($requestHeaders['Authorization'])) {
                $headers = trim($requestHeaders['Authorization']);
            }
        }

        if (!empty($headers) && preg_match('/Bearer\s+(.*)$/i', $headers, $matches)) {
            return $matches[1];
        }

        // Also allow ?token= parameter for media streaming or downloads
        if (!empty($_GET['token'])) {
            return trim($_GET['token']);
        }

        return null;
    }

    /**
     * Get currently authenticated user from DB
     */
    public static function getCurrentUser(): ?array {
        $token = self::getBearerToken();
        if (!$token) {
            return null;
        }

        $payload = self::verifyToken($token);
        if (!$payload || !isset($payload['uid'])) {
            return null;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT id, username, email, role, display_name, avatar_url, country, distributor_id, label_id, created_at FROM users WHERE id = ?");
            $stmt->execute([$payload['uid']]);
            $user = $stmt->fetch();
            return $user ?: null;
        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * Require authenticated user, exit with 401 if missing
     */
    public static function requireAuth(): array {
        $user = self::getCurrentUser();
        if (!$user) {
            json_response([
                'status' => 'error',
                'message' => 'Unauthorized. Please provide a valid Bearer token.'
            ], 401);
        }
        return $user;
    }

    /**
     * Require one of the specified roles
     */
    public static function requireRole(array $allowedRoles): array {
        $user = self::requireAuth();
        if (!in_array($user['role'], $allowedRoles, true)) {
            json_response([
                'status' => 'error',
                'message' => 'Forbidden. Your role (' . $user['role'] . ') does not have permission to access this resource.'
            ], 403);
        }
        return $user;
    }
}
