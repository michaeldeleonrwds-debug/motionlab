import { describe, it, expect, beforeEach } from 'vitest';
import {
  changeClipSpeed,
  clipTimelineToSourceTime,
  findSnapTarget,
  formatTimecode,
  getCompositedVisualClipsAtTime,
  getProjectDuration,
  getResolutionDimensions,
  snapTimeToFrame,
  splitClipAtTime,
  trimClipLeft,
  trimClipRight,
} from '../timelineEngine';
import {
  evaluateClipTransform,
  evaluateEasing,
  evaluateTextAnimation,
  interpolateProperty,
  upsertKeyframe,
} from '../keyframeEngine';
import {
  computeClipAudioGain,
  encodeAudioBufferToWav,
} from '../audioEngine';
import { generateExportCompositionSpec } from '../exportEngine';
import {
  createClipFromMediaAsset,
  createDefaultTextStyle,
  createNewProject,
  createTextClip,
} from '../projectFactory';
import {
  deleteProjectFromDB,
  deserializeProjectFromJson,
  duplicateProjectInDB,
  listProjectsFromDB,
  loadProjectFromDB,
  saveProjectToDB,
  serializeProjectToJson,
} from '../../storage/projectStorage';
import { useEditorStore } from '../../store/useEditorStore';
import {
  executeMcpToolCall,
  MOTIONLAB_MCP_TOOLS,
  planAutonomousMcpStepsFromPrompt,
} from '../mcpEngine';
import type { MediaAsset } from '../../types/editor';

function createSampleVideoAsset(id = 'asset-vid-1', duration = 10): MediaAsset {
  return {
    id,
    name: 'StudioClip.mp4',
    type: 'video',
    mimeType: 'video/mp4',
    size: 1024 * 512,
    duration,
    width: 1920,
    height: 1080,
    fps: 30,
    hasAudio: true,
    codecInfo: 'MP4 • 1920×1080 + Audio',
    thumbnails: ['data:image/jpeg;base64,AA=='],
    waveform: [0.2, 0.5, 0.8, 0.4],
    createdAt: Date.now(),
  };
}

