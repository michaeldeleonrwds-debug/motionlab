/**
 * MotionLab 3.0 — Soundbox AI Adapter
 * Client interface for local Soundbox text-to-sound synthesis engine.
 * Connects via proxy (/api/soundbox) or direct (http://127.0.0.1:17494).
 */

import {
  SoundboxConnectionStatus,
  SoundboxModel,
  SoundGenerationOptions,
  SoundGenerationResult,
  SoundQualityReport,
} from './types';

export class SoundboxAdapter {
  private static instance: SoundboxAdapter;
  private baseUrl = '/api/soundbox';
  private fallbackUrl = 'http://127.0.0.1:17494';
  private audioContext: AudioContext | null = null;
  private currentAuditionAudio: HTMLAudioElement | null = null;

  private constructor() {}

  public static getInstance(): SoundboxAdapter {
    if (!SoundboxAdapter.instance) {
      SoundboxAdapter.instance = new SoundboxAdapter();
    }
    return SoundboxAdapter.instance;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  private resolveUrl(endpoint: string): string {
    const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
    if (
      !isTest &&
      typeof window !== 'undefined' &&
      window.location?.origin &&
      window.location.origin.startsWith('http')
    ) {
      return `${this.baseUrl}${clean}`;
    }
    return `${this.fallbackUrl}${clean}`;
  }

  /**
   * Health check to confirm if local Soundbox backend is running.
   */
  public async checkHealth(): Promise<SoundboxConnectionStatus> {
    try {
      const targetUrl = this.resolveUrl('/api/health');
      const res = await fetch(targetUrl, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        return {
          connected: true,
          version: data.version || '1.2.0',
          device: data.device || 'cpu',
          loaded_model: data.loaded_model || data.model,
        };
      }
    } catch {
      // Try direct fallback
      try {
        const resDirect = await fetch(`${this.fallbackUrl}/api/health`, { method: 'GET' });
        if (resDirect.ok) {
          const data = await resDirect.json();
          this.baseUrl = this.fallbackUrl; // Switch to direct if proxy is inactive
          return {
            connected: true,
            version: data.version || '1.2.0',
            device: data.device || 'cpu',
            loaded_model: data.loaded_model || data.model,
          };
        }
      } catch {
        // Both failed
      }
    }

    return {
      connected: false,
      version: 'offline',
      error: 'Soundbox backend offline at port 17494',
    };
  }

  /**
   * Discover available sound synthesis models
   */
  public async listModels(): Promise<SoundboxModel[]> {
    try {
      const res = await fetch(this.resolveUrl('/api/models'));
      if (res.ok) {
        const data = await res.json();
        return data.models || data;
      }
    } catch (err) {
      console.warn('[SoundboxAdapter] Failed to list models from backend:', err);
    }

    // Default built-in catalog if offline
    return [
      {
        id: 'audiocraft-small',
        name: 'AudioCraft SFX (Small)',
        status: 'installed',
        license: 'MIT / Apache-2.0',
        engine: 'AudioCraft / SciPy Synthesis',
        type: 'sfx',
        sample_rate: 44100,
        channels: 2,
        max_duration_s: 10,
        description: 'Ultra-fast procedural neural sound effects and kinetic textures.',
      },
      {
        id: 'stable-audio-open',
        name: 'Stable Audio Open 1.0',
        status: 'available',
        license: 'Stability AI Community',
        engine: 'Diffusion Transformer',
        type: 'sfx',
        sample_rate: 44100,
        channels: 2,
        max_duration_s: 15,
        description: 'High-fidelity cinematic audio and atmospheric sound design.',
      },
      {
        id: 'audiogen-medium',
        name: 'AudioGen Medium',
        status: 'available',
        license: 'CC-BY-NC-4.0',
        engine: 'AudioCraft Autoregressive',
        type: 'sfx',
        sample_rate: 32000,
        channels: 2,
        max_duration_s: 8,
        description: 'Specialized environmental, mechanical, and realistic foley synthesis.',
      },
    ];
  }

  /**
   * Generate sound effect from natural language prompt
   */
  public async generateSound(options: SoundGenerationOptions): Promise<SoundGenerationResult> {
    if (!options.prompt.trim()) {
      throw new Error('Prompt cannot be empty for sound generation.');
    }

    const duration = Math.min(Math.max(options.durationSeconds || 1.5, 0.2), 15);
    const model = options.model || 'audiocraft-small';

    const payload = {
      prompt: options.prompt.trim(),
      duration,
      duration_seconds: duration,
      seed: options.seed ?? Math.floor(Math.random() * 1000000),
      model,
    };

    const res = await fetch(this.resolveUrl('/api/generate'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown server error');
      throw new Error(`Soundbox generation failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    let audioUrl = data.audio_url || data.url;

    if (!audioUrl && data.id) {
      audioUrl = `${this.baseUrl}/files/${data.id}.wav`;
    }

    if (!audioUrl) {
      throw new Error('Soundbox response did not contain an audio URL or file ID.');
    }

    // Ensure audioUrl resolves correctly
    if (audioUrl.startsWith('/files/')) {
      audioUrl = `${this.baseUrl}${audioUrl}`;
    }

    // Fetch the audio WAV blob
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to fetch synthesized audio from ${audioUrl}`);
    }

    const audioBlob = await audioRes.blob();
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Decode and validate using Web Audio API
    const ctx = this.getAudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

    // Analyze waveform, peak, RMS and silence
    const qualityReport = this.analyzeAudioBuffer(audioBuffer);

    if (qualityReport.hasSilence) {
      throw new Error(
        `Generated audio is silent or near-inaudible (Peak: ${qualityReport.peakDb.toFixed(1)} dB). Please adjust the prompt.`
      );
    }

    const waveformPeaks = this.extractWaveformPeaks(audioBuffer, 64);
    const soundId = data.id || `sfx-${Date.now().toString(36)}`;
    const soundName = options.prompt.length > 28 ? `${options.prompt.slice(0, 25)}...` : options.prompt;

    return {
      id: soundId,
      name: soundName,
      prompt: options.prompt,
      model,
      audioBlob,
      durationSeconds: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      format: 'wav',
      peakLevelDb: qualityReport.peakDb,
      rmsLevelDb: qualityReport.rmsDb,
      waveformPeaks,
      generatedAt: Date.now(),
      qualityReport,
    };
  }

  /**
   * Analyze decoded AudioBuffer for volume, peak, RMS, and silence detection
   */
  private analyzeAudioBuffer(buffer: AudioBuffer): SoundQualityReport {
    let maxPeak = 0;
    let sumSquares = 0;
    let totalSamples = 0;

    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const channelData = buffer.getChannelData(c);
      for (let i = 0; i < channelData.length; i++) {
        const val = Math.abs(channelData[i]);
        if (val > maxPeak) maxPeak = val;
        sumSquares += val * val;
        totalSamples++;
      }
    }

    const rms = totalSamples > 0 ? Math.sqrt(sumSquares / totalSamples) : 0;
    const peakDb = maxPeak > 0 ? 20 * Math.log10(maxPeak) : -100;
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -100;

    // Silence threshold is below -50 dB
    const hasSilence = peakDb < -45;

    return {
      isValid: !hasSilence && buffer.duration > 0.05,
      durationSeconds: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      hasSilence,
      peakDb,
      rmsDb,
      notes: [
        `Duration: ${buffer.duration.toFixed(2)}s`,
        `Peak: ${peakDb.toFixed(1)} dB`,
        `RMS: ${rmsDb.toFixed(1)} dB`,
        hasSilence ? 'FAIL: Audio is silent' : 'PASS: Audible signal detected',
      ],
    };
  }

  /**
   * Extract 64-bucket normalized peak array for high-performance waveform rendering
   */
  private extractWaveformPeaks(buffer: AudioBuffer, numBuckets: number = 64): number[] {
    const channelData = buffer.getChannelData(0);
    const bucketSize = Math.max(1, Math.floor(channelData.length / numBuckets));
    const peaks: number[] = [];

    for (let b = 0; b < numBuckets; b++) {
      const start = b * bucketSize;
      const end = Math.min(start + bucketSize, channelData.length);
      let peak = 0;
      for (let i = start; i < end; i++) {
        const val = Math.abs(channelData[i]);
        if (val > peak) peak = val;
      }
      peaks.push(Math.min(1.0, peak));
    }

    return peaks;
  }

  /**
   * Audition / Preview playback in browser
   */
  public auditionSound(blobOrUrl: Blob | string, onEnded?: () => void): HTMLAudioElement {
    this.stopAudition();

    const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    const audio = new Audio(url);
    this.currentAuditionAudio = audio;

    audio.onended = () => {
      if (typeof blobOrUrl !== 'string') {
        URL.revokeObjectURL(url);
      }
      if (this.currentAuditionAudio === audio) {
        this.currentAuditionAudio = null;
      }
      onEnded?.();
    };

    audio.play().catch((err) => {
      console.warn('[SoundboxAdapter] Audition playback failed or was blocked by autoplay:', err);
    });

    return audio;
  }

  /**
   * Stop any currently playing audition sound
   */
  public stopAudition(): void {
    if (this.currentAuditionAudio) {
      this.currentAuditionAudio.pause();
      this.currentAuditionAudio.currentTime = 0;
      this.currentAuditionAudio = null;
    }
  }

  /**
   * Cancel generation job if supported
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/jobs/${jobId}/cancel`, { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const soundboxAdapter = SoundboxAdapter.getInstance();
