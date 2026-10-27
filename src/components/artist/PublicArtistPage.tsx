import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Shuffle, 
  Heart, 
  Plus, 
  Share2, 
  ShieldCheck, 
  Globe, 
  Instagram, 
  Twitter, 
  ArrowLeft, 
  Disc, 
  ListMusic, 
  Users, 
  Disc3,
  BookOpen, 
  BarChart3, 
  Loader2, 
  X,
  Check,
  Radio,
  ExternalLink
} from 'lucide-react';
import { ArtistProfile, Track, ArtistDiscographyItem, RelatedArtistItem } from '../../types/music';
import { api } from '../../services/api';
import { resolveArtworkUrl, handleImageError } from '../../utils/artwork';
import { formatCompactNumber } from '../../utils/formatters';

interface PublicArtistPageProps {
  artist: ArtistProfile;
  tracks: Track[];
  onPlayTrack: (track: Track) => void;
  onPlayAll: (tracks: Track[]) => void;
  onShuffleAll: (tracks: Track[]) => void;
  onToggleLike: (trackId: string) => void;
  likedTrackIds: string[];
  onAddToQueue: (track: Track) => void;
  onOpenAddToPlaylist: (track: Track) => void;
  onOpenShareModal: () => void;
  onBack: () => void;
  onSelectAlbum?: (albumTitle: string) => void;
  onSelectArtist?: (artistIdOrName: string) => void;
  onSelectPlaylist?: (playlistId: string) => void;
}

