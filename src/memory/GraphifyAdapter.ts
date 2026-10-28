/**
 * MotionLab 2.0 — Graphify Client Adapter
 * Provides code intelligence and architecture query integration with Graphify
 * for MCP agents and the AI Creative Director.
 */

import type { GraphifyNode, GraphifyEdge, GraphifyStatus } from './types';

export class GraphifyAdapter {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  public async getStatus(): Promise<GraphifyStatus> {
    try {
      const res = await fetch(`${this.baseUrl}/api/memory/graphify/status`);
      if (!res.ok) throw new Error(`Status HTTP ${res.status}`);
      const data = await res.json();
      return (
        data.status || {
          available: false,
          isStale: true,
          lastError: 'No response from Graphify service',
        }
      );
    } catch (err) {
      return {
        available: false,
        isStale: true,
        lastError: err instanceof Error ? err.message : String(err),
      };
    }
  }

  public async query(options: {
    query?: string;
    kind?: string;
    filePath?: string;
    symbol?: string;
    limit?: number;
  }): Promise<{ nodes: GraphifyNode[]; edges: GraphifyEdge[] }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/memory/graphify/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      if (!res.ok) throw new Error(`Query HTTP ${res.status}`);
      const data = await res.json();
      return {
        nodes: data.nodes || [],
        edges: data.edges || [],
      };
    } catch (err) {
      console.warn('[GraphifyAdapter] query error:', err);
      return { nodes: [], edges: [] };
    }
  }

  public async reindex(): Promise<{
    success: boolean;
    nodeCount?: number;
    edgeCount?: number;
    error?: string;
  }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/memory/graphify/reindex`, {
        method: 'POST',
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  public async getArchitectureContext(): Promise<GraphifyNode[]> {
    const res = await this.query({
      kind: 'module',
      limit: 20,
    });
    return res.nodes;
  }
}
