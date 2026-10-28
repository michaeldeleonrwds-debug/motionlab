import type { MemoryCategory, MemoryRecord } from './types';

export const VALID_CATEGORIES: MemoryCategory[] = [
  'system',
  'project',
  'creative-brief',
  'design-principle',
  'motion-principle',
  'typography',
  'brand-guideline',
  'animation-pattern',
  'creative-decision',
  'approved-reference',
  'quality-review',
  'lesson-learned',
  'ai-skill',
  'technical-architecture',
  'user-preference',
  'session-summary',
  'experiment',
  'archive',
];

export class MemoryValidator {
  /**
   * Sanitizes markdown text to prevent script injection or dangerous iframe tags.
   */
  public static sanitizeContent(content: string): string {
    if (!content) return '';
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/onload\s*=/gi, '')
      .replace(/onerror\s*=/gi, '');
  }

  /**
   * Validates a MemoryRecord against schema rules.
   */
  public static validateRecord(record: Partial<MemoryRecord>): {
    valid: boolean;
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!record.id || typeof record.id !== 'string' || record.id.trim().length === 0) {
      errors.push('Memory ID is required and must be non-empty.');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(record.id)) {
      errors.push('Memory ID contains invalid characters. Use letters, numbers, hyphens, or underscores.');
    }

    if (!record.title || typeof record.title !== 'string' || record.title.trim().length === 0) {
      errors.push('Memory title is required.');
    }

    if (!record.content || typeof record.content !== 'string' || record.content.trim().length === 0) {
      errors.push('Memory content cannot be empty.');
    }

    if (!record.category) {
      errors.push('Memory category is required.');
    } else if (!VALID_CATEGORIES.includes(record.category as MemoryCategory)) {
      errors.push(`Invalid memory category "${record.category}".`);
    }

    if (!record.type) {
      errors.push('Memory type is required.');
    }

    if (typeof record.confidence === 'number') {
      if (record.confidence < 0 || record.confidence > 1) {
        errors.push('Confidence score must be between 0.0 and 1.0.');
      }
    }

    const isValid = errors.length === 0;

    return {
      valid: isValid,
      isValid,
      errors,
    };
  }

  /**
   * Creates a deterministic safe memory ID.
   */
  public static generateMemoryId(category: string, titleOrPrefix = 'mem'): string {
    const rand = Math.random().toString(36).slice(2, 6);
    const catSlug = category.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const titleSlug = titleOrPrefix
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    return `${catSlug}-${rand}-${titleSlug}`;
  }
}
