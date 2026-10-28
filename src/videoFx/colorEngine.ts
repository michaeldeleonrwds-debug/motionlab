/**
 * MotionLab 3.0 — Professional Color Engine & 3D LUT Processor
 * High-performance color correction, Adobe .cube 3D LUT parser,
 * trilinear 3D interpolation, and cinematic video filters.
 */

import {
  ColorCorrectionParams,
  VignetteParams,
  FilmGrainParams,
  ChromaticAberrationParams,
  LutParams,
} from './types';

// Rec.709 coefficients for luma calculation
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

/**
 * Applies primary color correction (Exposure, Contrast, Saturation, Temp/Tint, Lift/Gamma/Gain)
 * directly in-place on RGBA pixel buffer.
 */
export function applyColorCorrection(
  pixels: Uint8ClampedArray,
  params: ColorCorrectionParams
): void {
  const {
    exposure,
    contrast,
    saturation,
    temperature,
    tint,
    highlights,
    shadows,
    lift,
    gamma,
    gain,
  } = params;

  // Exposure multiplier (EV scale: -100 to +100 -> 0.25x to 4x)
  const expMult = Math.pow(2, exposure / 50);

  // Contrast factor (standard S-curve slope)
  const contrastFactor = (100 + contrast) / 100;

  // Saturation factor
  const satFactor = (100 + saturation) / 100;

  // Temperature & Tint adjustment (RGB white-balance shifts)
  const tempShift = temperature / 200; // -0.5 to +0.5
  const tintShift = tint / 200;

  const tempR = 1 + tempShift;
  const tempB = 1 - tempShift;
  const tintG = 1 - tintShift;
  const tintR = 1 + tintShift * 0.5;
  const tintB = 1 + tintShift * 0.5;

  const len = pixels.length;

  for (let i = 0; i < len; i += 4) {
    let r = pixels[i] / 255;
    let g = pixels[i + 1] / 255;
    let b = pixels[i + 2] / 255;

    // 1. Exposure & White Balance (Temp / Tint)
    r = r * expMult * tempR * tintR;
    g = g * expMult * tintG;
    b = b * expMult * tempB * tintB;

    // 2. Lift / Gamma / Gain (Shadows / Midtones / Highlights)
    // Lift: shifts blacks
    r += lift.r * 0.2;
    g += lift.g * 0.2;
    b += lift.b * 0.2;

    // Gain: scales highlights
    r *= 1 + gain.r * 0.3;
    g *= 1 + gain.g * 0.3;
    b *= 1 + gain.b * 0.3;

    // Gamma: power curve for midtones
    if (gamma.r !== 0) r = Math.pow(Math.max(0, r), 1 / (1 + gamma.r * 0.4));
    if (gamma.g !== 0) g = Math.pow(Math.max(0, g), 1 / (1 + gamma.g * 0.4));
    if (gamma.b !== 0) b = Math.pow(Math.max(0, b), 1 / (1 + gamma.b * 0.4));

    // 3. Contrast (around 0.5 midpoint)
    r = (r - 0.5) * contrastFactor + 0.5;
    g = (g - 0.5) * contrastFactor + 0.5;
    b = (b - 0.5) * contrastFactor + 0.5;

    // 4. Highlights / Shadows tonal recovery
    const luma = r * LUMA_R + g * LUMA_G + b * LUMA_B;
    if (highlights !== 0 && luma > 0.5) {
      const highWeight = (luma - 0.5) * 2;
      const highFactor = 1 + (highlights / 100) * highWeight;
      r *= highFactor;
      g *= highFactor;
      b *= highFactor;
    }
    if (shadows !== 0 && luma < 0.5) {
      const shadWeight = (0.5 - luma) * 2;
      const shadOffset = (shadows / 100) * shadWeight * 0.2;
      r += shadOffset;
      g += shadOffset;
      b += shadOffset;
    }

    // 5. Saturation
    if (satFactor !== 1) {
      const currentLuma = r * LUMA_R + g * LUMA_G + b * LUMA_B;
      r = currentLuma + (r - currentLuma) * satFactor;
      g = currentLuma + (g - currentLuma) * satFactor;
      b = currentLuma + (b - currentLuma) * satFactor;
    }

    // Clamp back to 0-255
    pixels[i] = Math.min(255, Math.max(0, Math.round(r * 255)));
    pixels[i + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
    pixels[i + 2] = Math.min(255, Math.max(0, Math.round(b * 255)));
  }
}

/**
 * Adobe .cube 3D LUT Parser
 * Supports standard DaVinci / Premiere .cube files (LUT_3D_SIZE, TITLE, RGB lines).
 */
export function parseCubeLUT(cubeContent: string): {
  size: number;
  data: Float32Array;
  title?: string;
} {
  const lines = cubeContent.split(/\r?\n/);
  let size = 0;
  let title: string | undefined;
  const values: number[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('LUT_3D_SIZE')) {
      const parts = line.split(/\s+/);
      size = parseInt(parts[1], 10);
      continue;
    }

    if (line.startsWith('TITLE')) {
      title = line.replace(/^TITLE\s*"?/, '').replace(/"?$/, '');
      continue;
    }

    if (line.startsWith('DOMAIN_MIN') || line.startsWith('DOMAIN_MAX')) {
      continue;
    }

    const tokens = line.split(/\s+/);
    if (tokens.length >= 3) {
      const r = parseFloat(tokens[0]);
      const g = parseFloat(tokens[1]);
      const b = parseFloat(tokens[2]);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        values.push(r, g, b);
      }
    }
  }

  if (size <= 0) {
    size = Math.round(Math.cbrt(values.length / 3));
  }

  if (values.length !== size * size * size * 3) {
    throw new Error(
      `Invalid .cube LUT file: parsed ${values.length / 3} entries, expected ${size}^3 (${size * size * size})`
    );
  }

  return {
    size,
    data: new Float32Array(values),
    title,
  };
}

