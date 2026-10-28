import type {
  ColorEffects,
  ProjectData,
  TimelineClip,
} from '../types/editor';
import type { VideoEffect, ColorCorrectionParams, VignetteParams } from '../videoFx/types';
import {
  getCompositedVisualClipsAtTime,
  getResolutionDimensions,
} from './timelineEngine';
import {
  evaluateClipTransform,
  evaluateCubicBezier,
  evaluateEasing,
  evaluateTextAnimation,
} from './keyframeEngine';

export interface MediaElementSource {
  videoElements: Map<string, HTMLVideoElement>;
  imageElements: Map<string, HTMLImageElement>;
}

/**
 * Converts ColorEffects into a deterministic CanvasRenderingContext2D filter string.
 * Exposure is mapped to an exponential brightness multiplier combined with base brightness.
 */
export function buildCanvasFilterString(
  effects: ColorEffects,
  videoEffects?: VideoEffect[]
): string {
  const filters: string[] = [];

  const gradeEffect = videoEffects?.find((e) => e.enabled && e.type === 'color-correction');
  const grade = gradeEffect?.params as ColorCorrectionParams | undefined;

  const exposure = grade ? grade.exposure : effects.exposure;
  const contrast = grade ? grade.contrast : effects.contrast;
  const saturation = grade ? grade.saturation : effects.saturation;
  const temperature = grade ? grade.temperature : 0;
  const tint = grade ? grade.tint : 0;

  const baseBrightness = 1 + effects.brightness / 100;
  const exposureMultiplier = Math.pow(2, exposure / 65);
  const totalBrightness = Math.max(0, baseBrightness * exposureMultiplier);

  if (Math.abs(totalBrightness - 1) > 0.005) {
    filters.push(`brightness(${(totalBrightness * 100).toFixed(1)}%)`);
  }

  if (Math.abs(contrast) > 0.5) {
    const contrastPct = Math.max(0, 100 + contrast);
    filters.push(`contrast(${contrastPct.toFixed(1)}%)`);
  }

  if (Math.abs(saturation) > 0.5) {
    const satPct = Math.max(0, 100 + saturation);
    filters.push(`saturate(${satPct.toFixed(1)}%)`);
  }

  if (temperature !== 0) {
    if (temperature > 0) {
      filters.push(`sepia(${(temperature * 0.3).toFixed(1)}%)`);
    } else {
      filters.push(`hue-rotate(${(temperature * 0.35).toFixed(1)}deg)`);
    }
  }

  if (tint !== 0) {
    filters.push(`hue-rotate(${(tint * 0.25).toFixed(1)}deg)`);
  }

  if (effects.grayscale > 0.5) {
    filters.push(`grayscale(${Math.min(100, effects.grayscale).toFixed(1)}%)`);
  }

  if (effects.sepia > 0.5) {
    filters.push(`sepia(${Math.min(100, effects.sepia).toFixed(1)}%)`);
  }

  const blurEffect = videoEffects?.find((e) => e.enabled && e.type === 'gaussian-blur');
  const blurRadius = blurEffect ? (blurEffect.params as { radiusPx: number }).radiusPx : effects.blur;
  if (blurRadius > 0.1) {
    filters.push(`blur(${blurRadius.toFixed(1)}px)`);
  }

  return filters.length > 0 ? filters.join(' ') : 'none';
}

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(cleaned.slice(0, 2), 16) || 0;
  const g = parseInt(cleaned.slice(2, 4), 16) || 0;
  const b = parseInt(cleaned.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function measureTrackedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  trackingPx: number
): number {
  if (text.length === 0) return 0;
  if (Math.abs(trackingPx) < 0.2) {
    return ctx.measureText(text).width;
  }
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    total += ctx.measureText(text[i]).width;
    if (i < text.length - 1) total += trackingPx;
  }
  return total;
}

function drawTrackedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: 'left' | 'center' | 'right',
  trackingPx: number,
  mode: 'fill' | 'stroke',
  arrowOffsetPx = 0
): void {
  if (Math.abs(trackingPx) < 0.2 && Math.abs(arrowOffsetPx) < 0.2) {
    ctx.textAlign = align;
    if (mode === 'fill') ctx.fillText(text, x, y);
    else ctx.strokeText(text, x, y);
    return;
  }

  const lineWidth = measureTrackedLine(ctx, text, trackingPx);
  let cursorX = x;
  if (align === 'center') cursorX = x - lineWidth / 2;
  else if (align === 'right') cursorX = x - lineWidth;

  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const extraX = ch === '→' ? arrowOffsetPx : 0;
    if (mode === 'fill') ctx.fillText(ch, cursorX + extraX, y);
    else ctx.strokeText(ch, cursorX + extraX, y);
    cursorX += ctx.measureText(ch).width + trackingPx;
  }
  ctx.textAlign = prevAlign;
}

function appendRoundedRectSubpath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  if (radius <= 0.5) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  appendRoundedRectSubpath(ctx, x, y, w, h, r);
}

function applyClipMask(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  transform: ReturnType<typeof evaluateClipTransform>,
  layerW: number,
  layerH: number,
  scaleFactor: number
) {
  const mask = clip.mask;
  if (!mask || mask.shape === 'none') return;

  const exp = (mask.expansion || 0) * scaleFactor;
  const cx = (transform.maskX / 100) * layerW;
  const cy = (transform.maskY / 100) * layerH;
  const mw = Math.max(0, (transform.maskWidth / 100) * layerW + exp * 2);
  const mh = Math.max(0, (transform.maskHeight / 100) * layerH + exp * 2);
  const rad = (mask.radius || 0) * scaleFactor;
  const rotRad = ((mask.rotation || 0) * Math.PI) / 180;

  ctx.beginPath();
  if (mask.invert) {
    const pad = Math.max(layerW, layerH) * 2;
    ctx.rect(-pad, -pad, pad * 2, pad * 2);
  }

  if (mask.shape === 'rectangle') {
    if (Math.abs(rotRad) > 0.001) {
      // Polygon points for rotated rectangle mask
      const hw = mw / 2;
      const hh = mh / 2;
      const cos = Math.cos(rotRad);
      const sin = Math.sin(rotRad);
      const pts = [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
      ].map(([px, py]) => [cx + px * cos - py * sin, cy + px * sin + py * cos]);
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.lineTo(pts[3][0], pts[3][1]);
      ctx.closePath();
    } else {
      appendRoundedRectSubpath(ctx, cx - mw / 2, cy - mh / 2, mw, mh, rad);
    }
  } else if (mask.shape === 'ellipse') {
    ctx.ellipse(
      cx,
      cy,
      Math.max(0.5, mw / 2),
      Math.max(0.5, mh / 2),
      rotRad,
      0,
      Math.PI * 2
    );
  } else if (mask.shape === 'circle') {
    const circleR = Math.max(
      0.5,
      (Math.min(layerW, layerH) / 2) * (transform.maskWidth / 100) + exp
    );
    ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
  } else if (mask.shape === 'linear-wipe') {
    const wipeRatio = Math.max(0, Math.min(1, transform.maskWidth / 100));
    const wipeW = Math.max(0, layerW * wipeRatio + exp);
    appendRoundedRectSubpath(
      ctx,
      -layerW / 2 + cx,
      -layerH / 2 + cy - Math.abs(exp),
      wipeW,
      layerH + Math.abs(exp) * 2,
      rad
    );
  } else if (mask.shape === 'radial-reveal') {
    const sweepRatio = Math.max(0, Math.min(1, transform.maskWidth / 100));
    const maxR = Math.hypot(layerW, layerH) + Math.abs(exp);
    const startAngle = -Math.PI / 2 + rotRad;
    const endAngle = startAngle + sweepRatio * Math.PI * 2;
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, startAngle, endAngle);
    ctx.closePath();
  }

  if (mask.invert) {
    ctx.clip('evenodd');
  } else {
    ctx.clip();
  }
}

function drawStaggeredLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: 'left' | 'center' | 'right',
  trackingPx: number,
  mode: 'fill' | 'stroke',
  staggerMode: 'char-stagger' | 'word-stagger',
  localTime: number,
  animDur: number,
  scaleFactor: number,
  baseAlpha: number
): void {
  const lineWidth = measureTrackedLine(ctx, text, trackingPx);
  let cursorX = x;
  if (align === 'center') cursorX = x - lineWidth / 2;
  else if (align === 'right') cursorX = x - lineWidth;

  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';

  if (staggerMode === 'char-stagger') {
    const count = Math.max(1, text.length);
    const stepDur = (animDur * 0.55) / count;
    const itemDur = Math.max(0.12, animDur * 0.55);

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const chW = ctx.measureText(ch).width;
      const rawP = Math.max(0, Math.min(1, (localTime - i * stepDur) / itemDur));
      const p = evaluateCubicBezier(rawP, 0.16, 1.0, 0.3, 1.0);

      if (p > 0.005) {
        ctx.save();
        ctx.globalAlpha = baseAlpha * p;
        const slideY = (1 - p) * 36 * scaleFactor;
        const charScale = 0.86 + 0.14 * p;
        ctx.translate(cursorX + chW / 2, y + slideY);
        ctx.scale(charScale, charScale);
        if (mode === 'fill') ctx.fillText(ch, -chW / 2, 0);
        else ctx.strokeText(ch, -chW / 2, 0);
        ctx.restore();
      }
      cursorX += chW + trackingPx;
    }
  } else {
    // word-stagger: split preserving whitespace tokens
    const tokens = text.split(/(\s+)/);
    const wordsOnlyCount = Math.max(
      1,
      tokens.filter((t) => t.trim().length > 0).length
    );
    const stepDur = (animDur * 0.55) / wordsOnlyCount;
    const itemDur = Math.max(0.15, animDur * 0.6);
    let wordIdx = 0;

    for (const tok of tokens) {
      const tokW = measureTrackedLine(ctx, tok, trackingPx);
      if (tok.trim().length === 0) {
        cursorX += tokW + trackingPx * tok.length;
        continue;
      }
      const rawP = Math.max(
        0,
        Math.min(1, (localTime - wordIdx * stepDur) / itemDur)
      );
      const p = evaluateCubicBezier(rawP, 0.16, 1.0, 0.3, 1.0);
      wordIdx++;

      if (p > 0.005) {
        ctx.save();
        ctx.globalAlpha = baseAlpha * p;
        const slideY = (1 - p) * 44 * scaleFactor;
        drawTrackedLine(
          ctx,
          tok,
          cursorX,
          y + slideY,
          'left',
          trackingPx,
          mode,
          0
        );
        ctx.restore();
      }
      cursorX += tokW + trackingPx;
    }
  }

  ctx.textAlign = prevAlign;
}

