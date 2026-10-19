import React from 'react';
import { Playlist, Track } from '../../types/music';
import { resolveArtworkUrl, handleImageError } from '../../utils/artwork';
import { formatCompactNumber } from '../../utils/formatters';
import { 
  Play, 
  Shuffle, 
  Share2, 
  Heart, 
  Clock, 
  Plus, 
  Trash2, 
  Users, 
  Music,
  ArrowLeft
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
  onBack?: () => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlist,
  allTracks = [],
  currentTrack,
  isPlaying,
  likedTrackIds = [],
  onPlayTrack,
  onPlayAll,
  onShuffleAll,
  onToggleLike,
  onRemoveTrackFromPlaylist,
  onOpenAddTrackModal,
  onOpenShareModal,
  onDeletePlaylist,
  onBack,
}) => {
  if (!playlist) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-neutral-400">Playlist not found.</p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs hover:bg-white/20 transition-colors"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  // Resolve tracks in this playlist with defensive guards against undefined/null
  const trackIds: string[] = Array.isArray(playlist.trackIds) ? playlist.trackIds : [];
  const tracks: Track[] = trackIds
    .map((id) => allTracks.find((t) => t?.id === id))
    .filter((t): t is Track => Boolean(t));

  const totalDuration = tracks.reduce((acc, t) => acc + (Number(t?.duration) || 0), 0);
  const totalMinutes = Math.floor(totalDuration / 60);
  const followersFormatted = formatCompactNumber(playlist.followers);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* Back Navigation Button */}
      {onBack && (
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors py-1 px-2.5 rounded-lg hover:bg-white/[0.06]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      )}

      {/* Playlist Hero Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-end gap-6 p-6 md:p-8 bg-gradient-to-b from-neutral-800/50 to-transparent rounded-2xl border border-white/[0.06]">
        <div className="w-44 h-44 md:w-56 md:h-56 rounded-xl overflow-hidden shadow-2xl shrink-0 bg-neutral-800 border border-white/10 relative group">
          <img
            src={resolveArtworkUrl(playlist.coverUrl, 'playlist', playlist.title)}
            alt={playlist.title || 'Playlist'}
            referrerPolicy="no-referrer"
            onError={(e) => handleImageError(e, playlist.title, 'playlist')}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400">
            <span>{playlist.isCollaborative ? 'Collaborative Playlist' : 'Curated Playlist'}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{playlist.category || 'Featured Music'}</span>
          </div>

          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white truncate">
            {playlist.title || 'Untitled Playlist'}
          </h1>

          <p className="text-sm text-neutral-300 max-w-2xl leading-relaxed">
            {playlist.description || 'Curated music collection.'}
          </p>

          {/* Clean metadata line with typographic separators */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 pt-1">
            <span className="font-semibold text-white">{playlist.curator || 'Editorial'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{followersFormatted !== 'N/A' ? `${followersFormatted} saves` : 'N/A saves'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{tracks.length} songs</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{totalMinutes} minutes</span>
          </div>

          {playlist.isCollaborative && Array.isArray(playlist.collaborators) && playlist.collaborators.length > 0 && (
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
          <div className="py-16 text-center text-neutral-500 text-sm space-y-2">
            <p className="font-semibold text-neutral-300">No tracks in this playlist yet</p>
            <p className="text-xs text-neutral-500">Click "Add Tracks" above to curate music into this collection.</p>
            <button
              onClick={onOpenAddTrackModal}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Browse and Add Tracks</span>
            </button>
          </div>
        ) : (
          tracks.map((track, index) => {
            if (!track) return null;
            const isCurrent = currentTrack?.id === track.id;
            const isLiked = likedTrackIds.includes(track.id);
            const streamCount = Number(track.streams) || 0;
            const trackDuration = Number(track.duration) || 180;
            const durMin = Math.floor(trackDuration / 60);
            const durSec = String(Math.floor(trackDuration % 60)).padStart(2, '0');

            return (
              <div
                key={track.id || index}
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
                    src={resolveArtworkUrl(track.coverUrl, 'track', track.title)}
                    alt={track.title || 'Track'}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, track.title, 'track')}
                    className="w-10 h-10 rounded object-cover shrink-0 bg-neutral-800"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold truncate block ${isCurrent ? 'text-red-400' : 'text-white'}`}>
                        {track.title || 'Untitled Track'}
                      </span>
                      {track.isExplicit && (
                        <span className="text-[9px] font-bold px-1 py-0.2 bg-white/20 text-neutral-300 rounded shrink-0">
                          E
                        </span>
                      )}
                    </div>
                    <span className="text-neutral-400 hover:text-white truncate block cursor-pointer">
                      {track.artist || 'Unknown Artist'}
                    </span>
                  </div>
                </div>

                {/* Album */}
                <div className="hidden md:block col-span-3 text-neutral-400 truncate">
                  {track.album || 'Single'}
                </div>

                {/* Stream count */}
                <div className="col-span-3 md:col-span-2 text-right font-mono tabular-nums text-neutral-400">
                  {formatCompactNumber(track.ytPlays ?? streamCount)}
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
                    {durMin}:{durSec}
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
