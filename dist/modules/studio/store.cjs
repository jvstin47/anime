/**
 * Anime.js - studio - CJS
 * @version v4.5.0
 * @license MIT
 * @copyright 2026 - Julian Garnier
 */

'use strict';

var globals = require('../core/globals.cjs');
var consts = require('../core/consts.cjs');
var helpers = require('../core/helpers.cjs');
var animation = require('../animation/animation.cjs');
var timeline = require('../timeline/timeline.cjs');
var target = require('../utils/target.cjs');
var stagger = require('../utils/stagger.cjs');
var easingsBridge = require('./easings-bridge.cjs');

/**
 * @import {
 *   TargetsParam,
 *   AnimationParams,
 *   TimelineParams,
 *   TimelinePosition,
 *   Tween,
 *   Tickable,
 *   Target,
 *   TweakRegister,
 * } from '../types/index.js'
 *
 * @import { EasingDescriptor } from './easings-bridge.js'
 */

/**
 * @typedef {'position'|'rotation'|'scale'|'animation'} PropertyCategory
 */

/**
 * @typedef {Object} StudioTweenTrack
 * @property {String} uid
 * @property {String} property
 * @property {PropertyCategory} category
 * @property {String} targetLabel
 * @property {Target} target
 * @property {Number} targetIndex
 * @property {Number} offset
 * @property {Number} delay
 * @property {Number} duration
 * @property {Number} endTime
 * @property {Number|null} fromNum
 * @property {Number|null} toNum
 * @property {String} fromText
 * @property {String} toText
 * @property {String} unit
 * @property {Boolean} isColor
 * @property {Boolean} isScalarEditable
 * @property {EasingDescriptor} easing
 * @property {Tween} tweenRef
 * @property {JSAnimation} animRef
 */

/**
 * @typedef {Object} StudioGroupTrack
 * @property {String} uid
 * @property {String} layerId
 * @property {String} label
 * @property {String} targetLabel
 * @property {Number} offset
 * @property {Number} delay
 * @property {Number} duration
 * @property {Number} endTime
 * @property {EasingDescriptor} easing
 * @property {Array<StudioTweenTrack>} tweens
 * @property {Array<Target>} targets
 * @property {JSAnimation} animRef
 * @property {Boolean} isStaggered
 * @property {String|null} staggerKey
 */

/**
 * @typedef {Object} StudioPropertySummary
 * @property {String} property
 * @property {PropertyCategory} category
 * @property {Number|null} fromNum
 * @property {Number|null} toNum
 * @property {String} fromText
 * @property {String} toText
 * @property {String} unit
 * @property {Boolean} isColor
 * @property {Boolean} isScalarEditable
 * @property {Array<StudioTweenTrack>} tweens
 */

/**
 * @typedef {Object} StudioLayerNode
 * @property {String} id
 * @property {String} name
 * @property {String} targetLabel
 * @property {'stagger-group'|'object'} kind
 * @property {Array<String>} groupUids
 * @property {String} primaryGroupUid
 * @property {Array<Target>} targets
 * @property {Number} offset
 * @property {Number} delay
 * @property {Number} duration
 * @property {Number} endTime
 * @property {EasingDescriptor} easing
 * @property {Boolean} isStaggered
 * @property {Boolean} hidden
 * @property {Boolean} locked
 * @property {Array<StudioPropertySummary>} properties
 */

/**
 * @typedef {Object} StudioEntry
 * @property {String} id
 * @property {'timeline'|'animation'|'set'} kind
 * @property {String} name
 * @property {Timeline|JSAnimation} instance
 * @property {Record<String, any>} rawParams
 * @property {Array<StudioGroupTrack>} groups
 * @property {Array<StudioLayerNode>} layers
 * @property {Array<{ name: String, time: Number }>} labels
 * @property {Array<{ name: String, time: Number }>} calls
 * @property {Boolean} [_dirty]
 * @property {Array<StudioGroupTrack>} [_groups]
 * @property {Array<StudioLayerNode>} [_layers]
 * @property {Array<{ name: String, time: Number }>} [_labels]
 * @property {Array<{ name: String, time: Number }>} [_calls]
 * @property {Number} createdAt
 */

/**
 * @typedef {Object} HistoryAction
 * @property {String} label
 * @property {() => void} undo
 * @property {() => void} redo
 */

/**
 * @typedef {Object} SceneConfigOption
 * @property {String} id
 * @property {String} label
 */

let studioEntrySeq = 0;

const POSITION_PROPS = new Set(['x', 'y', 'z', 'translateX', 'translateY', 'translateZ', 'left', 'top', 'right', 'bottom']);
const ROTATION_PROPS = new Set(['rot', 'rotate', 'rotateX', 'rotateY', 'rotateZ', 'orbitAngle', 'skew', 'skewX', 'skewY']);
const SCALE_PROPS = new Set(['scale', 'scaleX', 'scaleY', 'scaleZ', 'pulse']);

/**
 * Classifies a tween property name into Transform (`position`/`rotation`/`scale`) or `animation`.
 *
 * @param  {String} prop
 * @return {PropertyCategory}
 */
const classifyProperty = prop => {
  if (POSITION_PROPS.has(prop)) return 'position';
  if (ROTATION_PROPS.has(prop)) return 'rotation';
  if (SCALE_PROPS.has(prop)) return 'scale';
  return 'animation';
};

/**
 * Formats a DOM/JS/Three target into a readable short label for timeline rows.
 *
 * @param  {any} target
 * @param  {Number} [index]
 * @return {String}
 */
const formatTargetLabel = (target, index = 0) => {
  if (!target) return `target#${index}`;
  if (helpers.isStr(target)) return target;
  if (target[consts.isDomSymbol] || target[consts.isSvgSymbol] || (typeof Element !== 'undefined' && target instanceof Element)) {
    const tag = (target.tagName || 'el').toLowerCase();
    const id = target.id ? `#${target.id}` : '';
    const cls = target.classList && target.classList.length
      ? `.${Array.from(target.classList).slice(0, 2).join('.')}`
      : '';
    return `${tag}${id}${cls}`;
  }
  if (target.isObject3D) {
    return target.name ? `3D:${target.name}` : `3D:${target.type || 'Object3D'}`;
  }
  if (target.constructor && target.constructor.name && target.constructor.name !== 'Object') {
    return `${target.constructor.name}#${index}`;
  }
  return `obj#${index}`;
};

