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

    function drawTabletop(ctx, w, h) {
        const ptrn = ctx.createPattern(getWoodTexture(), 'repeat');
        ctx.fillStyle = ptrn;
        ctx.fillRect(0, h * 0.2, w, h * 0.8);
        
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, h * 0.2, w, 15);
        
        const grad = ctx.createLinearGradient(0, 0, 0, h*0.2);
        grad.addColorStop(0, '#fefae0');
        grad.addColorStop(1, '#faedcd');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h*0.2);
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
            ctx.fillStyle = isSlice ? '#ffcccc' : '#ffff66';
            if (isSlice) {
                 ctx.beginPath(); ctx.ellipse(0, 0, size/4, size/6, 0, 0, Math.PI*2); ctx.fill();
            } else {
                 for(let i=0; i<15; i++) {
                     ctx.fillRect((Math.random()-0.5)*size*0.6, (Math.random()-0.5)*size*0.6, 2, 2);
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
                ctx.ellipse(0, 0, size/2, size/4, Math.PI/6, 0, Math.PI*2); ctx.fill();
            }
        } else if (type === 'kiwi') {
            grad.addColorStop(0, '#ccff99');
            grad.addColorStop(0.6, '#66cc00');
            grad.addColorStop(1, '#336600');
            ctx.fillStyle = isSlice ? grad : '#663300';
            ctx.beginPath();
            ctx.ellipse(0, 0, size/2, size/2.5, 0, 0, Math.PI*2);
            ctx.fill();
            if (isSlice) {
                ctx.fillStyle = '#e6ffcc';
                ctx.beginPath(); ctx.arc(0,0,size/5,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = '#000000';
                for(let i=0; i<12; i++) {
                    let a = i * Math.PI / 6;
                    ctx.beginPath(); ctx.arc(Math.cos(a)*size/3, Math.sin(a)*size/3, size/20, 0, Math.PI*2); ctx.fill();
                }
            }
        } else if (type === 'blueberry') {
            grad.addColorStop(0, '#9999ff');
            grad.addColorStop(0.7, '#3333cc');
            grad.addColorStop(1, '#000066');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, size/2, 0, Math.PI*2);
            ctx.fill();
        } else if (type === 'peach') {
            grad.addColorStop(0, '#ffccaa');
            grad.addColorStop(0.7, '#ff9966');
            grad.addColorStop(1, '#cc6633');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, size/2, 0, Math.PI*2);
            ctx.fill();
        } else if (type === 'cocoa') {
            grad.addColorStop(0, '#8c5220');
            grad.addColorStop(0.7, '#4a2505');
            grad.addColorStop(1, '#241000');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(0, 0, size/3, size/2, 0, 0, Math.PI*2);
            ctx.fill();
        } else if (type === 'egg') {
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.7, '#ffeadb');
            grad.addColorStop(1, '#e0c8b6');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(0, 0, size/2, size/1.6, 0, 0, Math.PI*2);
            ctx.fill();
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
                let r = i * 12;
                if(i===0) ctx.moveTo(Math.cos(i)*r, Math.sin(i)*r*0.4);
                else ctx.lineTo(Math.cos(i)*r, Math.sin(i)*r*0.4);
            }
            ctx.stroke();
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
        if (!state.eggAdded) {
            drawIngredient3D(ctx, ex, ey, 96, 'egg', false);
        }
        state.tableHelperHitboxes['egg'] = {x: ex - 48, y: ey - 48, w: 96, h: 96, r: 48};
        
        let px = bowlX + bowlR + 60, py = bowlY + 60;
        ctx.fillStyle = '#e6f2ff'; 
        ctx.beginPath(); ctx.ellipse(px, py, 50, 100, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#cce6ff'; 
        ctx.beginPath(); ctx.ellipse(px, py - 100, 50, 20, 0, 0, Math.PI*2); ctx.fill();
        state.tableHelperHitboxes['milk'] = {x: px - 50, y: py - 100, w: 100, h: 200};

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

        ctx.fillStyle = '#98ff98'; 
        ctx.fillRect(ovenX, ovenY, ovenW, ovenH);
        
        ctx.fillStyle = '#444';
        const winW = ovenW * 0.7;
        const winH = ovenH * 0.6;
        const winX = ovenX + 20;
        const winY = ovenY + 20;
        ctx.fillRect(winX, winY, winW, winH);

        const bakeProg = state.bakeProgress || 0;
        if (bakeProg > 0) {
            ctx.fillStyle = `rgba(255, 150, 0, ${bakeProg * 0.5})`;
            ctx.fillRect(winX, winY, winW, winH);
        }

        const dish = state.dish || {};
        const layerColors = dish.layerColors || ['#fffdd0'];
        const cakeH = 30 + bakeProg * 80; 
        
        const layerH = cakeH / layerColors.length;
        layerColors.forEach((col, idx) => {
            const ptrn = ctx.createPattern(getSpongeTexture(col), 'repeat');
            ctx.fillStyle = ptrn;
            const ly = winY + winH - 20 - cakeH + (layerColors.length - 1 - idx) * layerH;
            ctx.fillRect(winX + winW/2 - 100, ly, 200, layerH);
            if (idx === layerColors.length - 1) { 
                 ctx.beginPath(); ctx.ellipse(winX + winW/2, ly, 100, 25, 0, 0, Math.PI*2); ctx.fill();
            }
        });
        
        ctx.fillStyle = '#ccc'; 
        ctx.fillRect(winX + winW/2 - 110, winY + winH - 30, 220, 30);

        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ovenX + ovenW - 50, ovenY + 50, 25, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(ovenX + ovenW - 50, ovenY + 120, 25, 0, Math.PI*2); ctx.fill();

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

        if (IMAGES[friend] && IMAGES[friend].complete) {
            ctx.save();
            ctx.translate(cx, critterY);
            
            if (bitesTaken > 0) {
                ctx.drawImage(IMAGES[friend], -80, -80, 160, 160);
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.ellipse(0, 30, 25, 30, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ff69b4';
                for(let i=0; i<6; i++) {
                    ctx.beginPath(); ctx.arc(-60 + i*24, -60 - (bitesTaken%5)*15 + Math.sin(i)*10, 10, 0, Math.PI*2); ctx.fill(); 
                }
            } else if (state.activeTool === 'spoon') {
                ctx.drawImage(IMAGES[friend], -80, -80, 160, 160);
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.ellipse(0, 25, 20, 25, 0, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.drawImage(IMAGES[friend], -80, -80, 160, 160);
            }
            ctx.restore();
        }

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
                ctx.ellipse(cx, ly, r*0.8, r*0.3, 0, 0.5, Math.PI*2 - 0.5);
                ctx.ellipse(cx, ly + layerH, r*0.8, r*0.3, 0, Math.PI*2 - 0.5, 0.5, true);
                ctx.closePath();
                ctx.fill();
            });

            ctx.fillStyle = dish.frostingColor || baseColor;
            ctx.beginPath(); 
            ctx.moveTo(cx, cy - cakeH); 
            ctx.ellipse(cx, cy - cakeH, r*0.8, r*0.3, 0, 0.5, Math.PI*2 - 0.5); 
            ctx.closePath(); 
            ctx.fill();

            let topGrad = ctx.createLinearGradient(cx - r*0.8, cy - cakeH, cx + r*0.8, cy - cakeH);
            topGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
            topGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
            topGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
            ctx.fillStyle = topGrad;
            ctx.beginPath(); 
            ctx.moveTo(cx, cy - cakeH); 
            ctx.ellipse(cx, cy - cakeH, r*0.8, r*0.3, 0, 0.5, Math.PI*2 - 0.5); 
            ctx.closePath(); 
            ctx.fill();

            layerColors.forEach((col, idx) => {
                const ptrn = ctx.createPattern(getSpongeTexture(col), 'repeat');
                ctx.fillStyle = ptrn;
                const ly = cy - cakeH + (layerColors.length - 1 - idx) * layerH;
                
                ctx.beginPath(); ctx.moveTo(cx, ly); ctx.lineTo(cx + Math.cos(0.5)*r*0.8, ly + Math.sin(0.5)*r*0.3); ctx.lineTo(cx + Math.cos(0.5)*r*0.8, ly + layerH + Math.sin(0.5)*r*0.3); ctx.lineTo(cx, ly + layerH); ctx.fill();
                ctx.beginPath(); ctx.moveTo(cx, ly); ctx.lineTo(cx + Math.cos(-0.5)*r*0.8, ly + Math.sin(-0.5)*r*0.3); ctx.lineTo(cx + Math.cos(-0.5)*r*0.8, ly + layerH + Math.sin(-0.5)*r*0.3); ctx.lineTo(cx, ly + layerH); ctx.fill();
            });

            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(cx + r*1.5, cy + 60, 90, 40, 0, 0, Math.PI*2); ctx.fill();
            
            layerColors.forEach((col, idx) => {
                const ptrn = ctx.createPattern(getSpongeTexture(col), 'repeat');
                ctx.fillStyle = ptrn;
                const ly = cy + 40 - cakeH/2 + (layerColors.length - 1 - idx) * layerH/2; 
                ctx.beginPath(); ctx.moveTo(cx+r*1.5, ly); ctx.lineTo(cx+r*1.5-40, ly+30); ctx.lineTo(cx+r*1.5+40, ly+30); ctx.lineTo(cx+r*1.5, ly + layerH/2); ctx.fill();
            });
        }

        const cakeX = state.cakeHitbox.x;
        const cakeY = state.cakeHitbox.y;

        if (dish.rosettes) {
            dish.rosettes.forEach(ros => {
                let rx = ros.x; let ry = ros.y;
                if (rx < cx - r) { rx += cakeX; ry += cakeY; }
                ctx.fillStyle = ros.color || dish.frostingColor || '#ff9999';
                ctx.beginPath(); ctx.arc(rx, ry, 18, 0, Math.PI*2); ctx.fill();
                let rgrad = ctx.createRadialGradient(rx - 5, ry - 5, 2, rx, ry, 18);
                rgrad.addColorStop(0, 'rgba(255,255,255,0.8)');
                rgrad.addColorStop(1, 'rgba(0,0,0,0.2)');
                ctx.fillStyle = rgrad;
                ctx.fill();
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
            drawTabletop(ctx, w, h);

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
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const s = Math.min(canvas.width, canvas.height);
            drawIngredient3D(ctx, canvas.width/2, canvas.height/2, s*0.8, kind, false);
        }
    };
})();