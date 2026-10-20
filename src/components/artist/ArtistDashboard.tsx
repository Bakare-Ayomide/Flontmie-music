import React, { useState, useEffect, useCallback } from 'react';
import { 
  Upload, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Music, 
  FileText, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  ExternalLink,
  Disc,
  Loader2,
  RefreshCw,
  Video,
  Save
} from 'lucide-react';
import { ArtistProfile, Track, SplitMember, MusicGenre, AlbumRelease } from '../../types/music';
import { api } from '../../services/api';
import { resolveArtworkUrl, handleImageError } from '../../utils/artwork';

interface ArtistDashboardProps {
  artist: ArtistProfile;
  artistTracks: Track[];
  onUploadTrack: (newTrack: Track) => void;
  onUploadAlbum?: (album: AlbumRelease, generatedTracks: Track[]) => void;
  onUpdateSplits: (trackId: string, members: SplitMember[]) => void;
  onViewPublicProfile: () => void;
  onPlayTrack: (track: Track) => void;
}

export const ArtistDashboard: React.FC<ArtistDashboardProps> = ({
  artist: propArtist,
  onUploadTrack,
  onViewPublicProfile,
  onPlayTrack,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'upload' | 'splits' | 'profile'>('overview');
  const [loading, setLoading] = useState(true);
  const [dbArtist, setDbArtist] = useState<any | null>(null);
  const [dbTracks, setDbTracks] = useState<any[]>([]);
  const [dbAlbums, setDbAlbums] = useState<any[]>([]);
  const [dbSplits, setDbSplits] = useState<any[]>([]);
  const [dbStats, setDbStats] = useState<{
    total_streams: number;
    flontmie_plays: number;
    total_likes: number;
    followers: number;
    tracks_count: number;
    albums_count: number;
    estimated_royalties_usd: number;
  } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Upload Form State
  const [title, setTitle] = useState('');
  const [albumName, setAlbumName] = useState('');
  const [releaseType, setReleaseType] = useState<'single' | 'ep' | 'album'>('single');
  const [genre, setGenre] = useState<MusicGenre>('Afrobeats');
  const [bpm, setBpm] = useState(120);
  const [isrc, setIsrc] = useState('');
  const [upc, setUpc] = useState('');
  const [lyricsText, setLyricsText] = useState('');
  const [isExplicit, setIsExplicit] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [lyricsFile, setLyricsFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Split Sheet Editor State
  const [selectedSplitTrackId, setSelectedSplitTrackId] = useState<string>('');
  const [splitMembers, setSplitMembers] = useState<SplitMember[]>([]);
  const [savingSplits, setSavingSplits] = useState(false);

  // Artist Profile Edit State
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCountry, setEditCountry] = useState('US');
  const [editGenre, setEditGenre] = useState('Afrobeats');
  const [editAvatar, setEditAvatar] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const notify = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const fetchArtistDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getArtistDashboard(propArtist?.id);
      if (res && res.status === 'success') {
        setDbArtist(res.artist || null);
        const tracks = res.tracks || [];
        setDbTracks(tracks);
        setDbAlbums(res.albums || []);
        setDbSplits(res.splits || []);
        setDbStats(res.stats || null);

        if (res.artist) {
          setEditName(res.artist.name || '');
          setEditBio(res.artist.bio || '');
          setEditCountry(res.artist.country || 'US');
          setEditGenre(res.artist.primary_genre || 'Afrobeats');
          setEditAvatar(res.artist.avatar_url || '');
        }
        if (tracks.length > 0 && !selectedSplitTrackId) {
          const firstTrackId = tracks[0].id;
          setSelectedSplitTrackId(firstTrackId);
          const existingSplit = (res.splits || []).find((s: any) => s.track_id === firstTrackId);
          if (existingSplit && Array.isArray(existingSplit.members)) {
            setSplitMembers(existingSplit.members);
          } else {
            setSplitMembers([
              {
                id: 'sm_1',
                name: res.artist?.name || propArtist.name || 'Primary Artist',
                role: 'Primary Artist',
                percentage: 100,
                payoutEmail: '',
              },
            ]);
          }
        }
      }
    } catch (err: any) {
      notify('error', err?.message || 'Failed to load artist studio data.');
    } finally {
      setLoading(false);
    }
  }, [propArtist?.id, propArtist?.name, selectedSplitTrackId]);

  useEffect(() => {
    fetchArtistDashboardData();
  }, [fetchArtistDashboardData]);

  const handleTrackUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      notify('error', 'Track title is required.');
      return;
    }
    if (!audioFile && !videoFile) {
      notify('error', 'Please select a master audio file or video file to upload.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      if (dbArtist?.id) formData.append('artist_id', dbArtist.id);
      formData.append('artist_name', dbArtist?.name || propArtist.name || 'Artist');
      formData.append('album_name', albumName.trim() || `${title.trim()} - Single`);
      formData.append('release_type', releaseType);
      formData.append('genre', genre);
      formData.append('bpm', String(bpm || 120));
      formData.append('isrc', isrc.trim());
      formData.append('upc', upc.trim());
      formData.append('explicit', isExplicit ? '1' : '0');
      formData.append('lyrics', lyricsText.trim());
      if (audioFile) formData.append('audio_file', audioFile);
      if (coverFile) formData.append('cover_file', coverFile);
      if (videoFile) formData.append('video_file', videoFile);
      if (lyricsFile) formData.append('lyrics_file', lyricsFile);

      const res = await api.uploadReleaseMultipartWithProgress(formData, (pct) => setUploadProgress(pct));
      if (res && res.status === 'success' && res.track) {
        const mapped = api.mapDbTrack(res.track);
        onUploadTrack(mapped);
        notify('success', res.message || `Uploaded "${mapped.title}" to catalog.`);
        setTitle('');
        setAlbumName('');
        setIsrc('');
        setUpc('');
        setLyricsText('');
        setAudioFile(null);
        setCoverFile(null);
        setVideoFile(null);
        setLyricsFile(null);
        fetchArtistDashboardData();
      }
    } catch (err: any) {
      notify('error', err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const totalSplitPercentage = splitMembers.reduce((sum, m) => sum + Number(m.percentage || 0), 0);

  const handleSaveSplits = async () => {
    if (!selectedSplitTrackId || totalSplitPercentage !== 100) return;
    setSavingSplits(true);
    try {
      const res = await api.saveArtistSplit({
        track_id: selectedSplitTrackId,
        artist_id: dbArtist?.id,
        members: splitMembers,
      });
      notify('success', res.message || 'Royalty split sheet saved to database.');
      fetchArtistDashboardData();
    } catch (err: any) {
      notify('error', err?.message || 'Failed to save split sheet.');
    } finally {
      setSavingSplits(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbArtist?.id) return;
    setSavingProfile(true);
    try {
      const res = await api.updateArtistProfile({
        artist_id: dbArtist.id,
        name: editName.trim(),
        bio: editBio.trim(),
        country: editCountry.trim().toUpperCase(),
        primary_genre: editGenre,
        avatar_url: editAvatar.trim(),
      });
      notify('success', res.message || 'Artist profile saved.');
      fetchArtistDashboardData();
    } catch (err: any) {
      notify('error', err?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const displayName = dbArtist?.name || propArtist?.name || 'Artist Studio';
  const displayAvatar = resolveArtworkUrl(dbArtist?.avatar_url || propArtist?.avatarUrl, 'artist', displayName);

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-200">
      {/* Artist Studio Header */}
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-neutral-900/60 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <img
            src={displayAvatar}
            alt={displayName}
            onError={(e) => handleImageError(e, displayName, 'artist')}
            className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-red-500/40 shadow-xl bg-neutral-800"
          />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                Creator Studio
              </span>
              {Boolean(Number(dbArtist?.verified)) && (
                <span className="text-xs text-blue-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified Artist
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {displayName}
            </h1>
            <p className="text-xs text-neutral-400">
              {dbArtist?.primary_genre || 'Music'} · {dbArtist?.country || 'US'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchArtistDashboardData}
            className="px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-xs font-semibold text-white border border-white/10 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-red-400' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={onViewPublicProfile}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white border border-white/10 transition-all cursor-pointer"
          >
            <span>Public Artist Page</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveSubTab('upload')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white shadow-lg shadow-red-600/25 transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Release</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-200'
              : 'bg-red-950/50 border-red-500/30 text-red-200'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-neutral-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Sub-navigation tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 overflow-x-auto">
        {[
          { id: 'overview', label: 'Analytics & Releases', icon: <TrendingUp className="w-4 h-4" /> },
          { id: 'upload', label: 'Upload Audio / Video / Lyrics', icon: <Upload className="w-4 h-4" /> },
          { id: 'splits', label: 'Royalty Split Sheets', icon: <FileText className="w-4 h-4" /> },
          { id: 'profile', label: 'Artist Profile Settings', icon: <Users className="w-4 h-4" /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeSubTab === t.id
                ? 'bg-white text-black'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & RELEASES */}
      {activeSubTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-xs font-medium">Total Catalog Streams</span>
                <Music className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-white">
                {(dbStats?.total_streams ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-neutral-400">
                {dbStats?.flontmie_plays ?? 0} direct Flontmie plays
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-xs font-medium">Followers</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-white">
                {(dbStats?.followers ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-neutral-400">
                {dbStats?.total_likes ?? 0} track likes
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-xs font-medium">Published Tracks</span>
                <Disc className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-white">
                {dbStats?.tracks_count ?? dbTracks.length}
              </div>
              <div className="text-xs text-neutral-400">
                {dbStats?.albums_count ?? dbAlbums.length} albums / EPs
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-xs font-medium">Estimated Royalties</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-white">
                ${(dbStats?.estimated_royalties_usd ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-neutral-400">Based on verified stream count</div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white">Your Catalog Releases ({dbTracks.length})</h2>
            {dbTracks.length === 0 ? (
              <div className="p-12 rounded-2xl bg-neutral-900/30 border border-white/[0.06] text-center space-y-2">
                <Music className="w-8 h-8 text-neutral-600 mx-auto" />
                <p className="text-sm font-bold text-white">No Tracks Uploaded Yet</p>
                <p className="text-xs text-neutral-400">
                  Switch to the "Upload Audio / Video / Lyrics" tab to publish your first song.
                </p>
              </div>
            ) : (
              <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-neutral-900/30">
                <div className="divide-y divide-white/[0.04]">
                  {dbTracks.map((track) => (
                    <div
                      key={track.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <img
                          src={resolveArtworkUrl(track.cover_art_url, 'track', track.title)}
                          alt={track.title}
                          onError={(e) => handleImageError(e, track.title, 'track')}
                          className="w-12 h-12 rounded-lg object-cover bg-neutral-800"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-white">{track.title}</h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-neutral-400">
                              {track.isrc || track.id}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400">
                            {track.album_name || 'Single'} · {track.genre} · {track.release_date}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-xs">
                        <div>
                          <span className="text-neutral-400 block">Streams</span>
                          <span className="font-mono font-bold text-white">
                            {Number(track.stream_count || 0).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block">Likes</span>
                          <span className="font-mono font-bold text-white">
                            {Number(track.likes_count || 0).toLocaleString()}
                          </span>
                        </div>
                        <button
                          onClick={() => onPlayTrack(api.mapDbTrack(track))}
                          className="p-2.5 rounded-full bg-white text-black hover:scale-105 transition-transform cursor-pointer"
                          title="Play Track"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: UPLOAD AUDIO / VIDEO / LYRICS */}
      {activeSubTab === 'upload' && (
        <div className="max-w-3xl p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white">Upload New Release</h2>
            <p className="text-xs text-neutral-400">
              Upload your master audio file, cover artwork, optional music video, and synced lyrics.
            </p>
          </div>

          <form onSubmit={handleTrackUpload} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-neutral-300 mb-1">Track Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-300 mb-1">Album / EP / Single Title</label>
                <input
                  type="text"
                  value={albumName}
                  onChange={(e) => setAlbumName(e.target.value)}
                  placeholder="Defaults to Single"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-neutral-300 mb-1">Release Format</label>
                <select
                  value={releaseType}
                  onChange={(e) => setReleaseType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
                >
                  <option value="single">Single</option>
                  <option value="ep">EP</option>
                  <option value="album">Album</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-neutral-300 mb-1">Primary Genre</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
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
                <label className="block font-semibold text-neutral-300 mb-1">ISRC Code (Optional)</label>
                <input
                  type="text"
                  value={isrc}
                  onChange={(e) => setIsrc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-neutral-950 border border-white/10 space-y-1.5">
                <label className="font-bold text-white flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-red-400" />
                  <span>Audio File *</span>
                </label>
                <input
                  type="file"
                  accept=".mp3,.wav,.flac,.m4a,.aac,.ogg,audio/*"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-neutral-300"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-white/10 space-y-1.5">
                <label className="font-bold text-white flex items-center gap-1.5">
                  <Disc className="w-3.5 h-3.5 text-pink-400" />
                  <span>Artwork</span>
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-neutral-300"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-white/10 space-y-1.5">
                <label className="font-bold text-white flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-sky-400" />
                  <span>Video (.mp4)</span>
                </label>
                <input
                  type="file"
                  accept=".mp4,.webm,.mov,video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-neutral-300"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-white/10 space-y-1.5">
                <label className="font-bold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Lyrics (.lrc/.txt)</span>
                </label>
                <input
                  type="file"
                  accept=".lrc,.txt,.srt"
                  onChange={(e) => setLyricsFile(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-neutral-300"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-neutral-300 mb-1">Lyrics Text (Optional)</label>
              <textarea
                rows={4}
                value={lyricsText}
                onChange={(e) => setLyricsText(e.target.value)}
                placeholder="Paste song lyrics or timed [mm:ss.xx] LRC lines..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white font-mono"
              />
            </div>

            {uploading && (
              <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                <div className="h-full bg-red-500 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-2 cursor-pointer"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading ({uploadProgress}%)...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Publish Track</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: ROYALTY SPLIT SHEETS */}
      {activeSubTab === 'splits' && (
        <div className="max-w-3xl p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Royalty Split Sheet</h2>
              <p className="text-xs text-neutral-400">
                Persist collaborator revenue splits directly to the database.
              </p>
            </div>
            {dbTracks.length > 0 && (
              <select
                value={selectedSplitTrackId}
                onChange={(e) => {
                  const tid = e.target.value;
                  setSelectedSplitTrackId(tid);
                  const found = dbSplits.find((s: any) => s.track_id === tid);
                  if (found && Array.isArray(found.members)) {
                    setSplitMembers(found.members);
                  } else {
                    setSplitMembers([
                      {
                        id: 'sm_1',
                        name: displayName,
                        role: 'Primary Artist',
                        percentage: 100,
                        payoutEmail: '',
                      },
                    ]);
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/15 text-xs text-white"
              >
                {dbTracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {dbTracks.length === 0 ? (
            <p className="text-xs text-neutral-500 py-8 text-center">
              Upload a track first to configure collaborator royalty splits.
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {splitMembers.map((member) => (
                  <div
                    key={member.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3.5 rounded-xl bg-neutral-950/70 border border-white/[0.06] items-center text-xs"
                  >
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) =>
                          setSplitMembers((prev) =>
                            prev.map((m) => (m.id === member.id ? { ...m, name: e.target.value } : m))
                          )
                        }
                        placeholder="Collaborator Name"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-white/10 text-white"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <select
                        value={member.role}
                        onChange={(e) =>
                          setSplitMembers((prev) =>
                            prev.map((m) => (m.id === member.id ? { ...m, role: e.target.value as any } : m))
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-white/10 text-white"
                      >
                        <option value="Primary Artist">Primary Artist</option>
                        <option value="Featured Artist">Featured Artist</option>
                        <option value="Producer">Producer</option>
                        <option value="Songwriter">Songwriter</option>
                        <option value="Mix Engineer">Mix Engineer</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="email"
                        value={member.payoutEmail}
                        onChange={(e) =>
                          setSplitMembers((prev) =>
                            prev.map((m) => (m.id === member.id ? { ...m, payoutEmail: e.target.value } : m))
                          )
                        }
                        placeholder="Payout Email"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-white/10 text-white"
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={member.percentage}
                        onChange={(e) =>
                          setSplitMembers((prev) =>
                            prev.map((m) =>
                              m.id === member.id ? { ...m, percentage: Number(e.target.value) } : m
                            )
                          )
                        }
                        className="w-16 px-2 py-1.5 rounded-lg bg-neutral-900 border border-white/10 text-white font-mono text-right"
                      />
                      <span>%</span>
                      {splitMembers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSplitMembers((prev) => prev.filter((m) => m.id !== member.id))}
                          className="text-neutral-500 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setSplitMembers((prev) => [
                      ...prev,
                      {
                        id: `sm_${Date.now()}`,
                        name: '',
                        role: 'Producer',
                        percentage: 0,
                        payoutEmail: '',
                      },
                    ])
                  }
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Collaborator</span>
                </button>

                <div className="flex items-center gap-4">
                  <span
                    className={`text-xs font-mono font-bold ${
                      totalSplitPercentage === 100 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    Total: {totalSplitPercentage}%
                  </span>
                  <button
                    type="button"
                    disabled={totalSplitPercentage !== 100 || savingSplits}
                    onClick={handleSaveSplits}
                    className="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-xs disabled:opacity-40 cursor-pointer"
                  >
                    {savingSplits ? 'Saving...' : 'Save Split Sheet'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 4: PROFILE SETTINGS */}
      {activeSubTab === 'profile' && (
        <div className="max-w-xl p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
          <h2 className="text-lg font-bold text-white">Edit Public Artist Profile</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Artist Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Primary Genre</label>
                <input
                  type="text"
                  value={editGenre}
                  onChange={(e) => setEditGenre(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Country (ISO)</label>
                <input
                  type="text"
                  maxLength={2}
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white uppercase font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Avatar URL</label>
              <input
                type="url"
                value={editAvatar}
                onChange={(e) => setEditAvatar(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
              />
            </div>
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Biography</label>
              <textarea
                rows={4}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{savingProfile ? 'Saving...' : 'Save Artist Profile'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
