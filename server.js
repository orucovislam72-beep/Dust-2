/* =============================================================
   Королевские Шахматы — Онлайн-сервер
   -------------------------------------------------------------
   Статические файлы + WebSocket: лобби, матчмейкинг по ЭЛО,
   комнаты, партии 1 на 1, чат и зрители.
   Production-сервер. Запуск: node server.js (PORT из env, иначе 10000).
   Проверка здоровья: GET /health
   ============================================================= */
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const zlib = require('zlib');
const ws = require('./ws-lite');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 10000;
const HOST = process.env.HOST || '0.0.0.0';
const RATINGS_FILE = path.join(ROOT, 'ratings.json');

/* ---------- Загружаем движок правил из engine.js ---------- */
const engineCode = fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8');
const ctx = vm.createContext({ console, module: { exports: {} }, exports: {} });
vm.runInContext(engineCode + '\n;globalThis.ChessEngine = typeof ChessEngine !== "undefined" ? ChessEngine : null;', ctx);
const ChessEngine = ctx.ChessEngine;
if (!ChessEngine) { console.error('Не удалось загрузить ChessEngine из engine.js'); process.exit(1); }

/* ---------- Типы MIME ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

/* ---------- Состояние ---------- */
let players = new Map();   // id → { id, name, elo, rating, ws, gameId, queueing, tc }
let games = new Map();     // id → game
let queue = [];            // массив playerId, ждущих матч
let challenges = new Map();// targetId → [{ from, tc }]
let rooms = new Map();     // код → { hostId, tc, gameId }
let ratings = loadRatings();

function loadRatings() {
  try { return JSON.parse(fs.readFileSync(RATINGS_FILE, 'utf8')); }
  catch (e) { return {}; }
}
function saveRatings() {
  try { fs.writeFileSync(RATINGS_FILE, JSON.stringify(ratings, null, 2)); }
  catch (e) { console.warn('Не удалось сохранить рейтинг:', e.message); }
}
function uid() { return crypto.randomBytes(6).toString('hex'); }
function roomCode() { return crypto.randomBytes(3).toString('hex').toUpperCase(); }

/* ---------- Утилиты ---------- */
function send(ws, obj) { try { ws.json(obj); } catch (e) {} }
function sendTo(id, obj) { const p = players.get(id); if (p && !p.ws.closed) send(p.ws, obj); }
function broadcastLobby() {
  const list = [...players.values()].map(p => ({
    id: p.id, name: p.name, rating: Math.round(p.rating),
    status: p.gameId ? 'playing' : (p.queueing ? 'searching' : 'online')
  }));
  for (const p of players.values()) send(p.ws, { t: 'lobby', players: list });
}
function playerInfo(id) {
  const p = players.get(id);
  return p ? { id: p.id, name: p.name, rating: Math.round(p.rating) } : null;
}

/* ---------- Игры ---------- */
function newGame(wId, bId, tc, roomCodeStr = null, rated = true) {
  const id = uid();
  const eng = new ChessEngine();
  const game = {
    id, w: wId, b: bId, tc, roomCode: roomCodeStr, rated,
    engine: eng, history: [], fen: eng.getFEN(),
    result: null, reason: '', spectators: new Set(),
    clocks: { w: tc * 1000, b: tc * 1000 }, lastTick: Date.now(),
    drawOffer: null,
    chat: [], timer: null
  };
  games.set(id, game);
  players.get(wId).gameId = id;
  players.get(bId).gameId = id;
  startClock(game);
  sendTo(wId, { t: 'gameStart', gameId: id, color: 'w',
    opponent: playerInfo(bId), tc, fen: game.fen, roomCode: roomCodeStr, rated });
  sendTo(bId, { t: 'gameStart', gameId: id, color: 'b',
    opponent: playerInfo(wId), tc, fen: game.fen, roomCode: roomCodeStr, rated });
  broadcastLobby();
  return game;
}

