'use strict';

window.KitchenArt = (() => {
  const SPRITE_FILES = {
    bg: 'assets/studio_bg.jpg',
    chef_bobby_happy: 'assets/sprites/chef_bobby_happy.png',
    chef_bobby_eat: 'assets/sprites/chef_bobby_eat.png',
    chef_bobby_yay: 'assets/sprites/chef_bobby_yay.png',
    chef_catnap_happy: 'assets/sprites/chef_catnap_happy.png',
    chef_catnap_yay: 'assets/sprites/chef_catnap_yay.png',
    chef_dogday_happy: 'assets/sprites/chef_dogday_happy.png',
    chef_dogday_yay: 'assets/sprites/chef_dogday_yay.png',
    cutting_board: 'assets/sprites/cutting_board.png',
    chef_knife: 'assets/sprites/chef_knife.png',
    bowl_strawberry: 'assets/sprites/bowl_strawberry.png',
    bowl_banana: 'assets/sprites/bowl_banana.png',
    bowl_kiwi: 'assets/sprites/bowl_kiwi.png',
    bowl_blueberry: 'assets/sprites/bowl_blueberry.png',
    bowl_peach: 'assets/sprites/bowl_peach.png',
    bowl_cocoa: 'assets/sprites/bowl_cocoa.png',
    whole_strawberry: 'assets/sprites/whole_strawberry.png',
    whole_banana: 'assets/sprites/whole_banana.png',
    whole_kiwi: 'assets/sprites/whole_kiwi.png',
    whole_blueberry: 'assets/sprites/whole_blueberry.png',
    whole_peach: 'assets/sprites/whole_peach.png',
    whole_cocoa: 'assets/sprites/whole_cocoa.png',
    sliced_strawberry: 'assets/sprites/sliced_strawberry.png',
    sliced_banana: 'assets/sprites/sliced_banana.png',
    sliced_kiwi: 'assets/sprites/sliced_kiwi.png',
    sliced_blueberry: 'assets/sprites/sliced_blueberry.png',
    sliced_peach: 'assets/sprites/sliced_peach.png',
    sliced_cocoa: 'assets/sprites/sliced_cocoa.png',
    mixing_bowl: 'assets/sprites/mixing_bowl.png',
    milk_pitcher: 'assets/sprites/milk_pitcher.png',
    egg_plate: 'assets/sprites/egg_plate.png',
    whisk: 'assets/sprites/whisk.png',
    mint_oven: 'assets/sprites/mint_oven.png',
    turntable: 'assets/sprites/turntable.png',
    rosette: 'assets/sprites/rosette.png',
    cake_whole: 'assets/sprites/cake_whole.png',
    cake_cut: 'assets/sprites/cake_cut.png',
    cake_slice_plate: 'assets/sprites/cake_slice_plate.png',
    piping_bag: 'assets/sprites/piping_bag.png',
    candy_bowl: 'assets/sprites/candy_bowl.png',
    cake_knife: 'assets/sprites/cake_knife.png',
    cake_spoon: 'assets/sprites/cake_spoon.png'
  };

  const images = {};
  const loaded = {};
  const tintedCache = {};

  function preloadAll() {
    for (const [key, src] of Object.entries(SPRITE_FILES)) {
      const img = new Image();
      img.onload = () => { loaded[key] = true; };
      img.src = src;
      images[key] = img;
    }
  }
  preloadAll();

  function parseHex(hex) {
    if (!hex || typeof hex !== 'string') return [255, 200, 180];
    const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    return [255, 200, 180];
  }

  // Pixel-level 3D cylindrical sponge cake multi-tier color shader preserving studio porous crumb texture
  function getTintedCakeCanvas(key, dish) {
    const img = images[key];
    if (!img || !loaded[key] || !img.naturalWidth) return null;

    const layers = (dish && dish.layerColors && dish.layerColors.length > 0)
      ? dish.layerColors
      : ['#ff99bb', '#ffe878', '#9be858'];
    const frostingHex = (dish && dish.frostingColor) ? dish.frostingColor : '#fff8f2';
    const isCocoa = !!(dish && dish.isCocoa);
    const cacheKey = `${key}|${layers.join(',')}|${frostingHex}|${isCocoa ? 1 : 0}`;
    if (tintedCache[cacheKey]) return tintedCache[cacheKey];

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0);

    try {
      const imgData = octx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const rgbLayers = [
        parseHex(layers[0]),
        parseHex(layers[1 % layers.length]),
        parseHex(layers[2 % layers.length])
      ];
      const fRgb = parseHex(frostingHex);

      for (let y = 0; y < h; y++) {
        const ny = y / h;
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const a = d[i + 3];
          if (a < 20) continue;

          const nx = (x / w) - 0.5;
          // Cylindrical perspective curvature adjustment so horizontal layers follow the 3D cake curve
          const cylCurve = (key === 'cake_whole' || key === 'cake_cut')
            ? 0.055 * (1 - 4 * nx * nx)
            : 0.0;
          const cy = ny - cylCurve;

          let tier = 0;
          if (key === 'cake_whole') {
            if (cy < 0.39) tier = 0;
            else if (cy < 0.64) tier = 1;
            else tier = 2;
          } else if (key === 'cake_cut') {
            if (cy < 0.43) tier = 0;
            else if (cy < 0.68) tier = 1;
            else tier = 2;
          } else {
            // cake_slice_plate
            if (ny < 0.37) tier = 0;
            else if (ny < 0.56) tier = 1;
            else tier = 2;
          }
          const [tr, tg, tb] = rgbLayers[tier];

          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const warmth = r - b;

          // On cake_whole, trim away the outer wooden board rim so the 3-tier sponge cylinder sits directly on the porcelain turntable
          if (key === 'cake_whole' && (cy > 0.825 || x < w * 0.082 || x > w * 0.918)) {
            d[i + 3] = 0;
            continue;
          }
          const isWoodenBoard = false;
          const isPlate = (key === 'cake_slice_plate' && (ny > 0.77 || x < w * 0.22 || x > w * 0.80));

          if (!isWoodenBoard && !isPlate && warmth > 32 && r > 135) {
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 212.0;
            const blend = Math.min(1.0, (warmth - 30) / 42.0) * (tier === 0 && isCocoa ? 0.90 : 0.82);
            const nr = Math.min(255, Math.max(0, tr * lum * 1.05));
            const ng = Math.min(255, Math.max(0, tg * lum * 1.05));
            const nb = Math.min(255, Math.max(0, tb * lum * 1.05));
            d[i]     = Math.round(r * (1 - blend) + nr * blend);
            d[i + 1] = Math.round(g * (1 - blend) + ng * blend);
            d[i + 2] = Math.round(b * (1 - blend) + nb * blend);
          }
        }
      }
      octx.putImageData(imgData, 0, 0);
    } catch (e) {
      // Fallback
    }

    tintedCache[cacheKey] = off;
    return off;
  }

  function drawContactShadow(ctx, cx, cy, rx, ry, alpha = 0.28) {
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, rx * 0.1, cx, cy, rx);
    grad.addColorStop(0, `rgba(38, 18, 6, ${alpha})`);
    grad.addColorStop(0.65, `rgba(38, 18, 6, ${alpha * 0.45})`);
    grad.addColorStop(1, 'rgba(38, 18, 6, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGlowRing(ctx, cx, cy, rx, ry, color, pulse = 0) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4 + Math.sin(pulse) * 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawSprite(ctx, key, cx, cy, targetW, targetH, opts = {}) {
    const src = opts.canvasOverride || images[key];
    if (!src || (!opts.canvasOverride && (!loaded[key] || !src.naturalWidth))) return false;

    const nw = src.width || src.naturalWidth;
    const nh = src.height || src.naturalHeight;
    let w = targetW;
    let h = targetH;
    if (!h && w) h = w * (nh / nw);
    if (!w && h) w = h * (nw / nh);

    if (opts.shadow) {
      drawContactShadow(
        ctx,
        cx + (opts.shadowDx || 0),
        cy + h * (opts.shadowYRatio || 0.42),
        w * (opts.shadowRxRatio || 0.46),
        h * (opts.shadowRyRatio || 0.14),
        opts.shadowAlpha || 0.30
      );
    }

    ctx.save();
    ctx.translate(cx, cy);
    if (opts.rot) ctx.rotate(opts.rot);
    if (opts.sx || opts.sy) ctx.scale(opts.sx || 1, opts.sy || 1);
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    ctx.drawImage(src, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  }

  function drawSparkleStar(ctx, x, y, r, color, rot = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rad = (i % 2 === 0) ? r : r * 0.36;
      const ang = (i * Math.PI) / 4;
      const px = Math.cos(ang) * rad;
      const py = Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHeart3D(ctx, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(255, 40, 90, 0.45)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.32);
    ctx.bezierCurveTo(-size * 0.55, -size * 0.15, -size * 0.55, -size * 0.65, 0, -size * 0.28);
    ctx.bezierCurveTo(size * 0.55, -size * 0.65, size * 0.55, -size * 0.15, 0, size * 0.32);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(-size * 0.18, -size * 0.25, size * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBackgroundAndChef(ctx, W, H, state, t, skipBg = false) {
    // 1. Studio Patisserie Backdrop
    if (!skipBg) {
      if (loaded.bg && images.bg) {
        ctx.drawImage(images.bg, 0, 0, W, H);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#FFE5EC');
        grad.addColorStop(0.55, '#FFF5E4');
        grad.addColorStop(0.56, '#D99B58');
        grad.addColorStop(1, '#B67637');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // Floating warm golden bokeh motes in upper bakery studio air
    ctx.save();
    for (let i = 0; i < 10; i++) {
      const mx = ((i * 113 + t * (12 + (i % 4) * 4)) % (W + 40)) - 20;
      const my = 32 + ((i * 53) % 150) + Math.sin(t * 1.8 + i) * 10;
      const mr = 2.5 + (i % 3) * 1.4;
      ctx.fillStyle = `rgba(255, 245, 200, ${0.28 + 0.2 * Math.sin(t * 2.5 + i)})`;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Plush 3D Critter Chef grounded naturally behind the wooden tabletop counter (y=324)
    const friend = state.friend || 'bobby';
    let chefPrefix = 'chef_bobby';
    if (friend === 'catnap') chefPrefix = 'chef_catnap';
    else if (friend === 'dogday') chefPrefix = 'chef_dogday';

    let pose = 'happy';
    const isDraggingSpoon = (state.stage === 4 && (state.spoonDrag || (state.activeTool === 'spoon' && state.pointer && state.pointer.isDown)));
    if (state.feedAnim > 0 || state.critterMood === 'ecstatic') {
      pose = 'yay';
    } else if (isDraggingSpoon || (state.stage === 1 && state.sliceTrail && state.sliceTrail.active)) {
      pose = (chefPrefix === 'chef_bobby') ? 'eat' : 'yay';
    }

    let spriteKey = `${chefPrefix}_${pose}`;
    if (!loaded[spriteKey]) spriteKey = `${chefPrefix}_happy`;

    const bounceY = (pose === 'yay')
      ? Math.abs(Math.sin(t * 9.5)) * -16
      : Math.sin(t * 2.6) * 3.5;
    const swayRot = (pose === 'yay')
      ? Math.sin(t * 8.0) * 0.06
      : Math.sin(t * 1.8) * 0.022;
    const squashX = (pose === 'yay') ? 1 + Math.sin(t * 9.5) * 0.04 : 1 + Math.sin(t * 2.6) * 0.015;
    const squashY = (pose === 'yay') ? 1 - Math.sin(t * 9.5) * 0.04 : 1 - Math.sin(t * 2.6) * 0.015;

    const st = state.stage || state.station || 1;
    // Ground the chef right behind the wooden tabletop horizon (y = 324)
    const chefCx = W * 0.5;
    const chefCy = (st === 1 || st === 2) ? (196 + bounceY) : (144 + bounceY);
    const chefH  = (st === 1 || st === 2) ? 268 : 240;

    // Clip chef at the wooden tabletop edge (y = 325) so the chef stands behind the table!
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, 326);
    ctx.clip();
    drawSprite(ctx, spriteKey, chefCx, chefCy, null, chefH, {
      rot: swayRot,
      sx: squashX,
      sy: squashY,
      shadow: false
    });
    ctx.restore();

    state.critterHitbox = { x: chefCx - 115, y: 15, w: 230, h: 255, cx: chefCx, cy: chefCy, r: 112 };

    // Floating celebration hearts & stars when fed or cheering
    if (pose === 'yay' || state.feedAnim > 0) {
      for (let i = 0; i < 6; i++) {
        const phase = (t * 1.6 + i * 0.35) % 1.0;
        const hx = chefCx + Math.sin(i * 2.1 + t * 2) * (75 + i * 16) * (i % 2 === 0 ? 1 : -1);
        const hy = chefCy - 20 - phase * 95;
        drawHeart3D(ctx, hx, hy, 22 * (1 - phase * 0.35), i % 2 === 0 ? '#FF3366' : '#FF77AA');
        drawSparkleStar(ctx, hx + 18, hy - 10, 8 * (1 - phase * 0.3), '#FFE066', t * 3 + i);
      }
    }
  }

  function drawNextStageButton(ctx, state, t, ready) {
    if (!ready || state.stage >= 4) {
      state.nextBtnHitbox = null;
      return;
    }
    const bx = 885;
    const by = 415 + Math.sin(t * 4.5) * 5;
    const r = 42;
    state.nextBtnHitbox = { x: bx - r, y: by - r, w: r * 2, h: r * 2, r };

    drawContactShadow(ctx, bx, by + 36, 36, 12, 0.3);
    ctx.save();
    ctx.translate(bx, by);
    const scale = 1 + Math.sin(t * 5.5) * 0.06;
    ctx.scale(scale, scale);

    const grad = ctx.createRadialGradient(-10, -12, 4, 0, 0, r);
    grad.addColorStop(0, '#B9F6CA');
    grad.addColorStop(0.55, '#00E676');
    grad.addColorStop(1, '#00B248');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4.5;
    ctx.shadowColor = 'rgba(0, 230, 118, 0.55)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-14, -12);
    ctx.lineTo(4, -12);
    ctx.lineTo(4, -22);
    ctx.lineTo(24, 0);
    ctx.lineTo(4, 22);
    ctx.lineTo(4, 12);
    ctx.lineTo(-14, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ==================== STAGE 1: SLICE & PREP ====================
  function drawStage1(ctx, W, H, state, t) {
    state.tableIngredientHitboxes = {};
    const boardCx = 480;
    const boardCy = 372;

    // 1. Studio Honey-Oak Butcher Block Cutting Board
    drawSprite(ctx, 'cutting_board', boardCx, boardCy, 455, null, {
      shadow: true,
      shadowYRatio: 0.42,
      shadowRxRatio: 0.48,
      shadowRyRatio: 0.17,
      shadowAlpha: 0.38
    });
    state.boardHitbox = { x: boardCx - 215, y: boardCy - 105, w: 430, h: 200 };

    // 2. Six Studio 3D Porcelain Fruit Bowls arranged around the cutting board
    const bowlSlots = [
      { id: 'strawberry', x: 128, y: 268 },
      { id: 'banana',     x: 245, y: 222 },
      { id: 'kiwi',       x: 128, y: 404 },
      { id: 'blueberry',  x: 715, y: 222 },
      { id: 'peach',      x: 832, y: 268 },
      { id: 'cocoa',      x: 832, y: 404 }
    ];

    for (let i = 0; i < bowlSlots.length; i++) {
      const slot = bowlSlots[i];
      const isSelected = state.boardItem && state.boardItem.id === slot.id;
      const isAlreadySliced = state.slicedIngredients && state.slicedIngredients.includes(slot.id);
      const bob = Math.sin(t * 2.8 + i * 1.1) * 3.5;

      if (isSelected) {
        drawGlowRing(ctx, slot.x, slot.y + bob, 60, 48, '#FFD54F', t * 5);
      } else if (isAlreadySliced) {
        drawGlowRing(ctx, slot.x, slot.y + bob, 56, 44, '#69F0AE', t * 3);
      }

      drawSprite(ctx, `bowl_${slot.id}`, slot.x, slot.y + bob, 118, null, {
        shadow: true,
        shadowYRatio: 0.44,
        shadowRxRatio: 0.45,
        shadowRyRatio: 0.16,
        shadowAlpha: 0.28,
        sx: isSelected ? 1.08 : 1.0,
        sy: isSelected ? 1.08 : 1.0
      });

      state.tableIngredientHitboxes[slot.id] = {
        id: slot.id,
        x: slot.x - 58,
        y: slot.y - 58,
        w: 116,
        h: 116,
        r: 58
      };
    }

    // 3. Active Fruit on the Cutting Board (Uses whole_<id> with NO bowl on the cutting board!)
    if (state.boardItem && state.boardItem.id) {
      const fid = state.boardItem.id;
      const cuts = state.boardItem.cuts || 0;
      const wobble = (state.sliceTrail && state.sliceTrail.active) ? Math.sin(t * 42) * 0.1 : 0;

      drawGlowRing(ctx, boardCx, boardCy - 14, 115, 48, 'rgba(255, 235, 130, 0.75)', t * 4);

      if (cuts === 0) {
        drawSprite(ctx, `whole_${fid}`, boardCx, boardCy - 24, 145, null, {
          rot: wobble,
          shadow: true,
          shadowYRatio: 0.40,
          shadowRxRatio: 0.42,
          shadowRyRatio: 0.15,
          shadowAlpha: 0.34
        });
      } else if (cuts === 1) {
        drawSprite(ctx, `whole_${fid}`, boardCx - 42, boardCy - 22, 120, null, {
          rot: -0.1 + wobble,
          shadow: true,
          shadowYRatio: 0.40
        });
        drawSprite(ctx, `sliced_${fid}`, boardCx + 42, boardCy - 16, 142, null, {
          rot: 0.08 - wobble,
          shadow: true,
          shadowYRatio: 0.40
        });
      } else {
        drawSprite(ctx, `sliced_${fid}`, boardCx - 28, boardCy - 20, 152, null, {
          rot: -0.06 + wobble,
          shadow: true,
          shadowYRatio: 0.40
        });
        drawSprite(ctx, `sliced_${fid}`, boardCx + 34, boardCy - 14, 152, null, {
          rot: 0.1 - wobble,
          shadow: true,
          shadowYRatio: 0.40
        });
      }

      const kx = (state.pointer && state.pointer.isDown && state.pointer.y > 200)
        ? state.pointer.x + 55
        : boardCx + 115 + Math.sin(t * 3.5) * 12;
      const ky = (state.pointer && state.pointer.isDown && state.pointer.y > 200)
        ? state.pointer.y - 18
        : boardCy - 52 + Math.cos(t * 3.5) * 8;
      const krot = (state.sliceTrail && state.sliceTrail.active) ? -0.48 : -0.25 + Math.sin(t * 3.5) * 0.05;
      drawSprite(ctx, 'chef_knife', kx, ky, 240, null, {
        rot: krot,
        shadow: true,
        shadowYRatio: 0.55,
        shadowAlpha: 0.22
      });
    } else {
      drawSprite(ctx, 'chef_knife', boardCx + 95, boardCy + 24, 230, null, {
        rot: -0.16,
        shadow: true,
        shadowYRatio: 0.45,
        shadowAlpha: 0.28
      });
    }

    // 4. Gleaming Slice Slash Trail & Flying Juice Sparkles
    if (state.sliceTrail && state.sliceTrail.active) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${state.sliceTrail.alpha})`;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#FFF59D';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(state.sliceTrail.p1.x, state.sliceTrail.p1.y);
      ctx.lineTo(state.sliceTrail.p2.x, state.sliceTrail.p2.y);
      ctx.stroke();
      ctx.restore();

      for (let i = 0; i < 5; i++) {
        const sx = boardCx + (i - 2) * 28;
        const sy = boardCy - 35 - (1 - state.sliceTrail.alpha) * 45 - (i % 2) * 18;
        drawSparkleStar(ctx, sx, sy, 9, '#FFF176', t * 6 + i);
      }
    }

    // 5. Sliced Fruit Piles along the front-left/right of the cutting board
    const slicedList = state.slicedIngredients || [];
    if (slicedList.length > 0) {
      const startX = boardCx - ((Math.min(slicedList.length, 4) - 1) * 95) / 2;
      for (let i = 0; i < Math.min(slicedList.length, 4); i++) {
        const fid = slicedList[i];
        const px = startX + i * 95;
        const py = 434;
        drawSprite(ctx, `sliced_${fid}`, px, py, 94, null, {
          shadow: true,
          shadowYRatio: 0.42
        });
      }
    }

    drawNextStageButton(ctx, state, t, slicedList.length > 0);
  }

  // ==================== STAGE 2: POUR & SWIRL WHISK ====================
  function drawStage2(ctx, W, H, state, t) {
    state.tableHelperHitboxes = {};
    const bowlCx = 480;
    const bowlCy = 362;
    const bowlW = 350;
    const bowlH = 252;

    const domFruit = (state.dish && state.dish.items && state.dish.items.length > 0)
      ? state.dish.items[0].id
      : 'strawberry';

    const helpers = [
      { id: 'egg',   sprite: 'egg_plate',          x: 185, y: 272, w: 165, added: state.eggAdded },
      { id: 'milk',  sprite: 'milk_pitcher',       x: 190, y: 412, w: 145, added: state.milkAdded },
      { id: 'fruit', sprite: `sliced_${domFruit}`, x: 775, y: 288, w: 165, added: state.fruitAdded }
    ];

    for (let i = 0; i < helpers.length; i++) {
      const h = helpers[i];
      const bob = h.added ? 0 : Math.sin(t * 3.2 + i) * 4;
      if (!h.added) {
        drawGlowRing(ctx, h.x, h.y + bob, 68, 46, '#FFD54F', t * 4 + i);
      }
      drawSprite(ctx, h.sprite, h.x, h.y + bob, h.w, null, {
        alpha: h.added ? 0.48 : 1.0,
        shadow: true,
        shadowYRatio: 0.42
      });
      state.tableHelperHitboxes[h.id] = {
        id: h.id,
        x: h.x - 80,
        y: h.y - 68,
        w: 160,
        h: 136,
        r: 76
      };
    }
    state.tableHelperHitboxes.slicedFruitBowl = state.tableHelperHitboxes.fruit;

    drawSprite(ctx, 'mixing_bowl', bowlCx, bowlCy, bowlW, bowlH, {
      shadow: true,
      shadowYRatio: 0.44,
      shadowRxRatio: 0.46,
      shadowRyRatio: 0.16,
      shadowAlpha: 0.36
    });
    state.glassBowlHitbox = { x: bowlCx - 175, y: bowlCy - 125, w: 350, h: 250, r: 165 };

    const rimCy = bowlCy - 56;
    const rimRx = 136;
    const rimRy = 42;
    const mix = state.mixProgress || 0;
    const tint = (state.dish && state.dish.batterTint) ? state.dish.batterTint : '#ffadc6';

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(bowlCx, rimCy, rimRx, rimRy, 0, 0, Math.PI * 2);
    ctx.clip();

    const bGrad = ctx.createRadialGradient(bowlCx - 20, rimCy - 8, 12, bowlCx, rimCy, rimRx);
    bGrad.addColorStop(0, mix > 0.15 ? tint : '#FFF8E1');
    bGrad.addColorStop(0.7, mix > 0.05 ? tint : '#FFE082');
    bGrad.addColorStop(1, '#D7A86E');
    ctx.fillStyle = bGrad;
    ctx.fillRect(bowlCx - rimRx, rimCy - rimRy, rimRx * 2, rimRy * 2);

    const unmixedAlpha = Math.max(0, 1 - mix * 1.15);
    if (unmixedAlpha > 0.02) {
      ctx.globalAlpha = unmixedAlpha;
      if (state.milkAdded) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(bowlCx - 28, rimCy + 4, 62, 20, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (state.eggAdded) {
        ctx.fillStyle = 'rgba(255,255,245,0.85)';
        ctx.beginPath();
        ctx.ellipse(bowlCx + 24, rimCy - 2, 42, 16, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFB300';
        ctx.beginPath();
        ctx.ellipse(bowlCx + 24, rimCy - 2, 20, 11, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (state.fruitAdded) {
        drawSprite(ctx, `sliced_${domFruit}`, bowlCx, rimCy + 2, 95, null, { alpha: unmixedAlpha });
      }
    }

    ctx.globalAlpha = 0.25 + mix * 0.65;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3.5;
    for (let r = 18; r <= 110; r += 22) {
      const startA = (state.whiskAngle || 0) * 0.7 + r * 0.05;
      ctx.beginPath();
      ctx.ellipse(bowlCx, rimCy, r, r * 0.31, 0, startA, startA + Math.PI * 1.35);
      ctx.stroke();
    }
    ctx.restore();

    const wx = (state.pointer && state.pointer.isDown && Math.hypot(state.pointer.x - bowlCx, state.pointer.y - bowlCy) < 190)
      ? state.pointer.x + 38
      : bowlCx + 52 + Math.cos((state.whiskAngle || t * 2)) * 28;
    const wy = (state.pointer && state.pointer.isDown && Math.hypot(state.pointer.x - bowlCx, state.pointer.y - bowlCy) < 190)
      ? state.pointer.y - 38
      : rimCy - 42 + Math.sin((state.whiskAngle || t * 2)) * 12;
    const wrot = Math.sin((state.whiskAngle || t * 2)) * 0.16;

    drawSprite(ctx, 'whisk', wx, wy, 205, null, {
      rot: wrot,
      shadow: false
    });

    if (mix >= 0.85) {
      for (let i = 0; i < 4; i++) {
        drawSparkleStar(
          ctx,
          bowlCx - 90 + i * 60,
          rimCy - 25 + Math.sin(t * 4 + i) * 8,
          10,
          '#FFF59D',
          t * 3 + i
        );
      }
    }

    drawNextStageButton(ctx, state, t, mix >= 0.4 || (state.eggAdded && state.milkAdded));
  }

  // ==================== STAGE 3: PASTEL MINT MINI-OVEN ====================
  function drawStage3(ctx, W, H, state, t) {
    const ovenCx = 480;
    const ovenCy = 342;
    const ovenW = 470;
    const ovenH = 310;
    const bake = state.bakeProgress || 0;

    drawSprite(ctx, 'mint_oven', ovenCx, ovenCy, ovenW, ovenH, {
      shadow: true,
      shadowYRatio: 0.45,
      shadowRxRatio: 0.48,
      shadowRyRatio: 0.14,
      shadowAlpha: 0.38
    });
    state.ovenHitbox = { x: ovenCx - 235, y: ovenCy - 155, w: 470, h: 310, r: 220 };

    const winCx = ovenCx - 30;
    const winBottomY = ovenCy + 64;
    const winW = 232;
    const winH = 132;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(winCx - winW / 2, winBottomY - winH, winW, winH, 14);
    ctx.clip();

    const glow = ctx.createRadialGradient(winCx, winBottomY - 50, 10, winCx, winBottomY - 50, 140);
    glow.addColorStop(0, `rgba(255, 210, 110, ${0.25 + bake * 0.35})`);
    glow.addColorStop(1, 'rgba(255, 140, 40, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(winCx - winW / 2, winBottomY - winH, winW, winH);

    const tintedCake = getTintedCakeCanvas('cake_whole', state.dish);
    const cakeW = 168;
    const cakeFullH = 122;
    const riseScaleY = 0.42 + bake * 0.58;
    const curH = cakeFullH * riseScaleY;
    const cakeCy = winBottomY - curH / 2 - 4;

    drawSprite(ctx, 'cake_whole', winCx, cakeCy, cakeW, curH, {
      canvasOverride: tintedCake,
      shadow: false
    });

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(winCx - 95, winBottomY - winH + 10);
    ctx.lineTo(winCx - 35, winBottomY - 10);
    ctx.stroke();
    ctx.restore();

    if (bake < 1.0) {
      drawGlowRing(ctx, ovenCx + 152, ovenCy - 18, 34, 34, '#FFD54F', t * 5);
    } else {
      for (let i = 0; i < 6; i++) {
        const sx = ovenCx - 130 + i * 52;
        const sy = ovenCy - 135 - ((t * 32 + i * 19) % 45);
        drawSparkleStar(ctx, sx, sy, 11, '#FFE082', t * 4 + i);
      }
    }

    drawNextStageButton(ctx, state, t, bake >= 1.0);
  }

  // ==================== STAGE 4: TURNTABLE DECORATE, SLICE & FEED ====================
  function drawStage4(ctx, W, H, state, t) {
    state.tableToolHitboxes = {};
    const standCx = 465;
    const standCy = 408;

    drawSprite(ctx, 'turntable', standCx, standCy, 355, null, {
      shadow: true,
      shadowYRatio: 0.42,
      shadowRxRatio: 0.44,
      shadowRyRatio: 0.14,
      shadowAlpha: 0.35
    });

    const isSliced = !!(state.slicedWedge || (state.dish && state.dish.slicedWedge));
    const cakeKey = isSliced ? 'cake_cut' : 'cake_whole';
    const tintedCake = getTintedCakeCanvas(cakeKey, state.dish);
    const cakeCx = standCx;
    const cakeCy = isSliced ? 302 : 306;
    const cakeW = isSliced ? 245 : 275;

    drawSprite(ctx, cakeKey, cakeCx, cakeCy, cakeW, null, {
      canvasOverride: tintedCake,
      shadow: false
    });

    state.cakeHitbox = {
      x: cakeCx - 145,
      y: cakeCy - 115,
      w: 290,
      h: 220,
      r: 145
    };

    const rosettes = (state.dish && state.dish.rosettes) ? state.dish.rosettes : [];
    for (let i = 0; i < rosettes.length; i++) {
      const ros = rosettes[i];
      const rx = Math.max(cakeCx - 98, Math.min(cakeCx + 88, ros.x));
      const ry = Math.max(cakeCy - 95, Math.min(cakeCy - 32, ros.y));
      drawSprite(ctx, 'rosette', rx, ry, 58, null, {
        shadow: true,
        shadowYRatio: 0.38,
        shadowRxRatio: 0.4,
        shadowRyRatio: 0.15,
        shadowAlpha: 0.22
      });
    }

    const candyBalls = (state.dish && state.dish.candyBalls) ? state.dish.candyBalls : [];
    const pearlColors = ['#FF4081', '#00E5FF', '#FFD740', '#69F0AE', '#B388FF', '#FF6E40'];
    const domFruit = (state.dish && state.dish.items && state.dish.items.length > 0)
      ? state.dish.items[0].id
      : 'strawberry';

    for (let i = 0; i < candyBalls.length; i++) {
      const cb = candyBalls[i];
      const cx = Math.max(cakeCx - 95, Math.min(cakeCx + 90, cb.x));
      const cy = Math.max(cakeCy - 88, Math.min(cakeCy + 45, cb.y));

      drawSprite(ctx, `sliced_${domFruit}`, cx, cy, 48, null, { shadow: false });
      for (let p = 0; p < 4; p++) {
        const px = cx + Math.cos(i * 1.7 + p * 1.57) * 20;
        const py = cy + Math.sin(i * 1.7 + p * 1.57) * 11;
        const col = pearlColors[(i + p) % pearlColors.length];
        ctx.save();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(px - 1.8, py - 1.8, 2.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    if (isSliced) {
      const tintedSlice = getTintedCakeCanvas('cake_slice_plate', state.dish);
      const plateCx = 665;
      const plateCy = 415;
      const bites = state.bitesTaken || (state.dish && state.dish.bitesTaken) || 0;
      const biteScale = Math.max(0.55, 1.0 - Math.min(bites, 3) * 0.14);

      drawSprite(ctx, 'cake_slice_plate', plateCx, plateCy, 195 * biteScale, null, {
        canvasOverride: tintedSlice,
        shadow: true,
        shadowYRatio: 0.42,
        shadowRxRatio: 0.46,
        shadowRyRatio: 0.16,
        shadowAlpha: 0.32
      });
    }

    const tools = [
      { id: 'piping', alias: 'pipingBag', sprite: 'piping_bag', x: 155, y: 268, w: 155 },
      { id: 'candy',  alias: 'candyBowl', sprite: 'candy_bowl', x: 155, y: 408, w: 145 },
      { id: 'knife',  alias: 'cakeKnife', sprite: 'cake_knife', x: 805, y: 268, w: 165 },
      { id: 'spoon',  alias: 'spoon',     sprite: 'cake_spoon', x: 805, y: 408, w: 165 }
    ];

    for (let i = 0; i < tools.length; i++) {
      const tl = tools[i];
      const isActive = state.activeTool === tl.id;
      const bob = Math.sin(t * 3.0 + i * 1.2) * 3.5;

      if (isActive) {
        drawGlowRing(ctx, tl.x, tl.y + bob, 72, 48, '#FFD54F', t * 5);
      }

      drawSprite(ctx, tl.sprite, tl.x, tl.y + bob, tl.w, null, {
        sx: isActive ? 1.12 : 1.0,
        sy: isActive ? 1.12 : 1.0,
        shadow: true,
        shadowYRatio: 0.42
      });

      const hb = {
        id: tl.id,
        x: tl.x - 76,
        y: tl.y - 62,
        w: 152,
        h: 124,
        r: 72
      };
      state.tableToolHitboxes[tl.id] = hb;
      state.tableToolHitboxes[tl.alias] = hb;
    }

    if (state.spoonDrag) {
      drawSprite(ctx, 'cake_spoon', state.spoonDrag.x, state.spoonDrag.y, 175, null, {
        rot: -0.15,
        shadow: true,
        shadowYRatio: 0.55,
        shadowAlpha: 0.25
      });
    }
  }

  function drawFrame(ctx, W, H, state, t, view) {
    const vw = (view && view.vw) ? view.vw : W;
    const vh = (view && view.vh) ? view.vh : H;
    const scale = (view && view.scale) ? view.scale : 1;
    const ox = (view && view.ox) ? view.ox : 0;
    const oy = (view && view.oy) ? view.oy : 0;

    ctx.save();
    ctx.clearRect(0, 0, vw, vh);

    // Draw full-bleed cover background across the entire viewport (zero letterbox bars, zero distortion)
    if (loaded.bg && images.bg) {
      const img = images.bg;
      const iw = img.naturalWidth || 1376;
      const ih = img.naturalHeight || 768;
      // Align tabletop horizon (y = 324 in 960x560 stage space -> oy + 324 * scale in viewport space)
      const bgScale = Math.max(vw / iw, vh / ih);
      const bw = iw * bgScale;
      const bh = ih * bgScale;
      const bx = (vw - bw) * 0.5;
      const by = (oy + 324 * scale) - bh * (324 / 560);
      ctx.drawImage(img, bx, by, bw, bh);
      // Fill bottom wood extension if tall portrait screen extends below bg image
      if (by + bh < vh) {
        const woodGrad = ctx.createLinearGradient(0, by + bh - 4, 0, vh);
        woodGrad.addColorStop(0, '#B57D43');
        woodGrad.addColorStop(1, '#8C5828');
        ctx.fillStyle = woodGrad;
        ctx.fillRect(0, by + bh - 2, vw, vh - (by + bh) + 4);
      }
      if (by > 0) {
        ctx.fillStyle = '#FCEAE3';
        ctx.fillRect(0, 0, vw, by + 2);
      }
    }

    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    drawBackgroundAndChef(ctx, W, H, state, t, true);

    const st = state.stage || state.station || 1;
    if (st === 1) drawStage1(ctx, W, H, state, t);
    else if (st === 2) drawStage2(ctx, W, H, state, t);
    else if (st === 3) drawStage3(ctx, W, H, state, t);
    else drawStage4(ctx, W, H, state, t);
    ctx.restore();
  }

  return {
    drawFrame,
    images,
    loaded
  };
})();
