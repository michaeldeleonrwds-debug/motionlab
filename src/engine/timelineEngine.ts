import type {
  AspectRatio,
  ClipType,
  FrameRate,
  Keyframe,
  ResolutionPreset,
  TimelineClip,
  TimelineTrack,
  TrackType,
} from '../types/editor';

export function getResolutionDimensions(
  aspectRatio: AspectRatio,
  resolution: ResolutionPreset,
  customWidth?: number,
  customHeight?: number
): { width: number; height: number } {
  if (customWidth && customHeight && customWidth > 0 && customHeight > 0) {
    return { width: Math.round(customWidth), height: Math.round(customHeight) };
  }
  const baseShort = resolution === '1080p' ? 1080 : 720;
  switch (aspectRatio) {
    case '16:9':
      return resolution === '1080p'
        ? { width: 1920, height: 1080 }
        : { width: 1280, height: 720 };
    case '9:16':
      return resolution === '1080p'
        ? { width: 1080, height: 1920 }
        : { width: 720, height: 1280 };
    case '1:1':
      return { width: baseShort, height: baseShort };
    case '4:5':
      return resolution === '1080p'
        ? { width: 1080, height: 1350 }
        : { width: 720, height: 900 };
    case 'custom':
      return { width: customWidth || 1920, height: customHeight || 1080 };
    default:
      return resolution === '1080p'
        ? { width: 1920, height: 1080 }
        : { width: 1280, height: 720 };
  }
}

