import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Check, Search, X, Loader2, FileText } from 'lucide-react';
import { api } from '../../services/api';
import { AuthUser } from './AuthModal';
import { ArtistProfile } from '../../types/music';
import { resolveArtworkUrl, handleImageError } from '../../utils/artwork';

export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

interface FlontmieOnboardingProps {
  isOpen: boolean;
  initialStep?: OnboardingStep;
  initialAuthMode?: 'signup' | 'signin';
  currentUser: AuthUser | null;
  catalogArtists: ArtistProfile[];
  onAuthenticated: (user: AuthUser) => void;
  onComplete: (data: {
    user: AuthUser | null;
    selectedGenres: string[];
    selectedArtistIds: string[];
    termsAccepted: boolean;
  }) => void;
  onSkipToHome: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

const STORAGE_STEP_KEY = 'flontmie_onboarding_step_v1';
const STORAGE_AUTH_MODE_KEY = 'flontmie_onboarding_auth_mode_v1';
const STORAGE_GENRES_KEY = 'flontmie_onboarding_genres_v1';
const STORAGE_ARTISTS_KEY = 'flontmie_onboarding_artists_v1';

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'GH', name: 'Ghana' },
  { code: 'CA', name: 'Canada' },
  { code: 'KE', name: 'Kenya' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AU', name: 'Australia' },
];

/**
 * High-resolution verified HTTP 200 circular crop images representing each music genre
 */
const GENRE_VISUAL_MAP: Record<string, string> = {
  afrobeats: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/01/ee/63/01ee6370-1805-15e4-de8c-293a889a439c/075679676351.jpg/600x600bb.jpg',
  'r&b': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bb/45/68/bb4568f3-68cd-619d-fbcb-4e179916545d/BlondCover-Final.jpg/600x600bb.jpg',
  rnb: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bb/45/68/bb4568f3-68cd-619d-fbcb-4e179916545d/BlondCover-Final.jpg/600x600bb.jpg',
  rock: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/2b/62/eb/2b62ebd7-aa99-988a-0fee-714162f6fbeb/093624965008.jpg/600x600bb.jpg',
  afropop: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a8/fb/21/a8fb21ed-2106-199e-75dc-f01099c29394/196874507544.jpg/600x600bb.jpg',
  pop: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3a/3b/e9/3a3be96e-cdde-ff71-eb97-b6e64ef31f58/5063642323819_cover.jpg/600x600bb.jpg',
  country: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/8e/19/5c8e191d-b458-fc29-54ef-bd9367835044/886447618547.jpg/600x600bb.jpg',
  jazz: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg',
  gospel: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bd/3b/a9/bd3ba9fb-9609-144f-bcfe-ead67b5f6ab3/196589564931.jpg/600x600bb.jpg',
  reggae: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/af/f8/ef/aff8ef1c-e1e7-8c70-75fa-2201d8785f3d/075679678492.jpg/600x600bb.jpg',
  electronic: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/600x600bb.jpg',
  amapiano: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/ec/2a/4c/ec2a4c8a-b98b-50ac-a386-94f92788ac59/6009710469873.jpg/600x600bb.jpg',
  'rap & hip-hop': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/24/00/61/24006185-de26-141f-72f5-92c192f90bb9/25UMGIM51411.rgb.jpg/600x600bb.jpg',
  hiphop: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/24/00/61/24006185-de26-141f-72f5-92c192f90bb9/25UMGIM51411.rgb.jpg/600x600bb.jpg',
  'lo-fi & chill': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/ee/f1/dc/eef1dc82-f516-fd0f-581c-3f952a0e2243/22UMGIM92113.rgb.jpg/600x600bb.jpg',
  lofi: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/ee/f1/dc/eef1dc82-f516-fd0f-581c-3f952a0e2243/22UMGIM92113.rgb.jpg/600x600bb.jpg',
  classics: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e5/a2/55/e5a255b3-f83e-f67a-e20f-23962b18dc3a/196871994545.jpg/600x600bb.jpg',
  'ambient & soundtracks': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/5c/e7/39/5ce73933-8f42-1095-e84b-0caec311f54b/24CRGIM43010.rgb.jpg/600x600bb.jpg',
  ambient: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/5c/e7/39/5ce73933-8f42-1095-e84b-0caec311f54b/24CRGIM43010.rgb.jpg/600x600bb.jpg',
};

const getGenreVisual = (name: string): string => {
  const key = name.toLowerCase().trim();
  if (GENRE_VISUAL_MAP[key]) return GENRE_VISUAL_MAP[key];
  for (const [k, v] of Object.entries(GENRE_VISUAL_MAP)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return GENRE_VISUAL_MAP.afrobeats;
};

/**
 * Smooth scalloped polygon in objectBoundingBox coordinates for Screen 4 artist cards
 */
const buildScallopPolygon = (lobes = 18, steps = 180): string => {
  const pts: string[] = [];
  const baseRadius = 0.445;
  const waveAmp = 0.048;
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const r = baseRadius + waveAmp * Math.cos(lobes * theta);
    const x = 0.5 + r * Math.cos(theta);
    const y = 0.5 + r * Math.sin(theta);
    pts.push(`${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`);
  }
  return `polygon(${pts.join(', ')})`;
};

