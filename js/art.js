'use strict';
/* ==========================================================================
 * Chuyu's Rainbow Kitchen — Pinterest Cozy Patisserie Art & Animation Engine
 * 100% Custom Gouache/Storybook Vector Illustrations (All 24 Botanical
 * Ingredients + 8 Custom-Sculpted Plush Patisserie Chefs + 20 Utensil Icons)
 * ========================================================================== */
const KitchenArt = (() => {
  const portraits = {};
  const PI2 = Math.PI * 2;
  const OUTLINE = '#5C3D2E'; // Warm cocoa-brown pencil outline

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

  function lerpColor(hexA, hexB, t) {
    t = Math.max(0, Math.min(1, t));
    const a = parseInt((hexA || '#ffffff').replace('#', ''), 16);
    const b = parseInt((hexB || '#ffffff').replace('#', ''), 16);
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
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
        ctx.rotate(-0.55);
        ctx.fillStyle = 'rgba(92, 61, 46, 0.16)';
        rr(ctx, -r * 0.9, -r * 0.18 + 3, r * 1.8, r * 0.48, r * 0.14);
        ctx.fill();
        const bg = ctx.createLinearGradient(-r * 0.95, -r * 0.3, r * 0.25, r * 0.35);
        bg.addColorStop(0, '#FFFFFF');
        bg.addColorStop(0.55, '#EBF1F5');
        bg.addColorStop(1, '#C5D3DC');
        ctx.fillStyle = bg;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ctx.beginPath();
        ctx.moveTo(r * 0.15, -r * 0.26);
        ctx.lineTo(-r * 0.55, -r * 0.26);
        ctx.quadraticCurveTo(-r * 0.95, -r * 0.22, -r * 0.98, r * 0.22);
        ctx.lineTo(r * 0.15, r * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#D3DFE6';
        for (let i = 0; i < 4; i++) {
          ell(ctx, -r * 0.62 + i * r * 0.19, r * 0.06, r * 0.045, r * 0.08);
          ctx.fill();
        }
        ctx.fillStyle = '#C87D4B';
        rr(ctx, r * 0.12, -r * 0.22, r * 0.78, r * 0.34, r * 0.12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F5D076';
        circ(ctx, r * 0.36, -r * 0.05, r * 0.055);
        ctx.fill();
        circ(ctx, r * 0.64, -r * 0.05, r * 0.055);
        ctx.fill();
        break;
      }

      case 'bowl': {
        ctx.fillStyle = 'rgba(92, 61, 46, 0.15)';
        ell(ctx, 0, r * 0.55, r * 0.78, r * 0.22);
        ctx.fill();
        ctx.save();
        ctx.translate(r * 0.28, -r * 0.28);
        ctx.rotate(0.48);
        ctx.strokeStyle = '#9EABB3';
        ctx.lineWidth = Math.max(1.5, r * 0.07);
        ell(ctx, 0, -r * 0.12, r * 0.22, r * 0.34);
        ctx.stroke();
        ell(ctx, 0, -r * 0.12, r * 0.1, r * 0.34);
        ctx.stroke();
        ctx.fillStyle = '#D48C56';
        ctx.strokeStyle = OUTLINE;
        rr(ctx, -r * 0.09, -r * 0.72, r * 0.18, r * 0.42, r * 0.08);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#9CC5B5';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ctx.beginPath();
        ctx.arc(0, -r * 0.04, r * 0.78, 0, Math.PI);
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
        ctx.fillStyle = '#C87D4B';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1.8, r * 0.09);
        ctx.save();
        ctx.translate(r * 0.58, -r * 0.26);
        ctx.rotate(-0.38);
        rr(ctx, -r * 0.1, -r * 0.12, r * 0.62, r * 0.24, r * 0.1);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#E07A5F';
        ell(ctx, -r * 0.1, r * 0.06, r * 0.74, r * 0.54);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#4A403B';
        ell(ctx, -r * 0.1, r * 0.04, r * 0.62, r * 0.44);
        ctx.fill();
        ctx.fillStyle = '#FFFDF7';
        ell(ctx, -r * 0.12, r * 0.04, r * 0.38, r * 0.28, 0.2);
        ctx.fill();
        ctx.fillStyle = '#F4A236';
        circ(ctx, -r * 0.1, r * 0.02, r * 0.16);
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
        ctx.arc(0, -r * 0.36, r * 0.5, Math.PI, 0);
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
        ctx.arc(0, 0, r * 0.56, 0.5, Math.PI * 1.75);
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
        ctx.arc(0, 0, r * 0.6, Math.PI, 0);
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
      ctx.lineTo(fx + 31, 28 + Math.sin(t * 2.2 + i) * 2);
      ctx.closePath();
      ctx.fill();
    }

    // Right Patisserie Shelf & Copper Pans
    const shX = W - 255, shY = 104, shW = 216;
    ctx.strokeStyle = '#B8927A';
    ctx.lineWidth = 2.5;
    [shX + 42, shX + 106, shX + 170].forEach((px, idx) => {
      ctx.beginPath();
      ctx.moveTo(px, shY + 10);
      ctx.lineTo(px, shY + 32);
      ctx.stroke();
      ctx.fillStyle = idx === 1 ? '#9CC5B5' : '#D9825B';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      circ(ctx, px, shY + 44, 15);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      circ(ctx, px - 4, shY + 40, 4);
      ctx.fill();
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
    circ(ctx, shX + 178, shY - 28, 9);
    ctx.fill();
    circ(ctx, shX + 190, shY - 26, 8);
    ctx.fill();

    // Warm Cream Marble & Oak Countertop
    const counterY = H * 0.45;
    const counterGrad = ctx.createLinearGradient(0, counterY, 0, H);
    counterGrad.addColorStop(0, '#FFFDF9');
    counterGrad.addColorStop(0.1, '#FAF1E4');
    counterGrad.addColorStop(1, '#EFE0CC');
    ctx.fillStyle = counterGrad;
    ctx.fillRect(0, counterY, W, H - counterY);

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
   * 3. Complete 24-Item Botanical Ingredient & Cross-Section Slice Renderer
   * ========================================================================== */
  function drawIngredient(ctx, id, x, y, r, opts) {
    opts = opts || {};
    const item = KitchenData.getIngredient(id);
    const sliced = !!opts.sliced;
    const cooked = opts.cooked || 0;
    const burnt = cooked > 1.08;

    ctx.save();
    ctx.translate(x, y);
    if (opts.rot) ctx.rotate(opts.rot);
    if (opts.scaleX || opts.scaleY) {
      ctx.scale(opts.scaleX || 1, opts.scaleY || 1);
    }

    if (opts.shadow !== false) {
      ctx.fillStyle = 'rgba(92, 61, 46, 0.15)';
      ell(ctx, 2, r * 0.2, r * 0.86, r * 0.68);
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
          ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
          ell(ctx, -r * 0.28, -r * 0.15, r * 0.14, r * 0.28, -0.25);
          ctx.fill();
          ctx.fillStyle = '#FFE699';
          [[-0.32, -0.1], [0.32, -0.1], [0, 0.08], [-0.22, 0.34], [0.22, 0.34], [0, 0.54]].forEach(([sx, sy]) => {
            ell(ctx, sx * r, sy * r, r * 0.055, r * 0.085);
            ctx.fill();
          });
          ctx.fillStyle = '#68B878';
          for (let i = -2; i <= 2; i++) {
            ell(ctx, i * r * 0.2, -r * 0.6, r * 0.22, r * 0.11, i * 0.3);
            ctx.fill();
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = baseCol;
          circ(ctx, 0, 0, r * 0.78);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFD6E0';
          circ(ctx, 0, 0, r * 0.52);
          ctx.fill();
          ctx.fillStyle = '#FFF9FB';
          heart(ctx, 0, 0, r * 0.28);
          ctx.fill();
        }
        break;
      }

      case 'kiwi': {
        ctx.fillStyle = sliced ? '#88C968' : '#A6784E';
        circ(ctx, 0, 0, r * 0.8);
        ctx.fill();
        ctx.stroke();
        if (sliced) {
          ctx.fillStyle = '#E6F7D4';
          circ(ctx, 0, 0, r * 0.34);
          ctx.fill();
          ctx.fillStyle = OUTLINE;
          for (let k = 0; k < 10; k++) {
            const a = (k * PI2) / 10;
            ell(ctx, Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46, r * 0.05, r * 0.03, a);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = '#88C968';
          circ(ctx, r * 0.16, -r * 0.14, r * 0.42);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#E6F7D4';
          circ(ctx, r * 0.16, -r * 0.14, r * 0.16);
          ctx.fill();
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
        } else {
          ctx.fillStyle = '#FFF9DC';
          circ(ctx, 0, 0, r * 0.72);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#D9B24C';
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

      case 'berry': {
        // Plump Blueberry with 5-point crown calyx & frosty highlight
        ctx.fillStyle = '#5C6BC0';
        circ(ctx, 0, r * 0.04, r * 0.74);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#3949AB';
        star(ctx, 0, -r * 0.28, r * 0.28, r * 0.12, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ell(ctx, -r * 0.26, -r * 0.05, r * 0.14, r * 0.24, -0.3);
        ctx.fill();
        break;
      }

      case 'peach': {
        // Blush Pink Cleft Peach with Mint Leaf
        ctx.fillStyle = '#F7A1B0';
        circ(ctx, 0, r * 0.06, r * 0.76);
        ctx.fill();
        ctx.stroke();
        // Peach cleft curve
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.68);
        ctx.quadraticCurveTo(r * 0.22, 0, 0, r * 0.78);
        ctx.stroke();
        // Mint green leaf
        ctx.fillStyle = '#78C47C';
        ell(ctx, r * 0.26, -r * 0.66, r * 0.28, r * 0.13, 0.35);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        circ(ctx, -r * 0.28, -r * 0.12, r * 0.15);
        ctx.fill();
        break;
      }

      case 'citrus':
      case 'tomato': {
        const isTom = item.sliceStyle === 'tomato';
        ctx.fillStyle = baseCol;
        if (!sliced && !isTom) {
          // Pointed oval Meyer Lemon with green leaf
          ell(ctx, 0, r * 0.04, r * 0.84, r * 0.64, -0.2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#78C47C';
          ell(ctx, r * 0.22, -r * 0.58, r * 0.26, r * 0.12, 0.4);
          ctx.fill();
          ctx.stroke();
        } else {
          circ(ctx, 0, 0, r * 0.8);
          ctx.fill();
          ctx.stroke();
          if (sliced) {
            ctx.fillStyle = item.inner;
            const n = isTom ? 4 : 6;
            for (let k = 0; k < n; k++) {
              const a1 = (k * PI2) / n + 0.12;
              const a2 = ((k + 1) * PI2) / n - 0.12;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.arc(0, 0, r * 0.62, a1, a2);
              ctx.closePath();
              ctx.fill();
            }
          } else if (isTom) {
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
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          ell(ctx, -r * 0.2, -r * 0.26, r * 0.15, r * 0.26, -0.3);
          ctx.fill();
        } else {
          ctx.fillStyle = burnt ? '#4A372D' : '#FFFDF8';
          ctx.beginPath();
          for (let k = 0; k < 12; k++) {
            const a = (k * PI2) / 12;
            const rad = r * (0.78 + 0.09 * Math.sin(k * 2.3 + 1));
            if (k === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
            else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = burnt ? '#6E4219' : '#F59E2D';
          circ(ctx, r * 0.04, -r * 0.04, r * 0.38);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          circ(ctx, -r * 0.08, -r * 0.16, r * 0.11);
          ctx.fill();
          if (!cooked && opts.showShell) {
            for (const s of [-1, 1]) {
              ctx.save();
              ctx.translate(s * r * 0.58, -r * 0.62);
              ctx.rotate(s * 0.42);
              ctx.fillStyle = '#F7E6D0';
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
        ctx.fillStyle = baseCol;
        ell(ctx, 0, 0, r * 0.88, r * 0.68);
        ctx.fill();
        ctx.stroke();
        if (cooked < 0.35) {
          ctx.strokeStyle = '#FFE8E8';
          ctx.lineWidth = Math.max(1.8, r * 0.07);
          ctx.beginPath();
          ctx.moveTo(-r * 0.48, -r * 0.15);
          ctx.quadraticCurveTo(0, r * 0.1, r * 0.48, -r * 0.18);
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#4A2818';
          ctx.lineWidth = Math.max(2, r * 0.09);
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(i * r * 0.3 - r * 0.14, -r * 0.38);
            ctx.lineTo(i * r * 0.3 + r * 0.14, r * 0.38);
            ctx.stroke();
          }
        }
        break;
      }

      case 'cheese': {
        ctx.fillStyle = baseCol;
        rr(ctx, -r * 0.76, -r * 0.7, r * 1.52, r * 1.4, r * (cooked > 0.3 ? 0.42 : 0.2));
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E09824';
        [[-0.3, -0.24, 0.15], [0.26, -0.18, 0.11], [-0.1, 0.26, 0.17]].forEach(([hx, hy, hr]) => {
          circ(ctx, hx * r, hy * r, hr * r);
          ctx.fill();
        });
        break;
      }

      case 'bacon': {
        ctx.fillStyle = baseCol;
        rr(ctx, -r * 0.85, -r * 0.42, r * 1.7, r * 0.84, r * 0.25);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#FFDCE0';
        ctx.lineWidth = Math.max(2, r * 0.12);
        for (let s of [-0.16, 0.16]) {
          ctx.beginPath();
          ctx.moveTo(-r * 0.65, s * r);
          ctx.bezierCurveTo(-r * 0.2, (s - 0.18) * r, r * 0.2, (s + 0.18) * r, r * 0.65, s * r);
          ctx.stroke();
        }
        break;
      }

      case 'shrimp': {
        ctx.fillStyle = baseCol;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.64, -0.4, Math.PI * 1.25);
        ctx.arc(0, 0, r * 0.22, Math.PI * 1.25, -0.4, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'sausage': {
        ctx.fillStyle = baseCol;
        rr(ctx, -r * 0.78, -r * 0.36, r * 1.56, r * 0.72, r * 0.35);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'dough':
      case 'bun':
      case 'pizza': {
        const isPizza = item.sliceStyle === 'pizza';
        ctx.fillStyle = baseCol;
        circ(ctx, 0, 0, r * (isPizza ? 0.86 : 0.8));
        ctx.fill();
        ctx.stroke();
        if (isPizza) {
          ctx.fillStyle = '#E35242';
          circ(ctx, 0, 0, r * 0.62);
          ctx.fill();
          ctx.fillStyle = '#FFEA8C';
          circ(ctx, -r * 0.18, -r * 0.12, r * 0.16);
          ctx.fill();
          circ(ctx, r * 0.2, r * 0.15, r * 0.14);
          ctx.fill();
        } else if (item.sliceStyle === 'bun') {
          ctx.fillStyle = '#FFF5CC';
          [[-0.28, -0.22], [0, -0.32], [0.28, -0.2], [-0.16, 0.08], [0.18, 0.08]].forEach(([sx, sy]) => {
            ell(ctx, sx * r, sy * r, r * 0.09, r * 0.05, sx);
            ctx.fill();
          });
        } else {
          ctx.strokeStyle = '#D9B26F';
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.42, 0, Math.PI * 1.3);
          ctx.stroke();
        }
        break;
      }

      case 'leaf': {
        ctx.fillStyle = baseCol;
        for (let k = 0; k < 6; k++) {
          const a = (k * PI2) / 6;
          circ(ctx, Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.28, r * 0.42);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = baseCol;
        ell(ctx, 0, 0, r * 0.52, r * 0.44);
        ctx.fill();
        break;
      }

      case 'chili': {
        ctx.fillStyle = baseCol;
        ctx.beginPath();
        ctx.moveTo(-r * 0.65, -r * 0.35);
        ctx.quadraticCurveTo(0, -r * 0.55, r * 0.78, r * 0.45);
        ctx.quadraticCurveTo(-r * 0.1, r * 0.55, -r * 0.65, -r * 0.35);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#52A858';
        ctx.lineWidth = Math.max(2.5, r * 0.12);
        ctx.beginPath();
        ctx.moveTo(-r * 0.62, -r * 0.32);
        ctx.lineTo(-r * 0.85, -r * 0.58);
        ctx.stroke();
        break;
      }

      case 'choco': {
        ctx.fillStyle = baseCol;
        rr(ctx, -r * 0.72, -r * 0.58, r * 1.44, r * 1.16, r * 0.16);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#9C5B3B';
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
        circ(ctx, 0, -r * 0.06, r * 0.66);
        ctx.fill();
        ctx.stroke();
        for (const sx of [-0.42, 0, 0.42]) {
          circ(ctx, sx * r, r * 0.36, r * 0.26);
          ctx.fill();
          ctx.stroke();
        }
        break;
      }

      case 'sparkle': {
        const cols = ['#E87A82', '#8FB9A8', '#F7C948', '#C4A8E0'];
        for (let i = 0; i < 4; i++) {
          const a = i * 1.57 + 0.4;
          ctx.fillStyle = cols[i];
          star(ctx, Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.32, r * 0.34, r * 0.15, 5, a);
          ctx.fill();
          ctx.stroke();
        }
        break;
      }

      default: {
        // Milk bottle / Honey jar
        if (id === 'milk') {
          ctx.fillStyle = '#FFFDF9';
          rr(ctx, -r * 0.48, -r * 0.35, r * 0.96, r * 1.05, r * 0.22);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#8FB9A8';
          rr(ctx, -r * 0.34, -r * 0.68, r * 0.68, r * 0.32, r * 0.1);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = baseCol;
          circ(ctx, 0, 0, r * 0.76);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
          ell(ctx, -r * 0.22, -r * 0.22, r * 0.24, r * 0.15, -0.4);
          ctx.fill();
        }
        break;
      }
    }

    ctx.restore();
  }

  /* ==========================================================================
   * 4. Plated Patisserie Dish / Boba Parfait Composite Renderer
   * ========================================================================== */
  function drawDish(ctx, dish, cx, cy, scale, t) {
    scale = scale || 1;
    t = t || 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const isCup = dish.vessel === 'cup';
    const bites = dish.bitesTaken || 0;

    if (isCup) {
      ctx.fillStyle = 'rgba(92, 61, 46, 0.16)';
      ell(ctx, 0, 92, 68, 18);
      ctx.fill();

      ctx.fillStyle = 'rgba(248, 252, 255, 0.65)';
      ctx.beginPath();
      ctx.moveTo(-64, -60);
      ctx.lineTo(-49, 83);
      ctx.quadraticCurveTo(0, 98, 49, 83);
      ctx.lineTo(64, -60);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(92, 61, 46, 0.16)';
      ell(ctx, 0, 20, 144, 98);
      ctx.fill();

      ctx.fillStyle = '#FFFDF9';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 4;
      ell(ctx, 0, 8, 138, 94);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#F2C6B8';
      ctx.lineWidth = 2.5;
      ell(ctx, 0, 8, 108, 72);
      ctx.stroke();

      if (bites > 0) {
        ctx.fillStyle = '#D9984A';
        [[58, -14, 3.5], [72, -6, 2.5], [-52, -18, 3], [38, 32, 3]].slice(0, bites + 1).forEach(([kx, ky, kr]) => {
          circ(ctx, kx, ky, kr);
          ctx.fill();
        });
      }
    }

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
      const sipDrop = Math.min(0.75, bites * 0.24);
      const topY = -55 + sipDrop * 120;
      const liqColor = dish.liquidColor || '#F4A6B8';
      const grad = ctx.createLinearGradient(0, topY, 0, 85);
      grad.addColorStop(0, lerpColor(liqColor, '#FFFFFF', 0.32));
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

      const hasBoba = dish.items.some(it => it.id === 'boba');
      if (hasBoba) {
        ctx.fillStyle = '#4A2A1C';
        [[-32, 68], [-16, 74], [0, 70], [18, 75], [32, 67], [-24, 54], [-6, 58], [14, 56], [28, 53]].forEach(([px, py]) => {
          circ(ctx, px, py, 8.5);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          circ(ctx, px - 2.5, py - 2.5, 2.5);
          ctx.fill();
          ctx.fillStyle = '#4A2A1C';
        });
      }
    } else {
      const hasBurger = dish.items.some(it => it.id === 'bun');
      const hasPizza = dish.items.some(it => it.id === 'pizzabase');
      const hasPancake = dish.items.some(it => it.id === 'dough') && !dish.bakedCake;

      if (dish.bakedCake) {
        const cakeCol = dish.liquidColor || '#F2B46D';
        const topCol = lerpColor(cakeCol, '#FFF7E4', 0.38);
        ctx.fillStyle = lerpColor(cakeCol, '#B8732A', 0.25);
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 3;
        rr(ctx, -88, -18, 176, 58, 22);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = topCol;
        ell(ctx, 0, -18, 88, 28);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = cakeCol;
        rr(ctx, -68, -54, 136, 46, 18);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFF9EE';
        ell(ctx, 0, -54, 68, 22);
        ctx.fill();
        ctx.stroke();
      } else if (hasPancake) {
        for (let layer = 0; layer < 3; layer++) {
          const ly = 14 - layer * 14;
          ctx.fillStyle = '#E8A352';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 2.8;
          ell(ctx, 0, ly, 84 - layer * 3, 52 - layer * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FCD88A';
          ell(ctx, 0, ly - 3, 72 - layer * 3, 42 - layer * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#FFF29C';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.2;
        rr(ctx, -16, -26, 32, 20, 6);
        ctx.fill();
        ctx.stroke();
      } else if (hasBurger) {
        ctx.fillStyle = '#DE923B';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 3;
        ell(ctx, 0, 18, 84, 52);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#78C47C';
        for (let k = 0; k < 10; k++) {
          const a = (k * PI2) / 10;
          circ(ctx, Math.cos(a) * 68, 8 + Math.sin(a) * 38, 18);
          ctx.fill();
        }
      } else if (hasPizza) {
        ctx.fillStyle = '#E6A04B';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 3;
        ell(ctx, 0, 4, 96, 66);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E35242';
        ell(ctx, 0, 4, 80, 54);
        ctx.fill();
        ctx.fillStyle = '#FFEA8C';
        ell(ctx, 0, 4, 72, 48);
        ctx.fill();
      }
    }

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

    (dish.piping || []).forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color || '#FFFDF9';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      circ(ctx, 0, 0, p.r || 15);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = p.shadow || '#D9C2B2';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, (p.r || 15) * 0.55, 0.3, 4.2);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      circ(ctx, -3, -4, (p.r || 15) * 0.28);
      ctx.fill();
      ctx.restore();
    });

    (dish.toppings || []).forEach(tp => {
      ctx.save();
      ctx.translate(tp.x, tp.y);
      if (tp.id === 'sprinkles') {
        const cols = ['#E87A82', '#F2C97D', '#8FB9A8', '#9B82C9', '#F4A261'];
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
        ctx.fillStyle = '#F7C948';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.6;
        star(ctx, 0, 0, 12, 5.5, 5, tp.seed);
        ctx.fill();
        ctx.stroke();
      } else if (tp.id === 'hearts') {
        ctx.fillStyle = '#E87A82';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.5;
        heart(ctx, 0, 0, 12);
        ctx.fill();
        ctx.stroke();
      } else if (tp.id === 'candle') {
        ctx.fillStyle = '#FFFDF9';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        rr(ctx, -6, -28, 12, 32, 3);
        ctx.fill();
        ctx.stroke();
        if (!tp.blownOut) {
          const flick = Math.sin(t * 14 + (tp.seed || 0)) * 2.5;
          ctx.fillStyle = '#F5A623';
          ctx.beginPath();
          ctx.moveTo(0, -46 + flick);
          ctx.quadraticCurveTo(9, -34, 0, -28);
          ctx.quadraticCurveTo(-9, -34, 0, -46 + flick);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        drawIngredient(ctx, 'strawberry', 0, 0, 14, { sliced: false, shadow: false });
      }
      ctx.restore();
    });

    ctx.restore();

    if (isCup) {
      ctx.save();
      ctx.translate(22, -75);
      ctx.rotate(0.18);
      ctx.fillStyle = '#E88388';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      rr(ctx, -7, -65, 14, 115, 5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

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
    }

    ctx.restore();
  }

  /* ==========================================================================
   * 5. Custom-Sculpted Pinterest Kawaii Character & 8 Reaction Animations
   * (100% Vector Gouache Character — No Circular JPG Helmet!)
   * ========================================================================== */
  function drawCritterCustomer(ctx, critter, cx, cy, scale, state, t) {
    scale = scale || 1;
    state = state || {};
    const rxn = state.reaction || null;
    const mouthOpen = Math.max(0, Math.min(1, state.mouthOpen || 0));
    const chewing = state.chewing || 0;

    // Soft warm Pinterest pastel fur colors per character
    const pastelBody = {
      catnap:     '#B39DDB',
      picky:      '#F49AC2',
      dogday:     '#F5A962',
      bobby:      '#E87A88',
      hoppy:      '#82C995',
      craftycorn: '#8ECAE6',
      bubba:      '#7EB2DD',
      poppy:      '#F28BB2',
    };
    let bodyCol = pastelBody[critter.id] || critter.color;
    if (rxn === 'fire') bodyCol = '#E85D4A';
    else if (rxn === 'ice') bodyCol = '#9AD9F5';

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Squash-and-stretch spring bounce
    let bobY = Math.sin(t * 3.0) * 3;
    let shakeX = 0;
    let sqX = 1 + Math.sin(t * 3.0) * 0.02;
    let sqY = 1 - Math.sin(t * 3.0) * 0.02;

    if (rxn === 'float') {
      bobY = -26 + Math.sin(t * 4.2) * 8;
    } else if (rxn === 'ice') {
      shakeX = Math.sin(t * 44) * 3;
    } else if (rxn === 'love' || rxn === 'rainbow') {
      const jump = Math.abs(Math.sin(t * 6.5));
      bobY = -jump * 14;
      sqX = 1 - jump * 0.05;
      sqY = 1 + jump * 0.07;
    }
    if (chewing > 0) {
      sqX += Math.sin(t * 18) * 0.035;
      sqY -= Math.sin(t * 18) * 0.035;
    }

    ctx.translate(shakeX, bobY);
    ctx.scale(sqX, sqY);

    // 1. Boho Pastel Rainbow Arch behind Character
    if (rxn === 'rainbow') {
      const bohoCols = ['#E88388', '#F2B880', '#F7DF94', '#9CC5B5', '#92B8E0', '#C4A8E0'];
      for (let i = 0; i < bohoCols.length; i++) {
        ctx.strokeStyle = bohoCols[i];
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 12, 102 - i * 6, Math.PI, 0);
        ctx.stroke();
      }
    }

    // 2. Pastel Hot Air Balloons if 'float' reaction
    if (rxn === 'float') {
      [[-58, -88, '#E88388'], [58, -92, '#9CC5B5']].forEach(([bx, by, bcol]) => {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx * 0.45, -10);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.fillStyle = bcol;
        ell(ctx, bx, by - 14, 17, 21);
        ctx.fill();
        ctx.stroke();
      });
    }

    // 3. Species-Specific Sculpted Ears with Spring Wiggle
    const wig = Math.sin(t * 3.8) * 0.07 + (rxn ? Math.sin(t * 12) * 0.09 : 0);
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;

    if (critter.earType === 'bunny') {
      for (let s of [-1, 1]) {
        ctx.save();
        ctx.rotate(s * (0.16 + wig));
        ell(ctx, s * 28, -72, 13, 36);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F7CBD8';
        ell(ctx, s * 28, -70, 6.5, 24);
        ctx.fill();
        ctx.fillStyle = bodyCol;
        ctx.restore();
      }
    } else if (critter.earType === 'cat') {
      for (let s of [-1, 1]) {
        ctx.save();
        ctx.rotate(s * wig);
        ctx.beginPath();
        ctx.moveTo(s * 18, -48);
        ctx.lineTo(s * 48, -76);
        ctx.lineTo(s * 52, -28);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F7CBD8';
        ctx.beginPath();
        ctx.moveTo(s * 24, -46);
        ctx.lineTo(s * 43, -67);
        ctx.lineTo(s * 45, -34);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = bodyCol;
        ctx.restore();
      }
    } else if (critter.earType === 'dog') {
      // Floppy golden spaniel ears
      for (let s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * 48, -24);
        ctx.rotate(s * (0.28 + wig));
        ctx.fillStyle = '#D97F38';
        ell(ctx, 0, 18, 16, 32);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else if (critter.earType === 'elephant') {
      for (let s of [-1, 1]) {
        ctx.save();
        ctx.rotate(s * wig);
        ell(ctx, s * 56, -12, 24, 34, s * 0.15);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F7CBD8';
        ell(ctx, s * 54, -10, 14, 22, s * 0.15);
        ctx.fill();
        ctx.fillStyle = bodyCol;
        ctx.restore();
      }
    } else {
      for (let s of [-1, 1]) {
        ctx.save();
        ctx.rotate(s * wig);
        circ(ctx, s * 42, -45, 19);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F7CBD8';
        circ(ctx, s * 42, -45, 9.5);
        ctx.fill();
        ctx.fillStyle = bodyCol;
        ctx.restore();
      }
    }

    // 4. Cozy Linen Patisserie Apron & Torso
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;
    ell(ctx, 0, 50, 56, 40);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFDF9';
    rr(ctx, -34, 22, 68, 54, 22);
    ctx.fill();
    ctx.stroke();
    // Signature pendant emblem on apron
    ctx.fillStyle = '#E87A82';
    heart(ctx, 0, 50, 13);
    ctx.fill();
    ctx.stroke();

    // 5. Plush Kawaii Sculpted Head (Soft Gouache Shading)
    const cheekPuff = chewing > 0 ? Math.abs(Math.sin(t * 16)) * 6 : 0;
    const headGrad = ctx.createRadialGradient(-12, -24, 8, 0, -10, 62);
    headGrad.addColorStop(0, lerpColor(bodyCol, '#FFFFFF', 0.25));
    headGrad.addColorStop(1, bodyCol);
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.2;
    ell(ctx, 0, -12, 56 + cheekPuff, 49);
    ctx.fill();
    ctx.stroke();

    // Soft Cream Muzzle Patch
    ctx.fillStyle = '#FFF7EE';
    ell(ctx, 0, 2, 23, 16);
    ctx.fill();

    // Rosy Gouache Blush Cheeks
    ctx.fillStyle = rxn === 'fire' ? '#E83A26' : 'rgba(232, 115, 130, 0.52)';
    ell(ctx, -33, -2, 12 + cheekPuff * 0.4, 7.5);
    ctx.fill();
    ell(ctx, 33, -2, 12 + cheekPuff * 0.4, 7.5);
    ctx.fill();

    // 6. Puffed White Patisserie Chef Hat (Toque Blanche) on Top of Head
    ctx.save();
    const hatBounce = Math.sin(t * 3.8 + 0.6) * 2;
    ctx.translate(0, -60 + hatBounce);
    if (critter.earType === 'unicorn') {
      ctx.fillStyle = '#F7C948';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-9, 4);
      ctx.lineTo(0, -34);
      ctx.lineTo(9, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.8;
    [[-17, -9, 15], [17, -9, 15], [0, -15, 18]].forEach(([hx, hy, hr]) => {
      circ(ctx, hx, hy, hr);
      ctx.fill();
      ctx.stroke();
    });
    ctx.fillStyle = '#FFFDF9';
    ell(ctx, 0, -10, 23, 13);
    ctx.fill();
    ctx.fillStyle = '#FFF9F0';
    rr(ctx, -21, -3, 42, 11, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E88388';
    ctx.fillRect(-19, 1, 38, 3.5);
    ctx.restore();

    // 7. Expressive Pinterest Storybook Eyes (Tracking Food + Catchlights)
    if (rxn === 'sleepy') {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.2;
      for (let s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 21, -16, 10, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
      const bRad = 13 + Math.sin(t * 2.5) * 5;
      ctx.fillStyle = 'rgba(165, 222, 245, 0.82)';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      circ(ctx, 28, -4, bRad);
      ctx.fill();
      ctx.stroke();
    } else if (rxn === 'sour') {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(-29, -23); ctx.lineTo(-15, -16); ctx.lineTo(-29, -9);
      ctx.moveTo(29, -23);  ctx.lineTo(15, -16);  ctx.lineTo(29, -9);
      ctx.stroke();
    } else if (rxn === 'love' || rxn === 'rainbow') {
      for (let s of [-1, 1]) {
        ctx.fillStyle = OUTLINE;
        circ(ctx, s * 21, -16, 12);
        ctx.fill();
        ctx.fillStyle = '#F7C948';
        star(ctx, s * 21, -16, 9, 4, 5, t * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        circ(ctx, s * 21 - 4, -20, 3);
        ctx.fill();
      }
    } else {
      const blink = Math.sin(t * 1.8) > 0.96;
      for (let s of [-1, 1]) {
        if (blink) {
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.arc(s * 21, -16, 10, 0.15, Math.PI - 0.15);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#FFFDF9';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 2.8;
          circ(ctx, s * 21, -16, 12);
          ctx.fill();
          ctx.stroke();
          // Warm cocoa iris tracking pointer
          const lx = (state.lookX || 0) * 3.2;
          const ly = (state.lookY || 0) * 3.2;
          ctx.fillStyle = '#4A2C22';
          circ(ctx, s * 21 + lx, -16 + ly, 7.8);
          ctx.fill();
          // Dual specular catchlights
          ctx.fillStyle = '#FFFFFF';
          circ(ctx, s * 21 + lx - 2.6, -19 + ly, 3.2);
          ctx.fill();
          circ(ctx, s * 21 + lx + 2.5, -13 + ly, 1.5);
          ctx.fill();
        }
      }
    }

    //Cute Sculpted Nose
    ctx.fillStyle = critter.earType === 'pig' ? '#E87A96' : OUTLINE;
    if (critter.earType === 'pig') {
      ell(ctx, 0, -5, 9, 6.5);
      ctx.fill();
      ctx.stroke();
    } else {
      ell(ctx, 0, -6, 5.5, 4);
      ctx.fill();
    }

    // 8. Animated Mouth & Reaction Effects
    if (rxn === 'fire') {
      const fl = 42 + Math.sin(t * 24) * 12;
      ctx.fillStyle = '#F26430';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-12, 6);
      ctx.lineTo(-28, 22 + fl);
      ctx.lineTo(0, 14 + fl * 0.85);
      ctx.lineTo(28, 22 + fl);
      ctx.lineTo(12, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FCD856';
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.lineTo(0, 12 + fl * 0.65);
      ctx.lineTo(6, 6);
      ctx.closePath();
      ctx.fill();
    } else if (rxn === 'sour') {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.8;
      star(ctx, 0, 5, 8, 3, 6, t);
      ctx.stroke();
    } else if (mouthOpen > 0.08) {
      const mh = 9 + mouthOpen * 20;
      const mw = 13 + mouthOpen * 13;
      ctx.fillStyle = '#6B1D2F';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.8;
      ell(ctx, 0, 6, mw, mh);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F48B9A';
      ell(ctx, 0, 6 + mh * 0.32, mw * 0.65, mh * 0.45);
      ctx.fill();
    } else {
      const chY = chewing > 0 ? Math.sin(t * 18) * 2.5 : 0;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(-6.5, 2 + chY, 6.5, 0.1, Math.PI - 0.1);
      ctx.arc(6.5, 2 + chY, 6.5, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }

    if (rxn === 'love' || rxn === 'rainbow') {
      for (let i = 0; i < 4; i++) {
        const a = t * 2.4 + (i * PI2) / 4;
        const hx = Math.cos(a) * 74;
        const hy = -15 + Math.sin(a * 1.5) * 28;
        ctx.fillStyle = i % 2 === 0 ? '#E87A82' : '#F7C948';
        if (i % 2 === 0) heart(ctx, hx, hy, 11);
        else sparkle4(ctx, hx, hy, 11, t * 2);
        ctx.fill();
      }
    } else if (rxn === 'ice') {
      ctx.fillStyle = '#B8EAFF';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      for (let i = -2; i <= 2; i++) {
        star(ctx, i * 20, -68 - (2 - Math.abs(i)) * 6, 11, 4, 6, t);
        ctx.fill();
        ctx.stroke();
      }
    } else if (rxn === 'burnt') {
      const puffY = -48 - ((t * 35) % 38);
      ctx.fillStyle = 'rgba(95, 85, 80, 0.72)';
      circ(ctx, 0, puffY, 16);
      ctx.fill();
      circ(ctx, -12, puffY + 6, 12);
      ctx.fill();
      circ(ctx, 12, puffY + 6, 12);
      ctx.fill();
    }

    // 9. Plush Paws on Counter
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    const pawBob = chewing > 0 || rxn ? Math.sin(t * 14) * 7 : Math.sin(t * 3) * 2;
    circ(ctx, -56, 48 + pawBob, 15);
    ctx.fill();
    ctx.stroke();
    circ(ctx, 56, 48 - pawBob, 15);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  return {
    loadPortraits,
    portraits,
    OUTLINE,
    rr,
    circ,
    ell,
    star,
    sparkle4,
    heart,
    lerpColor,
    drawIcon,
    drawKitchenBackdrop,
    drawIngredient,
    drawDish,
    drawCritterCustomer,
  };
})();
