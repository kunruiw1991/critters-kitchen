window.KitchenArt = (function() {
    const CACHE = {};
    const IMAGES = {};
    let initialized = false;

    function loadImages() {
        if (initialized) return;
        const friends = ['bobby', 'craftycorn', 'catnap', 'dogday', 'hoppy', 'picky', 'bubba', 'kickin'];
        friends.forEach(f => {
            const img = new Image();
            img.src = `icons/${f}.jpg`;
            IMAGES[f] = img;
        });
        document.querySelectorAll('.stage-btn').forEach(btn => {
            const c = document.createElement('canvas');
            c.width = 84; c.height = 84;
            window.KitchenArt.drawButtonIcon(c, 'stage' + btn.dataset.stage);
            btn.style.backgroundImage = 'url(' + c.toDataURL() + ')';
        });
        initialized = true;
    }

    function createTexture(name, w, h, generator) {
        if (CACHE[name]) return CACHE[name];
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        generator(ctx, w, h);
        CACHE[name] = canvas;
        return canvas;
    }

    function getWoodTexture() {
        return createTexture('wood', 256, 256, (ctx, w, h) => {
            ctx.fillStyle = '#d4a373';
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 0.15;
            for(let i=0; i<300; i++) {
                ctx.beginPath();
                ctx.lineWidth = Math.random() * 3 + 1;
                ctx.strokeStyle = '#8b5a2b';
                let x = Math.random() * w;
                ctx.moveTo(x, 0);
                ctx.bezierCurveTo(x+15, h*0.33, x-15, h*0.66, x, h);
                ctx.stroke();
            }
            ctx.globalAlpha = 1.0;
        });
    }

    function getSpongeTexture(color) {
        return createTexture('sponge_' + color, 128, 128, (ctx, w, h) => {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 0.3;
            for(let i=0; i<800; i++) {
                let x = Math.random() * w, y = Math.random() * h;
                let r = Math.random() * 1.5 + 0.5;
                ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
                ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
            }
            ctx.globalAlpha = 1.0;
        });
    }


    function drawHeart(ctx, x, y, size) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.moveTo(0, size/4);
        ctx.bezierCurveTo(-size/2, -size/2, -size, size/3, 0, size);
        ctx.bezierCurveTo(size, size/3, size/2, -size/2, 0, size/4);
        let grad = ctx.createLinearGradient(0, -size/2, 0, size);
        grad.addColorStop(0, '#ff99cc');
        grad.addColorStop(1, '#ff3366');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
    }

    function drawCritterBase(ctx, w, h, state) {
        const cx = w/2; const cy = 72; const r = 56;
        const friend = state.friend || 'bobby';
        const bitesTaken = (state.dish && state.dish.bitesTaken) || state.bitesTaken || 0;
        
        ctx.save();
        ctx.translate(cx, cy);
        
        if (bitesTaken > 0 || state.feedAnim > 0) {
            ctx.scale(1.1, 1.1);
            ctx.translate(0, Math.sin(Date.now() / 150) * 5);
        }

        ctx.lineWidth = 8;
        ctx.strokeStyle = '#5C3D2E';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.clip();
        if (IMAGES[friend] && IMAGES[friend].complete) {
            ctx.drawImage(IMAGES[friend], -r, -r, r*2, r*2);
        } else {
            ctx.fillStyle = '#f0d0b0';
            ctx.fill();
        }

        if (bitesTaken > 0 || state.feedAnim > 0) {
            ctx.fillStyle = 'rgba(255,105,180,0.6)';
            ctx.beginPath(); ctx.ellipse(-r*0.4, r*0.2, 12, 8, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(r*0.4, r*0.2, 12, 8, 0, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();

        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
        ctx.beginPath(); ctx.ellipse(0, -r*0.9, 35, 15, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(-20, -r-10, 20, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(20, -r-10, 20, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -r-25, 25, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;

        if (bitesTaken > 0 || state.feedAnim > 0) {
            drawHeart(ctx, -r-30, -20 + Math.sin(Date.now()/200)*10, 20);
            drawHeart(ctx, r+30, -40 + Math.cos(Date.now()/200)*10, 25);
            ctx.fillStyle = '#ffd700';
            ctx.beginPath(); ctx.arc(-r-20, 30, 4, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(r+20, 10, 6, 0, Math.PI*2); ctx.fill();
        }

        ctx.restore();
    }

    function drawCritterPaws(ctx, w, h, state) {
        const cx = w/2; 
        const tableY = h * 0.2;
        ctx.save();
        ctx.fillStyle = '#8C6239';
        ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
        ctx.beginPath(); ctx.ellipse(cx - 50, tableY + 5, 18, 12, -0.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + 50, tableY + 5, 18, 12, 0.2, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#5C3D2E';
        for(let i=0; i<3; i++) {
            ctx.beginPath(); ctx.arc(cx - 50 - 8 + i*8, tableY + 9, 3, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 50 - 8 + i*8, tableY + 9, 3, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
    function drawTabletop(ctx, w, h, state) {
        const grad = ctx.createLinearGradient(0, 0, 0, h*0.2);
        grad.addColorStop(0, '#fefae0');
        grad.addColorStop(1, '#faedcd');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h*0.2);

        drawCritterBase(ctx, w, h, state);

        const ptrn = ctx.createPattern(getWoodTexture(), 'repeat');
        ctx.fillStyle = ptrn;
        ctx.fillRect(0, h * 0.2, w, h * 0.8);
        
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, h * 0.2, w, 15);

        drawCritterPaws(ctx, w, h, state);
    }

    function drawCuttingBoard(ctx, x, y, r) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(0, r*0.1, r, r*0.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#8b5a2b';
        ctx.beginPath(); ctx.ellipse(0, 15, r, r*0.5, 0, 0, Math.PI*2); ctx.fill();
        const ptrn = ctx.createPattern(getWoodTexture(), 'repeat');
        ctx.fillStyle = ptrn;
        ctx.beginPath(); ctx.ellipse(0, 0, r, r*0.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    function drawIngredient3D(ctx, x, y, size, type, sliced = false) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, size/2, size*0.4, size*0.15, 0, 0, Math.PI*2);
        ctx.fill();

        if (sliced) {
            for(let i=0; i<3; i++) {
                drawSingleIngredient(ctx, -size/4 + i*size/4, i*size/8, size*0.7, type, true);
            }
        } else {
            drawSingleIngredient(ctx, 0, 0, size, type, false);
        }
        ctx.restore();
    }

    function drawSingleIngredient(ctx, dx, dy, size, type, isSlice) {
        ctx.save();
        ctx.translate(dx, dy);
        let grad = ctx.createRadialGradient(-size*0.2, -size*0.2, size*0.1, 0, 0, size/2);
        
        const drawHighlight = (w, h, rot) => {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.ellipse(-size*0.15, -size*0.15, w, h, rot, 0, Math.PI*2); ctx.fill();
        };

        if (type === 'strawberry') {
            grad.addColorStop(0, '#ff9999');
            grad.addColorStop(0.5, '#ff3333');
            grad.addColorStop(1, '#cc0000');
            ctx.fillStyle = grad;
            ctx.beginPath();
            if (isSlice) {
                ctx.ellipse(0, 0, size/2, size/3, 0, 0, Math.PI*2);
            } else {
                ctx.moveTo(0, -size/2);
                ctx.bezierCurveTo(size/2, -size/2, size/2, size/4, 0, size/2);
                ctx.bezierCurveTo(-size/2, size/4, -size/2, -size/2, 0, -size/2);
            }
            ctx.fill();
            
            if (!isSlice) {
                ctx.fillStyle = '#228B22';
                ctx.beginPath();
                for(let i=0; i<5; i++) {
                    ctx.moveTo(0, -size/2 + 5);
                    let lx = Math.cos(Math.PI + (i-2.5)*0.8) * size*0.4;
                    let ly = -size/2 + Math.sin(Math.PI + (i-2.5)*0.8) * size*0.4;
                    ctx.quadraticCurveTo(lx/2, -size/2 - 5, lx, ly);
                    ctx.quadraticCurveTo(lx/2, ly+10, 0, -size/2 + 5);
                }
                ctx.fill();
                drawHighlight(size*0.15, size*0.08, -Math.PI/4);
            }
            
            ctx.fillStyle = isSlice ? '#ffcccc' : '#ffd700';
            if (isSlice) {
                 ctx.beginPath(); ctx.ellipse(0, 0, size/4, size/6, 0, 0, Math.PI*2); ctx.fill();
            } else {
                 for(let i=0; i<20; i++) {
                     let sx = (Math.random()-0.5)*size*0.6;
                     let sy = (Math.random()-0.5)*size*0.6;
                     ctx.beginPath(); ctx.ellipse(sx, sy, 2, 3, 0, 0, Math.PI*2); ctx.fill();
                 }
            }
        } else if (type === 'banana') {
            grad.addColorStop(0, '#ffffcc');
            grad.addColorStop(0.8, '#ffe600');
            grad.addColorStop(1, '#ccb300');
            ctx.fillStyle = grad;
            ctx.beginPath();
            if (isSlice) {
                ctx.arc(0, 0, size/2, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#cccc00'; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = '#cccc00'; ctx.beginPath(); ctx.arc(0,0,size/6,0,Math.PI*2); ctx.fill();
            } else {
                ctx.moveTo(-size/2, size/3);
                ctx.quadraticCurveTo(0, -size/1.5, size/2, -size/3);
                ctx.quadraticCurveTo(size/3, Math.PI/2, -size/2, size/3);
                ctx.fill();
                ctx.fillStyle = '#5c3a21';
                ctx.beginPath(); ctx.arc(size/2, -size/3, size/10, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#3a2110';
                ctx.beginPath(); ctx.arc(-size/2, size/3, size/12, 0, Math.PI*2); ctx.fill();
                drawHighlight(size*0.3, size*0.05, Math.PI/6);
            }
        } else if (type === 'kiwi') {
            grad.addColorStop(0, '#a67b5b');
            grad.addColorStop(0.6, '#8b5a2b');
            grad.addColorStop(1, '#5c3a21');
            ctx.fillStyle = isSlice ? '#ccff99' : grad;
            ctx.beginPath();
            ctx.ellipse(0, 0, size/2, size/2.5, 0, 0, Math.PI*2);
            ctx.fill();
            
            if (!isSlice) {
                ctx.strokeStyle = '#5c3a21';
                for(let i=0; i<40; i++) {
                     let sx = (Math.random()-0.5)*size*0.7;
                     let sy = (Math.random()-0.5)*size*0.6;
                     ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx+2, sy+3); ctx.stroke();
                }
            }
            
            // Bright green face for both (smaller for !isSlice to look like a cut half)
            ctx.save();
            if (!isSlice) {
                ctx.translate(0, -size*0.1);
                ctx.scale(0.8, 0.4);
            }
            let sgrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size/2);
            sgrad.addColorStop(0, '#ffffcc');
            sgrad.addColorStop(0.3, '#99ff33');
            sgrad.addColorStop(1, '#66cc00');
            ctx.fillStyle = sgrad;
            ctx.beginPath(); ctx.ellipse(0, 0, size/2, size/2.5, 0, 0, Math.PI*2); ctx.fill();
            
            ctx.fillStyle = '#e6ffcc';
            ctx.beginPath(); ctx.arc(0,0,size/5,0,Math.PI*2); ctx.fill();
            
            ctx.strokeStyle = '#e6ffcc';
            ctx.lineWidth = 2;
            for(let i=0; i<20; i++) {
                let a = i * Math.PI*2/20;
                ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*size*0.4, Math.sin(a)*size*0.4); ctx.stroke();
            }

            ctx.fillStyle = '#000000';
            for(let i=0; i<12; i++) {
                let a = i * Math.PI / 6;
                ctx.beginPath(); ctx.ellipse(Math.cos(a)*size/3, Math.sin(a)*size/3, size/20, size/40, a, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
            
            if (!isSlice) {
                drawHighlight(size*0.15, size*0.2, 0);
            }
        } else if (type === 'blueberry') {
            grad.addColorStop(0, '#9999ff');
            grad.addColorStop(0.7, '#3333cc');
            grad.addColorStop(1, '#000066');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, size/2, 0, Math.PI*2);
            ctx.fill();
            if (!isSlice) {
                ctx.fillStyle = '#1a1a4c';
                ctx.beginPath();
                ctx.moveTo(0, -size/2 + 5);
                for(let i=0; i<5; i++) {
                    let a = i * Math.PI*2/5 - Math.PI/2;
                    ctx.lineTo(Math.cos(a)*size/6, -size/2 + Math.sin(a)*size/6 + 5);
                }
                ctx.fill();
                drawHighlight(size*0.15, size*0.15, 0);
            }
        } else if (type === 'peach') {
            grad.addColorStop(0, '#ffccaa');
            grad.addColorStop(0.5, '#ff9966');
            grad.addColorStop(1, '#cc6633');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, size/2, 0, Math.PI*2);
            ctx.fill();
            
            if (!isSlice) {
                ctx.strokeStyle = '#e65c00';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(0, -size/2); ctx.quadraticCurveTo(-size*0.2, 0, 0, size/2); ctx.stroke();
                
                ctx.fillStyle = '#228B22';
                ctx.beginPath(); ctx.moveTo(0, -size/2); ctx.quadraticCurveTo(size*0.4, -size*0.7, size*0.5, -size*0.3); ctx.quadraticCurveTo(size*0.2, -size*0.2, 0, -size/2); ctx.fill();
                drawHighlight(size*0.15, size*0.15, 0);
            }
        } else if (type === 'cocoa') {
            if (!isSlice) {
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.ellipse(0, size/2 + 10, size*0.6, size*0.2, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.arc(-size*0.4, size/2 + 5, size*0.1, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(size*0.4, size/2 + 5, size*0.1, 0, Math.PI*2); ctx.fill();
            }

            grad.addColorStop(0, '#8c5220');
            grad.addColorStop(0.7, '#4a2505');
            grad.addColorStop(1, '#241000');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(0, 0, size/3, size/2, 0, 0, Math.PI*2);
            ctx.fill();

            if (!isSlice) {
                ctx.strokeStyle = '#3d1f04';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(0, -size/2); ctx.quadraticCurveTo(-size*0.2, 0, 0, size/2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, -size/2); ctx.lineTo(0, size/2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, -size/2); ctx.quadraticCurveTo(size*0.2, 0, 0, size/2); ctx.stroke();
                drawHighlight(size*0.05, size*0.2, 0);
            }
        } else if (type === 'egg') {
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.7, '#ffeadb');
            grad.addColorStop(1, '#e0c8b6');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(0, 0, size/2, size/1.6, 0, 0, Math.PI*2);
            ctx.fill();
            drawHighlight(size*0.15, size*0.2, 0);
        } else {
             ctx.fillStyle = '#ccc';
             ctx.beginPath(); ctx.arc(0,0,size/2,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }

    function getCombinedColor(colors) {
        if (!colors || colors.length === 0) return '#fffdd0';
        if (colors[0] && colors[0].startsWith('#')) return colors[0];
        if (colors.includes('cocoa')) return '#4a2505';
        if (colors.includes('strawberry')) return '#ff9999';
        if (colors.includes('kiwi') || colors.includes('banana')) return '#ccff99';
        if (colors.includes('blueberry')) return '#9999ff';
        return '#fffdd0';
    }

    function drawStage1Prep(ctx, w, h, state) {
        state.tableIngredientHitboxes = {};
        const boardX = w/2;
        const boardY = h*0.6;
        const boardR = Math.max(190, w * 0.3);
        
        state.boardHitbox = {x: boardX, y: boardY, r: boardR};
        
        drawCuttingBoard(ctx, boardX, boardY, boardR);

        const activeItem = state.boardItem ? state.boardItem.id : state.activeIngredient;
        if (activeItem) {
            drawIngredient3D(ctx, boardX, boardY - 30, 150, activeItem, false);
            
            ctx.save();
            ctx.translate(boardX + 100, boardY - 20);
            if (state.sliceTrail && state.sliceTrail.active && state.sliceTrail.p2) {
                ctx.translate(state.sliceTrail.p2.x - (boardX+100), state.sliceTrail.p2.y - (boardY-20));
            }
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.roundRect(-10, -50, 20, 50, 5); ctx.fill();
            let blade = ctx.createLinearGradient(0, 0, 30, 0);
            blade.addColorStop(0, '#ccc'); blade.addColorStop(0.5, '#fff'); blade.addColorStop(1, '#999');
            ctx.fillStyle = blade;
            ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-8, 90); ctx.lineTo(25, 90); ctx.quadraticCurveTo(25, 40, -8, 0); ctx.fill();
            ctx.restore();
        }

        const ingredients = ['strawberry', 'banana', 'kiwi', 'blueberry', 'peach', 'cocoa'];
        ingredients.forEach((ing, i) => {
            const angle = Math.PI + (i / 5) * Math.PI;
            const r = boardR + 90;
            const ix = boardX + Math.cos(angle) * r;
            const iy = boardY - 30 + Math.sin(angle) * r * 0.5;
            
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(ix, iy+20, 55, 30, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#e0e0e0';
            ctx.beginPath(); ctx.ellipse(ix, iy+15, 50, 25, 0, 0, Math.PI*2); ctx.fill();
            
            drawIngredient3D(ctx, ix, iy, 96, ing, false);
            state.tableIngredientHitboxes[ing] = {x: ix - 48, y: iy - 48, w: 96, h: 96, r: 55};
        });

        const bowlX = boardX + boardR + 100;
        const bowlY = boardY;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.ellipse(bowlX, bowlY, 90, 45, 0, 0, Math.PI*2); ctx.fill();
        
        const slicedItems = state.dish?.items || state.slicedIngredients;
        if (slicedItems && slicedItems.length > 0) {
            slicedItems.forEach((ingObj, i) => {
                let id = typeof ingObj === 'string' ? ingObj : (ingObj.id || ingObj);
                drawIngredient3D(ctx, bowlX, bowlY - i*15, 80, id, true);
            });
            
            ctx.fillStyle = '#ff7f50';
            ctx.beginPath(); ctx.roundRect(w - 120, h/2 - 30, 100, 60, 30); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.moveTo(w-80, h/2-15); ctx.lineTo(w-50, h/2); ctx.lineTo(w-80, h/2+15); ctx.fill();
            state.nextBtnHitbox = {x: w - 120, y: h/2 - 30, w: 100, h: 60};
        } else {
            state.nextBtnHitbox = null;
        }

        if (state.sliceTrail && state.sliceTrail.active && state.sliceTrail.p1 && state.sliceTrail.p2) {
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 12;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(state.sliceTrail.p1.x, state.sliceTrail.p1.y);
            ctx.lineTo(state.sliceTrail.p2.x, state.sliceTrail.p2.y);
            ctx.stroke();
            ctx.fillStyle = '#333';
            ctx.beginPath(); ctx.ellipse(state.sliceTrail.p2.x, state.sliceTrail.p2.y, 25, 12, 0, 0, Math.PI*2); ctx.fill();
        }
    }

    function drawStage2Mix(ctx, w, h, state) {
        state.tableHelperHitboxes = {};
        const bowlX = w/2;
        const bowlY = h*0.6;
        const bowlR = Math.max(195, w * 0.3);
        
        state.glassBowlHitbox = {x: bowlX, y: bowlY + 20, r: bowlR};

        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(bowlX, bowlY+100, bowlR*0.8, bowlR*0.3, 0, 0, Math.PI*2); ctx.fill();

        const progress = state.mixProgress || 0;
        const dish = state.dish || {};
        const targetColor = dish.batterTint || getCombinedColor(dish.layerColors);
        
        const batterColor = progress > 0.5 ? targetColor : '#fffdd0';

        ctx.fillStyle = batterColor;
        ctx.beginPath(); ctx.ellipse(bowlX, bowlY+30, bowlR*0.9, bowlR*0.4, 0, 0, Math.PI*2); ctx.fill();
        let bgrad = ctx.createLinearGradient(bowlX - bowlR*0.9, bowlY+30, bowlX + bowlR*0.9, bowlY+30);
        bgrad.addColorStop(0, 'rgba(255,255,255,0.7)');
        bgrad.addColorStop(0.5, 'rgba(255,255,255,0)');
        bgrad.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = bgrad;
        ctx.fill();

        const angle = state.mixAngle || state.whiskAngle || 0;
        if (angle || progress > 0) {
            ctx.save();
            ctx.translate(bowlX, bowlY+30);
            ctx.rotate(angle);
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 15;
            ctx.beginPath();
            for(let i=0; i<Math.PI*6; i+=0.1) {
                let rw = i * 12;
                if(i===0) ctx.moveTo(Math.cos(i)*rw, Math.sin(i)*rw*0.4);
                else ctx.lineTo(Math.cos(i)*rw, Math.sin(i)*rw*0.4);
            }
            ctx.stroke();
            
            ctx.translate(50, 0);
            ctx.rotate(-angle * 2);
            ctx.strokeStyle = '#c0c0c0';
            ctx.lineWidth = 4;
            for(let i=0; i<6; i++) {
                ctx.beginPath();
                ctx.ellipse(0, -60, 20, 50, i*Math.PI/6, 0, Math.PI*2);
                ctx.stroke();
            }
            ctx.fillStyle = '#444';
            ctx.beginPath(); ctx.roundRect(-10, -160, 20, 50, 5); ctx.fill();
            ctx.restore();
        }

        if (dish.items && state.fruitAdded) {
            dish.items.forEach((ing, i) => {
                let id = typeof ing === 'string' ? ing : (ing.id || ing);
                let ang = angle + i * Math.PI*2/dish.items.length;
                let r = bowlR * 0.5;
                drawIngredient3D(ctx, bowlX + Math.cos(ang)*r, bowlY + 30 + Math.sin(ang)*r*0.4, 70, id, true);
            });
        }
        
        if (state.eggAdded) {
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(bowlX - 40, bowlY + 30, 20, 10, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath(); ctx.arc(bowlX - 40, bowlY + 30, 10, 0, Math.PI*2); ctx.fill();
        }
        
        if (state.milkAdded) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath(); ctx.ellipse(bowlX + 40, bowlY + 30, 40, 20, 0, 0, Math.PI*2); ctx.fill();
        }

        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); 
        ctx.ellipse(bowlX, bowlY, bowlR, bowlR*0.5, 0, 0, Math.PI*2);
        ctx.ellipse(bowlX, bowlY+100, bowlR*0.8, bowlR*0.4, 0, 0, Math.PI*2);
        ctx.fill();

        let ex = bowlX - bowlR - 60, ey = bowlY + 60;
        if (state.eggAdded) {
            ctx.save();
            ctx.fillStyle = '#ffeadb';
            ctx.strokeStyle = '#d0b090'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(ex, ey, 20, 0, Math.PI, true); ctx.lineTo(ex - 20, ey); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(ex + 25, ey, 20, 0, Math.PI, false); ctx.lineTo(ex + 5, ey); ctx.fill(); ctx.stroke();
            ctx.restore();
        } else {
            drawIngredient3D(ctx, ex, ey, 96, 'egg', false);
        }
        
        let px = bowlX + bowlR + 60, py = bowlY + 60;
        let mgrad = ctx.createLinearGradient(px - 50, py, px + 50, py);
        mgrad.addColorStop(0, '#d1f2eb'); mgrad.addColorStop(0.5, '#e8f8f5'); mgrad.addColorStop(1, '#a3e4d7');
        ctx.fillStyle = mgrad;
        ctx.beginPath(); ctx.moveTo(px-40, py+100); ctx.lineTo(px+40, py+100); ctx.lineTo(px+50, py-80); ctx.lineTo(px-50, py-80); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px, py+100, 40, 15, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px, py-80, 50, 20, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px-50, py-80); ctx.lineTo(px-70, py-100); ctx.lineTo(px-40, py-80); ctx.fill();
        ctx.strokeStyle = '#a3e4d7'; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(px+50, py-60); ctx.quadraticCurveTo(px+90, py-40, px+40, py+50); ctx.stroke();
        
        if (!state.milkAdded) {
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(px, py-75, 45, 18, 0, 0, Math.PI*2); ctx.fill();
        }
        state.tableHelperHitboxes['milk'] = {x: px - 50, y: py - 100, w: 100, h: 200};
        state.tableHelperHitboxes['egg'] = {x: ex - 48, y: ey - 48, w: 96, h: 96, r: 48};

        let sx = bowlX - bowlR - 60, sy = bowlY - 60;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.ellipse(sx, sy, 70, 35, 0, 0, Math.PI*2); ctx.fill();
        if (dish.items && !state.fruitAdded) {
            dish.items.forEach((ingObj, i) => {
                let id = typeof ingObj === 'string' ? ingObj : (ingObj.id || ingObj);
                if (id !== 'cocoa') {
                    drawIngredient3D(ctx, sx, sy - 10 - i*5, 60, id, true);
                }
            });
        }
        state.tableHelperHitboxes['slicedFruitBowl'] = {x: sx - 70, y: sy - 35, w: 140, h: 70};

        if (progress >= 1) {
            ctx.fillStyle = '#ff7f50';
            ctx.beginPath(); ctx.roundRect(w - 120, h/2 - 30, 100, 60, 30); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.moveTo(w-80, h/2-15); ctx.lineTo(w-50, h/2); ctx.lineTo(w-80, h/2+15); ctx.fill();
            state.nextBtnHitbox = {x: w - 120, y: h/2 - 30, w: 100, h: 60};
        } else {
            state.nextBtnHitbox = null;
        }
    }

    function drawStage3Bake(ctx, w, h, state) {
        const ovenW = Math.max(480, w * 0.6);
        const ovenH = Math.max(330, h * 0.5);
        const ovenX = w/2 - ovenW/2;
        const ovenY = h*0.5 - ovenH/2;

        state.ovenHitbox = {x: ovenX, y: ovenY, w: ovenW, h: ovenH};

        const bakeProg = state.bakeProgress || 0;
        let ograd = ctx.createLinearGradient(ovenX, ovenY, ovenX, ovenY+ovenH);
        ograd.addColorStop(0, '#A8E6CF'); ograd.addColorStop(1, '#68C3A3');
        ctx.fillStyle = ograd;
        ctx.beginPath(); ctx.roundRect(ovenX, ovenY, ovenW, ovenH, 28); ctx.fill();
        
        ctx.fillStyle = '#444';
        ctx.beginPath(); ctx.roundRect(ovenX + 20, ovenY + ovenH - 10, 20, 20, 5); ctx.fill();
        ctx.beginPath(); ctx.roundRect(ovenX + ovenW - 40, ovenY + ovenH - 10, 20, 20, 5); ctx.fill();
        
        ctx.fillStyle = '#55a688';
        ctx.beginPath(); ctx.roundRect(ovenX + ovenW - 100, ovenY, 100, ovenH, [0, 28, 28, 0]); ctx.fill();

        const winW = ovenW * 0.65;
        const winH = ovenH * 0.65;
        const winX = ovenX + 30;
        const winY = ovenY + 50;
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.roundRect(winX, winY, winW, winH, 15); ctx.fill();
        
        ctx.fillStyle = bakeProg > 0 ? '#ff5500' : '#444';
        ctx.shadowColor = bakeProg > 0 ? '#ff5500' : 'transparent'; ctx.shadowBlur = 15;
        ctx.fillRect(winX + 20, winY + 20, winW - 40, 10);
        ctx.fillRect(winX + 20, winY + winH - 30, winW - 40, 10);
        ctx.shadowBlur = 0;

        const dish = state.dish || {};
        const layerColors = dish.layerColors || ['#fffdd0'];
        const cakeH = 30 + bakeProg * 80; 
        
        const layerH = cakeH / layerColors.length;
        layerColors.forEach((col, idx) => {
            const ptrn = ctx.createPattern(getSpongeTexture(col), 'repeat');
            ctx.fillStyle = ptrn;
            const ly = winY + winH - 30 - cakeH + (layerColors.length - 1 - idx) * layerH;
            ctx.fillRect(winX + winW/2 - 100, ly, 200, layerH);
            if (idx === layerColors.length - 1) { 
                 ctx.beginPath(); ctx.ellipse(winX + winW/2, ly, 100, 25, 0, 0, Math.PI*2); ctx.fill();
            }
        });
        
        ctx.fillStyle = '#ccc'; 
        ctx.fillRect(winX + winW/2 - 110, winY + winH - 40, 220, 20);

        if (bakeProg > 0) {
            ctx.fillStyle = `rgba(255, 150, 0, ${0.2 + bakeProg * 0.3})`;
            ctx.beginPath(); ctx.roundRect(winX, winY, winW, winH, 15); ctx.fill();
        }

        ctx.fillStyle = '#eee';
        ctx.beginPath(); ctx.roundRect(winX - 10, winY - 30, winW + 20, 15, 7); ctx.fill();

        drawHeart(ctx, ovenX + ovenW - 50, ovenY + 22, 16);

        for(let i=0; i<2; i++) {
            let dx = ovenX + ovenW - 50;
            let dy = ovenY + 100 + i*80;
            ctx.fillStyle = '#fffdd0';
            ctx.beginPath(); ctx.arc(dx, dy, 25, 0, Math.PI*2); ctx.fill();
            ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 5;
            ctx.fillStyle = '#eee';
            ctx.beginPath(); ctx.arc(dx, dy, 20, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#444';
            for(let t=0; t<6; t++) {
                ctx.beginPath(); ctx.arc(dx + Math.cos(t*Math.PI/3)*30, dy + Math.sin(t*Math.PI/3)*30, 2, 0, Math.PI*2); ctx.fill();
            }
            let pa = i === 0 ? Math.PI + bakeProg*Math.PI : -Math.PI/4;
            ctx.strokeStyle = '#444'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + Math.cos(pa)*15, dy + Math.sin(pa)*15); ctx.stroke();
        }

        if (bakeProg >= 1) {
            ctx.fillStyle = '#ff7f50';
            ctx.beginPath(); ctx.roundRect(w - 120, h/2 - 30, 100, 60, 30); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.moveTo(w-80, h/2-15); ctx.lineTo(w-50, h/2); ctx.lineTo(w-80, h/2+15); ctx.fill();
            state.nextBtnHitbox = {x: w - 120, y: h/2 - 30, w: 100, h: 60};
        } else {
            state.nextBtnHitbox = null;
        }
    }

    const RAINBOW = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#8b00ff'];

    function drawPipingBag3D(ctx, x, y, active) {
        ctx.save();
        ctx.translate(x, y);
        if (active) {
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 20;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(0, 35, 30, 10, 0, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;

        let grad = ctx.createLinearGradient(-30, 0, 30, 0);
        grad.addColorStop(0, '#ff99cc');
        grad.addColorStop(0.3, '#ffe6f2');
        grad.addColorStop(1, '#ff3385');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -40); 
        ctx.quadraticCurveTo(35, 10, 20, 30);
        ctx.lineTo(-20, 30);
        ctx.quadraticCurveTo(-35, 10, 0, -40);
        ctx.fill();

        let met = ctx.createLinearGradient(-10, 30, 10, 30);
        met.addColorStop(0, '#ccc');
        met.addColorStop(0.5, '#fff');
        met.addColorStop(1, '#999');
        ctx.fillStyle = met;
        ctx.beginPath();
        ctx.moveTo(-20, 30); ctx.lineTo(20, 30);
        ctx.lineTo(10, 45); ctx.lineTo(-10, 45);
        ctx.fill();
        ctx.restore();
    }

    function drawCandyBowl3D(ctx, x, y, active) {
        ctx.save();
        ctx.translate(x, y);
        if (active) {
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 20;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(0, 15, 65, 25, 0, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#e6e6e6';
        ctx.beginPath(); ctx.ellipse(0, -10, 60, 20, 0, Math.PI, Math.PI*2); ctx.fill();

        for(let i=0; i<15; i++) {
            let cx = (Math.random()-0.5)*80;
            let cy = -15 + (Math.random()-0.5)*15;
            if (cx*cx/(50*50) + (cy+15)*(cy+15)/(15*15) > 1) continue;
            ctx.fillStyle = RAINBOW[i%RAINBOW.length];
            ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.beginPath(); ctx.arc(cx-2, cy-2, 3, 0, Math.PI*2); ctx.fill();
        }
        
        ctx.save(); ctx.translate(10, -20); ctx.scale(0.6, 0.6); drawIngredient3D(ctx, 0, 0, 50, 'strawberry', true); ctx.restore();

        let grad = ctx.createRadialGradient(0, 5, 10, 0, 10, 60);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.8, '#f2f2f2');
        grad.addColorStop(1, '#cccccc');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.ellipse(0, -10, 60, 20, 0, 0, Math.PI); 
        ctx.bezierCurveTo(60, 30, -60, 30, -60, -10);
        ctx.fill();
        ctx.restore();
    }

    function drawCakeKnife3D(ctx, x, y, active) {
        ctx.save();
        ctx.translate(x, y);
        if (active) {
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 20;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(0, 15, 75, 15, 0, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;

        let met = ctx.createLinearGradient(-50, -10, -50, 10);
        met.addColorStop(0, '#eee');
        met.addColorStop(0.5, '#fff');
        met.addColorStop(1, '#999');
        ctx.fillStyle = met;
        ctx.beginPath();
        ctx.moveTo(-70, 5);
        ctx.lineTo(20, 5);
        ctx.lineTo(20, -15);
        ctx.quadraticCurveTo(-50, -15, -70, 5);
        ctx.fill();

        let wood = ctx.createLinearGradient(20, -10, 20, 10);
        wood.addColorStop(0, '#5c3a21');
        wood.addColorStop(0.3, '#8b5a2b');
        wood.addColorStop(1, '#3a2110');
        ctx.fillStyle = wood;
        ctx.beginPath(); ctx.roundRect(20, -10, 50, 20, 10); ctx.fill();
        ctx.restore();
    }

    function drawSpoon3D(ctx, x, y, active) {
        ctx.save();
        ctx.translate(x, y);
        if (active) {
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 20;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(0, 10, 65, 15, 0, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;

        let met = ctx.createLinearGradient(-40, -10, 40, 10);
        met.addColorStop(0, '#ddd');
        met.addColorStop(0.5, '#fff');
        met.addColorStop(1, '#aaa');
        
        ctx.fillStyle = met;
        ctx.beginPath(); ctx.roundRect(-20, -5, 80, 10, 5); ctx.fill();
        
        ctx.beginPath(); ctx.ellipse(-40, 0, 30, 20, 0, 0, Math.PI*2); ctx.fill();
        
        let inner = ctx.createLinearGradient(-50, -10, -30, 10);
        inner.addColorStop(0, '#888');
        inner.addColorStop(1, '#eee');
        ctx.fillStyle = inner;
        ctx.beginPath(); ctx.ellipse(-40, 0, 24, 15, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    function drawStage4DecorateAndFeed(ctx, w, h, state) {
        state.tableToolHitboxes = {};
        const cx = w/2;
        const cy = h*0.68;
        const r = Math.max(200, w*0.3);
        const cakeH = 120;
        const critterY = 95;

        const dish = state.dish || {};
        const friend = state.friend || 'bobby';
        const bitesTaken = (dish.bitesTaken !== undefined) ? dish.bitesTaken : (state.bitesTaken || 0);
        const isWedgeCut = (dish.slicedWedge !== undefined) ? dish.slicedWedge : state.slicedWedge;

        state.cakeHitbox = {x: cx - r*0.85, y: cy - cakeH, w: r*1.7, h: cakeH + r*0.6, cx: cx, cy: cy, rx: cx - r*0.85, ry: cy - cakeH - r*0.3};
        state.critterHitbox = {x: cx - 80, y: critterY - 80, w: 160, h: 160, r: 80};



        ctx.fillStyle = '#e0e0e0';
        ctx.beginPath(); ctx.ellipse(cx, cy+60, r*1.1, r*0.4, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(cx, cy+40, r*1.1, r*0.4, 0, 0, Math.PI*2); ctx.fill();

        const layerColors = dish.layerColors || ['#ff9999'];
        const baseColor = layerColors[0] || '#ff9999';

        if (!isWedgeCut) {
            const layerH = cakeH / layerColors.length;
            layerColors.forEach((col, idx) => {
                const ptrn = ctx.createPattern(getSpongeTexture(col), 'repeat');
                ctx.fillStyle = ptrn;
                const ly = cy - cakeH + (layerColors.length - 1 - idx) * layerH;
                if (idx === 0) {
                     ctx.beginPath(); ctx.ellipse(cx, cy, r*0.8, r*0.3, 0, 0, Math.PI*2); ctx.fill();
                }
                ctx.fillRect(cx - r*0.8, ly, r*1.6, layerH);
            });
            
            ctx.fillStyle = dish.frostingColor || baseColor;
            ctx.beginPath(); ctx.ellipse(cx, cy - cakeH, r*0.8, r*0.3, 0, 0, Math.PI*2); ctx.fill();
            let topGrad = ctx.createLinearGradient(cx - r*0.8, cy - cakeH, cx + r*0.8, cy - cakeH);
            topGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
            topGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
            topGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
            ctx.fillStyle = topGrad;
            ctx.fill();
        } else {
            const layerH = cakeH / layerColors.length;

            layerColors.forEach((col, idx) => {
                const ptrn = ctx.createPattern(getSpongeTexture(col), 'repeat');
                ctx.fillStyle = ptrn;
                const ly = cy - cakeH + (layerColors.length - 1 - idx) * layerH;
                
                ctx.beginPath();
                ctx.ellipse(cx, ly, r*0.8, r*0.3, 0, 0.45, Math.PI*2 - 0.45);
                ctx.ellipse(cx, ly + layerH, r*0.8, r*0.3, 0, Math.PI*2 - 0.45, 0.45, true);
                ctx.closePath();
                ctx.fill();
            });

            ctx.fillStyle = dish.frostingColor || baseColor;
            ctx.beginPath(); 
            ctx.moveTo(cx, cy - cakeH); 
            ctx.ellipse(cx, cy - cakeH, r*0.8, r*0.3, 0, 0.45, Math.PI*2 - 0.45); 
            ctx.closePath(); 
            ctx.fill();

            let topGrad = ctx.createLinearGradient(cx - r*0.8, cy - cakeH, cx + r*0.8, cy - cakeH);
            topGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
            topGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
            topGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
            ctx.fillStyle = topGrad;
            ctx.beginPath(); 
            ctx.moveTo(cx, cy - cakeH); 
            ctx.ellipse(cx, cy - cakeH, r*0.8, r*0.3, 0, 0.45, Math.PI*2 - 0.45); 
            ctx.closePath(); 
            ctx.fill();

            layerColors.forEach((col, idx) => {
                const ptrn = ctx.createPattern(getSpongeTexture(col), 'repeat');
                ctx.fillStyle = ptrn;
                const ly = cy - cakeH + (layerColors.length - 1 - idx) * layerH;
                
                ctx.beginPath(); ctx.moveTo(cx, ly); ctx.lineTo(cx + Math.cos(0.45)*r*0.8, ly + Math.sin(0.45)*r*0.3); ctx.lineTo(cx + Math.cos(0.45)*r*0.8, ly + layerH + Math.sin(0.45)*r*0.3); ctx.lineTo(cx, ly + layerH); ctx.fill();
                ctx.beginPath(); ctx.moveTo(cx, ly); ctx.lineTo(cx + Math.cos(-0.45)*r*0.8, ly + Math.sin(-0.45)*r*0.3); ctx.lineTo(cx + Math.cos(-0.45)*r*0.8, ly + layerH + Math.sin(-0.45)*r*0.3); ctx.lineTo(cx, ly + layerH); ctx.fill();
            });

            const px = cx + r*1.5; const py = cy + 60;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(px, py, 90, 40, 0, 0, Math.PI*2); ctx.fill();
            
            const sliceH = cakeH*0.6; const slH = sliceH / layerColors.length;
            const sx = px; const sy = py - 10 - sliceH;
            
            layerColors.forEach((col, idx) => {
                const ptrn = ctx.createPattern(getSpongeTexture(col), 'repeat');
                ctx.fillStyle = ptrn;
                const ly = sy + (layerColors.length - 1 - idx) * slH;
                ctx.beginPath(); ctx.moveTo(sx, ly); ctx.lineTo(sx - 40, ly + 20); ctx.lineTo(sx - 40, ly + 20 + slH); ctx.lineTo(sx, ly + slH); ctx.fill();
                ctx.beginPath(); ctx.moveTo(sx, ly); ctx.lineTo(sx + 50, ly + 10); ctx.lineTo(sx + 50, ly + 10 + slH); ctx.lineTo(sx, ly + slH); ctx.fill();
            });
            
            ctx.fillStyle = dish.frostingColor || baseColor;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 40, sy + 20); ctx.lineTo(sx + 20, sy + 30); ctx.lineTo(sx + 50, sy + 10); ctx.fill();
            drawIngredient3D(ctx, sx + 5, sy + 10, 30, 'strawberry', false);
        }

        const cakeX = state.cakeHitbox.x;
        const cakeY = state.cakeHitbox.y;

        if (dish.rosettes) {
            dish.rosettes.forEach(ros => {
                let rx = ros.x; let ry = ros.y;
                if (rx < cx - r) { rx += cakeX; ry += cakeY; }
                ctx.fillStyle = '#FFFDF9';
                ctx.beginPath(); ctx.arc(rx, ry, 18, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = ros.color || (dish.frostingColor === '#ffffff' ? '#FF99BB' : (dish.frostingColor || '#FF99BB'));
                ctx.beginPath(); ctx.arc(rx, ry, 13, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#FFFDF9';
                ctx.beginPath(); ctx.arc(rx, ry, 8, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#FF2255';
                ctx.beginPath(); ctx.arc(rx, ry, 4.5, 0, Math.PI*2); ctx.fill();
            });
        }

        if (dish.candyBalls) {
            dish.candyBalls.forEach((cb, i) => {
                let cx_b = cb.x; let cy_b = cb.y;
                if (cx_b < cx - r) { cx_b += cakeX; cy_b += cakeY; }
                let color = cb.color;
                if (!color) {
                    let seed = Math.floor(cb.seed !== undefined ? cb.seed : i);
                    color = RAINBOW[seed % RAINBOW.length] || '#ff0000';
                }
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(cx_b, cy_b, 10, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.beginPath(); ctx.arc(cx_b - 3, cy_b - 3, 4, 0, Math.PI*2); ctx.fill();
            });
        }

        if (dish.toppings) {
            dish.toppings.forEach(tp => {
                let tx = tp.x; let ty = tp.y;
                if (tx < cx - r) { tx += cakeX; ty += cakeY; }
                drawIngredient3D(ctx, tx, ty, 45, tp.id || tp.kind, true);
            });
        }

        let px = cx - r*1.2, py = cy + 50;
        drawPipingBag3D(ctx, px, py, state.activeTool === 'piping');
        state.tableToolHitboxes['piping'] = {x: px - 40, y: py - 40, w: 80, h: 80, r: 60};

        let cx2 = cx - r*0.6, cy2 = cy + 120;
        drawCandyBowl3D(ctx, cx2, cy2, state.activeTool === 'candy');
        state.tableToolHitboxes['candy'] = {x: cx2 - 60, y: cy2 - 30, w: 120, h: 60, r: 60};

        let kx = cx + r*0.6, ky = cy + 120;
        drawCakeKnife3D(ctx, kx, ky, state.activeTool === 'knife');
        state.tableToolHitboxes['knife'] = {x: kx - 70, y: ky - 20, w: 140, h: 40, r: 60};

        let sx = cx + r*1.2, sy = cy + 50;
        drawSpoon3D(ctx, sx, sy, state.activeTool === 'spoon');
        state.tableToolHitboxes['spoon'] = {x: sx - 70, y: sy - 20, w: 130, h: 40, r: 60};
    }

    return {
        drawFrame: function(ctx, w, h, state) {
            loadImages();
            ctx.save();
            ctx.clearRect(0, 0, w, h);
            drawTabletop(ctx, w, h, state);

            const stage = state.stage || state.station || 1;
            
            if (stage === 1) {
                drawStage1Prep(ctx, w, h, state);
            } else if (stage === 2) {
                drawStage2Mix(ctx, w, h, state);
            } else if (stage === 3) {
                drawStage3Bake(ctx, w, h, state);
            } else if (stage === 4 || stage === 5) {
                drawStage4DecorateAndFeed(ctx, w, h, state);
            }

            ctx.restore();
        },
        drawButtonIcon: function(canvas, kind) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width; const h = canvas.height;
            ctx.clearRect(0,0,w,h);
            ctx.save();
            if (kind === 'stage1') {
                ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.ellipse(w/2, h/2+5, 20, 10, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#d4a373'; ctx.beginPath(); ctx.ellipse(w/2, h/2, 20, 10, 0, 0, Math.PI*2); ctx.fill();
                drawSingleIngredient(ctx, w/2-5, h/2, 16, 'strawberry', false);
                ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(w/2+5, h/2-15); ctx.lineTo(w/2+15, h/2+5); ctx.lineTo(w/2+20, h/2+5); ctx.fill();
                ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(w/2+15, h/2+5, 5, 15, 2); ctx.fill();
            } else if (kind === 'stage2') {
                ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(w/2, h/2+10, 20, 10, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ff99cc'; ctx.beginPath(); ctx.ellipse(w/2, h/2+10, 18, 8, 0, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(w/2, h/2-5, 5, 15, 0, 0, Math.PI*2); ctx.stroke();
            } else if (kind === 'stage3') {
                ctx.fillStyle = '#A8E6CF'; ctx.beginPath(); ctx.roundRect(w/2-20, h/2-15, 40, 30, 5); ctx.fill();
                ctx.fillStyle = '#ff5500'; ctx.beginPath(); ctx.roundRect(w/2-10, h/2-5, 20, 15, 2); ctx.fill();
            } else if (kind === 'stage4') {
                ctx.fillStyle = '#ffcce6'; ctx.fillRect(w/2-15, h/2-5, 30, 15);
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w/2, h/2-5, 15, 5, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.arc(w/2, h/2-10, 4, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
        }
    };
})();