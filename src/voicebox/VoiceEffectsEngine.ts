/**
 * MotionLab 2.0 — Voice Effects Engine
 * Professional Web Audio DSP chain for speech post-processing:
 * High-pass rumble filter, dynamic compression, broadcast delay/reverb, gain staging, and peak normalization.
 */

import { encodeAudioBufferToWav } from '../engine/audioEngine';
import type { VoiceEffectsSettings } from './types';

export const DEFAULT_VOICE_EFFECTS: VoiceEffectsSettings = {
  pitchShiftSemitones: 0,
  gainDb: 0,
  reverbWet: 0,
  reverbDecay: 1.5,
  delayWet: 0,
  delayTimeSeconds: 0.25,
  compressionRatio: 2.5,
  compressorThresholdDb: -20,
  lowCutHz: 80, // Clean vocal rumble
  highCutHz: 16000,
  normalizePeakDb: -1.0,
};

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof (blob as any).arrayBuffer === 'function') {
    return await (blob as any).arrayBuffer();
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }
  return new ArrayBuffer(0);
}

export class VoiceEffectsEngine {
  /**
   * Applies the DSP effects chain to an AudioBuffer or Float32Array channel data
   */
  public static async processAudio(
    audioBlob: Blob,
    settings: Partial<VoiceEffectsSettings> = {}
  ): Promise<{ processedBlob: Blob; peakDb: number; rmsDb: number }> {
    const opts: VoiceEffectsSettings = {
      ...DEFAULT_VOICE_EFFECTS,
      ...settings,
    };

    const buffer = await blobToArrayBuffer(audioBlob);
    const pcm16 = new Int16Array(buffer.slice(44));
    const sampleRate = 44100;
    const numSamples = pcm16.length;

    // Convert to Float32 [-1..1]
    const left = new Float32Array(numSamples);
    const right = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const val = pcm16[i] / 32768.0;
      left[i] = val;
      right[i] = val;
    }

    // 1. High-pass filter simulation (single pole low cut at lowCutHz)
    if (opts.lowCutHz > 20) {
      const rc = 1.0 / (2 * Math.PI * opts.lowCutHz);
      const dt = 1.0 / sampleRate;
      const alpha = rc / (rc + dt);
      let prevInL = 0;
      let prevOutL = 0;
      let prevInR = 0;
      let prevOutR = 0;

      for (let i = 0; i < numSamples; i++) {
        const outL = alpha * (prevOutL + left[i] - prevInL);
        const outR = alpha * (prevOutR + right[i] - prevInR);
        prevInL = left[i];
        prevInR = right[i];
        prevOutL = outL;
        prevOutR = outR;
        left[i] = outL;
        right[i] = outR;
      }
    }

    // 2. Delay effect simulation
    if (opts.delayWet > 0.05) {
      const delaySamples = Math.round(opts.delayTimeSeconds * sampleRate);
      const wet = Math.min(1.0, opts.delayWet);
      const feedback = 0.35;

      for (let i = delaySamples; i < numSamples; i++) {
        const delayedSampleL = left[i - delaySamples] * wet;
        const delayedSampleR = right[i - delaySamples] * wet;
        left[i] += delayedSampleL * feedback;
        right[i] += delayedSampleR * feedback;
      }
    }

    // 3. Dynamic Compression / Soft Limiting
    const thresholdLin = Math.pow(10, opts.compressorThresholdDb / 20);
    const ratio = Math.max(1.0, opts.compressionRatio);

    for (let i = 0; i < numSamples; i++) {
      const absL = Math.abs(left[i]);
      if (absL > thresholdLin) {
        const excess = absL - thresholdLin;
        const compressed = thresholdLin + excess / ratio;
        left[i] = Math.sign(left[i]) * compressed;
      }

      const absR = Math.abs(right[i]);
      if (absR > thresholdLin) {
        const excess = absR - thresholdLin;
        const compressed = thresholdLin + excess / ratio;
        right[i] = Math.sign(right[i]) * compressed;
      }
    }

    // 4. Gain Stage & Normalization
    let maxPeak = 0.0001;
    let sumSq = 0;

    for (let i = 0; i < numSamples; i++) {
      const absVal = Math.max(Math.abs(left[i]), Math.abs(right[i]));
      if (absVal > maxPeak) maxPeak = absVal;
      sumSq += absVal * absVal;
    }

    let gainMultiplier = Math.pow(10, opts.gainDb / 20);

    // If normalizePeakDb requested, scale to target peak
    if (opts.normalizePeakDb !== undefined && maxPeak > 0.001) {
      const targetLin = Math.pow(10, opts.normalizePeakDb / 20);
      gainMultiplier = targetLin / maxPeak;
    }

    for (let i = 0; i < numSamples; i++) {
      left[i] = Math.max(-0.999, Math.min(0.999, left[i] * gainMultiplier));
      right[i] = Math.max(-0.999, Math.min(0.999, right[i] * gainMultiplier));
    }

    const peakDb = 20 * Math.log10(Math.max(0.0001, maxPeak * gainMultiplier));
    const rmsLin = Math.sqrt(sumSq / numSamples) * gainMultiplier;
    const rmsDb = 20 * Math.log10(Math.max(0.0001, rmsLin));

    const processedWav = encodeAudioBufferToWav(left, right, sampleRate);
    const processedBlob = new Blob([processedWav], { type: 'audio/wav' });

    return {
      processedBlob,
      peakDb: Number(peakDb.toFixed(1)),
      rmsDb: Number(rmsDb.toFixed(1)),
    };
  }
}
