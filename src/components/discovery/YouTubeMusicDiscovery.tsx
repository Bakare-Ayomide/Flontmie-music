import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Flame, 
  Music, 
  Mic2, 
  Disc3, 
  ListMusic, 
  Play, 
  Plus, 
  Check, 
  FileText, 
  Sparkles, 
  Radio, 
  Loader2, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  X
} from 'lucide-react';
import { Track } from '../../types/music';
import { api } from '../../services/api';

interface YouTubeMusicDiscoveryProps {
  onPlayTrack: (track: Track) => void;
  onImportTrack?: (track: Track) => void;
  onSelectMood?: (mood: string) => void;
  onViewArtist?: (artistName: string) => void;
}

export const YouTubeMusicDiscovery: React.FC<YouTubeMusicDiscoveryProps> = ({
  onPlayTrack,
  onImportTrack,
  onSelectMood,
  onViewArtist,
}) => {
  const [activeTab, setActiveTab] = useState<'charts' | 'search' | 'moods'>('charts');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<'songs' | 'artists' | 'albums' | 'playlists'>('songs');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    songs: any[];
    artists: any[];
    albums: any[];
    playlists: any[];
  }>({
    songs: [],
    artists: [],
    albums: [],
    playlists: []
  });

  const [charts, setCharts] = useState<Array<{
    id: string;
    videoId?: string;
    title: string;
    artist: string;
    cover_url: string;
    shelf: string;
    streams: number;
  }>>([]);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);

  const [moods, setMoods] = useState<Array<{ name: string; browseId: string; color: string }>>([]);
  const [isLoadingMoods, setIsLoadingMoods] = useState(false);

  const [lyricsModal, setLyricsModal] = useState<{
    title: string;
    artist: string;
    lyrics: string;
    source: string;
    isOpen: boolean;
    isLoading: boolean;
  }>({
    title: '',
    artist: '',
    lyrics: '',
    source: '',
    isOpen: false,
    isLoading: false
  });

  // Artist & Discography Modal State
  const [selectedArtist, setSelectedArtist] = useState<{
    isOpen: boolean;
    isLoading: boolean;
    artist: any;
    topSongs: any[];
    albums: any[];
    singles: any[];
  }>({
    isOpen: false,
    isLoading: false,
    artist: null,
    topSongs: [],
    albums: [],
    singles: []
  });

  // Album Tracklist Modal State
  const [selectedAlbum, setSelectedAlbum] = useState<{
    isOpen: boolean;
    isLoading: boolean;
    album: any;
  }>({
    isOpen: false,
    isLoading: false,
    album: null
  });

  // Playlist & Tracks Modal State
  const [selectedPlaylist, setSelectedPlaylist] = useState<{
    isOpen: boolean;
    isLoading: boolean;
    playlist: any;
  }>({
    isOpen: false,
    isLoading: false,
    playlist: null
  });

  const [importingIds, setImportingIds] = useState<Record<string, boolean>>({});
  const [importedIds, setImportedIds] = useState<Record<string, boolean>>({});

  // Load Charts on mount
  useEffect(() => {
    setIsLoadingCharts(true);
    api.getYouTubeMusicCharts()
      .then((res) => {
        if (res && res.charts) {
          setCharts(res.charts);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingCharts(false));

    // Load Moods
    setIsLoadingMoods(true);
    api.getYouTubeMusicMoods()
      .then((res) => {
        if (res && res.moods_and_genres) {
          setMoods(res.moods_and_genres);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingMoods(false));
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setActiveTab('search');
    try {
      const res = await api.searchYouTubeMusic(searchQuery.trim(), searchFilter);
      if (res && res.results) {
        setSearchResults(res.results);
      }
    } catch (err) {
      console.warn('YouTube Music search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePlayYouTubeSong = (song: any) => {
    const trackObj: Track = {
      id: song.id || `yt_${song.videoId || Date.now()}`,
      title: song.title || 'Untitled',
      artist: song.artist || 'YouTube Music Artist',
      artistId: `art_${(song.artist || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      album: song.album || 'YouTube Music Discovery',
      duration: Number(song.duration) || 210,
      genre: (song.genre || 'pop') as any,
      coverUrl: song.cover_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      audioUrl: song.audio_url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      streams: Number(song.streams) || (typeof song.plays === 'string' ? parseInt(song.plays.replace(/[^0-9]/g, '')) || 250000 : 250000),
      likes: Math.floor((Number(song.streams) || 250000) * 0.08),
      releaseDate: new Date().toISOString().split('T')[0],
      isrc: 'US-YT-26-' + Math.floor(10000 + Math.random() * 90000),
      upc: '012345678901',
      bpm: 120,
      moods: ['trending', 'party'] as any[],
      label: 'YouTube Music / Flontmie Stream',
      distributor: 'YouTube Music Global Feed'
    };
    onPlayTrack(trackObj);
  };

  const handleImport = async (item: any) => {
    const key = item.id || item.videoId || item.title;
    setImportingIds((prev) => ({ ...prev, [key]: true }));

    try {
      const res = await api.importYouTubeMusicTrack({
        title: item.title,
        artist: item.artist,
        album: item.album || `${item.title} - Single`,
        genre: item.genre || 'Pop',
        duration: item.duration || 210,
        cover_url: item.cover_url,
        videoId: item.videoId
      });

      if (res && res.track) {
        setImportedIds((prev) => ({ ...prev, [key]: true }));
        if (onImportTrack) {
          onImportTrack(res.track);
        }
      }
    } catch (e) {
      console.warn('Import failed:', e);
    } finally {
      setImportingIds((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleFetchLyrics = async (item: any) => {
    const videoId = item.videoId || item.id?.replace(/^yt_/, '');
    if (!videoId) return;

    setLyricsModal({
      title: item.title,
      artist: item.artist,
      lyrics: '',
      source: '',
      isOpen: true,
      isLoading: true
    });

    try {
      const res = await api.getYouTubeMusicLyrics(videoId);
      if (res && res.lyrics) {
        setLyricsModal((prev) => ({
          ...prev,
          lyrics: res.lyrics,
          source: res.source || 'YouTube Music Verified Lyrics',
          isLoading: false
        }));
      } else {
        setLyricsModal((prev) => ({
          ...prev,
          lyrics: 'Lyrics unavailable for this track at this moment.',
          source: 'YouTube Music',
          isLoading: false
        }));
      }
    } catch {
      setLyricsModal((prev) => ({
        ...prev,
        lyrics: 'Could not fetch lyrics from YouTube Music server.',
        source: 'Error',
        isLoading: false
      }));
    }
  };

  const handleOpenArtist = async (art: any) => {
    const browseId = art.id?.startsWith('UC') ? art.id : '';
    setSelectedArtist({
      isOpen: true,
      isLoading: true,
      artist: {
        name: art.name,
        avatar_url: art.avatar_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
        subscribers: art.subscribers || 'YouTube Music Verified Artist',
        description: ''
      },
      topSongs: [],
      albums: [],
      singles: []
    });

    try {
      const res = await api.getYouTubeMusicArtist(browseId, art.name);
      if (res && res.status === 'success') {
        setSelectedArtist({
          isOpen: true,
          isLoading: false,
          artist: res.artist || { name: art.name, avatar_url: art.avatar_url },
          topSongs: res.top_songs || [],
          albums: res.albums || [],
          singles: res.singles || []
        });
      }
    } catch (e) {
      console.warn('Failed to load artist:', e);
      setSelectedArtist((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleOpenAlbum = async (alb: any) => {
    setSelectedAlbum({
      isOpen: true,
      isLoading: true,
      album: {
        title: alb.title,
        artist: alb.artist,
        cover_url: alb.cover_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
        year: alb.year || '2026',
        tracks: []
      }
    });

    try {
      const browseId = alb.browseId || alb.id;
      const res = await api.getYouTubeMusicAlbum(browseId);
      if (res && res.album) {
        setSelectedAlbum({
          isOpen: true,
          isLoading: false,
          album: res.album
        });
      }
    } catch (e) {
      console.warn('Failed to load album:', e);
      setSelectedAlbum((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleOpenPlaylist = async (pl: any) => {
    setSelectedPlaylist({
      isOpen: true,
      isLoading: true,
      playlist: {
        title: pl.title,
        curator: pl.curator || 'YouTube Music Editorial',
        cover_url: pl.cover_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
        description: 'Curated YouTube Music stream',
        tracks: []
      }
    });

    try {
      const browseId = pl.browseId || pl.id;
      const res = await api.getYouTubeMusicPlaylist(browseId);
      if (res && res.playlist) {
        setSelectedPlaylist({
          isOpen: true,
          isLoading: false,
          playlist: res.playlist
        });
      }
    } catch (e) {
      console.warn('Failed to load playlist:', e);
      setSelectedPlaylist((prev) => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Header Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-950/30 via-neutral-900/60 to-neutral-900/40 border border-white/[0.08] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">YouTube Music Global Discovery</h3>
                <span className="text-[10px] font-mono uppercase bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">
                  ytmusicapi
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Discover songs, certified charts, artist discographies, moods, and lyrics in real time
              </p>
            </div>
          </div>

          {/* Tab selector */}
          <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/10 shrink-0 text-xs">
            <button
              onClick={() => setActiveTab('charts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === 'charts' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Charts</span>
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === 'search' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search API</span>
            </button>
            <button
              onClick={() => setActiveTab('moods')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === 'moods' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Moods & Genres</span>
            </button>
          </div>
        </div>

        {/* Search input form */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search YouTube Music for songs, artists, albums, or playlists..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto py-0.5">
            {[
              { id: 'songs', label: 'Songs', icon: Music },
              { id: 'artists', label: 'Artists', icon: Mic2 },
              { id: 'albums', label: 'Albums', icon: Disc3 },
              { id: 'playlists', label: 'Playlists', icon: ListMusic },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setSearchFilter(f.id as any);
                    if (searchQuery.trim()) {
                      api.searchYouTubeMusic(searchQuery.trim(), f.id as any).then((res) => {
                        if (res && res.results) setSearchResults(res.results);
                      });
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors border ${
                    searchFilter === f.id
                      ? 'bg-white/15 text-white border-white/20'
                      : 'bg-white/[0.03] text-neutral-400 border-white/[0.06] hover:text-white'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{f.label}</span>
                </button>
              );
            })}

            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-40"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Search</span>
            </button>
          </div>
        </form>
      </div>

      {/* VIEW 1: CHARTS */}
      {activeTab === 'charts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-500" />
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                Official YouTube Music Trending Charts
              </h3>
            </div>
            <span className="text-[11px] text-neutral-500 font-mono">FEmusic_charts Innertube</span>
          </div>

          {isLoadingCharts ? (
            <div className="py-12 flex flex-col items-center justify-center text-neutral-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-red-500" />
              <p className="text-xs">Fetching global chart data from YouTube Music...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {charts.map((track, i) => {
                const key = track.id || track.videoId || track.title;
                const isImported = Boolean(importedIds[key]);
                const isImporting = Boolean(importingIds[key]);

                return (
                  <div
                    key={track.id || i}
                    className="p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all group flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`font-mono w-5 text-center shrink-0 font-bold ${i < 3 ? 'text-red-400' : 'text-neutral-500'}`}>
                        {i + 1}
                      </span>
                      <img
                        src={track.cover_url}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover shrink-0 bg-neutral-800"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate text-xs group-hover:text-red-400 transition-colors">
                          {track.title}
                        </p>
                        <p className="text-[11px] text-neutral-400 truncate">{track.artist}</p>
                        <span className="text-[10px] font-mono text-neutral-500">
                          {(Number(track.streams) || 0).toLocaleString()} streams
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {track.videoId && (
                        <button
                          onClick={() => handleFetchLyrics(track)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="View Lyrics"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => handlePlayYouTubeSong(track)}
                        className="p-2 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-transform"
                        title="Stream Track"
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>

                      <button
                        onClick={() => handleImport(track)}
                        disabled={isImported || isImporting}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          isImported
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-neutral-400 hover:text-white hover:bg-white/10'
                        }`}
                        title={isImported ? 'Added to MySQL' : 'Import to Catalog'}
                      >
                        {isImporting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isImported ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: SEARCH RESULTS */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          {/* Songs list */}
          {searchResults.songs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-red-500" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    YouTube Music Songs ({searchResults.songs.length})
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {searchResults.songs.map((song) => {
                  const key = song.id || song.videoId || song.title;
                  const isImported = Boolean(importedIds[key]);
                  const isImporting = Boolean(importingIds[key]);

                  return (
                    <div
                      key={key}
                      className="p-3 rounded-xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={song.cover_url}
                          alt={song.title}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover shrink-0 bg-neutral-800"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate text-xs hover:text-red-400 cursor-pointer">
                            {song.title}
                          </p>
                          <p className="text-[11px] text-neutral-400 truncate">{song.artist}</p>
                          <p className="text-[10px] text-neutral-500 truncate">{song.plays || song.album}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {song.videoId && (
                          <button
                            onClick={() => handleFetchLyrics(song)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10"
                            title="View Lyrics"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handlePlayYouTubeSong(song)}
                          className="p-2 rounded-full bg-white text-black hover:scale-105 transition-transform"
                          title="Stream Now"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                        <button
                          onClick={() => handleImport(song)}
                          disabled={isImported || isImporting}
                          className={`p-1.5 rounded-lg text-xs ${
                            isImported ? 'text-emerald-400 bg-emerald-500/10' : 'text-neutral-400 hover:text-white hover:bg-white/10'
                          }`}
                          title="Import into Flontmie Catalog"
                        >
                          {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isImported ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Artists */}
          {searchResults.artists.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                <Mic2 className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Artists & Discographies ({searchResults.artists.length})
                </h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {searchResults.artists.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => handleOpenArtist(art)}
                    className="p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all text-center cursor-pointer group"
                  >
                    <img
                      src={art.avatar_url}
                      alt={art.name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full mx-auto object-cover mb-2 border border-white/10 group-hover:scale-105 transition-transform"
                    />
                    <p className="text-xs font-bold text-white truncate group-hover:text-purple-400">{art.name}</p>
                    <p className="text-[10px] text-neutral-400 truncate">{art.subscribers || 'Artist'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Albums */}
          {searchResults.albums.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                <Disc3 className="w-4 h-4 text-blue-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Albums & Singles ({searchResults.albums.length})
                </h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {searchResults.albums.map((alb) => (
                  <div
                    key={alb.id}
                    onClick={() => handleOpenAlbum(alb)}
                    className="p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all group cursor-pointer"
                  >
                    <img
                      src={alb.cover_url}
                      alt={alb.title}
                      referrerPolicy="no-referrer"
                      className="w-full aspect-square rounded-xl object-cover mb-2 border border-white/10 group-hover:scale-105 transition-transform"
                    />
                    <p className="text-xs font-bold text-white truncate group-hover:text-blue-400">{alb.title}</p>
                    <p className="text-[10px] text-neutral-400 truncate">{alb.artist}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playlists */}
          {searchResults.playlists.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                <ListMusic className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Playlists & Playlist Tracks ({searchResults.playlists.length})
                </h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {searchResults.playlists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => handleOpenPlaylist(pl)}
                    className="p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all group cursor-pointer"
                  >
                    <img
                      src={pl.cover_url}
                      alt={pl.title}
                      referrerPolicy="no-referrer"
                      className="w-full aspect-square rounded-xl object-cover mb-2 border border-white/10 group-hover:scale-105 transition-transform"
                    />
                    <p className="text-xs font-bold text-white truncate group-hover:text-emerald-400">{pl.title}</p>
                    <p className="text-[10px] text-neutral-400 truncate">{pl.curator}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isSearching && searchResults.songs.length === 0 && searchResults.artists.length === 0 && (
            <div className="py-12 text-center text-neutral-400 space-y-2">
              <Search className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-xs">Type a title or artist name above and click "Search" to discover from YouTube Music.</p>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: MOODS & GENRES */}
      {activeTab === 'moods' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                YouTube Music Moods & Genre Shelves
              </h3>
            </div>
            <span className="text-[11px] text-neutral-500 font-mono">FEmusic_moods_and_genres</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {moods.map((m) => (
              <div
                key={m.name}
                onClick={() => {
                  setSearchQuery(m.name);
                  setActiveTab('search');
                  api.searchYouTubeMusic(m.name, 'songs').then((res) => {
                    if (res && res.results) setSearchResults(res.results);
                  });
                }}
                style={{
                  background: `linear-gradient(135deg, ${m.color}22 0%, rgba(20,20,24,0.8) 100%)`,
                  borderColor: `${m.color}44`
                }}
                className="p-4 rounded-2xl border hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer group"
              >
                <h4 className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">
                  {m.name}
                </h4>
                <div className="flex items-center justify-between mt-3 text-[11px] text-neutral-400">
                  <span>Explore Shelf</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Synchronized Lyrics Viewer Modal */}
      {lyricsModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#121215] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-red-500" />
                  <h3 className="text-sm font-bold text-white truncate max-w-xs">{lyricsModal.title}</h3>
                </div>
                <p className="text-xs text-neutral-400">Lyrics by {lyricsModal.artist} · {lyricsModal.source}</p>
              </div>
              <button
                onClick={() => setLyricsModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {lyricsModal.isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-2 text-neutral-400">
                <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                <p className="text-xs">Extracting verified lyrics from YouTube Music...</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto pr-2 space-y-2 font-sans text-sm text-neutral-200 leading-relaxed whitespace-pre-line selection:bg-red-500/30">
                {lyricsModal.lyrics}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Artist & Discography Viewer Modal */}
      {selectedArtist.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-3xl max-h-[85vh] bg-[#121215] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="relative p-5 sm:p-6 bg-gradient-to-b from-neutral-800/80 to-transparent border-b border-white/[0.08] flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={selectedArtist.artist?.avatar_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600'}
                  alt={selectedArtist.artist?.name}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-white/10 shadow-lg shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-extrabold text-white truncate">
                      {selectedArtist.artist?.name}
                    </h2>
                    <span className="text-[10px] uppercase font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                      YouTube Music
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    {selectedArtist.artist?.subscribers || 'Artist'} · Official Discography
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedArtist((prev) => ({ ...prev, isOpen: false }))}
                className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {selectedArtist.isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-2 text-neutral-400">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                  <p className="text-xs">Loading discography and top tracks from YouTube Music...</p>
                </div>
              ) : (
                <>
                  {/* Top Songs */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-red-500" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Top Songs & Popular Tracks</h4>
                      </div>
                      <span className="text-[11px] text-neutral-500 font-mono">{selectedArtist.topSongs.length} Songs</span>
                    </div>

                    <div className="space-y-1.5">
                      {selectedArtist.topSongs.map((song, i) => {
                        const key = song.id || song.videoId || song.title;
                        const isImported = Boolean(importedIds[key]);
                        const isImporting = Boolean(importingIds[key]);

                        return (
                          <div
                            key={key || i}
                            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors group text-xs"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono text-neutral-500 w-5 text-center shrink-0">{i + 1}</span>
                              <img
                                src={song.cover_url}
                                alt={song.title}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-lg object-cover shrink-0 bg-neutral-800"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-white truncate group-hover:text-red-400 transition-colors">
                                  {song.title}
                                </p>
                                <p className="text-[11px] text-neutral-400 truncate">{song.plays || song.artist}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {song.videoId && (
                                <button
                                  onClick={() => handleFetchLyrics(song)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10"
                                  title="View Lyrics"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handlePlayYouTubeSong(song)}
                                className="p-2 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-transform"
                                title="Play Track"
                              >
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              </button>
                              <button
                                onClick={() => handleImport(song)}
                                disabled={isImported || isImporting}
                                className={`p-1.5 rounded-lg text-xs ${
                                  isImported ? 'text-emerald-400 bg-emerald-500/10' : 'text-neutral-400 hover:text-white hover:bg-white/10'
                                }`}
                                title="Import into MySQL Catalog"
                              >
                                {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isImported ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Albums and Singles */}
                  {(selectedArtist.albums.length > 0 || selectedArtist.singles.length > 0) && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                        <Disc3 className="w-4 h-4 text-blue-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Albums, EPs & Singles</h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[...selectedArtist.albums, ...selectedArtist.singles].map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleOpenAlbum(item)}
                            className="p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group"
                          >
                            <img
                              src={item.cover_url}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full aspect-square rounded-xl object-cover mb-2 border border-white/10 group-hover:scale-105 transition-transform"
                            />
                            <p className="text-xs font-bold text-white truncate group-hover:text-blue-400">{item.title}</p>
                            <p className="text-[10px] text-neutral-400 truncate">{item.year || 'Album'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Album Detail Modal */}
      {selectedAlbum.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[85vh] bg-[#121215] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 sm:p-6 bg-gradient-to-b from-blue-950/40 to-transparent border-b border-white/[0.08] flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={selectedAlbum.album?.cover_url}
                  alt={selectedAlbum.album?.title}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-white/10 shadow-lg shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white truncate">{selectedAlbum.album?.title}</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    {selectedAlbum.album?.artist} · {selectedAlbum.album?.year || 'Album'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAlbum((prev) => ({ ...prev, isOpen: false }))}
                className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
              {selectedAlbum.isLoading ? (
                <div className="py-16 flex flex-col items-center justify-center space-y-2 text-neutral-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  <p className="text-xs">Fetching album tracklist from YouTube Music...</p>
                </div>
              ) : selectedAlbum.album?.tracks?.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 text-xs">
                  No individual tracks listed. Use Search to explore songs directly.
                </div>
              ) : (
                selectedAlbum.album?.tracks?.map((track: any, i: number) => {
                  const key = track.id || track.videoId || track.title;
                  const isImported = Boolean(importedIds[key]);
                  const isImporting = Boolean(importingIds[key]);

                  return (
                    <div
                      key={key || i}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors text-xs group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-neutral-500 w-5 text-center shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate group-hover:text-blue-400">{track.title}</p>
                          <p className="text-[11px] text-neutral-400 truncate">{track.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handlePlayYouTubeSong(track)}
                          className="p-2 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-transform"
                          title="Play Track"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                        <button
                          onClick={() => handleImport(track)}
                          disabled={isImported || isImporting}
                          className={`p-1.5 rounded-lg text-xs ${
                            isImported ? 'text-emerald-400 bg-emerald-500/10' : 'text-neutral-400 hover:text-white hover:bg-white/10'
                          }`}
                          title="Import into MySQL Catalog"
                        >
                          {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isImported ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Playlist & Tracks Modal */}
      {selectedPlaylist.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[85vh] bg-[#121215] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 sm:p-6 bg-gradient-to-b from-emerald-950/40 to-transparent border-b border-white/[0.08] flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={selectedPlaylist.playlist?.cover_url}
                  alt={selectedPlaylist.playlist?.title}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-white/10 shadow-lg shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white truncate">{selectedPlaylist.playlist?.title}</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    {selectedPlaylist.playlist?.curator} · YouTube Music Curated
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlaylist((prev) => ({ ...prev, isOpen: false }))}
                className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
              {selectedPlaylist.isLoading ? (
                <div className="py-16 flex flex-col items-center justify-center space-y-2 text-neutral-400">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <p className="text-xs">Fetching playlist tracks from YouTube Music...</p>
                </div>
              ) : selectedPlaylist.playlist?.tracks?.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 text-xs">
                  No tracks available for this playlist.
                </div>
              ) : (
                selectedPlaylist.playlist?.tracks?.map((track: any, i: number) => {
                  const key = track.id || track.videoId || track.title;
                  const isImported = Boolean(importedIds[key]);
                  const isImporting = Boolean(importingIds[key]);

                  return (
                    <div
                      key={key || i}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors text-xs group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-neutral-500 w-5 text-center shrink-0">{i + 1}</span>
                        <img
                          src={track.cover_url}
                          alt={track.title}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-lg object-cover shrink-0 bg-neutral-800"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate group-hover:text-emerald-400">{track.title}</p>
                          <p className="text-[11px] text-neutral-400 truncate">{track.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handlePlayYouTubeSong(track)}
                          className="p-2 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-transform"
                          title="Play Track"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                        <button
                          onClick={() => handleImport(track)}
                          disabled={isImported || isImporting}
                          className={`p-1.5 rounded-lg text-xs ${
                            isImported ? 'text-emerald-400 bg-emerald-500/10' : 'text-neutral-400 hover:text-white hover:bg-white/10'
                          }`}
                          title="Import into MySQL Catalog"
                        >
                          {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isImported ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
