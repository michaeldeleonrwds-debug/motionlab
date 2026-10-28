import type { VideoEffect } from '../videoFx/types';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | 'custom';
export type ResolutionPreset = '1080p' | '720p';
export type FrameRate = 24 | 30 | 60;
export type MediaType = 'video' | 'audio' | 'image';
export type TrackType = 'video' | 'overlay' | 'text' | 'audio';
export type ClipType = 'video' | 'audio' | 'image' | 'text';

export type TransitionType =
  | 'none'
  | 'cross-dissolve'
  | 'fade-to-black'
  | 'fade-from-black'
  | 'slide-left'
  | 'wipe-right';

export type TextAnimationPreset =
  | 'none'
  | 'fade-in'
  | 'fade-out'
  | 'slide-in'
  | 'slide-out'
  | 'zoom-in'
  | 'typewriter'
  | 'tracking-in'
  | 'char-stagger'
  | 'word-stagger';

export type KeyframeProperty =
  | 'x'
  | 'y'
  | 'scale'
  | 'rotation'
  | 'opacity'
  | 'maskWidth'
  | 'maskHeight'
  | 'maskX'
  | 'maskY'
  | 'trimEnd'
  | 'skewX'
  | 'skewY';

export type KeyframeEasing =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'cubic-bezier'
  | 'expo-out'
  | 'back-out';

export interface Keyframe {
  id: string;
  /** Time offset in seconds from clip start (0 <= time <= clip.duration) */
  time: number;
  property: KeyframeProperty;
  value: number;
  easing: KeyframeEasing;
  /** Optional custom cubic-bezier control points [x1, y1, x2, y2], defaults to [0.16, 1, 0.3, 1] */
  bezierPoints?: [number, number, number, number];
}

export type MaskShape =
  | 'none'
  | 'rectangle'
  | 'ellipse'
  | 'circle'
  | 'linear-wipe'
  | 'radial-reveal';

export interface MaskSettings {
  shape: MaskShape;
  /** Center X offset in % of clip width (-50 to 50, default 0) */
  centerX: number;
  /** Center Y offset in % of clip height (-50 to 50, default 0) */
  centerY: number;
  /** Mask width in % of clip width (0 to 100, default 100) */
  width: number;
  /** Mask height in % of clip height (0 to 100, default 100) */
  height: number;
  /** Corner radius in px at 1080p reference (0 to 240, default 0) */
  radius: number;
  /** Softness / feather in px (0 to 80, default 0) */
  feather: number;
  /** Mask rotation in degrees (-180 to 180, default 0) */
  rotation: number;
  /** Invert mask region */
  invert: boolean;
  /** Mask expansion in px (-100 to 100, default 0) */
  expansion: number;
}

export type ProceduralShapeType =
  | 'rectangle'
  | 'circle'
  | 'ring'
  | 'line'
  | 'grid'
  | 'crosshair'
  | 'polygon'
  | 'angora-chevron'
  | 'browser-world'
  | 'poster-world'
  | 'timeline-world'
  | 'node-world'
  | 'explosion-lattice';

export interface ShapeStyle {
  shapeType: ProceduralShapeType;
  width: number;       // px at 1080p reference (default 600)
  height: number;      // px at 1080p reference (default 600)
  fillColor: string;   // hex color (default '#172018')
  fillOpacity: number; // 0..1 (default 0)
  strokeColor: string; // hex color (default '#D7E83F')
  strokeWidth: number; // px at 1080p reference (default 3)
  cornerRadius?: number;
  sides?: number;      // polygon sides (3..12)
  gridCols?: number;
  gridRows?: number;
  trimStart?: number;  // 0..100%
  trimEnd?: number;    // 0..100% (keyframable via 'trimEnd')
  accentColor?: string;
}

export interface ColorEffects {
  brightness: number; // -100 to 100, default 0
  contrast: number;   // -100 to 100, default 0
  saturation: number; // -100 to 100, default 0
  exposure: number;   // -100 to 100, default 0
  blur: number;       // 0 to 50 px, default 0
  grayscale: number;  // 0 to 100 %, default 0
  sepia: number;      // 0 to 100 %, default 0
  flipH: boolean;
  flipV: boolean;
}

