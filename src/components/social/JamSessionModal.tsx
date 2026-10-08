import React, { useState } from 'react';
import { X, Users, Radio, Sparkles, Copy, Check, MessageSquare, Flame, Heart, Zap, Headphones, Smile } from 'lucide-react';
import { JamParticipant, Track } from '../../types/music';

interface JamSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isJamActive: boolean;
  onToggleJam: () => void;
  currentTrack: Track | null;
  participants: JamParticipant[];
  onSendReaction: (emoji: string) => void;
  reactions: { id: string; emoji: string; x: number }[];
}

export const JamSessionModal: React.FC<JamSessionModalProps> = ({
  isOpen,
  onClose,
  isJamActive,
  onToggleJam,
  currentTrack,
  participants,
  onSendReaction,
  reactions,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const roomCode = 'JAM-FLONTMIE-882';

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const reactionEmojis = ['🔥', '💃', '🎧', '⚡', '💖', '🚀', '🙌'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#121215] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-6 relative">
        {/* Floating live reaction emojis container */}
        <div className="absolute inset-x-0 bottom-24 top-0 pointer-events-none overflow-hidden">
          {reactions.map((r) => (
            <div
              key={r.id}
              className="absolute bottom-4 text-3xl animate-bounce transition-all duration-1000 select-none"
              style={{
                left: `${r.x}%`,
                animationDuration: '1.2s',
              }}
            >
              {r.emoji}
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Social Jam Session</h3>
              <p className="text-xs text-neutral-400">Synchronized group listening in real time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Session Status & Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-200">
              {isJamActive ? 'Live Listening Room Active' : 'Start a Jam with Friends'}
            </span>
            <p className="text-[11px] text-neutral-400">
              {isJamActive
                ? 'Everyone hears the exact same playback position in sync'
                : 'Share room code so friends can listen together and react'}
            </p>
          </div>

          <button
            onClick={onToggleJam}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              isJamActive
                ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/30'
            }`}
          >
            {isJamActive ? 'Leave Jam' : 'Launch Jam'}
          </button>
        </div>

        {isJamActive && (
          <>
            {/* Room Code */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-white/10">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Invite Room Code
                </span>
                <p className="font-mono text-sm font-bold text-emerald-400 tracking-widest">
                  {roomCode}
                </p>
              </div>

              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Currently Synced Track */}
            {currentTrack && (
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-3">
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400 block">
                    Now Playing in Sync
                  </span>
                  <p className="text-xs font-bold text-white truncate">{currentTrack.title}</p>
                  <p className="text-[11px] text-neutral-400 truncate">{currentTrack.artist}</p>
                </div>
              </div>
            )}

            {/* In-Room Participants */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Listening Together ({participants.length})</span>
                <span className="text-emerald-400 font-mono">0ms latency sync</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]"
                  >
                    <img
                      src={p.avatar}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-neutral-200 truncate">{p.name}</p>
                      <p className="text-[10px] text-neutral-500">{p.isHost ? 'Host' : 'Listener'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Real-time Emoji Reactions Bar */}
            <div className="space-y-2 pt-2 border-t border-white/[0.08]">
              <span className="text-xs font-medium text-neutral-300 block">
                Send Live Emoji Burst to Room
              </span>
              <div className="flex items-center justify-between gap-1 bg-white/[0.04] p-1.5 rounded-xl border border-white/10">
                {reactionEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onSendReaction(emoji)}
                    className="w-10 h-10 rounded-lg hover:bg-white/10 active:scale-125 transition-all text-xl flex items-center justify-center hover:scale-110"
                    title={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
