import { CANVAS, GRID_STYLE, ANIM, COLOR_FILTER, STABILITY } from './config.js';

const ANALYSIS_W = 320;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function clamp01(v) {
  return clamp(v, 0, 1);
}

function rgbStr(r, g, b) {
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) * 0.5;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;

  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return [h * 360, s, l];
}

function hueMatches(h, band) {
  if (band.wrap) return h >= band.min || h <= band.max;
  return h >= band.min && h <= band.max;
}

function isAllowedColor(h, s) {
  if (s < COLOR_FILTER.minSaturation) return false;
  return COLOR_FILTER.hues.some((band) => hueMatches(h, band));
}

function colorStrength(h, s) {
  if (!COLOR_FILTER.enabled) return 0;
  if (s < COLOR_FILTER.minSaturation * 0.55) return 0;
  if (!COLOR_FILTER.hues.some((band) => hueMatches(h, band))) return 0;
  return clamp01((s - COLOR_FILTER.minSaturation * 0.55) / (1 - COLOR_FILTER.minSaturation * 0.55));
}

function filterPixel(r, g, b) {
  if (!COLOR_FILTER.enabled) return [r, g, b];

  const [h, s] = rgbToHsl(r, g, b);
  if (isAllowedColor(h, s)) return [r, g, b];

  const grey = lum(r, g, b);
  return [grey, grey, grey];
}

function applyColorFilter(imageData) {
  if (!COLOR_FILTER.enabled) return imageData;

  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = filterPixel(d[i], d[i + 1], d[i + 2]);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }

  return imageData;
}

function sampleRingColor(data, fw, fh, acx, acy, dist) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;

  for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
    const px = clamp(Math.round(acx + Math.cos(a) * dist), 0, fw - 1);
    const py = clamp(Math.round(acy + Math.sin(a) * dist), 0, fh - 1);
    const i = (py * fw + px) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }

  return [r / n, g / n, b / n];
}

function sampleCell(data, fw, fh, cell, layoutW, layoutH) {
  const { cellW, cellH, seed } = cell;
  const sx = fw / layoutW;
  const sy = fh / layoutH;
  const x0 = clamp(Math.floor(cell.sampleX * sx), 0, fw - 1);
  const y0 = clamp(Math.floor((cell.cy - cellH / 2) * sy), 0, fh - 1);
  const x1 = clamp(Math.ceil((cell.sampleX + cell.sampleW) * sx), 0, fw);
  const y1 = clamp(Math.ceil((cell.cy + cellH / 2) * sy), 0, fh);
  const acx = cell.cx * sx;
  const acy = cell.cy * sy;
  const cellMin = Math.min(cellW, cellH);
  const analysisR = Math.min(cellW * sx, cellH * sy) * 0.48;

  let avgR = 0;
  let avgG = 0;
  let avgB = 0;
  let n = 0;
  const step = x1 - x0 > 20 || y1 - y0 > 20 ? 2 : 1;
  for (let py = y0; py < y1; py += step) {
    for (let px = x0; px < x1; px += step) {
      const i = (py * fw + px) * 4;
      avgR += data[i];
      avgG += data[i + 1];
      avgB += data[i + 2];
      n++;
    }
  }
  if (!n) return null;

  const [hue, sat] = rgbToHsl(avgR / n, avgG / n, avgB / n);
  const strength = colorStrength(hue, sat);
  const smallR = cellMin * GRID_STYLE.dotMinRatio;
  const largeR = cellMin * lerp(
    GRID_STYLE.colorDotMinRatio,
    GRID_STYLE.colorDotMaxRatio,
    Math.pow(strength, GRID_STYLE.sizeGamma)
  );
  const targetMaxR = lerp(smallR, largeR, strength);

  const ringCount = 3 + (seed % 4);
  const colors = [];

  for (let i = 0; i < ringCount; i++) {
    const t = (i + 0.5) / ringCount;
    const dist = analysisR * (1 - t * 0.92);
    colors.push(sampleRingColor(data, fw, fh, acx, acy, dist));
  }

  return { colors, maxR: targetMaxR, ringCount, seed, strength };
}

