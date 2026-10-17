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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clamp01 = v => clamp(v || 0, 0, 1);
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
        ctx.fillStyle = '#F4D5B8';
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
        ctx.fillStyle = '#E8998D';
        [-r * 0.36, 0, r * 0.36].forEach(dx => {
          circ(ctx, dx, -r * 0.48, r * 0.09);
          ctx.fill();
        });
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
   * 2. Cozy Sunlit Pinterest Patisserie Scene Backdrop
   * ========================================================================== */
  function drawKitchenBackdrop(ctx, W, H, t) {
    const wallH = H * 0.47;

    const wallGrad = ctx.createLinearGradient(0, 0, 0, wallH);
    wallGrad.addColorStop(0, '#FDF8F2');
    wallGrad.addColorStop(1, '#F7EDE2');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, W, wallH);

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
    counterGrad.addColorStop(0.1, '#FAF1E4');
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

      case 'choco': {
        ctx.fillStyle = baseCol;
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

      default: {
        if (id === 'milk') {
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
      const col = opts.color || '#F4A6B8';
      ctx.save();
      ctx.scale(scoop, scoop);
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
      case 'star':
        star(ctx, 0, 0, r * 1.4, r * 0.6, 5, 0);
        ctx.fill();
        break;
      case 'sparkle':
        sparkle4(ctx, 0, 0, r * 1.5, 0);
        ctx.fill();
        break;
      case 'heart':
        heart(ctx, 0, 0, r * 1.3);
        ctx.fill();
        break;
      case 'confetti':
        rr(ctx, -r * 1.1, -r * 0.5, r * 2.2, r, r * 0.3);
        ctx.fill();
        break;
      case 'crumb':
        blob(ctx, 0, 0, r * 0.9, r * 0.7, (p.seed || 0) + 1, 0.3, 8);
        ctx.fill();
        break;
      case 'droplet':
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.5);
        ctx.quadraticCurveTo(r * 1.1, 0, 0, r * 0.9);
        ctx.quadraticCurveTo(-r * 1.1, 0, 0, -r * 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        circ(ctx, -r * 0.3, -r * 0.1, r * 0.25);
        ctx.fill();
        break;
      case 'steam':
      case 'smoke': {
        const grow = p.maxLife ? 1.6 - (p.life || 0) / p.maxLife * 0.6 : 1;
        blob(ctx, 0, 0, r * grow, r * grow * 0.85, (p.seed || 0) + 2, 0.14, 12);
        ctx.fill();
        break;
      }
      case 'ring':
        ctx.strokeStyle = p.color || 'rgba(255,255,255,0.8)';
        ctx.lineWidth = p.lineWidth || Math.max(1.5, r * 0.25);
        circ(ctx, 0, 0, r);
        ctx.stroke();
        break;
      default:
        circ(ctx, 0, 0, r);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  /* ==========================================================================
   * 6. Plated Patisserie Dish / Boba Parfait — 3 luscious portions, no holes
   *    opts: { scoopProgress 0..1, toppingSprings[], pipingPop }
   * ========================================================================== */
  const PORTION_ORDER = [1, 0, 2]; // bottom (nearest), right, left
  const PORTION_A0 = -PI / 2;      // sector 0 starts at the top

  function portionPath(ctx, idx, R) {
    const a1 = PORTION_A0 + idx * (PI2 / 3);
    sector(ctx, 0, -2, R, R * 0.66, a1, a1 + PI2 / 3);
  }

  /** Dish-local (unscaled) point where bite #i (0..2) is scooped from. */
  function getDishPortionPoint(i, dish) {
    if (dish && dish.vessel === 'cup') return { x: 0, y: -50 };
    const idx = PORTION_ORDER[clamp(Math.floor(i || 0), 0, 2)];
    const a = PORTION_A0 + (idx + 0.5) * (PI2 / 3);
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
      ctx.fillStyle = '#FFFDF9';
      ctx.lineWidth = 2;
      rr(ctx, -6, -28, 12, 32, 3);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#F4B8C4';
      ctx.lineWidth = 2.5;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(-5, -22 + k * 9);
        ctx.lineTo(5, -26 + k * 9);
        ctx.stroke();
      }
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(0, -33);
      ctx.stroke();
      if (!tp.blownOut) {
        const flick = Math.sin(t * 14 + (tp.seed || 0)) * 2.5;
        const lean = Math.sin(t * 9 + (tp.seed || 0)) * 1.5;
        ctx.fillStyle = 'rgba(255, 200, 90, 0.22)';
        circ(ctx, 0, -38, 14 + flick);
        ctx.fill();
        ctx.fillStyle = '#F5A623';
        ctx.beginPath();
        ctx.moveTo(lean, -48 + flick);
        ctx.quadraticCurveTo(9, -36, 0, -30);
        ctx.quadraticCurveTo(-9, -36, lean, -48 + flick);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFF29C';
        ctx.beginPath();
        ctx.moveTo(lean * 0.5, -42 + flick * 0.5);
        ctx.quadraticCurveTo(4, -35, 0, -31);
        ctx.quadraticCurveTo(-4, -35, lean * 0.5, -42 + flick * 0.5);
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(150,140,135,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -34);
        ctx.quadraticCurveTo(6, -44, 0, -52);
        ctx.quadraticCurveTo(-6, -60, 2, -68);
        ctx.stroke();
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

  function drawDishBase(ctx, dish, t) {
    const hasBurger = dish.items.some(it => it.id === 'bun');
    const hasPizza = dish.items.some(it => it.id === 'pizzabase');
    const hasPancake = dish.items.some(it => it.id === 'dough') && !dish.bakedCake;
    const cooked = Math.max(0, ...dish.items.map(it => it.cooked || 0));

    if (dish.bakedCake) {
      const cakeCol = dish.liquidColor || '#F2B46D';
      const topCol = lerpColor(cakeCol, '#FFF7E4', 0.4);
      // Bottom tier
      ctx.fillStyle = lerpColor(cakeCol, '#B8732A', 0.22);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      rr(ctx, -90, -18, 180, 60, 24);
      ctx.fill();
      ctx.stroke();
      // Cream layer line
      ctx.fillStyle = '#FFF9EE';
      rr(ctx, -90, 4, 180, 10, 5);
      ctx.fill();
      ctx.fillStyle = topCol;
      ell(ctx, 0, -18, 90, 30);
      ctx.fill();
      ctx.stroke();
      // Frosting drips on bottom tier
      ctx.fillStyle = topCol;
      for (let k = 0; k < 7; k++) {
        const dx = -72 + k * 24;
        const len = 10 + hash(k + 3) * 14;
        rr(ctx, dx - 6, -10, 12, len, 6);
        ctx.fill();
      }
      // Top tier
      ctx.fillStyle = cakeCol;
      rr(ctx, -66, -56, 132, 48, 20);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFF9EE';
      ell(ctx, 0, -56, 66, 23);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFF9EE';
      for (let k = 0; k < 6; k++) {
        const dx = -55 + k * 22;
        rr(ctx, dx - 5, -50, 10, 8 + hash(k) * 12, 5);
        ctx.fill();
      }
      // Scalloped piped border
      ctx.fillStyle = '#FFFDF9';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * PI2;
        circ(ctx, Math.cos(a) * 64, -56 + Math.sin(a) * 21, 5);
        ctx.fill();
        ctx.stroke();
      }
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
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      ctx.fillStyle = '#DE923B';
      ell(ctx, 0, 30, 84, 26);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#78C47C';
      for (let k = 0; k < 11; k++) {
        const a = (k * PI2) / 11;
        circ(ctx, Math.cos(a) * 76, 16 + Math.sin(a) * 18, 13);
        ctx.fill();
      }
      ctx.fillStyle = '#E35242';
      ell(ctx, 0, 10, 78, 20);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#7A3B22';
      ell(ctx, 0, -2, 82, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFC424';
      ctx.beginPath();
      ctx.moveTo(-78, -8);
      ctx.lineTo(78, -8);
      ctx.lineTo(70, 6);
      ctx.lineTo(40, 2);
      ctx.lineTo(20, 14);
      ctx.lineTo(-10, 4);
      ctx.lineTo(-44, 12);
      ctx.lineTo(-70, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#E8A352';
      ctx.beginPath();
      ctx.ellipse(0, -16, 86, 34, 0, PI, 0);
      ctx.quadraticCurveTo(86, -4, 0, -4);
      ctx.quadraticCurveTo(-86, -4, -86, -16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFF5CC';
      [[-40, -30], [-14, -40], [16, -38], [44, -28], [-28, -18], [6, -22], [34, -16]].forEach(([sx, sy]) => {
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
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = rgba(stroke.color, 0.35) || stroke.color;
      ctx.lineWidth = 14;
      ctx.beginPath();
      stroke.pts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y + 3);
        else ctx.lineTo(p.x, p.y + 3);
      });
      ctx.stroke();
      ctx.strokeStyle = stroke.color;
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

    (dish.piping || []).forEach(p => drawPipingDot(ctx, p, t));

    const springs = (opts && opts.toppingSprings) || dish.toppingSprings || null;
    (dish.toppings || []).forEach((tp, i) => drawTopping(ctx, tp, t, springs ? springs[i] : null));
  }

  function drawCrumbs(ctx, idx, seed) {
    const a1 = PORTION_A0 + idx * (PI2 / 3);
    ctx.fillStyle = 'rgba(214, 150, 80, 0.75)';
    for (let k = 0; k < 6; k++) {
      const a = a1 + 0.3 + hash(k + seed) * (PI2 / 3 - 0.6);
      const rad = 22 + hash(k + seed + 9) * 50;
      blob(ctx, Math.cos(a) * rad, -2 + Math.sin(a) * rad * 0.66, 2.6, 2, k + seed, 0.3, 7);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(232, 150, 130, 0.22)';
    ell(ctx, Math.cos(a1 + PI / 3) * 36, -2 + Math.sin(a1 + PI / 3) * 24, 22, 10, a1 + PI / 3);
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

    // ---------- Plate with 3 portions ----------
    drawPlate(ctx);

    const removed = PORTION_ORDER.slice(0, bites);
    const remaining = [0, 1, 2].filter(i => removed.indexOf(i) < 0);
    const scooping = scoopP > 0 && bites < 3 ? PORTION_ORDER[bites] : -1;
    const hasContent = dish.items.length > 0 || dish.bakedCake || (dish.piping && dish.piping.length) || (dish.toppings && dish.toppings.length);

    // Crumbs where portions were scooped (and under the one being lifted)
    removed.forEach((idx, i) => drawCrumbs(ctx, idx, i * 3));
    if (scooping >= 0 && scoopP > 0.35) {
      ctx.save();
      ctx.globalAlpha *= seg(scoopP, 0.35, 0.8);
      drawCrumbs(ctx, scooping, bites * 3);
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
          if (idx !== scooping) portionPath(ctx, idx, 150);
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
          portionPath(ctx, scooping, 150);
          ctx.clip();
          drawDishContent(ctx, dish, t, opts);
          ctx.restore();
        }

        // Cut faces (cream inner edge) on remaining portion boundaries
        ctx.save();
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
    let bobY = Math.sin(tt * 2.2) * 2.2;
    let shakeX = 0;
    let sqX = 1 + Math.sin(tt * 2.2) * 0.012;
    let sqY = 1 - Math.sin(tt * 2.2) * 0.012;
    const jumpy = Math.max(celebrate, (rxn === 'love' || rxn === 'rainbow') ? rI : 0);
    if (jumpy > 0) {
      const jump = Math.abs(Math.sin(tt * 6.5));
      const land = Math.pow(1 - jump, 10);
      bobY = lerp(bobY, -jump * (16 + celebrate * 10), jumpy);
      sqX = lerp(sqX, 1 - jump * 0.06 + land * 0.12, jumpy);
      sqY = lerp(sqY, 1 + jump * 0.08 - land * 0.1, jumpy);
    }
    if (rxn === 'float') bobY = lerp(bobY, -30 + Math.sin(tt * 2.5) * 6, rI);
    else if (rxn === 'ice') shakeX += Math.sin(tt * 44) * 3 * rI;
    else if (rxn === 'fire') { shakeX += Math.sin(tt * 30) * 2 * rI; bobY -= Math.abs(Math.sin(tt * 12)) * 6 * rI; }
    else if (rxn === 'sour') shakeX += Math.sin(tt * 18) * 3 * rI;
    else if (rxn === 'sleepy') bobY += (4 + Math.sin(tt * 1.3) * 2) * rI;
    else if (rxn === 'burnt') shakeX += Math.sin(tt * 3) * 5 * rI;
    if (chew > 0) {
      sqX += Math.sin(tt * 14) * 0.022;
      sqY -= Math.sin(tt * 14) * 0.022;
    }
    if (mouthOpen > 0) {
      sqY += mouthOpen * 0.03;
      sqX -= mouthOpen * 0.02;
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

    // Board: shadow, end-grain thickness, top face, grain, groove
    softShadow(ctx, cx + 4, cy + 10 + recoil * 0.5, 190, 96, 0.2);
    ctx.save();
    ctx.translate(0, recoil);
    ctx.fillStyle = '#C9915C';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    rr(ctx, cx - 178, cy - 80, 356, 172, 28);
    ctx.fill();
    ctx.stroke();
    const bg = ctx.createLinearGradient(cx - 178, cy - 90, cx + 178, cy + 70);
    bg.addColorStop(0, '#EDC391');
    bg.addColorStop(0.5, '#E6B88A');
    bg.addColorStop(1, '#D9A672');
    ctx.fillStyle = bg;
    rr(ctx, cx - 178, cy - 90, 356, 160, 28);
    ctx.fill();
    ctx.stroke();
    woodGrain(ctx, cx - 178, cy - 90, 356, 160, 1, 0.22);
    ctx.strokeStyle = 'rgba(160, 105, 60, 0.55)';
    ctx.lineWidth = 2.5;
    rr(ctx, cx - 158, cy - 72, 316, 124, 20);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 240, 220, 0.5)';
    ctx.lineWidth = 1.5;
    rr(ctx, cx - 156, cy - 70, 312, 120, 19);
    ctx.stroke();
    // Hanging hole
    ctx.fillStyle = '#A8734A';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    circ(ctx, cx + 156, cy - 68, 6);
    ctx.fill();
    ctx.stroke();
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
      // Dough flattening with rolling pin
      const flat = prog;
      ctx.save();
      ctx.scale(1 + flat * 0.45, 1 - flat * 0.3);
      drawIngredient(ctx, bi.id, 0, 0, 58, {});
      ctx.restore();
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
      if (prog < 1) {
        drawIngredient(ctx, bi.id, wholeX, 0, 54, { sliced: false, scaleX: shrink, scaleY: 1 - prog * 0.1 });
        // Cut face on the remaining piece
        if (chops > 0) {
          ctx.fillStyle = lighten(meta.inner || '#FFFFFF', 0.2);
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 2.5;
          ell(ctx, wholeX + 54 * shrink * 0.85, 0, 8, 40 * (1 - prog * 0.1));
          ctx.fill();
          ctx.stroke();
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
          py = -Math.sin(p * PI) * 26;
          rot = lerp(0.6, slotRot, p);
          sc = 1 + Math.sin(p * PI) * 0.15;
        }
        drawIngredient(ctx, bi.id, px, py, 40, { sliced: true, rot, scaleX: sc, scaleY: sc });
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
      if (tool === 'pin') drawRollingPin(ctx, kx, ky, 44, ka);
      else drawKnife(ctx, kx, ky, 56, ka, ks.active ? seg(ks.t, 0.3, 0.9) : (0.5 + 0.5 * Math.sin(t * 1.4)) * 0.6);

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

  /* ---------- Station 2: Ceramic bowl vortex + blender ---------- */
  function drawMixStation(ctx, cx, cy, s, t) {
    s = s || {};
    const mode = s.mixMode || 'bowl';
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
      const shake = velN * Math.sin(t * 42) * 1.6;
      ctx.translate(shake, 0);
      softShadow(ctx, 0, 84, 80, 16, 0.2);
      // Base unit
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
      ctx.fillStyle = '#FFF7EB';
      circ(ctx, -26, 60, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = velN > 0.1 ? '#78C47C' : '#E8998D';
      circ(ctx, 0, 60, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFF7EB';
      circ(ctx, 26, 60, 7);
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
      // Liquid with vortex
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
      // Vortex cone
      if (velN > 0.05) {
        for (let i = 0; i < 5; i++) {
          const yy = topY + 4 + i * (fillH / 5) * 0.8;
          const rx = (60 - i * 11) * (0.5 + velN * 0.5);
          ctx.strokeStyle = `rgba(255,255,255,${(0.35 * velN).toFixed(3)})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(0, yy, Math.max(2, rx), Math.max(1, rx * 0.3), 0, swirl * 2 + i, swirl * 2 + i + PI * 1.4);
          ctx.stroke();
        }
        ctx.fillStyle = darken(mixColor, 0.2);
        ell(ctx, 0, topY + 8, 10 * velN, 4 * velN);
        ctx.fill();
      }
      // Items spinning inside
      items.forEach((it, idx) => {
        const a = swirl * (1.4 + velN) + (idx * PI2) / Math.max(1, items.length);
        const rad = (1 - prog * 0.6) * 38;
        const iy = topY + 24 + ((idx * 23 + t * 20 * velN) % Math.max(20, fillH - 36));
        const sc = Math.max(8, 20 * (1 - prog * 0.55));
        drawIngredient(ctx, it.id, Math.cos(a) * rad, iy, sc, { sliced: true, shadow: false, rot: a, scaleX: 0.6 + 0.4 * Math.abs(Math.sin(a)) });
      });
      // Bubbles
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let k = 0; k < 10; k++) {
        const phb = (t * (0.3 + velN * 1.2) + hash(k)) % 1;
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

    // ---- Speckled sage ceramic bowl (rim ellipse + visible body & foot) ----
    ctx.rotate(tilt);
    softShadow(ctx, 0, 100, 120, 22, 0.22);
    // Foot ring
    ctx.fillStyle = '#7FA896';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.5;
    ell(ctx, 0, 106, 58, 12);
    ctx.fill();
    ctx.stroke();
    // Bowl body below the rim
    const bodyG = ctx.createLinearGradient(-140, 0, 140, 0);
    bodyG.addColorStop(0, '#86B09F');
    bodyG.addColorStop(0.35, '#A9D0BF');
    bodyG.addColorStop(1, '#79A391');
    ctx.fillStyle = bodyG;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-140, 0);
    ctx.bezierCurveTo(-140, 78, -72, 112, 0, 112);
    ctx.bezierCurveTo(72, 112, 140, 78, 140, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(92,61,46,0.1)';
    for (let k = 0; k < 10; k++) {
      circ(ctx, (hash(k + 20) - 0.5) * 220, 86 + (hash(k + 30) - 0.5) * 18, 1.6 + hash(k) * 1.2);
      ctx.fill();
    }
    // Rim
    const bowlG = ctx.createLinearGradient(-140, -40, 140, 60);
    bowlG.addColorStop(0, '#B5D8C8');
    bowlG.addColorStop(0.5, '#9CC5B5');
    bowlG.addColorStop(1, '#86B09F');
    ctx.fillStyle = bowlG;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    ell(ctx, 0, 0, 140, 84);
    ctx.fill();
    ctx.stroke();
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

    // Flying batter droplets when stirring fast
    if (velN > 0.15) {
      for (let k = 0; k < 7; k++) {
        const phd = (t * 1.6 + hash(k)) % 1;
        const a = hash(k + 4) * PI2 + swirl * 0.3;
        const r0 = 112, h = 40 + hash(k + 9) * 40;
        const px = Math.cos(a) * (r0 + phd * 30);
        const py = Math.sin(a) * 66 - Math.sin(phd * PI) * h + phd * 30;
        drawParticle(ctx, { x: px, y: py, r: 3 + hash(k + 2) * 2, kind: 'droplet', color: rgba(mixColor, (1 - phd) * velN) }, t);
      }
    }
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

  function drawCookStation(ctx, cx, cy, s, t) {
    s = s || {};
    const mode = s.cookMode || 'pan';
    const heat = clamp(s.heatLevel || 2, 1, 3);
    const items = s.panItems || [];
    const cook = s.cookProgress || 0;
    const burnt = cook > 1.08;
    const spring = s.boardSpring || { sx: 1, sy: 1 };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (mode === 'oven') {
      const warm = clamp01(cook / 0.85);
      softShadow(ctx, cx, cy + 86, 150, 18, 0.22);
      ctx.fillStyle = '#F4D5B8';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 4;
      rr(ctx, cx - 150, cy - 96, 300, 176, 26);
      ctx.fill();
      ctx.stroke();
      // Knobs
      for (let k = -1; k <= 1; k++) {
        ctx.fillStyle = '#E8998D';
        circ(ctx, cx + k * 40, cy - 78, 8);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + k * 40, cy - 78);
        ctx.lineTo(cx + k * 40 + Math.cos(-1 + k + heat * 0.4) * 6, cy - 78 + Math.sin(-1 + k + heat * 0.4) * 6);
        ctx.stroke();
        ctx.lineWidth = 4;
      }
      // Window with warm interior glow
      ctx.save();
      rr(ctx, cx - 118, cy - 58, 236, 114, 18);
      ctx.clip();
      const og = ctx.createRadialGradient(cx, cy + 30, 10, cx, cy, 140);
      og.addColorStop(0, lerpColor('#FFE8A3', '#FFB347', warm * 0.8));
      og.addColorStop(1, lerpColor('#F7D98A', '#E68A2E', warm * 0.6));
      ctx.fillStyle = og;
      ctx.fillRect(cx - 120, cy - 60, 240, 120);
      // Heating coil
      ctx.strokeStyle = `rgba(255, ${Math.round(120 - warm * 60)}, 60, ${(0.5 + 0.5 * Math.abs(Math.sin(t * 3))).toFixed(3)})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 90, cy + 44);
      for (let k = 0; k < 6; k++) {
        ctx.quadraticCurveTo(cx - 75 + k * 30, cy + 34, cx - 60 + k * 30, cy + 44);
      }
      ctx.stroke();
      // Rack
      ctx.strokeStyle = 'rgba(92,61,46,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 100, cy + 24);
      ctx.lineTo(cx + 100, cy + 24);
      ctx.stroke();
      for (let k = -3; k <= 3; k++) {
        ctx.beginPath();
        ctx.moveTo(cx + k * 28, cy + 24);
        ctx.lineTo(cx + k * 28, cy + 32);
        ctx.stroke();
      }
      // Rising cake on a tray (ovenPulse = spring kick when the oven dings)
      const pulse = s.ovenPulse || 0;
      const rise = (0.6 + warm * 0.5) * (1 + pulse * 0.1);
      ctx.save();
      ctx.translate(cx, cy + 22);
      ctx.scale((spring.sx || 1) * (1 + pulse * 0.08), (spring.sy || 1) * rise);
      const tint = s.batterTint || '#FFF3C4';
      const cakeCol = lerpColor(tint, '#E69849', Math.min(0.7, cook / 0.85));
      ctx.fillStyle = '#B8C5CE';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      rr(ctx, -84, -6, 168, 10, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = darken(cakeCol, 0.12);
      ctx.lineWidth = 3;
      rr(ctx, -72, -40, 144, 36, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = cakeCol;
      ctx.beginPath();
      ctx.moveTo(-72, -40);
      ctx.bezierCurveTo(-60, -70 - warm * 12, 60, -70 - warm * 12, 72, -40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = lighten(cakeCol, 0.35);
      ell(ctx, -16, -52 - warm * 6, 22, 7, -0.1);
      ctx.fill();
      if (warm > 0.5) {
        ctx.fillStyle = `rgba(190, 120, 50, ${((warm - 0.5) * 1.2).toFixed(3)})`;
        for (let k = 0; k < 6; k++) {
          circ(ctx, (hash(k) - 0.5) * 120, -48 + hash(k + 4) * 10, 3 + hash(k + 8) * 3);
          ctx.fill();
        }
      }
      ctx.restore();
      // Steam inside
      if (warm > 0.3) {
        ctx.strokeStyle = `rgba(255,253,249,${(0.5 * warm).toFixed(3)})`;
        ctx.lineWidth = 3;
        for (let k = -1; k <= 1; k++) {
          const sx = cx + k * 34;
          const wv = Math.sin(t * 3 + k) * 6;
          ctx.beginPath();
          ctx.moveTo(sx, cy - 20);
          ctx.quadraticCurveTo(sx + wv, cy - 36, sx - wv, cy - 52);
          ctx.stroke();
        }
      }
      ctx.restore();
      // Glass frame + reflection
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 4;
      rr(ctx, cx - 118, cy - 58, 236, 114, 18);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx - 96, cy + 40);
      ctx.lineTo(cx - 40, cy - 48);
      ctx.stroke();
      // Door handle
      ctx.fillStyle = '#C9D4DC';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      rr(ctx, cx - 100, cy + 62, 200, 10, 5);
      ctx.fill();
      ctx.stroke();
      // Ding sparkles when ready
      if (cook >= 0.6 && !burnt) {
        ctx.fillStyle = '#F7C948';
        for (let k = 0; k < 4; k++) {
          const a = t * 2 + k * 1.6;
          sparkle4(ctx, cx + 120 + Math.cos(a) * 18, cy - 90 + Math.sin(a) * 10, 7 + Math.sin(t * 5 + k) * 2, t * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      return;
    }

    // ---- Pan toss state ----
    let pt = normAnim(s.panToss);
    if (!s.panToss && s.flipAnim > 0) pt = { active: true, t: 1 - clamp01(s.flipAnim) };
    let panDy = 0, panTilt = 0;
    if (pt.active) {
      if (pt.panDy !== undefined) {
        panDy = pt.panDy; panTilt = pt.panTilt || 0;
      } else {
        const tt = pt.t;
        if (tt < 0.2) { const p = smooth(tt / 0.2); panDy = 10 * p; panTilt = 0.08 * p; }
        else if (tt < 0.32) { const p = easeOutCubic((tt - 0.2) / 0.12); panDy = lerp(10, -18, p); panTilt = lerp(0.08, -0.24, p); }
        else { const u = tt - 0.32; const d = Math.exp(-5 * u); panDy = -18 * d * Math.cos(13 * u); panTilt = -0.24 * d * Math.cos(11 * u); }
      }
    }

    // Burner: cast-iron trivet ring peeking around the skillet + gas petals
    // licking up around the bottom rim (the pan covers their roots)
    const flameOuter = ['#7BC4E8', '#F5A623', '#E85D4A'][heat - 1];
    const flameInner = ['#DFF4FF', '#FFE08A', '#FFC25A'][heat - 1];
    ctx.strokeStyle = '#6B625C';
    ctx.lineWidth = 9;
    ell(ctx, cx, cy + 6, 150, 94);
    ctx.stroke();
    ctx.strokeStyle = '#8C837D';
    ctx.lineWidth = 3;
    ell(ctx, cx, cy + 6, 150, 94);
    ctx.stroke();
    for (let k = 0; k < 9; k++) {
      const a = PI * 0.16 + (k / 8) * PI * 0.68; // bottom arc of the rim
      const fx = cx + Math.cos(a) * 128;
      const fy = cy + 4 + Math.sin(a) * 78;
      const flick = Math.sin(t * 16 + k * 1.7) * 3;
      const h = (30 + heat * 8) * (0.82 + 0.18 * Math.sin(t * 11 + k * 1.3)) * (0.75 + 0.25 * Math.sin(a));
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(a + PI / 2); // petal points outward from under the rim
      drawFlamePetal(ctx, 0, 0, h, 11 + heat, flameOuter, flameInner, flick);
      ctx.restore();
    }
    // Heat glow haze
    ctx.fillStyle = `rgba(255, 170, 80, ${(0.07 * heat).toFixed(3)})`;
    ell(ctx, cx, cy + 40, 170, 60);
    ctx.fill();

    // ---- Skillet (pivot at the handle grip for the toss) ----
    const pivX = cx + 190, pivY = cy;
    ctx.save();
    ctx.translate(pivX, pivY + panDy);
    ctx.rotate(panTilt);
    ctx.translate(-pivX, -pivY);
    ctx.translate(cx, cy);
    ctx.scale(spring.sx || 1, spring.sy || 1);

    softShadow(ctx, 6, 18 - panDy * 0.5, 150, 90, 0.18);
    // Walnut handle with brass ring
    ctx.fillStyle = '#8C5A3C';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    rr(ctx, 112, -14, 108, 28, 14);
    ctx.fill();
    ctx.stroke();
    const hgd = ctx.createLinearGradient(0, -14, 0, 14);
    hgd.addColorStop(0, '#C98A5E');
    hgd.addColorStop(1, '#8C5A3C');
    ctx.fillStyle = hgd;
    rr(ctx, 118, -10, 96, 20, 10);
    ctx.fill();
    ctx.strokeStyle = '#F5D076';
    ctx.lineWidth = 3;
    circ(ctx, 206, 0, 6);
    ctx.stroke();
    ctx.fillStyle = '#F5D076';
    circ(ctx, 126, 0, 3.5);
    ctx.fill();
    // Copper body
    const cg = ctx.createLinearGradient(-140, -80, 140, 80);
    cg.addColorStop(0, '#F2B48A');
    cg.addColorStop(0.45, '#D9825B');
    cg.addColorStop(1, '#A8552F');
    ctx.fillStyle = cg;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    ell(ctx, 0, 0, 140, 86);
    ctx.fill();
    ctx.stroke();
    // Dark interior with radial shade + oil sheen
    const ig = ctx.createRadialGradient(-30, -20, 10, 0, 0, 125);
    ig.addColorStop(0, '#5A504A');
    ig.addColorStop(1, '#3A322E');
    ctx.fillStyle = ig;
    ell(ctx, 0, 0, 122, 72);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 240, 200, 0.1)';
    ell(ctx, -36, -22, 60, 26, -0.4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 131, 79, 0, PI * 1.12, PI * 1.55);
    ctx.stroke();

    // Butter foam rings & bubbles (interior)
    ctx.save();
    ell(ctx, 0, 0, 120, 70);
    ctx.clip();
    const butterRate = 0.6 + heat * 0.5;
    for (let k = 0; k < 14; k++) {
      const phb = (t * butterRate + hash(k)) % 1;
      const bx = (hash(k + 3) - 0.5) * 220, by = (hash(k + 7) - 0.5) * 120;
      const rad = 3 + phb * 9;
      ctx.strokeStyle = `rgba(255, 250, 230, ${(0.75 * (1 - phb)).toFixed(3)})`;
      ctx.lineWidth = 2;
      circ(ctx, bx, by, rad);
      ctx.stroke();
      if (k % 3 === 0) {
        ctx.fillStyle = `rgba(255, 236, 170, ${(0.5 * (1 - phb)).toFixed(3)})`;
        circ(ctx, bx, by, rad * 0.4);
        ctx.fill();
      }
    }
    // Melting golden butter pat with glossy pool
    ctx.fillStyle = 'rgba(255, 214, 110, 0.32)';
    blob(ctx, 34, 18, 34, 16, 1.1 + Math.sin(t * 0.5) * 0.1, 0.18, 12);
    ctx.fill();
    ctx.fillStyle = '#FFE48A';
    ctx.strokeStyle = 'rgba(92,61,46,0.55)';
    ctx.lineWidth = 1.5;
    const melt = clamp01(cook * 1.5);
    rr(ctx, 26, 8, 18 * (1 + melt * 0.3), 12 * (1 - melt * 0.5), 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    rr(ctx, 29, 10, 7, 3, 1.5);
    ctx.fill();
    ctx.restore();

    // ---- Food bodies (parabolic staggered toss with spin & drop shadows) ----
    const bodyFor = (idx, isBase) => {
      const given = pt.active ? (isBase ? pt.baseBody : (pt.bodies && pt.bodies[idx])) : null;
      if (given) {
        const dy = given.dy || 0;
        return {
          dx: given.dx || 0, dy, rot: given.rot || 0, flip: given.flip || 0,
          sx: given.sx || 1, sy: given.sy || 1, sh: 1 - clamp01(-dy / 150),
        };
      }
      if (!pt.active) return { dx: 0, dy: 0, rot: 0, flip: 0, sx: 1, sy: 1, sh: 1 };
      const tl = 0.2 + (isBase ? 0 : idx * 0.045);
      const tt = seg(pt.t, tl, tl + 0.62);
      const arc = Math.sin(tt * PI);
      const h = (pt.height || 110) * (isBase ? 1.05 : 0.85 + hash(idx) * 0.3);
      const landSquash = tt >= 1 ? Math.max(0, 1 - seg(pt.t, tl + 0.62, tl + 0.78)) : 0;
      return {
        dx: (isBase ? 0 : (hash(idx + 2) - 0.5) * 20) * arc,
        dy: -h * arc,
        rot: isBase ? 0 : tt * PI2 * (pt.spin || 1),
        flip: isBase ? tt : 0,
        sx: 1 + arc * 0.18 + landSquash * 0.2,
        sy: 1 + arc * 0.18 - landSquash * 0.25,
        sh: 1 - arc,
      };
    };
    const sizzle = (k) => pt.active ? 0 : Math.sin(t * 28 + k * 2.1) * 0.8 * heat * clamp01(cook * 2);
    const hasBase = items.some(p => p.id === 'dough' || p.id === 'pizzabase');
    const baseId = (items.find(p => p.id === 'pizzabase') || {}).id || 'dough';
    // Shadows first (on the pan surface)
    const drawShadow = (x, y, r, sh) => {
      ctx.fillStyle = `rgba(0,0,0,${(0.28 * sh).toFixed(3)})`;
      ell(ctx, x, y + 6, r * (0.6 + 0.4 * sh), r * 0.35 * (0.6 + 0.4 * sh));
      ctx.fill();
    };
    if (hasBase) {
      const b = bodyFor(0, true);
      drawShadow(b.dx, 0, 68, b.sh);
    }
    items.forEach((p, i) => {
      if (p.id === 'dough' || p.id === 'pizzabase') return;
      const b = bodyFor(i, false);
      drawShadow(p.x + b.dx, p.y, 34, b.sh);
    });
    // Base (pancake / pizza) with flip: cos(flip*2π) scaleY shows the browned side
    if (hasBase) {
      const b = bodyFor(0, true);
      const flipS = Math.cos(b.flip * PI2);
      ctx.save();
      ctx.translate(b.dx, b.dy);
      ctx.scale(b.sx, b.sy * Math.max(0.12, Math.abs(flipS)));
      drawIngredient(ctx, baseId, 0, 0, 70, { cooked: flipS < 0 ? Math.min(cook + 0.25, 1.3) : cook, shadow: false });
      ctx.restore();
    }
    items.forEach((p, i) => {
      if (p.id === 'dough' || p.id === 'pizzabase') return;
      const b = bodyFor(i, false);
      const jig = sizzle(i);
      const pop = p.scale === undefined ? 1 : clamp01(p.scale);
      if (pop < 0.03) return;
      drawIngredient(ctx, p.id, p.x + b.dx + jig, p.y + b.dy + jig * 0.5, 36, {
        sliced: p.sliced, cracked: p.cracked, cooked: cook, rot: b.rot, scaleX: b.sx * pop, scaleY: b.sy * pop, shadow: false,
      });
    });

    // Spatula resting on the rim, lifting with the toss
    const spLift = pt.active ? bump(pt.t) * 18 : 0;
    drawSpatula(ctx, -96, -40 - spLift, 30, -0.55 - (pt.active ? bump(pt.t) * 0.3 : 0) + Math.sin(t * 2) * 0.02);
    ctx.restore(); // skillet

    // Steam ribbons / smoke rising above the pan
    const steamA = clamp01(cook * 2) * (burnt ? 0.4 : 0.6);
    for (let k = -1; k <= 1; k++) {
      const sx = cx + k * 46;
      const ph = (t * 0.5 + k * 0.3 + 1) % 1;
      const wave = Math.sin(t * 3 + k) * 8;
      ctx.strokeStyle = burnt ? `rgba(110, 100, 95, ${(0.6 * (1 - ph)).toFixed(3)})` : `rgba(255, 253, 249, ${(steamA * (1 - ph)).toFixed(3)})`;
      ctx.lineWidth = burnt ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(sx, cy - 30 - ph * 20);
      ctx.quadraticCurveTo(sx + wave, cy - 60 - ph * 30, sx - wave, cy - 92 - ph * 40);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- Station 4: Cake stand, piping bag, sauce & sprinkles ---------- */
  function drawDecorateStation(ctx, cx, cy, s, t) {
    s = s || {};
    const dish = s.dish;
    const spring = s.boardSpring || { sx: 1, sy: 1 };
    const dishScale = (s.dishScale || 1.08) * (spring.sx || 1);
    const tool = s.decorTool || 'piping';
    const pa = normAnim(s.pipingAnim);
    const hp = s.hoverPt || null;
    const toolColor = s.toolColor || (tool === 'sauce' ? '#FF2B5E' : '#FF85B3');

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Scalloped patisserie cake stand under the plate
    const footY = cy + 118 * dishScale;
    softShadow(ctx, cx, footY + 6, 80, 12, 0.18);
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    rr(ctx, cx - 14, cy + 94 * dishScale, 28, 26, 8);
    ctx.fill();
    ctx.stroke();
    ell(ctx, cx, footY, 72, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F2C6B8';
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * PI2;
      circ(ctx, cx + Math.cos(a) * 66, footY + Math.sin(a) * 9, 3);
      ctx.fill();
    }
    if (dish) drawDish(ctx, dish, cx, cy, dishScale, t, { toppingSprings: s.toppingSprings });

    // Tool follows the pointer when near the dish; otherwise rests to the side
    let tx = cx + 196, ty = cy - 24 + Math.sin(t * 2.5) * 4;
    let near = s.toolNear !== undefined ? !!s.toolNear : !!(hp && Math.hypot(hp.x - cx, hp.y - cy) < 185);
    if (hp && (near || s.toolNear === undefined)) { tx = hp.x; ty = hp.y; }
    if (hp && s.toolNear === undefined && !near) { tx = cx + 196; ty = cy - 24 + Math.sin(t * 2.5) * 4; }
    const squeezeGiven = s.pipingAnim && typeof s.pipingAnim.squeeze === 'number' ? clamp01(s.pipingAnim.squeeze) : null;
    const sq = squeezeGiven !== null ? squeezeGiven : (pa.active ? bump(pa.t) : (near ? 0.12 + Math.sin(t * 4) * 0.06 : 0));
    const shake = (s.pipingAnim && s.pipingAnim.shake) || 0;
    const tilt = s.toolTilt || 0;
    if (tool === 'piping') {
      if (pa.active && pa.x !== undefined) { tx = pa.x; ty = pa.y; }
      drawPipingBag(ctx, tx + 4, ty - 6, 38, sq, pa.color || toolColor, { angle: (near ? 0.42 : 0.3) + shake + tilt });
    } else if (tool === 'sauce') {
      drawSauceBottle(ctx, tx + 10, ty - 8, 36, 0.55 + shake + tilt, toolColor, near ? 0.5 + sq : 0);
    } else {
      const stilt = -0.7 - sq * 0.5 + shake + tilt;
      drawShaker(ctx, tx + 20, ty - 54, 30, stilt);
      if (sq > 0.2) {
        const cols = ['#E87A82', '#F2C97D', '#8FB9A8', '#9B82C9'];
        for (let k = 0; k < 6; k++) {
          const phk = ((pa.active ? pa.t : t * 0.6) * 1.4 + hash(k)) % 1;
          ctx.save();
          ctx.translate(tx + 8 + (hash(k + 3) - 0.5) * 30, ty - 40 + phk * 44);
          ctx.rotate(phk * 6 + k);
          ctx.fillStyle = cols[k % cols.length];
          rr(ctx, -5, -2, 10, 4, 2);
          ctx.fill();
          ctx.restore();
        }
      }
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
    if (dish) drawDish(ctx, dish, cx, cy, dishScale, t, { scoopProgress: scoopP, toppingSprings: s.toppingSprings });

    const sampleId = dish && dish.items.length ? dish.items[0].id : 'strawberry';
    const sampleCooked = dish && dish.items.length ? (dish.items[0].cooked || 0) : 0;
    const dishCol = dish ? (dish.liquidColor || '#F4A6B8') : '#F4A6B8';

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
      drawSpoon(ctx, 0, 0, R, 0, { scoop: load, ingId: fs.ingId || sampleId, color: fs.color || dishCol, cooked: sampleCooked });
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
      drawSpoon(ctx, fork.x, fork.y + bob, R, -0.55 + (fork.dragging ? Math.sin(t * 10) * 0.05 : 0), {
        scoop: (fork.dragging || bites < 3) ? 1 : 0, ingId: sampleId, color: dishCol, cooked: sampleCooked,
      });
    }
    ctx.restore();
  }

  return {
    loadPortraits,
    portraits,
    OUTLINE,
    CREAM,
    // primitives & helpers
    rr, circ, ell, star, sparkle4, heart, blob, softShadow, lerpColor, lighten, darken, rgba,
    clamp01, lerp, smooth, easeOutBack, easeOutCubic, easeOutElastic, easeInOutSine, bump, seg, hash, qbez,
    // scene
    drawIcon,
    drawKitchenBackdrop,
    drawIngredient,
    drawDish,
    getDishPortionPoint,
    drawCritterCustomer,
    getCritterMouth,
    getCounterY,
    // utensils
    drawKnife, drawSpoon, drawWhisk, drawPipingBag, drawSpatula, drawShaker, drawSauceBottle, drawRollingPin,
    // particles
    drawParticle,
    // stations
    drawChopStation, drawMixStation, drawCookStation, drawDecorateStation, drawFeedStation,
  };
})();
