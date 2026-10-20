import React, { useState, useEffect, useCallback } from 'react';
import { 
  Network, 
  Upload, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Plus, 
  Music, 
  Users, 
  FileCheck, 
  Radio,
  Disc,
  Loader2,
  RefreshCw,
  Building2,
  Video,
  FileText,
  Trash2,
  Edit3,
  Play,
  X
} from 'lucide-react';
import { 
  DistributorIngestionItem, 
  DistributorAccessGrant, 
  Track, 
  MusicGenre 
} from '../../types/music';
import { api } from '../../services/api';
import { resolveArtworkUrl, handleImageError } from '../../utils/artwork';

interface DistributorDashboardProps {
  ingestions: DistributorIngestionItem[];
  accessGrants: DistributorAccessGrant[];
  onIngestNewTrack: (item: DistributorIngestionItem, newTrack?: Track) => void;
  onToggleGrantAccess: (grantId: string) => void;
  onPlayTrack: (track: Track) => void;
  allTracks: Track[];
}

export const DistributorDashboard: React.FC<DistributorDashboardProps> = ({
  onIngestNewTrack,
  onPlayTrack,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'artists' | 'labels' | 'catalog' | 'claims'>('upload');

  // Real Backend State Scoped to this Authorized Distributor
  const [distributorInfo, setDistributorInfo] = useState<{ id: string; name: string; status: string } | null>(null);
  const [dbStats, setDbStats] = useState<{
    managed_artists_count: number;
    managed_labels_count: number;
    ingested_tracks_count: number;
    ingested_albums_count: number;
    total_streams: number;
    pending_claims_count: number;
  } | null>(null);
  const [dbArtists, setDbArtists] = useState<any[]>([]);
  const [dbLabels, setDbLabels] = useState<any[]>([]);
  const [dbAlbums, setDbAlbums] = useState<any[]>([]);
  const [dbTracks, setDbTracks] = useState<any[]>([]);
  const [dbClaims, setDbClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Multipart Release Upload Form (Audio + Cover + Video + Lyrics)
  const [trackTitle, setTrackTitle] = useState('');
  const [selectedArtistId, setSelectedArtistId] = useState('');
  const [customArtistName, setCustomArtistName] = useState('');
  const [selectedLabelId, setSelectedLabelId] = useState('');
  const [albumName, setAlbumName] = useState('');
  const [releaseType, setReleaseType] = useState<'single' | 'ep' | 'album'>('single');
  const [genre, setGenre] = useState<MusicGenre>('Afrobeats');
  const [country, setCountry] = useState('US');
  const [releaseDate, setReleaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isrc, setIsrc] = useState('');
  const [upc, setUpc] = useState('');
  const [bpm, setBpm] = useState(120);
  const [explicit, setExplicit] = useState(false);
  const [lyricsText, setLyricsText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [lyricsFile, setLyricsFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Create Artist Form State
  const [newArtistName, setNewArtistName] = useState('');
  const [newArtistStage, setNewArtistStage] = useState('');
  const [newArtistGenre, setNewArtistGenre] = useState('Afrobeats');
  const [newArtistCountry, setNewArtistCountry] = useState('US');
  const [newArtistLabelId, setNewArtistLabelId] = useState('');
  const [newArtistAvatar, setNewArtistAvatar] = useState('');
  const [newArtistBio, setNewArtistBio] = useState('');
  const [creatingArtist, setCreatingArtist] = useState(false);
  const [editingArtist, setEditingArtist] = useState<any | null>(null);

  // Create Record Label Form State
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelEmail, setNewLabelEmail] = useState('');
  const [newLabelCountry, setNewLabelCountry] = useState('US');
  const [creatingLabel, setCreatingLabel] = useState(false);

  // Edit Track Modal State
  const [editingTrack, setEditingTrack] = useState<any | null>(null);

  // Artist Claim Submission Form State
  const [claimArtistId, setClaimArtistId] = useState('');
  const [claimantName, setClaimantName] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [evidenceType, setEvidenceType] = useState('Distribution Agreement & ISRC Ownership');
  const [evidenceDetails, setEvidenceDetails] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);

  const notify = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 6000);
  };

  const fetchDistributorPortal = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getDistributorDashboard();
      if (res && res.status === 'success') {
        setDistributorInfo(res.distributor || null);
        setDbStats(res.stats || null);
        const artists = res.artists || [];
        const labels = res.labels || [];
        setDbArtists(artists);
        setDbLabels(labels);
        setDbAlbums(res.albums || []);
        setDbTracks(res.tracks || []);
        setDbClaims(res.claims || []);
        if (artists.length > 0 && !selectedArtistId) {
          setSelectedArtistId(artists[0].id);
        }
        if (artists.length > 0 && !claimArtistId) {
          setClaimArtistId(artists[0].id);
        }
      }
    } catch (err: any) {
      notify('error', err?.message || 'Failed to load distributor portal data.');
    } finally {
      setLoading(false);
    }
  }, [selectedArtistId, claimArtistId]);

  useEffect(() => {
    fetchDistributorPortal();
  }, [fetchDistributorPortal]);

  // 1. Upload Audio, Cover, Video & Lyrics to MySQL & Server Storage
  const handleDirectUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackTitle.trim()) {
      notify('error', 'Track title is required.');
      return;
    }
    if (!selectedArtistId && !customArtistName.trim()) {
      notify('error', 'Please select an artist from your roster or enter a new artist name.');
      return;
    }
    if (!audioFile && !videoFile) {
      notify('error', 'Please select a master audio file (.mp3, .wav, .flac, .m4a) or music video file (.mp4, .webm).');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('title', trackTitle.trim());
      if (selectedArtistId && selectedArtistId !== '__new__') {
        formData.append('artist_id', selectedArtistId);
        const foundArtist = dbArtists.find((a) => a.id === selectedArtistId);
        if (foundArtist) {
          formData.append('artist_name', foundArtist.name);
        }
      } else {
        formData.append('artist_name', customArtistName.trim());
      }

      if (selectedLabelId) {
        formData.append('label_id', selectedLabelId);
        const foundLabel = dbLabels.find((l) => l.id === selectedLabelId);
        if (foundLabel) {
          formData.append('label_name', foundLabel.name);
        }
      }

      formData.append('album_name', albumName.trim() || `${trackTitle.trim()} - Single`);
      formData.append('release_type', releaseType);
      formData.append('genre', genre);
      formData.append('country', country.trim().toUpperCase() || 'US');
      formData.append('release_date', releaseDate);
      formData.append('isrc', isrc.trim());
      formData.append('upc', upc.trim());
      formData.append('bpm', String(bpm || 120));
      formData.append('explicit', explicit ? '1' : '0');
      formData.append('lyrics', lyricsText.trim());

      if (audioFile) {
        formData.append('audio_file', audioFile);
      }
      if (coverFile) {
        formData.append('cover_file', coverFile);
      }
      if (videoFile) {
        formData.append('video_file', videoFile);
      }
      if (lyricsFile) {
        formData.append('lyrics_file', lyricsFile);
      }

      const res = await api.uploadReleaseMultipartWithProgress(formData, (pct) => {
        setUploadProgress(pct);
      });

      if (res && res.status === 'success' && res.track) {
        const mapped = api.mapDbTrack(res.track);
        onIngestNewTrack(
          {
            id: mapped.id,
            trackTitle: mapped.title,
            artistName: mapped.artist,
            artistId: mapped.artistId,
            labelName: mapped.label,
            isrc: mapped.isrc,
            upc: mapped.upc,
            genre: mapped.genre,
            releaseDate: mapped.releaseDate,
            flontmieStatus: 'Live on Flontmie',
            grantedUploadAccess: true,
            uploadedByDistributor: distributorInfo?.name || 'Authorized Distributor',
            audioQuality: 'Lossless Hi-Res',
          },
          mapped
        );

        notify('success', res.message || `Uploaded "${mapped.title}" by ${mapped.artist}.`);
        setTrackTitle('');
        setCustomArtistName('');
        setAlbumName('');
        setIsrc('');
        setUpc('');
        setLyricsText('');
        setAudioFile(null);
        setCoverFile(null);
        setVideoFile(null);
        setLyricsFile(null);
        setUploadProgress(0);
        fetchDistributorPortal();
      }
    } catch (err: any) {
      notify('error', err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // 2. Create Artist Profile in Roster
  const handleCreateArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArtistName.trim()) return;
    setCreatingArtist(true);
    try {
      const selectedLabel = dbLabels.find((l) => l.id === newArtistLabelId);
      const res = await api.createDistributorArtist({
        name: newArtistName.trim(),
        stage_name: newArtistStage.trim() || newArtistName.trim(),
        primary_genre: newArtistGenre,
        country: newArtistCountry.trim().toUpperCase() || 'US',
        label_id: newArtistLabelId || undefined,
        label_name: selectedLabel?.name || undefined,
        avatar_url: newArtistAvatar.trim(),
        bio: newArtistBio.trim(),
      });
      notify('success', res.message || `Created artist profile "${newArtistName}".`);
      setNewArtistName('');
      setNewArtistStage('');
      setNewArtistAvatar('');
      setNewArtistBio('');
      fetchDistributorPortal();
    } catch (err: any) {
      notify('error', err?.message || 'Failed to create artist.');
    } finally {
      setCreatingArtist(false);
    }
  };

  // 3. Create Record Label under Distributor
  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    setCreatingLabel(true);
    try {
      const res = await api.createDistributorLabel({
        name: newLabelName.trim(),
        contact_email: newLabelEmail.trim(),
        country: newLabelCountry.trim().toUpperCase() || 'US',
      });
      notify('success', res.message || `Created record label "${newLabelName}".`);
      setNewLabelName('');
      setNewLabelEmail('');
      fetchDistributorPortal();
    } catch (err: any) {
      notify('error', err?.message || 'Failed to create record label.');
    } finally {
      setCreatingLabel(false);
    }
  };

  // 4. Submit Artist Verification Claim
  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimArtistId || !claimantName.trim() || !claimantEmail.trim()) return;
    setSubmittingClaim(true);
    try {
      const res = await api.submitArtistClaim({
        artist_id: claimArtistId,
        claimant_name: claimantName.trim(),
        claimant_email: claimantEmail.trim(),
        evidence_type: evidenceType,
        evidence_details: evidenceDetails.trim(),
        proof_url: proofUrl.trim(),
      });
      notify('success', res.message || 'Verification claim submitted.');
      setClaimantName('');
      setClaimantEmail('');
      setEvidenceDetails('');
      setProofUrl('');
      fetchDistributorPortal();
    } catch (err: any) {
      notify('error', err?.message || 'Failed to submit claim.');
    } finally {
      setSubmittingClaim(false);
    }
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-200">
      {/* Distributor Portal Header */}
      <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900 to-purple-950/40 border border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold">
            <Network className="w-3.5 h-3.5" />
            <span>Authorized Music Distributor Portal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {distributorInfo?.name || 'Distributor Operations'}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl">
            Create and manage your authorized artists and record labels, upload master audio, music videos, artwork, and synced lyrics files, and manage releases created under your distributor account.
          </p>
        </div>

        <button
          onClick={fetchDistributorPortal}
          className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          <span>Sync Roster & Catalog</span>
        </button>
      </div>

      {/* Real Database Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-neutral-900/50 border border-white/[0.06]">
          <span className="text-[11px] text-neutral-400 block">Managed Artists</span>
          <span className="text-xl font-extrabold font-mono text-white">
            {dbStats?.managed_artists_count ?? dbArtists.length}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/50 border border-white/[0.06]">
          <span className="text-[11px] text-neutral-400 block">Managed Labels</span>
          <span className="text-xl font-extrabold font-mono text-purple-400">
            {dbStats?.managed_labels_count ?? dbLabels.length}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/50 border border-white/[0.06]">
          <span className="text-[11px] text-neutral-400 block">Uploaded Tracks</span>
          <span className="text-xl font-extrabold font-mono text-emerald-400">
            {dbStats?.ingested_tracks_count ?? dbTracks.length}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/50 border border-white/[0.06]">
          <span className="text-[11px] text-neutral-400 block">Total Streams</span>
          <span className="text-xl font-extrabold font-mono text-white">
            {(dbStats?.total_streams ?? 0).toLocaleString()}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/50 border border-white/[0.06]">
          <span className="text-[11px] text-neutral-400 block">Verification Claims</span>
          <span className="text-xl font-extrabold font-mono text-amber-400">
            {dbStats?.pending_claims_count ?? dbClaims.length}
          </span>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/50 border-red-500/40 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/[0.08]">
        {[
          { id: 'upload', label: 'Upload Audio / Video / Lyrics', icon: <Upload className="w-4 h-4" /> },
          { id: 'artists', label: `My Artists (${dbArtists.length})`, icon: <Users className="w-4 h-4" /> },
          { id: 'labels', label: `My Labels (${dbLabels.length})`, icon: <Building2 className="w-4 h-4" /> },
          { id: 'catalog', label: `My Releases & Tracks (${dbTracks.length})`, icon: <Music className="w-4 h-4" /> },
          { id: 'claims', label: `Artist Claims (${dbClaims.length})`, icon: <FileCheck className="w-4 h-4" /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === t.id
                ? 'bg-white text-black shadow-lg'
                : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: UPLOAD AUDIO, VIDEO, ARTWORK & LYRICS FILES */}
      {activeTab === 'upload' && (
        <div className="p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-6">
          <div className="border-b border-white/[0.06] pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-400" />
              <span>Upload Master Audio, Video, Cover Artwork & Synced Lyrics</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Supported formats: Audio (.mp3, .wav, .flac, .m4a, .aac, .ogg up to 100MB), Video (.mp4, .webm, .mov up to 250MB), Artwork (.jpg, .png, .webp up to 15MB), and Lyrics (.lrc, .txt, .srt).
            </p>
          </div>

          <form onSubmit={handleDirectUpload} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Track Title *
                </label>
                <input
                  type="text"
                  required
                  value={trackTitle}
                  onChange={(e) => setTrackTitle(e.target.value)}
                  placeholder="Enter official song title"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Managed Artist *
                </label>
                <select
                  value={selectedArtistId}
                  onChange={(e) => setSelectedArtistId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  {dbArtists.length === 0 && <option value="__new__">+ Create New Artist on Upload</option>}
                  {dbArtists.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                  {dbArtists.length > 0 && <option value="__new__">+ Enter New Artist Name...</option>}
                </select>
              </div>

              {(selectedArtistId === '__new__' || dbArtists.length === 0) ? (
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    New Artist Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customArtistName}
                    onChange={(e) => setCustomArtistName(e.target.value)}
                    placeholder="Artist name to create in your roster"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Record Label (Optional)
                  </label>
                  <select
                    value={selectedLabelId}
                    onChange={(e) => setSelectedLabelId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">-- Independent / Direct --</option>
                    {dbLabels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Release / Album Title
                </label>
                <input
                  type="text"
                  value={albumName}
                  onChange={(e) => setAlbumName(e.target.value)}
                  placeholder="Leave blank for Single"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Release Format
                </label>
                <select
                  value={releaseType}
                  onChange={(e) => setReleaseType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="single">Single</option>
                  <option value="ep">EP</option>
                  <option value="album">Full Album</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Primary Genre
                </label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="Afrobeats">Afrobeats</option>
                  <option value="Pop">Pop</option>
                  <option value="Rap">Rap & Hip-Hop</option>
                  <option value="R&B">R&B & Soul</option>
                  <option value="Amapiano">Amapiano</option>
                  <option value="Synthwave">Electronic</option>
                  <option value="Lo-Fi">Lo-Fi</option>
                  <option value="Ambient">Ambient</option>
                  <option value="Oldschool">Classics</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Release Date
                </label>
                <input
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  ISRC Code
                </label>
                <input
                  type="text"
                  value={isrc}
                  onChange={(e) => setIsrc(e.target.value)}
                  placeholder="e.g. USRC12600001"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  UPC / EAN Barcode
                </label>
                <input
                  type="text"
                  value={upc}
                  onChange={(e) => setUpc(e.target.value)}
                  placeholder="12-digit UPC"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Country (ISO)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  placeholder="US"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={explicit}
                    onChange={(e) => setExplicit(e.target.checked)}
                    className="accent-purple-500 w-4 h-4"
                  />
                  <span>Explicit Lyrics Advisory</span>
                </label>
              </div>
            </div>

            {/* File Pickers: Audio, Artwork, Video, Lyrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-white/10 space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-purple-400" />
                  <span>1. Audio File (.mp3/.wav/.flac)</span>
                </label>
                <input
                  type="file"
                  accept=".mp3,.wav,.flac,.m4a,.aac,.ogg,.opus,audio/*"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-neutral-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-purple-600/20 file:text-purple-300 hover:file:bg-purple-600/30"
                />
                {audioFile && (
                  <p className="text-[10px] font-mono text-emerald-400 truncate">
                    {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950 border border-white/10 space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Disc className="w-3.5 h-3.5 text-pink-400" />
                  <span>2. Cover Artwork (.jpg/.png)</span>
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-neutral-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-pink-600/20 file:text-pink-300 hover:file:bg-pink-600/30"
                />
                {coverFile && (
                  <p className="text-[10px] font-mono text-emerald-400 truncate">
                    {coverFile.name} ({(coverFile.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950 border border-white/10 space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-sky-400" />
                  <span>3. Video File (.mp4/.webm)</span>
                </label>
                <input
                  type="file"
                  accept=".mp4,.webm,.m4v,.mov,video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-neutral-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-sky-600/20 file:text-sky-300 hover:file:bg-sky-600/30"
                />
                {videoFile && (
                  <p className="text-[10px] font-mono text-emerald-400 truncate">
                    {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950 border border-white/10 space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>4. Lyrics File (.lrc/.txt/.srt)</span>
                </label>
                <input
                  type="file"
                  accept=".lrc,.txt,.srt"
                  onChange={(e) => setLyricsFile(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-neutral-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-amber-600/20 file:text-amber-300 hover:file:bg-amber-600/30"
                />
                {lyricsFile && (
                  <p className="text-[10px] font-mono text-emerald-400 truncate">
                    {lyricsFile.name}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Lyrics Text / Timed LRC Lines (Optional if uploading a .lrc / .txt file)
              </label>
              <textarea
                rows={3}
                value={lyricsText}
                onChange={(e) => setLyricsText(e.target.value)}
                placeholder="[00:12.00] First line of lyrics..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            {uploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-purple-300 font-mono">
                  <span>Uploading media files to server...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/25 transition-all cursor-pointer"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading & Persisting ({uploadProgress}%)...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload & Publish Release to Catalog</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: CREATE & MANAGE DISTRIBUTOR ARTISTS */}
      {activeTab === 'artists' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-purple-400" />
              <span>Create New Artist Profile</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Artists created here are scoped exclusively to your distributor account.
            </p>

            <form onSubmit={handleCreateArtist} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Artist / Band Name *
                </label>
                <input
                  type="text"
                  required
                  value={newArtistName}
                  onChange={(e) => setNewArtistName(e.target.value)}
                  placeholder="Official artist name"
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Primary Genre
                  </label>
                  <select
                    value={newArtistGenre}
                    onChange={(e) => setNewArtistGenre(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
                  >
                    <option value="Afrobeats">Afrobeats</option>
                    <option value="Pop">Pop</option>
                    <option value="Rap">Rap & Hip-Hop</option>
                    <option value="R&B">R&B & Soul</option>
                    <option value="Electronic">Electronic</option>
                    <option value="Lo-Fi">Lo-Fi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Country (ISO)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={newArtistCountry}
                    onChange={(e) => setNewArtistCountry(e.target.value.toUpperCase())}
                    placeholder="US"
                    className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Assign to Managed Record Label (Optional)
                </label>
                <select
                  value={newArtistLabelId}
                  onChange={(e) => setNewArtistLabelId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
                >
                  <option value="">-- Independent / Direct --</option>
                  {dbLabels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Avatar Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={newArtistAvatar}
                  onChange={(e) => setNewArtistAvatar(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Artist Biography
                </label>
                <textarea
                  rows={3}
                  value={newArtistBio}
                  onChange={(e) => setNewArtistBio(e.target.value)}
                  placeholder="Official artist biography..."
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={creatingArtist}
                className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-all cursor-pointer"
              >
                {creatingArtist ? 'Creating Artist...' : 'Create Artist in My Roster'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-base font-bold text-white">
              My Managed Artists ({dbArtists.length})
            </h3>
            {dbArtists.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">
                No artists created under your distributor account yet. Use the form on the left to add your first artist.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {dbArtists.map((art) => (
                  <div
                    key={art.id}
                    className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={resolveArtworkUrl(art.avatar_url, 'artist', art.name)}
                        alt={art.name}
                        onError={(e) => handleImageError(e, art.name, 'artist')}
                        className="w-11 h-11 rounded-full object-cover bg-neutral-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{art.name}</p>
                        <p className="text-[11px] text-neutral-400 truncate">
                          {art.primary_genre || 'Music'} · {art.country || 'US'} {art.label_name ? `· ${art.label_name}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditingArtist(art)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs cursor-pointer"
                        title="Edit Artist"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await api.deleteDistributorArtist(art.id);
                            notify('success', `Removed artist "${art.name}".`);
                            fetchDistributorPortal();
                          } catch (err: any) {
                            notify('error', err?.message || 'Delete failed.');
                          }
                        }}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs cursor-pointer"
                        title="Delete Artist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CREATE & MANAGE RECORD LABELS */}
      {activeTab === 'labels' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-400" />
              <span>Create Record Label</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Register record labels managed under your distribution umbrella.
            </p>

            <form onSubmit={handleCreateLabel} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Record Label Name *
                </label>
                <input
                  type="text"
                  required
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Official label name"
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Label Contact Email
                </label>
                <input
                  type="email"
                  value={newLabelEmail}
                  onChange={(e) => setNewLabelEmail(e.target.value)}
                  placeholder="contact@label.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Country (ISO)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={newLabelCountry}
                  onChange={(e) => setNewLabelCountry(e.target.value.toUpperCase())}
                  placeholder="US"
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white uppercase font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={creatingLabel}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer"
              >
                {creatingLabel ? 'Creating Label...' : 'Create Record Label'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-base font-bold text-white">
              My Managed Record Labels ({dbLabels.length})
            </h3>
            {dbLabels.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">
                No record labels created under your distributor account yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {dbLabels.map((lbl) => (
                  <div
                    key={lbl.id}
                    className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{lbl.name}</p>
                      <p className="text-[11px] text-neutral-400">
                        {lbl.contact_email || 'No email set'} · {lbl.country || 'US'}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await api.deleteDistributorLabel(lbl.id);
                          notify('success', `Removed label "${lbl.name}".`);
                          fetchDistributorPortal();
                        } catch (err: any) {
                          notify('error', err?.message || 'Delete failed.');
                        }
                      }}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs cursor-pointer"
                      title="Delete Label"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: MY RELEASES & TRACKS */}
      {activeTab === 'catalog' && (
        <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-neutral-900/30">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">
              Releases & Tracks Managed by Your Distributor Account ({dbTracks.length})
            </h3>
          </div>
          {dbTracks.length === 0 ? (
            <div className="py-16 text-center text-xs text-neutral-500">
              No tracks uploaded by your distributor account yet. Use the "Upload Audio / Video / Lyrics" tab to ingest your first release.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.03] text-neutral-400 uppercase text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">Track / Release</th>
                    <th className="py-3 px-4">Artist</th>
                    <th className="py-3 px-4">ISRC / UPC</th>
                    <th className="py-3 px-4">Media Assets</th>
                    <th className="py-3 px-4">Streams</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {dbTracks.map((t) => (
                    <tr key={t.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={resolveArtworkUrl(t.cover_art_url, 'track', t.title)}
                            alt={t.title}
                            onError={(e) => handleImageError(e, t.title, 'track')}
                            className="w-9 h-9 rounded object-cover bg-neutral-800 shrink-0"
                          />
                          <div>
                            <div className="font-semibold text-white">{t.title}</div>
                            <div className="text-[11px] text-neutral-500">{t.album_name || 'Single'} · {t.genre}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-neutral-300">{t.artist_name}</td>
                      <td className="py-3 px-4 font-mono text-neutral-400">
                        <div>{t.isrc || '—'}</div>
                        {t.upc && <div className="text-[10px] text-neutral-500">UPC: {t.upc}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-mono uppercase">
                            {t.audio_format || 'Audio'}
                          </span>
                          {t.video_url && (
                            <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[10px] font-mono">
                              Video
                            </span>
                          )}
                          {t.lyrics && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-mono">
                              Lyrics
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-300">
                        {Number(t.stream_count || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => onPlayTrack(api.mapDbTrack(t))}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>Play</span>
                        </button>
                        <button
                          onClick={() => setEditingTrack(t)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await api.deleteDistributorTrack(t.id);
                              notify('success', `Removed track "${t.title}".`);
                              fetchDistributorPortal();
                            } catch (err: any) {
                              notify('error', err?.message || 'Delete failed.');
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ARTIST CLAIMS */}
      {activeTab === 'claims' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-base font-bold text-white">Submit Artist Profile Verification Claim</h3>
            {dbArtists.length === 0 ? (
              <p className="text-xs text-neutral-500">
                Create an artist profile in your roster first before submitting a verification claim.
              </p>
            ) : (
              <form onSubmit={handleSubmitClaim} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Select Managed Artist
                  </label>
                  <select
                    value={claimArtistId}
                    onChange={(e) => setClaimArtistId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
                  >
                    {dbArtists.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Representative Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Official Verification Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={claimantEmail}
                    onChange={(e) => setClaimantEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Verification Notes & ISRC/UPC Reference
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={evidenceDetails}
                    onChange={(e) => setEvidenceDetails(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingClaim}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer"
                >
                  {submittingClaim ? 'Submitting...' : 'Submit Claim to Administrator'}
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-7 p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-base font-bold text-white">Submitted Claims ({dbClaims.length})</h3>
            {dbClaims.length === 0 ? (
              <p className="text-xs text-neutral-500 py-8 text-center">No verification claims submitted yet.</p>
            ) : (
              <div className="space-y-2.5">
                {dbClaims.map((clm) => (
                  <div key={clm.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">{clm.artist_name || clm.artist_id}</p>
                      <p className="text-neutral-400">{clm.claimant_name} · {clm.claimant_email}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold uppercase text-[10px]">
                      {clm.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Artist Modal */}
      {editingArtist && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Edit Artist: {editingArtist.name}</h3>
              <button onClick={() => setEditingArtist(null)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-400 mb-1">Artist Name</label>
                <input
                  type="text"
                  value={editingArtist.name || ''}
                  onChange={(e) => setEditingArtist({ ...editingArtist, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Primary Genre</label>
                <input
                  type="text"
                  value={editingArtist.primary_genre || ''}
                  onChange={(e) => setEditingArtist({ ...editingArtist, primary_genre: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Biography</label>
                <textarea
                  rows={3}
                  value={editingArtist.bio || ''}
                  onChange={(e) => setEditingArtist({ ...editingArtist, bio: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
              </div>
              <button
                onClick={async () => {
                  try {
                    await api.updateDistributorArtist({
                      artist_id: editingArtist.id,
                      name: editingArtist.name,
                      primary_genre: editingArtist.primary_genre,
                      bio: editingArtist.bio,
                      country: editingArtist.country,
                      avatar_url: editingArtist.avatar_url,
                    });
                    notify('success', 'Artist updated.');
                    setEditingArtist(null);
                    fetchDistributorPortal();
                  } catch (err: any) {
                    notify('error', err?.message || 'Update failed.');
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Track Modal */}
      {editingTrack && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Edit Track Metadata & Lyrics</h3>
              <button onClick={() => setEditingTrack(null)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Track Title</label>
                  <input
                    type="text"
                    value={editingTrack.title || ''}
                    onChange={(e) => setEditingTrack({ ...editingTrack, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Genre</label>
                  <input
                    type="text"
                    value={editingTrack.genre || ''}
                    onChange={(e) => setEditingTrack({ ...editingTrack, genre: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">ISRC</label>
                  <input
                    type="text"
                    value={editingTrack.isrc || ''}
                    onChange={(e) => setEditingTrack({ ...editingTrack, isrc: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">UPC</label>
                  <input
                    type="text"
                    value={editingTrack.upc || ''}
                    onChange={(e) => setEditingTrack({ ...editingTrack, upc: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Lyrics</label>
                <textarea
                  rows={4}
                  value={editingTrack.lyrics || ''}
                  onChange={(e) => setEditingTrack({ ...editingTrack, lyrics: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white font-mono"
                />
              </div>
              <button
                onClick={async () => {
                  try {
                    await api.updateDistributorTrack({
                      track_id: editingTrack.id,
                      title: editingTrack.title,
                      genre: editingTrack.genre,
                      isrc: editingTrack.isrc,
                      upc: editingTrack.upc,
                      lyrics: editingTrack.lyrics,
                    });
                    notify('success', 'Track metadata updated.');
                    setEditingTrack(null);
                    fetchDistributorPortal();
                  } catch (err: any) {
                    notify('error', err?.message || 'Track update failed.');
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer"
              >
                Save Track Updates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
