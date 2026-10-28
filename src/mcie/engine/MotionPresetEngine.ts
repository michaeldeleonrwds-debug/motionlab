/**
 * MotionLab Creative Intelligence Engine (MCIE) — Motion Preset Engine
 * Generates professional, mathematically calibrated keyframes and motion tokens
 * for titles, graphics, camera moves, and brand elements using native MotionLab Keyframe data.
 */

import type { Keyframe, KeyframeEasing, KeyframeProperty, TimelineClip } from '../../types/editor';

export interface MotionPresetOptions {
  clipDuration: number;
  enterDuration?: number;
  exitDuration?: number;
  easing?: KeyframeEasing;
  bezierPoints?: [number, number, number, number];
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale' | 'fade';
  distance?: number;
  overshoot?: number;
  staggerIndex?: number;
  staggerDelay?: number;
  addExit?: boolean;
  intensity?: number;
}

export interface PresetDefinition {
  id: string;
  name: string;
  category: 'text' | 'graphic' | 'camera' | 'transition';
  description: string;
  defaultEnterDuration: number;
  defaultExitDuration: number;
  recommendedEasing: KeyframeEasing;
  generate: (opts: MotionPresetOptions) => Keyframe[];
}

// Studio reference cubic bezier curve: fast out, ultra-smooth settle
export const STUDIO_SMOOTH_BEZIER: [number, number, number, number] = [0.16, 1, 0.3, 1];
// Apple / high-end hardware showcase curve: snappy start, long subtle decelerate
export const CINEMATIC_DECEL_BEZIER: [number, number, number, number] = [0.05, 0.7, 0.1, 1];

export class MotionPresetEngine {
  private static presets: Map<string, PresetDefinition> = new Map();

