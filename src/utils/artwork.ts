import React from 'react';

/**
 * Verified high-resolution official artwork lookup for catalog tracks, albums & artists
 * Ensures legacy or broken YouTube maxresdefault URLs always resolve to genuine, working cover art.
 */
const VERIFIED_ARTWORK_MAP: Record<string, string> = {
  // Legacy / invalid videoId mappings -> Verified official 600x600 cover art
  'c2gK9tq57iQ': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/01/ee/63/01ee6370-1805-15e4-de8c-293a889a439c/075679676351.jpg/600x600bb.jpg',
  'hLDQ88vAhIs': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/01/ee/63/01ee6370-1805-15e4-de8c-293a889a439c/075679676351.jpg/600x600bb.jpg',
  'eE3p9qE1fO8': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/cc/23/83/cc2383d9-eecc-f974-5f5b-d445c583acdb/197342233958_cover.jpg/600x600bb.jpg',
  'T4G5uTd72EM': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/cc/23/83/cc2383d9-eecc-f974-5f5b-d445c583acdb/197342233958_cover.jpg/600x600bb.jpg',
  'CQLsdmU69GD': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/ee/f1/dc/eef1dc82-f516-fd0f-581c-3f952a0e2243/22UMGIM92113.rgb.jpg/600x600bb.jpg',
  'DKrelwjugQA': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/ee/f1/dc/eef1dc82-f516-fd0f-581c-3f952a0e2243/22UMGIM92113.rgb.jpg/600x600bb.jpg',
  'VwzP7mZ7mRk': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e5/a2/55/e5a255b3-f83e-f67a-e20f-23962b18dc3a/196871994545.jpg/600x600bb.jpg',
  'NGZB_L5MdH4': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e5/a2/55/e5a255b3-f83e-f67a-e20f-23962b18dc3a/196871994545.jpg/600x600bb.jpg',
  '4NRXx6U8ABQ': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/61/e7/3f/61e73f94-018d-5f50-50ec-8521952bc72e/20UM1IM11629.rgb.jpg/600x600bb.jpg',
  'H64a2ggVIWc': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/61/e7/3f/61e73f94-018d-5f50-50ec-8521952bc72e/20UM1IM11629.rgb.jpg/600x600bb.jpg',
  'eVli-tstM5E': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a1/1c/ca/a11ccab6-7d4c-e041-d028-998bcebeb709/24UMGIM61704.rgb.jpg/600x600bb.jpg',
  'kIft-LUHHVA': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a1/1c/ca/a11ccab6-7d4c-e041-d028-998bcebeb709/24UMGIM61704.rgb.jpg/600x600bb.jpg',
  'd5gf9dXFKCA': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/600x600bb.jpg',
  'WKZO-CWeOVA': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/600x600bb.jpg',
  'ic8j13piAhQ': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/600x600bb.jpg',
  'aC9HkZW2hZk': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/600x600bb.jpg',
  '1FIxYVbK_oA': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/29/a7/c4/29a7c478-351d-25eb-a116-3e68118cdab8/24UMGIM31246.rgb.jpg/600x600bb.jpg',
  'VZ-oGLluGAc': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/29/a7/c4/29a7c478-351d-25eb-a116-3e68118cdab8/24UMGIM31246.rgb.jpg/600x600bb.jpg',
  'H58vbez_m4E': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/31/3a/3f/313a3fbc-bb8f-80c7-b5a2-e226869a38cd/24UMGIM51924.rgb.jpg/600x600bb.jpg',
  'phLb_SoPBlA': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/31/3a/3f/313a3fbc-bb8f-80c7-b5a2-e226869a38cd/24UMGIM51924.rgb.jpg/600x600bb.jpg',
  '5W8HjA2Gz54': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/af/f8/ef/aff8ef1c-e1e7-8c70-75fa-2201d8785f3d/075679678492.jpg/600x600bb.jpg',
  '9zPl8065b5A': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/af/f8/ef/aff8ef1c-e1e7-8c70-75fa-2201d8785f3d/075679678492.jpg/600x600bb.jpg',
  'mSDfxde8fSg': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bd/3b/a9/bd3ba9fb-9609-144f-bcfe-ead67b5f6ab3/196589564931.jpg/600x600bb.jpg',
  'AdEKgwUqPKI': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bd/3b/a9/bd3ba9fb-9609-144f-bcfe-ead67b5f6ab3/196589564931.jpg/600x600bb.jpg',
  'o2n_5_rN2qA': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/5c/e7/39/5ce73933-8f42-1095-e84b-0caec311f54b/24CRGIM43010.rgb.jpg/600x600bb.jpg',
  'LF2LGaCsMbc': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/5c/e7/39/5ce73933-8f42-1095-e84b-0caec311f54b/24CRGIM43010.rgb.jpg/600x600bb.jpg',
  'uzS3WG6__G4': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bb/45/68/bb4568f3-68cd-619d-fbcb-4e179916545d/BlondCover-Final.jpg/600x600bb.jpg',
  '9cHbvRUALrc': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bb/45/68/bb4568f3-68cd-619d-fbcb-4e179916545d/BlondCover-Final.jpg/600x600bb.jpg',
  'Gs069dndIYk': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/8e/19/5c8e191d-b458-fc29-54ef-bd9367835044/886447618547.jpg/600x600bb.jpg',
  '3cKtSlsYVEU': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/8e/19/5c8e191d-b458-fc29-54ef-bd9367835044/886447618547.jpg/600x600bb.jpg',
  'a5uQMwRMHcs': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg',
  'khnokW3Mw24': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg',
  '5qap5aO4i9A': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3a/3b/e9/3a3be96e-cdde-ff71-eb97-b6e64ef31f58/5063642323819_cover.jpg/600x600bb.jpg',
  '9_quEmGP6YI': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3a/3b/e9/3a3be96e-cdde-ff71-eb97-b6e64ef31f58/5063642323819_cover.jpg/600x600bb.jpg',
  'RxabLA7UQ9k': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/2b/62/eb/2b62ebd7-aa99-988a-0fee-714162f6fbeb/093624965008.jpg/600x600bb.jpg',
  'jgyShFzdB_Q': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/2b/62/eb/2b62ebd7-aa99-988a-0fee-714162f6fbeb/093624965008.jpg/600x600bb.jpg',
};

