/* =============================================================
   Королевские Шахматы — Каталог ботов
   -------------------------------------------------------------
   Каждый бот обладает:
     • уникальным именем и титулом;
     • рейтингом ЭЛО;
     • набором способностей (визуальные и реально влияющие на игру);
     • «профилем ИИ» — набором коэффициентов, которые реально меняют
       стиль игры (агрессия, позиционка, тактика, защита, риск,
       эндгейм, интуиция, скорость, дебюты, любовь к конкретным фигурам).
   ============================================================= */

/* ---------------------------- Способности ---------------------------- */

const BOT_ABILITIES = {
  aggression: {
    id: 'aggression',
    icon: 'swords',
    name: 'Агрессия',
    desc: 'Нападает первым, никогда не отдаёт инициативу'
  },
  positional: {
    id: 'positional',
    icon: 'scale',
    name: 'Позиция',
    desc: 'Играет на структуру, активность фигур и контроль центра'
  },
  tactics: {
    id: 'tactics',
    icon: 'target',
    name: 'Тактика',
    desc: 'Видит комбинации на несколько ходов вперёд'
  },
  defense: {
    id: 'defense',
    icon: 'shield',
    name: 'Защита',
    desc: 'Никогда не оставляет свои фигуры без защиты'
  },
  speed: {
    id: 'speed',
    icon: 'bolt',
    name: 'Скорость',
    desc: 'Играет мгновенно, не тратя время на обдумывание'
  },
  endgame: {
    id: 'endgame',
    icon: 'gem',
    name: 'Эндгейм',
    desc: 'В дебюте средний, но в эндгейме — чемпион'
  },
  opening: {
    id: 'opening',
    icon: 'book',
    name: 'Дебюты',
    desc: 'Знает десятки дебютов наизусть'
  },
  risk: {
    id: 'risk',
    icon: 'dice',
    name: 'Риск',
    desc: 'Идёт на жертвы ради красивых комбинаций'
  },
  intuition: {
    id: 'intuition',
    icon: 'sparkle',
    name: 'Интуиция',
    desc: 'Находит неочевидные ходы, которые не видит расчёт'
  },
  greed: {
    id: 'greed',
    icon: 'gem',
    name: 'Материал',
    desc: 'Никогда не отдаёт фигуры без выгоды'
  }
};

/* --------------------------- Категории ботов -------------------------- */

const BOT_CATEGORIES = [
  {
    id: 'gm',
    title: 'Гроссмейстеры',
    icon: 'wK',
    desc: 'Элита мирового шахмата. Играть с ними — большая честь.',
    accent: '#f5c451'
  },
  {
    id: 'im',
    title: 'Мастера',
    icon: 'wQ',
    desc: 'Сильнейшие игроки планеты. Очень близко к гроссмейстерам.',
    accent: '#c9d1d9'
  },
  {
    id: 'cm',
    title: 'Кандидаты в мастера',
    icon: 'wR',
    desc: 'На пороге мастерства. Очень опасные соперники.',
    accent: '#cd7f32'
  },
  {
    id: 'club',
    title: 'Клубные игроки',
    icon: 'wB',
    desc: 'Сильная любительская игра по выходным.',
    accent: '#4f80ff'
  },
  {
    id: 'rookie',
    title: 'Новички',
    icon: 'wP',
    desc: 'Только учатся играть. Отличный вариант для тренировки.',
    accent: '#10b981'
  }
];

/* ------------------------------ Боты --------------------------------- */

