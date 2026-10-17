'use strict';
/* ==========================================================================
 * Chuyu's Rainbow Kitchen (楚楚的彩虹料理屋) — Game Data & Recipes
 * Inspired by HT Mini Cakes (zuCz-X1TrMM): Strawberry Shortcake, Six-Layer
 * Rainbow Rosette Cake, Cocoa Candy Ball Cake, fruit jelly & glazes.
 * Designed for 5-year-old tactile play: ingredients, 8 Critter customers,
 * colourful signature orders, 8 piping creams, 8 glazes and fruit toppings.
 *
 * COLOUR CAUSALITY RULE: every sponge / batter / cream colour in the game is
 * derived from the ingredients the player actually used (see paletteFor()).
 * Dark chocolate appears ONLY when 'chocolate' or 'cocoa' is really present.
 * ========================================================================== */
const KitchenData = (() => {
  const CRITTERS = [
    {
      id: 'craftycorn', name: '独角兽 CraftyCorn', en: 'CraftyCorn', icon: 'craftycorn',
      color: '#5cc8ff', earType: 'unicorn', bellyColor: '#d6f3ff',
      greeting: '哇~ 我想要六层彩虹玫瑰裱花蛋糕！',
      favTag: 'rainbow',
    },
    {
      id: 'bobby', name: '爱心小熊 Bobby', en: 'Bobby BearHug', icon: 'bobby',
      color: '#ff5978', earType: 'bear', bellyColor: '#ffc2ce',
      greeting: '抱抱~ 我最爱粉粉的草莓鲜奶油蛋糕啦！',
      favTag: 'sweet',
    },
    {
      id: 'catnap', name: '紫猫 CatNap', en: 'CatNap', icon: 'catnap',
      color: '#9b72ee', earType: 'cat', bellyColor: '#d9c6ff',
      greeting: '喵呜~ 我想要蓝莓云朵蛋糕！',
      favTag: 'sleepy',
    },
    {
      id: 'picky', name: '小粉猪 PickyPiggy', en: 'PickyPiggy', icon: 'picky',
      color: '#ff80b5', earType: 'pig', bellyColor: '#ffd1e6',
      greeting: '哼哼~ 想吃水蜜桃奶油松饼塔，还有大汉堡！',
      favTag: 'savory',
    },
    {
      id: 'dogday', name: '阳光小狗 DogDay', en: 'DogDay', icon: 'dogday',
      color: '#ff9636', earType: 'dog', bellyColor: '#ffe0b2',
      greeting: '汪汪！来一份阳光柠檬蜂蜜塔吧！',
      favTag: 'sunny',
    },
    {
      id: 'hoppy', name: '跳跳绿兔 Hoppy', en: 'Hoppy Hopscotch', icon: 'hoppy',
      color: '#52d66c', earType: 'bunny', bellyColor: '#c8f7d2',
      greeting: '耶！可可蛋糕上贴满彩虹糖球！',
      favTag: 'magic',
    },
    {
      id: 'bubba', name: '聪明小象 Bubba', en: 'Bubba Bubbaphant', icon: 'bubba',
      color: '#5ca4e8', earType: 'elephant', bellyColor: '#cfe8ff',
      greeting: '嘟嘟~ 我想喝Q弹的草莓珍珠奶茶！',
      favTag: 'boba',
    },
    {
      id: 'poppy', name: '花朵小鸟 Poppy', en: 'Poppy Dash', icon: 'poppydash',
      color: '#ff6ba8', earType: 'comb', bellyColor: '#ffd4e8',
      greeting: '啾啾~ 我想吃酸酸甜甜的鲜果果冻蛋糕！',
      favTag: 'fruity',
    },
  ];

  // Tab order is stable (magic, fruit, meat, veggie); the shelf opens on fruit.
  const CATEGORIES = [
    { id: 'magic', name: '🌈 蛋糕甜点', en: 'Cake & Sweets', color: '#9b6bff' },
    { id: 'fruit', name: '🍓 水果甜心', en: 'Sweet Fruits', color: '#ff6b8b' },
    { id: 'meat',  name: '🥩 肉蛋芝士', en: 'Meat, Egg & Cheese', color: '#ff9248' },
    { id: 'veggie',name: '🍞 烘焙主食', en: 'Dough & Veggies', color: '#4ec96f' },
  ];

  // `batter`  = sponge / batter colour this ingredient gives the cake.
  // `cream`   = pastel frosting colour this ingredient gives the cream.
  // `neutral` = never tints the batter (dough, milk, egg, ice cream).
  // `rainbow` = the magic rainbow batter (six-layer rainbow sponge).
  const INGREDIENTS = [
    // 1. Fruit (the colourful heroes of the HT Mini Cakes strawberry episode + velcro slicing set)
    { id: 'strawberry', cat: 'fruit', emoji: '🍓', zh: '鲜草莓', en: 'Strawberry',
      color: '#ff385c', inner: '#ffd1dc', rim: '#d91b42', sliceStyle: 'strawberry',
      batter: '#FF5A79', cream: '#FFB3C6', velcro: true,
      choppable: true, grillable: false, sweet: 2, fruity: 2 },
    { id: 'banana', cat: 'fruit', emoji: '🍌', zh: '香蕉', en: 'Banana',
      color: '#ffe042', inner: '#fff8c4', rim: '#e0b81b', sliceStyle: 'banana',
      batter: '#FFE066', cream: '#FFF3B8',
      choppable: true, grillable: true, cookedColor: '#d99a26', sweet: 2, fruity: 1 },
    { id: 'blueberry', cat: 'fruit', emoji: '🫐', zh: '蓝莓', en: 'Blueberry',
      color: '#4c5ce8', inner: '#a8b8ff', rim: '#2e3ab8', sliceStyle: 'berry',
      batter: '#6BA8FF', cream: '#C7D7FF',
      choppable: true, grillable: false, sweet: 1, fruity: 2 },
    { id: 'kiwi', cat: 'fruit', emoji: '🥝', zh: '奇异果', en: 'Kiwi',
      color: '#68d442', inner: '#c4f7a8', rim: '#8c6239', sliceStyle: 'kiwi',
      batter: '#70D66B', cream: '#C9F2C1', velcro: true,
      choppable: true, grillable: false, sweet: 1, sour: 1, fruity: 2 },
    { id: 'watermelon', cat: 'fruit', emoji: '🍉', zh: '甜西瓜', en: 'Watermelon',
      color: '#ff425b', inner: '#ff8598', rim: '#2e9e4f', sliceStyle: 'watermelon',
      batter: '#FF5E78', cream: '#FFC2CC', velcro: true,
      choppable: true, grillable: false, sweet: 3, fruity: 3 },
    { id: 'peach', cat: 'fruit', emoji: '🍑', zh: '水蜜桃', en: 'Peach',
      color: '#ff8da8', inner: '#ffe2b8', rim: '#e85d82', sliceStyle: 'peach',
      batter: '#FFB08A', cream: '#FFD9C4',
      choppable: true, grillable: false, sweet: 2, fruity: 2 },
    { id: 'lemon', cat: 'fruit', emoji: '🍋', zh: '酸柠檬', en: 'Sour Lemon',
      color: '#ffea2b', inner: '#fff9b0', rim: '#d9be00', sliceStyle: 'citrus',
      batter: '#FFF176', cream: '#FFF9C4',
      choppable: true, grillable: false, sour: 4, fruity: 1 },

    // 2. Cake & Sweets (cocoa episode + rainbow episode)
    { id: 'dough', cat: 'magic', emoji: '🎂', zh: '海绵蛋糕糊', en: 'Sponge Cake Mix',
      color: '#fff1c2', inner: '#fffbee', rim: '#e2c578', sliceStyle: 'dough',
      batter: '#FFF1C2', cream: '#FFFDF9', neutral: true,
      rollable: true, stampable: true, stampShapes: ['star', 'heart', 'bear'],
      choppable: false, grillable: true, bakeable: true, cookedColor: '#e69c3a', sweet: 2, baseType: 'pancake' },
    { id: 'milk', cat: 'magic', emoji: '🥛', zh: '鲜牛奶', en: 'Fresh Milk',
      color: '#ffffff', inner: '#e8f6ff', rim: '#b8d8f0', sliceStyle: 'liquid',
      batter: '#FFFDF9', cream: '#FFFDF9', neutral: true,
      liquid: true, choppable: false, grillable: false, sweet: 1, sleepy: 2 },
    { id: 'popcandy', cat: 'magic', emoji: '🍬', zh: '彩虹糖球', en: 'Rainbow Candy Balls',
      color: '#ff4081', inner: '#73f7ff', rim: '#8c2be0', sliceStyle: 'sparkle',
      batter: '#FF6FB5', cream: '#FFFDF9', rainbow: true,
      choppable: false, grillable: false, sweet: 3, magic: 5 },
    { id: 'cocoa', cat: 'magic', emoji: '🫘', zh: '迷你可可豆', en: 'Mini Cocoa Beans',
      color: '#4a2511', inner: '#784323', rim: '#2a1308', sliceStyle: 'cocoa',
      batter: '#5A3220', cream: '#3C1B0E',
      choppable: true, grillable: true, cookedColor: '#3a1b0a', sweet: 1, magic: 2 },
    { id: 'chocolate', cat: 'magic', emoji: '🍫', zh: '丝滑巧克力', en: 'Chocolate Ganache',
      color: '#5c3317', inner: '#8c532b', rim: '#3d1f0d', sliceStyle: 'choco',
      batter: '#5C3317', cream: '#3C1B0E',
      choppable: true, grillable: false, sweet: 3, magic: 2 },
    { id: 'honey', cat: 'magic', emoji: '🍯', zh: '星星蜂蜜', en: 'Star Honey',
      color: '#ffb700', inner: '#ffe47a', rim: '#cc8800', sliceStyle: 'liquid',
      batter: '#FFD36B', cream: '#FFE9A8',
      liquid: true, choppable: false, grillable: false, sweet: 3, sleepy: 2 },
    { id: 'icecream', cat: 'magic', emoji: '🍦', zh: '冰淇淋球', en: 'Ice Cream Scoop',
      color: '#d4f5ff', inner: '#ffffff', rim: '#82ddf7', sliceStyle: 'scoop',
      batter: '#EAF7FF', cream: '#F2FBFF', neutral: true,
      choppable: false, grillable: false, sweet: 2, icy: 4 },
    { id: 'boba', cat: 'magic', emoji: '🧋', zh: '黑糖珍珠', en: 'Boba Pearls',
      color: '#3d2218', inner: '#734535', rim: '#1f100a', sliceStyle: 'boba',
      batter: '#8A6248', cream: '#D9BFA3',
      choppable: false, grillable: false, sweet: 2, boba: 3 },

    // 3. Meat, Egg & Cheese
    { id: 'egg', cat: 'meat', emoji: '🥚', zh: '鸡蛋', en: 'Fresh Egg',
      color: '#fff6e6', inner: '#ffa200', rim: '#e0ceb2', sliceStyle: 'egg',
      batter: '#FFF6E6', cream: '#FFFDF9', neutral: true,
      crackable: true, choppable: false, grillable: true, cookedColor: '#fffdf7', savory: 2, sleepy: 1 },
    { id: 'beef', cat: 'meat', emoji: '🥩', zh: '雪花牛排', en: 'Beef Steak',
      color: '#d94545', inner: '#ffadb5', rim: '#9e2424', sliceStyle: 'meat',
      batter: '#B86A5C', cream: '#E8C9B8',
      choppable: true, grillable: true, cookedColor: '#783b22', savory: 3 },
    { id: 'cheese', cat: 'meat', emoji: '🧀', zh: '黄金芝士', en: 'Cheese',
      color: '#ffc424', inner: '#ffe07d', rim: '#d99a00', sliceStyle: 'cheese',
      batter: '#FFC424', cream: '#FFE58A',
      choppable: true, grillable: true, cookedColor: '#ffae00', savory: 2, sweet: 1 },
    { id: 'bacon', cat: 'meat', emoji: '🥓', zh: '香脆培根', en: 'Crispy Bacon',
      color: '#e85c68', inner: '#ffd1d6', rim: '#b3323e', sliceStyle: 'bacon',
      batter: '#D9736E', cream: '#F2C4BF',
      choppable: true, grillable: true, cookedColor: '#9c2822', savory: 3 },
    { id: 'shrimp', cat: 'meat', emoji: '🍤', zh: '大虾仁', en: 'Jumbo Shrimp',
      color: '#ff8466', inner: '#ffcfc2', rim: '#d95436', sliceStyle: 'shrimp',
      batter: '#FF9A7C', cream: '#FFD0C2',
      choppable: true, grillable: true, cookedColor: '#ff522b', savory: 2 },
    { id: 'sausage', cat: 'meat', emoji: '🌭', zh: '小香肠', en: 'Mini Sausage',
      color: '#d95338', inner: '#ffab99', rim: '#992d17', sliceStyle: 'sausage',
      batter: '#D9695A', cream: '#F2C2B8',
      choppable: true, grillable: true, cookedColor: '#872612', savory: 2 },
    { id: 'maki', cat: 'meat', emoji: '🍣', zh: '竹帘紫菜寿司卷', en: 'Sushi Maki Roll',
      color: '#283E30', inner: '#FF8466', rim: '#1B2B21', sliceStyle: 'maki',
      batter: '#FFF8EC', cream: '#FFFDF9',
      rollable: true, choppable: true, grillable: false, savory: 3, baseType: 'bento' },

    // 4. Dough & Veggies
    { id: 'bread', cat: 'veggie', emoji: '🍞', zh: '北海道吐司', en: 'Milk Toast Bread',
      color: '#f5d69e', inner: '#fff8e3', rim: '#c4863c', sliceStyle: 'bread',
      batter: '#F7DFB0', cream: '#FFF8E3', neutral: true, toastable: true,
      choppable: true, grillable: true, bakeable: true, cookedColor: '#d17b24', savory: 1, sweet: 2, baseType: 'toast' },
    { id: 'butter', cat: 'veggie', emoji: '🧈', zh: '金黄黄油块', en: 'Golden Butter Pat',
      color: '#ffe36e', inner: '#fff4ad', rim: '#d9ae2b', sliceStyle: 'butter',
      batter: '#FFE985', cream: '#FFF7C2', neutral: true, spreadable: true,
      choppable: true, grillable: true, bakeable: true, cookedColor: '#f5be2e', savory: 2, sweet: 1 },
    { id: 'bun', cat: 'veggie', emoji: '🍔', zh: '汉堡面包', en: 'Burger Bun',
      color: '#e69838', inner: '#fff0c4', rim: '#b86f18', sliceStyle: 'bun',
      batter: '#E6A85C', cream: '#FFF0C4', neutral: true,
      choppable: true, grillable: true, bakeable: true, cookedColor: '#d48322', savory: 2, baseType: 'burger' },
    { id: 'pizzabase', cat: 'veggie', emoji: '🍕', zh: '披萨饼底', en: 'Pizza Crust',
      color: '#f7dfa6', inner: '#ffefcc', rim: '#cfa85c', sliceStyle: 'pizza',
      batter: '#F2D59A', cream: '#FFF0CC', neutral: true,
      choppable: false, grillable: true, bakeable: true, cookedColor: '#e39636', savory: 2, baseType: 'pizza' },
    { id: 'tomato', cat: 'veggie', emoji: '🍅', zh: '红番茄', en: 'Tomato',
      color: '#ff3636', inner: '#ff8a8a', rim: '#bd1919', sliceStyle: 'tomato',
      batter: '#FF6B5C', cream: '#FFC2B8', velcro: true,
      choppable: true, grillable: true, cookedColor: '#d92626', savory: 2, fruity: 1 },
    { id: 'carrot', cat: 'veggie', emoji: '🥕', zh: '脆胡萝卜', en: 'Crisp Carrot',
      color: '#ff7b24', inner: '#ffba7a', rim: '#d95b08', sliceStyle: 'carrot',
      batter: '#FF8E42', cream: '#FFD4B0', velcro: true,
      choppable: true, grillable: true, cookedColor: '#d95e14', savory: 2, sweet: 1 },
    { id: 'corn', cat: 'veggie', emoji: '🌽', zh: '甜玉米', en: 'Sweet Corn',
      color: '#ffd633', inner: '#fff3a8', rim: '#58b348', sliceStyle: 'corn',
      batter: '#FFE052', cream: '#FFF5BA', velcro: true,
      choppable: true, grillable: true, cookedColor: '#e0a816', savory: 2, sweet: 2 },
    { id: 'lettuce', cat: 'veggie', emoji: '🥬', zh: '脆生菜', en: 'Crisp Lettuce',
      color: '#54d454', inner: '#b4f5b4', rim: '#2da12d', sliceStyle: 'leaf',
      batter: '#8EDB7A', cream: '#D4F5C8',
      choppable: true, grillable: false, savory: 1 },
    { id: 'chili', cat: 'veggie', emoji: '🌶️', zh: '喷火红辣椒', en: 'Fire Chili',
      color: '#ff1a1a', inner: '#ff7b00', rim: '#b80000', sliceStyle: 'chili',
      batter: '#FF4D3D', cream: '#FFC2B8',
      choppable: true, grillable: true, cookedColor: '#cc0000', spicy: 5 },
    { id: 'kettle_tea', cat: 'veggie', emoji: '🫖', zh: '鸣笛茶壶绿茶', en: 'Whistling Kettle Tea',
      color: '#78C47C', inner: '#C9F2BE', rim: '#4E8C58', sliceStyle: 'liquid',
      batter: '#A8E096', cream: '#E2F7D8',
      liquid: true, kettle: true, choppable: false, grillable: true, cookedColor: '#5EA862', sweet: 1, sleepy: 2 },
  ];

  // Six-colour rainbow (video order on the rosette cake: red at the top).
  const RAINBOW = ['#FF2A2A', '#FF8C1A', '#FFE619', '#1FD141', '#2986FF', '#8C2BFF'];
  const CANDY_BALL_COLORS = RAINBOW.slice();
  const VANILLA_SPONGE = '#FFF1C2';
  const VANILLA_CREAM = '#FFFDF9';
  const DARK_CHOCOLATE = '#3C1B0E';

  // Shared 3D cake-cylinder geometry (dish-local units at scale 1).
  // Top face = ellipse (0, topY) radii (radius, topRy); side wall spans
  // y in [topY, topY + sideHeight].
  const CAKE_GEOM = { radius: 84, sideHeight: 68, topY: -28, topRy: 32 };

  // 6-Color Rainbow Palette + White Cloud + Rich Dark Chocolate Ganache
  const PIPING_COLORS = [
    { id: 'red',    zh: '草莓红奶油', color: '#ff385c', shadow: '#d11b3e', hi: '#ffa3b5', hue: 350 },
    { id: 'orange', zh: '甜橙橘奶油', color: '#ff8822', shadow: '#d66200', hi: '#ffc17a', hue: 28 },
    { id: 'yellow', zh: '香草黄奶油', color: '#ffd933', shadow: '#c7a30e', hi: '#fff08a', hue: 50 },
    { id: 'green',  zh: '薄荷绿奶油', color: '#38d968', shadow: '#1ca645', hi: '#94f2b0', hue: 138 },
    { id: 'blue',   zh: '天空蓝奶油', color: '#3399ff', shadow: '#126ecc', hi: '#94ccff', hue: 210 },
    { id: 'purple', zh: '葡萄紫奶油', color: '#9d4edd', shadow: '#712bb5', hi: '#d0a2f7', hue: 273 },
    { id: 'white',  zh: '云朵白奶油', color: '#fffdf9', shadow: '#e0d6c8', hi: '#ffffff', hue: null },
    { id: 'choco',  zh: '黑巧甘纳许', color: '#542d17', shadow: '#361b0c', hi: '#824c2d', hue: null },
  ];

  // Mirror glazes & fruit drips (Station 4 sauce tool). White first, chocolate
  // is just one of eight — never a default.
  const SAUCES = [
    { id: 'white_glaze',      zh: '🤍 香草白镜面', color: '#FFFDF9', hi: '#FFFFFF' },
    { id: 'strawberry_sauce', zh: '🍓 鲜草莓淋酱', color: '#FF2B5E', hi: '#FF94B0' },
    { id: 'choco_sauce',      zh: '🍫 镜面巧克力酱', color: '#3C1B0E', hi: '#874E2B' },
    { id: 'honey_sauce',      zh: '🍯 黄金蜂蜜酱', color: '#FFAE00', hi: '#FFE478' },
    { id: 'blueberry_sauce',  zh: '🫐 蓝莓淋酱', color: '#5B7CFF', hi: '#B8C6FF' },
    { id: 'lemon_glaze',      zh: '🍋 柠檬糖霜', color: '#FFE94D', hi: '#FFF7B0' },
    { id: 'matcha_glaze',     zh: '🍵 抹茶淋面', color: '#7CD36C', hi: '#C9F2BE' },
    { id: 'cheese_sauce',     zh: '🧀 浓香芝士酱', color: '#FFC400', hi: '#FFF099', condiment: true },
    { id: 'ketchup_sauce',    zh: '🍅 酸甜番茄酱', color: '#E3392B', hi: '#FF948A', condiment: true },
    { id: 'mustard_sauce',    zh: '🌭 黄金芥末酱', color: '#F5C422', hi: '#FFF2A6', condiment: true },
  ];

  // Toppings: tweezers-placed candy balls, fresh fruit slices (drawn with the
  // real ingredient art via `ingredient`), rainbow arch & little extras.
  const TOPPINGS = [
    { id: 'candy_balls',   zh: '彩虹糖球',   en: 'Rainbow Candy Balls', kind: 'candy' },
    { id: 'berry_top',     zh: '鲜草莓顶',   en: 'Fresh Strawberry', ingredient: 'strawberry' },
    { id: 'kiwi_slice',    zh: '奇异果片',   en: 'Kiwi Slice', ingredient: 'kiwi' },
    { id: 'banana_slice',  zh: '香蕉片',     en: 'Banana Slice', ingredient: 'banana' },
    { id: 'blueberry_top', zh: '蓝莓粒',     en: 'Blueberries', ingredient: 'blueberry' },
    { id: 'peach_slice',   zh: '水蜜桃片',   en: 'Peach Slice', ingredient: 'peach' },
    { id: 'lemon_slice',   zh: '柠檬片',     en: 'Lemon Slice', ingredient: 'lemon' },
    { id: 'cherry',        zh: '红樱桃',     en: 'Sweet Cherry' },
    { id: 'rainbow_arch',  zh: '彩虹拱桥',   en: 'Rainbow Arch Topper' },
    { id: 'sprinkles',     zh: '彩虹糖针',   en: 'Rainbow Sprinkles' },
    { id: 'stars',         zh: '星星糖片',   en: 'Star Candy' },
    { id: 'hearts',        zh: '爱心糖果',   en: 'Heart Sweets' },
    { id: 'flower_pot',    zh: '微笑小花',   en: 'Mini Flower Pot' },
    { id: 'candle',        zh: '生日蜡烛',   en: 'Birthday Candle' },
    { id: 'umbrella',      zh: '果汁小伞',   en: 'Drink Umbrella' },
  ];

  // The 8 Critters' orders: a colourful variety (only ONE of them is cocoa).
  const WISH_ORDERS = [
    {
      id: 'strawberry_shortcake',
      zh: '草莓鲜奶油蛋糕', en: 'Strawberry Shortcake',
      critter: 'bobby',
      icons: ['🍓', '🎂', '🥛'],
      wantIds: ['strawberry', 'dough', 'milk'],
      wantCooking: 'oven',
      wantDecor: true,
      cakeStyle: null,
      desc: '切鲜草莓，拌成粉红面糊，烤成粉嫩海绵蛋糕，抹上白奶油再摆上草莓！',
    },
    {
      id: 'rainbow_rosette_cake',
      zh: '六层彩虹玫瑰裱花蛋糕', en: 'Rainbow 6-Layer Rosette Cake',
      critter: 'craftycorn',
      icons: ['🌈', '🎂', '🥛'],
      wantIds: ['popcandy', 'dough', 'milk'],
      wantCooking: 'oven',
      wantDecor: true,
      cakeStyle: 'rainbow_rosettes',
      desc: '彩虹糖球化成六色面糊，烤出六层彩虹蛋糕，在转台上挤满彩虹玫瑰花！',
    },
    {
      id: 'choco_candy_ball_cake',
      zh: '可可彩虹糖球蛋糕', en: 'Cocoa Candy Ball Cake',
      critter: 'hoppy',
      icons: ['🫘', '🎂', '🍬'],
      wantIds: ['cocoa', 'dough', 'chocolate'],
      wantCooking: 'oven',
      wantDecor: true,
      cakeStyle: 'candy_balls',
      desc: '剥可可豆、烤巧克力蛋糕、淋镜面巧克力，用镊子一颗颗贴上彩虹糖球！',
    },
    {
      id: 'fresh_fruit_jelly_cake',
      zh: '鲜果果冻蛋糕', en: 'Fresh Fruit Jelly Cake',
      critter: 'poppy',
      icons: ['🥝', '🍌', '🍓'],
      wantIds: ['kiwi', 'banana', 'strawberry'],
      wantCooking: 'pan',
      wantDecor: true,
      cakeStyle: null,
      desc: '切奇异果、香蕉和草莓，在小银锅里熬成晶莹果冻！',
    },
    {
      id: 'sunny_lemon_tart',
      zh: '阳光柠檬蜂蜜塔', en: 'Sunny Lemon Tart',
      critter: 'dogday',
      icons: ['🍋', '🎂', '🍯'],
      wantIds: ['lemon', 'dough', 'honey'],
      wantCooking: 'oven',
      wantDecor: true,
      cakeStyle: null,
      desc: '切柠檬片，拌入蜂蜜面糊，烤出金黄柠檬塔！',
    },
    {
      id: 'blueberry_cloud_cake',
      zh: '蓝莓云朵蛋糕', en: 'Blueberry Cloud Cake',
      critter: 'catnap',
      icons: ['🫐', '🎂', '🥛'],
      wantIds: ['blueberry', 'dough', 'milk'],
      wantCooking: 'oven',
      wantDecor: true,
      cakeStyle: null,
      desc: '蓝莓拌进牛奶面糊，烤出淡紫蓝云朵蛋糕，裱上云朵奶油！',
    },
    {
      id: 'boba_milk_tea',
      zh: '草莓黑糖珍珠奶茶', en: 'Strawberry Boba Milk Tea',
      critter: 'bubba',
      icons: ['🥛', '🧋', '🍓'],
      wantIds: ['milk', 'boba', 'strawberry'],
      wantCooking: 'blender',
      wantDecor: true,
      cakeStyle: null,
      desc: '用搅拌杯混合鲜牛奶、黑糖珍珠和甜草莓！',
    },
    {
      id: 'peach_cream_pancakes',
      zh: '水蜜桃奶油松饼塔', en: 'Peach Cream Pancake Tower',
      critter: 'picky',
      icons: ['🥞', '🍑', '🍯'],
      wantIds: ['dough', 'peach', 'honey'],
      wantCooking: 'pan',
      wantDecor: true,
      cakeStyle: null,
      desc: '用平底锅煎金黄松饼，加上水蜜桃和蜂蜜奶油！',
    },
    {
      id: 'cheese_burger',
      zh: '双层芝士牛排汉堡', en: 'Double Cheese Steak Burger',
      critter: 'picky',
      icons: ['🍔', '🥩', '🧀'],
      wantIds: ['bun', 'beef', 'cheese'],
      wantCooking: 'pan',
      wantDecor: true,
      cakeStyle: null,
      baseKind: 'burger',
      desc: '把牛排煎得滋滋响，叠上汉堡面包、生菜、番茄、黄金芝士，再挤上番茄芥末酱！',
    },
    {
      id: 'bento_sushi_meal',
      zh: '竹帘寿司便当盒配鸣笛热茶', en: 'Sushi Maki Bento & Whistling Tea',
      critter: 'catnap',
      icons: ['🍣', '🍤', '🫖'],
      wantIds: ['maki', 'shrimp', 'kettle_tea'],
      wantCooking: 'pan',
      wantDecor: true,
      cakeStyle: null,
      baseKind: 'bento',
      desc: '用竹帘卷好紫菜三文鱼寿司并切成花卷，装进漆器便当盒，再烧开鸣笛茶壶倒一杯热绿茶！',
    },
    {
      id: 'kiwi_berry_sundae',
      zh: '奇异果蓝莓冰淇淋圣代', en: 'Kiwi Berry Ice Cream Sundae',
      critter: 'poppy',
      icons: ['🍦', '🥝', '🫐'],
      wantIds: ['icecream', 'kiwi', 'blueberry'],
      wantCooking: 'none',
      wantDecor: true,
      cakeStyle: null,
      desc: '切好奇异果和蓝莓，搭配冰爽香草冰淇淋球！',
    },
    {
      id: 'sunny_bacon_egg',
      zh: '阳光培根太阳蛋早餐', en: 'Sunny Bacon & Egg Plate',
      critter: 'dogday',
      icons: ['🥚', '🥓', '🍅'],
      wantIds: ['egg', 'bacon', 'tomato'],
      wantCooking: 'pan',
      wantDecor: false,
      cakeStyle: null,
      desc: '敲碎鸡蛋、切好培根，在平底锅里煎出滋滋太阳蛋！',
    },
    {
      id: 'supreme_pizza',
      zh: '黄金拉丝番茄香肠披萨', en: 'Cheesy Tomato Sausage Pizza',
      critter: 'picky',
      icons: ['🍕', '🧀', '🌭'],
      wantIds: ['pizzabase', 'cheese', 'sausage'],
      wantCooking: 'oven',
      wantDecor: false,
      cakeStyle: null,
      desc: '在披萨饼底铺满芝士和小香肠，放进烤箱烤到拉丝！',
    },
    {
      id: 'magic_bunny_smoothie',
      zh: '跳跳兔魔法桃子冰沙', en: 'Magic Peach Cloud Smoothie',
      critter: 'hoppy',
      icons: ['🍑', '✨', '🍦'],
      wantIds: ['peach', 'popcandy', 'icecream'],
      wantCooking: 'blender',
      wantDecor: true,
      cakeStyle: null,
      desc: '把水蜜桃、冰淇淋和云朵跳跳糖放进榨汁机打成冰沙！',
    },
    {
      id: 'sizzling_sausage_egg',
      zh: '滋滋双灶煎蛋香肠配鲜蔬浓汤', en: 'Sizzling Sausage, Sunny Egg & Boiling Soup',
      critter: 'dogday',
      icons: ['🥚', '🌭', '🌽'],
      wantIds: ['egg', 'sausage', 'corn'],
      wantCooking: 'pan',
      wantDecor: false,
      cakeStyle: null,
      desc: '旋开双灶温度旋钮，左灶咕嘟咕嘟煮鲜蔬汤冒蒸汽，右灶平底锅煎太阳蛋、翻炒滋滋小香肠！',
    },
  ];

  const byId = {};
  INGREDIENTS.forEach(item => { byId[item.id] = item; });
  const critterById = {};
  CRITTERS.forEach(c => { critterById[c.id] = c; });
  const toppingById = {};
  TOPPINGS.forEach(tp => { toppingById[tp.id] = tp; });

  /* ------------------------------------------------------------------------
   * Colour helpers (shared by game.js and art.js)
   * ---------------------------------------------------------------------- */
  function hexToRgb(hex) {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    if (!isFinite(n)) return { r: 255, g: 241, b: 194 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    const c = v => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + ((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1).toUpperCase();
  }

  // Weighted average of hex colours (weights default to 1 each).
  function blendHex(colors, weights) {
    if (!colors || !colors.length) return VANILLA_SPONGE;
    let r = 0, g = 0, b = 0, w = 0;
    colors.forEach((hex, i) => {
      const k = weights && isFinite(weights[i]) ? weights[i] : 1;
      const c = hexToRgb(hex);
      r += c.r * k;
      g += c.g * k;
      b += c.b * k;
      w += k;
    });
    if (w <= 0) return VANILLA_SPONGE;
    return rgbToHex(r / w, g / w, b / w);
  }

  function mixHex(a, b, k) {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    const t = Math.max(0, Math.min(1, k || 0));
    return rgbToHex(ca.r + (cb.r - ca.r) * t, ca.g + (cb.g - ca.g) * t, ca.b + (cb.b - ca.b) * t);
  }

  function hexHue(hex) {
    const c = hexToRgb(hex);
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    if (d < 0.08 || max < 0.2) return null; // too grey / too dark to have a hue
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return h;
  }

  function normalizeIds(ids) {
    const out = [];
    const seen = new Set();
    (ids || []).forEach(entry => {
      const id = typeof entry === 'string' ? entry : (entry && entry.id);
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push(id);
    });
    return out;
  }

  /**
   * paletteFor(ids) — THE colour-causality function.
   * Everything the cake looks like comes from the ids the player actually used:
   *   layerColors   one sponge colour per coloured ingredient (in prep order);
   *                 the rainbow batter yields the six rainbow layers;
   *                 only neutral ingredients -> one vanilla sponge layer.
   *   batterTint    weighted blend (coloured = 1, neutral = 0.35 cream).
   *   frostingColor pastel cream of the first coloured ingredient; vanilla
   *                 cream when neutral; dark chocolate ONLY with cocoa/chocolate.
   */
  function paletteFor(ids) {
    const uniq = normalizeIds(ids);
    const metas = uniq.map(id => byId[id]).filter(Boolean);
    const hasChocolate = metas.some(m => m.id === 'chocolate' || m.id === 'cocoa');
    const hasRainbow = metas.some(m => !!m.rainbow);
    const colored = metas.filter(m => !m.neutral && !m.rainbow).map(m => m.id);

    let layerColors;
    if (hasRainbow) layerColors = RAINBOW.slice();
    else if (colored.length) layerColors = colored.map(id => byId[id].batter || byId[id].color);
    else layerColors = [VANILLA_SPONGE];

    const cols = [], wts = [];
    metas.forEach(m => {
      if (m.neutral) {
        cols.push(m.batter || VANILLA_SPONGE);
        wts.push(0.35);
      } else {
        cols.push(m.batter || m.color);
        wts.push(1);
      }
    });
    const batterTint = cols.length ? blendHex(cols, wts) : VANILLA_SPONGE;

    let frostingColor;
    if (hasChocolate) frostingColor = DARK_CHOCOLATE;
    else if (colored.length) frostingColor = byId[colored[0]].cream || mixHex(byId[colored[0]].batter || byId[colored[0]].color, '#FFFFFF', 0.55);
    else frostingColor = VANILLA_CREAM;

    const themeId = hasChocolate ? (uniq.includes('cocoa') ? 'cocoa' : 'chocolate')
      : (hasRainbow ? 'popcandy' : (colored[0] || uniq[0] || null));

    return { ids: uniq, colored, layerColors, batterTint, frostingColor, hasChocolate, hasRainbow, themeId };
  }

  // Nearest PIPING_COLORS index for a theme colour (white for creams, choco for cocoa).
  function pipingIndexForColor(hex) {
    if (!hex) return PIPING_COLORS.findIndex(p => p.id === 'white');
    const c = hexToRgb(hex);
    const lum = (c.r * 0.299 + c.g * 0.587 + c.b * 0.114) / 255;
    const hue = hexHue(hex);
    if (hue === null) {
      return PIPING_COLORS.findIndex(p => p.id === (lum < 0.45 ? 'choco' : 'white'));
    }
    let best = 0, bestD = 1e9;
    PIPING_COLORS.forEach((p, i) => {
      if (p.hue === null || p.hue === undefined) return;
      const d = Math.min(Math.abs(p.hue - hue), 360 - Math.abs(p.hue - hue));
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  // Slice 9 (48:00 - 54:00): Sparkling Dishwashing Chore & Kitchen Cleanup
  const CLEANUP_CHORES = [
    { id: 'scrub', icon: 'sponge',      color: '#FFE066', accent: '#7CE0F9' },
    { id: 'rinse', icon: 'faucet',      color: '#8CD7F7', accent: '#E8F7FF' },
    { id: 'rack',  icon: 'drying_rack', color: '#E8C39E', accent: '#FAF3EB' },
    { id: 'bins',  icon: 'recycle_bin', color: '#78C87E', accent: '#FF9A62' },
  ];

  const DRYING_RACK_SLOTS = [
    { id: 'plate_lg', kind: 'plate',  rx: 46, ry: 46, slotX: -84, slotY: -12, color: '#FAF3EB', rim: '#F2A7B5' },
    { id: 'plate_sm', kind: 'saucer', rx: 38, ry: 38, slotX: -28, slotY: -16, color: '#FFF7E8', rim: '#7EC8E3' },
    { id: 'bowl',     kind: 'bowl',   rx: 40, ry: 28, slotX: 28,  slotY: -8,  color: '#E8F7F0', rim: '#6BCB77' },
    { id: 'cup',      kind: 'cup',    rx: 26, ry: 34, slotX: 82,  slotY: -10, color: '#FFE5EC', rim: '#FF85A2' },
  ];

  // Waste & recyclable items causally derived from cooked ingredients
  const WASTE_ITEMS = [
    { id: 'milk_carton',   bin: 'recycle', kind: 'carton',  color: '#88D4F7', accent: '#FFFFFF', sourceIds: ['milk', 'icecream', 'cream'] },
    { id: 'berry_punnet',  bin: 'recycle', kind: 'punnet',  color: '#B8E8FC', accent: '#FF6B8B', sourceIds: ['strawberry', 'blueberry'] },
    { id: 'honey_jar',     bin: 'recycle', kind: 'jar',     color: '#FFD166', accent: '#F4A261', sourceIds: ['honey', 'lemon', 'mango'] },
    { id: 'cocoa_tin',     bin: 'recycle', kind: 'tin',     color: '#B07D56', accent: '#E8C59B', sourceIds: ['cocoa', 'chocolate', 'matcha', 'boba'] },
    { id: 'banana_peel',   bin: 'trash',   kind: 'peel',    color: '#FFE066', accent: '#C99E32', sourceIds: ['banana', 'mango', 'lemon'] },
    { id: 'eggshell_half', bin: 'trash',   kind: 'shell',   color: '#FFF5E4', accent: '#F0D5B8', sourceIds: ['egg', 'dough', 'pizzabase'] },
    { id: 'veggie_stems',  bin: 'trash',   kind: 'stems',   color: '#52B788', accent: '#FF5A79', sourceIds: ['strawberry', 'tomato', 'carrot', 'broccoli', 'corn', 'chili'] },
    { id: 'cheese_rind',   bin: 'trash',   kind: 'wrapper', color: '#FFCA3A', accent: '#FF924C', sourceIds: ['cheese', 'sausage', 'popcandy', 'sprinkles'] },
  ];

  function cleanupItemsForIds(ids) {
    const used = new Set(Array.isArray(ids) ? ids : []);
    const matchedRecycle = WASTE_ITEMS.filter(w => w.bin === 'recycle' && w.sourceIds.some(s => used.has(s)));
    const matchedTrash = WASTE_ITEMS.filter(w => w.bin === 'trash' && w.sourceIds.some(s => used.has(s)));
    const rec = matchedRecycle.length >= 2
      ? matchedRecycle.slice(0, 2)
      : [...matchedRecycle, ...WASTE_ITEMS.filter(w => w.bin === 'recycle' && !matchedRecycle.includes(w))].slice(0, 2);
    const trs = matchedTrash.length >= 2
      ? matchedTrash.slice(0, 2)
      : [...matchedTrash, ...WASTE_ITEMS.filter(w => w.bin === 'trash' && !matchedTrash.includes(w))].slice(0, 2);
    return [rec[0], trs[0], rec[1], trs[1]].map((item, idx) => ({
      ...item,
      slotIdx: idx,
    }));
  }

  // Slice 2 (06:00 - 12:00): Ice Cream Parlor Flavors, Pet Fish Aquarium & Doll Care
  const ICE_CREAM_FLAVORS = [
    { id: 'strawberry_swirl', ingredient: 'strawberry', color: '#FF7096', hi: '#FFD1DC', shadow: '#D93860', coneRim: '#E8A558' },
    { id: 'vanilla_bean',     ingredient: 'milk',       color: '#FFF5DC', hi: '#FFFDF9', shadow: '#DEC692', coneRim: '#E8A558' },
    { id: 'mint_pistachio',   ingredient: 'kiwi',       color: '#88E0A0', hi: '#D4F7DC', shadow: '#4EA868', coneRim: '#E8A558' },
    { id: 'choco_fudge',      ingredient: 'chocolate',  color: '#6B3E26', hi: '#9C6344', shadow: '#422210', coneRim: '#E8A558' },
    { id: 'blueberry_cloud',  ingredient: 'blueberry',  color: '#78B0FF', hi: '#CFE2FF', shadow: '#4578CC', coneRim: '#E8A558' },
    { id: 'mango_peach',      ingredient: 'peach',      color: '#FFB35C', hi: '#FFE4BD', shadow: '#D97F28', coneRim: '#E8A558' },
  ];

  const AQUARIUM_CONFIG = {
    waterTop: '#B8EEF5',
    waterBottom: '#78CEDB',
    algaeColor: '#6EB874',
    flakeColors: ['#FFB742', '#FF8552', '#FFD966', '#E86A48'],
    fish: [
      { id: 'goldie', body: '#FF8C42', fin: '#FFD166', belly: '#FFE8C2', size: 18 },
      { id: 'bubbles', body: '#66B2FF', fin: '#BAE0FF', belly: '#F0F8FF', size: 15 },
    ],
  };

  const DOLL_CARE_ITEMS = [
    { id: 'bottle',   color: '#FFFDF9', accent: '#FF94B0' },
    { id: 'pacifier', color: '#9CD3C2', accent: '#F4CF82' },
    { id: 'brush',    color: '#E8998D', accent: '#FFFDF9' },
  ];

  // Slice 10 (54:00 - 61:44): Little Doctor Clinic & Plushie Wellness Care
  const CLINIC_TOOLS = [
    { id: 'stethoscope', icon: 'stethoscope', color: '#F4A6B8', accent: '#9CD3C2' },
    { id: 'thermometer', icon: 'thermometer', color: '#8CC8E8', accent: '#78C47C' },
    { id: 'bandaid',     icon: 'bandaid',     color: '#F7C59F', accent: '#E87A82' },
    { id: 'medicine',    icon: 'medicine',    color: '#F29BB0', accent: '#D48C56' },
    { id: 'brush',       icon: 'brush',       color: '#DEB078', accent: '#F4A6B8' },
  ];

  const BANDAID_DESIGNS = [
    { id: 'heart_pink',   padColor: '#FFFDF9', wingColor: '#F7CAD6', icon: 'heart',   accent: '#E85D75' },
    { id: 'star_gold',    padColor: '#FFFDF9', wingColor: '#FCE8A6', icon: 'star',    accent: '#F7C948' },
    { id: 'mint_cloud',   padColor: '#FFFDF9', wingColor: '#BDE8D8', icon: 'cloud',   accent: '#68B878' },
    { id: 'rainbow_care', padColor: '#FFFDF9', wingColor: '#CFE2FF', icon: 'rainbow', accent: '#5D9CEC' },
  ];

  const MEDICINE_FLAVORS = [
    { id: 'berry_syrup',  color: '#FF7096', hi: '#FFD1DC', bottle: '#D48C56' },
    { id: 'honey_elixir', color: '#FFB74D', hi: '#FFF3CC', bottle: '#C87D4B' },
    { id: 'mint_drops',   color: '#78D6B2', hi: '#D9F7EA', bottle: '#8C9BA5' },
  ];

  const CLINIC_BOOBOOS = [
    { id: 'cheek_left',  dx: -54, dy: -4,  angle: -0.22, designId: 'heart_pink' },
    { id: 'forehead',    dx: 24,  dy: -56, angle: 0.16,  designId: 'star_gold' },
    { id: 'paw_right',   dx: 62,  dy: 36,  angle: -0.14, designId: 'mint_cloud' },
  ];

  const CLINIC_FUR_TUFTS = [
    { id: 'crown_left',  dx: -36, dy: -82, angle: -0.35 },
    { id: 'crown_mid',   dx: 0,   dy: -90, angle: 0.05 },
    { id: 'crown_right', dx: 36,  dy: -82, angle: 0.35 },
    { id: 'cheek_tuft',  dx: -68, dy: -22, angle: -0.55 },
  ];

  // Slice 3 (12:00 - 18:00): Ultimate Kitchen Playset Unboxing, Modular Assembly, Battery Sound Module & Circulating Water Sink
  const PLAYSET_PARTS = [
    { id: 'base_case',        step: 1, color: '#9B82C9', accent: '#FFB3C6', icon: 'playset',  dx: 0,    dy: 32 },
    { id: 'battery_bay',      step: 2, color: '#FF85A6', accent: '#FFD166', icon: 'battery',  dx: -116, dy: 56 },
    { id: 'side_wings',       step: 3, color: '#FF94B8', accent: '#FFFDF9', icon: 'plate',    dx: -144, dy: 16 },
    { id: 'back_hood',        step: 4, color: '#78C2E4', accent: '#FF94B8', icon: 'oven',     dx: 0,    dy: -62 },
    { id: 'sink_unit',        step: 5, color: '#9CD3C2', accent: '#FFFDF9', icon: 'faucet',   dx: 92,   dy: 22 },
    { id: 'hanging_utensils', step: 6, color: '#FFD166', accent: '#78C47C', icon: 'spatula',  dx: -36,  dy: -40 },
  ];

  const SINK_WASH_ITEMS = [
    { id: 'tomato',     kind: 'veggie', color: '#E84A3B', rim: '#68B878', r: 22, homeX: -62, homeY: 16 },
    { id: 'carrot',     kind: 'veggie', color: '#F58220', rim: '#68B878', r: 22, homeX: -18, homeY: 22 },
    { id: 'strawberry', kind: 'fruit',  color: '#FF5A79', rim: '#68B878', r: 20, homeX: 24,  homeY: 18 },
    { id: 'plate_pink', kind: 'dish',   color: '#FF94B8', rim: '#FFFDF9', r: 26, homeX: -38, homeY: -8 },
    { id: 'cup_mint',   kind: 'dish',   color: '#9CD3C2', rim: '#FFFDF9', r: 20, homeX: 48,  homeY: -4 },
  ];

  const PLAYSET_CONFIG = {
    boxColor: '#78C2E4',
    boxAccent: '#FF94B8',
    stoveBaseColor: '#9B82C9',
    wingColor: '#FF94B8',
    hoodColor: '#78C2E4',
    sinkBasinColor: '#FF85A6',
    sinkDeckColor: '#9CD3C2',
    faucetColor: '#FFFDF9',
    waterTop: '#B8EEF5',
    waterBottom: '#78CEDB',
    batteryGold: '#FFD166',
    batteryBody: '#4A5568',
    spongeColor: '#FFE066',
    spongeScrubColor: '#68B878',
  };

  // Slice 4 (18:00 - 24:00): Dual-Burner Stove Top, Clicking Temperature Dials, Boiling Soup Pot & Sizzling Skillet
  const STOVE_CONFIG = {
    casingColor: '#FAF3EB',
    deckTopColor: '#F5E6D6',
    apronColor: '#E8998D',
    grateColor: '#5C3D2E',
    dialAngles: [-0.85, 0.0, 0.85], // Low (1), Med (2), High (3) rotary detent angles
    burners: [
      { id: 'left_soup',  role: 'soup_pot',   dx: -124, dy: 28, rx: 76, ry: 34 },
      { id: 'right_pan',  role: 'skillet',    dx: 76,   dy: 36, rx: 104, ry: 44 },
    ],
    soupBroth: {
      baseColor: '#FFE89E',
      simmerColor: '#F7C95C',
      rimColor: '#9CD3C2',
      defaultVeggies: ['corn', 'carrot', 'tomato'],
    },
  };

  // Slice 5 (24:00 - 30:00): Countertop Appliances — Motorized Smoothie Blender, Spring Pop-Up Toaster & Microwave Turntable
  const COUNTERTOP_APPLIANCES = {
    blender: {
      id: 'blender',
      icon: 'blender',
      speeds: [1, 2, 3],
      pitcherTint: 'rgba(232, 248, 255, 0.84)',
      baseColor: '#9CD3C2',
      lidColor: '#E8998D',
      defaultFruits: ['strawberry', 'banana', 'kiwi', 'blueberry', 'peach'],
    },
    toaster: {
      id: 'toaster',
      icon: 'toaster',
      slots: 2,
      bodyColor: '#F4A6B8',
      trimColor: '#FFFDF9',
      coilGlowColor: '#FF6B2B',
      breadRawColor: '#FFF6DC',
      breadCrustColor: '#C4863C',
      breadToastedColor: '#D48328',
      butterColor: '#FFE36E',
      butterMeltColor: '#FFF29C',
    },
    microwave: {
      id: 'microwave',
      icon: 'microwave',
      bodyColor: '#FFFDF9',
      panelColor: '#9CD3C2',
      windowGlowColor: '#FFE8A3',
      turntableColor: 'rgba(220, 244, 252, 0.88)',
      pipSteps: 3,
    },
  };

  // Slice 6 (30:00 - 36:00): Patisserie Bakery Oven & Cookie Stamper
  const COOKIE_SHAPES = ['star', 'heart', 'bear'];
  const PATISSERIE_CONFIG = {
    shapes: COOKIE_SHAPES,
    cutterColors: {
      star:  { rim: '#FFD166', body: '#FFE599', hi: '#FFF8D6', plunger: '#F4A261' },
      heart: { rim: '#FF7096', body: '#FFA6C1', hi: '#FFE0EA', plunger: '#E84A72' },
      bear:  { rim: '#7EC8E3', body: '#AEDFF2', hi: '#E6F7FC', plunger: '#4FA3C7' },
    },
    doughRaw: '#FFF1C2',
    doughBaked: '#E69C3A',
    ovenGlow: '#FFB74D',
  };

  // Slice 8 (42:00 - 48:00): Birthday Celebration Cake — Spinning Turntable, Velcro Cake Slicing with Musical Knife, Birthday Candles & Candy Jar Scoops
  const BIRTHDAY_CAKE_CONFIG = {
    maxVelcroWedges: 6,
    velcroPatchColor: '#FFFDF9',
    velcroHookColor: '#E5D8C8',
    candleStripeColors: ['#FF6B8B', '#4ECDC4', '#A17FE0', '#FF9F43', '#54A0FF', '#5CD85A'],
    candleCollarColors: ['#FFB3C6', '#A8E6CF', '#FFD3B6', '#D4C1EC', '#B5DEFF', '#FFF3B0'],
    candyJarOffset: { dx: -192, dy: -8, r: 44 },
    musicalKnifeNotes: [523.25, 523.25, 587.33, 523.25, 698.46, 659.25, 523.25, 523.25, 587.33, 523.25, 783.99, 698.46],
    subTools: [
      { id: 'candy_jar',  icon: 'candy_jar',  tool: 'topping', toppingId: 'candy_balls' },
      { id: 'rosette',    icon: 'rosette',    tool: 'piping' },
      { id: 'candle',     icon: 'candle',     tool: 'topping', toppingId: 'candle' },
      { id: 'cake_knife', icon: 'cake_knife', tool: 'knife' },
    ],
  };

  // 10-Station Play Loop Configuration (matching 60-min Tina Unboxing Toys video)
  const STATIONS = [
    { num: 1,  id: 'grocery',    icon: 'knife',        unlocksAtStars: 0 },
    { num: 2,  id: 'icecream',   icon: 'scoop',        unlocksAtStars: 0 },
    { num: 3,  id: 'playset',    icon: 'water_stream',  unlocksAtStars: 0 },
    { num: 4,  id: 'stove',      icon: 'pan',          unlocksAtStars: 0 },
    { num: 5,  id: 'appliances', icon: 'blender',      unlocksAtStars: 0 },
    { num: 6,  id: 'bakery',     icon: 'oven',         unlocksAtStars: 0 },
    { num: 7,  id: 'bento',      icon: 'bun',          unlocksAtStars: 0 },
    { num: 8,  id: 'cake',       icon: 'cupcake',      unlocksAtStars: 0 },
    { num: 9,  id: 'dishes',     icon: 'soapy_bubble',  unlocksAtStars: 0 },
    { num: 10, id: 'clinic',     icon: 'heart',        unlocksAtStars: 0 },
  ];

  return {
    STATIONS,
    CRITTERS,
    CATEGORIES,
    INGREDIENTS,
    CLEANUP_CHORES,
    DRYING_RACK_SLOTS,
    WASTE_ITEMS,
    cleanupItemsForIds,
    PIPING_COLORS,
    SAUCES,
    TOPPINGS,
    WISH_ORDERS,
    RAINBOW,
    CANDY_BALL_COLORS,
    VANILLA_SPONGE,
    VANILLA_CREAM,
    DARK_CHOCOLATE,
    CAKE_GEOM,
    ICE_CREAM_FLAVORS,
    AQUARIUM_CONFIG,
    DOLL_CARE_ITEMS,
    CLINIC_TOOLS,
    BANDAID_DESIGNS,
    MEDICINE_FLAVORS,
    CLINIC_BOOBOOS,
    CLINIC_FUR_TUFTS,
    PLAYSET_PARTS,
    SINK_WASH_ITEMS,
    PLAYSET_CONFIG,
    STOVE_CONFIG,
    COUNTERTOP_APPLIANCES,
    COOKIE_SHAPES,
    PATISSERIE_CONFIG,
    BIRTHDAY_CAKE_CONFIG,
    // Unknown ids fall back to the neutral sponge mix (never to chocolate).
    getIngredient: id => byId[id] || byId.dough,
    hasIngredient: id => !!byId[id],
    getCritter: id => critterById[id] || CRITTERS[0],
    getTopping: id => toppingById[id] || TOPPINGS[0],
    paletteFor,
    blendHex,
    mixHex,
    hexToRgb,
    rgbToHex,
    hexHue,
    pipingIndexForColor,
  };
})();

if (typeof window !== 'undefined') {
  window.KitchenData = KitchenData;
}
