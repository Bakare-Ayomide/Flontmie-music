import React, { useState, useEffect } from 'react';
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
  LogIn, 
  UserPlus, 
  Headphones, 
  Mic2, 
  Building2, 
  Network,
  KeyRound,
  RefreshCw
} from 'lucide-react';
import { Persona } from '../../types/music';
import { api } from '../../services/api';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: Persona;
  status?: 'active' | 'suspended' | 'banned';
  display_name: string;
  avatar_url?: string;
  country?: string;
  distributor_id?: string;
  label_id?: string;
  email_verified?: boolean;
  must_change_password?: boolean;
  csrf_token?: string;
  session_id?: string;
}

type AuthModalView = 'login' | 'signup' | 'verify_email' | 'forgot_password' | 'reset_password' | 'force_change_password';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: AuthUser, token: string) => void;
  initialMode?: 'login' | 'signup';
  forcePasswordChangeUser?: AuthUser | null;
}

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria' },
  { code: 'GH', name: 'Ghana' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KE', name: 'Kenya' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'BR', name: 'Brazil' },
  { code: 'JM', name: 'Jamaica' }
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'login',
  forcePasswordChangeUser = null,
}) => {
  const [view, setView] = useState<AuthModalView>(forcePasswordChangeUser ? 'force_change_password' : initialMode);
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

  // Email Verification & Password Reset State
  const [targetEmail, setTargetEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  // Mandatory First-Login Password Change State
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(forcePasswordChangeUser);
  const [pendingToken, setPendingToken] = useState<string>('');
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmNewPassInput, setConfirmNewPassInput] = useState('');

  useEffect(() => {
    if (forcePasswordChangeUser) {
      setPendingUser(forcePasswordChangeUser);
      setView('force_change_password');
    } else {
      setView(initialMode);
    }
    setError(null);
    setSuccessMsg(null);
  }, [initialMode, forcePasswordChangeUser, isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!loginIdentifier.trim() || !loginPassword) {
      setError('Please enter your email or username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(loginIdentifier.trim(), loginPassword);
      if (res && res.user && res.token) {
        setSuccessMsg('Signed in successfully.');
        setTimeout(() => {
          onAuthSuccess({ ...res.user, must_change_password: false }, res.token);
          onClose();
        }, 300);
      } else {
        setError('Authentication failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid email/username or password.');
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
      const res = await api.register({
        name: signupName.trim(),
        username: signupUsername.trim() || signupEmail.split('@')[0],
        email: signupEmail.trim(),
        password: signupPassword,
        role: signupRole,
        country: signupCountry
      });

      if (res && res.user && res.token) {
        setTargetEmail(signupEmail.trim());
        setSuccessMsg('Account created! A verification code has also been dispatched to your email.');
        setTimeout(() => {
          onAuthSuccess(res.user, res.token);
          onClose();
        }, 400);
      }
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (!targetEmail.trim() || !verificationCode.trim()) {
      setError('Please enter your email and 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.verifyEmail(targetEmail.trim(), verificationCode.trim());
      setSuccessMsg(res.message || 'Email verified! You can now sign in.');
      setTimeout(() => setView('login'), 1000);
    } catch (err: any) {
      setError(err?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!targetEmail.trim()) {
      setError('Please enter your email address first.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.resendVerification(targetEmail.trim());
      setSuccessMsg(res.message || 'Verification code sent.');
    } catch (err: any) {
      setError(err?.message || 'Could not resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (!targetEmail.trim()) {
      setError('Please enter your registered email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.forgotPassword(targetEmail.trim());
      setSuccessMsg(res.message || 'Password reset code sent to your email.');
      setView('reset_password');
    } catch (err: any) {
      setError(err?.message || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (!targetEmail.trim() || !verificationCode.trim() || resetNewPassword.length < 6) {
      setError('Please provide your email, 6-digit reset code, and a new password (min 6 characters).');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.resetPassword(targetEmail.trim(), verificationCode.trim(), resetNewPassword);
      setSuccessMsg(res.message || 'Password reset complete! Please log in.');
      setVerificationCode('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setTimeout(() => setView('login'), 1000);
    } catch (err: any) {
      setError(err?.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForceChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (newPassInput.length < 8) {
      setError('Your new password must be at least 8 characters long.');
      return;
    }
    if (newPassInput !== confirmNewPassInput) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(currentPassInput, newPassInput);
      const updatedUser: AuthUser = {
        ...(pendingUser as AuthUser),
        must_change_password: false
      };
      setSuccessMsg('Password updated! Completing sign-in...');
      setTimeout(() => {
        onAuthSuccess(updatedUser, pendingToken || api.getToken() || '');
        onClose();
      }, 400);
    } catch (err: any) {
      setError(err?.message || 'Failed to update password.');
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
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-purple-600" />

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wider text-white uppercase font-sans">
                SOUNDPULSE
              </h2>
              <p className="text-[11px] text-neutral-400 font-medium">
                {view === 'login' && 'Sign in to your account'}
                {view === 'signup' && 'Create a new account'}
                {view === 'verify_email' && 'Verify your email address'}
                {view === 'forgot_password' && 'Recover your account password'}
                {view === 'reset_password' && 'Enter reset code & new password'}
                {view === 'force_change_password' && 'Mandatory First-Login Password Update'}
              </p>
            </div>
          </div>

          {view !== 'force_change_password' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Segmented Mode Switcher (Only for login/signup) */}
        {(view === 'login' || view === 'signup') && (
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 p-1 bg-white/[0.04] border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  view === 'login'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('signup');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  view === 'signup'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create Account</span>
              </button>
            </div>
          </div>
        )}

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
          {view === 'login' && (
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
                    placeholder="you@example.com or username"
                    required
                    autoComplete="username"
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
                    onClick={() => {
                      setTargetEmail(loginIdentifier.includes('@') ? loginIdentifier : '');
                      setError(null);
                      setSuccessMsg(null);
                      setView('forgot_password');
                    }}
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
                    autoComplete="current-password"
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

                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMsg(null);
                    setView('verify_email');
                  }}
                  className="text-[11px] text-neutral-400 hover:text-white underline"
                >
                  Verify Email Code
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {view === 'signup' && (
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
                      placeholder="Your full name or stage name"
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
                    placeholder="handle"
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

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'listener', label: 'Music Listener', desc: 'Stream, discover, curate', icon: <Headphones className="w-3.5 h-3.5 text-emerald-400" /> },
                    { id: 'artist', label: 'Artist / Creator', desc: 'Upload songs, manage profile', icon: <Mic2 className="w-3.5 h-3.5 text-red-400" /> },
                    { id: 'label', label: 'Record Label', desc: 'Manage artist roster & releases', icon: <Building2 className="w-3.5 h-3.5 text-blue-400" /> },
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

              <label className="flex items-start gap-2 cursor-pointer text-[11px] text-neutral-400 pt-1 select-none">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 bg-neutral-900 text-red-600 focus:ring-0"
                />
                <span>
                  I agree to the Terms of Service, Creator Code of Conduct, and Privacy Policy.
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
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {view === 'verify_email' && (
            <form onSubmit={handleVerifyEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Account Email Address
                </label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleResendCode}
                  className="text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resend Verification Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="text-neutral-400 hover:text-white"
                >
                  Back to Login
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-all"
              >
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>
            </form>
          )}

          {view === 'forgot_password' && (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <p className="text-xs text-neutral-400">
                Enter the email address associated with your account to receive a 6-digit password reset code.
              </p>
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setView('reset_password')}
                  className="text-red-400 hover:text-red-300"
                >
                  Already have a reset code?
                </button>
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="text-neutral-400 hover:text-white"
                >
                  Back to Login
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-all"
              >
                {loading ? 'Sending Reset Code...' : 'Send Password Reset Code'}
              </button>
            </form>
          )}

          {view === 'reset_password' && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  6-Digit Reset Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  New Password (min 6 chars)
                </label>
                <input
                  type="password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="text-xs text-neutral-400 hover:text-white"
                >
                  Back to Login
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-all"
              >
                {loading ? 'Resetting Password...' : 'Confirm Password Reset'}
              </button>
            </form>
          )}

          {view === 'force_change_password' && (
            <form onSubmit={handleForceChangePasswordSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">First-Login Security Policy</p>
                  <p className="text-[11px] text-amber-300/90 mt-0.5">
                    Your account ({pendingUser?.email}) requires a password change on first login before accessing protected workspaces.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassInput}
                  onChange={(e) => setCurrentPassInput(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  placeholder="Enter new strong password"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmNewPassInput}
                  onChange={(e) => setConfirmNewPassInput(e.target.value)}
                  placeholder="Confirm new strong password"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider transition-all"
              >
                {loading ? 'Updating Security Credentials...' : 'Save New Password & Continue'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
