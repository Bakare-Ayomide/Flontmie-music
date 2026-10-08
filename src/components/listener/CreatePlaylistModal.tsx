import React, { useState } from 'react';
import { X, ListMusic, Sparkles } from 'lucide-react';
import { MoodCategory, Playlist } from '../../types/music';
import { IMAGES } from '../../data/mockCatalog';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (playlist: Partial<Playlist>) => void;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MoodCategory>('energize');
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [coverType, setCoverType] = useState<keyof typeof IMAGES>('synthwave');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onCreate({
      title: title.trim(),
      description: description.trim() || 'Curated community playlist on Flontmie.',
      coverUrl: IMAGES[coverType] || IMAGES.synthwave,
      curator: 'You',
      isPublic: true,
      isCollaborative,
      collaborators: isCollaborative ? ['You', 'Invitees'] : undefined,
      trackIds: ['track-1', 'track-2'],
      followers: 1,
      category,
    });

    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#121215] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-red-500" />
            <h3 className="text-base font-bold text-white">Curate New Playlist</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-medium text-neutral-300">Playlist Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Midnight Highway Reverie"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white placeholder-neutral-500"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-neutral-300">Description</label>
            <textarea
              rows={2}
              placeholder="What vibe or concept does this collection capture?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white placeholder-neutral-500 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-neutral-300">Mood Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MoodCategory)}
              className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white"
            >
              <option value="energize">Energize</option>
              <option value="relax">Relax</option>
              <option value="focus">Focus</option>
              <option value="workout">Workout</option>
              <option value="party">Party</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-medium text-neutral-300">Curated Artwork Theme</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(IMAGES) as (keyof typeof IMAGES)[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCoverType(key)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    coverType === key ? 'border-red-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={IMAGES[key]}
                    alt={key}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="collab"
              checked={isCollaborative}
              onChange={(e) => setIsCollaborative(e.target.checked)}
              className="accent-red-500 rounded"
            />
            <label htmlFor="collab" className="text-neutral-300">
              Enable collaborative curation (friends can add songs)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-white text-black font-semibold rounded-lg hover:bg-neutral-200 transition-colors"
            >
              Save & Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