  static {
    // 1. Refined Title Entrance: Elegant slide up with smooth settle and scale settling
    this.register({
      id: 'refined-title-entrance',
      name: 'Refined Title Entrance',
      category: 'text',
      description: 'Sophisticated typography entrance with vertical translation, soft scale settling, and opacity fade',
      defaultEnterDuration: 0.65,
      defaultExitDuration: 0.45,
      recommendedEasing: 'cubic-bezier',
      generate: (opts) => {
        const stagger = (opts.staggerIndex || 0) * (opts.staggerDelay || 0.08);
        const t0 = Math.min(stagger, opts.clipDuration * 0.5);
        const t1 = Math.min(t0 + (opts.enterDuration ?? 0.65), opts.clipDuration);
        const dist = opts.distance ?? 48;
        const overshoot = opts.overshoot ?? 0;

        const kfs: Keyframe[] = [
          // Y translation
          { id: crypto.randomUUID(), time: t0, property: 'y', value: dist, easing: 'cubic-bezier', bezierPoints: STUDIO_SMOOTH_BEZIER },
          { id: crypto.randomUUID(), time: t1, property: 'y', value: 0, easing: 'linear' },
          // Opacity
          { id: crypto.randomUUID(), time: t0, property: 'opacity', value: 0, easing: 'ease-out' },
          { id: crypto.randomUUID(), time: Math.min(t0 + (t1 - t0) * 0.7, opts.clipDuration), property: 'opacity', value: 1, easing: 'linear' },
          // Subtle scale settling (0.96 -> 1.0)
          { id: crypto.randomUUID(), time: t0, property: 'scale', value: 0.96, easing: 'cubic-bezier', bezierPoints: STUDIO_SMOOTH_BEZIER },
          { id: crypto.randomUUID(), time: t1, property: 'scale', value: overshoot > 0 ? 1 + overshoot * 0.04 : 1.0, easing: 'cubic-bezier' },
        ];

        if (overshoot > 0 && t1 + 0.15 < opts.clipDuration) {
          kfs.push({
            id: crypto.randomUUID(),
            time: t1 + 0.15,
            property: 'scale',
            value: 1.0,
            easing: 'ease-out',
          });
        }

        if (opts.addExit) {
          const tExitStart = Math.max(opts.clipDuration - (opts.exitDuration ?? 0.45), t1);
          kfs.push(
            { id: crypto.randomUUID(), time: tExitStart, property: 'y', value: 0, easing: 'cubic-bezier', bezierPoints: [0.3, 0, 0.8, 0.15] },
            { id: crypto.randomUUID(), time: opts.clipDuration, property: 'y', value: -dist * 0.6, easing: 'linear' },
            { id: crypto.randomUUID(), time: tExitStart, property: 'opacity', value: 1, easing: 'ease-in' },
            { id: crypto.randomUUID(), time: opts.clipDuration, property: 'opacity', value: 0, easing: 'linear' }
          );
        }

        return kfs;
      },
    });

    // 2. Editorial Text Reveal: High-end kinetic editorial tracking & clean wipe
    this.register({
      id: 'editorial-reveal',
      name: 'Editorial Text Reveal',
      category: 'text',
      description: 'Clean typographic wipe with mask progression and minimal vertical drift',
      defaultEnterDuration: 0.55,
      defaultExitDuration: 0.4,
      recommendedEasing: 'cubic-bezier',
      generate: (opts) => {
        const stagger = (opts.staggerIndex || 0) * (opts.staggerDelay || 0.06);
        const t0 = Math.min(stagger, opts.clipDuration * 0.4);
        const t1 = Math.min(t0 + (opts.enterDuration ?? 0.55), opts.clipDuration);

        const kfs: Keyframe[] = [
          // Mask wipe vertical expansion
          { id: crypto.randomUUID(), time: t0, property: 'maskHeight', value: 0, easing: 'cubic-bezier', bezierPoints: CINEMATIC_DECEL_BEZIER },
          { id: crypto.randomUUID(), time: t1, property: 'maskHeight', value: 100, easing: 'linear' },
          // Subtle position drift
          { id: crypto.randomUUID(), time: t0, property: 'y', value: 30, easing: 'cubic-bezier', bezierPoints: STUDIO_SMOOTH_BEZIER },
          { id: crypto.randomUUID(), time: t1, property: 'y', value: 0, easing: 'linear' },
          { id: crypto.randomUUID(), time: t0, property: 'opacity', value: 0, easing: 'linear' },
          { id: crypto.randomUUID(), time: Math.min(t0 + 0.12, opts.clipDuration), property: 'opacity', value: 1, easing: 'linear' },
        ];

        return kfs;
      },
    });

    // 3. Logo Reveal: Premium scale pop, overshoot, and vector trim-end build
    this.register({
      id: 'brand-logo-reveal',
      name: 'Brand Logo Reveal',
      category: 'graphic',
      description: 'Signature brand symbol reveal with vector path trim, scale bounce, and subtle glow settle',
      defaultEnterDuration: 0.8,
      defaultExitDuration: 0.5,
      recommendedEasing: 'back-out',
      generate: (opts) => {
        const t0 = 0;
        const dur = opts.enterDuration ?? 0.8;
        const tSettle = Math.min(t0 + dur, opts.clipDuration);

        return [
          // Scale from 0.75 to 1.0 with back-out spring
          { id: crypto.randomUUID(), time: t0, property: 'scale', value: 0.78, easing: 'back-out' },
          { id: crypto.randomUUID(), time: tSettle, property: 'scale', value: 1.0, easing: 'linear' },
          // Opacity
          { id: crypto.randomUUID(), time: t0, property: 'opacity', value: 0, easing: 'ease-out' },
          { id: crypto.randomUUID(), time: Math.min(t0 + dur * 0.4, opts.clipDuration), property: 'opacity', value: 1, easing: 'linear' },
          // Trim end for vector shapes (0% to 100%)
          { id: crypto.randomUUID(), time: t0, property: 'trimEnd', value: 0, easing: 'cubic-bezier', bezierPoints: STUDIO_SMOOTH_BEZIER },
          { id: crypto.randomUUID(), time: tSettle, property: 'trimEnd', value: 100, easing: 'linear' },
        ];
      },
    });

    // 4. Smooth Camera Push: Continuous cinematic dolly/zoom
    this.register({
      id: 'camera-push',
      name: 'Cinematic Camera Push',
      category: 'camera',
      description: 'Slow, steady background or scene push to create depth and cinematic gravity',
      defaultEnterDuration: 1.0,
      defaultExitDuration: 0,
      recommendedEasing: 'linear',
      generate: (opts) => {
        const intensity = opts.intensity ?? 1.0;
        const targetScale = 1.0 + 0.06 * intensity;

        return [
          { id: crypto.randomUUID(), time: 0, property: 'scale', value: 1.0, easing: 'linear' },
          { id: crypto.randomUUID(), time: opts.clipDuration, property: 'scale', value: targetScale, easing: 'linear' },
        ];
      },
    });

    // 5. UI Card Entrance: Asymmetric slide and spring settle for UI cards and badges
    this.register({
      id: 'ui-card-entrance',
      name: 'UI Card Entrance',
      category: 'graphic',
      description: 'Snappy UI panel entrance with directional offset, slight rotation tilt, and elastic damping',
      defaultEnterDuration: 0.6,
      defaultExitDuration: 0.4,
      recommendedEasing: 'cubic-bezier',
      generate: (opts) => {
        const stagger = (opts.staggerIndex || 0) * (opts.staggerDelay || 0.1);
        const t0 = Math.min(stagger, opts.clipDuration * 0.5);
        const t1 = Math.min(t0 + (opts.enterDuration ?? 0.6), opts.clipDuration);
        const dir = opts.direction || 'up';

        let startX = 0;
        let startY = 0;
        const offset = opts.distance || 60;

        if (dir === 'up') startY = offset;
        else if (dir === 'down') startY = -offset;
        else if (dir === 'left') startX = offset;
        else if (dir === 'right') startX = -offset;

        return [
          { id: crypto.randomUUID(), time: t0, property: 'x', value: startX, easing: 'cubic-bezier', bezierPoints: STUDIO_SMOOTH_BEZIER },
          { id: crypto.randomUUID(), time: t1, property: 'x', value: 0, easing: 'linear' },
          { id: crypto.randomUUID(), time: t0, property: 'y', value: startY, easing: 'cubic-bezier', bezierPoints: STUDIO_SMOOTH_BEZIER },
          { id: crypto.randomUUID(), time: t1, property: 'y', value: 0, easing: 'linear' },
          { id: crypto.randomUUID(), time: t0, property: 'opacity', value: 0, easing: 'ease-out' },
          { id: crypto.randomUUID(), time: Math.min(t0 + (t1 - t0) * 0.6, opts.clipDuration), property: 'opacity', value: 1, easing: 'linear' },
          { id: crypto.randomUUID(), time: t0, property: 'scale', value: 0.92, easing: 'back-out' },
          { id: crypto.randomUUID(), time: t1, property: 'scale', value: 1.0, easing: 'linear' },
        ];
      },
    });

    // 6. Professional CTA Reveal: Punchy final call-to-action lockup with attention pulse
    this.register({
      id: 'cta-reveal',
      name: 'Call to Action Reveal',
      category: 'text',
      description: 'High-impact CTA reveal with bold scale entrance and rhythmic emphasis pulse',
      defaultEnterDuration: 0.7,
      defaultExitDuration: 0.4,
      recommendedEasing: 'cubic-bezier',
      generate: (opts) => {
        const t0 = 0;
        const tEnter = Math.min(opts.enterDuration ?? 0.7, opts.clipDuration * 0.6);
        const kfs: Keyframe[] = [
          // Scale entrance
          { id: crypto.randomUUID(), time: t0, property: 'scale', value: 0.85, easing: 'cubic-bezier', bezierPoints: STUDIO_SMOOTH_BEZIER },
          { id: crypto.randomUUID(), time: tEnter, property: 'scale', value: 1.0, easing: 'linear' },
          { id: crypto.randomUUID(), time: t0, property: 'opacity', value: 0, easing: 'linear' },
          { id: crypto.randomUUID(), time: Math.min(tEnter * 0.5, opts.clipDuration), property: 'opacity', value: 1, easing: 'linear' },
        ];

        // Pulse at 2.0s if clip is long enough
        if (opts.clipDuration > tEnter + 1.2) {
          const tPulse = tEnter + 0.8;
          kfs.push(
            { id: crypto.randomUUID(), time: tPulse, property: 'scale', value: 1.0, easing: 'ease-out' },
            { id: crypto.randomUUID(), time: tPulse + 0.15, property: 'scale', value: 1.03, easing: 'ease-in-out' },
            { id: crypto.randomUUID(), time: tPulse + 0.35, property: 'scale', value: 1.0, easing: 'linear' }
          );
        }

        return kfs;
      },
    });

    // 7. Kinetic Wipe Mask: Directional linear reveal
    this.register({
      id: 'kinetic-mask-wipe',
      name: 'Kinetic Mask Wipe',
      category: 'transition',
      description: 'Directional mask progression revealing content from an edge with high velocity',
      defaultEnterDuration: 0.5,
      defaultExitDuration: 0.4,
      recommendedEasing: 'expo-out',
      generate: (opts) => {
        const t0 = (opts.staggerIndex || 0) * (opts.staggerDelay || 0.08);
        const t1 = Math.min(t0 + (opts.enterDuration ?? 0.5), opts.clipDuration);

        return [
          { id: crypto.randomUUID(), time: t0, property: 'maskWidth', value: 0, easing: 'expo-out' },
          { id: crypto.randomUUID(), time: t1, property: 'maskWidth', value: 100, easing: 'linear' },
          { id: crypto.randomUUID(), time: t0, property: 'opacity', value: 0, easing: 'linear' },
          { id: crypto.randomUUID(), time: Math.min(t0 + 0.05, opts.clipDuration), property: 'opacity', value: 1, easing: 'linear' },
        ];
      },
    });
  }

