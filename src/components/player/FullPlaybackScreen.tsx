import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Heart,
  ThumbsDown,
  Share2,
  Volume2,
  VolumeX,
  Send,
  UserPlus,
  UserCheck,
  ExternalLink,
  AlertCircle,
  Loader2,
  Download,
  CheckCircle2,
  ListPlus,
  X,
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
  onOpenAddToPlaylist?: (track: Track) => void;
  onPlayTrack: (track: Track) => void;
  onSelectArtist: (artistId: string) => void;
  currentUser?: { id: string; email: string; display_name?: string; username?: string; role?: string } | null;
  onRequireAuth?: (reason?: string) => void;
  onCommentCountChange?: (trackId: string, count: number) => void;
  onLikeCountReconcile?: (trackId: string, count: number) => void;
}

export const FullPlaybackScreen: React.FC<FullPlaybackScreenProps> = ({
  isOpen,
  onClose,
  currentTrack,
  artistProfile,
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
  onOpenAddToPlaylist,
  onSelectArtist,
  currentUser,
  onRequireAuth,
  onCommentCountChange,
  onLikeCountReconcile,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [comments, setComments] = useState<Array<{ id: string; user: string; text: string; time: string; user_id?: string }>>([]);
  const [commentsCountState, setCommentsCountState] = useState<number>(0);
  const [loadingComments, setLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Real lyrics state (from track or loaded from backend)
  const [lyricsLines, setLyricsLines] = useState<LyricLine[]>([]);
  const [lyricsSynced, setLyricsSynced] = useState<boolean>(false);
  const [loadingLyrics, setLoadingLyrics] = useState<boolean>(false);

  // Real media availability / error state
  const [videoLoadError, setVideoLoadError] = useState<boolean>(false);
  const [isDownloadedOffline, setIsDownloadedOffline] = useState<boolean>(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
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

  // Load and synchronize real comments and counts for current track
  useEffect(() => {
    if (!currentTrack) {
      setComments([]);
      setCommentsCountState(0);
      return;
    }
    setCommentsCountState(Number(currentTrack.commentsCount ?? 0));
    setCommentError(null);

    let isMounted = true;
    const fetchCommentsAndCounts = (showSpinner: boolean) => {
      if (showSpinner) setLoadingComments(true);
      api
        .getTrackCommentsWithMeta(currentTrack.id)
        .then((res) => {
          if (!isMounted) return;
          const list = Array.isArray(res.comments) ? res.comments : [];
          const authCount = typeof res.comments_count === 'number' ? res.comments_count : list.length;
          setComments(list);
          setCommentsCountState(authCount);
          if (onCommentCountChange) {
            onCommentCountChange(currentTrack.id, authCount);
          }
          if (typeof res.likes_count === 'number' && onLikeCountReconcile) {
            onLikeCountReconcile(currentTrack.id, res.likes_count);
          }
        })
        .catch(() => {
          if (isMounted && showSpinner) setComments([]);
        })
        .finally(() => {
          if (isMounted && showSpinner) setLoadingComments(false);
        });
    };

    fetchCommentsAndCounts(true);

    // Poll when player or comments sheet is open so new comments/likes from other devices appear
    let pollTimer: any = null;
    if (isOpen || showComments) {
      pollTimer = setInterval(() => fetchCommentsAndCounts(false), 8000);
    }

    return () => {
      isMounted = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [currentTrack?.id, isOpen, showComments]);

  // Load real lyrics for current track (from track record or backend endpoint, never inventing lyrics/timestamps)
  useEffect(() => {
    if (!currentTrack) {
      setLyricsLines([]);
      setLyricsSynced(false);
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
      setLoadingLyrics(false);
      return;
    }

    if (initialLines.length > 0) {
      setLyricsLines(initialLines);
      setLyricsSynced(false);
    } else if (currentTrack.rawLyrics && currentTrack.rawLyrics.trim().length > 0) {
      const parsedRaw = api.parseLyricsText(currentTrack.rawLyrics);
      setLyricsLines(parsedRaw.lines);
      setLyricsSynced(parsedRaw.synced);
    } else {
      setLyricsLines([]);
      setLyricsSynced(false);
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

  if (!currentTrack) return null;

  const effectiveDuration = duration > 0 ? duration : currentTrack.duration || 180;
  const progressPercent =
    effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;

  const hasVideoStream = Boolean(currentTrack.videoUrl && !videoLoadError);
  const hasAudioStream = Boolean(currentTrack.audioUrl || hasVideoStream);

  // Release type derived from real track metadata
  const releaseTypeLabel = (() => {
    const alb = (currentTrack.album || '').trim();
    if (!alb || alb.toLowerCase() === 'single' || alb.toLowerCase() === currentTrack.title.trim().toLowerCase()) {
      return 'Single';
    }
    if (alb.toLowerCase() === 'ep' || alb.toLowerCase().endsWith(' ep')) {
      return 'EP';
    }
    return alb;
  })();

  const handleToggleOfflineDownload = async () => {
    if (downloadPct !== null) return;
    if (isDownloadedOffline) {
      await nativePlatform.removeOfflineTrack(currentTrack.id);
      return;
    }
    setDownloadPct(1);
    try {
      await nativePlatform.downloadTrackForOffline(currentTrack, (p) => setDownloadPct(p));
    } catch {
      // Handled gracefully
    } finally {
      setDownloadPct(null);
    }
  };

  const handleToggleVideoFullscreen = () => {
    const vid = videoRef.current as any;
    const container = videoContainerRef.current as any;
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else if (vid && typeof vid.requestFullscreen === 'function') {
        vid.requestFullscreen().catch(() => {});
      } else if (vid && typeof vid.webkitEnterFullscreen === 'function') {
        vid.webkitEnterFullscreen();
      } else if (container && typeof container.requestFullscreen === 'function') {
        container.requestFullscreen().catch(() => {});
      }
    } catch {}
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError(null);
    const text = commentInput.trim();
    if (!text || isSubmittingComment) return;

    if (!currentUser || !api.getToken()) {
      setCommentError('Please sign in to post a comment.');
      if (onRequireAuth) {
        onRequireAuth('Please sign in to post a comment on this track.');
      }
      return;
    }

    const prevComments = comments;
    const prevCount = Math.max(Number(currentTrack.commentsCount ?? 0), commentsCountState, comments.length);
    const optimisticCount = prevCount + 1;
    const tempId = `temp-${Date.now()}`;
    const optimisticComment = {
      id: tempId,
      user: currentUser.display_name || currentUser.username || 'You',
      text,
      time: 'Just now',
      user_id: currentUser.id,
    };

    // Optimistic UI update
    setCommentInput('');
    setIsSubmittingComment(true);
    setComments((prev) => [optimisticComment, ...prev]);
    setCommentsCountState(optimisticCount);
    if (onCommentCountChange) {
      onCommentCountChange(currentTrack.id, optimisticCount);
    }

    try {
      const saved = await api.postTrackComment(currentTrack.id, text);
      if (saved) {
        const confirmedCount =
          typeof saved.comments_count === 'number' ? saved.comments_count : optimisticCount;
        setComments((prev) =>
          prev.map((c) =>
            c.id === tempId
              ? {
                  id: saved.id,
                  user: saved.user,
                  text: saved.text,
                  time: saved.time,
                  user_id: currentUser.id,
                }
              : c
          )
        );
        setCommentsCountState(confirmedCount);
        if (onCommentCountChange) {
          onCommentCountChange(saved.track_id || currentTrack.id, confirmedCount);
        }
      } else {
        throw new Error('Server did not confirm comment creation.');
      }
    } catch (err: any) {
      // Roll back optimistic state and display error
      setComments(prevComments);
      setCommentsCountState(prevCount);
      if (onCommentCountChange) {
        onCommentCountChange(currentTrack.id, prevCount);
      }
      setCommentInput(text);
      setCommentError(err?.message || 'Failed to post comment. Please try again.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setCommentError(null);
    const prevComments = comments;
    const prevCount = Math.max(Number(currentTrack.commentsCount ?? 0), commentsCountState, comments.length);
    const nextComments = comments.filter((c) => c.id !== commentId);
    const optimisticCount = Math.max(0, prevCount - 1);

    setComments(nextComments);
    setCommentsCountState(optimisticCount);
    if (onCommentCountChange) {
      onCommentCountChange(currentTrack.id, optimisticCount);
    }

    try {
      const res = await api.deleteTrackComment(commentId);
      const confirmedCount =
        typeof res.comments_count === 'number' ? res.comments_count : nextComments.length;
      setCommentsCountState(confirmedCount);
      if (onCommentCountChange) {
        onCommentCountChange(res.track_id || currentTrack.id, confirmedCount);
      }
    } catch (err: any) {
      setComments(prevComments);
      setCommentsCountState(prevCount);
      if (onCommentCountChange) {
        onCommentCountChange(currentTrack.id, prevCount);
      }
      setCommentError(err?.message || 'Unable to delete comment.');
    }
  };

  const tabItems: Array<{ id: PlayerTabMode; label: string; icon: React.ReactNode }> = [
    {
      id: 'audio',
      label: 'Audio',
      icon: (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'video',
      label: 'Video',
      icon: (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor">
          <path d="M4 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2.586l3.293-2.293A1 1 0 0 1 21 7.11v9.78a1 1 0 0 1-1.707.817L16 15.414V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm4.5 3.5v5l4-2.5-4-2.5z" />
        </svg>
      ),
    },
    {
      id: 'lyrics',
      label: 'Lyrics',
      icon: (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" strokeWidth="2.2" />
          <path d="M11 13V7l4-1v4" strokeWidth="2" />
          <circle cx="9.5" cy="13" r="1.5" fill="currentColor" />
          <line x1="8" y1="17" x2="16" y2="17" strokeWidth="2" />
          <line x1="8" y1="19.5" x2="14" y2="19.5" strokeWidth="1.8" />
        </svg>
      ),
    },
  ];

  const effectiveLikesCount = Math.max(0, Number(currentTrack.likes ?? 0));
  const effectiveCommentsCount = Math.max(
    0,
    Number(currentTrack.commentsCount ?? 0),
    commentsCountState,
    comments.length
  );
  const formattedLikes = effectiveLikesCount > 0 ? formatCompactNumber(effectiveLikesCount) : '0';
  const formattedComments = effectiveCommentsCount > 0 ? formatCompactNumber(effectiveCommentsCount) : '0';

  return (
    <div
      aria-hidden={!isOpen}
      className={
        isOpen
          ? 'fixed inset-0 z-[70] bg-black text-white flex flex-col overflow-y-auto animate-in fade-in duration-200 select-none'
          : 'fixed -left-[9999px] top-0 w-px h-px overflow-hidden opacity-0 pointer-events-none'
      }
    >
      {/* Centered Responsive Player Column Matching Reference Proportions */}
      <div className="w-full max-w-[430px] sm:max-w-[460px] mx-auto flex-1 flex flex-col justify-between px-6 sm:px-7 pt-4 pb-7 min-h-full">
        {/* TOP BAR: Back button on left, centered rounded three-mode icon-only switch, queue button on right */}
        <div className="flex items-center justify-between w-full shrink-0">
          <button
            onClick={onClose}
            title="Back"
            aria-label="Back"
            className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center text-white hover:opacity-75 active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-8 h-8 stroke-[2.5]" />
          </button>

          {/* Centered White Rounded Capsule Three-Mode Switch (Icons Only) */}
          <div
            role="tablist"
            aria-label="Player mode switch"
            className="bg-white rounded-full p-1 flex items-center gap-1 shadow-md"
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
                  className={`min-w-[42px] h-7 px-3 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#737373] text-black shadow-inner'
                      : 'bg-transparent text-black hover:bg-black/10'
                  }`}
                >
                  {tab.icon}
                </button>
              );
            })}
          </div>

          {/* Right: Queue Button */}
          <button
            onClick={onToggleQueue}
            title="Queue"
            aria-label="Queue"
            className={`min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center transition-all cursor-pointer ${
              isQueueOpen ? 'text-white opacity-100 scale-105' : 'text-white hover:opacity-75'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="19" y2="6" />
              <line x1="3" y1="11" x2="13" y2="11" />
              <line x1="3" y1="16" x2="11" y2="16" />
              <path d="M17 18V9l4-1v3" />
              <circle cx="15" cy="18" r="2" fill="currentColor" />
            </svg>
          </button>
        </div>

        {/* CENTER CONTENT STAGE: Audio Artwork, Video Player, or Synchronized Lyrics */}
        <div className="w-full flex-1 flex flex-col items-center justify-center my-4 min-h-[300px] sm:min-h-[350px] relative">
          {/* Persistent Video Stage (Never unmounted so audioEngine video element stays synchronized) */}
          <div
            ref={videoContainerRef}
            role="tabpanel"
            aria-label="Video"
            className={
              activeTab === 'video'
                ? 'w-full aspect-[16/10] bg-neutral-950 overflow-hidden relative flex items-center justify-center shadow-2xl'
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
                  ? 'w-full h-full object-cover bg-black cursor-pointer'
                  : 'hidden'
              }
            />

            {hasVideoStream ? (
              <button
                type="button"
                onClick={handleToggleVideoFullscreen}
                title="Fullscreen Video"
                aria-label="Fullscreen Video"
                className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-md bg-black/50 hover:bg-black/75 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6 max-w-xs">
                <p className="text-sm font-bold text-white mb-1">
                  No video available for this track
                </p>
                <p className="text-xs text-white/50 leading-relaxed">
                  An official video file has not been uploaded for this song. Audio playback continues uninterrupted.
                </p>
              </div>
            )}
          </div>

          {/* Audio Mode: Large Square Album Artwork Centered on Screen */}
          {activeTab === 'audio' && (
            <div
              role="tabpanel"
              aria-label="Audio"
              className="w-full aspect-square max-w-[330px] sm:max-w-[360px] mx-auto overflow-hidden bg-neutral-900 relative shadow-2xl"
            >
              <img
                src={resolveArtworkUrl(currentTrack.coverUrl, 'track', currentTrack.title)}
                alt={currentTrack.title}
                onError={(e) => handleImageError(e, currentTrack.title, 'track')}
                className="w-full h-full object-cover"
              />
              {!hasAudioStream && (
                <div className="absolute inset-x-3 bottom-3 p-2.5 rounded-xl bg-black/85 border border-white/15 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-[11px] text-white/90 font-medium">
                    No audio stream uploaded for this track.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Lyrics Mode: Real Timestamped Lyrics in Same Content Area */}
          {activeTab === 'lyrics' && (
            <div
              role="tabpanel"
              aria-label="Lyrics"
              className="w-full h-[320px] sm:h-[360px] max-w-[330px] sm:max-w-[360px] mx-auto relative flex flex-col justify-center overflow-hidden"
            >
              {/* Top & Bottom Fade Gradients Matching Screenshot */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black via-black/70 to-transparent z-10" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black via-black/70 to-transparent z-10" />

              <div
                ref={lyricsContainerRef}
                className="flex-1 overflow-y-auto no-scrollbar py-10 space-y-5 scroll-smooth"
              >
                {loadingLyrics && lyricsLines.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
                    <Loader2 className="w-6 h-6 text-white animate-spin mb-2" />
                    <p className="text-xs text-white/60 font-semibold">Loading lyrics...</p>
                  </div>
                ) : lyricsLines.length > 0 ? (
                  lyricsLines.map((line, idx) => {
                    const isCurrent = lyricsSynced ? idx === activeLyricIndex : false;
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
                        className={`transition-all duration-200 ${
                          isTimed ? 'cursor-pointer' : ''
                        }`}
                      >
                        <p
                          className={`text-lg sm:text-[21px] font-extrabold leading-[1.3] tracking-tight transition-colors duration-200 ${
                            lyricsSynced
                              ? isCurrent
                                ? 'text-white'
                                : 'text-white/45 hover:text-white/75'
                              : 'text-white/90'
                          }`}
                        >
                          {line.text}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <p className="text-base font-extrabold text-white mb-1">
                      No lyrics available
                    </p>
                    <p className="text-xs text-white/50 max-w-xs leading-relaxed">
                      Synchronized or plain-text lyrics have not been uploaded for this song yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM SECTION: Track Info + Engagement Row + Progress Bar + Transport Controls */}
        <div className="w-full shrink-0">
          {/* Track Information: Song Title on Left, Artist Name on Right, Release Type Beneath Title */}
          <div className="w-full flex items-baseline justify-between gap-4 mb-7">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-[23px] font-extrabold text-white tracking-tight leading-tight truncate">
                {currentTrack.title}
              </h1>
              <p className="text-[11px] sm:text-xs font-extrabold text-white/90 mt-0.5 truncate">
                {releaseTypeLabel}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                onSelectArtist(currentTrack.artistId);
                onClose();
              }}
              className="text-base sm:text-lg font-extrabold text-white hover:opacity-80 transition-opacity truncate max-w-[45%] text-right shrink-0 cursor-pointer"
            >
              {currentTrack.artist}
            </button>
          </div>

          {/* Engagement Row: Like count, comments, download, share, and additional-actions as compact rounded pills */}
          <div className="w-full flex items-center justify-between gap-1.5 sm:gap-2 mb-5">
            {/* 1. Likes Pill */}
            <button
              type="button"
              onClick={() => onToggleLike(currentTrack.id)}
              title={isLiked ? 'Unlike Track' : 'Like Track'}
              aria-label={isLiked ? 'Unlike Track' : 'Like Track'}
              className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-full bg-[#767676] hover:bg-[#888888] active:scale-95 transition-all flex items-center justify-center gap-1.5 text-white text-xs sm:text-[13px] font-semibold cursor-pointer shrink-0"
            >
              <Heart
                className={`w-4 h-4 ${
                  isLiked ? 'text-[#ff2b2b] fill-[#ff2b2b] scale-110' : 'text-[#ff2b2b] fill-[#ff2b2b]'
                }`}
              />
              <span>{formattedLikes}</span>
            </button>

            {/* 2. Comments Pill */}
            <button
              type="button"
              onClick={() => setShowComments(true)}
              title="Comments"
              aria-label="Comments"
              className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-full bg-[#767676] hover:bg-[#888888] active:scale-95 transition-all flex items-center justify-center gap-1.5 text-white text-xs sm:text-[13px] font-semibold cursor-pointer shrink-0"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
                <path d="M12 3C6.477 3 2 6.69 2 11.243c0 2.046.91 3.92 2.42 5.365-.15 1.246-.68 2.66-1.35 3.55-.19.25.04.6.34.53 1.66-.38 3.44-1.08 4.64-1.78 1.23.38 2.56.58 3.95.58 5.523 0 10-3.69 10-8.245S17.523 3 12 3zm-4 9.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm4 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm4 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
              </svg>
              <span>{formattedComments}</span>
            </button>

            {/* 3. Download Pill */}
            <button
              type="button"
              onClick={handleToggleOfflineDownload}
              title={
                isDownloadedOffline
                  ? 'Downloaded for Offline Listening (Tap to Remove)'
                  : 'Download for Offline Listening'
              }
              aria-label="Download"
              className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-full bg-[#767676] hover:bg-[#888888] active:scale-95 transition-all flex items-center justify-center gap-1.5 text-white text-xs sm:text-[13px] font-semibold cursor-pointer shrink-0"
            >
              {downloadPct !== null ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>{downloadPct}%</span>
                </>
              ) : isDownloadedOffline ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  <span>Downloaded</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-white stroke-[2.3]" />
                  <span>Download</span>
                </>
              )}
            </button>

            {/* 4. Share Pill */}
            <button
              type="button"
              onClick={() => onOpenShare(currentTrack)}
              title="Share"
              aria-label="Share"
              className="h-8 sm:h-9 px-3 rounded-full bg-[#767676] hover:bg-[#888888] active:scale-95 transition-all flex items-center justify-center text-white cursor-pointer shrink-0"
            >
              <Share2 className="w-4 h-4 text-white stroke-[2.2]" />
            </button>

            {/* 5. Additional Actions / Save to Library Pill */}
            <button
              type="button"
              onClick={() => setShowMoreActions(true)}
              title="More Actions"
              aria-label="More Actions"
              className="h-8 sm:h-9 px-3 rounded-full bg-[#767676] hover:bg-[#888888] active:scale-95 transition-all flex items-center justify-center text-white cursor-pointer shrink-0"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="7" y="3" width="14" height="14" rx="2.5" />
                <path d="M17 21H6a3 3 0 0 1-3-3V7" />
                <path d="M13 12V7l3-1v2" />
                <circle cx="11.5" cy="12" r="1.5" fill="currentColor" />
              </svg>
            </button>
          </div>

          {/* Progress Bar with Draggable Position Indicator */}
          <div className="w-full mb-5">
            <div className="relative w-full h-7 flex items-center group cursor-pointer">
              {/* Track Line */}
              <div className="w-full h-[3px] bg-white/85 rounded-full relative">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {/* Draggable Position Indicator Thumb */}
              <div
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)] transition-transform group-hover:scale-110"
                style={{ left: `${progressPercent}%` }}
              />
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
          </div>

          {/* Transport Controls: Shuffle, Previous, Large Play/Pause, Next, Repeat */}
          <div className="w-full flex items-center justify-between px-1">
            {/* Shuffle */}
            <button
              type="button"
              onClick={onToggleShuffle}
              title="Shuffle"
              aria-label="Shuffle"
              className={`relative min-w-[44px] min-h-[44px] flex items-center justify-center transition-all cursor-pointer ${
                isShuffle ? 'text-white opacity-100' : 'text-white/85 hover:text-white'
              }`}
            >
              <Shuffle className="w-6 h-6 stroke-[2.2]" />
              {isShuffle && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>

            {/* Previous */}
            <button
              type="button"
              onClick={onPrev}
              title="Previous"
              aria-label="Previous"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white hover:opacity-80 active:scale-95 transition-all cursor-pointer"
            >
              <SkipBack className="w-8 h-8 fill-white text-white" />
            </button>

            {/* Large Play / Pause Circle */}
            <button
              type="button"
              onClick={onPlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 fill-black text-black" />
              ) : (
                <Play className="w-8 h-8 fill-black text-black ml-1" />
              )}
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={onNext}
              title="Next"
              aria-label="Next"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white hover:opacity-80 active:scale-95 transition-all cursor-pointer"
            >
              <SkipForward className="w-8 h-8 fill-white text-white" />
            </button>

            {/* Repeat */}
            <button
              type="button"
              onClick={onToggleRepeat}
              title={`Repeat: ${repeatMode}`}
              aria-label={`Repeat: ${repeatMode}`}
              className={`relative min-w-[44px] min-h-[44px] flex items-center justify-center transition-all cursor-pointer ${
                repeatMode !== 'off' ? 'text-white opacity-100' : 'text-white/85 hover:text-white'
              }`}
            >
              <Repeat className="w-6 h-6 stroke-[2.2]" />
              {repeatMode === 'one' && (
                <span className="absolute -top-0.5 right-0.5 w-4 h-4 rounded-full bg-white text-black text-[9px] font-black flex items-center justify-center">
                  1
                </span>
              )}
              {repeatMode === 'all' && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* COMMENTS OVERLAY SHEET */}
      {showComments && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setShowComments(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#121212] border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[80vh] flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white">
                Comments ({effectiveCommentsCount})
              </h3>
              <button
                type="button"
                onClick={() => setShowComments(false)}
                className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {commentError && (
              <div className="px-3.5 py-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex items-center justify-between gap-2">
                <span>{commentError}</span>
                <button
                  type="button"
                  onClick={() => setCommentError(null)}
                  className="text-white/70 hover:text-white text-[11px] font-bold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={currentUser ? 'Add a comment...' : 'Sign in to post a comment...'}
                maxLength={1000}
                className="flex-1 bg-black border border-white/15 rounded-full px-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white"
              />
              <button
                type="submit"
                disabled={isSubmittingComment}
                className="px-4 py-2 rounded-full bg-white text-black font-bold text-xs flex items-center gap-1 hover:bg-neutral-200 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSubmittingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {loadingComments ? (
                <p className="text-xs text-white/50 py-6 text-center">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-white/50 py-6 text-center">
                  No comments yet. Be the first to comment on this track.
                </p>
              ) : (
                comments.map((c) => {
                  const canDelete = Boolean(
                    currentUser &&
                      !String(c.id).startsWith('temp-') &&
                      (currentUser.role === 'admin' || (c.user_id && c.user_id === currentUser.id))
                  );
                  return (
                    <div key={c.id} className="p-3 rounded-2xl bg-white/[0.04] border border-white/5">
                      <div className="flex items-center justify-between text-[11px] mb-1 gap-2">
                        <span className="font-bold text-white truncate">{c.user}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-white/40">{c.time}</span>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(c.id)}
                              className="text-[10px] font-semibold text-red-400 hover:text-red-300 cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-white/85 break-words">{c.text}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADDITIONAL ACTIONS OVERLAY SHEET (Add to Playlist, Volume, Follow Artist, Dislike) */}
      {showMoreActions && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setShowMoreActions(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#121212] border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={resolveArtworkUrl(currentTrack.coverUrl, 'track', currentTrack.title)}
                  alt={currentTrack.title}
                  onError={(e) => handleImageError(e, currentTrack.title, 'track')}
                  className="w-10 h-10 rounded-lg object-cover shrink-0 bg-neutral-800"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{currentTrack.title}</h3>
                  <p className="text-xs text-white/60 truncate">
                    {currentTrack.artist} · {releaseTypeLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMoreActions(false)}
                className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-white/[0.04] border border-white/10">
              <button
                type="button"
                onClick={onToggleMute}
                className="text-white hover:opacity-80 transition-opacity cursor-pointer"
                title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
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
                className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <span className="text-xs font-mono text-white/70 w-9 text-right">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-1.5">
              {onOpenAddToPlaylist && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreActions(false);
                    onOpenAddToPlaylist(currentTrack);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <ListPlus className="w-4 h-4 text-white" />
                  <span>Save to Playlist</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onToggleFollowArtist(currentTrack.artistId)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {isFollowingArtist ? (
                    <UserCheck className="w-4 h-4 text-white" />
                  ) : (
                    <UserPlus className="w-4 h-4 text-white" />
                  )}
                  <span>{isFollowingArtist ? `Following ${currentTrack.artist}` : `Follow ${currentTrack.artist}`}</span>
                </div>
                {artistProfile?.followers ? (
                  <span className="text-[11px] text-white/50">
                    {formatCompactNumber(artistProfile.followers)} followers
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMoreActions(false);
                  onSelectArtist(currentTrack.artistId);
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-white" />
                <span>Go to Artist ({currentTrack.artist})</span>
              </button>

              <button
                type="button"
                onClick={() => onDislike(currentTrack.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <ThumbsDown className={`w-4 h-4 ${isDisliked ? 'fill-white text-white' : 'text-white/70'}`} />
                <span>{isDisliked ? 'Disliked' : 'Not Interested / Dislike'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
