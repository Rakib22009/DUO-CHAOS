class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private ambientRunning = false;
  private ambientTimer: number | null = null;

  public unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted() {
    return this.muted;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainVal = 0.12,
  ) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public click() {
    this.unlock();
    this.playTone(540, 680, 0.06, 'triangle', 0.08);
  }

  public footstep(surface: 'wood' | 'grass' | 'stone' = 'grass') {
    if (this.muted || !this.ctx) return;
    const base = surface === 'wood' ? 140 : surface === 'stone' ? 220 : 95;
    this.playTone(base + Math.random() * 25, 45, 0.07, 'triangle', 0.05);
  }

  public jump() {
    this.unlock();
    this.playTone(210, 420, 0.14, 'sine', 0.1);
  }

  public waterSlosh() {
    if (this.muted || !this.ctx) return;
    this.playTone(320 + Math.random() * 90, 180, 0.11, 'sine', 0.045);
  }

  public impact() {
    if (this.muted || !this.ctx) return;
    this.playTone(130, 38, 0.18, 'sawtooth', 0.14);
  }

  public checkpoint() {
    this.unlock();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n, 0.25, 'triangle', 0.11), idx * 75);
    });
  }

  public fail() {
    this.unlock();
    // Comical descending slide whistle + thud
    this.playTone(620, 140, 0.45, 'sawtooth', 0.13);
    setTimeout(() => this.playTone(110, 45, 0.25, 'square', 0.12), 180);
  }

  public victory() {
    this.unlock();
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    fanfare.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n * 1.01, 0.38, 'triangle', 0.13), idx * 100);
    });
  }

  public startAmbientForest() {
    if (this.ambientRunning) return;
    this.ambientRunning = true;
    const loop = () => {
      if (!this.ambientRunning) return;
      if (!this.muted && this.ctx && this.ctx.state === 'running') {
        // Gentle bird chirp occasionally
        if (Math.random() < 0.45) {
          const f = 1400 + Math.random() * 900;
          this.playTone(f, f * 1.25, 0.09, 'sine', 0.018);
          setTimeout(() => this.playTone(f * 1.1, f * 0.9, 0.08, 'sine', 0.015), 110);
        }
      }
      this.ambientTimer = window.setTimeout(loop, 2800 + Math.random() * 2400);
    };
    this.ambientTimer = window.setTimeout(loop, 1800);
  }

  public stopAmbientForest() {
    this.ambientRunning = false;
    if (this.ambientTimer) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }
  }
}

export const soundEngine = new SoundEngine();
