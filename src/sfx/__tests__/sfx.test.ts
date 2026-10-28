import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundboxAdapter } from '../SoundboxAdapter';
import {
  CURATED_SOUND_LIBRARY,
  searchSoundLibrary,
  analyzeTimelineForSoundDesign,
} from '../soundLibrary';
import { DEFAULT_AUDIO_DSP } from '../types';
import type { TimelineClip } from '../../types/editor';

describe('MotionLab 3.0 — Sound FX Studio Test Suite', () => {
  describe('SoundboxAdapter', () => {
    it('returns a singleton instance', () => {
      const a1 = SoundboxAdapter.getInstance();
      const a2 = SoundboxAdapter.getInstance();
      expect(a1).toBe(a2);
    });

    it('lists available neural synthesis models', async () => {
      const adapter = SoundboxAdapter.getInstance();
      const models = await adapter.listModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.id === 'stable-audio-sfx-small' || m.id === 'audiocraft-small')).toBe(true);
    });

    it('validates audio buffer and detects silent vs audible signals correctly', () => {
      const adapter = SoundboxAdapter.getInstance();
      
      // Access private analyzeAudioBuffer using prototype trick
      const mockAudibleBuffer = {
        numberOfChannels: 1,
        sampleRate: 44100,
        duration: 1.0,
        getChannelData: () => new Float32Array([0.1, 0.5, 0.8, -0.4, 0.2]),
      } as unknown as AudioBuffer;

      // @ts-expect-error accessing private method for unit test
      const report = adapter.analyzeAudioBuffer(mockAudibleBuffer);
      expect(report.isValid).toBe(true);
      expect(report.hasSilence).toBe(false);
      expect(report.peakDb).toBeGreaterThan(-10);
    });

    it('extracts normalized waveform peaks with specified bucket count', () => {
      const adapter = SoundboxAdapter.getInstance();
      const mockBuffer = {
        numberOfChannels: 1,
        sampleRate: 44100,
        duration: 1.0,
        getChannelData: () =>
          new Float32Array(Array.from({ length: 640 }, (_, i) => Math.sin(i / 10))),
      } as unknown as AudioBuffer;

      // @ts-expect-error accessing private method for unit test
      const peaks = adapter.extractWaveformPeaks(mockBuffer, 32);
      expect(peaks.length).toBe(32);
      expect(peaks.every((p: number) => p >= 0 && p <= 1.0)).toBe(true);
    });
  });

  describe('Curated Sound Library', () => {
    it('contains master sounds spanning essential motion categories', () => {
      expect(CURATED_SOUND_LIBRARY.length).toBeGreaterThanOrEqual(14);
      const categories = new Set(CURATED_SOUND_LIBRARY.map((s) => s.category));
      expect(categories.has('Whooshes')).toBe(true);
      expect(categories.has('Impacts')).toBe(true);
      expect(categories.has('UI Clicks')).toBe(true);
      expect(categories.has('Transitions')).toBe(true);
      expect(categories.has('Risers')).toBe(true);
      expect(categories.has('Drops')).toBe(true);
      expect(categories.has('Paper & Foley')).toBe(true);
      expect(categories.has('Technology')).toBe(true);
      expect(categories.has('Cinematic')).toBe(true);
      expect(categories.has('Logo Stingers')).toBe(true);
    });

    it('filters library sounds by category', () => {
      const whooshes = searchSoundLibrary({ category: 'Whooshes' });
      expect(whooshes.length).toBeGreaterThanOrEqual(2);
      expect(whooshes.every((w) => w.category === 'Whooshes')).toBe(true);
    });

    it('searches library sounds by text query across name, description and tags', () => {
      const impacts = searchSoundLibrary({ query: 'boom' });
      expect(impacts.length).toBeGreaterThanOrEqual(1);
      expect(impacts[0].name.toLowerCase()).toContain('boom');
    });
  });

  describe('Auto Sound Design Agent', () => {
    it('analyzes video cuts and kinetic typography to generate synchronized cues', () => {
      const mockClips: TimelineClip[] = [
        {
          id: 'clip-video-1',
          trackId: 'track-v1',
          type: 'video',
          name: 'Hero Intro Video',
          startTime: 0,
          duration: 3.5,
          inPoint: 0,
          outPoint: 3.5,
          sourceDuration: 3.5,
          playbackSpeed: 1,
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          crop: { top: 0, right: 0, bottom: 0, left: 0 },
          effects: { brightness: 0, contrast: 0, saturation: 0, exposure: 0, blur: 0, grayscale: 0, sepia: 0, flipH: false, flipV: false },
          volume: 1,
          muted: false,
          fadeIn: 0,
          fadeOut: 0,
          transitionIn: { type: 'none', duration: 0 },
          transitionOut: { type: 'none', duration: 0 },
          keyframes: [],
        },
        {
          id: 'clip-text-1',
          trackId: 'track-v2',
          type: 'text',
          name: 'Kinetic Headline',
          startTime: 1.2,
          duration: 2.0,
          inPoint: 0,
          outPoint: 2.0,
          sourceDuration: 2.0,
          playbackSpeed: 1,
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          crop: { top: 0, right: 0, bottom: 0, left: 0 },
          effects: { brightness: 0, contrast: 0, saturation: 0, exposure: 0, blur: 0, grayscale: 0, sepia: 0, flipH: false, flipV: false },
          volume: 1,
          muted: false,
          fadeIn: 0,
          fadeOut: 0,
          transitionIn: { type: 'none', duration: 0 },
          transitionOut: { type: 'none', duration: 0 },
          keyframes: [],
        },
        {
          id: 'clip-video-2',
          trackId: 'track-v1',
          type: 'video',
          name: 'Second Scene Cut',
          startTime: 3.5,
          duration: 3.0,
          inPoint: 0,
          outPoint: 3.0,
          sourceDuration: 3.0,
          playbackSpeed: 1,
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          crop: { top: 0, right: 0, bottom: 0, left: 0 },
          effects: { brightness: 0, contrast: 0, saturation: 0, exposure: 0, blur: 0, grayscale: 0, sepia: 0, flipH: false, flipV: false },
          volume: 1,
          muted: false,
          fadeIn: 0,
          fadeOut: 0,
          transitionIn: { type: 'none', duration: 0 },
          transitionOut: { type: 'none', duration: 0 },
          keyframes: [],
        },
      ];

      const cues = analyzeTimelineForSoundDesign(mockClips);
      expect(cues.length).toBe(3);

      // Intro impact at timestamp 0
      const introCue = cues.find((c) => c.timestamp === 0);
      expect(introCue).toBeDefined();
      expect(introCue?.category).toBe('Impacts');

      // Typography whoosh at 1.2s
      const textCue = cues.find((c) => c.eventType === 'typography');
      expect(textCue).toBeDefined();
      expect(textCue?.timestamp).toBe(1.2);
      expect(textCue?.category).toBe('Whooshes');

      // Transition cut at 3.5s
      const cutCue = cues.find((c) => c.timestamp === 3.5);
      expect(cutCue).toBeDefined();
      expect(cutCue?.eventType).toBe('transition');
    });
  });

  describe('Audio DSP Parameters', () => {
    it('provides broadcast-grade default DSP settings', () => {
      expect(DEFAULT_AUDIO_DSP.gainDb).toBe(0);
      expect(DEFAULT_AUDIO_DSP.pan).toBe(0);
      expect(DEFAULT_AUDIO_DSP.lowCutHz).toBeGreaterThanOrEqual(20);
      expect(DEFAULT_AUDIO_DSP.highCutHz).toBeLessThanOrEqual(20000);
      expect(DEFAULT_AUDIO_DSP.compressionRatio).toBeGreaterThan(1);
    });
  });
});
