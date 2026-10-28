/**
 * MotionLab 3.0 — Sound Library & Sound Design Agent
 * Curated offline CC0/MIT sound effects, SFXMint integration,
 * and automated motion timeline cue-sheet generator.
 */

import { SfxCategory, SoundLibraryItem, SoundDesignCue } from './types';
import { TimelineClip } from '../types/editor';

// Curated master sound catalog with real assets in /sfx/
export const CURATED_SOUND_LIBRARY: SoundLibraryItem[] = [
  {
    id: 'sfx-whoosh-cinematic',
    name: 'Cinematic Sub Whoosh',
    category: 'Whooshes',
    description: 'Deep cinematic bass whoosh with air displacement and wide stereo sweep.',
    duration: 1.2,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/whoosh-cinematic.wav',
    waveform: [0.1, 0.2, 0.35, 0.55, 0.8, 1.0, 0.9, 0.7, 0.45, 0.25, 0.1, 0.05],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['whoosh', 'cinematic', 'bass', 'transition', 'trailer', 'sub'],
  },
  {
    id: 'sfx-whoosh-fast',
    name: 'Digital Whip Whoosh',
    category: 'Whooshes',
    description: 'Quick sleek whip whoosh for swift transitions and rapid kinetic cuts.',
    duration: 0.6,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/whoosh-fast.wav',
    waveform: [0.05, 0.3, 0.75, 1.0, 0.85, 0.5, 0.2, 0.05],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['whoosh', 'fast', 'whip', 'swipe', 'clean', 'ui'],
  },
  {
    id: 'sfx-impact-cinematic-boom',
    name: 'Cinematic Boom Impact',
    category: 'Impacts',
    description: 'Heavy cinematic sub-bass impact with metallic resonance and dark decay.',
    duration: 2.0,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/impact-cinematic-boom.wav',
    waveform: [1.0, 0.85, 0.7, 0.55, 0.45, 0.35, 0.28, 0.2, 0.15, 0.1, 0.06, 0.02],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['impact', 'boom', 'sub', 'bass', 'trailer', 'heavy', 'cinematic'],
  },
  {
    id: 'sfx-impact-slam',
    name: 'Punchy Kick Slam',
    category: 'Impacts',
    description: 'Aggressive punchy kick slam with tight tail for title drop emphasis.',
    duration: 1.0,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/impact-slam.wav',
    waveform: [1.0, 0.8, 0.5, 0.3, 0.2, 0.1, 0.05],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['impact', 'slam', 'kick', 'punch', 'drop', 'accent'],
  },
  {
    id: 'sfx-ui-modern-click',
    name: 'Glass Interface Tap',
    category: 'UI Clicks',
    description: 'Crisp tactile glass button tap for clean modern interface interaction.',
    duration: 0.3,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/ui-modern-click.wav',
    waveform: [0.95, 0.4, 0.15, 0.05],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['ui', 'click', 'tap', 'glass', 'minimal', 'modern', 'button'],
  },
  {
    id: 'sfx-ui-switch-toggle',
    name: 'Mechanical Toggle Snap',
    category: 'UI Clicks',
    description: 'Subtle mechanical toggle switch click snap with tactile feedback.',
    duration: 0.35,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/ui-switch-toggle.wav',
    waveform: [0.8, 0.9, 0.3, 0.1, 0.02],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['ui', 'toggle', 'switch', 'mechanical', 'snap', 'hardware'],
  },
  {
    id: 'sfx-transition-digital-shimmer',
    name: 'Digital Shimmer Swipe',
    category: 'Transitions',
    description: 'High-tech digital shimmer swipe with granular sparkles and airy decay.',
    duration: 1.5,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/transition-digital-shimmer.wav',
    waveform: [0.1, 0.3, 0.6, 0.9, 0.75, 0.6, 0.4, 0.25, 0.15, 0.08],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['transition', 'digital', 'shimmer', 'sparkle', 'tech', 'glitch'],
  },
  {
    id: 'sfx-transition-air-suction',
    name: 'Vacuum Air Suction',
    category: 'Transitions',
    description: 'Atmospheric reverse vacuum suction whoosh leading into clean cut.',
    duration: 1.2,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/transition-air-suction.wav',
    waveform: [0.05, 0.15, 0.3, 0.55, 0.8, 1.0, 0.1],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['transition', 'vacuum', 'suction', 'reverse', 'air', 'anticipation'],
  },
  {
    id: 'sfx-riser-tension-build',
    name: 'Analog Tension Riser',
    category: 'Risers',
    description: 'Dark analog synth pitch riser building tension to dramatic climax.',
    duration: 2.5,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/riser-tension-build.wav',
    waveform: [0.1, 0.15, 0.22, 0.32, 0.45, 0.6, 0.78, 0.95, 1.0],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['riser', 'tension', 'build', 'synth', 'climax', 'trailer'],
  },
  {
    id: 'sfx-drop-bass-fall',
    name: 'Sub Bass Pitch Drop',
    category: 'Drops',
    description: 'Heavy subwoofer pitch drop falling from 200Hz to 35Hz.',
    duration: 1.8,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/drop-bass-fall.wav',
    waveform: [0.95, 0.85, 0.75, 0.65, 0.5, 0.4, 0.3, 0.2, 0.1],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['drop', 'sub', 'bass', 'pitch', '808', 'impact'],
  },
  {
    id: 'sfx-foley-paper-slide',
    name: 'Parchment Paper Rustle',
    category: 'Paper & Foley',
    description: 'Clean parchment paper rustle and fast slide foley for editorial motion.',
    duration: 0.8,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/foley-paper-slide.wav',
    waveform: [0.3, 0.7, 0.85, 0.6, 0.4, 0.2, 0.05],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['foley', 'paper', 'slide', 'rustle', 'organic', 'tactile', 'editorial'],
  },
  {
    id: 'sfx-tech-hud-beep',
    name: 'Sci-Fi HUD Telemetry',
    category: 'Technology',
    description: 'Sci-fi holographic HUD scan telemetry chime sequence with dual chirps.',
    duration: 0.9,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/tech-hud-beep.wav',
    waveform: [0.7, 0.3, 0.8, 0.4, 0.6, 0.2, 0.1],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['tech', 'hud', 'telemetry', 'sci-fi', 'beep', 'scan', 'cyber'],
  },
  {
    id: 'sfx-cinematic-drone-dark',
    name: 'Dark Brass Braam Drone',
    category: 'Cinematic',
    description: 'Ominous cinematic brass braam and low frequency rumble with rich harmonics.',
    duration: 2.8,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/cinematic-drone-dark.wav',
    waveform: [0.95, 0.9, 0.8, 0.75, 0.7, 0.6, 0.55, 0.5, 0.4, 0.3, 0.2],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['cinematic', 'braam', 'drone', 'dark', 'brass', 'trailer', 'atmosphere'],
  },
  {
    id: 'sfx-logo-stinger-chime',
    name: 'Crystal Logo Stinger',
    category: 'Logo Stingers',
    description: 'Lush brand logo chord chime with crystal overtone reverb and clean resolve.',
    duration: 2.2,
    sampleRate: 44100,
    channels: 2,
    format: 'wav',
    url: '/sfx/logo-stinger-chime.wav',
    waveform: [0.85, 0.95, 0.8, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15, 0.08, 0.02],
    license: 'CC0 / MIT',
    source: 'MotionLab Studio Synth',
    attribution: 'MotionLab Audio DSP Engine',
    tags: ['logo', 'stinger', 'chime', 'brand', 'crystal', 'outro', 'resolve'],
  },
];

