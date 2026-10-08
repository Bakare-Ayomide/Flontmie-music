import React from 'react';
import { Track } from '../../types/music';
import { X, Play, Trash2, ListMusic, Volume2, MoveUp, MoveDown } from 'lucide-react';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: Track[];
  currentTrack: Track | null;
  onPlayTrack: (track: Track) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  onMoveQueueItem: (from: number, to: number) => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onClose,
  queue,
  currentTrack,
  onPlayTrack,
  onRemoveFromQueue,
  onClearQueue,
  onMoveQueueItem,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 md:w-[420px] bg-[#0c0c0e]/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListMusic className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-bold text-white">Queue & Up Next</h3>
          <span className="text-xs text-neutral-400">· {queue.length} tracks</span>
        </div>
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <button
              onClick={onClearQueue}
              className="text-xs text-neutral-400 hover:text-red-400 px-2 py-1 rounded hover:bg-white/[0.04] transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Now Playing section */}
      {currentTrack && (
        <div className="p-4 bg-white/[0.03] border-b border-white/[0.06]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-red-400 block mb-2">
            Now Playing
          </span>
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded overflow-hidden shrink-0">
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Volume2 className="w-4 h-4 text-white animate-pulse" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{currentTrack.title}</p>
              <p className="text-[11px] text-neutral-400 truncate">{currentTrack.artist}</p>
            </div>
            <span className="text-xs font-mono tabular-nums text-neutral-400">
              {Math.floor(currentTrack.duration / 60)}:{String(Math.floor(currentTrack.duration % 60)).padStart(2, '0')}
            </span>
          </div>
        </div>
      )}

      {/* Up Next List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-2 block my-2">
          Up Next
        </span>
        {queue.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-xs">
            Queue is empty. Select songs from Home or Playlists to add to queue.
          </div>
        ) : (
          queue.map((track, idx) => (
            <div
              key={`${track.id}-${idx}`}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.06] group transition-colors"
            >
              <button
                onClick={() => onPlayTrack(track)}
                className="w-9 h-9 rounded overflow-hidden shrink-0 relative flex items-center justify-center bg-neutral-800"
              >
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                </div>
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-neutral-200 truncate group-hover:text-white">
                  {track.title}
                </p>
                <p className="text-[11px] text-neutral-400 truncate">{track.artist}</p>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {idx > 0 && (
                  <button
                    onClick={() => onMoveQueueItem(idx, idx - 1)}
                    className="p-1 text-neutral-400 hover:text-white"
                    title="Move Up"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                )}
                {idx < queue.length - 1 && (
                  <button
                    onClick={() => onMoveQueueItem(idx, idx + 1)}
                    className="p-1 text-neutral-400 hover:text-white"
                    title="Move Down"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onRemoveFromQueue(idx)}
                  className="p-1 text-neutral-400 hover:text-red-400"
                  title="Remove from queue"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="text-xs font-mono tabular-nums text-neutral-500 shrink-0">
                {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
