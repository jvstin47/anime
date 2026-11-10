export function formatTargetLabel(target: any, index?: number): string;
/**
 * Central state store & `globals.editor` bridge for Anime Studio.
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
    /** @type {WeakMap<JSAnimation, { rawEase?: any, targetSelector?: any, staggerKey?: String }>} */
    _animHints: WeakMap<JSAnimation, {
        rawEase?: any;
        targetSelector?: any;
        staggerKey?: string;
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
    selectedGroupUid: string | null;
    /** @type {String|null} */
    selectedTweenUid: string | null;
    _prevEditor: import("../core/globals.js").EditorGlobals;
    /** @type {import('../core/globals.js').EditorGlobals} */
    editorGlobals: import("../core/globals.js").EditorGlobals;
    _notifyQueued: boolean;
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
    /** Refreshes track snapshots across all registered entries. */
    refreshAll(): void;
    /**
     * Extracts up-to-date live tracks, labels, and tween timings from an attached `Timeline` or `JSAnimation`.
     *
     * @param  {StudioEntry} entry
     * @return {StudioEntry}
     */
    refreshEntry(entry: StudioEntry): StudioEntry;
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
     * Finds the currently selected group and/or tween inside the active entry.
     *
     * @return {{ entry: StudioEntry|null, group: StudioGroupTrack|null, tween: StudioTweenTrack|null }}
     */
    getSelection(): {
        entry: StudioEntry | null;
        group: StudioGroupTrack | null;
        tween: StudioTweenTrack | null;
    };
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
     * Live-stretches a group animation's duration (`stretch()`) and updates parent timeline bounds.
     *
     * @param  {String} entryId
     * @param  {String} groupUid
     * @param  {Number} newDurationMs
     * @return {void}
     */
    updateGroupDuration(entryId: string, groupUid: string, newDurationMs: number): void;
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
    updateEasing(entryId: string, groupUid: string, tweenUid: string | null, spec: {
        kind: "ease" | "bezier" | "spring";
        value?: string;
        bezier?: [number, number, number, number];
        spring?: any;
    }, applyToGroup?: boolean): void;
    /**
     * Re-renders `instance` at its current time while keeping paused/playing status intact.
     *
     * @param  {Timeline|JSAnimation} instance
     * @return {void}
     */
    _reseekPreservingState(instance: Timeline | JSAnimation): void;
}
export type StudioTweenTrack = {
    uid: string;
    property: string;
    targetLabel: string;
    target: Target;
    targetIndex: number;
    offset: number;
    delay: number;
    duration: number;
    endTime: number;
    fromText: string;
    toText: string;
    unit: string;
    isColor: boolean;
    easing: EasingDescriptor;
    tweenRef: Tween;
    animRef: JSAnimation;
};
export type StudioGroupTrack = {
    uid: string;
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
export type StudioEntry = {
    id: string;
    kind: "timeline" | "animation" | "set";
    name: string;
    instance: Timeline | JSAnimation;
    rawParams: Record<string, any>;
    groups: Array<StudioGroupTrack>;
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
