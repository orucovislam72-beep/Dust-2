/* =============================================================
   Королевские Шахматы — Главное меню
   -------------------------------------------------------------
   Экраны: Главная / Играть / Боты / Анализ / Настройки
   ============================================================= */

const TIME_CONTROLS = [
  { value: 0, label: 'Без контроля времени' },
  { value: 60, label: '1 минута — Пуля' },
  { value: 180, label: '3 минуты — Блиц' },
  { value: 300, label: '5 минут — Блиц' },
  { value: 600, label: '10 минут — Рапид' },
  { value: 900, label: '15 минут — Классика' },
  { value: 1800, label: '30 минут — Классика' }
];

class MainMenu {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('main-menu');
    this.currentScreen = 'home';

    this.mode = 'pve';
    this.side = 'w';
    this.timeControl = (app.settings && app.settings.defaultTc !== undefined) ? app.settings.defaultTc : 600;
    this.selectedBot = 'volkov';
    this.selectedBot2 = 'kasares';
    this.botFilter = 'all';
    this.botQuery = '';

    this.screens = {};
    document.querySelectorAll('#main-menu .menu-screen').forEach(s => {
      this.screens[s.dataset.screen] = s;
    });

    this.setupEvents();
    this.setupOnlineEvents();
    this.populateBotSelects();
    this.renderBotFilters();
    this.renderBots();
    this.renderSettings();
    this.populateOnlineControls();
    this.showScreen('home');
    this.open();
  }

  /** Прочитать контроль времени из select (0 = без лимита) */
  tcValue(id) {
    const el = document.getElementById(id);
    if (!el) return 600;
    const n = parseInt(el.value, 10);
    return Number.isFinite(n) ? n : 600;
  }

  /** Применить новый контроль времени по умолчанию к экрану «Играть» */
  applyDefaultTimeControl(value) {
    this.timeControl = value;
    const sel = document.getElementById('play-time-select');
    if (sel) {
      Array.from(sel.options).forEach(o => { if (Number(o.value) === Number(value)) sel.value = o.value; });
    }
  }

  /* ------------------------------- Открытие ------------------------------ */

  open(screen) {
    this.el.classList.add('active');
    document.body.classList.add('menu-open');
    if (screen) this.showScreen(screen);
    else if (this.currentScreen === 'analysis') this.renderSavedGames();
  }

  close() {
    this.el.classList.remove('active');
    document.body.classList.remove('menu-open');
    this.app.focusBoard();
  }

  isOpen() {
    return this.el.classList.contains('active');
  }

  showScreen(name) {
    if (!this.screens[name]) return;
    this.currentScreen = name;
    Object.values(this.screens).forEach(s => s.classList.remove('active'));
    this.screens[name].classList.add('active');

    document.querySelectorAll('#main-menu .menu-nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.screen === name);
    });

    if (name === 'bots') this.renderBots();
    if (name === 'analysis') this.renderSavedGames();
    if (name === 'play') this.syncPlayScreen();
    if (name === 'online') { this.populateOnlineControls(); this.renderOnlineLobby(); }
    if (name === 'settings') this.renderSettings();

    const content = this.el.querySelector('.menu-content');
    if (content) content.scrollTop = 0;
  }

  /* ------------------------------- События ------------------------------- */

  setupEvents() {
    // Навигация
    this.el.querySelectorAll('.menu-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showScreen(btn.dataset.screen));
    });

    this.el.querySelectorAll('[data-go-screen]').forEach(btn => {
      btn.addEventListener('click', () => this.showScreen(btn.dataset.goScreen));
    });

    // Кнопка «В игру»
    const closeBtn = document.getElementById('menu-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // Карточки-режимы
    this.el.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        this.mode = card.dataset.mode;
        this.el.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.syncPlayScreen();
      });
    });

    // Выбор стороны
    this.el.querySelectorAll('#menu-side-cards .radio-card').forEach(card => {
      card.addEventListener('click', () => {
        this.side = card.dataset.side;
        this.el.querySelectorAll('#menu-side-cards .radio-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });

    // Боты
    const botSelect = document.getElementById('play-bot-select');
    if (botSelect) {
      botSelect.addEventListener('change', () => {
        this.selectedBot = botSelect.value;
      });
    }
    const botSelect2 = document.getElementById('play-bot2-select');
    if (botSelect2) {
      botSelect2.addEventListener('change', () => {
        this.selectedBot2 = botSelect2.value;
      });
    }

    const randomBtn = document.getElementById('play-random-bot');
    if (randomBtn) {
      randomBtn.addEventListener('click', () => {
        const bot = getRandomBot(true);
        this.selectedBot = bot.id;
        if (botSelect) botSelect.value = bot.id;
        this.showToast(`Соперник: ${bot.name} (${formatElo(bot.elo)})`);
      });
    }

    const timeSelect = document.getElementById('play-time-select');
    if (timeSelect) {
      timeSelect.addEventListener('change', () => {
        this.timeControl = parseInt(timeSelect.value, 10);
      });
    }

    const startBtn = document.getElementById('play-start-btn');
    if (startBtn) startBtn.addEventListener('click', () => this.startGame());

    // Поиск и фильтр ботов
    const search = document.getElementById('bot-search');
    if (search) {
      search.addEventListener('input', () => {
        this.botQuery = search.value;
        this.renderBots();
      });
    }

    // Детали бота
    const detailModal = document.getElementById('bot-detail-modal');
    if (detailModal) {
      detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal || e.target.dataset.close !== undefined) {
          detailModal.classList.remove('active');
        }
      });
    }
    const detailPlay = document.getElementById('bot-detail-play-btn');
    if (detailPlay) {
      detailPlay.addEventListener('click', () => {
        const id = detailPlay.dataset.botId;
        detailModal.classList.remove('active');
        this.selectedBot = id;
        const botSelect = document.getElementById('play-bot-select');
        if (botSelect) botSelect.value = id;
        this.mode = 'pve';
        this.el.querySelectorAll('.mode-card').forEach(c => {
          c.classList.toggle('active', c.dataset.mode === 'pve');
        });
        this.syncPlayScreen();
        this.startGame();
      });
    }

    // Настройки
    this.el.querySelectorAll('.theme-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        this.app.setTheme(sw.dataset.theme);
        this.renderSettings();
      });
    });

    const soundSwitch = document.getElementById('menu-sound-switch');
    if (soundSwitch) {
      soundSwitch.addEventListener('click', () => {
        this.app.toggleSound();
        this.renderSettings();
      });
    }

    // Прочие настройки
    const toggles = [
      ['set-coords', 'coords'], ['set-lastmove', 'lastMove'],
      ['set-hints', 'hints'], ['set-autoqueen', 'autoQueen']
    ];
    toggles.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => {
        this.app.setSetting(key, !this.app.settings[key]);
        this.app.renderBoard();
      });
    });

    const tcSelect = document.getElementById('set-tc');
    if (tcSelect) {
      tcSelect.innerHTML = TIME_CONTROLS.map(t => `<option value="${t.value}">${t.label}</option>`).join('');
      tcSelect.addEventListener('change', () => this.app.setSetting('defaultTc', (Number.isFinite(parseInt(tcSelect.value,10)) ? parseInt(tcSelect.value,10) : 600)));
    }
    const levelSelect = document.getElementById('set-level');
    if (levelSelect) levelSelect.addEventListener('change', () => this.app.setSetting('defaultLevel', parseInt(levelSelect.value, 10) || 3));

    const resetRating = document.getElementById('set-reset-rating');
    if (resetRating) resetRating.addEventListener('click', () => {
      if (!confirm('Сбросить онлайн-рейтинг до 1500?')) return;
      this.app.online.elo = 1500;
      storageSet('chess_online_elo', '1500');
      this.app.online.rating = 1500;
      if (this.app.online.connected) {
        this.app.online.resetRating();
      } else {
        // �������� ����� �� ������� ����� ����� ���������������
        storageSet('chess_online_pending_reset', '1');
      }
      this.updateOnlineProfile();
      this.showToast('Онлайн-рейтинг сброшен');
    });

    const clearGames = document.getElementById('set-clear-games');
    if (clearGames) clearGames.addEventListener('click', () => {
      if (!confirm('Удалить всю историю сохранённых партий?')) return;
      this.app.savedGames = [];
      storageSet('chess_saved_games', '[]');
      this.showToast('История партий очищена');
    });
  }

  /* ------------------------------ Экран «Онлайн» ------------------------- */

  populateOnlineControls() {
    const sel = document.getElementById('online-tc');
    const msel = document.getElementById('match-tc');
    const opts = TIME_CONTROLS.map(t => `<option value="${t.value}" ${t.value === 600 ? 'selected' : ''}>${t.label}</option>`).join('');
    if (sel) sel.innerHTML = opts;
    if (msel) msel.innerHTML = opts;
    const name = document.getElementById('online-name');
    if (name) name.value = this.app.online.name;
    const rating = document.getElementById('online-rating');
    if (rating) rating.textContent = Math.round(this.app.online.rating);
  }

  setupOnlineEvents() {
    const o = this.app.online;

    const save = document.getElementById('online-save');
    if (save) save.addEventListener('click', () => {
      const name = document.getElementById('online-name').value;
      const tc = this.tcValue('online-tc');
      o.setIdentity(name, o.elo);
      this.showToast('Профиль сохранён');
    });

    // Кнопка «Подбор» открывает панель настройки матча
    const mm = document.getElementById('online-matchmaking');
    if (mm) mm.addEventListener('click', () => {
      if (!o.connected) { this.showToast('Нет соединения с сервером'); return; }
      const panel = document.getElementById('online-match-panel');
      if (panel) panel.style.display = 'block';
    });

    const mmClose = document.getElementById('match-panel-close');
    if (mmClose) mmClose.addEventListener('click', () => {
      const panel = document.getElementById('online-match-panel');
      if (panel) panel.style.display = 'none';
      if (this.onlineSearching) o.cancelMatch();
    });

    // Переключатель «С ЭЛО / Без ЭЛО»
    const ratedSwitch = document.getElementById('match-rated-switch');
    if (ratedSwitch) ratedSwitch.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        ratedSwitch.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.matchRated = b.dataset.rated === '1';
      });
    });

    // Кнопка «Начать» — запуск/остановка поиска
    const start = document.getElementById('match-start');
    if (start) start.addEventListener('click', () => {
      if (!o.connected) { this.showToast('Нет соединения с сервером'); return; }
      if (this.onlineSearching) {
        o.cancelMatch();
      } else {
        const tc = this.tcValue('match-tc');
        o.quickMatch(tc, this.matchRated !== false);
      }
    });

    const create = document.getElementById('online-room-create');
    if (create) create.addEventListener('click', () => {
      if (!o.connected) { this.showToast('Нет соединения с сервером'); return; }
      const tc = this.tcValue('online-tc');
      o.createRoom(tc);
    });

    const join = document.getElementById('online-room-join');
    if (join) join.addEventListener('click', () => {
      const code = document.getElementById('online-room-code').value.trim().toUpperCase();
      if (!code) { this.showToast('Введите код комнаты'); return; }
      o.joinRoom(code);
    });

    const copy = document.getElementById('online-room-copy');
    if (copy) copy.addEventListener('click', () => {
      const code = document.getElementById('online-room-code-value').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(code);
      this.showToast('Код скопирован');
    });

    const cancel = document.getElementById('online-room-cancel');
    if (cancel) cancel.addEventListener('click', () => {
      document.getElementById('online-room-result').style.display = 'none';
      o.cancelMatch();
    });

    const lobbySend = document.getElementById('online-chat-send');
    if (lobbySend) lobbySend.addEventListener('click', () => this.app.sendOnlineChat(false));
    const lobbyInput = document.getElementById('online-chat-text');
    if (lobbyInput) lobbyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.app.sendOnlineChat(false);
    });
  }

  updateOnlineConn(online, message) {
    const el = document.getElementById('online-conn');
    if (!el) return;
    el.classList.toggle('online', !!online);
    el.classList.toggle('offline', !online);
    el.innerHTML = '<span class="online-dot"></span> ' +
      (online ? 'Подключено' : (message ? 'Ошибка: ' + this.escapeHtml(message) : 'Не подключено'));
  }

  updateOnlineProfile() {
    const rating = document.getElementById('online-rating');
    if (rating) rating.textContent = Math.round(this.app.online.rating);
  }

  updateOnlineQueue(searching) {
    this.onlineSearching = !!searching;
    const btn = document.getElementById('match-start');
    if (btn) btn.textContent = searching ? 'Остановить поиск' : 'Начать';
    const status = document.getElementById('match-status-text');
    if (status) status.textContent = searching
      ? 'Ищем соперника... Если вы долго ждёте, попробуйте «Без ЭЛО»'
      : 'Нажмите «Начать» для поиска соперника';
  }

  showOnlineRoom(code) {
    const box = document.getElementById('online-room-result');
    const codeEl = document.getElementById('online-room-code-value');
    if (box && codeEl) { codeEl.textContent = code; box.style.display = 'flex'; }
    this.showToast('Комната создана. Сообщите код другу.');
  }

  showOnlineChallenge(m) {
    if (!confirm(m.from.name + ' (' + m.from.rating + ') вызывает вас на партию. Принять?')) {
      this.app.online.declineChallenge(m.from.id);
    } else {
      this.app.online.acceptChallenge(m.from.id);
    }
  }

  renderOnlineLobby() {
    const o = this.app.online;
    const lobbyEl = document.getElementById('online-lobby');
    const playingEl = document.getElementById('online-playing');
    const countEl = document.getElementById('online-count');
    const playingCountEl = document.getElementById('online-playing-count');

    const others = o.lobby.filter(p => p.id !== o.id && p.status !== 'playing');
    const playing = o.playing.filter(p => p.id !== o.id);

    if (countEl) countEl.textContent = others.length;
    if (playingCountEl) playingCountEl.textContent = playing.length;

    if (lobbyEl) {
      if (!others.length) {
        lobbyEl.innerHTML = '<div class="online-empty">Пока никого нет. Пригласите друга!</div>';
      } else {
        lobbyEl.innerHTML = others.map(p => `
          <div class="online-player">
            <span class="online-player-avatar">${icon('user', 18)}</span>
            <span class="online-player-info">
              <span class="online-player-name">${this.escapeHtml(p.name)}<span class="online-player-rating">${p.rating}</span></span>
              <span class="online-player-status ${p.status}">${p.status === 'searching' ? 'Ищет партию' : 'В сети'}</span>
            </span>
            <button class="btn btn-outline btn-sm online-challenge" data-id="${p.id}">Вызвать</button>
          </div>`).join('');
        lobbyEl.querySelectorAll('.online-challenge').forEach(b => {
          b.addEventListener('click', () => {
            const tc = this.tcValue('online-tc');
            o.challenge(b.dataset.id, tc);
          });
        });
      }
    }

    if (playingEl) {
      // Уникальные партии — по одному игроку от каждой пары (у сервера нет id партии в лобби,
      // поэтому просто показываем играющих)
      if (!playing.length) {
        playingEl.innerHTML = '<div class="online-empty">Сейчас никто не играет</div>';
      } else {
        playingEl.innerHTML = playing.map(p => `
          <div class="online-player">
            <span class="online-player-avatar">${icon('swords', 18)}</span>
            <span class="online-player-info">
              <span class="online-player-name">${this.escapeHtml(p.name)}<span class="online-player-rating">${p.rating}</span></span>
              <span class="online-player-status playing">В партии</span>
            </span>
          </div>`).join('');
      }
    }
  }

  escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ------------------------------ Экран «Играть» -------------------------- */

  syncPlayScreen() {
    const isPve = this.mode === 'pve';
    const isPvp = this.mode === 'pvp';
    const isEve = this.mode === 'eve';

    const optBot = document.getElementById('opt-opponent');
    const optBot2 = document.getElementById('opt-opponent2');
    const optSide = document.getElementById('opt-side');

    if (optBot) optBot.style.display = isPve ? 'flex' : 'none';
    if (optBot2) optBot2.style.display = isEve ? 'flex' : 'none';
    if (optSide) optSide.style.display = isPve ? 'flex' : 'none';

    const startBtn = document.getElementById('play-start-btn');
    if (startBtn) {
      if (isPvp) startBtn.innerHTML = `${icon('users', 18)} Начать партию (2 игрока)`;
      else if (isEve) startBtn.innerHTML = `${icon('robot', 18)} Бот против бота`;
      else startBtn.innerHTML = `${icon('swords', 18)} Начать партию`;
    }
  }

  populateBotSelects() {
    const groups = getGroupedBots();
    ['play-bot-select', 'play-bot2-select', 'setting-bot-select'].forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = '';
      groups.forEach(group => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `${group.category.icon} ${group.category.title}`;
        group.bots.forEach(bot => {
          const opt = document.createElement('option');
          opt.value = bot.id;
          opt.textContent = `${bot.name} — ${formatElo(bot.elo)} ЭЛО`;
          optgroup.appendChild(opt);
        });
        select.appendChild(optgroup);
      });
    });

    const b1 = document.getElementById('play-bot-select');
    if (b1) b1.value = this.selectedBot;
    const b2 = document.getElementById('play-bot2-select');
    if (b2) b2.value = this.selectedBot2;

    const timeSelect = document.getElementById('play-time-select');
    const timeSelect2 = document.getElementById('setting-time-control');
    [timeSelect, timeSelect2].forEach(select => {
      if (!select) return;
      select.innerHTML = '';
      TIME_CONTROLS.forEach(tc => {
        const opt = document.createElement('option');
        opt.value = tc.value;
        opt.textContent = tc.label;
        if (tc.value === this.timeControl) opt.selected = true;
        select.appendChild(opt);
      });
    });
  }

  startGame() {
    const side = this.side === 'random'
      ? (Math.random() < 0.5 ? 'w' : 'b')
      : this.side;

    this.close();
    this.app.startNewGame({
      mode: this.mode,
      botId: this.selectedBot,
      botId2: this.selectedBot2,
      side,
      timeControl: this.timeControl,
      aiLevel: this.app.settings ? this.app.settings.defaultLevel : 3
    });
  }

  /* ------------------------------ Экран «Боты» --------------------------- */

  renderBotFilters() {
    const container = document.getElementById('bot-filters');
    if (!container) return;
    container.innerHTML = '';

    const filters = [{ id: 'all', title: 'Все', icon: 'sparkle' }].concat(BOT_CATEGORIES);
    filters.forEach(f => {
      const btn = document.createElement('button');
      btn.className = 'filter-chip' + (this.botFilter === f.id ? ' active' : '');
      const ic = f.id === 'all' ? icon('sparkle', 14) : pieceIcon(f.icon, 16);
      btn.innerHTML = `<span class="filter-chip-icon">${ic}</span> ${f.title}`;
      btn.addEventListener('click', () => {
        this.botFilter = f.id;
        this.renderBotFilters();
        this.renderBots();
      });
      container.appendChild(btn);
    });
  }

  renderBots() {
    const container = document.getElementById('bots-list');
    if (!container) return;
    container.innerHTML = '';

    const results = searchBots(this.botQuery, this.botFilter);

    if (!results.length) {
      container.innerHTML = `<div class="empty-state">${icon('search', 26)}<br>Боты не найдены. Попробуйте изменить запрос.</div>`;
      return;
    }

    const groups = this.botFilter === 'all'
      ? getGroupedBots().map(g => ({ category: g.category, bots: results.filter(b => b.category === g.category.id) }))
        .filter(g => g.bots.length)
      : [{ category: BOT_CATEGORIES.find(c => c.id === this.botFilter) || { title: 'Боты', icon: 'wK', accent: '#4f80ff' }, bots: results }];

    groups.forEach(group => {
      const section = document.createElement('section');
      section.className = 'bot-section';

      const head = document.createElement('header');
      head.className = 'bot-section-head';
      head.innerHTML = `
        <div class="bot-section-title">
          <span class="bot-section-icon">${pieceIcon(group.category.icon, 26)}</span>
          <div>
            <h3>${group.category.title}</h3>
            <p>${group.category.desc || ''}</p>
          </div>
        </div>
        <span class="bot-section-count">${group.bots.length}</span>
      `;
      section.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'bot-grid';
      group.bots.forEach(bot => grid.appendChild(this.buildBotCard(bot)));
      section.appendChild(grid);

      container.appendChild(section);
    });
  }

  buildBotCard(bot) {
    const card = document.createElement('div');
    card.className = 'bot-card';
    card.dataset.botId = bot.id;

    const abilities = bot.abilities.map(id => {
      const a = BOT_ABILITIES[id];
      return a ? `<span class="ability-chip" title="${a.desc}">${icon(a.icon, 13)} ${a.name}</span>` : '';
    }).join('');

    const accent = getEloColor(bot);

    card.innerHTML = `
      <div class="bot-avatar" style="border-color:${accent}; color:${accent}">${avatarSvg(bot.avatar || bot.piece, 30)}<span class="bot-flag">${bot.country}</span></div>
      <div class="bot-main">
        <div class="bot-name-row">
          <span class="bot-name">${bot.name}</span>
          <span class="bot-title">${bot.title}</span>
        </div>
        <div class="bot-meta">
          <span class="bot-elo" style="color:${accent}">${formatElo(bot.elo)}</span>
          <span class="bot-style">${bot.style}</span>
        </div>
        <div class="bot-abilities">${abilities}</div>
      </div>
      <div class="bot-actions">
        <button class="btn btn-outline bot-info-btn">Инфо</button>
        <button class="btn btn-primary bot-play-btn">Играть</button>
      </div>
    `;

    card.querySelector('.bot-info-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.showBotDetails(bot.id);
    });
    card.querySelector('.bot-play-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      // «Играть» из каталога — сразу начинаем партию с этим ботом
      this.selectedBot = bot.id;
      this.mode = 'pve';
      this.el.querySelectorAll('.mode-card').forEach(c => {
        c.classList.toggle('active', c.dataset.mode === 'pve');
      });
      const sel = document.getElementById('play-bot-select');
      if (sel) sel.value = bot.id;
      this.syncPlayScreen();
      this.startGame();
    });
    card.addEventListener('click', () => this.showBotDetails(bot.id));

    return card;
  }

  showBotDetails(botId) {
    const bot = getBotById(botId);
    const modal = document.getElementById('bot-detail-modal');
    if (!bot || !modal) return;

    const accent = getEloColor(bot);
    const cat = getBotCategory(bot);

    document.getElementById('bot-detail-avatar').innerHTML = `${avatarSvg(bot.avatar || bot.piece, 38)}<span class="bot-flag">${bot.country}</span>`;
    document.getElementById('bot-detail-avatar').style.borderColor = accent;
    document.getElementById('bot-detail-name').textContent = bot.name;
    document.getElementById('bot-detail-title').textContent = `${bot.title} · ${cat ? cat.title : ''}`;
    document.getElementById('bot-detail-elo').textContent = formatElo(bot.elo);
    document.getElementById('bot-detail-elo').style.color = accent;
    document.getElementById('bot-detail-style').textContent = bot.style;
    document.getElementById('bot-detail-special').textContent = bot.special;

    const abilitiesEl = document.getElementById('bot-detail-abilities');
    abilitiesEl.innerHTML = bot.abilities.map(id => {
      const a = BOT_ABILITIES[id];
      if (!a) return '';
      return `<div class="detail-ability">
          <span class="detail-ability-icon">${icon(a.icon, 18)}</span>
          <div>
            <strong>${a.name}</strong>
            <span>${a.desc}</span>
          </div>
        </div>`;
    }).join('');

    document.getElementById('bot-detail-play-btn').dataset.botId = bot.id;
    modal.classList.add('active');
  }

  /* ----------------------------- Экран «Анализ» ------------------------- */

  renderSavedGames() {
    const container = document.getElementById('saved-games-list');
    if (!container) return;
    container.innerHTML = '';

    const games = this.app.savedGames || [];

    if (!games.length) {
      container.innerHTML = `<div class="empty-state">${icon('chart', 26)}<br>Пока нет сыгранных партий.<br>Сыграйте партию — и она появится здесь.</div>`;
      return;
    }

    games.slice().reverse().forEach((game, idx) => {
      const realIdx = games.length - 1 - idx;
      const item = document.createElement('div');
      item.className = 'saved-game';

      item.innerHTML = `
        <div class="saved-game-result ${game.resultClass}">${game.resultShort}</div>
        <div class="saved-game-info">
          <div class="saved-game-title">${game.white} — ${game.black}</div>
          <div class="saved-game-sub">${game.date} · ${game.moveCount} ходов · ${game.reason || ''}</div>
        </div>
        <button class="btn btn-primary saved-game-analyze">${icon('chart', 15)} Анализировать</button>
      `;

      item.querySelector('.saved-game-analyze').addEventListener('click', () => {
        this.close();
        this.app.analyzeGame(realIdx);
      });

      container.appendChild(item);
    });
  }

  /* ---------------------------- Экран «Настройки» ------------------------ */

  renderSettings() {
    const theme = this.app.currentTheme || 'wood';
    this.el.querySelectorAll('.theme-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.theme === theme);
    });

    const soundSwitch = document.getElementById('menu-sound-switch');
    if (soundSwitch) {
      soundSwitch.classList.toggle('on', !!soundManager.enabled);
      soundSwitch.querySelector('.switch-state').textContent = soundManager.enabled ? 'Включено' : 'Выключено';
    }

    const s = this.app.settings;
    if (s) {
      const toggles = [
        ['set-coords', s.coords], ['set-lastmove', s.lastMove],
        ['set-hints', s.hints], ['set-autoqueen', s.autoQueen]
      ];
      toggles.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('on', !!value);
        el.querySelector('.switch-state').textContent = value ? 'Включено' : 'Выключено';
      });
      const tcSelect = document.getElementById('set-tc');
      if (tcSelect) tcSelect.value = String(s.defaultTc);
      const levelSelect = document.getElementById('set-level');
      if (levelSelect) levelSelect.value = String(s.defaultLevel);
    }
  }

  showToast(message) {
    if (this.app && this.app.showToast) this.app.showToast(message);
  }
}
