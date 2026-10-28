/**
 * MotionLab Creative Intelligence Engine (MCIE) — Core Types
 * Defines data structures for the Creative Director, Agent Skills, Typography Layout,
 * Composition Grids, Motion Tokens, Storyboards, and Visual Critic findings.
 */

import type {
  AspectRatio,
  FrameRate,
  KeyframeEasing,
  ProceduralShapeType,
  ResolutionPreset,
  TimelineClip,
  TimelineTrack,
  TransitionType,
} from '../types/editor';

// ==========================================
// 1. Creative Brief & Treatment
// ==========================================

export type BrandTone =
  | 'luxury-minimal'
  | 'swiss-editorial'
  | 'high-tech-precision'
  | 'energetic-punchy'
  | 'cinematic-editorial'
  | 'corporate-clean'
  | 'playful-organic';

export type VisualStyleCategory =
  | 'swiss-typography'
  | 'geometric-monochrome'
  | 'bold-editorial'
  | 'kinetic-typography'
  | 'minimal-dark-mode'
  | 'product-showcase'
  | 'tech-grid';

export interface BrandColorRole {
  name: string;
  hex: string;
  role: 'background' | 'surface' | 'accent' | 'highlight' | 'text-primary' | 'text-muted';
}

export interface CreativeBrief {
  id: string;
  title: string;
  objective: string;
  targetAudience: string;
  brandTone: BrandTone;
  brandName: string;
  tagline?: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  resolution: ResolutionPreset;
  fps: FrameRate;
  colorPalette: BrandColorRole[];
  keyMessages: string[];
  requiredAssets?: Array<{
    id: string;
    name: string;
    type: 'logo' | 'image' | 'video' | 'audio' | 'vector';
    sourceUrl?: string;
  }>;
  hardConstraints?: string[];
  callToAction?: {
    headline: string;
    subline?: string;
    actionText?: string;
    urlOrHandle?: string;
  };
}

export interface CreativeTreatment {
  briefId: string;
  title: string;
  logline: string;
  brandTone: BrandTone;
  visualTheme: VisualStyleCategory;
  typographySystem: {
    primaryFont: string;
    secondaryFont: string;
    scaleRatio: number; // e.g. 1.25 (Major Third), 1.333 (Perfect Fourth)
    headlineStyle: { weight: number; tracking: number; leading: number; uppercase: boolean };
    bodyStyle: { weight: number; tracking: number; leading: number; uppercase: boolean };
  };
  colorRoles: BrandColorRole[];
  compositionGrid: {
    type: 'rule-of-thirds' | '12-column' | 'modular-4x4' | 'golden-ratio';
    safeMarginPercent: number; // e.g. 10%
    alignmentBias: 'left-editorial' | 'center-symmetric' | 'dynamic-asymmetric';
  };
  motionLanguage: {
    primaryEasing: KeyframeEasing;
    tempoBpm: number;
    staggerDelaySeconds: number;
    anticipationEnabled: boolean;
    overshootAmplitude: number; // 0.0 = none, 0.15 = snappy, 0.3 = bouncy
    defaultTransition: TransitionType;
    defaultTransitionDuration: number;
  };
  audioDirection: {
    genre: string;
    tempo: 'slow' | 'medium' | 'fast' | 'dynamic';
    duckingDb: number;
    syncCutToBeat: boolean;
  };
  sceneBreakdown: Array<{
    sceneIndex: number;
    title: string;
    startTime: number;
    duration: number;
    purpose: string;
    focalPoint: string;
    keyVisualElements: string[];
  }>;
}

// ==========================================
// 2. Storyboard & Scene Planning
// ==========================================

export interface LayoutBox {
  x: number; // Center X in sequence pixels
  y: number; // Center Y in sequence pixels
  width: number;
  height: number;
  anchor: 'center' | 'top-left' | 'top-center' | 'bottom-left' | 'bottom-center';
}

export interface MotionTokenPlan {
  presetName: string;
  enterDuration: number;
  enterEasing: KeyframeEasing;
  exitDuration: number;
  exitEasing: KeyframeEasing;
  staggerDelay?: number;
  overshoot?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale' | 'fade';
}

export interface StoryboardLayerSpec {
  id: string;
  name: string;
  type: 'text' | 'shape' | 'media' | 'audio';
  trackType: 'video' | 'overlay' | 'text' | 'audio';
  order: number;
  startTime: number;
  duration: number;
  layout: LayoutBox;
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  backgroundColor?: string;
  shapeType?: ProceduralShapeType;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  assetIdOrName?: string;
  motion: MotionTokenPlan;
  maskShape?: 'none' | 'rectangle' | 'circle' | 'linear-wipe';
  opacity?: number;
  scale?: number;
  rotation?: number;
  parentId?: string;
  audioVolume?: number;
}

