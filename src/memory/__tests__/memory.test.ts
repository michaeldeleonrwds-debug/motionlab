import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MemoryValidator } from '../MemoryValidator';
import { MemoryRetriever } from '../MemoryRetriever';
import { MemoryConsolidator } from '../MemoryConsolidator';
import { MemoryContextBuilder } from '../MemoryContextBuilder';
import { ObsidianVaultManager } from '../../../server/memory/obsidianVault';
import { GraphifyService } from '../../../server/memory/graphifyService';
import type { MemoryRecord, SessionSummaryRecord } from '../types';

describe('Phase 0: Persistent AI Memory System Test Suite', () => {
  describe('1. MemoryValidator', () => {
    it('generates predictable slugs and IDs with categories', () => {
      const id = MemoryValidator.generateMemoryId('brand-guideline', 'Angora Primary Color Palette');
      expect(id).toMatch(/^brand-guideline-[a-z0-9]+-angora-primary-color-palette$/);
    });

    it('sanitizes harmful HTML/script tags from note content', () => {
      const malicious = 'Visual rule: <script>alert("pwned")</script>Use #D7E83F lime accent.';
      const clean = MemoryValidator.sanitizeContent(malicious);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('Use #D7E83F lime accent.');
    });

    it('validates a complete valid record', () => {
      const record: MemoryRecord = {
        id: 'brand-1',
        title: 'Angora Typography Standard',
        category: 'typography',
        type: 'user-preference',
        content: 'Use Inter or Space Grotesk for high-impact kinetic titles.',
        tags: ['typography', 'fonts', 'brand'],
        sourceType: 'user-instruction',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        validationStatus: 'validated',
        confidence: 0.95,
        approvalStatus: 'approved',
        relatedMemoryIds: [],
        version: 1,
      };

      const result = MemoryValidator.validateRecord(record);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('catches missing title, content, or invalid category', () => {
      const invalid = {
        id: 'bad-1',
        title: '',
        category: 'unknown-category' as any,
        content: '',
      };
      const result = MemoryValidator.validateRecord(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('2. MemoryRetriever', () => {
    const mockMemories: MemoryRecord[] = [
      {
        id: 'mem-1',
        title: 'Angora Brand Color Palette',
        category: 'brand-guideline',
        type: 'design-principle',
        content: 'Primary dark background #0B0F0B, Secondary #172018, Lime accent #D7E83F.',
        tags: ['brand', 'colors', 'angora', 'lime'],
        sourceType: 'user-instruction',
        createdAt: 1000,
        updatedAt: 1000,
        validationStatus: 'validated',
        confidence: 1.0,
        approvalStatus: 'approved',
        relatedMemoryIds: ['mem-2'],
        version: 1,
      },
      {
        id: 'mem-2',
        title: 'Kinetic Typography Pacing',
        category: 'motion-principle',
        type: 'motion-technique',
        content: 'Title animations should lead scene transitions by 0.2s with snappy ease-out.',
        tags: ['motion', 'typography', 'pacing'],
        sourceType: 'ai-observation',
        createdAt: 1100,
        updatedAt: 1100,
        validationStatus: 'validated',
        confidence: 0.9,
        approvalStatus: 'approved',
        relatedMemoryIds: ['mem-1'],
        version: 1,
      },
      {
        id: 'mem-3',
        title: 'Avoid Unnecessary 3D Transforms',
        category: 'lesson-learned',
        type: 'confirmed-lesson',
        content: 'Never use generic 3D spins without a compositional anchor.',
        tags: ['lesson', 'mistake', 'transforms'],
        sourceType: 'user-correction',
        createdAt: 1200,
        updatedAt: 1200,
        validationStatus: 'validated',
        confidence: 0.95,
        approvalStatus: 'approved',
        relatedMemoryIds: [],
        version: 1,
      },
    ];

    it('retrieves relevant memories by keyword with high relevance score', () => {
      const results = MemoryRetriever.search(mockMemories, 'lime palette colors');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].memory.id).toBe('mem-1');
      expect(results[0].matchedFields).toContain('tags');
    });

    it('filters by category and approvalStatus accurately', () => {
      const results = MemoryRetriever.search(mockMemories, 'typography', {
        category: 'motion-principle',
        approvalStatus: 'approved',
      });
      expect(results).toHaveLength(1);
      expect(results[0].memory.id).toBe('mem-2');
    });

    it('generates clean snippets containing search terms', () => {
      const snippet = MemoryRetriever.extractSnippet(
        'MotionLab provides high-performance GPU canvas rendering for editorial motion graphics.',
        'GPU canvas'
      );
      expect(snippet.toLowerCase()).toContain('gpu canvas');
    });
  });

  describe('3. MemoryConsolidator', () => {
    it('detects duplicate memories based on text similarity', () => {
      const records: MemoryRecord[] = [
        {
          id: 'rec-1',
          title: 'Lime Accent Color Rule',
          category: 'brand-guideline',
          type: 'design-principle',
          content: 'Always use #D7E83F lime color for highlights and call-to-actions in Angora projects.',
          tags: ['lime', 'brand'],
          sourceType: 'user-instruction',
          createdAt: 1000,
          updatedAt: 1000,
          validationStatus: 'validated',
          confidence: 0.95,
          approvalStatus: 'approved',
          relatedMemoryIds: [],
          version: 1,
        },
        {
          id: 'rec-2',
          title: 'Angora Lime Highlight Color',
          category: 'brand-guideline',
          type: 'design-principle',
          content: 'Always use #D7E83F lime color for highlights and call-to-actions in Angora projects.',
          tags: ['lime', 'color'],
          sourceType: 'ai-observation',
          createdAt: 1050,
          updatedAt: 1050,
          validationStatus: 'validated',
          confidence: 0.85,
          approvalStatus: 'proposed',
          relatedMemoryIds: [],
          version: 1,
        },
      ];

      const clusters = MemoryConsolidator.findDuplicateClusters(records, 0.7);
      expect(clusters.length).toBe(1);
      expect(clusters[0].primary.id).toBe('rec-1');
      expect(clusters[0].duplicates[0].id).toBe('rec-2');
    });

    it('merges records combining tags and preserving highest confidence', () => {
      const primary: MemoryRecord = {
        id: 'rec-1',
        title: 'Base Rule',
        category: 'brand-guideline',
        type: 'design-principle',
        content: 'Primary rule text.',
        tags: ['rule-a'],
        sourceType: 'user-instruction',
        createdAt: 1000,
        updatedAt: 1000,
        validationStatus: 'validated',
        confidence: 0.9,
        approvalStatus: 'approved',
        relatedMemoryIds: [],
        version: 1,
      };
      const duplicate: MemoryRecord = {
        id: 'rec-2',
        title: 'Base Rule Copy',
        category: 'brand-guideline',
        type: 'design-principle',
        content: 'Primary rule text copy.',
        tags: ['rule-b', 'extra-tag'],
        sourceType: 'ai-observation',
        createdAt: 1100,
        updatedAt: 1100,
        validationStatus: 'validated',
        confidence: 0.98,
        approvalStatus: 'proposed',
        relatedMemoryIds: ['other-id'],
        version: 1,
      };

      const merged = MemoryConsolidator.mergeRecords(primary, [duplicate]);
      expect(merged.confidence).toBe(0.98);
      expect(merged.tags).toContain('rule-a');
      expect(merged.tags).toContain('rule-b');
      expect(merged.tags).toContain('extra-tag');
      expect(merged.relatedMemoryIds).toContain('other-id');
    });
  });

  describe('4. MemoryContextBuilder', () => {
    it('builds structured prompt context within token budget', () => {
      const memories: MemoryRecord[] = [
        {
          id: 'brand-1',
          title: 'Color Palette',
          category: 'brand-guideline',
          type: 'design-principle',
          content: 'Brand dark background #0B0F0B, Lime #D7E83F.',
          tags: ['brand'],
          sourceType: 'user-instruction',
          createdAt: 1000,
          updatedAt: 1000,
          validationStatus: 'validated',
          confidence: 1.0,
          approvalStatus: 'approved',
          relatedMemoryIds: [],
          version: 1,
        },
        {
          id: 'lesson-1',
          title: 'No Excessive Glows',
          category: 'lesson-learned',
          type: 'confirmed-lesson',
          content: 'Avoid cheap visual glows; keep vectors clean and sharp.',
          tags: ['lesson'],
          sourceType: 'user-correction',
          createdAt: 1000,
          updatedAt: 1000,
          validationStatus: 'validated',
          confidence: 0.95,
          approvalStatus: 'approved',
          relatedMemoryIds: [],
          version: 1,
        },
      ];

      const session: SessionSummaryRecord = {
        id: 'sess-1',
        sessionId: 'test-session',
        timestamp: Date.now(),
        completedWork: ['Exported Scene 1'],
        importantDecisions: ['Lock 1080x1920 9:16 vertical ratio'],
        outstandingProblems: [],
        userApprovedVisualDirections: ['Swiss editorial design'],
        technicalConstraints: ['Canvas2D clip limits'],
        nextPlannedOperations: ['Polish Scene 3'],
      };

      const builder = new MemoryContextBuilder();
      const built = builder.buildContext(
        memories,
        {
          maxTokens: 1000,
          projectMetadata: {
            projectName: 'Angora Promo V2',
            aspectRatio: '9:16',
            resolution: '1080p',
            fps: 30,
            duration: 15.0,
          },
        },
        session
      );

      expect(built.promptText).toContain('ACTIVE SEQUENCE & TIMELINE');
      expect(built.promptText).toContain('Angora Promo V2');
      expect(built.promptText).toContain('BRAND & DESIGN STANDARDS');
      expect(built.promptText).toContain('Color Palette');
      expect(built.promptText).toContain('LESSONS LEARNED');
      expect(built.promptText).toContain('No Excessive Glows');
      expect(built.tokenBudgetPlan.usedTokens).toBeLessThanOrEqual(1000);
    });
  });

  describe('5. ObsidianVaultManager (Filesystem & Path Containment)', () => {
    let tempVaultDir: string;
    let vault: ObsidianVaultManager;

    beforeEach(() => {
      tempVaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'motionlab-vault-test-'));
      vault = new ObsidianVaultManager(tempVaultDir);
    });

    afterEach(() => {
      try {
        fs.rmSync(tempVaultDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    });

    it('initializes all 17 vault subfolders safely', async () => {
      const status = await vault.getStatus();
      expect(status.connected).toBe(true);
      expect(status.subfolderCount).toBe(18); // 17 categories + archive
      expect(fs.existsSync(path.join(tempVaultDir, '00-System'))).toBe(true);
      expect(fs.existsSync(path.join(tempVaultDir, '06-Brand-Guidelines'))).toBe(true);
      expect(fs.existsSync(path.join(tempVaultDir, '11-Lessons-Learned'))).toBe(true);
    });

    it('blocks directory traversal attempts in paths', () => {
      expect(() => {
        vault.assertPathContained('../../windows/system32');
      }).toThrow(/Path traversal detected/);
    });

    it('saves a memory note atomically with YAML frontmatter and retrieves it', async () => {
      const saved = await vault.saveMemory({
        title: 'Editorial Motion Stagger Rule',
        category: 'motion-principle',
        type: 'motion-technique',
        content: 'Stagger subtitle lines by 0.12s to allow natural eye scanning.',
        tags: ['typography', 'stagger', 'motion'],
        confidence: 0.92,
        sourceType: 'ai-observation',
        approvalStatus: 'approved',
        validationStatus: 'validated',
      });

      expect(saved.id).toBeTruthy();
      expect(saved.title).toBe('Editorial Motion Stagger Rule');

      // Check on disk
      const fetched = await vault.getMemory(saved.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.title).toBe('Editorial Motion Stagger Rule');
      expect(fetched?.tags).toContain('stagger');
      expect(fetched?.content).toContain('Stagger subtitle lines by 0.12s');
    });

    it('updates, approves, and archives a memory note', async () => {
      const proposed = await vault.saveMemory({
        title: 'Proposed Audio Ducking Curve',
        category: 'experiment',
        type: 'ai-suggestion',
        content: 'Duck background music by -12dB during speech clips.',
        tags: ['audio', 'ducking'],
        approvalStatus: 'proposed',
        validationStatus: 'pending',
      });

      expect(proposed.approvalStatus).toBe('proposed');

      // Approve
      const approved = await vault.approveMemory(proposed.id);
      expect(approved.approvalStatus).toBe('approved');
      expect(approved.validationStatus).toBe('validated');

      // Archive
      const ok = await vault.archiveMemory(proposed.id);
      expect(ok).toBe(true);

      const archived = await vault.getMemory(proposed.id);
      expect(archived?.category).toBe('archive');
      expect(archived?.approvalStatus).toBe('archived');
    });

    it('saves and retrieves session summary checkpoints', async () => {
      const summary = await vault.saveSessionSummary({
        completedWork: ['Finished Angora Beyond Ordinary Film'],
        importantDecisions: ['Used Space Grotesk tracking-in'],
        outstandingProblems: [],
        userApprovedVisualDirections: ['Cinematic minimalist showreel'],
        technicalConstraints: ['Canvas2D procedural rendering'],
        nextPlannedOperations: ['Build Phase 1 Creative Director'],
      });

      expect(summary.id).toBeTruthy();

      const latest = await vault.getLatestSessionSummary();
      expect(latest).not.toBeNull();
      expect(latest?.completedWork).toContain('Finished Angora Beyond Ordinary Film');
      expect(latest?.userApprovedVisualDirections).toContain('Cinematic minimalist showreel');
    });
  });

  describe('6. GraphifyService (AST & Code Intelligence)', () => {
    it('reads the repository graph.json and provides status', async () => {
      const service = new GraphifyService();
      const status = await service.getStatus();

      expect(status.available).toBe(true);
      expect(status.nodeCount).toBeGreaterThan(0);
      expect(status.edgeCount).toBeGreaterThan(0);
      expect(status.indexedAt).toBeGreaterThan(0);
    });

    it('queries nodes by symbol and filters relationships', async () => {
      const service = new GraphifyService();
      const result = await service.query({
        query: 'timelineEngine',
        limit: 5,
      });

      expect(result.nodes.length).toBeGreaterThan(0);
      const hasTimeline = result.nodes.some(
        (n) => n.name.toLowerCase().includes('timeline') || n.filePath.includes('timeline')
      );
      expect(hasTimeline).toBe(true);
    });
  });
});
