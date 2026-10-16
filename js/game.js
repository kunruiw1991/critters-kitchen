'use strict';
/* ==========================================================================
 * Chuyu's Rainbow Kitchen — 100% Zero-Text Visual & Spoken Engine for 5yo
 * 5 Stations: 1.🔪 -> 2.🥣 -> 3.🍳 -> 4.🧁 -> 5.🍽️
 * ========================================================================== */
const KitchenGame = (() => {
  const STORAGE_KEY = 'chuyu_rainbow_kitchen_v2';
  const PI2 = Math.PI * 2;
  let canvas, ctx;
  let W = 960, H = 560, dpr = 1;
  let t = 0, lastTs = 0;

  // Game Mode & Customer State
  let mode = 'wish'; // 'wish' | 'free'
  let critterIdx = 3; // Start with Bobby BearHug or current wish critter
  let orderIdx = 0;
  let station = 1; // 1:Chop, 2:Mix, 3:Cook, 4:Decorate, 5:Feed
  let activeCategory = 'fruit';

  // Station 1: Cutting Board State
  let boardItem = null; // { id, chops: 0, maxChops: 3, sliced: false, cracked: false, knifeAnim: 0 }
  let prepTray = [];    // Array of prepped items: { id, sliced, cracked, cooked: 0 }
  let slashTrail = [];  // Pointer swipe trail for chopping

  // Station 2: Mixing Bowl & Blender State
  let mixMode = 'bowl'; // 'bowl' | 'blender'
  let mixItems = [];    // Ingredients added to bowl/blender
  let mixProgress = 0;  // 0..1
  let mixAngle = 0;
  let mixColor = '#fff6d6';

  // Station 3: Skillet Pan & Oven State
  let cookMode = 'pan'; // 'pan' | 'oven'
  let heatLevel = 2;    // 1:Low, 2:Med, 3:High
  let panItems = [];    // Items currently on skillet/oven
  let cookProgress = 0; // 0..1.35 (0.65..0.98 = golden, >1.05 = burnt)
  let flipAnim = 0;     // 0..1 parabolic toss animation
  let sizzleTimer = 0;

  // Station 4 & 5: Plated Dish State
  let dish = createFreshDish();
  let decorTool = 'piping'; // 'piping' | 'sauce' | 'topping'
  let pipingColorIdx = 1;   // Pink cream default
  let sauceIdx = 0;         // Strawberry sauce default
  let toppingIdx = 0;       // Rainbow sprinkles default
  let activeStroke = null;

  // Station 5: Feeding Fork & Critter Reaction State
  let fork = { x: 0, y: 0, dragging: false, loaded: false, homeX: 0, homeY: 0 };
  let critterAnim = {
    mouthOpen: 0,
    chewing: 0,
    reaction: null,
    reactionTimer: 0,
    reactionBadge: '',
    lookX: 0,
    lookY: 0,
  };
  let particles = [];
  let starsEarned = 0;
  let album = [];

  function createFreshDish() {
    return {
      vessel: 'plate', // 'plate' | 'cup'
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
   * Particle Burst Helpers
   * ========================================================================== */
  function spawnParticles(x, y, color, count, kind) {
    for (let i = 0; i < (count || 12); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 140;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 50,
        r: 4 + Math.random() * 6,
        color: color || '#ff85b3',
        life: 0.65 + Math.random() * 0.45,
        maxLife: 1.0,
        kind: kind || 'circle',
      });
    }
  }

  /* ==========================================================================
   * Station 1: Select & Chop / Crack Ingredient
   * ========================================================================== */
  function selectIngredient(id) {
    const meta = KitchenData.getIngredient(id);
    KitchenAudio.ensure();
    KitchenAudio.speak(meta.zh, meta.en);

    if (station === 1) {
      boardItem = {
        id: meta.id,
        chops: 0,
        maxChops: meta.crackable ? 2 : (meta.choppable ? 3 : 1),
        sliced: false,
        cracked: false,
        knifeAnim: 0,
      };
      spawnParticles(W * 0.46, H * 0.62, meta.color, 10, 'circle');
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
    updateGuideBanner();
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

    if (meta.crackable) {
      KitchenAudio.crackEgg();
    } else if (meta.liquid) {
      KitchenAudio.pour();
    } else {
      KitchenAudio.chop(boardItem.chops);
    }
    spawnParticles(W * 0.46 + (Math.random() - 0.5) * 60, H * 0.62, meta.color, 14, 'circle');

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
          updateGuideBanner();
        }
      }, 320);
    }
    renderPrepTrayUI();
    updateGuideBanner();
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
    spawnParticles(W * 0.46, H * 0.6, meta.color, 12);
  }

  function recomputeMixColor() {
    if (!mixItems.length) {
      mixColor = '#fff5d6';
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
      dish.liquidColor = KitchenArt.lerpColor(last.color, '#ffffff', 0.3);
    } else if (!dish.liquidColor) {
      dish.liquidColor = '#ff9ebb';
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
    mixAngle += 0.85;
    if (mixMode === 'blender') {
      KitchenAudio.blendTick();
      dish.vessel = 'cup';
    } else {
      KitchenAudio.stir();
    }
    dish.liquidColor = mixColor;
    if (mixProgress >= 1) {
      spawnParticles(W * 0.46, H * 0.58, mixColor, 16);
    }
    updateGuideBanner();
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
    if (cookMode === 'oven') {
      cookProgress = Math.min(0.85, cookProgress + 0.45);
      dish.bakedCake = true;
      KitchenAudio.ovenDing();
      spawnParticles(W * 0.46, H * 0.58, '#ffd700', 20);
    } else {
      flipAnim = 1.0;
      cookProgress = Math.min(1.3, cookProgress + 0.28);
      KitchenAudio.flip();
      spawnParticles(W * 0.46, H * 0.55, '#ffb700', 16);
    }
    syncCookedStateToDish();
    updateGuideBanner();
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
      dish.liquidColor = '#ffadc6';
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
    KitchenAudio.pipeCream();
    updateGuideBanner();
  }

  function addToppingAt(localX, localY) {
    ensureDishHasBase();
    const topMeta = KitchenData.TOPPINGS[toppingIdx] || KitchenData.TOPPINGS[0];
    for (let tp of dish.toppings) {
      if (tp.id === 'candle' && !tp.blownOut && Math.hypot(tp.x - localX, tp.y - localY) < 28) {
        tp.blownOut = true;
        KitchenAudio.pipeCream();
        spawnParticles(W * 0.46 + tp.x, H * 0.62 + tp.y - 30, '#ffd700', 18);
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
    KitchenAudio.sprinkle();
    spawnParticles(W * 0.46 + localX, H * 0.62 + localY, '#ffd700', 8);
    updateGuideBanner();
  }

  /* ==========================================================================
   * Station 5: Bite-by-Bite Feeding & 8 Visual Reaction Evaluator (Zero Text)
   * ========================================================================== */
  function evaluateDishReaction() {
    const ids = dish.items.map(i => i.id);
    const anyBurnt = cookProgress > 1.08 || dish.items.some(i => (i.cooked || 0) > 1.08);
    if (anyBurnt) {
      return { kind: 'burnt', badge: '💨 🖤 😵', stars: 2 };
    }
    if (ids.includes('chili')) {
      return { kind: 'fire', badge: '🔥 🌶️ 🥵', stars: 3 };
    }
    if (ids.includes('lemon') && !ids.includes('honey') && !ids.includes('chocolate')) {
      return { kind: 'sour', badge: '🍋 😖 💦', stars: 3 };
    }
    const fruitCount = dish.items.filter(i => KitchenData.getIngredient(i.id).cat === 'fruit').length;
    if (dish.toppings.some(tp => tp.id === 'sprinkles') || fruitCount >= 3) {
      return { kind: 'rainbow', badge: '🌈 🦄 ✨', stars: 3 };
    }
    if (ids.includes('popcandy')) {
      return { kind: 'float', badge: '🎈 ☁️ ✨', stars: 3 };
    }
    if (ids.includes('icecream') && !dish.bakedCake) {
      return { kind: 'ice', badge: '🥶 ❄️ 🧊', stars: 3 };
    }
    if ((ids.includes('milk') && ids.includes('honey')) || (currentCritter().id === 'catnap' && (ids.includes('milk') || ids.includes('honey')))) {
      return { kind: 'sleepy', badge: '😴 🌙 💤', stars: 3 };
    }
    return { kind: 'love', badge: '😍 💖 ⭐', stars: 3 };
  }

  function feedOneBite() {
    ensureDishHasBase();
    if (dish.bitesTaken >= 3) {
      dish.bitesTaken = 0;
    }
    dish.bitesTaken++;
    critterAnim.chewing = 1.1;
    critterAnim.mouthOpen = 0;
    KitchenAudio.bite(dish.vessel === 'cup');
    spawnParticles(W * 0.46, H * 0.25, '#ff85b3', 16);

    const rxn = evaluateDishReaction();
    critterAnim.reaction = rxn.kind;
    critterAnim.reactionTimer = 4.5;
    critterAnim.reactionBadge = rxn.badge;
    KitchenAudio.reaction(rxn.kind);

    if (dish.bitesTaken === 1) {
      starsEarned += rxn.stars;
      saveDishSnapshotToAlbum(rxn);
    }
    updateGuideBanner();
  }

  function saveDishSnapshotToAlbum(rxn) {
    try {
      const snapCv = document.createElement('canvas');
      snapCv.width = 220;
      snapCv.height = 160;
      const sctx = snapCv.getContext('2d');
      sctx.fillStyle = '#fff5f8';
      sctx.fillRect(0, 0, 220, 160);
      const savedBites = dish.bitesTaken;
      dish.bitesTaken = 0;
      KitchenArt.drawDish(sctx, dish, 110, 92, 0.55, t);
      dish.bitesTaken = savedBites;

      const c = currentCritter();
      album.unshift({
        critterIcon: c.icon,
        reactionBadge: rxn.badge,
        stars: rxn.stars,
        dataUrl: snapCv.toDataURL('image/jpeg', 0.82),
      });
      saveStorage();
      KitchenAudio.shutter();
    } catch (e) {}
  }

  /* ==========================================================================
   * Station Switching & Visual Pictogram Guide Bar (100% Zero Text)
   * ========================================================================== */
  function setStation(num) {
    station = num;
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
    fork.y = H * 0.64;
    fork.homeX = W * 0.68;
    fork.homeY = H * 0.64;
    updateGuideBanner();
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
    critterAnim.reactionBadge = '';
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

  function updateGuideBanner() {
    const el = document.getElementById('stepPromptText');
    const btn = document.getElementById('primaryActionBtn');
    if (!el || !btn) return;

    if (station === 1) {
      if (boardItem) {
        const m = KitchenData.getIngredient(boardItem.id);
        const dots = '🟢'.repeat(boardItem.chops) + '⚪'.repeat(Math.max(0, boardItem.maxChops - boardItem.chops));
        el.textContent = `${m.emoji} ➡️ ${m.crackable ? '🥚💥' : '🔪'}  ${dots}`;
        btn.textContent = m.crackable ? '🥚💥' : '🔪✨';
      } else if (prepTray.length > 0) {
        const icons = prepTray.slice(-5).map(p => KitchenData.getIngredient(p.id).emoji).join(' ');
        el.textContent = `✅ ${icons} ➡️ 🥣 / 🍳`;
        btn.textContent = '➡️ 🥣';
      } else {
        el.textContent = '👆 🍓 🍌 🥚 ➡️ 🔪';
        btn.textContent = '🔪✨';
      }
    } else if (station === 2) {
      const done = mixProgress >= 1;
      el.textContent = `${mixMode === 'blender' ? '🧋' : '🥣'} 🔄 🌀 ${done ? '✅ ➡️ 🍳' : '✨'}`;
      btn.textContent = done ? '➡️ 🍳' : (mixMode === 'blender' ? '🧋⚡' : '🥣🌀');
    } else if (station === 3) {
      if (cookProgress > 1.08) {
        el.textContent = '💨 🖤 😵 ➡️ 🧁';
        btn.textContent = '➡️ 🧁';
      } else if (cookProgress >= 0.65) {
        el.textContent = '😋 ⭐ ✅ ➡️ 🧁';
        btn.textContent = '➡️ 🧁';
      } else {
        el.textContent = `${cookMode === 'oven' ? '⏲️' : '🍳'} 🔥 🔄 ➡️ 😋`;
        btn.textContent = cookMode === 'oven' ? '⏲️✨' : '🍳🔄';
      }
    } else if (station === 4) {
      el.textContent = '👆 🧁 🍯 🌈 🕯️ ➡️ 🍽️';
      btn.textContent = '➡️ 🍽️';
    } else if (station === 5) {
      const bites = '⭐'.repeat(dish.bitesTaken) + '⚪'.repeat(Math.max(0, 3 - dish.bitesTaken));
      el.textContent = `🍴 ➡️ 👄 😋  ${bites}`;
      btn.textContent = dish.bitesTaken >= 3 ? '🔄✨' : '🥄😋';
    }
  }

  /* ==========================================================================
   * Main Canvas Render Loop (Kitchen Counter + Critter + Active Station)
   * ========================================================================== */
  function render(now) {
    requestAnimationFrame(render);
    const dt = Math.min(0.05, (now - (lastTs || now)) / 1000);
    lastTs = now;
    t += dt;

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
          x: W * 0.46 + (Math.random() - 0.5) * 150,
          y: H * 0.64 + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 20,
          vy: -35 - Math.random() * 45,
          r: 4 + Math.random() * 6,
          color: cookProgress > 1.05 ? 'rgba(60,50,45,0.65)' : 'rgba(255,250,220,0.7)',
          life: 0.7,
          maxLife: 0.7,
          kind: 'smoke',
        });
      }
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Cozy Pastel Kitchen Wallpaper & Window Backdrop
    const wallGrad = ctx.createLinearGradient(0, 0, 0, H * 0.46);
    wallGrad.addColorStop(0, '#ffeef5');
    wallGrad.addColorStop(1, '#fff9e8');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, W, H * 0.46);

    ctx.fillStyle = 'rgba(255, 182, 209, 0.18)';
    for (let x = 20; x < W; x += 56) {
      ctx.fillRect(x, 0, 22, H * 0.46);
    }

    // Kitchen shelf & cute storybook jars on top right wall
    ctx.fillStyle = '#f0c49b';
    ctx.strokeStyle = '#c99364';
    ctx.lineWidth = 3;
    KitchenArt.rr(ctx, W - 245, 96, 210, 12, 6);
    ctx.fill();
    ctx.stroke();
    ctx.font = '24px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ['🍯', '🍓', '🧂', '🪴'].forEach((em, idx) => {
      ctx.fillText(em, W - 215 + idx * 50, 82);
    });

    // 2. Animated Critter Customer sitting behind the counter
    const critter = currentCritter();
    const critterX = W * 0.46;
    const critterY = H * 0.25;
    KitchenArt.drawCritterCustomer(ctx, critter, critterX, critterY, 1.08, critterAnim, t);

    // 3. Wish Order Picture Bubble (100% Visual Icons, Zero Text!)
    drawWishBubble(ctx, 32, 48);

    // 4. Marble & Warm Wood Kitchen Countertop
    const counterY = H * 0.43;
    const counterGrad = ctx.createLinearGradient(0, counterY, 0, H);
    counterGrad.addColorStop(0, '#fffdf9');
    counterGrad.addColorStop(0.12, '#fdf3e7');
    counterGrad.addColorStop(1, '#f3dec7');
    ctx.fillStyle = counterGrad;
    ctx.fillRect(0, counterY, W, H - counterY);

    ctx.strokeStyle = '#e0bfa0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, counterY);
    ctx.lineTo(W, counterY);
    ctx.stroke();

    // 5. Render Active Kitchen Station on Countertop
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

    // 6. Render Particles & Swipe Slash Trail
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind !== 'smoke') p.vy += 240 * dt;
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      KitchenArt.circ(ctx, p.x, p.y, p.r * (p.kind === 'smoke' ? 1.5 - p.life * 0.5 : 1));
      ctx.fill();
      ctx.restore();
    }

    if (slashTrail.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
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

  function drawWishBubble(ctx, x, y) {
    ctx.save();
    KitchenArt.rr(ctx, x, y, 258, 128, 22);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();
    ctx.strokeStyle = '#ffb3cf';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Pointer triangle toward Critter
    ctx.beginPath();
    ctx.moveTo(x + 258, y + 54);
    ctx.lineTo(x + 274, y + 66);
    ctx.lineTo(x + 258, y + 78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (mode === 'wish') {
      const ord = currentOrder();
      const cookIcon = ord.wantCooking === 'oven' ? '⏲️' : (ord.wantCooking === 'blender' ? '🧋' : '🍳');
      ctx.font = '22px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`💭 ➡️ ${cookIcon}`, x + 129, y + 24);

      const usedIds = new Set([
        ...prepTray.map(i => i.id),
        ...mixItems.map(i => i.id),
        ...dish.items.map(i => i.id),
      ]);

      const slots = [0, 1, 2];
      slots.forEach(idx => {
        const bx = x + 48 + idx * 80;
        const by = y + 80;
        const id = ord.wantIds[idx];
        const done = id ? usedIds.has(id) : (dish.piping.length > 0 || dish.toppings.length > 0 || cookProgress >= 0.6);
        ctx.fillStyle = done ? '#e6ffed' : '#fff5f8';
        ctx.strokeStyle = done ? '#34c759' : '#ffd1e0';
        ctx.lineWidth = 2.5;
        KitchenArt.circ(ctx, bx, by, 28);
        ctx.fill();
        ctx.stroke();
        if (id) {
          const ing = KitchenData.getIngredient(id);
          KitchenArt.drawIngredient(ctx, id, bx, by, 21, { sliced: done && ing.choppable, shadow: false });
        } else {
          ctx.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ord.icons[idx] || '🧁', bx, by + 2);
        }
        if (done) {
          ctx.font = '16px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✅', bx + 20, by - 20);
        }
      });
    } else {
      ctx.font = '24px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🌈 🎨 ✨', x + 129, y + 32);
      ctx.font = '20px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.fillText('🌶️➡️🔥   🍋➡️😖', x + 129, y + 68);
      ctx.fillText('🍦➡️🥶   ✨➡️🎈', x + 129, y + 102);
    }
    ctx.restore();
  }

  /* ==========================================================================
   * Station 1 Renderer: Wooden Cutting Board + Chef Knife (Zero Text)
   * ========================================================================== */
  function renderChopStation(ctx) {
    const cx = W * 0.46, cy = H * 0.66;
    ctx.fillStyle = 'rgba(40,20,10,0.16)';
    KitchenArt.rr(ctx, cx - 175, cy - 82, 350, 174, 26);
    ctx.fill();

    ctx.fillStyle = '#e8b478';
    ctx.strokeStyle = '#b57c42';
    ctx.lineWidth = 5;
    KitchenArt.rr(ctx, cx - 175, cy - 90, 350, 172, 26);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#cf9658';
    ctx.lineWidth = 2.5;
    KitchenArt.rr(ctx, cx - 155, cy - 72, 310, 136, 18);
    ctx.stroke();

    if (boardItem) {
      const meta = KitchenData.getIngredient(boardItem.id);
      const isSliced = boardItem.chops >= boardItem.maxChops && meta.choppable;
      if (meta.crackable) {
        KitchenArt.drawIngredient(ctx, boardItem.id, cx, cy - 2, 54, {
          cracked: boardItem.chops >= 1,
          showShell: boardItem.chops >= 1,
        });
      } else if (isSliced || boardItem.chops > 0) {
        const pieces = Math.min(4, boardItem.chops + 1);
        for (let i = 0; i < pieces; i++) {
          const ox = (i - (pieces - 1) / 2) * 44;
          KitchenArt.drawIngredient(ctx, boardItem.id, cx + ox, cy - 6, 44, {
            sliced: boardItem.chops >= 1 && meta.choppable,
          });
        }
      } else {
        KitchenArt.drawIngredient(ctx, boardItem.id, cx, cy - 6, 58, { sliced: false });
      }

      // Progress dots above board
      for (let i = 0; i < boardItem.maxChops; i++) {
        ctx.fillStyle = i < boardItem.chops ? '#38d968' : '#ffffff';
        ctx.strokeStyle = '#b57c42';
        ctx.lineWidth = 2;
        KitchenArt.circ(ctx, cx - ((boardItem.maxChops - 1) * 14) + i * 28, cy - 66, 8);
        ctx.fill();
        ctx.stroke();
      }

      // Cute Chef Knife / Egg Whisk icon hovering on right
      const kOffset = boardItem.knifeAnim * 28;
      ctx.save();
      ctx.translate(cx + 115 - kOffset, cy - 35 + kOffset);
      ctx.rotate(-0.35 - boardItem.knifeAnim * 0.45);
      ctx.font = '54px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta.crackable ? '🥄' : '🔪', 0, 0);
      ctx.restore();
    } else {
      // Pure visual pictogram cue on empty cutting board
      const bounceY = Math.sin(t * 5) * 6;
      ctx.font = '44px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🍓  🔪  👆', cx, cy + bounceY);
    }
  }

  /* ==========================================================================
   * Station 2 Renderer: Swirling Mixing Bowl & Boba Smoothie Blender (Zero Text)
   * ========================================================================== */
  function renderMixStation(ctx) {
    const cx = W * 0.46, cy = H * 0.68;

    drawCanvasButton(ctx, 36, cy - 52, 128, 48, mixMode === 'bowl', '🥣');
    drawCanvasButton(ctx, 36, cy + 8,  128, 48, mixMode === 'blender', '🧋');

    if (mixMode === 'blender') {
      ctx.fillStyle = '#ff6b9d';
      ctx.strokeStyle = '#c43c6b';
      ctx.lineWidth = 4;
      KitchenArt.rr(ctx, cx - 64, cy + 40, 128, 38, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(235, 248, 255, 0.78)';
      ctx.strokeStyle = '#8cc8e8';
      ctx.lineWidth = 4;
      KitchenArt.rr(ctx, cx - 72, cy - 92, 144, 136, 20);
      ctx.fill();
      ctx.stroke();

      const fillH = Math.max(36, Math.min(120, 36 + mixItems.length * 22));
      ctx.fillStyle = mixColor;
      KitchenArt.rr(ctx, cx - 66, cy + 38 - fillH, 132, fillH, 14);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(40,25,15,0.15)';
      KitchenArt.ell(ctx, cx, cy + 14, 142, 86);
      ctx.fill();

      ctx.fillStyle = '#fffdf9';
      ctx.strokeStyle = '#7ec8e8';
      ctx.lineWidth = 6;
      KitchenArt.ell(ctx, cx, cy, 138, 82);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = mixColor;
      KitchenArt.ell(ctx, cx, cy + 2, 118, 68);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(cx, mixMode === 'blender' ? cy - 20 : cy);
    ctx.rotate(mixAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.78)';
    ctx.lineWidth = 4;
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

    if (mixMode === 'bowl') {
      ctx.save();
      ctx.translate(cx + Math.cos(mixAngle) * 28, cy - 18 + Math.sin(mixAngle) * 16);
      ctx.rotate(0.45 + Math.sin(mixAngle) * 0.25);
      ctx.fillStyle = '#c98848';
      ctx.strokeStyle = '#8c5420';
      ctx.lineWidth = 3;
      KitchenArt.rr(ctx, -6, -68, 12, 62, 6);
      ctx.fill();
      ctx.stroke();
      KitchenArt.ell(ctx, 0, 2, 16, 22);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Right-Side Visual Progress Card (Pure Icons + Progress Bar)
    const rx = cx + 175, ry = cy - 36;
    KitchenArt.rr(ctx, rx, ry, 185, 76, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.strokeStyle = '#ffb3cf';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.font = '24px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mixProgress >= 1 ? '🥣 ✨ ✅' : '🥣 🌀 ✨', rx + 92, ry + 24);
    KitchenArt.rr(ctx, rx + 18, ry + 46, 148, 14, 7);
    ctx.fillStyle = '#ffe3ed';
    ctx.fill();
    if (mixProgress > 0) {
      KitchenArt.rr(ctx, rx + 18, ry + 46, Math.max(14, 148 * mixProgress), 14, 7);
      ctx.fillStyle = '#34c759';
      ctx.fill();
    }
  }

  /* ==========================================================================
   * Station 3 Renderer: Sizzling Skillet Pan & Magic Bakery Oven (Zero Text)
   * ========================================================================== */
  function renderCookStation(ctx) {
    const cx = W * 0.46, cy = H * 0.68;

    drawCanvasButton(ctx, 36, cy - 58, 128, 44, cookMode === 'pan', '🍳');
    drawCanvasButton(ctx, 36, cy - 6,  128, 44, cookMode === 'oven', '⏲️');

    if (cookMode === 'pan') {
      [1, 2, 3].forEach(lvl => {
        const active = heatLevel === lvl;
        drawCanvasButton(ctx, 36 + (lvl - 1) * 50, cy + 46, 46, 36, active, '🔥'.repeat(lvl));
      });
    }

    if (cookMode === 'oven') {
      ctx.fillStyle = '#ff85a2';
      ctx.strokeStyle = '#c94a6a';
      ctx.lineWidth = 5;
      KitchenArt.rr(ctx, cx - 145, cy - 86, 290, 165, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff0b8';
      ctx.strokeStyle = '#7a3b4e';
      ctx.lineWidth = 4;
      KitchenArt.rr(ctx, cx - 112, cy - 62, 224, 114, 16);
      ctx.fill();
      ctx.stroke();

      const rise = 0.65 + Math.min(1, cookProgress / 0.75) * 0.45;
      ctx.save();
      ctx.translate(cx, cy + 20);
      ctx.scale(rise, rise);
      const batterTint = dish.liquidColor || mixColor || '#fff3c4';
      ctx.fillStyle = KitchenArt.lerpColor(batterTint, '#e89b3c', Math.min(0.65, cookProgress / 0.85));
      ctx.strokeStyle = '#b86f18';
      ctx.lineWidth = 3;
      KitchenArt.rr(ctx, -75, -42, 150, 56, 20);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      const flameCols = ['#38b6ff', '#ff9e00', '#ff3b3b'];
      ctx.fillStyle = flameCols[heatLevel - 1] || '#ff9e00';
      for (let k = 0; k < 12; k++) {
        const a = (k * PI2) / 12 + t * 3;
        KitchenArt.circ(ctx, cx + Math.cos(a) * 128, cy + 6 + Math.sin(a) * 78, 7 + heatLevel * 3);
        ctx.fill();
      }

      ctx.save();
      const handleShake = flipAnim > 0 ? Math.sin(flipAnim * Math.PI) * -14 : 0;
      ctx.translate(0, handleShake);
      ctx.fillStyle = '#383842';
      ctx.strokeStyle = '#1e1e24';
      ctx.lineWidth = 5;
      KitchenArt.rr(ctx, cx + 112, cy - 13, 98, 26, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#2b2b33';
      KitchenArt.ell(ctx, cx, cy, 138, 84);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#3d3d47';
      KitchenArt.ell(ctx, cx, cy, 120, 70);
      ctx.fill();

      const tossY = flipAnim > 0 ? -Math.sin(flipAnim * Math.PI) * 90 : 0;
      const tossScale = 1 + Math.sin(flipAnim * Math.PI) * 0.24;
      ctx.save();
      ctx.translate(cx, cy + tossY);
      ctx.scale(tossScale, tossScale);
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
      ctx.restore();
    }

    // Right-Side Doneness Thermometer Card (Pure Visual Icons)
    const rx = cx + 220, ry = cy - 52;
    KitchenArt.rr(ctx, rx, ry, 200, 92, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.fill();
    ctx.strokeStyle = cookProgress > 1.08 ? '#ff3b3b' : '#ffb3cf';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const statusIcon = cookProgress > 1.08
      ? '💨 🖤 😵'
      : (cookProgress >= 0.60 ? '😋 ⭐ ✨' : '🔥 🍳 ⏳');
    ctx.font = '22px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(statusIcon, rx + 100, ry + 22);

    const barX = rx + 16, barY = ry + 42, barW = 168, barH = 14;
    const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    g.addColorStop(0, '#ffe89e');
    g.addColorStop(0.55, '#ffb700');
    g.addColorStop(0.82, '#34c759');
    g.addColorStop(1, '#3b2318');
    KitchenArt.rr(ctx, barX, barY, barW, barH, 7);
    ctx.fillStyle = g;
    ctx.fill();
    const needleX = barX + Math.min(1, cookProgress / 1.25) * barW;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2.5;
    KitchenArt.circ(ctx, needleX, barY + 7, 9);
    ctx.fill();
    ctx.stroke();

    ctx.font = '16px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.fillText('💧 ── 😋⭐ ── 💨', rx + 100, ry + 75);
  }

  /* ==========================================================================
   * Station 4 Renderer: Plating, Piping Bag, Sauce Drizzle & Sprinkles (Zero Text)
   * ========================================================================== */
  function renderDecorateStation(ctx) {
    const cx = W * 0.46, cy = H * 0.68;
    drawCanvasButton(ctx, 36, cy - 38, 128, 44, dish.vessel === 'plate', '🍽️');
    drawCanvasButton(ctx, 36, cy + 16, 128, 44, dish.vessel === 'cup',   '🧋');

    KitchenArt.drawDish(ctx, dish, cx, cy, 1.08, t);
  }

  /* ==========================================================================
   * Station 5 Renderer: Interactive Fork/Spoon Feeding to Critter's Mouth
   * ========================================================================== */
  function renderFeedStation(ctx) {
    const cx = W * 0.46, cy = H * 0.66;
    KitchenArt.drawDish(ctx, dish, cx, cy, 1.05, t);

    ctx.save();
    ctx.translate(fork.x, fork.y);
    ctx.rotate(-0.45);
    if (fork.dragging || dish.bitesTaken < 3) {
      const sampleId = dish.items.length > 0 ? dish.items[0].id : 'strawberry';
      KitchenArt.drawIngredient(ctx, sampleId, -18, -18, 22, { sliced: true, cooked: 0.72, shadow: false });
    }
    ctx.font = '56px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dish.vessel === 'cup' ? '🥄' : '🍴', 0, 0);
    ctx.restore();

    if (dish.bitesTaken === 0 && !fork.dragging) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 92, 138, 0.65)';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(fork.x - 20, fork.y - 25);
      ctx.quadraticCurveTo(W * 0.56, H * 0.42, W * 0.46, H * 0.28);
      ctx.stroke();
      ctx.restore();
    }

    // Pure-Emoji Reaction Badge
    if (critterAnim.reactionBadge) {
      ctx.save();
      KitchenArt.rr(ctx, W * 0.5 - 110, H * 0.43 - 22, 220, 42, 21);
      ctx.fillStyle = '#fff0f6';
      ctx.fill();
      ctx.strokeStyle = '#ff4d88';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(critterAnim.reactionBadge, W * 0.5, H * 0.43 - 1);
      ctx.restore();
    }
  }

  function drawCanvasButton(ctx, x, y, w, h, active, iconLabel) {
    ctx.save();
    KitchenArt.rr(ctx, x, y, w, h, 16);
    ctx.fillStyle = active ? '#ff5c8a' : '#ffffff';
    ctx.fill();
    ctx.strokeStyle = active ? '#c92a5b' : '#e0b8c8';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(iconLabel, x + w / 2, y + h / 2 + 2);
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
    const cx = W * 0.46, cy = H * 0.66;

    if (Math.hypot(pt.x - W * 0.46, pt.y - H * 0.25) < 75 && station !== 5) {
      KitchenAudio.reaction('love');
      spawnParticles(W * 0.46, H * 0.22, '#ff85b3', 10);
      return;
    }

    if (station === 1) {
      if (Math.hypot(pt.x - cx, pt.y - cy) < 170) {
        lastChopTime = t;
        chopBoardItem();
      }
    } else if (station === 2) {
      if (pt.x >= 32 && pt.x <= 170) {
        if (pt.y >= cy - 56 && pt.y <= cy) { mixMode = 'bowl'; dish.vessel = 'plate'; updateGuideBanner(); return; }
        if (pt.y >= cy + 4 && pt.y <= cy + 60) { mixMode = 'blender'; dish.vessel = 'cup'; updateGuideBanner(); return; }
      }
      if (Math.hypot(pt.x - cx, pt.y - cy) < 160) {
        stirMixer(0.2);
      }
    } else if (station === 3) {
      if (pt.x >= 32 && pt.x <= 188) {
        if (pt.y >= cy - 62 && pt.y <= cy - 12) { cookMode = 'pan'; updateGuideBanner(); return; }
        if (pt.y >= cy - 8 && pt.y <= cy + 40) { cookMode = 'oven'; updateGuideBanner(); return; }
        if (cookMode === 'pan' && pt.y >= cy + 42 && pt.y <= cy + 86) {
          const idx = Math.floor((pt.x - 36) / 50) + 1;
          if (idx >= 1 && idx <= 3) { heatLevel = idx; KitchenAudio.sizzleTick(heatLevel); return; }
        }
      }
      if (Math.hypot(pt.x - cx, pt.y - cy) < 190) {
        flipPan();
      }
    } else if (station === 4) {
      if (pt.x >= 32 && pt.x <= 170) {
        if (pt.y >= cy - 42 && pt.y <= cy + 8) { dish.vessel = 'plate'; return; }
        if (pt.y >= cy + 12 && pt.y <= cy + 64) { dish.vessel = 'cup'; return; }
      }
      const lx = (pt.x - cx) / 1.08;
      const ly = (pt.y - cy) / 1.08;
      for (const tp of dish.toppings) {
        if (tp.id === 'candle' && !tp.blownOut && Math.hypot(tp.x - lx, tp.y - (ly + 24)) < 32) {
          tp.blownOut = true;
          KitchenAudio.blowCandle();
          spawnParticles(cx + tp.x, cy + tp.y - 32, 'rgba(200,200,220,0.8)', 14, 'smoke');
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
    const cx = W * 0.46, cy = H * 0.66;

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
   * DOM UI Builders (100% Zero-Text Picture & Icon Controls)
   * ========================================================================== */
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
        KitchenAudio.speak(c.greeting, c.en);
        renderCustomerBar();
      };
      wrap.appendChild(btn);
    });
  }

  function renderCategoryTabs() {
    const tabWrap = document.getElementById('catTabs');
    if (!tabWrap) return;
    tabWrap.innerHTML = '';
    const catIcons = {
      fruit:  '🍓 🍌 🍑',
      meat:   '🥚 🥩 🧀',
      veggie: '🍞 🍕 🍅',
      magic:  '🥛 🍫 🍦',
    };
    KitchenData.CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-tab' + (cat.id === activeCategory ? ' active' : '');
      btn.textContent = catIcons[cat.id] || '🍓';
      btn.onclick = () => {
        activeCategory = cat.id;
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
    if (prepTray.length === 0) {
      tray.innerHTML = '<span class="tray-empty">🧺 ✨</span>';
      return;
    }
    tray.innerHTML = '<span>🧺</span>' + prepTray.slice(-8).map(p => {
      const m = KitchenData.getIngredient(p.id);
      return `<span class="tray-pill">${m.emoji}</span>`;
    }).join('');
  }

  function renderDecorToolbar() {
    const bar = document.getElementById('decorToolbar');
    if (!bar) return;
    bar.innerHTML = '';

    const tools = [
      { id: 'piping',  label: '🧁' },
      { id: 'sauce',   label: '🍯' },
      { id: 'topping', label: '🌈 🕯️' },
    ];
    const modeRow = document.createElement('div');
    modeRow.className = 'decor-modes';
    tools.forEach(tl => {
      const b = document.createElement('button');
      b.className = 'decor-mode-btn' + (decorTool === tl.id ? ' active' : '');
      b.textContent = tl.label;
      b.onclick = () => {
        decorTool = tl.id;
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
        b.innerHTML = `<span class="swatch-dot" style="background:${p.color}"></span>🧁`;
        b.onclick = () => { pipingColorIdx = idx; renderDecorToolbar(); };
        optRow.appendChild(b);
      });
    } else if (decorTool === 'sauce') {
      KitchenData.SAUCES.forEach((s, idx) => {
        const b = document.createElement('button');
        b.className = 'swatch-btn' + (sauceIdx === idx ? ' active' : '');
        b.innerHTML = `<span class="swatch-dot" style="background:${s.color}"></span>🍯`;
        b.onclick = () => { sauceIdx = idx; renderDecorToolbar(); };
        optRow.appendChild(b);
      });
    } else {
      KitchenData.TOPPINGS.forEach((tp, idx) => {
        const b = document.createElement('button');
        b.className = 'swatch-btn' + (toppingIdx === idx ? ' active' : '');
        b.textContent = tp.emoji;
        b.onclick = () => { toppingIdx = idx; renderDecorToolbar(); };
        optRow.appendChild(b);
      });
    }
    bar.appendChild(optRow);
  }

  function openAlbumModal() {
    const modal = document.getElementById('albumModal');
    const grid = document.getElementById('albumGrid');
    if (!modal || !grid) return;
    if (album.length === 0) {
      grid.innerHTML = '<div class="album-empty">📸 ➕ 🍽️ 😋</div>';
    } else {
      grid.innerHTML = album.map(entry => `
        <div class="album-card">
          <img src="${entry.dataUrl}" class="album-photo" alt="">
          <div class="album-meta">
            <img src="icons/${entry.critterIcon || 'icon_bobby_bearhug'}.jpg" class="album-critter-icon" alt="">
            <span>${entry.reactionBadge || '😍 💖 ⭐'}</span>
            <span>${'⭐'.repeat(entry.stars || 3)}</span>
          </div>
        </div>
      `).join('');
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
    fork.homeY = H * 0.64;
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
        modeBtn.textContent = mode === 'wish' ? '💭' : '🎨';
        updateGuideBanner();
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

    const voiceBtn = document.getElementById('voiceToggleBtn');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        const v = !KitchenAudio.isVoiceEnabled();
        KitchenAudio.setVoiceEnabled(v);
        voiceBtn.textContent = v ? '🗣️' : '🙊';
      });
    }
    const muteBtn = document.getElementById('muteToggleBtn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const m = !KitchenAudio.isMuted();
        KitchenAudio.setMuted(m);
        muteBtn.textContent = m ? '🔇' : '🔊';
      });
    }

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
