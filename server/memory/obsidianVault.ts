import fs from 'node:fs';
import path from 'node:path';
import { MemoryValidator } from '../../src/memory/MemoryValidator';
import { MemoryRetriever } from '../../src/memory/MemoryRetriever';
import type {
  ApprovalStatus,
  MemoryCategory,
  MemoryFilter,
  MemoryRecord,
  MemorySearchResult,
  ObsidianVaultStatus,
  SessionSummaryRecord,
  ValidationStatus,
} from '../../src/memory/types';

export const VAULT_SUBFOLDERS: Record<MemoryCategory, string> = {
  system: '00-System',
  project: '01-Projects',
  'creative-brief': '02-Creative-Briefs',
  'design-principle': '03-Design-Principles',
  'motion-principle': '04-Motion-Principles',
  typography: '05-Typography',
  'brand-guideline': '06-Brand-Guidelines',
  'animation-pattern': '07-Animation-Patterns',
  'creative-decision': '08-Creative-Decisions',
  'approved-reference': '09-Approved-References',
  'quality-review': '10-Quality-Reviews',
  'lesson-learned': '11-Lessons-Learned',
  'ai-skill': '12-AI-Skills',
  'technical-architecture': '13-Technical-Architecture',
  'user-preference': '14-User-Preferences',
  'session-summary': '15-Session-Summaries',
  experiment: '16-Experiments',
  archive: '99-Archive',
};

/**
 * Resolves the active Obsidian vault directory without hardcoded absolute paths.
 * Checks MOTIONLAB_OBSIDIAN_VAULT env var or defaults to a folder in the project root.
 */
export function resolveVaultPath(customPath?: string): string {
  if (customPath && customPath.trim()) {
    return path.resolve(customPath.trim());
  }
  if (process.env.MOTIONLAB_OBSIDIAN_VAULT) {
    return path.resolve(process.env.MOTIONLAB_OBSIDIAN_VAULT);
  }
  return path.resolve(process.cwd(), 'MotionLab-Knowledge');
}

/**
 * Validates that candidatePath is strictly contained inside rootPath (no directory traversal).
 */
export function assertPathContained(rootPath: string, candidatePath: string): void {
  const normalizedRoot = path.normalize(path.resolve(rootPath));
  const normalizedCandidate = path.normalize(path.resolve(candidatePath));
  if (
    normalizedCandidate !== normalizedRoot &&
    !normalizedCandidate.startsWith(normalizedRoot + path.sep)
  ) {
    throw new Error(`Security Violation: Path traversal detected outside vault root.`);
  }
}

/**
 * Sanitizes a string into a safe filename slug.
 */
export function sanitizeFilename(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 80);
  return cleaned || 'untitled-memory';
}

/**
 * Serializes a MemoryRecord into Obsidian-compatible Markdown with YAML frontmatter.
 */
