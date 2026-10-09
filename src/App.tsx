import React, { useState, useEffect, useCallback } from 'react';
import { 
  Persona, 
  MoodCategory, 
  Track, 
  Playlist, 
  ArtistProfile, 
  LabelArtist, 
  ReleaseScheduleItem, 
  DistributorIngestionItem,
  DistributorAccessGrant,
  AdminRolePermission,
  FeaturedAccount,
  JamParticipant 
} from './types/music';
import { 
  INITIAL_TRACKS, 
  INITIAL_PLAYLISTS, 
  ARTIST_PROFILES, 
  LABEL_ARTISTS, 
  UPCOMING_RELEASES, 
  FEATURED_ACCOUNTS,
  DISTRIBUTOR_INGESTIONS,
  DISTRIBUTOR_ACCESS_GRANTS,
  ADMIN_ROLE_PERMISSIONS,
  IMAGES 
} from './data/mockCatalog';
import { audioEngine } from './services/audioEngine';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileDock } from './components/layout/MobileDock';
import { BottomPlayer } from './components/player/BottomPlayer';
import { QueueDrawer } from './components/player/QueueDrawer';
import { LyricsDrawer } from './components/player/LyricsDrawer';
import { HomeFeed } from './components/listener/HomeFeed';
import { PlaylistView } from './components/listener/PlaylistView';
import { ShareModal } from './components/social/ShareModal';
import { JamSessionModal } from './components/social/JamSessionModal';
import { CreatePlaylistModal } from './components/listener/CreatePlaylistModal';
import { AddToPlaylistModal } from './components/listener/AddToPlaylistModal';
import { SelectTracksModal } from './components/listener/SelectTracksModal';
import { ArtistDashboard } from './components/artist/ArtistDashboard';
import { LabelDashboard } from './components/label/LabelDashboard';
import { DistributorDashboard } from './components/distributor/DistributorDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { FullPlaybackScreen } from './components/player/FullPlaybackScreen';
import { PublicArtistPage } from './components/artist/PublicArtistPage';
import { Heart } from 'lucide-react';

