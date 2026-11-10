/**
 * Anime.js - render - CJS
 * @version v4.5.0
 * @license MIT
 * @copyright 2026 - Julian Garnier
 */

'use strict';

/**
 * Zero-dependency pure-JS WebM (EBML/Matroska) video muxer for WebCodecs EncodedVideoChunk frames.
 */

const textEncoder = /*#__PURE__*/ (() => typeof TextEncoder !== 'undefined' ? new TextEncoder() : null)();

/**
 * @param  {String} str
 * @return {Uint8Array}
 */
const encodeAscii = str => {
  if (textEncoder) return textEncoder.encode(str);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
};

/**
 * Encodes an EBML variable-length unsigned integer (VINT) for element data sizes.
 * Supports sizes up to ~268 MB per element (4-byte VINT).
 *
 * @param  {Number} size
 * @return {Uint8Array}
 */
const encodeVintSize = size => {
  if (size < 0x7f) {
    return new Uint8Array([0x80 | size]);
  }
  if (size < 0x3fff) {
    return new Uint8Array([
      0x40 | ((size >> 8) & 0x3f),
      size & 0xff,
    ]);
  }
  if (size < 0x1fffff) {
    return new Uint8Array([
      0x20 | ((size >> 16) & 0x1f),
      (size >> 8) & 0xff,
      size & 0xff,
    ]);
  }
  return new Uint8Array([
    0x10 | ((size >>> 24) & 0x0f),
    (size >> 16) & 0xff,
    (size >> 8) & 0xff,
    size & 0xff,
  ]);
};

/**
 * Encodes a non-negative integer in big-endian minimal bytes (1..4 bytes).
 *
 * @param  {Number} val
 * @return {Uint8Array}
 */
