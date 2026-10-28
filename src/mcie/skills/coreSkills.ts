/**
 * MotionLab Creative Intelligence Engine (MCIE) — Core Professional Skills
 * Initializes and registers the 5 foundational agent skills:
 * 1. Creative Direction
 * 2. Typography Mastery
 * 3. Composition Mastery
 * 4. Motion Principles
 * 5. Visual Critique & Refinement
 */

import { CompositionEngine } from '../engine/CompositionEngine';
import { CreativeDirector } from '../engine/CreativeDirector';
import { IterativeRefinementEngine } from '../engine/IterativeRefinementEngine';
import { MotionPresetEngine } from '../engine/MotionPresetEngine';
import { TypographyEngine } from '../engine/TypographyEngine';
import { VisualCritic } from '../engine/VisualCritic';
import type { SkillMetadata } from '../types';
import { SkillRegistry } from './SkillRegistry';
import { registerHyperframesSkills } from './hyperframesSkills';

export function initializeCoreSkills(): SkillRegistry {
  const registry = SkillRegistry.getInstance();

  // ==========================================
  // 1. Creative Direction Skill
  // ==========================================
  const creativeDirectionMeta: SkillMetadata = {
    id: 'creative-direction',
    name: 'Creative Direction & Campaign Architecture',
    version: '1.0.0',
    category: 'creative-direction',
    description: 'Directs narrative commercial pacing, high-concept loglines, tone-to-system translation, and multi-act scene compilation.',
    author: 'MotionLab AI Systems',
    inputRequirements: ['Creative brief or concept prompt', 'Brand parameters', 'Duration goal'],
    creativePrinciples: [
      'Every second must advance narrative tension or product clarity',
      'The 4-act structure: Hook (0-20%), Manifesto (20-50%), Proof/Capabilities (50-80%), Climax/CTA (80-100%)',
      'High-contrast visual hierarchy over superficial decoration',
    ],
    applicableProjectTypes: ['Brand Commercial', 'Product Launch', 'Agency Showreel', 'Feature Announcement'],
    requiredMotionLabTools: ['analyze_creative_brief', 'generate_creative_treatment', 'create_storyboard'],
    qualityRubricFocus: ['Brand consistency', 'Narrative flow', 'Commercial pacing'],
    executableWorkflows: [
      { id: 'analyze_brief', name: 'Analyze Creative Brief', description: 'Parses raw intent into a structured CreativeBrief' },
      { id: 'generate_treatment', name: 'Generate Treatment', description: 'Creates an artistic treatment with visual themes and font systems' },
      { id: 'build_production_plan', name: 'Build Production Plan', description: 'Constructs complete scenes, layer specs, and timeline structures' },
    ],
  };

  const creativeDirectionDoc = `
# Creative Direction Skill
Architects commercial narrative arcs, brand treatments, and multi-scene production plans.

## Capabilities
- Formulates high-concept loglines from simple client prompts
- Enforces strict 4-act commercial pacing
- Maps brand tones to concrete visual systems (typography, color roles, motion tokens)
`;

  registry.registerSkill(creativeDirectionMeta, creativeDirectionDoc, {
    analyze_brief: (ctx) => {
      const brief = CreativeDirector.analyzeBrief(ctx.brief || (ctx.parameters?.prompt as string) || {});
      return {
        success: true,
        skillId: 'creative-direction',
        workflowId: 'analyze_brief',
        output: brief,
        appliedChangesSummary: `Synthesized brief for "${brief.brandName}" (${brief.durationSeconds}s, ${brief.aspectRatio})`,
        durationMs: 0,
      };
    },
    generate_treatment: (ctx) => {
      const brief = ctx.brief || CreativeDirector.analyzeBrief(ctx.parameters?.prompt as string || {});
      const treatment = CreativeDirector.generateTreatment(brief);
      return {
        success: true,
        skillId: 'creative-direction',
        workflowId: 'generate_treatment',
        output: treatment,
        appliedChangesSummary: `Generated treatment with theme "${treatment.visualTheme}" and ${treatment.sceneBreakdown.length} scenes`,
        durationMs: 0,
      };
    },
    build_production_plan: (ctx) => {
      const plan = CreativeDirector.createProductionPlan(ctx.brief || (ctx.parameters?.prompt as string) || {});
      return {
        success: true,
        skillId: 'creative-direction',
        workflowId: 'build_production_plan',
        output: plan,
        appliedChangesSummary: `Built production plan with ${plan.scenes.length} scenes and ${plan.estimatedClipCount} planned layers`,
        durationMs: 0,
      };
    },
  });

  // ==========================================
  // 2. Typography Mastery Skill
  // ==========================================
  const typographyMeta: SkillMetadata = {
    id: 'typography-mastery',
    name: 'Typography Mastery & Spatial Hierarchy',
    version: '1.0.0',
    category: 'typography',
    description: 'Enforces mathematical type scales, optical bounding boxes, safe margins, word-wrap breaking, and WCAG AA contrast compliance.',
    author: 'MotionLab AI Systems',
    inputRequirements: ['Text content', 'Target font sizes', 'Viewport constraints'],
    creativePrinciples: [
      'Modular scales create predictable harmonic visual weight',
      'Text must never touch outer 10% action boundaries or 20% title safe boundaries without stylistic intent',
      'WCAG AA minimum 4.5:1 contrast ratio is non-negotiable for readability',
    ],
    applicableProjectTypes: ['Kinetic Typography', 'Brand Ads', 'Editorial Showreels'],
    requiredMotionLabTools: ['create_typographic_layout', 'diagnose_typography'],
    qualityRubricFocus: ['Legibility', 'WCAG AA Compliance', 'Hierarchy Consistency'],
    executableWorkflows: [
      { id: 'generate_scale', name: 'Generate Modular Scale', description: 'Calculates harmonic font sizes from base size and ratio' },
      { id: 'audit_text_clip', name: 'Audit Text Clip', description: 'Calculates bounding box, safe margins, and contrast ratio' },
    ],
  };

  const typographyDoc = `
# Typography Mastery Skill
Guarantees agency-grade typographic layout, responsive wrapping, and mathematical type scales.
`;

  registry.registerSkill(typographyMeta, typographyDoc, {
    generate_scale: (ctx) => {
      const base = (ctx.parameters?.baseSize as number) || 16;
      const scaleType = (ctx.parameters?.scaleType as any) || 'major-third';
      const scale = TypographyEngine.generateScale(base, scaleType);
      return {
        success: true,
        skillId: 'typography-mastery',
        workflowId: 'generate_scale',
        output: scale,
        appliedChangesSummary: `Generated ${scaleType} type scale (base: ${base}px, display: ${scale.display}px)`,
        durationMs: 0,
      };
    },
    audit_text_clip: (ctx) => {
      const clip = ctx.targetClip;
      if (!clip || !clip.textStyle) {
        throw new Error('Target text clip with textStyle required for typography audit.');
      }
      const seq = CompositionEngine.getSequenceDimensions('1080p', '16:9');
      const diag = TypographyEngine.diagnose(clip.textStyle.content, {
        fontSize: clip.textStyle.fontSize,
        fontFamily: clip.textStyle.fontFamily,
        textColorHex: clip.textStyle.color,
        backgroundColorHex: clip.textStyle.backgroundColor || '#0B0F0B',
        viewportWidth: seq.width,
        viewportHeight: seq.height,
        position: { x: clip.x, y: clip.y },
      });
      return {
        success: true,
        skillId: 'typography-mastery',
        workflowId: 'audit_text_clip',
        output: diag,
        critiqueNotes: diag.issues,
        appliedChangesSummary: `Diagnosed text: contrast ${diag.contrastRatio.toFixed(2)}:1, safe-zone: ${diag.fitsWithinSafeZone}`,
        durationMs: 0,
      };
    },
  });

  // ==========================================
  // 3. Composition Mastery Skill
  // ==========================================
  const compositionMeta: SkillMetadata = {
    id: 'composition-mastery',
    name: 'Composition, Grids & Spatial Balance',
    version: '1.0.0',
    category: 'composition',
    description: 'Calculates AABB 2D bounding boxes, collision detection, center-of-mass visual balance, and platform safe zones.',
    author: 'MotionLab AI Systems',
    inputRequirements: ['Active timeline clips', 'Sequence dimensions', 'Current timestamp'],
    creativePrinciples: [
      'Visual weight must be intentionally anchored or dynamically balanced',
      'Overlapping elements must be explicitly hierarchical or parent-child grouped',
      'Vertical 9:16 video must leave 22% bottom margin for platform overlay icons',
    ],
    applicableProjectTypes: ['All formats', 'Vertical 9:16 reels', 'Broadcast 16:9'],
    requiredMotionLabTools: ['analyze_composition'],
    qualityRubricFocus: ['Spatial harmony', 'Collision avoidance', 'Safe-zone adherence'],
    executableWorkflows: [
      { id: 'analyze_layout', name: 'Analyze Layout', description: 'Calculates collisions, offscreen elements, and balance score' },
    ],
  };

  const compositionDoc = `
# Composition Mastery Skill
Ensures visual harmony, avoids accidental layout overlaps, and enforces platform UI clearance.
`;

  registry.registerSkill(compositionMeta, compositionDoc, {
    analyze_layout: (ctx) => {
      const clips = ctx.allClips || (ctx.targetClip ? [ctx.targetClip] : []);
      const seq = CompositionEngine.getSequenceDimensions('1080p', '16:9');
      const diag = CompositionEngine.analyzeComposition(clips, seq, ctx.currentTime || 0);
      return {
        success: true,
        skillId: 'composition-mastery',
        workflowId: 'analyze_layout',
        output: diag,
        appliedChangesSummary: `Analyzed composition: ${diag.collisions.length} collisions, balance: ${(diag.visualBalanceScore * 100).toFixed(0)}%`,
        durationMs: 0,
      };
    },
  });

  // ==========================================
  // 4. Motion Principles Skill
  // ==========================================
  const motionMeta: SkillMetadata = {
    id: 'motion-principles',
    name: 'Professional Motion Principles & Tokens',
    version: '1.0.0',
    category: 'motion-design',
    description: 'Implements Disney 12 principles adapted for modern UI & kinetic graphics: anticipation, overshoot, settle, and cubic Béziers.',
    author: 'MotionLab AI Systems',
    inputRequirements: ['Target clip', 'Motion preset name', 'Timing parameters'],
    creativePrinciples: [
      'Linear animation feels mechanical and cheap; use calibrated cubic-Béziers ([0.16, 1, 0.3, 1])',
      'Fast in, gentle settle out gives an interface premium physical weight',
      'Stagger children elements by 40-80ms to lead the eye sequentially',
    ],
    applicableProjectTypes: ['Kinetic Titles', 'Product Reveals', 'Logo Animations', 'UI Transitions'],
    requiredMotionLabTools: ['apply_motion_preset'],
    qualityRubricFocus: ['Fluidity', 'Rhythm', 'Curve calibration'],
    executableWorkflows: [
      { id: 'apply_preset', name: 'Apply Motion Preset', description: 'Injects studio-calibrated keyframes directly onto a clip' },
      { id: 'list_presets', name: 'List Motion Presets', description: 'Returns all available motion presets' },
    ],
  };

  const motionDoc = `
# Motion Principles Skill
Provides studio-grade keyframing presets with organic damping and easing curves.
`;

  registry.registerSkill(motionMeta, motionDoc, {
    apply_preset: (ctx) => {
      if (!ctx.targetClip) {
        throw new Error('Target clip required to apply motion preset.');
      }
      const presetName = (ctx.parameters?.presetName as string) || 'refined-title-entrance';
      const updated = MotionPresetEngine.applyPresetToClip(ctx.targetClip, presetName, ctx.parameters || {});
      return {
        success: true,
        skillId: 'motion-principles',
        workflowId: 'apply_preset',
        output: updated,
        appliedChangesSummary: `Applied preset "${presetName}" (${updated.keyframes.length} keyframes generated)`,
        durationMs: 0,
      };
    },
    list_presets: () => {
      const presets = MotionPresetEngine.listPresets();
      return {
        success: true,
        skillId: 'motion-principles',
        workflowId: 'list_presets',
        output: presets,
        appliedChangesSummary: `Found ${presets.length} motion presets available`,
        durationMs: 0,
      };
    },
  });

  // ==========================================
  // 5. Visual Critique & Quality Rubric Skill
  // ==========================================
  const critiqueMeta: SkillMetadata = {
    id: 'visual-critique',
    name: 'Visual Critique & Quality Rubric',
    version: '1.0.0',
    category: 'quality-critique',
    description: 'Deterministic quality auditor that evaluates typography, composition, motion pacing, and brand colors against broadcast standards.',
    author: 'MotionLab AI Systems',
    inputRequirements: ['Project data', 'Optional brand palette'],
    creativePrinciples: [
      'Every defect must have an actionable, measurable corrective diff',
      'Critique must be objective and deterministic, not subjective flavor text',
      'Automated refinement must preserve creative intent while enforcing technical safety',
    ],
    applicableProjectTypes: ['All projects'],
    requiredMotionLabTools: ['evaluate_scene', 'refine_scene', 'validate_project'],
    qualityRubricFocus: ['Broadcast standard compliance', 'Zero collision/clipping defects', 'WCAG AA text legibility'],
    executableWorkflows: [
      { id: 'critique_project', name: 'Critique Project', description: 'Executes comprehensive rubric score and finding list' },
      { id: 'auto_refine', name: 'Auto Refine Project', description: 'Executes iterative repair loop to fix defects' },
    ],
  };

  const critiqueDoc = `
# Visual Critique Skill
Provides comprehensive quality auditing and automated iterative refinement.
`;

  registry.registerSkill(critiqueMeta, critiqueDoc, {
    critique_project: (ctx) => {
      const project = ctx.parameters?.project as any;
      if (!project) throw new Error('Project data required for critique.');
      const brandColors = ctx.parameters?.brandColors as string[] | undefined;
      const report = VisualCritic.critiqueProject(project, brandColors);
      return {
        success: true,
        skillId: 'visual-critique',
        workflowId: 'critique_project',
        output: report,
        critiqueNotes: report.findings.map((f: any) => `[${f.severity.toUpperCase()}] ${f.issue}`),
        appliedChangesSummary: `Evaluated project: Grade ${report.rubric.grade} (${report.rubric.overallScore}/100), passing: ${report.isPassing}`,
        durationMs: 0,
      };
    },
    auto_refine: (ctx) => {
      const project = ctx.parameters?.project as any;
      if (!project) throw new Error('Project data required for refinement.');
      const brandColors = ctx.parameters?.brandColors as string[] | undefined;
      const result = IterativeRefinementEngine.autoRefine(project, brandColors, 3);
      return {
        success: true,
        skillId: 'visual-critique',
        workflowId: 'auto_refine',
        output: result,
        appliedChangesSummary: `Refined project in ${result.iteration} iteration(s): score ${result.initialScore} -> ${result.refinedScore}`,
        durationMs: 0,
      };
    },
  });

  // ==========================================
  // 6. Voice Direction & Speech Skill
  // ==========================================
  const voiceDirectionMeta: SkillMetadata = {
    id: 'voice-direction',
    name: 'Voice Direction & Speech Architecture',
    version: '1.0.0',
    category: 'audio',
    description: 'Directs vocal cadence, WPM pacing models, pause punctuation, and speech-to-motion subtitle synchronization.',
    author: 'MotionLab AI Systems',
    inputRequirements: ['Script text', 'Voice profile', 'Target scene duration'],
    creativePrinciples: [
      'Commercial cadence must balance authority and retention (130-140 WPM target)',
      'Natural sentence pauses (300-400ms) establish visual gravity and pacing',
      'Synchronize animation entrance keyframes with spoken vocal emphasis points',
    ],
    applicableProjectTypes: ['Commercials', 'Brand Films', 'Explainers', 'Trailers'],
    requiredMotionLabTools: ['voice_generate', 'voice_sync_to_animation', 'voice_generate_script'],
    qualityRubricFocus: ['Speech clarity', 'Pacing synchronization', 'Loudness normalization'],
    executableWorkflows: [
      { id: 'plan_voiceover', name: 'Plan Voiceover Pacing', description: 'Calculates WPM, word count, and duration estimates' },
      { id: 'generate_narration', name: 'Generate Narration Take', description: 'Synthesizes real speech using Voicebox / Studio engine' },
    ],
  };

  const voiceDirectionDoc = `
# Voice Direction Skill
Directs professional vocal cadence, WPM timing models, and motion synchronization.
`;

  registry.registerSkill(voiceDirectionMeta, voiceDirectionDoc, {
    plan_voiceover: async (ctx) => {
      const { VoiceDirectionEngine } = await import('../../voicebox/voiceDirectionSkill');
      const script = (ctx.parameters?.script as string) || 'Precision digital engineering meets visual elegance.';
      const preset = (ctx.parameters?.preset as string) || 'premium-commercial';
      const targetDuration = ctx.parameters?.targetDuration as number | undefined;
      const plan = VoiceDirectionEngine.planVoiceover(script, preset, targetDuration);
      return {
        success: true,
        skillId: 'voice-direction',
        workflowId: 'plan_voiceover',
        output: plan,
        appliedChangesSummary: `Planned voiceover: ${plan.wordCount} words, ~${plan.estimatedDurationSeconds}s at ${plan.pacingWpm} WPM`,
        durationMs: 0,
      };
    },
    generate_narration: async (ctx) => {
      const { VoiceboxAdapter } = await import('../../voicebox/VoiceboxAdapter');
      const adapter = VoiceboxAdapter.getInstance();
      const text = (ctx.parameters?.text as string) || 'At Angora Web Services, we turn ambitious brand visions into high-performance digital reality.';
      const profileId = (ctx.parameters?.profileId as string) || 'angora-exec-male';
      const result = await adapter.generateSpeech({ text, profileId });
      return {
        success: true,
        skillId: 'voice-direction',
        workflowId: 'generate_narration',
        output: {
          id: result.id,
          profileName: result.profileName,
          durationSeconds: result.durationSeconds,
          sampleRate: result.sampleRate,
          peakLevelDb: result.peakLevelDb,
        },
        appliedChangesSummary: `Generated speech audio (${result.durationSeconds}s, ${result.sampleRate / 1000}kHz) with ${result.profileName}`,
        durationMs: 0,
      };
    },
  });

  // Register all 7 HyperFrames skills
  registerHyperframesSkills(registry);

  return registry;
}