function drawProceduralShapeLayer(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  transform: ReturnType<typeof evaluateClipTransform>,
  localTime: number,
  scaleFactor: number,
  standaloneWipeProgress: number
): void {
  const style = clip.shapeStyle;
  if (!style) return;

  const w = Math.max(4, style.width * scaleFactor);
  const h = Math.max(4, style.height * scaleFactor);
  const r = Math.max(0, (style.cornerRadius || 0) * scaleFactor);
  const trimRatio = Math.max(
    0,
    Math.min(1, (transform.trimEnd / 100) * standaloneWipeProgress)
  );
  const trimStartRatio = Math.max(0, Math.min(0.99, (style.trimStart || 0) / 100));
  const activeTrim = Math.max(0, trimRatio - trimStartRatio);
  const strokeW = Math.max(0, style.strokeWidth * scaleFactor);
  const accent = style.accentColor || '#C8FF20';

  applyClipMask(ctx, clip, transform, w * 1.15, h * 1.15, scaleFactor);

  if (style.shapeType === 'rectangle') {
    drawRoundedRectPath(ctx, -w / 2, -h / 2, w, h, r);
    if (style.fillOpacity > 0.005) {
      ctx.fillStyle = hexToRgba(style.fillColor, style.fillOpacity);
      ctx.fill();
    }
    if (strokeW > 0 && activeTrim > 0.002) {
      const perim = 2 * (w + h);
      ctx.save();
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = strokeW;
      if (activeTrim < 0.998) {
        ctx.setLineDash([perim * activeTrim, perim]);
        ctx.lineDashOffset = -perim * trimStartRatio;
      }
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  if (style.shapeType === 'circle' || style.shapeType === 'ring') {
    const rad = Math.min(w, h) / 2;
    const startAngle = -Math.PI / 2 + trimStartRatio * Math.PI * 2;
    const endAngle = startAngle + activeTrim * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(0, 0, rad, startAngle, endAngle);
    if (style.shapeType === 'circle' && style.fillOpacity > 0.005) {
      ctx.fillStyle = hexToRgba(style.fillColor, style.fillOpacity);
      ctx.fill();
    }
    if (strokeW > 0 && activeTrim > 0.002) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = strokeW;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    if (style.shapeType === 'ring' && style.sides && style.sides > 0) {
      const tickCount = Math.min(72, style.sides);
      const visibleTicks = Math.floor(tickCount * activeTrim);
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.5, strokeW * 0.65);
      for (let i = 0; i < visibleTicks; i++) {
        const a = -Math.PI / 2 + (i / tickCount) * Math.PI * 2;
        const innerR = rad * 0.9;
        const outerR = i % 4 === 0 ? rad * 1.06 : rad * 0.98;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
        ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
        ctx.stroke();
      }
      ctx.restore();
    }
    return;
  }

  if (style.shapeType === 'line') {
    const x1 = -w / 2 + w * trimStartRatio;
    const x2 = -w / 2 + w * trimRatio;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, 0);
    ctx.lineTo(x2, 0);
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = Math.max(1.5, strokeW || h);
    ctx.lineCap = 'square';
    ctx.stroke();
    if (style.cornerRadius && style.cornerRadius > 0 && activeTrim > 0.02) {
      const capR = style.cornerRadius * scaleFactor;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x2, 0, capR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (style.shapeType === 'polygon') {
    const sides = Math.max(3, Math.min(24, style.sides || 6));
    const rad = Math.min(w, h) / 2;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = -Math.PI / 2 + (i / sides) * Math.PI * 2;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (style.fillOpacity > 0.005) {
      ctx.fillStyle = hexToRgba(style.fillColor, style.fillOpacity);
      ctx.fill();
    }
    if (strokeW > 0 && activeTrim > 0.002) {
      const perim = sides * 2 * rad * Math.sin(Math.PI / sides);
      ctx.save();
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = strokeW;
      if (activeTrim < 0.998) {
        ctx.setLineDash([perim * activeTrim, perim]);
      }
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  if (style.shapeType === 'crosshair') {
    const rad = Math.min(w, h) / 2;
    const arm = rad * activeTrim;
    ctx.save();
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = Math.max(1.5, strokeW);
    ctx.beginPath();
    ctx.moveTo(-arm, 0);
    ctx.lineTo(arm, 0);
    ctx.moveTo(0, -arm);
    ctx.lineTo(0, arm);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.45 * activeTrim, 0, Math.PI * 2);
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (style.shapeType === 'grid') {
    const cols = Math.max(1, style.gridCols || 6);
    const rows = Math.max(1, style.gridRows || 6);
    ctx.save();
    if (style.fillOpacity > 0.005) {
      ctx.fillStyle = hexToRgba(style.fillColor, style.fillOpacity);
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = Math.max(1, strokeW);
    const drawW = w * activeTrim;
    const drawH = h * activeTrim;
    for (let c = 0; c <= cols; c++) {
      const x = -w / 2 + (c / cols) * w;
      ctx.beginPath();
      ctx.moveTo(x, -h / 2);
      ctx.lineTo(x, -h / 2 + drawH);
      ctx.stroke();
    }
    for (let rIdx = 0; rIdx <= rows; rIdx++) {
      const y = -h / 2 + (rIdx / rows) * h;
      ctx.beginPath();
      ctx.moveTo(-w / 2, y);
      ctx.lineTo(-w / 2 + drawW, y);
      ctx.stroke();
    }
    // Draw Swiss registration crosses at interior intersections
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1.5, strokeW * 1.15);
    const crossArm = 5 * scaleFactor;
    for (let c = 1; c < cols; c += 2) {
      for (let rIdx = 1; rIdx < rows; rIdx += 2) {
        if (c / cols <= activeTrim && rIdx / rows <= activeTrim) {
          const ix = -w / 2 + (c / cols) * w;
          const iy = -h / 2 + (rIdx / rows) * h;
          ctx.beginPath();
          ctx.moveTo(ix - crossArm, iy);
          ctx.lineTo(ix + crossArm, iy);
          ctx.moveTo(ix, iy - crossArm);
          ctx.lineTo(ix, iy + crossArm);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    return;
  }

  if (style.shapeType === 'angora-chevron') {
    // Architectural Angora 'A' Ribbon / Chevron Vector Construction
    ctx.save();
    const hw = w / 2;
    const hh = h / 2;
    // Outer A contour + folded ribbon crossbar
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.lineTo(hw, hh);
    ctx.lineTo(hw * 0.56, hh);
    ctx.lineTo(0, -hh * 0.24);
    ctx.lineTo(-hw * 0.56, hh);
    ctx.lineTo(-hw, hh);
    ctx.closePath();

    if (style.fillOpacity > 0.005) {
      ctx.fillStyle = hexToRgba(style.fillColor, style.fillOpacity * activeTrim);
      ctx.fill();
    }
    if (strokeW > 0 && activeTrim > 0.002) {
      const perim = (w + h) * 3.2;
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = strokeW;
      ctx.lineJoin = 'miter';
      if (activeTrim < 0.998) {
        ctx.setLineDash([perim * activeTrim, perim]);
      }
      ctx.stroke();
    }

    // Dynamic diagonal ribbon bar across the A
    if (activeTrim > 0.25) {
      const barP = Math.min(1, (activeTrim - 0.25) / 0.75);
      ctx.beginPath();
      ctx.moveTo(-hw * 0.42, hh * 0.34);
      ctx.lineTo(-hw * 0.42 + hw * 1.15 * barP, hh * 0.34 - hh * 0.32 * barP);
      ctx.lineTo(-hw * 0.25 + hw * 1.15 * barP, hh * 0.58 - hh * 0.32 * barP);
      ctx.lineTo(-hw * 0.58, hh * 0.58);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(accent, Math.min(1, style.fillOpacity + 0.35) * barP);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (style.shapeType === 'browser-world') {
    // SEQUENCE 03A: WEB DESIGN — Interactive Swiss Browser & UI Architecture World
    ctx.save();
    const x0 = -w / 2;
    const y0 = -h / 2;
    drawRoundedRectPath(ctx, x0, y0, w, h, r || 20 * scaleFactor);
    ctx.fillStyle = hexToRgba(style.fillColor || '#0E150F', style.fillOpacity);
    ctx.fill();
    ctx.strokeStyle = style.strokeColor || '#D7E83F';
    ctx.lineWidth = Math.max(2, strokeW);
    ctx.stroke();

    // Top browser chrome bar
    const headerH = h * 0.09;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + headerH);
    ctx.lineTo(x0 + w * activeTrim, y0 + headerH);
    ctx.strokeStyle = hexToRgba(style.strokeColor || '#D7E83F', 0.55);
    ctx.stroke();

    // Traffic dots
    const dotColors = ['#D7E83F', '#C8FF20', '#384D3B'];
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(
        x0 + (28 + i * 22) * scaleFactor,
        y0 + headerH / 2,
        6 * scaleFactor,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = dotColors[i];
      ctx.fill();
    }

    // URL omnibar pill
    const barW = w * 0.54 * activeTrim;
    drawRoundedRectPath(
      ctx,
      -barW / 2,
      y0 + headerH * 0.22,
      barW,
      headerH * 0.56,
      10 * scaleFactor
    );
    ctx.fillStyle = 'rgba(23, 32, 24, 0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(215, 232, 63, 0.45)';
    ctx.lineWidth = 1.5 * scaleFactor;
    ctx.stroke();

    // 12-Column responsive wireframe grid lines
    const bodyY = y0 + headerH;
    const bodyH = h - headerH;
    ctx.strokeStyle = 'rgba(215, 232, 63, 0.11)';
    ctx.lineWidth = 1 * scaleFactor;
    for (let c = 1; c < 6; c++) {
      const gx = x0 + (c / 6) * w;
      ctx.beginPath();
      ctx.moveTo(gx, bodyY);
      ctx.lineTo(gx, bodyY + bodyH * activeTrim);
      ctx.stroke();
    }

    // Hero UI module (animated split container)
    const pad = w * 0.06;
    const heroH = bodyH * 0.44 * activeTrim;
    drawRoundedRectPath(
      ctx,
      x0 + pad,
      bodyY + pad,
      w - pad * 2,
      heroH,
      14 * scaleFactor
    );
    ctx.fillStyle = 'rgba(23, 32, 24, 0.88)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2 * scaleFactor;
    ctx.stroke();

    // Hero animated lime visual showcase block on right side of hero
    const previewCardW = (w - pad * 2) * 0.38 * activeTrim;
    drawRoundedRectPath(
      ctx,
      x0 + w - pad * 1.5 - previewCardW,
      bodyY + pad * 1.45,
      previewCardW,
      Math.max(8, heroH - pad * 0.9),
      10 * scaleFactor
    );
    ctx.fillStyle = hexToRgba('#D7E83F', 0.18);
    ctx.fill();
    ctx.strokeStyle = '#D7E83F';
    ctx.stroke();

    // 3 modular bento UI cards in lower viewport
    const cardY = bodyY + pad * 1.8 + heroH;
    const cardH = bodyH * 0.32 * activeTrim;
    const gap = pad * 0.55;
    const cardW = (w - pad * 2 - gap * 2) / 3;
    for (let i = 0; i < 3; i++) {
      const stagger = Math.max(0, Math.min(1, (activeTrim - i * 0.12) / 0.7));
      if (stagger <= 0.01) continue;
      const cx = x0 + pad + i * (cardW + gap);
      const cy = cardY + (1 - stagger) * 28 * scaleFactor;
      drawRoundedRectPath(ctx, cx, cy, cardW, cardH * stagger, 12 * scaleFactor);
      ctx.fillStyle = i === 1 ? 'rgba(215, 232, 63, 0.16)' : 'rgba(18, 26, 19, 0.95)';
      ctx.fill();
      ctx.strokeStyle = i === 1 ? '#C8FF20' : 'rgba(215, 232, 63, 0.42)';
      ctx.lineWidth = (i === 1 ? 2.4 : 1.5) * scaleFactor;
      ctx.stroke();

      // Metric bar inside card
      ctx.fillStyle = i === 1 ? '#C8FF20' : '#D7E83F';
      ctx.fillRect(
        cx + 16 * scaleFactor,
        cy + 20 * scaleFactor,
        (cardW - 32 * scaleFactor) * (0.55 + 0.18 * i) * stagger,
        8 * scaleFactor
      );
    }
    ctx.restore();
    return;
  }

  if (style.shapeType === 'poster-world') {
    // SEQUENCE 03B: GRAPHIC DESIGN — Swiss Editorial Poster & Dynamic Grid Canvas
    ctx.save();
    const x0 = -w / 2;
    const y0 = -h / 2;
    drawRoundedRectPath(ctx, x0, y0, w, h, r || 12 * scaleFactor);
    ctx.fillStyle = hexToRgba(style.fillColor || '#121913', style.fillOpacity);
    ctx.fill();
    ctx.strokeStyle = style.strokeColor || '#D7E83F';
    ctx.lineWidth = Math.max(2, strokeW);
    ctx.stroke();

    // Asymmetric Swiss grid divisions
    const splitX = x0 + w * 0.34;
    const splitY1 = y0 + h * 0.28;
    const splitY2 = y0 + h * 0.68;
    ctx.strokeStyle = 'rgba(215, 232, 63, 0.55)';
    ctx.lineWidth = 2 * scaleFactor;
    ctx.beginPath();
    ctx.moveTo(splitX, y0);
    ctx.lineTo(splitX, y0 + h * activeTrim);
    ctx.moveTo(x0, splitY1);
    ctx.lineTo(x0 + w * activeTrim, splitY1);
    ctx.moveTo(x0, splitY2);
    ctx.lineTo(x0 + w * activeTrim, splitY2);
    ctx.stroke();

    // High-contrast Lime geometric color block in top-left quadrant
    ctx.fillStyle = hexToRgba('#D7E83F', 0.92 * activeTrim);
    ctx.fillRect(
      x0 + 14 * scaleFactor,
      y0 + 14 * scaleFactor,
      (w * 0.34 - 28 * scaleFactor) * activeTrim,
      (h * 0.28 - 28 * scaleFactor)
    );

    // Rotating Bauhaus / Swiss geometric rings & diagonal slash in center-right field
    const geoCX = x0 + w * 0.67;
    const geoCY = y0 + h * 0.48;
    const geoR = Math.min(w, h) * 0.23 * activeTrim;
    ctx.save();
    ctx.translate(geoCX, geoCY);
    ctx.rotate(localTime * 0.85);
    ctx.strokeStyle = '#C8FF20';
    ctx.lineWidth = 3 * scaleFactor;
    ctx.beginPath();
    ctx.arc(0, 0, geoR, 0, Math.PI * 1.65);
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, geoR * 0.62, Math.PI * 0.2, Math.PI * 1.85);
    ctx.stroke();
    ctx.fillStyle = '#D7E83F';
    ctx.beginPath();
    ctx.moveTo(0, -geoR * 0.42);
    ctx.lineTo(geoR * 0.38, geoR * 0.32);
    ctx.lineTo(-geoR * 0.38, geoR * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Lower Swiss editorial kinetic bars
    for (let i = 0; i < 4; i++) {
      const bw = w * (0.82 - i * 0.14) * activeTrim;
      ctx.fillStyle = i === 0 ? '#FFFFFF' : i === 1 ? '#D7E83F' : 'rgba(255,255,255,0.35)';
      ctx.fillRect(
        x0 + 28 * scaleFactor,
        splitY2 + (32 + i * 34) * scaleFactor,
        bw,
        (i === 0 ? 18 : 10) * scaleFactor
      );
    }
    ctx.restore();
    return;
  }

  if (style.shapeType === 'timeline-world') {
    // SEQUENCE 03C: VIDEO EDITING — Stylized MotionLab Multi-Track NLE Timeline & Scopes
    ctx.save();
    const x0 = -w / 2;
    const y0 = -h / 2;
    drawRoundedRectPath(ctx, x0, y0, w, h, r || 18 * scaleFactor);
    ctx.fillStyle = hexToRgba(style.fillColor || '#0C120D', style.fillOpacity);
    ctx.fill();
    ctx.strokeStyle = style.strokeColor || '#D7E83F';
    ctx.lineWidth = Math.max(2, strokeW);
    ctx.stroke();

    // Upper Program Monitor & Vectorscope split
    const monitorH = h * 0.38;
    const pad = 22 * scaleFactor;
    drawRoundedRectPath(
      ctx,
      x0 + pad,
      y0 + pad,
      w - pad * 2,
      monitorH - pad,
      12 * scaleFactor
    );
    ctx.fillStyle = 'rgba(18, 27, 19, 0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(215, 232, 63, 0.45)';
    ctx.lineWidth = 1.8 * scaleFactor;
    ctx.stroke();

    // Animated Bezier Speed Curve inside upper monitor
    ctx.beginPath();
    const curveX0 = x0 + pad * 2;
    const curveW = w - pad * 4;
    const curveY0 = y0 + monitorH - pad * 1.4;
    const curveH = monitorH * 0.58;
    ctx.moveTo(curveX0, curveY0);
    ctx.bezierCurveTo(
      curveX0 + curveW * 0.22,
      curveY0,
      curveX0 + curveW * 0.32,
      curveY0 - curveH,
      curveX0 + curveW * activeTrim,
      curveY0 - curveH * activeTrim
    );
    ctx.strokeStyle = '#C8FF20';
    ctx.lineWidth = 3.5 * scaleFactor;
    ctx.stroke();

    // 5 NLE Timeline Tracks with Clips & Keyframe Diamonds
    const tracksTop = y0 + monitorH + pad * 0.6;
    const trackH = (h - monitorH - pad * 2.2) / 5;
    const clipSpecs = [
      { start: 0.04, len: 0.48, color: '#D7E83F', kfs: [0.12, 0.38] },
      { start: 0.22, len: 0.56, color: '#C8FF20', kfs: [0.28, 0.52, 0.7] },
      { start: 0.08, len: 0.78, color: '#283C2B', kfs: [0.2, 0.45, 0.68] },
      { start: 0.34, len: 0.52, color: '#D7E83F', kfs: [0.42, 0.74] },
      { start: 0.02, len: 0.92, color: '#1B2B1E', kfs: [] }, // Audio waveform track
    ];

    for (let t = 0; t < 5; t++) {
      const ty = tracksTop + t * trackH;
      // Track lane background
      ctx.fillStyle = 'rgba(17, 24, 18, 0.9)';
      ctx.fillRect(x0 + pad, ty, w - pad * 2, trackH * 0.78);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1 * scaleFactor;
      ctx.strokeRect(x0 + pad, ty, w - pad * 2, trackH * 0.78);

      const spec = clipSpecs[t];
      const clipX = x0 + pad + (w - pad * 2) * spec.start;
      const clipW = (w - pad * 2) * spec.len * activeTrim;
      drawRoundedRectPath(ctx, clipX, ty + 3 * scaleFactor, clipW, trackH * 0.78 - 6 * scaleFactor, 6 * scaleFactor);
      ctx.fillStyle = spec.color;
      ctx.fill();

      // Keyframe diamonds on clip
      for (const kf of spec.kfs) {
        if (kf <= activeTrim) {
          const kx = x0 + pad + (w - pad * 2) * kf;
          const ky = ty + trackH * 0.39;
          const dSize = 7 * scaleFactor;
          ctx.save();
          ctx.translate(kx, ky);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = t < 2 ? '#0B0F0B' : '#C8FF20';
          ctx.fillRect(-dSize / 2, -dSize / 2, dSize, dSize);
          ctx.restore();
        }
      }

      // Audio waveform bars on track 5
      if (t === 4) {
        const barCount = 36;
        const availW = (w - pad * 2) * activeTrim;
        ctx.fillStyle = '#D7E83F';
        for (let b = 0; b < barCount; b++) {
          const bx = x0 + pad + (b / barCount) * availW;
          const amp = (0.25 + 0.65 * Math.abs(Math.sin(b * 0.7 + localTime * 8))) * (trackH * 0.62);
          ctx.fillRect(bx, ty + trackH * 0.39 - amp / 2, 4 * scaleFactor, amp);
        }
      }
    }

    // Sweeping Playhead Line across all tracks
    const playheadNorm = 0.18 + ((localTime * 0.52) % 0.72);
    const playheadX = x0 + pad + (w - pad * 2) * playheadNorm;
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3 * scaleFactor;
    ctx.beginPath();
    ctx.moveTo(playheadX, tracksTop - 12 * scaleFactor);
    ctx.lineTo(playheadX, y0 + h - pad);
    ctx.stroke();
    ctx.fillStyle = '#C8FF20';
    ctx.beginPath();
    ctx.moveTo(playheadX - 10 * scaleFactor, tracksTop - 16 * scaleFactor);
    ctx.lineTo(playheadX + 10 * scaleFactor, tracksTop - 16 * scaleFactor);
    ctx.lineTo(playheadX, tracksTop - 2 * scaleFactor);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
    return;
  }

  if (style.shapeType === 'node-world') {
    // SEQUENCE 03D: WEB DEVELOPMENT & AUTOMATION — Connected Node Pipeline & Code Architecture
    ctx.save();
    const x0 = -w / 2;
    const y0 = -h / 2;
    drawRoundedRectPath(ctx, x0, y0, w, h, r || 18 * scaleFactor);
    ctx.fillStyle = hexToRgba(style.fillColor || '#0D140E', style.fillOpacity);
    ctx.fill();
    ctx.strokeStyle = style.strokeColor || '#D7E83F';
    ctx.lineWidth = Math.max(2, strokeW);
    ctx.stroke();

    const nodes = [
      { nx: -0.30, ny: -0.30 },
      { nx: 0.28, ny: -0.30 },
      { nx: -0.32, ny: 0.02 },
      { nx: 0.0, ny: 0.02 },
      { nx: 0.32, ny: 0.02 },
      { nx: 0.0, ny: 0.32 },
    ];
    const edges = [
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 4],
      [2, 5],
      [3, 5],
      [4, 5],
    ];

    // Draw cubic execution conduits & traveling data pulses
    for (let eIdx = 0; eIdx < edges.length; eIdx++) {
      const [a, b] = edges[eIdx];
      const ax = nodes[a].nx * w;
      const ay = nodes[a].ny * h;
      const bx = nodes[b].nx * w;
      const by = nodes[b].ny * h;
      const cpx1 = ax;
      const cpy1 = (ay + by) / 2;
      const cpx2 = bx;
      const cpy2 = (ay + by) / 2;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, bx, by);
      ctx.strokeStyle = 'rgba(215, 232, 63, 0.42)';
      ctx.lineWidth = 2.5 * scaleFactor;
      ctx.stroke();

      // Traveling autonomous execution pulse dot
      const pulseT = ((localTime * 1.15 + eIdx * 0.19) % 1) * activeTrim;
      const invT = 1 - pulseT;
      const px =
        invT * invT * invT * ax +
        3 * invT * invT * pulseT * cpx1 +
        3 * invT * pulseT * pulseT * cpx2 +
        pulseT * pulseT * pulseT * bx;
      const py =
        invT * invT * invT * ay +
        3 * invT * invT * pulseT * cpy1 +
        3 * invT * pulseT * pulseT * cpy2 +
        pulseT * pulseT * pulseT * by;
      ctx.beginPath();
      ctx.arc(px, py, 6.5 * scaleFactor, 0, Math.PI * 2);
      ctx.fillStyle = '#C8FF20';
      ctx.fill();
    }

    // Draw modular automation nodes
    const nw = w * 0.24 * activeTrim;
    const nh = h * 0.12 * activeTrim;
    for (let i = 0; i < nodes.length; i++) {
      const nx = nodes[i].nx * w - nw / 2;
      const ny = nodes[i].ny * h - nh / 2;
      const isCore = i === 3 || i === 5;
      drawRoundedRectPath(ctx, nx, ny, nw, nh, 10 * scaleFactor);
      ctx.fillStyle = isCore ? '#D7E83F' : '#152017';
      ctx.fill();
      ctx.strokeStyle = isCore ? '#FFFFFF' : '#D7E83F';
      ctx.lineWidth = (isCore ? 2.8 : 1.8) * scaleFactor;
      ctx.stroke();

      // Status indicator bar inside node
      ctx.fillStyle = isCore ? '#0B0F0B' : '#C8FF20';
      ctx.fillRect(
        nx + 14 * scaleFactor,
        ny + nh * 0.42,
        nw - 28 * scaleFactor,
        6 * scaleFactor
      );
    }
    ctx.restore();
    return;
  }

  if (style.shapeType === 'explosion-lattice') {
    // SEQUENCE 04: THE CREATIVE EXPLOSION — 2.5D Perspective Geometric Convergence Lattice
    ctx.save();
    const maxR = (Math.min(w, h) / 2) * activeTrim;
    // Convergence factor: expands violently 0..2.4s, then locks & converges into the Angora A geometry 2.4..5.0s
    const convergeP =
      localTime > 2.4
        ? evaluateCubicBezier(Math.min(1, (localTime - 2.4) / 1.8), 0.16, 1.0, 0.3, 1.0)
        : 0;
    const spreadMultiplier = 1 - convergeP * 0.58;

    // Nested rotating geometric rings & polygons
    for (let ring = 1; ring <= 4; ring++) {
      const rr = maxR * (ring / 4) * spreadMultiplier;
      const rot = localTime * (ring % 2 === 0 ? 0.9 : -1.15) * (1 - convergeP * 0.8);
      ctx.save();
      ctx.rotate(rot);
      ctx.strokeStyle = ring % 2 === 0 ? '#C8FF20' : '#D7E83F';
      ctx.lineWidth = (ring === 4 ? 3.2 : 1.8) * scaleFactor;
      ctx.beginPath();
      const sides = ring === 1 ? 3 : ring === 2 ? 6 : ring === 3 ? 8 : 12;
      for (let s = 0; s <= sides; s++) {
        const a = -Math.PI / 2 + (s / sides) * Math.PI * 2;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Orbiting lime geometric plates that snap into the Angora Chevron alignment
    const shardCount = 12;
    for (let i = 0; i < shardCount; i++) {
      const baseAngle = -Math.PI / 2 + (i / shardCount) * Math.PI * 2;
      const orbitAngle = baseAngle + localTime * 1.1 * (1 - convergeP);
      const orbitDist = maxR * (0.35 + (i % 3) * 0.24) * spreadMultiplier;
      // Target A-chevron positions when converging
      const tNorm = i / (shardCount - 1);
      const targetX = (tNorm - 0.5) * maxR * 0.95;
      const targetY = Math.abs(tNorm - 0.5) * 2 * maxR * 0.85 - maxR * 0.42;

      const sx =
        Math.cos(orbitAngle) * orbitDist * (1 - convergeP) + targetX * convergeP;
      const sy =
        Math.sin(orbitAngle) * orbitDist * (1 - convergeP) + targetY * convergeP;
      const plateW = (44 + (i % 3) * 22) * scaleFactor;
      const plateH = (14 + (i % 2) * 12) * scaleFactor;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(orbitAngle * (1 - convergeP));
      ctx.fillStyle = i % 3 === 0 ? '#FFFFFF' : i % 2 === 0 ? '#C8FF20' : '#D7E83F';
      ctx.fillRect(-plateW / 2, -plateH / 2, plateW, plateH);
      ctx.restore();
    }
    ctx.restore();
  }
}

function renderSingleClipLayer(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  localTime: number,
  canvasWidth: number,
  canvasHeight: number,
  mediaSources: MediaElementSource,
  extraOpacityMultiplier = 1,
  extraTranslateX = 0,
  clippingRegion?: { x: number; y: number; w: number; h: number },
  allClips?: TimelineClip[],
  timelineTime?: number,
  isMotionBlurSample = false
) {
  const transform = evaluateClipTransform(
    clip,
    localTime,
    allClips,
    timelineTime
  );
  // Normalize coordinates relative to the 1080p short-side reference dimension (1080 for 1080p, 720 for 720p)
  const scaleFactor = Math.min(canvasWidth, canvasHeight) / 1080;

  // Directional velocity Motion Blur sub-steps when clip.motionBlur is enabled
  if (clip.motionBlur && !isMotionBlurSample && localTime > 0.02) {
    const dt = 1 / 45;
    const prevTransform = evaluateClipTransform(
      clip,
      Math.max(0, localTime - dt),
      allClips,
      timelineTime !== undefined ? timelineTime - dt : undefined
    );
    const vx = (transform.x - prevTransform.x) * scaleFactor;
    const vy = (transform.y - prevTransform.y) * scaleFactor;
    if (Math.hypot(vx, vy) > 2.5) {
      renderSingleClipLayer(
        ctx,
        clip,
        Math.max(0, localTime - dt * 0.9),
        canvasWidth,
        canvasHeight,
        mediaSources,
        extraOpacityMultiplier * 0.16,
        extraTranslateX - vx * 0.35,
        clippingRegion,
        allClips,
        timelineTime !== undefined ? timelineTime - dt * 0.9 : undefined,
        true
      );
      renderSingleClipLayer(
        ctx,
        clip,
        Math.max(0, localTime - dt * 0.45),
        canvasWidth,
        canvasHeight,
        mediaSources,
        extraOpacityMultiplier * 0.26,
        extraTranslateX - vx * 0.16,
        clippingRegion,
        allClips,
        timelineTime !== undefined ? timelineTime - dt * 0.45 : undefined,
        true
      );
    }
  }

  // Transition fade-from-black / fade-to-black opacity adjustments
  let transitionBlackOverlay = 0;
  if (
    clip.transitionIn.type === 'fade-from-black' &&
    clip.transitionIn.duration > 0 &&
    localTime < clip.transitionIn.duration
  ) {
    const p = Math.max(0, Math.min(1, localTime / clip.transitionIn.duration));
    transitionBlackOverlay = Math.max(transitionBlackOverlay, 1 - p);
  }
  const timeRemaining = clip.duration - localTime;
  if (
    clip.transitionOut.type === 'fade-to-black' &&
    clip.transitionOut.duration > 0 &&
    timeRemaining < clip.transitionOut.duration &&
    timeRemaining >= 0
  ) {
    const p = Math.max(0, Math.min(1, timeRemaining / clip.transitionOut.duration));
    transitionBlackOverlay = Math.max(transitionBlackOverlay, 1 - p);
  }

  // Standalone progressive mask reveal when transitionIn is 'wipe-right' or 'slide-left'
  let standaloneWipeProgress = 1;
  if (
    !clippingRegion &&
    clip.transitionIn.type === 'wipe-right' &&
    clip.transitionIn.duration > 0 &&
    localTime < clip.transitionIn.duration
  ) {
    standaloneWipeProgress = evaluateEasing(
      Math.max(0, Math.min(1, localTime / clip.transitionIn.duration)),
      'ease-out'
    );
  }

  // Also support clip fadeIn / fadeOut for visual clips if set
  let visualFadeMultiplier = 1;
  if (clip.type !== 'audio') {
    if (clip.fadeIn > 0 && localTime < clip.fadeIn) {
      visualFadeMultiplier *= evaluateEasing(
        Math.max(0, Math.min(1, localTime / clip.fadeIn)),
        'ease-out'
      );
    }
    if (clip.fadeOut > 0 && timeRemaining < clip.fadeOut && timeRemaining >= 0) {
      visualFadeMultiplier *= evaluateEasing(
        Math.max(0, Math.min(1, timeRemaining / clip.fadeOut)),
        'ease-in'
      );
    }
  }

  const effectiveOpacity = Math.max(
    0,
    Math.min(1, transform.opacity * extraOpacityMultiplier * visualFadeMultiplier)
  );
  if (effectiveOpacity <= 0.001) return;

  ctx.save();

  if (clippingRegion) {
    ctx.beginPath();
    ctx.rect(clippingRegion.x, clippingRegion.y, clippingRegion.w, clippingRegion.h);
    ctx.clip();
  }

  const centerX = canvasWidth / 2 + transform.x * scaleFactor + extraTranslateX;
  const centerY = canvasHeight / 2 + transform.y * scaleFactor;

  ctx.translate(centerX, centerY);
  if (transform.rotation !== 0) {
    ctx.rotate((transform.rotation * Math.PI) / 180);
  }

  const flipX = clip.effects.flipH ? -1 : 1;
  const flipY = clip.effects.flipV ? -1 : 1;
  ctx.scale(transform.scale * flipX, transform.scale * flipY);

  if (Math.abs(transform.skewX) > 0.01 || Math.abs(transform.skewY) > 0.01) {
    const radSkewX = (transform.skewX * Math.PI) / 180;
    const radSkewY = (transform.skewY * Math.PI) / 180;
    ctx.transform(1, Math.tan(radSkewY), Math.tan(radSkewX), 1, 0, 0);
  }

  ctx.globalAlpha = effectiveOpacity;
  const filterStr = buildCanvasFilterString(clip.effects, clip.videoEffects);
  const featherBlur = clip.mask && clip.mask.shape !== 'none' && clip.mask.feather > 0.2
    ? `blur(${(clip.mask.feather * scaleFactor * 0.25).toFixed(1)}px)`
    : '';
  const combinedFilter = [filterStr !== 'none' ? filterStr : '', featherBlur]
    .filter(Boolean)
    .join(' ');
  if (combinedFilter) {
    ctx.filter = combinedFilter;
  }

  if (clip.shapeStyle) {
    drawProceduralShapeLayer(
      ctx,
      clip,
      transform,
      localTime,
      scaleFactor,
      standaloneWipeProgress
    );
  } else if (clip.type === 'video' || clip.type === 'image') {
    const sourceEl =
      clip.type === 'video'
        ? mediaSources.videoElements.get(clip.id) ||
          (clip.mediaId ? mediaSources.videoElements.get(clip.mediaId) : undefined)
        : clip.mediaId
          ? mediaSources.imageElements.get(clip.mediaId)
          : undefined;

    if (sourceEl) {
      const srcW =
        sourceEl instanceof HTMLVideoElement
          ? sourceEl.videoWidth || canvasWidth
          : sourceEl.naturalWidth || canvasWidth;
      const srcH =
        sourceEl instanceof HTMLVideoElement
          ? sourceEl.videoHeight || canvasHeight
          : sourceEl.naturalHeight || canvasHeight;

      if (srcW > 0 && srcH > 0) {
        // Fit source inside canvas preserving aspect ratio
        const scaleToFit = Math.min(canvasWidth / srcW, canvasHeight / srcH);
        const drawW = srcW * scaleToFit;
        const drawH = srcH * scaleToFit;

        const cropL = (clip.crop.left / 100) * drawW;
        const cropR = (clip.crop.right / 100) * drawW;
        const cropT = (clip.crop.top / 100) * drawH;
        const cropB = (clip.crop.bottom / 100) * drawH;

        const visibleW = Math.max(1, (drawW - cropL - cropR) * standaloneWipeProgress);
        const visibleH = Math.max(1, drawH - cropT - cropB);

        ctx.beginPath();
        ctx.rect(-drawW / 2 + cropL, -drawH / 2 + cropT, visibleW, visibleH);
        ctx.clip();

        applyClipMask(ctx, clip, transform, drawW, drawH, scaleFactor);

        ctx.drawImage(sourceEl, -drawW / 2, -drawH / 2, drawW, drawH);

        // Nondestructive Video FX overlays (Vignette)
        if (clip.videoEffects && clip.videoEffects.length > 0) {
          const vig = clip.videoEffects.find((e) => e.enabled && e.type === 'vignette');
          if (vig) {
            const p = vig.params as VignetteParams;
            const maxR = Math.sqrt((drawW * drawW + drawH * drawH) / 4) * (p.radius || 0.75);
            const inR = maxR * (1 - (p.feather || 0.5));
            const vigGrad = ctx.createRadialGradient(0, 0, Math.max(0, inR), 0, 0, maxR);
            vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
            vigGrad.addColorStop(1, `rgba(0,0,0,${Math.min(1.0, p.amount || 0.5)})`);
            ctx.save();
            ctx.fillStyle = vigGrad;
            ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
          }
        }
      }
    }
  } else if (clip.type === 'text' && clip.textStyle) {
    const style = clip.textStyle;
    const anim = evaluateTextAnimation(style, localTime, clip.duration);
    const animDur = Math.max(
      0.1,
      Math.min(clip.duration / 2, style.animationDuration || 0.5)
    );
    const isStaggerEntrance =
      (style.animationIn === 'char-stagger' ||
        style.animationIn === 'word-stagger') &&
      localTime < animDur;

    const baseTextAlpha = effectiveOpacity * anim.opacityMultiplier;
    ctx.globalAlpha = baseTextAlpha;
    ctx.translate(anim.offsetX * scaleFactor, anim.offsetY * scaleFactor);
    ctx.scale(anim.scaleMultiplier, anim.scaleMultiplier);

    const scaledFontSize = Math.max(10, Math.round(style.fontSize * scaleFactor));
    const trackingPx = ((style.letterSpacing || 0) + anim.letterSpacingOffset) * scaleFactor;
    ctx.font = `${style.fontWeight} ${scaledFontSize}px "${style.fontFamily}", Inter, sans-serif`;
    ctx.textBaseline = 'middle';

    const lines = anim.visibleText.split('\n');
    const lineHeight = scaledFontSize * 1.24;
    const totalHeight = lines.length * lineHeight;

    let maxLineWidth = 0;
    for (const line of lines) {
      const w = measureTrackedLine(ctx, line, trackingPx);
      if (w > maxLineWidth) maxLineWidth = w;
    }

    const maskPad = scaledFontSize * 1.5;
    const fullMaskW = maxLineWidth + maskPad * 2;
    const fullMaskH = totalHeight + maskPad * 2;

    if (standaloneWipeProgress < 0.999) {
      ctx.beginPath();
      ctx.rect(
        -fullMaskW / 2,
        -totalHeight / 2 - maskPad,
        fullMaskW * standaloneWipeProgress,
        fullMaskH
      );
      ctx.clip();
    }

    applyClipMask(ctx, clip, transform, fullMaskW, fullMaskH, scaleFactor);

    // Background plate (supports custom padding, borderRadius, and border stroke)
    if (style.backgroundOpacity > 0.01 || (style.borderWidth && style.borderWidth > 0)) {
      const padX =
        style.paddingX !== undefined
          ? style.paddingX * scaleFactor
          : scaledFontSize * 0.45;
      const padY =
        style.paddingY !== undefined
          ? style.paddingY * scaleFactor
          : scaledFontSize * 0.28;
      const boxX = -maxLineWidth / 2 - padX;
      const boxY = -totalHeight / 2 - padY;
      const boxW = maxLineWidth + padX * 2;
      const boxH = totalHeight + padY * 2;
      const radius = (style.borderRadius || 0) * scaleFactor;

      ctx.save();
      drawRoundedRectPath(ctx, boxX, boxY, boxW, boxH, radius);
      if (style.backgroundOpacity > 0.01) {
        ctx.fillStyle = hexToRgba(style.backgroundColor, style.backgroundOpacity);
        ctx.fill();
      }
      if (style.borderWidth && style.borderWidth > 0 && style.borderColor) {
        ctx.strokeStyle = style.borderColor;
        ctx.lineWidth = style.borderWidth * scaleFactor;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Shadow
    if (style.shadowBlur > 0) {
      ctx.shadowColor = style.shadowColor;
      ctx.shadowBlur = style.shadowBlur * scaleFactor;
      ctx.shadowOffsetX = 2 * scaleFactor;
      ctx.shadowOffsetY = 2 * scaleFactor;
    }

    const arrowWavePx =
      timeRemaining > 0.25
        ? Math.sin(localTime * 6.0) * 8 * scaleFactor
        : 4 * scaleFactor;

    const startY = -totalHeight / 2 + lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
      const lineY = startY + i * lineHeight;
      let lineX = 0;
      if (style.align === 'left') lineX = -maxLineWidth / 2;
      if (style.align === 'right') lineX = maxLineWidth / 2;

      if (style.strokeWidth > 0) {
        ctx.strokeStyle = style.strokeColor;
        ctx.lineWidth = style.strokeWidth * scaleFactor * 2;
        ctx.lineJoin = 'round';
        if (isStaggerEntrance) {
          drawStaggeredLine(
            ctx,
            lines[i],
            lineX,
            lineY,
            style.align,
            trackingPx,
            'stroke',
            style.animationIn as 'char-stagger' | 'word-stagger',
            localTime,
            animDur,
            scaleFactor,
            baseTextAlpha
          );
        } else {
          drawTrackedLine(
            ctx,
            lines[i],
            lineX,
            lineY,
            style.align,
            trackingPx,
            'stroke',
            arrowWavePx
          );
        }
      }

      ctx.fillStyle = style.color;
      if (isStaggerEntrance) {
        drawStaggeredLine(
          ctx,
          lines[i],
          lineX,
          lineY,
          style.align,
          trackingPx,
          'fill',
          style.animationIn as 'char-stagger' | 'word-stagger',
          localTime,
          animDur,
          scaleFactor,
          baseTextAlpha
        );
      } else {
        drawTrackedLine(
          ctx,
          lines[i],
          lineX,
          lineY,
          style.align,
          trackingPx,
          'fill',
          arrowWavePx
        );
      }
    }
  }

  ctx.restore();

  // Draw black fade overlay if fade-from-black or fade-to-black is active
  if (transitionBlackOverlay > 0.005 && !isMotionBlurSample) {
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${transitionBlackOverlay.toFixed(3)})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();
  }
}

export interface RenderCompositionOptions {
  showSafeGuides?: boolean;
  selectedClipId?: string | null;
}

/**
 * Renders the complete multitrack composition at `timelineTime` onto `ctx`.
 * Used by BOTH the live interactive Preview Canvas and the deterministic MP4 Export Pipeline.
 */
export function renderCompositionAtTime(
  ctx: CanvasRenderingContext2D,
  project: ProjectData,
  timelineTime: number,
  mediaSources: MediaElementSource,
  options: RenderCompositionOptions = {}
): void {
  const { width: canvasWidth, height: canvasHeight } = getResolutionDimensions(
    project.aspectRatio,
    project.resolution,
    project.customWidth,
    project.customHeight
  );

  if (ctx.canvas.width !== canvasWidth || ctx.canvas.height !== canvasHeight) {
    ctx.canvas.width = canvasWidth;
    ctx.canvas.height = canvasHeight;
  }

  // Clear composition frame to studio black
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.restore();

  const activeLayers = getCompositedVisualClipsAtTime(
    project.tracks,
    project.clips,
    timelineTime
  );

  for (const layer of activeLayers) {
    const { clip, localTime, outgoingTransition } = layer;

    if (outgoingTransition) {
      const { previousClip, previousLocalTime, transitionType, progress } =
        outgoingTransition;

      if (transitionType === 'cross-dissolve') {
        renderSingleClipLayer(
          ctx,
          previousClip,
          previousLocalTime,
          canvasWidth,
          canvasHeight,
          mediaSources,
          1 - progress,
          0,
          undefined,
          project.clips,
          timelineTime
        );
        renderSingleClipLayer(
          ctx,
          clip,
          localTime,
          canvasWidth,
          canvasHeight,
          mediaSources,
          progress,
          0,
          undefined,
          project.clips,
          timelineTime
        );
        continue;
      }

      if (transitionType === 'slide-left') {
        const prevOffsetX = -progress * canvasWidth;
        const currOffsetX = (1 - progress) * canvasWidth;
        renderSingleClipLayer(
          ctx,
          previousClip,
          previousLocalTime,
          canvasWidth,
          canvasHeight,
          mediaSources,
          1,
          prevOffsetX,
          undefined,
          project.clips,
          timelineTime
        );
        renderSingleClipLayer(
          ctx,
          clip,
          localTime,
          canvasWidth,
          canvasHeight,
          mediaSources,
          1,
          currOffsetX,
          undefined,
          project.clips,
          timelineTime
        );
        continue;
      }

      if (transitionType === 'wipe-right') {
        const easedProgress = evaluateEasing(progress, 'cubic-bezier');
        const splitX = easedProgress * canvasWidth;
        renderSingleClipLayer(
          ctx,
          previousClip,
          previousLocalTime,
          canvasWidth,
          canvasHeight,
          mediaSources,
          1,
          0,
          { x: splitX, y: 0, w: canvasWidth - splitX, h: canvasHeight },
          project.clips,
          timelineTime
        );
        renderSingleClipLayer(
          ctx,
          clip,
          localTime,
          canvasWidth,
          canvasHeight,
          mediaSources,
          1,
          0,
          { x: 0, y: 0, w: splitX, h: canvasHeight },
          project.clips,
          timelineTime
        );
        if (easedProgress > 0.02 && easedProgress < 0.98) {
          ctx.save();
          ctx.fillStyle = '#D7E83F';
          ctx.fillRect(Math.round(splitX) - 3, 0, 6, canvasHeight);
          ctx.restore();
        }
        continue;
      }
    }

    renderSingleClipLayer(
      ctx,
      clip,
      localTime,
      canvasWidth,
      canvasHeight,
      mediaSources,
      1,
      0,
      undefined,
      project.clips,
      timelineTime
    );
  }

  // Broadcast Safe-Area Guides (Action Safe 90%, Title Safe 80%, Center Crosshair)
  if (options.showSafeGuides) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = Math.max(1, canvasHeight / 540);
    ctx.setLineDash([6, 6]);

    // 90% Action Safe
    const actionMarginX = canvasWidth * 0.05;
    const actionMarginY = canvasHeight * 0.05;
    ctx.strokeRect(
      actionMarginX,
      actionMarginY,
      canvasWidth * 0.9,
      canvasHeight * 0.9
    );

    // 80% Title Safe
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    const titleMarginX = canvasWidth * 0.1;
    const titleMarginY = canvasHeight * 0.1;
    ctx.strokeRect(
      titleMarginX,
      titleMarginY,
      canvasWidth * 0.8,
      canvasHeight * 0.8
    );

    // Center crosshair
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(canvasWidth / 2 - 16, canvasHeight / 2);
    ctx.lineTo(canvasWidth / 2 + 16, canvasHeight / 2);
    ctx.moveTo(canvasWidth / 2, canvasHeight / 2 - 16);
    ctx.lineTo(canvasWidth / 2, canvasHeight / 2 + 16);
    ctx.stroke();
    ctx.restore();
  }
}
