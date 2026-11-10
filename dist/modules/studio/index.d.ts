/**
 * Programmatic controller for Anime Studio (`globals.editor` + Shadow DOM HUD + Virtual Clock bridge).
 */
export class Studio {
    /** @param {StudioOptions} [options] */
    constructor(options?: StudioOptions);
    store: StudioStore;
    fps: number;
    /** @type {AnimeStudioElement|null} */
    element: AnimeStudioElement | null;
    _keyHandler: (ev: any) => void;
    _prevUseVirtual: boolean;
    _disposed: boolean;
    /** @return {void} */
    _bindKeyboard(): void;
    /**
     * Mounts `<anime-studio>` Shadow DOM panel onto `container` (or `document.body`).
     *
     * @param  {HTMLElement} [container]
     * @return {this}
     */
    mount(container?: HTMLElement): this;
    /**
     * Unmounts the `<anime-studio>` element from the DOM without destroying the store.
     *
     * @return {this}
     */
    unmount(): this;
    /**
     * Manually attaches an existing `Timeline` or `JSAnimation` to the Studio inspector.
     *
     * @param  {Timeline|JSAnimation} instance
     * @param  {String} [label]
     * @return {StudioEntry}
     */
    attach(instance: Timeline | JSAnimation, label?: string): StudioEntry;
    /**
     * Selects an entry by its Studio ID.
     *
     * @param  {String} entryId
     * @return {this}
     */
    select(entryId: string): this;
    /** @param {Number} fps @return {this} */
    setFps(fps: number): this;
    /**
     * Toggles deterministic Virtual Clock mode on the Anime.js engine.
     *
     * @param  {Boolean} enabled
     * @return {this}
     */
    setVirtualClock(enabled: boolean): this;
    /** @return {this} */
    togglePlay(): this;
    /** @return {this} */
    restart(): this;
    /** @return {this} */
    reverse(): this;
    /**
     * Seeks the active entry to `timeMs` (milliseconds).
     *
     * @param  {Number} timeMs
     * @return {this}
     */
    seek(timeMs: number): this;
    /**
     * Steps the active entry forward or backward by `deltaFrames` at the configured Studio FPS.
     *
     * @param  {Number} [deltaFrames=1]
     * @return {this}
     */
    stepFrame(deltaFrames?: number): this;
    /**
     * Generates runnable Anime.js v4 ESM code for the currently selected (or specified) entry.
     *
     * @param  {String} [entryId]
     * @return {String}
     */
    exportCode(entryId?: string): string;
    /**
     * Exports a structured JSON blueprint for the currently selected (or specified) entry.
     *
     * @param  {String} [entryId]
     * @return {Object|null}
     */
    exportJSON(entryId?: string): any | null;
    /**
     * Disconnects `globals.editor`, unmounts UI, removes keyboard hooks, and restores real clock if active.
     *
     * @return {this}
     */
    dispose(): this;
    /**
     * Alias for `dispose()`, compatible with Anime.js `Scope` / `Revertible`.
     *
     * @return {this}
     */
    revert(): this;
}
export function createStudio(options?: StudioOptions): Studio;
export function showStudio(options?: StudioOptions): Studio;
export function hideStudio(): void;
export function getStudio(): Studio | null;
export { StudioStore } from "./store.js";
export type StudioOptions = {
    /**
     * - Automatically mount the Shadow DOM `<anime-studio>` panel in browsers
     */
    mount?: boolean;
    /**
     * - Custom mount container (defaults to `document.body`)
     */
    container?: HTMLElement;
    /**
     * - Connect `globals.editor` automatically to intercept new animations & timelines
     */
    connect?: boolean;
    /**
     * - Default studio frame-stepping & render FPS
     */
    fps?: number;
    /**
     * - Start immediately in deterministic virtual clock mode
     */
    virtualClock?: boolean;
    /**
     * - Enable keyboard shortcuts (`Space`, `←`, `→`, `H`)
     */
    shortcuts?: boolean;
};
import { StudioStore } from './store.js';
import type { AnimeStudioElement } from './ui.js';
import type { Timeline } from '../timeline/timeline.js';
import type { JSAnimation } from '../animation/animation.js';
import type { StudioEntry } from './store.js';
export { generateAnimeCode, generateBlueprintJSON } from "./codegen.js";
export { EASING_PRESETS, sampleEaseCurve, describeEasing, buildStudioEasing } from "./easings-bridge.js";
