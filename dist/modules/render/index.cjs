/**
 * Anime.js - render - CJS
 * @version v4.5.0
 * @license MIT
 * @copyright 2026 - Julian Garnier
 */

'use strict';

var session = require('./session.cjs');
var webm = require('./webm.cjs');
var dom = require('./dom.cjs');



exports.RenderSession = session.RenderSession;
exports.createRenderSession = session.createRenderSession;
exports.mapWebMCodecId = webm.mapWebMCodecId;
exports.muxWebMFrames = webm.muxWebMFrames;
exports.canvasToBlob = dom.canvasToBlob;
exports.captureTargetFrame = dom.captureTargetFrame;
