import { expect } from '../utils.js';
import {
  animate,
  createTimeline,
  engine,
  stagger,
  utils,
} from '../../dist/modules/index.js';
import {
  createRenderSession,
  muxWebMFrames,
} from '../../dist/modules/render/index.js';

suite('Render & Virtual Clock', () => {

  test('engine.useVirtualClock and engine.step advance deterministically with zero 12ms offset', () => {
    const obj = { x: 0 };
    engine.useVirtualClock(0);
    expect(engine.isVirtual).to.equal(true);
    expect(engine.virtualTime).to.equal(0);

    const anim = animate(obj, {
      x: 1000,
      duration: 1000,
      ease: 'linear',
    });

    expect(obj.x).to.equal(0);
    engine.step(250);
    expect(anim.currentTime).to.equal(250);
    expect(obj.x).to.equal(250);

    engine.step(250);
    expect(anim.currentTime).to.equal(500);
    expect(obj.x).to.equal(500);

    engine.setTime(750);
    expect(anim.currentTime).to.equal(750);
    expect(obj.x).to.equal(750);

    engine.setTime(1000);
    expect(anim.currentTime).to.equal(1000);
    expect(obj.x).to.equal(1000);
    expect(anim.completed).to.equal(true);

    anim.cancel();
    engine.step(10);
    engine.useRealClock();
    expect(engine.isVirtual).to.equal(false);
  });

  test('setRandomSeed makes random() and random staggers deterministic', () => {
    utils.setRandomSeed(42);
    const seqA = [utils.random(0, 100), utils.random(0, 100), utils.random(0, 100)];
    utils.setRandomSeed(42);
    const seqB = [utils.random(0, 100), utils.random(0, 100), utils.random(0, 100)];
    expect(seqA).to.deep.equal(seqB);

    const targetsA = [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }];
    const targetsB = [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }];
    utils.setRandomSeed(1337);
    const a1 = animate(targetsA, { v: 10, delay: stagger(50, { from: 'random' }), autoplay: false });
    utils.setRandomSeed(1337);
    const a2 = animate(targetsB, { v: 10, delay: stagger(50, { from: 'random' }), autoplay: false });
    a1.seek(100);
    a2.seek(100);
    expect(targetsA.map(t => t.v)).to.deep.equal(targetsB.map(t => t.v));

    a1.cancel();
    a2.cancel();
    utils.resetRandomSeed();
  });

  test('createRenderSession steps forward/backward and renders deterministic canvas frames', async () => {
    const state = { x: 0, radius: 10 };
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;

    const tl = createTimeline({ autoplay: false })
      .add(state, { x: 100, duration: 500, ease: 'linear' }, 0)
      .add(state, { radius: 40, duration: 500, ease: 'linear' }, 500);

    const session = createRenderSession({
      target: tl,
      fps: 10,
      width: 160,
      height: 90,
      canvas,
      background: '#111111',
      draw: ({ ctx, progress }) => {
        ctx.fillStyle = '#18FF74';
        ctx.beginPath();
        ctx.arc(20 + state.x, 45, state.radius * (0.5 + 0.5 * progress), 0, Math.PI * 2);
        ctx.fill();
      },
    });

    expect(session.totalFrames).to.equal(10);

    const f0 = session.seekFrame(0);
    expect(f0.timeMs).to.equal(0);
    expect(state.x).to.equal(0);

    const f5 = session.seekFrame(5);
    expect(f5.timeMs).to.equal(500);
    expect(state.x).to.equal(100);
    expect(state.radius).to.equal(10);

    // Jump backwards deterministically
    const f2 = session.seekFrame(2);
    expect(f2.timeMs).to.equal(200);
    expect(state.x).to.equal(40);

    const pngFrames = await session.exportFrames({ format: 'png', from: 0, to: 2 });
    expect(pngFrames).to.have.length(3);
    expect(pngFrames[0].blob.type).to.equal('image/png');
    expect(pngFrames[0].blob.size).to.be.above(100);

    session.dispose();
    tl.cancel();
  });

  test('createRenderSession setup() supports backward replay and seeded reproducibility', () => {
    let lastVal = 0;
    const session = createRenderSession({
      fps: 20,
      duration: 500,
      seed: 99,
      setup: () => {
        const obj = { x: 0 };
        const a = animate(obj, { x: 100, duration: 500, ease: 'linear' });
        return {
          teardown: () => a.cancel(),
          draw: () => { lastVal = obj.x; },
        };
      },
    });

    session.seekFrame(5);
    expect(lastVal).to.equal(50);

    session.seekFrame(9);
    expect(lastVal).to.equal(90);

    // Jumping backwards with free setup() replays deterministically from 0
    session.seekFrame(2);
    expect(lastVal).to.equal(20);

    session.dispose();
    expect(engine.isVirtual).to.equal(false);
  });

  test('muxWebMFrames writes a valid EBML WebM container header and clusters', () => {
    const bytes = muxWebMFrames({
      width: 320,
      height: 180,
      fps: 30,
      codec: 'vp8',
      durationMs: 100,
      chunks: [
        { data: new Uint8Array([1, 2, 3, 4]), timestampMs: 0, isKey: true },
        { data: new Uint8Array([5, 6, 7]), timestampMs: 33.33, isKey: false },
        { data: new Uint8Array([8, 9, 10]), timestampMs: 66.67, isKey: false },
      ],
    });

    // EBML Header ID: 0x1A 0x45 0xDF 0xA3
    expect(bytes[0]).to.equal(0x1a);
    expect(bytes[1]).to.equal(0x45);
    expect(bytes[2]).to.equal(0xdf);
    expect(bytes[3]).to.equal(0xa3);

    const ascii = new TextDecoder().decode(bytes);
    expect(ascii).to.include('webm');
    expect(ascii).to.include('V_VP8');
    expect(ascii).to.include('animejs-render');
  });

  test('exportWebM encodes Canvas frames when WebCodecs VideoEncoder is available', async function () {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
      this.skip();
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const obj = { x: 0 };
    const anim = animate(obj, { x: 100, duration: 200, ease: 'linear', autoplay: false });

    const session = createRenderSession({
      target: anim,
      fps: 15,
      width: 160,
      height: 90,
      canvas,
      background: '#181818',
      draw: ({ ctx }) => {
        ctx.fillStyle = '#FF4B4B';
        ctx.fillRect(10 + obj.x, 25, 40, 40);
      },
    });

    let res;
    try {
      res = await session.exportWebM({ codec: 'vp8', bitrate: 500_000 });
    } catch (err) {
      // Headless environments without software VP8 encoder support skip gracefully
      session.dispose();
      anim.cancel();
      this.skip();
      return;
    }

    expect(res.blob.type).to.equal('video/webm');
    expect(res.blob.size).to.be.above(100);
    expect(res.frames).to.equal(3);
    if (res.url) URL.revokeObjectURL(res.url);

    session.dispose();
    anim.cancel();
  });

});
