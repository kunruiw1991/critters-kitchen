'use strict';
/* ==========================================================================
 * Chuyu's Rainbow Kitchen — HT Mini Cakes Miniature ASMR Audio Engine
 * 100% Zero SpeechSynthesis / Zero Voice — Multi-Layered WebAudio ASMR
 * Calm, cozy miniature patisserie foley:
 *   - Soft wooden prep tap & gentle butcher block thud
 *   - Soft turntable ball-bearing clicks as cake rotates
 *   - Glossy rainbow candy ball placement pop onto chocolate ganache
 *   - Creamy buttercream piping swoosh (no harsh upward launch whooshes)
 *   - Miniature oven timer bell chime
 *   - Delicate double-crunch pastry bite & kalimba delight chime
 * ========================================================================== */

// Ensure 100% ZERO speechSynthesis across all browsers/platforms
if (typeof window !== 'undefined' && window.speechSynthesis) {
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak = () => {};
  } catch (e) {}
}

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
    g.gain.linearRampToValueAtTime(vol || 0.1, t0 + Math.min(0.014, dur * 0.22));
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
    g.gain.linearRampToValueAtTime(vol || 0.08, t0 + Math.min(0.014, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(c.destination);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  // Calm, soft air glide for gentle miniature utensil movement (no harsh upward launch whoosh)
  function whoosh(pitch) {
    const base = pitch || 540;
    noise(0.07, 'lowpass', base * 0.9, 1.0, 0.035, 0, base * 0.7);
    tone(base * 0.45, 0.06, 'sine', 0.025, base * 0.4, 0.004);
  }

  // Soft tactile click of miniature cake turntable ball-bearings rotating
  function turntableClick(step) {
    const scale = [880, 987.77, 1046.5, 1174.66, 1318.5, 1396.91];
    const f = scale[Math.abs(step || 0) % scale.length];
    tone(f, 0.024, 'triangle', 0.038, f * 0.96, 0);
    noise(0.016, 'bandpass', 2400, 3.5, 0.02, 0);
  }

  // Glossy rainbow candy ball placement pop onto the chocolate ganache
  function candyPop(step) {
    const rainbowNotes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5, D5, E5, G5, A5, C6
    const f = rainbowNotes[Math.abs(step || 0) % rainbowNotes.length];
    tone(f * 1.15, 0.045, 'sine', 0.08, f, 0);
    noise(0.018, 'highpass', 2600, 2.5, 0.04, 0);
    tone(f * 2, 0.028, 'triangle', 0.025, f * 2, 0.003);
  }

  // Creamy, silky buttercream piping swoosh from the piping bag
  function buttercreamSwoosh() {
    noise(0.08, 'bandpass', 1100, 1.6, 0.045, 0, 750);
    tone(440, 0.07, 'sine', 0.035, 390, 0);
    tone(660, 0.045, 'sine', 0.018, 620, 0.018);
  }

  // Gentle wooden counter / miniature cutting board tap
  function woodTap() {
    tone(210, 0.032, 'triangle', 0.07, 95, 0);
    noise(0.022, 'bandpass', 1100, 2.2, 0.04, 0);
  }

  // Warm wooden kalimba / bubble pop when selecting ingredients or stations
  function popSelect(pitchStep) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const f = scale[Math.abs(pitchStep || 0) % scale.length];
    tone(f * 0.9, 0.065, 'sine', 0.08, f, 0);
    tone(f * 2, 0.04, 'triangle', 0.025, f * 2.02, 0.008);
    noise(0.016, 'bandpass', f * 2.2, 2.8, 0.02, 0);
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
      tone(f, 0.14, 'sine', 0.09, f * 1.01, i * 0.045);
      tone(f * 2, 0.06, 'triangle', 0.025, f * 2, i * 0.045 + 0.008);
    });
  }

  // Multi-layered ASMR chop at blade impact: oak board thud + crisp slice crunch + marimba overtone
  function chop(step) {
    // 1. Immediate warm oak butcher block thud at impact (t = 0)
    tone(172, 0.08, 'triangle', 0.22, 50, 0);
    tone(96, 0.065, 'sine', 0.18, 40, 0.004);
    // 2. Crisp botanical cell slice crunch + subtle steel ring
    noise(0.048, 'bandpass', 2400, 2.0, 0.15, 0, 1300);
    tone(2480, 0.024, 'sine', 0.028, 1920, 0.002);
    // 3. Pentatonic marimba overtone
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const f = notes[Math.min(notes.length - 1, Math.max(0, (step || 1) - 1))];
    tone(f, 0.09, 'sine', 0.09, f * 1.02, 0.012);
    tone(f * 1.5, 0.05, 'triangle', 0.03, f * 1.52, 0.022);
  }

  function blowCandle() {
    noise(0.25, 'lowpass', 600, 1.1, 0.15, 0, 220);
    [783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => {
      tone(f, 0.15, 'sine', 0.09, f * 1.01, 0.06 + i * 0.05);
    });
  }

  function crackEgg() {
    // Sharp tap against ceramic rim + shell crackle + silky yolk plop
    noise(0.03, 'highpass', 2800, 3.0, 0.15, 0);
    tone(1950, 0.025, 'sine', 0.09, 960, 0);
    noise(0.038, 'highpass', 2400, 2.6, 0.16, 0.07);
    tone(410, 0.12, 'sine', 0.14, 135, 0.12);
    tone(520, 0.08, 'sine', 0.08, 760, 0.18);
  }

  function pour() {
    [0, 0.055, 0.11, 0.16].forEach((d, i) => {
      tone(340 + i * 68, 0.06, 'sine', 0.09, 640 + i * 80, d);
      noise(0.04, 'bandpass', 1150 + i * 220, 2.2, 0.038, d);
    });
  }

  // Liquid swirl bubbles + ceramic bowl whisk resonance
  function stir() {
    noise(0.085, 'bandpass', 660, 1.5, 0.075, 0, 1100);
    const base = 420 + Math.random() * 130;
    tone(base, 0.065, 'sine', 0.065, base * 1.32, 0.008);
    tone(base * 1.25, 0.05, 'sine', 0.045, base * 1.55, 0.038);
    if (Math.random() < 0.45) {
      tone(2150 + Math.random() * 320, 0.022, 'triangle', 0.025, 1850, 0.018);
    }
  }

  function blendTick() {
    noise(0.08, 'bandpass', 1100 + Math.random() * 320, 1.4, 0.08, 0, 1600);
    tone(148 + Math.random() * 25, 0.07, 'triangle', 0.048, 180, 0);
    tone(580 + Math.random() * 200, 0.04, 'sine', 0.035, 820, 0.022);
  }

  // Rich butter-bubble sizzle crackle
  function sizzleTick(heat) {
    const h = Math.max(0.35, heat || 1);
    noise(0.085, 'bandpass', 3200 + Math.random() * 1200, 1.25, 0.048 * h, 0, 4600);
    if (Math.random() < 0.45 * h) {
      tone(2100 + Math.random() * 1500, 0.016, 'sine', 0.038 * h, 880, 0.015);
    }
  }

  function sizzle(heat) {
    sizzleTick(heat || 1.1);
  }

  // Soft skillet sizzle / pan action without flying junk whoosh
  function panToss() {
    tone(1680, 0.035, 'triangle', 0.06, 1120, 0);
    tone(148, 0.085, 'triangle', 0.16, 60, 0.01);
    noise(0.09, 'bandpass', 3200, 1.3, 0.07, 0.02, 2400);
  }

  function flip() {
    panToss();
  }

  // HT Mini Cakes miniature oven bell ding
  function ovenDing() {
    tone(1567.98, 0.52, 'sine', 0.16, 1567.98, 0);
    tone(3135.96, 0.32, 'sine', 0.07, 3135.96, 0.01);
    tone(2093.0, 0.38, 'sine', 0.08, 2093.0, 0.06);
  }

  // Fluffy whipped-cream piping pop + buttercream swoosh
  function pipeCream() {
    buttercreamSwoosh();
    const f = 560 + Math.random() * 140;
    tone(f, 0.045, 'sine', 0.06, f * 1.15, 0.01);
  }

  function sprinkle() {
    const notes = [1046.5, 1174.7, 1318.5, 1568.0, 1760.0, 2093.0];
    const f = notes[(Math.random() * notes.length) | 0];
    tone(f, 0.08, 'sine', 0.09, f * 1.02, 0);
    tone(f * 1.5, 0.05, 'triangle', 0.035, f * 1.5, 0.015);
  }

  function sparkle() {
    pipeCream();
    sprinkle();
  }

  // Double-crunch pastry chomp (or drink slurp) + happy kalimba chime
  function playChomp(isDrink) {
    if (isDrink) {
      tone(310, 0.14, 'sine', 0.13, 760, 0);
      noise(0.11, 'bandpass', 1300, 2.2, 0.08, 0.02, 2200);
      tone(587.33, 0.09, 'sine', 0.08, 880, 0.14);
    } else {
      // First crisp pastry crunch
      noise(0.065, 'bandpass', 1700, 1.35, 0.16, 0, 1100);
      tone(230, 0.075, 'triangle', 0.15, 92, 0);
      // Second chew crunch
      noise(0.058, 'bandpass', 1900, 1.4, 0.14, 0.095, 1250);
      tone(270, 0.07, 'triangle', 0.13, 112, 0.095);
      // Warm kalimba delight chime
      [659.25, 783.99, 1046.5].forEach((f, i) => {
        tone(f, 0.1, 'sine', 0.075, f * 1.01, 0.16 + i * 0.04);
      });
    }
  }

  function bite(isDrink) {
    playChomp(isDrink);
  }

  function shutter() {
    noise(0.038, 'highpass', 2400, 2.0, 0.18, 0);
    tone(1250, 0.028, 'triangle', 0.08, 620, 0.03);
    tone(1760, 0.05, 'sine', 0.06, 2093, 0.055);
  }

  function reaction(kind) {
    switch (kind) {
      case 'fire':
        noise(0.38, 'lowpass', 650, 0.9, 0.18, 0, 1300);
        tone(200, 0.32, 'sawtooth', 0.09, 500, 0);
        break;
      case 'ice':
        [1318.5, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.14, 'sine', 0.11, f * 1.01, i * 0.055));
        break;
      case 'sour':
        tone(760, 0.11, 'triangle', 0.1, 320, 0);
        tone(320, 0.14, 'triangle', 0.1, 840, 0.11);
        break;
      case 'burnt':
        noise(0.24, 'lowpass', 400, 1.2, 0.17, 0, 160);
        tone(145, 0.2, 'triangle', 0.14, 65, 0.035);
        break;
      case 'float':
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.15, 'sine', 0.11, f * 1.08, i * 0.065));
        break;
      case 'sleepy':
        [659.25, 587.33, 523.25, 392.0].forEach((f, i) => tone(f, 0.22, 'sine', 0.09, f * 0.98, i * 0.12));
        break;
      case 'rainbow':
      case 'love':
      default:
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
          tone(f, 0.2, 'sine', 0.12, f * 1.01, i * 0.062);
          tone(f * 2, 0.08, 'triangle', 0.03, f * 2, i * 0.062 + 0.009);
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
    turntableClick,
    candyPop,
    ballPlace: candyPop,
    buttercreamSwoosh,
    woodTap,
    isMuted: () => muted,
    setMuted: m => { muted = !!m; },
  };
})();

if (typeof window !== 'undefined') {
  window.KitchenAudio = KitchenAudio;
  window.SoundFX = KitchenAudio;
}
