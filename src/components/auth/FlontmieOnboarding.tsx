import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Check, Search, X, Loader2, ShieldCheck, FileText, Lock } from 'lucide-react';
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
}

const STORAGE_STEP_KEY = 'flontmie_onboarding_step_v1';
const STORAGE_AUTH_MODE_KEY = 'flontmie_onboarding_auth_mode_v1';
const STORAGE_GENRES_KEY = 'flontmie_onboarding_genres_v1';
const STORAGE_ARTISTS_KEY = 'flontmie_onboarding_artists_v1';
const STORAGE_TERMS_CHECKED_KEY = 'flontmie_onboarding_terms_checked_v1';

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

// Generate an 18-lobe smooth scalloped circle polygon in objectBoundingBox (0..1) coordinates
const buildScallopPolygon = (lobes = 18, steps = 180): string => {
  const pts: string[] = [];
  const baseRadius = 0.445;
  const waveAmp = 0.048;
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    // Smooth rounded outward bumps
    const r = baseRadius + waveAmp * Math.cos(lobes * theta);
    const x = 0.5 + r * Math.cos(theta);
    const y = 0.5 + r * Math.sin(theta);
    pts.push(`${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`);
  }
  return `polygon(${pts.join(', ')})`;
};

const SCALLOP_CLIP_POLYGON = buildScallopPolygon(18, 216);

/**
 * Exact Flontmie Geometric 'F' Logo Mark from the reference screenshot
 */
export const FlontmieGeometricMark: React.FC<{ className?: string }> = ({ className = 'w-6 h-7' }) => (
  <svg
    viewBox="0 0 100 116"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Flontmie"
  >
    {/* Upper stepped bar */}
    <path
      d="M72 6H98L94 34H50L47 50H23L28 20H70L72 6Z"
      fill="#080808"
    />
    {/* Lower stepped stem & bar */}
    <path
      d="M62 56H86L82 82H44L38 112H10L12 100H20L27 64H60L62 56Z"
      fill="#080808"
    />
  </svg>
);

/**
 * Sky-with-clouds and rolling green hills background SVG used inside the scalloped badges
 * on Screen 3 (Choose your Music Interest) and Screen 4 (Choose your Favs)
 */
