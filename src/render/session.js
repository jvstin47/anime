import { isBrowser, doc, K } from '../core/consts.js';
import { clamp, isArr, isFnc, isNum, isUnd } from '../core/helpers.js';
import { engine } from '../engine/engine.js';
import { setRandomSeed, resetRandomSeed } from '../utils/random.js';
import { captureTargetFrame, canvasToBlob } from './dom.js';
import { muxWebMFrames } from './webm.js';

/**
 * @import {
 *   Tickable,
 * } from '../types/index.js'
 */

/**
 * @typedef {Object} FrameInfo
 * @property {Number} frame - Zero-based frame index
 * @property {Number} totalFrames - Total frames in the composition
 * @property {Number} time - Current time in active `timeUnit`
 * @property {Number} timeMs - Current time in milliseconds
 * @property {Number} deltaMs - Frame step duration in milliseconds
 * @property {Number} progress - Normalized progress [0..1]
 * @property {Number} fps - Configured frames per second
 * @property {HTMLCanvasElement|OffscreenCanvas|null} canvas - Associated canvas if any
 * @property {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D|null} ctx - 2D context if available
 */

/**
 * @typedef {Object} RenderSetupResult
 * @property {Tickable|Array<Tickable>} [target]
 * @property {Array<Tickable>} [targets]
 * @property {HTMLCanvasElement|OffscreenCanvas} [canvas]
 * @property {HTMLElement|SVGElement} [domTarget]
 * @property {(info: FrameInfo) => void} [draw]
 * @property {() => void} [teardown]
 */

/**
 * @typedef {Object} RenderSessionOptions
 * @property {Number} [fps=60]
 * @property {Number} [duration] - Duration in active `timeUnit` (inferred from target(s) if omitted)
 * @property {Number} [width=1280]
 * @property {Number} [height=720]
 * @property {Tickable|Array<Tickable>} [target]
 * @property {Array<Tickable>} [targets]
 * @property {HTMLCanvasElement|OffscreenCanvas} [canvas]
 * @property {HTMLElement|SVGElement} [domTarget]
 * @property {(ctx: { session: RenderSession, width: Number, height: Number, canvas: HTMLCanvasElement|OffscreenCanvas|null }) => Tickable|RenderSetupResult|void} [setup]
 * @property {(info: FrameInfo) => void} [draw]
 * @property {String} [background]
 * @property {Number} [seed]
 * @property {'ms'|'s'} [timeUnit]
 * @property {Boolean} [includeEndFrame=false]
 * @property {Boolean} [muteCallbacks=false]
 * @property {Boolean} [useVirtualClock=true]
 */

/**
 * @typedef {Object} RenderFramesOptions
 * @property {Number} [from=0]
 * @property {Number} [to]
 * @property {(info: FrameInfo) => void|Promise<void>} [onFrame]
 * @property {AbortSignal} [signal]
 * @property {Number} [yieldEvery=8]
 */

/**
 * @typedef {Object} ExportFramesOptions
 * @property {'png'|'webp'|'jpeg'} [format='png']
 * @property {Number} [quality=0.92]
 * @property {Number} [from=0]
 * @property {Number} [to]
 * @property {(progress: Number, info: FrameInfo) => void} [onProgress]
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {Object} ExportWebMOptions
 * @property {String} [codec] - Preferred WebCodecs codec string (auto-probed if omitted)
 * @property {Number} [bitrate=5000000]
 * @property {Number} [keyFrameInterval=30]
 * @property {Number} [from=0]
 * @property {Number} [to]
 * @property {(progress: Number, info: FrameInfo) => void} [onProgress]
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {Object} ExportWebMResult
 * @property {Blob} blob
 * @property {String} url
 * @property {String} codec
 * @property {Number} width
 * @property {Number} height
 * @property {Number} fps
 * @property {Number} frames
 * @property {Number} durationMs
 */

const yieldTick = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * @param  {Number} width
 * @param  {Number} height
 * @return {HTMLCanvasElement|OffscreenCanvas|null}
 */
