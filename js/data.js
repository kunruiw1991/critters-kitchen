'use strict';
/* ==========================================================================
 * Chuyu's Rainbow Kitchen (楚楚的彩虹料理屋) — Game Data & Recipes
 * Inspired by HT Mini Cakes: Magical Rainbow Candy Ball Chocolate Cake &
 * Two-Tier Rainbow Buttercream Rosette Cake.
 * Designed for 5-year-old tactile play: ingredients, 8 Critter customers,
 * signature visual orders, 6-color rainbow piping, sauces, and toppings.
 * ========================================================================== */
const KitchenData = (() => {
  const CRITTERS = [
    {
      id: 'craftycorn', name: '独角兽 CraftyCorn', en: 'CraftyCorn', icon: 'craftycorn',
      color: '#5cc8ff', earType: 'unicorn', bellyColor: '#d6f3ff',
      greeting: '哇~ 我想要撒满彩虹糖球的梦幻迷你蛋糕！',
      favTag: 'rainbow',
    },
    {
      id: 'bobby', name: '爱心小熊 Bobby', en: 'Bobby BearHug', icon: 'bobby',
      color: '#ff5978', earType: 'bear', bellyColor: '#ffc2ce',
      greeting: '抱抱~ 我最爱双层彩虹玫瑰花朵蛋糕啦！',
      favTag: 'sweet',
    },
    {
      id: 'catnap', name: '紫猫 CatNap', en: 'CatNap', icon: 'catnap',
      color: '#9b72ee', earType: 'cat', bellyColor: '#d9c6ff',
      greeting: '喵呜~ 我想要暖呼呼、甜甜的点心！',
      favTag: 'sleepy',
    },
    {
      id: 'picky', name: '小粉猪 PickyPiggy', en: 'PickyPiggy', icon: 'picky',
      color: '#ff80b5', earType: 'pig', bellyColor: '#ffd1e6',
      greeting: '哼哼~ 肚子咕噜噜叫，想吃大汉堡和披萨！',
      favTag: 'savory',
    },
    {
      id: 'dogday', name: '阳光小狗 DogDay', en: 'DogDay', icon: 'dogday',
      color: '#ff9636', earType: 'dog', bellyColor: '#ffe0b2',
      greeting: '汪汪！来一份金黄香脆的煎锅料理吧！',
      favTag: 'sunny',
    },
    {
      id: 'hoppy', name: '跳跳绿兔 Hoppy', en: 'Hoppy Hopscotch', icon: 'hoppy',
      color: '#52d66c', earType: 'bunny', bellyColor: '#c8f7d2',
      greeting: '耶！给我加一点跳跳糖或者冰爽水果吧！',
      favTag: 'magic',
    },
    {
      id: 'bubba', name: '聪明小象 Bubba', en: 'Bubba Bubbaphant', icon: 'bubba',
      color: '#5ca4e8', earType: 'elephant', bellyColor: '#cfe8ff',
      greeting: '嘟嘟~ 我想喝Q弹的黑糖珍珠奶茶！',
      favTag: 'boba',
    },
    {
      id: 'poppy', name: '花朵小鸟 Poppy', en: 'Poppy Dash', icon: 'poppydash',
      color: '#ff6ba8', earType: 'comb', bellyColor: '#ffd4e8',
      greeting: '啾啾~ 我想吃酸酸甜甜的水果冰淇淋！',
      favTag: 'fruity',
    },
  ];

  const CATEGORIES = [
    { id: 'magic', name: '🌈 蛋糕甜点', en: 'Cake & Sweets', color: '#9b6bff' },
    { id: 'fruit', name: '🍓 水果甜心', en: 'Sweet Fruits', color: '#ff6b8b' },
    { id: 'meat',  name: '🥩 肉蛋芝士', en: 'Meat, Egg & Cheese', color: '#ff9248' },
    { id: 'veggie',name: '🍞 烘焙主食', en: 'Dough & Veggies', color: '#4ec96f' },
  ];

  const INGREDIENTS = [
    // 1. Sweet & Magic (HT Mini Cakes focus: Cocoa, Chocolate, Cake Mix, Rainbow)
    { id: 'chocolate', cat: 'magic', emoji: '🍫', zh: '丝滑巧克力', en: 'Chocolate Ganache',
      color: '#5c3317', inner: '#8c532b', rim: '#3d1f0d', sliceStyle: 'choco',
      choppable: true, grillable: false, sweet: 3, magic: 2 },
    { id: 'cocoa', cat: 'magic', emoji: '🫘', zh: '迷你可可豆', en: 'Mini Cocoa Beans',
      color: '#4a2511', inner: '#784323', rim: '#2a1308', sliceStyle: 'cocoa',
      choppable: true, grillable: false, sweet: 1, magic: 2 },
    { id: 'dough', cat: 'magic', emoji: '🎂', zh: '海绵蛋糕糊', en: 'Sponge Cake Mix',
      color: '#fff1c2', inner: '#fffbee', rim: '#e2c578', sliceStyle: 'dough',
      choppable: false, grillable: true, bakeable: true, cookedColor: '#e69c3a', sweet: 2, baseType: 'pancake' },
    { id: 'milk', cat: 'magic', emoji: '🥛', zh: '鲜牛奶', en: 'Fresh Milk',
      color: '#ffffff', inner: '#e8f6ff', rim: '#b8d8f0', sliceStyle: 'liquid',
      liquid: true, choppable: false, grillable: false, sweet: 1, sleepy: 2 },
    { id: 'honey', cat: 'magic', emoji: '🍯', zh: '星星蜂蜜', en: 'Star Honey',
      color: '#ffb700', inner: '#ffe47a', rim: '#cc8800', sliceStyle: 'liquid',
      liquid: true, choppable: false, grillable: false, sweet: 3, sleepy: 2 },
    { id: 'popcandy', cat: 'magic', emoji: '🍬', zh: '彩虹糖球', en: 'Rainbow Candy Balls',
      color: '#ff4081', inner: '#73f7ff', rim: '#8c2be0', sliceStyle: 'sparkle',
      choppable: false, grillable: false, sweet: 3, magic: 5 },
    { id: 'icecream', cat: 'magic', emoji: '🍦', zh: '冰淇淋球', en: 'Ice Cream Scoop',
      color: '#d4f5ff', inner: '#ffffff', rim: '#82ddf7', sliceStyle: 'scoop',
      choppable: false, grillable: false, sweet: 2, icy: 4 },
    { id: 'boba', cat: 'magic', emoji: '🧋', zh: '黑糖珍珠', en: 'Boba Pearls',
      color: '#3d2218', inner: '#734535', rim: '#1f100a', sliceStyle: 'boba',
      choppable: false, grillable: false, sweet: 2, boba: 3 },

    // 2. Fruit
    { id: 'strawberry', cat: 'fruit', emoji: '🍓', zh: '鲜草莓', en: 'Strawberry',
      color: '#ff385c', inner: '#ffd1dc', rim: '#d91b42', sliceStyle: 'strawberry',
      choppable: true, grillable: false, sweet: 2, fruity: 2 },
    { id: 'banana', cat: 'fruit', emoji: '🍌', zh: '香蕉', en: 'Banana',
      color: '#ffe042', inner: '#fff8c4', rim: '#e0b81b', sliceStyle: 'banana',
      choppable: true, grillable: true, cookedColor: '#d99a26', sweet: 2, fruity: 1 },
    { id: 'blueberry', cat: 'fruit', emoji: '🫐', zh: '蓝莓', en: 'Blueberry',
      color: '#4c5ce8', inner: '#a8b8ff', rim: '#2e3ab8', sliceStyle: 'berry',
      choppable: true, grillable: false, sweet: 1, fruity: 2 },
    { id: 'kiwi', cat: 'fruit', emoji: '🥝', zh: '奇异果', en: 'Kiwi',
      color: '#68d442', inner: '#c4f7a8', rim: '#8c6239', sliceStyle: 'kiwi',
      choppable: true, grillable: false, sweet: 1, sour: 1, fruity: 2 },
    { id: 'peach', cat: 'fruit', emoji: '🍑', zh: '水蜜桃', en: 'Peach',
      color: '#ff8da8', inner: '#ffe2b8', rim: '#e85d82', sliceStyle: 'peach',
      choppable: true, grillable: false, sweet: 2, fruity: 2 },
    { id: 'lemon', cat: 'fruit', emoji: '🍋', zh: '酸柠檬', en: 'Sour Lemon',
      color: '#ffea2b', inner: '#fff9b0', rim: '#d9be00', sliceStyle: 'citrus',
      choppable: true, grillable: false, sour: 4, fruity: 1 },

    // 3. Meat, Egg & Cheese
    { id: 'egg', cat: 'meat', emoji: '🥚', zh: '鸡蛋', en: 'Fresh Egg',
      color: '#fff6e6', inner: '#ffa200', rim: '#e0ceb2', sliceStyle: 'egg',
      crackable: true, choppable: false, grillable: true, cookedColor: '#fffdf7', savory: 2, sleepy: 1 },
    { id: 'beef', cat: 'meat', emoji: '🥩', zh: '雪花牛排', en: 'Beef Steak',
      color: '#d94545', inner: '#ffadb5', rim: '#9e2424', sliceStyle: 'meat',
      choppable: true, grillable: true, cookedColor: '#783b22', savory: 3 },
    { id: 'cheese', cat: 'meat', emoji: '🧀', zh: '黄金芝士', en: 'Cheese',
      color: '#ffc424', inner: '#ffe07d', rim: '#d99a00', sliceStyle: 'cheese',
      choppable: true, grillable: true, cookedColor: '#ffae00', savory: 2, sweet: 1 },
    { id: 'bacon', cat: 'meat', emoji: '🥓', zh: '香脆培根', en: 'Crispy Bacon',
      color: '#e85c68', inner: '#ffd1d6', rim: '#b3323e', sliceStyle: 'bacon',
      choppable: true, grillable: true, cookedColor: '#9c2822', savory: 3 },
    { id: 'shrimp', cat: 'meat', emoji: '🍤', zh: '大虾仁', en: 'Jumbo Shrimp',
      color: '#ff8466', inner: '#ffcfc2', rim: '#d95436', sliceStyle: 'shrimp',
      choppable: true, grillable: true, cookedColor: '#ff522b', savory: 2 },
    { id: 'sausage', cat: 'meat', emoji: '🌭', zh: '小香肠', en: 'Mini Sausage',
      color: '#d95338', inner: '#ffab99', rim: '#992d17', sliceStyle: 'sausage',
      choppable: true, grillable: true, cookedColor: '#872612', savory: 2 },

    // 4. Dough & Veggies
    { id: 'bun', cat: 'veggie', emoji: '🍔', zh: '汉堡面包', en: 'Burger Bun',
      color: '#e69838', inner: '#fff0c4', rim: '#b86f18', sliceStyle: 'bun',
      choppable: true, grillable: true, bakeable: true, cookedColor: '#d48322', savory: 2, baseType: 'burger' },
    { id: 'pizzabase', cat: 'veggie', emoji: '🍕', zh: '披萨饼底', en: 'Pizza Crust',
      color: '#f7dfa6', inner: '#ffefcc', rim: '#cfa85c', sliceStyle: 'pizza',
      choppable: false, grillable: true, bakeable: true, cookedColor: '#e39636', savory: 2, baseType: 'pizza' },
    { id: 'tomato', cat: 'veggie', emoji: '🍅', zh: '红番茄', en: 'Tomato',
      color: '#ff3636', inner: '#ff8a8a', rim: '#bd1919', sliceStyle: 'tomato',
      choppable: true, grillable: true, cookedColor: '#d92626', savory: 2, fruity: 1 },
    { id: 'lettuce', cat: 'veggie', emoji: '🥬', zh: '脆生菜', en: 'Crisp Lettuce',
      color: '#54d454', inner: '#b4f5b4', rim: '#2da12d', sliceStyle: 'leaf',
      choppable: true, grillable: false, savory: 1 },
    { id: 'chili', cat: 'veggie', emoji: '🌶️', zh: '喷火红辣椒', en: 'Fire Chili',
      color: '#ff1a1a', inner: '#ff7b00', rim: '#b80000', sliceStyle: 'chili',
      choppable: true, grillable: true, cookedColor: '#cc0000', spicy: 5 },
  ];

  // 6-Color Rainbow Palette + White Cloud + Rich Dark Chocolate Ganache
  const PIPING_COLORS = [
    { id: 'red',    zh: '草莓红奶油', color: '#ff385c', shadow: '#d11b3e', hi: '#ffa3b5' },
    { id: 'orange', zh: '甜橙橘奶油', color: '#ff8822', shadow: '#d66200', hi: '#ffc17a' },
    { id: 'yellow', zh: '香草黄奶油', color: '#ffd933', shadow: '#c7a30e', hi: '#fff08a' },
    { id: 'green',  zh: '薄荷绿奶油', color: '#38d968', shadow: '#1ca645', hi: '#94f2b0' },
    { id: 'blue',   zh: '天空蓝奶油', color: '#3399ff', shadow: '#126ecc', hi: '#94ccff' },
    { id: 'purple', zh: '葡萄紫奶油', color: '#9d4edd', shadow: '#712bb5', hi: '#d0a2f7' },
    { id: 'white',  zh: '云朵白奶油', color: '#fffdf9', shadow: '#e0d6c8', hi: '#ffffff' },
    { id: 'choco',  zh: '黑巧甘纳许', color: '#542d17', shadow: '#361b0c', hi: '#824c2d' },
  ];

  const SAUCES = [
    { id: 'choco_sauce',      zh: '🍫 镜面巧克力酱', color: '#4a2512', hi: '#874e2b' },
    { id: 'strawberry_sauce', zh: '🍓 鲜草莓淋酱', color: '#ff2b5e', hi: '#ff94b0' },
    { id: 'honey_sauce',      zh: '🍯 黄金蜂蜜酱', color: '#ffae00', hi: '#ffe478' },
    { id: 'cheese_sauce',     zh: '🧀 浓香芝士酱', color: '#ffc400', hi: '#fff099' },
  ];

  // Featured HT Mini Cakes Toppings: Rainbow Candy Balls, Rainbow Arch, Sunflower Pot
  const TOPPINGS = [
    { id: 'candy_balls', emoji: '🍬', zh: '彩虹糖球',   en: 'Rainbow Candy Balls' },
    { id: 'rainbow_arch',emoji: '🌈', zh: '彩虹拱桥',   en: 'Rainbow Arch Topper' },
    { id: 'flower_pot',  emoji: '🌻', zh: '微笑小花',   en: 'Mini Flower Pot' },
    { id: 'sprinkles',   emoji: '✨', zh: '彩虹糖针',   en: 'Rainbow Sprinkles' },
    { id: 'stars',       emoji: '⭐', zh: '星星糖片',   en: 'Star Candy' },
    { id: 'hearts',      emoji: '💖', zh: '爱心糖果',   en: 'Heart Sweets' },
    { id: 'berry_top',   emoji: '🍓', zh: '鲜草莓顶',   en: 'Fresh Berry' },
    { id: 'cherry',      emoji: '🍒', zh: '红樱桃',     en: 'Sweet Cherry' },
    { id: 'candle',      emoji: '🕯️', zh: '生日蜡烛',   en: 'Birthday Candle' },
    { id: 'umbrella',    emoji: '⛱️', zh: '果汁小伞',   en: 'Drink Umbrella' },
  ];

  // Signature HT Mini Cakes video dishes placed at the top!
  const WISH_ORDERS = [
    {
      id: 'ht_rainbow_candy_cake',
      zh: '魔法彩虹糖球巧克力蛋糕', en: 'Magical Rainbow Candy Ball Cake',
      critter: 'craftycorn',
      icons: ['🎂', '🍫', '🍬'],
      wantIds: ['dough', 'chocolate'],
      wantCooking: 'oven',
      wantDecor: true,
      cakeStyle: 'candy_balls',
      desc: '烘烤迷你巧克力蛋糕，淋上丝滑镜面巧克力酱，在旋转裱花台上贴满六色彩虹糖球与彩虹拱桥！',
    },
    {
      id: 'ht_rainbow_rosette_cake',
      zh: '双层彩虹玫瑰花朵蛋糕', en: 'Two-Tier Rainbow Buttercream Cake',
      critter: 'bobby',
      icons: ['🎂', '🧁', '🌈'],
      wantIds: ['dough', 'milk'],
      wantCooking: 'oven',
      wantDecor: true,
      cakeStyle: 'rainbow_rosettes',
      desc: '在旋转裱花台上为双层蛋糕挤出红橙黄绿蓝紫六色彩虹玫瑰花裱花！',
    },
    {
      id: 'strawberry_pancake',
      zh: '草莓奶油松饼塔', en: 'Strawberry Cream Pancakes',
      critter: 'bobby',
      icons: ['🥞', '🍓', '🧁'],
      wantIds: ['dough', 'strawberry'],
      wantCooking: 'pan',
      wantDecor: true,
      desc: '用平底锅煎金黄松饼，加上草莓和香甜奶油！',
    },
    {
      id: 'cheese_burger',
      zh: '双层芝士牛排汉堡', en: 'Double Cheese Steak Burger',
      critter: 'picky',
      icons: ['🍔', '🥩', '🧀'],
      wantIds: ['bun', 'beef', 'cheese'],
      wantCooking: 'pan',
      wantDecor: false,
      desc: '把牛排煎得滋滋响，叠上汉堡面包和黄金芝士！',
    },
    {
      id: 'boba_milk_tea',
      zh: '草莓黑糖珍珠奶茶', en: 'Strawberry Boba Milk Tea',
      critter: 'bubba',
      icons: ['🥛', '🧋', '🍓'],
      wantIds: ['milk', 'boba', 'strawberry'],
      wantCooking: 'blender',
      wantDecor: true,
      desc: '用搅拌杯混合鲜牛奶、黑糖珍珠和甜草莓！',
    },
    {
      id: 'sleepy_honey_cake',
      zh: 'CatNap 晚安蜂蜜云朵蛋糕', en: 'Sleepy Honey Cloud Cake',
      critter: 'catnap',
      icons: ['🥞', '🥛', '🍯'],
      wantIds: ['dough', 'milk', 'honey'],
      wantCooking: 'oven',
      wantDecor: true,
      desc: '牛奶加蜂蜜搅拌面糊，放进烤箱烤出蓬松蛋糕！',
    },
    {
      id: 'sunny_bacon_egg',
      zh: '阳光培根太阳蛋早餐', en: 'Sunny Bacon & Egg Plate',
      critter: 'dogday',
      icons: ['🥚', '🥓', '🍅'],
      wantIds: ['egg', 'bacon', 'tomato'],
      wantCooking: 'pan',
      wantDecor: false,
      desc: '敲碎鸡蛋、切好培根，在平底锅里煎出滋滋太阳蛋！',
    },
    {
      id: 'rainbow_unicorn_cake',
      zh: '独角兽彩虹跳跳糖蛋糕', en: 'Rainbow Pop Birthday Cake',
      critter: 'craftycorn',
      icons: ['🥞', '✨', '🌈'],
      wantIds: ['dough', 'popcandy'],
      wantCooking: 'oven',
      wantDecor: true,
      desc: '烘烤魔法蛋糕，挤上彩色奶油并撒满彩虹糖与蜡烛！',
    },
    {
      id: 'kiwi_berry_sundae',
      zh: '奇异果蓝莓冰淇淋圣代', en: 'Kiwi Berry Ice Cream Sundae',
      critter: 'poppy',
      icons: ['🍦', '🥝', '🫐'],
      wantIds: ['icecream', 'kiwi', 'blueberry'],
      wantCooking: 'none',
      wantDecor: true,
      desc: '切好奇异果和蓝莓，搭配冰爽香草冰淇淋球！',
    },
    {
      id: 'supreme_pizza',
      zh: '黄金拉丝番茄香肠披萨', en: 'Cheesy Tomato Sausage Pizza',
      critter: 'picky',
      icons: ['🍕', '🧀', '🌭'],
      wantIds: ['pizzabase', 'cheese', 'sausage'],
      wantCooking: 'oven',
      wantDecor: false,
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
      desc: '把水蜜桃、冰淇淋和云朵跳跳糖放进榨汁机打成冰沙！',
    },
  ];

  const byId = {};
  INGREDIENTS.forEach(item => { byId[item.id] = item; });
  const critterById = {};
  CRITTERS.forEach(c => { critterById[c.id] = c; });

  return {
    CRITTERS,
    CATEGORIES,
    INGREDIENTS,
    PIPING_COLORS,
    SAUCES,
    TOPPINGS,
    WISH_ORDERS,
    getIngredient: id => byId[id] || INGREDIENTS[0],
    getCritter: id => critterById[id] || CRITTERS[0],
  };
})();
