import { buildGridLayout, GRID_COLS, GRID_ROWS } from './analyze.js';
import { drawOrbGrid } from './render.js';

const viewEl = document.getElementById('view');
const video = document.getElementById('cam');
const canvas = document.getElementById('out');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const fileInput = document.getElementById('file');
const saveBtn = document.getElementById('saveBtn');
const flipBtn = document.getElementById('flipBtn');
const statusEl = document.getElementById('status');

const frame = document.createElement('canvas');
const frameCtx = frame.getContext('2d', { willReadFrequently: true });

let animId = 0;
let stream = null;
let uploadedImage = null;
let useCamera = true;
let facingMode = 'environment';
let W = 0;
let H = 0;
let layout = null;

ctx.imageSmoothingEnabled = false;
frameCtx.imageSmoothingEnabled = false;

let statusTimer;
function setStatus(msg, isErr = false) {
  clearTimeout(statusTimer);
  statusEl.textContent = msg;
  statusEl.className = `status show${isErr ? ' err' : ''}`;
  statusTimer = setTimeout(() => {
    statusEl.className = 'status';
  }, isErr ? 5000 : 2500);
}

function getRenderSize() {
  if (!viewEl) return { w: 360, h: 640 };
  const rect = viewEl.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return {
    w: Math.max(280, Math.round(rect.width * dpr)),
    h: Math.max(400, Math.round(rect.height * dpr)),
  };
}

function setSize(w, h) {
  W = w;
  H = h;
  canvas.width = W;
  canvas.height = H;
  frame.width = W;
  frame.height = H;
  layout = buildGridLayout(W, H, GRID_COLS, GRID_ROWS);
}

function isMobileView() {
  return window.matchMedia('(max-width: 639px)').matches;
}

function syncCanvasToViewport() {
  const { w, h } = getRenderSize();
  if (w !== W || h !== H) setSize(w, h);
}

function getActiveFacingMode() {
  return stream?.getVideoTracks()?.[0]?.getSettings?.()?.facingMode || facingMode;
}

function drawCameraToFrame(vw, vh) {
  const scale = Math.max(W / vw, H / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;

  frameCtx.save();
  if (getActiveFacingMode() === 'user') {
    frameCtx.translate(dx + dw, dy);
    frameCtx.scale(-1, 1);
    frameCtx.drawImage(video, 0, 0, dw, dh);
  } else {
    frameCtx.drawImage(video, dx, dy, dw, dh);
  }
  frameCtx.restore();
}

function drawSourceToFrame() {
  frameCtx.fillStyle = '#e4e4e4';
  frameCtx.fillRect(0, 0, W, H);

  if (useCamera) {
    if (video.readyState < 2) return false;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return false;
    drawCameraToFrame(vw, vh);
    return true;
  }

  if (!uploadedImage) return false;
  const iw = uploadedImage.naturalWidth;
  const ih = uploadedImage.naturalHeight;
  const scale = Math.min(W / iw, H / ih, 1);
  const dw = iw * scale;
  const dh = ih * scale;
  frameCtx.drawImage(uploadedImage, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return true;
}

function render() {
  if (!drawSourceToFrame()) {
    animId = requestAnimationFrame(render);
    return;
  }

  if (!layout) layout = buildGridLayout(W, H, GRID_COLS, GRID_ROWS);
  drawOrbGrid(ctx, frame, layout, W, H, performance.now());

  animId = requestAnimationFrame(render);
}

function stopRender() {
  if (animId) cancelAnimationFrame(animId);
  animId = 0;
}

function startRender() {
  stopRender();
  animId = requestAnimationFrame(render);
}

async function getCameraStream() {
  const attempts = [{ facingMode: { ideal: facingMode } }, { facingMode }, true];
  for (const facing of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { ...facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch {
      /* next */
    }
  }
  throw new Error('Camera needs HTTPS or localhost');
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera needs HTTPS or localhost');
  }
  if (stream) stream.getTracks().forEach((t) => t.stop());

  stream = await getCameraStream();
  video.srcObject = stream;
  await video.play();

  const actualFacing = stream.getVideoTracks()[0]?.getSettings?.()?.facingMode;
  if (actualFacing) facingMode = actualFacing;

  useCamera = true;
  uploadedImage = null;
  syncCanvasToViewport();
  startRender();
  setStatus('Live camera');
}

function useUploadedImage(img) {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  uploadedImage = img;
  useCamera = false;
  syncCanvasToViewport();
  startRender();
  setStatus('From image');
}

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    useUploadedImage(img);
    URL.revokeObjectURL(url);
  };
  img.src = url;
  e.target.value = '';
});

function saveImage() {
  const a = document.createElement('a');
  a.download = `camera-view-exp-${Date.now()}.png`;
  a.href = canvas.toDataURL('image/png');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setStatus('Saved');
}

saveBtn.addEventListener('click', saveImage);

flipBtn.addEventListener('click', () => {
  if (!isMobileView()) return;
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  startCamera().catch((err) => setStatus(err.message, true));
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(syncCanvasToViewport, 150);
});
window.addEventListener('orientationchange', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(syncCanvasToViewport, 150);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopRender();
  else if (useCamera && stream) startRender();
  else if (uploadedImage) startRender();
});

syncCanvasToViewport();
startCamera().catch(() => {
  useCamera = false;
  setStatus('Allow camera or tap Upload', true);
});
