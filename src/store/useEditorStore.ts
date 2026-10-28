import { create } from 'zustand';
import type {
  AspectRatio,
  ColorEffects,
  CropSettings,
  FrameRate,
  Keyframe,
  KeyframeEasing,
  KeyframeProperty,
  MaskSettings,
  MediaAsset,
  ProjectData,
  ResolutionPreset,
  TextStyle,
  TimelineClip,
  TimelineTrack,
  TrackType,
  TransitionConfig,
} from '../types/editor';
import {
  createClipFromMediaAsset,
  createDefaultMask,
  createNewProject,
  createTextClip,
} from '../engine/projectFactory';
import {
  changeClipSpeed,
  getProjectDuration,
  isTrackCompatibleWithClip,
  snapTimeToFrame,
  splitClipAtTime,
  trimClipLeft,
  trimClipRight,
} from '../engine/timelineEngine';
import { upsertKeyframe } from '../engine/keyframeEngine';
import {
  buildAngoraBeyondOrdinaryProject,
  buildAngoraPromoProject,
  buildAngoraPromoV2Project,
} from '../engine/angoraPromoBuilder';
import {
  buildAngoraEditorialPromoProjectData,
  ANGORA_EDITORIAL_PROMO_PROJECT_ID,
} from '../engine/angoraEditorialBuilder';
import {
  deleteProjectFromDB,
  duplicateProjectInDB,
  getActiveProjectIdFromDB,
  listProjectsFromDB,
  loadProjectFromDB,
  saveProjectToDB,
  type ProjectSummary,
} from '../storage/projectStorage';

export type LeftSidebarTab =
  | 'media'
  | 'text'
  | 'audio'
  | 'voice'
  | 'transitions'
  | 'effects'
  | 'filters'
  | 'ai-mcp'
  | 'projects';

export type AiProviderId =
  | 'antigravity'
  | 'chatgpt-codex'
  | 'claude'
  | 'custom';

export interface McpLogEntry {
  id: string;
  timestamp: number;
  source: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'success' | 'error';
  resultSummary: string;
  durationMs: number;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface HistorySnapshot {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  aspectRatio: AspectRatio;
  resolution: ResolutionPreset;
  fps: FrameRate;
  name: string;
}

function cloneSnapshot(project: ProjectData): HistorySnapshot {
  return {
    tracks: JSON.parse(JSON.stringify(project.tracks)),
    clips: project.clips.map((c) => ({
      ...c,
      crop: { ...c.crop },
      mask: c.mask ? { ...c.mask } : createDefaultMask(),
      effects: { ...c.effects },
      transitionIn: { ...c.transitionIn },
      transitionOut: { ...c.transitionOut },
      textStyle: c.textStyle ? { ...c.textStyle } : undefined,
      shapeStyle: c.shapeStyle ? { ...c.shapeStyle } : undefined,
      keyframes: c.keyframes.map((k) => ({ ...k })),
    })),
    aspectRatio: project.aspectRatio,
    resolution: project.resolution,
    fps: project.fps,
    name: project.name,
  };
}

export interface EditorState {
  project: ProjectData;
  projectList: ProjectSummary[];
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  selectedClipId: string | null;
  selectedKeyframeId: string | null;
  currentTime: number;
  isPlaying: boolean;
  timelineZoom: number; // pixels per second (default 90)
  canvasZoom: number;   // 0.5 to 2.0 (1 = Fit)
  showSafeGuides: boolean;
  snapEnabled: boolean;
  activeSnapTime: number | null;
  activeLeftTab: LeftSidebarTab;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  importError: string | null;
  isImporting: boolean;
  isExportModalOpen: boolean;
  isProjectModalOpen: boolean;
  isMcpModalOpen: boolean;
  isAiDrawerOpen: boolean;
  mcpBridgeConnected: boolean;
  activeAiProvider: AiProviderId;
  mcpLogs: McpLogEntry[];

  // Initialization & Persistence
  initFromStorage: () => Promise<void>;
  saveCurrentProject: () => Promise<void>;
  createNewProjectAction: (options: {
    name: string;
    aspectRatio: AspectRatio;
    resolution: ResolutionPreset;
    fps: FrameRate;
    customWidth?: number;
    customHeight?: number;
  }) => Promise<void>;
  renameProject: (newName: string) => void;
  setProjectFormat: (options: {
    aspectRatio?: AspectRatio;
    resolution?: ResolutionPreset;
    fps?: FrameRate;
    customWidth?: number;
    customHeight?: number;
  }) => void;
  openExistingProject: (projectId: string) => Promise<void>;
  duplicateProjectAction: (projectId: string) => Promise<void>;
  deleteProjectAction: (projectId: string) => Promise<void>;
  refreshProjectList: () => Promise<void>;
  loadAngoraPromoProject: () => Promise<void>;
  loadAngoraBeyondOrdinaryFilm: () => Promise<void>;
  loadAngoraEditorialPromo: () => Promise<void>;
  loadProject: (project: ProjectData) => Promise<void>;
  saveProject: () => Promise<void>;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;

