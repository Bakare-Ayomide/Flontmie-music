import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Play, 
  Pause, 
  Plus, 
  Heart, 
  Flame, 
  Sparkles, 
  Disc3, 
  ListMusic, 
  Mic2, 
  TrendingUp, 
  Loader2, 
  ArrowLeft, 
  Globe, 
  Radio,
  Music,
  CheckCircle2
} from 'lucide-react';
import { Track } from '../../types/music';
import { api } from '../../services/api';
import { resolveArtworkUrl, handleImageError } from '../../utils/artwork';

interface YouTubeMusicDiscoveryProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  likedTrackIds: string[];
  onPlayTrack: (track: Track, queueContext?: Track[]) => void;
  onToggleLike: (trackId: string) => void;
  onAddToQueue: (track: Track) => void;
  onOpenAddToPlaylist: (track: Track) => void;
  initialQuery?: string;
}

export const YouTubeMusicDiscovery: React.FC<YouTubeMusicDiscoveryProps> = ({
  currentTrack,
  isPlaying,
  likedTrackIds,
  onPlayTrack,
  onToggleLike,
  onAddToQueue,
  onOpenAddToPlaylist,
  initialQuery = '',
}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<'all' | 'songs' | 'albums' | 'artists' | 'playlists'>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Unified Search Results (Flontmie DB Catalog + YouTube Music API)
  const [searchResults, setSearchResults] = useState<{
    songs: any[];
    albums: any[];
    artists: any[];
    playlists: any[];
  } | null>(null);

  // Home Shelves & Charts State
  const [homeShelves, setHomeShelves] = useState<Array<{ title: string; subtitle: string; items: any[] }>>([]);
  const [charts, setCharts] = useState<any[]>([]);
  const [chartCountry, setChartCountry] = useState('US');

  // Drill-down View for Album / Playlist / Artist
  const [drillDownView, setDrillDownView] = useState<{
    type: 'album' | 'playlist' | 'artist';
    id: string;
    data: any;
  } | null>(null);
  const [isDrillLoading, setIsDrillLoading] = useState(false);

  const convertItemToPlayableTrack = (item: any): Track => {
    return api.mapDbTrack({
      ...item,
      id: item.id || (item.videoId ? `trk_yt_${item.videoId}` : `yt_${Date.now()}`),
      video_id: item.videoId || item.video_id,
      title: item.title || 'Untitled Track',
      artist_name: item.artist || item.artist_name || 'Unknown Artist',
      artist_id: item.artist_id || item.artistId || 'art_yt',
      album_name: item.album || item.album_name || 'Single',
      duration: Number(item.duration) || 195,
      genre: item.genre || 'Pop',
      cover_art_url: item.cover_url || item.cover_art_url || '',
      audio_url: item.audio_url || `/phpbackend/api/stream.php?id=${encodeURIComponent(item.id || `trk_yt_${item.videoId}`)}`,
      stream_count: Number(item.stream_count ?? item.streams) || 0,
      likes_count: Number(item.likes_count ?? item.likes) || 0,
      explicit: Boolean(item.explicit),
      source: item.source
    });
  };

  useEffect(() => {
    let mounted = true;
    const loadInitialDiscovery = async () => {
      setIsLoading(true);
      try {
        const [homeRes, chartsRes] = await Promise.all([
          api.getYouTubeMusicHome(),
          api.getYouTubeMusicCharts(chartCountry),
        ]);
        if (!mounted) return;
        if (homeRes?.shelves) setHomeShelves(homeRes.shelves);
        if (chartsRes?.charts) setCharts(chartsRes.charts);
      } catch (err) {
        console.warn('Discovery load notice:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadInitialDiscovery();
    return () => {
      mounted = false;
    };
  }, [chartCountry]);

  const executeSearch = useCallback(async (q: string, filterType: 'all' | 'songs' | 'albums' | 'artists' | 'playlists') => {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    setIsLoading(true);
    setDrillDownView(null);
    try {
      const res = await api.searchYouTubeMusic(q.trim(), filterType);
      if (res && res.results) {
        setSearchResults(res.results);
      }
    } catch (err) {
      console.error('Unified search failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery && initialQuery.trim() !== '') {
      setSearchQuery(initialQuery);
      executeSearch(initialQuery, activeFilter);
    }
  }, [initialQuery, activeFilter, executeSearch]);

  const handleOpenAlbum = async (albumItem: any) => {
    const browseId = albumItem.browseId || albumItem.id;
    if (!browseId) return;
    setIsDrillLoading(true);
    try {
      const res = await api.getYouTubeMusicAlbum(browseId);
      if (res?.album) {
        setDrillDownView({ type: 'album', id: browseId, data: res.album });
      }
    } catch (err) {
      console.error('Failed to load album:', err);
    } finally {
      setIsDrillLoading(false);
    }
  };

  const handleOpenPlaylist = async (plItem: any) => {
    const browseId = plItem.browseId || plItem.id;
    if (!browseId) return;
    setIsDrillLoading(true);
    try {
      const res = await api.getYouTubeMusicPlaylist(browseId);
      if (res?.playlist) {
        setDrillDownView({ type: 'playlist', id: browseId, data: res.playlist });
      }
    } catch (err) {
      console.error('Failed to load playlist:', err);
    } finally {
      setIsDrillLoading(false);
    }
  };

  const handleOpenArtist = async (artistItem: any) => {
    const browseId = artistItem.browseId || artistItem.id;
    const name = artistItem.name || artistItem.artist || 'Artist';
    setIsDrillLoading(true);
    try {
      const res = await api.getYouTubeMusicArtist(browseId, name);
      if (res?.artist) {
        setDrillDownView({
          type: 'artist',
          id: browseId,
          data: {
            ...res.artist,
            top_songs: res.top_songs || [],
            albums: res.albums || [],
          },
        });
      }
    } catch (err) {
      console.error('Failed to load artist:', err);
    } finally {
      setIsDrillLoading(false);
    }
  };

  const handlePlaySongItem = (songItem: any, listContext?: any[]) => {
    const track = convertItemToPlayableTrack(songItem);
    const queue = listContext ? listContext.map(convertItemToPlayableTrack) : [track];
    onPlayTrack(track, queue);
  };

  return (
    <div className="space-y-8 pb-28 animate-in fade-in duration-200">
      {/* Unified Search Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#1a0508] via-[#12091c] to-[#0a101d] border border-white/10 p-5 sm:p-7">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Unified App-Wide Catalog & Global Search</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Search Flontmie Catalog & YouTube Music
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              Searches across admin uploads, authorized distributor & record label releases, independent artists, and the global YouTube Music catalog simultaneously.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeSearch(searchQuery, activeFilter);
            }}
            className="w-full lg:w-96 flex flex-col gap-2"
          >
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search songs, artists, albums, ISRCs, playlists..."
                className="w-full pl-10 pr-24 py-3 rounded-xl bg-black/70 border border-white/15 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-red-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                    setDrillDownView(null);
                  }}
                  className="absolute right-16 text-xs text-neutral-400 hover:text-white px-1.5"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Search
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {(['all', 'songs', 'albums', 'artists', 'playlists'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setActiveFilter(f);
                    if (searchQuery.trim()) {
                      executeSearch(searchQuery, f);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-all cursor-pointer ${
                    activeFilter === f
                      ? 'bg-white text-black'
                      : 'bg-white/[0.06] text-neutral-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </form>
        </div>
      </div>

      {(isLoading || isDrillLoading) && (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-400">
          <Loader2 className="w-7 h-7 animate-spin text-red-500" />
          <span className="text-xs font-medium">Searching platform catalog & YouTube Music...</span>
        </div>
      )}

      {/* DRILL-DOWN VIEW (Album / Playlist / Artist) */}
      {!isDrillLoading && drillDownView && (
        <div className="space-y-6 bg-neutral-900/40 border border-white/10 rounded-2xl p-5 sm:p-6">
          <button
            onClick={() => setDrillDownView(null)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Results</span>
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 pb-4 border-b border-white/[0.08]">
            <img
              src={resolveArtworkUrl(
                drillDownView.data.cover_url || drillDownView.data.avatar_url,
                drillDownView.type === 'artist' ? 'artist' : 'album',
                drillDownView.data.title || drillDownView.data.name
              )}
              alt={drillDownView.data.title || drillDownView.data.name}
              referrerPolicy="no-referrer"
              onError={(e) =>
                handleImageError(
                  e,
                  drillDownView.data.title || drillDownView.data.name,
                  drillDownView.type === 'artist' ? 'artist' : 'album'
                )
              }
              className={`w-28 h-28 sm:w-36 sm:h-36 object-cover shadow-2xl border border-white/10 ${
                drillDownView.type === 'artist' ? 'rounded-full' : 'rounded-2xl'
              }`}
            />
            <div className="space-y-2 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">
                {drillDownView.type}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                {drillDownView.data.title || drillDownView.data.name}
              </h2>
              {drillDownView.data.description && (
                <p className="text-xs text-neutral-300 max-w-2xl line-clamp-3">
                  {drillDownView.data.description}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {(drillDownView.data.tracks || drillDownView.data.top_songs || []).map((song: any, i: number) => (
              <div
                key={song.id || song.videoId || i}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors group"
              >
                <div
                  onClick={() =>
                    handlePlaySongItem(song, drillDownView.data.tracks || drillDownView.data.top_songs)
                  }
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                >
                  <span className="w-6 text-center text-xs font-mono text-neutral-500">{i + 1}</span>
                  <img
                    src={resolveArtworkUrl(song.cover_url || drillDownView.data.cover_url, 'track', song.title)}
                    alt={song.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, song.title, 'track')}
                    className="w-10 h-10 rounded object-cover shrink-0 bg-neutral-800"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-red-400">
                      {song.title}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate">
                      {song.artist || drillDownView.data.artist || drillDownView.data.name}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UNIFIED SEARCH RESULTS */}
      {!isLoading && !drillDownView && searchResults && (
        <div className="space-y-8">
          {/* Songs */}
          {(activeFilter === 'all' || activeFilter === 'songs') && (
            <div className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-red-500" />
                <span>Songs ({searchResults.songs?.length || 0})</span>
              </h2>
              {(!searchResults.songs || searchResults.songs.length === 0) ? (
                <p className="text-xs text-neutral-500 py-4">No matching songs found.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {searchResults.songs.map((song, idx) => {
                    const mapped = convertItemToPlayableTrack(song);
                    const isCurr = currentTrack?.id === mapped.id || (currentTrack?.videoId && currentTrack.videoId === mapped.videoId);
                    const isLiked = likedTrackIds.includes(mapped.id);
                    const isCatalogSource = song.source === 'catalog';

                    return (
                      <div
                        key={song.id || song.videoId || idx}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 group ${
                          isCurr
                            ? 'bg-red-600/15 border-red-500/40'
                            : 'bg-neutral-900/50 border-white/[0.06] hover:bg-white/[0.06]'
                        }`}
                      >
                        <div
                          onClick={() => handlePlaySongItem(song, searchResults.songs)}
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-neutral-800">
                            <img
                              src={resolveArtworkUrl(song.cover_url || song.cover_art_url, 'track', song.title)}
                              alt={song.title}
                              referrerPolicy="no-referrer"
                              onError={(e) => handleImageError(e, song.title, 'track')}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              {isCurr && isPlaying ? (
                                <Pause className="w-5 h-5 text-white fill-current" />
                              ) : (
                                <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                              )}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs sm:text-sm font-bold text-white truncate">
                                {song.title}
                              </p>
                              {isCatalogSource && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono shrink-0 flex items-center gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Catalog
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-400 truncate">
                              {song.artist} · {song.album || 'Single'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onToggleLike(mapped.id)}
                            className={`p-1.5 rounded-full hover:bg-white/10 ${
                              isLiked ? 'text-red-500' : 'text-neutral-400 hover:text-white'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500' : ''}`} />
                          </button>
                          <button
                            onClick={() => onOpenAddToPlaylist(mapped)}
                            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10"
                            title="Add to playlist"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Artists */}
          {(activeFilter === 'all' || activeFilter === 'artists') &&
            searchResults.artists &&
            searchResults.artists.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Mic2 className="w-4 h-4 text-purple-400" />
                  <span>Artists ({searchResults.artists.length})</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                  {searchResults.artists.map((artist, idx) => (
                    <div
                      key={artist.id || idx}
                      onClick={() => handleOpenArtist(artist)}
                      className="p-4 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:bg-white/[0.06] transition-all cursor-pointer text-center space-y-2.5 group"
                    >
                      <img
                        src={resolveArtworkUrl(artist.avatar_url, 'artist', artist.name)}
                        alt={artist.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, artist.name, 'artist')}
                        className="w-20 h-20 rounded-full object-cover mx-auto border border-white/10 group-hover:scale-105 transition-transform bg-neutral-800"
                      />
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-white truncate">{artist.name}</p>
                        <p className="text-[11px] text-neutral-400 truncate">
                          {artist.source === 'catalog' ? 'Flontmie Artist' : (artist.subscribers || 'Artist')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Albums */}
          {(activeFilter === 'all' || activeFilter === 'albums') &&
            searchResults.albums &&
            searchResults.albums.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Disc3 className="w-4 h-4 text-amber-400" />
                  <span>Albums & Releases ({searchResults.albums.length})</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {searchResults.albums.map((alb, idx) => (
                    <div
                      key={alb.id || idx}
                      onClick={() => handleOpenAlbum(alb)}
                      className="p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:bg-white/[0.06] transition-all cursor-pointer space-y-2.5 group"
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800">
                        <img
                          src={resolveArtworkUrl(alb.cover_url, 'album', alb.title)}
                          alt={alb.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, alb.title, 'album')}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-white truncate">{alb.title}</p>
                        <p className="text-[11px] text-neutral-400 truncate">
                          {alb.artist} {alb.year ? `· ${alb.year}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Playlists */}
          {(activeFilter === 'all' || activeFilter === 'playlists') &&
            searchResults.playlists &&
            searchResults.playlists.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-emerald-400" />
                  <span>Playlists ({searchResults.playlists.length})</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {searchResults.playlists.map((pl, idx) => (
                    <div
                      key={pl.id || idx}
                      onClick={() => handleOpenPlaylist(pl)}
                      className="p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:bg-white/[0.06] transition-all cursor-pointer space-y-2"
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800">
                        <img
                          src={resolveArtworkUrl(pl.cover_url, 'playlist', pl.title)}
                          alt={pl.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, pl.title, 'playlist')}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-white truncate">{pl.title}</p>
                      <p className="text-[11px] text-neutral-400 truncate">{pl.curator}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* DEFAULT VIEW: CHARTS & HOME SHELVES */}
      {!isLoading && !drillDownView && !searchResults && (
        <div className="space-y-10">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-5 h-5 text-red-500" />
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-white">
                    Top Global & Regional Charts
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Real-time trending songs across Flontmie and YouTube Music
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-neutral-400" />
                {['US', 'NG', 'GB', 'ZA'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setChartCountry(c)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      chartCountry === c
                        ? 'bg-red-600 text-white'
                        : 'bg-white/[0.06] text-neutral-400 hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {charts.length === 0 ? (
              <div className="p-8 rounded-2xl bg-neutral-900/30 border border-white/[0.06] text-center text-xs text-neutral-500">
                No chart tracks available right now. Use the search bar above to find any song, artist, or album.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {charts.slice(0, 12).map((song, idx) => {
                  const mapped = convertItemToPlayableTrack(song);
                  const isCurr = currentTrack?.id === mapped.id;

                  return (
                    <div
                      key={song.id || song.videoId || idx}
                      onClick={() => handlePlaySongItem(song, charts)}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer group ${
                        isCurr
                          ? 'bg-red-600/15 border-red-500/40'
                          : 'bg-neutral-900/40 border-white/[0.06] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-6 text-center font-mono text-xs font-extrabold text-neutral-500">
                          #{idx + 1}
                        </span>
                        <img
                          src={resolveArtworkUrl(song.cover_url, 'track', song.title)}
                          alt={song.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, song.title, 'track')}
                          className="w-11 h-11 rounded-lg object-cover shrink-0 bg-neutral-800"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-red-400">
                            {song.title}
                          </p>
                          <p className="text-[11px] text-neutral-400 truncate">{song.artist}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {homeShelves.map((shelf, sIdx) => (
            <div key={sIdx} className="space-y-3">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>{shelf.title}</span>
                </h2>
                {shelf.subtitle && <p className="text-xs text-neutral-400">{shelf.subtitle}</p>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                {shelf.items.map((item, idx) => (
                  <div
                    key={item.id || item.videoId || idx}
                    onClick={() => handlePlaySongItem(item, shelf.items)}
                    className="p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:bg-white/[0.07] transition-all cursor-pointer group space-y-2.5"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden relative bg-neutral-800">
                      <img
                        src={resolveArtworkUrl(item.cover_url, 'track', item.title)}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, item.title, 'track')}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white truncate group-hover:text-red-400">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate">{item.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