const BOTS = [
  /* ======================= ГРОССМЕЙСТЕРЫ ========================= */
  {
    id: 'volkov',
    name: 'Аркадий Волков',
    title: 'Гроссмейстер',
    elo: 2851,
    category: 'gm',
    country: 'RUS',
    piece: 'wK',
    avatar: 'bot-volkov',
    style: 'Спокойный позиционщик. В дебюте не суетится, зато в эндгейме — приговор.',
    abilities: ['endgame', 'tactics', 'intuition'],
    special: '«Феноменальный эндгейм» — когда на доске остаётся мало фигур, точность его расчёта возрастает на треть.',
    profile: {
      depth: 5,
      quiescence: true,
      timeLimit: 2400,
      aggression: 0.38,
      positional: 0.86,
      tactics: 0.85,
      defense: 0.66,
      risk: 0.18,
      speed: 0.45,
      endgame: 1.0,
      intuition: 0.35,
      opening: 0.75,
      blunderRate: 0.004,
      thinkMin: 260,
      thinkMax: 650,
      prefer: { p: 1, n: 1, b: 1, r: 1, q: 1 }
    }
  },
  {
    id: 'kasares',
    name: 'Лев Касарес',
    title: 'Гроссмейстер',
    elo: 2793,
    category: 'gm',
    country: 'SUI',
    piece: 'wR',
    avatar: 'bot-kasares',
    style: 'Штурмовик. Считает, что на шахматной доске всегда есть жертва.',
    abilities: ['aggression', 'risk', 'tactics'],
    special: '«Берсерк» — готов обменять ферзя на коня, если это приносит победу.',
    profile: {
      depth: 5,
      quiescence: true,
      timeLimit: 2200,
      aggression: 0.98,
      positional: 0.45,
      tactics: 0.88,
      defense: 0.42,
      risk: 0.92,
      speed: 0.6,
      endgame: 0.45,
      intuition: 0.45,
      opening: 0.6,
      blunderRate: 0.02,
      thinkMin: 220,
      thinkMax: 560,
      prefer: { p: 1, n: 1.05, b: 1, r: 1, q: 1 }
    }
  },
  {
    id: 'weil',
    name: 'Каспар Вейль',
    title: 'Гроссмейстер',
    elo: 2740,
    category: 'gm',
    country: 'AUT',
    piece: 'wB',
    avatar: 'bot-weil',
    style: 'Несокрушимый. Лучшая защита в игре, сухая, но безупречная техника.',
    abilities: ['defense', 'positional', 'tactics'],
    special: '«Несокрушимый» — почти не допускает зевков и никогда не теряет фигуру даром.',
    profile: {
      depth: 4,
      quiescence: true,
      timeLimit: 2200,
      aggression: 0.4,
      positional: 0.82,
      tactics: 0.8,
      defense: 1.0,
      risk: 0.1,
      speed: 0.5,
      endgame: 0.72,
      intuition: 0.25,
      opening: 0.7,
      blunderRate: 0.002,
      thinkMin: 260,
      thinkMax: 620,
      prefer: { p: 1, n: 1, b: 1, r: 1.03, q: 1 }
    }
  },
  {
    id: 'chen',
    name: 'Дилан Чен',
    title: 'Гроссмейстер',
    elo: 2687,
    category: 'gm',
    country: 'USA',
    piece: 'wN',
    avatar: 'bot-chen',
    style: 'Машина темпо. Отвечает за секунду и сразу ставит мат в два хода.',
    abilities: ['speed', 'tactics', 'aggression'],
    special: '«Машина темпо» — думает быстрее всех, но иногда не успевает догадаться о ловушке.',
    profile: {
      depth: 4,
      quiescence: true,
      timeLimit: 1300,
      aggression: 0.75,
      positional: 0.58,
      tactics: 0.9,
      defense: 0.6,
      risk: 0.55,
      speed: 1.0,
      endgame: 0.55,
      intuition: 0.4,
      opening: 0.8,
      blunderRate: 0.035,
      thinkMin: 90,
      thinkMax: 240,
      prefer: { p: 1, n: 1.05, b: 1, r: 1, q: 1 }
    }
  },

  /* =========================== МАСТЕРА ============================= */
  {
    id: 'sokolova',
    name: 'Ирина Соколова',
    title: 'Международный мастер',
    elo: 2486,
    category: 'im',
    country: 'RUS',
    piece: 'wP',
    avatar: 'bot-sokolova',
    style: 'Знает все дебюты наизусть. Считает пешки своим любимым материалом.',
    abilities: ['opening', 'positional', 'greed'],
    special: '«Мать пешек» — её пешки стоят на вес золота, а дебютная база почти безупречна.',
    profile: {
      depth: 4,
      quiescence: true,
      timeLimit: 1600,
      aggression: 0.5,
      positional: 0.8,
      tactics: 0.72,
      defense: 0.68,
      risk: 0.28,
      speed: 0.55,
      endgame: 0.68,
      intuition: 0.3,
      opening: 1.0,
      blunderRate: 0.015,
      thinkMin: 200,
      thinkMax: 500,
      prefer: { p: 1.15, n: 1, b: 1, r: 1, q: 1 }
    }
  },
  {
    id: 'tantan',
    name: 'Тан Тан Тан',
    title: 'Мастер',
    elo: 2442,
    category: 'im',
    country: 'SGP',
    piece: 'wB',
    avatar: 'bot-tantan',
    style: 'Фанат слонов. Конь на доске — бездарность, слон — красота.',
    abilities: ['positional', 'endgame'],
    special: '«Фанат слонов» — оценивает слона на треть дороже, а коня — дешевле среднего.',
    profile: {
      depth: 4,
      quiescence: true,
      timeLimit: 1500,
      aggression: 0.48,
      positional: 0.9,
      tactics: 0.7,
      defense: 0.62,
      risk: 0.25,
      speed: 0.5,
      endgame: 0.75,
      intuition: 0.28,
      opening: 0.7,
      blunderRate: 0.02,
      thinkMin: 200,
      thinkMax: 500,
      prefer: { p: 1, n: 0.85, b: 1.3, r: 1, q: 1 }
    }
  },
  {
    id: 'marino',
    name: 'Рей Марино',
    title: 'Мастер',
    elo: 2415,
    category: 'im',
    country: 'ESP',
    piece: 'wR',
    avatar: 'bot-marino',
    style: 'Шквал. Двигает пешки вперёд и никогда не пасует.',
    abilities: ['aggression', 'speed', 'tactics'],
    special: '«Шквал» — его фигуры атакуют раньше, чем вы успеваете подумать.',
    profile: {
      depth: 3,
      quiescence: false,
      timeLimit: 1200,
      aggression: 0.92,
      positional: 0.5,
      tactics: 0.78,
      defense: 0.52,
      risk: 0.6,
      speed: 0.85,
      endgame: 0.5,
      intuition: 0.35,
      opening: 0.65,
      blunderRate: 0.04,
      thinkMin: 150,
      thinkMax: 420,
      prefer: { p: 1.08, n: 1, b: 1, r: 1, q: 1 }
    }
  },
  {
    id: 'proffai',
    name: 'Профессор ИИ',
    title: 'Мастер',
    elo: 2380,
    category: 'im',
    country: 'AI',
    piece: 'bK',
    avatar: 'bot-proffai',
    style: 'Классический сильный компьютер. Показывает учебные комбинации.',
    abilities: ['tactics', 'positional', 'defense'],
    special: '«Учебник» — играет по книге и почти не ошибается в дебюте.',
    profile: {
      depth: 4,
      quiescence: true,
      timeLimit: 1500,
      aggression: 0.55,
      positional: 0.75,
      tactics: 0.8,
      defense: 0.7,
      risk: 0.2,
      speed: 0.55,
      endgame: 0.65,
      intuition: 0.2,
      opening: 0.85,
      blunderRate: 0.012,
      thinkMin: 200,
      thinkMax: 500,
      prefer: { p: 1, n: 1, b: 1, r: 1, q: 1 }
    }
  },

  /* ==================== КАНДИДАТЫ В МАСТЕРА ====================== */
  {
    id: 'lind',
    name: 'Оскар Линд',
    title: 'Кандидат в мастера',
    elo: 2348,
    category: 'cm',
    country: 'SWE',
    piece: 'bQ',
    avatar: 'bot-lind',
    style: 'Книжный червь. Наизусть знает десятки дебютов и их тонкостей.',
    abilities: ['opening', 'positional'],
    special: '«Книжный червь» — всегда играет по теории, пока её не перебил соперник.',
    profile: {
      depth: 3,
      quiescence: false,
      timeLimit: 1100,
      aggression: 0.5,
      positional: 0.82,
      tactics: 0.65,
      defense: 0.65,
      risk: 0.2,
      speed: 0.6,
      endgame: 0.6,
      intuition: 0.22,
      opening: 1.0,
      blunderRate: 0.03,
      thinkMin: 180,
      thinkMax: 450,
      prefer: { p: 1, n: 1, b: 1.05, r: 1, q: 1 }
    }
  },
  {
    id: 'hanwei',
    name: 'Хан Вэй',
    title: 'Кандидат в мастера',
    elo: 2312,
    category: 'cm',
    country: 'CHN',
    piece: 'bB',
    avatar: 'bot-hanwei',
    style: 'Спокойный и неудобный противник. Разрушает ваш дебют тихо и настойчиво.',
    abilities: ['defense', 'endgame', 'positional'],
    special: '«Дракон» — его защита выдерживает любой штурм и заканчивается выигранным эндгеймом.',
    profile: {
      depth: 3,
      quiescence: true,
      timeLimit: 1200,
      aggression: 0.45,
      positional: 0.78,
      tactics: 0.68,
      defense: 0.9,
      risk: 0.18,
      speed: 0.5,
      endgame: 0.82,
      intuition: 0.25,
      opening: 0.68,
      blunderRate: 0.018,
      thinkMin: 200,
      thinkMax: 480,
      prefer: { p: 1, n: 1, b: 1, r: 1.05, q: 1 }
    }
  },
  {
    id: 'hal',
    name: 'Пётр Халь',
    title: 'Кандидат в мастера',
    elo: 2261,
    category: 'cm',
    country: 'GER',
    piece: 'bN',
    avatar: 'bot-hal',
    style: 'Безумец. Играет на вдохновении: то блестяще, то абсолютно дико.',
    abilities: ['risk', 'intuition', 'aggression'],
    special: '«Безумец» — способен найти ход, которого не видит никакой расчёт... или свалить ферзя за так.',
    profile: {
      depth: 3,
      quiescence: false,
      timeLimit: 900,
      aggression: 0.8,
      positional: 0.45,
      tactics: 0.6,
      defense: 0.45,
      risk: 0.95,
      speed: 0.75,
      endgame: 0.45,
      intuition: 0.9,
      opening: 0.5,
      blunderRate: 0.08,
      thinkMin: 150,
      thinkMax: 400,
      prefer: { p: 1, n: 1.05, b: 1, r: 1, q: 1 }
    }
  },

  /* ======================= КЛУБНЫЕ ИГРОКИ ======================== */
  {
    id: 'nikita',
    name: 'Никита Соколов',
    title: 'Клубный игрок',
    elo: 2054,
    category: 'club',
    country: 'BIH',
    piece: 'wN',
    avatar: 'bot-nikita',
    style: 'Художник атак. Начинает штурм при любой возможности.',
    abilities: ['aggression', 'intuition'],
    special: '«Художник атак» — не берёт под контроль слонов, зато атакует без тормозов.',
    profile: {
      depth: 2,
      quiescence: false,
      timeLimit: 800,
      aggression: 0.8,
      positional: 0.55,
      tactics: 0.62,
      defense: 0.55,
      risk: 0.45,
      speed: 0.7,
      endgame: 0.5,
      intuition: 0.5,
      opening: 0.6,
      blunderRate: 0.06,
      thinkMin: 180,
      thinkMax: 420,
      prefer: { p: 1, n: 1, b: 0.95, r: 1, q: 1 }
    }
  },
  {
    id: 'yuki',
    name: 'Юки Танака',
    title: 'Клубный игрок',
    elo: 1928,
    category: 'club',
    country: 'JPN',
    piece: 'wP',
    avatar: 'bot-yuki',
    style: 'Тихая вода. Незаметно забирает пространство и улучшает позицию.',
    abilities: ['positional', 'speed', 'defense'],
    special: '«Тихая вода» — играет без лишнего риска и почти не даёт подарков.',
    profile: {
      depth: 2,
      quiescence: false,
      timeLimit: 700,
      aggression: 0.42,
      positional: 0.8,
      tactics: 0.58,
      defense: 0.72,
      risk: 0.12,
      speed: 0.85,
      endgame: 0.6,
      intuition: 0.4,
      opening: 0.7,
      blunderRate: 0.05,
      thinkMin: 140,
      thinkMax: 360,
      prefer: { p: 1, n: 1, b: 1.05, r: 1, q: 1 }
    }
  },
  {
    id: 'klubai',
    name: 'Клубный ИИ',
    title: 'Клубный игрок',
    elo: 1620,
    category: 'club',
    country: 'AI',
    piece: 'wK',
    avatar: 'bot-klubai',
    style: 'Уверенный середняк. Играет просто, но без грубых ошибок.',
    abilities: ['tactics', 'positional'],
    special: '«Уверенный середняк» — надёжный соперник для тренировки тактики.',
    profile: {
      depth: 2,
      quiescence: false,
      timeLimit: 500,
      aggression: 0.5,
      positional: 0.65,
      tactics: 0.6,
      defense: 0.6,
      risk: 0.2,
      speed: 0.8,
      endgame: 0.5,
      intuition: 0.2,
      opening: 0.6,
      blunderRate: 0.09,
      thinkMin: 160,
      thinkMax: 380,
      prefer: { p: 1, n: 1, b: 1, r: 1, q: 1 }
    }
  },

  /* ============================ НОВИЧКИ ========================== */
  {
    id: 'petya',
    name: 'Петя Новичков',
    title: 'Новичок',
    elo: 780,
    category: 'rookie',
    country: 'NEW',
    piece: 'wP',
    avatar: 'bot-petya',
    style: 'Едва знает правила. Иногда выигрывает дешёвые ферзи.',
    abilities: ['intuition'],
    special: '«Ученик» — учится на ваших ошибках. Идеально, чтобы потренировать атаку.',
    profile: {
      depth: 1,
      quiescence: false,
      timeLimit: 300,
      aggression: 0.5,
      positional: 0.4,
      tactics: 0.25,
      defense: 0.35,
      risk: 0.35,
      speed: 0.95,
      endgame: 0.3,
      intuition: 0.6,
      opening: 0.35,
      blunderRate: 0.35,
      thinkMin: 140,
      thinkMax: 320,
      prefer: { p: 1, n: 1, b: 1, r: 1, q: 1 }
    }
  },
  {
    id: 'uchebny',
    name: 'Учебный ИИ',
    title: 'Новичок',
    elo: 540,
    category: 'rookie',
    country: 'AI',
    piece: 'bP',
    avatar: 'bot-uchebny',
    style: 'Ходит наугад. Подходит, чтобы почувствовать вкус победы.',
    abilities: ['speed'],
    special: '«Учебный ИИ» — максимально прощается и играет на минимальной глубине.',
    profile: {
      depth: 1,
      quiescence: false,
      timeLimit: 250,
      aggression: 0.45,
      positional: 0.35,
      tactics: 0.2,
      defense: 0.3,
      risk: 0.3,
      speed: 1.0,
      endgame: 0.25,
      intuition: 0.5,
      opening: 0.3,
      blunderRate: 0.45,
      thinkMin: 120,
      thinkMax: 260,
      prefer: { p: 1, n: 1, b: 1, r: 1, q: 1 }
    }
  }
];