function startClock(game) {
  if (game.tc <= 0) return;
  game.lastTick = Date.now();
  game.timer = setInterval(() => {
    if (game.result) { clearInterval(game.timer); return; }
    const now = Date.now();
    const dt = now - game.lastTick;
    game.lastTick = now;
    const side = game.engine.turn;
    game.clocks[side] -= dt;
    if (game.clocks[side] <= 0) {
      game.clocks[side] = 0;
      finishGame(game, side === 'w' ? '0-1' : '1-0', 'Время вышло');
      return;
    }
    for (const id of [game.w, game.b]) {
      const p = players.get(id);
      if (p) send(p.ws, { t: 'clock', gameId: game.id, clocks: { ...game.clocks } });
    }
    for (const sid of game.spectators) {
      const p = players.get(sid);
      if (p) send(p.ws, { t: 'clock', gameId: game.id, clocks: { ...game.clocks } });
    }
  }, 250);
}

function kFactor(r) { return r < 2000 ? 40 : (r < 2400 ? 20 : 10); }
function expected(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)); }

function finishGame(game, result, reason) {
  if (game.result) return;
  game.result = result;
  clearInterval(game.timer);
  const rw = Math.round(players.get(game.w)?.rating || ratings[players.get(game.w)?.name] || 1500);
  const rb = Math.round(players.get(game.b)?.rating || ratings[players.get(game.b)?.name] || 1500);
  const sw = result === '1-0' ? 1 : (result === '0-1' ? 0 : 0.5);
  let dW = 0, dBy = 0;
  if (game.rated !== false) {
    dW = Math.round(kFactor(rw) * (sw - expected(rw, rb)));
    dBy = Math.round(kFactor(rb) * ((1 - sw) - expected(rb, rw)));
    for (const [id, delta] of [[game.w, dW], [game.b, dBy]]) {
      const p = players.get(id);
      if (p) {
        p.rating = Math.max(100, p.rating + delta);
        ratings[p.name] = p.rating;
      }
    }
    saveRatings();
  }
  const payload = {
    t: 'gameOver', gameId: game.id, result, reason, rated: game.rated !== false,
    history: game.history.map(h => ({ san: h.san, move: h.move })),
    ratings: { w: Math.round(players.get(game.w)?.rating || rw), b: Math.round(players.get(game.b)?.rating || rb) },
    delta: { w: dW, b: dBy }
  };
  for (const id of [game.w, game.b]) sendTo(id, payload);
  for (const sid of game.spectators) sendTo(sid, payload);
  for (const id of [game.w, game.b]) { const p = players.get(id); if (p) { p.gameId = null; p.queueing = false; } }
  games.delete(game.id);
  for (const [code, room] of rooms) if (room.gameId === game.id) rooms.delete(code);
  broadcastLobby();
}

function leaveGame(p, gameId) {
  const game = games.get(gameId);
  if (!game) return;
  const color = game.w === p.id ? 'w' : (game.b === p.id ? 'b' : null);
  if (color) {
    finishGame(game, color === 'w' ? '0-1' : '1-0', 'Соперник вышел из партии');
  } else {
    removeSpectator(p, gameId);
  }
}

function removeSpectator(p, gameId) {
  const game = games.get(gameId);
  if (!game) return;
  if (game.spectators.delete(p.id)) {
    for (const id of [game.w, game.b]) sendTo(id, { t: 'spectatorLeft', gameId, name: p.name });
  }
}

/* ---------- Матчмейкинг ---------- */
function tryMatch() {
  if (queue.length < 2) return;
  // Ищем ближайшего по рейтингу (окно расширяется с временем ожидания)
  for (let i = 0; i < queue.length; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      const a = players.get(queue[i]), b = players.get(queue[j]);
      if (!a || !b || !a.queueing || !b.queueing) continue;
      // Рейтинговые и нерейтинговые игры не смешиваем
      if ((a.rated !== false) !== (b.rated !== false)) continue;
      const rated = a.rated !== false;
      const wait = Math.max(Date.now() - a.queueTs, Date.now() - b.queueTs);
      // Для нерейтинговых игр рейтинг не важен — окно всегда открыто
      const window = rated ? 120 + Math.floor(wait / 1000) * 40 : Infinity;
      if (!rated || Math.abs(a.rating - b.rating) <= window) {
        queue.splice(j, 1); queue.splice(i, 1);
        a.queueing = false; b.queueing = false;
        const tc = Math.min(a.tc || 600, b.tc || 600);
        // цвет случайно
        if (Math.random() < 0.5) newGame(a.id, b.id, tc, null, rated);
        else newGame(b.id, a.id, tc, null, rated);
        return;
      }
    }
  }
}

