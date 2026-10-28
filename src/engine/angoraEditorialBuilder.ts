import type {
  Keyframe,
  MaskSettings,
  MediaAsset,
  ProjectData,
  TextStyle,
  TimelineClip,
  TimelineTrack,
} from '../types/editor';
import {
  createDefaultColorEffects,
  createDefaultCrop,
  createDefaultMask,
  createDefaultTextStyle,
} from './projectFactory';
import { importMediaFile } from './mediaImportEngine';

export const ANGORA_EDITORIAL_PROMO_PROJECT_ID = 'proj-angora-editorial-promo-15s';
export const ANGORA_EDITORIAL_PROMO_PROJECT_NAME = 'ANGORA — Editorial Kinetic Promo (15s)';

function kf(
  idSuffix: string,
  property: Keyframe['property'],
  time: number,
  value: number,
  easing: Keyframe['easing'] = 'ease-out',
  bezierPoints?: [number, number, number, number]
): Keyframe {
  return {
    id: `kf-${idSuffix}-${property}-${Math.round(time * 100)}`,
    property,
    time: Number(time.toFixed(3)),
    value,
    easing,
    bezierPoints,
  };
}

function makeVisualMediaClip(options: {
  id: string;
  name: string;
  trackId: string;
  asset: MediaAsset;
  startTime: number;
  duration: number;
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
  fadeIn?: number;
  fadeOut?: number;
  mask?: Partial<MaskSettings>;
  parentId?: string;
  motionBlur?: boolean;
  transitionIn?: TimelineClip['transitionIn'];
  transitionOut?: TimelineClip['transitionOut'];
  keyframes?: Keyframe[];
}): TimelineClip {
  return {
    id: options.id,
    name: options.name,
    trackId: options.trackId,
    type: 'image',
    mediaId: options.asset.id,
    startTime: Number(options.startTime.toFixed(4)),
    duration: Number(options.duration.toFixed(4)),
    inPoint: 0,
    outPoint: Number(options.duration.toFixed(4)),
    sourceDuration: Infinity,
    playbackSpeed: 1,
    x: options.x ?? 0,
    y: options.y ?? 0,
    scale: options.scale ?? 1,
    rotation: 0,
    opacity: options.opacity ?? 1,
    crop: createDefaultCrop(),
    mask: { ...createDefaultMask(), ...(options.mask ?? {}) },
    effects: createDefaultColorEffects(),
    volume: 1,
    muted: true,
    fadeIn: options.fadeIn ?? 0,
    fadeOut: options.fadeOut ?? 0,
    transitionIn: options.transitionIn ?? { type: 'none', duration: 0 },
    transitionOut: options.transitionOut ?? { type: 'none', duration: 0 },
    parentId: options.parentId,
    motionBlur: options.motionBlur ?? false,
    keyframes: options.keyframes ?? [],
  };
}

function makeTextLayerClip(options: {
  id: string;
  name: string;
  trackId: string;
  startTime: number;
  duration: number;
  content: string;
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
  fadeIn?: number;
  fadeOut?: number;
  mask?: Partial<MaskSettings>;
  parentId?: string;
  motionBlur?: boolean;
  style: Partial<TextStyle>;
  keyframes?: Keyframe[];
}): TimelineClip {
  return {
    id: options.id,
    name: options.name,
    trackId: options.trackId,
    type: 'text',
    startTime: Number(options.startTime.toFixed(4)),
    duration: Number(options.duration.toFixed(4)),
    inPoint: 0,
    outPoint: Number(options.duration.toFixed(4)),
    sourceDuration: Infinity,
    playbackSpeed: 1,
    x: options.x ?? 0,
    y: options.y ?? 0,
    scale: options.scale ?? 1,
    rotation: 0,
    opacity: options.opacity ?? 1,
    crop: createDefaultCrop(),
    mask: { ...createDefaultMask(), ...(options.mask ?? {}) },
    effects: createDefaultColorEffects(),
    volume: 1,
    muted: true,
    fadeIn: options.fadeIn ?? 0,
    fadeOut: options.fadeOut ?? 0,
    transitionIn: { type: 'none', duration: 0 },
    transitionOut: { type: 'none', duration: 0 },
    parentId: options.parentId,
    motionBlur: options.motionBlur ?? false,
    textStyle: {
      ...createDefaultTextStyle(options.content),
      fontFamily: 'Inter',
      backgroundOpacity: 0,
      shadowBlur: 0,
      animationIn: 'none',
      animationOut: 'none',
      animationDuration: 0.45,
      ...options.style,
    },
    keyframes: options.keyframes ?? [],
  };
}

