/**
 * Anime.js - studio - CJS
 * @version v4.5.0
 * @license MIT
 * @copyright 2026 - Julian Garnier
 */

'use strict';

/**
 * Design system tokens and full workspace / dock stylesheets for Anime.js V4 Studio.
 */

const STUDIO_STYLES = `
:host {
  all: initial;
  --font-ui: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;

  --bg-app: #0D0E10;
  --bg-canvas: #090A0C;
  --bg-panel: #141619;
  --bg-elevated: #1B1E23;
  --bg-control: #22262C;
  --bg-control-hover: #2A2F37;
  --bg-selected: rgba(74, 158, 255, 0.14);

  --border-subtle: #23272E;
  --border-strong: #313640;
  --border-focus: #4A9EFF;

  --text-primary: #ECEEF2;
  --text-secondary: #9CA3AF;
  --text-muted: #6B7280;

  --accent: #4A9EFF;
  --accent-hover: #63ACFF;
  --playhead: #E5534B;
  --success: #3FB950;
  --warning: #D29922;
  --purple: #A371F7;

  --control-h: 24px;
  --header-h: 38px;
  --toolbar-h: 32px;

  font-family: var(--font-ui);
  font-size: 11px;
  line-height: 1.35;
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}

:host([mode="dock"]) {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483640;
  pointer-events: none;
}

:host([mode="workspace"]) {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2147483640;
  display: block;
}

*, *::before, *::after {
  box-sizing: border-box;
}

/* Custom slim technical scrollbars */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2B3038; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #3D4450; }

/* Base Controls */
button, select, input {
  font-family: inherit;
  font-size: 11px;
  color: var(--text-primary);
}

button {
  height: var(--control-h);
  padding: 0 8px;
  background: var(--bg-control);
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.1s ease, border-color 0.1s ease, color 0.1s ease;
}
button:hover:not(:disabled) {
  background: var(--bg-control-hover);
  border-color: var(--border-strong);
}
button:focus-visible, select:focus-visible, input:focus-visible {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 1px rgba(74, 158, 255, 0.35);
}
button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
button.icon-btn {
  width: var(--control-h);
  padding: 0;
}
button.ghost {
  background: transparent;
  border-color: transparent;
  color: var(--text-secondary);
}
button.ghost:hover:not(:disabled) {
  background: var(--bg-control);
  color: var(--text-primary);
}
button.active {
  background: var(--bg-selected);
  border-color: rgba(74, 158, 255, 0.55);
  color: var(--accent);
}
button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #090A0C;
  font-weight: 600;
}
button.primary:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}
button.success {
  background: #238636;
  border-color: #2EA043;
  color: #F6F8FA;
  font-weight: 600;
}
button.success:hover:not(:disabled) {
  background: #2EA043;
}

select, input[type="number"], input[type="text"] {
  height: var(--control-h);
  padding: 0 6px;
  background: var(--bg-app);
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  outline: none;
  min-width: 0;
}
input[type="number"] {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
input[type="range"] {
  accent-color: var(--accent);
  cursor: pointer;
}
select:hover:not(:disabled), input:hover:not(:disabled):not([readonly]) {
  border-color: var(--border-strong);
}
input[readonly] {
  color: var(--text-secondary);
  background: var(--bg-panel);
}

/* Target Highlighter Overlay */
.overlay-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}
.highlight-box {
  position: fixed;
  border: 1px solid var(--accent);
  background: rgba(74, 158, 255, 0.06);
  pointer-events: none;
}
.highlight-tag {
  position: absolute;
  top: -17px;
  left: -1px;
  background: var(--accent);
  color: #090A0C;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 2px;
  white-space: nowrap;
}

/* =========================================================
   DESKTOP WORKSPACE SHELL (CSS GRID)
   ========================================================= */
.shell-workspace {
  width: 100vw;
  height: 100vh;
  background: var(--bg-app);
  display: grid;
  grid-template-rows: var(--header-h) minmax(240px, 1fr) 4px var(--timeline-h, 256px);
  grid-template-columns: var(--left-w, 240px) 4px minmax(340px, 1fr) 4px var(--right-w, 304px);
  grid-template-areas:
    "header   header    header    header    header"
    "left     split-l   canvas    split-r   right"
    "split-t  split-t   split-t   split-t   split-t"
    "timeline timeline  timeline  timeline  timeline";
  overflow: hidden;
  user-select: none;
}

.shell-dock {
  pointer-events: auto;
  position: relative;
  z-index: 3;
  width: 100%;
  background: var(--bg-panel);
  border-top: 1px solid var(--border-strong);
  display: flex;
  flex-direction: column;
  user-select: none;
}
.shell-dock.collapsed .dock-grid { display: none; }
.shell-dock.collapsed .splitter-h { display: none; }

.dock-grid {
  display: grid;
  grid-template-columns: var(--left-w, 200px) 1fr var(--right-w, 296px);
  height: var(--timeline-h, 286px);
  overflow: hidden;
}

/* Splitters */
.splitter-v {
  background: var(--bg-app);
  border-left: 1px solid var(--border-subtle);
  border-right: 1px solid var(--border-subtle);
  cursor: ew-resize;
  transition: background-color 0.12s;
}
.splitter-v:hover, .splitter-v.dragging { background: var(--accent); }

.splitter-h {
  height: 4px;
  background: var(--bg-app);
  border-top: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
  cursor: ns-resize;
  transition: background-color 0.12s;
}
.splitter-h:hover, .splitter-h.dragging { background: var(--accent); }

/* A. APPLICATION HEADER */
.app-header {
  grid-area: header;
  height: var(--header-h);
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.header-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.brand-mark {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  padding-right: 8px;
  border-right: 1px solid var(--border-subtle);
}
.brand-version {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  background: var(--bg-app);
  border: 1px solid var(--border-subtle);
  padding: 1px 4px;
  border-radius: 2px;
}

.project-name-input {
  width: 150px;
  background: transparent;
  border-color: transparent;
  font-weight: 500;
  color: var(--text-primary);
  padding: 0 6px;
}
.project-name-input:hover { background: var(--bg-app); border-color: var(--border-subtle); }
.project-name-input:focus { background: var(--bg-app); border-color: var(--border-focus); }

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--text-secondary);
  padding: 2px 7px;
  border-radius: 3px;
  background: var(--bg-app);
  border: 1px solid var(--border-subtle);
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
}
.status-dot.dirty { background: var(--warning); }

.divider-v {
  width: 1px;
  height: 16px;
  background: var(--border-subtle);
  margin: 0 2px;
}

/* PANEL CHROME */
.panel {
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.panel-left { grid-area: left; }
.panel-right { grid-area: right; }
.panel-left.is-collapsed, .panel-right.is-collapsed { display: none; }

.panel-header {
  height: 28px;
  flex-shrink: 0;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.panel-title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* B. LEFT SIDEBAR — LAYERS & OBJECTS */
.layers-toolbar {
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.layers-search {
  flex: 1;
}

.layers-tree {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
}

.layer-row {
  height: 26px;
  padding: 0 6px 0 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  border-left: 2px solid transparent;
  color: var(--text-secondary);
}
.layer-row:hover {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-primary);
}
.layer-row.selected {
  background: var(--bg-selected);
  border-left-color: var(--accent);
  color: var(--text-primary);
}
.layer-row.sub {
  height: 23px;
  padding-left: 22px;
  font-size: 10.5px;
}
.layer-row.is-hidden {
  opacity: 0.45;
}
.layer-swatch {
  width: 7px;
  height: 7px;
  border-radius: 1.5px;
  flex-shrink: 0;
}
.layer-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.layer-count {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  padding: 0 4px;
}
.layer-actions {
  display: flex;
  align-items: center;
  gap: 1px;
  opacity: 0.65;
}
.layer-row:hover .layer-actions,
.layer-row.selected .layer-actions,
.layer-actions.pinned {
  opacity: 1;
}
.layer-act-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
}
.layer-act-btn:hover { background: var(--bg-control); color: var(--text-primary); }
.layer-act-btn.on { color: var(--accent); }
.layer-act-btn.warn { color: var(--warning); }

/* C. CENTRAL WORKSPACE — CANVAS VIEWPORT */
.canvas-workspace {
  grid-area: canvas;
  background: var(--bg-canvas);
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.canvas-subbar {
  height: 28px;
  flex-shrink: 0;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.canvas-stage-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: var(--bg-canvas);
}
.canvas-stage-wrap.with-grid {
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 24px 24px;
}
.canvas-stage-wrap.pan-mode { cursor: grab; }
.canvas-stage-wrap.pan-mode:active { cursor: grabbing; }

.composition-viewport {
  position: relative;
  border: 1px solid var(--border-strong);
  background: #111317;
  transform-origin: center center;
  flex-shrink: 0;
}
.composition-guides {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}
.composition-guides::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(74, 158, 255, 0.2);
}
.composition-guides::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(74, 158, 255, 0.2);
}

.canvas-dims {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
}

/* D. RIGHT SIDEBAR — PROPERTIES INSPECTOR */
.inspector-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.inspector-context-bar {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--bg-panel);
}
.context-title {
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.context-type {
  font-family: var(--font-mono);
  font-size: 9px;
  text-transform: uppercase;
  color: var(--accent);
  background: var(--bg-selected);
  padding: 2px 5px;
  border-radius: 2px;
  flex-shrink: 0;
}

.section {
  border-bottom: 1px solid var(--border-subtle);
}
.section-head {
  height: 28px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  background: var(--bg-panel);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.section-head:hover { background: var(--bg-elevated); color: var(--text-primary); }
.section-head-left { display: flex; align-items: center; gap: 5px; }
.section-body {
  padding: 8px 10px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #121417;
}
.section.collapsed .section-body { display: none; }

.prop-subgroup {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.prop-sublabel {
  font-size: 10px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.prop-row {
  display: grid;
  grid-template-columns: 70px 1fr 1fr;
  align-items: center;
  gap: 5px;
}
.prop-row-2 {
  display: grid;
  grid-template-columns: 78px 1fr;
  align-items: center;
  gap: 6px;
}
.prop-name {
  font-size: 10.5px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prop-field-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.prop-mini-tag {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  width: 14px;
  flex-shrink: 0;
}
.prop-field-wrap input {
  width: 100%;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.field-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.field-col label {
  font-size: 9.5px;
  color: var(--text-muted);
}

/* Easing & Curve Graph */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.preset-grid button {
  height: 22px;
  font-size: 10px;
  padding: 0 4px;
}

.curve-panel {
  background: var(--bg-app);
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.curve-svg {
  width: 100%;
  max-width: 172px;
  height: 122px;
  align-self: center;
  overflow: visible;
  touch-action: none;
}
.bezier-handle { cursor: grab; }
.bezier-handle:active { cursor: grabbing; }

.slider-line {
  display: grid;
  grid-template-columns: 58px 1fr 40px;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}
.slider-line span:first-child { color: var(--text-secondary); }
.slider-line span:last-child {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--text-primary);
}

/* Stagger Waterfall inside Inspector */
.stagger-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 150px;
  overflow-y: auto;
}
.stagger-row {
  display: grid;
  grid-template-columns: 72px 1fr 44px;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}
.stagger-bar-bg {
  height: 8px;
  background: var(--bg-app);
  border: 1px solid var(--border-subtle);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}
.stagger-bar-fill {
  position: absolute;
  top: 0;
  bottom: 0;
}

/* E. BOTTOM WORKSPACE — TIMELINE */
.timeline-workspace {
  grid-area: timeline;
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.playback-toolbar {
  height: var(--toolbar-h);
  flex-shrink: 0;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.timecode-display {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: var(--text-primary);
  background: var(--bg-app);
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  padding: 0 8px;
  height: var(--control-h);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.timecode-sub { color: var(--text-muted); font-size: 10px; }

.timeline-split {
  flex: 1;
  display: grid;
  grid-template-columns: var(--tl-tree-w, 240px) 1fr;
  min-height: 0;
  overflow: hidden;
}

.tl-tree-pane {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-strong);
  background: var(--bg-panel);
  min-width: 0;
  min-height: 0;
}
.tl-tree-head {
  height: 30px;
  flex-shrink: 0;
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-panel);
}
.tl-tree-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.tl-track-row {
  height: var(--track-row-h, 28px);
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  color: var(--text-secondary);
}
.tl-track-row:hover { background: rgba(255, 255, 255, 0.025); color: var(--text-primary); }
.tl-track-row.selected { background: var(--bg-selected); color: var(--text-primary); }
.tl-track-row.sub {
  height: var(--track-sub-h, 23px);
  padding-left: 24px;
  background: #111316;
  font-size: 10px;
}
.tl-track-row.sub.selected { background: var(--bg-selected); }
.tl-track-row.is-locked { color: var(--text-muted); }

.tl-lanes-pane {
  flex: 1;
  overflow: auto;
  position: relative;
  background: #0F1114;
  min-width: 0;
  min-height: 0;
}

.tl-canvas-inner {
  position: relative;
  min-width: 100%;
  min-height: 100%;
}

.tl-tracks-inset {
  position: relative;
  margin: 0 12px;
  min-height: 100%;
}

.ruler-track {
  position: sticky;
  top: 0;
  z-index: 6;
  height: 30px;
  margin: 0 -12px;
  padding: 0 12px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-strong);
  cursor: ew-resize;
}

.ruler-coords {
  position: relative;
  height: 100%;
}

.ruler-tick {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px solid #2A2F38;
  font-family: var(--font-mono);
  font-size: 9px;
  line-height: 10px;
  color: var(--text-muted);
  padding: 2px 0 0 4px;
  pointer-events: none;
}
.ruler-tick.minor {
  top: 21px;
  border-left-color: #21252C;
}

.ruler-label {
  position: absolute;
  bottom: 2px;
  transform: translateX(-50%);
  background: #6E40C9;
  color: #F6F8FA;
  font-family: var(--font-mono);
  font-size: 8.5px;
  line-height: 12px;
  padding: 0 4px;
  border-radius: 2px;
  pointer-events: none;
  white-space: nowrap;
}

.ruler-call {
  position: absolute;
  bottom: 3px;
  width: 6px;
  height: 6px;
  transform: translateX(-50%) rotate(45deg);
  background: var(--warning);
  pointer-events: none;
}

.playhead-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--playhead);
  z-index: 8;
  pointer-events: none;
}
.playhead-head {
  position: sticky;
  top: 0;
  margin-left: -5px;
  width: 11px;
  height: 12px;
  background: var(--playhead);
  clip-path: polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%);
}

.tl-lane-row {
  height: var(--track-row-h, 28px);
  position: relative;
  border-bottom: 1px solid var(--border-subtle);
}
.tl-lane-row.sub {
  height: var(--track-sub-h, 23px);
  background: rgba(255, 255, 255, 0.01);
}
.tl-lane-row.selected {
  background: rgba(74, 158, 255, 0.04);
}

.bar-wrap {
  position: absolute;
  top: 3px;
  bottom: 3px;
  display: flex;
  align-items: stretch;
  cursor: grab;
}
.bar-wrap:active { cursor: grabbing; }
.bar-wrap.locked { cursor: not-allowed; opacity: 0.65; }

.bar-delay {
  background: repeating-linear-gradient(
    -45deg,
    rgba(255, 255, 255, 0.08),
    rgba(255, 255, 255, 0.08) 3px,
    transparent 3px,
    transparent 6px
  );
  border: 1px dashed rgba(255, 255, 255, 0.22);
  border-right: none;
  border-radius: 2px 0 0 2px;
}

.bar-body {
  position: relative;
  flex: 1;
  min-width: 6px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  overflow: hidden;
}
.bar-wrap.selected .bar-body {
  border-color: #FFFFFF;
  box-shadow: 0 0 0 1px #FFFFFF;
}

.bar-spark {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.35;
  pointer-events: none;
}

.bar-text {
  position: relative;
  z-index: 1;
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 600;
  color: #0D0E10;
  padding: 0 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-resize {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  background: rgba(0, 0, 0, 0.22);
}
.bar-resize:hover { background: #FFFFFF; }

.kf-diamond {
  position: absolute;
  top: 50%;
  width: 7px;
  height: 7px;
  background: #ECEEF2;
  border: 1px solid #0D0E10;
  transform: translate(-50%, -50%) rotate(45deg);
  z-index: 3;
  pointer-events: none;
}
.kf-diamond.active { background: #F0B72F; }

/* EXPORT MODAL */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.68);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal-dialog {
  width: 560px;
  max-width: 96vw;
  max-height: 86vh;
  background: var(--bg-panel);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-header {
  height: 36px;
  padding: 0 12px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}
.modal-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-panel);
  padding: 0 10px;
  gap: 4px;
}
.modal-tab {
  height: 30px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  color: var(--text-secondary);
  padding: 0 10px;
}
.modal-tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}
.modal-body {
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filmstrip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.film-thumb {
  background: var(--bg-app);
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}
.film-thumb:hover { border-color: var(--accent); }
.film-thumb img { width: 100%; aspect-ratio: 16/9; object-fit: contain; display: block; background: #090A0C; }
.film-thumb span {
  font-family: var(--font-mono);
  font-size: 9px;
  padding: 3px 4px;
  color: var(--text-secondary);
  text-align: center;
}

.code-block {
  background: var(--bg-app);
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  padding: 10px;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 10.5px;
  line-height: 1.45;
  color: #D2E0FF;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 280px;
  overflow: auto;
  user-select: text;
}

.status-banner {
  padding: 6px 8px;
  border-radius: 3px;
  background: var(--bg-app);
  border: 1px solid var(--border-subtle);
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--accent);
}

.empty-state {
  padding: 24px 14px;
  text-align: center;
  color: var(--text-muted);
  font-size: 11px;
}

/* Dock Mode compact header adjustments */
.dock-header {
  height: 32px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
`;

exports.STUDIO_STYLES = STUDIO_STYLES;
