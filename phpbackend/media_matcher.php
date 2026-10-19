<?php
/**
 * Flontmie Media-to-Metadata Matching Engine
 * cPanel & MySQL compatible media file scanner, tag reader, fuzzy/exact matcher,
 * and background resumable processor.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/media_engine.php';

class MediaMatcher {
    public const SUPPORTED_AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg', 'opus', 'wma', 'aiff', 'alac'];
    public const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mkv', 'm4v'];
    public const HIGH_CONFIDENCE_THRESHOLD = 85;
    public const AMBIGUOUS_THRESHOLD = 50;

    /**
     * Ensure database tables for media scanner exist
     */
    public static function ensureTables(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS media_scan_runs (
                id VARCHAR(64) PRIMARY KEY,
                status ENUM('idle', 'running', 'completed', 'paused', 'failed') DEFAULT 'idle',
                total_files_found INT DEFAULT 0,
                total_scanned INT DEFAULT 0,
                matched_count INT DEFAULT 0,
                ambiguous_count INT DEFAULT 0,
                unmatched_count INT DEFAULT 0,
                unsupported_count INT DEFAULT 0,
                error_count INT DEFAULT 0,
                current_offset INT DEFAULT 0,
                batch_size INT DEFAULT 25,
                scan_directory VARCHAR(255) DEFAULT 'all',
                last_batch_time TIMESTAMP NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS media_scan_files (
                id VARCHAR(64) PRIMARY KEY,
                file_path VARCHAR(500) UNIQUE NOT NULL,
                filename VARCHAR(255) NOT NULL,
                file_size BIGINT NOT NULL,
                file_mtime BIGINT NOT NULL,
                file_extension VARCHAR(16) NOT NULL,
                media_type ENUM('audio', 'video', 'unsupported') NOT NULL,
                parsed_title VARCHAR(255) NULL,
                parsed_artist VARCHAR(255) NULL,
                parsed_album VARCHAR(255) NULL,
                tag_title VARCHAR(255) NULL,
                tag_artist VARCHAR(255) NULL,
                tag_album VARCHAR(255) NULL,
                matched_track_id VARCHAR(64) NULL,
                match_status ENUM('matched', 'ambiguous', 'unmatched', 'unsupported', 'error') DEFAULT 'unmatched',
                match_confidence INT DEFAULT 0,
                match_method VARCHAR(64) NULL,
                candidates_json MEDIUMTEXT NULL,
                error_message TEXT NULL,
                is_video TINYINT(1) DEFAULT 0,
                is_manually_corrected TINYINT(1) DEFAULT 0,
                last_scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_matched_track (matched_track_id),
                INDEX idx_match_status (match_status),
                INDEX idx_media_type (media_type),
                INDEX idx_file_ext (file_extension)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
    }

    /**
     * Return list of folders to recursively scan
     */
    public static function getScanDirectories(): array {
        $dirs = [];
        $base = realpath(__DIR__ . '/..');
        
        $candidates = [
            __DIR__ . '/storage/audio',
            __DIR__ . '/uploads',
            $base . '/uploads',
            $base . '/music'
        ];

        foreach ($candidates as $dir) {
            if (is_dir($dir)) {
                $real = realpath($dir);
                if ($real && !in_array($real, $dirs, true)) {
                    $dirs[] = $real;
                }
            }
        }

        return $dirs;
    }

    /**
     * Recursively find all files in target directories
     */
    public static function collectFiles(array $directories): array {
        $allFiles = [];
        $supported = array_merge(self::SUPPORTED_AUDIO_EXTENSIONS, self::SUPPORTED_VIDEO_EXTENSIONS);
        $projectRoot = realpath(__DIR__ . '/..') ?: dirname(__DIR__);

        foreach ($directories as $dir) {
            if (!is_dir($dir)) continue;

            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ($iterator as $item) {
                if ($item->isFile()) {
                    $ext = strtolower($item->getExtension());
                    if (in_array($ext, $supported, true)) {
                        $fullPath = $item->getRealPath();
                        // Compute relative path from project root (e.g. phpbackend/storage/audio/2026/10/song.mp3)
                        $relPath = str_replace('\\', '/', substr($fullPath, strlen($projectRoot)));
                        $relPath = ltrim($relPath, '/');

                        $allFiles[] = [
                            'full_path' => $fullPath,
                            'rel_path'  => $relPath,
                            'filename'  => $item->getFilename(),
                            'size'      => $item->getSize(),
                            'mtime'     => $item->getMTime(),
                            'ext'       => $ext,
                            'is_video'  => in_array($ext, self::SUPPORTED_VIDEO_EXTENSIONS, true) ? 1 : 0,
                            'media_type'=> in_array($ext, self::SUPPORTED_VIDEO_EXTENSIONS, true) ? 'video' : 'audio'
                        ];
                    }
                }
            }
        }

        // Sort by path for reproducible batching
        usort($allFiles, fn($a, $b) => strcmp($a['rel_path'], $b['rel_path']));
        return $allFiles;
    }

    /**
     * Normalizes a text string for fuzzy comparison
     */
    public static function normalizeString(?string $str): string {
        if ($str === null || $str === '') return '';
        $s = mb_strtolower($str, 'UTF-8');
        // Remove common audio / video promotional suffix noise
        $patterns = [
            '/\b(official\s+audio|official\s+video|official\s+music\s+video|official\s+lyric\s+video)\b/i',
            '/\b(official|audio|video|visualizer|lyrics|lyric|remix|hd|hq|1080p|720p|4k)\b/i',
            '/\b(feat\.|ft\.|featuring)\b[^\)\],]*/i',
            '/\b\d{8}_\d{6}\b/', // date timestamps like _20261019_171632
            '/\b[0-9a-f]{6}\b/'   // hex short hashes like _18c639
        ];
        foreach ($patterns as $pattern) {
            $s = preg_replace($pattern, ' ', $s);
        }
        // Replace symbols, brackets, hyphens, underscores with spaces
        $s = preg_replace('/[_\-\.\(\)\[\]\{\}\<\>\"\'`!?,;:#@\$\%\^\&\*\+\=\|\/\\\]+/', ' ', $s);
        // Collapse spaces
        $s = preg_replace('/\s+/', ' ', $s);
        return trim($s);
    }

    /**
     * Parse artist and title from filename
     */
    public static function parseFilenameMetadata(string $filename): array {
        $ext = pathinfo($filename, PATHINFO_EXTENSION);
        $baseName = pathinfo($filename, PATHINFO_FILENAME);

        // Strip timestamp/hash suffixes
        $clean = preg_replace('/_\d{8}_\d{6}$/', '', $baseName);
        $clean = preg_replace('/_[0-9a-f]{6}$/', '', $clean);

        $parsed = [
            'raw_base' => $baseName,
            'clean' => $clean,
            'title' => '',
            'artist' => '',
            'album' => ''
        ];

        // Pattern 1: Artist - Title
        if (strpos($clean, ' - ') !== false) {
            $parts = explode(' - ', $clean, 2);
            $parsed['artist'] = trim($parts[0]);
            $parsed['title'] = trim($parts[1]);
        } elseif (strpos($clean, '-') !== false && !str_starts_with($clean, 'trk_')) {
            $parts = explode('-', $clean, 2);
            $parsed['artist'] = trim($parts[0]);
            $parsed['title'] = trim($parts[1]);
        } elseif (strpos($clean, '_') !== false && !str_starts_with($clean, 'trk_') && !str_starts_with($clean, 'upl_')) {
            $parts = explode('_', $clean, 2);
            $parsed['artist'] = trim($parts[0]);
            $parsed['title'] = trim($parts[1]);
        } else {
            $parsed['title'] = $clean;
        }

        // Clean leading track numbers like "01 ", "01-", "01. "
        $parsed['title'] = preg_replace('/^\d{1,3}[\s\.\-_]+/', '', $parsed['title']);
        $parsed['artist'] = preg_replace('/^\d{1,3}[\s\.\-_]+/', '', $parsed['artist']);

        return $parsed;
    }

    /**
     * Read basic ID3v2 tags from MP3 and metadata from MP4/M4A atoms in pure PHP
     */
    public static function extractTags(string $fullPath, string $ext): array {
        $tags = ['title' => null, 'artist' => null, 'album' => null];
        if (!is_file($fullPath) || filesize($fullPath) < 512) {
            return $tags;
        }

        $fp = @fopen($fullPath, 'rb');
        if (!$fp) return $tags;

        try {
            if ($ext === 'mp3') {
                // Read first 10 bytes for ID3v2 header
                $header = fread($fp, 10);
                if (strlen($header) === 10 && substr($header, 0, 3) === 'ID3') {
                    $majorVer = ord($header[3]);
                    $tagSize = ((ord($header[6]) & 0x7f) << 21) |
                               ((ord($header[7]) & 0x7f) << 14) |
                               ((ord($header[8]) & 0x7f) << 7) |
                               (ord($header[9]) & 0x7f);

                    $readLimit = min(65536, $tagSize);
                    $tagData = fread($fp, $readLimit);

                    // Search for TIT2 (Title), TPE1 (Artist), TALB (Album)
                    $frames = ['TIT2' => 'title', 'TPE1' => 'artist', 'TALB' => 'album'];
                    foreach ($frames as $frameId => $target) {
                        $pos = strpos($tagData, $frameId);
                        if ($pos !== false && $pos + 10 < strlen($tagData)) {
                            $frameHeader = substr($tagData, $pos, 10);
                            $frameSize = $majorVer === 4
                                ? (((ord($frameHeader[4]) & 0x7f) << 21) | ((ord($frameHeader[5]) & 0x7f) << 14) | ((ord($frameHeader[6]) & 0x7f) << 7) | (ord($frameHeader[7]) & 0x7f))
                                : ((ord($frameHeader[4]) << 24) | (ord($frameHeader[5]) << 16) | (ord($frameHeader[6]) << 8) | ord($frameHeader[7]));

                            if ($frameSize > 1 && $frameSize < 500 && ($pos + 10 + $frameSize) <= strlen($tagData)) {
                                $rawContent = substr($tagData, $pos + 10, $frameSize);
                                $encoding = ord($rawContent[0]);
                                $text = substr($rawContent, 1);
                                if ($encoding === 1) { // UTF-16 with BOM
                                    $text = @mb_convert_encoding($text, 'UTF-8', 'UTF-16');
                                }
                                $text = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $text));
                                if ($text !== '') {
                                    $tags[$target] = $text;
                                }
                            }
                        }
                    }
                }
            } elseif (in_array($ext, ['m4a', 'mp4', 'm4v'], true)) {
                // Read up to 256KB to scan for atom tags
                $chunk = fread($fp, 262144);
                $atomMap = [
                    "\xa9nam" => 'title',
                    "\xa9ART" => 'artist',
                    "\xa9alb" => 'album'
                ];
                foreach ($atomMap as $atomKey => $target) {
                    $pos = strpos($chunk, $atomKey);
                    if ($pos !== false && $pos + 24 < strlen($chunk)) {
                        // In MP4 ilst, the atom header is followed by a 'data' atom
                        $dataPos = strpos($chunk, 'data', $pos);
                        if ($dataPos !== false && $dataPos < $pos + 30) {
                            $dataSize = (ord($chunk[$dataPos - 4]) << 24) | (ord($chunk[$dataPos - 3]) << 16) | (ord($chunk[$dataPos - 2]) << 8) | ord($chunk[$dataPos - 1]);
                            $textLen = max(0, $dataSize - 16);
                            if ($textLen > 0 && $textLen < 300 && ($dataPos + 12 + $textLen) <= strlen($chunk)) {
                                $rawText = substr($chunk, $dataPos + 12, $textLen);
                                $clean = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $rawText));
                                if ($clean !== '') {
                                    $tags[$target] = $clean;
                                }
                            }
                        }
                    }
                }
            }
        } catch (Throwable $e) {
            // Non-fatal if parsing metadata tags encounters malformed atom
        } finally {
            fclose($fp);
        }

        return $tags;
    }

    /**
     * Compute matching score between a file and a candidate track record
     */
    public static function evaluateMatch(array $fileInfo, array $parsedMeta, array $tags, array $track): array {
        $score = 0;
        $reasons = [];

        $filename = $fileInfo['filename'];
        $baseName = pathinfo($filename, PATHINFO_FILENAME);
        $ext = $fileInfo['ext'];
        $isVideo = $fileInfo['is_video'] === 1;

        $trackId = $track['id'];
        $videoId = $track['video_id'] ?? '';
        $trackTitle = $track['title'] ?? '';
        $artistName = $track['artist_name'] ?? '';
        $albumName = $track['album_name'] ?? '';

        // Check 1: Exact track ID match
        if ($baseName === $trackId) {
            return [
                'score' => 100,
                'method' => 'exact_id',
                'confidence' => 100,
                'reasons' => ['Exact track ID match in filename']
            ];
        }

        // Check 2: Track ID prefix match (e.g. trk_yt_2u2Z07ujyD8_18c639)
        $cleanId = preg_replace('/_[0-9a-f]{6}$/', '', $baseName);
        $cleanId = preg_replace('/_\d{8}_\d{6}$/', '', $cleanId);
        if ($cleanId === $trackId) {
            return [
                'score' => 99,
                'method' => 'id_with_hash_suffix',
                'confidence' => 99,
                'reasons' => ['Track ID with timestamp/hash suffix matched']
            ];
        }

        // Check 3: Exact video_id match
        if (!empty($videoId)) {
            if ($baseName === $videoId || $cleanId === "trk_yt_{$videoId}" || $cleanId === $videoId) {
                return [
                    'score' => 98,
                    'method' => 'video_id_exact',
                    'confidence' => 98,
                    'reasons' => ['Exact YouTube/Video ID match in filename']
                ];
            }
            if (strpos($baseName, $videoId) !== false) {
                $score += 85;
                $reasons[] = 'Filename contains video ID';
            }
        }

        // Check 4: ID3 / atom tag match
        $tagTitle = $tags['title'] ?? '';
        $tagArtist = $tags['artist'] ?? '';
        if (!empty($tagTitle)) {
            $normTagTitle = self::normalizeString($tagTitle);
            $normTrackTitle = self::normalizeString($trackTitle);
            if ($normTagTitle === $normTrackTitle && !empty($normTagTitle)) {
                $score += 45;
                $reasons[] = 'Tag title matches exactly';
            } elseif (!empty($normTagTitle) && (strpos($normTrackTitle, $normTagTitle) !== false || strpos($normTagTitle, $normTrackTitle) !== false)) {
                $score += 30;
                $reasons[] = 'Tag title fuzzy match';
            }
        }
        if (!empty($tagArtist)) {
            $normTagArtist = self::normalizeString($tagArtist);
            $normArtist = self::normalizeString($artistName);
            if ($normTagArtist === $normArtist && !empty($normTagArtist)) {
                $score += 35;
                $reasons[] = 'Tag artist matches';
            } elseif (!empty($normTagArtist) && (strpos($normArtist, $normTagArtist) !== false || strpos($normTagArtist, $normArtist) !== false)) {
                $score += 20;
                $reasons[] = 'Tag artist fuzzy match';
            }
        }

        // Check 5: Parsed filename Title & Artist
        $fileTitleNorm = self::normalizeString($parsedMeta['title'] ?: $parsedMeta['clean']);
        $trackTitleNorm = self::normalizeString($trackTitle);
        $fileArtistNorm = self::normalizeString($parsedMeta['artist']);
        $trackArtistNorm = self::normalizeString($artistName);

        if (!empty($fileTitleNorm) && !empty($trackTitleNorm)) {
            if ($fileTitleNorm === $trackTitleNorm) {
                $score += 55;
                $reasons[] = 'Filename normalized title exact match';
            } elseif (strpos($trackTitleNorm, $fileTitleNorm) !== false || strpos($fileTitleNorm, $trackTitleNorm) !== false) {
                $ratio = min(strlen($fileTitleNorm), strlen($trackTitleNorm)) / max(strlen($fileTitleNorm), strlen($trackTitleNorm));
                if ($ratio > 0.6) {
                    $score += (int)(45 * $ratio);
                    $reasons[] = 'Filename title substring match';
                }
            } else {
                // Levenshtein similarity on normalized titles
                $lev = levenshtein($fileTitleNorm, $trackTitleNorm);
                $maxLen = max(strlen($fileTitleNorm), strlen($trackTitleNorm));
                if ($maxLen > 0) {
                    $sim = 1 - ($lev / $maxLen);
                    if ($sim > 0.75) {
                        $score += (int)(40 * $sim);
                        $reasons[] = 'High Levenshtein title similarity (' . round($sim * 100) . '%)';
                    }
                }
            }
        }

        if (!empty($fileArtistNorm) && !empty($trackArtistNorm)) {
            if ($fileArtistNorm === $trackArtistNorm) {
                $score += 35;
                $reasons[] = 'Filename artist exact match';
            } elseif (strpos($trackArtistNorm, $fileArtistNorm) !== false || strpos($fileArtistNorm, $trackArtistNorm) !== false) {
                $score += 25;
                $reasons[] = 'Filename artist substring match';
            }
        }

        // Safety adjustment for video files (Requirement 8)
        // If it's a video file, require strong corroborating evidence
        if ($isVideo) {
            if (empty($videoId) && empty($fileArtistNorm) && empty($tagArtist) && $score < 90) {
                // Without artist confirmation or video id, penalize video file to prevent false positives
                $score = (int)($score * 0.85);
                $reasons[] = 'Video file safety adjustment applied';
            }
        }

        $finalConfidence = min(100, max(0, $score));
        $method = 'fuzzy_metadata';
        if ($finalConfidence >= 95) {
            $method = 'high_confidence_title_artist';
        } elseif ($finalConfidence >= self::HIGH_CONFIDENCE_THRESHOLD) {
            $method = 'title_heuristic';
        } elseif ($finalConfidence >= self::AMBIGUOUS_THRESHOLD) {
            $method = 'ambiguous_candidate';
        } else {
            $method = 'low_confidence';
        }

        return [
            'score' => $finalConfidence,
            'confidence' => $finalConfidence,
            'method' => $method,
            'reasons' => $reasons
        ];
    }

    /**
     * Run a batch scan across server files
     * Resumable, tracks progress, skips unchanged files, detects new files
     */
    public static function processBatch(PDO $pdo, int $batchSize = 25, bool $force = false): array {
        self::ensureTables($pdo);

        // Fetch or create the active run
        $stmtRun = $pdo->query("SELECT * FROM media_scan_runs ORDER BY started_at DESC LIMIT 1");
        $activeRun = $stmtRun->fetch();

        $scanDirs = self::getScanDirectories();
        $allFiles = self::collectFiles($scanDirs);
        $totalFiles = count($allFiles);

        if (!$activeRun || $activeRun['status'] === 'completed' || $force) {
            $runId = 'run_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3));
            $pdo->prepare("
                INSERT INTO media_scan_runs (id, status, total_files_found, total_scanned, batch_size, started_at)
                VALUES (?, 'running', ?, 0, ?, NOW())
            ")->execute([$runId, $totalFiles, $batchSize]);
            $offset = 0;
            $activeRunId = $runId;
        } else {
            $activeRunId = $activeRun['id'];
            $offset = (int)$activeRun['current_offset'];
            if ($offset >= $totalFiles) {
                // Mark completed
                $pdo->prepare("UPDATE media_scan_runs SET status = 'completed', completed_at = NOW() WHERE id = ?")
                    ->execute([$activeRunId]);
                return self::getRunSummary($pdo, $activeRunId);
            }
        }

        // Fetch all active tracks from database for catalog lookup
        $catalogStmt = $pdo->query("
            SELECT id, video_id, title, artist_name, album_name, local_audio_path, duration, genre, cover_art_url 
            FROM tracks 
            WHERE is_deleted = 0
        ");
        $tracks = $catalogStmt->fetchAll();

        // Index catalog for ultra-fast lookup
        $tracksById = [];
        $tracksByVideoId = [];
        $tracksByNormTitle = [];

        foreach ($tracks as $t) {
            $tracksById[$t['id']] = $t;
            if (!empty($t['video_id'])) {
                $tracksByVideoId[$t['video_id']] = $t;
            }
            $nt = self::normalizeString($t['title']);
            if ($nt !== '') {
                $tracksByNormTitle[$nt][] = $t;
            }
        }

        $slice = array_slice($allFiles, $offset, $batchSize);
        $batchProcessed = 0;
        $batchMatched = 0;
        $batchAmbiguous = 0;
        $batchUnmatched = 0;
        $batchUnsupported = 0;
        $batchErrors = 0;

        $projectRoot = realpath(__DIR__ . '/..') ?: dirname(__DIR__);

        foreach ($slice as $file) {
            $batchProcessed++;
            $relPath = $file['rel_path'];
            $fullPath = $file['full_path'];
            $size = (int)$file['size'];
            $mtime = (int)$file['mtime'];
            $ext = $file['ext'];
            $isVideo = (int)$file['is_video'];
            $filename = $file['filename'];

            // Check if unchanged and already matched
            $existingStmt = $pdo->prepare("SELECT * FROM media_scan_files WHERE file_path = ?");
            $existingStmt->execute([$relPath]);
            $existing = $existingStmt->fetch();

            if ($existing && !$force && (int)$existing['file_size'] === $size && (int)$existing['file_mtime'] === $mtime) {
                if ($existing['match_status'] === 'matched') {
                    $batchMatched++;
                    continue;
                }
            }

            // Extract tags & parsed filename
            $parsedMeta = self::parseFilenameMetadata($filename);
            $tags = self::extractTags($fullPath, $ext);

            // Candidate evaluation
            $candidates = [];
            $bestMatch = null;
            $bestScore = 0;
            $bestMethod = null;

            // Direct ID test
            $baseName = pathinfo($filename, PATHINFO_FILENAME);
            if (isset($tracksById[$baseName])) {
                $bestMatch = $tracksById[$baseName];
                $bestScore = 100;
                $bestMethod = 'exact_id';
            } else {
                $cleanId = preg_replace('/_[0-9a-f]{6}$/', '', $baseName);
                $cleanId = preg_replace('/_\d{8}_\d{6}$/', '', $cleanId);
                if (isset($tracksById[$cleanId])) {
                    $bestMatch = $tracksById[$cleanId];
                    $bestScore = 99;
                    $bestMethod = 'id_hash_suffix';
                } elseif (!empty($tracksByVideoId[$cleanId])) {
                    $bestMatch = $tracksByVideoId[$cleanId];
                    $bestScore = 98;
                    $bestMethod = 'video_id';
                }
            }

            // If not found by direct ID, score all potential candidates
            if (!$bestMatch) {
                foreach ($tracks as $t) {
                    $eval = self::evaluateMatch($file, $parsedMeta, $tags, $t);
                    if ($eval['score'] >= self::AMBIGUOUS_THRESHOLD) {
                        $candidates[] = [
                            'track_id'     => $t['id'],
                            'title'        => $t['title'],
                            'artist_name'  => $t['artist_name'],
                            'album_name'   => $t['album_name'],
                            'cover_art_url'=> $t['cover_art_url'],
                            'score'        => $eval['score'],
                            'confidence'   => $eval['confidence'],
                            'method'       => $eval['method'],
                            'reasons'      => $eval['reasons']
                        ];
                        if ($eval['score'] > $bestScore) {
                            $bestScore = $eval['score'];
                            $bestMatch = $t;
                            $bestMethod = $eval['method'];
                        }
                    }
                }
            }

            // Sort candidate tracks descending by score
            usort($candidates, fn($a, $b) => $b['score'] <=> $a['score']);
            $topCandidates = array_slice($candidates, 0, 5);

            $matchStatus = 'unmatched';
            $matchedTrackId = null;

            if ($bestMatch && $bestScore >= self::HIGH_CONFIDENCE_THRESHOLD) {
                // If there's another candidate with an almost identical score, mark ambiguous instead of wrong match
                if (count($topCandidates) > 1 && ($topCandidates[0]['score'] - $topCandidates[1]['score']) < 5 && $bestScore < 95) {
                    $matchStatus = 'ambiguous';
                    $batchAmbiguous++;
                } else {
                    $matchStatus = 'matched';
                    $matchedTrackId = $bestMatch['id'];
                    $batchMatched++;

                    // Database Integration: link file to track record!
                    // Preserve existing IDs, artwork, albums, artist relations, metadata
                    $streamUrl = "/phpbackend/api/stream.php?id=" . urlencode($bestMatch['id']);
                    $pdo->prepare("
                        UPDATE tracks 
                        SET local_audio_path = ?, audio_file_size = ?, audio_format = ?, audio_url = ?, import_status = 'synced', last_synced_at = NOW()
                        WHERE id = ?
                    ")->execute([
                        $relPath,
                        $size,
                        $ext,
                        $streamUrl,
                        $bestMatch['id']
                    ]);
                }
            } elseif ($bestMatch && $bestScore >= self::AMBIGUOUS_THRESHOLD) {
                $matchStatus = 'ambiguous';
                $batchAmbiguous++;
            } else {
                $matchStatus = 'unmatched';
                $batchUnmatched++;
            }

            $fileRecordId = 'scf_' . md5($relPath);
            $candidatesJson = !empty($topCandidates) ? json_encode($topCandidates, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null;

            // Upsert scan file record
            $upsertSql = "
                INSERT INTO media_scan_files (
                    id, file_path, filename, file_size, file_mtime, file_extension, media_type,
                    parsed_title, parsed_artist, parsed_album, tag_title, tag_artist, tag_album,
                    matched_track_id, match_status, match_confidence, match_method, candidates_json,
                    is_video, last_scanned_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, NOW()
                ) ON DUPLICATE KEY UPDATE
                    file_size = VALUES(file_size),
                    file_mtime = VALUES(file_mtime),
                    parsed_title = VALUES(parsed_title),
                    parsed_artist = VALUES(parsed_artist),
                    tag_title = VALUES(tag_title),
                    tag_artist = VALUES(tag_artist),
                    matched_track_id = IF(is_manually_corrected = 1, matched_track_id, VALUES(matched_track_id)),
                    match_status = IF(is_manually_corrected = 1, match_status, VALUES(match_status)),
                    match_confidence = IF(is_manually_corrected = 1, match_confidence, VALUES(match_confidence)),
                    match_method = IF(is_manually_corrected = 1, match_method, VALUES(match_method)),
                    candidates_json = VALUES(candidates_json),
                    last_scanned_at = NOW()
            ";
            $pdo->prepare($upsertSql)->execute([
                $fileRecordId,
                $relPath,
                $filename,
                $size,
                $mtime,
                $ext,
                $file['media_type'],
                $parsedMeta['title'] ?: null,
                $parsedMeta['artist'] ?: null,
                $parsedMeta['album'] ?: null,
                $tags['title'] ?: null,
                $tags['artist'] ?: null,
                $tags['album'] ?: null,
                $matchedTrackId,
                $matchStatus,
                $bestScore,
                $bestMethod,
                $candidatesJson,
                $isVideo
            ]);
        }

        // Update active run stats
        $newOffset = $offset + count($slice);
        $isComplete = $newOffset >= $totalFiles;
        $status = $isComplete ? 'completed' : 'running';

        // Recompute aggregate counts from database for accuracy
        $counts = self::getDatabaseCounts($pdo);

        $pdo->prepare("
            UPDATE media_scan_runs 
            SET total_files_found = ?,
                total_scanned = ?,
                matched_count = ?,
                ambiguous_count = ?,
                unmatched_count = ?,
                unsupported_count = ?,
                error_count = ?,
                current_offset = ?,
                status = ?,
                last_batch_time = NOW(),
                completed_at = IF(? = 'completed', NOW(), completed_at)
            WHERE id = ?
        ")->execute([
            $totalFiles,
            $counts['total_scanned'],
            $counts['matched'],
            $counts['ambiguous'],
            $counts['unmatched'],
            $counts['unsupported'],
            $counts['error'],
            $newOffset,
            $status,
            $status,
            $activeRunId
        ]);

        return [
            'run_id'        => $activeRunId,
            'status'        => $status,
            'is_complete'   => $isComplete,
            'offset'        => $newOffset,
            'total_files'   => $totalFiles,
            'batch_size'    => count($slice),
            'percent'       => $totalFiles > 0 ? round(($newOffset / $totalFiles) * 100, 1) : 100,
            'counts'        => $counts
        ];
    }

    /**
     * Compute current database file counts
     */
    public static function getDatabaseCounts(PDO $pdo): array {
        self::ensureTables($pdo);

        $totalScanned = (int)$pdo->query("SELECT COUNT(*) FROM media_scan_files")->fetchColumn();
        $matched = (int)$pdo->query("SELECT COUNT(*) FROM media_scan_files WHERE match_status = 'matched'")->fetchColumn();
        $ambiguous = (int)$pdo->query("SELECT COUNT(*) FROM media_scan_files WHERE match_status = 'ambiguous'")->fetchColumn();
        $unmatched = (int)$pdo->query("SELECT COUNT(*) FROM media_scan_files WHERE match_status = 'unmatched'")->fetchColumn();
        $unsupported = (int)$pdo->query("SELECT COUNT(*) FROM media_scan_files WHERE match_status = 'unsupported'")->fetchColumn();
        $errors = (int)$pdo->query("SELECT COUNT(*) FROM media_scan_files WHERE match_status = 'error'")->fetchColumn();
        $videoCount = (int)$pdo->query("SELECT COUNT(*) FROM media_scan_files WHERE is_video = 1")->fetchColumn();

        return [
            'total_scanned' => $totalScanned,
            'matched'       => $matched,
            'ambiguous'     => $ambiguous,
            'unmatched'     => $unmatched,
            'unsupported'   => $unsupported,
            'error'         => $errors,
            'video_files'   => $videoCount
        ];
    }

    /**
     * Manual link or correction by administrator
     */
    public static function manualLink(PDO $pdo, string $fileId, string $trackId): array {
        self::ensureTables($pdo);

        $fileStmt = $pdo->prepare("SELECT * FROM media_scan_files WHERE id = ?");
        $fileStmt->execute([$fileId]);
        $file = $fileStmt->fetch();

        if (!$file) {
            throw new Exception("Media scan file not found: {$fileId}");
        }

        $trackStmt = $pdo->prepare("SELECT * FROM tracks WHERE id = ? AND is_deleted = 0");
        $trackStmt->execute([$trackId]);
        $track = $trackStmt->fetch();

        if (!$track) {
            throw new Exception("Catalog track not found: {$trackId}");
        }

        $streamUrl = "/phpbackend/api/stream.php?id=" . urlencode($track['id']);
        $pdo->prepare("
            UPDATE tracks 
            SET local_audio_path = ?, audio_file_size = ?, audio_format = ?, audio_url = ?, import_status = 'synced', last_synced_at = NOW()
            WHERE id = ?
        ")->execute([
            $file['file_path'],
            $file['file_size'],
            $file['file_extension'],
            $streamUrl,
            $track['id']
        ]);

        $pdo->prepare("
            UPDATE media_scan_files 
            SET matched_track_id = ?, match_status = 'matched', match_confidence = 100, match_method = 'manual_linked', is_manually_corrected = 1, last_scanned_at = NOW()
            WHERE id = ?
        ")->execute([
            $track['id'],
            $fileId
        ]);

        return [
            'status' => 'success',
            'message' => "Successfully linked {$file['filename']} to '{$track['title']}' by {$track['artist_name']}",
            'track' => $track,
            'file' => $file
        ];
    }

    /**
     * Unlink file association
     */
    public static function unlinkFile(PDO $pdo, string $fileId): array {
        self::ensureTables($pdo);

        $fileStmt = $pdo->prepare("SELECT * FROM media_scan_files WHERE id = ?");
        $fileStmt->execute([$fileId]);
        $file = $fileStmt->fetch();

        if (!$file) {
            throw new Exception("Media scan file not found: {$fileId}");
        }

        if (!empty($file['matched_track_id'])) {
            $pdo->prepare("
                UPDATE tracks 
                SET local_audio_path = NULL, import_status = 'unlinked'
                WHERE id = ? AND local_audio_path = ?
            ")->execute([$file['matched_track_id'], $file['file_path']]);
        }

        $pdo->prepare("
            UPDATE media_scan_files 
            SET matched_track_id = NULL, match_status = 'unmatched', match_confidence = 0, match_method = NULL, is_manually_corrected = 1, last_scanned_at = NOW()
            WHERE id = ?
        ")->execute([$fileId]);

        return [
            'status' => 'success',
            'message' => "File {$file['filename']} unlinked from catalog."
        ];
    }

    /**
     * Get run summary
     */
    public static function getRunSummary(PDO $pdo, ?string $runId = null): array {
        self::ensureTables($pdo);
        if ($runId) {
            $stmt = $pdo->prepare("SELECT * FROM media_scan_runs WHERE id = ?");
            $stmt->execute([$runId]);
            $run = $stmt->fetch();
        } else {
            $run = $pdo->query("SELECT * FROM media_scan_runs ORDER BY started_at DESC LIMIT 1")->fetch();
        }

        $counts = self::getDatabaseCounts($pdo);
        return [
            'run'    => $run ?: null,
            'counts' => $counts
        ];
    }

    /**
     * Cron runner function (can be invoked from CLI or secure HTTP endpoint)
     */
    public static function runCron(PDO $pdo, int $maxBatches = 10, int $batchSize = 25): array {
        $runs = 0;
        $summary = null;

        while ($runs < $maxBatches) {
            $res = self::processBatch($pdo, $batchSize, false);
            $summary = $res;
            $runs++;
            if ($res['is_complete']) {
                break;
            }
        }

        return [
            'batches_executed' => $runs,
            'last_batch'       => $summary
        ];
    }
}
