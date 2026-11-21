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
    this.savedGames = this.loadSavedGames();

    // Theme
    this.currentTheme = storageGet('chess_theme') || 'wood';

    // DOM Elements
    this.boardEl = document.getElementById('chessboard');
    this.topPlayerBar = document.getElementById('top-player-bar');
    this.bottomPlayerBar = document.getElementById('bottom-player-bar');
    this.topPlayerName = document.getElementById('top-player-name');
    this.bottomPlayerName = document.getElementById('bottom-player-name');
    this.topPlayerAvatar = document.getElementById('top-player-avatar');
    this.bottomPlayerAvatar = document.getElementById('bottom-player-avatar');
    this.topPlayerTimer = document.getElementById('top-player-timer');
    this.bottomPlayerTimer = document.getElementById('bottom-player-timer');
    this.topPlayerCaptures = document.getElementById('top-player-captures');
    this.bottomPlayerCaptures = document.getElementById('bottom-player-captures');
    this.statusIndicator = document.getElementById('game-status-indicator');
    this.moveTableBody = document.getElementById('move-table-body');
    this.historyContainer = document.getElementById('move-history-container');
    this.panelTitle = document.getElementById('panel-title');
    this.analysisSummaryEl = document.getElementById('analysis-summary');
    this.boardOverlay = document.getElementById('board-overlay');

    // Modals
    this.newGameModal = document.getElementById('new-game-modal');
    this.promotionModal = document.getElementById('promotion-modal');
    this.gameOverModal = document.getElementById('game-over-modal');
    this.pgnModal = document.getElementById('pgn-modal');
    this.analysisLoading = document.getElementById('analysis-loading');

    this.init();
  }

  init() {
    hydrateIcons();
    this.setupEventListeners();
    this.setupTheme();
    this.menu = new MainMenu(this);
    this.setupOnline();
    this.renderBoard();
    this.startNewGame({
      mode: 'pve',
      botId: 'volkov',
      side: 'w',
      timeControl: this.settings ? this.settings.defaultTc : 600,
      aiLevel: this.settings ? this.settings.defaultLevel : 3
    });
  }

  /* ------------------------------------------------------------------ */
  /*  События                                                            */
  /* ------------------------------------------------------------------ */

  setupEventListeners() {
    // Header actions
    document.getElementById('header-new-game-btn').addEventListener('click', () => this.openNewGameModal());
    document.getElementById('new-game-btn').addEventListener('click', () => this.openNewGameModal());
    document.getElementById('sound-btn').addEventListener('click', () => this.toggleSound());
    document.getElementById('theme-select').addEventListener('change', (e) => this.setTheme(e.target.value));
    document.getElementById('menu-btn').addEventListener('click', () => this.menu.open());

    // Panel controls
    document.getElementById('undo-btn').addEventListener('click', () => this.handleUndo());
    document.getElementById('hint-btn').addEventListener('click', () => this.handleHint());
    document.getElementById('flip-btn').addEventListener('click', () => this.toggleFlip());
    document.getElementById('pgn-btn').addEventListener('click', () => this.openPgnModal());

    // New Game Modal controls
    document.getElementById('modal-cancel-game-btn').addEventListener('click', () => this.closeModal(this.newGameModal));
    document.getElementById('modal-start-game-btn').addEventListener('click', () => this.applyNewGameSettings());

    // Game Mode selection changes in modal
    const modeSelect = document.getElementById('setting-game-mode');
    const botGroup = document.getElementById('ai-settings-group');
    const sideGroup = document.getElementById('side-settings-group');
    modeSelect.addEventListener('change', () => {
      const isAI = modeSelect.value === 'pve';
      botGroup.style.display = modeSelect.value === 'pvp' ? 'none' : 'flex';
      sideGroup.style.display = isAI ? 'flex' : 'none';
    });

    // Side selection radio cards
    document.querySelectorAll('#setting-side-cards .radio-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('#setting-side-cards .radio-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });

    // Modals close buttons
    document.getElementById('game-over-rematch-btn').addEventListener('click', () => {
      this.closeModal(this.gameOverModal);
      this.openNewGameModal();
    });
    document.getElementById('game-over-close-btn').addEventListener('click', () => {
      this.closeModal(this.gameOverModal);
    });

    // Анализ матча после окончания партии
    document.getElementById('game-over-analyze-btn').addEventListener('click', () => {
      this.closeModal(this.gameOverModal);
      this.analyzeCurrentGame();
    });

    // Навигация в режиме анализа
    document.getElementById('analysis-first-btn').addEventListener('click', () => this.setAnalysisIndex(0));
    document.getElementById('analysis-prev-btn').addEventListener('click', () => this.setAnalysisIndex(this.analysisIndex - 1));
    document.getElementById('analysis-next-btn').addEventListener('click', () => this.setAnalysisIndex(this.analysisIndex + 1));
    document.getElementById('analysis-last-btn').addEventListener('click', () => this.setAnalysisIndex(this.analysisSnapshots.length - 1));
    document.getElementById('analysis-prev-mistake').addEventListener('click', () => this.jumpMistake(-1));
    document.getElementById('analysis-next-mistake').addEventListener('click', () => this.jumpMistake(1));
    const graph = document.getElementById('eval-graph');
    if (graph) graph.addEventListener('click', (e) => this.onGraphClick(e));
    if (this.analysisSummaryEl) this.analysisSummaryEl.addEventListener('click', (e) => {
      const km = e.target.closest('.key-moment');
      if (km) this.setAnalysisIndex(Number(km.dataset.index));
    });
    document.getElementById('analysis-exit-btn').addEventListener('click', () => this.exitAnalysisMode());

    // Стрелки клавиатуры — перемотка разбора
    document.addEventListener('keydown', (e) => {
      if (!this.analysisMode) return;
      if (e.key === 'ArrowLeft') { this.setAnalysisIndex(this.analysisIndex - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { this.setAnalysisIndex(this.analysisIndex + 1); e.preventDefault(); }
      if (e.key === 'Escape') { this.exitAnalysisMode(); }
    });

    // PGN & FEN copy
    document.getElementById('copy-fen-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(document.getElementById('fen-input').value);
      this.showToast('FEN скопирован в буфер обмена!');
    });
    document.getElementById('copy-pgn-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(document.getElementById('pgn-textarea').value);
      this.showToast('PGN скопирован в буфер обмена!');
    });
    document.getElementById('download-pgn-btn').addEventListener('click', () => {
      const pgn = document.getElementById('pgn-textarea').value;
      const blob = new Blob([pgn], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `chess_game_${new Date().toISOString().slice(0, 10)}.pgn`;
      a.click();
      this.showToast('Файл PGN сохранён!');
    });
    // Кнопка «Закрыть» и клик по фону в окне экспорта PGN/FEN
    const closePgn = document.getElementById('close-pgn-modal-btn');
    if (closePgn) closePgn.addEventListener('click', () => this.closeModal(this.pgnModal));
    if (this.pgnModal) this.pgnModal.addEventListener('click', (e) => {
      if (e.target === this.pgnModal) this.closeModal(this.pgnModal);
    });

    // Drag-and-Drop Global Listeners
    document.addEventListener('mousemove', (e) => this.handleDragMove(e));
    document.addEventListener('mouseup', (e) => this.handleDragEnd(e));
    document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
  }

  /* ------------------------------------------------------------------ */
  /*  Онлайн: соединение и игровые события                               */
  /* ------------------------------------------------------------------ */

  setupOnline() {
    const o = this.online;
    o.on('connected', () => {
      if (this.menu) this.menu.updateOnlineConn(true);
      // После переподключения сервер мог аннулировать текущую партию
      if (this.gameMode === 'online' && this.onlineGameId) {
        this.showToast('Соединение восстановлено. Играйте заново.');
        this.leaveOnlineGame();
      }
    });
    o.on('disconnected', () => {
      if (this.menu) this.menu.updateOnlineConn(false);
      if (this.gameMode === 'online') {
        const s = document.getElementById('online-game-status');
        if (s) s.textContent = 'Соединение потеряно — переподключение...';
      }
    });
    o.on('connectionError', (m) => {
      if (this.menu) this.menu.updateOnlineConn(false, m.message);
    });
    o.on('welcome', () => { if (this.menu) this.menu.updateOnlineProfile(); });
    o.on('ratingReset', (m) => {
      this.online.rating = m.rating;
      if (this.menu) this.menu.updateOnlineProfile();
    });
    o.on('lobby', () => { if (this.menu) this.menu.renderOnlineLobby(); });

    o.on('queueState', (m) => { if (this.menu) this.menu.updateOnlineQueue(m.searching); });
    o.on('roomCreated', (m) => { if (this.menu) this.menu.showOnlineRoom(m.code); });
    o.on('challenge', (m) => { if (this.menu) this.menu.showOnlineChallenge(m); });
    o.on('toast', (m) => this.showToast(m.message));
    o.on('error', (m) => this.showToast(m.message || 'Ошибка сервера'));
    o.on('illegal', () => this.showToast('Недопустимый ход'));

    o.on('gameStart', (m) => this.startOnlineGame(m));
    o.on('move', (m) => this.onOnlineMove(m));
    o.on('clock', (m) => this.onOnlineClock(m));
    o.on('gameOver', (m) => this.onOnlineGameOver(m));
    o.on('chat', (m) => this.onOnlineChat(m));
    o.on('spectatorJoined', (m) => this.onOnlineSpectator(m, true));
    o.on('spectatorLeft', (m) => this.onOnlineSpectator(m, false));
    o.on('drawOffer', (m) => {
      if (confirm('Соперник предлагает ничью. Принять?')) this.online.acceptDraw(this.onlineGameId);
    });
    o.on('spectateStart', (m) => this.startOnlineSpectate(m));

    // Кнопки онлайн-панели
    const gsend = document.getElementById('online-game-chat-send');
    if (gsend) gsend.addEventListener('click', () => this.sendOnlineChat(true));
    const ginput = document.getElementById('online-game-chat-text');
    if (ginput) ginput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.sendOnlineChat(true); });

    const resign = document.getElementById('online-resign-btn');
    if (resign) resign.addEventListener('click', () => {
      if (this.onlineGameId && confirm('Сдаться?')) this.online.resign(this.onlineGameId);
    });
    const draw = document.getElementById('online-draw-btn');
    if (draw) draw.addEventListener('click', () => {
      if (this.onlineGameId) this.online.offerDraw(this.onlineGameId);
    });
    const leave = document.getElementById('online-leave-btn');
    if (leave) leave.addEventListener('click', () => this.leaveOnlineGame());

    o.connect();
  }

  leaveOnlineGame() {
    if (this.onlineGameId) this.online.leave(this.onlineGameId);
    this.onlineGameId = null;
    this.onlineColor = null;
    this.onlineSpectating = false;
    this.gameMode = 'pve';
    const panel = document.getElementById('online-game-panel');
    if (panel) panel.style.display = 'none';
    clearInterval(this.timerInterval);
    this.menu.open('online');
  }

  startOnlineGame(m) {
    this.exitAnalysisMode(true);
    clearInterval(this.timerInterval);
    this.engine.reset();
    this.ai.resetGame();
    this.gameToken = (this.gameToken || 0) + 1;

    this.gameMode = 'online';
    this.onlineGameId = m.gameId;
    this.onlineColor = m.color;
    this.onlineOpponent = m.opponent;
    this.onlineSpectating = false;
    this.playerColor = m.color;
    this.timeControl = m.tc || 0;
    this.whiteTime = m.tc || 0;
    this.blackTime = m.tc || 0;
    this.gameSaved = false;
    this.gameOverShown = false;
    this.lastOnlineResult = null;
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.isAIBusy = false;

    const me = { name: this.online.name + ' (Вы)', avatar: 'user' };
    const opp = { name: m.opponent ? m.opponent.name + ' (' + m.opponent.rating + ')' : 'Соперник', avatar: 'user' };
    this.participants = m.color === 'w' ? { w: me, b: opp } : { w: opp, b: me };
    this.isFlipped = (m.color === 'b');
    if (m.fen) this.engine.loadFEN(m.fen);

    if (this.menu && this.menu.isOpen()) this.menu.close();
    this.closeModal(this.gameOverModal);
    this.renderBoard();
    this.renderMoveHistory();
    this.updatePlayerBanners();
    this.updateStatus();
    this.updateOnlineClocks({ w: m.tc * 1000, b: m.tc * 1000 });

    const panel = document.getElementById('online-game-panel');
    if (panel) panel.style.display = 'flex';
    const roomRes = document.getElementById('online-room-result');
    if (roomRes) roomRes.style.display = 'none';
    const matchPanel = document.getElementById('online-match-panel');
    if (matchPanel) matchPanel.style.display = 'none';
    const log = document.getElementById('online-game-chat');
    if (log) log.innerHTML = '';
    const indicator = document.getElementById('game-status-indicator');
    const ratedLabel = (m.rated === false) ? 'Без ЭЛО' : 'С ЭЛО';
    if (indicator) indicator.textContent = 'Онлайн · ' + (m.color === 'w' ? 'Белые' : 'Чёрные') + ' · ' + ratedLabel;
    this.showToast('Партия началась с ' + (m.opponent ? m.opponent.name : 'соперником'));
  }

  startOnlineSpectate(m) {
    this.exitAnalysisMode(true);
    clearInterval(this.timerInterval);
    this.engine.reset();
    this.ai.resetGame();
    this.gameMode = 'online';
    this.onlineGameId = m.gameId;
    this.onlineSpectating = true;
    this.isFlipped = false;
    this.gameOverShown = false;
    this.gameSaved = true; // spectators don't save games
    if (m.fen) this.engine.loadFEN(m.fen);
    this.participants = { w: { name: 'Белые', avatar: 'user' }, b: { name: 'Чёрные', avatar: 'user' } };
    if (this.menu && this.menu.isOpen()) this.menu.close();
    this.renderBoard();
    this.renderMoveHistory();
    this.updatePlayerBanners();
    this.updateStatus();
    if (m.clocks) this.updateOnlineClocks(m.clocks);
    const panel = document.getElementById('online-game-panel');
    if (panel) panel.style.display = 'flex';
    const indicator = document.getElementById('game-status-indicator');
    if (indicator) indicator.textContent = 'Наблюдение за партией';
    this.showToast('Вы наблюдаете за партией');
  }

  onOnlineMove(m) {
    if (m.gameId !== this.onlineGameId) return;
    // Найдём ход по UCI и применим локально (без отправки обратно)
    const files = 'abcdefgh';
    const fr = 8 - Number(m.uci[1]), fc = files.indexOf(m.uci[0]);
    const tr = 8 - Number(m.uci[3]), tc = files.indexOf(m.uci[2]);
    const promo = m.uci.length > 4 ? m.uci[4].toLowerCase() : null;
    let move = null;
    for (const mv of this.engine.getAllLegalMoves()) {
      if (mv.from.r === fr && mv.from.c === fc && mv.to.r === tr && mv.to.c === tc) {
        if (promo) { if (mv.promotion === promo) { move = mv; break; } }
        else if (!mv.promotion) { move = mv; break; }
      }
    }
    if (move) this.commitMove(move, true);
    if (m.clocks) this.updateOnlineClocks(m.clocks);
  }

  updateOnlineClocks(clocks) {
    if (!clocks) return;
    const topWhite = this.isFlipped;
    const topTime = topWhite ? clocks.w : clocks.b;
    const botTime = topWhite ? clocks.b : clocks.w;
    const unlimited = !this.timeControl || this.timeControl <= 0;
    const fmt = (ms) => {
      if (unlimited) return '∞';
      const s = Math.max(0, Math.ceil(ms / 1000));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    };
    if (this.topPlayerTimer) this.topPlayerTimer.textContent = fmt(topTime);
    if (this.bottomPlayerTimer) this.bottomPlayerTimer.textContent = fmt(botTime);
    this.whiteTime = Math.ceil((clocks.w || 0) / 1000);
    this.blackTime = Math.ceil((clocks.b || 0) / 1000);
  }

  onOnlineClock(m) { if (m.gameId === this.onlineGameId) this.updateOnlineClocks(m.clocks); }

  onOnlineGameOver(m) {
    if (m.gameId !== this.onlineGameId) return;
    clearInterval(this.timerInterval);
    const panel = document.getElementById('online-game-panel');
    if (panel) panel.style.display = 'none';
    this.lastOnlineResult = m;
    const ratedNote = (m.rated === false) ? ' · Без ЭЛО' : '';
    const winner = m.result === '1-0' ? 'w' : (m.result === '0-1' ? 'b' : null);
    const status = { isGameOver: true, result: m.result, reason: m.reason + ratedNote, winner };
    this.showGameOver(status);
  }

  onOnlineChat(m) {
    const inGame = !!m.gameId;
    const log = document.getElementById(inGame ? 'online-game-chat' : 'online-chat-log');
    if (!log) return;
    const div = document.createElement('div');
    div.className = 'online-chat-msg';
    div.innerHTML = '<b>' + this.escapeHtml(m.from) + ':</b> ' + this.escapeHtml(m.text);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  onOnlineSpectator(m, joined) {
    const el = document.getElementById('online-game-spectators');
    if (el) el.textContent = joined ? (m.name + ' смотрит') : '';
  }

  escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  sendOnlineChat(inGame) {
    const id = inGame ? 'online-game-chat-text' : 'online-chat-text';
    const input = document.getElementById(id);
    if (!input || !input.value.trim()) return;
    this.online.chat(input.value.trim(), inGame ? this.onlineGameId : null);
    input.value = '';
  }

  setupTheme() {
    const saved = storageGet('chess_theme') || 'wood';
    this.setTheme(saved);
    document.getElementById('theme-select').value = saved;
    this.loadSettings();
  }

  /* ------------------------- Настройки игры ------------------------- */

  loadSettings() {
    const tc = storageGet('chess_set_tc');
    const lv = storageGet('chess_set_level');
    this.settings = {
      coords: storageGet('chess_set_coords') !== '0',
      hints: storageGet('chess_set_hints') !== '0',
      lastMove: storageGet('chess_set_lastmove') !== '0',
      autoQueen: storageGet('chess_set_autoqueen') === '1',
      defaultTc: tc === null ? 600 : (Number(tc) || 0),
      defaultLevel: lv === null ? 3 : (Number(lv) || 0)
    };
    this.applySettings();
  }

  setSetting(key, value) {
    if (!this.settings) this.loadSettings();
    this.settings[key] = value;
    const map = {
      coords: 'chess_set_coords', hints: 'chess_set_hints',
      lastMove: 'chess_set_lastmove', autoQueen: 'chess_set_autoqueen',
      defaultTc: 'chess_set_tc', defaultLevel: 'chess_set_level'
    };
    if (map[key]) storageSet(map[key], typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    this.applySettings();
    if (this.menu) {
      this.menu.renderSettings();
      if (key === 'defaultTc') this.menu.applyDefaultTimeControl(value);
    }
  }

  applySettings() {
    const s = this.settings;
    document.body.classList.toggle('no-coords', s.coords === false);
    document.body.classList.toggle('no-lastmove', s.lastMove === false);
  }

  setTheme(theme) {
    this.currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    storageSet('chess_theme', theme);
    if (this.menu) this.menu.renderSettings();
  }

  toggleSound() {
    soundManager.enabled = !soundManager.enabled;
    document.getElementById('sound-icon').innerHTML = icon(soundManager.enabled ? 'sound' : 'mute', 18);
    this.showToast(soundManager.enabled ? 'Звук включён' : 'Звук выключен');
    if (this.menu) this.menu.renderSettings();
  }

  toggleFlip() {
    this.isFlipped = !this.isFlipped;
    this.renderBoard();
    this.updatePlayerBanners();
    this.renderBoardOverlay();
  }

  focusBoard() {
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  openNewGameModal() {
    this.newGameModal.classList.add('active');
  }

  closeModal(modal) {
    modal.classList.remove('active');
  }

  applyNewGameSettings() {
    const mode = document.getElementById('setting-game-mode').value;
    const botId = document.getElementById('setting-bot-select').value;
    const activeSideCard = document.querySelector('#setting-side-cards .radio-card.active');
    let side = activeSideCard ? activeSideCard.dataset.side : 'w';

    if (side === 'random') {
      side = Math.random() < 0.5 ? 'w' : 'b';
    }

    const timeControl = parseInt(document.getElementById('setting-time-control').value, 10);

    this.closeModal(this.newGameModal);
    this.startNewGame({
      mode, botId, botId2: botId, side, timeControl,
      aiLevel: this.settings ? this.settings.defaultLevel : 3
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Новая партия                                                       */
  /* ------------------------------------------------------------------ */

  startNewGame({ mode, botId, botId2, side, timeControl, aiLevel }) {
    this.exitAnalysisMode(true);
    this.engine.reset();
    this.ai.resetGame();

    // Токен партии: защищает от «зависших» ходов ИИ из прошлой партии
    this.gameToken = (this.gameToken || 0) + 1;

    this.gameMode = mode;
    this.aiLevel = aiLevel || 3;
    this.playerColor = side;
    this.timeControl = timeControl;
    this.whiteTime = timeControl;
    this.blackTime = timeControl;

    const bot = getBotById(botId);
    const bot2 = getBotById(botId2);

    this.botProfile = mode === 'pve' ? bot : null;
    this.whiteBot = mode === 'eve' ? bot : null;
    this.blackBot = mode === 'eve' ? (bot2 || bot) : null;

    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.pendingPromotionMove = null;
    this.isAIBusy = false;
    this.gameSaved = false;
    this.gameOverShown = false;
    this.lastOnlineResult = null;

    // Сбрасываем онлайн-состояние при локальной партии
    if (mode !== 'online') {
      this.onlineGameId = null;
      this.onlineColor = null;
      this.onlineSpectating = false;
      const op = document.getElementById('online-game-panel');
      if (op) op.style.display = 'none';
    }

    // Подписи участников
    this.participants = this.buildParticipants();

    // Flip board automatically if player is playing Black in PvE
    if (this.gameMode === 'pve') {
      this.isFlipped = (this.playerColor === 'b');
    } else {
      this.isFlipped = false;
    }

    this.resetTimer();
    this.renderBoard();
    this.renderMoveHistory();
    this.updatePlayerBanners();
    this.updateStatus();

    soundManager.playClick();
    this.showToast('Партия началась!');

    // Если EvE или PvE где ходит ИИ
    this.checkAITurn();
  }

  buildParticipants() {
    const humanW = { name: 'Игрок (Белые)', avatar: 'user' };
    const humanB = { name: 'Игрок (Чёрные)', avatar: 'user' };

    if (this.gameMode === 'pve') {
      const bot = this.botProfile;
      const botSide = {
        name: bot ? `${bot.name} (${formatElo(bot.elo)})` : 'ИИ',
        avatar: bot ? (bot.avatar || bot.piece) : 'robot'
      };
      return this.playerColor === 'w'
        ? { w: humanW, b: botSide }
        : { w: botSide, b: humanB };
    }

    if (this.gameMode === 'pvp') {
      return {
        w: { name: 'Игрок 1 (Белые)', avatar: 'user' },
        b: { name: 'Игрок 2 (Чёрные)', avatar: 'user' }
      };
    }

    const wBot = this.whiteBot;
    const bBot = this.blackBot;
    return {
      w: { name: wBot ? `${wBot.name} (${formatElo(wBot.elo)})` : 'ИИ 1', avatar: wBot ? (wBot.avatar || wBot.piece) : 'robot' },
      b: { name: bBot ? `${bBot.name} (${formatElo(bBot.elo)})` : 'ИИ 2', avatar: bBot ? (bBot.avatar || bBot.piece) : 'robot' }
    };
  }

  resetTimer() {
    clearInterval(this.timerInterval);
    this.turnStartTs = Date.now();
    this.updateTimerDisplay();

    if (this.timeControl > 0) {
      this.timerInterval = setInterval(() => {
        const status = this.engine.getGameStatus();
        if (status.isGameOver) {
          clearInterval(this.timerInterval);
          return;
        }

        // Часы идут по реальному времени — не зависят от задержек таймера
        const left = this.getRemainingTime(this.engine.turn);
        if (left <= 0) {
          this.handleTimeOut(this.engine.turn);
          return;
        }

        this.updateTimerDisplay();
      }, 250);
    }
  }

  /** Сколько секунд осталось у стороны, которая сейчас ходит */
  getRemainingTime(color) {
    if (this.timeControl <= 0) return Infinity;
    const base = color === 'w' ? this.whiteTime : this.blackTime;
    const elapsed = (Date.now() - this.turnStartTs) / 1000;
    return Math.max(0, base - elapsed);
  }

  /** Зафиксировать время, потраченное текущей стороной */
  commitClock() {
    if (this.timeControl <= 0) return;
    const elapsed = (Date.now() - this.turnStartTs) / 1000;
    if (this.engine.turn === 'w') this.whiteTime = Math.max(0, this.whiteTime - elapsed);
    else this.blackTime = Math.max(0, this.blackTime - elapsed);
    this.turnStartTs = Date.now();
  }

  handleTimeOut(color) {
    clearInterval(this.timerInterval);
    const winner = color === 'w' ? 'Чёрные' : 'Белые';
    const loser = color === 'w' ? 'Чёрных' : 'Белных';
    this.showGameOver({
      winner: color === 'w' ? 'b' : 'w',
      result: color === 'w' ? '0-1' : '1-0',
      reason: `Время у ${loser} истекло! Победили ${winner}`
    });
  }

  formatTime(seconds) {
    if (this.timeControl === 0) return '∞';
    const total = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  updateTimerDisplay() {
    const isTopWhite = this.isFlipped;

    const whiteLeft = this.engine.turn === 'w'
      ? this.getRemainingTime('w')
      : this.whiteTime;
    const blackLeft = this.engine.turn === 'b'
      ? this.getRemainingTime('b')
      : this.blackTime;

    const topTime = isTopWhite ? whiteLeft : blackLeft;
    const bottomTime = isTopWhite ? blackLeft : whiteLeft;

    this.topPlayerTimer.textContent = this.formatTime(topTime);
    this.bottomPlayerTimer.textContent = this.formatTime(bottomTime);

    this.topPlayerTimer.classList.toggle('low-time', this.timeControl > 0 && topTime <= 30);
    this.bottomPlayerTimer.classList.toggle('low-time', this.timeControl > 0 && bottomTime <= 30);
  }

  updatePlayerBanners() {
    const isTopWhite = this.isFlipped;
    const p = this.participants;

    this.topPlayerName.textContent = isTopWhite ? p.w.name : p.b.name;
    this.topPlayerAvatar.innerHTML = avatarSvg(isTopWhite ? p.w.avatar : p.b.avatar, 22);
    this.bottomPlayerName.textContent = isTopWhite ? p.b.name : p.w.name;
    this.bottomPlayerAvatar.innerHTML = avatarSvg(isTopWhite ? p.b.avatar : p.w.avatar, 22);

    // Active Turn Highlight
    const isWhiteTurn = this.engine.turn === 'w';
    const isTopTurn = (isWhiteTurn && isTopWhite) || (!isWhiteTurn && !isTopWhite);
    this.topPlayerBar.classList.toggle('active-turn', isTopTurn);
    this.bottomPlayerBar.classList.toggle('active-turn', !isTopTurn);

    // Captured Pieces & Material Count
    this.updateCaptures();
  }

  updateCaptures() {
    const initialCounts = { p: 8, r: 2, n: 2, b: 2, q: 1 };
    const currentCounts = {
      w: { p: 0, r: 0, n: 0, b: 0, q: 0 },
      b: { p: 0, r: 0, n: 0, b: 0, q: 0 }
    };

    let whiteMaterial = 0;
    let blackMaterial = 0;
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };

    const board = this.getView().board;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type !== 'k') {
          currentCounts[piece.color][piece.type]++;
          if (piece.color === 'w') whiteMaterial += values[piece.type];
          else blackMaterial += values[piece.type];
        }
      }
    }

    const capturedByWhite = [];
    const capturedByBlack = [];

    ['q', 'r', 'b', 'n', 'p'].forEach(type => {
      const lost = initialCounts[type] - currentCounts.b[type];
      for (let i = 0; i < lost; i++) capturedByWhite.push('b' + type.toUpperCase());
    });

    ['q', 'r', 'b', 'n', 'p'].forEach(type => {
      const lost = initialCounts[type] - currentCounts.w[type];
      for (let i = 0; i < lost; i++) capturedByBlack.push('w' + type.toUpperCase());
    });

    const isTopWhite = this.isFlipped;
    const topCaptures = isTopWhite ? capturedByWhite : capturedByBlack;
    const bottomCaptures = isTopWhite ? capturedByBlack : capturedByWhite;

    const renderCaptureRack = (el, pieces, diff) => {
      el.innerHTML = '';
      pieces.forEach(p => {
        const span = document.createElement('span');
        span.className = 'captured-piece-mini';
        span.innerHTML = CHESS_PIECES_SVG[p] || '';
        el.appendChild(span);
      });
      if (diff > 0) {
        const diffSpan = document.createElement('span');
        diffSpan.className = 'material-diff';
        diffSpan.textContent = `+${diff}`;
        el.appendChild(diffSpan);
      }
    };

    const whiteDiff = whiteMaterial - blackMaterial;
    renderCaptureRack(this.topPlayerCaptures, topCaptures, isTopWhite ? whiteDiff : -whiteDiff);
    renderCaptureRack(this.bottomPlayerCaptures, bottomCaptures, isTopWhite ? -whiteDiff : whiteDiff);
  }

  /* ------------------------------------------------------------------ */
  /*  Отрисовка доски                                                    */
  /* ------------------------------------------------------------------ */

  /** Текущее отображаемое состояние (обычная партия или разбор) */
  getView() {
    if (this.analysisMode) {
      const snap = this.analysisSnapshots[this.analysisIndex];
      if (!snap) {
        return { board: this.engine.board, turn: this.engine.turn, lastMove: null, inCheck: false, king: null };
      }
      return {
        board: snap.board,
        turn: snap.turn,
        lastMove: snap.move,
        inCheck: snap.inCheck,
        king: snap.king
      };
    }

    const lastMove = this.engine.history.length > 0
      ? this.engine.history[this.engine.history.length - 1].move
      : null;

    const inCheck = this.engine.inCheck(this.engine.turn);
    const king = inCheck ? this.engine.findKing(this.engine.turn) : null;

    return { board: this.engine.board, turn: this.engine.turn, lastMove, inCheck, king };
  }

  renderBoard() {
    this.boardEl.innerHTML = '';
    const view = this.getView();

    for (let displayR = 0; displayR < 8; displayR++) {
      for (let displayC = 0; displayC < 8; displayC++) {
        const r = this.isFlipped ? 7 - displayR : displayR;
        const c = this.isFlipped ? 7 - displayC : displayC;

        const square = document.createElement('div');
        square.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
        square.dataset.r = r;
        square.dataset.c = c;

        // Last move highlight
        if (this.settings && this.settings.lastMove === false) {
          // отключено в настройках
        } else if (view.lastMove && ((view.lastMove.from.r === r && view.lastMove.from.c === c) || (view.lastMove.to.r === r && view.lastMove.to.c === c))) {
          square.classList.add('last-move');
        }

        // Selected square highlight
        if (this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c) {
          square.classList.add('selected');
        }

        // King check highlight
        if (view.inCheck && view.king && view.king.r === r && view.king.c === c) {
          square.classList.add('in-check');
        }

        // Rank and File coordinates
        if (displayC === 0 && (!this.settings || this.settings.coords !== false)) {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'coord-rank';
          rankLabel.textContent = 8 - r;
          square.appendChild(rankLabel);
        }
        if (displayR === 7 && (!this.settings || this.settings.coords !== false)) {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'coord-file';
          fileLabel.textContent = String.fromCharCode(97 + c);
          square.appendChild(fileLabel);
        }

        // Piece
        const piece = view.board[r][c];
        if (piece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = 'piece';
          const pieceKey = piece.color + piece.type.toUpperCase();
          pieceEl.innerHTML = CHESS_PIECES_SVG[pieceKey] || '';
          pieceEl.dataset.r = r;
          pieceEl.dataset.c = c;

          // Event handlers for piece
          pieceEl.addEventListener('mousedown', (e) => this.handleDragStart(e, r, c));
          pieceEl.addEventListener('touchstart', (e) => this.handleTouchStart(e, r, c), { passive: false });

          square.appendChild(pieceEl);
        }

        // Legal move indicators
        if (this.legalMovesForSelected.length > 0 && (!this.settings || this.settings.hints !== false)) {
          const matchMove = this.legalMovesForSelected.find(m => m.to.r === r && m.to.c === c);
          if (matchMove) {
            const isCapture = view.board[r][c] !== null || matchMove.isEnPassant;
            const hint = document.createElement('div');
            hint.className = isCapture ? 'move-hint-capture' : 'move-hint-dot';
            square.appendChild(hint);
          }
        }

        // Square click
        square.addEventListener('click', () => this.handleSquareClick(r, c));

        this.boardEl.appendChild(square);
      }
    }

    this.renderBoardOverlay();
  }

  /** Стрелки поверх доски (режим анализа): лучший и сыгранный ходы */
  renderBoardOverlay() {
    const svg = this.boardOverlay;
    if (!svg) return;

    if (!this.analysisMode) {
      svg.innerHTML = '';
      return;
    }

    // Показываем ход, который привёл в текущую позицию
    const entry = this.analysisIndex > 0 ? this.analysisEntries[this.analysisIndex - 1] : null;
    if (!entry) {
      svg.innerHTML = '';
      return;
    }

    const UNIT = 12.5; // 100 / 8
    const toScreen = (r, c) => {
      const dr = this.isFlipped ? 7 - r : r;
      const dc = this.isFlipped ? 7 - c : c;
      return { x: (dc + 0.5) * UNIT, y: (dr + 0.5) * UNIT };
    };

    const arrow = (move, color, width, opacity) => {
      if (!move) return '';
      const from = toScreen(move.from.r, move.from.c);
      const to = toScreen(move.to.r, move.to.c);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const head = Math.min(UNIT * 0.9, len * 0.45);
      const baseX = to.x - ux * head;
      const baseY = to.y - uy * head;
      const px = -uy;
      const py = ux;
      const spread = head * 0.45;
      const p1 = `${baseX + px * spread},${baseY + py * spread}`;
      const p2 = `${baseX - px * spread},${baseY - py * spread}`;
      const shaftEnd = { x: baseX + ux * head * 0.12, y: baseY + uy * head * 0.12 };

      return `
        <line x1="${from.x}" y1="${from.y}" x2="${shaftEnd.x}" y2="${shaftEnd.y}"
              stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>
        <polygon points="${to.x},${to.y} ${p1} ${p2}" fill="${color}" opacity="${opacity}"/>
      `;
    };

    const best = entry.bestMove;
    const played = entry.playedMove;
    const isSame = best && played &&
      best.from.r === played.from.r && best.from.c === played.from.c &&
      best.to.r === played.to.r && best.to.c === played.to.c;

    let markup = '';
    if (played) {
      const cls = MOVE_CLASSES[entry.cls] || MOVE_CLASSES.good;
      markup += arrow(played, isSame ? '#22c55e' : cls.color, 1.6, isSame ? 0.75 : 0.6);
    }
    if (best && !isSame) {
      markup += arrow(best, '#22c55e', 1.4, 0.85);
    }

    svg.setAttribute('viewBox', '0 0 100 100');
    svg.innerHTML = markup;
  }

  /* ------------------------------------------------------------------ */
  /*  Взаимодействие с доской                                            */
  /* ------------------------------------------------------------------ */

  handleSquareClick(r, c) {
    if (this.analysisMode) return;
    if (this.isAIBusy) return;
    const piece = this.engine.getPiece(r, c);

    // Онлайн: зритель и не-ходящий не могут двигать фигуры
    if (this.gameMode === 'online' && (this.onlineSpectating || this.engine.turn !== this.playerColor)) {
      return;
    }

    // If waiting for user turn in PvE
    if (this.gameMode === 'pve' && this.engine.turn !== this.playerColor) {
      return;
    }

    // 1. If clicking on one of the legal target squares
    if (this.selectedSquare) {
      const move = this.legalMovesForSelected.find(m => m.to.r === r && m.to.c === c);
      if (move) {
        this.executeMoveWithPromotionCheck(move);
        return;
      }
    }

    // 2. If clicking on own piece
    if (piece && piece.color === this.engine.turn) {
      this.selectedSquare = { r, c };
      this.legalMovesForSelected = this.engine.getLegalMovesForSquare(r, c);
      soundManager.playClick();
      this.renderBoard();
      return;
    }

    // 3. Clicking on an empty square or opponent square with no selected move -> Deselect
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.renderBoard();
  }

  // Drag and Drop implementation
  handleDragStart(e, r, c) {
    if (this.analysisMode) return;
    if (this.isAIBusy) return;
    if (this.gameMode === 'online' && this.onlineSpectating) return;
    if (this.gameMode === 'pve' && this.engine.turn !== this.playerColor) return;

    const piece = this.engine.getPiece(r, c);
    if (!piece || piece.color !== this.engine.turn) return;

    this.dragStartSquare = { r, c };
    this.selectedSquare = { r, c };
    this.legalMovesForSelected = this.engine.getLegalMovesForSquare(r, c);

    const pieceKey = piece.color + piece.type.toUpperCase();
    this.dragGhost.innerHTML = CHESS_PIECES_SVG[pieceKey];
    this.dragGhost.style.display = 'block';

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    this.dragGhost.style.left = clientX + 'px';
    this.dragGhost.style.top = clientY + 'px';

    this.renderBoard();
  }

  handleDragMove(e) {
    if (!this.dragStartSquare) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    this.dragGhost.style.left = clientX + 'px';
    this.dragGhost.style.top = clientY + 'px';
  }

  handleDragEnd(e) {
    if (!this.dragStartSquare) return;

    this.dragGhost.style.display = 'none';
    this.dragGhost.innerHTML = '';

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    const targetSquare = this.getSquareFromCoords(clientX, clientY);
    if (targetSquare) {
      const move = this.legalMovesForSelected.find(
        m => m.to.r === targetSquare.r && m.to.c === targetSquare.c
      );
      if (move) {
        this.executeMoveWithPromotionCheck(move);
        this.dragStartSquare = null;
        return;
      }
    }

    this.dragStartSquare = null;
    this.renderBoard();
  }

  handleTouchStart(e, r, c) {
    e.preventDefault();
    this.handleDragStart(e, r, c);
  }

  handleTouchMove(e) {
    if (this.dragStartSquare) {
      e.preventDefault();
      this.handleDragMove(e);
    }
  }

  handleTouchEnd(e) {
    if (this.dragStartSquare) {
      this.handleDragEnd(e);
    }
  }

  getSquareFromCoords(clientX, clientY) {
    const rect = this.boardEl.getBoundingClientRect();
    if (
      clientX < rect.left || clientX > rect.right ||
      clientY < rect.top || clientY > rect.bottom
    ) {
      return null;
    }

    const squareSize = rect.width / 8;
    const displayC = Math.floor((clientX - rect.left) / squareSize);
    const displayR = Math.floor((clientY - rect.top) / squareSize);

    const r = this.isFlipped ? 7 - displayR : displayR;
    const c = this.isFlipped ? 7 - displayC : displayC;

    if (r >= 0 && r < 8 && c >= 0 && c < 8) {
      return { r, c };
    }
    return null;
  }

  executeMoveWithPromotionCheck(move) {
    const piece = this.engine.board[move.from.r][move.from.c];
    const isPawnPromotion = piece.type === 'p' && (move.to.r === 0 || move.to.r === 7);

    if (isPawnPromotion) {
      if (this.settings && this.settings.autoQueen) {
        this.commitMove({ ...move, promotion: 'q' });
      } else {
        // Показываем выбор фигуры превращения
        this.pendingPromotionMove = { ...move, promotion: null };
        this.openPromotionModal(piece.color);
      }
      return;
    }

    this.commitMove(move);
  }

  openPromotionModal(color) {
    const container = document.getElementById('promo-pieces-container');
    container.innerHTML = '';

    ['q', 'r', 'b', 'n'].forEach(type => {
      const btn = document.createElement('div');
      btn.className = 'promo-piece-btn';
      btn.innerHTML = CHESS_PIECES_SVG[color + type.toUpperCase()];
      btn.title = { q: 'Ферзь', r: 'Ладья', b: 'Слон', n: 'Конь' }[type];

      btn.addEventListener('click', () => {
        this.closeModal(this.promotionModal);
        if (this.pendingPromotionMove) {
          const move = { ...this.pendingPromotionMove, promotion: type };
          this.pendingPromotionMove = null;
          this.commitMove(move);
        }
      });

      container.appendChild(btn);
    });

    this.promotionModal.classList.add('active');
  }

  commitMove(move, fromNetwork = false) {
    const isOnline = this.gameMode === 'online';
    // В онлайне ходить может только владелец очереди и не зритель
    if (isOnline && !fromNetwork) {
      if (this.onlineSpectating || this.engine.turn !== this.playerColor) return;
    }

    const captured = this.engine.board[move.to.r][move.to.c] || move.isEnPassant;
    const isCastle = move.isCastling;

    // Часы в онлайне authoritative на сервере
    if (!isOnline) this.commitClock();

    // Apply move in engine
    this.engine.makeMove(move);
    this.ai.recordMove(move);

    // Отправляем ход на сервер (локальный ход игрока)
    if (isOnline && !fromNetwork && this.onlineGameId) {
      this.online.move(this.onlineGameId, moveToUci(move));
    }

    // Audio
    const inCheck = this.engine.inCheck(this.engine.turn);
    if (inCheck) {
      soundManager.playCheck();
    } else if (captured) {
      soundManager.playCapture();
    } else if (isCastle) {
      soundManager.playCastle();
    } else {
      soundManager.playMove();
    }

    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.renderBoard();
    this.renderMoveHistory();
    this.updatePlayerBanners();
    this.updateStatus();

    // В онлайне конец партии приходит от сервера
    if (isOnline) return;

    // Check game over
    const status = this.engine.getGameStatus();
    if (status.isGameOver) {
      this.showGameOver(status);
      return;
    }

    // Trigger AI move if applicable
    this.checkAITurn();
  }

  /**
   * Отдельный движок под текущую позицию (для поиска).
   * Создаём новый экземпляр на каждый ход, чтобы «зависший» поиск из
   * прошлой партии не мог испортить состояние текущего.
   */
  prepareSearch() {
    this.searchEngine = new ChessEngine();
    this.searchAI = new ChessAI(this.searchEngine);

    const fen = this.engine.getFEN();
    if (!this.searchEngine.loadFEN(fen)) {
      this.searchEngine.reset();
    }
    this.searchAI.gameLine = this.ai.gameLine.slice();
    this.searchAI.nodes = 0;
  }

  /**
   * Выбрать ход с помощью Stockfish, затем применить «человеческие»
   * ошибки и стиль конкретного бота (профиль).
   */
  async getBestMoveStockfish(bot, difficulty) {
    const fen = this.engine.getFEN();
    const prof = this.ai.buildProfile(difficulty, bot);
    // Ограничиваем время рассуждения в зависимости от уровня бота
    const movetime = Math.max(60, Math.min(1800, Math.round(prof.timeLimit * 0.5)));

    const res = await this.stockfish.analyze(fen, { movetime, multipv: 6 });
    if (!res.moves.length) return null;

    const isWhite = this.engine.turn === 'w';
    const sign = isWhite ? 1 : -1; // оценка Stockfish от стороны ходящего → переведём в «от белых»

    // Переводим оценки в «от белых» и ходы — в объекты движка
    const scored = [];
    for (const r of res.moves) {
      const move = uciToMove(r.uci, this.engine);
      if (move) scored.push({ move, score: sign * r.score });
    }
    if (!scored.length) return null;

    // Лучший ход — первый в списке Stockfish
    const best = scored[0].move;
    return this.searchAI.pickMove(scored, best, isWhite, prof);
  }

  /** Оценка позиции для разбора партии (все ходы с оценками, от белых) */
  async stockfishAnalyzePosition(fen, engine) {
    let res;
    try {
      res = await this.stockfish.analyze(fen, { movetime: 90, multipv: 40 });
    } catch (e) {
      console.warn('Stockfish недоступен для анализа, используется внутренний движок:', e);
      engine.loadFEN(fen);
      return new ChessAI(engine).analyzePosition(null);
    }
    const turn = (fen.split(' ')[1] || 'w');
    const isWhite = turn === 'w';
    const sign = isWhite ? 1 : -1;
    // Один раз строим карту ходов, чтобы не генерировать легальные ходы 40 раз
    const files = 'abcdefgh';
    const moveMap = new Map();
    for (const m of engine.getAllLegalMoves()) {
      const key = files[m.from.c] + (8 - m.from.r) + files[m.to.c] + (8 - m.to.r) + (m.promotion || '');
      moveMap.set(key, m);
    }
    const scored = [];
    for (const r of res.moves) {
      const move = moveMap.get(r.uci) || moveMap.get(r.uci.slice(0, 4));
      if (move) scored.push({ move, score: sign * r.score, pv: r.pv || [r.uci] });
    }
    scored.sort((a, b) => b.score - a.score);
    const best = scored.length ? (isWhite ? scored[0] : scored[scored.length - 1]) : null;
    return { scored, best, isWhite, turn, bestPv: best ? best.pv : [] };
  }

  /** Какой бот сейчас ходит */
  getBotForTurn() {
    if (this.gameMode === 'pve') {
      return this.engine.turn === this.playerColor ? null : this.botProfile;
    }
    if (this.gameMode === 'eve') {
      return this.engine.turn === 'w' ? this.whiteBot : this.blackBot;
    }
    return null;
  }

  checkAITurn() {
    if (this.analysisMode) return;

    const status = this.engine.getGameStatus();
    if (status.isGameOver) return;

    const isAITurn =
      (this.gameMode === 'pve' && this.engine.turn !== this.playerColor) ||
      (this.gameMode === 'eve');

    if (isAITurn) {
      const bot = this.getBotForTurn();
      const token = this.gameToken;
      this.isAIBusy = true;
      this.statusIndicator.textContent = bot ? `${bot.name} думает...` : 'Компьютер думает...';

      // «Раздумье» бота: поиск идёт в фоне, интерфейс остаётся живым
      const thinkDelay = bot
        ? this.ai.getThinkTime(bot)
        : (this.gameMode === 'eve' ? 400 : 300);

      const startedAt = Date.now();

      setTimeout(async () => {
        if (token !== this.gameToken) return; // партия успела смениться

        let bestMove = null;
        try {
          this.prepareSearch();
          // Stockfish — основной движок. При сбое откатываемся к внутреннему ИИ.
          try {
            bestMove = await this.getBestMoveStockfish(bot, this.aiLevel);
          } catch (se) {
            console.warn('Stockfish недоступен, используется внутренний ИИ:', se);
            bestMove = await this.searchAI.getBestMoveAsync(this.aiLevel, bot);
          }
        } catch (e) {
          console.error('Ошибка поиска хода:', e);
        }

        if (token !== this.gameToken) return;

        // Дожидаемся «человеческой» паузы, если поиск закончился быстрее
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, thinkDelay - elapsed);

        setTimeout(() => {
          this.isAIBusy = false;
          if (token !== this.gameToken) return;
          if (bestMove) this.commitMove(bestMove);
        }, wait);
      }, 0);
    }
  }

  handleUndo() {
    if (this.analysisMode) return;
    if (this.gameMode === 'online') { this.showToast('Отмена хода недоступна в онлайн-партии'); return; }
    if (this.isAIBusy) return;
    if (this.engine.history.length === 0) return;

    if (this.gameMode === 'pve') {
      // In PvE, undo two halfmoves to return to player's turn
      this.engine.undoMove();
      if (this.engine.history.length > 0 && this.engine.turn !== this.playerColor) {
        this.engine.undoMove();
      }
    } else {
      this.engine.undoMove();
    }

    this.ai.gameLine = this.ai.gameLine.slice(0, this.engine.history.length);

    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.renderBoard();
    this.renderMoveHistory();
    this.updatePlayerBanners();
    this.updateStatus();
    soundManager.playClick();
    this.showToast('Ход отменён');
  }

  handleHint() {
    if (this.analysisMode) return;
    if (this.isAIBusy) return;
    const status = this.engine.getGameStatus();
    if (status.isGameOver) return;

    this.showToast('ИИ анализирует позицию...');
    setTimeout(async () => {
      let bestMove = null;
      try {
        this.prepareSearch();
        bestMove = await this.searchAI.getBestMoveAsync(4); // уровень мастера
      } catch (e) {
        console.error('Ошибка подсказки:', e);
      }
      if (!bestMove) return;

      this.selectedSquare = bestMove.from;
      this.legalMovesForSelected = [bestMove];
      this.renderBoard();
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const fromStr = files[bestMove.from.c] + (8 - bestMove.from.r);
      const toStr = files[bestMove.to.c] + (8 - bestMove.to.r);
      this.showToast(`Подсказка ИИ: ${fromStr} -> ${toStr}`);
    }, 150);
  }

  updateStatus() {
    if (this.analysisMode) {
      this.updateAnalysisBannerInfo();
      return;
    }

    const status = this.engine.getGameStatus();
    if (status.isGameOver) {
      this.statusIndicator.textContent = status.reason;
    } else if (status.inCheck) {
      this.statusIndicator.textContent = `Шах ${this.engine.turn === 'w' ? 'Белым' : 'Чёрным'}!`;
    } else {
      this.statusIndicator.textContent = `Ход ${this.engine.turn === 'w' ? 'Белых' : 'Чёрных'}`;
    }
  }

  renderMoveHistory() {
    this.moveTableBody.innerHTML = '';

    if (this.analysisMode) {
      this.renderAnalysisMoves();
      return;
    }

    const history = this.engine.history;

    for (let i = 0; i < history.length; i += 2) {
      const row = document.createElement('tr');
      row.className = 'move-row';

      const numCell = document.createElement('td');
      numCell.className = 'move-num';
      numCell.textContent = `${Math.floor(i / 2) + 1}.`;
      row.appendChild(numCell);

      // White move
      const whiteCell = document.createElement('td');
      whiteCell.className = `move-col ${i === history.length - 1 ? 'current' : ''}`;
      whiteCell.textContent = history[i].san;
      row.appendChild(whiteCell);

      // Black move
      const blackCell = document.createElement('td');
      blackCell.className = `move-col ${i + 1 === history.length - 1 ? 'current' : ''}`;
      blackCell.textContent = history[i + 1] ? history[i + 1].san : '';
      row.appendChild(blackCell);

      this.moveTableBody.appendChild(row);
    }

    // Auto-scroll to latest move
    this.historyContainer.scrollTop = this.historyContainer.scrollHeight;
  }

  /* ------------------------------------------------------------------ */
  /*  Разбор матча                                                       */
  /* ------------------------------------------------------------------ */

  /** Разобрать только что сыгранную партию */
  analyzeCurrentGame() {
    const history = this.engine.history.map(h => ({ san: h.san, move: h.move }));
    const status = this.engine.getGameStatus();
    // Онлайн-результат (сдача/ничья по соглашению) приходит от сервера
    if (this.lastOnlineResult) {
      status.result = this.lastOnlineResult.result;
      status.reason = this.lastOnlineResult.reason;
      this.lastOnlineResult = null;
    }
    this.analysisParticipants = {
      w: this.participants.w.name,
      b: this.participants.b.name
    };
    this.runAnalysis(history, status.result, status.reason);
  }

  /** Разобрать сохранённую партию */
  analyzeGame(savedIndex) {
    const game = this.savedGames[savedIndex];
    if (!game) {
      this.showToast('Партия не найдена');
      return;
    }
    this.analysisParticipants = { w: game.white, b: game.black };
    this.runAnalysis(game.history, game.result, game.reason);
  }

  runAnalysis(history, result, reason) {
    if (!history || !history.length) {
      this.showToast('Нечего анализировать — партия ещё не началась');
      return;
    }
    // Неallowing два параллельных разбора на одном анализаторе
    if (this.analysisRunning) {
      this.showToast('Разбор уже идёт — дождитесь его завершения');
      return;
    }
    this.analysisRunning = true;

    const loading = this.analysisLoading;
    const progress = document.getElementById('analysis-progress');
    const text = document.getElementById('analysis-loading-text');

    loading.classList.add('active');
    progress.style.width = '0%';
    text.textContent = 'Разбираем партию ход за ходом...';

    this.analyzer.start(history, result, reason);
    const total = this.analyzer.totalPositions;

    const tick = async () => {
      const t0 = Date.now();
      // Stockfish асинхронен: обрабатываем по одной позиции за тик,
      // чтобы прогресс-бар обновлялся и интерфейс не замирал
      do {
        await this.analyzer.step();
        if (Date.now() - t0 >= 40) break;
      } while (!this.analyzer.done);
      const percent = Math.round((this.analyzer.index / Math.max(1, total)) * 100);
      progress.style.width = percent + '%';

      if (!this.analyzer.done) {
        setTimeout(tick, 0);
      } else {
        text.textContent = 'Готово! Открываем разбор...';
        setTimeout(() => {
          loading.classList.remove('active');
          this.enterAnalysisMode();
          this.analysisRunning = false;
        }, 220);
      }
    };

    setTimeout(tick, 60);
  }

  enterAnalysisMode() {
    this.analysisMode = true;
    this.analysisSnapshots = this.analyzer.snapshots;
    this.analysisEntries = this.analyzer.entries;
    this.analysisSummary = this.analyzer.getSummary();
    this.analysisIndex = this.analysisSnapshots.length - 1;

    document.getElementById('analysis-banner').classList.add('active');
    this.panelTitle.textContent = 'Разбор матча';
    this.renderAnalysisSummary();

    this.setAnalysisIndex(this.analysisIndex);
    this.showToast('Разбор готов! Листайте ходы стрелками влево и вправо');
  }

  exitAnalysisMode(silent = false) {
    if (!this.analysisMode && silent) {
      this.analysisSnapshots = [];
      this.analysisEntries = [];
      return;
    }
    this.analysisMode = false;
    this.analysisSnapshots = [];
    this.analysisEntries = [];
    this.analysisIndex = 0;

    const banner = document.getElementById('analysis-banner');
    if (banner) banner.classList.remove('active');
    const graphWrap = document.getElementById('eval-graph-wrap');
    if (graphWrap) graphWrap.style.display = 'none';
    if (this.panelTitle) this.panelTitle.textContent = 'История партии';
    if (this.analysisSummaryEl) this.analysisSummaryEl.innerHTML = '';

    this.updateEvalBar();
    this.renderBoard();
    this.renderMoveHistory();
    this.updateStatus();
  }

  setAnalysisIndex(index) {
    if (!this.analysisMode) return;
    const max = Math.max(0, this.analysisSnapshots.length - 1);
    this.analysisIndex = Math.max(0, Math.min(max, index));

    this.renderBoard();
    this.renderMoveHistory();
    this.updateEvalBar();
    this.updateAnalysisBannerInfo();
    this.renderEvalGraph();
  }

  updateAnalysisBannerInfo() {
    const info = document.getElementById('analysis-banner-info');
    if (!info) return;

    const entry = this.analysisIndex > 0 ? this.analysisEntries[this.analysisIndex - 1] : null;
    const total = this.analysisSnapshots.length - 1;

    if (!entry) {
      info.textContent = `Начальная позиция · 0/${total}`;
      this.statusIndicator.textContent = 'Начальная позиция';
      this.statusIndicator.style.color = '';
      return;
    }

    const cls = MOVE_CLASSES[entry.cls] || MOVE_CLASSES.good;
    const moveNo = Math.floor(entry.ply / 2) + 1;
    const colorName = entry.color === 'w' ? 'Белые' : 'Чёрные';
    const bookNote = entry.bookName ? ` · ${entry.bookName}` : '';
    const bestNote = (entry.bestLine && entry.bestLine.length)
      ? `<div class="best-line-note">Лучше: <b>${this.escapeHtml(entry.bestLine.join(' '))}</b></div>` : '';
    info.innerHTML = `<div>${moveNo}${entry.color === 'w' ? '.' : '...'} ${this.escapeHtml(entry.san || '')} — ${cls.label}${bookNote} · ход ${this.analysisIndex}/${total}</div>${bestNote}`;

    this.statusIndicator.textContent = `${colorName}: ${entry.san || ''} (${cls.label})`;
    this.statusIndicator.style.color = cls.color;
  }

  /** Перейти к следующей/предыдущей ошибке в разборе */
  jumpMistake(dir) {
    if (!this.analysisMode || !this.analysisEntries.length) return;
    const bad = new Set(['inaccuracy', 'mistake', 'blunder', 'missedMate']);
    const idxs = this.analysisEntries
      .map((e, i) => bad.has(e.cls) ? i + 1 : -1)
      .filter(i => i > 0);
    if (!idxs.length) { this.showToast('В партии нет ошибок для перехода'); return; }
    let target;
    if (dir > 0) target = idxs.find(i => i > this.analysisIndex);
    else target = idxs.slice().reverse().find(i => i < this.analysisIndex);
    if (target == null) target = dir > 0 ? idxs[0] : idxs[idxs.length - 1];
    this.setAnalysisIndex(target);
  }

  onGraphClick(e) {
    const canvas = e.currentTarget;
    if (!canvas || !this.analysisEntries.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const ply = Math.max(1, Math.min(this.analysisEntries.length, Math.round(x * this.analysisEntries.length)));
    this.setAnalysisIndex(ply);
  }

  /** График оценки партии: белые выше нуля, чёрные ниже */
  renderEvalGraph() {
    const wrap = document.getElementById('eval-graph-wrap');
    const canvas = document.getElementById('eval-graph');
    if (!wrap || !canvas) return;
    if (!this.analysisMode || !this.analysisEntries.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 520, cssH = canvas.clientHeight || 130;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const n = this.analysisEntries.length;
    const padX = 8, padY = 8;
    const W = cssW - padX * 2, H = cssH - padY * 2;
    const clamp = 6; // +/- 6 пешек в видимом диапазоне
    const X = (i) => padX + (n <= 1 ? W / 2 : (i / (n - 1)) * W);
    const Y = (cp) => padY + H / 2 - (Math.max(-clamp, Math.min(clamp, cp / 100)) / clamp) * (H / 2);

    // Фон и линия нуля
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(padX, padY, W, H / 2);
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.beginPath(); ctx.moveTo(padX, Y(0)); ctx.lineTo(padX + W, Y(0)); ctx.stroke();

    const vals = this.analysisEntries.map(e => e.evalAfter || 0);
    // Заливка: белые — сверху, чёрные — снизу
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    vals.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
    ctx.lineTo(X(n - 1), Y(0));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padY, 0, padY + H);
    grad.addColorStop(0, 'rgba(229,231,235,0.42)');
    grad.addColorStop(0.5, 'rgba(148,163,184,0.10)');
    grad.addColorStop(1, 'rgba(17,24,39,0.42)');
    ctx.fillStyle = grad; ctx.fill();

    // Линия оценки
    ctx.beginPath();
    vals.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)));
    ctx.strokeStyle = '#81b64c'; ctx.lineWidth = 2; ctx.stroke();

    // Точки: ошибки и блеск
    const dots = { blunder: '#ef4444', mistake: '#f97316', inaccuracy: '#f59e0b', brilliant: '#a855f7', missedMate: '#e11d48' };
    this.analysisEntries.forEach((e, i) => {
      const c = dots[e.cls];
      if (!c) return;
      ctx.beginPath(); ctx.arc(X(i), Y(vals[i]), e.cls === 'blunder' ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
    });

    // Вертикальная линия текущего хода
    const cur = Math.max(0, Math.min(n - 1, this.analysisIndex - 1));
    ctx.strokeStyle = 'rgba(129,182,76,0.85)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(cur), padY); ctx.lineTo(X(cur), padY + H); ctx.stroke();
  }

  renderAnalysisSummary() {
    const el = this.analysisSummaryEl;
    if (!el) return;

    if (!this.analysisSummary) {
      el.innerHTML = '';
      return;
    }

    const s = this.analysisSummary;
    el.innerHTML = `
      <div class="analysis-summary-head">
        <span class="analysis-result-badge ${s.result === '1-0' ? 'white' : (s.result === '0-1' ? 'black' : 'draw')}">${s.result}</span>
        <span class="analysis-summary-reason">${s.reason || ''}</span>
      </div>
      <div class="analysis-summary-row">
        <div class="analysis-side">
          <span class="analysis-side-name">${this.analysisParticipants.w}</span>
          <span class="analysis-accuracy acc-white">${s.whiteAcc.toFixed(1)}%</span>
        </div>
        <div class="analysis-side">
          <span class="analysis-side-name">${this.analysisParticipants.b}</span>
          <span class="analysis-accuracy acc-black">${s.blackAcc.toFixed(1)}%</span>
        </div>
      </div>
      <div class="analysis-summary-row analysis-summary-stats">
        <span>${icon('flag', 12)} ${s.totalMoves} ходов</span>
        <span>${icon('cross', 12)} Провалы: ${s.whiteBlunders} / ${s.blackBlunders}</span>
        <span>${icon('warn', 12)} Ошибки: ${s.whiteMistakes} / ${s.blackMistakes}</span>
        <span>${icon('sparkle', 12)} Блеск: ${s.whiteBrilliant} / ${s.blackBrilliant}</span>
      </div>
      <div class="acp-row"><span>Средняя потеря пешки</span><span>Белые <b>${s.whiteAcp}</b> · Чёрные <b>${s.blackAcp}</b></span></div>
      ${this.renderPhaseBlock(s)}
      ${this.renderKeyMoments(s)}
      ${this.renderClassLegend(s)}
    `;
  }

  renderPhaseBlock(s) {
    const row = (label, key) => {
      const w = s.whitePhases[key] || { acc: 0, count: 0 };
      const b = s.blackPhases[key] || { acc: 0, count: 0 };
      return `<div class="phase-line"><span class="phase-name">${label}</span>
        <span class="phase-track"><span class="phase-fill w" style="width:${w.count ? w.acc : 0}%"></span></span>
        <span class="phase-val">${w.count ? w.acc.toFixed(0) : '—'}</span>
        <span class="phase-track"><span class="phase-fill b" style="width:${b.count ? b.acc : 0}%"></span></span>
        <span class="phase-val">${b.count ? b.acc.toFixed(0) : '—'}</span></div>`;
    };
    return `<div class="analysis-section-title">Точность по стадиям</div>
      <div class="phase-grid">
        ${row('Дебют', 'opening')}
        ${row('Миттельшпиль', 'middlegame')}
        ${row('Эндгейм', 'endgame')}
      </div>`;
  }

  renderKeyMoments(s) {
    if (!s.keyMoments.length) return '';
    const colors = { blunder: '#ef4444', mistake: '#f97316', inaccuracy: '#f59e0b', missedMate: '#e11d48', brilliant: '#a855f7', good: '#94a3b8' };
    const items = s.keyMoments.map(m => {
      const c = colors[m.cls] || '#94a3b8';
      const who = m.color === 'w' ? 'Белые' : 'Чёрные';
      return `<div class="key-moment" data-index="${m.index}">
        <span class="km-badge" style="background:${c}">${m.moveNumber}</span>
        <span class="km-text">${who}: <b>${this.escapeHtml(m.san || '—')}</b></span>
        <span class="km-loss">−${Math.round(m.loss)}</span>
      </div>`;
    }).join('');
    return `<div class="analysis-section-title">Переломные моменты</div>${items}`;
  }

  renderClassLegend(s) {
    const order = ['book','best','brilliant','excellent','good','inaccuracy','mistake','blunder','missedMate'];
    const chips = order.filter(k => s.classes[k]).map(k => {
      const cls = MOVE_CLASSES[k];
      return `<span class="legend-chip"><span class="legend-dot" style="background:${cls.color}"></span>${cls.label} <b>${s.classes[k]}</b></span>`;
    }).join('');
    return `<div class="analysis-section-title">Статистика ходов</div><div class="class-legend">${chips}</div>`;
  }

  renderAnalysisMoves() {
    const entries = this.analysisEntries;

    for (let i = 0; i < entries.length; i += 2) {
      const row = document.createElement('tr');
      row.className = 'move-row';

      const numCell = document.createElement('td');
      numCell.className = 'move-num';
      numCell.textContent = `${Math.floor(i / 2) + 1}.`;
      row.appendChild(numCell);

      [i, i + 1].forEach(idx => {
        const cell = document.createElement('td');
        cell.className = 'move-col analysis-move';

        const entry = entries[idx];
        if (!entry) {
          cell.textContent = '';
          row.appendChild(cell);
          return;
        }

        const cls = MOVE_CLASSES[entry.cls] || MOVE_CLASSES.good;
        cell.innerHTML = `<span class="move-badge" style="color:${cls.color}" title="${cls.label}">${icon(cls.glyph, 15)}</span><span class="move-san">${entry.san || ''}</span>`;
        cell.title = entry.bookName
          ? `${cls.label} · ${entry.bookName} · потеря ${Math.round(entry.loss)} пешки`
          : `${cls.label} · потеря ${Math.round(entry.loss)} пешки`;
        if (this.analysisIndex === idx + 1) cell.classList.add('current');

        cell.addEventListener('click', () => this.setAnalysisIndex(idx + 1));
        row.appendChild(cell);
      });

      this.moveTableBody.appendChild(row);
    }

    // Подкручиваем текущий ход в зону видимости
    const current = this.moveTableBody.querySelector('.move-col.current');
    if (current && this.historyContainer) {
      this.historyContainer.scrollTop = Math.max(0, current.offsetTop - this.historyContainer.clientHeight / 2);
    }
  }

  updateEvalBar() {
    const bar = document.getElementById('eval-bar');
    const fill = document.getElementById('eval-bar-fill');
    const label = document.getElementById('eval-bar-label');
    if (!bar || !fill || !label) return;

    if (!this.analysisMode) {
      bar.classList.remove('active');
      return;
    }

    const evalCp = this.getCurrentEval();
    const winPct = cpToWinPercent(evalCp);

    bar.classList.add('active');
    fill.style.height = winPct + '%';
    fill.style.background = winPct >= 50 ? '#f4f4f5' : '#111827';

    const cp = Math.max(-99, Math.min(99, evalCp / 100));
    label.textContent = (cp >= 0 ? '+' : '') + cp.toFixed(1);
    label.classList.toggle('label-top', winPct < 50);
  }

  getCurrentEval() {
    const entries = this.analysisEntries;
    if (!entries.length) return 0;
    if (this.analysisIndex < entries.length) {
      return entries[this.analysisIndex].evalBefore;
    }
    return entries[entries.length - 1].evalAfter;
  }

  /* ------------------------------------------------------------------ */
  /*  Конец партии                                                       */
  /* ------------------------------------------------------------------ */

  showGameOver(status) {
    // Защита от повторного вызова (например, мат и падение флага одновременно)
    if (this.gameOverShown) return;
    this.gameOverShown = true;

    clearInterval(this.timerInterval);

    const isHumanWin = ((this.gameMode === 'pve' || this.gameMode === 'online') && status.winner === this.playerColor);
    soundManager.playGameOver(isHumanWin);

    document.getElementById('game-over-title').textContent = 'Партия окончена';
    document.getElementById('game-over-reason').textContent = status.reason;
    document.getElementById('game-over-result').textContent = `Результат: ${status.result}`;

    const iconEl = document.getElementById('game-over-icon');
    if (status.winner) {
      iconEl.innerHTML = isHumanWin ? icon('trophy', 48) : pieceIcon('bN', 48);
    } else {
      iconEl.innerHTML = icon('scale', 44);
    }

    // Разбор доступен для всех партий, кроме «бот против бота»
    const analyzeBtn = document.getElementById('game-over-analyze-btn');
    analyzeBtn.style.display = this.gameMode === 'eve' ? 'none' : 'flex';

    this.saveGame(status);

    this.gameOverModal.classList.add('active');
  }

  saveGame(status) {
    // Не сохраняем пустую партию и не дублируем запись об одной и той же партии
    if (this.gameSaved || !this.engine.history.length) return;
    this.gameSaved = true;

    const game = {
      white: this.participants.w.name,
      black: this.participants.b.name,
      result: status.result,
      resultShort: status.result,
      resultClass: status.result === '1-0' ? 'white-win' : (status.result === '0-1' ? 'black-win' : 'draw'),
      reason: status.reason,
      date: new Date().toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }),
      moveCount: this.engine.history.length,
      history: this.engine.history.map(h => ({ san: h.san, move: h.move }))
    };

    this.savedGames.push(game);
    if (this.savedGames.length > 40) this.savedGames.shift();
    storageSet('chess_saved_games', JSON.stringify(this.savedGames));
  }

  loadSavedGames() {
    try {
      const raw = storageGet('chess_saved_games');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  openPgnModal() {
    document.getElementById('fen-input').value = this.engine.getFEN();
    document.getElementById('pgn-textarea').value = this.engine.getPGN({
      White: this.participants.w.name,
      Black: this.participants.b.name
    });
    this.pgnModal.classList.add('active');
  }
}

// Instantiate application on window load
window.addEventListener('DOMContentLoaded', () => {
  window.chessApp = new ChessApp();
});
