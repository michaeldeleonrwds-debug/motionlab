import type { MemoryFilter, MemoryRecord, MemorySearchResult } from './types';

export class MemoryRetriever {
  /**
   * Extracts a readable snippet containing query keywords or the start of the text.
   */
  public static extractSnippet(text: string, query?: string, maxLength = 160): string {
    if (!text) return '';
    const clean = text.replace(/\n+/g, ' ').trim();
    if (!query || !query.trim()) {
      return clean.length > maxLength ? `${clean.slice(0, maxLength)}…` : clean;
    }

    const q = query.toLowerCase().trim();
    const idx = clean.toLowerCase().indexOf(q);
    if (idx === -1) {
      return clean.length > maxLength ? `${clean.slice(0, maxLength)}…` : clean;
    }

    const start = Math.max(0, idx - 40);
    const end = Math.min(clean.length, start + maxLength);
    let snippet = clean.slice(start, end);
    if (start > 0) snippet = `…${snippet}`;
    if (end < clean.length) snippet = `${snippet}…`;
    return snippet;
  }

  /**
   * Performs hybrid relevance search over in-memory or persisted records.
   */
  public static search(
    records: MemoryRecord[],
    queryOrFilter: string | MemoryFilter,
    options?: Partial<MemoryFilter>
  ): MemorySearchResult[] {
    const filter: MemoryFilter =
      typeof queryOrFilter === 'string'
        ? { query: queryOrFilter, ...options }
        : { ...queryOrFilter, ...options };

    const query = filter.query ? filter.query.toLowerCase().trim() : '';
    const queryTokens = query.split(/\s+/).filter((t) => t.length > 1);

    const results: MemorySearchResult[] = [];

    for (const record of records) {
      // 1. Hard filters
      if (filter.approvalStatus && record.approvalStatus !== filter.approvalStatus) {
        continue;
      }
      if (filter.validationStatus && record.validationStatus !== filter.validationStatus) {
        continue;
      }
      if (
        filter.projectId &&
        record.projectId &&
        record.projectId !== 'global' &&
        record.projectId !== filter.projectId
      ) {
        continue;
      }
      if (filter.category) {
        const allowedCats = Array.isArray(filter.category) ? filter.category : [filter.category];
        if (!allowedCats.includes(record.category)) continue;
      }
      if (filter.type) {
        const allowedTypes = Array.isArray(filter.type) ? filter.type : [filter.type];
        if (!allowedTypes.includes(record.type)) continue;
      }
      if (typeof filter.minConfidence === 'number' && record.confidence < filter.minConfidence) {
        continue;
      }
      if (filter.tags && filter.tags.length > 0) {
        const hasTag = filter.tags.some((t) => record.tags.includes(t.toLowerCase()));
        if (!hasTag) continue;
      }

      // 2. Score calculation
      let score = record.confidence * 10;
      const matchedFields: string[] = [];

      if (query) {
        const titleLower = record.title.toLowerCase();
        const contentLower = record.content.toLowerCase();
        const tagsLower = record.tags.map((t) => t.toLowerCase());

        if (titleLower.includes(query)) {
          score += 50;
          matchedFields.push('title');
        }
        if (tagsLower.some((t) => query.includes(t) || t.includes(query))) {
          score += 30;
          matchedFields.push('tags');
        }
        if (contentLower.includes(query)) {
          score += 20;
          matchedFields.push('content');
        }

        // Token match density
        let tokenMatches = 0;
        for (const tok of queryTokens) {
          if (titleLower.includes(tok)) tokenMatches += 3;
          if (contentLower.includes(tok)) tokenMatches += 1;
          if (tagsLower.some((t) => t.includes(tok))) {
            tokenMatches += 2;
            if (!matchedFields.includes('tags')) {
              matchedFields.push('tags');
            }
          }
        }

        if (matchedFields.length === 0 && tokenMatches === 0) {
          continue; // Query specified but no matches
        }

        score += tokenMatches * 5;
      } else {
        // No query: sort by recency and confidence
        score += (record.updatedAt / 1_000_000_000_000) * 10;
      }

      // Snippet generation
      const snippet = MemoryRetriever.extractSnippet(record.content, query);

      results.push({
        memory: record,
        score,
        matchedFields,
        snippet,
      });
    }

    results.sort((a, b) => b.score - a.score);

    if (filter.limit && filter.limit > 0) {
      return results.slice(0, filter.limit);
    }
    return results;
  }
}
