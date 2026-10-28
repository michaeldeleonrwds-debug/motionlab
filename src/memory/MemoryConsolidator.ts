import type { MemoryRecord } from './types';

export interface DuplicateCluster {
  primary: MemoryRecord;
  duplicates: MemoryRecord[];
  similarityScore: number;
}

export interface ConflictRecord {
  memoryA: MemoryRecord;
  memoryB: MemoryRecord;
  reason: string;
}

export type MergedRecordResult = MemoryRecord & {
  consolidated: MemoryRecord;
  supersededIds: string[];
};

export class MemoryConsolidator {
  /**
   * Tokenizes text into lowercase word tokens.
   */
  private static tokenize(text: string): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);
    return new Set(words);
  }

  /**
   * Calculates Jaccard similarity coefficient between two sets of word tokens.
   */
  public static calculateSimilarity(textA: string, textB: string): number {
    const tokensA = this.tokenize(textA);
    const tokensB = this.tokenize(textB);
    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }
    const union = tokensA.size + tokensB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Identifies duplicate or highly similar memories (similarity >= threshold).
   */
  public static findDuplicateClusters(records: MemoryRecord[], threshold = 0.65): DuplicateCluster[] {
    const clusters: DuplicateCluster[] = [];
    const visited = new Set<string>();

    for (let i = 0; i < records.length; i++) {
      const a = records[i];
      if (visited.has(a.id)) continue;

      const dupes: MemoryRecord[] = [];
      let highestSim = 0;

      for (let j = i + 1; j < records.length; j++) {
        const b = records[j];
        if (visited.has(b.id)) continue;
        if (a.category !== b.category) continue;

        const titleSim = this.calculateSimilarity(a.title, b.title);
        const contentSim = this.calculateSimilarity(a.content, b.content);
        const combined = titleSim * 0.4 + contentSim * 0.6;

        if (combined >= threshold) {
          dupes.push(b);
          visited.add(b.id);
          if (combined > highestSim) highestSim = combined;
        }
      }

      if (dupes.length > 0) {
        visited.add(a.id);
        clusters.push({
          primary: a,
          duplicates: dupes,
          similarityScore: Number(highestSim.toFixed(2)),
        });
      }
    }

    return clusters;
  }

  public static findDuplicates(records: MemoryRecord[], threshold = 0.65): DuplicateCluster[] {
    return this.findDuplicateClusters(records, threshold);
  }

  /**
   * Consolidates duplicate records into the primary record, merging tags, relatedMemoryIds,
   * and preserving highest confidence score.
   */
  public static mergeRecords(primary: MemoryRecord, duplicates: MemoryRecord[]): MergedRecordResult {
    const mergedTags = new Set(primary.tags);
    const mergedRelatedIds = new Set(primary.relatedMemoryIds);
    const supersededIds: string[] = [];
    let maxConfidence = primary.confidence;

    for (const d of duplicates) {
      supersededIds.push(d.id);
      mergedRelatedIds.add(d.id);
      for (const t of d.tags) mergedTags.add(t);
      for (const r of d.relatedMemoryIds || []) mergedRelatedIds.add(r);
      if (d.confidence > maxConfidence) {
        maxConfidence = d.confidence;
      }
    }

    const consolidated: MemoryRecord = {
      ...primary,
      tags: Array.from(mergedTags),
      relatedMemoryIds: Array.from(mergedRelatedIds),
      confidence: maxConfidence,
      updatedAt: Date.now(),
      version: primary.version + 1,
    };

    return Object.assign(consolidated, {
      consolidated,
      supersededIds,
    });
  }
}