/**
 * Filter sound library by category, search text, or tags
 */
export function searchSoundLibrary(options: {
  query?: string;
  category?: SfxCategory | 'All';
  tags?: string[];
}): SoundLibraryItem[] {
  const query = options.query?.toLowerCase().trim() || '';
  const category = options.category;

  return CURATED_SOUND_LIBRARY.filter((item) => {
    if (category && category !== 'All' && item.category !== category) {
      return false;
    }

    if (query) {
      const matchName = item.name.toLowerCase().includes(query);
      const matchDesc = item.description.toLowerCase().includes(query);
      const matchTag = item.tags.some((t) => t.toLowerCase().includes(query));
      if (!matchName && !matchDesc && !matchTag) {
        return false;
      }
    }

    if (options.tags && options.tags.length > 0) {
      const hasAllTags = options.tags.every((t) =>
        item.tags.some((itemTag) => itemTag.toLowerCase() === t.toLowerCase())
      );
      if (!hasAllTags) return false;
    }

    return true;
  });
}

/**
 * Auto Sound Design Agent:
 * Analyzes video cuts, kinetic typography, transitions, and logo scenes on timeline,
 * generating a structured sound cue sheet.
 */
export function analyzeTimelineForSoundDesign(clips: TimelineClip[]): SoundDesignCue[] {
  const cues: SoundDesignCue[] = [];

  // Sort clips by startTime
  const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);

  sorted.forEach((clip, index) => {
    // 1. Text / Typography kinetic entry
    if (clip.type === 'text') {
      cues.push({
        id: `cue-text-${clip.id}`,
        timestamp: clip.startTime,
        eventType: 'typography',
        clipId: clip.id,
        category: 'Whooshes',
        desiredTexture: 'Crisp tactile whoosh or subtle foley slide for kinetic headline',
        duration: 0.6,
        loudnessDb: -16,
        confidence: 0.92,
        proposedTrack: 'SFX',
        suggestedSoundName: 'Digital Whip Whoosh',
        soundUrl: '/sfx/whoosh-fast.wav',
        approved: true,
      });
    }

    // 2. Scene transitions / cuts
    if (clip.type === 'video' || clip.type === 'image') {
      // Impact or whoosh on clip start if not first clip or prominent opening
      if (index === 0) {
        cues.push({
          id: `cue-intro-${clip.id}`,
          timestamp: 0,
          eventType: 'cut',
          clipId: clip.id,
          category: 'Impacts',
          desiredTexture: 'Introductory deep cinematic bass impact',
          duration: 1.5,
          loudnessDb: -12,
          confidence: 0.88,
          proposedTrack: 'SFX',
          suggestedSoundName: 'Cinematic Boom Impact',
          soundUrl: '/sfx/impact-cinematic-boom.wav',
          approved: true,
        });
      } else {
        cues.push({
          id: `cue-cut-${clip.id}`,
          timestamp: clip.startTime,
          eventType: 'transition',
          clipId: clip.id,
          category: 'Whooshes',
          desiredTexture: 'Cinematic sub whoosh or air suction across scene transition',
          duration: 1.0,
          loudnessDb: -14,
          confidence: 0.85,
          proposedTrack: 'SFX',
          suggestedSoundName: 'Cinematic Sub Whoosh',
          soundUrl: '/sfx/whoosh-cinematic.wav',
          approved: true,
        });
      }
    }
  });

  return cues;
}
