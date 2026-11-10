import { expect } from '../utils.js';
import {
  animate,
  createTimeline,
  createSpring,
  cubicBezier,
  engine,
  globals,
  stagger,
  utils,
} from '../../dist/modules/index.js';
import {
  createStudio,
  showStudio,
  hideStudio,
  getStudio,
} from '../../dist/modules/studio/index.js';

suite('Studio', () => {

  teardown(() => {
    hideStudio();
  });

  test('createStudio captures animations, timelines, labels, calls, and staggered children via globals.editor', () => {
    const studio = createStudio({ mount: false });
    expect(globals.editor).to.equal(studio.store.editorGlobals);

    const obj = { x: 0, y: 0 };
    const items = [{ a: 0 }, { a: 0 }, { a: 0 }];
    let called = false;

    const tl = createTimeline({ autoplay: false, id: 'hero-tl' })
      .label('intro', 0)
      .add(obj, { x: 200, duration: 400, ease: 'inOutExpo' }, 0)
      .add(items, { a: 100, duration: 300 }, stagger(50, { start: 100 }))
      .call(() => { called = true; }, 500);

    const standalone = animate(obj, { y: 50, duration: 250, ease: cubicBezier(0.22, 1, 0.36, 1), autoplay: false });

    const entries = Array.from(studio.store.entries.values());
    expect(entries).to.have.length(2);

    const tlEntry = entries[0];
    studio.store.refreshEntry(tlEntry);
    expect(tlEntry.kind).to.equal('timeline');
    expect(tlEntry.labels).to.have.length(1);
    expect(tlEntry.labels[0].name).to.equal('intro');
    expect(tlEntry.calls).to.have.length(1);
    expect(tlEntry.groups).to.have.length(4); // 1 obj + 3 staggered items
    expect(tlEntry.groups[1].offset).to.equal(100);
    expect(tlEntry.groups[2].offset).to.equal(150);
    expect(tlEntry.groups[3].offset).to.equal(200);

    const animEntry = entries[1];
    expect(animEntry.groups[0].easing.kind).to.equal('bezier');

    tl.seek(500);
    expect(called).to.equal(true);

    tl.cancel();
    standalone.cancel();
    studio.dispose();
    expect(globals.editor).to.equal(null);
  });

  test('Studio live-edits group offset, duration, and cubicBezier / spring easings and exports code', () => {
    const studio = createStudio({ mount: false, fps: 50 });
    const target = { x: 0 };

    const tl = createTimeline({ autoplay: false })
      .add(target, { x: 100, duration: 500, ease: 'linear' }, 0);

    const entry = studio.store.getSelectedEntry();
    expect(entry).to.exist;
    const group = entry.groups[0];

    // Shift offset to 200ms & test Undo/Redo
    studio.store.updateGroupOffset(entry.id, group.uid, 200);
    expect(entry.instance.duration).to.equal(700);
    expect(studio.undo()).to.equal(true);
    expect(entry.instance.duration).to.equal(500);
    expect(studio.redo()).to.equal(true);
    expect(entry.instance.duration).to.equal(700);

    // Edit scalar property values live
    studio.store.updateTweenValues(entry.id, [group.uid], 'x', { from: 0, to: 200 });
    // Seek to 450ms -> half-way through [200..700]
    studio.seek(450);
    expect(target.x).to.be.closeTo(100, 0.5);

    // Lock prevents offset mutations
    const layer = entry.layers[0];
    studio.store.toggleLayerLock(entry.id, layer.id);
    studio.store.updateGroupOffset(entry.id, group.uid, 300);
    expect(entry.instance.duration).to.equal(700);
    studio.store.toggleLayerLock(entry.id, layer.id);

    // Step 1 frame at 50fps (+20ms -> 470ms)
    studio.stepFrame(1);
    expect(entry.instance.currentTime).to.be.closeTo(470, 0.1);

    // Live-apply cubicBezier
    studio.store.updateEasing(entry.id, group.uid, null, {
      kind: 'bezier',
      bezier: [0.1, 0.9, 0.2, 1],
    }, true);
    expect(target.x).to.be.above(100);

    // Live-apply spring
    studio.store.updateEasing(entry.id, group.uid, null, {
      kind: 'spring',
      spring: { bounce: 0.5, duration: 600 },
    }, true);

    const code = studio.exportCode();
    expect(code).to.include('createTimeline');
    expect(code).to.include('createSpring');

    const json = /** @type {any} */(studio.exportJSON());
    expect(json.tracks).to.have.length(1);
    expect(json.tracks[0].offset).to.equal(200);

    tl.cancel();
    studio.dispose();
  });

  test('showStudio mounts Shadow DOM <anime-studio> UI with Layers, Inspector, Timeline, and Export Modal', () => {
    const studio = showStudio({ mount: true });
    expect(getStudio()).to.equal(studio);

    const hostEl = document.querySelector('anime-studio');
    expect(hostEl).to.exist;
    expect(hostEl.shadowRoot).to.exist;

    const anim = animate('#target-id', { x: 80, duration: 400, autoplay: false });
    studio.store.refreshAll();
    studio.element.render();

    const bars = hostEl.shadowRoot.querySelectorAll('.bar-wrap');
    expect(bars.length).to.be.above(0);

    const layerRows = hostEl.shadowRoot.querySelectorAll('.layer-row');
    expect(layerRows.length).to.be.above(0);

    // Toggle layer visibility on DOM target
    const visBtn = /** @type {HTMLElement} */(hostEl.shadowRoot.querySelector('[data-vis-layer]'));
    visBtn.click();
    expect(/** @type {HTMLElement} */(document.querySelector('#target-id')).style.visibility).to.equal('hidden');
    const visBtn2 = /** @type {HTMLElement} */(hostEl.shadowRoot.querySelector('[data-vis-layer]'));
    visBtn2.click();

    // Open Export Modal and switch to Code tab
    const exportBtn = /** @type {HTMLElement} */(hostEl.shadowRoot.querySelector('#btn-open-export'));
    exportBtn.click();
    const codeTab = /** @type {HTMLElement} */(hostEl.shadowRoot.querySelector('[data-tab="code"]'));
    codeTab.click();
    const pre = hostEl.shadowRoot.querySelector('.code-block');
    expect(pre.textContent).to.include('#target-id');

    anim.revert();
    hideStudio();
    expect(getStudio()).to.equal(null);
    expect(document.querySelector('anime-studio')).to.equal(null);
    expect(globals.editor).to.equal(null);
    expect(engine.isVirtual).to.equal(false);
  });

});
