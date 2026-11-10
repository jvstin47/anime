import { minValue } from '../core/consts.js';
import { clamp, isFnc, isStr, isUnd, round, forEachChildren } from '../core/helpers.js';
import { parseEase } from '../easings/eases/parser.js';
import { cubicBezier, getCubicBezierParams } from '../easings/cubic-bezier/index.js';
import { createSpring, Spring, getSpringFromEase } from '../easings/spring/index.js';
import { none } from '../easings/none.js';

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
export const EASING_PRESETS = [
  { label: 'linear', value: 'linear', kind: 'ease' },
  { label: 'out(2)', value: 'out(2)', kind: 'ease' },
  { label: 'out(3)', value: 'out(3)', kind: 'ease' },
  { label: 'inOut(3)', value: 'inOut(3)', kind: 'ease' },
  { label: 'inOutExpo', value: 'inOutExpo', kind: 'ease' },
  { label: 'outBack', value: 'outBack(1.7)', kind: 'ease' },
  { label: 'outElastic', value: 'outElastic(1, .4)', kind: 'ease' },
  { label: 'outBounce', value: 'outBounce', kind: 'ease' },
  { label: 'bezier', value: 'cubicBezier(0.22, 1, 0.36, 1)', kind: 'bezier' },
  { label: 'spring', value: 'spring', kind: 'spring' },
];

/**
 * @typedef {Object} EasingDescriptor
 * @property {'ease'|'bezier'|'spring'|'custom'} kind
 * @property {String} label
 * @property {EasingFunction} fn
 * @property {[Number, Number, Number, Number]} [bezier]
 * @property {{ bounce: Number, duration: Number, mass: Number, stiffness: Number, damping: Number, velocity: Number, settlingDuration: Number }} [spring]
 */

/**
 * Samples an easing function across `[0..1]` and reports min/max excursion (for overshoot curves).
 *
 * @param  {EasingFunction} easeFn
 * @param  {Number} [samples=64]
 * @return {{ points: Array<{ t: Number, y: Number }>, minY: Number, maxY: Number }}
 */
export const sampleEaseCurve = (easeFn, samples = 64) => {
  const fn = isFnc(easeFn) ? easeFn : none;
  /** @type {Array<{ t: Number, y: Number }>} */
  const points = [];
  let minY = 0;
  let maxY = 1;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const y = fn(t);
    const safeY = Number.isFinite(y) ? y : t;
    if (safeY < minY) minY = safeY;
    if (safeY > maxY) maxY = safeY;
    points.push({ t, y: safeY });
  }
  return { points, minY, maxY };
};

/**
 * Parses a `cubicBezier(x1, y1, x2, y2)` string if formatted as such.
 *
 * @param  {String} str
 * @return {[Number, Number, Number, Number]|null}
 */
export const parseCubicBezierString = str => {
  if (!isStr(str)) return null;
  const m = /^cubicBezier\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)$/i.exec(str.trim());
  if (!m) return null;
  const nums = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
  if (nums.some(n => !Number.isFinite(n))) return null;
  return /** @type {[Number, Number, Number, Number]} */(nums);
};

/**
 * Extracts a displayable & editable easing descriptor from a raw easing parameter and/or tween `_ease`.
 *
 * @param  {EasingParam|any} rawEase
 * @param  {EasingFunction} [compiledEase]
 * @return {EasingDescriptor}
 */
export const describeEasing = (rawEase, compiledEase) => {
  const springRef = (rawEase && !isUnd(rawEase.ease) && (rawEase instanceof Spring || !isUnd(rawEase.settlingDuration)))
    ? /** @type {Spring} */(rawEase)
    : getSpringFromEase(compiledEase);

  if (springRef) {
    return {
      kind: 'spring',
      label: `createSpring({ bounce: ${round(springRef.bn, 2)}, duration: ${round(springRef.pd, 0)} })`,
      fn: springRef.ease,
      spring: {
        bounce: springRef.bn,
        duration: springRef.pd,
        mass: springRef.m,
        stiffness: springRef.s,
        damping: springRef.d,
        velocity: springRef.v,
        settlingDuration: springRef.settlingDuration,
      },
    };
  }

  const cbPoints = getCubicBezierParams(rawEase) || getCubicBezierParams(compiledEase);
  if (cbPoints) {
    return {
      kind: 'bezier',
      label: `cubicBezier(${cbPoints.map(n => round(n, 3)).join(', ')})`,
      fn: isFnc(compiledEase) ? compiledEase : (isFnc(rawEase) ? rawEase : cubicBezier(...cbPoints)),
      bezier: cbPoints,
    };
  }

  if (isStr(rawEase)) {
    const cb = parseCubicBezierString(rawEase);
    if (cb) {
      return {
        kind: 'bezier',
        label: `cubicBezier(${cb.map(n => round(n, 3)).join(', ')})`,
        fn: isFnc(compiledEase) ? compiledEase : cubicBezier(...cb),
        bezier: cb,
      };
    }
    return {
      kind: 'ease',
      label: rawEase,
      fn: isFnc(compiledEase) ? compiledEase : parseEase(rawEase),
    };
  }

  if (isFnc(compiledEase)) {
    return {
      kind: 'custom',
      label: compiledEase.name || 'custom(t)',
      fn: compiledEase,
    };
  }

  return {
    kind: 'ease',
    label: 'out(2)',
    fn: parseEase('out(2)'),
  };
};

