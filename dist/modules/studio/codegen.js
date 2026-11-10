/**
 * Anime.js - studio - ESM
 * @version v4.5.0
 * @license MIT
 * @copyright 2026 - Julian Garnier
 */

import { round } from '../core/helpers.js';

/**
 * @import { StudioEntry, StudioGroupTrack } from './store.js'
 */

/**
 * Formats an easing descriptor back into valid Anime.js v4 source code.
 *
 * @param  {import('./easings-bridge.js').EasingDescriptor} easing
 * @param  {Set<String>} imports
 * @return {String}
 */
const formatEaseCode = (easing, imports) => {
  if (!easing) return `'out(2)'`;
  if (easing.kind === 'bezier' && easing.bezier) {
    imports.add('cubicBezier');
    return `cubicBezier(${easing.bezier.map(n => round(n, 3)).join(', ')})`;
  }
  if (easing.kind === 'spring' && easing.spring) {
    imports.add('createSpring');
    const s = easing.spring;
    return `createSpring({ bounce: ${round(s.bounce, 2)}, duration: ${round(s.duration, 0)} })`;
  }
  if (easing.kind === 'ease') {
    return `'${easing.label}'`;
  }
  return `'out(2)'`;
};

/**
 * Formats a group track's property dictionary from its live tweens.
 *
 * @param  {StudioGroupTrack} group
 * @param  {Set<String>} imports
 * @return {Record<String, String>}
 */
const extractPropAssignments = (group, imports) => {
  /** @type {Record<String, String>} */
  const props = {};
  const seen = new Set();
  for (let i = 0; i < group.tweens.length; i++) {
    const tw = group.tweens[i];
    if (seen.has(tw.property)) continue;
    seen.add(tw.property);
    const numOnly = parseFloat(tw.toText);
    const isPlainNum = !tw.isColor && !tw.unit && Number.isFinite(numOnly) && String(numOnly) === tw.toText.trim();
    props[tw.property] = isPlainNum ? String(numOnly) : `'${tw.toText}'`;
  }
  if (group.duration > 0) props.duration = String(round(group.duration, 0));
  if (group.delay > 0) props.delay = String(round(group.delay, 0));
  props.ease = formatEaseCode(group.easing, imports);
  return props;
};

/**
 * Generates clean, copy-pasteable Anime.js v4 ESM source code reflecting live Studio edits.
 *
 * @param  {StudioEntry|null} entry
 * @return {String}
 */
const generateAnimeCode = entry => {
  if (!entry) {
    return `// Select or create an animation / timeline to inspect generated Anime.js v4 code.\n`;
  }

  /** @type {Set<String>} */
  const imports = new Set();
  const lines = [];

  if (entry.kind === 'timeline') {
    imports.add('createTimeline');
    const loop = entry.instance.iterationCount === Infinity ? 'true' : (entry.instance.iterationCount > 1 ? entry.instance.iterationCount - 1 : null);
    const tlOpts = [];
    if (loop !== null) tlOpts.push(`loop: ${loop}`);
    if (entry.instance._alternate) tlOpts.push(`alternate: true`);
    const tlOptsStr = tlOpts.length ? `{ ${tlOpts.join(', ')} }` : '';
    lines.push(`const tl = createTimeline(${tlOptsStr});`);
    lines.push('');

    for (let i = 0; i < entry.labels.length; i++) {
      const lbl = entry.labels[i];
      lines.push(`tl.label('${lbl.name}', ${round(lbl.time, 0)});`);
    }

    for (let i = 0; i < entry.groups.length; i++) {
      const group = entry.groups[i];
      const props = extractPropAssignments(group, imports);
      const propLines = Object.entries(props).map(([k, v]) => `  ${k}: ${v},`).join('\n');
      const offsetArg = round(group.offset, 0);
      lines.push(`tl.add('${group.targetLabel}', {\n${propLines}\n}, ${offsetArg});`);
    }
  } else {
    imports.add('animate');
    const group = entry.groups[0];
    if (group) {
      const props = extractPropAssignments(group, imports);
      if (entry.instance.iterationCount === Infinity) props.loop = 'true';
      else if (entry.instance.iterationCount > 1) props.loop = String(entry.instance.iterationCount - 1);
      if (entry.instance._alternate) props.alternate = 'true';
      const propLines = Object.entries(props).map(([k, v]) => `  ${k}: ${v},`).join('\n');
      lines.push(`const anim = animate('${group.targetLabel}', {\n${propLines}\n});`);
    }
  }

  const importList = Array.from(imports).join(', ');
  return `import { ${importList} } from 'animejs';\n\n${lines.join('\n')}\n`;
};

/**
 * Exports a structured, serializable JSON snapshot of a `StudioEntry`.
 *
 * @param  {StudioEntry|null} entry
 * @return {Object|null}
 */
const generateBlueprintJSON = entry => {
  if (!entry) return null;
  return {
    name: entry.name,
    kind: entry.kind,
    duration: round(entry.instance.duration, 2),
    iterationDuration: round(entry.instance.iterationDuration, 2),
    labels: entry.labels.map(l => ({ name: l.name, time: round(l.time, 2) })),
    calls: entry.calls.map(c => ({ name: c.name, time: round(c.time, 2) })),
    tracks: entry.groups.map(g => ({
      target: g.targetLabel,
      offset: round(g.offset, 2),
      delay: round(g.delay, 2),
      duration: round(g.duration, 2),
      ease: g.easing.label,
      tweens: g.tweens.map(t => ({
        property: t.property,
        target: t.targetLabel,
        from: t.fromText,
        to: t.toText,
        offset: round(t.offset, 2),
        delay: round(t.delay, 2),
        duration: round(t.duration, 2),
      })),
    })),
  };
};

export { generateAnimeCode, generateBlueprintJSON };
