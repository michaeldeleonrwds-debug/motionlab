/**
 * MotionLab Creative Intelligence Engine — Composition & Layout Engine
 * Calculates grid systems, safe-area margins, 2D bounding boxes, collision matrices,
 * and visual balance metrics for video sequences.
 */

import type { AspectRatio } from '../../types/editor';
import type { BoundingBox2D, CompositionDiagnostic } from '../types';

export interface GridSystemConfig {
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  gridType: 'rule-of-thirds' | '12-column' | 'modular-4x4';
  safeMarginPercent: number; // e.g. 10%
}

export interface GridLines {
  horizontal: number[];
  vertical: number[];
  safeBounds: BoundingBox2D;
  platformUiSafeBounds: BoundingBox2D; // e.g. TikTok / Instagram Reels top & bottom margin
}

export interface ElementTransformSpec {
  id: string;
  name: string;
  type: string;
  x: number; // Offset from sequence center
  y: number; // Offset from sequence center
  width: number;
  height: number;
  scale?: number;
  opacity?: number;
  parentId?: string;
  isBackground?: boolean;
}

export class CompositionEngine {
  /**
   * Calculates grid lines and safe boundaries for a sequence format.
   */
  public static calculateGrid(config: GridSystemConfig): GridLines {
    const { width, height, gridType, safeMarginPercent, aspectRatio } = config;

    const horizontal: number[] = [];
    const vertical: number[] = [];

    if (gridType === 'rule-of-thirds') {
      horizontal.push(height * (1 / 3), height * (2 / 3));
      vertical.push(width * (1 / 3), width * (2 / 3));
    } else if (gridType === '12-column') {
      for (let i = 1; i < 12; i++) {
        vertical.push((width / 12) * i);
      }
      horizontal.push(height * 0.25, height * 0.5, height * 0.75);
    } else {
      // modular 4x4
      for (let i = 1; i < 4; i++) {
        horizontal.push((height / 4) * i);
        vertical.push((width / 4) * i);
      }
    }

    const marginX = width * (safeMarginPercent / 100);
    const marginY = height * (safeMarginPercent / 100);

    const safeBounds: BoundingBox2D = {
      left: marginX,
      top: marginY,
      right: width - marginX,
      bottom: height - marginY,
      width: width - marginX * 2,
      height: height - marginY * 2,
      centerX: width / 2,
      centerY: height / 2,
    };

    // For 9:16 vertical, bottom 20% is typically covered by social media UI (captions, like button, sound icon)
    const uiBottomMargin = aspectRatio === '9:16' ? height * 0.22 : marginY;
    const uiTopMargin = aspectRatio === '9:16' ? height * 0.12 : marginY;

    const platformUiSafeBounds: BoundingBox2D = {
      left: marginX,
      top: uiTopMargin,
      right: width - marginX,
      bottom: height - uiBottomMargin,
      width: width - marginX * 2,
      height: height - (uiTopMargin + uiBottomMargin),
      centerX: width / 2,
      centerY: (uiTopMargin + (height - uiBottomMargin)) / 2,
    };

    return {
      horizontal,
      vertical,
      safeBounds,
      platformUiSafeBounds,
    };
  }

  /**
   * Converts a center-offset sequence transform into a 2D bounding box in sequence coordinates [0, 0] to [W, H].
   */
  public static computeElementBoundingBox(
    spec: ElementTransformSpec,
    seqWidth: number,
    seqHeight: number
  ): BoundingBox2D {
    const scale = spec.scale ?? 1;
    const effectiveW = Math.max(10, spec.width * scale);
    const effectiveH = Math.max(10, spec.height * scale);

    // Sequence center is at seqWidth/2, seqHeight/2
    const centerX = seqWidth / 2 + spec.x;
    const centerY = seqHeight / 2 + spec.y;

    const left = centerX - effectiveW / 2;
    const top = centerY - effectiveH / 2;
    const right = centerX + effectiveW / 2;
    const bottom = centerY + effectiveH / 2;

    return {
      left,
      top,
      right,
      bottom,
      width: effectiveW,
      height: effectiveH,
      centerX,
      centerY,
    };
  }

