/**
 * MotionLab Creative Intelligence Engine (MCIE) — Creative Director
 * High-level artistic orchestrator that transforms creative concepts, briefs, and
 * brand guidelines into structured treatments, storyboards, and executable projects.
 */

import type { ProjectData } from '../../types/editor';
import type {
  BrandColorRole,
  CreativeBrief,
  CreativeTreatment,
  CritiqueReport,
  ProductionPlan,
  StoryboardLayerSpec,
  StoryboardScene,
} from '../types';
import { CompositionEngine } from './CompositionEngine';
import { IterativeRefinementEngine } from './IterativeRefinementEngine';
import { SceneCompiler } from './SceneCompiler';
import { TypographyEngine } from './TypographyEngine';

export class CreativeDirector {
  /**
   * Analyzes a raw user prompt or partial brief and synthesizes a fully typed CreativeBrief
   */
  public static analyzeBrief(input: string | Partial<CreativeBrief>): CreativeBrief {
    const isString = typeof input === 'string';
    const text = isString ? input : input.objective || input.title || '';

    const id = isString ? `brief-${Date.now()}` : input.id || `brief-${Date.now()}`;
    const brandName = (!isString && input.brandName) || (text.includes('Angora') ? 'Angora Web Services' : 'MotionLab Studio');
    const title = (!isString && input.title) || `${brandName} — Commercial Campaign`;
    const objective = (!isString && input.objective) || text || 'Create high-impact brand commercial with kinetic typography and geometric motion.';
    const durationSeconds = (!isString && input.durationSeconds) || 15;
    const aspectRatio = (!isString && input.aspectRatio) || '16:9';
    const resolution = (!isString && input.resolution) || '1080p';
    const fps = (!isString && input.fps) || 30;

    // Default high-contrast agency palette
    const defaultPalette: BrandColorRole[] = [
      { name: 'Dark Void', hex: '#0B0F0B', role: 'background' },
      { name: 'Deep Forest', hex: '#172018', role: 'surface' },
      { name: 'Angora Lime', hex: '#D7E83F', role: 'accent' },
      { name: 'Bright Neon', hex: '#C8FF20', role: 'highlight' },
      { name: 'Pure White', hex: '#FFFFFF', role: 'text-primary' },
      { name: 'Muted Sage', hex: '#A6ADA4', role: 'text-muted' },
    ];

    const colorPalette = (!isString && input.colorPalette && input.colorPalette.length > 0)
      ? input.colorPalette
      : defaultPalette;

    const keyMessages = (!isString && input.keyMessages && input.keyMessages.length > 0)
      ? input.keyMessages
      : [
          'Precision Digital Engineering',
          'Kinetic Typography & Dynamic Motion',
          'Scalable Creative Production',
        ];

    return {
      id,
      title,
      objective,
      targetAudience: (!isString && input.targetAudience) || 'High-growth brands, creative directors, and founders',
      brandTone: (!isString && input.brandTone) || 'high-tech-precision',
      brandName,
      tagline: (!isString && input.tagline) || 'Your Agency. Our Execution.',
      durationSeconds,
      aspectRatio,
      resolution,
      fps,
      colorPalette,
      keyMessages,
      callToAction: (!isString && input.callToAction) || {
        headline: 'Scale Your Creative Vision',
        subline: 'Work with Angora Web Services',
        actionText: 'Get Started Today',
        urlOrHandle: 'angora.io',
      },
      hardConstraints: [
        'Maintain WCAG AA typography contrast ratio >= 4.5:1',
        'Preserve 80% Title Safe zone for all text elements',
        'Use native MotionLab keyframe curves without external dependencies',
      ],
    };
  }

