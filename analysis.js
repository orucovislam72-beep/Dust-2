/* =============================================================
   Королевские Шахматы — Разбор матча (анализ)
   -------------------------------------------------------------
   Разбирает сыгранную партию ход за ходом:
     • оценивает позицию до и после каждого хода;
     • ищет лучший ход на каждой позиции;
     • классифицирует ходы (лучший / отличный / хороший /
       неточность / ошибка / провал / блеск / пропущенный мат);
     • считает точность (accuracy) каждой стороны.
   ============================================================= */

/** Перевод оценки в центах в процент побед (0..100) */
function cpToWinPercent(cp) {
  if (cp >= 10000) return 100;
  if (cp <= -10000) return 0;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Перевести PV Stockfish (UCI) в нотацию SAN для показа игроку */
function pvToSan(fen, pv) {
  if (!pv || !pv.length) return [];
  const eng = new ChessEngine();
  if (!eng.loadFEN(fen)) return [];
  const files = 'abcdefgh';
  const out = [];
  for (const uci of pv) {
    const fr = 8 - Number(uci[1]), fc = files.indexOf(uci[0]);
    const tr = 8 - Number(uci[3]), tc = files.indexOf(uci[2]);
    const promo = uci.length > 4 ? uci[4].toLowerCase() : null;
    let mv = null;
    for (const m of eng.getAllLegalMoves()) {
      if (m.from.r === fr && m.from.c === fc && m.to.r === tr && m.to.c === tc) {
        if (promo) { if (m.promotion === promo) { mv = m; break; } }
        else if (!m.promotion) { mv = m; break; }
      }
    }
    if (!mv) break;
    const rec = eng.makeMove(mv);
    out.push(rec && rec.san ? rec.san : uci);
  }
  return out;
}

/** Стадия партии по позиции и номеру хода */
function phaseOfPosition(snap, ply) {
  if (ply < 16) return 'opening';
  let material = 0;
  for (const row of snap.board) for (const p of row) {
    if (p && p.type !== 'k' && p.type !== 'p') {
      material += ({ n: 320, b: 330, r: 500, q: 900 })[p.type] || 0;
    }
  }
  return material < 2600 ? 'endgame' : 'middlegame';
}

/** Классификаторы ходов */
const MOVE_CLASSES = {
  best: { label: 'Лучший ход', color: '#22c55e', glyph: 'check' },
  book: { label: 'Дебют (теория)', color: '#22c55e', glyph: 'book' },
  brilliant: { label: 'Блеск!', color: '#a855f7', glyph: 'sparkle' },
  excellent: { label: 'Отличный ход', color: '#4ade80', glyph: 'check' },
  good: { label: 'Хороший ход', color: '#94a3b8', glyph: 'dot' },
  inaccuracy: { label: 'Неточность', color: '#f59e0b', glyph: 'question' },
  mistake: { label: 'Ошибка', color: '#f97316', glyph: 'cross' },
  blunder: { label: 'Провал', color: '#ef4444', glyph: 'warn' },
  missedMate: { label: 'Пропущен мат', color: '#e11d48', glyph: 'crown' }
};

class GameAnalyzer {
  /**
   * @param {Function|null} analyzeFn — асинхронная функция разбора позиции
   *   (engine, fen, prof) => { scored, best, isWhite, turn }.
   *   Если не задана, используется внутренний ChessAI.
   */
  constructor(analyzeFn = null) {
    this.analyzeFn = analyzeFn;
    this.reset();
  }

  reset() {
    this.temp = new ChessEngine();
    this.ai = new ChessAI(this.temp);
    this.snapshots = [];
    this.entries = [];
    this.index = 0;
    this.done = false;
    this.result = null;
    this.reason = '';
  }

  /** Подготовить партию к разбору */
  start(history, result, reason) {
    this.reset();
    this.result = result || '*';
    this.reason = reason || '';

    const snaps = [];
    snaps.push(this.makeSnapshot(null));

    for (const rec of history) {
      try {
        this.temp.makeMove(rec.move);
      } catch (e) {
        break;
      }
      snaps.push(this.makeSnapshot(rec));
    }

    this.snapshots = snaps;
  }

  makeSnapshot(rec) {
    return {
      fen: this.temp.getFEN(),
      board: this.temp.board.map(row => row.map(p => (p ? { ...p } : null))),
      turn: this.temp.turn,
      san: rec ? rec.san : null,
      move: rec ? rec.move : null,
      inCheck: this.temp.inCheck(this.temp.turn),
      king: this.temp.findKing(this.temp.turn)
    };
  }

  get totalPositions() {
    return Math.max(0, this.snapshots.length - 1);
  }

  /** Разобрать одну позицию. Возвращает true, если есть ещё что разбирать. */
  async step(prof = null) {
    if (this.index >= this.totalPositions) {
      this.done = true;
      return false;
    }

    const snap = this.snapshots[this.index];
    // Ход, сыгранный ИЗ этой позиции, хранится в следующем снапшоте
    const next = this.snapshots[this.index + 1];
    const played = next ? next.move : null;
    const playedSan = next ? next.san : null;

    // Загружаем позицию в отдельный движок и оцениваем её
    this.temp.loadFEN(snap.fen);
    const res = this.analyzeFn
      ? await this.analyzeFn(this.temp, snap.fen, prof)
      : this.ai.analyzePosition(prof);

    const evalBefore = res.best ? res.best.score : 0;

    let playedScore = evalBefore;
    let playedEntry = null;
    let playedPv = null;
    if (played) {
      for (const s of res.scored) {
        if (s.move.from.r === played.from.r && s.move.from.c === played.from.c &&
            s.move.to.r === played.to.r && s.move.to.c === played.to.c) {
          playedScore = s.score;
          playedEntry = s.move;
          playedPv = s.pv || null;
          break;
        }
      }
      // Ход не вошёл в список лучших — оценим позицию после него отдельно
      if (!playedEntry && this.analyzeFn) {
        this.temp.loadFEN(snap.fen);
        this.temp.makeMoveInternal(played);
        const afterFen = this.temp.getFEN();
        // Движок должен оставаться в позиции ПОСЛЕ хода: analyzeFn строит
        // карту легальных ходов именно по переданному engine + fen.
        const afterRes = await this.analyzeFn(this.temp, afterFen, prof);
        this.temp.loadFEN(snap.fen); // восстановить исходную позицию
        if (afterRes.best) playedScore = afterRes.best.score;
        playedEntry = played;
      }
    }

    // Дебютная теория: ход из книги всегда считается корректным, даже если
    // движок на малой глубине оценивает его как неточность (как на chess.com).
    const playedUci = played
      ? (typeof moveToKey === 'function' ? moveToKey(played) : '') + (played.promotion || '')
      : null;
    const book = playedUci && typeof bookMoveFor === 'function'
      ? bookMoveFor(snap.fen, playedUci)
      : null;

    const isWhite = snap.turn === 'w';
    const moverEvalBefore = isWhite ? evalBefore : -evalBefore;
    const moverEvalAfter = isWhite ? playedScore : -playedScore;
    const loss = Math.max(0, moverEvalBefore - moverEvalAfter);

    const sameMove = (a, b) => !!(a && b &&
      a.from.r === b.from.r && a.from.c === b.from.c &&
      a.to.r === b.to.r && a.to.c === b.to.c);
    const isBest = sameMove(res.best ? res.best.move : null, played);

    // Мат-оценки имеют вид ±(50000 − глубина), поэтому порог с запасом.
    const MATE_THRESHOLD = 40000;
    const mateAvailable = moverEvalBefore >= MATE_THRESHOLD;
    const playedMates = moverEvalAfter >= MATE_THRESHOLD;
    const missedMate = mateAvailable && !playedMates;

    // Жертва материала: отдаём более ценную фигуру, берём менее ценную.
    const VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    let isSacrifice = false;
    if (played) {
      const attacker = snap.board[played.from.r][played.from.c];
      const victim = snap.board[played.to.r][played.to.c];
      if (attacker) {
        const aVal = VALUES[attacker.type] || 0;
        const vVal = victim ? (VALUES[victim.type] || 0) : 0;
        // отдаём фигуру (от коня и дороже), получаем меньше — жертва
        if (aVal >= 320 && aVal > vVal && vVal < 900) isSacrifice = true;
      }
    }

    let cls;
    if (book) {
      cls = 'book';
    } else if (isBest || playedMates) {
      cls = 'best';
    } else if (missedMate) {
      cls = 'missedMate';
    } else if (loss < 15) {
      cls = 'excellent';
    } else if (loss < 45) {
      cls = 'good';
    } else if (loss < 100) {
      cls = 'inaccuracy';
    } else if (loss < 250) {
      cls = 'mistake';
    } else {
      cls = 'blunder';
    }

    // Блеск: жертва материала, сохраняющая выигрышную позицию.
    // Может совпадать с «лучшим ходом» — так обычное классифицируют шахматные сайты.
    if (!book && !missedMate && isSacrifice && moverEvalAfter >= 150 &&
        (cls === 'best' || cls === 'excellent' || cls === 'good')) {
      cls = 'brilliant';
    }

    // Точность: дебютная теория не снижает оценку
    const winBefore = cpToWinPercent(moverEvalBefore);
    const winAfter = cpToWinPercent(moverEvalAfter);
    const lossPct = Math.max(0, winBefore - winAfter);
    let accuracy = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.00354 * lossPct) - 3.1669));
    if (book) accuracy = 100;

    this.entries.push({
      ply: this.index,
      san: playedSan,
      color: snap.turn,
      cls,
      loss,
      accuracy,
      bookName: book ? book.name : null,
      phase: phaseOfPosition(snap, this.index),
      evalBefore,
      evalAfter: playedScore,
      bestMove: res.best ? res.best.move : null,
      // Лучшая линия от движка в нотации (то, что «стоило сыграть»)
      bestLine: pvToSan(snap.fen, res.bestPv || []),
      playedLine: pvToSan(snap.fen, playedPv || []),
      playedMove: played,
      moveNumber: Math.floor(this.index / 2) + 1
    });

    this.index++;
    return this.index < this.totalPositions;
  }

  /** Итоговая сводка по партии */
  getSummary() {
    const white = this.entries.filter(e => e.color === 'w');
    const black = this.entries.filter(e => e.color === 'b');

    const avg = (arr) => arr.length
      ? arr.reduce((s, e) => s + e.accuracy, 0) / arr.length
      : 0;

    const count = (arr, cls) => arr.filter(e => e.cls === cls).length;

    const worst = (arr) => arr.reduce((acc, e) => (e.loss > (acc ? acc.loss : -1) ? e : acc), null);
    const acp = (arr) => arr.length
      ? Math.round(arr.reduce((s, e) => s + e.loss, 0) / arr.length)
      : 0;
    const phases = (color) => {
      const out = {};
      for (const ph of ['opening', 'middlegame', 'endgame']) {
        const list = this.entries.filter(e => e.color === color && e.phase === ph);
        out[ph] = { acc: avg(list), count: list.length };
      }
      return out;
    };
    // Переломные моменты — 3 крупнейших просадки оценки за партию
    const keyMoments = this.entries
      .filter(e => e.loss >= 60)
      .slice()
      .sort((a, b) => b.loss - a.loss)
      .slice(0, 3)
      .map(e => ({
        index: e.ply + 1,
        moveNumber: e.moveNumber,
        color: e.color,
        san: e.san,
        loss: e.loss,
        cls: e.cls,
        evalBefore: e.evalBefore,
        evalAfter: e.evalAfter
      }));

    const classes = {};
    for (const e of this.entries) classes[e.cls] = (classes[e.cls] || 0) + 1;

    return {
      whiteAcc: avg(white),
      blackAcc: avg(black),
      whiteAcp: acp(white),
      blackAcp: acp(black),
      whitePhases: phases('w'),
      blackPhases: phases('b'),
      keyMoments,
      classes,
      whiteMoves: white.length,
      blackMoves: black.length,
      whiteBlunders: count(white, 'blunder'),
      blackBlunders: count(black, 'blunder'),
      whiteMistakes: count(white, 'mistake') + count(white, 'inaccuracy'),
      blackMistakes: count(black, 'mistake') + count(black, 'inaccuracy'),
      whiteBrilliant: count(white, 'brilliant'),
      blackBrilliant: count(black, 'brilliant'),
      worstWhite: worst(white),
      worstBlack: worst(black),
      result: this.result,
      reason: this.reason,
      totalMoves: this.entries.length
    };
  }
}