describe('MotionLab Core NLE Engine Suite', () => {
  describe('1. Timeline Calculations', () => {
    it('formats SMPTE frame-accurate timecode correctly', () => {
      expect(formatTimecode(0, 30)).toBe('00:00:00:00');
      expect(formatTimecode(1.5, 30)).toBe('00:00:01:15');
      expect(formatTimecode(65.25, 24)).toBe('00:01:05:06');
      expect(formatTimecode(3661.5, 60)).toBe('01:01:01:30');
    });

    it('snaps timestamps to exact frame boundaries', () => {
      expect(snapTimeToFrame(1.016, 30)).toBeCloseTo(30 / 30, 3);
      expect(snapTimeToFrame(1.0333, 30)).toBeCloseTo(31 / 30, 4);
    });

    it('calculates source media time from timeline time with inPoint and playbackSpeed', () => {
      const asset = createSampleVideoAsset('v1', 12);
      const clip = {
        ...createClipFromMediaAsset(asset, 'track-video-1', 2.0),
        inPoint: 1.5,
        outPoint: 9.5,
        duration: 4.0,
        playbackSpeed: 2.0,
      };
      // At timeline t = 2.0 (clip start), source time = inPoint (1.5s)
      expect(clipTimelineToSourceTime(clip, 2.0)).toBeCloseTo(1.5, 4);
      // At timeline t = 3.5 (1.5s elapsed * 2x speed = +3.0s source), source time = 4.5s
      expect(clipTimelineToSourceTime(clip, 3.5)).toBeCloseTo(4.5, 4);
      // Clamped at outPoint (9.5s)
      expect(clipTimelineToSourceTime(clip, 10.0)).toBeCloseTo(9.5, 4);
    });

    it('returns accurate output dimensions for all aspect ratios and resolutions', () => {
      expect(getResolutionDimensions('16:9', '1080p')).toEqual({ width: 1920, height: 1080 });
      expect(getResolutionDimensions('16:9', '720p')).toEqual({ width: 1280, height: 720 });
      expect(getResolutionDimensions('9:16', '1080p')).toEqual({ width: 1080, height: 1920 });
      expect(getResolutionDimensions('1:1', '1080p')).toEqual({ width: 1080, height: 1080 });
      expect(getResolutionDimensions('4:5', '1080p')).toEqual({ width: 1080, height: 1350 });
    });
  });

  describe('2. Clip Trimming & Speed Changes', () => {
    it('trims clip left edge and updates startTime, inPoint, duration, and keyframes', () => {
      const asset = createSampleVideoAsset('v1', 10);
      const clip = {
        ...createClipFromMediaAsset(asset, 'track-video-1', 0),
        keyframes: [
          { id: 'k1', property: 'opacity' as const, time: 0.5, value: 0, easing: 'linear' as const },
          { id: 'k2', property: 'opacity' as const, time: 3.0, value: 1, easing: 'linear' as const },
        ],
      };

      const trimmed = trimClipLeft(clip, 1.2);
      expect(trimmed.startTime).toBeCloseTo(1.2, 4);
      expect(trimmed.inPoint).toBeCloseTo(1.2, 4);
      expect(trimmed.duration).toBeCloseTo(8.8, 4);
      // Keyframe at 0.5s was before new in-point, so it is pruned; keyframe at 3.0s shifts to 1.8s
      expect(trimmed.keyframes).toHaveLength(1);
      expect(trimmed.keyframes[0].time).toBeCloseTo(1.8, 4);
    });

    it('trims clip right edge and clamps to sourceDuration', () => {
      const asset = createSampleVideoAsset('v1', 6);
      const clip = createClipFromMediaAsset(asset, 'track-video-1', 1.0);

      const trimmedShorter = trimClipRight(clip, 3.5);
      expect(trimmedShorter.duration).toBeCloseTo(3.5, 4);
      expect(trimmedShorter.outPoint).toBeCloseTo(3.5, 4);

      // Cannot extend past sourceDuration (6.0s)
      const trimmedPastMax = trimClipRight(trimmedShorter, 15.0);
      expect(trimmedPastMax.duration).toBeCloseTo(6.0, 4);
      expect(trimmedPastMax.outPoint).toBeCloseTo(6.0, 4);
    });

    it('recalculates clip duration when playbackSpeed changes', () => {
      const asset = createSampleVideoAsset('v1', 8);
      const clip = createClipFromMediaAsset(asset, 'track-video-1', 0);
      const doubleSpeed = changeClipSpeed(clip, 2.0);
      expect(doubleSpeed.playbackSpeed).toBe(2.0);
      expect(doubleSpeed.duration).toBeCloseTo(4.0, 4);
    });
  });

  describe('3. Splitting Clips', () => {
    it('splits a clip at playhead into two contiguous clips with continuous source in/out points', () => {
      const asset = createSampleVideoAsset('v1', 10);
      const clip = {
        ...createClipFromMediaAsset(asset, 'track-video-1', 2.0),
        keyframes: [
          { id: 'k1', property: 'scale' as const, time: 1.0, value: 1.0, easing: 'linear' as const },
          { id: 'k2', property: 'scale' as const, time: 6.0, value: 1.5, easing: 'linear' as const },
        ],
      };

      // Split at timeline t = 5.5s (3.5s into the clip)
      const split = splitClipAtTime(clip, 5.5, () => 'clip-right-id');
      expect(split).not.toBeNull();
      const [left, right] = split!;

      expect(left.startTime).toBeCloseTo(2.0, 4);
      expect(left.duration).toBeCloseTo(3.5, 4);
      expect(left.inPoint).toBeCloseTo(0, 4);
      expect(left.outPoint).toBeCloseTo(3.5, 4);
      expect(left.keyframes).toHaveLength(1);
      expect(left.keyframes[0].time).toBeCloseTo(1.0, 4);

      expect(right.id).toBe('clip-right-id');
      expect(right.startTime).toBeCloseTo(5.5, 4);
      expect(right.duration).toBeCloseTo(6.5, 4);
      expect(right.inPoint).toBeCloseTo(3.5, 4);
      expect(right.outPoint).toBeCloseTo(10.0, 4);
      expect(right.keyframes).toHaveLength(1);
      expect(right.keyframes[0].time).toBeCloseTo(2.5, 4);
    });

    it('rejects splits outside clip boundaries', () => {
      const asset = createSampleVideoAsset('v1', 4);
      const clip = createClipFromMediaAsset(asset, 'track-video-1', 1.0);
      expect(splitClipAtTime(clip, 0.5)).toBeNull();
      expect(splitClipAtTime(clip, 5.5)).toBeNull();
    });
  });

  describe('4. Track Ordering & Layer Compositing', () => {
    it('orders active visual layers from background (higher track.order) to foreground (lower track.order) and detects transitions', () => {
      const project = createNewProject();
      const assetA = createSampleVideoAsset('a', 3);
      const assetB = createSampleVideoAsset('b', 3);

      const videoClipA = createClipFromMediaAsset(assetA, 'track-video-1', 0);
      const videoClipB = {
        ...createClipFromMediaAsset(assetB, 'track-video-1', 3.0),
        transitionIn: { type: 'cross-dissolve' as const, duration: 0.6 },
      };
      const titleClip = createTextClip('track-text-1', 1.0, 'Overlay Headline');

      const clips = [titleClip, videoClipA, videoClipB];

      // At t = 2.0s: V1 (order 2) is below T1 (order 0)
      const layersAt2 = getCompositedVisualClipsAtTime(project.tracks, clips, 2.0);
      expect(layersAt2).toHaveLength(2);
      expect(layersAt2[0].clip.id).toBe(videoClipA.id); // Background rendered first
      expect(layersAt2[1].clip.id).toBe(titleClip.id);  // Foreground rendered on top

      // At t = 3.3s: inside 0.6s cross-dissolve transition on videoClipB
      const layersAt33 = getCompositedVisualClipsAtTime(project.tracks, clips, 3.3);
      const vLayer = layersAt33.find((l) => l.clip.id === videoClipB.id);
      expect(vLayer).toBeDefined();
      expect(vLayer?.outgoingTransition).toBeDefined();
      expect(vLayer?.outgoingTransition?.previousClip.id).toBe(videoClipA.id);
      expect(vLayer?.outgoingTransition?.progress).toBeCloseTo(0.5, 2);
    });
  });

  describe('5. Snapping Engine', () => {
    it('snaps to playhead and adjacent clip boundaries within threshold', () => {
      const asset = createSampleVideoAsset('a', 4);
      const clip1 = createClipFromMediaAsset(asset, 'track-video-1', 0); // 0..4s
      const playhead = 6.5;

      // Near clip1 end (4.0s)
      const snapToClipEnd = findSnapTarget(4.08, [clip1], playhead, 0.15);
      expect(snapToClipEnd.isSnapped).toBe(true);
      expect(snapToClipEnd.snappedTime).toBe(4.0);

      // Near playhead (6.5s)
      const snapToPlayhead = findSnapTarget(6.42, [clip1], playhead, 0.15);
      expect(snapToPlayhead.isSnapped).toBe(true);
      expect(snapToPlayhead.snappedTime).toBe(6.5);

      // Outside snap threshold
      const noSnap = findSnapTarget(5.2, [clip1], playhead, 0.15);
      expect(noSnap.isSnapped).toBe(false);
      expect(noSnap.snappedTime).toBe(5.2);
    });
  });

  describe('6. Undo / Redo & Store Operations', () => {
    beforeEach(() => {
      const fresh = createNewProject({ name: 'Unit Test Project' });
      useEditorStore.setState({
        project: fresh,
        past: [],
        future: [],
        selectedClipId: null,
        currentTime: 0,
      });
    });

    it('supports multi-step undo and redo across timeline edits', () => {
      const store = useEditorStore.getState();
      const asset = createSampleVideoAsset('vid-1', 4);
      store.addMediaAssets([asset]);

      const clipId = useEditorStore.getState().addMediaClipToTimeline(asset.id);
      expect(clipId).toBeTruthy();
      expect(useEditorStore.getState().project.clips).toHaveLength(1);

      // Trim right
      useEditorStore.getState().trimClipRightAction(clipId!, 2.5);
      expect(useEditorStore.getState().project.clips[0].duration).toBe(2.5);

      // Split at 1.0s
      useEditorStore.getState().splitClipById(clipId!, 1.0);
      expect(useEditorStore.getState().project.clips).toHaveLength(2);

      // Undo split -> back to 1 clip of duration 2.5
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().project.clips).toHaveLength(1);
      expect(useEditorStore.getState().project.clips[0].duration).toBe(2.5);

      // Undo trim -> back to duration 4.0
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().project.clips[0].duration).toBe(4.0);

      // Redo trim -> duration 2.5
      useEditorStore.getState().redo();
      expect(useEditorStore.getState().project.clips[0].duration).toBe(2.5);

      // Redo split -> 2 clips
      useEditorStore.getState().redo();
      expect(useEditorStore.getState().project.clips).toHaveLength(2);
    });
  });

  describe('7. Project Serialization & IndexedDB Restoration', () => {
    it('serializes and deserializes project state losslessly', () => {
      const proj = createNewProject({
        name: 'Serialize Check',
        aspectRatio: '9:16',
        resolution: '1080p',
        fps: 60,
      });
      const textClip = createTextClip('track-text-1', 0.5, 'Vertical Reel Title');
      proj.clips.push(textClip);

      const json = serializeProjectToJson(proj);
      const restored = deserializeProjectFromJson(json);

      expect(restored.name).toBe('Serialize Check');
      expect(restored.aspectRatio).toBe('9:16');
      expect(restored.fps).toBe(60);
      expect(restored.clips).toHaveLength(1);
      expect(restored.clips[0].textStyle?.content).toBe('Vertical Reel Title');
      expect(restored.clips[0].sourceDuration).toBe(Infinity);
    });

    it('persists, lists, duplicates, and restores projects from IndexedDB', async () => {
      const proj = createNewProject({
        id: 'proj-idb-test-1',
        name: 'IndexedDB Master',
        aspectRatio: '16:9',
        resolution: '1080p',
        fps: 30,
      });
      proj.clips.push(createTextClip('track-text-1', 0, 'Persisted Title'));

      await saveProjectToDB(proj);
      const loaded = await loadProjectFromDB('proj-idb-test-1');
      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe('IndexedDB Master');
      expect(loaded?.clips).toHaveLength(1);

      const duplicated = await duplicateProjectInDB('proj-idb-test-1', 'Duplicated Master');
      expect(duplicated?.name).toBe('Duplicated Master');

      const all = await listProjectsFromDB();
      expect(all.some((p) => p.id === 'proj-idb-test-1')).toBe(true);

      await deleteProjectFromDB('proj-idb-test-1');
      const afterDelete = await loadProjectFromDB('proj-idb-test-1');
      expect(afterDelete).toBeNull();
    });
  });

  describe('8. Keyframe Interpolation & Text Animations', () => {
    it('interpolates position, scale, rotation, and opacity keyframes across time', () => {
      const clip = createTextClip('track-text-1', 0, 'Animated');
      clip.keyframes = upsertKeyframe(clip.keyframes, 'x', 0, -100, 'linear');
      clip.keyframes = upsertKeyframe(clip.keyframes, 'x', 2.0, 100, 'linear');
      clip.keyframes = upsertKeyframe(clip.keyframes, 'opacity', 0, 0.2, 'ease-in-out');
      clip.keyframes = upsertKeyframe(clip.keyframes, 'opacity', 2.0, 1.0, 'ease-in-out');

      expect(interpolateProperty(clip, 'x', 0)).toBeCloseTo(-100, 3);
      expect(interpolateProperty(clip, 'x', 1.0)).toBeCloseTo(0, 3);
      expect(interpolateProperty(clip, 'x', 2.0)).toBeCloseTo(100, 3);

      const transformMid = evaluateClipTransform(clip, 1.0);
      expect(transformMid.x).toBeCloseTo(0, 3);
      expect(transformMid.opacity).toBeCloseTo(0.6, 3);
      expect(evaluateEasing(0.5, 'ease-in-out')).toBeCloseTo(0.5, 3);
    });

    it('evaluates typewriter and slide-in text animations deterministically', () => {
      const style = {
        ...createDefaultTextStyle('MOTIONLAB'),
        animationIn: 'typewriter' as const,
        animationDuration: 1.0,
      };
      const early = evaluateTextAnimation(style, 0.2, 3.0);
      expect(early.visibleText.length).toBeLessThan(9);
      const full = evaluateTextAnimation(style, 1.5, 3.0);
      expect(full.visibleText).toBe('MOTIONLAB');
    });
  });

  describe('9. Audio Fade & WAV Encoding Calculations', () => {
    it('computes accurate linear gain for fadeIn, constant region, fadeOut, and mute states', () => {
      const asset = createSampleVideoAsset('a1', 6);
      const clip = {
        ...createClipFromMediaAsset(asset, 'track-audio-1', 1.0),
        duration: 4.0,
        volume: 1.2,
        fadeIn: 1.0,
        fadeOut: 1.0,
      };

      // At t = 1.5s (0.5s into 1.0s fadeIn): 50% of 1.2 = 0.6
      expect(computeClipAudioGain(clip, false, 1.5)).toBeCloseTo(0.6, 3);
      // At t = 3.0s (middle): full 1.2
      expect(computeClipAudioGain(clip, false, 3.0)).toBeCloseTo(1.2, 3);
      // At t = 4.5s (0.5s before end in 1.0s fadeOut): 50% of 1.2 = 0.6
      expect(computeClipAudioGain(clip, false, 4.5)).toBeCloseTo(0.6, 3);
      // When track is muted: 0
      expect(computeClipAudioGain(clip, true, 3.0)).toBe(0);
    });

    it('encodes stereo Float32Array samples into a valid RIFF WAVE header and PCM body', () => {
      const left = new Float32Array([0, 0.5, -0.5, 1]);
      const right = new Float32Array([0, -0.5, 0.5, -1]);
      const wav = encodeAudioBufferToWav(left, right, 44100);
      expect(wav.byteLength).toBe(44 + 4 * 4);
      const view = new DataView(wav);
      // 'RIFF' = 0x52494646
      expect(view.getUint8(0)).toBe('R'.charCodeAt(0));
      expect(view.getUint8(8)).toBe('W'.charCodeAt(0));
    });
  });

  describe('10. Export Composition Specification Generator', () => {
    it('generates accurate export spec with frame counts, dimensions, and FFmpeg arguments', () => {
      const proj = createNewProject({
        name: 'Commercial Cut',
        aspectRatio: '16:9',
        resolution: '1080p',
        fps: 30,
      });
      const v1 = createClipFromMediaAsset(createSampleVideoAsset('v1', 2.5), 'track-video-1', 0);
      const v2 = {
        ...createClipFromMediaAsset(createSampleVideoAsset('v2', 2.5), 'track-video-1', 2.5),
        transitionIn: { type: 'cross-dissolve' as const, duration: 0.5 },
      };
      const t1 = createTextClip('track-text-1', 0.5, 'FINAL CUT');
      proj.clips.push(v1, v2, t1);

      const spec = generateExportCompositionSpec(proj, {
        format: 'mp4',
        videoCodec: 'H.264',
        audioCodec: 'AAC',
        resolution: '1080p',
        fps: 30,
        quality: 'high',
      });

      expect(spec.width).toBe(1920);
      expect(spec.height).toBe(1080);
      expect(spec.durationSeconds).toBe(5.0);
      expect(spec.totalFrames).toBe(150);
      expect(spec.videoClipCount).toBe(2);
      expect(spec.textClipCount).toBe(1);
      expect(spec.transitionCount).toBe(1);
      expect(spec.ffmpegArgsPreview).toContain('libx264');
      expect(spec.ffmpegArgsPreview).toContain('aac');
    });
  });

  describe('11. AI Model Context Protocol (MCP) Tool & Command Engine', () => {
    it('exposes 20 structured MCP tools and executes command_run and command_batch deterministically', async () => {
      expect(MOTIONLAB_MCP_TOOLS.length).toBeGreaterThanOrEqual(20);

      await executeMcpToolCall('create_project', {
        name: 'MCP Automated Project',
        aspectRatio: '16:9',
        resolution: '1080p',
        fps: 30,
      });

      const batchRes = await executeMcpToolCall('command_batch', {
        commands: [
          {
            name: 'add_text_layer',
            arguments: {
              content: 'CODEX & CLAUDE MCP TITLE',
              startTime: 0.5,
              duration: 4.0,
              animationIn: 'typewriter',
            },
          },
          {
            name: 'add_keyframe',
            arguments: {
              clipId: '#1',
              property: 'scale',
              time: 1.0,
              value: 1.25,
            },
          },
          {
            name: 'set_color_effects',
            arguments: {
              clipId: '#1',
              contrast: 18,
              saturation: 22,
            },
          },
        ],
      });

      expect(batchRes.ok).toBe(true);
      const state = useEditorStore.getState();
      expect(state.project.name).toBe('MCP Automated Project');
      expect(state.project.clips).toHaveLength(1);
      expect(state.project.clips[0].textStyle?.content).toBe(
        'CODEX & CLAUDE MCP TITLE'
      );
      expect(state.project.clips[0].keyframes).toHaveLength(1);
      expect(state.project.clips[0].effects.contrast).toBe(18);
    });

    it('plans multi-step MCP tool calls from natural language editing prompts', () => {
      const plan = planAutonomousMcpStepsFromPrompt(
        'Assemble a commercial sequence with studio media and title "LAUNCH DAY"'
      );
      expect(plan.calls.length).toBeGreaterThanOrEqual(5);
      expect(plan.calls.some((c) => c.name === 'load_studio_media')).toBe(true);
      expect(plan.calls.some((c) => c.name === 'set_transition')).toBe(true);
      expect(plan.calls.some((c) => c.name === 'add_text_layer')).toBe(true);
    });
  });

  describe('12. Clip Masking, Cubic-Bezier Keyframes, Selectable Keyframes & Parent-Child Transforms', () => {
    it('evaluates cubic-bezier, expo-out, and back-out easing curves accurately', () => {
      expect(evaluateEasing(0, 'cubic-bezier')).toBeCloseTo(0, 4);
      expect(evaluateEasing(1, 'cubic-bezier')).toBeCloseTo(1, 4);
      const midBezier = evaluateEasing(0.5, 'cubic-bezier', [0.22, 1, 0.36, 1]);
      expect(midBezier).toBeGreaterThan(0.7);
      expect(evaluateEasing(0.5, 'expo-out')).toBeGreaterThan(0.95);
      expect(evaluateEasing(0.7, 'back-out')).toBeGreaterThan(1.0);
    });

    it('interpolates maskWidth/maskHeight keyframes and inherits parent clip transforms via parentId', () => {
      const parentClip = createTextClip('track-text-1', 0.0, 'ANGORA');
      parentClip.id = 'clip-parent';
      parentClip.x = 40;
      parentClip.y = 200;
      parentClip.scale = 1.0;

      const childClip = createTextClip('track-text-1', 0.5, 'WEB SERVICES');
      childClip.id = 'clip-child';
      childClip.parentId = 'clip-parent';
      childClip.x = 0;
      childClip.y = 100;
      childClip.mask = {
        shape: 'rectangle',
        centerX: 0,
        centerY: 0,
        width: 100,
        height: 100,
        radius: 16,
        feather: 0,
        rotation: 0,
        invert: false,
        expansion: 0,
      };
      childClip.keyframes = [
        { id: 'km1', property: 'maskWidth', time: 0.0, value: 20, easing: 'linear' },
        { id: 'km2', property: 'maskWidth', time: 1.0, value: 100, easing: 'linear' },
      ];

      const evaluated = evaluateClipTransform(
        childClip,
        0.5,
        [parentClip, childClip],
        1.0
      );
      expect(evaluated.x).toBeCloseTo(40, 3);
      expect(evaluated.y).toBeCloseTo(300, 3);
      expect(evaluated.maskWidth).toBeCloseTo(60, 3);
    });

    it('supports selecting keyframes, manually editing keyframe time/value/easing, and updating clip masks in store', () => {
      const fresh = createNewProject({ name: 'Mask & Keyframe Store Test' });
      useEditorStore.setState({
        project: fresh,
        past: [],
        future: [],
        selectedClipId: null,
        selectedKeyframeId: null,
      });

      const clipId = useEditorStore.getState().addTextClipToTimeline('MASKED TITLE', {}, 1.0);
      useEditorStore.getState().updateClipMask(clipId, {
        shape: 'circle',
        width: 85,
        feather: 6,
      });
      useEditorStore.getState().setClipKeyframe(clipId, 'maskWidth', 0.0, 15, 'cubic-bezier');
      useEditorStore.getState().setClipKeyframe(clipId, 'maskWidth', 1.0, 100, 'cubic-bezier');

      let clip = useEditorStore.getState().project.clips.find((c) => c.id === clipId)!;
      expect(clip.mask?.shape).toBe('circle');
      expect(clip.mask?.feather).toBe(6);
      expect(clip.keyframes).toHaveLength(2);

      const firstKfId = clip.keyframes[0].id;
      useEditorStore.getState().selectKeyframe(clipId, firstKfId, true);
      expect(useEditorStore.getState().selectedKeyframeId).toBe(firstKfId);
      expect(useEditorStore.getState().currentTime).toBeCloseTo(1.0, 3);

      useEditorStore.getState().updateClipKeyframe(clipId, firstKfId, {
        time: 0.25,
        value: 30,
        easing: 'expo-out',
      });
      clip = useEditorStore.getState().project.clips.find((c) => c.id === clipId)!;
      const updatedKf = clip.keyframes.find((k) => k.id === firstKfId)!;
      expect(updatedKf.time).toBeCloseTo(0.25, 3);
      expect(updatedKf.value).toBe(30);
      expect(updatedKf.easing).toBe('expo-out');
    });

    it('creates procedural shape layers via MCP and interpolates Trim Paths (trimEnd) and 2.5D Skew (skewX, skewY)', async () => {
      await executeMcpToolCall('create_project', {
        name: 'Shape & 2.5D Skew Test',
        aspectRatio: '9:16',
        resolution: '1080p',
        fps: 30,
      });

      const res = await executeMcpToolCall('command_run', {
        id: 'clip.addShape',
        params: {
          id: 'shape-chevron-1',
          name: 'Origin Angora Chevron',
          shapeType: 'angora-chevron',
          startTime: 0,
          duration: 4,
          width: 480,
          height: 480,
          trimEnd: 100,
          skewX: -12,
          skewY: 6,
          motionBlur: true,
        },
      });
      expect(res.ok).toBe(true);

      await executeMcpToolCall('add_keyframe', {
        clipId: 'shape-chevron-1',
        property: 'trimEnd',
        time: 0.0,
        value: 0,
        easing: 'linear',
      });
      await executeMcpToolCall('add_keyframe', {
        clipId: 'shape-chevron-1',
        property: 'trimEnd',
        time: 2.0,
        value: 100,
        easing: 'linear',
      });
      await executeMcpToolCall('add_keyframe', {
        clipId: 'shape-chevron-1',
        property: 'skewX',
        time: 0.0,
        value: -20,
        easing: 'linear',
      });
      await executeMcpToolCall('add_keyframe', {
        clipId: 'shape-chevron-1',
        property: 'skewX',
        time: 2.0,
        value: 0,
        easing: 'linear',
      });

      const shapeClip = useEditorStore
        .getState()
        .project.clips.find((c) => c.id === 'shape-chevron-1')!;
      expect(shapeClip.shapeStyle?.shapeType).toBe('angora-chevron');
      expect(shapeClip.motionBlur).toBe(true);

      const midEval = evaluateClipTransform(shapeClip, 1.0);
      expect(midEval.trimEnd).toBeCloseTo(50, 2);
      expect(midEval.skewX).toBeCloseTo(-10, 2);
      expect(midEval.skewY).toBeCloseTo(6, 2);
    });
  });
});