const SCALLOP_CLIP_POLYGON = buildScallopPolygon(18, 216);

/**
 * Flontmie Geometric 'F' Logo Mark recreated as vector SVG
 */
export const FlontmieGeometricMark: React.FC<{ className?: string }> = ({ className = 'w-6 h-7' }) => (
  <svg
    viewBox="0 0 100 116"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Flontmie"
  >
    <path
      d="M72 6H98L94 34H50L47 50H23L28 20H70L72 6Z"
      fill="currentColor"
    />
    <path
      d="M62 56H86L82 82H44L38 112H10L12 100H20L27 64H60L62 56Z"
      fill="currentColor"
    />
  </svg>
);

export const FlontmieOnboarding: React.FC<FlontmieOnboardingProps> = ({
  isOpen,
  initialStep,
  initialAuthMode = 'signup',
  currentUser,
  catalogArtists,
  onAuthenticated,
  onComplete,
  onSkipToHome,
  onOpenTerms,
  onOpenPrivacy,
}) => {
  const [step, setStep] = useState<OnboardingStep>(() => {
    if (initialStep) return initialStep;
    try {
      const saved = Number(localStorage.getItem(STORAGE_STEP_KEY));
      if (saved >= 1 && saved <= 5) return saved as OnboardingStep;
    } catch {}
    return 1;
  });

  const [authMode, setAuthMode] = useState<'signup' | 'signin' | 'forgot'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_AUTH_MODE_KEY);
      if (saved === 'signup' || saved === 'signin') return saved;
    } catch {}
    return initialAuthMode;
  });

  // Authentication form fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [resetCode, setResetCode] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Loaded database entities
  const [dbGenres, setDbGenres] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [dbArtists, setDbArtists] = useState<
    Array<{ id: string; name: string; avatar_url: string; country?: string; genres?: string[] }>
  >([]);
  const [legalData, setLegalData] = useState<{
    platform_name: string;
    terms_version: string;
    privacy_version: string;
    effective_date: string;
    terms_sections: Array<{ heading: string; body: string }>;
    privacy_sections: Array<{ heading: string; body: string }>;
  } | null>(null);

  // Selected genres & artists preserved across navigation & refreshes
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_GENRES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_ARTISTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [artistSearchQuery, setArtistSearchQuery] = useState('');
  const [showArtistSearch, setShowArtistSearch] = useState(false);

  const [activeLegalModal, setActiveLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [savingFinal, setSavingFinal] = useState(false);
  const [finalError, setFinalError] = useState<string | null>(null);

  // Local storage synchronization
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_STEP_KEY, String(step));
    } catch {}
  }, [step]);

  useEffect(() => {
    if (authMode === 'signup' || authMode === 'signin') {
      try {
        localStorage.setItem(STORAGE_AUTH_MODE_KEY, authMode);
      } catch {}
    }
  }, [authMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_GENRES_KEY, JSON.stringify(selectedGenres));
    } catch {}
  }, [selectedGenres]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ARTISTS_KEY, JSON.stringify(selectedArtistIds));
    } catch {}
  }, [selectedArtistIds]);

  // Load database genres, artists and legal content
  useEffect(() => {
    let isMounted = true;
    const fetchOnboardingData = async () => {
      try {
        const data = await api.getOnboardingData();
        if (!isMounted) return;
        if (Array.isArray(data.genres) && data.genres.length > 0) {
          setDbGenres(data.genres);
        }
        if (Array.isArray(data.artists) && data.artists.length > 0) {
          setDbArtists(data.artists);
        }
        if (data.legal) {
          setLegalData(data.legal);
        }
      } catch (err) {
        console.error('Failed to load onboarding database data:', err);
      }
    };

    fetchOnboardingData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Hydrate user selections if already authenticated
  useEffect(() => {
    if (currentUser) {
      if (currentUser.favorite_genres && Array.isArray(currentUser.favorite_genres) && selectedGenres.length === 0) {
        setSelectedGenres(currentUser.favorite_genres);
      }
      if (currentUser.favorite_artist_ids && Array.isArray(currentUser.favorite_artist_ids) && selectedArtistIds.length === 0) {
        setSelectedArtistIds(currentUser.favorite_artist_ids);
      }
    }
  }, [currentUser]);

  // Fallback genres
  const effectiveGenres = useMemo(() => {
    if (dbGenres.length > 0) return dbGenres;
    return [
      { id: 'gnr_afrobeats', name: 'Afrobeats', slug: 'afrobeats' },
      { id: 'gnr_rnb', name: 'R&B', slug: 'rnb' },
      { id: 'gnr_rock', name: 'Rock', slug: 'rock' },
      { id: 'gnr_afropop', name: 'Afropop', slug: 'afropop' },
      { id: 'gnr_pop', name: 'Pop', slug: 'pop' },
      { id: 'gnr_country', name: 'Country', slug: 'country' },
      { id: 'gnr_jazz', name: 'Jazz', slug: 'jazz' },
      { id: 'gnr_gospel', name: 'Gospel', slug: 'gospel' },
      { id: 'gnr_reggae', name: 'Reggae', slug: 'reggae' },
      { id: 'gnr_electronic', name: 'Electronic', slug: 'electronic' },
      { id: 'gnr_amapiano', name: 'Amapiano', slug: 'amapiano' },
      { id: 'gnr_hiphop', name: 'Rap & Hip-Hop', slug: 'rap-hip-hop' },
    ];
  }, [dbGenres]);

  const orderedGenres = useMemo(() => {
    const priority = [
      'Afrobeats', 'R&B', 'Rock', 'Afropop', 'Pop', 'Country',
      'Jazz', 'Gospel', 'Reggae', 'Electronic', 'Amapiano', 'Rap & Hip-Hop'
    ];
    const map = new Map<string, { id: string; name: string; slug: string }>();
    effectiveGenres.forEach((g) => map.set(g.name.toLowerCase(), g));

    const result: Array<{ id: string; name: string; slug: string }> = [];
    priority.forEach((name) => {
      const match = map.get(name.toLowerCase());
      if (match) {
        result.push(match);
        map.delete(name.toLowerCase());
      } else {
        result.push({ id: `genre_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`, name, slug: name.toLowerCase() });
      }
    });

    map.forEach((g) => result.push(g));
    return result.slice(0, 12);
  }, [effectiveGenres]);

  // Combine database artists with catalog artists
  const allArtists = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatar_url: string }>();

    dbArtists.forEach((a) => {
      if (a && a.id) {
        map.set(a.id, {
          id: a.id,
          name: a.name,
          avatar_url: resolveArtworkUrl(a.avatar_url, a.name, 'artist'),
        });
      }
    });

    catalogArtists.forEach((a) => {
      if (a && a.id && !map.has(a.id)) {
        map.set(a.id, {
          id: a.id,
          name: a.name,
          avatar_url: resolveArtworkUrl(a.avatar_url, a.name, 'artist'),
        });
      }
    });

    return Array.from(map.values());
  }, [dbArtists, catalogArtists]);

  // Filter artists by search query (fit up to 9 in single viewport)
  const displayArtists = useMemo(() => {
    const list = !artistSearchQuery.trim()
      ? allArtists
      : allArtists.filter((a) => a.name.toLowerCase().includes(artistSearchQuery.toLowerCase()));
    return list.slice(0, 9);
  }, [allArtists, artistSearchQuery]);

  const handleToggleGenre = (genreName: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreName) ? prev.filter((g) => g !== genreName) : [...prev, genreName]
    );
  };

  const handleToggleArtist = (artistId: string) => {
    setSelectedArtistIds((prev) =>
      prev.includes(artistId) ? prev.filter((id) => id !== artistId) : [...prev, artistId]
    );
  };

  // Auth submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      if (authMode === 'signup') {
        if (!email.trim() || !name.trim() || !password) {
          throw new Error('Please fill in all required fields.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        if (password !== repeatPassword) {
          throw new Error('Passwords do not match. Please re-enter.');
        }

        const cleanUsername =
          name.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() ||
          email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

        const res = await api.register({
          email: email.trim(),
          username: cleanUsername,
          password,
          display_name: name.trim(),
          country: country || undefined,
        });

        if (res.user) {
          onAuthenticated(res.user);
          setStep(3);
        } else {
          throw new Error(res.message || 'Registration succeeded, please sign in.');
        }
      } else if (authMode === 'signin') {
        if (!email.trim() || !password) {
          throw new Error('Please enter both email and password.');
        }

        const res = await api.login(email.trim(), password);

        if (res.user) {
          onAuthenticated(res.user);
          if (res.user.favorite_genres && res.user.favorite_genres.length > 0) {
            setSelectedGenres(res.user.favorite_genres);
          }
          if (res.user.favorite_artist_ids && res.user.favorite_artist_ids.length > 0) {
            setSelectedArtistIds(res.user.favorite_artist_ids);
          }
          setStep(3);
        } else {
          throw new Error(res.message || 'Login failed. Please check your credentials.');
        }
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Final opt-in & terms acceptance
  const handleFinalOptIn = async () => {
    setSavingFinal(true);
    setFinalError(null);

    try {
      let updatedUser = currentUser;

      if (currentUser) {
        try {
          const prefRes = await api.saveOnboardingPreferences({
            favorite_genres: selectedGenres,
            favorite_artist_ids: selectedArtistIds,
            completed: false,
          });
          if (prefRes.user) updatedUser = prefRes.user;
        } catch (e) {
          console.warn('Could not save onboarding preferences to server:', e);
        }

        try {
          const termsRes = await api.acceptTerms({
            accepted: true,
            terms_version: legalData?.terms_version || '2026.10',
            privacy_version: legalData?.privacy_version || '2026.10',
          });
          if (termsRes.user) updatedUser = termsRes.user;
        } catch (e) {
          console.warn('Could not save terms acceptance to server:', e);
        }
      }

      try {
        localStorage.removeItem(STORAGE_STEP_KEY);
        localStorage.removeItem(STORAGE_AUTH_MODE_KEY);
      } catch {}

      onComplete({
        user: updatedUser,
        selectedGenres,
        selectedArtistIds,
        termsAccepted: true,
      });
    } catch (err: any) {
      setFinalError(err?.message || 'Unable to save acceptance. Please try again.');
    } finally {
      setSavingFinal(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] h-[100dvh] w-full bg-[#BDB9AD] text-[#0D0D0C] overflow-hidden select-none font-sans">
      <div className="h-full w-full max-w-[440px] mx-auto flex flex-col justify-between px-5 sm:px-6 py-4 sm:py-6 overflow-hidden relative">
        {/* =========================================================
            SCREEN 1: WELCOME (Single-viewport, 2 artist cutouts)
           ========================================================= */}
        {step === 1 && (
          <div className="h-full flex flex-col justify-between overflow-hidden">
            {/* Top Bar: Left Geometric F Mark, Right Skip */}
            <div className="flex items-center justify-between shrink-0">
              <FlontmieGeometricMark className="w-6 h-7 text-[#080808]" />
              <button
                type="button"
                onClick={onSkipToHome}
                className="text-[13px] font-semibold text-[#111111] hover:opacity-75 transition-opacity cursor-pointer"
              >
                Skip
              </button>
            </div>

            {/* Center: Only 2 Individually Positioned Artist Cutout Elements */}
            <div className="relative flex-1 min-h-0 w-full max-w-[360px] mx-auto my-2 select-none pointer-events-none">
              <img
                src="/assets/aistudio/artist_single_dreads.jpg"
                alt="Featured Artist"
                className="absolute top-[6%] left-[2%] w-[48%] max-w-[185px] max-h-[58%] object-contain z-10"
              />
              <img
                src="/assets/aistudio/artist_single_davido.jpg"
                alt="Davido"
                className="absolute bottom-[4%] right-[2%] w-[48%] max-w-[185px] max-h-[58%] object-contain z-20"
              />
            </div>

            {/* Bottom Headline, Tagline & Solid Black Get Started Button */}
            <div className="shrink-0 pt-1 pb-1">
              <h1 className="text-[24px] sm:text-[28px] leading-[1.15] tracking-tight text-[#0B0B0A]">
                <span className="font-extrabold">Elevate</span>{' '}
                <span className="font-normal">Every</span>
                <br />
                <span className="font-normal">Moment With</span>{' '}
                <span className="font-extrabold">Music</span>
              </h1>

              <p className="text-[13px] text-[#22211E] mt-2 sm:mt-3 font-normal">
                Every Beat Tells Your Story.
              </p>

              <div className="mt-4 sm:mt-6 px-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full py-3 sm:py-3.5 bg-[#080808] hover:bg-[#1a1a1a] active:scale-[0.99] text-white text-[13px] font-medium tracking-wide transition-all cursor-pointer shadow-sm"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 2: AUTHENTICATION (Single-viewport Sign Up & Sign In)
           ========================================================= */}
        {step === 2 && (
          <div className="h-full flex flex-col justify-between overflow-hidden">
            <div className="relative flex items-center justify-center shrink-0 pb-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="absolute left-0 p-1 -ml-1 text-[#111111] hover:opacity-70 transition-opacity cursor-pointer"
                aria-label="Back to Welcome"
              >
                <ChevronLeft className="w-6 h-6 stroke-[1.75]" />
              </button>
              <FlontmieGeometricMark className="w-6 h-7 text-[#080808]" />
            </div>

            <div className="my-auto w-full shrink-0">
              <div className="rounded-[28px] sm:rounded-[34px] bg-[#B6B2A6] shadow-[0_14px_38px_rgba(0,0,0,0.09)] px-4 sm:px-5 py-4 sm:py-6 border border-black/[0.04]">
                {authMode === 'signup' && (
                  <>
                    <h2 className="text-[15px] sm:text-[16px] font-bold text-[#0E0E0D] mb-3 px-0.5">
                      Sign Up
                    </h2>

                    {authError && (
                      <div className="mb-2.5 px-3 py-1.5 bg-red-900/15 border border-red-800/40 text-red-950 text-xs rounded">
                        {authError}
                      </div>
                    )}

                    <form onSubmit={handleAuthSubmit} className="space-y-2.5 sm:space-y-3">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        autoComplete="email"
                        className="w-full px-3.5 py-2.5 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Name"
                        autoComplete="name"
                        className="w-full px-3.5 py-2.5 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      <div className="relative">
                        <select
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          aria-label="Country"
                          className="w-full px-3.5 py-2.5 bg-transparent border border-[#625F57] text-[13px] text-[#111] appearance-none focus:outline-none focus:border-black cursor-pointer"
                        >
                          <option value="" className="bg-[#BDB9AD] text-[#36342F]">
                            Country
                          </option>
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code} className="bg-[#BDB9AD] text-[#111]">
                              {c.name} ({c.code})
                            </option>
                          ))}
                        </select>
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#222]"
                        >
                          <path
                            d="M5 7.5L10 12.5L15 7.5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        autoComplete="new-password"
                        className="w-full px-3.5 py-2.5 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      <input
                        type="password"
                        required
                        value={repeatPassword}
                        onChange={(e) => setRepeatPassword(e.target.value)}
                        placeholder="Repeat Password"
                        autoComplete="new-password"
                        className="w-full px-3.5 py-2.5 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      <div className="pt-1">
                        <button
                          type="submit"
                          disabled={authLoading}
                          className="px-7 py-2.5 bg-[#080808] hover:bg-[#1d1d1d] disabled:opacity-60 text-white text-[13px] font-medium transition-all cursor-pointer inline-flex items-center gap-2"
                        >
                          {authLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Sign Up</span>
                        </button>
                      </div>
                    </form>
                  </>
                )}

                {authMode === 'signin' && (
                  <>
                    <h2 className="text-[15px] sm:text-[16px] font-bold text-[#0E0E0D] mb-3 px-0.5">
                      Sign In
                    </h2>

                    {authError && (
                      <div className="mb-2.5 px-3 py-1.5 bg-red-900/15 border border-red-800/40 text-red-950 text-xs rounded">
                        {authError}
                      </div>
                    )}

                    {authSuccess && (
                      <div className="mb-2.5 px-3 py-1.5 bg-emerald-900/15 border border-emerald-800/40 text-emerald-950 text-xs rounded">
                        {authSuccess}
                      </div>
                    )}

                    <form onSubmit={handleAuthSubmit} className="space-y-3">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        autoComplete="email"
                        className="w-full px-3.5 py-2.5 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        autoComplete="current-password"
                        className="w-full px-3.5 py-2.5 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      <div className="pt-1 flex items-end justify-between gap-3">
                        <button
                          type="submit"
                          disabled={authLoading}
                          className="px-8 py-2.5 bg-[#080808] hover:bg-[#1d1d1d] disabled:opacity-60 text-white text-[13px] font-medium transition-all cursor-pointer inline-flex items-center gap-2"
                        >
                          {authLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Sign In</span>
                        </button>

                        <label className="flex items-center gap-1.5 text-[11px] text-[#23221F] cursor-pointer pb-0.5">
                          <span>Remember Me</span>
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-3.5 h-3.5 accent-black border border-[#23221F] rounded-none cursor-pointer"
                          />
                        </label>
                      </div>
                    </form>
                  </>
                )}

                {authMode === 'forgot' && (
                  <>
                    <h2 className="text-[15px] sm:text-[16px] font-bold text-[#0E0E0D] mb-1.5 px-0.5">
                      Forgot Password
                    </h2>
                    <p className="text-xs text-[#33312C] mb-3">
                      Enter your account email to request a password reset code.
                    </p>

                    {authError && (
                      <div className="mb-2.5 px-3 py-1.5 bg-red-900/15 border border-red-800/40 text-red-950 text-xs rounded">
                        {authError}
                      </div>
                    )}

                    {authSuccess && (
                      <div className="mb-2.5 px-3 py-1.5 bg-emerald-900/15 border border-emerald-800/40 text-emerald-950 text-xs rounded">
                        {authSuccess}
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        className="w-full px-3.5 py-2.5 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      {resetCodeSent && (
                        <>
                          <input
                            type="text"
                            value={resetCode}
                            onChange={(e) => setResetCode(e.target.value)}
                            placeholder="Reset Code"
                            className="w-full px-3.5 py-2.5 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black uppercase"
                          />
                          <input
                            type="password"
                            value={newResetPassword}
                            onChange={(e) => setNewResetPassword(e.target.value)}
                            placeholder="New Password"
                            className="w-full px-3.5 py-2.5 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                          />
                        </>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        {!resetCodeSent ? (
                          <button
                            type="button"
                            disabled={authLoading}
                            onClick={async () => {
                              if (!email.trim()) {
                                setAuthError('Please enter your email address.');
                                return;
                              }
                              setAuthLoading(true);
                              setAuthError(null);
                              try {
                                const r = await api.requestPasswordReset(email.trim());
                                setResetCodeSent(true);
                                setAuthSuccess(r?.message || 'Reset code generated.');
                              } catch (err: any) {
                                setAuthError(err?.message || 'Could not request reset.');
                              } finally {
                                setAuthLoading(false);
                              }
                            }}
                            className="px-5 py-2.5 bg-[#080808] text-white text-[13px] font-medium cursor-pointer"
                          >
                            Send Reset Code
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={authLoading}
                            onClick={async () => {
                              setAuthLoading(true);
                              setAuthError(null);
                              try {
                                await api.confirmPasswordReset(
                                  email.trim(),
                                  resetCode.trim(),
                                  newResetPassword
                                );
                                setAuthSuccess('Password updated! Please sign in.');
                                setResetCodeSent(false);
                                setAuthMode('signin');
                              } catch (err: any) {
                                setAuthError(err?.message || 'Invalid reset code.');
                              } finally {
                                setAuthLoading(false);
                              }
                            }}
                            className="px-5 py-2.5 bg-[#080808] text-white text-[13px] font-medium cursor-pointer"
                          >
                            Reset Password
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('signin');
                            setAuthError(null);
                          }}
                          className="text-xs font-semibold text-[#111] underline cursor-pointer"
                        >
                          Back to Sign In
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {authMode === 'signup' && (
                <div className="mt-4 text-center">
                  <p className="text-[12px] text-[#22211E]">
                    Already Have An Account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setAuthError(null);
                        setAuthSuccess(null);
                      }}
                      className="font-bold text-[#090909] hover:underline cursor-pointer"
                    >
                      Sign In
                    </button>
                  </p>
                </div>
              )}

              {authMode === 'signin' && (
                <div className="mt-4 text-center flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot');
                      setAuthError(null);
                      setAuthSuccess(null);
                    }}
                    className="text-[12px] text-[#22211E] hover:text-black cursor-pointer"
                  >
                    Forgot Password
                  </button>

                  <p className="text-[12px] text-[#22211E]">
                    Need An Account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setAuthError(null);
                        setAuthSuccess(null);
                      }}
                      className="font-bold text-[#090909] hover:underline cursor-pointer"
                    >
                      Sign Up
                    </button>
                  </p>
                </div>
              )}
            </div>

            <div className="shrink-0 h-2" />
          </div>
        )}

        {/* =========================================================
            SCREEN 3: CHOOSE YOUR MUSIC INTEREST (Single-viewport, no scroll)
           ========================================================= */}
        {step === 3 && (
          <div className="h-full flex flex-col justify-between overflow-hidden">
            <div className="relative flex items-center justify-between shrink-0 pb-1">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="p-1 -ml-1 text-[#111111] hover:opacity-70 transition-opacity cursor-pointer"
                aria-label="Back to Authentication"
              >
                <ChevronLeft className="w-6 h-6 stroke-[1.75]" />
              </button>
              <FlontmieGeometricMark className="w-6 h-7 text-[#080808]" />
              <button
                type="button"
                onClick={() => setStep(4)}
                className="text-[13px] font-semibold text-[#111111] hover:opacity-75 transition-opacity cursor-pointer"
              >
                Skip
              </button>
            </div>

            <div className="shrink-0 mt-1 mb-2">
              <h1 className="text-[22px] sm:text-[26px] leading-[1.14] tracking-tight text-[#0B0B0A]">
                <span className="font-normal">Choose </span>
                <span className="font-extrabold">your Music</span>
                <br />
                <span className="font-extrabold">Interest</span>
              </h1>
            </div>

            {/* Circular Crop Images Representing Each Genre Accompanied by Genre Name (Fits in 1 viewport without scroll) */}
            <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden py-1">
              <div className="w-full grid grid-cols-3 gap-x-2 gap-y-2.5 sm:gap-y-3.5 items-center justify-items-center">
                {orderedGenres.map((g) => {
                  const isSelected = selectedGenres.includes(g.name);
                  const genreImgUrl = getGenreVisual(g.name);

                  return (
                    <div key={g.id} className="flex flex-col items-center w-full">
                      <button
                        type="button"
                        onClick={() => handleToggleGenre(g.name)}
                        aria-pressed={isSelected}
                        className="relative group cursor-pointer transition-transform active:scale-95 flex flex-col items-center"
                      >
                        <div
                          className={`w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] rounded-full overflow-hidden relative border-2 transition-all ${
                            isSelected
                              ? 'border-[#080808] ring-2 ring-black/25 scale-105 shadow-md'
                              : 'border-black/15 hover:border-black/40'
                          }`}
                        >
                          <img
                            src={genreImgUrl}
                            alt={g.name}
                            referrerPolicy="no-referrer"
                            onError={(e) => handleImageError(e, g.name, 'album')}
                            className={`w-full h-full object-cover transition-all duration-300 ${
                              isSelected ? 'scale-110 brightness-75' : 'group-hover:scale-105'
                            }`}
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                              <span className="w-5 h-5 rounded-full bg-[#080808] text-white flex items-center justify-center shadow-lg">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            </div>
                          )}
                        </div>
                        <span
                          className={`mt-1 text-center text-[11px] sm:text-[12px] leading-tight max-w-[86px] truncate transition-colors ${
                            isSelected ? 'text-[#080808] font-bold' : 'text-[#24231F] font-semibold'
                          }`}
                        >
                          {g.name}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Continue CTA */}
            <div className="shrink-0 pt-2">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="w-full py-3 sm:py-3.5 bg-[#080808] hover:bg-[#1d1d1d] text-white text-[13px] font-medium tracking-wide transition-all cursor-pointer"
              >
                {selectedGenres.length > 0
                  ? `Continue (${selectedGenres.length} selected)`
                  : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 4: CHOOSE YOUR FAVS (Single-viewport, no scroll)
           ========================================================= */}
        {step === 4 && (
          <div className="h-full flex flex-col justify-between overflow-hidden">
            <div className="relative flex items-center justify-between shrink-0 pb-1">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="p-1 -ml-1 text-[#111111] hover:opacity-70 transition-opacity cursor-pointer"
                aria-label="Back to Music Interest"
              >
                <ChevronLeft className="w-6 h-6 stroke-[1.75]" />
              </button>
              <FlontmieGeometricMark className="w-6 h-7 text-[#080808]" />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowArtistSearch((s) => !s)}
                  className="p-1 text-[#111111] hover:opacity-75 transition-opacity cursor-pointer"
                  aria-label="Search artists"
                  title="Search artists"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="text-[13px] font-semibold text-[#111111] hover:opacity-75 transition-opacity cursor-pointer"
                >
                  Skip
                </button>
              </div>
            </div>

            <div className="shrink-0 mt-1 mb-1.5">
              <h1 className="text-[22px] sm:text-[26px] leading-[1.14] tracking-tight text-[#0B0B0A]">
                <span className="font-normal">Choose </span>
                <span className="font-extrabold">your Favs</span>
              </h1>
            </div>

            {showArtistSearch && (
              <div className="shrink-0 mb-2 relative">
                <input
                  type="text"
                  value={artistSearchQuery}
                  onChange={(e) => setArtistSearchQuery(e.target.value)}
                  placeholder="Search artists..."
                  className="w-full px-3 py-1.5 bg-transparent border border-[#625F57] text-xs text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                />
                {artistSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setArtistSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#222] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Artist Cards Grid Fitting cleanly in 1 viewport without scrolling */}
            <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden py-1">
              <div className="w-full grid grid-cols-3 gap-x-2 gap-y-2.5 sm:gap-y-3.5 items-center justify-items-center">
                {displayArtists.map((artist) => {
                  const isSelected = selectedArtistIds.includes(artist.id);
                  return (
                    <div key={artist.id} className="flex flex-col items-center w-full">
                      <button
                        type="button"
                        onClick={() => handleToggleArtist(artist.id)}
                        aria-pressed={isSelected}
                        className="relative w-[68px] h-[68px] sm:w-[82px] sm:h-[82px] flex items-center justify-center transition-transform active:scale-95 cursor-pointer group"
                      >
                        <div
                          className={`w-full h-full relative overflow-hidden flex items-center justify-center ${
                            isSelected ? 'scale-105' : 'group-hover:scale-[1.03]'
                          } transition-all`}
                          style={{ clipPath: SCALLOP_CLIP_POLYGON }}
                        >
                          {artist.avatar_url && (
                            <img
                              src={artist.avatar_url}
                              alt={artist.name}
                              referrerPolicy="no-referrer"
                              onError={(e) => handleImageError(e, artist.name, 'artist')}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          )}
                        </div>
                        {isSelected && (
                          <span className="absolute top-1 right-1 z-20 w-5 h-5 rounded-full bg-[#080808] text-white flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </button>
                      <span className="mt-1 text-[11px] font-bold text-[#0B0B0A] text-center leading-tight truncate max-w-[92px]">
                        {artist.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 pt-2">
              <button
                type="button"
                onClick={() => setStep(5)}
                className="w-full py-3 sm:py-3.5 bg-[#080808] hover:bg-[#1d1d1d] text-white text-[13px] font-medium tracking-wide transition-all cursor-pointer"
              >
                {selectedArtistIds.length > 0
                  ? `Continue (${selectedArtistIds.length} selected)`
                  : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 5: OPT IN (Single-viewport, 2 artist cutouts, no FLONTMIE full text, no disclaimer card)
           ========================================================= */}
        {step === 5 && (
          <div className="h-full flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="p-1 -ml-1 text-[#111111] hover:opacity-70 transition-opacity cursor-pointer"
                aria-label="Back to Choose your Favs"
              >
                <ChevronLeft className="w-6 h-6 stroke-[1.75]" />
              </button>
              <FlontmieGeometricMark className="w-6 h-7 text-[#080808]" />
              <div className="w-6" />
            </div>

            {/* Center: Only 2 Individually Positioned Subtle Faded Artist Cutouts */}
            <div className="relative flex-1 min-h-0 w-full max-w-[360px] mx-auto my-2 select-none pointer-events-none opacity-35">
              <img
                src="/assets/aistudio/artist_single_dreads.jpg"
                alt="Featured Artist"
                className="absolute top-[6%] left-[2%] w-[48%] max-w-[185px] max-h-[58%] object-contain z-10"
              />
              <img
                src="/assets/aistudio/artist_single_davido.jpg"
                alt="Davido"
                className="absolute bottom-[4%] right-[2%] w-[48%] max-w-[185px] max-h-[58%] object-contain z-20"
              />
            </div>

            {/* Bottom Section: Headline, Tagline, Opt In Button & Footer Links */}
            <div className="shrink-0 pt-1 pb-1">
              <h1 className="text-[24px] sm:text-[28px] leading-[1.15] tracking-tight text-[#0B0B0A]">
                <span className="font-extrabold">Elevate</span>{' '}
                <span className="font-normal">Every</span>
                <br />
                <span className="font-normal">Moment With</span>{' '}
                <span className="font-extrabold">Music</span>
              </h1>

              <p className="text-[13px] text-[#22211E] mt-2 sm:mt-3 font-normal">
                Every Beat Tells Your Story.
              </p>

              {finalError && (
                <div className="mt-2 text-xs text-red-900 bg-red-900/15 p-2 rounded border border-red-900/30">
                  {finalError}
                </div>
              )}

              {/* Solid Black Opt In Button */}
              <div className="mt-4 sm:mt-6 px-2">
                <button
                  type="button"
                  disabled={savingFinal}
                  onClick={handleFinalOptIn}
                  className="w-full py-3 sm:py-3.5 bg-[#080808] hover:bg-[#1a1a1a] disabled:opacity-60 active:scale-[0.99] text-white text-[13px] font-medium tracking-wide transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                >
                  {savingFinal && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Opt In</span>
                </button>
              </div>

              {/* Footer Legal Links */}
              <p className="text-[10px] text-center text-[#2A2925] mt-2.5">
                By continuing, you agree to our{' '}
                <button
                  type="button"
                  onClick={onOpenTerms || (() => setActiveLegalModal('terms'))}
                  className="font-bold underline text-[#111] hover:opacity-75 cursor-pointer"
                >
                  Terms and Conditions
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={onOpenPrivacy || (() => setActiveLegalModal('privacy'))}
                  className="font-bold underline text-[#111] hover:opacity-75 cursor-pointer"
                >
                  Privacy Policy
                </button>
                .
              </p>
            </div>
          </div>
        )}
      </div>

      {/* In-App Quick Legal Preview Modal */}
      {activeLegalModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#EFECE3] text-[#111] rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden border border-black/10">
            <div className="px-6 py-4 border-b border-black/10 flex items-center justify-between bg-[#E4E0D5]">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-[#080808]" />
                <h3 className="text-base font-extrabold text-[#0B0B0A]">
                  {activeLegalModal === 'terms'
                    ? 'Flontmie Terms and Conditions'
                    : 'Flontmie Privacy Policy'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveLegalModal(null)}
                className="p-1.5 rounded-full hover:bg-black/10 text-[#222] transition-colors cursor-pointer"
                aria-label="Close legal view"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-[#2A2823]">
              <div className="pb-2 border-b border-black/10 text-[11px] text-[#55524B]">
                <span>
                  Effective Date: {legalData?.effective_date || 'October 29, 2026'}
                </span>
                <span className="mx-2">·</span>
                <span>
                  Version:{' '}
                  {activeLegalModal === 'terms'
                    ? legalData?.terms_version || '2026.10'
                    : legalData?.privacy_version || '2026.10'}
                </span>
              </div>

              {activeLegalModal === 'terms' ? (
                <>
                  {(legalData?.terms_sections && legalData.terms_sections.length > 0
                    ? legalData.terms_sections
                    : [
                        {
                          heading: '1. Acceptance of Terms',
                          body: 'By accessing and creating an account on the Flontmie platform, you enter into a binding agreement and agree to comply with all applicable local, national, and international laws.',
                        },
                        {
                          heading: '2. User Eligibility & Accounts',
                          body: 'You must provide accurate information when registering. You are solely responsible for safeguarding your credentials and any activity under your account.',
                        },
                        {
                          heading: '3. Intellectual Property & Genuine Media',
                          body: 'All music, album artwork, lyrics, audio recordings, and videos provided on Flontmie are protected by copyright. Flontmie strictly serves genuine distributor and administrator catalog media.',
                        },
                        {
                          heading: '4. Acceptable Conduct',
                          body: 'Users agree not to scrape, reverse-engineer, redistribute, or interfere with security features or music stream delivery systems.',
                        },
                      ]
                  ).map((sec, idx) => (
                    <div key={idx} className="space-y-1">
                      <h4 className="font-bold text-[13px] text-[#0A0A09]">
                        {sec.heading}
                      </h4>
                      <p>{sec.body}</p>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {(legalData?.privacy_sections && legalData.privacy_sections.length > 0
                    ? legalData.privacy_sections
                    : [
                        {
                          heading: '1. Information We Collect',
                          body: 'We collect your email, display name, country of residence, and streaming interaction preferences (favorite genres and followed artists).',
                        },
                        {
                          heading: '2. Use of Information',
                          body: 'We use your information exclusively to deliver personalized playlists, synchronize playback states, record authentic like and comment engagement, and uphold platform security.',
                        },
                        {
                          heading: '3. Data Security & Storage',
                          body: 'Account credentials and preferences are securely encrypted and stored in our production database. We never sell your personal data to third-party ad brokers.',
                        },
                      ]
                  ).map((sec, idx) => (
                    <div key={idx} className="space-y-1">
                      <h4 className="font-bold text-[13px] text-[#0A0A09]">
                        {sec.heading}
                      </h4>
                      <p>{sec.body}</p>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="px-6 py-4 bg-[#E4E0D5] border-t border-black/10 flex items-center justify-between">
              <span className="text-[11px] text-[#44413A]">
                {legalData?.platform_name || 'Flontmie Music'}
              </span>
              <button
                type="button"
                onClick={() => setActiveLegalModal(null)}
                className="px-5 py-2 bg-[#080808] hover:bg-[#1f1f1f] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
