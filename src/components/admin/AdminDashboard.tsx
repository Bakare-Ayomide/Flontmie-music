import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Music, 
  Building2, 
  Network, 
  TrendingUp, 
  DollarSign, 
  Settings, 
  Check, 
  X, 
  Sparkles, 
  AlertTriangle, 
  Sliders, 
  CheckCircle2, 
  Star,
  Search,
  Download,
  Youtube,
  Play,
  Loader2,
  ExternalLink,
  Radio
} from 'lucide-react';
import { 
  Track, 
  ArtistProfile, 
  LabelArtist, 
  AdminRolePermission 
} from '../../types/music';
import { api } from '../../services/api';

interface AdminDashboardProps {
  tracks: Track[];
  onToggleTrackFeatured: (trackId: string) => void;
  onUpdateTrackStatus: (trackId: string, status: 'active' | 'review' | 'flagged') => void;
  onDeleteTrack: (trackId: string) => void;
  permissions: AdminRolePermission[];
  onUpdatePermission: (updated: AdminRolePermission) => void;
  labelArtists: LabelArtist[];
  onTrackImported?: (track: Track) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  tracks,
  onToggleTrackFeatured,
  onUpdateTrackStatus,
  onDeleteTrack,
  permissions,
  onUpdatePermission,
  labelArtists,
  onTrackImported,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'roles' | 'catalog' | 'entities' | 'importer'>('overview');
  const [selectedRoleToEdit, setSelectedRoleToEdit] = useState<AdminRolePermission>(permissions[0]);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // YouTube / Public Music Importer state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);

  // Manual import form
  const [manualTitle, setManualTitle] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [manualAlbum, setManualAlbum] = useState('');
  const [manualGenre, setManualGenre] = useState('Afrobeats');
  const [manualAudioUrl, setManualAudioUrl] = useState('');
  const [manualCoverUrl, setManualCoverUrl] = useState('');
  const [manualYoutubeUrl, setManualYoutubeUrl] = useState('');
  const [isManualImporting, setIsManualImporting] = useState(false);

  const totalStreams = tracks.reduce((acc, t) => acc + t.streams, 0);
  const totalRevenue = totalStreams * 0.0042; // Platform master pool

