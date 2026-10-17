'use strict';
/* ==========================================================================
 * Chuyu's Rainbow Kitchen — Pinterest Cozy Patisserie Art & Animation Engine
 * v4 "Studio Rig"
 *   • Articulated plush-chef critter rig (blink sweep, pupil tracking, Ahh!
 *     mouth, cheek-puff chewing, ear follow-through, toque spring lag,
 *     breathing, arms/paws, 8 signature celebration dances)
 *   • Progressive station & utensil choreography (knife swoosh, whisk orbit
 *     vortex, copper skillet pan-toss, piping bag squeeze, flying spoon)
 *   • Portioned dishes (3 luscious portions, no white bite cut-outs)
 *   • 100% procedural canvas gouache: zero text, zero system emoji.
 * ========================================================================== */
const KitchenArt = (() => {
  const portraits = {};
  const PI = Math.PI;
  const PI2 = Math.PI * 2;
  const OUTLINE = '#5C3D2E'; // Warm cocoa-brown pencil outline
  const CREAM = '#FAF3EB';   // Cream linen

  /* ------------------------------------------------------------------------
   * 0. Math, easing & colour helpers
   * ---------------------------------------------------------------------- */
  const clamp = (v, a, b) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a);
  const clamp01 = v => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const easeOutCubic = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeInCubic = t => { t = clamp01(t); return t * t * t; };
  const easeInOutSine = t => -(Math.cos(PI * clamp01(t)) - 1) / 2;
  const easeOutBack = t => {
    t = clamp01(t);
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };
  const easeOutElastic = t => {
    t = clamp01(t);
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (PI2 / 3)) + 1;
  };
  const bump = t => (t <= 0 || t >= 1) ? 0 : Math.sin(t * PI); // 0 → 1 → 0
  const seg = (t, a, b) => clamp01((t - a) / (b - a));         // sub-phase progress
  const hash = n => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  function hexToRgb(hex) {
    hex = (hex || '#ffffff').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    if (!hex || hex[0] !== '#') return hex;
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function lerpColor(hexA, hexB, t) {
    t = clamp01(t);
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }
  const lighten = (hex, t) => lerpColor(hex, '#FFFFFF', t);
  const darken = (hex, t) => lerpColor(hex, '#4A2C22', t);

  /** Normalises an animation value (number 0..1 or {active,t}) into {active,t}. */
  function normAnim(v) {
    if (!v) return { active: false, t: 0 };
    if (typeof v === 'number') return { active: v > 0 && v < 1, t: clamp01(v) };
    let t = v.t;
    if (t === undefined) t = v.progress;
    if (t === undefined && v.duration && v.elapsed !== undefined) t = v.elapsed / v.duration;
    t = clamp01(t || 0);
    const active = v.active !== undefined ? !!v.active : (t > 0 && t < 1);
    return Object.assign({}, v, { active, t });
  }

  function qbez(x0, y0, cx, cy, x1, y1, t) {
    const u = 1 - t;
    return { x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 };
  }
  function qbezTan(x0, y0, cx, cy, x1, y1, t) {
    return { x: 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx), y: 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy) };
  }

  /* ------------------------------------------------------------------------
   * 0b. Shape primitives
   * ---------------------------------------------------------------------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function circ(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, r), 0, PI2);
  }

  function ell(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot || 0, 0, PI2);
  }

  function star(ctx, x, y, r1, r2, n, rot) {
    n = n || 5;
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (rot || -PI / 2) + (i * PI) / n;
      const r = i % 2 === 0 ? r1 : r2;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function sparkle4(ctx, x, y, r, rot) {
    star(ctx, x, y, r, r * 0.28, 4, rot || 0);
  }

  function heart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.38);
    ctx.bezierCurveTo(x - s * 1.12, y - s * 0.32, x - s * 0.52, y - s * 1.05, x, y - s * 0.4);
    ctx.bezierCurveTo(x + s * 0.52, y - s * 1.05, x + s * 1.12, y - s * 0.32, x, y + s * 0.38);
    ctx.closePath();
  }

  /** Organic wobbly blob (gouache cloud / dollop / egg-white). */
  function blob(ctx, x, y, rx, ry, seed, wob, n) {
    n = n || 18;
    wob = wob === undefined ? 0.1 : wob;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI2;
      const w = 1 + wob * (0.6 * Math.sin(a * 3 + seed) + 0.4 * Math.sin(a * 5 + seed * 1.7));
      pts.push([x + Math.cos(a) * rx * w, y + Math.sin(a) * ry * w]);
    }
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my);
      const nq = pts[(i + 1) % n];
      const nn = pts[(i + 2) % n];
      ctx.quadraticCurveTo(nq[0], nq[1], (nq[0] + nn[0]) / 2, (nq[1] + nn[1]) / 2);
    }
    ctx.closePath();
  }

  /** Cheap soft shadow (no shadowBlur, 60fps friendly). */
  function softShadow(ctx, x, y, rx, ry, alpha) {
    alpha = alpha === undefined ? 0.16 : alpha;
    for (let i = 3; i >= 1; i--) {
      ctx.fillStyle = `rgba(92,61,46,${(alpha / 3).toFixed(3)})`;
      ell(ctx, x, y, rx * (0.78 + i * 0.11), ry * (0.78 + i * 0.11));
      ctx.fill();
    }
  }

  /** Elliptical pie sector path (used for dish portions). */
  function sector(ctx, x, y, rx, ry, a1, a2) {
    ctx.moveTo(x, y);
    ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, a1, a2);
    ctx.closePath();
  }

  function loadPortraits() {
    const loads = KitchenData.CRITTERS.map(c => new Promise(res => {
      const img = new Image();
      let done = false;
      const finish = ok => {
        if (done) return;
        done = true;
        if (ok) portraits[c.id] = img;
        res(ok);
      };
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      setTimeout(() => finish(img.complete && img.naturalWidth > 0), 5000);
      img.src = 'icons/' + c.icon + '.jpg';
    }));
    return Promise.all(loads);
  }

  /* ==========================================================================
   * 1. Pinterest Custom Vector Icon Library (Zero System Emojis!)
   * ========================================================================== */
  function drawIcon(ctx, kind, cx, cy, r, t) {
    t = t || 0;
    const sliced = false;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (kind) {
      case 'knife': {
        drawKnife(ctx, 0, 0, r, -0.55, 0.35 + 0.35 * Math.sin(t * 2));
        break;
      }

      case 'spoon': {
        drawSpoon(ctx, 0, 0, r * 0.95, -0.55, { scoop: 0 });
        break;
      }

      case 'whisk': {
        drawWhisk(ctx, 0, r * 0.2, r * 0.9, 0.35);
        break;
      }

      case 'spatula': {
        drawSpatula(ctx, 0, 0, r, -0.6);
        break;
      }

      case 'bowl': {
        ctx.fillStyle = 'rgba(92, 61, 46, 0.15)';
        ell(ctx, 0, r * 0.55, r * 0.78, r * 0.22);
        ctx.fill();
        drawWhisk(ctx, r * 0.3, -r * 0.42, r * 0.5, 0.5);
        ctx.fillStyle = '#9CC5B5';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ctx.beginPath();
        ctx.arc(0, -r * 0.04, r * 0.78, 0, PI);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFF5DC';
        ell(ctx, 0, -r * 0.04, r * 0.78, r * 0.24);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FAF2E8';
        heart(ctx, 0, r * 0.36, r * 0.22);
        ctx.fill();
        break;
      }

      case 'blender': {
        ctx.fillStyle = '#E8998D';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.48, r * 0.26, r * 0.96, r * 0.56, r * 0.16);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFF7EB';
        circ(ctx, 0, r * 0.54, r * 0.14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E6F4F8';
        rr(ctx, -r * 0.44, -r * 0.64, r * 0.88, r * 0.92, r * 0.14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F29BB0';
        rr(ctx, -r * 0.36, -r * 0.28, r * 0.72, r * 0.52, r * 0.08);
        ctx.fill();
        ctx.fillStyle = '#8FB9A8';
        rr(ctx, -r * 0.5, -r * 0.78, r * 1.0, r * 0.18, r * 0.08);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'pan': {
        ctx.fillStyle = 'rgba(92, 61, 46, 0.16)';
        ell(ctx, -r * 0.08, r * 0.16, r * 0.72, r * 0.52);
        ctx.fill();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ctx.save();
        ctx.translate(r * 0.58, -r * 0.26);
        ctx.rotate(-0.38);
        ctx.fillStyle = '#8C5A3C';
        rr(ctx, -r * 0.1, -r * 0.12, r * 0.62, r * 0.24, r * 0.1);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        const cg = ctx.createLinearGradient(-r, -r * 0.5, r * 0.6, r * 0.6);
        cg.addColorStop(0, '#F2B48A');
        cg.addColorStop(0.5, '#D9825B');
        cg.addColorStop(1, '#B9623F');
        ctx.fillStyle = cg;
        ell(ctx, -r * 0.1, r * 0.06, r * 0.74, r * 0.54);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#4A403B';
        ell(ctx, -r * 0.1, r * 0.04, r * 0.6, r * 0.42);
        ctx.fill();
        ctx.fillStyle = '#FFFDF7';
        blob(ctx, -r * 0.12, r * 0.04, r * 0.36, r * 0.26, 2.3, 0.12);
        ctx.fill();
        ctx.fillStyle = '#F4A236';
        circ(ctx, -r * 0.1, r * 0.02, r * 0.15);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        circ(ctx, -r * 0.15, -r * 0.03, r * 0.05);
        ctx.fill();
        break;
      }

      case 'oven': {
        // Pastel mint-green HT Mini Oven icon
        ctx.fillStyle = '#8ED6B8';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.76, -r * 0.68, r * 1.52, r * 1.36, r * 0.22);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFE599';
        rr(ctx, -r * 0.54, -r * 0.32, r * 1.08, r * 0.78, r * 0.18);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E69849';
        rr(ctx, -r * 0.36, r * 0.02, r * 0.72, r * 0.36, r * 0.12);
        ctx.fill();
        ctx.fillStyle = '#ECEEF0';
        [-r * 0.36, 0, r * 0.36].forEach(dx => {
          circ(ctx, dx, -r * 0.48, r * 0.09);
          ctx.fill();
          ctx.stroke();
        });
        break;
      }

      case 'toaster': {
        // Slice 5: Retro 2-slot Spring Pop-Up Toaster with dual bread slices
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        // Dual toast slices peeking out the top
        ctx.fillStyle = '#E6A85C';
        rr(ctx, -r * 0.54, -r * 0.76, r * 0.44, r * 0.48, r * 0.14);
        ctx.fill();
        ctx.stroke();
        rr(ctx, r * 0.04, -r * 0.76, r * 0.44, r * 0.48, r * 0.14);
        ctx.fill();
        ctx.stroke();
        // Pastel pink toaster body
        ctx.fillStyle = '#F4A6B8';
        rr(ctx, -r * 0.72, -r * 0.38, r * 1.36, r * 1.02, r * 0.26);
        ctx.fill();
        ctx.stroke();
        // Cream front badge & dial
        ctx.fillStyle = '#FFFDF9';
        circ(ctx, -r * 0.04, r * 0.14, r * 0.22);
        ctx.fill();
        ctx.stroke();
        // Spring lever knob on right
        ctx.fillStyle = '#9CD3C2';
        rr(ctx, r * 0.62, -r * 0.08, r * 0.26, r * 0.18, r * 0.08);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'microwave': {
        // Slice 5: Countertop Microwave with glowing window & glass turntable
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ctx.fillStyle = '#FFFDF9';
        rr(ctx, -r * 0.82, -r * 0.62, r * 1.64, r * 1.24, r * 0.2);
        ctx.fill();
        ctx.stroke();
        // Glowing amber window
        ctx.fillStyle = '#FFE8A3';
        rr(ctx, -r * 0.66, -r * 0.42, r * 0.96, r * 0.84, r * 0.14);
        ctx.fill();
        ctx.stroke();
        // Turntable dish inside
        ctx.fillStyle = '#E8998D';
        ell(ctx, -r * 0.18, r * 0.16, r * 0.32, r * 0.12);
        ctx.fill();
        ctx.stroke();
        // Right mint control strip with pips
        ctx.fillStyle = '#9CD3C2';
        rr(ctx, r * 0.4, -r * 0.42, r * 0.28, r * 0.84, r * 0.08);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'butter_knife': {
        // Rounded gold/ivory patisserie butter spreader knife
        ctx.save();
        ctx.rotate(-0.45);
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.6, r * 0.08);
        ctx.fillStyle = '#FFF4AD';
        rr(ctx, -r * 0.78, -r * 0.16, r * 0.92, r * 0.32, r * 0.16);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E8998D';
        rr(ctx, r * 0.1, -r * 0.18, r * 0.65, r * 0.36, r * 0.16);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'candy_balls': {
        drawSpecularCandyBall(ctx, 0, 0, r * 0.55, '#FF2A2A');
        drawSpecularCandyBall(ctx, -r * 0.35, r * 0.2, r * 0.42, '#FFE619');
        drawSpecularCandyBall(ctx, r * 0.35, r * 0.2, r * 0.42, '#2986FF');
        break;
      }

      case 'rainbow_arch': {
        drawRainbowArchFigurine(ctx, 0, r * 0.1, r * 0.024);
        break;
      }

      case 'flower_pot': {
        drawYellowSunflowerPot(ctx, 0, r * 0.05, r * 0.025);
        break;
      }

      case 'turntable': {
        drawWhiteCakeTurntable(ctx, 0, r * 0.1, r * 0.85, r * 0.45, t * 2, t);
        break;
      }

      case 'rosette': {
        drawButtercreamRosette(ctx, 0, 0, r * 0.65, '#FF2A2A');
        break;
      }

      case 'cupcake':
      case 'piping': {
        ctx.fillStyle = 'rgba(92, 61, 46, 0.15)';
        ell(ctx, 0, r * 0.68, r * 0.56, r * 0.18);
        ctx.fill();
        ctx.fillStyle = '#9CC5B5';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ctx.beginPath();
        ctx.moveTo(-r * 0.54, r * 0.05);
        ctx.lineTo(-r * 0.38, r * 0.66);
        ctx.quadraticCurveTo(0, r * 0.76, r * 0.38, r * 0.66);
        ctx.lineTo(r * 0.54, r * 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(92,61,46,0.35)';
        ctx.lineWidth = Math.max(1, r * 0.05);
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * r * 0.22, r * 0.12);
          ctx.lineTo(i * r * 0.16, r * 0.62);
          ctx.stroke();
        }
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ctx.fillStyle = '#F7B2C4';
        ell(ctx, 0, 0, r * 0.62, r * 0.26);
        ctx.fill();
        ctx.stroke();
        ell(ctx, 0, -r * 0.24, r * 0.48, r * 0.23);
        ctx.fill();
        ctx.stroke();
        ell(ctx, 0, -r * 0.45, r * 0.32, r * 0.2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E64C5B';
        circ(ctx, 0, -r * 0.66, r * 0.18);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        circ(ctx, -r * 0.06, -r * 0.72, r * 0.06);
        ctx.fill();
        break;
      }

      case 'plate':
      case 'serve': {
        ctx.fillStyle = '#FFF9F0';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        circ(ctx, 0, 0, r * 0.62);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#E8B4A6';
        ctx.lineWidth = Math.max(1.4, r * 0.06);
        circ(ctx, 0, 0, r * 0.44);
        ctx.stroke();
        ctx.fillStyle = '#E87A82';
        heart(ctx, 0, 0, r * 0.24);
        ctx.fill();
        ctx.strokeStyle = OUTLINE;
        ctx.fillStyle = '#DCE4E8';
        ctx.lineWidth = Math.max(1.6, r * 0.08);
        rr(ctx, -r * 0.92, -r * 0.52, r * 0.16, r * 1.04, r * 0.08);
        ctx.fill();
        ctx.stroke();
        ell(ctx, r * 0.84, -r * 0.32, r * 0.14, r * 0.22);
        ctx.fill();
        ctx.stroke();
        rr(ctx, r * 0.78, -r * 0.12, r * 0.12, r * 0.64, r * 0.06);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'cup': {
        ctx.save();
        ctx.rotate(0.18);
        ctx.fillStyle = '#E88388';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.6, r * 0.08);
        rr(ctx, r * 0.05, -r * 0.88, r * 0.18, r * 0.65, r * 0.06);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#F7CAD6';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ctx.beginPath();
        ctx.moveTo(-r * 0.52, -r * 0.36);
        ctx.lineTo(-r * 0.38, r * 0.68);
        ctx.quadraticCurveTo(0, r * 0.8, r * 0.38, r * 0.68);
        ctx.lineTo(r * 0.52, -r * 0.36);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFDF9';
        ctx.beginPath();
        ctx.arc(0, -r * 0.36, r * 0.5, PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#4A2C20';
        [-r * 0.2, 0, r * 0.2].forEach(bx => {
          circ(ctx, bx, r * 0.5, r * 0.09);
          ctx.fill();
        });
        break;
      }

      case 'sauce': {
        ctx.fillStyle = '#F4D58D';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.52, -r * 0.36, r * 1.04, r * 1.04, r * 0.26);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E88388';
        rr(ctx, -r * 0.58, -r * 0.58, r * 1.16, r * 0.28, r * 0.12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFF9F0';
        ell(ctx, 0, r * 0.18, r * 0.32, r * 0.22);
        ctx.fill();
        ctx.fillStyle = '#E88388';
        heart(ctx, 0, r * 0.18, r * 0.15);
        ctx.fill();
        break;
      }

      case 'topping': {
        ctx.fillStyle = '#FFF9F0';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.22, -r * 0.2, r * 0.44, r * 0.88, r * 0.1);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#E88388';
        ctx.lineWidth = Math.max(2, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(-r * 0.18, r * 0.1); ctx.lineTo(r * 0.18, -r * 0.05);
        ctx.moveTo(-r * 0.18, r * 0.42); ctx.lineTo(r * 0.18, r * 0.26);
        ctx.stroke();
        ctx.fillStyle = '#F5A623';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.5, r * 0.08);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.82);
        ctx.quadraticCurveTo(r * 0.32, -r * 0.45, 0, -r * 0.22);
        ctx.quadraticCurveTo(-r * 0.32, -r * 0.45, 0, -r * 0.82);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'camera': {
        ctx.fillStyle = '#F4D5C8';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.78, -r * 0.54, r * 1.56, r * 1.14, r * 0.26);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E88388';
        ctx.fillRect(-r * 0.74, -r * 0.08, r * 1.48, r * 0.18);
        ctx.fillStyle = '#8FB9A8';
        ctx.fillRect(-r * 0.74, r * 0.1, r * 1.48, r * 0.16);
        ctx.fillStyle = '#FFF9F0';
        circ(ctx, 0, r * 0.05, r * 0.38);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#5C4B51';
        circ(ctx, 0, r * 0.05, r * 0.22);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        circ(ctx, -r * 0.07, -r * 0.02, r * 0.07);
        ctx.fill();
        break;
      }

      case 'star': {
        ctx.fillStyle = '#F7C948';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        star(ctx, 0, 0, r * 0.82, r * 0.42, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFF6CC';
        circ(ctx, -r * 0.18, -r * 0.18, r * 0.12);
        ctx.fill();
        break;
      }

      case 'wish': {
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        [[-0.36, 0.06, 0.38], [0, -0.18, 0.46], [0.38, 0.06, 0.36], [0, 0.18, 0.42]].forEach(([cx0, cy0, cr]) => {
          circ(ctx, cx0 * r, cy0 * r, cr * r);
          ctx.fill();
        });
        [[-0.36, 0.06, 0.38], [0, -0.18, 0.46], [0.38, 0.06, 0.36]].forEach(([cx0, cy0, cr]) => {
          circ(ctx, cx0 * r, cy0 * r, cr * r);
          ctx.stroke();
        });
        ctx.fillStyle = '#FFFDF9';
        ell(ctx, 0, r * 0.06, r * 0.56, r * 0.3);
        ctx.fill();
        ctx.fillStyle = '#E88388';
        heart(ctx, 0, r * 0.02, r * 0.28);
        ctx.fill();
        break;
      }

      case 'free': {
        ctx.fillStyle = '#E6B88A';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ell(ctx, 0, 0, r * 0.82, r * 0.66, -0.2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFF5EA';
        circ(ctx, r * 0.34, r * 0.18, r * 0.16);
        ctx.fill();
        ctx.stroke();
        [[-0.38, -0.15, '#E87A82'], [-0.12, -0.34, '#F5C242'], [0.24, -0.26, '#88B399'], [-0.28, 0.24, '#9B82C9']].forEach(([px, py, col]) => {
          ctx.fillStyle = col;
          circ(ctx, px * r, py * r, r * 0.14);
          ctx.fill();
        });
        break;
      }

      case 'refresh': {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(2.6, r * 0.18);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.56, 0.5, PI * 1.75);
        ctx.stroke();
        ctx.fillStyle = OUTLINE;
        ctx.beginPath();
        ctx.moveTo(r * 0.18, -r * 0.72);
        ctx.lineTo(r * 0.68, -r * 0.52);
        ctx.lineTo(r * 0.32, -r * 0.18);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'sound_on':
      case 'sound_off': {
        ctx.fillStyle = kind === 'sound_on' ? '#E88388' : '#B8ACA6';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(2, r * 0.11);
        ell(ctx, -r * 0.22, r * 0.32, r * 0.28, r * 0.2, -0.3);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, r * 0.28);
        ctx.lineTo(0, -r * 0.55);
        ctx.lineTo(r * 0.45, -r * 0.35);
        ctx.lineTo(r * 0.45, -r * 0.1);
        ctx.stroke();
        if (kind === 'sound_off') {
          ctx.strokeStyle = '#D9534F';
          ctx.lineWidth = Math.max(2.5, r * 0.14);
          ctx.beginPath();
          ctx.moveTo(-r * 0.6, -r * 0.6);
          ctx.lineTo(r * 0.6, r * 0.6);
          ctx.stroke();
        }
        break;
      }

      case 'arrow_right': {
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(2, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(-r * 0.65, -r * 0.24);
        ctx.lineTo(r * 0.08, -r * 0.24);
        ctx.lineTo(r * 0.08, -r * 0.55);
        ctx.lineTo(r * 0.72, 0);
        ctx.lineTo(r * 0.08, r * 0.55);
        ctx.lineTo(r * 0.08, r * 0.24);
        ctx.lineTo(-r * 0.65, r * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'arrow_down': {
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(2, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(-r * 0.24, -r * 0.65);
        ctx.lineTo(-r * 0.24, r * 0.08);
        ctx.lineTo(-r * 0.55, r * 0.08);
        ctx.lineTo(0, r * 0.72);
        ctx.lineTo(r * 0.55, r * 0.08);
        ctx.lineTo(r * 0.24, r * 0.08);
        ctx.lineTo(r * 0.24, -r * 0.65);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'arrow_left': {
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(2, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(r * 0.65, -r * 0.24);
        ctx.lineTo(-r * 0.08, -r * 0.24);
        ctx.lineTo(-r * 0.08, -r * 0.55);
        ctx.lineTo(-r * 0.72, 0);
        ctx.lineTo(-r * 0.08, r * 0.55);
        ctx.lineTo(-r * 0.08, r * 0.24);
        ctx.lineTo(r * 0.65, r * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'swirl_arrow': {
        ctx.strokeStyle = '#FFFDF9';
        ctx.lineWidth = Math.max(2.4, r * 0.16);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.62, -0.6 * PI, 0.75 * PI);
        ctx.stroke();
        const endA = 0.75 * PI;
        const ax = Math.cos(endA) * r * 0.62;
        const ay = Math.sin(endA) * r * 0.62;
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(ax - r * 0.32, ay - r * 0.08);
        ctx.lineTo(ax, ay + r * 0.24);
        ctx.lineTo(ax + r * 0.18, ay - r * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'sink': {
        // Goose-neck faucet with cute water droplet
        ctx.fillStyle = '#C9D5DC';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(2, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, r * 0.55);
        ctx.lineTo(-r * 0.45, -r * 0.2);
        ctx.quadraticCurveTo(-r * 0.45, -r * 0.65, -r * 0.05, -r * 0.65);
        ctx.quadraticCurveTo(r * 0.35, -r * 0.65, r * 0.35, -r * 0.25);
        ctx.lineTo(r * 0.35, -r * 0.1);
        ctx.stroke();
        rr(ctx, r * 0.22, -r * 0.1, r * 0.26, r * 0.14, 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#5CC8FF';
        circ(ctx, r * 0.35, r * 0.28, r * 0.18);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'cookie': {
        // Cute scalloped bear butter cookie
        ctx.fillStyle = '#F5D076';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.1);
        circ(ctx, 0, 0, r * 0.62);
        ctx.fill();
        ctx.stroke();
        circ(ctx, -r * 0.45, -r * 0.45, r * 0.22);
        ctx.fill();
        ctx.stroke();
        circ(ctx, r * 0.45, -r * 0.45, r * 0.22);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = OUTLINE;
        circ(ctx, -r * 0.2, -r * 0.05, r * 0.07);
        ctx.fill();
        circ(ctx, r * 0.2, -r * 0.05, r * 0.07);
        ctx.fill();
        circ(ctx, 0, r * 0.15, r * 0.08);
        ctx.fill();
        break;
      }

      case 'sushi': {
        // Nori outer ring, rice, salmon center
        ctx.fillStyle = '#263238';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(2, r * 0.1);
        circ(ctx, 0, 0, r * 0.68);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFDF9';
        circ(ctx, 0, 0, r * 0.52);
        ctx.fill();
        ctx.fillStyle = '#FF5A36';
        circ(ctx, 0, 0, r * 0.24);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'basket': {
        ctx.fillStyle = '#DEB078';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.6, PI, 0);
        ctx.stroke();
        rr(ctx, -r * 0.68, -r * 0.08, r * 1.36, r * 0.68, r * 0.18);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#B5834C';
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, r * 0.24);
        ctx.lineTo(r * 0.45, r * 0.24);
        ctx.stroke();
        break;
      }

      case 'lock': {
        // Storybook golden brass padlock with silver shackle
        ctx.strokeStyle = '#8C6239';
        ctx.lineWidth = Math.max(2, r * 0.12);
        ctx.beginPath();
        ctx.arc(0, -r * 0.16, r * 0.32, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#F4CF82';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.44, -r * 0.14, r * 0.88, r * 0.72, r * 0.18);
        ctx.fill();
        ctx.stroke();
        // Keyhole
        ctx.fillStyle = OUTLINE;
        circ(ctx, 0, r * 0.12, r * 0.09);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-r * 0.05, r * 0.14);
        ctx.lineTo(r * 0.05, r * 0.14);
        ctx.lineTo(r * 0.07, r * 0.34);
        ctx.lineTo(-r * 0.07, r * 0.34);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'water_stream':
      case 'water_splash': {
        // Circulating sink faucet & splashing crystal water droplet
        ctx.fillStyle = '#A0D8EF';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ctx.beginPath();
        ctx.arc(0, r * 0.22, r * 0.52, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Water drops
        ctx.fillStyle = '#64B5F6';
        circ(ctx, 0, -r * 0.18, r * 0.24);
        ctx.fill();
        ctx.stroke();
        circ(ctx, -r * 0.28, -r * 0.04, r * 0.14);
        ctx.fill();
        ctx.stroke();
        circ(ctx, r * 0.28, -r * 0.04, r * 0.14);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'bun': {
        // Golden sesame burger bun & sushi roll bento icon
        ctx.fillStyle = '#DEB887';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ctx.beginPath();
        ctx.arc(0, r * 0.05, r * 0.68, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Sesame seeds
        ctx.fillStyle = '#FFFDF9';
        circ(ctx, -r * 0.28, -r * 0.22, r * 0.05);
        ctx.fill();
        circ(ctx, 0, -r * 0.35, r * 0.05);
        ctx.fill();
        circ(ctx, r * 0.28, -r * 0.22, r * 0.05);
        ctx.fill();
        // Bun bottom
        ctx.fillStyle = '#C89B65';
        rr(ctx, -r * 0.65, r * 0.12, r * 1.3, r * 0.24, r * 0.08);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'soapy_bubble':
      case 'dishwash': {
        // Sudsy iridescent dishwashing bubbles + sparkling plate
        ctx.fillStyle = '#FAF3EB';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        circ(ctx, -r * 0.08, r * 0.14, r * 0.56);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(178, 226, 245, 0.82)';
        circ(ctx, -r * 0.22, -r * 0.08, r * 0.36);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 214, 230, 0.85)';
        circ(ctx, r * 0.28, -r * 0.22, r * 0.32);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFD166';
        sparkle4(ctx, r * 0.36, r * 0.28, r * 0.28, t * 2);
        ctx.fill();
        break;
      }

      case 'sponge': {
        // Cozy cellulose kitchen sponge (honey yellow cellulose + mint scrub pad + suds)
        ctx.save();
        ctx.rotate(-0.18);
        ctx.fillStyle = '#78C87E';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.68, -r * 0.44, r * 1.36, r * 0.36, r * 0.14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFE066';
        rr(ctx, -r * 0.68, -r * 0.16, r * 1.36, r * 0.62, r * 0.18);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#D9B226';
        [[-0.38, 0.06, 0.08], [0.02, 0.18, 0.09], [0.36, 0.04, 0.07], [-0.18, 0.26, 0.06], [0.24, 0.26, 0.06]].forEach(([px, py, pr]) => {
          circ(ctx, px * r, py * r, pr * r);
          ctx.fill();
        });
        ctx.restore();
        ctx.fillStyle = 'rgba(220, 248, 255, 0.92)';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.4, r * 0.07);
        circ(ctx, r * 0.44, -r * 0.42, r * 0.22);
        ctx.fill();
        ctx.stroke();
        circ(ctx, r * 0.18, -r * 0.52, r * 0.15);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'soap_pump': {
        // Pastel pump dispenser bottle
        ctx.fillStyle = '#FF9EB5';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.44, -r * 0.18, r * 0.88, r * 0.96, r * 0.26);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFDF9';
        rr(ctx, -r * 0.2, -r * 0.42, r * 0.4, r * 0.26, r * 0.08);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.42);
        ctx.lineTo(0, -r * 0.66);
        ctx.lineTo(r * 0.38, -r * 0.66);
        ctx.lineTo(r * 0.46, -r * 0.54);
        ctx.stroke();
        ctx.fillStyle = '#FFFDF9';
        heart(ctx, 0, r * 0.3, r * 0.22);
        ctx.fill();
        break;
      }

      case 'faucet': {
        // Gooseneck brass faucet with swirling aqua water stream
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(2.2, r * 0.11);
        ctx.beginPath();
        ctx.moveTo(-r * 0.48, r * 0.36);
        ctx.lineTo(-r * 0.48, -r * 0.26);
        ctx.arc(-r * 0.08, -r * 0.26, r * 0.4, PI, 0, false);
        ctx.lineTo(r * 0.32, -r * 0.12);
        ctx.stroke();
        ctx.strokeStyle = '#F5D076';
        ctx.lineWidth = Math.max(1.4, r * 0.06);
        ctx.stroke();
        ctx.fillStyle = '#7CE0F9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.6, r * 0.08);
        ell(ctx, r * 0.32, r * 0.22, r * 0.14, r * 0.28);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#48BFE3';
        ctx.beginPath();
        ctx.arc(r * 0.22, r * 0.58, r * 0.28, 0.2, PI * 1.45);
        ctx.stroke();
        break;
      }

      case 'drying_rack': {
        // Slotted wooden drying rack with clean plates upright
        ctx.fillStyle = '#FAF3EB';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        circ(ctx, -r * 0.22, -r * 0.12, r * 0.44);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFE5EC';
        circ(ctx, r * 0.22, -r * 0.08, r * 0.38);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#DEB078';
        rr(ctx, -r * 0.76, r * 0.22, r * 1.52, r * 0.34, r * 0.12);
        ctx.fill();
        ctx.stroke();
        [-0.48, -0.16, 0.16, 0.48].forEach(px => {
          ctx.beginPath();
          ctx.moveTo(px * r, r * 0.22);
          ctx.lineTo(px * r, -r * 0.14);
          ctx.stroke();
        });
        break;
      }

      case 'recycle_bin':
      case 'trash_bin': {
        // Dual sorting pedal bin icon (sage green recycle + terracotta compost/trash)
        ctx.fillStyle = '#78C87E';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.62, -r * 0.28, r * 0.64, r * 0.92, r * 0.14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FF9A62';
        rr(ctx, r * 0.02, -r * 0.22, r * 0.6, r * 0.86, r * 0.14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FAF3EB';
        rr(ctx, -r * 0.68, -r * 0.44, r * 0.76, r * 0.2, r * 0.08);
        ctx.fill();
        ctx.stroke();
        rr(ctx, -r * 0.02, -r * 0.38, r * 0.68, r * 0.18, r * 0.08);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#FFFDF9';
        ctx.lineWidth = Math.max(1.5, r * 0.07);
        ctx.beginPath();
        ctx.arc(-r * 0.3, r * 0.18, r * 0.16, 0, PI * 1.5);
        ctx.stroke();
        break;
      }

      case 'scoop':
      case 'icecream':
      case 'softserve': {
        // Waffle cone
        ctx.fillStyle = '#E0A158';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ctx.beginPath();
        ctx.moveTo(-r * 0.42, 0);
        ctx.lineTo(r * 0.42, 0);
        ctx.lineTo(0, r * 0.86);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Swirling pastel soft-serve tiers
        ctx.fillStyle = '#FF85A6';
        ell(ctx, 0, -r * 0.1, r * 0.5, r * 0.24);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFF5DC';
        ell(ctx, 0, -r * 0.36, r * 0.38, r * 0.2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FF85A6';
        ctx.beginPath();
        ctx.moveTo(-r * 0.24, -r * 0.48);
        ctx.quadraticCurveTo(0, -r * 0.92, r * 0.12, -r * 0.78);
        ctx.quadraticCurveTo(r * 0.24, -r * 0.54, r * 0.24, -r * 0.48);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'aquarium':
      case 'fishbowl': {
        // Crystal round fishbowl with aqua water & orange goldfish
        ctx.fillStyle = 'rgba(156, 224, 236, 0.75)';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        circ(ctx, 0, r * 0.08, r * 0.72);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFDF9';
        ell(ctx, 0, -r * 0.56, r * 0.48, r * 0.14);
        ctx.fill();
        ctx.stroke();
        // Cute orange fish
        ctx.fillStyle = '#FF8C42';
        ell(ctx, -r * 0.06, r * 0.12, r * 0.28, r * 0.18);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.18, r * 0.12);
        ctx.lineTo(r * 0.4, -r * 0.04);
        ctx.lineTo(r * 0.4, r * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'doll':
      case 'dollcare': {
        // Pastel baby doll face with bonnet & pacifier
        ctx.fillStyle = '#F7C6D4';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        circ(ctx, 0, 0, r * 0.74);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFE5D0';
        circ(ctx, 0, r * 0.06, r * 0.54);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = OUTLINE;
        circ(ctx, -r * 0.2, -r * 0.02, r * 0.07);
        ctx.fill();
        circ(ctx, r * 0.2, -r * 0.02, r * 0.07);
        ctx.fill();
        ctx.fillStyle = '#9CD3C2';
        circ(ctx, 0, r * 0.24, r * 0.16);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'cake_knife': {
        ctx.save();
        ctx.rotate(-0.55);
        // Pastel pink ergonomic toy handle with heart button
        ctx.fillStyle = '#FF94B8';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.22, r * 0.08, r * 0.44, r * 0.72, r * 0.2);
        ctx.fill();
        ctx.stroke();
        // Scalloped cream/mint plastic blade
        ctx.fillStyle = '#FFFDF9';
        ctx.beginPath();
        ctx.moveTo(-r * 0.18, r * 0.12);
        ctx.lineTo(-r * 0.22, -r * 0.72);
        ctx.quadraticCurveTo(0, -r * 0.88, r * 0.24, -r * 0.62);
        ctx.lineTo(r * 0.2, r * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Musical eighth-note emblem on the blade (pure vector shape, zero text)
        ctx.fillStyle = '#E87A82';
        ell(ctx, -r * 0.03, -r * 0.18, r * 0.1, r * 0.07, -0.3);
        ctx.fill();
        ctx.strokeStyle = '#E87A82';
        ctx.lineWidth = Math.max(1.5, r * 0.07);
        ctx.beginPath();
        ctx.moveTo(r * 0.05, -r * 0.18);
        ctx.lineTo(r * 0.05, -r * 0.48);
        ctx.lineTo(r * 0.16, -r * 0.4);
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'candle': {
        // Striped birthday candle with glowing flame
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.22, -r * 0.18, r * 0.44, r * 0.9, r * 0.1);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#FF85B3';
        ctx.lineWidth = Math.max(2, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(-r * 0.18, r * 0.12); ctx.lineTo(r * 0.18, -r * 0.04);
        ctx.moveTo(-r * 0.18, r * 0.44); ctx.lineTo(r * 0.18, r * 0.28);
        ctx.stroke();
        ctx.fillStyle = '#FFB300';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.5, r * 0.08);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.84);
        ctx.quadraticCurveTo(r * 0.3, -r * 0.46, 0, -r * 0.2);
        ctx.quadraticCurveTo(-r * 0.3, -r * 0.46, 0, -r * 0.84);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'candy_jar': {
        // Glass candy jar filled with rainbow candy balls + mini scoop
        ctx.fillStyle = 'rgba(240, 250, 255, 0.78)';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.56, -r * 0.36, r * 1.12, r * 1.06, r * 0.26);
        ctx.fill();
        ctx.stroke();
        const cCols = ['#FF2A2A', '#FF8C1A', '#FFE619', '#1FD141', '#2986FF', '#8C2BFF'];
        [[-0.28, 0.42], [0, 0.44], [0.28, 0.42], [-0.22, 0.14], [0.1, 0.16], [0.3, 0.12]].forEach(([bx, by], i) => {
          ctx.fillStyle = cCols[i % cCols.length];
          circ(ctx, bx * r, by * r, r * 0.16);
          ctx.fill();
          ctx.stroke();
        });
        ctx.fillStyle = '#FF94B8';
        rr(ctx, -r * 0.46, -r * 0.58, r * 0.92, r * 0.24, r * 0.1);
        ctx.fill();
        ctx.stroke();
        circ(ctx, 0, -r * 0.68, r * 0.14);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'heart': {
        ctx.fillStyle = '#E87A82';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        heart(ctx, 0, r * 0.08, r * 0.7);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ell(ctx, -r * 0.26, -r * 0.22, r * 0.16, r * 0.1, -0.5);
        ctx.fill();
        break;
      }

      case 'doctor':
      case 'clinic': {
        // Pastel ambulance / kitty doctor clinic carry case with medical cross emblem
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        // Handle arch
        ctx.beginPath();
        ctx.arc(0, -r * 0.48, r * 0.32, PI, 0);
        ctx.stroke();
        // Case body
        ctx.fillStyle = '#FFEBF0';
        rr(ctx, -r * 0.74, -r * 0.46, r * 1.48, r * 1.12, r * 0.24);
        ctx.fill();
        ctx.stroke();
        // Mint top trim
        ctx.fillStyle = '#9CD3C2';
        rr(ctx, -r * 0.74, -r * 0.46, r * 1.48, r * 0.3, r * 0.2);
        ctx.fill();
        ctx.stroke();
        // White badge circle + red/coral medical cross
        ctx.fillStyle = '#FFFDF9';
        circ(ctx, 0, r * 0.16, r * 0.36);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E85D75';
        rr(ctx, -r * 0.1, -r * 0.06, r * 0.2, r * 0.44, r * 0.04);
        ctx.fill();
        rr(ctx, -r * 0.22, r * 0.06, r * 0.44, r * 0.2, r * 0.04);
        ctx.fill();
        break;
      }

      case 'stethoscope': {
        // Binaural ear tubes + heart chestpiece
        ctx.strokeStyle = '#8C9BA5';
        ctx.lineWidth = Math.max(2, r * 0.11);
        ctx.beginPath();
        ctx.arc(0, -r * 0.28, r * 0.42, PI * 0.85, PI * 0.15, true);
        ctx.stroke();
        // Pink tubing loop
        ctx.strokeStyle = '#E87A82';
        ctx.lineWidth = Math.max(2.4, r * 0.13);
        ctx.beginPath();
        ctx.moveTo(0, r * 0.14);
        ctx.bezierCurveTo(-r * 0.4, r * 0.55, r * 0.55, r * 0.75, r * 0.38, r * 0.22);
        ctx.stroke();
        // Chestpiece diaphragm with heart
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        circ(ctx, r * 0.38, r * 0.16, r * 0.32);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E85D75';
        heart(ctx, r * 0.38, r * 0.18, r * 0.18);
        ctx.fill();
        break;
      }

      case 'thermometer': {
        ctx.save();
        ctx.rotate(-0.55);
        // Ergonomic digital ear thermometer body
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.3, -r * 0.65, r * 0.6, r * 1.35, r * 0.26);
        ctx.fill();
        ctx.stroke();
        // Probe cone tip at top
        ctx.fillStyle = '#8CC8E8';
        ctx.beginPath();
        ctx.moveTo(-r * 0.18, -r * 0.62);
        ctx.lineTo(-r * 0.08, -r * 0.94);
        ctx.lineTo(r * 0.08, -r * 0.94);
        ctx.lineTo(r * 0.18, -r * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Green healthy display window (zero text!)
        ctx.fillStyle = '#78C47C';
        rr(ctx, -r * 0.18, -r * 0.32, r * 0.36, r * 0.42, r * 0.08);
        ctx.fill();
        ctx.stroke();
        // Heart status icon on screen
        ctx.fillStyle = '#FFFDF9';
        heart(ctx, 0, -r * 0.1, r * 0.11);
        ctx.fill();
        // Pink scan button
        ctx.fillStyle = '#F4A6B8';
        circ(ctx, 0, r * 0.36, r * 0.13);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'bandaid': {
        ctx.save();
        ctx.rotate(-0.42);
        ctx.fillStyle = '#F7CAD6';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.82, -r * 0.34, r * 1.64, r * 0.68, r * 0.32);
        ctx.fill();
        ctx.stroke();
        // Center gauze pad cushion
        ctx.fillStyle = '#FFFDF9';
        rr(ctx, -r * 0.3, -r * 0.28, r * 0.6, r * 0.56, r * 0.12);
        ctx.fill();
        ctx.stroke();
        // Cute heart on center pad
        ctx.fillStyle = '#E85D75';
        heart(ctx, 0, r * 0.03, r * 0.18);
        ctx.fill();
        // Breathable micro-perforation dots on wings
        ctx.fillStyle = '#D98A9E';
        [-0.56, -0.44, 0.44, 0.56].forEach(wx => {
          [-0.12, 0.12].forEach(wy => {
            circ(ctx, wx * r, wy * r, r * 0.04);
            ctx.fill();
          });
        });
        ctx.restore();
        break;
      }

      case 'medicine': {
        // Amber syrup bottle + pink dropper bulb
        ctx.fillStyle = '#D48C56';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.48, -r * 0.18, r * 0.96, r * 0.92, r * 0.22);
        ctx.fill();
        ctx.stroke();
        // Pink berry syrup level inside
        ctx.fillStyle = '#FF7096';
        rr(ctx, -r * 0.38, r * 0.12, r * 0.76, r * 0.52, r * 0.14);
        ctx.fill();
        // White collar + pink squeeze bulb
        ctx.fillStyle = '#FFFDF9';
        rr(ctx, -r * 0.32, -r * 0.38, r * 0.64, r * 0.22, r * 0.08);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F4A6B8';
        ell(ctx, 0, -r * 0.62, r * 0.22, r * 0.28);
        ctx.fill();
        ctx.stroke();
        // Heart label on bottle
        ctx.fillStyle = '#FFFDF9';
        heart(ctx, 0, r * 0.38, r * 0.2);
        ctx.fill();
        break;
      }

      case 'brush': {
        ctx.save();
        ctx.rotate(-0.48);
        // Wooden handle & oval paddle
        ctx.fillStyle = '#DEB078';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.16, r * 0.15, r * 0.32, r * 0.7, r * 0.14);
        ctx.fill();
        ctx.stroke();
        ell(ctx, 0, -r * 0.22, r * 0.54, r * 0.62);
        ctx.fill();
        ctx.stroke();
        // Soft pink bristle cushion pad
        ctx.fillStyle = '#F4A6B8';
        ell(ctx, 0, -r * 0.22, r * 0.4, r * 0.48);
        ctx.fill();
        ctx.stroke();
        // Rounded pin tips
        ctx.fillStyle = '#FFFDF9';
        [[-0.18, -0.42], [0, -0.46], [0.18, -0.42], [-0.2, -0.2], [0, -0.22], [0.2, -0.2], [-0.15, 0], [0.15, 0]].forEach(([bx, by]) => {
          circ(ctx, bx * r, by * r, r * 0.055);
          ctx.fill();
        });
        ctx.restore();
        break;
      }

      case 'playset':
      case 'unbox': {
        // Slice 3: Ultimate Kitchen Playset carry-case / modular assembly icon
        ctx.fillStyle = '#FF8FA8';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.78, -r * 0.18, r * 1.56, r * 0.88, r * 0.22);
        ctx.fill();
        ctx.stroke();
        // Arching mint backsplash hood
        ctx.fillStyle = '#7ED6C1';
        ctx.beginPath();
        ctx.arc(0, -r * 0.18, r * 0.62, PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Carry handle on top
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(2.2, r * 0.11);
        ctx.beginPath();
        ctx.arc(0, -r * 0.74, r * 0.24, PI, 0);
        ctx.stroke();
        // Burner ring + faucet mini emblem
        ctx.fillStyle = '#FFFDF9';
        circ(ctx, -r * 0.32, r * 0.24, r * 0.22);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#62D2E8';
        circ(ctx, r * 0.32, r * 0.24, r * 0.22);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'battery': {
        // Slice 3: AA Battery sound module icon with golden positive cap & lightning spark
        ctx.fillStyle = '#F7C948';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        rr(ctx, -r * 0.22, -r * 0.78, r * 0.44, r * 0.22, r * 0.08);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#5BB98C';
        rr(ctx, -r * 0.44, -r * 0.58, r * 0.88, r * 1.28, r * 0.18);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F7C948';
        rr(ctx, -r * 0.44, -r * 0.58, r * 0.88, r * 0.36, r * 0.14);
        ctx.fill();
        ctx.stroke();
        // Lightning bolt emblem (pure vector, zero text)
        ctx.fillStyle = '#FFFDF9';
        ctx.beginPath();
        ctx.moveTo(r * 0.08, -r * 0.16);
        ctx.lineTo(-r * 0.18, r * 0.16);
        ctx.lineTo(r * 0.04, r * 0.16);
        ctx.lineTo(-r * 0.08, r * 0.48);
        ctx.lineTo(r * 0.2, r * 0.08);
        ctx.lineTo(-r * 0.02, r * 0.08);
        ctx.closePath();
        ctx.fill();
        break;
      }

      default: {
        ctx.fillStyle = '#F7B2C4';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        circ(ctx, 0, 0, r * 0.6);
        ctx.fill();
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  }

  /* ==========================================================================
   * 1b. HT Mini Cakes Miniature Props & Figurines (zuCz-X1TrMM)
   * ========================================================================== */
  const RAINBOW_6 = ['#FF2A2A', '#FF8C1A', '#FFE619', '#1FD141', '#2986FF', '#8C2BFF'];
  function safeColor(c, fallback) {
    return (typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) ? c : (fallback || '#FF85B3');
  }
  function drawSpecularCandyBall(ctx, x, y, r, color) {
    color = safeColor(color, '#FF2A2A');
    r = Math.max(0.5, r || 8);
    ctx.save();
    ctx.translate(x, y);
    // Soft contact drop shadow
    ctx.fillStyle = 'rgba(40, 20, 10, 0.28)';
    ell(ctx, 1, r * 0.75, r * 0.9, r * 0.38);
    ctx.fill();
    // 3D spherical radial gradient
    const rg = ctx.createRadialGradient(-r * 0.32, -r * 0.35, r * 0.08, 0, 0, r);
    rg.addColorStop(0, lighten(color, 0.45));
    rg.addColorStop(0.5, color);
    rg.addColorStop(1, darken(color, 0.35));
    ctx.fillStyle = rg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.4, r * 0.12);
    circ(ctx, 0, 0, r);
    ctx.fill();
    ctx.stroke();
    // Specular catchlight: primary bright white curved reflection (as in yt_maxresdefault.jpg)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ell(ctx, -r * 0.36, -r * 0.38, r * 0.35, r * 0.22, -0.6);
    ctx.fill();
    // Secondary sharp specular pin-point dot
    circ(ctx, -r * 0.15, -r * 0.52, r * 0.1);
    ctx.fill();
    // Subtle bounce light on bottom edge
    ctx.fillStyle = rgba(lighten(color, 0.6), 0.35);
    ell(ctx, r * 0.25, r * 0.42, r * 0.4, r * 0.15, 0.4);
    ctx.fill();
    ctx.restore();
  }

  function drawButtercreamRosette(ctx, x, y, r, color) {
    color = safeColor(color, '#FF85B3');
    r = Math.max(0.5, r || 8);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(40, 20, 10, 0.22)';
    ell(ctx, 1, r * 0.65, r * 0.95, r * 0.4);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.4, r * 0.1);
    // Outer fluted scalloped petals
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * PI2;
      const px = Math.cos(a) * r * 0.52, py = Math.sin(a) * r * 0.42;
      circ(ctx, px, py, r * 0.44);
      ctx.fill();
      ctx.stroke();
    }
    // Swirling center core
    const cg = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 2, 0, 0, r * 0.7);
    cg.addColorStop(0, lighten(color, 0.35));
    cg.addColorStop(0.7, color);
    cg.addColorStop(1, darken(color, 0.25));
    ctx.fillStyle = cg;
    circ(ctx, 0, -r * 0.05, r * 0.62);
    ctx.fill();
    ctx.stroke();
    // Internal rosette spiral crease lines
    ctx.strokeStyle = darken(color, 0.3);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let k = 0; k <= 14; k++) {
      const a = k * 0.48;
      const rad = r * 0.08 + k * r * 0.036;
      const px = Math.cos(a) * rad, py = Math.sin(a) * rad * 0.78 - r * 0.06;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // Creamy glossy highlight on spiral crest
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ell(ctx, -r * 0.22, -r * 0.28, r * 0.22, r * 0.12, -0.5);
    ctx.fill();
    ctx.restore();
  }

  function drawWhiteCakeTurntable(ctx, cx, cy, rx, ry, angle, t) {
    rx = rx || 142;
    ry = ry || 76;
    angle = angle || 0;
    ctx.save();
    ctx.translate(cx, cy);
    // Base contact drop shadow
    softShadow(ctx, 0, 72, rx * 0.85, 22, 0.22);
    // Sturdy white pedestal base
    const baseW = rx * 0.44;
    const bg = ctx.createLinearGradient(-baseW, 0, baseW, 0);
    bg.addColorStop(0, '#ECEAE4');
    bg.addColorStop(0.3, '#FAF9F6');
    bg.addColorStop(0.7, '#FFFFFF');
    bg.addColorStop(1, '#E4E2DC');
    ctx.fillStyle = bg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;
    // Curved flared pedestal stand
    ctx.beginPath();
    ctx.moveTo(-baseW * 0.6, 24);
    ctx.quadraticCurveTo(-baseW * 0.4, 46, -baseW, 64);
    ctx.lineTo(baseW, 64);
    ctx.quadraticCurveTo(baseW * 0.4, 46, baseW * 0.6, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Chrome connector collar ring
    ctx.fillStyle = '#C9D4DC';
    rr(ctx, -baseW * 0.65, 22, baseW * 1.3, 8, 4);
    ctx.fill();
    ctx.stroke();
    // Beveled turntable disc thickness
    const thick = 14;
    ctx.fillStyle = '#E8E6E0';
    ctx.beginPath();
    ctx.ellipse(0, thick, rx, ry, 0, 0, PI);
    ctx.lineTo(-rx, 0);
    ctx.ellipse(0, 0, rx, ry, 0, PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Top rotating white disc surface
    const discG = ctx.createRadialGradient(-rx * 0.2, -ry * 0.2, rx * 0.1, 0, 0, rx);
    discG.addColorStop(0, '#FFFFFF');
    discG.addColorStop(0.85, '#FAF9F7');
    discG.addColorStop(1, '#F0EFEA');
    ctx.fillStyle = discG;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.5;
    ell(ctx, 0, 0, rx, ry);
    ctx.fill();
    ctx.stroke();
    // Subtle turntable concentric concentric rings / groove
    ctx.strokeStyle = 'rgba(215, 210, 202, 0.7)';
    ctx.lineWidth = 1.8;
    ell(ctx, 0, 0, rx * 0.88, ry * 0.88);
    ctx.stroke();
    ell(ctx, 0, 0, rx * 0.66, ry * 0.66);
    ctx.stroke();
    // Subtle rotating ticks/dots that show the rotation smoothly (same sense as the cake decorations)
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * PI2 - angle;
      const px = Math.cos(a) * rx * 0.88, py = Math.sin(a) * ry * 0.88;
      ctx.fillStyle = 'rgba(180, 172, 160, 0.6)';
      circ(ctx, px, py, 2.2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawYellowSunflowerPot(ctx, x, y, scale) {
    scale = scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    // Pot base (warm amber/orange)
    ctx.fillStyle = '#FF9E1B';
    rr(ctx, -18, 12, 36, 26, 8);
    ctx.fill();
    ctx.stroke();
    // Pot rim
    ctx.fillStyle = '#FFAE34';
    rr(ctx, -21, 8, 42, 9, 4);
    ctx.fill();
    ctx.stroke();
    // Green leaves
    ctx.fillStyle = '#2DBE56';
    [-18, 18].forEach(lx => {
      ctx.beginPath();
      ctx.ellipse(lx, 10, 8, 5, lx < 0 ? -0.4 : 0.4, 0, PI2);
      ctx.fill();
      ctx.stroke();
    });
    // Sunflower petals (bright sunshine yellow)
    ctx.fillStyle = '#FFD700';
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * PI2;
      circ(ctx, Math.cos(a) * 16, -10 + Math.sin(a) * 16, 7);
      ctx.fill();
      ctx.stroke();
    }
    // Cute round smiling face
    ctx.fillStyle = '#FFF5E0';
    circ(ctx, 0, -10, 15);
    ctx.fill();
    ctx.stroke();
    // Eyes
    ctx.fillStyle = OUTLINE;
    circ(ctx, -5, -11, 2.2);
    circ(ctx, 5, -11, 2.2);
    ctx.fill();
    // Gentle pink cheeks
    ctx.fillStyle = 'rgba(255, 130, 130, 0.65)';
    circ(ctx, -8, -7, 2.8);
    circ(ctx, 8, -7, 2.8);
    ctx.fill();
    // Sweet smile
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -9, 4, 0.2, PI - 0.2);
    ctx.stroke();
    ctx.restore();
  }

  function drawRainbowArchFigurine(ctx, x, y, scale) {
    scale = scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    // 6 concentric rainbow bands
    const cols = ['#FF2A2A', '#FF8C1A', '#FFE619', '#1FD141', '#2986FF', '#8C2BFF'];
    const rOuter = 34, bandW = 4.2;
    for (let i = 0; i < 6; i++) {
      const rad = rOuter - i * bandW;
      ctx.strokeStyle = cols[i];
      ctx.lineWidth = bandW + 0.8;
      ctx.beginPath();
      ctx.arc(0, 14, rad, PI, 0);
      ctx.stroke();
    }
    // Outlines
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 14, rOuter + 2, PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 14, rOuter - 6 * bandW - 1, PI, 0);
    ctx.stroke();
    // Cloud pedestals at left and right base
    [-rOuter + 3, rOuter - 3].forEach(cx0 => {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      circ(ctx, cx0 - 5, 14, 7);
      circ(ctx, cx0, 10, 9);
      circ(ctx, cx0 + 5, 14, 7);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawWhiteCeramicDaisyPot(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    rr(ctx, -14, 4, 28, 22, 5);
    ctx.fill();
    ctx.stroke();
    // Green leaves
    ctx.fillStyle = '#4CAE68';
    [-8, 0, 8].forEach(lx => {
      circ(ctx, lx, 2, 4);
      ctx.fill();
    });
    // 3 white daisies with yellow centers
    [[-8, -6], [0, -12], [8, -6]].forEach(([dx, dy]) => {
      ctx.fillStyle = '#FFFFFF';
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * PI2;
        circ(ctx, dx + Math.cos(a) * 5, dy + Math.sin(a) * 5, 2.6);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#FFD700';
      circ(ctx, dx, dy, 3.2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawGlassCupcakeStand(ctx, x, y, r, t) {
    r = r || 42;
    ctx.save();
    ctx.translate(x, y);
    // Pedestal stem & foot
    ctx.fillStyle = 'rgba(235, 248, 255, 0.65)';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ell(ctx, 0, 28, r * 0.7, 9);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-7, 26);
    ctx.lineTo(7, 26);
    ctx.lineTo(5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Glass plate
    ell(ctx, 0, 0, r, 12);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ell(ctx, 0, -2, r * 0.85, 8);
    ctx.stroke();
    // 3 miniature cupcakes (pink, yellow, mint)
    const cakeData = [
      { x: -r * 0.45, y: -8, swirl: '#FFA8C2', cherry: '#FF2A4D' },
      { x: 0, y: -12, swirl: '#FFF07A', cherry: '#FF3D3D' },
      { x: r * 0.45, y: -8, swirl: '#8AE2BF', cherry: '#E02040' },
    ];
    cakeData.forEach(cd => {
      ctx.save();
      ctx.translate(cd.x, cd.y);
      // Liner cup
      ctx.fillStyle = '#F4CCA1';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-6, 9);
      ctx.lineTo(6, 9);
      ctx.lineTo(8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Swirl frosting
      ctx.fillStyle = cd.swirl;
      circ(ctx, -4, -2, 6);
      circ(ctx, 4, -2, 6);
      circ(ctx, 0, -6, 7);
      ctx.fill();
      ctx.stroke();
      // Cherry
      ctx.fillStyle = cd.cherry;
      circ(ctx, 0, -12, 3.2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }

  function drawPastelMiniOven(ctx, x, y, w, h, t) {
    w = w || 116;
    h = h || 82;
    ctx.save();
    ctx.translate(x, y);
    softShadow(ctx, 0, h * 0.5 + 4, w * 0.9, 14, 0.2);
    // Mint oven body
    const og = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    og.addColorStop(0, '#A6E5CC');
    og.addColorStop(0.5, '#8ED6B8');
    og.addColorStop(1, '#77C4A5');
    ctx.fillStyle = og;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;
    rr(ctx, -w / 2, -h / 2, w, h, 14);
    ctx.fill();
    ctx.stroke();
    // Rubber feet
    ctx.fillStyle = '#443A34';
    rr(ctx, -w / 2 + 8, h / 2 - 2, 12, 6, 2);
    rr(ctx, w / 2 - 20, h / 2 - 2, 12, 6, 2);
    ctx.fill();
    // Warm glowing glass window
    const winW = w * 0.62, winH = h * 0.62;
    const winX = -w / 2 + 10, winY = -h / 2 + 12;
    ctx.save();
    rr(ctx, winX, winY, winW, winH, 8);
    ctx.clip();
    const wg = ctx.createRadialGradient(winX + winW * 0.5, winY + winH * 0.5, 6, winX + winW * 0.5, winY + winH * 0.5, winW * 0.7);
    wg.addColorStop(0, '#FFE8A3');
    wg.addColorStop(0.6, '#FFB347');
    wg.addColorStop(1, '#8C481A');
    ctx.fillStyle = wg;
    ctx.fillRect(winX - 5, winY - 5, winW + 10, winH + 10);
    // Miniature cake pan inside rising
    ctx.fillStyle = '#D4883B';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ell(ctx, winX + winW * 0.5, winY + winH * 0.65, winW * 0.32, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFDD80';
    ell(ctx, winX + winW * 0.5, winY + winH * 0.54, winW * 0.28, 7);
    ctx.fill();
    ctx.stroke();
    // Warm gentle steam
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(winX + winW * 0.5 - 6, winY + winH * 0.42);
    ctx.quadraticCurveTo(winX + winW * 0.5, winY + winH * 0.32, winX + winW * 0.5 - 4, winY + winH * 0.22);
    ctx.stroke();
    ctx.restore();
    // Glass border & reflection
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    rr(ctx, winX, winY, winW, winH, 8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(winX + 6, winY + winH - 8);
    ctx.lineTo(winX + winW - 14, winY + 8);
    ctx.stroke();
    // Chrome door handle
    ctx.fillStyle = '#C9D4DC';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    rr(ctx, winX + 8, winY + winH + 3, winW - 16, 5, 2.5);
    ctx.fill();
    ctx.stroke();
    // Control dials on right panel
    const dialX = w / 2 - 16;
    [-h * 0.22, h * 0.12].forEach((dy, idx) => {
      ctx.fillStyle = '#ECEEF0';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      circ(ctx, dialX, dy, 7.5);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      const da = -1.2 + idx * 1.6 + Math.sin(t * 1.2 + idx) * 0.2;
      ctx.beginPath();
      ctx.moveTo(dialX, dy);
      ctx.lineTo(dialX + Math.cos(da) * 5, dy + Math.sin(da) * 5);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawMiniKitchenScale(ctx, x, y, r, t) {
    r = r || 32;
    ctx.save();
    ctx.translate(x, y);
    // Base unit
    ctx.fillStyle = '#FFB8C6';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    rr(ctx, -r * 0.6, 0, r * 1.2, r * 0.9, 6);
    ctx.fill();
    ctx.stroke();
    // Round gauge dial
    ctx.fillStyle = '#FFFFFF';
    circ(ctx, 0, r * 0.45, r * 0.32);
    ctx.fill();
    ctx.stroke();
    // Needle
    ctx.strokeStyle = '#FF2A4D';
    ctx.lineWidth = 1.8;
    const na = -1.2 + Math.sin(t * 1.5) * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.45);
    ctx.lineTo(Math.cos(na) * r * 0.24, r * 0.45 + Math.sin(na) * r * 0.24);
    ctx.stroke();
    // Chrome weighing bowl on top
    ctx.fillStyle = '#D6E2E8';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, -2, r * 0.65, 0, PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ell(ctx, 0, -2, r * 0.65, 7);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /* ==========================================================================
   * 2. Cozy Sunlit Pinterest Patisserie Scene Backdrop
   * ========================================================================== */
  function drawKitchenBackdrop(ctx, W, H, t) {
    const wallH = H * 0.47;

    const wallGrad = ctx.createLinearGradient(0, 0, 0, wallH);
    wallGrad.addColorStop(0, '#FFFDF9');
    wallGrad.addColorStop(1, '#FAF3EB');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, W, wallH);

    // Warm storybook cream linen weave texture overlay
    ctx.save();
    ctx.strokeStyle = 'rgba(92, 61, 46, 0.015)';
    ctx.lineWidth = 1;
    for (let y = 0; y < wallH; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    for (let x = 0; x < W; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, wallH);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(232, 180, 166, 0.16)';
    for (let x = 18; x < W; x += 52) {
      ctx.fillRect(x, 0, 22, wallH);
    }

    // Arched French Window on Left
    const winX = W * 0.285, winY = 20, winW = 98, winH = 128;
    ctx.save();
    rr(ctx, winX, winY, winW, winH, 49);
    ctx.fillStyle = '#DDF0F5';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 248, 220, 0.55)';
    ctx.beginPath();
    ctx.moveTo(winX + 10, winY);
    ctx.lineTo(winX + winW, winY + winH);
    ctx.lineTo(winX, winY + winH);
    ctx.closePath();
    ctx.fill();
    // Drifting little clouds
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 2; i++) {
      const cxx = winX + ((t * 6 + i * 70) % (winW + 60)) - 30;
      const cyy = winY + 30 + i * 26;
      circ(ctx, cxx, cyy, 9); ctx.fill();
      circ(ctx, cxx + 10, cyy - 5, 11); ctx.fill();
      circ(ctx, cxx + 22, cyy, 8); ctx.fill();
    }
    ctx.fillStyle = '#9BC4AC';
    circ(ctx, winX + 26, winY + winH - 12, 34);
    ctx.fill();
    ctx.fillStyle = '#82B095';
    circ(ctx, winX + 74, winY + winH - 8, 36);
    ctx.fill();
    const sway = Math.sin(t * 1.5) * 4;
    ctx.fillStyle = 'rgba(255, 252, 246, 0.88)';
    ctx.beginPath();
    ctx.moveTo(winX, winY);
    ctx.quadraticCurveTo(winX + 34 + sway, winY + 55, winX + 8, winY + winH);
    ctx.lineTo(winX, winY + winH);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(winX + winW, winY);
    ctx.quadraticCurveTo(winX + winW - 34 + sway, winY + 55, winX + winW - 8, winY + winH);
    ctx.lineTo(winX + winW, winY + winH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#C99E7A';
    ctx.lineWidth = 4;
    rr(ctx, winX, winY, winW, winH, 49);
    ctx.stroke();

    // Warm sunbeam shaft from the window + drifting dust motes
    ctx.save();
    const beam = ctx.createLinearGradient(winX + winW, winY + 20, winX + winW + 220, winY + 260);
    beam.addColorStop(0, 'rgba(255, 236, 180, 0.22)');
    beam.addColorStop(1, 'rgba(255, 236, 180, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(winX + 10, winY + 8);
    ctx.lineTo(winX + winW, winY + 2);
    ctx.lineTo(winX + winW + 260, winY + 300);
    ctx.lineTo(winX + 120, winY + 320);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 9; i++) {
      const ph = (t * 0.05 + hash(i)) % 1;
      const mx = winX + 20 + hash(i + 10) * 200 + Math.sin(t * 0.7 + i) * 6;
      const my = winY + 10 + ph * 260;
      ctx.fillStyle = `rgba(255, 250, 230, ${(0.55 * bump(ph)).toFixed(3)})`;
      circ(ctx, mx, my, 1.4 + hash(i + 20) * 1.4);
      ctx.fill();
    }
    ctx.restore();

    // Pastel Bunting Pennant Garland
    const flagColors = ['#E8998D', '#F2C97D', '#9CC5B5', '#C9B1E0', '#F4B8C4', '#E8998D', '#F2C97D', '#9CC5B5'];
    ctx.strokeStyle = '#B8927A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const fx = W * 0.27 + i * 62;
      const fy = 6 + Math.sin(i * 0.7 + t * 2) * 2;
      if (i === 0) ctx.moveTo(fx, fy);
      else ctx.lineTo(fx, fy);
    }
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const fx = W * 0.27 + i * 62;
      ctx.fillStyle = flagColors[i % flagColors.length];
      ctx.beginPath();
      ctx.moveTo(fx + 6, 8);
      ctx.lineTo(fx + 56, 8);
      ctx.lineTo(fx + 31 + Math.sin(t * 2.2 + i) * 3, 28 + Math.sin(t * 2.2 + i) * 2);
      ctx.closePath();
      ctx.fill();
    }

    // Right Patisserie Shelf & Copper Pans
    const shX = W - 255, shY = 104, shW = 216;
    ctx.strokeStyle = '#B8927A';
    ctx.lineWidth = 2.5;
    [shX + 42, shX + 106, shX + 170].forEach((px, idx) => {
      const swing = Math.sin(t * 1.3 + idx) * 0.05;
      ctx.save();
      ctx.translate(px, shY + 10);
      ctx.rotate(swing);
      ctx.strokeStyle = '#B8927A';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 22);
      ctx.stroke();
      ctx.fillStyle = idx === 1 ? '#9CC5B5' : '#D9825B';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      circ(ctx, 0, 34, 15);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      circ(ctx, -4, 30, 4);
      ctx.fill();
      ctx.restore();
    });

    ctx.fillStyle = '#D49B6A';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    rr(ctx, shX, shY, shW, 12, 6);
    ctx.fill();
    ctx.stroke();

    drawIcon(ctx, 'sauce', shX + 36, shY - 18, 17, t);
    drawIngredient(ctx, 'strawberry', shX + 86, shY - 16, 16, { sliced: false, shadow: false });
    drawIcon(ctx, 'cupcake', shX + 136, shY - 18, 17, t);
    ctx.fillStyle = '#D97F6C';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    rr(ctx, shX + 172, shY - 22, 24, 22, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7BB08A';
    circ(ctx, shX + 178, shY - 28 + Math.sin(t * 1.1) * 0.6, 9);
    ctx.fill();
    circ(ctx, shX + 190, shY - 26 + Math.sin(t * 1.1 + 1) * 0.6, 8);
    ctx.fill();

    // Warm Cream Marble & Oak Countertop
    const counterY = H * 0.45;
    const counterGrad = ctx.createLinearGradient(0, counterY, 0, H);
    counterGrad.addColorStop(0, '#FFFDF9');
    counterGrad.addColorStop(0.1, '#FAF3EB');
    counterGrad.addColorStop(1, '#EFE0CC');
    ctx.fillStyle = counterGrad;
    ctx.fillRect(0, counterY, W, H - counterY);
    // Faint marble veins
    ctx.strokeStyle = 'rgba(217, 190, 160, 0.28)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const vx = W * (0.1 + i * 0.26), vy = counterY + 30 + i * 40;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.bezierCurveTo(vx + 90, vy - 24, vx + 160, vy + 36, vx + 260, vy + 8);
      ctx.stroke();
    }

    ctx.fillStyle = '#D9A773';
    ctx.fillRect(0, counterY - 4, W, 9);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, counterY - 4);
    ctx.lineTo(W, counterY - 4);
    ctx.moveTo(0, counterY + 5);
    ctx.lineTo(W, counterY + 5);
    ctx.stroke();

    // Lower Patisserie Cabinet Drawers below the counter edge (yt_maxresdefault.jpg)
    const drawerH = 46;
    ctx.fillStyle = '#FAF7F2';
    ctx.fillRect(0, counterY + 5, W, drawerH);
    ctx.strokeStyle = 'rgba(180, 160, 140, 0.4)';
    ctx.lineWidth = 2;
    const numDrawers = 6;
    const dw = W / numDrawers;
    for (let i = 0; i < numDrawers; i++) {
      const dx = i * dw;
      ctx.strokeRect(dx + 6, counterY + 10, dw - 12, drawerH - 12);
      // Matte black cup drawer handle
      ctx.fillStyle = '#2A2421';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      rr(ctx, dx + dw / 2 - 14, counterY + 22, 28, 8, 4);
      ctx.fill();
      ctx.stroke();
    }

    // Studio Counter Props (flanking the critter who stands at W * 0.46)
    // Left counter props (yt_hq2.jpg & yt_maxresdefault.jpg):
    drawWhiteCeramicDaisyPot(ctx, W * 0.06, counterY - 14);
    drawGlassCupcakeStand(ctx, W * 0.16, counterY - 24, 38, t);
    drawYellowSunflowerPot(ctx, W * 0.27, counterY - 18, 0.85);

    // Right counter props:
    drawPastelMiniOven(ctx, W * 0.68, counterY - 36, 114, 78, t);
    drawMiniKitchenScale(ctx, W * 0.82, counterY - 20, 26, t);
    drawRainbowArchFigurine(ctx, W * 0.92, counterY - 18, 0.85);
  }

  /* ==========================================================================
   * 3. Complete 24-Item Botanical Ingredient & Juicy Cross-Section Renderer
   *    opts: { sliced, cooked, cracked, showShell, crackSep, rot, scaleX, scaleY,
   *            shadow, alpha, gloss }
   * ========================================================================== */
  function searMarks(ctx, r, cooked, w) {
    if (cooked < 0.45) return;
    const a = clamp01((cooked - 0.45) / 0.45);
    ctx.save();
    ctx.strokeStyle = `rgba(74, 40, 24, ${(0.55 * a).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.5, r * (w || 0.09));
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.3 - r * 0.22, -r * 0.3);
      ctx.lineTo(i * r * 0.3 + r * 0.22, r * 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function gloss(ctx, x, y, rx, ry, rot, a) {
    ctx.fillStyle = `rgba(255,255,255,${a === undefined ? 0.45 : a})`;
    ell(ctx, x, y, rx, ry, rot || -0.5);
    ctx.fill();
  }

  function drawIngredient(ctx, id, x, y, r, opts) {
    opts = opts || {};
    const item = KitchenData.getIngredient(id);
    const sliced = !!opts.sliced;
    const cooked = opts.cooked || 0;
    const burnt = cooked > 1.08;

    ctx.save();
    ctx.translate(x, y);
    if (opts.rot) ctx.rotate(opts.rot);
    if (opts.scaleX || opts.scaleY) ctx.scale(opts.scaleX || 1, opts.scaleY || 1);
    if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;

    if (opts.shadow !== false) {
      ctx.fillStyle = 'rgba(92, 61, 46, 0.14)';
      ell(ctx, 2, r * 0.24, r * 0.86, r * 0.6);
      ctx.fill();
    }

    let baseCol = item.color;
    if (cooked > 0 && item.cookedColor) {
      baseCol = lerpColor(item.color, item.cookedColor, Math.min(1, cooked / 0.75));
    }
    if (burnt) {
      baseCol = lerpColor(baseCol, '#3B2820', Math.min(1, (cooked - 1.0) * 1.8));
    }

    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.8, r * 0.085);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (item.sliceStyle) {
      case 'strawberry': {
        if (!sliced) {
          ctx.fillStyle = baseCol;
          ctx.beginPath();
          ctx.moveTo(0, r * 0.85);
          ctx.bezierCurveTo(-r * 0.95, r * 0.25, -r * 0.85, -r * 0.72, 0, -r * 0.52);
          ctx.bezierCurveTo(r * 0.85, -r * 0.72, r * 0.95, r * 0.25, 0, r * 0.85);
          ctx.fill();
          ctx.stroke();
          gloss(ctx, -r * 0.3, -r * 0.12, r * 0.13, r * 0.3, -0.2, 0.4);
          ctx.fillStyle = '#FFE699';
          [[-0.32, -0.1], [0.32, -0.1], [0, 0.08], [-0.22, 0.34], [0.22, 0.34], [0, 0.54], [-0.1, -0.3], [0.12, -0.3]].forEach(([sx, sy]) => {
            ell(ctx, sx * r, sy * r, r * 0.05, r * 0.08);
            ctx.fill();
          });
          ctx.fillStyle = '#68B878';
          for (let i = -2; i <= 2; i++) {
            ell(ctx, i * r * 0.2, -r * 0.6, r * 0.22, r * 0.1, i * 0.3);
            ctx.fill();
            ctx.stroke();
          }
          ctx.strokeStyle = '#4E8C58';
          ctx.lineWidth = Math.max(1.5, r * 0.07);
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.6);
          ctx.quadraticCurveTo(r * 0.08, -r * 0.82, r * 0.16, -r * 0.92);
          ctx.stroke();
        } else {
          // Heart-shaped juicy cross-section with white veins & seed rim
          ctx.fillStyle = baseCol;
          heart(ctx, 0, r * 0.1, r * 0.78);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFC9D6';
          heart(ctx, 0, r * 0.1, r * 0.56);
          ctx.fill();
          ctx.fillStyle = '#FFF4F7';
          heart(ctx, 0, r * 0.1, r * 0.3);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.75)';
          ctx.lineWidth = Math.max(1, r * 0.05);
          for (let k = 0; k < 7; k++) {
            const a = -PI / 2 + (k - 3) * 0.42;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * r * 0.2, r * 0.05 + Math.sin(a) * r * 0.2);
            ctx.lineTo(Math.cos(a) * r * 0.56, r * 0.05 + Math.sin(a) * r * 0.56);
            ctx.stroke();
          }
          ctx.fillStyle = '#FFE699';
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * PI2 + 0.3;
            circ(ctx, Math.cos(a) * r * 0.66, r * 0.06 + Math.sin(a) * r * 0.62, r * 0.04);
            ctx.fill();
          }
          gloss(ctx, -r * 0.3, -r * 0.2, r * 0.12, r * 0.07, -0.4, 0.5);
        }
        break;
      }

      case 'kiwi': {
        if (sliced) {
          ctx.fillStyle = '#A6784E';
          circ(ctx, 0, 0, r * 0.82);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#88C968';
          circ(ctx, 0, 0, r * 0.72);
          ctx.fill();
          ctx.strokeStyle = 'rgba(230, 247, 212, 0.7)';
          ctx.lineWidth = Math.max(1, r * 0.05);
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * PI2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
            ctx.lineTo(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68);
            ctx.stroke();
          }
          ctx.fillStyle = '#E6F7D4';
          blob(ctx, 0, 0, r * 0.3, r * 0.26, 1.2, 0.12);
          ctx.fill();
          ctx.fillStyle = '#2E2A26';
          for (let k = 0; k < 12; k++) {
            const a = (k * PI2) / 12;
            ell(ctx, Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.055, r * 0.03, a);
            ctx.fill();
          }
          gloss(ctx, -r * 0.3, -r * 0.3, r * 0.14, r * 0.08, -0.6, 0.35);
        } else {
          ctx.fillStyle = '#A6784E';
          ell(ctx, 0, 0, r * 0.74, r * 0.84, 0.2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(120, 82, 50, 0.55)';
          for (let k = 0; k < 16; k++) {
            circ(ctx, (hash(k) - 0.5) * r * 1.2, (hash(k + 7) - 0.5) * r * 1.4, r * 0.03);
            ctx.fill();
          }
          gloss(ctx, -r * 0.26, -r * 0.3, r * 0.14, r * 0.22, -0.3, 0.22);
        }
        break;
      }

      case 'banana': {
        if (!sliced) {
          ctx.fillStyle = '#FFE36E';
          ctx.beginPath();
          ctx.arc(0, -r * 0.18, r * 0.78, 0.28, 2.65);
          ctx.quadraticCurveTo(0, r * 0.18, Math.cos(0.28) * r * 0.78, -r * 0.18 + Math.sin(0.28) * r * 0.78);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = 'rgba(217, 178, 76, 0.7)';
          ctx.lineWidth = Math.max(1.2, r * 0.05);
          ctx.beginPath();
          ctx.arc(0, -r * 0.18, r * 0.6, 0.5, 2.5);
          ctx.stroke();
          ctx.fillStyle = '#8C6A3C';
          circ(ctx, Math.cos(0.28) * r * 0.78, -r * 0.18 + Math.sin(0.28) * r * 0.78, r * 0.09);
          ctx.fill();
          circ(ctx, Math.cos(2.65) * r * 0.78, -r * 0.18 + Math.sin(2.65) * r * 0.78, r * 0.09);
          ctx.fill();
        } else {
          ctx.fillStyle = lerpColor('#FFF9DC', baseCol, cooked > 0 ? 0.6 : 0);
          circ(ctx, 0, 0, r * 0.72);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#E8CF8A';
          ctx.lineWidth = Math.max(1.2, r * 0.05);
          circ(ctx, 0, 0, r * 0.52);
          ctx.stroke();
          ctx.fillStyle = '#F2E2A8';
          for (let k = 0; k < 3; k++) {
            const a = (k * PI2) / 3 - PI / 2;
            ell(ctx, Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16, r * 0.17, r * 0.11, a);
            ctx.fill();
          }
          ctx.fillStyle = '#6E4A2A';
          for (let k = 0; k < 3; k++) {
            const a = (k * PI2) / 3 + PI / 6;
            circ(ctx, Math.cos(a) * r * 0.1, Math.sin(a) * r * 0.1, r * 0.03);
            ctx.fill();
          }
          searMarks(ctx, r * 0.9, cooked, 0.07);
        }
        break;
      }

      case 'berry': {
        if (sliced) {
          ctx.fillStyle = '#5C6BC0';
          circ(ctx, 0, 0, r * 0.74);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#C9D4F0';
          circ(ctx, 0, 0, r * 0.56);
          ctx.fill();
          ctx.fillStyle = '#8FA2E0';
          star(ctx, 0, 0, r * 0.22, r * 0.1, 5);
          ctx.fill();
          gloss(ctx, -r * 0.24, -r * 0.24, r * 0.12, r * 0.07, -0.5, 0.5);
        } else {
          ctx.fillStyle = '#5C6BC0';
          circ(ctx, 0, r * 0.04, r * 0.74);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#3949AB';
          star(ctx, 0, -r * 0.28, r * 0.28, r * 0.12, 5);
          ctx.fill();
          ctx.stroke();
          gloss(ctx, -r * 0.26, -r * 0.05, r * 0.14, r * 0.24, -0.3, 0.5);
        }
        break;
      }

      case 'peach': {
        if (sliced) {
          ctx.fillStyle = '#F7A1B0';
          circ(ctx, 0, 0, r * 0.78);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFD9A3';
          circ(ctx, 0, 0, r * 0.64);
          ctx.fill();
          ctx.fillStyle = '#FFE8C4';
          circ(ctx, 0, 0, r * 0.4);
          ctx.fill();
          ctx.fillStyle = '#B5603A';
          blob(ctx, 0, 0, r * 0.2, r * 0.24, 4.1, 0.18, 12);
          ctx.fill();
          ctx.strokeStyle = '#8C4423';
          ctx.lineWidth = Math.max(1, r * 0.04);
          ctx.beginPath();
          ctx.moveTo(-r * 0.08, -r * 0.12);
          ctx.quadraticCurveTo(r * 0.06, 0, -r * 0.05, r * 0.14);
          ctx.stroke();
          gloss(ctx, -r * 0.28, -r * 0.3, r * 0.12, r * 0.07, -0.5, 0.5);
        } else {
          ctx.fillStyle = '#F7A1B0';
          circ(ctx, 0, r * 0.06, r * 0.76);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(255, 215, 130, 0.45)';
          circ(ctx, r * 0.22, r * 0.22, r * 0.4);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.68);
          ctx.quadraticCurveTo(r * 0.22, 0, 0, r * 0.78);
          ctx.stroke();
          ctx.fillStyle = '#78C47C';
          ell(ctx, r * 0.26, -r * 0.66, r * 0.28, r * 0.13, 0.35);
          ctx.fill();
          ctx.stroke();
          gloss(ctx, -r * 0.28, -r * 0.12, r * 0.15, r * 0.15, 0, 0.42);
        }
        break;
      }

      case 'citrus':
      case 'tomato': {
        const isTom = item.sliceStyle === 'tomato';
        ctx.fillStyle = baseCol;
        if (!sliced && !isTom) {
          ell(ctx, 0, r * 0.04, r * 0.84, r * 0.64, -0.2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(217, 190, 0, 0.35)';
          for (let k = 0; k < 10; k++) {
            circ(ctx, (hash(k + 3) - 0.5) * r * 1.3, (hash(k + 9) - 0.5) * r * 0.9, r * 0.03);
            ctx.fill();
          }
          ctx.fillStyle = '#78C47C';
          ell(ctx, r * 0.22, -r * 0.58, r * 0.26, r * 0.12, 0.4);
          ctx.fill();
          ctx.stroke();
          gloss(ctx, -r * 0.34, -r * 0.14, r * 0.14, r * 0.1, -0.3, 0.42);
        } else {
          circ(ctx, 0, 0, r * 0.8);
          ctx.fill();
          ctx.stroke();
          if (sliced) {
            ctx.fillStyle = isTom ? '#FF9A9A' : '#FFFBE0';
            circ(ctx, 0, 0, r * 0.68);
            ctx.fill();
            ctx.fillStyle = item.inner;
            const n = isTom ? 4 : 8;
            for (let k = 0; k < n; k++) {
              const a1 = (k * PI2) / n + 0.1;
              const a2 = ((k + 1) * PI2) / n - 0.1;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.arc(0, 0, r * 0.6, a1, a2);
              ctx.closePath();
              ctx.fill();
            }
            if (isTom) {
              ctx.fillStyle = '#FFE0A8';
              for (let k = 0; k < 4; k++) {
                const a = (k * PI2) / 4 + PI / 4;
                for (let j = 0; j < 3; j++) {
                  const rad = r * (0.22 + j * 0.14);
                  ell(ctx, Math.cos(a + (j - 1) * 0.18) * rad, Math.sin(a + (j - 1) * 0.18) * rad, r * 0.05, r * 0.03, a);
                  ctx.fill();
                }
              }
              ctx.fillStyle = '#FFB3B3';
              circ(ctx, 0, 0, r * 0.16);
              ctx.fill();
            } else {
              ctx.fillStyle = 'rgba(255,255,255,0.6)';
              for (let k = 0; k < 8; k++) {
                const a = (k * PI2) / 8 + PI / 8;
                circ(ctx, Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.035);
                ctx.fill();
              }
              ctx.fillStyle = '#FFFBE0';
              circ(ctx, 0, 0, r * 0.08);
              ctx.fill();
            }
            gloss(ctx, -r * 0.3, -r * 0.32, r * 0.12, r * 0.07, -0.6, 0.45);
          } else if (isTom) {
            gloss(ctx, -r * 0.3, -r * 0.22, r * 0.16, r * 0.1, -0.4, 0.38);
            ctx.fillStyle = '#68B878';
            star(ctx, 0, -r * 0.52, r * 0.32, r * 0.12, 5);
            ctx.fill();
            ctx.stroke();
          }
        }
        break;
      }

      case 'egg': {
        if (!sliced && !opts.cracked && cooked === 0) {
          ctx.fillStyle = '#F7E6D0';
          ell(ctx, 0, 0, r * 0.68, r * 0.86);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(214, 170, 130, 0.35)';
          for (let k = 0; k < 6; k++) {
            circ(ctx, (hash(k + 1) - 0.5) * r * 0.9, (hash(k + 5) - 0.5) * r * 1.2, r * 0.035);
            ctx.fill();
          }
          gloss(ctx, -r * 0.2, -r * 0.3, r * 0.14, r * 0.26, -0.2, 0.6);
          if (opts.crackLine) {
            ctx.strokeStyle = OUTLINE;
            ctx.lineWidth = Math.max(1.5, r * 0.06);
            ctx.beginPath();
            ctx.moveTo(-r * 0.6, 0);
            for (let k = 1; k <= 6; k++) {
              ctx.lineTo(-r * 0.6 + k * r * 0.2, (k % 2 ? -1 : 1) * r * 0.1 * opts.crackLine);
            }
            ctx.stroke();
          }
        } else {
          // Organic wobbly sunny-side-up white + glossy yolk
          ctx.fillStyle = burnt ? '#4A372D' : '#FFFDF8';
          blob(ctx, 0, 0, r * 0.86, r * 0.74, 2.7, 0.16, 16);
          ctx.fill();
          ctx.stroke();
          if (cooked > 0.25 && !burnt) {
            ctx.fillStyle = `rgba(222, 170, 90, ${clamp01((cooked - 0.25) * 1.2).toFixed(3)})`;
            ctx.lineWidth = 1;
            for (let k = 0; k < 7; k++) {
              const a = (k / 7) * PI2 + 0.4;
              circ(ctx, Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.56, r * 0.05 + hash(k) * r * 0.03);
              ctx.fill();
            }
          }
          ctx.fillStyle = burnt ? '#6E4219' : '#F59E2D';
          circ(ctx, r * 0.04, -r * 0.04, r * 0.36);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = burnt ? '#8C5A2A' : '#FFB74D';
          circ(ctx, r * 0.0, -r * 0.08, r * 0.24);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ell(ctx, -r * 0.1, -r * 0.17, r * 0.1, r * 0.06, -0.5);
          ctx.fill();
          if (!cooked && opts.showShell) {
            const sep = opts.crackSep === undefined ? 1 : opts.crackSep;
            for (const s of [-1, 1]) {
              ctx.save();
              ctx.translate(s * r * (0.3 + 0.32 * sep), -r * 0.62 - sep * r * 0.08);
              ctx.rotate(s * 0.42 * sep);
              ctx.fillStyle = '#F7E6D0';
              ctx.beginPath();
              ctx.arc(0, 0, r * 0.38, PI, 0);
              for (let k = 0; k < 5; k++) {
                ctx.lineTo(r * 0.38 - k * r * 0.19, k % 2 ? -r * 0.04 : r * 0.12);
              }
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
              ctx.restore();
            }
          }
        }
        break;
      }

      case 'meat': {
        ctx.fillStyle = baseCol;
        if (sliced) {
          ell(ctx, 0, 0, r * 0.8, r * 0.56, 0.2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = cooked < 0.35 ? '#FFA7B0' : '#D98A7A';
          ell(ctx, 0, 0, r * 0.5, r * 0.3, 0.2);
          ctx.fill();
        } else {
          blob(ctx, 0, 0, r * 0.9, r * 0.68, 0.8, 0.07, 14);
          ctx.fill();
          ctx.stroke();
        }
        if (cooked < 0.35) {
          ctx.strokeStyle = '#FFE8E8';
          ctx.lineWidth = Math.max(1.8, r * 0.07);
          ctx.beginPath();
          ctx.moveTo(-r * 0.48, -r * 0.15);
          ctx.quadraticCurveTo(0, r * 0.1, r * 0.48, -r * 0.18);
          ctx.moveTo(-r * 0.3, r * 0.22);
          ctx.quadraticCurveTo(r * 0.05, r * 0.05, r * 0.36, r * 0.26);
          ctx.stroke();
        } else {
          searMarks(ctx, r, Math.max(0.9, cooked), 0.09);
        }
        gloss(ctx, -r * 0.34, -r * 0.26, r * 0.16, r * 0.08, -0.3, 0.28);
        break;
      }

      case 'cheese': {
        ctx.fillStyle = baseCol;
        if (sliced) {
          rr(ctx, -r * 0.62, -r * 0.58, r * 1.24, r * 1.16, r * (cooked > 0.3 ? 0.42 : 0.16));
        } else {
          ctx.beginPath();
          ctx.moveTo(-r * 0.82, r * 0.5);
          ctx.lineTo(r * 0.82, r * 0.5);
          ctx.lineTo(r * 0.82, -r * 0.1);
          ctx.lineTo(-r * 0.1, -r * 0.72);
          ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E09824';
        [[-0.3, -0.04, 0.14], [0.3, -0.18, 0.1], [0.05, 0.26, 0.15], [0.45, 0.22, 0.08]].forEach(([hx, hy, hr]) => {
          circ(ctx, hx * r, hy * r, hr * r);
          ctx.fill();
        });
        if (cooked > 0.4) {
          ctx.fillStyle = `rgba(255, 236, 170, ${clamp01((cooked - 0.4) * 1.5).toFixed(3)})`;
          for (let k = 0; k < 3; k++) {
            ell(ctx, (k - 1) * r * 0.45, r * 0.54, r * 0.12, r * 0.16 + hash(k) * r * 0.1);
            ctx.fill();
          }
        }
        break;
      }

      case 'bacon': {
        const crisp = clamp01(cooked);
        ctx.fillStyle = baseCol;
        ctx.beginPath();
        const wv = 0.1 + crisp * 0.16;
        ctx.moveTo(-r * 0.85, -r * 0.36);
        ctx.bezierCurveTo(-r * 0.4, -r * (0.36 + wv), r * 0.1, -r * (0.36 - wv), r * 0.85, -r * 0.36);
        ctx.lineTo(r * 0.85, r * 0.36);
        ctx.bezierCurveTo(r * 0.1, r * (0.36 + wv), -r * 0.4, r * (0.36 - wv), -r * 0.85, r * 0.36);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = crisp > 0.5 ? '#F2C4A0' : '#FFDCE0';
        ctx.lineWidth = Math.max(2, r * 0.11);
        for (const s of [-0.14, 0.14]) {
          ctx.beginPath();
          ctx.moveTo(-r * 0.65, s * r);
          ctx.bezierCurveTo(-r * 0.2, (s - 0.2) * r, r * 0.2, (s + 0.2) * r, r * 0.65, s * r);
          ctx.stroke();
        }
        break;
      }

      case 'shrimp': {
        ctx.fillStyle = baseCol;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.64, -0.4, PI * 1.25);
        ctx.arc(0, 0, r * 0.24, PI * 1.25, -0.4, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = Math.max(1.2, r * 0.06);
        for (let k = 0; k < 4; k++) {
          const a = 0.1 + k * 0.6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.28, Math.sin(a) * r * 0.28);
          ctx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
          ctx.stroke();
        }
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.6, r * 0.07);
        ctx.save();
        ctx.translate(Math.cos(PI * 1.25) * r * 0.5, Math.sin(PI * 1.25) * r * 0.5);
        ctx.rotate(PI * 1.25);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * 0.32, -r * 0.22);
        ctx.lineTo(r * 0.2, 0);
        ctx.lineTo(r * 0.32, r * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'sausage': {
        ctx.fillStyle = baseCol;
        rr(ctx, -r * 0.78, -r * 0.34, r * 1.56, r * 0.68, r * 0.34);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.4, r * 0.06);
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * r * 0.78, -r * 0.1);
          ctx.lineTo(s * r * 0.92, -r * 0.2);
          ctx.moveTo(s * r * 0.78, r * 0.1);
          ctx.lineTo(s * r * 0.92, r * 0.2);
          ctx.stroke();
        }
        if (cooked > 0.4) {
          ctx.strokeStyle = `rgba(74, 40, 24, ${clamp01((cooked - 0.4) * 1.4).toFixed(3)})`;
          ctx.lineWidth = Math.max(1.5, r * 0.07);
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.moveTo(k * r * 0.34 - r * 0.1, -r * 0.3);
            ctx.lineTo(k * r * 0.34 + r * 0.1, r * 0.3);
            ctx.stroke();
          }
        }
        gloss(ctx, -r * 0.3, -r * 0.14, r * 0.3, r * 0.07, 0, 0.3);
        break;
      }

      case 'dough':
      case 'bun':
      case 'pizza': {
        const isPizza = item.sliceStyle === 'pizza';
        ctx.fillStyle = baseCol;
        if (isPizza) {
          circ(ctx, 0, 0, r * 0.88);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = lerpColor(baseCol, '#FFFFFF', 0.25);
          circ(ctx, 0, 0, r * 0.7);
          ctx.fill();
          ctx.fillStyle = '#E35242';
          circ(ctx, 0, 0, r * 0.64);
          ctx.fill();
          ctx.fillStyle = cooked > 0.4 ? '#FFD86B' : '#FFEA8C';
          blob(ctx, 0, 0, r * 0.56, r * 0.54, 3.3, 0.1, 12);
          ctx.fill();
          ctx.fillStyle = '#68B878';
          [[-0.22, -0.12], [0.26, 0.2], [0.1, -0.3]].forEach(([lx, ly]) => {
            ell(ctx, lx * r, ly * r, r * 0.1, r * 0.06, lx * 2);
            ctx.fill();
          });
        } else if (item.sliceStyle === 'bun') {
          ctx.beginPath();
          ctx.arc(0, r * 0.12, r * 0.84, PI, 0);
          ctx.quadraticCurveTo(r * 0.84, r * 0.5, 0, r * 0.5);
          ctx.quadraticCurveTo(-r * 0.84, r * 0.5, -r * 0.84, r * 0.12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFF5CC';
          [[-0.34, -0.22], [-0.05, -0.42], [0.3, -0.2], [-0.2, 0.0], [0.14, 0.02], [0.44, 0.08]].forEach(([sx, sy]) => {
            ell(ctx, sx * r, sy * r, r * 0.09, r * 0.05, sx);
            ctx.fill();
          });
          gloss(ctx, -r * 0.3, -r * 0.34, r * 0.22, r * 0.09, -0.3, 0.3);
        } else if (opts.cookieShape) {
          drawStampedCookie(ctx, 0, 0, r * 0.9, opts.cookieShape, cooked, baseCol);
        } else if (sliced) {
          // Trio of stamped Star, Heart, and Bear patisserie cookies (Slice 6)
          const shapes = ['star', 'heart', 'bear'];
          const offsets = [[-r * 0.42, r * 0.12, -0.18], [0, -r * 0.22, 0.08], [r * 0.42, r * 0.14, 0.2]];
          for (let k = 0; k < 3; k++) {
            ctx.save();
            ctx.translate(offsets[k][0], offsets[k][1]);
            ctx.rotate(offsets[k][2]);
            drawStampedCookie(ctx, 0, 0, r * 0.56, shapes[k], cooked, baseCol);
            ctx.restore();
          }
        } else {
          blob(ctx, 0, 0, r * 0.8, r * 0.74, 1.5, 0.06, 14);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          for (let k = 0; k < 7; k++) {
            circ(ctx, (hash(k + 2) - 0.5) * r * 1.1, (hash(k + 6) - 0.5) * r * 1.0, r * 0.05);
            ctx.fill();
          }
          ctx.strokeStyle = 'rgba(217, 178, 111, 0.8)';
          ctx.lineWidth = Math.max(1.5, r * 0.06);
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.42, 0.2, PI * 1.2);
          ctx.stroke();
          if (cooked > 0.4) {
            ctx.fillStyle = `rgba(190, 120, 50, ${clamp01((cooked - 0.4) * 1.2).toFixed(3)})`;
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * PI2 + 0.2;
              circ(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.46, r * 0.06);
              ctx.fill();
            }
          }
        }
        break;
      }

      case 'leaf': {
        ctx.fillStyle = baseCol;
        for (let k = 0; k < 7; k++) {
          const a = (k * PI2) / 7;
          circ(ctx, Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.3, r * 0.4);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = baseCol;
        ell(ctx, 0, 0, r * 0.56, r * 0.46);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = Math.max(1.4, r * 0.06);
        ctx.beginPath();
        ctx.moveTo(0, r * 0.6);
        ctx.quadraticCurveTo(-r * 0.06, 0, 0, -r * 0.5);
        for (let k = -2; k <= 2; k++) {
          if (!k) continue;
          ctx.moveTo(0, k * r * 0.14);
          ctx.lineTo(k < 0 ? -r * 0.36 : r * 0.36, k * r * 0.14 - r * 0.22);
        }
        ctx.stroke();
        break;
      }

      case 'chili': {
        if (sliced) {
          ctx.fillStyle = baseCol;
          circ(ctx, 0, 0, r * 0.6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFB07A';
          circ(ctx, 0, 0, r * 0.4);
          ctx.fill();
          ctx.fillStyle = '#FFF3CC';
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * PI2;
            circ(ctx, Math.cos(a) * r * 0.22, Math.sin(a) * r * 0.22, r * 0.06);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = baseCol;
          ctx.beginPath();
          ctx.moveTo(-r * 0.65, -r * 0.35);
          ctx.quadraticCurveTo(0, -r * 0.55, r * 0.78, r * 0.45);
          ctx.quadraticCurveTo(-r * 0.1, r * 0.55, -r * 0.65, -r * 0.35);
          ctx.fill();
          ctx.stroke();
          gloss(ctx, -r * 0.2, -r * 0.2, r * 0.3, r * 0.07, 0.4, 0.4);
          ctx.strokeStyle = '#52A858';
          ctx.lineWidth = Math.max(2.5, r * 0.12);
          ctx.beginPath();
          ctx.moveTo(-r * 0.62, -r * 0.32);
          ctx.lineTo(-r * 0.85, -r * 0.58);
          ctx.stroke();
        }
        break;
      }

      case 'cocoa': {
        // Roasted Cocoa Beans & Pod (yt_hq1.jpg)
        ctx.fillStyle = '#4A2511';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.08);
        if (sliced) {
          // Cocoa beans cracked open into nibs
          for (const [bx, by, rot] of [[-r * 0.3, -r * 0.05, -0.3], [r * 0.28, r * 0.05, 0.3]]) {
            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(rot);
            ell(ctx, 0, 0, r * 0.42, r * 0.28);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#784323';
            ell(ctx, 0, 0, r * 0.32, r * 0.2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ell(ctx, -r * 0.1, -r * 0.08, r * 0.12, r * 0.06, -0.4);
            ctx.fill();
            ctx.restore();
          }
        } else {
          // Whole roasted cocoa pod/bean
          ctx.beginPath();
          ctx.moveTo(-r * 0.65, 0);
          ctx.quadraticCurveTo(-r * 0.4, -r * 0.45, 0, -r * 0.48);
          ctx.quadraticCurveTo(r * 0.48, -r * 0.42, r * 0.72, 0);
          ctx.quadraticCurveTo(r * 0.48, r * 0.42, 0, r * 0.48);
          ctx.quadraticCurveTo(-r * 0.4, r * 0.45, -r * 0.65, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Longitudinal husk ridges
          ctx.strokeStyle = '#2A1308';
          ctx.lineWidth = Math.max(1.2, r * 0.04);
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.moveTo(-r * 0.58, 0);
            ctx.quadraticCurveTo(0, k * r * 0.32, r * 0.65, 0);
            ctx.stroke();
          }
          gloss(ctx, -r * 0.2, -r * 0.24, r * 0.25, r * 0.1, -0.2, 0.4);
        }
        break;
      }

      case 'candy_balls': {
        drawSpecularCandyBall(ctx, 0, 0, r * 0.5, '#FF2A2A');
        break;
      }

      case 'rainbow_arch': {
        drawRainbowArchFigurine(ctx, 0, r * 0.1, r * 0.024);
        break;
      }

      case 'flower_pot': {
        drawYellowSunflowerPot(ctx, 0, r * 0.05, r * 0.025);
        break;
      }

      case 'choco': {
        ctx.fillStyle = baseCol;
        if (cooked > 0.15) {
          // Melts into silky dark chocolate mirror glaze pool (zuCz-X1TrMM)
          const meltP = Math.min(1, (cooked - 0.15) / 0.7);
          const pr = r * (0.65 + meltP * 0.45);
          ctx.fillStyle = '#261108';
          blob(ctx, 0, 0, pr * 1.1, pr * 0.7, 1.2, 0.15, 12);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#3A1B0E';
          ell(ctx, -pr * 0.1, -pr * 0.05, pr * 0.75, pr * 0.45, -0.1);
          ctx.fill();
          gloss(ctx, -pr * 0.35, -pr * 0.22, pr * 0.3, pr * 0.1, -0.2, 0.45);
          if (meltP < 0.85) {
            const rem = (1 - meltP);
            ctx.fillStyle = '#1A0B05';
            rr(ctx, -r * 0.25 * rem, -r * 0.2 * rem, r * 0.5 * rem, r * 0.4 * rem, 3);
            ctx.fill();
          }
          break;
        }
        if (sliced) {
          rr(ctx, -r * 0.5, -r * 0.46, r * 1.0, r * 0.92, r * 0.14);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#9C5B3B';
          rr(ctx, -r * 0.32, -r * 0.28, r * 0.64, r * 0.56, r * 0.08);
          ctx.fill();
        } else {
          rr(ctx, -r * 0.72, -r * 0.58, r * 1.44, r * 1.16, r * 0.16);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#9C5B3B';
          for (const sx of [-0.56, -0.08, 0.4]) {
            for (const sy of [-0.42, 0.06]) {
              rr(ctx, sx * r, sy * r, r * 0.34, r * 0.3, r * 0.05);
              ctx.fill();
            }
          }
        }
        gloss(ctx, -r * 0.4, -r * 0.42, r * 0.16, r * 0.06, 0, 0.35);
        break;
      }

      case 'boba': {
        for (const [bx, by] of [[-0.28, -0.18], [0.26, -0.2], [-0.05, 0.24], [0.3, 0.22], [-0.32, 0.2]]) {
          ctx.fillStyle = '#4A2A1C';
          circ(ctx, bx * r, by * r, r * 0.26);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          circ(ctx, (bx - 0.08) * r, (by - 0.08) * r, r * 0.08);
          ctx.fill();
        }
        break;
      }

      case 'scoop': {
        ctx.fillStyle = baseCol;
        blob(ctx, 0, -r * 0.06, r * 0.68, r * 0.64, 2.2, 0.08, 14);
        ctx.fill();
        ctx.stroke();
        for (const sx of [-0.42, 0, 0.42]) {
          ell(ctx, sx * r, r * 0.4, r * 0.22, r * 0.26);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = baseCol;
        ell(ctx, 0, r * 0.28, r * 0.6, r * 0.14);
        ctx.fill();
        gloss(ctx, -r * 0.26, -r * 0.3, r * 0.18, r * 0.1, -0.5, 0.6);
        break;
      }

      case 'sparkle': {
        const cols = ['#E87A82', '#8FB9A8', '#F7C948', '#C4A8E0'];
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        blob(ctx, 0, r * 0.1, r * 0.62, r * 0.44, 0.9, 0.14, 12);
        ctx.fill();
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = i * 1.57 + 0.4;
          ctx.fillStyle = cols[i];
          star(ctx, Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.36 - r * 0.1, r * 0.3, r * 0.13, 5, a);
          ctx.fill();
          ctx.stroke();
        }
        break;
      }

      case 'watermelon': {
        if (!sliced) {
          // Whole oblong striped watermelon with curly vine stem
          ctx.fillStyle = '#4E9F58';
          ell(ctx, 0, r * 0.04, r * 0.88, r * 0.68, -0.08);
          ctx.fill();
          ctx.stroke();
          ctx.save();
          ell(ctx, 0, r * 0.04, r * 0.84, r * 0.64, -0.08);
          ctx.clip();
          ctx.strokeStyle = '#2E6E38';
          ctx.lineWidth = Math.max(2.2, r * 0.13);
          for (let k = -2; k <= 2; k++) {
            const sy = k * r * 0.24;
            ctx.beginPath();
            ctx.moveTo(-r * 0.9, sy);
            ctx.bezierCurveTo(-r * 0.3, sy - r * 0.12, r * 0.3, sy + r * 0.12, r * 0.9, sy);
            ctx.stroke();
          }
          ctx.restore();
          ctx.strokeStyle = '#3B7A42';
          ctx.lineWidth = Math.max(1.8, r * 0.08);
          ctx.beginPath();
          ctx.moveTo(-r * 0.86, -r * 0.04);
          ctx.bezierCurveTo(-r * 1.05, -r * 0.28, -r * 0.82, -r * 0.45, -r * 0.95, -r * 0.56);
          ctx.stroke();
          gloss(ctx, -r * 0.32, -r * 0.22, r * 0.22, r * 0.09, -0.3, 0.42);
        } else {
          // Juicy ruby-red cross-section with green rind, cream pith & black teardrop seeds
          ctx.fillStyle = '#3B8242';
          circ(ctx, 0, 0, r * 0.84);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#DDF2C8';
          circ(ctx, 0, 0, r * 0.73);
          ctx.fill();
          ctx.fillStyle = '#FF4D6A';
          circ(ctx, 0, 0, r * 0.65);
          ctx.fill();
          ctx.fillStyle = '#2E2420';
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * PI2 + 0.25;
            ell(ctx, Math.cos(a) * r * 0.44, Math.sin(a) * r * 0.44, r * 0.06, r * 0.035, a);
            ctx.fill();
          }
          gloss(ctx, -r * 0.28, -r * 0.28, r * 0.15, r * 0.08, -0.5, 0.48);
        }
        break;
      }

      case 'carrot': {
        if (!sliced) {
          // Leafy green top tuft
          ctx.fillStyle = '#52A858';
          for (let i = -1; i <= 1; i++) {
            ell(ctx, -r * 0.58 + i * r * 0.06, i * r * 0.22, r * 0.28, r * 0.12, i * 0.45 - 0.2);
            ctx.fill();
            ctx.stroke();
          }
          // Tapered orange root body with root ridges
          ctx.fillStyle = '#FF7B29';
          ctx.beginPath();
          ctx.moveTo(-r * 0.48, -r * 0.36);
          ctx.quadraticCurveTo(r * 0.2, -r * 0.28, r * 0.86, r * 0.04);
          ctx.quadraticCurveTo(r * 0.2, r * 0.36, -r * 0.48, r * 0.38);
          ctx.quadraticCurveTo(-r * 0.66, 0, -r * 0.48, -r * 0.36);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#C85512';
          ctx.lineWidth = Math.max(1.4, r * 0.06);
          for (const [rx, ry, len] of [[-0.22, -0.14, 0.22], [0.08, 0.08, 0.2], [0.38, -0.06, 0.16]]) {
            ctx.beginPath();
            ctx.moveTo(rx * r, ry * r);
            ctx.lineTo(rx * r, (ry + len) * r);
            ctx.stroke();
          }
          gloss(ctx, -r * 0.16, -r * 0.16, r * 0.24, r * 0.07, 0.12, 0.4);
        } else {
          // Crisp orange carrot coin cross-section with vascular core & radial rays
          ctx.fillStyle = '#FF7B29';
          circ(ctx, 0, 0, r * 0.74);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFA652';
          circ(ctx, 0, 0, r * 0.56);
          ctx.fill();
          ctx.fillStyle = '#FFD180';
          circ(ctx, 0, 0, r * 0.32);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 236, 179, 0.75)';
          ctx.lineWidth = Math.max(1, r * 0.045);
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * PI2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * r * 0.24, Math.sin(a) * r * 0.24);
            ctx.lineTo(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58);
            ctx.stroke();
          }
          gloss(ctx, -r * 0.24, -r * 0.24, r * 0.12, r * 0.07, -0.5, 0.45);
        }
        break;
      }

      case 'corn': {
        if (!sliced) {
          // Golden cob body
          ctx.fillStyle = '#FFD54F';
          ell(ctx, r * 0.06, -r * 0.02, r * 0.76, r * 0.44, -0.12);
          ctx.fill();
          ctx.stroke();
          // Plump kernel grid
          ctx.fillStyle = '#FFE885';
          ctx.strokeStyle = '#D99B26';
          ctx.lineWidth = Math.max(1, r * 0.04);
          for (let gx = -2; gx <= 2; gx++) {
            for (let gy = -1; gy <= 1; gy++) {
              rr(ctx, gx * r * 0.22, gy * r * 0.18 - r * 0.06, r * 0.17, r * 0.13, r * 0.05);
              ctx.fill();
              ctx.stroke();
            }
          }
          // Peeling green husk leaves at base
          ctx.fillStyle = '#68B878';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = Math.max(1.8, r * 0.08);
          ell(ctx, -r * 0.36, r * 0.24, r * 0.48, r * 0.18, 0.32);
          ctx.fill();
          ctx.stroke();
          ell(ctx, -r * 0.42, -r * 0.18, r * 0.42, r * 0.16, -0.38);
          ctx.fill();
          ctx.stroke();
        } else {
          // Circular cob wheel cross-section with outer ring of plump kernels & cream pith core
          ctx.fillStyle = '#F5B727';
          circ(ctx, 0, 0, r * 0.76);
          ctx.fill();
          ctx.stroke();
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * PI2;
            ctx.fillStyle = k % 2 ? '#FFD54F' : '#FFE885';
            ell(ctx, Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56, r * 0.18, r * 0.14, a);
            ctx.fill();
            ctx.stroke();
          }
          ctx.fillStyle = '#FFF8D6';
          circ(ctx, 0, 0, r * 0.38);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#E6D598';
          circ(ctx, 0, 0, r * 0.2);
          ctx.fill();
        }
        break;
      }

      case 'maki': {
        // Slice 7 (36:00-42:00): Sushi Maki Roll — unrolled bamboo mat -> rolled nori cylinder -> 4-piece cross-section
        const rollP = opts.rollProgress !== undefined ? clamp01(opts.rollProgress) : 1;
        if (!sliced && rollP < 0.85) {
          // Unrolled / partially rolled bamboo mat (makisu) with nori sheet, sushi rice & colorful strips
          const foldW = r * (1.5 - rollP * 0.65);
          ctx.fillStyle = '#D9B37C';
          ctx.strokeStyle = OUTLINE;
          rr(ctx, -foldW * 0.55, -r * 0.64, foldW * 1.1, r * 1.28, r * 0.12);
          ctx.fill();
          ctx.stroke();
          // Bamboo slats
          ctx.strokeStyle = 'rgba(138, 92, 46, 0.45)';
          ctx.lineWidth = Math.max(1, r * 0.04);
          for (let k = -4; k <= 4; k++) {
            const sy = k * r * 0.13;
            ctx.beginPath();
            ctx.moveTo(-foldW * 0.5, sy);
            ctx.lineTo(foldW * 0.5, sy);
            ctx.stroke();
          }
          // Nori seaweed sheet
          ctx.fillStyle = '#26382E';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = Math.max(1.6, r * 0.07);
          rr(ctx, -foldW * 0.44, -r * 0.52, foldW * 0.88, r * 1.04, r * 0.08);
          ctx.fill();
          ctx.stroke();
          // Seasoned white sushi rice bed
          ctx.fillStyle = '#FFFDF9';
          rr(ctx, -foldW * 0.38, -r * 0.44, foldW * 0.76, r * 0.88, r * 0.08);
          ctx.fill();
          // Filling strips: salmon, cucumber, tamago egg
          const strips = [
            { y: -r * 0.14, col: '#FF7052' },
            { y: 0,         col: '#68B878' },
            { y: r * 0.14,  col: '#FFD54F' },
          ];
          strips.forEach(st => {
            ctx.fillStyle = st.col;
            rr(ctx, -foldW * 0.34, st.y - r * 0.06, foldW * 0.68, r * 0.11, r * 0.04);
            ctx.fill();
          });
          if (rollP > 0.08) {
            // Rolling bamboo curl edge
            const curlY = -r * 0.64 + rollP * r * 0.75;
            ctx.fillStyle = '#C99E63';
            ctx.strokeStyle = OUTLINE;
            rr(ctx, -foldW * 0.56, curlY, foldW * 1.12, r * 0.32, r * 0.15);
            ctx.fill();
            ctx.stroke();
          }
        } else if (!sliced) {
          // Rolled Nori Maki Cylinder ready to slice, with visible end-cap cross-section
          ctx.fillStyle = '#26382E';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = Math.max(1.8, r * 0.08);
          rr(ctx, -r * 0.82, -r * 0.44, r * 1.64, r * 0.88, r * 0.38);
          ctx.fill();
          ctx.stroke();
          // Subtle nori sheen & cut guide lines
          ctx.strokeStyle = 'rgba(255,255,255,0.22)';
          ctx.lineWidth = Math.max(1.4, r * 0.05);
          ctx.beginPath();
          ctx.moveTo(-r * 0.58, -r * 0.24);
          ctx.lineTo(r * 0.45, -r * 0.24);
          ctx.stroke();
          // Right end-cap showing rice & salmon/cucumber/tamago core
          ctx.fillStyle = '#FFFDF9';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = Math.max(1.6, r * 0.07);
          ell(ctx, r * 0.58, 0, r * 0.24, r * 0.4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FF7052';
          ell(ctx, r * 0.56, -r * 0.08, r * 0.09, r * 0.14);
          ctx.fill();
          ctx.fillStyle = '#68B878';
          ell(ctx, r * 0.62, r * 0.08, r * 0.08, r * 0.12);
          ctx.fill();
          ctx.fillStyle = '#FFD54F';
          ell(ctx, r * 0.53, r * 0.08, r * 0.08, r * 0.12);
          ctx.fill();
        } else {
          // Sliced Maki Medallion Cross-Section: Nori rim, individual rice grains ring, 3-color core (salmon, cucumber, tamago)
          ctx.fillStyle = '#1F3027';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = Math.max(2, r * 0.09);
          // 3D cylinder base wall
          ell(ctx, 0, r * 0.14, r * 0.78, r * 0.64);
          ctx.fill();
          ctx.stroke();
          // Top nori rim
          ctx.fillStyle = '#2B4034';
          ell(ctx, 0, 0, r * 0.78, r * 0.64);
          ctx.fill();
          ctx.stroke();
          // Plump seasoned sushi rice ring
          ctx.fillStyle = '#FFFDF9';
          ell(ctx, 0, 0, r * 0.66, r * 0.54);
          ctx.fill();
          ctx.stroke();
          // Individual rice grain texture
          ctx.strokeStyle = 'rgba(210, 198, 184, 0.75)';
          ctx.lineWidth = Math.max(1, r * 0.04);
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * PI2 + 0.2;
            ell(ctx, Math.cos(a) * r * 0.48, Math.sin(a) * r * 0.39, r * 0.1, r * 0.055, a + 0.4);
            ctx.stroke();
          }
          // Tri-color maki core: fresh salmon (#FF6E54), crisp cucumber (#5CB868), sweet tamago (#FFD54F), avocado (#A5D66A)
          ctx.lineWidth = Math.max(1.2, r * 0.05);
          ctx.strokeStyle = OUTLINE;
          ctx.fillStyle = '#FF6E54';
          ell(ctx, -r * 0.12, -r * 0.08, r * 0.2, r * 0.16, -0.2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#5CB868';
          ell(ctx, r * 0.14, -r * 0.06, r * 0.16, r * 0.14, 0.3);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFD54F';
          ell(ctx, 0, r * 0.12, r * 0.21, r * 0.14, 0.1);
          ctx.fill();
          ctx.stroke();
          gloss(ctx, -r * 0.14, -r * 0.1, r * 0.08, r * 0.05, -0.3, 0.55);
        }
        break;
      }

      case 'bread': {
        // Slice 5 (24:00-30:00): Hokkaido Milk Toast Bread Slice (raw fluffy crumb -> golden toasted with melting butter pat)
        const toastC = clamp01(cooked);
        const crustCol = lerpColor('#C88A42', '#9E5B1B', toastC);
        const crumbCol = lerpColor('#FFF8E6', '#DF9844', toastC * 0.85);
        const drawToastSlice = (ox, oy, sc) => {
          ctx.save();
          ctx.translate(ox, oy);
          ctx.scale(sc, sc);
          // Golden crust silhouette (classic double-domed milk bread top)
          ctx.fillStyle = crustCol;
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = Math.max(1.8, r * 0.08);
          ctx.beginPath();
          ctx.moveTo(-r * 0.58, -r * 0.18);
          ctx.quadraticCurveTo(-r * 0.68, -r * 0.68, -r * 0.26, -r * 0.68);
          ctx.quadraticCurveTo(0, -r * 0.56, r * 0.26, -r * 0.68);
          ctx.quadraticCurveTo(r * 0.68, -r * 0.68, r * 0.58, -r * 0.18);
          ctx.lineTo(r * 0.52, r * 0.58);
          ctx.quadraticCurveTo(0, r * 0.66, -r * 0.52, r * 0.58);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Inner soft crumb face
          ctx.fillStyle = crumbCol;
          ctx.beginPath();
          ctx.moveTo(-r * 0.45, -r * 0.15);
          ctx.quadraticCurveTo(-r * 0.52, -r * 0.52, -r * 0.2, -r * 0.52);
          ctx.quadraticCurveTo(0, -r * 0.42, r * 0.2, -r * 0.52);
          ctx.quadraticCurveTo(r * 0.52, -r * 0.52, r * 0.45, -r * 0.15);
          ctx.lineTo(r * 0.4, r * 0.44);
          ctx.quadraticCurveTo(0, r * 0.5, -r * 0.4, r * 0.44);
          ctx.closePath();
          ctx.fill();
          // Toasted grill/browning marks when cooked
          if (toastC > 0.2) {
            ctx.fillStyle = rgba('#A85814', toastC * 0.45);
            ell(ctx, 0, 0, r * 0.28, r * 0.32);
            ctx.fill();
            // Melting golden butter pat in center when toasted
            if (toastC > 0.45) {
              const melt = clamp01((toastC - 0.45) / 0.5);
              ctx.fillStyle = 'rgba(255, 232, 110, 0.78)';
              ell(ctx, 0, 0, r * (0.18 + melt * 0.18), r * (0.14 + melt * 0.14), 0.15);
              ctx.fill();
              ctx.fillStyle = '#FFE36E';
              ctx.strokeStyle = OUTLINE;
              ctx.lineWidth = Math.max(1.2, r * 0.05);
              rr(ctx, -r * 0.16, -r * 0.14, r * 0.32, r * 0.26, r * 0.06);
              ctx.fill();
              ctx.stroke();
            }
          }
          ctx.restore();
        };
        if (sliced) {
          drawToastSlice(-r * 0.22, -r * 0.08, 0.82);
          drawToastSlice(r * 0.22, r * 0.1, 0.82);
        } else {
          drawToastSlice(0, 0, 1.0);
        }
        break;
      }

      case 'butter': {
        // Slice 5 (24:00-30:00): Golden Dairy Butter Block & Melting Pat Cross-Section
        const meltP = clamp01(cooked);
        if (meltP > 0.15) {
          ctx.fillStyle = 'rgba(255, 235, 120, 0.75)';
          blob(ctx, 0, r * 0.08, r * (0.65 + meltP * 0.25), r * (0.42 + meltP * 0.16), 1.4, 0.14, 10);
          ctx.fill();
        }
        ctx.fillStyle = '#FFE36E';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.08);
        if (!sliced) {
          rr(ctx, -r * 0.64, -r * 0.38, r * 1.28, r * 0.76, r * 0.16);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFF4AD';
          rr(ctx, -r * 0.54, -r * 0.28, r * 1.08, r * 0.24, r * 0.08);
          ctx.fill();
          gloss(ctx, -r * 0.24, -r * 0.18, r * 0.22, r * 0.07, -0.1, 0.55);
        } else {
          // Sliced square butter pats
          [-r * 0.22, r * 0.22].forEach((bx, idx) => {
            const by = idx === 0 ? -r * 0.08 : r * 0.1;
            ctx.fillStyle = '#FFE36E';
            rr(ctx, bx - r * 0.34, by - r * 0.28, r * 0.68, r * 0.56, r * 0.12);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#FFF7C2';
            ell(ctx, bx - r * 0.08, by - r * 0.08, r * 0.16, r * 0.1, -0.2);
            ctx.fill();
          });
        }
        break;
      }

      default: {
        if (id === 'kettle_tea') {
          // Whistling Stovetop Tea Kettle (Slice 7: 36:00-42:00)
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = Math.max(1.8, r * 0.08);
          // Arching handle
          ctx.strokeStyle = '#5C3D2E';
          ctx.lineWidth = Math.max(2.6, r * 0.12);
          ctx.beginPath();
          ctx.arc(0, -r * 0.18, r * 0.56, PI * 1.08, PI * 1.92);
          ctx.stroke();
          // Spout with whistle cap
          ctx.fillStyle = '#8FB9A8';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = Math.max(1.8, r * 0.08);
          ctx.beginPath();
          ctx.moveTo(r * 0.36, 0);
          ctx.lineTo(r * 0.84, -r * 0.34);
          ctx.lineTo(r * 0.72, -r * 0.48);
          ctx.lineTo(r * 0.28, -r * 0.22);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Red/gold whistle cap on spout tip
          ctx.fillStyle = '#E87A82';
          circ(ctx, r * 0.8, -r * 0.42, r * 0.13);
          ctx.fill();
          ctx.stroke();
          // Dome kettle body
          ctx.fillStyle = '#8BC34A';
          ctx.beginPath();
          ctx.arc(0, r * 0.18, r * 0.62, PI, 0);
          ctx.lineTo(r * 0.68, r * 0.48);
          ctx.quadraticCurveTo(0, r * 0.62, -r * 0.68, r * 0.48);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Lid & wood knob
          ctx.fillStyle = '#FFFDF9';
          ell(ctx, 0, -r * 0.38, r * 0.32, r * 0.1);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#D99B52';
          circ(ctx, 0, -r * 0.5, r * 0.11);
          ctx.fill();
          ctx.stroke();
          gloss(ctx, -r * 0.28, r * 0.05, r * 0.15, r * 0.24, -0.3, 0.45);
        } else if (id === 'milk') {
          ctx.fillStyle = '#FFFDF9';
          rr(ctx, -r * 0.48, -r * 0.35, r * 0.96, r * 1.05, r * 0.22);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#8FB9A8';
          rr(ctx, -r * 0.34, -r * 0.68, r * 0.68, r * 0.32, r * 0.1);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#DCEBF5';
          rr(ctx, -r * 0.32, r * 0.1, r * 0.64, r * 0.36, r * 0.1);
          ctx.fill();
          ctx.fillStyle = '#E87A82';
          heart(ctx, 0, r * 0.28, r * 0.12);
          ctx.fill();
        } else {
          // Star Honey jar with lid & dipper
          ctx.fillStyle = baseCol;
          rr(ctx, -r * 0.66, -r * 0.4, r * 1.32, r * 1.16, r * 0.3);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#D9A066';
          rr(ctx, -r * 0.56, -r * 0.68, r * 1.12, r * 0.34, r * 0.1);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(255, 240, 180, 0.65)';
          rr(ctx, -r * 0.42, -r * 0.1, r * 0.84, r * 0.62, r * 0.18);
          ctx.fill();
          ctx.fillStyle = '#F7C948';
          star(ctx, 0, r * 0.22, r * 0.22, r * 0.1, 5);
          ctx.fill();
          ctx.stroke();
          gloss(ctx, -r * 0.4, -r * 0.1, r * 0.1, r * 0.28, 0, 0.45);
        }
        break;
      }
    }

    // Tactile toy velcro hook-and-loop connector disc on sliced velcro fruits & veggies
    if (sliced && item.velcro) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 253, 249, 0.88)';
      ctx.strokeStyle = '#C9B8A3';
      ctx.lineWidth = Math.max(1.2, r * 0.05);
      circ(ctx, 0, 0, r * 0.21);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([Math.max(1.5, r * 0.06), Math.max(1.5, r * 0.06)]);
      ctx.strokeStyle = '#A69076';
      ctx.lineWidth = Math.max(1, r * 0.038);
      circ(ctx, 0, 0, r * 0.14);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.restore();
  }

  /* ==========================================================================
   * 4. Utensil Primitives (all pure; origin documented per utensil)
   * ========================================================================== */
  /** Santoku chef knife. Origin = middle of the cutting edge. Blade points
   *  left (-x), handle to the right. angle: + = tip up. gleam 0..1 sweeps a
   *  metallic highlight band along the blade. */
  function drawKnife(ctx, x, y, r, angle, gleam, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const lw = Math.max(1.8, r * 0.08);
    // Blade silhouette
    const bladePath = () => {
      ctx.beginPath();
      ctx.moveTo(r * 0.18, 0);
      ctx.lineTo(-r * 0.62, 0);
      ctx.quadraticCurveTo(-r * 1.02, -r * 0.02, -r * 1.06, -r * 0.3);
      ctx.quadraticCurveTo(-r * 0.9, -r * 0.5, -r * 0.4, -r * 0.5);
      ctx.lineTo(r * 0.18, -r * 0.5);
      ctx.closePath();
    };
    if (opts.ghost) {
      ctx.fillStyle = `rgba(235, 242, 248, ${opts.ghost})`;
      bladePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    const bg = ctx.createLinearGradient(-r, -r * 0.5, r * 0.2, 0.1);
    bg.addColorStop(0, '#FFFFFF');
    bg.addColorStop(0.45, '#E9F0F5');
    bg.addColorStop(1, '#BFCED8');
    ctx.fillStyle = bg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    bladePath();
    ctx.fill();
    ctx.stroke();
    // Sharp edge bevel
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.05);
    ctx.lineTo(-r * 0.7, -r * 0.05);
    ctx.stroke();
    // Granton dimples
    ctx.fillStyle = 'rgba(170, 190, 205, 0.55)';
    for (let i = 0; i < 4; i++) {
      ell(ctx, -r * 0.72 + i * r * 0.2, -r * 0.3, r * 0.045, r * 0.075);
      ctx.fill();
    }
    // Metallic gleam sweep
    if (gleam !== undefined && gleam !== null) {
      const g = clamp01(gleam);
      const gx = -r * 1.0 + g * r * 1.3;
      ctx.save();
      bladePath();
      ctx.clip();
      const gg = ctx.createLinearGradient(gx - r * 0.22, 0, gx + r * 0.22, 0);
      gg.addColorStop(0, 'rgba(255,255,255,0)');
      gg.addColorStop(0.5, `rgba(255,255,255,${0.85 * bump(g)})`);
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(gx - r * 0.3, -r * 0.6, r * 0.6, r * 0.7);
      ctx.restore();
    }
    // Bolster + walnut handle with brass rivets
    ctx.fillStyle = '#B9C6D0';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    rr(ctx, r * 0.12, -r * 0.54, r * 0.14, r * 0.58, r * 0.04);
    ctx.fill();
    ctx.stroke();
    const hg = ctx.createLinearGradient(0, -r * 0.5, 0, 0);
    hg.addColorStop(0, '#D4946A');
    hg.addColorStop(1, '#9C5F3B');
    ctx.fillStyle = hg;
    rr(ctx, r * 0.24, -r * 0.46, r * 0.86, r * 0.42, r * 0.16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F5D076';
    ctx.lineWidth = Math.max(1, r * 0.03);
    [r * 0.46, r * 0.72, r * 0.96].forEach(px => {
      circ(ctx, px, -r * 0.25, r * 0.05);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  /** Silver dessert spoon. Origin = centre of the spoon bowl; handle hangs
   *  downward (+y) when angle = 0. opts: {scoop 0..1, ingId, color, loaded} */
  function drawSpoon(ctx, x, y, r, angle, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const lw = Math.max(1.8, r * 0.08);
    // Handle (gently curved, thicker at the end)
    const sg = ctx.createLinearGradient(-r * 0.3, 0, r * 0.3, 0);
    sg.addColorStop(0, '#C9D4DC');
    sg.addColorStop(0.5, '#F4F8FA');
    sg.addColorStop(1, '#B8C5CE');
    ctx.fillStyle = sg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-r * 0.16, r * 0.4);
    ctx.quadraticCurveTo(-r * 0.2, r * 1.3, -r * 0.24, r * 1.9);
    ctx.quadraticCurveTo(0, r * 2.2, r * 0.24, r * 1.9);
    ctx.quadraticCurveTo(r * 0.2, r * 1.3, r * 0.16, r * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Bowl
    const bgd = ctx.createRadialGradient(-r * 0.1, -r * 0.1, r * 0.05, 0, 0, r * 0.62);
    bgd.addColorStop(0, '#FFFFFF');
    bgd.addColorStop(0.7, '#DCE6EC');
    bgd.addColorStop(1, '#B4C3CC');
    ctx.fillStyle = bgd;
    ell(ctx, 0, 0, r * 0.46, r * 0.58);
    ctx.fill();
    ctx.stroke();
    // Inner bowl shade
    ctx.fillStyle = 'rgba(120, 140, 155, 0.22)';
    ell(ctx, r * 0.04, r * 0.08, r * 0.3, r * 0.4);
    ctx.fill();
    const scoop = opts.scoop === undefined ? (opts.loaded ? 1 : 0) : clamp01(opts.scoop);
    if (scoop > 0.02) {
      const isCake = !!opts.isCake;
      ctx.save();
      ctx.scale(scoop, scoop);
      if (isCake) {
        // Miniature wedge of THE player's cake: its real sponge layers, cream filling & frosting
        const layers = (opts.layerColors && opts.layerColors.length) ? opts.layerColors : [VANILLA_SPONGE];
        const bands = spongeBands(layers);
        const frosting = safeColor(opts.frostingColor, VANILLA_CREAM);
        const topCol = safeColor(opts.glazeColor, frosting);
        const n = bands.length;
        const wedgeH = r * 0.62, bandH = wedgeH / n;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.6;
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = bands[n - 1 - i];
          const ly = -r * 0.36 + i * bandH;
          rr(ctx, -r * 0.34, ly, r * 0.68, bandH + 0.5, 1.2);
          ctx.fill();
          if (i > 0) {
            ctx.fillStyle = VANILLA_CREAM;
            ctx.fillRect(-r * 0.32, ly - r * 0.012, r * 0.64, r * 0.024);
          }
        }
        // Frosting roof on top of the wedge (base frosting or poured glaze)
        ctx.fillStyle = topCol;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.54);
        ctx.lineTo(r * 0.36, -r * 0.34);
        ctx.lineTo(-r * 0.36, -r * 0.34);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        rr(ctx, -r * 0.36, -r * 0.38, r * 0.72, r * 0.08, 2);
        ctx.fill();
        ctx.stroke();
        // Outer frosting coat on the right side
        ctx.fillStyle = frosting;
        rr(ctx, r * 0.3, -r * 0.34, r * 0.06, wedgeH, 1);
        ctx.fill();
        ctx.strokeRect(-r * 0.34, -r * 0.36, r * 0.68, wedgeH);
        // A little of what the player put on top rides along
        if (opts.topper && opts.topper.kind === 'ball') drawSpecularCandyBall(ctx, 0, -r * 0.48, r * 0.17, safeColor(opts.topper.color, '#FF2A2A'));
        else if (opts.topper && opts.topper.kind === 'rosette') drawButtercreamRosette(ctx, 0, -r * 0.5, r * 0.17, safeColor(opts.topper.color, '#FF85B3'));
        else if (opts.topper && opts.topper.kind === 'fruit') drawIngredient(ctx, opts.topper.id, 0, -r * 0.5, r * 0.2, { sliced: true, shadow: false });
      } else {
        const col = opts.color || '#F4A6B8';
        ctx.fillStyle = col;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.4, r * 0.06);
        blob(ctx, 0, -r * 0.06, r * 0.42, r * 0.4, 1.7, 0.12, 12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = lighten(col, 0.4);
        ell(ctx, -r * 0.12, -r * 0.18, r * 0.14, r * 0.08, -0.5);
        ctx.fill();
        if (opts.ingId) {
          drawIngredient(ctx, opts.ingId, r * 0.06, -r * 0.1, r * 0.3, {
            sliced: true, cooked: opts.cooked || 0, shadow: false,
          });
        }
      }
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ell(ctx, -r * 0.2, -r * 0.26, r * 0.07, r * 0.14, -0.3);
    ctx.fill();
    ctx.restore();
  }

  /** Wooden-handled balloon whisk. Origin = centre of the wire balloon. The
   *  handle points up (-y) when angle = 0. */
  function drawWhisk(ctx, x, y, r, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8C9BA5';
    ctx.lineWidth = Math.max(1.6, r * 0.07);
    for (let i = 0; i < 4; i++) {
      ell(ctx, 0, 0, r * (0.14 + i * 0.16), r * 0.62, 0);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(1, r * 0.03);
    ell(ctx, -r * 0.08, -r * 0.08, r * 0.3, r * 0.5, 0);
    ctx.stroke();
    // Ferrule + handle
    ctx.fillStyle = '#C9D4DC';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.6, r * 0.07);
    rr(ctx, -r * 0.14, -r * 0.78, r * 0.28, r * 0.22, r * 0.06);
    ctx.fill();
    ctx.stroke();
    const hg = ctx.createLinearGradient(-r * 0.2, 0, r * 0.2, 0);
    hg.addColorStop(0, '#B97A4C');
    hg.addColorStop(0.5, '#E0A472');
    hg.addColorStop(1, '#A86A3E');
    ctx.fillStyle = hg;
    rr(ctx, -r * 0.17, -r * 1.75, r * 0.34, r * 1.02, r * 0.16);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#E88388';
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.beginPath();
    ctx.arc(0, -r * 1.82, r * 0.12, 0, PI2);
    ctx.stroke();
    ctx.restore();
  }

  /** Pastel pastry piping bag. Origin = nozzle tip (cream exits downward).
   *  squeeze 0..1 bulges the bag and extrudes a cream swirl. */
  function drawPipingBag(ctx, x, y, r, squeeze, color, opts) {
    opts = opts || {};
    squeeze = clamp01(squeeze);
    color = color || '#FF85B3';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(opts.angle !== undefined ? opts.angle : 0.42);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Cream extruding from the tip
    if (squeeze > 0.03) {
      const s = squeeze;
      ctx.fillStyle = color;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = Math.max(1.4, r * 0.06);
      for (let i = 0; i < 3; i++) {
        const ry = r * (0.12 + i * 0.07) * s;
        ell(ctx, 0, r * 0.06 + i * r * 0.12 * s, r * (0.1 + i * 0.09) * s, ry);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = lighten(color, 0.45);
      ell(ctx, -r * 0.05 * s, r * 0.14 * s, r * 0.05 * s, r * 0.08 * s);
      ctx.fill();
    }
    // Metal star nozzle
    ctx.fillStyle = '#C9D4DC';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.6, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, 0);
    ctx.lineTo(r * 0.1, 0);
    ctx.lineTo(r * 0.24, -r * 0.42);
    ctx.lineTo(-r * 0.24, -r * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Bag body (cone), bulging with squeeze
    ctx.save();
    ctx.translate(0, -r * 0.42);
    ctx.scale(1 + squeeze * 0.14, 1 - squeeze * 0.1);
    const bg = ctx.createLinearGradient(-r * 0.6, 0, r * 0.6, 0);
    bg.addColorStop(0, lighten(color, 0.55));
    bg.addColorStop(0.5, lighten(color, 0.78));
    bg.addColorStop(1, lighten(color, 0.5));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-r * 0.24, 0);
    ctx.lineTo(r * 0.24, 0);
    ctx.quadraticCurveTo(r * 0.78, -r * 0.9, r * 0.56, -r * 1.7);
    ctx.quadraticCurveTo(0, -r * 1.95, -r * 0.56, -r * 1.7);
    ctx.quadraticCurveTo(-r * 0.78, -r * 0.9, -r * 0.24, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Gingham stripes
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = rgba(color, 0.35);
    ctx.lineWidth = Math.max(2, r * 0.1);
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.22, -r * 2);
      ctx.lineTo(i * r * 0.22 * 0.4, 0);
      ctx.stroke();
    }
    ctx.restore();
    // Twisted top + ribbon
    ctx.fillStyle = lighten(color, 0.3);
    rr(ctx, -r * 0.3, -r * 1.86, r * 0.6, r * 0.22, r * 0.1);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    heart(ctx, 0, -r * 1.98, r * 0.14);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /** Wooden turner spatula. Origin = head centre; handle to upper-right. */
  function drawSpatula(ctx, x, y, r, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.8, r * 0.08);
    const hg = ctx.createLinearGradient(0, -r * 0.1, 0, r * 0.1);
    hg.addColorStop(0, '#E0A472');
    hg.addColorStop(1, '#B07545');
    ctx.fillStyle = hg;
    rr(ctx, r * 0.3, -r * 0.12, r * 1.3, r * 0.24, r * 0.1);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F2C89A';
    rr(ctx, -r * 0.7, -r * 0.4, r * 1.05, r * 0.8, r * 0.18);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(92,61,46,0.3)';
    ctx.lineWidth = Math.max(1.2, r * 0.05);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, i * r * 0.2);
      ctx.lineTo(r * 0.12, i * r * 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Sprinkle shaker. Origin = lid centre; tilt in radians. */
  function drawShaker(ctx, x, y, r, tilt, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.8, r * 0.08);
    ctx.fillStyle = 'rgba(255, 253, 249, 0.9)';
    rr(ctx, -r * 0.42, -r * 0.1, r * 0.84, r * 1.3, r * 0.2);
    ctx.fill();
    ctx.stroke();
    const cols = ['#E87A82', '#F2C97D', '#8FB9A8', '#9B82C9', '#F4A261'];
    for (let k = 0; k < 9; k++) {
      ctx.save();
      ctx.translate((hash(k) - 0.5) * r * 0.6, r * 0.3 + hash(k + 4) * r * 0.8);
      ctx.rotate(hash(k + 8) * PI);
      ctx.fillStyle = color || cols[k % cols.length];
      rr(ctx, -r * 0.1, -r * 0.04, r * 0.2, r * 0.08, r * 0.04);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#C9D4DC';
    rr(ctx, -r * 0.46, -r * 0.46, r * 0.92, r * 0.4, r * 0.1);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = OUTLINE;
    for (let i = -1; i <= 1; i++) {
      for (let j = 0; j < 2; j++) {
        circ(ctx, i * r * 0.2, -r * 0.36 + j * r * 0.16, r * 0.04);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Squeeze sauce bottle. Origin = nozzle tip. */
  function drawSauceBottle(ctx, x, y, r, tilt, color, pour) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt === undefined ? 0.5 : tilt);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.8, r * 0.08);
    if (pour > 0.02) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-r * 0.06, 0);
      ctx.quadraticCurveTo(-r * 0.1, r * 0.4 * pour, 0, r * 0.7 * pour);
      ctx.quadraticCurveTo(r * 0.1, r * 0.4 * pour, r * 0.06, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#E8998D';
    ctx.beginPath();
    ctx.moveTo(-r * 0.08, 0);
    ctx.lineTo(r * 0.08, 0);
    ctx.lineTo(r * 0.26, -r * 0.4);
    ctx.lineTo(-r * 0.26, -r * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = lighten(color, 0.15);
    rr(ctx, -r * 0.4, -r * 1.5, r * 0.8, r * 1.14, r * 0.26);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFF9F0';
    ell(ctx, 0, -r * 0.95, r * 0.22, r * 0.18);
    ctx.fill();
    ctx.fillStyle = color;
    heart(ctx, 0, -r * 0.95, r * 0.11);
    ctx.fill();
    gloss(ctx, -r * 0.24, -r * 1.1, r * 0.06, r * 0.3, 0, 0.5);
    ctx.restore();
  }

  /* ==========================================================================
   * 5. Particle shape renderer (game.js owns physics / alpha / glow)
   * ========================================================================== */
  function drawParticle(ctx, p, t) {
    const r = Math.max(0.5, (p.r || 4) * (p.scale === undefined ? 1 : p.scale));
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.rot) ctx.rotate(p.rot);
    if (p.color) ctx.fillStyle = p.color;
    switch (p.kind) {
      case 'star': {
        star(ctx, 0, 0, r * 1.4, r * 0.62, 5, 0);
        ctx.fill();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.1, r * 0.16);
        ctx.stroke();
        ctx.fillStyle = '#FFFDF8';
        circ(ctx, -r * 0.28, -r * 0.3, r * 0.28);
        ctx.fill();
        break;
      }
      case 'sparkle': {
        sparkle4(ctx, 0, 0, r * 1.5, 0);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        circ(ctx, 0, 0, r * 0.35);
        ctx.fill();
        break;
      }
      case 'heart': {
        heart(ctx, 0, 0, r * 1.3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        circ(ctx, -r * 0.35, -r * 0.4, r * 0.22);
        ctx.fill();
        break;
      }
      case 'confetti': {
        rr(ctx, -r * 1.1, -r * 0.5, r * 2.2, r, r * 0.3);
        ctx.fill();
        break;
      }
      case 'crumb': {
        blob(ctx, 0, 0, r * 0.9, r * 0.7, (p.seed || 0) + 1, 0.3, 8);
        ctx.fill();
        break;
      }
      case 'droplet': {
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.5);
        ctx.quadraticCurveTo(r * 1.1, 0, 0, r * 0.9);
        ctx.quadraticCurveTo(-r * 1.1, 0, 0, -r * 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        circ(ctx, -r * 0.3, -r * 0.1, r * 0.26);
        ctx.fill();
        break;
      }
      case 'steam': {
        // Gouache storybook steam vapor cloudlet: multi-lobed soft translucent cream-white puff
        const grow = p.maxLife ? 1.6 - (p.life || 0) / p.maxLife * 0.6 : 1;
        const rad = r * grow;
        ctx.fillStyle = p.color || 'rgba(255, 252, 244, 0.7)';
        circ(ctx, 0, 0, rad * 0.88);
        ctx.fill();
        circ(ctx, -rad * 0.42, rad * 0.18, rad * 0.62);
        ctx.fill();
        circ(ctx, rad * 0.38, -rad * 0.22, rad * 0.66);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
        circ(ctx, -rad * 0.18, -rad * 0.18, rad * 0.42);
        ctx.fill();
        break;
      }
      case 'frying_smoke':
      case 'smoke': {
        // Sizzling warm savory smoke wisps with subtle amber-cocoa gouache shading
        const grow = p.maxLife ? 1.8 - (p.life || 0) / p.maxLife * 0.7 : 1;
        const rad = r * grow;
        ctx.fillStyle = p.color || 'rgba(215, 195, 175, 0.45)';
        blob(ctx, 0, 0, rad, rad * 0.78, (p.seed || 0) + 3, 0.22, 10);
        ctx.fill();
        ctx.fillStyle = 'rgba(240, 225, 210, 0.28)';
        ell(ctx, rad * 0.2, -rad * 0.3, rad * 0.48, rad * 0.32, 0.35);
        ctx.fill();
        break;
      }
      case 'sizzle_spark': {
        // Micro golden oil droplet popping with bright shine
        ctx.fillStyle = p.color || '#FFA726';
        circ(ctx, 0, 0, r);
        ctx.fill();
        ctx.fillStyle = '#FFFDF0';
        circ(ctx, -r * 0.3, -r * 0.3, r * 0.4);
        ctx.fill();
        break;
      }
      case 'soapy_bubble': {
        // Iridescent translucent gouache soap bubble
        const wob = Math.sin((t || 0) * 6 + (p.seed || 0)) * 0.08;
        const rx = r * (1 + wob);
        const ry = r * (1 - wob);
        const grad = ctx.createRadialGradient(-rx * 0.3, -ry * 0.3, rx * 0.08, 0, 0, rx);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.52)');
        grad.addColorStop(0.65, 'rgba(225, 242, 254, 0.22)');
        grad.addColorStop(0.9, 'rgba(180, 220, 250, 0.38)');
        grad.addColorStop(1, 'rgba(136, 200, 247, 0.62)');
        ctx.fillStyle = grad;
        ell(ctx, 0, 0, rx, ry);
        ctx.fill();
        ctx.strokeStyle = p.color || 'rgba(136, 200, 247, 0.72)';
        ctx.lineWidth = Math.max(1.2, r * 0.12);
        ell(ctx, 0, 0, rx, ry);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(244, 166, 184, 0.42)';
        ctx.lineWidth = Math.max(1, r * 0.08);
        ctx.beginPath();
        ctx.arc(0, 0, rx * 0.88, 0.4, 1.8);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.lineWidth = Math.max(1.5, r * 0.16);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(-rx * 0.32, -ry * 0.32, rx * 0.35, -Math.PI * 0.8, -Math.PI * 0.15);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
        circ(ctx, rx * 0.38, ry * 0.38, rx * 0.14);
        ctx.fill();
        break;
      }
      case 'water_stream':
      case 'water_bead': {
        // Fluid water droplet stretched along travel vector
        const spd = Math.hypot(p.vx || 0, p.vy || 0);
        const stretch = Math.min(2.8, 1 + spd / 85);
        ctx.fillStyle = p.color || 'rgba(130, 210, 248, 0.75)';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * stretch, r * 0.72, 0, 0, PI2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.76)';
        ctx.beginPath();
        ctx.ellipse(-r * stretch * 0.25, -r * 0.18, r * stretch * 0.42, r * 0.28, 0, 0, PI2);
        ctx.fill();
        break;
      }
      case 'water_splash': {
        // Glossy teardrop splashing droplet
        ctx.fillStyle = p.color || 'rgba(120, 205, 248, 0.8)';
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.4);
        ctx.quadraticCurveTo(r * 1.1, 0, 0, r * 0.9);
        ctx.quadraticCurveTo(-r * 1.1, 0, 0, -r * 1.4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
        circ(ctx, -r * 0.25, -r * 0.1, r * 0.3);
        ctx.fill();
        break;
      }
      case 'water_ripple': {
        // Concentric expanding watery ripple
        ctx.strokeStyle = p.color || 'rgba(130, 215, 250, 0.7)';
        ctx.lineWidth = Math.max(1.2, (p.lineWidth || 2.2) * (1 - (p.life ? 1 - p.life / p.maxLife : 0)));
        ell(ctx, 0, 0, r * 1.6, r * 0.65);
        ctx.stroke();
        break;
      }
      case 'sprinkle': {
        // Cylindrical rainbow jimmy in pastel gouache with cocoa outline
        const w = r * 2.8, h = r * 1.15, cr = h * 0.5;
        ctx.fillStyle = p.color || '#FF6B8B';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.1, r * 0.2);
        rr(ctx, -w * 0.5, -h * 0.5, w, h, cr);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        rr(ctx, -w * 0.35, -h * 0.35, w * 0.45, h * 0.35, cr * 0.6);
        ctx.fill();
        break;
      }
      case 'flour_puff': {
        // Fine powdery cloudlet
        const grow = p.maxLife ? 1.5 - (p.life || 0) / p.maxLife * 0.5 : 1;
        const rad = r * grow;
        ctx.fillStyle = p.color || 'rgba(255, 252, 244, 0.65)';
        circ(ctx, 0, 0, rad);
        ctx.fill();
        circ(ctx, -rad * 0.3, rad * 0.2, rad * 0.6);
        ctx.fill();
        circ(ctx, rad * 0.35, -rad * 0.2, rad * 0.65);
        ctx.fill();
        break;
      }
      case 'candle_smoke': {
        // Twisting, curling wispy candle smoke ribbon
        const grow = p.maxLife ? 1.9 - (p.life || 0) / p.maxLife * 0.8 : 1;
        const rad = r * grow;
        const col = p.color || 'rgba(145, 130, 120, 0.45)';
        ctx.fillStyle = col;
        ctx.beginPath();
        const w = rad * 0.65;
        ctx.moveTo(0, rad * 1.2);
        ctx.bezierCurveTo(-w, rad * 0.6, w, -rad * 0.4, 0, -rad * 1.3);
        ctx.bezierCurveTo(w * 0.6, -rad * 0.5, -w * 0.6, rad * 0.5, 0, rad * 1.2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(200, 190, 180, 0.22)';
        circ(ctx, 0, -rad * 0.8, rad * 0.45);
        ctx.fill();
        break;
      }
      case 'ring': {
        ctx.strokeStyle = p.color || 'rgba(255,255,255,0.8)';
        ctx.lineWidth = p.lineWidth || Math.max(1.5, r * 0.25);
        circ(ctx, 0, 0, r);
        ctx.stroke();
        break;
      }
      default: {
        circ(ctx, 0, 0, r);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  /* ==========================================================================
   * 6. Plated Patisserie Dish / Boba Parfait — 3 luscious portions, no holes
   *    opts: { scoopProgress 0..1, toppingSprings[], pipingPop }
   * ========================================================================== */
  const PORTION_ORDER = [1, 0, 2]; // bottom (nearest), right, left
  const PORTION_A0 = -PI / 2;      // sector 0 starts at the top

  /* ---------- Ingredient-driven cake palette (ZERO hardcoded chocolate) ----------
   * Every sponge / batter / frosting colour is derived from the ingredient ids the
   * player actually prepped. Dark chocolate only ever appears when 'chocolate' or
   * 'cocoa' is genuinely in the dish (or the player picked a chocolate glaze). */
  const CHOCO_IDS = { chocolate: true, cocoa: true };
  const CHOCO_SPONGE = '#6B3A1E';
  const CHOCO_GLAZE = '#3C1B0E';
  const VANILLA_SPONGE = '#FFF0C2';
  const VANILLA_CREAM = '#FFFDF9';
  // Neutral bases that do not tint a sponge layer on their own
  const NEUTRAL_IDS = { dough: true, egg: true, milk: true, honey: true, icecream: true, cheese: false, bun: true, pizzabase: true };
  const SPONGE_COLOR = {
    strawberry: '#FF6B8B', banana: '#FFE066', pineapple: '#FFE066', kiwi: '#70D66B',
    blueberry: '#6BA8FF', peach: '#FFB38A', lemon: '#FFF07A', cherry: '#E8405A',
    chocolate: CHOCO_SPONGE, cocoa: CHOCO_SPONGE, boba: '#8C6A52', popcandy: '#FF8FD8',
    tomato: '#FF7A66', lettuce: '#9BE39B', chili: '#FF5E4D', cheese: '#FFD966',
    beef: '#C98A6B', bacon: '#E8907A', shrimp: '#FFB49A', sausage: '#E09070',
  };
  function isChocoId(id) { return !!CHOCO_IDS[id]; }
  function ingMeta(id) {
    const m = (typeof KitchenData !== 'undefined' && KitchenData) ? KitchenData.getIngredient(id) : null;
    return m && m.id === id ? m : null;
  }
  function isNeutralId(id) {
    const m = ingMeta(id);
    if (m && typeof m.neutral === 'boolean') return m.neutral;
    return !!NEUTRAL_IDS[id];
  }
  function isRainbowId(id) { const m = ingMeta(id); return !!(m && m.rainbow); }
  function isFruitId(id) { const m = ingMeta(id); return !!(m && m.cat === 'fruit'); }
  function spongeColorFor(id) {
    const m = ingMeta(id);
    if (m && m.batter) return m.batter;
    if (SPONGE_COLOR[id]) return SPONGE_COLOR[id];
    return m && m.color ? lighten(m.color, 0.12) : VANILLA_SPONGE;
  }
  function creamColorFor(id) {
    const m = ingMeta(id);
    if (m && m.cream) return m.cream;
    return lighten(spongeColorFor(id), 0.5);
  }
  /** Single source of truth when data.js provides it; otherwise the local deriver. */
  function paletteForIds(ids) {
    if (typeof KitchenData !== 'undefined' && KitchenData && typeof KitchenData.paletteFor === 'function') {
      try {
        const p = KitchenData.paletteFor(ids);
        if (p && Array.isArray(p.layerColors) && p.layerColors.length) return p;
      } catch (e) { /* fall through to the local deriver */ }
    }
    const hasChocolate = ids.some(isChocoId);
    const hasRainbow = ids.some(isRainbowId);
    const colored = ids.filter(id => !isNeutralId(id) && !isRainbowId(id));
    const layerColors = hasRainbow ? RAINBOW_6.slice() : (colored.length ? layerColorsFromIds(colored, null) : [VANILLA_SPONGE]);
    const batterTint = colored.length ? avgColors(colored.map(spongeColorFor)) : (hasRainbow ? '#FF8FD8' : VANILLA_SPONGE);
    const frostingColor = hasChocolate ? CHOCO_GLAZE : (colored.length ? creamColorFor(colored[0]) : VANILLA_CREAM);
    return { ids, colored, layerColors, batterTint, frostingColor, hasChocolate, hasRainbow };
  }
  function avgColors(list) {
    if (!list || !list.length) return null;
    let r = 0, g = 0, b = 0;
    list.forEach(c => { const q = hexToRgb(safeColor(c, VANILLA_SPONGE)); r += q[0]; g += q[1]; b += q[2]; });
    const n = list.length;
    const h = v => ('0' + Math.round(v / n).toString(16)).slice(-2);
    return '#' + h(r) + h(g) + h(b);
  }
  function itemIds(dish) { return (dish && dish.items ? dish.items : []).map(it => it.id); }
  function dishHasChoco(dish) { return itemIds(dish).some(isChocoId); }
  /** Distinct sponge colours from the ingredients actually in the dish (bottom -> top). */
  function layerColorsFromIds(ids, tint) {
    const cols = [];
    ids.forEach(id => {
      if (isNeutralId(id)) return;
      const c = spongeColorFor(id);
      if (cols.indexOf(c) < 0) cols.push(c);
    });
    if (!cols.length) cols.push(tint ? lighten(tint, 0.1) : VANILLA_SPONGE);
    return cols;
  }
  function deriveLayerColors(dish) {
    if (dish && Array.isArray(dish.layerColors) && dish.layerColors.length) return dish.layerColors.map(c => safeColor(c, VANILLA_SPONGE));
    return paletteForIds(itemIds(dish)).layerColors;
  }
  function deriveBatterTint(dish) {
    if (dish && dish.batterTint) return safeColor(dish.batterTint, VANILLA_SPONGE);
    const ids = itemIds(dish);
    if (ids.length) return safeColor(paletteForIds(ids).batterTint, VANILLA_SPONGE);
    if (dish && dish.liquidColor) return safeColor(dish.liquidColor, VANILLA_SPONGE);
    return VANILLA_SPONGE;
  }
  function deriveFrostingColor(dish) {
    if (dish && dish.frostingColor) return safeColor(dish.frostingColor, VANILLA_CREAM);
    return safeColor(paletteForIds(itemIds(dish)).frostingColor, VANILLA_CREAM);
  }
  function isCakeDish(dish) { return !!(dish && dish.bakedCake && dish.vessel !== 'cup'); }

  /* ---------- 3D layer-cake cylinder geometry (dish-local, unscaled) ----------
   * Shared with game.js via KitchenData.CAKE_GEOM so hit-testing and drawing agree. */
  const CAKE = { cy: -28, R: 84, ry: 32, H: 68 };
  function cakeGeom(dish) {
    const G = (typeof KitchenData !== 'undefined' && KitchenData && KitchenData.CAKE_GEOM) || null;
    const cy = G && typeof G.topY === 'number' ? G.topY : CAKE.cy;
    const R = G && typeof G.radius === 'number' ? G.radius : CAKE.R;
    const ry = G && typeof G.topRy === 'number' ? G.topRy : CAKE.ry;
    const H = G && typeof G.sideHeight === 'number' ? G.sideHeight : CAKE.H;
    return { cy, R, ry, H };
  }
  /** Rim point of the top ellipse at angle a. */
  function rimPt(g, a) { return { x: Math.cos(a) * g.R, y: g.cy + Math.sin(a) * g.ry }; }
  /** Resolve where a decoration sits on the cake surface.
   *  Convention: screen angle a = aw - turntableAngle (front centre a = PI/2,
   *  x = cos(a) * R, visible side when sin(a) > 0). Accepts the game's optional
   *  precomputed cylinder coords { face, theta, h, rad } (x = R*sin(theta+angle)),
   *  otherwise maps the dish-local tap (x, y) + the angle at placement. */
  function cakeSurfacePoint(g, ent) {
    if (ent && typeof ent.theta === 'number' && ent.face) {
      if (ent.face === 'top') return { top: true, rad: clamp01(ent.rad === undefined ? 0.6 : ent.rad), h: 0, aw: PI / 2 - ent.theta };
      return { top: false, rad: 1, h: clamp01(ent.h || 0), aw: PI / 2 - ent.theta };
    }
    const x = ent.x || 0, y = ent.y || 0, placed = ent.angle || 0;
    const u = x / g.R, v = (y - g.cy) / g.ry;
    const radTop = Math.hypot(u, v);
    if (radTop <= 1.02 || y < g.cy) {
      return { top: true, rad: Math.min(0.94, radTop), h: 0, aw: Math.atan2(v, u) + placed };
    }
    const ux = clamp(u, -0.985, 0.985);
    const frontRimY = g.cy + Math.sqrt(1 - ux * ux) * g.ry;
    return { top: false, rad: 1, h: clamp01((y - frontRimY) / g.H), aw: Math.acos(ux) + placed };
  }
  /** Screen position (dish-local) + depth scale of a surface point for the current angle. */
  function cakeSurfaceXY(g, sp, angle) {
    const a = sp.aw - (angle || 0);
    if (sp.top) {
      return { x: Math.cos(a) * sp.rad * g.R, y: g.cy + Math.sin(a) * sp.rad * g.ry, depth: 1, sin: 1, visible: true };
    }
    const s = Math.sin(a);
    return {
      x: Math.cos(a) * g.R * 0.985,
      y: g.cy + s * g.ry + sp.h * g.H,
      depth: 0.82 + 0.22 * clamp01(s), sin: s, visible: s > -0.06,
    };
  }
  /** Full outline of the cake cylinder (top ellipse + side wall + bottom front arc). */
  function cakeBodyPath(ctx, g) {
    ctx.beginPath();
    ctx.moveTo(-g.R, g.cy);
    ctx.lineTo(-g.R, g.cy + g.H);
    ctx.ellipse(0, g.cy + g.H, g.R, g.ry, 0, PI, 0, true);
    ctx.lineTo(g.R, g.cy);
    ctx.ellipse(0, g.cy, g.R, g.ry, 0, 0, PI, true);
    ctx.closePath();
  }
  function cakeSidePath(ctx, g) {
    ctx.beginPath();
    ctx.moveTo(-g.R, g.cy);
    ctx.lineTo(-g.R, g.cy + g.H);
    ctx.ellipse(0, g.cy + g.H, g.R, g.ry, 0, PI, 0, true);
    ctx.lineTo(g.R, g.cy);
    ctx.ellipse(0, g.cy, g.R, g.ry, 0, 0, PI, false);
    ctx.closePath();
  }

  /** Plate portion wedge (flat dishes). */
  function platePortionPath(ctx, idx, R) {
    const a1 = PORTION_A0 + idx * (PI2 / 3);
    sector(ctx, 0, -2, R, R * 0.66, a1, a1 + PI2 / 3);
  }
  /** Cake-aware portion region: straight cuts from the top centre + vertical cut
   *  faces on the side wall, extended outward so the three regions tile the plane. */
  function cakePortionPath(ctx, idx, g) {
    const a1 = PORTION_A0 + idx * (PI2 / 3);
    const a2 = a1 + PI2 / 3;
    const BIG = 420;
    const p1 = rimPt(g, a1), p2 = rimPt(g, a2);
    const ext = (p, a) => ({ x: p.x, y: Math.sin(a) >= -0.001 ? BIG : -BIG });
    const e1 = ext(p1, a1), e2 = ext(p2, a2);
    const angOf = p => Math.atan2(p.y - g.cy, p.x);
    const corners = [{ x: BIG, y: -BIG }, { x: BIG, y: BIG }, { x: -BIG, y: BIG }, { x: -BIG, y: -BIG }];
    let s = angOf(e1), e = angOf(e2);
    while (e <= s) e += PI2;
    ctx.moveTo(0, g.cy);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(e1.x, e1.y);
    corners
      .map(c => { let a = angOf(c); while (a <= s) a += PI2; return { c, a }; })
      .filter(o => o.a < e)
      .sort((p, q) => p.a - q.a)
      .forEach(o => ctx.lineTo(o.c.x, o.c.y));
    ctx.lineTo(e2.x, e2.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
  }
  function portionPath(ctx, idx, R, dish) {
    if (isCakeDish(dish)) cakePortionPath(ctx, idx, cakeGeom(dish));
    else platePortionPath(ctx, idx, R);
  }

  /** Dish-local (unscaled) point where bite #i (0..2) is scooped from. */
  function getDishPortionPoint(i, dish) {
    if (dish && dish.vessel === 'cup') return { x: 0, y: -50 };
    const idx = PORTION_ORDER[clamp(Math.floor(i || 0), 0, 2)];
    const a = PORTION_A0 + (idx + 0.5) * (PI2 / 3);
    if (isCakeDish(dish)) {
      const g = cakeGeom(dish);
      return { x: Math.cos(a) * g.R * 0.5, y: g.cy + 4 + Math.sin(a) * g.ry * 0.5 };
    }
    return { x: Math.cos(a) * 46, y: -2 + Math.sin(a) * 46 * 0.66 };
  }

  function drawPipingDot(ctx, p, t) {
    const r = (p.r || 15) * (p.scale === undefined ? 1 : p.scale);
    if (r <= 0.3) return;
    const col = p.color || '#FFFDF9';
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(92,61,46,0.12)';
    ell(ctx, 2, r * 0.5, r * 0.95, r * 0.5);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    // Rosette petals
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * PI2 + (p.seed || 0);
      circ(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.42 + r * 0.1, r * 0.46);
      ctx.fill();
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * PI2 + (p.seed || 0);
      circ(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.42 + r * 0.1, r * 0.46);
      ctx.stroke();
    }
    ctx.fillStyle = col;
    circ(ctx, 0, 0, r * 0.68);
    ctx.fill();
    // Spiral swirl
    ctx.strokeStyle = p.shadow || 'rgba(92,61,46,0.28)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const a = k * 0.42;
      const rad = r * 0.08 + k * r * 0.034;
      const px = Math.cos(a) * rad, py = Math.sin(a) * rad * 0.8 - r * 0.05;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // Peak + highlight
    ctx.fillStyle = col;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.1);
    ctx.quadraticCurveTo(-r * 0.05, -r * 0.9, r * 0.2, -r * 0.3);
    ctx.quadraticCurveTo(r * 0.3, 0, 0, r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.hi || 'rgba(255,255,255,0.7)';
    ell(ctx, -r * 0.2, -r * 0.3, r * 0.14, r * 0.08, -0.6);
    ctx.fill();
    ctx.restore();
  }

  function drawTopping(ctx, tp, t, spring) {
    const dropY = (spring && spring.y !== undefined) ? spring.y : (tp.dropY || 0);
    const sx = (spring && spring.scaleX) || tp.sx || 1;
    const sy = (spring && spring.scaleY) || tp.sy || 1;
    ctx.save();
    ctx.translate(tp.x, tp.y);
    if (dropY < -1) {
      // Airborne: ground shadow shrinks with height
      const h = clamp01(-dropY / 120);
      ctx.fillStyle = `rgba(92,61,46,${(0.18 * (1 - h)).toFixed(3)})`;
      ell(ctx, 0, 6, 12 * (1 - h * 0.5), 5 * (1 - h * 0.5));
      ctx.fill();
    }
    ctx.translate(0, dropY);
    ctx.scale(sx, sy);
    ctx.strokeStyle = OUTLINE;
    ctx.lineCap = 'round';
    if (tp.id === 'sprinkles') {
      const cols = ['#E87A82', '#F2C97D', '#8FB9A8', '#9B82C9', '#F4A261', '#7BC4E8'];
      for (let k = 0; k < 7; k++) {
        ctx.save();
        ctx.translate(Math.cos(k * 1.3 + tp.seed) * 15, Math.sin(k * 1.7 + tp.seed) * 10);
        ctx.rotate(k * 0.9 + tp.seed);
        ctx.fillStyle = cols[k % cols.length];
        rr(ctx, -6, -2.5, 12, 5, 2.5);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        rr(ctx, -4, -2, 5, 2, 1);
        ctx.fill();
        ctx.restore();
      }
    } else if (tp.id === 'stars') {
      ctx.fillStyle = '#F7C948';
      ctx.lineWidth = 1.6;
      star(ctx, 0, 0, 12, 5.5, 5, tp.seed);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFF6CC';
      circ(ctx, -3, -3, 2.2);
      ctx.fill();
    } else if (tp.id === 'hearts') {
      ctx.fillStyle = '#E87A82';
      ctx.lineWidth = 1.5;
      heart(ctx, 0, 0, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ell(ctx, -4, -4, 2.6, 1.6, -0.5);
      ctx.fill();
    } else if (tp.id === 'candle') {
      const stripeCols = ['#FF85B3', '#62B6FF', '#FFD166', '#8CE09A', '#C39BD3'];
      const stripeCol = tp.color || stripeCols[Math.abs(Math.floor((tp.seed || 0) * 7)) % stripeCols.length];
      // Fluted plastic/buttercream candle holder collar at base
      ctx.fillStyle = stripeCol;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      ell(ctx, 0, 2, 8.5, 4);
      ctx.fill();
      ctx.stroke();
      // Wax cylinder body
      ctx.fillStyle = '#FFFDF9';
      ctx.lineWidth = 2;
      rr(ctx, -6, -28, 12, 30, 3);
      ctx.fill();
      ctx.stroke();
      // Diagonal candy stripes clipped to candle body
      ctx.save();
      rr(ctx, -5.5, -27.5, 11, 29, 2.5);
      ctx.clip();
      ctx.strokeStyle = stripeCol;
      ctx.lineWidth = 3.2;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(-7, -23 + k * 8.5);
        ctx.lineTo(7, -28 + k * 8.5);
        ctx.stroke();
      }
      ctx.restore();
      // Wick
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(0, -33);
      ctx.stroke();
      if (!tp.blownOut) {
        const flick = Math.sin(t * 14 + (tp.seed || 0)) * 2.5;
        const lean = Math.sin(t * 9 + (tp.seed || 0)) * 1.5;
        ctx.fillStyle = 'rgba(255, 200, 90, 0.24)';
        circ(ctx, 0, -39, 15 + flick);
        ctx.fill();
        ctx.fillStyle = '#F5A623';
        ctx.beginPath();
        ctx.moveTo(lean, -49 + flick);
        ctx.quadraticCurveTo(9, -36, 0, -30);
        ctx.quadraticCurveTo(-9, -36, lean, -49 + flick);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFF29C';
        ctx.beginPath();
        ctx.moveTo(lean * 0.5, -43 + flick * 0.5);
        ctx.quadraticCurveTo(4, -35, 0, -31);
        ctx.quadraticCurveTo(-4, -35, lean * 0.5, -43 + flick * 0.5);
        ctx.fill();
      } else {
        // Glowing warm ember tip on the extinguished wick
        ctx.fillStyle = '#FF6B35';
        circ(ctx, 0, -33, 2.1);
        ctx.fill();
        // Curling multi-puff smoke plume + rising wish clouds
        const age = tp.blownAt ? Math.max(0, t - tp.blownAt) : (t % 3);
        const drift = Math.sin(t * 3.5 + (tp.seed || 0)) * 4;
        ctx.strokeStyle = 'rgba(155, 145, 140, 0.62)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(0, -34);
        ctx.quadraticCurveTo(5 + drift * 0.5, -44, -1 + drift, -54);
        ctx.quadraticCurveTo(-6 + drift, -63, 3 + drift * 1.2, -73);
        ctx.stroke();
        for (let pIdx = 0; pIdx < 3; pIdx++) {
          const ph = ((age * 0.85 + pIdx * 0.33) % 1);
          const py = -36 - ph * 42;
          const px = Math.sin(ph * PI2 + (tp.seed || 0) + pIdx) * (4 + ph * 6);
          const pr = (3.5 + ph * 6.5) * (1 - ph * 0.35);
          ctx.fillStyle = `rgba(210, 202, 198, ${(0.55 * (1 - ph)).toFixed(3)})`;
          circ(ctx, px, py, pr);
          ctx.fill();
        }
      }
    } else if (tp.id === 'candy_balls') {
      const seedIdx = Math.abs(Math.floor(tp.seed || 0)) % RAINBOW_6.length;
      drawSpecularCandyBall(ctx, 0, 0, 10, safeColor(tp.color, RAINBOW_6[seedIdx]));
    } else if (tp.id === 'rainbow_arch') {
      drawRainbowArchFigurine(ctx, 0, -12, 0.75);
    } else if (tp.id === 'flower_pot') {
      drawYellowSunflowerPot(ctx, 0, -6, 0.65);
    } else if (tp.ingredient || /_(top|slice)$/.test(tp.id || '')) {
      // Fresh fruit slice toppings (berry_top, kiwi_slice, banana_slice, ...): real ingredient art
      const ingId = tp.ingredient || String(tp.id).replace(/_(top|slice)$/, '');
      const meta = KitchenData.getIngredient(ingId);
      if (meta && meta.id === ingId) {
        drawIngredient(ctx, meta.id, 0, 0, 14, { sliced: ingId !== 'blueberry', shadow: false, rot: (tp.seed || 0) * 0.3 });
      } else {
        drawIngredient(ctx, 'strawberry', 0, 0, 14, { sliced: true, shadow: false });
      }
    } else if (tp.id === 'cherry') {
      ctx.strokeStyle = '#4E8C58';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.quadraticCurveTo(4, -22, 14, -26);
      ctx.stroke();
      ctx.fillStyle = '#78C47C';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      ell(ctx, 16, -27, 7, 3.5, -0.4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#D63A4E';
      circ(ctx, 0, 2, 10);
      ctx.fill();
      ctx.stroke();
      gloss(ctx, -3.5, -2, 3, 2, -0.5, 0.6);
    } else if (tp.id === 'umbrella') {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(0, -30);
      ctx.stroke();
      const cols = ['#E87A82', '#F7C948', '#8FB9A8', '#C4A8E0'];
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = cols[k];
        ctx.beginPath();
        ctx.moveTo(0, -32);
        ctx.arc(0, -32, 24, PI + k * (PI / 4), PI + (k + 1) * (PI / 4));
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, -32, 24, PI, 0);
      ctx.stroke();
    } else {
      drawIngredient(ctx, 'strawberry', 0, 0, 14, { sliced: false, shadow: false });
    }
    ctx.restore();
  }

  function drawPlate(ctx) {
    softShadow(ctx, 0, 24, 140, 92, 0.2);
    const pg = ctx.createRadialGradient(-20, -10, 20, 0, 8, 140);
    pg.addColorStop(0, '#FFFFFF');
    pg.addColorStop(0.75, '#FFFDF9');
    pg.addColorStop(1, '#F3E8DC');
    ctx.fillStyle = pg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    ell(ctx, 0, 8, 138, 94);
    ctx.fill();
    ctx.stroke();
    // Scalloped inner rim
    ctx.strokeStyle = '#F2C6B8';
    ctx.lineWidth = 2.4;
    ell(ctx, 0, 8, 110, 73);
    ctx.stroke();
    ctx.fillStyle = '#F2C6B8';
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * PI2;
      circ(ctx, Math.cos(a) * 122, 8 + Math.sin(a) * 82, 2.4);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(214, 170, 120, 0.6)';
    ctx.lineWidth = 1.6;
    ell(ctx, 0, 8, 128, 86);
    ctx.stroke();
  }

  /* ---------- Freshly baked layer cake: 100% ingredient-driven ---------- */
  /** Sponge bands for the side wall / cut faces: bottom -> top. */
  function spongeBands(layerColors) {
    const n = layerColors.length;
    if (n >= 3) return layerColors.slice(0, 6);
    if (n === 2) return [layerColors[0], layerColors[1], layerColors[0], layerColors[1]];
    return [layerColors[0], layerColors[0], layerColors[0]];
  }
  /** Glaze state derived from what the player actually poured in Station 4. */
  function cakeGlaze(dish) {
    const sauces = (dish.sauces || []).filter(st => st && st.pts && st.pts.length);
    const explicit = typeof dish.glazeProgress === 'number' ? clamp01(dish.glazeProgress) : null;
    const coverage = explicit !== null ? explicit : clamp01(sauces.length * 0.34);
    const last = sauces.length ? sauces[sauces.length - 1] : null;
    const color = last ? safeColor(last.color, deriveFrostingColor(dish)) : null;
    return { sauces, coverage, color };
  }
  function drawLayerCakeBody(ctx, dish, t, angle) {
    const g = cakeGeom(dish);
    const layers = deriveLayerColors(dish);
    const bands = spongeBands(layers);
    const frosting = safeColor(deriveFrostingColor(dish), VANILLA_CREAM);
    const glaze = cakeGlaze(dish);
    const topCol = glaze.color && glaze.coverage > 0 ? lerpColor(frosting, glaze.color, clamp01(glaze.coverage * 1.6)) : frosting;
    const bottomY = g.cy + g.H;

    // Contact shadow on the turntable
    softShadow(ctx, 0, bottomY + g.ry * 0.55, g.R * 1.08, g.ry * 0.95, 0.2);

    // Side wall: sponge bands with cream filling between them (real ingredient colours)
    ctx.save();
    cakeSidePath(ctx, g);
    ctx.clip();
    const bandH = g.H / bands.length;
    for (let i = 0; i < bands.length; i++) {
      const col = bands[bands.length - 1 - i];      // top band first
      const y0 = g.cy + i * bandH;
      const sg = ctx.createLinearGradient(-g.R, 0, g.R, 0);
      sg.addColorStop(0, darken(col, 0.22));
      sg.addColorStop(0.3, lighten(col, 0.08));
      sg.addColorStop(0.62, col);
      sg.addColorStop(1, darken(col, 0.3));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(-g.R - 2, y0 - 2);
      ctx.lineTo(g.R + 2, y0 - 2);
      ctx.lineTo(g.R + 2, y0 + bandH + g.ry + 2);
      ctx.lineTo(-g.R - 2, y0 + bandH + g.ry + 2);
      ctx.closePath();
      ctx.fill();
      // Cream filling seam following the ellipse curvature
      if (i > 0) {
        ctx.strokeStyle = rgba(VANILLA_CREAM, 0.92);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, y0, g.R, g.ry, 0, 0.04, PI - 0.04);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(92,61,46,0.16)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, y0 + 2.2, g.R, g.ry, 0, 0.1, PI - 0.1);
        ctx.stroke();
      }
    }
    // Soft crumb texture on the sponge
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let k = 0; k < 26; k++) {
      const px = (hash(k + 11) - 0.5) * g.R * 1.9;
      const py = g.cy + 6 + hash(k + 23) * (g.H + g.ry - 10);
      circ(ctx, px, py, 1.2 + hash(k + 5) * 1.6);
      ctx.fill();
    }
    // Thin naked-cake crumb coat of the base frosting (sponge colours stay visible)
    const coatA = 0.26 + 0.6 * glaze.coverage;
    const cg = ctx.createLinearGradient(-g.R, 0, g.R, 0);
    cg.addColorStop(0, rgba(darken(frosting, 0.18), coatA));
    cg.addColorStop(0.35, rgba(lighten(frosting, 0.1), coatA * 0.85));
    cg.addColorStop(1, rgba(darken(frosting, 0.26), coatA));
    ctx.fillStyle = cg;
    ctx.fillRect(-g.R - 2, g.cy - 2, g.R * 2 + 4, g.H + g.ry + 6);
    ctx.restore();

    // Side wall outline
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    cakeSidePath(ctx, g);
    ctx.stroke();

    // Smooth frosted top surface (base frosting -> poured glaze colour)
    const tg = ctx.createRadialGradient(-g.R * 0.3, g.cy - g.ry * 0.35, 4, 0, g.cy, g.R);
    tg.addColorStop(0, lighten(topCol, 0.3));
    tg.addColorStop(0.7, topCol);
    tg.addColorStop(1, darken(topCol, 0.14));
    ctx.fillStyle = tg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ell(ctx, 0, g.cy, g.R, g.ry);
    ctx.fill();
    ctx.stroke();
    // Spread-spatula swirl on the frosting
    ctx.strokeStyle = rgba(darken(topCol, 0.25), 0.22);
    ctx.lineWidth = 1.6;
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath();
      ctx.ellipse(0, g.cy, g.R * (0.22 * k), g.ry * (0.22 * k), 0, 0.3 - angle * 0.5, PI * 1.5 - angle * 0.5);
      ctx.stroke();
    }
    // Glossy highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(0, g.cy, g.R * 0.82, g.ry * 0.74, 0, PI * 1.12, PI * 1.55);
    ctx.stroke();

    // Poured glaze: glossy drips exactly where the player poured (rotate with the turntable)
    if (glaze.sauces.length && glaze.coverage > 0) {
      let dripN = 0;
      const dripCol = glaze.color;
      glaze.sauces.forEach((st, si) => {
        st.pts.forEach((p, pi) => {
          if (pi % 2 || dripN > 42) return;
          const sp = cakeSurfacePoint(g, { x: p.x, y: p.y, angle: st.angle || 0 });
          const a = sp.aw - angle;
          const sn = Math.sin(a);
          if (sn < -0.02) return;
          const x = Math.cos(a) * g.R * 0.97;
          const y = g.cy + sn * g.ry;
          const len = 10 + hash(si * 7 + pi) * 24 + glaze.coverage * 10;
          const w = 6 + hash(pi + 3) * 5;
          ctx.fillStyle = dripCol;
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 1.6;
          rr(ctx, x - w / 2, y - 2, w, len, w / 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          rr(ctx, x - w / 2 + 1.5, y + 1, w * 0.3, len * 0.55, 1.5);
          ctx.fill();
          dripN++;
        });
      });
      // Thick glaze lip around the top edge
      ctx.strokeStyle = dripCol;
      ctx.lineWidth = 5 + glaze.coverage * 4;
      ctx.beginPath();
      ctx.ellipse(0, g.cy + 1, g.R, g.ry, 0, 0.02, PI - 0.02);
      ctx.stroke();
    }

    // Velcro birthday cake slice seams & interior cross-section with velcro pads (Slice 8)
    const velcroSlices = clamp(Math.floor(dish.velcroSlices || 0), 0, 6);
    if (velcroSlices > 0) {
      for (let sIdx = 0; sIdx < velcroSlices; sIdx++) {
        const a = (sIdx / 6) * PI2 + 0.35 - angle;
        const rx = Math.cos(a) * g.R;
        const ry = g.cy + Math.sin(a) * g.ry;
        // Exposed sponge layer cross-section along the slightly parted wedge cut
        const gapW = 3.2;
        const nx = -Math.sin(a) * gapW;
        const ny = Math.cos(a) * gapW * (g.ry / g.R);
        for (let bIdx = 0; bIdx < bands.length; bIdx++) {
          const bCol = bands[bands.length - 1 - bIdx];
          ctx.strokeStyle = darken(bCol, 0.08);
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(nx * 0.3, g.cy + bIdx * 1.4 + ny * 0.3);
          ctx.lineTo(rx + nx * 0.5, ry + bIdx * 1.4 + ny * 0.5);
          ctx.stroke();
        }
        // Crisp cocoa cut seam across top surface
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, g.cy);
        ctx.lineTo(rx, ry);
        ctx.stroke();
        // If rim point is on the visible front wall (sin(a) > 0.02), draw vertical side cut + white velcro pad
        if (Math.sin(a) > 0.02) {
          for (let bIdx = 0; bIdx < bands.length; bIdx++) {
            const bCol = bands[bands.length - 1 - bIdx];
            const y0 = ry + bIdx * bandH;
            ctx.fillStyle = darken(bCol, 0.12);
            ctx.fillRect(rx - 2.4, y0, 4.8, bandH + 0.5);
          }
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx, ry + g.H);
          ctx.stroke();
          // Round white hook-and-loop velcro patch on the wedge cut face
          const vx = rx * 0.62;
          const vy = (g.cy + ry) * 0.5 + 3;
          ctx.fillStyle = '#FFFDF9';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 1.5;
          ell(ctx, vx, vy, 5.2, 3.4, a);
          ctx.fill();
          ctx.stroke();
          ctx.save();
          ctx.strokeStyle = 'rgba(150, 140, 130, 0.75)';
          ctx.lineWidth = 1;
          ctx.setLineDash([1.6, 1.6]);
          ell(ctx, vx, vy, 3.2, 2.0, a);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    return g;
  }

  /** Items decorating the cake: fruit slices from the batter ingredients arranged on
   *  top, rotating with the turntable. Nothing is invented; neutral bases draw nothing. */
  function drawCakeTopFruit(ctx, dish, g, angle, t) {
    const ids = [];
    (dish.items || []).forEach(it => {
      if (isNeutralId(it.id) || ids.indexOf(it.id) >= 0) return;
      ids.push(it.id);
    });
    if (!ids.length) return;
    const total = Math.min(8, Math.max(ids.length, ids.length * (ids.length === 1 ? 6 : 3)));
    const placed = [];
    for (let i = 0; i < total; i++) {
      const id = ids[i % ids.length];
      const a = (i / total) * PI2 - angle + 0.4;
      const rad = 0.66;
      const x = Math.cos(a) * rad * g.R;
      const y = g.cy + Math.sin(a) * rad * g.ry;
      placed.push({ id, x, y, a, i });
    }
    placed.sort((p, q) => p.y - q.y);
    placed.forEach(p => {
      const choco = isChocoId(p.id);
      const sz = choco ? 9 : 13;
      drawIngredient(ctx, p.id, p.x, p.y - 4, sz, {
        sliced: !choco && p.id !== 'blueberry' && p.id !== 'popcandy', shadow: false,
        rot: (p.i % 2 ? 0.35 : -0.25) + Math.sin(p.a) * 0.15, scaleY: 0.85,
      });
    });
  }

  /** Every decoration the player actually placed, mapped onto the 3D cylinder and
   *  depth-sorted (balls via tweezers, rosettes via piping bag, toppers, dollops). */
  function drawCakeDecorations(ctx, dish, g, angle, t, opts) {
    const placing = opts && opts.placing;
    const balls = dish.candyBalls || [];
    const roses = dish.rosettes || [];
    const taken = {};
    const key = e => `${(e.x || 0).toFixed(1)},${(e.y || 0).toFixed(1)}`;
    const list = [];
    balls.forEach((b, i) => {
      taken[key(b)] = 1;
      const sp = cakeSurfacePoint(g, b);
      const pos = cakeSurfaceXY(g, sp, angle);
      if (!pos.visible) return;
      let sc = (b.scale === undefined ? 1 : clamp01(b.scale)) * pos.depth;
      if (placing && placing.kind === 'candy' && i === balls.length - 1) sc *= easeOutBack(seg(placing.t, 0.35, 0.85));
      if (sc <= 0.02) return;
      list.push({ y: pos.y + (sp.top ? 0 : 6), draw: () => drawSpecularCandyBall(ctx, pos.x, pos.y, 8.6 * sc, safeColor(b.color, RAINBOW_6[i % 6])) });
    });
    roses.forEach((r, i) => {
      taken[key(r)] = 1;
      const sp = cakeSurfacePoint(g, r);
      const pos = cakeSurfaceXY(g, sp, angle);
      if (!pos.visible) return;
      let sc = (r.scale === undefined ? 1 : clamp01(r.scale)) * pos.depth;
      if (placing && placing.kind === 'piping' && i === roses.length - 1) sc *= easeOutBack(seg(placing.t, 0.25, 0.8));
      if (sc <= 0.02) return;
      list.push({ y: pos.y + (sp.top ? 0 : 6), draw: () => drawButtercreamRosette(ctx, pos.x, pos.y, (r.r || 9) * 0.82 * sc, safeColor(r.color, '#FF85B3')) });
    });
    (dish.piping || []).forEach(p => {
      if (taken[key(p)]) return;
      const sp = cakeSurfacePoint(g, p);
      const pos = cakeSurfaceXY(g, sp, angle);
      if (!pos.visible) return;
      const sc = (p.scale === undefined ? 1 : clamp01(p.scale)) * pos.depth;
      if (sc <= 0.02) return;
      list.push({ y: pos.y + (sp.top ? 0 : 6), draw: () => drawPipingDot(ctx, Object.assign({}, p, { x: pos.x, y: pos.y, r: (p.r || 12) * 0.75, scale: sc }), t) });
    });
    const springs = (opts && opts.toppingSprings) || dish.toppingSprings || null;
    (dish.toppings || []).forEach((tp, i) => {
      if (taken[key(tp)]) return;
      // Toppers always sit on the top face (they cannot cling to the side wall)
      const sp = cakeSurfacePoint(g, tp);
      if (!sp.top) { sp.top = true; sp.rad = 0.86; }
      const pos = cakeSurfaceXY(g, sp, angle);
      list.push({ y: pos.y, draw: () => drawTopping(ctx, Object.assign({}, tp, { x: pos.x, y: pos.y }), t, springs ? springs[i] : null) });
    });
    list.sort((p, q) => p.y - q.y);
    list.forEach(e => e.draw());
  }

  function drawDishBase(ctx, dish, t) {
    const hasBurger = dish.items.some(it => it.id === 'bun') || dish.burgerStack;
    const hasBento = dish.items.some(it => it.id === 'maki' || it.id === 'kettle_tea') || dish.bentoBox;
    const hasPizza = dish.items.some(it => it.id === 'pizzabase');
    const hasPancake = dish.items.some(it => it.id === 'dough') && !dish.bakedCake;
    const cooked = Math.max(0, ...dish.items.map(it => it.cooked || 0));

    if (isCakeDish(dish)) {
      const angle = dish.turntableAngle || 0;
      drawLayerCakeBody(ctx, dish, t, angle);
    } else if (hasBento) {
      // Slice 7 (36:00-42:00): Lacquered Wooden Bento Box with Compartment Dividers, Maki Cross-Sections, Ginger/Wasabi & Teacup
      ctx.save();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      // Outer red-cocoa lacquered wooden bento frame
      ctx.fillStyle = '#B84A39';
      rr(ctx, -96, -54, 192, 112, 16);
      ctx.fill();
      ctx.stroke();
      // Warm cedar wood interior tray
      ctx.fillStyle = '#E6BF8A';
      rr(ctx, -86, -44, 172, 92, 10);
      ctx.fill();
      ctx.stroke();
      // T-shaped wooden compartment dividers
      ctx.fillStyle = '#B84A39';
      rr(ctx, -10, -44, 10, 92, 3);
      ctx.fill();
      ctx.stroke();
      rr(ctx, 0, -4, 86, 9, 3);
      ctx.fill();
      ctx.stroke();
      // Left main compartment: Baran green grass divider + 4 Sliced Maki Sushi Rolls
      ctx.fillStyle = '#5CB868';
      ctx.beginPath();
      ctx.moveTo(-82, 34);
      for (let k = 0; k < 7; k++) {
        ctx.lineTo(-80 + k * 10, k % 2 === 0 ? 22 : 34);
      }
      ctx.lineTo(-14, 34);
      ctx.closePath();
      ctx.fill();
      const makiPts = [[-62, -18], [-32, -18], [-62, 14], [-32, 14]];
      makiPts.forEach(([mx, my], idx) => {
        drawIngredient(ctx, 'maki', mx, my, 17, { sliced: true, shadow: false, rot: idx * 0.2 });
      });
      // Top-right compartment: Pickled pink ginger (gari), wasabi leaf & tempura shrimp / tamago
      ctx.fillStyle = '#F7A8B8';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      ell(ctx, 24, -24, 14, 9, -0.3);
      ctx.fill();
      ctx.stroke();
      ell(ctx, 32, -20, 12, 8, 0.2);
      ctx.fill();
      ctx.stroke();
      // Wasabi dollop
      ctx.fillStyle = '#8BC34A';
      circ(ctx, 62, -22, 9);
      ctx.fill();
      ctx.stroke();
      // Bottom-right compartment: Steaming ceramic teacup poured from whistling kettle
      ctx.fillStyle = '#FFFDF9';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      ell(ctx, 44, 22, 22, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9CCC65';
      ell(ctx, 44, 20, 17, 11);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.8;
      for (let s = 0; s < 2; s++) {
        const sx = 38 + s * 12;
        const wave = Math.sin(t * 3 + s) * 3;
        ctx.beginPath();
        ctx.moveTo(sx, 12);
        ctx.quadraticCurveTo(sx + wave, 2, sx - wave, -8);
        ctx.stroke();
      }
      ctx.restore();
    } else if (hasPancake) {
      for (let layer = 0; layer < 3; layer++) {
        const ly = 16 - layer * 15;
        const brown = lerpColor('#F2C97D', '#D9892F', clamp01(cooked));
        ctx.fillStyle = darken(brown, 0.18);
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.8;
        ell(ctx, 0, ly, 86 - layer * 3, 50 - layer * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = brown;
        ell(ctx, 0, ly - 5, 86 - layer * 3, 48 - layer * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = lighten(brown, 0.3);
        blob(ctx, -4, ly - 7, 58 - layer * 3, 30 - layer * 2, layer * 2.1 + 1, 0.1, 14);
        ctx.fill();
      }
      // Syrup drizzle
      ctx.fillStyle = 'rgba(214, 140, 50, 0.85)';
      blob(ctx, 4, -14, 36, 18, 5.5, 0.22, 14);
      ctx.fill();
      for (let k = 0; k < 4; k++) {
        const dx = -40 + k * 26;
        rr(ctx, dx - 4, -8, 8, 12 + hash(k + 6) * 16, 4);
        ctx.fill();
      }
      // Butter pat
      ctx.fillStyle = '#FFF29C';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      rr(ctx, -15, -30, 30, 18, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      rr(ctx, -11, -27, 12, 5, 2.5);
      ctx.fill();
    } else if (hasBurger) {
      // Slice 7 (36:00-42:00): Multi-Layer Cheeseburger with Condiments (Bottom Bun, Ruffled Lettuce, Juicy Tomato, Seared Patty, Melted Cheese, Extra Layers, Ketchup & Mustard Ribbons, Sesame Crown Bun)
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      // 1. Toasted bottom brioche bun
      ctx.fillStyle = '#DE923B';
      ell(ctx, 0, 32, 84, 25);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F7DFB5';
      ell(ctx, 0, 26, 78, 18);
      ctx.fill();
      // 2. Crisp ruffled lettuce leaf
      ctx.fillStyle = '#72C276';
      for (let k = 0; k < 12; k++) {
        const a = (k * PI2) / 12;
        circ(ctx, Math.cos(a) * 76, 18 + Math.sin(a) * 18, 13);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#88D48C';
      ell(ctx, 0, 18, 72, 18);
      ctx.fill();
      // 3. Juicy ruby tomato slices
      ctx.fillStyle = '#E35242';
      ell(ctx, -22, 10, 46, 15);
      ctx.fill();
      ctx.stroke();
      ell(ctx, 22, 10, 46, 15);
      ctx.fill();
      ctx.stroke();
      // 4. Seared beef patty with char grill marks
      ctx.fillStyle = '#7A3B22';
      ell(ctx, 0, -1, 82, 22);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(42, 18, 8, 0.55)';
      ctx.lineWidth = 2.6;
      for (let g = -2; g <= 2; g++) {
        ctx.beginPath();
        ctx.moveTo(g * 18 - 8, -9);
        ctx.lineTo(g * 18 + 8, 5);
        ctx.stroke();
      }
      // 5. Melted cheddar cheese slice with draped corners
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.6;
      ctx.fillStyle = '#FFC424';
      ctx.beginPath();
      ctx.moveTo(-78, -8);
      ctx.lineTo(78, -8);
      ctx.lineTo(70, 7);
      ctx.lineTo(40, 2);
      ctx.lineTo(20, 15);
      ctx.lineTo(-10, 4);
      ctx.lineTo(-44, 13);
      ctx.lineTo(-70, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 6. Optional extra savory layers (crispy bacon strips / sunny egg) if added
      const hasBacon = dish.items.some(it => it.id === 'bacon');
      const hasEgg = dish.items.some(it => it.id === 'egg');
      if (hasBacon) {
        ctx.fillStyle = '#C94A38';
        rr(ctx, -56, -15, 112, 9, 4);
        ctx.fill();
        ctx.stroke();
      }
      if (hasEgg) {
        ctx.fillStyle = '#FFFDF9';
        ell(ctx, 0, -14, 54, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFA726';
        ell(ctx, 0, -16, 22, 8);
        ctx.fill();
      }
      // 7. Glossy wavy Ketchup (#E3392B) & Mustard (#F5C422) condiment ribbons
      const squirts = [
        { col: '#E3392B', yOff: -12, phase: 0 },
        { col: '#F5C422', yOff: -16, phase: 1.6 },
      ];
      squirts.forEach(sq => {
        ctx.strokeStyle = sq.col;
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        for (let x = -58; x <= 58; x += 6) {
          const y = sq.yOff + Math.sin(x * 0.12 + sq.phase) * 4;
          if (x === -58) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      // 8. Fluffy golden sesame crown bun
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      ctx.fillStyle = '#E8A352';
      ctx.beginPath();
      ctx.ellipse(0, -20, 86, 35, 0, PI, 0);
      ctx.quadraticCurveTo(86, -6, 0, -6);
      ctx.quadraticCurveTo(-86, -6, -86, -20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      gloss(ctx, -34, -36, 26, 10, -0.25, 0.38);
      ctx.fillStyle = '#FFF5CC';
      [[-40, -33], [-14, -43], [16, -41], [44, -31], [-28, -21], [6, -25], [34, -19]].forEach(([sx, sy]) => {
        ell(ctx, sx, sy, 4.5, 2.4, sx * 0.01);
        ctx.fill();
      });
    } else if (hasPizza) {
      ctx.fillStyle = '#E6A04B';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      ell(ctx, 0, 4, 98, 66);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F2C27A';
      ell(ctx, 0, 2, 86, 56);
      ctx.fill();
      ctx.fillStyle = '#E35242';
      ell(ctx, 0, 4, 80, 52);
      ctx.fill();
      ctx.fillStyle = cooked > 0.4 ? '#FFD86B' : '#FFEA8C';
      blob(ctx, 0, 4, 72, 46, 2.4, 0.08, 16);
      ctx.fill();
      ctx.fillStyle = 'rgba(230, 150, 60, 0.5)';
      for (let k = 0; k < 8; k++) {
        circ(ctx, (hash(k) - 0.5) * 120, 4 + (hash(k + 5) - 0.5) * 70, 4 + hash(k + 9) * 4);
        ctx.fill();
      }
      ctx.fillStyle = '#68B878';
      [[-30, -10], [26, 18], [10, -26], [-20, 24], [40, -8]].forEach(([lx, ly]) => {
        ell(ctx, lx, ly, 9, 5, lx * 0.03);
        ctx.fill();
      });
    }
  }

  function drawDishContent(ctx, dish, t, opts) {
    drawDishBase(ctx, dish, t);
    const cake = isCakeDish(dish);

    if (cake) {
      // Baked layer cake: real fruit from the batter on top + only the decorations the
      // player actually placed (candy balls, rosettes, dollops, toppers). No pre-population.
      const g = cakeGeom(dish);
      const angle = dish.turntableAngle || 0;
      drawCakeTopFruit(ctx, dish, g, angle, t);
      drawCakeDecorations(ctx, dish, g, angle, t, opts);
      return;
    }

    // Flat plate: pan-cooked fruit melts into a glossy jam puddle in its own colour
    const jamIds = [];
    dish.items.forEach(it => {
      if ((it.cooked || 0) > 0.45 && !isNeutralId(it.id) && it.id !== 'bun' && it.id !== 'pizzabase' && jamIds.indexOf(it.id) < 0) jamIds.push(it.id);
    });
    if (jamIds.length && !dish.items.some(it => it.id === 'bun' || it.id === 'pizzabase' || it.id === 'dough')) {
      const jam = avgColors(jamIds.map(spongeColorFor));
      ctx.fillStyle = rgba(jam, 0.8);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      blob(ctx, 0, 6, 70, 40, 3.3, 0.14, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ell(ctx, -22, -6, 16, 6, -0.3);
      ctx.fill();
    }

    dish.items.forEach(it => {
      if (it.id === 'dough' || it.id === 'pizzabase') return;
      drawIngredient(ctx, it.id, it.x || 0, it.y || 0, it.r || 32, {
        sliced: it.sliced,
        cooked: it.cooked,
        cracked: it.cracked,
        rot: it.rot || 0,
        scaleX: it.sx, scaleY: it.sy,
      });
    });

    (dish.sauces || []).forEach(stroke => {
      if (!stroke.pts || stroke.pts.length < 2) return;
      const scol = safeColor(stroke.color, '#FF2B5E');
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = rgba(scol, 0.35) || scol;
      ctx.lineWidth = 14;
      ctx.beginPath();
      stroke.pts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y + 3);
        else ctx.lineTo(p.x, p.y + 3);
      });
      ctx.stroke();
      ctx.strokeStyle = scol;
      ctx.lineWidth = 12;
      ctx.beginPath();
      stroke.pts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.strokeStyle = stroke.hi || 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      stroke.pts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x - 2, p.y - 3);
        else ctx.lineTo(p.x - 2, p.y - 3);
      });
      ctx.stroke();
      ctx.restore();
    });

    (dish.candyBalls || []).forEach((b, i) => drawSpecularCandyBall(ctx, b.x || 0, b.y || 0, 9 * (b.scale === undefined ? 1 : clamp01(b.scale)), safeColor(b.color, RAINBOW_6[i % 6])));
    (dish.rosettes || []).forEach(r => drawButtercreamRosette(ctx, r.x || 0, r.y || 0, (r.r || 12) * (r.scale === undefined ? 1 : clamp01(r.scale)), safeColor(r.color, '#FF85B3')));
    (dish.piping || []).forEach(p => drawPipingDot(ctx, p, t));

    const springs = (opts && opts.toppingSprings) || dish.toppingSprings || null;
    (dish.toppings || []).forEach((tp, i) => drawTopping(ctx, tp, t, springs ? springs[i] : null));
  }

  function drawCrumbs(ctx, idx, seed, dish) {
    const a1 = PORTION_A0 + idx * (PI2 / 3);
    const cake = isCakeDish(dish);
    const crumbCol = cake ? rgba(darken(deriveLayerColors(dish)[0], 0.1), 0.8) : 'rgba(214, 150, 80, 0.75)';
    const cyOff = cake ? cakeGeom(dish).cy + cakeGeom(dish).H * 0.9 : -2;
    const ryK = cake ? 0.5 : 0.66;
    ctx.fillStyle = crumbCol;
    for (let k = 0; k < 6; k++) {
      const a = a1 + 0.3 + hash(k + seed) * (PI2 / 3 - 0.6);
      const rad = (cake ? 40 : 22) + hash(k + seed + 9) * 50;
      blob(ctx, Math.cos(a) * rad, cyOff + Math.sin(a) * rad * ryK, 2.6, 2, k + seed, 0.3, 7);
      ctx.fill();
    }
    ctx.fillStyle = cake ? rgba(deriveFrostingColor(dish), 0.3) : 'rgba(232, 150, 130, 0.22)';
    ell(ctx, Math.cos(a1 + PI / 3) * 36, cyOff + Math.sin(a1 + PI / 3) * 24, 22, 10, a1 + PI / 3);
    ctx.fill();
  }

  function drawDish(ctx, dish, cx, cy, scale, t, opts) {
    scale = scale || 1;
    t = t || 0;
    opts = opts || {};
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const isCup = dish.vessel === 'cup';
    const bites = clamp(Math.floor(dish.bitesTaken || 0), 0, 3);
    const scoopP = clamp01(opts.scoopProgress || 0);

    if (isCup) {
      softShadow(ctx, 0, 92, 66, 16, 0.2);
      // Glass back
      ctx.fillStyle = 'rgba(248, 252, 255, 0.7)';
      ctx.beginPath();
      ctx.moveTo(-64, -60);
      ctx.lineTo(-49, 83);
      ctx.quadraticCurveTo(0, 98, 49, 83);
      ctx.lineTo(64, -60);
      ctx.closePath();
      ctx.fill();

      const sip = Math.min(0.78, bites * 0.24 + scoopP * 0.24);
      const topY = -52 + sip * 118;
      const liqColor = dish.liquidColor || '#F4A6B8';
      const grad = ctx.createLinearGradient(0, topY, 0, 85);
      grad.addColorStop(0, lighten(liqColor, 0.32));
      grad.addColorStop(1, liqColor);
      ctx.fillStyle = grad;
      const topW = 62 - sip * 12;
      const slosh = Math.sin(t * 2.4) * 2;
      ctx.beginPath();
      ctx.moveTo(-topW, topY + slosh);
      ctx.lineTo(-48, 82);
      ctx.quadraticCurveTo(0, 96, 48, 82);
      ctx.lineTo(topW, topY - slosh);
      ctx.quadraticCurveTo(0, topY + 8, -topW, topY + slosh);
      ctx.closePath();
      ctx.fill();
      // Surface ellipse
      ctx.fillStyle = lighten(liqColor, 0.45);
      ell(ctx, 0, topY, topW, 9);
      ctx.fill();
      // Milk swirl ribbons
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        const yy = topY + 20 + k * 20;
        if (yy > 78) break;
        ctx.moveTo(-34, yy);
        ctx.bezierCurveTo(-10, yy - 8 + Math.sin(t * 2 + k) * 3, 10, yy + 8, 34, yy);
        ctx.stroke();
      }
      // Rising bubbles
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let k = 0; k < 6; k++) {
        const ph = (t * 0.25 + hash(k)) % 1;
        const by = 80 - ph * (80 - topY);
        circ(ctx, (hash(k + 3) - 0.5) * 70, by, 1.5 + hash(k + 7) * 2);
        ctx.fill();
      }

      const hasBoba = dish.items.some(it => it.id === 'boba');
      if (hasBoba) {
        [[-32, 68], [-16, 74], [0, 70], [18, 75], [32, 67], [-24, 54], [-6, 58], [14, 56], [28, 53]].forEach(([px, py], i) => {
          const bob = Math.sin(t * 2 + i) * 1.2;
          ctx.fillStyle = '#4A2A1C';
          circ(ctx, px, py + bob, 8.5);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          circ(ctx, px - 2.5, py - 2.5 + bob, 2.5);
          ctx.fill();
        });
      }

      // Whipped cream dome if icecream / piping present
      const hasCream = dish.items.some(it => it.id === 'icecream') || (dish.piping && dish.piping.length > 0);
      if (hasCream && bites < 3) {
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.5;
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * PI2;
          circ(ctx, Math.cos(a) * 30, -62 + Math.sin(a) * 8, 16);
          ctx.fill();
        }
        ell(ctx, 0, -66, 44, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(92,61,46,0.25)';
        ctx.lineWidth = 1.5;
        ell(ctx, 0, -66, 44, 16);
        ctx.stroke();
      }

      // Items drawn floating near the top (fruit chunks)
      dish.items.forEach((it, i) => {
        if (it.id === 'milk' || it.id === 'boba' || it.id === 'dough' || it.id === 'icecream') return;
        const fy = clamp(topY + 14 + i * 6, topY + 10, 70);
        drawIngredient(ctx, it.id, (it.x || 0) * 0.5, fy + Math.sin(t * 2 + i) * 1.5, 14, {
          sliced: true, shadow: false, rot: it.rot || 0,
        });
      });

      (dish.piping || []).forEach(p => drawPipingDot(ctx, Object.assign({}, p, { y: Math.min(p.y, -40) }), t));
      (dish.toppings || []).forEach((tp, i) => drawTopping(ctx, Object.assign({}, tp, { y: Math.min(tp.y, -58) }), t, opts.toppingSprings ? opts.toppingSprings[i] : null));

      // Striped straw
      ctx.save();
      ctx.translate(22, -75);
      ctx.rotate(0.18);
      ctx.fillStyle = '#FFFDF9';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      rr(ctx, -7, -65, 14, 115, 5);
      ctx.fill();
      ctx.save();
      rr(ctx, -7, -65, 14, 115, 5);
      ctx.clip();
      ctx.fillStyle = '#E88388';
      for (let k = 0; k < 10; k++) {
        ctx.beginPath();
        ctx.moveTo(-8, -62 + k * 12);
        ctx.lineTo(8, -70 + k * 12);
        ctx.lineTo(8, -64 + k * 12);
        ctx.lineTo(-8, -56 + k * 12);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      rr(ctx, -7, -65, 14, 115, 5);
      ctx.stroke();
      ctx.restore();

      // Glass front outline + highlight
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-64, -60);
      ctx.lineTo(-49, 83);
      ctx.quadraticCurveTo(0, 98, 49, 83);
      ctx.lineTo(64, -60);
      ctx.stroke();
      ell(ctx, 0, -60, 64, 14);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-50, -40);
      ctx.lineTo(-40, 60);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // ---------- Plate / Turntable with 3 portions ----------
    const cake = isCakeDish(dish);
    const rotAngle = dish.turntableAngle !== undefined ? dish.turntableAngle : 0;
    if (cake) {
      drawWhiteCakeTurntable(ctx, 0, 16, 138, 76, rotAngle, t);
    } else {
      drawPlate(ctx);
    }

    const removed = PORTION_ORDER.slice(0, bites);
    const remaining = [0, 1, 2].filter(i => removed.indexOf(i) < 0);
    const scooping = scoopP > 0 && bites < 3 ? PORTION_ORDER[bites] : -1;
    const hasContent = dish.items.length > 0 || cake || (dish.piping && dish.piping.length) || (dish.toppings && dish.toppings.length)
      || (dish.candyBalls && dish.candyBalls.length) || (dish.rosettes && dish.rosettes.length);

    // Crumbs where portions were scooped (and under the one being lifted)
    removed.forEach((idx, i) => drawCrumbs(ctx, idx, i * 3, dish));
    if (scooping >= 0 && scoopP > 0.35) {
      ctx.save();
      ctx.globalAlpha *= seg(scoopP, 0.35, 0.8);
      drawCrumbs(ctx, scooping, bites * 3, dish);
      ctx.restore();
    }

    if (hasContent) {
      if (bites === 0 && scooping < 0) {
        drawDishContent(ctx, dish, t, opts);
      } else {
        // Static remaining portions
        ctx.save();
        ctx.beginPath();
        remaining.forEach(idx => {
          if (idx !== scooping) portionPath(ctx, idx, 150, dish);
        });
        ctx.clip();
        drawDishContent(ctx, dish, t, opts);
        ctx.restore();

        // Portion currently being lifted by the spoon
        if (scooping >= 0) {
          const lift = easeOutCubic(scoopP);
          ctx.save();
          ctx.globalAlpha *= 1 - smooth(seg(scoopP, 0.45, 1));
          ctx.translate(0, -lift * 46);
          const sc = 1 - lift * 0.25;
          ctx.scale(sc, sc);
          ctx.beginPath();
          portionPath(ctx, scooping, 150, dish);
          ctx.clip();
          drawDishContent(ctx, dish, t, opts);
          ctx.restore();
        }

        // Cut faces on remaining portion boundaries
        ctx.save();
        if (cake) {
          // Interior cross-section: the REAL sponge layers + cream filling + the real frosting
          const g = cakeGeom(dish);
          const bands = spongeBands(deriveLayerColors(dish));
          const frosting = safeColor(deriveFrostingColor(dish), VANILLA_CREAM);
          const glaze = cakeGlaze(dish);
          const topCol = glaze.color && glaze.coverage > 0 ? lerpColor(frosting, glaze.color, clamp01(glaze.coverage * 1.6)) : frosting;
          remaining.forEach(idx => {
            if (idx === scooping) return;
            [idx, (idx + 1) % 3].forEach((edge, e) => {
              const neighbour = e === 0 ? (idx + 2) % 3 : (idx + 1) % 3;
              if (remaining.indexOf(neighbour) >= 0 && neighbour !== scooping) return;
              const a = PORTION_A0 + edge * (PI2 / 3);
              const p = rimPt(g, a);
              if (Math.abs(p.x) < 1.5) return; // edge-on face at the back centre
              const shade = p.x > 0 ? 0.1 : 0.2;
              const bandH = g.H / bands.length;
              for (let i = 0; i < bands.length; i++) {
                const col = bands[bands.length - 1 - i];
                const y0 = g.cy + i * bandH, y1 = y0 + bandH;
                ctx.fillStyle = darken(col, shade);
                ctx.beginPath();
                ctx.moveTo(0, y0);
                ctx.lineTo(p.x, p.y + i * bandH);
                ctx.lineTo(p.x, p.y + (i + 1) * bandH);
                ctx.lineTo(0, y1);
                ctx.closePath();
                ctx.fill();
                if (i > 0) {
                  ctx.strokeStyle = rgba(VANILLA_CREAM, 0.9);
                  ctx.lineWidth = 2.4;
                  ctx.beginPath();
                  ctx.moveTo(0, y0);
                  ctx.lineTo(p.x, p.y + i * bandH);
                  ctx.stroke();
                }
              }
              // Frosting roof + outer coat along the cut
              ctx.strokeStyle = topCol;
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.moveTo(0, g.cy);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
              ctx.strokeStyle = frosting;
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x, p.y + g.H);
              ctx.stroke();
              ctx.strokeStyle = 'rgba(92,61,46,0.35)';
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.moveTo(0, g.cy);
              ctx.lineTo(p.x, p.y);
              ctx.lineTo(p.x, p.y + g.H);
              ctx.lineTo(0, g.cy + g.H);
              ctx.stroke();
            });
          });
        } else {
          ctx.strokeStyle = 'rgba(255, 248, 236, 0.85)';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          remaining.forEach(idx => {
            if (idx === scooping) return;
            [idx, (idx + 1) % 3].forEach((edge, e) => {
              const neighbour = e === 0 ? (idx + 2) % 3 : (idx + 1) % 3;
              if (remaining.indexOf(neighbour) >= 0 && neighbour !== scooping) return;
              const a = PORTION_A0 + edge * (PI2 / 3);
              ctx.beginPath();
              ctx.moveTo(Math.cos(a) * 6, -2 + Math.sin(a) * 4);
              ctx.lineTo(Math.cos(a) * 70, -2 + Math.sin(a) * 46);
              ctx.stroke();
            });
          });
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }

  /* ==========================================================================
   * 7. Articulated Plush Patisserie-Chef Critter Rig
   *    anim: { mouthOpen, chewTimer|chewing, reaction, reactionTimer,
   *            reactionDuration, celebrate, lookTarget|pointer|lookX/lookY,
   *            anticipation, wave, headTilt, station, counterY }
   * ========================================================================== */
  const PASTEL_BODY = {
    catnap: '#B39DDB', picky: '#F49AC2', dogday: '#F5A962', bobby: '#E87A88',
    hoppy: '#82C995', craftycorn: '#8ECAE6', bubba: '#7EB2DD', poppy: '#F28BB2',
  };
  const CRITTER_SEED = {
    catnap: 1, picky: 2, dogday: 3, bobby: 4, hoppy: 5, craftycorn: 6, bubba: 7, poppy: 8,
  };

  /** Procedural body motion at time tt (pure; evaluated twice for lag). */
  function critterMotion(tt, rig) {
    const { rxn, rI, chew, celebrate, mouthOpen } = rig;
    // Calm, rhythmic breathing like real miniature ASMR
    let bobY = Math.sin(tt * 1.8) * 1.5;
    let shakeX = 0;
    let sqX = 1 + Math.sin(tt * 1.8) * 0.01;
    let sqY = 1 - Math.sin(tt * 1.8) * 0.01;
    const jumpy = Math.max(celebrate, (rxn === 'love' || rxn === 'rainbow') ? rI : 0);
    if (jumpy > 0) {
      // Gentle joyous sway and soft celebratory bob (grounded behind the counter)
      const sway = Math.sin(tt * 4.2);
      bobY = lerp(bobY, -Math.abs(sway) * (6 + celebrate * 4), jumpy);
      shakeX = lerp(shakeX, sway * 2.5, jumpy);
      sqX = lerp(sqX, 1 + Math.sin(tt * 4.2) * 0.03, jumpy);
      sqY = lerp(sqY, 1 - Math.sin(tt * 4.2) * 0.03, jumpy);
    }
    if (rxn === 'float') bobY = lerp(bobY, -16 + Math.sin(tt * 2.2) * 4, rI);
    else if (rxn === 'ice') shakeX += Math.sin(tt * 28) * 1.8 * rI;
    else if (rxn === 'fire') { shakeX += Math.sin(tt * 24) * 1.5 * rI; bobY -= Math.abs(Math.sin(tt * 8)) * 3 * rI; }
    else if (rxn === 'sour') shakeX += Math.sin(tt * 14) * 2 * rI;
    else if (rxn === 'sleepy') bobY += (3 + Math.sin(tt * 1.2) * 1.5) * rI;
    else if (rxn === 'burnt') shakeX += Math.sin(tt * 3) * 3 * rI;
    if (chew > 0) {
      sqX += Math.sin(tt * 12) * 0.018;
      sqY -= Math.sin(tt * 12) * 0.018;
    }
    if (mouthOpen > 0) {
      sqY += mouthOpen * 0.025;
      sqX -= mouthOpen * 0.015;
    }
    return { bobY, shakeX, sqX, sqY };
  }

  /** Canvas y of the counter edge drawn by drawKitchenBackdrop. */
  function getCounterY(W, H) {
    return H * 0.45;
  }

  function getCritterMouth(cx, cy, scale, anim, t) {
    anim = anim || {};
    const rig = buildRig(anim, t, 0);
    const m = critterMotion(t, rig);
    return { x: cx + m.shakeX * scale, y: cy + (m.bobY + 8) * scale * m.sqY };
  }

  function buildRig(anim, t, seed) {
    const rxn = anim.reaction || null;
    const rT = anim.reactionTimer || 0;
    const rD = anim.reactionDuration || 4.8;
    const rI = rxn ? Math.min(smooth(seg(rD - rT, 0, 0.3)), smooth(seg(rT, 0, 0.5))) : 0;
    const chew = Math.max(anim.chewTimer || 0, anim.chewing || 0);
    const chewI = clamp01(chew / 0.3); // fade out of chew in the last 300ms
    const mouthOpen = clamp01(anim.mouthOpen);
    const celebrate = clamp01(anim.celebrate);
    const anticipation = clamp01(anim.anticipation);
    const wave = clamp01(anim.wave);
    return { rxn, rT, rI, chew, chewI, mouthOpen, celebrate, anticipation, wave, seed };
  }

  function drawCritterCustomer(ctx, critter, cx, cy, scale, anim, t) {
    scale = scale || 1;
    anim = anim || {};
    t = t || 0;
    const seed = CRITTER_SEED[critter.id] || 1;
    const rig = buildRig(anim, t, seed);
    const { rxn, rI, chew, chewI, mouthOpen, celebrate, anticipation, wave } = rig;
    const ear = critter.earType;

    let bodyCol = PASTEL_BODY[critter.id] || critter.color;
    if (rxn === 'fire') bodyCol = lerpColor(bodyCol, '#E85D4A', rI);
    else if (rxn === 'ice') bodyCol = lerpColor(bodyCol, '#9AD9F5', rI);
    else if (rxn === 'burnt') bodyCol = lerpColor(bodyCol, '#8C8078', rI * 0.35);
    const innerCol = '#F7CBD8';

    // Counter line in local coords (character stands behind the counter).
    // game.js anchors the critter at (W*.46, H*.47 - 78*scale) and the backdrop
    // draws the counter edge at H*.45, i.e. ~+67 local; pass anim.counterY
    // (canvas px) to be exact.
    const counterLocalY = anim.counterY !== undefined ? (anim.counterY - 4 - cy) / scale : 67;

    // Look direction (-1..1)
    let lx = anim.lookX || 0, ly = anim.lookY || 0;
    const tgt = anim.lookTarget || anim.pointer;
    if (tgt && typeof tgt.x === 'number') {
      const dx = (tgt.x - cx) / scale, dy = (tgt.y - cy) / scale + 16;
      const d = Math.hypot(dx, dy) || 1;
      const k = clamp(d / 140, 0, 1);
      lx = (dx / d) * k;
      ly = (dy / d) * k;
    }
    if (rxn === 'float') ly = lerp(ly, -0.6, rI);
    if (rxn === 'sleepy') ly = lerp(ly, 0.5, rI);

    // Motion (+ lagged copies for follow-through on hat & ears)
    const m = critterMotion(t, rig);
    const mLag = critterMotion(t - 0.075, rig);
    const mLag2 = critterMotion(t - 0.05, rig);
    const hatLag = clamp((mLag.bobY - m.bobY) * 0.75, -9, 9);
    const earLag = clamp((mLag2.bobY - m.bobY) * 0.012, -0.2, 0.2);

    // Head tilt
    let headTilt = anim.headTilt !== undefined ? anim.headTilt : lx * 0.09 + Math.sin(t * 1.3 + seed) * 0.022;
    if (rxn === 'love' || rxn === 'rainbow') headTilt += Math.sin(t * 5) * 0.1 * rI;
    else if (rxn === 'sleepy') headTilt += (0.2 + Math.sin(t * 1.2) * 0.05) * rI;
    else if (rxn === 'sour') headTilt += Math.sin(t * 18) * 0.07 * rI;
    else if (rxn === 'burnt') headTilt += Math.sin(t * 3) * 0.16 * rI;
    else if (rxn === 'float') headTilt += -0.08 * rI;
    if (celebrate > 0) headTilt += Math.sin(t * 7) * 0.14 * celebrate;
    headTilt -= mouthOpen * 0.04;

    // Blink (natural period per critter + occasional double blink)
    const period = 3.3 + hash(seed) * 1.3;
    const phT = t + hash(seed + 3) * period;
    const ph = phT % period;
    let lid = bump(ph / 0.14);
    if (hash(Math.floor(phT / period) + seed * 13) > 0.72) lid = Math.max(lid, bump((ph - 0.24) / 0.14));
    if (rxn === 'sleepy') lid = Math.max(lid, rI);
    if (mouthOpen > 0.3) lid *= 1 - (mouthOpen - 0.3);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Soft contact shadow on counter under the character
    ctx.fillStyle = 'rgba(92,61,46,0.1)';
    ell(ctx, 0, counterLocalY + 10, 70, 7);
    ctx.fill();

    ctx.translate(m.shakeX, m.bobY);
    ctx.scale(m.sqX, m.sqY);

    /* ---------- Behind-character reaction set dressing ---------- */
    if (rxn === 'rainbow') {
      const bohoCols = ['#E88388', '#F2B880', '#F7DF94', '#9CC5B5', '#92B8E0', '#C4A8E0'];
      const grow = easeOutBack(rI);
      for (let i = 0; i < bohoCols.length; i++) {
        ctx.strokeStyle = bohoCols[i];
        ctx.lineWidth = 6.5;
        ctx.beginPath();
        ctx.arc(0, 18, (108 - i * 6.5) * grow, PI, 0);
        ctx.stroke();
      }
      // Waving rainbow ribbons
      for (const s of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          ctx.strokeStyle = bohoCols[i];
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let k = 0; k <= 10; k++) {
            const u = k / 10;
            const px = s * (70 + u * 60) + Math.sin(t * 6 + u * 5 + i * 0.3) * 6;
            const py = 30 - u * 90 + i * 4 + Math.cos(t * 5 + u * 4) * 5;
            if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
    }
    if (rxn === 'float') {
      [[-62, -96, '#E88388'], [60, -104, '#9CC5B5'], [0, -124, '#F7DF94']].forEach(([bx, by, bcol], i) => {
        const sway = Math.sin(t * 1.8 + i) * 5;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bx * 0.6, -36);
        ctx.quadraticCurveTo(bx * 0.8 + sway, by * 0.5, bx + sway, by + 12);
        ctx.stroke();
        ctx.fillStyle = bcol;
        ell(ctx, bx + sway, by - 8, 19, 24);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ell(ctx, bx + sway - 6, by - 16, 5, 9, -0.3);
        ctx.fill();
        ctx.fillStyle = bcol;
        rr(ctx, bx + sway - 5, by + 12, 10, 6, 2);
        ctx.fill();
        ctx.stroke();
      });
    }
    if (rxn === 'sleepy') {
      // Pastel dream clouds + crescent moon
      for (let i = 0; i < 3; i++) {
        const phc = (t * 0.22 + i * 0.33) % 1;
        const a = rI * bump(phc);
        const px = 60 + i * 14 + phc * 30, py = -50 - phc * 90;
        ctx.fillStyle = `rgba(255,253,249,${(0.9 * a).toFixed(3)})`;
        ctx.strokeStyle = `rgba(92,61,46,${(0.5 * a).toFixed(3)})`;
        ctx.lineWidth = 1.6;
        const sz = 6 + phc * 8;
        circ(ctx, px, py, sz); ctx.fill(); ctx.stroke();
        circ(ctx, px + sz, py - sz * 0.4, sz * 1.1); ctx.fill(); ctx.stroke();
        circ(ctx, px + sz * 2, py, sz * 0.9); ctx.fill(); ctx.stroke();
        ctx.fillStyle = `rgba(255,253,249,${(0.9 * a).toFixed(3)})`;
        ell(ctx, px + sz, py + sz * 0.4, sz * 1.9, sz * 0.6); ctx.fill();
      }
      ctx.fillStyle = `rgba(247, 201, 72, ${rI.toFixed(3)})`;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(-84, -96, 14, 0.6, PI * 1.75);
      ctx.arc(-78, -100, 11, PI * 1.7, 0.75, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    /* ---------- Torso & apron (clipped behind the counter) ---------- */
    ctx.save();
    ctx.beginPath();
    ctx.rect(-220, -400, 440, 400 + (counterLocalY - m.bobY) / m.sqY);
    ctx.clip();
    const breath = 1 + Math.sin(t * 2.2 + 0.4) * 0.018;
    ctx.save();
    ctx.translate(0, 64);
    ctx.scale(breath, 1);
    const bodyGrad = ctx.createRadialGradient(-10, -20, 10, 0, 10, 80);
    bodyGrad.addColorStop(0, lighten(bodyCol, 0.18));
    bodyGrad.addColorStop(1, bodyCol);
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;
    ell(ctx, 0, 0, 60, 64);
    ctx.fill();
    ctx.stroke();
    // Torso extension so the body always reaches below the counter line
    const torsoBottom = Math.max(70, counterLocalY - 64 + 30);
    if (torsoBottom > 20) {
      ctx.fillStyle = bodyCol;
      ctx.fillRect(-58, 0, 116, torsoBottom);
      ctx.beginPath();
      ctx.moveTo(-60, 0); ctx.lineTo(-58, torsoBottom);
      ctx.moveTo(60, 0); ctx.lineTo(58, torsoBottom);
      ctx.stroke();
    }
    // Cream belly patch
    ctx.fillStyle = critter.bellyColor ? lighten(critter.bellyColor, 0.35) : '#FFF7EE';
    ell(ctx, 0, 8, 38, 46);
    ctx.fill();
    ctx.restore();
    // Linen apron with bib, straps, pocket & ruffle
    const apronH = Math.max(100, counterLocalY - 34 + 30);
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    rr(ctx, -36, 34, 72, apronH, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFDF9';
    rr(ctx, -22, 22, 44, 30, 10);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-18, 24); ctx.lineTo(-12, 10);
    ctx.moveTo(18, 24); ctx.lineTo(12, 10);
    ctx.stroke();
    // Gingham trim
    ctx.strokeStyle = '#F2C6B8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-30, 44); ctx.lineTo(30, 44);
    ctx.stroke();
    ctx.fillStyle = '#F8E6E0';
    rr(ctx, -18, 66, 36, 26, 8);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    rr(ctx, -18, 66, 36, 26, 8);
    ctx.stroke();
    // Signature emblem on the bib
    ctx.fillStyle = '#E87A82';
    ctx.lineWidth = 2;
    heart(ctx, 0, 38, 9);
    ctx.fill();
    ctx.stroke();
    // Tiny wooden spoon peeking from pocket
    ctx.fillStyle = '#D4946A';
    rr(ctx, 4, 52, 6, 20, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    /* ---------- Head group (pivot at the neck) ---------- */
    ctx.save();
    ctx.translate(0, 30);
    ctx.rotate(headTilt);
    ctx.translate(0, -30);

    const cheekSide = chewI > 0 ? Math.sin(t * 14) : 0;
    const puffL = chewI * Math.max(0, cheekSide) * 10;
    const puffR = chewI * Math.max(0, -cheekSide) * 10;
    const earWig = Math.sin(t * 3.8 + seed) * 0.05 + (rxn ? Math.sin(t * 12) * 0.08 * rI : 0) + celebrate * Math.sin(t * 14) * 0.16;
    let earFlat = 0; // 1 = pinned back (fire / burnt / sour)
    if (rxn === 'fire' || rxn === 'burnt') earFlat = rI * 0.6;
    if (rxn === 'sour') earFlat = rI * 0.35;

    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;

    // Ears (behind the head)
    for (const s of [-1, 1]) {
      const rot = s * (earWig + earLag + earFlat * 0.5) + (s < 0 ? -earLag * 0.3 : earLag * 0.3);
      ctx.save();
      if (ear === 'bunny') {
        ctx.translate(s * 26, -52);
        ctx.rotate(s * 0.14 + rot * 1.6 + s * earFlat * 0.8);
        ctx.fillStyle = bodyCol;
        ell(ctx, 0, -24, 13, 38);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = innerCol;
        ell(ctx, 0, -22, 6.5, 26);
        ctx.fill();
      } else if (ear === 'cat') {
        ctx.translate(s * 30, -46);
        ctx.rotate(rot * 1.2 + s * earFlat * 0.9);
        ctx.fillStyle = bodyCol;
        ctx.beginPath();
        ctx.moveTo(-s * 14, 2);
        ctx.quadraticCurveTo(s * 10, -26, s * 20, -32);
        ctx.quadraticCurveTo(s * 24, -4, s * 22, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = innerCol;
        ctx.beginPath();
        ctx.moveTo(-s * 4, 2);
        ctx.quadraticCurveTo(s * 10, -16, s * 16, -22);
        ctx.quadraticCurveTo(s * 18, -2, s * 17, 8);
        ctx.closePath();
        ctx.fill();
      } else if (ear === 'dog') {
        ctx.translate(s * 50, -30);
        ctx.rotate(s * 0.22 + rot * 1.4 + s * earFlat * 0.3);
        ctx.fillStyle = darken(bodyCol, 0.25);
        ctx.beginPath();
        ctx.moveTo(-s * 8, -8);
        ctx.quadraticCurveTo(s * 22, 10, s * 14, 52);
        ctx.quadraticCurveTo(s * 2, 60, -s * 10, 48);
        ctx.quadraticCurveTo(-s * 16, 16, -s * 8, -8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (ear === 'elephant') {
        ctx.translate(s * 56, -14);
        ctx.rotate(rot * 1.5 + s * earFlat * 0.3);
        ctx.fillStyle = bodyCol;
        ell(ctx, s * 6, 0, 26, 36, s * 0.15);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = innerCol;
        ell(ctx, s * 4, 2, 15, 24, s * 0.15);
        ctx.fill();
      } else if (ear === 'comb') {
        // Feather crest (pokes out above the toque)
        if (s < 0) {
          ctx.translate(0, -62);
          const cols = ['#F7C948', '#E87A82', '#9CC5B5'];
          for (let i = -1; i <= 1; i++) {
            ctx.save();
            ctx.rotate(i * 0.55 + earWig * 2 + earLag);
            ctx.fillStyle = cols[i + 1];
            ell(ctx, 0, -36, 9, 30);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ell(ctx, -2, -44, 3, 14);
            ctx.fill();
            ctx.restore();
          }
        }
      } else {
        // Round bear / pig ears
        ctx.translate(s * 42, -46);
        ctx.rotate(rot * 1.3 + s * earFlat * 0.4);
        ctx.fillStyle = bodyCol;
        circ(ctx, 0, 0, ear === 'pig' ? 17 : 19);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = innerCol;
        circ(ctx, 0, 1, ear === 'pig' ? 8.5 : 9.5);
        ctx.fill();
      }
      ctx.restore();
    }

    // (unicorn horn is drawn after the toque so it pokes through the puffs)

    // Head (soft gouache shading)
    const headGrad = ctx.createRadialGradient(-14, -30, 8, 0, -10, 64);
    headGrad.addColorStop(0, lighten(bodyCol, 0.28));
    headGrad.addColorStop(1, bodyCol);
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;
    ell(ctx, 0, -12, 56, 49);
    ctx.fill();
    ctx.stroke();

    // Puffed chewing cheeks (bulge outside the head silhouette)
    if (puffL > 0.2 || puffR > 0.2) {
      ctx.fillStyle = bodyCol;
      if (puffL > 0.2) { circ(ctx, -40, 2, 13 + puffL); ctx.fill(); ctx.stroke(); }
      if (puffR > 0.2) { circ(ctx, 40, 2, 13 + puffR); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = headGrad;
      ell(ctx, 0, -12, 54, 47);
      ctx.fill();
    }

    // Species details on the head
    if (ear === 'dog') {
      ctx.fillStyle = darken(bodyCol, 0.22);
      ell(ctx, 22, -22, 15, 18, 0.2);
      ctx.fill();
    }
    if (ear === 'unicorn') {
      // Pastel mane curl + star freckles
      ctx.fillStyle = '#F4B8D4';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-18, -54);
      ctx.quadraticCurveTo(-42, -50, -34, -30);
      ctx.quadraticCurveTo(-24, -40, -14, -44);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F7C948';
      [[-38, -6], [36, -8], [-30, 6]].forEach(([fx, fy]) => {
        star(ctx, fx, fy, 3.5, 1.5, 5, t);
        ctx.fill();
      });
    }

    // Muzzle / snout / trunk / beak
    const muzzleDrop = chewI * Math.abs(cheekSide) * 2 + mouthOpen * 4;
    if (ear === 'pig') {
      ctx.fillStyle = '#F7B6CF';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.6;
      ell(ctx, 0, 0 + muzzleDrop * 0.5, 15, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#D96A95';
      ell(ctx, -5, muzzleDrop * 0.5, 2.8, 3.6);
      ctx.fill();
      ell(ctx, 5, muzzleDrop * 0.5, 2.8, 3.6);
      ctx.fill();
    } else if (ear === 'elephant') {
      const sw = Math.sin(t * 2.4) * 0.15 + (mouthOpen * 0.4) + celebrate * Math.sin(t * 8) * 0.3;
      ctx.fillStyle = bodyCol;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-10, -6);
      ctx.bezierCurveTo(-12, 20, -6 + sw * 30, 40, 16 + sw * 20, 36 - sw * 10);
      ctx.quadraticCurveTo(26 + sw * 20, 26 - sw * 10, 14 + sw * 20, 22 - sw * 10);
      ctx.bezierCurveTo(4 + sw * 10, 28, 4, 14, 10, -6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(92,61,46,0.35)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-8 + i * 1.5, 4 + i * 9);
        ctx.lineTo(6 + i * 1.5, 4 + i * 9);
        ctx.stroke();
      }
    } else if (ear === 'comb') {
      // Beak: upper fixed, lower opens with mouthOpen / chewing
      const open = Math.max(mouthOpen * 14, chewI * Math.abs(cheekSide) * 4, (rxn === 'love' || rxn === 'rainbow' || rxn === 'float') ? 5 * rI : 0);
      ctx.fillStyle = '#F5A623';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      if (open > 0.5) {
        ctx.fillStyle = '#6B1D2F';
        ctx.beginPath();
        ctx.moveTo(-10, -6);
        ctx.lineTo(10, -6);
        ctx.lineTo(2, 2 + open);
        ctx.lineTo(-2, 2 + open);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F48B9A';
        ell(ctx, 0, open * 0.6, 3, 2 + open * 0.2);
        ctx.fill();
        ctx.fillStyle = '#E8951C';
        ctx.beginPath();
        ctx.moveTo(-9, -2 + open * 0.55);
        ctx.lineTo(9, -2 + open * 0.55);
        ctx.lineTo(0, 6 + open);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#F5A623';
      ctx.beginPath();
      ctx.moveTo(-10, -6);
      ctx.lineTo(10, -6);
      ctx.lineTo(0, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FFF7EE';
      ell(ctx, 0, 4 + muzzleDrop * 0.5, 23, 15);
      ctx.fill();
    }

    // Rosy blush cheeks (bounce with chewing)
    const blushA = rxn === 'fire' ? 0.9 : 0.5 + anticipation * 0.2 + mouthOpen * 0.2;
    ctx.fillStyle = rxn === 'fire' ? `rgba(232,58,38,${blushA})` : `rgba(232,115,130,${blushA})`;
    ell(ctx, -34 - puffL * 0.5, 0 + puffL * 0.3, 12 + puffL * 0.5, 7.5 + puffL * 0.3);
    ctx.fill();
    ell(ctx, 34 + puffR * 0.5, 0 + puffR * 0.3, 12 + puffR * 0.5, 7.5 + puffR * 0.3);
    ctx.fill();
    if (rxn === 'burnt') {
      ctx.fillStyle = `rgba(70,60,55,${(0.5 * rI).toFixed(3)})`;
      blob(ctx, -28, -30, 9, 6, 2, 0.3, 8); ctx.fill();
      blob(ctx, 30, -4, 7, 5, 5, 0.3, 8); ctx.fill();
    }

    /* ---------- Eyes ---------- */
    const eyeScale = 1 + mouthOpen * 0.18 + anticipation * 0.06 + (rxn === 'fire' || rxn === 'ice' ? 0.12 * rI : 0);
    const eyeY = -16;
    const happyEyes = chewI > 0.3 && rxn !== 'sour' && rxn !== 'burnt';
    for (const s of [-1, 1]) {
      const ex = s * 21;
      ctx.save();
      ctx.translate(ex, eyeY);
      ctx.scale(eyeScale, eyeScale);
      if (rxn === 'love' && rI > 0.5) {
        ctx.fillStyle = '#E8577A';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.2;
        const hb = 1 + Math.sin(t * 8) * 0.08;
        heart(ctx, 0, 1, 11 * hb);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        circ(ctx, -4, -4, 2.6);
        ctx.fill();
      } else if (rxn === 'rainbow' && rI > 0.5) {
        ctx.fillStyle = OUTLINE;
        circ(ctx, 0, 0, 12);
        ctx.fill();
        ctx.fillStyle = '#F7C948';
        star(ctx, 0, 0, 9.5, 4.2, 5, t * 2.5);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        circ(ctx, -4, -4, 3);
        ctx.fill();
      } else if (rxn === 'sour' && rI > 0.5) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(-s * 8, -7); ctx.lineTo(s * 6, 0); ctx.lineTo(-s * 8, 7);
        ctx.stroke();
      } else if (rxn === 'burnt' && rI > 0.5) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        for (let k = 0; k <= 30; k++) {
          const a = k * 0.5 + t * 6 * s;
          const rad = k * 0.36;
          const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else if (happyEyes || (rxn === 'sleepy' && lid > 0.9)) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        if (happyEyes) ctx.arc(0, 2, 10, PI + 0.25, PI2 - 0.25); // ^ ^ happy arcs
        else ctx.arc(0, -3, 10, 0.25, PI - 0.25);                 // closed sleepy
        ctx.stroke();
        if (rxn === 'sleepy') {
          ctx.lineWidth = 1.8;
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.moveTo(k * 6, 6);
            ctx.lineTo(k * 7.5, 10);
            ctx.stroke();
          }
        }
      } else {
        // Open eye with sweeping eyelid, tracking pupil & dual catchlights
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.8;
        circ(ctx, 0, 0, 12);
        ctx.fill();
        ctx.save();
        circ(ctx, 0, 0, 12);
        ctx.clip();
        const px = lx * 4.6, py = ly * 4.2;
        const pupilR = rxn === 'fire' ? 4.5 : 7.8 - anticipation * 0.8;
        // Iris ring
        ctx.fillStyle = darken(bodyCol, 0.55);
        circ(ctx, px, py, pupilR + 1.6);
        ctx.fill();
        ctx.fillStyle = '#3E2520';
        circ(ctx, px, py, pupilR);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        circ(ctx, px - 2.8, py - 3.2, 3.2);
        ctx.fill();
        circ(ctx, px + 2.6, py + 2.4, 1.6);
        ctx.fill();
        if (anticipation > 0.2 || rxn === 'float') {
          ctx.fillStyle = '#FFFFFF';
          sparkle4(ctx, px + 4, py - 5, 3.5, t * 3);
          ctx.fill();
        }
        // Eyelid sweep (body colour) from the top
        if (lid > 0.02) {
          ctx.fillStyle = bodyCol;
          const lidY = -13 + lid * 26;
          ctx.beginPath();
          ctx.moveTo(-14, -14);
          ctx.lineTo(14, -14);
          ctx.lineTo(14, lidY - 3);
          ctx.quadraticCurveTo(0, lidY + 4, -14, lidY - 3);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(-13, lidY - 3);
          ctx.quadraticCurveTo(0, lidY + 4, 13, lidY - 3);
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.8;
        circ(ctx, 0, 0, 12);
        ctx.stroke();
        // Lash
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(s * 10, -8);
        ctx.lineTo(s * 14, -12);
        ctx.stroke();
      }
      ctx.restore();
      // Brows (raise when surprised / Ahh)
      const browUp = mouthOpen * 6 + anticipation * 2 + (rxn === 'fire' || rxn === 'ice' ? 4 * rI : 0);
      if (browUp > 0.5) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.6;
        ctx.globalAlpha *= clamp01(browUp / 3);
        ctx.beginPath();
        ctx.arc(ex, eyeY - 10 - browUp, 9, PI + 0.5, PI2 - 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Nose
    if (ear !== 'pig' && ear !== 'comb' && ear !== 'elephant') {
      ctx.fillStyle = ear === 'dog' ? '#3E2520' : OUTLINE;
      ell(ctx, 0, -4, ear === 'dog' ? 7 : 5.5, ear === 'dog' ? 5 : 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      circ(ctx, -1.8, -5.4, 1.4);
      ctx.fill();
    }
    // Whiskers
    if (ear === 'cat' || ear === 'bunny') {
      ctx.strokeStyle = 'rgba(92,61,46,0.7)';
      ctx.lineWidth = 1.6;
      for (const s of [-1, 1]) {
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(s * 24, -2 + k * 5);
          ctx.lineTo(s * 44, -4 + k * 8 + Math.sin(t * 3 + k) * 1.2);
          ctx.stroke();
        }
      }
    }

    /* ---------- Mouth ---------- */
    const mouthY = 6;
    const beakBird = ear === 'comb'; // Poppy's beak rig handles open/chew/smile
    if (rxn === 'fire' && rI > 0.3) {
      const fl = (40 + Math.sin(t * 24) * 12) * rI;
      ctx.fillStyle = '#F26430';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-12, mouthY);
      ctx.quadraticCurveTo(-30, mouthY + fl * 0.5, -22, mouthY + 20 + fl);
      ctx.quadraticCurveTo(-6, mouthY + 10 + fl * 0.7, 0, mouthY + 16 + fl * 0.9);
      ctx.quadraticCurveTo(6, mouthY + 10 + fl * 0.7, 22, mouthY + 20 + fl);
      ctx.quadraticCurveTo(30, mouthY + fl * 0.5, 12, mouthY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FCD856';
      ctx.beginPath();
      ctx.moveTo(-6, mouthY);
      ctx.quadraticCurveTo(-4, mouthY + fl * 0.5, 0, mouthY + 12 + fl * 0.6);
      ctx.quadraticCurveTo(4, mouthY + fl * 0.5, 6, mouthY);
      ctx.closePath();
      ctx.fill();
      // Open mouth behind the flame
      ctx.fillStyle = '#6B1D2F';
      ell(ctx, 0, mouthY + 2, 11, 7);
      ctx.fill();
    } else if (rxn === 'sour' && rI > 0.3) {
      ctx.fillStyle = '#C9657A';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.6;
      circ(ctx, 0, mouthY + 2, 5);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1.8;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * PI2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 7, mouthY + 2 + Math.sin(a) * 7);
        ctx.lineTo(Math.cos(a) * 11, mouthY + 2 + Math.sin(a) * 11);
        ctx.stroke();
      }
    } else if (beakBird && !(rxn === 'burnt' || rxn === 'ice' || rxn === 'sleepy')) {
      // Poppy: beak already animated above; only draw anticipation drool
      if (anticipation > 0.15 && mouthOpen < 0.08) {
        const d = anticipation * (5 + Math.sin(t * 3) * 2);
        ctx.fillStyle = 'rgba(165, 222, 245, 0.85)';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.quadraticCurveTo(13, d, 10, d + 5);
        ctx.quadraticCurveTo(6, d, 8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (mouthOpen > 0.08) {
      // "Ahh!" — wide open gummy mouth with tongue & highlight
      const mo = easeOutCubic(mouthOpen);
      const mh = 7 + mo * 21;
      const mw = 11 + mo * 13;
      ctx.fillStyle = '#6B1D2F';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-mw, mouthY);
      ctx.quadraticCurveTo(0, mouthY - mh * 0.35, mw, mouthY);
      ctx.quadraticCurveTo(mw * 0.9, mouthY + mh * 1.1, 0, mouthY + mh * 1.15);
      ctx.quadraticCurveTo(-mw * 0.9, mouthY + mh * 1.1, -mw, mouthY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F48B9A';
      ell(ctx, 0, mouthY + mh * 0.72, mw * 0.6, mh * 0.42);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ell(ctx, -mw * 0.35, mouthY + mh * 0.25, mw * 0.18, mh * 0.12);
      ctx.fill();
      if (ear === 'bunny') {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.6;
        rr(ctx, -5, mouthY - 1, 4.5, 6, 1.5); ctx.fill(); ctx.stroke();
        rr(ctx, 0.5, mouthY - 1, 4.5, 6, 1.5); ctx.fill(); ctx.stroke();
      }
    } else if (chewI > 0.05) {
      // Chewing: closed wavy mouth sliding side to side
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.8;
      const mx = cheekSide * 4;
      ctx.beginPath();
      ctx.moveTo(mx - 9, mouthY + 3);
      ctx.quadraticCurveTo(mx - 4, mouthY + 7, mx, mouthY + 3);
      ctx.quadraticCurveTo(mx + 4, mouthY - 1, mx + 9, mouthY + 3);
      ctx.stroke();
    } else if (rxn === 'burnt' && rI > 0.3) {
      ctx.fillStyle = '#F48B9A';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, mouthY + 2, 8, 0, PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, mouthY + 2);
      ctx.quadraticCurveTo(0, mouthY - 2, 8, mouthY + 2);
      ctx.stroke();
      ctx.fillStyle = '#E8657A';
      rr(ctx, -4, mouthY + 2, 8, 12, 4);
      ctx.fill();
      ctx.stroke();
    } else if (rxn === 'ice' && rI > 0.3) {
      const chatter = Math.abs(Math.sin(t * 40)) * 3 * rI;
      ctx.fillStyle = '#6B1D2F';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      rr(ctx, -9, mouthY, 18, 3 + chatter, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-8, mouthY + 1, 16, 2);
    } else if (rxn === 'sleepy' && rI > 0.3) {
      ctx.fillStyle = '#C9657A';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      ell(ctx, 0, mouthY + 3, 4 + Math.sin(t * 2.5) * 1.5, 5);
      ctx.fill();
      ctx.stroke();
      // Snore bubble from the nose
      const bRad = (10 + Math.sin(t * 2.5) * 6) * rI;
      ctx.fillStyle = 'rgba(165, 222, 245, 0.75)';
      ctx.lineWidth = 1.8;
      circ(ctx, 22, -2, bRad);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      circ(ctx, 18 - bRad * 0.3, -6 - bRad * 0.2, bRad * 0.28);
      ctx.fill();
    } else {
      // Default happy smile (species-flavoured)
      const smileW = 1 + anticipation * 0.4 + celebrate * 0.5 + (rxn === 'love' || rxn === 'rainbow' || rxn === 'float' ? 0.5 * rI : 0);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      if (ear === 'cat' || ear === 'bunny') {
        ctx.arc(-6 * smileW, mouthY - 2, 6 * smileW, 0.15, PI - 0.15);
        ctx.arc(6 * smileW, mouthY - 2, 6 * smileW, 0.15, PI - 0.15);
      } else if (ear === 'comb') {
        ctx.moveTo(-10, -6);
        ctx.quadraticCurveTo(0, 2, 10, -6);
      } else {
        ctx.moveTo(-11 * smileW, mouthY - 2);
        ctx.quadraticCurveTo(0, mouthY + 8 + smileW * 3, 11 * smileW, mouthY - 2);
      }
      ctx.stroke();
      if (smileW > 1.25 || ear === 'dog') {
        // Open happy smile with tongue
        ctx.fillStyle = '#6B1D2F';
        ctx.beginPath();
        ctx.moveTo(-10 * smileW, mouthY - 1);
        ctx.quadraticCurveTo(0, mouthY + 8 + smileW * 4, 10 * smileW, mouthY - 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#F48B9A';
        ell(ctx, 0, mouthY + 5 + smileW * 2, 6, 4 + smileW);
        ctx.fill();
      }
      if (ear === 'bunny') {
        ctx.fillStyle = '#FFFFFF';
        ctx.lineWidth = 1.6;
        rr(ctx, -5, mouthY + 2, 4.5, 6, 1.5); ctx.fill(); ctx.stroke();
        rr(ctx, 0.5, mouthY + 2, 4.5, 6, 1.5); ctx.fill(); ctx.stroke();
      }
      // Anticipation drool
      if (anticipation > 0.15) {
        const d = anticipation * (5 + Math.sin(t * 3) * 2);
        ctx.fillStyle = 'rgba(165, 222, 245, 0.85)';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(10, mouthY + 1);
        ctx.quadraticCurveTo(15, mouthY + d, 12, mouthY + d + 5);
        ctx.quadraticCurveTo(8, mouthY + d, 10, mouthY + 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    /* ---------- Toque Blanche (delayed spring inertia) ---------- */
    ctx.save();
    const hatY = -60 + hatLag + Math.sin(t * 2.2 - 0.9) * 1.5;
    ctx.translate(0, hatY);
    ctx.rotate(-headTilt * 0.35 + hatLag * 0.01);
    if (rxn === 'burnt') ctx.rotate(0.3 * rI);
    const hatCol = rxn === 'burnt' ? lerpColor('#FFFDF9', '#8C8078', rI * 0.4) : '#FFFDF9';
    ctx.fillStyle = hatCol;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.8;
    const puffJ = Math.abs(hatLag) * 0.08;
    [[-18, -9, 15], [18, -9, 15], [0, -16 - puffJ * 3, 18]].forEach(([hx, hy, hr]) => {
      circ(ctx, hx, hy, hr);
      ctx.fill();
      ctx.stroke();
    });
    ctx.fillStyle = hatCol;
    ell(ctx, 0, -8, 24, 13);
    ctx.fill();
    ctx.fillStyle = 'rgba(92,61,46,0.08)';
    ell(ctx, 6, -4, 16, 8);
    ctx.fill();
    ctx.fillStyle = '#FFF9F0';
    rr(ctx, -22, -3, 44, 12, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E88388';
    rr(ctx, -20, 1, 40, 4, 2);
    ctx.fill();
    if (rxn === 'ice') {
      ctx.fillStyle = `rgba(184, 234, 255, ${rI})`;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        star(ctx, i * 16, -22 - (1 - Math.abs(i)) * 6, 6, 2.5, 6, t);
        ctx.fill();
        ctx.stroke();
      }
    }
    if (rxn === 'fire') {
      // Sweat drops flying off
      for (let i = 0; i < 3; i++) {
        const phd = (t * 1.6 + i * 0.37) % 1;
        const sx = (i - 1) * 26 + phd * (i - 1) * 24;
        const sy = -10 - phd * 30 + phd * phd * 20;
        drawParticle(ctx, { x: sx, y: sy, r: 3, kind: 'droplet', color: `rgba(165, 222, 245, ${(0.9 * (1 - phd) * rI).toFixed(3)})` }, t);
      }
    }
    if (ear === 'unicorn') {
      // Golden spiral horn poking through the toque
      ctx.save();
      ctx.translate(0, -24);
      ctx.fillStyle = '#F7C948';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-9, 2);
      ctx.lineTo(0, -42);
      ctx.lineTo(9, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(92,61,46,0.45)';
      ctx.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-7.5 + i * 1.7, -i * 9);
        ctx.lineTo(7.5 - i * 1.7, -i * 9 - 4);
        ctx.stroke();
      }
      ctx.fillStyle = '#FFF6CC';
      sparkle4(ctx, 10, -34, 5 + Math.sin(t * 4) * 1.5, t * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    ctx.restore(); // head group

    /* ---------- Arms & paws (pose blending) ---------- */
    const restY = counterLocalY + 2;
    const poses = [];
    const addPose = (w, L, R) => { if (w > 0.001) poses.push({ w: clamp01(w), L, R }); };
    // Base: resting on the counter with an alternating bob
    let pawL = { x: -60, y: restY + Math.sin(t * 3) * 1.5, rot: 0 };
    let pawR = { x: 60, y: restY - Math.sin(t * 3) * 1.5, rot: 0 };
    addPose(wave, null, { x: 76, y: -6 + Math.sin(t * 9) * 6, rot: Math.sin(t * 9) * 0.5 });
    addPose(mouthOpen, { x: -50, y: 12 + Math.sin(t * 12) * 2, rot: -0.3 }, { x: 50, y: 12 - Math.sin(t * 12) * 2, rot: 0.3 });
    addPose(chewI, { x: -24 + Math.sin(t * 14) * 8, y: 54, rot: 0.2 }, { x: 24 - Math.sin(t * 14) * 8, y: 54, rot: -0.2 });
    const cheer = Math.max(celebrate, (rxn === 'love' || rxn === 'rainbow') ? rI : 0);
    addPose(cheer, { x: -70, y: -34 + Math.sin(t * 6.5) * 10, rot: -0.6 }, { x: 70, y: -34 + Math.sin(t * 6.5 + PI) * 10, rot: 0.6 });
    if (rxn === 'float') addPose(rI, { x: -64, y: -30, rot: -0.4 }, { x: 62, y: -34, rot: 0.4 });
    if (rxn === 'fire') addPose(rI, { x: -58, y: -10 + Math.sin(t * 20) * 4, rot: 0 }, { x: 58, y: -10 - Math.sin(t * 20) * 4, rot: 0 });
    if (rxn === 'ice') addPose(rI, { x: -30, y: 44, rot: 0.6 }, { x: 30, y: 44, rot: -0.6 });
    if (rxn === 'sour') addPose(rI, { x: -40, y: 10, rot: 0 }, { x: 40, y: 10, rot: 0 });
    if (rxn === 'burnt') addPose(rI, { x: -70, y: restY - 6, rot: 0 }, { x: 70, y: restY - 6, rot: 0 });
    if (anim.station === 2 && !rxn && mouthOpen < 0.1 && chewI < 0.1) addPose(1, null, { x: 64, y: 8 + Math.sin(t * 4) * 3, rot: Math.sin(t * 4) * 0.3 });
    poses.forEach(p => {
      if (p.L) pawL = { x: lerp(pawL.x, p.L.x, p.w), y: lerp(pawL.y, p.L.y, p.w), rot: lerp(pawL.rot, p.L.rot, p.w) };
      if (p.R) pawR = { x: lerp(pawR.x, p.R.x, p.w), y: lerp(pawR.y, p.R.y, p.w), rot: lerp(pawR.rot, p.R.rot, p.w) };
    });

    const drawArm = (paw, s) => {
      const shX = s * 44, shY = Math.min(52, counterLocalY - 12);
      const raised = paw.y < restY - 10;
      // Arm as a thick tapered stroke with a soft elbow bend
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      const ex = (shX + paw.x) / 2 + s * (raised ? 14 : 6);
      const ey = (shY + paw.y) / 2 + (raised ? 4 : 10);
      ctx.beginPath();
      ctx.moveTo(shX, shY);
      ctx.quadraticCurveTo(ex, ey, paw.x, paw.y);
      ctx.stroke();
      ctx.strokeStyle = bodyCol;
      ctx.lineWidth = 12.5;
      ctx.beginPath();
      ctx.moveTo(shX, shY);
      ctx.quadraticCurveTo(ex, ey, paw.x, paw.y);
      ctx.stroke();
      // Paw with toe beans
      ctx.save();
      ctx.translate(paw.x, paw.y);
      ctx.rotate(paw.rot);
      ctx.fillStyle = bodyCol;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      circ(ctx, 0, 0, 15);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(247, 203, 216, 0.85)';
      ell(ctx, 0, 3, 6.5, 5);
      ctx.fill();
      for (let k = -1; k <= 1; k++) {
        circ(ctx, k * 6, -6.5 + Math.abs(k) * 1.5, 2.6);
        ctx.fill();
      }
      ctx.restore();
    };
    // Resting paws cast a tiny shadow on the counter
    for (const paw of [pawL, pawR]) {
      if (paw.y > restY - 6) {
        ctx.fillStyle = 'rgba(92,61,46,0.14)';
        ell(ctx, paw.x + 2, paw.y + 13, 15, 4);
        ctx.fill();
      }
    }
    drawArm(pawL, -1);
    drawArm(pawR, 1);

    // Held items: heart (love), mini wooden spoon (station 2 / wave)
    if (rxn === 'love' && rI > 0.4) {
      ctx.save();
      ctx.translate(pawR.x, pawR.y - 16);
      ctx.rotate(Math.sin(t * 6.5) * 0.2);
      ctx.fillStyle = '#E87A82';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      heart(ctx, 0, 0, 13 * (1 + Math.sin(t * 8) * 0.08));
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if ((anim.station === 2 && !rxn && mouthOpen < 0.1 && chewI < 0.1) || (wave > 0.5 && !rxn)) {
      ctx.save();
      ctx.translate(pawR.x + 4, pawR.y - 4);
      ctx.rotate(-0.5 + Math.sin(t * 4) * 0.3);
      ctx.fillStyle = '#D4946A';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      rr(ctx, -3.5, -34, 7, 36, 3.5);
      ctx.fill();
      ctx.stroke();
      ell(ctx, 0, -38, 8, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    /* ---------- Front reaction effects ---------- */
    if (rxn === 'love' || rxn === 'rainbow' || celebrate > 0) {
      const inten = Math.max(rI, celebrate);
      for (let i = 0; i < 7; i++) {
        const phh = (t * 0.45 + hash(i + seed)) % 1;
        const side = i % 2 === 0 ? -1 : 1;
        const hx = side * (54 + hash(i + 4) * 36) + Math.sin(t * 3 + i) * 6;
        const hy = 40 - phh * 170;
        const a = inten * bump(phh);
        const sc = 0.7 + hash(i + 9) * 0.6;
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate(hx, hy);
        ctx.rotate(Math.sin(t * 2 + i) * 0.3);
        ctx.scale(sc, sc);
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.5;
        if (i % 3 === 0 || rxn === 'love') {
          ctx.fillStyle = i % 2 ? '#E87A82' : '#F4A6B8';
          heart(ctx, 0, 0, 11);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = i % 2 ? '#F7C948' : '#9CC5B5';
          sparkle4(ctx, 0, 0, 11, t * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    if (celebrate > 0) {
      // Sparkle burst ring
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI2 + t * 1.5;
        const rad = 95 + Math.sin(t * 6 + i) * 10;
        ctx.fillStyle = ['#F7C948', '#E87A82', '#9CC5B5', '#C4A8E0'][i % 4];
        ctx.globalAlpha = celebrate * (0.6 + 0.4 * Math.sin(t * 8 + i));
        star(ctx, Math.cos(a) * rad, -10 + Math.sin(a) * rad * 0.7, 7, 3, 5, t * 3 + i);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (rxn === 'ice') {
      ctx.fillStyle = `rgba(184, 234, 255, ${rI})`;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 6; i++) {
        const a = t * 1.2 + (i * PI2) / 6;
        const fx = Math.cos(a) * 82, fy = -10 + Math.sin(a) * 50;
        star(ctx, fx, fy, 10, 4, 6, t + i);
        ctx.fill();
        ctx.stroke();
      }
      // Frosty breath puff
      ctx.fillStyle = `rgba(230, 246, 255, ${(0.55 * rI * (0.5 + 0.5 * Math.sin(t * 3))).toFixed(3)})`;
      blob(ctx, 0, 26, 22, 10, 3, 0.2, 10);
      ctx.fill();
    } else if (rxn === 'burnt') {
      for (let i = 0; i < 3; i++) {
        const phs = (t * 0.6 + i * 0.33) % 1;
        const py = -40 - phs * 70, px = (i - 1) * 16 + Math.sin(t * 2 + i) * 6;
        ctx.fillStyle = `rgba(95, 85, 80, ${(0.7 * rI * bump(phs)).toFixed(3)})`;
        blob(ctx, px, py, 12 + phs * 10, 10 + phs * 8, i + 1, 0.2, 10);
        ctx.fill();
      }
    } else if (rxn === 'sour') {
      ctx.strokeStyle = `rgba(247, 201, 72, ${rI})`;
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        const s = i % 2 ? 1 : -1;
        const bx = s * 62, by = -40 + (i >> 1) * 36;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        for (let k = 1; k <= 4; k++) ctx.lineTo(bx + s * k * 6 + Math.sin(t * 20 + k) * 2, by + (k % 2 ? -6 : 6));
        ctx.stroke();
      }
    } else if (rxn === 'float') {
      for (let i = 0; i < 5; i++) {
        const phs = (t * 0.4 + hash(i + 2)) % 1;
        ctx.fillStyle = `rgba(247, 201, 72, ${(rI * bump(phs)).toFixed(3)})`;
        sparkle4(ctx, (hash(i) - 0.5) * 160, 60 - phs * 140, 6, t * 2 + i);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /* ==========================================================================
   * 8. Station hero renderers (game.js keeps side cards + hit-testing)
   * ========================================================================== */

  /* ---------- Station 1: Oak butcher block + Santoku choreography ---------- */
  function woodGrain(ctx, x, y, w, h, seed, alpha) {
    ctx.save();
    ctx.strokeStyle = `rgba(160, 105, 60, ${alpha || 0.22})`;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const gy = y + 12 + (i / 7) * (h - 24) + hash(i + seed) * 6;
      ctx.beginPath();
      ctx.moveTo(x + 14, gy);
      ctx.bezierCurveTo(x + w * 0.3, gy - 6 + hash(i + 3) * 10, x + w * 0.6, gy + 6 - hash(i + 5) * 10, x + w - 14, gy + (hash(i + 8) - 0.5) * 8);
      ctx.stroke();
    }
    // Knots
    for (let k = 0; k < 2; k++) {
      ell(ctx, x + w * (0.25 + k * 0.5) + hash(k + seed) * 30, y + h * 0.5 + (hash(k + 4) - 0.5) * 40, 10, 5, 0.3);
      ctx.stroke();
      ell(ctx, x + w * (0.25 + k * 0.5) + hash(k + seed) * 30, y + h * 0.5 + (hash(k + 4) - 0.5) * 40, 5, 2.4, 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawChopStation(ctx, cx, cy, s, t) {
    s = s || {};
    const bi = s.boardItem || null;
    const spring = s.boardSpring || { sx: 1, sy: 1 };
    let ks = normAnim(s.knifeSlash);
    if (!s.knifeSlash && bi && bi.knifeAnim > 0) ks = { active: true, t: 1 - clamp01(bi.knifeAnim) };
    const meta = bi ? KitchenData.getIngredient(bi.id) : null;
    const tool = !bi ? 'knife' : (meta.liquid ? 'pour' : ((bi.id === 'dough' || bi.id === 'pizzabase') ? 'pin' : 'knife'));
    const recoil = s.boardRecoil !== undefined ? s.boardRecoil : (ks.active ? bump(seg(ks.t, 0.45, 0.8)) * 4 : 0);
    const cutX = (ks.cutX !== undefined ? ks.cutX : cx - 44);
    const cutY = (ks.cutY !== undefined ? ks.cutY : cy - 6);
    const cutLX = cutX - cx; // cut position in board-local x

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // ---- Left Side: Miniature Shopping Cart & Grocery Basket (Slice 1: 00:00 - 06:00) ----
    {
      const cartX = cx - 268;
      const cartBounce = clamp01(s.cartBounce || 0);
      const cartY = cy - 6 - Math.sin(cartBounce * PI) * 6;
      const wheelRot = t * 1.8 + cartBounce * PI * 2;
      softShadow(ctx, cartX, cy + 36, 58, 16, 0.18);
      ctx.save();
      ctx.translate(cartX, cartY);
      ctx.rotate(Math.sin(cartBounce * PI * 2) * 0.05);

      // Push handle bar
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(-36, -12);
      ctx.lineTo(-50, -40);
      ctx.lineTo(-36, -44);
      ctx.stroke();
      ctx.strokeStyle = '#E8998D';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-36, -12);
      ctx.lineTo(-50, -40);
      ctx.lineTo(-36, -44);
      ctx.stroke();

      // Groceries nestled inside the cart basket
      const cItems = (Array.isArray(s.cartItems) && s.cartItems.length)
        ? s.cartItems.slice(-4)
        : ['watermelon', 'carrot', 'corn', 'strawberry'];
      for (let i = 0; i < cItems.length; i++) {
        const gx = -22 + i * 15;
        const gy = -18 - (i % 2) * 7;
        drawIngredient(ctx, cItems[i], gx, gy, 15, { sliced: false, shadow: false, rot: (i - 1.5) * 0.18 });
      }

      // Wire mesh basket body (semi-transparent cream + lattice)
      ctx.fillStyle = 'rgba(255, 253, 249, 0.72)';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-42, -24);
      ctx.lineTo(42, -24);
      ctx.lineTo(32, 16);
      ctx.lineTo(-32, 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wire lattice lines
      ctx.strokeStyle = 'rgba(166, 144, 118, 0.65)';
      ctx.lineWidth = 1.8;
      for (let vx = -24; vx <= 24; vx += 16) {
        ctx.beginPath();
        ctx.moveTo(vx * 1.15, -22);
        ctx.lineTo(vx * 0.88, 14);
        ctx.stroke();
      }
      for (let hy = -12; hy <= 4; hy += 14) {
        ctx.beginPath();
        ctx.moveTo(-36, hy);
        ctx.lineTo(36, hy);
        ctx.stroke();
      }

      // Mint top bumper rim
      ctx.fillStyle = '#9CC5B5';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.6;
      rr(ctx, -45, -28, 90, 9, 4.5);
      ctx.fill();
      ctx.stroke();

      // Lower tubular frame & 2 rolling wheels
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-28, 16);
      ctx.lineTo(-32, 28);
      ctx.lineTo(32, 28);
      ctx.stroke();
      for (const wx of [-24, 24]) {
        ctx.save();
        ctx.translate(wx, 31);
        ctx.rotate(wheelRot);
        ctx.fillStyle = '#5C3D2E';
        circ(ctx, 0, 0, 8.5);
        ctx.fill();
        ctx.fillStyle = '#F7C948';
        circ(ctx, 0, 0, 4);
        ctx.fill();
        ctx.strokeStyle = '#FFFDF9';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 6);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // ---- Right Side: Toy Checkout Barcode Scanner & Cash Register Drawer ----
    {
      const regX = cx + 268;
      const regY = cy - 6;
      const scanFlash = clamp01(s.scanFlash || 0);
      const drawerOpen = clamp01(s.drawerOpen || 0);
      softShadow(ctx, regX, cy + 36, 58, 16, 0.18);
      ctx.save();
      ctx.translate(regX, regY);

      // Register main housing
      ctx.fillStyle = '#9CC5B5';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      rr(ctx, -46, -38, 92, 58, 14);
      ctx.fill();
      ctx.stroke();

      // Cream inner faceplate
      ctx.fillStyle = '#FFFDF9';
      rr(ctx, -38, -31, 76, 44, 10);
      ctx.fill();
      ctx.stroke();

      // Zero-Text Star Display Screen + Status LED
      ctx.fillStyle = '#3B2D26';
      rr(ctx, -32, -26, 46, 18, 5);
      ctx.fill();
      ctx.fillStyle = '#F7C948';
      for (let k = 0; k < 3; k++) {
        star(ctx, -22 + k * 13, -17, 4.5, 2.0, 5);
        ctx.fill();
      }
      ctx.fillStyle = scanFlash > 0.05 ? '#52D681' : '#E87A82';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      circ(ctx, 24, -17, 5);
      ctx.fill();
      ctx.stroke();

      // Tactile colorful toy keypad buttons (Zero text/digits!)
      const keyCols = ['#F7C948', '#E8998D', '#88C968', '#88C8F7', '#F7A1B0', '#FFD54F'];
      for (let ky = 0; ky < 2; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const idx = ky * 3 + kx;
          ctx.fillStyle = keyCols[idx];
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 1.8;
          rr(ctx, -30 + kx * 21, -3 + ky * 11, 16, 8, 3);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Pop-out Cash Register Drawer with gold star coins
      const dShift = drawerOpen * 18;
      if (drawerOpen > 0.02) {
        ctx.fillStyle = '#E6B88A';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.5;
        rr(ctx, -40, 16, 80, 14 + dShift, 6);
        ctx.fill();
        ctx.stroke();
        // Gold star coins inside drawer
        for (let cIdx = -1; cIdx <= 1; cIdx++) {
          ctx.fillStyle = '#F7C948';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 1.6;
          circ(ctx, cIdx * 20, 21 + dShift * 0.55, 6.5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFF9C4';
          star(ctx, cIdx * 20, 21 + dShift * 0.55, 3.5, 1.5, 5);
          ctx.fill();
        }
      }
      // Drawer front panel & brass pull handle
      ctx.fillStyle = '#E8998D';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.8;
      rr(ctx, -44, 18 + dShift, 88, 14, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F7C948';
      rr(ctx, -14, 22 + dShift, 28, 6, 3);
      ctx.fill();
      ctx.stroke();

      // Handheld Barcode Scanner wand on left cradle
      ctx.save();
      ctx.translate(-50, -14);
      ctx.rotate(-0.25 - scanFlash * 0.18);
      ctx.fillStyle = '#E8998D';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      rr(ctx, -10, -18, 22, 14, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFDF9';
      rr(ctx, -4, -6, 10, 18, 4);
      ctx.fill();
      ctx.stroke();
      // Optical red laser beam when scanning
      if (scanFlash > 0.02) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 65, 90, ${(0.28 * scanFlash).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(-10, -11);
        ctx.lineTo(-95, -28);
        ctx.lineTo(-95, 10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 50, 80, ${(0.9 * scanFlash).toFixed(3)})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-95, -24 + Math.sin(t * 45) * 14);
        ctx.lineTo(-95, 6 + Math.sin(t * 45) * 14);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      ctx.restore();
    }

    // Round / oval miniature wooden cutting board (sb_L2_M0 row 4, sb_L2_M2 row 1):
    // shadow, end-grain thickness, top face, grain, bevel ring, hanging hole
    const BRX = 184, BRY = 92;
    softShadow(ctx, cx + 4, cy + 14 + recoil * 0.5, BRX * 0.98, BRY * 0.92, 0.2);
    ctx.save();
    ctx.translate(0, recoil);
    ctx.fillStyle = '#B9814E';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    ell(ctx, cx, cy + 6, BRX, BRY);
    ctx.fill();
    ctx.stroke();
    const bg = ctx.createRadialGradient(cx - 60, cy - 50, 20, cx, cy - 4, BRX);
    bg.addColorStop(0, '#F0CA9A');
    bg.addColorStop(0.55, '#E6B88A');
    bg.addColorStop(1, '#D39F6A');
    ctx.fillStyle = bg;
    ell(ctx, cx, cy - 4, BRX, BRY);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ell(ctx, cx, cy - 4, BRX - 3, BRY - 3);
    ctx.clip();
    woodGrain(ctx, cx - BRX, cy - 4 - BRY, BRX * 2, BRY * 2, 1, 0.22);
    ctx.restore();
    // Bevelled inner ring
    ctx.strokeStyle = 'rgba(160, 105, 60, 0.5)';
    ctx.lineWidth = 2.5;
    ell(ctx, cx, cy - 4, BRX - 18, BRY - 16);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 240, 220, 0.5)';
    ctx.lineWidth = 1.5;
    ell(ctx, cx, cy - 4, BRX - 20, BRY - 18);
    ctx.stroke();
    // Little handle nub with hanging hole
    ctx.fillStyle = '#D9A672';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    rr(ctx, cx + BRX - 16, cy - 20, 40, 32, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#A8734A';
    ctx.lineWidth = 2;
    circ(ctx, cx + BRX + 10, cy - 4, 5);
    ctx.fill();
    ctx.stroke();

    // The Mini Panda Porcelain Dish (sb_L2_M0 row 2) ONLY cradles cocoa beans — fruit,
    // dough, eggs and cheese are chopped straight on the wood.
    if (bi && bi.id === 'cocoa') {
      const pandaX = cx, pandaY = cy + 2;
      ctx.save();
      ctx.fillStyle = 'rgba(92, 61, 46, 0.16)';
      rr(ctx, pandaX - 66, pandaY - 44, 132, 92, 18);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.8;
      rr(ctx, pandaX - 64, pandaY - 48, 128, 90, 16);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#A8D5BA';
      ctx.lineWidth = 2;
      rr(ctx, pandaX - 58, pandaY - 42, 116, 78, 12);
      ctx.stroke();
      // Hand-painted baby panda peeking from the dish corner
      ctx.save();
      ctx.translate(pandaX - 36, pandaY - 22);
      ctx.fillStyle = '#2A2421';
      circ(ctx, -10, -10, 4.5);
      circ(ctx, 10, -10, 4.5);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      circ(ctx, 0, -2, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2A2421';
      ell(ctx, -4.5, -3, 3.4, 2.6, -0.25);
      ctx.fill();
      ell(ctx, 4.5, -3, 3.4, 2.6, 0.25);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      circ(ctx, -4, -4, 1);
      circ(ctx, 4, -4, 1);
      ctx.fill();
      ctx.fillStyle = '#2A2421';
      circ(ctx, 0, 0.5, 1.3);
      ctx.fill();
      ctx.strokeStyle = '#2A2421';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(0, 1.5, 2.4, 0.2, PI - 0.2);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }
    ctx.restore();

    if (!bi) {
      // Inviting hint: floating strawberry + knife, soft pulsing tap ring
      const bounceY = Math.sin(t * 3) * 5;
      const pulse = (t * 0.8) % 1;
      ctx.strokeStyle = `rgba(232, 131, 136, ${(0.5 * (1 - pulse)).toFixed(3)})`;
      ctx.lineWidth = 3;
      ell(ctx, cx, cy - 2, 40 + pulse * 70, 24 + pulse * 42);
      ctx.stroke();
      ctx.save();
      ctx.globalAlpha *= 0.9;
      drawIngredient(ctx, s.hintId || 'strawberry', cx - 40, cy - 4 + bounceY, 36, { sliced: false });
      drawKnife(ctx, cx + 64, cy - 16 - bounceY, 52, -0.6 + Math.sin(t * 3) * 0.08, (t * 0.5) % 1);
      ctx.restore();
      ctx.restore();
      return;
    }

    const chops = bi.chops || 0;
    const maxChops = bi.maxChops || 3;
    const prog = clamp01(chops / maxChops);
    const sep = s.sliceSepProgress !== undefined ? clamp01(s.sliceSepProgress) : (ks.active ? easeOutBack(seg(ks.t, 0.45, 0.95)) : 1);
    const col = meta.color;

    // ---- Food on the board ----
    ctx.save();
    ctx.translate(cx, cy - 4 + recoil);
    ctx.scale(spring.sx || 1, spring.sy || 1);
    if (s.landPop !== undefined && s.landPop < 1) {
      // Fresh ingredient landing: pop-in with squash
      const lp = easeOutBack(clamp01(s.landPop));
      ctx.scale(lp * (1 + (1 - lp) * 0.3), lp * (1 - (1 - lp) * 0.2));
    }
    if (meta.crackable) {
      // Egg crack sequence: whole → crack line → shells separate → sunny yolk
      if (chops === 0) {
        drawIngredient(ctx, bi.id, 0, 0, 54, {});
      } else if (chops < maxChops) {
        const cr = chops / maxChops;
        drawIngredient(ctx, bi.id, 0, 6 * cr, 50, { cracked: true, showShell: true, crackSep: cr * 0.5 * sep });
      } else {
        drawIngredient(ctx, bi.id, 0, 8, 54, { cracked: true, showShell: true, crackSep: 0.6 + 0.4 * sep });
      }
      if (chops < maxChops && !ks.active) {
        ctx.save();
        const pulse = (t * 1.4) % 1;
        ctx.strokeStyle = `rgba(255, 255, 255, ${(0.85 * (1 - pulse)).toFixed(3)})`;
        ctx.lineWidth = 3;
        ell(ctx, 0, 0, 32 + pulse * 18, 40 + pulse * 20);
        ctx.stroke();
        const bob = Math.sin(t * 4) * 4;
        drawIcon(ctx, 'arrow_down', 0, -48 + bob, 12, t);
        ctx.restore();
      }
    } else if (tool === 'pour') {
      // Pouring liquid into a little cream pitcher bowl that fills up
      ctx.fillStyle = '#FFFDF9';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(30, 4, 46, 0, PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const liq = lighten(col, bi.id === 'milk' ? 0 : 0.1);
      if (prog > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(30, 4, 44, 0, PI);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = liq;
        const lvl = 4 + 44 - prog * 44;
        ctx.fillRect(-30, lvl, 120, 60);
        ctx.fillStyle = lighten(liq, 0.45);
        ell(ctx, 30, lvl, 44, 5);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#FFFDF9';
      ell(ctx, 30, 4, 46, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#E87A82';
      heart(ctx, 30, 26, 7);
      ctx.fill();
      // Tilting bottle / jar with pour stream when the action fires
      const pourK = ks.active ? bump(seg(ks.t, 0.15, 0.95)) : 0;
      ctx.save();
      ctx.translate(-52, -46 - pourK * 10);
      ctx.rotate(0.35 + pourK * 0.9);
      drawIngredient(ctx, bi.id, 0, 0, 40, { shadow: false });
      ctx.restore();
      if (pourK > 0.05) {
        ctx.fillStyle = liq;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-22, -46);
        ctx.quadraticCurveTo(0, -30, 18, 4 - prog * 40);
        ctx.quadraticCurveTo(10, -26, -22, -40);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (tool === 'pin') {
      // Slice 6 (30:00-36:00): Rolling pin flattening dough & Cookie Cutter Stamper (star, heart, bear)
      const flat = prog;
      const shapes = ['star', 'heart', 'bear'];
      // 1. Rolled-out dough sheet on the left/center with physical 3D cross-section edge
      ctx.save();
      const sheetX = bi.id === 'dough' ? -24 : 0;
      const sheetRx = 62 + flat * 34;
      const sheetRy = 46 - flat * 8;
      // Physical extruded cross-section thickness wall of rolled dough
      ctx.fillStyle = '#E2C578';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.8;
      ell(ctx, sheetX, 5, sheetRx, sheetRy);
      ctx.fill();
      ctx.stroke();
      // Top creamy dough surface
      ctx.fillStyle = '#FFF1C2';
      ell(ctx, sheetX, 0, sheetRx, sheetRy);
      ctx.fill();
      ctx.stroke();
      // Powdery flour dusting specks on dough
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (let k = 0; k < 7; k++) {
        circ(ctx, sheetX + (hash(k + 2) - 0.5) * sheetRx * 1.2, (hash(k + 6) - 0.5) * sheetRy * 1.1, 2.2);
        ctx.fill();
      }

      if (bi.id === 'dough') {
        // 2. Physical indented cutout wells inside the rolled dough sheet for each stamped cookie!
        const wellSlots = [[-42, -4], [0, 4], [42, -4]];
        for (let i = 0; i < Math.min(3, chops); i++) {
          const [wx, wy] = wellSlots[i];
          const shp = shapes[i];
          ctx.save();
          ctx.translate(sheetX + wx * 0.78, wy);
          // Inner dough wall cross-section rim + exposed wooden cutting board floor
          drawCookieCutoutWell(ctx, 0, 0, 17, shp);
          ctx.restore();
        }

        // 3. Stamped 3D Cookies (Star, Heart, Bear) popped out onto the right side of the board
        for (let i = 0; i < Math.min(3, chops); i++) {
          const isNew = i === chops - 1;
          const p = isNew ? sep : 1;
          const [wx, wy] = wellSlots[i];
          const startX = sheetX + wx * 0.78;
          const slotX = 64 + i * 32;
          const slotY = -10 + (i % 2) * 20;
          const px = lerp(startX, slotX, p);
          const py = lerp(wy, slotY, p) - (isNew ? Math.sin(p * PI) * 14 : 0);
          const sc = isNew ? (0.85 + Math.sin(p * PI) * 0.22) : 1;
          ctx.save();
          ctx.translate(px, py);
          ctx.scale(sc, sc);
          ctx.rotate((-0.18 + i * 0.18) * p);
          drawStampedCookie(ctx, 0, 0, 21, shapes[i], 0, '#FFF1C2');
          ctx.restore();
        }

        // 4. Cookie cutter stamper rack above the dough sheet (Star, Heart, Bear)
        const activeIdx = Math.min(2, chops);
        for (let i = 0; i < 3; i++) {
          const cxSlot = -54 + i * 54;
          const cySlot = -58;
          const isCurrent = i === activeIdx && chops < maxChops;
          const done = i < chops;
          ctx.save();
          ctx.translate(cxSlot, cySlot + (isCurrent ? Math.sin(t * 5) * 2.5 : 0));
          if (isCurrent) ctx.scale(1.12, 1.12);
          drawCookieCutter(ctx, 0, 0, 15, shapes[i], done ? 0.35 : 0, false);
          ctx.restore();
        }
      }
      ctx.restore();

      if (!ks.active && prog < 1) {
        ctx.save();
        const bobX = Math.sin(t * 3) * 10;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -(t * 24);
        ctx.beginPath();
        ctx.moveTo(-50, 0);
        ctx.lineTo(50, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        drawIcon(ctx, 'arrow_right', bobX, -38, 12, t);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let k = 0; k < 8; k++) {
        const phf = (t * 0.6 + hash(k)) % 1;
        if (!ks.active && phf > 0.5) continue;
        circ(ctx, (hash(k + 3) - 0.5) * 140, -30 - phf * 30 + 20, 2 + hash(k + 5) * 2);
        ctx.fill();
      }
    } else if (!meta.choppable) {
      // Scoops / pearls / candy: press & sparkle
      drawIngredient(ctx, bi.id, 0, 0, 58, {});
      if (prog > 0) {
        ctx.fillStyle = '#F7C948';
        for (let k = 0; k < chops * 2; k++) {
          const a = (k / Math.max(1, chops * 2)) * PI2 + t * 0.8;
          sparkle4(ctx, Math.cos(a) * 70, Math.sin(a) * 36, 6, t * 2 + k);
          ctx.fill();
        }
      }
    } else {
      // Choppable: remaining whole piece shrinks at the cut; slices fan out right
      const shrink = 1 - prog * 0.55;
      const wholeX = chops > 0 ? cutLX - 50 * shrink : 0;
      const cutFaceX = wholeX + 54 * shrink * 0.85;
      if (prog < 1) {
        drawIngredient(ctx, bi.id, wholeX, 0, 54, { sliced: false, scaleX: shrink, scaleY: 1 - prog * 0.1 });
        // Cut face on the remaining piece
        if (chops > 0) {
          ctx.fillStyle = lighten(meta.inner || '#FFFFFF', 0.2);
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 2.5;
          ell(ctx, cutFaceX, 0, 8, 40 * (1 - prog * 0.1));
          ctx.fill();
          ctx.stroke();
          if (meta.velcro) {
            ctx.fillStyle = '#FFFDF9';
            ctx.strokeStyle = '#C9B8A3';
            ctx.lineWidth = 1.6;
            ell(ctx, cutFaceX + 1, 0, 4.5, 13 * (1 - prog * 0.1));
            ctx.fill();
            ctx.stroke();
          }
        }
      }
      const n = Math.min(4, chops);
      for (let i = 0; i < n; i++) {
        const isNew = i === n - 1;
        const slotX = cutLX + 36 + i * 36;
        const slotRot = -0.28 + i * 0.14;
        let px = slotX, py = 0, rot = slotRot, sc = 1;
        if (isNew) {
          const p = sep;
          px = lerp(cutLX + 6, slotX, p);
          py = 0; // Grounded on the board/dish, zero flying junk!
          rot = lerp(0.6, slotRot, p);
          sc = 1 + Math.sin(p * PI) * 0.06;
          if (meta.velcro && p > 0.02 && p < 0.82) {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 253, 249, ${(0.88 * (1 - p / 0.82)).toFixed(3)})`;
            ctx.lineWidth = 1.8;
            for (let vf = -2; vf <= 2; vf++) {
              const vy = vf * 4.5;
              ctx.beginPath();
              ctx.moveTo(cutFaceX + 2, vy);
              ctx.lineTo(px - 10, vy * 0.7);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
        drawIngredient(ctx, bi.id, px, py, 40, { sliced: true, rot, scaleX: sc, scaleY: sc });
      }
      // Intuitive animated slice guide across the cut zone when waiting for chop
      if (prog < 1 && !ks.active) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3.5;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -(t * 30);
        ctx.beginPath();
        ctx.moveTo(cutLX, -38);
        ctx.lineTo(cutLX, 38);
        ctx.stroke();
        ctx.setLineDash([]);
        const bob = Math.sin(t * 4) * 4;
        drawIcon(ctx, 'arrow_down', cutLX, -46 + bob, 12, t);
        ctx.restore();
      }
    }
    ctx.restore();

    // ---- Progress markers (opt-in: game.js draws its own pips by default) ----
    if (s.drawProgress) {
      for (let i = 0; i < maxChops; i++) {
      const done = i < chops;
      const popIn = done && i === chops - 1 && ks.active ? easeOutBack(seg(ks.t, 0.45, 0.8)) : 1;
      ctx.save();
      ctx.translate(cx + 96 + i * 24, cy + 66 + recoil);
      ctx.scale(popIn, popIn);
      ctx.fillStyle = done ? '#78C47C' : '#FFFDF9';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      circ(ctx, 0, 0, 8);
      ctx.fill();
      ctx.stroke();
        if (done) {
          ctx.fillStyle = '#FFFFFF';
          heart(ctx, 0, 0.5, 4);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // ---- Knife / rolling pin choreography ----
    if (tool !== 'pour') {
      const restX = cx + 150, restY = cy - 52, restA = -0.62;
      let kx, ky, ka;
      const hover = Math.sin(t * 3) * 3;
      if (ks.pose && typeof ks.pose.x === 'number') {
        kx = ks.pose.x; ky = ks.pose.y; ka = ks.pose.angle || 0;
      } else if (!ks.active) {
        kx = restX; ky = restY + hover; ka = restA + Math.sin(t * 3) * 0.04;
      } else {
        const tt = ks.t;
        const upX = restX - 30, upY = restY - 46, upA = -1.05;
        if (tt < 0.3) {
          const p = easeOutCubic(tt / 0.3);
          kx = lerp(restX, upX, p); ky = lerp(restY, upY, p); ka = lerp(restA, upA, p);
        } else if (tt < 0.45) {
          const p = easeInCubic((tt - 0.3) / 0.15);
          kx = lerp(upX, cutX, p); ky = lerp(upY, cutY, p); ka = lerp(upA, -0.06, p);
        } else if (tt < 0.6) {
          const p = (tt - 0.45) / 0.15;
          kx = cutX; ky = cutY + Math.sin(p * PI) * 2 + recoil; ka = -0.06 + p * 0.04;
        } else {
          const p = easeOutCubic((tt - 0.6) / 0.4);
          kx = lerp(cutX, restX, p); ky = lerp(cutY, restY + hover, p); ka = lerp(-0.02, restA, p);
        }
      }
      const strike = ks.active ? seg(ks.t, 0.3, 0.46) : 0;
      // Motion-blur swoosh & ghost blades during the strike
      if (ks.active && ks.t > 0.3 && ks.t < 0.62) {
        const fade = 1 - seg(ks.t, 0.46, 0.62);
        const upX = restX - 30, upY = restY - 46;
        ctx.save();
        ctx.lineCap = 'round';
        for (let w = 0; w < 3; w++) {
          ctx.strokeStyle = `rgba(255,255,255,${(0.55 - w * 0.15) * fade * clamp01(strike * 2)})`;
          ctx.lineWidth = 16 - w * 5;
          ctx.beginPath();
          ctx.moveTo(upX - 30, upY + 10);
          ctx.quadraticCurveTo(upX - 20, cutY - 10, cutX - 20 + strike * 20, cutY - 4);
          ctx.stroke();
        }
        if (strike > 0 && strike < 1) {
          for (let g = 1; g <= 3; g++) {
            const p = easeInCubic(clamp01(strike - g * 0.14));
            const gx = lerp(upX, cutX, p), gy = lerp(upY, cutY, p), ga = lerp(-1.05, -0.06, p);
            if (tool === 'pin') drawRollingPin(ctx, gx, gy, 44, ga, 0.22 - g * 0.06);
            else drawKnife(ctx, gx, gy, 56, ga, null, { ghost: 0.26 - g * 0.07 });
          }
        }
        ctx.restore();
      }
      // Knife shadow on the board when close to it
      const h = clamp01((ky - (cy - 90)) / 60);
      ctx.fillStyle = `rgba(92,61,46,${(0.12 * h).toFixed(3)})`;
      ell(ctx, kx - 10, cy - 2 + recoil, 60 * h, 8 * h, 0);
      ctx.fill();
      if (tool === 'pin') {
        drawRollingPin(ctx, kx, ky, 44, ka);
        if (bi && bi.id === 'dough' && ks.active) {
          const stampIdx = clamp((bi.chops || 1) - 1, 0, 2);
          const stampShape = ['star', 'heart', 'bear'][stampIdx];
          const pressP = bump(seg(ks.t, 0.25, 0.75));
          drawCookieCutter(ctx, cutX - 18, cutY - 16 + pressP * 14, 22, stampShape, pressP, false);
        }
      } else drawKnife(ctx, kx, ky, 56, ka, ks.active ? seg(ks.t, 0.3, 0.9) : (0.5 + 0.5 * Math.sin(t * 1.4)) * 0.6);

      // Impact burst + juice droplets
      if (ks.active && ks.t >= 0.45) {
        const p = seg(ks.t, 0.45, 0.95);
        const flash = 1 - seg(ks.t, 0.45, 0.62);
        if (flash > 0) {
          ctx.strokeStyle = `rgba(255,255,255,${(0.9 * flash).toFixed(3)})`;
          ctx.lineWidth = 3;
          for (let k = 0; k < 7; k++) {
            const a = PI + 0.25 + (k / 6) * (PI - 0.5);
            const r0 = 14 + (1 - flash) * 16, r1 = r0 + 10 * flash;
            ctx.beginPath();
            ctx.moveTo(cutX + Math.cos(a) * r0, cutY + 2 + Math.sin(a) * r0 * 0.7);
            ctx.lineTo(cutX + Math.cos(a) * r1, cutY + 2 + Math.sin(a) * r1 * 0.7);
            ctx.stroke();
          }
        }
        if (meta.choppable || meta.crackable) {
          const dropCol = meta.crackable ? '#F7E6D0' : (meta.inner && meta.inner !== '#ffffff' ? meta.inner : col);
          for (let k = 0; k < 7; k++) {
            const a = PI + 0.2 + hash(k) * (PI - 0.4);
            const v = 50 + hash(k + 3) * 70;
            const dx = cutX + Math.cos(a) * v * p * 0.9;
            const dy = cutY + Math.sin(a) * v * p * 0.5 + 170 * p * p;
            const al = (1 - p) * 0.95;
            drawParticle(ctx, { x: dx, y: dy, r: 3 + hash(k + 5) * 2.5, kind: 'droplet', color: rgba(dropCol, al), rot: Math.atan2(Math.sin(a) * v * 0.5 + 340 * p, Math.cos(a) * v * 0.9) + PI / 2 }, t);
          }
        }
      }
    }
    ctx.restore();
  }

  /** Wooden rolling pin. Origin = barrel centre; angle rotates it. */
  function drawRollingPin(ctx, x, y, r, angle, ghost) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.lineCap = 'round';
    if (ghost) {
      ctx.fillStyle = `rgba(235, 200, 160, ${ghost})`;
      rr(ctx, -r, -r * 0.3, r * 2, r * 0.6, r * 0.3);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.8, r * 0.07);
    ctx.fillStyle = '#B97A4C';
    rr(ctx, -r * 1.42, -r * 0.14, r * 0.5, r * 0.28, r * 0.14);
    ctx.fill();
    ctx.stroke();
    rr(ctx, r * 0.92, -r * 0.14, r * 0.5, r * 0.28, r * 0.14);
    ctx.fill();
    ctx.stroke();
    const g = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.3);
    g.addColorStop(0, '#F2CFA6');
    g.addColorStop(0.5, '#E6B88A');
    g.addColorStop(1, '#C9915C');
    ctx.fillStyle = g;
    rr(ctx, -r, -r * 0.3, r * 2, r * 0.6, r * 0.3);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160,105,60,0.35)';
    ctx.lineWidth = 1.4;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, i * r * 0.12);
      ctx.lineTo(r * 0.8, i * r * 0.12 + 1);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Helper path for cookie shape ('star' | 'heart' | 'bear') centered at (0,0) with radius r. */
  function traceCookieShapePath(ctx, r, shape) {
    if (shape === 'heart') {
      heart(ctx, 0, -r * 0.08, r * 0.95);
    } else if (shape === 'bear') {
      // Cozy teddy bear head silhouette (ears + round cheeks)
      ctx.beginPath();
      ctx.arc(-r * 0.56, -r * 0.52, r * 0.34, PI * 0.65, PI * 1.95);
      ctx.arc(0, 0, r * 0.78, -PI * 0.68, -PI * 0.32);
      ctx.arc(r * 0.56, -r * 0.52, r * 0.34, -PI * 0.95, PI * 0.35);
      ctx.arc(0, r * 0.06, r * 0.78, -PI * 0.12, PI * 1.12);
      ctx.closePath();
    } else {
      // 'star': Plump 5-point patisserie butter cookie star
      star(ctx, 0, 0, r * 0.98, r * 0.52, 5, 0);
    }
  }

  /** Physical indented cutout well left in rolled dough sheet after stamping a cookie (Slice 6). */
  function drawCookieCutoutWell(ctx, x, y, r, shape) {
    ctx.save();
    ctx.translate(x, y);
    // Exposed warm oak board floor inside the punched-out hole
    ctx.fillStyle = '#C9935B';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    traceCookieShapePath(ctx, r, shape);
    ctx.fill();
    // Inner dough cross-section wall visible along the top edge of the cutout well
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#E5C678';
    ctx.translate(0, 3.5);
    traceCookieShapePath(ctx, r, shape);
    ctx.fill();
    ctx.fillStyle = '#C58B52';
    ctx.translate(0, 2.5);
    traceCookieShapePath(ctx, r, shape);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    traceCookieShapePath(ctx, r, shape);
    ctx.stroke();
    ctx.restore();
  }

  /** 3D extruded stamped cookie ('star' | 'heart' | 'bear') with physical cross-section edge & baking progression (Slice 6). */
  function drawStampedCookie(ctx, x, y, r, shape, cooked, tintColor) {
    const ck = clamp01(cooked || 0);
    const rawCol = tintColor || '#FFF1C2';
    const topCol = lerpColor(rawCol, '#F2AE49', ck * 0.85);
    const sideCol = lerpColor('#DEC072', '#C87A28', ck * 0.9);
    const embossCol = lerpColor('#D9B26F', '#B3651B', ck * 0.85);
    const thick = Math.max(3.5, r * 0.24 * (1 + ck * 0.25)); // Puffs up as it bakes!

    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Soft drop shadow
    ctx.fillStyle = 'rgba(92, 61, 46, 0.16)';
    ctx.save();
    ctx.translate(1.5, thick + 2);
    traceCookieShapePath(ctx, r, shape);
    ctx.fill();
    ctx.restore();

    // 1. Extruded 3D side wall (physical cookie thickness cross-section)
    ctx.fillStyle = sideCol;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.8, r * 0.1);
    ctx.save();
    ctx.translate(0, thick);
    traceCookieShapePath(ctx, r, shape);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 2. Top baked cookie face
    ctx.fillStyle = topCol;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.8, r * 0.1);
    traceCookieShapePath(ctx, r, shape);
    ctx.fill();
    ctx.stroke();

    // 3. Cute embossed patisserie stamp details on the cookie face
    ctx.strokeStyle = embossCol;
    ctx.fillStyle = embossCol;
    ctx.lineWidth = Math.max(1.2, r * 0.065);
    if (shape === 'bear') {
      // Bear inner ears, snout & smiling face emboss
      circ(ctx, -r * 0.48, -r * 0.44, r * 0.13);
      ctx.fill();
      circ(ctx, r * 0.48, -r * 0.44, r * 0.13);
      ctx.fill();
      ctx.fillStyle = lerpColor('#FFFDF9', '#FFE0A3', ck * 0.7);
      ell(ctx, 0, r * 0.12, r * 0.28, r * 0.2);
      ctx.fill();
      ctx.fillStyle = OUTLINE;
      circ(ctx, -r * 0.24, -r * 0.08, r * 0.08);
      circ(ctx, r * 0.24, -r * 0.08, r * 0.08);
      circ(ctx, 0, r * 0.06, r * 0.07);
      ctx.fill();
    } else if (shape === 'heart') {
      // Inner quilted heart emboss + rosy strawberry jam dot when baked
      ctx.save();
      ctx.scale(0.62, 0.62);
      heart(ctx, 0, -r * 0.08, r * 0.95);
      ctx.stroke();
      ctx.restore();
      if (ck > 0.25) {
        ctx.fillStyle = '#FF5A79';
        heart(ctx, 0, -r * 0.05, r * 0.34);
        ctx.fill();
      }
    } else {
      // Inner star emboss + golden sugar crystals
      star(ctx, 0, 0, r * 0.56, r * 0.3, 5, 0);
      ctx.stroke();
    }

    // Specular butter sheen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    circ(ctx, -r * 0.25, -r * 0.26, r * 0.12);
    ctx.fill();
    ctx.restore();
  }

  /** Pastel Patisserie Cookie Cutter Stamper with spring-loaded plunger handle (Slice 6). */
  function drawCookieCutter(ctx, x, y, r, shape, pressProgress, ghost) {
    const p = clamp01(pressProgress || 0);
    const palette = {
      star:  { rim: '#FFD166', body: '#FFE599', plunger: '#F4A261' },
      heart: { rim: '#FF7096', body: '#FFA6C1', plunger: '#E84A72' },
      bear:  { rim: '#7EC8E3', body: '#AEDFF2', plunger: '#4FA3C7' },
    }[shape] || { rim: '#FFD166', body: '#FFE599', plunger: '#F4A261' };

    ctx.save();
    ctx.translate(x, y);
    if (ghost) ctx.globalAlpha *= ghost;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Outer pastel enamel cutting wall
    ctx.fillStyle = palette.body;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(2.0, r * 0.11);
    traceCookieShapePath(ctx, r * 1.08, shape);
    ctx.fill();
    ctx.stroke();

    // Inner hollow stamping die cavity
    ctx.fillStyle = palette.rim;
    traceCookieShapePath(ctx, r * 0.82, shape);
    ctx.fill();
    ctx.stroke();

    // Spring-loaded top plunger knob (compresses downward with pressProgress)
    const knobY = -r * 0.38 + p * (r * 0.26);
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.8, r * 0.09);
    rr(ctx, -r * 0.2, knobY, r * 0.4, r * 0.42 * (1 - p * 0.35), r * 0.12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.plunger;
    ell(ctx, 0, knobY, r * 0.38, r * 0.18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    circ(ctx, -r * 0.12, knobY - r * 0.03, r * 0.07);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- Station 2: Ceramic bowl vortex + blender + Slice 2 Ice Cream Parlor / Aquarium / Doll Care ---------- */
  function drawMixStation(ctx, cx, cy, s, t) {
    s = s || {};
    const mode = s.mixMode || 'bowl';
    if (mode === 'icecream' || mode === 'parlor') {
      drawIceCreamParlor(ctx, cx, cy, s, t);
      return;
    }
    if (mode === 'aquarium' || mode === 'fishbowl') {
      drawAquariumStation(ctx, cx, cy, s, t);
      return;
    }
    if (mode === 'dollcare' || mode === 'doll') {
      drawDollCareStation(ctx, cx, cy, s, t);
      return;
    }
    if (mode === 'toaster') {
      drawToasterAppliance(ctx, cx, cy, s, t);
      return;
    }
    if (mode === 'microwave') {
      drawMicrowaveAppliance(ctx, cx, cy, s, t);
      return;
    }
    const items = s.mixItems || [];
    const prog = clamp01(s.mixProgress || 0);
    const swirl = s.mixSwirlAngle !== undefined ? s.mixSwirlAngle : (s.mixAngle || 0);
    const vel = Math.abs(s.mixVelocity || 0);
    const velN = clamp01(vel / 6);
    const spring = s.boardSpring || { sx: 1, sy: 1 };
    const mixColor = s.mixColor || '#FFF5DC';
    const tilt = s.bowlTilt !== undefined ? s.bowlTilt : Math.sin(swirl) * 0.035 * velN;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.translate(cx, cy);
    ctx.scale(spring.sx || 1, spring.sy || 1);

    if (mode === 'blender') {
      const speedSetting = clamp(s.blenderSpeed || 2, 1, 3);
      const shake = velN * Math.sin(t * (32 + speedSetting * 12)) * (1.2 + speedSetting * 0.4);
      ctx.translate(shake, 0);
      softShadow(ctx, 0, 84, 80, 16, 0.2);
      // Base unit with 3-speed motorized buttons (1 = Low, 2 = Med/Start, 3 = Turbo Pulse)
      const bgd = ctx.createLinearGradient(-70, 0, 70, 0);
      bgd.addColorStop(0, '#D9867A');
      bgd.addColorStop(0.5, '#F0A79B');
      bgd.addColorStop(1, '#D9867A');
      ctx.fillStyle = bgd;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.5;
      rr(ctx, -66, 36, 132, 46, 16);
      ctx.fill();
      ctx.stroke();
      // Left button (Speed 1 / Low)
      ctx.fillStyle = speedSetting === 1 ? '#FFE599' : '#FFF7EB';
      circ(ctx, -28, 60, 7.5);
      ctx.fill();
      ctx.stroke();
      // Center power / pulse button
      ctx.fillStyle = velN > 0.1 ? '#78C47C' : '#E8998D';
      circ(ctx, 0, 60, 9.5);
      ctx.fill();
      ctx.stroke();
      if (velN <= 0.1 && prog < 1) {
        ctx.save();
        const pulse = (t * 1.5) % 1;
        ctx.strokeStyle = `rgba(255, 255, 255, ${(0.85 * (1 - pulse)).toFixed(3)})`;
        ctx.lineWidth = 2.5;
        circ(ctx, 0, 60, 11 + pulse * 14);
        ctx.stroke();
        const bob = Math.sin(t * 5) * 3;
        drawIcon(ctx, 'arrow_down', 0, 42 + bob, 9, t);
        ctx.restore();
      }
      // Right button (Speed 3 / Turbo)
      ctx.fillStyle = speedSetting === 3 ? '#FFD166' : '#FFF7EB';
      circ(ctx, 28, 60, 7.5);
      ctx.fill();
      ctx.stroke();
      // Glass pitcher
      const pitcher = () => {
        ctx.beginPath();
        ctx.moveTo(-74, -92);
        ctx.lineTo(-62, 36);
        ctx.quadraticCurveTo(0, 44, 62, 36);
        ctx.lineTo(74, -92);
        ctx.closePath();
      };
      ctx.fillStyle = 'rgba(235, 248, 252, 0.6)';
      pitcher();
      ctx.fill();
      // Liquid with vortex + frothy smoothie foam cap
      const fillH = Math.max(40, Math.min(118, 40 + items.length * 20));
      const topY = 36 - fillH;
      ctx.save();
      pitcher();
      ctx.clip();
      const lg = ctx.createLinearGradient(0, topY, 0, 36);
      lg.addColorStop(0, lighten(mixColor, 0.25));
      lg.addColorStop(1, darken(mixColor, 0.08));
      ctx.fillStyle = lg;
      const slosh = Math.sin(t * 9) * 6 * velN;
      ctx.beginPath();
      ctx.moveTo(-80, topY + slosh);
      ctx.quadraticCurveTo(0, topY - 10 * velN + slosh * 0.3, 80, topY - slosh);
      ctx.lineTo(80, 60);
      ctx.lineTo(-80, 60);
      ctx.closePath();
      ctx.fill();
      // Smoothie frothy foam crown at top surface when blended
      if (prog > 0.12) {
        ctx.fillStyle = rgba(lighten(mixColor, 0.55), 0.72 * clamp01(prog * 1.3));
        for (let f = -3; f <= 3; f++) {
          ell(ctx, f * 19, topY + Math.sin(t * 6 + f) * 2 * velN, 15, 5 + prog * 4);
          ctx.fill();
        }
      }
      // Vortex cone + fruit puree ribbons
      if (velN > 0.05) {
        for (let i = 0; i < 5; i++) {
          const yy = topY + 4 + i * (fillH / 5) * 0.8;
          const rx = (60 - i * 11) * (0.5 + velN * 0.5);
          ctx.strokeStyle = `rgba(255,255,255,${(0.38 * velN).toFixed(3)})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(0, yy, Math.max(2, rx), Math.max(1, rx * 0.3), 0, swirl * 2 + i, swirl * 2 + i + PI * 1.4);
          ctx.stroke();
        }
        ctx.fillStyle = darken(mixColor, 0.2);
        ell(ctx, 0, topY + 8, 10 * velN, 4 * velN);
        ctx.fill();
      }
      // Swirling fruit chunks inside (3D helical orbit + vertical convection loop)
      items.forEach((it, idx) => {
        const a = swirl * (1.4 + velN * 0.8) + (idx * PI2) / Math.max(1, items.length);
        const rad = (1 - prog * 0.6) * 38;
        const vertCycle = Math.sin(t * (2.5 + velN * 4) + idx * 1.7) * 0.5 + 0.5;
        const iy = topY + 18 + vertCycle * Math.max(16, fillH - 34);
        const sc = Math.max(7, 21 * (1 - prog * 0.55));
        drawIngredient(ctx, it.id, Math.cos(a) * rad, iy, sc, {
          sliced: true,
          shadow: false,
          rot: a * 1.3 + idx,
          scaleX: 0.62 + 0.38 * Math.abs(Math.sin(a)),
        });
      });
      // Bubbles
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (let k = 0; k < 12; k++) {
        const phb = (t * (0.3 + velN * 1.35) + hash(k)) % 1;
        circ(ctx, (hash(k + 3) - 0.5) * 100, 30 - phb * (fillH - 10), 1.5 + hash(k + 6) * 2.5);
        ctx.fill();
      }
      ctx.restore();
      // Blades at base
      ctx.save();
      ctx.translate(0, 28);
      ctx.rotate(swirl * 4);
      ctx.fillStyle = '#B8C5CE';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        ctx.rotate(PI / 2);
        rr(ctx, 4, -3, 22, 6, 3);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      // Glass outline, measurement ticks (no text) & highlight
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.5;
      pitcher();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(92,61,46,0.3)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(52, -70 + k * 26);
        ctx.lineTo(62, -70 + k * 26);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-58, -74);
      ctx.lineTo(-50, 20);
      ctx.stroke();
      // Lid with cap (wobbles with velocity)
      ctx.save();
      ctx.translate(0, -92 + Math.sin(t * 30) * velN * 1.5);
      ctx.fillStyle = '#8FB9A8';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      rr(ctx, -80, -8, 160, 18, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#E8998D';
      rr(ctx, -20, -24, 40, 18, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.restore();
      return;
    }

    // ---- Miniature Crystal Glass Mixing Bowl (Translucent & ASMR) ----
    ctx.rotate(tilt);
    softShadow(ctx, 0, 100, 120, 22, 0.22);

    // Clear glass foot ring
    ctx.fillStyle = 'rgba(230, 245, 252, 0.65)';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.5;
    ell(ctx, 0, 106, 58, 12);
    ctx.fill();
    ctx.stroke();
    // Glass bowl body below the rim
    const bodyG = ctx.createLinearGradient(-140, 0, 140, 0);
    bodyG.addColorStop(0, 'rgba(225, 242, 250, 0.7)');
    bodyG.addColorStop(0.35, 'rgba(245, 252, 255, 0.55)');
    bodyG.addColorStop(1, 'rgba(215, 238, 248, 0.7)');
    ctx.fillStyle = bodyG;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-140, 0);
    ctx.bezierCurveTo(-140, 78, -72, 112, 0, 112);
    ctx.bezierCurveTo(72, 112, 140, 78, 140, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Glass reflections
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-110, 20);
    ctx.quadraticCurveTo(-90, 75, -40, 95);
    ctx.stroke();
    // Rim
    const bowlG = ctx.createLinearGradient(-140, -40, 140, 60);
    bowlG.addColorStop(0, 'rgba(240, 250, 255, 0.9)');
    bowlG.addColorStop(0.5, 'rgba(220, 240, 250, 0.8)');
    bowlG.addColorStop(1, 'rgba(200, 230, 245, 0.9)');
    ctx.fillStyle = bowlG;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    ell(ctx, 0, 0, 140, 84);
    ctx.fill();
    ctx.stroke();

    // Little prep bowls flanking the mixing bowl: ONLY the ingredients the player actually
    // prepped (their real colours) — no invented rainbow bowls, nothing when empty.
    const sideIds = [];
    (s.mixIds || items.map(it => it.id)).forEach(id => { if (id && sideIds.indexOf(id) < 0) sideIds.push(id); });
    sideIds.slice(0, 6).forEach((id, rIdx) => {
      const rx0 = rIdx % 2 === 0 ? -178 - Math.floor(rIdx / 2) * 30 : 178 + Math.floor(rIdx / 2) * 30;
      const ry0 = 18 + (rIdx % 3) * 4;
      const meta = ingMeta(id);
      const fillCol = meta && meta.liquid ? (meta.color || '#FFFFFF') : spongeColorFor(id);
      ctx.save();
      softShadow(ctx, rx0, ry0 + 6, 20, 7, 0.16);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      ell(ctx, rx0, ry0, 21, 11);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = fillCol;
      ell(ctx, rx0, ry0 - 2, 16, 7.5);
      ctx.fill();
      if (!(meta && meta.liquid)) {
        drawIngredient(ctx, id, rx0, ry0 - 6, 9, { sliced: !!(meta && meta.choppable), shadow: false });
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      circ(ctx, rx0 - 5, ry0 - 5, 2.2);
      ctx.fill();
      ctx.restore();
    });
    ctx.fillStyle = 'rgba(92,61,46,0.12)';
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * PI2;
      circ(ctx, Math.cos(a) * 128, Math.sin(a) * 76, 1.6 + hash(k) * 1.2);
      ctx.fill();
    }
    // Batter surface
    const batterInner = () => ell(ctx, 0, 2, 120, 70);
    const batG = ctx.createRadialGradient(-20, -12, 10, 0, 2, 120);
    batG.addColorStop(0, lighten(mixColor, 0.22));
    batG.addColorStop(1, darken(mixColor, 0.06));
    ctx.fillStyle = batG;
    batterInner();
    ctx.fill();
    ctx.stroke();

    ctx.save();
    batterInner();
    ctx.clip();
    // Marble vortex ribbons (ingredient colours blend in with progress)
    const ribbonCols = [lighten(mixColor, 0.5), darken(mixColor, 0.12)];
    items.forEach(it => ribbonCols.push(KitchenData.getIngredient(it.id).color));
    const arms = Math.min(6, ribbonCols.length + 2);
    for (let arm = 0; arm < arms; arm++) {
      const colr = ribbonCols[arm % ribbonCols.length];
      const alpha = arm < 2 ? 0.55 : lerp(0.75, 0.22, prog);
      ctx.strokeStyle = rgba(colr, alpha) || colr;
      ctx.lineCap = 'round';
      const twist = 2.4 + prog * 1.6;
      for (let w = 0; w < 2; w++) {
        ctx.lineWidth = w === 0 ? 9 - prog * 3 : 4;
        if (w === 1) ctx.strokeStyle = rgba(lighten(colr, 0.45), alpha * 0.7);
        ctx.beginPath();
        for (let k = 0; k <= 22; k++) {
          const u = k / 22;
          const rad = 6 + u * 112;
          const a = swirl + (arm * PI2) / arms + u * twist;
          const px = Math.cos(a) * rad, py = 2 + Math.sin(a) * rad * 0.58;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    // Central dimple grows with velocity
    ctx.fillStyle = darken(mixColor, 0.16);
    ell(ctx, 0, 4, 10 + 12 * velN, 4 + 6 * velN);
    ctx.fill();
    // Raw chunks orbit, bob and shrink into the batter
    items.forEach((it, idx) => {
      const a = swirl * 0.9 + (idx * PI2) / Math.max(1, items.length);
      const rad = (1 - prog * 0.72) * (40 + (idx % 3) * 8);
      const bob = Math.sin(t * 4 + idx * 1.3) * 2;
      const pop = it.scale === undefined ? 1 : clamp01(it.scale);
      const sc = Math.max(8, 24 * (1 - prog * 0.62)) * pop;
      if (sc < 1) return;
      drawIngredient(ctx, it.id, Math.cos(a) * rad, 2 + Math.sin(a) * rad * 0.6 + bob, sc, {
        sliced: true, shadow: false, rot: a * 0.5 + idx,
      });
    });
    // Batter glaze over chunks (makes them look submerged)
    ctx.fillStyle = rgba(mixColor, 0.3);
    batterInner();
    ctx.fill();
    ctx.restore();

    // Glossy rim highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 132, 78, 0, PI * 1.1, PI * 1.6);
    ctx.stroke();

    // Orbiting balloon whisk (leans outward, lags behind the vortex)
    const wa = s.whiskOrbit !== undefined ? s.whiskOrbit : swirl;
    const held = clamp01(s.whiskHeld || 0);
    const wx = Math.cos(wa) * 38, wy = 2 + Math.sin(wa) * 20 - held * 16;
    drawWhisk(ctx, wx, wy - 10, 30, Math.cos(wa) * 0.4 + held * 0.25 + Math.sin(t * 2) * 0.03);
    ctx.fillStyle = rgba(mixColor, 0.45 * (1 - held));
    ell(ctx, wx, wy + 4 + held * 16, 18, 7);
    ctx.fill();

    // Intuitive swirling dotted guide arc when idle waiting for mix
    if (prog < 1 && held <= 0.1 && velN < 0.1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 3.2;
      ctx.setLineDash([7, 7]);
      ctx.lineDashOffset = -(t * 32);
      ctx.beginPath();
      ctx.ellipse(0, 4, 62, 34, 0, 0, PI2);
      ctx.stroke();
      ctx.setLineDash([]);

      const promptA = t * 2.2;
      const pax = Math.cos(promptA) * 62;
      const pay = 4 + Math.sin(promptA) * 34;
      ctx.save();
      ctx.translate(pax, pay);
      ctx.rotate(promptA + PI * 0.5);
      drawIcon(ctx, 'arrow_right', 0, 0, 11, t);
      ctx.restore();
      ctx.restore();
    }

    // Done sparkles
    if (prog >= 1) {
      ctx.fillStyle = '#F7C948';
      for (let k = 0; k < 6; k++) {
        const a = t * 1.5 + (k / 6) * PI2;
        sparkle4(ctx, Math.cos(a) * 150, -20 + Math.sin(a) * 60, 7 + Math.sin(t * 6 + k) * 2, t * 2 + k);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ==========================================================================
   * Slice 2 (06:00 - 12:00): Ice Cream Parlor, Soft-Serve Machine, Multi-Scoop
   * Cone Stacking, Pet Fish Aquarium Cleaning & Flake Drops, and Doll Care
   * ========================================================================== */
  function drawWaffleConeBase(ctx, x, y, scale) {
    const sc = scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    // Brass cone holder stand
    softShadow(ctx, 0, 52, 34, 9, 0.2);
    ctx.fillStyle = '#F4CF82';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ell(ctx, 0, 50, 28, 8);
    ctx.fill();
    ctx.stroke();
    // Waffle cone triangle
    const cg = ctx.createLinearGradient(-32, -16, 32, 48);
    cg.addColorStop(0, '#E8AD66');
    cg.addColorStop(0.5, '#D99648');
    cg.addColorStop(1, '#B8762E');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(-32, -14);
    ctx.lineTo(32, -14);
    ctx.lineTo(0, 50);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Cross-hatched baked waffle grid
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(92, 61, 46, 0.35)';
    ctx.lineWidth = 1.6;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 12 - 20, -18);
      ctx.lineTo(i * 12 + 20, 52);
      ctx.moveTo(i * 12 + 20, -18);
      ctx.lineTo(i * 12 - 20, 52);
      ctx.stroke();
    }
    ctx.restore();
    // Scalloped waffle collar rim
    ctx.fillStyle = '#ECC07E';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ell(ctx, 0, -14, 34, 9);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawIceCreamParlor(ctx, cx, cy, s, t) {
    s = s || {};
    const sl2 = s.slice2 || {};
    const spring = s.boardSpring || { sx: 1, sy: 1 };
    const flavors = (typeof KitchenData !== 'undefined' && KitchenData.ICE_CREAM_FLAVORS) || [
      { id: 'strawberry_swirl', color: '#FF7096', hi: '#FFD1DC' },
      { id: 'vanilla_bean', color: '#FFF5DC', hi: '#FFFDF9' },
      { id: 'mint_pistachio', color: '#88E0A0', hi: '#D4F7DC' },
      { id: 'choco_fudge', color: '#6B3E26', hi: '#9C6344' },
      { id: 'blueberry_cloud', color: '#78B0FF', hi: '#CFE2FF' },
      { id: 'mango_peach', color: '#FFB35C', hi: '#FFE4BD' },
    ];
    const activeFlavorIdx = clamp(sl2.flavorIdx || 0, 0, flavors.length - 1);
    const activeFlavor = flavors[activeFlavorIdx] || flavors[0];
    const leverPull = clamp01(sl2.leverPull || 0);
    const softServeTiers = sl2.softServeTiers || [];
    const coneScoops = sl2.coneScoops || [];

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.translate(cx, cy);
    ctx.scale(spring.sx || 1, spring.sy || 1);

    // 1. Left Side: Pastel Soft-Serve Dispenser Machine (-92, 0)
    ctx.save();
    ctx.translate(-92, 6);
    softShadow(ctx, 0, 88, 78, 16, 0.22);
    // Drip tray base
    ctx.fillStyle = '#A8D8C8';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;
    rr(ctx, -68, 52, 136, 36, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFDF9';
    rr(ctx, -52, 58, 104, 14, 7);
    ctx.fill();
    ctx.stroke();

    // Machine body column
    const mg = ctx.createLinearGradient(-62, -96, 62, 52);
    mg.addColorStop(0, '#FFFDF9');
    mg.addColorStop(0.55, '#FAF0E4');
    mg.addColorStop(1, '#EAD8C2');
    ctx.fillStyle = mg;
    rr(ctx, -60, -88, 120, 142, 18);
    ctx.fill();
    ctx.stroke();

    // Upper pastel pink header hood with 3 transparent flavor hoppers
    ctx.fillStyle = '#F2A2B0';
    rr(ctx, -64, -104, 128, 42, 16);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const hx = -36 + i * 36;
      const flv = flavors[(activeFlavorIdx + i) % flavors.length];
      ctx.fillStyle = flv.color;
      circ(ctx, hx, -83, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      circ(ctx, hx - 4, -87, 3.5);
      ctx.fill();
    }

    // Extruder star nozzle
    ctx.fillStyle = '#D9B89C';
    rr(ctx, -16, -54, 32, 20, 6);
    ctx.fill();
    ctx.stroke();

    // Interactive Pull-Down Dispenser Lever (right side of machine)
    const leverAngle = lerp(-0.45, 0.65, leverPull);
    ctx.save();
    ctx.translate(48, -48);
    ctx.rotate(leverAngle);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(28, -14);
    ctx.stroke();
    ctx.fillStyle = '#FF7096';
    ctx.lineWidth = 2.8;
    circ(ctx, 30, -15, 11);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Active Soft-Serve Extruding Stream when lever is pulled
    if (leverPull > 0.08) {
      ctx.fillStyle = activeFlavor.color;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      const streamH = 38 * leverPull;
      ctx.beginPath();
      ctx.moveTo(-8, -34);
      ctx.quadraticCurveTo(Math.sin(t * 24) * 5, -34 + streamH * 0.5, 0, -34 + streamH);
      ctx.lineTo(8, -34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Soft-serve waffle cone under nozzle + coiled soft-serve swirl tiers
    drawWaffleConeBase(ctx, 0, 14, 0.78);
    softServeTiers.forEach((tier, idx) => {
      const ty = 2 - idx * 14;
      const rx = Math.max(11, 26 - idx * 4.2);
      const ry = 9.5;
      ctx.fillStyle = tier.color || activeFlavor.color;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ell(ctx, 0, ty, rx, ry);
      ctx.fill();
      ctx.stroke();
      // Glossy ridge
      ctx.strokeStyle = tier.hi || '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, ty - 2, rx * 0.6, PI * 1.1, PI * 1.8);
      ctx.stroke();
      if (idx === softServeTiers.length - 1) {
        // Curly peak curl at top of soft-serve
        ctx.fillStyle = tier.color || activeFlavor.color;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-rx * 0.55, ty - 3);
        ctx.quadraticCurveTo(0, ty - 22, rx * 0.35, ty - 14);
        ctx.quadraticCurveTo(rx * 0.55, ty - 4, rx * 0.45, ty - 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    });
    ctx.restore();

    // 2. Right Side: Multi-Scoop Waffle Cone Stacker Stand (88, 12)
    ctx.save();
    ctx.translate(88, 18);
    drawWaffleConeBase(ctx, 0, 22, 0.96);

    // Stacked Ice Cream Scoops with spring wobble & scalloped skirts
    coneScoops.forEach((sc, idx) => {
      const sy = 4 - idx * 26 + (sc.dy || 0);
      const wobX = Math.sin(t * 4.5 + idx) * 1.8;
      const r = Math.max(19, 26 - idx * 1.5);
      ctx.save();
      ctx.translate(wobX, sy);
      ctx.scale(sc.sx || 1, sc.sy || 1);
      ctx.fillStyle = sc.color || '#FF7096';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.8;
      circ(ctx, 0, 0, r);
      ctx.fill();
      ctx.stroke();
      // Scalloped scoop skirt at bottom of scoop
      for (let k = -2; k <= 2; k++) {
        circ(ctx, k * (r * 0.38), r * 0.68, r * 0.28);
        ctx.fill();
        ctx.stroke();
      }
      // Gouache highlight
      ctx.fillStyle = sc.hi || 'rgba(255,255,255,0.65)';
      ell(ctx, -r * 0.32, -r * 0.32, r * 0.28, r * 0.16, -0.45);
      ctx.fill();
      // Rainbow sprinkles on top scoop
      if (idx === coneScoops.length - 1 && coneScoops.length >= 2) {
        const cols = ['#FF5252', '#FFD54F', '#4FC3F7', '#81C784', '#BA68C8'];
        for (let sp = 0; sp < 6; sp++) {
          ctx.save();
          ctx.translate((sp - 2.5) * 6, -6 - (sp % 2) * 5);
          ctx.rotate(sp * 0.7);
          ctx.fillStyle = cols[sp % cols.length];
          rr(ctx, -3.5, -1.5, 7, 3, 1.5);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
    });

    // Flavor tubs along the front base for tapping to scoop
    for (let i = 0; i < flavors.length; i++) {
      const fx = -132 + i * 42;
      const fy = 92;
      const fl = flavors[i];
      const isSel = i === activeFlavorIdx;
      ctx.save();
      ctx.translate(fx - 88, fy - 18);
      if (isSel) ctx.scale(1.12, 1.12);
      ctx.fillStyle = '#FFFDF9';
      ctx.strokeStyle = isSel ? '#E85D75' : OUTLINE;
      ctx.lineWidth = isSel ? 3 : 2.2;
      rr(ctx, -17, -12, 34, 24, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = fl.color;
      ell(ctx, 0, -2, 13, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    ctx.restore();
  }

  function drawAquariumStation(ctx, cx, cy, s, t) {
    s = s || {};
    const sl2 = s.slice2 || {};
    const spring = s.boardSpring || { sx: 1, sy: 1 };
    const algae = sl2.algaeSpots || [];
    const flakes = sl2.fishFlakes || [];
    const fishList = sl2.fish || [
      { x: -38, y: 8, vx: 1, color: '#FF8C42', fin: '#FFD166', size: 19 },
      { x: 42, y: -14, vx: -1, color: '#66B2FF', fin: '#BAE0FF', size: 15 },
    ];

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.translate(cx, cy);
    ctx.scale(spring.sx || 1, spring.sy || 1);

    softShadow(ctx, 0, 96, 136, 20, 0.22);

    // Panoramic Crystal Fishbowl / Aquarium Tank
    const tankPath = () => {
      rr(ctx, -132, -78, 264, 166, 48);
    };
    ctx.fillStyle = 'rgba(225, 248, 255, 0.72)';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    tankPath();
    ctx.fill();

    ctx.save();
    tankPath();
    ctx.clip();

    // Water gradient fill with animated surface wave
    const wg = ctx.createLinearGradient(0, -56, 0, 88);
    wg.addColorStop(0, 'rgba(178, 238, 248, 0.78)');
    wg.addColorStop(1, 'rgba(108, 202, 220, 0.86)');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(-140, -50);
    for (let x = -140; x <= 140; x += 28) {
      const wy = -50 + Math.sin(t * 3.2 + x * 0.04) * 4;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(140, 95);
    ctx.lineTo(-140, 95);
    ctx.closePath();
    ctx.fill();

    // Sandy gravel bed & pastel pebbles
    ctx.fillStyle = '#F2D6AE';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ell(ctx, 0, 78, 128, 22);
    ctx.fill();
    ctx.stroke();
    const pebbleCols = ['#E8998D', '#9CD3C2', '#F4CF82', '#C9B3E8', '#A9C7EE'];
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = pebbleCols[i % pebbleCols.length];
      ell(ctx, -96 + i * 24, 74 + (i % 2) * 5, 9, 5.5, (i - 4) * 0.15);
      ctx.fill();
      ctx.stroke();
    }

    // Swaying aquatic seaweeds
    [-86, -52, 64, 92].forEach((sx, idx) => {
      ctx.strokeStyle = idx % 2 === 0 ? '#52B788' : '#74C69D';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(sx, 72);
      const sway = Math.sin(t * 2.4 + idx) * 10;
      ctx.quadraticCurveTo(sx + sway, 32, sx - sway * 0.6, -4);
      ctx.stroke();
    });

    // Rising water bubbles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.strokeStyle = 'rgba(92, 61, 46, 0.35)';
    ctx.lineWidth = 1.4;
    for (let b = 0; b < 8; b++) {
      const progB = (t * 0.42 + b * 0.17) % 1;
      const bx = -85 + ((b * 47) % 170) + Math.sin(t * 3 + b) * 6;
      const by = 62 - progB * 108;
      const br = 2.5 + (b % 3) * 1.6;
      circ(ctx, bx, by, br);
      ctx.fill();
      ctx.stroke();
    }

    // Falling Fish Food Flake Drops
    flakes.forEach((fl, idx) => {
      ctx.save();
      ctx.translate(fl.x || 0, fl.y || 0);
      ctx.rotate(t * 2 + idx);
      ctx.fillStyle = fl.color || '#FFB742';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.4;
      ell(ctx, 0, 0, 4.5, 2.8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // Animated Swimming Pet Fish
    fishList.forEach((f, idx) => {
      const fx = Number.isFinite(f.x) ? f.x : (idx === 0 ? -36 : 38);
      const fy = Number.isFinite(f.y) ? f.y : (idx === 0 ? 8 : -12);
      const dir = (f.vx || 1) >= 0 ? 1 : -1;
      const sz = f.size || 18;
      const wag = Math.sin(t * 9 + idx * 2) * 0.24;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.scale(dir, 1);
      // Tail fin
      ctx.save();
      ctx.translate(-sz * 0.85, 0);
      ctx.rotate(wag);
      ctx.fillStyle = f.fin || '#FFD166';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-sz * 0.75, -sz * 0.55);
      ctx.quadraticCurveTo(-sz * 0.45, 0, -sz * 0.75, sz * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // Fish body
      ctx.fillStyle = f.color || '#FF8C42';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ell(ctx, 0, 0, sz, sz * 0.68);
      ctx.fill();
      ctx.stroke();
      // Cheek & eye
      ctx.fillStyle = '#FFFDF9';
      circ(ctx, sz * 0.45, -sz * 0.14, sz * 0.22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = OUTLINE;
      circ(ctx, sz * 0.5, -sz * 0.14, sz * 0.1);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 110, 140, 0.45)';
      ell(ctx, sz * 0.28, sz * 0.14, sz * 0.18, sz * 0.1);
      ctx.fill();
      ctx.restore();
    });

    // Scrubbable Green Algae Spots on the glass wall
    algae.forEach((sp, idx) => {
      const op = clamp01(sp.opacity !== undefined ? sp.opacity : 1);
      if (op <= 0.02) return;
      ctx.save();
      ctx.globalAlpha = op * 0.72;
      ctx.fillStyle = '#68B872';
      ctx.strokeStyle = '#3E7A48';
      ctx.lineWidth = 1.8;
      blob(ctx, sp.x || 0, sp.y || 0, (sp.r || 20) * op, (sp.r || 20) * 0.78 * op, idx + 2, 0.22, 7);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    ctx.restore(); // end tank clip

    // Tank outer rim & wood-trimmed top collar
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    tankPath();
    ctx.stroke();
    ctx.fillStyle = '#E8998D';
    rr(ctx, -138, -88, 276, 18, 9);
    ctx.fill();
    ctx.stroke();

    // Interactive Magnetic Sponge Scrubber (left tool) & Fish Flake Shaker Bottle (top-right tool)
    const sx = Number.isFinite(sl2.spongeX) ? sl2.spongeX : -95;
    const sy = Number.isFinite(sl2.spongeY) ? sl2.spongeY : 24;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.sin(t * 4) * 0.08);
    ctx.fillStyle = '#F7DC6F';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    rr(ctx, -22, -14, 44, 28, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#78C47C';
    rr(ctx, -22, -14, 44, 9, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Fish Flake Shaker Canister (top right above tank)
    const shakeTilt = (sl2.shakerTilt || 0) + Math.sin(t * 3) * 0.05;
    ctx.save();
    ctx.translate(108, -102);
    ctx.rotate(-0.45 - shakeTilt);
    ctx.fillStyle = '#FFB742';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    rr(ctx, -16, -24, 32, 46, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E85D75';
    rr(ctx, -18, -30, 36, 10, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  function drawDollCareStation(ctx, cx, cy, s, t) {
    s = s || {};
    const sl2 = s.slice2 || {};
    const spring = s.boardSpring || { sx: 1, sy: 1 };
    const happiness = clamp01(sl2.dollHappiness !== undefined ? sl2.dollHappiness : 0.5);
    const pacifierIn = !!sl2.pacifierIn;
    const bottleTilt = clamp01(sl2.bottleAnim || 0);
    const brushAnim = clamp01(sl2.brushAnim || 0);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.translate(cx, cy);
    ctx.scale(spring.sx || 1, spring.sy || 1);

    softShadow(ctx, 0, 96, 128, 20, 0.22);

    // Quilted Pastel Cradle Cushion
    ctx.fillStyle = '#FADADD';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.6;
    rr(ctx, -116, -78, 232, 164, 52);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFDF9';
    ell(ctx, 0, -34, 78, 42);
    ctx.fill();
    ctx.stroke();

    // Cute Chibi Baby Doll in ruffled bonnet & pastel romper
    const bob = Math.sin(t * 2.8) * 2.5;
    ctx.save();
    ctx.translate(0, bob);
    // Romper torso
    ctx.fillStyle = '#B8E0D2';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;
    ell(ctx, 0, 34, 54, 44);
    ctx.fill();
    ctx.stroke();
    // Scalloped lace bib
    ctx.fillStyle = '#FFFDF9';
    ctx.beginPath();
    ctx.arc(0, 12, 34, 0, PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    heart(ctx, 0, 24, 9);
    ctx.fillStyle = '#FF85A6';
    ctx.fill();
    ctx.stroke();

    // Ruffled baby bonnet & head
    ctx.fillStyle = '#F7C6D4';
    circ(ctx, 0, -24, 48);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFE6D4';
    circ(ctx, 0, -20, 38);
    ctx.fill();
    ctx.stroke();

    // Forelock curl
    ctx.strokeStyle = '#8C532B';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, -48, 10, 0.2, PI * 1.3);
    ctx.stroke();

    // Expressive eyes & rosy cheeks
    ctx.fillStyle = OUTLINE;
    circ(ctx, -14, -22, 4.5);
    ctx.fill();
    circ(ctx, 14, -22, 4.5);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    circ(ctx, -15.5, -23.5, 1.6);
    ctx.fill();
    circ(ctx, 12.5, -23.5, 1.6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 115, 145, 0.45)';
    ell(ctx, -22, -13, 8, 4.5);
    ctx.fill();
    ell(ctx, 22, -13, 8, 4.5);
    ctx.fill();

    // Mouth or Pacifier
    if (pacifierIn) {
      ctx.fillStyle = '#9CD3C2';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      ell(ctx, 0, -8, 13, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F4CF82';
      circ(ctx, 0, -8, 5);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -11, 7, 0.15 * PI, 0.85 * PI);
      ctx.stroke();
    }
    ctx.restore();

    // Interactive Care Tools around the Cradle:
    // (A) Warm Milk Baby Bottle (left: -96, 12, moves to mouth when active)
    const bx = lerp(-96, -24, bottleTilt);
    const by = lerp(12, -18, bottleTilt);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(lerp(-0.25, 0.85, bottleTilt));
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    rr(ctx, -14, -18, 28, 44, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFF3D6';
    rr(ctx, -11, -4, 22, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#FF94B0';
    rr(ctx, -15, -25, 30, 9, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F4CF82';
    ell(ctx, 0, -32, 6, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // (B) Pastel Grooming Hairbrush (right: 96, 12, sweeps hair when active)
    const brX = lerp(96, 26, brushAnim);
    const brY = lerp(12, -48, brushAnim);
    ctx.save();
    ctx.translate(brX, brY);
    ctx.rotate(lerp(0.3, -0.5, brushAnim));
    ctx.fillStyle = '#E8998D';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ell(ctx, 0, -12, 16, 20);
    ctx.fill();
    ctx.stroke();
    rr(ctx, -6, 6, 12, 26, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFDF9';
    ell(ctx, 0, -12, 11, 14);
    ctx.fill();
    ctx.restore();

    // Floating love hearts & sparkles reflecting doll happiness
    const heartCount = Math.max(1, Math.round(happiness * 5));
    for (let i = 0; i < heartCount; i++) {
      const a = t * 1.4 + (i * PI2) / heartCount;
      const hx = Math.cos(a) * 86;
      const hy = -28 + Math.sin(a * 1.5) * 32;
      ctx.fillStyle = i % 2 === 0 ? '#FF7096' : '#F7C948';
      heart(ctx, hx, hy, 6 + Math.sin(t * 4 + i) * 1.5);
      ctx.fill();
    }

    ctx.restore();
  }

  /* ==========================================================================
   * Station 7 (Slice 7: 36:00 - 42:00): Bento Box & Savory Meal Builder
   *  - Rolling & slicing sushi maki rolls on a bamboo mat (makisu) with cross-sections
   *  - Multi-layer cheeseburger builder with ketchup & mustard squeeze bottles
   *  - Whistling stovetop tea kettle & porcelain teacup pouring
   * ========================================================================== */
  function drawBambooMatRoll(ctx, cx, cy, r, rollProgress, sliceCount, knifeAnimT, t) {
    r = r || 72;
    const rollP = clamp01(rollProgress || 0);
    const slices = clamp(Math.floor(sliceCount || 0), 0, 4);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Hinoki cypress sushi board base
    softShadow(ctx, 0, 12, r * 1.18, r * 0.72, 0.2);
    ctx.fillStyle = '#F2D7B0';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.8;
    rr(ctx, -r * 1.12, -r * 0.68, r * 2.24, r * 1.36, 14);
    ctx.fill();
    ctx.stroke();

    if (rollP < 0.98) {
      // Unrolled / folding Bamboo Mat (Makisu) with Nori, Rice & Filling Strips
      const matH = r * (1.08 - rollP * 0.42);
      ctx.fillStyle = '#D9B37C';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      rr(ctx, -r * 0.92, -matH * 0.5, r * 1.84, matH, 8);
      ctx.fill();
      ctx.stroke();
      // Woven bamboo slats + cotton string ties
      ctx.strokeStyle = 'rgba(138, 92, 46, 0.45)';
      ctx.lineWidth = 1.4;
      for (let k = -4; k <= 4; k++) {
        const sy = (k / 4.5) * (matH * 0.44);
        ctx.beginPath();
        ctx.moveTo(-r * 0.86, sy);
        ctx.lineTo(r * 0.86, sy);
        ctx.stroke();
      }
      // Roasted Nori sheet
      ctx.fillStyle = '#26382E';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      rr(ctx, -r * 0.78, -matH * 0.42, r * 1.56, matH * 0.84, 5);
      ctx.fill();
      ctx.stroke();
      // Seasoned white sushi rice bed
      ctx.fillStyle = '#FFFDF9';
      rr(ctx, -r * 0.72, -matH * 0.36, r * 1.44, matH * 0.72, 5);
      ctx.fill();
      // 3 vibrant filling strips: Salmon (#FF6E54), Cucumber (#5CB868), Tamago (#FFD54F)
      const strips = [
        { y: -matH * 0.14, col: '#FF6E54' },
        { y: 0,            col: '#5CB868' },
        { y: matH * 0.14,  col: '#FFD54F' },
      ];
      strips.forEach(st => {
        ctx.fillStyle = st.col;
        rr(ctx, -r * 0.68, st.y - 4.5, r * 1.36, 9, 4);
        ctx.fill();
      });
      // Folding bamboo mat curl bar sweeping across as player rolls
      const curlY = -matH * 0.48 + rollP * matH * 0.68;
      ctx.fillStyle = '#C6995E';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      rr(ctx, -r * 0.95, curlY - 12, r * 1.9, 24, 11);
      ctx.fill();
      ctx.stroke();
      // End-cap preview on right edge of rolling cylinder
      if (rollP > 0.2) {
        ctx.fillStyle = '#FFFDF9';
        ell(ctx, r * 0.88, curlY, 7, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FF6E54';
        circ(ctx, r * 0.88, curlY, 3.5);
        ctx.fill();
      }
    } else if (slices < 4) {
      // Tightly rolled Nori Maki Log being sliced into 4 medallions
      const remFraction = (4 - slices) / 4;
      const logW = r * 1.56 * remFraction;
      const logX0 = -r * 0.78;
      if (slices < 4) {
        ctx.fillStyle = '#26382E';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.6;
        rr(ctx, logX0, -r * 0.28, logW, r * 0.56, r * 0.24);
        ctx.fill();
        ctx.stroke();
        // Exposed cross-section on the cut end of the log
        const capX = logX0 + logW - 6;
        ctx.fillStyle = '#FFFDF9';
        ell(ctx, capX, 0, r * 0.15, r * 0.25);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FF6E54';
        circ(ctx, capX - 2, -4, 4.5);
        ctx.fill();
        ctx.fillStyle = '#5CB868';
        circ(ctx, capX + 3, 2, 4);
        ctx.fill();
        ctx.fillStyle = '#FFD54F';
        circ(ctx, capX - 2, 4, 4);
        ctx.fill();
      }
      // Already-sliced Maki Medallions showing full cross-section
      for (let i = 0; i < slices; i++) {
        const sx = r * 0.62 - i * (r * 0.36);
        const sy = (i % 2 === 0 ? -8 : 10);
        drawIngredient(ctx, 'maki', sx, sy, r * 0.3, { sliced: true, shadow: true, rot: i * 0.15 });
      }
      // Santoku knife slicing animation
      const kt = clamp01(knifeAnimT || 0);
      const cutX = logX0 + logW - r * 0.18;
      const cutY = -r * 0.32 + Math.sin(kt * PI) * 22;
      drawKnife(ctx, cutX + 28, cutY, r * 0.52, -0.35 + Math.sin(kt * PI) * 0.28, kt);
    } else {
      // All 4 Maki Medallions freshly sliced & arranged in a neat bento row
      const positions = [
        [-r * 0.56, -r * 0.16], [r * 0.04, -r * 0.16],
        [-r * 0.56, r * 0.26],  [r * 0.04, r * 0.26],
      ];
      positions.forEach(([mx, my], idx) => {
        drawIngredient(ctx, 'maki', mx, my, r * 0.33, { sliced: true, shadow: true, rot: idx * 0.18 });
      });
      // Pickled pink ginger (gari) & wasabi leaf beside the sliced maki
      ctx.fillStyle = '#F7A8B8';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      ell(ctx, r * 0.68, -r * 0.16, 15, 10, -0.3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8BC34A';
      circ(ctx, r * 0.68, r * 0.2, 11);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawMultiLayerBurger(ctx, cx, cy, scale, layers, condiments, squeezeBottleAnim, t) {
    scale = scale || 1;
    const layerList = Array.isArray(layers) ? layers : ['bun_bottom', 'lettuce', 'tomato', 'beef', 'cheese', 'bun_top'];
    const conds = Array.isArray(condiments) ? condiments : [];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Ceramic burger platter
    softShadow(ctx, 0, 42, 76, 22, 0.2);
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.8;
    ell(ctx, 0, 36, 76, 24);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#E8D5C4';
    ctx.lineWidth = 1.8;
    ell(ctx, 0, 36, 58, 17);
    ctx.stroke();

    // Stack layers from bottom to top with springy vertical offset
    let curY = 28;
    layerList.forEach((layerId, idx) => {
      const isLast = idx === layerList.length - 1;
      const pop = isLast && squeezeBottleAnim && squeezeBottleAnim.layerPop ? Math.sin(squeezeBottleAnim.layerPop * PI) * 8 : 0;
      const ly = curY - pop;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.6;

      if (layerId === 'bun_bottom') {
        ctx.fillStyle = '#DE923B';
        ell(ctx, 0, ly, 58, 18);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F7DFB5';
        ell(ctx, 0, ly - 4, 54, 13);
        ctx.fill();
        curY -= 11;
      } else if (layerId === 'lettuce') {
        ctx.fillStyle = '#72C276';
        for (let k = 0; k < 10; k++) {
          const a = (k * PI2) / 10;
          circ(ctx, Math.cos(a) * 52, ly + Math.sin(a) * 12, 10);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#88D48C';
        ell(ctx, 0, ly, 48, 13);
        ctx.fill();
        curY -= 10;
      } else if (layerId === 'tomato') {
        ctx.fillStyle = '#E35242';
        ell(ctx, -16, ly, 32, 11);
        ctx.fill();
        ctx.stroke();
        ell(ctx, 16, ly, 32, 11);
        ctx.fill();
        ctx.stroke();
        curY -= 10;
      } else if (layerId === 'beef') {
        ctx.fillStyle = '#7A3B22';
        ell(ctx, 0, ly, 56, 16);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(42, 18, 8, 0.55)';
        ctx.lineWidth = 2.2;
        for (let g = -2; g <= 2; g++) {
          ctx.beginPath();
          ctx.moveTo(g * 12 - 5, ly - 6);
          ctx.lineTo(g * 12 + 5, ly + 4);
          ctx.stroke();
        }
        curY -= 11;
      } else if (layerId === 'cheese') {
        ctx.fillStyle = '#FFC424';
        ctx.beginPath();
        ctx.moveTo(-54, ly - 4);
        ctx.lineTo(54, ly - 4);
        ctx.lineTo(48, ly + 7);
        ctx.lineTo(24, ly + 2);
        ctx.lineTo(10, ly + 12);
        ctx.lineTo(-12, ly + 3);
        ctx.lineTo(-32, ly + 10);
        ctx.lineTo(-48, ly + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        curY -= 9;
      } else if (layerId === 'bacon') {
        ctx.fillStyle = '#C94A38';
        rr(ctx, -44, ly - 5, 88, 9, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F4A698';
        rr(ctx, -38, ly - 2, 76, 3, 1.5);
        ctx.fill();
        curY -= 9;
      } else if (layerId === 'egg') {
        ctx.fillStyle = '#FFFDF9';
        ell(ctx, 0, ly, 44, 13);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFA726';
        ell(ctx, 0, ly - 3, 18, 7);
        ctx.fill();
        ctx.stroke();
        curY -= 10;
      } else if (layerId === 'bun_top') {
        // Draw squeezed ketchup & mustard ribbons right under the crown bun
        conds.forEach((cCol, ci) => {
          ctx.strokeStyle = cCol;
          ctx.lineWidth = 5;
          ctx.beginPath();
          for (let x = -40; x <= 40; x += 5) {
            const wy = curY + 5 - ci * 3 + Math.sin(x * 0.16 + ci * 1.7) * 3.5;
            if (x === -40) ctx.moveTo(x, wy);
            else ctx.lineTo(x, wy);
          }
          ctx.stroke();
        });
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.8;
        ctx.fillStyle = '#E8A352';
        ctx.beginPath();
        ctx.ellipse(0, ly - 4, 58, 25, 0, PI, 0);
        ctx.quadraticCurveTo(58, ly + 5, 0, ly + 5);
        ctx.quadraticCurveTo(-58, ly + 5, -58, ly - 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        gloss(ctx, -22, ly - 16, 18, 7, -0.25, 0.38);
        ctx.fillStyle = '#FFF5CC';
        [[-26, ly - 14], [-8, ly - 21], [12, ly - 19], [28, ly - 13], [-16, ly - 7], [8, ly - 8]].forEach(([sx, sy]) => {
          ell(ctx, sx, sy, 3.5, 1.8, sx * 0.01);
          ctx.fill();
        });
        curY -= 22;
      }
    });

    // If crown bun isn't placed yet, show squeezed condiment ribbons on top of current layer
    if (layerList.indexOf('bun_top') < 0 && conds.length > 0) {
      conds.forEach((cCol, ci) => {
        ctx.strokeStyle = cCol;
        ctx.lineWidth = 5;
        ctx.beginPath();
        for (let x = -40; x <= 40; x += 5) {
          const wy = curY + 4 - ci * 3 + Math.sin(x * 0.16 + ci * 1.7) * 3.5;
          if (x === -40) ctx.moveTo(x, wy);
          else ctx.lineTo(x, wy);
        }
        ctx.stroke();
      });
    }

    // Twin Ketchup (#E3392B) & Mustard (#F5C422) Squeeze Bottles standing beside the burger platter
    const sqT = squeezeBottleAnim && squeezeBottleAnim.squeezeT ? clamp01(squeezeBottleAnim.squeezeT) : 0;
    const sqCol = (squeezeBottleAnim && squeezeBottleAnim.color) || '#E3392B';
    drawSauceBottle(ctx, -74, -6, 22, 0.25, '#E3392B', sqCol === '#E3392B' ? sqT : 0);
    drawSauceBottle(ctx, 74, -6, 22, -0.25, '#F5C422', sqCol === '#F5C422' ? sqT : 0);

    ctx.restore();
  }

  function drawWhistlingKettle(ctx, cx, cy, r, heatP, whistling, pourP, t) {
    r = r || 56;
    const hP = clamp01(heatP || 0);
    const pP = clamp01(pourP || 0);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Mini induction / stovetop warmer base on the left of the zone
    const kx = -r * 0.42;
    const ky = r * 0.12 - pP * r * 0.48;
    softShadow(ctx, kx, r * 0.62, r * 0.72, r * 0.22, 0.22);
    ctx.fillStyle = '#EADBC8';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ell(ctx, kx, r * 0.56, r * 0.68, r * 0.2);
    ctx.fill();
    ctx.stroke();
    // Glowing warmer ring when heating
    ctx.fillStyle = hP > 0.1 ? lerpColor('#FFB74D', '#FF5252', hP) : '#C9B29B';
    ell(ctx, kx, r * 0.54, r * 0.48, r * 0.13);
    ctx.fill();

    // Porcelain Teacup & Saucer on the right of the zone
    const cupX = r * 0.66, cupY = r * 0.44;
    softShadow(ctx, cupX, cupY + 18, r * 0.52, r * 0.16, 0.2);
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ell(ctx, cupX, cupY + 12, r * 0.48, r * 0.15);
    ctx.fill();
    ctx.stroke();
    // Teacup body
    ctx.fillStyle = '#FFFDF9';
    ctx.beginPath();
    ctx.moveTo(cupX - r * 0.34, cupY - r * 0.18);
    ctx.quadraticCurveTo(cupX - r * 0.3, cupY + r * 0.22, cupX, cupY + r * 0.22);
    ctx.quadraticCurveTo(cupX + r * 0.3, cupY + r * 0.22, cupX + r * 0.34, cupY - r * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Cup rim & green tea fill level
    ctx.fillStyle = '#F5EDE2';
    ell(ctx, cupX, cupY - r * 0.18, r * 0.34, r * 0.11);
    ctx.fill();
    ctx.stroke();
    if (pP > 0.05) {
      const fillR = r * (0.18 + pP * 0.13);
      ctx.fillStyle = '#9CCC65';
      ell(ctx, cupX, cupY - r * 0.16 + (1 - pP) * 5, fillR, fillR * 0.32);
      ctx.fill();
      // Rising fragrant tea steam
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      for (let s = -1; s <= 1; s += 2) {
        const sx = cupX + s * 8;
        const wv = Math.sin(t * 4 + s) * 3.5;
        ctx.beginPath();
        ctx.moveTo(sx, cupY - r * 0.24);
        ctx.quadraticCurveTo(sx + wv, cupY - r * 0.46, sx - wv, cupY - r * 0.68);
        ctx.stroke();
      }
    }

    // Pouring stream from tilted kettle spout into teacup
    if (pP > 0.05 && pP < 0.98) {
      const spoutX = kx + r * 0.62;
      const spoutY = ky - r * 0.08;
      ctx.strokeStyle = '#9CCC65';
      ctx.lineWidth = 6.5;
      ctx.beginPath();
      ctx.moveTo(spoutX, spoutY);
      ctx.quadraticCurveTo((spoutX + cupX) * 0.5 + 8, spoutY - 8, cupX, cupY - r * 0.16);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(spoutX, spoutY);
      ctx.quadraticCurveTo((spoutX + cupX) * 0.5 + 6, spoutY - 8, cupX - 2, cupY - r * 0.16);
      ctx.stroke();
    }

    // Enameled Whistling Tea Kettle (tilts when pouring, vibrates when whistling)
    ctx.save();
    const shudder = whistling ? Math.sin(t * 36) * 2.2 : 0;
    const tilt = pP > 0 && pP < 0.98 ? 0.52 * Math.sin(clamp01(pP * 1.1) * PI * 0.85) : 0;
    ctx.translate(kx + shudder, ky);
    ctx.rotate(tilt);

    // Arching handle
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.arc(0, -r * 0.18, r * 0.54, PI * 1.08, PI * 1.92);
    ctx.stroke();
    ctx.strokeStyle = '#D99B52';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, -r * 0.18, r * 0.54, PI * 1.25, PI * 1.75);
    ctx.stroke();

    // Spout & Flip-open Whistle Cap
    ctx.fillStyle = '#9CCC65';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(r * 0.34, 0);
    ctx.lineTo(r * 0.78, -r * 0.34);
    ctx.lineTo(r * 0.66, -r * 0.48);
    ctx.lineTo(r * 0.24, -r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Red whistle cap on spout
    ctx.fillStyle = '#E85D75';
    circ(ctx, r * 0.75, -r * 0.41, r * 0.12);
    ctx.fill();
    ctx.stroke();

    // Whistle steam puffs & acoustic wave arcs when whistling
    if (whistling || (hP >= 0.85 && pP < 0.2)) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2.4;
      for (let w = 1; w <= 3; w++) {
        const pulse = ((t * 2.6 + w * 0.33) % 1);
        const wr = r * (0.14 + pulse * 0.36);
        ctx.globalAlpha = 1 - pulse;
        ctx.beginPath();
        ctx.arc(r * 0.86, -r * 0.48, wr, -PI * 0.55, PI * 0.15);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Dome kettle body
    const kg = ctx.createRadialGradient(-r * 0.2, -r * 0.05, 4, 0, r * 0.1, r * 0.68);
    kg.addColorStop(0, '#C5E1A5');
    kg.addColorStop(0.65, '#8BC34A');
    kg.addColorStop(1, '#689F38');
    ctx.fillStyle = kg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, r * 0.16, r * 0.58, PI, 0);
    ctx.lineTo(r * 0.64, r * 0.44);
    ctx.quadraticCurveTo(0, r * 0.56, -r * 0.64, r * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lid & wooden knob
    ctx.fillStyle = '#FFFDF9';
    ell(ctx, 0, -r * 0.36, r * 0.3, r * 0.09);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#D99B52';
    circ(ctx, 0, -r * 0.47, r * 0.1);
    ctx.fill();
    ctx.stroke();
    gloss(ctx, -r * 0.25, r * 0.05, r * 0.14, r * 0.22, -0.3, 0.45);
    ctx.restore();

    ctx.restore();
  }

  function drawBentoStation(ctx, cx, cy, s, t) {
    s = s || {};
    t = t || 0;
    const bento = s.bento || {};
    const spring = s.boardSpring || { sx: 1, sy: 1 };
    const rollP = clamp01(bento.makiRollProgress || 0);
    const makiSlices = clamp(Math.floor(bento.makiSlices || 0), 0, 4);
    const burgerLayers = bento.burgerLayers || ['bun_bottom', 'lettuce', 'tomato', 'beef', 'cheese', 'bun_top'];
    const condiments = bento.condiments || ['#E3392B', '#F5C422'];
    const kettleHeat = clamp01(bento.kettleHeat || 0);
    const kettleWhistling = !!bento.kettleWhistling;
    const teaPour = clamp01(bento.teaPourProgress || 0);
    const activeZone = bento.activeZone || 'sushi';

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(spring.sx || 1, spring.sy || 1);
    ctx.translate(-cx, -cy);

    // 1. Left Zone: Bamboo Mat Sushi Maki Roll & Slicing (cx - 168, cy + 20)
    const sushiX = cx - 168, sushiY = cy + 20;
    drawBambooMatRoll(ctx, sushiX, sushiY, 64, rollP, makiSlices, bento.knifeAnimT || 0, t);

    // 2. Center Zone: Multi-Layer Cheeseburger Builder & Condiments (cx, cy + 16)
    const burgerX = cx, burgerY = cy + 16;
    drawMultiLayerBurger(ctx, burgerX, burgerY, 0.96, burgerLayers, condiments, bento.squeezeAnim, t);

    // 3. Right Zone: Whistling Stovetop Tea Kettle & Porcelain Cup Pouring (cx + 168, cy + 16)
    const kettleX = cx + 168, kettleY = cy + 16;
    drawWhistlingKettle(ctx, kettleX, kettleY, 54, kettleHeat, kettleWhistling, teaPour, t);

    // Active zone pulsing golden ring & zero-text bouncing arrow cue
    const zoneCoords = {
      sushi:  { x: sushiX,  y: sushiY - 58 },
      burger: { x: burgerX, y: burgerY - 68 },
      kettle: { x: kettleX, y: kettleY - 58 },
    };
    const zc = zoneCoords[activeZone] || zoneCoords.sushi;
    const bob = Math.sin(t * 4.2) * 4;
    ctx.save();
    ctx.strokeStyle = 'rgba(247, 201, 72, 0.85)';
    ctx.lineWidth = 3;
    ell(ctx, zc.x, zc.y + 62, 66, 36);
    ctx.stroke();
    drawIcon(ctx, 'arrow_down', zc.x, zc.y + bob, 13, t);
    ctx.restore();

    ctx.restore();
  }

  /* ---------- Station 3: Copper skillet pan-toss + patisserie oven ---------- */
  function drawFlamePetal(ctx, x, y, h, w, outer, inner, flick) {
    // Soft, round gouache flame tongue (bulgy sides, rounded tip)
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.bezierCurveTo(x - w * 1.25, y - h * 0.45, x - w * 0.45 + flick, y - h * 0.9, x + flick, y - h);
    ctx.bezierCurveTo(x + w * 0.45 + flick, y - h * 0.9, x + w * 1.25, y - h * 0.45, x + w, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y);
    ctx.bezierCurveTo(x - w * 0.65, y - h * 0.3, x - w * 0.2 + flick * 0.6, y - h * 0.5, x + flick * 0.6, y - h * 0.58);
    ctx.bezierCurveTo(x + w * 0.2 + flick * 0.6, y - h * 0.5, x + w * 0.65, y - h * 0.3, x + w * 0.5, y);
    ctx.closePath();
    ctx.fill();
  }

  /** Pastel mint HT Mini Oven. Window shows the round silver cake tin with the sponge
   *  rising in the player's real batter colour(s). `on` = oven mode (glow + heat). */
  function drawMiniOvenWithTin(ctx, ovenCx, ovenCy, w, h, on, cook, tint, layers, pulse, spring, t) {
    const warm = on ? clamp01(cook / 0.85) : 0;
    const hw = w / 2, hh = h / 2;
    softShadow(ctx, ovenCx, ovenCy + hh + 6, hw, 18, 0.22);
    ctx.fillStyle = '#8ED6B8';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    rr(ctx, ovenCx - hw, ovenCy - hh, w, h, 26);
    ctx.fill();
    ctx.stroke();
    // Cream top panel + 3 coral knobs
    ctx.fillStyle = '#F6FBF7';
    rr(ctx, ovenCx - hw + 16, ovenCy - hh + 10, w - 32, 30, 12);
    ctx.fill();
    ctx.stroke();
    for (let k = -1; k <= 1; k++) {
      ctx.fillStyle = '#E8998D';
      ctx.lineWidth = 2.6;
      circ(ctx, ovenCx + k * 44, ovenCy - hh + 25, 8);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ovenCx + k * 44, ovenCy - hh + 25);
      ctx.lineTo(ovenCx + k * 44 + Math.cos(-1 + k + (on ? 0.8 : 0)) * 6, ovenCy - hh + 25 + Math.sin(-1 + k + (on ? 0.8 : 0)) * 6);
      ctx.stroke();
    }
    // Window
    const wx = ovenCx - hw + 22, wy = ovenCy - hh + 50, ww = w - 44, whh = h - 84;
    ctx.save();
    rr(ctx, wx, wy, ww, whh, 18);
    ctx.clip();
    const og = ctx.createRadialGradient(ovenCx, wy + whh * 0.8, 10, ovenCx, wy + whh * 0.5, ww * 0.7);
    if (on) {
      og.addColorStop(0, lerpColor('#FFE8A3', '#FFB347', warm * 0.8));
      og.addColorStop(1, lerpColor('#F7D98A', '#E68A2E', warm * 0.6));
    } else {
      og.addColorStop(0, '#6F6660');
      og.addColorStop(1, '#4A423D');
    }
    ctx.fillStyle = og;
    ctx.fillRect(wx, wy, ww, whh);
    // Heating coil
    const coilY = wy + whh - 10;
    ctx.strokeStyle = on ? `rgba(255, ${Math.round(120 - warm * 60)}, 60, ${(0.5 + 0.5 * Math.abs(Math.sin(t * 3))).toFixed(3)})` : 'rgba(120,110,105,0.6)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(wx + 16, coilY);
    for (let k = 0; k < 6; k++) {
      ctx.quadraticCurveTo(wx + 16 + (k + 0.5) * ((ww - 32) / 6), coilY - 10, wx + 16 + (k + 1) * ((ww - 32) / 6), coilY);
    }
    ctx.stroke();
    // Rack
    const rackY = wy + whh - 26;
    ctx.strokeStyle = 'rgba(92,61,46,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wx + 10, rackY);
    ctx.lineTo(wx + ww - 10, rackY);
    ctx.stroke();
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.moveTo(ovenCx + k * 28, rackY);
      ctx.lineTo(ovenCx + k * 28, rackY + 8);
      ctx.stroke();
    }
    // Round silver cake tin on the rack (sb_L2_M0 row 4)
    const tinRx = Math.min(66, ww * 0.27), tinRy = tinRx * 0.3, tinH = 42;
    const tinBottomY = rackY - 2;
    const tinTopY = tinBottomY - tinH;
    ctx.save();
    ctx.translate(ovenCx, 0);
    ctx.scale((spring.sx || 1) * (1 + pulse * 0.04), 1);
    const tg = ctx.createLinearGradient(-tinRx, 0, tinRx, 0);
    tg.addColorStop(0, '#8C9BA5');
    tg.addColorStop(0.3, '#F4F8FA');
    tg.addColorStop(0.55, '#C9D4DC');
    tg.addColorStop(1, '#7F8E99');
    ctx.fillStyle = tg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-tinRx, tinTopY);
    ctx.lineTo(-tinRx, tinBottomY);
    ctx.ellipse(0, tinBottomY, tinRx, tinRy, 0, PI, 0, true);
    ctx.lineTo(tinRx, tinTopY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Tin inner wall (dark) + batter / sponge inside
    ctx.fillStyle = '#6F7E88';
    ell(ctx, 0, tinTopY, tinRx, tinRy);
    ctx.fill();
    ctx.stroke();
    if (on || cook > 0) {
      const rise = clamp01(cook) * 46 * (1 + pulse * 0.1);
      const bodyCol = safeColor(tint, VANILLA_SPONGE);
      const crust = lerpColor(bodyCol, '#D9A066', clamp01((cook - 0.35) / 0.65) * 0.42);
      // Rounded dome rising above the rim
      const domePath = () => {
        ctx.beginPath();
        ctx.moveTo(-tinRx + 3, tinTopY + 1);
        ctx.bezierCurveTo(-tinRx + 3, tinTopY - rise * 1.15, tinRx - 3, tinTopY - rise * 1.15, tinRx - 3, tinTopY + 1);
        ctx.ellipse(0, tinTopY + 1, tinRx - 3, tinRy - 1, 0, 0, PI, false);
        ctx.closePath();
      };
      ctx.save();
      domePath();
      ctx.clip();
      const bands = spongeBands(layers && layers.length ? layers : [bodyCol]);
      const totalH = rise * 1.15 + tinRy * 2 + 2;
      const bh = totalH / bands.length;
      for (let i = 0; i < bands.length; i++) {
        const col = bands[bands.length - 1 - i];
        ctx.fillStyle = i === 0 ? lerpColor(col, crust, clamp01(cook)) : col;
        ctx.fillRect(-tinRx - 2, tinTopY - rise * 1.15 + i * bh - 1, tinRx * 2 + 4, bh + 2);
        if (i > 0 && bands.length > 1) {
          ctx.fillStyle = rgba(VANILLA_CREAM, 0.55);
          ctx.fillRect(-tinRx - 2, tinTopY - rise * 1.15 + i * bh - 0.8, tinRx * 2 + 4, 1.6);
        }
      }
      // Glossy wet batter sheen fades as it bakes; golden browning spots appear
      ctx.fillStyle = `rgba(255,255,255,${(0.42 * (1 - clamp01(cook * 1.4))).toFixed(3)})`;
      ell(ctx, -tinRx * 0.3, tinTopY - rise * 0.7, tinRx * 0.35, 4, -0.1);
      ctx.fill();
      if (cook > 0.5) {
        ctx.fillStyle = `rgba(190, 120, 50, ${((cook - 0.5) * 0.9).toFixed(3)})`;
        for (let k = 0; k < 7; k++) {
          circ(ctx, (hash(k) - 0.5) * tinRx * 1.6, tinTopY - rise * (0.45 + hash(k + 4) * 0.5), 2 + hash(k + 8) * 2.5);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      domePath();
      ctx.stroke();
    }
    // Tin rim highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, tinTopY, tinRx - 1, tinRy - 1, 0, PI * 1.1, PI * 1.6);
    ctx.stroke();
    ctx.restore();
    // Stamped patisserie cookies ('star', 'heart', 'bear') baking on the rack beside the cake tin (Slice 6)
    if (ww > 220) {
      const cookieR = Math.min(16, ww * 0.055);
      const cookieSpots = [
        [-tinRx - cookieR * 1.55, rackY - cookieR * 0.5, 'star', -0.15],
        [tinRx + cookieR * 1.35,  rackY - cookieR * 0.55, 'heart', 0.12],
        [tinRx + cookieR * 3.1,   rackY - cookieR * 0.45, 'bear', -0.08],
      ];
      cookieSpots.forEach(([cxOff, cyPos, cShape, cRot]) => {
        if (Math.abs(cxOff) < ww * 0.46) {
          ctx.save();
          ctx.translate(ovenCx + cxOff, cyPos);
          ctx.rotate(cRot);
          ctx.scale(1, 0.76);
          drawStampedCookie(ctx, 0, 0, cookieR, cShape, clamp01(cook), safeColor(tint, VANILLA_SPONGE));
          ctx.restore();
        }
      });
    }
    // Warm interior oven lamp bulb at top-right of oven cavity (Slice 6)
    if (on) {
      const lampX = wx + ww - 24, lampY = wy + 14;
      const lampGlow = ctx.createRadialGradient(lampX, lampY, 2, lampX, lampY, 38);
      lampGlow.addColorStop(0, 'rgba(255, 248, 200, 0.9)');
      lampGlow.addColorStop(1, 'rgba(255, 190, 80, 0)');
      ctx.fillStyle = lampGlow;
      circ(ctx, lampX, lampY, 38);
      ctx.fill();
      ctx.fillStyle = '#FFF9D6';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      circ(ctx, lampX, lampY, 6.5);
      ctx.fill();
      ctx.stroke();
    }
    // Steam inside the window
    if (warm > 0.3) {
      ctx.strokeStyle = `rgba(255,253,249,${(0.5 * warm).toFixed(3)})`;
      ctx.lineWidth = 3;
      for (let k = -1; k <= 1; k++) {
        const sx = ovenCx + k * 34;
        const wv = Math.sin(t * 3 + k) * 6;
        ctx.beginPath();
        ctx.moveTo(sx, tinTopY - 30);
        ctx.quadraticCurveTo(sx + wv, tinTopY - 46, sx - wv, tinTopY - 62);
        ctx.stroke();
      }
    }
    ctx.restore();
    // Glass frame + reflection
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    rr(ctx, wx, wy, ww, whh, 18);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(wx + 24, wy + whh - 16);
    ctx.lineTo(wx + 80, wy + 12);
    ctx.stroke();
    // Door handle
    ctx.fillStyle = '#C9D4DC';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    rr(ctx, ovenCx - ww * 0.42, wy + whh + 8, ww * 0.84, 10, 5);
    ctx.fill();
    ctx.stroke();
  }

  /** Rotary clicking temperature dial on the front apron of the dual-burner stove (Slice 4). */
  function drawStoveTempDial(ctx, x, y, r, level, pulse, t) {
    const lvl = clamp(Math.round(level || 2), 1, 3);
    const angles = [-0.85, 0, 0.85];
    const targetAng = angles[lvl - 1];
    const sc = 1 + (pulse || 0) * 0.14;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    // Bezel heat level pips (Low=blue, Med=amber, High=coral)
    const pipCols = ['#7BC4E8', '#F5A623', '#E85D4A'];
    for (let i = 0; i < 3; i++) {
      const a = angles[i] - PI / 2;
      const px = Math.cos(a) * (r + 6.5);
      const py = Math.sin(a) * (r + 6.5);
      ctx.fillStyle = (i + 1) <= lvl ? pipCols[i] : '#EADBC8';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      circ(ctx, px, py, i + 1 === lvl ? 3.4 : 2.5);
      ctx.fill();
      ctx.stroke();
    }
    // Outer brass/cream bezel
    softShadow(ctx, 0, 3, r * 0.95, 5, 0.2);
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    circ(ctx, 0, 0, r);
    ctx.fill();
    ctx.stroke();
    // Inner rotary knob cap
    ctx.fillStyle = '#E8998D';
    circ(ctx, 0, 0, r * 0.72);
    ctx.fill();
    ctx.stroke();
    // Rotating pointer tick
    ctx.save();
    ctx.rotate(targetAng);
    ctx.strokeStyle = '#FFFDF9';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(0, -r * 0.62);
    ctx.stroke();
    ctx.fillStyle = '#F7C948';
    circ(ctx, 0, -r * 0.56, 2.2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /** Cozy gouache Dual-Burner Stove Top casing with two rotary clicking temperature dials (Slice 4: 18:00-24:00). */
  function drawDualBurnerStoveDeck(ctx, cx, cy, heat, soupHeat, dialPulse, t) {
    const W_DECK = 396, H_DECK = 128;
    const x0 = cx - 202, y0 = cy - 30;
    softShadow(ctx, cx - 4, y0 + H_DECK + 10, W_DECK * 0.5, 20, 0.22);
    // Stove top enameled cream linen deck
    const dg = ctx.createLinearGradient(0, y0, 0, y0 + H_DECK);
    dg.addColorStop(0, '#FFFDF9');
    dg.addColorStop(0.7, '#FAF3EB');
    dg.addColorStop(1, '#EADBC8');
    ctx.fillStyle = dg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.8;
    rr(ctx, x0, y0, W_DECK, H_DECK, 24);
    ctx.fill();
    ctx.stroke();

    // Recessed burner drip trays (left = soup pot, right = skillet pan)
    ctx.fillStyle = '#EFE2D2';
    ctx.strokeStyle = '#C9B29B';
    ctx.lineWidth = 2.2;
    ell(ctx, cx - 108, cy + 20, 74, 32);
    ctx.fill();
    ctx.stroke();
    ell(ctx, cx + 68, cy + 26, 98, 42);
    ctx.fill();
    ctx.stroke();

    // Front coral-rose control apron with clicking temperature dials
    const apronY = y0 + H_DECK - 34;
    const ag = ctx.createLinearGradient(0, apronY, 0, apronY + 38);
    ag.addColorStop(0, '#F2B5AC');
    ag.addColorStop(0.5, '#E8998D');
    ag.addColorStop(1, '#D47F73');
    ctx.fillStyle = ag;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.5;
    rr(ctx, x0 + 6, apronY, W_DECK - 12, 38, 16);
    ctx.fill();
    ctx.stroke();

    // Center flame indicator badge on front apron (zero text)
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    rr(ctx, cx - 42, apronY + 7, 44, 24, 10);
    ctx.fill();
    ctx.stroke();
    drawFlamePetal(ctx, cx - 20, apronY + 26, 14, 7, '#E85D4A', '#FFE08A', Math.sin(t * 14) * 0.12);

    // Left Rotary Dial (Soup Pot Burner) & Right Rotary Dial (Skillet Burner)
    drawStoveTempDial(ctx, cx - 108, apronY + 19, 14, soupHeat || heat, dialPulse, t);
    drawStoveTempDial(ctx, cx + 68, apronY + 19, 14, heat, dialPulse, t);
  }

  /** Left burner: Boiling Soup Pot with simmering broth, water bubbles & rising steam vapor (Slice 4: 18:00-24:00). */
  function drawBoilingSoupPot(ctx, potCx, potCy, heat, cook, ids, spring, t) {
    const hLvl = clamp(heat || 2, 1, 3);
    const flameOuter = ['#7BC4E8', '#F5A623', '#E85D4A'][hLvl - 1];
    const flameInner = ['#DFF4FF', '#FFE08A', '#FFC25A'][hLvl - 1];
    // Cast-iron burner ring + gas flame petals under soup pot
    ctx.strokeStyle = '#6B625C';
    ctx.lineWidth = 7;
    ell(ctx, potCx, potCy + 14, 68, 30);
    ctx.stroke();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * PI2;
      const fl = 14 + hLvl * 3 + Math.sin(t * 10 + k * 1.4) * 4;
      drawFlamePetal(ctx, potCx + Math.cos(a) * 60, potCy + 14 + Math.sin(a) * 26, fl, 9, flameOuter, flameInner, Math.sin(t * 18 + k) * 0.1);
    }
    softShadow(ctx, potCx, potCy + 18, 66, 14, 0.26);

    ctx.save();
    ctx.translate(potCx, potCy);
    const boilBob = Math.sin(t * (6 + hLvl * 3)) * (0.012 * hLvl);
    ctx.scale((spring.sx || 1) * (1 + boilBob), (spring.sy || 1) * (1 - boilBob));
    const RX = 64, RY = 25, DEPTH = 44;

    // Two loop side handles (coral-tipped pastel mint ears)
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#E8998D';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      rr(ctx, side * (RX - 4) - (side < 0 ? 18 : 0), -22, 18, 12, 6);
      ctx.fill();
      ctx.stroke();
    }

    // Pot cylindrical rounded gouache body (pastel mint-cream enamel)
    const pg = ctx.createLinearGradient(-RX, 0, RX, 0);
    pg.addColorStop(0, '#78B89E');
    pg.addColorStop(0.32, '#C8EFE0');
    pg.addColorStop(0.65, '#9CD3C2');
    pg.addColorStop(1, '#68A68E');
    ctx.fillStyle = pg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(-RX, -20);
    ctx.bezierCurveTo(-RX, -20 + DEPTH * 1.15, -RX * 0.55, -20 + DEPTH * 1.42, 0, -20 + DEPTH * 1.42);
    ctx.bezierCurveTo(RX * 0.55, -20 + DEPTH * 1.42, RX, -20 + DEPTH * 1.15, RX, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pot specular vertical highlight stripe
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-RX * 0.58, -8);
    ctx.quadraticCurveTo(-RX * 0.52, 12, -RX * 0.36, 24);
    ctx.stroke();

    // Pot rim & inner wall
    ctx.fillStyle = '#FFFDF9';
    ell(ctx, 0, -20, RX, RY);
    ctx.fill();
    ctx.stroke();

    // Boiling golden soup broth inside clip
    ctx.save();
    ell(ctx, 0, -20, RX - 5, RY - 4);
    ctx.clip();
    const bg = ctx.createRadialGradient(-12, -24, 4, 0, -18, RX - 4);
    bg.addColorStop(0, '#FFF3B8');
    bg.addColorStop(0.65, '#FFE07D');
    bg.addColorStop(1, '#E6B44C');
    ctx.fillStyle = bg;
    ell(ctx, 0, -18, RX - 4, RY - 3);
    ctx.fill();

    // Floating soup veggies (corn wheel, carrot floral slice, tomato slice) bobbing in broth
    const soupVeggies = ['corn', 'carrot', 'tomato'];
    soupVeggies.forEach((vid, idx) => {
      const ang = t * (0.7 + hLvl * 0.25) + idx * (PI2 / 3);
      const vx = Math.cos(ang) * 26;
      const vy = -18 + Math.sin(ang * 1.3) * 7;
      drawIngredient(ctx, vid, vx, vy, 13, {
        sliced: true,
        cooked: Math.max(0.4, cook),
        rot: ang * 0.4,
        scaleY: 0.78,
        shadow: false,
      });
    });

    // Rolling water bubbles rising & popping across the boiling broth surface
    const bubbleCount = 6 + hLvl * 4;
    for (let k = 0; k < bubbleCount; k++) {
      const ph = (t * (1.2 + hLvl * 0.55) + hash(k * 3.1)) % 1;
      const bx = (hash(k + 5) - 0.5) * (RX - 18) * 1.5;
      const by = -18 + (hash(k + 11) - 0.5) * (RY - 8) * 1.2 - ph * 4;
      const br = 2.2 + ph * (4.5 + hLvl * 1.2);
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.55 * (1 - ph * 0.6)).toFixed(3)})`;
      ctx.strokeStyle = `rgba(255, 252, 240, ${(0.9 * (1 - ph)).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      circ(ctx, bx, by, br);
      ctx.fill();
      ctx.stroke();
      // Specular crescent dot on each water bubble
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.85 * (1 - ph)).toFixed(3)})`;
      circ(ctx, bx - br * 0.32, by - br * 0.32, br * 0.28);
      ctx.fill();
    }
    ctx.restore();

    // Tilted translucent glass lid perched on the left-back rim rattling with steam
    ctx.save();
    const lidRattle = Math.sin(t * (12 + hLvl * 4)) * 0.035 * hLvl;
    ctx.translate(-RX * 0.52, -32);
    ctx.rotate(-0.42 + lidRattle);
    ctx.fillStyle = 'rgba(235, 248, 255, 0.55)';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ell(ctx, 0, 0, 34, 13);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E8998D';
    circ(ctx, 0, -9, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Multi-lobed rising steam vapor plumes above the boiling soup pot
    const steamPlumes = 2 + hLvl;
    for (let k = 0; k < steamPlumes; k++) {
      const ph = (t * (0.55 + hLvl * 0.15) + k / steamPlumes) % 1;
      const sx = (k - (steamPlumes - 1) / 2) * 22 + Math.sin(t * 3 + k) * 5;
      const sy = -34 - ph * 46;
      const sr = 6 + ph * 9;
      const sa = (1 - ph) * (0.38 + hLvl * 0.1);
      ctx.fillStyle = `rgba(255, 253, 249, ${sa.toFixed(3)})`;
      circ(ctx, sx, sy, sr);
      ctx.fill();
      circ(ctx, sx - sr * 0.45, sy + sr * 0.2, sr * 0.68);
      ctx.fill();
      circ(ctx, sx + sr * 0.45, sy - sr * 0.15, sr * 0.72);
      ctx.fill();
      // Wavy steam vapor ribbon
      const wv = Math.sin(t * 3.5 + k * 1.7) * 6;
      ctx.strokeStyle = `rgba(255, 253, 249, ${(sa * 0.85).toFixed(3)})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(sx, -28 - ph * 12);
      ctx.quadraticCurveTo(sx + wv, -44 - ph * 20, sx - wv, -62 - ph * 28);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Right burner: Silver miniature skillet / wok (sb_L2_M0 row 2, sb_L2_M2 row 2) cooking panItems
   *  with sunny-side-up pan-frying egg, sizzling scored sausage, and 360-degree parabolic flip! */
  function drawSilverWok(ctx, panCx, panCy, s, t, heat, cook, panItems, ids, spring) {
    const burnt = cook > 1.08;
    const hLvl = clamp(heat || 2, 1, 3);
    const flameOuter = ['#7BC4E8', '#F5A623', '#E85D4A'][hLvl - 1];
    const flameInner = ['#DFF4FF', '#FFE08A', '#FFC25A'][hLvl - 1];
    const pt = (s && s.panToss) || { active: false, t: 0, panDy: 0, panTilt: 0, bodies: [], baseBody: null };
    // Burner ring + flames
    ctx.strokeStyle = '#6B625C';
    ctx.lineWidth = 8;
    ell(ctx, panCx, panCy + 14, 96, 46);
    ctx.stroke();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * PI2;
      const f1 = Math.sin(t * 8 + k * 1.5) * (4 + hLvl * 1.5);
      drawFlamePetal(ctx, panCx + Math.cos(a) * 84, panCy + 14 + Math.sin(a) * 40, 18 + hLvl * 3 + f1, 12, flameOuter, flameInner, Math.sin(t * 20 + k) * 0.1);
    }
    softShadow(ctx, panCx, panCy + 20, 92, 15, 0.28);

    ctx.save();
    ctx.translate(panCx, panCy + (pt.panDy || 0));
    if (pt.panTilt) ctx.rotate(pt.panTilt);
    ctx.scale(spring.sx || 1, spring.sy || 1);
    const RX = 92, RY = 35, DEPTH = 30;
    // Long handle (right) with black grip + small helper ear (left)
    ctx.save();
    ctx.translate(RX - 6, -14);
    ctx.rotate(-0.12);
    const hg = ctx.createLinearGradient(0, -7, 0, 7);
    hg.addColorStop(0, '#F4F8FA');
    hg.addColorStop(0.5, '#B8C5CE');
    hg.addColorStop(1, '#7F8E99');
    ctx.fillStyle = hg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    rr(ctx, 0, -7, 70, 14, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2E2A28';
    rr(ctx, 36, -8, 46, 16, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#C9D4DC';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    rr(ctx, -RX - 18, -20, 26, 11, 5.5);
    ctx.fill();
    ctx.stroke();
    // Skillet body
    const bg = ctx.createLinearGradient(-RX, 0, RX, 0);
    bg.addColorStop(0, '#7F8E99');
    bg.addColorStop(0.3, '#E6EDF2');
    bg.addColorStop(0.55, '#B8C5CE');
    bg.addColorStop(1, '#6F7E88');
    ctx.fillStyle = bg;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-RX, -16);
    ctx.bezierCurveTo(-RX, -16 + DEPTH * 1.4, -RX * 0.5, -16 + DEPTH * 1.9, 0, -16 + DEPTH * 1.9);
    ctx.bezierCurveTo(RX * 0.5, -16 + DEPTH * 1.9, RX, -16 + DEPTH * 1.4, RX, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Rim + inner surface
    const ig = ctx.createRadialGradient(-20, -26, 6, 0, -16, RX);
    ig.addColorStop(0, '#DCE6EC');
    ig.addColorStop(0.75, '#9FB0BB');
    ig.addColorStop(1, '#5F6E78');
    ctx.fillStyle = ig;
    ell(ctx, 0, -16, RX, RY);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -16, RX - 3, RY - 3, 0, PI * 1.1, PI * 1.55);
    ctx.stroke();

    // ---- What is actually cooking (never an invented chocolate puddle) ----
    const poolIds = ids.filter(id => isFruitId(id) || isChocoId(id) || id === 'honey' || id === 'cheese' || id === 'popcandy');
    ctx.save();
    ell(ctx, 0, -16, RX - 6, RY - 5);
    ctx.clip();
    if (poolIds.length) {
      const poolCol = isChocoId(poolIds[0]) && poolIds.every(isChocoId) ? '#4A2512' : avgColors(poolIds.map(spongeColorFor));
      const melt = clamp01((cook - 0.08) / 0.55);
      const prx = 42 + melt * (RX - 48), pry = 16 + melt * (RY - 22);
      const pg = ctx.createRadialGradient(-prx * 0.3, -22, 4, 0, -12, prx);
      pg.addColorStop(0, lighten(poolCol, 0.25));
      pg.addColorStop(1, darken(poolCol, 0.12));
      ctx.fillStyle = pg;
      ctx.globalAlpha *= 0.35 + 0.6 * melt;
      blob(ctx, 0, -10, prx, pry, 2.2, 0.08 + 0.05 * Math.sin(t * 2), 18);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Glossy catchlights on the jam / glaze
      ctx.fillStyle = `rgba(255,255,255,${(0.55 * melt).toFixed(3)})`;
      ell(ctx, -prx * 0.4, -24, prx * 0.22, 5, 0.2);
      ctx.fill();
      // Simmer bubbles in the pool's own colour
      if (cook > 0.2) {
        for (let k = 0; k < 7; k++) {
          const phb = (t * 1.6 + hash(k)) % 1;
          const bx = (hash(k + 3) - 0.5) * prx * 1.5;
          const by = -12 + (hash(k + 7) - 0.5) * pry * 1.2;
          ctx.strokeStyle = rgba(lighten(poolCol, 0.5), 0.85 * (1 - phb));
          ctx.lineWidth = 2;
          circ(ctx, bx, by, 2 + phb * 6);
          ctx.stroke();
        }
      }
    } else {
      // Golden sizzling butter/oil sheen on skillet floor with tiny sizzle bubbles
      ctx.fillStyle = 'rgba(255, 238, 170, 0.42)';
      ell(ctx, 0, -14, 66, 22);
      ctx.fill();
      for (let k = 0; k < 6 + hLvl * 2; k++) {
        const phs = (t * (2.2 + hLvl * 0.6) + hash(k * 2.3)) % 1;
        const sx = (hash(k + 4) - 0.5) * 96;
        const sy = -14 + (hash(k + 8) - 0.5) * 32;
        ctx.strokeStyle = `rgba(255, 248, 210, ${(0.75 * (1 - phs)).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        circ(ctx, sx, sy, 1.4 + phs * 3.8);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Render pan items (or showcase sunny-side-up egg + sizzling sausage when pan is empty on stove)
    const displayItems = panItems.length ? panItems : [
      { id: 'egg', x: -24, y: 2, cracked: true, sliced: false, scale: 1 },
      { id: 'sausage', x: 26, y: -4, cracked: false, sliced: false, scale: 1 },
    ];
    const sorted = displayItems.map((item, origIdx) => ({ item, origIdx })).sort((a, b) => (a.item.y || 0) - (b.item.y || 0));
    sorted.forEach(({ item: p, origIdx }) => {
      const meta = ingMeta(p.id);
      const fruit = isFruitId(p.id);
      const pop = p.scale === undefined ? 1 : clamp01(p.scale);
      const shrink = fruit ? 1 - clamp01(cook) * 0.28 : 1;
      const sz = (p.id === 'dough' ? 42 : (p.id === 'egg' || p.id === 'sausage' ? 30 : 26)) * pop * shrink;
      if (sz < 1) return;
      const b = (pt.active && pt.bodies && pt.bodies[origIdx]) || (pt.active && pt.baseBody) || { dx: 0, dy: 0, rot: 0, flip: 0, sx: 1, sy: 1, shadow: 1 };
      const ix = (p.x || 0) * 0.82 + (b.dx || 0);
      const iy = -14 + (p.y || 0) * 0.5 + clamp01(cook) * 2 + (b.dy || 0);
      // Drop shadow on skillet floor when tossed airborne
      if ((b.dy || 0) < -2) {
        ctx.fillStyle = 'rgba(46, 32, 24, 0.22)';
        ell(ctx, (p.x || 0) * 0.82, -12 + (p.y || 0) * 0.5, sz * 0.72 * (b.shadow || 0.6), sz * 0.32 * (b.shadow || 0.6));
        ctx.fill();
      }
      const flipCos = b.flip ? Math.cos(b.flip * PI2) : 1;
      const effSy = 0.86 * (b.sy || 1) * (Math.abs(flipCos) < 0.12 ? 0.12 * (flipCos < 0 ? -1 : 1) : flipCos);
      drawIngredient(ctx, p.id, ix, iy, sz, {
        sliced: p.sliced !== undefined ? p.sliced : !!(meta && meta.choppable && p.id !== 'sausage'),
        cracked: p.id === 'egg' ? true : p.cracked,
        cooked: Math.max(cook, p.id === 'egg' || p.id === 'sausage' ? 0.45 : cook),
        rot: (origIdx % 2 ? 0.26 : -0.22) + Math.sin(t * 2.5 + origIdx) * 0.04 + (b.rot || 0),
        scaleX: b.sx || 1,
        scaleY: effSy,
        shadow: false,
      });
    });

    // Steam when hot
    if (cook > 0.15 || panItems.length === 0) {
      const steamA = clamp01(Math.max(0.35, cook * 1.8)) * 0.5;
      for (let k = -1; k <= 1; k++) {
        const sx = k * 28;
        const ph = (t * 0.55 + k * 0.3 + 1) % 1;
        const wave = Math.sin(t * 3.2 + k) * 6;
        ctx.strokeStyle = `rgba(255, 253, 249, ${(steamA * (1 - ph)).toFixed(3)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, -38 - ph * 15);
        ctx.quadraticCurveTo(sx + wave, -56 - ph * 20, sx - wave, -74 - ph * 25);
        ctx.stroke();
      }
    }
    if (burnt) {
      ctx.fillStyle = 'rgba(60,50,45,0.35)';
      for (let k = 0; k < 4; k++) {
        const ph = (t * 0.4 + hash(k)) % 1;
        circ(ctx, (hash(k + 2) - 0.5) * 80, -50 - ph * 50, 8 + ph * 10);
        ctx.fill();
      }
    }
    ctx.restore();
    // Wooden spatula turner: scoops & flips upward during panToss!
    const tossLift = pt.active ? Math.sin(clamp01(pt.t / 0.45) * PI) : 0;
    drawSpatula(
      ctx,
      panCx - 54 + tossLift * 28,
      panCy - 40 - tossLift * 26,
      24,
      -0.4 + tossLift * 0.65 + Math.sin(t * 2) * 0.02
    );
  }

  /* ---------- Slice 5 (24:00-30:00): Countertop Appliances (Pop-Up Toaster + Butter Spread & Microwave Turntable) ---------- */

  /**
   * Spring Pop-Up Toaster with Dual Bread Slices & Interactive Butter Spread.
   * Supports:
   * - Pressing down the side spring carriage lever (leverDown: 0..1)
   * - Glowing nichrome toaster slots while toasting (toastProgress: 0..1)
   * - Explosive spring pop-up with vertical bounce (popJump: 0..1)
   * - Spreading golden melting butter across popped toast slices (butterSpread: 0..1)
   */
  function drawToasterAppliance(ctx, cx, cy, s, t) {
    s = s || {};
    const ts = s.toasterState || {};
    const toastProg = clamp01(ts.toastProgress !== undefined ? ts.toastProgress : (s.cookProgress || 0));
    const leverDown = ts.leverDown !== undefined ? clamp01(ts.leverDown) : (toastProg > 0.02 && toastProg < 0.92 ? 1 : 0);
    const popJump = clamp01(ts.popJump || 0);
    const butterSpread = clamp01(ts.butterSpread || 0);
    const spring = s.boardSpring || { sx: 1, sy: 1 };

    ctx.save();
    ctx.translate(cx, cy + 12);
    ctx.scale(spring.sx || 1, spring.sy || 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    softShadow(ctx, 0, 78, 128, 22, 0.22);

    // Side dish with golden butter pat & butter knife ready for spreading
    ctx.save();
    ctx.translate(-162, 54);
    softShadow(ctx, 0, 12, 42, 11, 0.18);
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ell(ctx, 0, 0, 38, 15);
    ctx.fill();
    ctx.stroke();
    drawIngredient(ctx, 'butter', -4, -5, 20, { sliced: butterSpread > 0.2, shadow: false, cookProgress: butterSpread * 0.5 });
    ctx.restore();

    // Dual bread slices rising out of the top toaster slots
    const submergeY = leverDown * 28 - Math.sin(popJump * PI) * 42;
    const toastRot = Math.sin(popJump * PI * 2) * 0.08;
    [-34, 34].forEach((slotX, idx) => {
      ctx.save();
      ctx.translate(slotX, -52 + submergeY + (idx === 1 ? -3 : 0));
      ctx.rotate(toastRot * (idx === 0 ? -1 : 1));
      const sliceR = 38;
      // Golden toast body (transitions from cream crumb to golden brown)
      const crumbCol = lerpColor('#FFF8E7', '#D68B38', clamp01(toastProg * 1.1));
      const crustCol = lerpColor('#D89748', '#8A4B19', clamp01(toastProg * 1.1));
      ctx.fillStyle = crustCol;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      rr(ctx, -sliceR * 0.72, -sliceR * 0.75, sliceR * 1.44, sliceR * 1.48, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = crumbCol;
      rr(ctx, -sliceR * 0.60, -sliceR * 0.62, sliceR * 1.20, sliceR * 1.24, 8);
      ctx.fill();
      // Warm grill toast marks
      if (toastProg > 0.2) {
        ctx.strokeStyle = rgba('#7A3E12', clamp01((toastProg - 0.2) * 0.65));
        ctx.lineWidth = 2.5;
        for (let g = -1; g <= 1; g++) {
          ctx.beginPath();
          ctx.moveTo(-14, g * 9 - 4);
          ctx.lineTo(14, g * 9 - 4);
          ctx.stroke();
        }
      }
      // Melting golden butter pat spread on top of popped toast!
      if (butterSpread > 0.02) {
        const bAlpha = clamp01(butterSpread * 1.25);
        ctx.fillStyle = `rgba(255, 224, 102, ${(0.82 * bAlpha).toFixed(3)})`;
        ell(ctx, 0, -2, 20 * butterSpread, 14 * butterSpread, -0.15);
        ctx.fill();
        ctx.fillStyle = '#FFE875';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.8;
        const patS = 9 * (1 - butterSpread * 0.35);
        rr(ctx, -patS, -patS - 2, patS * 2, patS * 1.5, 3);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    });

    // Toaster top chrome slot plate & glowing nichrome coils
    ctx.fillStyle = '#E6ECEF';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;
    rr(ctx, -84, -46, 168, 22, 10);
    ctx.fill();
    ctx.stroke();
    [-34, 34].forEach(slotX => {
      ctx.fillStyle = leverDown > 0.3 ? lerpColor('#4A3228', '#FF5E1A', 0.6 + 0.35 * Math.sin(t * 10)) : '#4A3228';
      rr(ctx, slotX - 26, -42, 52, 10, 4);
      ctx.fill();
      ctx.stroke();
    });

    // Retro rounded pastel Patisserie toaster body
    const bodyG = ctx.createLinearGradient(-96, -36, 96, 74);
    bodyG.addColorStop(0, '#FFE3DC');
    bodyG.addColorStop(0.5, '#F7B7A8');
    bodyG.addColorStop(1, '#E59584');
    ctx.fillStyle = bodyG;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(-92, 68);
    ctx.lineTo(-92, -16);
    ctx.quadraticCurveTo(-92, -40, -66, -40);
    ctx.lineTo(66, -40);
    ctx.quadraticCurveTo(92, -40, 92, -16);
    ctx.lineTo(92, 68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Specular gouache highlight arc on toaster shell
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-74, -24);
    ctx.lineTo(-74, 48);
    ctx.stroke();

    // Front browning dial + heat indicator pips (Zero-Text)
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.8;
    circ(ctx, -36, 22, 18);
    ctx.fill();
    ctx.stroke();
    const dialAng = -0.8 + toastProg * 1.6;
    ctx.beginPath();
    ctx.moveTo(-36, 22);
    ctx.lineTo(-36 + Math.cos(dialAng) * 12, 22 + Math.sin(dialAng) * 12);
    ctx.stroke();

    // 3 glowing browning progress pips
    for (let p = 0; p < 3; p++) {
      const lit = toastProg >= (p + 1) * 0.28;
      ctx.fillStyle = lit ? '#FF9F1C' : '#FFF5EA';
      circ(ctx, 16 + p * 20, 22, 6);
      ctx.fill();
      ctx.stroke();
    }

    // Chrome base trim & cocoa feet
    ctx.fillStyle = '#DCE3E6';
    rr(ctx, -98, 62, 196, 14, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = OUTLINE;
    rr(ctx, -78, 74, 24, 8, 4);
    rr(ctx, 54, 74, 24, 8, 4);
    ctx.fill();

    // Right-side vertical carriage track + spring pop-up lever
    ctx.fillStyle = '#4A3228';
    rr(ctx, 92, -22, 10, 68, 4);
    ctx.fill();
    ctx.stroke();
    const leverY = -14 + leverDown * 46;
    ctx.fillStyle = '#DCE3E6';
    rr(ctx, 96, leverY - 4, 20, 8, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = leverDown > 0.5 ? '#FF9F1C' : '#5C3D2E';
    rr(ctx, 110, leverY - 9, 24, 18, 7);
    ctx.fill();
    ctx.stroke();

    // Interactive visual affordance: arrow over lever when ready to toast, or butter knife sweeping over popped toast
    if (leverDown < 0.2 && toastProg < 0.2) {
      const bob = Math.sin(t * 5) * 4;
      drawIcon(ctx, 'arrow_down', 122, leverY - 24 + bob, 11, t);
    } else if (toastProg >= 0.75 && butterSpread < 0.95) {
      const sweepX = Math.sin(t * 4.5) * 32;
      drawIcon(ctx, 'butter_knife', sweepX + 18, -76, 22, t);
    }

    ctx.restore();
  }

  /**
   * Countertop Microwave with Rotating 3D Glass Turntable, Warm Interior Lamp & 3-Pip Progress Bar.
   * Zero-Text: Uses glowing amber LED pips instead of numeric digits.
   */
  function drawMicrowaveAppliance(ctx, cx, cy, s, t) {
    s = s || {};
    const ms = s.microwaveState || {};
    const prog = clamp01(ms.progress !== undefined ? ms.progress : (s.cookProgress || 0));
    const running = !!ms.running || (prog > 0.01 && prog < 0.99);
    const doorOpen = clamp01(ms.doorOpen || 0);
    const turntableAngle = ms.turntableAngle !== undefined ? ms.turntableAngle : t * (running ? 3.2 : 0);
    const spring = s.boardSpring || { sx: 1, sy: 1 };
    const panItems = s.panItems || [];

    ctx.save();
    ctx.translate(cx, cy + 8);
    ctx.scale(spring.sx || 1, spring.sy || 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    softShadow(ctx, 0, 84, 152, 24, 0.22);

    // Outer cream-and-sage countertop microwave cabinet
    const cabG = ctx.createLinearGradient(-136, -68, 136, 76);
    cabG.addColorStop(0, '#FFFDF9');
    cabG.addColorStop(0.6, '#F4ECE1');
    cabG.addColorStop(1, '#E2D5C5');
    ctx.fillStyle = cabG;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.8;
    rr(ctx, -136, -68, 272, 144, 20);
    ctx.fill();
    ctx.stroke();

    // Interior cavity window (warm golden glow when running)
    ctx.save();
    rr(ctx, -118, -50, 174, 108, 12);
    ctx.fillStyle = running ? '#FFF0C2' : '#3E2B22';
    ctx.fill();
    ctx.stroke();
    ctx.clip();

    if (running) {
      const lampG = ctx.createRadialGradient(-31, -40, 8, -31, 4, 110);
      lampG.addColorStop(0, 'rgba(255, 232, 148, 0.92)');
      lampG.addColorStop(1, 'rgba(255, 184, 77, 0.25)');
      ctx.fillStyle = lampG;
      ctx.fillRect(-118, -50, 174, 108);
    }

    // 3D Rotating Glass Turntable Plate + Roller Ring inside cavity
    const plateCx = -31;
    const plateCy = 28;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    ell(ctx, plateCx, plateCy + 6, 48, 12);
    ctx.stroke();
    // Roller wheels spinning along track
    for (let w = 0; w < 3; w++) {
      const wa = turntableAngle + (w * PI2) / 3;
      ctx.fillStyle = '#FFE0A3';
      circ(ctx, plateCx + Math.cos(wa) * 44, plateCy + 6 + Math.sin(wa) * 10, 3.2);
      ctx.fill();
    }
    // Translucent glass turntable tray
    ctx.fillStyle = 'rgba(232, 248, 255, 0.78)';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ell(ctx, plateCx, plateCy, 62, 18);
    ctx.fill();
    ctx.stroke();

    // Dish / ingredients orbiting on the glass turntable
    const itemsToDraw = panItems.length ? panItems : [{ id: 'bread' }, { id: 'butter' }];
    itemsToDraw.slice(0, 4).forEach((it, idx) => {
      const a = turntableAngle + (idx * PI2) / Math.max(1, itemsToDraw.length);
      const rad = itemsToDraw.length === 1 ? 0 : 24;
      const ix = plateCx + Math.cos(a) * rad;
      const iy = plateCy - 6 + Math.sin(a) * (rad * 0.28);
      drawIngredient(ctx, it.id || 'bread', ix, iy, 22, {
        sliced: true,
        shadow: false,
        cookProgress: prog,
        scaleX: 0.75 + 0.25 * Math.abs(Math.cos(a * 0.5)),
      });
    });

    // Warm rising steam curls when heating
    if (running || prog > 0.5) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 2.4;
      for (let sIdx = -1; sIdx <= 1; sIdx++) {
        const sx = plateCx + sIdx * 22;
        const syOff = ((t * 28 + sIdx * 11) % 26);
        ctx.beginPath();
        ctx.moveTo(sx, plateCy - 14 - syOff);
        ctx.quadraticCurveTo(sx + 6, plateCy - 24 - syOff, sx - 2, plateCy - 34 - syOff);
        ctx.stroke();
      }
    }

    // Subtle honeycomb mesh screen overlay
    ctx.fillStyle = 'rgba(92, 61, 46, 0.08)';
    for (let gx = -110; gx < 50; gx += 12) {
      for (let gy = -42; gy < 52; gy += 12) {
        circ(ctx, gx, gy, 1.2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Swing-open door frame effect when doorOpen > 0
    if (doorOpen > 0.02) {
      ctx.save();
      ctx.translate(-118, 0);
      ctx.scale(1 - doorOpen * 0.55, 1);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 3;
      rr(ctx, 0, -50, 174, 108, 12);
      ctx.stroke();
      ctx.restore();
    }

    // Pull handle on door right edge
    ctx.fillStyle = '#D9867A';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    rr(ctx, 42, -38, 12, 84, 6);
    ctx.fill();
    ctx.stroke();

    // Right control panel (Zero-Text: 4 LED progress pips + rotary timer dial + start button)
    ctx.fillStyle = '#4A3228';
    rr(ctx, 72, -48, 48, 24, 6);
    ctx.fill();
    ctx.stroke();
    for (let p = 0; p < 4; p++) {
      const lit = prog >= (p + 0.5) / 4 || (running && Math.floor(t * 6) % 4 === p);
      ctx.fillStyle = lit ? '#78C47C' : 'rgba(255,255,255,0.18)';
      circ(ctx, 81 + p * 10, -36, 3.2);
      ctx.fill();
    }

    // Rotary timer dial
    ctx.fillStyle = '#FFF7EB';
    circ(ctx, 96, -4, 14);
    ctx.fill();
    ctx.stroke();
    const timerAng = -PI * 0.5 + prog * PI2;
    ctx.beginPath();
    ctx.moveTo(96, -4);
    ctx.lineTo(96 + Math.cos(timerAng) * 9, -4 + Math.sin(timerAng) * 9);
    ctx.stroke();

    // Big tactile Start / Beep button
    ctx.fillStyle = running ? '#78C47C' : '#FFD166';
    circ(ctx, 96, 34, 15);
    ctx.fill();
    ctx.stroke();
    drawIcon(ctx, 'sparkles', 96, 34, 9, t);

    if (!running && prog < 0.95) {
      const bob = Math.sin(t * 5) * 3.5;
      drawIcon(ctx, 'arrow_down', 96, 10 + bob, 10, t);
    }

    ctx.restore();
  }

  /** Unified Countertop Appliance Station dispatcher (Blender, Pop-Up Toaster, Microwave). */
  function drawApplianceStation(ctx, cx, cy, s, t) {
    s = s || {};
    const mode = s.applianceMode || s.cookMode || s.mixMode || 'toaster';
    if (mode === 'blender') {
      drawMixStation(ctx, cx, cy, Object.assign({}, s, { mixMode: 'blender' }), t);
    } else if (mode === 'microwave') {
      drawMicrowaveAppliance(ctx, cx, cy, s, t);
    } else {
      drawToasterAppliance(ctx, cx, cy, s, t);
    }
  }

  function drawCookStation(ctx, cx, cy, s, t) {
    s = s || {};
    if (s.cookMode === 'toaster') {
      drawToasterAppliance(ctx, cx, cy, s, t);
      return;
    }
    if (s.cookMode === 'microwave') {
      drawMicrowaveAppliance(ctx, cx, cy, s, t);
      return;
    }
    if (s.cookMode === 'playset') {
      drawPlaysetStation(ctx, cx, cy, s, t);
      return;
    }
    if (s.cookMode === 'sink') {
      drawSinkStation(ctx, cx, cy, s, t);
      return;
    }
    const heat = clamp(s.heatLevel || 2, 1, 3);
    const soupHeat = clamp(s.soupHeatLevel || heat, 1, 3);
    const cook = s.cookProgress || 0;
    const burnt = cook > 1.08;
    const spring = s.boardSpring || { sx: 1, sy: 1 };
    const mode = s.cookMode === 'pan' ? 'pan' : 'oven';
    const panItems = s.panItems || [];
    const ids = [];
    ((s.panIds && s.panIds.length) ? s.panIds : panItems.map(it => it.id)).forEach(id => { if (id && ids.indexOf(id) < 0) ids.push(id); });
    // Colours come from the ingredients actually in the tin / wok (or the batter carried over)
    const pal = paletteForIds(ids);
    const tint = ids.length ? pal.batterTint : safeColor(s.batterTint, VANILLA_SPONGE);
    const layers = (s.layerColors && s.layerColors.length) ? s.layerColors.map(c => safeColor(c, VANILLA_SPONGE)) : pal.layerColors;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (mode === 'oven') {
      // Hero: the mint HT Mini Oven baking the player's sponge in its round silver tin
      drawMiniOvenWithTin(ctx, cx, cy - 20, 330, 230, true, cook, tint, layers, s.ovenPulse || 0, spring, t);
      // A little bowl of the same batter waiting on the counter (what went into the tin)
      if (ids.length || s.batterTint) {
        ctx.save();
        ctx.translate(cx - 196, cy + 78);
        softShadow(ctx, 0, 12, 30, 9, 0.18);
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-30, 0);
        ctx.quadraticCurveTo(-26, 22, 0, 24);
        ctx.quadraticCurveTo(26, 22, 30, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = tint;
        ell(ctx, 0, 0, 30, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ell(ctx, -10, -3, 8, 3, -0.3);
        ctx.fill();
        ctx.restore();
      }
    } else {
      // Slice 4 (18:00-24:00): Dual-Burner Stove Top with Clicking Temperature Dials,
      // Left Burner Boiling Soup Pot (water bubbles & steam vapor) + Right Burner Sizzling Skillet (egg & sausage flip)
      drawMiniOvenWithTin(ctx, cx, cy - 122, 236, 138, false, 0, tint, layers, 0, { sx: 1, sy: 1 }, t);
      drawDualBurnerStoveDeck(ctx, cx, cy, heat, soupHeat, s.dialPulse || 0, t);
      drawBoilingSoupPot(ctx, cx - 108, cy + 16, soupHeat, cook, ids, spring, t);
      drawSilverWok(ctx, cx + 68, cy + 24, s, t, heat, cook, panItems, ids, spring);
    }

    // Done sparkles
    if (cook >= 0.8 && !burnt) {
      ctx.fillStyle = '#F7C948';
      for (let k = 0; k < 4; k++) {
        const a = t * 2 + k * 1.6;
        sparkle4(ctx, cx + 150 + Math.cos(a) * 18, cy - 130 + Math.sin(a) * 10, 7 + Math.sin(t * 5 + k) * 2, t * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ---------- Station 4: White turntable, tweezers, piping bag & glaze jug ---------- */
  /** Miniature silver tweezers (sb_L2_M1 row 1 / sb_L2_M2 row 4). Origin = tip.
   *  grip 0 = open, 1 = pinched. opts.hold = { kind:'ball'|'rosette'|'topping', color, id } */
  function drawTweezers(ctx, x, y, r, angle, grip, opts) {
    opts = opts || {};
    grip = clamp01(grip === undefined ? 1 : grip);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const spread = r * (0.26 - grip * 0.14);
    const L = r * 2.2;
    const mg = ctx.createLinearGradient(-r * 0.4, 0, r * 0.4, 0);
    mg.addColorStop(0, '#8C9BA5');
    mg.addColorStop(0.5, '#F4F8FA');
    mg.addColorStop(1, '#A9B8C2');
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.6, r * 0.07);
    ctx.fillStyle = mg;
    [-1, 1].forEach(side => {
      ctx.beginPath();
      ctx.moveTo(side * spread * 0.2, -r * 0.05);
      ctx.lineTo(side * spread, -r * 0.9);
      ctx.lineTo(side * (spread + r * 0.16), -L);
      ctx.lineTo(side * (spread - r * 0.04), -L - r * 0.05);
      ctx.lineTo(side * (spread * 0.6), -r * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    // Joint cap at the top
    ctx.fillStyle = '#C9D4DC';
    rr(ctx, -r * 0.3, -L - r * 0.22, r * 0.6, r * 0.26, r * 0.1);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(-spread + r * 0.03, -r * 0.8);
    ctx.lineTo(-spread - r * 0.06, -L + r * 0.2);
    ctx.stroke();
    // Whatever is pinched between the tips
    const hold = opts.hold;
    if (hold && grip > 0.15) {
      if (hold.kind === 'rosette') drawButtercreamRosette(ctx, 0, r * 0.1, r * 0.22, safeColor(hold.color, '#FF85B3'));
      else if (hold.kind === 'topping' && hold.id) drawTopping(ctx, { id: hold.id, ingredient: hold.ingredient, x: 0, y: r * 0.12, seed: 1, color: hold.color }, 0, null);
      else drawSpecularCandyBall(ctx, 0, r * 0.08, r * 0.2, safeColor(hold.color, '#FF2A2A'));
    }
    ctx.restore();
  }

  /** Small ceramic glaze jug pouring the selected glaze colour. Origin = spout. */
  function drawGlazeJug(ctx, x, y, r, tilt, color, pour) {
    color = safeColor(color, '#FF2B5E');
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (pour > 0.03) {
      ctx.fillStyle = color;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.08, 0);
      ctx.quadraticCurveTo(-r * 0.1, r * 0.5 * pour, -r * 0.04, r * 1.05 * pour);
      ctx.lineTo(r * 0.06, r * 1.05 * pour);
      ctx.quadraticCurveTo(r * 0.12, r * 0.5 * pour, r * 0.08, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      rr(ctx, -r * 0.04, r * 0.1, r * 0.04, r * 0.7 * pour, r * 0.02);
      ctx.fill();
    }
    // Jug body (cream ceramic) with the glaze visible inside the mouth
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.8, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, 0);
    ctx.lineTo(r * 0.34, -r * 0.12);
    ctx.lineTo(r * 1.1, -r * 0.2);
    ctx.quadraticCurveTo(r * 1.3, -r * 0.9, r * 0.9, -r * 1.3);
    ctx.lineTo(r * 0.1, -r * 1.3);
    ctx.quadraticCurveTo(-r * 0.28, -r * 1.0, -r * 0.12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ell(ctx, r * 0.5, -r * 0.18, r * 0.5, r * 0.11, -0.08);
    ctx.fill();
    ctx.stroke();
    // Handle
    ctx.beginPath();
    ctx.moveTo(r * 1.08, -r * 1.05);
    ctx.quadraticCurveTo(r * 1.65, -r * 0.95, r * 1.2, -r * 0.4);
    ctx.lineWidth = Math.max(2.4, r * 0.12);
    ctx.stroke();
    ctx.strokeStyle = '#FFFDF9';
    ctx.lineWidth = Math.max(1.2, r * 0.06);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ell(ctx, r * 0.35, -r * 0.95, r * 0.08, r * 0.2, -0.2);
    ctx.fill();
    ctx.restore();
  }

  /** Interactive glass candy jar with scoop on the decorating counter (Slice 8). */
  function drawCandyJar(ctx, x, y, scale, scoopT, t) {
    scale = scale || 1;
    scoopT = clamp01(scoopT || 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    softShadow(ctx, 0, 28, 30, 10, 0.2);

    // Glass jar body back
    ctx.fillStyle = 'rgba(238, 248, 255, 0.72)';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    rr(ctx, -26, -24, 52, 50, 14);
    ctx.fill();
    ctx.stroke();

    // Rainbow candy balls packed inside the jar
    const jarBalls = [
      [-14, 16, '#FF2A2A'], [-4, 18, '#FF8C1A'], [6, 17, '#FFE619'], [15, 15, '#1FD141'],
      [-15, 6, '#2986FF'], [-5, 8, '#8C2BFF'], [5, 7, '#FF2A2A'], [14, 5, '#FF8C1A'],
      [-11, -3, '#FFE619'], [0, -2, '#1FD141'], [11, -4, '#2986FF'],
    ];
    jarBalls.forEach(([bx, by, bcol], i) => {
      const bounce = scoopT > 0 ? Math.sin(scoopT * PI2 + i) * 2.2 : 0;
      drawSpecularCandyBall(ctx, bx, by - bounce, 6.2, bcol);
    });

    // Glass specular reflection highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    rr(ctx, -20, -18, 7, 36, 3.5);
    ctx.fill();

    // Jar neck collar & tilted pastel lid
    ctx.fillStyle = '#FFE4EE';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    rr(ctx, -22, -30, 44, 8, 4);
    ctx.fill();
    ctx.stroke();

    // Miniature silver/pastel candy scoop dipping into or resting on the jar
    ctx.save();
    const dip = Math.sin(scoopT * PI);
    ctx.translate(10 - dip * 8, -32 + dip * 14);
    ctx.rotate(-0.45 - dip * 0.55);
    // Scoop bowl
    ctx.fillStyle = '#E6EDF2';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Candies inside scoop when scooping
    if (scoopT > 0.05) {
      drawSpecularCandyBall(ctx, -3, 2, 4.5, '#FF2A2A');
      drawSpecularCandyBall(ctx, 3, 2, 4.5, '#FFE619');
    }
    // Pastel handle
    ctx.fillStyle = '#FF94B8';
    rr(ctx, 8, -4, 18, 7, 3.5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  /** Musical pastel birthday cake knife for velcro cake slicing (Slice 8). */
  function drawMusicalCakeKnife(ctx, x, y, r, angle, slashT, t) {
    r = r || 42;
    slashT = clamp01(slashT || 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle === undefined ? -0.45 : angle);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Scalloped cream/mint toy plastic blade
    const bg = ctx.createLinearGradient(-r * 0.9, -r * 0.2, r * 0.2, r * 0.25);
    bg.addColorStop(0, '#FFFFFF');
    bg.addColorStop(0.65, '#FFFDF9');
    bg.addColorStop(1, '#E8F6F0');
    ctx.fillStyle = bg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.14);
    ctx.lineTo(-r * 1.15, -r * 0.12);
    ctx.quadraticCurveTo(-r * 1.32, 0, -r * 1.1, r * 0.22);
    ctx.lineTo(0, r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cute scalloped serrations along bottom edge
    ctx.strokeStyle = '#9ED9C4';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const sx = -r * 0.15 - k * r * 0.16;
      ctx.arc(sx, r * 0.16, r * 0.06, 0, PI);
    }
    ctx.stroke();

    // Musical eighth-note emblem on blade (pure vector shape, zero text)
    ctx.fillStyle = '#FF6B9D';
    ell(ctx, -r * 0.62, r * 0.05, r * 0.09, r * 0.065, -0.3);
    ctx.fill();
    ctx.strokeStyle = '#FF6B9D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.54, r * 0.05);
    ctx.lineTo(-r * 0.54, -r * 0.09);
    ctx.lineTo(-r * 0.43, -r * 0.04);
    ctx.stroke();

    // Pastel pink ergonomic handle with heart chime button
    ctx.fillStyle = '#FF94B8';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    rr(ctx, -r * 0.04, -r * 0.2, r * 0.78, r * 0.42, r * 0.2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFE66D';
    heart(ctx, r * 0.32, r * 0.01, r * 0.12);
    ctx.fill();
    ctx.stroke();

    // Floating musical sparkle when slicing
    if (slashT > 0.05) {
      ctx.fillStyle = '#F7C948';
      sparkle4(ctx, -r * 0.75, -r * 0.28 - Math.sin(slashT * PI) * 10, 7, (t || 0) * 4);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDecorateStation(ctx, cx, cy, s, t) {
    s = s || {};
    const dish = s.dish;
    const spring = s.boardSpring || { sx: 1, sy: 1 };
    const dishScale = (s.dishScale || 1.08) * (spring.sx || 1);
    const tool = s.decorTool || 'piping';
    const pa = normAnim(s.pipingAnim);
    const hp = s.hoverPt || null;
    const toolColor = s.toolColor || (tool === 'sauce' ? '#FF2B5E' : '#FF85B3');
    const style = s.cakeStyle || (dish && dish.cakeStyle) || null;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const turntableAngle = s.turntableAngle !== undefined ? s.turntableAngle : ((dish && dish.turntableAngle !== undefined) ? dish.turntableAngle : 0);
    if (!dish) {
      drawWhiteCakeTurntable(ctx, cx, cy + 54, 144, 76, turntableAngle, t);
    }

    // Cute studio figurines on the counter (left sunflower pot, right rainbow arch, plus interactive Candy Jar with Scoop)
    drawYellowSunflowerPot(ctx, cx - 192, cy + 62, 0.88);
    drawCandyJar(ctx, cx - 192, cy - 8, 0.92, s.candyScoopAnim || 0, t);
    drawRainbowArchFigurine(ctx, cx + 192, cy + 62, 0.88);

    // Tool follows the pointer when near the dish; otherwise rests to the side
    let tx = cx + 196, ty = cy - 24 + Math.sin(t * 2.5) * 4;
    let near = s.toolNear !== undefined ? !!s.toolNear : !!(hp && Math.hypot(hp.x - cx, hp.y - cy) < 185);
    if (hp && (near || s.toolNear === undefined)) { tx = hp.x; ty = hp.y; }
    if (hp && s.toolNear === undefined && !near) { tx = cx + 196; ty = cy - 24 + Math.sin(t * 2.5) * 4; }

    if (dish) {
      const dishWithAngle = Object.assign({}, dish, { turntableAngle });
      drawDish(ctx, dishWithAngle, cx, cy, dishScale, t, {
        toppingSprings: s.toppingSprings,
        placing: pa.active ? { kind: pa.kind || (s.pipingAnim && s.pipingAnim.kind) || 'piping', t: pa.t } : null,
      });

      // Intuitive tap-to-decorate hint if cake is plain and no action is currently occurring
      if (!near && !pa.active) {
        const decCount = (dish.rosettes ? dish.rosettes.length : 0) +
                         (dish.candyBalls ? dish.candyBalls.length : 0) +
                         (dish.toppings ? dish.toppings.length : 0) +
                         (dish.sauces ? dish.sauces.length : 0);
        if (decCount === 0) {
          ctx.save();
          const pulse = (t * 1.2) % 1;
          ctx.strokeStyle = `rgba(255, 255, 255, ${(0.8 * (1 - pulse)).toFixed(3)})`;
          ctx.lineWidth = 2.5;
          ell(ctx, cx, cy - 32, 28 + pulse * 22, 14 + pulse * 11);
          ctx.stroke();
          const bob = Math.sin(t * 4) * 4;
          drawIcon(ctx, 'arrow_down', cx, cy - 56 + bob, 11, t);
          ctx.restore();
        }
      }
    }
    const squeezeGiven = s.pipingAnim && typeof s.pipingAnim.squeeze === 'number' ? clamp01(s.pipingAnim.squeeze) : null;
    const sq = squeezeGiven !== null ? squeezeGiven : (pa.active ? bump(pa.t) : (near ? 0.12 + Math.sin(t * 4) * 0.06 : 0));
    const shake = (s.pipingAnim && s.pipingAnim.shake) || 0;
    const tilt = s.toolTilt || 0;
    const kind = pa.active ? (pa.kind || (s.pipingAnim && s.pipingAnim.kind)) : null;
    if (pa.active && pa.x !== undefined) { tx = pa.x; ty = pa.y; }

    const knifeAnim = normAnim(s.cakeKnifeAnim);
    const usesTweezers = tool === 'topping' || (tool === 'piping' && style === 'candy_balls');
    if (tool === 'knife' || knifeAnim.active) {
      const kt = knifeAnim.active ? knifeAnim.t : 0;
      const slashDip = Math.sin(kt * PI) * 26;
      const kx = knifeAnim.active ? (cx + 38 - kt * 28) : ( tx + 18 );
      const ky = knifeAnim.active ? (cy - 38 + slashDip) : ( ty - 18 );
      const kAngle = -0.38 - Math.sin(kt * PI) * 0.32 + tilt * 0.25;
      drawMusicalCakeKnife(ctx, kx, ky, 44, kAngle, kt, t);
    } else if (tool === 'sauce') {
      // Pouring the chosen glaze over the top edge (sb_L2_M2 row 4)
      drawGlazeJug(ctx, tx + 6, ty - 10, 34, 0.5 + shake + tilt + sq * 0.25, toolColor, near || pa.active ? 0.4 + sq : 0);
    } else if (usesTweezers) {
      // Tweezers approach from the upper right, release the piece on the cake, lift away
      const lift = pa.active ? (1 - bump(seg(pa.t, 0.0, 0.7))) : 1;
      const grip = pa.active ? 1 - seg(pa.t, 0.45, 0.75) : 1;
      let hold = null;
      if (tool === 'topping') {
        const topId = s.selectedTopping || s.toppingId || null;
        const topMeta = topId && KitchenData.getTopping ? KitchenData.getTopping(topId) : null;
        hold = { kind: topId && topId !== 'candy_balls' ? 'topping' : 'ball', id: topId, ingredient: topMeta && topMeta.ingredient, color: toolColor };
      } else {
        hold = { kind: 'ball', color: toolColor };
      }
      drawTweezers(ctx, tx + 2 + lift * 10, ty - 4 - lift * 18, 30, -0.55 + tilt * 0.4 + shake * 0.3, grip, { hold });
    } else {
      // Slanted piping bag with silver star tip approaching from the right (sb_L2_M1 row 5)
      const bagAngle = -0.72 + shake * 0.4 + tilt * 0.3;
      drawPipingBag(ctx, tx + 20, ty - 24, 42, sq, (pa.active && pa.color) || toolColor, { angle: bagAngle });
    }
    ctx.restore();
  }

  /* ---------- Station 5: Silver spoon scoop & flight to the mouth ---------- */
  function drawFeedStation(ctx, cx, cy, s, t) {
    s = s || {};
    const dish = s.dish;
    const spring = s.boardSpring || { sx: 1, sy: 1 };
    const dishScale = (s.dishScale || 1.05) * (spring.sx || 1);
    const fork = s.fork || { x: cx + 200, y: cy, dragging: false };
    const fs = normAnim(s.flyingSpoon);
    const mouth = s.mouth || { x: cx, y: cy - 220 };
    const bites = dish ? (dish.bitesTaken || 0) : 0;

    // Caller-provided scoopProgress wins (even 0); otherwise derive it from the spoon phase
    let scoopP = s.scoopProgress === undefined || s.scoopProgress === null ? null : clamp01(s.scoopProgress);
    if (scoopP === null) {
      scoopP = 0;
      if (fs.active) {
        if (fs.phase === 'scoop') scoopP = seg(fs.t, 0.08, 0.28);
        else if (fs.phase) scoopP = 1;
        else scoopP = seg(fs.t, 0.08, 0.28);
      }
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const isCake = isCakeDish(dish);
    if (dish) drawDish(ctx, dish, cx, cy, dishScale, t, { scoopProgress: scoopP, toppingSprings: s.toppingSprings });

    const sampleId = dish && dish.items.length ? dish.items[0].id : 'strawberry';
    const sampleCooked = dish && dish.items.length ? (dish.items[0].cooked || 0) : 0;
    const dishCol = dish ? (dish.liquidColor || deriveBatterTint(dish) || '#F4A6B8') : '#F4A6B8';
    // The bite on the spoon is a wedge of THE player's cake (real layers, real frosting)
    let topper = null;
    if (dish && isCake) {
      if (dish.candyBalls && dish.candyBalls.length) topper = { kind: 'ball', color: dish.candyBalls[0].color };
      else if (dish.rosettes && dish.rosettes.length) topper = { kind: 'rosette', color: dish.rosettes[0].color };
      else {
        const fruit = dish.items.find(it => !isNeutralId(it.id) && !isChocoId(it.id));
        if (fruit) topper = { kind: 'fruit', id: fruit.id };
      }
    }
    const glaze = dish && isCake ? cakeGlaze(dish) : null;
    const spoonOpts = {
      isCake,
      layerColors: dish ? deriveLayerColors(dish) : null,
      frostingColor: dish ? deriveFrostingColor(dish) : null,
      glazeColor: glaze && glaze.color && glaze.coverage > 0 ? lerpColor(deriveFrostingColor(dish), glaze.color, clamp01(glaze.coverage * 1.6)) : null,
      topper,
    };

    // Dotted guide path from the spoon to the mouth (opt-in; game.js draws its own)
    if (s.drawGuide && bites === 0 && !fork.dragging && !fs.active) {
      const hx = fork.homeX !== undefined ? fork.homeX : fork.x;
      const hy = fork.homeY !== undefined ? fork.homeY : fork.y;
      const ctrlX = (hx + mouth.x) / 2 + 60, ctrlY = (hy + mouth.y) / 2 - 40;
      ctx.save();
      ctx.strokeStyle = 'rgba(232, 131, 136, 0.6)';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([9, 9]);
      ctx.lineDashOffset = -t * 40;
      ctx.beginPath();
      ctx.moveTo(hx - 18, hy - 22);
      ctx.quadraticCurveTo(ctrlX, ctrlY, mouth.x, mouth.y + 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(232, 131, 136, 0.8)';
      for (let k = 0; k < 3; k++) {
        const u = ((t * 0.3 + k / 3) % 1);
        const p = qbez(hx - 18, hy - 22, ctrlX, ctrlY, mouth.x, mouth.y + 10, u);
        heart(ctx, p.x, p.y, 6 + Math.sin(t * 6 + k) * 1.5);
        ctx.fill();
      }
      ctx.restore();
    }

    const R = 31;
    if (fs.active) {
      const sx = fs.startX !== undefined ? fs.startX : cx;
      const sy = fs.startY !== undefined ? fs.startY : cy - 20;
      const ex = fs.endX !== undefined ? fs.endX : mouth.x;
      const ey = fs.endY !== undefined ? fs.endY : mouth.y;
      const kx = fs.ctrlX !== undefined ? fs.ctrlX : (sx + ex) / 2 + 90;
      const ky = fs.ctrlY !== undefined ? fs.ctrlY : Math.min(sy, ey) - 90;
      let px, py, ang, load, alpha = 1;
      const tt = fs.t;
      if (typeof fs.x === 'number' && typeof fs.y === 'number') {
        px = fs.x; py = fs.y; ang = fs.angle !== undefined ? fs.angle : -0.55;
        load = fs.loaded === undefined ? 1 : (typeof fs.loaded === 'number' ? fs.loaded : (fs.loaded ? 1 : 0));
        if (fs.phase === 'scoop') load = seg(tt, 0.08, 0.28);
        else if (fs.phase === 'eat') load = 1 - seg(tt, 0.74, 0.86);
      } else if (tt < 0.28) {
        const p = tt / 0.28;
        const dip = Math.sin(p * PI);
        px = sx + 8 * p; py = sy + dip * 14; ang = lerp(-0.55, -1.0, dip);
        load = seg(tt, 0.08, 0.28);
      } else if (tt < 0.72) {
        const p = easeInOutSine((tt - 0.28) / 0.44);
        const q = qbez(sx, sy, kx, ky, ex, ey, p);
        const tg = qbezTan(sx, sy, kx, ky, ex, ey, p);
        px = q.x; py = q.y;
        ang = Math.atan2(tg.y, tg.x) + PI / 2 - 0.2;
        load = 1;
      } else {
        const p = (tt - 0.72) / 0.28;
        px = ex + Math.sin(p * PI) * 4; py = ey + 6 - p * 4;
        ang = lerp(-0.9, -1.35, smooth(p));
        load = 1 - seg(tt, 0.74, 0.86);
        if (tt > 0.88) { alpha = 1 - seg(tt, 0.88, 1); py += seg(tt, 0.88, 1) * 30; }
      }
      // Crumb & star sparkle trail behind the flying spoon
      if (tt > 0.3 && tt < 0.8) {
        for (let k = 1; k <= 6; k++) {
          const tk = tt - k * 0.035;
          if (tk < 0.28) break;
          const p = easeInOutSine(clamp01((tk - 0.28) / 0.44));
          const q = qbez(sx, sy, kx, ky, ex, ey, p);
          const a = 0.7 * (1 - k / 7);
          if (k % 2) {
            ctx.fillStyle = `rgba(247, 201, 72, ${a.toFixed(3)})`;
            sparkle4(ctx, q.x + (hash(k) - 0.5) * 16, q.y + 10 + hash(k + 2) * 10, 5 + k * 0.6, t * 3 + k);
            ctx.fill();
          } else {
            ctx.fillStyle = rgba(dishCol, a);
            blob(ctx, q.x + (hash(k + 5) - 0.5) * 14, q.y + 14 + k * 3, 3, 2.4, k, 0.3, 7);
            ctx.fill();
          }
        }
      }
      ctx.save();
      ctx.globalAlpha *= alpha;
      // Squash convention (game.js): scale((2 - squash) * scale, squash * scale); squash 1 = neutral
      const fscale = fs.scale === undefined ? 1 : fs.scale;
      const sqz = fs.squash === undefined ? 1 : clamp(fs.squash, 0.4, 1.6);
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.scale((2 - sqz) * fscale, sqz * fscale);
      drawSpoon(ctx, 0, 0, R, 0, Object.assign({ scoop: load, ingId: fs.ingId || sampleId, color: fs.color || dishCol, cooked: sampleCooked }, spoonOpts));
      ctx.restore();
    } else {
      // Resting / dragged spoon, loaded with a bite while portions remain
      const idle = !fork.dragging;
      const bob = idle ? Math.sin(t * 2.6) * 3 : 0;
      if (idle && bites === 0) {
        const pulse = (t * 0.9) % 1;
        ctx.strokeStyle = `rgba(232, 131, 136, ${(0.5 * (1 - pulse)).toFixed(3)})`;
        ctx.lineWidth = 3;
        circ(ctx, fork.x, fork.y + bob, 26 + pulse * 30);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(92,61,46,0.12)';
      ell(ctx, fork.x + 6, fork.y + 42, 24, 7);
      ctx.fill();
      drawSpoon(ctx, fork.x, fork.y + bob, R, -0.55 + (fork.dragging ? Math.sin(t * 10) * 0.05 : 0), Object.assign({
        scoop: (fork.dragging || bites < 3) ? 1 : 0, ingId: sampleId, color: dishCol, cooked: sampleCooked,
      }, spoonOpts));
    }
    ctx.restore();
  }

  /* ==========================================================================
   * Station 9 (48:00 - 54:00): Sparkling Dishwashing Chore & Kitchen Cleanup
   *  1. Sudsy soap sponge scrub (pink pump dispenser, cellulose sponge, 3D foam)
   *  2. Faucet rinse swirl (brass gooseneck faucet, water stream, drain vortex)
   *  3. Drying rack organizing (slotted wooden rack, dripping water beads)
   *  4. Sorting recycling & trash bins (foot-pedal lids, causal waste items)
   * ========================================================================== */
  function drawSponge(ctx, x, y, r, angle, sudsAmount, squeeze, t) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    r = Number.isFinite(r) ? Math.max(8, r) : 28;
    angle = Number.isFinite(angle) ? angle : -0.15;
    sudsAmount = clamp01(sudsAmount || 0);
    squeeze = clamp01(squeeze || 0);
    t = Number.isFinite(t) ? t : 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const sx = 1 + squeeze * 0.14;
    const sy = 1 - squeeze * 0.12;
    ctx.scale(sx, sy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Contact shadow
    ctx.fillStyle = 'rgba(92, 61, 46, 0.16)';
    ell(ctx, 2, r * 0.48, r * 0.82, r * 0.26);
    ctx.fill();

    // Soft honey-yellow cellulose base
    ctx.fillStyle = '#FFE066';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(2, r * 0.08);
    rr(ctx, -r * 0.76, -r * 0.14, r * 1.52, r * 0.56, r * 0.18);
    ctx.fill();
    ctx.stroke();

    // Cellulose pores
    ctx.fillStyle = '#D9B226';
    [[-0.46, 0.08, 0.07], [-0.14, 0.18, 0.08], [0.18, 0.06, 0.06], [0.46, 0.16, 0.07], [-0.28, 0.24, 0.05], [0.3, 0.24, 0.05]].forEach(([px, py, pr]) => {
      circ(ctx, px * r, py * r, pr * r);
      ctx.fill();
    });

    // Emerald-mint scrub pad top layer
    ctx.fillStyle = '#68C478';
    ctx.strokeStyle = OUTLINE;
    rr(ctx, -r * 0.78, -r * 0.42, r * 1.56, r * 0.34, r * 0.14);
    ctx.fill();
    ctx.stroke();

    // Highlight strip on scrub pad
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    rr(ctx, -r * 0.58, -r * 0.35, r * 0.72, r * 0.09, r * 0.04);
    ctx.fill();

    // Iridescent soap suds crowning the sponge when loaded with soap
    if (sudsAmount > 0.02) {
      const puffs = [
        [-0.44, -0.44, 0.24],
        [-0.12, -0.52, 0.30],
        [0.24,  -0.48, 0.26],
        [0.52,  -0.36, 0.20],
        [-0.58, -0.26, 0.18],
      ];
      puffs.forEach(([bx, by, br], i) => {
        const pulse = 1 + Math.sin(t * 5 + i * 1.3) * 0.06;
        const rad = r * br * (0.4 + 0.6 * sudsAmount) * pulse;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(235, 250, 255, 0.92)' : 'rgba(255, 236, 245, 0.92)';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.6;
        circ(ctx, bx * r, by * r, rad);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        circ(ctx, bx * r - rad * 0.3, by * r - rad * 0.3, rad * 0.26);
        ctx.fill();
      });
    }

    ctx.restore();
  }

  function drawSoapDispenser(ctx, x, y, r, pumpPress, t) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    r = Number.isFinite(r) ? Math.max(10, r) : 34;
    pumpPress = clamp01(pumpPress || 0);
    t = Number.isFinite(t) ? t : 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Shadow
    ctx.fillStyle = 'rgba(92, 61, 46, 0.16)';
    ell(ctx, 0, r * 0.92, r * 0.62, r * 0.18);
    ctx.fill();

    // Pump plunger stem & curved nozzle (presses down with pumpPress)
    const headDy = pumpPress * r * 0.22;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(2.4, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.35);
    ctx.lineTo(0, -r * 0.78 + headDy);
    ctx.lineTo(r * 0.48, -r * 0.78 + headDy);
    ctx.lineTo(r * 0.58, -r * 0.64 + headDy);
    ctx.stroke();

    // Plunger cap
    ctx.fillStyle = '#FFFDF9';
    rr(ctx, -r * 0.26, -r * 0.88 + headDy, r * 0.56, r * 0.18, r * 0.08);
    ctx.fill();
    ctx.stroke();

    // Collar
    ctx.fillStyle = '#F5D076';
    rr(ctx, -r * 0.24, -r * 0.42, r * 0.48, r * 0.22, r * 0.07);
    ctx.fill();
    ctx.stroke();

    // Translucent pastel-pink soap bottle body
    const sqx = 1 + pumpPress * 0.06;
    const sqy = 1 - pumpPress * 0.04;
    ctx.save();
    ctx.scale(sqx, sqy);
    ctx.fillStyle = '#FF9EB5';
    rr(ctx, -r * 0.52, -r * 0.22, r * 1.04, r * 1.12, r * 0.3);
    ctx.fill();
    ctx.stroke();

    // Liquid soap window inside bottle
    ctx.fillStyle = '#7CE0F9';
    rr(ctx, -r * 0.38, r * 0.08, r * 0.76, r * 0.68, r * 0.2);
    ctx.fill();

    // Heart emblem (zero text)
    ctx.fillStyle = '#FFFDF9';
    heart(ctx, 0, r * 0.42, r * 0.24);
    ctx.fill();
    ctx.stroke();

    // Specular bottle gloss
    gloss(ctx, -r * 0.3, r * 0.18, r * 0.09, r * 0.32, 0, 0.55);
    ctx.restore();

    // Soap squirt droplet at nozzle tip when pressed
    if (pumpPress > 0.15) {
      ctx.fillStyle = '#7CE0F9';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      circ(ctx, r * 0.62, -r * 0.52 + headDy + pumpPress * 8, r * 0.14 * pumpPress);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawWasteItem(ctx, item, x, y, r, t) {
    if (!item || !Number.isFinite(x) || !Number.isFinite(y)) return;
    r = Number.isFinite(r) ? Math.max(8, r) : 24;
    t = Number.isFinite(t) ? t : 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.8, r * 0.08);

    const col = safeColor(item.color, '#88D4F7');
    const acc = safeColor(item.accent, '#FFFDF9');

    switch (item.kind) {
      case 'carton': {
        // Gable-top milk/cream carton (recyclable)
        ctx.fillStyle = col;
        rr(ctx, -r * 0.46, -r * 0.28, r * 0.92, r * 0.92, r * 0.14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = acc;
        ctx.beginPath();
        ctx.moveTo(-r * 0.46, -r * 0.22);
        ctx.lineTo(0, -r * 0.64);
        ctx.lineTo(r * 0.46, -r * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = acc;
        circ(ctx, 0, r * 0.18, r * 0.2);
        ctx.fill();
        break;
      }
      case 'punnet': {
        // Clear berry punnet clamshell tray (recyclable)
        ctx.fillStyle = col;
        rr(ctx, -r * 0.64, -r * 0.34, r * 1.28, r * 0.72, r * 0.16);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        [-0.32, 0, 0.32].forEach(vx => {
          ctx.beginPath();
          ctx.moveTo(vx * r, -r * 0.2);
          ctx.lineTo(vx * r, r * 0.24);
          ctx.stroke();
        });
        ctx.fillStyle = acc;
        circ(ctx, -r * 0.2, 0, r * 0.12);
        ctx.fill();
        break;
      }
      case 'jar': {
        // Empty glass honey/jam jar (recyclable)
        ctx.fillStyle = 'rgba(235, 248, 255, 0.86)';
        rr(ctx, -r * 0.48, -r * 0.3, r * 0.96, r * 0.9, r * 0.22);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = col;
        rr(ctx, -r * 0.4, -r * 0.52, r * 0.8, r * 0.24, r * 0.08);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = acc;
        star(ctx, 0, r * 0.14, r * 0.2, r * 0.09, 5);
        ctx.fill();
        break;
      }
      case 'tin': {
        // Cylindrical cocoa/tea canister (recyclable)
        ctx.fillStyle = col;
        rr(ctx, -r * 0.46, -r * 0.42, r * 0.92, r * 0.96, r * 0.16);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = acc;
        rr(ctx, -r * 0.5, -r * 0.52, r * 1.0, r * 0.18, r * 0.07);
        ctx.fill();
        ctx.stroke();
        circ(ctx, 0, r * 0.06, r * 0.18);
        ctx.fill();
        break;
      }
      case 'peel': {
        // Floppy yellow banana/fruit peel (compost/trash)
        ctx.fillStyle = col;
        [-0.45, 0, 0.45].forEach(ang => {
          ctx.save();
          ctx.rotate(ang);
          ell(ctx, 0, r * 0.12, r * 0.22, r * 0.52);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
        ctx.fillStyle = acc;
        circ(ctx, 0, -r * 0.36, r * 0.12);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'shell': {
        // Cracked jagged eggshell half (compost/trash)
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(0, r * 0.06, r * 0.54, 0, PI);
        ctx.lineTo(-r * 0.54, r * 0.06);
        ctx.lineTo(-r * 0.28, -r * 0.16);
        ctx.lineTo(0, r * 0.06);
        ctx.lineTo(r * 0.28, -r * 0.16);
        ctx.lineTo(r * 0.54, r * 0.06);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'stems': {
        // Leafy green strawberry/veggie calyx stems (compost/trash)
        ctx.fillStyle = col;
        star(ctx, 0, r * 0.08, r * 0.58, r * 0.24, 5, 0.2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = acc;
        circ(ctx, 0, r * 0.12, r * 0.16);
        ctx.fill();
        break;
      }
      default: {
        // Crinkled candy/cheese wrapper (trash)
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(-r * 0.66, -r * 0.24);
        ctx.lineTo(-r * 0.32, 0);
        ctx.lineTo(-r * 0.66, r * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.66, -r * 0.24);
        ctx.lineTo(r * 0.32, 0);
        ctx.lineTo(r * 0.66, r * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = acc;
        circ(ctx, 0, 0, r * 0.36);
        ctx.fill();
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  function drawDishwashStation(ctx, cx, cy, s, t) {
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
    s = s || {};
    t = Number.isFinite(t) ? t : 0;

    const chore = s.chore || 'scrub';
    const scrubP = clamp01(s.scrubProgress || 0);
    const rinseP = clamp01(s.rinseProgress || 0);
    const soapLoaded = clamp01(s.soapLoaded || 0);
    const pumpPress = clamp01(s.pumpPress || 0);
    const faucetOn = !!s.faucetOn || (chore === 'rinse' && rinseP > 0 && rinseP < 1);
    const stainColors = Array.isArray(s.stainColors) && s.stainColors.length
      ? s.stainColors
      : ['#FF6B8B', '#FFB347', '#8C5230'];
    const sudsClusters = Array.isArray(s.sudsClusters) ? s.sudsClusters : [];
    const rackItems = Array.isArray(s.rackItems) ? s.rackItems : [];
    const wasteQueue = Array.isArray(s.wasteQueue) ? s.wasteQueue : [];
    const activeWaste = s.activeWaste || null;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const sinkX = cx - 92;
    const sinkY = cy + 16;
    const rackX = cx + 148;
    const rackY = cy - 42;
    const binsX = cx + 148;
    const binsY = cy + 68;

    // ------------------------------------------------------------------
    // 1. PORCELAIN SINK BASIN & GOOSENECK BRASS FAUCET (Left-Center)
    // ------------------------------------------------------------------
    softShadow(ctx, sinkX, sinkY + 12, 168, 92, 0.2);

    // Outer ceramic sink rim (#FAF3EB cream porcelain with #5C3D2E cocoa outline)
    ctx.fillStyle = '#FAF3EB';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;
    rr(ctx, sinkX - 156, sinkY - 78, 312, 158, 36);
    ctx.fill();
    ctx.stroke();

    // Inner recessed sink basin
    const basinGrd = ctx.createLinearGradient(sinkX, sinkY - 64, sinkX, sinkY + 64);
    basinGrd.addColorStop(0, '#D9F2FA');
    basinGrd.addColorStop(1, '#AEE3F5');
    ctx.fillStyle = basinGrd;
    ctx.lineWidth = 2.6;
    rr(ctx, sinkX - 136, sinkY - 58, 272, 122, 26);
    ctx.fill();
    ctx.stroke();

    // Swirling aqua water pool + drain whirlpool vortex inside basin
    const waterLevel = 0.35 + (faucetOn ? 0.35 : 0) + rinseP * 0.3;
    ctx.save();
    rr(ctx, sinkX - 132, sinkY - 54, 264, 114, 24);
    ctx.clip();

    ctx.fillStyle = `rgba(116, 212, 247, ${(0.35 + waterLevel * 0.35).toFixed(3)})`;
    ctx.fillRect(sinkX - 135, sinkY - 56, 270, 120);

    // Drain grate & swirling vortex rings
    ctx.fillStyle = '#8C9BA5';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    circ(ctx, sinkX, sinkY + 4, 15);
    ctx.fill();
    ctx.stroke();

    if (faucetOn || rinseP > 0.05) {
      const swirlAngle = t * 5.2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
      ctx.lineWidth = 2.2;
      for (let ring = 0; ring < 3; ring++) {
        const rrRad = 24 + ring * 26 + Math.sin(t * 4 + ring) * 4;
        ctx.beginPath();
        ctx.arc(sinkX, sinkY + 4, rrRad, swirlAngle + ring * 1.2, swirlAngle + ring * 1.2 + PI * 1.15);
        ctx.stroke();
      }
    }

    // Hero Dish inside the sink (visible until all 4 dishes are racked)
    const rackedCount = rackItems.filter(it => it && it.placed).length;
    if (rackedCount < 4) {
      const dishShake = (chore === 'scrub' && scrubP > 0 && scrubP < 1) ? Math.sin(t * 18) * 1.5 : 0;
      const dx = sinkX + dishShake;
      const dy = sinkY + 4;
      const dr = 68;

      // Dish shadow in basin
      ctx.fillStyle = 'rgba(54, 110, 138, 0.22)';
      ell(ctx, dx + 3, dy + 8, dr * 1.02, dr * 0.88);
      ctx.fill();

      // Scalloped porcelain plate
      ctx.fillStyle = '#FFFDF9';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      ell(ctx, dx, dy, dr, dr * 0.86);
      ctx.fill();
      ctx.stroke();

      // Inner pastel rim
      ctx.strokeStyle = '#F2A7B5';
      ctx.lineWidth = 2.4;
      ell(ctx, dx, dy, dr * 0.76, dr * 0.64);
      ctx.stroke();

      // Causal food stains from cooked dish ingredients (fade out as scrubP & rinseP progress)
      const stainAlpha = clamp01(1 - (scrubP * 0.65 + rinseP * 0.35));
      if (stainAlpha > 0.02) {
        const stainOffsets = [
          [-22, -10, 20, 15, 0.3],
          [18,   8,  22, 16, -0.4],
          [-6,  16,  17, 13, 0.8],
          [12, -16,  15, 12, -0.2],
          [-26, 12,  14, 11, 0.5],
        ];
        stainOffsets.forEach(([ox, oy, srx, sry, srot], idx) => {
          const col = safeColor(stainColors[idx % stainColors.length], '#FF6B8B');
          ctx.save();
          ctx.globalAlpha = stainAlpha * 0.82;
          ctx.fillStyle = col;
          ctx.translate(dx + ox, dy + oy);
          ctx.rotate(srot);
          blob(ctx, 0, 0, srx * (0.5 + 0.5 * stainAlpha), sry * (0.5 + 0.5 * stainAlpha), idx + 1.4, 0.22, 10);
          ctx.fill();
          ctx.restore();
        });
      }

      // 3D Sudsy Foam Bubble Clusters (grow with scrubP, swirl & wash away with rinseP)
      const sudsVis = clamp01(scrubP * (1 - rinseP * 0.95));
      if (sudsVis > 0.02 || sudsClusters.length > 0) {
        const count = Math.max(sudsClusters.length, Math.round(sudsVis * 14));
        for (let i = 0; i < count; i++) {
          const sc = sudsClusters[i] || {
            ox: Math.cos(i * 2.399) * (14 + (i % 4) * 12),
            oy: Math.sin(i * 2.399) * (10 + (i % 3) * 11),
            r: 11 + (i % 4) * 3.5,
          };
          const swirlRot = rinseP * 3.2;
          const bx = dx + (sc.ox * Math.cos(swirlRot) - sc.oy * Math.sin(swirlRot)) * (1 - rinseP * 0.45);
          const by = dy + (sc.ox * Math.sin(swirlRot) + sc.oy * Math.cos(swirlRot)) * (1 - rinseP * 0.45);
          const br = sc.r * Math.max(0.2, 1 - rinseP * 0.88) * (1 + Math.sin(t * 5 + i) * 0.06);
          if (br > 2) {
            ctx.fillStyle = i % 2 === 0 ? 'rgba(240, 252, 255, 0.92)' : 'rgba(255, 238, 246, 0.90)';
            ctx.strokeStyle = OUTLINE;
            ctx.lineWidth = 1.5;
            circ(ctx, bx, by, br);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            circ(ctx, bx - br * 0.3, by - br * 0.3, br * 0.26);
            ctx.fill();
          }
        }
      }

      // Squeaky-clean star sparkles when scrubbed & rinsed
      if (scrubP >= 0.85 && rinseP >= 0.85) {
        const spPts = [[-36, -22], [38, -18], [-24, 26], [32, 24], [0, -4]];
        spPts.forEach(([sx, sy], i) => {
          const pulse = 0.6 + 0.4 * Math.sin(t * 6 + i * 1.4);
          ctx.fillStyle = i % 2 === 0 ? '#FFD166' : '#FFFFFF';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 1.4;
          sparkle4(ctx, dx + sx, dy + sy, (9 + (i % 2) * 4) * pulse, t * 2 + i);
          ctx.fill();
          ctx.stroke();
        });
      }
    }
    ctx.restore();

    // Gooseneck Brass Faucet & Valve Handles at top of sink
    const fx = sinkX;
    const fy = sinkY - 74;
    // Faucet base plate
    ctx.fillStyle = '#F5D076';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    rr(ctx, fx - 44, fy - 10, 88, 20, 9);
    ctx.fill();
    ctx.stroke();

    // Hot & Cold cross handles (rotate when faucetOn)
    const knobRot = faucetOn ? t * 4 : 0;
    [-28, 28].forEach((kx, idx) => {
      ctx.save();
      ctx.translate(fx + kx, fy - 12);
      ctx.rotate(knobRot * (idx === 0 ? 1 : -1));
      ctx.fillStyle = idx === 0 ? '#FF85A2' : '#7CE0F9';
      rr(ctx, -11, -5, 22, 10, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // Gooseneck arch pipe
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(fx, fy - 8);
    ctx.lineTo(fx, fy - 42);
    ctx.arc(fx + 18, fy - 42, 18, PI, 0, false);
    ctx.lineTo(fx + 36, fy - 22);
    ctx.stroke();

    ctx.strokeStyle = '#F5D076';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Aerator nozzle tip
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    rr(ctx, fx + 27, fy - 24, 18, 10, 4);
    ctx.fill();
    ctx.stroke();

    // Animated Faucet Water Stream when faucetOn
    if (faucetOn) {
      const streamX = fx + 36;
      const streamTop = fy - 14;
      const streamBot = sinkY + 12;
      const wobble = Math.sin(t * 16) * 2.5;
      const wGrd = ctx.createLinearGradient(streamX, streamTop, streamX, streamBot);
      wGrd.addColorStop(0, 'rgba(224, 249, 255, 0.92)');
      wGrd.addColorStop(0.5, 'rgba(116, 216, 250, 0.85)');
      wGrd.addColorStop(1, 'rgba(180, 240, 255, 0.45)');
      ctx.fillStyle = wGrd;
      ctx.beginPath();
      ctx.moveTo(streamX - 6, streamTop);
      ctx.quadraticCurveTo(streamX - 11 + wobble, (streamTop + streamBot) * 0.5, streamX - 16 - wobble, streamBot);
      ctx.lineTo(streamX + 16 + wobble, streamBot);
      ctx.quadraticCurveTo(streamX + 11 - wobble, (streamTop + streamBot) * 0.5, streamX + 6, streamTop);
      ctx.closePath();
      ctx.fill();

      // White foam splash rings at stream impact point
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      const splashR = 14 + ((t * 36) % 24);
      ell(ctx, streamX, streamBot, splashR, splashR * 0.48);
      ctx.stroke();
    }

    // Pink Soap Pump Dispenser on left sink corner
    drawSoapDispenser(ctx, sinkX - 122, sinkY - 56, 30, pumpPress, t);

    // ------------------------------------------------------------------
    // 2. SLOTTED BEECHWOOD DRYING RACK (Top-Right)
    // ------------------------------------------------------------------
    softShadow(ctx, rackX, rackY + 34, 118, 30, 0.18);

    // Drip tray base
    ctx.fillStyle = '#CFEFF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    rr(ctx, rackX - 110, rackY + 10, 220, 32, 14);
    ctx.fill();
    ctx.stroke();

    // Beechwood slotted side rails
    ctx.fillStyle = '#E6B88A';
    rr(ctx, rackX - 104, rackY + 4, 208, 16, 8);
    ctx.fill();
    ctx.stroke();

    // Organized clean dishes standing upright in rack slots + dripping water beads
    const slots = (KitchenData && KitchenData.DRYING_RACK_SLOTS) || [];
    slots.forEach((slot, idx) => {
      const itemState = rackItems[idx];
      const placed = itemState && itemState.placed;
      const sx = rackX + (slot.slotX || (-75 + idx * 50));
      const sy = rackY + (slot.slotY || -10);

      // Ghost slot outline when chore === 'rack' and not yet placed
      if (!placed && chore === 'rack') {
        ctx.save();
        ctx.strokeStyle = 'rgba(92, 61, 46, 0.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ell(ctx, sx, sy, (slot.rx || 36) * 0.55, (slot.ry || 36) * 0.72);
        ctx.stroke();
        ctx.restore();
      }

      if (placed) {
        const popScale = itemState.pop !== undefined ? clamp(itemState.pop, 0.5, 1.3) : 1;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(popScale, popScale);
        ctx.fillStyle = safeColor(slot.color, '#FAF3EB');
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.4;
        ell(ctx, 0, 0, (slot.rx || 38) * 0.58, (slot.ry || 38) * 0.78);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = safeColor(slot.rim, '#F2A7B5');
        ctx.lineWidth = 2;
        ell(ctx, 0, 0, (slot.rx || 38) * 0.4, (slot.ry || 38) * 0.55);
        ctx.stroke();

        // Sparkle on racked dish
        ctx.fillStyle = '#FFD166';
        sparkle4(ctx, -6, -10, 6 + Math.sin(t * 5 + idx) * 1.5, t * 2 + idx);
        ctx.fill();
        ctx.restore();

        // Falling water drip bead under racked dish
        const dripPhase = (t * 1.4 + idx * 0.37) % 1;
        const dripY = sy + 18 + dripPhase * 16;
        ctx.fillStyle = `rgba(116, 216, 250, ${(1 - dripPhase).toFixed(3)})`;
        circ(ctx, sx, dripY, 3.2 * (1 - dripPhase * 0.4));
        ctx.fill();
      }

      // Wooden divider peg in front of slot
      ctx.fillStyle = '#D49B6A';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      rr(ctx, sx - 18, rackY - 22, 7, 30, 3.5);
      ctx.fill();
      ctx.stroke();
    });

    // ------------------------------------------------------------------
    // 3. DUAL FOOT-PEDAL RECYCLING & TRASH BINS (Bottom-Right)
    // ------------------------------------------------------------------
    const binDefs = [
      { id: 'recycle', x: binsX - 54, y: binsY, body: '#78C87E', lid: '#FAF3EB', open: clamp01(s.recycleLidOpen || 0) },
      { id: 'trash',   x: binsX + 54, y: binsY, body: '#FF9A62', lid: '#FAF3EB', open: clamp01(s.trashLidOpen || 0) },
    ];

    binDefs.forEach((b) => {
      softShadow(ctx, b.x, b.y + 38, 42, 14, 0.2);

      // Tapered bin body
      ctx.fillStyle = b.body;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(b.x - 34, b.y - 24);
      ctx.lineTo(b.x + 34, b.y - 24);
      ctx.lineTo(b.x + 28, b.y + 36);
      ctx.lineTo(b.x - 28, b.y + 36);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pure vector emblem on front (zero text!)
      ctx.save();
      ctx.translate(b.x, b.y + 8);
      if (b.id === 'recycle') {
        // 3-arrow circular recycling chase loop + leaf
        ctx.strokeStyle = '#FFFDF9';
        ctx.lineWidth = 2.4;
        for (let k = 0; k < 3; k++) {
          const a0 = (k / 3) * PI2 - 0.3;
          const a1 = a0 + 1.35;
          ctx.beginPath();
          ctx.arc(0, 0, 12, a0, a1);
          ctx.stroke();
          const tx = Math.cos(a1) * 12;
          const ty = Math.sin(a1) * 12;
          ctx.fillStyle = '#FFFDF9';
          circ(ctx, tx, ty, 2.6);
          ctx.fill();
        }
      } else {
        // Organic apple-core / compost leaf emblem
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.6;
        ell(ctx, -3, 2, 9, 6, -0.4);
        ctx.fill();
        ctx.stroke();
        ell(ctx, 4, -2, 8, 5, 0.4);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      // Foot pedal at bottom base
      const pedalPush = b.open * 4;
      ctx.fillStyle = '#F5D076';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      rr(ctx, b.x - 14, b.y + 30 + pedalPush, 28, 8, 4);
      ctx.fill();
      ctx.stroke();

      // Hinged lid (tilts open on left/right pivot when open > 0)
      ctx.save();
      const pivotX = b.id === 'recycle' ? (b.x - 34) : (b.x + 34);
      const pivotY = b.y - 24;
      ctx.translate(pivotX, pivotY);
      const lidAng = (b.id === 'recycle' ? -1 : 1) * b.open * 0.95;
      ctx.rotate(lidAng);
      ctx.fillStyle = b.lid;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.6;
      const lidLeft = b.id === 'recycle' ? -4 : -72;
      rr(ctx, lidLeft, -12, 76, 14, 7);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // Unsorted waste items waiting on counter front-center & flying sorted item
    wasteQueue.forEach((w, idx) => {
      if (!w || w.sorted) return;
      const wx = Number.isFinite(w.x) ? w.x : (sinkX - 70 + idx * 52);
      const wy = Number.isFinite(w.y) ? w.y : (sinkY + 86);
      const bob = (chore === 'bins') ? Math.sin(t * 5 + idx * 1.4) * 3 : 0;
      drawWasteItem(ctx, w, wx, wy + bob, 22, t);
    });

    if (activeWaste && activeWaste.item) {
      drawWasteItem(ctx, activeWaste.item, activeWaste.x, activeWaste.y, 25, t);
    }

    // ------------------------------------------------------------------
    // 4. INTERACTIVE SPONGE CURSOR / RESTING SPONGE
    // ------------------------------------------------------------------
    const sp = s.sponge || {};
    const spX = Number.isFinite(sp.x) ? sp.x : (sinkX + 98);
    const spY = Number.isFinite(sp.y) ? sp.y : (sinkY - 50);
    const spRot = Number.isFinite(sp.angle) ? sp.angle : (-0.15 + (sp.scrubbing ? Math.sin(t * 16) * 0.18 : 0));
    drawSponge(ctx, spX, spY, 28, spRot, Math.max(soapLoaded, scrubP), sp.scrubbing ? 0.35 : 0, t);

    ctx.restore();
  }

  /* ==========================================================================
   * Slice 3 (12:00 - 18:00, 720-1080s): Ultimate Kitchen Playset Unboxing,
   * Modular Snap Assembly, Underside Battery Sound Module Cross-Section,
   * and Circulating Running-Water Sink & Veggie/Dish Wash Basin
   * ========================================================================== */

  /**
   * Renders the Ultimate Kitchen Playset Unboxing & Modular Assembly +
   * Underside Battery Compartment Cross-Section (2x AA batteries + snap cover + LED sound grille).
   */
  function drawPlaysetStation(ctx, cx, cy, s, t) {
    s = s || {};
    const ps = s.playsetState || {};
    const unboxed = ps.unboxed !== false;
    const unboxAnim = clamp01(ps.unboxProgress !== undefined ? ps.unboxProgress : (unboxed ? 1 : 0));
    const assembled = ps.assembledParts || {
      base_case: true,
      battery_bay: false,
      side_wings: false,
      back_hood: false,
      sink_unit: false,
      hanging_utensils: false,
    };
    const batteries = ps.batteriesInserted || [false, false];
    const coverClosed = !!ps.coverClosed;
    const soundActive = !!(ps.soundModuleActive || (batteries[0] && batteries[1] && coverClosed));
    const snapPulse = ps.snapPulse || 0;
    const spring = s.boardSpring || { sx: 1, sy: 1 };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.translate(cx, cy);
    ctx.scale((spring.sx || 1) * (1 + snapPulse * 0.04), (spring.sy || 1) * (1 - snapPulse * 0.03));

    // Soft countertop shadow under playset
    softShadow(ctx, 0, 88, 185, 28, 0.22);

    // 1. Cardboard Unboxing Flaps (fold open & fade as unboxAnim progresses)
    if (unboxAnim < 0.98) {
      const flapOpen = easeOutBack(unboxAnim);
      ctx.save();
      ctx.globalAlpha = clamp01(1 - unboxAnim * 0.85);
      ctx.fillStyle = '#E8C59E';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.2;
      // Left cardboard flap folding outward
      ctx.save();
      ctx.translate(-140, -10);
      ctx.rotate(-flapOpen * 1.15);
      rr(ctx, -56, -70, 56, 140, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // Right cardboard flap folding outward
      ctx.save();
      ctx.translate(140, -10);
      ctx.rotate(flapOpen * 1.15);
      rr(ctx, 0, -70, 56, 140, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }

    // 2. Modular Back Arch Hood & Utensil Pegboard ('back_hood')
    const hoodDone = !!assembled.back_hood;
    ctx.save();
    const hoodDrop = hoodDone ? 0 : -18 + Math.sin(t * 3.2) * 3;
    ctx.translate(0, hoodDrop);
    ctx.globalAlpha = hoodDone ? 1 : 0.58;
    const hg = ctx.createLinearGradient(0, -148, 0, -20);
    hg.addColorStop(0, '#9BE5D3');
    hg.addColorStop(1, '#7ED6C1');
    ctx.fillStyle = hg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.5;
    // Twin side pillars + arched hood canopy
    rr(ctx, -118, -124, 24, 108, 10);
    ctx.fill();
    ctx.stroke();
    rr(ctx, 94, -124, 24, 108, 10);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-126, -112);
    ctx.quadraticCurveTo(0, -162, 126, -112);
    ctx.lineTo(118, -88);
    ctx.quadraticCurveTo(0, -126, -118, -88);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Molded pegboard back panel with heart cut-out
    ctx.fillStyle = '#FFFDF9';
    rr(ctx, -92, -104, 184, 78, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FF9EB5';
    heart(ctx, 0, -82, 12);
    ctx.fill();
    ctx.stroke();
    if (!hoodDone) {
      // Snap-fit alignment dashed guide arrow
      ctx.strokeStyle = '#FF8FA8';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(0, -6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    // 3. Hanging Miniature Utensils ('hanging_utensils') on the pegboard hooks
    const utensilsDone = !!assembled.hanging_utensils;
    ctx.save();
    ctx.globalAlpha = utensilsDone ? 1 : 0.48;
    const utSwing = utensilsDone ? Math.sin(t * 2.6) * 0.06 : Math.sin(t * 4) * 0.12;
    [-54, -18, 18, 54].forEach((ux, idx) => {
      // Pink plastic peg hook
      ctx.fillStyle = '#FF8FA8';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      circ(ctx, ux, -66, 4.5);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.translate(ux, -64 + (utensilsDone ? 0 : -10));
      ctx.rotate(utSwing * (idx % 2 === 0 ? 1 : -1));
      ctx.fillStyle = '#E8EDF2';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      rr(ctx, -3, 0, 6, 26, 3);
      ctx.fill();
      ctx.stroke();
      if (idx === 0) {
        // Slotted spatula head
        rr(ctx, -8, 22, 16, 13, 4);
        ctx.fill();
        ctx.stroke();
      } else if (idx === 1) {
        // Soup ladle bowl
        circ(ctx, 0, 28, 8.5);
        ctx.fill();
        ctx.stroke();
      } else if (idx === 2) {
        // Slotted skimmer
        ell(ctx, 0, 28, 9, 7);
        ctx.fill();
        ctx.stroke();
      } else {
        // Pasta fork prongs
        rr(ctx, -7, 22, 14, 12, 3);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    });
    ctx.restore();

    // 4. Snap-On Mint Side Prep Wings ('side_wings')
    const wingsDone = !!assembled.side_wings;
    [-1, 1].forEach(side => {
      ctx.save();
      const wingOffset = wingsDone ? 0 : side * (16 + Math.sin(t * 3.5) * 4);
      ctx.translate(side * 158 + wingOffset, 10);
      ctx.globalAlpha = wingsDone ? 1 : 0.58;
      ctx.fillStyle = '#7ED6C1';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.2;
      rr(ctx, -34, -22, 68, 52, 16);
      ctx.fill();
      ctx.stroke();
      // Embossed plate / cup recess on wing shelf
      ctx.fillStyle = '#A6E8D7';
      ell(ctx, 0, 2, 22, 13);
      ctx.fill();
      ctx.stroke();
      // Locking plastic snap tab
      ctx.fillStyle = '#F7C948';
      rr(ctx, -side * 36 - 5, -8, 10, 16, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // 5. Main Pastel Coral-Pink Playset Counter Base ('base_case')
    const bg = ctx.createLinearGradient(0, -24, 0, 72);
    bg.addColorStop(0, '#FFAEC2');
    bg.addColorStop(0.5, '#FF8FA8');
    bg.addColorStop(1, '#E66F8B');
    ctx.fillStyle = bg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.8;
    rr(ctx, -134, -22, 268, 92, 22);
    ctx.fill();
    ctx.stroke();

    // Cream countertop surface plate
    ctx.fillStyle = '#FFFDF9';
    rr(ctx, -124, -18, 248, 38, 14);
    ctx.fill();
    ctx.stroke();

    // Left Stove Burner Ring on Playset Deck (glows warm crimson/amber when battery sound module is active!)
    const burnerX = -56, burnerY = 1;
    ctx.fillStyle = soundActive ? '#FF6B4A' : '#6B625C';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ell(ctx, burnerX, burnerY, 38, 14);
    ctx.fill();
    ctx.stroke();
    if (soundActive) {
      const glowPulse = 0.55 + 0.45 * Math.sin(t * 8);
      ctx.strokeStyle = `rgba(255, 220, 90, ${glowPulse.toFixed(3)})`;
      ctx.lineWidth = 3.5;
      ell(ctx, burnerX, burnerY, 28, 10);
      ctx.stroke();
      // Musical sound waves rising from active electronic stove module
      for (let m = 0; m < 3; m++) {
        const ph = (t * 0.8 + m * 0.33) % 1;
        const my = burnerY - 12 - ph * 34;
        const mx = burnerX + Math.sin(t * 4 + m * 2) * 14;
        ctx.fillStyle = `rgba(255, 112, 150, ${(1 - ph).toFixed(3)})`;
        circ(ctx, mx, my, 4.5);
        ctx.fill();
      }
    }

    // Right Drop-In Aqua Sink Basin & Pump Faucet Module ('sink_unit')
    const sinkDone = !!assembled.sink_unit;
    ctx.save();
    const sinkLift = sinkDone ? 0 : -16 + Math.sin(t * 3.8) * 3.5;
    ctx.translate(52, 0 + sinkLift);
    ctx.globalAlpha = sinkDone ? 1 : 0.6;
    ctx.fillStyle = '#5BC8E8';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    rr(ctx, -46, -14, 92, 30, 12);
    ctx.fill();
    ctx.stroke();
    // Inner water shimmer
    ctx.fillStyle = '#9BE8FA';
    rr(ctx, -38, -9, 76, 20, 8);
    ctx.fill();
    // White gooseneck pump faucet on right corner of basin
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(26, -10);
    ctx.lineTo(26, -34);
    ctx.arc(12, -34, 14, 0, PI, true);
    ctx.lineTo(-2, -26);
    ctx.stroke();
    ctx.strokeStyle = '#FFFDF9';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();

    // 6. UNDERSIDE BATTERY SOUND MODULE CROSS-SECTION (Foreground magnifying callout at bottom: y = +54)
    // Shows 2x AA battery slots with silver coil springs, gold/teal batteries, pink snap cover & LED speaker grille
    ctx.save();
    ctx.translate(0, 62);
    softShadow(ctx, 0, 28, 118, 12, 0.2);
    // Magnified compartment housing bezel
    ctx.fillStyle = '#F7DCE4';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;
    rr(ctx, -116, -24, 232, 52, 14);
    ctx.fill();
    ctx.stroke();

    // Left: 2x AA Battery Bay Cross-Section (-104 .. +28)
    ctx.fillStyle = '#4A3A34';
    rr(ctx, -104, -17, 132, 38, 8);
    ctx.fill();
    ctx.stroke();

    for (let bIdx = 0; bIdx < 2; bIdx++) {
      const slotY = -12 + bIdx * 17;
      // Silver negative helical spring coil on left of slot
      ctx.strokeStyle = '#C9D6DF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let c = 0; c < 4; c++) {
        const sx = -98 + c * 3.5;
        ctx.moveTo(sx, slotY + 2);
        ctx.lineTo(sx + 2, slotY + 11);
      }
      ctx.stroke();
      // Brass positive contact plate on right of slot
      ctx.fillStyle = '#F7C948';
      ctx.fillRect(18, slotY + 3, 4, 10);

      if (batteries[bIdx]) {
        // Inserted AA Battery (Teal-Mint cylinder + Golden top cap)
        ctx.fillStyle = '#48B88A';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        rr(ctx, -86, slotY + 1, 100, 13, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F7C948';
        rr(ctx, -12, slotY + 1, 26, 13, 3);
        ctx.fill();
        ctx.stroke();
        // Specular highlight bar on battery
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillRect(-78, slotY + 4, 58, 3);
      } else {
        // Pulsing ghost AA outline inviting player tap to insert battery
        const pulse = 0.45 + 0.35 * Math.sin(t * 5 + bIdx);
        ctx.strokeStyle = `rgba(255, 224, 102, ${pulse.toFixed(3)})`;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 3]);
        rr(ctx, -86, slotY + 1, 100, 13, 4);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Translucent/ Hinged Pink Battery Door Cover with screw tab (slides/snaps over bay when coverClosed)
    if (coverClosed) {
      ctx.fillStyle = 'rgba(255, 143, 168, 0.72)';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.6;
      rr(ctx, -104, -17, 132, 38, 8);
      ctx.fill();
      ctx.stroke();
      // Locking latch tab & silver screw head
      ctx.fillStyle = '#D8E2E8';
      circ(ctx, 16, 2, 5);
      ctx.fill();
      ctx.stroke();
    }

    // Right of compartment: Musical Speaker Grille & Power LED Indicator (+38 .. +106)
    ctx.fillStyle = soundActive ? '#FF5E7E' : '#8C7A72';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    circ(ctx, 52, 2, 9);
    ctx.fill();
    ctx.stroke();
    if (soundActive) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      circ(ctx, 49, -1, 3);
      ctx.fill();
    }
    // Speaker pinhole grille pattern
    ctx.fillStyle = OUTLINE;
    for (let gx = -1; gx <= 1; gx++) {
      for (let gy = -1; gy <= 1; gy++) {
        circ(ctx, 84 + gx * 8, 2 + gy * 8, 2.2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Completion / Active sparkles when playset is fully assembled & powered
    if (soundActive && hoodDone && wingsDone && sinkDone && utensilsDone) {
      ctx.fillStyle = '#F7C948';
      for (let k = 0; k < 6; k++) {
        const a = t * 1.8 + (k / 6) * PI2;
        sparkle4(ctx, Math.cos(a) * 168, -36 + Math.sin(a) * 74, 7 + Math.sin(t * 5 + k) * 2, t * 2 + k);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Renders the Slice 3 Running Water Circulating Sink & Dish/Veggie Wash Basin
   * with lower transparent water-recirculation pump cross-section, press-pump gooseneck faucet,
   * continuous water stream, concentric surface ripples, soapy bubbles, sponge, and drying rack.
   */
  function drawSinkStation(ctx, cx, cy, s, t) {
    s = s || {};
    const ps = s.playsetState || {};
    const faucetOn = !!ps.faucetOn;
    const pumpPress = clamp01(ps.pumpPress || 0);
    const waterLevel = clamp01(ps.waterLevel !== undefined ? ps.waterLevel : (faucetOn ? 0.85 : 0.45));
    const washItems = ps.washItems || [
      { id: 'tomato', kind: 'veggie', x: -58, y: 8, dirt: 0.7, soap: 0.2, clean: 0.1 },
      { id: 'carrot', kind: 'veggie', x: -12, y: 16, dirt: 0.4, soap: 0.5, clean: 0.3 },
      { id: 'strawberry', kind: 'veggie', x: 34, y: 10, dirt: 0.1, soap: 0.3, clean: 0.8 },
      { id: 'plate_pink', kind: 'dish', x: -34, y: -12, dirt: 0.5, soap: 0.4, clean: 0.2 },
      { id: 'cup_mint', kind: 'dish', x: 24, y: -14, dirt: 0.0, soap: 0.1, clean: 1.0 },
    ];
    const spring = s.boardSpring || { sx: 1, sy: 1 };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.translate(cx, cy);
    ctx.scale(spring.sx || 1, spring.sy || 1);

    softShadow(ctx, 0, 94, 188, 28, 0.22);

    // 1. LOWER TRANSPARENT CIRCULATING WATER PUMP CROSS-SECTION (y = +42 .. +92)
    // Shows how water drains from the basin bottom, travels right through the clear tube,
    // and is pumped back up into the gooseneck faucet!
    ctx.save();
    ctx.fillStyle = 'rgba(215, 245, 255, 0.55)';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.8;
    rr(ctx, -110, 44, 220, 44, 16);
    ctx.fill();
    ctx.stroke();

    // Recirculating U-tube pipe with animated aqua bubbles flowing toward the right pump impeller
    ctx.strokeStyle = '#48BFE3';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-40, 44);
    ctx.lineTo(-40, 68);
    ctx.lineTo(86, 68);
    ctx.lineTo(86, -8);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.2;
    for (let b = 0; b < 7; b++) {
      const u = ((t * (faucetOn ? 1.35 : 0.25) + b / 7) % 1);
      const bx = u < 0.65 ? lerp(-40, 86, u / 0.65) : 86;
      const by = u < 0.65 ? 68 : lerp(68, -8, (u - 0.65) / 0.35);
      ctx.fillStyle = '#A8EEFF';
      circ(ctx, bx, by, 3.5);
      ctx.fill();
      ctx.stroke();
    }

    // Spinning aqua turbine impeller wheel at bottom-right corner (86, 68)
    ctx.save();
    ctx.translate(86, 68);
    ctx.rotate(t * (faucetOn ? 10 : 1.2));
    ctx.fillStyle = '#FF8FA8';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    circ(ctx, 0, 0, 11);
    ctx.fill();
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      ctx.rotate(PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(9, 0);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();

    // 2. MOLDED AQUA WASH BASIN TUB & LEFT SLOTTED DRYING RACK WING
    // Left Drying Rack Wing (-182 .. -102)
    ctx.fillStyle = '#FF9EB5';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.4;
    rr(ctx, -184, -36, 82, 84, 18);
    ctx.fill();
    ctx.stroke();
    // Slotted draining ribs
    ctx.strokeStyle = 'rgba(92, 61, 46, 0.45)';
    ctx.lineWidth = 2.6;
    for (let rIdx = 0; rIdx < 5; rIdx++) {
      const ry = -20 + rIdx * 14;
      ctx.beginPath();
      ctx.moveTo(-170, ry);
      ctx.lineTo(-114, ry);
      ctx.stroke();
    }

    // Main Molded Turquoise/Aqua Sink Basin (-108 .. +112, -44 .. +52)
    const tubG = ctx.createLinearGradient(0, -46, 0, 54);
    tubG.addColorStop(0, '#7CE2F7');
    tubG.addColorStop(1, '#44B3D8');
    ctx.fillStyle = tubG;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.8;
    rr(ctx, -108, -44, 220, 96, 26);
    ctx.fill();
    ctx.stroke();

    // Inner Recessed Basin Floor & Animated Water Pool
    ctx.save();
    rr(ctx, -94, -32, 192, 72, 20);
    ctx.fillStyle = '#389EC2';
    ctx.fill();
    ctx.clip();

    // Rising water pool fill
    const poolAlpha = 0.55 + waterLevel * 0.35;
    const wg = ctx.createRadialGradient(-10, -8, 12, 0, 4, 110);
    wg.addColorStop(0, `rgba(195, 248, 255, ${poolAlpha.toFixed(3)})`);
    wg.addColorStop(1, `rgba(92, 212, 242, ${poolAlpha.toFixed(3)})`);
    ctx.fillStyle = wg;
    ctx.fillRect(-96, -34, 196, 76);

    // Concentric animated water ripples around faucet stream impact point (48, -4)
    const rippleCount = faucetOn ? 4 : 2;
    for (let k = 0; k < rippleCount; k++) {
      const ph = (t * (faucetOn ? 1.4 : 0.5) + k / rippleCount) % 1;
      const rx = 10 + ph * 64;
      const ry = 5 + ph * 28;
      ctx.strokeStyle = `rgba(255, 255, 255, ${((1 - ph) * (faucetOn ? 0.8 : 0.35)).toFixed(3)})`;
      ctx.lineWidth = 2.2;
      ell(ctx, 42, 0, rx, ry);
      ctx.stroke();
    }
    ctx.restore();
    // Inner basin rim stroke
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    rr(ctx, -94, -32, 192, 72, 20);
    ctx.stroke();

    // 3. DISHES & VEGGIES IN THE WASH BASIN (OR UP ON THE LEFT DRYING RACK WHEN CLEAN >= 1)
    washItems.forEach((it, idx) => {
      const clean = clamp01(it.clean || 0);
      const dirt = clamp01(it.dirt !== undefined ? it.dirt : (1 - clean));
      const soap = clamp01(it.soap || 0);
      const isCleanRack = clean >= 0.98;
      const ix = isCleanRack ? (-144 + (idx % 2) * 24) : (Number.isFinite(it.x) ? it.x : (-54 + idx * 28));
      const iy = isCleanRack ? (-18 + Math.floor(idx / 2) * 22) : (Number.isFinite(it.y) ? it.y : (idx % 2 === 0 ? -4 : 14));
      const bob = isCleanRack ? 0 : Math.sin(t * 3.4 + idx * 1.3) * 2.5;

      ctx.save();
      ctx.translate(ix, iy + bob);
      if (it.id === 'plate_pink') {
        ctx.fillStyle = '#FF9EB5';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.6;
        circ(ctx, 0, 0, 22);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFD6E2';
        circ(ctx, 0, 0, 14);
        ctx.fill();
        ctx.stroke();
      } else if (it.id === 'cup_mint') {
        ctx.fillStyle = '#7ED6C1';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.6;
        rr(ctx, -14, -15, 28, 30, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFDF9';
        ell(ctx, 0, -13, 12, 4.5);
        ctx.fill();
        ctx.stroke();
      } else {
        drawIngredient(ctx, it.id || 'tomato', 0, 0, 20, { sliced: false, shadow: false });
      }

      // Muddy/cocoa smudge spots fade out as item is scrubbed clean
      if (dirt > 0.08 && !isCleanRack) {
        ctx.fillStyle = `rgba(110, 72, 48, ${(dirt * 0.65).toFixed(3)})`;
        blob(ctx, -5, 3, 8 * dirt, 6 * dirt, idx + 1, 0.25, 7);
        ctx.fill();
        blob(ctx, 6, -4, 6 * dirt, 5 * dirt, idx + 3, 0.25, 6);
        ctx.fill();
      }

      // Iridescent white/aqua soap suds cluster during scrubbing
      if (soap > 0.05 && !isCleanRack) {
        for (let sb = 0; sb < 5; sb++) {
          const sa = (sb / 5) * PI2 + t * 1.5;
          const srad = 10 + (sb % 2) * 5;
          const br = (4.5 + (sb % 3) * 2) * soap;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
          ctx.strokeStyle = '#7CE2F7';
          ctx.lineWidth = 1.4;
          circ(ctx, Math.cos(sa) * srad, Math.sin(sa) * srad * 0.7, br);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Clean star sparkle when freshly rinsed!
      if (clean > 0.85) {
        ctx.fillStyle = '#F7C948';
        sparkle4(ctx, 12, -12, 6 + Math.sin(t * 6 + idx) * 1.8, t * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 4. WHITE GOOSENECK CIRCULATING PUMP FAUCET & CONTINUOUS RUNNING WATER STREAM (Right deck: x = +86, y = -44)
    ctx.save();
    ctx.translate(86, -40);
    // Faucet base collar
    ctx.fillStyle = '#FF8FA8';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ell(ctx, 0, 4, 18, 8);
    ctx.fill();
    ctx.stroke();

    // Press-pump plunger button on top of faucet column
    const plungeY = pumpPress * 8 + (faucetOn ? Math.sin(t * 8) * 1.5 : 0);
    ctx.fillStyle = '#F7C948';
    rr(ctx, -10, -56 + plungeY, 20, 14, 6);
    ctx.fill();
    ctx.stroke();

    // White gooseneck spout arch curving left over the basin (spout tip at local x = -44, y = -18)
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -34);
    ctx.arc(-22, -34, 22, 0, PI, true);
    ctx.lineTo(-44, -20);
    ctx.stroke();

    ctx.strokeStyle = '#FFFDF9';
    ctx.lineWidth = 9.5;
    ctx.stroke();

    // Spout nozzle ring
    ctx.fillStyle = '#FF8FA8';
    ctx.lineWidth = 2.6;
    rr(ctx, -51, -22, 14, 7, 3.5);
    ctx.fill();
    ctx.stroke();

    // Animated Continuous Circulating Water Stream when faucetOn is true
    if (faucetOn) {
      const streamSway = Math.sin(t * 18) * 2.2;
      const sg = ctx.createLinearGradient(-44, -15, -44, 42);
      sg.addColorStop(0, 'rgba(220, 252, 255, 0.95)');
      sg.addColorStop(0.5, 'rgba(110, 224, 250, 0.88)');
      sg.addColorStop(1, 'rgba(220, 252, 255, 0.92)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(-48, -15);
      ctx.quadraticCurveTo(-48 - streamSway, 14, -52 + streamSway, 40);
      ctx.lineTo(-36 - streamSway, 40);
      ctx.quadraticCurveTo(-40 + streamSway, 14, -40, -15);
      ctx.closePath();
      ctx.fill();

      // Sparkling falling water droplets & splash crown at impact
      for (let d = 0; d < 5; d++) {
        const ph = (t * 2.6 + d * 0.2) % 1;
        const dx = -44 + Math.sin(d * 2.1 + t * 8) * (6 + ph * 12);
        const dy = -12 + ph * 52;
        ctx.fillStyle = '#FFFFFF';
        circ(ctx, dx, dy, 2.5 + (1 - ph) * 1.5);
        ctx.fill();
      }
    } else {
      // Intuitive downward arrow prompt above pump button when faucet is off
      const bob = Math.sin(t * 5) * 3;
      drawIcon(ctx, 'arrow_down', 0, -72 + bob, 10, t);
    }
    ctx.restore();

    // 5. INTERACTIVE YELLOW/GREEN CELLULOSE SCRUB SPONGE & SOAP BOTTLE
    drawSoapDispenser(ctx, -88, -64, 0.88, ps.soapPumpAnim || 0, t);
    const spX = Number.isFinite(ps.spongeX) ? ps.spongeX : 136;
    const spY = Number.isFinite(ps.spongeY) ? ps.spongeY : 16;
    drawSponge(ctx, spX, spY, 26, -0.18 + Math.sin(t * 6) * 0.08, 0.85, ps.scrubbing ? 0.3 : 0, t);

    ctx.restore();
  }

  /* ==========================================================================
   * 9. Emotional Reaction Stickers (Cozy Patisserie / Gouache Die-Cut Badges)
   *    kind: 'love' | 'fire' | 'ice' | 'sour' | 'burnt' | 'float' | 'rainbow' | 'sleepy'
   * ========================================================================== */
  function drawReactionSticker(ctx, kind, cx, cy, r, t) {
    t = t || 0;
    r = r || 18;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Die-cut white sticker backing with soft shadow
    softShadow(ctx, 1, 2, r * 1.15, r * 1.1, 0.22);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    circ(ctx, 0, 0, r);
    ctx.fill();
    ctx.stroke();

    // Inner rim
    ctx.strokeStyle = 'rgba(92, 61, 46, 0.12)';
    ctx.lineWidth = 1.2;
    circ(ctx, 0, 0, r * 0.88);
    ctx.stroke();

    const innerR = r * 0.72;
    switch (kind) {
      case 'fire': {
        // Blazing chili flame sticker
        ctx.fillStyle = '#FF5722';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, innerR);
        ctx.quadraticCurveTo(-innerR * 0.9, innerR * 0.3, -innerR * 0.6, -innerR * 0.3);
        ctx.quadraticCurveTo(-innerR * 0.8, -innerR * 0.7, 0, -innerR);
        ctx.quadraticCurveTo(innerR * 0.8, -innerR * 0.7, innerR * 0.6, -innerR * 0.3);
        ctx.quadraticCurveTo(innerR * 0.9, innerR * 0.3, 0, innerR);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Inner core
        ctx.fillStyle = '#FFD54F';
        ctx.beginPath();
        ctx.moveTo(0, innerR * 0.85);
        ctx.quadraticCurveTo(-innerR * 0.45, innerR * 0.2, -innerR * 0.3, -innerR * 0.2);
        ctx.quadraticCurveTo(-innerR * 0.3, -innerR * 0.5, 0, -innerR * 0.65);
        ctx.quadraticCurveTo(innerR * 0.3, -innerR * 0.5, innerR * 0.3, -innerR * 0.2);
        ctx.quadraticCurveTo(innerR * 0.45, innerR * 0.2, 0, innerR * 0.85);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'ice': {
        // Sparkling ice crystal / snowflake sticker
        ctx.fillStyle = '#E1F5FE';
        circ(ctx, 0, 0, innerR * 0.92);
        ctx.fill();
        ctx.strokeStyle = '#42A5F5';
        ctx.lineWidth = 2.0;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const x1 = Math.cos(a) * innerR * 0.85, y1 = Math.sin(a) * innerR * 0.85;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(x1, y1);
          ctx.stroke();
          // Branch
          const bx = Math.cos(a) * innerR * 0.5, by = Math.sin(a) * innerR * 0.5;
          const pAngle = a + Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(bx - Math.cos(pAngle) * innerR * 0.2, by - Math.sin(pAngle) * innerR * 0.2);
          ctx.lineTo(bx + Math.cos(pAngle) * innerR * 0.2, by + Math.sin(pAngle) * innerR * 0.2);
          ctx.stroke();
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.4;
        circ(ctx, 0, 0, innerR * 0.28);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'sour': {
        // Bright lemon wedge with electric zap sticker
        ctx.fillStyle = '#FFF59D';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, innerR * 0.85, 0.2, Math.PI - 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Lemon rind
        ctx.strokeStyle = '#FBC02D';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, innerR * 0.85, 0.2, Math.PI - 0.2);
        ctx.stroke();
        // Little spark zap
        ctx.strokeStyle = '#E65100';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-innerR * 0.3, -innerR * 0.6);
        ctx.lineTo(0, -innerR * 0.2);
        ctx.lineTo(-innerR * 0.1, -innerR * 0.15);
        ctx.lineTo(innerR * 0.35, innerR * 0.25);
        ctx.stroke();
        break;
      }
      case 'burnt': {
        // Soot cloud puff with dizzy star sticker
        ctx.fillStyle = '#795548';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.8;
        blob(ctx, 0, 0, innerR * 0.9, innerR * 0.75, 4, 0.25, 8);
        ctx.fill();
        ctx.stroke();
        // Dizzy spiral eye
        ctx.strokeStyle = '#FFD54F';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let k = 0; k <= 18; k++) {
          const a = k * 0.5;
          const rad = k * (innerR * 0.022);
          const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        break;
      }
      case 'float': {
        // Dreamy cloud with golden star sticker
        ctx.fillStyle = '#E8EAF6';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.8;
        [[-innerR * 0.35, innerR * 0.1, innerR * 0.45],
         [innerR * 0.35, innerR * 0.1, innerR * 0.45],
         [0, -innerR * 0.2, innerR * 0.55]].forEach(([bx, by, br]) => {
          circ(ctx, bx, by, br);
          ctx.fill();
          ctx.stroke();
        });
        ctx.fillStyle = '#E8EAF6';
        ctx.beginPath();
        ctx.arc(0, innerR * 0.05, innerR * 0.5, 0, Math.PI * 2);
        ctx.fill();
        // Sparkle star
        ctx.fillStyle = '#FFD54F';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.4;
        star(ctx, 0, -innerR * 0.15, innerR * 0.4, innerR * 0.18, 5, 0);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'rainbow': {
        // 6-layer arched rainbow sticker with mini cloud feet
        const cols = ['#FF5252', '#FFA726', '#FFEE58', '#66BB6A', '#42A5F5', '#AB47BC'];
        const rTop = innerR * 0.92;
        const thick = innerR * 0.12;
        for (let i = 0; i < cols.length; i++) {
          ctx.strokeStyle = cols[i];
          ctx.lineWidth = thick + 0.5;
          ctx.beginPath();
          ctx.arc(0, innerR * 0.35, rTop - i * thick, Math.PI, 0);
          ctx.stroke();
        }
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, innerR * 0.35, rTop + thick * 0.5, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, innerR * 0.35, rTop - (cols.length - 0.5) * thick, Math.PI, 0);
        ctx.stroke();
        // Cloud feet
        ctx.fillStyle = '#FFFFFF';
        circ(ctx, -innerR * 0.65, innerR * 0.35, innerR * 0.26);
        ctx.fill(); ctx.stroke();
        circ(ctx, innerR * 0.65, innerR * 0.35, innerR * 0.26);
        ctx.fill(); ctx.stroke();
        break;
      }
      case 'sleepy': {
        // Golden crescent moon with sleepy stars
        ctx.fillStyle = '#FFD54F';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, innerR * 0.85, -0.6 * Math.PI, 0.7 * Math.PI);
        ctx.quadraticCurveTo(innerR * 0.35, 0, 0, -innerR * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Night bubble
        ctx.fillStyle = 'rgba(179, 157, 219, 0.75)';
        circ(ctx, innerR * 0.45, -innerR * 0.2, innerR * 0.22);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'love':
      default: {
        // Sweet Ruby heart sticker with star highlight
        ctx.fillStyle = '#E85D75';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.8;
        heart(ctx, 0, 0, innerR * 0.95);
        ctx.fill();
        ctx.stroke();
        // Inner highlight
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        circ(ctx, -innerR * 0.3, -innerR * 0.35, innerR * 0.22);
        ctx.fill();
        ctx.fillStyle = '#FFF9C4';
        sparkle4(ctx, innerR * 0.25, innerR * 0.2, innerR * 0.35, 0);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }

  /* ==========================================================================
   * Slice 6 (30:00 - 36:00): Patisserie Bakery Oven & Cookie Stamper Station
   *   1. Left: Crystal Mixing Bowl & Balloon Whisk stirring creamy sponge/cookie batter
   *   2. Center: Wooden Pastry Board with Rolling Pin flattening dough & 3 Cookie Cutter
   *      Stampers ('star', 'heart', 'bear') + physical indented dough cutouts & 3D cookies
   *   3. Right: Illuminated Pastel Mint Patisserie Oven baking the stamped cookies & cake tin
   * ========================================================================== */
  function drawPatisserieStation(ctx, cx, cy, s, t) {
    s = s || {};
    const spring = s.boardSpring || { sx: 1, sy: 1 };
    const whiskProg = clamp01(s.patisserieWhisk !== undefined ? s.patisserieWhisk : (s.mixProgress || 0.35));
    const swirl = s.mixSwirlAngle !== undefined ? s.mixSwirlAngle : t * 1.8;
    const rollProg = clamp01(s.patisserieRoll !== undefined ? s.patisserieRoll : 0.65);
    const stamped = Array.isArray(s.cookieShapes) ? s.cookieShapes : ['star', 'heart', 'bear'];
    const activeStamp = s.activeStampShape || null;
    const stampAnim = clamp01(s.stampAnim || 0);
    const bakeProg = clamp01(s.patisserieBake !== undefined ? s.patisserieBake : (s.cookProgress || 0));
    const ovenOn = s.ovenDoorOpen ? false : true;
    const tint = safeColor(s.batterTint || s.mixColor, VANILLA_SPONGE);
    const layers = (s.layerColors && s.layerColors.length) ? s.layerColors : [tint];

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // ---- 1. Left Zone: Crystal Mixing Bowl & Balloon Whisk (cx - 188, cy + 16) ----
    const bowlX = cx - 188, bowlY = cy + 16;
    ctx.save();
    ctx.translate(bowlX, bowlY);
    softShadow(ctx, 0, 52, 68, 14, 0.2);
    // Translucent crystal bowl body
    ctx.fillStyle = 'rgba(225, 244, 252, 0.72)';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-66, -6);
    ctx.bezierCurveTo(-66, 38, -36, 56, 0, 56);
    ctx.bezierCurveTo(36, 56, 66, 38, 66, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Bowl rim
    ctx.fillStyle = 'rgba(242, 251, 255, 0.88)';
    ell(ctx, 0, -6, 66, 32);
    ctx.fill();
    ctx.stroke();
    // Creamy batter with swirl ribbons inside bowl
    ctx.fillStyle = tint;
    ell(ctx, 0, -4, 56, 25);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = lighten(tint, 0.45);
    ctx.lineWidth = 3;
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const u = k / 12;
        const rad = 4 + u * 44;
        const a = swirl + (arm * PI2) / 3 + u * (2.2 + whiskProg * 1.5);
        const px = Math.cos(a) * rad, py = -4 + Math.sin(a) * rad * 0.44;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Orbiting wire balloon whisk
    const wx = Math.cos(swirl) * 18, wy = -8 + Math.sin(swirl) * 8;
    drawWhisk(ctx, wx, wy - 10, 22, Math.cos(swirl) * 0.32);
    ctx.restore();

    // ---- 2. Center Zone: Pastry Board, Rolling Pin & 3 Cookie Cutter Stampers (cx - 18, cy + 16) ----
    const boardX = cx - 18, boardY = cy + 18;
    ctx.save();
    ctx.translate(boardX, boardY);
    ctx.scale(spring.sx || 1, spring.sy || 1);
    softShadow(ctx, 0, 48, 96, 18, 0.2);
    // Warm beechwood pastry board
    ctx.fillStyle = '#B9814E';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.4;
    ell(ctx, 0, 6, 96, 50);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#EABFA0';
    ell(ctx, 0, 0, 96, 50);
    ctx.fill();
    ctx.stroke();

    // Flattened pastry dough sheet with physical cross-section edge
    const sheetRx = 52 + rollProg * 24;
    const sheetRy = 26 + rollProg * 8;
    ctx.fillStyle = '#E2C578';
    ctx.lineWidth = 2.6;
    ell(ctx, -6, 6, sheetRx, sheetRy);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFF1C2';
    ell(ctx, -6, 1, sheetRx, sheetRy);
    ctx.fill();
    ctx.stroke();

    // Physical indented cutout wells + popped-out 3D cookies for ['star', 'heart', 'bear']
    const shapes = ['star', 'heart', 'bear'];
    const wellCoords = [[-36, 0], [-4, 4], [28, -1]];
    shapes.forEach((shp, idx) => {
      const isStamped = stamped.indexOf(shp) >= 0;
      const [wx, wy] = wellCoords[idx];
      if (isStamped) {
        drawCookieCutoutWell(ctx, wx, wy, 13.5, shp);
        // Popped-out 3D stamped cookie resting along the lower-right board edge
        const popX = -26 + idx * 32;
        const popY = 34 + (idx % 2) * 4;
        drawStampedCookie(ctx, popX, popY, 15, shp, bakeProg * 0.4, tint);
      }
    });

    // 3 Interactive Cookie Cutter Stampers perched above the pastry board
    shapes.forEach((shp, idx) => {
      const cutX = -52 + idx * 52;
      const cutY = -58;
      const isPressing = activeStamp === shp && stampAnim > 0;
      const py = isPressing ? lerp(cutY, wellCoords[idx][1] - 8, Math.sin(stampAnim * PI)) : cutY + Math.sin(t * 3 + idx) * 2;
      const px = isPressing ? lerp(cutX, wellCoords[idx][0], Math.sin(stampAnim * PI)) : cutX;
      drawCookieCutter(ctx, px, py, 15.5, shp, isPressing ? Math.sin(stampAnim * PI) : 0, false);
    });

    // Beechwood rolling pin resting or rolling across the dough sheet
    const pinRollOffset = Math.sin(rollProg * PI2) * 18;
    drawRollingPin(ctx, -6 + pinRollOffset, -24, 34, -0.15 + Math.cos(rollProg * PI2) * 0.08);
    ctx.restore();

    // ---- 3. Right Zone: Illuminated Patisserie Bakery Oven (cx + 166, cy - 4) ----
    drawMiniOvenWithTin(
      ctx,
      cx + 166,
      cy - 4,
      216,
      168,
      ovenOn,
       Math.max(0.25, bakeProg),
      tint,
      layers,
      s.ovenPulse || 0,
      spring,
      t
    );

    ctx.restore();
  }


  /* ==========================================================================
   * 10. Station 10 — Little Doctor Clinic & Plushie Wellness Care (Slice 10: 54:00 - 61:44)
   *     1. Mini Stethoscope Heartbeat Listen (flexible acoustic tubing, heart chestpiece, ECG wave)
   *     2. Ear Thermometer Beep (ergonomic probe tip, color-bar wellness display, zero-text)
   *     3. Band-Aid Sticker Dressing (physical cross-section: adhesive wings, sterile gauze pad, peel backing)
   *     4. Medicine Spoon Dropper (amber glass bottle, calibrated glass pipette, rising syrup meniscus & drop)
   *     5. Pet Grooming Brush (wooden oval pin brush with cushioned pad & steel pins + plushie fur smoothing)
   * ========================================================================== */

  function drawClinicCarryCase(ctx, cx, cy, w, h, openProgress, t) {
    openProgress = clamp01(openProgress === undefined ? 1 : openProgress);
    const hw = w / 2, hh = h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    softShadow(ctx, 0, hh + 6, hw * 0.96, 12, 0.18);

    // Top carry handle (coral pink molded grip)
    ctx.fillStyle = '#FF8FA3';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    rr(ctx, -38, -hh - 20, 76, 22, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FAF3EB';
    rr(ctx, -22, -hh - 12, 44, 10, 5);
    ctx.fill();
    ctx.stroke();

    // Open lid hinged behind the tray
    if (openProgress > 0.05) {
      const lidH = hh * 0.62 * openProgress;
      ctx.fillStyle = '#F7E8EE';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.8;
      rr(ctx, -hw + 8, -hh - lidH * 0.65, w - 16, lidH, 16);
      ctx.fill();
      ctx.stroke();
      // Medical cross emblem on open lid
      const embY = -hh - lidH * 0.32;
      ctx.fillStyle = '#FFFFFF';
      circ(ctx, 0, embY, 13 * openProgress);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FF6B8B';
      rr(ctx, -3.5, embY - 8 * openProgress, 7, 16 * openProgress, 2);
      ctx.fill();
      rr(ctx, -8 * openProgress, embY - 3.5, 16 * openProgress, 7, 2);
      ctx.fill();
    }

    // Main molded clinic tray case (#FFFDF9 cream shell with blush coral trim)
    const caseGrad = ctx.createLinearGradient(0, -hh, 0, hh);
    caseGrad.addColorStop(0, '#FFFDF9');
    caseGrad.addColorStop(1, '#F9E8EE');
    ctx.fillStyle = caseGrad;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.5;
    rr(ctx, -hw, -hh, w, h, 22);
    ctx.fill();
    ctx.stroke();

    // Soft pastel mint inner recessed tray liner
    ctx.fillStyle = '#EDF8F4';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    rr(ctx, -hw + 12, -hh + 12, w - 24, h - 24, 16);
    ctx.fill();
    ctx.stroke();

    // Gold snap latches on left and right
    [-hw + 26, hw - 42].forEach(lx => {
      ctx.fillStyle = '#F7C948';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      rr(ctx, lx, -hh - 4, 16, 10, 3);
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }

  function drawStethoscope(ctx, x, y, r, pulse, active, targetPt) {
    r = r || 28;
    pulse = pulse || 0;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // If active & listening on critter's chest, draw flexible acoustic tubing from binaural headset to chestpiece
    if (active && targetPt) {
      const hx = x - r * 1.1, hy = y - r * 1.3;
      // Silver binaural ear tubes
      ctx.strokeStyle = '#C9D4DC';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(hx - 14, hy - 18);
      ctx.quadraticCurveTo(hx - 16, hy, hx, hy + 8);
      ctx.moveTo(hx + 14, hy - 18);
      ctx.quadraticCurveTo(hx + 16, hy, hx, hy + 8);
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      // Eartips
      ctx.fillStyle = '#FFFDF9';
      circ(ctx, hx - 14, hy - 19, 4.5); ctx.fill(); ctx.stroke();
      circ(ctx, hx + 14, hy - 19, 4.5); ctx.fill(); ctx.stroke();

      // Flexible coral acoustic tube curving to the chestpiece at targetPt
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 8.5;
      ctx.beginPath();
      ctx.moveTo(hx, hy + 8);
      ctx.bezierCurveTo(hx, (hy + targetPt.y) * 0.5 + 24, targetPt.x - 24, targetPt.y + 28, targetPt.x, targetPt.y);
      ctx.stroke();
      ctx.strokeStyle = '#FF758F';
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    const cx = (active && targetPt) ? targetPt.x : x;
    const cy = (active && targetPt) ? targetPt.y : y;
    ctx.translate(cx, cy);
    const sc = 1 + pulse * 0.16;
    ctx.scale(sc, sc);

    if (!active || !targetPt) {
      // Coiled tubing + binaural earpieces when resting in tray or dragged
      ctx.strokeStyle = '#C9D4DC';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.85);
      ctx.quadraticCurveTo(-r * 0.5, -r * 0.3, 0, -r * 0.15);
      ctx.moveTo(r * 0.45, -r * 0.85);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.3, 0, -r * 0.15);
      ctx.stroke();

      ctx.strokeStyle = '#FF758F';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.15);
      ctx.bezierCurveTo(-r * 0.65, r * 0.2, r * 0.65, r * 0.35, 0, r * 0.55);
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Acoustic diaphragm chestpiece (silver ring + acoustic membrane + heart badge)
    const cpY = (!active || !targetPt) ? r * 0.55 : 0;
    const cpR = r * 0.52;
    softShadow(ctx, 0, cpY + 4, cpR * 1.05, cpR * 0.5, 0.22);
    ctx.fillStyle = '#DCE6EC';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    circ(ctx, 0, cpY, cpR);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFDF9';
    circ(ctx, 0, cpY, cpR * 0.76);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FF6B8B';
    heart(ctx, 0, cpY, cpR * 0.48);
    ctx.fill();

    // Pulsing acoustic soundwaves when listening to heartbeat
    if (pulse > 0.04) {
      for (let k = 1; k <= 2; k++) {
        const ringR = cpR * (1.15 + k * 0.38 + pulse * 0.35);
        ctx.strokeStyle = 'rgba(255, 107, 139, ' + (0.65 * (1 - k * 0.3) * pulse).toFixed(3) + ')';
        ctx.lineWidth = 2.4;
        circ(ctx, 0, cpY, ringR);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawEarThermometer(ctx, x, y, r, angle, scanProgress, ready, t) {
    r = r || 28;
    scanProgress = clamp01(scanProgress || 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    softShadow(ctx, 0, r * 0.7, r * 0.65, r * 0.25, 0.18);

    // Conical disposable lens filter & warm probe tip pointing up-left toward ear
    ctx.fillStyle = ready ? '#6BCB77' : (scanProgress > 0 ? '#FFD166' : '#DCE6EC');
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-r * 0.92, -r * 0.52);
    ctx.lineTo(-r * 0.35, -r * 0.62);
    ctx.lineTo(-r * 0.42, -r * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing gentle infrared wave rings at probe tip while scanning
    if (scanProgress > 0 && !ready) {
      const wave = (t * 3) % 1;
      ctx.strokeStyle = 'rgba(255, 183, 71, ' + (0.75 * (1 - wave)).toFixed(3) + ')';
      ctx.lineWidth = 2.2;
      circ(ctx, -r * 0.95, -r * 0.52, 5 + wave * 12);
      ctx.stroke();
    } else if (ready) {
      ctx.fillStyle = '#6BCB77';
      sparkle4(ctx, -r * 1.05, -r * 0.68, 7, t * 3);
      ctx.fill();
    }

    // Ergonomic curved white & mint thermometer body
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.8;
    rr(ctx, -r * 0.42, -r * 0.72, r * 0.88, r * 1.48, r * 0.4);
    ctx.fill();
    ctx.stroke();

    // Pastel mint grip accent
    ctx.fillStyle = '#7ED6DF';
    rr(ctx, -r * 0.28, r * 0.16, r * 0.6, r * 0.44, r * 0.2);
    ctx.fill();
    ctx.stroke();

    // Backlit graphical wellness bar window (100% zero-text: color bar + heart/check icon)
    ctx.fillStyle = ready ? '#D4F8E8' : (scanProgress > 0 ? '#FFF3CD' : '#EBF5FB');
    rr(ctx, -r * 0.28, -r * 0.48, r * 0.6, r * 0.48, r * 0.12);
    ctx.fill();
    ctx.stroke();

    // Fill gauge bar inside window
    const barW = r * 0.44 * (ready ? 1 : Math.max(0.25, scanProgress));
    ctx.fillStyle = ready ? '#58D68D' : '#F5B041';
    rr(ctx, -r * 0.2, -r * 0.22, barW, r * 0.12, r * 0.05);
    ctx.fill();

    // Tiny heart indicator above the bar
    ctx.fillStyle = ready ? '#2ECC71' : '#FF6B8B';
    heart(ctx, 0.02 * r, -r * 0.35, r * 0.12);
    ctx.fill();

    // Coral scan button
    ctx.fillStyle = '#FF8FA3';
    circ(ctx, 0.02 * r, r * 0.38, r * 0.14);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function drawBandAidSticker(ctx, x, y, r, angle, design, peelProgress) {
    r = r || 26;
    peelProgress = clamp01(peelProgress === undefined ? 1 : peelProgress);
    const bodyCol = (design && design.bodyColor) || '#FFB5C5';
    const padCol = (design && design.padColor) || '#FFF5F7';
    const accentCol = (design && design.accentColor) || '#FF5C8A';
    const pat = (design && design.pattern) || 'heart';

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const w = r * 1.9, h = r * 0.82;
    softShadow(ctx, 0, 3, w * 0.52, h * 0.45, 0.2);

    // Physical cross-section: peeling wax paper backing flaps while being applied
    if (peelProgress < 0.98) {
      const flapW = w * 0.38 * (1 - peelProgress);
      ctx.fillStyle = 'rgba(255, 253, 249, 0.88)';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      rr(ctx, -w * 0.5 - flapW * 0.6, -h * 0.46, flapW, h * 0.92, 6);
      ctx.fill();
      ctx.stroke();
      rr(ctx, w * 0.5 - flapW * 0.4, -h * 0.46, flapW, h * 0.92, 6);
      ctx.fill();
      ctx.stroke();
    }

    // Rounded adhesive strip body
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    rr(ctx, -w / 2, -h / 2, w, h, h * 0.48);
    ctx.fill();
    ctx.stroke();

    // Central raised sterile absorbent gauze cushion pad
    const pw = w * 0.38, ph = h * 0.74;
    ctx.fillStyle = padCol;
    ctx.lineWidth = 2;
    rr(ctx, -pw / 2, -ph / 2, pw, ph, 5);
    ctx.fill();
    ctx.stroke();

    // Breathable micro-perforation dots on left and right adhesive wings
    ctx.fillStyle = darken(bodyCol, 0.18);
    [-w * 0.33, -w * 0.25, w * 0.25, w * 0.33].forEach(px => {
      [-h * 0.2, 0, h * 0.2].forEach(py => {
        circ(ctx, px, py, 1.4);
        ctx.fill();
      });
    });

    // Cute pattern emblem on central sterile pad
    ctx.fillStyle = accentCol;
    if (pat === 'star') {
      star(ctx, 0, 0, r * 0.22, r * 0.1, 5, 0);
      ctx.fill();
    } else if (pat === 'cloud') {
      circ(ctx, -3, 1, r * 0.12); ctx.fill();
      circ(ctx, 3, 1, r * 0.12); ctx.fill();
      circ(ctx, 0, -2, r * 0.15); ctx.fill();
    } else if (pat === 'rainbow') {
      ['#FF6B8B', '#FFD166', '#7ED6DF'].forEach((c, idx) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, r * 0.1, r * (0.22 - idx * 0.05), PI, 0);
        ctx.stroke();
      });
    } else {
      heart(ctx, 0, 0, r * 0.22);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawMedicineDropper(ctx, x, y, r, angle, fillLevel, syrupColor, squeeze, dropY) {
    r = r || 30;
    fillLevel = clamp01(fillLevel === undefined ? 0.75 : fillLevel);
    syrupColor = safeColor(syrupColor, '#FF6B8B');
    squeeze = clamp01(squeeze || 0);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Glass pipette barrel (physical cross-section showing syrup inside + calibration ticks)
    const bw = r * 0.34, bh = r * 1.15;
    ctx.fillStyle = 'rgba(235, 248, 255, 0.78)';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-bw, -bh * 0.35);
    ctx.lineTo(-bw * 0.85, bh * 0.42);
    ctx.lineTo(-bw * 0.28, bh * 0.72);
    ctx.lineTo(bw * 0.28, bh * 0.72);
    ctx.lineTo(bw * 0.85, bh * 0.42);
    ctx.lineTo(bw, -bh * 0.35);
    ctx.closePath();
    ctx.fill();

    // Liquid syrup column inside the glass pipette with glossy meniscus
    if (fillLevel > 0.04) {
      ctx.save();
      ctx.clip();
      const liqTop = bh * 0.68 - fillLevel * bh * 0.92;
      ctx.fillStyle = syrupColor;
      ctx.fillRect(-bw * 1.2, liqTop, bw * 2.4, bh * 1.2);
      // Meniscus highlight
      ctx.fillStyle = lighten(syrupColor, 0.28);
      ell(ctx, 0, liqTop, bw * 0.82, 3.2);
      ctx.fill();
      ctx.restore();
    }

    // Re-stroke glass pipette outline + volume calibration ticks (pure graphic lines, zero text)
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-bw, -bh * 0.35);
    ctx.lineTo(-bw * 0.85, bh * 0.42);
    ctx.lineTo(-bw * 0.28, bh * 0.72);
    ctx.lineTo(bw * 0.28, bh * 0.72);
    ctx.lineTo(bw * 0.85, bh * 0.42);
    ctx.lineTo(bw, -bh * 0.35);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(92, 61, 46, 0.55)';
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 4; k++) {
      const ty = -bh * 0.15 + k * (bh * 0.16);
      ctx.beginPath();
      ctx.moveTo(bw * 0.2, ty);
      ctx.lineTo(bw * 0.72, ty);
      ctx.stroke();
    }

    // White plastic collar flange
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    rr(ctx, -bw * 1.35, -bh * 0.48, bw * 2.7, bh * 0.18, 4);
    ctx.fill();
    ctx.stroke();

    // Squeezable pastel coral rubber bulb at top (squashes inward when squeezed)
    const bulbSx = 1 - squeeze * 0.24;
    const bulbSy = 1 + squeeze * 0.12;
    ctx.save();
    ctx.translate(0, -bh * 0.48);
    ctx.scale(bulbSx, bulbSy);
    ctx.fillStyle = '#FF8FA3';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-bw * 0.95, 0);
    ctx.bezierCurveTo(-bw * 1.25, -bh * 0.55, bw * 1.25, -bh * 0.55, bw * 0.95, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ell(ctx, -bw * 0.32, -bh * 0.24, bw * 0.2, bh * 0.1, -0.2);
    ctx.fill();
    ctx.restore();

    // Falling glossy syrup droplet below nozzle tip when dispensing
    if (typeof dropY === 'number' && dropY > 0) {
      const dy = bh * 0.76 + dropY;
      ctx.fillStyle = syrupColor;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, dy - 8);
      ctx.bezierCurveTo(-7, dy, -5, dy + 8, 0, dy + 8);
      ctx.bezierCurveTo(5, dy + 8, 7, dy, 0, dy - 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      circ(ctx, -2, dy + 2, 1.8);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawGroomingBrush(ctx, x, y, r, angle, strokeWave) {
    r = r || 28;
    strokeWave = strokeWave || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((angle || 0) + Math.sin(strokeWave * PI2) * 0.08);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    softShadow(ctx, 0, r * 0.72, r * 0.7, r * 0.24, 0.2);

    // Ergonomic warm beechwood handle
    ctx.fillStyle = '#E8A87C';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.8;
    rr(ctx, -r * 0.24, r * 0.22, r * 0.48, r * 0.92, r * 0.22);
    ctx.fill();
    ctx.stroke();
    // Hanging hole in handle
    ctx.fillStyle = '#FAF3EB';
    circ(ctx, 0, r * 0.9, r * 0.09);
    ctx.fill();
    ctx.stroke();

    // Oval wooden brush head
    ctx.fillStyle = '#F3C69F';
    ell(ctx, 0, -r * 0.16, r * 0.78, r * 0.56);
    ctx.fill();
    ctx.stroke();

    // Mint cushioned air-pad bed
    ctx.fillStyle = '#A8E6CF';
    ell(ctx, 0, -r * 0.16, r * 0.62, r * 0.42);
    ctx.fill();
    ctx.stroke();

    // Rounded massage pins with pastel ball tips
    const pinRows = [
      [-0.36, -0.32], [0, -0.34], [0.36, -0.32],
      [-0.42, -0.14], [-0.14, -0.14], [0.14, -0.14], [0.42, -0.14],
      [-0.32, 0.04], [0, 0.06], [0.32, 0.04],
    ];
    pinRows.forEach(([px, py], i) => {
      const bx = px * r, by = py * r;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, by - r * 0.14);
      ctx.stroke();
      ctx.fillStyle = i % 2 === 0 ? '#FF8FA3' : '#FFFDF9';
      circ(ctx, bx, by - r * 0.16, r * 0.065);
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }

  function drawDoctorStation(ctx, cx, cy, s, t) {
    s = s || {};
    t = t || 0;
    const activeTool = s.activeTool || 'stethoscope';
    const hp = s.hoverPt || null;
    const dragging = !!s.dragging;
    const critterCx = s.critterCx !== undefined ? s.critterCx : cx;
    const critterCy = s.critterCy !== undefined ? s.critterCy : (cy - 148);
    const chestPt = { x: critterCx, y: critterCy + 34 };
    const earPt = { x: critterCx - 54, y: critterCy - 66 };
    const mouthPt = s.mouthPt || { x: critterCx, y: critterCy - 4 };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Plushie Wellness Overlays on the Critter Patient (drawn right over the critter torso/head)
    // 1A. Ruffled vs Smoothed Fur Tufts on plushie cheeks/shoulders/crown
    const tufts = s.furTufts || [];
    tufts.forEach((tuft, idx) => {
      const tx = critterCx + (tuft.dx || 0);
      const ty = critterCy + (tuft.dy || 0);
      const prog = clamp01(tuft.progress || 0);
      ctx.save();
      ctx.translate(tx, ty);
      if (prog < 0.95) {
        // Ruffled standing fur tuft waves
        const ruff = (1 - prog) * (1 + Math.sin(t * 4 + idx) * 0.12);
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.4;
        ctx.fillStyle = '#FFE5D9';
        ctx.beginPath();
        ctx.moveTo(-12, 4);
        ctx.quadraticCurveTo(-8, -14 * ruff, -2, -4 * ruff);
        ctx.quadraticCurveTo(3, -16 * ruff, 7, -3 * ruff);
        ctx.quadraticCurveTo(12, -11 * ruff, 13, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Smooth glossy groomed fur sheen + golden sparkle
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, 2, 11, PI * 1.15, PI * 1.85);
        ctx.stroke();
        ctx.fillStyle = '#F7C948';
        sparkle4(ctx, 10, -6, 4.5 + Math.sin(t * 5 + idx) * 1.5, t * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 1B. Boo-boo spots & applied pastel Band-Aid stickers on the plushie patient
    const booboos = s.booboos || [];
    booboos.forEach((b, idx) => {
      const bx = critterCx + (b.dx || 0);
      const by = critterCy + (b.dy || 0);
      if (b.healed) {
        const des = (KitchenData.BANDAID_DESIGNS || []).find(d => d.id === b.designId) ||
          (KitchenData.BANDAID_DESIGNS && KitchenData.BANDAID_DESIGNS[idx % KitchenData.BANDAID_DESIGNS.length]) || null;
        const peel = b.animT !== undefined ? clamp01(b.animT) : 1;
        drawBandAidSticker(ctx, bx, by, 21, b.angle || -0.2, des, peel);
      } else {
        // Gentle pulsing rosy boo-boo swirl waiting for a band-aid sticker
        const pulse = 0.85 + Math.sin(t * 5 + idx * 1.7) * 0.15;
        ctx.save();
        ctx.translate(bx, by);
        ctx.fillStyle = 'rgba(255, 107, 139, 0.35)';
        circ(ctx, 0, 0, 14 * pulse);
        ctx.fill();
        ctx.strokeStyle = '#E85D75';
        ctx.lineWidth = 2.2;
        circ(ctx, 0, 0, 9.5);
        ctx.stroke();
        // Little cross target
        ctx.beginPath();
        ctx.moveTo(-4, -4); ctx.lineTo(4, 4);
        ctx.moveTo(4, -4); ctx.lineTo(-4, 4);
        ctx.stroke();
        if (activeTool === 'bandaid') {
          ctx.strokeStyle = 'rgba(255, 107, 139, 0.75)';
          ctx.setLineDash([4, 4]);
          circ(ctx, 0, 0, 17 + Math.sin(t * 6) * 2.5);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
    });

    // 1C. Interactive Target Prompts for Stethoscope (Chest) & Thermometer (Ear) & Medicine (Mouth)
    if (activeTool === 'stethoscope') {
      const hbPulse = s.heartbeatPulse || 0;
      ctx.save();
      ctx.translate(chestPt.x, chestPt.y);
      const pR = 20 + Math.sin(t * 5) * 3 + hbPulse * 8;
      ctx.strokeStyle = 'rgba(255, 107, 139, 0.78)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      circ(ctx, 0, 0, pR);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255, 107, 139, ' + (0.28 + hbPulse * 0.45).toFixed(3) + ')';
      heart(ctx, 0, 0, 12 + hbPulse * 5);
      ctx.fill();
      ctx.restore();
    } else if (activeTool === 'thermometer') {
      ctx.save();
      ctx.translate(earPt.x, earPt.y);
      const pR = 17 + Math.sin(t * 5) * 2.5;
      ctx.strokeStyle = s.tempChecked ? 'rgba(88, 214, 141, 0.85)' : 'rgba(126, 214, 223, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      circ(ctx, 0, 0, pR);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 2. Heartbeat ECG & Wellness Monitor Card (Left of Counter, 100% Zero-Text Graphical Display)
    const monX = cx - 188, monY = cy - 64;
    ctx.save();
    ctx.translate(monX, monY);
    softShadow(ctx, 0, 34, 54, 10, 0.16);
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    rr(ctx, -56, -36, 112, 72, 16);
    ctx.fill();
    ctx.stroke();
    // Dark mint screen
    ctx.fillStyle = '#1E3A34';
    rr(ctx, -46, -26, 92, 42, 10);
    ctx.fill();
    ctx.stroke();
    // Animated ECG QRS waveform inside screen
    ctx.strokeStyle = (s.heartbeatChecks > 0 || s.listeningHeartbeat) ? '#58D68D' : '#48C9B0';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    const speed = (s.heartbeatChecks > 0 || s.listeningHeartbeat) ? 3.8 : 1.4;
    const phase = (t * speed) % 1;
    for (let i = 0; i <= 36; i++) {
      const u = i / 36;
      const wx = -40 + u * 80;
      const d = ((u - phase + 1) % 1);
      let wy = -5;
      if (d < 0.08) wy -= Math.sin((d / 0.08) * PI) * 5;
      else if (d < 0.12) wy += 5;
      else if (d < 0.18) wy -= Math.sin(((d - 0.12) / 0.06) * PI) * 16;
      else if (d < 0.22) wy += 7;
      else if (d < 0.32) wy -= Math.sin(((d - 0.22) / 0.10) * PI) * 6;
      if (i === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
    // Status heart + 5 wellness progress dots along bottom of monitor
    ctx.fillStyle = '#FF6B8B';
    heart(ctx, -34, 25, 6 + (s.heartbeatPulse || 0) * 2.5);
    ctx.fill();
    const checks = [
      (s.heartbeatChecks || 0) > 0,
      !!s.tempChecked,
      booboos.length > 0 && booboos.every(b => b.healed),
      (s.dosesGiven || 0) > 0,
      tufts.length > 0 && tufts.every(tf => (tf.progress || 0) >= 0.95),
    ];
    checks.forEach((done, idx) => {
      ctx.fillStyle = done ? '#58D68D' : '#E6D7C3';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      circ(ctx, -14 + idx * 14, 25, 4.5);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();

    // 3. Amber Syrup Medicine Bottle & Band-Aid Swatch Picker (Right of Counter)
    const medFlavors = KitchenData.MEDICINE_FLAVORS || [
      { id: 'berry_syrup', color: '#FF6B8B', bottleColor: '#FF8FA3' },
      { id: 'honey_lemon', color: '#FFD166', bottleColor: '#FFE08A' },
      { id: 'mint_calm', color: '#7ED6DF', bottleColor: '#A8E6CF' },
    ];
    const curFlavor = medFlavors[(s.flavorIdx || 0) % medFlavors.length] || medFlavors[0];
    const botX = cx + 188, botY = cy - 52;
    ctx.save();
    ctx.translate(botX, botY);
    softShadow(ctx, 0, 36, 36, 9, 0.18);
    // Amber apothecary bottle body
    ctx.fillStyle = '#D9822B';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.8;
    rr(ctx, -26, -14, 52, 48, 12);
    ctx.fill();
    ctx.stroke();
    // Syrup level visible through bottle window
    ctx.fillStyle = curFlavor.color;
    rr(ctx, -20, 0, 40, 28, 7);
    ctx.fill();
    // White label with heart cross (zero text)
    ctx.fillStyle = '#FFFDF9';
    rr(ctx, -18, -6, 36, 22, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = curFlavor.color;
    heart(ctx, 0, 5, 8);
    ctx.fill();
    // Bottle neck
    ctx.fillStyle = '#FFFDF9';
    rr(ctx, -12, -26, 24, 14, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 4. Open Pastel Doctor Carry Case on the Counter with 5 Custom Tool Slots
    const caseY = cy + 44;
    drawClinicCarryCase(ctx, cx, caseY, 396, 118, 1, t);

    const tools = KitchenData.CLINIC_TOOLS || [
      { id: 'stethoscope', icon: 'stethoscope', color: '#FF758F' },
      { id: 'thermometer', icon: 'thermometer', color: '#7ED6DF' },
      { id: 'bandaid', icon: 'bandaid', color: '#FFB347' },
      { id: 'medicine', icon: 'medicine', color: '#C39BD3' },
      { id: 'brush', icon: 'brush', color: '#F7C948' },
    ];
    const slotSpacing = 72;
    const startX = cx - ((tools.length - 1) * slotSpacing) / 2;

    tools.forEach((tl, idx) => {
      const sx = startX + idx * slotSpacing;
      const sy = caseY + 2;
      const isSelected = activeTool === tl.id;
      ctx.save();
      ctx.translate(sx, sy);
      // Molded tool slot recess
      ctx.fillStyle = isSelected ? '#FFF3CD' : '#FFFDF9';
      ctx.strokeStyle = isSelected ? '#FF6B8B' : OUTLINE;
      ctx.lineWidth = isSelected ? 3 : 2.2;
      rr(ctx, -30, -36, 60, 72, 16);
      ctx.fill();
      ctx.stroke();

      // Draw resting tool inside slot (unless currently held/active on patient)
      const wobble = isSelected ? Math.sin(t * 4) * 2.5 : 0;
      ctx.translate(0, wobble);
      if (tl.id === 'stethoscope') {
        drawStethoscope(ctx, 0, -2, 20, isSelected ? (s.heartbeatPulse || 0) : 0, false, null);
      } else if (tl.id === 'thermometer') {
        drawEarThermometer(ctx, 0, 0, 20, -0.25, 0, !!s.tempChecked, t);
      } else if (tl.id === 'bandaid') {
        const des = (KitchenData.BANDAID_DESIGNS || [])[(s.bandaidIdx || 0) % 4];
        drawBandAidSticker(ctx, 0, 0, 17, -0.35, des, 1);
      } else if (tl.id === 'medicine') {
        drawMedicineDropper(ctx, 0, 2, 20, 0.2, s.dropperFill !== undefined ? s.dropperFill : 0.8, curFlavor.color, 0, 0);
      } else if (tl.id === 'brush') {
        drawGroomingBrush(ctx, 0, -2, 20, 0.25, 0);
      }

      // Checkmark star badge in corner of slot when procedure completed
      const completed = (tl.id === 'stethoscope' && (s.heartbeatChecks || 0) > 0) ||
                        (tl.id === 'thermometer' && !!s.tempChecked) ||
                        (tl.id === 'bandaid' && booboos.length > 0 && booboos.every(b => b.healed)) ||
                        (tl.id === 'medicine' && (s.dosesGiven || 0) > 0) ||
                        (tl.id === 'brush' && tufts.length > 0 && tufts.every(tf => (tf.progress || 0) >= 0.95));
      if (completed) {
        ctx.fillStyle = '#58D68D';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.8;
        circ(ctx, 20, -26, 8);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(16.5, -26);
        ctx.lineTo(19, -23.5);
        ctx.lineTo(23.5, -28.5);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 5. Active Tool in Action (Following Pointer or Animating on Patient)
    const tx = hp ? hp.x : (cx + 120);
    const ty = hp ? hp.y : (cy - 110 + Math.sin(t * 3) * 4);
    if (activeTool === 'stethoscope' && (dragging || s.listeningHeartbeat)) {
      const target = s.listeningHeartbeat ? chestPt : { x: tx, y: ty };
      drawStethoscope(ctx, cx - 70, cy - 30, 28, s.heartbeatPulse || 0.2, true, target);
    } else if (activeTool === 'thermometer' && (dragging || s.scanningTemp > 0)) {
      const pPos = s.scanningTemp > 0 && !dragging ? { x: earPt.x + 22, y: earPt.y + 14 } : { x: tx, y: ty };
      drawEarThermometer(ctx, pPos.x, pPos.y, 28, -0.35, s.scanningTemp || 0, !!s.tempChecked, t);
    } else if (activeTool === 'bandaid' && dragging) {
      const des = (KitchenData.BANDAID_DESIGNS || [])[(s.bandaidIdx || 0) % 4];
      drawBandAidSticker(ctx, tx, ty, 24, -0.2, des, 0.45);
    } else if (activeTool === 'medicine' && (dragging || (s.medicineAnim && s.medicineAnim.active))) {
      const ma = s.medicineAnim && s.medicineAnim.active ? s.medicineAnim : null;
      const mx = ma ? mouthPt.x + 18 : tx;
      const my = ma ? mouthPt.y - 36 : ty;
      const sq = ma ? bump(ma.t) : (s.dropperSqueeze || 0);
      const dropOffset = ma && ma.t > 0.25 ? (ma.t - 0.25) * 44 : 0;
      drawMedicineDropper(ctx, mx, my, 28, -0.25, s.dropperFill !== undefined ? s.dropperFill : 0.85, curFlavor.color, sq, dropOffset);
    } else if (activeTool === 'brush' && (dragging || (s.brushAnim && s.brushAnim > 0))) {
      drawGroomingBrush(ctx, tx, ty, 28, -0.35, t * 3);
    }

    ctx.restore();
  }

  return {
    drawClinicCarryCase, drawStethoscope, drawEarThermometer, drawBandAidSticker, drawMedicineDropper, drawGroomingBrush, drawDoctorStation,
    loadPortraits,
    portraits,
    OUTLINE,
    CREAM,
    // primitives & helpers
    rr, circ, ell, star, sparkle4, heart, blob, softShadow, lerpColor, lighten, darken, rgba,
    clamp01, lerp, smooth, easeOutBack, easeOutCubic, easeOutElastic, easeInOutSine, bump, seg, hash, qbez,
    // scene
    drawIcon,
    drawReactionSticker,
    drawKitchenBackdrop,
    drawIngredient,
    drawDish,
    getDishPortionPoint,
    drawCritterCustomer,
    getCritterMouth,
    getCounterY,
    // utensils
    drawKnife, drawSpoon, drawWhisk, drawPipingBag, drawSpatula, drawShaker, drawSauceBottle, drawRollingPin, drawTweezers, drawGlazeJug,
    drawStampedCookie, drawCookieCutter, drawCookieCutoutWell,
    // particles
    drawParticle,
    // stations
    drawChopStation, drawMixStation, drawCookStation, drawDecorateStation, drawFeedStation,
    drawToasterAppliance, drawMicrowaveAppliance, drawApplianceStation,
    drawBentoStation, drawBambooMatRoll, drawMultiLayerBurger, drawWhistlingKettle,
    drawPlaysetStation, drawSinkStation,
    drawPatisserieStation,
    drawSponge, drawSoapDispenser, drawWasteItem, drawDishwashStation,
    drawIceCreamParlor, drawAquariumStation, drawDollCareStation,
    drawStoveTempDial, drawDualBurnerStoveDeck, drawBoilingSoupPot, drawSilverWok,
    // HT Mini Cakes additions
    drawSpecularCandyBall, drawButtercreamRosette, drawWhiteCakeTurntable, drawYellowSunflowerPot, drawRainbowArchFigurine,
    drawCandyJar, drawMusicalCakeKnife,
    // Ingredient-driven cake palette & geometry (shared with game.js for hit-testing / audits)
    deriveLayerColors, deriveBatterTint, deriveFrostingColor, isCakeDish, cakeGeom, cakeSurfacePoint, cakeSurfaceXY, paletteForIds,
  };
})();

if (typeof window !== 'undefined') {
  window.KitchenArt = KitchenArt;
}
