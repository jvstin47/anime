import { expect } from 'chai';
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
import {
  createStudio,
} from '../../dist/modules/studio/index.js';

suite('Render & Studio (Node)', () => {

  test('Virtual clock steps deterministically with zero 12ms RAF offset', () => {
    const obj = { x: 0 };
    engine.useVirtualClock(0);
    const anim = animate(obj, { x: 1000, duration: 1000, ease: 'linear' });

    expect(obj.x).to.equal(0);
    engine.step(250);
    expect(anim.currentTime).to.equal(250);
    expect(obj.x).to.equal(250);

    engine.step(750);
    expect(anim.currentTime).to.equal(1000);
    expect(obj.x).to.equal(1000);
    expect(anim.completed).to.equal(true);

    anim.cancel();
    engine.step(10);
    engine.useRealClock();
  });

  test('Seeded random & RenderSession backward replay are deterministic', () => {
    let snapshot = 0;
    const session = createRenderSession({
      fps: 25,
      duration: 400,
      seed: 2026,
      setup: () => {
        const state = { v: 0 };
        const a = animate(state, { v: 100, duration: 400, ease: 'linear' });
        return {
          teardown: () => a.cancel(),
          draw: () => { snapshot = state.v; },
        };
      },
    });

    expect(session.totalFrames).to.equal(10);
    session.seekFrame(5); // 200ms -> 50
    expect(snapshot).to.equal(50);

    session.seekFrame(8); // 320ms -> 80
    expect(snapshot).to.equal(80);

    session.seekFrame(2); // 80ms -> 20
    expect(snapshot).to.equal(20);

    session.dispose();
  });

  test('muxWebMFrames emits valid EBML WebM binary with clusters', () => {
    const bytes = muxWebMFrames({
      width: 640,
      height: 360,
      fps: 60,
      codec: 'vp9',
      durationMs: 50,
      chunks: [
        { data: new Uint8Array([0xaa, 0xbb, 0xcc]), timestampMs: 0, isKey: true },
        { data: new Uint8Array([0xdd, 0xee]), timestampMs: 16.67, isKey: false },
      ],
    });
    expect(bytes[0]).to.equal(0x1a);
    expect(bytes[1]).to.equal(0x45);
    expect(bytes[2]).to.equal(0xdf);
    expect(bytes[3]).to.equal(0xa3);
    const str = Buffer.from(bytes).toString('latin1');
    expect(str).to.include('webm');
    expect(str).to.include('V_VP9');
  });

  test('Headless Studio captures timelines, edits curves/offsets, and exports code', () => {
    const studio = createStudio({ mount: false, fps: 60 });
    const obj = { x: 0, y: 0 };
    const tl = createTimeline({ autoplay: false })
      .label('start', 0)
      .add(obj, { x: 100, duration: 400, ease: 'linear' }, 0)
      .add(obj, { y: 200, duration: 400, ease: 'out(3)' }, 100);

    const entry = studio.store.getSelectedEntry();
    expect(entry).to.exist;
    studio.store.refreshEntry(entry);
    expect(entry.groups).to.have.length(2);

    studio.store.updateGroupOffset(entry.id, entry.groups[1].uid, 200);
    expect(tl.duration).to.equal(600);
    expect(studio.undo()).to.equal(true);
    expect(tl.duration).to.equal(500);
    expect(studio.redo()).to.equal(true);
    expect(tl.duration).to.equal(600);

    studio.store.updateTweenValues(entry.id, [entry.groups[0].uid], 'x', { from: 0, to: 150 });
    studio.store.updateEasing(entry.id, entry.groups[0].uid, null, {
      kind: 'bezier',
      bezier: [0.25, 0.8, 0.25, 1],
    }, true);

    studio.seek(200);
    expect(obj.x).to.be.above(75);

    const code = studio.exportCode();
    expect(code).to.include('cubicBezier(0.25, 0.8, 0.25, 1)');
    expect(code).to.include('createTimeline');

    tl.cancel();
    studio.dispose();
  });

});
