import React, { useState } from 'react';
import { 
  Network, 
  Upload, 
  Key, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Plus, 
  FileText, 
  Users, 
  Building2, 
  Disc, 
  Save,
  Trash2,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  FolderPlus,
  Music2,
  Check,
  X,
  FileCheck2,
  Globe,
  Radio,
  RefreshCw,
  Search
} from 'lucide-react';
import { 
  DistributorIngestionItem, 
  DistributorAccessGrant, 
  Track, 
  MusicGenre,
  ArtistProfile,
  AlbumRelease,
  AlbumTrackItem
} from '../../types/music';
import { IMAGES } from '../../data/mockCatalog';

interface DistributorDashboardProps {
  ingestions: DistributorIngestionItem[];
  accessGrants: DistributorAccessGrant[];
  onUploadSongToFlontmie: (newSong: Partial<Track>) => void;
  onModifySongOnFlontmie: (trackId: string, updates: Partial<Track>) => void;
  onDeleteSongFromFlontmie?: (trackId: string) => void;
  tracks: Track[];
  artistProfiles: Record<string, ArtistProfile>;
  onCreateArtistProfile: (artist: ArtistProfile) => void;
  onUpdateArtistProfile: (artistId: string, updates: Partial<ArtistProfile>) => void;
  onViewArtistPublicPage: (artistId: string) => void;
}

