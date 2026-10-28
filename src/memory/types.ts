/**
 * MotionLab 2.0 — Persistent AI Memory System Types
 * Defines data structures for Graphify, Obsidian vault, Memory Orchestrator,
 * and Session Continuity models.
 */

export type MemoryCategory =
  | 'system'
  | 'project'
  | 'creative-brief'
  | 'design-principle'
  | 'motion-principle'
  | 'typography'
  | 'brand-guideline'
  | 'animation-pattern'
  | 'creative-decision'
  | 'approved-reference'
  | 'quality-review'
  | 'lesson-learned'
  | 'ai-skill'
  | 'technical-architecture'
  | 'user-preference'
  | 'session-summary'
  | 'experiment'
  | 'archive';

export type MemoryType =
  | 'user-preference'
  | 'creative-constraint'
  | 'design-principle'
  | 'motion-technique'
  | 'project-decision'
  | 'approved-reference'
  | 'successful-experiment'
  | 'failed-experiment'
  | 'technical-finding'
  | 'ai-suggestion'
  | 'confirmed-lesson'
  | 'skill-knowledge';

export type SourceType =
  | 'user-instruction'
  | 'user-correction'
  | 'user-approval'
  | 'ai-observation'
  | 'system-audit'
  | 'code-analysis';

export type ValidationStatus =
  | 'validated'
  | 'pending'
  | 'rejected'
  | 'superseded';

export type ApprovalStatus =
  | 'approved'
  | 'proposed'
  | 'archived';

export interface CodeReference {
  filePath: string;
  lineRange?: [number, number];
  symbol?: string;
  confidence?: number;
}

export interface MemoryRecord {
  id: string;
  title: string;
  category: MemoryCategory;
  type: MemoryType;
  content: string;
  projectId?: string;
  relatedAssetIds?: string[];
  tags: string[];
  sourceType: SourceType;
  sourcePathOrReference?: string;
  createdAt: number;
  updatedAt: number;
  validationStatus: ValidationStatus;
  confidence: number; // 0.0 to 1.0
  approvalStatus: ApprovalStatus;
  relatedMemoryIds: string[];
  codeReferences?: CodeReference[];
  version: number;
}

export interface MemoryFilter {
  query?: string;
  category?: MemoryCategory | MemoryCategory[];
  type?: MemoryType | MemoryType[];
  projectId?: string;
  tags?: string[];
  approvalStatus?: ApprovalStatus;
  validationStatus?: ValidationStatus;
  minConfidence?: number;
  limit?: number;
}

export interface MemorySearchResult {
  memory: MemoryRecord;
  score: number;
  matchedFields: string[];
  snippet: string;
  graphConnections?: Array<{
    targetId: string;
    relationship: string;
  }>;
}

export interface SessionSummaryRecord {
  id: string;
  sessionId: string;
  timestamp: number;
  projectId?: string;
  completedWork: string[];
  importantDecisions: string[];
  outstandingProblems: string[];
  userApprovedVisualDirections: string[];
  technicalConstraints: string[];
  nextPlannedOperations: string[];
  rawMarkdownContent?: string;
}

export interface GraphifyNode {
  id: string;
  name: string;
  kind: 'module' | 'function' | 'class' | 'interface' | 'variable' | 'file';
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  docstring?: string;
}

export interface GraphifyEdge {
  source: string;
  target: string;
  relationship: 'imports' | 'calls' | 'extends' | 'implements' | 'references';
  confidence: number;
  isConfirmed: boolean;
}

export interface GraphifyStatus {
  available: boolean;
  version?: string;
  indexedAt?: number;
  nodeCount?: number;
  edgeCount?: number;
  isStale: boolean;
  lastError?: string;
}

export interface ObsidianVaultStatus {
  connected: boolean;
  mode: 'filesystem' | 'api';
  vaultPath: string;
  subfolderCount: number;
  totalNotes: number;
  lastSyncAt: number;
  lastError?: string;
}

export interface MemoryHealthReport {
  status: 'healthy' | 'degraded' | 'offline';
  obsidian: ObsidianVaultStatus;
  graphify: GraphifyStatus;
  totalRecords: number;
  pendingProposals: number;
  recentActivityCount: number;
  timestamp: number;
}

export interface TokenBudgetPlan {
  maxTokens: number;
  usedTokens: number;
  truncated: boolean;
  includedMemoryIds: string[];
}
