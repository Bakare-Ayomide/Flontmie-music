import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Globe, 
  ArrowRight, 
  AlertCircle,
  Loader2,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
  Headphones,
  Fingerprint
} from 'lucide-react';
import { Persona } from '../../types/music';
import { api } from '../../services/api';
import { nativePlatform } from '../../services/nativePlatform';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: Persona;
  status?: 'active' | 'suspended' | 'banned';
  display_name: string;
  avatar_url?: string;
  bio?: string;
  country?: string;
  distributor_id?: string | null;
  distributor_name?: string | null;
  label_id?: string | null;
  label_name?: string | null;
  artist_id?: string | null;
  artist_name?: string | null;
  email_verified?: number | boolean;
  must_change_password?: boolean;
  streams_logged?: number;
  liked_track_ids?: string[];
  followed_artist_ids?: string[];
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated?: (user: AuthUser) => void;
  onAuthSuccess?: (user: AuthUser) => void;
  initialMode?: 'login' | 'register' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
  onAuthSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(
    initialMode === 'signup' ? 'register' : initialMode
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [country, setCountry] = useState('US');
  const [resetCode, setResetCode] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Native Biometric / Fingerprint State
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [enableBiometricOnLogin, setEnableBiometricOnLogin] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    (async () => {
      const avail = await nativePlatform.isBiometricAvailable();
      const enrolled = await nativePlatform.isBiometricEnrolled();
      if (mounted) {
        setBiometricAvailable(avail);
        setBiometricEnrolled(enrolled);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBiometricLogin = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const bio = await nativePlatform.authenticateWithBiometrics();
      if (!bio.verified) {
        setError(bio.error || 'Biometric verification cancelled.');
        setLoading(false);
        return;
      }
      await api.hydrateSavedTokens();
      const res = await api.getCurrentUser();
      if (res && res.user) {
        onAuthenticated?.(res.user);
        onAuthSuccess?.(res.user);
        onClose();
      } else {
        setError('Saved session expired. Please sign in with your password once to re-link fingerprint.');
      }
    } catch (err: any) {
      setError(err?.message || 'Biometric sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login(email.trim(), password);
        if (res && res.user) {
          if (enableBiometricOnLogin && biometricAvailable) {
            await nativePlatform.enrollBiometricSession(res.user.email, res.user.display_name || res.user.username);
            setBiometricEnrolled(true);
          }
          onAuthenticated?.(res.user);
          onAuthSuccess?.(res.user);
          onClose();
        }
      } else if (mode === 'register') {
        const cleanUsername =
          username.trim() ||
          email
            .split('@')[0]
            .replace(/[^a-zA-Z0-9_]/g, '')
            .toLowerCase();

        const res = await api.register({
          email: email.trim(),
          username: cleanUsername,
          password,
          display_name: displayName.trim() || cleanUsername,
          country: country.trim().toUpperCase() || 'US',
        });

        if (res && res.user) {
          onAuthenticated?.(res.user);
          onAuthSuccess?.(res.user);
          onClose();
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Verify your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#111115] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-b from-red-950/30 to-transparent">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-red-400 block">
              Flontmie Account
            </span>
            <h2 className="text-xl font-extrabold text-white tracking-tight mt-0.5">
              {mode === 'login'
                ? 'Sign In to Flontmie'
                : mode === 'register'
                ? 'Create Listener Account'
                : 'Reset Account Password'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 p-1 bg-neutral-900 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-black shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-black shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode !== 'reset' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-200">
                    <Headphones className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      New accounts register as a <strong>Music Listener</strong>. Artist, Record Label, and Distributor roles are assigned exclusively by platform administrators.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                        Full Name / Display Name
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Your Name"
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                        Country (ISO Code)
                      </label>
                      <div className="relative">
                        <Globe className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          maxLength={2}
                          value={country}
                          onChange={(e) => setCountry(e.target.value.toUpperCase())}
                          placeholder="US, NG, GB..."
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-neutral-300">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setError(null);
                      }}
                      className="text-[11px] text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-8 pr-9 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2 text-neutral-400 hover:text-white p-0.5 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {mode === 'login' && biometricAvailable && (
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableBiometricOnLogin}
                    onChange={(e) => setEnableBiometricOnLogin(e.target.checked)}
                    className="accent-red-500 w-3.5 h-3.5"
                  />
                  <Fingerprint className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Enable Fingerprint / Biometric unlock on this device</span>
                </label>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-red-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {mode === 'login' ? 'Sign In' : 'Create Listener Account'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {mode === 'login' && biometricAvailable && biometricEnrolled && (
                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Fingerprint className="w-4 h-4 text-emerald-400" />
                  <span>Sign In with Fingerprint / Biometrics</span>
                </button>
              )}
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-neutral-400">
                Enter your registered account email to request a password reset code.
              </p>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Account Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white"
                />
              </div>

              {!resetSent ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!email.trim()) return;
                    setLoading(true);
                    try {
                      await fetch(
                        'https://flontmie.ticketplaster.com/phpbackend/api/auth.php?action=request_password_reset',
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: email.trim() }),
                        }
                      );
                      setResetSent(true);
                      setSuccessMsg('Reset code requested. Enter your 8-character reset code below.');
                    } catch {
                      setError('Could not request password reset.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
                >
                  Send Reset Code
                </button>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="8-Character Reset Code"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white font-mono uppercase"
                  />
                  <input
                    type="password"
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="New Password (min 8 chars)"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setLoading(true);
                      setError(null);
                      try {
                        const resp = await fetch(
                          'https://flontmie.ticketplaster.com/phpbackend/api/auth.php?action=confirm_password_reset',
                          {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              email: email.trim(),
                              code: resetCode.trim(),
                              new_password: newResetPassword,
                            }),
                          }
                        );
                        const d = await resp.json();
                        if (!resp.ok) throw new Error(d.message || 'Reset failed');
                        setSuccessMsg('Password updated! You can now sign in.');
                        setMode('login');
                        setResetSent(false);
                      } catch (e: any) {
                        setError(e.message || 'Invalid code');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                  >
                    Confirm New Password
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setResetSent(false);
                }}
                className="w-full py-2 text-xs text-neutral-400 hover:text-white cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
