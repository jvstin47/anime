export const engine: Engine;
declare class Engine extends Clock {
    useDefaultMainLoop: boolean;
    pauseOnDocumentHidden: boolean;
    /** @type {DefaultsParams} */
    defaults: DefaultsParams;
    paused: boolean;
    /** @type {Number|NodeJS.Immediate} */
    reqId: number | NodeJS.Immediate;
    update(): void;
    wake(): this;
    pause(): Engine;
    resume(): this;
    /** @return {Boolean} */
    get isVirtual(): boolean;
    /** @return {Number|null} */
    get virtualTime(): number | null;
    /**
     * Switches the engine to a deterministic virtual clock starting at `startTime` (ms).
     * Disables the automatic RAF/setImmediate loop until `useRealClock()` is called.
     *
     * @param  {Number} [startTime=0]
     * @return {this}
     */
    useVirtualClock(startTime?: number): this;
    /**
     * Restores the engine to the wall-clock `Date.now()` loop and re-anchors active tickables.
     *
     * @return {this}
     */
    useRealClock(): this;
    /**
     * Advances the virtual clock by `deltaMs` milliseconds and updates all active tickables.
     * Automatically switches to virtual clock mode at `0` if currently on real-time mode.
     *
     * @param  {Number} [deltaMs=16.666666666666668]
     * @param  {Boolean} [force=true]
     * @return {this}
     */
    step(deltaMs?: number, force?: boolean): this;
    /**
     * Jumps the virtual clock to `timeMs` milliseconds and updates all active tickables.
     *
     * @param  {Number} timeMs
     * @param  {Boolean} [force=true]
     * @return {this}
     */
    setTime(timeMs: number, force?: boolean): this;
    set timeUnit(unit: "ms" | "s");
    get timeUnit(): "ms" | "s";
    set precision(precision: number);
    get precision(): number;
}
import { Clock } from '../core/clock.js';
import type { DefaultsParams } from '../types/index.js';
export {};
