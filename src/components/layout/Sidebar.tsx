import React from 'react';
import { 
  Home, 
  Compass, 
  Library, 
  Heart, 
  Plus, 
  ListMusic, 
  Mic2, 
  Building2, 
  Network,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { Playlist, Persona } from '../../types/music';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  playlists: Playlist[];
  selectedPlaylistId: string | null;
  onSelectPlaylist: (id: string) => void;
  onCreatePlaylist: () => void;
  currentPersona: Persona;
  onSelectPersona: (p: Persona) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  playlists,
  selectedPlaylistId,
  onSelectPlaylist,
  onCreatePlaylist,
  currentPersona,
  onSelectPersona,
  isCollapsed,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`hidden md:flex shrink-0 bg-[#030303] border-r border-white/[0.08] flex-col h-[calc(100vh-57px-80px)] select-none transition-all duration-200 ${
        isCollapsed ? 'w-16 md:w-18' : 'w-60 md:w-64'
      }`}
    >
      {/* Top Header / Toggle Collapse Control */}
      <div className={`p-2 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-3'}`}>
        {!isCollapsed && (
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Navigation
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          className="w-10 h-10 rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse to icon rail'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Primary Navigation */}
      <div className="px-2 py-1 space-y-1">
        <button
          onClick={() => {
            onSelectTab('home');
            onSelectPersona('listener');
          }}
          className={`w-full flex items-center rounded-xl transition-all ${
            isCollapsed
              ? 'flex-col justify-center py-2 h-13'
              : 'gap-3 px-3 py-2.5 text-sm font-medium'
          } ${
            currentTab === 'home' && currentPersona === 'listener' && !selectedPlaylistId
              ? 'bg-white/10 text-white font-semibold'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
          }`}
          title="Home"
        >
          <Home className="w-5 h-5 shrink-0" />
          <span className={isCollapsed ? 'text-[9px] font-medium tracking-tight mt-0.5' : 'text-sm font-medium'}>
            Home
          </span>
        </button>

        <button
          onClick={() => {
            onSelectTab('explore');
            onSelectPersona('listener');
          }}
          className={`w-full flex items-center rounded-xl transition-all ${
            isCollapsed
              ? 'flex-col justify-center py-2 h-13'
              : 'gap-3 px-3 py-2.5 text-sm font-medium'
          } ${
            currentTab === 'explore'
              ? 'bg-white/10 text-white font-semibold'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
          }`}
          title="Explore & Charts"
        >
          <Compass className="w-5 h-5 shrink-0" />
          <span className={isCollapsed ? 'text-[9px] font-medium tracking-tight mt-0.5' : 'text-sm font-medium'}>
            Explore
          </span>
        </button>

        <button
          onClick={() => {
            onSelectTab('library');
            onSelectPersona('listener');
          }}
          className={`w-full flex items-center rounded-xl transition-all ${
            isCollapsed
              ? 'flex-col justify-center py-2 h-13'
              : 'gap-3 px-3 py-2.5 text-sm font-medium'
          } ${
            currentTab === 'library'
              ? 'bg-white/10 text-white font-semibold'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
          }`}
          title="Library"
        >
          <Library className="w-5 h-5 shrink-0" />
          <span className={isCollapsed ? 'text-[9px] font-medium tracking-tight mt-0.5' : 'text-sm font-medium'}>
            Library
          </span>
        </button>

        <button
          onClick={() => {
            onSelectTab('liked');
            onSelectPersona('listener');
          }}
          className={`w-full flex items-center rounded-xl transition-all ${
            isCollapsed
              ? 'flex-col justify-center py-2 h-13'
              : 'gap-3 px-3 py-2.5 text-sm font-medium'
          } ${
            currentTab === 'liked'
              ? 'bg-white/10 text-white font-semibold'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
          }`}
          title="Liked Songs"
        >
          <Heart className="w-5 h-5 text-red-500 shrink-0" />
          <span className={isCollapsed ? 'text-[9px] font-medium tracking-tight mt-0.5' : 'text-sm font-medium'}>
            Liked
          </span>
        </button>
      </div>

      <div className="h-px bg-white/[0.08] mx-2 my-2" />

      {/* Playlists & Curation Section */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-2">
        {!isCollapsed && (
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Playlists & Mixes
            </span>
            <button
              onClick={onCreatePlaylist}
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Create New Curated Playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="space-y-1">
          {playlists.map((playlist) => {
            const isSelected = selectedPlaylistId === playlist.id && currentPersona === 'listener';
            return (
              <button
                key={playlist.id}
                onClick={() => {
                  onSelectPersona('listener');
                  onSelectPlaylist(playlist.id);
                }}
                className={`w-full flex items-center rounded-xl transition-all ${
                  isCollapsed
                    ? 'justify-center p-2 h-12'
                    : 'gap-3 px-2.5 py-2 text-left text-xs font-medium'
                } ${
                  isSelected
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                title={playlist.title}
              >
                <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden bg-neutral-800 flex items-center justify-center">
                  {playlist.coverUrl ? (
                    <img
                      src={playlist.coverUrl}
                      alt={playlist.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ListMusic className="w-4 h-4 text-neutral-500" />
                  )}
                </div>
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-neutral-200">{playlist.title}</p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {playlist.isCollaborative ? 'Collab' : 'Curated'} · {playlist.trackIds.length} tracks
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-white/[0.08] mx-2 my-1" />

      {/* Industry Portals Quick Nav */}
      <div className={`p-2 bg-neutral-950/70 border-t border-white/[0.06] space-y-1 ${isCollapsed ? 'text-center' : ''}`}>
        {!isCollapsed && (
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider px-2 mb-1">
            Industry Portals
          </p>
        )}

        <button
          onClick={() => onSelectPersona('artist')}
          className={`w-full flex items-center rounded-xl transition-all ${
            isCollapsed
              ? 'justify-center p-2 h-11'
              : 'gap-2.5 px-2.5 py-2 text-xs font-medium'
          } ${
            currentPersona === 'artist'
              ? 'bg-red-500/15 text-red-300 font-semibold border border-red-500/30'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
          }`}
          title="Artist Studio (Nova Waves)"
        >
          <Mic2 className="w-4 h-4 shrink-0 text-red-400" />
          {!isCollapsed && (
            <div className="text-left truncate">
              <span className="block truncate font-medium">Artist Studio</span>
              <span className="block text-[10px] text-neutral-500 truncate">Nova Waves</span>
            </div>
          )}
        </button>

        <button
          onClick={() => onSelectPersona('label')}
          className={`w-full flex items-center rounded-xl transition-all ${
            isCollapsed
              ? 'justify-center p-2 h-11'
              : 'gap-2.5 px-2.5 py-2 text-xs font-medium'
          } ${
            currentPersona === 'label'
              ? 'bg-blue-500/15 text-blue-300 font-semibold border border-blue-500/30'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
          }`}
          title="Record Label Hub (Astral Horizon)"
        >
          <Building2 className="w-4 h-4 shrink-0 text-blue-400" />
          {!isCollapsed && (
            <div className="text-left truncate">
              <span className="block truncate font-medium">Record Label Hub</span>
              <span className="block text-[10px] text-neutral-500 truncate">Astral Horizon</span>
            </div>
          )}
        </button>

        <button
          onClick={() => onSelectPersona('distributor')}
          className={`w-full flex items-center rounded-xl transition-all ${
            isCollapsed
              ? 'justify-center p-2 h-11'
              : 'gap-2.5 px-2.5 py-2 text-xs font-medium'
          } ${
            currentPersona === 'distributor'
              ? 'bg-purple-500/15 text-purple-300 font-semibold border border-purple-500/30'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
          }`}
          title="Distributor Engine (SoundGate)"
        >
          <Network className="w-4 h-4 shrink-0 text-purple-400" />
          {!isCollapsed && (
            <div className="text-left truncate">
              <span className="block truncate font-medium">Distributor Engine</span>
              <span className="block text-[10px] text-neutral-500 truncate">SoundGate Global</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
