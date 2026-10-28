/**
 * MotionLab Creative Intelligence Engine (MCIE) — Scene Compiler
 * Compiles high-level StoryboardScenes and ProductionPlans into native MotionLab
 * TimelineTrack[], TimelineClip[], and ProjectData structures.
 */

import type {
  AspectRatio,
  ClipType,
  FrameRate,
  ProjectData,
  ResolutionPreset,
  TimelineClip,
  TimelineTrack,
} from '../../types/editor';
import type { ProductionPlan, StoryboardLayerSpec, StoryboardScene } from '../types';
import { MotionPresetEngine } from './MotionPresetEngine';

export interface CompilationResult {
  project: ProjectData;
  trackCount: number;
  clipCount: number;
  totalDuration: number;
  validationWarnings: string[];
}

export class SceneCompiler {
  /**
   * Compiles a full ProductionPlan into a native MotionLab ProjectData object
   */
  public static compile(plan: ProductionPlan, projectId?: string): CompilationResult {
    const brief = plan.brief;
    const warnings: string[] = [];

    const id = projectId || `mcie-proj-${Date.now()}`;
    const name = brief.title || 'Untitled MCIE Production';
    const aspectRatio: AspectRatio = brief.aspectRatio || '16:9';
    const resolution: ResolutionPreset = brief.resolution || '1080p';
    const fps: FrameRate = brief.fps || 30;

    // Define standard track hierarchy (Layer 0 on top)
    const tracks: TimelineTrack[] = [
      { id: 'track-text-upper', name: 'Text & Titles', type: 'text', order: 0, muted: false, visible: true, locked: false },
      { id: 'track-text-lower', name: 'Subtext & Badges', type: 'text', order: 1, muted: false, visible: true, locked: false },
      { id: 'track-overlay', name: 'Motion Graphics', type: 'overlay', order: 2, muted: false, visible: true, locked: false },
      { id: 'track-media', name: 'Media & Elements', type: 'video', order: 3, muted: false, visible: true, locked: false },
      { id: 'track-bg', name: 'Background Canvas', type: 'video', order: 4, muted: false, visible: true, locked: false },
      { id: 'track-audio', name: 'Soundtrack & SFX', type: 'audio', order: 5, muted: false, visible: true, locked: false },
    ];

    const clips: TimelineClip[] = [];

    // Calculate scene time offsets to ensure gapless sequential playback
    let currentTimelineTime = 0;

    for (const scene of plan.scenes) {
      const sceneStart = currentTimelineTime;
      const sceneDuration = scene.duration;

      for (const layer of scene.layers) {
        const clip = this.compileLayerToClip(layer, sceneStart, sceneDuration, tracks);
        if (clip) {
          clips.push(clip);
        }
      }

      // Add audio cue if present
      if (scene.soundCue) {
        clips.push({
          id: `cue-${scene.id}-${Date.now().toString(36)}`,
          name: `SFX: ${scene.soundCue.assetIdOrName}`,
          trackId: 'track-audio',
          type: 'audio',
          startTime: sceneStart,
          duration: Math.min(sceneDuration, 3.0),
          inPoint: 0,
          outPoint: Math.min(sceneDuration, 3.0),
          sourceDuration: 10,
          playbackSpeed: 1,
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          crop: { top: 0, right: 0, bottom: 0, left: 0 },
          effects: { brightness: 0, contrast: 0, saturation: 0, exposure: 0, blur: 0, grayscale: 0, sepia: 0, flipH: false, flipV: false },
          volume: scene.soundCue.volume ?? 0.8,
          muted: false,
          fadeIn: scene.soundCue.fadeIn ?? 0.05,
          fadeOut: scene.soundCue.fadeOut ?? 0.1,
          transitionIn: { type: 'none', duration: 0 },
          transitionOut: { type: 'none', duration: 0 },
          keyframes: [],
        });
      }

      currentTimelineTime += sceneDuration;
    }

    // Check duration matches brief
    if (Math.abs(currentTimelineTime - brief.durationSeconds) > 0.5) {
      warnings.push(`Compiled timeline duration (${currentTimelineTime.toFixed(1)}s) differs from target brief (${brief.durationSeconds}s)`);
    }

    const project: ProjectData = {
      id,
      name,
      aspectRatio,
      resolution,
      fps,
      tracks,
      clips,
      mediaAssets: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return {
      project,
      trackCount: tracks.length,
      clipCount: clips.length,
      totalDuration: currentTimelineTime,
      validationWarnings: warnings,
    };
  }

  private static compileLayerToClip(
    layer: StoryboardLayerSpec,
    sceneStart: number,
    sceneDuration: number,
    tracks: TimelineTrack[]
  ): TimelineClip | null {
    const layerStart = sceneStart + (layer.startTime || 0);
    const layerDuration = Math.min(layer.duration || sceneDuration, sceneDuration);

    // Pick target track
    let targetTrackId = 'track-overlay';
    if (layer.trackType === 'text') {
      targetTrackId = layer.order <= 1 ? 'track-text-upper' : 'track-text-lower';
    } else if (layer.trackType === 'audio') {
      targetTrackId = 'track-audio';
    } else if (layer.type === 'shape' && (layer.shapeType === 'rectangle' || layer.name.toLowerCase().includes('bg') || layer.name.toLowerCase().includes('background'))) {
      targetTrackId = 'track-bg';
    } else if (layer.trackType === 'video') {
      targetTrackId = 'track-media';
    }

    let clipType: ClipType = 'image';
    if (layer.type === 'text') clipType = 'text';
    else if (layer.type === 'audio') clipType = 'audio';
    else if (layer.type === 'shape') clipType = 'image';

    const clipId = layer.id || `clip-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const clip: TimelineClip = {
      id: clipId,
      name: layer.name,
      trackId: targetTrackId,
      type: clipType,
      startTime: layerStart,
      duration: layerDuration,
      inPoint: 0,
      outPoint: layerDuration,
      sourceDuration: Infinity,
      playbackSpeed: 1,
      x: layer.layout.x,
      y: layer.layout.y,
      scale: layer.scale ?? 1.0,
      rotation: layer.rotation ?? 0,
      opacity: layer.opacity ?? 1.0,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      mask: layer.maskShape && layer.maskShape !== 'none' ? {
        shape: layer.maskShape === 'circle' ? 'circle' : layer.maskShape === 'linear-wipe' ? 'linear-wipe' : 'rectangle',
        centerX: 0,
        centerY: 0,
        width: 100,
        height: 100,
        radius: layer.maskShape === 'circle' ? 100 : 0,
        feather: 0,
        rotation: 0,
        invert: false,
        expansion: 0,
      } : {
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
      },
      effects: {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        exposure: 0,
        blur: 0,
        grayscale: 0,
        sepia: 0,
        flipH: false,
        flipV: false,
      },
      volume: layer.audioVolume ?? 1.0,
      muted: false,
      fadeIn: 0,
      fadeOut: 0,
      transitionIn: { type: 'none', duration: 0.5 },
      transitionOut: { type: 'none', duration: 0.5 },
      parentId: layer.parentId,
      keyframes: [],
    };

    // Configure text styling
    if (layer.type === 'text') {
      clip.textStyle = {
        content: layer.content || 'Sample Text',
        fontFamily: layer.fontFamily || 'Inter, sans-serif',
        fontSize: layer.fontSize || 48,
        fontWeight: layer.fontWeight || 600,
        color: layer.color || '#FFFFFF',
        align: 'center',
        backgroundColor: layer.backgroundColor || '#000000',
        backgroundOpacity: layer.backgroundColor ? 0.8 : 0,
        shadowColor: 'rgba(0, 0, 0, 0.4)',
        shadowBlur: 8,
        strokeColor: '#000000',
        strokeWidth: 0,
        animationIn: 'none',
        animationOut: 'none',
        animationDuration: 0.5,
        letterSpacing: 0,
      };
    }

    // Configure shape styling
    if (layer.type === 'shape') {
      clip.shapeStyle = {
        shapeType: layer.shapeType || 'rectangle',
        width: layer.layout.width || 600,
        height: layer.layout.height || 400,
        fillColor: layer.fillColor || '#172018',
        fillOpacity: 1,
        strokeColor: layer.strokeColor || '#D7E83F',
        strokeWidth: layer.strokeWidth || 2,
      };
    }

    // Apply motion preset if configured
    if (layer.motion && layer.motion.presetName) {
      clip.keyframes = MotionPresetEngine.generateKeyframes(layer.motion.presetName, {
        clipDuration: layerDuration,
        enterDuration: layer.motion.enterDuration,
        exitDuration: layer.motion.exitDuration,
        easing: layer.motion.enterEasing,
        direction: layer.motion.direction,
        overshoot: layer.motion.overshoot,
        staggerIndex: layer.order,
        staggerDelay: layer.motion.staggerDelay,
      });
    }

    return clip;
  }
}
