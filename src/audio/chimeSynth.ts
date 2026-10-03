/**
 * Pure Web Audio API Synthesizer for Kitchen Display System (KDS) & POS Notifications.
 * Zero external MP3/audio file dependencies - 100% synthesized in-memory.
 */

class ChimeSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isUnlocked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedMute = localStorage.getItem('coffee_pos_audio_muted');
        this.isMuted = savedMute === 'true';
      } catch {
        this.isMuted = false;
      }
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.ctx) {
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx
        .resume()
        .then(() => {
          this.isUnlocked = true;
        })
        .catch(() => {
          // Autoplay policy prevented resume until user interaction
        });
    } else {
      this.isUnlocked = true;
    }
    return this.ctx;
  }

  public async unlock(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        this.isUnlocked = true;
        return true;
      } catch {
        return false;
      }
    }
    this.isUnlocked = true;
    return true;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('coffee_pos_audio_muted', muted ? 'true' : 'false');
      } catch {
        // ignore storage errors
      }
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getUnlocked(): boolean {
    return this.isUnlocked;
  }

  /**
   * Crisp 3-tone ascending chime for incoming kitchen orders
   * Ascending chord: C5 (523.25 Hz) -> E5 (659.25 Hz) -> G5 (783.99 Hz)
   */
  public playNewOrderChime(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, offset: 0.0 }, // C5
        { freq: 659.25, offset: 0.12 }, // E5
        { freq: 783.99, offset: 0.25 }, // G5
      ];

      notes.forEach(({ freq, offset }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Warm harmonic overtone for marimba/bell timbre
        const overtone = ctx.createOscillator();
        const overtoneGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + offset);

        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 2, now + offset);

        // Envelope: 5ms attack, 550ms exponential decay
        const startTime = now + offset;
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.28, startTime + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.55);

        overtoneGain.gain.setValueAtTime(0.0001, startTime);
        overtoneGain.gain.exponentialRampToValueAtTime(0.06, startTime + 0.006);
        overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4);

        osc.connect(gain);
        overtone.connect(overtoneGain);
        gain.connect(ctx.destination);
        overtoneGain.connect(ctx.destination);

        osc.start(startTime);
        overtone.start(startTime);
        osc.stop(startTime + 0.6);
        overtone.stop(startTime + 0.6);
      });
    } catch (e) {
      console.warn('[chimeSynth] Audio playback prevented or error:', e);
    }
  }

  /**
   * Crisp confirmation blip when a ticket is bumped to ready
   * Pitch: A5 (880 Hz) (150ms)
   */
  public playBumpChime(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {
      console.warn('[chimeSynth] Bump chime error:', e);
    }
  }
}

export const chimeSynth = new ChimeSynthesizer();
