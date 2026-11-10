import {
  createTimeline,
  createSpring,
  cubicBezier,
  stagger,
} from '../../dist/modules/index.js';
import { showStudio } from '../../dist/modules/studio/index.js';

const stageRoot = /** @type {HTMLElement} */(document.getElementById('stage-root'));
const canvas = /** @type {HTMLCanvasElement} */(document.getElementById('scene'));
const ctx = /** @type {CanvasRenderingContext2D} */(canvas.getContext('2d'));
const phaseEl = /** @type {HTMLElement} */(document.getElementById('phase-readout'));
const badgeASub = /** @type {HTMLElement|null} */(document.querySelector('.hud-badge-a .sub'));
const badgeATitle = /** @type {HTMLElement|null} */(document.querySelector('.hud-badge-a > div:nth-child(2)'));

const studio = showStudio({
  mode: 'workspace',
  stageElement: stageRoot,
  stageWidth: 960,
  stageHeight: 540,
  projectName: 'Orbital Motion Demo',
  fps: 60,
});

const PALETTE = ['#4A9EFF', '#3FB950', '#D29922', '#A371F7', '#56B6C2', '#E5534B'];

/** @type {Array<{ x: Number, y: Number, scale: Number, rot: Number, radius: Number, color: String, visible: Boolean }>} */
const nodes = [];
const cols = 6;
const rows = 4;
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    nodes.push({
      x: 200 + c * 112,
      y: 120 + r * 100,
      scale: 0.4,
      rot: 0,
      radius: 16,
      color: PALETTE[(r * cols + c) % PALETTE.length],
      visible: true,
    });
  }
}

const core = {
  pulse: 0.6,
  ringRadius: 48,
  orbitAngle: 0,
  waveAmp: 12,
  visible: true,
};

