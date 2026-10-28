import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CURATED_SOUND_LIBRARY } from '../soundLibrary';

describe('Sound FX Studio — Acoustic Diversity & Library Integrity', () => {
  const publicSfxDir = path.resolve(process.cwd(), 'public', 'sfx');

  it('contains all curated sound library files in public/sfx', () => {
    expect(CURATED_SOUND_LIBRARY.length).toBeGreaterThanOrEqual(14);

    for (const item of CURATED_SOUND_LIBRARY) {
      const filename = path.basename(item.url);
      const filePath = path.join(publicSfxDir, filename);
      expect(fs.existsSync(filePath), `Missing library file: ${filename}`).toBe(true);
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(1000);
    }
  });

  it('has distinct audio file sizes across different curated sound items', () => {
    const sizes = new Set<number>();
    for (const item of CURATED_SOUND_LIBRARY) {
      const filename = path.basename(item.url);
      const filePath = path.join(publicSfxDir, filename);
      const stats = fs.statSync(filePath);
      sizes.add(stats.size);
    }

    // Previous defect had ALL files at exactly 211,724 bytes (1 single size).
    // The upgraded procedural engine generates distinct durations and sample counts.
    expect(sizes.size).toBeGreaterThanOrEqual(8);
  });

  it('verifies that curated items have distinct duration properties matching acoustic specs', () => {
    const durations = CURATED_SOUND_LIBRARY.map((item) => item.duration);
    const uniqueDurations = new Set(durations);

    // Should have varied durations from 0.3s (clicks) up to 3.0s (drones)
    expect(uniqueDurations.size).toBeGreaterThanOrEqual(7);
    expect(Math.min(...durations)).toBeLessThanOrEqual(0.35);
    expect(Math.max(...durations)).toBeGreaterThanOrEqual(2.5);
  });
});
