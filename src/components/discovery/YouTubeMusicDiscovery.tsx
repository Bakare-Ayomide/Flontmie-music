import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Play,
  Pause,
  Heart,
  Plus,
  ListPlus,
  Disc,
  Music2,
  UserCheck,
  ListMusic,
  Sparkles,
  Download,
  CheckCircle2,
  Trash2,
  WifiOff,
  HardDrive,
  Loader2,
  Video,
} from 'lucide-react';
import { Track, Playlist, ArtistProfile } from '../../types/music';
import { nativePlatform, OfflineTrackRecord } from '../../services/nativePlatform';
import { resolveArtworkUrl, handleImageError } from '../../utils/artwork';
import { formatCompactNumber } from '../../utils/formatters';

interface CatalogExplorerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  likedTrackIds: string[];
  onPlayTrack: (track: Track) => void;
  onToggleLike: (trackId: string) => void;
  onAddToQueue: (track: Track) => void;
  onOpenAddToPlaylist?: (track: Track) => void;
  onSelectArtist?: (artistId: string) => void;
  onSelectPlaylist?: (playlistId: string) => void;
  searchQuery?: string;
  catalogTracks?: Track[];
  catalogAlbums?: any[];
  catalogArtists?: ArtistProfile[];
  catalogPlaylists?: Playlist[];
}

type FilterTab = 'all' | 'songs' | 'offline' | 'albums' | 'artists' | 'playlists';

