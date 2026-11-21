/* =============================================================
   Королевские Шахматы — Набор SVG-иконок
   -------------------------------------------------------------
   Никаких emoji — только векторная графика (24x24, currentColor).
   ============================================================= */

const ICONS = {
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.2-4.2"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.5 14.6a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.55V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1.03H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.55V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1.03H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.4 1.03z"/>',
  sound: '<path d="M11 5 6.5 9H3v6h3.5L11 19z"/><path d="M15 9.2a4 4 0 0 1 0 5.6"/><path d="M17.8 6.4a8 8 0 0 1 0 11.2"/>',
  mute: '<path d="M11 5 6.5 9H3v6h3.5L11 19z"/><path d="m16 10 5 4M21 10l-5 4"/>',
  undo: '<path d="M3 7v6h6"/><path d="M3.6 13a8.5 8.5 0 1 0 2-6L3 9"/>',
  flip: '<path d="M17 2.5 20.5 6 17 9.5"/><path d="M3 12V9.5A3.5 3.5 0 0 1 6.5 6H20"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M21 12v2.5a3.5 3.5 0 0 1-3.5 3.5H4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5"/>',
  bulb: '<path d="M9.5 18h5"/><path d="M10.5 21.5h3"/><path d="M15.2 14.6A5.8 5.8 0 1 0 8.8 14.6a3 3 0 0 0 1.2 2.4h4a3 3 0 0 0 1.2-2.4z"/>',
  play: '<path d="M6.5 3.8 20 12 6.5 20.2z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  users: '<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20.5a6.5 6.5 0 0 1 13 0"/><path d="M16.5 4.8a3.6 3.6 0 0 1 0 6.4"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 6"/>',
  robot: '<rect x="4" y="8.5" width="16" height="11.5" rx="3.5"/><path d="M12 8.5V4.6"/><circle cx="12" cy="3.4" r="1.4"/><path d="M9 13.5h.01M15 13.5h.01M9.5 16.5h5"/><path d="M1.8 12.5v3.5M22.2 12.5v3.5"/>',
  trophy: '<path d="M8 3.5h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5.5v1.5A2.5 2.5 0 0 0 8 9M16 5h2.5v1.5A2.5 2.5 0 0 1 16 9"/><path d="M12 12.5v4M8.5 20.5h7"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="m8.5 10-3.2-6.5h4.8l2.9 5M15.5 10l3.2-6.5h-4.8l-2.9 5"/>',
  chart: '<path d="M3 20.5h18"/><rect x="5" y="11" width="3.4" height="7"/><rect x="10.3" y="5.5" width="3.4" height="12.5"/><rect x="15.6" y="13" width="3.4" height="5"/>',
  refresh: '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3v6h-6"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.3" cy="8.3" r="1.3"/><circle cx="15.7" cy="15.7" r="1.3"/><circle cx="12" cy="12" r="1.3"/>',
  clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 6.8V12l3.4 2"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  cross: '<path d="M18 6 6 18M6 6l12 12"/>',
  question: '<path d="M9.2 9a2.9 2.9 0 0 1 5.6 1c0 2-2.8 2.4-2.8 4"/><path d="M12 17.6h.01"/><circle cx="12" cy="12" r="9"/>',
  chevronLeft: '<path d="m14.5 5.5-7 6.5 7 6.5"/>',
  chevronRight: '<path d="m9.5 5.5 7 6.5-7 6.5"/>',
  first: '<path d="M18.5 19 9 12l9.5-7z"/><path d="M5 19V5"/>',
  last: '<path d="M5.5 5 15 12l-9.5 7z"/><path d="M19 5v14"/>',
  flag: '<path d="M5.5 21.5V3"/><path d="M5.5 4.2h11.8l-2 3.8 2 3.8H5.5z"/>',
  bolt: '<path d="M13.5 2.5 4.5 14h7l-1 7.5 9-11.5h-7z"/>',
  shield: '<path d="M12 21.5s7.5-3.6 7.5-9.3V5.4L12 2.5 4.5 5.4v6.8c0 5.7 7.5 9.3 7.5 9.3z"/>',
  flame: '<path d="M12 21.5c3.9 0 6.8-2.6 6.8-6.2 0-4.4-3.9-6.4-3.9-10.8 0 0-2.9 1.4-2.9 5.4 0 1.9-1.9 2.4-1.9 1.4 0 0-1.5 1.4-1.5 3.9 0 3.6 3.4 6.3 3.4 6.3z"/>',
  feather: '<path d="M20.2 3.8a5.6 5.6 0 0 0-7.9 0L4 12.1v8h8l8.3-8.3a5.6 5.6 0 0 0-.1-8z"/><path d="M16.5 8 2.5 22M17.5 15.5H9"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2.5H20v19.5H6.5A2.5 2.5 0 0 1 4 19.5v-14A2.5 2.5 0 0 1 6.5 2.5z"/>',
  target: '<circle cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3"/>',
  eye: '<path d="M2 12s3.7-6.8 10-6.8S22 12 22 12s-3.7 6.8-10 6.8S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
  crown: '<path d="M3.5 17.5h17L19 7l-4.6 3.6L12 3.5 9.6 10.6 5 7z"/><path d="M3.5 20.5h17"/>',
  scale: '<path d="M12 3.5v17M8 20.5h8"/><path d="M12 6.5 4 8.5M12 6.5l8 2"/><path d="M4 8.5 2 14h4zM20 8.5 18 14h4z"/>',
  gem: '<path d="M6.5 3.5h11L21 9.5 12 20.5 3 9.5z"/><path d="M3 9.5h18M12 20.5 8.5 9.5 12 3.5l3.5 6z"/>',
  rocket: '<path d="M5.5 14.5c-1.6 1.6-2.2 5.5-2.2 5.5s3.9-.6 5.5-2.2a1.9 1.9 0 0 0-2.7-2.7z"/><path d="M12.2 14.8 8.7 11.3C11.2 5.8 15.3 2.5 21.5 2.5c0 6.2-3.3 10.3-8.8 12.8z"/><circle cx="15.6" cy="8.4" r="1.4"/>',
  sparkle: '<path d="M12 2.8 13.9 8 19 9.9 13.9 11.8 12 17l-1.9-5.2L5 9.9 10.1 8z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  dot: '<circle cx="12" cy="12" r="4.5"/>',
  circle: '<circle cx="12" cy="12" r="8.5"/>',
  download: '<path d="M12 3.5v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 19.5h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  warn: '<path d="M12 3.5 22 20.5H2z"/><path d="M12 9.5v5M12 17.5h.01"/>',
  crosshair: '<circle cx="12" cy="12" r="8.5"/><path d="M12 1.8v4M12 18.2v4M1.8 12h4M18.2 12h4"/>',
  swords: '<path d="M14.5 14.5 21 21M3 3h4l11 11-4 4L3 7z"/><path d="M9.5 14.5 3 21M21 3h-4L6 14l4 4L21 7z"/>',

  /* --- Bot avatars --- */
  "bot-volkov": '<circle cx="12" cy="12" r="9"/><path d="M12 4v6M9 7h6"/><circle cx="12" cy="18" r="2.5"/>',
  "bot-kasares": '<path d="M13 3l4 10-10 1.5 4-10z"/><path d="M11 13l-4 10 10-1.5-4-10z"/>',
  "bot-weil": '<path d="M12 2.5v5M8 5l8 0M6 10l12 0M8 15l8 0M12 19.5v5"/>',
  "bot-chen": '<circle cx="12" cy="12" r="8.5"/><path d="M12 4v8M12 16v4"/><path d="M8 12h8"/>',
  "bot-sokolova": '<path d="M12 3v6M9 6h6"/><circle cx="12" cy="16" r="4"/><path d="M8 16h8M12 12v8"/>',
  "bot-tantan": '<path d="M12 3v6M9 6h6"/><path d="M7 14l5 5 5-5M9 14h6"/>',
  "bot-marino": '<path d="M13 3l4 10-10 1.5 4-10z"/><path d="M12 13v6M9 16h6"/>',
  "bot-proffai": '<rect x="4" y="8.5" width="16" height="11.5" rx="3.5"/><path d="M12 8.5V4.6"/><circle cx="12" cy="3.4" r="1.4"/><path d="M9 13.5h.01M15 13.5h.01"/><path d="M8 18h8M12 15v3"/>',
  "bot-lind": '<path d="M4 4h16M4 8h12M4 12h8M4 16h16"/><circle cx="18" cy="6" r="2"/><path d="M17 6h2M18 5v2"/>',
  "bot-hanwei": '<path d="M12 3v5M8 5l8 0"/><path d="M6 10c0-4 4-6 6-6s6 2 6 6"/><path d="M6 15c0 4 4 6 6 6s6-2 6-6"/>',
  "bot-hal": '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/>',
  "bot-nikita": '<path d="M13 3l4 10-10 1.5 4-10z"/><circle cx="12" cy="16" r="3"/><path d="M9 16h6M12 13v6"/>',
  "bot-yuki": '<path d="M12 4c-4 0-7 3-7 7s3 7 7 7 7-3 7-7-3-7-7-7z"/><path d="M12 8v6M9 11h6"/>',
  "bot-klubai": '<rect x="4" y="8.5" width="16" height="11.5" rx="3.5"/><path d="M12 8.5V4.6"/><circle cx="12" cy="3.4" r="1.4"/><path d="M9 13.5h.01M15 13.5h.01M9.5 16.5h5"/>',
  "bot-petya": '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/><path d="M12 14v3M9 14h6"/>',
  "bot-uchebny": '<rect x="4" y="8.5" width="16" height="11.5" rx="3.5"/><path d="M12 8.5V4.6"/><circle cx="12" cy="3.4" r="1.4"/><path d="M9 13.5h.01M15 13.5h.01"/><path d="M7 18l2-5 2 5 2-5 2 5"/>'
};

