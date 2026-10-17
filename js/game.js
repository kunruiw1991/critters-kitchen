'use strict';
/* ==========================================================================
 * Chuyu's Rainbow Kitchen — Pinterest Cozy Patisserie Interactive Engine
 * 100% Custom Gouache Vector Art, Zero System Emojis, Zero Speech/Text,
 * 60fps Squash-and-Stretch Spring Physics & Tactile Kitchen ASMR
 * --------------------------------------------------------------------------
 * Studio choreography layer (cozy Toca / Nintendo-style motion):
 *   tick(dt) — fixed-step spring physics + keyframed animation timelines
 *   draw()   — paints the frame through the KitchenArt renderers (art.js)
 * Logical game state (prepTray, mixProgress, dish.bitesTaken, ...) always
 * updates synchronously so headless scripts stay deterministic, while the
 * visible choreography (knife arcs, pan tosses, spoon flights) catches up.
 * ========================================================================== */
const KitchenGame = (() => {
  const STORAGE_KEY = 'chuyu_rainbow_kitchen_v3';
  const PI2 = Math.PI * 2;
  const CRITTER_X = 0.46;
  const CRITTER_SCALE = 1.08;
  const PHYS_STEP = 1 / 120;
  const MAX_PARTICLES = 320;
  const MAX_CONFETTI = 170;
  const KNIFE_IMPACT = 0.45;        // knifeSlash.t at which the blade hits the board
  const SPOON_SCOOP_END = 0.28;     // Phase A (scoop) -> Phase B (flight)
  const SPOON_DELIVER = 0.72;       // Phase B (flight) -> Phase C (chomp & return)
  const TOSS_LAUNCH = 0.2;          // panToss.t at which food leaves the skillet
  const TOSS_FLIGHT = 0.5;          // normalized airborne time per tossed body
  const CHEW_TIME = 1.2;            // seconds of cheek-puff chewing per bite
  const REACT_AT_CHEW = 0.85;       // chewTimer value at which the reaction fires
  // Plate-local scoop points for the 3 portions (right, left, back-centre).
  const PORTION_POINTS = [
    { x: 50, y: 4 },
    { x: -48, y: 6 },
    { x: 0, y: -24 },
  ];
  const CONFETTI_COLS = ['#F4A6B8', '#F7D58B', '#9CD3C2', '#A9C7EE', '#C9B3E8', '#FFB38A', '#E87A82'];

  let canvas, ctx;
  let W = 960, H = 560, dpr = 1;
  let t = 0, lastTs = 0, physAcc = 0, timeScale = 1;
  let ctxNeedsReset = false;

  // Game Mode & Customer State
  let mode = 'wish'; // 'wish' | 'free'
  let critterIdx = 3; // Start with Bobby BearHug
  let orderIdx = 0;
  let station = 1; // 1:Chop, 2:Mix, 3:Cook, 4:Decorate, 5:Feed
  let activeCategory = 'fruit';

  // Station 1: Cutting Board State (logical)
  let boardItem = null; // { id, chops: 0, maxChops: 3, sliced: false, cracked: false }
  let prepTray = [];    // Array of prepped items: { id, sliced, cracked, cooked: 0 }
  let trayHidden = 0;   // newest prep items still hopping toward the basket
  let slashTrail = [];
  let lastFinishT = -10;

  // Station 2: Mixing Bowl & Blender State
  let mixMode = 'bowl'; // 'bowl' | 'blender'
  let mixItems = [];
  let mixProgress = 0;
  let mixColor = '#FFF5DC';

  // Station 3: Skillet Pan & Oven State
  let cookMode = 'pan'; // 'pan' | 'oven'
  let heatLevel = 2;    // 1:Low, 2:Med, 3:High
  let panItems = [];
  let cookProgress = 0;
  let sizzleTimer = 0;

  // Station 4 & 5: Plated Dish State
  let dish = createFreshDish();
  let decorTool = 'piping'; // 'piping' | 'sauce' | 'topping'
  let pipingColorIdx = 1;
  let sauceIdx = 0;
  let toppingIdx = 0;
  let activeStroke = null;
  let hoverPt = { x: 480, y: 360 };
  let dollopPops = [];

  // Station 5: Feeding Spoon & Critter Reaction State
  let fork = { x: 0, y: 0, dragging: false, homeX: 0, homeY: 0 };
  let spoonGrab = null;
  let spoonQueue = [];
  let starsEarned = 0;
  let album = [];
  let serveSuccess = false;
  let servedCount = 0;
  let lastReaction = null;

  /* ==========================================================================
   * Shared Animation State (read by KitchenArt renderers in art.js)
   * ========================================================================== */
  const state = {
    t: 0,
    station: 1,
    // Critter rig inputs
    mouthOpen: 0,
    chewTimer: 0,
    chewing: 0,
    mouthChompT: 0,
    reaction: null,
    reactionTimer: 0,
    celebrate: 0,
    celebrateTimer: 0,
    pendingReaction: null,
    lookX: 0,
    lookY: 0,
    lookTarget: { x: 440, y: 300 },
    pointer: { x: 440, y: 300 },
    anticipation: 0,
    wave: 0,
    critterX: 0,
    critterY: 0,
    critterScale: CRITTER_SCALE,
    counterY: 0,
    // Elastic camera slide between stations
    stationSlideOffset: 0,
    stationSlideVel: 0,
    stationTransition: { active: false, from: 1, to: 1, dir: 1, span: 900, t: 0 },
    // Squash & recoil springs
    boardSpring: { sx: 1, sy: 1, vx: 0, vy: 0 },
    boardRecoil: 0,
    boardRecoilVel: 0,
    // Station 1: knife choreography
    knifeSlash: {
      active: false, t: 0, duration: 0.32, delay: 0, sliceIndex: 0,
      cutX: 0, cutY: 0, impactDone: true, whooshed: true, targetChops: 0,
      view: null, from: null, pose: { x: 0, y: 0, angle: 0.3 }, trail: [],
    },
    sliceSepProgress: 1,
    sliceSepVel: 0,
    boardView: null,
    hopSlices: [],
    // Station 2: orbital whisk & vortex
    mixVelocity: 0,
    mixSwirlAngle: 0,
    whiskOrbit: -0.7,
    whiskHeld: false,
    whiskTarget: 0,
    bowlTilt: 0,
    bowlTiltVel: 0,
    mixBarShown: 0,
    // Station 3: chef pan toss
    panToss: {
      active: false, t: 0, duration: 0.95, height: 118, spin: 1,
      panDy: 0, panTilt: 0, bodies: [], baseBody: null, plan: [],
    },
    panCatch: 0,
    panCatchVel: 0,
    ovenPulse: 0,
    ovenPulseVel: 0,
    cookNeedleShown: 0,
    // Station 4: piping bag & bouncy toppings
    pipingAnim: { active: false, t: 0, x: 0, y: 0, color: '#FFFDF9', kind: 'piping', squeeze: 0, shake: 0 },
    toppingSprings: [],
    toolPos: { x: 480, y: 360, vx: 0, vy: 0 },
    toolTilt: 0,
    // Station 5: 3-phase spoon feeding
    flyingSpoon: {
      active: false, t: 0, duration: 1.25, phase: 'idle',
      x: 0, y: 0, angle: -0.55, squash: 1, scale: 1, loaded: false,
      ingId: 'strawberry', color: '#E88388',
      startX: 0, startY: 0, ctrlX: 0, ctrlY: 0, endX: 0, endY: 0,
      fromX: 0, fromY: 0, fromAngle: -0.55,
      biteIndex: 0, rxnKind: 'love', scooped: false, delivered: false, portion: 0, manual: false,
    },
    dragMouth: 0,
    scoopProgress: 0,
    scoopsShown: 0,
    bitesEaten: 0,
    flash: 0,
    flashAt: -1,
    // FX
    particles: [],
    confetti: [],
    flyers: [],
    guideDash: 0,
  };
  const critterAnim = state; // legacy alias for older call sites
  const popIns = new WeakMap(); // logical item -> time it lands (pop-in spring)

  /* ==========================================================================
   * Math, Easing & Safety Helpers
   * ========================================================================== */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (k, a, b) => clamp01((k - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const easeOutCubic = k => 1 - Math.pow(1 - k, 3);
  const easeInCubic = k => k * k * k;
  const easeInQuad = k => k * k;
  const easeInOutCubic = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const easeOutBack = k => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  };

  function wrapAngle(a) {
    while (a > Math.PI) a -= PI2;
    while (a < -Math.PI) a += PI2;
    return a;
  }

  // Analytic under-damped spring step response (0 -> 1 with a juicy overshoot)
  function springPop(tau, zeta, omega) {
    if (tau <= 0) return 0;
    const z = zeta || 0.42, w = omega || 17;
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + ((z * w) / wd) * Math.sin(wd * tau));
  }

  function lerpPose(a, b, k) {
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), angle: lerp(a.angle, b.angle, k) };
  }

  // Pure WebAudio ASMR hooks (KitchenAudio / audio.js). Never speech, never fatal.
  function sfx(name, a, b) {
    try {
      if (typeof KitchenAudio !== 'undefined' && KitchenAudio && typeof KitchenAudio[name] === 'function') {
        KitchenAudio[name](a, b);
        return true;
      }
    } catch (e) { /* audio is decorative */ }
    return false;
  }

  // Feature-detected KitchenArt renderers with graceful in-house fallbacks.
  const artErrors = {};
  function artFn(name) {
    if (artErrors[name] || typeof KitchenArt === 'undefined' || !KitchenArt) return null;
    const fn = KitchenArt[name];
    return typeof fn === 'function' ? fn : null;
  }

  function callArt(name, args, fallback) {
    const c = args[0];
    const fn = artFn(name);
    if (fn) {
      c.save();
      try {
        fn.apply(KitchenArt, args);
        c.restore();
        return true;
      } catch (e) {
        c.restore();
        artErrors[name] = String((e && e.message) || e);
        ctxNeedsReset = true;
      }
    }
    if (fallback) {
      c.save();
      try {
        fallback();
      } finally {
        c.restore();
      }
    }
    return false;
  }

  /* ==========================================================================
   * Springs & Squash
   * ========================================================================== */
  function stepBoardSpring(sp, h) {
    const k = 260, damp = 13;
    const ax = (1 - sp.sx) * k - sp.vx * damp;
    const ay = (1 - sp.sy) * k - sp.vy * damp;
    sp.vx += ax * h;
    sp.vy += ay * h;
    sp.sx += sp.vx * h;
    sp.sy += sp.vy * h;
  }

  // Velocity impulse: squash grows smoothly, rebounds and wobbles like jelly.
  function squashImpulse(sx, sy) {
    const sp = state.boardSpring;
    sp.vx += ((sx || 1.2) - 1) * 24;
    sp.vy += ((sy || 0.82) - 1) * 24;
  }

  function triggerSquash(sx, sy) {
    squashImpulse(sx || 1.28, sy || 0.76);
  }

  function createFreshDish() {
    return {
      vessel: 'plate',
      bakedCake: false,
      liquidColor: null,
      items: [],
      piping: [],
      sauces: [],
      toppings: [],
      bitesTaken: 0,
    };
  }

  function loadStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.starsEarned === 'number') starsEarned = parsed.starsEarned;
        if (Array.isArray(parsed.album)) album = parsed.album;
      }
    } catch (e) {}
    updateAlbumBadge();
  }

  function saveStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        starsEarned,
        album: album.slice(0, 24),
      }));
    } catch (e) {}
    updateAlbumBadge();
  }

  function updateAlbumBadge() {
    const starEl = document.getElementById('starCount');
    if (starEl) starEl.textContent = String(starsEarned);
    const albumEl = document.getElementById('albumCount');
    if (albumEl) albumEl.textContent = String(album.length);
  }

  function currentCritter() {
    return KitchenData.CRITTERS[critterIdx] || KitchenData.CRITTERS[0];
  }

  function currentOrder() {
    return KitchenData.WISH_ORDERS[orderIdx % KitchenData.WISH_ORDERS.length];
  }

  /* ==========================================================================
   * Layout Helpers (canvas CSS px)
   * ========================================================================== */
  function stationCenter(st) {
    const cx = W * 0.46;
    if (st === 1) return { x: cx, y: H * 0.68 };
    if (st === 5) return { x: cx, y: H * 0.67 };
    return { x: cx, y: H * 0.69 };
  }

  function counterLineY() {
    const fn = artFn('getCounterY');
    if (fn) {
      try {
        const y = fn.call(KitchenArt, W, H);
        if (isFinite(y)) return y;
      } catch (e) {
        artErrors.getCounterY = String((e && e.message) || e);
      }
    }
    return H * 0.45;
  }

  function critterAnchor() {
    // Counter-anchored rig (art.js clips the torso at counterY): keep the face
    // a constant height above the counter edge on every canvas height.
    if (artFn('getCritterMouth')) {
      return { x: W * CRITTER_X, y: counterLineY() - 112 * CRITTER_SCALE };
    }
    // Legacy rig: seat the torso on the backdrop countertop (wallH = H * 0.47)
    return { x: W * CRITTER_X, y: H * 0.47 - 78 * CRITTER_SCALE };
  }

  function mouthPoint() {
    const a = critterAnchor();
    const fn = artFn('getCritterMouth');
    if (fn) {
      try {
        const m = fn.call(KitchenArt, a.x, a.y, CRITTER_SCALE, state, t);
        if (m && isFinite(m.x) && isFinite(m.y)) return { x: m.x, y: m.y };
      } catch (e) {
        artErrors.getCritterMouth = String((e && e.message) || e);
      }
    }
    return { x: a.x, y: a.y + 6 * CRITTER_SCALE };
  }

  // Spoon target (w*0.48, h*0.29), kept inside the wide-open "Ahh!" mouth.
  function spoonEndPoint(m) {
    const bx = W * 0.48, by = H * 0.29;
    const dx = bx - m.x, dy = by - m.y, d = Math.hypot(dx, dy), maxD = 20;
    if (d <= maxD) return { x: bx, y: by };
    return { x: m.x + (dx / d) * maxD, y: m.y + (dy / d) * maxD };
  }

  function domPointInCanvas(el) {
    if (!el || !canvas) return null;
    const r = el.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    if (!cr.width || !cr.height || (!r.width && !r.height)) return null;
    return {
      x: ((r.left + r.width / 2 - cr.left) / cr.width) * W,
      y: ((r.top + r.height / 2 - cr.top) / cr.height) * H,
    };
  }

  function basketPoint() {
    const tray = document.getElementById('prepTrayStrip');
    if (tray && canvas) {
      const r = tray.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      if (r.width && cr.width) {
        return {
          x: ((r.right - 24 - cr.left) / cr.width) * W,
          y: ((r.top + r.height / 2 - cr.top) / cr.height) * H,
        };
      }
    }
    return { x: W - 60, y: 32 };
  }

  // Horizontal offset of a station's layer during the camera slide (null = off screen)
  function layerOffset(st) {
    const tr = state.stationTransition;
    if (!tr.active) return st === station ? 0 : null;
    if (st === tr.to) return state.stationSlideOffset;
    if (st === tr.from) return state.stationSlideOffset - tr.dir * tr.span;
    return null;
  }

  function stationVisible(st) {
    const o = layerOffset(st);
    return o !== null && Math.abs(o) < W + 40;
  }

  /* ==========================================================================
   * Rich Particle Physics (air drag, spin, pop-in/out, glow & soft shadows)
   * layer 0 = screen space, layer 1..5 = rides with that station's slide layer
   * ========================================================================== */
  function spawnParticle(o) {
    const ps = state.particles;
    if (ps.length >= MAX_PARTICLES) ps.splice(0, ps.length - MAX_PARTICLES + 1);
    const life = o.life || 0.9;
    const p = {
      x: o.x,
      y: o.y,
      vx: o.vx || 0,
      vy: o.vy || 0,
      g: o.g === undefined ? 520 : o.g,
      drag: o.drag === undefined ? 1.6 : o.drag,
      rot: o.rot === undefined ? Math.random() * PI2 : o.rot,
      vrot: o.vrot === undefined ? rand(-6, 6) : o.vrot,
      r: o.r || 6,
      color: o.color || '#E88388',
      kind: o.kind || 'circle',
      life,
      maxLife: life,
      glow: !!o.glow,
      layer: o.layer === undefined ? 0 : o.layer,
      seed: Math.random() * 10,
      scale: 0,
      alpha: 1,
    };
    ps.push(p);
    return p;
  }

  // Legacy radial burst signature (x, y, color, count, kind)
  function spawnParticles(x, y, color, count, kind, layer) {
    const n = count || 12;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * PI2;
      const sp = 70 + Math.random() * 170;
      const k = kind || (i % 3 === 0 ? 'star' : 'droplet');
      const floaty = k === 'smoke' || k === 'steam';
      spawnParticle({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 90,
        r: k === 'star' || k === 'heart' ? rand(5, 9) : rand(3.5, 7),
        color,
        kind: k,
        life: rand(0.7, 1.15),
        glow: k === 'star' || k === 'heart' || k === 'sparkle',
        g: floaty ? -40 : 560,
        drag: floaty ? 2.2 : 1.4,
        layer: layer === undefined ? 0 : layer,
      });
    }
  }

  function juiceBurst(x, y, colA, colB, n, layer) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-1.3, 1.3);
      const sp = rand(150, 340);
      spawnParticle({
        x: x + rand(-6, 6), y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: 980, drag: 0.8, r: rand(2.8, 5.8),
        color: i % 2 ? colA : colB, kind: 'droplet', life: rand(0.55, 0.9), layer,
      });
    }
    for (let i = 0; i < 3; i++) {
      spawnParticle({
        x: x + rand(-22, 22), y: y - rand(10, 30),
        vx: rand(-60, 60), vy: rand(-150, -60),
        g: 120, drag: 2.2, r: rand(5, 8),
        color: '#FFF3B8', kind: 'sparkle', glow: true, life: rand(0.5, 0.8), layer,
      });
    }
  }

  function starBurst(x, y, color, n, layer, upward) {
    for (let i = 0; i < n; i++) {
      const a = upward ? -Math.PI / 2 + rand(-0.9, 0.9) : rand(0, PI2);
      const sp = rand(110, 260);
      spawnParticle({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (upward ? 30 : 60),
        g: 380, drag: 1.7, r: rand(5, 9),
        color: Array.isArray(color) ? color[i % color.length] : color,
        kind: i % 4 === 3 ? 'sparkle' : 'star', glow: true, life: rand(0.7, 1.1), layer,
      });
    }
  }

  function heartBurst(x, y, n, layer) {
    const cols = ['#E87A82', '#F4A6B8', '#F7C948'];
    for (let i = 0; i < n; i++) {
      spawnParticle({
        x: x + rand(-18, 18), y: y + rand(-8, 8),
        vx: rand(-95, 95), vy: rand(-220, -110),
        g: -30, drag: 1.9, r: rand(6, 10),
        color: cols[i % 3], kind: i % 3 === 2 ? 'sparkle' : 'heart',
        glow: true, life: rand(0.9, 1.4), vrot: rand(-2, 2), layer: layer || 0,
      });
    }
  }

  function steamPuff(x, y, n, layer, dark) {
    for (let i = 0; i < n; i++) {
      spawnParticle({
        x: x + rand(-14, 14), y: y + rand(-6, 6),
        vx: rand(-14, 14), vy: rand(-75, -40),
        g: -18, drag: 1.1, r: rand(6, 11),
        color: dark ? 'rgba(85, 70, 62, 0.55)' : 'rgba(255, 252, 244, 0.8)',
        kind: 'steam', life: rand(0.8, 1.3), vrot: 0, layer,
      });
    }
  }

  function ringPulse(x, y, color, layer, r) {
    spawnParticle({ x, y, vx: 0, vy: 0, g: 0, drag: 0, r: r || 12, color, kind: 'ring', life: 0.4, vrot: 0, layer });
  }

  function crumbBurst(x, y, color, n, layer) {
    for (let i = 0; i < n; i++) {
      spawnParticle({
        x: x + rand(-8, 8), y,
        vx: rand(-85, 85), vy: rand(-130, -20),
        g: 900, drag: 0.6, r: rand(2.2, 4),
        color: i % 2 ? color : '#E9C189', kind: 'crumb', life: rand(0.5, 0.8), layer: layer || 0,
      });
    }
  }

  function spawnConfetti(x, y, vx, vy, layer) {
    const cs = state.confetti;
    if (cs.length >= MAX_CONFETTI) cs.splice(0, cs.length - MAX_CONFETTI + 1);
    const color = CONFETTI_COLS[Math.floor(Math.random() * CONFETTI_COLS.length)];
    const life = rand(1.6, 2.6);
    const roll = Math.random();
    cs.push({
      x, y, vx, vy,
      rot: rand(0, PI2), vrot: rand(-7, 7),
      flip: rand(0, PI2), vflip: rand(7, 14),
      w: rand(6, 10), h: rand(9, 15),
      color, back: KitchenArt.lerpColor(color, '#5C3D2E', 0.22),
      life, maxLife: life, seed: Math.random() * 10,
      layer: layer || 0,
      shape: roll < 0.22 ? 'heart' : (roll < 0.45 ? 'circle' : 'rect'),
    });
  }

  function confettiBurst(x, y, n, layer) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-1.2, 1.2);
      const sp = rand(170, 350);
      spawnConfetti(x, y, Math.cos(a) * sp, Math.sin(a) * sp, layer);
    }
  }

  function confettiRain(n) {
    for (let i = 0; i < n; i++) {
      spawnConfetti(rand(0, W), rand(-70, -10) - i * 2.5, rand(-40, 40), rand(40, 130), 0);
    }
  }

  function updateParticles(dt) {
    const ps = state.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0 || p.y > H + 80) {
        ps.splice(i, 1);
        continue;
      }
      const fr = Math.exp(-p.drag * dt);
      p.vx *= fr;
      p.vy *= fr;
      p.vy += p.g * dt;
      if (p.kind === 'steam' || p.kind === 'smoke') {
        p.vx += Math.sin(state.t * 3 + p.seed) * 42 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      const k = 1 - p.life / p.maxLife;
      if (p.kind === 'steam' || p.kind === 'smoke') {
        p.scale = 0.55 + k * 1.15;
        p.alpha = k < 0.2 ? k / 0.2 : 1 - easeInQuad(seg(k, 0.35, 1));
      } else if (p.kind === 'ring') {
        p.scale = 0.3 + easeOutCubic(k) * 1.7;
        p.alpha = 1 - k;
      } else {
        const pin = k < 0.14 ? easeOutBack(k / 0.14) : 1;
        const pout = k > 0.68 ? 1 - easeInQuad(seg(k, 0.68, 1)) : 1;
        p.scale = Math.max(0, pin * pout);
        p.alpha = k > 0.55 ? 1 - seg(k, 0.55, 1) * 0.85 : 1;
      }
    }

    const cs = state.confetti;
    for (let i = cs.length - 1; i >= 0; i--) {
      const q = cs[i];
      q.life -= dt;
      if (q.life <= 0 || q.y > H + 40) {
        cs.splice(i, 1);
        continue;
      }
      const fr = Math.exp(-2.3 * dt);
      q.vx *= fr;
      q.vy = q.vy * fr + 430 * dt;
      q.x += (q.vx + Math.sin(state.t * 3.2 + q.seed) * 38) * dt;
      q.y += q.vy * dt;
      q.rot += q.vrot * dt;
      q.flip += q.vflip * dt;
    }
  }

  function drawParticleShape(c, p, sz) {
    c.fillStyle = p.color;
    switch (p.kind) {
      case 'star':
        KitchenArt.star(c, p.x, p.y, sz * 1.35, sz * 0.58, 5, p.rot);
        c.fill();
        c.fillStyle = 'rgba(255, 255, 255, 0.55)';
        KitchenArt.circ(c, p.x - sz * 0.25, p.y - sz * 0.3, sz * 0.26);
        c.fill();
        break;
      case 'sparkle':
        KitchenArt.sparkle4(c, p.x, p.y, sz * 1.45, p.rot);
        c.fill();
        break;
      case 'heart':
        c.translate(p.x, p.y);
        c.rotate(Math.sin(p.rot) * 0.3);
        KitchenArt.heart(c, 0, 0, sz * 1.3);
        c.fill();
        c.fillStyle = 'rgba(255, 255, 255, 0.5)';
        KitchenArt.circ(c, -sz * 0.4, -sz * 0.45, sz * 0.22);
        c.fill();
        break;
      case 'smoke':
      case 'steam':
        KitchenArt.circ(c, p.x, p.y, sz * 1.5);
        c.fill();
        break;
      case 'crumb':
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        KitchenArt.rr(c, -sz * 0.6, -sz * 0.45, sz * 1.2, sz * 0.9, sz * 0.3);
        c.fill();
        break;
      default:
        KitchenArt.circ(c, p.x, p.y, sz);
        c.fill();
        c.fillStyle = 'rgba(255, 255, 255, 0.55)';
        KitchenArt.circ(c, p.x - sz * 0.32, p.y - sz * 0.32, sz * 0.32);
        c.fill();
    }
  }

  function drawParticles(c, layer) {
    const ps = state.particles;
    const fn = artFn('drawParticle');
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.layer !== layer || p.scale <= 0.01 || p.alpha <= 0.01) continue;
      const sz = p.r * p.scale;
      c.save();
      if (p.kind === 'ring') {
        c.globalAlpha = p.alpha;
        c.strokeStyle = p.color;
        c.lineWidth = Math.max(1, 3.5 * p.alpha);
        KitchenArt.circ(c, p.x, p.y, sz * 1.6);
        c.stroke();
        c.restore();
        continue;
      }
      if (p.glow) {
        // Soft glow halo
        c.globalAlpha = p.alpha * 0.26;
        c.fillStyle = p.color;
        KitchenArt.circ(c, p.x, p.y, sz * 2.1);
        c.fill();
      } else if (p.kind === 'droplet' || p.kind === 'crumb') {
        // Tiny soft contact shadow
        c.globalAlpha = p.alpha * 0.16;
        c.fillStyle = '#5C3D2E';
        KitchenArt.circ(c, p.x + sz * 0.25, p.y + sz * 0.45, sz * 0.9);
        c.fill();
      }
      c.globalAlpha = p.alpha;
      let done = false;
      if (fn) {
        try {
          fn.call(KitchenArt, c, p, state.t);
          done = true;
        } catch (e) {
          artErrors.drawParticle = String((e && e.message) || e);
        }
      }
      if (!done) drawParticleShape(c, p, sz);
      c.restore();
    }
  }

  function drawConfetti(c, layer) {
    const cs = state.confetti;
    for (let i = 0; i < cs.length; i++) {
      const q = cs[i];
      if (q.layer !== layer) continue;
      const k = 1 - q.life / q.maxLife;
      const pop = k < 0.08 ? easeOutBack(k / 0.08) : 1;
      const fy = Math.cos(q.flip);
      c.save();
      c.globalAlpha = k > 0.8 ? 1 - seg(k, 0.8, 1) : 1;
      c.translate(q.x, q.y);
      c.rotate(q.rot);
      c.scale(pop, pop * Math.max(0.12, Math.abs(fy)));
      c.fillStyle = fy < 0 ? q.back : q.color;
      if (q.shape === 'heart') {
        KitchenArt.heart(c, 0, 0, q.w * 0.9);
      } else if (q.shape === 'circle') {
        KitchenArt.circ(c, 0, 0, q.w * 0.5);
      } else {
        KitchenArt.rr(c, -q.w / 2, -q.h / 2, q.w, q.h, 2.5);
      }
      c.fill();
      c.restore();
    }
  }

  /* ==========================================================================
   * Flying Ingredient Arcs (shelf card -> active station)
   * ========================================================================== */
  function stationDropPoint(st) {
    const c = stationCenter(st);
    if (st === 4 || st === 5) return { x: c.x, y: c.y - 10 };
    return { x: c.x, y: c.y - 4 };
  }

  function launchFlyingIngredient(id) {
    let card = null;
    try {
      card = document.querySelector('.ing-card[data-ing="' + id + '"]');
    } catch (e) {}
    const from = domPointInCanvas(card) || { x: W * 0.46, y: H + 30 };
    const to = stationDropPoint(station);
    const f = {
      id,
      x0: from.x, y0: from.y,
      x1: to.x, y1: to.y,
      p: 0, dur: 0.46,
      apex: clamp(90 + Math.abs(from.y - to.y) * 0.35, 90, 190),
      spin: Math.random() < 0.5 ? -1 : 1,
      st: station,
    };
    state.flyers.push(f);
    if (state.flyers.length > 6) {
      const old = state.flyers.shift();
      onIngredientLanded(old);
    }
    return f.dur;
  }

  function flyerPos(f) {
    const p = clamp01(f.p);
    return {
      x: lerp(f.x0, f.x1, p),
      y: lerp(f.y0, f.y1, p) - f.apex * 4 * p * (1 - p),
      rot: f.spin * (1 - easeOutCubic(p)) * 2.4,
      scale: 0.86 + 0.24 * Math.sin(p * Math.PI),
    };
  }

  function updateFlyers(dt) {
    const fl = state.flyers;
    for (let i = fl.length - 1; i >= 0; i--) {
      const f = fl[i];
      f.p += dt / f.dur;
      if (f.p >= 1) {
        fl.splice(i, 1);
        onIngredientLanded(f);
      }
    }
  }

  function onIngredientLanded(f) {
    const meta = KitchenData.getIngredient(f.id);
    const st = f.st;
    if (!stationVisible(st)) return;
    const x = f.x1, y = f.y1;
    if (st === 1) {
      squashImpulse(1.3, 0.74);
      state.boardRecoilVel += 140;
      ringPulse(x, y + 26, 'rgba(255, 253, 249, 0.9)', 1, 16);
      starBurst(x, y - 10, ['#FFF3B8', meta.color], 5, 1, true);
    } else if (st === 2) {
      if (meta.liquid) sfx('pour');
      else sfx('stir');
      state.mixVelocity += state.mixVelocity >= 0 ? 2.2 : -2.2;
      state.bowlTiltVel += 1.1;
      squashImpulse(1.12, 0.9);
      juiceBurst(x, y - 6, mixColor, meta.color, 9, 2);
      ringPulse(x, y + 4, 'rgba(255, 253, 249, 0.85)', 2, 18);
    } else if (st === 3) {
      sfx('sizzleTick', heatLevel);
      squashImpulse(1.14, 0.88);
      steamPuff(x, y - 6, 4, 3, false);
      starBurst(x, y - 10, ['#F7C948', '#F5A623'], 5, 3, true);
    } else {
      squashImpulse(1.1, 0.92);
      starBurst(x, y - 12, ['#F7C948', '#F4A6B8'], 6, st, true);
    }
  }

  function drawFlyers(c) {
    for (let i = 0; i < state.flyers.length; i++) {
      const f = state.flyers[i];
      const fp = flyerPos(f);
      c.save();
      c.globalAlpha = 0.16;
      c.fillStyle = '#5C3D2E';
      const shadowK = clamp01(f.p);
      KitchenArt.ell(c, lerp(f.x0, f.x1, shadowK), lerp(f.y0, f.y1, shadowK) + 30, 22 * fp.scale, 7 * fp.scale);
      c.fill();
      c.restore();
      KitchenArt.drawIngredient(c, f.id, fp.x, fp.y, 38 * fp.scale, { rot: fp.rot, shadow: false });
    }
  }

  function isLanded(item) {
    const born = popIns.get(item);
    return born === undefined || state.t >= born;
  }

  function popScale(item) {
    const born = popIns.get(item);
    if (born === undefined) return 1;
    const tau = state.t - born;
    if (tau > 1.2) return 1;
    return springPop(tau, 0.42, 18);
  }

  function shownItems(arr) {
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      if (!isLanded(arr[i])) continue;
      out.push(Object.assign({}, arr[i], { scale: popScale(arr[i]) }));
    }
    return out;
  }

  /* ==========================================================================
   * Station 1: Select & Chop / Crack Ingredient (Knife Slash Choreography)
   * ========================================================================== */
  function selectIngredient(id) {
    const meta = KitchenData.getIngredient(id);
    sfx('ensure');
    sfx('popSelect', id.length);
    const flight = canvas ? launchFlyingIngredient(meta.id) : 0;
    const landT = state.t + flight;
    squashImpulse(1.14, 0.9);

    if (station === 1) {
      finishKnifeNow();
      retireBoardView();
      boardItem = {
        id: meta.id,
        chops: 0,
        maxChops: meta.crackable ? 2 : (meta.choppable ? 3 : 1),
        sliced: false,
        cracked: false,
      };
      state.boardView = {
        id: meta.id,
        chops: 0,
        maxChops: boardItem.maxChops,
        sliced: false,
        cracked: false,
        choppable: !!meta.choppable,
        crackable: !!meta.crackable,
        landT,
        doneT: -1,
        finishPending: false,
        lastImpactT: -10,
      };
      if (!meta.choppable && !meta.crackable) {
        chopBoardItemImpl(false);
      }
    } else if (station === 2) {
      addToMixer(meta.id, false, false, landT);
    } else if (station === 3) {
      addToCooker(meta.id, false, false, landT);
    } else if (station === 4) {
      addIngredientToDish(meta.id, true, 0.7, undefined, landT);
    }
    renderPrepTrayUI();
    renderPrimaryActionButton();
  }

  function chopBoardItem() {
    chopBoardItemImpl(true);
  }

  // If the ingredient is still flying onto the board, land it at full size now
  function landBoardFlyerNow(view) {
    if (!view || state.t >= view.landT) return;
    for (let i = state.flyers.length - 1; i >= 0; i--) {
      const f = state.flyers[i];
      if (f.st === 1 && f.id === view.id) {
        state.flyers.splice(i, 1);
        f.p = 1;
        onIngredientLanded(f);
      }
    }
    view.landT = state.t - 1.25;
  }

  function chopBoardItemImpl(snapLanding) {
    if (!boardItem) {
      const defaultId = mode === 'wish' ? currentOrder().wantIds[0] : 'strawberry';
      selectIngredient(defaultId);
      if (!boardItem) return;
    }
    const meta = KitchenData.getIngredient(boardItem.id);
    boardItem.chops++;
    const view = state.boardView && state.boardView.id === boardItem.id ? state.boardView : null;
    const usesKnife = !!(meta.choppable || meta.crackable);
    if (snapLanding && view) landBoardFlyerNow(view);

    if (view && usesKnife) {
      startKnifeSlash(view, boardItem.chops);
    } else {
      // Liquids & soft goodies: no knife, just a sparkly plop.
      if (meta.liquid) sfx('pour');
      else sfx('chop', boardItem.chops);
      squashImpulse(1.22, 0.82);
      if (view) view.chops = boardItem.chops;
    }

    if (boardItem.chops >= boardItem.maxChops) {
      boardItem.sliced = !!meta.choppable;
      boardItem.cracked = !!meta.crackable;
      prepTray.push({
        id: boardItem.id,
        sliced: boardItem.sliced,
        cracked: boardItem.cracked,
        cooked: 0,
      });
      syncIngredientToPipeline(boardItem.id, boardItem.sliced, boardItem.cracked);
      if (view && canvas) {
        trayHidden++;
        view.finishPending = true;
        if (!usesKnife) {
          view.sliced = boardItem.sliced;
          view.cracked = boardItem.cracked;
          markViewDone(view, Math.max(0, view.landT - state.t) + 0.12);
        }
      }
      boardItem = null;
      lastFinishT = state.t;
    }
    renderPrepTrayUI();
    renderPrimaryActionButton();
  }

  function hintIngredientId() {
    if (mode === 'wish') {
      const used = new Set(prepTray.map(p => p.id));
      const next = currentOrder().wantIds.find(id => !used.has(id));
      if (next) return next;
    }
    return 'strawberry';
  }

  function startKnifeSlash(view, chopIndex) {
    const ks = state.knifeSlash;
    if (ks.active && !ks.impactDone) knifeImpact();
    const c = stationCenter(1);
    const idx = Math.max(0, chopIndex - 1);
    const pose = ks.pose && ks.pose.x ? ks.pose : knifeRestPose(c.x, c.y);
    ks.from = { x: pose.x, y: pose.y, angle: pose.angle };
    ks.active = true;
    ks.t = 0;
    ks.delay = Math.max(0, view.landT - state.t);
    ks.sliceIndex = idx;
    ks.targetChops = chopIndex;
    ks.view = view;
    // Constant cut line: the whole piece shrinks left of it, slices fan right.
    const centred = view.crackable || !view.choppable;
    ks.cutX = centred ? c.x : c.x - 44;
    ks.cutY = view.crackable ? c.y - 10 : c.y - 6;
    ks.impactDone = false;
    ks.whooshed = false;
    ks.trail.length = 0;
  }

  function knifeRestPose(cx, cy) {
    return {
      x: cx + 150,
      y: cy - 52 + Math.sin(state.t * 2.1) * 3,
      angle: 0.32 + Math.sin(state.t * 1.6) * 0.03,
    };
  }

  // Anticipation wind-up -> accelerating chop -> rebound -> settle back to rest
  function computeKnifePose(cx, cy) {
    const ks = state.knifeSlash;
    const rest = knifeRestPose(cx, cy);
    if (!ks.active) return rest;
    const k = ks.t;
    const from = ks.from || rest;
    const wind = { x: ks.cutX + 34, y: ks.cutY - 92, angle: 0.62 };
    const hit = { x: ks.cutX, y: ks.cutY, angle: 0.03 };
    const reb = { x: ks.cutX + 6, y: ks.cutY - 16, angle: 0.14 };
    if (k < 0.16) return lerpPose(from, wind, easeOutCubic(k / 0.16));
    if (k < KNIFE_IMPACT) return lerpPose(wind, hit, easeInCubic(seg(k, 0.16, KNIFE_IMPACT)));
    if (k < 0.62) return lerpPose(hit, reb, easeOutCubic(seg(k, KNIFE_IMPACT, 0.62)));
    return lerpPose(reb, rest, easeInOutCubic(seg(k, 0.62, 1)));
  }

  function knifeImpact() {
    const ks = state.knifeSlash;
    if (ks.impactDone) return;
    ks.impactDone = true;
    const view = ks.view;
    if (!view) return;
    const meta = KitchenData.getIngredient(view.id);
    view.chops = Math.max(view.chops, ks.targetChops);
    view.lastImpactT = state.t;
    state.boardRecoilVel += 320;
    squashImpulse(1.24, 0.8);
    state.sliceSepProgress = 0.1;
    state.sliceSepVel = 0;
    const juice = meta.crackable ? '#FFC94A' : (meta.inner || meta.color);
    // art.js hero renderer adds its own impact flash + droplets: stay lighter
    const heroChop = !!artFn('drawChopStation');
    juiceBurst(ks.cutX, ks.cutY - 8, meta.color, juice, heroChop ? 8 : 14, 1);
    if (!heroChop) ringPulse(ks.cutX, ks.cutY + 10, 'rgba(255, 253, 249, 0.9)', 1, 14);
    if (meta.crackable) sfx('crackEgg');
    else sfx('chop', ks.targetChops);
    if (view.chops >= view.maxChops) {
      view.sliced = !!meta.choppable;
      view.cracked = !!meta.crackable;
      markViewDone(view, 0.46);
      const c = stationCenter(1);
      starBurst(c.x, c.y - 36, ['#F7C948', '#FFF3B8', meta.color], 9, 1, true);
    }
  }

  function finishKnifeNow() {
    const ks = state.knifeSlash;
    if (ks.active && !ks.impactDone) knifeImpact();
    ks.active = false;
    ks.t = 0;
  }

  function markViewDone(view, hold) {
    view.doneT = state.t;
    view.hopAt = state.t + (hold || 0.45);
  }

  function retireBoardView() {
    const v = state.boardView;
    if (!v) return;
    if (v.finishPending) {
      startHop(v);
    } else {
      const c = stationCenter(1);
      starBurst(c.x, c.y - 10, ['#FFF3B8', '#F4A6B8'], 4, 1, true);
    }
    state.boardView = null;
  }

  function sliceLayout(view, cx, cy, sepOverride) {
    const out = [];
    if (view.crackable || !view.choppable || view.chops <= 0) {
      out.push({ x: cx, y: cy - 4, rot: 0, r: view.crackable ? 54 : 58, sliced: false });
      return out;
    }
    const sep = sepOverride === undefined ? state.sliceSepProgress : sepOverride;
    const hop = Math.max(0, Math.sin(clamp01(sep) * Math.PI)) * 10;
    if (view.chops >= view.maxChops) {
      // Ta-da: every piece fans out evenly before hopping into the basket
      const pieces = Math.min(4, view.chops + 1);
      for (let i = 0; i < pieces; i++) {
        const u = i - (pieces - 1) / 2;
        out.push({
          x: cx + u * 56 * (0.3 + 0.7 * sep),
          y: cy - 4 - hop * (1 - Math.abs(u) * 0.2),
          rot: u * 0.17 * sep,
          r: 42,
          sliced: true,
        });
      }
      return out;
    }
    // Whole piece shrinks left of the cut line; fresh slices fan to the right
    const cutX = cx - 44;
    const remain = 1 - (view.chops / view.maxChops) * 0.5;
    out.push({ x: cutX - 34 * remain, y: cy - 4, rot: 0, r: 58 * remain, sliced: false });
    for (let i = 0; i < view.chops; i++) {
      const newest = i === view.chops - 1;
      const k = newest ? clamp(sep, 0, 1.2) : 1;
      out.push({
        x: cutX + 20 + (16 + i * 44) * k,
        y: cy - 4 - (newest ? hop : 0),
        rot: (0.08 + i * 0.1) * k,
        r: 40,
        sliced: true,
      });
    }
    return out;
  }

  function startHop(view) {
    if (state.boardView === view) state.boardView = null;
    view.finishPending = false;
    const off = layerOffset(1);
    if (off === null || !canvas) {
      revealTray();
      return;
    }
    const ctr = stationCenter(1);
    const pieces = sliceLayout(view, ctr.x, ctr.y, 1);
    const target = basketPoint();
    pieces.forEach((pc, i) => {
      state.hopSlices.push({
        id: view.id,
        sliced: pc.sliced,
        cracked: view.cracked,
        x0: pc.x + off, y0: pc.y,
        x1: target.x - i * 5, y1: target.y,
        r0: pc.r, rot0: pc.rot,
        p: -i * 0.09, dur: 0.6,
        spin: (i % 2 ? -1 : 1) * rand(0.8, 1.3),
        apex: rand(90, 130),
        first: i === 0,
      });
    });
    sfx('popSelect', 2);
  }

  function revealTray() {
    if (trayHidden > 0) trayHidden--;
    renderPrepTrayUI();
  }

  function updateBoard(dt) {
    const v = state.boardView;
    if (v && v.finishPending && v.doneT >= 0 && state.t >= v.hopAt) {
      startHop(v);
    }
    const hs = state.hopSlices;
    for (let i = hs.length - 1; i >= 0; i--) {
      const h = hs[i];
      h.p += dt / h.dur;
      if (h.p >= 1) {
        hs.splice(i, 1);
        starBurst(h.x1, h.y1, ['#F7C948', '#9CD3C2', '#F4A6B8'], 4, 0, true);
        if (h.first) {
          revealTray();
          sfx('popSelect', 4);
        }
      }
    }
    // Safety: never leave tray items hidden when nothing is in flight.
    const pending = state.boardView && state.boardView.finishPending;
    if (trayHidden > 0 && !hs.length && !pending) {
      trayHidden = 0;
      renderPrepTrayUI();
    }
  }

  function drawHopSlices(c) {
    for (let i = 0; i < state.hopSlices.length; i++) {
      const h = state.hopSlices[i];
      if (h.p <= 0) continue;
      const p = clamp01(h.p);
      const x = lerp(h.x0, h.x1, p);
      const y = lerp(h.y0, h.y1, p) - h.apex * 4 * p * (1 - p);
      const r = lerp(h.r0, 15, easeInQuad(p));
      KitchenArt.drawIngredient(c, h.id, x, y, r, {
        sliced: h.sliced,
        cracked: h.cracked,
        rot: h.rot0 + h.spin * Math.PI * 1.6 * p,
        shadow: false,
      });
    }
  }

  function updateKnife(dt) {
    const ks = state.knifeSlash;
    const c = stationCenter(1);
    if (ks.active) {
      if (ks.delay > 0) {
        ks.delay -= dt;
      } else {
        if (!ks.whooshed) {
          ks.whooshed = true;
          sfx('whoosh', 0.6);
        }
        const prev = ks.t;
        ks.t = Math.min(1, ks.t + dt / ks.duration);
        if (prev < KNIFE_IMPACT && ks.t >= KNIFE_IMPACT) knifeImpact();
        if (ks.t >= 1) {
          ks.active = false;
          ks.t = 0;
        }
      }
    }
    ks.pose = computeKnifePose(c.x, c.y);
    // Blade-tip trail for the swoosh ribbon (down-swing only)
    const swinging = ks.active && ks.t > 0.2 && ks.t < 0.56;
    if (swinging) {
      const tip = knifeTip(ks.pose);
      ks.trail.push({ x: tip.x, y: tip.y, t: state.t });
    }
    while (ks.trail.length && state.t - ks.trail[0].t > 0.13) ks.trail.shift();
  }

  function knifeTip(pose) {
    const lx = -74, ly = -6;
    const cs = Math.cos(pose.angle), sn = Math.sin(pose.angle);
    return { x: pose.x + lx * cs - ly * sn, y: pose.y + lx * sn + ly * cs };
  }

  function syncIngredientToPipeline(id, sliced, cracked) {
    const meta = KitchenData.getIngredient(id);
    if (meta.liquid || id === 'dough' || id === 'boba' || id === 'icecream' || meta.cat === 'fruit' || id === 'popcandy') {
      mixItems.push({ id, sliced, cracked });
      recomputeMixColor();
    }
    if (meta.grillable || meta.bakeable || id === 'egg' || id === 'dough' || id === 'pizzabase') {
      panItems.push({
        id,
        sliced,
        cracked,
        x: (Math.random() - 0.5) * 90,
        y: (Math.random() - 0.5) * 45,
      });
    }
    addIngredientToDish(id, sliced, meta.grillable ? 0.72 : 0, cracked);
  }

  function addIngredientToDish(id, sliced, cooked, cracked, landT) {
    const meta = KitchenData.getIngredient(id);
    if (id === 'boba' || (id === 'milk' && mixMode === 'blender')) {
      dish.vessel = 'cup';
    }
    if (id === 'dough' && cookMode === 'oven') {
      dish.bakedCake = true;
    }
    const angle = dish.items.length * 1.35;
    const rad = dish.items.length === 0 ? 0 : Math.min(58, 22 + dish.items.length * 8);
    const item = {
      id,
      sliced: sliced !== undefined ? sliced : !!meta.choppable,
      cracked: cracked !== undefined ? cracked : !!meta.crackable,
      cooked: cooked || 0,
      x: Math.cos(angle) * rad,
      y: Math.sin(angle) * rad * 0.65 - 6,
      r: meta.baseType ? 68 : 34,
      rot: (Math.random() - 0.5) * 0.4,
    };
    dish.items.push(item);
    if (landT !== undefined) popIns.set(item, landT);
    recomputeDishLiquidColor();
  }

  /* ==========================================================================
   * Station 2: Mixing Bowl & Smoothie Blender (Orbital Whisk & Vortex)
   * ========================================================================== */
  function addToMixer(id, sliced, cracked, landT) {
    const meta = KitchenData.getIngredient(id);
    const item = { id, sliced: !!sliced, cracked: !!cracked };
    mixItems.push(item);
    if (landT !== undefined) {
      popIns.set(item, landT);
    } else {
      if (meta.liquid) sfx('pour');
      else sfx('chop');
      const c = stationCenter(2);
      juiceBurst(c.x, c.y - 10, mixColor, meta.color, 8, 2);
    }
    recomputeMixColor();
    addIngredientToDish(id, true, 0, undefined, landT);
    if (id === 'boba' || id === 'milk' || id === 'icecream') {
      if (mixMode === 'blender') dish.vessel = 'cup';
    }
  }

  function recomputeMixColor() {
    if (!mixItems.length) {
      mixColor = '#FFF5DC';
      return;
    }
    let r = 0, g = 0, b = 0;
    mixItems.forEach(it => {
      const c = parseInt(KitchenData.getIngredient(it.id).color.replace('#', ''), 16);
      r += (c >> 16) & 255;
      g += (c >> 8) & 255;
      b += c & 255;
    });
    r = Math.round(r / mixItems.length);
    g = Math.round(g / mixItems.length);
    b = Math.round(b / mixItems.length);
    mixColor = '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
    dish.liquidColor = mixColor;
  }

  function recomputeDishLiquidColor() {
    const colored = dish.items.filter(it => it.id !== 'dough' && it.id !== 'milk');
    if (colored.length > 0) {
      const last = KitchenData.getIngredient(colored[colored.length - 1].id);
      dish.liquidColor = KitchenArt.lerpColor(last.color, '#FFFFFF', 0.3);
    } else if (!dish.liquidColor) {
      dish.liquidColor = '#F4A6B8';
    }
  }

  function stirMixer(amount, fromDrag) {
    if (mixItems.length === 0) {
      if (prepTray.length > 0) {
        prepTray.forEach(p => mixItems.push({ id: p.id, sliced: p.sliced, cracked: p.cracked }));
      } else {
        addToMixer('milk', false, false);
        addToMixer('strawberry', true, false);
      }
      recomputeMixColor();
    }
    const amt = amount || 0.18;
    const wasDone = mixProgress >= 1;
    mixProgress = Math.min(1, mixProgress + amt);
    if (!fromDrag) {
      // Angular momentum kick: the batter swirls on and coasts after release
      const dir = state.mixVelocity < -0.5 ? -1 : 1;
      state.mixVelocity = clamp(state.mixVelocity + dir * (4.2 + amt * 12), -17, 17);
      state.bowlTiltVel += dir * 1.4;
    }
    squashImpulse(1.08, 0.93);
    if (mixMode === 'blender') {
      sfx('blendTick');
      dish.vessel = 'cup';
    } else {
      sfx('stir');
    }
    dish.liquidColor = mixColor;
    if (mixProgress >= 1) {
      const c = stationCenter(2);
      starBurst(c.x, c.y - 40, [mixColor, '#F7C948', '#FFF3B8'], wasDone ? 4 : 16, 2, true);
      if (!wasDone) sfx('sparkle');
    }
    renderPrimaryActionButton();
  }

  function bowlAngle(pt) {
    const c = stationCenter(2);
    return Math.atan2((pt.y - c.y) / 0.6, pt.x - c.x);
  }

  function updateMix(dt) {
    const visc = 1.15 + mixProgress * 0.55 + (mixMode === 'blender' ? -0.35 : 0);
    if (!state.whiskHeld) state.mixVelocity *= Math.exp(-visc * dt);
    if (Math.abs(state.mixVelocity) < 0.02) state.mixVelocity = 0;
    state.mixSwirlAngle += state.mixVelocity * dt;
    if (state.whiskHeld) {
      state.whiskOrbit += wrapAngle(state.whiskTarget - state.whiskOrbit) * (1 - Math.exp(-20 * dt));
    } else {
      state.whiskOrbit += state.mixVelocity * 0.9 * dt;
    }
    state.mixBarShown += (mixProgress - state.mixBarShown) * (1 - Math.exp(-8 * dt));

    if (!stationVisible(2)) return;
    const c = stationCenter(2);
    const spd = Math.abs(state.mixVelocity);
    const dropRate = artFn('drawMixStation') ? 0.6 : 1.1;
    if (mixMode === 'bowl' && spd > 4.5 && mixItems.length && Math.random() < dt * spd * dropRate) {
      // Colorful batter droplets flung off the whisk tangentially
      const a = state.whiskOrbit + rand(-0.3, 0.3);
      const tang = Math.sign(state.mixVelocity);
      spawnParticle({
        x: c.x + Math.cos(a) * 70,
        y: c.y + Math.sin(a) * 38 - 8,
        vx: -Math.sin(a) * tang * spd * 13 + rand(-30, 30),
        vy: -rand(150, 270),
        g: 860, drag: 0.8, r: rand(3, 5.5),
        color: Math.random() < 0.7 ? mixColor : '#FFFDF9',
        kind: 'droplet', life: rand(0.5, 0.8), layer: 2,
      });
    }
    if ((spd > 7 || mixProgress >= 1) && Math.random() < dt * (mixProgress >= 1 ? 3 : 1.6)) {
      // Floating star sparkles above the swirling vortex
      const cols = ['#F7C948', '#F4A6B8', '#9CD3C2', '#C9B3E8'];
      spawnParticle({
        x: c.x + rand(-95, 95), y: c.y - rand(20, 70),
        vx: rand(-20, 20), vy: rand(-75, -30),
        g: -10, drag: 1.5, r: rand(5, 8.5),
        color: cols[Math.floor(Math.random() * cols.length)],
        kind: Math.random() < 0.5 ? 'sparkle' : 'star', glow: true,
        life: rand(0.8, 1.3), vrot: rand(-2, 2), layer: 2,
      });
    }
  }

  /* ==========================================================================
   * Station 3: Sizzling Skillet Pan & Bakery Oven (Chef Pan Toss)
   * ========================================================================== */
  function addToCooker(id, sliced, cracked, landT) {
    const meta = KitchenData.getIngredient(id);
    const item = {
      id,
      sliced: sliced !== undefined ? sliced : !!meta.choppable,
      cracked: cracked !== undefined ? cracked : !!meta.crackable,
      x: (Math.random() - 0.5) * 85,
      y: (Math.random() - 0.5) * 40,
    };
    panItems.push(item);
    if (landT !== undefined) popIns.set(item, landT);
    else sfx('sizzleTick', heatLevel);
    addIngredientToDish(id, true, Math.max(0.65, cookProgress), undefined, landT);
  }

  function flipPan() {
    if (panItems.length === 0) {
      if (prepTray.length > 0) {
        prepTray.forEach(p => addToCooker(p.id, p.sliced, p.cracked));
      } else {
        addToCooker('dough', false, false);
        addToCooker('egg', false, true);
      }
    }
    const c = stationCenter(3);
    if (cookMode === 'oven') {
      cookProgress = Math.min(0.85, cookProgress + 0.45);
      dish.bakedCake = true;
      sfx('ovenDing');
      state.ovenPulseVel += 7;
      squashImpulse(1.16, 0.88);
      starBurst(c.x, c.y - 40, ['#F7C948', '#FFF3B8', '#F5A623'], 14, 3, true);
      steamPuff(c.x, c.y - 70, 4, 3, false);
    } else {
      cookProgress = Math.min(1.3, cookProgress + 0.28);
      startPanToss();
    }
    syncCookedStateToDish();
    renderPrimaryActionButton();
  }

  function startPanToss() {
    const pt = state.panToss;
    if (pt.active) finishPanTossNow();
    pt.active = true;
    pt.t = 0;
    pt.duration = 0.95;
    pt.height = clamp(H * 0.2, 84, 132) * rand(0.92, 1.08);
    pt.spin = Math.random() < 0.5 ? -1 : 1;
    pt.plan = [];
    const isBase = it => it.id === 'dough' || it.id === 'pizzabase';
    const hasBase = panItems.some(isBase);
    if (hasBase) {
      pt.plan.push({ base: true, item: null, delay: 0, h: pt.height * 1.06, spin: pt.spin, drift: rand(-6, 6), landed: false, landAt: 0 });
    }
    let order = hasBase ? 1 : 0;
    panItems.forEach((it, i) => {
      if (isBase(it)) return;
      pt.plan.push({
        base: false,
        item: it,
        delay: Math.min(0.18, order * 0.045),
        h: pt.height * rand(0.8, 1.15),
        spin: (i % 2 ? -1 : 1) * pt.spin,
        drift: rand(-16, 16),
        landed: false,
        landAt: 0,
      });
      order++;
    });
    if (!sfx('panToss')) sfx('flip');
    squashImpulse(1.12, 0.9);
  }

  function finishPanTossNow() {
    const pt = state.panToss;
    if (!pt.active) return;
    pt.plan.forEach(pl => {
      if (!pl.landed) {
        pl.landed = true;
        onTossBodyLanded(pl);
      }
    });
    pt.active = false;
    pt.bodies = [];
    pt.baseBody = null;
  }

  function onTossBodyLanded(pl) {
    const c = stationCenter(3);
    const it = pl.item;
    const x = c.x + (it ? it.x : 0);
    const y = c.y + (it ? it.y : 0);
    sfx('sizzleTick', heatLevel);
    state.panCatchVel += pl.base ? 170 : 90;
    if (stationVisible(3)) {
      starBurst(x, y - 10, ['#F7C948', '#FFE08A', '#F5A623'], pl.base ? 7 : 4, 3, true);
      steamPuff(x, y - 14, pl.base ? 4 : 2, 3, cookProgress > 1.08);
      ringPulse(x, y + 4, 'rgba(255, 236, 170, 0.85)', 3, pl.base ? 24 : 12);
    }
  }

  function computeTossBody(pl, k, dur) {
    const b = { dx: 0, dy: 0, rot: 0, flip: 0, sx: 1, sy: 1, shadow: 1 };
    const u = (k - TOSS_LAUNCH - pl.delay) / TOSS_FLIGHT;
    if (u < 0) {
      // Crouch & load before the launch (anticipation)
      const pre = clamp01((k - (TOSS_LAUNCH + pl.delay - 0.08)) / 0.08);
      b.sx = 1 + 0.12 * pre;
      b.sy = 1 - 0.12 * pre;
    } else if (u <= 1) {
      const arc = 4 * u * (1 - u);
      b.dy = -pl.h * arc;
      b.dx = Math.sin(u * Math.PI) * pl.drift;
      const spinE = easeInOutCubic(u);
      if (pl.base) b.flip = spinE;
      else b.rot = pl.spin * PI2 * spinE;
      const stretch = (1 - arc) * 0.14;
      b.sx = 1 - stretch * 0.6;
      b.sy = 1 + stretch;
      b.shadow = 1 - 0.65 * arc;
    } else {
      // "Sear-stamp" landing squash that wobbles out
      const since = Math.max(0, (k - pl.landAt) * dur);
      const sq = Math.exp(-since * 9) * Math.cos(since * 30);
      b.sx = 1 + 0.26 * sq;
      b.sy = 1 - 0.26 * sq;
    }
    return b;
  }

  function updateCook(dt) {
    const pt = state.panToss;
    if (pt.active) {
      pt.t = Math.min(1, pt.t + dt / pt.duration);
      const k = pt.t;
      // Pan choreography: dip -> snap upward flick -> recover
      let dy, tilt;
      if (k < 0.14) {
        const e = easeOutCubic(k / 0.14);
        dy = 12 * e;
        tilt = -0.07 * e;
      } else if (k < 0.24) {
        const e = easeOutCubic(seg(k, 0.14, 0.24));
        dy = lerp(12, -24, e);
        tilt = lerp(-0.07, 0.13, e);
      } else {
        const e = easeInOutCubic(seg(k, 0.24, 0.52));
        dy = lerp(-24, 0, e);
        tilt = lerp(0.13, 0, e);
      }
      pt.panDy = dy + state.panCatch;
      pt.panTilt = tilt;
      const byItem = new Map();
      pt.baseBody = null;
      pt.plan.forEach(pl => {
        const u = (k - TOSS_LAUNCH - pl.delay) / TOSS_FLIGHT;
        if (u > 1 && !pl.landed) {
          pl.landed = true;
          pl.landAt = k;
          onTossBodyLanded(pl);
        }
        const body = computeTossBody(pl, k, pt.duration);
        if (pl.base) pt.baseBody = body;
        else byItem.set(pl.item, body);
      });
      pt.byItem = byItem;
      if (pt.t >= 1) {
        finishPanTossNow();
        pt.byItem = null;
      }
    } else {
      pt.panDy = state.panCatch;
      pt.panTilt = 0;
    }

    state.cookNeedleShown += (cookProgress - state.cookNeedleShown) * (1 - Math.exp(-7 * dt));

    if (station === 3 && panItems.length > 0 && cookMode === 'pan') {
      cookProgress += dt * 0.055 * heatLevel;
      syncCookedStateToDish();
      sizzleTimer -= dt;
      if (sizzleTimer <= 0) {
        sizzleTimer = 0.16;
        sfx('sizzleTick', heatLevel * 0.45);
      }
      if (stationVisible(3)) {
        const c = stationCenter(3);
        // art.js skillet already draws foam rings + steam: keep ours as accents
        const hero = !!artFn('drawCookStation');
        if (Math.random() < dt * (hero ? 3 : 7) * heatLevel) {
          spawnParticle({
            x: c.x + rand(-70, 70), y: c.y + rand(-30, 20),
            vx: rand(-10, 10), vy: rand(-60, -34),
            g: -16, drag: 1.0, r: rand(5, 9),
            color: cookProgress > 1.05 ? 'rgba(80, 65, 55, 0.6)' : 'rgba(255, 250, 235, 0.75)',
            kind: 'steam', life: rand(0.8, 1.2), vrot: 0, layer: 3,
          });
        }
        if (!hero && Math.random() < dt * 5 * heatLevel) {
          // Bubbling butter foam rings on the hot skillet surface
          spawnParticle({
            x: c.x + rand(-90, 90), y: c.y + rand(-44, 40),
            vx: 0, vy: 0, g: 0, drag: 0, r: rand(3, 6),
            color: 'rgba(255, 238, 186, 0.9)', kind: 'ring', life: rand(0.3, 0.5), vrot: 0, layer: 3,
          });
        }
        if (heatLevel === 3 && Math.random() < dt * 2.5) {
          spawnParticle({
            x: c.x + rand(-80, 80), y: c.y + rand(-30, 20),
            vx: rand(-40, 40), vy: rand(-170, -90), g: 420, drag: 1.4, r: rand(3.5, 5.5),
            color: '#F7C948', kind: 'star', glow: true, life: rand(0.5, 0.8), layer: 3,
          });
        }
      }
    }
  }

  function syncCookedStateToDish() {
    dish.items.forEach(it => {
      it.cooked = Math.max(it.cooked || 0, cookProgress);
    });
    if (cookMode === 'oven' && cookProgress > 0.35) {
      dish.bakedCake = true;
    }
  }

  /* ==========================================================================
   * Station 4: Piping Cream, Drizzling Sauce & Bouncy Toppings
   * ========================================================================== */
  function ensureDishHasBase() {
    if (dish.items.length === 0 && !dish.bakedCake) {
      dish.bakedCake = true;
      dish.liquidColor = '#F4B8C4';
      addIngredientToDish('strawberry', true, 0);
    }
  }

  function startPipingAnim(kind, localX, localY, color) {
    const c = stationCenter(4), sc = 1.08;
    const pa = state.pipingAnim;
    pa.active = true;
    pa.t = 0;
    pa.kind = kind;
    pa.x = c.x + localX * sc;
    pa.y = c.y + localY * sc;
    pa.color = color;
  }

  function addPipingPoint(localX, localY, delay) {
    ensureDishHasBase();
    const pCol = KitchenData.PIPING_COLORS[pipingColorIdx] || KitchenData.PIPING_COLORS[0];
    const last = dish.piping[dish.piping.length - 1];
    if (last && Math.hypot(last.x - localX, last.y - localY) < 14) return;
    const dollop = {
      x: localX,
      y: localY,
      r: 15,
      color: pCol.color,
      shadow: pCol.shadow,
      hi: pCol.hi,
      scale: 0,
    };
    dish.piping.push(dollop);
    dollopPops.push({ p: dollop, born: state.t + (delay || 0), sounded: false });
    squashImpulse(1.06, 0.95);
    if (!delay) startPipingAnim('piping', localX, localY, pCol.color);
    renderPrimaryActionButton();
  }

  function addToppingAt(localX, localY, delay) {
    ensureDishHasBase();
    const topMeta = KitchenData.TOPPINGS[toppingIdx] || KitchenData.TOPPINGS[0];
    for (let tp of dish.toppings) {
      if (tp.id === 'candle' && !tp.blownOut && Math.hypot(tp.x - localX, tp.y - localY) < 28) {
        tp.blownOut = true;
        sfx('blowCandle');
        const c = stationCenter(4);
        steamPuff(c.x + tp.x * 1.08, c.y + (tp.y - 30) * 1.08, 5, 4, false);
        starBurst(c.x + tp.x * 1.08, c.y + (tp.y - 30) * 1.08, '#F7C948', 8, 4, true);
        return;
      }
    }
    const dropFrom = -170;
    const tp = {
      id: topMeta.id,
      x: localX,
      y: localY,
      seed: Math.random() * 10,
      blownOut: false,
      dropY: dropFrom,
      sx: 1,
      sy: 1,
    };
    dish.toppings.push(tp);
    state.toppingSprings.push({
      tp, y: dropFrom, vy: 0, sx: 1, sy: 1, vsx: 0, vsy: 0,
      landed: false, justLanded: false, resting: false, bounces: 0, delay: delay || 0,
    });
    squashImpulse(1.1, 0.92);
    sfx('sprinkle');
    startPipingAnim('topping', localX, localY + dropFrom * 0.55, '#F7C948');
    renderPrimaryActionButton();
  }

  function updateDecorate(dt) {
    const pa = state.pipingAnim;
    if (pa.active) {
      pa.t = Math.min(1, pa.t + dt / 0.42);
      pa.squeeze = Math.sin(Math.PI * Math.min(1, pa.t * 1.35));
      pa.shake = pa.kind === 'topping' ? Math.sin(pa.t * 42) * 0.28 * (1 - pa.t) : 0;
      if (pa.t >= 1) {
        pa.active = false;
        pa.squeeze = 0;
        pa.shake = 0;
      }
    }
    state.toolTilt = clamp(state.toolPos.vx * 0.0011, -0.35, 0.35);

    for (let i = dollopPops.length - 1; i >= 0; i--) {
      const d = dollopPops[i];
      const tau = state.t - d.born;
      if (tau >= 0 && !d.sounded) {
        d.sounded = true;
        sfx('pipeCream');
      }
      if (tau > 1.0) {
        d.p.scale = 1;
        dollopPops.splice(i, 1);
      } else {
        d.p.scale = Math.max(0, springPop(tau, 0.45, 19));
      }
    }

    const c = stationCenter(4), sc = 1.08;
    const sp = state.toppingSprings;
    for (let i = sp.length - 1; i >= 0; i--) {
      const s = sp[i];
      if (s.justLanded) {
        s.justLanded = false;
        if (stationVisible(4)) {
          confettiBurst(c.x + s.tp.x * sc, c.y + s.tp.y * sc, 14, 4);
          ringPulse(c.x + s.tp.x * sc, c.y + s.tp.y * sc + 4, 'rgba(255, 253, 249, 0.9)', 4, 12);
        }
        sfx('sparkle');
      }
      // Stretch while falling fast, then damped jelly squash on landing
      const fall = s.landed ? 0 : Math.max(0, s.vy);
      const stretchY = 1 + Math.min(0.25, fall * 0.00025);
      const stretchX = 1 - Math.min(0.15, fall * 0.00015);
      s.tp.dropY = s.y;
      s.tp.sx = s.sx * stretchX;
      s.tp.sy = s.sy * stretchY;
      const settled = s.resting && Math.abs(s.sx - 1) < 0.003 && Math.abs(s.sy - 1) < 0.003 &&
        Math.abs(s.vsx) < 0.05 && Math.abs(s.vsy) < 0.05;
      if (settled) {
        s.tp.dropY = 0;
        s.tp.sx = 1;
        s.tp.sy = 1;
        sp.splice(i, 1);
      }
    }
  }

  function stepToppingSprings(h) {
    const sp = state.toppingSprings;
    for (let i = 0; i < sp.length; i++) {
      const s = sp[i];
      if (s.delay > 0) {
        s.delay -= h;
        continue;
      }
      if (!s.resting) {
        s.vy += 2600 * h;
        s.y += s.vy * h;
        if (s.y >= 0) {
          s.y = 0;
          const impact = s.vy;
          if (!s.landed) {
            s.landed = true;
            s.justLanded = true;
          }
          if (impact > 140 && s.bounces < 3) {
            s.vy = -impact * 0.34;
            s.bounces++;
            const q = Math.min(0.42, impact * 0.00058);
            s.vsy -= q * 22;
            s.vsx += q * 18;
          } else {
            s.vy = 0;
            s.resting = true;
          }
        }
      }
      const ax = (1 - s.sx) * 520 - s.vsx * 15;
      const ay = (1 - s.sy) * 520 - s.vsy * 15;
      s.vsx += ax * h;
      s.vsy += ay * h;
      s.sx += s.vsx * h;
      s.sy += s.vsy * h;
    }
  }

  /* ==========================================================================
   * Station 5: 3-Phase Spoon-to-Mouth Feeding & 8 Reaction Evaluator
   * ========================================================================== */
  function evaluateDishReaction() {
    const ids = dish.items.map(i => i.id);
    const anyBurnt = cookProgress > 1.08 || dish.items.some(i => (i.cooked || 0) > 1.08);
    if (anyBurnt) return { kind: 'burnt', stars: 2 };
    if (ids.includes('chili')) return { kind: 'fire', stars: 3 };
    if (ids.includes('lemon') && !ids.includes('honey') && !ids.includes('chocolate')) return { kind: 'sour', stars: 3 };
    const fruitCount = dish.items.filter(i => KitchenData.getIngredient(i.id).cat === 'fruit').length;
    if (dish.toppings.some(tp => tp.id === 'sprinkles') || fruitCount >= 3) return { kind: 'rainbow', stars: 3 };
    if (ids.includes('popcandy')) return { kind: 'float', stars: 3 };
    if (ids.includes('icecream') && !dish.bakedCake) return { kind: 'ice', stars: 3 };
    if ((ids.includes('milk') && ids.includes('honey')) || (currentCritter().id === 'catnap' && (ids.includes('milk') || ids.includes('honey')))) {
      return { kind: 'sleepy', stars: 3 };
    }
    return { kind: 'love', stars: 3 };
  }

  function portionPoint(i) {
    const c = stationCenter(5), sc = 1.05;
    let p = null;
    const fn = artFn('getDishPortionPoint');
    if (fn) {
      try {
        p = fn.call(KitchenArt, i, dish);
      } catch (e) {
        artErrors.getDishPortionPoint = String((e && e.message) || e);
      }
    }
    if (!p || !isFinite(p.x) || !isFinite(p.y)) {
      p = dish.vessel === 'cup' ? { x: 0, y: -50 } : PORTION_POINTS[i % PORTION_POINTS.length];
    }
    return { x: c.x + p.x * sc, y: c.y + p.y * sc };
  }

  function pickBiteIngredient(portion) {
    const items = dish.items.filter(it => it.id !== 'dough' && it.id !== 'pizzabase' && it.id !== 'milk');
    const pick = items.length ? items[portion % items.length] : (dish.items[0] || { id: 'strawberry' });
    const meta = KitchenData.getIngredient(pick.id);
    return { id: pick.id, color: meta.color };
  }

  function feedingBusy() {
    return state.flyingSpoon.active || spoonQueue.length > 0 || fork.dragging;
  }

  // Logical bite: synchronous so headless scripts see bitesTaken/serveSuccess at once.
  function commitBite() {
    dish.bitesTaken = Math.min(3, dish.bitesTaken + 1);
    const rxn = evaluateDishReaction();
    lastReaction = rxn.kind;
    const biteIndex = dish.bitesTaken;
    if (biteIndex === 1) {
      starsEarned += rxn.stars;
      saveDishSnapshotToAlbum(rxn);
    }
    if (biteIndex === 3) {
      serveSuccess = true;
      servedCount++;
    }
    return { biteIndex, rxnKind: rxn.kind };
  }

  function feedBite(opts) {
    const fromUser = !!(opts && opts.fromUser === true);
    ensureDishHasBase();
    if (dish.bitesTaken >= 3) {
      if (fromUser) {
        if (!feedingBusy()) {
          const a = critterAnchor();
          sfx('critterChime', critterIdx);
          heartBurst(a.x, a.y - 30, 6, 0);
          state.wave = 1;
        }
        return false;
      }
      // Scripted refill: the plate magically refills for another round.
      completeFeedingNow();
      dish.bitesTaken = 0;
      state.scoopsShown = 0;
      state.bitesEaten = 0;
      const c = stationCenter(5);
      starBurst(c.x, c.y - 20, ['#F7C948', '#F4A6B8', '#9CD3C2'], 10, 5, true);
    }
    const bite = commitBite();
    if (feedingBusy()) {
      if (fromUser && !fork.dragging) {
        spoonQueue.push(bite);
      } else {
        completeFeedingNow();
        launchSpoon(bite);
      }
    } else {
      launchSpoon(bite);
    }
    renderPrimaryActionButton();
    return true;
  }

  function feedOneBite() {
    return feedBite();
  }

  function launchSpoon(bite) {
    const fs = state.flyingSpoon;
    const portion = clamp(state.scoopsShown, 0, 2);
    const scoop = portionPoint(portion);
    const m = mouthPoint();
    const end = spoonEndPoint(m);
    fs.fromX = fs.x || fork.homeX;
    fs.fromY = fs.y || fork.homeY;
    fs.fromAngle = isFinite(fs.angle) ? fs.angle : -0.55;
    fs.active = true;
    fs.t = 0;
    fs.duration = 1.25;
    fs.phase = 'scoop';
    fs.startX = scoop.x;
    fs.startY = scoop.y;
    fs.endX = end.x;
    fs.endY = end.y;
    fs.ctrlX = Math.max(scoop.x, end.x) + 110;
    fs.ctrlY = lerp(scoop.y, end.y, 0.62);
    fs.biteIndex = bite.biteIndex;
    fs.rxnKind = bite.rxnKind;
    fs.portion = portion;
    fs.scooped = false;
    fs.delivered = false;
    fs.loaded = false;
    fs.manual = false;
    const sample = pickBiteIngredient(portion);
    fs.ingId = sample.id;
    fs.color = sample.color;
    sfx('whoosh', 0.4);
  }

  // Phase A end: the spoon lifts a luscious portion off the plate.
  function doScoop(fs) {
    if (fs.scooped) return;
    fs.scooped = true;
    fs.loaded = true;
    state.scoopsShown = Math.min(3, state.scoopsShown + 1);
    state.scoopProgress = 0;
    if (stationVisible(5)) {
      const pp = portionPoint(fs.portion);
      crumbBurst(pp.x, pp.y, fs.color, 5, 5);
      starBurst(pp.x, pp.y - 8, ['#FFF3B8', '#F7C948'], 3, 5, true);
    }
    sfx('popSelect', 5);
  }

  // Phase C start: bite enters the mouth -> chomp, chew, floating hearts.
  function deliverBite(fs) {
    if (fs.delivered) return;
    fs.delivered = true;
    fs.loaded = false;
    state.bitesEaten = Math.min(3, state.bitesEaten + 1);
    state.chewTimer = CHEW_TIME;
    state.mouthChompT = 0.12;
    const isDrink = dish.vessel === 'cup';
    if (!sfx('playChomp', isDrink)) sfx('bite', isDrink);
    const m = mouthPoint();
    heartBurst(m.x, m.y - 34, 6, 0);
    crumbBurst(m.x + 8, m.y + 10, fs.color, 6, 0);
    state.pendingReaction = { kind: fs.rxnKind, final: fs.biteIndex >= 3 || state.bitesEaten >= 3 };
    renderPrimaryActionButton();
  }

  function applyPendingReaction() {
    const pr = state.pendingReaction;
    if (!pr) return;
    state.pendingReaction = null;
    if (pr.final) {
      startCelebration(pr.kind);
    } else {
      state.reaction = pr.kind;
      state.reactionTimer = 2.0;
      sfx('reaction', pr.kind);
    }
  }

  function startCelebration(kind) {
    state.reaction = kind;
    state.reactionTimer = 4.8;
    state.celebrateTimer = 3.2;
    state.wave = 1;
    sfx('reaction', kind);
    confettiRain(70);
    const a = critterAnchor();
    heartBurst(a.x, a.y - 40, 10, 0);
    starBurst(a.x, a.y - 20, ['#F7C948', '#FFF3B8', '#F4A6B8'], 12, 0, true);
    state.flashAt = state.t + 0.45;
    flyStarToBadge();
  }

  // DOM star badge fly-in (drawn icon on a temporary canvas, zero text)
  function flyStarToBadge() {
    try {
      const badge = document.getElementById('starBadge');
      if (!badge || !canvas || typeof badge.animate !== 'function') return;
      const cr = canvas.getBoundingClientRect();
      const br = badge.getBoundingClientRect();
      if (!cr.width || !br.width) return;
      const a = critterAnchor();
      const sx = cr.left + (a.x / W) * cr.width;
      const sy = cr.top + ((a.y - 40) / H) * cr.height;
      const ex = br.left + br.width * 0.3;
      const ey = br.top + br.height / 2;
      const size = 56;
      const cv = document.createElement('canvas');
      cv.width = size * 2;
      cv.height = size * 2;
      cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:fixed;left:0;top:0;width:' + size + 'px;height:' + size + 'px;' +
        'pointer-events:none;z-index:9999;';
      const c2 = cv.getContext('2d');
      c2.scale(2, 2);
      KitchenArt.drawIcon(c2, 'star', size / 2, size / 2, size * 0.42, 0);
      document.body.appendChild(cv);
      const midX = (sx + ex) / 2 + 40, midY = Math.min(sy, ey) - 70;
      const half = size / 2;
      const anim = cv.animate([
        { transform: 'translate(' + (sx - half) + 'px,' + (sy - half) + 'px) scale(0.2) rotate(0deg)', opacity: 0 },
        { transform: 'translate(' + (sx - half) + 'px,' + (sy - half - 34) + 'px) scale(1.5) rotate(50deg)', opacity: 1, offset: 0.25 },
        { transform: 'translate(' + (midX - half) + 'px,' + (midY - half) + 'px) scale(1.2) rotate(210deg)', opacity: 1, offset: 0.62 },
        { transform: 'translate(' + (ex - half) + 'px,' + (ey - half) + 'px) scale(0.45) rotate(360deg)', opacity: 0.9 },
      ], { duration: 1150, delay: 350, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'both' });
      anim.onfinish = () => {
        cv.remove();
        badge.animate([
          { transform: 'scale(1)' },
          { transform: 'scale(1.35) rotate(-6deg)' },
          { transform: 'scale(0.92)' },
          { transform: 'scale(1)' },
        ], { duration: 520, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
        sfx('sparkle');
      };
    } catch (e) {}
  }

  function completeFeedingNow() {
    const fs = state.flyingSpoon;
    if (fork.dragging) cancelSpoonDrag();
    if (fs.active) {
      doScoop(fs);
      deliverBite(fs);
      fs.active = false;
      fs.t = 0;
      fs.phase = 'idle';
    }
    while (spoonQueue.length) {
      const b = spoonQueue.shift();
      fs.biteIndex = b.biteIndex;
      fs.rxnKind = b.rxnKind;
      fs.portion = clamp(state.scoopsShown, 0, 2);
      fs.scooped = false;
      fs.delivered = false;
      doScoop(fs);
      deliverBite(fs);
    }
    fs.loaded = false;
  }

  function abortFeeding() {
    const fs = state.flyingSpoon;
    fs.active = false;
    fs.t = 0;
    fs.phase = 'idle';
    fs.loaded = false;
    spoonQueue = [];
    fork.dragging = false;
    spoonGrab = null;
    state.pendingReaction = null;
    state.chewTimer = 0;
    state.chewing = 0;
    state.scoopProgress = 0;
  }

  function startSpoonDrag(pt) {
    const fs = state.flyingSpoon;
    if (fs.active || spoonQueue.length) return;
    fork.dragging = true;
    if (spoonGrab) spoonGrab.startedDrag = true;
    fs.manual = true;
    fork.x = pt.x;
    fork.y = pt.y;
    if (dish.bitesTaken < 3 && state.scoopsShown < 3) {
      const portion = state.scoopsShown;
      const sample = pickBiteIngredient(portion);
      fs.ingId = sample.id;
      fs.color = sample.color;
      fs.portion = portion;
      fs.scooped = false;
      fs.delivered = false;
      doScoop(fs);
    } else {
      fs.loaded = false;
    }
  }

  function deliverByDrag() {
    const fs = state.flyingSpoon;
    if (!fork.dragging) return;
    fork.dragging = false;
    spoonGrab = null;
    if (!fs.loaded) return;
    const bite = commitBite();
    fs.biteIndex = bite.biteIndex;
    fs.rxnKind = bite.rxnKind;
    deliverBite(fs);
    // Glide home on the same Phase C timeline
    fs.active = true;
    fs.t = SPOON_DELIVER;
    fs.endX = fs.x;
    fs.endY = fs.y;
    fs.scooped = true;
    fs.delivered = true;
    fs.phase = 'eat';
    renderPrimaryActionButton();
  }

  function cancelSpoonDrag() {
    const fs = state.flyingSpoon;
    fork.dragging = false;
    spoonGrab = null;
    if (fs.loaded && !fs.delivered) {
      fs.loaded = false;
      state.scoopsShown = Math.max(state.bitesEaten, state.scoopsShown - 1);
      const pp = portionPoint(state.scoopsShown);
      starBurst(pp.x, pp.y, ['#F7C948', '#F4A6B8'], 5, 5, true);
    }
  }

  function computeSpoonPose(fs) {
    const k = fs.t;
    const restAngle = -0.55;
    if (k < SPOON_SCOOP_END) {
      // Phase A: travel to the portion, dip & squash-scoop
      fs.phase = 'scoop';
      const a = k / SPOON_SCOOP_END;
      const hoverY = fs.startY - 30;
      if (a < 0.55) {
        const e = easeInOutCubic(a / 0.55);
        fs.x = lerp(fs.fromX, fs.startX + 6, e);
        fs.y = lerp(fs.fromY, hoverY, e) - Math.sin(e * Math.PI) * 26;
        fs.angle = lerp(fs.fromAngle, -0.95, e);
        fs.squash = 1;
      } else {
        const d = seg(a, 0.55, 1);
        const dip = Math.sin(d * Math.PI);
        fs.x = fs.startX + 6 - d * 10;
        fs.y = hoverY + dip * 34 - d * 6;
        fs.angle = lerp(-0.95, -0.35, easeInOutCubic(d));
        fs.squash = 1 - 0.18 * dip;
      }
      fs.scale = 1;
      state.scoopProgress = fs.scooped ? 0 : seg(a, 0.62, 1);
    } else if (k < SPOON_DELIVER) {
      // Phase B: curved Bezier flight up to the Critter's open mouth
      fs.phase = 'fly';
      const b = easeInOutCubic(seg(k, SPOON_SCOOP_END, SPOON_DELIVER));
      const sx = fs.startX - 4, sy = fs.startY - 36;
      const u = 1 - b;
      fs.x = u * u * sx + 2 * u * b * fs.ctrlX + b * b * fs.endX;
      fs.y = u * u * sy + 2 * u * b * fs.ctrlY + b * b * fs.endY;
      fs.angle = -0.35 - Math.sin(b * Math.PI) * 0.35 + b * 0.15;
      fs.squash = 1 + Math.sin(b * Math.PI) * 0.06;
      fs.scale = 1 - 0.14 * b;
      state.scoopProgress = 0;
    } else {
      // Phase C: tiny push into the mouth, then glide home empty
      fs.phase = 'eat';
      const c = seg(k, SPOON_DELIVER, 1);
      const push = Math.sin(seg(c, 0, 0.3) * Math.PI) * 6;
      const r = easeInOutCubic(seg(c, 0.22, 1));
      fs.x = lerp(fs.endX - push * 0.6, fork.homeX, r);
      fs.y = lerp(fs.endY - push * 0.3, fork.homeY, r) - Math.sin(r * Math.PI) * 40;
      fs.angle = lerp(-0.2, restAngle, r);
      fs.squash = 1;
      fs.scale = lerp(0.86, 1, r);
      state.scoopProgress = 0;
    }
  }

  function updateFeeding(dt) {
    const fs = state.flyingSpoon;
    state.guideDash += dt * 26;
    if (fs.active) {
      const prev = fs.t;
      fs.t = Math.min(1, fs.t + dt / fs.duration);
      if (prev < SPOON_SCOOP_END && fs.t >= SPOON_SCOOP_END) doScoop(fs);
      if (prev < SPOON_DELIVER && fs.t >= SPOON_DELIVER) deliverBite(fs);
      computeSpoonPose(fs);
      if (fs.t >= 1) {
        fs.active = false;
        fs.t = 0;
        fs.phase = 'idle';
        fs.loaded = false;
        fs.manual = false;
        if (spoonQueue.length) launchSpoon(spoonQueue.shift());
      }
    } else if (fork.dragging) {
      const f = 1 - Math.exp(-26 * dt);
      const px = fs.x;
      fs.x += (fork.x - fs.x) * f;
      fs.y += (fork.y - fs.y) * f;
      const vx = dt > 0 ? (fs.x - px) / dt : 0;
      fs.angle += (clamp(-0.45 + vx * 0.0009, -1.0, 0.1) - fs.angle) * (1 - Math.exp(-12 * dt));
      fs.squash = 1;
      fs.scale = 1;
      fs.phase = 'drag';
      const m = mouthPoint();
      const dist = Math.hypot(fs.x - m.x, fs.y - m.y);
      state.dragMouth = fs.loaded ? clamp01(1 - (dist - 40) / 170) : 0;
      if (fs.loaded && dist < 60) deliverByDrag();
    } else {
      // Idle: rest beside the plate with a gentle breathing bob
      const f = 1 - Math.exp(-10 * dt);
      fs.x += (fork.homeX - fs.x) * f;
      fs.y += (fork.homeY + Math.sin(state.t * 2.2) * 3 - fs.y) * f;
      fs.angle += (-0.55 + Math.sin(state.t * 1.7) * 0.04 - fs.angle) * f;
      fs.squash = 1;
      fs.scale = 1;
      fs.phase = 'idle';
      state.dragMouth = 0;
    }
  }

  function cleanDishForSnapshot() {
    return Object.assign({}, dish, {
      bitesTaken: 0,
      piping: dish.piping.map(p => Object.assign({}, p, { scale: 1 })),
      toppings: dish.toppings.map(tp => Object.assign({}, tp, { dropY: 0, sx: 1, sy: 1 })),
    });
  }

  function saveDishSnapshotToAlbum(rxn) {
    try {
      const snapCv = document.createElement('canvas');
      snapCv.width = 240;
      snapCv.height = 176;
      const sctx = snapCv.getContext('2d');
      sctx.fillStyle = '#FAF3EB';
      sctx.fillRect(0, 0, 240, 176);
      KitchenArt.drawDish(sctx, cleanDishForSnapshot(), 120, 98, 0.6, t);

      const c = currentCritter();
      album.unshift({
        critterIcon: c.icon,
        reactionKind: rxn.kind,
        stars: rxn.stars,
        dataUrl: snapCv.toDataURL('image/jpeg', 0.85),
      });
      saveStorage();
    } catch (e) {}
  }

  /* ==========================================================================
   * Critter Customer Rig Driver (mouth, chew, gaze, anticipation, dance)
   * ========================================================================== */
  function updateCritter(dt) {
    if (state.chewTimer > 0) {
      const prev = state.chewTimer;
      state.chewTimer = Math.max(0, state.chewTimer - dt);
      if (state.pendingReaction && prev > REACT_AT_CHEW && state.chewTimer <= REACT_AT_CHEW) {
        applyPendingReaction();
      }
    }
    if (state.pendingReaction && state.chewTimer <= 0) applyPendingReaction();
    state.chewing = state.chewTimer;

    if (state.reactionTimer > 0) {
      state.reactionTimer = Math.max(0, state.reactionTimer - dt);
      if (state.reactionTimer === 0) state.reaction = null;
    }
    if (state.celebrateTimer > 0) state.celebrateTimer = Math.max(0, state.celebrateTimer - dt);
    const ct = state.celebrateTimer;
    state.celebrate = ct <= 0 ? 0 : Math.min(clamp01((3.2 - ct) / 0.25), clamp01(ct / 0.7));
    state.wave = Math.max(0, state.wave - dt * 0.9);

    if (state.flashAt >= 0 && state.t >= state.flashAt) {
      state.flashAt = -1;
      state.flash = 1;
      sfx('shutter');
    }
    state.flash = Math.max(0, state.flash - dt * 3.2);

    // "Ahh!" mouth opens as the spoon approaches, snaps shut on the chomp
    const fs = state.flyingSpoon;
    let target = 0;
    if (fs.active && fs.phase === 'fly') target = easeInOutCubic(seg(fs.t, SPOON_SCOOP_END + 0.02, 0.62));
    else if (fork.dragging) target = state.dragMouth;
    if (state.mouthChompT > 0) {
      state.mouthChompT -= dt;
      target = 0;
    }
    const rate = target < state.mouthOpen ? (state.mouthChompT > 0 ? 34 : 12) : 10;
    state.mouthOpen += (target - state.mouthOpen) * (1 - Math.exp(-rate * dt));
    if (state.mouthOpen < 0.002) state.mouthOpen = 0;

    // Gaze target: spoon > flying food > knife > tossed food > pointer
    let lt = state.pointer;
    const off1 = layerOffset(1);
    const off3 = layerOffset(3);
    const off5 = layerOffset(5);
    if ((fs.active || fork.dragging) && off5 !== null) {
      lt = { x: fs.x + off5, y: fs.y };
    } else if (state.flyers.length) {
      lt = flyerPos(state.flyers[state.flyers.length - 1]);
    } else if (state.hopSlices.length) {
      const h = state.hopSlices[0];
      lt = { x: lerp(h.x0, h.x1, clamp01(h.p)), y: lerp(h.y0, h.y1, clamp01(h.p)) - 60 };
    } else if (state.knifeSlash.active && off1 !== null) {
      lt = { x: state.knifeSlash.pose.x + off1, y: state.knifeSlash.pose.y };
    } else if (state.panToss.active && off3 !== null) {
      const c3 = stationCenter(3);
      lt = { x: c3.x + off3, y: c3.y - state.panToss.height * Math.sin(Math.PI * seg(state.panToss.t, TOSS_LAUNCH, 0.72)) };
    }
    const f = 1 - Math.exp(-9 * dt);
    state.lookTarget.x += (lt.x - state.lookTarget.x) * f;
    state.lookTarget.y += (lt.y - state.lookTarget.y) * f;
    const a = critterAnchor();
    state.critterX = a.x;
    state.critterY = a.y;
    state.counterY = counterLineY();
    state.lookX = clamp((state.lookTarget.x - a.x) / 180, -1, 1);
    state.lookY = clamp((state.lookTarget.y - a.y) / 140, -1, 1);

    let ant = 0;
    if (station === 3 && panItems.length) ant = 0.45 + (0.15 * heatLevel) / 3;
    if (station === 4) ant = 0.35;
    if (station === 5) ant = 0.5;
    if (fs.active && fs.phase !== 'eat') ant = 1;
    if (fork.dragging) ant = 0.9;
    if (state.reaction) ant = 0;
    state.anticipation += (ant - state.anticipation) * (1 - Math.exp(-4 * dt));
  }

  /* ==========================================================================
   * Station Switching (Elastic Camera Slide) & Floating Action Button
   * ========================================================================== */
  function setStation(num) {
    const prev = station;
    if (prev === 5 && num !== 5) completeFeedingNow();
    station = num;
    state.station = num;
    if (prev !== num) sfx('popSelect', num);
    document.querySelectorAll('.station-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.station) === station);
    });
    const drawer = document.getElementById('ingredientDrawer');
    const decorBar = document.getElementById('decorToolbar');
    if (drawer) drawer.style.display = station <= 3 ? 'flex' : 'none';
    if (decorBar) decorBar.style.display = station === 4 ? 'flex' : 'none';

    if (station === 3 && panItems.length === 0 && prepTray.length > 0) {
      prepTray.forEach(p => addToCooker(p.id, p.sliced, p.cracked));
    }
    if (station >= 4) {
      ensureDishHasBase();
    }
    if (prev !== num) startStationSlide(prev, num);
    requestAnimationFrame(resize);
    fork.x = W * 0.68;
    fork.y = H * 0.66;
    fork.homeX = W * 0.68;
    fork.homeY = H * 0.66;
    renderPrimaryActionButton();
  }

  function startStationSlide(from, to) {
    if (!canvas) return;
    const tr = state.stationTransition;
    const dir = to > from ? 1 : -1;
    const span = Math.max(640, W * 0.92);
    if (tr.active) {
      state.stationSlideOffset = clamp(state.stationSlideOffset + dir * span, -span * 1.6, span * 1.6);
    } else {
      state.stationSlideOffset = dir * span;
      state.stationSlideVel = 0;
    }
    tr.active = true;
    tr.from = from;
    tr.to = to;
    tr.dir = dir;
    tr.span = span;
    tr.t = 0;
    state.particles = state.particles.filter(p => p.layer === 0 || p.layer === from || p.layer === to);
    state.confetti = state.confetti.filter(q => q.layer === 0 || q.layer === from || q.layer === to);
    state.wave = Math.max(state.wave, 0.6);
    sfx('whoosh', 0.35);
  }

  function updateTransition(dt) {
    const tr = state.stationTransition;
    if (!tr.active) return;
    tr.t += dt;
    if (tr.t > 0.25 && Math.abs(state.stationSlideOffset) < 0.6 && Math.abs(state.stationSlideVel) < 12) {
      tr.active = false;
      state.stationSlideOffset = 0;
      state.stationSlideVel = 0;
      const keep = tr.to;
      state.particles = state.particles.filter(p => p.layer === 0 || p.layer === keep);
      state.confetti = state.confetti.filter(q => q.layer === 0 || q.layer === keep);
    }
  }

  function resetKitchenForNewDish(nextOrder) {
    abortFeeding();
    const ks = state.knifeSlash;
    ks.active = false;
    ks.t = 0;
    ks.impactDone = true;
    state.panToss.active = false;
    state.panToss.bodies = [];
    state.panToss.baseBody = null;
    state.hopSlices = [];
    state.toppingSprings = [];
    dollopPops = [];
    boardItem = null;
    state.boardView = null;
    prepTray = [];
    trayHidden = 0;
    mixItems = [];
    mixProgress = 0;
    panItems = [];
    cookProgress = 0;
    dish = createFreshDish();
    state.scoopsShown = 0;
    state.bitesEaten = 0;
    state.reaction = null;
    state.reactionTimer = 0;
    state.celebrateTimer = 0;
    serveSuccess = false;
    lastReaction = null;
    if (nextOrder) {
      orderIdx = (orderIdx + 1) % KitchenData.WISH_ORDERS.length;
      if (mode === 'wish') {
        const ord = currentOrder();
        const cIdx = KitchenData.CRITTERS.findIndex(c => c.id === ord.critter);
        if (cIdx >= 0) critterIdx = cIdx;
        cookMode = ord.wantCooking === 'oven' ? 'oven' : 'pan';
        mixMode = ord.wantCooking === 'blender' ? 'blender' : 'bowl';
      }
    }
    renderPrepTrayUI();
    renderCustomerBar();
    setStation(1);
  }

  function renderPrimaryActionButton() {
    const cv = document.getElementById('primaryActionCv');
    if (!cv) return;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.save();
    c.scale(2, 2); // 64x36 logical

    let leftIcon = 'knife';
    let rightIcon = 'star';
    if (station === 1) {
      if (!boardItem && prepTray.length > 0) {
        leftIcon = 'arrow_right';
        rightIcon = 'bowl';
      } else {
        leftIcon = 'knife';
        rightIcon = 'star';
      }
    } else if (station === 2) {
      if (mixProgress >= 1) {
        leftIcon = 'arrow_right';
        rightIcon = 'pan';
      } else {
        leftIcon = mixMode === 'blender' ? 'blender' : 'bowl';
        rightIcon = 'star';
      }
    } else if (station === 3) {
      if (cookProgress >= 0.65) {
        leftIcon = 'arrow_right';
        rightIcon = 'cupcake';
      } else {
        leftIcon = cookMode === 'oven' ? 'oven' : 'pan';
        rightIcon = 'star';
      }
    } else if (station === 4) {
      leftIcon = 'arrow_right';
      rightIcon = 'plate';
    } else if (station === 5) {
      leftIcon = dish.bitesTaken >= 3 && state.bitesEaten >= 3 ? 'refresh' : 'plate';
      rightIcon = 'star';
    }

    KitchenArt.drawIcon(c, leftIcon, 20, 18, 13, t);
    KitchenArt.drawIcon(c, rightIcon, 46, 18, 12, t);
    c.restore();
  }

  /* ==========================================================================
   * 60fps Simulation: tick(dt) + fixed-step spring physics
   * ========================================================================== */
  function physicsStep(h) {
    stepBoardSpring(state.boardSpring, h);
    // Board recoil (px, + = pushed down)
    state.boardRecoilVel += (-state.boardRecoil * 420 - state.boardRecoilVel * 18) * h;
    state.boardRecoil += state.boardRecoilVel * h;
    // Freshly cut slices fan apart with a springy overshoot
    state.sliceSepVel += ((1 - state.sliceSepProgress) * 210 - state.sliceSepVel * 15) * h;
    state.sliceSepProgress += state.sliceSepVel * h;
    // Bowl leans with the vortex
    const tiltTarget = clamp(state.mixVelocity * 0.0055, -0.075, 0.075);
    state.bowlTiltVel += ((tiltTarget - state.bowlTilt) * 110 - state.bowlTiltVel * 9) * h;
    state.bowlTilt += state.bowlTiltVel * h;
    // Skillet catch dip & oven bake pulse
    state.panCatchVel += (-state.panCatch * 300 - state.panCatchVel * 16) * h;
    state.panCatch += state.panCatchVel * h;
    state.ovenPulseVel += (-state.ovenPulse * 200 - state.ovenPulseVel * 10) * h;
    state.ovenPulse += state.ovenPulseVel * h;
    // Piping bag / shaker follows the finger with soft lag
    const tp = state.toolPos;
    tp.vx += ((hoverPt.x - tp.x) * 320 - tp.vx * 26) * h;
    tp.vy += ((hoverPt.y - tp.y) * 320 - tp.vy * 26) * h;
    tp.x += tp.vx * h;
    tp.y += tp.vy * h;
    stepToppingSprings(h);
    // Elastic camera slide (under-damped: ~5% overshoot)
    if (state.stationTransition.active) {
      state.stationSlideVel += (-state.stationSlideOffset * 95 - state.stationSlideVel * 13.5) * h;
      state.stationSlideOffset += state.stationSlideVel * h;
    }
  }

  function tick(rawDt) {
    const dt = Math.max(0, rawDt) * timeScale;
    state.t += dt;
    t = state.t;
    physAcc += dt;
    let steps = 0;
    while (physAcc >= PHYS_STEP && steps < 14) {
      physicsStep(PHYS_STEP);
      physAcc -= PHYS_STEP;
      steps++;
    }
    if (steps >= 14) physAcc = 0;
    updateFlyers(dt);
    updateKnife(dt);
    updateBoard(dt);
    updateMix(dt);
    updateCook(dt);
    updateDecorate(dt);
    updateFeeding(dt);
    updateCritter(dt);
    updateParticles(dt);
    updateTransition(dt);
  }

  /* ==========================================================================
   * Main Canvas Renderer
   * ========================================================================== */
  function draw() {
    if (ctxNeedsReset && typeof ctx.reset === 'function') ctx.reset();
    ctxNeedsReset = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // 1. Cozy Sunlit Pinterest Patisserie Backdrop & Countertop
    callArt('drawKitchenBackdrop', [ctx, W, H, t], () => {
      ctx.fillStyle = '#FAF3EB';
      ctx.fillRect(0, 0, W, H);
    });
    drawSlideStreaks(ctx);

    // 2. Illustrated Plush Critter Chef Customer
    const a = critterAnchor();
    callArt('drawCritterCustomer', [ctx, currentCritter(), a.x, a.y, CRITTER_SCALE, state, t]);

    // 3. Pinterest Thought Cloud Recipe Card (Left of Customer, 100% Vector Art)
    drawWishBubble(ctx, 26, 36);

    // 4. Active Kitchen Station(s) on the sliding countertop layer
    const tr = state.stationTransition;
    if (tr.active) {
      const offOut = layerOffset(tr.from);
      if (tr.from !== tr.to && offOut !== null && Math.abs(offOut) < W + 60) drawStationLayer(tr.from, offOut);
      drawStationLayer(tr.to, state.stationSlideOffset);
    } else {
      drawStationLayer(station, 0);
    }

    // 5. Screen-space choreography: flying food, basket hops, hearts, confetti
    drawFlyers(ctx);
    drawHopSlices(ctx);
    drawParticles(ctx, 0);
    drawConfetti(ctx, 0);
    drawSlashTrail(ctx);

    // 6. Polaroid photo flash for the sticker album
    if (state.flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = state.flash * 0.45;
      ctx.fillStyle = '#FFFDF6';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  function render(now) {
    requestAnimationFrame(render);
    const dt = Math.min(0.05, Math.max(0, (now - (lastTs || now)) / 1000));
    lastTs = now;
    tick(dt);
    draw();
  }

  function drawStationLayer(st, offX) {
    ctx.save();
    ctx.translate(offX, 0);
    // Props lean into the slide like a soft cartoon smear
    const lean = state.stationTransition.active ? clamp(state.stationSlideVel * 0.000045, -0.1, 0.1) : 0;
    if (Math.abs(lean) > 0.001) {
      const baseY = H * 0.8;
      ctx.translate(0, baseY);
      ctx.transform(1, 0, lean, 1, 0, 0);
      ctx.translate(0, -baseY);
    }
    if (st === 1) renderChopStation(ctx);
    else if (st === 2) renderMixStation(ctx);
    else if (st === 3) renderCookStation(ctx);
    else if (st === 4) renderDecorateStation(ctx);
    else if (st === 5) renderFeedStation(ctx);
    drawParticles(ctx, st);
    drawConfetti(ctx, st);
    ctx.restore();
  }

  function drawSlideStreaks(c) {
    const v = Math.abs(state.stationSlideVel);
    if (!state.stationTransition.active || v < 300) return;
    const alpha = clamp((v - 300) / 2400, 0, 0.32);
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = '#FFFDF9';
    c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const y = H * (0.5 + i * 0.075) + Math.sin(i * 12.9) * 8;
      const len = 80 + ((i * 53) % 120);
      const wrap = W + 220;
      const x = ((((i * 197 + state.stationSlideOffset * 0.6) % wrap) + wrap) % wrap) - 110;
      c.lineWidth = 3 + (i % 3);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + len, y);
      c.stroke();
    }
    c.restore();
  }

  function drawSlashTrail(c) {
    slashTrail = slashTrail.filter(pt => t - pt.t < 0.18);
    if (slashTrail.length < 2) return;
    c.save();
    c.lineCap = 'round';
    c.strokeStyle = '#FFFDF9';
    for (let i = 1; i < slashTrail.length; i++) {
      const k = i / (slashTrail.length - 1);
      c.globalAlpha = 0.25 + 0.6 * k;
      c.lineWidth = 2 + 7 * k;
      c.beginPath();
      c.moveTo(slashTrail[i - 1].x, slashTrail[i - 1].y);
      c.lineTo(slashTrail[i].x, slashTrail[i].y);
      c.stroke();
    }
    c.restore();
  }

  /* ==========================================================================
   * Pinterest Thought Cloud Recipe Card (100% Custom Vector Illustrations)
   * ========================================================================== */
  function drawWishBubble(ctx, x, y) {
    ctx.save();
    y += Math.sin(t * 1.6) * 2;
    // Soft card drop shadow
    ctx.fillStyle = 'rgba(92, 61, 46, 0.12)';
    KitchenArt.rr(ctx, x + 3, y + 5, 244, 128, 24);
    ctx.fill();

    KitchenArt.rr(ctx, x, y, 244, 128, 24);
    ctx.fillStyle = 'rgba(255, 253, 249, 0.96)';
    ctx.fill();
    ctx.strokeStyle = '#D9B89C';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Thought bubble pointer circles toward Critter
    ctx.fillStyle = '#FFFDF9';
    KitchenArt.circ(ctx, x + 256, y + 66, 8);
    ctx.fill();
    ctx.stroke();
    KitchenArt.circ(ctx, x + 272, y + 72, 5);
    ctx.fill();
    ctx.stroke();

    if (mode === 'wish') {
      const ord = currentOrder();
      const cookIcon = ord.wantCooking === 'oven' ? 'oven' : (ord.wantCooking === 'blender' ? 'blender' : 'pan');
      KitchenArt.drawIcon(ctx, 'wish', x + 84, y + 25, 16, t);
      KitchenArt.drawIcon(ctx, 'arrow_right', x + 122, y + 25, 11, t);
      KitchenArt.drawIcon(ctx, cookIcon, x + 160, y + 25, 16, t);

      const usedIds = new Set([
        ...prepTray.map(i => i.id),
        ...mixItems.map(i => i.id),
        ...dish.items.map(i => i.id),
      ]);

      [0, 1, 2].forEach(idx => {
        const bx = x + 46 + idx * 76;
        const by = y + 82;
        const id = ord.wantIds[idx];
        const done = id ? usedIds.has(id) : (dish.piping.length > 0 || dish.toppings.length > 0 || cookProgress >= 0.6);
        ctx.fillStyle = done ? '#E6F4EA' : '#FAF1E6';
        ctx.strokeStyle = done ? '#68B878' : '#DEC0A6';
        ctx.lineWidth = 2.5;
        KitchenArt.circ(ctx, bx, by, 27);
        ctx.fill();
        ctx.stroke();
        if (id) {
          const ing = KitchenData.getIngredient(id);
          KitchenArt.drawIngredient(ctx, id, bx, by, 20, { sliced: done && ing.choppable, shadow: false });
        } else {
          KitchenArt.drawIcon(ctx, 'cupcake', bx, by, 18, t);
        }
        if (done) {
          ctx.fillStyle = '#68B878';
          ctx.strokeStyle = KitchenArt.OUTLINE;
          ctx.lineWidth = 1.8;
          KitchenArt.circ(ctx, bx + 19, by - 19, 9);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(bx + 15, by - 19);
          ctx.lineTo(bx + 18, by - 16);
          ctx.lineTo(bx + 23, by - 22);
          ctx.stroke();
        }
      });
    } else {
      // Free Sandbox Mode: Illustrated Artist Palette + Botanical Ingredients
      KitchenArt.drawIcon(ctx, 'free', x + 76, y + 32, 20, t);
      KitchenArt.drawIcon(ctx, 'star', x + 124, y + 32, 16, t);
      KitchenArt.drawIcon(ctx, 'cupcake', x + 170, y + 32, 18, t);
      ['chili', 'lemon', 'icecream', 'popcandy'].forEach((id, idx) => {
        KitchenArt.drawIngredient(ctx, id, x + 42 + idx * 53, y + 88, 19, { sliced: false, shadow: false });
      });
    }
    ctx.restore();
  }

  /* ==========================================================================
   * Station 1: Warm Oak Butcher Block + Santoku Chef Knife
   * ========================================================================== */
  function renderChopStation(c) {
    const ctr = stationCenter(1);
    const cx = ctr.x, cy = ctr.y;
    const view = state.boardView;
    const landed = !!(view && state.t >= view.landT);
    const ks = state.knifeSlash;
    const s = {
      station: 1,
      boardItem: landed ? {
        id: view.id,
        chops: view.chops,
        maxChops: view.maxChops,
        sliced: view.sliced,
        cracked: view.cracked,
      } : null,
      boardSpring: state.boardSpring,
      boardRecoil: state.boardRecoil,
      knifeSlash: {
        active: ks.active,
        t: ks.t,
        duration: ks.duration,
        sliceIndex: ks.sliceIndex,
        cutX: ks.cutX,
        cutY: ks.cutY,
        pose: ks.pose,
        impactT: KNIFE_IMPACT,
      },
      sliceSepProgress: clamp(state.sliceSepProgress, 0, 1.25),
      hintId: view ? null : hintIngredientId(),
      landPop: landed ? springPop(state.t - view.landT, 0.4, 18) : 0,
    };
    callArt('drawChopStation', [c, cx, cy, s, t], () => fallbackChopStation(c, cx, cy, s, view));
    drawChopPips(c, cx, cy, view);
  }

  function drawChopPips(c, cx, cy, view) {
    if (!view || view.maxChops <= 1) return;
    const shown = view.chops;
    for (let i = 0; i < view.maxChops; i++) {
      const filled = i < shown;
      const px = cx - ((view.maxChops - 1) * 15) + i * 30;
      const py = cy + 74 + state.boardRecoil;
      let sc = 1;
      if (filled && i === shown - 1) sc = 0.6 + 0.4 * springPop(state.t - view.lastImpactT, 0.35, 20);
      c.save();
      c.translate(px, py);
      c.scale(sc, sc);
      c.fillStyle = filled ? '#78C47C' : '#FFFDF9';
      c.strokeStyle = KitchenArt.OUTLINE;
      c.lineWidth = 2.2;
      KitchenArt.circ(c, 0, 0, 7.5);
      c.fill();
      c.stroke();
      if (filled) {
        c.fillStyle = 'rgba(255, 255, 255, 0.6)';
        KitchenArt.circ(c, -2.2, -2.4, 2.2);
        c.fill();
      }
      c.restore();
    }
  }

  function fallbackChopStation(c, cx, cy, s, view) {
    const rec = s.boardRecoil || 0;
    c.fillStyle = 'rgba(92, 61, 46, 0.16)';
    KitchenArt.rr(c, cx - 178, cy - 82, 356, 174, 28);
    c.fill();

    c.save();
    c.translate(0, rec);
    c.fillStyle = '#E6B88A';
    c.strokeStyle = KitchenArt.OUTLINE;
    c.lineWidth = 4;
    KitchenArt.rr(c, cx - 178, cy - 90, 356, 172, 28);
    c.fill();
    c.stroke();
    // Wood grain
    c.strokeStyle = 'rgba(160, 108, 66, 0.35)';
    c.lineWidth = 2;
    for (let g = 0; g < 4; g++) {
      c.beginPath();
      const gy = cy - 50 + g * 30;
      c.moveTo(cx - 150, gy);
      c.bezierCurveTo(cx - 60, gy - 8, cx + 40, gy + 8, cx + 150, gy - 2);
      c.stroke();
    }
    c.strokeStyle = '#C99663';
    c.lineWidth = 2.5;
    KitchenArt.rr(c, cx - 158, cy - 72, 316, 136, 20);
    c.stroke();

    if (s.boardItem && view) {
      const sp = state.boardSpring;
      const pop = Math.max(0.01, s.landPop);
      const pieces = sliceLayout(view, cx, cy);
      pieces.forEach(pc => {
        KitchenArt.drawIngredient(c, view.id, pc.x, pc.y, pc.r, {
          sliced: pc.sliced,
          cracked: view.crackable && view.chops >= 1,
          showShell: view.crackable && view.chops >= 1,
          rot: pc.rot,
          scaleX: sp.sx * pop,
          scaleY: sp.sy * pop,
        });
      });
    } else if (!view && s.hintId) {
      const bounceY = Math.sin(t * 4) * 5;
      c.globalAlpha = 0.85;
      KitchenArt.drawIngredient(c, s.hintId, cx - 20, cy - 4 + bounceY, 36, { sliced: false });
      c.globalAlpha = 1;
    }
    c.restore();

    // Slash swoosh ribbon behind the blade tip
    const trail = state.knifeSlash.trail;
    if (trail.length > 1) {
      c.save();
      c.lineCap = 'round';
      c.strokeStyle = '#FFFFFF';
      for (let i = 1; i < trail.length; i++) {
        const k = i / (trail.length - 1);
        c.globalAlpha = 0.15 + 0.55 * k;
        c.lineWidth = 3 + 11 * k;
        c.beginPath();
        c.moveTo(trail[i - 1].x, trail[i - 1].y);
        c.lineTo(trail[i].x, trail[i].y);
        c.stroke();
      }
      c.restore();
    }
    const pose = s.knifeSlash.pose;
    drawKnifeSprite(c, pose.x, pose.y + (s.knifeSlash.active ? 0 : rec * 0.5), pose.angle, 1);
  }

  function drawKnifeSprite(c, x, y, angle, sc) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.scale(sc, sc);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const g = c.createLinearGradient(0, -34, 0, 0);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.6, '#E6EDF2');
    g.addColorStop(1, '#BFCDD6');
    c.fillStyle = g;
    c.strokeStyle = KitchenArt.OUTLINE;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(16, 0);
    c.lineTo(-58, 0);
    c.quadraticCurveTo(-74, -2, -78, -10);
    c.quadraticCurveTo(-40, -30, 16, -32);
    c.closePath();
    c.fill();
    c.stroke();
    // Metallic gleam
    c.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-52, -9);
    c.lineTo(4, -22);
    c.stroke();
    c.fillStyle = '#D3DFE6';
    for (let i = 0; i < 4; i++) {
      KitchenArt.ell(c, -40 + i * 13, -8, 2.4, 3.6);
      c.fill();
    }
    // Walnut handle with brass rivets
    c.fillStyle = '#C87D4B';
    c.strokeStyle = KitchenArt.OUTLINE;
    c.lineWidth = 3;
    KitchenArt.rr(c, 14, -29, 66, 21, 9);
    c.fill();
    c.stroke();
    c.fillStyle = '#F5D076';
    KitchenArt.circ(c, 34, -18.5, 2.6);
    c.fill();
    KitchenArt.circ(c, 58, -18.5, 2.6);
    c.fill();
    c.restore();
  }

  /* ==========================================================================
   * Station 2: Speckled Ceramic Bowl & Vintage Mint Blender
   * ========================================================================== */
  function renderMixStation(c) {
    const ctr = stationCenter(2);
    const cx = ctr.x, cy = ctr.y;

    drawCanvasIconCard(c, 36, cy - 54, 118, 48, mixMode === 'bowl', 'bowl');
    drawCanvasIconCard(c, 36, cy + 8, 118, 48, mixMode === 'blender', 'blender');

    const s = {
      station: 2,
      mixMode,
      mixItems: shownItems(mixItems),
      mixProgress,
      mixSwirlAngle: state.mixSwirlAngle,
      mixAngle: state.mixSwirlAngle,
      mixVelocity: state.mixVelocity,
      whiskOrbit: state.whiskOrbit,
      whiskHeld: state.whiskHeld,
      bowlTilt: state.bowlTilt,
      mixColor,
      boardSpring: state.boardSpring,
    };
    callArt('drawMixStation', [c, cx, cy, s, t], () => fallbackMixStation(c, cx, cy, s));

    // Right-Side Pinterest Progress Card (100% Vector Icons)
    const rx = cx + 178, ry = cy - 38;
    KitchenArt.rr(c, rx, ry, 182, 78, 18);
    c.fillStyle = 'rgba(255, 253, 249, 0.95)';
    c.fill();
    c.strokeStyle = '#D9B89C';
    c.lineWidth = 2.8;
    c.stroke();
    KitchenArt.drawIcon(c, mixMode === 'blender' ? 'blender' : 'bowl', rx + 64, ry + 24, 15, t);
    KitchenArt.drawIcon(c, 'star', rx + 114, ry + 24, 14, t);
    KitchenArt.rr(c, rx + 18, ry + 48, 146, 14, 7);
    c.fillStyle = '#EFE2D2';
    c.fill();
    if (state.mixBarShown > 0.005) {
      KitchenArt.rr(c, rx + 18, ry + 48, Math.max(14, 146 * clamp01(state.mixBarShown)), 14, 7);
      c.fillStyle = '#78C47C';
      c.fill();
    }
  }

  function fallbackMixStation(c, cx, cy, s) {
    c.translate(cx, cy + 40);
    c.rotate(s.bowlTilt);
    c.translate(0, -40);
    c.scale(s.boardSpring.sx, s.boardSpring.sy);

    if (s.mixMode === 'blender') {
      c.fillStyle = '#E8998D';
      c.strokeStyle = KitchenArt.OUTLINE;
      c.lineWidth = 3.5;
      KitchenArt.rr(c, -64, 38, 128, 40, 16);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(235, 248, 252, 0.84)';
      KitchenArt.rr(c, -72, -92, 144, 134, 22);
      c.fill();
      c.stroke();
      const fillH = Math.max(38, Math.min(118, 38 + s.mixItems.length * 22));
      c.fillStyle = s.mixColor;
      KitchenArt.rr(c, -66, 36 - fillH, 132, fillH, 14);
      c.fill();
    } else {
      c.fillStyle = 'rgba(92, 61, 46, 0.16)';
      KitchenArt.ell(c, 0, 16, 144, 88);
      c.fill();
      c.fillStyle = '#9CC5B5';
      c.strokeStyle = KitchenArt.OUTLINE;
      c.lineWidth = 4;
      KitchenArt.ell(c, 0, 0, 140, 84);
      c.fill();
      c.stroke();
      c.fillStyle = s.mixColor;
      KitchenArt.ell(c, 0, 2, 120, 70);
      c.fill();
      c.stroke();
      // Vortex dip deepens with swirl speed
      const dip = clamp(Math.abs(s.mixVelocity) / 14, 0, 1);
      if (dip > 0.02) {
        c.fillStyle = KitchenArt.lerpColor(s.mixColor, '#5C3D2E', 0.18 * dip);
        KitchenArt.ell(c, 0, 4, 40 * dip + 6, 20 * dip + 3);
        c.fill();
      }
    }

    // Swirling Cream Ribbons & Floating Ingredient Slices
    c.save();
    c.translate(0, s.mixMode === 'blender' ? -20 : 0);
    c.scale(1, 0.62);
    c.rotate(s.mixSwirlAngle);
    c.strokeStyle = 'rgba(255, 253, 249, 0.82)';
    c.lineWidth = 4.5;
    for (let r = 22; r <= 92; r += 23) {
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 1.35);
      c.stroke();
    }
    c.restore();
    s.mixItems.forEach((it, idx) => {
      const a = s.mixSwirlAngle * 1.1 + (idx * PI2) / Math.max(1, s.mixItems.length);
      const rad = (1 - s.mixProgress * 0.7) * 58;
      const scaleR = Math.max(10, 25 * (1 - s.mixProgress * 0.6)) * (it.scale || 1);
      const bob = Math.sin(t * 5 + idx) * 3;
      KitchenArt.drawIngredient(c, it.id, Math.cos(a) * rad, Math.sin(a) * rad * 0.55 + bob - (s.mixMode === 'blender' ? 20 : 0), scaleR, {
        sliced: true,
        shadow: false,
        rot: a * 0.5,
      });
    });

    // Balloon whisk orbiting the bowl, carried by the vortex
    if (s.mixMode === 'bowl') {
      drawWhiskSprite(c, Math.cos(s.whiskOrbit) * 52, -2 + Math.sin(s.whiskOrbit) * 26, 0.35 + Math.cos(s.whiskOrbit) * 0.22);
    }
  }

  function drawWhiskSprite(c, x, y, angle) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.strokeStyle = '#8C9BA5';
    c.lineWidth = 2.5;
    KitchenArt.ell(c, 0, -14, 15, 24);
    c.stroke();
    KitchenArt.ell(c, 0, -14, 7, 24);
    c.stroke();
    c.fillStyle = '#D48C56';
    c.strokeStyle = KitchenArt.OUTLINE;
    c.lineWidth = 3;
    KitchenArt.rr(c, -7, -86, 14, 56, 7);
    c.fill();
    c.stroke();
    c.restore();
  }

  /* ==========================================================================
   * Station 3: Enameled Cast-Iron Skillet & French Patisserie Oven
   * ========================================================================== */
  function renderCookStation(c) {
    const ctr = stationCenter(3);
    const cx = ctr.x, cy = ctr.y;

    drawCanvasIconCard(c, 36, cy - 58, 118, 44, cookMode === 'pan', 'pan');
    drawCanvasIconCard(c, 36, cy - 6, 118, 44, cookMode === 'oven', 'oven');

    if (cookMode === 'pan') {
      [1, 2, 3].forEach(lvl => {
        const active = heatLevel === lvl;
        const bx = 36 + (lvl - 1) * 40, by = cy + 46;
        KitchenArt.rr(c, bx, by, 36, 34, 12);
        c.fillStyle = active ? '#E8998D' : '#FFFDF9';
        c.fill();
        c.strokeStyle = active ? KitchenArt.OUTLINE : '#D9B89C';
        c.lineWidth = 2.2;
        c.stroke();
        c.fillStyle = active ? '#FFF29C' : '#F5A623';
        for (let k = 0; k < lvl; k++) {
          const fx = bx + 18 + (k - (lvl - 1) / 2) * 8;
          const flick = active ? Math.sin(t * 16 + k * 2) * 1.2 : 0;
          KitchenArt.circ(c, fx, by + 18 - flick, 4.5 + flick * 0.3);
          c.fill();
        }
      });
    }

    const shown = panItems.filter(isLanded);
    const pt = state.panToss;
    const rest = { dx: 0, dy: 0, rot: 0, flip: 0, sx: 1, sy: 1, shadow: 1 };
    const s = {
      station: 3,
      cookMode,
      heatLevel,
      panItems: shown.map(it => Object.assign({}, it, { scale: popScale(it) })),
      cookProgress,
      panToss: {
        active: pt.active,
        t: pt.t,
        duration: pt.duration,
        height: pt.height,
        spin: pt.spin,
        panDy: pt.panDy,
        panTilt: pt.panTilt,
        bodies: shown.map(it => (pt.active && pt.byItem && pt.byItem.get(it)) || rest),
        baseBody: pt.active && pt.baseBody ? pt.baseBody : rest,
      },
      ovenPulse: state.ovenPulse,
      batterTint: dish.liquidColor || mixColor || '#FFF3C4',
      boardSpring: state.boardSpring,
    };
    callArt('drawCookStation', [c, cx, cy, s, t], () => fallbackCookStation(c, cx, cy, s));

    // Right-Side Doneness Thermometer Card (100% Vector Icons)
    const rx = cx + 220, ry = cy - 48;
    KitchenArt.rr(c, rx, ry, 196, 86, 18);
    c.fillStyle = 'rgba(255, 253, 249, 0.95)';
    c.fill();
    c.strokeStyle = cookProgress > 1.08 ? '#E85D4A' : '#D9B89C';
    c.lineWidth = 2.8;
    c.stroke();

    KitchenArt.drawIcon(c, cookMode === 'oven' ? 'oven' : 'pan', rx + 70, ry + 24, 15, t);
    KitchenArt.drawIcon(c, 'star', rx + 124, ry + 24, 14, t);

    const barX = rx + 16, barY = ry + 48, barW = 164, barH = 14;
    const g = c.createLinearGradient(barX, 0, barX + barW, 0);
    g.addColorStop(0, '#FCE8A6');
    g.addColorStop(0.55, '#F5A623');
    g.addColorStop(0.82, '#78C47C');
    g.addColorStop(1, '#4A3228');
    KitchenArt.rr(c, barX, barY, barW, barH, 7);
    c.fillStyle = g;
    c.fill();
    const needleX = barX + Math.min(1, state.cookNeedleShown / 1.25) * barW;
    c.fillStyle = '#FFFDF9';
    c.strokeStyle = KitchenArt.OUTLINE;
    c.lineWidth = 2.5;
    KitchenArt.circ(c, needleX, barY + 7, 9);
    c.fill();
    c.stroke();
  }

  function fallbackCookStation(c, cx, cy, s) {
    if (s.cookMode === 'oven') {
      const pulse = 1 + s.ovenPulse * 0.06;
      c.fillStyle = '#F4D5B8';
      c.strokeStyle = KitchenArt.OUTLINE;
      c.lineWidth = 4;
      KitchenArt.rr(c, cx - 145, cy - 86, 290, 165, 26);
      c.fill();
      c.stroke();
      const glow = 0.5 + 0.5 * Math.sin(t * 4);
      c.fillStyle = KitchenArt.lerpColor('#FFE8A3', '#FFC870', glow * 0.6);
      KitchenArt.rr(c, cx - 112, cy - 60, 224, 112, 18);
      c.fill();
      c.stroke();
      const rise = (0.65 + Math.min(1, s.cookProgress / 0.75) * 0.45) * pulse;
      c.save();
      c.translate(cx, cy + 20);
      c.scale(rise * s.boardSpring.sx, rise * s.boardSpring.sy);
      c.fillStyle = KitchenArt.lerpColor(s.batterTint, '#E69849', Math.min(0.65, s.cookProgress / 0.85));
      c.strokeStyle = KitchenArt.OUTLINE;
      c.lineWidth = 3;
      KitchenArt.rr(c, -75, -42, 150, 56, 20);
      c.fill();
      c.stroke();
      c.restore();
      return;
    }

    const pt = s.panToss;
    // Cozy gas burner petals tucked under the skillet rim
    const cols = [['#BFE6F7', '#5DB4E0'], ['#FFE08A', '#F5A623'], ['#FFC09A', '#E85D4A']][s.heatLevel - 1] || ['#FFE08A', '#F5A623'];
    for (let k = 0; k < 13; k++) {
      const a = Math.PI * (0.08 + (0.84 * k) / 12);
      const fx = cx + Math.cos(a) * 118;
      const fy = cy + 18 + Math.sin(a) * 62;
      const fl = 12 + s.heatLevel * 5 + Math.sin(t * 17 + k * 1.9) * 3.5;
      c.fillStyle = cols[1];
      c.beginPath();
      c.moveTo(fx - 7, fy);
      c.quadraticCurveTo(fx - 6, fy + fl * 0.2, fx, fy + fl * 0.35);
      c.quadraticCurveTo(fx + 6, fy + fl * 0.2, fx + 7, fy);
      c.quadraticCurveTo(fx + 3, fy - fl * 0.7, fx, fy - fl);
      c.quadraticCurveTo(fx - 3, fy - fl * 0.7, fx - 7, fy);
      c.fill();
      c.fillStyle = cols[0];
      KitchenArt.ell(c, fx, fy - fl * 0.15, 3, fl * 0.35);
      c.fill();
    }

    c.save();
    // Wrist-flick pivot at the handle grip
    const gripX = cx + 190;
    c.translate(gripX, cy + pt.panDy);
    c.rotate(pt.panTilt);
    c.translate(-gripX, -cy);

    c.fillStyle = '#C87D4B';
    c.strokeStyle = KitchenArt.OUTLINE;
    c.lineWidth = 4;
    KitchenArt.rr(c, cx + 112, cy - 13, 98, 26, 12);
    c.fill();
    c.stroke();
    c.fillStyle = '#E07A5F';
    KitchenArt.ell(c, cx, cy, 140, 86);
    c.fill();
    c.stroke();
    c.fillStyle = '#4A403B';
    KitchenArt.ell(c, cx, cy, 122, 72);
    c.fill();
    c.fillStyle = 'rgba(255, 255, 255, 0.08)';
    KitchenArt.ell(c, cx - 30, cy - 22, 60, 22, -0.2);
    c.fill();

    const sp = s.boardSpring;
    // Drop shadows on the skillet surface shrink as food flies up
    const base = s.panItems.find(p => p.id === 'dough' || p.id === 'pizzabase');
    if (base) {
      const b = pt.baseBody;
      c.fillStyle = 'rgba(0, 0, 0, 0.22)';
      KitchenArt.ell(c, cx, cy + 6, 62 * b.shadow, 34 * b.shadow);
      c.fill();
      c.save();
      c.translate(cx + b.dx, cy + b.dy);
      const flipY = Math.cos(b.flip * PI2);
      c.scale(b.sx * sp.sx * (base.scale || 1), b.sy * sp.sy * (base.scale || 1) * (Math.abs(flipY) < 0.08 ? 0.08 * Math.sign(flipY || 1) : flipY));
      KitchenArt.drawIngredient(c, 'dough', 0, 0, 70, { cooked: s.cookProgress + (flipY < 0 ? 0.25 : 0) });
      c.restore();
    }
    s.panItems.forEach((p, i) => {
      if (p.id === 'dough' || p.id === 'pizzabase') return;
      const b = pt.bodies[i];
      if (b.dy < -2) {
        c.fillStyle = 'rgba(0, 0, 0, 0.2)';
        KitchenArt.ell(c, cx + p.x, cy + p.y + 8, 24 * b.shadow, 10 * b.shadow);
        c.fill();
      }
      KitchenArt.drawIngredient(c, p.id, cx + p.x + b.dx, cy + p.y + b.dy, 36, {
        sliced: p.sliced,
        cracked: p.cracked,
        cooked: s.cookProgress,
        rot: b.rot,
        scaleX: b.sx * sp.sx * (p.scale || 1),
        scaleY: b.sy * sp.sy * (p.scale || 1),
      });
    });

    // Wavy patisserie steam ribbons rising from skillet (part while food is airborne)
    const steamA = pt.active ? 0.58 * (1 - Math.sin(Math.PI * seg(pt.t, 0.1, 0.9))) : 0.58;
    c.strokeStyle = 'rgba(255, 253, 249, ' + steamA.toFixed(3) + ')';
    c.lineWidth = 3;
    for (let k = -1; k <= 1; k++) {
      const sx = cx + k * 46;
      const wave = Math.sin(t * 3 + k) * 8;
      c.beginPath();
      c.moveTo(sx, cy - 24);
      c.quadraticCurveTo(sx + wave, cy - 52, sx - wave, cy - 82);
      c.stroke();
    }
    c.restore();
  }

  /* ==========================================================================
   * Station 4: Scalloped Cake Stand & Pastry Piping Atelier
   * ========================================================================== */
  function renderDecorateStation(c) {
    const ctr = stationCenter(4);
    const cx = ctr.x, cy = ctr.y;
    drawCanvasIconCard(c, 36, cy - 42, 118, 46, dish.vessel === 'plate', 'plate');
    drawCanvasIconCard(c, 36, cy + 14, 118, 46, dish.vessel === 'cup', 'cup');

    let toolColor = '#F7C948';
    if (decorTool === 'piping') toolColor = (KitchenData.PIPING_COLORS[pipingColorIdx] || KitchenData.PIPING_COLORS[0]).color;
    else if (decorTool === 'sauce') toolColor = (KitchenData.SAUCES[sauceIdx] || KitchenData.SAUCES[0]).color;
    const pa = state.pipingAnim;
    const near = Math.hypot(hoverPt.x - cx, hoverPt.y - cy) < 165;
    const s = {
      station: 4,
      dish,
      decorTool,
      pipingAnim: {
        active: pa.active,
        t: pa.t,
        x: pa.x,
        y: pa.y,
        color: pa.color,
        kind: pa.kind,
        squeeze: pa.squeeze,
        shake: pa.shake,
      },
      toppingSprings: dish.toppings.map(tp => ({ y: tp.dropY || 0, scaleX: tp.sx || 1, scaleY: tp.sy || 1 })),
      hoverPt: { x: state.toolPos.x, y: state.toolPos.y },
      toolNear: near,
      toolTilt: state.toolTilt,
      toolColor,
      dishScale: 1.08,
      boardSpring: state.boardSpring,
    };
    callArt('drawDecorateStation', [c, cx, cy, s, t], () => fallbackDecorateStation(c, cx, cy, s));
  }

  function fallbackDecorateStation(c, cx, cy, s) {
    KitchenArt.drawDish(c, s.dish, cx, cy, 1.08 * s.boardSpring.sx, t);
    const pa = s.pipingAnim;
    if (s.toolNear || pa.active) {
      const tx = pa.active ? lerp(s.hoverPt.x, pa.x, 0.65) : s.hoverPt.x;
      const ty = pa.active ? lerp(s.hoverPt.y, pa.y, 0.65) : s.hoverPt.y;
      if (s.decorTool === 'topping') drawShakerSprite(c, tx, ty - 34, s.toolTilt + pa.shake + 0.5, s.toolColor);
      else drawPipingBagSprite(c, tx, ty - 6, s.toolTilt, pa.active ? pa.squeeze : 0, s.toolColor, s.decorTool === 'sauce');
    }
  }

  function drawPipingBagSprite(c, x, y, tilt, squeeze, color, isSauce) {
    c.save();
    c.translate(x, y);
    c.rotate(tilt * 0.6);
    c.scale(1 + squeeze * 0.14, 1 - squeeze * 0.1);
    c.strokeStyle = KitchenArt.OUTLINE;
    c.lineWidth = 2.6;
    if (isSauce) {
      c.fillStyle = color;
      KitchenArt.rr(c, -15, -70, 30, 56, 12);
      c.fill();
      c.stroke();
      c.fillStyle = '#FFFDF9';
      c.beginPath();
      c.moveTo(-8, -14);
      c.lineTo(8, -14);
      c.lineTo(2, 0);
      c.lineTo(-2, 0);
      c.closePath();
      c.fill();
      c.stroke();
    } else {
      c.fillStyle = '#FFFDF9';
      c.beginPath();
      c.moveTo(0, -6);
      c.quadraticCurveTo(-30, -48, -24, -74);
      c.quadraticCurveTo(0, -86, 24, -74);
      c.quadraticCurveTo(30, -48, 0, -6);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(0, -10);
      c.quadraticCurveTo(-20, -40, -17, -58);
      c.quadraticCurveTo(0, -64, 17, -58);
      c.quadraticCurveTo(20, -40, 0, -10);
      c.closePath();
      c.fill();
      c.fillStyle = '#C5D3DC';
      c.beginPath();
      c.moveTo(-6, -8);
      c.lineTo(6, -8);
      c.lineTo(3, 2);
      c.lineTo(-3, 2);
      c.closePath();
      c.fill();
      c.stroke();
    }
    c.restore();
  }

  function drawShakerSprite(c, x, y, tilt, color) {
    c.save();
    c.translate(x, y);
    c.rotate(tilt);
    c.strokeStyle = KitchenArt.OUTLINE;
    c.lineWidth = 2.6;
    c.fillStyle = 'rgba(235, 248, 252, 0.92)';
    KitchenArt.rr(c, -16, -20, 32, 44, 9);
    c.fill();
    c.stroke();
    c.fillStyle = color;
    KitchenArt.rr(c, -12, 0, 24, 20, 6);
    c.fill();
    c.fillStyle = '#E8998D';
    KitchenArt.rr(c, -18, 20, 36, 12, 5);
    c.fill();
    c.stroke();
    c.fillStyle = KitchenArt.OUTLINE;
    for (let i = -1; i <= 1; i++) {
      KitchenArt.circ(c, i * 8, 27, 1.6);
      c.fill();
    }
    c.restore();
  }

  /* ==========================================================================
   * Station 5: Silver Spoon Feeding (3-Phase Scoop -> Fly -> Chomp)
   * ========================================================================== */
  function dishView() {
    return Object.assign({}, dish, { bitesTaken: state.scoopsShown });
  }

  function renderFeedStation(c) {
    const ctr = stationCenter(5);
    const cx = ctr.x, cy = ctr.y;
    const fs = state.flyingSpoon;
    const m = mouthPoint();
    const off = layerOffset(5) || 0;
    const s = {
      station: 5,
      dish: dishView(),
      fork: { x: fs.x, y: fs.y, dragging: fork.dragging, homeX: fork.homeX, homeY: fork.homeY },
      flyingSpoon: {
        active: fs.active,
        t: fs.t,
        phase: fs.phase,
        x: fs.x,
        y: fs.y,
        angle: fs.angle,
        squash: fs.squash,
        scale: fs.scale,
        loaded: fs.loaded,
        ingId: fs.ingId,
        color: fs.color,
        startX: fs.startX,
        startY: fs.startY,
        ctrlX: fs.ctrlX,
        ctrlY: fs.ctrlY,
        endX: fs.endX,
        endY: fs.endY,
      },
      mouth: { x: m.x - off, y: m.y },
      // Explicit progress: dish.bitesTaken already counts the scooped portion.
      scoopProgress: state.scoopProgress,
      dishScale: 1.05,
      boardSpring: state.boardSpring,
    };
    callArt('drawFeedStation', [c, cx, cy, s, t], () => fallbackFeedStation(c, cx, cy, s));

    // Marching dotted hint from the spoon to the Critter's mouth
    if (state.bitesEaten === 0 && !fs.active && !fork.dragging && dish.bitesTaken === 0) {
      c.save();
      c.strokeStyle = 'rgba(232, 131, 136, 0.65)';
      c.lineWidth = 3.5;
      c.lineCap = 'round';
      c.setLineDash([8, 9]);
      c.lineDashOffset = -state.guideDash;
      c.beginPath();
      c.moveTo(fs.x - 10, fs.y - 26);
      c.quadraticCurveTo(W * 0.6, H * 0.42, m.x - off + 14, m.y + 22);
      c.stroke();
      c.restore();
    }
  }

  function fallbackFeedStation(c, cx, cy, s) {
    KitchenArt.drawDish(c, s.dish, cx, cy, 1.05 * s.boardSpring.sx, t);
    const fs = s.flyingSpoon;
    drawSpoonSprite(c, fs.x, fs.y, fs.angle, fs.scale, fs.squash, fs.loaded, fs.ingId);
  }

  function drawSpoonSprite(c, x, y, angle, scale, squash, loaded, ingId) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.scale((scale || 1) * (2 - (squash || 1)), (scale || 1) * (squash || 1));
    c.strokeStyle = KitchenArt.OUTLINE;
    c.lineWidth = 2.8;
    c.fillStyle = '#DCE4E8';
    KitchenArt.rr(c, -6, 15, 12, 66, 6);
    c.fill();
    c.stroke();
    const g = c.createRadialGradient(-5, -6, 2, 0, 0, 22);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(1, '#C9D5DC');
    c.fillStyle = g;
    KitchenArt.ell(c, 0, 0, 17, 21);
    c.fill();
    c.stroke();
    c.fillStyle = 'rgba(255, 255, 255, 0.75)';
    KitchenArt.ell(c, -6, -7, 3.5, 6.5, -0.3);
    c.fill();
    if (loaded) {
      c.rotate(-angle * 0.7);
      KitchenArt.drawIngredient(c, ingId, 0, -3, 15, { sliced: true, cooked: 0.72, shadow: false });
    }
    c.restore();
  }

  function drawCanvasIconCard(c, x, y, w, h, active, iconKind) {
    c.save();
    KitchenArt.rr(c, x, y, w, h, 16);
    c.fillStyle = active ? '#E8998D' : '#FFFDF9';
    c.fill();
    c.strokeStyle = active ? KitchenArt.OUTLINE : '#D9B89C';
    c.lineWidth = 2.8;
    c.stroke();
    KitchenArt.drawIcon(c, iconKind, x + w / 2, y + h / 2, 18, t);
    c.restore();
  }

  /* ==========================================================================
   * Pointer / Touch Gesture Handling on Canvas
   * ========================================================================== */
  let pointerDown = false;
  let lastPt = null;
  let lastChopTime = -1;
  let lastBowlAngle = 0;
  let lastBowlTs = 0;

  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function nowMs() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  function onPointerDown(e) {
    sfx('ensure');
    const pt = canvasCoords(e);
    pointerDown = true;
    lastPt = pt;
    hoverPt = pt;
    state.pointer = { x: pt.x, y: pt.y };
    const cx = W * 0.46, cy = H * 0.68;
    const ca = critterAnchor();

    if (Math.hypot(pt.x - ca.x, pt.y - ca.y) < 75 && station !== 5) {
      sfx('critterChime', critterIdx);
      heartBurst(ca.x, ca.y - 30, 8, 0);
      state.wave = 1;
      return;
    }

    if (station === 1) {
      if (Math.hypot(pt.x - cx, pt.y - cy) < 175) {
        lastChopTime = t;
        slashTrail = [{ x: pt.x, y: pt.y, t }];
        chopBoardItem();
      }
    } else if (station === 2) {
      if (pt.x >= 32 && pt.x <= 160) {
        if (pt.y >= cy - 58 && pt.y <= cy) { mixMode = 'bowl'; dish.vessel = 'plate'; squashImpulse(1.1, 0.9); renderPrimaryActionButton(); return; }
        if (pt.y >= cy + 4 && pt.y <= cy + 62) { mixMode = 'blender'; dish.vessel = 'cup'; squashImpulse(1.1, 0.9); renderPrimaryActionButton(); return; }
      }
      if (Math.hypot(pt.x - cx, pt.y - cy) < 160) {
        state.whiskHeld = true;
        state.whiskTarget = bowlAngle(pt);
        lastBowlAngle = state.whiskTarget;
        lastBowlTs = nowMs();
        stirMixer(0.2);
      }
    } else if (station === 3) {
      if (pt.x >= 32 && pt.x <= 170) {
        if (pt.y >= cy - 62 && pt.y <= cy - 10) { cookMode = 'pan'; squashImpulse(1.1, 0.9); renderPrimaryActionButton(); return; }
        if (pt.y >= cy - 8 && pt.y <= cy + 42) { cookMode = 'oven'; squashImpulse(1.1, 0.9); renderPrimaryActionButton(); return; }
        if (cookMode === 'pan' && pt.y >= cy + 44 && pt.y <= cy + 86) {
          const idx = Math.floor((pt.x - 36) / 40) + 1;
          if (idx >= 1 && idx <= 3) { heatLevel = idx; sfx('sizzleTick', heatLevel); return; }
        }
      }
      if (Math.hypot(pt.x - cx, pt.y - cy) < 190) {
        flipPan();
      }
    } else if (station === 4) {
      if (pt.x >= 32 && pt.x <= 160) {
        if (pt.y >= cy - 44 && pt.y <= cy + 8) { dish.vessel = 'plate'; squashImpulse(1.12, 0.9); return; }
        if (pt.y >= cy + 12 && pt.y <= cy + 64) { dish.vessel = 'cup'; squashImpulse(1.12, 0.9); return; }
      }
      const lx = (pt.x - cx) / 1.08;
      const ly = (pt.y - cy) / 1.08;
      for (const tp of dish.toppings) {
        if (tp.id === 'candle' && !tp.blownOut && Math.hypot(tp.x - lx, tp.y - (ly + 24)) < 32) {
          tp.blownOut = true;
          sfx('blowCandle');
          const c4 = stationCenter(4);
          steamPuff(c4.x + tp.x * 1.08, c4.y + (tp.y - 32) * 1.08, 6, 4, false);
          return;
        }
      }
      if (Math.hypot(lx, ly) < 130) {
        if (decorTool === 'piping') {
          addPipingPoint(lx, ly);
        } else if (decorTool === 'sauce') {
          const sMeta = KitchenData.SAUCES[sauceIdx] || KitchenData.SAUCES[0];
          activeStroke = { color: sMeta.color, hi: sMeta.hi, pts: [{ x: lx, y: ly }] };
          dish.sauces.push(activeStroke);
          sfx('pour');
          startPipingAnim('sauce', lx, ly, sMeta.color);
        } else if (decorTool === 'topping') {
          addToppingAt(lx, ly);
        }
      }
    } else if (station === 5) {
      spoonGrab = { x: pt.x, y: pt.y, startedDrag: false };
    }
  }

  function onPointerMove(e) {
    const pt = canvasCoords(e);
    hoverPt = pt;
    state.pointer = { x: pt.x, y: pt.y };
    const cx = W * 0.46, cy = H * 0.68;

    if (!pointerDown) return;

    if (station === 1 && lastPt) {
      slashTrail.push({ x: pt.x, y: pt.y, t });
      if (t - lastChopTime > 0.16 && Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) > 48 && Math.hypot(pt.x - cx, pt.y - cy) < 160) {
        lastPt = pt;
        lastChopTime = t;
        chopBoardItem();
      }
    } else if (station === 2 && lastPt) {
      if (state.whiskHeld) {
        const a = bowlAngle(pt);
        const now = nowMs();
        const dts = Math.max(1 / 240, (now - lastBowlTs) / 1000);
        const omega = wrapAngle(a - lastBowlAngle) / dts;
        state.mixVelocity = lerp(state.mixVelocity, clamp(omega, -18, 18), 0.4);
        state.whiskTarget = a;
        lastBowlAngle = a;
        lastBowlTs = now;
      }
      if (Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) > 26 && Math.hypot(pt.x - cx, pt.y - cy) < 155) {
        lastPt = pt;
        stirMixer(0.08, state.whiskHeld);
      }
    } else if (station === 4) {
      const lx = (pt.x - cx) / 1.08;
      const ly = (pt.y - cy) / 1.08;
      if (Math.hypot(lx, ly) < 125) {
        if (decorTool === 'piping') {
          addPipingPoint(lx, ly);
        } else if (decorTool === 'sauce' && activeStroke) {
          const prev = activeStroke.pts[activeStroke.pts.length - 1];
          if (!prev || Math.hypot(prev.x - lx, prev.y - ly) > 8) {
            activeStroke.pts.push({ x: lx, y: ly });
            if (Math.random() < 0.3) {
              spawnParticle({
                x: pt.x, y: pt.y, vx: rand(-30, 30), vy: rand(-60, -10), g: 700, drag: 1,
                r: rand(2.5, 4), color: activeStroke.color, kind: 'droplet', life: 0.45, layer: 4,
              });
            }
          }
        }
      }
    } else if (station === 5 && spoonGrab) {
      if (!spoonGrab.startedDrag && !fork.dragging && Math.hypot(pt.x - spoonGrab.x, pt.y - spoonGrab.y) > 14) {
        startSpoonDrag(pt);
      }
      if (fork.dragging) {
        fork.x = pt.x;
        fork.y = pt.y;
      }
    }
  }

  function onPointerUp() {
    pointerDown = false;
    activeStroke = null;
    state.whiskHeld = false;
    if (station === 5 && spoonGrab) {
      const grab = spoonGrab;
      if (fork.dragging) {
        if (state.flyingSpoon.loaded && fork.y < H * 0.45) deliverByDrag();
        else cancelSpoonDrag();
      } else if (!grab.startedDrag) {
        feedBite({ fromUser: true });
      }
      spoonGrab = null;
    }
  }

  /* ==========================================================================
   * Custom-Illustrated DOM Controls (Zero System Emojis, Zero Text!)
   * ========================================================================== */
  function paintIconCanvas(cv, iconKind) {
    if (!cv) return;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.save();
    c.scale(2, 2);
    KitchenArt.drawIcon(c, iconKind, cv.width / 4, cv.height / 4, Math.min(cv.width, cv.height) / 4 - 2, 0);
    c.restore();
  }

  function renderHeaderIcons() {
    // Brand badge: Custom pan + cupcake illustration
    const brandWrap = document.getElementById('brandBadge');
    if (brandWrap) {
      brandWrap.innerHTML = '<canvas width="144" height="80"></canvas>';
      const bcv = brandWrap.querySelector('canvas');
      const bc = bcv.getContext('2d');
      bc.scale(2, 2);
      KitchenArt.drawIcon(bc, 'pan', 20, 20, 16, 0);
      KitchenArt.drawIcon(bc, 'cupcake', 52, 20, 16, 0);
    }
    paintIconCanvas(document.getElementById('starIconCv'), 'star');
    paintIconCanvas(document.getElementById('albumIconCv'), 'camera');
    paintIconCanvas(document.getElementById('modeIconCv'), mode === 'wish' ? 'wish' : 'free');
    paintIconCanvas(document.getElementById('refreshIconCv'), 'refresh');
    paintIconCanvas(document.getElementById('soundIconCv'), KitchenAudio.isMuted() ? 'sound_off' : 'sound_on');
    paintIconCanvas(document.getElementById('modalHeaderCv'), 'camera');
    paintIconCanvas(document.getElementById('closeModalCv'), 'refresh');
  }

  function renderStationDockIcons() {
    const map = { 1: 'knife', 2: 'bowl', 3: 'pan', 4: 'cupcake', 5: 'plate' };
    document.querySelectorAll('.station-btn').forEach(btn => {
      const st = Number(btn.dataset.station);
      const cv = btn.querySelector('canvas');
      if (cv) {
        const c = cv.getContext('2d');
        c.clearRect(0, 0, cv.width, cv.height);
        c.save();
        c.scale(2, 2);
        KitchenArt.drawIcon(c, map[st] || 'knife', 22, 16, 14, 0);
        c.restore();
      }
    });
  }

  function renderCustomerBar() {
    const wrap = document.getElementById('customerStrip');
    if (!wrap) return;
    wrap.innerHTML = '';
    KitchenData.CRITTERS.forEach((c, idx) => {
      const btn = document.createElement('button');
      btn.className = 'critter-chip' + (idx === critterIdx ? ' active' : '');
      btn.innerHTML = `<img src="icons/${c.icon}.jpg" alt="">`;
      btn.onclick = () => {
        critterIdx = idx;
        sfx('critterChime', idx);
        state.wave = 1;
        renderCustomerBar();
      };
      wrap.appendChild(btn);
    });
  }

  function renderCategoryTabs() {
    const tabWrap = document.getElementById('catTabs');
    if (!tabWrap) return;
    tabWrap.innerHTML = '';
    const sampleItems = {
      fruit:  ['strawberry', 'banana', 'peach'],
      meat:   ['egg', 'steak', 'cheese'],
      veggie: ['dough', 'pizzabase', 'tomato'],
      magic:  ['milk', 'chocolate', 'icecream'],
    };
    KitchenData.CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-tab' + (cat.id === activeCategory ? ' active' : '');
      const cv = document.createElement('canvas');
      cv.width = 144;
      cv.height = 60;
      const icx = cv.getContext('2d');
      icx.scale(2, 2);
      const trio = sampleItems[cat.id] || ['strawberry', 'banana', 'peach'];
      trio.forEach((id, i) => {
        KitchenArt.drawIngredient(icx, id, 16 + i * 20, 15, 10, { sliced: false, shadow: false });
      });
      btn.appendChild(cv);
      btn.onclick = () => {
        activeCategory = cat.id;
        sfx('popSelect', 1);
        renderCategoryTabs();
        renderIngredientShelf();
      };
      tabWrap.appendChild(btn);
    });
  }

  function renderIngredientShelf() {
    const shelf = document.getElementById('ingredientShelf');
    if (!shelf) return;
    shelf.innerHTML = '';
    KitchenData.INGREDIENTS.filter(i => i.cat === activeCategory).forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'ing-card';
      btn.dataset.ing = item.id;
      const cv = document.createElement('canvas');
      cv.width = 96;
      cv.height = 84;
      cv.style.width = '48px';
      cv.style.height = '42px';
      const icx = cv.getContext('2d');
      icx.scale(2, 2);
      KitchenArt.drawIngredient(icx, item.id, 24, 21, 18, { sliced: false, shadow: false });
      btn.appendChild(cv);
      btn.onclick = () => selectIngredient(item.id);
      shelf.appendChild(btn);
    });
  }

  function renderPrepTrayUI() {
    const tray = document.getElementById('prepTrayStrip');
    if (!tray) return;
    tray.innerHTML = '';
    const basketCv = document.createElement('canvas');
    basketCv.width = 60;
    basketCv.height = 60;
    paintIconCanvas(basketCv, 'basket');
    tray.appendChild(basketCv);

    const visible = prepTray.slice(0, Math.max(0, prepTray.length - trayHidden));
    visible.slice(-6).forEach(p => {
      const cv = document.createElement('canvas');
      cv.width = 56;
      cv.height = 56;
      const c = cv.getContext('2d');
      c.scale(2, 2);
      KitchenArt.drawIngredient(c, p.id, 14, 14, 11, { sliced: p.sliced, shadow: false });
      tray.appendChild(cv);
    });
  }

  function renderDecorToolbar() {
    const bar = document.getElementById('decorToolbar');
    if (!bar) return;
    bar.innerHTML = '';

    const tools = [
      { id: 'piping',  icon: 'cupcake' },
      { id: 'sauce',   icon: 'sauce' },
      { id: 'topping', icon: 'topping' },
    ];
    const modeRow = document.createElement('div');
    modeRow.className = 'decor-modes';
    tools.forEach(tl => {
      const b = document.createElement('button');
      b.className = 'decor-mode-btn' + (decorTool === tl.id ? ' active' : '');
      const cv = document.createElement('canvas');
      cv.width = 96;
      cv.height = 56;
      paintIconCanvas(cv, tl.icon);
      b.appendChild(cv);
      b.onclick = () => {
        decorTool = tl.id;
        sfx('popSelect', 2);
        renderDecorToolbar();
      };
      modeRow.appendChild(b);
    });
    bar.appendChild(modeRow);

    const optRow = document.createElement('div');
    optRow.className = 'decor-options';
    if (decorTool === 'piping') {
      KitchenData.PIPING_COLORS.forEach((p, idx) => {
        const b = document.createElement('button');
        b.className = 'swatch-btn' + (pipingColorIdx === idx ? ' active' : '');
        const cv = document.createElement('canvas');
        cv.width = 68;
        cv.height = 60;
        const c = cv.getContext('2d');
        c.scale(2, 2);
        c.fillStyle = p.color;
        c.strokeStyle = KitchenArt.OUTLINE;
        c.lineWidth = 2;
        KitchenArt.circ(c, 17, 15, 11);
        c.fill();
        c.stroke();
        b.appendChild(cv);
        b.onclick = () => { pipingColorIdx = idx; sfx('popSelect', idx); renderDecorToolbar(); };
        optRow.appendChild(b);
      });
    } else if (decorTool === 'sauce') {
      KitchenData.SAUCES.forEach((s, idx) => {
        const b = document.createElement('button');
        b.className = 'swatch-btn' + (sauceIdx === idx ? ' active' : '');
        const cv = document.createElement('canvas');
        cv.width = 68;
        cv.height = 60;
        const c = cv.getContext('2d');
        c.scale(2, 2);
        c.fillStyle = s.color;
        c.strokeStyle = KitchenArt.OUTLINE;
        c.lineWidth = 2;
        KitchenArt.heart(c, 17, 15, 11);
        c.fill();
        c.stroke();
        b.appendChild(cv);
        b.onclick = () => { sauceIdx = idx; sfx('popSelect', idx); renderDecorToolbar(); };
        optRow.appendChild(b);
      });
    } else {
      KitchenData.TOPPINGS.forEach((tp, idx) => {
        const b = document.createElement('button');
        b.className = 'swatch-btn' + (toppingIdx === idx ? ' active' : '');
        const cv = document.createElement('canvas');
        cv.width = 68;
        cv.height = 60;
        const c = cv.getContext('2d');
        c.scale(2, 2);
        if (tp.id === 'candle') KitchenArt.drawIcon(c, 'topping', 17, 15, 12, 0);
        else if (tp.id === 'stars') KitchenArt.drawIcon(c, 'star', 17, 15, 12, 0);
        else KitchenArt.drawIcon(c, 'cupcake', 17, 15, 12, 0);
        b.appendChild(cv);
        b.onclick = () => { toppingIdx = idx; sfx('popSelect', idx); renderDecorToolbar(); };
        optRow.appendChild(b);
      });
    }
    bar.appendChild(optRow);
  }

  function openAlbumModal() {
    const modal = document.getElementById('albumModal');
    const grid = document.getElementById('albumGrid');
    if (!modal || !grid) return;
    grid.innerHTML = '';
    if (album.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'album-empty';
      const cv = document.createElement('canvas');
      cv.width = 160;
      cv.height = 100;
      paintIconCanvas(cv, 'camera');
      emptyDiv.appendChild(cv);
      grid.appendChild(emptyDiv);
    } else {
      album.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'album-card';
        const img = document.createElement('img');
        img.src = entry.dataUrl;
        img.className = 'album-photo';
        card.appendChild(img);

        const meta = document.createElement('div');
        meta.className = 'album-meta';
        const cImg = document.createElement('img');
        cImg.src = `icons/${entry.critterIcon || 'bobby'}.jpg`;
        cImg.className = 'album-critter-icon';
        meta.appendChild(cImg);

        const starCv = document.createElement('canvas');
        starCv.width = 120;
        starCv.height = 44;
        starCv.style.width = '60px';
        starCv.style.height = '22px';
        const sc = starCv.getContext('2d');
        sc.scale(2, 2);
        for (let i = 0; i < (entry.stars || 3); i++) {
          KitchenArt.drawIcon(sc, 'star', 12 + i * 18, 11, 8, 0);
        }
        meta.appendChild(starCv);
        card.appendChild(meta);
        grid.appendChild(card);
      });
    }
    modal.classList.remove('hidden');
  }

  function onPrimaryActionClick() {
    sfx('ensure');
    if (station === 1) {
      if (boardItem) chopBoardItem();
      else if (prepTray.length > 0) {
        // Let the fresh slices finish hopping into the basket first
        if (state.t - lastFinishT < 0.55) return;
        setStation(2);
      } else chopBoardItem();
    } else if (station === 2) {
      if (mixProgress < 1) stirMixer(0.35);
      else setStation(3);
    } else if (station === 3) {
      if (cookProgress >= 0.65) {
        finishPanTossNow();
        setStation(4);
      } else flipPan();
    } else if (station === 4) {
      if (dish.piping.length === 0 && dish.toppings.length === 0) {
        let i = 0;
        for (let a = 0; a < PI2; a += PI2 / 8) {
          addPipingPoint(Math.cos(a) * 52, Math.sin(a) * 34 - 16, i * 0.06);
          i++;
        }
        addToppingAt(0, -24, 0.45);
      }
      setStation(5);
    } else if (station === 5) {
      if (dish.bitesTaken >= 3) {
        // Let the spoon land and the celebration dance play before a new dish
        if (feedingBusy() || state.pendingReaction || state.celebrateTimer > 1.6) return;
        resetKitchenForNewDish(true);
      } else {
        feedBite({ fromUser: true });
      }
    }
  }

  function resize() {
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(640, Math.round(rect.width));
    H = Math.max(340, Math.round(rect.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    fork.homeX = W * 0.68;
    fork.homeY = H * 0.66;
    if (!fork.dragging) {
      fork.x = fork.homeX;
      fork.y = fork.homeY;
    }
  }

  function init() {
    canvas = document.getElementById('kitchenCanvas');
    ctx = canvas.getContext('2d');
    loadStorage();
    KitchenArt.loadPortraits();

    window.addEventListener('resize', resize);
    resize();
    state.flyingSpoon.x = fork.homeX;
    state.flyingSpoon.y = fork.homeY;
    state.toolPos.x = hoverPt.x;
    state.toolPos.y = hoverPt.y;
    const ks = state.knifeSlash;
    ks.pose = knifeRestPose(W * 0.46, H * 0.68);

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    document.querySelectorAll('.station-btn').forEach(btn => {
      btn.addEventListener('click', () => setStation(Number(btn.dataset.station)));
    });

    const pBtn = document.getElementById('primaryActionBtn');
    if (pBtn) pBtn.addEventListener('click', onPrimaryActionClick);

    const modeBtn = document.getElementById('modeToggleBtn');
    if (modeBtn) {
      modeBtn.addEventListener('click', () => {
        mode = mode === 'wish' ? 'free' : 'wish';
        sfx('popSelect', 3);
        renderHeaderIcons();
      });
    }

    const newBtn = document.getElementById('newDishBtn');
    if (newBtn) {
      newBtn.addEventListener('click', () => resetKitchenForNewDish(true));
    }

    const albumBtn = document.getElementById('openAlbumBtn');
    if (albumBtn) albumBtn.addEventListener('click', openAlbumModal);
    const closeAlbum = document.getElementById('closeAlbumBtn');
    if (closeAlbum) {
      closeAlbum.addEventListener('click', () => {
        document.getElementById('albumModal').classList.add('hidden');
      });
    }

    const muteBtn = document.getElementById('muteToggleBtn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const m = !KitchenAudio.isMuted();
        KitchenAudio.setMuted(m);
        renderHeaderIcons();
      });
    }

    renderHeaderIcons();
    renderStationDockIcons();
    renderCustomerBar();
    renderCategoryTabs();
    renderIngredientShelf();
    renderPrepTrayUI();
    renderDecorToolbar();
    setStation(1);

    requestAnimationFrame(render);
  }

  // Deterministic stepping for headless screenshots: advance(seconds)
  function advance(seconds) {
    let left = Math.max(0, Number(seconds) || 0);
    const saved = timeScale;
    timeScale = 1;
    while (left > 1e-6) {
      const step = Math.min(1 / 60, left);
      tick(step);
      left -= step;
    }
    timeScale = saved;
    if (ctx) draw();
    return state.t;
  }

  function getAnimState() {
    const ks = state.knifeSlash, pt = state.panToss, fs = state.flyingSpoon, tr = state.stationTransition;
    return {
      t: state.t,
      timeScale,
      station,
      transition: { active: tr.active, from: tr.from, to: tr.to, offset: state.stationSlideOffset, vel: state.stationSlideVel },
      knifeSlash: { active: ks.active, t: ks.t, sliceIndex: ks.sliceIndex, cutX: ks.cutX, cutY: ks.cutY, pose: Object.assign({}, ks.pose) },
      boardChopsShown: state.boardView ? state.boardView.chops : null,
      sliceSepProgress: state.sliceSepProgress,
      boardRecoil: state.boardRecoil,
      mixVelocity: state.mixVelocity,
      whiskOrbit: state.whiskOrbit,
      bowlTilt: state.bowlTilt,
      mixSwirlAngle: state.mixSwirlAngle,
      panToss: { active: pt.active, t: pt.t, height: pt.height, panDy: pt.panDy, panTilt: pt.panTilt, bodies: pt.plan.length },
      pipingAnim: { active: state.pipingAnim.active, t: state.pipingAnim.t, kind: state.pipingAnim.kind },
      toppingSprings: state.toppingSprings.length,
      flyingSpoon: { active: fs.active, t: fs.t, phase: fs.phase, x: fs.x, y: fs.y, angle: fs.angle, loaded: fs.loaded, endX: fs.endX, endY: fs.endY },
      spoonQueue: spoonQueue.length,
      mouthOpen: state.mouthOpen,
      chewTimer: state.chewTimer,
      reaction: state.reaction,
      reactionTimer: state.reactionTimer,
      celebrate: state.celebrate,
      scoopsShown: state.scoopsShown,
      bitesEaten: state.bitesEaten,
      particles: state.particles.length,
      confetti: state.confetti.length,
      flyers: state.flyers.length,
      hopSlices: state.hopSlices.length,
      artErrors: Object.assign({}, artErrors),
    };
  }

  return {
    init,
    setStation,
    selectIngredient,
    chopBoardItem,
    stirMixer,
    flipPan,
    feedBite,
    feedOneBite,
    resetKitchenForNewDish,
    openAlbumModal,
    tick,
    advance,
    setTimeScale: s => {
      timeScale = clamp(Number(s) || 0, 0, 4);
      return timeScale;
    },
    getAnimState,
    getState: () => ({
      mode,
      station,
      critter: currentCritter().id,
      order: currentOrder().id,
      prepCount: prepTray.length,
      mixProgress,
      cookProgress,
      dishItems: dish.items.length,
      pipingCount: dish.piping.length,
      toppingsCount: dish.toppings.length,
      bitesTaken: dish.bitesTaken,
      bitesEaten: state.bitesEaten,
      reaction: state.reaction || lastReaction,
      serveSuccess,
      servedCount,
      starsEarned,
      albumCount: album.length,
    }),
  };
})();

window.KitchenGame = KitchenGame; // expose for headless playtest scripts
window.addEventListener('DOMContentLoaded', () => KitchenGame.init());
