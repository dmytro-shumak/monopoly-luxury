// Web Audio API Sound Synthesizer for Monopoly Deal Luxury

class SoundManager {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Modern Chime (D5 -> A5)
   * Elegant, warm two-tone major interval notification when player's turn begins.
   */
  playTurnSound(volume = 0.25) {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(volume, now);
      master.connect(ctx.destination);

      [
        { freq: 587.33, start: 0, decay: 0.6, peak: 0.6 }, // D5
        { freq: 880.0, start: 0.1, decay: 0.85, peak: 0.8 }, // A5
      ].forEach(({ freq, start, decay, peak }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);
        g.gain.setValueAtTime(0.001, now + start);
        g.gain.linearRampToValueAtTime(peak, now + start + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + start + decay);
        osc.connect(g);
        g.connect(master);
        osc.start(now + start);
        osc.stop(now + start + decay + 0.05);
      });
    } catch (err) {
      console.error('Failed to play turn sound:', err);
    }
  }
}

export const soundManager = new SoundManager();

export const playTurnNotification = (volume = 0.25) => {
  soundManager.playTurnSound(volume);
};