const createBackingCanvas = (width, height) => {
  if (isBrowser && doc) {
    const c = doc.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  return null;
};

/**
 * @param  {Array<Tickable>} list
 * @return {Number}
 */
const inferDuration = list => {
  let maxDur = 0;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!t) continue;
    const isInfinite = t.iterationCount === Infinity || t.duration >= 1e11;
    const rawDur = isInfinite ? t.iterationDuration : t.duration;
    const d = Number.isFinite(rawDur) ? rawDur : (Number.isFinite(t.iterationDuration) ? t.iterationDuration : 0);
    const total = (t._delay || 0) + d;
    if (total > maxDur) maxDur = total;
  }
  return maxDur;
};

/**
 * Deterministic frame-by-frame composition runner & media exporter built on Anime.js's virtual clock.
 */
export class RenderSession {
  /** @param {RenderSessionOptions} [options] */
  constructor(options = {}) {
    this._options = options;
    /** @type {'ms'|'s'} */
    this._prevTimeUnit = /** @type {'ms'|'s'} */(engine.timeUnit);
    this._prevUseVirtual = engine.isVirtual;
    this._disposed = false;
    this._hasCustomCanvas = !!options.canvas;
    this._setupTeardown = null;

    if (options.timeUnit && engine.timeUnit !== options.timeUnit) {
      engine.timeUnit = options.timeUnit;
    }

    this.fps = Math.max(1, options.fps || 60);
    this.width = options.width || (options.canvas ? options.canvas.width : 1280);
    this.height = options.height || (options.canvas ? options.canvas.height : 720);
    this.background = options.background;
    this.seed = isNum(options.seed) ? options.seed : null;
    this.includeEndFrame = !!options.includeEndFrame;
    this.muteCallbacks = !!options.muteCallbacks;
    this.useVirtualClock = options.useVirtualClock !== false;

    /** @type {HTMLCanvasElement|OffscreenCanvas|null} */
    this.canvas = options.canvas || (options.draw || options.domTarget ? createBackingCanvas(this.width, this.height) : null);
    /** @type {HTMLElement|SVGElement|null} */
    this.domTarget = options.domTarget || null;
    /** @type {((info: FrameInfo) => void)|null} */
    this.draw = options.draw || null;

    /** @type {Array<Tickable>} */
    this.targets = [];
    /** @type {HTMLCanvasElement|OffscreenCanvas|null} */
    this._captureCanvas = null;
    this._frame = 0;
    this._lastRenderedFrame = -1;
    this._frameDurationMs = K / this.fps;

    this._initScene();
  }

