import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  FileSpreadsheet, 
  Globe, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Download
} from 'lucide-react';
import { LabelArtist, ReleaseScheduleItem } from '../../types/music';

interface LabelDashboardProps {
  labelArtists: LabelArtist[];
  upcomingReleases: ReleaseScheduleItem[];
}

export const LabelDashboard: React.FC<LabelDashboardProps> = ({
  labelArtists,
  upcomingReleases,
}) => {
  const [activeTab, setActiveTab] = useState<'roster' | 'pipeline' | 'royalties'>('roster');
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>('all');
  const [csvExportNotice, setCsvExportNotice] = useState(false);

  const totalCatalogTracks = labelArtists.reduce((acc, a) => acc + a.catalogCount, 0);
  const totalLabelStreams = labelArtists.reduce((acc, a) => acc + a.totalStreams, 0);
  const totalMonthlyRevenue = labelArtists.reduce((acc, a) => acc + a.monthlyRevenue, 0);
  const totalAdvances = labelArtists.reduce((acc, a) => acc + a.advanceAmount, 0);
  const totalRecouped = labelArtists.reduce((acc, a) => acc + a.recoupedAmount, 0);

  const handleExportCsv = () => {
    // Generate real CSV ledger content
    const headers = 'Artist,Catalog Tracks,Total Streams,Monthly Revenue (USD),Advance (USD),Recouped (USD),Recoupment Status\n';
    const rows = labelArtists
      .map(
        (a) =>
          `"${a.name}",${a.catalogCount},${a.totalStreams},${a.monthlyRevenue},${a.advanceAmount},${a.recoupedAmount},"${a.status}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Astral_Horizon_Master_Royalties_Q4_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setCsvExportNotice(true);
    setTimeout(() => setCsvExportNotice(false), 3000);
  };

  const filteredRoster = selectedArtistFilter === 'all'
    ? labelArtists
    : labelArtists.filter((a) => a.status.toLowerCase().includes(selectedArtistFilter));

  return (
    <div className="space-y-8 pb-28 animate-in fade-in duration-200">
      {/* Label Header */}
      <div className="p-6 md:p-8 rounded-2xl bg-neutral-900/60 border border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-lg">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                Record Label Hub
              </span>
              <span aria-hidden="true" className="text-neutral-500">·</span>
              <span className="text-xs text-neutral-400">HQ: London & Los Angeles</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-0.5">
              Astral Horizon Records
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-xl">
              Catalog management, multi-territory publishing sync, and master recording advances
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 font-semibold text-xs tracking-wide shadow-md transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Q4 Ledger CSV</span>
          </button>
        </div>
      </div>

      {csvExportNotice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Master royalty ledger CSV generated and downloaded successfully.</span>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Signed Roster</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-white">
            {labelArtists.length} Artists
          </p>
          <div className="text-[11px] text-neutral-400">{totalCatalogTracks} Master Tracks</div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Gross Monthly Label Revenue</span>
            <DollarSign className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            ${totalMonthlyRevenue.toLocaleString()}
          </p>
          <div className="text-[11px] text-emerald-400 font-mono">+18.5% YoY</div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Recouped Advances</span>
            <TrendingUp className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-white">
            ${totalRecouped.toLocaleString()}
          </p>
          <div className="text-[11px] text-neutral-400">
            of ${totalAdvances.toLocaleString()} deployed ({Math.round((totalRecouped / totalAdvances) * 100)}%)
          </div>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Total Catalog Streams</span>
            <Globe className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-white">
            {(totalLabelStreams / 1000000).toFixed(1)}M
          </p>
          <div className="text-[11px] text-neutral-400">Global DSP reach</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
        <button
          onClick={() => setActiveTab('roster')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'roster'
              ? 'bg-white text-black shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Artist Roster & Advances
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'pipeline'
              ? 'bg-white text-black shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Release Calendar & Editorial Pitches
        </button>
        <button
          onClick={() => setActiveTab('royalties')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'royalties'
              ? 'bg-white text-black shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Territory Market Share
        </button>
      </div>

      {/* Tab 1: Roster */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Signed Artists Ledger</h3>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-neutral-400">Filter Recoupment:</span>
              <button
                onClick={() => setSelectedArtistFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedArtistFilter === 'all' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedArtistFilter('recouped')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedArtistFilter === 'recouped' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Recouped
              </button>
              <button
                onClick={() => setSelectedArtistFilter('in recoupment')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedArtistFilter === 'in recoupment' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                In Recoupment
              </button>
            </div>
          </div>

          <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-neutral-900/30">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.02] text-neutral-400 uppercase tracking-wider text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">Artist</th>
                    <th className="py-3 px-4 text-right">Tracks</th>
                    <th className="py-3 px-4 text-right">Streams</th>
                    <th className="py-3 px-4 text-right">Monthly Rev</th>
                    <th className="py-3 px-4 text-right">Advance Deployed</th>
                    <th className="py-3 px-4 text-right">Recouped</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredRoster.map((a) => (
                    <tr key={a.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={a.avatarUrl}
                            alt={a.name}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <span className="font-semibold text-white">{a.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-neutral-300">
                        {a.catalogCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-white">
                        {a.totalStreams.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-400 font-semibold">
                        ${a.monthlyRevenue.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-neutral-300">
                        ${a.advanceAmount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-neutral-200">
                        ${a.recoupedAmount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`font-semibold ${
                            a.status === 'Recouped'
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {a.status}
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

      {/* Tab 2: Release Calendar */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-bold text-white">Upcoming Releases & DSP Pitches</h3>
              <p className="text-xs text-neutral-400">Editorial playlist pitch status and UPC registration</p>
            </div>
            <div className="divide-y divide-white/[0.04] text-xs">
              {upcomingReleases.map((r) => (
                <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <img
                      src={r.coverUrl}
                      alt={r.title}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div>
                      <h4 className="font-semibold text-white text-sm">{r.title}</h4>
                      <div className="flex items-center gap-2 text-neutral-400 text-xs">
                        <span>{r.artistName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{r.type}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">UPC: {r.upc}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-neutral-500 block text-[10px] uppercase">Drop Date</span>
                      <span className="font-mono text-white font-semibold">{r.releaseDate}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-neutral-500 block text-[10px] uppercase">DSP Pitch Status</span>
                      <span
                        className={`font-semibold ${
                          r.editorialPitchStatus.includes('Accepted')
                            ? 'text-emerald-400'
                            : r.editorialPitchStatus.includes('Under Review')
                            ? 'text-amber-400'
                            : 'text-blue-400'
                        }`}
                      >
                        {r.editorialPitchStatus}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Territory Breakdown */}
      {activeTab === 'royalties' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl bg-neutral-900/30 border border-white/[0.08] space-y-4">
            <h4 className="text-sm font-bold text-white">Territorial Revenue Distribution</h4>
            <div className="space-y-3">
              {[
                { name: 'North America (US & CA)', pct: 44, rev: '$121,880' },
                { name: 'Europe (UK, DE, FR, NL)', pct: 28, rev: '$77,560' },
                { name: 'Asia-Pacific (JP, KR, AU)', pct: 18, rev: '$49,860' },
                { name: 'Latin America (BR, MX, AR)', pct: 10, rev: '$27,700' },
              ].map((t) => (
                <div key={t.name} className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-300">{t.name}</span>
                    <span className="font-mono tabular-nums text-white">{t.rev} ({t.pct}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${t.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-xl bg-neutral-900/30 border border-white/[0.08] space-y-4">
            <h4 className="text-sm font-bold text-white">Publishing & Sync Mechanicals</h4>
            <div className="space-y-3 text-xs text-neutral-300">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] flex justify-between">
                <span>Direct Digital Performance (DSP)</span>
                <span className="font-mono tabular-nums font-bold text-emerald-400">72.4%</span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] flex justify-between">
                <span>Micro-sync Licensing (TikTok & Shorts)</span>
                <span className="font-mono tabular-nums font-bold text-white">16.8%</span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] flex justify-between">
                <span>Commercial Film & TV Sync Placements</span>
                <span className="font-mono tabular-nums font-bold text-white">10.8%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
