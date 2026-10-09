import React, { useState, useEffect } from 'react';
import { 
  Track, 
  Playlist, 
  MoodCategory, 
  TimeOfDay, 
  FeaturedAccount, 
  ArtistProfile,
  MusicGenre
} from '../../types/music';
import { 
  Play, 
  Heart, 
  Plus, 
  UserPlus, 
  UserCheck, 
  Clock, 
  Sparkles, 
  Radio, 
  Check, 
  Flame, 
  Headphones, 
  Disc,
  ArrowRight
} from 'lucide-react';
import { VideoModeCanvas } from '../player/VideoModeCanvas';
import { CarouselShelf } from '../common/CarouselShelf';

interface HomeFeedProps {
  tracks: Track[];
  playlists: Playlist[];
  currentTrack: Track | null;
  isPlaying: boolean;
  isVideoMode: boolean;
  selectedMood: MoodCategory;
  searchQuery: string;
  likedTrackIds: string[];
  featuredAccounts: FeaturedAccount[];
  artistProfiles: Record<string, ArtistProfile>;
  onPlayTrack: (track: Track, startAt?: number) => void;
  onToggleLike: (trackId: string) => void;
  onSelectPlaylist: (id: string) => void;
  onAddToQueue: (track: Track) => void;
  onOpenCreatePlaylist: () => void;
  onToggleFollowAccount: (accountId: string) => void;
  onSelectArtist?: (artistId: string) => void;
}

