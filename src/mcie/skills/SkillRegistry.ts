/**
 * MotionLab Creative Intelligence Engine (MCIE) — Skill Registry
 * Discovers, loads, registers, and executes modular agent skills.
 * Supports markdown documentation, progressive disclosure, and deterministic workflow handlers.
 */

import type {
  SkillExecutionContext,
  SkillExecutionResult,
  SkillMetadata,
} from '../types';

export type SkillWorkflowHandler = (
  ctx: SkillExecutionContext
) => Promise<SkillExecutionResult> | SkillExecutionResult;

export interface RegisteredSkill {
  metadata: SkillMetadata;
  markdownDoc: string;
  workflows: Map<string, SkillWorkflowHandler>;
}

export class SkillRegistry {
  private static instance: SkillRegistry;
  private skills: Map<string, RegisteredSkill> = new Map();

  public static getInstance(): SkillRegistry {
    if (!this.instance) {
      this.instance = new SkillRegistry();
    }
    return this.instance;
  }

  public registerSkill(
    metadata: SkillMetadata,
    markdownDoc: string,
    workflowHandlers: Record<string, SkillWorkflowHandler>
  ): void {
    const workflows = new Map<string, SkillWorkflowHandler>();
    for (const [id, handler] of Object.entries(workflowHandlers)) {
      workflows.set(id, handler);
    }

    this.skills.set(metadata.id, {
      metadata,
      markdownDoc,
      workflows,
    });
  }

  public getSkill(id: string): RegisteredSkill | undefined {
    return this.skills.get(id);
  }

  public listSkills(): SkillMetadata[] {
    return Array.from(this.skills.values()).map((s) => s.metadata);
  }

  public getSkillDocumentation(id: string): string | undefined {
    return this.skills.get(id)?.markdownDoc;
  }

  public async executeWorkflow(
    skillId: string,
    workflowId: string,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill with ID "${skillId}" is not registered.`);
    }

    const handler = skill.workflows.get(workflowId);
    if (!handler) {
      throw new Error(`Workflow "${workflowId}" not found in skill "${skillId}".`);
    }

    const startTime = performance.now();
    try {
      const result = await handler(context);
      return {
        ...result,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        skillId,
        workflowId,
        output: null,
        appliedChangesSummary: `Failed execution: ${errMsg}`,
        critiqueNotes: [errMsg],
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }
}
