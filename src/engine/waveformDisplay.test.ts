import { describe, expect, it } from 'vitest';
import { getWaveformPeaks } from './waveformDisplay';

describe('display waveform', () => {
  it('bounds display cost while preserving a narrow transient in each interval', () => {
    const samples = Array(10000).fill(0);
    samples[99] = .9;
    samples[9999] = .7;
    const peaks = getWaveformPeaks(samples, 100);
    expect(peaks).toHaveLength(100);
    expect(peaks[0]).toBe(.9);
    expect(peaks[99]).toBe(.7);
    expect(samples).toHaveLength(10000);
  });
  it('keeps short and empty waveforms intact', () => {
    const samples = [.2, .4];
    expect(getWaveformPeaks(samples, 100)).toBe(samples);
    expect(getWaveformPeaks([], 100)).toEqual([]);
  });
});
