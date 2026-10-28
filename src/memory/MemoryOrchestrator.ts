/**
 * MotionLab 2.0 — Memory Orchestrator
 * Master coordinating service for Obsidian long-term storage, Graphify code intelligence,
 * Memory retrieval, proposal approvals, and prompt context generation.
 */

import { ObsidianAdapter } from './ObsidianAdapter';
import { GraphifyAdapter } from './GraphifyAdapter';
import { MemoryRetriever } from './MemoryRetriever';
import { MemoryValidator } from './MemoryValidator';
import { MemoryConsolidator } from './MemoryConsolidator';
import { MemoryContextBuilder, type ContextBuilderOptions, type BuiltPromptContext } from './MemoryContextBuilder';
import type {
  MemoryRecord,
  MemoryCategory,
  MemoryType,
  MemoryFilter,
  MemorySearchResult,
  MemoryHealthReport,
  SessionSummaryRecord,
} from './types';

export class MemoryOrchestrator {
  private static instance: MemoryOrchestrator | null = null;

  public readonly obsidian: ObsidianAdapter;
  public readonly graphify: GraphifyAdapter;
  public readonly contextBuilder: MemoryContextBuilder;

  private recordsCache: Map<string, MemoryRecord> = new Map();
  private listeners: Set<() => void> = new Set();
  private isInitialized = false;

  private constructor() {
    this.obsidian = new ObsidianAdapter();
    this.graphify = new GraphifyAdapter();
    this.contextBuilder = new MemoryContextBuilder();
  }

