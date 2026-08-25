/**
 * Audio Alert Utility for DED BLACK BARBERSHOP Admin System
 * Uses Web Audio API to produce crisp, high-quality notification alerts
 * without relying on external MP3/WAV files.
 */

// Helper to get or resume audio context
let sharedAudioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        sharedAudioCtx = new AudioContextClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch (e) {
    console.warn('AudioContext not available or blocked:', e);
    return null;
  }
};

/**
 * Sound Alert 1: New Appointment Alert (Bell / Chime Ding-Dong)
 * Plays when a client schedules an appointment.
 */
export const playAppointmentAlert = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Note 1: G5 (783.99 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Note 2: C6 (1046.50 Hz) - slightly higher, delayed 0.12s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, now + 0.12);
    gain2.gain.setValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);

    // Harmonics for rich bell ring: E6 (1318.51 Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(1318.51, now + 0.12);
    gain3.gain.setValueAtTime(0.12, now + 0.12);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.12);
    osc3.stop(now + 0.6);
  } catch (err) {
    console.warn('Erro ao tocar som de agendamento:', err);
  }
};

/**
 * Sound Alert 2: Payment & Subscription Alert (Triumph Cash Chime)
 * Plays when a client subscribes and completes payment for a plan.
 */
export const playPaymentAlert = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, delay: 0.0, duration: 0.15 },  // C5
      { freq: 659.25, delay: 0.08, duration: 0.15 }, // E5
      { freq: 783.99, delay: 0.16, duration: 0.20 }, // G5
      { freq: 1046.50, delay: 0.24, duration: 0.60 } // C6 (long sustain chime)
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.delay);
      gain.gain.setValueAtTime(0.28, now + n.delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.delay + n.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.duration);
    });

    // Metallic shimmer overlay for cash register / payment feel
    const shimmer = ctx.createOscillator();
    const shimGain = ctx.createGain();
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(1567.98, now + 0.24); // G6
    shimGain.gain.setValueAtTime(0.12, now + 0.24);
    shimGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    shimmer.connect(shimGain);
    shimGain.connect(ctx.destination);
    shimmer.start(now + 0.24);
    shimmer.stop(now + 0.7);
  } catch (err) {
    console.warn('Erro ao tocar som de pagamento:', err);
  }
};

/**
 * Test sound trigger to unlock browser Web Audio permissions if needed
 */
export const unlockAudioAndTest = (type: 'appointment' | 'payment') => {
  getAudioContext();
  if (type === 'appointment') {
    playAppointmentAlert();
  } else {
    playPaymentAlert();
  }
};