/* ---------- Обработка сообщений ---------- */
function handle(p, msg) {
  if (!msg || typeof msg.t !== 'string') return;
  const t = msg.t;
  if (t === 'hello') {
    const name = String(msg.name || 'Игрок').trim().slice(0, 24) || 'Игрок';
    p.name = name;
    p.elo = Number(msg.elo) || 1500;
    p.rating = ratings[name] != null ? Number(ratings[name]) : p.elo;
    send(p.ws, { t: 'welcome', id: p.id, rating: Math.round(p.rating) });
    broadcastLobby();
    return;
  }
  if (t === 'resetRating') {
    p.rating = 1500;
    ratings[p.name] = 1500;
    saveRatings();
    send(p.ws, { t: 'ratingReset', rating: 1500 });
    broadcastLobby();
    return;
  }
  if (t === 'queue') {
    if (p.gameId) return;
    p.queueing = true; p.queueTs = Date.now(); p.tc = Number(msg.tc) || 600;
    p.rated = msg.rated !== false;
    if (!queue.includes(p.id)) queue.push(p.id);
    send(p.ws, { t: 'queueState', searching: true });
    tryMatch();
    broadcastLobby();
    return;
  }
  if (t === 'cancelQueue') {
    p.queueing = false;
    const i = queue.indexOf(p.id); if (i >= 0) queue.splice(i, 1);
    send(p.ws, { t: 'queueState', searching: false });
    broadcastLobby();
    return;
  }
  if (t === 'challenge') {
    const target = players.get(msg.to);
    if (!target || target.gameId) { send(p.ws, { t: 'error', message: 'Игрок недоступен' }); return; }
    if (!challenges.has(target.id)) challenges.set(target.id, []);
    const rated = msg.rated !== false;
    challenges.get(target.id).push({ from: p.id, tc: Number(msg.tc) || 600, rated });
    send(target.ws, { t: 'challenge', from: playerInfo(p.id), tc: Number(msg.tc) || 600, rated });
    send(p.ws, { t: 'toast', message: 'Вызов отправлен' });
    return;
  }
  if (t === 'acceptChallenge') {
    const list = challenges.get(p.id) || [];
    const idx = list.findIndex(c => c.from === msg.from);
    if (idx < 0) return;
    const ch = list.splice(idx, 1)[0];
    const from = players.get(ch.from);
    if (!from || from.gameId || p.gameId) { send(p.ws, { t: 'error', message: 'Игрок уже в партии' }); return; }
    challenges.set(p.id, list);
    if (p.spectating) { removeSpectator(p, p.spectating); p.spectating = null; }
    if (Math.random() < 0.5) newGame(from.id, p.id, ch.tc, null, ch.rated !== false);
    else newGame(p.id, from.id, ch.tc, null, ch.rated !== false);
    return;
  }
  if (t === 'declineChallenge') {
    const list = (challenges.get(p.id) || []).filter(c => c.from !== msg.from);
    challenges.set(p.id, list);
    return;
  }
  if (t === 'createRoom') {
    const code = roomCode();
    const rated = msg.rated !== false;
    rooms.set(code, { hostId: p.id, tc: Number(msg.tc) || 600, rated, gameId: null });
    send(p.ws, { t: 'roomCreated', code, tc: Number(msg.tc) || 600, rated });
    return;
  }
  if (t === 'joinRoom') {
    const code = String(msg.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) { send(p.ws, { t: 'error', message: 'Комната не найдена' }); return; }
    const host = players.get(room.hostId);
    if (!host || !host.ws || host.ws.closed) { rooms.delete(code); send(p.ws, { t: 'error', message: 'Комната больше не активна' }); return; }
    if (host.id === p.id) { send(p.ws, { t: 'error', message: 'Вы уже создали эту комнату' }); return; }
    if (host.gameId || p.gameId) { send(p.ws, { t: 'error', message: 'Один из игроков уже в партии' }); return; }
    rooms.delete(code);
    if (p.spectating) { removeSpectator(p, p.spectating); p.spectating = null; }
    if (Math.random() < 0.5) newGame(host.id, p.id, room.tc, code, room.rated !== false);
    else newGame(p.id, host.id, room.tc, code, room.rated !== false);
    return;
  }
  if (t === 'move') {
    const game = games.get(msg.gameId);
    if (!game || game.result) return;
    const color = game.w === p.id ? 'w' : (game.b === p.id ? 'b' : null);
    if (!color || color !== game.engine.turn) return;
    const uci = String(msg.uci || '');
    const files = 'abcdefgh';
    const fr = 8 - Number(uci[1]), fc = files.indexOf(uci[0]);
    const tr = 8 - Number(uci[3]), tc = files.indexOf(uci[2]);
    const promo = uci.length > 4 ? uci[4].toLowerCase() : null;
    if ([fr, fc, tr, tc].some(v => !Number.isInteger(v) || v < 0 || v > 7)) return;
    let move = null;
    for (const m of game.engine.getAllLegalMoves()) {
      if (m.from.r === fr && m.from.c === fc && m.to.r === tr && m.to.c === tc) {
        if (promo) { if (m.promotion === promo) { move = m; break; } }
        else if (!m.promotion) { move = m; break; }
      }
    }
    if (!move) { sendTo(p.id, { t: 'illegal', gameId: game.id }); return; }
    if (game.tc > 0) {
      const now = Date.now();
      game.clocks[game.engine.turn] -= (now - game.lastTick);
      game.lastTick = now;
      // Флаг уже упал — ход не принимаем
      if (game.clocks[game.engine.turn] <= 0) {
        game.clocks[game.engine.turn] = 0;
        finishGame(game, color === 'w' ? '0-1' : '1-0', 'Время вышло');
        return;
      }
    }
    game.engine.makeMove(move);
    const rec = game.engine.history[game.engine.history.length - 1];
    game.history.push({ san: rec.san, move });
    game.fen = game.engine.getFEN();
    const st = game.engine.getGameStatus();
    const payload = { t: 'move', gameId: game.id, uci, san: rec.san, fen: game.fen,
      clocks: { ...game.clocks }, turn: game.engine.turn };
    for (const id of [game.w, game.b]) sendTo(id, payload);
    for (const sid of game.spectators) sendTo(sid, payload);
    if (st.isGameOver) finishGame(game, st.result, st.reason);
    return;
  }
  if (t === 'chat') {
    const text = String(msg.text || '').trim().slice(0, 300);
    if (!text) return;
    const targets = msg.gameId ? (() => {
      const g = games.get(msg.gameId);
      return g ? [g.w, g.b, ...g.spectators] : [];
    })() : [...players.keys()];
    for (const id of targets) {
      const pl = players.get(id);
      if (pl) send(pl.ws, { t: 'chat', from: p.name, text, gameId: msg.gameId || null, id: p.id });
    }
    return;
  }
  if (t === 'resign') {
    const game = games.get(msg.gameId);
    if (!game || game.result) return;
    const color = game.w === p.id ? 'w' : (game.b === p.id ? 'b' : null);
    if (color) finishGame(game, color === 'w' ? '0-1' : '1-0', 'Сдался ' + (color === 'w' ? 'белый' : 'чёрный'));
    return;
  }
  if (t === 'drawOffer') {
    const game = games.get(msg.gameId);
    if (!game || game.result) return;
    const opp = game.w === p.id ? game.b : (game.b === p.id ? game.w : null);
    if (opp) {
      game.drawOffer = p.id;
      sendTo(opp, { t: 'drawOffer', gameId: game.id, from: p.name });
    }
    return;
  }
  if (t === 'drawAccept') {
    const game = games.get(msg.gameId);
    if (!game || game.result) return;
    // Ничью может принять только соперник, который реально получил предложение
    if (!game.drawOffer || game.drawOffer === p.id || (game.w !== p.id && game.b !== p.id)) return;
    game.drawOffer = null;
    finishGame(game, '1/2-1/2', 'Ничья по соглашению');
    return;
  }
  if (t === 'spectate') {
    const game = games.get(msg.gameId);
    if (!game || game.result) { send(p.ws, { t: 'error', message: 'Партия не найдена' }); return; }
    // Если смотрели другую партию — выйдем из неё
    if (p.spectating && p.spectating !== game.id) removeSpectator(p, p.spectating);
    game.spectators.add(p.id);
    p.spectating = game.id;
    send(p.ws, { t: 'spectateStart', gameId: game.id, fen: game.fen,
      history: game.history.map(h => ({ san: h.san, move: h.move })), clocks: { ...game.clocks } });
    for (const id of [game.w, game.b]) sendTo(id, { t: 'spectatorJoined', gameId: game.id, name: p.name });
    return;
  }
  if (t === 'leave') { leaveGame(p, msg.gameId); return; }
  if (t === 'ping') { send(p.ws, { t: 'pong' }); return; }
}

