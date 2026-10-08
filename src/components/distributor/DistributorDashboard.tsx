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
  Save 
} from 'lucide-react';
import { 
  DistributorIngestionItem, 
  DistributorAccessGrant, 
  Track, 
  MusicGenre 
} from '../../types/music';

interface DistributorDashboardProps {
  ingestions: DistributorIngestionItem[];
  accessGrants: DistributorAccessGrant[];
  onUploadSongToFlontmie: (newSong: Partial<Track>) => void;
  onModifySongOnFlontmie: (trackId: string, updates: Partial<Track>) => void;
  tracks: Track[];
}

export const DistributorDashboard: React.FC<DistributorDashboardProps> = ({
  ingestions,
  accessGrants,
  onUploadSongToFlontmie,
  onModifySongOnFlontmie,
  tracks,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'upload' | 'access' | 'modify'>('catalog');
  const [grants, setGrants] = useState<DistributorAccessGrant[]>(accessGrants);
  const [items, setItems] = useState<DistributorIngestionItem[]>(ingestions);

  // New Upload onto Flontmie form
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState('');
  const [uploadLabel, setUploadLabel] = useState('Astral Horizon Records');
  const [uploadGenre, setUploadGenre] = useState<MusicGenre>('afrobeat');
  const [uploadBpm, setUploadBpm] = useState(115);
  const [uploadIsrc, setUploadIsrc] = useState('');
  const [uploadUpc, setUploadUpc] = useState('');
  const [distributorName, setDistributorName] = useState('TuneCore Direct on Flontmie');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Modify track on Flontmie form
  const [selectedTrackToModify, setSelectedTrackToModify] = useState<string>(tracks[0]?.id || '');
  const [modifiedTitle, setModifiedTitle] = useState('');
  const [modifiedGenre, setModifiedGenre] = useState<MusicGenre>('afrobeat');
  const [modifySuccess, setModifySuccess] = useState(false);

  // New Access Grant form
  const [grantEntityName, setGrantEntityName] = useState('');
  const [grantEntityType, setGrantEntityType] = useState<'Artist' | 'Record Label'>('Artist');
  const [grantCanAlbums, setGrantCanAlbums] = useState(true);
  const [grantMaxReleases, setGrantMaxReleases] = useState(25);

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim() || !uploadArtist.trim()) return;

    const isrc = uploadIsrc.trim() || `US-FLN-26-${Math.floor(10000 + Math.random() * 90000)}`;
    const upc = uploadUpc.trim() || `84019${Math.floor(1000000 + Math.random() * 9000000)}`;

    const newTrack: Partial<Track> = {
      title: uploadTitle.trim(),
      artist: uploadArtist.trim(),
      artistId: `artist-${uploadArtist.toLowerCase().replace(/\s+/g, '-')}`,
      album: `${uploadTitle.trim()} (Single)`,
      genre: uploadGenre,
      bpm: Number(uploadBpm),
      duration: 205,
      moods: ['energize'],
      streams: 1,
      likes: 1,
      isExplicit: false,
      isrc,
      upc,
      label: uploadLabel,
      distributor: distributorName,
      status: 'active',
      featuredOnHome: true,
    };

    onUploadSongToFlontmie(newTrack);

    const newIngestion: DistributorIngestionItem = {
      id: `ing-${Date.now()}`,
      trackTitle: uploadTitle.trim(),
      artistName: uploadArtist.trim(),
      artistId: `artist-${uploadArtist.toLowerCase().replace(/\s+/g, '-')}`,
      labelName: uploadLabel,
      isrc,
      upc,
      genre: uploadGenre,
      releaseDate: new Date().toISOString().split('T')[0],
      flontmieStatus: 'Live on Flontmie',
      grantedUploadAccess: true,
      uploadedByDistributor: distributorName,
      audioQuality: 'Lossless Hi-Res',
    };

    setItems([newIngestion, ...items]);
    setUploadSuccess(true);
    setTimeout(() => {
      setUploadSuccess(false);
      setUploadTitle('');
      setUploadArtist('');
      setActiveTab('catalog');
    }, 1500);
  };

  const handleModifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrackToModify) return;

    const updates: Partial<Track> = {};
    if (modifiedTitle.trim()) updates.title = modifiedTitle.trim();
    if (modifiedGenre) updates.genre = modifiedGenre;

    onModifySongOnFlontmie(selectedTrackToModify, updates);
    setModifySuccess(true);
    setTimeout(() => {
      setModifySuccess(false);
    }, 2000);
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

  const handleToggleGrantStatus = (id: string) => {
    setGrants(
      grants.map((g) =>
        g.id === id ? { ...g, status: g.status === 'Active' ? 'Revoked' : 'Active' } : g
      )
    );
  };

  return (
    <div className="space-y-8 pb-28 animate-in fade-in duration-200">
      {/* Distributor Header */}
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
              TuneCore · CD Baby · Ditto Hub for Flontmie
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-xl">
              Upload, modify and distribute artist and record label catalog directly into Flontmie, grant upload rights, and manage live metadata
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('upload')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Song to Flontmie</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="text-[11px] text-neutral-400">Direct Flontmie Audio Pipeline</div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <span className="text-xs font-medium text-neutral-400">Distributor Network</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-purple-400">
            Certified
          </p>
          <div className="text-[11px] text-neutral-400">TuneCore · CD Baby · Ditto · DistroKid</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'catalog' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Flontmie Live Ingestions ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'upload' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          + Upload Songs & Albums to Flontmie
        </button>
        <button
          onClick={() => setActiveTab('access')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'access' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Grant Upload Rights to Artists & Labels ({grants.length})
        </button>
        <button
          onClick={() => setActiveTab('modify')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'modify' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Edit & Modify Songs on Flontmie
        </button>
      </div>

      {/* TAB 1: Flontmie Live Ingestions */}
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

      {/* TAB 2: Upload Songs & Albums directly onto Flontmie */}
      {activeTab === 'upload' && (
        <div className="max-w-2xl p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-6">
          <div>
            <h3 className="text-base font-bold text-white">Upload Artist/Label Catalog Directly to Flontmie</h3>
            <p className="text-xs text-neutral-400">
              Distribute songs directly into Flontmie streaming app for listeners worldwide
            </p>
          </div>

          {uploadSuccess ? (
            <div className="p-8 text-center space-y-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">Song Ingested Successfully onto Flontmie!</h4>
              <p className="text-xs text-neutral-400">It is now live in the Flontmie home feed and catalog.</p>
            </div>
          ) : (
            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Distributor Gateway</label>
                  <select
                    value={distributorName}
                    onChange={(e) => setDistributorName(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
                  >
                    <option value="TuneCore Direct on Flontmie">TuneCore Direct on Flontmie</option>
                    <option value="CDBaby Gateway on Flontmie">CDBaby Gateway on Flontmie</option>
                    <option value="Ditto Music Hub on Flontmie">Ditto Music Hub on Flontmie</option>
                    <option value="DistroKid Direct on Flontmie">DistroKid Direct on Flontmie</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Record Label / Publisher</label>
                  <input
                    type="text"
                    required
                    value={uploadLabel}
                    onChange={(e) => setUploadLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Track Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lagos Skyline Reverie"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Artist Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Amara Osei"
                    value={uploadArtist}
                    onChange={(e) => setUploadArtist(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Genre</label>
                  <select
                    value={uploadGenre}
                    onChange={(e) => setUploadGenre(e.target.value as MusicGenre)}
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

                <div className="space-y-1">
                  <label className="text-neutral-300 font-medium">Tempo (BPM)</label>
                  <input
                    type="number"
                    value={uploadBpm}
                    onChange={(e) => setUploadBpm(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/20 text-center space-y-1">
                <Upload className="w-5 h-5 mx-auto text-purple-400" />
                <p className="font-semibold text-white">Lossless Master Stems Verified</p>
                <p className="text-[10px] text-neutral-400">Ready for instant ingestion into Flontmie audio engine</p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg transition-colors"
              >
                Publish Directly to Flontmie Platform
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 3: Grant Upload Rights & Access to Artists and Labels */}
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

            <div className="divide-y divide-white/[0.04] text-xs">
              {grants.map((grant) => (
                <div key={grant.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center text-purple-400">
                      {grant.entityType === 'Record Label' ? <Building2 className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{grant.entityName}</h4>
                      <p className="text-neutral-400 text-[11px]">
                        {grant.entityType} · Authorized via {grant.distributorName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-neutral-300">
                    <div>
                      <span className="text-[10px] text-neutral-500 block uppercase">Permissions</span>
                      <span>Tracks {grant.canUploadTracks ? '✓' : '✗'} · Albums {grant.canUploadAlbums ? '✓' : '✗'}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-neutral-500 block uppercase">Quota</span>
                      <span className="font-mono">{grant.maxMonthlyReleases} releases/mo</span>
                    </div>

                    <button
                      onClick={() => handleToggleGrantStatus(grant.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        grant.status === 'Active'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {grant.status}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form to Grant New Rights */}
          <form onSubmit={handleAddAccessGrant} className="max-w-xl p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4 text-xs">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" />
              <span>Grant New Upload Rights on Flontmie</span>
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-neutral-300 font-medium">Entity Name (Artist or Label)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lagos Grooves Records"
                  value={grantEntityName}
                  onChange={(e) => setGrantEntityName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-300 font-medium">Entity Type</label>
                <select
                  value={grantEntityType}
                  onChange={(e) => setGrantEntityType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
                >
                  <option value="Artist">Artist</option>
                  <option value="Record Label">Record Label</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-neutral-300">
                <input
                  type="checkbox"
                  checked={grantCanAlbums}
                  onChange={(e) => setGrantCanAlbums(e.target.checked)}
                  className="accent-purple-500 rounded"
                />
                <span>Grant Full Album Upload Access</span>
              </label>

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-neutral-400">Monthly Limit:</span>
                <input
                  type="number"
                  value={grantMaxReleases}
                  onChange={(e) => setGrantMaxReleases(Number(e.target.value))}
                  className="w-16 px-2 py-1 bg-neutral-900 border border-white/10 rounded text-white font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-neutral-200 transition-colors"
            >
              Grant Access Permission
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: Edit & Modify Songs on Flontmie */}
      {activeTab === 'modify' && (
        <div className="max-w-2xl p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-purple-400" />
              <span>Modify & Update Songs Live on Flontmie</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Distributors have authority to update track titles, genres, and audio metadata for their catalog
            </p>
          </div>

          {modifySuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Song metadata modified and refreshed live on Flontmie!</span>
            </div>
          )}

          <form onSubmit={handleModifySubmit} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-neutral-300 font-medium">Select Song to Modify on Flontmie</label>
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
                    {t.title} — {t.artist} ({t.genre})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-neutral-300 font-medium">New Track Title</label>
              <input
                type="text"
                placeholder="Update track title"
                value={modifiedTitle}
                onChange={(e) => setModifiedTitle(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-neutral-300 font-medium">Update Genre Classification</label>
              <select
                value={modifiedGenre}
                onChange={(e) => setModifiedGenre(e.target.value as MusicGenre)}
                className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white capitalize"
              >
                <option value="afrobeat">Afrobeat</option>
                <option value="pop">Pop</option>
                <option value="rap">Rap & Hip-Hop</option>
                <option value="oldschool">Old School</option>
                <option value="r&b">R&B & Neo-Soul</option>
                <option value="synthwave">Synthwave</option>
                <option value="lo-fi">Lo-Fi</option>
                <option value="ambient">Ambient</option>
              </select>
            </div>

            <button
              type="submit"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Apply Changes Live on Flontmie</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
