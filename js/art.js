'use strict';
/* ==========================================================================
 * Chuyu's Rainbow Kitchen — High-Precision 2D Storybook Art & Animation Engine
 * ========================================================================== */
const KitchenArt = (() => {
  const portraits = {};
  const PI2 = Math.PI * 2;

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
      const a = (rot || -Math.PI / 2) + (i * Math.PI) / n;
      const r = i % 2 === 0 ? r1 : r2;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function heart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.5, y - s * 1.05, x, y - s * 0.42);
    ctx.bezierCurveTo(x + s * 0.5, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
    ctx.closePath();
  }

  function lerpColor(hexA, hexB, t) {
    t = Math.max(0, Math.min(1, t));
    const a = parseInt(hexA.replace('#', ''), 16);
    const b = parseInt(hexB.replace('#', ''), 16);
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  /* ==========================================================================
   * 1. High-Precision Ingredient & Cross-Section Slice Renderer
   * ========================================================================== */
  function drawIngredient(ctx, id, x, y, r, opts) {
    opts = opts || {};
    const item = KitchenData.getIngredient(id);
    const sliced = !!opts.sliced;
    const cooked = opts.cooked || 0; // 0 = raw, 0.7 = golden, >1.05 = burnt
    const burnt = cooked > 1.08;

    ctx.save();
    ctx.translate(x, y);
    if (opts.rot) ctx.rotate(opts.rot);

    // Soft drop shadow
    if (opts.shadow !== false) {
      ctx.fillStyle = 'rgba(40,25,15,0.18)';
      ell(ctx, 2, r * 0.18, r * 0.88, r * 0.72);
      ctx.fill();
    }

    let baseCol = item.color;
    if (cooked > 0 && item.cookedColor) {
      baseCol = lerpColor(item.color, item.cookedColor, Math.min(1, cooked / 0.75));
    }
    if (burnt) {
      baseCol = lerpColor(baseCol, '#2e221d', Math.min(1, (cooked - 1.0) * 1.8));
    }

    switch (item.sliceStyle) {
      case 'strawberry': {
        if (!sliced) {
          // Plump heart berry + leafy green cap + golden seeds
          ctx.fillStyle = baseCol;
          ctx.strokeStyle = item.rim;
          ctx.lineWidth = Math.max(1.5, r * 0.08);
          ctx.beginPath();
          ctx.moveTo(0, r * 0.85);
          ctx.bezierCurveTo(-r * 0.95, r * 0.25, -r * 0.85, -r * 0.75, 0, -r * 0.55);
          ctx.bezierCurveTo(r * 0.85, -r * 0.75, r * 0.95, r * 0.25, 0, r * 0.85);
          ctx.fill();
          ctx.stroke();
          // Seeds
          ctx.fillStyle = '#ffe680';
          [[-0.35, -0.15], [0.35, -0.15], [0, 0.05], [-0.25, 0.3], [0.25, 0.3], [0, 0.52]].forEach(([sx, sy]) => {
            ell(ctx, sx * r, sy * r, r * 0.06, r * 0.09);
            ctx.fill();
          });
          // Green calyx leaves
          ctx.fillStyle = '#3dc94e';
          for (let i = -2; i <= 2; i++) {
            ell(ctx, i * r * 0.2, -r * 0.62, r * 0.22, r * 0.1, i * 0.3);
            ctx.fill();
          }
        } else {
          // Cross-section strawberry slice with white heart core!
          ctx.fillStyle = baseCol;
          ctx.strokeStyle = item.rim;
          ctx.lineWidth = Math.max(1.5, r * 0.08);
          circ(ctx, 0, 0, r * 0.78);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = item.inner;
          circ(ctx, 0, 0, r * 0.52);
          ctx.fill();
          ctx.fillStyle = '#fff5f7';
          circ(ctx, 0, 0, r * 0.22);
          ctx.fill();
          // Radiating white veins
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(1, r * 0.05);
          for (let k = 0; k < 6; k++) {
            const a = (k * PI2) / 6;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15);
            ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
            ctx.stroke();
          }
        }
        break;
      }

      case 'kiwi': {
        // Fuzzy brown rim, bright green flesh, white core & black seed ring
        ctx.fillStyle = sliced ? '#68d442' : '#9c6b3b';
        ctx.strokeStyle = '#6e4720';
        ctx.lineWidth = Math.max(2, r * 0.1);
        circ(ctx, 0, 0, r * 0.8);
        ctx.fill();
        ctx.stroke();
        if (sliced) {
          ctx.fillStyle = '#d9ffbf';
          circ(ctx, 0, 0, r * 0.34);
          ctx.fill();
          ctx.fillStyle = '#222';
          for (let k = 0; k < 10; k++) {
            const a = (k * PI2) / 10;
            ell(ctx, Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46, r * 0.05, r * 0.03, a);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = '#68d442';
          circ(ctx, r * 0.18, -r * 0.15, r * 0.35);
          ctx.fill();
        }
        break;
      }

      case 'banana': {
        if (!sliced) {
          ctx.strokeStyle = '#e0b010';
          ctx.lineWidth = r * 0.45;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, -r * 0.2, r * 0.72, 0.35, 2.5);
          ctx.stroke();
          ctx.strokeStyle = '#ffe866';
          ctx.lineWidth = r * 0.32;
          ctx.beginPath();
          ctx.arc(0, -r * 0.2, r * 0.72, 0.38, 2.45);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#fff9d2';
          ctx.strokeStyle = '#e0b822';
          ctx.lineWidth = Math.max(2, r * 0.1);
          circ(ctx, 0, 0, r * 0.72);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#d4a62a';
          ctx.lineWidth = Math.max(1.2, r * 0.06);
          for (let k = 0; k < 3; k++) {
            const a = (k * PI2) / 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35);
            ctx.stroke();
          }
        }
        break;
      }

      case 'citrus':
      case 'tomato': {
        const isTom = item.sliceStyle === 'tomato';
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = item.rim;
        ctx.lineWidth = Math.max(2, r * 0.09);
        circ(ctx, 0, 0, r * 0.8);
        ctx.fill();
        ctx.stroke();
        if (sliced) {
          ctx.fillStyle = item.inner;
          for (let k = 0; k < (isTom ? 4 : 6); k++) {
            const n = isTom ? 4 : 6;
            const a1 = (k * PI2) / n + 0.12;
            const a2 = ((k + 1) * PI2) / n - 0.12;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, r * 0.64, a1, a2);
            ctx.closePath();
            ctx.fill();
          }
          if (isTom) {
            ctx.fillStyle = '#ffe680';
            for (let k = 0; k < 8; k++) {
              const a = (k * PI2) / 8 + 0.3;
              circ(ctx, Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.055);
              ctx.fill();
            }
          }
        } else if (isTom) {
          ctx.fillStyle = '#38b848';
          star(ctx, 0, -r * 0.55, r * 0.32, r * 0.12, 5);
          ctx.fill();
        }
        break;
      }

      case 'egg': {
        if (!sliced && !opts.cracked && cooked === 0) {
          // Whole farm egg
          ctx.fillStyle = '#fff5e4';
          ctx.strokeStyle = '#d9c3a3';
          ctx.lineWidth = Math.max(1.8, r * 0.08);
          ell(ctx, 0, 0, r * 0.68, r * 0.86);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ell(ctx, -r * 0.22, -r * 0.28, r * 0.16, r * 0.28, -0.3);
          ctx.fill();
        } else {
          // Sunny-side up cracked egg!
          const whiteAlpha = Math.min(0.98, 0.72 + cooked * 0.35);
          ctx.fillStyle = burnt ? '#4a372d' : `rgba(255, 253, 246, ${whiteAlpha})`;
          ctx.strokeStyle = cooked > 0.5 ? '#d98c2b' : '#e6d8c3';
          ctx.lineWidth = Math.max(1.8, r * 0.08);
          ctx.beginPath();
          for (let k = 0; k < 12; k++) {
            const a = (k * PI2) / 12;
            const rad = r * (0.78 + 0.1 * Math.sin(k * 2.3 + 1));
            if (k === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
            else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Glossy Golden Yolk
          ctx.fillStyle = burnt ? '#6e4219' : '#ffa200';
          circ(ctx, r * 0.05, -r * 0.04, r * 0.38);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          circ(ctx, -r * 0.08, -r * 0.16, r * 0.11);
          ctx.fill();
          // If freshly cracked on the cutting board (cooked === 0), show the two cracked eggshell halves parting above!
          if (!cooked && opts.showShell) {
            for (const s of [-1, 1]) {
              ctx.save();
              ctx.translate(s * r * 0.58, -r * 0.62);
              ctx.rotate(s * 0.42);
              ctx.fillStyle = '#fff5e4';
              ctx.strokeStyle = '#d9c3a3';
              ctx.lineWidth = Math.max(1.5, r * 0.07);
              ctx.beginPath();
              ctx.arc(0, 0, r * 0.38, Math.PI, 0);
              ctx.lineTo(r * 0.2, r * 0.12);
              ctx.lineTo(0, -r * 0.04);
              ctx.lineTo(-r * 0.2, r * 0.12);
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
        // Marbled beef steak patty + grill marks when cooked
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = burnt ? '#1f1410' : item.rim;
        ctx.lineWidth = Math.max(2, r * 0.09);
        ell(ctx, 0, 0, r * 0.88, r * 0.68);
        ctx.fill();
        ctx.stroke();
        if (cooked < 0.35) {
          // White marbling veins
          ctx.strokeStyle = 'rgba(255,235,235,0.75)';
          ctx.lineWidth = Math.max(1.5, r * 0.06);
          ctx.beginPath();
          ctx.moveTo(-r * 0.5, -r * 0.15);
          ctx.quadraticCurveTo(0, r * 0.1, r * 0.5, -r * 0.2);
          ctx.moveTo(-r * 0.3, r * 0.25);
          ctx.quadraticCurveTo(r * 0.1, 0, r * 0.4, r * 0.25);
          ctx.stroke();
        } else {
          // Sizzling char grill marks
          ctx.strokeStyle = 'rgba(35,15,5,0.65)';
          ctx.lineWidth = Math.max(2, r * 0.09);
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(i * r * 0.32 - r * 0.15, -r * 0.42);
            ctx.lineTo(i * r * 0.32 + r * 0.15, r * 0.42);
            ctx.stroke();
          }
        }
        break;
      }

      case 'cheese': {
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = item.rim;
        ctx.lineWidth = Math.max(1.8, r * 0.08);
        rr(ctx, -r * 0.78, -r * 0.72, r * 1.56, r * 1.44, r * (cooked > 0.3 ? 0.45 : 0.18));
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e69500';
        [[-0.32, -0.25, 0.16], [0.28, -0.18, 0.12], [-0.1, 0.28, 0.18], [0.32, 0.3, 0.11]].forEach(([hx, hy, hr]) => {
          circ(ctx, hx * r, hy * r, hr * r);
          ctx.fill();
        });
        break;
      }

      case 'bacon': {
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = item.rim;
        ctx.lineWidth = Math.max(1.5, r * 0.07);
        rr(ctx, -r * 0.85, -r * 0.42, r * 1.7, r * 0.84, r * 0.25);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = cooked > 0.5 ? '#f5cba7' : '#ffdbe0';
        ctx.lineWidth = Math.max(2, r * 0.12);
        for (let s of [-0.18, 0.18]) {
          ctx.beginPath();
          ctx.moveTo(-r * 0.7, s * r);
          ctx.bezierCurveTo(-r * 0.2, (s - 0.18) * r, r * 0.2, (s + 0.18) * r, r * 0.7, s * r);
          ctx.stroke();
        }
        break;
      }

      case 'dough':
      case 'bun':
      case 'pizza': {
        const isPizza = item.sliceStyle === 'pizza';
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = item.rim;
        ctx.lineWidth = Math.max(2, r * 0.09);
        circ(ctx, 0, 0, r * (isPizza ? 0.92 : 0.82));
        ctx.fill();
        ctx.stroke();
        if (isPizza) {
          ctx.fillStyle = cooked > 0.3 ? '#ff4726' : '#fff5d6';
          circ(ctx, 0, 0, r * 0.72);
          ctx.fill();
        } else if (item.sliceStyle === 'bun') {
          // Sesame seeds
          ctx.fillStyle = '#fff5cc';
          [[-0.3, -0.25], [0, -0.35], [0.3, -0.2], [-0.18, 0.05], [0.2, 0.08]].forEach(([sx, sy]) => {
            ell(ctx, sx * r, sy * r, r * 0.08, r * 0.04, sx);
            ctx.fill();
          });
        } else {
          // Fluffy pancake/cake highlight
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ell(ctx, -r * 0.2, -r * 0.25, r * 0.35, r * 0.2, -0.3);
          ctx.fill();
        }
        break;
      }

      case 'chili': {
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = item.rim;
        ctx.lineWidth = Math.max(1.5, r * 0.08);
        if (!sliced) {
          ctx.beginPath();
          ctx.moveTo(-r * 0.65, -r * 0.35);
          ctx.quadraticCurveTo(0, -r * 0.55, r * 0.78, r * 0.45);
          ctx.quadraticCurveTo(-r * 0.1, r * 0.55, -r * 0.65, -r * 0.35);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#2da12d';
          ctx.lineWidth = Math.max(2.5, r * 0.12);
          ctx.beginPath();
          ctx.moveTo(-r * 0.62, -r * 0.32);
          ctx.lineTo(-r * 0.85, -r * 0.58);
          ctx.stroke();
        } else {
          // Spicy chili rings with seeds
          for (let [ox, oy] of [[-0.25, -0.15], [0.25, 0.18]]) {
            ctx.fillStyle = baseCol;
            circ(ctx, ox * r, oy * r, r * 0.44);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ffe066';
            circ(ctx, ox * r, oy * r, r * 0.18);
            ctx.fill();
          }
        }
        break;
      }

      case 'berry': {
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = item.rim;
        ctx.lineWidth = Math.max(1.5, r * 0.08);
        circ(ctx, 0, 0, r * 0.72);
        ctx.fill();
        ctx.stroke();
        if (sliced) {
          ctx.fillStyle = item.inner;
          circ(ctx, 0, 0, r * 0.5);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          star(ctx, 0, 0, r * 0.24, r * 0.1, 5);
          ctx.fill();
        } else {
          ctx.fillStyle = item.rim;
          star(ctx, 0, -r * 0.25, r * 0.22, r * 0.1, 5);
          ctx.fill();
        }
        break;
      }

      case 'peach': {
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = item.rim;
        ctx.lineWidth = Math.max(1.5, r * 0.08);
        if (!sliced) {
          circ(ctx, 0, r * 0.05, r * 0.78);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#4ec95b';
          ell(ctx, r * 0.22, -r * 0.68, r * 0.26, r * 0.12, 0.4);
          ctx.fill();
        } else {
          ell(ctx, 0, 0, r * 0.82, r * 0.56);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = item.inner;
          ell(ctx, 0, 0, r * 0.66, r * 0.42);
          ctx.fill();
          ctx.fillStyle = '#d9385a';
          ell(ctx, 0, r * 0.08, r * 0.24, r * 0.14);
          ctx.fill();
        }
        break;
      }

      case 'shrimp': {
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = item.rim;
        ctx.lineWidth = Math.max(1.8, r * 0.08);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.62, -0.4, Math.PI * 1.25);
        ctx.arc(0, 0, r * 0.22, Math.PI * 1.25, -0.4, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.5, r * 0.06);
        for (let a = 0.2; a < 3.0; a += 0.8) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.26, Math.sin(a) * r * 0.26);
          ctx.lineTo(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58);
          ctx.stroke();
        }
        break;
      }

      case 'sausage': {
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = item.rim;
        ctx.lineWidth = Math.max(1.8, r * 0.08);
        if (!sliced) {
          rr(ctx, -r * 0.78, -r * 0.36, r * 1.56, r * 0.72, r * 0.35);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = item.inner;
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(i * r * 0.32 - r * 0.08, -r * 0.24);
            ctx.lineTo(i * r * 0.32 + r * 0.08, r * 0.24);
            ctx.stroke();
          }
        } else {
          ell(ctx, 0, 0, r * 0.72, r * 0.54, 0.25);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = item.inner;
          ell(ctx, 0, 0, r * 0.52, r * 0.36, 0.25);
          ctx.fill();
        }
        break;
      }

      case 'leaf': {
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = item.rim;
        ctx.lineWidth = Math.max(1.5, r * 0.07);
        for (let k = 0; k < 6; k++) {
          const a = (k * PI2) / 6;
          circ(ctx, Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.28, r * 0.42);
          ctx.fill();
        }
        ctx.strokeStyle = item.inner;
        ctx.lineWidth = Math.max(2, r * 0.08);
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, r * 0.25);
        ctx.quadraticCurveTo(0, 0, r * 0.45, -r * 0.25);
        ctx.stroke();
        break;
      }

      case 'choco': {
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = item.rim;
        ctx.lineWidth = Math.max(1.8, r * 0.08);
        rr(ctx, -r * 0.72, -r * 0.58, r * 1.44, r * 1.16, r * 0.14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = item.inner;
        for (const sx of [-0.34, 0.06]) {
          for (const sy of [-0.26, 0.06]) {
            rr(ctx, sx * r, sy * r, r * 0.28, r * 0.22, r * 0.04);
            ctx.fill();
          }
        }
        break;
      }

      case 'boba': {
        for (const [bx, by] of [[-0.28, -0.18], [0.26, -0.2], [-0.05, 0.24], [0.3, 0.22], [-0.32, 0.2]]) {
          ctx.fillStyle = baseCol;
          circ(ctx, bx * r, by * r, r * 0.26);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          circ(ctx, (bx - 0.08) * r, (by - 0.08) * r, r * 0.08);
          ctx.fill();
        }
        break;
      }

      case 'scoop': {
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = item.rim;
        ctx.lineWidth = Math.max(1.8, r * 0.08);
        circ(ctx, 0, -r * 0.06, r * 0.68);
        ctx.fill();
        ctx.stroke();
        for (const sx of [-0.45, 0, 0.45]) {
          circ(ctx, sx * r, r * 0.36, r * 0.28);
          ctx.fill();
        }
        ctx.fillStyle = item.inner;
        ell(ctx, -r * 0.2, -r * 0.25, r * 0.22, r * 0.14, -0.3);
        ctx.fill();
        break;
      }

      case 'sparkle': {
        const cols = ['#ff5c9e', '#5ce1ff', '#ffe047', '#b86bff'];
        for (let i = 0; i < 4; i++) {
          const a = i * 1.57 + 0.4;
          ctx.fillStyle = cols[i];
          star(ctx, Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.32, r * 0.32, r * 0.14, 5, a);
          ctx.fill();
        }
        break;
      }

      default: {
        // Liquid droplet swirl for milk & honey
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = item.rim || '#ffffff';
        ctx.lineWidth = Math.max(2, r * 0.09);
        circ(ctx, 0, 0, r * 0.76);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = item.inner || '#ffffff';
        circ(ctx, -r * 0.18, -r * 0.18, r * 0.28);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }

  /* ==========================================================================
   * 2. Plated Dish / Cup / Burger / Cake Composite Renderer
   * ========================================================================== */
  function drawDish(ctx, dish, cx, cy, scale, t) {
    scale = scale || 1;
    t = t || 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const isCup = dish.vessel === 'cup';
    const bites = dish.bitesTaken || 0;

    // 1. ALWAYS draw the Porcelain Dinner Plate or Glass Cup exterior FIRST (unclipped by bites!)
    if (isCup) {
      ctx.fillStyle = 'rgba(40,25,15,0.16)';
      ell(ctx, 0, 92, 68, 18);
      ctx.fill();

      ctx.fillStyle = 'rgba(240, 250, 255, 0.55)';
      ctx.beginPath();
      ctx.moveTo(-64, -60);
      ctx.lineTo(-49, 83);
      ctx.quadraticCurveTo(0, 98, 49, 83);
      ctx.lineTo(64, -60);
      ctx.closePath();
      ctx.fill();
    } else {
      // Porcelain Scalloped Dinner Plate (never clipped by food bites!)
      ctx.fillStyle = 'rgba(45,25,15,0.18)';
      ell(ctx, 0, 18, 142, 98);
      ctx.fill();

      ctx.fillStyle = '#fffdf9';
      ctx.strokeStyle = '#ffadc8';
      ctx.lineWidth = 5.5;
      ell(ctx, 0, 8, 138, 94);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#ffe0ec';
      ctx.lineWidth = 2.5;
      ell(ctx, 0, 8, 108, 72);
      ctx.stroke();

      // Cute crumb specs left on the plate when bites are taken!
      if (bites > 0) {
        ctx.fillStyle = '#e09b3d';
        [[58, -14, 3.5], [72, -6, 2.5], [-52, -18, 3], [38, 32, 3]].slice(0, bites + 1).forEach(([kx, ky, kr]) => {
          circ(ctx, kx, ky, kr);
          ctx.fill();
        });
      }
    }

    // 2. Apply Non-Overlapping Bite Clipping ONLY to the edible food inside the plate!
    ctx.save();
    if (bites > 0 && !isCup) {
      ctx.beginPath();
      ctx.rect(-220, -220, 440, 440);
      const biteArcs = [
        [74, -12, 42],
        [-74, -14, 42],
        [34, 52, 44],
        [-34, 48, 44],
      ];
      for (let b = 0; b < Math.min(bites, 4); b++) {
        const [bx, by, br] = biteArcs[b];
        ctx.moveTo(bx + br, by);
        ctx.arc(bx, by, br, 0, PI2, true);
      }
      ctx.clip('evenodd');
    }

    if (isCup) {
      // Liquid level drops as the Critter sips through the straw!
      const sipDrop = Math.min(0.75, bites * 0.24);
      const topY = -55 + sipDrop * 120;
      const liqColor = dish.liquidColor || '#ff9ebb';
      const grad = ctx.createLinearGradient(0, topY, 0, 85);
      grad.addColorStop(0, lerpColor(liqColor, '#ffffff', 0.28));
      grad.addColorStop(1, liqColor);
      ctx.fillStyle = grad;
      const topW = 62 - sipDrop * 12;
      ctx.beginPath();
      ctx.moveTo(-topW, topY);
      ctx.lineTo(-48, 82);
      ctx.quadraticCurveTo(0, 96, 48, 82);
      ctx.lineTo(topW, topY);
      ctx.closePath();
      ctx.fill();

      // Boba pearls at bottom if present
      const hasBoba = dish.items.some(it => it.id === 'boba');
      if (hasBoba) {
        ctx.fillStyle = '#2e160d';
        [[-32, 68], [-16, 74], [0, 70], [18, 75], [32, 67], [-24, 54], [-6, 58], [14, 56], [28, 53]].forEach(([px, py]) => {
          circ(ctx, px, py, 8.5);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          circ(ctx, px - 2.5, py - 2.5, 2.5);
          ctx.fill();
          ctx.fillStyle = '#2e160d';
        });
      }
    } else {
      // Check if we have a pancake stack, baked cake, burger bun, or pizza base
      const hasBurger = dish.items.some(it => it.id === 'bun');
      const hasPizza = dish.items.some(it => it.id === 'pizzabase');
      const hasPancake = dish.items.some(it => it.id === 'dough') && !dish.bakedCake;

      if (dish.bakedCake) {
        // Fluffy 2-tier sponge cake
        const cakeCol = dish.liquidColor || '#f5b352';
        const topCol = lerpColor(cakeCol, '#fff5d6', 0.35);
        ctx.fillStyle = lerpColor(cakeCol, '#b86b14', 0.25);
        rr(ctx, -88, -18, 176, 58, 22);
        ctx.fill();
        ctx.fillStyle = topCol;
        ell(ctx, 0, -18, 88, 28);
        ctx.fill();
        ctx.fillStyle = cakeCol;
        rr(ctx, -68, -54, 136, 46, 18);
        ctx.fill();
        ctx.fillStyle = '#fff8e8';
        ell(ctx, 0, -54, 68, 22);
        ctx.fill();
      } else if (hasPancake) {
        // 3-Layer Fluffy Golden Pancake Stack with Melting Butter Pat!
        for (let layer = 0; layer < 3; layer++) {
          const ly = 14 - layer * 14;
          ctx.fillStyle = '#c97a26';
          ell(ctx, 0, ly + 5, 84 - layer * 3, 52 - layer * 2);
          ctx.fill();
          ctx.fillStyle = '#f2a949';
          ell(ctx, 0, ly, 84 - layer * 3, 52 - layer * 2);
          ctx.fill();
          ctx.fillStyle = '#ffd984';
          ell(ctx, 0, ly - 2, 74 - layer * 3, 44 - layer * 2);
          ctx.fill();
        }
        // Golden butter square on top
        ctx.fillStyle = '#fff078';
        ctx.strokeStyle = '#e0b822';
        ctx.lineWidth = 2;
        rr(ctx, -16, -26, 32, 20, 5);
        ctx.fill();
        ctx.stroke();
      } else if (hasBurger) {
        // Bottom Burger Bun + Crisp Lettuce Frill
        ctx.fillStyle = '#d98829';
        ell(ctx, 0, 18, 84, 52);
        ctx.fill();
        ctx.fillStyle = '#52d452';
        for (let k = 0; k < 10; k++) {
          const a = (k * PI2) / 10;
          circ(ctx, Math.cos(a) * 68, 8 + Math.sin(a) * 38, 18);
          ctx.fill();
        }
      } else if (hasPizza) {
        // Hand-stretched Golden Pizza Crust + Melted Mozzarella & Tomato Sauce
        ctx.fillStyle = '#e39636';
        ctx.strokeStyle = '#b56c14';
        ctx.lineWidth = 3;
        ell(ctx, 0, 4, 96, 66);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ff3b26';
        ell(ctx, 0, 4, 80, 54);
        ctx.fill();
        ctx.fillStyle = '#ffe875';
        ell(ctx, 0, 4, 72, 48);
        ctx.fill();
      }
    }

    // Placed / cooked ingredients on dish
    dish.items.forEach(it => {
      if (isCup && (it.id === 'milk' || it.id === 'boba' || it.id === 'dough')) return;
      if (!isCup && (it.id === 'dough' || it.id === 'pizzabase')) return;
      drawIngredient(ctx, it.id, it.x || 0, it.y || 0, it.r || 32, {
        sliced: it.sliced,
        cooked: it.cooked,
        cracked: it.cracked,
        rot: it.rot || 0,
      });
    });

    // Freehand Sauce Drizzles
    (dish.sauces || []).forEach(stroke => {
      if (!stroke.pts || stroke.pts.length < 2) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
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
      ctx.stroke();
      ctx.restore();
    });

    // Freehand 3D Whipped Cream Piping Rosettes
    (dish.piping || []).forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.shadow || '#d9c8b8';
      circ(ctx, 0, 3, p.r || 15);
      ctx.fill();
      ctx.fillStyle = p.color || '#ffffff';
      circ(ctx, 0, 0, (p.r || 15) * 0.92);
      ctx.fill();
      ctx.strokeStyle = p.shadow || '#d9c8b8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, (p.r || 15) * 0.55, 0.3, 4.2);
      ctx.stroke();
      ctx.fillStyle = p.hi || '#ffffff';
      circ(ctx, -3, -4, (p.r || 15) * 0.32);
      ctx.fill();
      ctx.restore();
    });

    // Decorative Toppings (Sprinkles, Stars, Hearts, Candles, Umbrellas)
    (dish.toppings || []).forEach(tp => {
      ctx.save();
      ctx.translate(tp.x, tp.y);
      if (tp.id === 'sprinkles') {
        const cols = ['#ff4d79', '#ffcf33', '#4dd2ff', '#66e066', '#b366ff'];
        for (let k = 0; k < 5; k++) {
          ctx.save();
          ctx.translate(Math.cos(k * 1.3 + tp.seed) * 14, Math.sin(k * 1.7 + tp.seed) * 10);
          ctx.rotate(k * 0.9 + tp.seed);
          ctx.fillStyle = cols[k % cols.length];
          rr(ctx, -6, -2.5, 12, 5, 2.5);
          ctx.fill();
          ctx.restore();
        }
      } else if (tp.id === 'stars') {
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#d49b00';
        ctx.lineWidth = 1.5;
        star(ctx, 0, 0, 12, 5.5, 5, tp.seed);
        ctx.fill();
        ctx.stroke();
      } else if (tp.id === 'hearts') {
        ctx.fillStyle = '#ff4d88';
        heart(ctx, 0, 0, 12);
        ctx.fill();
      } else if (tp.id === 'candle') {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ff5c8a';
        ctx.lineWidth = 2;
        rr(ctx, -6, -28, 12, 32, 3);
        ctx.fill();
        ctx.stroke();
        if (!tp.blownOut) {
          const flick = Math.sin(t * 14 + (tp.seed || 0)) * 2.5;
          ctx.fillStyle = '#ff9900';
          ctx.beginPath();
          ctx.moveTo(0, -46 + flick);
          ctx.quadraticCurveTo(9, -34, 0, -28);
          ctx.quadraticCurveTo(-9, -34, 0, -46 + flick);
          ctx.fill();
          ctx.fillStyle = '#fff599';
          circ(ctx, 0, -34, 3.5);
          ctx.fill();
        }
      } else {
        const meta = KitchenData.TOPPINGS.find(x => x.id === tp.id);
        ctx.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(meta ? meta.emoji : '🍓', 0, 0);
      }
      ctx.restore();
    });

    ctx.restore(); // End of food bite-clipping region

    // If Cup, draw straw & glass rim on top!
    if (isCup) {
      ctx.save();
      ctx.translate(22, -75);
      ctx.rotate(0.18);
      ctx.fillStyle = '#ff5988';
      rr(ctx, -7, -65, 14, 115, 5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let sy = -55; sy < 40; sy += 18) {
        ctx.fillRect(-7, sy, 14, 7);
      }
      ctx.restore();

      ctx.strokeStyle = 'rgba(255,255,255,0.88)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-64, -60);
      ctx.lineTo(-49, 83);
      ctx.quadraticCurveTo(0, 98, 49, 83);
      ctx.lineTo(64, -60);
      ctx.stroke();
      ell(ctx, 0, -60, 64, 14);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ==========================================================================
   * 3. Animated 2D Storybook Critter Customer & 8 Reaction Transformations
   * ========================================================================== */
  function drawCritterCustomer(ctx, critter, cx, cy, scale, state, t) {
    scale = scale || 1;
    state = state || {};
    const rxn = state.reaction || null;
    const mouthOpen = Math.max(0, Math.min(1, state.mouthOpen || 0));
    const chewing = state.chewing || 0;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Reaction movement offsets
    let bobY = Math.sin(t * 3.2) * 3;
    let shakeX = 0;
    if (rxn === 'float') {
      bobY = -28 + Math.sin(t * 4.5) * 8;
    } else if (rxn === 'ice') {
      shakeX = Math.sin(t * 48) * 3.5;
    } else if (rxn === 'love' || rxn === 'rainbow') {
      bobY = -Math.abs(Math.sin(t * 7)) * 12;
    }
    ctx.translate(shakeX, bobY);

    // Rainbow halo if rainbow reaction
    if (rxn === 'rainbow') {
      const cols = ['#ff4d6d', '#ff9e00', '#ffea00', '#38d968', '#38b6ff', '#9d4edd'];
      for (let i = 0; i < cols.length; i++) {
        ctx.strokeStyle = cols[i];
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 10, 92 - i * 5, Math.PI, 0);
        ctx.stroke();
      }
    }

    // Floating balloons if 'float' reaction
    if (rxn === 'float') {
      [[-48, -95, '#ff5c8a'], [48, -100, '#4dd2ff']].forEach(([bx, by, bcol]) => {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bx * 0.4, -20);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.fillStyle = bcol;
        ell(ctx, bx, by - 14, 16, 20);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        circ(ctx, bx - 5, by - 20, 4);
        ctx.fill();
      });
    }

    let bodyCol = critter.color;
    if (rxn === 'fire') bodyCol = '#ff3b3b';
    else if (rxn === 'ice') bodyCol = '#7ce0ff';
    else if (rxn === 'rainbow') {
      const h = (t * 140) % 360;
      bodyCol = `hsl(${h}, 85%, 68%)`;
    }

    // Ears
    const wig = Math.sin(t * 4) * 0.08;
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = '#3a2347';
    ctx.lineWidth = 3.5;
    if (critter.earType === 'bunny') {
      for (let s of [-1, 1]) {
        ctx.save();
        ctx.rotate(s * (0.14 + wig));
        ell(ctx, s * 28, -74, 13, 36);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffc2d9';
        ell(ctx, s * 28, -72, 6.5, 24);
        ctx.fill();
        ctx.fillStyle = bodyCol;
        ctx.restore();
      }
    } else if (critter.earType === 'unicorn') {
      for (let s of [-1, 1]) {
        ell(ctx, s * 36, -48, 12, 18, s * 0.35);
        ctx.fill();
        ctx.stroke();
      }
      // Golden unicorn horn
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(-11, -52);
      ctx.lineTo(0, -96);
      ctx.lineTo(11, -52);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      for (let s of [-1, 1]) {
        circ(ctx, s * 40, -45, 18);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffb8d0';
        circ(ctx, s * 40, -45, 9);
        ctx.fill();
        ctx.fillStyle = bodyCol;
      }
    }

    // Torso & Bib
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = '#3a2347';
    ctx.lineWidth = 3.5;
    ell(ctx, 0, 48, 54, 42);
    ctx.fill();
    ctx.stroke();

    // Cute white dining bib with portrait medallion
    ctx.fillStyle = '#ffffff';
    ell(ctx, 0, 44, 34, 26);
    ctx.fill();
    ctx.stroke();
    const port = portraits[critter.id];
    if (port) {
      ctx.save();
      circ(ctx, 0, 46, 17);
      ctx.clip();
      ctx.drawImage(port, -17, 29, 34, 34);
      ctx.restore();
    }

    // Head
    const cheekPuff = chewing > 0 ? Math.abs(Math.sin(t * 16)) * 7 : 0;
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = '#3a2347';
    ctx.lineWidth = 3.5;
    ell(ctx, 0, -10, 56 + cheekPuff, 48);
    ctx.fill();
    ctx.stroke();

    // Rosy cheeks
    ctx.fillStyle = rxn === 'fire' ? '#ff0000' : 'rgba(255,105,155,0.55)';
    ell(ctx, -34, -2, 11 + cheekPuff * 0.4, 7);
    ctx.fill();
    ell(ctx, 34, -2, 11 + cheekPuff * 0.4, 7);
    ctx.fill();

    // Eyes
    if (rxn === 'sleepy') {
      // Closed peaceful sleeping eyes
      ctx.strokeStyle = '#2d1938';
      ctx.lineWidth = 3.2;
      for (let s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 20, -16, 10, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
      // Expanding blue sleep bubble!
      const bRad = 12 + Math.sin(t * 2.5) * 5;
      ctx.fillStyle = 'rgba(135, 220, 255, 0.72)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      circ(ctx, 26, -6, bRad);
      ctx.fill();
      ctx.stroke();
    } else if (rxn === 'sour') {
      // Tightly squeezed >< sour eyes!
      ctx.strokeStyle = '#2d1938';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-28, -23); ctx.lineTo(-14, -16); ctx.lineTo(-28, -9);
      ctx.moveTo(28, -23);  ctx.lineTo(14, -16);  ctx.lineTo(28, -9);
      ctx.stroke();
    } else if (rxn === 'love') {
      // Sparkling golden star eyes!
      for (let s of [-1, 1]) {
        ctx.fillStyle = '#2d1938';
        circ(ctx, s * 20, -16, 11);
        ctx.fill();
        ctx.fillStyle = '#ffd700';
        star(ctx, s * 20, -16, 9, 4, 5, t * 2);
        ctx.fill();
      }
    } else {
      // Expressive blinking eyes tracking food
      const blink = Math.sin(t * 1.7) > 0.97;
      for (let s of [-1, 1]) {
        if (blink) {
          ctx.strokeStyle = '#2d1938';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(s * 20 - 9, -16);
          ctx.lineTo(s * 20 + 9, -16);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#ffffff';
          circ(ctx, s * 20, -16, 11);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#241433';
          circ(ctx, s * 20 + (state.lookX || 0) * 3, -16 + (state.lookY || 0) * 3, 6.5);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          circ(ctx, s * 20 - 2.5, -19, 2.8);
          ctx.fill();
        }
      }
    }

    // Mouth & Reaction Expressions
    if (rxn === 'fire') {
      // Breathing cartoon fire cone!
      ctx.fillStyle = '#3d0c11';
      ell(ctx, 0, 8, 18, 15);
      ctx.fill();
      const fl = 45 + Math.sin(t * 24) * 12;
      ctx.fillStyle = '#ff4800';
      ctx.beginPath();
      ctx.moveTo(-10, 8);
      ctx.lineTo(-28, 22 + fl);
      ctx.lineTo(0, 14 + fl * 0.8);
      ctx.lineTo(28, 22 + fl);
      ctx.lineTo(10, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();
      ctx.moveTo(-6, 8);
      ctx.lineTo(0, 12 + fl * 0.65);
      ctx.lineTo(6, 8);
      ctx.closePath();
      ctx.fill();
    } else if (rxn === 'sour') {
      // Puckered lemon mouth
      ctx.strokeStyle = '#2d1938';
      ctx.lineWidth = 2.8;
      star(ctx, 0, 6, 8, 3, 6, t);
      ctx.stroke();
    } else if (mouthOpen > 0.08) {
      // Wide open "Ahhh!" mouth waiting for fork/spoon
      const mh = 8 + mouthOpen * 22;
      const mw = 14 + mouthOpen * 14;
      ctx.fillStyle = '#591527';
      ctx.strokeStyle = '#2d1938';
      ctx.lineWidth = 3;
      ell(ctx, 0, 8, mw, mh);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff7597';
      ell(ctx, 0, 8 + mh * 0.35, mw * 0.65, mh * 0.45);
      ctx.fill();
    } else {
      // Happy cat/critter smile (or chewing)
      const chY = chewing > 0 ? Math.sin(t * 18) * 3 : 0;
      ctx.strokeStyle = '#2d1938';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-7, 4 + chY, 7, 0.1, Math.PI - 0.1);
      ctx.arc(7, 4 + chY, 7, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }

    // Burnt soot smudges & smoke cloud
    if (rxn === 'burnt') {
      ctx.fillStyle = 'rgba(35,30,28,0.55)';
      circ(ctx, -22, 2, 10);
      ctx.fill();
      circ(ctx, 18, -6, 8);
      ctx.fill();
      const puffY = -45 - ((t * 35) % 40);
      ctx.fillStyle = 'rgba(70,65,62,0.68)';
      circ(ctx, 0, puffY, 16);
      ctx.fill();
      circ(ctx, -12, puffY + 6, 12);
      ctx.fill();
      circ(ctx, 12, puffY + 6, 12);
      ctx.fill();
    }

    // Ice crystal crown if ice reaction
    if (rxn === 'ice') {
      ctx.fillStyle = 'rgba(180,245,255,0.85)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        star(ctx, i * 18, -62 - (2 - Math.abs(i)) * 6, 11, 4, 4, t);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Paws resting on table holding fork & knife
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = '#3a2347';
    ctx.lineWidth = 3;
    const pawBob = chewing > 0 || rxn === 'love' ? Math.sin(t * 12) * 6 : 0;
    circ(ctx, -56, 48 + pawBob, 14);
    ctx.fill();
    ctx.stroke();
    circ(ctx, 56, 48 - pawBob, 14);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  return {
    loadPortraits,
    portraits,
    rr,
    circ,
    ell,
    star,
    heart,
    lerpColor,
    drawIngredient,
    drawDish,
    drawCritterCustomer,
  };
})();