function makeAudioLayerClip(options: {
  id: string;
  name: string;
  trackId: string;
  asset: MediaAsset;
  startTime: number;
  duration: number;
  inPoint?: number;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
}): TimelineClip {
  return {
    id: options.id,
    name: options.name,
    trackId: options.trackId,
    type: 'audio',
    mediaId: options.asset.id,
    startTime: Number(options.startTime.toFixed(4)),
    duration: Number(options.duration.toFixed(4)),
    inPoint: options.inPoint ?? 0,
    outPoint: Number((options.inPoint ?? 0) + options.duration),
    sourceDuration: options.asset.duration || options.duration,
    playbackSpeed: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    crop: createDefaultCrop(),
    mask: createDefaultMask(),
    effects: createDefaultColorEffects(),
    volume: options.volume ?? 1,
    muted: false,
    fadeIn: options.fadeIn ?? 0,
    fadeOut: options.fadeOut ?? 0,
    transitionIn: { type: 'none', duration: 0 },
    transitionOut: { type: 'none', duration: 0 },
    keyframes: [],
  };
}

async function fetchAndIngestAsset(
  url: string,
  filename: string,
  mimeType: string
): Promise<MediaAsset> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load asset ${url}: status ${res.status}`);
  }
  const blob = await res.blob();
  const file = new File([blob], filename, { type: mimeType });
  return importMediaFile(file);
}

/**
 * Builds the complete 15-second vertical (1080x1920 9:16 @ 30fps)
 * "ANGORA — Editorial Kinetic Promo" across 8 tracks (V1-V6, A1-A2)
 * with all 7 art-directed scenes and accurate clip-local keyframes.
 */
export async function buildAngoraEditorialPromoProjectData(): Promise<ProjectData> {
  const [
    bgPrimaryAsset,
    humanPhotoAsset,
    posterGraphicAsset,
    filmstripUiAsset,
    webBrowserAsset,
    mobileMockupAsset,
    automationNodesAsset,
    symbolAsset,
    limeBlockAsset,
    accentLineAsset,
    bgmAsset,
    sfxLogoAsset,
    sfxWhooshAsset,
    sfxImpactAsset,
    sfxRiserAsset,
    sfxKineticHitAsset,
    voAsset,
  ] = await Promise.all([
    fetchAndIngestAsset('/angora-assets/angora-bg-primary.png', 'angora-bg-primary.png', 'image/png'),
    fetchAndIngestAsset('/angora-assets/angora-human-laptop.jpg', 'angora-human-laptop.jpg', 'image/jpeg'),
    fetchAndIngestAsset('/angora-assets/angora-poster-graphic.png', 'angora-poster-graphic.png', 'image/png'),
    fetchAndIngestAsset('/angora-assets/angora-filmstrip-ui.png', 'angora-filmstrip-ui.png', 'image/png'),
    fetchAndIngestAsset('/angora-assets/angora-web-browser.png', 'angora-web-browser.png', 'image/png'),
    fetchAndIngestAsset('/angora-assets/angora-mobile-mockup.png', 'angora-mobile-mockup.png', 'image/png'),
    fetchAndIngestAsset('/angora-assets/angora-automation-nodes.png', 'angora-automation-nodes.png', 'image/png'),
    fetchAndIngestAsset('/angora-assets/angora-symbol-transparent.png', 'angora-symbol-transparent.png', 'image/png'),
    fetchAndIngestAsset('/angora-assets/angora-v2-lime-block.png', 'angora-v2-lime-block.png', 'image/png'),
    fetchAndIngestAsset('/angora-assets/angora-accent-line.png', 'angora-accent-line.png', 'image/png'),
    fetchAndIngestAsset('/angora-assets/angora-electronic-pulse-bgm.wav', 'angora-electronic-pulse-bgm.wav', 'audio/wav'),
    fetchAndIngestAsset('/angora-assets/angora-sfx-logo-reveal.wav', 'angora-sfx-logo-reveal.wav', 'audio/wav'),
    fetchAndIngestAsset('/angora-assets/angora-sfx-whoosh.wav', 'angora-sfx-whoosh.wav', 'audio/wav'),
    fetchAndIngestAsset('/angora-assets/angora-sfx-cta-impact.wav', 'angora-sfx-cta-impact.wav', 'audio/wav'),
    fetchAndIngestAsset('/angora-assets/angora-sfx-riser.wav', 'angora-sfx-riser.wav', 'audio/wav'),
    fetchAndIngestAsset('/angora-assets/angora-sfx-kinetic-hit.wav', 'angora-sfx-kinetic-hit.wav', 'audio/wav'),
    fetchAndIngestAsset('/angora-assets/angora-voiceover-exec-michael.wav', 'angora-voiceover-exec-michael.wav', 'audio/wav'),
  ]);

  const mediaAssets: MediaAsset[] = [
    bgPrimaryAsset,
    humanPhotoAsset,
    posterGraphicAsset,
    filmstripUiAsset,
    webBrowserAsset,
    mobileMockupAsset,
    automationNodesAsset,
    symbolAsset,
    limeBlockAsset,
    accentLineAsset,
    bgmAsset,
    sfxLogoAsset,
    sfxWhooshAsset,
    sfxImpactAsset,
    sfxRiserAsset,
    sfxKineticHitAsset,
    voAsset,
  ];

  const tracks: TimelineTrack[] = [
    {
      id: 'track-v6-hero-type',
      name: 'V6 · Kinetic Editorial Headlines',
      type: 'text',
      order: 0,
      muted: false,
      visible: true,
      locked: false,
    },
    {
      id: 'track-v5-sub-type',
      name: 'V5 · Swiss Subtitles & Telemetry',
      type: 'text',
      order: 1,
      muted: false,
      visible: true,
      locked: false,
    },
    {
      id: 'track-v4-brand-overlays',
      name: 'V4 · Brand Monogram & Overlays',
      type: 'overlay',
      order: 2,
      muted: false,
      visible: true,
      locked: false,
    },
    {
      id: 'track-v3-collage',
      name: 'V3 · Editorial Collage & Mockups',
      type: 'overlay',
      order: 3,
      muted: false,
      visible: true,
      locked: false,
    },
    {
      id: 'track-v2-accents',
      name: 'V2 · Geometric Accent Plates',
      type: 'overlay',
      order: 4,
      muted: false,
      visible: true,
      locked: false,
    },
    {
      id: 'track-v1-bg',
      name: 'V1 · Architectural Dark Canvas',
      type: 'video',
      order: 5,
      muted: false,
      visible: true,
      locked: false,
    },
    {
      id: 'track-a0-vo',
      name: 'A0 · Voiceover (Kokoro 82M Neural)',
      type: 'audio',
      order: 6,
      muted: false,
      visible: true,
      locked: false,
    },
    {
      id: 'track-a1-bgm',
      name: 'A1 · Electronic Pulse Music Bed',
      type: 'audio',
      order: 7,
      muted: false,
      visible: true,
      locked: false,
    },
    {
      id: 'track-a2-sfx',
      name: 'A2 · SFX Impacts & Whooshes',
      type: 'audio',
      order: 8,
      muted: false,
      visible: true,
      locked: false,
    },
  ];

  const clips: TimelineClip[] = [];

  // =========================================================================
  // AUDIO TRACKS: A0 NEURAL VOICEOVER + A1 MUSIC + A2 PRECISION SFX
  // =========================================================================
  clips.push(
    makeAudioLayerClip({
      id: 'clip-a0-voiceover-master',
      name: 'VO: Michael · Angora Brand Commercial',
      trackId: 'track-a0-vo',
      asset: voAsset,
      startTime: 0.35,
      duration: 5.29,
      volume: 1.0,
      fadeIn: 0.05,
      fadeOut: 0.15,
    }),
    makeAudioLayerClip({
      id: 'clip-a1-bgm-master',
      name: 'Electronic Pulse Agency BGM (15s)',
      trackId: 'track-a1-bgm',
      asset: bgmAsset,
      startTime: 0,
      duration: 15.0,
      volume: 0.88,
      fadeIn: 0.1,
      fadeOut: 0.4,
    }),
    makeAudioLayerClip({
      id: 'clip-a2-sfx-hook',
      name: 'SFX Whoosh · Scene 1 Hook',
      trackId: 'track-a2-sfx',
      asset: sfxWhooshAsset,
      startTime: 0.05,
      duration: 1.0,
      volume: 0.75,
    }),
    makeAudioLayerClip({
      id: 'clip-a2-sfx-promise',
      name: 'SFX Kinetic Hit · Scene 2',
      trackId: 'track-a2-sfx',
      asset: sfxKineticHitAsset,
      startTime: 1.95,
      duration: 1.2,
      volume: 0.85,
    }),
    makeAudioLayerClip({
      id: 'clip-a2-sfx-graphic',
      name: 'SFX Whoosh · Scene 3 Graphic',
      trackId: 'track-a2-sfx',
      asset: sfxWhooshAsset,
      startTime: 3.95,
      duration: 1.0,
      volume: 0.75,
    }),
    makeAudioLayerClip({
      id: 'clip-a2-sfx-video',
      name: 'SFX Kinetic Hit · Scene 4 Video',
      trackId: 'track-a2-sfx',
      asset: sfxKineticHitAsset,
      startTime: 5.95,
      duration: 1.2,
      volume: 0.85,
    }),
    makeAudioLayerClip({
      id: 'clip-a2-sfx-web',
      name: 'SFX Whoosh · Scene 5 Web',
      trackId: 'track-a2-sfx',
      asset: sfxWhooshAsset,
      startTime: 7.95,
      duration: 1.0,
      volume: 0.75,
    }),
    makeAudioLayerClip({
      id: 'clip-a2-sfx-auto-riser',
      name: 'SFX Riser · Scene 6 Build',
      trackId: 'track-a2-sfx',
      asset: sfxRiserAsset,
      startTime: 10.95,
      duration: 2.05,
      volume: 0.9,
    }),
    makeAudioLayerClip({
      id: 'clip-a2-sfx-logo-impact',
      name: 'SFX Logo Reveal Impact · Scene 7',
      trackId: 'track-a2-sfx',
      asset: sfxLogoAsset,
      startTime: 12.95,
      duration: 2.05,
      volume: 0.95,
    })
  );

  // =========================================================================
  // V1: ARCHITECTURAL DARK CANVAS (0:00 - 0:15)
  // =========================================================================
  clips.push(
    makeVisualMediaClip({
      id: 'clip-v1-canvas-master',
      name: 'Architectural Canvas (#0B0F0B & Frame)',
      trackId: 'track-v1-bg',
      asset: bgPrimaryAsset,
      startTime: 0,
      duration: 15.0,
      x: 0,
      y: 0,
      scale: 1.0,
      opacity: 1.0,
      keyframes: [
        kf('v1-canvas', 'scale', 0.0, 1.0, 'linear'),
        kf('v1-canvas', 'scale', 15.0, 1.05, 'linear'),
      ],
    })
  );

  // =========================================================================
  // SCENE 1: THE HOOK (0:00 - 0:02, 0.0s - 2.0s)
  // "YOUR AGENCY."
  // =========================================================================
  clips.push(
    makeTextLayerClip({
      id: 'clip-s1-header-tag',
      name: 'S1 · Tag [ANGORA // 2026]',
      trackId: 'track-v5-sub-type',
      startTime: 0.0,
      duration: 2.0,
      content: 'ANGORA WEB SERVICES • SYSTEM 01',
      x: 0,
      y: -520,
      scale: 1,
      opacity: 0,
      style: {
        fontSize: 22,
        fontWeight: 700,
        color: '#D7E83F',
        align: 'center',
        letterSpacing: 4,
      },
      keyframes: [
        kf('s1-tag', 'opacity', 0.0, 0, 'ease-out'),
        kf('s1-tag', 'opacity', 0.25, 1, 'ease-out'),
        kf('s1-tag', 'opacity', 1.85, 1, 'ease-in'),
        kf('s1-tag', 'opacity', 2.0, 0, 'ease-in'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s1-headline',
      name: 'S1 · Headline "YOUR AGENCY."',
      trackId: 'track-v6-hero-type',
      startTime: 0.0,
      duration: 2.0,
      content: 'YOUR\nAGENCY.',
      x: 0,
      y: 80,
      scale: 0.94,
      opacity: 0,
      style: {
        fontSize: 130,
        fontWeight: 900,
        color: '#FFFFFF',
        align: 'center',
        letterSpacing: -3,
      },
      keyframes: [
        kf('s1-head', 'opacity', 0.0, 0, 'ease-out'),
        kf('s1-head', 'opacity', 0.3, 1, 'ease-out'),
        kf('s1-head', 'y', 0.0, 100, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s1-head', 'y', 0.5, 0, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s1-head', 'scale', 0.0, 0.92, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s1-head', 'scale', 0.5, 1.0, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s1-head', 'opacity', 1.8, 1, 'ease-in'),
        kf('s1-head', 'opacity', 2.0, 0, 'ease-in'),
        kf('s1-head', 'x', 1.8, 0, 'cubic-bezier', [0.7, 0, 0.84, 0]),
        kf('s1-head', 'x', 2.0, -180, 'cubic-bezier', [0.7, 0, 0.84, 0]),
      ],
    }),
    makeVisualMediaClip({
      id: 'clip-s1-lime-wipe',
      name: 'S1 · Lime Geometric Wipe',
      trackId: 'track-v4-brand-overlays',
      asset: limeBlockAsset,
      startTime: 1.55,
      duration: 0.5,
      x: 900,
      y: 0,
      scale: 2.5,
      opacity: 0.95,
      keyframes: [
        kf('s1-wipe', 'x', 0.0, 900, 'cubic-bezier', [0.7, 0, 0.84, 0]),
        kf('s1-wipe', 'x', 0.3, 0, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s1-wipe', 'x', 0.5, -950, 'cubic-bezier', [0.7, 0, 0.84, 0]),
      ],
    })
  );

  // =========================================================================
  // SCENE 2: THE PROMISE (0:02 - 0:04, 2.0s - 4.0s)
  // "OUR EXECUTION." + authentic human designer working on laptop
  // =========================================================================
  clips.push(
    makeVisualMediaClip({
      id: 'clip-s2-human-designer',
      name: 'S2 · Creative Designer at Laptop',
      trackId: 'track-v3-collage',
      asset: humanPhotoAsset,
      startTime: 2.0,
      duration: 2.0,
      x: 120,
      y: 280,
      scale: 0.85,
      opacity: 0,
      mask: {
        shape: 'rectangle',
        centerX: 0,
        centerY: 0,
        width: 100,
        height: 100,
        radius: 20,
        feather: 15,
        invert: false,
        rotation: 0,
        expansion: 0,
      },
      keyframes: [
        kf('s2-human', 'opacity', 0.0, 0, 'ease-out'),
        kf('s2-human', 'opacity', 0.3, 1, 'ease-out'),
        kf('s2-human', 'scale', 0.0, 0.82, 'linear'),
        kf('s2-human', 'scale', 2.0, 0.88, 'linear'),
        kf('s2-human', 'x', 0.0, 180, 'ease-out'),
        kf('s2-human', 'x', 0.4, 120, 'ease-out'),
        kf('s2-human', 'opacity', 1.85, 1, 'ease-in'),
        kf('s2-human', 'opacity', 2.0, 0, 'ease-in'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s2-headline',
      name: 'S2 · Headline "OUR EXECUTION."',
      trackId: 'track-v6-hero-type',
      startTime: 2.0,
      duration: 2.0,
      content: 'OUR\nEXECUTION.',
      x: -40,
      y: -380,
      scale: 0.95,
      opacity: 0,
      style: {
        fontSize: 108,
        fontWeight: 900,
        color: '#FFFFFF',
        align: 'left',
        letterSpacing: -2,
      },
      keyframes: [
        kf('s2-head', 'opacity', 0.0, 0, 'ease-out'),
        kf('s2-head', 'opacity', 0.25, 1, 'ease-out'),
        kf('s2-head', 'y', 0.0, -320, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s2-head', 'y', 0.45, -380, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s2-head', 'opacity', 1.8, 1, 'ease-in'),
        kf('s2-head', 'opacity', 2.0, 0, 'ease-in'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s2-subtitle',
      name: 'S2 · Swiss Spec [PRECISION DIGITAL ENGINEERING]',
      trackId: 'track-v5-sub-type',
      startTime: 2.15,
      duration: 1.85,
      content: 'PRECISION DIGITAL ENGINEERING • 2026\nTURNING AMBITIOUS VISIONS INTO REALITY',
      x: -40,
      y: -210,
      scale: 1,
      opacity: 0,
      style: {
        fontSize: 18,
        fontWeight: 600,
        color: '#D7E83F',
        align: 'left',
        letterSpacing: 2,
      },
      keyframes: [
        kf('s2-sub', 'opacity', 0.0, 0, 'ease-out'),
        kf('s2-sub', 'opacity', 0.25, 1, 'ease-out'),
        kf('s2-sub', 'opacity', 1.7, 1, 'ease-in'),
        kf('s2-sub', 'opacity', 1.85, 0, 'ease-in'),
      ],
    })
  );

  // =========================================================================
  // SCENE 3: GRAPHIC DESIGN (0:04 - 0:06, 4.0s - 6.0s)
  // "GRAPHIC DESIGN" + Swiss poster fragments
  // =========================================================================
  clips.push(
    makeVisualMediaClip({
      id: 'clip-s3-poster-card',
      name: 'S3 · Swiss Poster Collage',
      trackId: 'track-v3-collage',
      asset: posterGraphicAsset,
      startTime: 4.0,
      duration: 2.0,
      x: 0,
      y: 120,
      scale: 0.92,
      opacity: 0,
      keyframes: [
        kf('s3-poster', 'opacity', 0.0, 0, 'ease-out'),
        kf('s3-poster', 'opacity', 0.25, 1, 'ease-out'),
        kf('s3-poster', 'y', 0.0, 240, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s3-poster', 'y', 0.45, 120, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s3-poster', 'scale', 0.0, 0.88, 'linear'),
        kf('s3-poster', 'scale', 2.0, 0.94, 'linear'),
        kf('s3-poster', 'opacity', 1.85, 1, 'ease-in'),
        kf('s3-poster', 'opacity', 2.0, 0, 'ease-in'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s3-headline',
      name: 'S3 · Headline "GRAPHIC DESIGN"',
      trackId: 'track-v6-hero-type',
      startTime: 4.0,
      duration: 2.0,
      content: 'GRAPHIC\nDESIGN',
      x: 0,
      y: -580,
      scale: 0.95,
      opacity: 0,
      style: {
        fontSize: 104,
        fontWeight: 900,
        color: '#FFFFFF',
        align: 'center',
        letterSpacing: -2,
      },
      keyframes: [
        kf('s3-head', 'opacity', 0.0, 0, 'ease-out'),
        kf('s3-head', 'opacity', 0.2, 1, 'ease-out'),
        kf('s3-head', 'y', 0.0, -520, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s3-head', 'y', 0.4, -580, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s3-head', 'opacity', 1.8, 1, 'ease-in'),
        kf('s3-head', 'opacity', 2.0, 0, 'ease-in'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s3-service-tag',
      name: 'S3 · Service Tag [01 / POSTER SYSTEM]',
      trackId: 'track-v5-sub-type',
      startTime: 4.15,
      duration: 1.85,
      content: 'SERVICE 01 • ART DIRECTION & BRAND SYSTEMS',
      x: 0,
      y: -440,
      scale: 1,
      opacity: 0,
      style: {
        fontSize: 18,
        fontWeight: 700,
        color: '#D7E83F',
        align: 'center',
        letterSpacing: 3,
      },
      keyframes: [
        kf('s3-tag', 'opacity', 0.0, 0, 'ease-out'),
        kf('s3-tag', 'opacity', 0.2, 1, 'ease-out'),
        kf('s3-tag', 'opacity', 1.7, 1, 'ease-in'),
        kf('s3-tag', 'opacity', 1.85, 0, 'ease-in'),
      ],
    })
  );

  // =========================================================================
  // SCENE 4: VIDEO EDITING (0:06 - 0:08, 6.0s - 8.0s)
  // "VIDEO EDITING" + filmstrip cells & playhead sweep
  // =========================================================================
  clips.push(
    makeVisualMediaClip({
      id: 'clip-s4-filmstrip-card',
      name: 'S4 · Filmstrip & NLE Interface',
      trackId: 'track-v3-collage',
      asset: filmstripUiAsset,
      startTime: 6.0,
      duration: 2.0,
      x: 0,
      y: 120,
      scale: 0.95,
      opacity: 0,
      keyframes: [
        kf('s4-film', 'opacity', 0.0, 0, 'ease-out'),
        kf('s4-film', 'opacity', 0.25, 1, 'ease-out'),
        kf('s4-film', 'scale', 0.0, 0.9, 'linear'),
        kf('s4-film', 'scale', 2.0, 0.97, 'linear'),
        kf('s4-film', 'opacity', 1.85, 1, 'ease-in'),
        kf('s4-film', 'opacity', 2.0, 0, 'ease-in'),
      ],
    }),
    makeVisualMediaClip({
      id: 'clip-s4-playhead-sweep',
      name: 'S4 · Kinetic Playhead Sweep',
      trackId: 'track-v4-brand-overlays',
      asset: accentLineAsset,
      startTime: 6.0,
      duration: 2.0,
      x: -350,
      y: 40,
      scale: 1.2,
      opacity: 0.85,
      keyframes: [
        kf('s4-playhead', 'x', 0.0, -350, 'linear'),
        kf('s4-playhead', 'x', 2.0, 350, 'linear'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s4-headline',
      name: 'S4 · Headline "VIDEO EDITING"',
      trackId: 'track-v6-hero-type',
      startTime: 6.0,
      duration: 2.0,
      content: 'VIDEO\nEDITING',
      x: 0,
      y: -580,
      scale: 0.95,
      opacity: 0,
      style: {
        fontSize: 104,
        fontWeight: 900,
        color: '#FFFFFF',
        align: 'center',
        letterSpacing: -2,
      },
      keyframes: [
        kf('s4-head', 'opacity', 0.0, 0, 'ease-out'),
        kf('s4-head', 'opacity', 0.2, 1, 'ease-out'),
        kf('s4-head', 'y', 0.0, -520, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s4-head', 'y', 0.4, -580, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s4-head', 'opacity', 1.8, 1, 'ease-in'),
        kf('s4-head', 'opacity', 2.0, 0, 'ease-in'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s4-service-tag',
      name: 'S4 · Service Tag [02 / POST-PRODUCTION]',
      trackId: 'track-v5-sub-type',
      startTime: 6.15,
      duration: 1.85,
      content: 'SERVICE 02 • RHYTHMIC PACING & SOUND DESIGN',
      x: 0,
      y: -440,
      scale: 1,
      opacity: 0,
      style: {
        fontSize: 18,
        fontWeight: 700,
        color: '#D7E83F',
        align: 'center',
        letterSpacing: 3,
      },
      keyframes: [
        kf('s4-tag', 'opacity', 0.0, 0, 'ease-out'),
        kf('s4-tag', 'opacity', 0.2, 1, 'ease-out'),
        kf('s4-tag', 'opacity', 1.7, 1, 'ease-in'),
        kf('s4-tag', 'opacity', 1.85, 0, 'ease-in'),
      ],
    })
  );

  // =========================================================================
  // SCENE 5: WEB DESIGN & DEVELOPMENT (0:08 - 0:11, 8.0s - 11.0s)
  // "WEB DESIGN & DEV" + browser mockup + mobile mockup
  // =========================================================================
  clips.push(
    makeVisualMediaClip({
      id: 'clip-s5-browser-mockup',
      name: 'S5 · Browser Window Mockup',
      trackId: 'track-v3-collage',
      asset: webBrowserAsset,
      startTime: 8.0,
      duration: 3.0,
      x: -40,
      y: 60,
      scale: 0.94,
      opacity: 0,
      keyframes: [
        kf('s5-browser', 'opacity', 0.0, 0, 'ease-out'),
        kf('s5-browser', 'opacity', 0.3, 1, 'ease-out'),
        kf('s5-browser', 'x', 0.0, -120, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s5-browser', 'x', 0.5, -40, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s5-browser', 'scale', 0.0, 0.92, 'linear'),
        kf('s5-browser', 'scale', 3.0, 0.96, 'linear'),
        kf('s5-browser', 'opacity', 2.8, 1, 'ease-in'),
        kf('s5-browser', 'opacity', 3.0, 0, 'ease-in'),
      ],
    }),
    makeVisualMediaClip({
      id: 'clip-s5-mobile-mockup',
      name: 'S5 · Mobile Fluid Mockup',
      trackId: 'track-v4-brand-overlays',
      asset: mobileMockupAsset,
      startTime: 8.25,
      duration: 2.75,
      x: 280,
      y: 380,
      scale: 0.72,
      opacity: 0,
      keyframes: [
        kf('s5-phone', 'opacity', 0.0, 0, 'ease-out'),
        kf('s5-phone', 'opacity', 0.3, 1, 'ease-out'),
        kf('s5-phone', 'y', 0.0, 480, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s5-phone', 'y', 0.55, 380, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s5-phone', 'scale', 0.0, 0.70, 'linear'),
        kf('s5-phone', 'scale', 2.75, 0.75, 'linear'),
        kf('s5-phone', 'opacity', 2.55, 1, 'ease-in'),
        kf('s5-phone', 'opacity', 2.75, 0, 'ease-in'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s5-headline',
      name: 'S5 · Headline "WEB DESIGN & DEV"',
      trackId: 'track-v6-hero-type',
      startTime: 8.0,
      duration: 3.0,
      content: 'WEB DESIGN\n& DEV.',
      x: 0,
      y: -580,
      scale: 0.95,
      opacity: 0,
      style: {
        fontSize: 98,
        fontWeight: 900,
        color: '#FFFFFF',
        align: 'center',
        letterSpacing: -2,
      },
      keyframes: [
        kf('s5-head', 'opacity', 0.0, 0, 'ease-out'),
        kf('s5-head', 'opacity', 0.25, 1, 'ease-out'),
        kf('s5-head', 'y', 0.0, -520, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s5-head', 'y', 0.45, -580, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s5-head', 'opacity', 2.8, 1, 'ease-in'),
        kf('s5-head', 'opacity', 3.0, 0, 'ease-in'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s5-service-tag',
      name: 'S5 · Service Tag [03 / WEB ARCHITECTURE]',
      trackId: 'track-v5-sub-type',
      startTime: 8.15,
      duration: 2.85,
      content: 'SERVICE 03 • SUB-SECOND EDGE ARCHITECTURE',
      x: 0,
      y: -440,
      scale: 1,
      opacity: 0,
      style: {
        fontSize: 18,
        fontWeight: 700,
        color: '#D7E83F',
        align: 'center',
        letterSpacing: 3,
      },
      keyframes: [
        kf('s5-tag', 'opacity', 0.0, 0, 'ease-out'),
        kf('s5-tag', 'opacity', 0.2, 1, 'ease-out'),
        kf('s5-tag', 'opacity', 2.7, 1, 'ease-in'),
        kf('s5-tag', 'opacity', 2.85, 0, 'ease-in'),
      ],
    })
  );

  // =========================================================================
  // SCENE 6: AUTOMATION (0:11 - 0:13, 11.0s - 13.0s)
  // "AUTOMATION" + pipeline nodes
  // =========================================================================
  clips.push(
    makeVisualMediaClip({
      id: 'clip-s6-nodes-card',
      name: 'S6 · Autonomous Nodes Diagram',
      trackId: 'track-v3-collage',
      asset: automationNodesAsset,
      startTime: 11.0,
      duration: 2.0,
      x: 0,
      y: 120,
      scale: 0.94,
      opacity: 0,
      keyframes: [
        kf('s6-nodes', 'opacity', 0.0, 0, 'ease-out'),
        kf('s6-nodes', 'opacity', 0.25, 1, 'ease-out'),
        kf('s6-nodes', 'y', 0.0, 220, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s6-nodes', 'y', 0.45, 120, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s6-nodes', 'scale', 0.0, 0.90, 'linear'),
        kf('s6-nodes', 'scale', 2.0, 0.96, 'linear'),
        kf('s6-nodes', 'opacity', 1.85, 1, 'ease-in'),
        kf('s6-nodes', 'opacity', 2.0, 0, 'ease-in'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s6-headline',
      name: 'S6 · Headline "AUTOMATION"',
      trackId: 'track-v6-hero-type',
      startTime: 11.0,
      duration: 2.0,
      content: 'AUTOMA-\nTION.',
      x: 0,
      y: -580,
      scale: 0.95,
      opacity: 0,
      style: {
        fontSize: 104,
        fontWeight: 900,
        color: '#FFFFFF',
        align: 'center',
        letterSpacing: -2,
      },
      keyframes: [
        kf('s6-head', 'opacity', 0.0, 0, 'ease-out'),
        kf('s6-head', 'opacity', 0.2, 1, 'ease-out'),
        kf('s6-head', 'y', 0.0, -520, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s6-head', 'y', 0.4, -580, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s6-head', 'opacity', 1.8, 1, 'ease-in'),
        kf('s6-head', 'opacity', 2.0, 0, 'ease-in'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s6-service-tag',
      name: 'S6 · Service Tag [04 / AUTONOMOUS WORKFLOWS]',
      trackId: 'track-v5-sub-type',
      startTime: 11.15,
      duration: 1.85,
      content: 'SERVICE 04 • ZERO BOTTLENECK WORKFLOWS',
      x: 0,
      y: -440,
      scale: 1,
      opacity: 0,
      style: {
        fontSize: 18,
        fontWeight: 700,
        color: '#D7E83F',
        align: 'center',
        letterSpacing: 3,
      },
      keyframes: [
        kf('s6-tag', 'opacity', 0.0, 0, 'ease-out'),
        kf('s6-tag', 'opacity', 0.2, 1, 'ease-out'),
        kf('s6-tag', 'opacity', 1.7, 1, 'ease-in'),
        kf('s6-tag', 'opacity', 1.85, 0, 'ease-in'),
      ],
    })
  );

  // =========================================================================
  // SCENE 7: BRAND OUTRO (0:13 - 0:15, 13.0s - 15.0s)
  // Authentic Angora Logo + CTA "Let's Work Together." (Hold time)
  // =========================================================================
  clips.push(
    makeVisualMediaClip({
      id: 'clip-s7-logo-monogram',
      name: 'S7 · Angora Ribbon-A Monogram',
      trackId: 'track-v4-brand-overlays',
      asset: symbolAsset,
      startTime: 13.0,
      duration: 2.0,
      x: 0,
      y: -240,
      scale: 0.62,
      opacity: 0,
      keyframes: [
        kf('s7-logo', 'opacity', 0.0, 0, 'ease-out'),
        kf('s7-logo', 'opacity', 0.3, 1, 'ease-out'),
        kf('s7-logo', 'scale', 0.0, 0.52, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s7-logo', 'scale', 0.45, 0.62, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s7-logo', 'scale', 2.0, 0.64, 'linear'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s7-wordmark',
      name: 'S7 · Wordmark "ANGORA WEB SERVICES"',
      trackId: 'track-v6-hero-type',
      startTime: 13.15,
      duration: 1.85,
      content: 'ANGORA WEB SERVICES',
      x: 0,
      y: 60,
      scale: 1,
      opacity: 0,
      style: {
        fontSize: 48,
        fontWeight: 900,
        color: '#FFFFFF',
        align: 'center',
        letterSpacing: 2,
      },
      keyframes: [
        kf('s7-wm', 'opacity', 0.0, 0, 'ease-out'),
        kf('s7-wm', 'opacity', 0.25, 1, 'ease-out'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s7-messaging',
      name: 'S7 · Core Message "Your Agency. Our Execution."',
      trackId: 'track-v5-sub-type',
      startTime: 13.3,
      duration: 1.7,
      content: 'YOUR AGENCY. OUR EXECUTION.',
      x: 0,
      y: 160,
      scale: 1,
      opacity: 0,
      style: {
        fontSize: 28,
        fontWeight: 700,
        color: '#D7E83F',
        align: 'center',
        letterSpacing: 3,
      },
      keyframes: [
        kf('s7-msg', 'opacity', 0.0, 0, 'ease-out'),
        kf('s7-msg', 'opacity', 0.25, 1, 'ease-out'),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s7-final-cta',
      name: 'S7 · Final CTA "Let\'s Work Together."',
      trackId: 'track-v6-hero-type',
      startTime: 13.6,
      duration: 1.4,
      content: "LET'S WORK TOGETHER.",
      x: 0,
      y: 360,
      scale: 1,
      opacity: 0,
      style: {
        fontSize: 34,
        fontWeight: 900,
        color: '#0B0F0B',
        backgroundColor: '#D7E83F',
        backgroundOpacity: 1.0,
        align: 'center',
        letterSpacing: 2,
        paddingX: 32,
        paddingY: 16,
        borderRadius: 12,
      },
      keyframes: [
        kf('s7-cta', 'opacity', 0.0, 0, 'ease-out'),
        kf('s7-cta', 'opacity', 0.25, 1, 'ease-out'),
        kf('s7-cta', 'scale', 0.0, 0.92, 'cubic-bezier', [0.16, 1, 0.3, 1]),
        kf('s7-cta', 'scale', 0.3, 1.0, 'cubic-bezier', [0.16, 1, 0.3, 1]),
      ],
    }),
    makeTextLayerClip({
      id: 'clip-s7-url',
      name: 'S7 · URL [angora.studio]',
      trackId: 'track-v5-sub-type',
      startTime: 13.75,
      duration: 1.25,
      content: 'angora.studio • @angorawebservices',
      x: 0,
      y: 470,
      scale: 1,
      opacity: 0,
      style: {
        fontSize: 18,
        fontWeight: 600,
        color: '#FFFFFF',
        align: 'center',
        letterSpacing: 2,
      },
      keyframes: [
        kf('s7-url', 'opacity', 0.0, 0, 'ease-out'),
        kf('s7-url', 'opacity', 0.25, 0.85, 'ease-out'),
      ],
    })
  );

  return {
    id: ANGORA_EDITORIAL_PROMO_PROJECT_ID,
    name: ANGORA_EDITORIAL_PROMO_PROJECT_NAME,
    resolution: '1080p',
    aspectRatio: '9:16',
    fps: 30,
    tracks,
    clips,
    mediaAssets,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