export const DistributorDashboard: React.FC<DistributorDashboardProps> = ({
  ingestions,
  accessGrants,
  onUploadSongToFlontmie,
  onModifySongOnFlontmie,
  onDeleteSongFromFlontmie,
  tracks,
  artistProfiles,
  onCreateArtistProfile,
  onUpdateArtistProfile,
  onViewArtistPublicPage,
}) => {
  const [activeTab, setActiveTab] = useState<'artists' | 'releases' | 'catalog' | 'access' | 'modify'>('artists');
  const [grants, setGrants] = useState<DistributorAccessGrant[]>(accessGrants);
  const [items, setItems] = useState<DistributorIngestionItem[]>(ingestions);

  // Selected distributor identity
  const [distributorName, setDistributorName] = useState<string>('TuneCore Direct on Flontmie');

  // --- ARTIST MANAGEMENT STATE ---
  const [isCreateArtistModalOpen, setIsCreateArtistModalOpen] = useState(false);
  const [artistSearch, setArtistSearch] = useState('');
  const [newArtistName, setNewArtistName] = useState('');
  const [newArtistAvatar, setNewArtistAvatar] = useState(IMAGES.synthwave);
  const [newArtistBanner, setNewArtistBanner] = useState(IMAGES.synthwave);
  const [newArtistBio, setNewArtistBio] = useState('');
  const [newArtistGenre, setNewArtistGenre] = useState<string>('Afrobeat');
  const [newArtistCountry, setNewArtistCountry] = useState('US');
  const [newArtistClaimStatus, setNewArtistClaimStatus] = useState<ArtistProfile['claimedStatus']>('Verified');
  const [newArtistInstagram, setNewArtistInstagram] = useState('');
  const [newArtistTwitter, setNewArtistTwitter] = useState('');
  const [newArtistSpotify, setNewArtistSpotify] = useState('');
  const [newArtistYouTube, setNewArtistYouTube] = useState('');
  const [artistSuccessNotice, setArtistSuccessNotice] = useState<string | null>(null);

  // --- RELEASES & ALBUM MANAGEMENT STATE ---
  const [selectedArtistForRelease, setSelectedArtistForRelease] = useState<string>(
    Object.keys(artistProfiles)[0] || 'artist-nova'
  );
  const [isCreateReleaseModalOpen, setIsCreateReleaseModalOpen] = useState(false);
  const [releaseTitle, setReleaseTitle] = useState('');
  const [releaseType, setReleaseType] = useState<'Single' | 'EP' | 'Album'>('Single');
  const [releaseGenre, setReleaseGenre] = useState<MusicGenre>('afrobeat');
  const [releaseSubgenre, setReleaseSubgenre] = useState('Afro-Fusion');
  const [releaseLabel, setReleaseLabel] = useState('Astral Horizon Records');
  const [releaseUpc, setReleaseUpc] = useState(`8401928${Math.floor(10000 + Math.random() * 90000)}`);
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [releasePreorderDate, setReleasePreorderDate] = useState('');
  const [audioFormat, setAudioFormat] = useState<'24-bit FLAC (Lossless)' | 'WAV 48kHz / 24-bit' | 'MP3 320kbps CBR'>('24-bit FLAC (Lossless)');
  const [releaseCoverUrl, setReleaseCoverUrl] = useState(IMAGES.partymix);
  
  // Tracklist builder for the new release
  const [releaseTracks, setReleaseTracks] = useState<AlbumTrackItem[]>([
    {
      id: `trk-${Date.now()}-1`,
      trackNumber: 1,
      title: '',
      duration: 210,
      isrc: `US-FLN-26-${Math.floor(10000 + Math.random() * 90000)}`,
      isExplicit: false,
      audioFileName: 'master_track_01.flac',
      producer: 'SoundGate Lab',
      composer: 'Lead Composer',
      bpm: 118,
      keyScale: 'C Major',
    },
  ]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [releaseNotice, setReleaseNotice] = useState<string | null>(null);

  // Safeguarded Delete modal
  const [itemToDelete, setItemToDelete] = useState<{ id: string; title: string; type: 'track' | 'release' } | null>(null);

  // --- QUICK MODIFY TRACK STATE ---
  const [selectedTrackToModify, setSelectedTrackToModify] = useState<string>(tracks[0]?.id || '');
  const [modifiedTitle, setModifiedTitle] = useState('');
  const [modifiedGenre, setModifiedGenre] = useState<MusicGenre>('afrobeat');
  const [modifySuccess, setModifySuccess] = useState(false);

  // --- ACCESS GRANT STATE ---
  const [grantEntityName, setGrantEntityName] = useState('');
  const [grantEntityType, setGrantEntityType] = useState<'Artist' | 'Record Label'>('Artist');
  const [grantCanAlbums, setGrantCanAlbums] = useState(true);
  const [grantMaxReleases, setGrantMaxReleases] = useState(25);

  const artistList = Object.values(artistProfiles);

  const filteredArtists = artistList.filter((a) =>
    a.name.toLowerCase().includes(artistSearch.toLowerCase()) ||
    (a.primaryGenre && a.primaryGenre.toLowerCase().includes(artistSearch.toLowerCase())) ||
    (a.country && a.country.toLowerCase().includes(artistSearch.toLowerCase()))
  );

  // Add a track to the album release tracklist
  const handleAddTrackToRelease = () => {
    const nextNumber = releaseTracks.length + 1;
    setReleaseTracks([
      ...releaseTracks,
      {
        id: `trk-${Date.now()}-${nextNumber}`,
        trackNumber: nextNumber,
        title: '',
        duration: 195,
        isrc: `US-FLN-26-${Math.floor(10000 + Math.random() * 90000)}`,
        isExplicit: false,
        audioFileName: `master_track_0${nextNumber}.flac`,
        producer: 'SoundGate Lab',
        composer: 'Lead Composer',
        bpm: 120,
        keyScale: 'A Minor',
      },
    ]);
  };

  const handleRemoveTrackFromRelease = (index: number) => {
    if (releaseTracks.length <= 1) return;
    const updated = releaseTracks.filter((_, i) => i !== index).map((t, idx) => ({
      ...t,
      trackNumber: idx + 1,
    }));
    setReleaseTracks(updated);
  };

  const handleUpdateReleaseTrack = (index: number, updates: Partial<AlbumTrackItem>) => {
    setReleaseTracks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...updates } : t))
    );
  };

  // Validation function for releases
  const validateRelease = () => {
    const errors: string[] = [];
    if (!releaseTitle.trim()) {
      errors.push('Release title is required.');
    }
    if (!releaseUpc.trim()) {
      errors.push('UPC / Barcode is required for platform ingestion.');
    }
    releaseTracks.forEach((t, i) => {
      if (!t.title.trim()) {
        errors.push(`Track #${i + 1} must have a title.`);
      }
      if (!t.isrc.trim()) {
        errors.push(`Track #${i + 1} is missing a valid ISRC code.`);
      }
    });
    return errors;
  };

  // Submit Release (Draft vs Submit for Review vs Live)
  const handleSubmitRelease = (status: 'draft' | 'under_review' | 'live') => {
    const errs = validateRelease();
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors([]);

    const artistObj = artistProfiles[selectedArtistForRelease] || artistList[0];

    // Ingest all tracks into live catalog if status is 'live' or 'under_review'
    releaseTracks.forEach((trk) => {
      const fullTrack: Track = {
        id: `track-${Date.now()}-${trk.trackNumber}`,
        title: trk.title.trim(),
        artist: artistObj.name,
        artistId: artistObj.id,
        album: releaseTitle.trim(),
        coverUrl: releaseCoverUrl,
        duration: trk.duration || 210,
        genre: releaseGenre,
        bpm: trk.bpm || 120,
        moods: ['energize'],
        streams: 1,
        likes: 1,
        isExplicit: trk.isExplicit,
        releaseDate: releaseDate,
        isrc: trk.isrc,
        upc: releaseUpc,
        label: releaseLabel,
        distributor: distributorName,
        status: status === 'draft' ? 'review' : 'active',
        featuredOnHome: status === 'live',
      };

      onUploadSongToFlontmie(fullTrack);

      const newIngestion: DistributorIngestionItem = {
        id: `ing-${Date.now()}-${trk.trackNumber}`,
        trackTitle: trk.title.trim(),
        artistName: artistObj.name,
        artistId: artistObj.id,
        labelName: releaseLabel,
        isrc: trk.isrc,
        upc: releaseUpc,
        genre: releaseGenre,
        releaseDate: releaseDate,
        flontmieStatus: status === 'live' ? 'Live on Flontmie' : status === 'under_review' ? 'Ingestion QA' : 'Metadata Processing',
        grantedUploadAccess: true,
        uploadedByDistributor: distributorName,
        audioQuality: 'Lossless Hi-Res',
      };
      setItems((prev) => [newIngestion, ...prev]);
    });

    setReleaseNotice(`Release "${releaseTitle}" successfully processed (${status.toUpperCase()}) with ${releaseTracks.length} track(s)!`);
    setTimeout(() => {
      setReleaseNotice(null);
      setIsCreateReleaseModalOpen(false);
      setReleaseTitle('');
      setReleaseTracks([
        {
          id: `trk-${Date.now()}-1`,
          trackNumber: 1,
          title: '',
          duration: 210,
          isrc: `US-FLN-26-${Math.floor(10000 + Math.random() * 90000)}`,
          isExplicit: false,
          audioFileName: 'master_track_01.flac',
          producer: 'SoundGate Lab',
          composer: 'Lead Composer',
          bpm: 118,
          keyScale: 'C Major',
        },
      ]);
    }, 1800);
  };

  // Create Artist Profile Handler
  const handleCreateArtistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArtistName.trim()) return;

    const uniqueId = `artist-${newArtistName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;

    const newProfile: ArtistProfile = {
      id: uniqueId,
      name: newArtistName.trim(),
      avatarUrl: newArtistAvatar || IMAGES.synthwave,
      headerUrl: newArtistBanner || IMAGES.synthwave,
      bio: newArtistBio.trim() || `${newArtistName.trim()} is an official recording artist on the Flontmie music platform.`,
      verified: true,
      monthlyListeners: 84000,
      totalStreams: 120000,
      followers: 14500,
      label: releaseLabel,
      topTracks: [],
      country: newArtistCountry,
      primaryGenre: newArtistGenre,
      distributorId: `dist-${Date.now()}`,
      distributorName: distributorName,
      claimedStatus: newArtistClaimStatus,
      socialLinks: {
        instagram: newArtistInstagram,
        twitter: newArtistTwitter,
        spotify: newArtistSpotify,
        youtube: newArtistYouTube,
      },
    };

    onCreateArtistProfile(newProfile);
    setArtistSuccessNotice(`Artist page for "${newArtistName}" created on Flontmie with ID ${uniqueId}!`);
    setTimeout(() => {
      setArtistSuccessNotice(null);
      setIsCreateArtistModalOpen(false);
      setNewArtistName('');
      setNewArtistBio('');
    }, 1500);
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'track') {
      if (onDeleteSongFromFlontmie) {
        onDeleteSongFromFlontmie(itemToDelete.id);
      }
      setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
    }
    setItemToDelete(null);
  };

  const handleModifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrackToModify) return;

    const updates: Partial<Track> = {};
    if (modifiedTitle.trim()) updates.title = modifiedTitle.trim();
    if (modifiedGenre) updates.genre = modifiedGenre;

    onModifySongOnFlontmie(selectedTrackToModify, updates);
    setModifySuccess(true);
    setTimeout(() => setModifySuccess(false), 2000);
  };

  const handleAddAccessGrant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantEntityName.trim()) return;

    const newGrant: DistributorAccessGrant = {
      id: `grant-${Date.now()}`,
      entityName: grantEntityName.trim(),
      entityType: grantEntityType,
      distributorName: distributorName,
      canUploadTracks: true,
      canUploadAlbums: grantCanAlbums,
      canModifyLiveMetadata: true,
      maxMonthlyReleases: Number(grantMaxReleases),
      status: 'Active',
    };

    setGrants([newGrant, ...grants]);
    setGrantEntityName('');
  };

  return (
    <div className="space-y-8 pb-28 animate-in fade-in duration-200">
      {/* Distributor Header (NO play or wave icons) */}
      <div className="p-6 md:p-8 rounded-2xl bg-neutral-900/60 border border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-lg">
            <Network className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                Distributor Direct Gateway
              </span>
              <span aria-hidden="true" className="text-neutral-500">·</span>
              <span className="text-xs text-neutral-400">Distributing onto Flontmie Platform</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
              TuneCore · CD Baby · Ditto Distributor Portal
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-xl">
              Create and manage artist pages, ingest albums & singles, grant upload rights, and manage live music metadata on Flontmie.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsCreateArtistModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Users className="w-4 h-4" />
            <span>Create Artist Page</span>
          </button>

          <button
            onClick={() => setIsCreateReleaseModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 font-semibold text-xs tracking-wide shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <FolderPlus className="w-4 h-4" />
            <span>New Album / Single</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <span className="text-xs font-medium text-neutral-400">Managed Artist Profiles</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-white">
            {artistList.length} Artists
          </p>
          <div className="text-[11px] text-purple-400 font-mono">Public pages active on Flontmie</div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <span className="text-xs font-medium text-neutral-400">Catalog on Flontmie</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-white">
            {tracks.length} Tracks
          </p>
          <div className="text-[11px] text-emerald-400 font-mono">100% Live on Flontmie App</div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <span className="text-xs font-medium text-neutral-400">Granted Upload Access</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-white">
            {grants.filter((g) => g.status === 'Active').length} Entities
          </p>
          <div className="text-[11px] text-neutral-400">Artists & Labels authorized</div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <span className="text-xs font-medium text-neutral-400">Ingestion QA Health</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            Lossless Hi-Res
          </p>
          <div className="text-[11px] text-neutral-400">24-bit FLAC / WAV Pipeline</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('artists')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'artists' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Artist Management ({artistList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('releases')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'releases' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Disc className="w-3.5 h-3.5" />
          <span>Albums & Releases Management</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'catalog' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Music2 className="w-3.5 h-3.5" />
          <span>Flontmie Live Ingestions ({items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('access')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'access' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Grant Upload Rights ({grants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('modify')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'modify' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Quick Metadata Editor</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: ARTIST MANAGEMENT                                       */}
      {/* ============================================================== */}
      {activeTab === 'artists' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Managed Artists on Flontmie</h2>
              <p className="text-xs text-neutral-400">
                Each artist profile has a unique identifier and an active public artist page on Flontmie
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter by name, genre, country..."
                  value={artistSearch}
                  onChange={(e) => setArtistSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-900 border border-white/10 rounded-xl text-white placeholder-neutral-500"
                />
              </div>

              <button
                onClick={() => setIsCreateArtistModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Artist</span>
              </button>
            </div>
          </div>

          {/* Artists Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredArtists.map((artist) => {
              const artistSongs = tracks.filter((t) => t.artistId === artist.id || t.artist === artist.name);
              return (
                <div
                  key={artist.id}
                  className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] hover:border-white/20 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={artist.avatarUrl}
                      alt={artist.name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-full object-cover shrink-0 border border-white/10 shadow-md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-white truncate">{artist.name}</h3>
                        {artist.verified && (
                          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-neutral-400 truncate">ID: {artist.id}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] text-neutral-300">
                          {artist.primaryGenre || 'Music'}
                        </span>
                        {artist.country && (
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] text-neutral-300 font-mono">
                            {artist.country}
                          </span>
                        )}
                        <span className="text-[10px] text-emerald-400 font-medium">
                          {artist.claimedStatus || 'Verified'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-400 line-clamp-2">
                    {artist.bio}
                  </p>

                  <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-neutral-400">
                    <span className="font-mono">{artistSongs.length} track{artistSongs.length !== 1 ? 's' : ''} live</span>
                    <span className="text-[11px] text-purple-300">
                      via {artist.distributorName || distributorName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onViewArtistPublicPage(artist.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white text-xs font-semibold transition-colors"
                      title="View public artist page on Flontmie"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Public Page</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedArtistForRelease(artist.id);
                        setIsCreateReleaseModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 text-xs font-medium transition-colors"
                      title="Upload release for this artist"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Release</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: ALBUMS & RELEASES MANAGEMENT                             */}
      {/* ============================================================== */}
      {activeTab === 'releases' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Releases, Albums & Singles</h2>
              <p className="text-xs text-neutral-400">
                Upload single tracks or multi-track albums, edit metadata, and submit for platform review
              </p>
            </div>

            <button
              onClick={() => setIsCreateReleaseModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shrink-0"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Create New Release</span>
            </button>
          </div>

          {/* List of active catalog releases */}
          <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Releases on Platform ({tracks.length} tracks registered)
              </span>
              <span className="text-xs font-mono text-purple-400">Direct Ingest Pipeline</span>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {tracks.map((t) => (
                <div key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={t.coverUrl} alt={t.title} referrerPolicy="no-referrer" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white truncate">{t.title}</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                          Live on Flontmie
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 truncate">
                        {t.artist} · <span className="text-neutral-300">{t.album}</span>
                      </p>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-neutral-500 mt-1">
                        <span>ISRC: {t.isrc}</span>
                        <span>UPC: {t.upc}</span>
                        <span className="capitalize">{t.genre}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onViewArtistPublicPage(t.artistId || t.artist)}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-xs text-neutral-300 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Artist Page</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedTrackToModify(t.id);
                        setModifiedTitle(t.title);
                        setModifiedGenre(t.genre);
                        setActiveTab('modify');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-xs text-neutral-300 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setItemToDelete({ id: t.id, title: t.title, type: 'track' })}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete release safeguard"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: LIVE CATALOG INGESTIONS TABLE                            */}
      {/* ============================================================== */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Music Distributed Directly onto Flontmie</h3>
                <p className="text-xs text-neutral-400">Catalog ingested from TuneCore, CD Baby, and Ditto</p>
              </div>
              <span className="text-xs text-emerald-400 font-mono">Platform Stream Ready</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.02] text-neutral-400 uppercase tracking-wider text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">Track & Artist</th>
                    <th className="py-3 px-4">Genre</th>
                    <th className="py-3 px-4">ISRC Code</th>
                    <th className="py-3 px-4">Distributor Source</th>
                    <th className="py-3 px-4">Audio Quality</th>
                    <th className="py-3 px-4 text-right">Flontmie Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">{item.trackTitle}</span>
                          <span className="text-[11px] text-neutral-400">{item.artistName} · {item.labelName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 capitalize text-neutral-300">{item.genre}</td>
                      <td className="py-3.5 px-4 font-mono text-neutral-400">{item.isrc}</td>
                      <td className="py-3.5 px-4 text-neutral-300">{item.uploadedByDistributor}</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-mono">{item.audioQuality}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-semibold text-emerald-400">
                          {item.flontmieStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: ACCESS GRANTS                                            */}
      {/* ============================================================== */}
      {activeTab === 'access' && (
        <div className="space-y-6">
          <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Granted Upload Rights on Flontmie</h3>
                <p className="text-xs text-neutral-400">
                  Manage which artists and record labels have permission to upload songs & albums
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.02] text-neutral-400 uppercase tracking-wider text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">Artist / Label Entity</th>
                    <th className="py-3 px-4">Entity Type</th>
                    <th className="py-3 px-4">Distributor Gateway</th>
                    <th className="py-3 px-4">Upload Permissions</th>
                    <th className="py-3 px-4">Max Monthly Releases</th>
                    <th className="py-3 px-4 text-right">Access Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {grants.map((grant) => (
                    <tr key={grant.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">{grant.entityName}</td>
                      <td className="py-3.5 px-4 text-neutral-300">{grant.entityType}</td>
                      <td className="py-3.5 px-4 text-purple-400">{grant.distributorName}</td>
                      <td className="py-3.5 px-4 text-neutral-300">
                        Tracks, Albums, Metadata
                      </td>
                      <td className="py-3.5 px-4 font-mono text-neutral-300">{grant.maxMonthlyReleases}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-semibold text-emerald-400">{grant.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* New Grant Form */}
          <div className="max-w-xl p-5 rounded-xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h4 className="text-sm font-bold text-white">Grant Ingestion Rights to New Entity</h4>
            <form onSubmit={handleAddAccessGrant} className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1">Entity / Artist / Label Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Neo-Wave Collective"
                  value={grantEntityName}
                  onChange={(e) => setGrantEntityName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-300 block mb-1">Type</label>
                  <select
                    value={grantEntityType}
                    onChange={(e) => setGrantEntityType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
                  >
                    <option value="Artist">Artist</option>
                    <option value="Record Label">Record Label</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-300 block mb-1">Max Monthly Releases</label>
                  <input
                    type="number"
                    value={grantMaxReleases}
                    onChange={(e) => setGrantMaxReleases(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold"
              >
                Issue Upload Authorization
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: QUICK METADATA EDITOR                                   */}
      {/* ============================================================== */}
      {activeTab === 'modify' && (
        <div className="max-w-xl p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">Edit & Modify Song on Flontmie</h3>
            <p className="text-xs text-neutral-400">Update track title, genre or metadata in the live streaming app</p>
          </div>

          {modifySuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Track metadata updated successfully on Flontmie!</span>
            </div>
          )}

          <form onSubmit={handleModifySubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-neutral-300 block mb-1">Select Track</label>
              <select
                value={selectedTrackToModify}
                onChange={(e) => {
                  setSelectedTrackToModify(e.target.value);
                  const found = tracks.find((t) => t.id === e.target.value);
                  if (found) {
                    setModifiedTitle(found.title);
                    setModifiedGenre(found.genre);
                  }
                }}
                className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
              >
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} - {t.artist} ({t.album})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-neutral-300 block mb-1">New Track Title</label>
              <input
                type="text"
                value={modifiedTitle}
                onChange={(e) => setModifiedTitle(e.target.value)}
                placeholder="Enter updated song title"
                className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="text-neutral-300 block mb-1">Genre</label>
              <select
                value={modifiedGenre}
                onChange={(e) => setModifiedGenre(e.target.value as MusicGenre)}
                className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white capitalize"
              >
                <option value="afrobeat">Afrobeat</option>
                <option value="pop">Pop</option>
                <option value="rap">Rap & Hip-Hop</option>
                <option value="oldschool">Old School & Funk</option>
                <option value="r&b">R&B & Neo-Soul</option>
                <option value="synthwave">Synthwave</option>
                <option value="lo-fi">Lo-Fi</option>
                <option value="ambient">Ambient</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors"
            >
              Save Changes to Flontmie
            </button>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE ARTIST PROFILE ON FLONTMIE                       */}
      {/* ============================================================== */}
      {isCreateArtistModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121214] border border-white/10 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span>Create Artist Profile on Flontmie</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Generates a unique ID and a live public artist page on Flontmie
                </p>
              </div>
              <button
                onClick={() => setIsCreateArtistModalOpen(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {artistSuccessNotice ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">{artistSuccessNotice}</h4>
                <p className="text-xs text-neutral-400">The public artist page is now ready for listeners!</p>
              </div>
            ) : (
              <form onSubmit={handleCreateArtistSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-neutral-300 font-medium block mb-1">Artist / Stage Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kairos Nova"
                      value={newArtistName}
                      onChange={(e) => setNewArtistName(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white placeholder-neutral-500"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-300 font-medium block mb-1">Distributor Source</label>
                    <select
                      value={distributorName}
                      onChange={(e) => setDistributorName(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white"
                    >
                      <option value="TuneCore Direct on Flontmie">TuneCore Direct on Flontmie</option>
                      <option value="CDBaby Gateway on Flontmie">CDBaby Gateway on Flontmie</option>
                      <option value="Ditto Music Hub on Flontmie">Ditto Music Hub on Flontmie</option>
                      <option value="DistroKid Direct on Flontmie">DistroKid Direct on Flontmie</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-neutral-300 font-medium block mb-1">Primary Genre</label>
                    <select
                      value={newArtistGenre}
                      onChange={(e) => setNewArtistGenre(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white"
                    >
                      <option value="Afrobeat">Afrobeat</option>
                      <option value="Pop">Pop</option>
                      <option value="Rap & Hip-Hop">Rap & Hip-Hop</option>
                      <option value="Synthwave">Synthwave</option>
                      <option value="Lo-Fi">Lo-Fi</option>
                      <option value="Old School">Old School</option>
                      <option value="R&B">R&B</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-neutral-300 font-medium block mb-1">Country / Territory</label>
                    <select
                      value={newArtistCountry}
                      onChange={(e) => setNewArtistCountry(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white"
                    >
                      <option value="US">United States (US)</option>
                      <option value="NG">Nigeria (NG)</option>
                      <option value="UK">United Kingdom (UK)</option>
                      <option value="ZA">South Africa (ZA)</option>
                      <option value="CA">Canada (CA)</option>
                      <option value="DE">Germany (DE)</option>
                      <option value="JP">Japan (JP)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-neutral-300 font-medium block mb-1">Biography</label>
                  <textarea
                    rows={3}
                    placeholder="Describe the artist's musical style, background, influences, and achievements..."
                    value={newArtistBio}
                    onChange={(e) => setNewArtistBio(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white placeholder-neutral-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-neutral-300 font-medium block mb-1">Verification Status</label>
                    <select
                      value={newArtistClaimStatus}
                      onChange={(e) => setNewArtistClaimStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white"
                    >
                      <option value="Verified">Verified Official Profile</option>
                      <option value="Official Ingestion">Official Distributor Ingestion</option>
                      <option value="Pending Claim">Pending Claim by Artist</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-neutral-300 font-medium block mb-1">Profile Photo Preset</label>
                    <select
                      value={newArtistAvatar}
                      onChange={(e) => {
                        setNewArtistAvatar(e.target.value);
                        setNewArtistBanner(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white"
                    >
                      <option value={IMAGES.synthwave}>Neon Horizon (Cyberpunk)</option>
                      <option value={IMAGES.afrobeats}>Lagos Sunset (Afro-Gold)</option>
                      <option value={IMAGES.lofi}>Rainy Lo-Fi Atmosphere</option>
                      <option value={IMAGES.partymix}>Club Euphoria Spotlight</option>
                      <option value={IMAGES.series}>Chronicles Studio High-Res</option>
                    </select>
                  </div>
                </div>

                {/* Social media links */}
                <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                    Social Media Handles (Optional)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Instagram @handle"
                      value={newArtistInstagram}
                      onChange={(e) => setNewArtistInstagram(e.target.value)}
                      className="px-3 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-white"
                    />
                    <input
                      type="text"
                      placeholder="X / Twitter @handle"
                      value={newArtistTwitter}
                      onChange={(e) => setNewArtistTwitter(e.target.value)}
                      className="px-3 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs tracking-wider uppercase shadow-xl shadow-purple-600/30 transition-all hover:scale-[1.01]"
                  >
                    Publish Artist Profile to Flontmie
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE RELEASE (SINGLE, EP, OR ALBUM) WITH TRACKLIST     */}
      {/* ============================================================== */}
      {isCreateReleaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121214] border border-white/10 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-150 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-purple-400" />
                  <span>Create Release (Single, EP, or Album)</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Multi-track ingestion with standard ISRC, UPC, audio quality validation, and metadata
                </p>
              </div>
              <button
                onClick={() => setIsCreateReleaseModalOpen(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {releaseNotice ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">{releaseNotice}</h4>
                <p className="text-xs text-neutral-400">Tracks have been registered in the Flontmie catalog.</p>
              </div>
            ) : (
              <div className="space-y-5 text-xs">
                {/* Validation error banner */}
                {validationErrors.length > 0 && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-1 text-red-300">
                    <div className="flex items-center gap-2 font-bold text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Release Validation Errors:</span>
                    </div>
                    <ul className="list-disc list-inside text-[11px] space-y-0.5">
                      {validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Artist Selector & Release Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-neutral-300 font-medium block mb-1">Artist Profile</label>
                    <select
                      value={selectedArtistForRelease}
                      onChange={(e) => setSelectedArtistForRelease(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white"
                    >
                      {artistList.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.primaryGenre || 'Artist'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-neutral-300 font-medium block mb-1">Release Type</label>
                    <select
                      value={releaseType}
                      onChange={(e) => setReleaseType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white"
                    >
                      <option value="Single">Single (1 Track)</option>
                      <option value="EP">EP (3–6 Tracks)</option>
                      <option value="Album">Full Length Album (7+ Tracks)</option>
                    </select>
                  </div>
                </div>

                {/* Release Title & UPC */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-neutral-300 font-medium block mb-1">Release / Album Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Celestial Horizon Deluxe"
                      value={releaseTitle}
                      onChange={(e) => setReleaseTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-300 font-medium block mb-1">UPC / Barcode (EAN)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={releaseUpc}
                        onChange={(e) => setReleaseUpc(e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setReleaseUpc(`8401928${Math.floor(10000 + Math.random() * 90000)}`)}
                        className="px-2.5 py-1 rounded-lg bg-white/10 text-[10px] text-neutral-300 hover:text-white shrink-0"
                      >
                        Auto
                      </button>
                    </div>
                  </div>
                </div>

                {/* Genre & Audio Format */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-neutral-300 font-medium block mb-1">Primary Genre</label>
                    <select
                      value={releaseGenre}
                      onChange={(e) => setReleaseGenre(e.target.value as MusicGenre)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white capitalize"
                    >
                      <option value="afrobeat">Afrobeat</option>
                      <option value="pop">Pop</option>
                      <option value="rap">Rap & Hip-Hop</option>
                      <option value="synthwave">Synthwave</option>
                      <option value="lo-fi">Lo-Fi</option>
                      <option value="ambient">Ambient</option>
                      <option value="oldschool">Old School</option>
                      <option value="r&b">R&B</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-neutral-300 font-medium block mb-1">Audio Specification</label>
                    <select
                      value={audioFormat}
                      onChange={(e) => setAudioFormat(e.target.value as any)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white font-mono text-[11px]"
                    >
                      <option value="24-bit FLAC (Lossless)">24-bit FLAC (Lossless)</option>
                      <option value="WAV 48kHz / 24-bit">WAV 48kHz / 24-bit</option>
                      <option value="MP3 320kbps CBR">MP3 320kbps CBR</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-neutral-300 font-medium block mb-1">Release Date</label>
                    <input
                      type="date"
                      value={releaseDate}
                      onChange={(e) => setReleaseDate(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>

                {/* Multi-Track Listing Builder */}
                <div className="space-y-3 pt-3 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Disc className="w-4 h-4 text-purple-400" />
                        <span>Track Listing ({releaseTracks.length} tracks)</span>
                      </h4>
                      <p className="text-[11px] text-neutral-400">
                        Add and configure songs for this release with credits and ISRC
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddTrackToRelease}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Track</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {releaseTracks.map((trk, idx) => (
                      <div
                        key={trk.id}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] text-neutral-400 font-bold">
                            Track #{trk.trackNumber}
                          </span>

                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-[11px] text-neutral-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={trk.isExplicit}
                                onChange={(e) => handleUpdateReleaseTrack(idx, { isExplicit: e.target.checked })}
                                className="rounded accent-red-500"
                              />
                              <span>Explicit</span>
                            </label>

                            {releaseTracks.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTrackFromRelease(idx)}
                                className="text-neutral-500 hover:text-red-400 p-1"
                                title="Remove track"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Track Title *"
                            value={trk.title}
                            onChange={(e) => handleUpdateReleaseTrack(idx, { title: e.target.value })}
                            className="px-2.5 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-white"
                          />

                          <input
                            type="text"
                            placeholder="Featured Artists"
                            value={trk.featuredArtists || ''}
                            onChange={(e) => handleUpdateReleaseTrack(idx, { featuredArtists: e.target.value })}
                            className="px-2.5 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-white"
                          />

                          <div className="flex gap-1">
                            <input
                              type="text"
                              placeholder="ISRC Code"
                              value={trk.isrc}
                              onChange={(e) => handleUpdateReleaseTrack(idx, { isrc: e.target.value })}
                              className="w-full px-2.5 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-white font-mono text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateReleaseTrack(idx, { isrc: `US-FLN-26-${Math.floor(10000 + Math.random() * 90000)}` })}
                              className="px-2 py-1 bg-white/10 text-[9px] rounded text-neutral-300 hover:text-white shrink-0"
                            >
                              Gen
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-neutral-400 font-mono">
                          <span>File: {trk.audioFileName}</span>
                          <span className="text-purple-400 cursor-pointer hover:underline">
                            Replace Master Audio
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons: Save Draft, Platform Review, Publish Live */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-3 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => handleSubmitRelease('draft')}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-neutral-200 text-xs font-semibold"
                  >
                    Save as Draft
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmitRelease('under_review')}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 text-xs font-semibold border border-purple-500/30"
                  >
                    Submit for Platform Review
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmitRelease('live')}
                    className="w-full sm:flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 tracking-wide"
                  >
                    Publish Directly to Flontmie Live
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: SAFEGUARDED DELETE CONFIRMATION                         */}
      {/* ============================================================== */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Safeguarded Release Deletion</h3>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-white">"{itemToDelete.title}"</strong> from the Flontmie catalog? This will delete the playback availability for listeners and take down associated audio streams.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
