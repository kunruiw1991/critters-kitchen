'use strict';
/* ==========================================================================
 * Chuyu's Rainbow Kitchen — Pure Tactile ASMR & Musical Foley Engine
 * 100% Zero SpeechSynthesis / Zero Voice — Warm Kalimba, Marimba & Kitchen ASMR
 * ========================================================================== */
const KitchenAudio = (() => {
  let ctx = null;
  let muted = false;
  let noiseBuf = null;

  function ensure() {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
    }
    if (!noiseBuf && ctx) {
      const sr = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, sr * 1.5, sr);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol || 0.12, t0 + Math.min(0.015, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, filterType, freq, q, vol, delay) {
    const c = ensure();
    if (!c || !noiseBuf) return;
    const t0 = c.currentTime + (delay || 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const flt = c.createBiquadFilter();
    flt.type = filterType || 'bandpass';
    flt.frequency.setValueAtTime(freq || 1200, t0);
    flt.Q.setValueAtTime(q || 1.5, t0);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol || 0.1, t0 + Math.min(0.015, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(c.destination);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  // Warm wooden kalimba / bubble pop when selecting ingredients or stations
  function popSelect(pitchStep) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const f = scale[(pitchStep || 0) % scale.length];
    tone(f * 0.85, 0.09, 'sine', 0.14, f, 0);
    tone(f * 2, 0.05, 'triangle', 0.04, f * 2.02, 0.01);
  }

  // Cute musical chime when switching Critter customers (zero speech!)
  function critterChime(idx) {
    const chords = [
      [523.25, 659.25, 783.99],
      [587.33, 739.99, 880.0],
      [659.25, 783.99, 987.77],
      [698.46, 880.0, 1046.5],
      [783.99, 987.77, 1174.66],
      [523.25, 783.99, 1046.5],
      [440.0, 554.37, 659.25],
      [587.33, 880.0, 1174.66],
    ];
    const ch = chords[(idx || 0) % chords.length];
    ch.forEach((f, i) => tone(f, 0.14, 'sine', 0.11, f * 1.01, i * 0.055));
  }

  // Crisp knife slice + oak board thump + juicy squish + pentatonic marimba note
  function chop(step) {
    noise(0.06, 'bandpass', 2400, 1.9, 0.16, 0);
    tone(155, 0.075, 'triangle', 0.22, 55, 0.01);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const f = notes[Math.min(notes.length - 1, Math.max(0, (step || 1) - 1))];
    tone(f, 0.11, 'sine', 0.11, f * 1.03, 0.02);
  }

  function blowCandle() {
    noise(0.26, 'lowpass', 620, 1.1, 0.18, 0);
    [783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.15, 'sine', 0.1, f, 0.08 + i * 0.06));
  }

  function crackEgg() {
    noise(0.035, 'highpass', 2800, 3.0, 0.16, 0);
    tone(1850, 0.03, 'sine', 0.11, 920, 0);
    noise(0.04, 'highpass', 2500, 2.8, 0.18, 0.085);
    tone(380, 0.14, 'sine', 0.17, 140, 0.15);
  }

  function pour() {
    [0, 0.065, 0.13].forEach((d, i) => {
      tone(350 + i * 75, 0.065, 'sine', 0.12, 640 + i * 85, d);
    });
  }

  function stir() {
    noise(0.085, 'lowpass', 720, 1.2, 0.08, 0);
    tone(440 + Math.random() * 140, 0.06, 'sine', 0.06, 580, 0.01);
  }

  function blendTick() {
    noise(0.08, 'bandpass', 1100 + Math.random() * 350, 1.4, 0.09, 0);
    tone(145 + Math.random() * 25, 0.07, 'triangle', 0.05, 175, 0);
  }

  function sizzleTick(heat) {
    const h = Math.max(0.3, heat || 1);
    noise(0.09, 'bandpass', 3400 + Math.random() * 1200, 1.2, 0.055 * h, 0);
    if (Math.random() < 0.42 * h) {
      tone(2200 + Math.random() * 1600, 0.018, 'sine', 0.045 * h, 900, 0.02);
    }
  }

  function flip() {
    tone(220, 0.18, 'sine', 0.15, 720, 0);
    noise(0.13, 'bandpass', 950, 1.2, 0.11, 0);
    tone(130, 0.09, 'triangle', 0.2, 54, 0.22);
  }

  function ovenDing() {
    tone(1567.98, 0.55, 'sine', 0.18, 1567.98, 0);
    tone(3135.96, 0.35, 'sine', 0.08, 3135.96, 0.01);
  }

  function pipeCream() {
    noise(0.045, 'bandpass', 1500, 2.0, 0.065, 0);
    tone(540 + Math.random() * 160, 0.045, 'sine', 0.055, 700, 0);
  }

  function sprinkle() {
    const notes = [1046.5, 1174.7, 1318.5, 1568.0, 1760.0, 2093.0];
    const f = notes[(Math.random() * notes.length) | 0];
    tone(f, 0.09, 'sine', 0.11, f * 1.03, 0);
  }

  function bite(isDrink) {
    if (isDrink) {
      tone(320, 0.16, 'sine', 0.15, 780, 0);
      noise(0.12, 'bandpass', 1400, 2.2, 0.09, 0.02);
    } else {
      noise(0.07, 'bandpass', 1650, 1.4, 0.18, 0);
      tone(220, 0.08, 'triangle', 0.16, 95, 0);
      noise(0.06, 'bandpass', 1850, 1.4, 0.15, 0.11);
      tone(260, 0.08, 'triangle', 0.14, 115, 0.11);
    }
  }

  function shutter() {
    noise(0.04, 'highpass', 2400, 2.0, 0.2, 0);
    tone(1200, 0.03, 'triangle', 0.09, 600, 0.035);
  }

  function reaction(kind) {
    switch (kind) {
      case 'fire':
        noise(0.42, 'lowpass', 680, 0.9, 0.22, 0);
        tone(200, 0.36, 'sawtooth', 0.11, 540, 0);
        break;
      case 'ice':
        [1318.5, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.15, 'sine', 0.13, f * 1.02, i * 0.06));
        break;
      case 'sour':
        tone(760, 0.12, 'triangle', 0.12, 320, 0);
        tone(320, 0.16, 'triangle', 0.12, 860, 0.12);
        break;
      case 'burnt':
        noise(0.28, 'lowpass', 420, 1.2, 0.2, 0);
        tone(145, 0.22, 'triangle', 0.16, 65, 0.04);
        break;
      case 'float':
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.16, 'sine', 0.13, f * 1.1, i * 0.07));
        break;
      case 'sleepy':
        [659.25, 587.33, 523.25, 392.0].forEach((f, i) => tone(f, 0.24, 'sine', 0.11, f * 0.98, i * 0.14));
        break;
      case 'rainbow':
      case 'love':
      default:
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'sine', 0.15, f, i * 0.08));
        break;
    }
  }

  return {
    ensure,
    popSelect,
    critterChime,
    chop,
    blowCandle,
    crackEgg,
    pour,
    stir,
    blendTick,
    sizzleTick,
    flip,
    ovenDing,
    pipeCream,
    sprinkle,
    bite,
    shutter,
    reaction,
    isMuted: () => muted,
    setMuted: m => { muted = !!m; },
  };
})();