/**
 * Guaranteed SVG Data URI fallback so an <img> tag can NEVER show a broken image icon even offline
 */
export function createSvgCoverDataUri(label: string = 'MUSIC', type: 'track' | 'artist' | 'album' | 'playlist' = 'track'): string {
  const clean = (label || 'Music').replace(/[^a-zA-Z0-9 &.-]/g, '').slice(0, 22) || 'Music';
  const initials = clean
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'SP';

  const bgGrad =
    type === 'artist'
      ? '<stop offset="0%" stop-color="#1e1b4b"/><stop offset="50%" stop-color="#31102f"/><stop offset="100%" stop-color="#09090b"/>'
      : type === 'playlist'
      ? '<stop offset="0%" stop-color="#3b0764"/><stop offset="50%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#09090b"/>'
      : '<stop offset="0%" stop-color="#450a0a"/><stop offset="50%" stop-color="#18181b"/><stop offset="100%" stop-color="#09090b"/>';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">${bgGrad}</linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#g)"/>
    <circle cx="200" cy="175" r="78" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
    <circle cx="200" cy="175" r="26" fill="rgba(239,68,68,0.22)" stroke="rgba(239,68,68,0.45)" stroke-width="2"/>
    <text x="200" y="185" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="800" font-size="28" letter-spacing="2">${initials}</text>
    <text x="200" y="315" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-family="system-ui, sans-serif" font-weight="700" font-size="18">${clean}</text>
    <text x="200" y="342" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-family="monospace" font-weight="600" font-size="11" letter-spacing="3">MUSIC RELEASE</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Resolves any track, album, playlist, or artist image URL into a verified working image URL
 */
export function resolveArtworkUrl(
  url?: string | null,
  fallbackType: 'track' | 'artist' | 'album' | 'playlist' = 'track',
  titleOrName?: string
): string {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    return createSvgCoverDataUri(titleOrName || 'Music', fallbackType);
  }

  // Check if URL contains any mapped videoId
  for (const [vid, replacement] of Object.entries(VERIFIED_ARTWORK_MAP)) {
    if (trimmed.includes(vid)) {
      return replacement;
    }
  }

  // If it's a YouTube i.ytimg.com maxresdefault URL (which frequently 404s on YouTube if video isn't 1080p), use hqdefault.jpg
  if (trimmed.includes('i.ytimg.com/vi/') && trimmed.includes('/maxresdefault.jpg')) {
    return trimmed.replace('/maxresdefault.jpg', '/hqdefault.jpg');
  }

  // Upgrade small YouTube Musiclh3/yt3 thumbnails (=w60-h60 or =w120-h120) to high-res =w544-h544
  if ((trimmed.includes('googleusercontent.com') || trimmed.includes('ggpht.com')) && /=w\d+-h\d+/.test(trimmed)) {
    return trimmed.replace(/=w\d+-h\d+/, '=w544-h544');
  }

  return trimmed;
}

/**
 * Universal onError handler for all <img> elements so broken image icons NEVER appear
 */
export function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  label?: string,
  fallbackType: 'track' | 'artist' | 'album' | 'playlist' = 'track'
): void {
  const img = e.currentTarget;
  const currentSrc = img.src || '';

  // Stage 1: If maxresdefault failed, try hqdefault
  if (currentSrc.includes('/maxresdefault.jpg')) {
    img.src = currentSrc.replace('/maxresdefault.jpg', '/hqdefault.jpg');
    return;
  }

  // Stage 2: Check if any known video ID is in the URL
  for (const [vid, replacement] of Object.entries(VERIFIED_ARTWORK_MAP)) {
    if (currentSrc.includes(vid) && currentSrc !== replacement) {
      img.src = replacement;
      return;
    }
  }

  // Stage 3: Guaranteed inline SVG cover art (never fails, works offline/online)
  const fallbackUri = createSvgCoverDataUri(label || img.alt || 'Music', fallbackType);
  if (img.src !== fallbackUri) {
    img.src = fallbackUri;
  }
}
