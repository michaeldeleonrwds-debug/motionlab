import { openDB, type IDBPDatabase } from 'idb';
import type { MediaAsset, ProjectData } from '../types/editor';

const DB_NAME = 'motionlab-nle-db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_META = 'meta';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
      },
    });
  }
  return dbPromise;
}

export function serializeProjectToJson(project: ProjectData): string {
  const sanitized: ProjectData = {
    ...project,
    clips: project.clips.map((c) => ({
      ...c,
      sourceDuration: Number.isFinite(c.sourceDuration) ? c.sourceDuration : -1,
    })),
    mediaAssets: project.mediaAssets.map((a) => ({
      ...a,
      objectUrl: undefined,
      blob: undefined,
    })),
  };
  return JSON.stringify(sanitized);
}

export function deserializeProjectFromJson(json: string): ProjectData {
  const parsed = JSON.parse(json) as ProjectData;
  return {
    ...parsed,
    clips: parsed.clips.map((c) => ({
      ...c,
      sourceDuration: c.sourceDuration === -1 || c.sourceDuration === null ? Infinity : c.sourceDuration,
    })),
  };
}

export async function saveProjectToDB(project: ProjectData): Promise<void> {
  const db = await getDb();
  const toStore: ProjectData = {
    ...project,
    updatedAt: Date.now(),
    clips: project.clips.map((c) => ({
      ...c,
      sourceDuration: Number.isFinite(c.sourceDuration) ? c.sourceDuration : -1,
    })),
    mediaAssets: project.mediaAssets.map((asset) => ({
      ...asset,
      // Persist the underlying Blob in IndexedDB; strip ephemeral objectUrl and stale blob: thumbnails
      objectUrl: undefined,
      thumbnails: (asset.thumbnails || []).filter(
        (t) => typeof t === 'string' && !t.startsWith('blob:')
      ),
    })),
  };
  await db.put(STORE_PROJECTS, toStore);
  await db.put(STORE_META, project.id, 'activeProjectId');
}

function hydrateStoredProject(stored: ProjectData): ProjectData {
  const hydratedAssets: MediaAsset[] = (stored.mediaAssets || []).map((asset) => {
    let objectUrl = asset.objectUrl;
    if (asset.blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      objectUrl = URL.createObjectURL(asset.blob);
    }

    // Filter out any stale revoked blob: URLs from previous sessions
    const validThumbnails = (asset.thumbnails || []).filter(
      (t) => typeof t === 'string' && !t.startsWith('blob:')
    );

    // If thumbnails were empty or only contained revoked blob URLs, use the freshly generated objectUrl for image assets
    if (validThumbnails.length === 0 && objectUrl && asset.type === 'image') {
      validThumbnails.push(objectUrl);
    }

    return {
      ...asset,
      objectUrl,
      thumbnails: validThumbnails,
    };
  });

  const hydratedClips = (stored.clips || []).map((c) => {
    // Sanitize and deduplicate keyframes by property and frame-rounded time
    const seenKeyframes = new Set<string>();
    const sanitizedKeyframes = (c.keyframes || []).filter((kf, idx) => {
      const roundedTime = Math.round(kf.time * 1000) / 1000;
      const key = `${kf.property}-${roundedTime}`;
      if (seenKeyframes.has(key)) return false;
      seenKeyframes.add(key);
      if (!kf.id) {
        kf.id = `${c.id}-${kf.property}-${roundedTime}-${idx}`;
      }
      return true;
    });

    return {
      ...c,
      keyframes: sanitizedKeyframes,
      sourceDuration:
        c.sourceDuration === -1 || c.sourceDuration === null || c.sourceDuration === undefined
          ? Infinity
          : c.sourceDuration,
    };
  });

  return {
    ...stored,
    mediaAssets: hydratedAssets,
    clips: hydratedClips,
  };
}

export async function loadProjectFromDB(projectId: string): Promise<ProjectData | null> {
  const db = await getDb();
  const stored = (await db.get(STORE_PROJECTS, projectId)) as ProjectData | undefined;
  if (!stored) return null;
  return hydrateStoredProject(stored);
}

export async function getActiveProjectIdFromDB(): Promise<string | null> {
  const db = await getDb();
  const id = await db.get(STORE_META, 'activeProjectId');
  return typeof id === 'string' ? id : null;
}

export async function setActiveProjectIdInDB(projectId: string): Promise<void> {
  const db = await getDb();
  await db.put(STORE_META, projectId, 'activeProjectId');
}

export interface ProjectSummary {
  id: string;
  name: string;
  aspectRatio: ProjectData['aspectRatio'];
  resolution: ProjectData['resolution'];
  fps: ProjectData['fps'];
  clipCount: number;
  assetCount: number;
  updatedAt: number;
}

export async function listProjectsFromDB(): Promise<ProjectSummary[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE_PROJECTS)) as ProjectData[];
  return all
    .map((p) => ({
      id: p.id,
      name: p.name,
      aspectRatio: p.aspectRatio,
      resolution: p.resolution,
      fps: p.fps,
      clipCount: p.clips?.length || 0,
      assetCount: p.mediaAssets?.length || 0,
      updatedAt: p.updatedAt || p.createdAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProjectFromDB(projectId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_PROJECTS, projectId);
  const currentActive = await getActiveProjectIdFromDB();
  if (currentActive === projectId) {
    const remaining = await listProjectsFromDB();
    if (remaining.length > 0) {
      await setActiveProjectIdInDB(remaining[0].id);
    } else {
      await db.delete(STORE_META, 'activeProjectId');
    }
  }
}

export async function duplicateProjectInDB(
  projectId: string,
  customName?: string
): Promise<ProjectData | null> {
  const original = await loadProjectFromDB(projectId);
  if (!original) return null;
  const now = Date.now();
  const copy: ProjectData = {
    ...original,
    id: `proj-${now}-${Math.random().toString(36).slice(2, 7)}`,
    name: customName || `${original.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };
  await saveProjectToDB(copy);
  return copy;
}
