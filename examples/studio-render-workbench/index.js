import {
  createTimeline,
  createSpring,
  cubicBezier,
  stagger,
} from '../../dist/modules/index.js';
import { createRenderSession } from '../../dist/modules/render/index.js';
import { showStudio } from '../../dist/modules/studio/index.js';

const canvas = /** @type {HTMLCanvasElement} */(document.getElementById('scene'));
const ctx = /** @type {CanvasRenderingContext2D} */(canvas.getContext('2d'));
const phaseEl = /** @type {HTMLElement} */(document.getElementById('phase-readout'));
const statusEl = /** @type {HTMLElement} */(document.getElementById('export-status'));

const studio = showStudio({ fps: 60 });

const PALETTE = ['#FF4B4B', '#FF8F42', '#F6FF56', '#A4FF4F', '#18FF74', '#3CFFEC', '#61C3FF', '#8453E3', '#FB89FB'];

/** @type {Array<{ x: Number, y: Number, scale: Number, rot: Number, radius: Number, color: String }>} */
const nodes = [];
const cols = 6;
const rows = 4;
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    nodes.push({
      x: 200 + c * 112,
      y: 120 + r * 100,
      scale: 0.35,
      rot: 0,
      radius: 16,
      color: PALETTE[(r * cols + c) % PALETTE.length],
    });
  }
}

const core = {
  pulse: 0.6,
  ringRadius: 48,
  orbitAngle: 0,
  waveAmp: 12,
};

function renderCanvas() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#131212';
  ctx.fillRect(0, 0, w, h);

  // Subtle backdrop grid
  ctx.strokeStyle = 'rgba(246, 244, 242, 0.05)';
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

  // Sine wave ribbon
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(97, 195, 255, 0.45)';
  ctx.lineWidth = 2.5;
  for (let x = 0; x <= w; x += 12) {
    const y = h / 2 + Math.sin((x / w) * Math.PI * 4 + (core.orbitAngle * Math.PI) / 180) * core.waveAmp;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Matrix nodes
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate((n.rot * Math.PI) / 180);
    ctx.scale(n.scale, n.scale);
    ctx.fillStyle = n.color;
    ctx.strokeStyle = '#F6F4F2';
    ctx.lineWidth = 2;
    const s = n.radius * 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-n.radius, -n.radius, s, s, 8);
    else ctx.rect(-n.radius, -n.radius, s, s);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Central kinetic ring
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((core.orbitAngle * Math.PI) / 180);
  ctx.scale(core.pulse, core.pulse);
  ctx.beginPath();
  ctx.strokeStyle = '#F6FF56';
  ctx.lineWidth = 3;
  ctx.arc(0, 0, core.ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = '#18FF74';
  ctx.arc(core.ringRadius, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

let activeTl = null;

function buildOrbitalScene() {
  if (activeTl) activeTl.cancel();

  const tl = createTimeline({
    id: 'Orbital Synth',
    loop: true,
    alternate: true,
    onRender: renderCanvas,
  });

  tl.label('intro', 0)
    .add(nodes, {
      scale: [0.35, 1.3],
      rot: [0, 180],
      duration: 850,
      ease: cubicBezier(0.22, 1, 0.36, 1),
    }, stagger(45, { grid: [cols, rows], from: 'center' }))
    .add('.card-a', {
      x: [24, 0],
      opacity: [0.4, 1],
      duration: 600,
      ease: 'out(3)',
    }, 0)
    .add('.dot-chip', {
      scale: [0.5, 1.25],
      backgroundColor: '#18FF74',
      duration: 450,
      ease: 'outBack(1.7)',
    }, stagger(60, { start: 120 }))
    .label('pulse', 450)
    .add(core, {
      pulse: [0.6, 1.45],
      ringRadius: [48, 175],
      orbitAngle: [0, 360],
      waveAmp: [12, 68],
      duration: 1200,
      ease: createSpring({ bounce: 0.45, duration: 950 }),
    }, 300)
    .add('.card-b', {
      scale: [0.92, 1.04],
      borderColor: '#18FF74',
      duration: 700,
      ease: 'inOutExpo',
    }, 450)
    .label('settle', 1300)
    .call(() => {
      phaseEl.textContent = `Phase: Peak (${Math.round(tl.currentTime)}ms)`;
    }, 900)
    .add('.card-c', {
      y: [12, 0],
      borderColor: '#F6FF56',
      duration: 500,
      ease: 'out(2)',
    }, 900);

  activeTl = tl;
  studio.select(Array.from(studio.store.entries.keys()).pop());
  renderCanvas();
}

function buildSpringCascade() {
  if (activeTl) activeTl.cancel();

  const tl = createTimeline({
    id: 'Spring Cascade',
    loop: true,
    alternate: true,
    onRender: renderCanvas,
  });

  tl.label('drop', 0)
    .add(nodes, {
      y: (_, i) => [120 + Math.floor(i / cols) * 100 - 40, 120 + Math.floor(i / cols) * 100 + 35],
      scale: [0.5, 1.5],
      rot: [-45, 45],
      duration: 900,
      ease: createSpring({ bounce: 0.65, duration: 850 }),
    }, stagger(35, { from: 'first' }))
    .add(core, {
      pulse: [0.4, 1.8],
      orbitAngle: [0, -270],
      waveAmp: [5, 95],
      duration: 1100,
      ease: 'inOutBack(1.8)',
    }, 150)
    .label('rebound', 700)
    .add('.hud-card', {
      x: [-10, 0],
      duration: 500,
      ease: 'out(3)',
    }, stagger(80, { start: 100 }));

  activeTl = tl;
  studio.select(Array.from(studio.store.entries.keys()).pop());
  renderCanvas();
}

document.getElementById('btn-scene-orbital').addEventListener('click', buildOrbitalScene);
document.getElementById('btn-scene-burst').addEventListener('click', buildSpringCascade);

document.getElementById('btn-quick-webm').addEventListener('click', async () => {
  if (!activeTl) return;
  statusEl.textContent = 'Rendering WebM...';
  const wasPlaying = !activeTl.paused;
  const session = createRenderSession({
    target: activeTl,
    fps: 60,
    width: canvas.width,
    height: canvas.height,
    canvas,
    draw: renderCanvas,
  });
  try {
    const res = await session.exportWebM({
      onProgress: p => { statusEl.textContent = `Encoding WebM: ${Math.round(p * 100)}%`; },
    });
    statusEl.textContent = `Done! ${res.frames} frames (${(res.blob.size / 1024).toFixed(0)} KB)`;
    const a = document.createElement('a');
    a.href = res.url;
    a.download = 'animejs-workbench.webm';
    a.click();
  } catch (err) {
    statusEl.textContent = `Export error: ${err.message}`;
  } finally {
    session.dispose();
    if (wasPlaying) activeTl.play();
  }
});

buildOrbitalScene();
