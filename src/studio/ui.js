import { isBrowser, doc, isDomSymbol, isSvgSymbol } from '../core/consts.js';
import { clamp, round } from '../core/helpers.js';
import { engine } from '../engine/engine.js';
import { createRenderSession } from '../render/index.js';
import { EASING_PRESETS, sampleEaseCurve } from './easings-bridge.js';
import { generateAnimeCode, generateBlueprintJSON } from './codegen.js';

/**
 * @import { StudioStore, StudioEntry, StudioGroupTrack, StudioTweenTrack } from './store.js'
 */

const SPECTRUM = [
  '#FF4B4B',
  '#FF8F42',
  '#F6FF56',
  '#A4FF4F',
  '#18FF74',
  '#3CFFEC',
  '#61C3FF',
  '#8453E3',
  '#FB89FB',
];

const STUDIO_CSS = `
:host {
  all: initial;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483640;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 11px;
  line-height: 1.4;
  color: #F6F4F2;
  --bg-0: #131212;
  --bg-1: #1B1919;
  --bg-2: #242222;
  --bg-3: #2E2C2C;
  --border: rgba(246, 244, 242, 0.1);
  --border-strong: rgba(246, 244, 242, 0.22);
  --ink: #F6F4F2;
  --muted: rgba(246, 244, 242, 0.56);
  --accent: #61C3FF;
  --green: #18FF74;
  --orange: #FF8F42;
  --red: #FF4B4B;
  --yellow: #F6FF56;
  pointer-events: none;
}

* { box-sizing: border-box; }

.overlay-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.highlight-box {
  position: fixed;
  border: 1.5px solid #61C3FF;
  background: rgba(97, 195, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
  border-radius: 2px;
  pointer-events: none;
}

.highlight-tag {
  position: absolute;
  top: -18px;
  left: -1px;
  background: #61C3FF;
  color: #131212;
  font-weight: 700;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 2px;
  white-space: nowrap;
}

.dock {
  pointer-events: auto;
  position: relative;
  z-index: 2;
  background: var(--bg-0);
  border-top: 1px solid var(--border-strong);
  box-shadow: 0 -12px 38px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  width: 100%;
  user-select: none;
}

.dock.collapsed .body { display: none; }
.dock.collapsed .resize-handle { display: none; }

.resize-handle {
  height: 5px;
  cursor: ns-resize;
  background: transparent;
  transition: background 0.15s;
}
.resize-handle:hover { background: var(--accent); }

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--ink);
  padding-right: 6px;
  border-right: 1px solid var(--border);
}

.brand-dots {
  display: inline-flex;
  gap: 2px;
}
.brand-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

select, input[type="number"], input[type="text"] {
  background: var(--bg-2);
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 6px;
  font-family: inherit;
  font-size: 11px;
  outline: none;
}
select:focus, input:focus { border-color: var(--accent); }

button {
  background: var(--bg-2);
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 7px;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
button:hover { background: var(--bg-3); border-color: var(--border-strong); }
button.active {
  background: rgba(97, 195, 255, 0.16);
  border-color: var(--accent);
  color: var(--accent);
}
button.primary {
  background: var(--green);
  border-color: var(--green);
  color: #131212;
  font-weight: 700;
}
button.primary:hover { filter: brightness(1.08); }
button:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-group {
  display: inline-flex;
  gap: 3px;
  align-items: center;
}

.timecode {
  background: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 8px;
  color: var(--yellow);
  font-variant-numeric: tabular-nums;
  min-width: 154px;
  text-align: center;
}

.spacer { flex: 1; }

.body {
  display: grid;
  grid-template-columns: minmax(340px, 1.45fr) minmax(290px, 1fr);
  height: var(--studio-height, 290px);
  overflow: hidden;
}

.timeline-pane {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  overflow: hidden;
  background: var(--bg-0);
}

.timeline-subbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 10px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  color: var(--muted);
}

.timeline-scroll {
  flex: 1;
  overflow: auto;
  position: relative;
}

.timeline-grid {
  display: grid;
  grid-template-columns: 185px 1fr;
  min-width: 560px;
  position: relative;
}

.ruler-corner {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 6;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  padding: 5px 8px;
  color: var(--muted);
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ruler-track {
  position: sticky;
  top: 0;
  z-index: 5;
  height: 26px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  cursor: ew-resize;
  overflow: visible;
}

.ruler-tick {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px solid rgba(246, 244, 242, 0.14);
  font-size: 9px;
  color: var(--muted);
  padding-left: 3px;
  padding-top: 2px;
  pointer-events: none;
}

.ruler-label {
  position: absolute;
  bottom: 2px;
  transform: translateX(-50%);
  background: #8453E3;
  color: #fff;
  font-size: 9px;
  padding: 0 4px;
  border-radius: 2px;
  pointer-events: none;
  white-space: nowrap;
}

.ruler-call {
  position: absolute;
  bottom: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--orange);
  transform: translateX(-50%);
  pointer-events: none;
}

.playhead-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1.5px;
  background: var(--red);
  z-index: 7;
  pointer-events: none;
  box-shadow: 0 0 8px rgba(255, 75, 75, 0.65);
}

.playhead-head {
  position: absolute;
  top: 0;
  left: -5px;
  width: 11px;
  height: 11px;
  background: var(--red);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}

.track-label-cell {
  position: sticky;
  left: 0;
  z-index: 4;
  background: var(--bg-1);
  border-right: 1px solid var(--border);
  border-bottom: 1px solid rgba(246, 244, 242, 0.05);
  padding: 4px 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;
  cursor: pointer;
}
.track-label-cell.selected { background: rgba(97, 195, 255, 0.12); }
.track-label-cell.sub { padding-left: 20px; background: var(--bg-0); color: var(--muted); }
.track-label-cell.sub.selected { background: rgba(97, 195, 255, 0.1); color: var(--ink); }

.track-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.track-name {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.track-prop-badge {
  font-size: 9px;
  color: var(--muted);
  background: var(--bg-2);
  padding: 0 4px;
  border-radius: 3px;
}

.track-lane-cell {
  position: relative;
  height: 26px;
  border-bottom: 1px solid rgba(246, 244, 242, 0.05);
  background: var(--bg-0);
}
.track-lane-cell.sub { height: 22px; background: rgba(255, 255, 255, 0.01); }

.bar-wrap {
  position: absolute;
  top: 3px;
  bottom: 3px;
  display: flex;
  align-items: stretch;
  cursor: grab;
}
.bar-wrap:active { cursor: grabbing; }

.bar-delay {
  background: repeating-linear-gradient(
    -45deg,
    rgba(246, 244, 242, 0.15),
    rgba(246, 244, 242, 0.15) 3px,
    transparent 3px,
    transparent 6px
  );
  border-radius: 3px 0 0 3px;
  border: 1px dashed rgba(246, 244, 242, 0.25);
  border-right: none;
}

.bar-body {
  position: relative;
  flex: 1;
  min-width: 6px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  overflow: hidden;
  display: flex;
  align-items: center;
}
.bar-wrap.selected .bar-body {
  outline: 1.5px solid #F6F4F2;
  outline-offset: 1px;
}

.bar-spark {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.45;
  pointer-events: none;
}

.bar-text {
  position: relative;
  z-index: 1;
  font-size: 9px;
  font-weight: 700;
  color: #131212;
  padding: 0 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-resize {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  background: rgba(0, 0, 0, 0.25);
}
.bar-resize:hover { background: #F6F4F2; }

.inspector-pane {
  display: flex;
  flex-direction: column;
  background: var(--bg-1);
  overflow: hidden;
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  background: var(--bg-1);
}
.tab {
  flex: 1;
  border: none;
  border-radius: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  padding: 6px 8px;
  justify-content: center;
  color: var(--muted);
}
.tab.active {
  color: var(--ink);
  border-bottom-color: var(--accent);
  background: rgba(97, 195, 255, 0.06);
}

.inspector-body {
  flex: 1;
  overflow: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.field label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.preset-row button {
  font-size: 10px;
  padding: 2px 6px;
}

.curve-box {
  background: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px;
  display: flex;
  gap: 10px;
  align-items: center;
}
.curve-svg {
  width: 150px;
  height: 150px;
  flex-shrink: 0;
  overflow: visible;
  touch-action: none;
}
.bezier-handle {
  cursor: grab;
}
.bezier-handle:active { cursor: grabbing; }

.curve-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}
.slider-row span:first-child { width: 58px; color: var(--muted); }
.slider-row input[type="range"] { flex: 1; accent-color: var(--accent); }
.slider-row span:last-child { width: 38px; text-align: right; color: var(--ink); }

.stagger-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stagger-row {
  display: grid;
  grid-template-columns: 90px 1fr 48px;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}
.stagger-bar-bg {
  height: 10px;
  background: var(--bg-0);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}
.stagger-bar-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 3px;
}

.filmstrip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}
.film-thumb {
  background: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}
.film-thumb:hover { border-color: var(--accent); }
.film-thumb img { width: 100%; aspect-ratio: 16/9; object-fit: contain; display: block; background: #0d0c0c; }
.film-thumb span { font-size: 9px; padding: 2px 4px; color: var(--muted); text-align: center; }

.code-block {
  background: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 10.5px;
  color: #A4FF4F;
  user-select: text;
  max-height: 190px;
  overflow: auto;
}

.empty-state {
  padding: 20px;
  color: var(--muted);
  text-align: center;
}

.status-pill {
  font-size: 10px;
  color: var(--turquoise, #3CFFEC);
  background: rgba(60, 255, 236, 0.1);
  border: 1px solid rgba(60, 255, 236, 0.3);
  border-radius: 4px;
  padding: 3px 6px;
}
`;