  /**
   * Generates an artistic CreativeTreatment based on an approved CreativeBrief
   */
  public static generateTreatment(brief: CreativeBrief): CreativeTreatment {
    // Select type scale: Major Third (1.25) for clean high-tech editorial
    const scaleRatio = 1.25;
    const accentColor = brief.colorPalette.find((c) => c.role === 'accent')?.hex || '#D7E83F';

    // 15-second standard 4-act commercial pacing:
    // Scene 1: Brand Hook / Intro (0 - 3.5s)
    // Scene 2: Core Philosophy / Statement (3.5 - 7.5s)
    // Scene 3: Feature / Services Showcase (7.5 - 11.5s)
    // Scene 4: Climax / Call to Action (11.5 - 15.0s)
    const sceneBreakdown = [
      {
        sceneIndex: 1,
        title: 'Cinematic Brand Hook',
        startTime: 0,
        duration: 3.5,
        purpose: 'Establish visual atmosphere, brand authority, and ribbon-A monogram reveal',
        focalPoint: 'Center Monogram & Typography Anchor',
        keyVisualElements: ['Geometric Grid', 'Brand Monogram', 'Headline Title'],
      },
      {
        sceneIndex: 2,
        title: 'Core Philosophy & Manifesto',
        startTime: 3.5,
        duration: 4.0,
        purpose: 'Deliver brand statement with kinetic editorial typography and dynamic rule-lines',
        focalPoint: 'Editorial Typography Left-Aligned Hierarchy',
        keyVisualElements: ['Manifesto Text', 'Architectural Accent Bar', 'Subhead'],
      },
      {
        sceneIndex: 3,
        title: 'Capabilities & Capabilities Matrix',
        startTime: 7.5,
        duration: 4.0,
        purpose: 'Rapid showcase of core services: Web Design, Web Dev, Video, Automation',
        focalPoint: 'UI Card Layout & Staggered Accents',
        keyVisualElements: ['Service Matrix', 'Status Badges', 'Crosshairs'],
      },
      {
        sceneIndex: 4,
        title: 'Authoritative Climax & CTA',
        startTime: 11.5,
        duration: 3.5,
        purpose: 'Final brand lockup, authoritative tagline, and prominent conversion action',
        focalPoint: 'Center Hero Monogram + CTA Lockup',
        keyVisualElements: ['Brand Logo', 'Call to Action Button', 'URL Anchor'],
      },
    ];

    return {
      briefId: brief.id,
      title: `${brief.brandName} — Directional Treatment`,
      logline: `A precision 15-second commercial blending Swiss graphic design with cinematic motion graphics.`,
      brandTone: brief.brandTone,
      visualTheme: 'bold-editorial',
      typographySystem: {
        primaryFont: 'Syne, Montserrat, sans-serif',
        secondaryFont: 'Inter, sans-serif',
        scaleRatio,
        headlineStyle: { weight: 800, tracking: -1, leading: 1.1, uppercase: true },
        bodyStyle: { weight: 500, tracking: 0, leading: 1.4, uppercase: false },
      },
      colorRoles: brief.colorPalette,
      compositionGrid: {
        type: 'rule-of-thirds',
        safeMarginPercent: 10,
        alignmentBias: 'left-editorial',
      },
      motionLanguage: {
        primaryEasing: 'cubic-bezier',
        tempoBpm: 124,
        staggerDelaySeconds: 0.08,
        anticipationEnabled: true,
        overshootAmplitude: 0.15,
        defaultTransition: 'cross-dissolve',
        defaultTransitionDuration: 0.5,
      },
      audioDirection: {
        genre: 'Modern Tech Hybrid Beats',
        tempo: 'medium',
        duckingDb: -6,
        syncCutToBeat: true,
      },
      sceneBreakdown,
    };
  }

