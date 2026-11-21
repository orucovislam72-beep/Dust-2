/* =============================================================
   Дебютная книга для разбора матча
   -------------------------------------------------------------
   Ходы, которые считаются теоретическими (как на chess.com:
   «Best move» / «Excellent»), независимо от оценки движка на
   малой глубине. Ключ — первые 4 поля FEN (без счётчиков ходов).
   ============================================================= */

const OPENING_LINES = [
  // --- 1.e4 e5 ---
  { name: 'Итальянская игра', eco: 'C50', moves: ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6','d2d3','f8c5','c2c3','d7d6'] },
  { name: 'Испанская партия', eco: 'C60', moves: ['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','b5a4','g8f6','e1g1','f8e7'] },
  { name: 'Разменный вариант испанской', eco: 'C62', moves: ['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','b5c6','d7c6'] },
  { name: 'Шотландская игра', eco: 'C44', moves: ['e2e4','e7e5','g1f3','b8c6','d2d4','e5d4','f3d4','g8f6'] },
  { name: 'Венская игра', eco: 'C25', moves: ['e2e4','e7e5','b1c3','g8f6','f2f4','d7d5'] },
  { name: 'Датский гамбит', eco: 'C21', moves: ['e2e4','e7e5','d2d4','e5d4','c2c3','d4c3'] },
  { name: 'Дебют слона', eco: 'C23', moves: ['e2e4','e7e5','f1c4','g8f6'] },

  // --- Сицилианская защита ---
  { name: 'Сицилианская, план Найдорфа', eco: 'B90', moves: ['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4','g8f6','b1c3','a7a6'] },
  { name: 'Сицилианская, дракон', eco: 'B70', moves: ['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4','g8f6','b1c3','g7g6','f1e2','f8g7'] },
  { name: 'Сицилианская, закрытый вариант', eco: 'B23', moves: ['e2e4','c7c5','b1c3','b8c6','g2g3','g8f6','f1g2','g7g6','d2d3','f8g7'] },
  { name: 'Сицилианская, атака Розенберга', eco: 'B22', moves: ['e2e4','c7c5','c2c3','d7d5','e4d5','d8d5'] },

  // --- Французская / Каро-Канн / Пирц ---
  { name: 'Французская защита', eco: 'C00', moves: ['e2e4','e7e6','d2d4','d7d5','b1c3','g8f6','c1g5','f8e7'] },
  { name: 'Французская, Тарраш', eco: 'C03', moves: ['e2e4','e7e6','d2d4','d7d5','b1d2','g8f6','e4e5','f6d7'] },
  { name: 'Защита Каро-Канн', eco: 'B10', moves: ['e2e4','c7c6','d2d4','d7d5','b1c3','d5e4','c3e4','c8f5'] },
  { name: 'Защита Пирца', eco: 'B07', moves: ['e2e4','d7d6','d2d4','g8f6','b1c3','g7g6','f2f4','f8g7'] },
  { name: 'Скандинавская защита', eco: 'B01', moves: ['e2e4','d7d5','e4d5','d8d5','b1c3','d5a5'] },
  { name: 'Защита Алехина', eco: 'B02', moves: ['e2e4','g8f6','e4e5','f6d5','d2d4','d7d6'] },

  // --- 1.d4 ---
  { name: 'Ферзевый гамбит', eco: 'D06', moves: ['d2d4','d7d5','c2c4','e7e6','b1c3','g8f6','c1g5','f8e7'] },
  { name: 'Принятый ферзевый гамбит', eco: 'D20', moves: ['d2d4','d7d5','c2c4','d5c4','g1f3','g8f6','e2e3','e7e6'] },
  { name: 'Славянская защита', eco: 'D10', moves: ['d2d4','d7d5','c2c4','c7c6','b1c3','g8f6','g1f3','e7e6'] },
  { name: 'Лондонская система', eco: 'D02', moves: ['d2d4','d7d5','g1f3','g8f6','c1f4','e7e6','e2e3','c7c5','b1c3'] },
  { name: 'Староиндийская защита', eco: 'E60', moves: ['d2d4','g8f6','c2c4','g7g6','b1c3','f8g7','e2e4','d7d6'] },
  { name: 'Новоиндийская защита', eco: 'E20', moves: ['d2d4','g8f6','c2c4','e7e6','b1c3','f8b4','e2e3','e8g8'] },
  { name: 'Защита Нимцовича', eco: 'E30', moves: ['d2d4','g8f6','c2c4','e7e6','b1c3','f8b4','a2a3','b4c3','b2c3'] },
  { name: 'Защита Грюнфельда', eco: 'D70', moves: ['d2d4','g8f6','c2c4','g7g6','b1c3','d7d5','c4d5','f6d5'] },
  { name: 'Защита Бенони', eco: 'A43', moves: ['d2d4','g8f6','c2c4','c7c5','d4d5','e7e6'] },
  { name: 'Голландская защита', eco: 'A80', moves: ['d2d4','f7f5','g1f3','g8f6','g2g3','e7e6','f1g2','f8e7'] },
  { name: 'Защита Чигорина', eco: 'D11', moves: ['d2d4','d7d5','c2c4','b8c6','b1c3','d7d5'] },

  // --- 1.c4 / 1.Nf3 / прочее ---
  { name: 'Английское начало', eco: 'A10', moves: ['c2c4','e7e5','b1c3','g8f6','g2g3','d7d5','c4d5','f6d5'] },
  { name: 'Английское, симметричное', eco: 'A30', moves: ['c2c4','c7c5','b1c3','b8c6','g2g3','g8f6','f1g2','g7g6'] },
  { name: 'Дебют Рети', eco: 'A04', moves: ['g1f3','d7d5','g2g3','g8f6','f1g2','e7e6','e1g1','f8e7'] },
  { name: 'Бергский дебют', eco: 'A00', moves: ['b1c3','d7d5','d2d4','g8f6'] },
  { name: 'Дебют ферзевого пешки', eco: 'D00', moves: ['d2d4','d7d5','c1f4','g8f6','e2e3','e7e6'] },
  { name: 'Каталонское начало', eco: 'E00', moves: ['d2d4','g8f6','c2c4','e7e6','g2g3','d7d5','f1g2','d5c4'] }
];

let _openingIndex = null;

/** Найти объект хода по UCI в заданной позиции */
function findUciMove(engine, uci) {
  if (!uci || uci.length < 4) return null;
  const files = 'abcdefgh';
  const fr = 8 - Number(uci[1]), fc = files.indexOf(uci[0]);
  const tr = 8 - Number(uci[3]), tc = files.indexOf(uci[2]);
  const promo = uci.length > 4 ? uci[4].toLowerCase() : null;
  if ([fr, fc, tr, tc].some(v => !Number.isInteger(v) || v < 0 || v > 7)) return null;
  for (const m of engine.getAllLegalMoves()) {
    if (m.from.r === fr && m.from.c === fc && m.to.r === tr && m.to.c === tc) {
      if (promo) { if (m.promotion === promo) return m; }
      else if (!m.promotion) return m;
    }
  }
  return null;
}

/** Построить индекс: FEN(4 поля) → { name, eco, moves:Set<UCI> } */
function buildOpeningIndex() {
  const eng = new ChessEngine();
  const map = new Map();
  const keyOf = (fen) => fen.split(' ').slice(0, 4).join(' ');

  for (const line of OPENING_LINES) {
    eng.reset();
    for (const uci of line.moves) {
      const key = keyOf(eng.getFEN());
      let entry = map.get(key);
      if (!entry) { entry = { name: line.name, eco: line.eco, moves: new Set() }; map.set(key, entry); }
      entry.moves.add(uci);
      const mv = findUciMove(eng, uci);
      if (!mv) break;
      eng.makeMoveInternal(mv);
    }
  }

  // Стартовая позиция: все главные первые ходы считаются теоретическими
  eng.reset();
  const start = keyOf(eng.getFEN());
  const mainFirst = ['e2e4','d2d4','c2c4','g1f3','g2g3','f2f4','b1c3'];
  const startEntry = { name: 'Дебют', eco: 'A00', moves: new Set(mainFirst) };
  map.set(start, startEntry);

  return map;
}

/** Является ли ход дебютной теорией? Возвращает { name, eco } или null. */
function bookMoveFor(fen, uci) {
  if (!_openingIndex) _openingIndex = buildOpeningIndex();
  const key = fen.split(' ').slice(0, 4).join(' ');
  const entry = _openingIndex.get(key);
  if (!entry || !entry.moves.has(uci)) return null;
  return { name: entry.name, eco: entry.eco };
}
