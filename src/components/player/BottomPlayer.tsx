import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Volume2,
  VolumeX,
  Heart,
  ThumbsDown,
  ListMusic,
  Share2,
  Maximize2,
  Headphones,
  Video,
  FileText,
} from 'lucide-react';
import { Track, PlayerTabMode } from '../../types/music';
import { resolveArtworkUrl, handleImageError } from '../../utils/artwork';

interface BottomPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isLiked: boolean;
  isDisliked?: boolean;
  activeTab: PlayerTabMode;
  isQueueOpen: boolean;
  onSelectTab: (tab: PlayerTabMode, expandPlayer?: boolean) => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleLike: (trackId: string) => void;
  onDislike?: (trackId: string) => void;
  onToggleQueue: () => void;
  onOpenShare: (track: Track) => void;
  onSelectArtist?: (artistId: string) => void;
  onOpenFullPlayer?: () => void;
}

export const BottomPlayer: React.FC<BottomPlayerProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffle,
  repeatMode,
  isLiked,
  isDisliked = false,
  activeTab,
  isQueueOpen,
  onSelectTab,
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
  onToggleQueue,
  onOpenShare,
  onSelectArtist,
  onOpenFullPlayer,
}) => {
  if (!currentTrack) return null;

  const formatTime = (sec: number) => {
    const safeSec = Number.isFinite(sec) && sec >= 0 ? sec : 0;
    const m = Math.floor(safeSec / 60);
    const s = Math.floor(safeSec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const effectiveDuration = duration > 0 ? duration : currentTrack.duration || 180;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;

  const tabItems: Array<{ id: PlayerTabMode; label: string; icon: React.ReactNode }> = [
    { id: 'audio', label: 'Audio', icon: <Headphones className="w-4 h-4" /> },
    { id: 'video', label: 'Video', icon: <Video className="w-4 h-4" /> },
    { id: 'lyrics', label: 'Lyrics', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 h-20 lg:h-24 bg-zinc-950/95 backdrop-blur-2xl border-t border-white/10 z-50 px-3 sm:px-4 lg:px-8 flex items-center justify-between select-none shadow-2xl">
      {/* Mobile Interactive Progress Bar along top edge */}
      <div className="lg:hidden absolute -top-1 left-0 right-0 h-2 flex items-center group">
        <div className="w-full h-1 bg-zinc-800 relative overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
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

      {/* Left: Track Info */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1 lg:w-[30%] lg:flex-none">
        <div
          onClick={() => onOpenFullPlayer && onOpenFullPlayer()}
          className="relative group shrink-0 cursor-pointer"
          title="Open Full Player"
        >
          <img
            src={resolveArtworkUrl(currentTrack.coverUrl, 'track', currentTrack.title)}
            alt={currentTrack.title}
            onError={(e) => handleImageError(e, currentTrack.title, 'track')}
            className={`w-12 h-12 lg:w-14 lg:h-14 rounded-xl object-cover shadow-lg border border-white/10 transition-transform duration-300 group-hover:scale-105 ${
              isPlaying ? 'ring-2 ring-emerald-500/40' : ''
            }`}
          />
          <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
          {isPlaying && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 animate-ping" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4
              onClick={() => onOpenFullPlayer && onOpenFullPlayer()}
              className="text-sm font-semibold text-white truncate hover:text-emerald-400 transition-colors cursor-pointer"
            >
              {currentTrack.title}
            </h4>
            {currentTrack.isExplicit && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 font-bold uppercase shrink-0">
                E
              </span>
            )}
          </div>
          <p
            onClick={() => onSelectArtist && onSelectArtist(currentTrack.artistId)}
            className="text-xs text-zinc-400 truncate hover:text-emerald-400 transition-colors cursor-pointer"
          >
            {currentTrack.artist}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-1">
          <button
            onClick={() => onToggleLike(currentTrack.id)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isLiked ? 'text-rose-500 hover:text-rose-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={isLiked ? 'Remove from Liked' : 'Save to Liked'}
            aria-label={isLiked ? 'Remove from Liked' : 'Save to Liked'}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500' : ''}`} />
          </button>
          {onDislike && (
            <button
              onClick={() => onDislike(currentTrack.id)}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isDisliked ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Dislike / Not Interested"
              aria-label="Dislike"
            >
              <ThumbsDown className={`w-4 h-4 ${isDisliked ? 'fill-amber-400' : ''}`} />
            </button>
          )}
          <button
            onClick={() => onOpenShare(currentTrack)}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            title="Share Track"
            aria-label="Share Track"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center: Transport & Seekbar */}
      <div className="flex flex-col items-center justify-center flex-1 max-w-xl px-2 lg:px-4">
        <div className="flex items-center gap-3 sm:gap-5 mb-0 lg:mb-1.5">
          <button
            onClick={onToggleShuffle}
            className={`hidden sm:block p-1.5 rounded-lg transition-colors cursor-pointer ${
              isShuffle ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-white'
            }`}
            title="Shuffle"
            aria-label="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={onPrev}
            className="p-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Previous Track"
            aria-label="Previous Track"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={onPlayPause}
            className="w-10 h-10 rounded-full bg-white text-zinc-950 hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-white/10 cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onNext}
            className="p-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Next Track"
            aria-label="Next Track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={onToggleRepeat}
            className={`hidden sm:block relative p-1.5 rounded-lg transition-colors cursor-pointer ${
              repeatMode !== 'off' ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
            aria-label={`Repeat: ${repeatMode}`}
          >
            <Repeat className="w-4 h-4" />
            {repeatMode === 'one' && (
              <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-emerald-500 text-zinc-950 rounded-full w-3.5 h-3.5 flex items-center justify-center">
                1
              </span>
            )}
          </button>
        </div>

        {/* Progress Bar (Desktop) */}
        <div className="hidden lg:flex items-center gap-3 w-full">
          <span className="text-[11px] font-mono text-zinc-400 w-9 text-right">
            {formatTime(currentTime)}
          </span>
          <div className="relative flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden group cursor-pointer flex items-center">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
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
          <span className="text-[11px] font-mono text-zinc-500 w-9">
            {formatTime(effectiveDuration)}
          </span>
        </div>
      </div>

      {/* Right: Three Icon-Only Mode Tabs (Audio, Video, Lyrics) + Queue & Volume */}
      <div className="flex items-center justify-end gap-2 sm:gap-3 lg:w-[30%]">
        {/* Three Icon-Only Tabs: Audio, Video, Lyrics */}
        <div
          role="tablist"
          aria-label="Player mode tabs"
          className="flex items-center bg-zinc-900/90 p-1 rounded-xl border border-white/10"
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
                onClick={() => onSelectTab(tab.id, true)}
                className={`relative group/tab p-2 rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.icon}
                <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-zinc-900 text-white text-[10px] font-semibold tracking-wide whitespace-nowrap opacity-0 group-hover/tab:opacity-100 transition-opacity border border-white/10 shadow-lg">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Queue Utility Button */}
        <button
          onClick={onToggleQueue}
          title="Queue"
          aria-label="Queue"
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            isQueueOpen
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white'
          }`}
        >
          <ListMusic className="w-4 h-4" />
        </button>

        {/* Volume Control */}
        <div className="hidden xl:flex items-center gap-2 w-28">
          <button
            onClick={onToggleMute}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
            aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
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
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {onOpenFullPlayer && (
          <button
            onClick={onOpenFullPlayer}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Open Full Player"
            aria-label="Open Full Player"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
