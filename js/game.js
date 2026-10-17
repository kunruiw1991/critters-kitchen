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

  // Station 3: Playset & Circulating Running Water Sink State (Slice 3)
  let playsetMode = 'playset'; // 'playset' | 'sink'

  // Station 3: Dual-Burner Stove Top (Boiling Soup Pot & Sizzling Skillet) + Oven State
  let cookMode = 'oven'; // 'pan' | 'oven'
  let heatLevel = 2;     // Right skillet burner: 1:Low, 2:Med, 3:High
  let soupHeatLevel = 2; // Left soup pot burner: 1:Low, 2:Med, 3:High
  let panItems = [];
  let cookProgress = 0;
  let sizzleTimer = 0;
  let boilTimer = 0;

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
  let dragFood = null;
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
    // Station 10: Little Doctor Clinic & Plushie Wellness Care
    clinic: {
      activeTool: 'stethoscope',
      heartbeatPulse: 0,
      heartbeatChecks: 0,
      listeningHeartbeat: false,
      scanningTemp: 0,
      tempChecked: false,
      bandaidIdx: 0,
      booboos: [
        { id: 'cheek_left', dx: -54, dy: -18, healed: false, designId: 'heart_pink', animT: 0 },
        { id: 'arm_right', dx: 62, dy: 38, healed: false, designId: 'star_gold', animT: 0 },
        { id: 'knee_left', dx: -38, dy: 84, healed: false, designId: 'mint_cloud', animT: 0 },
      ],
      flavorIdx: 0,
      dosesGiven: 0,
      dropperFill: 0.85,
      dropperSqueeze: 0,
      medicineAnim: { active: false, t: 0 },
      furTufts: [
        { id: 'crown_left', dx: -38, dy: -82, progress: 0 },
        { id: 'crown_right', dx: 36, dy: -82, progress: 0 },
        { id: 'cheek_ruffle', dx: 56, dy: -12, progress: 0 },
        { id: 'shoulder_ruffle', dx: -58, dy: 44, progress: 0 },
      ],
      brushAnim: 0,
    },
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
    cartItems: ['strawberry', 'kiwi', 'tomato', 'carrot', 'corn', 'watermelon'],
    cartBounce: 0,
    scanFlash: 0,
    drawerOpen: 0,
    drawerTimer: 0,
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
    // Slice 2 (06:00 - 12:00): Ice Cream Parlor, Soft-Serve, Multi-Scoop Cone, Aquarium & Doll Care
    slice2: {
      flavorIdx: 0,
      leverPull: 0,
      softServeTiers: [],
      coneScoops: [],
      algaeSpots: [
        { x: -65, y: -10, r: 22, opacity: 1 },
        { x: 15, y: 28, r: 24, opacity: 1 },
        { x: 75, y: -18, r: 20, opacity: 1 },
      ],
      fishFlakes: [],
      fish: [
        { x: -38, y: 8, vx: 1, color: '#FF8C42', fin: '#FFD166', size: 19 },
        { x: 42, y: -14, vx: -1, color: '#66B2FF', fin: '#BAE0FF', size: 15 },
      ],
      spongeX: -95,
      spongeY: 24,
      shakerTilt: 0,
      dollHappiness: 0.5,
      pacifierIn: false,
      bottleAnim: 0,
      brushAnim: 0,
    },
    // Slice 5 (24:00 - 30:00): Countertop Appliances (Blender, Spring Pop-Up Toaster & Turntable Microwave)
    blenderSpeed: 2,
    toasterState: {
      leverDown: 0,
      toastProgress: 0,
      popJump: 0,
      butterSpread: 0,
      toasting: false,
    },
    microwaveState: {
      running: false,
      progress: 0,
      doorOpen: 0,
      turntableAngle: 0,
    },
    // Station 6 (Slice 6: 30:00 - 36:00): Patisserie Bakery Oven & Cookie Stamper
    slice6: {
      whiskProgress: 0.35,
      whiskAngle: 0,
      whiskVel: 0,
      rollProgress: 0.5,
      stampedShapes: ['star', 'heart', 'bear'],
      activeStampShape: null,
      stampAnim: 0,
      bakeProgress: 0.35,
      ovenDoorOpen: false,
      ovenPulse: 0,
    },
    // Station 7 (Slice 7: 36:00 - 42:00): Bento Box & Savory Meal Builder (Maki, Burger, Whistling Kettle)
    bento: {
      makiRollProgress: 0,
      makiSlices: 0,
      burgerLayers: ['bun_bottom'],
      condiments: [],
      kettleHeat: 0,
      kettleWhistling: false,
      teaPourProgress: 0,
      activeZone: 'sushi',
      knifeAnimT: 0,
      squeezeAnim: null,
    },
    // Slice 3 (12:00 - 18:00, 720-1080s): Ultimate Kitchen Playset Unboxing, Modular Assembly, Battery Sound Module & Circulating Sink
    playsetState: {
      unboxed: true,
      unboxProgress: 1,
      assembledParts: {
        base_case: true,
        battery_bay: true,
        side_wings: true,
        back_hood: true,
        sink_unit: true,
        hanging_utensils: true,
      },
      batteriesInserted: [true, true],
      coverClosed: true,
      soundModuleActive: true,
      snapPulse: 0,
      faucetOn: false,
      pumpPress: 0,
      waterLevel: 0.65,
      soapPumpAnim: 0,
      spongeX: 136,
      spongeY: 16,
      scrubbing: false,
      washItems: [
        { id: 'tomato', kind: 'veggie', x: -58, y: 8, dirt: 0.6, soap: 0.2, clean: 0.2 },
        { id: 'carrot', kind: 'veggie', x: -12, y: 16, dirt: 0.5, soap: 0.3, clean: 0.2 },
        { id: 'strawberry', kind: 'veggie', x: 34, y: 10, dirt: 0.2, soap: 0.4, clean: 0.5 },
        { id: 'plate_pink', kind: 'dish', x: -34, y: -12, dirt: 0.4, soap: 0.4, clean: 0.2 },
        { id: 'cup_mint', kind: 'dish', x: 24, y: -14, dirt: 0.1, soap: 0.2, clean: 0.7 },
      ],
    },
    // Station 3: chef pan toss / dual-burner stove / HT mini oven
    panToss: {
      active: false, t: 0, duration: 0.75, height: 68, spin: 1,
      panDy: 0, panTilt: 0, bodies: [], baseBody: null, plan: [], byItem: null,
    },
    panCatch: 0,
    panCatchVel: 0,
    ovenPulse: 0,
    ovenPulseVel: 0,
    cookNeedleShown: 0,
    dialPulse: 0,
    // Station 4: HT Mini Cakes spinning turntable & decorating
    turntableAngle: 0,
    turntableVel: 0,
    lastTurntableTick: 0,
    cakeStyle: null, // null | 'candy_balls' | 'rainbow_rosettes' — a tool hint, never a pre-built cake
    pipingAnim: { active: false, t: 0, x: 0, y: 0, color: '#FFFDF9', kind: 'piping', squeeze: 0, shake: 0 },
    cakeKnifeAnim: { active: false, t: 0 },
    candyScoopAnim: 0,
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
    // Slice 9 (48:00 - 54:00): Sparkling dishwashing chore & kitchen cleanup
    slice9: {
      chore: 'scrub', // 'scrub' | 'rinse' | 'rack' | 'bins'
      soapPumpPress: 0,
      soapLoaded: 0,
      scrubProgress: 0,
      faucetOn: false,
      faucetFlowAmount: 0,
      rinseProgress: 0,
      stainColors: ['#FF6B8B', '#FFB347', '#8C5230'],
      sudsClusters: [],
      rackItems: [
        { placed: false, pop: 1 },
        { placed: false, pop: 1 },
        { placed: false, pop: 1 },
        { placed: false, pop: 1 },
      ],
      wasteQueue: [],
      activeWaste: null,
      recycleLidOpen: 0,
      trashLidOpen: 0,
      sponge: { x: null, y: null, angle: -0.15, scrubbing: false },
      choresDone: { scrub: false, rinse: false, rack: false, bins: false },
      cleanupFanfarePlayed: false,
    },
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
  const clamp = (v, a, b) => (Number.isFinite(v) ? (v < a ? a : v > b ? b : v) : a);
  const clamp01 = v => (Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0);
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
  function sfx(name, ...args) {
    try {
      if (typeof KitchenAudio !== 'undefined' && KitchenAudio && typeof KitchenAudio[name] === 'function') {
        KitchenAudio[name](...args);
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
      velcroSlices: 0,
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
    return dish.candyBalls.length + dish.rosettes.length + dish.piping.length + dish.toppings.length + dish.sauces.length + (dish.velcroSlices || 0);
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
    const limits = [24, 12, 6, 0];
    for (let lim of limits) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          starsEarned,
          album: lim > 0 ? album.slice(0, lim) : [],
        }));
        break;
      } catch (e) {}
    }
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

  function fryingSmokePuff(x, y, n, layer, dark) {
    const count = Math.min(n || 3, 6);
    for (let i = 0; i < count; i++) {
      spawnParticle({
        x: x + rand(-12, 12), y: y + rand(-4, 4),
        vx: rand(-12, 12), vy: rand(-38, -16),
        g: -14, drag: 1.4, r: rand(4.5, 7.5),
        color: dark ? 'rgba(95, 75, 65, 0.55)' : 'rgba(215, 195, 175, 0.45)',
        kind: 'frying_smoke', life: rand(0.55, 0.95), vrot: rand(-1, 1), layer: layer || 0,
      });
    }
  }

  function sizzleSparkBurst(x, y, n, layer) {
    const count = Math.min(n || 4, 8);
    const cols = ['#FFA726', '#FFD54F', '#FFF3E0', '#FF7043'];
    for (let i = 0; i < count; i++) {
      const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
      const sp = rand(30, 85);
      spawnParticle({
        x: x + rand(-8, 8), y: y + rand(-4, 2),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: 340, drag: 1.8, r: rand(1.5, 2.8),
        color: cols[i % cols.length],
        kind: 'sizzle_spark', glow: true, life: rand(0.12, 0.25), layer: layer || 0,
      });
    }
  }

  function soapyBubblePuff(x, y, n, layer) {
    const count = Math.min(n || 4, 8);
    for (let i = 0; i < count; i++) {
      spawnParticle({
        x: x + rand(-16, 16), y: y + rand(-8, 8),
        vx: rand(-14, 14), vy: rand(-28, -12),
        g: -18, drag: 1.2, r: rand(5, 11),
        color: 'rgba(136, 200, 247, 0.75)',
        kind: 'soapy_bubble', life: rand(0.9, 1.8), vrot: rand(-0.8, 0.8), layer: layer || 0,
      });
    }
  }

  function waterStreamPuff(x, y, vx, vy, n, layer) {
    const count = Math.min(n || 3, 6);
    for (let i = 0; i < count; i++) {
      spawnParticle({
        x: x + rand(-3, 3), y: y + rand(-3, 3),
        vx: (vx || 0) + rand(-8, 8), vy: (vy || 60) + rand(-10, 10),
        g: 280, drag: 0.8, r: rand(2.5, 4.5),
        color: 'rgba(130, 210, 248, 0.75)',
        kind: 'water_stream', life: rand(0.3, 0.55), layer: layer || 0,
      });
    }
  }

  function waterSplashBurst(x, y, n, layer) {
    const count = Math.min(n || 4, 7);
    for (let i = 0; i < count; i++) {
      const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
      const sp = rand(30, 75);
      spawnParticle({
        x: x + rand(-6, 6), y: y + rand(-2, 2),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: 360, drag: 1.5, r: rand(2, 3.8),
        color: 'rgba(125, 210, 250, 0.8)',
        kind: 'water_splash', life: rand(0.25, 0.45), layer: layer || 0,
      });
    }
  }

  function waterRipple(x, y, layer, r) {
    spawnParticle({
      x, y, vx: 0, vy: 0, g: 0, drag: 0,
      r: r || 12, color: 'rgba(130, 215, 250, 0.7)',
      kind: 'water_ripple', life: 0.45, vrot: 0, layer: layer || 0,
    });
  }

  function doughSprinkleBurst(x, y, n, layer) {
    const cols = ['#FF6B8B', '#FFE066', '#70D66B', '#6BA8FF', '#DDA0DD', '#FF9F43'];
    const count = Math.min(n || 6, 10);
    for (let i = 0; i < count; i++) {
      const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
      const sp = rand(20, 60);
      spawnParticle({
        x: x + rand(-8, 8), y: y + rand(-4, 4),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: 260, drag: 1.6, r: rand(3, 4.5),
        rot: rand(0, PI2), vrot: rand(-8, 8),
        color: cols[i % cols.length],
        kind: 'sprinkle', life: rand(0.4, 0.7), layer: layer || 0,
      });
    }
  }

  function flourPuff(x, y, n, layer) {
    const count = Math.min(n || 4, 7);
    for (let i = 0; i < count; i++) {
      spawnParticle({
        x: x + rand(-10, 10), y: y + rand(-4, 4),
        vx: rand(-16, 16), vy: rand(-12, 10),
        g: 40, drag: 2.2, r: rand(3.5, 6),
        color: 'rgba(255, 252, 244, 0.65)',
        kind: 'flour_puff', life: rand(0.35, 0.6), layer: layer || 0,
      });
    }
  }

  function candleSmokePuff(x, y, n, layer) {
    const count = Math.min(n || 4, 6);
    for (let i = 0; i < count; i++) {
      spawnParticle({
        x: x + rand(-5, 5), y: y + rand(-3, 3) - i * 4,
        vx: rand(-6, 6), vy: rand(-28, -14),
        g: -12, drag: 1.3, r: rand(3.5, 6),
        rot: rand(0, PI2), vrot: rand(-3, 3),
        color: 'rgba(145, 130, 120, 0.45)',
        kind: 'candle_smoke', life: rand(0.65, 1.1), layer: layer || 0,
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
        if (p.kind === 'soapy_bubble' && p.y <= H + 80) {
          // Bubble pop burst: 3-4 micro droplets and expanding shimmer ring
          ringPulse(p.x, p.y, 'rgba(136, 200, 247, 0.7)', p.layer, p.r * 1.15);
          juiceBurst(p.x, p.y, 'rgba(180, 225, 255, 0.8)', 'rgba(255, 255, 255, 0.9)', 3, p.layer);
        }
        ps.splice(i, 1);
        continue;
      }
      const fr = Math.exp(-p.drag * dt);
      p.vx *= fr;
      p.vy *= fr;
      p.vy += p.g * dt;
      if (p.kind === 'steam' || p.kind === 'smoke') {
        p.vx += Math.sin(state.t * 3.2 + p.seed) * 38 * dt;
      } else if (p.kind === 'frying_smoke') {
        p.vx += Math.sin(state.t * 4.5 + p.seed) * 52 * dt;
      } else if (p.kind === 'candle_smoke') {
        p.vx += Math.sin(state.t * 3.6 + p.seed) * 44 * dt;
        p.rot += p.vrot * dt;
      } else if (p.kind === 'soapy_bubble') {
        p.vx += Math.sin(state.t * 2.6 + p.seed) * 32 * dt;
      } else if (p.kind === 'water_stream') {
        p.rot = Math.atan2(p.vy, p.vx);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      const k = 1 - p.life / p.maxLife;
      if (p.kind === 'steam' || p.kind === 'smoke') {
        p.scale = 0.55 + k * 1.25;
        p.alpha = k < 0.18 ? k / 0.18 : 1 - easeInQuad(seg(k, 0.35, 1));
      } else if (p.kind === 'frying_smoke') {
        p.scale = 0.6 + k * 1.45;
        p.alpha = k < 0.15 ? k / 0.15 : 1 - easeInQuad(seg(k, 0.3, 1));
      } else if (p.kind === 'candle_smoke') {
        p.scale = 0.5 + k * 1.3;
        p.alpha = k < 0.12 ? k / 0.12 : 1 - easeInCubic(seg(k, 0.28, 1));
      } else if (p.kind === 'soapy_bubble') {
        p.scale = k < 0.1 ? easeOutBack(k / 0.1) : 1;
        p.alpha = k > 0.8 ? 1 - seg(k, 0.8, 1) : 1;
      } else if (p.kind === 'ring' || p.kind === 'water_ripple') {
        p.scale = 0.25 + easeOutCubic(k) * 2.0;
        p.alpha = 1 - k;
      } else if (p.kind === 'flour_puff') {
        p.scale = 0.4 + k * 1.5;
        p.alpha = k < 0.15 ? k / 0.15 : 1 - easeInQuad(seg(k, 0.3, 1));
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
        KitchenArt.star(c, p.x, p.y, sz * 1.4, sz * 0.62, 5, p.rot);
        c.fill();
        c.strokeStyle = '#5C3D2E';
        c.lineWidth = Math.max(1.1, sz * 0.16);
        c.stroke();
        c.fillStyle = '#FFFDF8';
        KitchenArt.circ(c, p.x - sz * 0.28, p.y - sz * 0.3, sz * 0.28);
        c.fill();
        break;
      case 'sparkle':
        KitchenArt.sparkle4(c, p.x, p.y, sz * 1.5, p.rot);
        c.fill();
        c.fillStyle = '#FFFFFF';
        KitchenArt.circ(c, p.x, p.y, sz * 0.35);
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
      case 'steam':
        KitchenArt.circ(c, p.x, p.y, sz * 0.9);
        c.fill();
        KitchenArt.circ(c, p.x - sz * 0.4, p.y + sz * 0.2, sz * 0.6);
        c.fill();
        KitchenArt.circ(c, p.x + sz * 0.4, p.y - sz * 0.2, sz * 0.65);
        c.fill();
        c.fillStyle = 'rgba(255, 255, 255, 0.45)';
        KitchenArt.circ(c, p.x - sz * 0.18, p.y - sz * 0.18, sz * 0.4);
        c.fill();
        break;
      case 'smoke':
      case 'frying_smoke':
        KitchenArt.circ(c, p.x, p.y, sz * 1.3);
        c.fill();
        KitchenArt.circ(c, p.x + sz * 0.3, p.y - sz * 0.3, sz * 0.8);
        c.fill();
        break;
      case 'sizzle_spark':
        KitchenArt.circ(c, p.x, p.y, sz);
        c.fill();
        c.fillStyle = '#FFFDF0';
        KitchenArt.circ(c, p.x - sz * 0.3, p.y - sz * 0.3, sz * 0.4);
        c.fill();
        break;
      case 'soapy_bubble':
        c.fillStyle = 'rgba(225, 242, 254, 0.35)';
        KitchenArt.circ(c, p.x, p.y, sz);
        c.fill();
        c.strokeStyle = p.color || 'rgba(136, 200, 247, 0.75)';
        c.lineWidth = Math.max(1.2, sz * 0.12);
        KitchenArt.circ(c, p.x, p.y, sz);
        c.stroke();
        c.fillStyle = 'rgba(255, 255, 255, 0.85)';
        KitchenArt.circ(c, p.x - sz * 0.35, p.y - sz * 0.35, sz * 0.28);
        c.fill();
        break;
      case 'water_stream':
      case 'water_bead':
        KitchenArt.circ(c, p.x, p.y, sz);
        c.fill();
        c.fillStyle = 'rgba(255, 255, 255, 0.75)';
        KitchenArt.circ(c, p.x - sz * 0.25, p.y - sz * 0.2, sz * 0.35);
        c.fill();
        break;
      case 'water_splash':
        KitchenArt.circ(c, p.x, p.y, sz);
        c.fill();
        c.fillStyle = 'rgba(255, 255, 255, 0.8)';
        KitchenArt.circ(c, p.x - sz * 0.2, p.y - sz * 0.2, sz * 0.3);
        c.fill();
        break;
      case 'water_ripple':
        c.strokeStyle = p.color || 'rgba(130, 215, 250, 0.7)';
        c.lineWidth = Math.max(1.2, 2.2 * p.alpha);
        KitchenArt.ell(c, p.x, p.y, sz * 1.6, sz * 0.65);
        c.stroke();
        break;
      case 'sprinkle':
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        KitchenArt.rr(c, -sz * 1.4, -sz * 0.58, sz * 2.8, sz * 1.15, sz * 0.58);
        c.fill();
        c.strokeStyle = '#5C3D2E';
        c.lineWidth = Math.max(1.1, sz * 0.2);
        c.stroke();
        break;
      case 'flour_puff':
        KitchenArt.circ(c, p.x, p.y, sz);
        c.fill();
        KitchenArt.circ(c, p.x - sz * 0.3, p.y + sz * 0.2, sz * 0.6);
        c.fill();
        break;
      case 'candle_smoke':
        KitchenArt.circ(c, p.x, p.y, sz * 0.9);
        c.fill();
        KitchenArt.circ(c, p.x + sz * 0.25, p.y - sz * 0.5, sz * 0.65);
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
      if (p.kind === 'ring' || p.kind === 'water_ripple') {
        c.globalAlpha = p.alpha;
        c.strokeStyle = p.color;
        c.lineWidth = Math.max(1, (p.lineWidth || 3) * p.alpha);
        if (p.kind === 'water_ripple') {
          KitchenArt.ell(c, p.x, p.y, sz * 1.6, sz * 0.65);
        } else {
          KitchenArt.circ(c, p.x, p.y, sz * 1.6);
        }
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
      } else if (p.kind === 'droplet' || p.kind === 'crumb' || p.kind === 'sprinkle') {
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
      if (Array.isArray(state.cartItems)) {
        state.cartItems.push(meta.id);
        if (state.cartItems.length > 6) state.cartItems.shift();
      }
      state.cartBounce = 1.0;
      sfx('cartItemDrop');
      const isRollable = !!meta.rollable;
      const isStampable = !!meta.stampable;
      boardItem = {
        id: meta.id,
        chops: 0,
        maxChops: meta.crackable ? 2 : ((meta.choppable || isRollable || isStampable) ? 3 : 1),
        sliced: false,
        cracked: false,
        rollable: isRollable,
        stampable: isStampable,
        cookieShapes: [],
      };
      state.boardView = {
        id: meta.id,
        chops: 0,
        maxChops: boardItem.maxChops,
        sliced: false,
        cracked: false,
        choppable: !!(meta.choppable || isRollable || isStampable),
        crackable: !!meta.crackable,
        rollable: isRollable,
        stampable: isStampable,
        landT,
        doneT: -1,
        finishPending: false,
        lastImpactT: -10,
        cookieShapes: [],
      };
      if (isRollable && isStampable) {
        if (!prepTray.some(p => p.id === meta.id)) {
          prepTray.push({
            uid: ++pipelineUid,
            id: meta.id,
            sliced: true,
            cracked: false,
            cooked: 0,
            inMix: false,
            inPan: false,
          });
          syncIngredientToPipeline(meta.id, true, false);
        }
      } else if (!meta.choppable && !meta.crackable) {
        chopBoardItemImpl(false);
      }
    } else if (station === 2) {
      addToMixer(meta.id, false, false, landT);
    } else if (station === 3) {
      addToCooker(meta.id, false, false, landT);
    } else if (station === 4 || station === 7) {
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

  function chopBoardItemImpl(snapLanding, optVector) {
    if (!boardItem) {
      if (prepTray.length === 0) {
        const defaultId = mode === 'wish' ? currentOrder().wantIds[0] : 'strawberry';
        selectIngredient(defaultId);
      }
      if (!boardItem) return;
    }
    const meta = KitchenData.getIngredient(boardItem.id);
    boardItem.chops++;
    const view = state.boardView && state.boardView.id === boardItem.id ? state.boardView : null;
    const usesKnife = !!(meta.choppable || meta.crackable);
    if (snapLanding && view) landBoardFlyerNow(view);

    if (optVector && view) {
      view.cutAngle = optVector.angle;
      view.cutVector = optVector;
    }

    if (boardItem.rollable || boardItem.stampable) {
      const shapes = ['star', 'heart', 'bear'];
      const shapeIdx = Math.min(shapes.length - 1, Math.max(0, boardItem.chops - 1));
      const stampedShape = shapes[shapeIdx];
      if (boardItem.cookieShapes && !boardItem.cookieShapes.includes(stampedShape)) {
        boardItem.cookieShapes.push(stampedShape);
      }
      if (view && view.cookieShapes && !view.cookieShapes.includes(stampedShape)) {
        view.cookieShapes.push(stampedShape);
      }
      if (state.slice6) {
        state.slice6.activeStampShape = stampedShape;
        state.slice6.stampAnim = 1.0;
        state.slice6.rollProgress = Math.min(1, state.slice6.rollProgress + 0.25);
        if (!state.slice6.stampedShapes.includes(stampedShape)) {
          state.slice6.stampedShapes.push(stampedShape);
        }
      }
      sfx('doughRoll', boardItem.chops);
      sfx('cookieStamp', stampedShape);
      const c = stationCenter(station);
      flourPuff(c.x, c.y - 10, 4, 1);
      starBurst(c.x + (shapeIdx - 1) * 36, c.y - 10, ['#FFE29A', '#FFFDF9', '#FF8FA8'], 4, 1);
    } else if (view && usesKnife) {
      if (optVector) {
        startKnifeSlash(view, boardItem.chops, optVector.x, optVector.y, optVector.angle, optVector.velocity);
      } else {
        startKnifeSlash(view, boardItem.chops);
      }
    } else {
      // Liquids & soft goodies: no knife, just a sparkly plop.
      if (meta.liquid) sfx('pour');
      else sfx('chop', boardItem.chops);
      squashImpulse(1.22, 0.82);
      if (view) view.chops = boardItem.chops;
    }

    if (boardItem.chops >= boardItem.maxChops) {
      boardItem.sliced = !!(meta.choppable || meta.rollable || meta.stampable);
      boardItem.cracked = !!meta.crackable;
      const existing = prepTray.find(p => p.id === boardItem.id);
      if (!existing) {
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
      } else {
        existing.sliced = true;
      }
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

  function startKnifeSlash(view, chopIndex, cutX, cutY, cutAngle, velocity) {
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
    // Cut position & angle from swipe gesture or standard cut line
    const centred = view.crackable || !view.choppable;
    ks.cutX = cutX !== undefined ? cutX : (centred ? c.x : c.x - 44);
    ks.cutY = cutY !== undefined ? cutY : (view.crackable ? c.y - 10 : c.y - 6);
    ks.cutAngle = cutAngle !== undefined ? cutAngle : 0.03;
    ks.swipeVelocity = velocity || 1;
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
    const cutAngle = ks.cutAngle !== undefined ? ks.cutAngle : 0.03;
    const cosA = Math.cos(cutAngle), sinA = Math.sin(cutAngle);
    const wind = {
      x: ks.cutX - sinA * 70 + cosA * 24,
      y: ks.cutY - cosA * 70 - sinA * 24,
      angle: cutAngle + 0.55,
    };
    const hit = { x: ks.cutX, y: ks.cutY, angle: cutAngle };
    const reb = {
      x: ks.cutX + cosA * 8,
      y: ks.cutY - sinA * 8 - 14,
      angle: cutAngle + 0.12,
    };
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
    const cutA = ks.cutAngle !== undefined ? ks.cutAngle : 0;
    juiceBurst(ks.cutX, ks.cutY - 8, meta.color, juice, heroChop ? 8 : 14, 1, cutA);
    if (!heroChop) ringPulse(ks.cutX, ks.cutY + 10, 'rgba(255, 253, 249, 0.9)', 1, 14);
    if (meta.crackable) sfx('crackEgg');
    else sfx('chop', ks.targetChops);
    if (view.chops >= view.maxChops) {
      view.sliced = !!meta.choppable;
      view.cracked = !!meta.crackable;
      view.finishPending = false;
      state.scanFlash = 1.0;
      state.drawerTimer = 1.6;
      sfx('scannerBeep');
      sfx('registerDrawer');
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
    const cutAngle = (view.cutAngle !== undefined ? view.cutAngle : 0);
    const nx = Math.cos(cutAngle);
    const ny = Math.sin(cutAngle);

    if (view.chops >= view.maxChops) {
      // Ta-da: every piece fans out evenly before hopping into the basket
      const pieces = Math.min(4, view.chops + 1);
      for (let i = 0; i < pieces; i++) {
        const u = i - (pieces - 1) / 2;
        out.push({
          x: cx + u * 56 * (0.3 + 0.7 * sep) * (Math.abs(nx) > 0.3 ? nx : 1),
          y: cy - 4 - hop * (1 - Math.abs(u) * 0.2) + u * 24 * sep * ny,
          rot: u * 0.17 * sep + cutAngle * 0.4,
          r: 42,
          sliced: true,
        });
      }
      return out;
    }
    // Whole piece shrinks left of the cut line; fresh slices fan to the right along cut normal
    const cutX = cx - 44;
    const remain = 1 - (view.chops / view.maxChops) * 0.5;
    out.push({ x: cutX - 34 * remain, y: cy - 4, rot: 0, r: 58 * remain, sliced: false });
    for (let i = 0; i < view.chops; i++) {
      const newest = i === view.chops - 1;
      const k = newest ? clamp(sep, 0, 1.2) : 1;
      out.push({
        x: cutX + 20 + (16 + i * 44) * k,
        y: cy - 4 - (newest ? hop : 0) + i * 14 * k * ny,
        rot: ((0.08 + i * 0.1) * k) + cutAngle * 0.3,
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
    const item = { id, sliced: !!sliced, cracked: !!cracked, uid: o.uid !== undefined ? o.uid : ++pipelineUid };
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

    // Slice 2 (06:00 - 12:00): Ice Cream Parlor, Aquarium & Doll Care 60fps simulation
    const sl2 = state.slice2;
    if (sl2) {
      sl2.leverPull = Math.max(0, (sl2.leverPull || 0) - dt * 2.4);
      sl2.shakerTilt = Math.max(0, (sl2.shakerTilt || 0) - dt * 2.8);
      sl2.bottleAnim = Math.max(0, (sl2.bottleAnim || 0) - dt * 1.6);
      sl2.brushAnim = Math.max(0, (sl2.brushAnim || 0) - dt * 1.8);
      for (let i = 0; i < sl2.coneScoops.length; i++) {
        const sc = sl2.coneScoops[i];
        sc.sx = 1 + (sc.sx - 1) * Math.exp(-12 * dt);
        sc.sy = 1 + (sc.sy - 1) * Math.exp(-12 * dt);
        sc.dy = (sc.dy || 0) * Math.exp(-14 * dt);
      }
      // Update falling fish food flakes & swimming fish
      for (let i = sl2.fishFlakes.length - 1; i >= 0; i--) {
        const fl = sl2.fishFlakes[i];
        fl.y += (fl.vy || 28) * dt;
        fl.x += Math.sin(state.t * 4 + i) * 14 * dt;
        if (fl.y > 70) sl2.fishFlakes.splice(i, 1);
      }
      for (let i = 0; i < sl2.fish.length; i++) {
        const f = sl2.fish[i];
        if (sl2.fishFlakes.length > 0) {
          const target = sl2.fishFlakes[0];
          const dx = target.x - f.x;
          const dy = target.y - f.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 16) {
            sl2.fishFlakes.shift();
            sfx('aquariumBubble');
            const c2 = stationCenter(2);
            starBurst(c2.x + f.x, c2.y + f.y, ['#FFD166', '#FFFDF9'], 3, 2);
          } else {
            f.vx = dx >= 0 ? 1 : -1;
            f.x = clamp(f.x + (dx / dist) * 58 * dt, -96, 96);
            f.y = clamp(f.y + (dy / dist) * 44 * dt, -36, 52);
          }
        } else {
          f.x += (f.vx || 1) * (24 + i * 6) * dt;
          f.y += Math.sin(state.t * 2.2 + i * 2) * 8 * dt;
          if (f.x > 88) { f.x = 88; f.vx = -1; }
          if (f.x < -88) { f.x = -88; f.vx = 1; }
          f.y = clamp(f.y, -36, 48);
        }
      }
    }
  }

  /* ==========================================================================
   * Slice 2 (06:00 - 12:00): Ice Cream Parlor, Aquarium Cleaning & Doll Care
   * ========================================================================== */
  function getIceCreamFlavors() {
    return (typeof KitchenData !== 'undefined' && KitchenData.ICE_CREAM_FLAVORS) || [
      { id: 'strawberry_swirl', ingredient: 'strawberry', color: '#FF7096', hi: '#FFD1DC' },
      { id: 'vanilla_bean', ingredient: 'milk', color: '#FFF5DC', hi: '#FFFDF9' },
      { id: 'mint_pistachio', ingredient: 'kiwi', color: '#88E0A0', hi: '#D4F7DC' },
      { id: 'choco_fudge', ingredient: 'chocolate', color: '#6B3E26', hi: '#9C6344' },
      { id: 'blueberry_cloud', ingredient: 'blueberry', color: '#78B0FF', hi: '#CFE2FF' },
      { id: 'mango_peach', ingredient: 'orange', color: '#FFB35C', hi: '#FFE4BD' },
    ];
  }

  function dispenseSoftServe(flavorIdx) {
    const sl2 = state.slice2;
    const flavors = getIceCreamFlavors();
    if (typeof flavorIdx === 'number' && Number.isFinite(flavorIdx)) {
      sl2.flavorIdx = clamp(Math.floor(flavorIdx), 0, flavors.length - 1);
    }
    const fl = flavors[sl2.flavorIdx] || flavors[0];
    sl2.leverPull = 1;
    if (sl2.softServeTiers.length >= 5) sl2.softServeTiers.shift();
    sl2.softServeTiers.push({ id: fl.id, color: fl.color, hi: fl.hi, ingredient: fl.ingredient });
    sfx('softServeSwirl');
    squashImpulse(1.12, 0.88);
    // Causal pipeline link: add icecream + flavor ingredient to mixer & dish
    if (!mixItems.some(it => it.id === 'icecream')) addToMixer('icecream', false, false);
    if (fl.ingredient && !mixItems.some(it => it.id === fl.ingredient)) addToMixer(fl.ingredient, true, false);
    mixProgress = Math.min(1, mixProgress + 0.25);
    const c2 = stationCenter(2);
    starBurst(c2.x - 92, c2.y - 12, [fl.color, '#FFFDF9', '#F7C948'], 4, 2);
    refreshDishPalette();
    renderPrimaryActionButton();
    return sl2.softServeTiers.length;
  }

  function stackIceCreamScoop(flavorIdx) {
    const sl2 = state.slice2;
    const flavors = getIceCreamFlavors();
    if (typeof flavorIdx === 'number' && Number.isFinite(flavorIdx)) {
      sl2.flavorIdx = clamp(Math.floor(flavorIdx), 0, flavors.length - 1);
    }
    const fl = flavors[sl2.flavorIdx] || flavors[0];
    if (sl2.coneScoops.length >= 5) sl2.coneScoops.shift();
    const pitch = sl2.coneScoops.length;
    sl2.coneScoops.push({
      id: fl.id,
      color: fl.color,
      hi: fl.hi,
      ingredient: fl.ingredient,
      sx: 1.26,
      sy: 0.76,
      dy: -10,
    });
    sfx('scoopPlop', pitch);
    squashImpulse(1.15, 0.86);
    if (!mixItems.some(it => it.id === 'icecream')) addToMixer('icecream', false, false);
    if (fl.ingredient && !mixItems.some(it => it.id === fl.ingredient)) addToMixer(fl.ingredient, true, false);
    mixProgress = Math.min(1, mixProgress + 0.25);
    const c2 = stationCenter(2);
    starBurst(c2.x + 88, c2.y - sl2.coneScoops.length * 20, [fl.color, '#FFFDF9', '#F7C948'], 5, 2);
    refreshDishPalette();
    renderPrimaryActionButton();
    return sl2.coneScoops.length;
  }

  function cleanAquarium(localX, localY) {
    const sl2 = state.slice2;
    const lx = Number.isFinite(localX) ? clamp(localX, -115, 115) : 0;
    const ly = Number.isFinite(localY) ? clamp(localY, -55, 65) : 0;
    sl2.spongeX = lx;
    sl2.spongeY = ly;
    let scrubbed = false;
    for (let i = 0; i < sl2.algaeSpots.length; i++) {
      const sp = sl2.algaeSpots[i];
      if (sp.opacity > 0 && Math.hypot(sp.x - lx, sp.y - ly) < 58) {
        sp.opacity = Math.max(0, sp.opacity - 0.36);
        scrubbed = true;
      }
    }
    if (!scrubbed) {
      const dirty = sl2.algaeSpots.find(s => s.opacity > 0);
      if (dirty) {
        dirty.opacity = Math.max(0, dirty.opacity - 0.36);
        sl2.spongeX = dirty.x;
        sl2.spongeY = dirty.y;
      }
    }
    sfx('aquariumScrub');
    const c2 = stationCenter(2);
    soapyBubblePuff(c2.x + sl2.spongeX, c2.y + sl2.spongeY, 2, 2);
    mixProgress = Math.min(1, mixProgress + 0.18);
    renderPrimaryActionButton();
    return sl2.algaeSpots.reduce((acc, s) => acc + (1 - s.opacity), 0) / Math.max(1, sl2.algaeSpots.length);
  }

  function feedFishFlakes(localX) {
    const sl2 = state.slice2;
    const baseX = Number.isFinite(localX) ? clamp(localX, -85, 85) : 0;
    sl2.shakerTilt = 0.65;
    const cols = ['#FFB742', '#FF785A', '#78C47C'];
    for (let i = 0; i < 3; i++) {
      if (sl2.fishFlakes.length < 12) {
        sl2.fishFlakes.push({
          x: clamp(baseX + rand(-24, 24), -90, 90),
          y: -48 + rand(-6, 6),
          vy: rand(22, 34),
          color: cols[i % cols.length],
        });
      }
    }
    sfx('flakeDrop');
    squashImpulse(1.08, 0.92);
    mixProgress = Math.min(1, mixProgress + 0.25);
    renderPrimaryActionButton();
    return sl2.fishFlakes.length;
  }

  function careForDoll(action) {
    const sl2 = state.slice2;
    const act = action || 'bottle';
    if (act === 'pacifier') {
      sl2.pacifierIn = !sl2.pacifierIn;
    } else if (act === 'brush') {
      sl2.brushAnim = 1;
    } else {
      sl2.bottleAnim = 1;
      if (!mixItems.some(it => it.id === 'milk')) addToMixer('milk', false, false);
    }
    sl2.dollHappiness = clamp01((sl2.dollHappiness || 0.5) + 0.22);
    sfx('dollCareSoothe', act);
    squashImpulse(1.1, 0.9);
    const c2 = stationCenter(2);
    heartBurst(c2.x, c2.y - 36, 5, 2);
    mixProgress = Math.min(1, mixProgress + 0.28);
    renderPrimaryActionButton();
    return sl2.dollHappiness;
  }

  /* ==========================================================================
   * Station 3: Dual-Burner Stove Top (Boiling Soup Pot & Sizzling Skillet) + Bakery Oven
   * ========================================================================== */
  function addToCooker(id, sliced, cracked, landT, opts) {
    const meta = KitchenData.getIngredient(id);
    const o = opts || {};
    const item = {
      id,
      sliced: sliced !== undefined ? sliced : !!(meta.choppable && id !== 'sausage'),
      cracked: cracked !== undefined ? cracked : !!meta.crackable,
      x: (Math.random() - 0.5) * 85,
      y: (Math.random() - 0.5) * 40,
      uid: o.uid !== undefined ? o.uid : ++pipelineUid,
    };
    panItems.push(item);
    if (landT !== undefined) popIns.set(item, landT);
    else if (!o.transfer) {
      if (id === 'egg') sfx('eggSizzle', heatLevel);
      else if (id === 'sausage') sfx('sausageFlip', heatLevel);
      else sfx('sizzleTick', heatLevel);
    }
    // Direct adds at the stove are new ingredients; transfers already live on the dish.
    if (!o.transfer) addIngredientToDish(id, item.sliced, Math.max(0.65, cookProgress), item.cracked, landT);
  }

  function clickStoveDial(which, level) {
    if (which === 'soup') {
      soupHeatLevel = level >= 1 && level <= 3 ? level : ((soupHeatLevel % 3) + 1);
      sfx('stoveDialClick', soupHeatLevel);
    } else {
      heatLevel = level >= 1 && level <= 3 ? level : ((heatLevel % 3) + 1);
      sfx('stoveDialClick', heatLevel);
    }
    state.dialPulse = 1;
    squashImpulse(1.06, 0.94);
    return which === 'soup' ? soupHeatLevel : heatLevel;
  }

  function stirSoupPot() {
    const c = stationCenter(3);
    cookProgress = Math.min(1.25, cookProgress + 0.16);
    if (!sfx('boilBubble')) sfx('waterSplash', 1);
    squashImpulse(1.06, 0.94);
    steamPuff(c.x - 108, c.y - 18, 4, 3, false);
    waterRipple(c.x - 108, c.y - 4, 3, 18);
    syncCookedStateToDish();
    renderPrimaryActionButton();
  }

  /* ==========================================================================
   * Slice 3 (12:00 - 18:00, 720-1080s): Ultimate Kitchen Playset, Modular
   * Snap Assembly, Battery Sound Module & Running Water Circulating Sink
   * ========================================================================== */
  function setPlaysetMode(m) {
    playsetMode = (m === 'sink') ? 'sink' : 'playset';
    state.playsetMode = playsetMode;
    squashImpulse(1.08, 0.92);
    renderPrimaryActionButton();
    return playsetMode;
  }

  function unboxPlayset() {
    const ps = state.playsetState;
    if (!ps) return false;
    ps.unboxed = true;
    ps.unboxProgress = 1;
    sfx('unboxPop');
    sfx('boxSnap', 1);
    squashImpulse(1.12, 0.88);
    const c = stationCenter(3);
    starBurst(c.x, c.y, ['#FFD166', '#FFE599', '#FFFDF9'], 6, 3);
    renderPrimaryActionButton();
    return true;
  }

  function assemblePlaysetPart(partName) {
    const ps = state.playsetState;
    if (!ps) return false;
    const parts = KitchenData.PLAYSET_PARTS || [
      'base_case', 'battery_bay', 'side_wings', 'back_hood', 'sink_unit', 'hanging_utensils'
    ];
    if (!partName) {
      partName = parts.find(p => !ps.assembledParts[p]);
    }
    if (!partName) return false;
    ps.assembledParts[partName] = true;
    ps.snapPulse = 1.0;
    const partsCount = Object.values(ps.assembledParts).filter(Boolean).length;
    sfx('plasticSnap', partsCount);
    squashImpulse(1.1, 0.9);
    const c = stationCenter(3);
    starBurst(c.x, c.y, ['#7BC4E8', '#FF85A6', '#FFFDF9'], 5, 3);
    if (partsCount >= 6) {
      sfx('batteryChime');
      sfx('sparkle');
    }
    renderPrimaryActionButton();
    return partName;
  }

  function insertPlaysetBattery(slotIdx) {
    const ps = state.playsetState;
    if (!ps) return null;
    if (slotIdx === undefined || slotIdx === null) {
      slotIdx = !ps.batteriesInserted[0] ? 0 : 1;
    }
    slotIdx = clamp(slotIdx, 0, 1);
    ps.batteriesInserted[slotIdx] = true;
    ps.snapPulse = 0.8;
    sfx('batteryInsert', slotIdx);
    squashImpulse(1.08, 0.92);
    const c = stationCenter(3);
    starBurst(c.x + (slotIdx === 0 ? -40 : 10), c.y + 110, ['#FFD166', '#48BFE3'], 4, 3);
    if (ps.batteriesInserted[0] && ps.batteriesInserted[1] && ps.coverClosed) {
      ps.soundModuleActive = true;
      sfx('batteryChime');
      sfx('sparkle');
    }
    renderPrimaryActionButton();
    return slotIdx;
  }

  function togglePlaysetBatteryCover() {
    const ps = state.playsetState;
    if (!ps) return false;
    ps.coverClosed = !ps.coverClosed;
    sfx('plasticSnap', 2);
    squashImpulse(1.06, 0.94);
    if (ps.batteriesInserted[0] && ps.batteriesInserted[1] && ps.coverClosed) {
      ps.soundModuleActive = true;
      sfx('batteryChime');
      sfx('sparkle');
      const c = stationCenter(3);
      starBurst(c.x + 52, c.y + 112, ['#FF85A6', '#FFD166'], 6, 3);
    }
    renderPrimaryActionButton();
    return ps.coverClosed;
  }

  function toggleSinkFaucet(force) {
    const ps = state.playsetState;
    if (!ps) return false;
    ps.faucetOn = force !== undefined ? !!force : !ps.faucetOn;
    ps.pumpPress = 1.0;
    sfx('faucetPump');
    sfx('faucetFlow', ps.faucetOn);
    squashImpulse(1.08, 0.92);
    const c = stationCenter(3);
    if (ps.faucetOn) {
      waterRipple(c.x + 48, c.y - 4, 3, 22);
      waterSplashBurst(c.x + 48, c.y - 4, 5, 3);
    }
    renderPrimaryActionButton();
    return ps.faucetOn;
  }

  function pumpSinkSoap() {
    const ps = state.playsetState;
    if (!ps) return false;
    ps.soapPumpAnim = 1.0;
    sfx('faucetPump');
    squashImpulse(1.08, 0.92);
    const c = stationCenter(3);
    soapyBubblePuff(c.x - 88, c.y - 40, 5, 3);
    (ps.washItems || []).forEach(it => {
      it.soap = Math.min(1.0, (it.soap || 0) + 0.35);
    });
    renderPrimaryActionButton();
    return true;
  }

  function scrubSinkItem(itemId, amt) {
    const ps = state.playsetState;
    if (!ps || !ps.washItems || !ps.washItems.length) return null;
    let item = ps.washItems.find(it => it.id === itemId);
    if (!item) {
      item = ps.washItems.slice().sort((a, b) => (b.dirt || 0) - (a.dirt || 0))[0];
    }
    if (!item) return null;
    const cleanAmt = amt || 0.25;
    item.dirt = Math.max(0, (item.dirt || 0) - cleanAmt);
    if (item.dirt <= 0.05) {
      item.clean = Math.min(1.0, (item.clean || 0) + cleanAmt * 1.5);
    }
    item.soap = Math.max(0, (item.soap || 0) - cleanAmt * 0.5);
    sfx('waterBubble', 2);
    const c = stationCenter(3);
    const ix = c.x + (item.x || 0), iy = c.y + (item.y || 0);
    soapyBubblePuff(ix, iy, 3, 3);
    waterSplashBurst(ix, iy, 2, 3);
    if (item.clean >= 0.95 && !item.sparkled) {
      item.sparkled = true;
      sfx('sparkle');
      starBurst(ix, iy, ['#7BC4E8', '#FFFDF9'], 5, 3);
      if (item.kind === 'veggie' && !dish.items.some(it => it.id === item.id)) {
        addIngredientToDish(item.id, false, 0.8, false);
      }
    }
    renderPrimaryActionButton();
    return item;
  }

  /* Slice 5 (24:00 - 30:00): Countertop Appliance Procedures */
  function setBlenderSpeed(speed) {
    const sp = clamp(Math.round(speed || 2), 1, 3);
    state.blenderSpeed = sp;
    sfx('blenderPulse', sp);
    squashImpulse(1.08, 0.92);
    const c2 = stationCenter(2);
    starBurst(c2.x, c2.y + 60, ['#FFD166', '#FFE599'], 3, 2);
    renderPrimaryActionButton();
    return state.blenderSpeed;
  }

  function pressToasterLever() {
    const ts = state.toasterState;
    ts.leverDown = 1;
    ts.toasting = true;
    ts.toastProgress = Math.max(0.08, ts.toastProgress);
    sfx('toasterLeverDown');
    squashImpulse(1.12, 0.88);
    const c3 = stationCenter(3);
    starBurst(c3.x + 110, c3.y + 20, ['#FF9F1C', '#FFD166'], 4, 3);
    if (!dish.items.some(it => it.id === 'bread')) {
      addToCooker('bread', true, false);
    }
    renderPrimaryActionButton();
    return ts.leverDown;
  }

  function spreadToastButter() {
    const ts = state.toasterState;
    ts.butterSpread = Math.min(1.0, (ts.butterSpread || 0) + 0.35);
    sfx('whiskCream', ts.butterSpread);
    squashImpulse(1.08, 0.94);
    const c3 = stationCenter(3);
    crumbBurst(c3.x - 34, c3.y - 48, '#FFE599', 4, 3);
    crumbBurst(c3.x + 34, c3.y - 48, '#FFE599', 4, 3);
    if (!dish.items.some(it => it.id === 'butter')) {
      addToCooker('butter', true, false);
    }
    syncCookedStateToDish();
    renderPrimaryActionButton();
    return ts.butterSpread;
  }

  function runMicrowave() {
    const ms = state.microwaveState;
    ms.running = !ms.running;
    if (ms.running) {
      sfx('microwaveHum');
      squashImpulse(1.08, 0.92);
      const c3 = stationCenter(3);
      starBurst(c3.x + 96, c3.y + 34, ['#78C47C', '#FFFDF9'], 4, 3);
      if (panItems.length === 0) {
        addToCooker('bread', true, false);
        addToCooker('butter', true, false);
      }
    } else {
      sfx('microwaveDoorClick');
    }
    renderPrimaryActionButton();
    return ms.running;
  }

  function toggleMicrowaveDoor() {
    const ms = state.microwaveState;
    ms.doorOpen = ms.doorOpen > 0.5 ? 0 : 1;
    sfx('microwaveDoorClick');
    squashImpulse(1.06, 0.94);
    renderPrimaryActionButton();
    return ms.doorOpen;
  }

  function flipPan() {
    if (cookMode === 'toaster') {
      const ts = state.toasterState;
      if (ts.toastProgress >= 0.85 || ts.popJump > 0) {
        spreadToastButter();
      } else {
        pressToasterLever();
      }
      return;
    }
    if (cookMode === 'microwave') {
      runMicrowave();
      return;
    }
    if (panItems.length === 0) {
      transferToCooker();
      if (panItems.length === 0) {
        // Nothing prepped or mixed at all: cook the critter's actual order.
        // (Never a hidden chocolate or egg.)
        defaultRecipeIds().forEach(id => {
          const m = KitchenData.getIngredient(id);
          addToCooker(id, !!(m.choppable && id !== 'sausage'), !!m.crackable);
        });
      }
    }
    const c = stationCenter(3);
    if (cookMode === 'oven') {
      cookProgress = Math.min(1.25, cookProgress + 0.35);
      if (!sfx('ovenDing')) sfx('sparkle');
      state.ovenPulseVel += 12;
      squashImpulse(1.06, 0.94);
      steamPuff(c.x, c.y - 70, 3, 3, false);
    } else {
      cookProgress = Math.min(1.25, cookProgress + 0.22);
      startPanToss();
      if (panItems.some(it => it.id === 'sausage')) sfx('sausageFlip', heatLevel);
      else if (panItems.some(it => it.id === 'egg')) sfx('eggSizzle', heatLevel);
      else sfx('sizzleTick', heatLevel);
      fryingSmokePuff(c.x + 68, c.y - 12, 4, 3, cookProgress > 0.85);
      sizzleSparkBurst(c.x + 68, c.y - 2, 5, 3);
      steamPuff(c.x + 68, c.y - 22, 3, 3, false);
    }
    syncCookedStateToDish();
    renderPrimaryActionButton();
  }

  function startPanToss() {
    const pt = state.panToss;
    pt.active = true;
    pt.t = 0;
    pt.duration = 0.68;
    pt.height = 68;
    pt.panDy = -6;
    pt.panTilt = -0.14;
    pt.byItem = new Map();
    pt.plan = panItems.map((it, idx) => ({
      item: it,
      delay: idx * 0.04,
      landed: false,
    }));
    pt.baseBody = computeTossBody(null, 0.05, pt.duration);
    squashImpulse(1.12, 0.88);
    if (!sfx('panToss')) sfx('flip');
  }

  function finishPanTossNow() {
    state.panToss.active = false;
    state.panToss.t = 0;
    state.panToss.panDy = 0;
    state.panToss.panTilt = 0;
    state.panToss.byItem = null;
    state.panToss.baseBody = null;
  }

  function onTossBodyLanded(pl) {
    const c = stationCenter(3);
    sfx('sizzleTick', heatLevel);
    squashImpulse(1.15, 0.85);
    for (let i = 0; i < 4; i++) {
      spawnParticle({
        x: c.x + 68 + rand(-35, 35), y: c.y + rand(-15, 15),
        vx: rand(-20, 20), vy: rand(-30, -10),
        r: rand(1.5, 3), color: '#FFF8E7', kind: 'steam', life: 0.3, layer: 3,
      });
    }
  }

  function computeTossBody(pl, k, dur) {
    if (!state.panToss.active) return { dx: 0, dy: 0, rot: 0, flip: 0, sx: 1, sy: 1, shadow: 1 };
    const pt = state.panToss;
    const u = clamp01(k);
    const arc = Math.sin(u * Math.PI);
    const dy = -arc * pt.height;
    const rot = u * Math.PI * 2;
    const sx = u > 0.88 ? 1 + (1 - u) * 2.2 : 1 + arc * 0.12;
    const sy = u > 0.88 ? 1 - (1 - u) * 1.8 : 1 - arc * 0.12;
    return { dx: Math.sin(u * Math.PI * 2) * 6, dy, rot, flip: u, sx, sy, shadow: Math.max(0.25, 1 - arc * 0.65) };
  }

  function updateCook(dt) {
    if (state.dialPulse > 0) {
      state.dialPulse = Math.max(0, state.dialPulse - dt * 3.5);
    }
    if (state.panToss.active) {
      const pt = state.panToss;
      pt.t += dt / Math.max(0.25, pt.duration || 0.68);
      if (pt.t >= 1) {
        finishPanTossNow();
      } else {
        const flick = Math.sin(clamp01(pt.t / 0.35) * Math.PI);
        pt.panDy = -flick * 10;
        pt.panTilt = -flick * 0.16;
        pt.baseBody = computeTossBody(null, pt.t, pt.duration);
        if (!pt.byItem) pt.byItem = new Map();
        (pt.plan || []).forEach(pl => {
          const k = clamp01((pt.t - (pl.delay || 0)) / Math.max(0.2, 1 - (pl.delay || 0)));
          pt.byItem.set(pl.item, computeTossBody(pl, k, pt.duration));
          if (k >= 0.96 && !pl.landed) {
            pl.landed = true;
            onTossBodyLanded(pl);
          }
        });
      }
    }
    state.cookNeedleShown += (cookProgress - state.cookNeedleShown) * (1 - Math.exp(-7 * dt));

    // Slice 3 (12:00 - 18:00): Playset & Circulating Running Water Sink updates
    if (state.playsetState) {
      const ps = state.playsetState;
      if (ps.snapPulse > 0) {
        ps.snapPulse = Math.max(0, ps.snapPulse - dt * 3.5);
      }
      if (ps.pumpPress > 0) {
        ps.pumpPress = Math.max(0, ps.pumpPress - dt * 2.8);
      }
      if (ps.soapPumpAnim > 0) {
        ps.soapPumpAnim = Math.max(0, ps.soapPumpAnim - dt * 2.5);
      }
      if (ps.unboxProgress !== undefined && ps.unboxProgress < 1 && ps.unboxed) {
        ps.unboxProgress = Math.min(1, ps.unboxProgress + dt * 2.2);
      }
      if (ps.faucetOn) {
        ps.waterLevel = Math.min(0.92, (ps.waterLevel || 0.45) + dt * 0.08);
        if (Math.random() < dt * 16) {
          const c = stationCenter(3);
          spawnParticle({
            x: c.x + 86 + rand(-8, 8),
            y: c.y + 6 + rand(-4, 4),
            vx: rand(-16, 16),
            vy: rand(-32, -10),
            life: 0.35,
            maxLife: 0.35,
            r: rand(2.2, 4.2),
            color: Math.random() < 0.5 ? '#7BC4E8' : '#FFFDF9',
            st: station,
          });
        }
      }
    }

    // Slice 5 (24:00 - 30:00): Toaster & Microwave updates
    if (state.toasterState) {
      const ts = state.toasterState;
      if (ts.popJump > 0) {
        ts.popJump = Math.max(0, ts.popJump - dt * 2.2);
      }
      if (ts.toasting) {
        ts.toastProgress = Math.min(1.0, (ts.toastProgress || 0) + dt * 0.28);
        cookProgress = Math.max(cookProgress, ts.toastProgress);
        if (ts.toastProgress >= 0.88) {
          ts.toasting = false;
          ts.leverDown = 0;
          ts.popJump = 1.0;
          if (!sfx('toasterSpring')) sfx('ovenDing');
          sfx('sparkle');
          squashImpulse(1.15, 0.85);
          const c = stationCenter(3);
          crumbBurst(c.x - 34, c.y - 40, '#D68B38', 5, 3);
          crumbBurst(c.x + 34, c.y - 40, '#D68B38', 5, 3);
          syncCookedStateToDish();
          renderPrimaryActionButton();
        }
      }
    }
    if (state.microwaveState) {
      const ms = state.microwaveState;
      if (ms.running) {
        ms.turntableAngle = (ms.turntableAngle || 0) + dt * 3.4;
        ms.progress = Math.min(1.0, (ms.progress || 0) + dt * 0.24);
        cookProgress = Math.max(cookProgress, ms.progress);
        if (ms.progress >= 1.0) {
          ms.running = false;
          if (!sfx('microwaveBeep')) sfx('ovenDing');
          squashImpulse(1.1, 0.9);
          const c = stationCenter(3);
          steamPuff(c.x - 31, c.y - 10, 5, 3, false);
          syncCookedStateToDish();
          renderPrimaryActionButton();
        }
      }
    }

    if (station === 3 && cookMode === 'pan' && stationVisible(3)) {
      const c = stationCenter(3);
      // Boiling soup pot on left burner (cx - 108, cy + 16): periodic bubble bloop & steam vapor
      boilTimer -= dt;
      if (boilTimer <= 0) {
        boilTimer = Math.max(0.28, 0.72 - soupHeatLevel * 0.14);
        sfx('boilBubble');
        if (Math.random() < 0.65) {
          steamPuff(c.x - 108 + rand(-24, 24), c.y - 16 + rand(-8, 6), 1, 3, false);
        }
      }
    }

    if (station === 3 && panItems.length > 0) {
      cookProgress = Math.min(1.25, cookProgress + dt * 0.045 * heatLevel);
      syncCookedStateToDish();
      sizzleTimer -= dt;
      if (sizzleTimer <= 0) {
        sizzleTimer = 0.22;
        sfx('sizzleTick', heatLevel * 0.35);
      }
      if (stationVisible(3)) {
        const c = stationCenter(3);
        if (cookMode === 'pan') {
          if (Math.random() < dt * 2.8 * heatLevel) {
            sizzleSparkBurst(c.x + 68 + rand(-35, 35), c.y + rand(-15, 15), 1, 3);
          }
          if (Math.random() < dt * 1.8 * heatLevel) {
            fryingSmokePuff(c.x + 68 + rand(-40, 40), c.y + rand(-20, 10), 1, 3, cookProgress > 0.88);
          }
          if (Math.random() < dt * 1.2 * heatLevel) {
            steamPuff(c.x + 68 + rand(-40, 40), c.y + rand(-20, 10), 1, 3, false);
          }
        } else {
          if (Math.random() < dt * 2.2 * heatLevel) {
            spawnParticle({
              x: c.x + rand(-50, 50), y: c.y + rand(-20, 15),
              vx: rand(-6, 6), vy: rand(-25, -12),
              g: -10, drag: 1.2, r: rand(3.5, 6.5),
              color: 'rgba(255, 240, 210, 0.7)',
              kind: 'steam', life: rand(0.6, 1.0), vrot: 0, layer: 3,
            });
          }
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
      if ((cookMode === 'oven' && mode === 'wish' && currentOrder().wantCooking === 'oven') || station === 8) {
        dish.bakedCake = true;
      }
      if (station === 7 || (mode === 'wish' && currentOrder().baseKind === 'bento')) {
        dish.bentoBox = true;
      }
      if (mode === 'wish' && currentOrder().baseKind === 'burger') {
        dish.hasBurger = true;
      }
    } else if (station === 8) {
      dish.bakedCake = true;
    }
    if (station === 7) {
      dish.bentoBox = true;
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
      blownAt: -10,
      dropY: -36, sx: 0.68, sy: 1.35,
      angle: state.turntableAngle,
      face: cc.face, theta: cc.theta, h: cc.h, rad: cc.rad,
      index: dish.toppings.length,
    };
    dish.toppings.push(tp);
    state.toppingSprings.push({
      y: -36, vy: 0,
      scaleX: 0.68, scaleY: 1.35,
      vScaleX: 0, vScaleY: 0,
      landed: false,
    });
    squashImpulse(1.04, 0.96);
    if (topMeta.id === 'candle') {
      const candleCount = dish.toppings.filter(t => t.id === 'candle').length;
      if (!sfx('candleInsert', candleCount - 1)) sfx('sprinkle');
    } else {
      sfx('sprinkle');
    }
    startPipingAnim('topping', lx, ly, tp.color);
    const c4 = stationCenter(station === 8 ? 8 : 4);
    if (topMeta.id === 'sprinkles') {
      doughSprinkleBurst(c4.x + lx * 1.08, c4.y + ly * 1.08, 8, station);
    } else if (topMeta.id === 'candle') {
      starBurst(c4.x + lx * 1.08, c4.y + (ly - 30) * 1.08, ['#FFD54F', '#FFF9C4'], 4, station);
    }
    return tp;
  }

  // Slice 8 (42:00 - 48:00): Interactive Glass Candy Jar Scoop -> scoops rainbow candy balls onto the cake
  function scoopCandyJar(lx, ly) {
    ensureDishHasBase();
    state.candyScoopAnim = 1;
    state.turntableVel += 1.4;
    state.turntableAngle += 0.16;
    dish.turntableAngle = state.turntableAngle;
    const G = KitchenData.CAKE_GEOM;
    const baseA = dish.candyBalls.length * 0.72;
    const cxTarget = Number.isFinite(lx) ? lx : Math.cos(baseA) * G.radius * 0.62;
    const cyTarget = Number.isFinite(ly) ? ly : G.topY + Math.sin(baseA) * G.topRy * 0.62;
    const placed = [];
    for (let i = 0; i < 3; i++) {
      const ox = i === 0 ? 0 : Math.cos(baseA + i * 2.1) * 14;
      const oy = i === 0 ? 0 : Math.sin(baseA + i * 2.1) * 7;
      const b = placeCandyBallAt(clamp(cxTarget + ox, -G.radius * 0.9, G.radius * 0.9), clamp(cyTarget + oy, G.topY - G.topRy * 0.85, G.topY + G.sideHeight * 0.85), false);
      if (b) placed.push(b);
    }
    sfx('candyScoop', dish.candyBalls.length);
    squashImpulse(1.08, 0.93);
    const c4 = stationCenter(station === 8 ? 8 : 4);
    starBurst(c4.x - 192, c4.y - 24, KitchenData.RAINBOW, 5, station);
    refreshDishPalette();
    renderPrimaryActionButton();
    return placed;
  }

  // Slice 8 (42:00 - 48:00): Velcro Birthday Cake Slicing with Musical Knife
  function sliceCakeAt(lx, ly) {
    ensureDishHasBase();
    dish.bakedCake = true;
    dish.velcroSlices = ((dish.velcroSlices || 0) % 6) + 1;
    state.cakeKnifeAnim = { active: true, t: 0 };
    state.turntableVel += 1.65;
    state.turntableAngle += Math.PI / 6;
    dish.turntableAngle = state.turntableAngle;
    squashImpulse(1.14, 0.88);
    if (!sfx('musicalKnife', dish.velcroSlices - 1)) sfx('chop', dish.velcroSlices);
    const c4 = stationCenter(station === 8 ? 8 : 4);
    const sx = c4.x + (Number.isFinite(lx) ? lx : 0) * 0.6;
    const sy = c4.y + (Number.isFinite(ly) ? ly : -18) * 0.6;
    starBurst(sx, sy, ['#FFD166', '#FF85A6', '#7CE0F9'], 6, station);
    doughSprinkleBurst(sx, sy + 8, 5, station);
    refreshDishPalette();
    renderPrimaryActionButton();
    return dish.velcroSlices;
  }

  // Slice 8 (42:00 - 48:00): Blow out birthday candle with curling smoke puff & wish sparkles
  function blowOutCandle(tp) {
    if (!tp || tp.id !== 'candle') return false;
    tp.blownOut = true;
    tp.blownAt = state.t;
    sfx('blowCandle');
    squashImpulse(1.05, 0.96);
    const c4 = stationCenter(station === 8 ? 8 : 4);
    const wx = c4.x + tp.x * 1.08;
    const wy = c4.y + (tp.y - 32) * 1.08;
    candleSmokePuff(wx, wy, 7, station);
    starBurst(wx, wy - 4, ['#F7C948', '#FFE8A3', '#FF94B8'], 5, station);
    renderPrimaryActionButton();
    return true;
  }

  function blowCandles() {
    ensureDishHasBase();
    let count = 0;
    for (const tp of dish.toppings) {
      if (tp.id === 'candle' && !tp.blownOut) {
        blowOutCandle(tp);
        count++;
      }
    }
    return count;
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
        blowOutCandle(tp);
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
    if (decorTool === 'knife') {
      if (!isDrag) {
        return sliceCakeAt(lx, ly);
      }
      return null;
    }
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
        r: rand(2, 3.5), color: placed.color || '#FFFDF9', kind: 'sparkle', life: 0.3, layer: station,
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
    const prevTick = Math.floor(state.turntableAngle / (Math.PI / 7));
    state.turntableAngle += state.turntableVel * dt;
    const nextTick = Math.floor(state.turntableAngle / (Math.PI / 7));
    if (nextTick !== prevTick && Math.abs(state.turntableVel) > 0.15) {
      state.lastTurntableTick = nextTick;
      sfx('turntableClick', Math.abs(nextTick));
    }
    state.turntableVel *= Math.exp(-4.5 * dt);
    if (Math.abs(state.turntableVel) < 0.005) state.turntableVel = 0;
    dish.turntableAngle = state.turntableAngle;
    dish.cakeStyle = state.cakeStyle;

    if (state.cakeKnifeAnim && state.cakeKnifeAnim.active) {
      state.cakeKnifeAnim.t = Math.min(1, state.cakeKnifeAnim.t + dt / 0.44);
      if (state.cakeKnifeAnim.t >= 1) {
        state.cakeKnifeAnim.active = false;
        state.cakeKnifeAnim.t = 0;
      }
    }
    if (state.candyScoopAnim > 0) {
      state.candyScoopAnim = Math.max(0, state.candyScoopAnim - dt * 2.5);
    }

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
  }

  function stepToppingSprings(h) {
    const springs = state.toppingSprings;
    if (!springs || !springs.length) return;
    const kY = 320, dampY = 18;
    const kS = 280, dampS = 16;
    for (let i = 0; i < springs.length; i++) {
      const sp = springs[i];
      if (!sp) continue;
      // Step Y (falls from negative dropY down to 0)
      if (sp.y < 0) {
        sp.vy += 580 * h; // gravity drop
        sp.y += sp.vy * h;
        if (sp.y >= 0) {
          sp.y = 0;
          // Impact squash!
          sp.scaleX = 1.32;
          sp.scaleY = 0.72;
          sp.vScaleX = -sp.scaleX * 6;
          sp.vScaleY = sp.scaleY * 6;
          sp.vy = -sp.vy * 0.28;
          if (!sp.landed) {
            sp.landed = true;
            if (dish.toppings[i]) {
              const tp = dish.toppings[i];
              const c4 = stationCenter(station === 8 ? 8 : 4);
              starBurst(c4.x + tp.x * 1.08, c4.y + tp.y * 1.08, '#FFFDF8', 3, station);
            }
          }
        }
      } else {
        const ay = -kY * sp.y - dampY * sp.vy;
        sp.vy += ay * h;
        sp.y += sp.vy * h;
      }
      // Step scaleX and scaleY towards 1 (underdamped harmonic oscillation)
      const asx = (1 - sp.scaleX) * kS - dampS * sp.vScaleX;
      const asy = (1 - sp.scaleY) * kS - dampS * sp.vScaleY;
      sp.vScaleX += asx * h;
      sp.vScaleY += asy * h;
      sp.scaleX += sp.vScaleX * h;
      sp.scaleY += sp.vScaleY * h;
      if (dish.toppings[i]) {
        dish.toppings[i].dropY = sp.y;
        dish.toppings[i].sx = sp.scaleX;
        dish.toppings[i].sy = sp.scaleY;
      }
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
    squashImpulse(1.06, 0.94);
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
    squashImpulse(1.08, 0.92);
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
      cv.className = 'flying-star-canvas';
      cv.width = size * 2;
      cv.height = size * 2;
      cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:fixed;left:0;top:0;width:' + size + 'px;height:' + size + 'px;' +
        'pointer-events:none;z-index:9999;';
      const c2 = cv.getContext('2d');
      c2.scale(2, 2);
      KitchenArt.drawIcon(c2, 'star', size / 2, size / 2, size * 0.42, 0);
      document.body.appendChild(cv);
      setTimeout(() => { if (cv.parentNode) cv.remove(); }, 2000);
      const midX = (sx + ex) / 2 + 40, midY = Math.min(sy, ey) - 70;
      const half = size / 2;
      const anim = cv.animate([
        { transform: 'translate(' + (sx - half) + 'px,' + (sy - half) + 'px) scale(0.2) rotate(0deg)', opacity: 0 },
        { transform: 'translate(' + (sx - half) + 'px,' + (sy - half - 34) + 'px) scale(1.5) rotate(50deg)', opacity: 1, offset: 0.25 },
        { transform: 'translate(' + (midX - half) + 'px,' + (midY - half) + 'px) scale(1.2) rotate(210deg)', opacity: 1, offset: 0.62 },
        { transform: 'translate(' + (ex - half) + 'px,' + (ey - half) + 'px) scale(0.45) rotate(360deg)', opacity: 0.9 },
      ], { duration: 1150, delay: 350, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'both' });
      anim.onfinish = () => {
        if (cv.parentNode) cv.remove();
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
    document.querySelectorAll('.flying-star-canvas').forEach(el => el.remove());
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

      // Stamp the emotional reaction sticker on the Polaroid snapshot!
      if (KitchenArt && typeof KitchenArt.drawReactionSticker === 'function') {
        KitchenArt.drawReactionSticker(sctx, rxn.kind || 'love', 198, 38, 22, 0);
      }

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
  function setStation(num, force) {
    const prev = station;
    if (!force && !isStationUnlocked(num)) {
      const targetBtn = document.querySelector(`.station-btn[data-station="${num}"]`);
      if (targetBtn) {
        targetBtn.classList.remove('wiggling');
        void targetBtn.offsetWidth;
        targetBtn.classList.add('wiggling');
      }
      sfx('popSelect', 0.5);
      return;
    }
    if (prev === 1 && num !== 1) {
      finishKnifeNow();
      if (boardItem) {
        const bId = boardItem.id;
        const meta = KitchenData.getIngredient(bId);
        const sliced = !!(meta.choppable || meta.rollable || meta.stampable);
        const cracked = !!meta.crackable;
        if (!prepTray.some(p => p.id === bId)) {
          prepTray.push({
            uid: ++pipelineUid,
            id: bId,
            sliced,
            cracked,
            cooked: 0,
            inMix: false,
            inPan: false,
          });
          syncIngredientToPipeline(bId, sliced, cracked);
        }
        boardItem = null;
        state.boardView = null;
      }
    }
    if (prev === 2 && num !== 2) state.whiskHeld = false;
    if (prev === 3 && num !== 3) finishPanTossNow();
    if (prev === 4 && num !== 4) activeStroke = null;
    if (prev === 5 && num !== 5) completeFeedingNow();
    if (fork.dragging) cancelSpoonDrag();
    spoonGrab = null;
    activePointerId = null;
    pointerDown = false;
    station = num;
    state.station = num;
    if (prev !== num) sfx('popSelect', num);
    document.querySelectorAll('.station-btn').forEach(btn => {
      const isAct = Number(btn.dataset.station) === station;
      btn.classList.toggle('active', isAct);
      if (isAct && typeof btn.scrollIntoView === 'function') {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
    const drawer = document.getElementById('ingredientDrawer');
    const decorBar = document.getElementById('decorToolbar');
    if (drawer) drawer.style.display = (station === 1 || station === 2 || station === 4 || station === 6 || station === 7) ? 'flex' : 'none';
    if (decorBar) decorBar.style.display = (station === 8 || station === 4) ? 'flex' : 'none';

    if (station === 2) {
      // The chopped pieces travel from the tray into the glass bowl.
      transferPrepToMixer();
    }
    if (station === 3) {
      // Batter / prepped pieces travel into the oven tin or the mini pan.
      transferToCooker();
    }
    if (station === 8) {
      ensureDishHasBase();
    }
    if (station === 4 || station === 8) {
      prepareDecorTools();
    }
    if (station === 9) {
      initSlice9FromDish();
    }
    if (prev !== num) startStationSlide(prev, num);
    requestAnimationFrame(resize);
    fork.x = W * 0.68;
    fork.y = H * 0.66;
    fork.homeX = W * 0.68;
    fork.homeY = H * 0.66;
    renderPrimaryActionButton();
    renderStationDockIcons();
  }

  function startStationSlide(from, to) {
    if (!canvas) return;
    const tr = state.stationTransition;
    const dir = to > from ? 1 : -1;
    const span = Math.max(320, W * 0.92);
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
    if ((tr.t > 0.22 && Math.abs(state.stationSlideOffset) < 2.0 && Math.abs(state.stationSlideVel) < 25) || tr.t > 0.5) {
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
    Object.keys(artErrors).forEach(k => delete artErrors[k]);
    state.stationTransition.active = false;
    state.stationSlideOffset = 0;
    state.stationSlideVel = 0;
    activePointerId = null;
    pointerDown = false;
    state.whiskHeld = false;
    document.querySelectorAll('.flying-star-canvas').forEach(el => el.remove());
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
    if (state.slice2) {
      state.slice2.leverPull = 0;
      state.slice2.softServeTiers = [];
      state.slice2.coneScoops = [];
      state.slice2.algaeSpots = [
        { x: -65, y: -10, r: 22, opacity: 1 },
        { x: 15, y: 28, r: 24, opacity: 1 },
        { x: 75, y: -18, r: 20, opacity: 1 },
      ];
      state.slice2.fishFlakes = [];
      state.slice2.spongeX = -95;
      state.slice2.spongeY = 24;
      state.slice2.shakerTilt = 0;
      state.slice2.dollHappiness = 0.5;
      state.slice2.pacifierIn = false;
      state.slice2.bottleAnim = 0;
      state.slice2.brushAnim = 0;
    }
    if (state.bento) {
      state.bento.makiRollProgress = 0;
      state.bento.makiSlices = 0;
      state.bento.burgerLayers = ['bun_bottom'];
      state.bento.condiments = [];
      state.bento.kettleHeat = 0;
      state.bento.kettleWhistling = false;
      state.bento.teaPourProgress = 0;
      state.bento.activeZone = 'sushi';
      state.bento.knifeAnimT = 0;
      state.bento.squeezeAnim = null;
    }
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
    if (typeof initSlice9FromDish === 'function') initSlice9FromDish();
    if (nextOrder) {
      orderIdx = (orderIdx + 1) % KitchenData.WISH_ORDERS.length;
    }
    syncModesToOrder();
    renderPrepTrayUI();
    renderCustomerBar();
    renderDecorToolbar();
    setStation(1);
    state.stationTransition.active = false;
    state.stationSlideOffset = 0;
    state.stationSlideVel = 0;
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
    const pBtn = document.getElementById('primaryActionBtn');
    if (!cv) return;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.save();
    c.scale(2, 2); // 64x36 logical

    let leftIcon = 'knife';
    let rightIcon = 'star';
    let isReady = false;
    if (station === 1) {
      if (!boardItem && prepTray.length > 0) {
        leftIcon = 'arrow_right';
        rightIcon = 'scoop';
        isReady = true;
      } else {
        leftIcon = 'knife';
        rightIcon = 'star';
      }
    } else if (station === 2) {
      leftIcon = 'arrow_right';
      rightIcon = 'sink';
      isReady = true;
    } else if (station === 3) {
      leftIcon = 'arrow_right';
      rightIcon = 'pan';
      isReady = true;
    } else if (station === 4) {
      if (cookProgress >= 0.65) {
        leftIcon = 'arrow_right';
        rightIcon = 'blender';
        isReady = true;
      } else {
        leftIcon = cookMode === 'oven' ? 'oven' : 'pan';
        rightIcon = 'star';
      }
    } else if (station === 5) {
      leftIcon = 'arrow_right';
      rightIcon = 'cookie';
      isReady = true;
    } else if (station === 6) {
      leftIcon = 'arrow_right';
      rightIcon = 'sushi';
      isReady = true;
    } else if (station === 7) {
      const b = state.bento || {};
      const readyAdvance = (b.makiSlices >= 4 && b.burgerLayers && b.burgerLayers.includes('bun_top') && b.teaPourProgress >= 0.9);
      leftIcon = readyAdvance ? 'arrow_right' : 'sushi';
      rightIcon = readyAdvance ? 'cupcake' : 'heart';
      isReady = true;
    } else if (station === 8) {
      leftIcon = 'arrow_right';
      rightIcon = 'sparkle';
      isReady = (decorCount() > 0);
    } else if (station === 9) {
      const s9 = state.slice9;
      const allDone = !!(s9 && s9.choresDone && s9.choresDone.scrub && s9.choresDone.rinse && s9.choresDone.rack && s9.choresDone.bins);
      const ch = s9 ? s9.chore : 'scrub';
      leftIcon = allDone ? 'arrow_right' : (ch === 'scrub' ? 'sponge' : ch === 'rinse' ? 'faucet' : ch === 'rack' ? 'drying_rack' : 'recycle_bin');
      rightIcon = allDone ? 'heart' : 'sparkle';
      isReady = true;
    } else if (station === 10) {
      const cl = state.clinic || {};
      const allDone = (cl.heartbeatChecks > 0) && cl.tempChecked &&
                      (cl.booboos && cl.booboos.every(b => b.healed)) &&
                      (cl.dosesGiven > 0) &&
                      (cl.furTufts && cl.furTufts.every(tf => (tf.progress || 0) >= 0.95));
      leftIcon = allDone ? 'sparkle' : (cl.activeTool === 'medicine' ? 'medicine' : 'heart');
      rightIcon = 'star';
      isReady = allDone;
    }

    if (pBtn) {
      pBtn.classList.toggle('ready-advance', isReady);
    }

    KitchenArt.drawIcon(c, leftIcon, 20, 18, 13, t);
    KitchenArt.drawIcon(c, rightIcon, 46, 18, 12, t);
    if (isReady) {
      const spA = t * 3;
      const spR = 12 + Math.sin(t * 4) * 2;
      KitchenArt.drawIcon(c, 'sparkle', 20 + Math.cos(spA) * spR, 18 + Math.sin(spA) * spR * 0.5, 4, t);
    }
    c.restore();
  }

  function getStationSnapTarget(st, pt) {
    if (!pt) return null;
    const c = stationCenter(st);
    const dist = Math.hypot(pt.x - c.x, pt.y - c.y);
    if (dist < 185) {
      return { snapX: c.x, snapY: c.y, dist };
    }
    return null;
  }

  function updateDragFood(h) {
    if (!dragFood || !dragFood.active) return;
    const f = 1 - Math.exp(-28 * h);
    dragFood.x = lerp(dragFood.x || dragFood.targetX, dragFood.targetX, f);
    dragFood.y = lerp(dragFood.y || dragFood.targetY, dragFood.targetY, f);
  }

  /* ==========================================================================
   * 60fps Simulation: tick(dt) + fixed-step spring physics
   * ========================================================================== */
  function physicsStep(h) {
    stepBoardSpring(state.boardSpring, h);
    updateClinic(h);
    updateDragFood(h);
    // Board recoil (px, + = pushed down)
    state.boardRecoilVel += (-state.boardRecoil * 420 - state.boardRecoilVel * 18) * h;
    state.boardRecoil += state.boardRecoilVel * h;
    // Freshly cut slices fan apart with a springy overshoot
    state.sliceSepVel += ((1 - state.sliceSepProgress) * 210 - state.sliceSepVel * 15) * h;
    state.sliceSepProgress += state.sliceSepVel * h;
    // Station 1 shopping cart bounce & checkout register animations
    state.cartBounce = Math.max(0, (state.cartBounce || 0) - h * 2.2);
    state.scanFlash = Math.max(0, (state.scanFlash || 0) - h * 2.4);
    if (state.drawerTimer > 0) {
      state.drawerTimer = Math.max(0, state.drawerTimer - h);
      state.drawerOpen += (1 - state.drawerOpen) * Math.min(1, h * 14);
    } else {
      state.drawerOpen += (0 - state.drawerOpen) * Math.min(1, h * 10);
    }
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
    // Station 6 (Patisserie Bakery Oven & Cookie Stamper) physics
    if (state.slice6) {
      const sl6 = state.slice6;
      sl6.stampAnim = Math.max(0, sl6.stampAnim - h * 3.2);
      sl6.ovenPulse = Math.max(0, sl6.ovenPulse - h * 2.5);
      sl6.whiskAngle += sl6.whiskVel * h;
      sl6.whiskVel *= Math.exp(-3.5 * h);
    }
    // Elastic camera slide (under-damped: ~5% overshoot)
    if (state.stationTransition.active) {
      state.stationSlideVel += (-state.stationSlideOffset * 110 - state.stationSlideVel * 16) * h;
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
    if (typeof updateBento === 'function') updateBento(dt);
    if (typeof updateDishwash === 'function') updateDishwash(dt);
    updateTransition(dt);
  }

  /* ==========================================================================
   * Main Canvas Renderer
   * ========================================================================== */
  /* ==========================================================================
   * Drag-and-Drop Physics & Snapping Targets Across Foods & Utensils
   * ========================================================================== */
  function getStationSnapTarget(stNum, pt) {
    const cx = W * 0.46, cy = H * 0.68;
    if (stNum === 1) {
      if (Math.hypot(pt.x - cx, pt.y - cy) < 185) {
        return { station: 1, x: cx, y: cy, radius: 185, name: 'board', snapX: cx - 44, snapY: cy - 6 };
      }
    } else if (stNum === 2) {
      if (Math.hypot(pt.x - cx, pt.y - cy) < 170) {
        return { station: 2, x: cx, y: cy, radius: 170, name: 'mixer', snapX: cx, snapY: cy + 10 };
      }
    } else if (stNum === 3) {
      if (Math.hypot(pt.x - cx, pt.y - cy) < 185) {
        return { station: 3, x: cx, y: cy, radius: 185, name: 'cooker', snapX: cx, snapY: cy };
      }
    } else if (stNum === 4) {
      if (Math.hypot(pt.x - cx, pt.y - cy) < 150) {
        return { station: 4, x: cx, y: cy, radius: 150, name: 'cake', snapX: pt.x, snapY: pt.y };
      }
    }
    return null;
  }

  function startIngredientDrag(id, source, pt, opts) {
    const o = opts || {};
    dragFood = {
      id,
      source: source || 'shelf',
      prepItem: o.prepItem || null,
      sliced: !!o.sliced,
      x: pt.x,
      y: pt.y,
      targetX: pt.x,
      targetY: pt.y,
      startX: pt.x,
      startY: pt.y,
      lastX: pt.x,
      vx: 0,
      vy: 0,
      rot: 0,
      scale: 1.15,
      squash: 0.9,
      active: true,
      hoverSnap: null,
    };
    sfx('popSelect', 1);
  }

  function updateDragFood(dt) {
    if (!dragFood || !dragFood.active) return;
    const df = dragFood;
    const f = 1 - Math.exp(-24 * dt);
    const px = df.x;
    df.x += (df.targetX - df.x) * f;
    df.y += (df.targetY - df.y) * f;
    df.vx = dt > 0 ? (df.x - px) / dt : 0;
    df.rot = clamp(df.vx * 0.0018, -0.32, 0.32);
    df.scale += (1 - df.scale) * (1 - Math.exp(-12 * dt));
    df.squash += (1 - df.squash) * (1 - Math.exp(-14 * dt));
  }

  function drawSnapTargetHalo(c) {
    if (!dragFood || !dragFood.active || !dragFood.hoverSnap) return;
    const snap = dragFood.hoverSnap;
    c.save();
    const pulse = (state.t * 3.5) % 1;
    c.strokeStyle = 'rgba(232, 131, 136, ' + (0.75 * (1 - pulse * 0.35)) + ')';
    c.lineWidth = 3.5;
    c.setLineDash([8, 6]);
    c.beginPath();
    c.arc(snap.x, snap.y, snap.radius * (0.94 + 0.06 * Math.sin(state.t * 5)), 0, PI2);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(247, 201, 72, 0.7)';
    KitchenArt.drawIcon(c, 'star', snap.snapX, snap.snapY, 16, state.t * 2.5);
    c.restore();
  }

  function drawDragGhost(c) {
    if (!dragFood || !dragFood.active) return;
    const df = dragFood;
    c.save();
    // Drop shadow on kitchen stage
    c.save();
    c.translate(df.x + 3, df.y + 36);
    c.scale(1, 0.42);
    c.fillStyle = 'rgba(92, 61, 46, 0.22)';
    c.beginPath();
    c.arc(0, 0, 32 * df.scale, 0, PI2);
    c.fill();
    c.restore();

    // Floating ingredient sprite with spring tilt
    c.translate(df.x, df.y);
    c.rotate(df.rot);
    c.scale(df.scale * df.squash, df.scale * (2 - df.squash));
    KitchenArt.drawIngredient(c, df.id, 0, 0, 46, { sliced: df.sliced, shadow: true });
    c.restore();
  }

  function draw() {
    if (ctxNeedsReset && typeof ctx.reset === 'function') ctx.reset();
    ctxNeedsReset = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
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
    drawSnapTargetHalo(ctx);
    drawDragGhost(ctx);

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
    else if (st === 2) (typeof renderIceCreamStation === 'function' ? renderIceCreamStation : renderMixStation)(ctx);
    else if (st === 3) (typeof renderPlaysetStation === 'function' ? renderPlaysetStation : renderChopStation)(ctx);
    else if (st === 4) renderCookStation(ctx);
    else if (st === 5) (typeof renderApplianceStation === 'function' ? renderApplianceStation : renderMixStation)(ctx);
    else if (st === 6) (typeof renderBakeryStation === 'function' ? renderBakeryStation : renderCookStation)(ctx);
    else if (st === 7) (typeof renderBentoStation === 'function' ? renderBentoStation : renderCookStation)(ctx);
    else if (st === 8) renderDecorateStation(ctx);
    else if (st === 9) (typeof renderWashStation === 'function' ? renderWashStation : renderChopStation)(ctx);
    else if (st === 10) {
      if (state.clinic && state.clinic.mode === 'feed') (typeof renderFeedStation === 'function' ? renderFeedStation : renderDoctorStation)(ctx);
      else (typeof renderDoctorStation === 'function' ? renderDoctorStation : renderFeedStation)(ctx);
    }
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
    if (slashTrail.length === 0) return;
    slashTrail = slashTrail.filter(pt => t - pt.t < 0.22);
    if (slashTrail.length < 2) return;
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    // Warm pastel outer gleam
    for (let i = 1; i < slashTrail.length; i++) {
      const k = i / (slashTrail.length - 1);
      c.globalAlpha = 0.18 + 0.38 * k;
      c.strokeStyle = '#FFE8B0';
      c.lineWidth = 4 + 10 * k;
      c.beginPath();
      c.moveTo(slashTrail[i - 1].x, slashTrail[i - 1].y);
      c.lineTo(slashTrail[i].x, slashTrail[i].y);
      c.stroke();
    }
    // Bright gouache ivory inner blade arc
    for (let i = 1; i < slashTrail.length; i++) {
      const k = i / (slashTrail.length - 1);
      c.globalAlpha = 0.35 + 0.65 * k;
      c.strokeStyle = '#FFFDF9';
      c.lineWidth = 2 + 6 * k;
      c.beginPath();
      c.moveTo(slashTrail[i - 1].x, slashTrail[i - 1].y);
      c.lineTo(slashTrail[i].x, slashTrail[i].y);
      c.stroke();
    }
    // Star glint at cutting tip
    const tip = slashTrail[slashTrail.length - 1];
    c.globalAlpha = 0.85;
    c.fillStyle = '#FFFDF9';
    KitchenArt.drawIcon(c, 'star', tip.x, tip.y, 8, state.t * 6);
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
    ctx.strokeStyle = KitchenArt.OUTLINE;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Thought bubble pointer circles toward Critter
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = KitchenArt.OUTLINE;
    ctx.lineWidth = 2.4;
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

      const isUsedId = uid => {
        if (!uid) return false;
        for (let i = 0; i < prepTray.length; i++) if (prepTray[i].id === uid) return true;
        for (let i = 0; i < mixItems.length; i++) if (mixItems[i].id === uid) return true;
        for (let i = 0; i < dish.items.length; i++) if (dish.items[i].id === uid) return true;
        return false;
      };

      [0, 1, 2].forEach(idx => {
        const bx = x + 46 + idx * 76;
        const by = y + 82;
        const id = ord.wantIds[idx];
        const done = id ? isUsedId(id) : (decorCount() > 0 || cookProgress >= 0.6);
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

  /* ==========================================================================
   * Station 10 (54:00 - 61:44): Little Doctor Clinic & Plushie Wellness Care
   *  1. Mini Stethoscope Heartbeat Listen (heart chestpiece, ECG pulse wave)
   *  2. Ear Thermometer Beep (probe scan, color wellness bar, 3-beep chime)
   *  3. Band-Aid Sticker Dressing (adhesive wings, sterile pad, boo-boo healing)
   *  4. Medicine Spoon Dropper (amber bottle, calibrated glass pipette, swallow)
   *  5. Pet Grooming Brush (oval wooden pin brush, plushie fur smoothing)
   * ========================================================================== */

  function updateClinic(h) {
    if (!state.clinic) return;
    const cl = state.clinic;
    // Heartbeat pulse decay & sound
    if (cl.listeningHeartbeat) {
      cl.heartbeatPulse = Math.max(0, cl.heartbeatPulse - h * 2.8);
      if (cl.heartbeatPulse < 0.05 && Math.random() < 0.35) {
        cl.heartbeatPulse = 1.0;
        if (typeof KitchenAudio !== 'undefined' && KitchenAudio.heartbeatThump) {
          KitchenAudio.heartbeatThump(0.85);
        }
      }
    } else {
      cl.heartbeatPulse = Math.max(0, cl.heartbeatPulse - h * 3.5);
    }

    // Ear thermometer scanning progress
    if (cl.scanningTemp > 0 && !cl.tempChecked) {
      cl.scanningTemp += h * 0.95;
      if (cl.scanningTemp >= 1.0) {
        cl.scanningTemp = 1.0;
        cl.tempChecked = true;
        if (typeof KitchenAudio !== 'undefined' && KitchenAudio.thermometerBeep) {
          KitchenAudio.thermometerBeep();
        }
        squashImpulse(1.15, 0.88);
        const c10 = stationCenter(10);
        starBurst(c10.x - 54, H * 0.52 - 66, ['#6BCB77', '#A8E6CF'], 6, 0);
        renderPrimaryActionButton();
      }
    }

    // Medicine dropper dispensing animation
    if (cl.medicineAnim && cl.medicineAnim.active) {
      cl.medicineAnim.t += h * 1.5;
      if (cl.medicineAnim.t >= 1.0) {
        cl.medicineAnim.active = false;
        cl.medicineAnim.t = 0;
        cl.dosesGiven = (cl.dosesGiven || 0) + 1;
        cl.dropperFill = Math.max(0.2, (cl.dropperFill || 0.85) - 0.25);
        if (typeof KitchenAudio !== 'undefined' && KitchenAudio.medicineSwallow) {
          KitchenAudio.medicineSwallow();
        }
        state.chewing = 1;
        state.chewTimer = 1.2;
        state.mouthChompT = 0;
        squashImpulse(1.12, 0.9);
        const c10 = stationCenter(10);
        heartBurst(c10.x, H * 0.52 - 4, 4);
        renderPrimaryActionButton();
      }
    }

    // Boo-boo healing animation transitions
    if (cl.booboos) {
      cl.booboos.forEach(b => {
        if (b.healed && b.animT < 1.0) {
          b.animT = Math.min(1.0, b.animT + h * 2.5);
        }
      });
    }

    // Fur brush animation decay
    if (cl.brushAnim > 0) {
      cl.brushAnim = Math.max(0, cl.brushAnim - h * 2.2);
    }
  }

  function setClinicTool(toolId) {
    if (!state.clinic) return;
    const valid = ['stethoscope', 'thermometer', 'bandaid', 'medicine', 'brush'];
    if (valid.indexOf(toolId) >= 0) {
      state.clinic.activeTool = toolId;
      if (typeof KitchenAudio !== 'undefined' && KitchenAudio.clinicCaseSnap) {
        KitchenAudio.clinicCaseSnap();
      }
      squashImpulse(1.08, 0.94);
      renderPrimaryActionButton();
    }
    return state.clinic.activeTool;
  }

  function listenHeartbeat() {
    if (!state.clinic) return;
    const cl = state.clinic;
    cl.listeningHeartbeat = true;
    cl.heartbeatPulse = 1.0;
    cl.heartbeatChecks = (cl.heartbeatChecks || 0) + 1;
    if (typeof KitchenAudio !== 'undefined' && KitchenAudio.heartbeatThump) {
      KitchenAudio.heartbeatThump(0.9);
    }
    squashImpulse(1.14, 0.88);
    const c10 = stationCenter(10);
    heartBurst(c10.x, H * 0.52 + 34, 5);
    renderPrimaryActionButton();
    return cl.heartbeatChecks;
  }

  function checkEarTemperature() {
    if (!state.clinic) return;
    const cl = state.clinic;
    if (cl.scanningTemp <= 0 || cl.tempChecked) {
      cl.scanningTemp = 0.05;
      cl.tempChecked = false;
      if (typeof KitchenAudio !== 'undefined' && KitchenAudio.thermometerScan) {
        KitchenAudio.thermometerScan();
      }
      squashImpulse(1.1, 0.92);
    }
    return cl.tempChecked;
  }

  function applyBandAid(idx) {
    if (!state.clinic || !state.clinic.booboos) return;
    const cl = state.clinic;
    let target = null;
    if (typeof idx === 'number' && cl.booboos[idx]) {
      target = cl.booboos[idx];
    } else {
      target = cl.booboos.find(b => !b.healed);
    }
    if (target) {
      target.healed = true;
      target.animT = 0;
      const designs = KitchenData.BANDAID_DESIGNS || [];
      target.designId = (designs[cl.bandaidIdx % designs.length] || {}).id || 'heart_pink';
      if (typeof KitchenAudio !== 'undefined') {
        if (KitchenAudio.bandaidPeel) KitchenAudio.bandaidPeel();
        if (KitchenAudio.bandaidSnap) KitchenAudio.bandaidSnap();
      }
      squashImpulse(1.15, 0.88);
      const c10 = stationCenter(10);
      starBurst(c10.x + (target.dx || 0), H * 0.52 + (target.dy || 0), ['#FFB5C5', '#FFFDF9'], 5, 0);
      renderPrimaryActionButton();
    }
    return cl.booboos.every(b => b.healed);
  }

  function giveMedicineDrop() {
    if (!state.clinic) return;
    const cl = state.clinic;
    if (!cl.medicineAnim || !cl.medicineAnim.active) {
      cl.medicineAnim = { active: true, t: 0 };
      if (typeof KitchenAudio !== 'undefined') {
        if (KitchenAudio.dropperSqueeze) KitchenAudio.dropperSqueeze();
        if (KitchenAudio.medicineDrop) KitchenAudio.medicineDrop();
      }
      squashImpulse(1.1, 0.92);
    }
    return cl.dosesGiven;
  }

  function brushPlushieFur(idx) {
    if (!state.clinic || !state.clinic.furTufts) return;
    const cl = state.clinic;
    let target = null;
    if (typeof idx === 'number' && cl.furTufts[idx]) {
      target = cl.furTufts[idx];
    } else {
      target = cl.furTufts.find(tf => (tf.progress || 0) < 0.95);
    }
    if (target) {
      target.progress = 1.0;
      cl.brushAnim = 1.0;
      if (typeof KitchenAudio !== 'undefined') {
        if (KitchenAudio.groomBrush) KitchenAudio.groomBrush();
        if (KitchenAudio.groomStroke) KitchenAudio.groomStroke();
      }
      squashImpulse(1.12, 0.9);
      const c10 = stationCenter(10);
      starBurst(c10.x + (target.dx || 0), H * 0.52 + (target.dy || 0), ['#F7C948', '#FFF3B8'], 4, 0);
      renderPrimaryActionButton();
    }
    return cl.furTufts.every(tf => (tf.progress || 0) >= 0.95);
  }

  function performClinicStep(stepName) {
    if (!state.clinic) return;
    const cl = state.clinic;
    if (stepName === 'stethoscope' || (!stepName && (cl.heartbeatChecks || 0) === 0)) {
      setClinicTool('stethoscope');
      listenHeartbeat();
      return 'stethoscope';
    }
    if (stepName === 'thermometer' || (!stepName && !cl.tempChecked)) {
      setClinicTool('thermometer');
      checkEarTemperature();
      return 'thermometer';
    }
    if (stepName === 'bandaid' || (!stepName && cl.booboos && cl.booboos.some(b => !b.healed))) {
      setClinicTool('bandaid');
      applyBandAid();
      return 'bandaid';
    }
    if (stepName === 'medicine' || (!stepName && (cl.dosesGiven || 0) === 0)) {
      setClinicTool('medicine');
      giveMedicineDrop();
      return 'medicine';
    }
    if (stepName === 'brush' || (!stepName && cl.furTufts && cl.furTufts.some(tf => (tf.progress || 0) < 0.95))) {
      setClinicTool('brush');
      brushPlushieFur();
      return 'brush';
    }
    celebrateClinicCompletion();
    return 'celebrate';
  }

  function celebrateClinicCompletion() {
    starsEarned++;
    const sBadge = document.getElementById('starCount');
    if (sBadge && typeof paintCountPips === 'function') {
      paintCountPips(sBadge, starsEarned, '#F7C948');
    }
    startCelebration('love');
    squashImpulse(1.25, 0.82);
    state.clinic = state.clinic || {};
    state.clinic.mode = 'feed';
    renderPrimaryActionButton();
  }

  function renderDoctorStation(c) {
    const cx = W * 0.46, cy = H * 0.68;
    const cl = state.clinic || {};
    const critterCy = H * 0.52;

    if (typeof KitchenArt !== 'undefined' && KitchenArt.drawDoctorStation) {
      KitchenArt.drawDoctorStation(c, cx, cy, {
        activeTool: cl.activeTool || 'stethoscope',
        hoverPt: state.pointer,
        dragging: pointerDown,
        critterCx: cx,
        critterCy: critterCy,
        mouthPt: mouthPoint(),
        furTufts: cl.furTufts,
        booboos: cl.booboos,
        heartbeatChecks: cl.heartbeatChecks,
        listeningHeartbeat: cl.listeningHeartbeat,
        heartbeatPulse: cl.heartbeatPulse,
        scanningTemp: cl.scanningTemp,
        tempChecked: cl.tempChecked,
        flavorIdx: cl.flavorIdx,
        dosesGiven: cl.dosesGiven,
        dropperFill: cl.dropperFill,
        dropperSqueeze: cl.dropperSqueeze,
        medicineAnim: cl.medicineAnim,
        brushAnim: cl.brushAnim,
        bandaidIdx: cl.bandaidIdx,
      }, t);
    }
  }

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
      cartItems: state.cartItems,
      cartBounce: state.cartBounce,
      scanFlash: state.scanFlash,
      drawerOpen: state.drawerOpen,
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

    drawCanvasIconCard(c, 36, cy - 114, 118, 38, mixMode === 'bowl', 'bowl');
    drawCanvasIconCard(c, 36, cy - 70, 118, 38, mixMode === 'blender', 'blender');
    drawCanvasIconCard(c, 36, cy - 26, 118, 38, mixMode === 'icecream', 'icecream');
    drawCanvasIconCard(c, 36, cy + 18, 118, 38, mixMode === 'aquarium', 'aquarium');
    drawCanvasIconCard(c, 36, cy + 62, 118, 38, mixMode === 'dollcare', 'doll');

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
      slice2: state.slice2,
      blenderSpeed: state.blenderSpeed,
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
    const modeIconMap = { blender: 'blender', icecream: 'icecream', aquarium: 'aquarium', dollcare: 'doll' };
    KitchenArt.drawIcon(c, modeIconMap[mixMode] || 'bowl', rx + 64, ry + 24, 15, t);
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
   * Station 3 (Slice 3: 12:00 - 18:00): Ultimate Kitchen Playset & Circulating Sink
   * ========================================================================== */
  function renderPlaysetStation(c) {
    const ctr = stationCenter(3);
    const cx = ctr.x, cy = ctr.y;

    drawCanvasIconCard(c, 36, cy - 48, 118, 42, playsetMode === 'playset', 'playset');
    drawCanvasIconCard(c, 36, cy + 4, 118, 42, playsetMode === 'sink', 'water_stream');

    const s = {
      playsetState: state.playsetState,
      boardSpring: state.boardSpring,
      cookMode: playsetMode,
    };

    if (playsetMode === 'sink') {
      callArt('drawSinkStation', [c, cx, cy, s, t], () => {
        if (typeof KitchenArt.drawSinkStation === 'function') {
          KitchenArt.drawSinkStation(c, cx, cy, s, t);
        }
      });
    } else {
      callArt('drawPlaysetStation', [c, cx, cy, s, t], () => {
        if (typeof KitchenArt.drawPlaysetStation === 'function') {
          KitchenArt.drawPlaysetStation(c, cx, cy, s, t);
        }
      });
    }
  }

  /* ==========================================================================
   * Station 4: Enameled Cast-Iron Skillet & French Patisserie Oven
   * ========================================================================== */
  function renderCookStation(c) {
    const ctr = stationCenter(3);
    const cx = ctr.x, cy = ctr.y;

    drawCanvasIconCard(c, 36, cy - 110, 118, 34, cookMode === 'pan', 'pan');
    drawCanvasIconCard(c, 36, cy - 72, 118, 34, cookMode === 'oven', 'oven');
    drawCanvasIconCard(c, 36, cy - 34, 118, 34, cookMode === 'toaster', 'toaster');
    drawCanvasIconCard(c, 36, cy + 4, 118, 34, cookMode === 'microwave', 'microwave');
    drawCanvasIconCard(c, 36, cy + 42, 118, 34, cookMode === 'playset', 'playset');
    drawCanvasIconCard(c, 36, cy + 80, 118, 34, cookMode === 'sink', 'water_stream');

    if (cookMode === 'pan') {
      [1, 2, 3].forEach(lvl => {
        const active = heatLevel === lvl;
        const bx = 36 + (lvl - 1) * 40, by = cy + 88;
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
      toasterState: state.toasterState,
      microwaveState: state.microwaveState,
      heatLevel,
      soupHeatLevel,
      dialPulse: state.dialPulse,
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
      playsetState: state.playsetState,
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
      c.fillStyle = 'rgba(92, 61, 46, 0.22)';
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
        c.fillStyle = 'rgba(92, 61, 46, 0.2)';
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
    const ctr = stationCenter(station === 8 ? 8 : 4);
    const cx = ctr.x, cy = ctr.y;
    // Left sub-tool cards for Slice 8: Candy Jar Scoop, Rosettes, Birthday Candle, Musical Velcro Cake Knife
    const topMetaSel = KitchenData.TOPPINGS[toppingIdx] || KitchenData.TOPPINGS[0];
    const cardA = decorTool === 'topping' && topMetaSel.id === 'candy_balls';
    const cardB = decorTool === 'piping';
    const cardC = decorTool === 'topping' && topMetaSel.id === 'candle';
    const cardD = decorTool === 'knife';
    drawCanvasIconCard(c, 36, cy - 78, 118, 40, cardA, 'candy_jar');
    drawCanvasIconCard(c, 36, cy - 30, 118, 40, cardB, 'rosette');
    drawCanvasIconCard(c, 36, cy + 18, 118, 40, cardC, 'candle');
    drawCanvasIconCard(c, 36, cy + 66, 118, 40, cardD, 'cake_knife');

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
      station: station === 8 ? 8 : 4,
      dish,
      decorTool,
      selectedTopping: topMetaSel.id,
      selectedToppingIngredient: topMetaSel.ingredient || null,
      cakeStyle: state.cakeStyle,
      turntableAngle: state.turntableAngle,
      cakeKnifeAnim: state.cakeKnifeAnim,
      candyScoopAnim: state.candyScoopAnim,
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
   * Station 6 (Slice 6: 30:00 - 36:00): Patisserie Bakery Oven & Cookie Stamper
   * ========================================================================== */
  function renderBakeryStation(c) {
    const ctr = stationCenter(6);
    const cx = ctr.x, cy = ctr.y;
    const sl6 = state.slice6;
    const cookIds = panItems.length ? panItems.map(it => it.id) : (mixItems.length ? mixItems.map(it => it.id) : prepTray.map(p => p.id));
    const cookPal = KitchenData.paletteFor(cookIds);
    const s = {
      station: 6,
      patisserieWhisk: sl6.whiskProgress,
      mixSwirlAngle: sl6.whiskAngle,
      patisserieRoll: sl6.rollProgress,
      cookieShapes: sl6.stampedShapes,
      activeStampShape: sl6.activeStampShape,
      stampAnim: sl6.stampAnim,
      patisserieBake: sl6.bakeProgress,
      ovenDoorOpen: sl6.ovenDoorOpen,
      batterTint: cookIds.length ? cookPal.batterTint : (mixItems.length ? mixColor : '#FFF3C4'),
      layerColors: cookIds.length ? cookPal.layerColors : [],
      ovenPulse: sl6.ovenPulse,
      boardSpring: state.boardSpring,
    };
    callArt('drawPatisserieStation', [c, cx, cy, s, t], () => fallbackBakeryStation(c, cx, cy, s));
  }
  const renderPatisserieStation = renderBakeryStation;

  function fallbackBakeryStation(c, cx, cy, s) {
    c.save();
    // Warm pastry board
    c.fillStyle = '#EABFA0';
    c.strokeStyle = KitchenArt.OUTLINE;
    c.lineWidth = 3.4;
    KitchenArt.ell(c, cx - 18, cy + 18, 96, 50);
    c.fill();
    c.stroke();
    // Dough sheet
    c.fillStyle = '#FFF1C2';
    KitchenArt.ell(c, cx - 24, cy + 19, 64, 30);
    c.fill();
    c.stroke();
    // Stamped cookies
    const shapes = ['star', 'heart', 'bear'];
    shapes.forEach((shp, idx) => {
      KitchenArt.drawStampedCookie(c, cx - 44 + idx * 32, cy + 52, 14, shp, s.patisserieBake * 0.4);
    });
    // Mini oven
    KitchenArt.rr(c, cx + 70, cy - 88, 192, 160, 24);
    c.fillStyle = '#C8E6D8';
    c.fill();
    c.stroke();
    c.restore();
  }

  function whiskPatisserieBatter(amt) {
    const sl6 = state.slice6;
    const a = amt || 0.18;
    sl6.whiskProgress = clamp01(sl6.whiskProgress + a);
    sl6.whiskVel += 14;
    sl6.whiskAngle += 1.5;
    mixProgress = Math.min(1, mixProgress + a * 0.8);
    sfx('whiskMix', Math.floor(sl6.whiskProgress * 4));
    squashImpulse(1.08, 0.93);
    if (!mixItems.some(it => it.id === 'dough')) addToMixer('dough', false, false);
    if (!mixItems.some(it => it.id === 'milk')) addToMixer('milk', false, false);
    const ctr = stationCenter(6);
    starBurst(ctr.x - 188, ctr.y + 16, ['#FFFDF9', '#FFE08A', '#78C47C'], 3, 6);
    renderPrimaryActionButton();
    return sl6.whiskProgress;
  }

  function rollPatisserieDough(amt) {
    const sl6 = state.slice6;
    const a = amt || 0.2;
    sl6.rollProgress = clamp01(sl6.rollProgress + a);
    sfx('doughRoll', Math.floor(sl6.rollProgress * 3));
    squashImpulse(1.12, 0.9);
    const ctr = stationCenter(6);
    flourPuff(ctr.x - 18, ctr.y + 18, 3, 6);
    if (!dish.items.some(it => it.id === 'dough')) {
      addIngredientToDish('dough', false, 0, false);
    }
    renderPrimaryActionButton();
    return sl6.rollProgress;
  }

  function stampPatisserieCookie(shape) {
    const sl6 = state.slice6;
    const shp = ['star', 'heart', 'bear'].includes(shape) ? shape : 'star';
    sl6.activeStampShape = shp;
    sl6.stampAnim = 1.0;
    if (!sl6.stampedShapes.includes(shp)) {
      sl6.stampedShapes.push(shp);
    }
    sfx('cookieStamp', shp);
    squashImpulse(1.18, 0.86);
    const ctr = stationCenter(6);
    const sIdx = ['star', 'heart', 'bear'].indexOf(shp);
    starBurst(ctr.x - 18 - 52 + sIdx * 52, ctr.y + 18 - 10, ['#FFE29A', '#FFFDF9', '#FF8FA8'], 5, 6);
    if (!prepTray.some(p => p.id === 'dough')) {
      prepTray.push({
        uid: ++pipelineUid,
        id: 'dough',
        sliced: true,
        cracked: false,
        cooked: 0,
        inMix: false,
        inPan: false,
      });
      syncIngredientToPipeline('dough', true, false);
      renderPrepTrayUI();
    } else {
      const p = prepTray.find(it => it.id === 'dough');
      if (p) p.sliced = true;
    }
    renderPrimaryActionButton();
    return sl6.stampedShapes.length;
  }

  function togglePatisserieOvenDoor() {
    const sl6 = state.slice6;
    sl6.ovenDoorOpen = !sl6.ovenDoorOpen;
    sfx('ovenDoor', sl6.ovenDoorOpen);
    squashImpulse(1.06, 0.94);
    return sl6.ovenDoorOpen;
  }

  function bakePatisserieCookies(amt) {
    const sl6 = state.slice6;
    const a = amt || 0.25;
    const wasDone = sl6.bakeProgress >= 1;
    sl6.bakeProgress = clamp01(sl6.bakeProgress + a);
    sl6.ovenPulse = 1.0;
    sfx('ovenBakeTick', sl6.bakeProgress);
    squashImpulse(1.08, 0.92);
    const ctr = stationCenter(6);
    steamPuff(ctr.x + 166, ctr.y - 70, 3, 6, false);
    cookProgress = Math.max(cookProgress, sl6.bakeProgress);
    syncCookedStateToDish();
    if (sl6.bakeProgress >= 1 && !wasDone) {
      sfx('sparkle');
      starBurst(ctr.x + 166, ctr.y - 4, ['#F7C948', '#FFF3B8', '#FF8FA8'], 8, 6);
    }
    renderPrimaryActionButton();
    return sl6.bakeProgress;
  }

  /* ==========================================================================
   * Station 7 (Slice 7: 36:00 - 42:00): Bento Box & Savory Meal Builder (Maki, Burger, Whistling Kettle)
   * ========================================================================== */
  function renderBentoStation(c) {
    const ctr = stationCenter(7);
    const cx = ctr.x, cy = ctr.y;
    const s = {
      station: 7,
      dish,
      bento: state.bento,
      boardSpring: state.boardSpring,
    };
    callArt('drawBentoStation', [c, cx, cy, s, t], () => fallbackBentoStation(c, cx, cy, s));
  }

  function fallbackBentoStation(c, cx, cy, s) {
    if (KitchenArt && typeof KitchenArt.drawBentoStation === 'function') {
      KitchenArt.drawBentoStation(c, cx, cy, s, t);
    }
  }

  function advanceBentoSushi() {
    const b = state.bento;
    if (!b) return;
    b.activeZone = 'sushi';
    const ctr = stationCenter(7);
    const sushiX = ctr.x - 168, sushiY = ctr.y + 20;

    if (b.makiRollProgress < 1) {
      b.makiRollProgress = Math.min(1, (b.makiRollProgress || 0) + 0.34);
      sfx('sushiRoll');
      squashImpulse(1.08, 0.92);
      starBurst(sushiX, sushiY, ['#78C47C', '#FFFDF9', '#4E6A3B'], 4, 7);
      if (b.makiRollProgress >= 1) {
        sfx('bentoBoxSnap');
        starBurst(sushiX, sushiY, KitchenData.RAINBOW, 6, 7);
      }
    } else if (b.makiSlices < 4) {
      b.knifeAnimT = 1.0;
      b.makiSlices = (b.makiSlices || 0) + 1;
      sfx('sushiSlice');
      squashImpulse(1.06, 0.94);
      const sliceOffset = -24 + (b.makiSlices - 1) * 16;
      starBurst(sushiX + sliceOffset, sushiY, ['#F7C948', '#FF8FA8', '#FFFDF9'], 5, 7);
      if (b.makiSlices >= 4) {
        addIngredientToDish('maki', true, 0.85);
        dish.bentoBox = true;
        sfx('bentoBoxSnap');
        starBurst(sushiX, sushiY, KitchenData.RAINBOW, 8, 7, true);
        b.activeZone = 'burger';
      }
    }
    renderPrimaryActionButton();
  }

  function advanceBentoBurger(layerType) {
    const b = state.bento;
    if (!b) return;
    b.activeZone = 'burger';
    const ctr = stationCenter(7);
    const burgerX = ctr.x, burgerY = ctr.y + 16;
    if (!Array.isArray(b.burgerLayers)) b.burgerLayers = ['bun_bottom'];

    const fullLayers = ['bun_bottom', 'lettuce', 'tomato', 'beef', 'cheese', 'bun_top'];
    if (layerType && !b.burgerLayers.includes(layerType)) {
      b.burgerLayers.push(layerType);
    } else if (b.burgerLayers.length < fullLayers.length) {
      b.burgerLayers.push(fullLayers[b.burgerLayers.length]);
    } else {
      // Re-cap or squirt condiment
      b.squeezeAnim = { color: '#E3392B', side: -1, t: 0, duration: 0.35 };
      if (!Array.isArray(b.condiments)) b.condiments = [];
      b.condiments.push('#E3392B');
      sfx('condimentSquirt');
      starBurst(burgerX, burgerY - 24, ['#E3392B', '#FFFDF9'], 4, 7);
      return;
    }

    sfx('burgerStack', b.burgerLayers.length);
    squashImpulse(1.08, 0.92);
    starBurst(burgerX, burgerY - b.burgerLayers.length * 8, ['#D48C56', '#F5C422', '#E8998D'], 5, 7);

    if (b.burgerLayers.includes('bun_top')) {
      addIngredientToDish('bun', false, 0.9);
      dish.hasBurger = true;
      sfx('bentoBoxSnap');
      starBurst(burgerX, burgerY, KitchenData.RAINBOW, 8, 7, true);
      b.activeZone = 'kettle';
    }
    renderPrimaryActionButton();
  }

  function advanceBentoKettle(action) {
    const b = state.bento;
    if (!b) return;
    b.activeZone = 'kettle';
    const ctr = stationCenter(7);
    const kettleX = ctr.x + 168, kettleY = ctr.y + 16;

    if (action === 'pour' || ((b.kettleHeat >= 0.8 || b.kettleWhistling) && action !== 'heat')) {
      // Pour tea
      b.teaPourProgress = Math.min(1, (b.teaPourProgress || 0) + 0.35);
      sfx('teaPour');
      squashImpulse(1.06, 0.94);
      steamPuff(kettleX + 44, kettleY - 12, 3, 7, false);
      starBurst(kettleX + 44, kettleY, ['#7CE0F9', '#FFFDF9', '#A8D5BA'], 5, 7);

      if (b.teaPourProgress >= 0.95) {
        addIngredientToDish('kettle_tea', true, 0.75);
        dish.hasTea = true;
        sfx('bentoBoxSnap');
        starBurst(kettleX + 44, kettleY, KitchenData.RAINBOW, 10, 7, true);
      }
    } else {
      // Heat kettle
      b.kettleHeat = Math.min(1, (b.kettleHeat || 0) + 0.35);
      sfx('popSelect', 2);
      steamPuff(kettleX - 44, kettleY - 36, 3, 7, false);
      starBurst(kettleX - 18, kettleY + 36, ['#FF9F1C', '#FFD166'], 4, 7);

      if (b.kettleHeat >= 0.85 && !b.kettleWhistling) {
        b.kettleWhistling = true;
        sfx('kettleWhistle');
        steamPuff(kettleX - 44, kettleY - 36, 6, 7, false);
        starBurst(kettleX - 44, kettleY - 36, ['#FFFDF9', '#7CE0F9'], 6, 7);
      }
    }
    renderPrimaryActionButton();
  }

  function updateBento(dt) {
    const b = state.bento;
    if (!b) return;
    if (b.knifeAnimT > 0) {
      b.knifeAnimT -= dt * 3.5;
      if (b.knifeAnimT < 0) b.knifeAnimT = 0;
    }
    if (b.squeezeAnim) {
      b.squeezeAnim.t += dt;
      if (b.squeezeAnim.t >= b.squeezeAnim.duration) {
        b.squeezeAnim = null;
      }
    }
    if (station === 7 && b.kettleWhistling) {
      const ctr = stationCenter(7);
      const kettleX = ctr.x + 168, kettleY = ctr.y + 16;
      if (Math.random() < 0.15) {
        steamPuff(kettleX - 44 + (Math.random() - 0.5) * 6, kettleY - 36, 1, 7, false);
      }
    }
  }

  /* ==========================================================================
   * Station 9: Sparkling Dishwashing Chore & Kitchen Cleanup (48:00 - 54:00)
   * ========================================================================== */
  function initSlice9FromDish() {
    const s9 = state.slice9;
    if (!s9) return;
    const colors = [];
    if (dish && Array.isArray(dish.layerColors) && dish.layerColors.length > 0) {
      dish.layerColors.forEach(c => { if (c) colors.push(c); });
    }
    const ingIds = dishIngredientIds();
    if (colors.length === 0 && ingIds.length > 0 && typeof KitchenData !== 'undefined') {
      ingIds.forEach(id => {
        const item = (KitchenData.INGREDIENTS || []).find(i => i.id === id);
        if (item && item.color) colors.push(item.color);
      });
    }
    s9.stainColors = colors.length > 0 ? colors : ['#FF6B8B', '#FFB347', '#8C5230', '#72B043'];

    let wasteDefs = [];
    if (typeof KitchenData !== 'undefined' && typeof KitchenData.cleanupItemsForIds === 'function') {
      wasteDefs = KitchenData.cleanupItemsForIds(ingIds);
    }
    if (!wasteDefs || wasteDefs.length === 0) {
      wasteDefs = [
        { id: 'strawberry_leaves', type: 'trash', icon: 'compost' },
        { id: 'egg_shells', type: 'trash', icon: 'compost' },
        { id: 'milk_carton', type: 'recycle', icon: 'recycle_bin' },
        { id: 'tin_can', type: 'recycle', icon: 'recycle_bin' },
      ];
    }
    s9.wasteQueue = wasteDefs.map(w => Object.assign({}, w, { sorted: false, x: null, y: null }));

    s9.rackItems = [
      { placed: false, pop: 1 },
      { placed: false, pop: 1 },
      { placed: false, pop: 1 },
      { placed: false, pop: 1 },
    ];
    s9.activeWaste = null;
    s9.soapPumpPress = 0;
    s9.soapLoaded = 0;
    s9.scrubProgress = 0;
    s9.rinseProgress = 0;
    s9.faucetOn = false;
    s9.faucetFlowAmount = 0;
    s9.recycleLidOpen = 0;
    s9.trashLidOpen = 0;
    s9.sponge = { x: null, y: null, angle: -0.15, scrubbing: false };
    s9.choresDone = { scrub: false, rinse: false, rack: false, bins: false };
    s9.cleanupFanfarePlayed = false;
    s9.chore = 'scrub';
  }

  function pumpSoap() {
    const s9 = state.slice9;
    if (!s9) return;
    s9.soapPumpPress = 1.0;
    s9.soapLoaded = Math.min(1, s9.soapLoaded + 0.35);
    sfx('soapPump');
    const ctr = stationCenter(9);
    soapyBubblePuff(ctr.x - 214, ctr.y - 40, 5, 9);
    squashImpulse(1.08, 0.92);
  }

  function toggleFaucet(forceVal) {
    const s9 = state.slice9;
    if (!s9) return;
    s9.faucetOn = (forceVal !== undefined) ? !!forceVal : !s9.faucetOn;
    const ctr = stationCenter(9);
    if (s9.faucetOn) {
      sfx('faucetFlow', true);
      waterStreamPuff(ctr.x - 56, ctr.y - 40, 0, 140, 6, 9);
    } else {
      sfx('faucetFlow', false);
    }
  }

  function scrubDish(amount, pt) {
    const s9 = state.slice9;
    if (!s9) return;
    if (s9.soapLoaded <= 0.05) s9.soapLoaded = 0.25;
    const amt = amount || 0.08;
    s9.scrubProgress = clamp01(s9.scrubProgress + amt);
    sfx('spongeScrub', Math.round(s9.scrubProgress * 8));
    const ctr = stationCenter(9);
    const px = pt ? pt.x : (ctr.x - 92);
    const py = pt ? pt.y : (ctr.y + 20);
    soapyBubblePuff(px, py, 3, 9);
    if (Math.random() < 0.32) {
      sfx('sudsBubblePop', Math.round(s9.scrubProgress * 6));
    }
    if (s9.scrubProgress >= 0.88 && !s9.choresDone.scrub) {
      s9.choresDone.scrub = true;
      sfx('dishSqueak');
      starBurst(ctr.x - 92, ctr.y + 20, ['#FFD166', '#FFFFFF'], 6, 9);
      checkAllChoresDone();
    }
  }

  function rinseDish(amount) {
    const s9 = state.slice9;
    if (!s9) return;
    const amt = amount || 0.08;
    s9.rinseProgress = clamp01(s9.rinseProgress + amt);
    sfx('rinseSwirl', Math.round(s9.rinseProgress * 8));
    const ctr = stationCenter(9);
    waterSplashBurst(ctr.x - 92, ctr.y + 20, 3, 9);
    if (s9.rinseProgress >= 0.88 && !s9.choresDone.rinse) {
      s9.choresDone.rinse = true;
      sfx('squeakyClean');
      starBurst(ctr.x - 92, ctr.y + 20, ['#7CE0F9', '#FFFFFF', '#FFD166'], 8, 9);
      checkAllChoresDone();
    }
  }

  function placeRackDish(slotIdx) {
    const s9 = state.slice9;
    if (!s9) return;
    let idx = slotIdx;
    if (idx === undefined || idx === null || idx < 0 || idx >= 4) {
      idx = s9.rackItems.findIndex(it => !it.placed);
    }
    if (idx < 0 || idx >= 4) return;
    s9.rackItems[idx].placed = true;
    s9.rackItems[idx].pop = 1.35;
    sfx('rackPlace', idx);
    sfx('waterDrip');
    const ctr = stationCenter(9);
    const slots = (KitchenData && KitchenData.DRYING_RACK_SLOTS) || [];
    const sl = slots[idx] || { slotX: -75 + idx * 50, slotY: -10 };
    starBurst(ctr.x + 148 + (sl.slotX || 0), ctr.y - 42 + (sl.slotY || 0), '#FFD166', 5, 9);
    if (s9.rackItems.every(it => it.placed) && !s9.choresDone.rack) {
      s9.choresDone.rack = true;
      sfx('plateStack', 4);
      starBurst(ctr.x + 148, ctr.y - 42, ['#F7C948', '#FFB347'], 8, 9);
      checkAllChoresDone();
    }
  }

  function sortWasteItem(wasteIdx, optBinId) {
    const s9 = state.slice9;
    if (!s9 || s9.activeWaste) return;
    let idx = wasteIdx;
    if (idx === undefined || idx === null || idx < 0) {
      idx = s9.wasteQueue.findIndex(w => !w.sorted);
    }
    if (idx < 0 || idx >= s9.wasteQueue.length) return;
    const item = s9.wasteQueue[idx];
    if (item.sorted) return;

    item.sorted = true;
    const targetBin = optBinId || item.type || (item.bin === 'recycle' ? 'recycle' : 'trash');
    const ctr = stationCenter(9);
    const sinkX = ctr.x - 92, sinkY = ctr.y + 16;
    const binsX = ctr.x + 148, binsY = ctr.y + 68;
    const startX = Number.isFinite(item.x) ? item.x : (sinkX - 70 + idx * 52);
    const startY = Number.isFinite(item.y) ? item.y : (sinkY + 86);
    const endX = targetBin === 'recycle' ? (binsX - 54) : (binsX + 54);
    const endY = binsY + 4;

    s9.activeWaste = {
      item,
      binId: targetBin,
      startX,
      startY,
      endX,
      endY,
      x: startX,
      y: startY,
      t: 0,
      duration: 0.55,
    };

    if (targetBin === 'recycle') {
      s9.recycleLidOpen = 1.0;
    } else {
      s9.trashLidOpen = 1.0;
    }
    sfx('binPedalOpen', true);
  }

  function checkAllChoresDone() {
    const s9 = state.slice9;
    if (!s9) return;
    const allDone = s9.choresDone.scrub && s9.choresDone.rinse && s9.choresDone.rack && s9.choresDone.bins;
    if (allDone && !s9.cleanupFanfarePlayed) {
      s9.cleanupFanfarePlayed = true;
      sfx('cleanupFanfare');
      const ctr = stationCenter(9);
      starBurst(ctr.x, ctr.y, ['#FFD166', '#FF85A2', '#7CE0F9', '#95D98B'], 14, 9);
      heartBurst(ctr.x, ctr.y - 40, 8, 9);
      renderPrimaryActionButton();
    }
  }

  function updateDishwash(dt) {
    const s9 = state.slice9;
    if (!s9) return;
    if (s9.soapPumpPress > 0) {
      s9.soapPumpPress = Math.max(0, s9.soapPumpPress - dt * 3.6);
    }
    if (s9.recycleLidOpen > 0) {
      s9.recycleLidOpen = Math.max(0, s9.recycleLidOpen - dt * 2.4);
    }
    if (s9.trashLidOpen > 0) {
      s9.trashLidOpen = Math.max(0, s9.trashLidOpen - dt * 2.4);
    }
    s9.rackItems.forEach(it => {
      if (it.pop > 1) it.pop = Math.max(1, it.pop - dt * 2.5);
    });
    if (s9.faucetOn) {
      s9.faucetFlowAmount += dt;
      if (s9.chore === 'rinse' && s9.rinseProgress < 1) {
        rinseDish(dt * 0.18);
      }
    }
    if (s9.activeWaste) {
      const aw = s9.activeWaste;
      aw.t += dt / aw.duration;
      const progress = clamp01(aw.t);
      const easeP = easeOutCubic(progress);
      aw.x = lerp(aw.startX, aw.endX, easeP);
      const arcH = Math.sin(progress * Math.PI) * 72;
      aw.y = lerp(aw.startY, aw.endY, easeP) - arcH;
      if (aw.t >= 1) {
        const bId = aw.binId;
        const sortedCount = s9.wasteQueue.filter(w => w.sorted).length;
        sfx(bId === 'recycle' ? 'recycleClink' : 'trashBinSort', bId, sortedCount);
        sfx('binPedalOpen', false);
        starBurst(aw.endX, aw.endY, bId === 'recycle' ? ['#7CE0F9', '#95D98B'] : ['#FF9A62', '#FFD166'], 6, 9);
        s9.activeWaste = null;
        if (s9.wasteQueue.every(w => w.sorted) && !s9.choresDone.bins) {
          s9.choresDone.bins = true;
          checkAllChoresDone();
        }
      }
    }
  }

  function advanceDishwashAction() {
    const s9 = state.slice9;
    if (!s9) { setStation(10, true); return; }
    if (s9.chore === 'scrub') {
      if (s9.scrubProgress < 0.9) {
        if (s9.soapLoaded < 0.3) pumpSoap();
        scrubDish(0.35);
      } else {
        s9.chore = 'rinse';
        toggleFaucet(true);
        sfx('popSelect', 2);
      }
    } else if (s9.chore === 'rinse') {
      if (s9.rinseProgress < 0.9) {
        if (!s9.faucetOn) toggleFaucet(true);
        rinseDish(0.35);
      } else {
        toggleFaucet(false);
        s9.chore = 'rack';
        sfx('popSelect', 3);
      }
    } else if (s9.chore === 'rack') {
      const unplaced = s9.rackItems.findIndex(it => !it.placed);
      if (unplaced >= 0) {
        placeRackDish(unplaced);
      } else {
        s9.chore = 'bins';
        sfx('popSelect', 4);
      }
    } else if (s9.chore === 'bins') {
      const unsorted = s9.wasteQueue.findIndex(w => !w.sorted);
      if (unsorted >= 0) {
        sortWasteItem(unsorted);
      } else {
        setStation(10, true);
      }
    }
    renderPrimaryActionButton();
  }

  function renderWashStation(c) {
    const ctr = stationCenter(9);
    const cx = ctr.x, cy = ctr.y;
    const s9 = state.slice9;
    if (!s9) return;

    const payload = {
      chore: s9.chore,
      scrubProgress: s9.scrubProgress,
      rinseProgress: s9.rinseProgress,
      soapLoaded: s9.soapLoaded,
      pumpPress: s9.soapPumpPress,
      faucetOn: s9.faucetOn,
      stainColors: s9.stainColors,
      sudsClusters: s9.sudsClusters,
      rackItems: s9.rackItems,
      wasteQueue: s9.wasteQueue,
      activeWaste: s9.activeWaste,
      recycleLidOpen: s9.recycleLidOpen,
      trashLidOpen: s9.trashLidOpen,
      sponge: {
        x: s9.sponge.x,
        y: s9.sponge.y,
        angle: s9.sponge.angle,
        scrubbing: s9.sponge.scrubbing,
      },
    };

    callArt('drawDishwashStation', [c, cx, cy, payload, t], () => fallbackWashStation(c, cx, cy, payload));

    // Left-side 4-Chore Vector Icon Cards (zero text!)
    const chores = [
      { id: 'scrub', icon: 'sponge' },
      { id: 'rinse', icon: 'faucet' },
      { id: 'rack',  icon: 'drying_rack' },
      { id: 'bins',  icon: 'recycle_bin' },
    ];
    const cardW = 54, cardH = 44;
    const cardX = 36;
    chores.forEach((ch, idx) => {
      const cardY = cy - 90 + idx * 52;
      const isActive = s9.chore === ch.id;
      const isDone = s9.choresDone[ch.id];
      c.save();
      KitchenArt.rr(c, cardX, cardY, cardW, cardH, 14);
      c.fillStyle = isActive ? '#E8998D' : (isDone ? '#E2F3E4' : '#FFFDF9');
      c.fill();
      c.strokeStyle = isActive ? KitchenArt.OUTLINE : (isDone ? '#78C87E' : '#D9B89C');
      c.lineWidth = 2.4;
      c.stroke();
      KitchenArt.drawIcon(c, ch.icon, cardX + cardW / 2, cardY + cardH / 2, 16, t);
      if (isDone) {
        c.fillStyle = '#78C87E';
        KitchenArt.circ(c, cardX + cardW - 10, cardY + 10, 5);
        c.fill();
        c.fillStyle = '#FFFDF9';
        KitchenArt.circ(c, cardX + cardW - 10, cardY + 10, 2);
        c.fill();
      }
      c.restore();
    });

    // Right-side 4-Pip Cleanliness Progress Card
    const progX = W - 78, progY = cy - 88;
    c.save();
    KitchenArt.rr(c, progX, progY, 46, 120, 16);
    c.fillStyle = '#FFFDF9';
    c.fill();
    c.strokeStyle = '#D9B89C';
    c.lineWidth = 2.4;
    c.stroke();
    KitchenArt.drawIcon(c, 'sparkle', progX + 23, progY + 20, 11, t);
    ['scrub', 'rinse', 'rack', 'bins'].forEach((chKey, i) => {
      const pipY = progY + 44 + i * 20;
      const done = s9.choresDone[chKey];
      c.fillStyle = done ? '#78C87E' : '#EAD5C3';
      c.strokeStyle = KitchenArt.OUTLINE;
      c.lineWidth = 1.4;
      KitchenArt.circ(c, progX + 23, pipY, 6.5);
      c.fill();
      c.stroke();
      if (done) {
        c.fillStyle = '#FFFDF9';
        KitchenArt.circ(c, progX + 21.5, pipY - 1.5, 2);
        c.fill();
      }
    });
    c.restore();
  }

  function fallbackWashStation(c, cx, cy, s) {
    c.fillStyle = '#CFEFF9';
    c.strokeStyle = KitchenArt.OUTLINE;
    c.lineWidth = 3;
    KitchenArt.rr(c, cx - 180, cy - 80, 360, 160, 24);
    c.fill();
    c.stroke();
  }

  /* ==========================================================================
   * Pointer / Touch Gesture Handling on Canvas
   * ========================================================================== */
  let pointerDown = false;
  let activePointerId = null;
  let lastPt = null;
  let lastChopTime = -1;
  let lastBowlAngle = 0;
  let lastBowlTs = 0;

  function canvasCoords(e) {
    if (!canvas) return { x: W * 0.46, y: H * 0.68 };
    const rect = canvas.getBoundingClientRect();
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || !rect.width || !rect.height) {
      return { x: (hoverPt && Number.isFinite(hoverPt.x)) ? hoverPt.x : W * 0.46, y: (hoverPt && Number.isFinite(hoverPt.y)) ? hoverPt.y : H * 0.68 };
    }
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
    if (activePointerId !== null && e && e.pointerId !== undefined && activePointerId !== e.pointerId) {
      // Secondary finger down during multi-touch: ignore to prevent drag cancellation / coordinate jumping
      return;
    }
    if (e && e.pointerId !== undefined) {
      activePointerId = e.pointerId;
      try {
        if (canvas && canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
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
      if (Math.hypot(pt.x - (cx - 268), pt.y - (cy - 6)) < 72) {
        const velcroProduce = ['strawberry', 'kiwi', 'tomato', 'carrot', 'corn', 'watermelon'];
        const curId = boardItem ? boardItem.id : '';
        const nextIdx = (velcroProduce.indexOf(curId) + 1) % velcroProduce.length;
        state.cartBounce = 1.0;
        sfx('cartRoll');
        selectIngredient(velcroProduce[nextIdx]);
        return;
      }
      if (Math.hypot(pt.x - (cx + 268), pt.y - (cy - 6)) < 72) {
        state.scanFlash = 1.0;
        state.drawerTimer = state.drawerTimer > 0.2 ? 0 : 1.8;
        sfx('scannerBeep');
        sfx('registerDrawer');
        starBurst(cx + 268, cy - 18, ['#F7C948', '#FFF3B8'], 5, 1);
        return;
      }
      if (Math.hypot(pt.x - cx, pt.y - cy) < 185) {
        state.boardSwipe = {
          startX: pt.x,
          startY: pt.y,
          lastX: pt.x,
          lastY: pt.y,
          t0: t,
          totalDist: 0,
          sliced: false,
        };
        slashTrail = [{ x: pt.x, y: pt.y, t }];
      }
    } else if (station === 2) {
      if (pt.x >= 32 && pt.x <= 160) {
        if (pt.y >= cy - 118 && pt.y <= cy - 72) { mixMode = 'bowl'; dish.vessel = 'plate'; squashImpulse(1.1, 0.9); renderPrimaryActionButton(); return; }
        if (pt.y >= cy - 72 && pt.y <= cy - 28) { mixMode = 'blender'; dish.vessel = 'cup'; squashImpulse(1.1, 0.9); renderPrimaryActionButton(); return; }
        if (pt.y >= cy - 28 && pt.y <= cy + 16) { mixMode = 'icecream'; squashImpulse(1.1, 0.9); sfx('popSelect', 2); renderPrimaryActionButton(); return; }
        if (pt.y >= cy + 16 && pt.y <= cy + 60) { mixMode = 'aquarium'; squashImpulse(1.1, 0.9); sfx('aquariumBubble'); renderPrimaryActionButton(); return; }
        if (pt.y >= cy + 60 && pt.y <= cy + 106) { mixMode = 'dollcare'; squashImpulse(1.1, 0.9); sfx('dollCareSoothe', 'pacifier'); renderPrimaryActionButton(); return; }
      }
      const lx = pt.x - cx;
      const ly = pt.y - cy;
      if (mixMode === 'icecream') {
        // 6 Flavor tubs row along bottom (-132 + i*42, 92)
        if (ly >= 66 && ly <= 116 && lx >= -156 && lx <= 104) {
          const fIdx = clamp(Math.round((lx + 132) / 42), 0, 5);
          state.slice2.flavorIdx = fIdx;
          stackIceCreamScoop(fIdx);
          return;
        }
        // Left side: Soft-Serve Dispenser Machine & Lever
        if (lx < -10 && Math.hypot(lx + 92, ly) < 115) {
          dispenseSoftServe(state.slice2.flavorIdx);
          return;
        }
        // Right side: Multi-Scoop Waffle Cone Stand
        if (lx >= -10 && Math.hypot(lx - 88, ly) < 115) {
          stackIceCreamScoop(state.slice2.flavorIdx);
          return;
        }
      } else if (mixMode === 'aquarium') {
        // Top-right Fish Flake Shaker Bottle (108, -102) or upper water surface
        if (Math.hypot(lx - 108, ly + 102) < 52 || (ly < -38 && Math.abs(lx) < 120)) {
          feedFishFlakes(lx);
          return;
        }
        if (Math.hypot(lx, ly) < 155) {
          cleanAquarium(lx, ly);
          return;
        }
      } else if (mixMode === 'dollcare') {
        if (lx < -48 && Math.abs(ly) < 85) {
          careForDoll('bottle');
          return;
        }
        if (lx > 48 && Math.abs(ly) < 85) {
          careForDoll('brush');
          return;
        }
        if (Math.hypot(lx, ly) < 130) {
          careForDoll('pacifier');
          return;
        }
      } else if (mixMode === 'blender') {
        // Base motorized 3-speed buttons (lx: -28, 0, 28, ly: 45..75)
        if (ly >= 45 && ly <= 75) {
          if (lx >= -38 && lx <= -18) { setBlenderSpeed(1); return; }
          if (lx >= -14 && lx <= 14) { stirMixer(0.35); sfx('blenderPulse', state.blenderSpeed); return; }
          if (lx >= 18 && lx <= 38) { setBlenderSpeed(3); return; }
        }
      }
      if (Math.hypot(pt.x - cx, pt.y - cy) < 165) {
        state.whiskHeld = true;
        state.whiskTarget = bowlAngle(pt);
        lastBowlAngle = state.whiskTarget;
        lastBowlTs = nowMs();
        stirMixer(0.2);
      }
    } else if (station === 3) {
      const lx = pt.x - cx;
      const ly = pt.y - cy;
      const ps = state.playsetState;

      // Left apron mode selection cards
      if (pt.x >= 32 && pt.x <= 165) {
        if (pt.y >= cy - 54 && pt.y <= cy - 6) {
          setPlaysetMode('playset');
          cookMode = 'playset';
          sfx('popSelect', 1);
          return;
        }
        if (pt.y >= cy && pt.y <= cy + 50) {
          setPlaysetMode('sink');
          cookMode = 'sink';
          sfx('popSelect', 2);
          return;
        }
      }

      if (playsetMode === 'playset' || cookMode === 'playset') {
        // 1. Unboxing flaps & box
        if (ps && (!ps.unboxed || (ps.unboxProgress !== undefined && ps.unboxProgress < 0.95))) {
          unboxPlayset();
          return;
        }
        // 2. Underside Battery Sound Module at bottom (ly ~ +75 .. +145)
        if (ly >= 75 && ly <= 145 && Math.abs(lx) <= 130) {
          // Battery bays & snap cover (-104 .. +28): ly ~ 85 .. 140
          if (lx >= -108 && lx <= 34) {
            if (ps && ps.coverClosed) {
              togglePlaysetBatteryCover();
            } else if (ps && !ps.batteriesInserted[0]) {
              insertPlaysetBattery(0);
            } else if (ps && !ps.batteriesInserted[1]) {
              insertPlaysetBattery(1);
            } else {
              togglePlaysetBatteryCover();
            }
            return;
          }
          // Speaker grille & LED (+36 .. +110)
          if (lx >= 36 && lx <= 110) {
            sfx('batteryChime');
            starBurst(cx + 52, cy + 112, ['#FF85A6', '#FFD166', '#7BC4E8'], 6, 3);
            return;
          }
        }
        // 3. Modular Parts Assembly
        assemblePlaysetPart();
        return;
      } else if (playsetMode === 'sink' || cookMode === 'sink') {
        // Faucet pump plunger / column (lx ~ 55 .. 125, ly ~ -110 .. 15)
        if (lx >= 55 && lx <= 125 && ly >= -110 && ly <= 15) {
          toggleSinkFaucet();
          return;
        }
        // Soap dispenser bottle (lx ~ -115 .. -55, ly ~ -90 .. -30)
        if (lx >= -115 && lx <= -55 && ly >= -90 && ly <= -30) {
          pumpSinkSoap();
          return;
        }
        // Sponge tap/grab or wash items in basin
        if (ps) {
          ps.spongeX = lx;
          ps.spongeY = ly;
          ps.scrubbing = true;
          state.spongeHeld = true;
          scrubSinkItem();
          return;
        }
      }
    } else if (station === 4 && cookMode !== 'cake') {
      if (pt.x >= 32 && pt.x <= 170) {
        if (pt.y >= cy - 115 && pt.y <= cy - 75) { cookMode = 'pan'; squashImpulse(1.1, 0.9); renderPrimaryActionButton(); return; }
        if (pt.y >= cy - 74 && pt.y <= cy - 36) { cookMode = 'oven'; squashImpulse(1.1, 0.9); renderPrimaryActionButton(); return; }
        if (pt.y >= cy - 35 && pt.y <= cy + 2) { cookMode = 'toaster'; squashImpulse(1.1, 0.9); sfx('popSelect', 2); renderPrimaryActionButton(); return; }
        if (pt.y >= cy + 3 && pt.y <= cy + 39) { cookMode = 'microwave'; squashImpulse(1.1, 0.9); sfx('popSelect', 3); renderPrimaryActionButton(); return; }
        if (pt.y >= cy + 40 && pt.y <= cy + 76) { cookMode = 'playset'; setPlaysetMode('playset'); sfx('popSelect', 1); return; }
        if (pt.y >= cy + 77 && pt.y <= cy + 115) { cookMode = 'sink'; setPlaysetMode('sink'); sfx('popSelect', 2); return; }
        if (cookMode === 'pan' && pt.y >= cy + 84 && pt.y <= cy + 126) {
          const idx = Math.floor((pt.x - 36) / 40) + 1;
          if (idx >= 1 && idx <= 3) { clickStoveDial('pan', idx); return; }
        }
      }
      if (cookMode === 'toaster') {
        const lx = pt.x - cx;
        const ly = pt.y - cy;
        // Right lever: lx ~ 85..140, ly ~ -30..55
        if (lx >= 85 && lx <= 140 && ly >= -30 && ly <= 55) {
          pressToasterLever();
          return;
        }
        // Butter dish or toast slices
        if (lx <= -110 || ly <= 0) {
          if (state.toasterState.toastProgress >= 0.7 || state.toasterState.popJump > 0) {
            spreadToastButter();
          } else {
            pressToasterLever();
          }
          return;
        }
      } else if (cookMode === 'microwave') {
        const lx = pt.x - cx;
        const ly = pt.y - cy;
        // Door handle: lx ~ 30..60, ly ~ -45..50
        if (lx >= 30 && lx <= 60 && ly >= -45 && ly <= 50) {
          toggleMicrowaveDoor();
          return;
        }
        // Control panel start button: lx ~ 74..118, ly ~ 14..56
        if (lx >= 74 && lx <= 118 && ly >= 14 && ly <= 56) {
          runMicrowave();
          return;
        }
        // Interior cavity tap
        if (lx >= -120 && lx <= 30 && ly >= -55 && ly <= 55) {
          runMicrowave();
          return;
        }
      }
      if (cookMode === 'pan') {
        // Front apron rotary temperature dials (left = soup pot burner, right = skillet burner)
        if (Math.hypot(pt.x - (cx - 108), pt.y - (cy + 83)) < 28) {
          clickStoveDial('soup');
          return;
        }
        if (Math.hypot(pt.x - (cx + 68), pt.y - (cy + 83)) < 28) {
          clickStoveDial('pan');
          return;
        }
        // Left burner: Boiling Soup Pot with water bubbles & steam vapor
        if (Math.hypot(pt.x - (cx - 108), pt.y - (cy + 16)) < 74) {
          stirSoupPot();
          return;
        }
      }
      if (Math.hypot(pt.x - cx, pt.y - cy) < 220) {
        state.panSwipe = { startX: pt.x, startY: pt.y, lastY: pt.y, t0: t, flipped: false };
      }
    } else if (station === 8 || (station === 4 && cookMode === 'cake')) {
      if (pt.x >= 32 && pt.x <= 160) {
        // Card A: Candy jar
        if (pt.y >= cy - 98 && pt.y <= cy - 58) {
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
        // Card B: Rosettes
        if (pt.y >= cy - 50 && pt.y <= cy - 10) {
          state.cakeStyle = 'rainbow_rosettes';
          dish.cakeStyle = 'rainbow_rosettes';
          decorTool = 'piping';
          decorToolChosen = true;
          renderDecorToolbar();
          squashImpulse(1.12, 0.9);
          sfx('popSelect', 2);
          return;
        }
        // Card C: Candle
        if (pt.y >= cy - 2 && pt.y <= cy + 38) {
          decorTool = 'topping';
          decorToolChosen = true;
          toppingIdx = Math.max(0, KitchenData.TOPPINGS.findIndex(tp => tp.id === 'candle'));
          toppingChosen = true;
          renderDecorToolbar();
          squashImpulse(1.12, 0.9);
          sfx('popSelect', 3);
          return;
        }
        // Card D: Musical Cake Knife
        if (pt.y >= cy + 46 && pt.y <= cy + 86) {
          decorTool = 'knife';
          decorToolChosen = true;
          renderDecorToolbar();
          squashImpulse(1.12, 0.9);
          sfx('popSelect', 4);
          return;
        }
      }
      // Tap on interactive Glass Candy Jar
      if (Math.hypot(pt.x - (cx - 192), pt.y - (cy - 8)) < 55) {
        scoopCandyJar();
        return;
      }
      const lx = (pt.x - cx) / 1.08;
      const ly = (pt.y - cy) / 1.08;
      // Tap on candles: blow out if lit, relight if blown out
      for (const tp of dish.toppings) {
        if (tp.id === 'candle' && Math.hypot(tp.x - lx, tp.y - (ly + 24)) < 32) {
          if (!tp.blownOut) {
            blowOutCandle(tp);
          } else {
            tp.blownOut = false;
            tp.blownAt = 0;
            sfx('popSelect', 2);
            const c4 = stationCenter(station === 8 ? 8 : 4);
            candleSmokePuff(c4.x + tp.x * 1.08, c4.y + (tp.y - 32) * 1.08, 4, station === 8 ? 8 : 4);
            starBurst(c4.x + tp.x * 1.08, c4.y + (tp.y - 32) * 1.08, ['#FFD166', '#FF85A6', '#FFF'], 5, station === 8 ? 8 : 4);
          }
          return;
        }
      }
      if (decorTool === 'knife' && Math.hypot(lx, ly) < 140) {
        sliceCakeAt(lx, ly);
        return;
      }
      if (Math.hypot(lx, ly) < 135) {
        handleDecorateAction(lx, ly, pt, false);
      }
    } else if (station === 5) {
      spoonGrab = { x: pt.x, y: pt.y, startedDrag: false };
    } else if (station === 6) {
      const ctr = stationCenter(6);
      const cx = ctr.x, cy = ctr.y;
      // Left zone (cx - 188, cy + 16): Crystal Mixing Bowl & Whisk
      if (Math.hypot(pt.x - (cx - 188), pt.y - (cy + 16)) < 82) {
        whiskPatisserieBatter(0.2);
        return;
      }
      // Center zone - Cookie Cutters (cx - 18 - 52 + idx * 52, cy + 18 - 58)
      const shapes = ['star', 'heart', 'bear'];
      for (let idx = 0; idx < shapes.length; idx++) {
        const cutX = cx - 18 - 52 + idx * 52;
        const cutY = cy + 18 - 58;
        if (Math.hypot(pt.x - cutX, pt.y - cutY) < 32) {
          stampPatisserieCookie(shapes[idx]);
          return;
        }
      }
      // Center zone - Pastry Board & Rolling Pin (cx - 18, cy + 18)
      if (Math.hypot(pt.x - (cx - 18), pt.y - (cy + 18)) < 88) {
        rollPatisserieDough(0.25);
        return;
      }
      // Right zone - Patisserie Oven (cx + 166, cy - 4)
      if (Math.hypot(pt.x - (cx + 166), pt.y - (cy - 4)) < 96) {
        if (pt.y > cy + 40) {
          togglePatisserieOvenDoor();
        } else {
          bakePatisserieCookies(0.3);
        }
        return;
      }
    } else if (station === 7) {
      const ctr = stationCenter(7);
      const cx = ctr.x, cy = ctr.y;
      const sushiX = cx - 168, sushiY = cy + 20;
      const burgerX = cx, burgerY = cy + 16;
      const kettleX = ctr.x + 168, kettleY = ctr.y + 16;

      // 1. Left Zone: Bamboo Mat Sushi Maki roll & slice
      if (Math.hypot(pt.x - sushiX, pt.y - sushiY) < 78) {
        advanceBentoSushi();
        return;
      }

      // 2. Center Zone: Multi-Layer Burger & Condiment Squeeze
      if (Math.hypot(pt.x - (burgerX - 44), pt.y - (burgerY - 48)) < 28) {
        const b = state.bento;
        if (b) {
          b.activeZone = 'burger';
          b.squeezeAnim = { color: '#E3392B', side: -1, t: 0, duration: 0.35 };
          if (!Array.isArray(b.condiments)) b.condiments = [];
          if (!b.condiments.includes('#E3392B')) b.condiments.push('#E3392B');
          sfx('condimentSquirt');
          squashImpulse(1.08, 0.92);
          starBurst(burgerX - 10, burgerY - 14, ['#E3392B', '#FFFDF9'], 4, 7);
        }
        return;
      }
      if (Math.hypot(pt.x - (burgerX + 44), pt.y - (burgerY - 48)) < 28) {
        const b = state.bento;
        if (b) {
          b.activeZone = 'burger';
          b.squeezeAnim = { color: '#F5C422', side: 1, t: 0, duration: 0.35 };
          if (!Array.isArray(b.condiments)) b.condiments = [];
          if (!b.condiments.includes('#F5C422')) b.condiments.push('#F5C422');
          sfx('condimentSquirt');
          squashImpulse(1.08, 0.92);
          starBurst(burgerX + 10, burgerY - 14, ['#F5C422', '#FFFDF9'], 4, 7);
        }
        return;
      }
      if (Math.hypot(pt.x - burgerX, pt.y - burgerY) < 68) {
        advanceBentoBurger();
        return;
      }

      // 3. Right Zone: Whistling Kettle & Teacup Pour
      if (Math.hypot(pt.x - (kettleX + 44), pt.y - (kettleY + 12)) < 36) {
        advanceBentoKettle('pour');
        return;
      }
      if (Math.hypot(pt.x - (kettleX - 18), pt.y - (kettleY - 14)) < 52) {
        advanceBentoKettle('heat');
        return;
      }

      const b = state.bento;
      if (b) {
        if (b.activeZone === 'burger') advanceBentoBurger();
        else if (b.activeZone === 'kettle') advanceBentoKettle();
        else advanceBentoSushi();
      }
    } else if (station === 9) {
      const s9 = state.slice9;
      if (!s9) return;
      // 1. Check left chore mode cards
      if (pt.x >= 32 && pt.x <= 96) {
        const choresList = ['scrub', 'rinse', 'rack', 'bins'];
        for (let idx = 0; idx < choresList.length; idx++) {
          const cardY = cy - 90 + idx * 52;
          if (pt.y >= cardY && pt.y <= cardY + 46) {
            s9.chore = choresList[idx];
            sfx('popSelect', idx);
            squashImpulse(1.08, 0.92);
            renderPrimaryActionButton();
            return;
          }
        }
      }
      // 2. Soap pump dispenser: (cx - 214, cy - 40)
      if (Math.hypot(pt.x - (cx - 214), pt.y - (cy - 40)) < 42) {
        pumpSoap();
        return;
      }
      // 3. Faucet / Handles: (cx - 92, cy - 58)
      if (Math.hypot(pt.x - (cx - 92), pt.y - (cy - 58)) < 48 || Math.hypot(pt.x - (cx - 56), pt.y - (cy - 40)) < 32) {
        toggleFaucet();
        return;
      }
      // 4. Hero Dish in Sink: (cx - 92, cy + 20)
      if (Math.hypot(pt.x - (cx - 92), pt.y - (cy + 20)) < 78) {
        s9.sponge.x = pt.x;
        s9.sponge.y = pt.y;
        s9.sponge.scrubbing = true;
        if (s9.chore === 'scrub') {
          scrubDish(0.12, pt);
        } else if (s9.chore === 'rinse') {
          rinseDish(0.12);
        }
        return;
      }
      // 5. Beechwood Drying Rack: (cx + 148, cy - 42)
      if (pt.x >= cx + 40 && pt.x <= cx + 256 && pt.y >= cy - 65 && pt.y <= cy - 5) {
        const slots = (KitchenData && KitchenData.DRYING_RACK_SLOTS) || [];
        let hitSlot = -1;
        slots.forEach((sl, idx) => {
          const sx = cx + 148 + (sl.slotX || (-75 + idx * 50));
          const sy = cy - 42 + (sl.slotY || -10);
          if (Math.hypot(pt.x - sx, pt.y - sy) < 28) hitSlot = idx;
        });
        placeRackDish(hitSlot >= 0 ? hitSlot : undefined);
        return;
      }
      // 6. Dual Pedal Bins:
      if (Math.hypot(pt.x - (cx + 94), pt.y - (cy + 68)) < 44) {
        const nextRecycle = s9.wasteQueue.findIndex(w => !w.sorted && (w.type === 'recycle' || w.bin === 'recycle'));
        if (nextRecycle >= 0) sortWasteItem(nextRecycle, 'recycle');
        else { s9.recycleLidOpen = 1.0; sfx('binPedalOpen', true); }
        return;
      }
      if (Math.hypot(pt.x - (cx + 202), pt.y - (cy + 68)) < 44) {
        const nextTrash = s9.wasteQueue.findIndex(w => !w.sorted && (w.type === 'trash' || w.bin === 'trash'));
        if (nextTrash >= 0) sortWasteItem(nextTrash, 'trash');
        else { s9.trashLidOpen = 1.0; sfx('binPedalOpen', true); }
        return;
      }
      // 7. Counter Waste Items:
      s9.wasteQueue.forEach((w, idx) => {
        if (w.sorted) return;
        const wx = cx - 162 + idx * 52;
        const wy = cy + 102;
        if (Math.hypot(pt.x - wx, pt.y - wy) < 28) {
          sortWasteItem(idx);
        }
      });
    } else if (station === 10) {
      const ctr = stationCenter(10);
      const cx = ctr.x, cy = ctr.y;
      const cl = state.clinic;
      if (!cl) return;
      const critterCy = H * 0.52;

      // Carry case tool slots at cy + 44
      const caseY = cy + 44;
      const tools = ['stethoscope', 'thermometer', 'bandaid', 'medicine', 'brush'];
      const slotSpacing = 72;
      const startX = cx - ((tools.length - 1) * slotSpacing) / 2;
      for (let i = 0; i < tools.length; i++) {
        const sx = startX + i * slotSpacing;
        if (Math.hypot(pt.x - sx, pt.y - (caseY + 2)) < 36) {
          if (cl.activeTool === tools[i]) {
            if (tools[i] === 'bandaid') {
              cl.bandaidIdx = (cl.bandaidIdx + 1) % 4;
              if (typeof KitchenAudio !== 'undefined' && KitchenAudio.bandaidPeel) KitchenAudio.bandaidPeel();
            } else if (tools[i] === 'medicine') {
              cl.flavorIdx = (cl.flavorIdx + 1) % 3;
              if (typeof KitchenAudio !== 'undefined' && KitchenAudio.dropperSqueeze) KitchenAudio.dropperSqueeze();
            }
          } else {
            setClinicTool(tools[i]);
          }
          return;
        }
      }

      // Procedure hits depending on activeTool
      if (cl.activeTool === 'stethoscope') {
        const chestPt = { x: cx, y: critterCy + 34 };
        if (Math.hypot(pt.x - chestPt.x, pt.y - chestPt.y) < 55) {
          listenHeartbeat();
          return;
        }
      } else if (cl.activeTool === 'thermometer') {
        const earPt = { x: cx - 54, y: critterCy - 66 };
        if (Math.hypot(pt.x - earPt.x, pt.y - earPt.y) < 50) {
          checkEarTemperature();
          return;
        }
      } else if (cl.activeTool === 'bandaid') {
        if (cl.booboos) {
          for (let idx = 0; idx < cl.booboos.length; idx++) {
            const b = cl.booboos[idx];
            if (!b.healed && Math.hypot(pt.x - (cx + b.dx), pt.y - (critterCy + b.dy)) < 42) {
              applyBandAid(idx);
              return;
            }
          }
        }
      } else if (cl.activeTool === 'medicine') {
        const botX = cx + 188, botY = cy - 52;
        if (Math.hypot(pt.x - botX, pt.y - botY) < 42) {
          cl.flavorIdx = (cl.flavorIdx + 1) % 3;
          cl.dropperFill = 0.95;
          if (typeof KitchenAudio !== 'undefined' && KitchenAudio.dropperSqueeze) KitchenAudio.dropperSqueeze();
          squashImpulse(1.08, 0.94);
          return;
        }
        const m = mouthPoint();
        if (Math.hypot(pt.x - m.x, pt.y - m.y) < 55) {
          giveMedicineDrop();
          return;
        }
      } else if (cl.activeTool === 'brush') {
        if (cl.furTufts) {
          for (let idx = 0; idx < cl.furTufts.length; idx++) {
            const tf = cl.furTufts[idx];
            if ((tf.progress || 0) < 0.95 && Math.hypot(pt.x - (cx + tf.dx), pt.y - (critterCy + tf.dy)) < 45) {
              brushPlushieFur(idx);
              return;
            }
          }
        }
      }
    }
  }

  function onPointerMove(e) {
    if (activePointerId !== null && e && e.pointerId !== undefined && activePointerId !== e.pointerId) {
      return;
    }
    if (e && e.pointerType === 'mouse' && e.buttons === 0 && pointerDown) {
      onPointerUp(e);
      return;
    }
    const pt = canvasCoords(e);
    hoverPt = pt;
    state.pointer = { x: pt.x, y: pt.y };
    const cx = W * 0.46, cy = H * 0.68;

    if (dragFood && dragFood.active) {
      dragFood.targetX = pt.x;
      dragFood.targetY = pt.y;
      dragFood.hoverSnap = getStationSnapTarget(station, pt);
      return;
    }

    if (!pointerDown) return;

    if (station === 10 && state.clinic) {
      state.clinic.listeningHeartbeat = false;
    }
    if (station === 1 && state.boardSwipe) {
      const sw = state.boardSwipe;
      slashTrail.push({ x: pt.x, y: pt.y, t });
      const dx = pt.x - sw.lastX;
      const dy = pt.y - sw.lastY;
      sw.totalDist += Math.hypot(dx, dy);
      const strokeDist = Math.hypot(pt.x - sw.startX, pt.y - sw.startY);

      if (!sw.sliced && strokeDist >= 32 && Math.hypot(pt.x - cx, pt.y - cy) < 185) {
        const angle = Math.atan2(pt.y - sw.startY, pt.x - sw.startX);
        const dtSwipe = Math.max(0.016, t - sw.t0);
        const vel = strokeDist / dtSwipe;
        sw.sliced = true;
        sw.startX = pt.x;
        sw.startY = pt.y;
        sw.t0 = t;
        lastChopTime = t;
        chopBoardItemImpl(true, { x: pt.x, y: pt.y, angle: angle - Math.PI / 2, velocity: vel });
      } else if (sw.sliced && strokeDist >= 55 && Math.hypot(pt.x - cx, pt.y - cy) < 185) {
        const angle = Math.atan2(pt.y - sw.startY, pt.x - sw.startX);
        const dtSwipe = Math.max(0.016, t - sw.t0);
        const vel = strokeDist / dtSwipe;
        sw.startX = pt.x;
        sw.startY = pt.y;
        sw.t0 = t;
        lastChopTime = t;
        chopBoardItemImpl(true, { x: pt.x, y: pt.y, angle: angle - Math.PI / 2, velocity: vel });
      }
      sw.lastX = pt.x;
      sw.lastY = pt.y;
    } else if (station === 2 && lastPt) {
      if (mixMode === 'aquarium') {
        const lx = pt.x - cx, ly = pt.y - cy;
        if (Math.hypot(lx, ly) < 145 && Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) > 16) {
          lastPt = pt;
          cleanAquarium(lx, ly);
        }
        return;
      }
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
      const distCenter = Math.hypot(pt.x - cx, pt.y - cy);
      if (distCenter < 165 && Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) > 20) {
        lastPt = pt;
        stirMixer(0.08, state.whiskHeld);
      }
    } else if (state.spongeHeld && (station === 3 || playsetMode === 'sink' || cookMode === 'sink')) {
      const ps = state.playsetState;
      if (ps) {
        ps.spongeX = pt.x - cx;
        ps.spongeY = pt.y - cy;
        ps.scrubbing = true;
        const nearItem = (ps.washItems || []).find(it => Math.hypot(it.x - ps.spongeX, it.y - ps.spongeY) < 38);
        if (nearItem) {
          scrubSinkItem(nearItem.id, 0.08);
        }
      }
    } else if ((station === 3 || station === 4) && state.panSwipe && !state.panSwipe.flipped) {
      const dy = pt.y - state.panSwipe.startY;
      if (dy < -32 && Math.hypot(pt.x - cx, pt.y - cy) < 200) {
        state.panSwipe.flipped = true;
        flipPan();
      }
    } else if (station === 4 || station === 8) {
      const lx = (pt.x - cx) / 1.08;
      const ly = (pt.y - cy) / 1.08;
      const distTurntable = Math.hypot(lx, ly);
      if (distTurntable < 135) {
        handleDecorateAction(lx, ly, pt, true);
      } else if (distTurntable < 195 && lastPt) {
        const dx = pt.x - lastPt.x;
        state.turntableVel += dx * 0.04;
        state.turntableAngle += dx * 0.015;
        dish.turntableAngle = state.turntableAngle;
        lastPt = pt;
      }
    } else if (station === 5 && spoonGrab) {
      if (!spoonGrab.startedDrag && !fork.dragging && Math.hypot(pt.x - spoonGrab.x, pt.y - spoonGrab.y) > 12) {
        startSpoonDrag(pt);
      }
      if (fork.dragging) {
        const m = mouthPoint();
        const distMouth = Math.hypot(pt.x - m.x, pt.y - m.y);
        if (distMouth < 180) {
          state.mouthOpenProgress = clamp01((180 - distMouth) / 120);
          state.anticipation = Math.max(state.anticipation, 0.4 + 0.6 * state.mouthOpenProgress);
        }
        if (distMouth < 65) {
          fork.x = lerp(pt.x, m.x, 0.7);
          fork.y = lerp(pt.y, m.y + 4, 0.7);
          fork.snappedToMouth = true;
        } else {
          fork.x = pt.x;
          fork.y = pt.y;
          fork.snappedToMouth = false;
        }
      }
    } else if (station === 6 && lastPt) {
      const ctr = stationCenter(6);
      const cx = ctr.x, cy = ctr.y;
      if (Math.hypot(pt.x - (cx - 188), pt.y - (cy + 16)) < 82 && Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) > 16) {
        lastPt = pt;
        whiskPatisserieBatter(0.06);
      } else if (Math.hypot(pt.x - (cx - 18), pt.y - (cy + 18)) < 88 && Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) > 16) {
        lastPt = pt;
        rollPatisserieDough(0.05);
      }
    } else if (station === 7 && lastPt) {
      const ctr = stationCenter(7);
      const sushiX = ctr.x - 168, sushiY = ctr.y + 20;
      if (Math.hypot(pt.x - sushiX, pt.y - sushiY) < 78 && Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) > 18) {
        lastPt = pt;
        advanceBentoSushi();
      }
    } else if (station === 9 && pointerDown) {
      const s9 = state.slice9;
      if (s9) {
        s9.sponge.x = pt.x;
        s9.sponge.y = pt.y;
        if (Math.hypot(pt.x - (cx - 92), pt.y - (cy + 20)) < 82) {
          s9.sponge.scrubbing = true;
          if (s9.chore === 'scrub') {
            scrubDish(0.016, pt);
          } else if (s9.chore === 'rinse') {
            rinseDish(0.016);
          }
        } else {
          s9.sponge.scrubbing = false;
        }
      }
    }
  }

  function onPointerUp(e) {
    if (e && e.pointerId !== undefined && activePointerId !== null && e.pointerId !== activePointerId) {
      // Secondary finger lifted, primary dragging finger is still active!
      return;
    }
    if (activePointerId !== null && canvas && canvas.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(activePointerId);
      } catch (_) {}
    }
    activePointerId = null;
    pointerDown = false;
    activeStroke = null;
    state.whiskHeld = false;
    if (state.spongeHeld) {
      state.spongeHeld = false;
      if (state.playsetState) state.playsetState.scrubbing = false;
    }

    if (dragFood && dragFood.active) {
      const df = dragFood;
      if (df.hoverSnap) {
        if (df.source === 'prepTray' && df.prepItem) {
          if (station === 2) addToMixer(df.id, df.sliced, df.prepItem.cracked);
          else if (station === 3) addToCooker(df.id, df.sliced, df.prepItem.cracked);
          else if (station === 4 || station === 7) addIngredientToDish(df.id, df.sliced, 0.7, df.prepItem.cracked);
        } else {
          selectIngredient(df.id);
        }
        sfx('popSelect', 2);
        squashImpulse(1.18, 0.85);
        starBurst(df.hoverSnap.snapX, df.hoverSnap.snapY, ['#F7C948', '#FFF3B8'], 5, 0);
      } else {
        sfx('woodTap', 1);
      }
      dragFood = null;
    }

    if (station === 1 && state.boardSwipe) {
      const sw = state.boardSwipe;
      const cx = W * 0.46, cy = H * 0.68;
      if (!sw.sliced && sw.totalDist < 22 && Math.hypot(sw.startX - cx, sw.startY - cy) < 185) {
        lastChopTime = t;
        chopBoardItemImpl(true);
      }
      state.boardSwipe = null;
    }

    if (station === 3 && state.panSwipe) {
      const cx = W * 0.46, cy = H * 0.68;
      if (!state.panSwipe.flipped && Math.hypot(state.panSwipe.startX - cx, state.panSwipe.startY - cy) < 190) {
        flipPan();
      }
      state.panSwipe = null;
    }

    if (station === 5 && spoonGrab) {
      const grab = spoonGrab;
      if (fork.dragging) {
        const m = mouthPoint();
        const distMouth = Math.hypot(fork.x - m.x, fork.y - m.y);
        if (state.flyingSpoon.loaded && (fork.snappedToMouth || distMouth < 85)) {
          deliverByDrag();
        } else {
          cancelSpoonDrag();
        }
      } else if (!grab.startedDrag) {
        feedBite({ fromUser: true });
      }
      spoonGrab = null;
    }

    if (station === 9 && state.slice9) {
      state.slice9.sponge.scrubbing = false;
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

  function isStationUnlocked(st) {
    if (mode === 'free') return true;
    const def = (KitchenData.STATIONS || []).find(s => s.num === st);
    if (!def) return true;
    return starsEarned >= def.unlocksAtStars;
  }

  function renderStationDockIcons() {
    const map = {
      1: 'knife',     // Station 1: Shopping & Velcro Slicing
      2: 'scoop',     // Station 2: Ice Cream Parlor & Aquarium
      3: 'sink',      // Station 3: Playset Unboxing & Running Sink
      4: 'pan',       // Station 4: Sizzling Dual-Burner Stove
      5: 'blender',   // Station 5: Countertop Appliances (Blender/Toaster)
      6: 'cookie',    // Station 6: Patisserie Oven & Cookie Stamper
      7: 'sushi',     // Station 7: Bento Box & Savory Meals
      8: 'cupcake',   // Station 8: Birthday Cake Celebration & Turntable
      9: 'sparkle',   // Station 9: Sparkling Dishwashing & Cleanup
      10: 'heart',    // Station 10: Little Doctor Clinic & Plushie Care
    };
    document.querySelectorAll('.station-btn').forEach(btn => {
      const st = Number(btn.dataset.station);
      const unlocked = isStationUnlocked(st);
      btn.classList.toggle('locked', !unlocked);
      const cv = btn.querySelector('canvas');
      if (cv) {
        const c = cv.getContext('2d');
        c.clearRect(0, 0, cv.width, cv.height);
        c.save();
        c.scale(2, 2);
        KitchenArt.drawIcon(c, map[st] || 'knife', 22, 16, 14, 0);
        if (!unlocked) {
          c.fillStyle = 'rgba(250, 243, 235, 0.45)';
          c.fillRect(0, 0, 44, 32);
          KitchenArt.drawIcon(c, 'lock', 32, 22, 8, 0);
        }
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
        const oIdx = KitchenData.WISH_ORDERS.findIndex(o => o.critter === c.id);
        if (oIdx >= 0) orderIdx = oIdx;
        syncModesToOrder();
        sfx('critterChime', idx);
        state.wave = 1;
        renderCustomerBar();
        renderPrimaryActionButton();
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

      let startPos = null;
      let isDragging = false;

      btn.addEventListener('pointerdown', (e) => {
        startPos = { x: e.clientX, y: e.clientY };
        isDragging = false;

        function onMove(me) {
          if (!startPos) return;
          const dx = me.clientX - startPos.x;
          const dy = me.clientY - startPos.y;
          if (!isDragging && Math.hypot(dx, dy) > 8) {
            isDragging = true;
            const pt = canvasCoords(me);
            startIngredientDrag(item.id, 'shelf', pt);
          }
        }

        function onUp(ue) {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
          if (!isDragging) {
            selectIngredient(item.id);
          }
          startPos = null;
          isDragging = false;
        }

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      });

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

      let startPos = null;
      let isDragging = false;

      cv.addEventListener('pointerdown', (e) => {
        startPos = { x: e.clientX, y: e.clientY };
        isDragging = false;

        function onMove(me) {
          if (!startPos) return;
          const dx = me.clientX - startPos.x;
          const dy = me.clientY - startPos.y;
          if (!isDragging && Math.hypot(dx, dy) > 8) {
            isDragging = true;
            const pt = canvasCoords(me);
            startIngredientDrag(p.id, 'prepTray', pt, { sliced: p.sliced, prepItem: p });
          }
        }

        function onUp(ue) {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
          if (!isDragging) {
            if (station === 2) addToMixer(p.id, p.sliced, p.cracked);
            else if (station === 3) addToCooker(p.id, p.sliced, p.cracked);
            else if (station === 4 || station === 7) addIngredientToDish(p.id, p.sliced, 0.7, p.cracked);
            sfx('popSelect', 2);
          }
          startPos = null;
          isDragging = false;
        }

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      });

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
      { id: 'knife',   icon: 'cake_knife' },
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
    } else if (decorTool === 'topping') {
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

        let startPos = null;
        let isDragging = false;

        b.addEventListener('pointerdown', (e) => {
          startPos = { x: e.clientX, y: e.clientY };
          isDragging = false;

          function onMove(me) {
            if (!startPos) return;
            const dx = me.clientX - startPos.x;
            const dy = me.clientY - startPos.y;
            if (!isDragging && Math.hypot(dx, dy) > 8) {
              isDragging = true;
              toppingIdx = idx;
              toppingChosen = true;
              renderDecorToolbar();
              const pt = canvasCoords(me);
              startIngredientDrag(tp.ingredient || tp.id, 'topping', pt, { sliced: true });
            }
          }

          function onUp(ue) {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            if (!isDragging) {
              toppingIdx = idx;
              toppingChosen = true;
              sfx('popSelect', idx);
              renderDecorToolbar();
            }
            startPos = null;
            isDragging = false;
          }

          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
          window.addEventListener('pointercancel', onUp);
        });

        optRow.appendChild(b);
      });
    } else if (decorTool === 'knife') {
      const b = document.createElement('button');
      b.className = 'swatch-btn active';
      b.dataset.swatch = 'slice';
      const cv = document.createElement('canvas');
      cv.width = 68;
      cv.height = 60;
      const c = cv.getContext('2d');
      c.scale(2, 2);
      KitchenArt.drawIcon(c, 'cake_knife', 17, 15, 12, 0);
      b.appendChild(cv);
      b.onclick = () => {
        sliceCakeAt();
        renderDecorToolbar();
      };
      optRow.appendChild(b);
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

        // Die-cut reaction sticker badge
        const rxnCv = document.createElement('canvas');
        rxnCv.width = 64;
        rxnCv.height = 64;
        rxnCv.style.width = '32px';
        rxnCv.style.height = '32px';
        rxnCv.className = 'album-reaction-sticker';
        const rc = rxnCv.getContext('2d');
        rc.scale(2, 2);
        if (KitchenArt && typeof KitchenArt.drawReactionSticker === 'function') {
          KitchenArt.drawReactionSticker(rc, entry.reactionKind || 'love', 16, 16, 13, 0);
        }
        meta.appendChild(rxnCv);

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
      if (mode === 'wish' && (currentOrder().wantCooking === 'blender' || currentOrder().wantCooking === 'none')) {
        setStation(5);
      } else {
        setStation(3);
      }
    } else if (station === 3) {
      if (mode === 'wish' && (currentOrder().wantCooking === 'blender' || currentOrder().wantCooking === 'none')) {
        setStation(5);
      } else {
        setStation(4);
      }
    } else if (station === 4) {
      if (cookProgress >= 0.65) {
        finishPanTossNow();
        setStation(5);
      } else flipPan();
    } else if (station === 5) {
      if (mode === 'wish' && (currentOrder().wantCooking === 'blender' || currentOrder().wantCooking === 'none')) {
        setStation(8);
      } else {
        setStation(6);
      }
    } else if (station === 6) {
      setStation(7);
    } else if (station === 7) {
      const b = state.bento;
      if (b && b.makiSlices < 4) {
        advanceBentoSushi();
      } else if (b && (!b.burgerLayers || !b.burgerLayers.includes('bun_top'))) {
        advanceBentoBurger();
      } else if (b && (b.teaPourProgress || 0) < 0.9) {
        advanceBentoKettle();
      } else {
        setStation(8);
      }
    } else if (station === 8) {
      if (decorCount() === 0) autoDecorateInTheme();
      setStation(9);
    } else if (station === 9) {
      const s9 = state.slice9;
      const allDone = !!(s9 && s9.choresDone && s9.choresDone.scrub && s9.choresDone.rinse && s9.choresDone.rack && s9.choresDone.bins);
      if (allDone) {
        setStation(10, true);
      } else {
        advanceDishwashAction();
      }
    } else if (station === 10) {
      const cl = state.clinic || {};
      if (cl.mode === 'feed') {
        if (dish.bitesTaken >= 3 || state.bitesEaten >= 3) {
          if (feedingBusy() || state.pendingReaction || state.celebrateTimer > 1.6) return;
          resetKitchenForNewDish(true);
        } else {
          feedBite({ fromUser: true });
        }
      } else {
        const allDone = (cl.heartbeatChecks > 0) && cl.tempChecked &&
                        (cl.booboos && cl.booboos.every(b => b.healed)) &&
                        (cl.dosesGiven > 0) &&
                        (cl.furTufts && cl.furTufts.every(tf => (tf.progress || 0) >= 0.95));
        if (allDone) {
          celebrateClinicCompletion();
        } else {
          performClinicStep();
        }
      }
    }
  }

  function resize() {
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const rect = wrap ? wrap.getBoundingClientRect() : { width: 640, height: 340 };
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(320, Math.round(rect.width));
    H = Math.max(180, Math.round(rect.height));
    const targetW = W * dpr;
    const targetH = H * dpr;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.setAttribute('width', targetW);
      canvas.setAttribute('height', targetH);
    }
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
    canvas.addEventListener('lostpointercapture', onPointerUp);
    window.addEventListener('blur', onPointerUp);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onPointerUp();
    });

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
        renderStationDockIcons();
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
    const albumModal = document.getElementById('albumModal');
    if (albumModal) {
      albumModal.addEventListener('click', (e) => {
        if (e.target === albumModal) albumModal.classList.add('hidden');
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
      cakeKnifeAnim: Object.assign({}, state.cakeKnifeAnim),
      candyScoopAnim: state.candyScoopAnim,
      velcroSlices: dish.velcroSlices || 0,
      candlesLit: (dish.toppings || []).filter(t => t.id === 'candle' && !t.blownOut).length,
      candlesBlown: (dish.toppings || []).filter(t => t.id === 'candle' && t.blownOut).length,
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
      velcroSlices: dish.velcroSlices || 0,
      candlesLit: (dish.toppings || []).filter(t => t.id === 'candle' && !t.blownOut).length,
      candlesBlown: (dish.toppings || []).filter(t => t.id === 'candle' && t.blownOut).length,
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
      slice9: state.slice9 ? {
        chore: state.slice9.chore,
        scrubProgress: state.slice9.scrubProgress,
        rinseProgress: state.slice9.rinseProgress,
        faucetOn: state.slice9.faucetOn,
        choresDone: Object.assign({}, state.slice9.choresDone),
      } : null,
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
      velcroSlices: dish.velcroSlices || 0,
      candlesLit: (dish.toppings || []).filter(t => t.id === 'candle' && !t.blownOut).length,
      candlesBlown: (dish.toppings || []).filter(t => t.id === 'candle' && t.blownOut).length,
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
    gotoStation: (num, force) => setStation(num, force !== undefined ? force : true),
    setMode: m => {
      mode = (m === 'free' ? 'free' : 'wish');
      renderHeaderIcons();
      renderStationDockIcons();
      return mode;
    },
    setStars: s => {
      starsEarned = Math.max(0, Number(s) || 0);
      renderHeaderIcons();
      renderStationDockIcons();
      return starsEarned;
    },
    selectIngredient,
    chopBoardItem,
    stirMixer,
    flipPan,
    stirSoupPot,
    clickStoveDial,
    setHeatLevel: lvl => clickStoveDial('pan', lvl),
    setSoupHeatLevel: lvl => clickStoveDial('soup', lvl),
    setCookMode: m => {
      const valid = ['pan', 'oven', 'toaster', 'microwave', 'playset', 'sink'];
      cookMode = valid.includes(m) ? m : 'pan';
      if (cookMode === 'playset' || cookMode === 'sink') setPlaysetMode(cookMode);
      renderPrimaryActionButton();
      return cookMode;
    },
    // Slice 3 (12:00 - 18:00): Ultimate Kitchen Playset & Circulating Sink Exports
    unboxPlayset,
    assemblePlaysetPart,
    insertPlaysetBattery,
    togglePlaysetBatteryCover,
    toggleSinkFaucet,
    pumpSinkSoap,
    scrubSinkItem,
    setPlaysetMode,
    getPlaysetState: () => JSON.parse(JSON.stringify(state.playsetState || {})),
    // Slice 5 (24:00 - 30:00): Countertop Appliance Exports
    pressToasterLever,
    spreadToastButter,
    runMicrowave,
    toggleMicrowaveDoor,
    setBlenderSpeed,
    getToasterState: () => JSON.parse(JSON.stringify(state.toasterState)),
    getMicrowaveState: () => JSON.parse(JSON.stringify(state.microwaveState)),
    // Slice 6 (30:00 - 36:00): Patisserie Bakery Oven & Cookie Stamper Exports
    whiskPatisserieBatter,
    rollPatisserieDough,
    stampPatisserieCookie,
    togglePatisserieOvenDoor,
    bakePatisserieCookies,
    getSlice6State: () => JSON.parse(JSON.stringify(state.slice6)),
    getStation: () => station,
    // Slice 7 (36:00 - 42:00): Bento Box & Savory Meal Builder Exports
    advanceBentoSushi,
    advanceBentoBurger,
    advanceBentoKettle,
    getBentoState: () => JSON.parse(JSON.stringify(state.bento || {})),
    setMixMode: m => {
      const valid = ['bowl', 'blender', 'icecream', 'aquarium', 'dollcare'];
      mixMode = valid.includes(m) ? m : 'bowl';
      dish.vessel = mixMode === 'blender' ? 'cup' : 'plate';
      renderPrimaryActionButton();
      return mixMode;
    },
    dispenseSoftServe,
    stackIceCreamScoop,
    cleanAquarium,
    feedFishFlakes,
    careForDoll,
    getSlice2State: () => JSON.parse(JSON.stringify(state.slice2)),
    setDecorTool: tl => {
      if (tl === 'piping' || tl === 'sauce' || tl === 'topping' || tl === 'knife') {
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
      if ((station !== 4 && station !== 8) || !Number.isFinite(lx) || !Number.isFinite(ly)) return null;
      const c = stationCenter(station);
      return handleDecorateAction(lx, ly, { x: c.x + lx * 1.08, y: c.y + ly * 1.08 }, !!isDrag);
    },
    // Slice 8 (42:00 - 48:00): Birthday Celebration Cake & Turntable Exports
    sliceCake: sliceCakeAt,
    blowCandle: blowOutCandle,
    blowCandles,
    scoopCandyJar,
    startPanToss: optSpeed => startPanToss(optSpeed),
    startIngredientDrag: (id, source, pt, opts) => startIngredientDrag(id, source, pt, opts),
    feedBite,
    feedOneBite,
    resetKitchenForNewDish,
    openAlbumModal,
    saveStorage,
    loadStorage,
    tick,
    advance,
    setTimeScale: s => {
      timeScale = clamp(Number(s) || 0, 0, 4);
      return timeScale;
    },
    getAnimState,
    getDishState,
    getDish: getDishState,
    getState: () => state,
    _internalState: state,
    primaryAction: onPrimaryActionClick,
    spawnParticle,
    spawnParticles,
    spawnSteam: (x, y, n, layer, dark) => steamPuff(x, y, n, layer, dark),
    spawnFryingSmoke: (x, y, n, layer, dark) => fryingSmokePuff(x, y, n, layer, dark),
    spawnSizzleSparks: (x, y, n, layer) => sizzleSparkBurst(x, y, n, layer),
    spawnSoapBubbles: (x, y, n, layer) => soapyBubblePuff(x, y, n, layer),
    spawnWaterStream: (x, y, vx, vy, n, layer) => waterStreamPuff(x, y, vx, vy, n, layer),
    spawnWaterSplash: (x, y, n, layer) => waterSplashBurst(x, y, n, layer),
    spawnWaterRipple: (x, y, layer, r) => waterRipple(x, y, layer, r),
    spawnDoughSprinkles: (x, y, n, layer) => doughSprinkleBurst(x, y, n, layer),
    spawnFlourPuff: (x, y, n, layer) => flourPuff(x, y, n, layer),
    spawnCandleSmoke: (x, y, n, layer) => candleSmokePuff(x, y, n, layer),
    spawnSparkleStars: (x, y, color, n, layer) => starBurst(x, y, color, n, layer),
    squashImpulse,
    triggerSquash,
    // Slice 9 (48:00 - 54:00): Sparkling Dishwashing Chore & Kitchen Cleanup Exports
    pumpSoap,
    toggleFaucet,
    scrubDish,
    rinseDish,
    placeRackDish,
    sortWasteItem,
    advanceDishwashAction,
    initSlice9FromDish,
    setDishwashChore: ch => {
      if (state.slice9 && ['scrub', 'rinse', 'rack', 'bins'].includes(ch)) {
        state.slice9.chore = ch;
        renderPrimaryActionButton();
      }
      return state.slice9 ? state.slice9.chore : null;
    },
    getSlice9State: () => JSON.parse(JSON.stringify(state.slice9 || {})),
    // Slice 10 (54:00 - 61:44): Little Doctor Clinic & Plushie Care Exports
    setClinicTool,
    listenHeartbeat,
    checkEarTemperature,
    applyBandAid,
    giveMedicineDrop,
    brushPlushieFur,
    performClinicStep,
    celebrateClinicCompletion,
    getClinicState: () => JSON.parse(JSON.stringify(state.clinic || {})),
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
      playsetMode,
      playset: state.playsetState ? {
        unboxed: state.playsetState.unboxed,
        unboxProgress: state.playsetState.unboxProgress,
        assembledParts: Object.assign({}, state.playsetState.assembledParts),
        batteriesInserted: state.playsetState.batteriesInserted.slice(),
        coverClosed: state.playsetState.coverClosed,
        soundModuleActive: state.playsetState.soundModuleActive,
        faucetOn: state.playsetState.faucetOn,
        waterLevel: state.playsetState.waterLevel,
        spongeX: state.playsetState.spongeX,
        spongeY: state.playsetState.spongeY,
        scrubbing: state.playsetState.scrubbing,
        washItems: state.playsetState.washItems.map(it => Object.assign({}, it)),
      } : null,
      heatLevel,
      soupHeatLevel,
      dialPulse: state.dialPulse,
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
      velcroSlices: dish.velcroSlices || 0,
      candlesLit: (dish.toppings || []).filter(t => t.id === 'candle' && !t.blownOut).length,
      candlesBlown: (dish.toppings || []).filter(t => t.id === 'candle' && t.blownOut).length,
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
      panToss: state.panToss ? { active: state.panToss.active, t: state.panToss.t, height: state.panToss.height, panDy: state.panToss.panDy } : null,
      flyingSpoon: state.flyingSpoon ? { active: state.flyingSpoon.active, t: state.flyingSpoon.t, phase: state.flyingSpoon.phase, x: state.flyingSpoon.x, y: state.flyingSpoon.y } : null,
      dragFood: dragFood && dragFood.active ? { id: dragFood.id, source: dragFood.source, x: dragFood.x, y: dragFood.y, active: dragFood.active } : null,
      boardSwipe: state.boardSwipe ? { active: state.boardSwipe.active } : null,
      knifeSlash: state.knifeSlash ? { active: state.knifeSlash.active, t: state.knifeSlash.t, sliceIndex: state.knifeSlash.sliceIndex } : null,
      slice6: state.slice6 ? {
        whiskProgress: state.slice6.whiskProgress,
        rollProgress: state.slice6.rollProgress,
        stampedShapes: state.slice6.stampedShapes.slice(),
        activeStampShape: state.slice6.activeStampShape,
        bakeProgress: state.slice6.bakeProgress,
        ovenDoorOpen: state.slice6.ovenDoorOpen,
      } : null,
      bento: state.bento ? JSON.parse(JSON.stringify(state.bento)) : null,
      bentoBox: dish.bentoBox,
      hasBurger: dish.hasBurger,
      hasTea: dish.hasTea,
      slice9: state.slice9 ? {
        chore: state.slice9.chore,
        scrubProgress: state.slice9.scrubProgress,
        rinseProgress: state.slice9.rinseProgress,
        faucetOn: state.slice9.faucetOn,
        soapLoaded: state.slice9.soapLoaded,
        rackedCount: state.slice9.rackItems.filter(it => it.placed).length,
        sortedWasteCount: state.slice9.wasteQueue.filter(w => w.sorted).length,
        choresDone: Object.assign({}, state.slice9.choresDone),
      } : null,
    }),
  };
})();

window.KitchenGame = KitchenGame; // expose for headless playtest scripts
window.addEventListener('DOMContentLoaded', () => KitchenGame.init());
