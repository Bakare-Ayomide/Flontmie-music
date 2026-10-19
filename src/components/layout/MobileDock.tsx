import React from 'react';
import { 
  Home, 
  Compass, 
  Library, 
  Heart
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
}) => {
  return (
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
      </nav>
    </div>
  );
};
