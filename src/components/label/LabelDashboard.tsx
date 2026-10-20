import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  Users, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Plus, 
  CheckCircle2, 
  Sparkles, 
  Music,
  RefreshCw,
  Upload,
  Loader2,
  Play,
  X
} from 'lucide-react';
import { LabelArtist, ReleaseScheduleItem, Track } from '../../types/music';
import { api } from '../../services/api';
import { resolveArtworkUrl, handleImageError } from '../../utils/artwork';

interface LabelDashboardProps {
  roster: LabelArtist[];
  upcomingReleases: ReleaseScheduleItem[];
  onSignNewArtist?: (artist: LabelArtist) => void;
  onScheduleRelease?: (release: ReleaseScheduleItem) => void;
}

export const LabelDashboard: React.FC<LabelDashboardProps> = () => {
  const [activeTab, setActiveTab] = useState<'roster' | 'releases' | 'upload'>('roster');
  const [loading, setLoading] = useState(true);
  const [labelInfo, setLabelInfo] = useState<{ id: string; name: string; country: string; status: string } | null>(null);
  const [stats, setStats] = useState<{
    signed_artists_count: number;
    releases_count: number;
    tracks_count: number;
    total_streams: number;
    estimated_royalties_usd: number;
    total_advances_usd: number;
    total_recouped_usd: number;
  } | null>(null);
  const [dbArtists, setDbArtists] = useState<any[]>([]);
  const [dbReleases, setDbReleases] = useState<any[]>([]);
  const [dbTracks, setDbTracks] = useState<any[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sign New Artist Modal State
  const [showSignModal, setShowSignModal] = useState(false);
  const [newArtistName, setNewArtistName] = useState('');
  const [newArtistGenre, setNewArtistGenre] = useState('Afrobeats');
  const [newArtistCountry, setNewArtistCountry] = useState('US');
  const [newArtistAdvance, setNewArtistAdvance] = useState(0);
  const [newArtistBio, setNewArtistBio] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Schedule New Release Modal State
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [relTitle, setRelTitle] = useState('');
  const [relArtistId, setRelArtistId] = useState('');
  const [relType, setRelType] = useState<'single' | 'ep' | 'album'>('single');
  const [relGenre, setRelGenre] = useState('Afrobeats');
  const [relDate, setRelDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [relUpc, setRelUpc] = useState('');

  // Upload Track Form State
  const [trkTitle, setTrkTitle] = useState('');
  const [trkArtistId, setTrkArtistId] = useState('');
  const [trkGenre, setTrkGenre] = useState('Afrobeats');
  const [trkAudioFile, setTrkAudioFile] = useState<File | null>(null);
  const [trkCoverFile, setTrkCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 5000);
  };

  const fetchLabelPortal = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getLabelDashboard();
      if (res && res.status === 'success') {
        setLabelInfo(res.label || null);
        setStats(res.stats || null);
        const artists = res.artists || [];
        setDbArtists(artists);
        setDbReleases(res.releases || []);
        setDbTracks(res.tracks || []);
        if (artists.length > 0 && !relArtistId) {
          setRelArtistId(artists[0].id);
        }
        if (artists.length > 0 && !trkArtistId) {
          setTrkArtistId(artists[0].id);
        }
      }
    } catch (err: any) {
      showMsg('error', err?.message || 'Failed to load label portal data.');
    } finally {
      setLoading(false);
    }
  }, [relArtistId, trkArtistId]);

  useEffect(() => {
    fetchLabelPortal();
  }, [fetchLabelPortal]);

  const handleSignArtistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArtistName.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.createLabelArtist({
        name: newArtistName.trim(),
        primary_genre: newArtistGenre,
        country: newArtistCountry.trim().toUpperCase() || 'US',
        advance_amount: Number(newArtistAdvance) || 0,
        bio: newArtistBio.trim(),
      });
      showMsg('success', res.message || `Signed artist "${newArtistName}" to label roster.`);
      setNewArtistName('');
      setNewArtistAdvance(0);
      setNewArtistBio('');
      setShowSignModal(false);
      fetchLabelPortal();
    } catch (err: any) {
      showMsg('error', err?.message || 'Failed to sign artist.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relTitle.trim() || !relArtistId) return;
    setSubmitting(true);
    try {
      const res = await api.createLabelRelease({
        title: relTitle.trim(),
        artist_id: relArtistId,
        release_type: relType,
        genre: relGenre,
        release_date: relDate,
        upc: relUpc.trim(),
        status: 'published',
      });
      showMsg('success', res.message || `Scheduled release "${relTitle}".`);
      setRelTitle('');
      setRelUpc('');
      setShowReleaseModal(false);
      fetchLabelPortal();
    } catch (err: any) {
      showMsg('error', err?.message || 'Failed to schedule release.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trkTitle.trim() || !trkArtistId || !trkAudioFile) {
      showMsg('error', 'Track title, signed artist, and audio file are required.');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('title', trkTitle.trim());
      formData.append('artist_id', trkArtistId);
      const art = dbArtists.find((a) => a.id === trkArtistId);
      if (art) formData.append('artist_name', art.name);
      if (labelInfo?.id) formData.append('label_id', labelInfo.id);
      if (labelInfo?.name) formData.append('label_name', labelInfo.name);
      formData.append('genre', trkGenre);
      formData.append('audio_file', trkAudioFile);
      if (trkCoverFile) formData.append('cover_file', trkCoverFile);

      const res = await api.uploadReleaseMultipartWithProgress(formData, (pct) => setUploadProgress(pct));
      showMsg('success', res.message || `Uploaded "${trkTitle}".`);
      setTrkTitle('');
      setTrkAudioFile(null);
      setTrkCoverFile(null);
      fetchLabelPortal();
    } catch (err: any) {
      showMsg('error', err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900 to-blue-950/30 border border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-semibold">
            <Building2 className="w-3.5 h-3.5" />
            <span>Record Label Executive Portal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {labelInfo?.name || 'Record Label Operations'}
          </h1>
          <p className="text-sm text-neutral-400 max-w-xl">
            Manage your signed artist roster, release schedules, master audio uploads, and real catalog stream metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchLabelPortal}
            className="px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white text-xs font-semibold border border-white/10 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => setShowSignModal(true)}
            className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-semibold border border-white/10 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Artist to Roster</span>
          </button>
          <button
            onClick={() => setShowReleaseModal(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>Schedule Release</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            notice.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-200'
              : 'bg-red-950/50 border-red-500/30 text-red-200'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Real Database Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Signed Artists</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-white">
            {stats?.signed_artists_count ?? dbArtists.length}
          </div>
          <div className="text-xs text-neutral-400">Active label roster</div>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Total Roster Streams</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-white">
            {(stats?.total_streams ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-emerald-400 font-medium">
            {stats?.tracks_count ?? dbTracks.length} published tracks
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Estimated Catalog Royalties</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-white">
            ${(stats?.estimated_royalties_usd ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-neutral-400">Calculated from verified streams</div>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Catalog Releases</span>
            <Music className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-white">
            {stats?.releases_count ?? dbReleases.length}
          </div>
          <div className="text-xs text-neutral-400">Albums, EPs & Singles</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2">
        {[
          { id: 'roster', label: `Signed Roster (${dbArtists.length})` },
          { id: 'releases', label: `Releases (${dbReleases.length})` },
          { id: 'upload', label: 'Upload Master Track' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === t.id
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-900/60 text-neutral-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'roster' && (
        <div className="space-y-4">
          {dbArtists.length === 0 ? (
            <div className="p-12 rounded-2xl bg-neutral-900/30 border border-white/[0.06] text-center space-y-3">
              <Users className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-sm font-bold text-white">No Artists Signed to Your Label Roster Yet</p>
              <p className="text-xs text-neutral-400">
                Click "Add Artist to Roster" above to register your first signed recording artist.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dbArtists.map((artist) => {
                const advance = Number(artist.advance_amount || 0);
                const recouped = Number(artist.recouped_amount || 0);
                const recoupPercent = advance > 0 ? Math.min(100, Math.round((recouped / advance) * 100)) : 100;

                return (
                  <div
                    key={artist.id}
                    className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.06] space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img
                          src={resolveArtworkUrl(artist.avatar_url, 'artist', artist.name)}
                          alt={artist.name}
                          onError={(e) => handleImageError(e, artist.name, 'artist')}
                          className="w-14 h-14 rounded-full object-cover border border-white/10 shrink-0 bg-neutral-800"
                        />
                        <div className="min-w-0">
                          <h3 className="font-bold text-white text-base truncate">{artist.name}</h3>
                          <p className="text-xs text-neutral-400">
                            {artist.catalog_count || 0} tracks · {Number(artist.total_streams || 0).toLocaleString()} streams
                          </p>
                        </div>
                      </div>

                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-blue-500/15 text-blue-300 border-blue-500/30">
                        {artist.roster_status || 'Signed'}
                      </span>
                    </div>

                    {advance > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400">Advance Recoupment</span>
                          <span className="font-mono text-neutral-200">
                            ${recouped.toLocaleString()} / ${advance.toLocaleString()} ({recoupPercent}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${recoupPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'releases' && (
        <div className="space-y-4">
          {dbReleases.length === 0 ? (
            <div className="p-12 rounded-2xl bg-neutral-900/30 border border-white/[0.06] text-center space-y-2">
              <Calendar className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-sm font-bold text-white">No Releases Scheduled Yet</p>
              <p className="text-xs text-neutral-400">
                Click "Schedule Release" above to add an Album, EP, or Single for your signed artists.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dbReleases.map((rel) => (
                <div key={rel.id} className="p-4 rounded-2xl bg-neutral-900/40 border border-white/[0.06] flex gap-3.5">
                  <img
                    src={resolveArtworkUrl(rel.cover_art_url, 'album', rel.title)}
                    alt={rel.title}
                    onError={(e) => handleImageError(e, rel.title, 'album')}
                    className="w-16 h-16 rounded-xl object-cover shrink-0 bg-neutral-800"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/10 text-neutral-300">
                      {rel.release_type || 'Album'} · {rel.status}
                    </span>
                    <h4 className="font-bold text-sm text-white truncate">{rel.title}</h4>
                    <p className="text-xs text-neutral-400 truncate">{rel.artist_name}</p>
                    <p className="text-[11px] font-mono text-neutral-500">
                      {rel.release_date} {rel.upc ? `· UPC: ${rel.upc}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] max-w-2xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-400" />
            <span>Upload Master Audio for Signed Artist</span>
          </h3>
          {dbArtists.length === 0 ? (
            <p className="text-xs text-neutral-400">
              Please add an artist to your roster first before uploading tracks.
            </p>
          ) : (
            <form onSubmit={handleUploadTrack} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Track Title *</label>
                <input
                  type="text"
                  required
                  value={trkTitle}
                  onChange={(e) => setTrkTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Signed Artist *</label>
                  <select
                    value={trkArtistId}
                    onChange={(e) => setTrkArtistId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
                  >
                    {dbArtists.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Genre</label>
                  <select
                    value={trkGenre}
                    onChange={(e) => setTrkGenre(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
                  >
                    <option value="Afrobeats">Afrobeats</option>
                    <option value="Pop">Pop</option>
                    <option value="Rap">Rap & Hip-Hop</option>
                    <option value="R&B">R&B & Soul</option>
                    <option value="Electronic">Electronic</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-neutral-950 border border-white/10 space-y-1.5">
                  <label className="font-bold text-white block">Master Audio File *</label>
                  <input
                    type="file"
                    required
                    accept=".mp3,.wav,.flac,.m4a,audio/*"
                    onChange={(e) => setTrkAudioFile(e.target.files?.[0] || null)}
                    className="w-full text-[11px] text-neutral-300"
                  />
                </div>
                <div className="p-3 rounded-xl bg-neutral-950 border border-white/10 space-y-1.5">
                  <label className="font-bold text-white block">Cover Artwork (Optional)</label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/*"
                    onChange={(e) => setTrkCoverFile(e.target.files?.[0] || null)}
                    className="w-full text-[11px] text-neutral-300"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading ({uploadProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload Track to Label Catalog</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Modal: Sign New Artist */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Add Artist to Label Roster</h3>
              <button onClick={() => setShowSignModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSignArtistSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-400 mb-1">Artist Stage Name *</label>
                <input
                  type="text"
                  required
                  value={newArtistName}
                  onChange={(e) => setNewArtistName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Primary Genre</label>
                  <input
                    type="text"
                    value={newArtistGenre}
                    onChange={(e) => setNewArtistGenre(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Country (ISO)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={newArtistCountry}
                    onChange={(e) => setNewArtistCountry(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white uppercase font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Advance Amount (USD)</label>
                <input
                  type="number"
                  min={0}
                  value={newArtistAdvance}
                  onChange={(e) => setNewArtistAdvance(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Biography</label>
                <textarea
                  rows={3}
                  value={newArtistBio}
                  onChange={(e) => setNewArtistBio(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
              >
                {submitting ? 'Saving...' : 'Confirm Artist Signing'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Schedule New Release */}
      {showReleaseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Schedule Label Release</h3>
              <button onClick={() => setShowReleaseModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateReleaseSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-400 mb-1">Release Title *</label>
                <input
                  type="text"
                  required
                  value={relTitle}
                  onChange={(e) => setRelTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Signed Artist *</label>
                <select
                  value={relArtistId}
                  onChange={(e) => setRelArtistId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                >
                  {dbArtists.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Format</label>
                  <select
                    value={relType}
                    onChange={(e) => setRelType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                  >
                    <option value="single">Single</option>
                    <option value="ep">EP</option>
                    <option value="album">Album</option>
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Release Date</label>
                  <input
                    type="date"
                    value={relDate}
                    onChange={(e) => setRelDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">UPC Barcode (Optional)</label>
                <input
                  type="text"
                  value={relUpc}
                  onChange={(e) => setRelUpc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
              >
                {submitting ? 'Scheduling...' : 'Create Release'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
