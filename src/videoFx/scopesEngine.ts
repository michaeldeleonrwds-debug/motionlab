/**
 * MotionLab 3.0 — Real-time Video Scopes Engine
 * High-performance telemetry extraction for RGB Histogram,
 * Luma Histogram, Waveform Monitor, and Vectorscope.
 */

import { VideoScopesData } from './types';

// Rec.709 color space conversions
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

/**
 * Extracts comprehensive broadcast video scopes telemetry from an active frame buffer.
 */
export function extractVideoScopes(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  waveformColumns: number = 160
): VideoScopesData {
  const rHist = new Uint32Array(256);
  const gHist = new Uint32Array(256);
  const bHist = new Uint32Array(256);
  const lumaHist = new Uint32Array(256);

  // Waveform: waveformColumns columns x 256 height bins
  const waveform = new Uint8Array(waveformColumns * 256);

  // Vectorscope: 128 x 128 chroma density grid (Cb x Cr)
  const vecGridSize = 128;
  const vectorscope = new Uint8Array(vecGridSize * vecGridSize);

  const colStep = width / waveformColumns;
  const totalPixels = width * height;

  // Subsample every Nth pixel for fast 60fps telemetry if resolution is large (>1080p)
  const step = totalPixels > 1920 * 1080 ? 2 : 1;

  for (let y = 0; y < height; y += step) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x += step) {
      const i = (rowOffset + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      // 1. Histograms
      rHist[r]++;
      gHist[g]++;
      bHist[b]++;

      const luma = Math.min(255, Math.max(0, Math.round(r * LUMA_R + g * LUMA_G + b * LUMA_B)));
      lumaHist[luma]++;

      // 2. Waveform
      const col = Math.min(waveformColumns - 1, Math.floor(x / colStep));
      // Invert Y so 255 is top, 0 is bottom
      const waveY = 255 - luma;
      const waveIdx = waveY * waveformColumns + col;
      if (waveform[waveIdx] < 255) {
        waveform[waveIdx] = Math.min(255, waveform[waveIdx] + 16);
      }

      // 3. Vectorscope (Cb / Cr)
      // Cb = -0.168736*R - 0.331264*G + 0.5*B + 128
      // Cr = 0.5*R - 0.418688*G - 0.081312*B + 128
      const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
      const cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

      const vecX = Math.min(vecGridSize - 1, Math.max(0, Math.floor((cb / 256) * vecGridSize)));
      const vecY = Math.min(vecGridSize - 1, Math.max(0, Math.floor((cr / 256) * vecGridSize)));
      const vecIdx = vecY * vecGridSize + vecX;
      if (vectorscope[vecIdx] < 255) {
        vectorscope[vecIdx] = Math.min(255, vectorscope[vecIdx] + 12);
      }
    }
  }

  return {
    rgbHistogram: { r: rHist, g: gHist, b: bHist },
    lumaHistogram: lumaHist,
    waveform,
    waveformWidth: waveformColumns,
    waveformHeight: 256,
    vectorscope,
  };
}

/**
 * Draws the Vectorscope onto a 2D canvas with polar circular graticule and color targets.
 */
export function drawVectorscopeCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  vectorscopeData: Uint8Array,
  gridSize: number = 128
): void {
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#09090d';
  ctx.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) * 0.88;

  // Graticule Circles & Crosshairs
  ctx.strokeStyle = '#272736';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.75, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshairs
  ctx.beginPath();
  ctx.moveTo(centerX - radius, centerY);
  ctx.lineTo(centerX + radius, centerY);
  ctx.moveTo(centerX, centerY - radius);
  ctx.lineTo(centerX, centerY + radius);
  ctx.stroke();

  // Skin Tone Line (approx. -123 degrees / +57 degrees)
  ctx.strokeStyle = '#6366f1';
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  const skinAngle = -0.98; // ~ -56 degrees
  ctx.lineTo(centerX + Math.cos(skinAngle) * radius, centerY + Math.sin(skinAngle) * radius);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Chroma Points
  const scaleX = width / gridSize;
  const scaleY = height / gridSize;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const density = vectorscopeData[y * gridSize + x];
      if (density > 0) {
        const px = x * scaleX;
        const py = y * scaleY;
        const alpha = Math.min(1.0, density / 120);
        ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.fillRect(px, py, 1.5, 1.5);
      }
    }
  }

  // Draw Primary / Secondary color target boxes (R, Mg, B, Cy, G, Yl)
  const targets = [
    { label: 'R', angle: 104, dist: 0.75, color: '#ef4444' },
    { label: 'Mg', angle: 161, dist: 0.75, color: '#ec4899' },
    { label: 'B', angle: 221, dist: 0.75, color: '#3b82f6' },
    { label: 'Cy', angle: 284, dist: 0.75, color: '#06b6d4' },
    { label: 'G', angle: 341, dist: 0.75, color: '#22c55e' },
    { label: 'Yl', angle: 41, dist: 0.75, color: '#eab308' },
  ];

  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  targets.forEach((t) => {
    const rad = (t.angle * Math.PI) / 180;
    const tx = centerX + Math.cos(rad) * radius * t.dist;
    const ty = centerY + Math.sin(rad) * radius * t.dist;

    ctx.strokeStyle = t.color;
    ctx.strokeRect(tx - 3, ty - 3, 6, 6);
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(t.label, tx, ty - 8);
  });
}
