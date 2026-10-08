import React from 'react';
import { X, Check, Plus, ListMusic } from 'lucide-react';
import { Playlist, Track } from '../../types/music';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  playlists: Playlist[];
  onToggleTrackInPlaylist: (playlistId: string, trackId: string) => void;
  onOpenCreatePlaylist: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  track,
  playlists,
  onToggleTrackInPlaylist,
  onOpenCreatePlaylist,
}) => {
  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-[#121215] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-white">Save to Playlist</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
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

        <div className="max-h-60 overflow-y-auto space-y-1">
          {playlists.map((pl) => {
            const hasTrack = pl.trackIds.includes(track.id);
            return (
              <button
                key={pl.id}
                onClick={() => onToggleTrackInPlaylist(pl.id, track.id)}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-xs transition-colors ${
                  hasTrack
                    ? 'bg-red-500/10 text-white font-medium border border-red-500/20'
                    : 'text-neutral-300 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded overflow-hidden bg-neutral-800 shrink-0">
                    <img
                      src={pl.coverUrl}
                      alt={pl.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="truncate">{pl.title}</span>
                </div>
                {hasTrack && <Check className="w-4 h-4 text-red-500 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-white/[0.08] flex justify-between items-center">
          <button
            onClick={() => {
              onClose();
              onOpenCreatePlaylist();
            }}
            className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Playlist</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white text-black font-semibold text-xs rounded-lg hover:bg-neutral-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
