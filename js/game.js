'use strict';

const KitchenGame = (() => {
  const W = 960, H = 560;
  let canvas, ctx;
  let t = 0, lastTs = 0;
  
  let state = {
    stage: 1,
    station: 1, // for art.js
    friend: 'bobby', // for art.js critter
    dish: {
      items: [],
      batterTint: '#ffccaa',
      layerColors: ['#ffccaa', '#ffbb99'],
      frostingColor: '#ffffff',
      glazeColor: '#ffbb99',
      isCocoa: false,
      candyBalls: [],
      rosettes: [],
      toppings: [],
      slicedWedge: false,
      bitesTaken: 0
    },
    // Stage 1
    boardItem: null, // old
    activeIngredient: null, // for art.js string id
    cuts: 0,
    slicedIngredients: [], // for art.js string ids
    sliceTrail: null,
    
    // Stage 2
    eggAdded: false,
    milkAdded: false,
    fruitAdded: false,
    mixProgress: 0,
    whiskAngle: 0,
    mixAngle: 0, // for art.js
    
    // Stage 3
    bakeProgress: 0,
    
    // Stage 4
    activeTool: 'piping',
    spoonDrag: null,
    feedAnim: 0,
    critterMood: 'neutral',
    bitesTaken: 0, // for art.js
    slicedWedge: false, // for art.js

    // Hitboxes (populated by KitchenArt)
    tableIngredientHitboxes: {},
    tableHelperHitboxes: {},
    tableToolHitboxes: {},
    nextBtnHitbox: null,
    boardHitbox: null,
    glassBowlHitbox: null,
    ovenHitbox: null,
    cakeHitbox: null,
    critterHitbox: null,

    pointer: {x: 0, y: 0, isDown: false, dx: 0, dy: 0, swipeDist: 0}
  };

  let critterIndex = 0;

  function init(canvasEl) {
    if (!canvasEl) canvasEl = document.getElementById('kitchenCanvas');
    if (!canvasEl) return;
    canvas = canvasEl;
    ctx = canvas.getContext('2d', { alpha: false });
    
    const resize = () => {
      const parent = canvas.parentElement || document.body;
      const aspect = W / H;
      const pw = parent.clientWidth, ph = parent.clientHeight;
      let cw = pw, ch = pw / aspect;
      if (ch > ph) { ch = ph; cw = ph * aspect; }
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
    };
    window.addEventListener('resize', resize);
    resize();
    
    const attachPointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    canvas.addEventListener('pointerdown', e => {
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
    window.addEventListener('pointerup', e => {
      state.pointer.isDown = false;
      handlePointerUp(state.pointer.x, state.pointer.y);
    });

    // Hook up dock buttons
    document.querySelectorAll('.stage-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setStage(parseInt(btn.dataset.stage, 10));
      });
    });

    document.getElementById('resetBtn')?.addEventListener('click', () => resetDish());
    
    document.getElementById('critterBtn')?.addEventListener('click', () => {
      if (window.KitchenData && window.KitchenData.critters) {
        critterIndex = (critterIndex + 1) % window.KitchenData.critters.length;
        state.friend = window.KitchenData.critters[critterIndex].id;
      }
    });

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
    if (hb.w && hb.h) return inRect(x, y, hb.x, hb.y, hb.w, hb.h);
    if (hb.r) return inCircle(x, y, hb.x, hb.y, hb.r);
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
          hb.id = id;
          if (checkHitbox(x, y, hb)) {
            state.boardItem = {id: hb.id, cuts: 0};
            state.boardItem.cuts = 0;
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
          hb.id = id;
          if (checkHitbox(x, y, hb)) {
            if (hb.id === 'egg' && !state.eggAdded) {
              state.eggAdded = true;
              if (window.KitchenAudio) window.KitchenAudio.playEggCrack();
            }
            if (hb.id === 'milk' && !state.milkAdded) {
              state.milkAdded = true;
              if (window.KitchenAudio) window.KitchenAudio.playMilkPour();
            }
            if ((hb.id === "fruit" || hb.id === "slicedFruitBowl") && !state.fruitAdded) {
              state.fruitAdded = true;
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
          hb.id = (id === "pipingBag" || id === "piping") ? "piping" : ((id === "candyBowl" || id === "candy") ? "candy" : ((id === "cakeKnife" || id === "knife") ? "knife" : "spoon"));
          if (checkHitbox(x, y, hb)) {
            state.activeTool = hb.id;
            return;
          }
        }
      }
      if (state.cakeHitbox && checkHitbox(x, y, state.cakeHitbox)) {
        if (state.activeTool === 'piping') {
          state.dish.rosettes.push({x: x, y: y, color: state.dish.frostingColor});
          if (window.KitchenAudio) window.KitchenAudio.playPipingSquish();
        } else if (state.activeTool === 'candy') {
          state.dish.candyBalls.push({x: x, y: y, seed: state.dish.candyBalls.length});
          if (state.dish.items.length > 0) {
             state.dish.toppings.push({id: state.dish.items[0].id, x: x, y: y});
          }
          if (window.KitchenAudio) window.KitchenAudio.playCandyClink();
        } else if (state.activeTool === 'knife') {
          state.slicedWedge = true;
          state.dish.slicedWedge = true;
          if (window.KitchenAudio) window.KitchenAudio.playCakeSlice();
        } else if (state.activeTool === 'spoon') {
          if (state.dish.slicedWedge && state.feedAnim === 0) {
            state.spoonDrag = {x, y};
          }
        }
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
      if (state.boardItem && state.boardItem.cuts < 3 && state.pointer.swipeDist > 40) {
        if (state.boardHitbox && checkHitbox(x, y, state.boardHitbox)) {
          cutBoardItem(x, y);
          state.pointer.swipeDist = 0;
        }
      }
    } else if (state.stage === 2) {
      if (state.glassBowlHitbox && checkHitbox(x, y, state.glassBowlHitbox) && state.pointer.swipeDist > 20) {
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
    state.spoonDrag = null;
    if (state.stage === 1) {
       if (state.sliceTrail) state.sliceTrail.active = false;
    }
  }

  function cutBoardItem(x, y) {
    state.boardItem.cuts++;
    state.sliceTrail = { active: true, p1: {x: x - state.pointer.dx * 2, y: y - state.pointer.dy * 2}, p2: {x, y}, alpha: 1.0 };
    if(window.KitchenAudio) window.KitchenAudio.playWoodChop();
    if (state.boardItem.cuts >= 3) {
      state.slicedIngredients.push(state.boardItem.id);
      state.dish.items.push({id: state.boardItem.id, sliced: true});
      recomputeDishPalette();
      state.boardItem = null;
    }
  }

  function whiskStep() {
    state.mixProgress += 0.05;
    state.whiskAngle += 1;
    state.mixAngle = state.whiskAngle;
    if (state.mixProgress > 1) state.mixProgress = 1;
    if(window.KitchenAudio && Math.random() < 0.2) window.KitchenAudio.playWhiskSwirl();
  }

  function bakeStep() {
    state.bakeProgress += 0.5;
    if (state.bakeProgress >= 1) {
      state.bakeProgress = 1;
      if(window.KitchenAudio) window.KitchenAudio.playOvenDing();
    }
  }
  
  function feedCritter() {
    state.feedAnim = 1.0;
    state.bitesTaken++;
    state.dish.bitesTaken++;
    state.critterMood = 'ecstatic';
    if (window.KitchenAudio) {
      window.KitchenAudio.playHappyChomp();
      setTimeout(() => window.KitchenAudio.playKalimbaChime(), 800);
    }
  }

  function setStage(st) {
    state.stage = Math.max(1, Math.min(4, st));
    state.station = state.stage; // mirror to art.js
    if (state.stage > 1 && state.dish.items.length === 0) {
      state.slicedIngredients.push('strawberry');
      state.dish.items = [{id: 'strawberry', sliced: true}];
      recomputeDishPalette();
    }
    if (state.stage === 4) {
      state.activeTool = 'piping';
      state.critterMood = 'neutral';
    }
    document.querySelectorAll('.stage-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.stage, 10) === state.stage);
    });
  }

  function recomputeDishPalette() {
    if(window.KitchenData && window.KitchenData.paletteFor) {
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
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    t += dt;

    if (state.feedAnim > 0) {
      state.feedAnim -= dt * 0.5;
      if (state.feedAnim < 0) state.feedAnim = 0;
    }
    if (state.sliceTrail && state.sliceTrail.active) {
      state.sliceTrail.alpha -= dt * 2;
      if (state.sliceTrail.alpha <= 0) state.sliceTrail.active = false;
    }

    if (window.KitchenArt && window.KitchenArt.drawFrame) {
      window.KitchenArt.drawFrame(ctx, W, H, state, t);
    } else {
      ctx.fillStyle = '#fffdf9';
      ctx.fillRect(0, 0, W, H);
      ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(10, 0); ctx.lineTo(-5, 10); ctx.fill();
    }

    requestAnimationFrame(tick);
  }

  function resetDish() {
    state.dish = {
      items: [], batterTint: '#ffccaa', layerColors: ['#ffccaa', '#ffbb99'],
      frostingColor: '#ffffff', candyBalls: [], rosettes: [], toppings: [],
      slicedWedge: false, bitesTaken: 0
    };
    state.boardItem = null;
    state.boardItem.cuts = 0;
    state.slicedIngredients = [];
    state.sliceTrail = null;
    state.eggAdded = false;
    state.milkAdded = false;
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
    setStage, 
    setStation: setStage, 
    selectIngredient: (id) => { state.boardItem = {id, cuts: 0}; state.activeIngredient = id; state.cuts = 0; },
    selectTool: (tool) => { state.activeTool = tool; }, 
    resetDish 
  };
})();

if (typeof window !== 'undefined') {
  window.KitchenGame = KitchenGame;
  window.addEventListener('DOMContentLoaded', () => KitchenGame.init());
}
