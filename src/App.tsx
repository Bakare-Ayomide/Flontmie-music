import React, { useState, useEffect, useCallback } from 'react';
import { 
  Persona, 
  MoodCategory, 
  Track, 
  Playlist, 
  ArtistProfile, 
  LabelArtist, 
  ReleaseScheduleItem, 
  DistributorIngestionItem,
  DistributorAccessGrant,
  AdminRolePermission,
  FeaturedAccount,
  JamParticipant,
  PlayerTabMode
} from './types/music';
import { 
  INITIAL_TRACKS,
  INITIAL_PLAYLISTS, 
  ARTIST_PROFILES, 
  LABEL_ARTISTS, 
  UPCOMING_RELEASES, 
  FEATURED_ACCOUNTS,
  DISTRIBUTOR_INGESTIONS,
  DISTRIBUTOR_ACCESS_GRANTS,
  ADMIN_ROLE_PERMISSIONS,
  IMAGES 
} from './data/mockCatalog';
import { audioEngine } from './services/audioEngine';
import { api } from './services/api';
import { resolveArtworkUrl, handleImageError } from './utils/artwork';
import { formatCompactNumber } from './utils/formatters';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileDock } from './components/layout/MobileDock';
import { BottomPlayer } from './components/player/BottomPlayer';
import { QueueDrawer } from './components/player/QueueDrawer';
import { HomeFeed } from './components/listener/HomeFeed';
import { PlaylistView } from './components/listener/PlaylistView';
import { ShareModal } from './components/social/ShareModal';
import { JamSessionModal } from './components/social/JamSessionModal';
import { CreatePlaylistModal } from './components/listener/CreatePlaylistModal';
import { AddToPlaylistModal } from './components/listener/AddToPlaylistModal';
import { SelectTracksModal } from './components/listener/SelectTracksModal';
import { ArtistDashboard } from './components/artist/ArtistDashboard';
import { LabelDashboard } from './components/label/LabelDashboard';
import { DistributorDashboard } from './components/distributor/DistributorDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { FullPlaybackScreen } from './components/player/FullPlaybackScreen';
import { PublicArtistPage } from './components/artist/PublicArtistPage';
import { AuthModal, AuthUser } from './components/auth/AuthModal';
import { FlontmieOnboarding, OnboardingStep } from './components/auth/FlontmieOnboarding';
import { ProfilePage } from './components/profile/ProfilePage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { YouTubeMusicDiscovery } from './components/discovery/YouTubeMusicDiscovery';
import { nativePlatform } from './services/nativePlatform';
import { Heart, Compass, Sparkles, Flame, Disc3, ArrowLeft, Music, Layers, Play, Check, WifiOff, Download } from 'lucide-react';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  // Navigation & Persona State
  const [currentPersona, setCurrentPersona] = useState<Persona>('listener');
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const p = window.location.pathname.toLowerCase();
    const h = window.location.hash.toLowerCase();
    return p === '/admin' || p.startsWith('/admin/') || h === '#admin';
  });
  const [selectedMood, setSelectedMood] = useState<MoodCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState<boolean>(false);

  // Authentication & User Session State (Hydrated from server-side session / token)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const p = window.location.pathname.toLowerCase();
    const h = window.location.hash.toLowerCase();
    if (p === '/admin' || p.startsWith('/admin/') || h === '#admin') return false;
    if (p === '/onboarding' || h === '#onboarding') return true;
    const done = localStorage.getItem('flontmie_onboarding_completed_v1');
    return done !== 'true' && !localStorage.getItem('flontmie_jwt');
  });
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<OnboardingStep | undefined>(undefined);
  const [activeLegalView, setActiveLegalView] = useState<'terms' | 'privacy' | null>(() => {
    if (typeof window === 'undefined') return null;
    const p = window.location.pathname.toLowerCase();
    const h = window.location.hash.toLowerCase();
    if (p === '/terms' || h === '#terms') return 'terms';
    if (p === '/privacy' || h === '#privacy') return 'privacy';
    return null;
  });

  // Desktop sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(nativePlatform.isOnline());

  // Music Catalog & Hub State - Loaded strictly from Flontmie PHP/MySQL Backend
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [artistProfiles, setArtistProfiles] = useState<Record<string, ArtistProfile>>({});
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>([]);
  const [dislikedTrackIds, setDislikedTrackIds] = useState<string[]>([]);
  const [followedArtistIds, setFollowedArtistIds] = useState<string[]>([]);
  const [labelArtists, setLabelArtists] = useState<LabelArtist[]>(LABEL_ARTISTS);
  const [upcomingReleases, setUpcomingReleases] = useState<ReleaseScheduleItem[]>(UPCOMING_RELEASES);
  const [featuredAccounts, setFeaturedAccounts] = useState<FeaturedAccount[]>(FEATURED_ACCOUNTS);
  const [distributorIngestions, setDistributorIngestions] = useState<DistributorIngestionItem[]>(DISTRIBUTOR_INGESTIONS);
  const [distributorAccessGrants, setDistributorAccessGrants] = useState<DistributorAccessGrant[]>(DISTRIBUTOR_ACCESS_GRANTS);
  const [adminPermissions, setAdminPermissions] = useState<AdminRolePermission[]>(ADMIN_ROLE_PERMISSIONS);

  // Playback State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(180);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [playerTabMode, setPlayerTabMode] = useState<PlayerTabMode>('audio');
  const [queue, setQueue] = useState<Track[]>([]);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState<boolean>(false);

  // Drawer & Modal States
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isJamModalOpen, setIsJamModalOpen] = useState<boolean>(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState<boolean>(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState<boolean>(false);
  const [isSelectTracksOpen, setIsSelectTracksOpen] = useState<boolean>(false);
  const [actionBanner, setActionBanner] = useState<{ type: 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (!actionBanner) return;
    const timer = setTimeout(() => setActionBanner(null), 4500);
    return () => clearTimeout(timer);
  }, [actionBanner]);

  // Jam Session Social State
  const [isJamActive, setIsJamActive] = useState<boolean>(false);
  const [jamParticipants, setJamParticipants] = useState<JamParticipant[]>([
    { id: 'u1', name: 'You (Host)', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80', isHost: true },
    { id: 'u2', name: 'Amara Osei', avatar: IMAGES.afrobeats, isHost: false },
    { id: 'u3', name: 'Damian Cross', avatar: IMAGES.series, isHost: false },
  ]);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);

  // Client-side URL synchronization & Routing
  const navigateTab = useCallback((tab: string) => {
    setSelectedPlaylistId(null);
    setSelectedArtistId(null);
    if (tab === 'admin') {
      setIsAdminRoute(true);
      try {
        window.history.pushState(null, '', '/admin');
      } catch {}
      return;
    }
    setIsAdminRoute(false);
    setCurrentTab(tab);
    try {
      if (tab === 'home') {
        window.history.pushState(null, '', '/');
      } else {
        window.history.pushState(null, '', `/${tab}`);
      }
    } catch {}
  }, []);

  const navigatePlaylist = useCallback((id: string) => {
    setIsAdminRoute(false);
    setSelectedPlaylistId(id);
    setSelectedArtistId(null);
    setCurrentPersona('listener');
    try {
      window.history.pushState(null, '', `/playlist/${id}`);
    } catch {}
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      try {
        const path = window.location.pathname.toLowerCase();
        const hash = window.location.hash.toLowerCase();
        const search = new URLSearchParams(window.location.search);
        const plParam = search.get('playlist');

        if (path === '/admin' || path.startsWith('/admin/') || hash === '#admin') {
          setIsAdminRoute(true);
          setSelectedPlaylistId(null);
          setSelectedArtistId(null);
          return;
        }

        setIsAdminRoute(false);

        if (plParam) {
          setSelectedPlaylistId(plParam);
          setSelectedArtistId(null);
          setCurrentPersona('listener');
          return;
        }

        if (path === '/playlist' || path === '/playlists' || hash === '#playlist' || hash === '#playlists') {
          setCurrentTab('library');
          setSelectedPlaylistId(null);
          setSelectedArtistId(null);
          setCurrentPersona('listener');
          return;
        }

        if (path.startsWith('/playlist/') || hash.startsWith('#playlist/')) {
          const seg = path.startsWith('/playlist/')
            ? path.replace('/playlist/', '').split('/')[0].trim()
            : hash.replace('#playlist/', '').split('/')[0].trim();
          if (seg) {
            setSelectedPlaylistId(seg);
            setSelectedArtistId(null);
            setCurrentPersona('listener');
            return;
          } else {
            setCurrentTab('library');
            setSelectedPlaylistId(null);
            setSelectedArtistId(null);
            setCurrentPersona('listener');
            return;
          }
        }

        if (path === '/explore' || hash === '#explore') {
          setCurrentTab('explore');
          setSelectedPlaylistId(null);
          setSelectedArtistId(null);
          setCurrentPersona('listener');
        } else if (path === '/library' || hash === '#library') {
          setCurrentTab('library');
          setSelectedPlaylistId(null);
          setSelectedArtistId(null);
          setCurrentPersona('listener');
        } else if (path === '/liked' || hash === '#liked') {
          setCurrentTab('liked');
          setSelectedPlaylistId(null);
          setSelectedArtistId(null);
          setCurrentPersona('listener');
        } else if (path === '/profile' || hash === '#profile') {
          setCurrentTab('profile');
          setSelectedPlaylistId(null);
          setSelectedArtistId(null);
          setCurrentPersona('listener');
          setActiveLegalView(null);
        } else if (path === '/terms' || hash === '#terms') {
          setActiveLegalView('terms');
        } else if (path === '/privacy' || hash === '#privacy') {
          setActiveLegalView('privacy');
        } else if (path === '/onboarding' || hash === '#onboarding') {
          setIsOnboardingOpen(true);
          setActiveLegalView(null);
        } else {
          setCurrentTab('home');
          setSelectedPlaylistId(null);
          setSelectedArtistId(null);
          setActiveLegalView(null);
        }
      } catch (err) {
        console.warn('URL parse error:', err);
      }
    };

    handlePopState();
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // Fetch playlist on demand if direct URL or ID isn't in cache yet
  useEffect(() => {
    if (selectedPlaylistId && !playlists.some((p) => p.id === selectedPlaylistId)) {
      setIsLoadingPlaylist(true);
      api.getPlaylistById(selectedPlaylistId)
        .then((res) => {
          if (res && res.playlist) {
            setPlaylists((prev) => {
              if (prev.some((p) => p.id === res.playlist.id)) return prev;
              return [res.playlist, ...prev];
            });
            if (res.tracks && res.tracks.length > 0) {
              setTracks((prev) => {
                const existing = new Set(prev.map((t) => t.id));
                const newTracks = res.tracks.filter((t) => !existing.has(t.id));
                return [...newTracks, ...prev];
              });
            }
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingPlaylist(false));
    }
  }, [selectedPlaylistId, playlists]);

  const refreshCatalogFromDatabase = useCallback(() => {
    api.getTracks().then((backendTracks) => {
      if (backendTracks && backendTracks.length > 0) {
        setTracks(backendTracks);
        setLikedTrackIds((prev) => {
          const fromTracks = backendTracks.filter((t) => t.isLiked).map((t) => t.id);
          return fromTracks.length > 0 ? Array.from(new Set([...prev, ...fromTracks])) : prev;
        });
        const preferred =
          backendTracks.find((t) => t.hasLocalAudio && t.hasLocalVideo) ||
          backendTracks.find((t) => t.hasLocalAudio) ||
          backendTracks[0];

        setCurrentTrack((curr) => {
          if (curr) {
            const matched = backendTracks.find(
              (t) => t.id === curr.id || (curr.videoId && t.videoId === curr.videoId)
            );
            if (matched) return matched;
          }
          return preferred;
        });
        setDuration(preferred?.duration || 180);
        setQueue(backendTracks.filter((t) => t.id !== preferred?.id));

        // Preload media URLs into unified playback controller without auto-playing
        if (preferred) {
          audioEngine.loadTrackMedia({
            trackId: preferred.id,
            audioUrl: preferred.audioUrl || null,
            videoUrl: preferred.videoUrl || null,
            mode: audioEngine.getMode(),
            autoPlay: false,
            startTime: 0,
          });
        }
      }
    }).catch(() => {});

    api.getAlbums().then((backendAlbums) => {
      if (Array.isArray(backendAlbums)) {
        setAlbums(backendAlbums);
      }
    }).catch(() => {});

    api.getArtists().then((backendArtists) => {
      if (backendArtists) {
        if (Array.isArray(backendArtists)) {
          const artistMap: Record<string, ArtistProfile> = {};
          backendArtists.forEach((a: ArtistProfile) => {
            artistMap[a.id] = a;
          });
          setArtistProfiles(artistMap);
        } else if (typeof backendArtists === 'object') {
          setArtistProfiles(backendArtists);
        }
      }
    }).catch(() => {});

    api.getPlaylists().then((backendPlaylists) => {
      if (Array.isArray(backendPlaylists)) {
        setPlaylists(backendPlaylists);
      }
    }).catch(() => {});
  }, []);

  // Load Live Catalog & Hydrate User Session from MySQL Backend
  useEffect(() => {
    refreshCatalogFromDatabase();

    let isMounted = true;
    (async () => {
      try {
        await api.hydrateSavedTokens();
        if (!api.getToken()) {
          if (isMounted) {
            setIsAuthChecking(false);
            const p = window.location.pathname.toLowerCase();
            const h = window.location.hash.toLowerCase();
            const isAdm = p === '/admin' || p.startsWith('/admin/') || h === '#admin';
            const done = localStorage.getItem('flontmie_onboarding_completed_v1') === 'true';
            if (!isAdm && !done) {
              setIsOnboardingOpen(true);
            }
          }
          return;
        }
        const res = await api.getCurrentUser();
        if (isMounted && res && res.user) {
          setCurrentUser(res.user);
          if (Array.isArray(res.user.liked_track_ids)) {
            setLikedTrackIds(res.user.liked_track_ids);
          }
          if (Array.isArray(res.user.followed_artist_ids)) {
            setFollowedArtistIds(res.user.followed_artist_ids);
          }
          if (res.user.role !== 'admin') {
            setCurrentPersona(res.user.role);
          }
          if (res.user.onboarding_completed || res.user.terms_accepted || res.user.role === 'admin') {
            try {
              localStorage.setItem('flontmie_onboarding_completed_v1', 'true');
            } catch {}
            if (
              window.location.pathname.toLowerCase() !== '/onboarding' &&
              window.location.hash.toLowerCase() !== '#onboarding'
            ) {
              setIsOnboardingOpen(false);
            }
          }
        }
      } catch {
        api.setToken(null, null);
        if (isMounted) setCurrentUser(null);
      } finally {
        if (isMounted) setIsAuthChecking(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refreshCatalogFromDatabase]);

  // Initialize Capacitor Native Platform, Network Listeners & Saved Tokens
  useEffect(() => {
    nativePlatform.initialize().catch(() => {});
    const unsubNet = nativePlatform.onNetworkChange((connected) => {
      setIsOnline(connected);
      if (connected) {
        refreshCatalogFromDatabase();
      }
    });
    return () => {
      unsubNet();
    };
  }, [refreshCatalogFromDatabase]);

  // Register Android Hardware Back Button Navigation
  useEffect(() => {
    const unsubBack = nativePlatform.registerBackButtonHandler(() => {
      if (isFullPlayerOpen) {
        setIsFullPlayerOpen(false);
        return true;
      }
      if (isAuthModalOpen) {
        setIsAuthModalOpen(false);
        return true;
      }
      if (isShareModalOpen) {
        setIsShareModalOpen(false);
        return true;
      }
      if (isJamModalOpen) {
        setIsJamModalOpen(false);
        return true;
      }
      if (isQueueOpen) {
        setIsQueueOpen(false);
        return true;
      }
      if (selectedArtistId) {
        setSelectedArtistId(null);
        return true;
      }
      if (selectedPlaylistId) {
        setSelectedPlaylistId(null);
        return true;
      }
      if (isAdminRoute) {
        setIsAdminRoute(false);
        setCurrentTab('home');
        return true;
      }
      if (currentTab !== 'home') {
        setCurrentTab('home');
        return true;
      }
      return false;
    });
    return () => {
      unsubBack();
    };
  }, [
    isFullPlayerOpen,
    isAuthModalOpen,
    isShareModalOpen,
    isJamModalOpen,
    isQueueOpen,
    selectedArtistId,
    selectedPlaylistId,
    isAdminRoute,
    currentTab,
  ]);

  // Configure Audio Engine Listeners & Lock-Screen Transport Controls
  useEffect(() => {
    audioEngine.onTimeUpdate((time, dur) => {
      setCurrentTime(time);
      if (dur > 0) setDuration(dur);
    });

    audioEngine.onEnded(() => {
      handleNextTrack();
    });

    audioEngine.setTransportHandlers(
      () => handlePrevTrack(),
      () => handleNextTrack()
    );
  }, [queue, currentTrack, repeatMode]);

  const handleSelectPlayerTab = useCallback((tab: PlayerTabMode, expandPlayer: boolean = false) => {
    setPlayerTabMode(tab);
    audioEngine.setMode(tab);
    if (expandPlayer) {
      setIsFullPlayerOpen(true);
    }
  }, []);

  const handlePlayTrack = (track: Track, startAt: number = 0) => {
    setCurrentTrack(track);
    setDuration(track.duration);
    setCurrentTime(startAt);
    setIsPlaying(true);
    audioEngine.loadTrackMedia({
      trackId: track.id,
      audioUrl: track.audioUrl || null,
      videoUrl: track.videoUrl || null,
      mode: playerTabMode,
      autoPlay: true,
      startTime: startAt,
    });
    // Report stream play to backend MySQL
    api.registerStream(track.id);
  };

  const handleTogglePlay = () => {
    if (!currentTrack) {
      if (tracks.length > 0) handlePlayTrack(tracks[0]);
      return;
    }

    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      audioEngine.loadTrackMedia({
        trackId: currentTrack.id,
        audioUrl: currentTrack.audioUrl || null,
        videoUrl: currentTrack.videoUrl || null,
        mode: playerTabMode,
        autoPlay: true,
        startTime: currentTime,
      });
      setIsPlaying(true);
    }
  };

  const handleNextTrack = useCallback(() => {
    if (repeatMode === 'one' && currentTrack) {
      audioEngine.loadTrackMedia({
        trackId: currentTrack.id,
        audioUrl: currentTrack.audioUrl || null,
        videoUrl: currentTrack.videoUrl || null,
        mode: playerTabMode,
        autoPlay: true,
        startTime: 0,
      });
      setCurrentTime(0);
      setIsPlaying(true);
      return;
    }

    if (queue.length > 0) {
      const next = queue[0];
      const remainingQueue = queue.slice(1);
      if (repeatMode === 'all' && currentTrack) {
        remainingQueue.push(currentTrack);
      }
      setQueue(remainingQueue);
      handlePlayTrack(next);
    } else if (repeatMode === 'all' && tracks.length > 0) {
      handlePlayTrack(tracks[0]);
      setQueue(tracks.slice(1));
    } else {
      audioEngine.pause();
      setIsPlaying(false);
    }
  }, [queue, currentTrack, repeatMode, tracks, playerTabMode]);

  const handlePrevTrack = () => {
    if (currentTime > 4) {
      audioEngine.seek(0);
      setCurrentTime(0);
      return;
    }
    const currentIdx = tracks.findIndex((t) => t.id === currentTrack?.id);
    if (currentIdx > 0) {
      handlePlayTrack(tracks[currentIdx - 1]);
    } else {
      audioEngine.seek(0);
      setCurrentTime(0);
    }
  };

  const handleSeek = (seconds: number) => {
    audioEngine.seek(seconds);
    setCurrentTime(seconds);
    try {
      window.dispatchEvent(new CustomEvent('flontmie:seek', { detail: seconds }));
    } catch {}
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    setIsMuted(vol === 0);
    audioEngine.setVolume(vol);
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioEngine.setMuted(nextMuted);
  };

  const handleToggleShuffle = () => {
    setIsShuffle(!isShuffle);
    if (!isShuffle && queue.length > 1) {
      const shuffled = [...queue].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
    }
  };

  const handleToggleRepeat = () => {
    const nextRepeat: Record<string, 'off' | 'all' | 'one'> = {
      off: 'all',
      all: 'one',
      one: 'off',
    };
    setRepeatMode(nextRepeat[repeatMode]);
  };

  const handleCommentCountChange = useCallback((trackId: string, newCount: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, commentsCount: newCount } : t))
    );
    setCurrentTrack((curr) =>
      curr && curr.id === trackId ? { ...curr, commentsCount: newCount } : curr
    );
  }, []);

  const handleLikeCountReconcile = useCallback((trackId: string, newCount: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, likes: newCount } : t))
    );
    setCurrentTrack((curr) =>
      curr && curr.id === trackId ? { ...curr, likes: newCount } : curr
    );
  }, []);

  // Poll authoritative like & comment counts from MySQL backend to keep all clients in sync
  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    const runSync = () => {
      api
        .syncEngagement(currentTrack?.id)
        .then((res) => {
          if (cancelled || !res || !res.counts) return;
          const counts = res.counts;

          setTracks((prev) =>
            prev.map((t) => {
              const c = counts[t.id];
              if (!c) return t;
              if (
                t.likes === c.likes_count &&
                (t.commentsCount ?? 0) === c.comments_count &&
                (t.flontmiePlays ?? 0) === c.flontmie_plays
              ) {
                return t;
              }
              return {
                ...t,
                likes: c.likes_count,
                commentsCount: c.comments_count,
                flontmiePlays: c.flontmie_plays,
                streams: c.flontmie_plays,
              };
            })
          );

          setCurrentTrack((curr) => {
            if (!curr) return curr;
            const c = counts[curr.id];
            if (!c) return curr;
            if (
              curr.likes === c.likes_count &&
              (curr.commentsCount ?? 0) === c.comments_count &&
              (curr.flontmiePlays ?? 0) === c.flontmie_plays
            ) {
              return curr;
            }
            return {
              ...curr,
              likes: c.likes_count,
              commentsCount: c.comments_count,
              flontmiePlays: c.flontmie_plays,
              streams: c.flontmie_plays,
            };
          });

          if (Array.isArray(res.liked_track_ids)) {
            setLikedTrackIds(res.liked_track_ids);
          }
        })
        .catch(() => {});
    };

    runSync();
    const interval = setInterval(runSync, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOnline, currentTrack?.id, isFullPlayerOpen, currentUser?.id]);

  const handleToggleLike = (trackId?: string) => {
    const targetId = trackId || currentTrack?.id;
    if (!targetId) return;

    if (!currentUser || !api.getToken()) {
      setActionBanner({
        type: 'error',
        message: 'Please sign in to like tracks and save them to your account.',
      });
      setAuthInitialMode('login');
      setIsAuthModalOpen(true);
      return;
    }

    const wasLiked = likedTrackIds.includes(targetId);
    const nextLiked = !wasLiked;
    const targetTrack = tracks.find((t) => t.id === targetId) || (currentTrack?.id === targetId ? currentTrack : null);
    const prevLikes = Number(targetTrack?.likes ?? 0);
    const optimisticLikes = Math.max(0, prevLikes + (nextLiked ? 1 : -1));

    // Optimistic UI update
    setLikedTrackIds((prev) =>
      nextLiked ? (prev.includes(targetId) ? prev : [...prev, targetId]) : prev.filter((id) => id !== targetId)
    );
    setTracks((prev) =>
      prev.map((t) => (t.id === targetId ? { ...t, likes: optimisticLikes, isLiked: nextLiked } : t))
    );
    setCurrentTrack((curr) =>
      curr && curr.id === targetId ? { ...curr, likes: optimisticLikes, isLiked: nextLiked } : curr
    );

    // Server persistence & reconciliation with rollback on error
    api
      .toggleLike(targetId, nextLiked ? 'like' : 'unlike')
      .then((res) => {
        if (res) {
          const confirmedLiked = typeof res.liked === 'boolean' ? res.liked : nextLiked;
          const confirmedCount = typeof res.likes_count === 'number' ? res.likes_count : optimisticLikes;
          const resolvedTrackId = res.track_id || targetId;

          setLikedTrackIds((prev) =>
            confirmedLiked
              ? prev.includes(resolvedTrackId)
                ? prev
                : [...prev, resolvedTrackId]
              : prev.filter((id) => id !== resolvedTrackId && id !== targetId)
          );
          setTracks((prev) =>
            prev.map((t) =>
              t.id === targetId || t.id === resolvedTrackId
                ? { ...t, likes: confirmedCount, isLiked: confirmedLiked }
                : t
            )
          );
          setCurrentTrack((curr) =>
            curr && (curr.id === targetId || curr.id === resolvedTrackId)
              ? { ...curr, likes: confirmedCount, isLiked: confirmedLiked }
              : curr
          );
        }
      })
      .catch((err) => {
        // Roll back failed action and show clear error
        setLikedTrackIds((prev) =>
          wasLiked ? (prev.includes(targetId) ? prev : [...prev, targetId]) : prev.filter((id) => id !== targetId)
        );
        setTracks((prev) =>
          prev.map((t) => (t.id === targetId ? { ...t, likes: prevLikes, isLiked: wasLiked } : t))
        );
        setCurrentTrack((curr) =>
          curr && curr.id === targetId ? { ...curr, likes: prevLikes, isLiked: wasLiked } : curr
        );
        setActionBanner({
          type: 'error',
          message: err?.message || 'Failed to update like status on server. Your change was rolled back.',
        });
      });
  };

  const handleDislikeTrack = (trackId: string) => {
    setDislikedTrackIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
    api.dislikeTrack(trackId).then((res) => {
      if (res && typeof res.dislikes_count === 'number') {
        setTracks((prev) =>
          prev.map((t) => (t.id === trackId ? { ...t, dislikes: res.dislikes_count } : t))
        );
      }
    }).catch(() => {});
  };

  const handleToggleFollowArtist = (artistId: string) => {
    setFollowedArtistIds((prev) =>
      prev.includes(artistId) ? prev.filter((id) => id !== artistId) : [...prev, artistId]
    );
    api.toggleFollowArtist(artistId).then((res) => {
      if (res && typeof res.followers_count === 'number') {
        setArtistProfiles((prev) => {
          if (!prev[artistId]) return prev;
          return {
            ...prev,
            [artistId]: {
              ...prev[artistId],
              followers: res.followers_count,
              flontmieFollowers: res.followers_count,
            },
          };
        });
      }
    }).catch(() => {});
  };

  const handlePlayAll = (trackList: Track[]) => {
    if (trackList.length === 0) return;
    handlePlayTrack(trackList[0]);
    setQueue(trackList.slice(1));
  };

  const handleShuffleAll = (trackList: Track[]) => {
    if (trackList.length === 0) return;
    const shuffled = [...trackList].sort(() => Math.random() - 0.5);
    handlePlayTrack(shuffled[0]);
    setQueue(shuffled.slice(1));
    setIsShuffle(true);
  };

  const handleAddToQueue = (track: Track) => {
    setQueue([...queue, track]);
  };

  const handleRemoveFromQueue = (index: number) => {
    setQueue(queue.filter((_, i) => i !== index));
  };

  const handleClearQueue = () => {
    setQueue([]);
  };

  const handleMoveQueueItem = (from: number, to: number) => {
    if (to < 0 || to >= queue.length) return;
    const copy = [...queue];
    const item = copy.splice(from, 1)[0];
    copy.splice(to, 0, item);
    setQueue(copy);
  };

  // Follow accounts toggle
  const handleToggleFollowAccount = (accountId: string) => {
    setFeaturedAccounts((prev) =>
      prev.map((acc) => (acc.id === accountId ? { ...acc, isFollowing: !acc.isFollowing } : acc))
    );
  };

  // Playlist management (Persisted to MySQL Database)
  const handleCreatePlaylist = (newPlaylist: Partial<Playlist>) => {
    if (!currentUser || !api.getToken()) {
      setActionBanner({
        type: 'error',
        message: 'Please sign in to create and save playlists to your account.',
      });
      setAuthInitialMode('login');
      setIsAuthModalOpen(true);
      return;
    }

    const playlistId = `pl_${Date.now()}`;
    const defaultTrackIds =
      newPlaylist.trackIds && newPlaylist.trackIds.length > 0
        ? newPlaylist.trackIds
        : tracks.slice(0, 2).map((t) => t.id);

    const created: Playlist = {
      id: playlistId,
      title: newPlaylist.title || 'New Playlist',
      description: newPlaylist.description || '',
      coverUrl: newPlaylist.coverUrl || IMAGES.synthwave,
      curator: currentUser?.display_name || newPlaylist.curator || 'You',
      creatorId: currentUser?.id,
      creatorRole: currentUser?.role,
      isAdminCreated: currentUser?.role === 'admin',
      isPublic: true,
      isCollaborative: Boolean(newPlaylist.isCollaborative),
      collaborators: newPlaylist.collaborators,
      trackIds: defaultTrackIds,
      followers: 1,
      category: newPlaylist.category || 'energize',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setPlaylists((prev) => [created, ...prev]);
    setSelectedPlaylistId(created.id);

    api
      .createPlaylist({
        id: created.id,
        title: created.title,
        description: created.description,
        cover_art_url: created.coverUrl,
        genre_category: String(created.category || 'all'),
        is_public: true,
        track_ids: created.trackIds,
      })
      .catch((err) => {
        setPlaylists((prev) => prev.filter((p) => p.id !== created.id));
        setActionBanner({
          type: 'error',
          message: err?.message || 'Failed to save playlist to server.',
        });
      });
  };

  const handleDeletePlaylist = (id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (selectedPlaylistId === id) {
      setSelectedPlaylistId(null);
    }
    api.deletePlaylist(id).catch(() => {});
  };

  const handleToggleTrackInPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const exists = pl.trackIds.includes(trackId);
        const nextIds = exists
          ? pl.trackIds.filter((id) => id !== trackId)
          : [...pl.trackIds, trackId];
        api.updatePlaylistTracks(playlistId, nextIds, pl.title).catch(() => {});
        return {
          ...pl,
          trackIds: nextIds,
        };
      })
    );
  };

  const handleRemoveTrackFromPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const nextIds = pl.trackIds.filter((id) => id !== trackId);
        api.updatePlaylistTracks(playlistId, nextIds, pl.title).catch(() => {});
        return { ...pl, trackIds: nextIds };
      })
    );
  };

  // Artist Release Integration
  const handleAddNewArtistTrack = (newTrack: Partial<Track>) => {
    const fullTrack: Track = {
      id: `track-${Date.now()}`,
      title: newTrack.title || 'Untitled Track',
      artist: newTrack.artist || 'Nova Waves',
      artistId: newTrack.artistId || 'artist-nova',
      album: newTrack.album || 'Neon Horizon (Expanded)',
      coverUrl: IMAGES.synthwave,
      duration: newTrack.duration || 180,
      genre: (newTrack.genre as any) || 'synthwave',
      bpm: newTrack.bpm || 120,
      moods: ['energize'],
      streams: 1,
      likes: 1,
      isExplicit: newTrack.isExplicit,
      releaseDate: newTrack.releaseDate || new Date().toISOString().split('T')[0],
      isrc: newTrack.isrc || 'US-FLN-26-99999',
      upc: newTrack.upc || '840192837999',
      label: newTrack.label || 'Astral Horizon Records',
      distributor: newTrack.distributor || 'TuneCore Direct',
      status: 'active',
      featuredOnHome: true,
      lyrics: [
        { time: 0, text: '[New Master Recording Audio Stream]' },
        { time: 10, text: 'Signal transmitted across the network' },
      ],
    };

    setTracks([fullTrack, ...tracks]);
  };

  // Distributor Upload & Modify Handlers
  const handleUploadSongToFlontmie = (newSong: Partial<Track>) => {
    const trackObj: Track = {
      id: `track-${Date.now()}`,
      title: newSong.title || 'Untitled Master',
      artist: newSong.artist || 'Unknown Artist',
      artistId: newSong.artistId || 'artist-unknown',
      album: newSong.album || 'Single',
      coverUrl: newSong.coverUrl || IMAGES.partyMix,
      duration: newSong.duration || 210,
      genre: (newSong.genre as any) || 'afrobeat',
      bpm: newSong.bpm || 115,
      moods: ['energize'],
      streams: 1,
      likes: 1,
      isExplicit: Boolean(newSong.isExplicit),
      releaseDate: newSong.releaseDate || new Date().toISOString().split('T')[0],
      isrc: newSong.isrc || `US-FLN-26-${Math.floor(10000 + Math.random() * 90000)}`,
      upc: newSong.upc || `840192837${Math.floor(100 + Math.random() * 900)}`,
      label: newSong.label || 'Independent Label',
      distributor: newSong.distributor || 'TuneCore Direct',
      status: newSong.status || 'active',
      featuredOnHome: true,
    };

    setTracks([trackObj, ...tracks]);
  };

  const handleModifySongOnFlontmie = (trackId: string, updates: Partial<Track>) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, ...updates } : t))
    );
  };

  const handleDeleteSong = (trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    setQueue((prev) => prev.filter((t) => t.id !== trackId));
    if (currentTrack?.id === trackId) {
      handleNextTrack();
    }
  };

  // Artist Management Handlers
  const handleViewArtist = (artistId: string) => {
    let id = artistId;
    if (!artistProfiles[id]) {
      const foundEntry = Object.entries(artistProfiles).find(
        ([k, v]) =>
          v.name.toLowerCase() === artistId.toLowerCase() ||
          k.toLowerCase() === artistId.toLowerCase() ||
          v.ytBrowseId === artistId
      );
      if (foundEntry) {
        id = foundEntry[0];
      } else {
        const fallbackProfile: ArtistProfile = {
          id: artistId,
          name: artistId.startsWith('UC') ? 'Loading Artist...' : artistId,
          avatarUrl: resolveArtworkUrl('', 'artist', artistId),
          headerUrl: resolveArtworkUrl('', 'artist', artistId),
          bio: '',
          verified: true,
          monthlyListeners: null,
          totalStreams: null,
          followers: null,
          label: 'Official',
          topTracks: [],
          primaryGenre: 'Music',
          country: 'US',
          claimedStatus: 'Verified',
        };
        setArtistProfiles((prev) => ({ ...prev, [artistId]: fallbackProfile }));
        id = artistId;
      }
    }
    setSelectedArtistId(id);
    setSelectedPlaylistId(null);
    setCurrentPersona('listener');
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  };

  const handleCreateArtistProfile = (newProfile: ArtistProfile) => {
    setArtistProfiles((prev) => ({
      ...prev,
      [newProfile.id]: newProfile,
    }));
  };

  const handleUpdateArtistProfile = (artistId: string, updates: Partial<ArtistProfile>) => {
    setArtistProfiles((prev) => {
      if (!prev[artistId]) return prev;
      return {
        ...prev,
        [artistId]: { ...prev[artistId], ...updates },
      };
    });
  };

  // Admin Master Handlers
  const handleToggleTrackFeatured = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, featuredOnHome: !t.featuredOnHome } : t))
    );
  };

  const handleUpdateTrackStatus = (trackId: string, status: 'active' | 'review' | 'flagged') => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, status } : t))
    );
  };

  const handleDeleteTrack = (trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  const handleUpdatePermission = (updated: AdminRolePermission) => {
    setAdminPermissions((prev) =>
      prev.map((p) => (p.role === updated.role ? updated : p))
    );
  };

  const handleSendReaction = (emoji: string) => {
    const newReaction = {
      id: `react-${Date.now()}-${Math.random()}`,
      emoji,
      x: 10 + Math.random() * 80,
    };
    setReactions((prev) => [...prev, newReaction]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 1800);
  };

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId) || null;

  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col font-sans selection:bg-red-600/30 overflow-x-hidden">
      {/* Action Error / Rollback Notification Toast */}
      {actionBanner && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[120] max-w-md w-[92%] px-4 py-3 rounded-2xl bg-red-950/95 border border-red-500/50 text-red-100 text-xs font-semibold shadow-2xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
          <span>{actionBanner.message}</span>
          <button
            onClick={() => setActionBanner(null)}
            className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Offline Mode Status Banner */}
      {!isOnline && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 px-4 py-2 text-xs text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              <strong>Offline Mode Active:</strong> Playing downloaded tracks from device storage.
            </span>
          </div>
          <button
            onClick={() => navigateTab('explore')}
            className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Offline Library</span>
          </button>
        </div>
      )}

      {/* Top Bar Navigation */}
      <Navbar
        currentPersona={isAdminRoute ? 'admin' : (currentPersona === 'admin' ? 'listener' : currentPersona)}
        onSelectPersona={(p) => {
          if (p === 'admin') {
            navigateTab('admin');
            return;
          }
          setIsAdminRoute(false);
          setCurrentPersona(p);
          setSelectedPlaylistId(null);
          setSelectedArtistId(null);
          try {
            window.history.pushState(null, '', '/');
          } catch {}
        }}
        selectedMood={selectedMood}
        onSelectMood={setSelectedMood}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q.trim().length >= 2 && currentTab !== 'home' && currentTab !== 'explore') {
            navigateTab('home');
          }
        }}
        onOpenJamModal={() => setIsJamModalOpen(true)}
        isJamActive={isJamActive}
        jamParticipantCount={jamParticipants.length}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        currentUser={currentUser}
        onOpenAuth={() => {
          if (isAdminRoute) {
            setAuthInitialMode('login');
            setIsAuthModalOpen(true);
          } else {
            try {
              localStorage.setItem('flontmie_onboarding_step_v1', '1');
            } catch {}
            setOnboardingInitialStep(1);
            setIsOnboardingOpen(true);
          }
        }}
        onOpenProfile={() => {
          setIsAdminRoute(false);
          setCurrentTab('profile');
          setCurrentPersona('listener');
          try {
            window.history.pushState(null, '', '/profile');
          } catch {}
        }}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Sidebar (hidden on mobile) */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={navigateTab}
          playlists={playlists}
          selectedPlaylistId={selectedPlaylistId}
          onSelectPlaylist={navigatePlaylist}
          onCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
          currentPersona={currentPersona === 'admin' ? 'listener' : currentPersona}
          onSelectPersona={(p) => {
            if (p === 'admin') {
              navigateTab('admin');
              return;
            }
            setIsAdminRoute(false);
            setCurrentPersona(p);
            setSelectedPlaylistId(null);
            setSelectedArtistId(null);
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          currentUser={currentUser}
        />

        {/* Main Workspace Viewport */}
        <main className="flex-1 min-w-0 overflow-y-auto px-3 sm:px-6 md:px-8 py-5 h-[calc(100vh-57px-72px)] pb-24 md:pb-8">
          <ErrorBoundary fallbackTitle="Unable to load this view" onReset={() => navigateTab('home')}>
          {/* DEDICATED PROTECTED /admin ROUTE */}
          {isAdminRoute ? (
            isAuthChecking ? (
              <div className="py-24 text-center space-y-4">
                <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-neutral-400">Verifying administrator session and server permissions...</p>
              </div>
            ) : !currentUser ? (
              <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-neutral-900/70 border border-amber-500/30 text-center space-y-5 shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Protected Route · /admin</span>
                  <h2 className="text-xl font-extrabold text-white">Administrator Authentication Required</h2>
                  <p className="text-xs text-neutral-400">
                    Sign in with an authorized administrator account to access platform governance.
                  </p>
                </div>
                <div className="flex flex-col gap-2.5 pt-2">
                  <button
                    onClick={() => {
                      setAuthInitialMode('login');
                      setIsAuthModalOpen(true);
                    }}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Sign In as Administrator
                  </button>
                  <button
                    onClick={() => navigateTab('home')}
                    className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-neutral-300 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Return to Streaming Home
                  </button>
                </div>
              </div>
            ) : currentUser.role !== 'admin' ? (
              <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-red-950/30 border border-red-500/30 text-center space-y-5 shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto font-mono font-bold text-lg">
                  403
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">Access Denied</span>
                  <h2 className="text-xl font-extrabold text-white">Administrator Privileges Required</h2>
                  <p className="text-xs text-neutral-300">
                    Your account ({currentUser.email}) is registered with the <strong className="uppercase">{currentUser.role}</strong> role and does not have permission to access <code className="text-red-300">/admin</code>.
                  </p>
                </div>
                <button
                  onClick={() => navigateTab('home')}
                  className="w-full py-3 rounded-xl bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-neutral-200 transition-all cursor-pointer"
                >
                  Return to Streaming Home
                </button>
              </div>
            ) : (
              <AdminDashboard
                currentUser={currentUser}
                tracks={tracks}
                onToggleTrackFeatured={handleToggleTrackFeatured}
                onUpdateTrackStatus={handleUpdateTrackStatus}
                onDeleteTrack={handleDeleteTrack}
                permissions={adminPermissions}
                onUpdatePermission={handleUpdatePermission}
                labelArtists={labelArtists}
                onTrackImported={(newTrack) => {
                  setTracks((prev) => {
                    const exists = prev.some((t) => t.id === newTrack.id);
                    return exists ? prev.map((t) => (t.id === newTrack.id ? newTrack : t)) : [newTrack, ...prev];
                  });
                  refreshCatalogFromDatabase();
                }}
                onExitAdmin={() => {
                  refreshCatalogFromDatabase();
                  navigateTab('home');
                }}
                onSignOut={async () => {
                  await api.logout();
                  setCurrentUser(null);
                  navigateTab('home');
                }}
              />
            )
          ) : (
          <>
          {/* Persona View 1: Consumer Streaming App (Flontmie) */}
          {currentPersona === 'listener' && (
            <>
              {selectedArtistId && artistProfiles[selectedArtistId] ? (
                <PublicArtistPage
                  artist={artistProfiles[selectedArtistId]}
                  tracks={tracks}
                  onPlayTrack={handlePlayTrack}
                  onPlayAll={handlePlayAll}
                  onShuffleAll={handleShuffleAll}
                  onToggleLike={handleToggleLike}
                  likedTrackIds={likedTrackIds}
                  onAddToQueue={handleAddToQueue}
                  onOpenAddToPlaylist={(track) => {
                    setCurrentTrack(track);
                    setIsAddToPlaylistOpen(true);
                  }}
                  onOpenShareModal={() => setIsShareModalOpen(true)}
                  onBack={() => setSelectedArtistId(null)}
                  onSelectArtist={handleViewArtist}
                />
              ) : selectedPlaylist ? (
                <PlaylistView
                  playlist={selectedPlaylist}
                  allTracks={tracks}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  likedTrackIds={likedTrackIds}
                  onPlayTrack={handlePlayTrack}
                  onPlayAll={handlePlayAll}
                  onShuffleAll={handleShuffleAll}
                  onToggleLike={handleToggleLike}
                  onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
                  onOpenAddTrackModal={() => setIsSelectTracksOpen(true)}
                  onOpenShareModal={() => setIsShareModalOpen(true)}
                  onDeletePlaylist={handleDeletePlaylist}
                  onBack={() => {
                    setSelectedPlaylistId(null);
                    if (currentTab === 'explore') {
                      window.history.pushState(null, '', '/explore');
                    } else if (currentTab === 'library') {
                      window.history.pushState(null, '', '/library');
                    } else {
                      window.history.pushState(null, '', '/');
                    }
                  }}
                />
              ) : isLoadingPlaylist ? (
                <div className="py-24 text-center space-y-4">
                  <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-neutral-400">Loading collection...</p>
                </div>
              ) : selectedPlaylistId ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-400 mx-auto">
                    <Music className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Playlist Not Found</h2>
                    <p className="text-xs text-neutral-400 mt-1">This collection may have been removed or the link is invalid.</p>
                  </div>
                  <button
                    onClick={() => navigateTab('home')}
                    className="px-5 py-2.5 bg-white text-black font-semibold text-xs rounded-full hover:bg-neutral-200 transition-colors"
                  >
                    Return to Music Feed
                  </button>
                </div>
              ) : currentTab === 'explore' ? (
                <div className="space-y-8 pb-24">
                  {/* Explore Header */}
                  <div className="border-b border-white/[0.08] pb-5">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-500 mb-1">
                      <Compass className="w-4 h-4" />
                      <span>Music Discovery &amp; Charts</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Explore</h1>
                    <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                      Browse and stream songs, albums, verified artists, and editorial playlists
                    </p>
                  </div>

                  {/* Unified App-Wide + YouTube Music Explorer */}
                  <YouTubeMusicDiscovery
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    likedTrackIds={likedTrackIds}
                    onPlayTrack={handlePlayTrack}
                    onToggleLike={handleToggleLike}
                    onAddToQueue={handleAddToQueue}
                    onOpenAddToPlaylist={(track) => {
                      setCurrentTrack(track);
                      setIsAddToPlaylistOpen(true);
                    }}
                    onSelectArtist={handleViewArtist}
                    onSelectPlaylist={navigatePlaylist}
                    searchQuery={searchQuery}
                    catalogTracks={tracks}
                    catalogAlbums={albums}
                    catalogArtists={Object.values(artistProfiles)}
                    catalogPlaylists={playlists}
                  />

                  {/* Explore Genre Highlights Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { name: 'Afrobeats', desc: 'Lagos & Jozi rhythms', color: 'from-amber-600/30 to-red-600/20', border: 'border-amber-500/30' },
                      { name: 'Hip-Hop & Rap', desc: 'Velocity & heavy 808s', color: 'from-purple-600/30 to-blue-600/20', border: 'border-purple-500/30' },
                      { name: 'Pop & Anthems', desc: 'Chart-topping melodies', color: 'from-pink-600/30 to-rose-600/20', border: 'border-pink-500/30' },
                      { name: 'Lo-Fi & Chill', desc: 'Rain & deep focus loops', color: 'from-emerald-600/30 to-teal-600/20', border: 'border-emerald-500/30' }
                    ].map((g) => (
                      <div
                        key={g.name}
                        onClick={() => {
                          const matching = tracks.find((t) => (t?.genre || '').toLowerCase().includes(g.name.toLowerCase().split(' ')[0]));
                          if (matching) handlePlayTrack(matching);
                        }}
                        className={`p-4 rounded-2xl bg-gradient-to-br ${g.color} border ${g.border} hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer group`}
                      >
                        <h3 className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">{g.name}</h3>
                        <p className="text-[11px] text-neutral-300 mt-1">{g.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Top Charts & Editorial Playlists 2-Column Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Streamed Tracks */}
                    <div className="p-4 sm:p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4 text-red-500" />
                          <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Top Streamed Tracks</h3>
                        </div>
                        <span className="text-[11px] text-neutral-500 font-mono">Trending Releases</span>
                      </div>
                      <div className="space-y-1.5">
                        {tracks.length === 0 ? (
                          <p className="py-6 text-center text-xs text-neutral-500">No catalog tracks published yet.</p>
                        ) : (
                          tracks
                            .slice()
                            .sort((a, b) => (Number(b.streams) || 0) - (Number(a.streams) || 0))
                            .slice(0, 8)
                            .map((t, i) => (
                              <div
                                key={t.id || i}
                                onClick={() => handlePlayTrack(t)}
                                className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl hover:bg-white/[0.06] cursor-pointer text-xs transition-colors group"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className={`font-mono w-5 text-center shrink-0 font-bold ${i < 3 ? 'text-red-400' : 'text-neutral-500'}`}>
                                    {i + 1}
                                  </span>
                                  <img
                                    src={resolveArtworkUrl(t.coverUrl, 'track', t.title)}
                                    alt={t.title}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => handleImageError(e, t.title, 'track')}
                                    className="w-9 h-9 rounded-lg object-cover shrink-0 bg-neutral-800"
                                  />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-white truncate group-hover:text-red-400 transition-colors">
                                      {t.title || 'Untitled'}
                                    </p>
                                    <p className="text-[11px] text-neutral-400 truncate">{t.artist || 'Unknown'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                  <span className="font-mono tabular-nums text-neutral-400 text-[11px]">
                                    {formatCompactNumber(t.ytPlays ?? t.streams)} plays
                                  </span>
                                  <Play className="w-3.5 h-3.5 text-neutral-400 opacity-0 group-hover:opacity-100 fill-current hover:text-white transition-opacity" />
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                    {/* Featured Curated Playlists */}
                    <div className="p-4 sm:p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                        <div className="flex items-center gap-2">
                          <Disc3 className="w-4 h-4 text-blue-400" />
                          <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Curated Playlists & Mixes</h3>
                        </div>
                        <span className="text-[11px] text-neutral-500 font-mono">{playlists.length} Collections</span>
                      </div>
                      <div className="space-y-2">
                        {playlists.length === 0 ? (
                          <p className="py-6 text-center text-xs text-neutral-500">No curated playlists published yet.</p>
                        ) : (
                          playlists.map((pl) => {
                            const trackCount = Array.isArray(pl.trackIds) ? pl.trackIds.length : 0;
                            const savesFormatted = formatCompactNumber(pl.followers);
                            return (
                              <div
                                key={pl.id}
                                onClick={() => navigatePlaylist(pl.id)}
                                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.06] cursor-pointer text-xs transition-colors group"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <img
                                    src={resolveArtworkUrl(pl.coverUrl, 'playlist', pl.title)}
                                    alt={pl.title}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => handleImageError(e, pl.title, 'playlist')}
                                    className="w-10 h-10 rounded-lg object-cover shrink-0 bg-neutral-800"
                                  />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                                      {pl.title || 'Curated Playlist'}
                                    </p>
                                    <p className="text-[11px] text-neutral-400 truncate">
                                      {pl.curator || 'Editorial'} · {trackCount} songs
                                    </p>
                                  </div>
                                </div>
                                <span className="text-neutral-400 font-mono text-[11px] shrink-0 ml-2">
                                  {savesFormatted !== 'N/A' ? `${savesFormatted} saves` : '0 saves'}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : currentTab === 'library' ? (
                <div className="space-y-6 pb-20">
                  <div className="border-b border-white/[0.08] pb-4">
                    <h1 className="text-xl md:text-2xl font-bold text-white">Your Streaming Library</h1>
                    <p className="text-xs text-neutral-400 mt-1">Your saved playlists, liked tracks, and listening history</p>
                  </div>
                  {playlists.length === 0 ? (
                    <div className="py-16 text-center rounded-2xl bg-neutral-900/30 border border-white/[0.06] space-y-3">
                      <p className="text-sm font-semibold text-neutral-300">No playlists in your library yet</p>
                      <p className="text-xs text-neutral-500">Create a playlist to organize your favorite tracks.</p>
                      <button
                        onClick={() => setIsCreatePlaylistOpen(true)}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Create New Playlist
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                      {playlists.map((pl) => (
                        <div
                          key={pl.id}
                          onClick={() => navigatePlaylist(pl.id)}
                          className="p-3 rounded-2xl bg-neutral-900/30 border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2">
                            <img
                              src={resolveArtworkUrl(pl.coverUrl, 'playlist', pl.title)}
                              alt={pl.title}
                              referrerPolicy="no-referrer"
                              onError={(e) => handleImageError(e, pl.title, 'playlist')}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                          <h4 className="text-xs font-semibold text-white truncate">{pl.title}</h4>
                          <p className="text-[11px] text-neutral-400 truncate">{pl.curator}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : currentTab === 'liked' ? (
                <div className="space-y-6 pb-20">
                  <div className="flex items-center gap-4 p-4 sm:p-6 bg-gradient-to-r from-red-950/40 to-neutral-900/40 rounded-2xl border border-white/[0.08]">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-red-600 to-purple-800 flex items-center justify-center shadow-xl shrink-0">
                      <Heart className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white" />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Favorites</span>
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white mt-0.5">Liked Songs</h1>
                      <p className="text-xs text-neutral-400 mt-1 font-mono tabular-nums">{likedTrackIds.length} tracks saved</p>
                    </div>
                  </div>

                  <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-neutral-900/30">
                    {tracks.filter((t) => likedTrackIds.includes(t.id)).length === 0 ? (
                      <p className="py-12 text-center text-xs text-neutral-500">
                        You haven't liked any tracks yet. Tap the heart icon on any song to save it here.
                      </p>
                    ) : (
                      tracks
                        .filter((t) => likedTrackIds.includes(t.id))
                        .map((t, idx) => (
                          <div
                            key={t.id}
                            onClick={() => handlePlayTrack(t)}
                            className="flex items-center justify-between p-3 border-b border-white/[0.03] hover:bg-white/[0.04] cursor-pointer text-xs transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono text-neutral-500 w-4 shrink-0">{idx + 1}</span>
                              <img
                                src={resolveArtworkUrl(t.coverUrl, 'track', t.title)}
                                alt={t.title}
                                referrerPolicy="no-referrer"
                                onError={(e) => handleImageError(e, t.title, 'track')}
                                className="w-9 h-9 rounded-lg object-cover shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-white truncate">{t.title}</p>
                                <p className="text-neutral-400 truncate">{t.artist}</p>
                              </div>
                            </div>
                            <span className="font-mono tabular-nums text-neutral-400 shrink-0 ml-2">
                              {Math.floor(t.duration / 60)}:{String(Math.floor(t.duration % 60)).padStart(2, '0')}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              ) : currentTab === 'profile' ? (
                <ProfilePage
                  currentUser={currentUser}
                  likedTracks={tracks.filter((t) => likedTrackIds.includes(t.id))}
                  userPlaylists={playlists}
                  onPlayTrack={handlePlayTrack}
                  onSelectPlaylist={(id) => {
                    setSelectedPlaylistId(id);
                    setCurrentTab('library');
                  }}
                  onUpdateProfile={(updated) => {
                    setCurrentUser((prev) => (prev ? { ...prev, ...updated } : null));
                  }}
                  onSignOut={async () => {
                    await api.logout();
                    setCurrentUser(null);
                    setLikedTrackIds([]);
                    setFollowedArtistIds([]);
                    setCurrentTab('home');
                  }}
                  onSwitchPortal={(role) => {
                    if (role === 'admin') {
                      navigateTab('admin');
                    } else {
                      setIsAdminRoute(false);
                      setCurrentPersona(role);
                      setCurrentTab('home');
                    }
                  }}
                  onBackToHome={() => setCurrentTab('home')}
                  onRestartOnboarding={() => {
                    try {
                      localStorage.removeItem('flontmie_onboarding_completed_v1');
                      localStorage.setItem('flontmie_onboarding_step_v1', '1');
                    } catch {}
                    setOnboardingInitialStep(1);
                    setIsOnboardingOpen(true);
                  }}
                />
              ) : (
                <HomeFeed
                  tracks={tracks}
                  albums={albums}
                  playlists={playlists}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  selectedMood={selectedMood}
                  searchQuery={searchQuery}
                  likedTrackIds={likedTrackIds}
                  featuredAccounts={featuredAccounts}
                  artistProfiles={artistProfiles}
                  onPlayTrack={handlePlayTrack}
                  onToggleLike={handleToggleLike}
                  onSelectPlaylist={navigatePlaylist}
                  onAddToQueue={handleAddToQueue}
                  onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
                  onToggleFollowAccount={handleToggleFollowAccount}
                  onSelectArtist={handleViewArtist}
                  onNavigateToExplore={() => navigateTab('explore')}
                />
              )}
            </>
          )}

          {/* Persona View 2: Artist Studio Dashboard */}
          {currentPersona === 'artist' && (
            currentUser && (currentUser.role === 'artist' || currentUser.role === 'admin') ? (
              <ArtistDashboard
                artist={
                  Object.values(artistProfiles).find(
                    (a) => a.name.toLowerCase() === (currentUser.display_name || '').toLowerCase()
                  ) || Object.values(artistProfiles)[0]
                }
                artistTracks={tracks}
                onUploadTrack={(newTrack) => handleAddNewArtistTrack(newTrack)}
                onUpdateSplits={() => {}}
                onViewPublicProfile={() => setCurrentPersona('listener')}
                onPlayTrack={handlePlayTrack}
              />
            ) : (
              <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-neutral-900/70 border border-red-500/30 text-center space-y-4">
                <h2 className="text-lg font-bold text-white">Artist Studio Access Required</h2>
                <p className="text-xs text-neutral-400">Only accounts assigned the Artist or Administrator role can access the Artist Studio.</p>
                <button onClick={() => setCurrentPersona('listener')} className="px-5 py-2.5 rounded-xl bg-white text-black text-xs font-bold">Return to Listener View</button>
              </div>
            )
          )}

          {/* Persona View 3: Record Label Hub Dashboard */}
          {currentPersona === 'label' && (
            currentUser && (currentUser.role === 'label' || currentUser.role === 'admin') ? (
              <LabelDashboard
                roster={labelArtists}
                upcomingReleases={upcomingReleases}
              />
            ) : (
              <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-neutral-900/70 border border-blue-500/30 text-center space-y-4">
                <h2 className="text-lg font-bold text-white">Record Label Access Required</h2>
                <p className="text-xs text-neutral-400">Only accounts assigned the Record Label or Administrator role can access the Record Label Hub.</p>
                <button onClick={() => setCurrentPersona('listener')} className="px-5 py-2.5 rounded-xl bg-white text-black text-xs font-bold">Return to Listener View</button>
              </div>
            )
          )}

          {/* Persona View 4: Distributor Portal */}
          {currentPersona === 'distributor' && (
            currentUser && (currentUser.role === 'distributor' || currentUser.role === 'admin') ? (
              <DistributorDashboard
                ingestions={distributorIngestions}
                accessGrants={distributorAccessGrants}
                onIngestNewTrack={(item, newTrack) => {
                  setDistributorIngestions((prev) => [item, ...prev]);
                  if (newTrack) {
                    handleUploadSongToFlontmie(newTrack);
                  }
                  refreshCatalogFromDatabase();
                }}
                onToggleGrantAccess={() => {}}
                onPlayTrack={handlePlayTrack}
                allTracks={tracks}
              />
            ) : (
              <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-neutral-900/70 border border-purple-500/30 text-center space-y-4">
                <h2 className="text-lg font-bold text-white">Distributor Portal Access Required</h2>
                <p className="text-xs text-neutral-400">Only accounts assigned the Distributor or Administrator role can access the Distributor Portal.</p>
                <button onClick={() => setCurrentPersona('listener')} className="px-5 py-2.5 rounded-xl bg-white text-black text-xs font-bold">Return to Listener View</button>
              </div>
            )
          )}
          </>
          )}
          </ErrorBoundary>
        </main>
      </div>

      {/* MOBILE DOCK: Bottom floating touch dock (rendered exclusively on mobile) */}
      <MobileDock
        currentTab={currentTab}
        onSelectTab={navigateTab}
        currentPersona={currentPersona === 'admin' ? 'listener' : currentPersona}
        onSelectPersona={(p) => {
          if (p === 'admin') {
            navigateTab('admin');
            return;
          }
          setIsAdminRoute(false);
          setCurrentPersona(p);
          setSelectedPlaylistId(null);
          setSelectedArtistId(null);
        }}
        isJamActive={isJamActive}
        onOpenJamModal={() => setIsJamModalOpen(true)}
      />

      {/* Responsive Flontmie Bottom Player Bar */}
      <BottomPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        isLiked={Boolean(currentTrack && likedTrackIds.includes(currentTrack.id))}
        isDisliked={Boolean(currentTrack && dislikedTrackIds.includes(currentTrack.id))}
        activeTab={playerTabMode}
        isQueueOpen={isQueueOpen}
        onSelectTab={handleSelectPlayerTab}
        onPlayPause={handleTogglePlay}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onToggleShuffle={handleToggleShuffle}
        onToggleRepeat={handleToggleRepeat}
        onToggleLike={handleToggleLike}
        onDislike={handleDislikeTrack}
        onToggleQueue={() => setIsQueueOpen(!isQueueOpen)}
        onOpenShare={() => setIsShareModalOpen(true)}
        onSelectArtist={handleViewArtist}
        onOpenFullPlayer={() => setIsFullPlayerOpen(true)}
      />

      {/* DEDICATED FULL PLAYBACK SCREEN */}
      <FullPlaybackScreen
        isOpen={isFullPlayerOpen}
        onClose={() => setIsFullPlayerOpen(false)}
        currentTrack={currentTrack}
        artistProfile={currentTrack ? artistProfiles[currentTrack.artistId] : undefined}
        queue={queue}
        allTracks={tracks}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        isLiked={Boolean(currentTrack && likedTrackIds.includes(currentTrack.id))}
        isDisliked={Boolean(currentTrack && dislikedTrackIds.includes(currentTrack.id))}
        isFollowingArtist={Boolean(currentTrack && followedArtistIds.includes(currentTrack.artistId))}
        activeTab={playerTabMode}
        onSelectTab={(tab) => handleSelectPlayerTab(tab, false)}
        isQueueOpen={isQueueOpen}
        onPlayPause={handleTogglePlay}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onToggleShuffle={handleToggleShuffle}
        onToggleRepeat={handleToggleRepeat}
        onToggleLike={handleToggleLike}
        onDislike={handleDislikeTrack}
        onToggleFollowArtist={handleToggleFollowArtist}
        onToggleQueue={() => setIsQueueOpen(!isQueueOpen)}
        onOpenShare={() => setIsShareModalOpen(true)}
        onOpenAddToPlaylist={() => setIsAddToPlaylistOpen(true)}
        onPlayTrack={handlePlayTrack}
        onSelectArtist={(artistId) => {
          setIsFullPlayerOpen(false);
          handleViewArtist(artistId);
        }}
        currentUser={currentUser}
        onRequireAuth={(reason) => {
          if (reason) {
            setActionBanner({ type: 'error', message: reason });
          }
          setAuthInitialMode('login');
          setIsAuthModalOpen(true);
        }}
        onCommentCountChange={handleCommentCountChange}
        onLikeCountReconcile={handleLikeCountReconcile}
      />

      {/* Up Next / Queue Drawer */}
      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        queue={queue}
        currentTrack={currentTrack}
        onPlayTrack={handlePlayTrack}
        onRemoveFromQueue={handleRemoveFromQueue}
        onClearQueue={handleClearQueue}
        onMoveQueueItem={handleMoveQueueItem}
      />

      {/* Social Sharing Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        track={currentTrack}
        playlist={selectedPlaylist}
      />

      {/* Social Jam Session Listening Room Modal */}
      <JamSessionModal
        isOpen={isJamModalOpen}
        onClose={() => setIsJamModalOpen(false)}
        isJamActive={isJamActive}
        onToggleJam={() => setIsJamActive(!isJamActive)}
        currentTrack={currentTrack}
        participants={jamParticipants}
        onSendReaction={handleSendReaction}
        reactions={reactions}
      />

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onCreate={handleCreatePlaylist}
      />

      {/* Add Track to Playlist Modal */}
      <AddToPlaylistModal
        isOpen={isAddToPlaylistOpen}
        onClose={() => setIsAddToPlaylistOpen(false)}
        track={currentTrack}
        playlists={playlists}
        onToggleTrackInPlaylist={handleToggleTrackInPlaylist}
        onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
      />

      {/* Select Tracks for Playlist Modal */}
      <SelectTracksModal
        isOpen={isSelectTracksOpen}
        onClose={() => setIsSelectTracksOpen(false)}
        playlist={selectedPlaylist}
        allTracks={tracks}
        onToggleTrack={handleToggleTrackInPlaylist}
      />

      {/* Real Secure Authentication Modal (Login / Sign Up) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authInitialMode}
        onAuthenticated={(user) => {
          setCurrentUser(user);
          if (Array.isArray((user as any).liked_track_ids)) {
            setLikedTrackIds((user as any).liked_track_ids);
          }
          if (Array.isArray((user as any).followed_artist_ids)) {
            setFollowedArtistIds((user as any).followed_artist_ids);
          }
          refreshCatalogFromDatabase();
          if (user.role === 'admin') {
            setCurrentPersona('listener');
            navigateTab('admin');
          } else {
            setCurrentPersona(user.role);
          }
          setIsAuthModalOpen(false);
        }}
      />

      {/* 5-Screen Flontmie Onboarding Flow (Welcome -> Auth -> Choose Your Interest -> Choose Your Favs -> Accept Terms) */}
      <FlontmieOnboarding
        isOpen={isOnboardingOpen && !isAdminRoute}
        initialStep={onboardingInitialStep}
        currentUser={currentUser}
        catalogArtists={Object.values(artistProfiles)}
        onAuthenticated={(user) => {
          setCurrentUser(user);
          if (Array.isArray(user.liked_track_ids)) {
            setLikedTrackIds(user.liked_track_ids);
          }
          if (Array.isArray(user.followed_artist_ids)) {
            setFollowedArtistIds(user.followed_artist_ids);
          }
          refreshCatalogFromDatabase();
          if (user.role === 'admin') {
            try {
              localStorage.setItem('flontmie_onboarding_completed_v1', 'true');
            } catch {}
            setIsOnboardingOpen(false);
            setCurrentPersona('listener');
            navigateTab('admin');
          } else {
            setCurrentPersona(user.role);
          }
        }}
        onComplete={({ user, selectedArtistIds }) => {
          try {
            localStorage.setItem('flontmie_onboarding_completed_v1', 'true');
            localStorage.removeItem('flontmie_onboarding_step_v1');
          } catch {}
          if (user) {
            setCurrentUser(user);
          }
          if (selectedArtistIds.length > 0) {
            setFollowedArtistIds((prev) => Array.from(new Set([...prev, ...selectedArtistIds])));
          }
          setIsOnboardingOpen(false);
          refreshCatalogFromDatabase();
          navigateTab('home');
        }}
        onSkipToHome={() => {
          try {
            localStorage.setItem('flontmie_onboarding_completed_v1', 'true');
            localStorage.removeItem('flontmie_onboarding_step_v1');
          } catch {}
          setIsOnboardingOpen(false);
          navigateTab('home');
        }}
        onOpenTerms={() => {
          setActiveLegalView('terms');
          try { window.history.pushState(null, '', '/terms'); } catch {}
        }}
        onOpenPrivacy={() => {
          setActiveLegalView('privacy');
          try { window.history.pushState(null, '', '/privacy'); } catch {}
        }}
      />

      {/* Dedicated Terms and Conditions Page View */}
      {activeLegalView === 'terms' && (
        <div className="fixed inset-0 z-[170] overflow-y-auto">
          <TermsPage
            onBack={() => {
              setActiveLegalView(null);
              try { window.history.pushState(null, '', '/'); } catch {}
            }}
            onNavigateToPrivacy={() => {
              setActiveLegalView('privacy');
              try { window.history.pushState(null, '', '/privacy'); } catch {}
            }}
          />
        </div>
      )}

      {/* Dedicated Privacy Policy Page View */}
      {activeLegalView === 'privacy' && (
        <div className="fixed inset-0 z-[170] overflow-y-auto">
          <PrivacyPolicyPage
            onBack={() => {
              setActiveLegalView(null);
              try { window.history.pushState(null, '', '/'); } catch {}
            }}
            onNavigateToTerms={() => {
              setActiveLegalView('terms');
              try { window.history.pushState(null, '', '/terms'); } catch {}
            }}
          />
        </div>
      )}
    </div>
  );
}
