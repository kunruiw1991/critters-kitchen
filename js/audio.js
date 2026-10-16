'use strict';
/* ==========================================================================
 * Chuyu's Rainbow Kitchen — Procedural ASMR Cooking Audio & Bilingual Voice
 * ========================================================================== */
const KitchenAudio = (() => {
  let ctx = null;
  let muted = false;
  let voiceEnabled = true;
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

  // ASMR Cooking Sounds
  function chop(step) {
    // Crisp knife slice + wooden board thump + rising musical note per cut
    noise(0.065, 'bandpass', 2200, 1.8, 0.18, 0);
    tone(165, 0.075, 'triangle', 0.22, 58, 0.01);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const f = notes[Math.min(notes.length - 1, Math.max(0, (step || 1) - 1))];
    tone(f, 0.09, 'sine', 0.1, f * 1.04, 0.02);
  }

  function blowCandle() {
    noise(0.26, 'lowpass', 620, 1.1, 0.2, 0);
    [783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.14, 'sine', 0.1, f, 0.08 + i * 0.06));
  }

  function crackEgg() {
    // Two crisp shell taps + yolk plop
    noise(0.035, 'highpass', 2800, 3.0, 0.18, 0);
    tone(1900, 0.03, 'sine', 0.12, 950, 0);
    noise(0.04, 'highpass', 2500, 2.8, 0.2, 0.09);
    tone(360, 0.14, 'sine', 0.18, 145, 0.16);
  }

  function pour() {
    // Glug-glug liquid droplets
    [0, 0.07, 0.14].forEach((d, i) => {
      tone(340 + i * 70, 0.065, 'sine', 0.12, 620 + i * 80, d);
    });
  }

  function stir() {
    noise(0.09, 'lowpass', 700, 1.2, 0.09, 0);
    tone(420 + Math.random() * 140, 0.06, 'sine', 0.06, 560, 0.01);
  }

  function blendTick() {
    noise(0.08, 'bandpass', 1100 + Math.random() * 400, 1.4, 0.1, 0);
    tone(135 + Math.random() * 25, 0.07, 'sawtooth', 0.05, 165, 0);
  }

  function sizzleTick(heat) {
    const h = Math.max(0.3, heat || 1);
    noise(0.09, 'bandpass', 3400 + Math.random() * 1200, 1.2, 0.06 * h, 0);
    if (Math.random() < 0.45 * h) {
      tone(2200 + Math.random() * 1800, 0.018, 'sine', 0.05 * h, 900, 0.02);
    }
  }

  function flip() {
    tone(210, 0.18, 'sine', 0.16, 690, 0);
    noise(0.14, 'bandpass', 950, 1.2, 0.12, 0);
    tone(125, 0.09, 'triangle', 0.22, 52, 0.22);
  }

  function ovenDing() {
    tone(1567.98, 0.55, 'sine', 0.2, 1567.98, 0);
    tone(3135.96, 0.35, 'sine', 0.09, 3135.96, 0.01);
  }

  function pipeCream() {
    noise(0.05, 'bandpass', 1500, 2.0, 0.07, 0);
    tone(520 + Math.random() * 180, 0.045, 'sine', 0.05, 680, 0);
  }

  function sprinkle() {
    const notes = [1046.5, 1174.7, 1318.5, 1568.0, 1760.0, 2093.0];
    const f = notes[(Math.random() * notes.length) | 0];
    tone(f, 0.09, 'sine', 0.12, f * 1.03, 0);
  }

  function bite(isDrink) {
    if (isDrink) {
      tone(320, 0.16, 'sine', 0.16, 780, 0);
      noise(0.12, 'bandpass', 1400, 2.2, 0.1, 0.02);
    } else {
      noise(0.07, 'bandpass', 1650, 1.4, 0.2, 0);
      tone(220, 0.08, 'triangle', 0.18, 95, 0);
      noise(0.06, 'bandpass', 1850, 1.4, 0.16, 0.11);
      tone(260, 0.08, 'triangle', 0.15, 115, 0.11);
    }
  }

  function shutter() {
    noise(0.04, 'highpass', 2400, 2.0, 0.22, 0);
    tone(1200, 0.03, 'square', 0.1, 600, 0.035);
  }

  function reaction(kind) {
    switch (kind) {
      case 'fire':
        noise(0.45, 'lowpass', 680, 0.9, 0.26, 0);
        tone(180, 0.4, 'sawtooth', 0.14, 520, 0);
        break;
      case 'ice':
        [1318.5, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.14, 'sine', 0.14, f * 1.02, i * 0.06));
        break;
      case 'sour':
        tone(780, 0.12, 'sawtooth', 0.12, 310, 0);
        tone(310, 0.18, 'sawtooth', 0.12, 890, 0.12);
        break;
      case 'burnt':
        noise(0.28, 'lowpass', 420, 1.2, 0.24, 0);
        tone(140, 0.22, 'triangle', 0.18, 65, 0.04);
        break;
      case 'float':
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.16, 'sine', 0.14, f * 1.12, i * 0.07));
        break;
      case 'sleepy':
        [659.25, 587.33, 523.25, 392.0].forEach((f, i) => tone(f, 0.22, 'sine', 0.12, f * 0.98, i * 0.14));
        break;
      case 'rainbow':
      case 'love':
      default:
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, f, i * 0.08));
        break;
    }
  }

  function speak(zh, en) {
    if (muted || !voiceEnabled || typeof window.speechSynthesis === 'undefined') return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(zh);
      u.lang = 'zh-CN';
      u.rate = 0.95;
      u.pitch = 1.18;
      u.volume = 0.85;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  return {
    ensure,
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
    speak,
    isMuted: () => muted,
    setMuted: m => { muted = !!m; if (muted && window.speechSynthesis) try { window.speechSynthesis.cancel(); } catch (e) {} },
    isVoiceEnabled: () => voiceEnabled,
    setVoiceEnabled: v => { voiceEnabled = !!v; },
  };
})();