/**
 * Cleans an animation `id` into a human-friendly layer name (e.g. `"Orbital Matrix-0"` -> `"Orbital Matrix"`).
 *
 * @param  {String|Number|undefined} id
 * @param  {String} fallback
 * @param  {Boolean} stripIndexSuffix
 * @return {String}
 */
const formatLayerName = (id, fallback, stripIndexSuffix) => {
  if (helpers.isUnd(id) || id === null || id === '') return fallback;
  const s = String(id);
  return stripIndexSuffix ? s.replace(/-\d+$/, '') : s;
};

/**
 * Formats a tween's start or end value cleanly for inspector display.
 *
 * @param  {Tween} tween
 * @param  {'from'|'to'} side
 * @return {String}
 */
const formatTweenEndpoint = (tween, side) => {
  const vt = tween._valueType;
  if (vt === consts.valueTypes.COLOR) {
    const arr = side === 'from' ? tween._fromNumbers : tween._toNumbers;
    if (arr && arr.length >= 4) {
      return `rgba(${helpers.round(arr[0], 0)}, ${helpers.round(arr[1], 0)}, ${helpers.round(arr[2], 0)}, ${helpers.round(arr[3], 2)})`;
    }
  }
  if (vt === consts.valueTypes.COMPLEX) {
    const arr = side === 'from' ? tween._fromNumbers : tween._toNumbers;
    return arr && arr.length ? arr.map(n => helpers.round(n, 2)).join(', ') : String(tween._value || '');
  }
  const num = side === 'from' ? tween._fromNumber : tween._toNumber;
  return `${helpers.round(num, 2)}${tween._unit || ''}`;
};

/**
 * Central state store, Undo/Redo history manager, Layer Visibility/Lock manager, & `globals.editor` bridge.
 * All studio metadata lives outside Anime.js instances to preserve V8 fast object maps.
 */
class StudioStore {
  constructor() {
    /** @type {Map<String, StudioEntry>} */
    this.entries = new Map();
    /** @type {WeakMap<Object, StudioEntry>} */
    this._instanceToEntry = new WeakMap();
    /** @type {Map<String|Number, StudioEntry>} */
    this._tlIdToEntry = new Map();
    /** @type {WeakMap<Tween, EasingDescriptor>} */
    this._tweenEasingOverrides = new WeakMap();
    /** @type {WeakMap<JSAnimation, { rawEase?: any, targetSelector?: any, staggerKey?: String, rawParams?: any }>} */
    this._animHints = new WeakMap();
    /** @type {Map<String, Array<{ rawParams: any, targetSelector: any, position: any, staggerKey: String }>>} */
    this._pendingTlChildHints = new Map();
    /** @type {Map<String, Array<{ name: String, position: any }>>} */
    this._pendingTlCalls = new Map();
    /** @type {Set<() => void>} */
    this._listeners = new Set();
    /** @type {Boolean} */
    this._suspended = false;

    /** @type {String|null} */
    this.selectedEntryId = null;
    /** @type {String|null} */
    this.selectedLayerId = null;
    /** @type {String|null} */
    this.selectedGroupUid = null;
    /** @type {String|null} */
    this.selectedTweenUid = null;
    /** @type {String|null} */
    this.selectedProperty = null;

    // Layer visibility & lock registries (outside core instances)
    /** @type {Set<String>} */
    this._hiddenLayers = new Set();
    /** @type {Set<String>} */
    this._lockedLayers = new Set();
    /** @type {WeakSet<Object>} */
    this._hiddenTargets = new WeakSet();
    /** @type {WeakMap<Object, String>} */
    this._prevDomVisibility = new WeakMap();

    // Project state & Undo / Redo history
    this.projectName = 'Untitled Motion';
    this.editCount = 0;
    this.savedEditCount = 0;
    this.lastSavedAt = null;
    /** @type {Array<HistoryAction>} */
    this._undoStack = [];
    /** @type {Array<HistoryAction>} */
    this._redoStack = [];
    /** @type {{ label: String, actions: Array<HistoryAction> }|null} */
    this._activeBatch = null;

    // Host scene actions (optional; wired by workbenches/apps)
    /** @type {Array<SceneConfigOption>} */
    this.scenes = [];
    /** @type {String|null} */
    this.activeSceneId = null;
    /** @type {((sceneId: String) => void)|null} */
    this._onSelectScene = null;
    /** @type {(() => void)|null} */
    this._onAddObject = null;

    this._prevEditor = null;

    /** @type {import('../core/globals.js').EditorGlobals} */
    this.editorGlobals = {
      showPanel: true,
      _head: null,
      _tail: null,
      addAnimation: (targets, parameters) => this._handleAddAnimation(targets, parameters),
      addSet: (targets, parameters) => this._handleAddSet(targets, parameters),
      addTimeline: parameters => this._handleAddTimeline(parameters),
      addTimelineChild: (targets, childParams, tlId, position, parsedLength) =>
        this._handleAddTimelineChild(targets, childParams, tlId, position, parsedLength),
      addTimelineLabel: (labelName, position, tlId) => {
        const entry = this._tlIdToEntry.get(tlId);
        if (entry) entry._dirty = true;
        this._notifySoon();
        return position;
      },
      addTimelineCall: (callback, position, tlId) => {
        const key = String(tlId);
        if (!this._pendingTlCalls.has(key)) this._pendingTlCalls.set(key, []);
        this._pendingTlCalls.get(key).push({
          name: callback && callback.name ? callback.name : 'call()',
          position,
        });
        const entry = this._tlIdToEntry.get(tlId);
        if (entry) entry._dirty = true;
        this._notifySoon();
        return position;
      },
      addTimelineSync: (synced, position, tlId) => {
        const entry = this._tlIdToEntry.get(tlId);
        if (entry) entry._dirty = true;
        this._notifySoon();
        return position;
      },
      resolveStagger: tweakVal => {
        if (helpers.isFnc(tweakVal)) return tweakVal;
        if (tweakVal && typeof tweakVal === 'object') {
          return stagger.stagger(tweakVal.val !== undefined ? tweakVal.val : 0, tweakVal.params || {});
        }
        return stagger.stagger(Number(tweakVal) || 0);
      },
    };

    this._notifyQueued = false;
  }