const encodeUint = val => {
  const n = Math.max(0, Math.floor(val));
  if (n <= 0xff) return new Uint8Array([n]);
  if (n <= 0xffff) return new Uint8Array([(n >> 8) & 0xff, n & 0xff]);
  if (n <= 0xffffff) return new Uint8Array([(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
  return new Uint8Array([
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ]);
};

/**
 * Encodes an IEEE-754 float64 big-endian buffer (8 bytes).
 *
 * @param  {Number} val
 * @return {Uint8Array}
 */
const encodeFloat64 = val => {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, val, false);
  return new Uint8Array(buf);
};

/**
 * Concatenates multiple Uint8Arrays into one contiguous buffer.
 *
 * @param  {Array<Uint8Array>} parts
 * @return {Uint8Array}
 */
const concatBytes = parts => {
  let total = 0;
  for (let i = 0; i < parts.length; i++) total += parts[i].byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (let i = 0; i < parts.length; i++) {
    out.set(parts[i], offset);
    offset += parts[i].byteLength;
  }
  return out;
};

/**
 * Wraps raw payload bytes inside an EBML element `[idBytes][vintSize][payload]`.
 *
 * @param  {Array<Number>} idBytes
 * @param  {Uint8Array|Array<Uint8Array>} payload
 * @return {Uint8Array}
 */
const ebmlElement = (idBytes, payload) => {
  const body = Array.isArray(payload) ? concatBytes(payload) : payload;
  return concatBytes([
    new Uint8Array(idBytes),
    encodeVintSize(body.byteLength),
    body,
  ]);
};

/**
 * Maps WebCodecs codec identifiers to Matroska CodecID strings.
 *
 * @param  {String} codec
 * @return {String}
 */
const mapWebMCodecId = codec => {
  const c = (codec || '').toLowerCase();
  if (c.startsWith('vp09') || c === 'vp9') return 'V_VP9';
  if (c.startsWith('av01') || c === 'av1') return 'V_AV1';
  return 'V_VP8';
};

/**
 * @typedef {Object} WebMFrameChunk
 * @property {Uint8Array} data - Raw encoded video frame payload
 * @property {Number} timestampMs - Frame presentation timestamp in milliseconds
 * @property {Boolean} [isKey=false] - Whether this chunk is a keyframe
 */

/**
 * @typedef {Object} MuxWebMOptions
 * @property {Number} width
 * @property {Number} height
 * @property {Number} [fps=60]
 * @property {String} [codec='vp8']
 * @property {Number} [durationMs]
 * @property {Array<WebMFrameChunk>} chunks
 */

/**
 * Muxes encoded VP8 / VP9 / AV1 video chunks into a seekable `.webm` binary container.
 *
 * @param  {MuxWebMOptions} options
 * @return {Uint8Array}
 */
const muxWebMFrames = options => {
  const {
    width,
    height,
    fps = 60,
    codec = 'vp8',
    chunks = [],
  } = options;

  const codecId = mapWebMCodecId(codec);
  const frameDurationMs = 1000 / fps;
  const lastTimestampMs = chunks.length
    ? chunks[chunks.length - 1].timestampMs + frameDurationMs
    : 0;
  const durationMs = options.durationMs !== undefined ? options.durationMs : lastTimestampMs;

  // EBML Header (0x1A45DFA3)
  const ebmlHeader = ebmlElement([0x1a, 0x45, 0xdf, 0xa3], [
    ebmlElement([0x42, 0x86], encodeUint(1)),             // EBMLVersion
    ebmlElement([0x42, 0xf7], encodeUint(1)),             // EBMLReadVersion
    ebmlElement([0x42, 0xf2], encodeUint(4)),             // EBMLMaxIDLength
    ebmlElement([0x42, 0xf3], encodeUint(8)),             // EBMLMaxSizeLength
    ebmlElement([0x42, 0x82], encodeAscii('webm')),       // DocType
    ebmlElement([0x42, 0x87], encodeUint(2)),             // DocTypeVersion
    ebmlElement([0x42, 0x85], encodeUint(2)),             // DocTypeReadVersion
  ]);

  // Segment -> Info (0x1549A966)
  const info = ebmlElement([0x15, 0x49, 0xa9, 0x66], [
    ebmlElement([0x2a, 0xd7, 0xb1], encodeUint(1000000)), // TimecodeScale (1ms)
    ebmlElement([0x4d, 0x80], encodeAscii('animejs-render')),
    ebmlElement([0x57, 0x41], encodeAscii('animejs-render')),
    ebmlElement([0x44, 0x89], encodeFloat64(durationMs)),
  ]);

  // Segment -> Tracks (0x1654AE6B)
  const defaultDurationNs = Math.round(1e9 / fps);
  const tracks = ebmlElement([0x16, 0x54, 0xae, 0x6b], [
    ebmlElement([0xae], [
      ebmlElement([0xd7], encodeUint(1)),                 // TrackNumber
      ebmlElement([0x73, 0xc5], encodeUint(1)),           // TrackUID
      ebmlElement([0x83], encodeUint(1)),                 // TrackType (1 = video)
      ebmlElement([0x86], encodeAscii(codecId)),          // CodecID
      ebmlElement([0x23, 0xe3, 0x83], encodeUint(defaultDurationNs)),
      ebmlElement([0xe0], [
        ebmlElement([0xb0], encodeUint(width)),           // PixelWidth
        ebmlElement([0xba], encodeUint(height)),          // PixelHeight
      ]),
    ]),
  ]);

  // Group chunks into Clusters (SimpleBlock uses signed 16-bit relative timecodes in ms)
  /** @type {Array<Uint8Array>} */
  const clusters = [];
  let clusterTimeMs = 0;
  /** @type {Array<Uint8Array>} */
  let clusterBlocks = [];

  const flushCluster = () => {
    if (!clusterBlocks.length) return;
    clusters.push(ebmlElement([0x1f, 0x43, 0xb6, 0x75], [
      ebmlElement([0xe7], encodeUint(clusterTimeMs)),
      ...clusterBlocks,
    ]));
    clusterBlocks = [];
  };

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const ts = Math.max(0, Math.round(chunk.timestampMs));
    const rel = ts - clusterTimeMs;
    const shouldSplit =
      clusterBlocks.length === 0 ||
      rel < 0 ||
      rel > 30000 ||
      (chunk.isKey && rel >= 5000);

    if (shouldSplit) {
      flushCluster();
      clusterTimeMs = ts;
    }

    const relTime = ts - clusterTimeMs;
    const header = new Uint8Array(4);
    header[0] = 0x81; // Track 1 VINT
    header[1] = (relTime >> 8) & 0xff;
    header[2] = relTime & 0xff;
    header[3] = chunk.isKey ? 0x80 : 0x00;

    clusterBlocks.push(ebmlElement([0xa3], [header, chunk.data]));
  }
  flushCluster();

  const segment = ebmlElement([0x18, 0x53, 0x80, 0x67], [
    info,
    tracks,
    ...clusters,
  ]);

  return concatBytes([ebmlHeader, segment]);
};

exports.mapWebMCodecId = mapWebMCodecId;
exports.muxWebMFrames = muxWebMFrames;
