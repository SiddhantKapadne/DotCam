import { CANVAS, GRID_STYLE, ANIM } from './config.js';

const ANALYSIS_W = 320;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
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

function sampleCell(data, fw, fh, cell, layoutW, layoutH, drawCy) {
  const { cellW, cellH, seed } = cell;
  const cy = drawCy ?? cell.cy;
  const sx = fw / layoutW;
  const sy = fh / layoutH;
  const x0 = clamp(Math.floor(cell.sampleX * sx), 0, fw - 1);
  const y0 = clamp(Math.floor((cy - cellH / 2) * sy), 0, fh - 1);
  const x1 = clamp(Math.ceil((cell.sampleX + cell.sampleW) * sx), 0, fw);
  const y1 = clamp(Math.ceil((cy + cellH / 2) * sy), 0, fh);
  const acx = cell.cx * sx;
  const acy = cy * sy;
  const cellMin = Math.min(cellW, cellH);
  const analysisR = Math.min(cellW * sx, cellH * sy) * 0.48;

  let avgL = 0;
  let n = 0;
  const step = x1 - x0 > 20 || y1 - y0 > 20 ? 2 : 1;
  for (let py = y0; py < y1; py += step) {
    for (let px = x0; px < x1; px += step) {
      const i = (py * fw + px) * 4;
      avgL += lum(data[i], data[i + 1], data[i + 2]);
      n++;
    }
  }
  if (!n) return null;

  const brightness = avgL / n / 255;
  const darkness = 1 - brightness;
  const maxR = cellMin * lerp(
    GRID_STYLE.dotMinRatio,
    GRID_STYLE.dotMaxRatio,
    Math.pow(darkness, GRID_STYLE.sizeGamma)
  );

  const ringCount = 3 + (seed % 4);
  const colors = [];

  for (let i = 0; i < ringCount; i++) {
    const t = (i + 0.5) / ringCount;
    const dist = analysisR * (1 - t * 0.92);
    colors.push(sampleRingColor(data, fw, fh, acx, acy, dist));
  }

  return { colors, maxR, ringCount, seed };
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
  return analysisCtx.getImageData(0, 0, ANALYSIS_W, ah);
}

export function drawOrbGrid(ctx, frame, layout, width, height, time = 0) {
  const { data, width: fw, height: fh } = getAnalysisBuffer(frame);
  const cellH = height / layout.rows;
  const offset = ((time / 1000) * ANIM.scrollSpeed) % cellH;

  ctx.fillStyle = CANVAS.bg;
  ctx.fillRect(0, 0, width, height);

  for (const cell of layout.cells) {
    const cy = cell.cy - offset;
    const positions = [cy];
    if (cy < cell.cellH * 0.5) positions.push(cy + height);
    if (cy > height - cell.cellH * 0.5) positions.push(cy - height);

    for (const drawCy of positions) {
      const sample = sampleCell(data, fw, fh, cell, width, height, drawCy);
      if (!sample) continue;
      drawDot(ctx, cell.cx, drawCy, sample);
    }
  }
}
