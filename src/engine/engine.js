import {
  defaults,
  globals,
  globalVersions,
} from '../core/globals.js';

import {
  tickModes,
  isBrowser,
  K,
  doc,
} from '../core/consts.js';

import {
  now,
  getVirtualTime,
  setVirtualTime,
  forEachChildren,
  removeChild,
} from '../core/helpers.js';

import {
  Clock,
} from '../core/clock.js';

import {
  tick,
} from '../core/render.js';

import {
  additive,
} from '../animation/additive.js';

/**
 * @import {
 *   DefaultsParams,
 * } from '../types/index.js'
*/

/**
 * @import {
 *   Tickable,
 * } from '../types/index.js'
*/

const engineTickMethod = /*#__PURE__*/ (() => isBrowser ? requestAnimationFrame : setImmediate)();
const engineCancelMethod = /*#__PURE__*/ (() => isBrowser ? cancelAnimationFrame : clearImmediate)();

class Engine extends Clock {

  /** @param {Number} [initTime] */
  constructor(initTime) {
    super(initTime);
    this.useDefaultMainLoop = true;
    this.pauseOnDocumentHidden = true;
    /** @type {DefaultsParams} */
    this.defaults = defaults;
    // this.paused = isBrowser && doc.hidden ? true  : false;
    this.paused = true;
    /** @type {Number|NodeJS.Immediate} */
    this.reqId = 0;
  }

  update() {
    const time = this._currentTime = now();
    if (this.requestTick(time)) {
      this.computeDeltaTime(time);
      const engineSpeed = this._speed;
      const engineFps = this._fps;
      let activeTickable = /** @type {Tickable} */(this._head);
      while (activeTickable) {
        const nextTickable = activeTickable._next;
        if (!activeTickable.paused) {
          tick(
            activeTickable,
            (time - activeTickable._startTime) * activeTickable._speed * engineSpeed,
            0, // !muteCallbacks
            0, // !internalRender
            activeTickable._fps < engineFps ? activeTickable.requestTick(time) : tickModes.AUTO
          );
        } else {
          removeChild(this, activeTickable);
          this._hasChildren = !!this._tail;
          activeTickable._running = false;
          if (activeTickable.completed && !activeTickable._cancelled) {
            activeTickable.cancel();
          }
        }
        activeTickable = nextTickable;
      }
      additive.update();
    }
  }

  wake() {
    if (this.useDefaultMainLoop && !this.reqId) {
      // Imediatly request a tick to update engine._lastTickTime and get accurate offsetPosition calculation in timer.js
      this.requestTick(now());
      this.reqId = engineTickMethod(tickEngine);
    }
    return this;
  }

  pause() {
    if (!this.reqId) return;
    this.paused = true;
    return killEngine();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    forEachChildren(this, (/** @type {Tickable} */child) => child.resetTime());
    return this.wake();
  }

  /** @return {Boolean} */
  get isVirtual() {
    return getVirtualTime() !== null;
  }

  /** @return {Number|null} */
  get virtualTime() {
    return getVirtualTime();
  }

  /**
   * Switches the engine to a deterministic virtual clock starting at `startTime` (ms).
   * Disables the automatic RAF/setImmediate loop until `useRealClock()` is called.
   *
   * @param  {Number} [startTime=0]
   * @return {this}
   */
  useVirtualClock(startTime = 0) {
    if (this.reqId) killEngine();
    this.useDefaultMainLoop = false;
    setVirtualTime(startTime);
    this._currentTime = startTime;
    this._lastTickTime = startTime;
    this._startTime = startTime;
    this._lastTime = startTime;
    forEachChildren(this, (/** @type {Tickable} */child) => child.resetTime());
    return this;
  }

  /**
   * Restores the engine to the wall-clock `Date.now()` loop and re-anchors active tickables.
   *
   * @return {this}
   */
  useRealClock() {
    setVirtualTime(null);
    const time = now();
    this._currentTime = time;
    this._lastTickTime = time;
    this._lastTime = time;
    this.useDefaultMainLoop = true;
    forEachChildren(this, (/** @type {Tickable} */child) => child.resetTime());
    if (this._head) this.wake();
    return this;
  }

  /**
   * Advances the virtual clock by `deltaMs` milliseconds and updates all active tickables.
   * Automatically switches to virtual clock mode at `0` if currently on real-time mode.
   *
   * @param  {Number} [deltaMs=16.666666666666668]
   * @param  {Boolean} [force=true]
   * @return {this}
   */
  step(deltaMs = K / 60, force = true) {
    if (getVirtualTime() === null) this.useVirtualClock(0);
    const nextTime = /** @type {Number} */(getVirtualTime()) + deltaMs;
    setVirtualTime(nextTime);
    if (force) this._lastTickTime = nextTime - this._frameDuration;
    this.update();
    return this;
  }

  /**
   * Jumps the virtual clock to `timeMs` milliseconds and updates all active tickables.
   *
   * @param  {Number} timeMs
   * @param  {Boolean} [force=true]
   * @return {this}
   */
  setTime(timeMs, force = true) {
    if (getVirtualTime() === null) {
      this.useVirtualClock(timeMs);
    } else {
      setVirtualTime(timeMs);
    }
    if (force) this._lastTickTime = timeMs - this._frameDuration;
    this.update();
    return this;
  }

  // Getter and setter for speed
  get speed() {
    return this._speed * (globals.timeScale === 1 ? 1 : K);
  }

  set speed(playbackRate) {
    const speed = playbackRate * globals.timeScale;
    if (this._speed === speed) return;
    this._speed = speed;
    forEachChildren(this, (/** @type {Tickable} */child) => child.speed = child._speed);
  }

  // Getter and setter for timeUnit
  get timeUnit() {
    return globals.timeScale === 1 ? 'ms' : 's';
  }

  set timeUnit(unit) {
    const secondsScale = 0.001;
    const isSecond = unit === 's';
    const newScale = isSecond ? secondsScale : 1;
    if (globals.timeScale !== newScale) {
      globals.timeScale = newScale;
      globals.tickThreshold = 200 * newScale;
      const scaleFactor = isSecond ? secondsScale : K;
      /** @type {Number} */
      (this.defaults.duration) *= scaleFactor;
      this._speed *= scaleFactor;
    }
  }

  // Getter and setter for precision
  get precision() {
    return globals.precision;
  }

  set precision(precision) {
    globals.precision = precision;
  }

}

export const engine = /*#__PURE__*/(() => {
  const engine = new Engine(now());
  if (isBrowser) {
    globalVersions.engine = engine;
    doc.addEventListener('visibilitychange', () => {
      if (!engine.pauseOnDocumentHidden) return;
      doc.hidden ? engine.pause() : engine.resume();
    });
  }
  return engine;
})();


const tickEngine = () => {
  if (engine._head) {
    engine.reqId = engineTickMethod(tickEngine);
    engine.update();
  } else {
    engine.reqId = 0;
  }
}

const killEngine = () => {
  engineCancelMethod(/** @type {NodeJS.Immediate & Number} */(engine.reqId));
  engine.reqId = 0;
  return engine;
}
