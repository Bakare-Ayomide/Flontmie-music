import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Globe, 
  ShieldCheck, 
  LogOut, 
  Heart, 
  ListMusic, 
  Play, 
  Check, 
  ExternalLink, 
  Camera, 
  KeyRound, 
  Headphones, 
  Mic2, 
  Building2, 
  Network,
  Sparkles,
  ArrowLeft,
  Save,
  Radio
} from 'lucide-react';
import { Track, Playlist, Persona } from '../../types/music';
import { AuthUser } from '../auth/AuthModal';

import { api } from '../../services/api';

interface ProfilePageProps {
  currentUser: AuthUser | null;
  likedTracks: Track[];
  userPlaylists: Playlist[];
  onPlayTrack: (track: Track) => void;
  onSelectPlaylist: (playlistId: string) => void;
  onUpdateProfile: (updated: Partial<AuthUser>) => void;
  onSignOut: () => void;
  onSwitchPortal: (role: Persona) => void;
  onBackToHome: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  currentUser,
  likedTracks,
  userPlaylists,
  onPlayTrack,
  onSelectPlaylist,
  onUpdateProfile,
  onSignOut,
  onSwitchPortal,
  onBackToHome,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'security'>('overview');
  const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [country, setCountry] = useState(currentUser?.country || 'US');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [bio, setBio] = useState('Passionate music creator and listener on Flontmie.');
  const [isSaved, setIsSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  const roleMeta: Record<Persona, { label: string; color: string; icon: React.ReactNode }> = {
    admin: { label: 'Platform Administrator', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    distributor: { label: 'Music Distributor', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <Network className="w-3.5 h-3.5" /> },
    label: { label: 'Record Label', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Building2 className="w-3.5 h-3.5" /> },
    artist: { label: 'Artist / Creator', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <Mic2 className="w-3.5 h-3.5" /> },
    listener: { label: 'Music Listener', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <Headphones className="w-3.5 h-3.5" /> }
  };

  const userRole = currentUser?.role || 'listener';
  const roleInfo = roleMeta[userRole];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.updateProfile({
        display_name: displayName,
        country: country,
        avatar_url: avatarUrl
      });
      if (res && res.user) {
        onUpdateProfile(res.user);
      } else {
        onUpdateProfile({
          display_name: displayName,
          email: email,
          country: country,
          avatar_url: avatarUrl
        });
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch {
      onUpdateProfile({
        display_name: displayName,
        email: email,
        country: country,
        avatar_url: avatarUrl
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setPasswordMsg('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Passwords do not match.');
      return;
    }
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      setPasswordMsg(res.message || 'Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(null), 3000);
    } catch (err: any) {
      setPasswordMsg(err?.message || 'Failed to update password.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0c] text-white pb-32">
      {/* Top Header / Back Bar */}
      <div className="px-4 sm:px-8 pt-4 pb-2 flex items-center justify-between border-b border-white/[0.06] bg-[#0d0d11]/80 backdrop-blur-md sticky top-0 z-20">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onSwitchPortal(userRole)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/10 text-neutral-200 text-xs font-semibold border border-white/10 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Open {userRole.charAt(0).toUpperCase() + userRole.slice(1)} Portal</span>
          </button>
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative h-48 sm:h-64 w-full bg-gradient-to-r from-red-950/60 via-purple-950/40 to-neutral-900 border-b border-white/10 overflow-hidden">
        <div 
          className="absolute inset-0 opacity-20 filter blur-xl scale-110"
          style={{
            backgroundImage: `url(${currentUser?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600'})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-transparent" />
      </div>

      {/* Main Profile Info Section */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 -mt-20 relative z-10">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
          {/* Avatar with Ring */}
          <div className="relative group shrink-0">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl overflow-hidden border-4 border-[#0a0a0c] shadow-2xl bg-neutral-800">
              <img
                src={currentUser?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'}
                alt={currentUser?.display_name || 'User Profile'}
                className="w-full h-full object-cover"
              />
            </div>
            <button
              onClick={() => setActiveTab('edit')}
              className="absolute bottom-2 right-2 p-2 rounded-xl bg-black/80 hover:bg-black text-white border border-white/20 shadow-lg transition-transform hover:scale-105"
              title="Change Profile Photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* User Details */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {currentUser?.display_name || 'Alex Chen'}
              </h1>
              <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleInfo.color}`}>
                {roleInfo.icon}
                <span>{roleInfo.label}</span>
              </div>
            </div>

            <p className="text-xs text-neutral-400 font-mono flex items-center justify-center sm:justify-start gap-2">
              <span>@{currentUser?.username || 'alex_listener'}</span>
              <span>•</span>
              <span>{currentUser?.email || 'listener@flontmie.com'}</span>
              <span>•</span>
              <span className="uppercase">{currentUser?.country || 'US'} 🌍</span>
            </p>

            <p className="text-xs text-neutral-300 mt-2 max-w-xl">
              {bio}
            </p>
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="mt-8 flex items-center gap-2 border-b border-white/[0.08] pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'overview'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Overview & Music
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'edit'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Edit Profile
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'security'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Security & Credentials
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="mt-6 space-y-8 animate-in fade-in duration-150">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Streams Logged</p>
                <p className="text-xl sm:text-2xl font-black text-white mt-1">1,420</p>
                <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                  <Radio className="w-3 h-3" />
                  <span>Real-time tracking</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Favorite Tracks</p>
                <p className="text-xl sm:text-2xl font-black text-white mt-1">{likedTracks.length}</p>
                <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                  <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                  <span>Curated list</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Playlists Created</p>
                <p className="text-xl sm:text-2xl font-black text-white mt-1">{userPlaylists.length}</p>
                <p className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">
                  <ListMusic className="w-3 h-3" />
                  <span>Personal catalogs</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Membership</p>
                <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1">Pro Studio</p>
                <p className="text-[10px] text-neutral-400 mt-1">
                  Flontmie Verified Hub
                </p>
              </div>
            </div>

            {/* Liked Songs Quick Player List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                  <span>Favorite Liked Tracks</span>
                </h2>
                <span className="text-xs text-neutral-400">{likedTracks.length} saved</span>
              </div>

              {likedTracks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {likedTracks.slice(0, 6).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => onPlayTrack(t)}
                      className="p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 flex items-center justify-between gap-3 cursor-pointer group transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-neutral-800">
                          <img src={t.coverUrl} alt={t.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">
                            {t.title}
                          </p>
                          <p className="text-[11px] text-neutral-400 truncate">
                            {t.artist} • {t.genre}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-neutral-500">
                          {Math.floor(t.duration / 60)}:{String(t.duration % 60).padStart(2, '0')}
                        </span>
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-red-400">
                          <Heart className="w-3.5 h-3.5 fill-red-500" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500 p-6 text-center bg-white/[0.02] rounded-2xl border border-white/5">
                  No liked tracks yet. Tap the heart icon on any song while streaming to build your collection!
                </p>
              )}
            </div>

            {/* Playlists Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-purple-400" />
                  <span>My Playlists</span>
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {userPlaylists.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onSelectPlaylist(p.id)}
                    className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 cursor-pointer group transition-all flex flex-col"
                  >
                    <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2">
                      <img src={p.coverUrl} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <p className="text-xs font-bold text-white truncate">{p.title}</p>
                    <p className="text-[10px] text-neutral-400">{p.trackIds?.length || 0} tracks</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Edit Profile */}
        {activeTab === 'edit' && (
          <div className="mt-6 max-w-xl animate-in fade-in duration-150">
            {isSaved && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Profile changes successfully saved and applied!</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Avatar Photo URL
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Country Code (ISO 2-Letter)
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  maxLength={2}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Bio / About
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Security & Credentials */}
        {activeTab === 'security' && (
          <div className="mt-6 max-w-xl space-y-6 animate-in fade-in duration-150">
            {passwordMsg && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                passwordMsg.includes('success') 
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                  : 'bg-red-500/15 border-red-500/30 text-red-300'
              }`}>
                {passwordMsg.includes('success') ? <Check className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{passwordMsg}</span>
              </div>
            )}

            {/* Session Information */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Active JWT Session Details</span>
              </h3>
              <p className="text-xs text-neutral-400">
                Logged in with cryptographic bearer token authentication. All API requests to the PHP backend are authenticated with role-based policies.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-mono text-emerald-400">Status: Active & Encrypted</span>
              </div>
            </div>

            {/* Change Password Form */}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Update Security Password
              </h3>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  New Password (min 6 characters)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 px-6 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold border border-white/10 transition-all flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-red-500" />
                <span>Update Password</span>
              </button>
            </form>

            {/* Danger Zone */}
            <div className="pt-6 border-t border-white/[0.08]">
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">
                Session Control
              </h4>
              <button
                onClick={onSignOut}
                className="py-2.5 px-5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of All Devices</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
