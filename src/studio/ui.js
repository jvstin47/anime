import { isBrowser, doc, isDomSymbol, isSvgSymbol } from '../core/consts.js';
import { clamp, round } from '../core/helpers.js';
import { engine } from '../engine/engine.js';
import { createRenderSession } from '../render/index.js';
import { EASING_PRESETS, sampleEaseCurve } from './easings-bridge.js';
import { generateAnimeCode, generateBlueprintJSON } from './codegen.js';
import { ICONS } from './icons.js';
import { STUDIO_STYLES } from './styles.js';

/**
 * @import {
 *   StudioStore,
 *   StudioEntry,
 *   StudioLayerNode,
 *   StudioGroupTrack,
 *   StudioTweenTrack,
 *   StudioPropertySummary,
 * } from './store.js'
 */

const TRACK_COLORS = {
  position: '#4A9EFF',
  rotation: '#A371F7',
  scale: '#3FB950',
  animation: '#D29922',
  stagger: '#56B6C2',
};

const BaseElement = /** @type {typeof HTMLElement} */(
  typeof HTMLElement !== 'undefined' ? HTMLElement : class {}
);

/**
 * Desktop NLE / Motion-Editor Shadow DOM Component (`<anime-studio>`) for Anime.js v4.
 * Supports both full-viewport `mode="workspace"` and compact bottom-docked `mode="dock"`.
 */
export class AnimeStudioElement extends BaseElement {
  constructor() {
    super();
    /** @type {StudioStore|null} */
    this._store = null;
    /** @type {any} */
    this._studio = null;

    /** @type {'workspace'|'dock'} */
    this._mode = 'dock';
    this._collapsed = false;
    this._leftCollapsed = false;
    this._rightCollapsed = false;
    this._leftWidth = 244;
    this._rightWidth = 304;
    this._timelineHeight = 256;

    // Timeline view state
    this._tlZoom = 1;
    this._trackSize = 'normal'; // 'compact' | 'normal' | 'expanded'
    this._expandedLayers = new Set();
    this._layerSearch = '';

    // Canvas viewport state (workspace mode)
    this._canvasZoom = 1;
    this._canvasPanX = 0;
    this._canvasPanY = 0;
    this._showGrid = true;
    this._showGuides = false;
    this._panTool = false;
    this._inspectTargets = false;
    this._stageWidth = 960;
    this._stageHeight = 540;

    // Collapsible Inspector sections
    this._collapsedSections = new Set();

    // Export modal state
    this._exportOpen = false;
    this._exportTab = 'video'; // 'video' | 'frames' | 'code'
    this._codeMode = 'esm';
    this._renderState = { status: '', videoUrl: '', filmstrip: [] };

    this._rafId = 0;
    this._suspendStoreRender = false;

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
   * @param  {{ mode?: 'workspace'|'dock', stageWidth?: Number, stageHeight?: Number }} [opts]
   * @return {void}
   */
  bind(store, studio, opts = {}) {
    this._store = store;
    this._studio = studio;
    this._mode = opts.mode === 'workspace' ? 'workspace' : 'dock';
    if (opts.stageWidth) this._stageWidth = opts.stageWidth;
    if (opts.stageHeight) this._stageHeight = opts.stageHeight;
    this.setAttribute('mode', this._mode);

    this._unsubscribe = store.subscribe(() => {
      if (!this._suspendStoreRender) this.render();
    });

    this.render();
    this._startRaf();
    if (this._mode === 'workspace' && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.fitCanvasToScreen());
    }
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

  /** @param {any} inst @return {Number} */
  _getCycleDuration(inst) {
    if (!inst) return 1000;
    const isInf = inst.iterationCount === Infinity || inst.duration >= 1e11;
    const d = isInf ? inst.iterationDuration : inst.duration;
    return Math.max(1, d || inst.iterationDuration || 1);
  }

  /** Updates playhead, timecode, curve progress dot, and DOM bounding boxes at 60fps with zero re-render. */
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
      const secs = (cur / 1000).toFixed(3).padStart(6, '0');
      this._timecodeEl.innerHTML = `<span>${secs}s</span><span class="timecode-sub">${Math.round(cur)} / ${Math.round(dur)} ms · F${curFrame}/${totalFrames}</span>`;
    }

    if (this._playheadEl) {
      const pct = clamp(cur / dur, 0, 1) * 100;
      this._playheadEl.style.left = `${pct}%`;
    }

    if (this._playBtnEl) {
      this._playBtnEl.innerHTML = inst.paused ? ICONS.play : ICONS.pause;
      this._playBtnEl.title = inst.paused ? 'Play (Space)' : 'Pause (Space)';
      this._playBtnEl.classList.toggle('active', !inst.paused);
    }

    if (this._curveDotEl && tween) {
      const twStart = tween.offset + tween.delay;
      const twDur = Math.max(1, tween.duration);
      const t = clamp((cur - twStart) / twDur, 0, 1);
      const y = tween.easing.fn ? tween.easing.fn(t) : t;
      this._curveDotEl.setAttribute('cx', String(t * 160));
      this._curveDotEl.setAttribute('cy', String(130 - clamp(y, -0.25, 1.25) * 110));
    }

