export function classifyProperty(prop: string): PropertyCategory;
export function formatTargetLabel(target: any, index?: number): string;
/**
 * Central state store, Undo/Redo history manager, Layer Visibility/Lock manager, & `globals.editor` bridge.
 * All studio metadata lives outside Anime.js instances to preserve V8 fast object maps.
 */
export class StudioStore {
    /** @type {Map<String, StudioEntry>} */
    entries: Map<string, StudioEntry>;
    /** @type {WeakMap<Object, StudioEntry>} */
    _instanceToEntry: WeakMap<any, StudioEntry>;
    /** @type {Map<String|Number, StudioEntry>} */
    _tlIdToEntry: Map<string | number, StudioEntry>;
    /** @type {WeakMap<Tween, EasingDescriptor>} */
    _tweenEasingOverrides: WeakMap<Tween, EasingDescriptor>;
    /** @type {WeakMap<JSAnimation, { rawEase?: any, targetSelector?: any, staggerKey?: String, rawParams?: any }>} */
    _animHints: WeakMap<JSAnimation, {
        rawEase?: any;
        targetSelector?: any;
        staggerKey?: string;
        rawParams?: any;
    }>;
    /** @type {Map<String, Array<{ rawParams: any, targetSelector: any, position: any, staggerKey: String }>>} */
    _pendingTlChildHints: Map<string, Array<{
        rawParams: any;
        targetSelector: any;
        position: any;
        staggerKey: string;
    }>>;
    /** @type {Map<String, Array<{ name: String, position: any }>>} */
    _pendingTlCalls: Map<string, Array<{
        name: string;
        position: any;
    }>>;
    /** @type {Set<() => void>} */
    _listeners: Set<() => void>;
    /** @type {Boolean} */
    _suspended: boolean;
    /** @type {String|null} */
    selectedEntryId: string | null;
    /** @type {String|null} */
    selectedLayerId: string | null;
    /** @type {String|null} */
    selectedGroupUid: string | null;
    /** @type {String|null} */
    selectedTweenUid: string | null;
    /** @type {String|null} */
    selectedProperty: string | null;
    /** @type {Set<String>} */
    _hiddenLayers: Set<string>;
    /** @type {Set<String>} */
    _lockedLayers: Set<string>;
    /** @type {WeakSet<Object>} */
    _hiddenTargets: WeakSet<any>;
    /** @type {WeakMap<Object, String>} */
    _prevDomVisibility: WeakMap<any, string>;
    projectName: string;
    editCount: number;
    savedEditCount: number;
    lastSavedAt: number;
    /** @type {Array<HistoryAction>} */
    _undoStack: Array<HistoryAction>;
    /** @type {Array<HistoryAction>} */
    _redoStack: Array<HistoryAction>;
    /** @type {{ label: String, actions: Array<HistoryAction> }|null} */
    _activeBatch: {
        label: string;
        actions: Array<HistoryAction>;
    } | null;
    /** @type {Array<SceneConfigOption>} */
    scenes: Array<SceneConfigOption>;
    /** @type {String|null} */
    activeSceneId: string | null;
    /** @type {((sceneId: String) => void)|null} */
    _onSelectScene: ((sceneId: string) => void) | null;
    /** @type {(() => void)|null} */
    _onAddObject: (() => void) | null;
    _prevEditor: import("../core/globals.js").EditorGlobals;
    /** @type {import('../core/globals.js').EditorGlobals} */
    editorGlobals: import("../core/globals.js").EditorGlobals;
    _notifyQueued: boolean;
    /** @return {Boolean} */
    get canUndo(): boolean;
    /** @return {Boolean} */
    get canRedo(): boolean;
    /** @return {Boolean} */
    get isDirty(): boolean;
    /** Connects `globals.editor` to capture all subsequent `animate()`, `utils.set()`, and `createTimeline()` calls. */
    connect(): this;
    /** Restores the previous `globals.editor` state cleanly. */
    disconnect(): this;
    /**
     * Executes `fn` with `globals.editor` temporarily bypassed so internal Anime.js creation doesn't recurse.
     *
     * @template T
     * @param  {() => T} fn
     * @return {T}
     */
    _withSuspended<T>(fn: () => T): T;
    /** @param {() => void} listener @return {() => void} */
    subscribe(listener: () => void): () => void;
    /** @return {void} */
    emit(): void;
    /** Coalesces rapid `.add()` / `.label()` mutations into one microtask notification. */
    _notifySoon(): void;
    /**
     * Begins grouping continuous edits (e.g. pointer drag or range scrub) into one Undo entry.
     *
     * @param  {String} label
     * @return {void}
     */
    beginBatch(label: string): void;
    /** Commits the current batch onto the Undo stack as one composite action. */
    commitBatch(): void;
    /**
     * @param  {HistoryAction} action
     * @return {void}
     */
    _pushHistory(action: HistoryAction): void;
    /** @return {Boolean} */
    undo(): boolean;
    /** @return {Boolean} */
    redo(): boolean;
    /** Marks current state as saved and optionally persists a snapshot to `localStorage`. */
    markSaved(jsonSnapshot?: any): void;
    /** @param {String} name */
    setProjectName(name: string): void;
    /**
     * Registers host scenes and optional Add-Object callback so the header/sidebar control them natively.
     *
     * @param {{ scenes?: Array<SceneConfigOption>, activeSceneId?: String, onSelectScene?: (id: String) => void, onAddObject?: () => void }} config
     */
    setSceneSupport(config?: {
        scenes?: Array<SceneConfigOption>;
        activeSceneId?: string;
        onSelectScene?: (id: string) => void;
        onAddObject?: () => void;
    }): void;
    /** @param {String} sceneId */
    selectScene(sceneId: string): void;
    /** @return {Boolean} */
    get supportsAddObject(): boolean;
    /** Triggers registered scene Add-Object action if available. */
    addObject(): void;
    /**
     * @param  {TargetsParam} targets
     * @param  {AnimationParams} parameters
     * @return {JSAnimation}
     */
    _handleAddAnimation(targets: TargetsParam, parameters: AnimationParams): JSAnimation;
    /**
     * @param  {TargetsParam} targets
     * @param  {AnimationParams} parameters
     * @return {JSAnimation}
     */
    _handleAddSet(targets: TargetsParam, parameters: AnimationParams): JSAnimation;
    /**
     * @param  {TimelineParams} [parameters]
     * @return {Timeline}
     */
    _handleAddTimeline(parameters?: TimelineParams): Timeline;
    /**
     * @param  {TargetsParam} targets
     * @param  {AnimationParams} childParams
     * @param  {String|Number} tlId
     * @param  {TimelinePosition|Function|TweakRegister} position
     * @param  {Number} [parsedLength]
     * @return {AnimationParams}
     */
    _handleAddTimelineChild(targets: TargetsParam, childParams: AnimationParams, tlId: string | number, position: TimelinePosition | Function | TweakRegister, parsedLength?: number): AnimationParams;
    /**
     * Attaches any `Timeline` or `JSAnimation` (even if created before Studio connected) for inspection & editing.
     *
     * @param  {Timeline|JSAnimation} instance
     * @param  {String} [customName]
     * @param  {'timeline'|'animation'|'set'} [kindHint]
     * @param  {Record<String, any>} [rawParams]
     * @return {StudioEntry}
     */
    attach(instance: Timeline | JSAnimation, customName?: string, kindHint?: "timeline" | "animation" | "set", rawParams?: Record<string, any>): StudioEntry;
    /**
     * Removes an entry from the Studio registry.
     *
     * @param  {String} entryId
     * @return {void}
     */
    detach(entryId: string): void;
    /** Refreshes track & layer snapshots across all registered entries. */
    refreshAll(): void;
    /**
     * Extracts up-to-date live tracks, hierarchical layer groups, labels, and tween timings.
     *
     * @param  {StudioEntry} entry
     * @return {StudioEntry}
     */
    refreshEntry(entry: StudioEntry): StudioEntry;
    /**
     * Builds meaningful hierarchical `StudioLayerNode`s by coalescing `staggerKey` sibling groups.
     *
     * @param  {String} entryId
     * @param  {Array<StudioGroupTrack>} groups
     * @return {Array<StudioLayerNode>}
     */
    _buildLayers(entryId: string, groups: Array<StudioGroupTrack>): Array<StudioLayerNode>;
    /**
     * @param  {String} entryId
     * @param  {JSAnimation} anim
     * @param  {Number} groupIdx
     * @param  {any} hint
     * @return {StudioGroupTrack}
     */
    _buildGroupTrack(entryId: string, anim: JSAnimation, groupIdx: number, hint: any): StudioGroupTrack;
    /** @return {StudioEntry|null} */
    getSelectedEntry(): StudioEntry | null;
    /**
     * Resolves the currently selected entry, layer, group, and tween.
     * Note: Selection is intentionally allowed to be `null` when explicitly cleared (`selectedLayerId === '__none__'`).
     *
     * @return {{ entry: StudioEntry|null, layer: StudioLayerNode|null, group: StudioGroupTrack|null, tween: StudioTweenTrack|null }}
     */
    getSelection(): {
        entry: StudioEntry | null;
        layer: StudioLayerNode | null;
        group: StudioGroupTrack | null;
        tween: StudioTweenTrack | null;
    };
    /**
     * Returns `true` if `target` is currently visible (not hidden by a layer toggle).
     *
     * @param  {any} target
     * @return {Boolean}
     */
    isTargetVisible(target: any): boolean;
    /**
     * @param  {StudioLayerNode} layer
     * @param  {Boolean} hidden
     * @return {void}
     */
    _applyLayerHidden(layer: StudioLayerNode, hidden: boolean): void;
    /**
     * Toggles visibility of a layer (hiding/showing both DOM elements and JS/Canvas targets) with Undo support.
     *
     * @param  {String} entryId
     * @param  {String} layerId
     * @return {void}
     */
    toggleLayerVisibility(entryId: string, layerId: string): void;
    /**
     * Toggles edit-lock state on a layer with Undo support.
     *
     * @param  {String} entryId
     * @param  {String} layerId
     * @return {void}
     */
    toggleLayerLock(entryId: string, layerId: string): void;
    /**
     * Checks whether `group` belongs to a locked layer.
     *
     * @param  {StudioGroupTrack} group
     * @return {Boolean}
     */
    isGroupLocked(group: StudioGroupTrack): boolean;
    /**
     * Live-updates a group's offset (`_offset` in Timeline or `_delay` for standalone animations) and re-seeks.
     *
     * @param  {String} entryId
     * @param  {String} groupUid
     * @param  {Number} newOffsetMs
     * @return {void}
     */
    updateGroupOffset(entryId: string, groupUid: string, newOffsetMs: number): void;
    /**
     * Shifts all child groups of a layer by `deltaMs`.
     *
     * @param  {String} entryId
     * @param  {String} layerId
     * @param  {Number} deltaMs
     * @return {void}
     */
    shiftLayerOffset(entryId: string, layerId: string, deltaMs: number): void;
    /**
     * Live-stretches a group animation's duration (`stretch()`) and updates parent timeline bounds.
     *
     * @param  {String} entryId
     * @param  {String} groupUid
     * @param  {Number} newDurationMs
     * @return {void}
     */
    updateGroupDuration(entryId: string, groupUid: string, newDurationMs: number): void;
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
    updateEasing(entryId: string, groupUid: string, tweenUid: string | null, spec: {
        kind: "ease" | "bezier" | "spring";
        value?: string;
        bezier?: [number, number, number, number];
        spring?: any;
    }, applyToGroup?: boolean, overrideGroupUids?: Array<string> | null): void;
    /**
     * Live-updates scalar `from` / `to` values across matching property tweens in `groupUids`.
     *
     * @param  {String} entryId
     * @param  {Array<String>} groupUids
     * @param  {String} propertyName
     * @param  {{ from?: Number, to?: Number }} patch
     * @return {void}
     */
    updateTweenValues(entryId: string, groupUids: Array<string>, propertyName: string, patch: {
        from?: number;
        to?: number;
    }): void;
    /**
     * Re-renders `instance` at its current time while keeping paused/playing status intact.
     *
     * @param  {Timeline|JSAnimation} instance
     * @return {void}
     */
    _reseekPreservingState(instance: Timeline | JSAnimation): void;
}
export type PropertyCategory = "position" | "rotation" | "scale" | "animation";
export type StudioTweenTrack = {
    uid: string;
    property: string;
    category: PropertyCategory;
    targetLabel: string;
    target: Target;
    targetIndex: number;
    offset: number;
    delay: number;
    duration: number;
    endTime: number;
    fromNum: number | null;
    toNum: number | null;
    fromText: string;
    toText: string;
    unit: string;
    isColor: boolean;
    isScalarEditable: boolean;
    easing: EasingDescriptor;
    tweenRef: Tween;
    animRef: JSAnimation;
};
export type StudioGroupTrack = {
    uid: string;
    layerId: string;
    label: string;
    targetLabel: string;
    offset: number;
    delay: number;
    duration: number;
    endTime: number;
    easing: EasingDescriptor;
    tweens: Array<StudioTweenTrack>;
    targets: Array<Target>;
    animRef: JSAnimation;
    isStaggered: boolean;
    staggerKey: string | null;
};
export type StudioPropertySummary = {
    property: string;
    category: PropertyCategory;
    fromNum: number | null;
    toNum: number | null;
    fromText: string;
    toText: string;
    unit: string;
    isColor: boolean;
    isScalarEditable: boolean;
    tweens: Array<StudioTweenTrack>;
};
export type StudioLayerNode = {
    id: string;
    name: string;
    targetLabel: string;
    kind: "stagger-group" | "object";
    groupUids: Array<string>;
    primaryGroupUid: string;
    targets: Array<Target>;
    offset: number;
    delay: number;
    duration: number;
    endTime: number;
    easing: EasingDescriptor;
    isStaggered: boolean;
    hidden: boolean;
    locked: boolean;
    properties: Array<StudioPropertySummary>;
};
export type StudioEntry = {
    id: string;
    kind: "timeline" | "animation" | "set";
    name: string;
    instance: Timeline | JSAnimation;
    rawParams: Record<string, any>;
    groups: Array<StudioGroupTrack>;
    layers: Array<StudioLayerNode>;
    labels: Array<{
        name: string;
        time: number;
    }>;
    calls: Array<{
        name: string;
        time: number;
    }>;
    _dirty?: boolean;
    _groups?: Array<StudioGroupTrack>;
    _layers?: Array<StudioLayerNode>;
    _labels?: Array<{
        name: string;
        time: number;
    }>;
    _calls?: Array<{
        name: string;
        time: number;
    }>;
    createdAt: number;
};
export type HistoryAction = {
    label: string;
    undo: () => void;
    redo: () => void;
};
export type SceneConfigOption = {
    id: string;
    label: string;
};
import type { Tween } from '../types/index.js';
import type { EasingDescriptor } from './easings-bridge.js';
import { JSAnimation } from '../animation/animation.js';
import type { TargetsParam } from '../types/index.js';
import type { AnimationParams } from '../types/index.js';
import type { TimelineParams } from '../types/index.js';
import { Timeline } from '../timeline/timeline.js';
import type { TimelinePosition } from '../types/index.js';
import type { TweakRegister } from '../types/index.js';
import type { Target } from '../types/index.js';
