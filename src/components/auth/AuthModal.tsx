import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Globe, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  ArrowRight, 
  Sparkles, 
  LogIn, 
  UserPlus, 
  Headphones, 
  Mic2, 
  Building2, 
  Network,
  KeyRound
} from 'lucide-react';
import { Persona } from '../../types/music';
import { api } from '../../services/api';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: Persona;
  display_name: string;
  avatar_url?: string;
  country?: string;
  distributor_id?: string;
  label_id?: string;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: AuthUser, token: string) => void;
  initialMode?: 'login' | 'signup';
}

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria 🇳🇬' },
  { code: 'GH', name: 'Ghana 🇬🇭' },
  { code: 'ZA', name: 'South Africa 🇿🇦' },
  { code: 'KE', name: 'Kenya 🇰🇪' },
  { code: 'US', name: 'United States 🇺🇸' },
  { code: 'GB', name: 'United Kingdom 🇬🇧' },
  { code: 'CA', name: 'Canada 🇨🇦' },
  { code: 'FR', name: 'France 🇫🇷' },
  { code: 'DE', name: 'Germany 🇩🇪' },
  { code: 'BR', name: 'Brazil 🇧🇷' },
  { code: 'JM', name: 'Jamaica 🇯🇲' }
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup Form State
  const [signupName, setSignupName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupRole, setSignupRole] = useState<Persona>('listener');
  const [signupCountry, setSignupCountry] = useState('US');
  const [agreeTerms, setAgreeTerms] = useState(true);

  if (!isOpen) return null;

  const handleQuickLogin = (email: string, pass: string, roleName: string) => {
    setMode('login');
    setLoginIdentifier(email);
    setLoginPassword(pass);
    setError(null);
    setSuccessMsg(`Loaded credentials for ${roleName}. Click Log In below.`);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!loginIdentifier.trim() || !loginPassword) {
      setError('Please provide your email/username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(loginIdentifier.trim(), loginPassword);
      if (res && res.user && res.token) {
        setSuccessMsg('Authentication successful! Welcome to Flontmie.');
        setTimeout(() => {
          onAuthSuccess(res.user, res.token);
          onClose();
        }, 500);
      } else {
        setError('Login failed: Invalid credentials received.');
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || 'Authentication error. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!signupName.trim()) {
      setError('Please provide your display name.');
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!signupPassword || signupPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreeTerms) {
      setError('You must agree to the Terms of Service to create an account.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/phpbackend/api/auth.php?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupName.trim(),
          username: signupUsername.trim() || signupEmail.split('@')[0],
          email: signupEmail.trim(),
          password: signupPassword,
          role: signupRole,
          country: signupCountry
        })
      });

      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Registration failed.');
      }

      setSuccessMsg('Account created successfully!');
      api.setToken(data.token);
      setTimeout(() => {
        onAuthSuccess(data.user, data.token);
        onClose();
      }, 600);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || 'Registration error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-[#0e0e12] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Accent */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-purple-600" />

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wider text-white uppercase font-sans">
                FLONTMIE
              </h2>
              <p className="text-[11px] text-neutral-400 font-medium">
                {mode === 'login' ? 'Sign in to your account' : 'Join the next-gen music network'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Mode Switcher */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 p-1 bg-white/[0.04] border border-white/10 rounded-xl">
            <button
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
            <button
              onClick={() => {
                setMode('signup');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'signup'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>
        </div>

        {/* Alert Notifications */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <p className="flex-1">{successMsg}</p>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {mode === 'login' ? (
            /* --- LOGIN FORM --- */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Email or Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. admin@flontmie.com or alex"
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-neutral-900/90 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setSuccessMsg('For demo/test access, use password: @f33rinimi')}
                    className="text-[11px] text-red-400 hover:text-red-300 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-neutral-900/90 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-400 select-none">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-white/20 bg-neutral-900 text-red-600 focus:ring-0"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Flontmie</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Quick-Fill Demo Bar */}
              <div className="pt-4 border-t border-white/[0.06]">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>One-Click Demo Roles</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('admin@flontmie.com', '@f33rinimi', 'Admin')}
                    className="px-2 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-left text-[11px] text-neutral-300 flex items-center gap-1.5 transition-colors"
                  >
                    <ShieldCheck className="w-3 h-3 text-amber-400" />
                    <span>Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('distributor@flontmie.com', '@f33rinimi', 'Distributor')}
                    className="px-2 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-left text-[11px] text-neutral-300 flex items-center gap-1.5 transition-colors"
                  >
                    <Network className="w-3 h-3 text-purple-400" />
                    <span>Distributor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('label@flontmie.com', '@f33rinimi', 'Record Label')}
                    className="px-2 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-left text-[11px] text-neutral-300 flex items-center gap-1.5 transition-colors"
                  >
                    <Building2 className="w-3 h-3 text-blue-400" />
                    <span>Label</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('artist@flontmie.com', '@f33rinimi', 'Artist')}
                    className="px-2 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-left text-[11px] text-neutral-300 flex items-center gap-1.5 transition-colors"
                  >
                    <Mic2 className="w-3 h-3 text-red-400" />
                    <span>Artist</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('listener@flontmie.com', '@f33rinimi', 'Listener')}
                    className="px-2 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-left text-[11px] text-neutral-300 flex items-center gap-1.5 transition-colors col-span-2 sm:col-span-1"
                  >
                    <Headphones className="w-3 h-3 text-emerald-400" />
                    <span>Listener</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* --- SIGN UP FORM --- */
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                    <input
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="e.g. Amara Sterling"
                      required
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. amaravibes"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Password (min 6 chars)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Account Type & Portal Access
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'listener', label: 'Music Listener', desc: 'Stream, discover, curate', icon: <Headphones className="w-3.5 h-3.5 text-emerald-400" /> },
                    { id: 'artist', label: 'Artist / Creator', desc: 'Upload songs, manage profile', icon: <Mic2 className="w-3.5 h-3.5 text-red-400" /> },
                    { id: 'label', label: 'Record Label', desc: 'Manage artist roster & catalog', icon: <Building2 className="w-3.5 h-3.5 text-blue-400" /> },
                    { id: 'distributor', label: 'Music Distributor', desc: 'Direct upload & ingestion', icon: <Network className="w-3.5 h-3.5 text-purple-400" /> },
                  ].map((r) => {
                    const isSelected = signupRole === r.id;
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => setSignupRole(r.id as Persona)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-red-600/15 border-red-500 text-white shadow-md'
                            : 'bg-neutral-900/60 border-white/10 text-neutral-400 hover:text-white hover:bg-neutral-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          {r.icon}
                          <span className="text-xs font-bold text-white">{r.label}</span>
                        </div>
                        <p className="text-[10px] text-neutral-400">{r.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Country Selection */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Country / Region
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                  <select
                    value={signupCountry}
                    onChange={(e) => setSignupCountry(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-neutral-900 text-white">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Terms Checkbox */}
              <label className="flex items-start gap-2 cursor-pointer text-[11px] text-neutral-400 pt-1 select-none">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 bg-neutral-900 text-red-600 focus:ring-0"
                />
                <span>
                  I agree to the Flontmie Terms of Service, Creator Code of Conduct, and Privacy Policy.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating Flontmie Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Free Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
