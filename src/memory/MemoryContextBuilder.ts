/**
 * MotionLab 2.0 — Memory Context Builder
 * Assembles token-budgeted prompt context packets for AI models and MCP agents
 * containing project context, approved design rules, lessons learned, and Graphify symbols.
 */

import type { MemoryRecord, SessionSummaryRecord, TokenBudgetPlan, GraphifyNode } from './types';

export interface ContextBuilderOptions {
  maxTokens?: number;
  includeCodeArchitecture?: boolean;
  includeSessionContinuity?: boolean;
  projectMetadata?: {
    projectName?: string;
    aspectRatio?: string;
    resolution?: string;
    fps?: number;
    duration?: number;
    clipCount?: number;
    trackCount?: number;
  };
}

export interface BuiltPromptContext {
  promptText: string;
  tokenBudgetPlan: TokenBudgetPlan;
  includedMemories: MemoryRecord[];
}

export class MemoryContextBuilder {
  /**
   * Approximate token count calculation (1 token ~= 4 characters in English markdown).
   */
  public static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Build a structured context block injected into agent or LLM system prompts.
   */
  public buildContext(
    memories: MemoryRecord[],
    options: ContextBuilderOptions = {},
    sessionSummary?: SessionSummaryRecord | null,
    codeNodes?: GraphifyNode[]
  ): BuiltPromptContext {
    const maxTokens = options.maxTokens ?? 3000;
    const includedMemories: MemoryRecord[] = [];
    const includedMemoryIds: string[] = [];
    const sections: string[] = [];
    let currentTokenEstimate = 0;

    // Header
    const header = '# MOTIONLAB AI MEMORY & CREATIVE CONTEXT\n';
    sections.push(header);
    currentTokenEstimate += MemoryContextBuilder.estimateTokens(header);

    // 1. Active Project Context
    if (options.projectMetadata) {
      const pm = options.projectMetadata;
      const projSection = [
        '## 1. ACTIVE SEQUENCE & TIMELINE',
        `- Project Name: ${pm.projectName || 'Untitled'}`,
        `- Format: ${pm.resolution || '1080p'} (${pm.aspectRatio || '16:9'}) @ ${pm.fps || 30} fps`,
        pm.duration !== undefined ? `- Sequence Duration: ${pm.duration.toFixed(2)}s` : '',
        pm.clipCount !== undefined ? `- Clips: ${pm.clipCount} across ${pm.trackCount || 0} tracks` : '',
        '',
      ]
        .filter(Boolean)
        .join('\n');

      sections.push(projSection);
      currentTokenEstimate += MemoryContextBuilder.estimateTokens(projSection);
    }

    // 2. Session Continuity & User Approved Directions
    if (options.includeSessionContinuity !== false && sessionSummary) {
      const continuityLines: string[] = ['## 2. RECENT DECISIONS & CONTINUITY'];
      if (sessionSummary.userApprovedVisualDirections?.length) {
        continuityLines.push('### Approved Visual Directions');
        sessionSummary.userApprovedVisualDirections.forEach((d) =>
          continuityLines.push(`- ${d}`)
        );
      }
      if (sessionSummary.importantDecisions?.length) {
        continuityLines.push('### Critical Decisions');
        sessionSummary.importantDecisions.forEach((d) =>
          continuityLines.push(`- ${d}`)
        );
      }
      if (sessionSummary.technicalConstraints?.length) {
        continuityLines.push('### Active Constraints');
        sessionSummary.technicalConstraints.forEach((c) =>
          continuityLines.push(`- ${c}`)
        );
      }
      continuityLines.push('');
      const continuityText = continuityLines.join('\n');
      const tokens = MemoryContextBuilder.estimateTokens(continuityText);
      if (currentTokenEstimate + tokens < maxTokens * 0.9) {
        sections.push(continuityText);
        currentTokenEstimate += tokens;
      }
    }

    // 3. Approved Brand, Typography, and Motion Principles (Higher Priority)
    const approvedMemories = memories.filter(
      (m) => m.approvalStatus === 'approved' && m.validationStatus !== 'rejected'
    );

    // Group memories by category for clean readability
    const brandMemories = approvedMemories.filter((m) =>
      ['brand-guideline', 'typography', 'design-principle'].includes(m.category)
    );
    const motionMemories = approvedMemories.filter((m) =>
      ['motion-principle', 'animation-pattern'].includes(m.category)
    );
    const lessonsMemories = approvedMemories.filter((m) =>
      ['lesson-learned', 'quality-review'].includes(m.category)
    );
    const otherMemories = approvedMemories.filter(
      (m) =>
        ![
          'brand-guideline',
          'typography',
          'design-principle',
          'motion-principle',
          'animation-pattern',
          'lesson-learned',
          'quality-review',
        ].includes(m.category)
    );

    // Helper to append a memory list under a header
    const appendGroup = (title: string, group: MemoryRecord[]) => {
      if (!group.length) return;
      const groupLines: string[] = [title];
      for (const item of group) {
        const itemText = `### ${item.title} [id: ${item.id}, confidence: ${item.confidence.toFixed(2)}]\n${item.content}\n`;
        const itemTokens = MemoryContextBuilder.estimateTokens(itemText);
        if (currentTokenEstimate + itemTokens > maxTokens) {
          // Truncate if nearing budget
          continue;
        }
        groupLines.push(itemText);
        currentTokenEstimate += itemTokens;
        includedMemories.push(item);
        includedMemoryIds.push(item.id);
      }
      if (groupLines.length > 1) {
        groupLines.push('');
        sections.push(groupLines.join('\n'));
      }
    };

    appendGroup('## 3. BRAND & DESIGN STANDARDS (STRICT)', brandMemories);
    appendGroup('## 4. MOTION & KINETIC ANIMATION RULES', motionMemories);
    appendGroup('## 5. LESSONS LEARNED & MISTAKES TO AVOID', lessonsMemories);
    appendGroup('## 6. PROJECT CONTEXT & DECISIONS', otherMemories);

    // 4. Code Architecture & Graphify Symbols (if requested and budget permits)
    if (options.includeCodeArchitecture && codeNodes?.length) {
      const archLines: string[] = ['## 7. CODE ARCHITECTURE & MCP SYMBOLS'];
      for (const node of codeNodes) {
        const line = `- **${node.name}** (${node.kind}): \`${node.filePath}\`${node.docstring ? ` — ${node.docstring.slice(0, 100)}` : ''}`;
        const lineTokens = MemoryContextBuilder.estimateTokens(line);
        if (currentTokenEstimate + lineTokens > maxTokens) {
          break;
        }
        archLines.push(line);
        currentTokenEstimate += lineTokens;
      }
      if (archLines.length > 1) {
        archLines.push('');
        sections.push(archLines.join('\n'));
      }
    }

    const promptText = sections.join('\n');
    const usedTokens = MemoryContextBuilder.estimateTokens(promptText);

    return {
      promptText,
      tokenBudgetPlan: {
        maxTokens,
        usedTokens,
        truncated: includedMemories.length < memories.length,
        includedMemoryIds,
      },
      includedMemories,
    };
  }
}