  /** @return {Boolean} */
  get canUndo() {
    return this._undoStack.length > 0;
  }

  /** @return {Boolean} */
  get canRedo() {
    return this._redoStack.length > 0;
  }

  /** @return {Boolean} */
  get isDirty() {
    return this.editCount !== this.savedEditCount;
  }

  /** Connects `globals.editor` to capture all subsequent `animate()`, `utils.set()`, and `createTimeline()` calls. */
  connect() {
    if (globals.globals.editor === this.editorGlobals) return this;
    this._prevEditor = globals.globals.editor;
    globals.globals.editor = this.editorGlobals;
    return this;
  }

  /** Restores the previous `globals.editor` state cleanly. */
  disconnect() {
    if (globals.globals.editor === this.editorGlobals) {
      globals.globals.editor = this._prevEditor;
      this._prevEditor = null;
    }
    return this;
  }

  /**
   * Executes `fn` with `globals.editor` temporarily bypassed so internal Anime.js creation doesn't recurse.
   *
   * @template T
   * @param  {() => T} fn
   * @return {T}
   */
  _withSuspended(fn) {
    if (this._suspended) return fn();
    const prev = globals.globals.editor;
    this._suspended = true;
    globals.globals.editor = null;
    try {
      return fn();
    } finally {
      globals.globals.editor = prev;
      this._suspended = false;
    }
  }

  /** @param {() => void} listener @return {() => void} */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** @return {void} */
  emit() {
    this._listeners.forEach(fn => fn());
  }

  /** Coalesces rapid `.add()` / `.label()` mutations into one microtask notification. */
  _notifySoon() {
    if (this._notifyQueued) return;
    this._notifyQueued = true;
    queueMicrotask(() => {
      this._notifyQueued = false;
      this.refreshAll();
      this.emit();
    });
  }

  // =========================================================
  // History (Undo / Redo) & Project Status
  // =========================================================

  /**
   * Begins grouping continuous edits (e.g. pointer drag or range scrub) into one Undo entry.
   *
   * @param  {String} label
   * @return {void}
   */
  beginBatch(label) {
    if (this._activeBatch) return;
    this._activeBatch = { label, actions: [] };
  }

  /** Commits the current batch onto the Undo stack as one composite action. */
  commitBatch() {
    const batch = this._activeBatch;
    this._activeBatch = null;
    if (!batch || !batch.actions.length) return;
    const actions = batch.actions;
    this._pushHistory({
      label: batch.label,
      undo: () => {
        for (let i = actions.length - 1; i >= 0; i--) actions[i].undo();
      },
      redo: () => {
        for (let i = 0; i < actions.length; i++) actions[i].redo();
      },
    });
  }

  /**
   * @param  {HistoryAction} action
   * @return {void}
   */
  _pushHistory(action) {
    if (this._activeBatch) {
      this._activeBatch.actions.push(action);
      return;
    }
    this._undoStack.push(action);
    if (this._undoStack.length > 100) this._undoStack.shift();
    this._redoStack = [];
    this.editCount++;
  }

  /** @return {Boolean} */
  undo() {
    if (!this._undoStack.length) return false;
    const action = this._undoStack.pop();
    action.undo();
    this._redoStack.push(action);
    this.editCount = Math.max(0, this.editCount - 1);
    this.emit();
    return true;
  }

  /** @return {Boolean} */
  redo() {
    if (!this._redoStack.length) return false;
    const action = this._redoStack.pop();
    action.redo();
    this._undoStack.push(action);
    this.editCount++;
    this.emit();
    return true;
  }