export function formatTimecode(seconds: number, fps: FrameRate = 30): string {
  const clamped = Math.max(0, seconds);
  const totalFrames = Math.floor((clamped + 1e-6) * fps);
  const ff = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

export function snapTimeToFrame(seconds: number, fps: FrameRate): number {
  const clamped = Math.max(0, seconds);
  return Math.round(clamped * fps) / fps;
}

export function clipTimelineToSourceTime(clip: TimelineClip, timelineTime: number): number {
  const localElapsed = Math.max(0, timelineTime - clip.startTime);
  const sourceTime = clip.inPoint + localElapsed * clip.playbackSpeed;
  if (Number.isFinite(clip.outPoint)) {
    return Math.min(clip.outPoint, Math.max(clip.inPoint, sourceTime));
  }
  return Math.max(clip.inPoint, sourceTime);
}

export function isTrackCompatibleWithClip(trackType: TrackType, clipType: ClipType): boolean {
  switch (trackType) {
    case 'video':
    case 'overlay':
      return clipType === 'video' || clipType === 'image';
    case 'text':
      return clipType === 'text';
    case 'audio':
      return clipType === 'audio';
  }
}

export function trimClipLeft(
  clip: TimelineClip,
  proposedStartTime: number,
  minDuration = 0.1
): TimelineClip {
  const originalEndTime = clip.startTime + clip.duration;
  const minStartByInPoint = clip.startTime - clip.inPoint / clip.playbackSpeed;
  const maxStartByMinDuration = originalEndTime - minDuration;

  const clampedStart = Math.max(
    0,
    minStartByInPoint,
    Math.min(maxStartByMinDuration, proposedStartTime)
  );
  const deltaTimeline = clampedStart - clip.startTime;
  const newInPoint = Math.max(0, clip.inPoint + deltaTimeline * clip.playbackSpeed);
  const newDuration = Math.max(minDuration, originalEndTime - clampedStart);

  // Shift keyframes relative to new clip start
  const updatedKeyframes: Keyframe[] = clip.keyframes
    .map((kf) => ({
      ...kf,
      time: Number((kf.time - deltaTimeline).toFixed(4)),
    }))
    .filter((kf) => kf.time >= 0 && kf.time <= newDuration);

  return {
    ...clip,
    startTime: Number(clampedStart.toFixed(4)),
    inPoint: Number(newInPoint.toFixed(4)),
    duration: Number(newDuration.toFixed(4)),
    keyframes: updatedKeyframes,
  };
}

export function trimClipRight(
  clip: TimelineClip,
  proposedDuration: number,
  minDuration = 0.1
): TimelineClip {
  const maxDurationBySource = Number.isFinite(clip.sourceDuration)
    ? (clip.sourceDuration - clip.inPoint) / clip.playbackSpeed
    : Infinity;

  const newDuration = Math.max(
    minDuration,
    Math.min(maxDurationBySource, proposedDuration)
  );
  const newOutPoint = clip.inPoint + newDuration * clip.playbackSpeed;

  const updatedKeyframes = clip.keyframes.filter((kf) => kf.time <= newDuration);

  return {
    ...clip,
    duration: Number(newDuration.toFixed(4)),
    outPoint: Number(newOutPoint.toFixed(4)),
    keyframes: updatedKeyframes,
  };
}

export function changeClipSpeed(clip: TimelineClip, newSpeed: number): TimelineClip {
  const clampedSpeed = Math.max(0.25, Math.min(4.0, newSpeed));
  const sourceSpan = clip.outPoint - clip.inPoint;
  const newDuration =
    sourceSpan > 0 && Number.isFinite(sourceSpan)
      ? sourceSpan / clampedSpeed
      : clip.duration * (clip.playbackSpeed / clampedSpeed);

  const timeRatio = newDuration / Math.max(0.01, clip.duration);
  const updatedKeyframes = clip.keyframes.map((kf) => ({
    ...kf,
    time: Number((kf.time * timeRatio).toFixed(4)),
  }));

  return {
    ...clip,
    playbackSpeed: Number(clampedSpeed.toFixed(2)),
    duration: Number(Math.max(0.1, newDuration).toFixed(4)),
    keyframes: updatedKeyframes,
  };
}

export function splitClipAtTime(
  clip: TimelineClip,
  splitTimelineTime: number,
  generateId: () => string = () => `${clip.id}-part2-${Math.random().toString(36).slice(2, 7)}`
): [TimelineClip, TimelineClip] | null {
  const minSegment = 0.08;
  const clipEnd = clip.startTime + clip.duration;
  if (
    splitTimelineTime <= clip.startTime + minSegment ||
    splitTimelineTime >= clipEnd - minSegment
  ) {
    return null;
  }

  const leftDuration = splitTimelineTime - clip.startTime;
  const rightDuration = clipEnd - splitTimelineTime;
  const splitSourceTime = clip.inPoint + leftDuration * clip.playbackSpeed;

  const leftKeyframes = clip.keyframes
    .filter((kf) => kf.time <= leftDuration)
    .map((kf) => ({ ...kf }));

  const rightKeyframes = clip.keyframes
    .filter((kf) => kf.time >= leftDuration)
    .map((kf) => ({
      ...kf,
      id: `${kf.id}-r`,
      time: Number((kf.time - leftDuration).toFixed(4)),
    }));

  const leftClip: TimelineClip = {
    ...clip,
    duration: Number(leftDuration.toFixed(4)),
    outPoint: Number(splitSourceTime.toFixed(4)),
    fadeOut: 0,
    transitionOut: { type: 'none', duration: 0.5 },
    keyframes: leftKeyframes,
  };

  const rightClip: TimelineClip = {
    ...clip,
    id: generateId(),
    name: `${clip.name} (2)`,
    startTime: Number(splitTimelineTime.toFixed(4)),
    duration: Number(rightDuration.toFixed(4)),
    inPoint: Number(splitSourceTime.toFixed(4)),
    outPoint: clip.outPoint,
    fadeIn: 0,
    transitionIn: { type: 'none', duration: 0.5 },
    keyframes: rightKeyframes,
    crop: { ...clip.crop },
    effects: { ...clip.effects },
    textStyle: clip.textStyle ? { ...clip.textStyle } : undefined,
  };

  return [leftClip, rightClip];
}

export interface SnapResult {
  snappedTime: number;
  snapPoint: number | null;
  isSnapped: boolean;
}

export function findSnapTarget(
  targetTime: number,
  clips: TimelineClip[],
  playheadTime: number,
  thresholdSeconds: number,
  excludeClipIds: string[] = []
): SnapResult {
  const candidates: number[] = [0, playheadTime];
  const excludeSet = new Set(excludeClipIds);

  for (const clip of clips) {
    if (excludeSet.has(clip.id)) continue;
    candidates.push(clip.startTime);
    candidates.push(clip.startTime + clip.duration);
  }

  let bestCandidate: number | null = null;
  let bestDistance = thresholdSeconds;

  for (const candidate of candidates) {
    const dist = Math.abs(targetTime - candidate);
    if (dist <= bestDistance) {
      bestDistance = dist;
      bestCandidate = candidate;
    }
  }

  if (bestCandidate !== null) {
    return {
      snappedTime: Math.max(0, Number(bestCandidate.toFixed(4))),
      snapPoint: bestCandidate,
      isSnapped: true,
    };
  }

  return {
    snappedTime: Math.max(0, Number(targetTime.toFixed(4))),
    snapPoint: null,
    isSnapped: false,
  };
}

export function getProjectDuration(clips: TimelineClip[]): number {
  if (clips.length === 0) return 0;
  let maxEnd = 0;
  for (const clip of clips) {
    const end = clip.startTime + clip.duration;
    if (end > maxEnd) maxEnd = end;
  }
  return Number(maxEnd.toFixed(4));
}

export interface ActiveClipLayer {
  clip: TimelineClip;
  track: TimelineTrack;
  localTime: number;
  sourceTime: number;
  /** Optional outgoing clip if a cross-dissolve/slide/wipe transition is occurring at this timestamp */
  outgoingTransition?: {
    previousClip: TimelineClip;
    previousSourceTime: number;
    previousLocalTime: number;
    transitionType: TimelineClip['transitionIn']['type'];
    progress: number; // 0..1
  };
}

/**
 * Returns visual clips active at `timelineTime` ordered from bottom background layer to top foreground layer.
 * In our track model, lower `track.order` is displayed higher in the timeline UI (foreground),
 * while higher `track.order` is displayed lower in the timeline UI (background).
 * Therefore, we sort by `track.order` DESCENDING for painter's algorithm compositing!
 */
export function getCompositedVisualClipsAtTime(
  tracks: TimelineTrack[],
  clips: TimelineClip[],
  timelineTime: number
): ActiveClipLayer[] {
  const typeLayerPriority = (type: TrackType): number => {
    switch (type) {
      case 'video':
        return 0; // Drawn first (bottom background layer)
      case 'overlay':
        return 1; // Drawn second (graphic elements & brand assets)
      case 'text':
        return 2; // Drawn last (top foreground typography & CTAs)
      default:
        return 0;
    }
  };

  const visibleTracks = tracks
    .filter((t) => t.visible && t.type !== 'audio')
    .sort((a, b) => {
      const catDiff = typeLayerPriority(a.type) - typeLayerPriority(b.type);
      if (catDiff !== 0) return catDiff;
      return b.order - a.order;
    });

  const layers: ActiveClipLayer[] = [];

  for (const track of visibleTracks) {
    const trackClips = clips
      .filter((c) => c.trackId === track.id)
      .sort((a, b) => a.startTime - b.startTime);

    for (let i = 0; i < trackClips.length; i++) {
      const clip = trackClips[i];
      const clipEnd = clip.startTime + clip.duration;
      // Include last frame at exact project end or within [startTime, clipEnd)
      const isAtStart = timelineTime >= clip.startTime - 1e-4;
      const isBeforeEnd = timelineTime < clipEnd - 1e-5 || (Math.abs(timelineTime - clipEnd) < 1e-4 && timelineTime === getProjectDuration(clips));

      if (isAtStart && isBeforeEnd) {
        const localTime = Math.max(0, timelineTime - clip.startTime);
        const sourceTime = clipTimelineToSourceTime(clip, timelineTime);

        let outgoingTransition: ActiveClipLayer['outgoingTransition'] | undefined;

        const transIn = clip.transitionIn;
        if (
          transIn &&
          transIn.type !== 'none' &&
          transIn.duration > 0 &&
          localTime < transIn.duration &&
          i > 0
        ) {
          const prevClip = trackClips[i - 1];
          const prevEnd = prevClip.startTime + prevClip.duration;
          // Check if prevClip is adjacent (within 0.15s)
          if (Math.abs(clip.startTime - prevEnd) <= 0.15) {
            const progress = Math.max(0, Math.min(1, localTime / transIn.duration));
            const prevLocalTime = Math.max(0, prevClip.duration - (transIn.duration - localTime));
            const prevSourceTime = Math.min(
              prevClip.sourceDuration || prevClip.outPoint,
              prevClip.outPoint - (transIn.duration - localTime) * prevClip.playbackSpeed
            );
            outgoingTransition = {
              previousClip: prevClip,
              previousSourceTime: Math.max(prevClip.inPoint, prevSourceTime),
              previousLocalTime: prevLocalTime,
              transitionType: transIn.type,
              progress,
            };
          }
        }

        layers.push({
          clip,
          track,
          localTime,
          sourceTime,
          outgoingTransition,
        });
      }
    }
  }

  return layers;
}