export const YouTubeMusicDiscovery: React.FC<CatalogExplorerProps> = ({
  currentTrack,
  isPlaying,
  likedTrackIds,
  onPlayTrack,
  onToggleLike,
  onAddToQueue,
  onOpenAddToPlaylist,
  onSelectArtist,
  onSelectPlaylist,
  searchQuery = '',
  catalogTracks = [],
  catalogAlbums = [],
  catalogArtists = [],
  catalogPlaylists = [],
}) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [isOnline, setIsOnline] = useState<boolean>(nativePlatform.isOnline());
  const [offlineMap, setOfflineMap] = useState<Record<string, OfflineTrackRecord>>({});
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const unsubNet = nativePlatform.subscribeNetworkStatus((online) => {
      setIsOnline(online);
      if (!online) {
        setActiveFilter('offline');
      }
    });
    const unsubOffline = nativePlatform.subscribeOfflineTracks((records) => {
      setOfflineMap(records);
    });
    return () => {
      unsubNet();
      unsubOffline();
    };
  }, []);

  const genres = useMemo(() => {
    const set = new Set<string>(['All']);
    catalogTracks.forEach((t) => {
      if (t.genre) set.add(t.genre);
    });
    return Array.from(set);
  }, [catalogTracks]);

  const effectiveQuery = localQuery.trim().toLowerCase();

  const filteredTracks = useMemo(() => {
    const sourceList =
      activeFilter === 'offline'
        ? Object.values(offlineMap).map((r) => r.track)
        : catalogTracks;

    return sourceList.filter((t) => {
      if (selectedGenre !== 'All' && t.genre?.toLowerCase() !== selectedGenre.toLowerCase()) {
        return false;
      }
      if (!effectiveQuery) return true;
      return (
        t.title.toLowerCase().includes(effectiveQuery) ||
        t.artist.toLowerCase().includes(effectiveQuery) ||
        (t.album || '').toLowerCase().includes(effectiveQuery) ||
        (t.genre || '').toLowerCase().includes(effectiveQuery)
      );
    });
  }, [catalogTracks, offlineMap, activeFilter, selectedGenre, effectiveQuery]);

  const filteredAlbums = useMemo(() => {
    return catalogAlbums.filter((a) => {
      if (!effectiveQuery) return true;
      const title = String(a.title || a.name || '').toLowerCase();
      const artist = String(a.artist_name || a.artistName || a.artist || '').toLowerCase();
      return title.includes(effectiveQuery) || artist.includes(effectiveQuery);
    });
  }, [catalogAlbums, effectiveQuery]);

  const filteredArtists = useMemo(() => {
    return catalogArtists.filter((art) => {
      if (!effectiveQuery) return true;
      return (
        art.name.toLowerCase().includes(effectiveQuery) ||
        (art.primaryGenre || '').toLowerCase().includes(effectiveQuery)
      );
    });
  }, [catalogArtists, effectiveQuery]);

  const filteredPlaylists = useMemo(() => {
    return catalogPlaylists.filter((pl) => {
      if (!effectiveQuery) return true;
      return (
        pl.title.toLowerCase().includes(effectiveQuery) ||
        (pl.description || '').toLowerCase().includes(effectiveQuery)
      );
    });
  }, [catalogPlaylists, effectiveQuery]);

  const handleDownloadTrack = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadError(null);
    if (offlineMap[track.id]) {
      await nativePlatform.removeOfflineTrack(track.id);
      return;
    }
    setDownloadProgress((prev) => ({ ...prev, [track.id]: 1 }));
    try {
      await nativePlatform.downloadTrackForOffline(track, (pct) => {
        setDownloadProgress((prev) => ({ ...prev, [track.id]: pct }));
      });
    } catch (err: any) {
      setDownloadError(err?.message || 'Could not download track for offline listening.');
    } finally {
      setDownloadProgress((prev) => {
        const copy = { ...prev };
        delete copy[track.id];
        return copy;
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const offlineCount = Object.keys(offlineMap).length;
  const totalOfflineBytes = nativePlatform.getOfflineStorageBytes();

  return (
    <div className="space-y-6">
      {/* Offline Mode / Device Storage Status Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/80 border border-white/10">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
            }`}
          >
            {isOnline ? <HardDrive className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                {isOnline
                  ? 'Flontmie Verified Catalog (Admin & Distributor Uploads)'
                  : 'Offline Mode Active — Playing Downloaded Device Tracks'}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  isOnline
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {offlineCount} track{offlineCount === 1 ? '' : 's'} saved for offline playback ({formatBytes(totalOfflineBytes)})
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveFilter(activeFilter === 'offline' ? 'all' : 'offline')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
            activeFilter === 'offline'
              ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
              : 'bg-white/5 text-zinc-200 border-white/10 hover:bg-white/10'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{activeFilter === 'offline' ? 'Show Full Catalog' : `Offline Library (${offlineCount})`}</span>
        </button>
      </div>

      {downloadError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between">
          <span>{downloadError}</span>
          <button onClick={() => setDownloadError(null)} className="text-rose-400 font-bold ml-4 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Search uploaded songs, albums, verified artists, or playlists..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/90 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(
            [
              { id: 'all', label: 'All Releases' },
              { id: 'songs', label: `Songs (${catalogTracks.length})` },
              { id: 'offline', label: `Offline (${offlineCount})` },
              { id: 'albums', label: `Albums (${catalogAlbums.length})` },
              { id: 'artists', label: `Artists (${catalogArtists.length})` },
              { id: 'playlists', label: `Playlists (${catalogPlaylists.length})` },
            ] as Array<{ id: FilterTab; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-emerald-500 text-zinc-950 font-bold shadow'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Genre Chips */}
      {genres.length > 1 && (activeFilter === 'all' || activeFilter === 'songs' || activeFilter === 'offline') && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedGenre === g
                  ? 'bg-white text-zinc-950 font-bold'
                  : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Songs / Offline Tracks Section */}
      {(activeFilter === 'all' || activeFilter === 'songs' || activeFilter === 'offline') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Music2 className="w-4 h-4 text-emerald-400" />
              <span>
                {activeFilter === 'offline'
                  ? 'Downloaded Offline Tracks'
                  : 'Uploaded Catalog Songs'}
              </span>
            </h3>
            <span className="text-xs text-zinc-400">{filteredTracks.length} tracks</span>
          </div>

          {filteredTracks.length === 0 ? (
            <div className="p-8 rounded-2xl bg-zinc-900/50 border border-white/10 text-center space-y-2">
              <p className="text-sm font-semibold text-white">
                {activeFilter === 'offline'
                  ? 'No tracks downloaded for offline listening yet'
                  : 'No matching catalog tracks found'}
              </p>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {activeFilter === 'offline'
                  ? 'Tap the download icon next to any permitted catalog track while online to save it to your device for offline playback.'
                  : 'Try clearing your search or genre filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredTracks.slice(0, activeFilter === 'all' ? 12 : 60).map((track) => {
                const isCurrent = currentTrack?.id === track.id;
                const isLiked = likedTrackIds.includes(track.id);
                const isDownloaded = Boolean(offlineMap[track.id]);
                const progress = downloadProgress[track.id];
                const canDownload = nativePlatform.canDownloadTrack(track);

                return (
                  <div
                    key={track.id}
                    onClick={() => onPlayTrack(track)}
                    className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer group ${
                      isCurrent
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-zinc-900/60 hover:bg-zinc-900 border-white/[0.07]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-800">
                        <img
                          src={resolveArtworkUrl(track.coverUrl, 'track', track.title)}
                          alt={track.title}
                          onError={(e) => handleImageError(e, track.title, 'track')}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          {isCurrent && isPlaying ? (
                            <Pause className="w-5 h-5 text-white fill-current" />
                          ) : (
                            <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-white truncate group-hover:text-emerald-400">
                            {track.title}
                          </p>
                          {track.hasLocalVideo && (
                            <span
                              title="Includes Uploaded Video Stream"
                              className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[9px] font-bold uppercase shrink-0 flex items-center gap-0.5"
                            >
                              <Video className="w-2.5 h-2.5" /> Video
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 truncate">
                          {track.artist} • <span className="text-zinc-500">{track.genre}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {isDownloaded ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Offline Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                              Online Stream • {formatCompactNumber(track.flontmiePlays ?? track.streams ?? 0)} plays
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Offline Download / Remove Button */}
                      {canDownload && (
                        <button
                          onClick={(e) => handleDownloadTrack(track, e)}
                          disabled={progress !== undefined}
                          title={isDownloaded ? 'Remove Offline Download' : 'Download for Offline Listening'}
                          aria-label={isDownloaded ? 'Remove Offline Download' : 'Download for Offline Listening'}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            isDownloaded
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-rose-500/15 hover:text-rose-400 hover:border-rose-500/30'
                              : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {progress !== undefined ? (
                            <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>{progress}%</span>
                            </div>
                          ) : isDownloaded ? (
                            <Trash2 className="w-4 h-4" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => onToggleLike(track.id)}
                        title={isLiked ? 'Unlike' : 'Like'}
                        className={`p-2 rounded-xl transition-colors cursor-pointer ${
                          isLiked ? 'text-rose-500' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500' : ''}`} />
                      </button>

                      <button
                        onClick={() => onAddToQueue(track)}
                        title="Add to Queue"
                        className="p-2 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <ListPlus className="w-4 h-4" />
                      </button>

                      {onOpenAddToPlaylist && (
                        <button
                          onClick={() => onOpenAddToPlaylist(track)}
                          title="Add to Playlist"
                          className="p-2 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Uploaded Albums Section */}
      {(activeFilter === 'all' || activeFilter === 'albums') && filteredAlbums.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Disc className="w-4 h-4 text-emerald-400" />
            <span>Uploaded Albums & EPs ({filteredAlbums.length})</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {filteredAlbums.slice(0, activeFilter === 'all' ? 5 : 25).map((alb) => {
              const title = alb.title || alb.name || 'Album';
              const artist = alb.artist_name || alb.artistName || alb.artist || 'Artist';
              const cover = alb.cover_art_url || alb.coverUrl || '';
              return (
                <div
                  key={alb.id}
                  onClick={() => {
                    const albumTrack = catalogTracks.find(
                      (t) =>
                        t.album?.toLowerCase() === title.toLowerCase() ||
                        t.artist.toLowerCase() === artist.toLowerCase()
                    );
                    if (albumTrack) onPlayTrack(albumTrack);
                  }}
                  className="p-3 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 border border-white/10 transition-all cursor-pointer group"
                >
                  <img
                    src={resolveArtworkUrl(cover, 'album', title)}
                    alt={title}
                    onError={(e) => handleImageError(e, title, 'album')}
                    className="w-full aspect-square rounded-xl object-cover mb-2.5 group-hover:scale-[1.02] transition-transform"
                  />
                  <p className="text-xs font-bold text-white truncate group-hover:text-emerald-400">{title}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{artist}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Verified Artists Section */}
      {(activeFilter === 'all' || activeFilter === 'artists') && filteredArtists.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Catalog Artists ({filteredArtists.length})</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {filteredArtists.slice(0, activeFilter === 'all' ? 6 : 24).map((artist) => (
              <div
                key={artist.id}
                onClick={() => onSelectArtist && onSelectArtist(artist.id)}
                className="p-3 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 border border-white/10 text-center transition-all cursor-pointer group"
              >
                <img
                  src={resolveArtworkUrl(artist.avatarUrl, 'artist', artist.name)}
                  alt={artist.name}
                  onError={(e) => handleImageError(e, artist.name, 'artist')}
                  className="w-20 h-20 rounded-full object-cover mx-auto mb-2.5 border border-white/10 group-hover:scale-105 transition-transform"
                />
                <p className="text-xs font-bold text-white truncate group-hover:text-emerald-400">{artist.name}</p>
                <p className="text-[10px] text-zinc-400 truncate">{artist.primaryGenre || 'Verified Artist'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Curated Playlists Section */}
      {(activeFilter === 'all' || activeFilter === 'playlists') && filteredPlaylists.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-emerald-400" />
            <span>Editorial & Curated Playlists ({filteredPlaylists.length})</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {filteredPlaylists.slice(0, activeFilter === 'all' ? 5 : 20).map((pl) => (
              <div
                key={pl.id}
                onClick={() => onSelectPlaylist && onSelectPlaylist(pl.id)}
                className="p-3 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 border border-white/10 transition-all cursor-pointer group"
              >
                <img
                  src={resolveArtworkUrl(pl.coverUrl, 'playlist', pl.title)}
                  alt={pl.title}
                  onError={(e) => handleImageError(e, pl.title, 'playlist')}
                  className="w-full aspect-square rounded-xl object-cover mb-2.5 group-hover:scale-[1.02] transition-transform"
                />
                <p className="text-xs font-bold text-white truncate group-hover:text-emerald-400">{pl.title}</p>
                <p className="text-[11px] text-zinc-400 truncate">
                  {pl.curator} • {pl.trackIds.length} tracks
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
