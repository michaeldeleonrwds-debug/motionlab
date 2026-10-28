/**
 * MotionLab 2.0 — Voicebox AI Voice Studio Types
 * Data structures for Voicebox engines, voice profiles, speech synthesis,
 * voice cloning, audio post-processing, and timeline synchronization.
 */

export type VoiceEngineId =
  | 'kokoro'
  | 'qwen3-tts'
  | 'qwen-custom'
  | 'chatterbox-multilingual'
  | 'chatterbox-turbo'
  | 'luxtts'
  | 'hume-tada'
  | 'studio-synth';

export type VoiceType = 'preset' | 'cloned' | 'designed';

export interface VoiceEngineCapability {
  id: VoiceEngineId;
  name: string;
  version: string;
  description: string;
  supportsCloning: boolean;
  supportsVoiceDesign: boolean;
  supportsEmotionTags: boolean;
  supportsStreaming: boolean;
  sampleRate: number; // e.g. 24000, 44100, 48000
  supportedLanguages: string[];
  approxModelSizeBytes: number;
  isInstalled: boolean;
  isAvailable: boolean;
  license: string;
}

export interface VoiceProfile {
  id: string;
  name: string;
  voiceType: VoiceType;
  engine: VoiceEngineId;
  language: string;
  accent?: string;
  gender?: 'male' | 'female' | 'neutral';
  ageRange?: 'young' | 'middle-aged' | 'mature';
  description: string;
  sampleAudioUrl?: string;
  referenceAudioFile?: string;
  referenceDurationSeconds?: number;
  authorizedForCommercialUse: boolean;
  consentConfirmedAt?: number;
  createdAt: number;
  tags: string[];
}

export interface VoiceGenerationOptions {
  text: string;
  profileId: string;
  engine?: VoiceEngineId;
  language?: string;
  speed?: number; // 0.5 to 2.0 (default 1.0)
  pitch?: number; // -12 to +12 semitones
  emotionInstruction?: string; // e.g. "Authoritative, calm, cinematic"
  speakingRateWpm?: number;
  format?: 'wav' | 'mp3';
  temperature?: number;
}

export interface VoiceGenerationResult {
  id: string;
  text: string;
  profileId: string;
  profileName: string;
  engine: VoiceEngineId;
  audioBlob: Blob;
  audioBuffer?: AudioBuffer;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  format: 'wav' | 'mp3';
  peakLevelDb: number;
  rmsLevelDb: number;
  waveformPeaks: number[];
  generatedAt: number;
  qualityReport: AudioQualityReport;
}

export interface AudioQualityReport {
  isValid: boolean;
  durationSeconds: number;
  sampleRate: number;
  hasClipping: boolean;
  hasSilence: boolean;
  peakDb: number;
  rmsDb: number;
  notes: string[];
}

export interface SpeechSegmentCue {
  id: string;
  index: number;
  text: string;
  startTime: number; // Offset in seconds from audio start
  endTime: number;   // Offset in seconds from audio start
  duration: number;
  confidence: number;
  isSilence: boolean;
}

export interface VoiceSyncAnalysis {
  audioDuration: number;
  segments: SpeechSegmentCue[];
  beatMarkers: number[]; // Timestamps of spoken emphasis peaks
  silenceIntervals: Array<{ start: number; end: number }>;
  recommendedSceneCuts: number[];
}

export interface MultiSpeakerLine {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  profileId: string;
  engine: VoiceEngineId;
  preferredTrack?: string;
  audioResult?: VoiceGenerationResult;
}

export interface VoiceEffectsSettings {
  pitchShiftSemitones: number; // -12 to 12 (default 0)
  gainDb: number;              // -24 to +12 (default 0)
  reverbWet: number;           // 0 to 1 (default 0)
  reverbDecay: number;         // 0.2 to 5.0 (default 1.5)
  delayWet: number;            // 0 to 1 (default 0)
  delayTimeSeconds: number;    // 0.05 to 1.0 (default 0.25)
  compressionRatio: number;    // 1 to 20 (default 1 = bypass)
  compressorThresholdDb: number; // -60 to 0 (default -24)
  lowCutHz: number;            // 20 to 500 (default 80Hz rumble cut)
  highCutHz: number;           // 4000 to 20000 (default 16000)
  normalizePeakDb?: number;    // e.g. -1.0 dB
}

export interface VoiceDirectionPreset {
  id: string;
  name: string;
  category: 'commercial' | 'cinematic' | 'corporate' | 'documentary' | 'tech' | 'social';
  description: string;
  pacingWpm: number;
  recommendedPitch: number;
  recommendedEffects: Partial<VoiceEffectsSettings>;
  promptDirective: string;
}
