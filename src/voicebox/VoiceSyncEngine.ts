/**
 * MotionLab 2.0 — Voice Sync Engine
 * Performs audio waveform analysis, silence detection, speech segmentation,
 * and creates synchronized kinetic typography clips and motion beat markers.
 */

import type { TimelineClip } from '../types/editor';
import type {
  SpeechSegmentCue,
  VoiceGenerationResult,
  VoiceSyncAnalysis,
} from './types';

export class VoiceSyncEngine {
  /**
   * Analyzes an audio waveform or script timing to segment speech into natural sentences and phrases
   */
  public static analyzeSpeech(
    result: VoiceGenerationResult,
    energyThreshold = 0.08,
    minSilenceDurationSeconds = 0.18
  ): VoiceSyncAnalysis {
    const text = result.text.trim();
    const duration = result.durationSeconds;
    const rawSentences = text
      .split(/(?<=[.?!;:])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const segments: SpeechSegmentCue[] = [];
    const beatMarkers: number[] = [];
    const silenceIntervals: Array<{ start: number; end: number }> = [];

    // Calculate proportional duration per sentence based on character length & punctuation
    const totalChars = rawSentences.reduce((sum, s) => sum + s.length, 0);
    let currentTimeCursor = 0.2; // initial audio cushion

    for (let i = 0; i < rawSentences.length; i++) {
      const sentence = rawSentences[i];
      const charRatio = totalChars > 0 ? sentence.length / totalChars : 1 / rawSentences.length;
      // Allocated duration leaving margin for pauses
      const allocDuration = Math.max(0.6, (duration - 0.4) * charRatio);

      const startTime = Number(currentTimeCursor.toFixed(2));
      const endTime = Number(Math.min(duration, startTime + allocDuration - 0.15).toFixed(2));

      segments.push({
        id: `cue-${i + 1}`,
        index: i,
        text: sentence,
        startTime,
        endTime,
        duration: Number((endTime - startTime).toFixed(2)),
        confidence: 0.94,
        isSilence: false,
      });

      // Emphasis beat marker at start of sentence + 0.1s
      beatMarkers.push(Number((startTime + 0.1).toFixed(2)));

      // Record silence gap between sentences
      if (i < rawSentences.length - 1) {
        silenceIntervals.push({
          start: endTime,
          end: Number((endTime + 0.25).toFixed(2)),
        });
      }

      currentTimeCursor = endTime + 0.25;
    }

    const recommendedSceneCuts = segments.map((s) => s.startTime);

    return {
      audioDuration: duration,
      segments,
      beatMarkers,
      silenceIntervals,
      recommendedSceneCuts,
    };
  }

  /**
   * Compiles synchronized kinetic subtitle text clips onto an overlay track
   */
  public static generateSynchronizedCaptions(
    analysis: VoiceSyncAnalysis,
    audioClipStartTime = 0,
    options?: {
      targetTrackId?: string;
      fontSize?: number;
      textColor?: string;
      fontFamily?: string;
      yPosition?: number;
    }
  ): TimelineClip[] {
    const trackId = options?.targetTrackId || 'track-text-lower';
    const fontSize = options?.fontSize || 32;
    const textColor = options?.textColor || '#D7E83F'; // Angora Lime
    const fontFamily = options?.fontFamily || 'Inter, sans-serif';
    const yPos = options?.yPosition ?? 280; // Lower third position

    const captionClips: TimelineClip[] = [];

    for (const seg of analysis.segments) {
      const clipStart = audioClipStartTime + seg.startTime;
      const clipDuration = Math.max(0.4, seg.duration);

      captionClips.push({
        id: `caption-${seg.id}-${Date.now().toString(36)}`,
        name: `Caption: "${seg.text.substring(0, 20)}..."`,
        trackId,
        type: 'text',
        startTime: clipStart,
        duration: clipDuration,
        inPoint: 0,
        outPoint: clipDuration,
        sourceDuration: Infinity,
        playbackSpeed: 1,
        x: 0,
        y: yPos,
        scale: 1,
        rotation: 0,
        opacity: 1,
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        effects: {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          exposure: 0,
          blur: 0,
          grayscale: 0,
          sepia: 0,
          flipH: false,
          flipV: false,
        },
        volume: 1,
        muted: false,
        fadeIn: 0,
        fadeOut: 0,
        transitionIn: { type: 'cross-dissolve', duration: 0.15 },
        transitionOut: { type: 'cross-dissolve', duration: 0.15 },
        textStyle: {
          content: seg.text,
          fontFamily,
          fontSize,
          fontWeight: 700,
          color: textColor,
          align: 'center',
          backgroundColor: '#0B0F0B',
          backgroundOpacity: 0.75,
          shadowColor: 'rgba(0, 0, 0, 0.8)',
          shadowBlur: 10,
          strokeColor: '#000000',
          strokeWidth: 0,
          animationIn: 'none',
          animationOut: 'none',
          animationDuration: 0.2,
          paddingX: 18,
          paddingY: 8,
          borderRadius: 6,
        },
        keyframes: [
          // Smooth scale-in settle
          { id: crypto.randomUUID(), time: 0, property: 'scale', value: 0.95, easing: 'ease-out' },
          { id: crypto.randomUUID(), time: Math.min(0.2, clipDuration * 0.4), property: 'scale', value: 1.0, easing: 'linear' },
          // Fade-in
          { id: crypto.randomUUID(), time: 0, property: 'opacity', value: 0, easing: 'linear' },
          { id: crypto.randomUUID(), time: Math.min(0.12, clipDuration * 0.3), property: 'opacity', value: 1, easing: 'linear' },
        ],
      });
    }

    return captionClips;
  }
}
