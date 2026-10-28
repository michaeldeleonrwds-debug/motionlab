/**
 * MotionLab 4.0 — Workspace Layout Store
 * Decoupled workspace layout state: active workspace, resizable panel dimensions,
 * collapsed panel states, monitor zoom modes, and track height presets.
 * Persists layout preferences across sessions without polluting video project files.
 */

import { create } from 'zustand';

export type WorkspaceId = 'edit' | 'motion' | 'color' | 'audio' | 'ai';

export type MonitorZoomMode = 'fit' | 'fill' | '25' | '50' | '100' | '200';

export type TimelineDensity = 'compact' | 'standard' | 'expanded';

export interface WorkspacePanelSizes {
  leftSidebarWidth: number;
  rightInspectorWidth: number;
  timelineHeight: number;
}

export interface WorkspaceCollapsedState {
  leftSidebar: boolean;
  rightInspector: boolean;
  timeline: boolean;
  aiDrawer: boolean;
}

interface WorkspaceState {
  // Active workspace mode
  activeWorkspace: WorkspaceId;
  setActiveWorkspace: (workspace: WorkspaceId) => void;

  // Panel dimensions (per-workspace customization)
  panelSizes: WorkspacePanelSizes;
  setPanelSize: (panel: keyof WorkspacePanelSizes, size: number) => void;
  resetPanelSizes: () => void;

  // Panel collapsed toggles
  collapsed: WorkspaceCollapsedState;
  togglePanelCollapsed: (panel: keyof WorkspaceCollapsedState) => void;
  setPanelCollapsed: (panel: keyof WorkspaceCollapsedState, collapsed: boolean) => void;

  // Program monitor display state
  monitorZoom: MonitorZoomMode;
  setMonitorZoom: (zoom: MonitorZoomMode) => void;
  isMonitorMaximized: boolean;
  toggleMonitorMaximized: () => void;

  // Timeline display state
  timelineDensity: TimelineDensity;
  setTimelineDensity: (density: TimelineDensity) => void;

  // Command Palette (Cmd/Ctrl + K)
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;

  // Effects Browser sub-tab state
  effectsFilterCategory: string;
  setEffectsFilterCategory: (category: string) => void;
}

const STORAGE_KEY = 'motionlab_workspace_layout_v4';

const DEFAULT_PANEL_SIZES: WorkspacePanelSizes = {
  leftSidebarWidth: 340,
  rightInspectorWidth: 320,
  timelineHeight: 310,
};

const DEFAULT_COLLAPSED: WorkspaceCollapsedState = {
  leftSidebar: false,
  rightInspector: false,
  timeline: false,
  aiDrawer: false,
};

function loadSavedLayout(): {
  workspace?: WorkspaceId;
  panelSizes?: WorkspacePanelSizes;
  timelineDensity?: TimelineDensity;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore storage parse error
  }
  return {};
}

function saveLayout(data: {
  workspace: WorkspaceId;
  panelSizes: WorkspacePanelSizes;
  timelineDensity: TimelineDensity;
}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage write error
  }
}

const initialSaved = loadSavedLayout();

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeWorkspace: initialSaved.workspace || 'edit',
  setActiveWorkspace: (workspace: WorkspaceId) => {
    set((state) => {
      // Auto-adjust default panels for specific workspaces
      const newCollapsed = { ...state.collapsed };
      if (workspace === 'color') {
        newCollapsed.leftSidebar = false;
        newCollapsed.rightInspector = false;
      } else if (workspace === 'ai') {
        newCollapsed.aiDrawer = false;
      }

      saveLayout({
        workspace,
        panelSizes: state.panelSizes,
        timelineDensity: state.timelineDensity,
      });

      return { activeWorkspace: workspace, collapsed: newCollapsed };
    });
  },

  panelSizes: {
    ...DEFAULT_PANEL_SIZES,
    ...(initialSaved.panelSizes || {}),
  },

  setPanelSize: (panel, size) => {
    set((state) => {
      let clamped = size;
      if (panel === 'leftSidebarWidth') clamped = Math.min(560, Math.max(260, size));
      if (panel === 'rightInspectorWidth') clamped = Math.min(500, Math.max(260, size));
      if (panel === 'timelineHeight') clamped = Math.min(600, Math.max(160, size));

      const newSizes = { ...state.panelSizes, [panel]: clamped };
      saveLayout({
        workspace: state.activeWorkspace,
        panelSizes: newSizes,
        timelineDensity: state.timelineDensity,
      });
      return { panelSizes: newSizes };
    });
  },

  resetPanelSizes: () => {
    set({ panelSizes: DEFAULT_PANEL_SIZES });
  },

  collapsed: DEFAULT_COLLAPSED,

  togglePanelCollapsed: (panel) => {
    set((state) => ({
      collapsed: {
        ...state.collapsed,
        [panel]: !state.collapsed[panel],
      },
    }));
  },

  setPanelCollapsed: (panel, collapsed) => {
    set((state) => ({
      collapsed: {
        ...state.collapsed,
        [panel]: collapsed,
      },
    }));
  },

  monitorZoom: 'fit',
  setMonitorZoom: (zoom) => set({ monitorZoom: zoom }),

  isMonitorMaximized: false,
  toggleMonitorMaximized: () =>
    set((state) => ({ isMonitorMaximized: !state.isMonitorMaximized })),

  timelineDensity: initialSaved.timelineDensity || 'standard',
  setTimelineDensity: (density) => {
    set((state) => {
      saveLayout({
        workspace: state.activeWorkspace,
        panelSizes: state.panelSizes,
        timelineDensity: density,
      });
      return { timelineDensity: density };
    });
  },

  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  toggleCommandPalette: () =>
    set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),

  effectsFilterCategory: 'all',
  setEffectsFilterCategory: (category) => set({ effectsFilterCategory: category }),
}));
