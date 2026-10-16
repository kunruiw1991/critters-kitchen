'use strict';
/* ==========================================================================
 * Chuyu's Rainbow Kitchen — Pinterest Cozy Patisserie Interactive Engine
 * 100% Custom Gouache Vector Art, Zero System Emojis, Zero Speech/Text,
 * 60fps Squash-and-Stretch Spring Physics & Tactile Kitchen ASMR
 * ========================================================================== */
const KitchenGame = (() => {
  const STORAGE_KEY = 'chuyu_rainbow_kitchen_v3';
  const PI2 = Math.PI * 2;
  let canvas, ctx;
  let W = 960, H = 560, dpr = 1;
  let t = 0, lastTs = 0;

  // Game Mode & Customer State
  let mode = 'wish'; // 'wish' | 'free'
  let critterIdx = 3; // Start with Bobby BearHug
  let orderIdx = 0;
  let station = 1; // 1:Chop, 2:Mix, 3:Cook, 4:Decorate, 5:Feed
  let activeCategory = 'fruit';

  // Spring physics helper for elastic squash & stretch
  let boardSpring = { sx: 1, sy: 1, vx: 0, vy: 0 };
  let flyingIng = null; // { id, x0, y0, x1, y1, p }

  // Station 1: Cutting Board State
  let boardItem = null; // { id, chops: 0, maxChops: 3, sliced: false, cracked: false, knifeAnim: 0 }
  let prepTray = [];    // Array of prepped items: { id, sliced, cracked, cooked: 0 }
  let slashTrail = [];

  // Station 2: Mixing Bowl & Blender State
  let mixMode = 'bowl'; // 'bowl' | 'blender'
  let mixItems = [];
  let mixProgress = 0;
  let mixAngle = 0;
  let mixColor = '#FFF5DC';

  // Station 3: Skillet Pan & Oven State
  let cookMode = 'pan'; // 'pan' | 'oven'
  let heatLevel = 2;    // 1:Low, 2:Med, 3:High
  let panItems = [];
  let cookProgress = 0;
  let flipAnim = 0;
  let sizzleTimer = 0;

  // Station 4 & 5: Plated Dish State
  let dish = createFreshDish();
  let decorTool = 'piping'; // 'piping' | 'sauce' | 'topping'
  let pipingColorIdx = 1;
  let sauceIdx = 0;
  let toppingIdx = 0;
  let activeStroke = null;
  let hoverPt = { x: 480, y: 360 };

  // Station 5: Feeding Fork & Critter Reaction State
  let fork = { x: 0, y: 0, dragging: false, homeX: 0, homeY: 0 };
  let critterAnim = {
    mouthOpen: 0,
    chewing: 0,
    reaction: null,
    reactionTimer: 0,
    lookX: 0,
    lookY: 0,
  };
  let particles = [];
  let starsEarned = 0;
  let album = [];

  function triggerSquash(sx, sy) {
    boardSpring.sx = sx || 1.28;
    boardSpring.sy = sy || 0.76;
  }

  function stepSpring(sp, dt) {
    const k = 180, damp = 14;
    const ax = (1 - sp.sx) * k - sp.vx * damp;
    const ay = (1 - sp.sy) * k - sp.vy * damp;
    sp.vx += ax * dt;
    sp.vy += ay * dt;
    sp.sx += sp.vx * dt;
    sp.sy += sp.vy * dt;
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
   * Particle Burst Helpers (Stars, Hearts, Droplets, Steam)
   * ========================================================================== */
  function spawnParticles(x, y, color, count, kind) {
    for (let i = 0; i < (count || 12); i++) {
      const a = Math.random() * PI2;
      const sp = 55 + Math.random() * 135;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 45,
        r: 4.5 + Math.random() * 6,
        color: color || '#E88388',
        life: 0.7 + Math.random() * 0.45,
        maxLife: 1.0,
        kind: kind || (i % 3 === 0 ? 'star' : 'circle'),
      });
    }
  }

  /* ==========================================================================
   * Station 1: Select & Chop / Crack Ingredient
   * ========================================================================== */
  function selectIngredient(id) {
    const meta = KitchenData.getIngredient(id);
    KitchenAudio.ensure();
    KitchenAudio.popSelect(id.length);

    // Trigger flying ingredient arc from bottom shelf to active station
    flyingIng = {
      id: meta.id,
      x0: W * 0.46,
      y0: H * 0.92,
      x1: W * 0.46,
      y1: H * 0.65,
      p: 0,
    };
    triggerSquash(1.3, 0.74);

    if (station === 1) {
      boardItem = {
        id: meta.id,
        chops: 0,
        maxChops: meta.crackable ? 2 : (meta.choppable ? 3 : 1),
        sliced: false,
        cracked: false,
        knifeAnim: 0,
      };
      spawnParticles(W * 0.46, H * 0.64, meta.color, 10, 'circle');
      if (!meta.choppable && !meta.crackable) {
        chopBoardItem();
      }
    } else if (station === 2) {
      addToMixer(meta.id, false, false);
    } else if (station === 3) {
      addToCooker(meta.id, false, false);
    } else if (station === 4) {
      addIngredientToDish(meta.id, true, 0.7);
    }
    renderPrepTrayUI();
    renderPrimaryActionButton();
  }

  function chopBoardItem() {
    if (!boardItem) {
      const defaultId = mode === 'wish' ? currentOrder().wantIds[0] : 'strawberry';
      selectIngredient(defaultId);
      if (!boardItem) return;
    }
    const meta = KitchenData.getIngredient(boardItem.id);
    boardItem.chops++;
    boardItem.knifeAnim = 1.0;
    triggerSquash(1.34, 0.72);

    if (meta.crackable) {
      KitchenAudio.crackEgg();
    } else if (meta.liquid) {
      KitchenAudio.pour();
    } else {
      KitchenAudio.chop(boardItem.chops);
    }
    spawnParticles(W * 0.46 + (Math.random() - 0.5) * 60, H * 0.64, meta.color, 14, 'circle');

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
      const finishedId = boardItem.id;
      setTimeout(() => {
        if (boardItem && boardItem.id === finishedId && boardItem.chops >= boardItem.maxChops) {
          boardItem = null;
          renderPrepTrayUI();
          renderPrimaryActionButton();
        }
      }, 320);
    }
    renderPrepTrayUI();
    renderPrimaryActionButton();
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

  function addIngredientToDish(id, sliced, cooked, cracked) {
    const meta = KitchenData.getIngredient(id);
    if (id === 'boba' || (id === 'milk' && mixMode === 'blender')) {
      dish.vessel = 'cup';
    }
    if (id === 'dough' && cookMode === 'oven') {
      dish.bakedCake = true;
    }
    const angle = dish.items.length * 1.35;
    const rad = dish.items.length === 0 ? 0 : Math.min(58, 22 + dish.items.length * 8);
    dish.items.push({
      id,
      sliced: sliced !== undefined ? sliced : !!meta.choppable,
      cracked: cracked !== undefined ? cracked : !!meta.crackable,
      cooked: cooked || 0,
      x: Math.cos(angle) * rad,
      y: Math.sin(angle) * rad * 0.65 - 6,
      r: meta.baseType ? 68 : 34,
      rot: (Math.random() - 0.5) * 0.4,
    });
    recomputeDishLiquidColor();
  }

  /* ==========================================================================
   * Station 2: Mixing Bowl & Smoothie Blender
   * ========================================================================== */
  function addToMixer(id, sliced, cracked) {
    const meta = KitchenData.getIngredient(id);
    if (meta.liquid) KitchenAudio.pour();
    else KitchenAudio.chop();
    mixItems.push({ id, sliced: !!sliced, cracked: !!cracked });
    recomputeMixColor();
    addIngredientToDish(id, true, 0);
    if (id === 'boba' || id === 'milk' || id === 'icecream') {
      if (mixMode === 'blender') dish.vessel = 'cup';
    }
    spawnParticles(W * 0.46, H * 0.62, meta.color, 12);
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

  function stirMixer(amount) {
    if (mixItems.length === 0) {
      if (prepTray.length > 0) {
        prepTray.forEach(p => mixItems.push({ id: p.id, sliced: p.sliced, cracked: p.cracked }));
      } else {
        addToMixer('milk', false, false);
        addToMixer('strawberry', true, false);
      }
      recomputeMixColor();
    }
    mixProgress = Math.min(1, mixProgress + (amount || 0.18));
    mixAngle += 0.9;
    triggerSquash(1.12, 0.9);
    if (mixMode === 'blender') {
      KitchenAudio.blendTick();
      dish.vessel = 'cup';
    } else {
      KitchenAudio.stir();
    }
    dish.liquidColor = mixColor;
    if (mixProgress >= 1) {
      spawnParticles(W * 0.46, H * 0.58, mixColor, 16, 'star');
    }
    renderPrimaryActionButton();
  }

  /* ==========================================================================
   * Station 3: Sizzling Skillet Pan & Bakery Oven
   * ========================================================================== */
  function addToCooker(id, sliced, cracked) {
    const meta = KitchenData.getIngredient(id);
    panItems.push({
      id,
      sliced: sliced !== undefined ? sliced : !!meta.choppable,
      cracked: cracked !== undefined ? cracked : !!meta.crackable,
      x: (Math.random() - 0.5) * 85,
      y: (Math.random() - 0.5) * 40,
    });
    KitchenAudio.sizzleTick(heatLevel);
    addIngredientToDish(id, true, Math.max(0.65, cookProgress));
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
    triggerSquash(1.24, 0.8);
    if (cookMode === 'oven') {
      cookProgress = Math.min(0.85, cookProgress + 0.45);
      dish.bakedCake = true;
      KitchenAudio.ovenDing();
      spawnParticles(W * 0.46, H * 0.58, '#F7C948', 20, 'star');
    } else {
      flipAnim = 1.0;
      cookProgress = Math.min(1.3, cookProgress + 0.28);
      KitchenAudio.flip();
      spawnParticles(W * 0.46, H * 0.55, '#F5A623', 16, 'star');
    }
    syncCookedStateToDish();
    renderPrimaryActionButton();
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
   * Station 4: Piping Cream, Drizzling Sauce & Sprinkles
   * ========================================================================== */
  function ensureDishHasBase() {
    if (dish.items.length === 0 && !dish.bakedCake) {
      dish.bakedCake = true;
      dish.liquidColor = '#F4B8C4';
      addIngredientToDish('strawberry', true, 0);
    }
  }

  function addPipingPoint(localX, localY) {
    ensureDishHasBase();
    const pCol = KitchenData.PIPING_COLORS[pipingColorIdx] || KitchenData.PIPING_COLORS[0];
    const last = dish.piping[dish.piping.length - 1];
    if (last && Math.hypot(last.x - localX, last.y - localY) < 14) return;
    dish.piping.push({
      x: localX,
      y: localY,
      r: 15,
      color: pCol.color,
      shadow: pCol.shadow,
      hi: pCol.hi,
    });
    triggerSquash(1.08, 0.94);
    KitchenAudio.pipeCream();
    renderPrimaryActionButton();
  }

  function addToppingAt(localX, localY) {
    ensureDishHasBase();
    const topMeta = KitchenData.TOPPINGS[toppingIdx] || KitchenData.TOPPINGS[0];
    for (let tp of dish.toppings) {
      if (tp.id === 'candle' && !tp.blownOut && Math.hypot(tp.x - localX, tp.y - localY) < 28) {
        tp.blownOut = true;
        KitchenAudio.blowCandle();
        spawnParticles(W * 0.46 + tp.x, H * 0.62 + tp.y - 30, '#F7C948', 18, 'star');
        return;
      }
    }
    dish.toppings.push({
      id: topMeta.id,
      x: localX,
      y: localY,
      seed: Math.random() * 10,
      blownOut: false,
    });
    triggerSquash(1.12, 0.9);
    KitchenAudio.sprinkle();
    spawnParticles(W * 0.46 + localX, H * 0.62 + localY, '#F7C948', 8, 'star');
    renderPrimaryActionButton();
  }

  /* ==========================================================================
   * Station 5: Bite-by-Bite Feeding & 8 Reaction Evaluator
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

  function feedOneBite() {
    ensureDishHasBase();
    if (dish.bitesTaken >= 3) {
      dish.bitesTaken = 0;
    }
    dish.bitesTaken++;
    critterAnim.chewing = 1.2;
    critterAnim.mouthOpen = 0;
    triggerSquash(1.22, 0.82);
    KitchenAudio.bite(dish.vessel === 'cup');
    spawnParticles(W * 0.46, H * 0.25, '#E88388', 18, 'heart');

    const rxn = evaluateDishReaction();
    critterAnim.reaction = rxn.kind;
    critterAnim.reactionTimer = 4.8;
    KitchenAudio.reaction(rxn.kind);

    if (dish.bitesTaken === 1) {
      starsEarned += rxn.stars;
      saveDishSnapshotToAlbum(rxn);
    }
    renderPrimaryActionButton();
  }

  function saveDishSnapshotToAlbum(rxn) {
    try {
      const snapCv = document.createElement('canvas');
      snapCv.width = 240;
      snapCv.height = 176;
      const sctx = snapCv.getContext('2d');
      sctx.fillStyle = '#FAF3EB';
      sctx.fillRect(0, 0, 240, 176);
      const savedBites = dish.bitesTaken;
      dish.bitesTaken = 0;
      KitchenArt.drawDish(sctx, dish, 120, 98, 0.6, t);
      dish.bitesTaken = savedBites;

      const c = currentCritter();
      album.unshift({
        critterIcon: c.icon,
        reactionKind: rxn.kind,
        stars: rxn.stars,
        dataUrl: snapCv.toDataURL('image/jpeg', 0.85),
      });
      saveStorage();
      KitchenAudio.shutter();
    } catch (e) {}
  }

  /* ==========================================================================
   * Station Switching & Floating Action Button Renderer
   * ========================================================================== */
  function setStation(num) {
    station = num;
    KitchenAudio.popSelect(num);
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
    requestAnimationFrame(resize);
    fork.x = W * 0.68;
    fork.y = H * 0.66;
    fork.homeX = W * 0.68;
    fork.homeY = H * 0.66;
    renderPrimaryActionButton();
  }

  function resetKitchenForNewDish(nextOrder) {
    boardItem = null;
    prepTray = [];
    mixItems = [];
    mixProgress = 0;
    panItems = [];
    cookProgress = 0;
    flipAnim = 0;
    dish = createFreshDish();
    critterAnim.reaction = null;
    critterAnim.reactionTimer = 0;
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
      leftIcon = dish.bitesTaken >= 3 ? 'refresh' : 'plate';
      rightIcon = 'star';
    }

    KitchenArt.drawIcon(c, leftIcon, 20, 18, 13, t);
    KitchenArt.drawIcon(c, rightIcon, 46, 18, 12, t);
    c.restore();
  }

  /* ==========================================================================
   * Main 60fps Canvas Render Loop
   * ========================================================================== */
  function render(now) {
    requestAnimationFrame(render);
    const dt = Math.min(0.05, (now - (lastTs || now)) / 1000);
    lastTs = now;
    t += dt;

    stepSpring(boardSpring, dt);
    if (flyingIng) {
      flyingIng.p = Math.min(1, flyingIng.p + dt * 3.8);
      if (flyingIng.p >= 1) flyingIng = null;
    }

    if (boardItem && boardItem.knifeAnim > 0) {
      boardItem.knifeAnim = Math.max(0, boardItem.knifeAnim - dt * 4.5);
    }
    if (flipAnim > 0) {
      flipAnim = Math.max(0, flipAnim - dt * 2.4);
    }
    if (critterAnim.chewing > 0) {
      critterAnim.chewing = Math.max(0, critterAnim.chewing - dt);
    }
    if (critterAnim.reactionTimer > 0) {
      critterAnim.reactionTimer = Math.max(0, critterAnim.reactionTimer - dt);
      if (critterAnim.reactionTimer === 0) {
        critterAnim.reaction = null;
      }
    }

    if (station === 3 && panItems.length > 0 && cookMode === 'pan') {
      cookProgress += dt * 0.055 * heatLevel;
      syncCookedStateToDish();
      sizzleTimer -= dt;
      if (sizzleTimer <= 0) {
        sizzleTimer = 0.16;
        KitchenAudio.sizzleTick(heatLevel * 0.45);
      }
      if (Math.random() < 0.25 * heatLevel) {
        particles.push({
          x: W * 0.46 + (Math.random() - 0.5) * 140,
          y: H * 0.64 + (Math.random() - 0.5) * 55,
          vx: (Math.random() - 0.5) * 18,
          vy: -32 - Math.random() * 42,
          r: 4 + Math.random() * 6,
          color: cookProgress > 1.05 ? 'rgba(80,65,55,0.6)' : 'rgba(255,250,235,0.75)',
          life: 0.75,
          maxLife: 0.75,
          kind: 'smoke',
        });
      }
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Cozy Sunlit Pinterest Patisserie Backdrop & Countertop
    KitchenArt.drawKitchenBackdrop(ctx, W, H, t);

    // 2. Illustrated Plush Critter Chef Customer
    const critter = currentCritter();
    KitchenArt.drawCritterCustomer(ctx, critter, W * 0.46, H * 0.25, 1.08, critterAnim, t);

    // 3. Pinterest Thought Cloud Recipe Card (Left of Customer, 100% Vector Art)
    drawWishBubble(ctx, 26, 36);

    // 4. Render Active Kitchen Station on Countertop
    if (station === 1) {
      renderChopStation(ctx);
    } else if (station === 2) {
      renderMixStation(ctx);
    } else if (station === 3) {
      renderCookStation(ctx);
    } else if (station === 4) {
      renderDecorateStation(ctx);
    } else if (station === 5) {
      renderFeedStation(ctx);
    }

    // 5. Render Flying Ingredient Arc
    if (flyingIng) {
      const p = flyingIng.p;
      const fx = flyingIng.x0 + (flyingIng.x1 - flyingIng.x0) * p;
      const fy = flyingIng.y0 + (flyingIng.y1 - flyingIng.y0) * p - Math.sin(p * Math.PI) * 110;
      KitchenArt.drawIngredient(ctx, flyingIng.id, fx, fy, 38, { rot: p * PI2, shadow: false });
    }

    // 6. Render Particles (Stars, Hearts, Juice Droplets, Steam)
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind !== 'smoke') p.vy += 220 * dt;
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      if (p.kind === 'star') {
        KitchenArt.star(ctx, p.x, p.y, p.r * 1.4, p.r * 0.6, 5, t * 3);
        ctx.fill();
      } else if (p.kind === 'heart') {
        KitchenArt.heart(ctx, p.x, p.y, p.r * 1.3);
        ctx.fill();
      } else {
        KitchenArt.circ(ctx, p.x, p.y, p.r * (p.kind === 'smoke' ? 1.5 - p.life * 0.5 : 1));
        ctx.fill();
      }
      ctx.restore();
    }

    if (slashTrail.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#FFFDF9';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      slashTrail.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.restore();
      slashTrail = slashTrail.filter(pt => t - pt.t < 0.18);
    }

    ctx.restore();
  }

  /* ==========================================================================
   * Pinterest Thought Cloud Recipe Card (100% Custom Vector Illustrations)
   * ========================================================================== */
  function drawWishBubble(ctx, x, y) {
    ctx.save();
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
  function renderChopStation(ctx) {
    const cx = W * 0.46, cy = H * 0.68;

    // Warm Oak Butcher Block with Wood Grain
    ctx.fillStyle = 'rgba(92, 61, 46, 0.16)';
    KitchenArt.rr(ctx, cx - 178, cy - 82, 356, 174, 28);
    ctx.fill();

    ctx.fillStyle = '#E6B88A';
    ctx.strokeStyle = KitchenArt.OUTLINE;
    ctx.lineWidth = 4;
    KitchenArt.rr(ctx, cx - 178, cy - 90, 356, 172, 28);
    ctx.fill();
    ctx.stroke();

    // Inner juice groove
    ctx.strokeStyle = '#C99663';
    ctx.lineWidth = 2.5;
    KitchenArt.rr(ctx, cx - 158, cy - 72, 316, 136, 20);
    ctx.stroke();

    if (boardItem) {
      const meta = KitchenData.getIngredient(boardItem.id);
      const isSliced = boardItem.chops >= boardItem.maxChops && meta.choppable;
      ctx.save();
      ctx.translate(cx, cy - 4);
      ctx.scale(boardSpring.sx, boardSpring.sy);

      if (meta.crackable) {
        KitchenArt.drawIngredient(ctx, boardItem.id, 0, 0, 54, {
          cracked: boardItem.chops >= 1,
          showShell: boardItem.chops >= 1,
        });
      } else if (isSliced || boardItem.chops > 0) {
        const pieces = Math.min(4, boardItem.chops + 1);
        for (let i = 0; i < pieces; i++) {
          const ox = (i - (pieces - 1) / 2) * 46;
          KitchenArt.drawIngredient(ctx, boardItem.id, ox, 0, 44, {
            sliced: boardItem.chops >= 1 && meta.choppable,
          });
        }
      } else {
        KitchenArt.drawIngredient(ctx, boardItem.id, 0, 0, 58, { sliced: false });
      }
      ctx.restore();

      // Progress dots above board
      for (let i = 0; i < boardItem.maxChops; i++) {
        ctx.fillStyle = i < boardItem.chops ? '#78C47C' : '#FFFDF9';
        ctx.strokeStyle = KitchenArt.OUTLINE;
        ctx.lineWidth = 2.2;
        KitchenArt.circ(ctx, cx - ((boardItem.maxChops - 1) * 15) + i * 30, cy - 64, 8);
        ctx.fill();
        ctx.stroke();
      }

      // Custom Illustrated Santoku Knife swinging down!
      const kOffset = boardItem.knifeAnim * 32;
      ctx.save();
      ctx.translate(cx + 108 - kOffset, cy - 32 + kOffset);
      ctx.rotate(-boardItem.knifeAnim * 0.45);
      KitchenArt.drawIcon(ctx, 'knife', 0, 0, 38, t);
      ctx.restore();
    } else {
      // Gentle floating strawberry + Santoku knife cue on empty board
      const bounceY = Math.sin(t * 4) * 5;
      ctx.save();
      ctx.globalAlpha = 0.85;
      KitchenArt.drawIngredient(ctx, 'strawberry', cx - 36, cy - 4 + bounceY, 36, { sliced: false });
      KitchenArt.drawIcon(ctx, 'knife', cx + 38, cy - 8 - bounceY, 34, t);
      ctx.restore();
    }
  }

  /* ==========================================================================
   * Station 2: Speckled Ceramic Bowl & Vintage Mint Blender
   * ========================================================================== */
  function renderMixStation(ctx) {
    const cx = W * 0.46, cy = H * 0.69;

    drawCanvasIconCard(ctx, 36, cy - 54, 118, 48, mixMode === 'bowl', 'bowl');
    drawCanvasIconCard(ctx, 36, cy + 8,  118, 48, mixMode === 'blender', 'blender');

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(boardSpring.sx, boardSpring.sy);

    if (mixMode === 'blender') {
      ctx.fillStyle = '#E8998D';
      ctx.strokeStyle = KitchenArt.OUTLINE;
      ctx.lineWidth = 3.5;
      KitchenArt.rr(ctx, -64, 38, 128, 40, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(235, 248, 252, 0.84)';
      KitchenArt.rr(ctx, -72, -92, 144, 134, 22);
      ctx.fill();
      ctx.stroke();

      const fillH = Math.max(38, Math.min(118, 38 + mixItems.length * 22));
      ctx.fillStyle = mixColor;
      KitchenArt.rr(ctx, -66, 36 - fillH, 132, fillH, 14);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(92, 61, 46, 0.16)';
      KitchenArt.ell(ctx, 0, 16, 144, 88);
      ctx.fill();

      ctx.fillStyle = '#9CC5B5';
      ctx.strokeStyle = KitchenArt.OUTLINE;
      ctx.lineWidth = 4;
      KitchenArt.ell(ctx, 0, 0, 140, 84);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = mixColor;
      KitchenArt.ell(ctx, 0, 2, 120, 70);
      ctx.fill();
      ctx.stroke();
    }

    // Swirling Cream Ribbons & Floating Ingredient Slices
    ctx.save();
    ctx.translate(0, mixMode === 'blender' ? -20 : 0);
    ctx.rotate(mixAngle);
    ctx.strokeStyle = 'rgba(255, 253, 249, 0.82)';
    ctx.lineWidth = 4.5;
    for (let r = 18; r <= 60; r += 21) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 1.35);
      ctx.stroke();
    }
    mixItems.forEach((it, idx) => {
      const a = (idx * PI2) / Math.max(1, mixItems.length);
      const rad = (1 - mixProgress * 0.7) * 42;
      const scaleR = Math.max(10, 25 * (1 - mixProgress * 0.6));
      KitchenArt.drawIngredient(ctx, it.id, Math.cos(a) * rad, Math.sin(a) * rad * 0.65, scaleR, {
        sliced: true,
        shadow: false,
      });
    });
    ctx.restore();

    // Wooden Balloon Whisk inside Bowl
    if (mixMode === 'bowl') {
      ctx.save();
      ctx.translate(Math.cos(mixAngle) * 28, -18 + Math.sin(mixAngle) * 16);
      ctx.rotate(0.45 + Math.sin(mixAngle) * 0.25);
      ctx.strokeStyle = '#8C9BA5';
      ctx.lineWidth = 2.5;
      KitchenArt.ell(ctx, 0, 6, 15, 24);
      ctx.stroke();
      KitchenArt.ell(ctx, 0, 6, 7, 24);
      ctx.stroke();
      ctx.fillStyle = '#D48C56';
      ctx.strokeStyle = KitchenArt.OUTLINE;
      ctx.lineWidth = 3;
      KitchenArt.rr(ctx, -7, -64, 14, 56, 7);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Right-Side Pinterest Progress Card (100% Vector Icons)
    const rx = cx + 178, ry = cy - 38;
    KitchenArt.rr(ctx, rx, ry, 182, 78, 18);
    ctx.fillStyle = 'rgba(255, 253, 249, 0.95)';
    ctx.fill();
    ctx.strokeStyle = '#D9B89C';
    ctx.lineWidth = 2.8;
    ctx.stroke();
    KitchenArt.drawIcon(ctx, mixMode === 'blender' ? 'blender' : 'bowl', rx + 64, ry + 24, 15, t);
    KitchenArt.drawIcon(ctx, 'star', rx + 114, ry + 24, 14, t);
    KitchenArt.rr(ctx, rx + 18, ry + 48, 146, 14, 7);
    ctx.fillStyle = '#EFE2D2';
    ctx.fill();
    if (mixProgress > 0) {
      KitchenArt.rr(ctx, rx + 18, ry + 48, Math.max(14, 146 * mixProgress), 14, 7);
      ctx.fillStyle = '#78C47C';
      ctx.fill();
    }
  }

  /* ==========================================================================
   * Station 3: Enameled Cast-Iron Skillet & French Patisserie Oven
   * ========================================================================== */
  function renderCookStation(ctx) {
    const cx = W * 0.46, cy = H * 0.69;

    drawCanvasIconCard(ctx, 36, cy - 58, 118, 44, cookMode === 'pan', 'pan');
    drawCanvasIconCard(ctx, 36, cy - 6,  118, 44, cookMode === 'oven', 'oven');

    if (cookMode === 'pan') {
      [1, 2, 3].forEach(lvl => {
        const active = heatLevel === lvl;
        const bx = 36 + (lvl - 1) * 40, by = cy + 46;
        KitchenArt.rr(ctx, bx, by, 36, 34, 12);
        ctx.fillStyle = active ? '#E8998D' : '#FFFDF9';
        ctx.fill();
        ctx.strokeStyle = active ? KitchenArt.OUTLINE : '#D9B89C';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.fillStyle = active ? '#FFF29C' : '#F5A623';
        for (let k = 0; k < lvl; k++) {
          const fx = bx + 18 + (k - (lvl - 1) / 2) * 8;
          KitchenArt.circ(ctx, fx, by + 18, 4.5);
          ctx.fill();
        }
      });
    }

    if (cookMode === 'oven') {
      ctx.fillStyle = '#F4D5B8';
      ctx.strokeStyle = KitchenArt.OUTLINE;
      ctx.lineWidth = 4;
      KitchenArt.rr(ctx, cx - 145, cy - 86, 290, 165, 26);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFE8A3';
      KitchenArt.rr(ctx, cx - 112, cy - 60, 224, 112, 18);
      ctx.fill();
      ctx.stroke();

      const rise = 0.65 + Math.min(1, cookProgress / 0.75) * 0.45;
      ctx.save();
      ctx.translate(cx, cy + 20);
      ctx.scale(rise * boardSpring.sx, rise * boardSpring.sy);
      const batterTint = dish.liquidColor || mixColor || '#FFF3C4';
      ctx.fillStyle = KitchenArt.lerpColor(batterTint, '#E69849', Math.min(0.65, cookProgress / 0.85));
      ctx.strokeStyle = KitchenArt.OUTLINE;
      ctx.lineWidth = 3;
      KitchenArt.rr(ctx, -75, -42, 150, 56, 20);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      const flameCols = ['#7BC4E8', '#F5A623', '#E85D4A'];
      ctx.fillStyle = flameCols[heatLevel - 1] || '#F5A623';
      for (let k = 0; k < 12; k++) {
        const a = (k * PI2) / 12 + t * 3;
        KitchenArt.circ(ctx, cx + Math.cos(a) * 128, cy + 6 + Math.sin(a) * 78, 6 + heatLevel * 2.5);
        ctx.fill();
      }

      ctx.save();
      const handleShake = flipAnim > 0 ? Math.sin(flipAnim * Math.PI) * -14 : 0;
      ctx.translate(0, handleShake);
      // Warm walnut skillet handle
      ctx.fillStyle = '#C87D4B';
      ctx.strokeStyle = KitchenArt.OUTLINE;
      ctx.lineWidth = 4;
      KitchenArt.rr(ctx, cx + 112, cy - 13, 98, 26, 12);
      ctx.fill();
      ctx.stroke();

      // Coral Le Creuset skillet exterior rim & charcoal interior
      ctx.fillStyle = '#E07A5F';
      KitchenArt.ell(ctx, cx, cy, 140, 86);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#4A403B';
      KitchenArt.ell(ctx, cx, cy, 122, 72);
      ctx.fill();

      const tossY = flipAnim > 0 ? -Math.sin(flipAnim * Math.PI) * 92 : 0;
      const tossScale = 1 + Math.sin(flipAnim * Math.PI) * 0.24;
      ctx.save();
      ctx.translate(cx, cy + tossY);
      ctx.scale(tossScale * boardSpring.sx, tossScale * boardSpring.sy);
      if (flipAnim > 0) ctx.rotate(flipAnim * PI2);

      if (panItems.some(p => p.id === 'dough' || p.id === 'pizzabase')) {
        KitchenArt.drawIngredient(ctx, 'dough', 0, 0, 70, { cooked: cookProgress });
      }
      panItems.forEach(p => {
        if (p.id === 'dough' || p.id === 'pizzabase') return;
        KitchenArt.drawIngredient(ctx, p.id, p.x, p.y, 36, {
          sliced: p.sliced,
          cracked: p.cracked,
          cooked: cookProgress,
        });
      });
      ctx.restore();

      // Wavy patisserie steam ribbons rising from skillet
      ctx.strokeStyle = 'rgba(255, 253, 249, 0.58)';
      ctx.lineWidth = 3;
      for (let s = -1; s <= 1; s++) {
        const sx = cx + s * 46;
        const wave = Math.sin(t * 3 + s) * 8;
        ctx.beginPath();
        ctx.moveTo(sx, cy - 24);
        ctx.quadraticCurveTo(sx + wave, cy - 52, sx - wave, cy - 82);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Right-Side Doneness Thermometer Card (100% Vector Icons)
    const rx = cx + 220, ry = cy - 48;
    KitchenArt.rr(ctx, rx, ry, 196, 86, 18);
    ctx.fillStyle = 'rgba(255, 253, 249, 0.95)';
    ctx.fill();
    ctx.strokeStyle = cookProgress > 1.08 ? '#E85D4A' : '#D9B89C';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    KitchenArt.drawIcon(ctx, cookMode === 'oven' ? 'oven' : 'pan', rx + 70, ry + 24, 15, t);
    KitchenArt.drawIcon(ctx, 'star', rx + 124, ry + 24, 14, t);

    const barX = rx + 16, barY = ry + 48, barW = 164, barH = 14;
    const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    g.addColorStop(0, '#FCE8A6');
    g.addColorStop(0.55, '#F5A623');
    g.addColorStop(0.82, '#78C47C');
    g.addColorStop(1, '#4A3228');
    KitchenArt.rr(ctx, barX, barY, barW, barH, 7);
    ctx.fillStyle = g;
    ctx.fill();
    const needleX = barX + Math.min(1, cookProgress / 1.25) * barW;
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = KitchenArt.OUTLINE;
    ctx.lineWidth = 2.5;
    KitchenArt.circ(ctx, needleX, barY + 7, 9);
    ctx.fill();
    ctx.stroke();
  }

  /* ==========================================================================
   * Station 4: Scalloped Cake Stand & Pastry Piping Atelier
   * ========================================================================== */
  function renderDecorateStation(ctx) {
    const cx = W * 0.46, cy = H * 0.69;
    drawCanvasIconCard(ctx, 36, cy - 42, 118, 46, dish.vessel === 'plate', 'plate');
    drawCanvasIconCard(ctx, 36, cy + 14, 118, 46, dish.vessel === 'cup',   'cup');

    KitchenArt.drawDish(ctx, dish, cx, cy, 1.08 * boardSpring.sx, t);

    // Floating Illustrated Pastry Piping Bag / Sauce Dipper following pointer!
    if (Math.hypot(hoverPt.x - cx, hoverPt.y - cy) < 165) {
      ctx.save();
      ctx.translate(hoverPt.x + 22, hoverPt.y - 26);
      KitchenArt.drawIcon(ctx, decorTool === 'sauce' ? 'sauce' : (decorTool === 'topping' ? 'topping' : 'cupcake'), 0, 0, 22, t);
      ctx.restore();
    }
  }

  /* ==========================================================================
   * Station 5: Interactive Silver Dessert Fork / Boba Spoon Feeding
   * ========================================================================== */
  function renderFeedStation(ctx) {
    const cx = W * 0.46, cy = H * 0.67;
    KitchenArt.drawDish(ctx, dish, cx, cy, 1.05 * boardSpring.sx, t);

    // Dotted helper curve from dish to Critter's mouth
    if (dish.bitesTaken === 0 && !fork.dragging) {
      ctx.save();
      ctx.strokeStyle = 'rgba(232, 131, 136, 0.65)';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(fork.x - 18, fork.y - 22);
      ctx.quadraticCurveTo(W * 0.56, H * 0.42, W * 0.46, H * 0.28);
      ctx.stroke();
      ctx.restore();
    }

    // Custom-Illustrated Silver Dessert Fork / Spoon with Food Bite Loaded!
    ctx.save();
    ctx.translate(fork.x, fork.y);
    ctx.rotate(-0.55);
    ctx.fillStyle = '#DCE4E8';
    ctx.strokeStyle = KitchenArt.OUTLINE;
    ctx.lineWidth = 2.8;
    // Handle
    KitchenArt.rr(ctx, -7, 0, 14, 62, 7);
    ctx.fill();
    ctx.stroke();
    // Spoon bowl / Fork head
    KitchenArt.ell(ctx, 0, -14, 16, 22);
    ctx.fill();
    ctx.stroke();
    if (fork.dragging || dish.bitesTaken < 3) {
      const sampleId = dish.items.length > 0 ? dish.items[0].id : 'strawberry';
      KitchenArt.drawIngredient(ctx, sampleId, 0, -16, 18, { sliced: true, cooked: 0.72, shadow: false });
    }
    ctx.restore();
  }

  function drawCanvasIconCard(ctx, x, y, w, h, active, iconKind) {
    ctx.save();
    KitchenArt.rr(ctx, x, y, w, h, 16);
    ctx.fillStyle = active ? '#E8998D' : '#FFFDF9';
    ctx.fill();
    ctx.strokeStyle = active ? KitchenArt.OUTLINE : '#D9B89C';
    ctx.lineWidth = 2.8;
    ctx.stroke();
    KitchenArt.drawIcon(ctx, iconKind, x + w / 2, y + h / 2, 18, t);
    ctx.restore();
  }

  /* ==========================================================================
   * Pointer / Touch Gesture Handling on Canvas
   * ========================================================================== */
  let pointerDown = false;
  let lastPt = null;
  let lastChopTime = -1;

  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function onPointerDown(e) {
    KitchenAudio.ensure();
    const pt = canvasCoords(e);
    pointerDown = true;
    lastPt = pt;
    hoverPt = pt;
    const cx = W * 0.46, cy = H * 0.68;

    if (Math.hypot(pt.x - W * 0.46, pt.y - H * 0.25) < 75 && station !== 5) {
      KitchenAudio.critterChime(critterIdx);
      spawnParticles(W * 0.46, H * 0.22, '#E88388', 10, 'heart');
      return;
    }

    if (station === 1) {
      if (Math.hypot(pt.x - cx, pt.y - cy) < 175) {
        lastChopTime = t;
        chopBoardItem();
      }
    } else if (station === 2) {
      if (pt.x >= 32 && pt.x <= 160) {
        if (pt.y >= cy - 58 && pt.y <= cy) { mixMode = 'bowl'; dish.vessel = 'plate'; renderPrimaryActionButton(); return; }
        if (pt.y >= cy + 4 && pt.y <= cy + 62) { mixMode = 'blender'; dish.vessel = 'cup'; renderPrimaryActionButton(); return; }
      }
      if (Math.hypot(pt.x - cx, pt.y - cy) < 160) {
        stirMixer(0.2);
      }
    } else if (station === 3) {
      if (pt.x >= 32 && pt.x <= 170) {
        if (pt.y >= cy - 62 && pt.y <= cy - 10) { cookMode = 'pan'; renderPrimaryActionButton(); return; }
        if (pt.y >= cy - 8 && pt.y <= cy + 42) { cookMode = 'oven'; renderPrimaryActionButton(); return; }
        if (cookMode === 'pan' && pt.y >= cy + 44 && pt.y <= cy + 86) {
          const idx = Math.floor((pt.x - 36) / 40) + 1;
          if (idx >= 1 && idx <= 3) { heatLevel = idx; KitchenAudio.sizzleTick(heatLevel); return; }
        }
      }
      if (Math.hypot(pt.x - cx, pt.y - cy) < 190) {
        flipPan();
      }
    } else if (station === 4) {
      if (pt.x >= 32 && pt.x <= 160) {
        if (pt.y >= cy - 44 && pt.y <= cy + 8) { dish.vessel = 'plate'; return; }
        if (pt.y >= cy + 12 && pt.y <= cy + 64) { dish.vessel = 'cup'; return; }
      }
      const lx = (pt.x - cx) / 1.08;
      const ly = (pt.y - cy) / 1.08;
      for (const tp of dish.toppings) {
        if (tp.id === 'candle' && !tp.blownOut && Math.hypot(tp.x - lx, tp.y - (ly + 24)) < 32) {
          tp.blownOut = true;
          KitchenAudio.blowCandle();
          spawnParticles(cx + tp.x, cy + tp.y - 32, 'rgba(200,190,180,0.8)', 14, 'smoke');
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
          KitchenAudio.pour();
        } else if (decorTool === 'topping') {
          addToppingAt(lx, ly);
        }
      }
    } else if (station === 5) {
      fork.dragging = true;
      fork.x = pt.x;
      fork.y = pt.y;
      updateForkMouthTracking(pt);
    }
  }

  function onPointerMove(e) {
    const pt = canvasCoords(e);
    hoverPt = pt;
    const cx = W * 0.46, cy = H * 0.68;

    critterAnim.lookX = Math.max(-1, Math.min(1, (pt.x - W * 0.46) / 180));
    critterAnim.lookY = Math.max(-1, Math.min(1, (pt.y - H * 0.25) / 140));

    if (!pointerDown) return;

    if (station === 1 && lastPt) {
      slashTrail.push({ x: pt.x, y: pt.y, t });
      if (t - lastChopTime > 0.16 && Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) > 48 && Math.hypot(pt.x - cx, pt.y - cy) < 160) {
        lastPt = pt;
        lastChopTime = t;
        chopBoardItem();
      }
    } else if (station === 2 && lastPt) {
      if (Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) > 26 && Math.hypot(pt.x - cx, pt.y - cy) < 155) {
        lastPt = pt;
        stirMixer(0.08);
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
          }
        }
      }
    } else if (station === 5 && fork.dragging) {
      fork.x = pt.x;
      fork.y = pt.y;
      updateForkMouthTracking(pt);
    }
  }

  function updateForkMouthTracking(pt) {
    const mouthX = W * 0.46, mouthY = H * 0.27;
    const dist = Math.hypot(pt.x - mouthX, pt.y - mouthY);
    critterAnim.mouthOpen = Math.max(0, Math.min(1, 1 - (dist - 40) / 160));
    if (dist < 62) {
      fork.dragging = false;
      fork.x = fork.homeX;
      fork.y = fork.homeY;
      feedOneBite();
    }
  }

  function onPointerUp() {
    pointerDown = false;
    activeStroke = null;
    if (fork.dragging) {
      if (fork.y < H * 0.45) {
        feedOneBite();
      }
      fork.dragging = false;
      fork.x = fork.homeX;
      fork.y = fork.homeY;
      critterAnim.mouthOpen = 0;
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
        KitchenAudio.critterChime(idx);
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
        KitchenAudio.popSelect(1);
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

    prepTray.slice(-6).forEach(p => {
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
        KitchenAudio.popSelect(2);
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
        b.onclick = () => { pipingColorIdx = idx; KitchenAudio.popSelect(idx); renderDecorToolbar(); };
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
        b.onclick = () => { sauceIdx = idx; KitchenAudio.popSelect(idx); renderDecorToolbar(); };
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
        b.onclick = () => { toppingIdx = idx; KitchenAudio.popSelect(idx); renderDecorToolbar(); };
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
    KitchenAudio.ensure();
    if (station === 1) {
      if (boardItem) chopBoardItem();
      else if (prepTray.length > 0) setStation(2);
      else chopBoardItem();
    } else if (station === 2) {
      if (mixProgress < 1) stirMixer(0.35);
      else setStation(3);
    } else if (station === 3) {
      if (cookProgress >= 0.65) setStation(4);
      else flipPan();
    } else if (station === 4) {
      if (dish.piping.length === 0 && dish.toppings.length === 0) {
        for (let a = 0; a < PI2; a += PI2 / 8) {
          addPipingPoint(Math.cos(a) * 52, Math.sin(a) * 34 - 16);
        }
        addToppingAt(0, -24);
      }
      setStation(5);
    } else if (station === 5) {
      if (dish.bitesTaken >= 3) {
        resetKitchenForNewDish(true);
      } else {
        feedOneBite();
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

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    document.querySelectorAll('.station-btn').forEach(btn => {
      btn.addEventListener('click', () => setStation(Number(btn.dataset.station)));
    });

    const pBtn = document.getElementById('primaryActionBtn');
    if (pBtn) pBtn.addEventListener('click', onPrimaryActionClick);

    const modeBtn = document.getElementById('modeToggleBtn');
    if (modeBtn) {
      modeBtn.addEventListener('click', () => {
        mode = mode === 'wish' ? 'free' : 'wish';
        KitchenAudio.popSelect(3);
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

  return {
    init,
    setStation,
    selectIngredient,
    chopBoardItem,
    stirMixer,
    flipPan,
    feedOneBite,
    resetKitchenForNewDish,
    openAlbumModal,
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
      reaction: critterAnim.reaction,
      starsEarned,
      albumCount: album.length,
    }),
  };
})();

window.addEventListener('DOMContentLoaded', () => KitchenGame.init());
