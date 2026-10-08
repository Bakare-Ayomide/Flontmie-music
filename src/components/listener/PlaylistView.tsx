import React from 'react';
import { Playlist, Track } from '../../types/music';
import { 
  Play, 
  Shuffle, 
  Share2, 
  Heart, 
  MoreVertical, 
  Clock, 
  Plus, 
  Trash2, 
  Users, 
  Music
} from 'lucide-react';

interface PlaylistViewProps {
  playlist: Playlist;
  allTracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  likedTrackIds: string[];
  onPlayTrack: (track: Track) => void;
  onPlayAll: (tracks: Track[]) => void;
  onShuffleAll: (tracks: Track[]) => void;
  onToggleLike: (trackId: string) => void;
  onRemoveTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  onOpenAddTrackModal: () => void;
  onOpenShareModal: () => void;
  onDeletePlaylist?: (id: string) => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlist,
  allTracks,
  currentTrack,
  isPlaying,
  likedTrackIds,
  onPlayTrack,
  onPlayAll,
  onShuffleAll,
  onToggleLike,
  onRemoveTrackFromPlaylist,
  onOpenAddTrackModal,
  onOpenShareModal,
  onDeletePlaylist,
}) => {
  // Resolve tracks in this playlist
  const tracks = playlist.trackIds
    .map((id) => allTracks.find((t) => t.id === id))
    .filter((t): t is Track => Boolean(t));

  const totalDuration = tracks.reduce((acc, t) => acc + t.duration, 0);
  const totalMinutes = Math.floor(totalDuration / 60);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* Playlist Hero Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-end gap-6 p-6 md:p-8 bg-gradient-to-b from-neutral-800/50 to-transparent rounded-2xl border border-white/[0.06]">
        <div className="w-44 h-44 md:w-56 md:h-56 rounded-xl overflow-hidden shadow-2xl shrink-0 bg-neutral-800 border border-white/10 relative group">
          {playlist.coverUrl ? (
            <img
              src={playlist.coverUrl}
              alt={playlist.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-600">
              <Music className="w-16 h-16" />
            </div>
          )}
        </div>

        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400">
            <span>{playlist.isCollaborative ? 'Collaborative Playlist' : 'Curated Playlist'}</span>
            <span aria-hidden="true">·</span>
            <span>{playlist.category}</span>
          </div>

          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white">
            {playlist.title}
          </h1>

          <p className="text-sm text-neutral-300 max-w-2xl leading-relaxed">
            {playlist.description}
          </p>

          {/* Clean metadata line with typographic separators (anti-slop rule) */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 pt-1">
            <span className="font-semibold text-white">{playlist.curator}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{playlist.followers.toLocaleString()} followers</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{tracks.length} songs</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{totalMinutes} minutes</span>
          </div>

          {playlist.isCollaborative && playlist.collaborators && (
            <div className="flex items-center gap-2 pt-1 text-xs text-neutral-400">
              <Users className="w-3.5 h-3.5 text-neutral-400" />
              <span>Collaborators: {playlist.collaborators.join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 px-2">
        <button
          onClick={() => onPlayAll(tracks)}
          disabled={tracks.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:scale-105 active:scale-95 transition-all shadow-md shadow-white/10 disabled:opacity-40 disabled:hover:scale-100"
        >
          <Play className="w-4 h-4 fill-current ml-0.5" />
          <span>Play All</span>
        </button>

        <button
          onClick={() => onShuffleAll(tracks)}
          disabled={tracks.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white font-medium text-sm transition-all border border-white/10 disabled:opacity-40"
        >
          <Shuffle className="w-4 h-4" />
          <span>Shuffle</span>
        </button>

        <button
          onClick={onOpenShareModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white font-medium text-sm transition-all border border-white/10"
          title="Share playlist with friends"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Share</span>
        </button>

        <button
          onClick={onOpenAddTrackModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white font-medium text-sm transition-all border border-white/10"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Tracks</span>
        </button>

        {onDeletePlaylist && (
          <button
            onClick={() => onDeletePlaylist(playlist.id)}
            className="p-2.5 rounded-full text-neutral-400 hover:text-red-400 hover:bg-white/10 transition-colors ml-auto"
            title="Delete this playlist"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Track List Table */}
      <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-neutral-900/30">
        <div className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-white/[0.06] text-xs font-semibold text-neutral-400 uppercase tracking-wider select-none">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-6 md:col-span-5">Title</div>
          <div className="hidden md:block col-span-3">Album</div>
          <div className="col-span-3 md:col-span-2 text-right">Plays</div>
          <div className="col-span-2 md:col-span-1 flex items-center justify-end">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>

        {tracks.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 text-sm">
            <p className="font-semibold text-neutral-300">No tracks in this playlist yet</p>
            <p className="text-xs text-neutral-500 mt-1">Click "Add Tracks" above to curate this collection.</p>
          </div>
        ) : (
          tracks.map((track, index) => {
            const isCurrent = currentTrack?.id === track.id;
            const isLiked = likedTrackIds.includes(track.id);

            return (
              <div
                key={track.id}
                className={`grid grid-cols-12 gap-3 px-4 py-2.5 items-center text-xs group transition-colors border-b border-white/[0.03] last:border-b-0 ${
                  isCurrent ? 'bg-white/10' : 'hover:bg-white/[0.04]'
                }`}
              >
                {/* Index / Play button */}
                <div className="col-span-1 flex items-center justify-center">
                  <button
                    onClick={() => onPlayTrack(track)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                  >
                    {isCurrent && isPlaying ? (
                      <div className="flex items-end gap-0.5 h-3">
                        <span className="w-0.5 bg-red-500 animate-soundwave-1" />
                        <span className="w-0.5 bg-red-500 animate-soundwave-2" />
                        <span className="w-0.5 bg-red-500 animate-soundwave-3" />
                      </div>
                    ) : (
                      <>
                        <span className="group-hover:hidden font-mono tabular-nums text-neutral-500">
                          {index + 1}
                        </span>
                        <Play className="hidden group-hover:block w-3.5 h-3.5 fill-current text-white" />
                      </>
                    )}
                  </button>
                </div>

                {/* Title & Artist */}
                <div className="col-span-6 md:col-span-5 flex items-center gap-3 min-w-0">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold truncate block ${isCurrent ? 'text-red-400' : 'text-white'}`}>
                        {track.title}
                      </span>
                      {track.isExplicit && (
                        <span className="text-[9px] font-bold px-1 py-0.2 bg-white/20 text-neutral-300 rounded shrink-0">
                          E
                        </span>
                      )}
                    </div>
                    <span className="text-neutral-400 hover:text-white truncate block cursor-pointer">
                      {track.artist}
                    </span>
                  </div>
                </div>

                {/* Album */}
                <div className="hidden md:block col-span-3 text-neutral-400 truncate">
                  {track.album}
                </div>

                {/* Stream count */}
                <div className="col-span-3 md:col-span-2 text-right font-mono tabular-nums text-neutral-400">
                  {track.streams.toLocaleString()}
                </div>

                {/* Duration & quick actions */}
                <div className="col-span-2 md:col-span-1 flex items-center justify-end gap-2 text-neutral-400">
                  <button
                    onClick={() => onToggleLike(track.id)}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                      isLiked ? 'opacity-100 text-red-500' : 'hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-red-500' : ''}`} />
                  </button>

                  <button
                    onClick={() => onRemoveTrackFromPlaylist(playlist.id, track.id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity p-0.5"
                    title="Remove from playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <span className="font-mono tabular-nums text-neutral-400">
                    {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
