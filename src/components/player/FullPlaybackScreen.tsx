import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Heart,
  ThumbsDown,
  Share2,
  ListMusic,
  Volume2,
  VolumeX,
  MessageSquare,
  Send,
  Headphones,
  Video,
  FileText,
  Radio,
  Sparkles,
  UserPlus,
  UserCheck,
  ExternalLink,
  AlertCircle,
  Loader2,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { Track, ArtistProfile, LyricLine, PlayerTabMode } from '../../types/music';
import { soundEngine } from '../../services/audioEngine';
import { api } from '../../services/api';
import { nativePlatform } from '../../services/nativePlatform';
import { resolveArtworkUrl, handleImageError } from '../../utils/artwork';
import { formatCompactNumber } from '../../utils/formatters';

interface FullPlaybackScreenProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  artistProfile?: ArtistProfile;
  queue: Track[];
  allTracks: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isLiked: boolean;
  isDisliked: boolean;
  isFollowingArtist: boolean;
  activeTab: PlayerTabMode;
  onSelectTab: (tab: PlayerTabMode) => void;
  isQueueOpen: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleLike: (trackId: string) => void;
  onDislike: (trackId: string) => void;
  onToggleFollowArtist: (artistId: string) => void;
  onToggleQueue: () => void;
  onOpenShare: (track: Track) => void;
  onPlayTrack: (track: Track) => void;
  onSelectArtist: (artistId: string) => void;
}

