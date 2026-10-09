import React, { useState } from 'react';
import { Search, Users, ChevronDown, Check, ShieldCheck, Sparkles, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { MoodCategory, Persona } from '../../types/music';

interface NavbarProps {
  currentPersona: Persona;
  onSelectPersona: (p: Persona) => void;
  selectedMood: MoodCategory;
  onSelectMood: (m: MoodCategory) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenShareModal?: () => void;
  onOpenJamModal: () => void;
  isJamActive: boolean;
  jamParticipantCount: number;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPersona,
  onSelectPersona,
  selectedMood,
  onSelectMood,
  searchQuery,
  onSearchChange,
  onOpenJamModal,
  isJamActive,
  jamParticipantCount,
  isSidebarCollapsed,
  onToggleSidebar,
}) => {
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);

  const moods: { id: MoodCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'relax', label: 'Relax' },
    { id: 'energize', label: 'Energize' },
    { id: 'workout', label: 'Workout' },
    { id: 'focus', label: 'Focus' },
    { id: 'party', label: 'Party' },
    { id: 'romance', label: 'Romance' },
  ];

  const personaLabels: Record<Persona, { title: string; subtitle: string; badge: string }> = {
    listener: {
      title: 'Listener',
      subtitle: 'Flontmie Streaming',
      badge: 'Stream',
    },
    artist: {
      title: 'Artist Studio',
      subtitle: 'Nova Waves Dashboard',
      badge: 'Creator',
    },
    label: {
      title: 'Record Label Hub',
      subtitle: 'Astral Horizon Records',
      badge: 'A&R',
    },
    distributor: {
      title: 'Distributor Portal',
      subtitle: 'TuneCore & CDBaby Ingest to Flontmie',
      badge: 'Ingest',
    },
    admin: {
      title: 'Owner Admin',
      subtitle: 'Flontmie Master Governance Console',
      badge: 'Owner',
    },
  };

  return (
    <header className="sticky top-0 z-40 bg-[#030303]/95 backdrop-blur-md border-b border-white/[0.08] px-3 md:px-6 py-2 flex items-center justify-between gap-2 md:gap-4 h-[57px]">
      {/* Zone 1: Pure uppercase FLONTMIE Wordmark without play icon + Desktop sidebar toggle */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="hidden md:flex w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] items-center justify-center transition-colors"
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        <a href="#home" className="flex items-center text-white hover:opacity-90 transition-opacity">
          <span className="text-xl md:text-2xl font-black tracking-widest text-white uppercase select-none">
            FLONTMIE
          </span>
        </a>
      </div>

      {/* Zone 2: Search input and quick category filter buttons */}
      <div className="flex-1 max-w-xl flex items-center gap-2 min-w-0">
        {currentPersona === 'listener' ? (
          <div className="w-full flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search tracks, artists, genres, playlists..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs md:text-sm bg-neutral-900/90 text-white placeholder-neutral-500 rounded-full border border-white/10 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/40 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Filter Buttons (Desktop) */}
            <div className="hidden xl:flex items-center gap-1 shrink-0">
              {moods.slice(0, 5).map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSelectMood(m.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap ${
                    selectedMood === m.id
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'bg-white/[0.07] text-neutral-300 hover:bg-white/[0.12] hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2 text-xs text-neutral-400 truncate">
            <span className="font-semibold text-white">{personaLabels[currentPersona].title}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{personaLabels[currentPersona].subtitle}</span>
          </div>
        )}
      </div>

      {/* Zone 3: Primary Actions (No share icon, no wave icon) + Persona Switcher */}
      <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0">
        {/* Jam Session Button (using Users icon instead of wave/radio) */}
        <button
          onClick={onOpenJamModal}
          className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-xs font-medium rounded-full transition-all border ${
            isJamActive
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-500/20'
              : 'bg-white/[0.05] border-white/10 text-neutral-300 hover:bg-white/10 hover:text-white'
          }`}
          title="Social Jam Listening Room"
        >
          <Users className={`w-3.5 h-3.5 ${isJamActive ? 'text-emerald-400 animate-pulse' : ''}`} />
          <span className="hidden sm:inline">
            {isJamActive ? `Jam (${jamParticipantCount})` : 'Jam'}
          </span>
        </button>

        {/* Persona Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-neutral-900 border border-white/10 text-neutral-200 hover:bg-neutral-800 transition-colors text-xs font-medium"
          >
            <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
              currentPersona === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-600/20 text-red-400'
            }`}>
              {currentPersona[0].toUpperCase()}
            </div>
            <span className="hidden lg:inline font-semibold">{personaLabels[currentPersona].title}</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {isPersonaMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsPersonaMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#121212] border border-white/10 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-white/[0.06] mb-1">
                  <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Flontmie Portals</p>
                  <p className="text-xs text-neutral-200">Switch workspace view or admin console</p>
                </div>
                {(['listener', 'artist', 'label', 'distributor', 'admin'] as Persona[]).map((p) => {
                  const item = personaLabels[p];
                  const isSelected = currentPersona === p;
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        onSelectPersona(p);
                        setIsPersonaMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-white/10 text-white font-medium'
                          : 'text-neutral-300 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{item.title}</span>
                        <span className="text-[11px] text-neutral-400">{item.subtitle}</span>
                      </div>
                      {isSelected ? (
                        <Check className="w-4 h-4 text-red-500 shrink-0" />
                      ) : (
                        <span className="text-[10px] text-neutral-500 border border-white/10 rounded px-1.5 py-0.5">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
