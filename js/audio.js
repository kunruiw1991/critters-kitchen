'use strict';
/* ==========================================================================
 * Chuyu's Rainbow Kitchen — Pure Tactile ASMR & Musical Foley Engine
 * 100% Zero SpeechSynthesis / Zero Voice — Multi-Layered WebAudio Patisserie
 * ASMR (Knife Whoosh + Oak Thud, Liquid Swirl Bubbles, Skillet Clink & Sizzle,
 * Piping Pop + Bell Shimmer, Double-Crunch Bite + Kalimba Chime)
 * ========================================================================== */
const KitchenAudio = (() => {
  let ctx = null;
  let muted = false;
  let noiseBuf = null;
  let userUnlocked = false;

  function unlockOnGesture(e) {
    if (e && e.isTrusted === false) return;
    userUnlocked = true;
    if (ctx && ctx.state === 'suspended') {
      try { ctx.resume(); } catch (err) {}
    }
  }

  if (typeof window !== 'undefined') {
    ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click'].forEach(ev => {
      window.addEventListener(ev, unlockOnGesture, { passive: true, capture: true });
    });
  }

  function ensure() {
    if (muted) return null;
    if (!userUnlocked) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
      if (ctx.state === 'suspended') return null;
    }
    if (!noiseBuf && ctx) {
      const sr = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, sr * 1.6, sr);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * (0.85 + 0.15 * Math.sin(i * 0.03));
      }
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
    g.gain.linearRampToValueAtTime(vol || 0.12, t0 + Math.min(0.014, dur * 0.22));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, filterType, freq, q, vol, delay, slideFreqTo) {
    const c = ensure();
    if (!c || !noiseBuf) return;
    const t0 = c.currentTime + (delay || 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const flt = c.createBiquadFilter();
    flt.type = filterType || 'bandpass';
    flt.frequency.setValueAtTime(Math.max(40, freq || 1200), t0);
    if (slideFreqTo) {
      flt.frequency.exponentialRampToValueAtTime(Math.max(40, slideFreqTo), t0 + dur);
    }
    flt.Q.setValueAtTime(q || 1.5, t0);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol || 0.1, t0 + Math.min(0.014, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(c.destination);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  // Soft air whoosh for flying ingredients or utensil swings
  function whoosh(pitch) {
    const base = pitch || 780;
    noise(0.11, 'bandpass', base, 1.3, 0.09, 0, base * 2.1);
    tone(base * 0.45, 0.09, 'sine', 0.05, base * 0.85, 0.01);
  }

  // Warm wooden kalimba / bubble pop when selecting ingredients or stations
  function popSelect(pitchStep) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const f = scale[Math.abs(pitchStep || 0) % scale.length];
    tone(f * 0.82, 0.085, 'sine', 0.14, f, 0);
    tone(f * 2, 0.055, 'triangle', 0.045, f * 2.03, 0.01);
    noise(0.028, 'bandpass', f * 2.5, 3.0, 0.035, 0);
  }

  // Cute musical kalimba arpeggio when switching Critter customers (zero speech!)
  function critterChime(idx) {
    const chords = [
      [523.25, 659.25, 783.99, 1046.5],
      [587.33, 739.99, 880.0, 1174.66],
      [659.25, 783.99, 987.77, 1318.5],
      [698.46, 880.0, 1046.5, 1396.9],
      [783.99, 987.77, 1174.66, 1567.98],
      [523.25, 783.99, 1046.5, 1318.5],
      [440.0, 554.37, 659.25, 880.0],
      [587.33, 880.0, 1174.66, 1479.98],
    ];
    const ch = chords[Math.abs(idx || 0) % chords.length];
    ch.forEach((f, i) => {
      tone(f, 0.15, 'sine', 0.11, f * 1.01, i * 0.05);
      tone(f * 2, 0.07, 'triangle', 0.03, f * 2, i * 0.05 + 0.008);
    });
  }

  // Multi-layered ASMR chop at blade impact: immediate oak board thud + crisp slice crunch + marimba note
  function chop(step) {
    // 1. Immediate warm oak butcher block thud at impact (t = 0)
    tone(172, 0.085, 'triangle', 0.25, 50, 0);
    tone(96, 0.07, 'sine', 0.2, 40, 0.004);
    // 2. Crisp botanical cell slice crunch + subtle steel ring
    noise(0.055, 'bandpass', 2600, 2.0, 0.18, 0, 1400);
    tone(2480, 0.028, 'sine', 0.035, 1920, 0.002);
    // 3. Juicy droplet & pentatonic marimba overtone
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const f = notes[Math.min(notes.length - 1, Math.max(0, (step || 1) - 1))];
    tone(f, 0.11, 'sine', 0.11, f * 1.04, 0.012);
    tone(f * 1.5, 0.06, 'triangle', 0.04, f * 1.55, 0.024);
  }

  function blowCandle() {
    noise(0.28, 'lowpass', 640, 1.1, 0.18, 0, 220);
    [783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => {
      tone(f, 0.16, 'sine', 0.1, f * 1.01, 0.07 + i * 0.055);
    });
  }

  function crackEgg() {
    // Sharp tap against ceramic rim + shell crackle + silky yolk plop
    noise(0.032, 'highpass', 3000, 3.2, 0.17, 0);
    tone(1950, 0.028, 'sine', 0.11, 960, 0);
    noise(0.042, 'highpass', 2600, 2.8, 0.19, 0.08);
    tone(410, 0.14, 'sine', 0.17, 135, 0.14);
    tone(520, 0.09, 'sine', 0.09, 780, 0.21);
  }

  function pour() {
    [0, 0.058, 0.115, 0.17].forEach((d, i) => {
      tone(340 + i * 72, 0.065, 'sine', 0.11, 660 + i * 85, d);
      noise(0.045, 'bandpass', 1200 + i * 240, 2.2, 0.045, d);
    });
  }

  // Liquid swirl bubbles + ceramic bowl whisk resonance
  function stir() {
    noise(0.095, 'bandpass', 680, 1.5, 0.09, 0, 1180);
    const base = 420 + Math.random() * 140;
    tone(base, 0.07, 'sine', 0.075, base * 1.38, 0.008);
    tone(base * 1.25, 0.055, 'sine', 0.055, base * 1.65, 0.042);
    // Subtle ceramic whisk clink
    if (Math.random() < 0.45) {
      tone(2150 + Math.random() * 350, 0.024, 'triangle', 0.03, 1850, 0.02);
    }
  }

  function blendTick() {
    noise(0.085, 'bandpass', 1100 + Math.random() * 360, 1.4, 0.095, 0, 1650);
    tone(148 + Math.random() * 25, 0.075, 'triangle', 0.055, 182, 0);
    tone(580 + Math.random() * 220, 0.045, 'sine', 0.04, 840, 0.025);
  }

  // Rich butter-bubble sizzle crackle in copper skillet
  function sizzleTick(heat) {
    const h = Math.max(0.35, heat || 1);
    noise(0.095, 'bandpass', 3300 + Math.random() * 1400, 1.25, 0.058 * h, 0, 4800);
    if (Math.random() < 0.48 * h) {
      tone(2100 + Math.random() * 1700, 0.018, 'sine', 0.045 * h, 880, 0.015);
    }
    if (Math.random() < 0.28 * h) {
      tone(520 + Math.random() * 240, 0.032, 'sine', 0.035 * h, 780, 0.03);
    }
  }

  function sizzle(heat) {
    sizzleTick(heat || 1.2);
  }

  // Metallic copper skillet clink + upward air whoosh + golden catch thump & sizzle burst
  function panToss() {
    // 1. Metallic copper skillet rim clink
    tone(1680, 0.045, 'triangle', 0.09, 1120, 0);
    tone(2840, 0.032, 'sine', 0.06, 2200, 0.005);
    // 2. Upward toss whoosh
    tone(210, 0.18, 'sine', 0.15, 760, 0.015);
    noise(0.14, 'bandpass', 850, 1.2, 0.12, 0.015, 2200);
    // 3. Catch thud back in warm skillet + fresh sizzle burst
    tone(138, 0.095, 'triangle', 0.21, 52, 0.21);
    noise(0.12, 'bandpass', 3800, 1.3, 0.09, 0.22, 2600);
  }

  function flip() {
    panToss();
  }

  function ovenDing() {
    tone(1567.98, 0.58, 'sine', 0.18, 1567.98, 0);
    tone(3135.96, 0.36, 'sine', 0.08, 3135.96, 0.01);
    tone(2093.0, 0.42, 'sine', 0.09, 2093.0, 0.08);
  }

  // Fluffy whipped-cream piping pop + crystalline sparkle overtone
  function pipeCream() {
    noise(0.048, 'bandpass', 1480, 2.1, 0.07, 0, 2100);
    const f = 520 + Math.random() * 180;
    tone(f, 0.055, 'sine', 0.075, f * 1.35, 0);
    tone(f * 2, 0.04, 'triangle', 0.035, f * 2.15, 0.012);
  }

  function sprinkle() {
    const notes = [1046.5, 1174.7, 1318.5, 1568.0, 1760.0, 2093.0];
    const f = notes[(Math.random() * notes.length) | 0];
    tone(f, 0.095, 'sine', 0.11, f * 1.03, 0);
    tone(f * 1.5, 0.065, 'triangle', 0.045, f * 1.52, 0.018);
  }

  function sparkle() {
    pipeCream();
    sprinkle();
  }

  // Double-crunch pastry chomp (or straw slurp) + happy kalimba chime
  function playChomp(isDrink) {
    if (isDrink) {
      tone(310, 0.16, 'sine', 0.15, 790, 0);
      noise(0.13, 'bandpass', 1350, 2.2, 0.095, 0.02, 2400);
      tone(587.33, 0.1, 'sine', 0.09, 880, 0.15);
    } else {
      // First crisp pastry crunch
      noise(0.072, 'bandpass', 1720, 1.35, 0.19, 0, 1100);
      tone(230, 0.082, 'triangle', 0.17, 92, 0);
      // Second happy chew crunch
      noise(0.064, 'bandpass', 1940, 1.4, 0.16, 0.105, 1280);
      tone(270, 0.08, 'triangle', 0.15, 112, 0.105);
      // Warm kalimba delight chime
      [659.25, 783.99, 1046.5].forEach((f, i) => {
        tone(f, 0.11, 'sine', 0.085, f * 1.02, 0.18 + i * 0.045);
      });
    }
  }

  function bite(isDrink) {
    playChomp(isDrink);
  }

  function shutter() {
    noise(0.042, 'highpass', 2400, 2.0, 0.2, 0);
    tone(1250, 0.032, 'triangle', 0.09, 620, 0.035);
    tone(1760, 0.06, 'sine', 0.07, 2093, 0.06);
  }

  function reaction(kind) {
    switch (kind) {
      case 'fire':
        noise(0.42, 'lowpass', 680, 0.9, 0.22, 0, 1400);
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
        noise(0.28, 'lowpass', 420, 1.2, 0.2, 0, 160);
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
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
          tone(f, 0.22, 'sine', 0.14, f * 1.01, i * 0.068);
          tone(f * 2, 0.1, 'triangle', 0.035, f * 2, i * 0.068 + 0.01);
        });
        break;
    }
  }

  return {
    ensure,
    whoosh,
    popSelect,
    critterChime,
    chop,
    blowCandle,
    crackEgg,
    pour,
    stir,
    blendTick,
    sizzleTick,
    sizzle,
    panToss,
    flip,
    ovenDing,
    pipeCream,
    sprinkle,
    sparkle,
    playChomp,
    bite,
    shutter,
    reaction,
    isMuted: () => muted,
    setMuted: m => { muted = !!m; },
  };
})();

if (typeof window !== 'undefined') {
  window.KitchenAudio = KitchenAudio;
  window.SoundFX = KitchenAudio;
}