/* ---------- HTTP + WebSocket ---------- */
const GZIP_TYPES = /\.(html|css|js|json|svg)$/i;
const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent((req.url || '/').split('?')[0]); }
  catch (e) { res.writeHead(400); res.end('bad request'); return; }
  if (p === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, players: players.size, games: games.size, uptime: Math.round(process.uptime()) }));
    return;
  }
  // Адрес сайта определяется из запроса — не нужно править вручную после деплоя
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = (req.headers['x-forwarded-proto'] || (host.startsWith('localhost') ? 'http' : 'https'));
  const base = proto + '://' + host;
  if (p === '/sitemap.xml') {
    const today = new Date().toISOString().slice(0, 10);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>\n</urlset>\n`;
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
    res.end(xml);
    return;
  }
  if (p === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
    return;
  }
  if (p === '/') p = '/index.html';
  const file = path.resolve(path.join(ROOT, '.' + p));
  const rootDir = path.resolve(ROOT);
  const rel = path.relative(rootDir, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403); res.end('no'); return; }
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cache-Control': 'public, max-age=0, must-revalidate'
  };
  const canGzip = GZIP_TYPES.test(file) && /gzip/.test(req.headers['accept-encoding'] || '');
  fs.readFile(file, (err, data) => {
    if (err) {
      // Отдаём красивую 404-страницу для страниц, и plain text для API/ассетов
      fs.readFile(path.join(ROOT, '404.html'), (e2, html) => {
        if (e2) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    if (canGzip) {
      zlib.gzip(data, (gzErr, zipped) => {
        if (gzErr) { res.writeHead(200, headers); res.end(data); return; }
        res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' });
        res.end(zipped);
      });
    } else { res.writeHead(200, headers); res.end(data); }
  });
});

ws.attach(server, (socket) => {
  const id = uid();
  const p = { id, name: 'Игрок', elo: 1500, rating: 1500, ws: socket, gameId: null, queueing: false, tc: 600 };
  players.set(id, p);
  send(socket, { t: 'welcome', id, rating: 1500 });
  socket.onmessage = (text) => {
    let msg;
    try { msg = JSON.parse(text); } catch (e) { return; }
    try { handle(p, msg); } catch (e) { console.error('handle error:', e); }
  };
  socket.onclose = () => {
    if (p.gameId) leaveGame(p, p.gameId);
    if (p.spectating) removeSpectator(p, p.spectating);
    const i = queue.indexOf(id); if (i >= 0) queue.splice(i, 1);
    // Удаляем комнаты, где хостом был отключившийся
    for (const [code, room] of rooms) if (room.hostId === id) rooms.delete(code);
    // Вызовы и от него, и ему
    challenges.delete(id);
    for (const [tid, list] of challenges) challenges.set(tid, list.filter(c => c.from !== id));
    players.delete(id);
    broadcastLobby();
  };
});

server.listen(PORT, HOST, () => {
  console.log('Королевские Шахматы: http://' + HOST + ':' + PORT);
  console.log('Health-check: /health');
});