export const PublicArtistPage: React.FC<PublicArtistPageProps> = ({
  artist: initialArtist,
  tracks: catalogTracks,
  onPlayTrack,
  onPlayAll,
  onShuffleAll,
  onToggleLike,
  likedTrackIds,
  onAddToQueue,
  onOpenAddToPlaylist,
  onOpenShareModal,
  onBack,
  onSelectAlbum,
  onSelectArtist,
  onSelectPlaylist,
}) => {
  const [enrichedArtist, setEnrichedArtist] = useState<ArtistProfile>(initialArtist);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  const [isFollowing, setIsFollowing] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const key = `flontmie_follow_${initialArtist.id || initialArtist.name}`;
    return localStorage.getItem(key) === 'true';
  });
  const [followersCount, setFollowersCount] = useState<number>(
    typeof initialArtist.followers === 'number' && initialArtist.followers >= 0
      ? initialArtist.followers
      : 0
  );

  // Release Tracklist Modal state when user clicks any Album, Single/EP, or Featured item
  const [selectedRelease, setSelectedRelease] = useState<ArtistDiscographyItem | null>(null);
  const [releaseTracks, setReleaseTracks] = useState<Track[]>([]);
  const [isLoadingRelease, setIsLoadingRelease] = useState<boolean>(false);

  // Fetch enriched artist profile & discography
  useEffect(() => {
    let isMounted = true;
    setEnrichedArtist(initialArtist);
    setIsLoadingProfile(true);
    setSelectedRelease(null);

    const lookupId = initialArtist.id || initialArtist.ytBrowseId || initialArtist.name;
    api.getArtistById(lookupId)
      .then((fetched) => {
        if (!isMounted) return;
        if (fetched) {
          setEnrichedArtist(fetched);
          if (typeof fetched.followers === 'number' && fetched.followers > 0) {
            setFollowersCount(fetched.followers);
          }
        }
      })
      .catch((err) => {
        console.warn('Artist load warning:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingProfile(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialArtist.id, initialArtist.name]);

  const artist = enrichedArtist || initialArtist;

  // Deduplicated Popular Songs combining API popularSongs + matching catalog tracks
  const popularSongs: Track[] = useMemo(() => {
    const combined: Track[] = [];
    const seen = new Set<string>();

    const addTrack = (t: Track) => {
      if (!t || !t.title) return;
      const key = `${t.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      if (seen.has(key)) return;
      seen.add(key);
      combined.push(t);
    };

    if (Array.isArray(artist.popularSongs)) {
      artist.popularSongs.forEach(addTrack);
    }

    catalogTracks
      .filter(
        (t) =>
          t &&
          (t.artistId === artist.id ||
            (t.artist || '').toLowerCase() === (artist.name || '').toLowerCase())
      )
      .forEach(addTrack);

    return combined;
  }, [artist, catalogTracks]);

  // Albums section
  const albumsSection: ArtistDiscographyItem[] = useMemo(() => {
    const list: ArtistDiscographyItem[] = [];
    const seen = new Set<string>();

    if (Array.isArray(artist.albums)) {
      artist.albums.forEach((alb) => {
        const key = (alb.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        list.push(alb);
      });
    }

    if (list.length === 0) {
      popularSongs.forEach((t) => {
        if (!t.album || t.album.toLowerCase().includes('single')) return;
        const key = t.album.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        list.push({
          id: `alb_${key}`,
          title: t.album,
          artist: artist.name,
          year: t.releaseDate ? t.releaseDate.split('-')[0] : undefined,
          type: 'Album',
          coverUrl: t.coverUrl,
        });
      });
    }

    return list;
  }, [artist.albums, artist.name, popularSongs]);

  // Singles & EPs section
  const singlesEpsSection: ArtistDiscographyItem[] = useMemo(() => {
    const list: ArtistDiscographyItem[] = [];
    const seen = new Set<string>();

    if (Array.isArray(artist.singlesEps)) {
      artist.singlesEps.forEach((s) => {
        const key = (s.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        list.push(s);
      });
    }

    if (list.length === 0) {
      popularSongs.forEach((t) => {
        const key = (t.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        list.push({
          id: `sng_${t.id}`,
          title: t.title,
          artist: artist.name,
          year: t.releaseDate ? t.releaseDate.split('-')[0] : undefined,
          type: 'Single',
          coverUrl: t.coverUrl,
        });
      });
    }

    return list;
  }, [artist.singlesEps, artist.name, popularSongs]);

  // Featured Appearances section
  const featuredOnSection: ArtistDiscographyItem[] = useMemo(() => {
    const list: ArtistDiscographyItem[] = [];
    const seen = new Set<string>();
    if (Array.isArray(artist.featuredOn)) {
      artist.featuredOn.forEach((f) => {
        const key = (f.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        list.push(f);
      });
    }
    return list;
  }, [artist.featuredOn]);

  // Playlists section
  const playlistsSection: ArtistDiscographyItem[] = useMemo(() => {
    const list: ArtistDiscographyItem[] = [];
    const seen = new Set<string>();
    if (Array.isArray(artist.playlists)) {
      artist.playlists.forEach((p) => {
        const key = (p.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        list.push(p);
      });
    }
    return list;
  }, [artist.playlists]);

  // Similar Artists section
  const similarArtistsSection: RelatedArtistItem[] = useMemo(() => {
    const list: RelatedArtistItem[] = [];
    const seen = new Set<string>();
    if (Array.isArray(artist.relatedArtists)) {
      artist.relatedArtists.forEach((r) => {
        const key = (r.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        list.push(r);
      });
    }
    return list;
  }, [artist.relatedArtists]);

  // Functional Follow / Unfollow Handler
  const handleToggleFollow = () => {
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    setFollowersCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    try {
      const key = `flontmie_follow_${artist.id || artist.name}`;
      localStorage.setItem(key, String(nextState));
    } catch {}
  };

  const handleOpenRelease = async (item: ArtistDiscographyItem) => {
    setSelectedRelease(item);
    if (item.tracks && item.tracks.length > 0) {
      setReleaseTracks(item.tracks);
      return;
    }

    const localMatches = popularSongs.filter(
      (t) =>
        (t.album || '').toLowerCase() === (item.title || '').toLowerCase() ||
        (t.title || '').toLowerCase() === (item.title || '').toLowerCase()
    );

    if (item.browseId) {
      setIsLoadingRelease(true);
      const res = await api.getReleaseTracks(item.browseId, item.title, artist.name, item.coverUrl);
      setIsLoadingRelease(false);
      if (res && res.tracks.length > 0) {
        setReleaseTracks(res.tracks);
        return;
      }
    }

    setReleaseTracks(localMatches);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor((secs || 0) / 60);
    const s = Math.floor((secs || 0) % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const resolvedAvatar = resolveArtworkUrl(artist.avatarUrl, 'artist', artist.name);
  const resolvedHeader = resolveArtworkUrl(artist.headerUrl || artist.avatarUrl, 'artist', artist.name);
  const realArtistStreams = popularSongs.reduce((sum, t) => sum + (Number(t.flontmiePlays ?? t.streams) || 0), 0);
  const monthlyListenersDisplay = formatCompactNumber(artist.flontmieStreams ?? realArtistStreams);
  const totalStreamsDisplay = formatCompactNumber(artist.flontmieStreams ?? realArtistStreams);
  const followersDisplay = formatCompactNumber(followersCount);

  return (
    <div className="pb-32 animate-in fade-in duration-200 space-y-8 sm:space-y-12">
      {/* 1. FULL-WIDTH ARTIST IMAGE AT THE TOP FADING NATURALLY INTO BLACK */}
      <div className="relative -mx-3 sm:-mx-6 md:-mx-8 lg:-mx-10 -mt-2 sm:-mt-4 min-h-[360px] sm:min-h-[440px] md:min-h-[500px] flex flex-col justify-between p-4 sm:p-8 md:p-12 overflow-hidden bg-black select-none">
        {/* Full-width High-Res Artist Header Image */}
        <img
          src={resolvedHeader}
          alt={artist.name}
          referrerPolicy="no-referrer"
          onError={(e) => handleImageError(e, artist.name, 'artist')}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-65 scale-102"
        />

        {/* Multi-stop Natural Dark Fade into Black (#030303) */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/75 via-45% to-black/35 pointer-events-none" />
        <div className="absolute inset-0 bg-radial-at-t from-transparent via-[#030303]/40 to-[#030303] pointer-events-none" />

        {/* Top Floating Navigation Bar */}
        <div className="relative z-10 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/60 hover:bg-white/10 text-white border border-white/15 backdrop-blur-md text-xs font-semibold transition-all cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back</span>
          </button>

          {isLoadingProfile && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-md text-[11px] text-neutral-300">
              <Loader2 className="w-3 h-3 animate-spin text-red-500" />
              <span>Updating profile...</span>
            </div>
          )}
        </div>

        {/* Artist Identity & Details Layered Elegantly Over the Fade */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end gap-5 sm:gap-8 pt-12 sm:pt-0">
          {/* Avatar Photo */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl shrink-0 bg-neutral-900 shadow-black/80">
            <img
              src={resolvedAvatar}
              alt={artist.name}
              referrerPolicy="no-referrer"
              onError={(e) => handleImageError(e, artist.name, 'artist')}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 space-y-2 min-w-0">
            {/* Badges / Genres */}
            <div className="flex flex-wrap items-center gap-2">
              {artist.verified && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[11px] font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Artist</span>
                </span>
              )}
              {artist.primaryGenre && (
                <span className="px-2.5 py-0.5 rounded-full bg-white/[0.08] text-neutral-300 text-[11px] font-mono">
                  {artist.primaryGenre}
                </span>
              )}
              {artist.country && (
                <span className="px-2 py-0.5 rounded-full bg-white/[0.08] text-neutral-300 text-[11px] font-mono">
                  {artist.country}
                </span>
              )}
            </div>

            {/* Artist Display Name */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight truncate leading-tight">
              {artist.name}
            </h1>

            {/* Listener & Follower Figures (Clean Unboxed Numbers) */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-neutral-300">
              <span>
                <strong className="text-white font-mono">{monthlyListenersDisplay}</strong> monthly listeners
              </span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span>
                <strong className="text-white font-mono">{followersDisplay}</strong> followers
              </span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span>
                <strong className="text-neutral-200 font-mono">{totalStreamsDisplay}</strong> total plays
              </span>
            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onPlayAll(popularSongs)}
                disabled={popularSongs.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-xl shadow-red-600/30 active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>Play All</span>
              </button>

              <button
                type="button"
                onClick={() => onShuffleAll(popularSongs)}
                disabled={popularSongs.length === 0}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors cursor-pointer"
                title="Shuffle Artist Tracks"
              >
                <Shuffle className="w-4 h-4" />
              </button>

              {/* Functional Follow / Unfollow Button */}
              <button
                type="button"
                onClick={handleToggleFollow}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                  isFollowing
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-transparent text-white border-white/30 hover:border-white hover:bg-white/10'
                }`}
              >
                {isFollowing ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-3" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Follow</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenShareModal}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white border border-white/15 transition-colors cursor-pointer"
                title="Share Artist"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. POPULAR TRACKS (Ranked 1-10 with clean tabular layout) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Disc className="w-5 h-5 text-red-500" />
            <span>Popular Tracks</span>
          </h2>
          <span className="text-xs text-neutral-400 font-mono">Top Releases</span>
        </div>

        {popularSongs.length === 0 ? (
          <div className="p-8 rounded-2xl bg-neutral-900/30 border border-white/[0.06] text-center text-xs text-neutral-400">
            No popular tracks loaded yet for this artist.
          </div>
        ) : (
          <div className="space-y-1.5">
            {popularSongs.slice(0, 10).map((track, idx) => {
              const isLiked = likedTrackIds.includes(track.id);
              const plays = formatCompactNumber(track.streams);

              return (
                <div
                  key={track.id || idx}
                  className="p-2.5 rounded-xl bg-neutral-900/30 hover:bg-white/[0.07] border border-white/[0.04] transition-colors flex items-center justify-between gap-3 group"
                >
                  <div
                    onClick={() => onPlayTrack(track)}
                    className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                  >
                    <span className="w-5 text-center text-xs font-mono text-neutral-500 group-hover:hidden">
                      {idx + 1}
                    </span>
                    <Play className="w-4 h-4 text-white hidden group-hover:block shrink-0" />

                    <img
                      src={resolveArtworkUrl(track.coverUrl, 'track', track.title)}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e, track.title, 'track')}
                      className="w-10 h-10 rounded-lg object-cover shrink-0 bg-neutral-800"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs sm:text-sm text-white group-hover:text-red-400 transition-colors truncate">
                        {track.title}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {track.album}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    <span className="text-[11px] font-mono tabular-nums text-neutral-400 hidden sm:inline">
                      {plays !== 'N/A' ? `${plays} plays` : ''}
                    </span>

                    <button
                      type="button"
                      onClick={() => onToggleLike(track.id)}
                      className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                        isLiked ? 'text-red-500' : 'text-neutral-500 hover:text-white'
                      }`}
                      title={isLiked ? 'Remove from liked' : 'Like'}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenAddToPlaylist(track)}
                      className="p-1.5 rounded-full text-neutral-500 hover:text-white transition-colors cursor-pointer"
                      title="Add to Playlist"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    <span className="text-xs font-mono tabular-nums text-neutral-400 w-10 text-right">
                      {formatDuration(track.duration)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. ALBUMS (Multi-column responsive grid) */}
      {albumsSection.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Disc3 className="w-5 h-5 text-red-500" />
              <span>Albums</span>
            </h2>
            <span className="text-xs text-neutral-400 font-mono">{albumsSection.length} Releases</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {albumsSection.map((alb) => (
              <div
                key={alb.id}
                onClick={() => handleOpenRelease(alb)}
                className="p-3 rounded-2xl bg-neutral-900/30 hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 shadow-md mb-2.5 relative">
                  <img
                    src={resolveArtworkUrl(alb.coverUrl, 'album', alb.title)}
                    alt={alb.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, alb.title, 'album')}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-6 h-6 text-white fill-current" />
                  </div>
                </div>
                <h3 className="font-semibold text-xs sm:text-sm text-white truncate group-hover:text-red-400 transition-colors">
                  {alb.title}
                </h3>
                <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                  Album {alb.year ? `· ${alb.year}` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. EPS AND SINGLES (Distinct Card Grid) */}
      {singlesEpsSection.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-red-500" />
              <span>EPs & Singles</span>
            </h2>
            <span className="text-xs text-neutral-400 font-mono">{singlesEpsSection.length} Releases</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {singlesEpsSection.map((s) => (
              <div
                key={s.id}
                onClick={() => handleOpenRelease(s)}
                className="p-3 rounded-2xl bg-neutral-900/30 hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 shadow-md mb-2.5 relative">
                  <img
                    src={resolveArtworkUrl(s.coverUrl, 'album', s.title)}
                    alt={s.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, s.title, 'album')}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-5 h-5 text-white fill-current" />
                  </div>
                </div>
                <h3 className="font-semibold text-xs text-white truncate group-hover:text-red-400 transition-colors">
                  {s.title}
                </h3>
                <p className="text-[10px] text-neutral-400 font-mono truncate mt-0.5">
                  Single {s.year ? `· ${s.year}` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. FEATURED APPEARANCES (Shelf / Carousel) */}
      {featuredOnSection.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-red-500" />
              <span>Featured Appearances</span>
            </h2>
            <span className="text-xs text-neutral-400 font-mono">Collaborations</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {featuredOnSection.map((item) => (
              <div
                key={item.id}
                onClick={() => handleOpenRelease(item)}
                className="p-3 rounded-2xl bg-neutral-900/30 hover:bg-white/[0.07] border border-white/[0.06] transition-all cursor-pointer group"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2 relative">
                  <img
                    src={resolveArtworkUrl(item.coverUrl, 'album', item.title)}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, item.title, 'album')}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-5 h-5 text-white fill-current" />
                  </div>
                </div>
                <h3 className="font-semibold text-xs text-white truncate group-hover:text-red-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                  {item.subtitle || item.artist || 'Featured'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. PLAYLISTS FEATURING THIS ARTIST */}
      {playlistsSection.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-red-500" />
              <span>Playlists Featuring {artist.name}</span>
            </h2>
            <span className="text-xs text-neutral-400 font-mono">Curated Sets</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {playlistsSection.map((pl) => (
              <div
                key={pl.id}
                onClick={() => {
                  if (onSelectPlaylist && pl.collectionId) {
                    onSelectPlaylist(String(pl.collectionId));
                  } else {
                    handleOpenRelease(pl);
                  }
                }}
                className="p-3 rounded-2xl bg-neutral-900/30 hover:bg-white/[0.07] border border-white/[0.06] transition-all cursor-pointer group"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2 relative">
                  <img
                    src={resolveArtworkUrl(pl.coverUrl, 'playlist', pl.title)}
                    alt={pl.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, pl.title, 'playlist')}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-5 h-5 text-white fill-current" />
                  </div>
                </div>
                <h3 className="font-semibold text-xs sm:text-sm text-white truncate group-hover:text-red-400 transition-colors">
                  {pl.title}
                </h3>
                <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                  {pl.subtitle || 'Curated Playlist'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. SIMILAR ARTISTS (Clicking opens their profile!) */}
      {similarArtistsSection.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-red-500" />
              <span>Similar Artists</span>
            </h2>
            <span className="text-xs text-neutral-400 font-mono">Related Sounds</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {similarArtistsSection.map((rel) => (
              <div
                key={rel.id || rel.browseId || rel.name}
                onClick={() => {
                  if (onSelectArtist) {
                    onSelectArtist(rel.browseId || rel.id || rel.name);
                  }
                }}
                className="p-4 rounded-2xl bg-neutral-900/30 hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/20 transition-all text-center group cursor-pointer"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden border-2 border-white/10 shadow-lg bg-neutral-800 mb-2.5 group-hover:scale-105 transition-transform">
                  <img
                    src={resolveArtworkUrl(rel.avatarUrl, 'artist', rel.name)}
                    alt={rel.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, rel.name, 'artist')}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-red-400 transition-colors">
                  {rel.name}
                </p>
                {rel.subscribers && (
                  <p className="text-[11px] text-neutral-400 font-mono mt-0.5 truncate">
                    {rel.subscribers}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. ABOUT AND BIOGRAPHY (Clean editorial layout, zero prohibited terms) */}
      <section className="p-6 sm:p-8 rounded-3xl bg-neutral-900/30 border border-white/[0.08] space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-red-500" />
            <h2 className="text-base sm:text-lg font-bold text-white">About {artist.name}</h2>
          </div>
          <span className="text-xs text-neutral-400 font-mono">Biography</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-1">
          <div className="lg:col-span-2 space-y-3">
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
              {artist.bio || `${artist.name} is a renowned recording artist recognized globally for iconic releases, influential chart performances, and visionary sonic direction.`}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3 shrink-0">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">Key Metrics</span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Monthly Listeners</span>
                <span className="font-mono font-bold text-white">{monthlyListenersDisplay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Followers</span>
                <span className="font-mono font-bold text-white">{followersDisplay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Total Stream Count</span>
                <span className="font-mono font-bold text-white">{totalStreamsDisplay}</span>
              </div>
              {artist.primaryGenre && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Primary Genre</span>
                  <span className="font-mono text-white">{artist.primaryGenre}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Release Details Modal (Albums, Singles, Playlists) */}
      {selectedRelease && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#101014] border border-white/15 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={resolveArtworkUrl(selectedRelease.coverUrl, 'album', selectedRelease.title)}
                  alt={selectedRelease.title}
                  className="w-20 h-20 rounded-2xl object-cover bg-neutral-800 shrink-0 shadow-lg"
                />
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/10 text-neutral-300">
                    {selectedRelease.type || 'Release'} {selectedRelease.year ? `· ${selectedRelease.year}` : ''}
                  </span>
                  <h3 className="text-base sm:text-lg font-extrabold text-white mt-1 truncate">
                    {selectedRelease.title}
                  </h3>
                  <p className="text-xs text-neutral-400 truncate">{artist.name}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRelease(null)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {isLoadingRelease ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-red-500 mx-auto" />
                  <p className="text-xs text-neutral-400">Loading release tracklist...</p>
                </div>
              ) : releaseTracks.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <p className="text-xs text-neutral-400">No uploaded tracks linked to this release yet.</p>
                </div>
              ) : (
                releaseTracks.map((t, idx) => (
                  <div
                    key={t.id || idx}
                    onClick={() => {
                      onPlayTrack({
                        ...t,
                        artist: t.artist || artist.name,
                        album: selectedRelease.title,
                        coverUrl: t.coverUrl || selectedRelease.coverUrl,
                      });
                      setSelectedRelease(null);
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
                          {t.artist || artist.name}
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
