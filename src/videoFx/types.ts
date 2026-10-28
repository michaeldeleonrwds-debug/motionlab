/**
 * MotionLab 3.0 — Video FX & Color Studio Types
 * Professional nondestructive color grading, 3D LUT system,
 * video filters, and real-time scopes telemetry.
 */

export type VideoEffectType =
  | 'color-correction'
  | 'lut'
  | 'vignette'
  | 'film-grain'
  | 'bloom'
  | 'chromatic-aberration'
  | 'gaussian-blur'
  | 'sharpen'
  | 'monochrome'
  | 'halation';

export interface RgbBalance {
  r: number; // -1.0 to +1.0 (default 0)
  g: number;
  b: number;
}

export interface ColorCorrectionParams {
  exposure: number; // -100 to +100 (0 = neutral)
  contrast: number; // -100 to +100
  saturation: number; // -100 to +100
  temperature: number; // -100 (cool/blue) to +100 (warm/amber)
  tint: number; // -100 (green) to +100 (magenta)
  highlights: number; // -100 to +100
  shadows: number; // -100 to +100
  whites: number; // -100 to +100
  blacks: number; // -100 to +100
  lift: RgbBalance; // Shadows RGB balance
  gamma: RgbBalance; // Midtones RGB balance
  gain: RgbBalance; // Highlights RGB balance
}

export interface LutParams {
  presetId: string;
  name: string;
  intensity: number; // 0 to 1.0 (default 1.0)
  cubeSize?: number; // e.g. 17, 33, 64
  cubeData?: Float32Array; // Flattened [R, G, B] * cubeSize^3
}

export interface VignetteParams {
  amount: number; // 0 to 1.0 (default 0.45)
  radius: number; // 0.1 to 1.0 (default 0.75)
  feather: number; // 0.1 to 1.0 (default 0.5)
  roundness: number; // 0 to 1.0 (default 1.0)
}

export interface FilmGrainParams {
  intensity: number; // 0 to 1.0 (default 0.25)
  size: number; // 1 to 5 px (default 1.5)
  monochrome: boolean; // default true
}

export interface BloomParams {
  threshold: number; // 0.5 to 1.0 (default 0.8)
  intensity: number; // 0 to 1.0 (default 0.4)
  radius: number; // 1 to 30 px (default 12)
}

export interface ChromaticAberrationParams {
  offsetPx: number; // 0 to 25 px (default 4)
  angleDeg: number; // 0 to 360 (default 45)
}

export interface GaussianBlurParams {
  radiusPx: number; // 0 to 60 px (default 8)
}

export interface SharpenParams {
  amount: number; // 0 to 2.0 (default 0.8)
  radiusPx: number; // 0.5 to 3.0 (default 1.0)
}

export interface MonochromeParams {
  tintColor: string; // Hex color for duotone/sepia/tint
  intensity: number; // 0 to 1.0
  contrastBoost: number; // 0 to 50
}

export interface HalationParams {
  threshold: number; // 0.6 to 1.0
  intensity: number; // 0 to 1.0
  redDecay: number; // Warm red spread
}

export type VideoEffectParams =
  | { type: 'color-correction'; params: ColorCorrectionParams }
  | { type: 'lut'; params: LutParams }
  | { type: 'vignette'; params: VignetteParams }
  | { type: 'film-grain'; params: FilmGrainParams }
  | { type: 'bloom'; params: BloomParams }
  | { type: 'chromatic-aberration'; params: ChromaticAberrationParams }
  | { type: 'gaussian-blur'; params: GaussianBlurParams }
  | { type: 'sharpen'; params: SharpenParams }
  | { type: 'monochrome'; params: MonochromeParams }
  | { type: 'halation'; params: HalationParams };

export interface VideoEffect {
  id: string;
  type: VideoEffectType;
  name: string;
  enabled: boolean;
  params:
    | ColorCorrectionParams
    | LutParams
    | VignetteParams
    | FilmGrainParams
    | BloomParams
    | ChromaticAberrationParams
    | GaussianBlurParams
    | SharpenParams
    | MonochromeParams
    | HalationParams;
}

export const DEFAULT_COLOR_CORRECTION: ColorCorrectionParams = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  lift: { r: 0, g: 0, b: 0 },
  gamma: { r: 0, g: 0, b: 0 },
  gain: { r: 0, g: 0, b: 0 },
};

export interface VideoScopesData {
  rgbHistogram: {
    r: Uint32Array; // 256 bins
    g: Uint32Array;
    b: Uint32Array;
  };
  lumaHistogram: Uint32Array; // 256 bins
  waveform: Uint8Array; // 256 bins x width columns
  waveformWidth: number;
  waveformHeight: number;
  vectorscope: Uint8Array; // 256x256 grid of Cb/Cr chroma density
}
