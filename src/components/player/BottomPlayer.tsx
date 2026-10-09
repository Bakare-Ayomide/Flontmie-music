import React, { useState } from 'react';
import { Track } from '../../types/music';
import { 
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
  Heart, 
  Plus, 
  Tv, 
  Music2, 
  Share2,
  ChevronUp,
  Maximize2
} from 'lucide-react';

interface BottomPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isVideoMode: boolean;
  isLiked: boolean;
  isQueueOpen: boolean;
  isLyricsOpen: boolean;
  queueCount: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleVideoMode: () => void;
  onToggleQueue: () => void;
  onToggleLyrics: () => void;
  onToggleLike: () => void;
  onOpenAddToPlaylist: () => void;
  onShareTrack: () => void;
  onOpenFullPlayer: () => void;
  onNavigateToArtist?: (artistId: string) => void;
}

export const BottomPlayer: React.FC<BottomPlayerProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isShuffle,
  repeatMode,
  isVideoMode,
  isLiked,
  isQueueOpen,
  isLyricsOpen,
  queueCount,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleShuffle,
  onToggleRepeat,
  onToggleVideoMode,
  onToggleQueue,
  onToggleLyrics,
  onToggleLike,
  onOpenAddToPlaylist,
  onShareTrack,
  onOpenFullPlayer,
  onNavigateToArtist,
}) => {
  const [isHoveringSeek, setIsHoveringSeek] = useState(false);
  const [hoverSeekTime, setHoverSeekTime] = useState(0);
  const [lastVolume, setLastVolume] = useState(volume || 0.8);

  const formatTime = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
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
      onVolumeChange(lastVolume || 0.8);
    }
  };

  if (!currentTrack) {
    return (
      <footer className="fixed bottom-0 left-0 right-0 h-16 md:h-18 bg-[#0f0f11] border-t border-white/[0.08] px-4 md:px-6 flex items-center justify-between text-neutral-500 text-xs z-30">
        <span className="truncate">Select any track to start listening</span>
        <span className="font-mono text-[11px] shrink-0">Cadence Audio Ready</span>
      </footer>
    );
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-[#0c0c0e]/95 backdrop-blur-xl border-t border-white/[0.08] z-30 select-none">
      {/* Top Scrub Bar */}
      <div
        className="relative w-full h-1.5 group cursor-pointer bg-white/10"
        onMouseEnter={() => setIsHoveringSeek(true)}
        onMouseLeave={() => setIsHoveringSeek(false)}
        onMouseMove={handleSeekMouseMove}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pos = (e.clientX - rect.left) / rect.width;
          onSeek(pos * duration);
        }}
      >
        <div
          className="h-full bg-red-600 relative transition-all duration-75"
          style={{ width: `${progressPercent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-red-500 scale-0 group-hover:scale-100 transition-transform shadow-md shadow-red-500/50" />
        </div>

        {isHoveringSeek && (
          <div
            className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-neutral-900 border border-white/20 text-[10px] font-mono text-white pointer-events-none shadow-md"
            style={{ left: `${(hoverSeekTime / (duration || 1)) * 100}%` }}
          >
            {formatTime(hoverSeekTime)}
          </div>
        )}
      </div>

      <div className="h-16 md:h-18 px-3 md:px-6 flex items-center justify-between gap-2 md:gap-4 max-w-full">
        {/* Left: Track Information - Clicking opens Full Playback Screen */}
        <div className="flex items-center gap-2.5 md:gap-3 flex-1 md:w-1/4 md:min-w-[200px] min-w-0">
          <div 
            onClick={onOpenFullPlayer}
            className="relative w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden shrink-0 bg-neutral-800 shadow-md cursor-pointer group"
            title="Open Full Player"
          >
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ChevronUp className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenFullPlayer}
                className="font-semibold text-xs md:text-sm text-white hover:text-red-400 text-left truncate block transition-colors cursor-pointer"
                title="Open Full Player"
              >
                {currentTrack.title}
              </button>
              {currentTrack.isExplicit && (
                <span className="text-[9px] font-bold px-1 py-0.2 bg-white/20 text-neutral-300 rounded shrink-0">
                  E
                </span>
              )}
            </div>
            {onNavigateToArtist ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToArtist(currentTrack.artistId || currentTrack.artist);
                }}
                className="text-[11px] text-neutral-400 hover:text-white truncate block text-left transition-colors cursor-pointer"
                title={`Go to ${currentTrack.artist}`}
              >
                {currentTrack.artist}
              </button>
            ) : (
              <span className="text-[11px] text-neutral-400 truncate block">
                {currentTrack.artist}
              </span>
            )}
          </div>

          {/* Action buttons (Expand / Heart / Add) */}
          <div className="hidden sm:flex items-center gap-0.5 shrink-0">
            <button
              onClick={onOpenFullPlayer}
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-full text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Expand to Full Player"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onToggleLike}
              className={`min-h-[32px] min-w-[32px] flex items-center justify-center rounded-full transition-colors ${
                isLiked ? 'text-red-500' : 'text-neutral-400 hover:text-white'
              }`}
              title={isLiked ? 'Remove from liked songs' : 'Save to liked songs'}
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-red-500' : ''}`} />
            </button>
            <button
              onClick={onOpenAddToPlaylist}
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-full text-neutral-400 hover:text-white transition-colors"
              title="Add to playlist"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Controls & Timers (Desktop & Tablet) */}
        <div className="hidden md:flex flex-col items-center justify-center flex-1 max-w-md">
          <div className="flex items-center gap-4 lg:gap-6">
            <button
              onClick={onToggleShuffle}
              className={`p-1.5 transition-colors ${
                isShuffle ? 'text-red-500' : 'text-neutral-400 hover:text-white'
              }`}
              title={isShuffle ? 'Shuffle enabled' : 'Shuffle disabled'}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={onPrev}
              className="p-1.5 text-neutral-300 hover:text-white transition-colors"
              title="Previous Track"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={onTogglePlay}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={onNext}
              className="p-1.5 text-neutral-300 hover:text-white transition-colors"
              title="Next Track"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={onToggleRepeat}
              className={`p-1.5 transition-colors ${
                repeatMode !== 'off' ? 'text-red-500' : 'text-neutral-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-neutral-400 mt-0.5">
            <span>{formatTime(currentTime)}</span>
            <span className="text-neutral-600">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right / Mobile Compact Controls */}
        <div className="flex items-center justify-end gap-1.5 md:gap-2 md:w-1/4 md:min-w-[200px] shrink-0">
          {/* Mobile Play / Next Controls */}
          <div className="flex md:hidden items-center gap-1.5">
            <button
              onClick={onToggleLike}
              className={`w-9 h-9 flex items-center justify-center rounded-full ${
                isLiked ? 'text-red-500' : 'text-neutral-400'
              }`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500' : ''}`} />
            </button>

            <button
              onClick={onTogglePlay}
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-md active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              onClick={onNext}
              className="w-9 h-9 flex items-center justify-center text-neutral-300 active:scale-95"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>

          {/* Song / Video Switcher (YT Music Signature Feature!) */}
          <button
            onClick={onToggleVideoMode}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              isVideoMode
                ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-600/30'
                : 'bg-white/[0.05] border-white/10 text-neutral-300 hover:text-white hover:bg-white/10'
            }`}
            title="Toggle Song vs Video / Canvas Visualizer mode"
          >
            {isVideoMode ? (
              <>
                <Tv className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Video</span>
              </>
            ) : (
              <>
                <Music2 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Song</span>
              </>
            )}
          </button>

          {/* Lyrics Button */}
          <button
            onClick={onToggleLyrics}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
              isLyricsOpen ? 'bg-white/20 text-white' : 'text-neutral-400 hover:text-white'
            }`}
            title="Lyrics"
          >
            <Mic2 className="w-4 h-4" />
          </button>

          {/* Queue Drawer Button */}
          <button
            onClick={onToggleQueue}
            className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
              isQueueOpen ? 'bg-white/20 text-white' : 'text-neutral-400 hover:text-white'
            }`}
            title="Queue"
          >
            <ListMusic className="w-4 h-4" />
            {queueCount > 0 && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500" />
            )}
          </button>

          {/* Share Track */}
          <button
            onClick={onShareTrack}
            className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full text-neutral-400 hover:text-white transition-colors"
            title="Share track"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Volume Control (Desktop Only) */}
          <div className="hidden lg:flex items-center gap-2 group ml-1">
            <button
              onClick={toggleMute}
              className="text-neutral-400 hover:text-white transition-colors"
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
              className="w-16 h-1 accent-red-500 bg-white/20 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
