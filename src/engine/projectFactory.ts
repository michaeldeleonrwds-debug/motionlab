import type {
  AspectRatio,
  ColorEffects,
  CropSettings,
  FrameRate,
  MaskSettings,
  MediaAsset,
  ProjectData,
  ResolutionPreset,
  TextStyle,
  TimelineClip,
  TimelineTrack,
} from '../types/editor';

export function createDefaultColorEffects(): ColorEffects {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    exposure: 0,
    blur: 0,
    grayscale: 0,
    sepia: 0,
    flipH: false,
    flipV: false,
  };
}

export function createDefaultCrop(): CropSettings {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
}

export function createDefaultMask(): MaskSettings {
  return {
    shape: 'none',
    centerX: 0,
    centerY: 0,
    width: 100,
    height: 100,
    radius: 0,
    feather: 0,
    rotation: 0,
    invert: false,
    expansion: 0,
  };
}

export function createDefaultTextStyle(content = 'Headline Title'): TextStyle {
  return {
    content,
    fontFamily: 'Inter',
    fontSize: 64,
    fontWeight: 700,
    color: '#ffffff',
    align: 'center',
    backgroundColor: '#000000',
    backgroundOpacity: 0.45,
    shadowColor: '#000000',
    shadowBlur: 8,
    strokeColor: '#000000',
    strokeWidth: 0,
    animationIn: 'fade-in',
    animationOut: 'fade-out',
    animationDuration: 0.5,
  };
}

export function createDefaultTracks(): TimelineTrack[] {
  return [
    {
      id: 'track-text-1',
      name: 'T1 • Titles',
      type: 'text',
      order: 0,
      muted: false,
      visible: true,
      locked: false,
    },
    {
      id: 'track-overlay-1',
      name: 'V2 • Overlay / PIP',
      type: 'overlay',
      order: 1,
      muted: false,
      visible: true,
      locked: false,
    },
    {
      id: 'track-video-1',
      name: 'V1 • Primary Video',
      type: 'video',
      order: 2,
      muted: false,
      visible: true,
      locked: false,
    },
    {
      id: 'track-audio-1',
      name: 'A1 • Music / SFX',
      type: 'audio',
      order: 3,
      muted: false,
      visible: true,
      locked: false,
    },
  ];
}

export function createNewProject(options?: {
  id?: string;
  name?: string;
  aspectRatio?: AspectRatio;
  resolution?: ResolutionPreset;
  fps?: FrameRate;
  customWidth?: number;
  customHeight?: number;
}): ProjectData {
  const now = Date.now();
  return {
    id: options?.id || `proj-${now}-${Math.random().toString(36).slice(2, 7)}`,
    name: options?.name || 'Untitled Sequence',
    aspectRatio: options?.aspectRatio || '16:9',
    resolution: options?.resolution || '1080p',
    fps: options?.fps || 30,
    customWidth: options?.customWidth,
    customHeight: options?.customHeight,
    tracks: createDefaultTracks(),
    clips: [],
    mediaAssets: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createClipFromMediaAsset(
  asset: MediaAsset,
  trackId: string,
  startTime: number
): TimelineClip {
  const duration = Number(Math.max(0.2, asset.duration || 5).toFixed(4));
  const isImage = asset.type === 'image';

  return {
    id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: asset.name,
    trackId,
    type: asset.type,
    mediaId: asset.id,
    startTime: Number(Math.max(0, startTime).toFixed(4)),
    duration,
    inPoint: 0,
    outPoint: duration,
    sourceDuration: isImage ? Infinity : duration,
    playbackSpeed: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    crop: createDefaultCrop(),
    mask: createDefaultMask(),
    effects: createDefaultColorEffects(),
    volume: 1,
    muted: false,
    fadeIn: 0,
    fadeOut: 0,
    transitionIn: { type: 'none', duration: 0.5 },
    transitionOut: { type: 'none', duration: 0.5 },
    keyframes: [],
  };
}

export function createTextClip(
  trackId: string,
  startTime: number,
  content = 'MotionLab Title',
  preset?: Partial<TextStyle>
): TimelineClip {
  const duration = 3.0;
  return {
    id: `clip-text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: content.slice(0, 24) || 'Text Layer',
    trackId,
    type: 'text',
    startTime: Number(Math.max(0, startTime).toFixed(4)),
    duration,
    inPoint: 0,
    outPoint: duration,
    sourceDuration: Infinity,
    playbackSpeed: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    crop: createDefaultCrop(),
    mask: createDefaultMask(),
    effects: createDefaultColorEffects(),
    volume: 1,
    muted: true,
    fadeIn: 0,
    fadeOut: 0,
    transitionIn: { type: 'none', duration: 0.5 },
    transitionOut: { type: 'none', duration: 0.5 },
    textStyle: {
      ...createDefaultTextStyle(content),
      ...preset,
    },
    keyframes: [],
  };
}
