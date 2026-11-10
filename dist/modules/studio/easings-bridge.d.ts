/**
 * @import {
 *   EasingFunction,
 *   EasingParam,
 *   Tween,
 * } from '../types/index.js'
 *
 * @import { JSAnimation } from '../animation/animation.js'
 * @import { Timeline } from '../timeline/timeline.js'
 */
/** @type {Array<{ label: String, value: String, kind: 'ease'|'bezier'|'spring' }>} */
export const EASING_PRESETS: Array<{
    label: string;
    value: string;
    kind: "ease" | "bezier" | "spring";
}>;
export function sampleEaseCurve(easeFn: EasingFunction, samples?: number): {
    points: Array<{
        t: number;
        y: number;
    }>;
    minY: number;
    maxY: number;
};
export function parseCubicBezierString(str: string): [number, number, number, number] | null;
export function describeEasing(rawEase: EasingParam | any, compiledEase?: EasingFunction): EasingDescriptor;
export function buildStudioEasing(spec: {
    kind: "ease" | "bezier" | "spring";
    value?: string;
    bezier?: [number, number, number, number];
    spring?: {
        bounce?: number;
        duration?: number;
        mass?: number;
        stiffness?: number;
        damping?: number;
        velocity?: number;
    };
}): {
    fn: EasingFunction;
    springInstance: Spring | null;
    label: string;
    descriptor: EasingDescriptor;
};
export function recomputeAnimationTimings(anim: JSAnimation): void;
export function recomputeTimelineTimings(tl: Timeline): void;
export type EasingDescriptor = {
    kind: "ease" | "bezier" | "spring" | "custom";
    label: string;
    fn: EasingFunction;
    bezier?: [number, number, number, number];
    spring?: {
        bounce: number;
        duration: number;
        mass: number;
        stiffness: number;
        damping: number;
        velocity: number;
        settlingDuration: number;
    };
};
import type { EasingFunction } from '../types/index.js';
import type { EasingParam } from '../types/index.js';
import { Spring } from '../easings/spring/index.js';
import type { JSAnimation } from '../animation/animation.js';
import type { Timeline } from '../timeline/timeline.js';