  // Undo / Redo
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Media Library
  addMediaAssets: (assets: MediaAsset[]) => void;
  removeMediaAsset: (assetId: string) => void;
  setImportError: (err: string | null) => void;
  setIsImporting: (busy: boolean) => void;

  // Tracks
  addTrack: (type: TrackType, name?: string) => string;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackVisible: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;

  // Clips
  addMediaClipToTimeline: (
    assetId: string,
    targetTrackId?: string,
    startTime?: number
  ) => string | null;
  addTextClipToTimeline: (
    content?: string,
    preset?: Partial<TextStyle>,
    startTime?: number
  ) => string;
  selectClip: (clipId: string | null) => void;
  selectKeyframe: (
    clipId: string,
    keyframeId: string | null,
    seekToKeyframe?: boolean
  ) => void;
  moveClip: (
    clipId: string,
    newStartTime: number,
    targetTrackId?: string,
    recordHistory?: boolean
  ) => void;
  trimClipLeftAction: (
    clipId: string,
    newStartTime: number,
    recordHistory?: boolean
  ) => void;
  trimClipRightAction: (
    clipId: string,
    newDuration: number,
    recordHistory?: boolean
  ) => void;
  splitSelectedClipAtPlayhead: () => boolean;
  splitClipById: (clipId: string, splitTime: number) => boolean;
  deleteClip: (clipId?: string) => void;
  duplicateClip: (clipId?: string) => string | null;
  updateClipProperties: (
    clipId: string,
    updates: Partial<TimelineClip>,
    recordHistory?: boolean
  ) => void;
  updateClipColorEffects: (
    clipId: string,
    updates: Partial<ColorEffects>,
    recordHistory?: boolean
  ) => void;
  updateClipCrop: (
    clipId: string,
    updates: Partial<CropSettings>,
    recordHistory?: boolean
  ) => void;
  updateClipMask: (
    clipId: string,
    updates: Partial<MaskSettings>,
    recordHistory?: boolean
  ) => void;
  updateClipTextStyle: (
    clipId: string,
    updates: Partial<TextStyle>,
    recordHistory?: boolean
  ) => void;
  updateClipSpeed: (clipId: string, newSpeed: number) => void;
  setClipTransition: (
    clipId: string,
    edge: 'in' | 'out',
    config: TransitionConfig
  ) => void;
  setClipKeyframe: (
    clipId: string,
    property: KeyframeProperty,
    time: number,
    value: number,
    easing?: KeyframeEasing
  ) => void;
  updateClipKeyframe: (
    clipId: string,
    keyframeId: string,
    updates: Partial<Pick<Keyframe, 'time' | 'value' | 'easing' | 'property'>>,
    recordHistory?: boolean
  ) => void;
  removeClipKeyframe: (clipId: string, keyframeId: string) => void;

  // Playback & UI
  setCurrentTime: (time: number) => void;
  stepFrames: (deltaFrames: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlayPause: () => void;
  setTimelineZoom: (zoom: number) => void;
  setCanvasZoom: (zoom: number) => void;
  toggleSafeGuides: () => void;
  toggleSnap: () => void;
  setActiveSnapTime: (time: number | null) => void;
  setActiveLeftTab: (tab: LeftSidebarTab) => void;
  setExportModalOpen: (open: boolean) => void;
  setProjectModalOpen: (open: boolean) => void;
  setMcpModalOpen: (open: boolean) => void;
  setAiDrawerOpen: (open: boolean) => void;
  toggleAiDrawer: () => void;
  setMcpBridgeConnected: (connected: boolean) => void;
  setActiveAiProvider: (provider: AiProviderId) => void;
  addMcpLog: (entry: McpLogEntry) => void;
  clearMcpLogs: () => void;
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutosave(get: () => EditorState, set: (partial: Partial<EditorState>) => void) {
  set({ saveStatus: 'unsaved' });
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    void get().saveCurrentProject();
  }, 450);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createNewProject({
    name: 'Studio Master 1080p',
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: 30,
  }),
  projectList: [],
  past: [],
  future: [],
  selectedClipId: null,
  selectedKeyframeId: null,
  currentTime: 0,
  isPlaying: false,
  timelineZoom: 95,
  canvasZoom: 1,
  showSafeGuides: false,
  snapEnabled: true,
  activeSnapTime: null,
  activeLeftTab: 'media',
  saveStatus: 'saved',
  lastSavedAt: null,
  importError: null,
  isImporting: false,
  isExportModalOpen: false,
  isProjectModalOpen: false,
  isMcpModalOpen: false,
  isAiDrawerOpen: false,
  mcpBridgeConnected: false,
  activeAiProvider: 'antigravity',
  mcpLogs: [],

