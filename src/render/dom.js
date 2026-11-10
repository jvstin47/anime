import { isBrowser, doc } from '../core/consts.js';

/**
 * Copies computed CSS properties onto a cloned DOM subtree so it renders faithfully inside SVG `<foreignObject>`.
 *
 * @param  {Element} source
 * @param  {Element} target
 * @return {void}
 */
const inlineComputedStyles = (source, target) => {
  if (!isBrowser || typeof getComputedStyle !== 'function') return;
  const computed = getComputedStyle(source);
  const styleTarget = /** @type {HTMLElement|SVGElement} */(target);
  if (styleTarget && styleTarget.style) {
    let cssText = '';
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      cssText += `${prop}:${computed.getPropertyValue(prop)};`;
    }
    styleTarget.setAttribute('style', cssText);
  }
  const srcChildren = source.children;
  const dstChildren = target.children;
  for (let i = 0; i < srcChildren.length && i < dstChildren.length; i++) {
    inlineComputedStyles(srcChildren[i], dstChildren[i]);
  }
};

/**
 * Loads an SVG markup string into an HTMLImageElement for rasterization onto Canvas.
 *
 * @param  {String} svgMarkup
 * @return {Promise<HTMLImageElement>}
 */
const loadSvgImage = svgMarkup => new Promise((resolve, reject) => {
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    resolve(img);
  };
  img.onerror = err => {
    URL.revokeObjectURL(url);
    reject(err instanceof Error ? err : new Error('Failed to rasterize SVG/DOM frame'));
  };
  img.src = url;
});

/**
 * Captures a Canvas, SVG, or HTMLElement target into a destination 2D/OffscreenCanvas frame.
 *
 * @param  {HTMLCanvasElement|OffscreenCanvas|SVGElement|HTMLElement} source
 * @param  {HTMLCanvasElement|OffscreenCanvas} destCanvas
 * @param  {{ width: Number, height: Number, background?: String }} options
 * @return {Promise<HTMLCanvasElement|OffscreenCanvas>}
 */
export const captureTargetFrame = async (source, destCanvas, options) => {
  const { width, height, background } = options;
  const ctx = /** @type {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} */(destCanvas.getContext('2d'));
  if (!ctx) throw new Error('Unable to acquire 2D rendering context for frame capture.');

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  if (!source) return destCanvas;

  // Direct Canvas / OffscreenCanvas capture
  const isCanvasSource = (
    (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) ||
    (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas)
  );
  if (isCanvasSource) {
    if (source !== destCanvas) {
      ctx.drawImage(/** @type {CanvasImageSource} */(source), 0, 0, width, height);
    }
    return destCanvas;
  }

  if (!isBrowser || typeof XMLSerializer === 'undefined') {
    throw new Error('DOM/SVG frame rasterization requires a browser environment.');
  }

  const serializer = new XMLSerializer();

  // Direct SVGElement capture
  if (typeof SVGElement !== 'undefined' && source instanceof SVGElement) {
    const clone = /** @type {SVGElement} */(source.cloneNode(true));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    const markup = serializer.serializeToString(clone);
    const img = await loadSvgImage(markup);
    ctx.drawImage(img, 0, 0, width, height);
    return destCanvas;
  }

  // HTMLElement capture via inline-styled <foreignObject>
  const htmlSource = /** @type {HTMLElement} */(source);
  const clone = /** @type {HTMLElement} */(htmlSource.cloneNode(true));
  inlineComputedStyles(htmlSource, clone);
  clone.style.margin = '0';
  if (!clone.style.width) clone.style.width = `${width}px`;
  if (!clone.style.height) clone.style.height = `${height}px`;
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

  const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  wrapper.setAttribute('width', String(width));
  wrapper.setAttribute('height', String(height));
  wrapper.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const fo = doc.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  fo.setAttribute('width', '100%');
  fo.setAttribute('height', '100%');
  fo.appendChild(clone);
  wrapper.appendChild(fo);

  const markup = serializer.serializeToString(wrapper);
  const img = await loadSvgImage(markup);
  ctx.drawImage(img, 0, 0, width, height);
  return destCanvas;
};

/**
 * Encodes a Canvas/OffscreenCanvas to an image Blob (`png` / `webp` / `jpeg`).
 *
 * @param  {HTMLCanvasElement|OffscreenCanvas} canvas
 * @param  {'png'|'webp'|'jpeg'} [format='png']
 * @param  {Number} [quality=0.92]
 * @return {Promise<Blob>}
 */
export const canvasToBlob = (canvas, format = 'png', quality = 0.92) => {
  const mime = format === 'webp' ? 'image/webp' : format === 'jpeg' ? 'image/jpeg' : 'image/png';
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas && canvas.convertToBlob) {
    return canvas.convertToBlob({ type: mime, quality });
  }
  return new Promise((resolve, reject) => {
    /** @type {HTMLCanvasElement} */(canvas).toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error(`Failed to encode frame to ${mime}`));
    }, mime, quality);
  });
};