  /**
   * Calculates the intersection area in pixels between two 2D bounding boxes.
   */
  public static computeOverlapArea(boxA: BoundingBox2D, boxB: BoundingBox2D): number {
    const xOverlap = Math.max(0, Math.min(boxA.right, boxB.right) - Math.max(boxA.left, boxB.left));
    const yOverlap = Math.max(0, Math.min(boxA.bottom, boxB.bottom) - Math.max(boxA.top, boxB.top));
    return xOverlap * yOverlap;
  }

  /**
   * Analyzes an array of visible visual elements or TimelineClips at a specific point in time
   * and reports collisions, out-of-bounds clipping, and visual balance.
   */
  public static analyzeComposition(
    elements: Array<ElementTransformSpec | any>,
    seqWidthOrDims: number | { width: number; height: number } = 1920,
    seqHeightOrTime = 1080,
    aspectRatio: AspectRatio = '16:9'
  ): CompositionDiagnostic {
    let seqWidth = 1920;
    let seqHeight = 1080;
    if (typeof seqWidthOrDims === 'object' && seqWidthOrDims !== null) {
      seqWidth = seqWidthOrDims.width;
      seqHeight = seqWidthOrDims.height;
    } else {
      seqWidth = seqWidthOrDims;
      seqHeight = seqHeightOrTime;
    }

    const grid = this.calculateGrid({
      aspectRatio,
      width: seqWidth,
      height: seqHeight,
      gridType: 'rule-of-thirds',
      safeMarginPercent: 10,
    });

    const normalized: ElementTransformSpec[] = elements.map((el) => {
      if ('textStyle' in el || 'shapeStyle' in el || 'trackId' in el) {
        const isBg = el.trackId === 'track-bg' || el.name?.toLowerCase().includes('bg') || el.name?.toLowerCase().includes('background');
        let w = 400;
        let h = 200;
        if (el.shapeStyle) {
          w = el.shapeStyle.width || 400;
          h = el.shapeStyle.height || 200;
        } else if (el.textStyle) {
          w = (el.textStyle.content?.length || 10) * (el.textStyle.fontSize || 36) * 0.6;
          h = (el.textStyle.fontSize || 36) * 1.3;
        }
        return {
          id: el.id,
          name: el.name || el.id,
          type: el.type,
          x: el.x || 0,
          y: el.y || 0,
          width: w,
          height: h,
          scale: el.scale ?? 1,
          opacity: el.opacity ?? 1,
          parentId: el.parentId,
          isBackground: isBg,
        };
      }
      return el as ElementTransformSpec;
    });

    const activeElements = normalized.filter((e) => (e.opacity ?? 1) > 0.05);
    const boundingBoxes = new Map<string, BoundingBox2D>();

    for (const el of activeElements) {
      boundingBoxes.set(el.id, this.computeElementBoundingBox(el, seqWidth, seqHeight));
    }

    const collisions: CompositionDiagnostic['collisions'] = [];
    const offscreenClips: CompositionDiagnostic['offscreenClips'] = [];
    const safeZoneViolations: CompositionDiagnostic['safeZoneViolations'] = [];

    // 1. Collision analysis
    for (let i = 0; i < activeElements.length; i++) {
      const a = activeElements[i];
      if (a.isBackground) continue;
      const boxA = boundingBoxes.get(a.id)!;

      // Check offscreen clipping
      const overflowEdges: string[] = [];
      if (boxA.left < 0) overflowEdges.push('left');
      if (boxA.top < 0) overflowEdges.push('top');
      if (boxA.right > seqWidth) overflowEdges.push('right');
      if (boxA.bottom > seqHeight) overflowEdges.push('bottom');

      if (overflowEdges.length > 0 && !a.isBackground) {
        offscreenClips.push({ id: a.id, name: a.name, overflowEdges });
      }

      // Check safe zone
      const safe = aspectRatio === '9:16' ? grid.platformUiSafeBounds : grid.safeBounds;
      if (boxA.left < safe.left || boxA.right > safe.right || boxA.top < safe.top || boxA.bottom > safe.bottom) {
        if (a.type === 'text') {
          safeZoneViolations.push({
            id: a.id,
            name: a.name,
            violation: `Text bounds bleed outside safe zone (${Math.round(safe.left)}..${Math.round(safe.right)}px).`,
          });
        }
      }

      // Collision with other elements
      for (let j = i + 1; j < activeElements.length; j++) {
        const b = activeElements[j];
        if (b.isBackground) continue;

        const isParentChild = a.parentId === b.id || b.parentId === a.id;
        const boxB = boundingBoxes.get(b.id)!;
        const overlapArea = this.computeOverlapArea(boxA, boxB);

        // Only flag if substantial overlap occurs between non-parented foreground elements
        const minArea = Math.min(boxA.width * boxA.height, boxB.width * boxB.height);
        const overlapRatio = minArea > 0 ? overlapArea / minArea : 0;

        if (overlapRatio > 0.25) {
          collisions.push({
            clipA: { id: a.id, name: a.name },
            clipB: { id: b.id, name: b.name },
            overlapAreaPx: Math.round(overlapArea),
            isIntentionalParentChild: isParentChild,
          });
        }
      }
    }

    // 2. Visual balance calculation
    let totalWeight = 0;
    let weightedCenterX = 0;
    let weightedCenterY = 0;

    for (const el of activeElements) {
      if (el.isBackground) continue;
      const box = boundingBoxes.get(el.id)!;
      const weight = (box.width * box.height) * (el.opacity ?? 1);
      totalWeight += weight;
      weightedCenterX += box.centerX * weight;
      weightedCenterY += box.centerY * weight;
    }

    let focalXPercent = 50;
    let focalYPercent = 50;
    let visualBalanceScore = 1.0;

    if (totalWeight > 0) {
      const avgX = weightedCenterX / totalWeight;
      const avgY = weightedCenterY / totalWeight;
      focalXPercent = Number(((avgX / seqWidth) * 100).toFixed(1));
      focalYPercent = Number(((avgY / seqHeight) * 100).toFixed(1));

      // Deviation from center or rule of thirds points
      const centerDistX = Math.abs(focalXPercent - 50) / 50;
      const centerDistY = Math.abs(focalYPercent - 50) / 50;
      visualBalanceScore = Number(Math.max(0.4, 1.0 - (centerDistX * 0.4 + centerDistY * 0.4)).toFixed(2));
    }

    return {
      timeSeconds: 0,
      elementCount: activeElements.length,
      collisions,
      offscreenClips,
      visualBalanceScore,
      focalPointBalance: { xPercent: focalXPercent, yPercent: focalYPercent },
      safeZoneViolations,
    };
  }

