/**
 * MotionLab 2.0 — Voice Direction Skill
 * Analyzes scripts, brand tone, and scene timings to formulate professionally directed voiceover plans.
 */

import type { VoiceDirectionPreset } from './types';

export const VOICE_DIRECTION_PRESETS: VoiceDirectionPreset[] = [
  {
    id: 'premium-commercial',
    name: 'Premium Commercial',
    category: 'commercial',
    description: 'Crisp, authoritative commercial cadence with deliberate emphasis on brand keywords and values.',
    pacingWpm: 135,
    recommendedPitch: 0,
    recommendedEffects: {
      compressionRatio: 3.0,
      compressorThresholdDb: -18,
      gainDb: 1.0,
      normalizePeakDb: -1.0,
    },
    promptDirective: 'Authoritative, precise, high-confidence commercial delivery. Clear consonant articulation, punchy cadence.',
  },
  {
    id: 'cinematic-trailer',
    name: 'Cinematic Trailer',
    category: 'cinematic',
    description: 'Resonant, epic, dramatic delivery with expansive pauses and rich low-frequency presence.',
    pacingWpm: 110,
    recommendedPitch: -2,
    recommendedEffects: {
      reverbWet: 0.15,
      reverbDecay: 2.2,
      compressionRatio: 4.0,
      compressorThresholdDb: -22,
    },
    promptDirective: 'Deep, dramatic cinematic narration. Slower cadence with pregnant pauses and rich vocal resonance.',
  },
  {
    id: 'technology-launch',
    name: 'Technology Brand Launch',
    category: 'tech',
    description: 'Modern, intelligent, sophisticated tone engineered for flagship tech announcements and Silicon Valley reveals.',
    pacingWpm: 140,
    recommendedPitch: 0,
    recommendedEffects: {
      compressionRatio: 2.5,
      compressorThresholdDb: -20,
      normalizePeakDb: -1.0,
    },
    promptDirective: 'Intelligent, forward-looking tech delivery. Clean modern presence, articulate, restrained excitement.',
  },
  {
    id: 'luxury-minimal',
    name: 'Luxury Advertisement',
    category: 'commercial',
    description: 'Understated, velvety, intimate delivery emphasizing craftsmanship and exclusivity.',
    pacingWpm: 115,
    recommendedPitch: -1,
    recommendedEffects: {
      reverbWet: 0.08,
      compressionRatio: 2.0,
      compressorThresholdDb: -24,
    },
    promptDirective: 'Velvety, intimate luxury tone. Soft vocal attack, measured breathing, deliberate pacing.',
  },
  {
    id: 'energetic-social',
    name: 'Energetic Social Media',
    category: 'social',
    description: 'Rapid, punchy, high-energy delivery designed for hook retention and vertical video reels.',
    pacingWpm: 165,
    recommendedPitch: 1,
    recommendedEffects: {
      compressionRatio: 4.5,
      compressorThresholdDb: -16,
      gainDb: 2.0,
      normalizePeakDb: -0.5,
    },
    promptDirective: 'Dynamic, punchy, high-tempo delivery. Tight phrase gaps, upbeat inflection, immediate hook emphasis.',
  },
];

export interface VoiceDirectionPlan {
  preset: VoiceDirectionPreset;
  estimatedDurationSeconds: number;
  wordCount: number;
  pacingWpm: number;
  directedScript: string;
  notes: string[];
}

export class VoiceDirectionEngine {
  public static planVoiceover(
    rawScript: string,
    presetId = 'premium-commercial',
    targetDurationSeconds?: number
  ): VoiceDirectionPlan {
    const preset =
      VOICE_DIRECTION_PRESETS.find((p) => p.id === presetId) || VOICE_DIRECTION_PRESETS[0];

    const words = rawScript.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Estimated speech duration based on WPM
    let estimatedDuration = (wordCount / preset.pacingWpm) * 60;
    // Add cushions for sentence punctuation pauses
    const sentenceCount = (rawScript.match(/[.!?]/g) || []).length;
    estimatedDuration += sentenceCount * 0.35;

    const notes: string[] = [];

    if (targetDurationSeconds) {
      const diff = estimatedDuration - targetDurationSeconds;
      if (Math.abs(diff) > 2.0) {
        if (diff > 0) {
          notes.push(
            `Script estimated at ${estimatedDuration.toFixed(1)}s exceeds scene target of ${targetDurationSeconds}s by ${diff.toFixed(1)}s. Consider trimming ~${Math.ceil((diff / 60) * preset.pacingWpm)} words.`
          );
        } else {
          notes.push(
            `Script estimated at ${estimatedDuration.toFixed(1)}s is shorter than target ${targetDurationSeconds}s. You have room for ~${Math.floor((Math.abs(diff) / 60) * preset.pacingWpm)} more words.`
          );
        }
      } else {
        notes.push(`Script duration (${estimatedDuration.toFixed(1)}s) aligns well with target duration (${targetDurationSeconds}s).`);
      }
    }

    return {
      preset,
      estimatedDurationSeconds: Number(estimatedDuration.toFixed(1)),
      wordCount,
      pacingWpm: preset.pacingWpm,
      directedScript: rawScript,
      notes,
    };
  }
}
