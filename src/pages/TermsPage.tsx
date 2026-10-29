import React, { useEffect } from 'react';
import { ArrowLeft, Shield, FileText, ExternalLink, Printer } from 'lucide-react';
import { FlontmieGeometricMark } from '../components/auth/FlontmieOnboarding';

interface TermsPageProps {
  onBack: () => void;
  onNavigateToPrivacy?: () => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onBack, onNavigateToPrivacy }) => {
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
            {onNavigateToPrivacy && (
              <button
                type="button"
                onClick={onNavigateToPrivacy}
                className="text-xs font-semibold text-neutral-300 hover:text-white underline cursor-pointer"
              >
                Privacy Policy
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
            <FileText className="w-4 h-4 text-neutral-300" />
            <span>Legal Documentation</span>
            <span>·</span>
            <span>Version 2026.10</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Terms and Conditions
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Effective Date: October 29, 2026 · Governing all access to Flontmie Music Streaming & Services
          </p>
        </div>

        {/* Content Body */}
        <div className="space-y-8 text-neutral-300 text-[15px] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">01.</span>
              Acceptance of Terms
            </h2>
            <p>
              Welcome to Flontmie ("we", "us", or "our"). By registering, accessing, downloading, or using the Flontmie web platform, native mobile application, API, or related services (collectively, the "Service"), you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you must not use or access the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">02.</span>
              User Eligibility & Listener Accounts
            </h2>
            <p>
              To create an account and access the streaming catalog, you must be at least 13 years of age (or the applicable minimum legal age in your jurisdiction). By registering, you warrant that all information provided—including email address, name, and country of residence—is accurate, current, and complete.
            </p>
            <p>
              You are solely responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use or security compromise.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">03.</span>
              Intellectual Property & Authorized Catalog Media
            </h2>
            <p>
              Flontmie strictly delivers licensed and authorized musical sound recordings, synchronized lyrics, audio-visual compositions, album art, and artist profiles uploaded and managed by authorized distributors, record labels, and administrators.
            </p>
            <p>
              All trademarks, trade dress, service marks, logo designs, and brand elements (including the geometric Flontmie mark and "Every Beat Tells Your Story." tagline) are the exclusive property of Flontmie. You may not reproduce, decompile, redistribute, rip, or create derivative works from the media files made available on the platform without express written authorization.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">04.</span>
              Offline Listening & Native Storage
            </h2>
            <p>
              When using the Flontmie native Android application, you may be granted permission to download authorized musical tracks to encrypted local device storage for temporary offline listening. Downloaded tracks remain the licensed property of their respective copyright owners and are authorized solely for playback within the Flontmie application. Offline tracks cannot be exported, extracted, or transferred outside the application container.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">05.</span>
              User Conduct, Comments & Community Standards
            </h2>
            <p>
              Users may interact with tracks by liking, curating personal playlists, and posting comments. You agree that your comments will not contain unlawful, harassing, defamatory, fraudulent, or abusive material, nor promote violence or infringement of any intellectual property.
            </p>
            <p>
              Flontmie reserves the right, at its sole discretion, to remove any user content, delete comments, reset likes, or suspend accounts that violate community safety or security protocols.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">06.</span>
              Streaming Telemetry & Authentic Counts
            </h2>
            <p>
              Flontmie employs cryptographic and server-authoritative mechanisms to calculate real stream counts, authentic likes, and user play history. Any attempt to artificially manipulate stream metrics through automated bots, scrapers, headless emulators, or spoofed sessions constitutes a material breach of these Terms and will result in immediate permanent account termination.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">07.</span>
              Disclaimer of Warranties & Limitation of Liability
            </h2>
            <p>
              The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied. Flontmie does not warrant that playback will be uninterrupted, error-free, or compatible with all hardware and operating systems.
            </p>
            <p>
              To the fullest extent permitted by applicable law, Flontmie and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your access to or inability to access the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-neutral-500 font-mono text-sm">08.</span>
              Modifications, Governing Law & Contact
            </h2>
            <p>
              We reserve the right to revise these Terms at any time. When updates occur, the updated document version and effective date will be published on this page. Continued use of Flontmie following notice of revisions constitutes binding acceptance.
            </p>
            <p>
              If you have any questions or legal inquiries regarding these Terms, please reach out to us at{' '}
              <a href="mailto:earr.music@gmail.com" className="text-white font-semibold underline">
                earr.music@gmail.com
              </a>.
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
          {onNavigateToPrivacy && (
            <button
              type="button"
              onClick={onNavigateToPrivacy}
              className="text-sm font-medium text-neutral-400 hover:text-white underline cursor-pointer"
            >
              Read Flontmie Privacy Policy →
            </button>
          )}
        </div>
      </main>
    </div>
  );
};