  public static register(preset: PresetDefinition): void {
    this.presets.set(preset.id, preset);
  }

  public static getPreset(id: string): PresetDefinition | undefined {
    return this.presets.get(id);
  }

  public static listPresets(): PresetDefinition[] {
    return Array.from(this.presets.values());
  }

  public static generateKeyframes(presetId: string, options: MotionPresetOptions): Keyframe[] {
    const preset = this.presets.get(presetId);
    if (!preset) {
      // Fallback default smooth fade-in
      return [
        { id: crypto.randomUUID(), time: 0, property: 'opacity', value: 0, easing: 'ease-out' },
        { id: crypto.randomUUID(), time: Math.min(0.5, options.clipDuration), property: 'opacity', value: 1, easing: 'linear' },
      ];
    }
    return preset.generate(options);
  }

  public static applyPresetToClip(
    clip: TimelineClip,
    presetId: string,
    options?: Partial<MotionPresetOptions>
  ): TimelineClip {
    const mergedOpts: MotionPresetOptions = {
      clipDuration: clip.duration,
      ...options,
    };

    const newKeyframes = this.generateKeyframes(presetId, mergedOpts);
    
    // Merge new keyframes with existing keyframes that don't collide on property and time
    const updatedKeyframes = [...clip.keyframes.filter(k => 
      !newKeyframes.some(nk => nk.property === k.property && Math.abs(nk.time - k.time) < 0.05)
    ), ...newKeyframes];

    // Sort chronologically
    updatedKeyframes.sort((a, b) => a.time - b.time);

    return {
      ...clip,
      keyframes: updatedKeyframes,
    };
  }
}
