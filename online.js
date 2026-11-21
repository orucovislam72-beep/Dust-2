/* =============================================================
   Королевские Шахматы — Онлайн-клиент
   -------------------------------------------------------------
   WebSocket-соединение с игровым сервером. Все сообщения
   deliverятся через обработчики on(type, fn).
   ============================================================= */

class OnlineClient {
  constructor() {
    this.ws = null;
    this.id = null;
    this.rating = 1500;
    this.connected = false;
    this.handlers = Object.create(null);
    this.name = storageGet('chess_online_name') || '';
    this.elo = Number(storageGet('chess_online_elo')) || 1500;
    this.intentionalClose = false;
    this.reconnectTimer = null;
    this.lobby = [];
    this.playing = [];
  }

  /** Зарегистрировать обработчик сообщения */
  on(type, fn) {
    (this.handlers[type] || (this.handlers[type] = [])).push(fn);
    return this;
  }

  emit(msg) {
    const list = this.handlers[msg.t];
    if (list) for (const fn of list) { try { fn(msg); } catch (e) { console.error('online handler', msg.t, e); } }
    const any = this.handlers['*'];
    if (any) for (const fn of any) { try { fn(msg); } catch (e) {} }
  }

  setIdentity(name, elo) {
    this.name = String(name || '').trim().slice(0, 24) || 'Игрок';
    this.elo = Number(elo) || 1500;
    storageSet('chess_online_name', this.name);
    storageSet('chess_online_elo', String(this.elo));
    if (this.connected) this.send({ t: 'hello', name: this.name, elo: this.elo });
  }

  connect() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    this.intentionalClose = false;
    const proto = (location.protocol === 'https:') ? 'wss:' : 'ws:';
    let url = proto + '//' + location.host;
    // Возможность переопределить адрес сервера (для отдельного хостинга)
    const custom = storageGet('chess_online_url');
    if (custom) url = custom;
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.emit({ t: 'connectionError', message: e.message });
      return;
    }
    this.ws.onopen = () => {
      this.connected = true;
      if (this.name) this.send({ t: 'hello', name: this.name, elo: this.elo });
      this.emit({ t: 'connected' });
    };
    this.ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (msg.t === 'welcome') {
        this.id = msg.id;
        this.rating = msg.rating;
        // Отложенный сброс рейтинга (если его нажали офлайн)
        if (storageGet('chess_online_pending_reset') === '1') {
          this.resetRating();
          storageSet('chess_online_pending_reset', '0');
        }
      }
      if (msg.t === 'lobby') {
        this.lobby = msg.players || [];
        this.playing = this.lobby.filter(p => p.status === 'playing');
      }
      this.emit(msg);
    };
    this.ws.onerror = () => {
      this.emit({ t: 'connectionError', message: 'Не удалось подключиться к серверу' });
    };
    this.ws.onclose = () => {
      this.connected = false;
      this.emit({ t: 'disconnected' });
      if (!this.intentionalClose) this.scheduleReconnect();
    };
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionalClose) this.connect();
    }, 2500);
  }

  disconnect() {
    this.intentionalClose = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.ws) { try { this.ws.close(); } catch (e) {} }
    this.ws = null;
    this.connected = false;
  }

  send(obj) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    try { this.ws.send(JSON.stringify(obj)); return true; }
    catch (e) { return false; }
  }

  /* --- Действия --- */
  quickMatch(tc = 600, rated = true) { return this.send({ t: 'queue', tc, rated }); }
  cancelMatch() { return this.send({ t: 'cancelQueue' }); }
  challenge(id, tc = 600, rated = true) { return this.send({ t: 'challenge', to: id, tc, rated }); }
  acceptChallenge(id) { return this.send({ t: 'acceptChallenge', from: id }); }
  declineChallenge(id) { return this.send({ t: 'declineChallenge', from: id }); }
  createRoom(tc = 600, rated = true) { return this.send({ t: 'createRoom', tc, rated }); }
  joinRoom(code) { return this.send({ t: 'joinRoom', code }); }
  move(gameId, uci) { return this.send({ t: 'move', gameId, uci }); }
  chat(text, gameId = null) { return this.send({ t: 'chat', text, gameId }); }
  resign(gameId) { return this.send({ t: 'resign', gameId }); }
  offerDraw(gameId) { return this.send({ t: 'drawOffer', gameId }); }
  acceptDraw(gameId) { return this.send({ t: 'drawAccept', gameId }); }
  spectate(gameId) { return this.send({ t: 'spectate', gameId }); }
  leave(gameId) { return this.send({ t: 'leave', gameId }); }
  resetRating() { return this.send({ t: 'resetRating' }); }
}
