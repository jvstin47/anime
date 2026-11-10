/**
 * Isolated Shadow DOM Web Component powering Anime Studio HUD.
 */
export class AnimeStudioElement extends HTMLElement {
    /** @type {StudioStore|null} */
    _store: StudioStore | null;
    /** @type {any} */
    _studio: any;
    _tab: string;
    _codeMode: string;
    _zoom: number;
    _collapsed: boolean;
    _inspectTargets: boolean;
    _expandedGroups: Set<any>;
    _rafId: number;
    _height: number;
    _renderState: {
        status: string;
        progress: number;
        videoUrl: string;
        filmstrip: any[];
    };
    /** @type {HTMLElement|null} */
    _playheadEl: HTMLElement | null;
    /** @type {HTMLElement|null} */
    _timecodeEl: HTMLElement | null;
    /** @type {SVGCircleElement|null} */
    _curveDotEl: SVGCircleElement | null;
    /** @type {HTMLElement|null} */
    _overlayEl: HTMLElement | null;
    /** @type {HTMLButtonElement|null} */
    _playBtnEl: HTMLButtonElement | null;
    _shadow: ShadowRoot;
    /**
     * @param  {StudioStore} store
     * @param  {any} studio
     * @return {void}
     */
    bind(store: StudioStore, studio: any): void;
    _unsubscribe: () => void;
    disconnectedCallback(): void;
    /** Starts lightweight playhead & target overlay sync loop. */
    _startRaf(): void;
    _getCycleDuration(inst: any): number;
    /** Updates only playhead position, timecode text, live curve dot, and target boxes (zero layout thrash). */
    _updateLivePlayhead(): void;
    /** Highlights currently selected DOM targets on the viewport when inspect mode is active. */
    _renderTargetHighlights(): void;
    /**
     * Generates an SVG path `d` attribute string for an easing function inside `(width x height)`.
     *
     * @param  {(t: Number) => Number} easeFn
     * @param  {Number} w
     * @param  {Number} h
     * @param  {Boolean} [fitBounds=false]
     * @return {String}
     */
    _buildCurvePath(easeFn: (t: number) => number, w: number, h: number, fitBounds?: boolean): string;
    /** Full Shadow DOM UI render. */
    render(): void;
    /**
     * @param  {Number} dur
     * @param  {StudioEntry|null} entry
     * @return {String}
     */
    _renderRulerTicks(dur: number, entry: StudioEntry | null): string;
    /**
     * @param  {StudioEntry} entry
     * @param  {StudioGroupTrack|null} selectedGroup
     * @param  {StudioTweenTrack|null} selectedTween
     * @param  {Number} dur
     * @return {String}
     */
    _renderTracks(entry: StudioEntry, selectedGroup: StudioGroupTrack | null, selectedTween: StudioTweenTrack | null, dur: number): string;
    /**
     * @param  {StudioEntry|null} entry
     * @param  {StudioGroupTrack|null} group
     * @param  {StudioTweenTrack|null} tween
     * @param  {Number} fps
     * @return {String}
     */
    _renderInspector(entry: StudioEntry | null, group: StudioGroupTrack | null, tween: StudioTweenTrack | null, fps: number): string;
    /**
     * @param  {StudioEntry|null} entry
     * @param  {StudioGroupTrack|null} group
     * @param  {StudioTweenTrack|null} tween
     * @param  {Number} dur
     * @return {void}
     */
    _bindEvents(entry: StudioEntry | null, group: StudioGroupTrack | null, tween: StudioTweenTrack | null, dur: number): void;
}
export function ensureStudioElementDefined(): void;
import type { StudioStore } from './store.js';
import type { StudioEntry } from './store.js';
import type { StudioGroupTrack } from './store.js';
import type { StudioTweenTrack } from './store.js';
