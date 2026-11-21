// Intelligent Chess AI with Minimax, Alpha-Beta Pruning & Positional Heuristics
// + поддержка персональных профилей ботов (агрессия, позиция, тактика, риск...)

/* --------------------- Дебютная база (координатная) ------------------- */
const OPENING_BOOK = [
  { name: 'Итальянская игра', eco: 'C50', moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5', 'c2c3', 'd7d6'] },
  { name: 'Испанская партия', eco: 'C60', moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7'] },
  { name: 'Сицилианская защита', eco: 'B90', moves: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'] },
  { name: 'Французская защита', eco: 'C00', moves: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6'] },
  { name: 'Защита Каро-Канн', eco: 'B10', moves: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4'] },
  { name: 'Ферзь против пешки', eco: 'D06', moves: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'f8e7', 'e2e3', 'e8g8'] },
  { name: 'Лондонская система', eco: 'D02', moves: ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'c1f4', 'e7e6', 'e2e3', 'c7c5', 'b1c3', 'b8c6'] },
  { name: 'Защита Фальценгера', eco: 'C40', moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'd7d6'] },
  { name: 'Скандинавская защита', eco: 'B01', moves: ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5'] },
  { name: 'Сицилианская со схемой Каро-Канн', eco: 'B50', moves: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'e7e6'] },
  { name: 'Славянская защита', eco: 'D10', moves: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'g1f3', 'e7e6', 'f1b5', 'f8b4'] },
  { name: 'Голландская защита', eco: 'A80', moves: ['d2d4', 'f7f5', 'g1f3', 'g8f6', 'g2g3', 'e7e6', 'f1g2', 'f8e7', 'e1g1', 'e8g8'] }
];

/* --------------------------- Профиль ИИ ------------------------------ */
const NEUTRAL_PROFILE = Object.freeze({
  depth: 3,
  quiescence: false,
  timeLimit: 1200,
  aggression: 0.5,
  positional: 0.5,
  tactics: 0.5,
  defense: 0.5,
  risk: 0.2,
  speed: 0.5,
  endgame: 0.5,
  intuition: 0.15,
  opening: 0.5,
  blunderRate: 0.02,
  thinkMin: 300,
  thinkMax: 900,
  bookChance: 0.8,
  prefer: Object.freeze({ p: 1, n: 1, b: 1, r: 1, q: 1 })
});

/* Преобразовать ход в координатный ключ вида "e2e4" */
function moveToKey(move) {
  if (!move) return '';
  const files = 'abcdefgh';
  return files[move.from.c] + (8 - move.from.r) + files[move.to.c] + (8 - move.to.r);
}

class ChessAI {
  constructor(engine) {
    this.engine = engine;
    this.pieceValues = {
      p: 100,
      n: 320,
      b: 330,
      r: 500,
      q: 900,
      k: 20000
    };

    // История ходов текущей партии (для дебютной базы)
    this.gameLine = [];
    this.deadline = Infinity;
    this.nodeDeadline = Infinity;
    this.nodes = 0;
    this.aborted = false;

    // Кооперативный поиск: не держим главный поток дольше sliceMs
    this.sliceMs = 16;
    this.sliceStart = 0;

    // Piece-Square Tables (White perspective, rank 0 is 8th rank, rank 7 is 1st rank)
    this.pawnTable = [
      [  0,  0,  0,  0,  0,  0,  0,  0],
      [ 50, 50, 50, 50, 50, 50, 50, 50],
      [ 10, 10, 20, 30, 30, 20, 10, 10],
      [  5,  5, 10, 25, 25, 10,  5,  5],
      [  0,  0,  0, 20, 20,  0,  0,  0],
      [  5, -5,-10,  0,  0,-10, -5,  5],
      [  5, 10, 10,-20,-20, 10, 10,  5],
      [  0,  0,  0,  0,  0,  0,  0,  0]
    ];

    this.knightTable = [
      [-50,-40,-30,-30,-30,-30,-40,-50],
      [-40,-20,  0,  0,  0,  0,-20,-40],
      [-30,  0, 10, 15, 15, 10,  0,-30],
      [-30,  5, 15, 20, 20, 15,  5,-30],
      [-30,  0, 15, 20, 20, 15,  0,-30],
      [-30,  5, 10, 15, 15, 10,  5,-30],
      [-40,-20,  0,  5,  5,  0,-20,-40],
      [-50,-40,-30,-30,-30,-30,-40,-50]
    ];

    this.bishopTable = [
      [-20,-10,-10,-10,-10,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5, 10, 10,  5,  0,-10],
      [-10,  5,  5, 10, 10,  5,  5,-10],
      [-10,  0, 10, 10, 10, 10,  0,-10],
      [-10, 10, 10, 10, 10, 10, 10,-10],
      [-10,  5,  0,  0,  0,  0,  5,-10],
      [-20,-10,-10,-10,-10,-10,-10,-20]
    ];

    this.rookTable = [
      [  0,  0,  0,  0,  0,  0,  0,  0],
      [  5, 10, 10, 10, 10, 10, 10,  5],
      [ -5,  0,  0,  0,  0,  0,  0, -5],
      [ -5,  0,  0,  0,  0,  0,  0, -5],
      [ -5,  0,  0,  0,  0,  0,  0, -5],
      [ -5,  0,  0,  0,  0,  0,  0, -5],
      [ -5,  0,  0,  0,  0,  0,  0, -5],
      [  0,  0,  0,  5,  5,  0,  0,  0]
    ];

    this.queenTable = [
      [-20,-10,-10, -5, -5,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5,  5,  5,  5,  0,-10],
      [ -5,  0,  5,  5,  5,  5,  0, -5],
      [  0,  0,  5,  5,  5,  5,  0, -5],
      [-10, 10, 10, 10, 10, 10, 10,-10],
      [-10,  0,  5,  0,  0,  0,  0,-10],
      [-20,-10,-10, -5, -5,-10,-10,-20]
    ];

    this.kingMiddleTable = [
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-20,-30,-30,-40,-40,-30,-30,-20],
      [-10,-20,-20,-20,-20,-20,-20,-10],
      [ 20, 20,  0,  0,  0,  0, 20, 20],
      [ 20, 30, 10,  0,  0, 10, 30, 20]
    ];

    this.kingEndTable = [
      [-50,-40,-30,-20,-20,-30,-40,-50],
      [-30,-20,-10,  0,  0,-10,-20,-30],
      [-30,-10, 20, 30, 30, 20,-10,-30],
      [-30,-10, 30, 40, 40, 30,-10,-30],
      [-30,-10, 30, 40, 40, 30,-10,-30],
      [-30,-10, 20, 30, 30, 20,-10,-30],
      [-30,-30,  0,  0,  0,  0,-30,-30],
      [-50,-30,-30,-30,-30,-30,-30,-50]
    ];
  }

  /* ------------------------------------------------------------------ */
  /*  Профиль                                                            */
  /* ------------------------------------------------------------------ */

  resetGame() {
    this.gameLine = [];
  }

  recordMove(move) {
    this.gameLine.push(moveToKey(move));
    if (this.gameLine.length > 40) this.gameLine.shift();
  }

  /** Собрать итоговый профиль: базовый (по сложности) + персональный бота */
  buildProfile(difficulty = 3, bot = null) {
    const prof = {
      ...NEUTRAL_PROFILE,
      prefer: { ...NEUTRAL_PROFILE.prefer }
    };

    if (difficulty === 1) {
      prof.depth = 1;
      prof.quiescence = false;
      prof.blunderRate = 0.42;
      prof.timeLimit = 220;
      prof.bookChance = 0.35;
      prof.intuition = 0.5;
    } else if (difficulty === 2) {
      prof.depth = 2;
      prof.blunderRate = 0.1;
      prof.timeLimit = 500;
    } else if (difficulty === 3) {
      prof.depth = 3;
      prof.blunderRate = 0.035;
      prof.timeLimit = 800;
    } else {
      prof.depth = 3;
      prof.quiescence = true;
      prof.blunderRate = 0.012;
      prof.timeLimit = 1200;
    }

    if (bot && bot.profile) {
      Object.assign(prof, bot.profile);
      prof.prefer = { ...prof.prefer, ...(bot.profile.prefer || {}) };
    }

    return prof;
  }

  /* ------------------------------------------------------------------ */
  /*  Оценка позиции                                                     */
  /* ------------------------------------------------------------------ */

  pieceValue(type, prof) {
    const base = this.pieceValues[type] || 0;
    const mult = (prof && prof.prefer && prof.prefer[type]) || 1;
    return base * mult;
  }

  evaluateBoard(prof = null) {
    const p = prof || NEUTRAL_PROFILE;
    const pstWeight = 0.4 + 1.2 * p.positional;
    const aggr = (p.aggression - 0.5) * 2;      // -1..1
    const def = (p.defense - 0.5) * 2;          // -1..1
    const endg = (p.endgame - 0.5) * 2;         // -1..1

    let score = 0;
    let nonPawnMaterial = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.engine.board[r][c];
        if (!piece) continue;

        const val = this.pieceValue(piece.type, p);
        let posVal = 0;

        // Position square table
        const tableR = piece.color === 'w' ? r : 7 - r;
        const tableC = piece.color === 'w' ? c : 7 - c;

        switch (piece.type) {
          case 'p':
            posVal = this.pawnTable[tableR][tableC];
            break;
          case 'n':
            posVal = this.knightTable[tableR][tableC];
            nonPawnMaterial += val;
            break;
          case 'b':
            posVal = this.bishopTable[tableR][tableC];
            nonPawnMaterial += val;
            break;
          case 'r':
            posVal = this.rookTable[tableR][tableC];
            nonPawnMaterial += val;
            break;
          case 'q':
            posVal = this.queenTable[tableR][tableC];
            nonPawnMaterial += val;
            break;
          case 'k':
            // Interpolate between middle and endgame king tables
            posVal = nonPawnMaterial > 2000
              ? this.kingMiddleTable[tableR][tableC]
              : this.kingEndTable[tableR][tableC];
            break;
        }

        const total = val + posVal * pstWeight;
        score += piece.color === 'w' ? total : -total;
      }
    }

    /* --- Тактические модификаторы стиля (дорого, только для профилей) --- */
    if (aggr !== 0 || def !== 0) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = this.engine.board[r][c];
          if (!piece) continue;
          const val = this.pieceValue(piece.type, p);
          if (val < 300 || piece.type === 'k') continue; // только фигуры, не король

          const opp = piece.color === 'w' ? 'b' : 'w';
          const sign = piece.color === 'w' ? 1 : -1;

          if (def !== 0 && this.engine.isSquareAttacked(r, c, opp)) {
            // Наша фигура под ударом — штраф защитнику
            score -= sign * def * (val / 100) * 8;
          }
          if (aggr !== 0 && this.engine.isSquareAttacked(r, c, piece.color)) {
            // Мы атакуем вражескую фигуру — бонус агрессору
            score += sign * aggr * (val / 100) * 4;
          }
        }
      }
    }

    /* --- Эндгейм: проходные пешки и продвижение --- */
    if (endg !== 0) {
      const endFactor = nonPawnMaterial < 3200 ? 1 : 0.25;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = this.engine.board[r][c];
          if (!piece || piece.type !== 'p') continue;

          const dir = piece.color === 'w' ? -1 : 1;
          const startRow = piece.color === 'w' ? 6 : 1;
          let passed = true;
          for (let rr = r + dir; rr >= 0 && rr <= 7; rr += dir) {
            const other = this.engine.board[rr][c];
            if (other && other.type === 'p' && other.color !== piece.color) {
              passed = false;
              break;
            }
          }
          if (!passed) continue;

          const advanced = piece.color === 'w' ? startRow - r : r - startRow;
          const sign = piece.color === 'w' ? 1 : -1;
          score += sign * endg * endFactor * (10 + advanced * 9);
        }
      }
    }

    /* --- Развитие: мягкий стимул выводить фигуры в дебюте --- */
    const devWeight = (nonPawnMaterial > 4200 ? 1 : Math.max(0, (nonPawnMaterial - 2800) / 1400)) * (0.5 + p.opening);
    if (devWeight > 0) {
      const minorHome = {
        w: [[7, 1], [7, 6], [7, 2], [7, 5]],
        b: [[0, 1], [0, 6], [0, 2], [0, 5]]
      };

      for (const color of ['w', 'b']) {
        const sign = color === 'w' ? 1 : -1;
        let undeveloped = 0;

        for (const [r, c] of minorHome[color]) {
          const pc = this.engine.board[r][c];
          if (pc && pc.color === color && (pc.type === 'n' || pc.type === 'b')) undeveloped++;
        }

        if (undeveloped) score -= sign * undeveloped * 9 * devWeight;

        // Король укрыт после рокировки
        const homeKing = this.engine.board[color === 'w' ? 7 : 0];
        const castled = (homeKing[6] && homeKing[6].type === 'k' && homeKing[6].color === color) ||
                        (homeKing[2] && homeKing[2].type === 'k' && homeKing[2].color === color);
        if (castled) score += sign * 16 * devWeight;

        // Ранний выход ферзя без развития
        const qHome = this.engine.board[color === 'w' ? 7 : 0][3];
        const queenLeftHome = !(qHome && qHome.type === 'q' && qHome.color === color);
        if (queenLeftHome && undeveloped >= 2) score -= sign * 14 * devWeight;
      }
    }

    return score;
  }

  orderMoves(moves, prof = null) {
    const p = prof || NEUTRAL_PROFILE;
    const aggr = (p.aggression - 0.5) * 2;
    const risk = (p.risk - 0.5) * 2;

    const scoreOf = (mv) => {
      let s = 0;
      const attacker = this.engine.board[mv.from.r][mv.from.c];
      const target = this.engine.board[mv.to.r][mv.to.c];

      if (target) {
        // MVV - LVA (Most Valuable Victim - Least Valuable Attacker)
        s += 10 * this.pieceValue(target.type, p) - this.pieceValue(attacker.type, p);
        if (aggr !== 0) s += aggr * this.pieceValue(target.type, p) / 100 * 2;
      }
      if (mv.promotion) s += 800;
      if (mv.isEnPassant) s += 250;
      if (risk !== 0 && target && this.pieceValue(target.type, p) > this.pieceValue(attacker.type, p) * 2) {
        s += risk * 120; // любитель риска — хочет видеть жертву первой
      }
      return s;
    };

    return moves.slice().sort((a, b) => scoreOf(b) - scoreOf(a));
  }

  /* ------------------------------------------------------------------ */
  /*  Поиск                                                              */
  /* ------------------------------------------------------------------ */

  // Quiescence search for quiet positions (avoids horizon effect)
  quiescence(alpha, beta, isMaximizing, qDepth = 3, prof = null) {
    this.nodes++;
    if ((this.nodes & 255) === 0 && Date.now() > this.nodeDeadline) {
      this.aborted = true;
      return this.evaluateBoard(prof);
    }

    const inCheck = this.engine.inCheck(this.engine.turn);
    const legal = this.engine.getAllLegalMoves();

    // Мата/пата нет ходов — конец партии
    if (legal.length === 0) {
      if (inCheck) return this.engine.turn === 'w' ? -50000 : 50000;
      return 0;
    }

    // Слишком глубоко в форсировании — возвращаем оценку
    if (qDepth < -4) return this.evaluateBoard(prof);

    let standPat = null;
    if (!inCheck) {
      standPat = this.evaluateBoard(prof);
      if (qDepth === 0) return standPat;

      if (isMaximizing) {
        if (standPat >= beta) return standPat;
        if (standPat > alpha) alpha = standPat;
      } else {
        if (standPat <= alpha) return standPat;
        if (standPat < beta) beta = standPat;
      }
    }

    // В шахе — все ответы, иначе только взятия и превращения
    const moves = this.orderMoves(legal.filter(m => {
      return inCheck || this.engine.board[m.to.r][m.to.c] !== null || m.isEnPassant || m.promotion;
    }), prof);

    if (isMaximizing) {
      let best = inCheck ? -Infinity : standPat;
      for (const move of moves) {
        this.engine.makeMoveInternal(move);
        const score = this.quiescence(alpha, beta, false, qDepth - 1, prof);
        this.engine.unmakeMoveInternal();
        if (this.aborted) return score;

        if (score >= beta) return score;
        if (score > alpha) alpha = score;
        if (score > best) best = score;
      }
      return best;
    } else {
      let best = inCheck ? Infinity : standPat;
      for (const move of moves) {
        this.engine.makeMoveInternal(move);
        const score = this.quiescence(alpha, beta, true, qDepth - 1, prof);
        this.engine.unmakeMoveInternal();
        if (this.aborted) return score;

        if (score <= alpha) return score;
        if (score < beta) beta = score;
        if (score < best) best = score;
      }
      return best;
    }
  }

  minimax(depth, alpha, beta, isMaximizing, useQuiescence = false, prof = null) {
    this.nodes++;
    // Жёсткий лимит времени: прерываем поиск и возвращаем статическую оценку
    if (depth > 0 && (this.nodes & 511) === 0 && Date.now() > this.nodeDeadline) {
      this.aborted = true;
      return this.evaluateBoard(prof);
    }

    if (depth === 0) {
      if (useQuiescence) return this.quiescence(alpha, beta, isMaximizing, 2, prof);

      // На листьях проверяем только мат (дешево: лишь когда шах)
      if (this.engine.inCheck(this.engine.turn)) {
        if (this.engine.getAllLegalMoves().length === 0) {
          return this.engine.turn === 'w' ? -50000 : 50000;
        }
      }
      return this.evaluateBoard(prof);
    }

    const moves = this.engine.getAllLegalMoves();

    if (moves.length === 0) {
      // Мат или пат
      if (this.engine.inCheck(this.engine.turn)) {
        return this.engine.turn === 'w' ? -50000 + depth : 50000 - depth;
      }
      return 0;
    }

    const ordered = this.orderMoves(moves, prof);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of ordered) {
        this.engine.makeMoveInternal(move);
        const evaluation = this.minimax(depth - 1, alpha, beta, false, useQuiescence, prof);
        this.engine.unmakeMoveInternal();
        if (this.aborted) return evaluation;

        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of ordered) {
        this.engine.makeMoveInternal(move);
        const evaluation = this.minimax(depth - 1, alpha, beta, true, useQuiescence, prof);
        this.engine.unmakeMoveInternal();
        if (this.aborted) return evaluation;

        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  /* --------- Асинхронные версии поиска (не блокируют интерфейс) -------- */

  /**
   * Отдать управление браузеру, если текущий «кусок» работы длится дольше
   * sliceMs. Проверяется редко (раз в ~512 узлов), поэтому на скорость
   * поиска почти не влияет.
   */
  async cooperate() {
    if (Date.now() > this.deadline) {
      this.aborted = true;
      return;
    }
    if (Date.now() - this.sliceStart >= this.sliceMs) {
      this.sliceStart = Date.now();
      await this.yieldUI();
      if (Date.now() > this.deadline) this.aborted = true;
    }
  }

  async quiescenceAsync(alpha, beta, isMaximizing, qDepth = 3, prof = null) {
    this.nodes++;
    if ((this.nodes & 63) === 0) await this.cooperate();
    if (this.aborted) return this.evaluateBoard(prof);

    const inCheck = this.engine.inCheck(this.engine.turn);
    const legal = this.engine.getAllLegalMoves();

    if (legal.length === 0) {
      if (inCheck) return this.engine.turn === 'w' ? -50000 : 50000;
      return 0;
    }

    if (qDepth < -4) return this.evaluateBoard(prof);

    let standPat = null;
    if (!inCheck) {
      standPat = this.evaluateBoard(prof);
      if (qDepth === 0) return standPat;

      if (isMaximizing) {
        if (standPat >= beta) return standPat;
        if (standPat > alpha) alpha = standPat;
      } else {
        if (standPat <= alpha) return standPat;
        if (standPat < beta) beta = standPat;
      }
    }

    const moves = this.orderMoves(legal.filter(m => {
      return inCheck || this.engine.board[m.to.r][m.to.c] !== null || m.isEnPassant || m.promotion;
    }), prof);

    if (isMaximizing) {
      let best = inCheck ? -Infinity : standPat;
      for (const move of moves) {
        this.engine.makeMoveInternal(move);
        const score = await this.quiescenceAsync(alpha, beta, false, qDepth - 1, prof);
        this.engine.unmakeMoveInternal();
        if (this.aborted) return score;

        if (score >= beta) return score;
        if (score > alpha) alpha = score;
        if (score > best) best = score;
      }
      return best;
    } else {
      let best = inCheck ? Infinity : standPat;
      for (const move of moves) {
        this.engine.makeMoveInternal(move);
        const score = await this.quiescenceAsync(alpha, beta, true, qDepth - 1, prof);
        this.engine.unmakeMoveInternal();
        if (this.aborted) return score;

        if (score <= alpha) return score;
        if (score < beta) beta = score;
        if (score < best) best = score;
      }
      return best;
    }
  }

  async minimaxAsync(depth, alpha, beta, isMaximizing, useQuiescence = false, prof = null) {
    this.nodes++;
    if ((this.nodes & 63) === 0) await this.cooperate();
    if (this.aborted) return this.evaluateBoard(prof);

    if (depth === 0) {
      if (useQuiescence) return this.quiescenceAsync(alpha, beta, isMaximizing, 2, prof);

      if (this.engine.inCheck(this.engine.turn)) {
        if (this.engine.getAllLegalMoves().length === 0) {
          return this.engine.turn === 'w' ? -50000 : 50000;
        }
      }
      return this.evaluateBoard(prof);
    }

    const moves = this.engine.getAllLegalMoves();

    if (moves.length === 0) {
      if (this.engine.inCheck(this.engine.turn)) {
        return this.engine.turn === 'w' ? -50000 + depth : 50000 - depth;
      }
      return 0;
    }

    const ordered = this.orderMoves(moves, prof);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of ordered) {
        this.engine.makeMoveInternal(move);
        const evaluation = await this.minimaxAsync(depth - 1, alpha, beta, false, useQuiescence, prof);
        this.engine.unmakeMoveInternal();
        if (this.aborted) return evaluation;

        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of ordered) {
        this.engine.makeMoveInternal(move);
        const evaluation = await this.minimaxAsync(depth - 1, alpha, beta, true, useQuiescence, prof);
        this.engine.unmakeMoveInternal();
        if (this.aborted) return evaluation;

        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  /** Корневой поиск с альфа-бета. Оценки — всегда от белых. */
  searchRoot(depth, prof) {
    const isWhite = this.engine.turn === 'w';
    const moves = this.orderMoves(this.engine.getAllLegalMoves(), prof);
    const scored = [];

    let bestMove = null;
    let bestScore = isWhite ? -Infinity : Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    let cut = false;

    for (const move of moves) {
      if (Date.now() > this.deadline) break;
      this.nodeDeadline = this.deadline;
      this.aborted = false;
      this.engine.makeMoveInternal(move);
      const score = this.minimax(depth - 1, alpha, beta, !isWhite, prof.quiescence, prof);
      this.engine.unmakeMoveInternal();
      if (this.aborted) cut = true;

      scored.push({ move, score });

      if (isWhite) {
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
        alpha = Math.max(alpha, score);
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMove = move;
        }
        beta = Math.min(beta, score);
      }
    }

    return { move: bestMove, score: bestScore, scored, cut };
  }

  /**
   * Отдать управление интерфейсу, не блокируя главный поток.
   * MessageChannel не подпадает под ограничение setTimeout (4 мс / 1 с в фоновой
   * вкладке), поэтому доска не «замирает» даже пока бот думает.
   */
  yieldUI() {
    return new Promise(resolve => {
      if (typeof MessageChannel === 'function') {
        const ch = new MessageChannel();
        ch.port1.onmessage = () => resolve();
        ch.port2.postMessage(0);
      } else if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  /** Корневой поиск, который не блокирует интерфейс */
  async searchRootAsync(depth, prof, prevScored = null) {
    const isWhite = this.engine.turn === 'w';
    let moves = this.orderMoves(this.engine.getAllLegalMoves(), prof);

    // Ходы, хорошо показавшие себя на предыдущей глубине, пробуем первыми
    if (prevScored && prevScored.length) {
      const rank = new Map();
      prevScored.forEach(s => rank.set(moveToKey(s.move), s.score));
      const unknown = isWhite ? -1e9 : 1e9;
      moves = moves.slice().sort((a, b) => {
        const sa = rank.has(moveToKey(a)) ? rank.get(moveToKey(a)) : unknown;
        const sb = rank.has(moveToKey(b)) ? rank.get(moveToKey(b)) : unknown;
        return isWhite ? sb - sa : sa - sb;
      });
    }

    const scored = [];
    let bestMove = null;
    let bestScore = isWhite ? -Infinity : Infinity;
    let alpha = -Infinity;
    let beta = Infinity;
    let cut = false;

    for (const move of moves) {
      if (this.aborted) { cut = true; break; }

      this.engine.makeMoveInternal(move);
      const score = await this.minimaxAsync(depth - 1, alpha, beta, !isWhite, prof.quiescence, prof);
      this.engine.unmakeMoveInternal();

      // Прерванный расчёт — глубина недостоверна, результат отбрасываем
      if (this.aborted) { cut = true; break; }

      scored.push({ move, score });

      if (isWhite) {
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
        alpha = Math.max(alpha, score);
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMove = move;
        }
        beta = Math.min(beta, score);
      }

      if (Date.now() - this.sliceStart >= this.sliceMs) {
        this.sliceStart = Date.now();
        await this.yieldUI();
      }
    }

    return { move: bestMove, score: bestScore, scored, cut };
  }

  /* ------------------------------------------------------------------ */
  /*  Дебютная база                                                      */
  /* ------------------------------------------------------------------ */

  getBookMove() {
    if (!this.gameLine.length && Math.random() < 0.5) return null;

    const candidates = [];
    for (const line of OPENING_BOOK) {
      if (this.gameLine.length >= line.moves.length) continue;
      // Совпадение префикса
      let matches = true;
      for (let i = 0; i < this.gameLine.length; i++) {
        if (line.moves[i] !== this.gameLine[i]) { matches = false; break; }
      }
      if (!matches) continue;

      const nextIndex = this.gameLine.length;
      const moverIsWhite = nextIndex % 2 === 0;
      if ((this.engine.turn === 'w') !== moverIsWhite) continue;

      candidates.push({ line, key: line.moves[nextIndex] });
    }

    if (!candidates.length) return null;

    // Небольшая случайность — чтобы партии не были одинаковыми
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    const legal = this.engine.getAllLegalMoves();
    for (const move of legal) {
      if (moveToKey(move) === picked.key) return move;
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  Выбор хода                                                         */
  /* ------------------------------------------------------------------ */

  /** Ход из дебютной базы (если подходит и хватает вероятности) */
  tryOpeningBook(prof) {
    if (Math.random() >= prof.bookChance) return null;
    return this.getBookMove();
  }

  /** Финальный выбор: лучший ход + человеческие ошибки + интуиция */
  pickMove(scored, best, isWhite, prof) {
    // Ранжирование «от лучшего к худшему» с точки зрения ходящего
    const sign = isWhite ? 1 : -1;
    const ranked = scored.slice().sort((a, b) => sign * b.score - sign * a.score);
    const bestScore = ranked.length ? ranked[0].score : 0;

    // Найден форсированный мат — «человеческие ошибки» отключаем
    const mateFound = Math.abs(bestScore) >= 40000;

    // Человеческие ошибки (промахи), но не «выбросить ферзя» и не мат
    if (!mateFound && ranked.length > 2 && Math.random() < prof.blunderRate) {
      const pool = ranked.slice(1, Math.min(4, ranked.length));
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const loss = pick ? sign * bestScore - sign * pick.score : 0;
      if (pick && loss <= 900) return pick.move;
    }

    // Интуиция: иногда выбирает эффектный ход из топ-5
    if (!mateFound && prof.intuition > 0 && Math.random() < prof.intuition * 0.35) {
      const flashy = ranked.slice(0, 5).filter(s2 => {
        if (Math.abs(s2.score - bestScore) > 60) return false;
        const target = this.engine.board[s2.move.to.r][s2.move.to.c];
        return target || s2.move.promotion;
      });
      if (flashy.length) {
        const pick = flashy[Math.floor(Math.random() * flashy.length)];
        return pick.move;
      }
    }

    return best;
  }

  getBestMove(difficulty = 3, bot = null) {
    const prof = this.buildProfile(difficulty, bot);
    const legalMoves = this.engine.getAllLegalMoves();
    if (legalMoves.length === 0) return null;

    const isWhite = this.engine.turn === 'w';

    // 1) Дебутная база
    const bookMove = this.tryOpeningBook(prof);
    if (bookMove) return bookMove;

    // 2) Уровень 1 без бота — классическое «играет почти случайно»
    if (difficulty === 1 && !bot && Math.random() < 0.45) {
      return legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }

    // 3) Итеративное углубление с лимитом времени
    this.nodes = 0;
    this.deadline = Date.now() + prof.timeLimit;
    const start = Date.now();
    let best = null;
    let scored = [];

    for (let d = 1; d <= prof.depth; d++) {
      const res = this.searchRoot(d, prof);
      // У прерванной глубины берём только полностью посчитанные корневые ходы
      if (res && res.move && (res.scored.length || !res.cut)) {
        best = res.move;
        scored = res.scored;
      }
      if (res && res.cut) break;
      if (Date.now() - start > prof.timeLimit) break;
    }

    if (!best) return legalMoves[0];
    return this.pickMove(scored, best, isWhite, prof);
  }

  /**
   * Тот же выбор хода, но поиск идёт асинхронно и не блокирует
   * интерфейс браузера (доска не «замирает»).
   */
  async getBestMoveAsync(difficulty = 3, bot = null) {
    const prof = this.buildProfile(difficulty, bot);
    const legalMoves = this.engine.getAllLegalMoves();
    if (legalMoves.length === 0) return null;

    const isWhite = this.engine.turn === 'w';

    const bookMove = this.tryOpeningBook(prof);
    if (bookMove) return bookMove;

    if (difficulty === 1 && !bot && Math.random() < 0.45) {
      return legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }

    this.nodes = 0;
    this.aborted = false;
    this.deadline = Date.now() + prof.timeLimit;
    this.sliceStart = Date.now();
    const start = Date.now();
    let best = null;
    let scored = [];

    for (let d = 1; d <= prof.depth; d++) {
      const res = await this.searchRootAsync(d, prof, scored.length ? scored : null);
      // У прерванной глубины берём только полностью посчитанные корневые ходы
      if (res && res.move && (res.scored.length || !res.cut)) {
        best = res.move;
        scored = res.scored;
      }
      if ((res && res.cut) || Date.now() >= this.deadline) break;
      if (Date.now() - start > prof.timeLimit) break;
      await this.yieldUI();
    }

    if (!best) return legalMoves[0];
    return this.pickMove(scored, best, isWhite, prof);
  }

  /** Рекомендованная пауза «раздумья» бота (мс) */
  getThinkTime(bot) {
    if (!bot || !bot.profile) return 350;
    const min = bot.profile.thinkMin || 300;
    const max = bot.profile.thinkMax || 900;
    return min + Math.random() * Math.max(0, max - min);
  }

  /* ------------------------------------------------------------------ */
  /*  Анализ позиции (для разбора матча)                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Разбор позиции: оценивает каждый корневой ход (с лучшим ответом
   * соперника) и возвращает отсортированный список.
   * Оценки — от белых (больше = лучше белым).
   */
  analyzePosition(prof = null, timeLimit = 500) {
    const p = prof || NEUTRAL_PROFILE;
    const legalMoves = this.engine.getAllLegalMoves();
    const isWhite = this.engine.turn === 'w';
    const scored = [];

    this.nodes = 0;
    this.deadline = Date.now() + timeLimit;
    this.nodeDeadline = this.deadline;

    for (const move of legalMoves) {
      this.engine.makeMoveInternal(move);
      this.aborted = false;
      const score = this.minimax(1, -Infinity, Infinity, !isWhite, false, p);
      this.engine.unmakeMoveInternal();
      scored.push({ move, score });
    }

    scored.sort((a, b) => b.score - a.score);

    const best = scored.length
      ? (isWhite ? scored[0] : scored[scored.length - 1])
      : null;

    return { scored, best, isWhite, turn: this.engine.turn };
  }
}