  /** Marks current state as saved and optionally persists a snapshot to `localStorage`. */
  markSaved(jsonSnapshot = null) {
    this.savedEditCount = this.editCount;
    this.lastSavedAt = Date.now();
    if (jsonSnapshot && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`anime-studio:${this.projectName}`, JSON.stringify(jsonSnapshot));
      } catch {
        // Ignore storage quota errors
      }
    }
    this.emit();
  }

  /** @param {String} name */
  setProjectName(name) {
    const next = (name || '').trim() || 'Untitled Motion';
    if (next === this.projectName) return;
    this.projectName = next;
    this.editCount++;
    this.emit();
  }

  // =========================================================
  // Scene Integration Hooks
  // =========================================================

  /**
   * Registers host scenes and optional Add-Object callback so the header/sidebar control them natively.
   *
   * @param {{ scenes?: Array<SceneConfigOption>, activeSceneId?: String, onSelectScene?: (id: String) => void, onAddObject?: () => void }} config
   */
  setSceneSupport(config = {}) {
    this.scenes = config.scenes || [];
    this.activeSceneId = config.activeSceneId || (this.scenes[0] ? this.scenes[0].id : null);
    this._onSelectScene = config.onSelectScene || null;
    this._onAddObject = config.onAddObject || null;
    this.emit();
  }

  /** @param {String} sceneId */
  selectScene(sceneId) {
    this.activeSceneId = sceneId;
    if (this._onSelectScene) {
      this._onSelectScene(sceneId);
    }
    this.emit();
  }

  /** @return {Boolean} */
  get supportsAddObject() {
    return helpers.isFnc(this._onAddObject);
  }

  /** Triggers registered scene Add-Object action if available. */
  addObject() {
    if (!this._onAddObject) return;
    this._onAddObject();
    this.editCount++;
    this.emit();
  }

  // =========================================================
  // EditorGlobals Capture Handlers
  // =========================================================

  /**
   * @param  {TargetsParam} targets
   * @param  {AnimationParams} parameters
   * @return {JSAnimation}
   */
  _handleAddAnimation(targets, parameters) {
    const anim = this._withSuspended(() => new animation.JSAnimation(targets, parameters, null, 0, false).init());
    this._animHints.set(anim, {
      rawEase: parameters ? parameters.ease : undefined,
      rawParams: parameters,
      targetSelector: helpers.isStr(targets) ? targets : null,
    });
    this.attach(anim, parameters && parameters.id !== undefined ? String(parameters.id) : undefined, 'animation', parameters);
    return anim;
  }

  /**
   * @param  {TargetsParam} targets
   * @param  {AnimationParams} parameters
   * @return {JSAnimation}
   */
  _handleAddSet(targets, parameters) {
    const anim = this._withSuspended(() => target.set(targets, parameters));
    if (anim) {
      this._animHints.set(anim, {
        rawEase: parameters ? parameters.ease : undefined,
        rawParams: parameters,
        targetSelector: helpers.isStr(targets) ? targets : null,
      });
      this.attach(anim, parameters && parameters.id !== undefined ? String(parameters.id) : undefined, 'set', parameters);
    }
    return anim;
  }

  /**
   * @param  {TimelineParams} [parameters]
   * @return {Timeline}
   */
  _handleAddTimeline(parameters) {
    const tl = this._withSuspended(() => new timeline.Timeline(parameters).init());
    const entry = this.attach(
      tl,
      parameters && parameters.id !== undefined ? String(parameters.id) : undefined,
      'timeline',
      parameters || {}
    );
    this._tlIdToEntry.set(tl.id, entry);
    return tl;
  }

  /**
   * @param  {TargetsParam} targets
   * @param  {AnimationParams} childParams
   * @param  {String|Number} tlId
   * @param  {TimelinePosition|Function|TweakRegister} position
   * @param  {Number} [parsedLength]
   * @return {AnimationParams}
   */
  _handleAddTimelineChild(targets, childParams, tlId, position, parsedLength) {
    const key = String(tlId);
    if (!this._pendingTlChildHints.has(key)) this._pendingTlChildHints.set(key, []);
    const count = parsedLength && parsedLength > 1 ? parsedLength : 1;
    const staggerKey = count > 1 ? `stagger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : null;
    const hint = {
      rawParams: childParams,
      rawEase: childParams ? childParams.ease : undefined,
      targetSelector: helpers.isStr(targets) ? targets : null,
      position,
      staggerKey,
    };
    const arr = this._pendingTlChildHints.get(key);
    for (let i = 0; i < count; i++) arr.push(hint);
    const tlEntry = this._tlIdToEntry.get(tlId);
    if (tlEntry) tlEntry._dirty = true;
    this._notifySoon();
    return childParams;
  }

  /**
   * Attaches any `Timeline` or `JSAnimation` (even if created before Studio connected) for inspection & editing.
   *
   * @param  {Timeline|JSAnimation} instance
   * @param  {String} [customName]
   * @param  {'timeline'|'animation'|'set'} [kindHint]
   * @param  {Record<String, any>} [rawParams]
   * @return {StudioEntry}
   */
  attach(instance, customName, kindHint, rawParams = {}) {
    if (this._instanceToEntry.has(instance)) {
      const existing = this._instanceToEntry.get(instance);
      this.refreshEntry(existing);
      this.emit();
      return existing;
    }

    const isTimeline = instance instanceof timeline.Timeline || (instance._hasChildren && !helpers.isUnd(/** @type {Timeline} */(/** @type {unknown} */(instance)).labels));
    const kind = kindHint || (isTimeline ? 'timeline' : 'animation');
    const id = `entry-${++studioEntrySeq}`;
    const name = customName || (
      kind === 'timeline'
        ? `Timeline #${instance.id}`
        : `${kind === 'set' ? 'Set' : 'Anim'} #${instance.id}`
    );

    const store = this;
    /** @type {StudioEntry} */
    const entry = {
      id,
      kind,
      name,
      instance,
      rawParams: rawParams || {},
      _dirty: false,
      _groups: [],
      _layers: [],
      _labels: [],
      _calls: [],
      get groups() {
        if (this._dirty) store.refreshEntry(this);
        return this._groups;
      },
      set groups(v) {
        this._groups = v;
      },
      get layers() {
        if (this._dirty) store.refreshEntry(this);
        return this._layers;
      },
      set layers(v) {
        this._layers = v;
      },
      get labels() {
        if (this._dirty) store.refreshEntry(this);
        return this._labels;
      },
      set labels(v) {
        this._labels = v;
      },
      get calls() {
        if (this._dirty) store.refreshEntry(this);
        return this._calls;
      },
      set calls(v) {
        this._calls = v;
      },
      createdAt: Date.now(),
    };

    this.entries.set(id, entry);
    this._instanceToEntry.set(instance, entry);
    if (isTimeline) this._tlIdToEntry.set(instance.id, entry);

    this.refreshEntry(entry);
    if (!this.selectedEntryId) {
      this.selectedEntryId = id;
    }
    this.emit();
    return entry;
  }

  /**
   * Removes an entry from the Studio registry.
   *
   * @param  {String} entryId
   * @return {void}
   */
  detach(entryId) {
    const entry = this.entries.get(entryId);
    if (!entry) return;
    this._instanceToEntry.delete(entry.instance);
    this.entries.delete(entryId);
    if (this.selectedEntryId === entryId) {
      const first = this.entries.keys().next();
      this.selectedEntryId = first.done ? null : first.value;
      this.selectedLayerId = null;
      this.selectedGroupUid = null;
      this.selectedTweenUid = null;
      this.selectedProperty = null;
    }
    this.emit();
  }

  /** Refreshes track & layer snapshots across all registered entries. */
  refreshAll() {
    this.entries.forEach(entry => this.refreshEntry(entry));
  }

  /**
   * Extracts up-to-date live tracks, hierarchical layer groups, labels, and tween timings.
   *
   * @param  {StudioEntry} entry
   * @return {StudioEntry}
   */
  refreshEntry(entry) {
    const inst = entry.instance;
    const groups = [];
    const labels = [];
    const calls = [];

    if (entry.kind === 'timeline') {
      const tl = /** @type {Timeline} */(inst);
      for (const labelName in tl.labels) {
        labels.push({ name: labelName, time: tl.labels[labelName] });
      }
      labels.sort((a, b) => a.time - b.time);

      const tlKey = String(tl.id);
      const childHints = this._pendingTlChildHints.get(tlKey) || [];
      const callHints = this._pendingTlCalls.get(tlKey) || [];
      let childIdx = 0;
      let callIdx = 0;

      helpers.forEachChildren(tl, (/** @type {Tickable} */child) => {
        const isAnimChild = !helpers.isUnd(/** @type {JSAnimation} */(child).targets);
        if (!isAnimChild) {
          const callHint = callHints[callIdx++] || null;
          calls.push({
            name: callHint ? callHint.name : `timer#${child.id}`,
            time: (child._offset || 0) + (child._delay || 0),
          });
          return;
        }
        const animChild = /** @type {JSAnimation} */(child);
        const hint = this._animHints.get(animChild) || childHints[childIdx] || null;
        if (hint && !this._animHints.has(animChild)) {
          this._animHints.set(animChild, hint);
        }
        groups.push(this._buildGroupTrack(entry.id, animChild, childIdx, hint));
        childIdx++;
      });
    } else {
      const anim = /** @type {JSAnimation} */(inst);
      const hint = this._animHints.get(anim) || { rawEase: entry.rawParams ? entry.rawParams.ease : undefined, rawParams: entry.rawParams };
      groups.push(this._buildGroupTrack(entry.id, anim, 0, hint));
    }

    const layers = this._buildLayers(entry.id, groups);

    entry._dirty = false;
    entry._groups = groups;
    entry._layers = layers;
    entry._labels = labels;
    entry._calls = calls;
    return entry;
  }

  /**
   * Builds meaningful hierarchical `StudioLayerNode`s by coalescing `staggerKey` sibling groups.
   *
   * @param  {String} entryId
   * @param  {Array<StudioGroupTrack>} groups
   * @return {Array<StudioLayerNode>}
   */
  _buildLayers(entryId, groups) {
    /** @type {Array<StudioLayerNode>} */
    const layers = [];
    /** @type {Map<String, Array<StudioGroupTrack>>} */
    const bucketMap = new Map();
    /** @type {Array<String>} */
    const bucketOrder = [];

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const bucketKey = g.staggerKey ? `stagger:${g.staggerKey}` : `single:${g.uid}`;
      if (!bucketMap.has(bucketKey)) {
        bucketMap.set(bucketKey, []);
        bucketOrder.push(bucketKey);
      }
      bucketMap.get(bucketKey).push(g);
    }

    for (let b = 0; b < bucketOrder.length; b++) {
      const key = bucketOrder[b];
      const members = bucketMap.get(key);
      const first = members[0];
      const isStaggerGroup = members.length > 1 || first.targets.length > 1;
      const layerId = `${entryId}:layer:${b}`;

      let minOffset = Infinity;
      let maxEnd = 0;
      let minDelay = Infinity;
      /** @type {Array<Target>} */
      const targets = [];
      const seenTargets = new Set();
      /** @type {Map<String, StudioPropertySummary>} */
      const propMap = new Map();

      for (let m = 0; m < members.length; m++) {
        const g = members[m];
        g.layerId = layerId;
        if (g.offset < minOffset) minOffset = g.offset;
        if (g.delay < minDelay) minDelay = g.delay;
        if (g.endTime > maxEnd) maxEnd = g.endTime;

        for (let t = 0; t < g.targets.length; t++) {
          const tgt = g.targets[t];
          if (!seenTargets.has(tgt)) {
            seenTargets.add(tgt);
            targets.push(tgt);
          }
        }

        for (let twIdx = 0; twIdx < g.tweens.length; twIdx++) {
          const tw = g.tweens[twIdx];
          if (!propMap.has(tw.property)) {
            propMap.set(tw.property, {
              property: tw.property,
              category: tw.category,
              fromNum: tw.fromNum,
              toNum: tw.toNum,
              fromText: tw.fromText,
              toText: tw.toText,
              unit: tw.unit,
              isColor: tw.isColor,
              isScalarEditable: tw.isScalarEditable,
              tweens: [],
            });
          }
          propMap.get(tw.property).tweens.push(tw);
        }
      }

      if (minOffset === Infinity) minOffset = 0;
      if (minDelay === Infinity) minDelay = 0;

      const rawId = first.animRef.id;
      const cleanName = formatLayerName(rawId, first.targetLabel, members.length > 1);
      const displayName = cleanName.startsWith('#') || cleanName.startsWith('.') ? cleanName : cleanName;

      layers.push({
        id: layerId,
        name: displayName,
        targetLabel: first.targetLabel,
        kind: isStaggerGroup ? 'stagger-group' : 'object',
        groupUids: members.map(g => g.uid),
        primaryGroupUid: first.uid,
        targets,
        offset: minOffset,
        delay: minDelay,
        duration: Math.max(0, maxEnd - minOffset - minDelay),
        endTime: maxEnd,
        easing: first.easing,
        isStaggered: isStaggerGroup,
        hidden: this._hiddenLayers.has(layerId),
        locked: this._lockedLayers.has(layerId),
        properties: Array.from(propMap.values()),
      });
    }

    return layers;
  }

  /**
   * @param  {String} entryId
   * @param  {JSAnimation} anim
   * @param  {Number} groupIdx
   * @param  {any} hint
   * @return {StudioGroupTrack}
   */
  _buildGroupTrack(entryId, anim, groupIdx, hint) {
    const targets = anim.targets || [];
    const targetLabel = (hint && hint.targetSelector)
      ? hint.targetSelector
      : (targets.length > 1 ? `${formatTargetLabel(targets[0])} (${targets.length})` : formatTargetLabel(targets[0]));

    /** @type {Array<StudioTweenTrack>} */
    const tweens = [];
    let firstEase = null;
    let tIdx = 0;
    const rawParams = (hint && hint.rawParams) || {};
    const targetIndexMap = new WeakMap();
    targets.forEach((t, i) => targetIndexMap.set(t, i));

    helpers.forEachChildren(anim, (/** @type {Tween} */tw) => {
      const overrideEase = this._tweenEasingOverrides.get(tw);
      const propRaw = rawParams[tw.property];
      const propRawEase = propRaw && typeof propRaw === 'object' && !helpers.isArr(propRaw) ? propRaw.ease : undefined;
      const rawEase = overrideEase ? null : (propRawEase !== undefined ? propRawEase : (hint ? hint.rawEase : undefined));
      const easing = overrideEase || easingsBridge.describeEasing(rawEase, tw._ease);
      if (!firstEase) firstEase = easing;

      const tIndex = targetIndexMap.has(tw.target) ? targetIndexMap.get(tw.target) : 0;
      const startOffset = (anim._offset || 0) + (anim._delay || 0) + ((tw._startTime || 0) - (tw._delay || 0));
      const delay = tw._delay || 0;
      const duration = tw._updateDuration <= consts.minValue ? 0 : tw._updateDuration;
      const isScalarEditable = tw._valueType === consts.valueTypes.NUMBER || tw._valueType === consts.valueTypes.UNIT;

      tweens.push({
        uid: `${entryId}:g${groupIdx}:t${tIdx++}`,
        property: tw.property,
        category: classifyProperty(tw.property),
        targetLabel: formatTargetLabel(tw.target, tIndex),
        target: tw.target,
        targetIndex: tIndex,
        offset: startOffset,
        delay,
        duration,
        endTime: startOffset + delay + duration,
        fromNum: isScalarEditable ? helpers.round(tw._fromNumber, 3) : null,
        toNum: isScalarEditable ? helpers.round(tw._toNumber, 3) : null,
        fromText: formatTweenEndpoint(tw, 'from'),
        toText: formatTweenEndpoint(tw, 'to'),
        unit: tw._unit || '',
        isColor: tw._valueType === consts.valueTypes.COLOR,
        isScalarEditable,
        easing,
        tweenRef: tw,
        animRef: anim,
      });
    });

    const offset = anim._offset || 0;
    const delay = anim._delay || 0;
    const duration = anim.duration <= consts.minValue ? 0 : anim.duration;

    return {
      uid: `${entryId}:g${groupIdx}`,
      layerId: '',
      label: anim.id !== undefined ? String(anim.id) : `${targetLabel}`,
      targetLabel,
      offset,
      delay,
      duration,
      endTime: offset + delay + duration,
      easing: firstEase || easingsBridge.describeEasing(hint ? hint.rawEase : undefined),
      tweens,
      targets,
      animRef: anim,
      isStaggered: !!(hint && hint.staggerKey) || targets.length > 1,
      staggerKey: hint && hint.staggerKey ? hint.staggerKey : null,
    };
  }

  /** @return {StudioEntry|null} */
  getSelectedEntry() {
    if (this.selectedEntryId && this.entries.has(this.selectedEntryId)) {
      return this.entries.get(this.selectedEntryId);
    }
    const first = this.entries.values().next();
    return first.done ? null : first.value;
  }

  /**
   * Resolves the currently selected entry, layer, group, and tween.
   * Note: Selection is intentionally allowed to be `null` when explicitly cleared (`selectedLayerId === '__none__'`).
   *
   * @return {{ entry: StudioEntry|null, layer: StudioLayerNode|null, group: StudioGroupTrack|null, tween: StudioTweenTrack|null }}
   */
  getSelection() {
    const entry = this.getSelectedEntry();
    if (!entry) return { entry: null, layer: null, group: null, tween: null };

    if (this.selectedLayerId === '__none__') {
      return { entry, layer: null, group: null, tween: null };
    }

    let group = this.selectedGroupUid ? entry.groups.find(g => g.uid === this.selectedGroupUid) || null : null;
    let tween = null;

    if (this.selectedTweenUid) {
      for (const g of entry.groups) {
        const hit = g.tweens.find(t => t.uid === this.selectedTweenUid);
        if (hit) {
          group = g;
          tween = hit;
          break;
        }
      }
    }

    let layer = this.selectedLayerId ? entry.layers.find(l => l.id === this.selectedLayerId) || null : null;
    if (!layer && group) {
      layer = entry.layers.find(l => l.id === group.layerId) || null;
    }
    if (!layer && !this.selectedLayerId && entry.layers.length) {
      layer = entry.layers[0];
    }
    if (!group && layer) {
      group = entry.groups.find(g => g.uid === layer.primaryGroupUid) || entry.groups[0] || null;
    }
    if (!tween && group && group.tweens.length) {
      if (this.selectedProperty) {
        tween = group.tweens.find(t => t.property === this.selectedProperty) || group.tweens[0];
      } else {
        tween = group.tweens[0];
      }
    }

    return { entry, layer, group, tween };
  }

  // =========================================================
  // Layer Visibility & Lock Controls
  // =========================================================

  /**
   * Returns `true` if `target` is currently visible (not hidden by a layer toggle).
   *
   * @param  {any} target
   * @return {Boolean}
   */
  isTargetVisible(target) {
    if (!target) return true;
    return !this._hiddenTargets.has(target);
  }

  /**
   * @param  {StudioLayerNode} layer
   * @param  {Boolean} hidden
   * @return {void}
   */
  _applyLayerHidden(layer, hidden) {
    if (hidden) this._hiddenLayers.add(layer.id);
    else this._hiddenLayers.delete(layer.id);

    for (let i = 0; i < layer.targets.length; i++) {
      const t = /** @type {any} */(layer.targets[i]);
      if (!t) continue;
      if (hidden) this._hiddenTargets.add(t);
      else this._hiddenTargets.delete(t);

      if (t[consts.isDomSymbol] || t[consts.isSvgSymbol] || (typeof Element !== 'undefined' && t instanceof Element)) {
        const el = /** @type {HTMLElement} */(t);
        if (hidden) {
          if (!this._prevDomVisibility.has(el)) {
            this._prevDomVisibility.set(el, el.style.visibility || '');
          }
          el.style.visibility = 'hidden';
        } else {
          const prev = this._prevDomVisibility.get(el) || '';
          el.style.visibility = prev;
        }
      } else if (typeof t === 'object' && 'visible' in t) {
        t.visible = !hidden;
      }
    }
  }

  /**
   * Toggles visibility of a layer (hiding/showing both DOM elements and JS/Canvas targets) with Undo support.
   *
   * @param  {String} entryId
   * @param  {String} layerId
   * @return {void}
   */
  toggleLayerVisibility(entryId, layerId) {
    const entry = this.entries.get(entryId);
    if (!entry) return;
    const layer = entry.layers.find(l => l.id === layerId);
    if (!layer) return;
    const nextHidden = !this._hiddenLayers.has(layerId);

    const apply = hide => {
      this._applyLayerHidden(layer, hide);
      this.refreshEntry(entry);
      this._reseekPreservingState(entry.instance);
      this.emit();
    };

    apply(nextHidden);
    this._pushHistory({
      label: `${nextHidden ? 'Hide' : 'Show'} ${layer.name}`,
      undo: () => apply(!nextHidden),
      redo: () => apply(nextHidden),
    });
  }

  /**
   * Toggles edit-lock state on a layer with Undo support.
   *
   * @param  {String} entryId
   * @param  {String} layerId
   * @return {void}
   */
  toggleLayerLock(entryId, layerId) {
    const entry = this.entries.get(entryId);
    if (!entry) return;
    const layer = entry.layers.find(l => l.id === layerId);
    if (!layer) return;
    const nextLocked = !this._lockedLayers.has(layerId);

    const apply = lock => {
      if (lock) this._lockedLayers.add(layerId);
      else this._lockedLayers.delete(layerId);
      this.refreshEntry(entry);
      this.emit();
    };

    apply(nextLocked);
    this._pushHistory({
      label: `${nextLocked ? 'Lock' : 'Unlock'} ${layer.name}`,
      undo: () => apply(!nextLocked),
      redo: () => apply(nextLocked),
    });
  }

  /**
   * Checks whether `group` belongs to a locked layer.
   *
   * @param  {StudioGroupTrack} group
   * @return {Boolean}
   */
  isGroupLocked(group) {
    return !!(group && group.layerId && this._lockedLayers.has(group.layerId));
  }

  // =========================================================
  // Live Mutations (Offset, Duration, Easing, Tween Values)
  // =========================================================

  /**
   * Live-updates a group's offset (`_offset` in Timeline or `_delay` for standalone animations) and re-seeks.
   *
   * @param  {String} entryId
   * @param  {String} groupUid
   * @param  {Number} newOffsetMs
   * @return {void}
   */
  updateGroupOffset(entryId, groupUid, newOffsetMs) {
    const entry = this.entries.get(entryId);
    if (!entry) return;
    const group = entry.groups.find(g => g.uid === groupUid);
    if (!group || this.isGroupLocked(group)) return;
    const safeOffset = Math.max(0, helpers.round(newOffsetMs, 2));
    const prevOffset = entry.kind === 'timeline' ? group.animRef._offset : group.animRef._delay;
    if (safeOffset === prevOffset) return;

    const apply = val => {
      if (entry.kind === 'timeline') {
        group.animRef._offset = val;
        easingsBridge.recomputeTimelineTimings(/** @type {Timeline} */(entry.instance));
      } else {
        group.animRef._delay = val;
      }
      this._reseekPreservingState(entry.instance);
      this.refreshEntry(entry);
      this.emit();
    };

    this._pushHistory({
      label: `Move ${group.targetLabel} to ${Math.round(safeOffset)}ms`,
      undo: () => apply(prevOffset),
      redo: () => apply(safeOffset),
    });
    apply(safeOffset);
  }

  /**
   * Shifts all child groups of a layer by `deltaMs`.
   *
   * @param  {String} entryId
   * @param  {String} layerId
   * @param  {Number} deltaMs
   * @return {void}
   */
  shiftLayerOffset(entryId, layerId, deltaMs) {
    const entry = this.entries.get(entryId);
    if (!entry) return;
    const layer = entry.layers.find(l => l.id === layerId);
    if (!layer || this._lockedLayers.has(layerId)) return;

    const members = entry.groups.filter(g => layer.groupUids.includes(g.uid));
    if (!members.length) return;
    const minOff = members.reduce((m, g) => Math.min(m, entry.kind === 'timeline' ? g.animRef._offset : g.animRef._delay), Infinity);
    const clampedDelta = Math.max(-minOff, helpers.round(deltaMs, 2));
    if (!clampedDelta) return;

    this.beginBatch(`Shift ${layer.name}`);
    for (let i = 0; i < members.length; i++) {
      const g = members[i];
      const cur = entry.kind === 'timeline' ? g.animRef._offset : g.animRef._delay;
      this.updateGroupOffset(entryId, g.uid, cur + clampedDelta);
    }
    this.commitBatch();
  }

  /**
   * Live-stretches a group animation's duration (`stretch()`) and updates parent timeline bounds.
   *
   * @param  {String} entryId
   * @param  {String} groupUid
   * @param  {Number} newDurationMs
   * @return {void}
   */
  updateGroupDuration(entryId, groupUid, newDurationMs) {
    const entry = this.entries.get(entryId);
    if (!entry) return;
    const group = entry.groups.find(g => g.uid === groupUid);
    if (!group || this.isGroupLocked(group)) return;
    const safeDur = Math.max(10, helpers.round(newDurationMs, 2));
    const prevDur = group.animRef.duration;
    if (safeDur === prevDur) return;

    const apply = val => {
      group.animRef.stretch(val);
      if (entry.kind === 'timeline') {
        easingsBridge.recomputeTimelineTimings(/** @type {Timeline} */(entry.instance));
      }
      this._reseekPreservingState(entry.instance);
      this.refreshEntry(entry);
      this.emit();
    };

    this._pushHistory({
      label: `Resize ${group.targetLabel} to ${Math.round(safeDur)}ms`,
      undo: () => apply(prevDur),
      redo: () => apply(safeDur),
    });
    apply(safeDur);
  }

  /**
   * Live-applies a new easing or spring curve to matching tweens (or all tweens in a group/layer).
   *
   * @param  {String} entryId
   * @param  {String} groupUid
   * @param  {String|null} tweenUid
   * @param  {{ kind: 'ease'|'bezier'|'spring', value?: String, bezier?: [Number, Number, Number, Number], spring?: any }} spec
   * @param  {Boolean} [applyToGroup=true]
   * @param  {Array<String>|null} [overrideGroupUids=null]
   * @return {void}
   */
  updateEasing(entryId, groupUid, tweenUid, spec, applyToGroup = true, overrideGroupUids = null) {
    const entry = this.entries.get(entryId);
    if (!entry) return;
    const group = entry.groups.find(g => g.uid === groupUid);
    if (!group || this.isGroupLocked(group)) return;

    const built = easingsBridge.buildStudioEasing(spec);
    const targetGroups = overrideGroupUids
      ? entry.groups.filter(g => overrideGroupUids.includes(g.uid))
      : [group];

    /** @type {Array<{ tw: Tween, anim: JSAnimation, prevEase: any, prevDesc: EasingDescriptor|undefined, prevUpdateDur: Number, prevChangeDur: Number }>} */
    const snapshots = [];

    for (let gi = 0; gi < targetGroups.length; gi++) {
      const g = targetGroups[gi];
      const targetTweens = applyToGroup
        ? g.tweens
        : g.tweens.filter(t => t.uid === tweenUid);
      for (let i = 0; i < targetTweens.length; i++) {
        const twTrack = targetTweens[i];
        const tw = twTrack.tweenRef;
        snapshots.push({
          tw,
          anim: g.animRef,
          prevEase: tw._ease,
          prevDesc: this._tweenEasingOverrides.get(tw),
          prevUpdateDur: tw._updateDuration,
          prevChangeDur: tw._changeDuration,
        });
      }
    }

    if (!snapshots.length) return;

    const applyNew = () => {
      const touchedAnims = new Set();
      for (let i = 0; i < snapshots.length; i++) {
        const snap = snapshots[i];
        snap.tw._ease = built.fn;
        this._tweenEasingOverrides.set(snap.tw, built.descriptor);
        if (built.springInstance) {
          built.springInstance.parent = snap.anim;
          snap.tw._updateDuration = built.springInstance.settlingDuration;
          snap.tw._changeDuration = built.springInstance.settlingDuration;
          touchedAnims.add(snap.anim);
        }
      }
      touchedAnims.forEach(anim => easingsBridge.recomputeAnimationTimings(anim));
      this._reseekPreservingState(entry.instance);
      this.refreshEntry(entry);
      this.emit();
    };

    const revertOld = () => {
      const touchedAnims = new Set();
      for (let i = 0; i < snapshots.length; i++) {
        const snap = snapshots[i];
        snap.tw._ease = snap.prevEase;
        if (snap.prevDesc) this._tweenEasingOverrides.set(snap.tw, snap.prevDesc);
        else this._tweenEasingOverrides.delete(snap.tw);
        snap.tw._updateDuration = snap.prevUpdateDur;
        snap.tw._changeDuration = snap.prevChangeDur;
        touchedAnims.add(snap.anim);
      }
      touchedAnims.forEach(anim => easingsBridge.recomputeAnimationTimings(anim));
      this._reseekPreservingState(entry.instance);
      this.refreshEntry(entry);
      this.emit();
    };

    this._pushHistory({
      label: `Ease -> ${built.label}`,
      undo: revertOld,
      redo: applyNew,
    });
    applyNew();
  }

  /**
   * Live-updates scalar `from` / `to` values across matching property tweens in `groupUids`.
   *
   * @param  {String} entryId
   * @param  {Array<String>} groupUids
   * @param  {String} propertyName
   * @param  {{ from?: Number, to?: Number }} patch
   * @return {void}
   */
  updateTweenValues(entryId, groupUids, propertyName, patch) {
    const entry = this.entries.get(entryId);
    if (!entry) return;
    const targetGroups = entry.groups.filter(g => groupUids.includes(g.uid));
    if (!targetGroups.length || targetGroups.some(g => this.isGroupLocked(g))) return;

    /** @type {Array<{ tw: Tween, prevFrom: Number, prevTo: Number, prevVal: any }>} */
    const snapshots = [];
    for (let i = 0; i < targetGroups.length; i++) {
      const g = targetGroups[i];
      for (let j = 0; j < g.tweens.length; j++) {
        const twTrack = g.tweens[j];
        if (twTrack.property === propertyName && twTrack.isScalarEditable) {
          snapshots.push({
            tw: twTrack.tweenRef,
            prevFrom: twTrack.tweenRef._fromNumber,
            prevTo: twTrack.tweenRef._toNumber,
            prevVal: twTrack.tweenRef._value,
          });
        }
      }
    }
    if (!snapshots.length) return;

    const applyPatch = (useNew) => {
      for (let i = 0; i < snapshots.length; i++) {
        const snap = snapshots[i];
        const nextFrom = useNew && patch.from !== undefined && Number.isFinite(patch.from) ? patch.from : snap.prevFrom;
        const nextTo = useNew && patch.to !== undefined && Number.isFinite(patch.to) ? patch.to : snap.prevTo;
        snap.tw._fromNumber = nextFrom;
        snap.tw._toNumber = nextTo;
        if (snap.tw._valueType === consts.valueTypes.UNIT) {
          snap.tw._value = `${nextTo}${snap.tw._unit}`;
        } else {
          snap.tw._value = nextTo;
        }
      }
      this._reseekPreservingState(entry.instance);
      this.refreshEntry(entry);
      this.emit();
    };

    this._pushHistory({
      label: `Edit ${propertyName}`,
      undo: () => applyPatch(false),
      redo: () => applyPatch(true),
    });
    applyPatch(true);
  }

  /**
   * Re-renders `instance` at its current time while keeping paused/playing status intact.
   *
   * @param  {Timeline|JSAnimation} instance
   * @return {void}
   */
  _reseekPreservingState(instance) {
    const wasPaused = instance.paused;
    const t = instance.iterationCount === Infinity ? instance.iterationCurrentTime : instance.currentTime;
    instance.seek(t, 1);
    if (!wasPaused) instance.resume();
  }
}

exports.StudioStore = StudioStore;
exports.classifyProperty = classifyProperty;
exports.formatTargetLabel = formatTargetLabel;