/* ------------------------------ Утилиты ------------------------------ */

/** Найти бота по id */
function getBotById(id) {
  return BOTS.find(b => b.id === id) || null;
}

/** Категория бота */
function getBotCategory(bot) {
  if (!bot) return null;
  return BOT_CATEGORIES.find(c => c.id === bot.category) || null;
}

/** Все боты категории (по убыванию ЭЛО) */
function getBotsByCategory(categoryId) {
  return BOTS.filter(b => b.category === categoryId).sort((a, b) => b.elo - a.elo);
}

/** Боты, сгруппированные по категориям (для отрисовки разделов) */
function getGroupedBots() {
  return BOT_CATEGORIES.map(cat => ({
    category: cat,
    bots: getBotsByCategory(cat.id)
  })).filter(group => group.bots.length > 0);
}

/** Поиск ботов по имени / титулу / стилю описания */
function searchBots(query, categoryId = 'all') {
  const q = (query || '').trim().toLowerCase();
  return BOTS.filter(bot => {
    if (categoryId && categoryId !== 'all' && bot.category !== categoryId) return false;
    if (!q) return true;
    const haystack = [
      bot.name,
      bot.title,
      bot.style,
      bot.special,
      bot.country,
      ...bot.abilities.map(a => (BOT_ABILITIES[a] || {}).name || '')
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  }).sort((a, b) => b.elo - a.elo);
}

/** Случайный бот (не новичок, если possible = true) */
function getRandomBot(possibleOnly = true) {
  const pool = possibleOnly ? BOTS.filter(b => b.elo >= 1500) : BOTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Форматирование ЭЛО с разделителем */
function formatElo(elo) {
  return String(elo).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Цвет бейджа ЭЛО по категории */
function getEloColor(bot) {
  const cat = getBotCategory(bot);
  return cat ? cat.accent : '#4f80ff';
}