export default function App() {
  // Navigation & Persona State
  const [currentPersona, setCurrentPersona] = useState<Persona>('listener');
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [selectedMood, setSelectedMood] = useState<MoodCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);

  // Desktop sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Music Catalog & Hub State
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [playlists, setPlaylists] = useState<Playlist[]>(INITIAL_PLAYLISTS);
  const [artistProfiles, setArtistProfiles] = useState<Record<string, ArtistProfile>>(ARTIST_PROFILES);
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>(['track-afro-1', 'track-pop-1', 'track-synth-1']);
  const [labelArtists, setLabelArtists] = useState<LabelArtist[]>(LABEL_ARTISTS);
  const [upcomingReleases, setUpcomingReleases] = useState<ReleaseScheduleItem[]>(UPCOMING_RELEASES);
  const [featuredAccounts, setFeaturedAccounts] = useState<FeaturedAccount[]>(FEATURED_ACCOUNTS);
  const [distributorIngestions, setDistributorIngestions] = useState<DistributorIngestionItem[]>(DISTRIBUTOR_INGESTIONS);
  const [distributorAccessGrants, setDistributorAccessGrants] = useState<DistributorAccessGrant[]>(DISTRIBUTOR_ACCESS_GRANTS);
  const [adminPermissions, setAdminPermissions] = useState<AdminRolePermission[]>(ADMIN_ROLE_PERMISSIONS);

  // Playback State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(INITIAL_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(INITIAL_TRACKS[0].duration);
  const [volume, setVolume] = useState<number>(0.85);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isVideoMode, setIsVideoMode] = useState<boolean>(false);
  const [queue, setQueue] = useState<Track[]>(INITIAL_TRACKS.slice(1));
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState<boolean>(false);

  // Drawer & Modal States
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isJamModalOpen, setIsJamModalOpen] = useState<boolean>(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState<boolean>(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState<boolean>(false);
  const [isSelectTracksOpen, setIsSelectTracksOpen] = useState<boolean>(false);

  // Jam Session Social State
  const [isJamActive, setIsJamActive] = useState<boolean>(false);
  const [jamParticipants, setJamParticipants] = useState<JamParticipant[]>([
    { id: 'u1', name: 'You (Host)', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80', isHost: true },
    { id: 'u2', name: 'Amara Osei', avatar: IMAGES.afrobeats, isHost: false },
    { id: 'u3', name: 'Damian Cross', avatar: IMAGES.series, isHost: false },
  ]);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);

  // Configure Audio Engine Listeners
  useEffect(() => {
    audioEngine.onTimeUpdate((time, dur) => {
      setCurrentTime(time);
      if (dur > 0) setDuration(dur);
    });

    audioEngine.onEnded(() => {
      handleNextTrack();
    });
  }, [queue, currentTrack, repeatMode]);

  const handlePlayTrack = (track: Track, startAt: number = 0) => {
    setCurrentTrack(track);
    setDuration(track.duration);
    setCurrentTime(startAt);
    setIsPlaying(true);
    audioEngine.playTrack(track.genre, track.bpm, track.duration, startAt);
  };

  const handleTogglePlay = () => {
    if (!currentTrack) {
      if (tracks.length > 0) handlePlayTrack(tracks[0]);
      return;
    }

    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      audioEngine.resume();
      setIsPlaying(true);
    }
  };

  const handleNextTrack = useCallback(() => {
    if (repeatMode === 'one' && currentTrack) {
      audioEngine.playTrack(currentTrack.genre, currentTrack.bpm, currentTrack.duration, 0);
      setCurrentTime(0);
      setIsPlaying(true);
      return;
    }

    if (queue.length > 0) {
      const next = queue[0];
      const remainingQueue = queue.slice(1);
      if (repeatMode === 'all' && currentTrack) {
        remainingQueue.push(currentTrack);
      }
      setQueue(remainingQueue);
      handlePlayTrack(next);
    } else if (repeatMode === 'all' && tracks.length > 0) {
      handlePlayTrack(tracks[0]);
      setQueue(tracks.slice(1));
    } else {
      audioEngine.pause();
      setIsPlaying(false);
    }
  }, [queue, currentTrack, repeatMode, tracks]);

  const handlePrevTrack = () => {
    if (currentTime > 4) {
      audioEngine.seek(0);
      setCurrentTime(0);
      return;
    }
    const currentIdx = tracks.findIndex((t) => t.id === currentTrack?.id);
    if (currentIdx > 0) {
      handlePlayTrack(tracks[currentIdx - 1]);
    } else {
      audioEngine.seek(0);
      setCurrentTime(0);
    }
  };

  const handleSeek = (seconds: number) => {
    audioEngine.seek(seconds);
    setCurrentTime(seconds);
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    audioEngine.setVolume(vol);
  };

  const handleToggleShuffle = () => {
    setIsShuffle(!isShuffle);
    if (!isShuffle && queue.length > 1) {
      const shuffled = [...queue].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
    }
  };

  const handleToggleRepeat = () => {
    const nextRepeat: Record<string, 'off' | 'all' | 'one'> = {
      off: 'all',
      all: 'one',
      one: 'off',
    };
    setRepeatMode(nextRepeat[repeatMode]);
  };

  const handleToggleLike = (trackId?: string) => {
    const targetId = trackId || currentTrack?.id;
    if (!targetId) return;

    setLikedTrackIds((prev) =>
      prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId]
    );
  };

  const handlePlayAll = (trackList: Track[]) => {
    if (trackList.length === 0) return;
    handlePlayTrack(trackList[0]);
    setQueue(trackList.slice(1));
  };

  const handleShuffleAll = (trackList: Track[]) => {
    if (trackList.length === 0) return;
    const shuffled = [...trackList].sort(() => Math.random() - 0.5);
    handlePlayTrack(shuffled[0]);
    setQueue(shuffled.slice(1));
    setIsShuffle(true);
  };

  const handleAddToQueue = (track: Track) => {
    setQueue([...queue, track]);
  };

  const handleRemoveFromQueue = (index: number) => {
    setQueue(queue.filter((_, i) => i !== index));
  };

  const handleClearQueue = () => {
    setQueue([]);
  };

  const handleMoveQueueItem = (from: number, to: number) => {
    if (to < 0 || to >= queue.length) return;
    const copy = [...queue];
    const item = copy.splice(from, 1)[0];
    copy.splice(to, 0, item);
    setQueue(copy);
  };

  // Follow accounts toggle
  const handleToggleFollowAccount = (accountId: string) => {
    setFeaturedAccounts((prev) =>
      prev.map((acc) => (acc.id === accountId ? { ...acc, isFollowing: !acc.isFollowing } : acc))
    );
  };

  // Playlist management
  const handleCreatePlaylist = (newPlaylist: Partial<Playlist>) => {
    const created: Playlist = {
      id: `playlist-${Date.now()}`,
      title: newPlaylist.title || 'New Playlist',
      description: newPlaylist.description || '',
      coverUrl: newPlaylist.coverUrl || IMAGES.synthwave,
      curator: newPlaylist.curator || 'You',
      isPublic: true,
      isCollaborative: Boolean(newPlaylist.isCollaborative),
      collaborators: newPlaylist.collaborators,
      trackIds: newPlaylist.trackIds || ['track-afro-1', 'track-pop-1'],
      followers: 1,
      category: newPlaylist.category || 'energize',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setPlaylists([created, ...playlists]);
    setSelectedPlaylistId(created.id);
  };

  const handleDeletePlaylist = (id: string) => {
    setPlaylists(playlists.filter((p) => p.id !== id));
    if (selectedPlaylistId === id) {
      setSelectedPlaylistId(null);
    }
  };

  const handleToggleTrackInPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const exists = pl.trackIds.includes(trackId);
        return {
          ...pl,
          trackIds: exists
            ? pl.trackIds.filter((id) => id !== trackId)
            : [...pl.trackIds, trackId],
        };
      })
    );
  };

  const handleRemoveTrackFromPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId
          ? { ...pl, trackIds: pl.trackIds.filter((id) => id !== trackId) }
          : pl
      )
    );
  };

  // Artist Release Integration
  const handleAddNewArtistTrack = (newTrack: Partial<Track>) => {
    const fullTrack: Track = {
      id: `track-${Date.now()}`,
      title: newTrack.title || 'Untitled Track',
      artist: newTrack.artist || 'Nova Waves',
      artistId: newTrack.artistId || 'artist-nova',
      album: newTrack.album || 'Neon Horizon (Expanded)',
      coverUrl: IMAGES.synthwave,
      duration: newTrack.duration || 180,
      genre: (newTrack.genre as any) || 'synthwave',
      bpm: newTrack.bpm || 120,
      moods: ['energize'],
      streams: 1,
      likes: 1,
      isExplicit: newTrack.isExplicit,
      releaseDate: newTrack.releaseDate || new Date().toISOString().split('T')[0],
      isrc: newTrack.isrc || 'US-FLN-26-99999',
      upc: newTrack.upc || '840192837999',
      label: newTrack.label || 'Astral Horizon Records',
      distributor: newTrack.distributor || 'TuneCore Direct on Flontmie',
      status: 'active',
      featuredOnHome: true,
      lyrics: [
        { time: 0, text: '[New Master Recording Audio Stream]' },
        { time: 10, text: 'Signal transmitted across the network' },
      ],
    };

    setTracks([fullTrack, ...tracks]);
  };

  // Distributor Upload & Modify Handlers
  const handleUploadSongToFlontmie = (newSong: Partial<Track>) => {
    const trackObj: Track = {
      id: `track-${Date.now()}`,
      title: newSong.title || 'Untitled Master',
      artist: newSong.artist || 'Unknown Artist',
      artistId: newSong.artistId || 'artist-unknown',
      album: newSong.album || 'Flontmie Single',
      coverUrl: newSong.coverUrl || IMAGES.partymix,
      duration: newSong.duration || 210,
      genre: (newSong.genre as any) || 'afrobeat',
      bpm: newSong.bpm || 115,
      moods: ['energize'],
      streams: 1,
      likes: 1,
      isExplicit: Boolean(newSong.isExplicit),
      releaseDate: newSong.releaseDate || new Date().toISOString().split('T')[0],
      isrc: newSong.isrc || `US-FLN-26-${Math.floor(10000 + Math.random() * 90000)}`,
      upc: newSong.upc || `840192837${Math.floor(100 + Math.random() * 900)}`,
      label: newSong.label || 'Independent Label',
      distributor: newSong.distributor || 'TuneCore Direct on Flontmie',
      status: newSong.status || 'active',
      featuredOnHome: true,
    };

    setTracks([trackObj, ...tracks]);
  };

  const handleModifySongOnFlontmie = (trackId: string, updates: Partial<Track>) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, ...updates } : t))
    );
  };

  const handleDeleteSong = (trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    setQueue((prev) => prev.filter((t) => t.id !== trackId));
    if (currentTrack?.id === trackId) {
      handleNextTrack();
    }
  };

  // Artist Management Handlers
  const handleViewArtist = (artistId: string) => {
    let id = artistId;
    if (!artistProfiles[id]) {
      const foundEntry = Object.entries(artistProfiles).find(
        ([k, v]) => v.name.toLowerCase() === artistId.toLowerCase() || k.toLowerCase() === artistId.toLowerCase()
      );
      if (foundEntry) {
        id = foundEntry[0];
      } else {
        const newId = `artist-${artistId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const fallbackProfile: ArtistProfile = {
          id: newId,
          name: artistId,
          avatarUrl: IMAGES.partymix,
          headerUrl: IMAGES.partymix,
          bio: `${artistId} is an official recording artist streaming on Flontmie.`,
          verified: true,
          monthlyListeners: 142000,
          totalStreams: 920000,
          followers: 18500,
          label: 'Independent Flontmie Release',
          topTracks: [],
          primaryGenre: 'Pop',
          country: 'US',
          claimedStatus: 'Verified',
        };
        setArtistProfiles((prev) => ({ ...prev, [newId]: fallbackProfile }));
        id = newId;
      }
    }
    setSelectedArtistId(id);
    setSelectedPlaylistId(null);
    setCurrentPersona('listener');
  };

  const handleCreateArtistProfile = (newProfile: ArtistProfile) => {
    setArtistProfiles((prev) => ({
      ...prev,
      [newProfile.id]: newProfile,
    }));
  };

  const handleUpdateArtistProfile = (artistId: string, updates: Partial<ArtistProfile>) => {
    setArtistProfiles((prev) => {
      if (!prev[artistId]) return prev;
      return {
        ...prev,
        [artistId]: { ...prev[artistId], ...updates },
      };
    });
  };

  // Admin Master Handlers
  const handleToggleTrackFeatured = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, featuredOnHome: !t.featuredOnHome } : t))
    );
  };

  const handleUpdateTrackStatus = (trackId: string, status: 'active' | 'review' | 'flagged') => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, status } : t))
    );
  };

  const handleDeleteTrack = (trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  const handleUpdatePermission = (updated: AdminRolePermission) => {
    setAdminPermissions((prev) =>
      prev.map((p) => (p.role === updated.role ? updated : p))
    );
  };

  const handleSendReaction = (emoji: string) => {
    const newReaction = {
      id: `react-${Date.now()}-${Math.random()}`,
      emoji,
      x: 10 + Math.random() * 80,
    };
    setReactions((prev) => [...prev, newReaction]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 1800);
  };

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId) || null;

  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col font-sans selection:bg-red-600/30 overflow-x-hidden">
      {/* Top Bar Navigation */}
      <Navbar
        currentPersona={currentPersona}
        onSelectPersona={(p) => {
          setCurrentPersona(p);
          setSelectedPlaylistId(null);
          setSelectedArtistId(null);
        }}
        selectedMood={selectedMood}
        onSelectMood={setSelectedMood}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenJamModal={() => setIsJamModalOpen(true)}
        isJamActive={isJamActive}
        jamParticipantCount={jamParticipants.length}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Sidebar (hidden on mobile) */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setSelectedPlaylistId(null);
            setSelectedArtistId(null);
          }}
          playlists={playlists}
          selectedPlaylistId={selectedPlaylistId}
          onSelectPlaylist={(id) => {
            setSelectedPlaylistId(id);
            setSelectedArtistId(null);
            setCurrentPersona('listener');
          }}
          onCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
          currentPersona={currentPersona}
          onSelectPersona={(p) => {
            setCurrentPersona(p);
            setSelectedPlaylistId(null);
            setSelectedArtistId(null);
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Main Workspace Viewport */}
        <main className="flex-1 min-w-0 overflow-y-auto px-3 sm:px-6 md:px-8 py-5 h-[calc(100vh-57px-72px)] pb-24 md:pb-8">
          {/* Persona View 1: Consumer Streaming App (Flontmie) */}
          {currentPersona === 'listener' && (
            <>
              {selectedArtistId && artistProfiles[selectedArtistId] ? (
                <PublicArtistPage
                  artist={artistProfiles[selectedArtistId]}
                  tracks={tracks}
                  onPlayTrack={handlePlayTrack}
                  onPlayAll={handlePlayAll}
                  onShuffleAll={handleShuffleAll}
                  onToggleLike={handleToggleLike}
                  likedTrackIds={likedTrackIds}
                  onAddToQueue={handleAddToQueue}
                  onOpenAddToPlaylist={(track) => {
                    setCurrentTrack(track);
                    setIsAddToPlaylistOpen(true);
                  }}
                  onOpenShareModal={() => setIsShareModalOpen(true)}
                  onBack={() => setSelectedArtistId(null)}
                />
              ) : selectedPlaylist ? (
                <PlaylistView
                  playlist={selectedPlaylist}
                  allTracks={tracks}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  likedTrackIds={likedTrackIds}
                  onPlayTrack={handlePlayTrack}
                  onPlayAll={handlePlayAll}
                  onShuffleAll={handleShuffleAll}
                  onToggleLike={handleToggleLike}
                  onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
                  onOpenAddTrackModal={() => setIsSelectTracksOpen(true)}
                  onOpenShareModal={() => setIsShareModalOpen(true)}
                  onDeletePlaylist={handleDeletePlaylist}
                />
              ) : currentTab === 'explore' ? (
                <div className="space-y-6 pb-20">
                  <div className="border-b border-white/[0.08] pb-4">
                    <h1 className="text-xl md:text-2xl font-bold text-white">Explore Flontmie Charts</h1>
                    <p className="text-xs text-neutral-400 mt-1">Trending music across genres and social curations</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-3">
                      <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider">Top 50 Flontmie Streams</h3>
                      <div className="space-y-2">
                        {tracks.slice(0, 5).map((t, i) => (
                          <div
                            key={t.id}
                            onClick={() => handlePlayTrack(t)}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] cursor-pointer text-xs transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono text-neutral-500 w-4 shrink-0">{i + 1}</span>
                              <img src={t.coverUrl} alt={t.title} referrerPolicy="no-referrer" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                              <div className="min-w-0">
                                <p className="font-semibold text-white truncate">{t.title}</p>
                                <p className="text-neutral-400 truncate">{t.artist}</p>
                              </div>
                            </div>
                            <span className="font-mono tabular-nums text-neutral-400 shrink-0 ml-2">{t.streams.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-3">
                      <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Featured Curators</h3>
                      <div className="space-y-2">
                        {playlists.map((pl) => (
                          <div
                            key={pl.id}
                            onClick={() => setSelectedPlaylistId(pl.id)}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] cursor-pointer text-xs transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img src={pl.coverUrl} alt={pl.title} referrerPolicy="no-referrer" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                              <div className="min-w-0">
                                <p className="font-semibold text-white truncate">{pl.title}</p>
                                <p className="text-neutral-400 truncate">{pl.curator}</p>
                              </div>
                            </div>
                            <span className="text-neutral-400 font-mono shrink-0 ml-2">{pl.followers.toLocaleString()} saves</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : currentTab === 'library' ? (
                <div className="space-y-6 pb-20">
                  <div className="border-b border-white/[0.08] pb-4">
                    <h1 className="text-xl md:text-2xl font-bold text-white">Your Streaming Library</h1>
                    <p className="text-xs text-neutral-400 mt-1">Your saved playlists, liked tracks, and listening history</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                    {playlists.map((pl) => (
                      <div
                        key={pl.id}
                        onClick={() => setSelectedPlaylistId(pl.id)}
                        className="p-3 rounded-2xl bg-neutral-900/30 border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group"
                      >
                        <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2">
                          <img src={pl.coverUrl} alt={pl.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                        <h4 className="text-xs font-semibold text-white truncate">{pl.title}</h4>
                        <p className="text-[11px] text-neutral-400 truncate">{pl.curator}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : currentTab === 'liked' ? (
                <div className="space-y-6 pb-20">
                  <div className="flex items-center gap-4 p-4 sm:p-6 bg-gradient-to-r from-red-950/40 to-neutral-900/40 rounded-2xl border border-white/[0.08]">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-red-600 to-purple-800 flex items-center justify-center shadow-xl shrink-0">
                      <Heart className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white" />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Flontmie Collection</span>
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white mt-0.5">Liked Songs</h1>
                      <p className="text-xs text-neutral-400 mt-1 font-mono tabular-nums">{likedTrackIds.length} tracks saved</p>
                    </div>
                  </div>

                  <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-neutral-900/30">
                    {tracks
                      .filter((t) => likedTrackIds.includes(t.id))
                      .map((t, idx) => (
                        <div
                          key={t.id}
                          onClick={() => handlePlayTrack(t)}
                          className="flex items-center justify-between p-3 border-b border-white/[0.03] hover:bg-white/[0.04] cursor-pointer text-xs transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-neutral-500 w-4 shrink-0">{idx + 1}</span>
                            <img src={t.coverUrl} alt={t.title} referrerPolicy="no-referrer" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">{t.title}</p>
                              <p className="text-neutral-400 truncate">{t.artist}</p>
                            </div>
                          </div>
                          <span className="font-mono tabular-nums text-neutral-400 shrink-0 ml-2">
                            {Math.floor(t.duration / 60)}:{String(Math.floor(t.duration % 60)).padStart(2, '0')}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <HomeFeed
                  tracks={tracks}
                  playlists={playlists}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  isVideoMode={isVideoMode}
                  selectedMood={selectedMood}
                  searchQuery={searchQuery}
                  likedTrackIds={likedTrackIds}
                  featuredAccounts={featuredAccounts}
                  artistProfiles={artistProfiles}
                  onPlayTrack={handlePlayTrack}
                  onToggleLike={handleToggleLike}
                  onSelectPlaylist={(id) => setSelectedPlaylistId(id)}
                  onAddToQueue={handleAddToQueue}
                  onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
                  onToggleFollowAccount={handleToggleFollowAccount}
                  onSelectArtist={handleViewArtist}
                />
              )}
            </>
          )}

          {/* Persona View 2: Artist Studio Dashboard */}
          {currentPersona === 'artist' && (
            <ArtistDashboard
              artistProfile={artistProfiles['artist-nova'] || Object.values(artistProfiles)[0]}
              tracks={tracks}
              onAddNewTrack={handleAddNewArtistTrack}
            />
          )}

          {/* Persona View 3: Record Label Hub Dashboard */}
          {currentPersona === 'label' && (
            <LabelDashboard
              labelArtists={labelArtists}
              upcomingReleases={upcomingReleases}
            />
          )}

          {/* Persona View 4: Distributor Portal (TuneCore, CD Baby, Ditto distributing onto Flontmie) */}
          {currentPersona === 'distributor' && (
            <DistributorDashboard
              ingestions={distributorIngestions}
              accessGrants={distributorAccessGrants}
              onUploadSongToFlontmie={handleUploadSongToFlontmie}
              onModifySongOnFlontmie={handleModifySongOnFlontmie}
              onDeleteSongFromFlontmie={handleDeleteSong}
              tracks={tracks}
              artistProfiles={artistProfiles}
              onCreateArtistProfile={handleCreateArtistProfile}
              onUpdateArtistProfile={handleUpdateArtistProfile}
              onViewArtistPublicPage={handleViewArtist}
            />
          )}

          {/* Persona View 5: Flontmie Owner Admin Console */}
          {currentPersona === 'admin' && (
            <AdminDashboard
              tracks={tracks}
              onToggleTrackFeatured={handleToggleTrackFeatured}
              onUpdateTrackStatus={handleUpdateTrackStatus}
              onDeleteTrack={handleDeleteTrack}
              permissions={adminPermissions}
              onUpdatePermission={handleUpdatePermission}
              labelArtists={labelArtists}
            />
          )}
        </main>
      </div>

      {/* MOBILE DOCK: Bottom floating touch dock (rendered exclusively on mobile) */}
      <MobileDock
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setSelectedPlaylistId(null);
          setSelectedArtistId(null);
        }}
        currentPersona={currentPersona}
        onSelectPersona={(p) => {
          setCurrentPersona(p);
          setSelectedPlaylistId(null);
          setSelectedArtistId(null);
        }}
        isJamActive={isJamActive}
        onOpenJamModal={() => setIsJamModalOpen(true)}
      />

      {/* Responsive Flontmie Bottom Player Bar */}
      <BottomPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        isVideoMode={isVideoMode}
        isLiked={Boolean(currentTrack && likedTrackIds.includes(currentTrack.id))}
        isQueueOpen={isQueueOpen}
        isLyricsOpen={isLyricsOpen}
        queueCount={queue.length}
        onTogglePlay={handleTogglePlay}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleShuffle={handleToggleShuffle}
        onToggleRepeat={handleToggleRepeat}
        onToggleVideoMode={() => setIsVideoMode(!isVideoMode)}
        onToggleQueue={() => {
          setIsQueueOpen(!isQueueOpen);
          setIsLyricsOpen(false);
        }}
        onToggleLyrics={() => {
          setIsLyricsOpen(!isLyricsOpen);
          setIsQueueOpen(false);
        }}
        onToggleLike={() => handleToggleLike()}
        onOpenAddToPlaylist={() => setIsAddToPlaylistOpen(true)}
        onShareTrack={() => setIsShareModalOpen(true)}
        onOpenFullPlayer={() => setIsFullPlayerOpen(true)}
        onNavigateToArtist={handleViewArtist}
      />

      {/* DEDICATED FULL PLAYBACK SCREEN */}
      <FullPlaybackScreen
        isOpen={isFullPlayerOpen}
        onClose={() => setIsFullPlayerOpen(false)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        isVideoMode={isVideoMode}
        isLiked={Boolean(currentTrack && likedTrackIds.includes(currentTrack.id))}
        queue={queue}
        onTogglePlay={handleTogglePlay}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleShuffle={handleToggleShuffle}
        onToggleRepeat={handleToggleRepeat}
        onToggleVideoMode={() => setIsVideoMode(!isVideoMode)}
        onToggleLike={() => handleToggleLike()}
        onOpenAddToPlaylist={() => setIsAddToPlaylistOpen(true)}
        onShareTrack={() => setIsShareModalOpen(true)}
        onPlayQueueTrack={handlePlayTrack}
        onRemoveFromQueue={handleRemoveFromQueue}
        onClearQueue={handleClearQueue}
        onMoveQueueItem={handleMoveQueueItem}
        onNavigateToArtist={(artistId) => {
          setIsFullPlayerOpen(false);
          handleViewArtist(artistId);
        }}
        onNavigateToAlbum={(_albumTitle) => {
          setIsFullPlayerOpen(false);
        }}
      />

      {/* Up Next / Queue Drawer */}
      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        queue={queue}
        currentTrack={currentTrack}
        onPlayTrack={handlePlayTrack}
        onRemoveFromQueue={handleRemoveFromQueue}
        onClearQueue={handleClearQueue}
        onMoveQueueItem={handleMoveQueueItem}
      />

      {/* Synchronized Live Lyrics Drawer */}
      <LyricsDrawer
        isOpen={isLyricsOpen}
        onClose={() => setIsLyricsOpen(false)}
        track={currentTrack}
        currentTime={currentTime}
        onSeek={handleSeek}
      />

      {/* Social Sharing Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        track={currentTrack}
        playlist={selectedPlaylist}
      />

      {/* Social Jam Session Listening Room Modal */}
      <JamSessionModal
        isOpen={isJamModalOpen}
        onClose={() => setIsJamModalOpen(false)}
        isJamActive={isJamActive}
        onToggleJam={() => setIsJamActive(!isJamActive)}
        currentTrack={currentTrack}
        participants={jamParticipants}
        onSendReaction={handleSendReaction}
        reactions={reactions}
      />

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onCreate={handleCreatePlaylist}
      />

      {/* Add Track to Playlist Modal */}
      <AddToPlaylistModal
        isOpen={isAddToPlaylistOpen}
        onClose={() => setIsAddToPlaylistOpen(false)}
        track={currentTrack}
        playlists={playlists}
        onToggleTrackInPlaylist={handleToggleTrackInPlaylist}
        onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
      />

      {/* Select Tracks for Playlist Modal */}
      <SelectTracksModal
        isOpen={isSelectTracksOpen}
        onClose={() => setIsSelectTracksOpen(false)}
        playlist={selectedPlaylist}
        allTracks={tracks}
        onToggleTrack={handleToggleTrackInPlaylist}
      />
    </div>
  );
}