export const FullPlaybackScreen: React.FC<FullPlaybackScreenProps> = ({
  isOpen,
  onClose,
  currentTrack,
  artistProfile,
  allTracks,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffle,
  repeatMode,
  isLiked,
  isDisliked,
  isFollowingArtist,
  activeTab,
  onSelectTab,
  isQueueOpen,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onToggleLike,
  onDislike,
  onToggleFollowArtist,
  onToggleQueue,
  onOpenShare,
  onPlayTrack,
  onSelectArtist,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [comments, setComments] = useState<Array<{ id: string; user: string; text: string; time: string }>>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Real lyrics state (from track or loaded from backend)
  const [lyricsLines, setLyricsLines] = useState<LyricLine[]>([]);
  const [lyricsSynced, setLyricsSynced] = useState<boolean>(false);
  const [lyricsSource, setLyricsSource] = useState<string | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState<boolean>(false);

  // Real media availability / error state
  const [videoLoadError, setVideoLoadError] = useState<boolean>(false);
  const [isDownloadedOffline, setIsDownloadedOffline] = useState<boolean>(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const lyricItemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    const unsub = nativePlatform.subscribeOfflineTracks((records) => {
      setIsDownloadedOffline(Boolean(currentTrack && records[currentTrack.id]));
    });
    return () => unsub();
  }, [currentTrack?.id]);

  // Register unified video element with soundEngine so audio & video share one controller
  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      soundEngine.attachVideoElement(el);
    }
    return () => {
      soundEngine.attachVideoElement(null);
    };
  }, [currentTrack?.id]);

  // Reset video error state when track changes
  useEffect(() => {
    setVideoLoadError(false);
  }, [currentTrack?.id, currentTrack?.videoUrl]);

  // Load real comments for current track
  useEffect(() => {
    if (!currentTrack) return;
    let isMounted = true;
    setLoadingComments(true);
    api
      .getTrackComments(currentTrack.id)
      .then((list) => {
        if (isMounted) setComments(list);
      })
      .finally(() => {
        if (isMounted) setLoadingComments(false);
      });
    return () => {
      isMounted = false;
    };
  }, [currentTrack?.id]);

  // Load real lyrics for current track (from track record or backend endpoint, never inventing lyrics/timestamps)
  useEffect(() => {
    if (!currentTrack) {
      setLyricsLines([]);
      setLyricsSynced(false);
      setLyricsSource(null);
      return;
    }

    let cancelled = false;
    lyricItemRefs.current = {};

    const initialLines = Array.isArray(currentTrack.lyrics) ? currentTrack.lyrics : [];
    const hasInitialSynced = Boolean(
      currentTrack.lyricsSynced || initialLines.some((l) => l.time !== null && l.time >= 0)
    );

    if (initialLines.length > 0 && hasInitialSynced) {
      setLyricsLines(initialLines);
      setLyricsSynced(true);
      setLyricsSource('Synchronized Lyrics');
      setLoadingLyrics(false);
      return;
    }

    if (initialLines.length > 0) {
      setLyricsLines(initialLines);
      setLyricsSynced(false);
      setLyricsSource('Catalog Lyrics');
    } else {
      setLyricsLines([]);
      setLyricsSynced(false);
      setLyricsSource(null);
    }

    setLoadingLyrics(true);
    api
      .getTrackLyrics(currentTrack.id, {
        trackId: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
      })
      .then((res) => {
        if (cancelled) return;
        if (res && res.lyrics && typeof res.lyrics === 'string' && res.lyrics.trim().length > 0) {
          const parsed = api.parseLyricsText(res.lyrics);
          if (parsed.lines.length > 0) {
            setLyricsLines(parsed.lines);
            setLyricsSynced(parsed.synced);
            setLyricsSource(res.source || (parsed.synced ? 'Synchronized LRC Lyrics' : 'Catalog Lyrics'));
          }
        }
      })
      .catch(() => {
        // Keep existing state or empty state on network error
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingLyrics(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.videoId]);

  // Compute active lyric line index from real playback time
  const activeLyricIndex = useMemo(() => {
    if (!lyricsSynced || lyricsLines.length === 0) return -1;
    let activeIdx = -1;
    for (let i = 0; i < lyricsLines.length; i++) {
      const lineTime = lyricsLines[i].time;
      if (lineTime !== null && currentTime + 0.15 >= lineTime) {
        activeIdx = i;
      } else if (lineTime !== null && currentTime + 0.15 < lineTime) {
        break;
      }
    }
    return activeIdx;
  }, [lyricsSynced, lyricsLines, currentTime]);

  // Synchronize lyrics scrolling with playback time and mode switches
  useEffect(() => {
    if (!isOpen || activeTab !== 'lyrics' || activeLyricIndex < 0) return;
    const activeEl = lyricItemRefs.current[activeLyricIndex];
    const container = lyricsContainerRef.current;
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const offsetWithinContainer = activeRect.top - containerRect.top + container.scrollTop;
      const targetScrollTop = offsetWithinContainer - container.clientHeight / 2 + activeRect.height / 2;
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    }
  }, [activeLyricIndex, activeTab, isOpen]);

  // Waveform bar heights for the Audio tab seekbar
  const waveformBars = useMemo(() => {
    if (!currentTrack) return [];
    const seed = currentTrack.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array.from({ length: 56 }, (_, idx) => {
      const val = Math.sin(seed + idx * 0.45) * 0.5 + 0.5;
      return Math.max(18, Math.min(95, Math.round(val * 85 + 12)));
    });
  }, [currentTrack?.id]);

  // Related tracks
  const relatedTracks = useMemo(() => {
    if (!currentTrack) return [];
    return allTracks
      .filter(
        (t) =>
          t.id !== currentTrack.id &&
          (t.genre === currentTrack.genre || t.artistId === currentTrack.artistId)
      )
      .slice(0, 6);
  }, [currentTrack, allTracks]);

  if (!currentTrack) return null;

  const formatTime = (sec: number) => {
    const safeSec = Number.isFinite(sec) && sec >= 0 ? sec : 0;
    const m = Math.floor(safeSec / 60);
    const s = Math.floor(safeSec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const effectiveDuration = duration > 0 ? duration : currentTrack.duration || 180;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;

  const hasVideoStream = Boolean(currentTrack.videoUrl && !videoLoadError);
  const hasAudioStream = Boolean(currentTrack.audioUrl || hasVideoStream);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    const text = commentInput.trim();
    setCommentInput('');
    try {
      const saved = await api.postTrackComment(currentTrack.id, text);
      if (saved) {
        setComments((prev) => [saved, ...prev]);
      }
    } catch {
      setComments((prev) => [
        { id: `c-${Date.now()}`, user: 'You', text, time: 'Just now' },
        ...prev,
      ]);
    }
  };

  const tabItems: Array<{ id: PlayerTabMode; label: string; icon: React.ReactNode }> = [
    { id: 'audio', label: 'Audio', icon: <Headphones className="w-4 h-4 sm:w-5 sm:h-5" /> },
    { id: 'video', label: 'Video', icon: <Video className="w-4 h-4 sm:w-5 sm:h-5" /> },
    { id: 'lyrics', label: 'Lyrics', icon: <FileText className="w-4 h-4 sm:w-5 sm:h-5" /> },
  ];

  return (
    <div
      aria-hidden={!isOpen}
      className={
        isOpen
          ? 'fixed inset-0 z-[70] bg-zinc-950/95 backdrop-blur-3xl flex flex-col overflow-y-auto animate-in fade-in duration-200 select-none'
          : 'fixed -left-[9999px] top-0 w-px h-px overflow-hidden opacity-0 pointer-events-none'
      }
    >
      {/* Dynamic Ambient Backdrop */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <img
          src={resolveArtworkUrl(currentTrack.coverUrl, 'track', currentTrack.title)}
          alt=""
          onError={(e) => handleImageError(e, currentTrack.title, 'track')}
          className="w-full h-full object-cover opacity-20 blur-[110px] scale-125"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-zinc-950/90 to-zinc-950" />
      </div>

      {/* Top Navigation & Three Icon-Only Mode Tabs (Audio, Video, Lyrics) */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/5 shrink-0">
        <button
          onClick={onClose}
          title="Minimize Player"
          aria-label="Minimize Player"
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-all border border-white/10 cursor-pointer"
        >
          <ChevronDown className="w-5 h-5" />
          <span className="text-xs font-semibold hidden sm:inline">Minimize</span>
        </button>

        {/* Strictly Three Icon-Only Tabs: Audio, Video, Lyrics */}
        <div
          role="tablist"
          aria-label="Player mode tabs"
          className="flex items-center gap-1.5 bg-zinc-900/90 p-1.5 rounded-2xl border border-white/10 shadow-xl"
        >
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                title={tab.label}
                onClick={() => onSelectTab(tab.id)}
                className={`relative group/tab p-2.5 sm:px-4 sm:py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                  isActive
                    ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/25 scale-[1.02]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.icon}
                <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-zinc-900 text-white text-[11px] font-semibold tracking-wide whitespace-nowrap opacity-0 group-hover/tab:opacity-100 transition-opacity border border-white/10 shadow-lg z-30">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right spacer / Queue button to keep the three icon-only tabs centered */}
        <div className="flex items-center justify-end w-10 sm:w-24">
          <button
            onClick={onToggleQueue}
            title="Queue"
            aria-label="Queue"
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              isQueueOpen
                ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-semibold'
                : 'bg-white/5 border-white/10 text-zinc-300 hover:text-white'
            }`}
          >
            <ListMusic className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Player Content Grid */}
      <div className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left/Center Column (7 cols): Active Tab Stage (Audio, Video, or Lyrics) + Unified Transport Controls */}
        <div className="lg:col-span-7 flex flex-col items-center w-full">
          {/* Persistent Unified Stage Container */}
          <div className="w-full max-w-md sm:max-w-lg mb-6 relative">
            {/* Persistent Real HTML5 Video Element (Shared with soundEngine, never unmounted during tab switches) */}
            <div
              role="tabpanel"
              aria-label="Video"
              className={
                activeTab === 'video'
                  ? 'w-full aspect-video rounded-3xl overflow-hidden bg-zinc-900 border border-white/15 shadow-2xl relative flex items-center justify-center'
                  : 'hidden'
              }
            >
              <video
                ref={videoRef}
                playsInline
                preload="metadata"
                poster={resolveArtworkUrl(currentTrack.coverUrl, 'track', currentTrack.title)}
                onClick={onPlayPause}
                onError={() => setVideoLoadError(true)}
                className={
                  hasVideoStream
                    ? 'w-full h-full object-contain bg-black cursor-pointer'
                    : 'hidden'
                }
              />

              {hasVideoStream ? (
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 pointer-events-none">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                    }`}
                  />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white">
                    Synchronized Video Stream
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 sm:p-8 max-w-sm">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-zinc-400">
                    <Video className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">
                    No video available for this track
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    This track does not have an uploaded video stream in the catalog. Audio playback continues uninterrupted.
                  </p>
                </div>
              )}
            </div>

            {/* Tab 1: Audio View */}
            {activeTab === 'audio' && (
              <div
                role="tabpanel"
                aria-label="Audio"
                className="w-full aspect-square max-w-md mx-auto rounded-3xl overflow-hidden shadow-2xl border border-white/15 relative group bg-zinc-900"
              >
                <img
                  src={resolveArtworkUrl(currentTrack.coverUrl, 'track', currentTrack.title)}
                  alt={currentTrack.title}
                  onError={(e) => handleImageError(e, currentTrack.title, 'track')}
                  className={`w-full h-full object-cover transition-transform duration-700 ${
                    isPlaying ? 'scale-105' : 'scale-100'
                  }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> {currentTrack.genre?.toUpperCase() || 'AUDIO'}
                  </span>
                  {isDownloadedOffline ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Offline Ready
                    </span>
                  ) : currentTrack.country ? (
                    <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-zinc-300">
                      Region: {currentTrack.country}
                    </span>
                  ) : null}
                </div>

                {!hasAudioStream && (
                  <div className="absolute inset-x-4 bottom-4 p-3 rounded-2xl bg-zinc-950/90 backdrop-blur-md border border-amber-500/30 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-200 font-medium">
                      No audio file is currently linked to this catalog record.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Synchronized Lyrics View */}
            {activeTab === 'lyrics' && (
              <div
                role="tabpanel"
                aria-label="Lyrics"
                className="w-full h-[340px] sm:h-[400px] rounded-3xl bg-zinc-900/90 border border-white/15 shadow-2xl flex flex-col overflow-hidden"
              >
                <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-zinc-950/60 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 truncate">
                      {lyricsSynced
                        ? 'Time-Synced Lyrics'
                        : lyricsLines.length > 0
                        ? 'Track Lyrics'
                        : 'Lyrics'}
                    </span>
                  </div>
                  {lyricsSource && (
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {lyricsSynced ? 'LRC Synced' : 'Plain Text'}
                    </span>
                  )}
                </div>

                <div
                  ref={lyricsContainerRef}
                  className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 space-y-3 scroll-smooth"
                >
                  {loadingLyrics && lyricsLines.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                      <Loader2 className="w-7 h-7 text-emerald-400 animate-spin mb-2.5" />
                      <p className="text-xs text-zinc-400">Loading real track lyrics...</p>
                    </div>
                  ) : lyricsLines.length > 0 ? (
                    lyricsLines.map((line, idx) => {
                      const isCurrent = lyricsSynced && idx === activeLyricIndex;
                      const isPast = lyricsSynced && activeLyricIndex > idx;
                      const isTimed = line.time !== null && line.time >= 0;

                      return (
                        <div
                          key={`${idx}-${line.time ?? 'u'}`}
                          ref={(el) => {
                            lyricItemRefs.current[idx] = el;
                          }}
                          onClick={() => {
                            if (isTimed && line.time !== null) {
                              onSeek(line.time);
                            }
                          }}
                          className={`p-3 rounded-2xl transition-all duration-200 ${
                            isTimed ? 'cursor-pointer' : ''
                          } ${
                            isCurrent
                              ? 'bg-emerald-500/15 border border-emerald-500/35 text-white scale-[1.01] shadow-lg'
                              : isPast
                              ? 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                              : lyricsSynced
                              ? 'text-zinc-300 hover:text-white hover:bg-white/5'
                              : 'text-zinc-200 leading-relaxed'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p
                              className={`text-sm sm:text-base font-semibold leading-snug ${
                                isCurrent ? 'text-emerald-300 font-bold' : ''
                              }`}
                            >
                              {line.text}
                            </p>
                            {isTimed && line.time !== null && (
                              <span
                                className={`text-[10px] font-mono shrink-0 mt-0.5 ${
                                  isCurrent ? 'text-emerald-400 font-bold' : 'text-zinc-500'
                                }`}
                              >
                                {formatTime(line.time)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-zinc-500">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">
                        No lyrics available for this track
                      </h4>
                      <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                        Verified lyrics or timestamped LRC files have not been uploaded for this song yet.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Track Title, Artist & Primary Action Row */}
          <div className="w-full max-w-md sm:max-w-lg mb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
                    {currentTrack.title}
                  </h1>
                  {currentTrack.isExplicit && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-zinc-800 text-zinc-300 rounded uppercase shrink-0">
                      Explicit
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    onSelectArtist(currentTrack.artistId);
                    onClose();
                  }}
                  className="text-base text-emerald-400 hover:text-emerald-300 font-medium transition-colors text-left truncate block cursor-pointer"
                >
                  {currentTrack.artist} • <span className="text-zinc-400">{currentTrack.album}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onToggleLike(currentTrack.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isLiked
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                  title={isLiked ? 'Liked' : 'Like Track'}
                  aria-label={isLiked ? 'Liked' : 'Like Track'}
                >
                  <Heart className={`w-5 h-5 ${isLiked ? 'fill-rose-500' : ''}`} />
                </button>
                <button
                  onClick={() => onDislike(currentTrack.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isDisliked
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                  title="Dislike"
                  aria-label="Dislike"
                >
                  <ThumbsDown className={`w-5 h-5 ${isDisliked ? 'fill-amber-400' : ''}`} />
                </button>
                <button
                  onClick={() => setShowComments(!showComments)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    showComments
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                  title="Track Comments"
                  aria-label="Track Comments"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>
                {nativePlatform.canDownloadTrack(currentTrack) && (
                  <button
                    onClick={async () => {
                      if (downloadPct !== null) return;
                      if (isDownloadedOffline) {
                        await nativePlatform.removeOfflineTrack(currentTrack.id);
                        return;
                      }
                      setDownloadPct(1);
                      try {
                        await nativePlatform.downloadTrackForOffline(currentTrack, (p) => setDownloadPct(p));
                      } catch {} finally {
                        setDownloadPct(null);
                      }
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isDownloadedOffline
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                    title={isDownloadedOffline ? 'Downloaded for Offline Listening (Click to Remove)' : 'Download for Offline Listening'}
                    aria-label={isDownloadedOffline ? 'Downloaded for Offline Listening' : 'Download for Offline Listening'}
                  >
                    {downloadPct !== null ? (
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                    ) : isDownloadedOffline ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => onOpenShare(currentTrack)}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
                  title="Share Track"
                  aria-label="Share Track"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Waveform / Seekbar */}
          <div className="w-full max-w-md sm:max-w-lg mb-6">
            <div
              className="relative h-10 flex items-center gap-[2px] cursor-pointer group mb-1.5"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                onSeek(clickRatio * effectiveDuration);
              }}
            >
              {waveformBars.map((height, idx) => {
                const barPercent = (idx / waveformBars.length) * 100;
                const isPlayed = barPercent <= progressPercent;
                return (
                  <div
                    key={idx}
                    className={`flex-1 rounded-full transition-colors duration-150 ${
                      isPlayed
                        ? 'bg-gradient-to-t from-emerald-500 to-cyan-400'
                        : 'bg-white/15 group-hover:bg-white/25'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                );
              })}
              <input
                type="range"
                min={0}
                max={effectiveDuration}
                step={0.1}
                value={Math.min(currentTime, effectiveDuration)}
                onChange={(e) => onSeek(Number(e.target.value))}
                aria-label="Seek playback position"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>

          {/* Transport Controls & Unified Volume Slider */}
          <div className="w-full max-w-md sm:max-w-lg flex items-center justify-between gap-4 mb-6">
            <button
              onClick={onToggleShuffle}
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                isShuffle
                  ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Shuffle"
              aria-label="Shuffle"
            >
              <Shuffle className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-5">
              <button
                onClick={onPrev}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all cursor-pointer"
                title="Previous Track"
                aria-label="Previous Track"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>

              <button
                onClick={onPlayPause}
                className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 flex items-center justify-center shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current ml-1" />
                )}
              </button>

              <button
                onClick={onNext}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all cursor-pointer"
                title="Next Track"
                aria-label="Next Track"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>
            </div>

            <button
              onClick={onToggleRepeat}
              className={`relative p-2.5 rounded-xl transition-all cursor-pointer ${
                repeatMode !== 'off'
                  ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
              aria-label={`Repeat: ${repeatMode}`}
            >
              <Repeat className="w-5 h-5" />
              {repeatMode === 'one' && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-zinc-950 text-[9px] font-black flex items-center justify-center">
                  1
                </span>
              )}
            </button>
          </div>

          {/* Unified Volume Bar (Works on both Mobile & Desktop) */}
          <div className="w-full max-w-md sm:max-w-lg flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <button
              onClick={onToggleMute}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
              aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="Volume"
              className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="text-[11px] font-mono text-zinc-400 w-9 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>

        {/* Right Column (5 cols): Track Details, Artist Card, Comments & Related Songs */}
        <div className="lg:col-span-5 w-full space-y-6">
          {/* Comments Drawer if toggled */}
          {showComments && (
            <div className="p-5 rounded-3xl bg-zinc-900/80 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" /> Listener Comments ({comments.length})
                </h3>
                <button
                  onClick={() => setShowComments(false)}
                  className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Close
                </button>
              </div>
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Share your thoughts on this track..."
                  className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
              <div className="max-h-52 overflow-y-auto space-y-2.5 pr-1">
                {loadingComments ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">Loading comments...</p>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="p-2.5 rounded-xl bg-zinc-950/60 border border-white/5">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-emerald-400">{c.user}</span>
                        <span className="text-zinc-500">{c.time}</span>
                      </div>
                      <p className="text-xs text-zinc-300">{c.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Artist Card */}
          <div className="p-5 rounded-3xl bg-zinc-900/70 border border-white/10 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={resolveArtworkUrl(
                    artistProfile?.avatarUrl || currentTrack.coverUrl,
                    'artist',
                    currentTrack.artist
                  )}
                  alt={currentTrack.artist}
                  onError={(e) => handleImageError(e, currentTrack.artist, 'artist')}
                  className="w-12 h-12 rounded-2xl object-cover border border-white/10 shrink-0"
                />
                <div className="min-w-0">
                  <h3
                    onClick={() => {
                      onSelectArtist(currentTrack.artistId);
                      onClose();
                    }}
                    className="text-sm font-bold text-white hover:text-emerald-400 transition-colors truncate cursor-pointer flex items-center gap-1.5"
                  >
                    {currentTrack.artist}
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {artistProfile?.monthlyListeners
                      ? `${formatCompactNumber(artistProfile.monthlyListeners)} Monthly Listeners`
                      : artistProfile?.followers
                      ? `${formatCompactNumber(artistProfile.followers)} Followers`
                      : 'Verified Catalog Artist'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onToggleFollowArtist(currentTrack.artistId)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  isFollowingArtist
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white text-zinc-950 hover:bg-emerald-400'
                }`}
              >
                {isFollowingArtist ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5" /> Following
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" /> Follow
                  </>
                )}
              </button>
            </div>

            {artistProfile?.bio && (
              <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                {artistProfile.bio}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center">
              <div className="p-2 rounded-xl bg-zinc-950/60">
                <p className="text-[10px] text-zinc-500 uppercase">Flontmie Plays</p>
                <p className="text-xs font-bold text-white mt-0.5">
                  {formatCompactNumber(currentTrack.flontmiePlays ?? currentTrack.streams ?? 0)}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/60">
                <p className="text-[10px] text-zinc-500 uppercase">Likes</p>
                <p className="text-xs font-bold text-white mt-0.5">
                  {formatCompactNumber(currentTrack.likes || 0)}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/60">
                <p className="text-[10px] text-zinc-500 uppercase">Media</p>
                <p className="text-xs font-bold text-emerald-400 mt-0.5">
                  {hasVideoStream ? 'Audio + Video' : 'Audio'}
                </p>
              </div>
            </div>
          </div>

          {/* Related Songs */}
          {relatedTracks.length > 0 && (
            <div className="p-5 rounded-3xl bg-zinc-900/70 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" /> Related Tracks
                </h3>
              </div>
              <div className="space-y-2">
                {relatedTracks.map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => onPlayTrack(rel)}
                    className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={resolveArtworkUrl(rel.coverUrl, 'track', rel.title)}
                        alt={rel.title}
                        onError={(e) => handleImageError(e, rel.title, 'track')}
                        className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white group-hover:text-emerald-400 truncate">
                          {rel.title}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate">{rel.artist}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                      {formatTime(rel.duration)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