  /**
   * Resolves sequence pixel dimensions for resolution preset and aspect ratio.
   */
  public static getSequenceDimensions(
    resolution: '1080p' | '720p' = '1080p',
    aspectRatio: AspectRatio = '16:9'
  ): { width: number; height: number } {
    const base = resolution === '720p' ? 720 : 1080;
    switch (aspectRatio) {
      case '16:9':
        return { width: Math.round((base * 16) / 9), height: base };
      case '9:16':
        return { width: base, height: Math.round((base * 16) / 9) };
      case '1:1':
        return { width: base, height: base };
      case '4:5':
        return { width: base, height: Math.round((base * 5) / 4) };
      default:
        return { width: 1920, height: 1080 };
    }
  }

  /**
   * Returns safe margins and platform UI bounding boxes for a sequence.
   */
  public static getSafeMargins(
    resolution: '1080p' | '720p' = '1080p',
    aspectRatio: AspectRatio = '16:9'
  ): {
    actionSafe: BoundingBox2D;
    titleSafe: BoundingBox2D;
    platformUiSafe: BoundingBox2D;
  } {
    const dims = this.getSequenceDimensions(resolution, aspectRatio);
    const grid = this.calculateGrid({
      aspectRatio,
      width: dims.width,
      height: dims.height,
      gridType: 'rule-of-thirds',
      safeMarginPercent: 10,
    });

    const actionMarginX = dims.width * 0.05;
    const actionMarginY = dims.height * 0.05;

    const actionSafe: BoundingBox2D = {
      left: actionMarginX,
      top: actionMarginY,
      right: dims.width - actionMarginX,
      bottom: dims.height - actionMarginY,
      width: dims.width - actionMarginX * 2,
      height: dims.height - actionMarginY * 2,
      centerX: dims.width / 2,
      centerY: dims.height / 2,
    };

    return {
      actionSafe,
      titleSafe: grid.safeBounds,
      platformUiSafe: grid.platformUiSafeBounds,
    };
  }
}

