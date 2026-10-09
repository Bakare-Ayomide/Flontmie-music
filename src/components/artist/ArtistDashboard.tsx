import React, { useState } from 'react';
import { 
  Mic2, 
  TrendingUp, 
  Users, 
  DollarSign, 
  ListMusic, 
  Plus, 
  Upload, 
  Check, 
  Calendar, 
  Globe, 
  Percent, 
  Sparkles, 
  FileText 
} from 'lucide-react';
import { Track, ArtistProfile, SplitSheet, SplitMember, MusicGenre } from '../../types/music';

interface ArtistDashboardProps {
  artistProfile: ArtistProfile;
  tracks: Track[];
  onAddNewTrack: (newTrack: Partial<Track>) => void;
}

export const ArtistDashboard: React.FC<ArtistDashboardProps> = ({
  artistProfile,
  tracks,
  onAddNewTrack,
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'splits' | 'catalog'>('analytics');
  const [isNewReleaseModalOpen, setIsNewReleaseModalOpen] = useState(false);
  
  // New Release Form State
  const [newTitle, setNewTitle] = useState('');
  const [newGenre, setNewGenre] = useState<MusicGenre>('synthwave');
  const [newBpm, setNewBpm] = useState(120);
  const [newDuration, setNewDuration] = useState(195);
  const [newIsExplicit, setNewIsExplicit] = useState(false);
  const [releaseSuccessMessage, setReleaseSuccessMessage] = useState(false);

  // Split Sheets State
  const [selectedSplitTrackId, setSelectedSplitTrackId] = useState(artistProfile.splitSheets?.[0]?.trackId || 'track-1');
  const [collaborators, setCollaborators] = useState<SplitMember[]>(
    artistProfile.splitSheets?.[0]?.members || []
  );
  const [newCollabName, setNewCollabName] = useState('');
  const [newCollabRole, setNewCollabRole] = useState<SplitMember['role']>('Producer');
  const [newCollabPercent, setNewCollabPercent] = useState<number>(10);
  const [newCollabEmail, setNewCollabEmail] = useState('');

  const artistTracks = tracks.filter((t) => t.artistId === artistProfile.id || t.artist === artistProfile.name);

  const totalArtistStreams = artistTracks.reduce((acc, t) => acc + t.streams, 0);
  const estimatedRoyaltyUsd = totalArtistStreams * 0.0038; // standard stream royalty multiplier

  const handleAddCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollabName.trim() || newCollabPercent <= 0) return;

    const newMember: SplitMember = {
      id: `m-${Date.now()}`,
      name: newCollabName.trim(),
      role: newCollabRole,
      percentage: Number(newCollabPercent),
      payoutEmail: newCollabEmail.trim() || `${newCollabName.toLowerCase().replace(/\s+/g, '')}@payouts.io`,
    };

    setCollaborators([...collaborators, newMember]);
    setNewCollabName('');
    setNewCollabPercent(10);
    setNewCollabEmail('');
  };

  const handleRemoveCollaborator = (id: string) => {
    setCollaborators(collaborators.filter((c) => c.id !== id));
  };

  const totalSplitPercent = collaborators.reduce((acc, c) => acc + c.percentage, 0);

  const handleCreateRelease = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const trackObj: Partial<Track> = {
      title: newTitle.trim(),
      artist: artistProfile.name,
      artistId: artistProfile.id,
      album: 'Neon Horizon (Expanded)',
      duration: Number(newDuration),
      genre: newGenre,
      bpm: Number(newBpm),
      moods: ['energize'],
      streams: 0,
      likes: 1,
      isExplicit: newIsExplicit,
      releaseDate: new Date().toISOString().split('T')[0],
      isrc: `US-FLN-26-${Math.floor(10000 + Math.random() * 90000)}`,
      upc: `840192837${Math.floor(100 + Math.random() * 900)}`,
      label: artistProfile.label,
      distributor: 'TuneCore Direct on Flontmie',
    };

    onAddNewTrack(trackObj);
    setReleaseSuccessMessage(true);
    setTimeout(() => {
      setReleaseSuccessMessage(false);
      setIsNewReleaseModalOpen(false);
      setNewTitle('');
    }, 1500);
  };

  return (
    <div className="space-y-8 pb-28 animate-in fade-in duration-200">
      {/* Header Profile Bar */}
      <div className="p-6 md:p-8 rounded-2xl bg-neutral-900/60 border border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-red-500/50 shadow-xl">
            <img
              src={artistProfile.avatarUrl}
              alt={artistProfile.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                Artist Studio
              </span>
              <span aria-hidden="true" className="text-neutral-500">·</span>
              <span className="text-xs text-neutral-400">{artistProfile.label}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
              {artistProfile.name}
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-xl">
              {artistProfile.bio}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNewReleaseModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Upload className="w-4 h-4" />
            <span>Drop New Release</span>
          </button>
        </div>
      </div>

      {/* High-Level Metric Tiles (Tabular Figures) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Monthly Listeners</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-white">
            {artistProfile.monthlyListeners.toLocaleString()}
          </p>
          <div className="text-[11px] text-emerald-400 font-mono tabular-nums">
            +14.2% from last 30 days
          </div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Lifetime Streams</span>
            <TrendingUp className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-white">
            {totalArtistStreams.toLocaleString()}
          </p>
          <div className="text-[11px] text-neutral-400">Across 220 countries</div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Estimated Master Net</span>
            <DollarSign className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            ${Math.round(estimatedRoyaltyUsd).toLocaleString()}
          </p>
          <div className="text-[11px] text-neutral-400 font-mono">Rate: $0.0038 / stream</div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Curated Playlist Adds</span>
            <ListMusic className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-white">
            1,420
          </p>
          <div className="text-[11px] text-neutral-400">Including 8 Editorial Frontpages</div>
        </div>
      </div>

      {/* Section Tabs (Segmented functional controls) */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'analytics'
              ? 'bg-white text-black shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Track Analytics
        </button>
        <button
          onClick={() => setActiveTab('splits')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'splits'
              ? 'bg-white text-black shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Collaborator Split Sheets
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'catalog'
              ? 'bg-white text-black shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Metadata & ISRC Registry
        </button>
      </div>

      {/* Tab 1: Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Catalog Performance</h3>
                <p className="text-xs text-neutral-400">Individual track conversion & save rates</p>
              </div>
              <span className="text-xs text-neutral-500 font-mono">Updated 10m ago</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.02] text-neutral-400 uppercase tracking-wider text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">Track Title</th>
                    <th className="py-3 px-4">ISRC Code</th>
                    <th className="py-3 px-4 text-right">Streams</th>
                    <th className="py-3 px-4 text-right">Save Rate</th>
                    <th className="py-3 px-4 text-right">Playlist Adds</th>
                    <th className="py-3 px-4 text-right">Est. Earnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {artistTracks.map((t) => (
                    <tr key={t.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={t.coverUrl}
                            alt={t.title}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded object-cover"
                          />
                          <span className="font-semibold text-white truncate max-w-xs">{t.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-400">{t.isrc}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-white">
                        {t.streams.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400">
                        {((t.likes / (t.streams || 1)) * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-300">
                        {Math.floor(t.streams / 3200).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-white font-medium">
                        ${Math.round(t.streams * 0.0038).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Audience Geographies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-neutral-900/30 border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">Top Geographic Markets</h4>
                <Globe className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="space-y-2.5">
                {[
                  { country: 'United States', listeners: '682,000', share: 37 },
                  { country: 'Germany', listeners: '312,000', share: 17 },
                  { country: 'United Kingdom', listeners: '240,000', share: 13 },
                  { country: 'Japan', listeners: '185,000', share: 10 },
                  { country: 'Brazil', listeners: '142,000', share: 8 },
                ].map((c) => (
                  <div key={c.country} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300">{c.country}</span>
                      <span className="font-mono tabular-nums text-neutral-400">{c.listeners} ({c.share}%)</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${c.share}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-neutral-900/30 border border-white/[0.08] space-y-3">
              <h4 className="text-sm font-bold text-white">Active Discovery Sources</h4>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-neutral-300">Algorithmic Radios & Next Up</span>
                  <span className="font-mono tabular-nums font-semibold text-white">48.2%</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-neutral-300">Editorial Frontpage Playlists</span>
                  <span className="font-mono tabular-nums font-semibold text-white">28.5%</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-neutral-300">Listener Personal Libraries</span>
                  <span className="font-mono tabular-nums font-semibold text-white">16.1%</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-neutral-300">Social Jams & Shared Links</span>
                  <span className="font-mono tabular-nums font-semibold text-white">7.2%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Split Sheets Builder */}
      {activeTab === 'splits' && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-neutral-900/40 border border-white/[0.08] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Automated Royalty Split Sheets</h3>
                <p className="text-xs text-neutral-400">
                  Configure real-time gross revenue distribution for primary artists, producers, and writers
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400">Select Track:</span>
                <select
                  value={selectedSplitTrackId}
                  onChange={(e) => setSelectedSplitTrackId(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-neutral-800 border border-white/10 rounded-lg text-white focus:outline-none"
                >
                  {artistTracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Split Members List */}
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider px-2">
                <div className="col-span-4">Collaborator Name</div>
                <div className="col-span-3">Role</div>
                <div className="col-span-3">Payout Destination</div>
                <div className="col-span-2 text-right">Split %</div>
              </div>

              {collaborators.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-12 gap-3 items-center p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs"
                >
                  <div className="col-span-4 font-semibold text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center text-[10px] font-bold">
                      {c.name[0]}
                    </span>
                    <span className="truncate">{c.name}</span>
                  </div>
                  <div className="col-span-3 text-neutral-300">{c.role}</div>
                  <div className="col-span-3 font-mono text-neutral-400 truncate">{c.payoutEmail}</div>
                  <div className="col-span-2 flex items-center justify-end gap-3">
                    <span className="font-mono tabular-nums font-bold text-white">{c.percentage}%</span>
                    <button
                      onClick={() => handleRemoveCollaborator(c.id)}
                      className="text-neutral-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Percentage Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-900 border border-white/10 text-xs">
              <span className="text-neutral-300">Total Royalty Allocation:</span>
              <div className="flex items-center gap-2">
                <span className={`font-mono tabular-nums font-bold ${totalSplitPercent === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {totalSplitPercent}% {totalSplitPercent === 100 ? '(Balanced)' : '(Must equal 100%)'}
                </span>
              </div>
            </div>

            {/* Add New Collaborator Form */}
            <form onSubmit={handleAddCollaborator} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Add Collaborator to Split Sheet
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Collaborator legal name"
                  value={newCollabName}
                  onChange={(e) => setNewCollabName(e.target.value)}
                  className="px-3 py-2 text-xs bg-neutral-900 border border-white/10 rounded-lg text-white placeholder-neutral-500"
                />
                <select
                  value={newCollabRole}
                  onChange={(e) => setNewCollabRole(e.target.value as SplitMember['role'])}
                  className="px-3 py-2 text-xs bg-neutral-900 border border-white/10 rounded-lg text-white"
                >
                  <option value="Primary Artist">Primary Artist</option>
                  <option value="Producer">Producer</option>
                  <option value="Songwriter">Songwriter</option>
                  <option value="Mix Engineer">Mix Engineer</option>
                  <option value="Featured Artist">Featured Artist</option>
                </select>
                <input
                  type="number"
                  min="1"
                  max="100"
                  placeholder="Share %"
                  value={newCollabPercent}
                  onChange={(e) => setNewCollabPercent(Number(e.target.value))}
                  className="px-3 py-2 text-xs bg-neutral-900 border border-white/10 rounded-lg text-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-white text-black font-semibold text-xs rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  Add to Split
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Catalog & Metadata Registry */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-bold text-white">Registered Master Recordings</h3>
              <p className="text-xs text-neutral-400">ISRC, UPC, and Distributor status</p>
            </div>
            <div className="divide-y divide-white/[0.04] text-xs">
              {artistTracks.map((t) => (
                <div key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02]">
                  <div className="space-y-1">
                    <p className="font-semibold text-white">{t.title}</p>
                    <div className="flex items-center gap-3 text-neutral-400">
                      <span>ISRC: <strong className="font-mono text-neutral-300">{t.isrc}</strong></span>
                      <span aria-hidden="true">·</span>
                      <span>UPC: <strong className="font-mono text-neutral-300">{t.upc}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-neutral-400">
                    <span>Label: <strong className="text-neutral-300">{t.label}</strong></span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{t.bpm} BPM</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Drop New Release */}
      {isNewReleaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-[#141416] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-bold text-white">Drop New Master Track</h3>
              </div>
              <button
                onClick={() => setIsNewReleaseModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ×
              </button>
            </div>

            {releaseSuccessMessage ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white">Track Registered & Live!</h4>
                <p className="text-xs text-neutral-400">Added to Flontmie streaming catalog and published directly.</p>
              </div>
            ) : (
              <form onSubmit={handleCreateRelease} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-medium text-neutral-300">Track Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Neon Horizon Pt. II"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-medium text-neutral-300">Genre</label>
                    <select
                      value={newGenre}
                      onChange={(e) => setNewGenre(e.target.value as MusicGenre)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
                    >
                      <option value="afrobeat">Afrobeat</option>
                      <option value="pop">Pop</option>
                      <option value="rap">Rap & Hip-Hop</option>
                      <option value="oldschool">Old School & Funk</option>
                      <option value="r&b">R&B & Neo-Soul</option>
                      <option value="synthwave">Synthwave / Retrowave</option>
                      <option value="lo-fi">Lo-Fi / Chillhop</option>
                      <option value="ambient">Ambient / Deep Focus</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-neutral-300">BPM (Tempo)</label>
                    <input
                      type="number"
                      value={newBpm}
                      onChange={(e) => setNewBpm(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="explicit"
                    checked={newIsExplicit}
                    onChange={(e) => setNewIsExplicit(e.target.checked)}
                    className="accent-red-500 rounded"
                  />
                  <label htmlFor="explicit" className="text-neutral-300">
                    Explicit Lyrics Tag (Parental Advisory)
                  </label>
                </div>

                <div className="p-3 rounded-lg bg-neutral-900 border border-dashed border-white/20 text-center space-y-1">
                  <Upload className="w-5 h-5 mx-auto text-neutral-400" />
                  <p className="font-medium text-neutral-200">WAV Stem & Artwork Linked</p>
                  <p className="text-[10px] text-neutral-500">24-bit / 48kHz uncompressed audio preset ready</p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setIsNewReleaseModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg shadow-md"
                  >
                    Submit & Dispatch Track
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
