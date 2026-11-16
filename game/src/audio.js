// Synthesised sound: every effect is built with WebAudio oscillators and filtered
// noise, so the game needs no audio files and stays offline. Everything is guarded:
// no AudioContext (headless, or before the first click) means silence, never a crash.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function noiseBuffer(duration) {
    const c = ensure();
    if (!c) return null;
    const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * duration)), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function burst({ duration = 0.12, frequency = 1200, type = 'lowpass', gain = 0.5, slideTo = null }) {
    const c = ensure();
    if (!c || muted) return;
    try {
      const t = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(duration);
      const filter = c.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(frequency, t);
      if (slideTo !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + duration);
      const g = c.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t);
      src.stop(t + duration + 0.02);
    } catch { /* silence */ }
  }

  function tone({ frequency = 440, duration = 0.08, type = 'sine', gain = 0.25, slideTo = null, delay = 0 }) {
    const c = ensure();
    if (!c || muted) return;
    try {
      const t = c.currentTime + delay;
      const osc = c.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, t);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    } catch { /* silence */ }
  }

  return {
    resume() { const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}); },
    setMuted(value) { muted = value; },
    get muted() { return muted; },
    shot(kind) {
      if (kind === 'awp') burst({ duration: 0.3, frequency: 900, gain: 0.85, slideTo: 90 });
      else if (kind === 'p9') burst({ duration: 0.09, frequency: 1500, gain: 0.45, slideTo: 300 });
      else if (kind === 'smg') burst({ duration: 0.08, frequency: 1800, gain: 0.4, slideTo: 400 });
      else burst({ duration: 0.11, frequency: 1300, gain: 0.55, slideTo: 220 });
      tone({ frequency: 160, duration: 0.06, type: 'square', gain: 0.12, slideTo: 70 });
    },
    dry() { tone({ frequency: 2200, duration: 0.03, type: 'square', gain: 0.12 }); },
    reload() {
      tone({ frequency: 900, duration: 0.04, type: 'square', gain: 0.1 });
      tone({ frequency: 600, duration: 0.04, type: 'square', gain: 0.1, delay: 0.35 });
      tone({ frequency: 1100, duration: 0.04, type: 'square', gain: 0.12, delay: 0.7 });
    },
    hit(kill) {
      tone({ frequency: kill ? 1320 : 990, duration: 0.06, type: 'sine', gain: 0.22 });
      if (kill) tone({ frequency: 1760, duration: 0.09, type: 'sine', gain: 0.2, delay: 0.06 });
    },
    hurt() { burst({ duration: 0.15, frequency: 500, gain: 0.3, slideTo: 120 }); },
    plantTick() { tone({ frequency: 1180, duration: 0.05, type: 'square', gain: 0.14 }); },
    beep() { tone({ frequency: 1560, duration: 0.07, type: 'sine', gain: 0.18 }); },
    explosion() {
      burst({ duration: 1.1, frequency: 700, gain: 0.9, slideTo: 50 });
      tone({ frequency: 90, duration: 0.9, type: 'sine', gain: 0.5, slideTo: 28 });
    },
    roundWin() {
      tone({ frequency: 523, duration: 0.14, type: 'triangle', gain: 0.22 });
      tone({ frequency: 659, duration: 0.14, type: 'triangle', gain: 0.22, delay: 0.14 });
      tone({ frequency: 784, duration: 0.22, type: 'triangle', gain: 0.24, delay: 0.28 });
    },
    roundLose() {
      tone({ frequency: 392, duration: 0.16, type: 'triangle', gain: 0.2 });
      tone({ frequency: 311, duration: 0.24, type: 'triangle', gain: 0.2, delay: 0.16 });
    },
    buy() {
      tone({ frequency: 880, duration: 0.05, type: 'sine', gain: 0.18 });
      tone({ frequency: 1174, duration: 0.07, type: 'sine', gain: 0.18, delay: 0.05 });
    },
    throw() { burst({ duration: 0.18, frequency: 2400, gain: 0.25, slideTo: 500 }); },
    smoke() {
      burst({ duration: 0.7, frequency: 900, gain: 0.35, slideTo: 200 });
      tone({ frequency: 320, duration: 0.2, type: 'sine', gain: 0.12, slideTo: 140 });
    },
    flash() {
      burst({ duration: 0.1, frequency: 3200, gain: 0.7, slideTo: 800 });
      tone({ frequency: 2400, duration: 0.35, type: 'sine', gain: 0.14, slideTo: 1800 });
    },
    click() { tone({ frequency: 700, duration: 0.03, type: 'square', gain: 0.1 }); },
  };
}
