import { describe, it, expect } from 'vitest';
import {
  applyColorCorrection,
  parseCubeLUT,
  applyLut3D,
  generatePresetLUT,
  applyVignette,
  applyFilmGrain,
  applySharpen,
  BUILTIN_LUT_PRESETS,
} from '../colorEngine';
import { extractVideoScopes } from '../scopesEngine';
import { DEFAULT_COLOR_CORRECTION, ColorCorrectionParams } from '../types';

describe('MotionLab 3.0 — Video FX & Color Studio Test Suite', () => {
  describe('Color Correction Engine', () => {
    it('boosts luminance when exposure is increased', () => {
      // 10x10 mid-gray image (R=128, G=128, B=128, A=255)
      const pixels = new Uint8ClampedArray(10 * 10 * 4);
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 128;
        pixels[i + 1] = 128;
        pixels[i + 2] = 128;
        pixels[i + 3] = 255;
      }

      const params: ColorCorrectionParams = {
        ...DEFAULT_COLOR_CORRECTION,
        exposure: 50, // +1 EV (double luminance)
      };

      applyColorCorrection(pixels, params);

      // Mid-gray 128 should increase significantly towards 255
      expect(pixels[0]).toBeGreaterThan(180);
      expect(pixels[1]).toBeGreaterThan(180);
      expect(pixels[2]).toBeGreaterThan(180);
    });

    it('shifts warm/amber tones when temperature is raised', () => {
      const pixels = new Uint8ClampedArray(4);
      pixels[0] = 128;
      pixels[1] = 128;
      pixels[2] = 128;
      pixels[3] = 255;

      const params: ColorCorrectionParams = {
        ...DEFAULT_COLOR_CORRECTION,
        temperature: 60, // Warm
      };

      applyColorCorrection(pixels, params);

      // Red should be higher than Blue
      expect(pixels[0]).toBeGreaterThan(pixels[2]);
    });

    it('expands dynamic range when contrast is increased', () => {
      // Two pixels: dark gray (60) and light gray (190)
      const pixels = new Uint8ClampedArray(8);
      pixels[0] = 60; pixels[1] = 60; pixels[2] = 60; pixels[3] = 255;
      pixels[4] = 190; pixels[5] = 190; pixels[6] = 190; pixels[7] = 255;

      const params: ColorCorrectionParams = {
        ...DEFAULT_COLOR_CORRECTION,
        contrast: 40,
      };

      applyColorCorrection(pixels, params);

      // Dark pixel gets darker, light pixel gets lighter
      expect(pixels[0]).toBeLessThan(60);
      expect(pixels[4]).toBeGreaterThan(190);
    });
  });

  describe('3D LUT Parser & Interpolator', () => {
    it('parses valid Adobe / DaVinci .cube format files', () => {
      const cubeContent = `
# MotionLab Test Cube
TITLE "Test Grade 2x2x2"
LUT_3D_SIZE 2

0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
      `.trim();

      const parsed = parseCubeLUT(cubeContent);
      expect(parsed.size).toBe(2);
      expect(parsed.title).toBe('Test Grade 2x2x2');
      expect(parsed.data.length).toBe(2 * 2 * 2 * 3); // 24 floats
    });

    it('throws an error on malformed .cube LUT files', () => {
      const invalidCube = `
LUT_3D_SIZE 2
0.0 0.0 0.0
      `.trim();

      expect(() => parseCubeLUT(invalidCube)).toThrow(/Invalid \.cube LUT file/);
    });

    it('generates built-in look presets with 17x17x17 lattice', () => {
      expect(BUILTIN_LUT_PRESETS.length).toBeGreaterThanOrEqual(6);
      const angoraLut = generatePresetLUT('angora-editorial', 17);
      expect(angoraLut.length).toBe(17 * 17 * 17 * 3);
    });

    it('applies 3D LUT transformation to pixel buffer via trilinear interpolation', () => {
      const pixels = new Uint8ClampedArray([128, 128, 128, 255]);
      const noirLut = generatePresetLUT('noir-monochrome', 17);

      applyLut3D(pixels, 17, noirLut, 1.0);

      // In monochrome LUT, R, G, and B should be identical
      expect(pixels[0]).toBe(pixels[1]);
      expect(pixels[1]).toBe(pixels[2]);
    });
  });

  describe('Video Scopes Telemetry', () => {
    it('extracts RGB histogram, luma histogram, waveform, and vectorscope', () => {
      const width = 64;
      const height = 64;
      const pixels = new Uint8ClampedArray(width * height * 4);

      // Gradient image
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          pixels[idx] = Math.round((x / width) * 255);
          pixels[idx + 1] = Math.round((y / height) * 255);
          pixels[idx + 2] = 128;
          pixels[idx + 3] = 255;
        }
      }

      const scopes = extractVideoScopes(pixels, width, height, 32);

      expect(scopes.rgbHistogram.r.length).toBe(256);
      expect(scopes.lumaHistogram.length).toBe(256);
      expect(scopes.waveform.length).toBe(32 * 256);
      expect(scopes.vectorscope.length).toBe(128 * 128);

      // Verify that bins contain counts matching pixel count
      let totalLuma = 0;
      for (let i = 0; i < 256; i++) {
        totalLuma += scopes.lumaHistogram[i];
      }
      expect(totalLuma).toBe(width * height);
    });
  });

  describe('Video Filters', () => {
    it('adds film grain noise to pixel buffer', () => {
      const pixels = new Uint8ClampedArray(100 * 4);
      pixels.fill(128); // Mid-gray

      applyFilmGrain(pixels, { intensity: 0.5, size: 1.5, monochrome: true });

      // Pixels should no longer all be exactly 128
      const hasVariation = Array.from(pixels).some((p, i) => i % 4 !== 3 && p !== 128);
      expect(hasVariation).toBe(true);
    });

    it('sharpens pixel transitions using 3x3 convolution', () => {
      const width = 10;
      const height = 10;
      const pixels = new Uint8ClampedArray(width * height * 4);
      pixels.fill(100);
      // Place a bright spike in the center
      pixels[(5 * width + 5) * 4] = 200;

      applySharpen(pixels, width, height, 1.0);

      // Center spike should be boosted
      expect(pixels[(5 * width + 5) * 4]).toBeGreaterThanOrEqual(200);
    });
  });
});