const SkyHillsIllustration: React.FC = () => (
  <svg
    viewBox="0 0 200 200"
    className="w-full h-full object-cover select-none pointer-events-none"
    preserveAspectRatio="xMidYMid slice"
  >
    <defs>
      <linearGradient id="flSkyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#9ED4F7" />
        <stop offset="48%" stopColor="#EBF7FE" />
        <stop offset="72%" stopColor="#FFFFFF" />
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#flSkyGrad)" />
    {/* Soft fluffy white clouds at top */}
    <circle cx="72" cy="40" r="24" fill="#FFFFFF" opacity="0.95" />
    <circle cx="102" cy="34" r="28" fill="#FFFFFF" opacity="0.98" />
    <circle cx="132" cy="42" r="22" fill="#FFFFFF" opacity="0.95" />
    <ellipse cx="100" cy="48" rx="52" ry="18" fill="#FFFFFF" />
    {/* Upper light-green rolling hill */}
    <path
      d="M-10 146 Q 48 124 112 142 T 210 138 L 210 200 L -10 200 Z"
      fill="#A7D44E"
    />
    {/* Lower olive-green foreground hill */}
    <path
      d="M-10 162 Q 95 135 210 160 L 210 205 L -10 205 Z"
      fill="#769A1B"
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
}) => {
  // Persisted step state across refreshes & back navigation
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

  // Authentication Form State (Screen 2)
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

  // Onboarding Database Data (Genres, Artists, Legal Documents)
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

  // Selected Music Interests (Screen 3) & Favorite Artists (Screen 4) - preserved across backward/forward & refresh
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

  // Terms & Conditions Acceptance State (Screen 5)
  const [termsAcceptedChecked, setTermsAcceptedChecked] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TERMS_CHECKED_KEY);
      return saved === null ? true : saved === 'true';
    } catch {}
    return true;
  });
  const [activeLegalModal, setActiveLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [savingFinal, setSavingFinal] = useState(false);
  const [finalError, setFinalError] = useState<string | null>(null);

  // Sync step & selections to localStorage
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TERMS_CHECKED_KEY, String(termsAcceptedChecked));
    } catch {}
  }, [termsAcceptedChecked]);

  // Load real genres, artists, and Terms & Privacy documents from the MySQL backend
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    api
      .getOnboardingData()
      .then((res) => {
        if (!mounted || !res) return;
        if (Array.isArray(res.genres) && res.genres.length > 0) {
          setDbGenres(res.genres);
        }
        if (Array.isArray(res.artists) && res.artists.length > 0) {
          setDbArtists(res.artists);
        }
        if (res.legal) {
          setLegalData(res.legal);
        }
        if (res.user) {
          if (Array.isArray(res.user.favorite_genres) && res.user.favorite_genres.length > 0) {
            setSelectedGenres((prev) =>
              Array.from(new Set([...prev, ...res.user.favorite_genres]))
            );
          }
          if (Array.isArray(res.user.favorite_artist_ids) && res.user.favorite_artist_ids.length > 0) {
            setSelectedArtistIds((prev) =>
              Array.from(new Set([...prev, ...res.user.favorite_artist_ids]))
            );
          }
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [isOpen, currentUser?.id]);

  // Order genres so the 10 badges in the screenshot appear in their exact positions first, followed by any additional DB genres
  const orderedGenres = useMemo(() => {
    const preferredOrder = [
      'R&B',
      'Afrobeats',
      'Rock',
      'Afropop',
      'Pop',
      'Country',
      'Jazz',
      'Gospel',
      'Reggae',
      'Electronic',
    ];
    const fromDb = dbGenres.length > 0
      ? dbGenres
      : preferredOrder.map((nm) => ({ id: `gen_${nm.toLowerCase()}`, name: nm, slug: nm.toLowerCase() }));

    const result: Array<{ id: string; name: string; slug: string }> = [];
    const usedIds = new Set<string>();

    for (const target of preferredOrder) {
      const match = fromDb.find(
        (g) =>
          g.name.toLowerCase() === target.toLowerCase() ||
          (target === 'R&B' && g.name.toLowerCase().startsWith('r&b'))
      );
      if (match && !usedIds.has(match.id)) {
        usedIds.add(match.id);
        result.push({
          ...match,
          name: target === 'R&B' ? 'R&B' : match.name,
        });
      } else {
        const synId = `gen_${target.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        if (!usedIds.has(synId)) {
          usedIds.add(synId);
          result.push({ id: synId, name: target, slug: target.toLowerCase() });
        }
      }
    }

    for (const g of fromDb) {
      if (!usedIds.has(g.id)) {
        usedIds.add(g.id);
        result.push(g);
      }
    }

    return result;
  }, [dbGenres]);

  // Merge DB artists from onboarding_data + catalogArtists prop so real artist pictures are always available
  const displayArtists = useMemo(() => {
    const list: Array<{ id: string; name: string; avatar_url: string }> = [];
    const seen = new Set<string>();

    for (const a of dbArtists) {
      if (!a.id || seen.has(a.id)) continue;
      seen.add(a.id);
      list.push({
        id: a.id,
        name: a.name,
        avatar_url: resolveArtworkUrl(a.avatar_url, 'artist', a.name),
      });
    }

    for (const ca of catalogArtists) {
      if (!ca.id || seen.has(ca.id)) continue;
      seen.add(ca.id);
      list.push({
        id: ca.id,
        name: ca.name,
        avatar_url: resolveArtworkUrl(ca.avatarUrl, 'artist', ca.name),
      });
    }

    const q = artistSearchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => a.name.toLowerCase().includes(q));
  }, [dbArtists, catalogArtists, artistSearchQuery]);

  if (!isOpen) return null;

  // Toggle genre selection & persist to backend if logged in
  const handleToggleGenre = (genreName: string) => {
    setSelectedGenres((prev) => {
      const exists = prev.includes(genreName);
      const next = exists ? prev.filter((g) => g !== genreName) : [...prev, genreName];
      if (api.getToken()) {
        api.saveOnboardingPreferences({ favorite_genres: next }).catch(() => {});
      }
      return next;
    });
  };

  // Toggle artist selection & persist to backend if logged in
  const handleToggleArtist = (artistId: string) => {
    setSelectedArtistIds((prev) => {
      const exists = prev.includes(artistId);
      const next = exists ? prev.filter((id) => id !== artistId) : [...prev, artistId];
      if (api.getToken()) {
        api.saveOnboardingPreferences({ favorite_artist_ids: next }).catch(() => {});
      }
      return next;
    });
  };

  // Screen 2: Handle Sign Up / Sign In submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (authMode === 'signup') {
      if (!email.trim() || !name.trim() || !password) {
        setAuthError('Please fill in your email, name, and password.');
        return;
      }
      if (password.length < 6) {
        setAuthError('Password must be at least 6 characters.');
        return;
      }
      if (password !== repeatPassword) {
        setAuthError('Passwords do not match.');
        return;
      }

      setAuthLoading(true);
      try {
        const cleanUsername =
          name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '') ||
          email
            .split('@')[0]
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '');

        const res = await api.register({
          email: email.trim(),
          username: `${cleanUsername}${Math.floor(10 + Math.random() * 89)}`,
          password,
          display_name: name.trim(),
          country: (country || 'NG').toUpperCase(),
        });

        if (res && res.user) {
          onAuthenticated(res.user);
          setStep(3);
        }
      } catch (err: any) {
        setAuthError(err?.message || 'Registration failed. Please verify your details.');
      } finally {
        setAuthLoading(false);
      }
    } else if (authMode === 'signin') {
      if (!email.trim() || !password) {
        setAuthError('Please enter your email and password.');
        return;
      }
      setAuthLoading(true);
      try {
        const res = await api.login(email.trim(), password);
        if (res && res.user) {
          if (Array.isArray(res.user.favorite_genres) && res.user.favorite_genres.length > 0) {
            setSelectedGenres((prev) => Array.from(new Set([...prev, ...res.user.favorite_genres])));
          }
          if (Array.isArray(res.user.favorite_artist_ids) && res.user.favorite_artist_ids.length > 0) {
            setSelectedArtistIds((prev) => Array.from(new Set([...prev, ...res.user.favorite_artist_ids])));
          }
          onAuthenticated(res.user);
          setStep(3);
        }
      } catch (err: any) {
        setAuthError(err?.message || 'Invalid email or password.');
      } finally {
        setAuthLoading(false);
      }
    }
  };

  // Screen 5: Handle Opt In & Terms Acceptance
  const handleOptInComplete = async () => {
    setFinalError(null);
    if (!termsAcceptedChecked) {
      setFinalError('Please accept the Terms and Conditions and Privacy Policy to continue.');
      return;
    }

    setSavingFinal(true);
    try {
      const termsVer = legalData?.terms_version || '2026.10';
      const privVer = legalData?.privacy_version || '2026.10';
      let updatedUser = currentUser;

      if (api.getToken()) {
        const res = await api.acceptTerms({
          accepted: true,
          terms_version: termsVer,
          privacy_version: privVer,
          favorite_genres: selectedGenres,
          favorite_artist_ids: selectedArtistIds,
        });
        if (res && res.user) {
          updatedUser = res.user;
          onAuthenticated(res.user);
        }
      }

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

  return (
    <div className="fixed inset-0 z-[150] bg-[#BDB9AD] text-[#0D0D0C] overflow-y-auto overflow-x-hidden select-none font-sans">
      <div className="min-h-screen w-full max-w-[440px] mx-auto flex flex-col justify-between px-6 pt-5 pb-8 relative">
        {/* =========================================================
            SCREEN 1: WELCOME
           ========================================================= */}
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-between min-h-[calc(100vh-52px)]">
            {/* Top Bar: Left F logo, Right Skip */}
            <div className="flex items-center justify-between pt-1">
              <FlontmieGeometricMark className="w-6 h-7" />
              <button
                type="button"
                onClick={onSkipToHome}
                className="text-[13px] font-semibold text-[#111111] hover:opacity-75 transition-opacity cursor-pointer"
              >
                Skip
              </button>
            </div>

            {/* Center Overlapping Scalloped Artist Cutouts */}
            <div className="my-auto py-2 -mx-6 flex items-center justify-center">
              <img
                src="/assets/aistudio/onboarding_hero_collage.jpg"
                alt="Flontmie Featured Artists"
                className="w-full max-w-[430px] h-auto object-contain pointer-events-none"
              />
            </div>

            {/* Bottom Headline, Tagline & Black Get Started Button */}
            <div className="pt-2 pb-2">
              <h1 className="text-[28px] leading-[1.18] tracking-tight text-[#0B0B0A]">
                <span className="font-extrabold">Elevate</span>{' '}
                <span className="font-normal">Every</span>
                <br />
                <span className="font-normal">Moment With</span>{' '}
                <span className="font-extrabold">Music</span>
              </h1>

              <p className="text-[13px] text-[#22211E] mt-3.5 font-normal">
                Every Bet Tells Your Story
              </p>

              <div className="mt-7 px-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full py-3.5 bg-[#080808] hover:bg-[#1a1a1a] active:scale-[0.99] text-white text-[13px] font-medium tracking-wide transition-all cursor-pointer shadow-sm"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 2: AUTHENTICATION (SIGN UP / SIGN IN / FORGOT PASSWORD)
           ========================================================= */}
        {step === 2 && (
          <div className="flex-1 flex flex-col min-h-[calc(100vh-52px)]">
            {/* Top Bar: Left Back Chevron, Centered F Logo */}
            <div className="relative flex items-center justify-center pt-1 pb-6">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="absolute left-0 p-1 -ml-1 text-[#111111] hover:opacity-70 transition-opacity cursor-pointer"
                aria-label="Back to Welcome"
              >
                <ChevronLeft className="w-6 h-6 stroke-[1.75]" />
              </button>
              <FlontmieGeometricMark className="w-6 h-7" />
            </div>

            {/* Main Auth Card Container */}
            <div className="my-auto py-4">
              <div className="rounded-[34px] bg-[#B6B2A6] shadow-[0_14px_38px_rgba(0,0,0,0.09)] px-5 py-7 border border-black/[0.04]">
                {authMode === 'signup' && (
                  <>
                    <h2 className="text-[16px] font-bold text-[#0E0E0D] mb-4 px-0.5">
                      Sign Up
                    </h2>

                    {authError && (
                      <div className="mb-3.5 px-3 py-2 bg-red-900/15 border border-red-800/40 text-red-950 text-xs rounded">
                        {authError}
                      </div>
                    )}

                    <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        autoComplete="email"
                        className="w-full px-3.5 py-3 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Name"
                        autoComplete="name"
                        className="w-full px-3.5 py-3 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      <div className="relative">
                        <select
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          aria-label="Country"
                          className="w-full px-3.5 py-3 bg-transparent border border-[#625F57] text-[13px] text-[#111] appearance-none focus:outline-none focus:border-black cursor-pointer"
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
                        className="w-full px-3.5 py-3 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      <input
                        type="password"
                        required
                        value={repeatPassword}
                        onChange={(e) => setRepeatPassword(e.target.value)}
                        placeholder="Repeat Password"
                        autoComplete="new-password"
                        className="w-full px-3.5 py-3 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      <div className="pt-1">
                        <button
                          type="submit"
                          disabled={authLoading}
                          className="px-7 py-3 bg-[#080808] hover:bg-[#1d1d1d] disabled:opacity-60 text-white text-[13px] font-medium transition-all cursor-pointer inline-flex items-center gap-2"
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
                    <h2 className="text-[16px] font-bold text-[#0E0E0D] mb-4 px-0.5">
                      Sign In
                    </h2>

                    {authError && (
                      <div className="mb-3.5 px-3 py-2 bg-red-900/15 border border-red-800/40 text-red-950 text-xs rounded">
                        {authError}
                      </div>
                    )}

                    {authSuccess && (
                      <div className="mb-3.5 px-3 py-2 bg-emerald-900/15 border border-emerald-800/40 text-emerald-950 text-xs rounded">
                        {authSuccess}
                      </div>
                    )}

                    <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        autoComplete="email"
                        className="w-full px-3.5 py-3 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        autoComplete="current-password"
                        className="w-full px-3.5 py-3 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      <div className="pt-1 flex items-end justify-between gap-3">
                        <button
                          type="submit"
                          disabled={authLoading}
                          className="px-8 py-3 bg-[#080808] hover:bg-[#1d1d1d] disabled:opacity-60 text-white text-[13px] font-medium transition-all cursor-pointer inline-flex items-center gap-2"
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
                    <h2 className="text-[16px] font-bold text-[#0E0E0D] mb-2 px-0.5">
                      Forgot Password
                    </h2>
                    <p className="text-xs text-[#33312C] mb-4">
                      Enter your account email to request a password reset code.
                    </p>

                    {authError && (
                      <div className="mb-3 px-3 py-2 bg-red-900/15 border border-red-800/40 text-red-950 text-xs rounded">
                        {authError}
                      </div>
                    )}

                    {authSuccess && (
                      <div className="mb-3 px-3 py-2 bg-emerald-900/15 border border-emerald-800/40 text-emerald-950 text-xs rounded">
                        {authSuccess}
                      </div>
                    )}

                    <div className="space-y-3.5">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        className="w-full px-3.5 py-3 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
                      />

                      {resetCodeSent && (
                        <>
                          <input
                            type="text"
                            value={resetCode}
                            onChange={(e) => setResetCode(e.target.value)}
                            placeholder="Reset Code"
                            className="w-full px-3.5 py-3 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black uppercase"
                          />
                          <input
                            type="password"
                            value={newResetPassword}
                            onChange={(e) => setNewResetPassword(e.target.value)}
                            placeholder="New Password"
                            className="w-full px-3.5 py-3 bg-transparent border border-[#625F57] text-[13px] text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
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
                            className="px-6 py-3 bg-[#080808] text-white text-[13px] font-medium cursor-pointer"
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
                            className="px-6 py-3 bg-[#080808] text-white text-[13px] font-medium cursor-pointer"
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

              {/* Links Beneath Auth Card */}
              {authMode === 'signup' && (
                <div className="mt-7 text-center">
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
                <div className="mt-6 text-center flex flex-col items-center">
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

                  <p className="text-[12px] text-[#22211E] mt-28">
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
          </div>
        )}

        {/* =========================================================
            SCREEN 3: CHOOSE YOUR INTEREST
           ========================================================= */}
        {step === 3 && (
          <div className="flex-1 flex flex-col min-h-[calc(100vh-52px)]">
            {/* Top Bar: Left Back Chevron, Center F Logo, Right Skip */}
            <div className="relative flex items-center justify-between pt-1 pb-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="p-1 -ml-1 text-[#111111] hover:opacity-70 transition-opacity cursor-pointer"
                aria-label="Back to Authentication"
              >
                <ChevronLeft className="w-6 h-6 stroke-[1.75]" />
              </button>
              <FlontmieGeometricMark className="w-6 h-7" />
              <button
                type="button"
                onClick={() => setStep(4)}
                className="text-[13px] font-semibold text-[#111111] hover:opacity-75 transition-opacity cursor-pointer"
              >
                Skip
              </button>
            </div>

            {/* Heading */}
            <div className="mt-3 mb-4">
              <h1 className="text-[28px] leading-[1.16] tracking-tight text-[#0B0B0A]">
                <span className="font-normal">Choose </span>
                <span className="font-extrabold">your Music</span>
                <br />
                <span className="font-extrabold">Interest</span>
              </h1>
            </div>

            {/* Staggered Decorative Genre Badges Grid Matching Reference Screenshot */}
            <div className="flex-1 flex flex-col justify-center gap-1 py-1">
              {/* Row 1: R&B (left sm), Afrobeats (center lg), Rock (right sm) */}
              <div className="grid grid-cols-3 items-start gap-1">
                {orderedGenres.slice(0, 3).map((g, idx) => {
                  const isSelected = selectedGenres.includes(g.name);
                  const sizeClass =
                    idx === 1
                      ? 'w-[138px] h-[138px] mt-3'
                      : 'w-[92px] h-[92px]';
                  return (
                    <div key={g.id} className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleToggleGenre(g.name)}
                        aria-pressed={isSelected}
                        className={`relative ${sizeClass} flex items-center justify-center transition-transform active:scale-95 cursor-pointer group`}
                      >
                        <div
                          className={`w-full h-full relative flex items-center justify-center transition-all ${
                            isSelected ? 'scale-105 brightness-95' : 'hover:scale-[1.03]'
                          }`}
                          style={{ clipPath: SCALLOP_CLIP_POLYGON }}
                        >
                          <SkyHillsIllustration />
                          <span className="relative z-10 px-2 text-center font-extrabold text-[#0B0B0A] text-[12px] leading-tight">
                            {g.name}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 z-20 w-5 h-5 rounded-full bg-[#080808] text-white flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Row 2: Afropop (left md), Pop (right md) */}
              <div className="flex items-center justify-between px-1 -mt-5">
                {orderedGenres.slice(3, 5).map((g) => {
                  const isSelected = selectedGenres.includes(g.name);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleToggleGenre(g.name)}
                      aria-pressed={isSelected}
                      className="relative w-[114px] h-[114px] flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                    >
                      <div
                        className={`w-full h-full relative flex items-center justify-center transition-all ${
                          isSelected ? 'scale-105 brightness-95' : 'hover:scale-[1.03]'
                        }`}
                        style={{ clipPath: SCALLOP_CLIP_POLYGON }}
                      >
                        <SkyHillsIllustration />
                        <span className="relative z-10 px-2 text-center font-extrabold text-[#0B0B0A] text-[12px] leading-tight">
                          {g.name}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="absolute top-1.5 right-1.5 z-20 w-5 h-5 rounded-full bg-[#080808] text-white flex items-center justify-center shadow-md">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Row 3: Country (left sm), Jazz (center lg), Gospel (right sm) */}
              <div className="grid grid-cols-3 items-center gap-1 -mt-4">
                {orderedGenres.slice(5, 8).map((g, idx) => {
                  const isSelected = selectedGenres.includes(g.name);
                  const sizeClass =
                    idx === 1
                      ? 'w-[140px] h-[140px]'
                      : 'w-[86px] h-[86px] mt-4';
                  return (
                    <div key={g.id} className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleToggleGenre(g.name)}
                        aria-pressed={isSelected}
                        className={`relative ${sizeClass} flex items-center justify-center transition-transform active:scale-95 cursor-pointer`}
                      >
                        <div
                          className={`w-full h-full relative flex items-center justify-center transition-all ${
                            isSelected ? 'scale-105 brightness-95' : 'hover:scale-[1.03]'
                          }`}
                          style={{ clipPath: SCALLOP_CLIP_POLYGON }}
                        >
                          <SkyHillsIllustration />
                          <span className="relative z-10 px-2 text-center font-extrabold text-[#0B0B0A] text-[12px] leading-tight">
                            {g.name}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 z-20 w-5 h-5 rounded-full bg-[#080808] text-white flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Row 4: Reggae (left md-lg), Electronic (center md), + additional genres */}
              <div className="grid grid-cols-3 items-end gap-1 -mt-2">
                {orderedGenres.slice(8, 11).map((g, idx) => {
                  const isSelected = selectedGenres.includes(g.name);
                  const sizeClass =
                    idx === 1
                      ? 'w-[110px] h-[110px] translate-y-2'
                      : 'w-[118px] h-[118px]';
                  return (
                    <div key={g.id} className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleToggleGenre(g.name)}
                        aria-pressed={isSelected}
                        className={`relative ${sizeClass} flex items-center justify-center transition-transform active:scale-95 cursor-pointer`}
                      >
                        <div
                          className={`w-full h-full relative flex items-center justify-center transition-all ${
                            isSelected ? 'scale-105 brightness-95' : 'hover:scale-[1.03]'
                          }`}
                          style={{ clipPath: SCALLOP_CLIP_POLYGON }}
                        >
                          <SkyHillsIllustration />
                          <span className="relative z-10 px-2 text-center font-extrabold text-[#0B0B0A] text-[12px] leading-tight">
                            {g.name}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 z-20 w-5 h-5 rounded-full bg-[#080808] text-white flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Continue CTA */}
            <div className="pt-5">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="w-full py-3.5 bg-[#080808] hover:bg-[#1d1d1d] text-white text-[13px] font-medium tracking-wide transition-all cursor-pointer"
              >
                {selectedGenres.length > 0
                  ? `Continue (${selectedGenres.length} selected)`
                  : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 4: CHOOSE YOUR FAVS
           ========================================================= */}
        {step === 4 && (
          <div className="flex-1 flex flex-col min-h-[calc(100vh-52px)]">
            {/* Top Bar: Left Back Chevron, Center F Logo, Right Skip */}
            <div className="relative flex items-center justify-between pt-1 pb-4">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="p-1 -ml-1 text-[#111111] hover:opacity-70 transition-opacity cursor-pointer"
                aria-label="Back to Music Interest"
              >
                <ChevronLeft className="w-6 h-6 stroke-[1.75]" />
              </button>
              <FlontmieGeometricMark className="w-6 h-7" />
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

            {/* Heading */}
            <div className="mt-2 mb-3">
              <h1 className="text-[28px] leading-[1.16] tracking-tight text-[#0B0B0A]">
                <span className="font-normal">Choose </span>
                <span className="font-extrabold">your Favs</span>
              </h1>
            </div>

            {/* Optional Search Input */}
            {showArtistSearch && (
              <div className="mb-3 relative">
                <input
                  type="text"
                  value={artistSearchQuery}
                  onChange={(e) => setArtistSearchQuery(e.target.value)}
                  placeholder="Search artists..."
                  className="w-full px-3.5 py-2 bg-transparent border border-[#625F57] text-xs text-[#111] placeholder-[#36342F] focus:outline-none focus:border-black"
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

            {/* Staggered Scalloped Artist-Card Grid Loading Real Artists & Display Pictures */}
            <div className="flex-1 flex flex-col justify-center gap-2 py-1">
              {/* Row 1: Top 2 Medium-Large Artist Badges */}
              <div className="grid grid-cols-2 gap-4 px-2">
                {displayArtists.slice(0, 2).map((artist) => {
                  const isSelected = selectedArtistIds.includes(artist.id);
                  return (
                    <div key={artist.id} className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => handleToggleArtist(artist.id)}
                        aria-pressed={isSelected}
                        className="relative w-[124px] h-[124px] flex items-center justify-center transition-transform active:scale-95 cursor-pointer group"
                      >
                        <div
                          className={`w-full h-full relative overflow-hidden flex items-center justify-center ${
                            isSelected ? 'scale-105' : 'group-hover:scale-[1.03]'
                          } transition-all`}
                          style={{ clipPath: SCALLOP_CLIP_POLYGON }}
                        >
                          <SkyHillsIllustration />
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
                          <span className="absolute top-1.5 right-1.5 z-20 w-5 h-5 rounded-full bg-[#080808] text-white flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </button>
                      <span className="mt-1 text-[11px] font-bold text-[#0B0B0A] text-center leading-tight truncate max-w-[120px]">
                        {artist.name}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Row 2: 3 Staggered Artist Badges (Left md, Center lg elevated, Right md) */}
              {displayArtists.length > 2 && (
                <div className="grid grid-cols-3 items-end gap-1 -mt-2">
                  {displayArtists.slice(2, 5).map((artist, idx) => {
                    const isSelected = selectedArtistIds.includes(artist.id);
                    const sizeClass =
                      idx === 1
                        ? 'w-[126px] h-[126px] -mt-4'
                        : 'w-[96px] h-[96px]';
                    return (
                      <div key={artist.id} className="flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => handleToggleArtist(artist.id)}
                          aria-pressed={isSelected}
                          className={`relative ${sizeClass} flex items-center justify-center transition-transform active:scale-95 cursor-pointer group`}
                        >
                          <div
                            className={`w-full h-full relative overflow-hidden flex items-center justify-center ${
                              isSelected ? 'scale-105' : 'group-hover:scale-[1.03]'
                            } transition-all`}
                            style={{ clipPath: SCALLOP_CLIP_POLYGON }}
                          >
                            <SkyHillsIllustration />
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
                        <span className="mt-1 text-[11px] font-bold text-[#0B0B0A] text-center leading-tight truncate max-w-[110px]">
                          {artist.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Row 3: 3 Staggered Artist Badges (Left sm, Center lg, Right sm) */}
              {displayArtists.length > 5 && (
                <div className="grid grid-cols-3 items-center gap-1">
                  {displayArtists.slice(5, 8).map((artist, idx) => {
                    const isSelected = selectedArtistIds.includes(artist.id);
                    const sizeClass =
                      idx === 1
                        ? 'w-[128px] h-[128px]'
                        : 'w-[84px] h-[84px]';
                    return (
                      <div key={artist.id} className="flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => handleToggleArtist(artist.id)}
                          aria-pressed={isSelected}
                          className={`relative ${sizeClass} flex items-center justify-center transition-transform active:scale-95 cursor-pointer group`}
                        >
                          <div
                            className={`w-full h-full relative overflow-hidden flex items-center justify-center ${
                              isSelected ? 'scale-105' : 'group-hover:scale-[1.03]'
                            } transition-all`}
                            style={{ clipPath: SCALLOP_CLIP_POLYGON }}
                          >
                            <SkyHillsIllustration />
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
                        <span className="mt-1 text-[11px] font-bold text-[#0B0B0A] text-center leading-tight truncate max-w-[110px]">
                          {artist.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Row 4: Bottom 3 Artist Badges */}
              {displayArtists.length > 8 && (
                <div className="grid grid-cols-3 items-end gap-1">
                  {displayArtists.slice(8, 11).map((artist, idx) => {
                    const isSelected = selectedArtistIds.includes(artist.id);
                    const sizeClass =
                      idx === 1
                        ? 'w-[98px] h-[98px]'
                        : 'w-[108px] h-[108px]';
                    return (
                      <div key={artist.id} className="flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => handleToggleArtist(artist.id)}
                          aria-pressed={isSelected}
                          className={`relative ${sizeClass} flex items-center justify-center transition-transform active:scale-95 cursor-pointer group`}
                        >
                          <div
                            className={`w-full h-full relative overflow-hidden flex items-center justify-center ${
                              isSelected ? 'scale-105' : 'group-hover:scale-[1.03]'
                            } transition-all`}
                            style={{ clipPath: SCALLOP_CLIP_POLYGON }}
                          >
                            <SkyHillsIllustration />
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
                        <span className="mt-1 text-[11px] font-bold text-[#0B0B0A] text-center leading-tight truncate max-w-[110px]">
                          {artist.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Continue CTA */}
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setStep(5)}
                className="w-full py-3.5 bg-[#080808] hover:bg-[#1d1d1d] text-white text-[13px] font-medium tracking-wide transition-all cursor-pointer"
              >
                {selectedArtistIds.length > 0
                  ? `Continue (${selectedArtistIds.length} selected)`
                  : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 5: ACCEPT TERMS & CONDITIONS (OPT IN)
           ========================================================= */}
        {step === 5 && (
          <div className="flex-1 flex flex-col justify-between min-h-[calc(100vh-52px)]">
            {/* Subtle Back Button */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="p-1 -ml-1 text-[#111111] hover:opacity-70 transition-opacity cursor-pointer"
                aria-label="Back to Choose your Favs"
              >
                <ChevronLeft className="w-6 h-6 stroke-[1.75]" />
              </button>
              <span className="text-[11px] font-medium text-[#2A2925]">
                Version {legalData?.terms_version || '2026.10'}
              </span>
            </div>

            {/* Faded Overlapping Artist Cutout Collage from Screenshot */}
            <div className="-mx-6 my-auto flex items-center justify-center">
              <img
                src="/assets/aistudio/onboarding_optin_collage.jpg"
                alt="Flontmie Collage"
                className="w-full max-w-[430px] h-auto object-contain pointer-events-none"
              />
            </div>

            {/* Bottom Section: 3D FLONTMIE Wordmark, Headline, Legal Summary, Opt In Button & Footer */}
            <div className="pt-1 pb-1">
              {/* 3D Outlined FLONTMIE Wordmark */}
              <div className="mb-2 -ml-1">
                <img
                  src="/assets/aistudio/onboarding_flontmie_3d.jpg"
                  alt="FLONTMIE"
                  className="h-10 sm:h-11 w-auto object-contain pointer-events-none"
                />
              </div>

              <h1 className="text-[28px] leading-[1.18] tracking-tight text-[#0B0B0A]">
                <span className="font-extrabold">Elevate</span>{' '}
                <span className="font-normal">Every</span>
                <br />
                <span className="font-normal">Moment With</span>{' '}
                <span className="font-extrabold">Music</span>
              </h1>

              <p className="text-[13px] text-[#22211E] mt-3 font-normal">
                Every Bet Tells Your Story
              </p>

              {/* Compact Interactive Legal Preview & Explicit Acceptance Control */}
              <div className="mt-4 p-3 rounded-xl bg-black/[0.05] border border-black/10 text-[11px] text-[#1D1C19] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#080808]" />
                    <span>{legalData?.platform_name || 'Flontmie Music Platform'}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveLegalModal('terms')}
                      className="font-bold underline hover:opacity-75 cursor-pointer"
                    >
                      Read Terms
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setActiveLegalModal('privacy')}
                      className="font-bold underline hover:opacity-75 cursor-pointer"
                    >
                      Read Privacy
                    </button>
                  </div>
                </div>

                <label className="flex items-start gap-2 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={termsAcceptedChecked}
                    onChange={(e) => setTermsAcceptedChecked(e.target.checked)}
                    className="mt-0.5 w-3.5 h-3.5 accent-black cursor-pointer shrink-0"
                  />
                  <span className="leading-snug text-[#22211E]">
                    I accept the Flontmie Terms and Conditions (v{legalData?.terms_version || '2026.10'}) and Privacy Policy (v{legalData?.privacy_version || '2026.10'}).
                  </span>
                </label>
              </div>

              {finalError && (
                <p className="text-xs text-red-900 font-semibold mt-2 text-center">
                  {finalError}
                </p>
              )}

              {/* Black Opt In Button */}
              <div className="mt-4 px-3">
                <button
                  type="button"
                  disabled={savingFinal}
                  onClick={handleOptInComplete}
                  className="w-full py-3.5 bg-[#080808] hover:bg-[#1a1a1a] disabled:opacity-60 active:scale-[0.99] text-white text-[13px] font-medium tracking-wide transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  {savingFinal && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Opt In</span>
                </button>
              </div>

              {/* Exact Screenshot Footer Line */}
              <p className="text-[10.5px] text-[#22211E] text-center mt-2.5 leading-normal">
                By continuing, you agree to our{' '}
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('terms')}
                  className="font-bold text-[#080808] hover:underline cursor-pointer"
                >
                  Terms and Conditions
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('privacy')}
                  className="font-bold text-[#080808] hover:underline cursor-pointer"
                >
                  Privacy Policy
                </button>
                .
              </p>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          ACTUAL TERMS & CONDITIONS AND PRIVACY POLICY VIEWER MODAL
         ========================================================= */}
      {activeLegalModal && (
        <div className="fixed inset-0 z-[170] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#EAE6DC] text-[#121210] rounded-2xl border border-black/15 shadow-2xl overflow-hidden flex flex-col max-h-[86vh]">
            <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between bg-[#DFDBD0]">
              <div className="flex items-center gap-2">
                {activeLegalModal === 'terms' ? (
                  <FileText className="w-4 h-4 text-[#080808]" />
                ) : (
                  <Lock className="w-4 h-4 text-[#080808]" />
                )}
                <div>
                  <h3 className="text-sm font-extrabold text-[#080808]">
                    {activeLegalModal === 'terms'
                      ? 'Flontmie Terms and Conditions'
                      : 'Flontmie Privacy Policy'}
                  </h3>
                  <p className="text-[11px] text-[#45433E]">
                    Version{' '}
                    {activeLegalModal === 'terms'
                      ? legalData?.terms_version || '2026.10'
                      : legalData?.privacy_version || '2026.10'}{' '}
                    · Effective {legalData?.effective_date || '2026-10-28'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveLegalModal(null)}
                className="p-1.5 rounded-full hover:bg-black/10 text-[#111] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Switcher inside Modal */}
            <div className="px-5 pt-3 flex gap-2 border-b border-black/10 bg-[#E5E1D6]">
              <button
                type="button"
                onClick={() => setActiveLegalModal('terms')}
                className={`pb-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeLegalModal === 'terms'
                    ? 'border-[#080808] text-[#080808]'
                    : 'border-transparent text-[#5A574F]'
                }`}
              >
                Terms &amp; Conditions
              </button>
              <button
                type="button"
                onClick={() => setActiveLegalModal('privacy')}
                className={`pb-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeLegalModal === 'privacy'
                    ? 'border-[#080808] text-[#080808]'
                    : 'border-transparent text-[#5A574F]'
                }`}
              >
                Privacy Policy
              </button>
            </div>

            {/* Document Sections Loaded from MySQL Backend */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed text-[#1E1D1A]">
              {(activeLegalModal === 'terms'
                ? legalData?.terms_sections
                : legalData?.privacy_sections
              )?.map((sec, idx) => (
                <div key={idx} className="space-y-1">
                  <h4 className="font-bold text-[#080808] text-[13px]">{sec.heading}</h4>
                  <p className="text-[#2B2925]">{sec.body}</p>
                </div>
              ))}
            </div>

            <div className="px-5 py-3.5 border-t border-black/10 bg-[#DFDBD0] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setTermsAcceptedChecked(true);
                  setActiveLegalModal(null);
                }}
                className="px-5 py-2.5 bg-[#080808] text-white text-xs font-semibold cursor-pointer"
              >
                Accept &amp; Close
              </button>
              <button
                type="button"
                onClick={() => setActiveLegalModal(null)}
                className="px-4 py-2 text-xs font-semibold text-[#333] hover:text-black cursor-pointer"
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
