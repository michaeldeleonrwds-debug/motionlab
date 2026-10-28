/**
 * MotionLab Creative Intelligence Engine (MCIE) — Comprehensive Unit & Integration Tests
 */

import { describe, expect, it } from 'vitest';
import {
  CompositionEngine,
  CreativeDirector,
  IterativeRefinementEngine,
  MotionPresetEngine,
  SceneCompiler,
  TypographyEngine,
  VisualCritic,
  initializeCoreSkills,
} from '../index';

describe('MotionLab Creative Intelligence Engine (MCIE)', () => {
  describe('1. TypographyEngine', () => {
    it('generates modular typographic scales correctly', () => {
      const scale = TypographyEngine.generateScale(16, 'major-third');
      expect(scale.body).toBe(16);
      expect(scale.subhead).toBeGreaterThan(16);
      expect(scale.title).toBeGreaterThan(scale.subhead);
      expect(scale.headline).toBeGreaterThan(scale.title);
      expect(scale.display).toBeGreaterThan(scale.headline);
    });

    it('estimates text dimensions deterministically', () => {
      const bounds = TypographyEngine.estimateTextDimensions('MOTIONLAB STUDIO', 48, 'Inter, sans-serif');
      expect(bounds.width).toBeGreaterThan(300);
      expect(bounds.height).toBeGreaterThan(40);
    });

    it('calculates WCAG contrast ratio accurately', () => {
      // Pure White on Pure Black = 21:1
      const maxContrast = TypographyEngine.getContrastRatio('#FFFFFF', '#000000');
      expect(maxContrast).toBeCloseTo(21, 0);

      // Angora Lime on Dark Void
      const limeOnDark = TypographyEngine.getContrastRatio('#D7E83F', '#0B0F0B');
      expect(limeOnDark).toBeGreaterThan(4.5); // passes WCAG AA

      // Dark gray on black
      const lowContrast = TypographyEngine.getContrastRatio('#1a1a1a', '#000000');
      expect(lowContrast).toBeLessThan(4.5);
    });

    it('diagnoses text and flags safe-zone or contrast violations', () => {
      const diag = TypographyEngine.diagnose('Angora Web Services', {
        fontSize: 48,
        textColorHex: '#D7E83F',
        backgroundColorHex: '#0B0F0B',
        viewportWidth: 1920,
        viewportHeight: 1080,
      });
      expect(diag.wcagAaCompliant).toBe(true);
      expect(diag.fitsWithinSafeZone).toBe(true);
      expect(diag.issues.length).toBe(0);
    });
  });

  describe('2. CompositionEngine', () => {
    it('returns sequence dimensions for 1080p and 720p', () => {
      const d169 = CompositionEngine.getSequenceDimensions('1080p', '16:9');
      expect(d169.width).toBe(1920);
      expect(d169.height).toBe(1080);

      const d916 = CompositionEngine.getSequenceDimensions('1080p', '9:16');
      expect(d916.width).toBe(1080);
      expect(d916.height).toBe(1920);
    });

    it('calculates safe area margins including vertical platform UI safe zone', () => {
      const margins916 = CompositionEngine.getSafeMargins('1080p', '9:16');
      expect(margins916.platformUiSafe.height).toBeLessThan(margins916.titleSafe.height);
      expect(margins916.platformUiSafe.bottom).toBeLessThan(margins916.titleSafe.bottom);
    });

    it('detects collisions between overlapping elements', () => {
      const seq = CompositionEngine.getSequenceDimensions('1080p', '16:9');
      const clips: any[] = [
        {
          id: 'c1',
          name: 'Hero Title',
          trackId: 't1',
          type: 'text',
          startTime: 0,
          duration: 3,
          x: 0,
          y: 0,
          scale: 1,
          textStyle: { content: 'HERO TITLE', fontSize: 60 },
        },
        {
          id: 'c2',
          name: 'Overlapping Subtitle',
          trackId: 't2',
          type: 'text',
          startTime: 0,
          duration: 3,
          x: 10,
          y: 10,
          scale: 1,
          textStyle: { content: 'OVERLAPPING SUBTITLE', fontSize: 50 },
        },
      ];

      const diag = CompositionEngine.analyzeComposition(clips, seq, 1.0);
      expect(diag.collisions.length).toBeGreaterThan(0);
      expect(diag.visualBalanceScore).toBeGreaterThan(0);
    });
  });

  describe('3. MotionPresetEngine', () => {
    it('generates studio-calibrated keyframes for title entrance', () => {
      const kfs = MotionPresetEngine.generateKeyframes('refined-title-entrance', {
        clipDuration: 4.0,
        enterDuration: 0.65,
        overshoot: 0.15,
      });

      expect(kfs.length).toBeGreaterThanOrEqual(4);
      expect(kfs.some((k) => k.property === 'opacity')).toBe(true);
      expect(kfs.some((k) => k.property === 'y')).toBe(true);
      expect(kfs.some((k) => k.property === 'scale')).toBe(true);
    });

    it('applies preset directly to a TimelineClip', () => {
      const clip: any = {
        id: 'clip-1',
        name: 'Test Clip',
        duration: 3.0,
        keyframes: [],
      };

      const updated = MotionPresetEngine.applyPresetToClip(clip, 'brand-logo-reveal');
      expect(updated.keyframes.length).toBeGreaterThan(0);
      expect(updated.keyframes.every((k) => k.time <= 3.0)).toBe(true);
    });
  });

  describe('4. SceneCompiler', () => {
    it('compiles a production plan into a complete native MotionLab project', () => {
      const brief = CreativeDirector.analyzeBrief({
        brandName: 'Angora Web Services',
        title: 'Angora V3 Showreel',
        durationSeconds: 15,
      });
      const plan = CreativeDirector.createProductionPlan(brief);
      const compiled = SceneCompiler.compile(plan);

      expect(compiled.project.tracks.length).toBe(6);
      expect(compiled.project.clips.length).toBeGreaterThanOrEqual(8);
      expect(compiled.totalDuration).toBeCloseTo(15, 0);
      expect(compiled.project.clips.some((c) => c.type === 'text')).toBe(true);
      expect(compiled.project.clips.some((c) => c.type === 'image')).toBe(true);
    });
  });

  describe('5. VisualCritic & IterativeRefinementEngine', () => {
    it('critiques a project and assigns rubric score and grade', () => {
      const brief = CreativeDirector.analyzeBrief({ brandName: 'Angora' });
      const plan = CreativeDirector.createProductionPlan(brief);
      const compiled = SceneCompiler.compile(plan);

      const report = VisualCritic.critiqueProject(compiled.project, ['#D7E83F', '#0B0F0B', '#FFFFFF']);
      expect(report.rubric.overallScore).toBeGreaterThan(50);
      expect(report.findings).toBeInstanceOf(Array);
      expect(['A+', 'A', 'B', 'C', 'Needs-Work']).toContain(report.rubric.grade);
    });

    it('auto-refines a project through iterative feedback loops', () => {
      const brief = CreativeDirector.analyzeBrief({ brandName: 'Angora' });
      const plan = CreativeDirector.createProductionPlan(brief);
      const compiled = SceneCompiler.compile(plan);

      const refinement = IterativeRefinementEngine.autoRefine(
        compiled.project,
        ['#D7E83F', '#0B0F0B', '#FFFFFF'],
        2
      );

      expect(refinement.refinedScore).toBeGreaterThanOrEqual(refinement.initialScore);
      expect(refinement.project).toBeDefined();
    });
  });

  describe('6. CreativeDirector End-to-End Pipeline', () => {
    it('produces a complete ready-to-render project from a text prompt', () => {
      const { project, report, plan } = CreativeDirector.produceProject(
        'Create a punchy 15-second commercial for Angora Web Services showcasing automation and web design'
      );

      expect(project.clips.length).toBeGreaterThan(6);
      expect(report.rubric.overallScore).toBeGreaterThanOrEqual(75);
      expect(plan.scenes.length).toBe(4);
    });
  });

  describe('7. SkillRegistry & Core Skills', () => {
    it('registers and lists the 5 core professional skills', () => {
      const registry = initializeCoreSkills();
      const skills = registry.listSkills();

      expect(skills.length).toBeGreaterThanOrEqual(5);
      expect(skills.some((s) => s.id === 'creative-direction')).toBe(true);
      expect(skills.some((s) => s.id === 'typography-mastery')).toBe(true);
      expect(skills.some((s) => s.id === 'composition-mastery')).toBe(true);
      expect(skills.some((s) => s.id === 'motion-principles')).toBe(true);
      expect(skills.some((s) => s.id === 'visual-critique')).toBe(true);
    });

    it('executes a skill workflow successfully', async () => {
      const registry = initializeCoreSkills();
      const result = await registry.executeWorkflow('typography-mastery', 'generate_scale', {
        parameters: { baseSize: 18, scaleType: 'golden-ratio' },
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