  const handleSavePermission = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePermission(selectedRoleToEdit);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2000);
  };

  const handleSearchMusic = async (queryToSearch?: string) => {
    const q = queryToSearch !== undefined ? queryToSearch : searchQuery;
    if (!q.trim()) return;
    setIsSearching(true);
    setImportNotice(null);
    try {
      const res = await api.searchPublicMusic(q);
      if (res && res.results) {
        setSearchResults(res.results);
      }
    } catch (err: any) {
      setImportNotice(`Search error: ${err.message || 'Failed to search'}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportTrack = async (item: any) => {
    setImportingId(item.source_id);
    setImportNotice(null);
    try {
      const res = await api.importPublicTrack({
        title: item.title,
        artist: item.artist,
        album: item.album,
        genre: item.genre,
        duration: item.duration,
        cover_url: item.cover_url,
        audio_url: item.audio_url,
        release_date: item.release_date
      });
      if (res && res.status === 'success') {
        setImportedIds(prev => [...prev, item.source_id]);
        setImportNotice(`✓ "${item.title}" by ${item.artist} successfully imported to MySQL!`);
        if (onTrackImported && res.track) {
          onTrackImported(res.track);
        }
      }
    } catch (err: any) {
      setImportNotice(`Import error: ${err.message || 'Failed to import'}`);
    } finally {
      setImportingId(null);
    }
  };

  const handleManualImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualArtist.trim()) {
      setImportNotice('Please provide at least a track title and artist name');
      return;
    }
    setIsManualImporting(true);
    setImportNotice(null);
    try {
      const res = await api.importPublicTrack({
        title: manualTitle,
        artist: manualArtist,
        album: manualAlbum || `${manualTitle} - Single`,
        genre: manualGenre,
        cover_url: manualCoverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
        audio_url: manualAudioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        release_date: new Date().toISOString().split('T')[0]
      });
      if (res && res.status === 'success') {
        setImportNotice(`✓ Successfully imported "${manualTitle}" by ${manualArtist} into MySQL!`);
        setManualTitle('');
        setManualArtist('');
        setManualAlbum('');
        setManualAudioUrl('');
        setManualCoverUrl('');
        setManualYoutubeUrl('');
        if (onTrackImported && res.track) {
          onTrackImported(res.track);
        }
      }
    } catch (err: any) {
      setImportNotice(`Manual import failed: ${err.message || 'Error occurred'}`);
    } finally {
      setIsManualImporting(false);
    }
  };

  return (
    <div className="space-y-8 pb-28 animate-in fade-in duration-200">
      {/* Admin Header */}
      <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/20 border border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-xl shadow-amber-500/10">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Flontmie Owner Console
              </span>
              <span aria-hidden="true" className="text-neutral-500">·</span>
              <span className="text-xs text-neutral-400">Master Hub Administration</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
              Platform Governance & Control Hub
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-xl">
              Manage all users, songs, artists, record labels, partner distributors, and enforce role-based access rules across Flontmie
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold">
            Root Authority: Active
          </span>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Platform Total Streams</span>
            <TrendingUp className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-white">
            {(totalStreams / 1000000).toFixed(1)}M
          </p>
          <div className="text-[11px] text-emerald-400 font-mono">+28.4% this month</div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Platform Gross Pool</span>
            <DollarSign className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            ${Math.round(totalRevenue).toLocaleString()}
          </p>
          <div className="text-[11px] text-neutral-400 font-mono">Gross streaming pool</div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Active Song Catalog</span>
            <Music className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-white">
            {tracks.length} Songs Live
          </p>
          <div className="text-[11px] text-neutral-400">Across 8 genres & dayparts</div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Governed Entities</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-white">
            4 Roles Managed
          </p>
          <div className="text-[11px] text-neutral-400">Artists, Labels, Distributors, Users</div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'overview' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Master Platform Overview
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'roles' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Role & Access Governance Matrix
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'catalog' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Catalog & Song Listings ({tracks.length})
        </button>
        <button
          onClick={() => setActiveTab('entities')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'entities' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Artists, Labels & Partner Distributors
        </button>

        <button
          onClick={() => setActiveTab('importer')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'importer' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Youtube className="w-3.5 h-3.5 text-red-400" />
          <span>YouTube & Music Importer</span>
        </button>
      </div>

      {/* TAB 1: Master Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Platform Health & Ingestion Pipeline</span>
            </h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex justify-between items-center">
                <span>Flontmie Audio Server Cluster</span>
                <span className="text-emerald-400 font-semibold font-mono">Operational · 99.99%</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex justify-between items-center">
                <span>Distributor Gateway Ingestion Rate</span>
                <span className="font-mono text-white">420 batches / day</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex justify-between items-center">
                <span>Real-Time Web Audio Node Health</span>
                <span className="text-emerald-400 font-semibold font-mono">Normal (Low Jitter)</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex justify-between items-center">
                <span>Automated Content Verification Policy</span>
                <span className="text-amber-400 font-semibold">Strict Fingerprint QA</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white">Distributor Source Market Share on Flontmie</h3>
            <div className="space-y-3 text-xs">
              {[
                { name: 'TuneCore Direct on Flontmie', pct: 45, count: '5,580 songs' },
                { name: 'CDBaby Gateway on Flontmie', pct: 32, count: '3,968 songs' },
                { name: 'Ditto Music Hub on Flontmie', pct: 18, count: '2,232 songs' },
                { name: 'Direct Label Ingest', pct: 5, count: '620 songs' },
              ].map((d) => (
                <div key={d.name} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-neutral-300">{d.name}</span>
                    <span className="font-mono text-neutral-400">{d.count} ({d.pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Role & Access Governance Matrix */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Role Governance Matrix</h3>
                <p className="text-xs text-neutral-400">
                  Control what Artists, Labels, Distributors, and Listeners can do and access on Flontmie
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.02] text-neutral-400 uppercase tracking-wider text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">Role Entity</th>
                    <th className="py-3 px-4 text-center">Direct Upload</th>
                    <th className="py-3 px-4 text-center">Edit Live Metadata</th>
                    <th className="py-3 px-4 text-center">Manage Roster</th>
                    <th className="py-3 px-4 text-center">Feature on Home</th>
                    <th className="py-3 px-4 text-center">Max Uploads / Mo</th>
                    <th className="py-3 px-4 text-right">Configure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {permissions.map((p) => (
                    <tr key={p.role} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-white block">{p.name}</span>
                        <span className="text-[11px] text-neutral-400">{p.description}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold">
                        {p.canDirectUpload ? <span className="text-emerald-400">✓ Yes</span> : <span className="text-neutral-500">✗ No</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold">
                        {p.canEditLiveMetadata ? <span className="text-emerald-400">✓ Yes</span> : <span className="text-neutral-500">✗ No</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold">
                        {p.canManageRoster ? <span className="text-emerald-400">✓ Yes</span> : <span className="text-neutral-500">✗ No</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold">
                        {p.canFeatureOnHome ? <span className="text-emerald-400">✓ Yes</span> : <span className="text-neutral-500">✗ No</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-white">
                        {p.maxUploadPerMonth > 0 ? p.maxUploadPerMonth : 'None'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedRoleToEdit(p)}
                          className="px-3 py-1 bg-white/[0.08] hover:bg-white/[0.14] text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Edit Permissions
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role Editor Modal/Panel */}
          <div className="max-w-xl p-6 rounded-2xl bg-neutral-900/50 border border-white/[0.08] space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Edit Role Policy: <span className="text-amber-400">{selectedRoleToEdit.name}</span>
                </h4>
                <p className="text-xs text-neutral-400">Adjust permissions and access restrictions</p>
              </div>
            </div>

            {saveSuccessNotice && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Permissions updated live across the platform!</span>
              </div>
            )}

            <form onSubmit={handleSavePermission} className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-neutral-300 font-medium">Allow Direct Song & Album Uploading</span>
                  <input
                    type="checkbox"
                    checked={selectedRoleToEdit.canDirectUpload}
                    onChange={(e) =>
                      setSelectedRoleToEdit({ ...selectedRoleToEdit, canDirectUpload: e.target.checked })
                    }
                    className="accent-amber-500 w-4 h-4 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-neutral-300 font-medium">Allow Editing Live Song Metadata on Flontmie</span>
                  <input
                    type="checkbox"
                    checked={selectedRoleToEdit.canEditLiveMetadata}
                    onChange={(e) =>
                      setSelectedRoleToEdit({ ...selectedRoleToEdit, canEditLiveMetadata: e.target.checked })
                    }
                    className="accent-amber-500 w-4 h-4 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-neutral-300 font-medium">Authority to Feature Songs on Home Page Carousels</span>
                  <input
                    type="checkbox"
                    checked={selectedRoleToEdit.canFeatureOnHome}
                    onChange={(e) =>
                      setSelectedRoleToEdit({ ...selectedRoleToEdit, canFeatureOnHome: e.target.checked })
                    }
                    className="accent-amber-500 w-4 h-4 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-neutral-300 font-medium">Manage Multi-Artist Roster & Advances</span>
                  <input
                    type="checkbox"
                    checked={selectedRoleToEdit.canManageRoster}
                    onChange={(e) =>
                      setSelectedRoleToEdit({ ...selectedRoleToEdit, canManageRoster: e.target.checked })
                    }
                    className="accent-amber-500 w-4 h-4 rounded"
                  />
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-300 font-medium">Max Monthly Catalog Ingestions Allowed</label>
                <input
                  type="number"
                  value={selectedRoleToEdit.maxUploadPerMonth}
                  onChange={(e) =>
                    setSelectedRoleToEdit({ ...selectedRoleToEdit, maxUploadPerMonth: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-xs transition-colors shadow-lg shadow-amber-500/20"
              >
                Save Role Policy Restrictions
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: Master Catalog Management */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Full Song & Album Registry on Flontmie</h3>
                <p className="text-xs text-neutral-400">Control home page carousel placement, QA status, and stream listings</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.02] text-neutral-400 uppercase tracking-wider text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">Song Title & Artist</th>
                    <th className="py-3 px-4">Genre</th>
                    <th className="py-3 px-4">Distributor Source</th>
                    <th className="py-3 px-4 text-right">Streams</th>
                    <th className="py-3 px-4 text-center">Featured on Home</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {tracks.map((t) => (
                    <tr key={t.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img src={t.coverUrl} alt={t.title} referrerPolicy="no-referrer" className="w-8 h-8 rounded-lg object-cover" />
                          <div>
                            <span className="font-semibold text-white block">{t.title}</span>
                            <span className="text-[11px] text-neutral-400">{t.artist}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 capitalize text-neutral-300">{t.genre}</td>
                      <td className="py-3 px-4 text-neutral-400">{t.distributor}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-white">
                        {(Number(t.streams) || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onToggleTrackFeatured(t.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            t.featuredOnHome ? 'text-amber-400 bg-amber-500/10' : 'text-neutral-500 hover:text-white'
                          }`}
                          title="Toggle Featured on Home carousels"
                        >
                          <Star className={`w-4 h-4 ${t.featuredOnHome ? 'fill-amber-400' : ''}`} />
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <select
                          value={t.status || 'active'}
                          onChange={(e) => onUpdateTrackStatus(t.id, e.target.value as any)}
                          className={`px-2 py-1 rounded bg-neutral-900 border border-white/10 text-xs font-semibold ${
                            t.status === 'flagged' ? 'text-red-400' : t.status === 'review' ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="review">In Review</option>
                          <option value="flagged">Flagged</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onDeleteTrack(t.id)}
                          className="text-neutral-500 hover:text-red-400 px-2 py-1"
                        >
                          Unpublish
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Artists, Labels & Distributors Management */}
      {activeTab === 'entities' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Registered Record Labels</span>
            </h3>
            <div className="space-y-3 text-xs">
              {labelArtists.map((la) => (
                <div key={la.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img src={la.avatarUrl} alt={la.name} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <p className="font-semibold text-white">{la.name}</p>
                      <p className="text-[10px] text-neutral-400">{la.catalogCount} tracks · ${(Number(la.monthlyRevenue) || 0).toLocaleString()}/mo</p>
                    </div>
                  </div>
                  <span className="text-emerald-400 font-semibold font-mono">Approved</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Network className="w-4 h-4 text-purple-400" />
              <span>Certified Partner Distributors</span>
            </h3>
            <div className="space-y-3 text-xs">
              {[
                { name: 'TuneCore Direct on Flontmie', status: 'Live & Integrated', quota: 'Unlimited DDEX' },
                { name: 'CDBaby Gateway on Flontmie', status: 'Live & Integrated', quota: 'Unlimited DDEX' },
                { name: 'Ditto Music Hub on Flontmie', status: 'Live & Integrated', quota: 'Unlimited DDEX' },
                { name: 'DistroKid Direct on Flontmie', status: 'Active Ingestion Node', quota: 'Unlimited DDEX' },
              ].map((p, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{p.name}</p>
                    <p className="text-[10px] text-neutral-400">{p.quota}</p>
                  </div>
                  <span className="text-emerald-400 font-semibold font-mono">{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: YouTube & Public Music Importer */}
      {activeTab === 'importer' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-red-950/40 via-neutral-900 to-neutral-900 border border-red-500/20 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
                <Youtube className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>YouTube & Public Music Catalog Ingestion</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/20 text-red-400 border border-red-500/30">
                    Live MySQL Importer
                  </span>
                </h3>
                <p className="text-xs text-neutral-400">
                  Search and import tracks, artists, albums, and playlists from YouTube and public audio sources directly into your production MySQL database.
                </p>
              </div>
            </div>

            {/* Quick Trending Discovery Presets */}
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-neutral-400 font-medium">Quick Discovery:</span>
              {[
                'Burna Boy',
                'Rema Calm Down',
                'Asake Lonely At The Top',
                'Wizkid Essence',
                'Amapiano Groove',
                'Afrobeats Sunset',
                'Lo-Fi Study Chill',
                'Synthwave Neon'
              ].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setSearchQuery(term);
                    handleSearchMusic(term);
                  }}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-white/[0.05] hover:bg-red-500/20 hover:text-red-300 border border-white/[0.08] hover:border-red-500/30 text-neutral-300 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback notice */}
          {importNotice && (
            <div className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
              importNotice.startsWith('✓') 
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300' 
                : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
            }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{importNotice}</span>
              </div>
              <button 
                onClick={() => setImportNotice(null)} 
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Search bar */}
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/[0.08] flex items-center gap-3">
            <Search className="w-5 h-5 text-neutral-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchMusic()}
              placeholder="Search by artist name, YouTube track title, or public playlist (e.g. Asake, Rema, Burna Boy, Lo-Fi)..."
              className="bg-transparent text-sm text-white focus:outline-none flex-1 placeholder:text-neutral-500"
            />
            <button
              onClick={() => handleSearchMusic()}
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>{isSearching ? 'Searching...' : 'Search Music'}</span>
            </button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Discovered Music ({searchResults.length} tracks found)
                </h4>
                <span className="text-[11px] text-neutral-400">
                  Click 'Import to MySQL' to permanently register in the live catalog
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.map((item) => {
                  const isImported = importedIds.includes(item.source_id);
                  const isImporting = importingId === item.source_id;

                  return (
                    <div
                      key={item.source_id}
                      className="p-3.5 rounded-xl bg-neutral-900/40 border border-white/[0.06] hover:border-white/[0.12] transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.cover_url}
                          alt={item.title}
                          className="w-14 h-14 rounded-lg object-cover shrink-0 border border-white/[0.08]"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                          <p className="text-xs text-neutral-400 truncate">{item.artist}</p>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                            <span>{item.genre}</span>
                            <span>•</span>
                            <span>{Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}</span>
                            {item.youtube_search_url && (
                              <>
                                <span>•</span>
                                <a
                                  href={item.youtube_search_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-red-400 hover:text-red-300 flex items-center gap-0.5"
                                >
                                  <span>YouTube</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.audio_url && (
                          <button
                            type="button"
                            onClick={() => {
                              if (previewAudioUrl === item.audio_url) {
                                setPreviewAudioUrl(null);
                              } else {
                                setPreviewAudioUrl(item.audio_url);
                              }
                            }}
                            className={`p-2 rounded-lg border text-xs transition-colors ${
                              previewAudioUrl === item.audio_url
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-white/[0.04] text-neutral-300 border-white/[0.08] hover:bg-white/[0.08]'
                            }`}
                            title="Preview Audio"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isImported || isImporting}
                          onClick={() => handleImportTrack(item)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                            isImported
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-white text-black hover:bg-neutral-200'
                          }`}
                        >
                          {isImporting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isImported ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>{isImported ? 'Imported' : isImporting ? 'Saving...' : 'Import to MySQL'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audio Preview Element if Active */}
          {previewAudioUrl && (
            <div className="p-3 rounded-xl bg-neutral-900 border border-amber-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-amber-300">
                <Radio className="w-4 h-4 animate-pulse text-amber-400" />
                <span>Audio Preview Playing</span>
              </div>
              <audio src={previewAudioUrl} autoPlay controls className="h-8 max-w-sm" />
              <button
                onClick={() => setPreviewAudioUrl(null)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Close
              </button>
            </div>
          )}

          {/* Manual YouTube / Public Content Ingestion Form */}
          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-red-400" />
                  <span>Direct YouTube Music / Content Form</span>
                </h4>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Input custom song titles, artist profiles, cover art URLs, and stream links to register instantly in the production MySQL database
                </p>
              </div>
            </div>

            <form onSubmit={handleManualImport} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs text-neutral-300 font-medium">Song Title *</label>
                <input
                  type="text"
                  required
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="e.g. Higher Vibration (Acoustic)"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-800/80 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-300 font-medium">Artist Name *</label>
                <input
                  type="text"
                  required
                  value={manualArtist}
                  onChange={(e) => setManualArtist(e.target.value)}
                  placeholder="e.g. Burna Boy / Asake / Tyla"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-800/80 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-300 font-medium">Album or Release Name</label>
                <input
                  type="text"
                  value={manualAlbum}
                  onChange={(e) => setManualAlbum(e.target.value)}
                  placeholder="e.g. I Told Them... or Single"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-800/80 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-300 font-medium">Genre</label>
                <select
                  value={manualGenre}
                  onChange={(e) => setManualGenre(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-800/80 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-red-500"
                >
                  {['Afrobeats', 'Pop', 'Hip-Hop', 'Amapiano', 'R&B', 'Electronic', 'Lo-Fi', 'Reggae', 'Gospel'].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-300 font-medium">Cover Art Image URL</label>
                <input
                  type="url"
                  value={manualCoverUrl}
                  onChange={(e) => setManualCoverUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or direct image link"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-800/80 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-300 font-medium">Audio Stream / MP3 URL</label>
                <input
                  type="url"
                  value={manualAudioUrl}
                  onChange={(e) => setManualAudioUrl(e.target.value)}
                  placeholder="https://... direct audio URL or SoundHelix test URL"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-800/80 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="md:col-span-2 pt-2 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={isManualImporting}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-red-600/20"
                >
                  {isManualImporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isManualImporting ? 'Writing to MySQL...' : 'Save & Import to MySQL Catalog'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
