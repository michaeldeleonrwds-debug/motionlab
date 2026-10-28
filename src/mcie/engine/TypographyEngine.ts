/**
 * MotionLab Creative Intelligence Engine — Professional Typography Engine
 * Provides deterministic type scale generation, bounding box calculation, automatic text wrapping,
 * optical alignment, hierarchy analysis, and WCAG AA/AAA contrast verification.
 */

import type { BoundingBox2D, TypographyDiagnostic } from '../types';

export type TypeScalePreset =
  | 'major-second' // 1.125 — Subtle, dense corporate
  | 'major-third' // 1.250 — Swiss editorial standard (clean & balanced)
  | 'perfect-fourth' // 1.333 — Commercial & modern tech
  | 'augmented-fourth' // 1.414 — High contrast posters
  | 'golden-ratio'; // 1.618 — Expressive, cinematic headlines

export interface TypeScaleHierarchy {
  baseSize: number;
  ratio: number;
  display: number;
  headline: number;
  title: number;
  subhead: number;
  body: number;
  caption: number;
}

export interface WrapTextOptions {
  text: string;
  maxWidthPx: number;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: number;
}

export class TypographyEngine {
  private static readonly SCALE_RATIOS: Record<TypeScalePreset, number> = {
    'major-second': 1.125,
    'major-third': 1.25,
    'perfect-fourth': 1.333,
    'augmented-fourth': 1.414,
    'golden-ratio': 1.618,
  };

  /**
   * Generates a calibrated typography scale hierarchy from a base body font size.
   */
  public static generateScale(baseSize = 24, preset: TypeScalePreset = 'major-third'): TypeScaleHierarchy {
    const ratio = this.SCALE_RATIOS[preset] || 1.25;
    return {
      baseSize,
      ratio,
      caption: Math.round(baseSize / ratio),
      body: baseSize,
      subhead: Math.round(baseSize * ratio),
      title: Math.round(baseSize * Math.pow(ratio, 2)),
      headline: Math.round(baseSize * Math.pow(ratio, 3)),
      display: Math.round(baseSize * Math.pow(ratio, 4)),
    };
  }

  /**
   * Approximate character width factor based on font family characteristics.
   */
  private static getCharWidthFactor(fontFamily = 'Inter', fontWeight = 400): number {
    const fontLower = fontFamily.toLowerCase();
    let factor = 0.55; // Standard sans-serif ratio

    if (fontLower.includes('mono') || fontLower.includes('courier')) {
      factor = 0.62;
    } else if (fontLower.includes('space') || fontLower.includes('grotesk')) {
      factor = 0.58;
    } else if (fontLower.includes('condensed')) {
      factor = 0.44;
    }

    if (fontWeight >= 700) {
      factor *= 1.08;
    }
    return factor;
  }

  /**
   * Calculates deterministic bounding box dimensions for text without requiring browser DOM measurements.
   */
  public static computeTextBounds(
    text: string,
    fontSize: number,
    fontFamily = 'Inter',
    fontWeight = 600,
    lineHeightMultiplier = 1.25,
    trackingPx = 0
  ): { width: number; height: number; lineCount: number } {
    if (!text || text.trim().length === 0) {
      return { width: 0, height: 0, lineCount: 0 };
    }

    const lines = text.split('\n');
    const charWidth = fontSize * this.getCharWidthFactor(fontFamily, fontWeight);

    let maxLineWidth = 0;
    for (const line of lines) {
      const lineLen = line.length;
      const width = lineLen * charWidth + (lineLen > 1 ? (lineLen - 1) * trackingPx : 0);
      if (width > maxLineWidth) maxLineWidth = width;
    }

    const lineCount = lines.length;
    const height = lineCount * fontSize * lineHeightMultiplier;

    return {
      width: Math.ceil(maxLineWidth),
      height: Math.ceil(height),
      lineCount,
    };
  }

  /**
   * Wraps text intelligently into multiple lines to fit within a bounding column.
   */
  public static wrapTextToWidth(options: WrapTextOptions): string {
    const { text, maxWidthPx, fontSize, fontFamily, fontWeight } = options;
    const words = text.replace(/\r/g, '').split(' ');
    const charWidth = fontSize * this.getCharWidthFactor(fontFamily, fontWeight);

    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      // Check if word contains forced newline
      if (word.includes('\n')) {
        const subParts = word.split('\n');
        for (let i = 0; i < subParts.length; i++) {
          const part = subParts[i];
          if (i === 0) {
            const test = currentLine ? `${currentLine} ${part}` : part;
            if (test.length * charWidth <= maxWidthPx) {
              currentLine = test;
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = part;
            }
            lines.push(currentLine);
            currentLine = '';
          } else if (i === subParts.length - 1) {
            currentLine = part;
          } else {
            lines.push(part);
          }
        }
        continue;
      }

      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = testLine.length * charWidth;

      if (testWidth <= maxWidthPx || !currentLine) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines.join('\n');
  }

