// Complete Professional Chess Rules Engine
class ChessEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = this.createInitialBoard();
    this.turn = 'w'; // 'w' or 'b'
    this.castling = {
      w: { k: true, q: true },
      b: { k: true, q: true }
    };
    this.enPassant = null; // { r, c }
    this.halfmoveClock = 0;
    this.fullmoveNumber = 1;
    this.history = []; // Array of move details
    this.positionCounts = new Map();
    this.recordPosition();
  }

  createInitialBoard() {
    // 8x8 matrix, row 0 = rank 8 (Black side), row 7 = rank 1 (White side)
    const board = Array(8).fill(null).map(() => Array(8).fill(null));

    const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    for (let c = 0; c < 8; c++) {
      board[0][c] = { type: backRank[c], color: 'b' };
      board[1][c] = { type: 'p', color: 'b' };
      board[6][c] = { type: 'p', color: 'w' };
      board[7][c] = { type: backRank[c], color: 'w' };
    }
    return board;
  }

  getPiece(r, c) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return this.board[r][c];
  }

  findKing(color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.type === 'k' && p.color === color) {
          return { r, c };
        }
      }
    }
    return null;
  }

  isSquareAttacked(r, c, byColor) {
    // 1. Pawn attacks
    const pawnRow = byColor === 'w' ? r + 1 : r - 1;
    if (pawnRow >= 0 && pawnRow <= 7) {
      if (c - 1 >= 0) {
        const p = this.board[pawnRow][c - 1];
        if (p && p.color === byColor && p.type === 'p') return true;
      }
      if (c + 1 <= 7) {
        const p = this.board[pawnRow][c + 1];
        if (p && p.color === byColor && p.type === 'p') return true;
      }
    }

    // 2. Knight attacks
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightOffsets) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
        const p = this.board[nr][nc];
        if (p && p.color === byColor && p.type === 'n') return true;
      }
    }

    // 3. King attacks (adjacent squares)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
          const p = this.board[nr][nc];
          if (p && p.color === byColor && p.type === 'k') return true;
        }
      }
    }

    // 4. Straight slider attacks (Rook & Queen)
    const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of straightDirs) {
      let nr = r + dr, nc = c + dc;
      while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
        const p = this.board[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }

    // 5. Diagonal slider attacks (Bishop & Queen)
    const diagonalDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of diagonalDirs) {
      let nr = r + dr, nc = c + dc;
      while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
        const p = this.board[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }

    return false;
  }

  inCheck(color) {
    const king = this.findKing(color);
    if (!king) return false;
    const opponent = color === 'w' ? 'b' : 'w';
    return this.isSquareAttacked(king.r, king.c, opponent);
  }

  // Generates pseudo-legal moves for a specific square
  getPseudoMoves(r, c) {
    const piece = this.board[r][c];
    if (!piece || piece.color !== this.turn) return [];

    const moves = [];
    const color = piece.color;
    const opp = color === 'w' ? 'b' : 'w';

    switch (piece.type) {
      case 'p': {
        const fwd = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;
        const promoRow = color === 'w' ? 0 : 7;

        // One step forward
        if (this.board[r + fwd] && !this.board[r + fwd][c]) {
          if (r + fwd === promoRow) {
            ['q', 'r', 'b', 'n'].forEach(promo => {
              moves.push({ from: { r, c }, to: { r: r + fwd, c }, promotion: promo });
            });
          } else {
            moves.push({ from: { r, c }, to: { r: r + fwd, c } });
            // Two steps forward
            if (r === startRow && !this.board[r + 2 * fwd][c]) {
              moves.push({ from: { r, c }, to: { r: r + 2 * fwd, c } });
            }
          }
        }

        // Diagonal captures
        for (const dc of [-1, 1]) {
          const targetC = c + dc;
          const targetR = r + fwd;
          if (targetC >= 0 && targetC <= 7 && targetR >= 0 && targetR <= 7) {
            const target = this.board[targetR][targetC];
            if (target && target.color === opp) {
              if (targetR === promoRow) {
                ['q', 'r', 'b', 'n'].forEach(promo => {
                  moves.push({ from: { r, c }, to: { r: targetR, c: targetC }, promotion: promo });
                });
              } else {
                moves.push({ from: { r, c }, to: { r: targetR, c: targetC } });
              }
            } else if (this.enPassant && this.enPassant.r === targetR && this.enPassant.c === targetC) {
              moves.push({ from: { r, c }, to: { r: targetR, c: targetC }, isEnPassant: true });
            }
          }
        }
        break;
      }

      case 'n': {
        const jumps = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of jumps) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
            const target = this.board[nr][nc];
            if (!target || target.color === opp) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc } });
            }
          }
        }
        break;
      }

      case 'b':
      case 'r':
      case 'q': {
        const dirs = [];
        if (piece.type === 'b' || piece.type === 'q') {
          dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        }
        if (piece.type === 'r' || piece.type === 'q') {
          dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        }
        for (const [dr, dc] of dirs) {
          let nr = r + dr, nc = c + dc;
          while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
            const target = this.board[nr][nc];
            if (!target) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc } });
            } else {
              if (target.color === opp) {
                moves.push({ from: { r, c }, to: { r: nr, c: nc } });
              }
              break;
            }
            nr += dr;
            nc += dc;
          }
        }
        break;
      }

      case 'k': {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
              const target = this.board[nr][nc];
              if (!target || target.color === opp) {
                moves.push({ from: { r, c }, to: { r: nr, c: nc } });
              }
            }
          }
        }

        // Castling moves
        const rank = color === 'w' ? 7 : 0;
        if (r === rank && c === 4 && !this.inCheck(color)) {
          // Kingside
          if (this.castling[color].k &&
              !this.board[rank][5] && !this.board[rank][6] &&
              this.board[rank][7] && this.board[rank][7].type === 'r' && this.board[rank][7].color === color) {
            if (!this.isSquareAttacked(rank, 5, opp) && !this.isSquareAttacked(rank, 6, opp)) {
              moves.push({ from: { r, c }, to: { r: rank, c: 6 }, isCastling: 'k' });
            }
          }
          // Queenside
          if (this.castling[color].q &&
              !this.board[rank][3] && !this.board[rank][2] && !this.board[rank][1] &&
              this.board[rank][0] && this.board[rank][0].type === 'r' && this.board[rank][0].color === color) {
            if (!this.isSquareAttacked(rank, 3, opp) && !this.isSquareAttacked(rank, 2, opp)) {
              moves.push({ from: { r, c }, to: { r: rank, c: 2 }, isCastling: 'q' });
            }
          }
        }
        break;
      }
    }

    return moves;
  }

  // Get all strictly legal moves for the active color
  getAllLegalMoves() {
    const legalMoves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] && this.board[r][c].color === this.turn) {
          const pseudo = this.getPseudoMoves(r, c);
          for (const m of pseudo) {
            if (this.isLegalMove(m)) {
              legalMoves.push(m);
            }
          }
        }
      }
    }
    return legalMoves;
  }

  getLegalMovesForSquare(r, c) {
    const piece = this.board[r][c];
    if (!piece || piece.color !== this.turn) return [];
    return this.getPseudoMoves(r, c).filter(m => this.isLegalMove(m));
  }

  isLegalMove(move) {
    this.makeMoveInternal(move);
    const inCheckAfter = this.inCheck(this.turn === 'w' ? 'b' : 'w');
    this.unmakeMoveInternal();
    return !inCheckAfter;
  }

  makeMoveInternal(move) {
    const piece = this.board[move.from.r][move.from.c];
    const captured = this.board[move.to.r][move.to.c];

    const state = {
      move,
      piece: { ...piece },
      captured: captured ? { ...captured } : null,
      castling: {
        w: { ...this.castling.w },
        b: { ...this.castling.b }
      },
      enPassant: this.enPassant ? { ...this.enPassant } : null,
      halfmoveClock: this.halfmoveClock,
      fullmoveNumber: this.fullmoveNumber
    };

    // Move piece
    this.board[move.to.r][move.to.c] = piece;
    this.board[move.from.r][move.from.c] = null;

    // Handle en passant capture
    if (move.isEnPassant) {
      const epCapturedR = piece.color === 'w' ? move.to.r + 1 : move.to.r - 1;
      state.epCaptured = this.board[epCapturedR][move.to.c];
      this.board[epCapturedR][move.to.c] = null;
    }

    // Handle promotion
    if (move.promotion) {
      this.board[move.to.r][move.to.c] = { type: move.promotion, color: piece.color };
    }

    // Handle castling rook movement
    if (move.isCastling === 'k') {
      const rookFromC = 7, rookToC = 5;
      this.board[move.to.r][rookToC] = this.board[move.to.r][rookFromC];
      this.board[move.to.r][rookFromC] = null;
    } else if (move.isCastling === 'q') {
      const rookFromC = 0, rookToC = 3;
      this.board[move.to.r][rookToC] = this.board[move.to.r][rookFromC];
      this.board[move.to.r][rookFromC] = null;
    }

    // Update castling rights
    if (piece.type === 'k') {
      this.castling[piece.color].k = false;
      this.castling[piece.color].q = false;
    } else if (piece.type === 'r') {
      if (move.from.r === 7 && move.from.c === 0) this.castling.w.q = false;
      if (move.from.r === 7 && move.from.c === 7) this.castling.w.k = false;
      if (move.from.r === 0 && move.from.c === 0) this.castling.b.q = false;
      if (move.from.r === 0 && move.from.c === 7) this.castling.b.k = false;
    }

    // If opponent rook captured on starting corner
    if (captured && captured.type === 'r') {
      if (move.to.r === 7 && move.to.c === 0) this.castling.w.q = false;
      if (move.to.r === 7 && move.to.c === 7) this.castling.w.k = false;
      if (move.to.r === 0 && move.to.c === 0) this.castling.b.q = false;
      if (move.to.r === 0 && move.to.c === 7) this.castling.b.k = false;
    }

    // Update en passant square
    if (piece.type === 'p' && Math.abs(move.from.r - move.to.r) === 2) {
      this.enPassant = {
        r: (move.from.r + move.to.r) / 2,
        c: move.from.c
      };
    } else {
      this.enPassant = null;
    }

    // Update clocks
    if (piece.type === 'p' || captured || move.isEnPassant) {
      this.halfmoveClock = 0;
    } else {
      this.halfmoveClock++;
    }

    if (this.turn === 'b') {
      this.fullmoveNumber++;
    }
    this.turn = this.turn === 'w' ? 'b' : 'w';

    this.history.push(state);
  }

  unmakeMoveInternal() {
    if (this.history.length === 0) return;
    const state = this.history.pop();
    const move = state.move;
    const piece = state.piece;

    this.turn = piece.color;
    this.board[move.from.r][move.from.c] = piece;
    this.board[move.to.r][move.to.c] = state.captured;

    if (move.isEnPassant) {
      const epCapturedR = piece.color === 'w' ? move.to.r + 1 : move.to.r - 1;
      this.board[epCapturedR][move.to.c] = state.epCaptured;
    }

    if (move.isCastling === 'k') {
      const rookFromC = 7, rookToC = 5;
      this.board[move.to.r][rookFromC] = this.board[move.to.r][rookToC];
      this.board[move.to.r][rookToC] = null;
    } else if (move.isCastling === 'q') {
      const rookFromC = 0, rookToC = 3;
      this.board[move.to.r][rookFromC] = this.board[move.to.r][rookToC];
      this.board[move.to.r][rookToC] = null;
    }

    this.castling = state.castling;
    this.enPassant = state.enPassant;
    this.halfmoveClock = state.halfmoveClock;
    this.fullmoveNumber = state.fullmoveNumber;
  }

  // Public makeMove with SAN generation and position tracking
  makeMove(move) {
    const san = this.generateSAN(move);
    this.makeMoveInternal(move);
    
    // Save SAN in the last history record
    const lastRecord = this.history[this.history.length - 1];
    lastRecord.san = san;
    lastRecord.fen = this.getFEN();

    this.recordPosition();
    return lastRecord;
  }

  undoMove() {
    if (this.history.length === 0) return null;
    const currentFen = this.getFEN().split(' ').slice(0, 4).join(' ');
    const count = this.positionCounts.get(currentFen) || 1;
    if (count <= 1) {
      this.positionCounts.delete(currentFen);
    } else {
      this.positionCounts.set(currentFen, count - 1);
    }
    const popped = this.history[this.history.length - 1];
    this.unmakeMoveInternal();
    return popped;
  }

  recordPosition() {
    const key = this.getFEN().split(' ').slice(0, 4).join(' ');
    const current = this.positionCounts.get(key) || 0;
    this.positionCounts.set(key, current + 1);
  }

  /** Быстрая проверка наличия хотя бы одного легального хода (останавливается на первом) */
  hasLegalMoves() {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] && this.board[r][c].color === this.turn) {
          const pseudo = this.getPseudoMoves(r, c);
          for (const m of pseudo) {
            if (this.isLegalMove(m)) return true;
          }
        }
      }
    }
    return false;
  }

  getGameStatus() {
    const hasMoves = this.hasLegalMoves();
    const checked = this.inCheck(this.turn);

    if (!hasMoves) {
      if (checked) {
        return {
          isGameOver: true,
          result: this.turn === 'w' ? '0-1' : '1-0',
          winner: this.turn === 'w' ? 'b' : 'w',
          reason: 'Мат! Победили ' + (this.turn === 'w' ? 'Чёрные' : 'Белые')
        };
      } else {
        return {
          isGameOver: true,
          result: '1/2-1/2',
          winner: null,
          reason: 'Пат! Ничья'
        };
      }
    }

    // 50-move rule
    if (this.halfmoveClock >= 100) {
      return {
        isGameOver: true,
        result: '1/2-1/2',
        winner: null,
        reason: 'Ничья по правилу 50 ходов'
      };
    }

    // Threefold repetition
    const key = this.getFEN().split(' ').slice(0, 4).join(' ');
    if ((this.positionCounts.get(key) || 0) >= 3) {
      return {
        isGameOver: true,
        result: '1/2-1/2',
        winner: null,
        reason: 'Троекратное повторение позиции (Ничья)'
      };
    }

    // Insufficient material
    if (this.isInsufficientMaterial()) {
      return {
        isGameOver: true,
        result: '1/2-1/2',
        winner: null,
        reason: 'Недостаточность фигур для мата (Ничья)'
      };
    }

    return {
      isGameOver: false,
      inCheck: checked,
      turn: this.turn
    };
  }

  isInsufficientMaterial() {
    const pieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p) pieces.push({ ...p, r, c });
      }
    }

    // King vs King
    if (pieces.length === 2) return true;

    // King + minor vs King
    if (pieces.length === 3) {
      const nonKings = pieces.filter(p => p.type !== 'k');
      if (nonKings.length === 1 && (nonKings[0].type === 'b' || nonKings[0].type === 'n')) {
        return true;
      }
    }

    // King + Bishop vs King + Bishop of same color squares
    if (pieces.length === 4) {
      const bishops = pieces.filter(p => p.type === 'b');
      if (bishops.length === 2 && bishops[0].color !== bishops[1].color) {
        const squareColor1 = (bishops[0].r + bishops[0].c) % 2;
        const squareColor2 = (bishops[1].r + bishops[1].c) % 2;
        if (squareColor1 === squareColor2) return true;
      }
    }

    return false;
  }

  // Generate Standard Algebraic Notation (SAN)
  generateSAN(move) {
    const piece = this.board[move.from.r][move.from.c];
    if (move.isCastling === 'k') return 'O-O';
    if (move.isCastling === 'q') return 'O-O-O';

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    const dest = files[move.to.c] + ranks[move.to.r];

    let san = '';
    const isCapture = this.board[move.to.r][move.to.c] !== null || move.isEnPassant;

    if (piece.type === 'p') {
      if (isCapture) {
        san = files[move.from.c] + 'x' + dest;
      } else {
        san = dest;
      }
      if (move.promotion) {
        san += '=' + move.promotion.toUpperCase();
      }
    } else {
      san = piece.type.toUpperCase();

      // Disambiguation
      const candidates = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (r === move.from.r && c === move.from.c) continue;
          const other = this.board[r][c];
          if (other && other.color === piece.color && other.type === piece.type) {
            const moves = this.getLegalMovesForSquare(r, c);
            if (moves.some(m => m.to.r === move.to.r && m.to.c === move.to.c)) {
              candidates.push({ r, c });
            }
          }
        }
      }

      if (candidates.length > 0) {
        const sameFile = candidates.some(c => c.c === move.from.c);
        const sameRank = candidates.some(c => c.r === move.from.r);
        if (!sameFile) {
          san += files[move.from.c];
        } else if (!sameRank) {
          san += ranks[move.from.r];
        } else {
          san += files[move.from.c] + ranks[move.from.r];
        }
      }

      if (isCapture) san += 'x';
      san += dest;
    }

    // Check / Checkmate indicator
    this.makeMoveInternal(move);
    const opp = piece.color === 'w' ? 'b' : 'w';
    if (this.inCheck(opp)) {
      const legal = this.getAllLegalMoves();
      san += legal.length === 0 ? '#' : '+';
    }
    this.unmakeMoveInternal();

    return san;
  }

  getFEN() {
    let fen = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) {
          empty++;
        } else {
          if (empty > 0) {
            fen += empty;
            empty = 0;
          }
          fen += p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
        }
      }
      if (empty > 0) fen += empty;
      if (r < 7) fen += '/';
    }

    fen += ` ${this.turn} `;

    let castlingStr = '';
    if (this.castling.w.k) castlingStr += 'K';
    if (this.castling.w.q) castlingStr += 'Q';
    if (this.castling.b.k) castlingStr += 'k';
    if (this.castling.b.q) castlingStr += 'q';
    fen += castlingStr || '-';

    if (this.enPassant) {
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
      fen += ` ${files[this.enPassant.c]}${ranks[this.enPassant.r]}`;
    } else {
      fen += ' -';
    }

    fen += ` ${this.halfmoveClock} ${this.fullmoveNumber}`;
    return fen;
  }

  loadFEN(fen) {
    try {
      const parts = fen.trim().split(/\s+/);
      if (parts.length < 4) return false;

      const [placement, turn, castling, ep, half, full] = parts;
      const rows = placement.split('/');
      if (rows.length !== 8) return false;

      const newBoard = Array(8).fill(null).map(() => Array(8).fill(null));
      for (let r = 0; r < 8; r++) {
        let c = 0;
        for (const char of rows[r]) {
          if (char >= '1' && char <= '8') {
            c += parseInt(char, 10);
          } else {
            const isUpper = char === char.toUpperCase();
            newBoard[r][c] = {
              type: char.toLowerCase(),
              color: isUpper ? 'w' : 'b'
            };
            c++;
          }
        }
        if (c !== 8) return false;
      }

      this.board = newBoard;
      this.turn = turn === 'b' ? 'b' : 'w';
      this.castling = {
        w: { k: castling.includes('K'), q: castling.includes('Q') },
        b: { k: castling.includes('k'), q: castling.includes('q') }
      };

      if (ep && ep !== '-') {
        const files = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6, h: 7 };
        const ranks = { '8': 0, '7': 1, '6': 2, '5': 3, '4': 4, '3': 5, '2': 6, '1': 7 };
        this.enPassant = { r: ranks[ep[1]], c: files[ep[0]] };
      } else {
        this.enPassant = null;
      }

      this.halfmoveClock = half ? parseInt(half, 10) : 0;
      this.fullmoveNumber = full ? parseInt(full, 10) : 1;
      this.history = [];
      this.positionCounts = new Map();
      this.recordPosition();
      return true;
    } catch (e) {
      return false;
    }
  }

  getPGN(headers = {}) {
    const defaultHeaders = {
      Event: 'Casual Chess Game',
      Site: 'Local Computer',
      Date: new Date().toISOString().split('T')[0],
      Round: '1',
      White: 'Player 1',
      Black: 'Player 2',
      Result: '*'
    };
    const allHeaders = { ...defaultHeaders, ...headers };

    let pgn = '';
    for (const [key, val] of Object.entries(allHeaders)) {
      pgn += `[${key} "${val}"]\n`;
    }
    pgn += '\n';

    let moveNum = 1;
    for (let i = 0; i < this.history.length; i++) {
      const rec = this.history[i];
      if (rec.piece.color === 'w') {
        pgn += `${moveNum}. ${rec.san} `;
      } else {
        pgn += `${rec.san} `;
        moveNum++;
      }
    }

    const status = this.getGameStatus();
    if (status.isGameOver) {
      pgn += status.result;
    } else {
      pgn += '*';
    }

    return pgn.trim();
  }
}