/**
 * Сгенерировать SVG-иконку.
 * @param {string} name — ключ из ICONS
 * @param {number} size — размер в пикселях
 * @param {string} cls — дополнительный CSS-класс
 */
function icon(name, size = 16, cls = '') {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true">${body}</svg>`;
}

/**
 * SVG-силуэт шахматной фигуры (перекрашивается через CSS в currentColor).
 * @param {string} key — 'wK', 'bQ', ... (см. CHESS_PIECES_SVG)
 * @param {number} size — размер в пикселях
 */
function pieceIcon(key, size = 24, cls = '') {
  const svg = CHESS_PIECES_SVG[key];
  if (!svg) return '';
  return svg
    .replace('<svg ', `<svg class="icon piece-svg ${cls}" width="${size}" height="${size}" `)
    .replace(' xmlns="http://www.w3.org/2000/svg"', ' xmlns="http://www.w3.org/2000/svg" aria-hidden="true"');
}

/** Аватары ботов: botId → иконка (из ICONS) */
const BOT_AVATARS = {
  volkov: 'bot-volkov',
  kasares: 'bot-kasares',
  weil: 'bot-weil',
  chen: 'bot-chen',
  sokolova: 'bot-sokolova',
  tantan: 'bot-tantan',
  marino: 'bot-marino',
  proffai: 'bot-proffai',
  lind: 'bot-lind',
  hanwei: 'bot-hanwei',
  hal: 'bot-hal',
  nikita: 'bot-nikita',
  yuki: 'bot-yuki',
  klubai: 'bot-klubai',
  petya: 'bot-petya',
  uchebny: 'bot-uchebny'
};

/**
 * Аватар по спецификации: либо ключ фигуры ('wK'), либо имя иконки ('user'),
 * либо id бота (ищется в BOT_AVATARS).
 */
function avatarSvg(spec, size = 22) {
  if (!spec) return '';
  if (/^[wb][PNBRQK]$/.test(spec)) return pieceIcon(spec, size);
  if (BOT_AVATARS[spec]) return icon(BOT_AVATARS[spec], size);
  return icon(spec, size);
}

/**
 * Заполнить все элементы с data-icon / data-icon-size / data-piece разметки.
 */
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    const name = el.getAttribute('data-icon');
    const size = parseInt(el.getAttribute('data-icon-size') || '16', 10);
    el.innerHTML = icon(name, size);
  });
  root.querySelectorAll('[data-piece]').forEach(el => {
    const key = el.getAttribute('data-piece');
    const size = parseInt(el.getAttribute('data-icon-size') || '24', 10);
    el.innerHTML = pieceIcon(key, size);
  });
}
