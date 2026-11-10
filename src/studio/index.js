import { isBrowser, doc, K } from '../core/consts.js';
import { clamp } from '../core/helpers.js';
import { engine } from '../engine/engine.js';
import { StudioStore } from './store.js';
import { ensureStudioElementDefined } from './ui.js';
import { generateAnimeCode, generateBlueprintJSON } from './codegen.js';

/**
 * @import { Timeline } from '../timeline/timeline.js'
 * @import { JSAnimation } from '../animation/animation.js'
 * @import { StudioEntry, SceneConfigOption } from './store.js'
 * @import { AnimeStudioElement } from './ui.js'
 */

/**
 * @typedef {Object} StudioOptions
 * @property {Boolean} [mount=true] - Automatically mount the Shadow DOM `<anime-studio>` panel in browsers
 * @property {'workspace'|'dock'} [mode='dock'] - Full-viewport NLE workspace or compact bottom dock
 * @property {HTMLElement} [container] - Custom mount container (defaults to `document.body`)
 * @property {HTMLElement} [stageElement] - Optional DOM/Canvas stage node to slot inside central workspace viewport
 * @property {Number} [stageWidth=960] - Composition width for workspace viewport
 * @property {Number} [stageHeight=540] - Composition height for workspace viewport
 * @property {String} [projectName='Untitled Motion'] - Initial project title
 * @property {Boolean} [connect=true] - Connect `globals.editor` automatically to intercept new animations & timelines
 * @property {Number} [fps=60] - Default studio frame-stepping & render FPS
 * @property {Boolean} [virtualClock=false] - Start immediately in deterministic virtual clock mode
 * @property {Boolean} [shortcuts=true] - Enable keyboard shortcuts (`Space`, `←`, `→`, `Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`)
 */

/** @type {Studio|null} */
let activeStudio = null;

/**
 * Programmatic controller for Anime Studio (`globals.editor` + Shadow DOM HUD + Virtual Clock bridge).
 */
export class Studio {
  /** @param {StudioOptions} [options] */
  constructor(options = {}) {
    this.store = new StudioStore();
    if (options.projectName) {
      this.store.projectName = options.projectName;
    }
    this.fps = Math.max(1, options.fps || 60);
    /** @type {'workspace'|'dock'} */
    this._mode = options.mode === 'workspace' ? 'workspace' : 'dock';
    this._stageWidth = options.stageWidth || 960;
    this._stageHeight = options.stageHeight || 540;
    /** @type {AnimeStudioElement|null} */
    this.element = null;
    this._keyHandler = null;
    this._prevUseVirtual = engine.isVirtual;
    this._disposed = false;

    if (options.connect !== false) {
      this.store.connect();
    }
    if (options.virtualClock) {
      this.setVirtualClock(true);
    }
    if (options.mount !== false && isBrowser) {
      this.mount(options.container, options.stageElement);
    }
    if (options.shortcuts !== false && isBrowser) {
      this._bindKeyboard();
    }
  }

  /** @return {void} */
  _bindKeyboard() {
    if (!doc) return;
    this._keyHandler = ev => {
      const target = /** @type {HTMLElement|null} */(ev.target);
      const isEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) this.redo();
        else this.undo();
        return;
      }

      if (isEditable) return;