  initFromStorage: async () => {
    try {
      if (
        typeof window !== 'undefined' &&
        (window.location.search.includes('project=editorial') ||
          window.location.search.includes('promo=editorial') ||
          window.location.search.includes('editorial'))
      ) {
        await get().loadAngoraEditorialPromo();
        return;
      }

      if (
        typeof window !== 'undefined' &&
        (window.location.search.includes('project=angora') ||
          window.location.search.includes('promo=angora'))
      ) {
        await get().loadAngoraPromoProject();
        return;
      }

      // Ensure Editorial Promo is seeded into user's IndexedDB
      const initialCheckList = await listProjectsFromDB();
      if (!initialCheckList.some((p) => p.id === ANGORA_EDITORIAL_PROMO_PROJECT_ID)) {
        try {
          const editorialSeed = await buildAngoraEditorialPromoProjectData();
          await saveProjectToDB(editorialSeed);
        } catch {
          // ignore
        }
      }

      const activeId = await getActiveProjectIdFromDB();
      if (activeId) {
        const stored = await loadProjectFromDB(activeId);
        if (stored) {
          const list = await listProjectsFromDB();
          set({
            project: stored,
            projectList: list,
            past: [],
            future: [],
            selectedClipId: null,
            currentTime: 0,
            isPlaying: false,
            saveStatus: 'saved',
            lastSavedAt: stored.updatedAt,
          });
          return;
        }
      }
      const list = await listProjectsFromDB();
      if (list.length > 0) {
        const latest = await loadProjectFromDB(list[0].id);
        if (latest) {
          set({
            project: latest,
            projectList: list,
            past: [],
            future: [],
            selectedClipId: null,
            currentTime: 0,
            isPlaying: false,
            saveStatus: 'saved',
            lastSavedAt: latest.updatedAt,
          });
          return;
        }
      }
      // Save initial default project
      await saveProjectToDB(get().project);
      const updatedList = await listProjectsFromDB();
      set({ projectList: updatedList, saveStatus: 'saved', lastSavedAt: Date.now() });
    } catch {
      // Fallback gracefully if IndexedDB is blocked
    }
  },

  loadAngoraPromoProject: async () => {
    set({ isImporting: true, importError: null, saveStatus: 'saving' });
    try {
      for (const asset of get().project.mediaAssets) {
        if (asset.objectUrl) URL.revokeObjectURL(asset.objectUrl);
      }
      // 1. Preserve original ANGORA — Agency Promo 2026 in IndexedDB
      const v1Proj = await buildAngoraPromoProject();
      await saveProjectToDB(v1Proj);

      // 2. Build and activate duplicated & enhanced ANGORA — Agency Promo V2
      const v2Proj = await buildAngoraPromoV2Project();
      const firstSymClip = v2Proj.clips.find((c) => c.id === 'clip-s1-symbol');
      set({
        project: v2Proj,
        past: [],
        future: [],
        selectedClipId: 'clip-s1-symbol',
        selectedKeyframeId: firstSymClip?.keyframes[0]?.id ?? null,
        currentTime: 1.6,
        isPlaying: false,
        timelineZoom: 76,
        showSafeGuides: true,
        isImporting: false,
        saveStatus: 'saving',
      });
      await saveProjectToDB(v2Proj);
      const list = await listProjectsFromDB();
      set({
        projectList: list,
        saveStatus: 'saved',
        lastSavedAt: Date.now(),
      });
    } catch (err) {
      set({
        isImporting: false,
        importError:
          err instanceof Error
            ? err.message
            : 'Failed to load ANGORA — Agency Promo V2',
        saveStatus: 'unsaved',
      });
    }
  },

  loadAngoraBeyondOrdinaryFilm: async () => {
    set({ isImporting: true, importError: null, saveStatus: 'saving' });
    try {
      for (const asset of get().project.mediaAssets) {
        if (asset.objectUrl) URL.revokeObjectURL(asset.objectUrl);
      }
      // 1. Ensure both existing Angora projects (V1 & V2) are preserved in IndexedDB
      const existingList = await listProjectsFromDB();
      if (!existingList.some((p) => p.id === 'proj-angora-agency-promo-2026')) {
        const v1Proj = await buildAngoraPromoProject();
        await saveProjectToDB(v1Proj);
      }
      if (!existingList.some((p) => p.id === 'proj-angora-agency-promo-v2')) {
        const v2Proj = await buildAngoraPromoV2Project();
        await saveProjectToDB(v2Proj);
      }

      // 2. Build and activate ANGORA — BEYOND ORDINARY | Motion Design Film (23.0s)
      const beyondProj = await buildAngoraBeyondOrdinaryProject();
      const firstClip = beyondProj.clips.find(
        (c) => c.id === 'clip-b1-logo-symbol'
      );
      set({
        project: beyondProj,
        past: [],
        future: [],
        selectedClipId: 'clip-b1-logo-symbol',
        selectedKeyframeId: firstClip?.keyframes[0]?.id ?? null,
        currentTime: 2.2,
        isPlaying: false,
        timelineZoom: 64,
        showSafeGuides: true,
        isImporting: false,
        saveStatus: 'saving',
      });
      await saveProjectToDB(beyondProj);
      const list = await listProjectsFromDB();
      set({
        projectList: list,
        saveStatus: 'saved',
        lastSavedAt: Date.now(),
      });
    } catch (err) {
      set({
        isImporting: false,
        importError:
          err instanceof Error
            ? err.message
            : 'Failed to load ANGORA — BEYOND ORDINARY | Motion Design Film',
        saveStatus: 'unsaved',
      });
    }
  },