/**
 * Builds an Anime.js easing parameter / compiled function from a studio easing descriptor edit.
 *
 * @param  {{ kind: 'ease'|'bezier'|'spring', value?: String, bezier?: [Number, Number, Number, Number], spring?: { bounce?: Number, duration?: Number, mass?: Number, stiffness?: Number, damping?: Number, velocity?: Number } }} spec
 * @return {{ fn: EasingFunction, springInstance: Spring|null, label: String, descriptor: EasingDescriptor }}
 */
export const buildStudioEasing = spec => {
  if (spec.kind === 'bezier') {
    const [x1, y1, x2, y2] = spec.bezier || [0.22, 1, 0.36, 1];
    const clamped = /** @type {[Number, Number, Number, Number]} */([
      clamp(x1, 0, 1),
      y1,
      clamp(x2, 0, 1),
      y2,
    ]);
    const fn = cubicBezier(clamped[0], clamped[1], clamped[2], clamped[3]);
    const label = `cubicBezier(${clamped.map(n => round(n, 2)).join(', ')})`;
    return {
      fn,
      springInstance: null,
      label,
      descriptor: { kind: 'bezier', label, fn, bezier: clamped },
    };
  }

  if (spec.kind === 'spring') {
    const spParams = spec.spring || {};
    const springInstance = createSpring({
      bounce: spParams.bounce !== undefined ? spParams.bounce : 0.45,
      duration: spParams.duration !== undefined ? spParams.duration : 628,
      mass: spParams.mass,
      stiffness: spParams.stiffness,
      damping: spParams.damping,
      velocity: spParams.velocity,
    });
    const label = `createSpring({ bounce: ${round(springInstance.bn, 2)}, duration: ${round(springInstance.pd, 0)} })`;
    return {
      fn: springInstance.ease,
      springInstance,
      label,
      descriptor: {
        kind: 'spring',
        label,
        fn: springInstance.ease,
        spring: {
          bounce: springInstance.bn,
          duration: springInstance.pd,
          mass: springInstance.m,
          stiffness: springInstance.s,
          damping: springInstance.d,
          velocity: springInstance.v,
          settlingDuration: springInstance.settlingDuration,
        },
      },
    };
  }

  const easeStr = spec.value || 'out(2)';
  const cb = parseCubicBezierString(easeStr);
  if (cb) {
    return buildStudioEasing({ kind: 'bezier', bezier: cb });
  }
  const fn = parseEase(easeStr);
  return {
    fn,
    springInstance: null,
    label: easeStr,
    descriptor: { kind: 'ease', label: easeStr, fn },
  };
};

/**
 * Recomputes an animation's `iterationDuration` and `duration`, and bubbles up to its parent Timeline if attached.
 *
 * @param  {JSAnimation} anim
 * @return {void}
 */
export const recomputeAnimationTimings = anim => {
  let maxEnd = 0;
  forEachChildren(anim, (/** @type {Tween} */tween) => {
    const end = (tween._startTime || 0) + (tween._updateDuration || 0);
    if (end > maxEnd) maxEnd = end;
  });
  const iterDur = Math.max(minValue, round(maxEnd, 12));
  anim.iterationDuration = iterDur;
  anim.duration = iterDur === minValue
    ? minValue
    : Math.min(1e12, ((iterDur + anim._loopDelay) * anim.iterationCount) - anim._loopDelay) || minValue;

  const parent = anim.parent;
  if (parent) {
    recomputeTimelineTimings(parent);
  }
};

/**
 * Recomputes a timeline's `iterationDuration` and `duration` from its children linked list.
 *
 * @param  {Timeline} tl
 * @return {void}
 */
export const recomputeTimelineTimings = tl => {
  let maxEnd = 0;
  forEachChildren(tl, (/** @type {JSAnimation} */child) => {
    const childEnd = (child._offset || 0) + (child._delay || 0) + (child.duration || 0);
    if (childEnd > maxEnd) maxEnd = childEnd;
  });
  tl.iterationDuration = round(maxEnd, 12);
  tl.duration = Math.min(1e12, ((tl.iterationDuration + tl._loopDelay) * tl.iterationCount) - tl._loopDelay) || minValue;
};
