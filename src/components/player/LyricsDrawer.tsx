import React, { useEffect, useRef } from 'react';
import { LyricLine, Track } from '../../types/music';
import { X, Mic2, Clock } from 'lucide-react';

interface LyricsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  currentTime: number;
  onSeek: (time: number) => void;
}

export const LyricsDrawer: React.FC<LyricsDrawerProps> = ({
  isOpen,
  onClose,
  track,
  currentTime,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLButtonElement | null>(null);

  const lyrics = track?.lyrics || [];

  // Find active lyric index
  let activeIndex = -1;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time) {
      activeIndex = i;
      break;
    }
  }

  // Scroll active line into center
  useEffect(() => {
    if (isOpen && activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 md:w-[420px] bg-[#0c0c0e]/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic2 className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-bold text-white">Live Lyrics</h3>
          <span className="text-xs text-neutral-400">· Tap line to seek</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Track summary */}
      {track && (
        <div className="px-5 py-3 bg-neutral-900/60 border-b border-white/[0.06] flex items-center gap-3">
          <img
            src={track.coverUrl}
            alt={track.title}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded object-cover"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{track.title}</p>
            <p className="text-[11px] text-neutral-400 truncate">{track.artist}</p>
          </div>
        </div>
      )}

      {/* Lyrics body */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        {lyrics.length > 0 ? (
          lyrics.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;

            return (
              <button
                key={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => onSeek(line.time)}
                className={`w-full text-left transition-all duration-200 group focus:outline-none ${
                  isActive
                    ? 'text-white text-lg md:text-xl font-bold tracking-tight scale-[1.02] origin-left'
                    : isPast
                    ? 'text-neutral-500 text-sm md:text-base font-medium hover:text-neutral-300'
                    : 'text-neutral-400 text-sm md:text-base font-medium hover:text-white'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="flex-1">{line.text}</span>
                  <span className="text-[10px] font-mono text-neutral-600 group-hover:text-neutral-400 pt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {Math.floor(line.time / 60)}:{String(Math.floor(line.time % 60)).padStart(2, '0')}
                  </span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="text-center py-20 text-neutral-500 text-sm">
            <Mic2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-neutral-300">Instrumental or Lyrics Pending</p>
            <p className="text-xs text-neutral-500 mt-1">Synchronized lyrics will appear as soon as provided by the artist or label.</p>
          </div>
        )}
      </div>
    </div>
  );
};
