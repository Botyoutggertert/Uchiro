/**
 * Utility to generate and play a short, pleasant success sound effect.
 * Uses Web Audio API oscillator synthesis and simple Audio object fallback for instant, crisp response
 * with zero external network dependencies.
 */
export function playPaymentSuccessSound() {
  let played = false;

  // 1. Primary: Web Audio API high-fidelity harmonic chime (C5 -> E5 -> G5 -> C6)
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // Pleasant 4-note ascending major chord chime
      const notes = [
        { freq: 523.25, time: 0, duration: 0.15, gain: 0.22 },     // C5
        { freq: 659.25, time: 0.09, duration: 0.18, gain: 0.28 },   // E5
        { freq: 783.99, time: 0.18, duration: 0.25, gain: 0.32 },   // G5
        { freq: 1046.50, time: 0.27, duration: 0.55, gain: 0.35 },  // C6
      ];

      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        gainNode.gain.setValueAtTime(0.001, now + n.time);
        gainNode.gain.exponentialRampToValueAtTime(n.gain, now + n.time + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + n.time);
        osc.stop(now + n.time + n.duration + 0.05);
      });

      played = true;
    }
  } catch (e) {
    console.debug('AudioContext play error:', e);
  }

  // 2. Secondary fallback: Simple Audio object with synthesized base64 WAV chime
  if (!played) {
    try {
      // Lightweight base64 16-bit PCM beep chime
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVoGAACBhYqFbF1fdJivrJBhNjVgodDbqWE2MDCZ3e7/mW4zKS2e6v//tI5YMCcsoej///+7mF4yJCGU5f///8mgZDYmH4zh////17BsOSgfiN7///+1hFwsJy+f6v///8ecWzAoKpvq////xZVdMicpiOT///+0j1cwJSuU');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      // Audio autoplay blocked by browser policy
    }
  }
}

/**
 * Utility to generate and play a subtle, friendly error/timeout sound effect.
 */
export function playPaymentErrorSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      // Gentle two-tone descending chime (E4 -> C4)
      const notes = [
        { freq: 329.63, time: 0, duration: 0.18, gain: 0.18 },
        { freq: 261.63, time: 0.14, duration: 0.32, gain: 0.2 },
      ];
      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.time);
        gainNode.gain.setValueAtTime(0.001, now + n.time);
        gainNode.gain.exponentialRampToValueAtTime(n.gain, now + n.time + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.duration);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now + n.time);
        osc.stop(now + n.time + n.duration + 0.05);
      });
    }
  } catch {
    // Silently ignore audio errors
  }
}
