/* build: 2026-11-21-mobile-online */
// Chess Game UI & Application Controller

/** Безопасный доступ к localStorage: в части браузеров file:// его запрещает */
function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* хранилище недоступно */ }
}

/** Преобразовать объект хода в UCI ('e2e4', 'e7e8q') — с превращением */
function moveToUci(move) {
  return moveToKey(move) + (move.promotion || '');
}

/** Преобразовать UCI-ход ('e2e4', 'e7e8q') в объект хода движка */
function uciToMove(uci, engine) {
  if (!uci || uci === '(none)') return null;
  const files = 'abcdefgh';
  const fr = 8 - parseInt(uci[1], 10);
  const fc = files.indexOf(uci[0]);
  const tr = 8 - parseInt(uci[3], 10);
  const tc = files.indexOf(uci[2]);
  const promo = uci.length > 4 ? uci[4].toLowerCase() : null;
  if (fr < 0 || fr > 7 || fc < 0 || fc > 7 || tr < 0 || tr > 7 || tc < 0 || tc > 7) return null;
  for (const m of engine.getAllLegalMoves()) {
    if (m.from.r === fr && m.from.c === fc && m.to.r === tr && m.to.c === tc) {
      if (promo) {
        if (m.promotion === promo) return m;
      } else if (!m.promotion) {
        return m;
      }
    }
  }
  return null;
}

class ChessApp {
  constructor() {
    this.engine = new ChessEngine();
    this.ai = new ChessAI(this.engine);
    // Разбор партии через Stockfish (точные оценки), с синхронным фолбэком
    this.analyzer = new GameAnalyzer(async (engine, fen, prof) => {
      return await this.stockfishAnalyzePosition(fen, engine);
    });

    // Отдельный движок для поиска: основной остаётся нетронутым,
    // поэтому таймер и доска не «дёргаются», пока бот думает
    this.searchEngine = new ChessEngine();
    this.searchAI = new ChessAI(this.searchEngine);

    // Stockfish в Web Worker — сильная игра без блокировки интерфейса
    this.stockfish = new StockfishEngine();

    // Онлайн-клиент ( WebSocket )
    this.online = new OnlineClient();
    this.onlineGameId = null;
    this.onlineColor = null;
    this.onlineOpponent = null;
    this.onlineSpectating = false;

    // Configuration & State
    this.gameMode = 'pve'; // 'pve', 'pvp', 'eve'
    this.aiLevel = 3;
    this.playerColor = 'w'; // Color player chose in PvE
    this.isFlipped = false;
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.pendingPromotionMove = null;

    // Bots
    this.botProfile = null; // соперник игрока (режим pve)
    this.whiteBot = null;   // бот за белых (режим eve)
    this.blackBot = null;   // бот за чёрных (режим eve)
    this.participants = {
      w: { name: 'Игрок (Белые)', avatar: 'user' },
      b: { name: 'ИИ (Уровень 3)', avatar: 'robot' }
    };

    // Timers
    this.timeControl = 600; // seconds per player (0 = unlimited)
    this.whiteTime = 600;
    this.blackTime = 600;
    this.timerInterval = null;

    // Drag and Drop
    this.draggedPiece = null;
    this.dragStartSquare = null;
    this.dragGhost = document.getElementById('drag-ghost');

    // Analysis mode
    this.analysisMode = false;
    this.analysisSnapshots = [];
    this.analysisEntries = [];
    this.analysisIndex = 0;
    this.analysisSummary = null;
    this.analysisParticipants = { w: 'Белые', b: 'Чёрные' };

    // Saved games
