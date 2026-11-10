/**
 * Anime.js - studio - ESM
 * @version v4.5.0
 * @license MIT
 * @copyright 2026 - Julian Garnier
 */

/**
 * Crisp 14x14 monochrome SVG icon helpers for Anime Studio (1.5px stroke).
 */

/**
 * @param  {String} inner
 * @param  {Number} [size=14]
 * @return {String}
 */
const svg = (inner, size = 14) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICONS = {
  logo: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="2.5" stroke="#4A9EFF" stroke-width="1.5"/><circle cx="5.5" cy="8" r="1.75" fill="#E5534B"/><circle cx="10.5" cy="5.5" r="1.5" fill="#4A9EFF"/><path d="M5.5 8 L10.5 5.5 L10.5 11" stroke="#F0F2F5" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  undo: svg('<path d="M3.5 6.5H10a3.5 3.5 0 1 1 0 7H7"/><path d="M6 4 3.5 6.5 6 9"/>'),
  redo: svg('<path d="M12.5 6.5H6a3.5 3.5 0 1 0 0 7h3"/><path d="M10 4l2.5 2.5L10 9"/>'),
  save: svg('<path d="M3 2.5h8l2.5 2.5V13a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z"/><path d="M5 2.5v3.5h5V2.5"/><path d="M5 14v-4h6v4"/>'),
  export: svg('<path d="M8 10V2.5"/><path d="M5 5.5 8 2.5l3 3"/><path d="M2.5 10.5V13a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2.5"/>'),
  play: svg('<path d="M4.5 3.2 12.5 8l-8 4.8V3.2z" fill="currentColor" stroke="none"/>'),
  pause: svg('<rect x="4" y="3.2" width="2.8" height="9.6" rx="0.6" fill="currentColor" stroke="none"/><rect x="9.2" y="3.2" width="2.8" height="9.6" rx="0.6" fill="currentColor" stroke="none"/>'),
  toStart: svg('<path d="M3.5 3.5v9"/><path d="M12.5 3.5 6 8l6.5 4.5V3.5z" fill="currentColor" stroke="none"/>'),
  stepBack: svg('<path d="M5 4v8"/><path d="M11.5 4 6.5 8l5 4V4z"/>'),
  stepFwd: svg('<path d="M11 4v8"/><path d="M4.5 4 9.5 8l-5 4V4z"/>'),
  reverse: svg('<path d="M12 5H4"/><path d="M6.5 2.5 4 5l2.5 2.5"/><path d="M4 11h8"/><path d="M9.5 8.5 12 11l-2.5 2.5"/>'),
  loop: svg('<path d="M11.5 3.5 13.5 5.5 11.5 7.5"/><path d="M3 8.5V7a1.5 1.5 0 0 1 1.5-1.5h9"/><path d="M4.5 12.5 2.5 10.5 4.5 8.5"/><path d="M13 7.5V9a1.5 1.5 0 0 1-1.5 1.5h-9"/>'),
  eye: svg('<path d="M1.5 8s2.4-4.2 6.5-4.2S14.5 8 14.5 8s-2.4 4.2-6.5 4.2S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="1.8"/>', 13),
  eyeOff: svg('<path d="M2 2l12 12"/><path d="M6.3 4.1A6.6 6.6 0 0 1 8 3.8c4.1 0 6.5 4.2 6.5 4.2a11.3 11.3 0 0 1-2.1 2.6"/><path d="M4.3 5.5A11.3 11.3 0 0 0 1.5 8s2.4 4.2 6.5 4.2c1 0 1.9-.2 2.7-.6"/>', 13),
  lock: svg('<rect x="3.5" y="7" width="9" height="6.5" rx="1.2"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>', 12),
  unlock: svg('<rect x="3.5" y="7" width="9" height="6.5" rx="1.2"/><path d="M5.5 7V5a2.5 2.5 0 0 1 4.6-1.3"/>', 12),
  chevronRight: svg('<path d="M6 4l4 4-4 4"/>', 12),
  chevronDown: svg('<path d="M4 6l4 4 4-4"/>', 12),
  plus: svg('<path d="M8 3.5v9"/><path d="M3.5 8h9"/>', 13),
  layers: svg('<path d="M8 2.2 2 5.5 8 8.8l6-3.3L8 2.2z"/><path d="M2 8.2 8 11.5l6-3.3"/><path d="M2 10.8 8 14.1l6-3.3"/>', 13),
  fit: svg('<path d="M2.5 5.5V3a.5.5 0 0 1 .5-.5h2.5"/><path d="M10.5 2.5H13a.5.5 0 0 1 .5.5v2.5"/><path d="M13.5 10.5V13a.5.5 0 0 1-.5.5h-2.5"/><path d="M5.5 13.5H3a.5.5 0 0 1-.5-.5v-2.5"/>', 13),
  grid: svg('<path d="M2.5 6h11M2.5 10h11M6 2.5v11M10 2.5v11"/>', 13),
  hand: svg('<path d="M6 8V3.5a1 1 0 0 1 2 0V7m0-2.5a1 1 0 0 1 2 0V7m0-1.5a1 1 0 0 1 2 0V10a4 4 0 0 1-4 4H7.5a3.5 3.5 0 0 1-3.2-2.1L3 9a1 1 0 0 1 1.8-.9L6 10V8z"/>', 13),
  crosshair: svg('<circle cx="8" cy="8" r="4.5"/><path d="M8 1.5v2.5M8 12v2.5M1.5 8H4M12 8h2.5"/>', 13),
  panelLeft: svg('<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M6 2.5v11"/>', 13),
  panelRight: svg('<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M10 2.5v11"/>', 13),
  clock: svg('<circle cx="8" cy="8" r="5.5"/><path d="M8 4.8V8l2.2 1.4"/>', 13),
  close: svg('<path d="M4 4l8 8M12 4l-8 8"/>', 13),
  zoomOut: svg('<circle cx="7" cy="7" r="4.5"/><path d="M5 7h4M10.5 10.5 14 14"/>', 13),
  zoomIn: svg('<circle cx="7" cy="7" r="4.5"/><path d="M5 7h4M7 5v4M10.5 10.5 14 14"/>', 13),
};

export { ICONS };
