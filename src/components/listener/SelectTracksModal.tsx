import React, { useState } from 'react';
import { X, Plus, Check, Search, Music } from 'lucide-react';
import { Playlist, Track } from '../../types/music';

interface SelectTracksModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Playlist | null;
  allTracks: Track[];
  onToggleTrack: (playlistId: string, trackId: string) => void;
}

export const SelectTracksModal: React.FC<SelectTracksModalProps> = ({
  isOpen,
  onClose,
  playlist,
  allTracks,
  onToggleTrack,
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen || !playlist) return null;

  const filtered = allTracks.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.artist.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#121215] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Add Songs to "{playlist.title}"</h3>
            <p className="text-xs text-neutral-400">Curate tracks for this collection</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search catalog to add..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none"
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1">
          {filtered.map((track) => {
            const isAdded = playlist.trackIds.includes(track.id);

            return (
              <div
                key={track.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                    <p className="text-[11px] text-neutral-400 truncate">{track.artist}</p>
                  </div>
                </div>

                <button
                  onClick={() => onToggleTrack(playlist.id, track.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isAdded
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-white text-black hover:bg-neutral-200'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Added</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t border-white/[0.08] flex justify-end">
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
