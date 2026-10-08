import React, { useState } from 'react';
import { X, Copy, Check, Share2, Code, QrCode, ExternalLink } from 'lucide-react';
import { Track, Playlist } from '../../types/music';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  track?: Track | null;
  playlist?: Playlist | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  track,
  playlist,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [showEmbedCode, setShowEmbedCode] = useState(false);

  if (!isOpen) return null;

  const title = track ? track.title : playlist ? playlist.title : 'Flontmie Stream';
  const subtitle = track ? `by ${track.artist}` : playlist ? `Curated by ${playlist.curator}` : 'High-fidelity music streaming';
  const shareUrl = track
    ? `https://flontmie.com/track/${track.id}`
    : playlist
    ? `https://flontmie.com/playlist/${playlist.id}`
    : window.location.href;

  const embedSnippet = `<iframe src="${shareUrl}?embed=true" width="100%" height="152" frameborder="0" allow="autoplay; clipboard-write; encrypted-media"></iframe>`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const handleShareTwitter = () => {
    const text = `Listening to "${title}" on Flontmie! 🎧 Check it out:`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const handleShareWhatsApp = () => {
    const text = `Check out "${title}" on Flontmie: ${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#121214] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-red-500" />
            <h3 className="text-base font-bold text-white">Share with Community</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Item Summary */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-neutral-800">
            {(track?.coverUrl || playlist?.coverUrl) && (
              <img
                src={track?.coverUrl || playlist?.coverUrl}
                alt={title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-white truncate">{title}</h4>
            <p className="text-xs text-neutral-400 truncate">{subtitle}</p>
          </div>
        </div>

        {/* Share Link Copy Field */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-300">Direct Share URL</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2 text-xs font-mono bg-neutral-900 border border-white/10 rounded-lg text-neutral-300 select-all focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                copiedLink
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-black hover:bg-neutral-200'
              }`}
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Social Network Quick Links */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-neutral-300">Social Broadcast</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleShareTwitter}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-white transition-colors"
            >
              <span>Post to X / Twitter</span>
              <ExternalLink className="w-3 h-3 text-neutral-400" />
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-white transition-colors"
            >
              <span>Share on WhatsApp</span>
              <ExternalLink className="w-3 h-3 text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Embed Code Toggle */}
        <div className="border-t border-white/[0.08] pt-4">
          <button
            onClick={() => setShowEmbedCode(!showEmbedCode)}
            className="flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
            <span>{showEmbedCode ? 'Hide HTML Embed Widget' : 'Get HTML Embed Code for Websites'}</span>
          </button>

          {showEmbedCode && (
            <div className="mt-3 space-y-2">
              <textarea
                readOnly
                value={embedSnippet}
                rows={3}
                className="w-full p-2.5 text-[11px] font-mono bg-neutral-900 border border-white/10 rounded-lg text-neutral-300 focus:outline-none"
              />
              <button
                onClick={handleCopyEmbed}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                {copiedEmbed ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedEmbed ? 'Embed snippet copied!' : 'Copy snippet'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
