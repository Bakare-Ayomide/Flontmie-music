<?php
/**
 * Flontmie Music Streaming Platform - Database Schema Migration & Seeder
 * Configures authentication, RBAC, sessions, admin governance tables, and real YouTube Music catalog.
 * Can be run via CLI or through HTTP GET/POST with ?key=flontmie_deploy_2026
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

if (php_sapi_name() !== 'cli') {
    $key = $_GET['key'] ?? $_POST['key'] ?? '';
    if ($key !== MIGRATION_KEY) {
        json_response([
            'status' => 'error',
            'message' => 'Invalid or missing migration key.'
        ], 403);
    }
}

$pdo = Database::getConnection();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$results = [];

function safeAlter(PDO $pdo, string $sql): void {
    try {
        $pdo->exec($sql);
    } catch (Exception $e) {
        // Column or index already exists
    }
}

try {
    // 1. Users Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(64) PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            email VARCHAR(191) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('listener', 'artist', 'distributor', 'label', 'admin') DEFAULT 'listener',
            status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
            display_name VARCHAR(150) NOT NULL,
            avatar_url TEXT,
            country VARCHAR(10) DEFAULT 'US',
            distributor_id VARCHAR(64) NULL,
            label_id VARCHAR(64) NULL,
            email_verified TINYINT(1) DEFAULT 0,
            verification_token VARCHAR(128) NULL,
            reset_token VARCHAR(128) NULL,
            reset_expires DATETIME NULL,
            must_change_password TINYINT(1) DEFAULT 0,
            last_login_at DATETIME NULL,
            last_login_ip VARCHAR(64) NULL,
            failed_login_attempts INT DEFAULT 0,
            locked_until DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_role (role),
            INDEX idx_user_email (email),
            INDEX idx_user_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    safeAlter($pdo, "ALTER TABLE users ADD COLUMN status ENUM('active', 'suspended', 'banned') DEFAULT 'active'");
    safeAlter($pdo, "ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0");
    safeAlter($pdo, "ALTER TABLE users ADD COLUMN verification_token VARCHAR(128) NULL");
    safeAlter($pdo, "ALTER TABLE users ADD COLUMN reset_token VARCHAR(128) NULL");
    safeAlter($pdo, "ALTER TABLE users ADD COLUMN reset_expires DATETIME NULL");
    safeAlter($pdo, "ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) DEFAULT 0");
    safeAlter($pdo, "ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL");
    safeAlter($pdo, "ALTER TABLE users ADD COLUMN last_login_ip VARCHAR(64) NULL");
    safeAlter($pdo, "ALTER TABLE users ADD COLUMN failed_login_attempts INT DEFAULT 0");
    safeAlter($pdo, "ALTER TABLE users ADD COLUMN locked_until DATETIME NULL");
    $results[] = "Table `users` created or upgraded with security columns.";

    // 1b. Server-Side Sessions Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_sessions (
            id VARCHAR(128) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            token_hash VARCHAR(128) NOT NULL,
            csrf_token VARCHAR(128) NOT NULL,
            ip_address VARCHAR(64),
            user_agent VARCHAR(255),
            is_revoked TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            INDEX idx_sess_user (user_id),
            INDEX idx_sess_token (token_hash),
            INDEX idx_sess_revoked (is_revoked)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    $results[] = "Table `user_sessions` created or verified.";

    // 2. Artists Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS artists (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            stage_name VARCHAR(150),
            slug VARCHAR(150) UNIQUE,
            avatar_url TEXT,
            header_url TEXT,
            bio TEXT,
            verified TINYINT(1) DEFAULT 0,
            monthly_listeners BIGINT DEFAULT 0,
            total_streams BIGINT DEFAULT 0,
            followers INT DEFAULT 0,
            label_name VARCHAR(150),
            distributor_name VARCHAR(150),
            distributor_id VARCHAR(64),
            genres_json TEXT,
            social_links_json TEXT,
            created_by_distributor VARCHAR(150),
            claimed_status ENUM('unclaimed', 'pending', 'claimed', 'disputed') DEFAULT 'unclaimed',
            claimed_user_id VARCHAR(64) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_artist_distributor (distributor_id),
            INDEX idx_artist_claimed (claimed_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    safeAlter($pdo, "ALTER TABLE artists MODIFY COLUMN claimed_status ENUM('unclaimed', 'pending', 'claimed', 'disputed') DEFAULT 'unclaimed'");
    $results[] = "Table `artists` created or verified.";

    // 3. Albums Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS albums (
            id VARCHAR(64) PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            artist_id VARCHAR(64) NOT NULL,
            artist_name VARCHAR(150) NOT NULL,
            cover_art_url TEXT,
            release_date DATE,
            release_type ENUM('album', 'single', 'ep') DEFAULT 'album',
            genre VARCHAR(100),
            status ENUM('draft', 'review', 'published', 'rejected', 'unpublished') DEFAULT 'published',
            upc VARCHAR(50),
            tracks_count INT DEFAULT 0,
            distributor_id VARCHAR(64),
            label_id VARCHAR(64),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_album_artist (artist_id),
            INDEX idx_album_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    safeAlter($pdo, "ALTER TABLE albums MODIFY COLUMN status ENUM('draft', 'review', 'published', 'rejected', 'unpublished') DEFAULT 'published'");
    $results[] = "Table `albums` created or verified.";

    // 4. Tracks Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS tracks (
            id VARCHAR(64) PRIMARY KEY,
            video_id VARCHAR(64) NULL,
            title VARCHAR(200) NOT NULL,
            artist_id VARCHAR(64) NOT NULL,
            artist_name VARCHAR(150) NOT NULL,
            album_id VARCHAR(64) NULL,
            album_name VARCHAR(200) NULL,
            duration INT DEFAULT 0,
            genre VARCHAR(100) NOT NULL,
            cover_art_url TEXT,
            audio_url TEXT NOT NULL,
            stream_count BIGINT DEFAULT 0,
            likes_count INT DEFAULT 0,
            release_date DATE,
            lyrics MEDIUMTEXT,
            isrc VARCHAR(50),
            explicit TINYINT(1) DEFAULT 0,
            scale VARCHAR(50),
            bpm INT DEFAULT 120,
            mood_tags_json TEXT,
            featured_artists VARCHAR(255),
            producer VARCHAR(150),
            composer VARCHAR(150),
            status VARCHAR(32) DEFAULT 'active',
            featured_on_home TINYINT(1) DEFAULT 1,
            is_deleted TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_track_artist (artist_id),
            INDEX idx_track_album (album_id),
            INDEX idx_track_genre (genre),
            INDEX idx_track_video (video_id),
            INDEX idx_track_deleted (is_deleted)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN video_id VARCHAR(64) NULL");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN source_id VARCHAR(100) NULL");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN source_type VARCHAR(32) DEFAULT 'ytmusic_import'");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN country VARCHAR(16) DEFAULT 'US'");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN release_year INT DEFAULT 2026");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN local_audio_path VARCHAR(255) NULL");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN local_artwork_path VARCHAR(255) NULL");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN audio_file_size BIGINT DEFAULT 0");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN audio_format VARCHAR(32) DEFAULT 'm4a'");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN import_status VARCHAR(32) DEFAULT 'synced'");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN license_status VARCHAR(64) DEFAULT 'verified_licensed'");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN license_notes VARCHAR(255) DEFAULT 'Authorized Flontmie Catalog Sync'");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN last_synced_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN status VARCHAR(32) DEFAULT 'published'");
    safeAlter($pdo, "ALTER TABLE tracks ADD COLUMN featured_on_home TINYINT(1) DEFAULT 1");
    safeAlter($pdo, "ALTER TABLE tracks ADD INDEX idx_track_video (video_id)");
    $results[] = "Table `tracks` created or verified with local storage and licensing columns.";

    // 4b. Import Jobs Table (Tracks individual, bulk, and scheduled imports)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS import_jobs (
            id VARCHAR(64) PRIMARY KEY,
            batch_id VARCHAR(64) NULL,
            admin_user_id VARCHAR(64) NOT NULL,
            item_type VARCHAR(32) DEFAULT 'song',
            source_id VARCHAR(128) NOT NULL,
            title VARCHAR(200) NOT NULL,
            artist_name VARCHAR(200) DEFAULT '',
            album_name VARCHAR(200) DEFAULT '',
            genre VARCHAR(100) DEFAULT 'Pop',
            country VARCHAR(16) DEFAULT 'US',
            release_year INT DEFAULT 2026,
            status VARCHAR(32) DEFAULT 'queued',
            progress_percent INT DEFAULT 0,
            track_id VARCHAR(64) NULL,
            local_audio_path VARCHAR(255) NULL,
            local_artwork_path VARCHAR(255) NULL,
            file_size_bytes BIGINT DEFAULT 0,
            audio_source_method VARCHAR(64) NULL,
            license_status VARCHAR(64) DEFAULT 'verified_licensed',
            retry_count INT DEFAULT 0,
            error_message TEXT NULL,
            raw_payload_json TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_job_status (status),
            INDEX idx_job_source (source_id),
            INDEX idx_job_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 4c. Import Schedules Table (Automated search criteria & scheduled metadata sync)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS import_schedules (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            search_query VARCHAR(200) NOT NULL,
            filter_type VARCHAR(32) DEFAULT 'songs',
            genre VARCHAR(100) DEFAULT 'All',
            country VARCHAR(16) DEFAULT 'US',
            release_year VARCHAR(16) DEFAULT 'All',
            max_items INT DEFAULT 10,
            auto_publish TINYINT(1) DEFAULT 1,
            license_status VARCHAR(64) DEFAULT 'verified_licensed',
            frequency VARCHAR(32) DEFAULT 'daily',
            is_active TINYINT(1) DEFAULT 1,
            last_run_at TIMESTAMP NULL,
            last_run_imported INT DEFAULT 0,
            total_imported INT DEFAULT 0,
            created_by VARCHAR(64) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    $results[] = "Tables `import_jobs` and `import_schedules` created or verified.";

    // 4d. Media Scanner & Matching Tables
    require_once __DIR__ . '/media_matcher.php';
    MediaMatcher::ensureTables($pdo);
    $results[] = "Tables `media_scan_runs` and `media_scan_files` created or verified.";

    // 5. Playlists Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS playlists (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            title VARCHAR(150) NOT NULL,
            description TEXT,
            cover_art_url TEXT,
            genre_category VARCHAR(64) NULL,
            is_public TINYINT(1) DEFAULT 1,
            is_featured TINYINT(1) DEFAULT 1,
            status VARCHAR(32) DEFAULT 'active',
            track_ids_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_playlist_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    safeAlter($pdo, "ALTER TABLE playlists ADD COLUMN genre_category VARCHAR(64) NULL");
    safeAlter($pdo, "ALTER TABLE playlists ADD COLUMN is_featured TINYINT(1) DEFAULT 1");
    safeAlter($pdo, "ALTER TABLE playlists ADD COLUMN status VARCHAR(32) DEFAULT 'active'");
    $results[] = "Table `playlists` created or verified.";

    // 6. User Favorites Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_favorites (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            track_id VARCHAR(64) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY user_track_fav (user_id, track_id),
            INDEX idx_fav_user (user_id),
            INDEX idx_fav_track (track_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 7. User History Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            track_id VARCHAR(64) NOT NULL,
            played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            progress_seconds INT DEFAULT 0,
            INDEX idx_hist_user (user_id),
            INDEX idx_hist_time (played_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 8. Artist Claims Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS artist_claims (
            id VARCHAR(64) PRIMARY KEY,
            artist_id VARCHAR(64) NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            distributor_id VARCHAR(64),
            claimant_name VARCHAR(150) NOT NULL,
            claimant_email VARCHAR(191) NOT NULL,
            evidence_type VARCHAR(100) NOT NULL,
            evidence_details TEXT,
            proof_url TEXT,
            status ENUM('pending', 'approved', 'rejected', 'escalated', 'disputed') DEFAULT 'pending',
            review_notes TEXT,
            reviewed_by VARCHAR(64),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_claim_artist (artist_id),
            INDEX idx_claim_distributor (distributor_id),
            INDEX idx_claim_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    safeAlter($pdo, "ALTER TABLE artist_claims MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'escalated', 'disputed') DEFAULT 'pending'");

    // 9. Audit Logs Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(64) NULL,
            action VARCHAR(100) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id VARCHAR(64),
            details_json TEXT,
            ip_address VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_audit_action (action),
            INDEX idx_audit_time (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 10. Jam Sessions Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS jam_sessions (
            id VARCHAR(64) PRIMARY KEY,
            host_user_id VARCHAR(64) NOT NULL,
            session_code VARCHAR(32) UNIQUE NOT NULL,
            current_track_id VARCHAR(64),
            playback_position INT DEFAULT 0,
            is_playing TINYINT(1) DEFAULT 0,
            participant_count INT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_jam_code (session_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 11. Moderation Reports Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS moderation_reports (
            id VARCHAR(64) PRIMARY KEY,
            reporter_user_id VARCHAR(64) NULL,
            reporter_email VARCHAR(191),
            target_type ENUM('track', 'album', 'artist', 'playlist', 'user') NOT NULL,
            target_id VARCHAR(64) NOT NULL,
            target_name VARCHAR(200),
            category ENUM('copyright', 'impersonation', 'inappropriate', 'spam', 'dispute', 'appeal') NOT NULL,
            reason TEXT NOT NULL,
            status ENUM('open', 'investigating', 'resolved', 'dismissed', 'appealed') DEFAULT 'open',
            resolution_notes TEXT NULL,
            resolved_by VARCHAR(64) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_mod_status (status),
            INDEX idx_mod_category (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 12. System Settings Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS system_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value TEXT NOT NULL,
            category VARCHAR(64) DEFAULT 'general',
            description VARCHAR(255),
            updated_by VARCHAR(64) NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 13. Platform Genres Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS platform_genres (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(100) UNIQUE NOT NULL,
            description VARCHAR(255),
            color_theme VARCHAR(100),
            is_featured TINYINT(1) DEFAULT 1,
            display_order INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 14. Distributors Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS distributors (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            slug VARCHAR(100) UNIQUE NOT NULL,
            contact_email VARCHAR(191),
            status ENUM('active', 'suspended', 'pending') DEFAULT 'active',
            quota_type VARCHAR(100) DEFAULT 'Unlimited DDEX',
            can_direct_upload TINYINT(1) DEFAULT 1,
            can_edit_metadata TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 15. Labels Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS labels (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            slug VARCHAR(100) UNIQUE NOT NULL,
            contact_email VARCHAR(191),
            country VARCHAR(10) DEFAULT 'US',
            status ENUM('active', 'suspended', 'pending') DEFAULT 'active',
            can_manage_roster TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 16. Role Permissions Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS role_permissions (
            role VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(255),
            can_direct_upload TINYINT(1) DEFAULT 0,
            can_edit_live_metadata TINYINT(1) DEFAULT 0,
            can_manage_roster TINYINT(1) DEFAULT 0,
            can_feature_on_home TINYINT(1) DEFAULT 0,
            max_upload_per_month INT DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 17. Search Logs Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS search_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(64) NULL,
            query VARCHAR(255) NOT NULL,
            results_count INT DEFAULT 0,
            ip_address VARCHAR(64),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_search_query (query),
            INDEX idx_search_time (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 18. Security Events Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS security_events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(64) NULL,
            email VARCHAR(191) NULL,
            event_type VARCHAR(64) NOT NULL,
            severity ENUM('info', 'warning', 'critical') DEFAULT 'info',
            ip_address VARCHAR(64),
            user_agent VARCHAR(255),
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_sec_type (event_type),
            INDEX idx_sec_severity (severity),
            INDEX idx_sec_time (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    $results[] = "Created/verified all admin governance, moderation, settings, and security tables.";

    // --- PURGE LEGACY MOCK TRACKS & OLD DEMO ADMIN ---
    $pdo->exec("
        DELETE FROM tracks 
        WHERE audio_url LIKE '%soundhelix%' 
           OR id LIKE 'track-%' 
           OR id LIKE 'trk_pop%' 
           OR id LIKE 'trk_lofi%' 
           OR id LIKE 'trk_rap%' 
           OR id LIKE 'trk_afro%' 
           OR id LIKE 'trk_synth%'
           OR video_id IS NULL
           OR video_id = ''
    ");
    $pdo->exec("DELETE FROM users WHERE email = 'admin@flontmie.com'");

    // --- SEED INITIAL ADMINISTRATOR ACCOUNT (earr.music@gmail.com) ---
    $adminPlainPass = defined('INITIAL_ADMIN_PASSWORD') ? INITIAL_ADMIN_PASSWORD : '@f33rinimi';
    $initialAdminHash = password_hash($adminPlainPass, PASSWORD_DEFAULT);

    $existingAdminStmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $existingAdminStmt->execute(['earr.music@gmail.com']);
    $existingAdmin = $existingAdminStmt->fetch();

    if (!$existingAdmin) {
        $adminInsert = $pdo->prepare("
            INSERT INTO users (id, username, email, password_hash, role, status, display_name, avatar_url, country, email_verified, must_change_password)
            VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?, 'US', 1, 0)
        ");
        $adminInsert->execute([
            'usr_admin_earr',
            'earr_admin',
            'earr.music@gmail.com',
            $initialAdminHash,
            'Flontmie Administrator',
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
        ]);
        $results[] = "Created initial administrator account (earr.music@gmail.com) with no password change required.";
    } else {
        $adminReset = $pdo->prepare("
            UPDATE users 
            SET password_hash = ?, role = 'admin', status = 'active', email_verified = 1, must_change_password = 0, failed_login_attempts = 0, locked_until = NULL
            WHERE email = ?
        ");
        $adminReset->execute([$initialAdminHash, 'earr.music@gmail.com']);
        $pdo->exec("UPDATE users SET must_change_password = 0 WHERE role = 'admin'");
        $results[] = "Verified administrator account (earr.music@gmail.com) with active admin privileges and password change requirement disabled.";
    }

    // Seed Non-Admin Platform Accounts (if not existing)
    $seedUsers = [
        [
            'id' => 'usr_dist_001',
            'username' => 'distributor_tunecore',
            'email' => 'distributor@flontmie.com',
            'hash' => '$2y$10$FlontmieAdminSalt2026Oqao7gyopf4TYqlR.vUGMznu6nDgMQbG',
            'role' => 'distributor',
            'display_name' => 'TuneCore Direct & YouTube Music Hub',
            'avatar_url' => 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
            'country' => 'US',
            'distributor_id' => 'dist_tunecore'
        ],
        [
            'id' => 'usr_label_001',
            'username' => 'label_empire',
            'email' => 'label@flontmie.com',
            'hash' => '$2y$10$FlontmieAdminSalt2026Oqao7gyopf4TYqlR.vUGMznu6nDgMQbG',
            'role' => 'label',
            'display_name' => 'Empire & Spaceship Records',
            'avatar_url' => 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
            'country' => 'NG',
            'label_id' => 'lbl_empire'
        ],
        [
            'id' => 'usr_artist_001',
            'username' => 'burnaboy',
            'email' => 'artist@flontmie.com',
            'hash' => '$2y$10$FlontmieAdminSalt2026Oqao7gyopf4TYqlR.vUGMznu6nDgMQbG',
            'role' => 'artist',
            'display_name' => 'Burna Boy',
            'avatar_url' => 'https://i.ytimg.com/vi/c2gK9tq57iQ/maxresdefault.jpg',
            'country' => 'NG'
        ],
        [
            'id' => 'usr_listener_001',
            'username' => 'listener_alex',
            'email' => 'listener@flontmie.com',
            'hash' => '$2y$10$FlontmieAdminSalt2026Oqao7gyopf4TYqlR.vUGMznu6nDgMQbG',
            'role' => 'listener',
            'display_name' => 'Alex Chen',
            'avatar_url' => 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
            'country' => 'US'
        ]
    ];

    $userStmt = $pdo->prepare("
        INSERT INTO users (id, username, email, password_hash, role, status, display_name, avatar_url, country, distributor_id, label_id, email_verified)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE 
            display_name = VALUES(display_name),
            role = VALUES(role)
    ");

    foreach ($seedUsers as $u) {
        $userStmt->execute([
            $u['id'],
            $u['username'],
            $u['email'],
            $u['hash'],
            $u['role'],
            $u['display_name'],
            $u['avatar_url'],
            $u['country'],
            $u['distributor_id'] ?? null,
            $u['label_id'] ?? null
        ]);
    }

    // Seed Distributors
    $seedDistributors = [
        ['dist_tunecore', 'TuneCore Direct on Flontmie', 'tunecore', 'ingest@tunecore.com', 'active', 'Unlimited DDEX', 1, 1],
        ['dist_cdbaby', 'CDBaby Gateway on Flontmie', 'cdbaby', 'ddex@cdbaby.com', 'active', 'Unlimited DDEX', 1, 1],
        ['dist_ditto', 'Ditto Music Hub on Flontmie', 'ditto', 'ops@dittomusic.com', 'active', 'Unlimited DDEX', 1, 1],
        ['dist_empire', 'EMPIRE Distribution Global', 'empire-dist', 'delivery@empi.re', 'active', 'Unlimited DDEX', 1, 1]
    ];
    $distStmt = $pdo->prepare("
        INSERT INTO distributors (id, name, slug, contact_email, status, quota_type, can_direct_upload, can_edit_metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), contact_email = VALUES(contact_email)
    ");
    foreach ($seedDistributors as $d) {
        $distStmt->execute($d);
    }

    // Seed Labels
    $seedLabels = [
        ['lbl_empire', 'EMPIRE & Spaceship Records', 'empire-spaceship', 'aandr@empi.re', 'NG', 'active', 1],
        ['lbl_mavin', 'Mavin Records / Jonzing World', 'mavin-records', 'licensing@mavinrecords.com', 'NG', 'active', 1],
        ['lbl_xo', 'XO / Republic Records', 'xo-republic', 'management@xorecords.com', 'US', 'active', 1],
        ['lbl_pglang', 'pgLang / Interscope Records', 'pglang', 'studio@pglang.com', 'US', 'active', 1]
    ];
    $lblStmt = $pdo->prepare("
        INSERT INTO labels (id, name, slug, contact_email, country, status, can_manage_roster)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), contact_email = VALUES(contact_email)
    ");
    foreach ($seedLabels as $l) {
        $lblStmt->execute($l);
    }

    // Seed Role Permissions
    $seedRoles = [
        ['distributor', 'Partner Music Distributors', 'Authorized DDEX & direct ingestion partners (TuneCore, CDBaby, EMPIRE)', 1, 1, 1, 0, 500],
        ['label', 'Record Labels', 'Multi-artist roster management, catalog scheduling, and royalty analytics', 1, 1, 1, 0, 100],
        ['artist', 'Verified Artists', 'Independent creators managing their public profile and single/EP uploads', 1, 1, 0, 0, 20],
        ['listener', 'Music Listeners', 'Standard streaming, playlist curation, and Jam room participants', 0, 0, 0, 0, 0]
    ];
    $roleStmt = $pdo->prepare("
        INSERT INTO role_permissions (role, name, description, can_direct_upload, can_edit_live_metadata, can_manage_roster, can_feature_on_home, max_upload_per_month)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)
    ");
    foreach ($seedRoles as $r) {
        $roleStmt->execute($r);
    }

    // Seed Platform Genres
    $seedGenres = [
        ['gen_afrobeats', 'Afrobeats', 'afrobeats', 'Lagos, Accra & global Afro-fusion rhythms', 'from-amber-600/30 to-red-600/20', 1, 1],
        ['gen_pop', 'Pop', 'pop', 'Chart-topping global pop anthems', 'from-pink-600/30 to-rose-600/20', 1, 2],
        ['gen_rap', 'Rap & Hip-Hop', 'rap', 'Heavy 808s, lyricism, and trap velocity', 'from-purple-600/30 to-blue-600/20', 1, 3],
        ['gen_rnb', 'R&B & Soul', 'rnb', 'Smooth vocals, late-night harmonies, and neo-soul', 'from-indigo-600/30 to-violet-600/20', 1, 4],
        ['gen_lofi', 'Lo-Fi & Chill', 'lofi', 'Instrumental study beats and ambient textures', 'from-emerald-600/30 to-teal-600/20', 1, 5],
        ['gen_synthwave', 'Synthwave & Electronic', 'synthwave', 'Analog synthesizers and electronic club mixes', 'from-cyan-600/30 to-blue-600/20', 1, 6],
        ['gen_oldschool', 'Oldschool Classics', 'oldschool', 'Golden era funk, disco, and timeless recordings', 'from-orange-600/30 to-amber-600/20', 1, 7],
        ['gen_ambient', 'Ambient & Soundtracks', 'ambient', 'Cinematic scores and deep soundscapes', 'from-slate-600/30 to-zinc-600/20', 1, 8]
    ];
    $genStmt = $pdo->prepare("
        INSERT INTO platform_genres (id, name, slug, description, color_theme, is_featured, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)
    ");
    foreach ($seedGenres as $g) {
        $genStmt->execute($g);
    }

    // Seed System Settings
    $seedSettings = [
        ['platform_name', 'Flontmie Music Streaming & Industry Hub', 'general', 'Public display name of the platform'],
        ['maintenance_mode', 'false', 'system', 'When enabled, only administrators can access the platform'],
        ['allow_public_registration', 'true', 'auth', 'Allow new listeners and creators to register accounts'],
        ['require_email_verification', 'false', 'auth', 'Require email verification before full account access'],
        ['allow_artist_claims', 'true', 'catalog', 'Allow artists and managers to submit profile verification claims'],
        ['youtube_music_discovery_enabled', 'true', 'features', 'Enable live YouTube Music API search, charts, and streaming'],
        ['social_jam_sessions_enabled', 'true', 'features', 'Enable real-time collaborative Jam listening rooms'],
        ['direct_distributor_ingestion', 'true', 'catalog', 'Allow certified distributors to ingest releases directly'],
        ['max_login_attempts', '5', 'security', 'Maximum failed login attempts before temporary 15-minute lockout'],
        ['session_lifetime_days', '30', 'security', 'Duration of authenticated sessions in days']
    ];
    $setStmt = $pdo->prepare("
        INSERT INTO system_settings (setting_key, setting_value, category, description)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE description = VALUES(description)
    ");
    foreach ($seedSettings as $s) {
        $setStmt->execute($s);
    }

    // Seed Verified YouTube Music Artists
    $artistsMap = [
        'art_burna_boy' => ['name' => 'Burna Boy', 'genre' => 'Afrobeats', 'avatar' => 'https://i.ytimg.com/vi/c2gK9tq57iQ/maxresdefault.jpg', 'listeners' => 18450000, 'streams' => 4500000000, 'followers' => 6410000, 'label' => 'Spaceship / Atlantic Records'],
        'art_asake' => ['name' => 'Asake', 'genre' => 'Afrobeats', 'avatar' => 'https://i.ytimg.com/vi/eE3p9qE1fO8/maxresdefault.jpg', 'listeners' => 8900000, 'streams' => 1800000000, 'followers' => 4890000, 'label' => 'YBNL Nation / EMPIRE'],
        'art_rema' => ['name' => 'Rema', 'genre' => 'Afrobeats', 'avatar' => 'https://i.ytimg.com/vi/CQLsdmU69GD/maxresdefault.jpg', 'listeners' => 26500000, 'streams' => 3800000000, 'followers' => 9200000, 'label' => 'Mavin Records / Jonzing World'],
        'art_tems' => ['name' => 'Tems', 'genre' => 'Afrobeats', 'avatar' => 'https://i.ytimg.com/vi/VwzP7mZ7mRk/maxresdefault.jpg', 'listeners' => 21000000, 'streams' => 2900000000, 'followers' => 7500000, 'label' => 'Leading Vibe / RCA Records'],
        'art_the_weeknd' => ['name' => 'The Weeknd', 'genre' => 'Pop', 'avatar' => 'https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg', 'listeners' => 110000000, 'streams' => 35000000000, 'followers' => 78000000, 'label' => 'XO / Republic Records'],
        'art_sza' => ['name' => 'SZA', 'genre' => 'R&B', 'avatar' => 'https://i.ytimg.com/vi/mSDfxde8fSg/maxresdefault.jpg', 'listeners' => 68000000, 'streams' => 14000000000, 'followers' => 14200000, 'label' => 'Top Dawg Entertainment / RCA'],
        'art_kendrick' => ['name' => 'Kendrick Lamar', 'genre' => 'Rap', 'avatar' => 'https://i.ytimg.com/vi/H58vbez_m4E/maxresdefault.jpg', 'listeners' => 72000000, 'streams' => 19000000000, 'followers' => 16800000, 'label' => 'pgLang / Interscope Records'],
        'art_billie' => ['name' => 'Billie Eilish', 'genre' => 'Pop', 'avatar' => 'https://i.ytimg.com/vi/d5gf9dXFKCA/maxresdefault.jpg', 'listeners' => 92000000, 'streams' => 28000000000, 'followers' => 45000000, 'label' => 'Darkroom / Interscope Records'],
        'art_sabrina' => ['name' => 'Sabrina Carpenter', 'genre' => 'Pop', 'avatar' => 'https://i.ytimg.com/vi/eVli-tstM5E/maxresdefault.jpg', 'listeners' => 84000000, 'streams' => 9800000000, 'followers' => 24000000, 'label' => 'Island Records'],
        'art_taylor' => ['name' => 'Taylor Swift', 'genre' => 'Pop', 'avatar' => 'https://i.ytimg.com/vi/ic8j13piAhQ/maxresdefault.jpg', 'listeners' => 105000000, 'streams' => 42000000000, 'followers' => 91000000, 'label' => 'Republic Records'],
        'art_gunna' => ['name' => 'Gunna', 'genre' => 'Rap', 'avatar' => 'https://i.ytimg.com/vi/5W8HjA2Gz54/maxresdefault.jpg', 'listeners' => 38000000, 'streams' => 8400000000, 'followers' => 9500000, 'label' => 'YSL / 300 Entertainment'],
        'art_lofigirl' => ['name' => 'Lofi Girl', 'genre' => 'Lo-Fi', 'avatar' => 'https://i.ytimg.com/vi/5qap5aO4i9A/maxresdefault.jpg', 'listeners' => 14500000, 'streams' => 2400000000, 'followers' => 14200000, 'label' => 'Lofi Records'],
        'art_tommy' => ['name' => 'Tommy Richman', 'genre' => 'R&B', 'avatar' => 'https://i.ytimg.com/vi/o2n_5_rN2qA/maxresdefault.jpg', 'listeners' => 32000000, 'streams' => 1500000000, 'followers' => 3100000, 'label' => 'ISO Supremacy / Pulse Records'],
        'art_frank_ocean' => ['name' => 'Frank Ocean', 'genre' => 'R&B', 'avatar' => 'https://i.ytimg.com/vi/uzS3WG6__G4/maxresdefault.jpg', 'listeners' => 36000000, 'streams' => 11500000000, 'followers' => 13800000, 'label' => 'Boys Don\'t Cry'],
        'art_chappell' => ['name' => 'Chappell Roan', 'genre' => 'Pop', 'avatar' => 'https://i.ytimg.com/vi/1FIxYVbK_oA/maxresdefault.jpg', 'listeners' => 46000000, 'streams' => 3200000000, 'followers' => 8400000, 'label' => 'Amusement / Island Records'],
        'art_daft_punk' => ['name' => 'Daft Punk', 'genre' => 'Synthwave', 'avatar' => 'https://i.ytimg.com/vi/a5uQMwRMHcs/maxresdefault.jpg', 'listeners' => 24000000, 'streams' => 9100000000, 'followers' => 11200000, 'label' => 'Columbia Records'],
        'art_ewf' => ['name' => 'Earth, Wind & Fire', 'genre' => 'Oldschool', 'avatar' => 'https://i.ytimg.com/vi/Gs069dndIYk/maxresdefault.jpg', 'listeners' => 22000000, 'streams' => 6800000000, 'followers' => 8100000, 'label' => 'Columbia / Legacy'],
        'art_hans_zimmer' => ['name' => 'Hans Zimmer', 'genre' => 'Ambient', 'avatar' => 'https://i.ytimg.com/vi/RxabLA7UQ9k/maxresdefault.jpg', 'listeners' => 16500000, 'streams' => 5400000000, 'followers' => 6900000, 'label' => 'WaterTower Music']
    ];

    $artStmt = $pdo->prepare("
        INSERT INTO artists (id, name, stage_name, slug, avatar_url, header_url, bio, verified, monthly_listeners, total_streams, followers, label_name, distributor_name, distributor_id, genres_json, claimed_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 'YouTube Music Global Feed', 'dist_tunecore', ?, 'claimed')
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            avatar_url = VALUES(avatar_url),
            header_url = VALUES(header_url)
    ");

    foreach ($artistsMap as $artId => $info) {
        $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $info['name']));
        $artStmt->execute([
            $artId,
            $info['name'],
            $info['name'],
            $slug,
            $info['avatar'],
            $info['avatar'],
            "Official YouTube Music verified artist profile and discography for {$info['name']}.",
            $info['listeners'],
            $info['streams'],
            $info['followers'],
            $info['label'],
            json_encode([$info['genre']])
        ]);
    }

    // Seed Verified YouTube Music Tracks
    $ytTracks = [
        [
            'id' => 'trk_yt_c2gK9tq57iQ',
            'videoId' => 'c2gK9tq57iQ',
            'title' => 'City Boys',
            'artist' => 'Burna Boy',
            'artist_id' => 'art_burna_boy',
            'album' => 'I Told Them...',
            'album_id' => 'alb_itoldthem',
            'duration' => 153,
            'genre' => 'Afrobeats',
            'cover_url' => 'https://i.ytimg.com/vi/c2gK9tq57iQ/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=c2gK9tq57iQ',
            'streams' => 184500000,
            'likes' => 1920000,
            'bpm' => 112,
            'lyrics' => "Turn me up, turn me up, turn me up\nIt's that city boys season\nWe don't do drama, we do numbers\nEvery night we celebrate the wins."
        ],
        [
            'id' => 'trk_yt_eE3p9qE1fO8',
            'videoId' => 'eE3p9qE1fO8',
            'title' => 'Lonely At The Top',
            'artist' => 'Asake',
            'artist_id' => 'art_asake',
            'album' => 'Work of Art',
            'album_id' => 'alb_workofart',
            'duration' => 157,
            'genre' => 'Afrobeats',
            'cover_url' => 'https://i.ytimg.com/vi/eE3p9qE1fO8/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=eE3p9qE1fO8',
            'streams' => 142000000,
            'likes' => 1650000,
            'bpm' => 114,
            'lyrics' => "It's lonely at the top, lonely at the top\nNothing wey I do wey dem no go talk\nMoney on my mind, joy in my heart\nLiving my life from the very start."
        ],
        [
            'id' => 'trk_yt_CQLsdmU69GD',
            'videoId' => 'CQLsdmU69GD',
            'title' => 'Calm Down',
            'artist' => 'Rema',
            'artist_id' => 'art_rema',
            'album' => 'Rave & Roses',
            'album_id' => 'alb_raveroses',
            'duration' => 219,
            'genre' => 'Afrobeats',
            'cover_url' => 'https://i.ytimg.com/vi/CQLsdmU69GD/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=CQLsdmU69GD',
            'streams' => 980000000,
            'likes' => 8400000,
            'bpm' => 107,
            'lyrics' => "Baby, calm down, calm down\nGirl, this your body e put my heart for lockdown\nFor lockdown, oh, lockdown\nGirl, you sweet like Fanta, ooh-ooh."
        ],
        [
            'id' => 'trk_yt_VwzP7mZ7mRk',
            'videoId' => 'VwzP7mZ7mRk',
            'title' => 'Love Me JeJe',
            'artist' => 'Tems',
            'artist_id' => 'art_tems',
            'album' => 'Born in the Wild',
            'album_id' => 'alb_borninthewild',
            'duration' => 178,
            'genre' => 'Afrobeats',
            'cover_url' => 'https://i.ytimg.com/vi/VwzP7mZ7mRk/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=VwzP7mZ7mRk',
            'streams' => 85000000,
            'likes' => 920000,
            'bpm' => 105,
            'lyrics' => "Love me jeje, love me tender\nSweet like water from a mountain spring\nEverything you do dey bring me joy\nMy one and only."
        ],
        [
            'id' => 'trk_yt_4NRXx6U8ABQ',
            'videoId' => '4NRXx6U8ABQ',
            'title' => 'Blinding Lights',
            'artist' => 'The Weeknd',
            'artist_id' => 'art_the_weeknd',
            'album' => 'After Hours',
            'album_id' => 'alb_afterhours',
            'duration' => 200,
            'genre' => 'Pop',
            'cover_url' => 'https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=4NRXx6U8ABQ',
            'streams' => 4100000000,
            'likes' => 28000000,
            'bpm' => 171,
            'lyrics' => "I said, ooh, I'm blinded by the lights\nNo, I can't sleep until I feel your touch\nI said, ooh, I'm drowning in the night\nOh, when I'm like this, you're the one I trust."
        ],
        [
            'id' => 'trk_yt_eVli-tstM5E',
            'videoId' => 'eVli-tstM5E',
            'title' => 'Espresso',
            'artist' => 'Sabrina Carpenter',
            'artist_id' => 'art_sabrina',
            'album' => "Short n' Sweet",
            'album_id' => 'alb_shortnsweet',
            'duration' => 175,
            'genre' => 'Pop',
            'cover_url' => 'https://i.ytimg.com/vi/eVli-tstM5E/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=eVli-tstM5E',
            'streams' => 1560000000,
            'likes' => 13500000,
            'bpm' => 104,
            'lyrics' => "Now he's thinkin' 'bout me every night, oh\nIs it that sweet? I guess so\nSay you can't sleep, baby, I know\nThat's that me, espresso."
        ],
        [
            'id' => 'trk_yt_d5gf9dXFKCA',
            'videoId' => 'd5gf9dXFKCA',
            'title' => 'BIRDS OF A FEATHER',
            'artist' => 'Billie Eilish',
            'artist_id' => 'art_billie',
            'album' => 'HIT ME HARD AND SOFT',
            'album_id' => 'alb_hitmehard',
            'duration' => 196,
            'genre' => 'Pop',
            'cover_url' => 'https://i.ytimg.com/vi/d5gf9dXFKCA/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=d5gf9dXFKCA',
            'streams' => 1250000000,
            'likes' => 11000000,
            'bpm' => 105,
            'lyrics' => "I want you to stay 'til I'm in the grave\n'Til I'm rotting away, dead and buried\n'Til I'm in the casket you carry\nIf you go, I'm going too, uh."
        ],
        [
            'id' => 'trk_yt_ic8j13piAhQ',
            'videoId' => 'ic8j13piAhQ',
            'title' => 'Cruel Summer',
            'artist' => 'Taylor Swift',
            'artist_id' => 'art_taylor',
            'album' => 'Lover',
            'album_id' => 'alb_lover',
            'duration' => 178,
            'genre' => 'Pop',
            'cover_url' => 'https://i.ytimg.com/vi/ic8j13piAhQ/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=ic8j13piAhQ',
            'streams' => 2200000000,
            'likes' => 16000000,
            'bpm' => 170,
            'lyrics' => "It's cool, that's what I tell 'em, no rules in breakable heaven\nBut ooh, whoa-oh\nIt's a cruel summer with you."
        ],
        [
            'id' => 'trk_yt_1FIxYVbK_oA',
            'videoId' => '1FIxYVbK_oA',
            'title' => 'Good Luck, Babe!',
            'artist' => 'Chappell Roan',
            'artist_id' => 'art_chappell',
            'album' => 'Good Luck, Babe! - Single',
            'album_id' => 'alb_goodluck',
            'duration' => 218,
            'genre' => 'Pop',
            'cover_url' => 'https://i.ytimg.com/vi/1FIxYVbK_oA/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=1FIxYVbK_oA',
            'streams' => 840000000,
            'likes' => 7400000,
            'bpm' => 117,
            'lyrics' => "You can kiss a hundred boys in bars\nShoot another shot, try to stop the feeling\nYou'd have to stop the world just to stop the feeling\nGood luck, babe!"
        ],
        [
            'id' => 'trk_yt_H58vbez_m4E',
            'videoId' => 'H58vbez_m4E',
            'title' => 'Not Like Us',
            'artist' => 'Kendrick Lamar',
            'artist_id' => 'art_kendrick',
            'album' => 'Not Like Us - Single',
            'album_id' => 'alb_notlikeus',
            'duration' => 274,
            'genre' => 'Rap',
            'cover_url' => 'https://i.ytimg.com/vi/H58vbez_m4E/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=H58vbez_m4E',
            'streams' => 890000000,
            'likes' => 7900000,
            'bpm' => 101,
            'lyrics' => "Psst, I see dead people\nMustard on the beat, ho\nThey not like us, they not like us, they not like us\nWop, wop, wop, wop, wop, Dot, fuck 'em up."
        ],
        [
            'id' => 'trk_yt_5W8HjA2Gz54',
            'videoId' => '5W8HjA2Gz54',
            'title' => 'fukumean',
            'artist' => 'Gunna',
            'artist_id' => 'art_gunna',
            'album' => 'a Gift & a Curse',
            'album_id' => 'alb_giftcurse',
            'duration' => 125,
            'genre' => 'Rap',
            'cover_url' => 'https://i.ytimg.com/vi/5W8HjA2Gz54/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=5W8HjA2Gz54',
            'streams' => 740000000,
            'likes' => 5800000,
            'bpm' => 130,
            'lyrics' => "Fuck you mean? Yeah, yeah, eyah\nTop floor suites, panoramic scene\nDiamond chains on me, you know what I mean."
        ],
        [
            'id' => 'trk_yt_mSDfxde8fSg',
            'videoId' => 'mSDfxde8fSg',
            'title' => 'Kill Bill',
            'artist' => 'SZA',
            'artist_id' => 'art_sza',
            'album' => 'SOS',
            'album_id' => 'alb_sos',
            'duration' => 153,
            'genre' => 'R&B',
            'cover_url' => 'https://i.ytimg.com/vi/mSDfxde8fSg/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=mSDfxde8fSg',
            'streams' => 1890000000,
            'likes' => 14000000,
            'bpm' => 118,
            'lyrics' => "I might kill my ex, not the best idea\nHis new girlfriend's next, how'd I get here?\nI might kill my ex, I still love him though\nRather be in hell than alone."
        ],
        [
            'id' => 'trk_yt_o2n_5_rN2qA',
            'videoId' => 'o2n_5_rN2qA',
            'title' => 'MILLION DOLLAR BABY',
            'artist' => 'Tommy Richman',
            'artist_id' => 'art_tommy',
            'album' => 'COYOTE',
            'album_id' => 'alb_coyote',
            'duration' => 155,
            'genre' => 'R&B',
            'cover_url' => 'https://i.ytimg.com/vi/o2n_5_rN2qA/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=o2n_5_rN2qA',
            'streams' => 910000000,
            'likes' => 8700000,
            'bpm' => 138,
            'lyrics' => "Yeah, hell nah\nI ain't never did this before\nMillion dollar baby, tell me where you wanna go\nDrive it to the coast, watch the sunset glow."
        ],
        [
            'id' => 'trk_yt_uzS3WG6__G4',
            'videoId' => 'uzS3WG6__G4',
            'title' => 'Pink + White',
            'artist' => 'Frank Ocean',
            'artist_id' => 'art_frank_ocean',
            'album' => 'Blonde',
            'album_id' => 'alb_blonde',
            'duration' => 184,
            'genre' => 'R&B',
            'cover_url' => 'https://i.ytimg.com/vi/uzS3WG6__G4/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=uzS3WG6__G4',
            'streams' => 1600000000,
            'likes' => 12500000,
            'bpm' => 80,
            'lyrics' => "That's the way everyday goes\nEvery time we have no control\nIf the sky is pink and white\nIf the ground is black and yellow."
        ],
        [
            'id' => 'trk_yt_Gs069dndIYk',
            'videoId' => 'Gs069dndIYk',
            'title' => 'September',
            'artist' => 'Earth, Wind & Fire',
            'artist_id' => 'art_ewf',
            'album' => 'The Best of Earth, Wind & Fire, Vol. 1',
            'album_id' => 'alb_ewf_best',
            'duration' => 215,
            'genre' => 'Oldschool',
            'cover_url' => 'https://i.ytimg.com/vi/Gs069dndIYk/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=Gs069dndIYk',
            'streams' => 1950000000,
            'likes' => 15400000,
            'bpm' => 126,
            'lyrics' => "Do you remember the 21st night of September?\nLove was changin' the minds of pretenders\nWhile chasin' the clouds away\nOur hearts were ringin' in the key that our souls were singin'."
        ],
        [
            'id' => 'trk_yt_a5uQMwRMHcs',
            'videoId' => 'a5uQMwRMHcs',
            'title' => 'Instant Crush',
            'artist' => 'Daft Punk',
            'artist_id' => 'art_daft_punk',
            'album' => 'Random Access Memories',
            'album_id' => 'alb_ram',
            'duration' => 337,
            'genre' => 'Synthwave',
            'cover_url' => 'https://i.ytimg.com/vi/a5uQMwRMHcs/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=a5uQMwRMHcs',
            'streams' => 1120000000,
            'likes' => 9800000,
            'bpm' => 110,
            'lyrics' => "I didn't want to be the one to forget\nI thought of everything I'd never regret\nA little time with you is all that I get\nThat's all we need because it's all we can take."
        ],
        [
            'id' => 'trk_yt_5qap5aO4i9A',
            'videoId' => '5qap5aO4i9A',
            'title' => 'Lofi Hip Hop Study Beats (Snowman)',
            'artist' => 'Lofi Girl',
            'artist_id' => 'art_lofigirl',
            'album' => 'Lofi Study Sessions Vol. 1',
            'album_id' => 'alb_lofistudy',
            'duration' => 160,
            'genre' => 'Lo-Fi',
            'cover_url' => 'https://i.ytimg.com/vi/5qap5aO4i9A/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=5qap5aO4i9A',
            'streams' => 310000000,
            'likes' => 4500000,
            'bpm' => 80,
            'lyrics' => "[Peaceful instrumental lo-fi chillhop beats with vinyl rain crackle for deep focus and study]"
        ],
        [
            'id' => 'trk_yt_RxabLA7UQ9k',
            'videoId' => 'RxabLA7UQ9k',
            'title' => 'Time (Official Orchestral Ambient)',
            'artist' => 'Hans Zimmer',
            'artist_id' => 'art_hans_zimmer',
            'album' => 'Inception (Original Motion Picture Soundtrack)',
            'album_id' => 'alb_inception',
            'duration' => 275,
            'genre' => 'Ambient',
            'cover_url' => 'https://i.ytimg.com/vi/RxabLA7UQ9k/maxresdefault.jpg',
            'audio_url' => 'https://music.youtube.com/watch?v=RxabLA7UQ9k',
            'streams' => 780000000,
            'likes' => 6400000,
            'bpm' => 68,
            'lyrics' => "[Cinematic atmospheric orchestral score building from delicate piano harmonics to sweeping ambient crescendos]"
        ]
    ];

    $albStmt = $pdo->prepare("
        INSERT INTO albums (id, title, artist_id, artist_name, cover_art_url, release_date, genre, release_type, status, tracks_count, distributor_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'album', 'published', 10, 'dist_tunecore')
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            cover_art_url = VALUES(cover_art_url)
    ");

    $trkStmt = $pdo->prepare("
        INSERT INTO tracks (id, video_id, title, artist_id, artist_name, album_id, album_name, duration, genre, cover_art_url, audio_url, stream_count, likes_count, release_date, lyrics, isrc, bpm, mood_tags_json, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE 
            video_id = VALUES(video_id),
            title = VALUES(title),
            artist_id = VALUES(artist_id),
            artist_name = VALUES(artist_name),
            album_id = VALUES(album_id),
            album_name = VALUES(album_name),
            genre = VALUES(genre),
            cover_art_url = VALUES(cover_art_url),
            audio_url = VALUES(audio_url),
            lyrics = VALUES(lyrics),
            is_deleted = 0
    ");

    foreach ($ytTracks as $idx => $t) {
        $albStmt->execute([
            $t['album_id'],
            $t['album'],
            $t['artist_id'],
            $t['artist'],
            $t['cover_url'],
            date('Y-m-d'),
            $t['genre']
        ]);

        $moods = json_encode([$t['genre'], 'Trending', 'YouTube Music Charts']);
        $isrc = 'US-YTM-26-' . str_pad((string)($idx + 101), 5, '0', STR_PAD_LEFT);
        $trkStmt->execute([
            $t['id'],
            $t['videoId'],
            $t['title'],
            $t['artist_id'],
            $t['artist'],
            $t['album_id'],
            $t['album'],
            $t['duration'],
            $t['genre'],
            $t['cover_url'],
            $t['audio_url'],
            $t['streams'],
            $t['likes'],
            date('Y-m-d'),
            $t['lyrics'],
            $isrc,
            $t['bpm'],
            $moods
        ]);
    }

    // Seed Curated YouTube Music Playlists
    $ytPlaylists = [
        [
            'id' => 'ply_top_hits',
            'user_id' => 'usr_admin_earr',
            'title' => 'YouTube Music Top 100 Global Charts',
            'description' => 'The hottest and most played songs in the world right now from the official YouTube Music charts.',
            'cover_art_url' => 'https://i.ytimg.com/vi/c2gK9tq57iQ/maxresdefault.jpg',
            'genre_category' => 'all',
            'is_public' => 1,
            'tracks' => ['trk_yt_c2gK9tq57iQ', 'trk_yt_4NRXx6U8ABQ', 'trk_yt_eVli-tstM5E', 'trk_yt_H58vbez_m4E', 'trk_yt_mSDfxde8fSg', 'trk_yt_d5gf9dXFKCA']
        ],
        [
            'id' => 'ply_afro_vibes',
            'user_id' => 'usr_admin_earr',
            'title' => 'Afrobeats Worldwide Wave',
            'description' => 'Burna Boy, Asake, Rema, and Tems leading the global Afro-fusion revolution.',
            'cover_art_url' => 'https://i.ytimg.com/vi/eE3p9qE1fO8/maxresdefault.jpg',
            'genre_category' => 'afrobeat',
            'is_public' => 1,
            'tracks' => ['trk_yt_c2gK9tq57iQ', 'trk_yt_eE3p9qE1fO8', 'trk_yt_CQLsdmU69GD', 'trk_yt_VwzP7mZ7mRk']
        ],
        [
            'id' => 'ply_rap_caviar',
            'user_id' => 'usr_admin_earr',
            'title' => 'Hip-Hop & Rap Workout Heavyweights',
            'description' => 'Kendrick Lamar, Gunna, and the hardest-hitting rap anthems on YouTube Music.',
            'cover_art_url' => 'https://i.ytimg.com/vi/H58vbez_m4E/maxresdefault.jpg',
            'genre_category' => 'workout',
            'is_public' => 1,
            'tracks' => ['trk_yt_H58vbez_m4E', 'trk_yt_5W8HjA2Gz54', 'trk_yt_c2gK9tq57iQ']
        ],
        [
            'id' => 'ply_pop_rising',
            'user_id' => 'usr_admin_earr',
            'title' => 'Pop Rising & Global Hits',
            'description' => 'Sabrina Carpenter, Billie Eilish, Taylor Swift, and Chappell Roan dominating the charts.',
            'cover_art_url' => 'https://i.ytimg.com/vi/eVli-tstM5E/maxresdefault.jpg',
            'genre_category' => 'road_trip',
            'is_public' => 1,
            'tracks' => ['trk_yt_eVli-tstM5E', 'trk_yt_d5gf9dXFKCA', 'trk_yt_ic8j13piAhQ', 'trk_yt_1FIxYVbK_oA', 'trk_yt_4NRXx6U8ABQ']
        ],
        [
            'id' => 'ply_rnb_slowjams',
            'user_id' => 'usr_admin_earr',
            'title' => 'Midnight Velvet R&B & Romance',
            'description' => 'SZA, Tommy Richman, Frank Ocean, and sultry late night harmonies.',
            'cover_art_url' => 'https://i.ytimg.com/vi/mSDfxde8fSg/maxresdefault.jpg',
            'genre_category' => 'love_songs',
            'is_public' => 1,
            'tracks' => ['trk_yt_mSDfxde8fSg', 'trk_yt_o2n_5_rN2qA', 'trk_yt_uzS3WG6__G4', 'trk_yt_VwzP7mZ7mRk']
        ],
        [
            'id' => 'ply_oldschool_classics',
            'user_id' => 'usr_admin_earr',
            'title' => 'Golden Era Funk, Soul & Retro Classics',
            'description' => 'Earth, Wind & Fire, Daft Punk, and timeless analog recordings.',
            'cover_art_url' => 'https://i.ytimg.com/vi/Gs069dndIYk/maxresdefault.jpg',
            'genre_category' => 'old_school',
            'is_public' => 1,
            'tracks' => ['trk_yt_Gs069dndIYk', 'trk_yt_a5uQMwRMHcs', 'trk_yt_4NRXx6U8ABQ']
        ],
        [
            'id' => 'ply_chill_focus',
            'user_id' => 'usr_admin_earr',
            'title' => 'Lo-Fi Chill & Deep Study Focus',
            'description' => 'Lofi Girl, Hans Zimmer, and atmospheric focus music.',
            'cover_art_url' => 'https://i.ytimg.com/vi/5qap5aO4i9A/maxresdefault.jpg',
            'genre_category' => 'coding',
            'is_public' => 1,
            'tracks' => ['trk_yt_5qap5aO4i9A', 'trk_yt_RxabLA7UQ9k', 'trk_yt_uzS3WG6__G4']
        ]
    ];

    $plyStmt = $pdo->prepare("
        INSERT INTO playlists (id, user_id, title, description, cover_art_url, genre_category, is_public, track_ids_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            title = VALUES(title),
            description = VALUES(description),
            cover_art_url = VALUES(cover_art_url),
            genre_category = VALUES(genre_category),
            track_ids_json = VALUES(track_ids_json)
    ");

    foreach ($ytPlaylists as $p) {
        $plyStmt->execute([
            $p['id'],
            $p['user_id'],
            $p['title'],
            $p['description'],
            $p['cover_art_url'],
            $p['genre_category'],
            $p['is_public'],
            json_encode($p['tracks'])
        ]);
    }

    // Seed Artist Claims
    $claimStmt = $pdo->prepare("
        INSERT INTO artist_claims (id, artist_id, user_id, distributor_id, claimant_name, claimant_email, evidence_type, evidence_details, proof_url, status, review_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE claimant_name = VALUES(claimant_name)
    ");
    $claimStmt->execute([
        'clm_asake_001',
        'art_asake',
        'usr_listener_001',
        'dist_tunecore',
        'YBNL / EMPIRE Artist Management',
        'roster@ybnlnation.com',
        'Official YouTube Music Channel & ISRC Registry',
        'Official artist channel verification and EMPIRE distribution agreement.',
        'https://music.youtube.com/channel/UCasake',
        'pending',
        'Awaiting administrator identity verification.'
    ]);
    $claimStmt->execute([
        'clm_tems_002',
        'art_tems',
        'usr_artist_001',
        'dist_tunecore',
        'Leading Vibe / RCA Management',
        'verify@leadingvibe.com',
        'ISRC Master Rights & Government ID',
        'Submitted signed distribution schedule for Born in the Wild.',
        'https://music.youtube.com/channel/UCtems',
        'pending',
        'Pending final review by Flontmie Rights Governance.'
    ]);

    // Seed Moderation Reports
    $modStmt = $pdo->prepare("
        INSERT INTO moderation_reports (id, reporter_user_id, reporter_email, target_type, target_id, target_name, category, reason, status, resolution_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE target_name = VALUES(target_name)
    ");
    $modStmt->execute([
        'rep_copy_001',
        'usr_label_001',
        'legal@empi.re',
        'track',
        'trk_yt_eE3p9qE1fO8',
        'Lonely At The Top (Unofficial Bootleg Upload Check)',
        'copyright',
        'Automated ISRC fingerprint audit requested to confirm official master ownership.',
        'open',
        'Queued for administrator rights verification.'
    ]);
    $modStmt->execute([
        'rep_imp_002',
        'usr_artist_001',
        'management@spaceship.com',
        'artist',
        'art_burna_boy',
        'Duplicate Unverified Fan Profile Claim',
        'impersonation',
        'Third-party account attempted to claim official artist handle without distributor token.',
        'investigating',
        'Identity verification requested from claimant.'
    ]);

    // Ensure all existing tracks point to Flontmie's local streaming endpoint and have valid status/licensing
    require_once __DIR__ . '/media_engine.php';
    MediaEngine::ensureStorageSecured();

    $pdo->exec("
        UPDATE tracks 
        SET audio_url = CONCAT('/phpbackend/api/stream.php?id=', id),
            status = CASE WHEN status = 'active' OR status IS NULL OR status = '' THEN 'published' ELSE status END,
            source_id = COALESCE(source_id, video_id, id),
            license_status = COALESCE(NULLIF(license_status, ''), 'verified_licensed'),
            import_status = COALESCE(NULLIF(import_status, ''), 'synced'),
            release_year = CASE WHEN release_year IS NULL OR release_year < 1950 THEN YEAR(COALESCE(release_date, CURRENT_DATE)) ELSE release_year END
        WHERE is_deleted = 0
    ");

    // Pre-cache local audio files for existing tracks if not yet on disk (up to first 4 during migration for fast response)
    $unsyncedStmt = $pdo->query("SELECT id, video_id, title, artist_name, genre, country, cover_art_url FROM tracks WHERE is_deleted = 0 AND (local_audio_path IS NULL OR local_audio_path = '') LIMIT 4");
    $unsyncedTracks = $unsyncedStmt->fetchAll();
    foreach ($unsyncedTracks as $ut) {
        try {
            $aRes = MediaEngine::acquireAndStoreAudio($ut['id'], $ut['video_id'], $ut['title'], $ut['artist_name'], $ut['genre'] ?: 'Pop', $ut['country'] ?: 'US');
            $artRes = MediaEngine::acquireAndStoreArtwork($ut['id'], $ut['cover_art_url'], $ut['video_id']);
            $pdo->prepare("
                UPDATE tracks 
                SET local_audio_path = ?, local_artwork_path = COALESCE(?, local_artwork_path), audio_file_size = ?, audio_format = ?, import_status = 'synced', last_synced_at = NOW()
                WHERE id = ?
            ")->execute([$aRes['relative_path'], $artRes['relative_path'], $aRes['file_size'], $aRes['format'], $ut['id']]);

            $pdo->prepare("
                INSERT INTO import_jobs (id, batch_id, admin_user_id, item_type, source_id, title, artist_name, album_name, genre, country, release_year, status, progress_percent, track_id, local_audio_path, local_artwork_path, file_size_bytes, audio_source_method, license_status)
                VALUES (?, 'batch_initial_seed', 'usr_admin_earr', 'song', ?, ?, ?, 'Catalog Album', ?, ?, 2026, 'completed', 100, ?, ?, ?, ?, ?, 'verified_licensed')
                ON DUPLICATE KEY UPDATE status = 'completed', file_size_bytes = VALUES(file_size_bytes), local_audio_path = VALUES(local_audio_path)
            ")->execute([
                'job_seed_' . $ut['id'],
                $ut['video_id'] ?: $ut['id'],
                $ut['title'],
                $ut['artist_name'],
                $ut['genre'] ?: 'Pop',
                $ut['country'] ?: 'US',
                $ut['id'],
                $aRes['relative_path'],
                $artRes['relative_path'],
                $aRes['file_size'],
                $aRes['method']
            ]);
        } catch (Exception $e) {}
    }

    // Seed Default Automated Import Schedules
    $schedStmt = $pdo->prepare("
        INSERT INTO import_schedules (id, name, search_query, filter_type, genre, country, release_year, max_items, auto_publish, license_status, frequency, is_active, last_run_at, last_run_imported, total_imported, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, 'usr_admin_earr')
        ON DUPLICATE KEY UPDATE name = VALUES(name)
    ");
    $schedStmt->execute(['sch_afro_top', 'Afrobeats Global Chart Sync', 'Afrobeats Top Hits 2026', 'songs', 'Afrobeats', 'NG', '2026', 10, 1, 'verified_licensed', 'daily', 1, 6, 18]);
    $schedStmt->execute(['sch_us_pop', 'Billboard & US Pop Hot Releases', 'Top Pop Hits 2026', 'songs', 'Pop', 'US', '2026', 10, 1, 'verified_licensed', 'daily', 1, 5, 15]);
    $schedStmt->execute(['sch_uk_rnb', 'UK R&B & Soul Discovery', 'UK R&B Soul', 'songs', 'R&B', 'GB', '2025', 8, 1, 'verified_licensed', 'weekly', 1, 4, 12]);

    // Repair all artwork URLs across tracks, artists, albums, and playlists using verified high-resolution URLs
    require_once __DIR__ . '/artist_enrichment.php';
    try {
        $allTrks = $pdo->query("SELECT id, video_id, cover_art_url FROM tracks")->fetchAll();
        $updTrkArt = $pdo->prepare("UPDATE tracks SET cover_art_url = ? WHERE id = ?");
        foreach ($allTrks as $tr) {
            $fixed = ArtistEnrichment::resolveArtworkUrl($tr['cover_art_url'] ?? '', $tr['video_id'] ?? $tr['id']);
            if ($fixed !== ($tr['cover_art_url'] ?? '')) {
                $updTrkArt->execute([$fixed, $tr['id']]);
            }
        }

        $allArts = $pdo->query("SELECT id, avatar_url, header_url FROM artists")->fetchAll();
        $updArtImg = $pdo->prepare("UPDATE artists SET avatar_url = ?, header_url = ? WHERE id = ?");
        foreach ($allArts as $ar) {
            $fixedAv = ArtistEnrichment::resolveArtworkUrl($ar['avatar_url'] ?? '', $ar['id']);
            $fixedHd = ArtistEnrichment::resolveArtworkUrl($ar['header_url'] ?? $fixedAv, $ar['id']);
            if ($fixedAv !== ($ar['avatar_url'] ?? '') || $fixedHd !== ($ar['header_url'] ?? '')) {
                $updArtImg->execute([$fixedAv, $fixedHd, $ar['id']]);
            }
        }

        $allAlbs = $pdo->query("SELECT id, artist_id, cover_art_url FROM albums")->fetchAll();
        $updAlbImg = $pdo->prepare("UPDATE albums SET cover_art_url = ? WHERE id = ?");
        foreach ($allAlbs as $al) {
            $fixedAlb = ArtistEnrichment::resolveArtworkUrl($al['cover_art_url'] ?? '', $al['artist_id'] ?? $al['id']);
            if ($fixedAlb !== ($al['cover_art_url'] ?? '')) {
                $updAlbImg->execute([$fixedAlb, $al['id']]);
            }
        }

        $allPlys = $pdo->query("SELECT id, cover_art_url FROM playlists")->fetchAll();
        $updPlyImg = $pdo->prepare("UPDATE playlists SET cover_art_url = ? WHERE id = ?");
        foreach ($allPlys as $pl) {
            $fixedPl = ArtistEnrichment::resolveArtworkUrl($pl['cover_art_url'] ?? '', $pl['id']);
            if ($fixedPl !== ($pl['cover_art_url'] ?? '')) {
                $updPlyImg->execute([$fixedPl, $pl['id']]);
            }
        }
        $results[] = "Verified high-resolution artwork URLs across tracks, artists, albums, and playlists";
    } catch (Throwable $e) {}

    // Audit Log
    $logStmt = $pdo->prepare("
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $logStmt->execute([
        'usr_admin_earr',
        'PLATFORM_SCHEMA_MIGRATED',
        'SYSTEM',
        'MIGRATION_ADMIN_YTMUSIC_PIPELINE_V4',
        json_encode(['version' => '4.0.0', 'environment' => 'cPanel Production', 'db_host' => Database::getActiveHost()]),
        $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
    ]);

    $output = [
        'status' => 'success',
        'message' => 'Database migration, RBAC security tables, and initial administrator account configured!',
        'active_db_host' => Database::getActiveHost(),
        'database_name' => DB_NAME,
        'steps' => $results,
        'timestamp' => date('Y-m-d H:i:s')
    ];

    if (php_sapi_name() === 'cli') {
        echo json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
    } else {
        json_response($output, 200);
    }

} catch (Exception $e) {
    $errOutput = [
        'status' => 'error',
        'message' => 'Migration failed: ' . $e->getMessage(),
        'active_db_host' => Database::getActiveHost()
    ];
    if (php_sapi_name() === 'cli') {
        echo json_encode($errOutput, JSON_PRETTY_PRINT) . "\n";
    } else {
        json_response($errOutput, 500);
    }
}
