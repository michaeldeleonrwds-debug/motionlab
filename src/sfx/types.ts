/**
 * MotionLab 3.0 — Sound FX Studio Types
 * Architecture for Soundbox AI synthesis, sound library catalog,
 * auto sound design cue sheets, and professional audio DSP effects.
 */

export interface SoundboxModel {
  id: string;
  name: string;
  status: 'installed' | 'available' | 'offline';
  license: string;
  engine: string;
  type: 'sfx' | 'music' | 'speech';
  sample_rate: number;
  channels: number;
  max_duration_s: number;
  description: string;
}

export interface SoundboxConnectionStatus {
  connected: boolean;
  version: string;
  device?: string;
  loaded_model?: string;
  error?: string;
}

export interface SoundGenerationOptions {
  prompt: string;
  durationSeconds?: number;
  seed?: number;
  model?: string;
  variations?: number;
}

export interface SoundQualityReport {
  isValid: boolean;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  hasSilence: boolean;
  peakDb: number;
  rmsDb: number;
  notes?: string[];
}

export interface SoundGenerationResult {
  id: string;
  name: string;
  prompt: string;
  model: string;
  audioBlob: Blob;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  format: 'wav';
  peakLevelDb: number;
  rmsLevelDb: number;
  waveformPeaks: number[];
  generatedAt: number;
  qualityReport: SoundQualityReport;
}

export type SfxCategory =
  | 'Whooshes'
  | 'Impacts'
  | 'UI Clicks'
  | 'Transitions'
  | 'Risers'
  | 'Drops'
  | 'Paper & Foley'
  | 'Technology'
  | 'Mechanical'
  | 'Environmental'
  | 'Cinematic'
  | 'Ambient'
  | 'Percussion'
  | 'Logo Stingers';

export interface SoundLibraryItem {
  id: string;
  name: string;
  category: SfxCategory;
  description: string;
  duration: number;
  sampleRate: number;
  channels: number;
  format: string;
  url: string;
  waveform: number[];
  license: string;
  source: string;
  attribution: string;
  tags: string[];
  isFavorite?: boolean;
}

export interface SoundDesignCue {
  id: string;
  timestamp: number;
  eventType: 'typography' | 'transition' | 'logo-reveal' | 'cut' | 'motion' | 'ui';
  clipId?: string;
  category: SfxCategory;
  desiredTexture: string;
  duration: number;
  loudnessDb: number;
  confidence: number;
  proposedTrack: string;
  suggestedSoundName: string;
  soundUrl?: string;
  approved: boolean;
}

export interface AudioDspSettings {
  gainDb: number;
  pan: number; // -1.0 to 1.0
  pitchSemitones: number; // -12 to +12
  lowCutHz: number; // 20 to 1000 Hz
  highCutHz: number; // 2000 to 20000 Hz
  compressionRatio: number;
  compressorThresholdDb: number;
  reverbWet: number; // 0 to 1.0
  reverbDecay: number;
  delayWet: number; // 0 to 1.0
  delayTimeSeconds: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  normalizePeakDb: number;
}

export const DEFAULT_AUDIO_DSP: AudioDspSettings = {
  gainDb: 0,
  pan: 0,
  pitchSemitones: 0,
  lowCutHz: 40,
  highCutHz: 18000,
  compressionRatio: 2.5,
  compressorThresholdDb: -14,
  reverbWet: 0,
  reverbDecay: 1.0,
  delayWet: 0,
  delayTimeSeconds: 0.25,
  fadeInSeconds: 0.02,
  fadeOutSeconds: 0.05,
  normalizePeakDb: -1.0,
};