  loadAngoraEditorialPromo: async () => {
    set({ isImporting: true, importError: null, saveStatus: 'saving' });
    try {
      for (const asset of get().project.mediaAssets) {
        if (asset.objectUrl) URL.revokeObjectURL(asset.objectUrl);
      }
      // 1. Build and activate ANGORA — Editorial Kinetic Promo (15s)
      const editorialProj = await buildAngoraEditorialPromoProjectData();
      const firstClip = editorialProj.clips.find((c) => c.id === 'clip-s1-headline');

      set({
        project: editorialProj,
        past: [],
        future: [],
        selectedClipId: firstClip?.id ?? null,
        selectedKeyframeId: firstClip?.keyframes[0]?.id ?? null,
        currentTime: 0.0,
        isPlaying: false,
        timelineZoom: 64,
        showSafeGuides: true,
        isImporting: false,
        saveStatus: 'saving',
      });
      await saveProjectToDB(editorialProj);
      const list = await listProjectsFromDB();
      set({
        projectList: list,
        saveStatus: 'saved',
        lastSavedAt: Date.now(),
      });
    } catch (err) {
      set({
        isImporting: false,
        importError:
          err instanceof Error
            ? err.message
            : 'Failed to load ANGORA — Editorial Kinetic Promo (15s)',
        saveStatus: 'unsaved',
      });
    }
  },

  saveCurrentProject: async () => {
    set({ saveStatus: 'saving' });
    try {
      const current = get().project;
      await saveProjectToDB(current);
      const list = await listProjectsFromDB();
      set({
        projectList: list,
        saveStatus: 'saved',
        lastSavedAt: Date.now(),
      });
    } catch {
      set({ saveStatus: 'unsaved' });
    }
  },

  saveProject: async () => {
    return get().saveCurrentProject();
  },

  loadProject: async (newProject: ProjectData) => {
    set({
      project: newProject,
      past: [],
      future: [],
      selectedClipId: null,
      currentTime: 0,
      isPlaying: false,
      saveStatus: 'saving',
    });
    try {
      await saveProjectToDB(newProject);
      const list = await listProjectsFromDB();
      set({ projectList: list, saveStatus: 'saved', lastSavedAt: Date.now() });
    } catch {
      set({ saveStatus: 'unsaved' });
    }
  },

  updateClip: (clipId: string, updates: Partial<TimelineClip>) => {
    get().updateClipProperties(clipId, updates);
  },

  createNewProjectAction: async ({
    name,
    aspectRatio,
    resolution,
    fps,
    customWidth,
    customHeight,
  }) => {
    // Cleanup previous object URLs
    for (const asset of get().project.mediaAssets) {
      if (asset.objectUrl) URL.revokeObjectURL(asset.objectUrl);
    }
    const nextProj = createNewProject({
      name: name.trim() || 'Untitled Project',
      aspectRatio,
      resolution,
      fps,
      customWidth,
      customHeight,
    });
    set({
      project: nextProj,
      past: [],
      future: [],
      selectedClipId: null,
      currentTime: 0,
      isPlaying: false,
      saveStatus: 'saving',
    });
    await saveProjectToDB(nextProj);
    const list = await listProjectsFromDB();
    set({ projectList: list, saveStatus: 'saved', lastSavedAt: Date.now() });
  },

