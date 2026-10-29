import React, { useEffect } from 'react';
import { ArrowLeft, ShieldCheck, Lock, ExternalLink, Printer } from 'lucide-react';
import { FlontmieGeometricMark } from '../components/auth/FlontmieOnboarding';

interface PrivacyPolicyPageProps {
  onBack: () => void;
  onNavigateToTerms?: () => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({ onBack, onNavigateToTerms }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#070707] text-[#EDECE8] font-sans selection:bg-red-600/30 selection:text-red-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center gap-2 text-sm font-medium"
              aria-label="Back to App"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="h-4 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <FlontmieGeometricMark className="w-5 h-6 text-white" />
              <span className="font-extrabold tracking-tight text-white text-lg">Flontmie</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            {onNavigateToTerms && (
              <button
                type="button"
                onClick={onNavigateToTerms}
                className="text-xs font-semibold text-neutral-300 hover:text-white underline cursor-pointer"
              >
                Terms and Conditions
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Document Header */}
        <div className="border-b border-white/[0.08] pb-6 mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Privacy & Data Protection</span>
            <span>·</span>
            <span>Version 2026.10</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Effective Date: October 29, 2026 · Your privacy and security on Flontmie
          </p>
        </div>

        {/* Content Body */}
        <div className="space-y-8 text-neutral-300 text-[15px] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">01.</span>
              Introduction & Scope
            </h2>
            <p>
              At Flontmie, we respect your personal privacy. This Privacy Policy details the types of personal data we collect, how it is processed and protected, and the choices available to you when using our music streaming platform and native mobile applications.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">02.</span>
              Information We Collect
            </h2>
            <div className="space-y-2">
              <p>We collect only the information necessary to provide an authentic, personalized streaming experience:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-neutral-300">
                <li><strong className="text-white">Account Information:</strong> Email address, username, display name, password hash (one-way bcrypt hashed; plain text passwords are never stored), and country of residence.</li>
                <li><strong className="text-white">Listening Preferences:</strong> Selected favorite music genres, followed artists, created playlists, and track likes.</li>
                <li><strong className="text-white">Playback & History Telemetry:</strong> Playback timestamps, duration streamed, and offline cache status, used to calculate authentic royalties and genuine artist stream counts.</li>
                <li><strong className="text-white">Device & Network Data:</strong> IP address, device platform (Android native or Web browser), and network connectivity state (online/offline) to enable smooth offline listening.</li>
                <li><strong className="text-white">Biometric Credentials:</strong> When biometric authentication (Fingerprint / Face ID) is enabled on native Android, authentication is handled locally by the Android biometric hardware Keystore. Flontmie servers never receive or store your raw biometric data.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">03.</span>
              How We Use Your Information
            </h2>
            <p>
              We process your personal data strictly for legitimate operational purposes:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-neutral-300">
              <li>Delivering personalized genre recommendations, discover queues, and artist updates.</li>
              <li>Maintaining persistent sessions across web and Android devices without unexpected logouts.</li>
              <li>Calculating real-time stream counts and likes directly within our production MySQL database.</li>
              <li>Preventing unauthorized scraping, bot streaming, and malicious intrusion.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">04.</span>
              Zero-Ad-Broker Policy & Data Sharing
            </h2>
            <p className="bg-white/[0.04] p-4 rounded-xl border border-white/[0.08] text-white">
              <strong>Strict Guarantee:</strong> Flontmie does NOT sell, lease, rent, or trade your personal information, listening history, or email address to third-party data brokers, advertising networks, or external aggregators under any circumstances.
            </p>
            <p>
              We share data only with authorized infrastructure services directly necessary for platform hosting (our secure web and database servers located at ticketplaster.com) and as required by law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">05.</span>
              Data Retention & Security Safeguards
            </h2>
            <p>
              Your data is stored in our protected relational database with encrypted connections (SSL/TLS). Session tokens utilize cryptographic HS256 signatures with automated expiry and CSRF protection.
            </p>
            <p>
              We retain account data for as long as your account remains active. If you choose to delete your account, your profile data, personal playlists, and authentication tokens will be permanently removed.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">06.</span>
              Your Rights & Account Controls
            </h2>
            <p>
              Depending on your location, you may have statutory rights regarding your personal information, including:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-neutral-300">
              <li>The right to access and export your account data and listening history.</li>
              <li>The right to update or correct your profile details, country, or music preferences at any time.</li>
              <li>The right to request the permanent deletion of your account and associated records.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">07.</span>
              Contact Our Privacy Team
            </h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or your data protection rights, please contact our administrator directly:
            </p>
            <p className="text-white font-medium">
              Flontmie Data Governance & Privacy Office<br />
              Email: <a href="mailto:earr.music@gmail.com" className="text-white underline font-semibold">earr.music@gmail.com</a>
            </p>
          </section>
        </div>

        {/* Bottom Actions */}
        <div className="mt-12 pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Back to Music
          </button>
          {onNavigateToTerms && (
            <button
              type="button"
              onClick={onNavigateToTerms}
              className="text-sm font-medium text-neutral-400 hover:text-white underline cursor-pointer"
            >
              Read Flontmie Terms and Conditions →
            </button>
          )}
        </div>
      </main>
    </div>
  );
};
