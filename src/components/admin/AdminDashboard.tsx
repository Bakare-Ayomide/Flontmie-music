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
  Star 
} from 'lucide-react';
import { 
  Track, 
  ArtistProfile, 
  LabelArtist, 
  AdminRolePermission 
} from '../../types/music';

interface AdminDashboardProps {
  tracks: Track[];
  onToggleTrackFeatured: (trackId: string) => void;
  onUpdateTrackStatus: (trackId: string, status: 'active' | 'review' | 'flagged') => void;
  onDeleteTrack: (trackId: string) => void;
  permissions: AdminRolePermission[];
  onUpdatePermission: (updated: AdminRolePermission) => void;
  labelArtists: LabelArtist[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  tracks,
  onToggleTrackFeatured,
  onUpdateTrackStatus,
  onDeleteTrack,
  permissions,
  onUpdatePermission,
  labelArtists,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'roles' | 'catalog' | 'entities'>('overview');
  const [selectedRoleToEdit, setSelectedRoleToEdit] = useState<AdminRolePermission>(permissions[0]);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  const totalStreams = tracks.reduce((acc, t) => acc + t.streams, 0);
  const totalRevenue = totalStreams * 0.0042; // Platform master pool

  const handleSavePermission = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePermission(selectedRoleToEdit);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2000);
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
                        {t.streams.toLocaleString()}
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
                      <p className="text-[10px] text-neutral-400">{la.catalogCount} tracks · ${la.monthlyRevenue.toLocaleString()}/mo</p>
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
    </div>
  );
};