  renameProject: (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        name: trimmed,
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  setProjectFormat: ({
    aspectRatio,
    resolution,
    fps,
    customWidth,
    customHeight,
  }) => {
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        aspectRatio: aspectRatio ?? state.project.aspectRatio,
        resolution: resolution ?? state.project.resolution,
        fps: fps ?? state.project.fps,
        customWidth:
          customWidth !== undefined ? customWidth : state.project.customWidth,
        customHeight:
          customHeight !== undefined ? customHeight : state.project.customHeight,
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  openExistingProject: async (projectId: string) => {
    const loaded = await loadProjectFromDB(projectId);
    if (!loaded) return;
    for (const asset of get().project.mediaAssets) {
      if (asset.objectUrl) URL.revokeObjectURL(asset.objectUrl);
    }
    await saveProjectToDB(loaded);
    const list = await listProjectsFromDB();
    set({
      project: loaded,
      projectList: list,
      past: [],
      future: [],
      selectedClipId: null,
      currentTime: 0,
      isPlaying: false,
      saveStatus: 'saved',
      lastSavedAt: Date.now(),
    });
  },

  duplicateProjectAction: async (projectId: string) => {
    const copy = await duplicateProjectInDB(projectId);
    if (!copy) return;
    const list = await listProjectsFromDB();
    set({
      project: copy,
      projectList: list,
      past: [],
      future: [],
      selectedClipId: null,
      currentTime: 0,
      isPlaying: false,
      saveStatus: 'saved',
      lastSavedAt: Date.now(),
    });
  },

  deleteProjectAction: async (projectId: string) => {
    await deleteProjectFromDB(projectId);
    const list = await listProjectsFromDB();
    if (get().project.id === projectId) {
      if (list.length > 0) {
        const next = await loadProjectFromDB(list[0].id);
        if (next) {
          set({
            project: next,
            projectList: list,
            past: [],
            future: [],
            selectedClipId: null,
            currentTime: 0,
            isPlaying: false,
          });
          return;
        }
      }
      const fresh = createNewProject({ name: 'Untitled Sequence' });
      await saveProjectToDB(fresh);
      const freshList = await listProjectsFromDB();
      set({
        project: fresh,
        projectList: freshList,
        past: [],
        future: [],
        selectedClipId: null,
        currentTime: 0,
        isPlaying: false,
      });
    } else {
      set({ projectList: list });
    }
  },

  refreshProjectList: async () => {
    let list = await listProjectsFromDB();
    if (!list.some((p) => p.id === ANGORA_EDITORIAL_PROMO_PROJECT_ID)) {
      try {
        const editorialSeed = await buildAngoraEditorialPromoProjectData();
        await saveProjectToDB(editorialSeed);
        list = await listProjectsFromDB();
      } catch {
        // ignore
      }
    }
    set({ projectList: list });
  },

  pushHistory: () => {
    const currentSnap = cloneSnapshot(get().project);
    set((state) => ({
      past: [...state.past.slice(-39), currentSnap],
      future: [],
    }));
  },

  undo: () => {
    const { past, project, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const currentSnap = cloneSnapshot(project);

    set({
      past: past.slice(0, -1),
      future: [currentSnap, ...future.slice(0, 39)],
      project: {
        ...project,
        tracks: previous.tracks,
        clips: previous.clips,
        aspectRatio: previous.aspectRatio,
        resolution: previous.resolution,
        fps: previous.fps,
        name: previous.name,
        updatedAt: Date.now(),
      },
    });
    scheduleAutosave(get, set);
  },

  redo: () => {
    const { past, project, future } = get();
    if (future.length === 0) return;
    const next = future[0];
    const currentSnap = cloneSnapshot(project);

    set({
      past: [...past, currentSnap],
      future: future.slice(1),
      project: {
        ...project,
        tracks: next.tracks,
        clips: next.clips,
        aspectRatio: next.aspectRatio,
        resolution: next.resolution,
        fps: next.fps,
        name: next.name,
        updatedAt: Date.now(),
      },
    });
    scheduleAutosave(get, set);
  },

  addMediaAssets: (assets: MediaAsset[]) => {
    set((state) => ({
      project: {
        ...state.project,
        mediaAssets: [...state.project.mediaAssets, ...assets],
        updatedAt: Date.now(),
      },
      importError: null,
    }));
    scheduleAutosave(get, set);
  },

  removeMediaAsset: (assetId: string) => {
    get().pushHistory();
    const asset = get().project.mediaAssets.find((a) => a.id === assetId);
    if (asset?.objectUrl) {
      URL.revokeObjectURL(asset.objectUrl);
    }
    set((state) => ({
      project: {
        ...state.project,
        mediaAssets: state.project.mediaAssets.filter((a) => a.id !== assetId),
        clips: state.project.clips.filter((c) => c.mediaId !== assetId),
        updatedAt: Date.now(),
      },
      selectedClipId:
        state.selectedClipId &&
        state.project.clips.find((c) => c.id === state.selectedClipId)?.mediaId ===
          assetId
          ? null
          : state.selectedClipId,
    }));
    scheduleAutosave(get, set);
  },

  setImportError: (err) => set({ importError: err }),
  setIsImporting: (busy) => set({ isImporting: busy }),

  addTrack: (type: TrackType, customName?: string) => {
    get().pushHistory();
    const { tracks } = get().project;
    const countOfType = tracks.filter((t) => t.type === type).length + 1;
    const prefix =
      type === 'video'
        ? `V${countOfType} • Video`
        : type === 'overlay'
          ? `V${countOfType + 1} • Overlay`
          : type === 'text'
            ? `T${countOfType} • Titles`
            : `A${countOfType} • Audio`;

    const id = `track-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTrack: TimelineTrack = {
      id,
      name: customName || prefix,
      type,
      order: type === 'audio' ? tracks.length : 0,
      muted: false,
      visible: true,
      locked: false,
    };

    const updatedTracks =
      type === 'audio'
        ? [...tracks, newTrack].map((t, idx) => ({ ...t, order: idx }))
        : [newTrack, ...tracks].map((t, idx) => ({ ...t, order: idx }));

    set((state) => ({
      project: {
        ...state.project,
        tracks: updatedTracks,
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
    return id;
  },

  toggleTrackMute: (trackId: string) => {
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId ? { ...t, muted: !t.muted } : t
        ),
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  toggleTrackVisible: (trackId: string) => {
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId ? { ...t, visible: !t.visible } : t
        ),
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  toggleTrackLock: (trackId: string) => {
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId ? { ...t, locked: !t.locked } : t
        ),
      },
    }));
  },

  addMediaClipToTimeline: (assetId, targetTrackId, explicitStartTime) => {
    const { project } = get();
    const asset = project.mediaAssets.find((a) => a.id === assetId);
    if (!asset) return null;

    let track = targetTrackId
      ? project.tracks.find((t) => t.id === targetTrackId)
      : undefined;

    if (!track || !isTrackCompatibleWithClip(track.type, asset.type)) {
      if (asset.type === 'audio') {
        track = project.tracks.find((t) => t.type === 'audio');
      } else if (asset.type === 'image') {
        track =
          project.tracks.find((t) => t.type === 'overlay') ||
          project.tracks.find((t) => t.type === 'video');
      } else {
        track = project.tracks.find((t) => t.type === 'video');
      }
    }

    if (!track) return null;
    if (track.locked) return null;

    get().pushHistory();

    // Place sequentially after existing clips on that track unless explicitStartTime is given
    const trackClips = project.clips.filter((c) => c.trackId === track!.id);
    const trackEnd = trackClips.reduce(
      (max, c) => Math.max(max, c.startTime + c.duration),
      0
    );
    const startTime =
      explicitStartTime !== undefined ? Math.max(0, explicitStartTime) : trackEnd;

    const newClip = createClipFromMediaAsset(asset, track.id, startTime);

    set((state) => ({
      project: {
        ...state.project,
        clips: [...state.project.clips, newClip],
        updatedAt: Date.now(),
      },
      selectedClipId: newClip.id,
    }));
    scheduleAutosave(get, set);
    return newClip.id;
  },

  addTextClipToTimeline: (content = 'MotionLab Title', preset, explicitStartTime) => {
    const { project, currentTime } = get();
    let textTrack = project.tracks.find((t) => t.type === 'text');
    if (!textTrack) {
      const newTrackId = get().addTrack('text', 'T1 • Titles');
      textTrack = get().project.tracks.find((t) => t.id === newTrackId)!;
    }

    get().pushHistory();

    const startTime =
      explicitStartTime !== undefined ? Math.max(0, explicitStartTime) : currentTime;
    const newClip = createTextClip(textTrack.id, startTime, content, preset);

    set((state) => ({
      project: {
        ...state.project,
        clips: [...state.project.clips, newClip],
        updatedAt: Date.now(),
      },
      selectedClipId: newClip.id,
    }));
    scheduleAutosave(get, set);
    return newClip.id;
  },

  selectClip: (clipId) =>
    set((state) => {
      if (state.selectedClipId === clipId) return {};
      const nextClip = clipId
        ? state.project.clips.find((c) => c.id === clipId)
        : undefined;
      return {
        selectedClipId: clipId,
        selectedKeyframeId: nextClip?.keyframes[0]?.id ?? null,
      };
    }),

  selectKeyframe: (clipId, keyframeId, seekToKeyframe = true) => {
    const clip = get().project.clips.find((c) => c.id === clipId);
    if (!clip) {
      set({ selectedClipId: clipId, selectedKeyframeId: keyframeId });
      return;
    }
    const kf = keyframeId
      ? clip.keyframes.find((k) => k.id === keyframeId)
      : undefined;
    if (seekToKeyframe && kf) {
      const targetTime = Number(Math.max(0, clip.startTime + kf.time).toFixed(4));
      set({
        selectedClipId: clipId,
        selectedKeyframeId: keyframeId,
        currentTime: targetTime,
        isPlaying: false,
      });
    } else {
      set({
        selectedClipId: clipId,
        selectedKeyframeId: keyframeId,
      });
    }
  },

  moveClip: (clipId, newStartTime, targetTrackId, recordHistory = true) => {
    const { project } = get();
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;

    let finalTrackId = clip.trackId;
    if (targetTrackId && targetTrackId !== clip.trackId) {
      const targetTrack = project.tracks.find((t) => t.id === targetTrackId);
      if (
        targetTrack &&
        !targetTrack.locked &&
        isTrackCompatibleWithClip(targetTrack.type, clip.type)
      ) {
        finalTrackId = targetTrack.id;
      }
    }

    const currentTrack = project.tracks.find((t) => t.id === finalTrackId);
    if (currentTrack?.locked) return;

    if (recordHistory) get().pushHistory();

    const clampedStart = Number(Math.max(0, newStartTime).toFixed(4));
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((c) =>
          c.id === clipId
            ? { ...c, startTime: clampedStart, trackId: finalTrackId }
            : c
        ),
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  trimClipLeftAction: (clipId, newStartTime, recordHistory = true) => {
    const { project } = get();
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;
    if (recordHistory) get().pushHistory();

    const trimmed = trimClipLeft(clip, newStartTime);
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((c) => (c.id === clipId ? trimmed : c)),
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  trimClipRightAction: (clipId, newDuration, recordHistory = true) => {
    const { project } = get();
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;
    if (recordHistory) get().pushHistory();

    const trimmed = trimClipRight(clip, newDuration);
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((c) => (c.id === clipId ? trimmed : c)),
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  splitSelectedClipAtPlayhead: () => {
    const { project, selectedClipId, currentTime } = get();
    let targetClip = selectedClipId
      ? project.clips.find((c) => c.id === selectedClipId)
      : undefined;

    if (
      !targetClip ||
      currentTime <= targetClip.startTime + 0.08 ||
      currentTime >= targetClip.startTime + targetClip.duration - 0.08
    ) {
      // Find topmost clip under playhead if selected clip is not under playhead
      targetClip = project.clips.find(
        (c) =>
          currentTime > c.startTime + 0.08 &&
          currentTime < c.startTime + c.duration - 0.08
      );
    }

    if (!targetClip) return false;
    return get().splitClipById(targetClip.id, currentTime);
  },

  splitClipById: (clipId, splitTime) => {
    const { project } = get();
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return false;

    const track = project.tracks.find((t) => t.id === clip.trackId);
    if (track?.locked) return false;

    const splitResult = splitClipAtTime(clip, splitTime);
    if (!splitResult) return false;

    get().pushHistory();
    const [leftClip, rightClip] = splitResult;

    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.flatMap((c) =>
          c.id === clipId ? [leftClip, rightClip] : [c]
        ),
        updatedAt: Date.now(),
      },
      selectedClipId: rightClip.id,
    }));
    scheduleAutosave(get, set);
    return true;
  },

  deleteClip: (explicitClipId) => {
    const targetId = explicitClipId ?? get().selectedClipId;
    if (!targetId) return;
    const clip = get().project.clips.find((c) => c.id === targetId);
    if (!clip) return;
    const track = get().project.tracks.find((t) => t.id === clip.trackId);
    if (track?.locked) return;

    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.filter((c) => c.id !== targetId),
        updatedAt: Date.now(),
      },
      selectedClipId:
        state.selectedClipId === targetId ? null : state.selectedClipId,
      selectedKeyframeId:
        state.selectedClipId === targetId ? null : state.selectedKeyframeId,
    }));
    scheduleAutosave(get, set);
  },

  duplicateClip: (explicitClipId) => {
    const targetId = explicitClipId ?? get().selectedClipId;
    if (!targetId) return null;
    const clip = get().project.clips.find((c) => c.id === targetId);
    if (!clip) return null;

    get().pushHistory();
    const newId = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const copy: TimelineClip = {
      ...clip,
      id: newId,
      name: `${clip.name} (Copy)`,
      startTime: Number((clip.startTime + clip.duration).toFixed(4)),
      crop: { ...clip.crop },
      mask: clip.mask ? { ...clip.mask } : createDefaultMask(),
      effects: { ...clip.effects },
      transitionIn: { ...clip.transitionIn },
      transitionOut: { ...clip.transitionOut },
      textStyle: clip.textStyle ? { ...clip.textStyle } : undefined,
      keyframes: clip.keyframes.map((k) => ({ ...k, id: `${k.id}-c` })),
    };

    set((state) => ({
      project: {
        ...state.project,
        clips: [...state.project.clips, copy],
        updatedAt: Date.now(),
      },
      selectedClipId: newId,
      selectedKeyframeId: copy.keyframes[0]?.id ?? null,
    }));
    scheduleAutosave(get, set);
    return newId;
  },

  updateClipProperties: (clipId, updates, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((c) =>
          c.id === clipId ? { ...c, ...updates } : c
        ),
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  updateClipColorEffects: (clipId, updates, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((c) =>
          c.id === clipId
            ? { ...c, effects: { ...c.effects, ...updates } }
            : c
        ),
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  updateClipCrop: (clipId, updates, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((c) =>
          c.id === clipId ? { ...c, crop: { ...c.crop, ...updates } } : c
        ),
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  updateClipMask: (clipId, updates, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((c) => {
          if (c.id !== clipId) return c;
          const prevMask = c.mask || createDefaultMask();
          return {
            ...c,
            mask: { ...prevMask, ...updates },
          };
        }),
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  updateClipTextStyle: (clipId, updates, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((c) => {
          if (c.id !== clipId || !c.textStyle) return c;
          const nextStyle = { ...c.textStyle, ...updates };
          return {
            ...c,
            name: updates.content ? updates.content.slice(0, 24) : c.name,
            textStyle: nextStyle,
          };
        }),
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  updateClipSpeed: (clipId, newSpeed) => {
    const clip = get().project.clips.find((c) => c.id === clipId);
    if (!clip) return;
    get().pushHistory();
    const updated = changeClipSpeed(clip, newSpeed);
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((c) => (c.id === clipId ? updated : c)),
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  setClipTransition: (clipId, edge, config) => {
    get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((c) => {
          if (c.id !== clipId) return c;
          const safeDur = Math.max(0.1, Math.min(c.duration * 0.8, config.duration));
          return edge === 'in'
            ? { ...c, transitionIn: { type: config.type, duration: safeDur } }
            : { ...c, transitionOut: { type: config.type, duration: safeDur } };
        }),
        updatedAt: Date.now(),
      },
    }));
    scheduleAutosave(get, set);
  },

  setClipKeyframe: (clipId, property, time, value, easing = 'ease-in-out') => {
    get().pushHistory();
    let updatedKfId: string | null = null;
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((c) => {
          if (c.id !== clipId) return c;
          const clampedLocalTime = Number(
            Math.max(0, Math.min(c.duration, time)).toFixed(3)
          );
          const nextKeyframes = upsertKeyframe(
            c.keyframes,
            property,
            clampedLocalTime,
            value,
            easing
          );
          const matched = nextKeyframes.find(
            (k) =>
              k.property === property &&
              Math.abs(k.time - clampedLocalTime) <= 0.035
          );
          if (matched) updatedKfId = matched.id;

          if (
            property === 'maskWidth' ||
            property === 'maskHeight' ||
            property === 'maskX' ||
            property === 'maskY'
          ) {
            const baseMask = c.mask || createDefaultMask();
            const nextShape =
              baseMask.shape === 'none' ? 'rectangle' : baseMask.shape;
            const maskPatch: Partial<MaskSettings> = { shape: nextShape };
            if (property === 'maskWidth') maskPatch.width = value;
            if (property === 'maskHeight') maskPatch.height = value;
            if (property === 'maskX') maskPatch.centerX = value;
            if (property === 'maskY') maskPatch.centerY = value;
            return {
              ...c,
              mask: { ...baseMask, ...maskPatch },
              keyframes: nextKeyframes,
            };
          }

          return {
            ...c,
            [property]: value,
            keyframes: nextKeyframes,
          };
        }),
        updatedAt: Date.now(),
      },
      selectedKeyframeId: updatedKfId ?? state.selectedKeyframeId,
    }));
    scheduleAutosave(get, set);
  },

  updateClipKeyframe: (clipId, keyframeId, updates, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    set((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((c) => {
          if (c.id !== clipId) return c;
          const nextKfs = c.keyframes
            .map((kf) => {
              if (kf.id !== keyframeId) return kf;
              const nextTime =
                updates.time !== undefined
                  ? Number(
                      Math.max(0, Math.min(c.duration, updates.time)).toFixed(3)
                    )
                  : kf.time;
              return {
                ...kf,
                ...updates,
                time: nextTime,
              };
            })
            .sort((a, b) => a.time - b.time);
          return {
            ...c,
            keyframes: nextKfs,
          };
        }),
        updatedAt: Date.now(),
      },
      selectedKeyframeId: keyframeId,
    }));
    scheduleAutosave(get, set);
  },

  removeClipKeyframe: (clipId, keyframeId) => {
    get().pushHistory();
    set((state) => {
      const targetClip = state.project.clips.find((c) => c.id === clipId);
      const remaining = targetClip
        ? targetClip.keyframes.filter((k) => k.id !== keyframeId)
        : [];
      return {
        project: {
          ...state.project,
          clips: state.project.clips.map((c) =>
            c.id === clipId
              ? {
                  ...c,
                  keyframes: c.keyframes.filter((k) => k.id !== keyframeId),
                }
              : c
          ),
          updatedAt: Date.now(),
        },
        selectedKeyframeId:
          state.selectedKeyframeId === keyframeId
            ? remaining[0]?.id ?? null
            : state.selectedKeyframeId,
      };
    });
    scheduleAutosave(get, set);
  },

  setCurrentTime: (time) => {
    const maxDur = Math.max(10, getProjectDuration(get().project.clips) + 2);
    const clamped = Math.max(0, Math.min(maxDur, time));
    set({ currentTime: Number(clamped.toFixed(4)) });
  },

  stepFrames: (deltaFrames) => {
    const { currentTime, project } = get();
    const frameDur = 1 / project.fps;
    const nextTime = snapTimeToFrame(currentTime + deltaFrames * frameDur, project.fps);
    set({ isPlaying: false, currentTime: Math.max(0, nextTime) });
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  togglePlayPause: () => {
    const { isPlaying, currentTime, project } = get();
    const projDur = getProjectDuration(project.clips);
    if (!isPlaying && projDur > 0 && currentTime >= projDur - 0.03) {
      set({ currentTime: 0, isPlaying: true });
    } else {
      set({ isPlaying: !isPlaying });
    }
  },

  setTimelineZoom: (zoom) =>
    set({ timelineZoom: Math.max(20, Math.min(360, Math.round(zoom))) }),

  setCanvasZoom: (zoom) =>
    set({ canvasZoom: Number(Math.max(0.25, Math.min(2.5, zoom)).toFixed(2)) }),

  toggleSafeGuides: () => set((s) => ({ showSafeGuides: !s.showSafeGuides })),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  setActiveSnapTime: (time) => set({ activeSnapTime: time }),
  setActiveLeftTab: (tab) =>
    set(() =>
      tab === 'ai-mcp'
        ? { isAiDrawerOpen: true }
        : { activeLeftTab: tab }
    ),
  setExportModalOpen: (open) => set({ isExportModalOpen: open, isPlaying: false }),
  setProjectModalOpen: (open) => set({ isProjectModalOpen: open, isPlaying: false }),
  setMcpModalOpen: (open) => set({ isMcpModalOpen: open, isPlaying: false }),
  setAiDrawerOpen: (open) => set({ isAiDrawerOpen: open }),
  toggleAiDrawer: () => set((s) => ({ isAiDrawerOpen: !s.isAiDrawerOpen })),
  setMcpBridgeConnected: (connected) => set({ mcpBridgeConnected: connected }),
  setActiveAiProvider: (provider) => set({ activeAiProvider: provider }),
  addMcpLog: (entry) =>
    set((s) => ({
      mcpLogs: [entry, ...s.mcpLogs.slice(0, 49)],
    })),
  clearMcpLogs: () => set({ mcpLogs: [] }),
}));