/**
 * Trilinear 3D Interpolation on RGBA pixel buffer using a 3D LUT table.
 */
export function applyLut3D(
  pixels: Uint8ClampedArray,
  lutSize: number,
  lutData: Float32Array,
  intensity: number = 1.0
): void {
  if (intensity <= 0) return;

  const maxIdx = lutSize - 1;
  const len = pixels.length;

  for (let i = 0; i < len; i += 4) {
    const origR = pixels[i];
    const origG = pixels[i + 1];
    const origB = pixels[i + 2];

    const normR = (origR / 255) * maxIdx;
    const normG = (origG / 255) * maxIdx;
    const normB = (origB / 255) * maxIdx;

    const r0 = Math.floor(normR);
    const r1 = Math.min(r0 + 1, maxIdx);
    const g0 = Math.floor(normG);
    const g1 = Math.min(g0 + 1, maxIdx);
    const b0 = Math.floor(normB);
    const b1 = Math.min(b0 + 1, maxIdx);

    const dr = normR - r0;
    const dg = normG - g0;
    const db = normB - b0;

    // Helper to get RGB from LUT: index = (r + g * size + b * size * size) * 3
    const getLutRgb = (r: number, g: number, b: number) => {
      const idx = (r + g * lutSize + b * lutSize * lutSize) * 3;
      return [lutData[idx], lutData[idx + 1], lutData[idx + 2]];
    };

    const c000 = getLutRgb(r0, g0, b0);
    const c100 = getLutRgb(r1, g0, b0);
    const c010 = getLutRgb(r0, g1, b0);
    const c110 = getLutRgb(r1, g1, b0);
    const c001 = getLutRgb(r0, g0, b1);
    const c101 = getLutRgb(r1, g0, b1);
    const c011 = getLutRgb(r0, g1, b1);
    const c111 = getLutRgb(r1, g1, b1);

    // Trilinear interpolation for R, G, B
    let newR = 0;
    let newG = 0;
    let newB = 0;

    for (let c = 0; c < 3; c++) {
      const c00 = c000[c] * (1 - dr) + c100[c] * dr;
      const c10 = c010[c] * (1 - dr) + c110[c] * dr;
      const c01 = c001[c] * (1 - dr) + c101[c] * dr;
      const c11 = c011[c] * (1 - dr) + c111[c] * dr;

      const c0 = c00 * (1 - dg) + c10 * dg;
      const c1 = c01 * (1 - dg) + c11 * dg;

      const interpolated = (c0 * (1 - db) + c1 * db) * 255;
      if (c === 0) newR = interpolated;
      else if (c === 1) newG = interpolated;
      else newB = interpolated;
    }

    if (intensity >= 1.0) {
      pixels[i] = Math.min(255, Math.max(0, Math.round(newR)));
      pixels[i + 1] = Math.min(255, Math.max(0, Math.round(newG)));
      pixels[i + 2] = Math.min(255, Math.max(0, Math.round(newB)));
    } else {
      pixels[i] = Math.min(255, Math.max(0, Math.round(origR + (newR - origR) * intensity)));
      pixels[i + 1] = Math.min(255, Math.max(0, Math.round(origG + (newG - origG) * intensity)));
      pixels[i + 2] = Math.min(255, Math.max(0, Math.round(origB + (newB - origB) * intensity)));
    }
  }
}

/**
 * Procedural synthesis of built-in 17x17x17 3D LUT look profiles
 */