export interface StoryboardScene {
  id: string;
  sceneIndex: number;
  name: string;
  startTime: number;
  duration: number;
  narrativeGoal: string;
  visualFocalPoint: string;
  layers: StoryboardLayerSpec[];
  transitionIn: { type: TransitionType; duration: number };
  transitionOut: { type: TransitionType; duration: number };
  soundCue?: { assetIdOrName: string; volume: number; fadeIn: number; fadeOut: number };
}

export interface ProductionPlan {
  brief: CreativeBrief;
  treatment: CreativeTreatment;
  scenes: StoryboardScene[];
  totalDuration: number;
  estimatedClipCount: number;
  estimatedTrackCount: number;
  validated: boolean;
}

// ==========================================
// 3. Design & Composition Analysis
// ==========================================

export interface BoundingBox2D {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface TypographyDiagnostic {
  clipId: string;
  text: string;
  fontSize: number;
  lineCount: number;
  computedWidth: number;
  computedHeight: number;
  fitsWithinSafeZone: boolean;
  contrastRatio: number;
  wcagAaCompliant: boolean;
  hierarchyLevel: 'display' | 'title' | 'subhead' | 'body' | 'caption';
  issues: string[];
}

export interface CompositionDiagnostic {
  sceneId?: string;
  timeSeconds: number;
  elementCount: number;
  collisions: Array<{
    clipA: { id: string; name: string };
    clipB: { id: string; name: string };
    overlapAreaPx: number;
    isIntentionalParentChild: boolean;
  }>;
  offscreenClips: Array<{ id: string; name: string; overflowEdges: string[] }>;
  visualBalanceScore: number; // 0.0 to 1.0
  focalPointBalance: { xPercent: number; yPercent: number };
  safeZoneViolations: Array<{ id: string; name: string; violation: string }>;
}

// ==========================================
// 4. Visual Critique & Quality Rubric
// ==========================================

export type CritiqueCategory =
  | 'typography'
  | 'composition'
  | 'motion'
  | 'contrast'
  | 'brand-consistency'
  | 'pacing'
  | 'technical-safety';

export type CritiqueSeverity = 'critical' | 'warning' | 'suggestion';

export interface CritiqueFinding {
  id: string;
  sceneId?: string;
  timestampSeconds: number;
  category: CritiqueCategory;
  severity: CritiqueSeverity;
  elementId?: string;
  elementName?: string;
  issue: string;
  evidence: string;
  recommendedCorrection: string;
  confidence: number;
  canAutoFix: boolean;
}

export interface QualityRubricScore {
  typographyScore: number; // 0 - 100
  compositionScore: number; // 0 - 100
  motionScore: number; // 0 - 100
  brandConsistencyScore: number; // 0 - 100
  technicalIntegrityScore: number; // 0 - 100
  overallScore: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'Needs-Work';
}

export interface CritiqueReport {
  id: string;
  generatedAt: number;
  projectId: string;
  projectName: string;
  durationSeconds: number;
  findings: CritiqueFinding[];
  rubric: QualityRubricScore;
  summary: string;
  isPassing: boolean;
}

// ==========================================
// 5. Agent Skills Package System
// ==========================================

export type SkillCategory =
  | 'creative-direction'
  | 'art-direction'
  | 'typography'
  | 'composition'
  | 'motion-design'
  | 'storyboarding'
  | 'cinematography'
  | 'audio'
  | 'quality-critique'
  | 'refinement';

export interface SkillMetadata {
  id: string;
  name: string;
  version: string;
  category: SkillCategory;
  description: string;
  author?: string;
  inputRequirements: string[];
  creativePrinciples: string[];
  applicableProjectTypes: string[];
  requiredMotionLabTools: string[];
  qualityRubricFocus: string[];
  executableWorkflows: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export interface SkillExecutionContext {
  brief?: CreativeBrief;
  treatment?: CreativeTreatment;
  storyboard?: StoryboardScene[];
  targetClip?: TimelineClip;
  allClips?: TimelineClip[];
  allTracks?: TimelineTrack[];
  currentTime?: number;
  resolution?: { width: number; height: number };
  parameters?: Record<string, unknown>;
}

export interface SkillExecutionResult<T = unknown> {
  success: boolean;
  skillId: string;
  workflowId: string;
  output: T;
  critiqueNotes?: string[];
  appliedChangesSummary: string;
  durationMs: number;
}
