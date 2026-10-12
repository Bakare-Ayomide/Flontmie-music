<?php
/**
 * Flontmie Music Streaming Platform - Database Schema Migration & Seeder
 * Can be run via CLI or through HTTP GET/POST with ?key=flontmie_deploy_2026
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Auth check if accessed via HTTP
if (php_sapi_name() !== 'cli') {
    $key = $_GET['key'] ?? $_POST['key'] ?? '';
    if ($key !== MIGRATION_KEY) {
        json_response([
            'status' => 'error',
            'message' => 'Invalid or missing migration key. Provide ?key=' . MIGRATION_KEY
        ], 403);
    }
}

$pdo = Database::getConnection();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$results = [];

try {
    // 1. Users Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(64) PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            email VARCHAR(191) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('listener', 'artist', 'distributor', 'label', 'admin') DEFAULT 'listener',
            display_name VARCHAR(150) NOT NULL,
            avatar_url TEXT,
            country VARCHAR(10) DEFAULT 'US',
            distributor_id VARCHAR(64) NULL,
            label_id VARCHAR(64) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_role (role),
            INDEX idx_user_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    $results[] = "Table `users` created or verified.";

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
            claimed_status ENUM('unclaimed', 'pending', 'claimed') DEFAULT 'unclaimed',
            claimed_user_id VARCHAR(64) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_artist_distributor (distributor_id),
            INDEX idx_artist_claimed (claimed_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
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
            status ENUM('draft', 'review', 'published', 'rejected') DEFAULT 'published',
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
    $results[] = "Table `albums` created or verified.";

    // 4. Tracks Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS tracks (
            id VARCHAR(64) PRIMARY KEY,
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
            is_deleted TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_track_artist (artist_id),
            INDEX idx_track_album (album_id),
            INDEX idx_track_genre (genre),
            INDEX idx_track_deleted (is_deleted)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    $results[] = "Table `tracks` created or verified.";

    // 5. Playlists Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS playlists (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            title VARCHAR(150) NOT NULL,
            description TEXT,
            cover_art_url TEXT,
            is_public TINYINT(1) DEFAULT 1,
            track_ids_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_playlist_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
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
    $results[] = "Table `user_favorites` created or verified.";

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
    $results[] = "Table `user_history` created or verified.";

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
            status ENUM('pending', 'approved', 'rejected', 'escalated') DEFAULT 'pending',
            review_notes TEXT,
            reviewed_by VARCHAR(64),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_claim_artist (artist_id),
            INDEX idx_claim_distributor (distributor_id),
            INDEX idx_claim_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    $results[] = "Table `artist_claims` created or verified.";

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
    $results[] = "Table `audit_logs` created or verified.";

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
    $results[] = "Table `jam_sessions` created or verified.";

    // Seed Initial Accounts (Admin, Distributor, Label, Artist, Listener)
    $seedUsers = [
        [
            'id' => 'usr_admin_001',
            'username' => 'admin',
            'email' => 'admin@flontmie.com',
            'password' => '@f33rinimi',
            'role' => 'admin',
            'display_name' => 'Flontmie Owner & Platform Admin',
            'avatar_url' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            'country' => 'US'
        ],
        [
            'id' => 'usr_dist_001',
            'username' => 'distributor_tunecore',
            'email' => 'distributor@flontmie.com',
            'password' => '@f33rinimi',
            'role' => 'distributor',
            'display_name' => 'TuneCore Direct Hub',
            'avatar_url' => 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
            'country' => 'US',
            'distributor_id' => 'dist_tunecore'
        ],
        [
            'id' => 'usr_label_001',
            'username' => 'label_empire',
            'email' => 'label@flontmie.com',
            'password' => '@f33rinimi',
            'role' => 'label',
            'display_name' => 'Empire Africa Records',
            'avatar_url' => 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
            'country' => 'NG',
            'label_id' => 'lbl_empire'
        ],
        [
            'id' => 'usr_artist_001',
            'username' => 'kofivance',
            'email' => 'artist@flontmie.com',
            'password' => '@f33rinimi',
            'role' => 'artist',
            'display_name' => 'Kofi Vance',
            'avatar_url' => 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
            'country' => 'GH'
        ],
        [
            'id' => 'usr_listener_001',
            'username' => 'listener_alex',
            'email' => 'listener@flontmie.com',
            'password' => '@f33rinimi',
            'role' => 'listener',
            'display_name' => 'Alex Chen',
            'avatar_url' => 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
            'country' => 'US'
        ]
    ];

    $userStmt = $pdo->prepare("
        INSERT INTO users (id, username, email, password_hash, role, display_name, avatar_url, country, distributor_id, label_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            display_name = VALUES(display_name),
            role = VALUES(role),
            password_hash = VALUES(password_hash)
    ");

    foreach ($seedUsers as $u) {
        $hash = password_hash($u['password'], PASSWORD_DEFAULT);
        $userStmt->execute([
            $u['id'],
            $u['username'],
            $u['email'],
            $hash,
            $u['role'],
            $u['display_name'],
            $u['avatar_url'],
            $u['country'],
            $u['distributor_id'] ?? null,
            $u['label_id'] ?? null
        ]);
    }
    $results[] = "Seeded/updated " . count($seedUsers) . " primary system users (admin, distributor, label, artist, listener).";

    // Seed Artists
    $seedArtists = [
        [
            'id' => 'art_burna_boy',
            'name' => 'Burna Boy',
            'stage_name' => 'Burna Boy',
            'slug' => 'burna-boy',
            'avatar_url' => 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
            'header_url' => 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200',
            'bio' => 'Grammy Award-winning Nigerian singer, songwriter, and pioneer of Afro-Fusion. One of the biggest global music icons defining the 21st century.',
            'verified' => 1,
            'monthly_listeners' => 18450000,
            'total_streams' => 4500000000,
            'followers' => 6200000,
            'label_name' => 'Spaceship / Atlantic',
            'distributor_name' => 'TuneCore Direct',
            'distributor_id' => 'dist_tunecore',
            'genres' => ['Afrobeat', 'Afro-Fusion', 'Dancehall'],
            'social_links' => ['instagram' => 'https://instagram.com/burnaboygram', 'twitter' => 'https://twitter.com/burnaboy'],
            'claimed_status' => 'claimed',
            'claimed_user_id' => 'usr_admin_001'
        ],
        [
            'id' => 'art_kofi_vance',
            'name' => 'Kofi Vance',
            'stage_name' => 'Kofi Vance',
            'slug' => 'kofi-vance',
            'avatar_url' => 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400',
            'header_url' => 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200',
            'bio' => 'Ghanaian Afrobeats and highlife innovator blending Accra street melodies with modern rhythmic production.',
            'verified' => 1,
            'monthly_listeners' => 4200000,
            'total_streams' => 180000000,
            'followers' => 840000,
            'label_name' => 'Empire Africa',
            'distributor_name' => 'TuneCore Direct',
            'distributor_id' => 'dist_tunecore',
            'genres' => ['Afrobeats', 'Highlife', 'Afro-Pop'],
            'social_links' => ['instagram' => 'https://instagram.com/kofivance', 'youtube' => 'https://youtube.com/@kofivance'],
            'claimed_status' => 'claimed',
            'claimed_user_id' => 'usr_artist_001'
        ],
        [
            'id' => 'art_aurora_synth',
            'name' => 'Aurora Synth',
            'stage_name' => 'Aurora Synth',
            'slug' => 'aurora-synth',
            'avatar_url' => 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
            'header_url' => 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1200',
            'bio' => 'Electronic music producer and synthwave visionary crafting neon-soaked anthems and cinematic soundscapes.',
            'verified' => 1,
            'monthly_listeners' => 2800000,
            'total_streams' => 95000000,
            'followers' => 410000,
            'label_name' => 'Neon Grid Records',
            'distributor_name' => 'TuneCore Direct',
            'distributor_id' => 'dist_tunecore',
            'genres' => ['Synthwave', 'Electronic', 'Retrowave'],
            'social_links' => ['twitter' => 'https://twitter.com/aurorasynth'],
            'claimed_status' => 'unclaimed',
            'claimed_user_id' => null
        ],
        [
            'id' => 'art_chilled_cowboy',
            'name' => 'Lo-Fi Chill Collective',
            'stage_name' => 'Lo-Fi Chill Collective',
            'slug' => 'lo-fi-chill-collective',
            'avatar_url' => 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
            'header_url' => 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200',
            'bio' => 'Study beats, midnight coffees, and rain-streaked windowpane harmonies for relaxation and deep work focus.',
            'verified' => 1,
            'monthly_listeners' => 5600000,
            'total_streams' => 310000000,
            'followers' => 1250000,
            'label_name' => 'Quiet Room Sounds',
            'distributor_name' => 'TuneCore Direct',
            'distributor_id' => 'dist_tunecore',
            'genres' => ['Lo-Fi', 'Chillhop', 'Ambient'],
            'social_links' => ['youtube' => 'https://youtube.com/@lofichill'],
            'claimed_status' => 'unclaimed',
            'claimed_user_id' => null
        ]
    ];

    $artStmt = $pdo->prepare("
        INSERT INTO artists (id, name, stage_name, slug, avatar_url, header_url, bio, verified, monthly_listeners, total_streams, followers, label_name, distributor_name, distributor_id, genres_json, social_links_json, created_by_distributor, claimed_status, claimed_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            name = VALUES(name),
            bio = VALUES(bio),
            monthly_listeners = VALUES(monthly_listeners),
            total_streams = VALUES(total_streams)
    ");

    foreach ($seedArtists as $a) {
        $artStmt->execute([
            $a['id'],
            $a['name'],
            $a['stage_name'],
            $a['slug'],
            $a['avatar_url'],
            $a['header_url'],
            $a['bio'],
            $a['verified'],
            $a['monthly_listeners'],
            $a['total_streams'],
            $a['followers'],
            $a['label_name'],
            $a['distributor_name'],
            $a['distributor_id'],
            json_encode($a['genres']),
            json_encode($a['social_links']),
            $a['distributor_name'],
            $a['claimed_status'],
            $a['claimed_user_id']
        ]);
    }
    $results[] = "Seeded/updated " . count($seedArtists) . " featured artists.";

    // Seed Albums
    $seedAlbums = [
        [
            'id' => 'alb_lagos_nights',
            'title' => 'Lagos Nights & Golden Skies',
            'artist_id' => 'art_kofi_vance',
            'artist_name' => 'Kofi Vance',
            'cover_art_url' => 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
            'release_date' => '2025-11-15',
            'release_type' => 'album',
            'genre' => 'Afrobeats',
            'status' => 'published',
            'upc' => 'FLNT-UPC-8892019',
            'tracks_count' => 5,
            'distributor_id' => 'dist_tunecore',
            'label_id' => 'lbl_empire'
        ],
        [
            'id' => 'alb_neon_odyssey',
            'title' => 'Neon Cyber Odyssey',
            'artist_id' => 'art_aurora_synth',
            'artist_name' => 'Aurora Synth',
            'cover_art_url' => 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600',
            'release_date' => '2025-09-20',
            'release_type' => 'album',
            'genre' => 'Synthwave',
            'status' => 'published',
            'upc' => 'FLNT-UPC-9921045',
            'tracks_count' => 4,
            'distributor_id' => 'dist_tunecore',
            'label_id' => null
        ],
        [
            'id' => 'alb_midnight_rain',
            'title' => 'Midnight Rain Study Sessions',
            'artist_id' => 'art_chilled_cowboy',
            'artist_name' => 'Lo-Fi Chill Collective',
            'cover_art_url' => 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
            'release_date' => '2025-10-01',
            'release_type' => 'album',
            'genre' => 'Lo-Fi',
            'status' => 'published',
            'upc' => 'FLNT-UPC-7740192',
            'tracks_count' => 4,
            'distributor_id' => 'dist_tunecore',
            'label_id' => null
        ]
    ];

    $albStmt = $pdo->prepare("
        INSERT INTO albums (id, title, artist_id, artist_name, cover_art_url, release_date, release_type, genre, status, upc, tracks_count, distributor_id, label_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            title = VALUES(title),
            cover_art_url = VALUES(cover_art_url),
            tracks_count = VALUES(tracks_count)
    ");

    foreach ($seedAlbums as $alb) {
        $albStmt->execute([
            $alb['id'],
            $alb['title'],
            $alb['artist_id'],
            $alb['artist_name'],
            $alb['cover_art_url'],
            $alb['release_date'],
            $alb['release_type'],
            $alb['genre'],
            $alb['status'],
            $alb['upc'],
            $alb['tracks_count'],
            $alb['distributor_id'],
            $alb['label_id']
        ]);
    }
    $results[] = "Seeded/updated " . count($seedAlbums) . " major albums.";

    // Seed Real Playable Audio Tracks
    $seedTracks = [
        [
            'id' => 'trk_afro_001',
            'title' => 'Amapiano Sunset Vibez',
            'artist_id' => 'art_kofi_vance',
            'artist_name' => 'Kofi Vance',
            'album_id' => 'alb_lagos_nights',
            'album_name' => 'Lagos Nights & Golden Skies',
            'duration' => 218,
            'genre' => 'Afrobeats',
            'cover_art_url' => 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
            'audio_url' => 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            'stream_count' => 1420500,
            'likes_count' => 98400,
            'release_date' => '2025-11-15',
            'lyrics' => "Lagos nights with the bassline low\nLog drum rolling everywhere we go\nSunset dripping like liquid gold\nKeep moving till the morning unfolds\n\n(Chorus)\nSay nobody can stop this motion\nVibrations across the ocean\nAmapiano in full devotion\nFeel the heat, feel the emotion\n\nOya dance for me now\nMove your body to the sound\nUnderneath the twilight skies\nLove is shining in your eyes.",
            'isrc' => 'US-FLN-25-00101',
            'explicit' => 0,
            'scale' => 'F# Minor',
            'bpm' => 114,
            'mood_tags' => ['Party', 'Afrobeat', 'Groovy', 'Sunset'],
            'featured_artists' => 'DJ Baddo',
            'producer' => 'Kel-P Vibes',
            'composer' => 'Kofi Vance'
        ],
        [
            'id' => 'trk_synth_002',
            'title' => 'Midnight Cyber Drive',
            'artist_id' => 'art_aurora_synth',
            'artist_name' => 'Aurora Synth',
            'album_id' => 'alb_neon_odyssey',
            'album_name' => 'Neon Cyber Odyssey',
            'duration' => 245,
            'genre' => 'Synthwave',
            'cover_art_url' => 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600',
            'audio_url' => 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
            'stream_count' => 890400,
            'likes_count' => 61200,
            'release_date' => '2025-09-20',
            'lyrics' => "Neon lights flash across the dash\nMidnight highway in a purple flash\nSynthesizer dreams through the city glass\nAnalog heart that was built to last\n\n(Drop)\nInto the electric grid\nRemember what the future did\nSpeeding toward the morning glow\nNever letting the rhythm slow.",
            'isrc' => 'US-FLN-25-00102',
            'explicit' => 0,
            'scale' => 'A Minor',
            'bpm' => 124,
            'mood_tags' => ['Night', 'Driving', 'Synthwave', 'Focus'],
            'featured_artists' => null,
            'producer' => 'Aurora Synth',
            'composer' => 'Aurora Synth'
        ],
        [
            'id' => 'trk_lofi_003',
            'title' => 'Windowpane Rainfall Study',
            'artist_id' => 'art_chilled_cowboy',
            'artist_name' => 'Lo-Fi Chill Collective',
            'album_id' => 'alb_midnight_rain',
            'album_name' => 'Midnight Rain Study Sessions',
            'duration' => 192,
            'genre' => 'Lo-Fi',
            'cover_art_url' => 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
            'audio_url' => 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
            'stream_count' => 2450000,
            'likes_count' => 189000,
            'release_date' => '2025-10-01',
            'lyrics' => "[Instrumental Lo-Fi Chill Beats with gentle ambient rain samples and Rhodes piano chords]",
            'isrc' => 'US-FLN-25-00103',
            'explicit' => 0,
            'scale' => 'D Major',
            'bpm' => 84,
            'mood_tags' => ['Study', 'Relax', 'Rain', 'Morning', 'Late Night'],
            'featured_artists' => null,
            'producer' => 'Quiet Room Sounds',
            'composer' => 'Chill Collective'
        ],
        [
            'id' => 'trk_pop_004',
            'title' => 'Electric Heartbeat Anthem',
            'artist_id' => 'art_burna_boy',
            'artist_name' => 'Burna Boy',
            'album_id' => null,
            'album_name' => 'Single Release',
            'duration' => 205,
            'genre' => 'Pop',
            'cover_art_url' => 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600',
            'audio_url' => 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
            'stream_count' => 3890000,
            'likes_count' => 275000,
            'release_date' => '2025-12-01',
            'lyrics' => "Feel the bass drumming through your chest\nWe put every worry to the rest\nTurn the dial up to ten\nHere we go right back again\n\n(Chorus)\nIt's an electric heartbeat\nEchoing through every street\nWhen the crowd starts singing\nAll the bells start ringing.",
            'isrc' => 'US-FLN-25-00104',
            'explicit' => 0,
            'scale' => 'C Major',
            'bpm' => 128,
            'mood_tags' => ['Workout', 'Party', 'Pop', 'Energy'],
            'featured_artists' => 'Wizkid',
            'producer' => 'P.Priime',
            'composer' => 'Burna Boy'
        ],
        [
            'id' => 'trk_rap_005',
            'title' => 'Streets of Gold & Diamonds',
            'artist_id' => 'art_kofi_vance',
            'artist_name' => 'Kofi Vance',
            'album_id' => 'alb_lagos_nights',
            'album_name' => 'Lagos Nights & Golden Skies',
            'duration' => 195,
            'genre' => 'Rap',
            'cover_art_url' => 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600',
            'audio_url' => 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
            'stream_count' => 1120000,
            'likes_count' => 84000,
            'release_date' => '2025-11-20',
            'lyrics' => "Started from the street corner now we running the stage\nWriting every lyric on a brand new page\nDiamonds in the pressure, gold in the heat\nListen to the 808 kicking in the street\n\nThey doubted the vision, but we built the crown\nNow when we arrive it's a shutdown in town.",
            'isrc' => 'US-FLN-25-00105',
            'explicit' => 1,
            'scale' => 'E Minor',
            'bpm' => 140,
            'mood_tags' => ['Rap', 'Hype', 'Motivation', 'Club'],
            'featured_artists' => 'Sarkodie',
            'producer' => 'Killbeatz',
            'composer' => 'Kofi Vance'
        ]
    ];

    $trkStmt = $pdo->prepare("
        INSERT INTO tracks (id, title, artist_id, artist_name, album_id, album_name, duration, genre, cover_art_url, audio_url, stream_count, likes_count, release_date, lyrics, isrc, explicit, scale, bpm, mood_tags_json, featured_artists, producer, composer)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            title = VALUES(title),
            audio_url = VALUES(audio_url),
            stream_count = VALUES(stream_count),
            likes_count = VALUES(likes_count),
            lyrics = VALUES(lyrics)
    ");

    foreach ($seedTracks as $t) {
        $trkStmt->execute([
            $t['id'],
            $t['title'],
            $t['artist_id'],
            $t['artist_name'],
            $t['album_id'],
            $t['album_name'],
            $t['duration'],
            $t['genre'],
            $t['cover_art_url'],
            $t['audio_url'],
            $t['stream_count'],
            $t['likes_count'],
            $t['release_date'],
            $t['lyrics'],
            $t['isrc'],
            $t['explicit'],
            $t['scale'],
            $t['bpm'],
            json_encode($t['mood_tags']),
            $t['featured_artists'],
            $t['producer'],
            $t['composer']
        ]);
    }
    $results[] = "Seeded/updated " . count($seedTracks) . " high-fidelity streaming audio tracks.";

    // Seed Playlists
    $seedPlaylists = [
        [
            'id' => 'ply_top_hits',
            'user_id' => 'usr_admin_001',
            'title' => 'Flontmie Top 50 Global Hits',
            'description' => 'The biggest songs charting worldwide right now across Afrobeats, Pop, Rap, and Electronic.',
            'cover_art_url' => 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
            'is_public' => 1,
            'tracks' => ['trk_afro_001', 'trk_synth_002', 'trk_pop_004', 'trk_rap_005']
        ],
        [
            'id' => 'ply_afro_vibes',
            'user_id' => 'usr_admin_001',
            'title' => 'Afrobeat Sunset & Party Mix',
            'description' => 'Infectious log drums, sweet melodies, and high-energy anthems from Lagos, Accra, and Johannesburg.',
            'cover_art_url' => 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600',
            'is_public' => 1,
            'tracks' => ['trk_afro_001', 'trk_rap_005']
        ],
        [
            'id' => 'ply_chill_focus',
            'user_id' => 'usr_admin_001',
            'title' => 'Midnight Lo-Fi Deep Focus',
            'description' => 'Relaxing low-fidelity beats, warm vinyl crackle, and soothing study atmosphere.',
            'cover_art_url' => 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
            'is_public' => 1,
            'tracks' => ['trk_lofi_003', 'trk_synth_002']
        ]
    ];

    $plyStmt = $pdo->prepare("
        INSERT INTO playlists (id, user_id, title, description, cover_art_url, is_public, track_ids_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            title = VALUES(title),
            track_ids_json = VALUES(track_ids_json)
    ");

    foreach ($seedPlaylists as $p) {
        $plyStmt->execute([
            $p['id'],
            $p['user_id'],
            $p['title'],
            $p['description'],
            $p['cover_art_url'],
            $p['is_public'],
            json_encode($p['tracks'])
        ]);
    }
    $results[] = "Seeded " . count($seedPlaylists) . " curated public playlists.";

    // Seed Sample Artist Claim for Distributor review
    $claimStmt = $pdo->prepare("
        INSERT INTO artist_claims (id, artist_id, user_id, distributor_id, claimant_name, claimant_email, evidence_type, evidence_details, proof_url, status, review_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE status = VALUES(status)
    ");
    $claimStmt->execute([
        'clm_aurora_001',
        'art_aurora_synth',
        'usr_listener_001',
        'dist_tunecore',
        'Elena Vance (Aurora Synth Management)',
        'management@aurorasynth.io',
        'Official Social & Domain Email',
        'Management agreement signed March 2025 with TuneCore release confirmation.',
        'https://aurorasynth.io/press/verification.pdf',
        'pending',
        'Awaiting distributor audit review.'
    ]);
    $results[] = "Seeded sample pending artist claim for distributor dashboard.";

    // Seed Audit Log
    $logStmt = $pdo->prepare("
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $logStmt->execute([
        'usr_admin_001',
        'DATABASE_INITIALIZED',
        'SYSTEM',
        'MIGRATION_V1',
        json_encode(['version' => '1.0.0', 'environment' => 'cPanel Production', 'db_host' => Database::getActiveHost()]),
        $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
    ]);
    $results[] = "Logged migration execution in `audit_logs`.";

    $output = [
        'status' => 'success',
        'message' => 'Database schema migration and seeder completed successfully!',
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
        'active_db_host' => Database::getActiveHost(),
        'trace' => $e->getTraceAsString()
    ];
    if (php_sapi_name() === 'cli') {
        echo json_encode($errOutput, JSON_PRETTY_PRINT) . "\n";
    } else {
        json_response($errOutput, 500);
    }
}