export const HomeFeed: React.FC<HomeFeedProps> = ({
  tracks,
  playlists,
  currentTrack,
  isPlaying,
  isVideoMode,
  selectedMood,
  searchQuery,
  likedTrackIds,
  featuredAccounts,
  artistProfiles,
  onPlayTrack,
  onToggleLike,
  onSelectPlaylist,
  onAddToQueue,
  onOpenCreatePlaylist,
  onToggleFollowAccount,
  onSelectArtist,
}) => {
  // AUTOMATIC DETECTION OF TIME OF DAY (NO MANUAL USER SELECTOR)
  const getAutoDetectedTimeOfDay = (): { id: TimeOfDay; title: string; greeting: string; icon: string } => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 7) {
      return { id: 'dawn', title: 'Dawn Awakening', greeting: 'Good Dawn · Serene sunrise harmonics and morning acoustic calm', icon: '🌅' };
    }
    if (hour >= 7 && hour < 12) {
      return { id: 'morning', title: 'Morning Groove', greeting: 'Good Morning · Fresh coffee, energizing pop & lo-fi focus', icon: '☕' };
    }
    if (hour >= 12 && hour < 14) {
      return { id: 'noon', title: 'Midday Reset', greeting: 'Good Midday · Upbeat tempos & sunny afternoon motivation', icon: '☀️' };
    }
    if (hour >= 14 && hour < 17) {
      return { id: 'afternoon', title: 'Afternoon Flow', greeting: 'Good Afternoon · Power through the rest of the day with high tempo', icon: '🌤️' };
    }
    if (hour >= 17 && hour < 19) {
      return { id: 'dusk', title: 'Dusk Golden Hour', greeting: 'Golden Hour Dusk · Afrobeat heat, sunset soul & warm rhythms', icon: '🌇' };
    }
    if (hour >= 19 && hour < 21) {
      return { id: 'evening', title: 'Evening Chillout', greeting: 'Good Evening · Relaxing neo-soul, acoustic love ballads & unwinding', icon: '🌆' };
    }
    if (hour >= 21 && hour < 24) {
      return { id: 'night', title: 'Night Energy', greeting: 'Good Night · Club basslines, rap velocity & midnight overdrive', icon: '🌙' };
    }
    return { id: 'midnight', title: 'Midnight Stargaze', greeting: 'Deep Midnight · Cosmic modular ambient, lo-fi beats & late coding', icon: '🌌' };
  };

  const detectedDaypart = getAutoDetectedTimeOfDay();

  // Search filter
  const matchesSearch = (t: Track) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.genre.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q)
    );
  };

  // Grouped tracks by individual genres
  const afrobeatTracks = tracks.filter((t) => t.genre === 'afrobeat' && matchesSearch(t));
  const popTracks = tracks.filter((t) => t.genre === 'pop' && matchesSearch(t));
  const rapTracks = tracks.filter((t) => t.genre === 'rap' && matchesSearch(t));
  const oldschoolTracks = tracks.filter((t) => t.genre === 'oldschool' && matchesSearch(t));
  const rnbTracks = tracks.filter((t) => t.genre === 'r&b' && matchesSearch(t));
  const synthwaveTracks = tracks.filter((t) => t.genre === 'synthwave' && matchesSearch(t));
  const lofiTracks = tracks.filter((t) => t.genre === 'lo-fi' && matchesSearch(t));
  const ambientTracks = tracks.filter((t) => t.genre === 'ambient' && matchesSearch(t));

  // Resume tracks ("Where you left off")
  const resumeTracks = tracks.filter((t) => t.resumeProgress && matchesSearch(t));

  // Time-of-day automatically detected tracks
  const autoDaypartTracks = tracks.filter((t) => 
    (!t.timeOfDayAffinity || t.timeOfDayAffinity.includes(detectedDaypart.id)) && matchesSearch(t)
  );

  // Playlists by category
  const lovePlaylists = playlists.filter((p) => p.genreCategory === 'love_songs');
  const oldschoolPlaylists = playlists.filter((p) => p.genreCategory === 'old_school');
  const workoutPlaylists = playlists.filter((p) => p.genreCategory === 'workout');
  const focusPlaylists = playlists.filter((p) => p.genreCategory === 'coding');
  const roadtripPlaylists = playlists.filter((p) => p.genreCategory === 'road_trip');

  const artistList = Object.values(artistProfiles);

  return (
    <div className="space-y-12 pb-32 animate-in fade-in duration-200">
      {/* Video Mode Canvas (When Active) */}
      {isVideoMode && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs md:text-sm font-semibold tracking-wide text-neutral-300 uppercase">
              Now Streaming · Reactive Video Canvas
            </h2>
            <span className="text-xs text-red-400 font-mono">Spectrum Node</span>
          </div>
          <VideoModeCanvas currentTrack={currentTrack} isPlaying={isPlaying} />
        </section>
      )}

      {/* 1. AUTOMATICALLY DETECTED TIME OF DAY CAROUSEL (NO USER SELECTION BUTTONS) */}
      <CarouselShelf
        title={`${detectedDaypart.icon} ${detectedDaypart.title}`}
        subtitle={detectedDaypart.greeting}
      >
        {autoDaypartTracks.map((track) => {
          const isCurrent = currentTrack?.id === track.id;
          return (
            <div
              key={track.id}
              className="w-40 sm:w-48 shrink-0 p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all group flex flex-col snap-start select-none"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2.5 shadow-md">
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <button
                  onClick={() => onPlayTrack(track)}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/40 hover:scale-105 active:scale-95 transition-transform">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </button>
              </div>

              <div className="space-y-0.5 flex-1 min-w-0">
                <h4 className={`text-xs md:text-sm font-semibold truncate ${isCurrent ? 'text-red-400' : 'text-white'}`}>
                  {track.title}
                </h4>
                <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
              </div>

              <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center justify-between text-[10px] text-neutral-500">
                <span className="capitalize">{track.genre}</span>
                <span className="font-mono tabular-nums">{track.bpm} BPM</span>
              </div>
            </div>
          );
        })}
      </CarouselShelf>

      {/* 2. CIRCULAR CAROUSEL: ACCOUNTS YOU MAY FOLLOW */}
      <CarouselShelf
        title="Accounts & Curators You May Follow"
        subtitle="Connect with verified artists, music producers, and community tastemakers on Flontmie"
      >
        {featuredAccounts.map((account) => (
          <div
            key={account.id}
            className="w-36 sm:w-44 shrink-0 p-3 rounded-2xl bg-neutral-900/30 border border-white/[0.06] hover:border-white/15 transition-all flex flex-col items-center text-center snap-start select-none group"
          >
            {/* Distinct Circular Avatar Design */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-3 border-2 border-white/15 group-hover:border-red-500/60 transition-colors shadow-lg shadow-black/40">
              <img
                src={account.avatarUrl}
                alt={account.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            <div className="w-full space-y-0.5 min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-red-400 transition-colors">
                {account.name}
              </h4>
              <p className="text-[10px] text-neutral-400 truncate font-mono">{account.handle}</p>
              <span className="inline-block text-[10px] text-neutral-400">{account.role}</span>
            </div>

            <button
              onClick={() => onToggleFollowAccount(account.id)}
              className={`mt-3 w-full py-1.5 px-3 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                account.isFollowing
                  ? 'bg-white/10 text-neutral-300 border border-white/15 hover:bg-white/20'
                  : 'bg-white text-black hover:bg-neutral-200 shadow-md'
              }`}
            >
              {account.isFollowing ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3 h-3" />
                  <span>Follow</span>
                </>
              )}
            </button>
          </div>
        ))}
      </CarouselShelf>

      {/* 3. WIDE RECTANGULAR CAROUSEL: PICK UP WHERE YOU LEFT OFF */}
      {resumeTracks.length > 0 && (
        <CarouselShelf
          title="Pick Up Where You Left Off"
          subtitle="Your algorithmic listening progress and unfinished tracks"
        >
          {resumeTracks.map((track) => {
            const isCurrent = currentTrack?.id === track.id;
            const progress = track.resumeProgress || { currentTime: 0, duration: track.duration };
            const pct = Math.min(100, (progress.currentTime / progress.duration) * 100);

            return (
              <div
                key={track.id}
                className="w-56 sm:w-64 shrink-0 p-3 rounded-2xl bg-neutral-900/50 border border-white/[0.08] hover:border-white/20 transition-all group flex flex-col snap-start select-none"
              >
                {/* Wide Rectangle Artwork */}
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-neutral-800 mb-2.5 shadow-lg">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <button
                    onClick={() => onPlayTrack(track, progress.currentTime)}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/40 hover:scale-105 active:scale-95 transition-transform">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </button>

                  <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/70">
                    <div className="h-full bg-red-500 rounded-r" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="space-y-0.5 flex-1 min-w-0">
                  <h4 className={`text-xs md:text-sm font-semibold truncate ${isCurrent ? 'text-red-400' : 'text-white'}`}>
                    {track.title}
                  </h4>
                  <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
                </div>

                <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span className="text-red-400 font-medium">Resume {Math.floor(progress.currentTime / 60)}:{String(Math.floor(progress.currentTime % 60)).padStart(2, '0')}</span>
                  <span>{Math.round(pct)}%</span>
                </div>
              </div>
            );
          })}
        </CarouselShelf>
      )}

      {/* 4. CIRCLE & PORTRAIT CAROUSEL: ARTIST PROFILES */}
      <CarouselShelf
        title="Featured Artist Profiles"
        subtitle="Discover top streaming recording artists and their official catalogs"
      >
        {artistList.map((artist) => (
          <div
            key={artist.id}
            onClick={() => onSelectArtist && onSelectArtist(artist.id)}
            className="w-44 sm:w-52 shrink-0 p-3.5 rounded-2xl bg-gradient-to-b from-neutral-900/60 to-neutral-950 border border-white/[0.08] hover:border-white/20 transition-all flex flex-col items-center text-center snap-start select-none group cursor-pointer"
          >
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden mb-3 border-2 border-white/20 group-hover:border-red-500 shadow-xl">
              <img
                src={artist.avatarUrl}
                alt={artist.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const firstTrack = tracks.find((t) => t.artistId === artist.id);
                  if (firstTrack) onPlayTrack(firstTrack);
                }}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                title={`Play ${artist.name}`}
              >
                <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </button>
            </div>

            <h4 className="text-sm font-bold text-white group-hover:text-red-400 transition-colors truncate w-full">
              {artist.name}
            </h4>
            <span className="text-[11px] text-neutral-400">{artist.primaryGenre || 'Artist'}</span>
            <p className="text-[10px] text-neutral-500 font-mono mt-1">
              {(artist.monthlyListeners / 1000000).toFixed(1)}M monthly listeners
            </p>
          </div>
        ))}
      </CarouselShelf>

      {/* 5. GENRE CAROUSEL: AFROBEAT */}
      {afrobeatTracks.length > 0 && (
        <CarouselShelf
          title="Afrobeat & Amapiano Wave"
          subtitle="Infectious West African rhythms, log drums, and dancehall anthems"
        >
          {afrobeatTracks.map((track) => (
            <div
              key={track.id}
              className="w-40 sm:w-48 shrink-0 p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all group flex flex-col snap-start select-none"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2.5 shadow-md">
                <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <button onClick={() => onPlayTrack(track)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg"><Play className="w-4 h-4 fill-current ml-0.5" /></div>
                </button>
              </div>
              <h4 className="text-xs md:text-sm font-semibold truncate text-white group-hover:text-red-400">{track.title}</h4>
              <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
              <div className="mt-2 pt-2 border-t border-white/[0.05] text-[10px] text-neutral-500 font-mono">{track.streams.toLocaleString()} streams</div>
            </div>
          ))}
        </CarouselShelf>
      )}

      {/* 6. GENRE CAROUSEL: POP & CHART TOPPERS */}
      {popTracks.length > 0 && (
        <CarouselShelf
          title="Pop & Global Chart Toppers"
          subtitle="Catchy melodic hooks, glittering synths, and high-energy radio hits"
        >
          {popTracks.map((track) => (
            <div
              key={track.id}
              className="w-40 sm:w-48 shrink-0 p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all group flex flex-col snap-start select-none"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2.5 shadow-md">
                <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <button onClick={() => onPlayTrack(track)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg"><Play className="w-4 h-4 fill-current ml-0.5" /></div>
                </button>
              </div>
              <h4 className="text-xs md:text-sm font-semibold truncate text-white group-hover:text-red-400">{track.title}</h4>
              <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
              <div className="mt-2 pt-2 border-t border-white/[0.05] text-[10px] text-neutral-500 font-mono">{track.streams.toLocaleString()} streams</div>
            </div>
          ))}
        </CarouselShelf>
      )}

      {/* 7. GENRE CAROUSEL: RAP & HIP-HOP */}
      {rapTracks.length > 0 && (
        <CarouselShelf
          title="Rap & Heavyweight Hip-Hop"
          subtitle="Punchy 808s, lyrical velocity, and underground drill bangers"
        >
          {rapTracks.map((track) => (
            <div
              key={track.id}
              className="w-40 sm:w-48 shrink-0 p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all group flex flex-col snap-start select-none"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2.5 shadow-md">
                <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <button onClick={() => onPlayTrack(track)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg"><Play className="w-4 h-4 fill-current ml-0.5" /></div>
                </button>
              </div>
              <h4 className="text-xs md:text-sm font-semibold truncate text-white group-hover:text-red-400">{track.title}</h4>
              <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
              <div className="mt-2 pt-2 border-t border-white/[0.05] text-[10px] text-neutral-500 font-mono">{track.streams.toLocaleString()} streams</div>
            </div>
          ))}
        </CarouselShelf>
      )}

      {/* 8. GENRE CAROUSEL: OLD SCHOOL & RETRO */}
      {oldschoolTracks.length > 0 && (
        <CarouselShelf
          title="Old School & Vintage Classics"
          subtitle="Timeless funk, Motown warmth, and analog 80s disco recordings"
        >
          {oldschoolTracks.map((track) => (
            <div
              key={track.id}
              className="w-40 sm:w-48 shrink-0 p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all group flex flex-col snap-start select-none"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2.5 shadow-md">
                <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <button onClick={() => onPlayTrack(track)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg"><Play className="w-4 h-4 fill-current ml-0.5" /></div>
                </button>
              </div>
              <h4 className="text-xs md:text-sm font-semibold truncate text-white group-hover:text-red-400">{track.title}</h4>
              <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
              <div className="mt-2 pt-2 border-t border-white/[0.05] text-[10px] text-neutral-500 font-mono">{track.streams.toLocaleString()} streams</div>
            </div>
          ))}
        </CarouselShelf>
      )}

      {/* 9. TALL PORTRAIT RECTANGLE CAROUSEL: LOVE SONGS & ROMANCE PLAYLISTS */}
      {lovePlaylists.length > 0 && (
        <CarouselShelf
          title="Love Songs & Romantic Playlists"
          subtitle="Heartfelt slow jams, warm acoustic intimacy, and candlelit melodies"
        >
          {lovePlaylists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => onSelectPlaylist(pl.id)}
              className="w-44 sm:w-52 shrink-0 p-3 rounded-2xl bg-gradient-to-b from-rose-950/20 to-neutral-900/60 border border-rose-500/15 hover:border-rose-500/35 transition-all cursor-pointer group flex flex-col snap-start select-none"
            >
              {/* Tall Portrait Shape (aspect-[3/4]) */}
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-neutral-800 mb-2.5 shadow-lg">
                <img src={pl.coverUrl} alt={pl.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                  <div className="w-full">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Romance Curation</span>
                    <h4 className="text-xs md:text-sm font-bold text-white truncate">{pl.title}</h4>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-neutral-400 line-clamp-1">{pl.description}</p>
              <div className="mt-2 pt-2 border-t border-white/[0.05] text-[10px] text-rose-300 font-mono">{pl.followers.toLocaleString()} saves</div>
            </div>
          ))}
        </CarouselShelf>
      )}

      {/* 10. PLAYLIST CAROUSEL: OLD SCHOOL CLASSICS */}
      {oldschoolPlaylists.length > 0 && (
        <CarouselShelf
          title="Old School & Nostalgia Playlists"
          subtitle="Hand-curated retro mixes preserving the golden eras of music"
        >
          {oldschoolPlaylists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => onSelectPlaylist(pl.id)}
              className="w-40 sm:w-48 shrink-0 p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group flex flex-col snap-start select-none"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2.5 shadow-md">
                <img src={pl.coverUrl} alt={pl.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg"><Play className="w-4 h-4 fill-current ml-0.5" /></div>
                </div>
              </div>
              <h4 className="text-xs md:text-sm font-semibold truncate text-white group-hover:text-red-400">{pl.title}</h4>
              <p className="text-[11px] text-neutral-400 line-clamp-1">{pl.description}</p>
              <div className="mt-2 pt-2 border-t border-white/[0.05] text-[10px] text-neutral-500 font-mono">{pl.followers.toLocaleString()} saves</div>
            </div>
          ))}
        </CarouselShelf>
      )}

      {/* 11. PLAYLIST CAROUSEL: WORKOUT & CODING FLOW */}
      {workoutPlaylists.length > 0 && (
        <CarouselShelf
          title="Workout Energy & Focus Playlists"
          subtitle="Pumping BPMs for gym sessions and flow-state coding marathons"
        >
          {[...workoutPlaylists, ...focusPlaylists].map((pl) => (
            <div
              key={pl.id}
              onClick={() => onSelectPlaylist(pl.id)}
              className="w-40 sm:w-48 shrink-0 p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group flex flex-col snap-start select-none"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2.5 shadow-md">
                <img src={pl.coverUrl} alt={pl.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg"><Play className="w-4 h-4 fill-current ml-0.5" /></div>
                </div>
              </div>
              <h4 className="text-xs md:text-sm font-semibold truncate text-white group-hover:text-red-400">{pl.title}</h4>
              <p className="text-[11px] text-neutral-400 line-clamp-1">{pl.description}</p>
              <div className="mt-2 pt-2 border-t border-white/[0.05] text-[10px] text-neutral-500 font-mono">{pl.followers.toLocaleString()} saves</div>
            </div>
          ))}
        </CarouselShelf>
      )}

      {/* 12. GENRE CAROUSEL: SYNTHWAVE & ELECTRONIC */}
      {synthwaveTracks.length > 0 && (
        <CarouselShelf
          title="Synthwave & Cyberpunk Electronic"
          subtitle="Retrofuturistic synth arpeggios, analog basslines, and neon speeds"
        >
          {synthwaveTracks.map((track) => (
            <div
              key={track.id}
              className="w-40 sm:w-48 shrink-0 p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all group flex flex-col snap-start select-none"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2.5 shadow-md">
                <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <button onClick={() => onPlayTrack(track)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg"><Play className="w-4 h-4 fill-current ml-0.5" /></div>
                </button>
              </div>
              <h4 className="text-xs md:text-sm font-semibold truncate text-white group-hover:text-red-400">{track.title}</h4>
              <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
              <div className="mt-2 pt-2 border-t border-white/[0.05] text-[10px] text-neutral-500 font-mono">{track.streams.toLocaleString()} streams</div>
            </div>
          ))}
        </CarouselShelf>
      )}

      {/* 13. GENRE CAROUSEL: LO-FI & AMBIENT */}
      {lofiTracks.length > 0 && (
        <CarouselShelf
          title="Lo-Fi & Deep Space Ambient"
          subtitle="Raindrop vinyl textures, calming keys, and weightless sleep frequencies"
        >
          {[...lofiTracks, ...ambientTracks].map((track) => (
            <div
              key={track.id}
              className="w-40 sm:w-48 shrink-0 p-3 rounded-2xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/20 transition-all group flex flex-col snap-start select-none"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2.5 shadow-md">
                <img src={track.coverUrl} alt={track.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <button onClick={() => onPlayTrack(track)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg"><Play className="w-4 h-4 fill-current ml-0.5" /></div>
                </button>
              </div>
              <h4 className="text-xs md:text-sm font-semibold truncate text-white group-hover:text-red-400">{track.title}</h4>
              <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
              <div className="mt-2 pt-2 border-t border-white/[0.05] text-[10px] text-neutral-500 font-mono">{track.streams.toLocaleString()} streams</div>
            </div>
          ))}
        </CarouselShelf>
      )}
    </div>
  );
};
