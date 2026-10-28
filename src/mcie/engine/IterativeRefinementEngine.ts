/**
 * MotionLab Creative Intelligence Engine (MCIE) — Iterative Refinement Engine
 * Automatically synthesizes minimal, targeted corrective diffs to resolve
 * critique findings, safe-margin overflows, contrast violations, and keyframe anomalies.
 */

import type { ProjectData, TimelineClip } from '../../types/editor';
import type { CritiqueFinding, CritiqueReport } from '../types';
import { CompositionEngine } from './CompositionEngine';
import { MotionPresetEngine } from './MotionPresetEngine';
import { VisualCritic } from './VisualCritic';

export interface RefinementStepResult {
  iteration: number;
  initialScore: number;
  refinedScore: number;
  fixedFindingsCount: number;
  remainingFindingsCount: number;
  appliedModifications: string[];
  project: ProjectData;
  report: CritiqueReport;
}

export class IterativeRefinementEngine {
  /**
   * Automatically executes an iterative critique -> repair loop until passing or max iterations reached
   */
  public static autoRefine(
    project: ProjectData,
    targetBrandColors?: string[],
    maxIterations = 3
  ): RefinementStepResult {
    let currentProject = JSON.parse(JSON.stringify(project)) as ProjectData;
    let report = VisualCritic.critiqueProject(currentProject, targetBrandColors);
    let iteration = 0;
    const initialScore = report.rubric.overallScore;
    const appliedModifications: string[] = [];

    while (iteration < maxIterations && !report.isPassing) {
      iteration++;
      const fixable = report.findings.filter((f) => f.canAutoFix);
      if (fixable.length === 0) break;

      // Apply fixes for each fixable finding
      for (const finding of fixable) {
        const mod = this.applyFindingFix(currentProject, finding, targetBrandColors);
        if (mod) {
          appliedModifications.push(mod);
        }
      }

      // Re-critique
      report = VisualCritic.critiqueProject(currentProject, targetBrandColors);
    }

    return {
      iteration,
      initialScore,
      refinedScore: report.rubric.overallScore,
      fixedFindingsCount: appliedModifications.length,
      remainingFindingsCount: report.findings.length,
      appliedModifications,
      project: currentProject,
      report,
    };
  }

  private static applyFindingFix(
    project: ProjectData,
    finding: CritiqueFinding,
    brandColors?: string[]
  ): string | null {
    if (!finding.elementId) return null;
    const clipIndex = project.clips.findIndex((c) => c.id === finding.elementId);
    if (clipIndex === -1) return null;

    const clip = project.clips[clipIndex];
    const seq = CompositionEngine.getSequenceDimensions(project.resolution, project.aspectRatio);

    switch (finding.category) {
      case 'contrast': {
        if (clip.textStyle) {
          clip.textStyle.color = '#FFFFFF'; // Set to pure high-contrast white
          clip.textStyle.shadowColor = 'rgba(0, 0, 0, 0.7)';
          clip.textStyle.shadowBlur = 10;
          return `Fixed contrast on "${clip.name}" by setting text color to #FFFFFF with drop shadow`;
        }
        break;
      }

      case 'typography': {
        if (finding.issue.includes('safe area') && clip.textStyle) {
          // Reduce font size by 20%
          clip.textStyle.fontSize = Math.round(clip.textStyle.fontSize * 0.82);
          // Clamp position towards center
          clip.y = Math.sign(clip.y) * Math.min(Math.abs(clip.y), seq.height * 0.32);
          return `Adjusted typography size and safe margin bounds on "${clip.name}" (fontSize: ${clip.textStyle.fontSize}px)`;
        }
        break;
      }

      case 'composition': {
        if (finding.issue.includes('collision')) {
          // Shift this clip vertically down or up
          clip.y += 65;
          return `Resolved composition collision for "${clip.name}" by offsetting Y position to ${clip.y}px`;
        }
        if (finding.issue.includes('clips beyond viewport') || finding.issue.includes('offscreen')) {
          clip.x = Math.max(-seq.width * 0.35, Math.min(seq.width * 0.35, clip.x));
          clip.y = Math.max(-seq.height * 0.35, Math.min(seq.height * 0.35, clip.y));
          clip.scale = Math.min(clip.scale, 0.95);
          return `Re-centered offscreen element "${clip.name}" within viewport bounds`;
        }
        break;
      }

      case 'technical-safety': {
        if (finding.issue.includes('Keyframe time')) {
          // Clamp keyframes
          for (const kf of clip.keyframes) {
            kf.time = Math.max(0, Math.min(clip.duration, kf.time));
          }
          return `Clamped out-of-bounds keyframes for "${clip.name}" within [0, ${clip.duration}s]`;
        }
        break;
      }

      case 'motion': {
        if (finding.issue.includes('no entrance') && clip.type === 'text') {
          project.clips[clipIndex] = MotionPresetEngine.applyPresetToClip(
            clip,
            'refined-title-entrance',
            { clipDuration: clip.duration }
          );
          return `Applied "refined-title-entrance" motion preset to static text clip "${clip.name}"`;
        }
        break;
      }

      case 'brand-consistency': {
        if (clip.textStyle && brandColors && brandColors.length > 0) {
          clip.textStyle.color = brandColors[0];
          return `Aligned text color on "${clip.name}" with primary brand color ${brandColors[0]}`;
        }
        break;
      }
    }

    return null;
  }
}