  /**
   * Parses hex or rgb color string into normalized RGB components [0..1].
   */
  public static parseColorToRgb(colorStr: string): [number, number, number] {
    if (!colorStr) return [1, 1, 1];
    const hex = colorStr.replace('#', '').trim();

    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16) / 255;
      const g = parseInt(hex[1] + hex[1], 16) / 255;
      const b = parseInt(hex[2] + hex[2], 16) / 255;
      return [r, g, b];
    }

    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return [r, g, b];
    }

    // Default white
    return [1, 1, 1];
  }

  /**
   * Computes relative luminance according to WCAG 2.1 specs.
   */
  public static computeLuminance(rgb: [number, number, number]): number {
    const a = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  /**
   * Calculates WCAG contrast ratio (1:1 to 21:1) between foreground and background colors.
   */
  public static calculateContrastRatio(foregroundHex: string, backgroundHex: string): number {
    const rgbFg = this.parseColorToRgb(foregroundHex);
    const rgbBg = this.parseColorToRgb(backgroundHex);

    const lumFg = this.computeLuminance(rgbFg);
    const lumBg = this.computeLuminance(rgbBg);

    const lighter = Math.max(lumFg, lumBg);
    const darker = Math.min(lumFg, lumBg);

    const ratio = (lighter + 0.05) / (darker + 0.05);
    return Number(ratio.toFixed(2));
  }

  /**
   * Inspects a text element and returns complete typography diagnostics.
   */
  public static diagnoseTextElement(
    clipId: string,
    text: string,
    fontSize: number,
    colorHex: string,
    backgroundHex: string,
    seqWidth = 1920,
    seqHeight = 1080
  ): TypographyDiagnostic {
    const bounds = this.computeTextBounds(text, fontSize);
    const contrastRatio = this.calculateContrastRatio(colorHex, backgroundHex);
    const wcagAaCompliant = contrastRatio >= 4.5 || (fontSize >= 36 && contrastRatio >= 3.0);

    const titleSafeWidth = seqWidth * 0.8;
    const titleSafeHeight = seqHeight * 0.8;
    const fitsWithinSafeZone = bounds.width <= titleSafeWidth && bounds.height <= titleSafeHeight;

    const issues: string[] = [];
    if (!wcagAaCompliant) {
      issues.push(
        `Low contrast ratio (${contrastRatio}:1). Minimum WCAG AA requires 4.5:1 (or 3.0:1 for large display titles).`
      );
    }
    if (!fitsWithinSafeZone) {
      issues.push(
        `Text bounds (${bounds.width}×${bounds.height}px) exceed 80% title safe area (${titleSafeWidth}×${titleSafeHeight}px).`
      );
    }
    if (bounds.lineCount > 4) {
      issues.push('Excessive line count in title overlay (> 4 lines). Consider splitting into multiple scenes.');
    }

    let hierarchyLevel: TypographyDiagnostic['hierarchyLevel'] = 'body';
    if (fontSize >= 64) hierarchyLevel = 'display';
    else if (fontSize >= 44) hierarchyLevel = 'title';
    else if (fontSize >= 28) hierarchyLevel = 'subhead';
    else if (fontSize <= 16) hierarchyLevel = 'caption';

    return {
      clipId,
      text,
      fontSize,
      lineCount: bounds.lineCount,
      computedWidth: bounds.width,
      computedHeight: bounds.height,
      fitsWithinSafeZone,
      contrastRatio,
      wcagAaCompliant,
      hierarchyLevel,
      issues,
    };
  }

  /**
   * Alias for computeTextBounds for backwards compatibility and brevity.
   */
  public static estimateTextDimensions = TypographyEngine.computeTextBounds;

  /**
   * Alias for calculateContrastRatio.
   */
  public static getContrastRatio = TypographyEngine.calculateContrastRatio;

  /**
   * High-level diagnose helper accepting structured options.
   */
  public static diagnose(
    text: string,
    options: {
      fontSize: number;
      fontFamily?: string;
      textColorHex: string;
      backgroundColorHex: string;
      targetWidth?: number;
      viewportWidth?: number;
      viewportHeight?: number;
      position?: { x: number; y: number };
    }
  ): TypographyDiagnostic {
    return this.diagnoseTextElement(
      'diag-clip',
      text,
      options.fontSize,
      options.textColorHex,
      options.backgroundColorHex,
      options.viewportWidth ?? 1920,
      options.viewportHeight ?? 1080
    );
  }
}

