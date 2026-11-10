/**
 * Deterministic frame-by-frame composition runner & media exporter built on Anime.js's virtual clock.
 */
export class RenderSession {
    /** @param {RenderSessionOptions} [options] */
    constructor(options?: RenderSessionOptions);
    _options: RenderSessionOptions;
    /** @type {'ms'|'s'} */
    _prevTimeUnit: "ms" | "s";
    _prevUseVirtual: boolean;
    _disposed: boolean;
    _hasCustomCanvas: boolean;
    _setupTeardown: any;
    fps: number;
    width: number;
    height: number;
    background: string;
    seed: number;
    includeEndFrame: boolean;
    muteCallbacks: boolean;
    useVirtualClock: boolean;
    /** @type {HTMLCanvasElement|OffscreenCanvas|null} */
    canvas: HTMLCanvasElement | OffscreenCanvas | null;
    /** @type {HTMLElement|SVGElement|null} */
    domTarget: HTMLElement | SVGElement | null;
    /** @type {((info: FrameInfo) => void)|null} */
    draw: ((info: FrameInfo) => void) | null;
    /** @type {Array<Tickable>} */
    targets: Array<Tickable>;
    /** @type {HTMLCanvasElement|OffscreenCanvas|null} */
    _captureCanvas: HTMLCanvasElement | OffscreenCanvas | null;
    _frame: number;
    _lastRenderedFrame: number;
    _frameDurationMs: number;
    /** @return {void} */
    _initScene(): void;
    durationMs: number;
    totalFrames: number;
    /** @return {Number} */
    get frame(): number;
    /** @return {Number} */
    get duration(): number;
    /** @return {Number} */
    get currentTimeMs(): number;
    /** @return {Number} */
    get currentTime(): number;
    /** @return {Number} */
    get progress(): number;
    /**
     * @param  {Number} frameIndex
     * @return {FrameInfo}
     */
    _buildFrameInfo(frameIndex: number): FrameInfo;
    /**
     * Deterministically seeks the scene to `frameIndex` and evaluates all targets + draw hook.
     *
     * @param  {Number} frameIndex
     * @param  {Boolean} [muteCallbacks]
     * @return {FrameInfo}
     */
    seekFrame(frameIndex: number, muteCallbacks?: boolean): FrameInfo;
    /**
     * Seeks to a specific time in the active `timeUnit`.
     *
     * @param  {Number} time
     * @return {FrameInfo}
     */
    seekTime(time: number): FrameInfo;
    /**
     * Seeks to normalized progress `[0..1]`.
     *
     * @param  {Number} progress
     * @return {FrameInfo}
     */
    seekProgress(progress: number): FrameInfo;
    /**
     * Steps forward (or backward) by `deltaFrames`.
     *
     * @param  {Number} [deltaFrames=1]
     * @return {FrameInfo}
     */
    stepFrame(deltaFrames?: number): FrameInfo;
    /**
     * Resets the render session cleanly back to frame 0.
     *
     * @return {FrameInfo}
     */
    reset(): FrameInfo;
    /**
     * Captures the current frame onto an exportable Canvas/OffscreenCanvas.
     *
     * @return {Promise<HTMLCanvasElement|OffscreenCanvas>}
     */
    _snapshotCurrentCanvas(): Promise<HTMLCanvasElement | OffscreenCanvas>;
    /**
     * Deterministically evaluates every frame in `[from..to]` sequentially.
     *
     * @param  {RenderFramesOptions} [options]
     * @return {Promise<Number>} Number of frames rendered
     */
    renderFrames(options?: RenderFramesOptions): Promise<number>;
    /**
     * Exports a deterministic sequence of PNG/WebP/JPEG Blobs for every frame in `[from..to]`.
     *
     * @param  {ExportFramesOptions} [options]
     * @return {Promise<Array<{ frame: Number, timeMs: Number, blob: Blob }>>}
     */
    exportFrames(options?: ExportFramesOptions): Promise<Array<{
        frame: number;
        timeMs: number;
        blob: Blob;
    }>>;
    /**
     * Deterministically encodes every frame via WebCodecs (`VideoEncoder`) and muxes into a `.webm` Blob.
     *
     * @param  {ExportWebMOptions} [options]
     * @return {Promise<ExportWebMResult>}
     */
    exportWebM(options?: ExportWebMOptions): Promise<ExportWebMResult>;
    /**
     * Restores engine clock, random seed, timeUnit, and releases setup resources.
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
export function createRenderSession(options?: RenderSessionOptions): RenderSession;
export type FrameInfo = {
    /**
     * - Zero-based frame index
     */
    frame: number;
    /**
     * - Total frames in the composition
     */
    totalFrames: number;
    /**
     * - Current time in active `timeUnit`
     */
    time: number;
    /**
     * - Current time in milliseconds
     */
    timeMs: number;
    /**
     * - Frame step duration in milliseconds
     */
    deltaMs: number;
    /**
     * - Normalized progress [0..1]
     */
    progress: number;
    /**
     * - Configured frames per second
     */
    fps: number;
    /**
     * - Associated canvas if any
     */
    canvas: HTMLCanvasElement | OffscreenCanvas | null;
    /**
     * - 2D context if available
     */
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
};
export type RenderSetupResult = {
    target?: Tickable | Array<Tickable>;
    targets?: Array<Tickable>;
    canvas?: HTMLCanvasElement | OffscreenCanvas;
    domTarget?: HTMLElement | SVGElement;
    draw?: (info: FrameInfo) => void;
    teardown?: () => void;
};
export type RenderSessionOptions = {
    fps?: number;
    /**
     * - Duration in active `timeUnit` (inferred from target(s) if omitted)
     */
    duration?: number;
    width?: number;
    height?: number;
    target?: Tickable | Array<Tickable>;
    targets?: Array<Tickable>;
    canvas?: HTMLCanvasElement | OffscreenCanvas;
    domTarget?: HTMLElement | SVGElement;
    setup?: (ctx: {
        session: RenderSession;
        width: number;
        height: number;
        canvas: HTMLCanvasElement | OffscreenCanvas | null;
    }) => Tickable | RenderSetupResult | void;
    draw?: (info: FrameInfo) => void;
    background?: string;
    seed?: number;
    timeUnit?: "ms" | "s";
    includeEndFrame?: boolean;
    muteCallbacks?: boolean;
    useVirtualClock?: boolean;
};
export type RenderFramesOptions = {
    from?: number;
    to?: number;
    onFrame?: (info: FrameInfo) => void | Promise<void>;
    signal?: AbortSignal;
    yieldEvery?: number;
};
export type ExportFramesOptions = {
    format?: "png" | "webp" | "jpeg";
    quality?: number;
    from?: number;
    to?: number;
    onProgress?: (progress: number, info: FrameInfo) => void;
    signal?: AbortSignal;
};
export type ExportWebMOptions = {
    /**
     * - Preferred WebCodecs codec string (auto-probed if omitted)
     */
    codec?: string;
    bitrate?: number;
    keyFrameInterval?: number;
    from?: number;
    to?: number;
    onProgress?: (progress: number, info: FrameInfo) => void;
    signal?: AbortSignal;
};
export type ExportWebMResult = {
    blob: Blob;
    url: string;
    codec: string;
    width: number;
    height: number;
    fps: number;
    frames: number;
    durationMs: number;
};
import type { Tickable } from '../types/index.js';