function renderCanvas() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#111317';
  ctx.fillRect(0, 0, w, h);

  // Subtle technical composition grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let gx = 40; gx < w; gx += 40) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let gy = 40; gy < h; gy += 40) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  // Sine wave ribbon (tied to core visibility)
  if (studio.isTargetVisible(core) && core.visible !== false) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(74, 158, 255, 0.45)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += 12) {
      const y = h / 2 + Math.sin((x / w) * Math.PI * 4 + (core.orbitAngle * Math.PI) / 180) * core.waveAmp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Matrix nodes
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!studio.isTargetVisible(n) || n.visible === false) continue;
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate((n.rot * Math.PI) / 180);
    ctx.scale(n.scale, n.scale);
    ctx.fillStyle = n.color;
    ctx.strokeStyle = 'rgba(236, 238, 242, 0.85)';
    ctx.lineWidth = 1.75;
    const s = n.radius * 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-n.radius, -n.radius, s, s, 4);
    else ctx.rect(-n.radius, -n.radius, s, s);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Central kinetic ring
  if (studio.isTargetVisible(core) && core.visible !== false) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((core.orbitAngle * Math.PI) / 180);
    ctx.scale(core.pulse, core.pulse);
    ctx.beginPath();
    ctx.strokeStyle = '#D29922';
    ctx.lineWidth = 2.5;
    ctx.arc(0, 0, core.ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = '#3FB950';
    ctx.arc(core.ringRadius, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

let activeTl = null;
let currentSceneId = 'orbital';

function buildOrbitalScene() {
  currentSceneId = 'orbital';
  if (badgeASub) badgeASub.textContent = 'Cubic Bezier';
  if (badgeATitle) badgeATitle.textContent = 'Orbital Matrix';
  if (phaseEl) phaseEl.textContent = 'Phase: Intro';
  if (activeTl) activeTl.cancel();

  const tl = createTimeline({
    id: 'Orbital Synth',
    loop: true,
    alternate: true,
    onRender: renderCanvas,
  });

  tl.label('intro', 0)
    .add(nodes, {
      id: 'Matrix Nodes',
      scale: [0.4, 1.3],
      rot: [0, 180],
      duration: 850,
      ease: cubicBezier(0.22, 1, 0.36, 1),
    }, stagger(45, { grid: [cols, rows], from: 'center' }))
    .add('.hud-badge-a', {
      id: 'Badge Overlay',
      x: [18, 0],
      opacity: [0.4, 1],
      duration: 600,
      ease: 'out(3)',
    }, 0)
    .add('.dot-chip', {
      id: 'Status Chips',
      scale: [0.6, 1.25],
      backgroundColor: '#3FB950',
      duration: 450,
      ease: 'outBack(1.7)',
    }, stagger(60, { start: 120 }))
    .label('pulse', 450)
    .add(core, {
      id: 'Orbital Core',
      pulse: [0.6, 1.45],
      ringRadius: [48, 175],
      orbitAngle: [0, 360],
      waveAmp: [12, 68],
      duration: 1200,
      ease: createSpring({ bounce: 0.45, duration: 950 }),
    }, 300)
    .label('settle', 1300)
    .call(() => {
      phaseEl.textContent = `Phase: Peak (${Math.round(tl.currentTime)}ms)`;
    }, 900)
    .add('.hud-badge-b', {
      id: 'Phase Indicator',
      y: [10, 0],
      borderColor: '#4A9EFF',
      duration: 500,
      ease: 'out(2)',
    }, 900);

  activeTl = tl;
  studio.select(Array.from(studio.store.entries.keys()).pop());
  renderCanvas();
}

function buildSpringCascade() {
  currentSceneId = 'cascade';
  if (badgeASub) badgeASub.textContent = 'Spring Physics';
  if (badgeATitle) badgeATitle.textContent = 'Cascade Matrix';
  if (phaseEl) phaseEl.textContent = 'Phase: Drop';
  if (activeTl) activeTl.cancel();

  const tl = createTimeline({
    id: 'Spring Cascade',
    loop: true,
    alternate: true,
    onRender: renderCanvas,
  });

  tl.label('drop', 0)
    .add(nodes, {
      id: 'Cascade Matrix',
      y: (_, i) => [120 + Math.floor(i / cols) * 100 - 40, 120 + Math.floor(i / cols) * 100 + 35],
      scale: [0.5, 1.5],
      rot: [-45, 45],
      duration: 900,
      ease: createSpring({ bounce: 0.65, duration: 850 }),
    }, stagger(35, { from: 'first' }))
    .add(core, {
      id: 'Orbital Core',
      pulse: [0.4, 1.8],
      orbitAngle: [0, -270],
      waveAmp: [5, 95],
      duration: 1100,
      ease: 'inOutBack(1.8)',
    }, 150)
    .label('rebound', 700)
    .add('.stage-tag', {
      id: 'HUD Badges',
      x: [-10, 0],
      duration: 500,
      ease: 'out(3)',
    }, stagger(80, { start: 100 }));

  activeTl = tl;
  studio.select(Array.from(studio.store.entries.keys()).pop());
  renderCanvas();
}

let customNodeSeq = 0;

function addKineticNode() {
  if (!activeTl) return;
  const idx = ++customNodeSeq;
  const node = {
    x: 160 + ((idx * 137) % 640),
    y: 100 + ((idx * 89) % 340),
    scale: 0.3,
    rot: 0,
    radius: 18,
    color: PALETTE[idx % PALETTE.length],
    visible: true,
  };
  nodes.push(node);
  activeTl.add(node, {
    id: `Orbiter #${idx}`,
    scale: [0.3, 1.6],
    rot: [0, 360],
    duration: 900,
    ease: createSpring({ bounce: 0.55, duration: 850 }),
  }, 150);
  studio.store.refreshAll();
  studio.store.emit();
  renderCanvas();
}

studio.setSceneSupport({
  scenes: [
    { id: 'orbital', label: 'Orbital Synth' },
    { id: 'cascade', label: 'Spring Cascade' },
  ],
  activeSceneId: currentSceneId,
  onSelectScene: id => {
    if (id === 'cascade') buildSpringCascade();
    else buildOrbitalScene();
  },
  onAddObject: addKineticNode,
});

buildOrbitalScene();
