import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Play,
  Pause,
  Plus,
  Flame,
  Music,
  Mic2,
  Disc3,
  ListMusic,
  CheckCircle2,
  Heart,
  X,
  Filter,
  Globe,
  Calendar,
  Loader2,
  ArrowRight,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { Track, Playlist, ArtistProfile } from '../../types/music';
import { api } from '../../services/api';
import { resolveArtworkUrl, handleImageError } from '../../utils/artwork';
import { formatCompactNumber } from '../../utils/formatters';

interface YouTubeMusicDiscoveryProps {
  tracks?: Track[];
  albums?: any[];
  artists?: ArtistProfile[];
  playlists?: Playlist[];
  currentTrackId?: string;
  isPlaying?: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onPlayTrack: (track: Track) => void;
  onSelectArtist?: (artistNameOrId: string) => void;
  onSelectPlaylist?: (playlistId: string) => void;
  onToggleLike?: (trackId: string) => void;
}

export const YouTubeMusicDiscovery: React.FC<YouTubeMusicDiscoveryProps> = ({
  tracks = [],
  albums = [],
  artists = [],
  playlists = [],
  currentTrackId,
  isPlaying = false,
  searchQuery = '',
  onSearchChange,
  onPlayTrack,
  onSelectArtist,
  onSelectPlaylist,
  onToggleLike,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'songs' | 'artists' | 'albums' | 'playlists' | 'charts'>('all');
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedCountry, setSelectedCountry] = useState<string>('US');

  // Live Discovery Search Results
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<{
    songs: any[];
    artists: any[];
    albums: any[];
    playlists: any[];
  }>({
    songs: [],
    artists: [],
    albums: [],
    playlists: [],
  });

  // Global Trending Charts & Moods
  const [charts, setCharts] = useState<any[]>([]);
  const [isLoadingCharts, setIsLoadingCharts] = useState<boolean>(false);

  // Album/Playlist View Modal
  const [activeReleaseModal, setActiveReleaseModal] = useState<{
    type: 'album' | 'playlist';
    id: string;
    title: string;
    artistOrCurator: string;
    coverUrl: string;
    year?: string;
    tracks: any[];
    isLoading: boolean;
  } | null>(null);

  // Sync external search query
  useEffect(() => {
    if (searchQuery !== localQuery) {
      setLocalQuery(searchQuery);
      if (searchQuery.trim().length >= 2) {
        performDiscoverySearch(searchQuery.trim());
      }
    }
  }, [searchQuery]);

  // Listen to custom search event from Navbar
  useEffect(() => {
    const handleSearchEvent = (e: any) => {
      const q = e.detail;
      if (q) {
        setLocalQuery(q);
        performDiscoverySearch(q);
      }
    };
    window.addEventListener('app:submit_search', handleSearchEvent);
    return () => window.removeEventListener('app:submit_search', handleSearchEvent);
  }, []);

  // Fetch initial charts if search query is empty
  useEffect(() => {
    if (!localQuery.trim()) {
      setIsLoadingCharts(true);
      api.getYouTubeMusicCharts()
        .then((res) => {
          if (res && Array.isArray(res.charts)) {
            setCharts(res.charts);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingCharts(false));
    }
  }, []);

  const performDiscoverySearch = useCallback(async (queryText: string) => {
    if (!queryText || !queryText.trim()) return;
    setIsSearching(true);
    try {
      const res = await api.searchYouTubeMusic(queryText.trim(), 'all', {
        country: selectedCountry,
        year: selectedYear,
        genre: selectedGenre,
      });

      if (res && res.results) {
        setSearchResults({
          songs: res.results.songs || [],
          artists: res.results.artists || [],
          albums: res.results.albums || [],
          playlists: res.results.playlists || [],
        });
      }
    } catch (err) {
      console.warn('Public music discovery search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [selectedCountry, selectedYear, selectedGenre]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (onSearchChange) onSearchChange(localQuery);
    performDiscoverySearch(localQuery);
  };

  // Convert discovered song into streaming track directly without downloading
  const playDiscoveredSong = (item: any) => {
    const vid = item.videoId || (item.id && item.id.startsWith('yt_') ? item.id.replace('yt_', '') : undefined);
    const streamableTrack: Track = {
      id: item.id || `yt_${vid || Math.random().toString(36).slice(2, 9)}`,
      videoId: vid,
      title: item.title,
      artist: item.artist || 'Artist',
      artistId: item.artistId || `art_${item.artist || 'unknown'}`,
      album: item.album || `${item.title} - Single`,
      duration: item.duration || 210,
      genre: item.genre || 'Music',
      coverUrl: resolveArtworkUrl(item.cover_url || item.coverUrl, 'track', item.title),
      audioUrl: vid ? `https://music.youtube.com/watch?v=c2gK9tq57iQ` : '',
      streams: typeof item.streams === 'number' ? item.streams : 120000,
      likes: 5400,
      releaseDate: item.release_date || `${item.release_year || new Date().getFullYear()}-01-01`,
      isExplicit: false,
      bpm: 120,
      moods: ['all'],
      isrc: 'USFLM2026001',
      upc: '012345678901',
      label: 'Official',
      distributor: 'Music',
    };
    onPlayTrack(streamableTrack);
  };

  // Open Album details and load tracks
  const handleOpenAlbum = async (alb: any) => {
    setActiveReleaseModal({
      type: 'album',
      id: alb.id || alb.browseId,
      title: alb.title,
      artistOrCurator: alb.artist || 'Artist',
      coverUrl: resolveArtworkUrl(alb.cover_url || alb.coverUrl, 'album', alb.title),
      year: alb.year ? String(alb.year) : undefined,
      tracks: [],
      isLoading: true,
    });

    try {
      const res = await api.getYouTubeMusicAlbum(alb.id || alb.browseId);
      if (res && res.album && Array.isArray(res.album.tracks)) {
        setActiveReleaseModal((prev) => (prev ? { ...prev, tracks: res.album.tracks, isLoading: false } : null));
      } else {
        setActiveReleaseModal((prev) => (prev ? { ...prev, isLoading: false } : null));
      }
    } catch {
      setActiveReleaseModal((prev) => (prev ? { ...prev, isLoading: false } : null));
    }
  };

  // Open Playlist details and load tracks
  const handleOpenPlaylist = async (pl: any) => {
    setActiveReleaseModal({
      type: 'playlist',
      id: pl.id || pl.browseId,
      title: pl.title,
      artistOrCurator: pl.curator || 'Curated',
      coverUrl: resolveArtworkUrl(pl.cover_url || pl.coverUrl, 'playlist', pl.title),
      tracks: [],
      isLoading: true,
    });

    try {
      const res = await api.getYouTubeMusicPlaylist(pl.id || pl.browseId);
      if (res && res.playlist && Array.isArray(res.playlist.tracks)) {
        setActiveReleaseModal((prev) => (prev ? { ...prev, tracks: res.playlist.tracks, isLoading: false } : null));
      } else {
        setActiveReleaseModal((prev) => (prev ? { ...prev, isLoading: false } : null));
      }
    } catch {
      setActiveReleaseModal((prev) => (prev ? { ...prev, isLoading: false } : null));
    }
  };

  const hasSearchResults =
    searchResults.songs.length > 0 ||
    searchResults.artists.length > 0 ||
    searchResults.albums.length > 0 ||
    searchResults.playlists.length > 0;

  return (
    <div className="space-y-6">
      {/* Category & Segmented Filter Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-neutral-900/40 border border-white/[0.08] backdrop-blur-sm">

        {/* Category & Segmented Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'all', label: 'All Results' },
              { id: 'songs', label: `Songs (${searchResults.songs.length})` },
              { id: 'artists', label: `Artists (${searchResults.artists.length})` },
              { id: 'albums', label: `Albums (${searchResults.albums.length})` },
              { id: 'playlists', label: `Playlists (${searchResults.playlists.length})` },
              { id: 'charts', label: 'Top Trending' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white text-black shadow-sm'
                    : 'bg-white/[0.05] text-neutral-300 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Region / Country selector */}
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Globe className="w-3.5 h-3.5 text-neutral-500" />
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                if (localQuery.trim()) performDiscoverySearch(localQuery);
              }}
              className="bg-neutral-900 border border-white/10 text-neutral-200 text-xs rounded-lg px-2 py-1 outline-none cursor-pointer"
            >
              <option value="US">United States (US)</option>
              <option value="GB">United Kingdom (UK)</option>
              <option value="NG">Nigeria (NG)</option>
              <option value="ZA">South Africa (ZA)</option>
              <option value="FR">France (FR)</option>
              <option value="DE">Germany (DE)</option>
              <option value="CA">Canada (CA)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isSearching && (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-red-500 mx-auto" />
          <p className="text-xs text-neutral-400 font-medium">Searching live music across artists, songs, and albums...</p>
        </div>
      )}

      {/* SEARCH RESULTS VIEW */}
      {!isSearching && hasSearchResults && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* SECTION: SONGS */}
          {(activeTab === 'all' || activeTab === 'songs') && searchResults.songs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Music className="w-4 h-4 text-red-500" />
                  <span>Songs</span>
                </h2>
                <span className="text-xs font-mono text-neutral-400">{searchResults.songs.length} results</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {searchResults.songs.map((item, idx) => {
                  const isCur = currentTrackId === item.id;
                  return (
                    <div
                      key={item.id || idx}
                      className="p-2.5 rounded-xl bg-neutral-900/40 hover:bg-white/[0.08] border border-white/[0.06] transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          onClick={() => playDiscoveredSong(item)}
                          className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-neutral-800 cursor-pointer group"
                        >
                          <img
                            src={resolveArtworkUrl(item.cover_url, 'track', item.title)}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => handleImageError(e, item.title, 'track')}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {isCur && isPlaying ? (
                              <Pause className="w-4 h-4 text-white fill-current" />
                            ) : (
                              <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                            )}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            onClick={() => playDiscoveredSong(item)}
                            className="font-semibold text-xs sm:text-sm text-white truncate cursor-pointer hover:text-red-400 transition-colors"
                          >
                            {item.title}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 truncate mt-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectArtist) onSelectArtist(item.artist);
                              }}
                              className="hover:text-white transition-colors truncate underline-offset-2 hover:underline"
                            >
                              {item.artist}
                            </button>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{item.album}</span>
                            {item.release_year && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono">{item.release_year}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.plays && (
                          <span className="text-[11px] font-mono text-neutral-400 hidden sm:inline">
                            {item.plays}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => playDiscoveredSong(item)}
                          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white text-white hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                          title="Stream Song"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION: ARTISTS */}
          {(activeTab === 'all' || activeTab === 'artists') && searchResults.artists.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Mic2 className="w-4 h-4 text-red-500" />
                  <span>Artists</span>
                </h2>
                <span className="text-xs font-mono text-neutral-400">{searchResults.artists.length} results</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {searchResults.artists.map((art, idx) => (
                  <div
                    key={art.id || idx}
                    onClick={() => {
                      if (onSelectArtist) onSelectArtist(art.id || art.name);
                    }}
                    className="p-4 rounded-2xl bg-neutral-900/40 hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 transition-all text-center group cursor-pointer"
                  >
                    <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden border-2 border-white/10 shadow-lg bg-neutral-800 mb-3 group-hover:scale-105 transition-transform">
                      <img
                        src={resolveArtworkUrl(art.avatar_url, 'artist', art.name)}
                        alt={art.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, art.name, 'artist')}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-red-400 transition-colors">
                      {art.name}
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                      {art.subscribers || 'Verified Artist'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION: ALBUMS & EPS */}
          {(activeTab === 'all' || activeTab === 'albums') && searchResults.albums.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Disc3 className="w-4 h-4 text-red-500" />
                  <span>Albums & EPs</span>
                </h2>
                <span className="text-xs font-mono text-neutral-400">{searchResults.albums.length} results</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {searchResults.albums.map((alb, idx) => (
                  <div
                    key={alb.id || idx}
                    onClick={() => handleOpenAlbum(alb)}
                    className="p-3 rounded-2xl bg-neutral-900/40 hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 transition-all group cursor-pointer"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 shadow-md mb-2.5 relative">
                      <img
                        src={resolveArtworkUrl(alb.cover_url, 'album', alb.title)}
                        alt={alb.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, alb.title, 'album')}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-6 h-6 text-white fill-current" />
                      </div>
                    </div>
                    <p className="font-semibold text-xs sm:text-sm text-white truncate group-hover:text-red-400 transition-colors">
                      {alb.title}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {alb.artist || 'Artist'} {alb.year && `· ${alb.year}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION: PLAYLISTS */}
          {(activeTab === 'all' || activeTab === 'playlists') && searchResults.playlists.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-red-500" />
                  <span>Playlists</span>
                </h2>
                <span className="text-xs font-mono text-neutral-400">{searchResults.playlists.length} results</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {searchResults.playlists.map((pl, idx) => (
                  <div
                    key={pl.id || idx}
                    onClick={() => handleOpenPlaylist(pl)}
                    className="p-3 rounded-2xl bg-neutral-900/40 hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 transition-all group cursor-pointer"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 shadow-md mb-2.5 relative">
                      <img
                        src={resolveArtworkUrl(pl.cover_url, 'playlist', pl.title)}
                        alt={pl.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, pl.title, 'playlist')}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-6 h-6 text-white fill-current" />
                      </div>
                    </div>
                    <p className="font-semibold text-xs sm:text-sm text-white truncate group-hover:text-red-400 transition-colors">
                      {pl.title}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {pl.curator || 'Curated'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TOP TRENDING CHARTS (When query is empty or on charts tab) */}
      {(!hasSearchResults || activeTab === 'charts') && !isSearching && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-500" />
              <h2 className="text-base sm:text-lg font-bold text-white">Top Trending Global Releases</h2>
            </div>
            <span className="text-xs text-neutral-400 font-mono">Live Charts</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {charts.map((track, idx) => (
              <div
                key={track.id || idx}
                onClick={() => playDiscoveredSong(track)}
                className="p-3 rounded-xl bg-neutral-900/40 hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-between gap-3 group cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 text-center text-xs font-mono font-bold text-neutral-500 group-hover:text-red-400">
                    {idx + 1}
                  </span>
                  <img
                    src={resolveArtworkUrl(track.cover_url, 'track', track.title)}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, track.title, 'track')}
                    className="w-11 h-11 rounded-lg object-cover bg-neutral-800 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-xs sm:text-sm text-white truncate group-hover:text-red-400 transition-colors">
                      {track.title}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate">
                      {track.artist}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-7 h-7 rounded-full bg-white/10 group-hover:bg-white text-white group-hover:text-black flex items-center justify-center shrink-0 transition-colors"
                >
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Album / Playlist Release Details Modal */}
      {activeReleaseModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f0f13] border border-white/15 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={activeReleaseModal.coverUrl}
                  alt={activeReleaseModal.title}
                  className="w-20 h-20 rounded-2xl object-cover bg-neutral-800 shrink-0 shadow-lg"
                />
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/10 text-neutral-300">
                    {activeReleaseModal.type === 'album' ? 'Album' : 'Playlist'} {activeReleaseModal.year && `· ${activeReleaseModal.year}`}
                  </span>
                  <h3 className="text-base sm:text-lg font-extrabold text-white mt-1 truncate">
                    {activeReleaseModal.title}
                  </h3>
                  <p className="text-xs text-neutral-400 truncate">{activeReleaseModal.artistOrCurator}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveReleaseModal(null)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {activeReleaseModal.isLoading ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-red-500 mx-auto" />
                  <p className="text-xs text-neutral-400">Loading tracklist...</p>
                </div>
              ) : activeReleaseModal.tracks.length === 0 ? (
                <p className="text-xs text-neutral-500 py-10 text-center">No tracks available in this release.</p>
              ) : (
                activeReleaseModal.tracks.map((t: any, idx: number) => (
                  <div
                    key={t.id || idx}
                    onClick={() => {
                      playDiscoveredSong({
                        ...t,
                        artist: t.artist || activeReleaseModal.artistOrCurator,
                        album: activeReleaseModal.title,
                        cover_url: t.cover_url || activeReleaseModal.coverUrl,
                      });
                    }}
                    className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] flex items-center justify-between gap-3 cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-neutral-500 w-5">{idx + 1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate group-hover:text-red-400 transition-colors">
                          {t.title}
                        </p>
                        <p className="text-[11px] text-neutral-400 truncate">
                          {t.artist || activeReleaseModal.artistOrCurator}
                        </p>
                      </div>
                    </div>
                    <Play className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
