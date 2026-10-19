import React, { useState, useEffect } from 'react';
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
  Youtube, 
  ArrowLeft, 
  Disc, 
  ListMusic, 
  ExternalLink,
  Users,
  Album,
  Radio,
  BookOpen,
  BarChart3,
  Loader2,
  X,
  Music2
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
  onSelectArtist?: (artistIdOrBrowseId: string) => void;
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
}) => {
  const [enrichedArtist, setEnrichedArtist] = useState<ArtistProfile>(initialArtist);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [flontmieFollowers, setFlontmieFollowers] = useState<number>(
    typeof initialArtist.flontmieFollowers === 'number' ? initialArtist.flontmieFollowers : 0
  );

  // Release Tracklist Drawer / Modal state when user clicks any Album, Single/EP, Featured On, or Playlist
  const [selectedRelease, setSelectedRelease] = useState<ArtistDiscographyItem | null>(null);
  const [releaseTracks, setReleaseTracks] = useState<Track[]>([]);
  const [isLoadingRelease, setIsLoadingRelease] = useState<boolean>(false);

  // Fetch enriched artist profile (Wikipedia/Wikidata bio, real YT Music stats, and 6-section discography)
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
          if (typeof fetched.flontmieFollowers === 'number') {
            setFlontmieFollowers(fetched.flontmieFollowers);
          }
        }
      })
      .catch((err) => {
        console.warn('Artist enrichment load warning:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingProfile(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialArtist.id, initialArtist.name]);

  const artist = enrichedArtist || initialArtist;

  // Deduplicated Popular Songs combining API popularSongs + matching local catalog tracks
  const popularSongs: Track[] = React.useMemo(() => {
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

  // 2. Albums section (deduplicated)
  const albumsSection: ArtistDiscographyItem[] = React.useMemo(() => {
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

    // Fallback from popularSongs albums if none returned yet
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

  // 3. Singles & EPs section (deduplicated)
  const singlesEpsSection: ArtistDiscographyItem[] = React.useMemo(() => {
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
          tracks: [t],
        });
      });
    }

    return list;
  }, [artist.singlesEps, artist.name, popularSongs]);

  // 4. Featured On section
  const featuredOnSection: ArtistDiscographyItem[] = React.useMemo(() => {
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

  // 5. Playlists section
  const playlistsSection: ArtistDiscographyItem[] = React.useMemo(() => {
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

  // 6. Related Artists section
  const relatedArtistsSection: RelatedArtistItem[] = React.useMemo(() => {
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

  const handleToggleFollow = () => {
    if (isFollowing) {
      setIsFollowing(false);
      setFlontmieFollowers((prev) => Math.max(0, prev - 1));
    } else {
      setIsFollowing(true);
      setFlontmieFollowers((prev) => prev + 1);
    }
  };

  const handleOpenRelease = async (item: ArtistDiscographyItem) => {
    setSelectedRelease(item);
    if (item.tracks && item.tracks.length > 0) {
      setReleaseTracks(item.tracks);
      return;
    }

    // Check if we already have local tracks matching this album/single title
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

  // Genuine external vs internal metrics formatted compactly ("683M", "7.47M", "4.1B", or "N/A")
  const ytMonthlyAudienceDisplay = formatCompactNumber(artist.ytMonthlyAudience ?? artist.monthlyListeners);
  const ytSubscribersDisplay = formatCompactNumber(artist.ytSubscribers ?? artist.followers);
  const ytTotalViewsDisplay = formatCompactNumber(artist.ytTotalViews ?? artist.totalStreams);
  const flontmieStreamsDisplay = formatCompactNumber(
    typeof artist.flontmieStreams === 'number'
      ? artist.flontmieStreams
      : popularSongs.reduce((acc, t) => acc + (t.flontmiePlays || 0), 0),
    true
  );

  return (
    <div className="space-y-10 pb-32 animate-in fade-in duration-200">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors group mb-2 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Back to browse</span>
      </button>

      {/* Hero Header Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-neutral-900 shadow-2xl min-h-[320px] md:min-h-[380px] flex flex-col justify-end p-6 md:p-10">
        {/* Banner Artwork Backdrop */}
        <img
          src={resolvedHeader}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          onError={(e) => handleImageError(e, artist.name, 'artist')}
          className="absolute inset-0 w-full h-full object-cover opacity-45 scale-105 filter blur-[2px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060608] via-[#060608]/75 to-transparent" />

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-end gap-6">
          {/* Avatar Photo */}
          <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-white/15 shadow-2xl shrink-0 bg-neutral-800">
            <img
              src={resolvedAvatar}
              alt={artist.name}
              referrerPolicy="no-referrer"
              onError={(e) => handleImageError(e, artist.name, 'artist')}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 space-y-2.5 min-w-0">
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
              {isLoadingProfile && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.06] text-neutral-300 text-[11px]">
                  <Loader2 className="w-3 h-3 animate-spin text-red-500" />
                  <span>Syncing live catalog...</span>
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight truncate">
              {artist.name}
            </h1>

            {/* Real Statistics Row: Distinguishes External (YT Music) vs Flontmie Analytics */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-300 font-mono">
              <span title="Verified YouTube Music Monthly Audience">
                <strong className="text-white">{ytMonthlyAudienceDisplay}</strong> YT monthly audience
              </span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span title="Verified YouTube Music Subscribers">
                <strong className="text-white">{ytSubscribersDisplay}</strong> YT subscribers
              </span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span title="Actual Flontmie Platform Streams">
                <strong className="text-emerald-400">{flontmieStreamsDisplay}</strong> Flontmie streams
              </span>
            </div>
          </div>

          {/* Action Buttons: Play All, Shuffle, Follow, Share */}
          <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 md:pt-0">
            <button
              onClick={() => onPlayAll(popularSongs)}
              disabled={popularSongs.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs tracking-wider uppercase shadow-xl shadow-red-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Play All</span>
            </button>

            <button
              onClick={() => onShuffleAll(popularSongs)}
              disabled={popularSongs.length === 0}
              className="p-3 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
              title="Shuffle artist tracks"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleFollow}
              className={`px-5 py-2.5 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                isFollowing
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-transparent text-white border-white/20 hover:border-white'
              }`}
            >
              {isFollowing ? 'Following' : '+ Follow'}
            </button>

            <button
              onClick={onOpenShareModal}
              className="p-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-neutral-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Share artist profile"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Section 1 (Popular Songs) & Artist Biography / Real Analytics Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: SECTION 1 — POPULAR SONGS (Span 2) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Disc className="w-5 h-5 text-red-500" />
              <span>Popular Songs</span>
            </h2>
            <span className="text-xs text-neutral-400 font-mono">
              {popularSongs.length} verified track{popularSongs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {popularSongs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-neutral-900/40 border border-white/[0.05] text-center text-neutral-400 text-xs">
              {isLoadingProfile ? 'Loading verified popular songs...' : 'No popular songs available for this artist yet.'}
            </div>
          ) : (
            <div className="space-y-1.5">
              {popularSongs.slice(0, 10).map((track, idx) => {
                const isLiked = likedTrackIds.includes(track.id);
                const extPlays = formatCompactNumber(track.ytPlays ?? track.streams);
                const flontPlays = typeof track.flontmiePlays === 'number' ? track.flontmiePlays : 0;

                return (
                  <div
                    key={track.id || `${track.title}-${idx}`}
                    className="p-2.5 rounded-2xl bg-neutral-900/40 border border-white/[0.04] hover:bg-white/[0.06] transition-colors flex items-center justify-between gap-3 group"
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
                        className="w-10 h-10 rounded-xl object-cover shrink-0 bg-neutral-800"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs md:text-sm text-white group-hover:text-red-400 transition-colors truncate">
                            {track.title}
                          </span>
                          {track.isExplicit && (
                            <span className="text-[9px] font-bold px-1 bg-white/20 text-neutral-300 rounded shrink-0">
                              E
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-400 truncate block">
                          {track.artist || artist.name} · {track.album}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                      <div className="hidden sm:flex flex-col items-end text-[11px] font-mono tabular-nums">
                        <span className="text-neutral-300" title="External YT Music Plays">
                          {extPlays !== 'N/A' ? `${extPlays} plays` : 'N/A'}
                        </span>
                        {flontPlays > 0 && (
                          <span className="text-[10px] text-emerald-400" title="Actual Flontmie Plays">
                            {formatCompactNumber(flontPlays, true)} on Flontmie
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onToggleLike(track.id)}
                        className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                          isLiked ? 'text-red-500' : 'text-neutral-500 hover:text-white'
                        }`}
                        title={isLiked ? 'Remove from liked' : 'Save to liked'}
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500' : ''}`} />
                      </button>

                      <button
                        onClick={() => onOpenAddToPlaylist(track)}
                        className="p-1.5 rounded-full text-neutral-500 hover:text-white transition-colors cursor-pointer"
                        title="Add to playlist"
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
        </div>

        {/* Right Column: Wikipedia/Wikidata Biography & Verified External vs Flontmie Statistics */}
        <div className="space-y-6">
          {/* Artist Biography Card with Wikipedia/Wikidata Attribution */}
          <div className="p-6 rounded-3xl bg-neutral-900/50 border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-red-500" />
                <span>Artist Biography</span>
              </h3>
              {artist.wikidataId && (
                <span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[10px] font-mono text-neutral-400">
                  Wikidata {artist.wikidataId}
                </span>
              )}
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              {artist.bio ||
                (isLoadingProfile
                  ? `Fetching verified biography for ${artist.name}...`
                  : 'Verified biography unavailable from external encyclopedia sources.')}
            </p>

            {/* Source Attribution Footer */}
            <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-neutral-400">
                Source: <strong className="text-neutral-200">{artist.bioSource || 'Wikipedia / Wikidata'}</strong>
              </span>
              {artist.bioUrl && (
                <a
                  href={artist.bioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-semibold transition-colors"
                >
                  <span>Wikipedia Article</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Verified Audience & Streaming Statistics Card (External vs Flontmie) */}
          <div className="p-6 rounded-3xl bg-neutral-900/50 border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-red-500" />
              <span>Verified Audience & Analytics</span>
            </h3>

            {/* External YT Music Figures */}
            <div className="space-y-2 text-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
                External Estimates (YouTube Music)
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[10px] text-neutral-400 block">Monthly Audience</span>
                  <span className="text-sm font-mono font-bold text-white">{ytMonthlyAudienceDisplay}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[10px] text-neutral-400 block">Subscribers</span>
                  <span className="text-sm font-mono font-bold text-white">{ytSubscribersDisplay}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[10px] text-neutral-400 block">Channel Views</span>
                  <span className="text-sm font-mono font-bold text-white">{ytTotalViewsDisplay}</span>
                </div>
              </div>
            </div>

            {/* Internal Flontmie Platform Figures */}
            <div className="pt-3 border-t border-white/[0.06] space-y-2 text-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block">
                Flontmie Platform Analytics
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                  <span className="text-[10px] text-neutral-400 block">Flontmie Streams</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">{flontmieStreamsDisplay}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                  <span className="text-[10px] text-neutral-400 block">Flontmie Followers</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    {formatCompactNumber(flontmieFollowers, true)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.06] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Record Label</span>
                <span className="text-white font-medium truncate max-w-[180px]">{artist.label || 'N/A'}</span>
              </div>
              {artist.socialLinks?.youtube && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Official Channel</span>
                  <a
                    href={artist.socialLinks.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-medium"
                  >
                    <span>YouTube Music</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: ALBUMS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <Album className="w-5 h-5 text-red-500" />
            <span>Albums</span>
          </h2>
          <span className="text-xs text-neutral-400 font-mono">
            {albumsSection.length} release{albumsSection.length !== 1 ? 's' : ''}
          </span>
        </div>

        {albumsSection.length === 0 ? (
          <div className="p-6 rounded-2xl bg-neutral-900/30 border border-white/[0.05] text-xs text-neutral-400">
            {isLoadingProfile ? 'Loading full-length albums...' : 'No studio albums listed for this artist.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albumsSection.map((alb) => (
              <div
                key={alb.id || alb.title}
                onClick={() => handleOpenRelease(alb)}
                className="p-3.5 rounded-2xl bg-neutral-900/30 border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group flex flex-col"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 relative shadow-md">
                  <img
                    src={resolveArtworkUrl(alb.coverUrl, 'album', alb.title)}
                    alt={alb.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, alb.title, 'album')}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <h4 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors truncate">
                    {alb.title}
                  </h4>
                  {alb.explicit && (
                    <span className="text-[9px] font-bold px-1 bg-white/20 text-neutral-300 rounded shrink-0">
                      E
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5 font-mono truncate">
                  {alb.year || 'Album'} · {alb.artist || artist.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 3: SINGLES AND EPS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <Music2 className="w-5 h-5 text-red-500" />
            <span>Singles and EPs</span>
          </h2>
          <span className="text-xs text-neutral-400 font-mono">
            {singlesEpsSection.length} release{singlesEpsSection.length !== 1 ? 's' : ''}
          </span>
        </div>

        {singlesEpsSection.length === 0 ? (
          <div className="p-6 rounded-2xl bg-neutral-900/30 border border-white/[0.05] text-xs text-neutral-400">
            {isLoadingProfile ? 'Loading singles and EPs...' : 'No singles or EPs listed for this artist.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {singlesEpsSection.map((item) => (
              <div
                key={item.id || item.title}
                onClick={() => handleOpenRelease(item)}
                className="p-3.5 rounded-2xl bg-neutral-900/30 border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group flex flex-col"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 relative shadow-md">
                  <img
                    src={resolveArtworkUrl(item.coverUrl, 'album', item.title)}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, item.title, 'album')}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <h4 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors truncate">
                    {item.title}
                  </h4>
                  {item.explicit && (
                    <span className="text-[9px] font-bold px-1 bg-white/20 text-neutral-300 rounded shrink-0">
                      E
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5 font-mono truncate">
                  {item.type || 'Single'} · {item.year || artist.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 4: FEATURED ON */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500" />
            <span>Featured On</span>
          </h2>
          <span className="text-xs text-neutral-400 font-mono">
            {featuredOnSection.length} collection{featuredOnSection.length !== 1 ? 's' : ''}
          </span>
        </div>

        {featuredOnSection.length === 0 ? (
          <div className="p-6 rounded-2xl bg-neutral-900/30 border border-white/[0.05] text-xs text-neutral-400">
            {isLoadingProfile ? 'Loading featured appearances...' : 'No featured compilations available for this artist.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {featuredOnSection.map((item) => (
              <div
                key={item.id || item.title}
                onClick={() => handleOpenRelease(item)}
                className="p-3.5 rounded-2xl bg-neutral-900/30 border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group flex flex-col"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 relative shadow-md">
                  <img
                    src={resolveArtworkUrl(item.coverUrl, 'playlist', item.title)}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, item.title, 'playlist')}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors truncate">
                  {item.title}
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                  {item.subtitle || item.artist || 'YouTube Music'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 5: PLAYLISTS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-red-500" />
            <span>Playlists</span>
          </h2>
          <span className="text-xs text-neutral-400 font-mono">
            {playlistsSection.length} playlist{playlistsSection.length !== 1 ? 's' : ''}
          </span>
        </div>

        {playlistsSection.length === 0 ? (
          <div className="p-6 rounded-2xl bg-neutral-900/30 border border-white/[0.05] text-xs text-neutral-400">
            {isLoadingProfile ? 'Loading artist playlists...' : 'No official playlists listed for this artist.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {playlistsSection.map((pl) => (
              <div
                key={pl.id || pl.title}
                onClick={() => handleOpenRelease(pl)}
                className="p-3.5 rounded-2xl bg-neutral-900/30 border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group flex flex-col"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 relative shadow-md">
                  <img
                    src={resolveArtworkUrl(pl.coverUrl, 'playlist', pl.title)}
                    alt={pl.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, pl.title, 'playlist')}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors truncate">
                  {pl.title}
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                  {pl.subtitle || `Curated for ${artist.name}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 6: RELATED ARTISTS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-red-500" />
            <span>Related Artists</span>
          </h2>
          <span className="text-xs text-neutral-400 font-mono">
            Fans might also like
          </span>
        </div>

        {relatedArtistsSection.length === 0 ? (
          <div className="p-6 rounded-2xl bg-neutral-900/30 border border-white/[0.05] text-xs text-neutral-400">
            {isLoadingProfile ? 'Loading related artists...' : 'No related artists found.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {relatedArtistsSection.map((rel) => (
              <div
                key={rel.id || rel.name}
                onClick={() => {
                  if (onSelectArtist) {
                    onSelectArtist(rel.browseId || rel.id || rel.name);
                  }
                }}
                className="p-4 rounded-2xl bg-neutral-900/30 border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group flex flex-col items-center text-center"
              >
                <div className="w-24 h-24 rounded-full overflow-hidden bg-neutral-800 mb-3 border-2 border-white/10 group-hover:border-red-500 transition-colors shadow-lg">
                  <img
                    src={resolveArtworkUrl(rel.avatarUrl, 'artist', rel.name)}
                    alt={rel.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, rel.name, 'artist')}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors truncate w-full">
                  {rel.name}
                </h4>
                <p className="text-[10px] text-neutral-400 font-mono mt-0.5 truncate w-full">
                  {rel.monthlyAudience
                    ? `${formatCompactNumber(rel.monthlyAudience)} audience`
                    : rel.subscribers || 'Verified Artist'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* RELEASE TRACKLIST MODAL (Opens when clicking any Album, Single/EP, Featured On, or Playlist) */}
      {selectedRelease && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e0e12] border border-white/15 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-white/10 flex items-center gap-4 bg-white/[0.02]">
              <img
                src={resolveArtworkUrl(selectedRelease.coverUrl, 'album', selectedRelease.title)}
                alt={selectedRelease.title}
                referrerPolicy="no-referrer"
                onError={(e) => handleImageError(e, selectedRelease.title, 'album')}
                className="w-20 h-20 rounded-2xl object-cover shrink-0 bg-neutral-800 shadow-lg"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                  {selectedRelease.type || 'Release'}
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-white truncate">
                  {selectedRelease.title}
                </h3>
                <p className="text-xs text-neutral-400 truncate">
                  {selectedRelease.artist || artist.name}
                  {selectedRelease.year ? ` · ${selectedRelease.year}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {releaseTracks.length > 0 && (
                  <button
                    onClick={() => {
                      onPlayAll(releaseTracks);
                      setSelectedRelease(null);
                    }}
                    className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-600/30 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play All</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedRelease(null)}
                  className="p-2 rounded-full bg-white/[0.06] hover:bg-white/15 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Tracklist Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-1.5">
              {isLoadingRelease ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                  <span>Loading official track listing...</span>
                </div>
              ) : releaseTracks.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 text-xs">
                  No individual tracks available for this release.
                </div>
              ) : (
                releaseTracks.map((trk, idx) => (
                  <div
                    key={trk.id || `${trk.title}-${idx}`}
                    onClick={() => {
                      onPlayTrack(trk);
                      setSelectedRelease(null);
                    }}
                    className="p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-6 text-center text-xs font-mono text-neutral-500 group-hover:hidden">
                        {idx + 1}
                      </span>
                      <Play className="w-4 h-4 text-red-500 hidden group-hover:block shrink-0 ml-1" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-white group-hover:text-red-400 truncate">
                          {trk.title}
                        </p>
                        <p className="text-[11px] text-neutral-400 truncate">
                          {trk.artist || artist.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-xs font-mono text-neutral-400">
                      {trk.ytPlays && (
                        <span className="hidden sm:inline">{formatCompactNumber(trk.ytPlays)} plays</span>
                      )}
                      <span>{formatDuration(trk.duration)}</span>
                    </div>
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
