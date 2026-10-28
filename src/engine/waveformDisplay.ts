/** Preserve transient peaks while bounding display work by the available pixels. */
export function getWaveformPeaks(samples: readonly number[], maxBars: number): readonly number[] {
  const count = Math.max(1, Math.floor(maxBars));
  if (samples.length <= count) return samples;
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * samples.length / count);
    const end = Math.floor((i + 1) * samples.length / count);
    let peak = 0;
    for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(samples[j]));
    peaks.push(peak);
  }
  return peaks;
}
