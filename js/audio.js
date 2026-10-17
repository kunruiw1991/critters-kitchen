'use strict';
/* ==========================================================================
 * Chuyu's Rainbow Kitchen — 10-Station ASMR Audio Engine (WebAudio Synthesizer)
 * 100% Zero SpeechSynthesis / Zero Voiceover / Zero Text
 * Studio-Grade DSP Foley Synthesis:
 *   - Master Bus: DynamicsCompressor limiter (-6dB threshold, 12:1 ratio)
 *   - Anti-click envelope ramps (smooth linear/exponential with ramp-to-zero)
 *   - Memory safety: automatic onended node disconnection & garbage collection
 *   - Seamless looping noise buffers
 *   - Finite parameter validation guarding against NaN/TypeErrors
 *   - Station 1: Velcro fruit/veggie slicing (ascending C5->G5), POS scanner, cash drawer
 *   - Station 2: Soft-serve ice cream dispenser lever, scoop plop, aquarium bubbles
 *   - Station 3: Modular kitchen unboxing snap, circulating running water sink, splash
 *   - Station 4: Dual-burner stove dial clicks, rich frying sizzle, boiling soup bubbles
 *   - Station 5: Motorized smoothie blender hum, spring pop-up toaster & ding, microwave
 *   - Station 6: Whisk batter mixing, rolling pin dough flattening, cookie cutter stamp
 *   - Station 7: Bento sushi rolling & slicing, whistling tea kettle, teacup pour
 *   - Station 8: Birthday cake spinning turntable, musical knife, blowing candles
 *   - Station 9: Sudsy sponge dishwashing scrub, clean dish squeak, drying rack clink
 *   - Station 10: Stethoscope heartbeat thumping (lub-dub), ear thermometer 3-beep, band-aid
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

  // Master bus nodes for digital clipping prevention and master volume control
  let masterGain = null;
  let limiter = null;

  // Active continuous loop handles
  const activeLoops = {
    blender: null,
    sizzle: null,
    faucet: null,
    heartbeat: null
  };

  function safeNum(val, fallback, min, max) {
    if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
    if (min !== undefined && val < min) return min;
    if (max !== undefined && val > max) return max;
    return val;
  }

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
    if (!userUnlocked && typeof window !== 'undefined') {
      userUnlocked = true;
    }
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        return null;
      }
    }
    if (ctx && ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
      if (ctx.state === 'suspended') return null;
    }
    // Initialize Master Bus (Gain -> Compressor Limiter -> Destination)
    if (ctx && !masterGain) {
      try {
        masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(muted ? 0.0 : 0.75, ctx.currentTime);

        limiter = ctx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-6.0, ctx.currentTime);
        limiter.knee.setValueAtTime(12.0, ctx.currentTime);
        limiter.ratio.setValueAtTime(12.0, ctx.currentTime);
        limiter.attack.setValueAtTime(0.002, ctx.currentTime);
        limiter.release.setValueAtTime(0.12, ctx.currentTime);

        masterGain.connect(limiter);
        limiter.connect(ctx.destination);
      } catch (e) {
        masterGain = null;
        limiter = null;
      }
    }
    // Shared seamless noise buffer
    if (!noiseBuf && ctx) {
      const sr = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, sr * 2.0, sr);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * (0.85 + 0.15 * Math.sin(i * 0.025));
      }
    }
    return ctx;
  }

  function getDestination() {
    return masterGain || (ctx ? ctx.destination : null);
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    const c = ensure();
    const dest = getDestination();
    if (!c || !dest) return;

    const t0 = c.currentTime + Math.max(0, safeNum(delay, 0, 0, 10));
    const duration = Math.max(0.01, safeNum(dur, 0.1, 0.005, 15));
    const safeF = safeNum(freq, 440, 20, 20000);
    const safeVol = safeNum(vol, 0.1, 0.0001, 1.0);

    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(safeF, t0);

    if (slideTo && Number.isFinite(slideTo)) {
      const safeSlide = Math.max(20, Math.min(20000, slideTo));
      osc.frequency.exponentialRampToValueAtTime(safeSlide, t0 + duration);
    }

    // Clean anti-click attack and exponential decay to zero
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(safeVol, t0 + Math.min(0.014, duration * 0.22));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    g.gain.linearRampToValueAtTime(0.0, t0 + duration + 0.012);

    osc.connect(g);
    g.connect(dest);

    osc.onended = () => {
      try {
        osc.disconnect();
        g.disconnect();
      } catch (e) {}
    };

    osc.start(t0);
    osc.stop(t0 + duration + 0.025);
  }

  function noise(dur, filterType, freq, q, vol, delay, slideFreqTo) {
    const c = ensure();
    const dest = getDestination();
    if (!c || !noiseBuf || !dest) return;

    const t0 = c.currentTime + Math.max(0, safeNum(delay, 0, 0, 10));
    const duration = Math.max(0.01, safeNum(dur, 0.08, 0.005, 15));
    const safeF = safeNum(freq, 1200, 30, 18000);
    const safeVol = safeNum(vol, 0.08, 0.0001, 1.0);
    const safeQ = safeNum(q, 1.5, 0.1, 30);

    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true; // Seamless looping prevents premature cutoff

    const flt = c.createBiquadFilter();
    flt.type = filterType || 'bandpass';
    flt.frequency.setValueAtTime(safeF, t0);
    flt.Q.setValueAtTime(safeQ, t0);

    if (slideFreqTo && Number.isFinite(slideFreqTo)) {
      const safeSlide = Math.max(30, Math.min(18000, slideFreqTo));
      flt.frequency.exponentialRampToValueAtTime(safeSlide, t0 + duration);
    }

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(safeVol, t0 + Math.min(0.014, duration * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    g.gain.linearRampToValueAtTime(0.0, t0 + duration + 0.012);

    src.connect(flt);
    flt.connect(g);
    g.connect(dest);

    src.onended = () => {
      try {
        src.disconnect();
        flt.disconnect();
        g.disconnect();
      } catch (e) {}
    };

    src.start(t0, Math.random() * (noiseBuf.duration - 0.2));
    src.stop(t0 + duration + 0.025);
  }

  // Soft air glide for utensil movement: supports both absolute Hz and relative multipliers <= 10
  function whoosh(pitch) {
    const p = safeNum(pitch, 1.0, 0.05, 5000);
    // If pitch <= 10, treat as relative scaling factor on base 540 Hz (avoids infrasonic 20 Hz sub-bass thump)
    const base = (p > 10) ? p : 540 * p;
    noise(0.07, 'lowpass', base * 0.9, 1.0, 0.035, 0, base * 0.7);
    tone(base * 0.45, 0.06, 'sine', 0.025, base * 0.4, 0.004);
  }

  // --------------------------------------------------------------------------
  // INVARIANT 1: Slicing Ascending C5->G5 with Velcro Rip & Butcher Block Thud
  // --------------------------------------------------------------------------
  function velcroRip(delay) {
    const d = Math.max(0, safeNum(delay, 0));
    // 3 rapid micro-bursts of high-frequency hook-and-loop friction
    noise(0.014, 'bandpass', 3600, 3.0, 0.12, d, 2800);
    noise(0.016, 'highpass', 4200, 2.5, 0.10, d + 0.010);
    noise(0.018, 'bandpass', 3100, 2.8, 0.14, d + 0.022, 2200);
  }

  function slice(step) {
    // 1. Tactile velcro hook-and-loop detachment micro-crackle
    velcroRip(0);
    // 2. Oak butcher block thud at impact
    tone(175, 0.085, 'triangle', 0.22, 48, 0.006);
    tone(95, 0.065, 'sine', 0.18, 38, 0.008);
    // 3. Crisp botanical cell slice crunch + knife ring
    noise(0.048, 'bandpass', 2400, 2.0, 0.15, 0.004, 1300);
    tone(2480, 0.024, 'sine', 0.028, 1920, 0.006);
    // 4. Ascending diatonic scale: C5 -> G5 (and up to C6 for 8-slice foods)
    const diatonicScale = [
      523.25, // 1: C5
      587.33, // 2: D5
      659.25, // 3: E5
      698.46, // 4: F5
      783.99, // 5: G5
      880.00, // 6: A5
      987.77, // 7: B5
      1046.50 // 8: C6
    ];
    const s = safeNum(step, 1, 1, 100);
    const idx = (Math.round(s) - 1) % diatonicScale.length;
    const f = diatonicScale[Math.max(0, idx)];
    tone(f, 0.11, 'sine', 0.10, f * 1.015, 0.015);
    tone(f * 1.5, 0.06, 'triangle', 0.035, f * 1.52, 0.025);
  }

  function chop(step) {
    slice(step);
  }

  // --------------------------------------------------------------------------
  // INVARIANT 2: Motorized Smoothie Blender Hum with Vortex & Chunk Crunch
  // --------------------------------------------------------------------------
  function blendTick() {
    noise(0.08, 'bandpass', 1100 + Math.random() * 320, 1.4, 0.08, 0, 1600);
    tone(148 + Math.random() * 25, 0.07, 'triangle', 0.048, 180, 0);
    tone(580 + Math.random() * 200, 0.04, 'sine', 0.035, 820, 0.022);
  }

  function startBlender(speed) {
    stopBlender();
    const c = ensure();
    const dest = getDestination();
    if (!c || !noiseBuf || !dest) return;
    const t0 = c.currentTime;
    const sp = safeNum(speed, 1.0, 0.5, 2.0);

    // Motor coil fundamental
    const osc = c.createOscillator();
    const oscG = c.createGain();
    const flt = c.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(45, t0);
    osc.frequency.exponentialRampToValueAtTime(75 * sp, t0 + 0.25);
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(180, t0);
    flt.frequency.exponentialRampToValueAtTime(260 * sp, t0 + 0.25);
    flt.Q.setValueAtTime(2.0, t0);
    oscG.gain.setValueAtTime(0.0001, t0);
    oscG.gain.linearRampToValueAtTime(0.065, t0 + 0.25);
    osc.connect(flt);
    flt.connect(oscG);
    oscG.connect(dest);
    osc.start(t0);

    // Motor harmonic
    const osc2 = c.createOscillator();
    const osc2G = c.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(90, t0);
    osc2.frequency.exponentialRampToValueAtTime(150 * sp, t0 + 0.25);
    osc2G.gain.setValueAtTime(0.0001, t0);
    osc2G.gain.linearRampToValueAtTime(0.04, t0 + 0.25);
    osc2.connect(osc2G);
    osc2G.connect(dest);
    osc2.start(t0);

    // Swirling fluid vortex
    const nSrc = c.createBufferSource();
    nSrc.buffer = noiseBuf;
    nSrc.loop = true;
    const nFlt = c.createBiquadFilter();
    nFlt.type = 'bandpass';
    nFlt.frequency.setValueAtTime(900, t0);
    nFlt.frequency.exponentialRampToValueAtTime(1300 * sp, t0 + 0.25);
    nFlt.Q.setValueAtTime(1.5, t0);
    const nG = c.createGain();
    nG.gain.setValueAtTime(0.0001, t0);
    nG.gain.linearRampToValueAtTime(0.06, t0 + 0.25);
    nSrc.connect(nFlt);
    nFlt.connect(nG);
    nG.connect(dest);
    nSrc.start(t0);

    activeLoops.blender = { osc, flt, oscG, osc2, osc2G, nSrc, nFlt, nG, c };
  }

  function stopBlender() {
    if (!activeLoops.blender) return;
    const b = activeLoops.blender;
    activeLoops.blender = null;
    try {
      const t = b.c.currentTime;
      b.oscG.gain.linearRampToValueAtTime(0.0001, t + 0.35);
      b.oscG.gain.linearRampToValueAtTime(0.0, t + 0.37);
      b.osc2G.gain.linearRampToValueAtTime(0.0001, t + 0.35);
      b.osc2G.gain.linearRampToValueAtTime(0.0, t + 0.37);
      b.nG.gain.linearRampToValueAtTime(0.0001, t + 0.35);
      b.nG.gain.linearRampToValueAtTime(0.0, t + 0.37);
      b.osc.frequency.exponentialRampToValueAtTime(28, t + 0.35);
      b.osc.onended = () => {
        try {
          b.osc.disconnect();
          b.flt.disconnect();
          b.oscG.disconnect();
        } catch (e) {}
      };
      b.osc2.onended = () => {
        try {
          b.osc2.disconnect();
          b.osc2G.disconnect();
        } catch (e) {}
      };
      b.nSrc.onended = () => {
        try {
          b.nSrc.disconnect();
          b.nFlt.disconnect();
          b.nG.disconnect();
        } catch (e) {}
      };
      b.osc.stop(t + 0.38);
      b.osc2.stop(t + 0.38);
      b.nSrc.stop(t + 0.38);
    } catch (e) {}
  }

  function blendHum(dur, speed) {
    const d = safeNum(dur, 1.2, 0.2, 10);
    startBlender(speed);
    setTimeout(() => {
      stopBlender();
    }, d * 1000);
  }

  // --------------------------------------------------------------------------
  // INVARIANT 3: Toaster Mechanical Pop-Up & Miniature Brass Bell Ding
  // --------------------------------------------------------------------------
  function toasterPop() {
    // Phase 1: Heavy spring tension snap
    noise(0.025, 'highpass', 2800, 2.5, 0.18, 0);
    tone(95, 0.065, 'triangle', 0.20, 40, 0.002);
    // Phase 2: Carriage hitting top mechanical stop (clack & ring)
    noise(0.035, 'bandpass', 1400, 2.2, 0.16, 0.035);
    tone(880, 0.08, 'sine', 0.07, 720, 0.038);
    tone(1320, 0.06, 'triangle', 0.04, 1100, 0.040);
  }

  function toasterDing() {
    // High, sparkling miniature brass bell chime (E6 / G6 bell ring)
    tone(2637.0, 0.75, 'sine', 0.18, 2637.0, 0);
    tone(2641.5, 0.70, 'sine', 0.12, 2641.5, 0.002); // 4.5Hz shimmer beat
    tone(5274.0, 0.45, 'sine', 0.08, 5274.0, 0.004);
    tone(7911.0, 0.25, 'sine', 0.04, 7911.0, 0.008);
  }

  function butterSpread() {
    // Crust scrape
    noise(0.07, 'highpass', 3200, 2.0, 0.11, 0, 2400);
    // Creamy butter glide
    noise(0.09, 'bandpass', 850, 1.4, 0.07, 0.04, 600);
    tone(360, 0.08, 'sine', 0.04, 290, 0.04);
  }

  function ovenDing() {
    tone(1567.98, 0.52, 'sine', 0.16, 1567.98, 0);
    tone(3135.96, 0.32, 'sine', 0.07, 3135.96, 0.01);
    tone(2093.0, 0.38, 'sine', 0.08, 2093.0, 0.06);
  }

  // --------------------------------------------------------------------------
  // INVARIANT 4: Frying Sizzle Crackle & Boiling Soup Bubbles
  // --------------------------------------------------------------------------
  function sizzleTick(heat) {
    const h = safeNum(heat, 1.0, 0.35, 2.5);
    // High-frequency thermal oil crackle
    noise(0.085, 'bandpass', 3600 + Math.random() * 1200, 1.25, 0.052 * h, 0, 4800);
    // Mid butter hiss
    noise(0.065, 'bandpass', 1900 + Math.random() * 600, 1.5, 0.035 * h, 0.01);
    // Random popping butter micro-bursts
    if (Math.random() < 0.55 * h) {
      tone(2200 + Math.random() * 1400, 0.015, 'sine', 0.042 * h, 900, 0.012);
    }
  }

  function sizzle(heat) {
    sizzleTick(heat || 1.1);
  }

  function startSizzle(heat) {
    stopSizzle();
    const c = ensure();
    const dest = getDestination();
    if (!c || !noiseBuf || !dest) return;
    const t0 = c.currentTime;
    const h = safeNum(heat, 1.0, 0.4, 2.0);

    const nSrc = c.createBufferSource();
    nSrc.buffer = noiseBuf;
    nSrc.loop = true;
    const flt = c.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(3800, t0);
    flt.Q.setValueAtTime(1.2, t0);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.045 * h, t0 + 0.2);
    nSrc.connect(flt);
    flt.connect(g);
    g.connect(dest);
    nSrc.start(t0);

    activeLoops.sizzle = { nSrc, flt, g, c };
  }

  function stopSizzle() {
    if (!activeLoops.sizzle) return;
    const s = activeLoops.sizzle;
    activeLoops.sizzle = null;
    try {
      const t = s.c.currentTime;
      s.g.gain.linearRampToValueAtTime(0.0001, t + 0.2);
      s.g.gain.linearRampToValueAtTime(0.0, t + 0.22);
      s.nSrc.onended = () => {
        try {
          s.nSrc.disconnect();
          s.flt.disconnect();
          s.g.disconnect();
        } catch (e) {}
      };
      s.nSrc.stop(t + 0.22);
    } catch (e) {}
  }

  function boilBubble() {
    // Pitch-rising resonant water bloop in boiling soup pot + steam hiss
    const base = 320 + Math.random() * 140;
    tone(base, 0.068, 'sine', 0.095, base * 1.95, 0);
    tone(base * 1.35, 0.042, 'sine', 0.048, base * 2.35, 0.024);
    noise(0.042, 'bandpass', 1450, 2.2, 0.042, 0.01, 2100);
  }

  function soupBubble() {
    boilBubble();
  }

  function panToss() {
    // Spatula metallic slide + skillet wrist flick + crispy sear hiss
    tone(1680, 0.035, 'triangle', 0.06, 1120, 0);
    tone(148, 0.085, 'triangle', 0.16, 60, 0.01);
    noise(0.11, 'bandpass', 3400, 1.3, 0.082, 0.02, 2400);
    tone(2650, 0.018, 'sine', 0.042, 1100, 0.035);
  }

  function flip() {
    panToss();
  }

  function sausageFlip(heat) {
    panToss();
    sizzleTick(safeNum(heat, 1.4, 0.5, 2.5));
  }

  function eggSizzle(heat) {
    const h = safeNum(heat, 1.2, 0.5, 2.5);
    sizzleTick(h);
    // Albumen edge pop & butter crackle
    tone(1950 + Math.random() * 650, 0.022, 'sine', 0.055 * h, 880, 0.018);
    noise(0.055, 'highpass', 4200, 2.0, 0.048 * h, 0.008);
  }

  function stoveDialClick(level) {
    const l = safeNum(level, 1, 0, 10);
    const f = 1450 + l * 95;
    // Rotary mechanical detent click + warm burner ignition tick
    tone(f, 0.018, 'triangle', 0.085, f * 0.88, 0);
    tone(f * 0.5, 0.024, 'sine', 0.045, f * 0.42, 0.004);
    noise(0.014, 'bandpass', 3200, 3.2, 0.04, 0.006);
  }

  function dialClick(level) {
    stoveDialClick(level);
  }

  // --------------------------------------------------------------------------
  // INVARIANT 5: Sink Water Splash, Faucet Flow & Soapy Scrub
  // --------------------------------------------------------------------------
  function waterSplash(intensity) {
    const k = safeNum(intensity, 1.0, 0.4, 2.0);
    // Plunge body impact thud
    tone(135, 0.085, 'sine', 0.18 * k, 52, 0);
    // Bubble glugs
    tone(440, 0.065, 'sine', 0.11 * k, 210, 0.012);
    tone(330, 0.055, 'sine', 0.09 * k, 175, 0.045);
    // Dispersed droplet spray
    noise(0.12, 'bandpass', 2800, 1.8, 0.14 * k, 0.005, 1800);
    noise(0.06, 'highpass', 4500, 2.2, 0.08 * k, 0.010);
  }

  function faucetFlow(active) {
    if (!active) {
      if (activeLoops.faucet) {
        try {
          const f = activeLoops.faucet;
          activeLoops.faucet = null;
          const t = f.c.currentTime;
          f.g.gain.linearRampToValueAtTime(0.0001, t + 0.18);
          f.g.gain.linearRampToValueAtTime(0.0, t + 0.20);
          f.nSrc.onended = () => {
            try {
              f.nSrc.disconnect();
              f.flt.disconnect();
              f.g.disconnect();
            } catch (e) {}
          };
          f.nSrc.stop(t + 0.20);
        } catch (e) {}
      }
      return;
    }
    if (activeLoops.faucet) return;
    const c = ensure();
    const dest = getDestination();
    if (!c || !noiseBuf || !dest) return;
    const t0 = c.currentTime;

    const nSrc = c.createBufferSource();
    nSrc.buffer = noiseBuf;
    nSrc.loop = true;
    const flt = c.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(950, t0);
    flt.Q.setValueAtTime(1.3, t0);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.065, t0 + 0.15);
    nSrc.connect(flt);
    flt.connect(g);
    g.connect(dest);
    nSrc.start(t0);

    activeLoops.faucet = { nSrc, flt, g, c };
  }

  function waterStream(dur) {
    const d = safeNum(dur, 1.0, 0.25, 10);
    faucetFlow(true);
    setTimeout(() => {
      faucetFlow(false);
    }, d * 1000);
  }

  function spongeScrub() {
    // Soapy foam friction
    noise(0.09, 'bandpass', 1250, 1.8, 0.08, 0, 750);
    // Micro bubble pops
    tone(2800 + Math.random() * 800, 0.018, 'sine', 0.035, 1600, 0.015);
    tone(3400 + Math.random() * 900, 0.016, 'sine', 0.030, 1900, 0.045);
  }

  function dishSqueak() {
    // High-friction rubbery clean squeak
    tone(2150, 0.065, 'triangle', 0.08, 3100, 0);
    tone(3100, 0.055, 'triangle', 0.06, 1950, 0.045);
    noise(0.035, 'bandpass', 2800, 3.5, 0.035, 0.01);
  }

  // --------------------------------------------------------------------------
  // INVARIANT 6: Acoustic Stethoscope Heartbeat Thumping (Lub-Dub)
  // --------------------------------------------------------------------------
  function heartbeatThump(bpm) {
    // S1 (Lub): Mitral/tricuspid valve closure, warm low chest thud
    tone(55, 0.095, 'sine', 0.22, 42, 0);
    tone(84, 0.080, 'triangle', 0.12, 50, 0.004);

    // Pause between S1 and S2 (~0.135s)
    // S2 (Dub): Aortic/pulmonary valve closure, crisper sub-bass thud
    tone(72, 0.080, 'sine', 0.20, 50, 0.135);
    tone(108, 0.065, 'triangle', 0.10, 65, 0.138);
  }

  function heartbeat(bpm) {
    heartbeatThump(bpm);
  }

  function startHeartbeat(bpm) {
    stopHeartbeat();
    const rate = safeNum(bpm, 72, 50, 140);
    const intervalMs = (60 / rate) * 1000;
    heartbeatThump(rate);
    activeLoops.heartbeat = setInterval(() => {
      heartbeatThump(rate);
    }, intervalMs);
  }

  function stopHeartbeat() {
    if (activeLoops.heartbeat) {
      clearInterval(activeLoops.heartbeat);
      activeLoops.heartbeat = null;
    }
  }

  // --------------------------------------------------------------------------
  // ADDITIONAL STATION SOUNDSCAPES (Stations 1 to 10)
  // --------------------------------------------------------------------------

  // Station 1: Shopping Cart & Grocery Checkout
  function barcodeBeep() {
    tone(2489.0, 0.038, 'sine', 0.14, 2489.0, 0);
    tone(2793.8, 0.042, 'sine', 0.16, 2793.8, 0.042);
  }
  function scannerBeep() { barcodeBeep(); }

  function registerDrawer() {
    // Bell chime
    tone(1318.5, 0.35, 'sine', 0.12, 1318.5, 0);
    tone(2637.0, 0.20, 'sine', 0.06, 2637.0, 0.005);
    // Drawer rolling slide
    noise(0.14, 'bandpass', 620, 2.2, 0.08, 0.03, 450);
    // Latch stop thud
    tone(140, 0.045, 'triangle', 0.12, 70, 0.16);
  }

  function cartItemDrop() {
    tone(240, 0.04, 'triangle', 0.08, 110, 0);
    noise(0.03, 'bandpass', 1400, 2.5, 0.06, 0.005);
  }

  function cartRoll() {
    for (let i = 0; i < 4; i++) {
      tone(150 + (i % 2) * 35, 0.035, 'triangle', 0.06, 95, i * 0.045);
      noise(0.025, 'bandpass', 920 + i * 110, 2.2, 0.04, i * 0.045);
    }
  }

  // Station 2: Ice Cream Parlor, Soft-Serve Dispenser, Multi-Scoop Cone, Pet Fish Aquarium & Doll Care
  function softServePump(step) {
    const s = safeNum(step, 0, 0, 5);
    const base = 320 + s * 38;
    // Mechanical lever ratchet click
    tone(1150, 0.02, 'triangle', 0.06, 850, 0);
    noise(0.015, 'bandpass', 2400, 3.0, 0.04, 0.005);
    // Creamy soft-serve swirl churn + ascending pastel ribbon pitch
    noise(0.16, 'bandpass', 820 + s * 70, 1.8, 0.075, 0.02, 620 + s * 50);
    tone(base, 0.13, 'sine', 0.065, base * 1.18, 0.025);
    tone(base * 2, 0.075, 'triangle', 0.025, base * 2.1, 0.045);
  }
  function softServeSwirl(step) { softServePump(step); }

  function scoopPlop(step) {
    const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const s = Math.abs(Math.round(safeNum(step, 0))) % notes.length;
    const f = notes[s];
    tone(1520, 0.022, 'triangle', 0.055, 980, 0);
    tone(280, 0.075, 'sine', 0.12, 155, 0.012);
    noise(0.048, 'bandpass', 920, 2.0, 0.07, 0.01, 580);
    tone(f, 0.095, 'sine', 0.07, f * 1.03, 0.035);
  }
  function scoopPop(step) { scoopPlop(step); }

  function aquariumBubble(step) {
    const s = Math.abs(Math.round(safeNum(step, 0)));
    const base = 580 + ((s * 85) % 340);
    tone(base, 0.058, 'sine', 0.075, base * 1.65, 0);
    tone(base * 1.35, 0.045, 'sine', 0.045, base * 1.9, 0.028);
    noise(0.028, 'bandpass', 1650, 2.5, 0.035, 0.008);
  }
  function waterBubble(step) { aquariumBubble(step); }

  function aquariumScrub(step) {
    const s = Math.abs(Math.round(safeNum(step, 0)));
    noise(0.085, 'bandpass', 1450, 2.1, 0.07, 0, 2250);
    tone(1950 + ((s % 4) * 180), 0.05, 'triangle', 0.055, 2650, 0.015);
    tone(1318.5, 0.07, 'sine', 0.05, 1567.98, 0.04);
  }

  function flakeDrop(step) {
    const s = Math.abs(Math.round(safeNum(step, 0)));
    noise(0.026, 'highpass', 3100, 2.8, 0.045, 0);
    const f = 1380 + ((s % 5) * 110);
    tone(f, 0.04, 'sine', 0.065, f * 1.25, 0.018);
    tone(680, 0.045, 'sine', 0.045, 980, 0.048);
  }
  function fishFeed(step) { flakeDrop(step); }

  function dollCareSoothe(kind) {
    if (kind === 'bottle') {
      tone(340, 0.08, 'sine', 0.09, 520, 0);
      tone(380, 0.075, 'sine', 0.08, 580, 0.095);
      noise(0.04, 'bandpass', 1100, 2.2, 0.035, 0.02);
    } else if (kind === 'brush') {
      noise(0.085, 'bandpass', 2100, 1.7, 0.06, 0, 1550);
      tone(1046.5, 0.08, 'sine', 0.055, 1318.5, 0.03);
    } else {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        tone(f, 0.16, 'sine', 0.075, f * 1.005, i * 0.055);
        tone(f * 2, 0.07, 'triangle', 0.022, f * 2, i * 0.055 + 0.008);
      });
    }
  }

  // Station 3: Playset Unboxing, Modular Assembly, Battery Sound Module & Circulating Water Sink
  function unboxPop() {
    // Corrugated cardboard flap pop + hollow carry-case unlatch
    noise(0.055, 'bandpass', 1450, 1.9, 0.12, 0, 820);
    tone(185, 0.065, 'triangle', 0.13, 310, 0.008);
    tone(660, 0.05, 'sine', 0.08, 990, 0.035);
  }

  function boxSnap(step) {
    const s = Math.abs(Math.round(safeNum(step, 0))) % 6;
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const f = scale[s];
    // Crisp ABS plastic locking tab snap click
    tone(1120 + s * 80, 0.024, 'triangle', 0.14, 460, 0);
    noise(0.026, 'highpass', 2700, 2.6, 0.14, 0);
    // Warm hollow toy-case seating thud + ascending pitch confirmation
    tone(210, 0.042, 'sine', 0.09, 125, 0.006);
    tone(f, 0.085, 'sine', 0.075, f * 1.02, 0.022);
  }

  function plasticSnap(step) {
    boxSnap(step);
  }

  function batteryInsert(slotIdx) {
    const idx = Math.abs(Math.round(safeNum(slotIdx, 0))) % 2;
    // Metallic spring coil compression + brass terminal snap
    noise(0.032, 'bandpass', 3200, 3.2, 0.09, 0, 2100);
    tone(1680 + idx * 320, 0.028, 'triangle', 0.11, 920, 0);
    tone(523.25 * (idx ? 1.25 : 1.0), 0.075, 'sine', 0.085, 659.25 * (idx ? 1.25 : 1.0), 0.02);
  }

  function batteryChime() {
    // Cheerful electronic toy-kitchen sound module power-on jingle + LED glow shimmer
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      const d = i * 0.052;
      tone(f, 0.13, 'sine', 0.095, f * 1.01, d);
      tone(f * 2, 0.065, 'triangle', 0.032, f * 2.01, d + 0.006);
    });
  }

  function faucetPump() {
    // Mechanical white gooseneck pump plunger press + suction prime glug
    tone(320, 0.042, 'triangle', 0.095, 165, 0);
    noise(0.038, 'bandpass', 1350, 2.2, 0.075, 0.008, 880);
    tone(480, 0.055, 'sine', 0.07, 740, 0.024);
  }

  function faucetStream(active) {
    if (active === undefined) {
      waterStream(0.85);
      return;
    }
    faucetFlow(!!active);
  }

  // Station 5: Countertop Appliances (Motorized Blender, Spring Pop-Up Toaster & Microwave Turntable)
  function toasterLeverDown() {
    // Spring coil tension compression + bottom latch click
    noise(0.045, 'bandpass', 1850, 2.4, 0.085, 0, 1120);
    tone(420, 0.055, 'triangle', 0.11, 185, 0);
    tone(980, 0.025, 'sine', 0.09, 640, 0.042);
  }

  function toasterSpring() {
    // Spring carriage release + dual toast pop-up + bell ding
    toasterPop();
    toasterDing();
  }

  function blenderPulse(speed) {
    const sp = safeNum(speed, 2, 1, 3);
    const baseF = 110 + sp * 45;
    tone(baseF, 0.16, 'sawtooth', 0.055, baseF * 1.28, 0);
    noise(0.14, 'bandpass', 720 + sp * 260, 1.7, 0.075, 0, 1180 + sp * 240);
    // Frothy fruit chunk chop tick
    tone(480 + sp * 90, 0.055, 'triangle', 0.065, 760 + sp * 110, 0.03);
  }

  function microwaveDoorClick(isOpen) {
    if (isOpen) {
      tone(680, 0.028, 'triangle', 0.09, 980, 0);
      noise(0.032, 'bandpass', 1650, 2.2, 0.065, 0.008, 1100);
    } else {
      tone(310, 0.042, 'triangle', 0.11, 145, 0);
      tone(860, 0.022, 'sine', 0.07, 540, 0.012);
    }
  }

  function microwaveBeep() {
    [0, 0.12, 0.24].forEach(d => {
      tone(1760.0, 0.06, 'sine', 0.11, 1760.0, d);
    });
    tone(2093.0, 0.14, 'sine', 0.085, 2093.0, 0.36);
  }

  function microwaveHum(dur) {
    const d = safeNum(dur, 1.0, 0.15, 10);
    tone(60, d, 'sawtooth', 0.035, 60, 0);
    tone(120, d, 'sine', 0.025, 120, 0);
    noise(Math.min(d, 0.22), 'bandpass', 420, 2.4, 0.022, 0, 520);
  }

  // Station 6: Patisserie Bakery Oven & Cookie Stamper (30:00 - 36:00)
  function whiskMix(step) {
    stir();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const idx = Math.abs(Math.round(safeNum(step, 0))) % notes.length;
    tone(notes[idx] * 2, 0.038, 'triangle', 0.028, notes[idx] * 2.02, 0.012);
  }

  function doughRoll(step) {
    const s = Math.abs(Math.round(safeNum(step, 0))) % 4;
    // Beechwood rolling pin barrel roll + viscoelastic dough stretch + flour dust whisper
    noise(0.14, 'bandpass', 560 + s * 45, 1.8, 0.085, 0, 410 + s * 35);
    tone(158 + s * 12, 0.11, 'triangle', 0.068, 126 + s * 8, 0);
    noise(0.055, 'highpass', 2900, 2.2, 0.032, 0.03, 2100);
  }
  function rollingPin(step) { doughRoll(step); }
  function rollDough(step) { doughRoll(step); }

  function cookieStamp(shapeOrStep) {
    // Crisp pastel/metal cutter press into rolled dough
    tone(680, 0.035, 'triangle', 0.16, 260, 0);
    noise(0.028, 'bandpass', 1900, 2.8, 0.14, 0, 1250);
    // Suction release pop as the stamped star/heart/bear cookie pops out
    tone(420, 0.045, 'sine', 0.09, 780, 0.038);
    // Shape-specific harmonic chime (star = C6, heart = E6, bear = G6)
    let idx = 0;
    if (shapeOrStep === 'heart' || shapeOrStep === 1) idx = 1;
    else if (shapeOrStep === 'bear' || shapeOrStep === 2) idx = 2;
    else if (typeof shapeOrStep === 'number') idx = Math.abs(Math.round(shapeOrStep)) % 3;
    const shapeNotes = [1046.5, 1318.5, 1567.98];
    const f = shapeNotes[idx];
    tone(f, 0.11, 'sine', 0.075, f * 1.015, 0.048);
    tone(f * 2, 0.055, 'triangle', 0.025, f * 2, 0.054);
  }

  function ovenDoor(isOpen) {
    if (isOpen === false) {
      tone(240, 0.052, 'triangle', 0.095, 110, 0);
      tone(880, 0.024, 'sine', 0.055, 660, 0.012);
    } else {
      tone(740, 0.024, 'triangle', 0.065, 980, 0);
      noise(0.07, 'lowpass', 680, 1.4, 0.05, 0.015, 420);
    }
  }

  function ovenBakeTick(progress) {
    const p = safeNum(progress, 0.5, 0, 1);
    noise(0.06, 'bandpass', 1450 + p * 600, 2.2, 0.038, 0, 1850);
    tone(523.25 + p * 260, 0.055, 'sine', 0.035, 587.33 + p * 260, 0.01);
  }

  // Station 7: Bento Box & Whistling Kettle
  function sushiRoll() {
    // Bamboo mat crinkle
    noise(0.08, 'bandpass', 1800, 2.2, 0.09, 0, 1200);
    noise(0.06, 'highpass', 3400, 2.5, 0.07, 0.04);
  }

  function kettleWhistle() {
    // Gentle ascending harmonic whistle
    tone(1760.0, 0.45, 'sine', 0.08, 2093.0, 0);
    tone(3520.0, 0.35, 'sine', 0.03, 4186.0, 0.02);
  }

  function teaPour() {
    pour();
  }

  function condimentSquirt() {
    noise(0.06, 'bandpass', 950, 1.8, 0.09, 0, 1600);
    tone(380, 0.05, 'sine', 0.08, 620, 0.01);
  }


  // Station 9: Sparkling Dishwashing Chore & Kitchen Cleanup (48:00 - 54:00)
  function soapPump() {
    tone(195, 0.045, 'triangle', 0.09, 92, 0);
    noise(0.055, 'bandpass', 980, 1.9, 0.075, 0.012, 1680);
    tone(420, 0.06, 'sine', 0.08, 860, 0.018);
    tone(1180, 0.032, 'sine', 0.055, 1560, 0.065);
  }

  function sudsBubblePop(step) {
    const notes = [659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5];
    const s = safeNum(step, 0);
    const f = notes[Math.abs(Math.round(s)) % notes.length];
    tone(f * 0.92, 0.038, 'sine', 0.065, f * 1.35, 0);
    noise(0.015, 'highpass', 2900, 2.8, 0.032, 0.004);
  }

  function rinseSwirl(step) {
    noise(0.11, 'bandpass', 640, 2.1, 0.085, 0, 1320);
    tone(290, 0.085, 'sine', 0.075, 540, 0.008);
    tone(430, 0.065, 'sine', 0.055, 720, 0.035);
    const scale = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5];
    const s = safeNum(step, 0);
    const f = scale[Math.abs(Math.round(s)) % scale.length];
    tone(f, 0.075, 'sine', 0.05, f * 1.04, 0.04);
  }

  function squeakyClean() {
    dishSqueak();
    [1046.5, 1318.5, 1567.98, 2093.0].forEach((f, i) => {
      tone(f, 0.13, 'sine', 0.085, f * 1.01, 0.08 + i * 0.042);
      tone(f * 2, 0.06, 'triangle', 0.025, f * 2, 0.088 + i * 0.042);
    });
  }

  function plateStack(slotIdx) {
    tone(230, 0.038, 'triangle', 0.08, 108, 0);
    tone(1850, 0.05, 'sine', 0.095, 1460, 0.005);
    tone(2780, 0.035, 'triangle', 0.04, 2420, 0.01);
    noise(0.022, 'bandpass', 3200, 3.0, 0.042, 0);
    const notes = [659.25, 783.99, 880.0, 1046.5];
    const s = safeNum(slotIdx, 0);
    const f = notes[Math.abs(Math.round(s)) % notes.length];
    tone(f, 0.09, 'sine', 0.07, f * 1.015, 0.022);
  }

  function rackPlace(slotIdx) {
    plateStack(slotIdx);
  }

  function waterDrip() {
    tone(640, 0.055, 'sine', 0.065, 1280, 0);
    tone(1280, 0.028, 'sine', 0.025, 1520, 0.018);
  }

  function binPedalOpen(isOpen) {
    if (isOpen === false) {
      tone(220, 0.048, 'triangle', 0.085, 88, 0);
      noise(0.028, 'lowpass', 720, 1.5, 0.045, 0.004);
    } else {
      tone(920, 0.022, 'triangle', 0.07, 640, 0);
      tone(165, 0.055, 'sine', 0.08, 295, 0.01);
      noise(0.035, 'bandpass', 1450, 2.0, 0.04, 0.008, 920);
    }
  }

  function recycleClink(step) {
    tone(1420, 0.048, 'sine', 0.09, 1180, 0);
    tone(2140, 0.036, 'triangle', 0.055, 1860, 0.008);
    noise(0.028, 'bandpass', 2600, 2.6, 0.05, 0);
    const scale = [587.33, 739.99, 880.0, 1174.66];
    const s = safeNum(step, 0);
    const f = scale[Math.abs(Math.round(s)) % scale.length];
    tone(f, 0.11, 'sine', 0.08, f * 1.02, 0.03);
  }

  function trashBinSort(kind, step) {
    if (kind === 'recycle') {
      recycleClink(step);
      return;
    }
    noise(0.042, 'bandpass', 1950, 2.1, 0.065, 0, 1250);
    tone(180, 0.05, 'triangle', 0.095, 86, 0.012);
    const scale = [523.25, 659.25, 783.99, 1046.5];
    const s = safeNum(step, 0);
    const f = scale[Math.abs(Math.round(s)) % scale.length];
    tone(f, 0.1, 'sine', 0.075, f * 1.015, 0.028);
  }

  function cleanupFanfare() {
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      tone(f, 0.18, 'sine', 0.095, f * 1.01, i * 0.048);
      tone(f * 2, 0.08, 'triangle', 0.03, f * 2, i * 0.048 + 0.008);
    });
  }

  // Station 10: Little Doctor Clinic & Plushie Wellness Care (54:00 - 61:44)
  function clinicCaseSnap() {
    tone(880, 0.025, 'triangle', 0.11, 460, 0);
    noise(0.025, 'highpass', 2400, 2.5, 0.08, 0.004);
    tone(1174.66, 0.06, 'sine', 0.08, 1318.5, 0.028);
  }

  function thermometerScan(step) {
    const s = safeNum(step, 0);
    const f = 1480 + (Math.abs(Math.round(s)) % 5) * 140;
    tone(f, 0.032, 'sine', 0.075, f * 1.04, 0);
  }

  function thermometerBeep() {
    // Rapid clinical 3-beep + healthy resolution chime
    [0, 0.07, 0.14].forEach(d => {
      tone(2637.0, 0.035, 'sine', 0.12, 2637.0, d);
    });
    tone(3135.96, 0.11, 'sine', 0.09, 3135.96, 0.22);
  }

  function bandaidPeel() {
    // Tactile crinkle-peel of adhesive backing paper
    noise(0.055, 'bandpass', 3600, 2.4, 0.11, 0, 2400);
    noise(0.04, 'highpass', 4200, 2.8, 0.08, 0.03, 3000);
  }

  function bandaidSnap() {
    // Adhesive peel
    noise(0.04, 'bandpass', 3800, 2.5, 0.12, 0, 2600);
    // Elastic snap + soft pat
    tone(1100, 0.025, 'triangle', 0.14, 520, 0.035);
    tone(240, 0.045, 'sine', 0.09, 130, 0.055);
    // Comforting sparkle chime
    [783.99, 1046.5, 1318.5].forEach((f, i) => {
      tone(f, 0.09, 'sine', 0.065, f * 1.01, 0.07 + i * 0.035);
    });
  }

  function bandaidStick(step) {
    bandaidSnap(step);
  }

  function dropperSqueeze() {
    // Rubber bulb squeeze + liquid suction glug
    noise(0.05, 'bandpass', 920, 2.0, 0.07, 0, 1480);
    tone(320, 0.065, 'sine', 0.085, 680, 0.012);
    tone(740, 0.04, 'sine', 0.06, 1120, 0.055);
  }

  function medicineDrop(step) {
    const s = safeNum(step, 0);
    const scale = [783.99, 880.0, 1046.5, 1174.66, 1318.5];
    const f = scale[Math.abs(Math.round(s)) % scale.length];
    tone(f, 0.048, 'sine', 0.095, f * 1.45, 0);
    noise(0.022, 'bandpass', 2400, 2.8, 0.04, 0.01);
    // Gentle happy swallow gulp
    tone(290, 0.07, 'sine', 0.08, 520, 0.065);
    tone(f * 1.5, 0.08, 'sine', 0.06, f * 1.52, 0.11);
  }

  function medicineSwallow() {
    tone(280, 0.08, 'sine', 0.10, 560, 0);
    tone(587.33, 0.09, 'sine', 0.075, 880.0, 0.07);
  }

  function groomBrush(step) {
    // Soft plush bristle sweep + harmonic sparkle
    noise(0.095, 'bandpass', 2200, 1.6, 0.075, 0, 1650);
    noise(0.055, 'highpass', 3400, 2.2, 0.04, 0.025);
    const s = safeNum(step, 0);
    const notes = [659.25, 783.99, 987.77, 1046.5, 1318.5];
    const f = notes[Math.abs(Math.round(s)) % notes.length];
    tone(f, 0.07, 'sine', 0.05, f * 1.03, 0.03);
  }

  function groomStroke(step) {
    groomBrush(step);
  }

  // --------------------------------------------------------------------------
  // EXISTING PRESERVED METHODS (Backwards Compatibility)
  // --------------------------------------------------------------------------
  function turntableClick(step) {
    const scale = [880, 987.77, 1046.5, 1174.66, 1318.5, 1396.91];
    const s = safeNum(step, 0);
    const f = scale[Math.abs(Math.round(s)) % scale.length];
    tone(f, 0.024, 'triangle', 0.038, f * 0.96, 0);
    noise(0.016, 'bandpass', 2400, 3.5, 0.02, 0);
  }

  function candyPop(step) {
    const rainbowNotes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const s = safeNum(step, 0);
    const f = rainbowNotes[Math.abs(Math.round(s)) % rainbowNotes.length];
    tone(f * 1.15, 0.045, 'sine', 0.08, f, 0);
    noise(0.018, 'highpass', 2600, 2.5, 0.04, 0);
    tone(f * 2, 0.028, 'triangle', 0.025, f * 2, 0.003);
  }

  function buttercreamSwoosh() {
    noise(0.08, 'bandpass', 1100, 1.6, 0.045, 0, 750);
    tone(440, 0.07, 'sine', 0.035, 390, 0);
    tone(660, 0.045, 'sine', 0.018, 620, 0.018);
  }

  function woodTap() {
    tone(210, 0.032, 'triangle', 0.07, 95, 0);
    noise(0.022, 'bandpass', 1100, 2.2, 0.04, 0);
  }

  function popSelect(pitchStep) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const s = safeNum(pitchStep, 0);
    const f = scale[Math.abs(Math.round(s)) % scale.length];
    tone(f * 0.9, 0.065, 'sine', 0.08, f, 0);
    tone(f * 2, 0.04, 'triangle', 0.025, f * 2.02, 0.008);
    noise(0.016, 'bandpass', f * 2.2, 2.8, 0.02, 0);
  }

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
    const s = safeNum(idx, 0);
    const ch = chords[Math.abs(Math.round(s)) % chords.length];
    ch.forEach((f, i) => {
      tone(f, 0.14, 'sine', 0.09, f * 1.01, i * 0.045);
      tone(f * 2, 0.06, 'triangle', 0.025, f * 2, i * 0.045 + 0.008);
    });
  }

  function blowCandle() {
    noise(0.26, 'lowpass', 620, 1.1, 0.16, 0, 210);
    noise(0.06, 'highpass', 3200, 2.4, 0.055, 0.04, 1800);
    [783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => {
      tone(f, 0.15, 'sine', 0.09, f * 1.01, 0.06 + i * 0.05);
    });
  }

  function candleInsert(step) {
    noise(0.042, 'bandpass', 1150, 1.8, 0.06, 0, 780);
    tone(320, 0.055, 'sine', 0.08, 480, 0);
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    const f = notes[Math.abs(Math.round(step || 0)) % notes.length];
    tone(f, 0.11, 'sine', 0.085, f * 1.02, 0.028);
    tone(f * 2, 0.055, 'triangle', 0.028, f * 2.01, 0.036);
  }

  function musicalKnife(step) {
    velcroRip(0);
    velcroRip(0.035);
    const melody = [
      523.25, 523.25, 587.33, 523.25, 698.46, 659.25,
      523.25, 523.25, 587.33, 523.25, 783.99, 698.46,
    ];
    const idx = Math.abs(Math.round(step || 0)) * 2;
    for (let k = 0; k < 2; k++) {
      const f = melody[(idx + k) % melody.length];
      const d = 0.03 + k * 0.11;
      tone(f, 0.16, 'sine', 0.11, f * 1.005, d);
      tone(f * 2, 0.09, 'triangle', 0.038, f * 2, d + 0.006);
      tone(f * 3, 0.045, 'sine', 0.016, f * 3, d + 0.01);
    }
  }

  function candyScoop(step) {
    tone(2180, 0.045, 'sine', 0.075, 2240, 0);
    tone(3270, 0.03, 'triangle', 0.03, 3310, 0.004);
    const baseNotes = [659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5];
    const s = Math.abs(Math.round(step || 0));
    for (let i = 0; i < 4; i++) {
      const f = baseNotes[(s + i) % baseNotes.length];
      const d = 0.022 + i * 0.026;
      tone(f * 1.1, 0.036, 'sine', 0.065, f, d);
      noise(0.014, 'highpass', 2800, 2.8, 0.035, d);
    }
  }

  function crackEgg() {
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

  function stir() {
    noise(0.085, 'bandpass', 660, 1.5, 0.075, 0, 1100);
    const base = 420 + Math.random() * 130;
    tone(base, 0.065, 'sine', 0.065, base * 1.32, 0.008);
    tone(base * 1.25, 0.05, 'sine', 0.045, base * 1.55, 0.038);
    if (Math.random() < 0.45) {
      tone(2150 + Math.random() * 320, 0.022, 'triangle', 0.025, 1850, 0.018);
    }
  }

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

  function playChomp(isDrink) {
    if (isDrink) {
      tone(310, 0.14, 'sine', 0.13, 760, 0);
      noise(0.11, 'bandpass', 1300, 2.2, 0.08, 0.02, 2200);
      tone(587.33, 0.09, 'sine', 0.08, 880, 0.14);
    } else {
      noise(0.065, 'bandpass', 1700, 1.35, 0.16, 0, 1100);
      tone(230, 0.075, 'triangle', 0.15, 92, 0);
      noise(0.058, 'bandpass', 1900, 1.4, 0.14, 0.095, 1250);
      tone(270, 0.07, 'triangle', 0.13, 112, 0.095);
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

  function stopAll() {
    stopBlender();
    stopSizzle();
    faucetFlow(false);
    stopHeartbeat();
  }

  return {
    ensure,
    whoosh,
    popSelect,
    critterChime,
    chop,
    slice,
    velcroSlice: slice,
    velcroRip,
    blowCandle,
    candleBlow: blowCandle,
    candleInsert,
    musicalKnife,
    candyScoop,
    crackEgg,
    eggCrack: crackEgg,
    pour,
    stir,
    blendTick,
    blendHum,
    startBlender,
    stopBlender,
    sizzleTick,
    sizzle,
    startSizzle,
    stopSizzle,
    boilBubble,
    soupBubble: boilBubble,
    panToss,
    flip,
    ovenDing,
    toasterPop,
    toasterDing,
    toasterSpring,
    toasterLeverDown,
    butterSpread,
    blenderPulse,
    microwaveDoorClick,
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
    waterSplash,
    splash: waterSplash,
    faucetFlow,
    waterStream,
    spongeScrub,
    dishSqueak,
    heartbeatThump,
    heartbeat,
    startHeartbeat,
    stopHeartbeat,
    barcodeBeep,
    scannerBeep,
    registerDrawer,
    cashRegister: registerDrawer,
    cartItemDrop,
    cartRoll,
    softServePump,
    softServeSwirl,
    scoopPlop,
    scoopPop,
    aquariumBubble,
    waterBubble,
    aquariumScrub,
    flakeDrop,
    fishFeed,
    dollCareSoothe,
    unboxPop,
    boxSnap,
    plasticSnap,
    batteryInsert,
    batteryChime,
    faucetPump,
    faucetStream,
    stoveDialClick,
    dialClick,
    sausageFlip,
    eggSizzle,
    microwaveBeep,
    microwaveHum,
    whiskMix,
    doughRoll,
    rollingPin,
    rollDough,
    cookieStamp,
    ovenDoor,
    ovenBakeTick,
    sushiRoll,
    kettleWhistle,
    teaPour,
    condimentSquirt,
    burgerStack: condimentSquirt,
    plateStack,
    dishClink: plateStack,
    rackPlace,
    soapPump,
    sudsBubblePop,
    rinseSwirl,
    squeakyClean,
    waterDrip,
    binPedalOpen,
    recycleClink,
    trashBinSort,
    binSort: trashBinSort,
    cleanupFanfare,
    clinicCaseSnap,
    thermometerScan,
    thermometerBeep,
    bandaidPeel,
    bandaidSnap,
    bandaidStick,
    dropperSqueeze,
    medicineDrop,
    dropperPlop: medicineDrop,
    medicineSwallow,
    groomBrush,
    brushGroom: groomBrush,
    groomStroke,
    stopAll,
    isMuted: () => muted,
    setMuted: m => {
      muted = !!m;
      if (masterGain && ctx) {
        masterGain.gain.setValueAtTime(muted ? 0.0 : 0.75, ctx.currentTime);
      }
      if (muted) stopAll();
    },
  };
})();

if (typeof window !== 'undefined') {
  window.KitchenAudio = KitchenAudio;
  window.SoundFX = KitchenAudio;
}
