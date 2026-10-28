/**
 * MotionLab Creative Intelligence Engine (MCIE) — Visual Critic
 * Performs deterministic, multi-dimensional quality critique of project layouts,
 * typography scales, color contrast, motion pacing, and composition balance.
 */

import type { ProjectData, TimelineClip } from '../../types/editor';
import type {
  CritiqueCategory,
  CritiqueFinding,
  CritiqueReport,
  CritiqueSeverity,
  QualityRubricScore,
} from '../types';
import { CompositionEngine } from './CompositionEngine';
import { TypographyEngine } from './TypographyEngine';

export class VisualCritic {
  public static critiqueProject(project: ProjectData, targetBrandColors?: string[]): CritiqueReport {
    const findings: CritiqueFinding[] = [];
    const seq = CompositionEngine.getSequenceDimensions(project.resolution, project.aspectRatio);

    // 1. Evaluate Typography
    let typoScore = 100;
    const textClips = project.clips.filter((c) => c.type === 'text');

    for (const clip of textClips) {
      if (!clip.textStyle) continue;

      // Check contrast if background color available
      const bgHex = clip.textStyle.backgroundColor || '#0B0F0B';
      const diag = TypographyEngine.diagnose(clip.textStyle.content, {
        fontSize: clip.textStyle.fontSize,
        fontFamily: clip.textStyle.fontFamily,
        textColorHex: clip.textStyle.color,
        backgroundColorHex: bgHex,
        targetWidth: seq.width * 0.8,
        viewportWidth: seq.width,
        viewportHeight: seq.height,
        position: { x: clip.x, y: clip.y },
      });

      if (!diag.wcagAaCompliant) {
        typoScore -= 12;
        findings.push({
          id: `critique-contrast-${clip.id}`,
          timestampSeconds: clip.startTime,
          category: 'contrast',
          severity: 'warning',
          elementId: clip.id,
          elementName: clip.name,
          issue: `Low text contrast ratio (${diag.contrastRatio.toFixed(2)}:1) fails WCAG AA standard`,
          evidence: `Text color ${clip.textStyle.color} on ${bgHex} yields ${diag.contrastRatio.toFixed(2)}:1 (minimum 4.5:1 required)`,
          recommendedCorrection: 'Increase luminance contrast by lightening text color or darkening background layer',
          confidence: 0.95,
          canAutoFix: true,
        });
      }

      if (!diag.fitsWithinSafeZone) {
        typoScore -= 15;
        findings.push({
          id: `critique-safe-zone-${clip.id}`,
          timestampSeconds: clip.startTime,
          category: 'typography',
          severity: 'critical',
          elementId: clip.id,
          elementName: clip.name,
          issue: `Text layer bounds exceed Action/Title safe area margins`,
          evidence: `Text "${clip.textStyle.content.substring(0, 24)}..." extends outside 80% Title Safe boundary`,
          recommendedCorrection: 'Reduce font size or apply line wrapping to constrain bounds within safe margins',
          confidence: 0.9,
          canAutoFix: true,
        });
      }
    }

    // 2. Evaluate Composition & Collisions
    let compScore = 100;
    // Sample timestamps every 1 second or at clip start times
    const sampleTimes = Array.from(new Set(project.clips.map((c) => c.startTime))).sort((a, b) => a - b);
    if (sampleTimes.length === 0) sampleTimes.push(0);

    for (const time of sampleTimes) {
      const activeClips = project.clips.filter((c) => time >= c.startTime && time < c.startTime + c.duration);
      if (activeClips.length <= 1) continue;

      const compDiag = CompositionEngine.analyzeComposition(activeClips, seq, time);

      // Check collisions
      for (const col of compDiag.collisions) {
        compScore -= 10;
        findings.push({
          id: `critique-col-${col.clipA.id}-${col.clipB.id}-${Math.floor(time)}`,
          timestampSeconds: time,
          category: 'composition',
          severity: 'warning',
          elementId: col.clipA.id,
          elementName: `${col.clipA.name} / ${col.clipB.name}`,
          issue: `Unintended visual collision between elements`,
          evidence: `Overlap area of ${Math.round(col.overlapAreaPx)}px detected between "${col.clipA.name}" and "${col.clipB.name}"`,
          recommendedCorrection: 'Adjust Y/X transform coordinates or scale down one of the elements',
          confidence: 0.85,
          canAutoFix: true,
        });
      }

      // Check offscreen overflow
      for (const off of compDiag.offscreenClips) {
        compScore -= 15;
        findings.push({
          id: `critique-offscreen-${off.id}-${Math.floor(time)}`,
          timestampSeconds: time,
          category: 'composition',
          severity: 'critical',
          elementId: off.id,
          elementName: off.name,
          issue: `Element clips beyond viewport boundaries`,
          evidence: `Element extends past: ${off.overflowEdges.join(', ')}`,
          recommendedCorrection: 'Reposition element inside canvas boundaries or scale down',
          confidence: 0.95,
          canAutoFix: true,
        });
      }
    }

    // 3. Evaluate Motion & Keyframe Integrity
    let motionScore = 100;
    let technicalScore = 100;

    for (const clip of project.clips) {
      if (clip.keyframes && clip.keyframes.length > 0) {
        // Verify keyframe chronological order and boundary
        for (let i = 0; i < clip.keyframes.length; i++) {
          const kf = clip.keyframes[i];
          if (kf.time < 0 || kf.time > clip.duration + 0.01) {
            technicalScore -= 15;
            findings.push({
              id: `critique-kf-bounds-${kf.id}`,
              timestampSeconds: clip.startTime + kf.time,
              category: 'technical-safety',
              severity: 'critical',
              elementId: clip.id,
              elementName: clip.name,
              issue: `Keyframe time (${kf.time.toFixed(2)}s) is outside clip duration (${clip.duration.toFixed(2)}s)`,
              evidence: `Property ${kf.property} at offset ${kf.time}`,
              recommendedCorrection: `Clamp keyframe time between 0 and ${clip.duration}`,
              confidence: 1.0,
              canAutoFix: true,
            });
          }
        }
      } else if (clip.type === 'text') {
        // Text without keyframes or animation might feel static
        motionScore -= 5;
        findings.push({
          id: `critique-static-text-${clip.id}`,
          timestampSeconds: clip.startTime,
          category: 'motion',
          severity: 'suggestion',
          elementId: clip.id,
          elementName: clip.name,
          issue: `Text layer has no entrance or exit motion keyframes`,
          evidence: `Static text clip "${clip.name}" from ${clip.startTime}s to ${(clip.startTime + clip.duration).toFixed(1)}s`,
          recommendedCorrection: 'Apply a Motion Preset like "refined-title-entrance" or "editorial-reveal"',
          confidence: 0.8,
          canAutoFix: true,
        });
      }
    }

    // 4. Brand Palette Consistency
    let brandScore = 100;
    if (targetBrandColors && targetBrandColors.length > 0) {
      const normalizedPalette = targetBrandColors.map((c) => c.toLowerCase());
      for (const clip of project.clips) {
        if (clip.textStyle && clip.textStyle.color) {
          const color = clip.textStyle.color.toLowerCase();
          const matches = normalizedPalette.some((p) => p === color || color.includes(p));
          if (!matches && color !== '#ffffff' && color !== '#000000') {
            brandScore -= 10;
            findings.push({
              id: `critique-brand-color-${clip.id}`,
              timestampSeconds: clip.startTime,
              category: 'brand-consistency',
              severity: 'warning',
              elementId: clip.id,
              elementName: clip.name,
              issue: `Text color ${color} is not in approved brand color palette`,
              evidence: `Approved palette: ${targetBrandColors.join(', ')}`,
              recommendedCorrection: `Change text color to primary brand accent or white`,
              confidence: 0.85,
              canAutoFix: true,
            });
          }
        }
      }
    }

    // Clamp scores
    typoScore = Math.max(0, Math.min(100, typoScore));
    compScore = Math.max(0, Math.min(100, compScore));
    motionScore = Math.max(0, Math.min(100, motionScore));
    brandScore = Math.max(0, Math.min(100, brandScore));
    technicalScore = Math.max(0, Math.min(100, technicalScore));

    const overallScore = Math.round(
      typoScore * 0.25 +
      compScore * 0.25 +
      motionScore * 0.2 +
      brandScore * 0.15 +
      technicalScore * 0.15
    );

    let grade: 'A+' | 'A' | 'B' | 'C' | 'Needs-Work' = 'Needs-Work';
    if (overallScore >= 95) grade = 'A+';
    else if (overallScore >= 88) grade = 'A';
    else if (overallScore >= 75) grade = 'B';
    else if (overallScore >= 60) grade = 'C';

    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const isPassing = criticalCount === 0 && overallScore >= 75;

    const rubric: QualityRubricScore = {
      typographyScore: typoScore,
      compositionScore: compScore,
      motionScore: motionScore,
      brandConsistencyScore: brandScore,
      technicalIntegrityScore: technicalScore,
      overallScore,
      grade,
    };

    let summary = `Quality Assessment: Grade ${grade} (${overallScore}/100). `;
    if (isPassing) {
      summary += `Project meets professional motion design and broadcast standards with 0 critical defects.`;
    } else {
      summary += `Found ${criticalCount} critical issue(s) and ${findings.length - criticalCount} warning/suggestion(s) requiring refinement.`;
    }

    return {
      id: `critique-${Date.now()}`,
      generatedAt: Date.now(),
      projectId: project.id,
      projectName: project.name,
      durationSeconds: Math.max(...project.clips.map((c) => c.startTime + c.duration), 0),
      findings,
      rubric,
      summary,
      isPassing,
    };
  }
}
