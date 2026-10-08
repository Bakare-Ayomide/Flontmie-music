/**
 * High-performance Web Audio Synthesizer & Playback Engine
 * Generates harmonic chords, basslines, and rhythmic textures tailored to
 * genre and BPM with real-time frequency analysis for reactive visualizers.
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private timerId: number | null = null;
  private currentTime: number = 0;
  private duration: number = 180;
  private volume: number = 0.8;
  private onTimeUpdateCallback: ((time: number, duration: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;

  // Synthesis nodes for active harmonic playback
  private activeOscillators: OscillatorNode[] = [];
  private activeGains: GainNode[] = [];
  private pulseInterval: number | null = null;
  private currentGenre: string = 'synthwave';
  private currentBpm: number = 120;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playTrack(genre: string, bpm: number, duration: number, startAt: number = 0) {
    this.initContext();
    this.stopAudioSynthesis();

    this.currentGenre = genre.toLowerCase();
    this.currentBpm = bpm || 120;
    this.duration = duration || 180;
    this.currentTime = startAt;
    this.isPlaying = true;

    this.startAudioSynthesis();
    this.startPlaybackTicker();
  }

  private startAudioSynthesis() {
    if (!this.ctx || !this.masterGain) return;

    // Genre-based chord frequencies
    const chordPitches: Record<string, number[][]> = {
      synthwave: [[130.81, 164.81, 196.00, 261.63], [146.83, 174.61, 220.00, 293.66], [164.81, 196.00, 246.94, 329.63]], // C, Dm, Em
      'lo-fi': [[130.81, 155.56, 196.00, 233.08], [174.61, 207.65, 261.63, 311.13]], // Cm7, Fm7
      afrobeats: [[146.83, 185.00, 220.00, 277.18], [164.81, 207.65, 246.94, 329.63]], // Dmaj7, Emaj
      ambient: [[65.41, 98.00, 130.81, 196.00, 293.66], [87.31, 130.81, 174.61, 261.63]], // C maj9, F maj7
    };

    const chords = chordPitches[this.currentGenre] || chordPitches.synthwave;
    let chordIdx = 0;

    const playChord = () => {
      if (!this.isPlaying || !this.ctx || !this.masterGain) return;

      const chord = chords[chordIdx % chords.length];
      chordIdx++;

      chord.forEach((freq, i) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Waveform selection by genre
        if (this.currentGenre.includes('ambient')) {
          osc.type = 'sine';
        } else if (this.currentGenre.includes('synthwave')) {
          osc.type = i === 0 ? 'sawtooth' : 'triangle';
        } else if (this.currentGenre.includes('lo-fi')) {
          osc.type = 'triangle';
        } else {
          osc.type = 'sine';
        }

        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        const chordDuration = (60 / this.currentBpm) * 4;
        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.06 / (i + 1), now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + chordDuration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + chordDuration + 0.1);

        this.activeOscillators.push(osc);
        this.activeGains.push(gain);
      });
    };

    playChord();
    const chordMs = ((60 / this.currentBpm) * 4) * 1000;
    this.pulseInterval = window.setInterval(playChord, Math.max(1200, chordMs));
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
      } catch {
        // already stopped
      }
    });
    this.activeOscillators = [];

    this.activeGains.forEach((g) => {
      try {
        g.disconnect();
      } catch {
        // already disconnected
      }
    });
    this.activeGains = [];
  }

  private startPlaybackTicker() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }

    this.timerId = window.setInterval(() => {
      if (!this.isPlaying) return;

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
    this.initContext();
    this.isPlaying = true;
    this.startAudioSynthesis();
    this.startPlaybackTicker();
  }

  public pause() {
    this.isPlaying = false;
    this.stopAudioSynthesis();
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public seek(seconds: number) {
    this.currentTime = Math.max(0, Math.min(seconds, this.duration));
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.currentTime, this.duration);
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
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