    this._renderTargetHighlights();
  }

  /** Renders viewport bounding-box overlays when Inspect is active. */
  _renderTargetHighlights() {
    if (!this._overlayEl || !this._store) return;
    if (!this._inspectTargets || this._collapsed) {
      if (this._overlayEl.childElementCount) this._overlayEl.innerHTML = '';
      return;
    }
    const { layer } = this._store.getSelection();
    if (!layer || !layer.targets.length) {
      if (this._overlayEl.childElementCount) this._overlayEl.innerHTML = '';
      return;
    }
    const domTargets = layer.targets.filter(t =>
      t && (t[isDomSymbol] || t[isSvgSymbol] || (typeof Element !== 'undefined' && t instanceof Element))
    );
    if (!domTargets.length) {
      if (this._overlayEl.childElementCount) this._overlayEl.innerHTML = '';
      return;
    }

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

  /** Computes fit-to-screen zoom for the central canvas viewport. */
  fitCanvasToScreen() {
    if (!this._shadow || this._mode !== 'workspace') return;
    const wrap = /** @type {HTMLElement|null} */(this._shadow.querySelector('.canvas-stage-wrap'));
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const availW = Math.max(120, rect.width - 48);
    const availH = Math.max(120, rect.height - 48);
    const scale = Math.min(availW / this._stageWidth, availH / this._stageHeight, 1.5);
    this._canvasZoom = Math.max(0.25, round(scale, 2));
    this._canvasPanX = 0;
    this._canvasPanY = 0;
    this._applyCanvasTransform();
  }

  /** Updates composition viewport transform without triggering a full DOM render. */
  _applyCanvasTransform() {
    if (!this._shadow) return;
    const vp = /** @type {HTMLElement|null} */(this._shadow.querySelector('.composition-viewport'));
    const zoomReadout = /** @type {HTMLElement|null} */(this._shadow.querySelector('#canvas-zoom-label'));
    if (vp) {
      vp.style.width = `${this._stageWidth}px`;
      vp.style.height = `${this._stageHeight}px`;
      vp.style.transform = `translate(${this._canvasPanX}px, ${this._canvasPanY}px) scale(${this._canvasZoom})`;
    }
    if (zoomReadout) {
      zoomReadout.textContent = `${Math.round(this._canvasZoom * 100)}%`;
    }
  }

  /**
   * Generates an SVG path `d` attribute string for an easing function.
   *
   * @param  {(t: Number) => Number} easeFn
   * @param  {Number} w
   * @param  {Number} h
   * @param  {Boolean} [fitBounds=false]
   * @param  {Number} [yOffset=0]
   * @return {String}
   */
  _buildCurvePath(easeFn, w, h, fitBounds = false, yOffset = 0) {
    const { points, minY, maxY } = sampleEaseCurve(easeFn, 48);
    const y0 = fitBounds ? Math.min(0, minY) : 0;
    const y1 = fitBounds ? Math.max(1, maxY) : 1;
    const span = Math.max(0.001, y1 - y0);
    return points.map((pt, idx) => {
      const x = round(pt.t * w, 2);
      const y = round(yOffset + h - ((pt.y - y0) / span) * h, 2);
      return `${idx === 0 ? 'M' : 'L'}${x} ${y}`;
    }).join(' ');
  }

  /** Full Shadow DOM render (called only on structural/state changes, never during RAF). */
  render() {
    if (!this._shadow || !this._store) return;
    const store = this._store;
    const { entry, layer, group, tween } = store.getSelection();
    const entries = Array.from(store.entries.values());
    const inst = entry ? entry.instance : null;
    const dur = this._getCycleDuration(inst);
    const fps = this._studio ? this._studio.fps : 60;

    // Preserve timeline scroll positions across re-renders
    const prevTreeScroll = this._shadow.querySelector('#tl-tree-body')?.scrollTop || 0;
    const prevLaneScrollTop = this._shadow.querySelector('#tl-lanes-pane')?.scrollTop || 0;
    const prevLaneScrollLeft = this._shadow.querySelector('#tl-lanes-pane')?.scrollLeft || 0;

    const rowHeight = this._trackSize === 'compact' ? 23 : this._trackSize === 'expanded' ? 34 : 28;
    const subHeight = this._trackSize === 'compact' ? 20 : this._trackSize === 'expanded' ? 27 : 23;

    const gridStyle = this._mode === 'workspace'
      ? `--left-w: ${this._leftCollapsed ? 0 : this._leftWidth}px; --right-w: ${this._rightCollapsed ? 0 : this._rightWidth}px; --timeline-h: ${this._timelineHeight}px; --track-row-h: ${rowHeight}px; --track-sub-h: ${subHeight}px; grid-template-columns: ${this._leftCollapsed ? '0px 0px' : `${this._leftWidth}px 4px`} minmax(320px, 1fr) ${this._rightCollapsed ? '0px 0px' : `4px ${this._rightWidth}px`};`
      : `--left-w: ${this._leftCollapsed ? 0 : 210}px; --right-w: ${this._rightCollapsed ? 0 : 296}px; --timeline-h: ${this._timelineHeight}px; --track-row-h: ${rowHeight}px; --track-sub-h: ${subHeight}px;`;

    const bodyHtml = this._mode === 'workspace'
      ? `
        <div class="shell-workspace" style="${gridStyle}">
          ${this._renderAppHeader(entries, entry)}
          ${this._renderLeftSidebar(entry, layer)}
          <div class="splitter-v" id="split-left" style="grid-area: split-l; ${this._leftCollapsed ? 'display:none' : ''}"></div>
          ${this._renderCenterCanvas()}
          <div class="splitter-v" id="split-right" style="grid-area: split-r; ${this._rightCollapsed ? 'display:none' : ''}"></div>
          ${this._renderRightInspector(entry, layer, group, tween)}
          <div class="splitter-h" id="split-timeline" style="grid-area: split-t;"></div>
          ${this._renderBottomTimeline(entry, layer, group, tween, dur, fps)}
        </div>
      `
      : `
        <div class="shell-dock ${this._collapsed ? 'collapsed' : ''}" style="${gridStyle}">
          <div class="splitter-h" id="split-timeline"></div>
          ${this._renderDockHeader(entries, entry)}
          <div class="dock-grid">
            ${this._renderLeftSidebar(entry, layer)}
            ${this._renderBottomTimeline(entry, layer, group, tween, dur, fps)}
            ${this._renderRightInspector(entry, layer, group, tween)}
          </div>
        </div>
      `;

    this._shadow.innerHTML = `
      <style>${STUDIO_STYLES}</style>
      <div class="overlay-layer" id="overlay-layer"></div>
      ${bodyHtml}
      ${this._exportOpen ? this._renderExportModal(entry, dur, fps) : ''}
    `;

    this._playheadEl = this._shadow.querySelector('#playhead');
    this._timecodeEl = this._shadow.querySelector('#timecode');
    this._curveDotEl = this._shadow.querySelector('#curve-dot');
    this._overlayEl = this._shadow.querySelector('#overlay-layer');
    this._playBtnEl = this._shadow.querySelector('#btn-play');

    // Restore timeline scroll coordinates
    const treeBody = this._shadow.querySelector('#tl-tree-body');
    const lanesPane = this._shadow.querySelector('#tl-lanes-pane');
    if (treeBody) treeBody.scrollTop = prevTreeScroll;
    if (lanesPane) {
      lanesPane.scrollTop = prevLaneScrollTop;
      lanesPane.scrollLeft = prevLaneScrollLeft;
    }

    this._bindEvents(entry, layer, group, tween, dur, fps);
    if (this._mode === 'workspace') this._applyCanvasTransform();
    this._updateLivePlayhead();
  }

  /**
   * @param  {Array<StudioEntry>} entries
   * @param  {StudioEntry|null} entry
   * @return {String}
   */
  _renderAppHeader(entries, entry) {
    const store = this._store;
    const sceneOpts = store.scenes.length
      ? `<select id="scene-select" title="Switch Active Scene">${store.scenes.map(sc => `<option value="${sc.id}" ${store.activeSceneId === sc.id ? 'selected' : ''}>Scene: ${sc.label}</option>`).join('')}</select>`
      : '';
    const entryOpts = entries.length
      ? `<select id="entry-select" title="Active Composition / Timeline">${entries.map(e => {
          const ed = this._getCycleDuration(e.instance);
          const tag = e.instance.iterationCount === Infinity ? '∞' : `${Math.round(ed)}ms`;
          return `<option value="${e.id}" ${entry && e.id === entry.id ? 'selected' : ''}>${e.name} (${tag})</option>`;
        }).join('')}</select>`
      : `<select id="entry-select" disabled><option>No Active Timeline</option></select>`;

    return `
      <header class="app-header">
        <div class="header-group">
          <div class="brand-mark">
            ${ICONS.logo}
            <span>Anime Studio</span>
            <span class="brand-version">V4</span>
          </div>
          <input class="project-name-input" id="inp-project-name" type="text" value="${store.projectName.replace(/"/g, '&quot;')}" title="Project Name" />
          <span class="status-badge" title="${store.isDirty ? 'Unsaved edits in workspace' : 'All changes saved'}">
            <span class="status-dot ${store.isDirty ? 'dirty' : ''}"></span>
            <span>${store.isDirty ? 'Modified' : 'Saved'}</span>
          </span>
          <button id="btn-save" class="ghost" title="Save Snapshot">${ICONS.save} Save</button>
          <div class="divider-v"></div>
          <button id="btn-undo" class="icon-btn" title="Undo (Cmd/Ctrl+Z)" ${store.canUndo ? '' : 'disabled'}>${ICONS.undo}</button>
          <button id="btn-redo" class="icon-btn" title="Redo (Cmd/Ctrl+Shift+Z)" ${store.canRedo ? '' : 'disabled'}>${ICONS.redo}</button>
        </div>

        <div class="header-group">
          ${sceneOpts}
          ${entryOpts}
        </div>

        <div class="header-group">
          <button id="btn-toggle-left" class="icon-btn ${this._leftCollapsed ? '' : 'active'}" title="Toggle Layers Panel">${ICONS.panelLeft}</button>
          <button id="btn-toggle-right" class="icon-btn ${this._rightCollapsed ? '' : 'active'}" title="Toggle Inspector Panel">${ICONS.panelRight}</button>
          <div class="divider-v"></div>
          <button id="btn-open-export" class="primary" title="Export Video, Frames or Code">${ICONS.export} Export</button>
        </div>
      </header>
    `;
  }

  /**
   * Compact header used when mounted in `mode="dock"` on standalone webpages.
   *
   * @param  {Array<StudioEntry>} entries
   * @param  {StudioEntry|null} entry
   * @return {String}
   */
  _renderDockHeader(entries, entry) {
    const store = this._store;
    const entryOpts = entries.length
      ? entries.map(e => {
          const ed = this._getCycleDuration(e.instance);
          const tag = e.instance.iterationCount === Infinity ? '∞' : `${Math.round(ed)}ms`;
          return `<option value="${e.id}" ${entry && e.id === entry.id ? 'selected' : ''}>${e.name} (${tag})</option>`;
        }).join('')
      : '<option value="">No Active Timeline</option>';

    return `
      <div class="dock-header">
        <div class="header-group">
          <div class="brand-mark" style="border-right:none;padding-right:4px">
            ${ICONS.logo}
            <span>Anime Studio</span>
          </div>
          <select id="entry-select">${entryOpts}</select>
          <button id="btn-undo" class="icon-btn" title="Undo" ${store.canUndo ? '' : 'disabled'}>${ICONS.undo}</button>
          <button id="btn-redo" class="icon-btn" title="Redo" ${store.canRedo ? '' : 'disabled'}>${ICONS.redo}</button>
        </div>
        <div class="header-group">
          <button id="btn-inspect" class="${this._inspectTargets ? 'active' : ''}">${ICONS.crosshair} Inspect</button>
          <button id="btn-open-export" class="primary">${ICONS.export} Export / Code</button>
          <button id="btn-collapse">${this._collapsed ? 'Expand' : 'Collapse'}</button>
        </div>
      </div>
    `;
  }

  /**
   * B. Left Sidebar — Scene / Object Hierarchy with visibility & lock controls.
   *
   * @param  {StudioEntry|null} entry
   * @param  {StudioLayerNode|null} selectedLayer
   * @return {String}
   */
  _renderLeftSidebar(entry, selectedLayer) {
    const store = this._store;
    const q = this._layerSearch.trim().toLowerCase();
    const layers = entry ? entry.layers.filter(l => !q || l.name.toLowerCase().includes(q) || l.targetLabel.toLowerCase().includes(q)) : [];

    const treeHtml = layers.length
      ? layers.map((l, idx) => {
          const isSel = selectedLayer && selectedLayer.id === l.id;
          const expanded = this._expandedLayers.has(l.id);
          const swatch = TRACK_COLORS[l.properties[0]?.category || 'animation'] || TRACK_COLORS.animation;
          const countTag = l.targets.length > 1 ? `<span class="layer-count">${l.targets.length}</span>` : '';

          let html = `
            <div class="layer-row ${isSel ? 'selected' : ''} ${l.hidden ? 'is-hidden' : ''}" data-select-layer="${l.id}">
              <button class="layer-act-btn" data-toggle-layer="${l.id}" title="${expanded ? 'Collapse' : 'Expand'}">${expanded ? ICONS.chevronDown : ICONS.chevronRight}</button>
              <span class="layer-swatch" style="background:${swatch}"></span>
              <span class="layer-label" title="${l.name} (${l.targetLabel})">${l.name}</span>
              ${countTag}
              <div class="layer-actions ${l.hidden || l.locked ? 'pinned' : ''}">
                <button class="layer-act-btn ${l.hidden ? 'warn' : ''}" data-vis-layer="${l.id}" title="${l.hidden ? 'Show Layer' : 'Hide Layer'}">${l.hidden ? ICONS.eyeOff : ICONS.eye}</button>
                <button class="layer-act-btn ${l.locked ? 'on' : ''}" data-lock-layer="${l.id}" title="${l.locked ? 'Unlock Layer' : 'Lock Layer'}">${l.locked ? ICONS.lock : ICONS.unlock}</button>
              </div>
            </div>
          `;

          if (expanded) {
            for (let p = 0; p < l.properties.length; p++) {
              const prop = l.properties[p];
              const pSel = isSel && store.selectedProperty === prop.property;
              html += `
                <div class="layer-row sub ${pSel ? 'selected' : ''}" data-select-layer="${l.id}" data-select-prop="${prop.property}">
                  <span class="layer-swatch" style="background:${TRACK_COLORS[prop.category] || '#888'};opacity:0.8"></span>
                  <span class="layer-label">${prop.property}</span>
                  <span class="layer-count">${prop.toText}</span>
                </div>
              `;
            }
          }
          return html;
        }).join('')
      : `<div class="empty-state">${entry ? 'No matching layers.' : 'No objects in scene.'}</div>`;

    return `
      <aside class="panel panel-left ${this._leftCollapsed ? 'is-collapsed' : ''}">
        <div class="panel-header">
          <span class="panel-title">${ICONS.layers} Layers & Objects</span>
          ${store.supportsAddObject ? `<button id="btn-add-object" style="height:20px;padding:0 6px;font-size:10px" title="Add Object to Scene">${ICONS.plus} Add</button>` : ''}
        </div>
        <div class="layers-toolbar">
          <input class="layers-search" id="inp-layer-search" type="text" placeholder="Filter layers..." value="${this._layerSearch.replace(/"/g, '&quot;')}" />
          <button id="btn-clear-selection" class="ghost" style="padding:0 5px" title="Deselect all">Clear</button>
        </div>
        <div class="layers-tree" id="layers-tree">${treeHtml}</div>
      </aside>
    `;
  }

  /**
   * C. Central Workspace — Centered Canvas Composition Viewport with Zoom / Pan / Fit / Grid.
   *
   * @return {String}
   */
  _renderCenterCanvas() {
    return `
      <main class="canvas-workspace">
        <div class="canvas-subbar">
          <div class="header-group">
            <span class="canvas-dims">${this._stageWidth} × ${this._stageHeight}</span>
            <div class="divider-v"></div>
            <button id="btn-canvas-pan" class="icon-btn ${this._panTool ? 'active' : ''}" title="Pan Tool (or hold Space + Drag)">${ICONS.hand}</button>
            <button id="btn-canvas-grid" class="icon-btn ${this._showGrid ? 'active' : ''}" title="Toggle Background Grid">${ICONS.grid}</button>
            <button id="btn-canvas-guides" class="icon-btn ${this._showGuides ? 'active' : ''}" title="Toggle Center Guides">${ICONS.crosshair}</button>
            <button id="btn-inspect" class="${this._inspectTargets ? 'active' : ''}" title="Highlight DOM Targets">${ICONS.crosshair} Bounds</button>
          </div>
          <div class="header-group">
            <button id="btn-zoom-out" class="icon-btn" title="Zoom Out">${ICONS.zoomOut}</button>
            <span id="canvas-zoom-label" style="font-family:var(--font-mono);font-size:10px;min-width:38px;text-align:center">${Math.round(this._canvasZoom * 100)}%</span>
            <button id="btn-zoom-in" class="icon-btn" title="Zoom In">${ICONS.zoomIn}</button>
            <button id="btn-zoom-100" style="padding:0 6px" title="Reset Zoom to 100%">100%</button>
            <button id="btn-zoom-fit" title="Fit Composition to Viewport">${ICONS.fit} Fit</button>
          </div>
        </div>
        <div class="canvas-stage-wrap ${this._showGrid ? 'with-grid' : ''} ${this._panTool ? 'pan-mode' : ''}" id="canvas-stage-wrap">
          <div class="composition-viewport" id="composition-viewport">
            <slot name="stage"></slot>
            ${this._showGuides ? '<div class="composition-guides"></div>' : ''}
          </div>
        </div>
      </main>
    `;
  }

  /**
   * D. Right Sidebar — Contextual Properties Inspector (Transform, Animation, Timing, Easing, Physics).
   *
   * @param  {StudioEntry|null} entry
   * @param  {StudioLayerNode|null} layer
   * @param  {StudioGroupTrack|null} group
   * @param  {StudioTweenTrack|null} tween
   * @return {String}
   */
  _renderRightInspector(entry, layer, group, tween) {
    if (!entry || !layer || !group) {
      return `
        <aside class="panel panel-right ${this._rightCollapsed ? 'is-collapsed' : ''}">
          <div class="panel-header">
            <span class="panel-title">Properties Inspector</span>
          </div>
          <div class="empty-state">Select a layer or timeline clip to inspect Transform, Timing, Easing, and Physics properties.</div>
        </aside>
      `;
    }

    const locked = layer.locked;
    const disabledAttr = locked ? 'disabled' : '';

    // Partition properties strictly by relevance
    const posProps = layer.properties.filter(p => p.category === 'position');
    const rotProps = layer.properties.filter(p => p.category === 'rotation');
    const scaleProps = layer.properties.filter(p => p.category === 'scale');
    const animProps = layer.properties.filter(p => p.category === 'animation');
    const hasTransform = posProps.length > 0 || rotProps.length > 0 || scaleProps.length > 0;

    const renderPropRow = (/** @type {StudioPropertySummary} */p) => {
      if (p.isScalarEditable) {
        return `
          <div class="prop-row">
            <span class="prop-name" title="${p.property}">${p.property}</span>
            <div class="prop-field-wrap">
              <span class="prop-mini-tag">F</span>
              <input type="number" step="any" data-prop-from="${p.property}" value="${p.fromNum ?? 0}" ${disabledAttr} />
            </div>
            <div class="prop-field-wrap">
              <span class="prop-mini-tag">T</span>
              <input type="number" step="any" data-prop-to="${p.property}" value="${p.toNum ?? 0}" ${disabledAttr} />
            </div>
          </div>
        `;
      }
      return `
        <div class="prop-row">
          <span class="prop-name" title="${p.property}">${p.property}</span>
          <input type="text" readonly value="${p.fromText}" />
          <input type="text" readonly value="${p.toText}" />
        </div>
      `;
    };

    const section = (id, title, bodyHtml, badge = '') => {
      const collapsed = this._collapsedSections.has(id);
      return `
        <div class="section ${collapsed ? 'collapsed' : ''}" data-section="${id}">
          <div class="section-head" data-toggle-section="${id}">
            <span class="section-head-left">${collapsed ? ICONS.chevronRight : ICONS.chevronDown}<span>${title}</span></span>
            ${badge ? `<span class="layer-count">${badge}</span>` : ''}
          </div>
          <div class="section-body">${bodyHtml}</div>
        </div>
      `;
    };

    const transformHtml = hasTransform ? section('transform', 'Transform', `
      ${posProps.length ? `<div class="prop-subgroup"><div class="prop-sublabel"><span>Position</span><span>${posProps[0].unit || 'px'}</span></div>${posProps.map(renderPropRow).join('')}</div>` : ''}
      ${rotProps.length ? `<div class="prop-subgroup"><div class="prop-sublabel"><span>Rotation</span><span>deg</span></div>${rotProps.map(renderPropRow).join('')}</div>` : ''}
      ${scaleProps.length ? `<div class="prop-subgroup"><div class="prop-sublabel"><span>Scale</span><span>×</span></div>${scaleProps.map(renderPropRow).join('')}</div>` : ''}
    `, `${posProps.length + rotProps.length + scaleProps.length}`) : '';

    const animationHtml = animProps.length ? section('animation', 'Animation Properties', `
      ${animProps.map(renderPropRow).join('')}
    `, `${animProps.length}`) : '';

    const timingHtml = section('timing', 'Timing', `
      <div class="grid-3">
        <div class="field-col">
          <label>Offset (ms)</label>
          <input id="inp-offset" type="number" min="0" step="10" value="${round(group.offset, 1)}" ${disabledAttr} />
        </div>
        <div class="field-col">
          <label>Delay (ms)</label>
          <input type="number" readonly value="${round(group.delay, 1)}" />
        </div>
        <div class="field-col">
          <label>Duration (ms)</label>
          <input id="inp-duration" type="number" min="10" step="10" value="${round(group.duration, 1)}" ${disabledAttr} />
        </div>
      </div>
      <div class="prop-row-2">
        <span class="prop-name">End Time</span>
        <input type="text" readonly value="${Math.round(group.endTime)} ms (Clip #${group.uid.split(':').pop()})" />
      </div>
    `);

    const activeEase = tween ? tween.easing : group.easing;
    const curvePath = this._buildCurvePath(activeEase.fn, 160, 110, false, 20);
    const isBezier = activeEase.kind === 'bezier' && activeEase.bezier;
    const isSpring = activeEase.kind === 'spring' && activeEase.spring;
    const cb = isBezier ? activeEase.bezier : [0.22, 1, 0.36, 1];
    const sp = isSpring ? activeEase.spring : { bounce: 0.45, duration: 628, mass: 1, stiffness: 100, damping: 10, settlingDuration: 628 };

    const easingHtml = section('easing', 'Easing Curve', `
      <div class="preset-grid">
        ${EASING_PRESETS.filter(p => p.kind !== 'spring').map(p => {
          const active = (p.kind === 'bezier' && isBezier) || (p.value === activeEase.label);
          return `<button class="ease-preset ${active ? 'active' : ''}" data-preset-kind="${p.kind}" data-preset-val="${p.value}" ${disabledAttr}>${p.label}</button>`;
        }).join('')}
      </div>
      <div class="curve-panel">
        <svg class="curve-svg" id="curve-svg" viewBox="-12 -8 184 166">
          <rect x="0" y="20" width="160" height="110" fill="none" stroke="#252930"/>
          <line x1="0" y1="75" x2="160" y2="75" stroke="#1E2228" stroke-dasharray="3 3"/>
          <line x1="80" y1="20" x2="80" y2="130" stroke="#1E2228" stroke-dasharray="3 3"/>
          <line x1="0" y1="130" x2="160" y2="20" stroke="#282D36"/>
          <path id="curve-main-path" d="${curvePath}" fill="none" stroke="#4A9EFF" stroke-width="2"/>
          ${isBezier ? `
            <line id="cb-line-1" x1="0" y1="130" x2="${cb[0] * 160}" y2="${130 - cb[1] * 110}" stroke="#A371F7" stroke-width="1" stroke-dasharray="2 2"/>
            <line id="cb-line-2" x1="160" y1="20" x2="${cb[2] * 160}" y2="${130 - cb[3] * 110}" stroke="#D29922" stroke-width="1" stroke-dasharray="2 2"/>
            <circle class="bezier-handle" data-handle="1" cx="${cb[0] * 160}" cy="${130 - cb[1] * 110}" r="5" fill="#A371F7" stroke="#0D0E10" stroke-width="1.5"/>
            <circle class="bezier-handle" data-handle="2" cx="${cb[2] * 160}" cy="${130 - cb[3] * 110}" r="5" fill="#D29922" stroke="#0D0E10" stroke-width="1.5"/>
          ` : ''}
          <circle id="curve-dot" cx="0" cy="130" r="3.5" fill="#E5534B" stroke="#ECEEF2" stroke-width="1"/>
        </svg>
        <div id="ease-label-readout" style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);text-align:center">${activeEase.label}</div>
        ${isBezier ? `
          <div class="slider-line"><span>x1</span><input class="cb-slider" data-cb="0" type="range" min="0" max="1" step="0.01" value="${cb[0]}" ${disabledAttr}><span id="cb-val-0">${round(cb[0], 2)}</span></div>
          <div class="slider-line"><span>y1</span><input class="cb-slider" data-cb="1" type="range" min="-0.4" max="1.4" step="0.01" value="${cb[1]}" ${disabledAttr}><span id="cb-val-1">${round(cb[1], 2)}</span></div>
          <div class="slider-line"><span>x2</span><input class="cb-slider" data-cb="2" type="range" min="0" max="1" step="0.01" value="${cb[2]}" ${disabledAttr}><span id="cb-val-2">${round(cb[2], 2)}</span></div>
          <div class="slider-line"><span>y2</span><input class="cb-slider" data-cb="3" type="range" min="-0.4" max="1.4" step="0.01" value="${cb[3]}" ${disabledAttr}><span id="cb-val-3">${round(cb[3], 2)}</span></div>
        ` : ''}
      </div>
    `, activeEase.kind);

    const physicsHtml = section('physics', 'Physics (Spring)', `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <span style="color:var(--text-secondary)">${isSpring ? `Settling: ${Math.round(sp.settlingDuration)} ms` : 'Inactive (Curve Easing)'}</span>
        <button id="btn-enable-spring" class="${isSpring ? 'active' : ''}" ${disabledAttr}>${isSpring ? 'Spring Active' : 'Use Spring'}</button>
      </div>
      <div class="slider-line"><span>Bounce</span><input id="sp-bounce" type="range" min="-0.5" max="0.95" step="0.01" value="${sp.bounce}" ${disabledAttr}><span id="sp-bounce-val">${round(sp.bounce, 2)}</span></div>
      <div class="slider-line"><span>Duration</span><input id="sp-dur" type="range" min="150" max="2000" step="10" value="${sp.duration}" ${disabledAttr}><span id="sp-dur-val">${Math.round(sp.duration)}</span></div>
      <div class="grid-3">
        <div class="field-col"><label>Mass</label><input id="sp-mass" type="number" min="0.1" step="0.1" value="${round(sp.mass, 2)}" ${disabledAttr}></div>
        <div class="field-col"><label>Stiffness</label><input id="sp-stiffness" type="number" min="1" step="5" value="${round(sp.stiffness, 1)}" ${disabledAttr}></div>
        <div class="field-col"><label>Damping</label><input id="sp-damping" type="number" min="0.5" step="0.5" value="${round(sp.damping, 1)}" ${disabledAttr}></div>
      </div>
    `, isSpring ? 'ON' : '');

    // Contextual Stagger Cascade only when layer has staggered children
    let staggerHtml = '';
    if (layer.isStaggered) {
      const members = entry.groups.filter(g => layer.groupUids.includes(g.uid));
      const items = members.length > 1
        ? members.map((g, i) => ({ label: `#${i}`, start: g.offset + g.delay, end: g.endTime }))
        : (group.targets || []).map((_, i) => {
            const tw = group.tweens.find(t => t.targetIndex === i);
            return { label: `#${i}`, start: tw ? tw.offset + tw.delay : 0, end: tw ? tw.endTime : group.duration };
          });
      const maxEnd = Math.max(1, ...items.map(i => i.end));
      staggerHtml = section('stagger', 'Stagger Distribution', `
        <div class="stagger-list">
          ${items.slice(0, 32).map(item => `
            <div class="stagger-row">
              <span style="color:var(--text-secondary)">${item.label}</span>
              <div class="stagger-bar-bg">
                <div class="stagger-bar-fill" style="left:${(item.start / maxEnd) * 100}%;width:${Math.max(2, ((item.end - item.start) / maxEnd) * 100)}%;background:${TRACK_COLORS.stagger}"></div>
              </div>
              <span style="font-family:var(--font-mono);color:var(--text-muted);text-align:right">+${Math.round(item.start)}ms</span>
            </div>
          `).join('')}
        </div>
      `, `${items.length}`);
    }

    return `
      <aside class="panel panel-right ${this._rightCollapsed ? 'is-collapsed' : ''}">
        <div class="panel-header">
          <span class="panel-title">Properties Inspector</span>
          ${locked ? `<span style="color:var(--warning);font-size:10px;display:inline-flex;align-items:center;gap:3px">${ICONS.lock} Locked</span>` : ''}
        </div>
        <div class="inspector-context-bar">
          <span class="context-title" title="${layer.name}">${layer.name}</span>
          <span class="context-type">${layer.isStaggered ? `GROUP · ${layer.targets.length}` : 'OBJECT'}</span>
        </div>
        <div class="inspector-scroll">
          ${transformHtml}
          ${animationHtml}
          ${timingHtml}
          ${easingHtml}
          ${physicsHtml}
          ${staggerHtml}
        </div>
      </aside>
    `;
  }

  /**
   * E. Bottom Workspace — Compact Playback Toolbar + Multi-Track Timeline with Hierarchy & Keyframes.
   *
   * @param  {StudioEntry|null} entry
   * @param  {StudioLayerNode|null} selectedLayer
   * @param  {StudioGroupTrack|null} selectedGroup
   * @param  {StudioTweenTrack|null} selectedTween
   * @param  {Number} dur
   * @param  {Number} fps
   * @return {String}
   */
  _renderBottomTimeline(entry, selectedLayer, selectedGroup, selectedTween, dur, fps) {
    const inst = entry ? entry.instance : null;
    const isVirtual = engine.isVirtual;
    const isLoop = inst ? inst.iterationCount === Infinity || inst.iterationCount > 1 : false;

    const layers = entry ? entry.layers : [];
    let treeRowsHtml = '';
    let laneRowsHtml = '';

    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const isLayerSel = selectedLayer && selectedLayer.id === layer.id;
      const expanded = this._expandedLayers.has(layer.id);
      const color = TRACK_COLORS[layer.properties[0]?.category || 'animation'] || TRACK_COLORS.animation;
      const startLeft = clamp(layer.offset / dur, 0, 1) * 100;
      const spanWidth = clamp((layer.endTime - layer.offset) / dur, 0.008, 1) * 100;
      const endLeft = clamp(layer.endTime / dur, 0, 1) * 100;

      treeRowsHtml += `
        <div class="tl-track-row ${isLayerSel ? 'selected' : ''} ${layer.locked ? 'is-locked' : ''}" data-select-layer="${layer.id}">
          <button class="layer-act-btn" data-toggle-layer="${layer.id}">${expanded ? ICONS.chevronDown : ICONS.chevronRight}</button>
          <span class="layer-swatch" style="background:${color}"></span>
          <span class="layer-label">${layer.name}</span>
          <span class="layer-count">${layer.properties.length}</span>
        </div>
      `;

      // Unified layer summary clip (or single object clip)
      const delayRatio = (layer.endTime - layer.offset) > 0 ? clamp(layer.delay / (layer.endTime - layer.offset), 0, 0.9) * 100 : 0;
      const spark = this._buildCurvePath(layer.easing.fn, 100, 18, true, 1);

      laneRowsHtml += `
        <div class="tl-lane-row ${isLayerSel ? 'selected' : ''}">
          <div class="bar-wrap ${isLayerSel ? 'selected' : ''} ${layer.locked ? 'locked' : ''}"
               data-drag-layer="${layer.id}"
               data-drag-group="${layer.primaryGroupUid}"
               style="left:${startLeft}%;width:${spanWidth}%">
            ${layer.delay > 0 ? `<div class="bar-delay" style="width:${delayRatio}%"></div>` : ''}
            <div class="bar-body" style="background:${color}">
              <svg class="bar-spark" viewBox="0 0 100 20" preserveAspectRatio="none">
                <path d="${spark}" fill="none" stroke="#090A0C" stroke-width="1.5"/>
              </svg>
              <span class="bar-text">${layer.name} · ${Math.round(layer.endTime - layer.offset)}ms</span>
              ${!layer.isStaggered ? `<div class="bar-resize" data-resize-group="${layer.primaryGroupUid}" title="Drag right edge to resize duration"></div>` : ''}
            </div>
          </div>
          <span class="kf-diamond ${isLayerSel ? 'active' : ''}" style="left:${startLeft}%" title="Start Keyframe (${Math.round(layer.offset)}ms)"></span>
          <span class="kf-diamond ${isLayerSel ? 'active' : ''}" style="left:${endLeft}%" title="End Keyframe (${Math.round(layer.endTime)}ms)"></span>
        </div>
      `;

      if (expanded) {
        // Show distinct animated properties (or staggered sub-clips aggregated per property!)
        for (let pi = 0; pi < layer.properties.length; pi++) {
          const prop = layer.properties[pi];
          const propColor = TRACK_COLORS[prop.category] || TRACK_COLORS.animation;
          const isPropSel = isLayerSel && this._store.selectedProperty === prop.property;
          const subTweens = prop.tweens.slice(0, 24);

          treeRowsHtml += `
            <div class="tl-track-row sub ${isPropSel ? 'selected' : ''}" data-select-layer="${layer.id}" data-select-prop="${prop.property}">
              <span class="layer-swatch" style="background:${propColor}"></span>
              <span class="layer-label">${prop.property}</span>
              <span class="layer-count">${prop.fromText}→${prop.toText}</span>
            </div>
          `;

          const clipsHtml = subTweens.map(tw => {
            const subGroup = entry.groups.find(g => g.animRef === tw.animRef);
            const twSel = selectedTween && selectedTween.uid === tw.uid;
            const twLeft = clamp(tw.offset / dur, 0, 1) * 100;
            const twWidth = clamp((tw.delay + tw.duration) / dur, 0.005, 1) * 100;
            const twEnd = clamp(tw.endTime / dur, 0, 1) * 100;
            const twDelayPct = (tw.delay + tw.duration) > 0 ? (tw.delay / (tw.delay + tw.duration)) * 100 : 0;
            return `
              <div class="bar-wrap ${twSel || isPropSel ? 'selected' : ''} ${layer.locked ? 'locked' : ''}"
                   data-drag-group="${subGroup ? subGroup.uid : layer.primaryGroupUid}"
                   data-select-tween="${tw.uid}"
                   data-select-layer="${layer.id}"
                   data-select-prop="${prop.property}"
                   style="left:${twLeft}%;width:${twWidth}%;cursor:pointer">
                ${tw.delay > 0 ? `<div class="bar-delay" style="width:${twDelayPct}%"></div>` : ''}
                <div class="bar-body" style="background:${propColor};opacity:0.86">
                  ${subTweens.length === 1 ? `<span class="bar-text">${prop.property}: ${tw.fromText} → ${tw.toText}</span>` : ''}
                </div>
              </div>
              ${subTweens.length <= 6 ? `<span class="kf-diamond" style="left:${twLeft}%"></span><span class="kf-diamond" style="left:${twEnd}%"></span>` : ''}
            `;
          }).join('');

          laneRowsHtml += `<div class="tl-lane-row sub ${isPropSel ? 'selected' : ''}">${clipsHtml}</div>`;
        }
      }
    }

    const rulerHtml = this._renderRulerTicks(dur, entry);

    return `
      <section class="timeline-workspace">
        <div class="playback-toolbar">
          <div class="header-group">
            <button id="btn-reset" class="icon-btn" title="Jump to Start">${ICONS.toStart}</button>
            <button id="btn-step-back" class="icon-btn" title="Step Back 1 Frame (←)">${ICONS.stepBack}</button>
            <button id="btn-play" class="icon-btn ${inst && !inst.paused ? 'active' : ''}" title="Play / Pause (Space)">${inst && !inst.paused ? ICONS.pause : ICONS.play}</button>
            <button id="btn-step-fwd" class="icon-btn" title="Step Forward 1 Frame (→)">${ICONS.stepFwd}</button>
            <button id="btn-reverse" class="icon-btn" title="Reverse Direction">${ICONS.reverse}</button>
            <button id="btn-loop" class="icon-btn ${isLoop ? 'active' : ''}" title="Toggle Loop">${ICONS.loop}</button>
            <div class="divider-v"></div>
            <div class="timecode-display" id="timecode">0.000s</div>
          </div>

          <div class="header-group">
            ${[0.25, 0.5, 1, 2].map(r => `<button class="speed-btn ${inst && inst.speed === r ? 'active' : ''}" data-speed="${r}" style="padding:0 5px">${r}×</button>`).join('')}
            <div class="divider-v"></div>
            <button id="btn-vclock" class="${isVirtual ? 'active' : ''}" title="Deterministic Virtual Clock">${ICONS.clock} V-Clock: ${isVirtual ? 'ON' : 'OFF'}</button>
            <select id="fps-select" title="Frame Rate (FPS)">
              ${[24, 30, 60, 120].map(f => `<option value="${f}" ${fps === f ? 'selected' : ''}>${f} fps</option>`).join('')}
            </select>
          </div>

          <div class="header-group">
            <select id="track-size-select" title="Timeline Track Height">
              <option value="compact" ${this._trackSize === 'compact' ? 'selected' : ''}>Tracks: Compact</option>
              <option value="normal" ${this._trackSize === 'normal' ? 'selected' : ''}>Tracks: Normal</option>
              <option value="expanded" ${this._trackSize === 'expanded' ? 'selected' : ''}>Tracks: Tall</option>
            </select>
            <button id="btn-tl-zoom-out" class="icon-btn" title="Zoom Out Timeline">${ICONS.zoomOut}</button>
            <input id="zoom-range" type="range" min="1" max="5" step="0.25" value="${this._tlZoom}" style="width:68px" title="Timeline Zoom">
            <button id="btn-tl-zoom-in" class="icon-btn" title="Zoom In Timeline">${ICONS.zoomIn}</button>
          </div>
        </div>

        <div class="timeline-split">
          <div class="tl-tree-pane">
            <div class="tl-tree-head">
              <span>Tracks (${layers.length})</span>
              <span>Props</span>
            </div>
            <div class="tl-tree-body" id="tl-tree-body">
              ${treeRowsHtml || '<div class="empty-state" style="padding:14px">No tracks</div>'}
            </div>
          </div>
          <div class="tl-lanes-pane" id="tl-lanes-pane">
            <div class="tl-canvas-inner" style="width:${Math.round(100 * this._tlZoom)}%">
              <div class="tl-tracks-inset">
                <div class="ruler-track" id="ruler-track">
                  <div class="ruler-coords" id="ruler-coords">${rulerHtml}</div>
                </div>
                ${laneRowsHtml}
                <div class="playhead-line" id="playhead" style="left:0%">
                  <div class="playhead-head"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
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
      if (t + step / 2 < dur) {
        html += `<div class="ruler-tick minor" style="left:${((t + step / 2) / dur) * 100}%"></div>`;
      }
    }
    if (entry) {
      for (const lbl of entry.labels) {
        const pct = clamp(lbl.time / dur, 0, 1) * 100;
        const align = pct < 8 ? 'translateX(0)' : pct > 92 ? 'translateX(-100%)' : 'translateX(-50%)';
        html += `<div class="ruler-label" style="left:${pct}%;transform:${align}" title="Label '${lbl.name}' @ ${Math.round(lbl.time)}ms">◆ ${lbl.name}</div>`;
      }
      for (const call of entry.calls) {
        const pct = clamp(call.time / dur, 0, 1) * 100;
        html += `<div class="ruler-call" style="left:${pct}%" title="Callback '${call.name}' @ ${Math.round(call.time)}ms"></div>`;
      }
    }
    return html;
  }

  /**
   * Export Modal containing Video (WebM WebCodecs), PNG/Filmstrip, and Anime v4 Code / JSON Blueprint.
   *
   * @param  {StudioEntry|null} entry
   * @param  {Number} dur
   * @param  {Number} fps
   * @return {String}
   */
  _renderExportModal(entry, dur, fps) {
    let content = '';
    if (this._exportTab === 'code') {
      const code = this._codeMode === 'json'
        ? JSON.stringify(generateBlueprintJSON(entry), null, 2)
        : generateAnimeCode(entry);
      content = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div class="header-group">
            <button id="btn-code-esm" class="${this._codeMode === 'esm' ? 'active' : ''}">Anime v4 ESM</button>
            <button id="btn-code-json" class="${this._codeMode === 'json' ? 'active' : ''}">JSON Blueprint</button>
          </div>
          <button id="btn-copy-code" class="primary">Copy Code</button>
        </div>
        <pre class="code-block">${code.replace(/</g, '&lt;')}</pre>
      `;
    } else {
      const filmHtml = this._renderState.filmstrip.length
        ? `<div class="filmstrip">${this._renderState.filmstrip.map(item => `
            <div class="film-thumb" data-seek-ms="${item.timeMs}">
              <img src="${item.url}" alt="Frame ${item.frame}"/>
              <span>F${item.frame} · ${Math.round(item.timeMs)}ms</span>
            </div>
          `).join('')}</div>`
        : '';

      content = `
        <div class="grid-3">
          <div class="field-col">
            <label>Source Target</label>
            <select id="render-source">
              <option value="auto">Auto (Canvas / SVG / Body)</option>
              <option value="canvas">Scene &lt;canvas&gt;</option>
              <option value="svg">First &lt;svg&gt;</option>
              <option value="body">Document Body</option>
            </select>
          </div>
          <div class="field-col">
            <label>Frame Rate (FPS)</label>
            <input id="render-fps" type="number" min="1" max="120" value="${fps}" />
          </div>
          <div class="field-col">
            <label>Duration (ms)</label>
            <input id="render-dur" type="number" min="50" step="50" value="${entry ? Math.round(dur) : 1000}" />
          </div>
        </div>
        <div class="header-group" style="flex-wrap:wrap">
          <button id="btn-export-webm" class="success">Export WebM Video (WebCodecs)</button>
          <button id="btn-filmstrip">Capture Filmstrip (8f)</button>
          <button id="btn-export-pngs">Export PNG Sequence</button>
        </div>
        ${this._renderState.status ? `<div class="status-banner" id="export-status-banner">${this._renderState.status}</div>` : ''}
        ${this._renderState.videoUrl ? `
          <div style="display:flex;flex-direction:column;gap:6px">
            <video src="${this._renderState.videoUrl}" controls loop muted playsinline style="width:100%;max-height:200px;background:#090A0C;border-radius:3px;border:1px solid var(--border-subtle)"></video>
            <a href="${this._renderState.videoUrl}" download="anime-studio-render.webm" style="color:var(--success);font-size:11px;text-decoration:none;font-weight:600">Download anime-studio-render.webm</a>
          </div>
        ` : ''}
        ${filmHtml}
      `;
    }

    return `
      <div class="modal-backdrop" id="export-backdrop">
        <div class="modal-dialog" role="dialog" aria-label="Export & Render">
          <div class="modal-header">
            <span>Export & Render</span>
            <button id="btn-close-export" class="icon-btn ghost" title="Close">${ICONS.close}</button>
          </div>
          <div class="modal-tabs">
            <button class="modal-tab ${this._exportTab === 'video' ? 'active' : ''}" data-export-tab="video">Video & Frames</button>
            <button class="modal-tab ${this._exportTab === 'code' ? 'active' : ''}" data-export-tab="code" data-tab="code">Code & JSON</button>
          </div>
          <div class="modal-body">${content}</div>
        </div>
      </div>
    `;
  }

  /**
   * Wires all interactive events cleanly across Header, Left Layers, Center Canvas, Right Inspector, Timeline, and Export Modal.
   *
   * @param  {StudioEntry|null} entry
   * @param  {StudioLayerNode|null} layer
   * @param  {StudioGroupTrack|null} group
   * @param  {StudioTweenTrack|null} tween
   * @param  {Number} dur
   * @param  {Number} fps
   * @return {void}
   */
  _bindEvents(entry, layer, group, tween, dur, fps) {
    const s = this._shadow;
    const store = this._store;
    const studio = this._studio;

    const onClick = (sel, fn) => {
      const el = s.querySelector(sel);
      if (el) el.addEventListener('click', fn);
    };

    // Header actions
    onClick('#btn-undo', () => store.undo());
    onClick('#btn-redo', () => store.redo());
    onClick('#btn-save', () => {
      store.markSaved(generateBlueprintJSON(entry));
    });
    const projInput = /** @type {HTMLInputElement|null} */(s.querySelector('#inp-project-name'));
    if (projInput) {
      projInput.onchange = () => store.setProjectName(projInput.value);
    }

    const sceneSel = /** @type {HTMLSelectElement|null} */(s.querySelector('#scene-select'));
    if (sceneSel) {
      sceneSel.onchange = () => store.selectScene(sceneSel.value);
    }

    const entrySel = /** @type {HTMLSelectElement|null} */(s.querySelector('#entry-select'));
    if (entrySel) {
      entrySel.onchange = () => {
        store.selectedEntryId = entrySel.value || null;
        store.selectedLayerId = null;
        store.selectedGroupUid = null;
        store.selectedTweenUid = null;
        store.selectedProperty = null;
        this.render();
      };
    }

    onClick('#btn-toggle-left', () => { this._leftCollapsed = !this._leftCollapsed; this.render(); });
    onClick('#btn-toggle-right', () => { this._rightCollapsed = !this._rightCollapsed; this.render(); });
    onClick('#btn-collapse', () => { this._collapsed = !this._collapsed; this.render(); });
    onClick('#btn-open-export', () => { this._exportOpen = true; this.render(); });
    onClick('#btn-close-export', () => { this._exportOpen = false; this.render(); });
    const backdrop = s.querySelector('#export-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', ev => {
        if (ev.target === backdrop) { this._exportOpen = false; this.render(); }
      });
    }
    s.querySelectorAll('[data-export-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._exportTab = /** @type {HTMLElement} */(btn).dataset.exportTab || 'video';
        this.render();
      });
    });

    // Left sidebar search & selection
    const searchInput = /** @type {HTMLInputElement|null} */(s.querySelector('#inp-layer-search'));
    if (searchInput) {
      searchInput.oninput = () => {
        const pos = searchInput.selectionStart;
        this._layerSearch = searchInput.value;
        this.render();
        const fresh = /** @type {HTMLInputElement|null} */(this._shadow.querySelector('#inp-layer-search'));
        if (fresh) {
          fresh.focus();
          if (pos !== null) fresh.setSelectionRange(pos, pos);
        }
      };
    }

    onClick('#btn-add-object', () => store.addObject());
    onClick('#btn-clear-selection', () => {
      store.selectedLayerId = '__none__';
      store.selectedGroupUid = null;
      store.selectedTweenUid = null;
      store.selectedProperty = null;
      this.render();
    });

    // Layer expand/collapse, visibility, lock, and selection (shared across Left Sidebar & Timeline Tree)
    s.querySelectorAll('[data-toggle-layer]').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        const id = /** @type {HTMLElement} */(btn).dataset.toggleLayer;
        if (this._expandedLayers.has(id)) this._expandedLayers.delete(id);
        else this._expandedLayers.add(id);
        this.render();
      });
    });

    s.querySelectorAll('[data-vis-layer]').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        const id = /** @type {HTMLElement} */(btn).dataset.visLayer;
        if (entry && id) store.toggleLayerVisibility(entry.id, id);
      });
    });

    s.querySelectorAll('[data-lock-layer]').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        const id = /** @type {HTMLElement} */(btn).dataset.lockLayer;
        if (entry && id) store.toggleLayerLock(entry.id, id);
      });
    });

    s.querySelectorAll('[data-select-layer]').forEach(row => {
      row.addEventListener('click', () => {
        const he = /** @type {HTMLElement} */(row);
        const lId = he.dataset.selectLayer || null;
        const propName = he.dataset.selectProp || null;
        const twUid = he.dataset.selectTween || null;
        store.selectedLayerId = lId;
        store.selectedProperty = propName;
        store.selectedTweenUid = twUid;
        if (entry && lId) {
          const found = entry.layers.find(l => l.id === lId);
          store.selectedGroupUid = found ? found.primaryGroupUid : null;
        }
        this.render();
      });
    });

    // Center Canvas Toolbar & Pan/Zoom
    onClick('#btn-canvas-grid', () => { this._showGrid = !this._showGrid; this.render(); });
    onClick('#btn-canvas-guides', () => { this._showGuides = !this._showGuides; this.render(); });
    onClick('#btn-canvas-pan', () => { this._panTool = !this._panTool; this.render(); });
    onClick('#btn-inspect', () => { this._inspectTargets = !this._inspectTargets; this.render(); });
    onClick('#btn-zoom-out', () => {
      this._canvasZoom = clamp(round(this._canvasZoom - 0.15, 2), 0.25, 2.5);
      this._applyCanvasTransform();
    });
    onClick('#btn-zoom-in', () => {
      this._canvasZoom = clamp(round(this._canvasZoom + 0.15, 2), 0.25, 2.5);
      this._applyCanvasTransform();
    });
    onClick('#btn-zoom-100', () => {
      this._canvasZoom = 1;
      this._canvasPanX = 0;
      this._canvasPanY = 0;
      this._applyCanvasTransform();
    });
    onClick('#btn-zoom-fit', () => this.fitCanvasToScreen());

    const stageWrap = /** @type {HTMLElement|null} */(s.querySelector('#canvas-stage-wrap'));
    if (stageWrap) {
      stageWrap.addEventListener('wheel', ev => {
        if (ev.ctrlKey || ev.metaKey || this._panTool) {
          ev.preventDefault();
          const delta = ev.deltaY > 0 ? -0.08 : 0.08;
          this._canvasZoom = clamp(round(this._canvasZoom + delta, 2), 0.25, 2.5);
          this._applyCanvasTransform();
        }
      }, { passive: false });

      stageWrap.addEventListener('pointerdown', ev => {
        const pe = /** @type {PointerEvent} */(ev);
        if (!this._panTool && pe.button !== 1) return;
        pe.preventDefault();
        const sx = pe.clientX;
        const sy = pe.clientY;
        const ix = this._canvasPanX;
        const iy = this._canvasPanY;
        const onMove = mv => {
          this._canvasPanX = ix + (mv.clientX - sx);
          this._canvasPanY = iy + (mv.clientY - sy);
          this._applyCanvasTransform();
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
    }

    // Panel Splitters (Left, Right, Bottom Timeline)
    const bindSplitter = (sel, axis, getInit, applyVal) => {
      const el = s.querySelector(sel);
      if (!el) return;
      el.addEventListener('pointerdown', ev => {
        const pe = /** @type {PointerEvent} */(ev);
        const startPos = axis === 'x' ? pe.clientX : pe.clientY;
        const initVal = getInit();
        el.classList.add('dragging');
        const onMove = mv => {
          const delta = (axis === 'x' ? mv.clientX : mv.clientY) - startPos;
          applyVal(initVal, delta);
        };
        const onUp = () => {
          el.classList.remove('dragging');
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
    };

    bindSplitter('#split-left', 'x', () => this._leftWidth, (init, d) => {
      this._leftWidth = clamp(init + d, 180, 380);
      const shell = /** @type {HTMLElement|null} */(s.querySelector('.shell-workspace'));
      if (shell) shell.style.gridTemplateColumns = `${this._leftWidth}px 4px minmax(320px, 1fr) ${this._rightCollapsed ? '0px 0px' : `4px ${this._rightWidth}px`}`;
    });
    bindSplitter('#split-right', 'x', () => this._rightWidth, (init, d) => {
      this._rightWidth = clamp(init - d, 240, 440);
      const shell = /** @type {HTMLElement|null} */(s.querySelector('.shell-workspace'));
      if (shell) shell.style.gridTemplateColumns = `${this._leftCollapsed ? '0px 0px' : `${this._leftWidth}px 4px`} minmax(320px, 1fr) 4px ${this._rightWidth}px`;
    });
    bindSplitter('#split-timeline', 'y', () => this._timelineHeight, (init, d) => {
      this._timelineHeight = clamp(init - d, 150, Math.max(220, window.innerHeight - 280));
      const shell = /** @type {HTMLElement|null} */(s.querySelector('.shell-workspace, .shell-dock'));
      if (shell) shell.style.setProperty('--timeline-h', `${this._timelineHeight}px`);
    });

    // Playback Toolbar
    onClick('#btn-play', () => studio.togglePlay());
    onClick('#btn-reset', () => studio.restart());
    onClick('#btn-step-back', () => studio.stepFrame(-1));
    onClick('#btn-step-fwd', () => studio.stepFrame(1));
    onClick('#btn-reverse', () => studio.reverse());
    onClick('#btn-loop', () => {
      if (entry) {
        const isInf = entry.instance.iterationCount === Infinity;
        entry.instance.iterationCount = isInf ? 1 : Infinity;
        this.render();
      }
    });
    onClick('#btn-vclock', () => {
      studio.setVirtualClock(!engine.isVirtual);
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

    const trackSizeSel = /** @type {HTMLSelectElement|null} */(s.querySelector('#track-size-select'));
    if (trackSizeSel) {
      trackSizeSel.onchange = () => {
        this._trackSize = trackSizeSel.value;
        this.render();
      };
    }

    const zoomRange = /** @type {HTMLInputElement|null} */(s.querySelector('#zoom-range'));
    if (zoomRange) {
      zoomRange.oninput = () => {
        this._tlZoom = Number(zoomRange.value) || 1;
        this.render();
      };
    }
    onClick('#btn-tl-zoom-out', () => { this._tlZoom = clamp(round(this._tlZoom - 0.25, 2), 1, 5); this.render(); });
    onClick('#btn-tl-zoom-in', () => { this._tlZoom = clamp(round(this._tlZoom + 0.25, 2), 1, 5); this.render(); });

    // Sync Timeline Tree & Lanes vertical scroll
    const treeBody = /** @type {HTMLElement|null} */(s.querySelector('#tl-tree-body'));
    const lanesPane = /** @type {HTMLElement|null} */(s.querySelector('#tl-lanes-pane'));
    if (treeBody && lanesPane) {
      let syncing = false;
      treeBody.addEventListener('scroll', () => {
        if (syncing) return;
        syncing = true;
        lanesPane.scrollTop = treeBody.scrollTop;
        syncing = false;
      });
      lanesPane.addEventListener('scroll', () => {
        if (syncing) return;
        syncing = true;
        treeBody.scrollTop = lanesPane.scrollTop;
        syncing = false;
      });
    }

    // Ruler scrub
    const ruler = /** @type {HTMLElement|null} */(s.querySelector('#ruler-track'));
    const rulerCoords = /** @type {HTMLElement|null} */(s.querySelector('#ruler-coords')) || ruler;
    if (ruler && rulerCoords && entry) {
      const scrubAt = clientX => {
        const rect = rulerCoords.getBoundingClientRect();
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

    // Drag layer/clip horizontally or resize right handle (batched into 1 Undo entry!)
    if (entry) {
      s.querySelectorAll('.bar-wrap').forEach(barEl => {
        barEl.addEventListener('pointerdown', ev => {
          const pe = /** @type {PointerEvent} */(ev);
          const he = /** @type {HTMLElement} */(barEl);
          const lId = he.dataset.dragLayer || he.dataset.selectLayer;
          const gUid = he.dataset.dragGroup;
          const propName = he.dataset.selectProp || null;
          const twUid = he.dataset.selectTween || null;

          if (lId) {
            store.selectedLayerId = lId;
            store.selectedProperty = propName;
            store.selectedTweenUid = twUid;
            const foundLayer = entry.layers.find(l => l.id === lId);
            if (foundLayer && foundLayer.locked) {
              this.render();
              return;
            }
            if (foundLayer && !gUid) store.selectedGroupUid = foundLayer.primaryGroupUid;
          }
          if (gUid) store.selectedGroupUid = gUid;

          const isResize = /** @type {HTMLElement} */(pe.target).classList.contains('bar-resize');
          const lane = barEl.parentElement;
          const laneWidth = lane ? lane.getBoundingClientRect().width : 400;
          const startX = pe.clientX;
          let lastAppliedDelta = 0;

          if (isResize && gUid) {
            const targetGroup = entry.groups.find(g => g.uid === gUid);
            if (!targetGroup) return;
            const initDur = targetGroup.duration;
            store.beginBatch(`Resize ${targetGroup.targetLabel}`);
            this._suspendStoreRender = true;
            const onMove = mv => {
              const deltaMs = ((mv.clientX - startX) / Math.max(1, laneWidth)) * dur;
              store.updateGroupDuration(entry.id, gUid, initDur + deltaMs);
              barEl.setAttribute('style', `left:${clamp(targetGroup.offset / dur, 0, 1) * 100}%;width:${clamp((targetGroup.delay + targetGroup.duration) / dur, 0.008, 1) * 100}%`);
            };
            const onUp = () => {
              this._suspendStoreRender = false;
              store.commitBatch();
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
              this.render();
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
          } else if (lId && he.dataset.dragLayer) {
            const targetLayer = entry.layers.find(l => l.id === lId);
            if (!targetLayer) return;
            const initLeft = targetLayer.offset;
            const spanW = targetLayer.endTime - targetLayer.offset;
            store.beginBatch(`Move ${targetLayer.name}`);
            this._suspendStoreRender = true;
            const onMove = mv => {
              const deltaMs = ((mv.clientX - startX) / Math.max(1, laneWidth)) * dur;
              const inc = deltaMs - lastAppliedDelta;
              if (Math.abs(inc) >= 1) {
                store.shiftLayerOffset(entry.id, lId, inc);
                lastAppliedDelta += inc;
                const clampedOff = Math.max(0, initLeft + lastAppliedDelta);
                he.style.left = `${clamp(clampedOff / dur, 0, 1) * 100}%`;
                he.style.width = `${clamp(spanW / dur, 0.008, 1) * 100}%`;
              }
            };
            const onUp = () => {
              this._suspendStoreRender = false;
              store.commitBatch();
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
              this.render();
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
          } else {
            this.render();
          }
        });
      });
    }

    // Inspector Collapsible Section toggles
    s.querySelectorAll('[data-toggle-section]').forEach(head => {
      head.addEventListener('click', () => {
        const secId = /** @type {HTMLElement} */(head).dataset.toggleSection;
        if (this._collapsedSections.has(secId)) this._collapsedSections.delete(secId);
        else this._collapsedSections.add(secId);
        this.render();
      });
    });

    // Inspector Property From/To edits (Transform & Animation)
    if (entry && layer && !layer.locked) {
      s.querySelectorAll('[data-prop-from]').forEach(inp => {
        const inputEl = /** @type {HTMLInputElement} */(inp);
        inputEl.onchange = () => {
          const prop = inputEl.dataset.propFrom;
          const val = Number(inputEl.value);
          if (prop && Number.isFinite(val)) {
            store.updateTweenValues(entry.id, layer.groupUids, prop, { from: val });
          }
        };
      });
      s.querySelectorAll('[data-prop-to]').forEach(inp => {
        const inputEl = /** @type {HTMLInputElement} */(inp);
        inputEl.onchange = () => {
          const prop = inputEl.dataset.propTo;
          const val = Number(inputEl.value);
          if (prop && Number.isFinite(val)) {
            store.updateTweenValues(entry.id, layer.groupUids, prop, { to: val });
          }
        };
      });
    }

    // Timing numeric inputs
    const inpOffset = /** @type {HTMLInputElement|null} */(s.querySelector('#inp-offset'));
    if (inpOffset && entry && group && layer && !layer.locked) {
      inpOffset.onchange = () => store.updateGroupOffset(entry.id, group.uid, Number(inpOffset.value));
    }
    const inpDur = /** @type {HTMLInputElement|null} */(s.querySelector('#inp-duration'));
    if (inpDur && entry && group && layer && !layer.locked) {
      inpDur.onchange = () => store.updateGroupDuration(entry.id, group.uid, Number(inpDur.value));
    }

    // Easing presets & live interactive Cubic Bezier / Spring editing
    if (entry && group && layer && !layer.locked) {
      const targetGroupUids = layer.groupUids;
      s.querySelectorAll('.ease-preset').forEach(btn => {
        btn.addEventListener('click', () => {
          const he = /** @type {HTMLElement} */(btn);
          const kind = /** @type {'ease'|'bezier'|'spring'} */(he.dataset.presetKind || 'ease');
          const value = he.dataset.presetVal || 'out(2)';
          store.updateEasing(entry.id, group.uid, tween ? tween.uid : null, { kind, value }, true, targetGroupUids);
        });
      });

      const activeEase = tween ? tween.easing : group.easing;

      const updateCurveVisualInPlace = (nextEaseFn, labelText, cbCoords) => {
        const pathEl = s.querySelector('#curve-main-path');
        const lblEl = s.querySelector('#ease-label-readout');
        if (pathEl) pathEl.setAttribute('d', this._buildCurvePath(nextEaseFn, 160, 110, false, 20));
        if (lblEl) lblEl.textContent = labelText;
        if (cbCoords) {
          const l1 = s.querySelector('#cb-line-1');
          const l2 = s.querySelector('#cb-line-2');
          const h1 = s.querySelector('[data-handle="1"]');
          const h2 = s.querySelector('[data-handle="2"]');
          const x1 = cbCoords[0] * 160;
          const y1 = 130 - cbCoords[1] * 110;
          const x2 = cbCoords[2] * 160;
          const y2 = 130 - cbCoords[3] * 110;
          if (l1) { l1.setAttribute('x2', String(x1)); l1.setAttribute('y2', String(y1)); }
          if (l2) { l2.setAttribute('x2', String(x2)); l2.setAttribute('y2', String(y2)); }
          if (h1) { h1.setAttribute('cx', String(x1)); h1.setAttribute('cy', String(y1)); }
          if (h2) { h2.setAttribute('cx', String(x2)); h2.setAttribute('cy', String(y2)); }
          for (let i = 0; i < 4; i++) {
            const spVal = s.querySelector(`#cb-val-${i}`);
            if (spVal) spVal.textContent = String(round(cbCoords[i], 2));
          }
        }
      };

      if (activeEase.kind === 'bezier' && activeEase.bezier) {
        const cb = [...activeEase.bezier];
        s.querySelectorAll('.cb-slider').forEach(inp => {
          const slider = /** @type {HTMLInputElement} */(inp);
          slider.addEventListener('pointerdown', () => {
            store.beginBatch('Edit Cubic Bezier');
            this._suspendStoreRender = true;
          });
          slider.addEventListener('input', () => {
            const idx = Number(slider.dataset.cb);
            cb[idx] = Number(slider.value);
            store.updateEasing(entry.id, group.uid, tween ? tween.uid : null, {
              kind: 'bezier',
              bezier: /** @type {[Number, Number, Number, Number]} */(cb),
            }, true, targetGroupUids);
            const curEase = store.getSelection().group?.easing;
            if (curEase) updateCurveVisualInPlace(curEase.fn, curEase.label, cb);
          });
          slider.addEventListener('change', () => {
            this._suspendStoreRender = false;
            store.commitBatch();
            this.render();
          });
        });

        const svg = /** @type {SVGSVGElement|null} */(s.querySelector('#curve-svg'));
        if (svg) {
          s.querySelectorAll('.bezier-handle').forEach(h => {
            h.addEventListener('pointerdown', ev => {
              const handleIdx = Number(/** @type {HTMLElement} */(h).dataset.handle);
              const rect = svg.getBoundingClientRect();
              store.beginBatch('Drag Bezier Handle');
              this._suspendStoreRender = true;
              const updateFromPointer = mv => {
                // SVG viewBox is (-12 -8 184 166) with curve box (0..160, 20..130)
                const vbX = ((mv.clientX - rect.left) / rect.width) * 184 - 12;
                const vbY = ((mv.clientY - rect.top) / rect.height) * 166 - 8;
                const nx = round(clamp(vbX / 160, 0, 1), 2);
                const ny = round(clamp((130 - vbY) / 110, -0.4, 1.4), 2);
                if (handleIdx === 1) { cb[0] = nx; cb[1] = ny; }
                else { cb[2] = nx; cb[3] = ny; }
                store.updateEasing(entry.id, group.uid, tween ? tween.uid : null, {
                  kind: 'bezier',
                  bezier: /** @type {[Number, Number, Number, Number]} */(cb),
                }, true, targetGroupUids);
                const curEase = store.getSelection().group?.easing;
                if (curEase) updateCurveVisualInPlace(curEase.fn, curEase.label, cb);
              };
              const onUp = () => {
                this._suspendStoreRender = false;
                store.commitBatch();
                window.removeEventListener('pointermove', updateFromPointer);
                window.removeEventListener('pointerup', onUp);
                this.render();
              };
              window.addEventListener('pointermove', updateFromPointer);
              window.addEventListener('pointerup', onUp);
            });
          });
        }
      }

      // Physics / Spring controls
      const spBounce = /** @type {HTMLInputElement|null} */(s.querySelector('#sp-bounce'));
      const spDur = /** @type {HTMLInputElement|null} */(s.querySelector('#sp-dur'));
      const spMass = /** @type {HTMLInputElement|null} */(s.querySelector('#sp-mass'));
      const spStiff = /** @type {HTMLInputElement|null} */(s.querySelector('#sp-stiffness'));
      const spDamp = /** @type {HTMLInputElement|null} */(s.querySelector('#sp-damping'));

      onClick('#btn-enable-spring', () => {
        store.updateEasing(entry.id, group.uid, tween ? tween.uid : null, {
          kind: 'spring',
          spring: {
            bounce: spBounce ? Number(spBounce.value) : 0.45,
            duration: spDur ? Number(spDur.value) : 628,
          },
        }, true, targetGroupUids);
      });

      if (spBounce && spDur) {
        const applyBD = () => {
          store.updateEasing(entry.id, group.uid, tween ? tween.uid : null, {
            kind: 'spring',
            spring: { bounce: Number(spBounce.value), duration: Number(spDur.value) },
          }, true, targetGroupUids);
        };
        [spBounce, spDur].forEach(sl => {
          sl.addEventListener('pointerdown', () => {
            store.beginBatch('Adjust Spring');
            this._suspendStoreRender = true;
          });
          sl.addEventListener('input', () => {
            applyBD();
            const curEase = store.getSelection().group?.easing;
            if (curEase) updateCurveVisualInPlace(curEase.fn, curEase.label, null);
            const bv = s.querySelector('#sp-bounce-val');
            const dv = s.querySelector('#sp-dur-val');
            if (bv) bv.textContent = String(round(Number(spBounce.value), 2));
            if (dv) dv.textContent = String(Math.round(Number(spDur.value)));
          });
          sl.addEventListener('change', () => {
            this._suspendStoreRender = false;
            store.commitBatch();
            this.render();
          });
        });
      }

      if (spMass && spStiff && spDamp) {
        const applyMSD = () => {
          store.updateEasing(entry.id, group.uid, tween ? tween.uid : null, {
            kind: 'spring',
            spring: {
              mass: Number(spMass.value),
              stiffness: Number(spStiff.value),
              damping: Number(spDamp.value),
            },
          }, true, targetGroupUids);
        };
        spMass.onchange = applyMSD;
        spStiff.onchange = applyMSD;
        spDamp.onchange = applyMSD;
      }
    }

    // Export Modal (Code + WebM + PNGs + Filmstrip)
    if (this._exportOpen) {
      onClick('#btn-code-esm', () => { this._codeMode = 'esm'; this.render(); });
      onClick('#btn-code-json', () => { this._codeMode = 'json'; this.render(); });
      onClick('#btn-copy-code', async () => {
        const code = this._codeMode === 'json'
          ? JSON.stringify(generateBlueprintJSON(entry), null, 2)
          : generateAnimeCode(entry);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(code);
          const btn = s.querySelector('#btn-copy-code');
          if (btn) {
            btn.textContent = 'Copied!';
            setTimeout(() => { if (btn) btn.textContent = 'Copy Code'; }, 1200);
          }
        }
      });

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

      onClick('#btn-filmstrip', async () => {
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
          background: cfg.canvas ? undefined : '#111317',
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

      onClick('#btn-export-webm', async () => {
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
          background: cfg.canvas ? undefined : '#111317',
        });
        try {
          const res = await session.exportWebM({
            onProgress: p => {
              const banner = s.querySelector('#export-status-banner');
              if (banner) banner.textContent = `Encoding WebM: ${Math.round(p * 100)}%`;
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

      onClick('#btn-export-pngs', async () => {
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
          background: cfg.canvas ? undefined : '#111317',
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
