import type {
  Keyframe,
  KeyframeEasing,
  KeyframeProperty,
  TextStyle,
  TimelineClip,
} from '../types/editor';

export function evaluateCubicBezier(
  t: number,
  x1 = 0.16,
  y1 = 1.0,
  x2 = 0.3,
  y2 = 1.0
): number {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0 || clamped >= 1) return clamped;

  const sampleCurveX = (u: number) =>
    ((1 - 3 * x2 + 3 * x1) * u * u * u) +
    ((3 * x2 - 6 * x1) * u * u) +
    (3 * x1 * u);
  const sampleCurveY = (u: number) =>
    ((1 - 3 * y2 + 3 * y1) * u * u * u) +
    ((3 * y2 - 6 * y1) * u * u) +
    (3 * y1 * u);
  const sampleDerivativeX = (u: number) =>
    (3 * (1 - 3 * x2 + 3 * x1) * u * u) +
    (2 * (3 * x2 - 6 * x1) * u) +
    (3 * x1);

  let u = clamped;
  for (let i = 0; i < 6; i++) {
    const xErr = sampleCurveX(u) - clamped;
    if (Math.abs(xErr) < 1e-5) break;
    const d = sampleDerivativeX(u);
    if (Math.abs(d) < 1e-5) break;
    u = Math.max(0, Math.min(1, u - xErr / d));
  }
  return sampleCurveY(u);
}

export function evaluateEasing(
  t: number,
  easing: KeyframeEasing,
  bezierPoints?: [number, number, number, number]
): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'linear':
      return clamped;
    case 'ease-in':
      return clamped * clamped;
    case 'ease-out':
      return 1 - (1 - clamped) * (1 - clamped);
    case 'ease-in-out':
      return clamped < 0.5
        ? 2 * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
    case 'cubic-bezier': {
      const [x1, y1, x2, y2] = bezierPoints ?? [0.16, 1.0, 0.3, 1.0];
      return evaluateCubicBezier(clamped, x1, y1, x2, y2);
    }
    case 'expo-out':
      return clamped === 1 ? 1 : 1 - Math.pow(2, -10 * clamped);
    case 'back-out': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2);
    }
  }
}

function getClipBasePropertyValue(
  clip: TimelineClip,
  property: KeyframeProperty
): number {
  switch (property) {
    case 'x':
      return clip.x;
    case 'y':
      return clip.y;
    case 'scale':
      return clip.scale;
    case 'rotation':
      return clip.rotation;
    case 'opacity':
      return clip.opacity;
    case 'maskWidth':
      return clip.mask?.width ?? 100;
    case 'maskHeight':
      return clip.mask?.height ?? 100;
    case 'maskX':
      return clip.mask?.centerX ?? 0;
    case 'maskY':
      return clip.mask?.centerY ?? 0;
    case 'trimEnd':
      return clip.shapeStyle?.trimEnd ?? 100;
    case 'skewX':
      return clip.skewX ?? 0;
    case 'skewY':
      return clip.skewY ?? 0;
  }
}

export function interpolateProperty(
  clip: TimelineClip,
  property: KeyframeProperty,
  clipLocalTime: number
): number {
  const propKeyframes = clip.keyframes
    .filter((kf) => kf.property === property)
    .sort((a, b) => a.time - b.time);

  const baseValue = getClipBasePropertyValue(clip, property);
  if (propKeyframes.length === 0) {
    return baseValue;
  }

  if (clipLocalTime <= propKeyframes[0].time) {
    return propKeyframes[0].value;
  }

  const last = propKeyframes[propKeyframes.length - 1];
  if (clipLocalTime >= last.time) {
    return last.value;
  }

  for (let i = 0; i < propKeyframes.length - 1; i++) {
    const startKf = propKeyframes[i];
    const endKf = propKeyframes[i + 1];
    if (clipLocalTime >= startKf.time && clipLocalTime <= endKf.time) {
      const span = endKf.time - startKf.time;
      if (span <= 1e-6) return endKf.value;
      const rawT = (clipLocalTime - startKf.time) / span;
      const easedT = evaluateEasing(rawT, endKf.easing, endKf.bezierPoints);
      return startKf.value + (endKf.value - startKf.value) * easedT;
    }
  }

  return baseValue;
}

export interface EvaluatedTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  maskWidth: number;
  maskHeight: number;
  maskX: number;
  maskY: number;
  trimEnd: number;
  skewX: number;
  skewY: number;
}

