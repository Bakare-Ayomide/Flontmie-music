import React, { useState, useEffect, useRef } from 'react';
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
  Heart, 
  ListMusic, 
  Mic2, 
  Share2, 
  Tv, 
  Music2, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Disc, 
  MoveUp, 
  MoveDown,
  Clock,
  Radio,
  Check
} from 'lucide-react';
import { Track } from '../../types/music';
import { VideoModeCanvas } from './VideoModeCanvas';

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
  const activeLyricRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Escape minimizes full player, Space toggles play
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        onTogglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onTogglePlay]);

  // Auto-scroll lyrics to active line
  useEffect(() => {
    if (activeTab === 'lyrics' && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentTime, activeTab]);

  if (!isOpen || !currentTrack) return null;

  const formatTime = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

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

  const activeLyricIndex = currentTrack.lyrics?.findIndex((line, idx, arr) => {
    const nextLine = arr[idx + 1];
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#070709] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-200 select-none">
      {/* Dynamic Ambient Background Blur */}
      <div 
        className="absolute inset-0 opacity-25 filter blur-3xl pointer-events-none scale-125 transition-all duration-700"
        style={{
          backgroundImage: `url(${currentTrack.coverUrl})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/90 via-[#0a0a0c]/85 to-[#050507]/98 pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-white/[0.08] backdrop-blur-md">
        {/* Minimize Action Button */}
        <button
          onClick={onClose}
          className="flex items-center gap-2 p-2 -ml-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 transition-colors group"
          title="Minimize player (Esc)"
          aria-label="Minimize full playback screen"
        >
          <ChevronDown className="w-6 h-6 group-hover:translate-y-0.5 transition-transform" />
          <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wider text-neutral-400 group-hover:text-white">
            Minimize
          </span>
        </button>

        {/* View Switcher Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-white/[0.06] border border-white/10 rounded-full">
          <button
            onClick={() => setActiveTab('player')}
            className={`px-3 sm:px-4 py-1 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'player'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Now Playing
          </button>
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-1 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'lyrics'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Lyrics</span>
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-1 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'queue'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Up Next {queue.length > 0 && `(${queue.length})`}</span>
          </button>
        </div>

        {/* Secondary Actions: Video Toggle & Share */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleVideoMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              isVideoMode
                ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-600/30'
                : 'bg-white/[0.06] border-white/10 text-neutral-300 hover:text-white hover:bg-white/10'
            }`}
            title="Toggle Song vs Video / Visualizer"
          >
            {isVideoMode ? (
              <>
                <Tv className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Video</span>
              </>
            ) : (
              <>
                <Music2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Song</span>
              </>
            )}
          </button>

          <button
            onClick={onShareTrack}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Share track"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 flex flex-col justify-between max-w-5xl mx-auto w-full">
        {/* TAB 1: Now Playing View */}
        {activeTab === 'player' && (
          <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12 min-h-0">
            {/* Visualizer Canvas or Big Artwork */}
            <div className="w-full max-w-[340px] sm:max-w-[420px] lg:max-w-[460px] aspect-square relative rounded-3xl overflow-hidden shadow-2xl shadow-black/80 border border-white/10 group shrink-0">
              {isVideoMode ? (
                <div className="w-full h-full bg-black relative flex items-center justify-center">
                  <VideoModeCanvas currentTrack={currentTrack} isPlaying={isPlaying} />
                  <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-white font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    LIVE AUDIO VISUALIZER
                  </div>
                </div>
              ) : (
                <>
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-5">
                    <div className="text-xs text-neutral-300">
                      <span className="font-semibold text-white">{currentTrack.album}</span>
                      <p className="text-[11px] text-neutral-400 font-mono mt-0.5">{currentTrack.isrc}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Song Information & Quick Details */}
            <div className="w-full max-w-md flex flex-col justify-center space-y-4 text-center lg:text-left">
              <div className="flex flex-col items-center lg:items-start space-y-1.5">
                <div className="flex items-center gap-2 max-w-full">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight truncate">
                    {currentTrack.title}
                  </h1>
                  {currentTrack.isExplicit && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white/20 text-neutral-300 rounded shrink-0">
                      EXPLICIT
                    </span>
                  )}
                </div>

                {/* Clickable Artist Name navigating to Public Artist Page */}
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToArtist(currentTrack.artistId || currentTrack.artist);
                  }}
                  className="text-base sm:text-lg text-neutral-300 hover:text-red-400 font-medium flex items-center gap-1.5 transition-colors group cursor-pointer"
                  title="View Artist Page on Flontmie"
                >
                  <span className="group-hover:underline underline-offset-4">{currentTrack.artist}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                </button>

                {/* Clickable Album Name */}
                <div className="flex items-center gap-2 text-xs text-neutral-400 pt-1">
                  <button
                    onClick={() => {
                      if (onNavigateToAlbum) {
                        onClose();
                        onNavigateToAlbum(currentTrack.album, currentTrack.artist);
                      }
                    }}
                    className="hover:text-white transition-colors truncate max-w-[240px]"
                    title="View Album"
                  >
                    Album · <span className="font-medium text-neutral-300">{currentTrack.album}</span>
                  </button>
                  <span aria-hidden="true">·</span>
                  <span className="uppercase text-[11px] text-neutral-400 font-mono">{currentTrack.genre}</span>
                </div>
              </div>

              {/* Streaming & Metadata Badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-1">
                <span className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/10 text-[11px] font-mono text-neutral-300">
                  {currentTrack.streams.toLocaleString()} Streams
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/10 text-[11px] font-mono text-neutral-300">
                  {currentTrack.bpm} BPM
                </span>
                {currentTrack.distributor && (
                  <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300">
                    {currentTrack.distributor}
                  </span>
                )}
              </div>

              {/* Action buttons (Like / Add to Playlist) */}
              <div className="flex items-center justify-center lg:justify-start gap-3 pt-2">
                <button
                  onClick={onToggleLike}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    isLiked
                      ? 'bg-red-600/10 border-red-500/40 text-red-400 shadow-md shadow-red-600/20'
                      : 'bg-white/[0.05] border-white/10 text-neutral-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                  <span>{isLiked ? 'Liked on Flontmie' : 'Save to Liked'}</span>
                </button>

                <button
                  onClick={onOpenAddToPlaylist}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.05] border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add to Playlist</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Synchronized Interactive Lyrics View */}
        {activeTab === 'lyrics' && (
          <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full py-4 min-h-0 overflow-y-auto space-y-6">
            <div className="text-center pb-2 border-b border-white/[0.08]">
              <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                <Mic2 className="w-4 h-4 text-red-500" />
                <span>Live Synchronized Lyrics</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Tap any lyric line to jump directly to that part of the song
              </p>
            </div>

            {currentTrack.lyrics && currentTrack.lyrics.length > 0 ? (
              <div className="space-y-4 py-8 px-2">
                {currentTrack.lyrics.map((line, idx) => {
                  const isActive = idx === activeLyricIndex;
                  return (
                    <div
                      key={idx}
                      ref={isActive ? activeLyricRef : null}
                      onClick={() => onSeek(line.time)}
                      className={`p-3 rounded-2xl cursor-pointer transition-all duration-300 flex items-baseline gap-4 group ${
                        isActive
                          ? 'bg-red-600/15 border border-red-500/30 text-white font-bold scale-[1.02] shadow-lg'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className={`text-[11px] font-mono shrink-0 ${isActive ? 'text-red-400' : 'text-neutral-600'}`}>
                        {formatTime(line.time)}
                      </span>
                      <p className={`text-base sm:text-lg tracking-wide ${isActive ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200'}`}>
                        {line.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-neutral-500 space-y-3">
                <Mic2 className="w-12 h-12 stroke-1" />
                <h3 className="text-base font-semibold text-neutral-300">Instrumental or Lyrics Pending</h3>
                <p className="text-xs max-w-sm">
                  Official synchronized lyrics have not yet been provided by the distributor for this recording.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Up Next Queue Management View */}
        {activeTab === 'queue' && (
          <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full py-4 min-h-0 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-red-500" />
                  <span>Playback Queue</span>
                </h2>
                <p className="text-xs text-neutral-400">
                  {queue.length} track{queue.length !== 1 ? 's' : ''} queued next
                </p>
              </div>

              {queue.length > 0 && (
                <button
                  onClick={onClearQueue}
                  className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-red-400 hover:bg-white/[0.05] transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Queue</span>
                </button>
              )}
            </div>

            {/* Currently Playing Card */}
            <div className="p-3 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                  <img src={currentTrack.coverUrl} alt={currentTrack.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">Now Playing</span>
                  <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
                  <p className="text-xs text-neutral-400 truncate">{currentTrack.artist}</p>
                </div>
              </div>
              <span className="text-xs font-mono text-neutral-400 shrink-0">{formatTime(duration)}</span>
            </div>

            {/* Queue Items List */}
            {queue.length > 0 ? (
              <div className="space-y-1.5 pt-2">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-1">Up Next</span>
                {queue.map((track, idx) => (
                  <div
                    key={`${track.id}-${idx}`}
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div 
                      onClick={() => onPlayQueueTrack(track)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <span className="w-5 text-center text-xs font-mono text-neutral-500 group-hover:hidden">
                        {idx + 1}
                      </span>
                      <Play className="w-4 h-4 text-white hidden group-hover:block shrink-0" />

                      <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate group-hover:text-red-400 transition-colors">
                          {track.title}
                        </p>
                        <p className="text-[11px] text-neutral-400 truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Move Reorder Buttons */}
                      <button
                        onClick={() => onMoveQueueItem(idx, idx - 1)}
                        disabled={idx === 0}
                        className="p-1 rounded text-neutral-500 hover:text-white disabled:opacity-20 transition-colors"
                        title="Move Up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onMoveQueueItem(idx, idx + 1)}
                        disabled={idx === queue.length - 1}
                        className="p-1 rounded text-neutral-500 hover:text-white disabled:opacity-20 transition-colors"
                        title="Move Down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onRemoveFromQueue(idx)}
                        className="p-1 rounded text-neutral-500 hover:text-red-400 transition-colors ml-1"
                        title="Remove from Queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-neutral-500 space-y-2">
                <ListMusic className="w-8 h-8 mx-auto stroke-1" />
                <p className="text-xs">Queue is currently empty. Add more songs from the catalog!</p>
              </div>
            )}
          </div>
        )}

        {/* Bottom Playback Transport Controls */}
        <div className="pt-4 pb-2 space-y-4 max-w-2xl mx-auto w-full">
          {/* Functional Seek / Scrub Bar */}
          <div className="space-y-1.5">
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
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg shadow-black/50 scale-100 group-hover:scale-125 transition-transform" />
              </div>

              {isHoveringSeek && (
                <div
                  className="absolute -top-8 -translate-x-1/2 px-2 py-0.5 rounded bg-neutral-900 border border-white/20 text-[10px] font-mono text-white pointer-events-none shadow-md"
                  style={{ left: `${(hoverSeekTime / (duration || 1)) * 100}%` }}
                >
                  {formatTime(hoverSeekTime)}
                </div>
              )}
            </div>

            {/* Time Indicators */}
            <div className="flex items-center justify-between text-xs font-mono text-neutral-400 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Primary Transport Buttons (Shuffle, Prev, Play/Pause, Next, Repeat) */}
          <div className="flex items-center justify-between sm:justify-center sm:gap-8 pt-1">
            <button
              onClick={onToggleShuffle}
              className={`p-2.5 rounded-full transition-colors ${
                isShuffle ? 'text-red-500 bg-red-500/10' : 'text-neutral-400 hover:text-white'
              }`}
              title={isShuffle ? 'Shuffle active' : 'Shuffle inactive'}
            >
              <Shuffle className="w-5 h-5" />
            </button>

            <button
              onClick={onPrev}
              className="p-3 text-neutral-200 hover:text-white hover:scale-110 active:scale-95 transition-all"
              title="Previous song"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={onTogglePlay}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/20"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
              ) : (
                <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-1" />
              )}
            </button>

            <button
              onClick={onNext}
              className="p-3 text-neutral-200 hover:text-white hover:scale-110 active:scale-95 transition-all"
              title="Next song"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={onToggleRepeat}
              className={`p-2.5 rounded-full transition-colors ${
                repeatMode !== 'off' ? 'text-red-500 bg-red-500/10' : 'text-neutral-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-5 h-5" />
              ) : (
                <Repeat className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Volume Control Bar */}
          <div className="flex items-center justify-center gap-3 pt-2 max-w-xs mx-auto">
            <button
              onClick={toggleMute}
              className="text-neutral-400 hover:text-white transition-colors"
              title={volume === 0 ? 'Unmute' : 'Mute'}
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-40 sm:w-56 h-1.5 accent-red-500 bg-white/20 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] font-mono text-neutral-400 tabular-nums w-8">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
