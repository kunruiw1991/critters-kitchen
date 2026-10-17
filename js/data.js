window.KitchenData = {
  critters: [
    { id: 'bobby', color: '#ff4455', spritePrefix: 'chef_bobby' },
    { id: 'catnap', color: '#8866dd', spritePrefix: 'chef_catnap' },
    { id: 'dogday', color: '#ffaa33', spritePrefix: 'chef_dogday' }
  ],
  ingredients: {
    strawberry: {
      primary: '#ff3355',
      secondary: '#ff8899',
      flesh: '#ff99aa',
      seed: '#ffffaa',
      sponge: '#ff99bb',
      frosting: '#ffddee',
      glaze: '#ff3366'
    },
    banana: {
      primary: '#ffdd33',
      secondary: '#ffee88',
      flesh: '#fff3a8',
      seed: '#886644',
      sponge: '#ffe878',
      frosting: '#fff6cc',
      glaze: '#ffcc22'
    },
    kiwi: {
      primary: '#77cc33',
      secondary: '#aadd66',
      flesh: '#b8f272',
      seed: '#222222',
      sponge: '#9be858',
      frosting: '#dcffbb',
      glaze: '#66cc22'
    },
    blueberry: {
      primary: '#5566ff',
      secondary: '#7799ff',
      flesh: '#99b4ff',
      seed: '#222255',
      sponge: '#8ca6ff',
      frosting: '#dce4ff',
      glaze: '#4455ee'
    },
    peach: {
      primary: '#ff8855',
      secondary: '#ffaa88',
      flesh: '#ffc299',
      seed: '#aa4422',
      sponge: '#ffad7a',
      frosting: '#ffe4d1',
      glaze: '#ff7744'
    },
    cocoa: {
      primary: '#5C3A21',
      secondary: '#7A4B2A',
      flesh: '#6E4224',
      seed: '#3B2210',
      sponge: '#6B4226',
      frosting: '#5C3A21',
      glaze: '#3E2412',
      isCocoa: true
    }
  },
  helpers: ['egg', 'milk', 'fruit'],

  paletteFor(ingredientIds) {
    const defaultColor = '#ffd999';
    let isCocoa = false;
    let dominantId = null;
    let r = 0, g = 0, b = 0, count = 0;

    const parseHex = (hex) => {
      if (!hex) return [255, 255, 255];
      const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
      return [255, 255, 255];
    };

    const toHex = (rgb) => '#' + rgb.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');

    if (!ingredientIds || ingredientIds.length === 0) {
      return {
        batterTint: defaultColor,
        layerColors: ['#ffadc6', '#ffe878', '#9be858'],
        frostingColor: '#fff8f2',
        glazeColor: '#ff88aa',
        isCocoa: false,
        dominantId: 'strawberry'
      };
    }

    ingredientIds.forEach(id => {
      const item = this.ingredients[id];
      if (item) {
        if (!dominantId) dominantId = id;
        if (item.isCocoa) isCocoa = true;
        const rgb = parseHex(item.sponge || item.primary);
        r += rgb[0];
        g += rgb[1];
        b += rgb[2];
        count++;
      }
    });

    if (count > 0) {
      r /= count;
      g /= count;
      b /= count;
    } else {
      r = 255;
      g = 217;
      b = 153;
    }

    const mixedColor = toHex([r, g, b]);
    const dom = dominantId ? this.ingredients[dominantId] : null;

    let layerColors;
    if (ingredientIds.length === 1) {
      const c1 = dom ? dom.sponge : defaultColor;
      const c2 = dom ? (dom.flesh || dom.secondary) : mixedColor;
      layerColors = [c1, c2, c1];
    } else if (ingredientIds.length === 2) {
      const c1 = this.ingredients[ingredientIds[0]]?.sponge || defaultColor;
      const c2 = this.ingredients[ingredientIds[1]]?.sponge || defaultColor;
      layerColors = [c1, c2, c1];
    } else {
      layerColors = ingredientIds.slice(0, 3).map(id => this.ingredients[id]?.sponge || defaultColor);
    }

    return {
      batterTint: mixedColor,
      layerColors,
      frostingColor: isCocoa ? '#5C3A21' : (dom ? dom.frosting : '#fff8f2'),
      glazeColor: isCocoa ? '#3E2412' : (dom ? dom.glaze : mixedColor),
      isCocoa,
      dominantId: dominantId || 'strawberry'
    };
  }
};
