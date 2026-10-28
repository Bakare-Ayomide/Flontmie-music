<?php
/**
 * Flontmie Artist Profile, Verified Artwork & Local Catalog Discography Engine
 * Strictly serves Admin, Distributor, Label, and Artist uploaded records from MySQL.
 * Zero YouTube Music API scraping, zero external mock stream figures.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/media_engine.php';

class ArtistEnrichment {

    public static array $KNOWN_ARTISTS = [
        'art_burnaboy'     => ['name' => 'Burna Boy',     'wiki' => 'Burna_Boy',     'genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'Spaceship / Atlantic Records'],
        'art_burna_boy'    => ['name' => 'Burna Boy',     'wiki' => 'Burna_Boy',     'genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'Spaceship / Atlantic Records'],
        'art_davido'       => ['name' => 'Davido',        'wiki' => 'Davido',        'genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'DMW / Sony Music'],
        'art_wizkid'       => ['name' => 'Wizkid',        'wiki' => 'Wizkid',        'genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'Starboy / RCA Records'],
        'art_bellashmurda' => ['name' => 'Bella Shmurda', 'wiki' => 'Bella_Shmurda', 'genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'Dangbana Republik'],
        'art_fola'         => ['name' => 'FOLA',          'wiki' => 'Fola_(musician)','genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'Catharsis Music'],
        'art_olamide'      => ['name' => 'Olamide',       'wiki' => 'Olamide',       'genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'YBNL Nation'],
        'art_odumodublvck' => ['name' => 'ODUMODUBLVCK',  'wiki' => 'Odumodublvck',  'genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'Native Records / Def Jam'],
        'art_asake'        => ['name' => 'Asake',         'wiki' => 'Asake',         'genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'YBNL Nation / EMPIRE'],
        'art_djmaphorisa'  => ['name' => 'DJ Maphorisa',  'wiki' => 'DJ_Maphorisa',  'genre' => 'Afrobeats', 'country' => 'ZA', 'label' => 'New Money Gang'],
        'art_txc'          => ['name' => 'TxC',           'wiki' => 'TxC',           'genre' => 'Afrobeats', 'country' => 'ZA', 'label' => 'Amapiano Collective'],
        'art_zlatan'       => ['name' => 'Zlatan',        'wiki' => 'Zlatan_(musician)', 'genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'Zanku Records'],
    ];

    public static array $VERIFIED_ARTWORK = [
        'c2gK9tq57iQ' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/01/ee/63/01ee6370-1805-15e4-de8c-293a889a439c/075679676351.jpg/600x600bb.jpg',
        'art_burna_boy' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/01/ee/63/01ee6370-1805-15e4-de8c-293a889a439c/075679676351.jpg/600x600bb.jpg',
        'art_burnaboy' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/01/ee/63/01ee6370-1805-15e4-de8c-293a889a439c/075679676351.jpg/600x600bb.jpg',
        'art_davido' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a8/fb/21/a8fb21ed-2106-199e-75dc-f01099c29394/196874507544.jpg/600x600bb.jpg',
        'B9tN8R4dY2M' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a8/fb/21/a8fb21ed-2106-199e-75dc-f01099c29394/196874507544.jpg/600x600bb.jpg',
        'K7pL3mN9qR4' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a8/fb/21/a8fb21ed-2106-199e-75dc-f01099c29394/196874507544.jpg/600x600bb.jpg',
        'art_fola' => 'https://i.ytimg.com/vi/f0H2UbU-K8E/hqdefault.jpg',
        'W8mK2pL5tQ9' => 'https://i.ytimg.com/vi/f0H2UbU-K8E/hqdefault.jpg',
        'H4nL9pM2vR7' => 'https://i.ytimg.com/vi/f0H2UbU-K8E/hqdefault.jpg',
        'J9kL4mN8pQ2' => 'https://i.ytimg.com/vi/f0H2UbU-K8E/hqdefault.jpg',
        'art_wizkid' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/62/36/e8/6236e8a3-c34e-fcb0-c3e7-0a41db66c6ad/196873749570.jpg/600x600bb.jpg',
        'Fv9kL2mN5pQ' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/62/36/e8/6236e8a3-c34e-fcb0-c3e7-0a41db66c6ad/196873749570.jpg/600x600bb.jpg',
        'Ks4mL8nP2qR' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/62/36/e8/6236e8a3-c34e-fcb0-c3e7-0a41db66c6ad/196873749570.jpg/600x600bb.jpg',
        'Ml7nP3qR9tW' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/62/36/e8/6236e8a3-c34e-fcb0-c3e7-0a41db66c6ad/196873749570.jpg/600x600bb.jpg',
        'Tb2mN6pQ8rW' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/62/36/e8/6236e8a3-c34e-fcb0-c3e7-0a41db66c6ad/196873749570.jpg/600x600bb.jpg',
        'Sb9mN4pQ2rW' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/62/36/e8/6236e8a3-c34e-fcb0-c3e7-0a41db66c6ad/196873749570.jpg/600x600bb.jpg',
        'art_bellashmurda' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/84/bd/07/84bd0709-6d90-1be4-4212-babf5729a85d/199316770292_cover.jpg/600x600bb.jpg',
        'P1zG3tLp0wY' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/84/bd/07/84bd0709-6d90-1be4-4212-babf5729a85d/199316770292_cover.jpg/600x600bb.jpg',
        'art_olamide' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/ba/6d/fb/ba6dfb0f-3eb5-d02a-79f6-6a4483231e13/199316074352_cover.jpg/600x600bb.jpg',
        'T5kL8mN3pR9' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/ba/6d/fb/ba6dfb0f-3eb5-d02a-79f6-6a4483231e13/199316074352_cover.jpg/600x600bb.jpg',
        'art_djmaphorisa' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/ec/2a/4c/ec2a4c8a-b98b-50ac-a386-94f92788ac59/6009710469873.jpg/600x600bb.jpg',
        'Mc6nP9qR4tW' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/ec/2a/4c/ec2a4c8a-b98b-50ac-a386-94f92788ac59/6009710469873.jpg/600x600bb.jpg',
        'art_odumodublvck' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/24/00/61/24006185-de26-141f-72f5-92c192f90bb9/25UMGIM51411.rgb.jpg/600x600bb.jpg',
        'Bt5mN8pQ3rW' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/24/00/61/24006185-de26-141f-72f5-92c192f90bb9/25UMGIM51411.rgb.jpg/600x600bb.jpg',
        'art_txc' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/57/ae/ce/57aece01-ca70-5691-2f2f-04cec810e535/198588056394.jpg/600x600bb.jpg',
        'Nk8mP2qR7tW' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/57/ae/ce/57aece01-ca70-5691-2f2f-04cec810e535/198588056394.jpg/600x600bb.jpg',
        'art_asake' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/31/e4/eb/31e4ebf4-97bd-c193-59c7-1b72ed7ab53a/ticket.wlorjbae.jpg/600x600bb.jpg',
        'art_zlatan' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/2f/4e/0e/2f4e0ee0-72b2-e111-5296-5247fb04f489/701575484911_Cover.jpg/600x600bb.jpg',
    ];

    public static function resolveArtworkUrl(?string $url, ?string $lookupKey = null): string {
        $trimmed = trim((string)$url);

        if ($lookupKey && isset(self::$VERIFIED_ARTWORK[$lookupKey])) {
            return self::$VERIFIED_ARTWORK[$lookupKey];
        }

        foreach (self::$VERIFIED_ARTWORK as $key => $verifiedUrl) {
            if ($trimmed !== '' && strpos($trimmed, $key) !== false) {
                return $verifiedUrl;
            }
        }

        if ($trimmed !== '' && strpos($trimmed, 'i.ytimg.com/vi/') !== false && strpos($trimmed, '/maxresdefault.jpg') !== false) {
            return str_replace('/maxresdefault.jpg', '/hqdefault.jpg', $trimmed);
        }

        if ($trimmed !== '' && (strpos($trimmed, 'googleusercontent.com') !== false || strpos($trimmed, 'ggpht.com') !== false)) {
            $trimmed = preg_replace('/=w\d+-h\d+/', '=w544-h544', $trimmed);
        }

        return $trimmed;
    }

    public static function parseMetric(?string $raw): array {
        if (empty($raw)) {
            return ['compact' => null, 'numeric' => null];
        }
        $clean = trim($raw);
        $noCommas = str_replace(',', '', $clean);
        if (preg_match('/^(\d+)$/', $noCommas, $m)) {
            $num = (int)$m[1];
            return ['compact' => (string)$num, 'numeric' => $num];
        }
        return ['compact' => null, 'numeric' => null];
    }

    public static function hasVerifiedFile(?string $rawRelPath): ?string {
        if (empty($rawRelPath)) return null;
        $rel = ltrim(trim($rawRelPath), '/');
        $relStripped = preg_replace('#^phpbackend/storage/#', '', $rel);
        $projectRoot = realpath(__DIR__ . '/..') ?: dirname(__DIR__);
        foreach ([STORAGE_ROOT . '/' . $rel, STORAGE_ROOT . '/' . $relStripped, BASE_DIR . '/' . $rel, $projectRoot . '/' . $rel] as $cand) {
            if (is_file($cand) && is_readable($cand)) {
                $fsize = (int)@filesize($cand);
                $ext = strtolower(pathinfo($cand, PATHINFO_EXTENSION));
                $bname = basename($cand);
                if ($ext === 'wav' && $fsize === 705644) continue;
                if ($ext === 'm4a' && strpos($bname, 'trk_yt_') === 0 && $fsize < 1500000) continue;
                if ($fsize > 4096) {
                    return $cand;
                }
            }
        }
        return null;
    }

    public static function fetchWikipediaBiography(string $artistName, ?string $wikiSlugOverride = null): array {
        $cacheDir = STORAGE_ROOT . '/cache/wiki';
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0755, true);
        }

        $safeKey = preg_replace('/[^a-zA-Z0-9_-]/', '_', strtolower($artistName));
        $cacheFile = "{$cacheDir}/{$safeKey}.json";
        if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < 86400 * 7) {
            $cached = json_decode((string)file_get_contents($cacheFile), true);
            if (is_array($cached) && !empty($cached['bio'])) {
                return $cached;
            }
        }

        return [
            'bio' => null,
            'bio_source' => null,
            'bio_url' => null,
            'wikidata_id' => null,
            'image_url' => null
        ];
    }

    /**
     * Returns an ArtistProfile strictly populated from real uploaded MySQL tracks and albums
     * with real Flontmie stream counts (`flontmie_plays`).
     */
    public static function getEnrichedArtistProfile(PDO $pdo, string $identifier): ?array {
        $stmt = $pdo->prepare("SELECT * FROM artists WHERE id = ? OR slug = ? OR LOWER(name) = LOWER(?) LIMIT 1");
        $stmt->execute([$identifier, $identifier, $identifier]);
        $artist = $stmt->fetch();

        if (!$artist) {
            // Check if there are uploaded tracks matching this artist_id or artist_name
            $tChk = $pdo->prepare("SELECT artist_id, artist_name, cover_art_url, genre, country FROM tracks WHERE (artist_id = ? OR LOWER(artist_name) = LOWER(?)) AND is_deleted = 0 LIMIT 1");
            $tChk->execute([$identifier, $identifier]);
            $tRow = $tChk->fetch();
            if (!$tRow) {
                return null;
            }
            $newId = !empty($tRow['artist_id']) ? $tRow['artist_id'] : ('art_' . substr(md5(strtolower($tRow['artist_name'])), 0, 10));
            $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $tRow['artist_name']));
            $pdo->prepare("
                INSERT IGNORE INTO artists (id, name, stage_name, slug, avatar_url, header_url, bio, country, verified, monthly_listeners, total_streams, followers, genres_json, claimed_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 0, ?, 'unclaimed')
            ")->execute([
                $newId,
                $tRow['artist_name'],
                $tRow['artist_name'],
                $slug,
                $tRow['cover_art_url'] ?? '',
                $tRow['cover_art_url'] ?? '',
                '',
                $tRow['country'] ?? 'NG',
                json_encode([$tRow['genre'] ?? 'Afrobeats'])
            ]);
            $stmt->execute([$newId, $newId, $tRow['artist_name']]);
            $artist = $stmt->fetch();
        }

        if (!$artist) {
            return null;
        }

        $artId = $artist['id'];
        $wikiData = self::fetchWikipediaBiography($artist['name']);

        $trkStmt = $pdo->prepare("
            SELECT * FROM tracks
            WHERE (artist_id = ? OR LOWER(artist_name) = LOWER(?))
              AND is_deleted = 0
              AND (status IS NULL OR status = 'published' OR status = 'active')
            ORDER BY flontmie_plays DESC, created_at DESC
        ");
        $trkStmt->execute([$artId, $artist['name']]);
        $dbTracks = $trkStmt->fetchAll();

        $flontmieStreamsTotal = 0;
        $popularSongs = [];
        $albums = [];
        $singlesEps = [];
        $seenAlbums = [];
        $seenSingles = [];

        foreach ($dbTracks as $t) {
            $verAudio = self::hasVerifiedFile($t['local_audio_path'] ?? null);
            $verVideo = self::hasVerifiedFile($t['local_video_path'] ?? null);
            if ($verAudio === null && $verVideo === null) {
                continue;
            }

            $fPlays = (int)($t['flontmie_plays'] ?? 0);
            $flontmieStreamsTotal += $fPlays;
            $t['cover_art_url'] = self::resolveArtworkUrl($t['cover_art_url'] ?? '', $t['video_id'] ?? $t['id']);
            $t['mood_tags'] = !empty($t['mood_tags_json']) ? json_decode($t['mood_tags_json'], true) : [];
            $t['has_local_audio'] = true;
            $t['has_local_video'] = ($verVideo !== null);
            $t['audio_url'] = '/phpbackend/api/stream.php?id=' . urlencode($t['id']);
            $t['video_url'] = ($verVideo !== null) ? ('/phpbackend/api/stream.php?id=' . urlencode($t['id']) . '&type=video') : null;
            $t['stream_count'] = $fPlays;
            $t['flontmie_plays'] = $fPlays;
            $t['yt_plays'] = null;
            unset($t['local_audio_path'], $t['local_artwork_path'], $t['local_video_path'], $t['local_lyrics_path']);

            $popularSongs[] = $t;

            $albName = trim($t['album_name'] ?? 'Single');
            $albKey = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $albName));
            if ($albKey && stripos($albName, 'single') === false && !isset($seenAlbums[$albKey])) {
                $seenAlbums[$albKey] = true;
                $albums[] = [
                    'id' => $t['album_id'] ?: ('alb_' . substr(md5($albName), 0, 8)),
                    'title' => $albName,
                    'artist' => $artist['name'],
                    'artist_id' => $artId,
                    'year' => (string)($t['release_year'] ?? '2026'),
                    'type' => 'Album',
                    'cover_url' => $t['cover_art_url'],
                    'tracks' => [$t]
                ];
            }

            $sngKey = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $t['title']));
            if ($sngKey && !isset($seenSingles[$sngKey])) {
                $seenSingles[$sngKey] = true;
                $singlesEps[] = [
                    'id' => 'sng_' . $t['id'],
                    'title' => $t['title'],
                    'artist' => $artist['name'],
                    'artist_id' => $artId,
                    'year' => (string)($t['release_year'] ?? '2026'),
                    'type' => 'Single',
                    'cover_url' => $t['cover_art_url'],
                    'tracks' => [$t]
                ];
            }
        }

        // Update artist stream metrics in DB to match real Flontmie plays
        $pdo->prepare("UPDATE artists SET total_streams = ?, monthly_listeners = ? WHERE id = ?")
            ->execute([$flontmieStreamsTotal, $flontmieStreamsTotal, $artId]);

        $avatarUrl = self::resolveArtworkUrl($artist['avatar_url'] ?? ($popularSongs[0]['cover_art_url'] ?? ''), $artId);
        $headerUrl = self::resolveArtworkUrl($artist['header_url'] ?? $avatarUrl, $artId);
        $bioText = !empty($artist['bio']) ? $artist['bio'] : ($wikiData['bio'] ?? '');

        $artist['avatar_url'] = $avatarUrl;
        $artist['header_url'] = $headerUrl;
        $artist['bio'] = $bioText;
        $artist['bio_source'] = !empty($bioText) ? 'Flontmie Catalog' : null;
        $artist['bio_url'] = null;
        $artist['wikidata_id'] = null;
        $artist['yt_browse_id'] = null;
        $artist['yt_monthly_audience'] = null;
        $artist['yt_subscribers'] = null;
        $artist['yt_total_views'] = null;
        $artist['monthly_listeners'] = $flontmieStreamsTotal;
        $artist['total_streams'] = $flontmieStreamsTotal;
        $artist['flontmie_streams'] = $flontmieStreamsTotal;
        $artist['flontmie_followers'] = (int)($artist['followers'] ?? 0);
        $artist['genres'] = !empty($artist['genres_json']) ? json_decode($artist['genres_json'], true) : ['Afrobeats'];
        $artist['social_links'] = !empty($artist['social_links_json']) ? json_decode($artist['social_links_json'], true) : [];

        $artist['tracks'] = $popularSongs;
        $artist['popular_songs'] = $popularSongs;
        $artist['albums'] = $albums;
        $artist['singles_eps'] = $singlesEps;
        $artist['featured_on'] = [];
        $artist['playlists'] = [];
        $artist['related_artists'] = [];

        return $artist;
    }

    /**
     * Fetches tracks for an Album or Release strictly from uploaded MySQL records
     */
    public static function fetchReleaseTracks(PDO $pdo, string $browseId, string $fallbackTitle = '', string $fallbackArtist = '', string $fallbackCover = ''): array {
        $stmt = $pdo->prepare("
            SELECT * FROM tracks
            WHERE is_deleted = 0
              AND (album_id = ? OR LOWER(album_name) = LOWER(?) OR LOWER(title) = LOWER(?))
            ORDER BY flontmie_plays DESC, created_at ASC
        ");
        $stmt->execute([$browseId, $fallbackTitle, $fallbackTitle]);
        $rows = $stmt->fetchAll();

        $tracks = [];
        foreach ($rows as $idx => $t) {
            $verAudio = self::hasVerifiedFile($t['local_audio_path'] ?? null);
            $verVideo = self::hasVerifiedFile($t['local_video_path'] ?? null);
            if ($verAudio === null && $verVideo === null) continue;

            $fPlays = (int)($t['flontmie_plays'] ?? 0);
            $tracks[] = [
                'id' => $t['id'],
                'video_id' => $t['video_id'],
                'track_number' => $idx + 1,
                'title' => $t['title'],
                'artist_name' => $t['artist_name'],
                'artist_id' => $t['artist_id'],
                'album_name' => $t['album_name'] ?: $fallbackTitle,
                'duration' => (int)($t['duration'] ?? 180),
                'cover_art_url' => self::resolveArtworkUrl($t['cover_art_url'] ?? $fallbackCover, $t['video_id'] ?? $t['id']),
                'audio_url' => '/phpbackend/api/stream.php?id=' . urlencode($t['id']),
                'video_url' => ($verVideo !== null) ? ('/phpbackend/api/stream.php?id=' . urlencode($t['id']) . '&type=video') : null,
                'has_local_audio' => true,
                'has_local_video' => ($verVideo !== null),
                'stream_count' => $fPlays,
                'yt_plays' => null,
                'flontmie_plays' => $fPlays
            ];
        }

        return [
            'browse_id' => $browseId,
            'title' => $fallbackTitle,
            'artist' => $fallbackArtist,
            'cover_url' => self::resolveArtworkUrl($fallbackCover),
            'year' => '2026',
            'tracks' => $tracks
        ];
    }
}