function drawDot(ctx, cx, cy, sample) {
  const { colors, maxR, ringCount } = sample;
  if (maxR < 1) return;

  ctx.save();
  ctx.imageSmoothingEnabled = true;

  for (let i = 0; i < ringCount; i++) {
    const r = maxR * ((ringCount - i) / ringCount);
    const [cr, cg, cb] = colors[i];
    ctx.fillStyle = rgbStr(cr, cg, cb);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

let analysisCanvas = null;
let analysisCtx = null;
let cellState = new Map();
let cellStateKey = '';
let lastFrameTime = 0;

function resetCellState(layout) {
  const key = `${layout.cols}x${layout.rows}`;
  if (key !== cellStateKey) {
    cellState = new Map();
    cellStateKey = key;
  }
}

function smoothSample(raw, dt) {
  const alpha = 1 - Math.exp(-STABILITY.smoothRate * dt);
  let state = cellState.get(raw.seed);

  if (!state) {
    state = {
      maxR: raw.maxR,
      ringCount: raw.ringCount,
      colors: raw.colors.map((c) => [...c]),
    };
    cellState.set(raw.seed, state);
    return state;
  }

  state.ringCount = raw.ringCount;
  state.maxR = lerp(state.maxR, raw.maxR, alpha);
  for (let i = 0; i < raw.colors.length; i++) {
    if (!state.colors[i]) state.colors[i] = [...raw.colors[i]];
    for (let c = 0; c < 3; c++) {
      state.colors[i][c] = lerp(state.colors[i][c], raw.colors[i][c], alpha);
    }
  }

  return state;
}

function getAnalysisBuffer(sourceCanvas) {
  const scale = ANALYSIS_W / sourceCanvas.width;
  const ah = Math.max(1, Math.round(sourceCanvas.height * scale));

  if (!analysisCanvas) {
    analysisCanvas = document.createElement('canvas');
    analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });
    analysisCtx.imageSmoothingEnabled = false;
  }

  if (analysisCanvas.width !== ANALYSIS_W || analysisCanvas.height !== ah) {
    analysisCanvas.width = ANALYSIS_W;
    analysisCanvas.height = ah;
  }

  analysisCtx.drawImage(sourceCanvas, 0, 0, ANALYSIS_W, ah);
  const imageData = analysisCtx.getImageData(0, 0, ANALYSIS_W, ah);
  return applyColorFilter(imageData);
}

export function drawOrbGrid(ctx, frame, layout, width, height, time = 0) {
  const dt = lastFrameTime ? Math.min(0.1, (time - lastFrameTime) / 1000) : 0.016;
  lastFrameTime = time;

  resetCellState(layout);
  const { data, width: fw, height: fh } = getAnalysisBuffer(frame);
  const cellH = height / layout.rows;
  const offset = ((time / 1000) * ANIM.scrollSpeed) % cellH;

  ctx.fillStyle = CANVAS.bg;
  ctx.fillRect(0, 0, width, height);

  const draws = [];

  for (const cell of layout.cells) {
    const raw = sampleCell(data, fw, fh, cell, width, height);
    if (!raw) continue;

    const sample = smoothSample(raw, dt);
    const cy = cell.cy - offset;
    const positions = [cy];
    if (cy < cell.cellH * 0.5) positions.push(cy + height);
    if (cy > height - cell.cellH * 0.5) positions.push(cy - height);

    for (const drawCy of positions) {
      draws.push({ cx: cell.cx, cy: drawCy, sample });
    }
  }

  draws.sort((a, b) => a.sample.maxR - b.sample.maxR);

  for (const { cx, cy, sample } of draws) {
    drawDot(ctx, cx, cy, sample);
  }
}