const BaseElement = /** @type {typeof HTMLElement} */(
  typeof HTMLElement !== 'undefined' ? HTMLElement : class {}
);

/**
 * Isolated Shadow DOM Web Component powering Anime Studio HUD.
 */
export class AnimeStudioElement extends BaseElement {
  constructor() {
    super();
    /** @type {StudioStore|null} */
    this._store = null;
    /** @type {any} */
    this._studio = null;
    this._tab = 'curves';
    this._codeMode = 'esm';
    this._zoom = 1;
    this._collapsed = false;
    this._inspectTargets = false;
    this._expandedGroups = new Set();
    this._rafId = 0;
    this._height = 290;
    this._renderState = { status: '', progress: 0, videoUrl: '', filmstrip: [] };

    /** @type {HTMLElement|null} */
    this._playheadEl = null;
    /** @type {HTMLElement|null} */
    this._timecodeEl = null;
    /** @type {SVGCircleElement|null} */
    this._curveDotEl = null;
    /** @type {HTMLElement|null} */
    this._overlayEl = null;
    /** @type {HTMLButtonElement|null} */
    this._playBtnEl = null;

    if (this.attachShadow) {
      this._shadow = this.attachShadow({ mode: 'open' });
    }
  }

  /**
   * @param  {StudioStore} store
   * @param  {any} studio
   * @return {void}
   */
  bind(store, studio) {
    this._store = store;
    this._studio = studio;
    this._unsubscribe = store.subscribe(() => this.render());
    this.render();
    this._startRaf();
  }

