import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronDown, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  Volume2, 
  VolumeX, 
  ListMusic, 
  Mic2, 
  Share2, 
  Tv, 
  Music2, 
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Bookmark,
  ListPlus,
  Trash2, 
  ExternalLink, 
  MoveUp, 
  MoveDown,
  X,
  Send
} from 'lucide-react';
import { Track } from '../../types/music';
import { VideoModeCanvas } from './VideoModeCanvas';
import { resolveArtworkUrl, handleImageError } from '../../utils/artwork';
import { formatCompactNumber } from '../../utils/formatters';

interface FullPlaybackScreenProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isVideoMode: boolean;
  isLiked: boolean;
  queue: Track[];
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleVideoMode: () => void;
  onToggleLike: () => void;
  onOpenAddToPlaylist: () => void;
  onShareTrack: () => void;
  onPlayQueueTrack: (track: Track) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  onMoveQueueItem: (from: number, to: number) => void;
  onNavigateToArtist: (artistId: string) => void;
  onNavigateToAlbum?: (albumTitle: string, artistName: string) => void;
}

export const FullPlaybackScreen: React.FC<FullPlaybackScreenProps> = ({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isShuffle,
  repeatMode,
  isVideoMode,
  isLiked,
  queue,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleShuffle,
  onToggleRepeat,
  onToggleVideoMode,
  onToggleLike,
  onOpenAddToPlaylist,
  onShareTrack,
  onPlayQueueTrack,
  onRemoveFromQueue,
  onClearQueue,
  onMoveQueueItem,
  onNavigateToArtist,
  onNavigateToAlbum,
}) => {
  const [activeTab, setActiveTab] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [isHoveringSeek, setIsHoveringSeek] = useState(false);
  const [hoverSeekTime, setHoverSeekTime] = useState(0);
  const [lastVolume, setLastVolume] = useState(volume || 0.85);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentsList, setCommentsList] = useState<Array<{ id: string; user: string; text: string; time: string }>>([
    { id: 'c1', user: 'Kai Mercer', text: 'This production and bassline is unmatched!', time: '12m ago' },
    { id: 'c2', user: 'Nia Adebayo', text: 'On repeat all day, absolutely sublime vibe.', time: '1h ago' },
    { id: 'c3', user: 'Devon Vance', text: 'The transition at the bridge is pure genius.', time: '3h ago' }
  ]);
  const [newCommentText, setNewCommentText] = useState('');
  const activeLyricRef = useRef<HTMLDivElement>(null);

  // Normalize lyrics unconditionally
  const normalizedLyrics: { time: number; text: string }[] = useMemo(() => {
    if (!currentTrack?.lyrics) return [];
    if (Array.isArray(currentTrack.lyrics)) {
      if (currentTrack.lyrics.length === 0) return [];
      if (typeof currentTrack.lyrics[0] === 'string') {
        const strLines = (currentTrack.lyrics as unknown as string[]).filter(Boolean);
        const step = (duration || 180) / Math.max(1, strLines.length);
        return strLines.map((text, i) => ({ time: Math.floor(i * step), text }));
      }
      return currentTrack.lyrics as { time: number; text: string }[];
    }
    if (typeof (currentTrack as any).lyrics === 'string') {
      const rawText = (currentTrack as any).lyrics as string;
      const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
      const step = (duration || 180) / Math.max(1, lines.length);
      return lines.map((text, i) => ({ time: Math.floor(i * step), text }));
    }
    return [];
  }, [currentTrack, duration]);

  // Keyboard shortcut: Escape minimizes player, Space toggles play
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCommentsModal) {
          setShowCommentsModal(false);
        } else {
          onClose();
        }
      } else if (e.key === ' ' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        onTogglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showCommentsModal, onClose, onTogglePlay]);

  // Auto-scroll lyrics to active line
  useEffect(() => {
    if (isOpen && activeTab === 'lyrics' && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [isOpen, currentTime, activeTab]);

  if (!isOpen || !currentTrack) return null;

  const formatTime = (secs: number) => {
    const s = Math.max(0, Math.floor(secs || 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(duration, pos * duration)));
  };

  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    setHoverSeekTime(Math.max(0, Math.min(duration, pos * duration)));
  };

  const toggleMute = () => {
    if (volume > 0) {
      setLastVolume(volume);
      onVolumeChange(0);
    } else {
      onVolumeChange(lastVolume || 0.85);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    setCommentsList((prev) => [
      { id: `c_${Date.now()}`, user: 'You', text: newCommentText.trim(), time: 'Just now' },
      ...prev,
    ]);
    setNewCommentText('');
  };

  const activeLyricIndex = normalizedLyrics.findIndex((line, idx, arr) => {
    const nextLine = arr[idx + 1];
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  });

  const resolvedCover = resolveArtworkUrl(currentTrack.coverUrl, 'track', currentTrack.title);
  const baseLikes = Math.max(120, currentTrack.likes || 120);
  const displayedLikes = isLiked ? baseLikes + 1 : baseLikes;
  const displayedDislikes = isDisliked ? 24 : 23;

  return (
    <div className="fixed inset-0 z-50 bg-[#060608] flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-200">
      {/* Dynamic Ambient Background Blur */}
      <div 
        className="absolute inset-0 opacity-20 filter blur-3xl pointer-events-none scale-125 transition-all duration-700"
        style={{
          backgroundImage: `url(${resolvedCover})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/95 via-[#08080a]/90 to-[#040406] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between border-b border-white/[0.08] backdrop-blur-md shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 p-1.5 -ml-1 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer group"
          title="Minimize player (Esc)"
          aria-label="Minimize full playback screen"
        >
          <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
          <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wider text-neutral-400 group-hover:text-white">
            Minimize
          </span>
        </button>

        {/* View Switcher Segmented Control */}
        <div className="flex items-center gap-1 p-0.5 bg-white/[0.06] border border-white/10 rounded-full">
          <button
            onClick={() => setActiveTab('player')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'player'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Now Playing
          </button>
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'lyrics'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Mic2 className="w-3 h-3" />
            <span>Lyrics</span>
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ListMusic className="w-3 h-3" />
            <span>Up Next {queue.length > 0 && `(${queue.length})`}</span>
          </button>
        </div>

        {/* Video Mode Toggle */}
        <button
          onClick={onToggleVideoMode}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
            isVideoMode
              ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-600/30'
              : 'bg-white/[0.06] border-white/10 text-neutral-300 hover:text-white hover:bg-white/10'
          }`}
          title="Toggle Song vs Visualizer"
        >
          {isVideoMode ? (
            <>
              <Tv className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Visualizer</span>
            </>
          ) : (
            <>
              <Music2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Song</span>
            </>
          )}
        </button>
      </header>

      {/* Main Responsive Body Area */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col justify-between max-w-xl mx-auto w-full px-4 sm:px-6 py-2 sm:py-3 overflow-hidden">
        {/* TAB 1: NOW PLAYING VIEW */}
        {activeTab === 'player' && (
          <div className="flex-1 flex flex-col justify-between items-center min-h-0 space-y-2 sm:space-y-3">
            {/* Responsive Artwork Container */}
            <div className="w-full flex-1 min-h-0 flex items-center justify-center py-1">
              <div className="relative h-full max-h-[32vh] sm:max-h-[38vh] md:max-h-[42vh] aspect-square rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-black/80 border border-white/10 bg-neutral-900 shrink-0">
                {isVideoMode ? (
                  <div className="w-full h-full bg-black relative flex items-center justify-center">
                    <VideoModeCanvas currentTrack={currentTrack} isPlaying={isPlaying} />
                  </div>
                ) : (
                  <img
                    src={resolvedCover}
                    alt={currentTrack.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, currentTrack.title, 'track')}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>

            {/* Song Metadata Info */}
            <div className="w-full text-center space-y-1 shrink-0 px-2">
              <div className="flex items-center justify-center gap-1.5 max-w-full">
                <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold text-white tracking-tight truncate">
                  {currentTrack.title}
                </h1>
                {currentTrack.isExplicit && (
                  <span className="text-[9px] font-bold px-1 py-0.2 bg-white/20 text-neutral-300 rounded shrink-0">
                    E
                  </span>
                )}
              </div>

              {/* Clickable Artist Name navigating to Public Artist Page */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToArtist(currentTrack.artistId || currentTrack.artist);
                }}
                className="text-xs sm:text-sm text-neutral-300 hover:text-red-400 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                title={`View ${currentTrack.artist}`}
              >
                <span className="hover:underline underline-offset-2">{currentTrack.artist}</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </button>

              {/* Unboxed Metadata (Album & Genre) */}
              <div className="text-[11px] text-neutral-400 flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToAlbum) {
                      onClose();
                      onNavigateToAlbum(currentTrack.album, currentTrack.artist);
                    }
                  }}
                  className="hover:text-white transition-colors truncate max-w-[200px]"
                >
                  {currentTrack.album}
                </button>
                <span aria-hidden="true">·</span>
                <span className="uppercase text-[10px] font-mono">{currentTrack.genre}</span>
              </div>
            </div>

            {/* SMALL TIDY HORIZONTAL ACTION CAROUSEL:
                Contains ONLY thumbs-up and thumbs-down with respective counts, comments, saving, playlists, sharing */}
            <div className="w-full shrink-0 py-1">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 px-1">
                {/* 1. Thumbs-Up with count */}
                <button
                  type="button"
                  onClick={onToggleLike}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 border ${
                    isLiked
                      ? 'bg-red-600/15 border-red-500/40 text-red-400'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-neutral-300 hover:text-white'
                  }`}
                  title={isLiked ? 'Liked' : 'Like'}
                >
                  <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                  <span className="font-mono tabular-nums text-[11px]">{formatCompactNumber(displayedLikes)}</span>
                </button>

                {/* 2. Thumbs-Down with count */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDisliked(!isDisliked);
                    if (!isDisliked && isLiked) onToggleLike();
                  }}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 border ${
                    isDisliked
                      ? 'bg-white/20 border-white/30 text-white'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-neutral-300 hover:text-white'
                  }`}
                  title={isDisliked ? 'Disliked' : 'Dislike'}
                >
                  <ThumbsDown className={`w-3.5 h-3.5 ${isDisliked ? 'fill-current' : ''}`} />
                  <span className="font-mono tabular-nums text-[11px]">{displayedDislikes}</span>
                </button>

                {/* 3. Comments */}
                <button
                  type="button"
                  onClick={() => setShowCommentsModal(true)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="View Comments"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="font-mono tabular-nums text-[11px]">{commentsList.length}</span>
                </button>

                {/* 4. Saving */}
                <button
                  type="button"
                  onClick={() => setIsSaved(!isSaved)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 border ${
                    isSaved
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-neutral-300 hover:text-white'
                  }`}
                  title={isSaved ? 'Saved to library' : 'Save'}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                  <span className="text-[11px]">{isSaved ? 'Saved' : 'Save'}</span>
                </button>

                {/* 5. Playlists */}
                <button
                  type="button"
                  onClick={onOpenAddToPlaylist}
                  className="px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Add to Playlist"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Playlist</span>
                </button>

                {/* 6. Sharing */}
                <button
                  type="button"
                  onClick={onShareTrack}
                  className="px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Share Track"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Share</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE LYRICS VIEW */}
        {activeTab === 'lyrics' && (
          <div className="flex-1 flex flex-col py-2 min-h-0 overflow-y-auto space-y-3">
            <div className="text-center pb-2 border-b border-white/[0.08] shrink-0">
              <h2 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                <Mic2 className="w-3.5 h-3.5 text-red-500" />
                <span>Live Interactive Lyrics</span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Tap any line to jump directly to that part of the song
              </p>
            </div>

            {normalizedLyrics && normalizedLyrics.length > 0 ? (
              <div className="space-y-3 py-4 px-2 flex-1 overflow-y-auto">
                {normalizedLyrics.map((line, idx) => {
                  const isActive = idx === activeLyricIndex;
                  return (
                    <div
                      key={idx}
                      ref={isActive ? activeLyricRef : null}
                      onClick={() => onSeek(line.time)}
                      className={`p-2.5 rounded-xl cursor-pointer transition-all duration-200 flex items-baseline gap-3 ${
                        isActive
                          ? 'bg-red-600/15 border border-red-500/30 text-white font-bold scale-[1.01]'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className={`text-[10px] font-mono shrink-0 ${isActive ? 'text-red-400' : 'text-neutral-600'}`}>
                        {formatTime(line.time)}
                      </span>
                      <p className={`text-sm sm:text-base ${isActive ? 'text-white' : 'text-neutral-400'}`}>
                        {line.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-neutral-500 space-y-2">
                <Mic2 className="w-10 h-10 stroke-1" />
                <h3 className="text-sm font-semibold text-neutral-300">Instrumental / Lyrics Pending</h3>
                <p className="text-xs max-w-xs">Lyrics have not yet been provided for this release.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PLAYBACK QUEUE VIEW */}
        {activeTab === 'queue' && (
          <div className="flex-1 flex flex-col py-2 min-h-0 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08] shrink-0">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <ListMusic className="w-3.5 h-3.5 text-red-500" />
                  <span>Playback Queue</span>
                </h2>
                <p className="text-[11px] text-neutral-400">{queue.length} track{queue.length !== 1 ? 's' : ''} next</p>
              </div>

              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={onClearQueue}
                  className="px-2.5 py-1 rounded-lg text-xs text-neutral-400 hover:text-red-400 hover:bg-white/[0.05] transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {queue.length > 0 ? (
                queue.map((track, idx) => (
                  <div
                    key={`${track.id}-${idx}`}
                    className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] transition-colors flex items-center justify-between gap-2.5 group"
                  >
                    <div
                      onClick={() => onPlayQueueTrack(track)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                    >
                      <span className="w-4 text-center text-xs font-mono text-neutral-500">
                        {idx + 1}
                      </span>
                      <img
                        src={resolveArtworkUrl(track.coverUrl, 'track', track.title)}
                        alt={track.title}
                        className="w-8 h-8 rounded-lg object-cover shrink-0 bg-neutral-800"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate group-hover:text-red-400 transition-colors">
                          {track.title}
                        </p>
                        <p className="text-[11px] text-neutral-400 truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onMoveQueueItem(idx, idx - 1)}
                        disabled={idx === 0}
                        className="p-1 rounded text-neutral-500 hover:text-white disabled:opacity-20"
                      >
                        <MoveUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveQueueItem(idx, idx + 1)}
                        disabled={idx === queue.length - 1}
                        className="p-1 rounded text-neutral-500 hover:text-white disabled:opacity-20"
                      >
                        <MoveDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveFromQueue(idx)}
                        className="p-1 rounded text-neutral-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-neutral-500 space-y-1">
                  <ListMusic className="w-7 h-7 mx-auto stroke-1" />
                  <p className="text-xs">Queue is empty</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOTTOM CONTROLS & FUNCTIONING PROGRESS BAR */}
        <div className="w-full shrink-0 pt-2 pb-1 space-y-2.5">
          {/* Functional Scrubber */}
          <div className="space-y-1">
            <div
              className="relative w-full h-2 rounded-full bg-white/10 cursor-pointer group select-none"
              onMouseEnter={() => setIsHoveringSeek(true)}
              onMouseLeave={() => setIsHoveringSeek(false)}
              onMouseMove={handleSeekMouseMove}
              onClick={handleSeekClick}
            >
              <div
                className="h-full bg-red-600 rounded-full relative transition-all duration-75"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md scale-100 group-hover:scale-125 transition-transform" />
              </div>

              {isHoveringSeek && (
                <div
                  className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-neutral-900 border border-white/20 text-[10px] font-mono text-white pointer-events-none shadow"
                  style={{ left: `${(hoverSeekTime / (duration || 1)) * 100}%` }}
                >
                  {formatTime(hoverSeekTime)}
                </div>
              )}
            </div>

            {/* Time Indicators */}
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 tabular-nums px-0.5">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Compact Transport Controls */}
          <div className="flex items-center justify-between sm:justify-center sm:gap-6">
            <button
              type="button"
              onClick={onToggleShuffle}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                isShuffle ? 'text-red-500 bg-red-500/10' : 'text-neutral-400 hover:text-white'
              }`}
              title={isShuffle ? 'Shuffle active' : 'Shuffle'}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onPrev}
              className="p-2.5 text-neutral-200 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Previous"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/15 cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              className="p-2.5 text-neutral-200 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Next"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={onToggleRepeat}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                repeatMode !== 'off' ? 'text-red-500 bg-red-500/10' : 'text-neutral-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>

          {/* Discreet Volume Slider */}
          <div className="hidden sm:flex items-center justify-center gap-2 pt-1 max-w-xs mx-auto">
            <button
              type="button"
              onClick={toggleMute}
              className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-36 h-1 accent-red-500 bg-white/20 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] font-mono text-neutral-400 tabular-nums w-7">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Community Comments Modal */}
      {showCommentsModal && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-[#101014] border border-white/15 rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-5 space-y-4 max-h-[75vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-bold text-white">Listener Comments</h3>
                <span className="text-xs text-neutral-400 font-mono">({commentsList.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCommentsModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Share your thoughts on this track..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="flex-1 px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500/50"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Post</span>
              </button>
            </form>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 divide-y divide-white/[0.05]">
              {commentsList.map((c) => (
                <div key={c.id} className="pt-2.5 first:pt-0 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-200">{c.user}</span>
                    <span className="text-[10px] text-neutral-500 font-mono">{c.time}</span>
                  </div>
                  <p className="text-xs text-neutral-300">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
