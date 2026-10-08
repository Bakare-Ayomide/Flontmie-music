import React, { useState } from 'react';
import { 
  Home, 
  Compass, 
  Library, 
  Heart, 
  Layers, 
  Radio, 
  UserCheck, 
  ShieldCheck, 
  Mic2, 
  Building2, 
  Network 
} from 'lucide-react';
import { Persona } from '../../types/music';

interface MobileDockProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentPersona: Persona;
  onSelectPersona: (p: Persona) => void;
  isJamActive: boolean;
  onOpenJamModal: () => void;
}

export const MobileDock: React.FC<MobileDockProps> = ({
  currentTab,
  onSelectTab,
  currentPersona,
  onSelectPersona,
  isJamActive,
  onOpenJamModal,
}) => {
  const [isRoleSheetOpen, setIsRoleSheetOpen] = useState(false);

  const personas: { id: Persona; label: string; icon: React.ReactNode; badge: string }[] = [
    { id: 'listener', label: 'Listener', icon: <Home className="w-4 h-4 text-white" />, badge: 'Stream' },
    { id: 'artist', label: 'Artist Studio', icon: <Mic2 className="w-4 h-4 text-red-400" />, badge: 'Creator' },
    { id: 'label', label: 'Record Label', icon: <Building2 className="w-4 h-4 text-blue-400" />, badge: 'A&R' },
    { id: 'distributor', label: 'Distributor', icon: <Network className="w-4 h-4 text-purple-400" />, badge: 'Ingest' },
    { id: 'admin', label: 'Owner Admin', icon: <ShieldCheck className="w-4 h-4 text-amber-400" />, badge: 'Owner' },
  ];

  return (
    <>
      {/* Mobile Floating Dock Bar (Rendered only on mobile < md) */}
      <div className="md:hidden fixed bottom-[68px] inset-x-3 z-30 pointer-events-none select-none">
        <nav className="pointer-events-auto mx-auto max-w-md bg-[#121215]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5 flex items-center justify-around gap-1">
          {/* Home */}
          <button
            onClick={() => {
              onSelectTab('home');
              onSelectPersona('listener');
            }}
            className={`min-h-[44px] flex-1 flex flex-col items-center justify-center rounded-xl transition-all ${
              currentTab === 'home' && currentPersona === 'listener'
                ? 'bg-white/15 text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            title="Home"
          >
            <Home className="w-4 h-4" />
            <span className="text-[10px] mt-0.5 font-medium">Home</span>
          </button>

          {/* Explore */}
          <button
            onClick={() => {
              onSelectTab('explore');
              onSelectPersona('listener');
            }}
            className={`min-h-[44px] flex-1 flex flex-col items-center justify-center rounded-xl transition-all ${
              currentTab === 'explore' && currentPersona === 'listener'
                ? 'bg-white/15 text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            title="Explore"
          >
            <Compass className="w-4 h-4" />
            <span className="text-[10px] mt-0.5 font-medium">Explore</span>
          </button>

          {/* Library */}
          <button
            onClick={() => {
              onSelectTab('library');
              onSelectPersona('listener');
            }}
            className={`min-h-[44px] flex-1 flex flex-col items-center justify-center rounded-xl transition-all ${
              currentTab === 'library' && currentPersona === 'listener'
                ? 'bg-white/15 text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            title="Library"
          >
            <Library className="w-4 h-4" />
            <span className="text-[10px] mt-0.5 font-medium">Library</span>
          </button>

          {/* Liked */}
          <button
            onClick={() => {
              onSelectTab('liked');
              onSelectPersona('listener');
            }}
            className={`min-h-[44px] flex-1 flex flex-col items-center justify-center rounded-xl transition-all ${
              currentTab === 'liked' && currentPersona === 'listener'
                ? 'bg-white/15 text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            title="Liked"
          >
            <Heart className="w-4 h-4 text-red-500" />
            <span className="text-[10px] mt-0.5 font-medium">Liked</span>
          </button>

          {/* Role Hub / Portal Switcher Drawer */}
          <button
            onClick={() => setIsRoleSheetOpen(true)}
            className={`min-h-[44px] flex-1 flex flex-col items-center justify-center rounded-xl transition-all ${
              currentPersona !== 'listener'
                ? 'bg-red-500/20 text-red-300 font-semibold border border-red-500/30'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            title="Switch Industry Hub"
          >
            <Layers className="w-4 h-4" />
            <span className="text-[10px] mt-0.5 font-medium capitalize">
              {currentPersona === 'listener' ? 'Hub' : currentPersona}
            </span>
          </button>
        </nav>
      </div>

      {/* Role Switcher Bottom Sheet for Mobile */}
      {isRoleSheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="flex-1"
            onClick={() => setIsRoleSheetOpen(false)}
          />
          <div className="w-full bg-[#121215] border-t border-white/10 rounded-t-3xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-1" />
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Flontmie Role Switcher</h3>
                <p className="text-[11px] text-neutral-400">Select which industry role or dashboard to control</p>
              </div>
              <button
                onClick={() => setIsRoleSheetOpen(false)}
                className="text-xs text-neutral-400 hover:text-white px-2 py-1"
              >
                Close
              </button>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {personas.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectPersona(item.id);
                    setIsRoleSheetOpen(false);
                  }}
                  className={`w-full min-h-[48px] flex items-center justify-between p-3 rounded-xl text-left text-xs transition-colors ${
                    currentPersona === item.id
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-neutral-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{item.label}</p>
                      <p className="text-[10px] text-neutral-400">Switch active dashboard</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono border border-white/10 rounded px-2 py-0.5 text-neutral-400">
                    {item.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
