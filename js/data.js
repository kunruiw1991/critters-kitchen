window.KitchenData = {
  critters: [
    { id: 'bobby', color: '#ff4444' },
    { id: 'craftycorn', color: '#ffffff' },
    { id: 'catnap', color: '#6644aa' },
    { id: 'dogday', color: '#ffaa22' },
    { id: 'hoppy', color: '#44ff44' },
    { id: 'picky', color: '#ff88cc' },
    { id: 'bubba', color: '#44ccff' },
    { id: 'kickin', color: '#ddff22' }
  ],
  ingredients: {
    strawberry: { primary: '#ff3355', secondary: '#ff8899', flesh: '#ffcccc', seed: '#ffffaa', sponge: '#ffcce6', frosting: '#ff99cc', glaze: '#ff4477' },
    banana: { primary: '#ffdd33', secondary: '#ffee88', flesh: '#ffffcc', seed: '#886644', sponge: '#ffffbb', frosting: '#ffeeaa', glaze: '#ffcc44' },
    kiwi: { primary: '#88cc44', secondary: '#aadd66', flesh: '#ccff88', seed: '#222222', sponge: '#ddffaa', frosting: '#bbff88', glaze: '#88ee33' },
    blueberry: { primary: '#4466ff', secondary: '#6688ff', flesh: '#aaccff', seed: '#222255', sponge: '#ccccff', frosting: '#88aaff', glaze: '#5577ff' },
    peach: { primary: '#ff8866', secondary: '#ffaa88', flesh: '#ffccaa', seed: '#aa4422', sponge: '#ffddcc', frosting: '#ffbb99', glaze: '#ff9977' },
    cocoa: { primary: '#663322', secondary: '#884433', flesh: '#552211', seed: '#331100', sponge: '#774433', frosting: '#552211', glaze: '#441100', isCocoa: true }
  },
  helpers: ['egg', 'milk', 'butter'],

  paletteFor(ingredientIds) {
    const defaultColor = '#ffccaa';
    let isCocoa = false;
    let dominantId = null;
    let r = 0, g = 0, b = 0, count = 0;

    const parseHex = (hex) => {
      if (!hex) return [255,255,255];
      const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      if (m) return [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)];
      return [255,255,255];
    };

    const toHex = (rgb) => '#' + rgb.map(x => Math.round(x).toString(16).padStart(2,'0')).join('');

    if (!ingredientIds || ingredientIds.length === 0) {
      return {
        batterTint: defaultColor,
        layerColors: [defaultColor, '#ffbb99'],
        frostingColor: '#ffffff',
        glazeColor: '#ffbb99',
        isCocoa: false,
        dominantId: 'vanilla'
      };
    }

    ingredientIds.forEach(id => {
      const item = this.ingredients[id];
      if (item) {
        if (!dominantId) dominantId = id;
        if (item.isCocoa) isCocoa = true;
        const rgb = parseHex(item.primary);
        r += rgb[0]; g += rgb[1]; b += rgb[2];
        count++;
      }
    });

    if (count > 0) {
      r /= count; g /= count; b /= count;
    } else {
      r = 255; g = 204; b = 170;
    }

    const mixedColor = toHex([r,g,b]);
    const dom = dominantId ? this.ingredients[dominantId] : null;

    return {
      batterTint: dom ? dom.sponge : defaultColor,
      layerColors: ingredientIds.length > 0 
        ? (ingredientIds.length === 1 
            ? [dom.sponge, dom.flesh || dom.primary] 
            : ingredientIds.map(id => this.ingredients[id]?.sponge || defaultColor))
        : [defaultColor, mixedColor],
      frostingColor: dom ? dom.frosting : '#ffffff',
      glazeColor: dom ? dom.glaze : mixedColor,
      isCocoa: isCocoa,
      dominantId: dominantId || 'vanilla'
    };
  }
};
