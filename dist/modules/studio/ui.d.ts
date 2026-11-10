/**
 * Desktop NLE / Motion-Editor Shadow DOM Component (`<anime-studio>`) for Anime.js v4.
 * Supports both full-viewport `mode="workspace"` and compact bottom-docked `mode="dock"`.
 */
export class AnimeStudioElement extends HTMLElement {
    /** @type {StudioStore|null} */
    _store: StudioStore | null;
    /** @type {any} */
    _studio: any;
    /** @type {'workspace'|'dock'} */
    _mode: "workspace" | "dock";
    _collapsed: boolean;
    _leftCollapsed: boolean;
    _rightCollapsed: boolean;
    _leftWidth: number;
    _rightWidth: number;
    _timelineHeight: number;
    _tlZoom: number;
    _trackSize: string;
    _expandedLayers: Set<any>;
    _layerSearch: string;
    _canvasZoom: number;
    _canvasPanX: number;
    _canvasPanY: number;
    _showGrid: boolean;
    _showGuides: boolean;
    _panTool: boolean;
    _inspectTargets: boolean;
    _stageWidth: number;
    _stageHeight: number;
    _collapsedSections: Set<any>;
    _exportOpen: boolean;
    _exportTab: string;
    _codeMode: string;
    _renderState: {
        status: string;
        videoUrl: string;
        filmstrip: any[];
    };
    _rafId: number;
    _suspendStoreRender: boolean;
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
     * @param  {{ mode?: 'workspace'|'dock', stageWidth?: Number, stageHeight?: Number }} [opts]
     * @return {void}
     */
    bind(store: StudioStore, studio: any, opts?: {
        mode?: "workspace" | "dock";
        stageWidth?: number;
        stageHeight?: number;
    }): void;
    _unsubscribe: () => void;
    disconnectedCallback(): void;
    /** Starts lightweight playhead & target overlay sync loop. */
    _startRaf(): void;
    /** @param {any} inst @return {Number} */
    _getCycleDuration(inst: any): number;
    /** Updates playhead, timecode, curve progress dot, and DOM bounding boxes at 60fps with zero re-render. */
    _updateLivePlayhead(): void;
    /** Renders viewport bounding-box overlays when Inspect is active. */
    _renderTargetHighlights(): void;
    /** Computes fit-to-screen zoom for the central canvas viewport. */
    fitCanvasToScreen(): void;
    /** Updates composition viewport transform without triggering a full DOM render. */
    _applyCanvasTransform(): void;
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
    _buildCurvePath(easeFn: (t: number) => number, w: number, h: number, fitBounds?: boolean, yOffset?: number): string;
    /** Full Shadow DOM render (called only on structural/state changes, never during RAF). */
    render(): void;
    /**
     * @param  {Array<StudioEntry>} entries
     * @param  {StudioEntry|null} entry
     * @return {String}
     */
    _renderAppHeader(entries: Array<StudioEntry>, entry: StudioEntry | null): string;
    /**
     * Compact header used when mounted in `mode="dock"` on standalone webpages.
     *
     * @param  {Array<StudioEntry>} entries
     * @param  {StudioEntry|null} entry
     * @return {String}
     */
    _renderDockHeader(entries: Array<StudioEntry>, entry: StudioEntry | null): string;
    /**
     * B. Left Sidebar — Scene / Object Hierarchy with visibility & lock controls.
     *
     * @param  {StudioEntry|null} entry
     * @param  {StudioLayerNode|null} selectedLayer
     * @return {String}
     */
    _renderLeftSidebar(entry: StudioEntry | null, selectedLayer: StudioLayerNode | null): string;
    /**
     * C. Central Workspace — Centered Canvas Composition Viewport with Zoom / Pan / Fit / Grid.
     *
     * @return {String}
     */
    _renderCenterCanvas(): string;
    /**
     * D. Right Sidebar — Contextual Properties Inspector (Transform, Animation, Timing, Easing, Physics).
     *
     * @param  {StudioEntry|null} entry
     * @param  {StudioLayerNode|null} layer
     * @param  {StudioGroupTrack|null} group
     * @param  {StudioTweenTrack|null} tween
     * @return {String}
     */
    _renderRightInspector(entry: StudioEntry | null, layer: StudioLayerNode | null, group: StudioGroupTrack | null, tween: StudioTweenTrack | null): string;
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
    _renderBottomTimeline(entry: StudioEntry | null, selectedLayer: StudioLayerNode | null, selectedGroup: StudioGroupTrack | null, selectedTween: StudioTweenTrack | null, dur: number, fps: number): string;
    /**
     * @param  {Number} dur
     * @param  {StudioEntry|null} entry
     * @return {String}
     */
    _renderRulerTicks(dur: number, entry: StudioEntry | null): string;
    /**
     * Export Modal containing Video (WebM WebCodecs), PNG/Filmstrip, and Anime v4 Code / JSON Blueprint.
     *
     * @param  {StudioEntry|null} entry
     * @param  {Number} dur
     * @param  {Number} fps
     * @return {String}
     */
    _renderExportModal(entry: StudioEntry | null, dur: number, fps: number): string;
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
    _bindEvents(entry: StudioEntry | null, layer: StudioLayerNode | null, group: StudioGroupTrack | null, tween: StudioTweenTrack | null, dur: number, fps: number): void;
}
export function ensureStudioElementDefined(): void;
import type { StudioStore } from './store.js';
import type { StudioEntry } from './store.js';
import type { StudioLayerNode } from './store.js';
import type { StudioGroupTrack } from './store.js';
import type { StudioTweenTrack } from './store.js';
