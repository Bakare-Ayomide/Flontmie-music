import { PlayerTabMode } from '../types/music';
import { nativePlatform } from './nativePlatform';

// Unified Single-Controller Audio & Video Playback Engine
// Guarantees zero duplicate playback, zero echo, shared playback position, consistent volume control,
// offline local file playback, and Android/Web lock-screen + background MediaSession controls.

export interface MediaSessionMetadataInput {
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isPlaying: boolean = false;
  private userVolume: number = 0.8;
  private isMuted: boolean = false;
  private audioElement: HTMLAudioElement | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private mediaElementSource: MediaElementAudioSourceNode | null = null;
  private currentAudioUrl: string | null = null;
  private currentVideoUrl: string | null = null;
  private currentTrackId: string | null = null;
  private activeMode: PlayerTabMode = 'audio';
  private pendingSeekTime: number | null = null;
  private audioError: boolean = false;
  private videoError: boolean = false;
  private isPlayingOfflineSource: boolean = false;

  private onEndedCallback: (() => void) | null = null;
  private onTimeUpdateCallback: ((currentTime: number, duration: number) => void) | null = null;
  private onNextTrackCallback: (() => void) | null = null;
  private onPrevTrackCallback: (() => void) | null = null;
  private onMediaStateChangeCallback: ((state: {
    isPlaying: boolean;
    audioError: boolean;
    videoError: boolean;
    activeMode: PlayerTabMode;
    isOfflineSource?: boolean;
  }) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';
      this.audioElement.preload = 'metadata';
      this.audioElement.volume = this.userVolume;

      this.audioElement.addEventListener('ended', () => {
        if (!this.isVideoElementActive()) {
          this.isPlaying = false;
          this.updateMediaSessionPlaybackState();
          this.notifyMediaState();
          if (this.onEndedCallback) this.onEndedCallback();
        }
      });

      this.audioElement.addEventListener('timeupdate', () => {
        if (!this.isVideoElementActive() && this.onTimeUpdateCallback && this.audioElement) {
          const cur = this.pendingSeekTime !== null ? this.pendingSeekTime : this.audioElement.currentTime;
          const dur =
            Number.isFinite(this.audioElement.duration) && this.audioElement.duration > 0
              ? this.audioElement.duration
              : 0;
          this.onTimeUpdateCallback(cur, dur);
          this.updateMediaSessionPosition(cur, dur);
        }
      });

      this.audioElement.addEventListener('loadedmetadata', () => {
        if (!this.isVideoElementActive() && this.audioElement) {
          if (this.pendingSeekTime !== null && this.pendingSeekTime > 0) {
            const target =
              this.audioElement.duration > 0
                ? Math.min(this.pendingSeekTime, Math.max(0, this.audioElement.duration - 0.25))
                : this.pendingSeekTime;
            try {
              this.audioElement.currentTime = target;
            } catch {}
            this.pendingSeekTime = null;
          }
          if (this.onTimeUpdateCallback && this.audioElement.duration > 0) {
            this.onTimeUpdateCallback(this.audioElement.currentTime, this.audioElement.duration);
            this.updateMediaSessionPosition(this.audioElement.currentTime, this.audioElement.duration);
          }
        }
      });

      this.audioElement.addEventListener('error', () => {
        if (this.currentAudioUrl && this.currentTrackId) {
          // If online URL failed, attempt automatic fallback to downloaded offline track if available
          nativePlatform.getOfflinePlaybackUrl(this.currentTrackId).then((offlineUrl) => {
            if (offlineUrl && offlineUrl !== this.currentAudioUrl && this.audioElement) {
              this.currentAudioUrl = offlineUrl;
              this.isPlayingOfflineSource = true;
              this.audioError = false;
              this.audioElement.removeAttribute('crossorigin');
              this.audioElement.src = offlineUrl;
              this.audioElement.load();
              if (this.isPlaying && !this.isVideoElementActive()) {
                this.audioElement.play().catch(() => {});
              }
              this.notifyMediaState();
              return;
            }
            this.audioError = true;
            if (!this.isVideoElementActive()) {
              this.isPlaying = false;
              this.updateMediaSessionPlaybackState();
            }
            this.notifyMediaState();
          });
        }
      });

      this.setupMediaSessionHandlers();
    }
  }

  private setupMediaSessionHandlers() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        this.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (this.onPrevTrackCallback) this.onPrevTrackCallback();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (this.onNextTrackCallback) this.onNextTrackCallback();
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        this.seek(Math.max(0, this.getCurrentTime() - offset));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        const dur = this.getDuration();
        this.seek(dur > 0 ? Math.min(dur, this.getCurrentTime() + offset) : this.getCurrentTime() + offset);
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          this.seek(details.seekTime);
        }
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        this.pause();
      });
    } catch {}
  }

  public setTransportHandlers(onPrev: () => void, onNext: () => void) {
    this.onPrevTrackCallback = onPrev;
    this.onNextTrackCallback = onNext;
    this.setupMediaSessionHandlers();
  }

  public updateMediaSessionMetadata(meta: MediaSessionMetadataInput) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') {
      return;
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: meta.title || 'Flontmie Track',
        artist: meta.artist || 'Flontmie Artist',
        album: meta.album || 'Flontmie Music',
        artwork: meta.coverUrl
          ? [
              { src: meta.coverUrl, sizes: '96x96', type: 'image/jpeg' },
              { src: meta.coverUrl, sizes: '192x192', type: 'image/jpeg' },
              { src: meta.coverUrl, sizes: '512x512', type: 'image/jpeg' },
            ]
          : [],
      });
    } catch {}
  }

  private updateMediaSessionPlaybackState() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    } catch {}
  }

  private updateMediaSessionPosition(position: number, duration: number) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!Number.isFinite(duration) || duration <= 0) return;
    try {
      if (typeof navigator.mediaSession.setPositionState === 'function') {
        navigator.mediaSession.setPositionState({
          duration: Math.max(duration, position),
          playbackRate: 1,
          position: Math.max(0, Math.min(position, duration)),
        });
      }
    } catch {}
  }

  private isVideoElementActive(): boolean {
    return (
      this.activeMode === 'video' &&
      Boolean(this.videoElement) &&
      Boolean(this.currentVideoUrl) &&
      !this.videoError
    );
  }

  private getActiveMediaElement(): HTMLMediaElement | null {
    if (this.isVideoElementActive() && this.videoElement) {
      return this.videoElement;
    }
    if (this.currentAudioUrl && !this.audioError && this.audioElement) {
      return this.audioElement;
    }
    if (this.currentVideoUrl && !this.videoError && this.videoElement) {
      return this.videoElement;
    }
    return null;
  }

  private applyVolumeToElements() {
    const effectiveVolume = this.isMuted ? 0 : Math.max(0, Math.min(1, this.userVolume));
    const videoActive = this.isVideoElementActive();

    if (this.audioElement) {
      this.audioElement.volume = effectiveVolume;
      this.audioElement.muted = videoActive ? true : this.isMuted;
    }
    if (this.videoElement) {
      this.videoElement.volume = effectiveVolume;
      this.videoElement.muted = videoActive ? this.isMuted : true;
    }
  }

  private notifyMediaState() {
    if (this.onMediaStateChangeCallback) {
      this.onMediaStateChangeCallback({
        isPlaying: this.isPlaying,
        audioError: this.audioError,
        videoError: this.videoError,
        activeMode: this.activeMode,
        isOfflineSource: this.isPlayingOfflineSource,
      });
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.connect(this.ctx.destination);

        if (this.audioElement && !this.mediaElementSource) {
          try {
            this.mediaElementSource = this.ctx.createMediaElementSource(this.audioElement);
            this.mediaElementSource.connect(this.analyser);
          } catch {}
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setCallbacks(
    onTimeUpdate: (currentTime: number, duration: number) => void,
    onEnded: () => void,
    onMediaStateChange?: (state: {
      isPlaying: boolean;
      audioError: boolean;
      videoError: boolean;
      activeMode: PlayerTabMode;
      isOfflineSource?: boolean;
    }) => void
  ) {
    this.onTimeUpdateCallback = onTimeUpdate;
    this.onEndedCallback = onEnded;
    if (onMediaStateChange) {
      this.onMediaStateChangeCallback = onMediaStateChange;
    }
  }

  private readonly handleVideoTimeUpdate = () => {
    if (this.isVideoElementActive() && this.videoElement && this.onTimeUpdateCallback) {
      const cur = this.pendingSeekTime !== null ? this.pendingSeekTime : this.videoElement.currentTime;
      const dur =
        Number.isFinite(this.videoElement.duration) && this.videoElement.duration > 0
          ? this.videoElement.duration
          : 0;
      this.onTimeUpdateCallback(cur, dur);
      this.updateMediaSessionPosition(cur, dur);
    }
  };

  private readonly handleVideoLoadedMetadata = () => {
    if (!this.videoElement) return;
    if (this.isVideoElementActive() && this.pendingSeekTime !== null && this.pendingSeekTime > 0) {
      const target =
        this.videoElement.duration > 0
          ? Math.min(this.pendingSeekTime, Math.max(0, this.videoElement.duration - 0.25))
          : this.pendingSeekTime;
      try {
        this.videoElement.currentTime = target;
      } catch {}
      this.pendingSeekTime = null;
    }
    if (this.isVideoElementActive() && this.onTimeUpdateCallback && this.videoElement.duration > 0) {
      this.onTimeUpdateCallback(this.videoElement.currentTime, this.videoElement.duration);
      this.updateMediaSessionPosition(this.videoElement.currentTime, this.videoElement.duration);
    }
  };

  private readonly handleVideoEnded = () => {
    if (this.isVideoElementActive()) {
      this.isPlaying = false;
      this.updateMediaSessionPlaybackState();
      this.notifyMediaState();
      if (this.onEndedCallback) this.onEndedCallback();
    }
  };

  private readonly handleVideoError = () => {
    if (this.currentVideoUrl) {
      this.videoError = true;
      if (this.activeMode === 'video' && this.audioElement && this.currentAudioUrl && !this.audioError) {
        this.applyVolumeToElements();
        if (this.isPlaying) {
          this.audioElement.play().catch(() => {});
        }
      }
      this.notifyMediaState();
    }
  };

  public attachVideoElement(el: HTMLVideoElement | null) {
    if (this.videoElement === el) return;

    if (this.videoElement) {
      this.videoElement.removeEventListener('timeupdate', this.handleVideoTimeUpdate);
      this.videoElement.removeEventListener('loadedmetadata', this.handleVideoLoadedMetadata);
      this.videoElement.removeEventListener('ended', this.handleVideoEnded);
      this.videoElement.removeEventListener('error', this.handleVideoError);
      try {
        this.videoElement.pause();
      } catch {}
    }

    this.videoElement = el;

    if (this.videoElement) {
      this.videoElement.preload = 'metadata';
      this.videoElement.playsInline = true;
      this.videoElement.addEventListener('timeupdate', this.handleVideoTimeUpdate);
      this.videoElement.addEventListener('loadedmetadata', this.handleVideoLoadedMetadata);
      this.videoElement.addEventListener('ended', this.handleVideoEnded);
      this.videoElement.addEventListener('error', this.handleVideoError);

      if (this.currentVideoUrl) {
        if (this.videoElement.getAttribute('data-track-src') !== this.currentVideoUrl) {
          this.videoElement.src = this.currentVideoUrl;
          this.videoElement.setAttribute('data-track-src', this.currentVideoUrl);
          this.videoElement.load();
        }
      } else {
        this.videoElement.removeAttribute('src');
        this.videoElement.removeAttribute('data-track-src');
      }

      this.applyVolumeToElements();

      if (this.isVideoElementActive()) {
        const currentPos = this.getCurrentTime();
        if (this.audioElement && !this.audioElement.paused) {
          this.audioElement.pause();
        }
        this.seekMediaElement(this.videoElement, currentPos);
        if (this.isPlaying) {
          this.videoElement.play().catch(() => {});
        }
      }
    }
  }

  private seekMediaElement(el: HTMLMediaElement, timeSeconds: number) {
    if (!Number.isFinite(timeSeconds) || timeSeconds < 0) return;
    if (el.readyState >= 1) {
      const clamped =
        Number.isFinite(el.duration) && el.duration > 0
          ? Math.min(timeSeconds, Math.max(0, el.duration - 0.15))
          : timeSeconds;
      try {
        el.currentTime = clamped;
      } catch {}
      this.pendingSeekTime = null;
    } else {
      this.pendingSeekTime = timeSeconds;
    }
  }

  public async loadTrackMedia(params: {
    trackId: string;
    audioUrl?: string | null;
    videoUrl?: string | null;
    mode?: PlayerTabMode;
    autoPlay?: boolean;
    startTime?: number;
    metadata?: MediaSessionMetadataInput;
  }) {
    const {
      trackId,
      audioUrl = null,
      videoUrl = null,
      mode = this.activeMode,
      autoPlay = true,
      startTime = 0,
      metadata,
    } = params;

    if (metadata) {
      this.updateMediaSessionMetadata(metadata);
    }

    const isSameTrack = this.currentTrackId === trackId;
    this.currentTrackId = trackId;
    this.activeMode = mode;

    // Prefer downloaded local offline file if offline or already downloaded on device
    let resolvedAudio = audioUrl || null;
    this.isPlayingOfflineSource = false;

    if (nativePlatform.isTrackDownloaded(trackId)) {
      const offlineUrl = await nativePlatform.getOfflinePlaybackUrl(trackId);
      if (offlineUrl) {
        resolvedAudio = offlineUrl;
        this.isPlayingOfflineSource = true;
      }
    }

    if (!isSameTrack || (this.isPlayingOfflineSource && this.currentAudioUrl !== resolvedAudio)) {
      this.pendingSeekTime = startTime > 0 ? startTime : null;
      this.audioError = !resolvedAudio;
      this.videoError = !videoUrl || !nativePlatform.isOnline();

      if (this.audioElement) {
        this.audioElement.pause();
        this.currentAudioUrl = resolvedAudio;
        if (resolvedAudio) {
          if (this.isPlayingOfflineSource) {
            this.audioElement.removeAttribute('crossorigin');
          } else {
            this.audioElement.crossOrigin = 'anonymous';
          }
          this.audioElement.src = resolvedAudio;
          this.audioElement.load();
        } else {
          this.audioElement.removeAttribute('src');
          this.audioElement.load();
        }
      }

      this.currentVideoUrl = nativePlatform.isOnline() ? (videoUrl || null) : null;
      if (this.videoElement) {
        this.videoElement.pause();
        if (this.currentVideoUrl) {
          this.videoElement.src = this.currentVideoUrl;
          this.videoElement.setAttribute('data-track-src', this.currentVideoUrl);
          this.videoElement.load();
        } else {
          this.videoElement.removeAttribute('src');
          this.videoElement.removeAttribute('data-track-src');
          this.videoElement.load();
        }
      }
    } else if (startTime > 0) {
      this.seek(startTime);
    }

    this.applyVolumeToElements();

    if (autoPlay) {
      this.play(resolvedAudio || undefined);
    } else {
      this.pause();
    }
  }

  public setMode(newMode: PlayerTabMode) {
    if (this.activeMode === newMode) return;

    const wasVideoActive = this.isVideoElementActive();
    const currentPos = this.getCurrentTime();
    const wasPlaying = this.isPlaying;

    this.activeMode = newMode;
    const isNowVideoActive = this.isVideoElementActive();

    if (wasVideoActive !== isNowVideoActive) {
      if (isNowVideoActive && this.videoElement) {
        if (this.audioElement) {
          this.audioElement.pause();
        }
        this.applyVolumeToElements();
        this.seekMediaElement(this.videoElement, currentPos);
        if (wasPlaying) {
          this.videoElement.play().catch(() => {
            this.isPlaying = false;
            this.updateMediaSessionPlaybackState();
            this.notifyMediaState();
          });
        }
      } else if (!isNowVideoActive) {
        if (this.videoElement) {
          this.videoElement.pause();
        }
        this.applyVolumeToElements();
        if (this.audioElement && this.currentAudioUrl && !this.audioError) {
          this.seekMediaElement(this.audioElement, currentPos);
          if (wasPlaying) {
            if (!this.isPlayingOfflineSource) {
              this.initContext();
            }
            this.audioElement.play().catch(() => {
              this.isPlaying = false;
              this.updateMediaSessionPlaybackState();
              this.notifyMediaState();
            });
          }
        }
      }
    } else {
      this.applyVolumeToElements();
    }

    this.notifyMediaState();
  }

  public getMode(): PlayerTabMode {
    return this.activeMode;
  }

  public play(audioUrl?: string, _bpm: number = 120) {
    if (audioUrl !== undefined && audioUrl !== this.currentAudioUrl) {
      this.currentAudioUrl = audioUrl || null;
      this.audioError = !audioUrl;
      if (this.audioElement) {
        this.audioElement.pause();
        if (audioUrl) {
          this.audioElement.src = audioUrl;
          this.audioElement.load();
        } else {
          this.audioElement.removeAttribute('src');
          this.audioElement.load();
        }
      }
    }

    const activeEl = this.getActiveMediaElement();
    if (!activeEl) {
      this.isPlaying = false;
      this.updateMediaSessionPlaybackState();
      this.notifyMediaState();
      return;
    }

    if (activeEl === this.videoElement && this.audioElement) {
      this.audioElement.pause();
    } else if (activeEl === this.audioElement && this.videoElement) {
      this.videoElement.pause();
    }

    this.applyVolumeToElements();

    if (activeEl === this.audioElement && !this.isPlayingOfflineSource) {
      this.initContext();
    }

    this.isPlaying = true;
    this.updateMediaSessionPlaybackState();
    this.notifyMediaState();

    activeEl.play().catch(() => {
      this.isPlaying = false;
      this.updateMediaSessionPlaybackState();
      this.notifyMediaState();
    });
  }

  public pause() {
    this.isPlaying = false;
    if (this.audioElement) {
      this.audioElement.pause();
    }
    if (this.videoElement) {
      this.videoElement.pause();
    }
    this.updateMediaSessionPlaybackState();
    this.notifyMediaState();
  }

  public seek(timeSeconds: number) {
    const safeTime = Math.max(0, timeSeconds);
    const activeEl = this.getActiveMediaElement();
    if (activeEl) {
      this.seekMediaElement(activeEl, safeTime);
    }
    if (this.audioElement && this.audioElement !== activeEl && this.audioElement.readyState >= 1) {
      try {
        this.audioElement.currentTime = safeTime;
      } catch {}
    }
    if (this.videoElement && this.videoElement !== activeEl && this.videoElement.readyState >= 1) {
      try {
        this.videoElement.currentTime = safeTime;
      } catch {}
    }
    const dur = this.getDuration();
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(safeTime, dur);
    }
    this.updateMediaSessionPosition(safeTime, dur);
  }

  public getCurrentTime(): number {
    if (this.pendingSeekTime !== null) {
      return this.pendingSeekTime;
    }
    const activeEl = this.getActiveMediaElement();
    if (activeEl && Number.isFinite(activeEl.currentTime)) {
      return activeEl.currentTime;
    }
    return 0;
  }

  public getDuration(): number {
    const activeEl = this.getActiveMediaElement();
    if (activeEl && Number.isFinite(activeEl.duration) && activeEl.duration > 0) {
      return activeEl.duration;
    }
    if (this.audioElement && Number.isFinite(this.audioElement.duration) && this.audioElement.duration > 0) {
      return this.audioElement.duration;
    }
    if (this.videoElement && Number.isFinite(this.videoElement.duration) && this.videoElement.duration > 0) {
      return this.videoElement.duration;
    }
    return 0;
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.userVolume = clamped;
    this.isMuted = clamped === 0;
    this.applyVolumeToElements();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.applyVolumeToElements();
  }

  public getVolume(): number {
    return this.userVolume;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public hasPlayableAudio(): boolean {
    return Boolean(this.currentAudioUrl && !this.audioError);
  }

  public hasPlayableVideo(): boolean {
    return Boolean(this.currentVideoUrl && !this.videoError);
  }

  public onTimeUpdate(cb: (currentTime: number, duration: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  public onEnded(cb: () => void) {
    this.onEndedCallback = cb;
  }

  public resume() {
    this.play();
  }

  public playTrack(
    _genre: string,
    _bpm: number,
    _duration: number,
    startAt: number = 0,
    audioUrl?: string,
    trackId?: string,
    videoUrl?: string
  ) {
    this.loadTrackMedia({
      trackId: trackId || audioUrl || 'track',
      audioUrl: audioUrl || null,
      videoUrl: videoUrl || null,
      mode: this.activeMode,
      autoPlay: true,
      startTime: startAt,
    });
  }

  public getFrequencyData(): Uint8Array {
    if (!this.analyser || !this.isPlaying) {
      return new Uint8Array(64).fill(4);
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }
}

export const soundEngine = new SoundEngine();
export const audioEngine = soundEngine;
