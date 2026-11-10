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
 * @typedef {Object} StudioTweenTrack
 * @property {String} uid
 * @property {String} property
 * @property {String} targetLabel
 * @property {Target} target
 * @property {Number} targetIndex
 * @property {Number} offset
 * @property {Number} delay
 * @property {Number} duration
 * @property {Number} endTime
 * @property {String} fromText
 * @property {String} toText
 * @property {String} unit
 * @property {Boolean} isColor
 * @property {EasingDescriptor} easing
 * @property {Tween} tweenRef
 * @property {JSAnimation} animRef
 */

/**
 * @typedef {Object} StudioGroupTrack
 * @property {String} uid
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
 * @typedef {Object} StudioEntry
 * @property {String} id
 * @property {'timeline'|'animation'|'set'} kind
 * @property {String} name
 * @property {Timeline|JSAnimation} instance
 * @property {Record<String, any>} rawParams
 * @property {Array<StudioGroupTrack>} groups
 * @property {Array<{ name: String, time: Number }>} labels
 * @property {Array<{ name: String, time: Number }>} calls
 * @property {Boolean} [_dirty]
 * @property {Array<StudioGroupTrack>} [_groups]
 * @property {Array<{ name: String, time: Number }>} [_labels]
 * @property {Array<{ name: String, time: Number }>} [_calls]
 * @property {Number} createdAt
 */

let studioEntrySeq = 0;

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
 * Central state store & `globals.editor` bridge for Anime Studio.
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
    /** @type {WeakMap<JSAnimation, { rawEase?: any, targetSelector?: any, staggerKey?: String }>} */
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
    this.selectedGroupUid = null;
    /** @type {String|null} */
    this.selectedTweenUid = null;

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

  /**
   * @param  {TargetsParam} targets
   * @param  {AnimationParams} parameters
   * @return {JSAnimation}
   */
  _handleAddAnimation(targets, parameters) {
    const anim = this._withSuspended(() => new animation.JSAnimation(targets, parameters, null, 0, false).init());
    this._animHints.set(anim, {
      rawEase: parameters ? parameters.ease : undefined,
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
    /** @type {StudioEntry & { _dirty?: Boolean, _groups?: Array<StudioGroupTrack>, _labels?: Array<{ name: String, time: Number }>, _calls?: Array<{ name: String, time: Number }> }} */
    const entry = {
      id,
      kind,
      name,
      instance,
      rawParams: rawParams || {},
      _dirty: false,
      _groups: [],
      _labels: [],
      _calls: [],
      get groups() {
        if (this._dirty) store.refreshEntry(this);
        return this._groups;
      },
      set groups(v) {
        this._groups = v;
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
      this.selectedGroupUid = null;
      this.selectedTweenUid = null;
    }
    this.emit();
  }

  /** Refreshes track snapshots across all registered entries. */
  refreshAll() {
    this.entries.forEach(entry => this.refreshEntry(entry));
  }

  /**
   * Extracts up-to-date live tracks, labels, and tween timings from an attached `Timeline` or `JSAnimation`.
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
          // Timer / .call() marker inside timeline
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
      const hint = this._animHints.get(anim) || { rawEase: entry.rawParams ? entry.rawParams.ease : undefined };
      groups.push(this._buildGroupTrack(entry.id, anim, 0, hint));
    }

    entry._dirty = false;
    entry._groups = groups;
    entry._labels = labels;
    entry._calls = calls;
    return entry;
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
      : (targets.length > 1 ? `${formatTargetLabel(targets[0])} (+${targets.length - 1})` : formatTargetLabel(targets[0]));

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

      tweens.push({
        uid: `${entryId}:g${groupIdx}:t${tIdx++}`,
        property: tw.property,
        targetLabel: formatTargetLabel(tw.target, tIndex),
        target: tw.target,
        targetIndex: tIndex,
        offset: startOffset,
        delay,
        duration,
        endTime: startOffset + delay + duration,
        fromText: formatTweenEndpoint(tw, 'from'),
        toText: formatTweenEndpoint(tw, 'to'),
        unit: tw._unit || '',
        isColor: tw._valueType === consts.valueTypes.COLOR,
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
      label: anim.id !== undefined ? `${targetLabel}` : `Track #${groupIdx + 1}`,
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
   * Finds the currently selected group and/or tween inside the active entry.
   *
   * @return {{ entry: StudioEntry|null, group: StudioGroupTrack|null, tween: StudioTweenTrack|null }}
   */
  getSelection() {
    const entry = this.getSelectedEntry();
    if (!entry) return { entry: null, group: null, tween: null };
    let group = entry.groups.find(g => g.uid === this.selectedGroupUid) || entry.groups[0] || null;
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
    if (!tween && group && group.tweens.length) {
      tween = group.tweens[0];
    }
    return { entry, group, tween };
  }

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
    if (!group) return;
    const safeOffset = Math.max(0, helpers.round(newOffsetMs, 2));
    if (entry.kind === 'timeline') {
      group.animRef._offset = safeOffset;
      easingsBridge.recomputeTimelineTimings(/** @type {Timeline} */(entry.instance));
    } else {
      group.animRef._delay = safeOffset;
    }
    this._reseekPreservingState(entry.instance);
    this.refreshEntry(entry);
    this.emit();
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
    if (!group) return;
    const safeDur = Math.max(10, helpers.round(newDurationMs, 2));
    group.animRef.stretch(safeDur);
    if (entry.kind === 'timeline') {
      easingsBridge.recomputeTimelineTimings(/** @type {Timeline} */(entry.instance));
    }
    this._reseekPreservingState(entry.instance);
    this.refreshEntry(entry);
    this.emit();
  }

  /**
   * Live-applies a new easing or spring curve to the selected tween (or all tweens in a group).
   *
   * @param  {String} entryId
   * @param  {String} groupUid
   * @param  {String|null} tweenUid
   * @param  {{ kind: 'ease'|'bezier'|'spring', value?: String, bezier?: [Number, Number, Number, Number], spring?: any }} spec
   * @param  {Boolean} [applyToGroup=true]
   * @return {void}
   */
  updateEasing(entryId, groupUid, tweenUid, spec, applyToGroup = true) {
    const entry = this.entries.get(entryId);
    if (!entry) return;
    const group = entry.groups.find(g => g.uid === groupUid);
    if (!group) return;

    const built = easingsBridge.buildStudioEasing(spec);
    const targetTweens = applyToGroup
      ? group.tweens
      : group.tweens.filter(t => t.uid === tweenUid);

    for (let i = 0; i < targetTweens.length; i++) {
      const twTrack = targetTweens[i];
      const tw = twTrack.tweenRef;
      tw._ease = built.fn;
      this._tweenEasingOverrides.set(tw, built.descriptor);
      if (built.springInstance) {
        built.springInstance.parent = group.animRef;
        tw._updateDuration = built.springInstance.settlingDuration;
        tw._changeDuration = built.springInstance.settlingDuration;
      }
    }

    if (built.springInstance) {
      easingsBridge.recomputeAnimationTimings(group.animRef);
    }

    this._reseekPreservingState(entry.instance);
    this.refreshEntry(entry);
    this.emit();
  }

  /**
   * Re-renders `instance` at its current time while keeping paused/playing status intact.
   *
   * @param  {Timeline|JSAnimation} instance
   * @return {void}
   */
  _reseekPreservingState(instance) {
    const wasPaused = instance.paused;
    const t = instance.currentTime;
    instance.seek(t, 1);
    if (!wasPaused) instance.resume();
  }
}

exports.StudioStore = StudioStore;
exports.formatTargetLabel = formatTargetLabel;