export function generatePresetLUT(presetId: string, size: number = 17): Float32Array {
  const lut = new Float32Array(size * size * size * 3);
  const maxIdx = size - 1;

  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        let normR = r / maxIdx;
        let normG = g / maxIdx;
        let normB = b / maxIdx;

        if (presetId === 'angora-editorial') {
          // Angora: High contrast, slightly lifted black with cool teal tones, amber highlights
          normR = Math.pow(normR, 1.15) * 1.05;
          normG = Math.pow(normG, 1.05);
          normB = Math.pow(normB, 0.95) * 0.92 + 0.03; // Lifted shadow tint
        } else if (presetId === 'clean-commercial') {
          // Clean Commercial: Crisp highlights, vibrant skin tones
          normR = Math.pow(normR, 1.05) * 1.02;
          normG = Math.pow(normG, 1.02);
          normB = Math.pow(normB, 1.04);
        } else if (presetId === 'forest-cinematic') {
          // Forest: Rich greens, deep cyans, muted warm highlights
          normR = Math.pow(normR, 1.2) * 0.95;
          normG = Math.pow(normG, 0.95) * 1.05;
          normB = Math.pow(normB, 1.1) * 0.92;
        } else if (presetId === 'warm-film-35mm') {
          // Warm 35mm: Classic gold highlights, gentle roll-off
          normR = Math.pow(normR, 0.92) * 1.08;
          normG = Math.pow(normG, 1.0) * 1.01;
          normB = Math.pow(normB, 1.25) * 0.85;
        } else if (presetId === 'cool-corporate') {
          // Cool Corporate: Clean slate blues, neutral contrast
          normR = Math.pow(normR, 1.1) * 0.92;
          normG = Math.pow(normG, 1.02) * 0.98;
          normB = Math.pow(normB, 0.92) * 1.08;
        } else if (presetId === 'noir-monochrome') {
          // Noir: Punchy panchromatic black and white
          const gray = normR * LUMA_R + normG * LUMA_G + normB * LUMA_B;
          const punchy = Math.pow(gray, 1.25);
          normR = punchy;
          normG = punchy;
          normB = punchy;
        }

        const idx = (r + g * size + b * size * size) * 3;
        lut[idx] = Math.min(1.0, Math.max(0.0, normR));
        lut[idx + 1] = Math.min(1.0, Math.max(0.0, normG));
        lut[idx + 2] = Math.min(1.0, Math.max(0.0, normB));
      }
    }
  }

  return lut;
}

export const BUILTIN_LUT_PRESETS: { id: string; name: string; description: string }[] = [
  {
    id: 'angora-editorial',
    name: 'Angora Editorial',
    description: 'High-contrast studio grade with deep lifted blacks and crisp highlights.',
  },
  {
    id: 'clean-commercial',
    name: 'Clean Commercial',
    description: 'Vibrant, natural skin tones and pristine broadcast Rec.709 color balance.',
  },
  {
    id: 'forest-cinematic',
    name: 'Forest Cinematic',
    description: 'Moody filmic greens, cyan shadows, and atmospheric contrast.',
  },
  {
    id: 'warm-film-35mm',
    name: '35mm Warm Tungsten',
    description: 'Classic Kodak analog film look with golden roll-off and warm shadow tone.',
  },
  {
    id: 'cool-corporate',
    name: 'Cool Corporate',
    description: 'Modern executive palette with clean slate-blue undertones.',
  },
  {
    id: 'noir-monochrome',
    name: 'Noir Monochrome',
    description: 'High-contrast black & white with deep velvety shadows and brilliant silver highlights.',
  },
];

/**
 * Fast procedural Film Grain synthesis
 */
export function applyFilmGrain(
  pixels: Uint8ClampedArray,
  params: FilmGrainParams
): void {
  const { intensity, monochrome } = params;
  if (intensity <= 0) return;

  const len = pixels.length;
  const grainScale = intensity * 48; // Max +/- 48 level shift

  for (let i = 0; i < len; i += 4) {
    if (monochrome) {
      const noise = (Math.random() - 0.5) * grainScale;
      pixels[i] = Math.min(255, Math.max(0, pixels[i] + noise));
      pixels[i + 1] = Math.min(255, Math.max(0, pixels[i + 1] + noise));
      pixels[i + 2] = Math.min(255, Math.max(0, pixels[i + 2] + noise));
    } else {
      pixels[i] = Math.min(255, Math.max(0, pixels[i] + (Math.random() - 0.5) * grainScale));
      pixels[i + 1] = Math.min(255, Math.max(0, pixels[i + 1] + (Math.random() - 0.5) * grainScale));
      pixels[i + 2] = Math.min(255, Math.max(0, pixels[i + 2] + (Math.random() - 0.5) * grainScale));
    }
  }
}

/**
 * Optical Vignette render via Canvas 2D radial gradient
 */
export function applyVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: VignetteParams
): void {
  const { amount, radius, feather } = params;
  if (amount <= 0) return;

  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY) * radius;
  const innerRadius = maxRadius * (1 - feather);

  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    innerRadius,
    centerX,
    centerY,
    maxRadius
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${Math.min(1.0, amount)})`);

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Fast 3x3 Sharpening Convolution Filter
 */
export function applySharpen(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number
): void {
  if (amount <= 0) return;

  const copy = new Uint8ClampedArray(pixels);
  const a = amount;
  // 3x3 unsharp mask kernel: [0, -a, 0, -a, 1 + 4a, -a, 0, -a, 0]
  const center = 1 + 4 * a;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const top = ((y - 1) * width + x) * 4;
      const bot = ((y + 1) * width + x) * 4;
      const left = (y * width + (x - 1)) * 4;
      const right = (y * width + (x + 1)) * 4;

      for (let c = 0; c < 3; c++) {
        const val =
          copy[idx + c] * center -
          (copy[top + c] + copy[bot + c] + copy[left + c] + copy[right + c]) * a;
        pixels[idx + c] = Math.min(255, Math.max(0, Math.round(val)));
      }
    }
  }
}
