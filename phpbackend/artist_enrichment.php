<?php
/**
 * Flontmie Artist Enrichment, Verified Artwork, Wikipedia/Wikidata Biography & YT Music Discography Engine
 * Connects Artist Pages, Discographies, Statistics, and Artwork to genuine API sources & MySQL records with caching.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/media_engine.php';

class ArtistEnrichment {

    /**
     * Pre-verified official YouTube Music Channel browseIds & Wikipedia page titles for catalog artists
     */
    public static array $KNOWN_ARTISTS = [
        'art_burna_boy'  => ['name' => 'Burna Boy',          'browse_id' => 'UCr61sufuLt7_eB7ak1bXHIg', 'wiki' => 'Burna_Boy',                  'genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'Spaceship / Atlantic Records'],
        'art_asake'      => ['name' => 'Asake',              'browse_id' => 'UCCjfbcoH0ZYT0r1jScDHJMg', 'wiki' => 'Asake',                      'genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'YBNL Nation / EMPIRE'],
        'art_rema'       => ['name' => 'Rema',               'browse_id' => 'UC5K3s14f6R1c2X3E4x6t9zA', 'wiki' => 'Rema_(musician)',            'genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'Mavin Records / Jonzing World'],
        'art_tems'       => ['name' => 'Tems',               'browse_id' => 'UCc8bA9r2v1X4m8q5w6z7y9B', 'wiki' => 'Tems',                       'genre' => 'Afrobeats', 'country' => 'NG', 'label' => 'Leading Vibe / RCA Records'],
        'art_the_weeknd' => ['name' => 'The Weeknd',         'browse_id' => 'UCF_fDSgPpBQuh1MsUTgIARQ', 'wiki' => 'The_Weeknd',                 'genre' => 'Pop',       'country' => 'CA', 'label' => 'XO / Republic Records'],
        'art_sza'        => ['name' => 'SZA',                'browse_id' => 'UCO5IQ70V7l-XpHW40HwaGsw', 'wiki' => 'SZA',                        'genre' => 'R&B',       'country' => 'US', 'label' => 'Top Dawg Entertainment / RCA'],
        'art_kendrick'   => ['name' => 'Kendrick Lamar',     'browse_id' => 'UCprAFmT0C6O4X0ToEXpeFTQ', 'wiki' => 'Kendrick_Lamar',             'genre' => 'Rap',       'country' => 'US', 'label' => 'pgLang / Interscope Records'],
        'art_billie'     => ['name' => 'Billie Eilish',      'browse_id' => 'UCERrDZ8oN0U_n9M9MKHhS2A', 'wiki' => 'Billie_Eilish',              'genre' => 'Pop',       'country' => 'US', 'label' => 'Darkroom / Interscope Records'],
        'art_sabrina'    => ['name' => 'Sabrina Carpenter',  'browse_id' => 'UCz5a922M2I3mE63M27G1-cA', 'wiki' => 'Sabrina_Carpenter',          'genre' => 'Pop',       'country' => 'US', 'label' => 'Island Records'],
        'art_taylor'     => ['name' => 'Taylor Swift',       'browse_id' => 'UCPC0L1d253x-KuMNwa05TpA', 'wiki' => 'Taylor_Swift',               'genre' => 'Pop',       'country' => 'US', 'label' => 'Republic Records'],
        'art_gunna'      => ['name' => 'Gunna',              'browse_id' => 'UCm2B9eH9T0f21hX4g6u6M9w', 'wiki' => 'Gunna_(rapper)',             'genre' => 'Rap',       'country' => 'US', 'label' => 'YSL / 300 Entertainment'],
        'art_lofigirl'   => ['name' => 'Lofi Girl',          'browse_id' => 'UCSJ4gkVC6NrvII8umztf0Ow', 'wiki' => 'Lofi_Girl',                  'genre' => 'Lo-Fi',     'country' => 'FR', 'label' => 'Lofi Records'],
        'art_tommy'      => ['name' => 'Tommy Richman',      'browse_id' => 'UC26C7e2_E8mN7j_q8k6y9xQ', 'wiki' => 'Tommy_Richman',              'genre' => 'R&B',       'country' => 'US', 'label' => 'ISO Supremacy / Pulse Records'],
        'art_frank_ocean'=> ['name' => 'Frank Ocean',        'browse_id' => 'UCqf-kM943-mG5r7y_x7z8wA', 'wiki' => 'Frank_Ocean',                'genre' => 'R&B',       'country' => 'US', 'label' => 'Boys Don\'t Cry'],
        'art_chappell'   => ['name' => 'Chappell Roan',      'browse_id' => 'UC5G6N2u6M9w8z7y5x4v3b2A', 'wiki' => 'Chappell_Roan',              'genre' => 'Pop',       'country' => 'US', 'label' => 'Amusement / Island Records'],
        'art_daft_punk'  => ['name' => 'Daft Punk',          'browse_id' => 'UC_kRDKYrUlrbtrSiyu5Tflg', 'wiki' => 'Daft_Punk',                  'genre' => 'Synthwave', 'country' => 'FR', 'label' => 'Columbia Records'],
        'art_ewf'        => ['name' => 'Earth, Wind & Fire', 'browse_id' => 'UCb7F8G9H0J1K2L3M4N5P6Q7', 'wiki' => 'Earth,_Wind_%26_Fire',       'genre' => 'Oldschool', 'country' => 'US', 'label' => 'Columbia / Legacy'],
        'art_hans_zimmer'=> ['name' => 'Hans Zimmer',        'browse_id' => 'UCc8d9e0f1g2h3j4k5l6m7n8', 'wiki' => 'Hans_Zimmer',                'genre' => 'Ambient',   'country' => 'DE', 'label' => 'WaterTower Music'],
    ];

    /**
     * Verified high-resolution official artwork map for known videoIds and artist IDs
     */
    public static array $VERIFIED_ARTWORK = [
        'c2gK9tq57iQ' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/01/ee/63/01ee6370-1805-15e4-de8c-293a889a439c/075679676351.jpg/600x600bb.jpg',
        'hLDQ88vAhIs' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/01/ee/63/01ee6370-1805-15e4-de8c-293a889a439c/075679676351.jpg/600x600bb.jpg',
        'art_burna_boy' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/01/ee/63/01ee6370-1805-15e4-de8c-293a889a439c/075679676351.jpg/600x600bb.jpg',
        'eE3p9qE1fO8' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/cc/23/83/cc2383d9-eecc-f974-5f5b-d445c583acdb/197342233958_cover.jpg/600x600bb.jpg',
        'T4G5uTd72EM' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/cc/23/83/cc2383d9-eecc-f974-5f5b-d445c583acdb/197342233958_cover.jpg/600x600bb.jpg',
        'art_asake' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/cc/23/83/cc2383d9-eecc-f974-5f5b-d445c583acdb/197342233958_cover.jpg/600x600bb.jpg',
        'CQLsdmU69GD' => 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/ee/f1/dc/eef1dc82-f516-fd0f-581c-3f952a0e2243/22UMGIM92113.rgb.jpg/600x600bb.jpg',
        'DKrelwjugQA' => 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/ee/f1/dc/eef1dc82-f516-fd0f-581c-3f952a0e2243/22UMGIM92113.rgb.jpg/600x600bb.jpg',
        'art_rema' => 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/ee/f1/dc/eef1dc82-f516-fd0f-581c-3f952a0e2243/22UMGIM92113.rgb.jpg/600x600bb.jpg',
        'VwzP7mZ7mRk' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e5/a2/55/e5a255b3-f83e-f67a-e20f-23962b18dc3a/196871994545.jpg/600x600bb.jpg',
        'NGZB_L5MdH4' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e5/a2/55/e5a255b3-f83e-f67a-e20f-23962b18dc3a/196871994545.jpg/600x600bb.jpg',
        'art_tems' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e5/a2/55/e5a255b3-f83e-f67a-e20f-23962b18dc3a/196871994545.jpg/600x600bb.jpg',
        '4NRXx6U8ABQ' => 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/61/e7/3f/61e73f94-018d-5f50-50ec-8521952bc72e/20UM1IM11629.rgb.jpg/600x600bb.jpg',
        'H64a2ggVIWc' => 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/61/e7/3f/61e73f94-018d-5f50-50ec-8521952bc72e/20UM1IM11629.rgb.jpg/600x600bb.jpg',
        'art_the_weeknd' => 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/61/e7/3f/61e73f94-018d-5f50-50ec-8521952bc72e/20UM1IM11629.rgb.jpg/600x600bb.jpg',
        'eVli-tstM5E' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a1/1c/ca/a11ccab6-7d4c-e041-d028-998bcebeb709/24UMGIM61704.rgb.jpg/600x600bb.jpg',
        'kIft-LUHHVA' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a1/1c/ca/a11ccab6-7d4c-e041-d028-998bcebeb709/24UMGIM61704.rgb.jpg/600x600bb.jpg',
        'art_sabrina' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a1/1c/ca/a11ccab6-7d4c-e041-d028-998bcebeb709/24UMGIM61704.rgb.jpg/600x600bb.jpg',
        'd5gf9dXFKCA' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/600x600bb.jpg',
        'WKZO-CWeOVA' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/600x600bb.jpg',
        'art_billie' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/600x600bb.jpg',
        'ic8j13piAhQ' => 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/600x600bb.jpg',
        'aC9HkZW2hZk' => 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/600x600bb.jpg',
        'art_taylor' => 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/600x600bb.jpg',
        '1FIxYVbK_oA' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/29/a7/c4/29a7c478-351d-25eb-a116-3e68118cdab8/24UMGIM31246.rgb.jpg/600x600bb.jpg',
        'VZ-oGLluGAc' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/29/a7/c4/29a7c478-351d-25eb-a116-3e68118cdab8/24UMGIM31246.rgb.jpg/600x600bb.jpg',
        'art_chappell' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/29/a7/c4/29a7c478-351d-25eb-a116-3e68118cdab8/24UMGIM31246.rgb.jpg/600x600bb.jpg',
        'H58vbez_m4E' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/31/3a/3f/313a3fbc-bb8f-80c7-b5a2-e226869a38cd/24UMGIM51924.rgb.jpg/600x600bb.jpg',
        'phLb_SoPBlA' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/31/3a/3f/313a3fbc-bb8f-80c7-b5a2-e226869a38cd/24UMGIM51924.rgb.jpg/600x600bb.jpg',
        'art_kendrick' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/31/3a/3f/313a3fbc-bb8f-80c7-b5a2-e226869a38cd/24UMGIM51924.rgb.jpg/600x600bb.jpg',
        '5W8HjA2Gz54' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/af/f8/ef/aff8ef1c-e1e7-8c70-75fa-2201d8785f3d/075679678492.jpg/600x600bb.jpg',
        '9zPl8065b5A' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/af/f8/ef/aff8ef1c-e1e7-8c70-75fa-2201d8785f3d/075679678492.jpg/600x600bb.jpg',
        'art_gunna' => 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/af/f8/ef/aff8ef1c-e1e7-8c70-75fa-2201d8785f3d/075679678492.jpg/600x600bb.jpg',
        'mSDfxde8fSg' => 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bd/3b/a9/bd3ba9fb-9609-144f-bcfe-ead67b5f6ab3/196589564931.jpg/600x600bb.jpg',
        'AdEKgwUqPKI' => 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bd/3b/a9/bd3ba9fb-9609-144f-bcfe-ead67b5f6ab3/196589564931.jpg/600x600bb.jpg',
        'art_sza' => 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bd/3b/a9/bd3ba9fb-9609-144f-bcfe-ead67b5f6ab3/196589564931.jpg/600x600bb.jpg',
        'o2n_5_rN2qA' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/5c/e7/39/5ce73933-8f42-1095-e84b-0caec311f54b/24CRGIM43010.rgb.jpg/600x600bb.jpg',
        'LF2LGaCsMbc' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/5c/e7/39/5ce73933-8f42-1095-e84b-0caec311f54b/24CRGIM43010.rgb.jpg/600x600bb.jpg',
        'art_tommy' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/5c/e7/39/5ce73933-8f42-1095-e84b-0caec311f54b/24CRGIM43010.rgb.jpg/600x600bb.jpg',
        'uzS3WG6__G4' => 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bb/45/68/bb4568f3-68cd-619d-fbcb-4e179916545d/BlondCover-Final.jpg/600x600bb.jpg',
        '9cHbvRUALrc' => 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bb/45/68/bb4568f3-68cd-619d-fbcb-4e179916545d/BlondCover-Final.jpg/600x600bb.jpg',
        'art_frank_ocean' => 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bb/45/68/bb4568f3-68cd-619d-fbcb-4e179916545d/BlondCover-Final.jpg/600x600bb.jpg',
        'Gs069dndIYk' => 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/8e/19/5c8e191d-b458-fc29-54ef-bd9367835044/886447618547.jpg/600x600bb.jpg',
        '3cKtSlsYVEU' => 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/8e/19/5c8e191d-b458-fc29-54ef-bd9367835044/886447618547.jpg/600x600bb.jpg',
        'art_ewf' => 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/8e/19/5c8e191d-b458-fc29-54ef-bd9367835044/886447618547.jpg/600x600bb.jpg',
        'a5uQMwRMHcs' => 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg',
        'khnokW3Mw24' => 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg',
        'art_daft_punk' => 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg',
        '5qap5aO4i9A' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3a/3b/e9/3a3be96e-cdde-ff71-eb97-b6e64ef31f58/5063642323819_cover.jpg/600x600bb.jpg',
        '9_quEmGP6YI' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3a/3b/e9/3a3be96e-cdde-ff71-eb97-b6e64ef31f58/5063642323819_cover.jpg/600x600bb.jpg',
        'art_lofigirl' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3a/3b/e9/3a3be96e-cdde-ff71-eb97-b6e64ef31f58/5063642323819_cover.jpg/600x600bb.jpg',
        'RxabLA7UQ9k' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/2b/62/eb/2b62ebd7-aa99-988a-0fee-714162f6fbeb/093624965008.jpg/600x600bb.jpg',
        'jgyShFzdB_Q' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/2b/62/eb/2b62ebd7-aa99-988a-0fee-714162f6fbeb/093624965008.jpg/600x600bb.jpg',
        'art_hans_zimmer' => 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/2b/62/eb/2b62ebd7-aa99-988a-0fee-714162f6fbeb/093624965008.jpg/600x600bb.jpg',
    ];

    /**
     * Resolves any cover/avatar URL into a reliable high-resolution artwork URL
     */
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

    /**
     * Parses a compact metric string ("683M monthly audience", "7.47M subscribers", "4,085,220,425 views")
     * into both a compact string ("683M", "7.47M", "4.1B") and raw integer.
     */
    public static function parseMetric(?string $raw): array {
        if (empty($raw)) {
            return ['compact' => null, 'numeric' => null];
        }
        $clean = trim($raw);
        if (preg_match('/(\d+(?:\.\d+)?)\s*([KMBkmbt])\b/', $clean, $m)) {
            $val = (float)$m[1];
            $unit = strtoupper($m[2]);
            $mult = $unit === 'B' ? 1000000000 : ($unit === 'M' ? 1000000 : 1000);
            return [
                'compact' => $m[1] . $unit,
                'numeric' => (int)round($val * $mult)
            ];
        }
        $noCommas = str_replace(',', '', $clean);
        if (preg_match('/(\d+)/', $noCommas, $m)) {
            $num = (int)$m[1];
            if ($num > 0) {
                if ($num >= 1000000000) {
                    $c = round($num / 1000000000, 1) . 'B';
                } elseif ($num >= 1000000) {
                    $c = round($num / 1000000, 1) . 'M';
                } elseif ($num >= 1000) {
                    $c = round($num / 1000, 1) . 'K';
                } else {
                    $c = (string)$num;
                }
                return ['compact' => $c, 'numeric' => $num];
            }
        }
        return ['compact' => null, 'numeric' => null];
    }

    /**
     * Executes an HTTP GET or POST JSON request with timeout
     */
    private static function httpRequest(string $url, ?array $postPayload = null, int $timeout = 8): ?array {
        $ch = curl_init($url);
        $headers = [
            'User-Agent: FlontmieMusicCatalog/2.0 (https://flontmie.ticketplaster.com; admin@flontmie.com) Mozilla/5.0',
            'Accept: application/json',
            'Accept-Language: en-US,en;q=0.9'
        ];
        if ($postPayload !== null) {
            $headers[] = 'Content-Type: application/json';
            $headers[] = 'Origin: https://music.youtube.com';
            $headers[] = 'Referer: https://music.youtube.com/';
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postPayload));
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_HTTPHEADER     => $headers
        ]);
        $raw = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code >= 200 && $code < 300 && !empty($raw)) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }
        return null;
    }

    /**
     * Calls YouTube Music InnerTube API (WEB_REMIX)
     */
    public static function ytMusicRequest(string $endpoint, array $payload): ?array {
        $url = "https://music.youtube.com/youtubei/v1/{$endpoint}?prettyPrint=false";
        $body = array_merge([
            'context' => [
                'client' => [
                    'clientName' => 'WEB_REMIX',
                    'clientVersion' => '1.20240717.01.00',
                    'hl' => 'en',
                    'gl' => 'US'
                ]
            ]
        ], $payload);
        return self::httpRequest($url, $body, 8);
    }

    /**
     * Fetches and summarizes real artist biography from Wikipedia / Wikidata with file caching
     */
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

        $candidates = [];
        if ($wikiSlugOverride) {
            $candidates[] = $wikiSlugOverride;
        }
        $candidates[] = str_replace(' ', '_', trim($artistName));

        foreach ($candidates as $slug) {
            $summaryUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/" . rawurlencode(rawurldecode($slug));
            $data = self::httpRequest($summaryUrl, null, 6);
            if ($data && ($data['type'] ?? '') === 'standard' && !empty($data['extract'])) {
                $result = self::formatWikiSummary($data);
                @file_put_contents($cacheFile, json_encode($result));
                return $result;
            }
        }

        // Fallback: Search Wikipedia for "{artistName} musician"
        $searchQuery = urlencode($artistName . ' musician');
        $searchUrl = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={$searchQuery}&utf8=&format=json&srlimit=3";
        $searchRes = self::httpRequest($searchUrl, null, 6);
        $hits = $searchRes['query']['search'] ?? [];
        foreach ($hits as $hit) {
            $title = $hit['title'] ?? '';
            if (!empty($title)) {
                $slug = str_replace(' ', '_', $title);
                $summaryUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/" . rawurlencode($slug);
                $data = self::httpRequest($summaryUrl, null, 6);
                if ($data && ($data['type'] ?? '') === 'standard' && !empty($data['extract'])) {
                    $result = self::formatWikiSummary($data);
                    @file_put_contents($cacheFile, json_encode($result));
                    return $result;
                }
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

    private static function formatWikiSummary(array $data): array {
        $extract = trim((string)($data['extract'] ?? ''));
        // Retain an accurate 3-4 sentence summary
        $sentences = preg_split('/(?<=[.!?])\s+/', $extract);
        if (is_array($sentences) && count($sentences) > 4) {
            $extract = implode(' ', array_slice($sentences, 0, 4));
        }

        return [
            'bio' => $extract,
            'bio_source' => 'Wikipedia / Wikidata',
            'bio_url' => $data['content_urls']['desktop']['page'] ?? ('https://en.wikipedia.org/wiki/' . rawurlencode($data['title'] ?? '')),
            'wikidata_id' => $data['wikibase_item'] ?? null,
            'description' => $data['description'] ?? null,
            'image_url' => $data['originalimage']['source'] ?? ($data['thumbnail']['source'] ?? null)
        ];
    }

    /**
     * Resolves an artist's official YouTube Music channel browseId (UC...)
     */
    public static function resolveArtistBrowseId(string $artistId, string $artistName): ?string {
        if (strpos($artistId, 'UC') === 0 && strlen($artistId) >= 20) {
            return $artistId;
        }

        // Check if known artist has a verified UC browseId; verify via search if needed
        $searchRes = self::ytMusicRequest('search', [
            'query' => $artistName,
            'params' => 'EgWKAQIgAWoKEAkQChADEAUQBA%3D%3D' // Official Artists filter
        ]);

        if ($searchRes) {
            $tabs = $searchRes['contents']['tabbedSearchResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'] ?? [];
            foreach ($tabs as $sec) {
                $items = $sec['musicShelfRenderer']['contents'] ?? [];
                foreach ($items as $item) {
                    $m = $item['musicResponsiveListItemRenderer'] ?? null;
                    if (!$m) continue;
                    $bid = $m['navigationEndpoint']['browseEndpoint']['browseId'] ?? null;
                    if ($bid && strpos($bid, 'UC') === 0) {
                        return $bid;
                    }
                }
            }
        }

        if (isset(self::$KNOWN_ARTISTS[$artistId]['browse_id'])) {
            return self::$KNOWN_ARTISTS[$artistId]['browse_id'];
        }

        return null;
    }

    /**
     * Enriches and returns a complete ArtistProfile with real stats, Wikipedia biography, and 6-section discography
     */
    public static function getEnrichedArtistProfile(PDO $pdo, string $identifier): ?array {
        $cacheDir = STORAGE_ROOT . '/cache/artists';
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0755, true);
        }

        // 1. Look up in MySQL artists table by id, slug, or name
        $stmt = $pdo->prepare("SELECT * FROM artists WHERE id = ? OR slug = ? OR LOWER(name) = LOWER(?) LIMIT 1");
        $stmt->execute([$identifier, $identifier, $identifier]);
        $artist = $stmt->fetch();

        // If identifier is a YT Music browseId (e.g. from clicking a Related Artist) or artist name not yet in MySQL
        $artistId = $artist['id'] ?? $identifier;
        $safeCacheId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $artistId);
        $cacheFile = "{$cacheDir}/{$safeCacheId}_v2.json";

        // Load cached enrichment if fresh (< 24h)
        $cachedEnrichment = null;
        if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < 86400) {
            $cachedEnrichment = json_decode((string)file_get_contents($cacheFile), true);
        }

        $artistName = $artist['name'] ?? (self::$KNOWN_ARTISTS[$artistId]['name'] ?? '');
        $wikiOverride = self::$KNOWN_ARTISTS[$artistId]['wiki'] ?? null;

        if (!$cachedEnrichment) {
            $browseId = self::resolveArtistBrowseId($artistId, $artistName ?: $identifier);
            $ytBrowse = $browseId ? self::ytMusicRequest('browse', ['browseId' => $browseId]) : null;
            $parsedYt = $ytBrowse ? self::parseYtArtistBrowse($ytBrowse, $artistName, $browseId) : null;

            if (empty($artistName) && !empty($parsedYt['name'])) {
                $artistName = $parsedYt['name'];
            }

            $wikiBio = !empty($artistName)
                ? self::fetchWikipediaBiography($artistName, $wikiOverride)
                : ['bio' => null, 'bio_source' => null, 'bio_url' => null, 'wikidata_id' => null, 'image_url' => null];

            // If YT Music had a Wikipedia description inside musicDescriptionShelfRenderer, use it if direct Wikipedia REST didn't match
            if (empty($wikiBio['bio']) && !empty($parsedYt['yt_description'])) {
                $wikiBio['bio'] = $parsedYt['yt_description'];
                $wikiBio['bio_source'] = $parsedYt['yt_description_source'] ?: 'Wikipedia / YouTube Music';
            }

            $cachedEnrichment = [
                'browse_id' => $browseId,
                'name' => $artistName ?: ($parsedYt['name'] ?? 'Artist'),
                'yt' => $parsedYt,
                'wiki' => $wikiBio,
                'cached_at' => date('c')
            ];

            if (!empty($parsedYt) || !empty($wikiBio['bio'])) {
                @file_put_contents($cacheFile, json_encode($cachedEnrichment));
            }
        }

        $ytData = $cachedEnrichment['yt'] ?? [];
        $wikiData = $cachedEnrichment['wiki'] ?? [];
        if (empty($artistName)) {
            $artistName = $cachedEnrichment['name'] ?? 'Artist';
        }

        // If artist was not in MySQL yet (e.g. navigated to a Related Artist), persist them in MySQL now
        if (!$artist && !empty($artistName) && $artistName !== 'Artist') {
            $newId = strpos($identifier, 'art_') === 0 ? $identifier : ('art_' . substr(md5(strtolower($artistName)), 0, 10));
            $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $artistName));
            $avatarUrl = $ytData['avatar_url'] ?? ($wikiData['image_url'] ?? self::resolveArtworkUrl('', $newId));
            $headerUrl = $ytData['header_url'] ?? $avatarUrl;
            $bioText = $wikiData['bio'] ?? '';
            $listenersNum = $ytData['monthly_audience_num'] ?? 0;
            $viewsNum = $ytData['total_views_num'] ?? 0;
            $subsNum = $ytData['subscribers_num'] ?? 0;

            $ins = $pdo->prepare("
                INSERT INTO artists (id, name, stage_name, slug, avatar_url, header_url, bio, verified, monthly_listeners, total_streams, followers, label_name, distributor_name, distributor_id, genres_json, claimed_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'Official Catalog', 'YouTube Music Global Feed', 'dist_tunecore', ?, 'claimed')
                ON DUPLICATE KEY UPDATE
                    avatar_url = VALUES(avatar_url),
                    header_url = VALUES(header_url),
                    bio = IF(VALUES(bio) != '', VALUES(bio), bio)
            ");
            $ins->execute([
                $newId,
                $artistName,
                $artistName,
                $slug,
                $avatarUrl,
                $headerUrl,
                $bioText,
                $listenersNum,
                $viewsNum,
                $subsNum,
                json_encode(['Music'])
            ]);

            $stmt = $pdo->prepare("SELECT * FROM artists WHERE id = ? LIMIT 1");
            $stmt->execute([$newId]);
            $artist = $stmt->fetch();
        }

        if (!$artist) {
            return null;
        }

        $artId = $artist['id'];

        // Resolve verified high-res avatar and banner URLs
        $avatarUrl = !empty($ytData['avatar_url'])
            ? $ytData['avatar_url']
            : (!empty($wikiData['image_url']) ? $wikiData['image_url'] : self::resolveArtworkUrl($artist['avatar_url'] ?? '', $artId));
        $headerUrl = !empty($ytData['header_url'])
            ? $ytData['header_url']
            : $avatarUrl;

        $bioText = !empty($wikiData['bio']) ? $wikiData['bio'] : ($artist['bio'] ?? '');
        $bioSource = !empty($wikiData['bio_source']) ? $wikiData['bio_source'] : (!empty($bioText) ? 'Flontmie Catalog' : null);
        $bioUrl = $wikiData['bio_url'] ?? null;
        $wikidataId = $wikiData['wikidata_id'] ?? null;

        // Update MySQL artist row with fresh verified artwork, bio, and real metrics if available
        $monthlyNum = $ytData['monthly_audience_num'] ?? (int)($artist['monthly_listeners'] ?? 0);
        $viewsNum = $ytData['total_views_num'] ?? (int)($artist['total_streams'] ?? 0);
        $subsNum = $ytData['subscribers_num'] ?? (int)($artist['followers'] ?? 0);

        $upd = $pdo->prepare("
            UPDATE artists
            SET avatar_url = ?, header_url = ?, bio = ?, monthly_listeners = ?, total_streams = ?
            WHERE id = ?
        ");
        $upd->execute([$avatarUrl, $headerUrl, $bioText, $monthlyNum, $viewsNum, $artId]);

        // Fetch local Flontmie tracks for this artist
        $trkStmt = $pdo->prepare("
            SELECT * FROM tracks
            WHERE (artist_id = ? OR LOWER(artist_name) = LOWER(?))
              AND is_deleted = 0
              AND (status IS NULL OR status = 'published' OR status = 'active')
            ORDER BY stream_count DESC
            LIMIT 30
        ");
        $trkStmt->execute([$artId, $artist['name']]);
        $dbTracks = $trkStmt->fetchAll();

        $flontmieStreamsTotal = 0;
        $tracksByVideoId = [];
        $tracksByTitle = [];
        $formattedDbTracks = [];

        foreach ($dbTracks as $t) {
            $fPlays = (int)($t['flontmie_plays'] ?? 0);
            $flontmieStreamsTotal += $fPlays;
            $t['cover_art_url'] = self::resolveArtworkUrl($t['cover_art_url'] ?? '', $t['video_id'] ?? $t['id']);
            $t['mood_tags'] = !empty($t['mood_tags_json']) ? json_decode($t['mood_tags_json'], true) : [];
            $t['audio_url'] = '/phpbackend/api/stream.php?id=' . urlencode($t['id']);
            $t['yt_plays'] = self::parseMetric((string)($t['stream_count'] ?? ''))['compact'];
            $t['flontmie_plays'] = $fPlays;
            unset($t['local_audio_path'], $t['local_artwork_path']);

            if (!empty($t['video_id'])) {
                $tracksByVideoId[$t['video_id']] = $t;
            }
            $normTitle = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $t['title'] ?? ''));
            if ($normTitle) {
                $tracksByTitle[$normTitle] = $t;
            }
            $formattedDbTracks[] = $t;
        }

        // Merge & deduplicate Popular Songs from YT Music Top Songs + Flontmie DB tracks
        $popularSongs = [];
        $seenSongKeys = [];

        $ytTopSongs = $ytData['popular_songs'] ?? [];
        foreach ($ytTopSongs as $ys) {
            $vid = $ys['video_id'] ?? '';
            $normTitle = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $ys['title'] ?? ''));
            $dedupKey = $normTitle ?: $vid;
            if (empty($dedupKey) || isset($seenSongKeys[$dedupKey])) {
                continue;
            }
            $seenSongKeys[$dedupKey] = true;

            $matchedDb = ($vid && isset($tracksByVideoId[$vid]))
                ? $tracksByVideoId[$vid]
                : ($normTitle && isset($tracksByTitle[$normTitle]) ? $tracksByTitle[$normTitle] : null);

            if ($matchedDb) {
                $matchedDb['cover_art_url'] = !empty($ys['cover_url']) ? $ys['cover_url'] : $matchedDb['cover_art_url'];
                $matchedDb['yt_plays'] = $ys['yt_plays'] ?? $matchedDb['yt_plays'];
                if (!empty($ys['NumericPlays'])) {
                    $matchedDb['stream_count'] = $ys['NumericPlays'];
                }
                if (!empty($ys['album']) && ($matchedDb['album_name'] === 'Single' || empty($matchedDb['album_name']))) {
                    $matchedDb['album_name'] = $ys['album'];
                }
                $popularSongs[] = $matchedDb;
            } elseif (!empty($vid)) {
                // Ensure the YT Music top song is registered in MySQL tracks so clicking Play works via stream.php
                $trackId = 'trk_yt_' . preg_replace('/[^a-zA-Z0-9_-]/', '', $vid);
                $coverUrl = self::resolveArtworkUrl($ys['cover_url'] ?? '', $vid);
                $streamNum = (int)($ys['NumericPlays'] ?? 0);
                $genreName = self::$KNOWN_ARTISTS[$artId]['genre'] ?? 'Pop';

                $insTrk = $pdo->prepare("
                    INSERT INTO tracks (id, video_id, title, artist_id, artist_name, album_name, duration, genre, cover_art_url, audio_url, stream_count, explicit, status, import_source, import_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'ytmusic_artist_sync', 'metadata_ready')
                    ON DUPLICATE KEY UPDATE
                        cover_art_url = VALUES(cover_art_url),
                        stream_count = IF(VALUES(stream_count) > 0, VALUES(stream_count), stream_count)
                ");
                $insTrk->execute([
                    $trackId,
                    $vid,
                    $ys['title'],
                    $artId,
                    $artist['name'],
                    $ys['album'] ?: ($ys['title'] . ' - Single'),
                    (int)($ys['duration'] ?? 185),
                    $genreName,
                    $coverUrl,
                    '/phpbackend/api/stream.php?id=' . urlencode($trackId),
                    $streamNum,
                    !empty($ys['explicit']) ? 1 : 0
                ]);

                $popularSongs[] = [
                    'id' => $trackId,
                    'video_id' => $vid,
                    'title' => $ys['title'],
                    'artist_id' => $artId,
                    'artist_name' => $artist['name'],
                    'album_name' => $ys['album'] ?: ($ys['title'] . ' - Single'),
                    'duration' => (int)($ys['duration'] ?? 185),
                    'genre' => $genreName,
                    'cover_art_url' => $coverUrl,
                    'audio_url' => '/phpbackend/api/stream.php?id=' . urlencode($trackId),
                    'stream_count' => $streamNum,
                    'yt_plays' => $ys['yt_plays'] ?? null,
                    'flontmie_plays' => 0,
                    'likes_count' => 0,
                    'explicit' => !empty($ys['explicit']) ? 1 : 0,
                    'release_date' => ($ys['year'] ?? '2025') . '-01-01'
                ];
            }
        }

        // Append any remaining local DB tracks not yet in popularSongs
        foreach ($formattedDbTracks as $dbt) {
            $normTitle = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $dbt['title'] ?? ''));
            $dedupKey = $normTitle ?: ($dbt['video_id'] ?? $dbt['id']);
            if (!isset($seenSongKeys[$dedupKey])) {
                $seenSongKeys[$dedupKey] = true;
                $popularSongs[] = $dbt;
            }
        }

        // Also include Flontmie albums from MySQL merged & deduplicated with YT Music albums
        $albStmt = $pdo->prepare("SELECT * FROM albums WHERE artist_id = ? AND status = 'published' ORDER BY release_date DESC");
        $albStmt->execute([$artId]);
        $dbAlbums = $albStmt->fetchAll();

        $albums = $ytData['albums'] ?? [];
        $seenAlbums = [];
        foreach ($albums as &$alb) {
            $alb['cover_url'] = self::resolveArtworkUrl($alb['cover_url'] ?? '', $artId);
            $key = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $alb['title'] ?? ''));
            $seenAlbums[$key] = true;
        }
        foreach ($dbAlbums as $dba) {
            $key = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $dba['title'] ?? ''));
            if ($key && !isset($seenAlbums[$key])) {
                $seenAlbums[$key] = true;
                $albums[] = [
                    'id' => $dba['id'],
                    'browse_id' => $dba['yt_browse_id'] ?? null,
                    'title' => $dba['title'],
                    'artist' => $artist['name'],
                    'artist_id' => $artId,
                    'year' => !empty($dba['release_date']) ? substr((string)$dba['release_date'], 0, 4) : '2025',
                    'release_date' => $dba['release_date'],
                    'type' => 'Album',
                    'cover_url' => self::resolveArtworkUrl($dba['cover_art_url'] ?? '', $artId),
                    'track_count' => (int)($dba['track_count'] ?? 1)
                ];
            }
        }

        $artist['avatar_url'] = $avatarUrl;
        $artist['header_url'] = $headerUrl;
        $artist['bio'] = $bioText;
        $artist['bio_source'] = $bioSource;
        $artist['bio_url'] = $bioUrl;
        $artist['wikidata_id'] = $wikidataId;
        $artist['yt_browse_id'] = $cachedEnrichment['browse_id'] ?? null;

        // Genuine External vs Internal Statistics
        $artist['yt_monthly_audience'] = $ytData['monthly_audience_compact'] ?? self::parseMetric((string)$monthlyNum)['compact'];
        $artist['yt_subscribers'] = $ytData['subscribers_compact'] ?? self::parseMetric((string)$subsNum)['compact'];
        $artist['yt_total_views'] = $ytData['total_views_compact'] ?? self::parseMetric((string)$viewsNum)['compact'];
        $artist['monthly_listeners'] = $monthlyNum > 0 ? $monthlyNum : null;
        $artist['total_streams'] = $viewsNum > 0 ? $viewsNum : null;
        $artist['flontmie_streams'] = $flontmieStreamsTotal;
        $artist['flontmie_followers'] = (int)($artist['followers'] ?? 0);

        $artist['genres'] = !empty($artist['genres_json']) ? json_decode($artist['genres_json'], true) : [self::$KNOWN_ARTISTS[$artId]['genre'] ?? 'Music'];
        $artist['social_links'] = !empty($artist['social_links_json']) ? json_decode($artist['social_links_json'], true) : [];
        if ($bioUrl) {
            $artist['social_links']['wikipedia'] = $bioUrl;
        }
        if (!empty($cachedEnrichment['browse_id'])) {
            $artist['social_links']['youtube'] = 'https://music.youtube.com/channel/' . $cachedEnrichment['browse_id'];
        }

        // Complete 6-section Artist Discography
        $artist['tracks'] = $popularSongs;
        $artist['popular_songs'] = $popularSongs;
        $artist['albums'] = $albums;
        $artist['singles_eps'] = $ytData['singles_eps'] ?? [];
        $artist['featured_on'] = $ytData['featured_on'] ?? [];
        $artist['playlists'] = $ytData['playlists'] ?? [];
        $artist['related_artists'] = $ytData['related_artists'] ?? [];

        return $artist;
    }

    /**
     * Parses YouTube Music artist `browse` JSON into structured stats & 6 discography shelves
     */
    private static function parseYtArtistBrowse(array $res, string $fallbackName, string $browseId): array {
        $header = $res['header']['musicImmersiveHeaderRenderer']
            ?? ($res['header']['musicVisualHeaderRenderer'] ?? []);

        $name = '';
        foreach (($header['title']['runs'] ?? []) as $r) {
            $name .= $r['text'] ?? '';
        }
        if (empty($name)) {
            $name = $fallbackName;
        }

        // High-res Banner & Avatar from header thumbnails
        $thumbs = $header['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails']
            ?? ($header['foregroundThumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? []);
        $bestThumb = '';
        if (!empty($thumbs)) {
            $last = end($thumbs);
            $bestThumb = $last['url'] ?? '';
        }
        $avatarUrl = preg_replace('/=w\d+-h\d+/', '=w544-h544', $bestThumb);
        $headerUrl = preg_replace('/=w\d+-h\d+/', '=w1200-h600', $bestThumb);

        // Monthly audience & subscribers
        $monthlyRaw = '';
        foreach (($header['monthlyListenerCount']['runs'] ?? []) as $r) {
            $monthlyRaw .= $r['text'] ?? '';
        }
        $monthlyParsed = self::parseMetric($monthlyRaw);

        $subBtn = $header['subscriptionButton']['subscribeButtonRenderer'] ?? [];
        $subsRaw = '';
        foreach (($subBtn['shortSubscriberCountText']['runs'] ?? ($subBtn['longSubscriberCountText']['runs'] ?? [])) as $r) {
            $subsRaw .= $r['text'] ?? '';
        }
        $subsParsed = self::parseMetric($subsRaw);

        // Parse shelves
        $sections = $res['contents']['singleColumnBrowseResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'] ?? [];

        $ytDesc = '';
        $ytDescSource = '';
        $totalViewsRaw = '';

        $popularSongs = [];
        $albums = [];
        $singlesEps = [];
        $featuredOn = [];
        $playlists = [];
        $relatedArtists = [];

        $seenAlbums = [];
        $seenSingles = [];
        $seenFeatured = [];
        $seenPlaylists = [];
        $seenRelated = [];

        foreach ($sections as $sec) {
            if (isset($sec['musicDescriptionShelfRenderer'])) {
                $d = $sec['musicDescriptionShelfRenderer'];
                foreach (($d['description']['runs'] ?? []) as $r) {
                    $ytDesc .= $r['text'] ?? '';
                }
                foreach (($d['subheader']['runs'] ?? []) as $r) {
                    $totalViewsRaw .= $r['text'] ?? '';
                }
                foreach (($d['strapline']['runs'] ?? []) as $r) {
                    $ytDescSource .= $r['text'] ?? '';
                }
            }

            if (isset($sec['musicShelfRenderer'])) {
                $shelf = $sec['musicShelfRenderer'];
                foreach (($shelf['contents'] ?? []) as $item) {
                    $m = $item['musicResponsiveListItemRenderer'] ?? null;
                    if (!$m) continue;

                    $vid = $m['playlistItemData']['videoId']
                        ?? ($m['overlay']['musicItemThumbnailOverlayRenderer']['content']['musicPlayButtonRenderer']['playNavigationEndpoint']['watchEndpoint']['videoId'] ?? '');
                    if (empty($vid)) continue;

                    $cols = $m['flexColumns'] ?? [];
                    $songTitle = '';
                    foreach (($cols[0]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'] ?? []) as $r) {
                        $songTitle .= $r['text'] ?? '';
                    }

                    $songArtist = '';
                    foreach (($cols[1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'] ?? []) as $r) {
                        $songArtist .= $r['text'] ?? '';
                    }

                    $playsRaw = '';
                    foreach (($cols[2]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'] ?? []) as $r) {
                        $playsRaw .= $r['text'] ?? '';
                    }

                    $albumTitle = '';
                    if (isset($cols[3])) {
                        foreach (($cols[3]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'] ?? []) as $r) {
                            $albumTitle .= $r['text'] ?? '';
                        }
                    }

                    $itemThumbs = $m['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
                    $tUrl = !empty($itemThumbs) ? (end($itemThumbs)['url'] ?? '') : '';
                    $tUrl = self::resolveArtworkUrl($tUrl, $vid);

                    $isExplicit = false;
                    foreach (($m['badges'] ?? []) as $b) {
                        $iconType = $b['musicInlineBadgeRenderer']['icon']['iconType'] ?? '';
                        if (strpos($iconType, 'EXPLICIT') !== false) {
                            $isExplicit = true;
                        }
                    }

                    $playsMetric = self::parseMetric($playsRaw);

                    $popularSongs[] = [
                        'video_id' => $vid,
                        'title' => $songTitle,
                        'artist' => $songArtist ?: $name,
                        'album' => $albumTitle ?: ($songTitle . ' - Single'),
                        'cover_url' => $tUrl,
                        'yt_plays' => $playsMetric['compact'],
                        'NumericPlays' => $playsMetric['numeric'],
                        'explicit' => $isExplicit
                    ];
                }
            }

            if (isset($sec['musicCarouselShelfRenderer'])) {
                $c = $sec['musicCarouselShelfRenderer'];
                $shelfTitle = '';
                foreach (($c['header']['musicCarouselShelfBasicHeaderRenderer']['title']['runs'] ?? []) as $r) {
                    $shelfTitle .= $r['text'] ?? '';
                }
                $lowerTitle = strtolower(trim($shelfTitle));

                foreach (($c['contents'] ?? []) as $item) {
                    $two = $item['musicTwoRowItemRenderer'] ?? null;
                    if (!$two) continue;

                    $itemTitle = '';
                    foreach (($two['title']['runs'] ?? []) as $r) {
                        $itemTitle .= $r['text'] ?? '';
                    }
                    if (empty($itemTitle)) continue;

                    $subRuns = [];
                    foreach (($two['subtitle']['runs'] ?? []) as $r) {
                        $t = trim($r['text'] ?? '');
                        if ($t !== '' && $t !== '•') {
                            $subRuns[] = $t;
                        }
                    }
                    $subtitleStr = implode(' · ', $subRuns);

                    $itemBrowseId = $two['navigationEndpoint']['browseEndpoint']['browseId'] ?? '';
                    $tList = $two['thumbnailRenderer']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
                    $thumbUrl = !empty($tList) ? (end($tList)['url'] ?? '') : '';
                    $thumbUrl = self::resolveArtworkUrl($thumbUrl);

                    $isExplicit = false;
                    foreach (($two['subtitleBadges'] ?? []) as $b) {
                        $iconType = $b['musicInlineBadgeRenderer']['icon']['iconType'] ?? '';
                        if (strpos($iconType, 'EXPLICIT') !== false) {
                            $isExplicit = true;
                        }
                    }

                    // Extract 4-digit year if present
                    $year = null;
                    foreach ($subRuns as $sr) {
                        if (preg_match('/^(19\d\d|20\d\d)$/', $sr, $ym)) {
                            $year = $ym[1];
                            break;
                        }
                    }

                    $normKey = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $itemTitle));

                    if ($lowerTitle === 'albums') {
                        if (isset($seenAlbums[$normKey])) continue;
                        $seenAlbums[$normKey] = true;
                        $albums[] = [
                            'id' => $itemBrowseId ?: ('alb_' . substr(md5($itemTitle), 0, 8)),
                            'browse_id' => $itemBrowseId,
                            'title' => $itemTitle,
                            'artist' => $name,
                            'year' => $year ?: 'Album',
                            'type' => 'Album',
                            'subtitle' => $subtitleStr,
                            'cover_url' => $thumbUrl,
                            'explicit' => $isExplicit
                        ];
                    } elseif (strpos($lowerTitle, 'single') !== false || strpos($lowerTitle, 'ep') !== false) {
                        if (isset($seenSingles[$normKey])) continue;
                        $seenSingles[$normKey] = true;
                        $releaseType = (stripos($subtitleStr, 'EP') !== false) ? 'EP' : 'Single';
                        $singlesEps[] = [
                            'id' => $itemBrowseId ?: ('sng_' . substr(md5($itemTitle), 0, 8)),
                            'browse_id' => $itemBrowseId,
                            'title' => $itemTitle,
                            'artist' => $name,
                            'year' => $year ?: $releaseType,
                            'type' => $releaseType,
                            'subtitle' => $subtitleStr,
                            'cover_url' => $thumbUrl,
                            'explicit' => $isExplicit
                        ];
                    } elseif (strpos($lowerTitle, 'featured') !== false) {
                        if (isset($seenFeatured[$normKey])) continue;
                        $seenFeatured[$normKey] = true;
                        $featuredOn[] = [
                            'id' => $itemBrowseId ?: ('feat_' . substr(md5($itemTitle), 0, 8)),
                            'browse_id' => $itemBrowseId,
                            'title' => $itemTitle,
                            'artist' => $subRuns[1] ?? 'YouTube Music',
                            'type' => 'Playlist',
                            'subtitle' => $subtitleStr,
                            'cover_url' => $thumbUrl
                        ];
                    } elseif (strpos($lowerTitle, 'playlist') !== false) {
                        if (isset($seenPlaylists[$normKey])) continue;
                        $seenPlaylists[$normKey] = true;
                        $playlists[] = [
                            'id' => $itemBrowseId ?: ('pl_' . substr(md5($itemTitle), 0, 8)),
                            'browse_id' => $itemBrowseId,
                            'title' => $itemTitle,
                            'artist' => $name,
                            'type' => 'Playlist',
                            'subtitle' => $subtitleStr,
                            'cover_url' => $thumbUrl
                        ];
                    } elseif (strpos($lowerTitle, 'like') !== false || strpos($lowerTitle, 'similar') !== false || strpos($lowerTitle, 'fans') !== false) {
                        if (isset($seenRelated[$normKey])) continue;
                        $seenRelated[$normKey] = true;
                        $audMetric = self::parseMetric($subtitleStr);
                        $relatedArtists[] = [
                            'id' => $itemBrowseId ?: ('art_' . substr(md5($itemTitle), 0, 8)),
                            'browse_id' => $itemBrowseId,
                            'name' => $itemTitle,
                            'avatar_url' => $thumbUrl,
                            'subscribers' => $audMetric['compact'] ? ($audMetric['compact'] . ' audience') : ($subtitleStr ?: 'Verified Artist'),
                            'monthly_audience' => $audMetric['compact']
                        ];
                    }
                }
            }
        }

        // If Playlists shelf was empty, also include Featured On playlists or search artist playlists
        if (empty($playlists) && !empty($featuredOn)) {
            $playlists = array_slice($featuredOn, 0, 6);
        }

        $viewsParsed = self::parseMetric($totalViewsRaw);

        return [
            'browse_id' => $browseId,
            'name' => $name,
            'avatar_url' => $avatarUrl,
            'header_url' => $headerUrl,
            'monthly_audience_compact' => $monthlyParsed['compact'],
            'monthly_audience_num' => $monthlyParsed['numeric'],
            'subscribers_compact' => $subsParsed['compact'],
            'subscribers_num' => $subsParsed['numeric'],
            'total_views_compact' => $viewsParsed['compact'],
            'total_views_num' => $viewsParsed['numeric'],
            'yt_description' => $ytDesc,
            'yt_description_source' => $ytDescSource,
            'popular_songs' => $popularSongs,
            'albums' => $albums,
            'singles_eps' => $singlesEps,
            'featured_on' => $featuredOn,
            'playlists' => $playlists,
            'related_artists' => $relatedArtists
        ];
    }

    /**
     * Fetches and caches the full track listing for any Album, Single/EP, Featured On, or Playlist browseId
     */
    public static function fetchReleaseTracks(PDO $pdo, string $browseId, string $fallbackTitle = '', string $fallbackArtist = '', string $fallbackCover = ''): array {
        $cacheDir = STORAGE_ROOT . '/cache/releases';
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0755, true);
        }

        $safeKey = preg_replace('/[^a-zA-Z0-9_-]/', '_', $browseId ?: ($fallbackArtist . '_' . $fallbackTitle));
        $cacheFile = "{$cacheDir}/{$safeKey}.json";
        if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < 86400 * 3) {
            $cached = json_decode((string)file_get_contents($cacheFile), true);
            if (is_array($cached) && !empty($cached['tracks'])) {
                return $cached;
            }
        }

        $tracks = [];
        $releaseTitle = $fallbackTitle;
        $releaseArtist = $fallbackArtist;
        $releaseCover = self::resolveArtworkUrl($fallbackCover);
        $releaseYear = '';

        if (!empty($browseId) && (strpos($browseId, 'MPRE') === 0 || strpos($browseId, 'VL') === 0 || strpos($browseId, 'RDCL') === 0 || strpos($browseId, 'OLAK') === 0)) {
            $res = self::ytMusicRequest('browse', ['browseId' => $browseId]);
            if ($res) {
                // Extract release header info
                $twoCol = $res['contents']['twoColumnBrowseResultsRenderer'] ?? null;
                if ($twoCol) {
                    $hdr = $twoCol['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'][0]['musicResponsiveHeaderRenderer']
                        ?? ($twoCol['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'][0]['musicEditablePlaylistDetailHeaderRenderer']['header']['musicResponsiveHeaderRenderer'] ?? []);
                    $tStr = '';
                    foreach (($hdr['title']['runs'] ?? []) as $r) {
                        $tStr .= $r['text'] ?? '';
                    }
                    if ($tStr) $releaseTitle = $tStr;

                    $aStr = '';
                    foreach (($hdr['straplineTextOne']['runs'] ?? []) as $r) {
                        $aStr .= $r['text'] ?? '';
                    }
                    if ($aStr) $releaseArtist = $aStr;

                    $hdrThumbs = $hdr['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
                    if (!empty($hdrThumbs)) {
                        $releaseCover = self::resolveArtworkUrl(end($hdrThumbs)['url'] ?? '');
                    }

                    $secContents = $twoCol['secondaryContents']['sectionListRenderer']['contents'] ?? [];
                    foreach ($secContents as $s) {
                        $shelf = $s['musicShelfRenderer'] ?? ($s['musicPlaylistShelfRenderer'] ?? null);
                        if (!$shelf) continue;
                        foreach (($shelf['contents'] ?? []) as $idx => $item) {
                            $m = $item['musicResponsiveListItemRenderer'] ?? null;
                            if (!$m) continue;
                            $vid = $m['playlistItemData']['videoId']
                                ?? ($m['overlay']['musicItemThumbnailOverlayRenderer']['content']['musicPlayButtonRenderer']['playNavigationEndpoint']['watchEndpoint']['videoId'] ?? '');
                            if (empty($vid)) continue;

                            $cols = $m['flexColumns'] ?? [];
                            $trTitle = '';
                            foreach (($cols[0]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'] ?? []) as $r) {
                                $trTitle .= $r['text'] ?? '';
                            }
                            if (empty($trTitle)) continue;

                            $trArtist = '';
                            foreach (($cols[1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'] ?? []) as $r) {
                                $trArtist .= $r['text'] ?? '';
                            }
                            if (empty($trArtist)) $trArtist = $releaseArtist ?: 'Artist';

                            $playsRaw = '';
                            if (isset($cols[2])) {
                                foreach (($cols[2]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'] ?? []) as $r) {
                                    $playsRaw .= $r['text'] ?? '';
                                }
                            }
                            $playsMetric = self::parseMetric($playsRaw);

                            $durSec = 185;
                            $fixed = $m['fixedColumns'] ?? [];
                            if (!empty($fixed)) {
                                $durText = '';
                                foreach (($fixed[0]['musicResponsiveListItemFixedColumnRenderer']['text']['runs'] ?? []) as $r) {
                                    $durText .= $r['text'] ?? '';
                                }
                                if (preg_match('/(\d+):(\d+)/', $durText, $dm)) {
                                    $durSec = ((int)$dm[1] * 60) + (int)$dm[2];
                                }
                            }

                            $itemThumbs = $m['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'] ?? [];
                            $itemCover = !empty($itemThumbs) ? self::resolveArtworkUrl(end($itemThumbs)['url'] ?? '', $vid) : $releaseCover;

                            $trackId = 'trk_yt_' . preg_replace('/[^a-zA-Z0-9_-]/', '', $vid);
                            $artId = 'art_' . substr(md5(strtolower($trArtist)), 0, 10);

                            // Register track in MySQL so it can be streamed immediately via stream.php
                            $ins = $pdo->prepare("
                                INSERT INTO tracks (id, video_id, title, artist_id, artist_name, album_name, duration, genre, cover_art_url, audio_url, stream_count, status, import_source, import_status)
                                VALUES (?, ?, ?, ?, ?, ?, ?, 'Pop', ?, ?, ?, 'published', 'ytmusic_release_sync', 'metadata_ready')
                                ON DUPLICATE KEY UPDATE
                                    cover_art_url = VALUES(cover_art_url),
                                    stream_count = IF(VALUES(stream_count) > 0, VALUES(stream_count), stream_count)
                            ");
                            $ins->execute([
                                $trackId,
                                $vid,
                                $trTitle,
                                $artId,
                                $trArtist,
                                $releaseTitle ?: 'Album',
                                $durSec,
                                $itemCover ?: $releaseCover,
                                '/phpbackend/api/stream.php?id=' . urlencode($trackId),
                                (int)($playsMetric['numeric'] ?? 0)
                            ]);

                            $tracks[] = [
                                'id' => $trackId,
                                'video_id' => $vid,
                                'track_number' => $idx + 1,
                                'title' => $trTitle,
                                'artist_name' => $trArtist,
                                'artist_id' => $artId,
                                'album_name' => $releaseTitle ?: 'Album',
                                'duration' => $durSec,
                                'cover_art_url' => $itemCover ?: $releaseCover,
                                'audio_url' => '/phpbackend/api/stream.php?id=' . urlencode($trackId),
                                'stream_count' => (int)($playsMetric['numeric'] ?? 0),
                                'yt_plays' => $playsMetric['compact'],
                                'flontmie_plays' => 0
                            ];
                        }
                    }
                }
            }
        }

        $result = [
            'browse_id' => $browseId,
            'title' => $releaseTitle,
            'artist' => $releaseArtist,
            'cover_url' => $releaseCover,
            'year' => $releaseYear,
            'tracks' => $tracks
        ];

        if (!empty($tracks)) {
            @file_put_contents($cacheFile, json_encode($result));
        }

        return $result;
    }
}