  public static getInstance(): MemoryOrchestrator {
    if (!MemoryOrchestrator.instance) {
      MemoryOrchestrator.instance = new MemoryOrchestrator();
    }
    return MemoryOrchestrator.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const records = await this.obsidian.listMemories();
      this.recordsCache.clear();
      records.forEach((r) => this.recordsCache.set(r.id, r));
      this.isInitialized = true;
      this.notifyListeners();
    } catch (err) {
      console.warn('[MemoryOrchestrator] Initialization error:', err);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('[MemoryOrchestrator] Listener notification error:', err);
      }
    }
  }

  public getAllCachedRecords(): MemoryRecord[] {
    return Array.from(this.recordsCache.values());
  }

  public getPendingProposals(): MemoryRecord[] {
    return this.getAllCachedRecords().filter((r) => r.approvalStatus === 'proposed');
  }

  public getApprovedRecords(): MemoryRecord[] {
    return this.getAllCachedRecords().filter((r) => r.approvalStatus === 'approved');
  }

  public async search(query: string, options?: MemoryFilter): Promise<MemorySearchResult[]> {
    // Check if we have records in cache for fast local hybrid retrieval
    if (this.recordsCache.size > 0) {
      const results = MemoryRetriever.search(
        Array.from(this.recordsCache.values()),
        query,
        options
      );
      if (results.length > 0) return results;
    }
    // Fall back to server vault search
    return this.obsidian.searchMemories(query, options);
  }

  public async getMemory(id: string): Promise<MemoryRecord | null> {
    const cached = this.recordsCache.get(id);
    if (cached) return cached;
    const remote = await this.obsidian.getMemory(id);
    if (remote) {
      this.recordsCache.set(remote.id, remote);
    }
    return remote;
  }

  /**
   * Propose a new memory record (requires user or director approval).
   */
  public async proposeMemory(params: {
    title: string;
    content: string;
    category: MemoryCategory;
    type: MemoryType;
    tags?: string[];
    sourceType?: MemoryRecord['sourceType'];
    projectId?: string;
    confidence?: number;
  }): Promise<MemoryRecord> {
    const record = await this.obsidian.proposeMemory({
      title: params.title,
      content: params.content,
      category: params.category,
      type: params.type,
      tags: params.tags || [],
      sourceType: params.sourceType || 'ai-observation',
      projectId: params.projectId,
      confidence: params.confidence ?? 0.85,
    });
    this.recordsCache.set(record.id, record);
    this.notifyListeners();
    return record;
  }

  /**
   * Approve a proposed memory record.
   */
  public async approveProposal(id: string): Promise<MemoryRecord> {
    const updated = await this.obsidian.approveMemory(id);
    this.recordsCache.set(updated.id, updated);
    this.notifyListeners();
    return updated;
  }

  /**
   * Reject a proposal by archiving or deleting it.
   */
  public async rejectProposal(id: string): Promise<boolean> {
    const ok = await this.obsidian.archiveMemory(id);
    if (ok) {
      const cached = this.recordsCache.get(id);
      if (cached) {
        cached.approvalStatus = 'archived';
        cached.validationStatus = 'rejected';
      }
      this.notifyListeners();
    }
    return ok;
  }

  /**
   * Directly save an approved memory record (e.g. from explicit user commands).
   */
  public async saveApprovedMemory(params: {
    title: string;
    content: string;
    category: MemoryCategory;
    type: MemoryType;
    tags?: string[];
    sourceType?: MemoryRecord['sourceType'];
    projectId?: string;
    confidence?: number;
  }): Promise<MemoryRecord> {
    const record = await this.obsidian.saveMemory({
      title: params.title,
      content: params.content,
      category: params.category,
      type: params.type,
      tags: params.tags || [],
      sourceType: params.sourceType || 'user-instruction',
      projectId: params.projectId,
      confidence: params.confidence ?? 0.95,
      approvalStatus: 'approved',
      validationStatus: 'validated',
    });
    this.recordsCache.set(record.id, record);
    this.notifyListeners();
    return record;
  }

  /**
   * Record a verified lesson learned or anti-pattern to prevent repeating mistakes.
   */
  public async recordLesson(
    title: string,
    content: string,
    mistakeToAvoid: string,
    tags: string[] = []
  ): Promise<MemoryRecord> {
    const combinedContent = `${content}\n\n**Mistake to Avoid:**\n${mistakeToAvoid}`;
    return this.saveApprovedMemory({
      title,
      content: combinedContent,
      category: 'lesson-learned',
      type: 'confirmed-lesson',
      tags: ['lesson', 'best-practice', ...tags],
      sourceType: 'user-correction',
      confidence: 1.0,
    });
  }

  /**
   * Build token-budgeted prompt context for AI Creative Director or agent prompts.
   */
  public async buildContextForPrompt(
    taskDescription: string,
    options: ContextBuilderOptions = {}
  ): Promise<BuiltPromptContext> {
    // 1. Retrieve relevant memories
    const searchResults = await this.search(taskDescription, {
      approvalStatus: 'approved',
      limit: 15,
    });
    const memories = searchResults.map((r) => r.memory);

    // If few memories matched the exact query, include all high-confidence brand/design rules
    if (memories.length < 5) {
      const allApproved = this.getApprovedRecords();
      for (const rec of allApproved) {
        if (!memories.some((m) => m.id === rec.id)) {
          memories.push(rec);
        }
      }
    }

    // 2. Fetch latest session summary
    const sessionSummary = await this.obsidian.getLatestSessionSummary(
      options.projectMetadata?.projectName
    );

    // 3. Fetch code architecture symbols from Graphify if requested
    let codeNodes;
    if (options.includeCodeArchitecture) {
      const graphRes = await this.graphify.query({
        query: taskDescription,
        limit: 10,
      });
      codeNodes = graphRes.nodes;
    }

    // 4. Assemble context block
    return this.contextBuilder.buildContext(
      memories,
      options,
      sessionSummary,
      codeNodes
    );
  }

  /**
   * Check system health of Obsidian and Graphify.
   */
  public async getSystemHealth(): Promise<MemoryHealthReport> {
    const obsHealth = await this.obsidian.checkHealth();
    const graphHealth = await this.graphify.getStatus();

    const pendingProposals = this.getPendingProposals().length;
    const totalRecords = this.recordsCache.size || obsHealth.totalNotes;

    const isHealthy = obsHealth.connected && graphHealth.available;
    const isDegraded = obsHealth.connected || graphHealth.available;

    return {
      status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'offline',
      obsidian: obsHealth,
      graphify: graphHealth,
      totalRecords,
      pendingProposals,
      recentActivityCount: this.recordsCache.size,
      timestamp: Date.now(),
    };
  }

  /**
   * Create a session checkpoint summary.
   */
  public async createSessionCheckpoint(
    summary: Partial<SessionSummaryRecord>
  ): Promise<SessionSummaryRecord> {
    return this.obsidian.saveSessionSummary(summary);
  }

  /**
   * Consolidate duplicate or overlapping records.
   */
  public consolidateRecords(): {
    clusters: Array<{ primary: MemoryRecord; duplicates: MemoryRecord[] }>;
  } {
    const records = Array.from(this.recordsCache.values());
    const clusters = MemoryConsolidator.findDuplicateClusters(records);
    return { clusters };
  }
}
