import React, { useState, useEffect, useRef } from 'react';
import { Search, Users, ChevronDown, Check, ShieldCheck, Sparkles, PanelLeftOpen, PanelLeftClose, LogIn } from 'lucide-react';
import { MoodCategory, Persona } from '../../types/music';
import { AuthUser } from '../auth/AuthModal';
import { api } from '../../services/api';

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
  currentUser?: AuthUser | null;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
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
  currentUser,
  onOpenAuth,
  onOpenProfile,
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
      subtitle: 'Music Streaming',
      badge: 'Stream',
    },
    artist: {
      title: 'Artist Studio',
      subtitle: 'Creator Dashboard',
      badge: 'Creator',
    },
    label: {
      title: 'Record Label Hub',
      subtitle: 'Label & Roster',
      badge: 'A&R',
    },
    distributor: {
      title: 'Distributor Portal',
      subtitle: 'Release Management',
      badge: 'Ingest',
    },
    admin: {
      title: 'Owner Admin',
      subtitle: 'Governance Console',
      badge: 'Owner',
    },
  };

  const [suggestions, setSuggestions] = useState<Array<{
    text: string;
    type: 'query' | 'song' | 'artist' | 'album';
    artist?: string;
    track_id?: string;
    videoId?: string;
    cover_url?: string;
  }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);

  // Debounced search suggestions while typing
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(() => {
      setIsLoadingSuggestions(true);
      api.getSearchSuggestions(q)
        .then((items: any) => {
          if (isMounted) {
            setSuggestions(items || []);
            if (items && items.length > 0) {
              setShowSuggestions(true);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsLoadingSuggestions(false);
        });
    }, 180);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Click outside to dismiss suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmitSearch = (term?: string) => {
    const q = (term !== undefined ? term : searchQuery).trim();
    if (!q) return;
    setShowSuggestions(false);
    onSearchChange(q);
    try {
      window.dispatchEvent(new CustomEvent('app:submit_search', { detail: q }));
    } catch {}
  };

  return (
    <header className="sticky top-0 z-40 bg-[#030303]/95 backdrop-blur-md border-b border-white/[0.08] px-3 md:px-6 py-2 flex items-center justify-between gap-2 md:gap-4 h-[57px]">
      {/* Zone 1: Desktop sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="hidden md:flex w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] items-center justify-center transition-colors shrink-0"
        title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </button>

      {/* Zone 2: Search input and live discovery suggestions */}
      <div className="flex-1 max-w-2xl flex items-center gap-2 min-w-0" ref={searchContainerRef}>
        {currentPersona === 'listener' ? (
          <div className="w-full flex items-center gap-2 relative">
            <div className="relative flex-1 min-w-0">
              {/* Clickable Search Icon Button */}
              <button
                type="button"
                onClick={() => handleSubmitSearch(searchQuery)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-white hover:bg-white/10 absolute left-1 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                title="Submit Search"
                aria-label="Submit search"
              >
                <Search className="w-3.5 h-3.5" />
              </button>

              <input
                type="text"
                placeholder="Search songs, artists, albums, playlists..."
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (e.target.value.trim().length >= 2) {
                    setShowSuggestions(true);
                  }
                }}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmitSearch(searchQuery);
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                  }
                }}
                className="w-full pl-9 pr-14 py-1.5 text-xs md:text-sm bg-neutral-900/90 text-white placeholder-neutral-500 rounded-full border border-white/10 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/40 transition-colors"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    setShowSuggestions(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] px-1.5 py-0.5 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Live Search Suggestions Dropdown while typing */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#121216] border border-white/15 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 max-h-96 overflow-y-auto no-scrollbar divide-y divide-white/[0.05]">
                <div className="p-2 space-y-1">
                  {suggestions.map((item, idx) => (
                    <button
                      key={`${item.text}-${idx}`}
                      type="button"
                      onClick={() => handleSubmitSearch(item.text)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs text-neutral-200 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer group"
                    >
                      {item.cover_url ? (
                        <img
                          src={item.cover_url}
                          alt=""
                          className="w-7 h-7 rounded-lg object-cover shrink-0 bg-neutral-800"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 text-neutral-400 group-hover:text-red-400">
                          <Search className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate text-white group-hover:text-red-400 transition-colors">
                          {item.text}
                        </p>
                        {item.artist && (
                          <p className="text-[11px] text-neutral-400 truncate">
                            {item.artist}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-500 uppercase font-mono shrink-0">
                        {item.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                  <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Portals</p>
                  <p className="text-xs text-neutral-200">Switch workspace</p>
                </div>
                {(['listener', 'artist', 'label', 'distributor'] as Persona[]).map((p) => {
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

        {/* Auth / Profile Trigger */}
        {currentUser ? (
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-1.5 p-1 pr-2.5 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white text-xs font-semibold transition-all cursor-pointer"
            title="View Profile & Account Settings"
          >
            <div className="w-5 h-5 rounded-full overflow-hidden bg-neutral-800 shrink-0 border border-white/20">
              <img
                src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={currentUser.display_name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="hidden sm:inline max-w-[90px] truncate">{currentUser.display_name}</span>
          </button>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/30 transition-all cursor-pointer"
            title="Sign In"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
