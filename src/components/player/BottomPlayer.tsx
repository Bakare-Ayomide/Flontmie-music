import React, { useState, useEffect } from 'react';
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
  Download,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Track, PlayerTabMode } from '../../types/music';
import { resolveArtworkUrl, handleImageError } from '../../utils/artwork';
import { nativePlatform } from '../../services/nativePlatform';

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
  onToggleQueue,
  onOpenShare,
  onSelectArtist,
  onOpenFullPlayer,
}) => {
  const [isDownloadedOffline, setIsDownloadedOffline] = useState<boolean>(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);

  useEffect(() => {
    const unsub = nativePlatform.subscribeOfflineTracks((records) => {
      setIsDownloadedOffline(Boolean(currentTrack && records[currentTrack.id]));
    });
    return () => unsub();
  }, [currentTrack?.id]);

  if (!currentTrack) return null;

  const handleToggleOfflineDownload = async () => {
    if (!currentTrack || downloadPct !== null) return;
    if (isDownloadedOffline) {
      await nativePlatform.removeOfflineTrack(currentTrack.id);
      return;
    }
    setDownloadPct(1);
    try {
      await nativePlatform.downloadTrackForOffline(currentTrack, (pct) => setDownloadPct(pct));
    } catch {
      // Handled gracefully
    } finally {
      setDownloadPct(null);
    }
  };

  const formatTime = (sec: number) => {
    const safeSec = Number.isFinite(sec) && sec >= 0 ? sec : 0;
    const m = Math.floor(safeSec / 60);
    const s = Math.floor(safeSec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const effectiveDuration = duration > 0 ? duration : currentTrack.duration || 180;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 h-20 lg:h-24 bg-black/95 backdrop-blur-2xl border-t border-white/10 z-50 px-3 sm:px-4 lg:px-8 flex items-center justify-between select-none shadow-2xl">
      {/* Mobile Interactive Progress Bar along top edge */}
      <div className="lg:hidden absolute -top-1 left-0 right-0 h-2 flex items-center group">
        <div className="w-full h-[3px] bg-white/25 relative overflow-hidden">
          <div
            className="h-full bg-white"
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
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1 lg:w-[32%] lg:flex-none">
        <div
          onClick={() => onOpenFullPlayer && onOpenFullPlayer()}
          className="relative group shrink-0 cursor-pointer"
          title="Open Full Player"
        >
          <img
            src={resolveArtworkUrl(currentTrack.coverUrl, 'track', currentTrack.title)}
            alt={currentTrack.title}
            onError={(e) => handleImageError(e, currentTrack.title, 'track')}
            className="w-12 h-12 lg:w-14 lg:h-14 rounded-lg object-cover shadow-lg border border-white/15 transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
        </div>

        <div
          onClick={() => onOpenFullPlayer && onOpenFullPlayer()}
          className="min-w-0 flex-1 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white truncate hover:underline transition-colors">
              {currentTrack.title}
            </h4>
            {currentTrack.isExplicit && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold uppercase shrink-0">
                E
              </span>
            )}
          </div>
          <p
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectArtist) onSelectArtist(currentTrack.artistId);
            }}
            className="text-xs text-zinc-400 truncate hover:text-white transition-colors cursor-pointer"
          >
            {currentTrack.artist}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleOfflineDownload}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isDownloadedOffline
                ? 'text-white bg-white/15'
                : 'text-zinc-400 hover:text-white'
            }`}
            title={
              isDownloadedOffline
                ? 'Saved Offline (Click to Remove)'
                : 'Download for Offline Playback'
            }
            aria-label={
              isDownloadedOffline
                ? 'Saved Offline'
                : 'Download for Offline Playback'
            }
          >
            {downloadPct !== null ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : isDownloadedOffline ? (
              <CheckCircle2 className="w-4 h-4 text-white" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onToggleLike(currentTrack.id)}
            className={`hidden sm:inline-flex p-2 rounded-lg transition-colors cursor-pointer ${
              isLiked ? 'text-[#ff2b2b] hover:opacity-80' : 'text-zinc-400 hover:text-white'
            }`}
            title={isLiked ? 'Remove from Liked' : 'Save to Liked'}
            aria-label={isLiked ? 'Remove from Liked' : 'Save to Liked'}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#ff2b2b]' : ''}`} />
          </button>
          {onDislike && (
            <button
              onClick={() => onDislike(currentTrack.id)}
              className={`hidden sm:inline-flex p-2 rounded-lg transition-colors cursor-pointer ${
                isDisliked ? 'text-white bg-white/15' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Dislike / Not Interested"
              aria-label="Dislike"
            >
              <ThumbsDown className={`w-4 h-4 ${isDisliked ? 'fill-white' : ''}`} />
            </button>
          )}
          <button
            onClick={() => onOpenShare(currentTrack)}
            className="hidden sm:inline-flex p-2 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
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
              isShuffle ? 'text-white bg-white/15' : 'text-zinc-400 hover:text-white'
            }`}
            title="Shuffle"
            aria-label="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={onPrev}
            className="p-1.5 text-white hover:opacity-80 transition-opacity cursor-pointer"
            title="Previous Track"
            aria-label="Previous Track"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={onPlayPause}
            className="w-10 h-10 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg cursor-pointer"
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
            className="p-1.5 text-white hover:opacity-80 transition-opacity cursor-pointer"
            title="Next Track"
            aria-label="Next Track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={onToggleRepeat}
            className={`hidden sm:block relative p-1.5 rounded-lg transition-colors cursor-pointer ${
              repeatMode !== 'off' ? 'text-white bg-white/15' : 'text-zinc-400 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
            aria-label={`Repeat: ${repeatMode}`}
          >
            <Repeat className="w-4 h-4" />
            {repeatMode === 'one' && (
              <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-white text-black rounded-full w-3.5 h-3.5 flex items-center justify-center">
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
          <div className="relative flex-1 h-4 flex items-center group cursor-pointer">
            <div className="w-full h-[3px] bg-white/25 rounded-full relative">
              <div
                className="h-full bg-white rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow transition-transform group-hover:scale-110"
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
          <span className="text-[11px] font-mono text-zinc-400 w-9">
            {formatTime(effectiveDuration)}
          </span>
        </div>
      </div>

      {/* Right: Queue, Volume & Expand Player */}
      <div className="flex items-center justify-end gap-2 sm:gap-3 lg:w-[32%]">
        {/* Queue Button */}
        <button
          onClick={onToggleQueue}
          title="Queue"
          aria-label="Queue"
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            isQueueOpen
              ? 'bg-white text-black border-white'
              : 'bg-zinc-900 border-white/10 text-zinc-300 hover:text-white'
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
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
          />
        </div>

        {onOpenFullPlayer && (
          <button
            onClick={onOpenFullPlayer}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-colors cursor-pointer"
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