  /** @return {void} */
  _initScene() {
    if (this._setupTeardown) {
      this._setupTeardown();
      this._setupTeardown = null;
    }

    // Cancel any prior managed targets if re-initializing
    for (let i = 0; i < this.targets.length; i++) {
      if (this.targets[i] && this.targets[i].cancel) {
        this.targets[i].cancel();
      }
    }
    this.targets = [];

    if (this.seed !== null) {
      setRandomSeed(this.seed);
    }

    if (this.useVirtualClock) {
      engine.useVirtualClock(0);
    }

    const opts = this._options;
    if (opts.target) {
      if (isArr(opts.target)) this.targets.push(...opts.target);
      else this.targets.push(opts.target);
    }
    if (isArr(opts.targets)) {
      for (let i = 0; i < opts.targets.length; i++) {
        if (opts.targets[i]) this.targets.push(opts.targets[i]);
      }
    }

    if (isFnc(opts.setup)) {
      const res = opts.setup({
        session: this,
        width: this.width,
        height: this.height,
        canvas: this.canvas,
      });
      if (res) {
        const resAny = /** @type {any} */(res);
        if (resAny.seek && resAny.pause) {
          this.targets.push(/** @type {Tickable} */(resAny));
        } else {
          if (resAny.target) this.targets.push(resAny.target);
          if (isArr(resAny.targets)) this.targets.push(...resAny.targets);
          if (resAny.canvas) this.canvas = resAny.canvas;
          if (resAny.domTarget) this.domTarget = resAny.domTarget;
          if (isFnc(resAny.draw)) this.draw = resAny.draw;
          if (isFnc(resAny.teardown)) this._setupTeardown = resAny.teardown;
        }
      }
    }

    // Pause managed targets so render session drives exact deterministic positions
    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i];
      if (t && t.pause) t.pause();
    }

    const unitScale = engine.timeUnit === 's' ? K : 1;
    const explicitDurationMs = !isUnd(opts.duration) ? opts.duration * unitScale : null;
    const inferredMs = inferDuration(this.targets) * unitScale;
    this.durationMs = Math.max(1, explicitDurationMs !== null ? explicitDurationMs : (inferredMs || K));
    this.totalFrames = Math.max(
      1,
      this.includeEndFrame
        ? Math.floor((this.durationMs / K) * this.fps) + 1
        : Math.round((this.durationMs / K) * this.fps)
    );
    this._frame = 0;
    this._lastRenderedFrame = -1;
  }

  /** @return {Number} */
  get frame() {
    return this._frame;
  }

  /** @return {Number} */
  get duration() {
    return engine.timeUnit === 's' ? this.durationMs / K : this.durationMs;
  }

  /** @return {Number} */
  get currentTimeMs() {
    return this._frame * this._frameDurationMs;
  }

  /** @return {Number} */
  get currentTime() {
    return engine.timeUnit === 's' ? this.currentTimeMs / K : this.currentTimeMs;
  }

  /** @return {Number} */
  get progress() {
    if (this.totalFrames <= 1) return this.currentTimeMs >= this.durationMs ? 1 : 0;
    return clamp(this.currentTimeMs / this.durationMs, 0, 1);
  }

  /**
   * @param  {Number} frameIndex
   * @return {FrameInfo}
   */
  _buildFrameInfo(frameIndex) {
    const timeMs = clamp(frameIndex * this._frameDurationMs, 0, this.durationMs);
    const time = engine.timeUnit === 's' ? timeMs / K : timeMs;
    const ctx = this.canvas ? /** @type {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D|null} */(this.canvas.getContext('2d')) : null;
    return {
      frame: frameIndex,
      totalFrames: this.totalFrames,
      time,
      timeMs,
      deltaMs: this._frameDurationMs,
      progress: this.durationMs > 0 ? clamp(timeMs / this.durationMs, 0, 1) : 0,
      fps: this.fps,
      canvas: this.canvas,
      ctx,
    };
  }

  /**
   * Deterministically seeks the scene to `frameIndex` and evaluates all targets + draw hook.
   *
   * @param  {Number} frameIndex
   * @param  {Boolean} [muteCallbacks]
   * @return {FrameInfo}
   */
  seekFrame(frameIndex, muteCallbacks = this.muteCallbacks) {
    const clampedFrame = clamp(Math.round(frameIndex), 0, Math.max(0, this.totalFrames - 1));
    const timeMs = clamp(clampedFrame * this._frameDurationMs, 0, this.durationMs);
    const time = engine.timeUnit === 's' ? timeMs / K : timeMs;

    // If going backwards and scene uses free engine animations via setup(), replay deterministically from 0
    if (clampedFrame < this._lastRenderedFrame && isFnc(this._options.setup) && !this.targets.length) {
      this._initScene();
      for (let f = 0; f <= clampedFrame; f++) {
        const stepTimeMs = clamp(f * this._frameDurationMs, 0, this.durationMs);
        engine.setTime(stepTimeMs, true);
      }
    } else {
      if (this.useVirtualClock) {
        engine.setTime(timeMs, true);
      }
      for (let i = 0; i < this.targets.length; i++) {
        const target = this.targets[i];
        if (target && target.seek) {
          target.seek(time, muteCallbacks ? 1 : 0);
        }
      }
    }

    this._frame = clampedFrame;
    this._lastRenderedFrame = clampedFrame;
    const info = this._buildFrameInfo(clampedFrame);

    if (this.canvas && this.background && info.ctx && !this.domTarget) {
      info.ctx.fillStyle = this.background;
      info.ctx.fillRect(0, 0, this.width, this.height);
    }

    if (this.draw) {
      this.draw(info);
    }

    return info;
  }

  /**
   * Seeks to a specific time in the active `timeUnit`.
   *
   * @param  {Number} time
   * @return {FrameInfo}
   */
  seekTime(time) {
    const timeMs = engine.timeUnit === 's' ? time * K : time;
    const frameIndex = Math.round(timeMs / this._frameDurationMs);
    return this.seekFrame(frameIndex);
  }

  /**
   * Seeks to normalized progress `[0..1]`.
   *
   * @param  {Number} progress
   * @return {FrameInfo}
   */
  seekProgress(progress) {
    const p = clamp(progress, 0, 1);
    const frameIndex = Math.round(p * Math.max(0, this.totalFrames - 1));
    return this.seekFrame(frameIndex);
  }

  /**
   * Steps forward (or backward) by `deltaFrames`.
   *
   * @param  {Number} [deltaFrames=1]
   * @return {FrameInfo}
   */
  stepFrame(deltaFrames = 1) {
    return this.seekFrame(this._frame + deltaFrames);
  }

  /**
   * Resets the render session cleanly back to frame 0.
   *
   * @return {FrameInfo}
   */
  reset() {
    this._initScene();
    return this.seekFrame(0);
  }

  /**
   * Captures the current frame onto an exportable Canvas/OffscreenCanvas.
   *
   * @return {Promise<HTMLCanvasElement|OffscreenCanvas>}
   */
  async _snapshotCurrentCanvas() {
    const source = this.domTarget || this.canvas;
    if (!source) {
      throw new Error('RenderSession has no `canvas` or `domTarget` to capture.');
    }
    if (source === this.canvas && !this.background) {
      return this.canvas;
    }
    if (!this._captureCanvas) {
      this._captureCanvas = createBackingCanvas(this.width, this.height);
    }
    if (!this._captureCanvas) {
      throw new Error('Failed to create backing capture canvas.');
    }
    return captureTargetFrame(source, this._captureCanvas, {
      width: this.width,
      height: this.height,
      background: this.background,
    });
  }

  /**
   * Deterministically evaluates every frame in `[from..to]` sequentially.
   *
   * @param  {RenderFramesOptions} [options]
   * @return {Promise<Number>} Number of frames rendered
   */
  async renderFrames(options = {}) {
    const from = Math.max(0, options.from || 0);
    const to = Math.min(this.totalFrames - 1, options.to !== undefined ? options.to : this.totalFrames - 1);
    const yieldEvery = options.yieldEvery !== undefined ? options.yieldEvery : 8;
    const signal = options.signal;
    let count = 0;

    for (let f = from; f <= to; f++) {
      if (signal && signal.aborted) {
        throw new Error('Render aborted');
      }
      const info = this.seekFrame(f);
      if (options.onFrame) {
        await options.onFrame(info);
      }
      count++;
      if (yieldEvery > 0 && count % yieldEvery === 0) {
        await yieldTick();
      }
    }
    return count;
  }

  /**
   * Exports a deterministic sequence of PNG/WebP/JPEG Blobs for every frame in `[from..to]`.
   *
   * @param  {ExportFramesOptions} [options]
   * @return {Promise<Array<{ frame: Number, timeMs: Number, blob: Blob }>>}
   */
  async exportFrames(options = {}) {
    const format = options.format || 'png';
    const quality = options.quality !== undefined ? options.quality : 0.92;
    const from = Math.max(0, options.from || 0);
    const to = Math.min(this.totalFrames - 1, options.to !== undefined ? options.to : this.totalFrames - 1);
    const total = Math.max(1, to - from + 1);
    /** @type {Array<{ frame: Number, timeMs: Number, blob: Blob }>} */
    const frames = [];

    await this.renderFrames({
      from,
      to,
      signal: options.signal,
      yieldEvery: 4,
      onFrame: async info => {
        const snap = await this._snapshotCurrentCanvas();
        const blob = await canvasToBlob(snap, format, quality);
        frames.push({ frame: info.frame, timeMs: info.timeMs, blob });
        if (options.onProgress) {
          options.onProgress((info.frame - from + 1) / total, info);
        }
      },
    });

    return frames;
  }

  /**
   * Deterministically encodes every frame via WebCodecs (`VideoEncoder`) and muxes into a `.webm` Blob.
   *
   * @param  {ExportWebMOptions} [options]
   * @return {Promise<ExportWebMResult>}
   */
  async exportWebM(options = {}) {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
      throw new Error('WebCodecs (VideoEncoder / VideoFrame) is not supported in this runtime. Use `exportFrames()` or a Chromium-based browser.');
    }

    const from = Math.max(0, options.from || 0);
    const to = Math.min(this.totalFrames - 1, options.to !== undefined ? options.to : this.totalFrames - 1);
    const total = Math.max(1, to - from + 1);
    const bitrate = options.bitrate || 5_000_000;
    const keyFrameInterval = Math.max(1, options.keyFrameInterval || 30);

    // Ensure even dimensions for WebCodecs VP8/VP9 encoders
    const width = this.width % 2 === 0 ? this.width : this.width + 1;
    const height = this.height % 2 === 0 ? this.height : this.height + 1;

    const candidates = options.codec
      ? [options.codec]
      : ['vp09.00.10.08', 'vp8', 'av01.0.04M.08'];

    let chosenConfig = null;
    for (let i = 0; i < candidates.length; i++) {
      const cfg = {
        codec: candidates[i],
        width,
        height,
        bitrate,
        framerate: this.fps,
      };
      try {
        const support = await VideoEncoder.isConfigSupported(cfg);
        if (support && support.supported) {
          chosenConfig = cfg;
          break;
        }
      } catch {
        // Probe next codec
      }
    }

    if (!chosenConfig) {
      throw new Error(`No supported WebCodecs video codec found among: ${candidates.join(', ')}`);
    }

    /** @type {Array<{ data: Uint8Array, timestampMs: Number, isKey: Boolean }>} */
    const encodedChunks = [];
    /** @type {Error|null} */
    let encoderError = null;

    const encoder = new VideoEncoder({
      output: chunk => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        encodedChunks.push({
          data,
          timestampMs: chunk.timestamp / 1000,
          isKey: chunk.type === 'key',
        });
      },
      error: err => {
        encoderError = err instanceof Error ? err : new Error(String(err));
      },
    });

    encoder.configure(chosenConfig);

    try {
      await this.renderFrames({
        from,
        to,
        signal: options.signal,
        yieldEvery: 2,
        onFrame: async info => {
          if (encoderError) throw encoderError;
          const snap = await this._snapshotCurrentCanvas();
          const timestampUs = Math.round((info.frame - from) * this._frameDurationMs * 1000);
          const durationUs = Math.round(this._frameDurationMs * 1000);
          const vframe = new VideoFrame(snap, {
            timestamp: timestampUs,
            duration: durationUs,
          });
          const keyFrame = (info.frame - from) % keyFrameInterval === 0;
          encoder.encode(vframe, { keyFrame });
          vframe.close();
          if (options.onProgress) {
            options.onProgress((info.frame - from + 1) / total, info);
          }
        },
      });

      await encoder.flush();
      if (encoderError) throw encoderError;
    } finally {
      if (encoder.state !== 'closed') {
        encoder.close();
      }
    }

    const durationMs = total * this._frameDurationMs;
    const bytes = muxWebMFrames({
      width,
      height,
      fps: this.fps,
      codec: chosenConfig.codec,
      durationMs,
      chunks: encodedChunks,
    });

    const blob = new Blob([/** @type {BlobPart} */(bytes)], { type: 'video/webm' });
    const url = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(blob) : '';

    return {
      blob,
      url,
      codec: chosenConfig.codec,
      width,
      height,
      fps: this.fps,
      frames: total,
      durationMs,
    };
  }

  /**
   * Restores engine clock, random seed, timeUnit, and releases setup resources.
   *
   * @return {this}
   */
  dispose() {
    if (this._disposed) return this;
    this._disposed = true;
    if (this._setupTeardown) {
      this._setupTeardown();
      this._setupTeardown = null;
    }
    if (this.seed !== null) {
      resetRandomSeed();
    }
    if (this.useVirtualClock && !this._prevUseVirtual) {
      engine.useRealClock();
    }
    if (engine.timeUnit !== this._prevTimeUnit) {
      engine.timeUnit = this._prevTimeUnit;
    }
    this._captureCanvas = null;
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
 * Creates a deterministic `RenderSession` for frame-exact stepping, DOM/Canvas snapshots, and WebM video export.
 *
 * @param  {RenderSessionOptions} [options]
 * @return {RenderSession}
 */
export const createRenderSession = options => new RenderSession(options);
