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
  let critterIdx = 0; // Start with CraftyCorn
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
  let cookMode = 'oven'; // 'pan' | 'oven'
  let heatLevel = 2;    // 1:Low, 2:Med, 3:High
  let panItems = [];
  let cookProgress = 0;
  let sizzleTimer = 0;

  // Station 4 & 5: Plated Dish State
  let dish = createFreshDish();
  let decorTool = 'piping'; // 'piping' | 'sauce' | 'topping'
  let pipingColorIdx = 6;   // white cloud cream until the ingredients pick a theme
  let sauceIdx = 0;
  let toppingIdx = 0;
  // The player's explicit swatch/tool choices win over the ingredient theme.
  let pipingColorChosen = false;
  let sauceChosen = false;
  let toppingChosen = false;
  let decorToolChosen = false;
  let pipelineUid = 0;      // ids for prep entries flowing tray -> bowl -> pan
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
    mixAngle: 0,
    whiskOrbit: -0.7,
    whiskHeld: false,
    whiskTarget: 0,
    bowlTilt: 0,
    bowlTiltVel: 0,
    mixBarShown: 0,
    // Station 3: chef pan toss / HT mini oven
    panToss: {
      active: false, t: 0, duration: 0.95, height: 0, spin: 1,
      panDy: 0, panTilt: 0, bodies: [], baseBody: null, plan: [],
    },
    panCatch: 0,
    panCatchVel: 0,
    ovenPulse: 0,
    ovenPulseVel: 0,
    cookNeedleShown: 0,
    // Station 4: HT Mini Cakes spinning turntable & decorating
    turntableAngle: 0,
    turntableVel: 0,
    cakeStyle: null, // null | 'candy_balls' | 'rainbow_rosettes' — a tool hint, never a pre-built cake
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

  // A brand-new dish knows NOTHING: no style, no colours, no decorations.
  // Every colour below is filled in from the ingredients the player really
  // used (refreshDishPalette) and every decoration from the player's taps.
  function createFreshDish() {
    return {
      vessel: 'plate',
      baseKind: 'plate',     // 'cake' | 'pancake' | 'jelly' | 'burger' | 'pizza' | 'cup' | 'sundae' | 'plate'
      bakedCake: false,      // true only after the oven really ran
      liquidColor: null,
      items: [],
      layerColors: [],       // sponge colours from the actual ingredients
      batterTint: null,      // blended batter colour of the actual ingredients
      frostingColor: null,   // cream of the actual ingredients, or the glaze the player poured
      frostingHi: null,
      glazeChosen: false,
      glazeProgress: 0,
      hasChocolate: false,
      hasRainbow: false,
      themeId: null,
      piping: [],
      sauces: [],
      toppings: [],
      candyBalls: [],
      candyBallCount: 0,
      rosettes: [],
      rosetteCount: 0,
      cakeStyle: null,
      turntableAngle: 0,
      bitesTaken: 0,
    };
  }

  /* ==========================================================================
   * Ingredient Causality: prepTray -> mixItems -> panItems -> dish.items
   * The dish palette is ALWAYS recomputed from dish.items (what the player
   * actually chopped / poured / cooked). Nothing is ever injected silently.
   * ========================================================================== */
  function dishIngredientIds() {
    return dish.items.map(it => it.id);
  }

  // Ids the kitchen falls back to when the player skipped every prep step:
  // the critter's real order (free play: a strawberry shortcake). Never cocoa
  // unless the order itself asks for it.
  function defaultRecipeIds() {
    if (mode === 'wish') return currentOrder().wantIds.slice();
    return ['strawberry', 'dough', 'milk'];
  }

  function computeBaseKind() {
    const ids = dishIngredientIds();
    if (dish.vessel === 'cup') return 'cup';
    if (ids.includes('bun')) return 'burger';
    if (ids.includes('pizzabase')) return 'pizza';
    if (dish.bakedCake) return 'cake';
    const maxCooked = Math.max(0, ...dish.items.map(it => it.cooked || 0));
    const cookedSomething = maxCooked > 0.3;
    if (cookedSomething && ids.includes('dough')) return 'pancake';
    if (cookedSomething && ids.length && ids.every(id => KitchenData.getIngredient(id).cat === 'fruit' || id === 'honey' || id === 'milk')) return 'jelly';
    if (ids.includes('icecream')) return 'sundae';
    return 'plate';
  }

  function refreshDishPalette() {
    const pal = KitchenData.paletteFor(dishIngredientIds());
    dish.layerColors = pal.layerColors.slice();
    dish.batterTint = pal.batterTint;
    dish.hasChocolate = pal.hasChocolate;
    dish.hasRainbow = pal.hasRainbow;
    dish.themeId = pal.themeId;
    if (!dish.glazeChosen) {
      dish.frostingColor = pal.frostingColor;
      dish.frostingHi = KitchenData.mixHex(pal.frostingColor, '#FFFFFF', 0.45);
    }
    dish.liquidColor = KitchenData.mixHex(pal.batterTint, '#FFFFFF', 0.12);
    dish.baseKind = computeBaseKind();
    dish.candyBallCount = dish.candyBalls.length;
    dish.rosetteCount = dish.rosettes.length;
    return pal;
  }

  function decorCount() {
    return dish.candyBalls.length + dish.rosettes.length + dish.piping.length + dish.toppings.length + dish.sauces.length;
  }

  // Shared 3D cake-cylinder coordinates (see KitchenData.CAKE_GEOM):
  //   side wall: screen x = R * sin(theta + turntableAngle), visible when cos(.) > 0
  //   top face : screen (R*rad*cos(theta+a), topY + topRy*rad*sin(theta+a))
  function cylinderCoords(lx, ly) {
    const G = KitchenData.CAKE_GEOM;
    const a = state.turntableAngle;
    const nx = lx / G.radius;
    const ny = (ly - G.topY) / G.topRy;
    if (nx * nx + ny * ny <= 1) {
      return { face: 'top', theta: Math.atan2(ny, nx) - a, rad: Math.sqrt(nx * nx + ny * ny), h: 0 };
    }
    return {
      face: 'side',
      theta: Math.asin(clamp(nx, -1, 1)) - a,
      rad: 1,
      h: clamp01((ly - G.topY) / G.sideHeight),
    };
  }

  // Rainbow row colour (red on the top row, purple at the bottom — video order)
  function rainbowRowColor(cc) {
    const R = KitchenData.RAINBOW;
    const k = cc.face === 'top' ? clamp01(cc.rad) * 0.5 : 0.5 + clamp01(cc.h) * 0.5;
    return R[Math.min(R.length - 1, Math.floor(k * R.length))];
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

  // Zero-text counters: stars & album entries are shown as little pips (and a
  // heart once the row is full) instead of digits.
  function paintCountPips(el, count, color) {
    if (!el) return;
    el.textContent = '';
    const n = Math.max(0, Math.floor(Number(count) || 0));
    const shown = Math.min(5, n);
    const w = 8 + shown * 10 + (n > 5 ? 14 : 0), h = 18;
    const cv = document.createElement('canvas');
    cv.width = w * 2;
    cv.height = h * 2;
    cv.style.cssText = 'width:' + w + 'px;height:' + h + 'px;display:inline-block;vertical-align:middle;';
    cv.setAttribute('aria-hidden', 'true');
    const c = cv.getContext('2d');
    c.scale(2, 2);
    c.strokeStyle = KitchenArt.OUTLINE;
    c.lineWidth = 1.4;
    for (let i = 0; i < shown; i++) {
      c.fillStyle = color;
      KitchenArt.circ(c, 7 + i * 10, 9, 3.6);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(255, 255, 255, 0.6)';
      KitchenArt.circ(c, 6 + i * 10, 8, 1.3);
      c.fill();
    }
    if (n > 5) {
      c.fillStyle = color;
      KitchenArt.heart(c, 8 + shown * 10 + 4, 9, 6);
      c.fill();
      c.stroke();
    }
    el.appendChild(cv);
  }

  function updateAlbumBadge() {
    paintCountPips(document.getElementById('starCount'), starsEarned, '#F7C948');
    paintCountPips(document.getElementById('albumCount'), album.length, '#E88388');
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

  // Calm local particle burst signature (x, y, color, count, kind)
  function spawnParticles(x, y, color, count, kind, layer) {
    const n = Math.min(count || 6, 8);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * PI2;
      const sp = rand(10, 30);
      const k = kind || (i % 3 === 0 ? 'sparkle' : 'circle');
      const floaty = k === 'smoke' || k === 'steam';
      spawnParticle({
        x: x + rand(-4, 4), y: y + rand(-4, 4),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (floaty ? 15 : 0),
        r: k === 'star' || k === 'heart' ? rand(3, 5.5) : rand(2, 4),
        color,
        kind: k,
        life: rand(0.3, 0.6),
        glow: k === 'star' || k === 'heart' || k === 'sparkle',
        g: floaty ? -10 : 30,
        drag: 2.2,
        layer: layer === undefined ? 0 : layer,
      });
    }
  }

  function juiceBurst(x, y, colA, colB, n, layer) {
    const count = Math.min(n || 4, 6);
    for (let i = 0; i < count; i++) {
      const a = rand(0, PI2);
      const sp = rand(10, 25);
      spawnParticle({
        x: x + rand(-3, 3), y: y + rand(-3, 3),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: 80, drag: 2.2, r: rand(1.8, 3.2),
        color: i % 2 ? colA : colB, kind: 'droplet', life: rand(0.25, 0.45), layer: layer || 0,
      });
    }
  }

  function starBurst(x, y, color, n, layer, upward) {
    const count = Math.min(n || 4, 6);
    for (let i = 0; i < count; i++) {
      const a = rand(0, PI2);
      const sp = rand(8, 26);
      spawnParticle({
        x: x + rand(-4, 4), y: y + rand(-4, 4),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: 25, drag: 2.4, r: rand(2.2, 4.2),
        color: Array.isArray(color) ? color[i % color.length] : color,
        kind: 'sparkle', glow: true, life: rand(0.3, 0.5), layer: layer === undefined ? 0 : layer,
      });
    }
  }

  function heartBurst(x, y, n, layer) {
    const cols = ['#E87A82', '#F4A6B8', '#F7C948'];
    const count = Math.min(n || 4, 6);
    for (let i = 0; i < count; i++) {
      spawnParticle({
        x: x + rand(-8, 8), y: y + rand(-4, 4),
        vx: rand(-12, 12), vy: rand(-18, -6),
        g: -5, drag: 2.0, r: rand(4.5, 7.5),
        color: cols[i % 3], kind: 'heart',
        glow: true, life: rand(0.6, 1.0), vrot: rand(-1, 1), layer: layer || 0,
      });
    }
  }

  function steamPuff(x, y, n, layer, dark) {
    const count = Math.min(n || 3, 5);
    for (let i = 0; i < count; i++) {
      spawnParticle({
        x: x + rand(-8, 8), y: y + rand(-4, 4),
        vx: rand(-8, 8), vy: rand(-30, -12),
        g: -8, drag: 1.5, r: rand(4, 7),
        color: dark ? 'rgba(85, 70, 62, 0.45)' : 'rgba(255, 252, 244, 0.7)',
        kind: 'steam', life: rand(0.5, 0.9), vrot: 0, layer: layer || 0,
      });
    }
  }

  function ringPulse(x, y, color, layer, r) {
    spawnParticle({ x, y, vx: 0, vy: 0, g: 0, drag: 0, r: r || 10, color, kind: 'ring', life: 0.35, vrot: 0, layer });
  }

  function crumbBurst(x, y, color, n, layer) {
    const count = Math.min(n || 3, 5);
    for (let i = 0; i < count; i++) {
      spawnParticle({
        x: x + rand(-4, 4), y: y + rand(-2, 2),
        vx: rand(-12, 12), vy: rand(-10, 6),
        g: 100, drag: 2.2, r: rand(1.5, 3),
        color: i % 2 ? color : '#E9C189', kind: 'crumb', life: rand(0.25, 0.4), layer: layer || 0,
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
    const count = Math.min(n || 4, 6);
    for (let i = 0; i < count; i++) {
      const a = rand(0, PI2);
      const sp = rand(20, 50);
      spawnConfetti(x, y, Math.cos(a) * sp, Math.sin(a) * sp, layer || 0);
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
   * Grounded Ingredient Placement (100% In-Place, Zero Flying Junk)
   * ========================================================================== */
  function stationDropPoint(st) {
    const c = stationCenter(st);
    if (st === 4 || st === 5) return { x: c.x, y: c.y - 10 };
    return { x: c.x, y: c.y - 4 };
  }

  function launchFlyingIngredient(id) {
    // 100% Zero flying ingredients across screen!
    return 0;
  }

  function flyerPos(f) {
    return { x: (f && f.x1) || 0, y: (f && f.y1) || 0, rot: 0, scale: 1 };
  }

  function updateFlyers(dt) {
    state.flyers = [];
  }

  function onIngredientLanded(f) {}

  function drawFlyers(c) {}

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
    // Grounded placement in-place: zero flying junk across screen!
    const landT = state.t;
    squashImpulse(1.08, 0.94);

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
        uid: ++pipelineUid,
        id: boardItem.id,
        sliced: boardItem.sliced,
        cracked: boardItem.cracked,
        cooked: 0,
        inMix: false,
        inPan: false,
      });
      syncIngredientToPipeline(boardItem.id, boardItem.sliced, boardItem.cracked);
      if (view && canvas) {
        trayHidden = 0;
        view.finishPending = false;
        view.sliced = boardItem.sliced;
        view.cracked = boardItem.cracked;
        view.doneT = state.t;
      }
      boardItem = null;
      state.boardView = null;
      lastFinishT = state.t;
      trayHidden = 0;
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
      view.finishPending = false;
      const c = stationCenter(1);
      ringPulse(c.x, c.y + 20, 'rgba(255, 253, 249, 0.9)', 1, 14);
      starBurst(c.x, c.y - 10, ['#F7C948', '#FFF3B8', meta.color], 4, 1);
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
    view.finishPending = false;
  }

  function retireBoardView() {
    state.boardView = null;
    state.hopSlices = [];
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
    if (view) view.finishPending = false;
    trayHidden = 0;
    state.hopSlices = [];
    renderPrepTrayUI();
  }

  function revealTray() {
    trayHidden = 0;
    renderPrepTrayUI();
  }

  function updateBoard(dt) {
    trayHidden = 0;
    state.hopSlices = [];
  }

  function drawHopSlices(c) {}

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

  // Station 1 finished a piece: it goes onto the dish record ONCE. The bowl and
  // the pan receive it later by transfer (never a second dish entry).
  function syncIngredientToPipeline(id, sliced, cracked) {
    addIngredientToDish(id, sliced, 0, cracked);
  }

  // Carry every prepped piece that has not been mixed yet into the bowl.
  function transferPrepToMixer() {
    let moved = 0;
    prepTray.forEach(p => {
      if (p.inMix || p.inPan) return;
      p.inMix = true;
      mixItems.push({ uid: p.uid, id: p.id, sliced: p.sliced, cracked: p.cracked });
      moved++;
    });
    if (moved) recomputeMixColor();
    return moved;
  }

  // Carry the batter (mixItems) and any un-mixed prepped pieces into the pan/oven.
  function transferToCooker() {
    let moved = 0;
    const inPan = new Set(panItems.map(it => it.uid).filter(u => u !== undefined));
    mixItems.forEach(m => {
      if (m.uid !== undefined && inPan.has(m.uid)) return;
      if (m.uid === undefined) {
        if (m.cookedUid) return;
        m.cookedUid = ++pipelineUid;
        m.uid = m.cookedUid;
      }
      addToCooker(m.id, m.sliced, m.cracked, undefined, { transfer: true, uid: m.uid });
      inPan.add(m.uid);
      moved++;
    });
    prepTray.forEach(p => {
      if (p.inPan || inPan.has(p.uid)) return;
      p.inPan = true;
      if (p.inMix) return; // already travelled through the bowl
      addToCooker(p.id, p.sliced, p.cracked, undefined, { transfer: true, uid: p.uid });
      inPan.add(p.uid);
      moved++;
    });
    return moved;
  }

  function addIngredientToDish(id, sliced, cooked, cracked, landT) {
    const meta = KitchenData.getIngredient(id);
    if (id === 'boba' || (id === 'milk' && mixMode === 'blender')) {
      dish.vessel = 'cup';
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
    refreshDishPalette();
  }

  /* ==========================================================================
   * Station 2: Mixing Bowl & Smoothie Blender (Orbital Whisk & Vortex)
   * ========================================================================== */
  function addToMixer(id, sliced, cracked, landT, opts) {
    const meta = KitchenData.getIngredient(id);
    const o = opts || {};
    const item = { id, sliced: !!sliced, cracked: !!cracked };
    if (o.uid !== undefined) item.uid = o.uid;
    mixItems.push(item);
    if (landT !== undefined) {
      popIns.set(item, landT);
    } else if (!o.transfer) {
      if (meta.liquid) sfx('pour');
      else sfx('chop');
    }
    recomputeMixColor();
    if (!o.transfer) addIngredientToDish(id, sliced !== undefined ? !!sliced : !!meta.choppable, 0, cracked, landT);
    if (id === 'boba' || id === 'milk' || id === 'icecream') {
      if (mixMode === 'blender') dish.vessel = 'cup';
    }
  }

  // The bowl is exactly as colourful as what is inside it.
  function recomputeMixColor() {
    if (!mixItems.length) {
      mixColor = '#FFF5DC';
      return;
    }
    mixColor = KitchenData.paletteFor(mixItems.map(it => it.id)).batterTint;
  }

  function stirMixer(amount, fromDrag) {
    if (mixItems.length === 0) {
      transferPrepToMixer();
      if (mixItems.length === 0 && panItems.length) {
        // Came back from the stove: the bowl mirrors what is already cooking.
        panItems.forEach(p => addToMixer(p.id, p.sliced, p.cracked, undefined, { transfer: true, uid: p.uid }));
      }
      if (mixItems.length === 0) {
        // Nothing was prepped: pour the critter's actual order into the bowl.
        defaultRecipeIds().forEach(id => {
          const m = KitchenData.getIngredient(id);
          addToMixer(id, !!m.choppable, !!m.crackable);
        });
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
    refreshDishPalette();
    if (mixProgress >= 1 && !wasDone) {
      sfx('sparkle');
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
    state.mixAngle = state.mixSwirlAngle;
    if (state.whiskHeld) {
      state.whiskOrbit += wrapAngle(state.whiskTarget - state.whiskOrbit) * (1 - Math.exp(-20 * dt));
    } else {
      state.whiskOrbit += state.mixVelocity * 0.9 * dt;
    }
    state.mixBarShown += (mixProgress - state.mixBarShown) * (1 - Math.exp(-8 * dt));
  }

  /* ==========================================================================
   * Station 3: Sizzling Skillet Pan & Bakery Oven (Chef Pan Toss)
   * ========================================================================== */
  function addToCooker(id, sliced, cracked, landT, opts) {
    const meta = KitchenData.getIngredient(id);
    const o = opts || {};
    const item = {
      id,
      sliced: sliced !== undefined ? sliced : !!meta.choppable,
      cracked: cracked !== undefined ? cracked : !!meta.crackable,
      x: (Math.random() - 0.5) * 85,
      y: (Math.random() - 0.5) * 40,
    };
    if (o.uid !== undefined) item.uid = o.uid;
    panItems.push(item);
    if (landT !== undefined) popIns.set(item, landT);
    else if (!o.transfer) sfx('sizzleTick', heatLevel);
    // Direct adds at the stove are new ingredients; transfers already live on the dish.
    if (!o.transfer) addIngredientToDish(id, item.sliced, Math.max(0.65, cookProgress), item.cracked, landT);
  }

  function flipPan() {
    if (panItems.length === 0) {
      transferToCooker();
      if (panItems.length === 0) {
        // Nothing prepped or mixed at all: cook the critter's actual order.
        // (Never a hidden chocolate or egg.)
        defaultRecipeIds().forEach(id => {
          const m = KitchenData.getIngredient(id);
          addToCooker(id, !!m.choppable, !!m.crackable);
        });
      }
    }
    const c = stationCenter(3);
    if (cookMode === 'oven') {
      cookProgress = Math.min(1.0, cookProgress + 0.35);
      if (!sfx('ovenDing')) sfx('sparkle');
      state.ovenPulseVel += 12;
      squashImpulse(1.06, 0.94);
      steamPuff(c.x, c.y - 70, 3, 3, false);
    } else {
      cookProgress = Math.min(1.0, cookProgress + 0.22);
      sfx('sizzleTick', heatLevel);
      squashImpulse(1.05, 0.95);
    }
    syncCookedStateToDish();
    renderPrimaryActionButton();
  }

  function startPanToss() {
    state.panToss.active = false;
    state.panToss.t = 0;
    state.panToss.bodies = [];
    state.panToss.baseBody = null;
    squashImpulse(1.04, 0.96);
  }

  function finishPanTossNow() {
    state.panToss.active = false;
    state.panToss.bodies = [];
    state.panToss.baseBody = null;
  }

  function onTossBodyLanded(pl) {}

  function computeTossBody(pl, k, dur) {
    return { dx: 0, dy: 0, rot: 0, flip: 0, sx: 1, sy: 1, shadow: 1 };
  }

  function updateCook(dt) {
    state.panToss.active = false;
    state.panToss.panDy = 0;
    state.panToss.panTilt = 0;
    state.cookNeedleShown += (cookProgress - state.cookNeedleShown) * (1 - Math.exp(-7 * dt));

    if (station === 3 && panItems.length > 0) {
      cookProgress = Math.min(1.0, cookProgress + dt * 0.045 * heatLevel);
      syncCookedStateToDish();
      sizzleTimer -= dt;
      if (sizzleTimer <= 0) {
        sizzleTimer = 0.22;
        sfx('sizzleTick', heatLevel * 0.35);
      }
      if (stationVisible(3)) {
        const c = stationCenter(3);
        if (Math.random() < dt * 2.2 * heatLevel) {
          spawnParticle({
            x: c.x + rand(-50, 50), y: c.y + rand(-20, 15),
            vx: rand(-6, 6), vy: rand(-25, -12),
            g: -10, drag: 1.2, r: rand(3.5, 6.5),
            color: cookMode === 'oven' ? 'rgba(255, 240, 210, 0.7)' : 'rgba(255, 250, 235, 0.65)',
            kind: 'steam', life: rand(0.6, 1.0), vrot: 0, layer: 3,
          });
        }
      }
    }
  }

  function syncCookedStateToDish() {
    dish.items.forEach(it => {
      it.cooked = Math.max(it.cooked || 0, cookProgress);
    });
    // A cake exists only once the oven has really baked the batter.
    if (cookMode === 'oven' && cookProgress >= 0.35) {
      dish.bakedCake = true;
    }
    refreshDishPalette();
  }

  /* ==========================================================================
   * Station 4: Turntable Decorating — piping, glaze, tweezers & toppings
   * ========================================================================== */
  // Entering the turntable never conjures a cake out of thin air: the dish is
  // whatever the player made. Only a completely empty kitchen falls back to
  // the critter's actual order.
  function ensureDishHasBase() {
    if (dish.items.length === 0) {
      const ids = defaultRecipeIds();
      const doneness = cookProgress > 0 ? cookProgress : 0.9;
      ids.forEach(id => {
        const m = KitchenData.getIngredient(id);
        addIngredientToDish(id, !!m.choppable, doneness, !!m.crackable);
      });
      if (cookMode === 'oven' && mode === 'wish' && currentOrder().wantCooking === 'oven') {
        dish.bakedCake = true;
      }
    }
    dish.turntableAngle = state.turntableAngle;
    refreshDishPalette();
  }

  // Theme the Station-4 tools after the player's ingredients (only the
  // swatches the player has not explicitly chosen yet).
  function prepareDecorTools() {
    const pal = refreshDishPalette();
    if (!pipingColorChosen) {
      let idx;
      if (pal.hasChocolate) {
        // White cloud cream reads best on a dark ganache cake.
        idx = KitchenData.PIPING_COLORS.findIndex(p => p.id === 'white');
      } else {
        let themeHex = null;
        if (pal.hasRainbow) themeHex = KitchenData.RAINBOW[0];
        else if (pal.themeId) themeHex = KitchenData.getIngredient(pal.themeId).batter;
        idx = KitchenData.pipingIndexForColor(themeHex);
      }
      if (idx >= 0) pipingColorIdx = idx;
    }
    if (!sauceChosen) {
      const want = pal.frostingColor || KitchenData.VANILLA_CREAM;
      let best = 0, bestD = 1e9;
      KitchenData.SAUCES.forEach((s, i) => {
        const a = KitchenData.hexToRgb(s.color), b = KitchenData.hexToRgb(want);
        const d = Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
        if (d < bestD) { bestD = d; best = i; }
      });
      sauceIdx = best;
    }
    if (!toppingChosen) {
      let idx = KitchenData.TOPPINGS.findIndex(tp => tp.ingredient && tp.ingredient === pal.themeId);
      if (idx < 0 && (pal.hasChocolate || pal.hasRainbow)) idx = KitchenData.TOPPINGS.findIndex(tp => tp.id === 'candy_balls');
      if (idx < 0) idx = KitchenData.TOPPINGS.findIndex(tp => tp.id === 'cherry');
      if (idx >= 0) toppingIdx = idx;
    }
    if (!decorToolChosen) {
      const hint = mode === 'wish' ? currentOrder().cakeStyle : null;
      if (hint === 'candy_balls') {
        decorTool = 'topping';
        if (!toppingChosen) toppingIdx = Math.max(0, KitchenData.TOPPINGS.findIndex(tp => tp.id === 'candy_balls'));
        state.cakeStyle = dish.cakeStyle = 'candy_balls';
      } else {
        decorTool = 'piping';
        if (hint === 'rainbow_rosettes') state.cakeStyle = dish.cakeStyle = 'rainbow_rosettes';
      }
    }
    renderDecorToolbar();
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

  function currentPipingColor() {
    return KitchenData.PIPING_COLORS[pipingColorIdx] || KitchenData.PIPING_COLORS[0];
  }

  // Colour of the next rosette: the player's swatch, or rainbow rows for the
  // rainbow cake when no swatch was chosen yet.
  function rosetteColorFor(cc) {
    if (!pipingColorChosen && dish.hasRainbow) return rainbowRowColor(cc);
    return currentPipingColor().color;
  }

  function pipeRosetteAt(lx, ly, isDrag, forcedColor) {
    const last = dish.rosettes[dish.rosettes.length - 1];
    if (isDrag && last && Math.hypot(last.x - lx, last.y - ly) < 18) return null;
    const cc = cylinderCoords(lx, ly);
    const col = forcedColor || rosetteColorFor(cc);
    const ros = {
      x: lx, y: ly, color: col,
      shadow: KitchenArt.darken(col, 0.25), hi: KitchenArt.lighten(col, 0.25),
      r: 15, scale: 1, angle: state.turntableAngle,
      face: cc.face, theta: cc.theta, h: cc.h, rad: cc.rad,
      index: dish.rosettes.length,
    };
    dish.rosettes.push(ros);
    dish.rosetteCount = dish.rosettes.length;
    if (!sfx('buttercreamSwoosh')) { if (!sfx('pipeCream')) sfx('popSelect', ros.index % 6); }
    squashImpulse(1.04, 0.96);
    startPipingAnim('piping', lx, ly, col);
    return ros;
  }

  function placeCandyBallAt(lx, ly, isDrag) {
    const last = dish.candyBalls[dish.candyBalls.length - 1];
    if (isDrag && last && Math.hypot(last.x - lx, last.y - ly) < 16) return null;
    const cc = cylinderCoords(lx, ly);
    const col = rainbowRowColor(cc);
    const ball = {
      x: lx, y: ly, color: col, angle: state.turntableAngle,
      face: cc.face, theta: cc.theta, h: cc.h, rad: cc.rad,
      index: dish.candyBalls.length, scale: 1,
    };
    dish.candyBalls.push(ball);
    dish.candyBallCount = dish.candyBalls.length;
    if (!sfx('candyPop')) { if (!sfx('ballPlace')) sfx('popSelect', ball.index % 6); }
    squashImpulse(1.03, 0.97);
    startPipingAnim('candy', lx, ly, col);
    return ball;
  }

  function placeToppingAt(lx, ly, toppingId, isDrag) {
    const topMeta = KitchenData.getTopping(toppingId);
    if (topMeta.id === 'candy_balls') return placeCandyBallAt(lx, ly, isDrag);
    const last = dish.toppings[dish.toppings.length - 1];
    if (isDrag && last && Math.hypot(last.x - lx, last.y - ly) < 26) return null;
    const cc = cylinderCoords(lx, ly);
    const ingMeta = topMeta.ingredient ? KitchenData.getIngredient(topMeta.ingredient) : null;
    const tp = {
      id: topMeta.id,
      ingredient: topMeta.ingredient || null,
      color: ingMeta ? ingMeta.color : '#F7C948',
      x: lx, y: ly,
      seed: Math.floor(Math.random() * 1000),
      blownOut: false,
      dropY: 0, sx: 1, sy: 1,
      angle: state.turntableAngle,
      face: cc.face, theta: cc.theta, h: cc.h, rad: cc.rad,
      index: dish.toppings.length,
    };
    dish.toppings.push(tp);
    squashImpulse(1.04, 0.96);
    sfx('sprinkle');
    startPipingAnim('topping', lx, ly, tp.color);
    return tp;
  }

  // Glaze pour: the whole cake takes the poured glaze colour (progressively),
  // and each stroke becomes glossy drips for the renderer.
  function pourGlazeAt(lx, ly, isDrag) {
    const sMeta = KitchenData.SAUCES[sauceIdx] || KitchenData.SAUCES[0];
    if (!isDrag) {
      dish.frostingColor = sMeta.color;
      dish.frostingHi = sMeta.hi;
      dish.glazeChosen = true;
      dish.glazeProgress = Math.min(1, (dish.glazeProgress || 0) + 0.34);
      const cc = cylinderCoords(lx, ly);
      activeStroke = {
        color: sMeta.color, hi: sMeta.hi, id: sMeta.id,
        pts: [{ x: lx, y: ly }],
        angle: state.turntableAngle, theta: cc.theta, face: cc.face,
      };
      dish.sauces.push(activeStroke);
      sfx('pour');
      startPipingAnim('sauce', lx, ly, sMeta.color);
    } else if (activeStroke) {
      const prev = activeStroke.pts[activeStroke.pts.length - 1];
      if (!prev || Math.hypot(prev.x - lx, prev.y - ly) > 8) {
        activeStroke.pts.push({ x: lx, y: ly });
        dish.glazeProgress = Math.min(1, (dish.glazeProgress || 0) + 0.02);
      }
    }
  }

  // Legacy entry points kept for scripts: they route to the new placers.
  function addPipingPoint(localX, localY) {
    ensureDishHasBase();
    const r = pipeRosetteAt(localX, localY, false);
    renderPrimaryActionButton();
    return r;
  }

  function addToppingAt(localX, localY) {
    ensureDishHasBase();
    for (let tp of dish.toppings) {
      if (tp.id === 'candle' && !tp.blownOut && Math.hypot(tp.x - localX, tp.y - localY) < 28) {
        tp.blownOut = true;
        sfx('blowCandle');
        const c = stationCenter(4);
        steamPuff(c.x + tp.x * 1.08, c.y + (tp.y - 30) * 1.08, 4, 4, false);
        starBurst(c.x + tp.x * 1.08, c.y + (tp.y - 30) * 1.08, '#F7C948', 4, 4);
        return null;
      }
    }
    const topMeta = KitchenData.TOPPINGS[toppingIdx] || KitchenData.TOPPINGS[0];
    const r = placeToppingAt(localX, localY, topMeta.id, false);
    renderPrimaryActionButton();
    return r;
  }

  const RAINBOW_BALL_COLORS = KitchenData.CANDY_BALL_COLORS;
  const ROSETTE_COLORS = KitchenData.RAINBOW;

  function handleDecorateAction(lx, ly, pt, isDrag) {
    ensureDishHasBase();
    // The white turntable eases round under the hand (gently while dragging).
    state.turntableVel += isDrag ? 0.45 : 2.2;
    state.turntableAngle += isDrag ? 0.03 : 0.22;
    dish.turntableAngle = state.turntableAngle;

    let placed = null;
    if (decorTool === 'sauce') {
      pourGlazeAt(lx, ly, isDrag);
      placed = activeStroke;
    } else if (decorTool === 'topping') {
      const topMeta = KitchenData.TOPPINGS[toppingIdx] || KitchenData.TOPPINGS[0];
      placed = placeToppingAt(lx, ly, topMeta.id, isDrag);
    } else {
      placed = pipeRosetteAt(lx, ly, isDrag);
    }
    if (placed && pt) {
      spawnParticle({
        x: pt.x + rand(-6, 6), y: pt.y + rand(-6, 6),
        vx: rand(-8, 8), vy: rand(-8, 8),
        r: rand(2, 3.5), color: placed.color || '#FFFDF9', kind: 'sparkle', life: 0.3, layer: 4,
      });
    }
    refreshDishPalette();
    renderPrimaryActionButton();
    return placed;
  }

  // "Next" pressed on an untouched cake: add one tasteful step of decoration
  // in the player's own ingredient theme (never a cocoa cake out of nowhere).
  function autoDecorateInTheme() {
    ensureDishHasBase();
    const G = KitchenData.CAKE_GEOM;
    const pal = refreshDishPalette();
    const ring = 8;
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * PI2 - Math.PI / 2;
      const lx = Math.cos(a) * G.radius * 0.8;
      const ly = G.topY + Math.sin(a) * G.topRy * 0.8;
      const cc = cylinderCoords(lx, ly);
      let col;
      if (pal.hasRainbow) col = KitchenData.RAINBOW[i % KitchenData.RAINBOW.length];
      else if (pal.hasChocolate) col = i % 2 ? KitchenData.VANILLA_CREAM : currentPipingColor().color;
      else col = pipingColorChosen ? currentPipingColor().color : (dish.frostingColor && dish.frostingColor !== KitchenData.VANILLA_CREAM ? KitchenData.VANILLA_CREAM : KitchenData.getIngredient(pal.themeId || 'strawberry').batter);
      pipeRosetteAt(lx, ly, false, col);
      void cc;
    }
    if (pal.hasChocolate || pal.hasRainbow) {
      // Candy-ball rows round the side wall, tweezer style
      for (let row = 0; row < 3; row++) {
        for (let k = 0; k < 7; k++) {
          const u = (k - 3) / 3.2;
          const lx = u * G.radius * 0.92;
          const ly = G.topY + 12 + row * 20;
          placeCandyBallAt(lx, ly, false);
        }
      }
    } else {
      const fruitTop = KitchenData.TOPPINGS.find(tp => tp.ingredient && tp.ingredient === pal.themeId);
      const topId = fruitTop ? fruitTop.id : 'cherry';
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * PI2 + 0.4;
        placeToppingAt(Math.cos(a) * G.radius * 0.42, G.topY + Math.sin(a) * G.topRy * 0.42, topId, false);
      }
    }
    state.turntableVel += 1.4;
    refreshDishPalette();
    renderPrimaryActionButton();
  }

  function updateDecorate(dt) {
    state.turntableAngle += state.turntableVel * dt;
    state.turntableVel *= Math.exp(-4.5 * dt);
    if (Math.abs(state.turntableVel) < 0.005) state.turntableVel = 0;
    dish.turntableAngle = state.turntableAngle;
    dish.cakeStyle = state.cakeStyle;

    const pa = state.pipingAnim;
    if (pa.active) {
      pa.t = Math.min(1, pa.t + dt / 0.38);
      pa.squeeze = Math.sin(Math.PI * Math.min(1, pa.t * 1.3));
      pa.shake = 0;
      if (pa.t >= 1) {
        pa.active = false;
        pa.squeeze = 0;
        pa.shake = 0;
      }
    }
    state.toolTilt = clamp(state.toolPos.vx * 0.0008, -0.25, 0.25);

    for (let i = dollopPops.length - 1; i >= 0; i--) {
      const d = dollopPops[i];
      const tau = state.t - d.born;
      if (tau >= 0 && !d.sounded) {
        d.sounded = true;
        sfx('pipeCream');
      }
      if (tau > 0.4) {
        d.p.scale = 1;
        dollopPops.splice(i, 1);
      } else {
        d.p.scale = 1;
      }
    }
    state.toppingSprings = [];
  }

  function stepToppingSprings(h) {
    state.toppingSprings = [];
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
      rosettes: dish.rosettes.map(p => Object.assign({}, p, { scale: 1 })),
      candyBalls: dish.candyBalls.map(p => Object.assign({}, p, { scale: 1 })),
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

    // Gaze target: spoon > knife > cake/turntable > pointer
    let lt = state.pointer;
    const off1 = layerOffset(1);
    const off4 = layerOffset(4);
    const off5 = layerOffset(5);
    if ((fs.active || fork.dragging) && off5 !== null) {
      lt = { x: fs.x + off5, y: fs.y };
    } else if (state.knifeSlash.active && off1 !== null) {
      lt = { x: state.knifeSlash.pose.x + off1, y: state.knifeSlash.pose.y };
    } else if (station === 4 && off4 !== null) {
      const c4 = stationCenter(4);
      lt = { x: c4.x + off4, y: c4.y };
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

    if (station === 2) {
      // The chopped pieces travel from the tray into the glass bowl.
      transferPrepToMixer();
    }
    if (station === 3) {
      // Batter / prepped pieces travel into the oven tin or the mini pan.
      transferToCooker();
    }
    if (station >= 4) {
      ensureDishHasBase();
    }
    if (station === 4) {
      prepareDecorTools();
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
    state.turntableAngle = 0;
    state.turntableVel = 0;
    state.cakeStyle = null;
    activeStroke = null;
    dish = createFreshDish();
    dish.turntableAngle = 0;
    pipingColorChosen = false;
    sauceChosen = false;
    toppingChosen = false;
    decorToolChosen = false;
    pipingColorIdx = Math.max(0, KitchenData.PIPING_COLORS.findIndex(p => p.id === 'white'));
    sauceIdx = 0;
    toppingIdx = 0;
    decorTool = 'piping';
    state.scoopsShown = 0;
    state.bitesEaten = 0;
    state.reaction = null;
    state.reactionTimer = 0;
    state.celebrateTimer = 0;
    serveSuccess = false;
    lastReaction = null;
    if (nextOrder) {
      orderIdx = (orderIdx + 1) % KitchenData.WISH_ORDERS.length;
    }
    syncModesToOrder();
    renderPrepTrayUI();
    renderCustomerBar();
    renderDecorToolbar();
    setStation(1);
  }

  // The critter's order decides the default appliances (oven / pan / blender).
  function syncModesToOrder() {
    if (mode !== 'wish') return;
    const ord = currentOrder();
    const cIdx = KitchenData.CRITTERS.findIndex(c => c.id === ord.critter);
    if (cIdx >= 0) critterIdx = cIdx;
    cookMode = ord.wantCooking === 'oven' ? 'oven' : 'pan';
    mixMode = ord.wantCooking === 'blender' ? 'blender' : 'bowl';
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

    // 5. Screen-space choreography: gentle local sparkles, hearts, confetti
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
        const done = id ? usedIds.has(id) : (decorCount() > 0 || cookProgress >= 0.6);
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

    const mixPal = KitchenData.paletteFor(mixItems.map(it => it.id));
    const s = {
      station: 2,
      mixMode,
      mixItems: shownItems(mixItems),
      mixIds: mixItems.map(it => it.id),
      layerColors: mixItems.length ? mixPal.layerColors : [],
      hasChocolate: mixPal.hasChocolate,
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
    // The tin / pan is exactly as colourful as what is really cooking in it.
    const cookIds = panItems.length ? panItems.map(it => it.id) : (mixItems.length ? mixItems.map(it => it.id) : prepTray.map(p => p.id));
    const cookPal = KitchenData.paletteFor(cookIds);
    const s = {
      station: 3,
      cookMode,
      heatLevel,
      panItems: shown.map(it => Object.assign({}, it, { scale: popScale(it) })),
      panIds: panItems.map(it => it.id),
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
      batterTint: cookIds.length ? cookPal.batterTint : (mixItems.length ? mixColor : '#FFF3C4'),
      layerColors: cookIds.length ? cookPal.layerColors : [],
      hasChocolate: cookPal.hasChocolate,
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
    // Left sub-tool cards: A = tweezers + rainbow candy balls, B = piping bag rosettes
    const topMetaSel = KitchenData.TOPPINGS[toppingIdx] || KitchenData.TOPPINGS[0];
    const cardA = decorTool === 'topping' && topMetaSel.id === 'candy_balls';
    const cardB = decorTool === 'piping';
    drawCanvasIconCard(c, 36, cy - 42, 118, 46, cardA, 'candy_balls');
    drawCanvasIconCard(c, 36, cy + 14, 118, 46, cardB, 'rosette');

    let toolColor = '#F7C948';
    if (decorTool === 'piping') {
      if (!pipingColorChosen && dish.hasRainbow) {
        toolColor = KitchenData.RAINBOW[dish.rosettes.length % KitchenData.RAINBOW.length];
      } else {
        toolColor = currentPipingColor().color;
      }
    } else if (decorTool === 'sauce') {
      toolColor = (KitchenData.SAUCES[sauceIdx] || KitchenData.SAUCES[0]).color;
    } else if (topMetaSel.id === 'candy_balls') {
      toolColor = KitchenData.CANDY_BALL_COLORS[dish.candyBalls.length % KitchenData.CANDY_BALL_COLORS.length];
    } else if (topMetaSel.ingredient) {
      toolColor = KitchenData.getIngredient(topMetaSel.ingredient).color;
    }
    const pa = state.pipingAnim;
    const near = Math.hypot(hoverPt.x - cx, hoverPt.y - cy) < 165;
    const s = {
      station: 4,
      dish,
      decorTool,
      selectedTopping: topMetaSel.id,
      selectedToppingIngredient: topMetaSel.ingredient || null,
      cakeStyle: state.cakeStyle,
      turntableAngle: state.turntableAngle,
      pipingAnim: {
        active: pa.active,
        t: pa.t,
        x: pa.x,
        y: pa.y,
        color: pa.color,
        kind: pa.kind,
        squeeze: pa.squeeze,
        shake: 0,
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
        if (pt.y >= cy - 44 && pt.y <= cy + 8) {
          // Card A: tweezers + rainbow candy balls (video style A)
          state.cakeStyle = 'candy_balls';
          dish.cakeStyle = 'candy_balls';
          decorTool = 'topping';
          decorToolChosen = true;
          toppingIdx = Math.max(0, KitchenData.TOPPINGS.findIndex(tp => tp.id === 'candy_balls'));
          toppingChosen = true;
          renderDecorToolbar();
          squashImpulse(1.12, 0.9);
          sfx('popSelect', 1);
          return;
        }
        if (pt.y >= cy + 12 && pt.y <= cy + 64) {
          // Card B: piping bag rosettes (video style B)
          state.cakeStyle = 'rainbow_rosettes';
          dish.cakeStyle = 'rainbow_rosettes';
          decorTool = 'piping';
          decorToolChosen = true;
          renderDecorToolbar();
          squashImpulse(1.12, 0.9);
          sfx('popSelect', 2);
          return;
        }
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
      if (Math.hypot(lx, ly) < 135) {
        handleDecorateAction(lx, ly, pt, false);
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
      if (Math.hypot(lx, ly) < 135) {
        handleDecorateAction(lx, ly, pt, true);
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
      fruit:  ['strawberry', 'banana', 'kiwi'],
      meat:   ['egg', 'beef', 'cheese'],
      veggie: ['bun', 'pizzabase', 'tomato'],
      magic:  ['dough', 'popcandy', 'cocoa'],
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

  // Every topping swatch shows the real thing it places (fruit slices use the
  // same ingredient art as the shelf; candy balls / arch / flower use icons).
  function paintToppingSwatch(c, tp, x, y, r) {
    if (tp.ingredient) {
      KitchenArt.drawIngredient(c, tp.ingredient, x, y, r, { sliced: true, shadow: false });
      return;
    }
    const iconMap = { candy_balls: 'candy_balls', rainbow_arch: 'rainbow_arch', flower_pot: 'flower_pot', stars: 'star', hearts: 'heart', candle: 'topping' };
    if (iconMap[tp.id]) {
      KitchenArt.drawIcon(c, iconMap[tp.id], x, y, r, 0);
      return;
    }
    let drawn = false;
    if (typeof KitchenArt.drawTopping === 'function') {
      c.save();
      try {
        c.translate(x, y);
        const k = r / 14;
        c.scale(k, k);
        KitchenArt.drawTopping(c, { id: tp.id, x: 0, y: 0, seed: 1, dropY: 0, sx: 1, sy: 1, blownOut: false, color: '#F7C948' }, 0, null);
        drawn = true;
      } catch (e) { /* fall through to simple glyphs */ }
      c.restore();
    }
    if (drawn) return;
    c.save();
    c.strokeStyle = KitchenArt.OUTLINE;
    c.lineWidth = 1.8;
    if (tp.id === 'cherry') {
      c.strokeStyle = '#5E8C3A';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x - 4, y + 1);
      c.quadraticCurveTo(x - 1, y - 9, x + 5, y - 11);
      c.moveTo(x + 5, y + 2);
      c.quadraticCurveTo(x + 4, y - 7, x + 5, y - 11);
      c.stroke();
      c.strokeStyle = KitchenArt.OUTLINE;
      c.fillStyle = '#E63946';
      KitchenArt.circ(c, x - 5, y + 4, r * 0.42);
      c.fill();
      c.stroke();
      KitchenArt.circ(c, x + 5, y + 5, r * 0.42);
      c.fill();
      c.stroke();
    } else if (tp.id === 'sprinkles') {
      const cols = KitchenData.RAINBOW;
      for (let i = 0; i < 7; i++) {
        c.save();
        c.translate(x + Math.cos(i * 2.3) * r * 0.55, y + Math.sin(i * 1.7) * r * 0.5);
        c.rotate(i * 0.9);
        c.fillStyle = cols[i % cols.length];
        KitchenArt.rr(c, -4, -1.5, 8, 3, 1.5);
        c.fill();
        c.restore();
      }
    } else if (tp.id === 'umbrella') {
      c.fillStyle = '#FF8DA8';
      c.beginPath();
      c.moveTo(x - r, y);
      c.quadraticCurveTo(x, y - r * 1.3, x + r, y);
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = '#C87D4B';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y + r * 0.9);
      c.stroke();
    } else {
      KitchenArt.drawIcon(c, 'cupcake', x, y, r, 0);
    }
    c.restore();
  }

  function renderDecorToolbar() {
    const bar = document.getElementById('decorToolbar');
    if (!bar) return;
    bar.innerHTML = '';

    const tools = [
      { id: 'piping',  icon: 'piping' },
      { id: 'sauce',   icon: 'sauce' },
      { id: 'topping', icon: 'candy_balls' },
    ];
    const modeRow = document.createElement('div');
    modeRow.className = 'decor-modes';
    tools.forEach(tl => {
      const b = document.createElement('button');
      b.className = 'decor-mode-btn' + (decorTool === tl.id ? ' active' : '');
      b.dataset.tool = tl.id;
      const cv = document.createElement('canvas');
      cv.width = 96;
      cv.height = 56;
      paintIconCanvas(cv, tl.icon);
      b.appendChild(cv);
      b.onclick = () => {
        decorTool = tl.id;
        decorToolChosen = true;
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
        b.dataset.swatch = p.id;
        const cv = document.createElement('canvas');
        cv.width = 68;
        cv.height = 60;
        const c = cv.getContext('2d');
        c.scale(2, 2);
        c.strokeStyle = KitchenArt.OUTLINE;
        c.lineWidth = 2;
        let rosetteDrawn = false;
        if (typeof KitchenArt.drawButtercreamRosette === 'function') {
          try {
            KitchenArt.drawButtercreamRosette(c, 17, 15, 11, p.color);
            rosetteDrawn = true;
          } catch (e) { rosetteDrawn = false; }
        }
        if (!rosetteDrawn) {
          c.fillStyle = p.color;
          KitchenArt.circ(c, 17, 15, 11);
          c.fill();
          c.stroke();
        }
        b.appendChild(cv);
        b.onclick = () => { pipingColorIdx = idx; pipingColorChosen = true; sfx('popSelect', idx); renderDecorToolbar(); };
        optRow.appendChild(b);
      });
    } else if (decorTool === 'sauce') {
      KitchenData.SAUCES.forEach((s, idx) => {
        const b = document.createElement('button');
        b.className = 'swatch-btn' + (sauceIdx === idx ? ' active' : '');
        b.dataset.swatch = s.id;
        const cv = document.createElement('canvas');
        cv.width = 68;
        cv.height = 60;
        const c = cv.getContext('2d');
        c.scale(2, 2);
        // Glossy glaze drop
        c.fillStyle = s.color;
        c.strokeStyle = KitchenArt.OUTLINE;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(17, 3);
        c.bezierCurveTo(24, 12, 28, 17, 28, 21);
        c.bezierCurveTo(28, 27.5, 23, 31, 17, 31);
        c.bezierCurveTo(11, 31, 6, 27.5, 6, 21);
        c.bezierCurveTo(6, 17, 10, 12, 17, 3);
        c.closePath();
        c.fill();
        c.stroke();
        c.fillStyle = s.hi || 'rgba(255,255,255,0.7)';
        KitchenArt.ell(c, 12.5, 20, 2.2, 4, -0.3);
        c.fill();
        b.appendChild(cv);
        b.onclick = () => { sauceIdx = idx; sauceChosen = true; sfx('popSelect', idx); renderDecorToolbar(); };
        optRow.appendChild(b);
      });
    } else {
      KitchenData.TOPPINGS.forEach((tp, idx) => {
        const b = document.createElement('button');
        b.className = 'swatch-btn' + (toppingIdx === idx ? ' active' : '');
        b.dataset.swatch = tp.id;
        const cv = document.createElement('canvas');
        cv.width = 68;
        cv.height = 60;
        const c = cv.getContext('2d');
        c.scale(2, 2);
        paintToppingSwatch(c, tp, 17, 15, 12);
        b.appendChild(cv);
        b.onclick = () => { toppingIdx = idx; toppingChosen = true; sfx('popSelect', idx); renderDecorToolbar(); };
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
      if (decorCount() === 0) autoDecorateInTheme();
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
    syncModesToOrder();
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
      turntableAngle: state.turntableAngle,
      cakeStyle: dish.cakeStyle,
      candyBalls: (dish.candyBalls || []).length,
      rosettes: (dish.rosettes || []).length,
      piping: dish.piping.length,
      toppings: dish.toppings.length,
      sauces: dish.sauces.length,
      layerColors: dish.layerColors.slice(),
      batterTint: dish.batterTint,
      frostingColor: dish.frostingColor,
      hasChocolate: dish.hasChocolate,
      hasRainbow: dish.hasRainbow,
      bakedCake: dish.bakedCake,
      baseKind: dish.baseKind,
      dishIds: dishIngredientIds(),
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

  // Read-only, JSON-safe snapshot of the dish + pipeline for playtests & audits.
  function getDishState() {
    const pick3d = o => ({
      x: o.x, y: o.y, color: o.color || null, face: o.face || null,
      theta: o.theta, h: o.h, rad: o.rad, angle: o.angle, index: o.index,
    });
    return JSON.parse(JSON.stringify({
      station,
      mode,
      order: currentOrder().id,
      critter: currentCritter().id,
      items: dish.items.map(i => ({ id: i.id, sliced: !!i.sliced, cracked: !!i.cracked, cooked: i.cooked || 0 })),
      ids: dishIngredientIds(),
      layerColors: dish.layerColors,
      batterTint: dish.batterTint,
      frostingColor: dish.frostingColor,
      frostingHi: dish.frostingHi,
      hasChocolate: dish.hasChocolate,
      hasRainbow: dish.hasRainbow,
      themeId: dish.themeId,
      bakedCake: dish.bakedCake,
      cakeStyle: dish.cakeStyle,
      baseKind: dish.baseKind,
      vessel: dish.vessel,
      glazeChosen: dish.glazeChosen,
      glazeProgress: dish.glazeProgress,
      candyBalls: dish.candyBalls.map(pick3d),
      rosettes: dish.rosettes.map(pick3d),
      piping: dish.piping.map(p => ({ x: p.x, y: p.y, color: p.color })),
      toppings: dish.toppings.map(tp => Object.assign(pick3d(tp), { id: tp.id, ingredient: tp.ingredient || null, blownOut: !!tp.blownOut })),
      sauces: dish.sauces.map(s => ({ id: s.id || null, color: s.color, hi: s.hi, points: s.pts.length })),
      turntableAngle: dish.turntableAngle,
      bitesTaken: dish.bitesTaken,
      prepTray: prepTray.map(p => p.id),
      mixItems: mixItems.map(m => m.id),
      mixColor,
      mixProgress,
      mixMode,
      panItems: panItems.map(p => p.id),
      cookMode,
      cookProgress,
      heatLevel,
      decorTool,
      pipingColor: (KitchenData.PIPING_COLORS[pipingColorIdx] || {}).id || null,
      pipingColorHex: (KitchenData.PIPING_COLORS[pipingColorIdx] || {}).color || null,
      sauce: (KitchenData.SAUCES[sauceIdx] || {}).id || null,
      topping: (KitchenData.TOPPINGS[toppingIdx] || {}).id || null,
      chosen: { piping: pipingColorChosen, sauce: sauceChosen, topping: toppingChosen, tool: decorToolChosen },
    }));
  }

  return {
    init,
    setStation,
    selectIngredient,
    chopBoardItem,
    stirMixer,
    flipPan,
    setCookMode: m => {
      cookMode = (m === 'oven' ? 'oven' : 'pan');
      renderPrimaryActionButton();
      return cookMode;
    },
    setMixMode: m => {
      mixMode = (m === 'blender' ? 'blender' : 'bowl');
      dish.vessel = mixMode === 'blender' ? 'cup' : 'plate';
      renderPrimaryActionButton();
      return mixMode;
    },
    setDecorTool: tl => {
      if (tl === 'piping' || tl === 'sauce' || tl === 'topping') {
        decorTool = tl;
        decorToolChosen = true;
        renderDecorToolbar();
      }
      return decorTool;
    },
    setPipingColor: idOrIdx => {
      const idx = typeof idOrIdx === 'number' ? idOrIdx : KitchenData.PIPING_COLORS.findIndex(p => p.id === idOrIdx);
      if (idx >= 0 && idx < KitchenData.PIPING_COLORS.length) { pipingColorIdx = idx; pipingColorChosen = true; renderDecorToolbar(); }
      return KitchenData.PIPING_COLORS[pipingColorIdx].id;
    },
    setSauce: idOrIdx => {
      const idx = typeof idOrIdx === 'number' ? idOrIdx : KitchenData.SAUCES.findIndex(s => s.id === idOrIdx);
      if (idx >= 0 && idx < KitchenData.SAUCES.length) { sauceIdx = idx; sauceChosen = true; renderDecorToolbar(); }
      return KitchenData.SAUCES[sauceIdx].id;
    },
    setTopping: idOrIdx => {
      const idx = typeof idOrIdx === 'number' ? idOrIdx : KitchenData.TOPPINGS.findIndex(tp => tp.id === idOrIdx);
      if (idx >= 0 && idx < KitchenData.TOPPINGS.length) { toppingIdx = idx; toppingChosen = true; renderDecorToolbar(); }
      return KitchenData.TOPPINGS[toppingIdx].id;
    },
    decorateAt: (lx, ly, isDrag) => {
      if (station !== 4) return null;
      const c = stationCenter(4);
      return handleDecorateAction(lx, ly, { x: c.x + lx * 1.08, y: c.y + ly * 1.08 }, !!isDrag);
    },
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
    getDishState,
    getDish: getDishState,
    getState: () => ({
      mode,
      station,
      critter: currentCritter().id,
      order: currentOrder().id,
      prepCount: prepTray.length,
      prepIds: prepTray.map(p => p.id),
      mixIds: mixItems.map(m => m.id),
      panIds: panItems.map(p => p.id),
      mixMode,
      cookMode,
      mixColor,
      mixProgress,
      cookProgress,
      dishItems: dish.items.length,
      dishIds: dishIngredientIds(),
      layerColors: dish.layerColors.slice(),
      batterTint: dish.batterTint,
      frostingColor: dish.frostingColor,
      hasChocolate: dish.hasChocolate,
      hasRainbow: dish.hasRainbow,
      bakedCake: dish.bakedCake,
      baseKind: dish.baseKind,
      cakeStyle: dish.cakeStyle,
      decorTool,
      candyBalls: dish.candyBalls.length,
      rosettes: dish.rosettes.length,
      pipingCount: dish.piping.length,
      toppingsCount: dish.toppings.length,
      saucesCount: dish.sauces.length,
      decorCount: decorCount(),
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