export function serializeMemoryToMarkdown(record: MemoryRecord): string {
  const frontmatterObj: Record<string, unknown> = {
    id: record.id,
    title: record.title,
    category: record.category,
    type: record.type,
    projectId: record.projectId || 'global',
    tags: record.tags || [],
    sourceType: record.sourceType,
    sourcePathOrReference: record.sourcePathOrReference || '',
    createdAt: new Date(typeof record.createdAt === 'number' && !isNaN(record.createdAt) ? record.createdAt : Date.now()).toISOString(),
    updatedAt: new Date(typeof record.updatedAt === 'number' && !isNaN(record.updatedAt) ? record.updatedAt : Date.now()).toISOString(),
    validationStatus: record.validationStatus,
    confidence: Number((record.confidence ?? 1.0).toFixed(2)),
    approvalStatus: record.approvalStatus,
    relatedMemoryIds: record.relatedMemoryIds || [],
    version: record.version || 1,
  };

  if (record.relatedAssetIds && record.relatedAssetIds.length > 0) {
    frontmatterObj.relatedAssetIds = record.relatedAssetIds;
  }
  if (record.codeReferences && record.codeReferences.length > 0) {
    frontmatterObj.codeReferences = record.codeReferences;
  }

  const lines: string[] = ['---'];
  for (const [key, val] of Object.entries(frontmatterObj)) {
    if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of val) {
          if (typeof item === 'object') {
            lines.push(`  - ${JSON.stringify(item)}`);
          } else {
            lines.push(`  - "${String(item).replace(/"/g, '\\"')}"`);
          }
        }
      }
    } else if (typeof val === 'string') {
      lines.push(`${key}: "${val.replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(`# ${record.title}`);
  lines.push('');
  lines.push(record.content.trim());
  lines.push('');

  // Internal Obsidian links for related memories
  if (record.relatedMemoryIds && record.relatedMemoryIds.length > 0) {
    lines.push('## Related Memories');
    for (const relId of record.relatedMemoryIds) {
      lines.push(`- [[${relId}]]`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Parses Markdown with YAML frontmatter into a typed MemoryRecord.
 */
export function parseMarkdownToMemory(fileContent: string, fallbackId: string): MemoryRecord {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return {
      id: fallbackId,
      title: fallbackId,
      category: 'system',
      type: 'technical-finding',
      content: fileContent,
      tags: [],
      sourceType: 'system-audit',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      validationStatus: 'validated',
      confidence: 1.0,
      approvalStatus: 'approved',
      relatedMemoryIds: [],
      version: 1,
    };
  }

  const rawYaml = match[1];
  const body = match[2].trim();

  const meta: Record<string, any> = {};
  let currentKey = '';
  let inArray = false;

  for (const line of rawYaml.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ') && currentKey && inArray) {
      let itemVal: any = trimmed.slice(2).trim();
      if (itemVal.startsWith('"') && itemVal.endsWith('"')) {
        itemVal = itemVal.slice(1, -1);
      }
      try {
        if (itemVal.startsWith('{') && itemVal.endsWith('}')) {
          itemVal = JSON.parse(itemVal);
        }
      } catch {
        // use string fallback
      }
      meta[currentKey].push(itemVal);
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      currentKey = key;

      if (val === '' || val === '[]') {
        meta[key] = [];
        inArray = true;
      } else {
        inArray = false;
        let parsedVal: any = val;
        if (val.startsWith('"') && val.endsWith('"')) {
          parsedVal = val.slice(1, -1);
        } else if (val === 'true') parsedVal = true;
        else if (val === 'false') parsedVal = false;
        else if (!isNaN(Number(val)) && val !== '') parsedVal = Number(val);
        meta[key] = parsedVal;
      }
    }
  }

  const parseTs = (val: any, fallback: number): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = Date.parse(val);
      if (!isNaN(parsed)) return parsed;
    }
    return fallback;
  };

  const id = String(meta.id || fallbackId);
  const title = String(meta.title || id);
  const category = (meta.category as MemoryCategory) || 'system';
  const type = (meta.type as any) || 'technical-finding';
  const validationStatus = (meta.validationStatus as ValidationStatus) || 'validated';
  const approvalStatus = (meta.approvalStatus as ApprovalStatus) || 'approved';
  const confidence = typeof meta.confidence === 'number' ? meta.confidence : 1.0;
  const createdAt = parseTs(meta.createdAt, Date.now());
  const updatedAt = parseTs(meta.updatedAt, createdAt);

  return {
    id,
    title,
    category,
    type,
    content: body,
    projectId: meta.projectId ? String(meta.projectId) : undefined,
    relatedAssetIds: Array.isArray(meta.relatedAssetIds) ? meta.relatedAssetIds : [],
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    sourceType: (meta.sourceType as any) || 'system-audit',
    sourcePathOrReference: meta.sourcePathOrReference ? String(meta.sourcePathOrReference) : undefined,
    createdAt,
    updatedAt,
    validationStatus,
    confidence,
    approvalStatus,
    relatedMemoryIds: Array.isArray(meta.relatedMemoryIds) ? meta.relatedMemoryIds : [],
    codeReferences: Array.isArray(meta.codeReferences) ? meta.codeReferences : [],
    version: typeof meta.version === 'number' ? meta.version : 1,
  };
}

/**
 * ObsidianVaultManager provides robust, atomic filesystem read/write operations
 * for the MotionLab-Knowledge Obsidian vault.
 */
export class ObsidianVaultManager {
  private vaultPath: string;

  constructor(vaultPath?: string) {
    this.vaultPath = resolveVaultPath(vaultPath);
  }

  public getVaultPath(): string {
    return this.vaultPath;
  }

  public setVaultPath(newPath: string): void {
    this.vaultPath = resolveVaultPath(newPath);
    this.ensureVaultStructure();
  }

  /**
   * Initializes all standard category folders in the vault.
   */
  public ensureVaultStructure(): void {
    fs.mkdirSync(this.vaultPath, { recursive: true });
    for (const folderName of Object.values(VAULT_SUBFOLDERS)) {
      const fullDir = path.join(this.vaultPath, folderName);
      fs.mkdirSync(fullDir, { recursive: true });
    }
  }

  public getStatus(): ObsidianVaultStatus {
    try {
      this.ensureVaultStructure();
      const subdirs = fs
        .readdirSync(this.vaultPath, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'));

      let totalNotes = 0;
      for (const d of subdirs) {
        const full = path.join(this.vaultPath, d.name);
        try {
          const files = fs
            .readdirSync(full)
            .filter((f) => f.endsWith('.md') && !f.startsWith('.tmp'));
          totalNotes += files.length;
        } catch {
          // ignore folder read issues
        }
      }

      return {
        connected: true,
        mode: 'filesystem',
        vaultPath: this.vaultPath,
        subfolderCount: subdirs.length,
        totalNotes,
        lastSyncAt: Date.now(),
      };
    } catch (err) {
      return {
        connected: false,
        mode: 'filesystem',
        vaultPath: this.vaultPath,
        subfolderCount: 0,
        totalNotes: 0,
        lastSyncAt: Date.now(),
        lastError: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Saves a MemoryRecord atomically into the appropriate Obsidian vault folder.
   */
  public saveMemoryRecord(record: MemoryRecord): string {
    this.ensureVaultStructure();
    const folder = VAULT_SUBFOLDERS[record.category] || VAULT_SUBFOLDERS.system;
    const dir = path.join(this.vaultPath, folder);
    fs.mkdirSync(dir, { recursive: true });

    const slug = sanitizeFilename(record.title || record.id);
    const filename = `${record.id}__${slug}.md`;
    const targetPath = path.join(dir, filename);

    assertPathContained(this.vaultPath, targetPath);

    const markdown = serializeMemoryToMarkdown(record);

    // Atomic write pattern: write to .tmp file and rename
    const tmpPath = path.join(dir, `.tmp-${record.id}-${Date.now()}.tmp`);
    fs.writeFileSync(tmpPath, markdown, 'utf8');
    fs.renameSync(tmpPath, targetPath);

    return targetPath;
  }

  /**
   * Reads all MemoryRecords across all subfolders in the vault.
   */
  public loadAllMemoryRecords(): MemoryRecord[] {
    this.ensureVaultStructure();
    const records: MemoryRecord[] = [];

    for (const folder of Object.values(VAULT_SUBFOLDERS)) {
      const dir = path.join(this.vaultPath, folder);
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
          const raw = fs.readFileSync(fullPath, 'utf8');
          const fallbackId = file.replace(/\.md$/, '').split('__')[0];
          const rec = parseMarkdownToMemory(raw, fallbackId);
          rec.sourcePathOrReference = path.relative(this.vaultPath, fullPath).replace(/\\/g, '/');
          records.push(rec);
        } catch {
          // Skip corrupt file safely without crashing
        }
      }
    }

    return records.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Finds a specific memory record by ID.
   */
  public getMemoryById(id: string): MemoryRecord | null {
    const all = this.loadAllMemoryRecords();
    return all.find((m) => m.id === id) || null;
  }

  /**
   * Archives a memory by moving its markdown file to 99-Archive/.
   */
  public archiveMemoryRecord(id: string): boolean {
    this.ensureVaultStructure();
    for (const folder of Object.values(VAULT_SUBFOLDERS)) {
      if (folder === VAULT_SUBFOLDERS.archive) continue;
      const dir = path.join(this.vaultPath, folder);
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir).filter((f) => f.startsWith(`${id}__`) || f.startsWith(`${id}.`));
      for (const file of files) {
        const srcPath = path.join(dir, file);
        const destDir = path.join(this.vaultPath, VAULT_SUBFOLDERS.archive);
        const destPath = path.join(destDir, file);
        fs.renameSync(srcPath, destPath);

        // Update frontmatter to archived status
        const content = fs.readFileSync(destPath, 'utf8');
        const parsed = parseMarkdownToMemory(content, id);
        parsed.approvalStatus = 'archived';
        parsed.category = 'archive';
        parsed.updatedAt = Date.now();
        fs.writeFileSync(destPath, serializeMemoryToMarkdown(parsed), 'utf8');
        return true;
      }
    }
    return false;
  }

  /**
   * Deletes a memory file permanently with containment check.
   */
  public deleteMemoryRecord(id: string): boolean {
    this.ensureVaultStructure();
    for (const folder of Object.values(VAULT_SUBFOLDERS)) {
      const dir = path.join(this.vaultPath, folder);
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir).filter((f) => f.startsWith(`${id}__`) || f.startsWith(`${id}.`));
      for (const file of files) {
        const fullPath = path.join(dir, file);
        assertPathContained(this.vaultPath, fullPath);
        fs.unlinkSync(fullPath);
        return true;
      }
    }
    return false;
  }

  /**
   * Asserts path containment for this vault instance.
   */
  public assertPathContained(targetPath: string): void {
    assertPathContained(this.vaultPath, targetPath);
  }

  /**
   * Saves or creates a MemoryRecord, automatically assigning ID, timestamps, and validating.
   */
  public saveMemory(
    record: Partial<MemoryRecord> & { title: string; category: MemoryCategory }
  ): MemoryRecord {
    const now = Date.now();
    const id =
      record.id && record.id.trim()
        ? record.id.trim()
        : MemoryValidator.generateMemoryId(record.category, record.title);

    const complete: MemoryRecord = {
      id,
      title: record.title || 'Untitled Memory',
      category: record.category || 'design-principle',
      type: record.type || 'design-principle',
      content: record.content || '',
      projectId: record.projectId,
      relatedAssetIds: record.relatedAssetIds || [],
      tags: record.tags || [],
      sourceType: record.sourceType || 'user-instruction',
      sourcePathOrReference: record.sourcePathOrReference,
      createdAt: typeof record.createdAt === 'number' && !isNaN(record.createdAt) ? record.createdAt : now,
      updatedAt: typeof record.updatedAt === 'number' && !isNaN(record.updatedAt) ? record.updatedAt : now,
      validationStatus: record.validationStatus || 'validated',
      confidence: typeof record.confidence === 'number' ? record.confidence : 1.0,
      approvalStatus: record.approvalStatus || 'approved',
      relatedMemoryIds: record.relatedMemoryIds || [],
      codeReferences: record.codeReferences || [],
      version: record.version || 1,
    };

    this.saveMemoryRecord(complete);
    return complete;
  }

  public getMemory(id: string): MemoryRecord | null {
    return this.getMemoryById(id);
  }

  public listMemories(filter?: MemoryFilter): MemoryRecord[] {
    const all = this.loadAllMemoryRecords();
    if (!filter) return all;
    return MemoryRetriever.search(all, filter).map((r) => r.memory);
  }

  public searchMemories(query: string, options?: MemoryFilter): MemorySearchResult[] {
    const all = this.loadAllMemoryRecords();
    return MemoryRetriever.search(all, query, options);
  }

  public approveMemory(id: string): MemoryRecord {
    const record = this.getMemoryById(id);
    if (!record) throw new Error(`Memory record ${id} not found.`);
    record.approvalStatus = 'approved';
    record.validationStatus = 'validated';
    record.updatedAt = Date.now();
    record.version = (record.version || 1) + 1;
    this.saveMemoryRecord(record);
    return record;
  }

  public updateMemory(id: string, updates: Partial<MemoryRecord>): MemoryRecord {
    const record = this.getMemoryById(id);
    if (!record) throw new Error(`Memory record ${id} not found.`);
    const updated: MemoryRecord = {
      ...record,
      ...updates,
      id: record.id,
      updatedAt: Date.now(),
      version: (record.version || 1) + 1,
    };
    this.saveMemoryRecord(updated);
    return updated;
  }

  public archiveMemory(id: string): boolean {
    return this.archiveMemoryRecord(id);
  }

  public deleteMemory(id: string): boolean {
    return this.deleteMemoryRecord(id);
  }

  /**
   * Saves a structured session summary to 15-Session-Summaries/.
   */
  public saveSessionSummary(summary: Partial<SessionSummaryRecord>): SessionSummaryRecord {
    const now =
      typeof summary.timestamp === 'number' && !isNaN(summary.timestamp)
        ? summary.timestamp
        : Date.now();
    const id = summary.id || `sess-${now}-${Math.random().toString(36).slice(2, 6)}`;

    const fullSummary: SessionSummaryRecord = {
      id,
      sessionId: summary.sessionId || id,
      timestamp: now,
      projectId: summary.projectId,
      completedWork: summary.completedWork || [],
      importantDecisions: summary.importantDecisions || [],
      outstandingProblems: summary.outstandingProblems || [],
      userApprovedVisualDirections: summary.userApprovedVisualDirections || [],
      technicalConstraints: summary.technicalConstraints || [],
      nextPlannedOperations: summary.nextPlannedOperations || [],
      rawMarkdownContent: summary.rawMarkdownContent,
    };

    const memRecord: MemoryRecord = {
      id: fullSummary.id,
      title: `Session Summary — ${new Date(now).toLocaleDateString()} ${new Date(now).toLocaleTimeString()}`,
      category: 'session-summary',
      type: 'technical-finding',
      content: [
        '### Completed Work',
        ...fullSummary.completedWork.map((w) => `- ${w}`),
        '',
        '### Important Decisions',
        ...fullSummary.importantDecisions.map((d) => `- ${d}`),
        '',
        '### Outstanding Problems',
        ...fullSummary.outstandingProblems.map((p) => `- ${p}`),
        '',
        '### Approved Visual Directions',
        ...fullSummary.userApprovedVisualDirections.map((v) => `- ${v}`),
        '',
        '### Technical Constraints',
        ...fullSummary.technicalConstraints.map((c) => `- ${c}`),
        '',
        '### Next Planned Operations',
        ...fullSummary.nextPlannedOperations.map((n) => `- ${n}`),
      ].join('\n'),
      projectId: fullSummary.projectId,
      tags: ['session-summary', 'checkpoint', fullSummary.projectId || 'global'],
      sourceType: 'ai-observation',
      createdAt: now,
      updatedAt: now,
      validationStatus: 'validated',
      confidence: 1.0,
      approvalStatus: 'approved',
      relatedMemoryIds: [],
      version: 1,
    };

    this.saveMemoryRecord(memRecord);
    return fullSummary;
  }

  public getLatestSessionSummary(projectId?: string): SessionSummaryRecord | null {
    this.ensureVaultStructure();
    const dir = path.join(this.vaultPath, VAULT_SUBFOLDERS['session-summary']);
    if (!fs.existsSync(dir)) return null;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('.tmp'));
    if (files.length === 0) return null;

    const summaries: SessionSummaryRecord[] = [];
    for (const f of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, f), 'utf8');
        const fallbackId = f.replace(/\.md$/, '').split('__')[0];
        const mem = parseMarkdownToMemory(raw, fallbackId);
        if (projectId && mem.projectId && mem.projectId !== 'global' && mem.projectId !== projectId) {
          continue;
        }

        const parseSection = (header: string): string[] => {
          const regex = new RegExp(`### ${header}[\\r\\n]+([\\s\\S]*?)(?=###|$)`, 'i');
          const match = mem.content.match(regex);
          if (!match) return [];
          return match[1]
            .split('\n')
            .map((l) => l.replace(/^[-*]\s*/, '').trim())
            .filter(Boolean);
        };

        summaries.push({
          id: mem.id,
          sessionId: mem.id,
          timestamp: mem.createdAt,
          projectId: mem.projectId,
          completedWork: parseSection('Completed Work'),
          importantDecisions: parseSection('Important Decisions'),
          outstandingProblems: parseSection('Outstanding Problems'),
          userApprovedVisualDirections: parseSection('Approved Visual Directions'),
          technicalConstraints: parseSection('Technical Constraints'),
          nextPlannedOperations: parseSection('Next Planned Operations'),
          rawMarkdownContent: mem.content,
        });
      } catch {
        // ignore
      }
    }

    if (summaries.length === 0) return null;
    summaries.sort((a, b) => b.timestamp - a.timestamp);
    return summaries[0];
  }
}