export function evaluateClipTransform(
  clip: TimelineClip,
  clipLocalTime: number,
  allClips?: TimelineClip[],
  timelineTime?: number,
  visitedIds: Set<string> = new Set()
): EvaluatedTransform {
  const local: EvaluatedTransform = {
    x: interpolateProperty(clip, 'x', clipLocalTime),
    y: interpolateProperty(clip, 'y', clipLocalTime),
    scale: Math.max(0.05, interpolateProperty(clip, 'scale', clipLocalTime)),
    rotation: interpolateProperty(clip, 'rotation', clipLocalTime),
    opacity: Math.max(0, Math.min(1, interpolateProperty(clip, 'opacity', clipLocalTime))),
    maskWidth: Math.max(0, Math.min(100, interpolateProperty(clip, 'maskWidth', clipLocalTime))),
    maskHeight: Math.max(0, Math.min(100, interpolateProperty(clip, 'maskHeight', clipLocalTime))),
    maskX: Math.max(-100, Math.min(100, interpolateProperty(clip, 'maskX', clipLocalTime))),
    maskY: Math.max(-100, Math.min(100, interpolateProperty(clip, 'maskY', clipLocalTime))),
    trimEnd: Math.max(0, Math.min(100, interpolateProperty(clip, 'trimEnd', clipLocalTime))),
    skewX: Math.max(-60, Math.min(60, interpolateProperty(clip, 'skewX', clipLocalTime))),
    skewY: Math.max(-60, Math.min(60, interpolateProperty(clip, 'skewY', clipLocalTime))),
  };

  if (clip.parentId && allClips && !visitedIds.has(clip.id)) {
    visitedIds.add(clip.id);
    const parent = allClips.find((c) => c.id === clip.parentId);
    if (parent) {
      const absTime = timelineTime ?? clip.startTime + clipLocalTime;
      const parentLocalTime = Math.max(
        0,
        Math.min(parent.duration, absTime - parent.startTime)
      );
      const p = evaluateClipTransform(
        parent,
        parentLocalTime,
        allClips,
        absTime,
        visitedIds
      );
      return {
        ...local,
        x: p.x + local.x * p.scale,
        y: p.y + local.y * p.scale,
        scale: local.scale * p.scale,
        rotation: local.rotation + p.rotation,
      };
    }
  }

  return local;
}

export function upsertKeyframe(
  keyframes: Keyframe[],
  property: KeyframeProperty,
  time: number,
  value: number,
  easing: KeyframeEasing = 'ease-in-out',
  tolerance = 0.03
): Keyframe[] {
  const clampedTime = Number(Math.max(0, time).toFixed(3));
  const existingIdx = keyframes.findIndex(
    (kf) => kf.property === property && Math.abs(kf.time - clampedTime) <= tolerance
  );

  if (existingIdx >= 0) {
    const next = [...keyframes];
    next[existingIdx] = {
      ...next[existingIdx],
      time: clampedTime,
      value,
      easing,
    };
    return next;
  }

  return [
    ...keyframes,
    {
      id: `kf-${property}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      property,
      time: clampedTime,
      value,
      easing,
    },
  ];
}

export interface EvaluatedTextAnimation {
  opacityMultiplier: number;
  offsetX: number;
  offsetY: number;
  scaleMultiplier: number;
  letterSpacingOffset: number;
  visibleText: string;
}

export function evaluateTextAnimation(
  textStyle: TextStyle,
  clipLocalTime: number,
  clipDuration: number
): EvaluatedTextAnimation {
  const animDur = Math.max(0.1, Math.min(clipDuration / 2, textStyle.animationDuration || 0.5));
  let opacityMultiplier = 1;
  let offsetX = 0;
  let offsetY = 0;
  let scaleMultiplier = 1;
  let letterSpacingOffset = 0;
  let visibleText = textStyle.content;

  // Entrance animation
  if (textStyle.animationIn !== 'none' && clipLocalTime < animDur) {
    const p = evaluateEasing(clipLocalTime / animDur, 'ease-out');
    switch (textStyle.animationIn) {
      case 'fade-in':
        opacityMultiplier *= p;
        break;
      case 'slide-in':
        opacityMultiplier *= p;
        offsetY += (1 - p) * 58;
        break;
      case 'zoom-in':
        opacityMultiplier *= p;
        scaleMultiplier *= 0.4 + 0.6 * p;
        break;
      case 'tracking-in':
        opacityMultiplier *= p;
        letterSpacingOffset += (1 - p) * 16;
        offsetY += (1 - p) * 18;
        break;
      case 'typewriter': {
        const totalChars = textStyle.content.length;
        const count = Math.max(1, Math.floor(p * totalChars));
        visibleText = textStyle.content.slice(0, count);
        break;
      }
      default:
        break;
    }
  }

  // Exit animation
  const timeFromEnd = clipDuration - clipLocalTime;
  if (textStyle.animationOut !== 'none' && timeFromEnd < animDur && timeFromEnd >= 0) {
    const p = evaluateEasing(timeFromEnd / animDur, 'ease-in');
    switch (textStyle.animationOut) {
      case 'fade-out':
        opacityMultiplier *= p;
        break;
      case 'slide-out':
        opacityMultiplier *= p;
        offsetY -= (1 - p) * 58;
        break;
      default:
        break;
    }
  }

  return {
    opacityMultiplier: Math.max(0, Math.min(1, opacityMultiplier)),
    offsetX,
    offsetY,
    scaleMultiplier,
    letterSpacingOffset,
    visibleText,
  };
}
