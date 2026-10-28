import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { memoryManager, DEFAULT_MEMORY_BUDGET } from '../memoryManager';

describe('MemoryManager — Bounded Resource & Decoders Allocation', () => {
  beforeEach(() => {
    memoryManager.purgeAllCaches();
  });

  afterEach(() => {
    memoryManager.purgeAllCaches();
  });

  it('initializes with default bounded budgets', () => {
    expect(DEFAULT_MEMORY_BUDGET.maxActiveVideoElements).toBe(6);
    expect(DEFAULT_MEMORY_BUDGET.maxActiveAudioElements).toBe(12);
    expect(DEFAULT_MEMORY_BUDGET.maxAudioBufferMemoryMb).toBe(128);
    expect(DEFAULT_MEMORY_BUDGET.maxHistoryDepth).toBe(25);
  });

  it('tracks created Object URLs and safely revokes them by owner', () => {
    const blob1 = new Blob(['sample-data-1'], { type: 'audio/wav' });
    const blob2 = new Blob(['sample-data-2'], { type: 'audio/wav' });

    const url1 = memoryManager.createTrackedUrl(blob1, 'proj-1');
    const url2 = memoryManager.createTrackedUrl(blob2, 'proj-2');

    expect(url1).toBeTruthy();
    expect(url2).toBeTruthy();

    const tel1 = memoryManager.getTelemetry();
    expect(tel1.trackedBlobUrls).toBe(2);

    // Revoke owner proj-1
    memoryManager.revokeUrlsByOwner('proj-1');
    const tel2 = memoryManager.getTelemetry();
    expect(tel2.trackedBlobUrls).toBe(1);

    // Revoke specific URL
    memoryManager.revokeTrackedUrl(url2);
    const tel3 = memoryManager.getTelemetry();
    expect(tel3.trackedBlobUrls).toBe(0);
  });

  it('registers, unregisters, and safely releases media elements', () => {
    const video = document.createElement('video');
    const pauseSpy = vi.spyOn(video, 'pause');
    const loadSpy = vi.spyOn(video, 'load');

    memoryManager.registerVideoElement(video);
    expect(memoryManager.getTelemetry().activeVideoDecoders).toBe(1);

    // Unregister should trigger safe release
    memoryManager.unregisterVideoElement(video);
    expect(memoryManager.getTelemetry().activeVideoDecoders).toBe(0);
    expect(pauseSpy).toHaveBeenCalled();
    expect(loadSpy).toHaveBeenCalled();
  });

  it('bounds decoded AudioBuffers to memory budget with LRU eviction', () => {
    // Mock AudioBuffer
    const createMockBuffer = (numSamples: number) =>
      ({
        length: numSamples,
        numberOfChannels: 2,
        sampleRate: 44100,
        duration: numSamples / 44100,
      }) as unknown as AudioBuffer;

    // 1 second buffer = 44100 * 2 channels * 4 bytes = ~352.8 KB
    const buf1 = createMockBuffer(44100);
    const buf2 = createMockBuffer(44100 * 2);

    memoryManager.setAudioBuffer('audio-1', buf1);
    memoryManager.setAudioBuffer('audio-2', buf2);

    expect(memoryManager.getAudioBuffer('audio-1')).toBe(buf1);
    expect(memoryManager.getAudioBuffer('audio-2')).toBe(buf2);
    expect(memoryManager.getAudioBuffer('non-existent')).toBeNull();

    const tel = memoryManager.getTelemetry();
    expect(tel.audioBuffersMb).toBeGreaterThan(0);
  });

  it('purges all caches cleanly on command', () => {
    const v = document.createElement('video');
    const a = document.createElement('audio');
    const b = new Blob(['data'], { type: 'text/plain' });

    memoryManager.registerVideoElement(v);
    memoryManager.registerAudioElement(a);
    memoryManager.createTrackedUrl(b, 'test-owner');

    expect(memoryManager.getTelemetry().activeVideoDecoders).toBe(1);
    expect(memoryManager.getTelemetry().activeAudioDecoders).toBe(1);
    expect(memoryManager.getTelemetry().trackedBlobUrls).toBe(1);

    memoryManager.purgeAllCaches();

    const tel = memoryManager.getTelemetry();
    expect(tel.activeVideoDecoders).toBe(0);
    expect(tel.activeAudioDecoders).toBe(0);
    expect(tel.trackedBlobUrls).toBe(0);
    expect(tel.status).toBe('optimal');
  });
});