export interface CropSettings {
  top: number;    // 0 to 45%
  right: number;  // 0 to 45%
  bottom: number; // 0 to 45%
  left: number;   // 0 to 45%
}

export interface TextStyle {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  backgroundColor: string;
  backgroundOpacity: number; // 0..1
  shadowColor: string;
  shadowBlur: number;
  strokeColor: string;
  strokeWidth: number;
  animationIn: TextAnimationPreset;
  animationOut: TextAnimationPreset;
  animationDuration: number; // seconds, e.g. 0.5
  letterSpacing?: number;    // px at 1080p reference, default 0
  paddingX?: number;         // px at 1080p reference
  paddingY?: number;         // px at 1080p reference
  borderRadius?: number;     // px at 1080p reference, default 0
  borderColor?: string;      // hex color for background box border
  borderWidth?: number;      // px at 1080p reference, default 0
}

export interface TransitionConfig {
  type: TransitionType;
  duration: number; // seconds, e.g. 0.5
}

export interface TimelineClip {
  id: string;
  name: string;
  trackId: string;
  type: ClipType;
  mediaId?: string;
  /** Position on the timeline in seconds */
  startTime: number;
  /** Timeline duration in seconds: (outPoint - inPoint) / playbackSpeed */
  duration: number;
  /** Source media in-point in seconds */
  inPoint: number;
  /** Source media out-point in seconds */
  outPoint: number;
  /** Total source media duration in seconds (Infinity for text/image) */
  sourceDuration: number;
  /** Playback speed multiplier (0.25 to 4.0) */
  playbackSpeed: number;
  /** Transform position X offset from center in normalized canvas pixels */
  x: number;
  /** Transform position Y offset from center in normalized canvas pixels */
  y: number;
  /** Uniform scale multiplier (1 = 100%) */
  scale: number;
  /** Rotation in degrees */
  rotation: number;
  /** Opacity 0..1 */
  opacity: number;
  /** 2.5D Perspective Shear X in degrees (-60 to 60) */
  skewX?: number;
  /** 2.5D Perspective Shear Y in degrees (-60 to 60) */
  skewY?: number;
  crop: CropSettings;
  mask?: MaskSettings;
  effects: ColorEffects;
  /** Nondestructive Video FX & Color Grade stack */
  videoEffects?: VideoEffect[];
  /** Audio volume 0..2 (1 = 100%) */
  volume: number;
  muted: boolean;
  fadeIn: number;  // seconds
  fadeOut: number; // seconds
  transitionIn: TransitionConfig;
  transitionOut: TransitionConfig;
  textStyle?: TextStyle;
  /** Optional procedural vector / architectural shape layer style */
  shapeStyle?: ShapeStyle;
  /** Optional parent clip ID for parent-child transform group inheritance */
  parentId?: string;
  /** Optional directional velocity motion blur enabled */
  motionBlur?: boolean;
  keyframes: Keyframe[];
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  /** Lower order index = higher visual layer on timeline UI (top-to-bottom), or explicit layer order */
  order: number;
  muted: boolean;
  visible: boolean;
  locked: boolean;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  mimeType: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  fps?: number;
  hasAudio: boolean;
  codecInfo: string;
  thumbnails: string[];
  waveform: number[];
  objectUrl?: string;
  blob?: Blob;
  createdAt: number;
}

export interface ProjectData {
  id: string;
  name: string;
  aspectRatio: AspectRatio;
  resolution: ResolutionPreset;
  fps: FrameRate;
  customWidth?: number;
  customHeight?: number;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  mediaAssets: MediaAsset[];
  createdAt: number;
  updatedAt: number;
}

export interface ExportSettings {
  format: 'mp4';
  videoCodec: 'H.264';
  audioCodec: 'AAC';
  resolution: ResolutionPreset;
  fps: FrameRate;
  quality: 'high' | 'standard' | 'draft';
}
