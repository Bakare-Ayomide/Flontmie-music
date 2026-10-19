/**
 * Flontmie Authorized Server-Streaming Audio Engine
 * Streams locally hosted audio files (.m4a, .mp3, .wav, .flac) from Flontmie's
 * /phpbackend/api/stream.php endpoint (HTTP 206 byte-range streaming) with
 * real-time frequency analysis and fallback harmonic synthesis.
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private isPlaying: boolean = false;
  private timerId: number | null = null;
  private currentTime: number = 0;
  private duration: number = 180;
  private volume: number = 0.85;
  private onTimeUpdateCallback: ((time: number, duration: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;

  private activeOscillators: OscillatorNode[] = [];
  private activeGains: GainNode[] = [];
  private pulseInterval: number | null = null;
  private currentGenre: string = 'pop';
  private currentBpm: number = 120;

  private resolveStreamUrl(audioUrl?: string, trackId?: string): string {
    const base =
      typeof window !== 'undefined' && window.location.hostname !== 'flontmie.ticketplaster.com'
        ? 'https://flontmie.ticketplaster.com/phpbackend/api'
        : '/phpbackend/api';

    if (audioUrl) {
      if (audioUrl.startsWith('/phpbackend/api/')) {
        return `${base}${audioUrl.replace('/phpbackend/api', '')}`;
      }
      if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
        if (!audioUrl.includes('music.youtube.com') && !audioUrl.includes('youtube.com/watch')) {
          return audioUrl;
        }
      }
    }
    if (trackId) {
      return `${base}/stream.php?id=${encodeURIComponent(trackId)}`;
    }
    return '';
  }

  private ensureAudioElement(): HTMLAudioElement {
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.preload = 'auto';
      this.audioEl.crossOrigin = 'anonymous';
      this.audioEl.volume = this.volume;

      this.audioEl.addEventListener('timeupdate', () => {
        if (!this.audioEl || !this.isPlaying) return;
        this.currentTime = this.audioEl.currentTime;
        const reportedDur =
          Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 10
            ? this.audioEl.duration
            : this.duration;
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(this.currentTime, reportedDur);
        }
      });

      this.audioEl.addEventListener('ended', () => {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        if (this.timerId) {
          clearInterval(this.timerId);
          this.timerId = null;
        }
        this.currentTime = 0;
        if (this.onEndedCallback) {
          this.onEndedCallback();
        }
      });
    }
    return this.audioEl;
  }

  public playTrack(
    genreOrTrack: string | { genre?: string; audioUrl?: string; id?: string },
    bpm: number,
    duration: number,
    startAt: number = 0,
    audioUrl?: string,
    trackId?: string
  ) {
    this.stopAudioSynthesis();

    const resolvedGenre =
      typeof genreOrTrack === 'string' ? genreOrTrack : genreOrTrack?.genre || 'pop';
    const resolvedAudioUrl =
      audioUrl || (typeof genreOrTrack === 'object' ? genreOrTrack?.audioUrl : undefined);
    const resolvedTrackId =
      trackId || (typeof genreOrTrack === 'object' ? genreOrTrack?.id : undefined);

    this.currentGenre = resolvedGenre.toLowerCase();
    this.currentBpm = bpm || 120;
    this.duration = duration || 180;
    this.currentTime = startAt;
    this.isPlaying = true;

    const streamUrl = this.resolveStreamUrl(resolvedAudioUrl, resolvedTrackId);
    const el = this.ensureAudioElement();

    if (streamUrl) {
      try {
        if (el.src !== streamUrl) {
          el.src = streamUrl;
        }
        el.volume = this.volume;
        if (startAt > 0) {
          try {
            el.currentTime = startAt;
          } catch {}
        }
        const playPromise = el.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            this.startPlaybackTicker();
          });
        }
      } catch {
        this.startPlaybackTicker();
      }
    } else {
      this.startPlaybackTicker();
    }
  }

  private stopAudioSynthesis() {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }

    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.activeOscillators = [];

    this.activeGains.forEach((g) => {
      try {
        g.disconnect();
      } catch {}
    });
    this.activeGains = [];
  }

  private startPlaybackTicker() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }

    this.timerId = window.setInterval(() => {
      if (!this.isPlaying) return;
      if (this.audioEl && !this.audioEl.paused && this.audioEl.currentTime > 0) {
        return;
      }

      this.currentTime += 0.5;
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(this.currentTime, this.duration);
      }

      if (this.currentTime >= this.duration) {
        this.pause();
        this.currentTime = 0;
        if (this.onEndedCallback) {
          this.onEndedCallback();
        }
      }
    }, 500);
  }

  public resume() {
    this.stopAudioSynthesis();
    this.isPlaying = true;
    if (this.audioEl && this.audioEl.src) {
      this.audioEl.play().catch(() => {
        this.startPlaybackTicker();
      });
    } else {
      this.startPlaybackTicker();
    }
  }

  public pause() {
    this.isPlaying = false;
    this.stopAudioSynthesis();
    if (this.audioEl) {
      try {
        this.audioEl.pause();
      } catch {}
    }
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public seek(seconds: number) {
    this.currentTime = Math.max(0, Math.min(seconds, this.duration));
    if (this.audioEl && this.audioEl.src) {
      try {
        this.audioEl.currentTime = this.currentTime;
      } catch {}
    }
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.currentTime, this.duration);
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioEl) {
      this.audioEl.volume = this.volume;
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getAnalyserData(): Uint8Array | null {
    if (!this.analyser) return null;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  public onTimeUpdate(cb: (time: number, duration: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  public onEnded(cb: () => void) {
    this.onEndedCallback = cb;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public getDuration(): number {
    return this.duration;
  }
}

export const audioEngine = new AudioEngine();
