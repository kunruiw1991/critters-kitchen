'use strict';

const KitchenGame = (() => {
  const W = 960, H = 560;
  let canvas, ctx;
  let t = 0, lastTs = 0;

  let state = {
    stage: 1,
    station: 1,
    friend: 'bobby',
    dish: {
      items: [],
      batterTint: '#ff99bb',
      layerColors: ['#ff99bb', '#ffe878', '#9be858'],
      frostingColor: '#fff8f2',
      glazeColor: '#ff3366',
      isCocoa: false,
      candyBalls: [],
      rosettes: [],
      toppings: [],
      slicedWedge: false,
      bitesTaken: 0
    },
    boardItem: { id: 'strawberry', cuts: 0 },
    activeIngredient: 'strawberry',
    cuts: 0,
    slicedIngredients: [],
    sliceTrail: null,

    eggAdded: false,
    milkAdded: false,
    fruitAdded: false,
    mixProgress: 0,
    whiskAngle: 0,
    mixAngle: 0,

    bakeProgress: 0,

    activeTool: 'piping',
    spoonDrag: null,
    feedAnim: 0,
    critterMood: 'neutral',
    bitesTaken: 0,
    slicedWedge: false,

    tableIngredientHitboxes: {},
    tableHelperHitboxes: {},
    tableToolHitboxes: {},
    nextBtnHitbox: null,
    boardHitbox: { x: 265, y: 267, w: 430, h: 200 },
    glassBowlHitbox: { x: 305, y: 237, w: 350, h: 250, r: 165 },
    ovenHitbox: { x: 245, y: 187, w: 470, h: 310, r: 220 },
    cakeHitbox: { x: 320, y: 191, w: 290, h: 220, r: 145 },
    critterHitbox: { x: 365, y: 15, w: 230, h: 255, cx: 480, cy: 150, r: 112 },

    pointer: { x: 0, y: 0, isDown: false, dx: 0, dy: 0, swipeDist: 0 }
  };

  let viewState = { vw: W, vh: H, scale: 1, ox: 0, oy: 0 };

  let critterIndex = 0;

  function populateDefaultHitboxes() {
    state.boardHitbox = { x: 265, y: 267, w: 430, h: 200 };
    state.glassBowlHitbox = { x: 305, y: 237, w: 350, h: 250, r: 165 };
    state.ovenHitbox = { x: 245, y: 187, w: 470, h: 310, r: 220 };
    state.cakeHitbox = { x: 320, y: 191, w: 290, h: 220, r: 145 };
    state.critterHitbox = { x: 365, y: 15, w: 230, h: 255, cx: 480, cy: 150, r: 112 };
  }

  function init(canvasEl) {
    if (!canvasEl) canvasEl = document.getElementById('kitchenCanvas');
    if (!canvasEl) return;
    canvas = canvasEl;
    ctx = canvas.getContext('2d', { alpha: false });

    const view = { vw: W, vh: H, scale: 1, ox: 0, oy: 0 };

    const resize = () => {
      const parent = canvas.parentElement || document.body;
      const pw = parent.clientWidth || window.innerWidth;
      const ph = parent.clientHeight || window.innerHeight;
      canvas.style.width = pw + 'px';
      canvas.style.height = ph + 'px';
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = pw * dpr;
      canvas.height = ph * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      viewState.vw = pw;
      viewState.vh = ph;
      viewState.scale = Math.min(pw / W, (ph - 96) / (H - 80));
      viewState.ox = (pw - W * viewState.scale) * 0.5;
      viewState.oy = Math.max(8, (ph - 96 - H * viewState.scale) * 0.52);
    };
    window.addEventListener('resize', resize);
    resize();

    const attachPointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left - viewState.ox) / viewState.scale,
        y: (clientY - rect.top - viewState.oy) / viewState.scale
      };
    };

    canvas.addEventListener('pointerdown', e => {
      if (e.isTrusted && window.KitchenAudio && window.KitchenAudio.unlock) {
        window.KitchenAudio.unlock();
      }
      state.pointer.isDown = true;
      const pt = attachPointer(e);
      state.pointer.x = pt.x;
      state.pointer.y = pt.y;
      state.pointer.swipeDist = 0;
      handlePointerDown(pt.x, pt.y);
    });
    window.addEventListener('pointermove', e => {
      if (!state.pointer.isDown) return;
      const pt = attachPointer(e);
      state.pointer.dx = pt.x - state.pointer.x;
      state.pointer.dy = pt.y - state.pointer.y;
      state.pointer.swipeDist += Math.hypot(state.pointer.dx, state.pointer.dy);
      state.pointer.x = pt.x;
      state.pointer.y = pt.y;
      handlePointerMove(pt.x, pt.y);
    });
    window.addEventListener('pointerup', () => {
      state.pointer.isDown = false;
      handlePointerUp(state.pointer.x, state.pointer.y);
    });

    document.querySelectorAll('.stage-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e.isTrusted && window.KitchenAudio && window.KitchenAudio.unlock) {
          window.KitchenAudio.unlock();
        }
        setStage(parseInt(btn.dataset.stage, 10));
      });
    });

    document.getElementById('resetBtn')?.addEventListener('click', () => resetDish());

    const critterBtn = document.getElementById('critterBtn');
    critterBtn?.addEventListener('click', (e) => {
      if (e.isTrusted && window.KitchenAudio && window.KitchenAudio.unlock) {
        window.KitchenAudio.unlock();
      }
      if (window.KitchenData && window.KitchenData.critters) {
        critterIndex = (critterIndex + 1) % window.KitchenData.critters.length;
        const c = window.KitchenData.critters[critterIndex];
        state.friend = c.id;
        critterBtn.style.backgroundImage = `url('assets/sprites/${c.spritePrefix}_happy.png')`;
        if (window.KitchenAudio && window.KitchenAudio.playKalimbaChime) {
          window.KitchenAudio.playKalimbaChime();
        }
      }
    });

    setStage(1);
    lastTs = performance.now();
    requestAnimationFrame(tick);
  }

  function inCircle(x, y, cx, cy, r) {
    return Math.hypot(x - cx, y - cy) < r;
  }
  function inRect(x, y, rx, ry, rw, rh) {
    return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  }
  function checkHitbox(x, y, hb) {
    if (!hb) return false;
    if (hb.w && hb.h && inRect(x, y, hb.x, hb.y, hb.w, hb.h)) return true;
    if (hb.r && hb.cx !== undefined && inCircle(x, y, hb.cx, hb.cy, hb.r)) return true;
    if (hb.r && hb.x !== undefined && hb.w !== undefined && inCircle(x, y, hb.x + hb.w / 2, hb.y + hb.h / 2, hb.r)) return true;
    return false;
  }

  function handlePointerDown(x, y) {
    if (state.nextBtnHitbox && checkHitbox(x, y, state.nextBtnHitbox)) {
      if (state.stage < 4) setStage(state.stage + 1);
      return;
    }

    if (state.stage === 1) {
      if (state.tableIngredientHitboxes) {
        for (const [id, hb] of Object.entries(state.tableIngredientHitboxes)) {
          if (checkHitbox(x, y, hb)) {
            state.boardItem = { id, cuts: 0 };
            state.activeIngredient = id;
            state.cuts = 0;
            if (window.KitchenAudio && window.KitchenAudio.playPipingSquish) {
              window.KitchenAudio.playPipingSquish();
            }
            return;
          }
        }
      }
      if (state.boardHitbox && checkHitbox(x, y, state.boardHitbox)) {
        if (state.boardItem && state.boardItem.cuts < 3) {
          cutBoardItem(x, y);
        }
      }
    } else if (state.stage === 2) {
      if (state.tableHelperHitboxes) {
        for (const [id, hb] of Object.entries(state.tableHelperHitboxes)) {
          if (checkHitbox(x, y, hb)) {
            if (id === 'egg' && !state.eggAdded) {
              state.eggAdded = true;
              if (window.KitchenAudio) window.KitchenAudio.playEggCrack();
              return;
            }
            if (id === 'milk' && !state.milkAdded) {
              state.milkAdded = true;
              if (window.KitchenAudio) window.KitchenAudio.playMilkPour();
              return;
            }
            if ((id === 'fruit' || id === 'slicedFruitBowl') && !state.fruitAdded) {
              state.fruitAdded = true;
              if (window.KitchenAudio) window.KitchenAudio.playCandyClink();
              return;
            }
          }
        }
      }
      if (state.glassBowlHitbox && checkHitbox(x, y, state.glassBowlHitbox)) {
        whiskStep();
      }
    } else if (state.stage === 3) {
      if (state.ovenHitbox && checkHitbox(x, y, state.ovenHitbox)) {
        bakeStep();
      }
    } else if (state.stage === 4) {
      if (state.tableToolHitboxes) {
        for (const [id, hb] of Object.entries(state.tableToolHitboxes)) {
          const normId = (id === 'pipingBag' || id === 'piping')
            ? 'piping'
            : ((id === 'candyBowl' || id === 'candy')
              ? 'candy'
              : ((id === 'cakeKnife' || id === 'knife') ? 'knife' : 'spoon'));
          if (checkHitbox(x, y, hb)) {
            state.activeTool = normId;
            if (normId === 'spoon') {
              state.spoonDrag = { x, y };
            }
            return;
          }
        }
      }
      if (state.cakeHitbox && checkHitbox(x, y, state.cakeHitbox)) {
        if (state.activeTool === 'piping') {
          state.dish.rosettes.push({ x, y, color: state.dish.frostingColor });
          if (window.KitchenAudio) window.KitchenAudio.playPipingSquish();
        } else if (state.activeTool === 'candy') {
          state.dish.candyBalls.push({ x, y, seed: state.dish.candyBalls.length });
          if (state.dish.items.length > 0) {
            state.dish.toppings.push({ id: state.dish.items[0].id, x, y });
          }
          if (window.KitchenAudio) window.KitchenAudio.playCandyClink();
        } else if (state.activeTool === 'knife') {
          state.slicedWedge = true;
          state.dish.slicedWedge = true;
          if (window.KitchenAudio) window.KitchenAudio.playCakeSlice();
        } else if (state.activeTool === 'spoon') {
          state.slicedWedge = true;
          state.dish.slicedWedge = true;
          state.spoonDrag = { x, y };
        }
      }
      if (state.activeTool === 'spoon' && x > 550 && x < 770 && y > 330 && y < 495) {
        state.spoonDrag = { x, y };
      }
      if (state.critterHitbox && checkHitbox(x, y, state.critterHitbox)) {
        if (state.activeTool === 'spoon' && state.dish.slicedWedge) {
          feedCritter();
        }
      }
    }
  }

  function handlePointerMove(x, y) {
    if (state.stage === 1) {
      if (state.boardItem && state.boardItem.cuts < 3 && state.pointer.swipeDist > 34) {
        if (state.boardHitbox && checkHitbox(x, y, state.boardHitbox)) {
          cutBoardItem(x, y);
          state.pointer.swipeDist = 0;
        }
      }
    } else if (state.stage === 2) {
      if (state.glassBowlHitbox && checkHitbox(x, y, state.glassBowlHitbox) && state.pointer.swipeDist > 16) {
        whiskStep();
        state.pointer.swipeDist = 0;
      }
    } else if (state.stage === 4) {
      if (state.activeTool === 'spoon' && state.spoonDrag) {
        state.spoonDrag.x = x;
        state.spoonDrag.y = y;
        if (state.critterHitbox && checkHitbox(x, y, state.critterHitbox)) {
          state.spoonDrag = null;
          feedCritter();
        }
      }
    }
  }

  function handlePointerUp(x, y) {
    if (state.stage === 4 && state.spoonDrag) {
      if (state.critterHitbox && checkHitbox(x, y, state.critterHitbox)) {
        feedCritter();
      }
      state.spoonDrag = null;
    }
  }

  function cutBoardItem(x, y) {
    if (!state.boardItem) return;
    state.boardItem.cuts++;
    state.cuts = state.boardItem.cuts;
    state.sliceTrail = {
      active: true,
      p1: { x: x - 45, y: y - 35 },
      p2: { x: x + 45, y: y + 35 },
      alpha: 1.0
    };
    if (window.KitchenAudio) window.KitchenAudio.playWoodChop();
    if (state.boardItem.cuts >= 3) {
      const fid = state.boardItem.id;
      state.slicedIngredients.push(fid);
      state.dish.items.push({ id: fid, sliced: true });
      recomputeDishPalette();
      const nextOrder = ['strawberry', 'banana', 'kiwi', 'blueberry', 'peach', 'cocoa'];
      const nextId = nextOrder.find(k => !state.slicedIngredients.includes(k));
      state.boardItem = nextId ? { id: nextId, cuts: 0 } : null;
    }
  }

  function whiskStep() {
    state.mixProgress = Math.min(1, state.mixProgress + 0.06);
    state.whiskAngle += 0.85;
    state.mixAngle = state.whiskAngle;
    if (window.KitchenAudio && Math.random() < 0.25) window.KitchenAudio.playWhiskSwirl();
  }

  function bakeStep() {
    state.bakeProgress = Math.min(1, state.bakeProgress + 0.5);
    if (state.bakeProgress >= 1) {
      if (window.KitchenAudio) window.KitchenAudio.playOvenDing();
    }
  }

  function feedCritter() {
    state.feedAnim = 1.4;
    state.bitesTaken++;
    state.dish.bitesTaken++;
    state.critterMood = 'ecstatic';
    if (window.KitchenAudio) {
      window.KitchenAudio.playHappyChomp();
      setTimeout(() => {
        if (window.KitchenAudio) window.KitchenAudio.playKalimbaChime();
      }, 450);
    }
  }

  function setStage(st) {
    state.stage = Math.max(1, Math.min(4, st));
    state.station = state.stage;
    populateDefaultHitboxes();
    if (state.stage > 1 && state.dish.items.length === 0) {
      state.slicedIngredients = ['strawberry', 'banana', 'kiwi'];
      state.dish.items = [
        { id: 'strawberry', sliced: true },
        { id: 'banana', sliced: true },
        { id: 'kiwi', sliced: true }
      ];
      recomputeDishPalette();
    }
    if (state.stage === 4) {
      state.activeTool = 'piping';
      state.critterMood = 'neutral';
    }
    document.querySelectorAll('.stage-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.stage, 10) === state.stage);
    });
    if (ctx && window.KitchenArt && window.KitchenArt.drawFrame) {
      window.KitchenArt.drawFrame(ctx, W, H, state, t, viewState);
    }
  }

  function recomputeDishPalette() {
    if (window.KitchenData && window.KitchenData.paletteFor) {
      const ids = state.dish.items.map(it => it.id);
      const pal = window.KitchenData.paletteFor(ids);
      state.dish.batterTint = pal.batterTint;
      state.dish.layerColors = pal.layerColors;
      state.dish.frostingColor = pal.frostingColor;
      if (pal.glazeColor) state.dish.glazeColor = pal.glazeColor;
      state.dish.isCocoa = pal.isCocoa;
    }
  }

  function tick(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    t += dt;

    if (state.feedAnim > 0) {
      state.feedAnim -= dt * 0.45;
      if (state.feedAnim < 0) state.feedAnim = 0;
    }
    if (state.sliceTrail && state.sliceTrail.active) {
      state.sliceTrail.alpha -= dt * 2.2;
      if (state.sliceTrail.alpha <= 0) state.sliceTrail.active = false;
    }

    if (window.KitchenArt && window.KitchenArt.drawFrame) {
      window.KitchenArt.drawFrame(ctx, W, H, state, t, viewState);
    }

    requestAnimationFrame(tick);
  }

  function resetDish() {
    state.dish = {
      items: [],
      batterTint: '#ff99bb',
      layerColors: ['#ff99bb', '#ffe878', '#9be858'],
      frostingColor: '#fff8f2',
      glazeColor: '#ff3366',
      isCocoa: false,
      candyBalls: [],
      rosettes: [],
      toppings: [],
      slicedWedge: false,
      bitesTaken: 0
    };
    state.boardItem = { id: 'strawberry', cuts: 0 };
    state.activeIngredient = 'strawberry';
    state.cuts = 0;
    state.slicedIngredients = [];
    state.sliceTrail = null;
    state.eggAdded = false;
    state.milkAdded = false,
    state.fruitAdded = false;
    state.mixProgress = 0;
    state.bakeProgress = 0;
    state.feedAnim = 0;
    state.critterMood = 'neutral';
    state.bitesTaken = 0;
    state.slicedWedge = false;
    setStage(1);
  }

  return {
    init,
    getState: () => state,
    getDishState: () => state.dish,
    getViewState: () => viewState,
    setStage,
    setStation: setStage,
    selectIngredient: (id) => {
      state.boardItem = { id, cuts: 0 };
      state.activeIngredient = id;
      state.cuts = 0;
    },
    selectTool: (tool) => { state.activeTool = tool; },
    resetDish
  };
})();

if (typeof window !== 'undefined') {
  window.KitchenGame = KitchenGame;
  window.addEventListener('DOMContentLoaded', () => KitchenGame.init());
}
