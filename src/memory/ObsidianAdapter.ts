/**
 * MotionLab 2.0 — Obsidian Vault Client Adapter
 * Communicates with the backend Obsidian vault API to manage notes, search,
 * record proposals, and persist creative decisions.
 */

import type {
  MemoryRecord,
  MemoryCategory,
  MemoryType,
  MemoryFilter,
  MemorySearchResult,
  SessionSummaryRecord,
  ObsidianVaultStatus,
} from './types';

export class ObsidianAdapter {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  public async checkHealth(): Promise<ObsidianVaultStatus> {
    try {
      const res = await fetch(`${this.baseUrl}/api/memory/health`);
      if (!res.ok) {
        throw new Error(`Health check returned status ${res.status}`);
      }
      const data = await res.json();
      return (
        data.obsidian || {
          connected: false,
          mode: 'api',
          vaultPath: '',
          subfolderCount: 0,
          totalNotes: 0,
          lastSyncAt: Date.now(),
          lastError: 'No obsidian status returned',
        }
      );
    } catch (err) {
      return {
        connected: false,
        mode: 'api',
        vaultPath: '',
        subfolderCount: 0,
        totalNotes: 0,
        lastSyncAt: Date.now(),
        lastError: err instanceof Error ? err.message : String(err),
      };
    }
  }

  public async listMemories(filter?: MemoryFilter): Promise<MemoryRecord[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.category) {
        const cat = Array.isArray(filter.category) ? filter.category.join(',') : filter.category;
        params.append('category', cat);
      }
      if (filter?.type) {
        const t = Array.isArray(filter.type) ? filter.type.join(',') : filter.type;
        params.append('type', t);
      }
      if (filter?.approvalStatus) params.append('approvalStatus', filter.approvalStatus);
      if (filter?.projectId) params.append('projectId', filter.projectId);
      if (filter?.limit) params.append('limit', String(filter.limit));

      const res = await fetch(`${this.baseUrl}/api/memory/list?${params.toString()}`);
      if (!res.ok) throw new Error(`List failed: status ${res.status}`);
      const data = await res.json();
      return data.records || [];
    } catch (err) {
      console.warn('[ObsidianAdapter] listMemories error:', err);
      return [];
    }
  }

  public async getMemory(id: string): Promise<MemoryRecord | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/memory/get?id=${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.record || null;
    } catch {
      return null;
    }
  }

  public async searchMemories(
    query: string,
    options?: MemoryFilter
  ): Promise<MemorySearchResult[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/memory/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, ...options }),
      });
      if (!res.ok) throw new Error(`Search failed: status ${res.status}`);
      const data = await res.json();
      return data.results || [];
    } catch (err) {
      console.warn('[ObsidianAdapter] searchMemories error:', err);
      return [];
    }
  }

  public async saveMemory(
    record: Partial<MemoryRecord> & {
      title: string;
      content: string;
      category: MemoryCategory;
      type: MemoryType;
    }
  ): Promise<MemoryRecord> {
    const res = await fetch(`${this.baseUrl}/api/memory/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Save failed' }));
      throw new Error(err.error || 'Failed to save memory to Obsidian vault');
    }
    const data = await res.json();
    return data.record;
  }

  public async proposeMemory(
    record: Partial<MemoryRecord> & {
      title: string;
      content: string;
      category: MemoryCategory;
      type: MemoryType;
    }
  ): Promise<MemoryRecord> {
    const res = await fetch(`${this.baseUrl}/api/memory/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Propose failed' }));
      throw new Error(err.error || 'Failed to propose memory to Obsidian vault');
    }
    const data = await res.json();
    return data.record;
  }

  public async approveMemory(id: string): Promise<MemoryRecord> {
    const res = await fetch(`${this.baseUrl}/api/memory/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Approve failed' }));
      throw new Error(err.error || 'Failed to approve memory in Obsidian vault');
    }
    const data = await res.json();
    return data.record;
  }

  public async archiveMemory(id: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/api/memory/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.ok;
  }

  public async deleteMemory(id: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/api/memory/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.ok;
  }

  public async saveSessionSummary(
    summary: Partial<SessionSummaryRecord>
  ): Promise<SessionSummaryRecord> {
    const res = await fetch(`${this.baseUrl}/api/memory/session-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary),
    });
    if (!res.ok) {
      throw new Error('Failed to save session summary checkpoint');
    }
    const data = await res.json();
    return data.summary;
  }

  public async getLatestSessionSummary(projectId?: string): Promise<SessionSummaryRecord | null> {
    try {
      const url = projectId
        ? `${this.baseUrl}/api/memory/session-summary?projectId=${encodeURIComponent(projectId)}`
        : `${this.baseUrl}/api/memory/session-summary`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.summary || null;
    } catch {
      return null;
    }
  }
}
