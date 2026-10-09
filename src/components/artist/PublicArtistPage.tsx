import React, { useState } from 'react';
import { 
  Play, 
  Shuffle, 
  Heart, 
  Plus, 
  Share2, 
  Check, 
  ShieldCheck, 
  Globe, 
  Instagram, 
  Twitter, 
  Youtube, 
  ArrowLeft, 
  Disc, 
  ListMusic, 
  Sparkles,
  ExternalLink,
  Users
} from 'lucide-react';
import { ArtistProfile, Track, AlbumRelease } from '../../types/music';

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
}

export const PublicArtistPage: React.FC<PublicArtistPageProps> = ({
  artist,
  tracks,
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
}) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(artist.followers || 124000);
  const [activeDiscographyTab, setActiveDiscographyTab] = useState<'all' | 'albums' | 'singles'>('all');

  const artistTracks = tracks.filter(
    (t) => t.artistId === artist.id || t.artist.toLowerCase() === artist.name.toLowerCase()
  );

  const albumsMap = new Map<string, { album: string; coverUrl: string; year: string; count: number; tracks: Track[] }>();
  artistTracks.forEach((t) => {
    const existing = albumsMap.get(t.album);
    if (!existing) {
      albumsMap.set(t.album, {
        album: t.album,
        coverUrl: t.coverUrl,
        year: t.releaseDate ? t.releaseDate.split('-')[0] : '2026',
        count: 1,
        tracks: [t],
      });
    } else {
      existing.count += 1;
      existing.tracks.push(t);
    }
  });

  const albumsList = Array.from(albumsMap.values());

  const handleToggleFollow = () => {
    if (isFollowing) {
      setIsFollowing(false);
      setFollowersCount((prev) => Math.max(0, prev - 1));
    } else {
      setIsFollowing(true);
      setFollowersCount((prev) => prev + 1);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-200">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors group mb-2"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Back to browse</span>
      </button>

      {/* Hero Header Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-neutral-900 shadow-2xl min-h-[300px] md:min-h-[360px] flex flex-col justify-end p-6 md:p-10">
        {/* Banner Artwork Backdrop */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${artist.headerUrl || artist.avatarUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060608] via-[#060608]/70 to-transparent" />

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-end gap-6">
          {/* Avatar Photo */}
          <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-white/10 shadow-2xl shrink-0 bg-neutral-800">
            <img
              src={artist.avatarUrl}
              alt={artist.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {artist.verified && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[11px] font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Artist</span>
                </span>
              )}
              {artist.distributorName && (
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-medium">
                  Distributed via {artist.distributorName}
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

            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
              {artist.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-300 font-mono">
              <span>{artist.monthlyListeners.toLocaleString()} monthly listeners</span>
              <span aria-hidden="true" className="text-neutral-500">·</span>
              <span>{followersCount.toLocaleString()} followers</span>
              <span aria-hidden="true" className="text-neutral-500">·</span>
              <span>{artist.label}</span>
            </div>
          </div>

          {/* Action Buttons: Play All, Shuffle, Follow, Share */}
          <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 md:pt-0">
            <button
              onClick={() => onPlayAll(artistTracks)}
              disabled={artistTracks.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs tracking-wider uppercase shadow-xl shadow-red-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Play All</span>
            </button>

            <button
              onClick={() => onShuffleAll(artistTracks)}
              disabled={artistTracks.length === 0}
              className="p-3 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/10 transition-colors disabled:opacity-50"
              title="Shuffle artist tracks"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleFollow}
              className={`px-5 py-2.5 rounded-full text-xs font-semibold transition-all border ${
                isFollowing
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-transparent text-white border-white/20 hover:border-white'
              }`}
            >
              {isFollowing ? 'Following' : '+ Follow'}
            </button>

            <button
              onClick={onOpenShareModal}
              className="p-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-neutral-300 hover:text-white border border-white/10 transition-colors"
              title="Share artist profile"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Top Tracks & Bio/Socials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Popular Tracks (Span 2) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Disc className="w-5 h-5 text-red-500" />
              <span>Popular Tracks</span>
            </h2>
            <span className="text-xs text-neutral-400 font-mono">
              {artistTracks.length} song{artistTracks.length !== 1 ? 's' : ''} on Flontmie
            </span>
          </div>

          <div className="space-y-1.5">
            {artistTracks.map((track, idx) => {
              const isLiked = likedTrackIds.includes(track.id);
              return (
                <div
                  key={track.id}
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
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl object-cover shrink-0"
                    />

                    <div className="min-w-0">
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
                        {track.album}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="hidden sm:inline text-xs font-mono tabular-nums text-neutral-400">
                      {track.streams.toLocaleString()}
                    </span>

                    <button
                      onClick={() => onToggleLike(track.id)}
                      className={`p-1.5 rounded-full transition-colors ${
                        isLiked ? 'text-red-500' : 'text-neutral-500 hover:text-white'
                      }`}
                      title={isLiked ? 'Remove from liked' : 'Save to liked'}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500' : ''}`} />
                    </button>

                    <button
                      onClick={() => onOpenAddToPlaylist(track)}
                      className="p-1.5 rounded-full text-neutral-500 hover:text-white transition-colors"
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

          {/* Discography / Releases */}
          <div className="pt-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <h2 className="text-lg md:text-xl font-bold text-white">Discography & Releases</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {albumsList.map((item) => (
                <div
                  key={item.album}
                  onClick={() => onSelectAlbum && onSelectAlbum(item.album)}
                  className="p-3.5 rounded-2xl bg-neutral-900/30 border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 relative">
                    <img
                      src={item.coverUrl}
                      alt={item.album}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <h4 className="text-xs font-bold text-white truncate">{item.album}</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5 font-mono">
                    {item.year} · {item.count} {item.count === 1 ? 'track' : 'tracks'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Bio, Distributor Origin, Social Links */}
        <div className="space-y-6">
          {/* About & Bio Card */}
          <div className="p-6 rounded-3xl bg-neutral-900/50 border border-white/[0.08] space-y-4">
            <h3 className="text-base font-bold text-white">About the Artist</h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {artist.bio || `${artist.name} is a recording artist streaming music globally on the Flontmie platform.`}
            </p>

            <div className="pt-3 border-t border-white/[0.06] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Catalog Streams</span>
                <span className="font-mono text-white font-semibold">{artist.totalStreams.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Record Label</span>
                <span className="text-white font-medium">{artist.label}</span>
              </div>
              {artist.distributorName && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Ingested on Flontmie by</span>
                  <span className="text-purple-400 font-medium">{artist.distributorName}</span>
                </div>
              )}
              {artist.claimedStatus && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Claim / Rights Status</span>
                  <span className="text-emerald-400 font-medium">{artist.claimedStatus}</span>
                </div>
              )}
            </div>

            {/* Social Links */}
            <div className="pt-3 border-t border-white/[0.06] space-y-2">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                Connect & Socials
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={`https://instagram.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
                  title="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
                <a
                  href={`https://twitter.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
                  title="X / Twitter"
                >
                  <Twitter className="w-4 h-4" />
                </a>
                <a
                  href={`https://youtube.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
                  title="YouTube"
                >
                  <Youtube className="w-4 h-4" />
                </a>
                <button
                  onClick={onOpenShareModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-xs text-neutral-300 hover:text-white transition-colors ml-auto"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