  disconnectedCallback() {
    if (this._unsubscribe) this._unsubscribe();
    if (this._rafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
  }

  /** Starts lightweight playhead & target overlay sync loop. */
  _startRaf() {
    if (typeof requestAnimationFrame !== 'function') return;
    const step = () => {
      this._updateLivePlayhead();
      this._rafId = requestAnimationFrame(step);
    };
    this._rafId = requestAnimationFrame(step);
  }

  _getCycleDuration(inst) {
    if (!inst) return 1000;
    const isInf = inst.iterationCount === Infinity || inst.duration >= 1e11;
    const d = isInf ? inst.iterationDuration : inst.duration;
    return Math.max(1, d || inst.iterationDuration || 1);
  }

  /** Updates only playhead position, timecode text, live curve dot, and target boxes (zero layout thrash). */
  _updateLivePlayhead() {
    if (!this._store) return;
    const { entry, tween } = this._store.getSelection();
    if (!entry) return;
    const inst = entry.instance;
    const dur = this._getCycleDuration(inst);
    const rawCur = inst.iterationCount === Infinity ? inst.iterationCurrentTime : inst.currentTime;
    const cur = clamp(rawCur, 0, dur);
    const fps = this._studio ? this._studio.fps : 60;
    const curFrame = Math.round((cur / 1000) * fps);
    const totalFrames = Math.max(1, Math.round((dur / 1000) * fps));

    if (this._timecodeEl) {
      this._timecodeEl.textContent = `${String(Math.round(cur)).padStart(4, '0')} / ${Math.round(dur)} ms · F${curFrame}/${totalFrames}`;
    }

    if (this._playheadEl) {
      const pct = clamp(cur / dur, 0, 1) * 100;
      this._playheadEl.style.left = `${pct}%`;
    }

    if (this._playBtnEl) {
      this._playBtnEl.textContent = inst.paused ? '▶ Play' : '⏸ Pause';
      this._playBtnEl.classList.toggle('active', !inst.paused);
    }

    if (this._curveDotEl && tween) {
      const twStart = tween.offset + tween.delay;
      const twDur = Math.max(1, tween.duration);
      const t = clamp((cur - twStart) / twDur, 0, 1);
      const y = tween.easing.fn ? tween.easing.fn(t) : t;
      this._curveDotEl.setAttribute('cx', String(t * 180));
      this._curveDotEl.setAttribute('cy', String(180 - clamp(y, -0.24, 1.24) * 180));
    }

    this._renderTargetHighlights();
  }

  /** Highlights currently selected DOM targets on the viewport when inspect mode is active. */
  _renderTargetHighlights() {
    if (!this._overlayEl || !this._store) return;
    if (!this._inspectTargets || this._collapsed) {
      if (this._overlayEl.childElementCount) this._overlayEl.innerHTML = '';
      return;
    }
    const { group } = this._store.getSelection();
    if (!group || !group.targets.length) {
      if (this._overlayEl.childElementCount) this._overlayEl.innerHTML = '';
      return;
    }

    const domTargets = group.targets.filter(t => t && (t[isDomSymbol] || t[isSvgSymbol] || (typeof Element !== 'undefined' && t instanceof Element)));
    if (!domTargets.length) {
      if (this._overlayEl.childElementCount) this._overlayEl.innerHTML = '';
      return;
    }

    // Reuse existing highlight nodes when count matches to avoid allocation in RAF
    while (this._overlayEl.childElementCount < domTargets.length) {
      const box = doc.createElement('div');
      box.className = 'highlight-box';
      const tag = doc.createElement('span');
      tag.className = 'highlight-tag';
      box.appendChild(tag);
      this._overlayEl.appendChild(box);
    }
    while (this._overlayEl.childElementCount > domTargets.length) {
      this._overlayEl.removeChild(this._overlayEl.lastElementChild);
    }

    for (let i = 0; i < domTargets.length; i++) {
      const el = /** @type {Element} */(domTargets[i]);
      const rect = el.getBoundingClientRect();
      const box = /** @type {HTMLElement} */(this._overlayEl.children[i]);
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.firstElementChild.textContent = `#${i} ${Math.round(rect.left)},${Math.round(rect.top)} · ${Math.round(rect.width)}×${Math.round(rect.height)}`;
    }
  }

  /**
   * Generates an SVG path `d` attribute string for an easing function inside `(width x height)`.
   *
   * @param  {(t: Number) => Number} easeFn
   * @param  {Number} w
   * @param  {Number} h
   * @param  {Boolean} [fitBounds=false]
   * @return {String}
   */
  _buildCurvePath(easeFn, w, h, fitBounds = false) {
    const { points, minY, maxY } = sampleEaseCurve(easeFn, 48);
    const y0 = fitBounds ? Math.min(0, minY) : 0;
    const y1 = fitBounds ? Math.max(1, maxY) : 1;
    const span = Math.max(0.001, y1 - y0);
    return points.map((pt, idx) => {
      const x = round(pt.t * w, 2);
      const y = round(h - ((pt.y - y0) / span) * h, 2);
      return `${idx === 0 ? 'M' : 'L'}${x} ${y}`;
    }).join(' ');
  }

  /** Full Shadow DOM UI render. */
  render() {
    if (!this._shadow || !this._store) return;
    const store = this._store;
    const { entry, group, tween } = store.getSelection();
    const entries = Array.from(store.entries.values());
    const inst = entry ? entry.instance : null;
    const dur = this._getCycleDuration(inst);
    const fps = this._studio ? this._studio.fps : 60;
    const isVirtual = engine.isVirtual;

    const optionsHtml = entries.length
      ? entries.map(e => {
          const ed = this._getCycleDuration(e.instance);
          const tag = e.instance.iterationCount === Infinity ? '∞' : `${Math.round(ed)}ms`;
          return `<option value="${e.id}" ${entry && e.id === entry.id ? 'selected' : ''}>${e.name} (${tag})</option>`;
        }).join('')
      : '<option value="">No active animations</option>';

    const rulerTicksHtml = this._renderRulerTicks(dur, entry);
    const tracksHtml = entry ? this._renderTracks(entry, group, tween, dur) : '<div class="empty-state">Create an animation with animate() or createTimeline() to inspect it here.</div>';
    const inspectorHtml = this._renderInspector(entry, group, tween, fps);

    this._shadow.innerHTML = `
      <style>${STUDIO_CSS}</style>
      <div class="overlay-layer" id="overlay-layer"></div>
      <div class="dock ${this._collapsed ? 'collapsed' : ''}" style="--studio-height: ${this._height}px">
        <div class="resize-handle" id="resize-handle" title="Drag to resize studio"></div>
        <div class="toolbar">
          <div class="brand">
            <span class="brand-dots">
              <span style="background:#FF4B4B"></span>
              <span style="background:#F6FF56"></span>
              <span style="background:#18FF74"></span>
              <span style="background:#61C3FF"></span>
            </span>
            <span>ANIME STUDIO</span>
          </div>
          <select id="entry-select" title="Select Timeline or Animation">${optionsHtml}</select>
          <div class="btn-group">
            <button id="btn-reset" title="Reset to 0ms">⏮</button>
            <button id="btn-step-back" title="Step -1 Frame (←)">◀</button>
            <button id="btn-play" title="Play / Pause (Space)">${inst && !inst.paused ? '⏸ Pause' : '▶ Play'}</button>
            <button id="btn-step-fwd" title="Step +1 Frame (→)">▶</button>
            <button id="btn-reverse" title="Reverse playback">⇄</button>
          </div>
          <div class="timecode" id="timecode">0000 / ${Math.round(dur)} ms</div>
          <div class="btn-group">
            ${[0.25, 0.5, 1, 2].map(r => `<button class="speed-btn ${inst && inst.speed === r ? 'active' : ''}" data-speed="${r}">${r}×</button>`).join('')}
          </div>
          <button id="btn-vclock" class="${isVirtual ? 'active' : ''}" title="Toggle deterministic virtual clock">V-Clock: ${isVirtual ? 'ON' : 'OFF'}</button>
          <select id="fps-select" title="Studio stepping & render FPS">
            ${[24, 30, 60, 120].map(f => `<option value="${f}" ${fps === f ? 'selected' : ''}>${f} fps</option>`).join('')}
          </select>
          <button id="btn-inspect" class="${this._inspectTargets ? 'active' : ''}" title="Highlight DOM targets on viewport">◎ Inspect</button>
          <div class="spacer"></div>
          <button id="btn-collapse">${this._collapsed ? '▲ Expand' : '▼ Collapse'}</button>
        </div>
        <div class="body">
          <div class="timeline-pane">
            <div class="timeline-subbar">
              <span>${entry ? `${entry.groups.length} track group(s) · ${entry.labels.length} label(s)` : 'Idle'} · Drag bar to shift offset, drag right edge to stretch</span>
              <label style="display:inline-flex;align-items:center;gap:5px;">
                Zoom
                <input id="zoom-range" type="range" min="1" max="5" step="0.25" value="${this._zoom}" style="width:70px">
                <span>${this._zoom}×</span>
              </label>
            </div>
            <div class="timeline-scroll" id="timeline-scroll">
              ${entry ? `
              <div class="timeline-grid" style="width: ${Math.round(100 * this._zoom)}%;">
                <div class="ruler-corner"><span>TRACK / TARGET</span><span>ms</span></div>
                <div class="ruler-track" id="ruler-track">
                  ${rulerTicksHtml}
                  <div class="playhead-line" id="playhead" style="left:0%">
                    <div class="playhead-head"></div>
                  </div>
                </div>
                ${tracksHtml}
              </div>
              ` : tracksHtml}
            </div>
          </div>
          <div class="inspector-pane">
            <div class="tabs">
              <button class="tab ${this._tab === 'curves' ? 'active' : ''}" data-tab="curves">Curves</button>
              <button class="tab ${this._tab === 'stagger' ? 'active' : ''}" data-tab="stagger">Stagger</button>
              <button class="tab ${this._tab === 'render' ? 'active' : ''}" data-tab="render">Render</button>
              <button class="tab ${this._tab === 'code' ? 'active' : ''}" data-tab="code">Code</button>
            </div>
            <div class="inspector-body">${inspectorHtml}</div>
          </div>
        </div>
      </div>
    `;

    this._playheadEl = this._shadow.querySelector('#playhead');
    this._timecodeEl = this._shadow.querySelector('#timecode');
    this._curveDotEl = this._shadow.querySelector('#curve-dot');
    this._overlayEl = this._shadow.querySelector('#overlay-layer');
    this._playBtnEl = this._shadow.querySelector('#btn-play');

    this._bindEvents(entry, group, tween, dur);
    this._updateLivePlayhead();
  }

  /**
   * @param  {Number} dur
   * @param  {StudioEntry|null} entry
   * @return {String}
   */
  _renderRulerTicks(dur, entry) {
    const rawStep = dur <= 300 ? 50 : dur <= 1200 ? 100 : dur <= 3000 ? 250 : dur <= 10000 ? 500 : Math.ceil(dur / 25 / 100) * 100;
    const step = Math.max(10, rawStep);
    let html = '';
    for (let t = 0; t <= dur; t += step) {
      const pct = (t / dur) * 100;
      html += `<div class="ruler-tick" style="left:${pct}%">${Math.round(t)}</div>`;
    }
    if (entry) {
      for (const lbl of entry.labels) {
        const pct = clamp(lbl.time / dur, 0, 1) * 100;
        html += `<div class="ruler-label" style="left:${pct}%" title="Label '${lbl.name}' @ ${Math.round(lbl.time)}ms">◆ ${lbl.name}</div>`;
      }
      for (const call of entry.calls) {
        const pct = clamp(call.time / dur, 0, 1) * 100;
        html += `<div class="ruler-call" style="left:${pct}%" title="Call '${call.name}' @ ${Math.round(call.time)}ms"></div>`;
      }
    }
    return html;
  }

  /**
   * @param  {StudioEntry} entry
   * @param  {StudioGroupTrack|null} selectedGroup
   * @param  {StudioTweenTrack|null} selectedTween
   * @param  {Number} dur
   * @return {String}
   */
  _renderTracks(entry, selectedGroup, selectedTween, dur) {
    return entry.groups.map((g, idx) => {
      const color = SPECTRUM[idx % SPECTRUM.length];
      const isSelected = selectedGroup && selectedGroup.uid === g.uid;
      const expanded = this._expandedGroups.has(g.uid);
      const startLeft = clamp(g.offset / dur, 0, 1) * 100;
      const totalWidth = clamp((g.delay + g.duration) / dur, 0.006, 1) * 100;
      const delayRatio = (g.delay + g.duration) > 0 ? (g.delay / (g.delay + g.duration)) * 100 : 0;
      const sparkPath = this._buildCurvePath(g.easing.fn, 100, 20, true);

      let rows = `
        <div class="track-label-cell ${isSelected ? 'selected' : ''}" data-select-group="${g.uid}">
          <span class="toggle-group" data-toggle-group="${g.uid}" style="color:#888;font-size:9px;width:10px">${expanded ? '▾' : '▸'}</span>
          <span class="track-dot" style="background:${color}"></span>
          <span class="track-name" title="${g.targetLabel}">${g.targetLabel}</span>
          <span class="track-prop-badge">${g.tweens.length}</span>
        </div>
        <div class="track-lane-cell">
          <div class="bar-wrap ${isSelected ? 'selected' : ''}" data-drag-group="${g.uid}" style="left:${startLeft}%;width:${totalWidth}%">
            ${g.delay > 0 ? `<div class="bar-delay" style="width:${delayRatio}%"></div>` : ''}
            <div class="bar-body" style="background:${color}">
              <svg class="bar-spark" viewBox="0 0 100 20" preserveAspectRatio="none">
                <path d="${sparkPath}" fill="none" stroke="#131212" stroke-width="1.6"/>
              </svg>
              <span class="bar-text">${Math.round(g.duration)}ms · ${g.easing.kind === 'spring' ? 'spring' : g.easing.label}</span>
              <div class="bar-resize" data-resize-group="${g.uid}" title="Drag to stretch duration"></div>
            </div>
          </div>
        </div>
      `;

      if (expanded) {
        const subLimit = g.tweens.slice(0, 24);
        for (const tw of subLimit) {
          const subSel = selectedTween && selectedTween.uid === tw.uid;
          const twLeft = clamp(tw.offset / dur, 0, 1) * 100;
          const twWidth = clamp((tw.delay + tw.duration) / dur, 0.004, 1) * 100;
          const twDelayPct = (tw.delay + tw.duration) > 0 ? (tw.delay / (tw.delay + tw.duration)) * 100 : 0;
          rows += `
            <div class="track-label-cell sub ${subSel ? 'selected' : ''}" data-select-tween="${tw.uid}" data-parent-group="${g.uid}">
              <span class="track-name" title="${tw.targetLabel}.${tw.property}">${tw.targetLabel} · <b>${tw.property}</b></span>
              <span class="track-prop-badge">${tw.toText}</span>
            </div>
            <div class="track-lane-cell sub">
              <div class="bar-wrap ${subSel ? 'selected' : ''}" data-select-tween="${tw.uid}" data-parent-group="${g.uid}" style="left:${twLeft}%;width:${twWidth}%;cursor:pointer">
                ${tw.delay > 0 ? `<div class="bar-delay" style="width:${twDelayPct}%"></div>` : ''}
                <div class="bar-body" style="background:${color};opacity:0.78">
                  <span class="bar-text" style="font-size:8px">${tw.property}: ${tw.fromText}→${tw.toText}</span>
                </div>
              </div>
            </div>
          `;
        }
      }

      return rows;
    }).join('');
  }

  /**
   * @param  {StudioEntry|null} entry
   * @param  {StudioGroupTrack|null} group
   * @param  {StudioTweenTrack|null} tween
   * @param  {Number} fps
   * @return {String}
   */
  _renderInspector(entry, group, tween, fps) {
    if (this._tab === 'render') {
      const filmHtml = this._renderState.filmstrip.length
        ? `<div class="filmstrip">${this._renderState.filmstrip.map(item => `
            <div class="film-thumb" data-seek-ms="${item.timeMs}">
              <img src="${item.url}" alt="Frame ${item.frame}"/>
              <span>F${item.frame} · ${Math.round(item.timeMs)}ms</span>
            </div>
          `).join('')}</div>`
        : '<div style="color:var(--muted);font-size:10px">Capture a deterministic filmstrip or export WebM/PNG frames from any Canvas, SVG, or DOM target.</div>';

      return `
        <div class="form-grid">
          <div class="field">
            <label>Source Target</label>
            <select id="render-source">
              <option value="auto">Auto (Canvas / SVG / Body)</option>
              <option value="canvas">First &lt;canvas&gt;</option>
              <option value="svg">First &lt;svg&gt;</option>
              <option value="body">Document Body</option>
            </select>
          </div>
          <div class="field">
            <label>FPS</label>
            <input id="render-fps" type="number" min="1" max="120" value="${fps}"/>
          </div>
          <div class="field">
            <label>Duration (ms)</label>
            <input id="render-dur" type="number" min="50" step="50" value="${entry ? Math.round(this._getCycleDuration(entry.instance)) : 1000}"/>
          </div>
        </div>
        <div class="btn-group" style="flex-wrap:wrap">
          <button id="btn-filmstrip">🎞 Capture Filmstrip (8f)</button>
          <button id="btn-export-webm" class="primary">🎬 Export WebM Video</button>
          <button id="btn-export-pngs">🖼 Export PNG Frames</button>
        </div>
        ${this._renderState.status ? `<div class="status-pill">${this._renderState.status}</div>` : ''}
        ${this._renderState.videoUrl ? `
          <div style="display:flex;flex-direction:column;gap:4px">
            <video src="${this._renderState.videoUrl}" controls loop muted playsinline style="width:100%;max-height:130px;background:#000;border-radius:4px;border:1px solid var(--border)"></video>
            <a href="${this._renderState.videoUrl}" download="anime-studio-render.webm" style="color:var(--green);font-size:10px;text-decoration:none">⬇ Download anime-studio-render.webm</a>
          </div>
        ` : ''}
        ${filmHtml}
      `;
    }

    if (this._tab === 'code') {
      const code = this._codeMode === 'json'
        ? JSON.stringify(generateBlueprintJSON(entry), null, 2)
        : generateAnimeCode(entry);
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <div class="btn-group">
            <button id="btn-code-esm" class="${this._codeMode === 'esm' ? 'active' : ''}">Anime v4 ESM</button>
            <button id="btn-code-json" class="${this._codeMode === 'json' ? 'active' : ''}">JSON Blueprint</button>
          </div>
          <button id="btn-copy-code" class="primary">Copy</button>
        </div>
        <pre class="code-block">${code.replace(/</g, '&lt;')}</pre>
      `;
    }

    if (!entry || !group) {
      return '<div class="empty-state">No track selected.</div>';
    }

    if (this._tab === 'stagger') {
      // Group tweens by target index (aggregating staggered sibling groups if created from stagger())
      const staggerGroups = group.staggerKey
        ? entry.groups.filter(g => g.staggerKey === group.staggerKey)
        : [group];
      /** @type {Map<String, { label: String, offset: Number, end: Number, target: any }>} */
      const perTarget = new Map();
      let maxEnd = 1;
      for (const g of staggerGroups) {
        for (const tw of g.tweens) {
          const start = tw.offset + tw.delay;
          const end = start + tw.duration;
          if (end > maxEnd) maxEnd = end;
          const key = staggerGroups.length > 1 ? `${g.uid}:${tw.targetIndex}` : String(tw.targetIndex);
          const prev = perTarget.get(key);
          if (!prev || start < prev.offset) {
            perTarget.set(key, { label: tw.targetLabel, offset: start, end, target: tw.target });
          }
        }
      }
      const rows = Array.from(perTarget.values()).sort((a, b) => a.offset - b.offset);
      const minStart = rows.reduce((m, r) => Math.min(m, r.offset), Infinity);
      const maxStart = rows.reduce((m, r) => Math.max(m, r.offset), minStart + 1);

      return `
        <div style="color:var(--muted);font-size:10px">${rows.length} target(s) in "${group.targetLabel}" · Waterfall & Delay Cascade</div>
        <div class="stagger-list">
          ${rows.slice(0, 32).map((item, idx) => {
            const leftPct = (item.offset / maxEnd) * 100;
            const widthPct = Math.max(2, ((item.end - item.offset) / maxEnd) * 100);
            const norm = (item.offset - minStart) / Math.max(1, maxStart - minStart);
            const col = SPECTRUM[Math.min(SPECTRUM.length - 1, Math.floor(norm * (SPECTRUM.length - 1)))];
            return `
              <div class="stagger-row">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">#${idx} ${item.label}</span>
                <div class="stagger-bar-bg">
                  <div class="stagger-bar-fill" style="left:${leftPct}%;width:${widthPct}%;background:${col}"></div>
                </div>
                <span style="text-align:right;color:var(--muted)">+${Math.round(item.offset)}ms</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Default tab: 'curves'
    const activeEase = (tween ? tween.easing : group.easing);
    const curvePath = this._buildCurvePath(activeEase.fn, 180, 180, false);
    const isBezier = activeEase.kind === 'bezier' && activeEase.bezier;
    const isSpring = activeEase.kind === 'spring' && activeEase.spring;
    const cb = isBezier ? activeEase.bezier : [0.22, 1, 0.36, 1];
    const sp = isSpring ? activeEase.spring : { bounce: 0.45, duration: 628, mass: 1, stiffness: 100, damping: 10, settlingDuration: 628 };

    return `
      <div class="form-grid">
        <div class="field">
          <label>Offset (ms)</label>
          <input id="inp-offset" type="number" min="0" step="10" value="${round(group.offset, 1)}"/>
        </div>
        <div class="field">
          <label>Duration (ms)</label>
          <input id="inp-duration" type="number" min="10" step="10" value="${round(group.duration, 1)}"/>
        </div>
        <div class="field">
          <label>${tween ? tween.property : 'Target'}</label>
          <input type="text" readonly value="${tween ? `${tween.fromText} → ${tween.toText}` : group.targetLabel}"/>
        </div>
      </div>

      <div class="preset-row">
        ${EASING_PRESETS.map(p => {
          const active = (p.kind === 'bezier' && isBezier) || (p.kind === 'spring' && isSpring) || (p.value === activeEase.label);
          return `<button class="ease-preset ${active ? 'active' : ''}" data-preset-kind="${p.kind}" data-preset-val="${p.value}">${p.label}</button>`;
        }).join('')}
      </div>

      <div class="curve-box">
        <svg class="curve-svg" id="curve-svg" viewBox="-16 -45 212 270">
          <rect x="0" y="0" width="180" height="180" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)"/>
          <line x1="0" y1="90" x2="180" y2="90" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3"/>
          <line x1="90" y1="0" x2="90" y2="180" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3"/>
          <line x1="0" y1="180" x2="180" y2="0" stroke="rgba(255,255,255,0.12)"/>
          <path d="${curvePath}" fill="none" stroke="#3CFFEC" stroke-width="2.2"/>
          ${isBezier ? `
            <line x1="0" y1="180" x2="${cb[0] * 180}" y2="${180 - cb[1] * 180}" stroke="#FB89FB" stroke-width="1.2" stroke-dasharray="3 2"/>
            <line x1="180" y1="0" x2="${cb[2] * 180}" y2="${180 - cb[3] * 180}" stroke="#F6FF56" stroke-width="1.2" stroke-dasharray="3 2"/>
            <circle class="bezier-handle" data-handle="1" cx="${cb[0] * 180}" cy="${180 - cb[1] * 180}" r="6" fill="#FB89FB" stroke="#131212" stroke-width="1.5"/>
            <circle class="bezier-handle" data-handle="2" cx="${cb[2] * 180}" cy="${180 - cb[3] * 180}" r="6" fill="#F6FF56" stroke="#131212" stroke-width="1.5"/>
          ` : ''}
          <circle id="curve-dot" cx="0" cy="180" r="4.5" fill="#FF4B4B" stroke="#F6F4F2" stroke-width="1.2"/>
        </svg>
        <div class="curve-meta">
          <div style="color:var(--ink);font-weight:700;word-break:break-word">${activeEase.label}</div>
          ${isBezier ? `
            <div style="color:var(--muted);font-size:10px">Drag pink (P1) & yellow (P2) handles on the graph</div>
            <div class="slider-row"><span>x1</span><input class="cb-slider" data-cb="0" type="range" min="0" max="1" step="0.01" value="${cb[0]}"><span>${round(cb[0], 2)}</span></div>
            <div class="slider-row"><span>y1</span><input class="cb-slider" data-cb="1" type="range" min="-0.5" max="1.5" step="0.01" value="${cb[1]}"><span>${round(cb[1], 2)}</span></div>
            <div class="slider-row"><span>x2</span><input class="cb-slider" data-cb="2" type="range" min="0" max="1" step="0.01" value="${cb[2]}"><span>${round(cb[2], 2)}</span></div>
            <div class="slider-row"><span>y2</span><input class="cb-slider" data-cb="3" type="range" min="-0.5" max="1.5" step="0.01" value="${cb[3]}"><span>${round(cb[3], 2)}</span></div>
          ` : isSpring ? `
            <div class="slider-row"><span>Bounce</span><input id="sp-bounce" type="range" min="-0.5" max="0.95" step="0.01" value="${sp.bounce}"><span>${round(sp.bounce, 2)}</span></div>
            <div class="slider-row"><span>Duration</span><input id="sp-dur" type="range" min="150" max="2000" step="10" value="${sp.duration}"><span>${Math.round(sp.duration)}</span></div>
            <div style="color:var(--green);font-size:10px">Settling duration: ${Math.round(sp.settlingDuration)}ms</div>
          ` : `
            <div style="color:var(--muted);font-size:10px">Click "bezier" or "spring" above for interactive curve handle editing.</div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * @param  {StudioEntry|null} entry
   * @param  {StudioGroupTrack|null} group
   * @param  {StudioTweenTrack|null} tween
   * @param  {Number} dur
   * @return {void}
   */
  _bindEvents(entry, group, tween, dur) {
    const s = this._shadow;
    const store = this._store;
    const studio = this._studio;

    const entrySel = /** @type {HTMLSelectElement|null} */(s.querySelector('#entry-select'));
    if (entrySel) {
      entrySel.onchange = () => {
        store.selectedEntryId = entrySel.value || null;
        store.selectedGroupUid = null;
        store.selectedTweenUid = null;
        this.render();
      };
    }

    const bindClick = (sel, fn) => {
      const el = s.querySelector(sel);
      if (el) el.addEventListener('click', fn);
    };

    bindClick('#btn-play', () => studio.togglePlay());
    bindClick('#btn-reset', () => studio.restart());
    bindClick('#btn-step-back', () => studio.stepFrame(-1));
    bindClick('#btn-step-fwd', () => studio.stepFrame(1));
    bindClick('#btn-reverse', () => studio.reverse());
    bindClick('#btn-vclock', () => {
      studio.setVirtualClock(!engine.isVirtual);
      this.render();
    });
    bindClick('#btn-inspect', () => {
      this._inspectTargets = !this._inspectTargets;
      this.render();
    });
    bindClick('#btn-collapse', () => {
      this._collapsed = !this._collapsed;
      this.render();
    });

    const fpsSel = /** @type {HTMLSelectElement|null} */(s.querySelector('#fps-select'));
    if (fpsSel) {
      fpsSel.onchange = () => {
        studio.setFps(Number(fpsSel.value));
        this.render();
      };
    }

    s.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (entry) {
          entry.instance.speed = Number(/** @type {HTMLElement} */(btn).dataset.speed);
          this.render();
        }
      });
    });

    s.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._tab = /** @type {HTMLElement} */(btn).dataset.tab || 'curves';
        this.render();
      });
    });

    const zoomRange = /** @type {HTMLInputElement|null} */(s.querySelector('#zoom-range'));
    if (zoomRange) {
      zoomRange.oninput = () => {
        this._zoom = Number(zoomRange.value) || 1;
        this.render();
      };
    }

    // Resize dock height
    const resizeHandle = s.querySelector('#resize-handle');
    if (resizeHandle) {
      resizeHandle.addEventListener('pointerdown', ev => {
        const startY = /** @type {PointerEvent} */(ev).clientY;
        const startH = this._height;
        const onMove = mv => {
          this._height = clamp(startH + (startY - mv.clientY), 160, Math.max(260, window.innerHeight - 120));
          const body = /** @type {HTMLElement|null} */(s.querySelector('.body'));
          if (body) body.style.setProperty('--studio-height', `${this._height}px`);
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
    }

    // Ruler scrub
    const ruler = /** @type {HTMLElement|null} */(s.querySelector('#ruler-track'));
    if (ruler && entry) {
      const scrubAt = clientX => {
        const rect = ruler.getBoundingClientRect();
        const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
        studio.seek(ratio * dur);
      };
      ruler.addEventListener('pointerdown', ev => {
        const pe = /** @type {PointerEvent} */(ev);
        scrubAt(pe.clientX);
        const onMove = mv => scrubAt(mv.clientX);
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
    }

    // Select & toggle groups / sub-tweens
    s.querySelectorAll('[data-toggle-group]').forEach(el => {
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        const uid = /** @type {HTMLElement} */(el).dataset.toggleGroup;
        if (this._expandedGroups.has(uid)) this._expandedGroups.delete(uid);
        else this._expandedGroups.add(uid);
        this.render();
      });
    });

    s.querySelectorAll('[data-select-group]').forEach(el => {
      el.addEventListener('click', () => {
        store.selectedGroupUid = /** @type {HTMLElement} */(el).dataset.selectGroup || null;
        store.selectedTweenUid = null;
        this.render();
      });
    });

    s.querySelectorAll('[data-select-tween]').forEach(el => {
      el.addEventListener('click', () => {
        const he = /** @type {HTMLElement} */(el);
        store.selectedGroupUid = he.dataset.parentGroup || null;
        store.selectedTweenUid = he.dataset.selectTween || null;
        this.render();
      });
    });

    // Drag bar horizontally to shift offset, or drag right edge to stretch duration
    if (entry) {
      s.querySelectorAll('[data-drag-group]').forEach(barEl => {
        barEl.addEventListener('pointerdown', ev => {
          const pe = /** @type {PointerEvent} */(ev);
          const uid = /** @type {HTMLElement} */(barEl).dataset.dragGroup;
          const g = entry.groups.find(item => item.uid === uid);
          if (!g) return;
          store.selectedGroupUid = uid;
          store.selectedTweenUid = null;

          const isResize = /** @type {HTMLElement} */(pe.target).classList.contains('bar-resize');
          const lane = barEl.parentElement;
          const laneWidth = lane ? lane.getBoundingClientRect().width : 400;
          const startX = pe.clientX;
          const initOffset = g.offset;
          const initDur = g.duration;

          const onMove = mv => {
            const dx = mv.clientX - startX;
            const deltaMs = (dx / Math.max(1, laneWidth)) * dur;
            if (isResize) {
              store.updateGroupDuration(entry.id, uid, initDur + deltaMs);
            } else {
              store.updateGroupOffset(entry.id, uid, initOffset + deltaMs);
            }
          };
          const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
          };
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        });
      });
    }

    // Inspector numeric edits
    const inpOffset = /** @type {HTMLInputElement|null} */(s.querySelector('#inp-offset'));
    if (inpOffset && entry && group) {
      inpOffset.onchange = () => store.updateGroupOffset(entry.id, group.uid, Number(inpOffset.value));
    }
    const inpDur = /** @type {HTMLInputElement|null} */(s.querySelector('#inp-duration'));
    if (inpDur && entry && group) {
      inpDur.onchange = () => store.updateGroupDuration(entry.id, group.uid, Number(inpDur.value));
    }

    // Easing presets
    if (entry && group) {
      s.querySelectorAll('.ease-preset').forEach(btn => {
        btn.addEventListener('click', () => {
          const he = /** @type {HTMLElement} */(btn);
          const kind = /** @type {'ease'|'bezier'|'spring'} */(he.dataset.presetKind || 'ease');
          const value = he.dataset.presetVal || 'out(2)';
          store.updateEasing(entry.id, group.uid, tween ? tween.uid : null, { kind, value }, true);
        });
      });

      // Cubic bezier sliders & draggable SVG handles
      const activeEase = tween ? tween.easing : group.easing;
      if (activeEase.kind === 'bezier' && activeEase.bezier) {
        const cb = [...activeEase.bezier];
        s.querySelectorAll('.cb-slider').forEach(inp => {
          inp.addEventListener('input', () => {
            const idx = Number(/** @type {HTMLElement} */(inp).dataset.cb);
            cb[idx] = Number(/** @type {HTMLInputElement} */(inp).value);
            store.updateEasing(entry.id, group.uid, tween ? tween.uid : null, {
              kind: 'bezier',
              bezier: /** @type {[Number, Number, Number, Number]} */(cb),
            }, true);
          });
        });

        const svg = /** @type {SVGSVGElement|null} */(s.querySelector('#curve-svg'));
        if (svg) {
          s.querySelectorAll('.bezier-handle').forEach(h => {
            h.addEventListener('pointerdown', ev => {
              const handleIdx = Number(/** @type {HTMLElement} */(h).dataset.handle);
              const rect = svg.getBoundingClientRect();
              const updateFromPointer = mv => {
                // Map screen coords into SVG viewBox (-16 -45 212 270) where graph box is (0..180, 0..180)
                const vbX = ((mv.clientX - rect.left) / rect.width) * 212 - 16;
                const vbY = ((mv.clientY - rect.top) / rect.height) * 270 - 45;
                const nx = round(clamp(vbX / 180, 0, 1), 2);
                const ny = round(clamp((180 - vbY) / 180, -0.5, 1.5), 2);
                if (handleIdx === 1) { cb[0] = nx; cb[1] = ny; }
                else { cb[2] = nx; cb[3] = ny; }
                store.updateEasing(entry.id, group.uid, tween ? tween.uid : null, {
                  kind: 'bezier',
                  bezier: /** @type {[Number, Number, Number, Number]} */(cb),
                }, true);
              };
              const onUp = () => {
                window.removeEventListener('pointermove', updateFromPointer);
                window.removeEventListener('pointerup', onUp);
              };
              window.addEventListener('pointermove', updateFromPointer);
              window.addEventListener('pointerup', onUp);
            });
          });
        }
      }

      // Spring live sliders
      const spBounce = /** @type {HTMLInputElement|null} */(s.querySelector('#sp-bounce'));
      const spDur = /** @type {HTMLInputElement|null} */(s.querySelector('#sp-dur'));
      if (spBounce && spDur) {
        const applySpring = () => {
          store.updateEasing(entry.id, group.uid, tween ? tween.uid : null, {
            kind: 'spring',
            spring: { bounce: Number(spBounce.value), duration: Number(spDur.value) },
          }, true);
        };
        spBounce.oninput = applySpring;
        spDur.oninput = applySpring;
      }
    }

    // Code tab buttons
    bindClick('#btn-code-esm', () => { this._codeMode = 'esm'; this.render(); });
    bindClick('#btn-code-json', () => { this._codeMode = 'json'; this.render(); });
    bindClick('#btn-copy-code', async () => {
      const code = this._codeMode === 'json'
        ? JSON.stringify(generateBlueprintJSON(entry), null, 2)
        : generateAnimeCode(entry);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
        const btn = s.querySelector('#btn-copy-code');
        if (btn) {
          btn.textContent = 'Copied!';
          setTimeout(() => { if (btn) btn.textContent = 'Copy'; }, 1200);
        }
      }
    });

    // Render / Export tab buttons
    const resolveRenderTargets = () => {
      const studioFps = studio ? studio.fps : 60;
      const srcMode = /** @type {HTMLSelectElement|null} */(s.querySelector('#render-source'))?.value || 'auto';
      const rf = Number(/** @type {HTMLInputElement|null} */(s.querySelector('#render-fps'))?.value || studioFps);
      const rDur = Number(/** @type {HTMLInputElement|null} */(s.querySelector('#render-dur'))?.value || dur);
      const canvasEl = /** @type {HTMLCanvasElement|null} */(doc.querySelector('canvas'));
      const svgEl = /** @type {SVGElement|null} */(doc.querySelector('svg:not(.curve-svg):not(.bar-spark)'));
      /** @type {HTMLCanvasElement|null} */
      let canvas = null;
      /** @type {HTMLElement|SVGElement|null} */
      let domTarget = null;
      if (srcMode === 'canvas' || (srcMode === 'auto' && canvasEl)) {
        canvas = canvasEl;
      } else if (srcMode === 'svg' || (srcMode === 'auto' && svgEl)) {
        domTarget = svgEl;
      } else {
        domTarget = doc.body;
      }
      return {
        fps: rf,
        duration: rDur,
        canvas,
        domTarget,
        width: canvas ? canvas.width : (domTarget ? Math.max(320, Math.round(domTarget.getBoundingClientRect().width)) : 1280),
        height: canvas ? canvas.height : (domTarget ? Math.max(240, Math.round(domTarget.getBoundingClientRect().height)) : 720),
      };
    };

    bindClick('#btn-filmstrip', async () => {
      if (!entry) return;
      const cfg = resolveRenderTargets();
      this._renderState.status = 'Capturing deterministic filmstrip...';
      this.render();
      const session = createRenderSession({
        target: entry.instance,
        fps: cfg.fps,
        duration: cfg.duration,
        canvas: cfg.canvas || undefined,
        domTarget: cfg.canvas ? undefined : cfg.domTarget,
        width: cfg.width,
        height: cfg.height,
        background: cfg.canvas ? undefined : '#131212',
      });
      try {
        const thumbs = [];
        const steps = 8;
        for (let i = 0; i < steps; i++) {
          const f = Math.round((i / Math.max(1, steps - 1)) * Math.max(0, session.totalFrames - 1));
          const info = session.seekFrame(f, false);
          const snap = await session._snapshotCurrentCanvas();
          const url = /** @type {HTMLCanvasElement} */(snap).toDataURL ? /** @type {HTMLCanvasElement} */(snap).toDataURL('image/png') : '';
          thumbs.push({ frame: info.frame, timeMs: info.timeMs, url });
        }
        this._renderState.filmstrip = thumbs;
        this._renderState.status = `Captured ${thumbs.length} deterministic frames @ ${cfg.fps}fps`;
      } catch (err) {
        this._renderState.status = `Error: ${err.message}`;
      } finally {
        session.dispose();
        this.render();
      }
    });

    s.querySelectorAll('[data-seek-ms]').forEach(el => {
      el.addEventListener('click', () => {
        const t = Number(/** @type {HTMLElement} */(el).dataset.seekMs || 0);
        studio.seek(t);
      });
    });

    bindClick('#btn-export-webm', async () => {
      if (!entry) return;
      const cfg = resolveRenderTargets();
      this._renderState.status = 'Encoding WebM via WebCodecs...';
      this.render();
      const session = createRenderSession({
        target: entry.instance,
        fps: cfg.fps,
        duration: cfg.duration,
        canvas: cfg.canvas || undefined,
        domTarget: cfg.canvas ? undefined : cfg.domTarget,
        width: cfg.width,
        height: cfg.height,
        background: cfg.canvas ? undefined : '#131212',
      });
      try {
        const res = await session.exportWebM({
          onProgress: p => {
            const pill = s.querySelector('.status-pill');
            if (pill) pill.textContent = `Encoding WebM: ${Math.round(p * 100)}%`;
          },
        });
        this._renderState.videoUrl = res.url;
        this._renderState.status = `Exported ${res.frames} frames (${res.codec}, ${(res.blob.size / 1024).toFixed(1)} KB)`;
      } catch (err) {
        this._renderState.status = `WebM Error: ${err.message}`;
      } finally {
        session.dispose();
        this.render();
      }
    });

    bindClick('#btn-export-pngs', async () => {
      if (!entry) return;
      const cfg = resolveRenderTargets();
      this._renderState.status = 'Exporting PNG frames...';
      this.render();
      const session = createRenderSession({
        target: entry.instance,
        fps: cfg.fps,
        duration: cfg.duration,
        canvas: cfg.canvas || undefined,
        domTarget: cfg.canvas ? undefined : cfg.domTarget,
        width: cfg.width,
        height: cfg.height,
        background: cfg.canvas ? undefined : '#131212',
      });
      try {
        const frames = await session.exportFrames({ format: 'png' });
        this._renderState.status = `Rendered ${frames.length} PNG frame Blobs (${Math.round(frames.reduce((a, f) => a + f.blob.size, 0) / 1024)} KB total)`;
      } catch (err) {
        this._renderState.status = `PNG Error: ${err.message}`;
      } finally {
        session.dispose();
        this.render();
      }
    });
  }
}

/**
 * Registers `<anime-studio>` custom element once in browser environments.
 *
 * @return {void}
 */
export const ensureStudioElementDefined = () => {
  if (!isBrowser || typeof customElements === 'undefined') return;
  if (!customElements.get('anime-studio')) {
    customElements.define('anime-studio', AnimeStudioElement);
  }
};