  /**
   * Builds detailed StoryboardScene specifications from treatment and brief
   */
  public static createStoryboard(treatment: CreativeTreatment, brief: CreativeBrief): StoryboardScene[] {
    const seq = CompositionEngine.getSequenceDimensions(brief.resolution, brief.aspectRatio);
    const scenes: StoryboardScene[] = [];

    const accentColor = brief.colorPalette.find((c) => c.role === 'accent')?.hex || '#D7E83F';
    const bgColor = brief.colorPalette.find((c) => c.role === 'background')?.hex || '#0B0F0B';
    const surfaceColor = brief.colorPalette.find((c) => c.role === 'surface')?.hex || '#172018';
    const textPrimary = brief.colorPalette.find((c) => c.role === 'text-primary')?.hex || '#FFFFFF';

    for (const item of treatment.sceneBreakdown) {
      const layers: StoryboardLayerSpec[] = [];

      // 1. Background layer (every scene has background)
      layers.push({
        id: `bg-s${item.sceneIndex}`,
        name: `Scene ${item.sceneIndex} Canvas BG`,
        type: 'shape',
        trackType: 'video',
        order: 5,
        startTime: 0,
        duration: item.duration,
        layout: { x: 0, y: 0, width: seq.width, height: seq.height, anchor: 'center' },
        shapeType: 'rectangle',
        fillColor: bgColor,
        strokeWidth: 0,
        motion: {
          presetName: 'camera-push',
          enterDuration: item.duration,
          enterEasing: 'linear',
          exitDuration: 0,
          exitEasing: 'linear',
        },
      });

      // 2. Scene specific elements
      if (item.sceneIndex === 1) {
        // Scene 1: Brand Hook
        // Decorative grid line
        layers.push({
          id: `shape-s1-crosshair`,
          name: 'Hero Architectural Crosshair',
          type: 'shape',
          trackType: 'overlay',
          order: 4,
          startTime: 0.2,
          duration: item.duration - 0.2,
          layout: { x: 0, y: -40, width: 320, height: 320, anchor: 'center' },
          shapeType: 'crosshair',
          strokeColor: accentColor,
          strokeWidth: 2,
          motion: {
            presetName: 'brand-logo-reveal',
            enterDuration: 0.8,
            enterEasing: 'back-out',
            exitDuration: 0.3,
            exitEasing: 'ease-out',
          },
        });

        // Headline
        layers.push({
          id: `txt-s1-brand`,
          name: 'Brand Hero Headline',
          type: 'text',
          trackType: 'text',
          order: 1,
          startTime: 0.4,
          duration: item.duration - 0.4,
          layout: { x: 0, y: 80, width: 800, height: 100, anchor: 'center' },
          content: brief.brandName.toUpperCase(),
          fontFamily: treatment.typographySystem.primaryFont,
          fontSize: 64,
          fontWeight: 800,
          color: textPrimary,
          motion: {
            presetName: 'refined-title-entrance',
            enterDuration: 0.7,
            enterEasing: 'cubic-bezier',
            exitDuration: 0.4,
            exitEasing: 'ease-out',
            overshoot: 0.1,
          },
        });

        // Tagline
        if (brief.tagline) {
          layers.push({
            id: `txt-s1-tagline`,
            name: 'Brand Subline Tagline',
            type: 'text',
            trackType: 'text',
            order: 2,
            startTime: 0.8,
            duration: item.duration - 0.8,
            layout: { x: 0, y: 150, width: 700, height: 60, anchor: 'center' },
            content: brief.tagline,
            fontFamily: treatment.typographySystem.secondaryFont,
            fontSize: 24,
            fontWeight: 500,
            color: accentColor,
            motion: {
              presetName: 'editorial-reveal',
              enterDuration: 0.6,
              enterEasing: 'cubic-bezier',
              exitDuration: 0.3,
              exitEasing: 'ease-out',
            },
          });
        }
      } else if (item.sceneIndex === 2) {
        // Scene 2: Manifesto / Statement
        const message = brief.keyMessages[0] || 'ENGINEERING DIGITAL EXCELLENCE';

        layers.push({
          id: `txt-s2-manifesto`,
          name: 'Manifesto Core Statement',
          type: 'text',
          trackType: 'text',
          order: 1,
          startTime: 0.3,
          duration: item.duration - 0.3,
          layout: { x: 0, y: -20, width: 900, height: 160, anchor: 'center' },
          content: message,
          fontFamily: treatment.typographySystem.primaryFont,
          fontSize: 54,
          fontWeight: 800,
          color: textPrimary,
          motion: {
            presetName: 'refined-title-entrance',
            enterDuration: 0.7,
            enterEasing: 'cubic-bezier',
            exitDuration: 0.4,
            exitEasing: 'ease-out',
          },
        });

        layers.push({
          id: `shape-s2-accent-line`,
          name: 'Accent Framing Bar',
          type: 'shape',
          trackType: 'overlay',
          order: 3,
          startTime: 0.6,
          duration: item.duration - 0.6,
          layout: { x: 0, y: 70, width: 120, height: 4, anchor: 'center' },
          shapeType: 'rectangle',
          fillColor: accentColor,
          motion: {
            presetName: 'kinetic-mask-wipe',
            enterDuration: 0.5,
            enterEasing: 'expo-out',
            exitDuration: 0.3,
            exitEasing: 'ease-out',
          },
        });
      } else if (item.sceneIndex === 3) {
        // Scene 3: Services Showcase / UI Card
        const services = ['WEB DESIGN', 'ENGINEERING', 'MOTION GRAPHICS', 'AUTOMATION'];
        const cardWidth = 360;
        const cardHeight = 220;

        layers.push({
          id: `shape-s3-card`,
          name: 'Capabilities Container Card',
          type: 'shape',
          trackType: 'overlay',
          order: 3,
          startTime: 0.3,
          duration: item.duration - 0.3,
          layout: { x: 0, y: 0, width: cardWidth, height: cardHeight, anchor: 'center' },
          shapeType: 'rectangle',
          fillColor: surfaceColor,
          strokeColor: accentColor,
          strokeWidth: 2,
          motion: {
            presetName: 'ui-card-entrance',
            enterDuration: 0.6,
            enterEasing: 'cubic-bezier',
            exitDuration: 0.4,
            exitEasing: 'ease-out',
            direction: 'up',
          },
        });

        layers.push({
          id: `txt-s3-title`,
          name: 'Capabilities Card Title',
          type: 'text',
          trackType: 'text',
          order: 1,
          startTime: 0.6,
          duration: item.duration - 0.6,
          layout: { x: 0, y: -45, width: 320, height: 50, anchor: 'center' },
          content: 'CORE CAPABILITIES',
          fontFamily: treatment.typographySystem.primaryFont,
          fontSize: 26,
          fontWeight: 700,
          color: accentColor,
          motion: {
            presetName: 'editorial-reveal',
            enterDuration: 0.5,
            enterEasing: 'cubic-bezier',
            exitDuration: 0.3,
            exitEasing: 'ease-out',
          },
        });

        layers.push({
          id: `txt-s3-list`,
          name: 'Capabilities List Item',
          type: 'text',
          trackType: 'text',
          order: 2,
          startTime: 0.9,
          duration: item.duration - 0.9,
          layout: { x: 0, y: 25, width: 320, height: 60, anchor: 'center' },
          content: services.slice(0, 2).join('  •  '),
          fontFamily: treatment.typographySystem.secondaryFont,
          fontSize: 20,
          fontWeight: 600,
          color: textPrimary,
          motion: {
            presetName: 'refined-title-entrance',
            enterDuration: 0.5,
            enterEasing: 'cubic-bezier',
            exitDuration: 0.3,
            exitEasing: 'ease-out',
          },
        });
      } else if (item.sceneIndex === 4) {
        // Scene 4: Final Authoritative CTA Lockup
        const cta = brief.callToAction || { headline: 'Work With Us', urlOrHandle: 'angora.io' };

        layers.push({
          id: `txt-s4-headline`,
          name: 'Final CTA Headline',
          type: 'text',
          trackType: 'text',
          order: 1,
          startTime: 0.3,
          duration: item.duration - 0.3,
          layout: { x: 0, y: -40, width: 800, height: 80, anchor: 'center' },
          content: cta.headline.toUpperCase(),
          fontFamily: treatment.typographySystem.primaryFont,
          fontSize: 52,
          fontWeight: 800,
          color: textPrimary,
          motion: {
            presetName: 'cta-reveal',
            enterDuration: 0.7,
            enterEasing: 'cubic-bezier',
            exitDuration: 0.3,
            exitEasing: 'ease-out',
          },
        });

        if (cta.urlOrHandle) {
          layers.push({
            id: `txt-s4-url`,
            name: 'Final CTA URL Badge',
            type: 'text',
            trackType: 'text',
            order: 2,
            startTime: 0.7,
            duration: item.duration - 0.7,
            layout: { x: 0, y: 45, width: 360, height: 48, anchor: 'center' },
            content: cta.urlOrHandle,
            fontFamily: treatment.typographySystem.secondaryFont,
            fontSize: 28,
            fontWeight: 700,
            color: accentColor,
            motion: {
              presetName: 'refined-title-entrance',
              enterDuration: 0.5,
              enterEasing: 'cubic-bezier',
              exitDuration: 0.3,
              exitEasing: 'ease-out',
            },
          });
        }
      }

      scenes.push({
        id: `scene-${item.sceneIndex}`,
        sceneIndex: item.sceneIndex,
        name: item.title,
        startTime: item.startTime,
        duration: item.duration,
        narrativeGoal: item.purpose,
        visualFocalPoint: item.focalPoint,
        layers,
        transitionIn: { type: treatment.motionLanguage.defaultTransition, duration: 0.5 },
        transitionOut: { type: treatment.motionLanguage.defaultTransition, duration: 0.5 },
      });
    }

    return scenes;
  }

  /**
   * Plans and constructs the complete ProductionPlan
   */
  public static createProductionPlan(briefInput: string | Partial<CreativeBrief>): ProductionPlan {
    const brief = this.analyzeBrief(briefInput);
    const treatment = this.generateTreatment(brief);
    const scenes = this.createStoryboard(treatment, brief);

    const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
    const estimatedClipCount = scenes.reduce((sum, s) => sum + s.layers.length, 0);

    return {
      brief,
      treatment,
      scenes,
      totalDuration,
      estimatedClipCount,
      estimatedTrackCount: 6,
      validated: true,
    };
  }

  /**
   * Complete end-to-end production: brief -> treatment -> storyboard -> compile -> critique & refine -> ready project
   */
  public static produceProject(briefInput: string | Partial<CreativeBrief>): {
    project: ProjectData;
    report: CritiqueReport;
    plan: ProductionPlan;
  } {
    const plan = this.createProductionPlan(briefInput);
    const compiled = SceneCompiler.compile(plan);

    const brandColors = plan.brief.colorPalette.map((c) => c.hex);
    const refinement = IterativeRefinementEngine.autoRefine(compiled.project, brandColors, 3);

    return {
      project: refinement.project,
      report: refinement.report,
      plan,
    };
  }
}
