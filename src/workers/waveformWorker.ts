export interface WaveformWorkerRequest {
  id: string;
  samples: Float32Array;
  buckets: number;
}

export interface WaveformWorkerResponse {
  id: string;
  peaks: number[];
}

export function computeWaveformPeaksFromSamples(
  samples?: Float32Array | null,
  buckets = 96
): number[] {
  if (
    !samples ||
    typeof samples.length !== 'number' ||
    samples.length === 0 ||
    buckets <= 0
  ) {
    return Array.from({ length: Math.max(1, buckets || 96) }, () => 0.1);
  }
  const blockSize = Math.max(1, Math.floor(samples.length / buckets));
  const rawPeaks: number[] = [];
  let maxPeak = 0.001;

  for (let i = 0; i < buckets; i++) {
    const start = i * blockSize;
    const end = Math.min(samples.length, start + blockSize);
    let sumSq = 0;
    let count = 0;
    // Step by 4 for fast peak/RMS extraction on large audio buffers
    const step = Math.max(1, Math.floor((end - start) / 128));
    for (let j = start; j < end; j += step) {
      const v = Math.abs(samples[j]);
      sumSq += v * v;
      count++;
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    if (rms > maxPeak) maxPeak = rms;
    rawPeaks.push(rms);
  }

  return rawPeaks.map((p) =>
    Number(Math.max(0.06, Math.min(1, p / maxPeak)).toFixed(3))
  );
}

const workerScope =
  typeof self !== 'undefined'
    ? (self as unknown as {
        onmessage: ((event: MessageEvent<WaveformWorkerRequest>) => void) | null;
        postMessage: (message: WaveformWorkerResponse) => void;
      })
    : null;

if (workerScope && typeof workerScope.postMessage === 'function') {
  workerScope.onmessage = (event: MessageEvent<WaveformWorkerRequest>) => {
    if (!event || !event.data) return;
    const { id, samples, buckets } = event.data;
    const peaks = computeWaveformPeaksFromSamples(samples, buckets);
    const response: WaveformWorkerResponse = { id: id || '', peaks };
    workerScope.postMessage(response);
  };
}
