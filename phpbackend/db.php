<?php
/**
 * Flontmie Music Streaming Platform - Database Connection Layer (PDO)
 */

require_once __DIR__ . '/config.php';

class Database {
    private static ?PDO $instance = null;
    private static ?string $activeHost = null;

    public static function getConnection(): PDO {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $lastError = null;
        $hosts = DB_HOSTS;

        foreach ($hosts as $host) {
            try {
                $dsn = sprintf(
                    'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                    $host,
                    DB_PORT,
                    DB_NAME,
                    DB_CHARSET
                );

                $options = [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                    PDO::ATTR_TIMEOUT            => 5,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
                ];

                $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
                self::$instance = $pdo;
                self::$activeHost = $host;
                return self::$instance;
            } catch (PDOException $e) {
                $lastError = $e->getMessage();
                // Try next host in fallback list
                continue;
            }
        }

        // If all hosts failed
        error_log("Database connection failed on all hosts: " . $lastError);
        json_response([
            'status' => 'error',
            'message' => 'Database connection failed. Please verify MySQL service and credentials.',
            'error_detail' => $lastError
        ], 500);
    }

    public static function getActiveHost(): ?string {
        return self::$activeHost;
    }
}