      if (ev.code === 'Space') {
        if (!this.store.getSelectedEntry()) return;
        ev.preventDefault();
        this.togglePlay();
      } else if (ev.code === 'ArrowLeft') {
        if (!this.store.getSelectedEntry()) return;
        ev.preventDefault();
        this.stepFrame(ev.shiftKey ? -10 : -1);
      } else if (ev.code === 'ArrowRight') {
        if (!this.store.getSelectedEntry()) return;
        ev.preventDefault();
        this.stepFrame(ev.shiftKey ? 10 : 1);
      }
    };
    doc.addEventListener('keydown', this._keyHandler);
  }

  /**
   * Mounts `<anime-studio>` Shadow DOM panel onto `container` (or `document.body`).
   *
   * @param  {HTMLElement} [container]
   * @param  {HTMLElement} [stageElement]
   * @return {this}
   */
  mount(container, stageElement) {
    if (!isBrowser || !doc || this.element) return this;
    ensureStudioElementDefined();
    const existingEl = /** @type {AnimeStudioElement|null} */(doc.querySelector('anime-studio'));
    const host = existingEl || /** @type {AnimeStudioElement} */(doc.createElement('anime-studio'));
    if (stageElement) {
      stageElement.setAttribute('slot', 'stage');
      if (stageElement.parentNode !== host) {
        host.appendChild(stageElement);
      }
    }
    if (!host.parentNode) {
      const targetParent = container || doc.body || doc.documentElement;
      if (targetParent) targetParent.appendChild(host);
    }
    host.bind(this.store, this, {
      mode: this._mode,
      stageWidth: this._stageWidth,
      stageHeight: this._stageHeight,
    });
    this.element = host;
    return this;
  }

  /**
   * Unmounts the `<anime-studio>` element from the DOM without destroying the store.
   *
   * @return {this}
   */
  unmount() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    return this;
  }

  /**
   * Registers host scene switcher & Add-Object controls with the Studio shell.
   *
   * @param {{ scenes?: Array<SceneConfigOption>, activeSceneId?: String, onSelectScene?: (id: String) => void, onAddObject?: () => void }} config
   * @return {this}
   */
  setSceneSupport(config) {
    this.store.setSceneSupport(config);
    return this;
  }

  /** @param {any} target @return {Boolean} */
  isTargetVisible(target) {
    return this.store.isTargetVisible(target);
  }

  /** @return {Boolean} */
  undo() {
    return this.store.undo();
  }

  /** @return {Boolean} */
  redo() {
    return this.store.redo();
  }

  /** @return {this} */
  saveProject() {
    this.store.markSaved(this.exportJSON());
    return this;
  }

  /**
   * Manually attaches an existing `Timeline` or `JSAnimation` to the Studio inspector.
   *
   * @param  {Timeline|JSAnimation} instance
   * @param  {String} [label]
   * @return {StudioEntry}
   */
  attach(instance, label) {
    return this.store.attach(instance, label);
  }

  /**
   * Selects an entry by its Studio ID.
   *
   * @param  {String} entryId
   * @return {this}
   */
  select(entryId) {
    if (this.store.entries.has(entryId)) {
      this.store.selectedEntryId = entryId;
      this.store.selectedLayerId = null;
      this.store.selectedGroupUid = null;
      this.store.selectedTweenUid = null;
      this.store.selectedProperty = null;
      this.store.emit();
    }
    return this;
  }

  /** @param {Number} fps @return {this} */
  setFps(fps) {
    this.fps = Math.max(1, fps || 60);
    return this;
  }

  /**
   * Toggles deterministic Virtual Clock mode on the Anime.js engine.
   *
   * @param  {Boolean} enabled
   * @return {this}
   */
  setVirtualClock(enabled) {
    if (enabled) {
      engine.useVirtualClock(engine.isVirtual ? /** @type {Number} */(engine.virtualTime) : 0);
    } else {
      engine.useRealClock();
    }
    return this;
  }

  /** @return {this} */
  togglePlay() {
    const entry = this.store.getSelectedEntry();
    if (!entry) return this;
    const inst = entry.instance;
    if (inst.paused) {
      if (inst.completed || inst.currentTime >= inst.duration) inst.restart();
      else inst.play();
    } else {
      inst.pause();
    }
    this.store.emit();
    return this;
  }

  /** @return {this} */
  restart() {
    const entry = this.store.getSelectedEntry();
    if (!entry) return this;
    entry.instance.restart();
    this.store.emit();
    return this;
  }

  /** @return {this} */
  reverse() {
    const entry = this.store.getSelectedEntry();
    if (!entry) return this;
    entry.instance.reverse();
    this.store.emit();
    return this;
  }

  /**
   * Seeks the active entry to `timeMs` (milliseconds).
   *
   * @param  {Number} timeMs
   * @return {this}
   */
  seek(timeMs) {
    const entry = this.store.getSelectedEntry();
    if (!entry) return this;
    const inst = entry.instance;
    const maxDur = inst.iterationCount === Infinity || inst.duration >= 1e11
      ? Math.max(0, inst.iterationDuration)
      : Math.max(0, inst.duration);
    const clamped = clamp(timeMs, 0, maxDur);
    inst.pause().seek(clamped);
    if (engine.isVirtual) {
      engine.setTime(clamped, true);
    }
    return this;
  }

  /**
   * Steps the active entry forward or backward by `deltaFrames` at the configured Studio FPS.
   *
   * @param  {Number} [deltaFrames=1]
   * @return {this}
   */
  stepFrame(deltaFrames = 1) {
    const entry = this.store.getSelectedEntry();
    const unitPerSec = engine.timeUnit === 's' ? 1 : K;
    const frameStep = unitPerSec / this.fps;
    if (entry) {
      const inst = entry.instance;
      const cur = inst.iterationCount === Infinity ? inst.iterationCurrentTime : inst.currentTime;
      const next = cur + deltaFrames * frameStep;
      return this.seek(next);
    }
    if (engine.isVirtual) {
      engine.step(deltaFrames * (K / this.fps), true);
    }
    return this;
  }

  /**
   * Opens the Export / Code dialog (optionally selecting a tab `'video' | 'code'`).
   *
   * @param  {'video'|'code'} [tab='video']
   * @return {this}
   */
  openExport(tab = 'video') {
    if (this.element) {
      this.element._exportOpen = true;
      this.element._exportTab = tab;
      this.element.render();
    }
    return this;
  }

  /**
   * Generates runnable Anime.js v4 ESM code for the currently selected (or specified) entry.
   *
   * @param  {String} [entryId]
   * @return {String}
   */
  exportCode(entryId) {
    const entry = entryId ? this.store.entries.get(entryId) || null : this.store.getSelectedEntry();
    return generateAnimeCode(entry);
  }

  /**
   * Exports a structured JSON blueprint for the currently selected (or specified) entry.
   *
   * @param  {String} [entryId]
   * @return {Object|null}
   */
  exportJSON(entryId) {
    const entry = entryId ? this.store.entries.get(entryId) || null : this.store.getSelectedEntry();
    return generateBlueprintJSON(entry);
  }

  /**
   * Disconnects `globals.editor`, unmounts UI, removes keyboard hooks, and restores real clock if active.
   *
   * @return {this}
   */
  dispose() {
    if (this._disposed) return this;
    this._disposed = true;
    this.store.disconnect();
    this.unmount();
    if (this._keyHandler && doc) {
      doc.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (!this._prevUseVirtual && engine.isVirtual) {
      engine.useRealClock();
    }
    if (activeStudio === this) activeStudio = null;
    return this;
  }

  /**
   * Alias for `dispose()`, compatible with Anime.js `Scope` / `Revertible`.
   *
   * @return {this}
   */
  revert() {
    return this.dispose();
  }
}

