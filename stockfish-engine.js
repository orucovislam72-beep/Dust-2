/* =============================================================
   Королевские Шахматы — Stockfish (Web Worker, UCI)
   -------------------------------------------------------------
   Обёртка над движком Stockfish, скомпилированным в WebAssembly.
   Вся работа идёт в отдельном потоке (Worker), поэтому интерфейс
   не «замирает», пока движок думает.
   ============================================================= */

class StockfishEngine {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.initPromise = null;
    this.pending = null;
    this.queue = [];
  }

  /** Ленивая инициализация воркера (один раз на страницу) */
  init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve, reject) => {
      try {
        const wasmSupported = typeof WebAssembly === 'object' &&
          WebAssembly.validate(Uint8Array.of(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
        const script = wasmSupported
          ? 'stockfish/stockfish.wasm.js'
          : 'stockfish/stockfish.js';
        this.worker = new Worker(script);
        this.worker.onmessage = (e) => this.onMessage(e.data);
        this.worker.onerror = (e) => reject(new Error(e.message || 'Stockfish worker error'));
        this._resolveReady = resolve;
        this.worker.postMessage('uci');
      } catch (err) {
        reject(err);
      }
    });
    return this.initPromise;
  }

  onMessage(data) {
    const line = (typeof data === 'string') ? data : String(data);
    if (line === 'uciok') {
      this.worker.postMessage('isready');
      return;
    }
    if (line === 'readyok') {
      this.ready = true;
      if (this._resolveReady) {
        this._resolveReady();
        this._resolveReady = null;
      }
      this.processQueue();
      return;
    }
    if (!this.pending) return;
    if (line.indexOf('info ') === 0) {
      this.parseInfo(line, this.pending);
    } else if (line.indexOf('bestmove') === 0) {
      this.finish(this.pending, line);
    }
  }

  parseInfo(line, req) {
    const dm = line.match(/\bdepth\s+(\d+)/);
    if (!dm) return;
    const depth = parseInt(dm[1], 10);
    const pm = line.match(/\bmultipv\s+(\d+)/);
    const idx = pm ? parseInt(pm[1], 10) - 1 : 0;
    const sm = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
    const vm = line.match(/\bpv\s+(.+)$/);
    if (!sm || !vm) return;
    let score;
    if (sm[1] === 'mate') {
      const n = parseInt(sm[2], 10);
      score = n > 0 ? 30000 - n : -30000 - n;
    } else {
      score = parseInt(sm[2], 10);
    }
    const pv = vm[1].trim().split(/\s+/);
    // Держим самый глубокий полный результат для каждого mulitpv-индекса
    if (!req.results[idx] || depth >= req.results[idx].depth) {
      req.results[idx] = { uci: pv[0], score, pv, depth };
    }
  }

  finish(req, line) {
    const bm = line.match(/bestmove\s+(\S+)/);
    const best = bm ? bm[1] : null;
    const moves = req.results.filter(Boolean);
    if (!moves.length && best && best !== '(none)') {
      moves.push({ uci: best, score: 0, pv: [best], depth: 0 });
    }
    clearTimeout(req.timer);
    this.pending = null;
    req.resolve({ best, moves });
    this.processQueue();
  }

  processQueue() {
    if (!this.ready || this.pending || !this.queue.length) return;
    const req = this.queue.shift();
    this.pending = req;
    req.results = [];

    this.worker.postMessage('setoption name MultiPV value ' + (req.multipv || 5));
    this.worker.postMessage('setoption name Contempt value 0');

    const pos = (req.moves && req.moves.length)
      ? 'position startpos moves ' + req.moves.join(' ')
      : 'position fen ' + req.fen;
    this.worker.postMessage(pos);
    this.worker.postMessage('go movetime ' + (req.movetime || 500));

    // Страховка на случай, если воркер «завис»
    req.timer = setTimeout(() => {
      if (this.pending === req) this.finish(req, 'bestmove (none)');
    }, (req.movetime || 500) + 4000);
  }

  /**
   * Проанализировать позицию.
   * @param {string} fen — позиция в FEN
   * @param {object} opts — movetime (мс), multipv (число ходов), moves ( UCIs для истории)
   * @returns {Promise<{best:string, moves:Array<{uci,score,pv,depth}>}>}
   */
  analyze(fen, opts = {}) {
    return this.init().then(() => new Promise((resolve) => {
      this.queue.push({
        fen,
        moves: opts.moves || null,
        movetime: opts.movetime || 500,
        multipv: opts.multipv || 5,
        resolve
      });
      this.processQueue();
    }));
  }
}
