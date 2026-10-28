import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { GraphifyEdge, GraphifyNode, GraphifyStatus } from '../../src/memory/types';

const execFileAsync = promisify(execFile);

export class GraphifyService {
  private repoRoot: string;
  private graphJsonPath: string;
  private analysisJsonPath: string;

  constructor(repoRoot?: string) {
    this.repoRoot = path.resolve(repoRoot || process.cwd());
    this.graphJsonPath = path.join(this.repoRoot, 'graphify-out', 'graph.json');
    this.analysisJsonPath = path.join(this.repoRoot, 'graphify-out', '.graphify_analysis.json');
  }

  /**
   * Checks status and freshness of Graphify repository index.
   */
  public async getStatus(): Promise<GraphifyStatus> {
    try {
      const isGraphPresent = fs.existsSync(this.graphJsonPath);
      let indexedAt: number | undefined;
      let nodeCount: number | undefined;
      let edgeCount: number | undefined;

      if (isGraphPresent) {
        const stats = fs.statSync(this.graphJsonPath);
        indexedAt = stats.mtimeMs;

        try {
          const raw = fs.readFileSync(this.graphJsonPath, 'utf8');
          const data = JSON.parse(raw);
          nodeCount = Array.isArray(data.nodes) ? data.nodes.length : undefined;
          const links = Array.isArray(data.links) ? data.links : Array.isArray(data.edges) ? data.edges : undefined;
          edgeCount = links ? links.length : undefined;
        } catch {
          // ignore parse issue
        }
      }

      // Check CLI version
      let version: string | undefined;
      try {
        const { stdout } = await execFileAsync('graphify', ['--version']);
        version = stdout.trim();
      } catch {
        version = 'graphify-local';
      }

      // Check if git working directory has been modified since index
      let isStale = false;
      if (indexedAt) {
        try {
          const { stdout } = await execFileAsync('git', ['status', '--porcelain', 'src/'], {
            cwd: this.repoRoot,
          });
          if (stdout.trim().length > 0) {
            isStale = true;
          }
        } catch {
          // ignore git check
        }
      }

      return {
        available: isGraphPresent || true,
        version,
        indexedAt,
        nodeCount,
        edgeCount,
        isStale,
      };
    } catch (err) {
      return {
        available: false,
        isStale: true,
        lastError: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Reindexes the codebase using graphify AST extraction.
   */
  public async reindex(): Promise<{ ok: boolean; nodeCount: number; edgeCount: number; message: string }> {
    try {
      const { stdout } = await execFileAsync('graphify', ['extract', '.', '--code-only'], {
        cwd: this.repoRoot,
      });

      const raw = fs.readFileSync(this.graphJsonPath, 'utf8');
      const data = JSON.parse(raw);
      const nodeCount = Array.isArray(data.nodes) ? data.nodes.length : 0;
      const edgeCount = Array.isArray(data.edges) ? data.edges.length : 0;

      return {
        ok: true,
        nodeCount,
        edgeCount,
        message: stdout.trim() || `Reindexed ${nodeCount} nodes and ${edgeCount} edges.`,
      };
    } catch (err) {
      throw new Error(`Graphify indexing failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Queries modules, symbols, dependencies, and relationships from graph.json.
   */
  public query(
    symbolOrQuery: string | { query?: string; symbol?: string; kind?: string; filePath?: string; limit?: number },
    defaultLimit = 20
  ): {
    nodes: GraphifyNode[];
    edges: GraphifyEdge[];
    summary: string;
  } {
    if (!fs.existsSync(this.graphJsonPath)) {
      return {
        nodes: [],
        edges: [],
        summary: 'Graphify index not found. Run reindex to generate graph.json.',
      };
    }

    try {
      const raw = fs.readFileSync(this.graphJsonPath, 'utf8');
      const data = JSON.parse(raw);
      const allNodes: any[] = Array.isArray(data.nodes) ? data.nodes : [];
      const allEdges: any[] = Array.isArray(data.links) ? data.links : Array.isArray(data.edges) ? data.edges : [];

      let q = '';
      let kindFilter: string | undefined;
      let fileFilter: string | undefined;
      let limit = defaultLimit;

      if (typeof symbolOrQuery === 'string') {
        q = symbolOrQuery.toLowerCase().trim();
      } else if (symbolOrQuery && typeof symbolOrQuery === 'object') {
        q = String(symbolOrQuery.query || symbolOrQuery.symbol || '').toLowerCase().trim();
        kindFilter = symbolOrQuery.kind;
        fileFilter = symbolOrQuery.filePath ? symbolOrQuery.filePath.toLowerCase().trim() : undefined;
        if (typeof symbolOrQuery.limit === 'number') limit = symbolOrQuery.limit;
      }

      const matchedNodes: GraphifyNode[] = allNodes
        .filter((n: any) => {
          const name = String(n.label || n.name || n.norm_label || n.id || '').toLowerCase();
          const file = String(n.source_file || n.file || n.filePath || '').toLowerCase();
          if (fileFilter && !file.includes(fileFilter)) return false;
          if (kindFilter && n.kind && n.kind !== kindFilter) return false;
          if (!q) return true;
          return name.includes(q) || file.includes(q);
        })
        .slice(0, limit)
        .map((n: any) => ({
          id: String(n.id),
          name: String(n.label || n.name || n.norm_label || n.id),
          kind: (n.kind || (n._callable ? 'function' : 'module')) as any,
          filePath: String(n.source_file || n.file || n.filePath || ''),
          lineStart: typeof n.source_location === 'string' && n.source_location.startsWith('L') ? parseInt(n.source_location.slice(1), 10) : undefined,
          docstring: n.docstring,
        }));

      const matchedNodeIds = new Set(matchedNodes.map((n) => n.id));

      const matchedEdges: GraphifyEdge[] = allEdges
        .filter((e: any) => matchedNodeIds.has(String(e.source)) || matchedNodeIds.has(String(e.target)))
        .slice(0, limit * 2)
        .map((e: any) => ({
          source: String(e.source),
          target: String(e.target),
          relationship: (e.relation || e.type || e.relationship || 'references') as any,
          confidence: typeof e.confidence_score === 'number' ? e.confidence_score : 1.0,
          isConfirmed: e.confidence === 'EXTRACTED',
        }));

      return {
        nodes: matchedNodes,
        edges: matchedEdges,
        summary: `Found ${matchedNodes.length} symbols and ${matchedEdges.length} connections matching "${typeof symbolOrQuery === 'string' ? symbolOrQuery : q}".`,
      };
    } catch (err) {
      return {
        nodes: [],
        edges: [],
        summary: `Failed to query Graphify: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