/**
 * Creates a new `Studio` instance and connects `globals.editor`.
 *
 * @param  {StudioOptions} [options]
 * @return {Studio}
 */
export const createStudio = options => {
  const studio = new Studio(options);
  activeStudio = studio;
  return studio;
};

/**
 * Convenience singleton launcher (similar to `showGUI()`), creating or showing the active Studio HUD.
 *
 * @param  {StudioOptions} [options]
 * @return {Studio}
 */
export const showStudio = (options = {}) => {
  if (activeStudio && !activeStudio._disposed) {
    if (!activeStudio.element && options.mount !== false && isBrowser) {
      activeStudio.mount(options.container, options.stageElement);
    }
    return activeStudio;
  }
  return createStudio(options);
};

/**
 * Disposes and hides the currently active Studio singleton if mounted.
 *
 * @return {void}
 */
export const hideStudio = () => {
  if (activeStudio) activeStudio.dispose();
};

/**
 * Returns the currently active `Studio` singleton if any.
 *
 * @return {Studio|null}
 */
export const getStudio = () => activeStudio;

export { StudioStore, classifyProperty } from './store.js';
export { generateAnimeCode, generateBlueprintJSON } from './codegen.js';
export { EASING_PRESETS, sampleEaseCurve, describeEasing, buildStudioEasing } from './easings-bridge.js';
