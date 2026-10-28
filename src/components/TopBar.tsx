import React, { useState } from 'react';
import {
  Undo2,
  Redo2,
  Save,
  Download,
  FolderKanban,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Sparkles,
  Cpu,
  Layers,
  Search,
  Film,
  Zap,
  Palette,
  Volume2,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { useWorkspaceStore, type WorkspaceId } from '../store/useWorkspaceStore';
import type { AspectRatio, FrameRate, ResolutionPreset } from '../types/editor';

interface WorkspaceTabDef {
  id: WorkspaceId;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}

const WORKSPACE_TABS: WorkspaceTabDef[] = [
  {
    id: 'edit',
    label: 'EDIT',
    icon: <Film className="w-3.5 h-3.5" />,
    shortcut: 'Alt+1',
  },
  {
    id: 'motion',
    label: 'MOTION',
    icon: <Zap className="w-3.5 h-3.5" />,
    shortcut: 'Alt+2',
  },
  {
    id: 'color',
    label: 'COLOR',
    icon: <Palette className="w-3.5 h-3.5" />,
    shortcut: 'Alt+3',
  },
  {
    id: 'audio',
    label: 'AUDIO',
    icon: <Volume2 className="w-3.5 h-3.5" />,
    shortcut: 'Alt+4',
  },
  {
    id: 'ai',
    label: 'AI',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    shortcut: 'Alt+5',
  },
];

export const TopBar: React.FC = () => {
  const {
    project,
    past,
    future,
    saveStatus,
    mcpBridgeConnected,
    isAiDrawerOpen,
    undo,
    redo,
    renameProject,
    setProjectFormat,
    saveCurrentProject,
    setExportModalOpen,
    setProjectModalOpen,
    setMcpModalOpen,
    toggleAiDrawer,
  } = useEditorStore();

  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const toggleCommandPalette = useWorkspaceStore((s) => s.toggleCommandPalette);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(project.name);

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (nameInput.trim() && nameInput.trim() !== project.name) {
      renameProject(nameInput.trim());
    } else {
      setNameInput(project.name);
    }
  };

  return (
    <header className="h-10 bg-[#0B0F16] border-b border-[#2A3341] px-3 flex items-center justify-between gap-3 select-none shrink-0 z-30">
      {/* Left: Brand + Project Switcher + Sequence Name + Save Status */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-2 pr-2 border-r border-[#2A3341] shrink-0">
          <div className="w-5.5 h-5.5 bg-[#141A23] border border-[#2A3341] rounded-md flex items-center justify-center text-[#E8EDF5] shadow-xs">
            <Layers className="w-3.5 h-3.5 text-[#8B82F6] stroke-[2.2]" />
          </div>
          <span className="font-semibold text-[13px] tracking-[-0.02em] text-[#E8EDF5] whitespace-nowrap">
            MotionLab
          </span>
          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-[#141A23] text-[#94A3B8] border border-[#2A3341] rounded whitespace-nowrap">
            4.0
          </span>
        </div>

        <button
          type="button"
          data-testid="open-projects-modal-btn"
          onClick={() => setProjectModalOpen(true)}
          className="h-7 px-2 bg-[#141A23] hover:bg-[#1D2531] border border-[#2A3341] rounded-md flex items-center gap-1.5 text-[11px] font-medium text-[#E8EDF5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Manage Projects (Create, Open, Duplicate, Delete)"
        >
          <FolderKanban className="w-3.5 h-3.5 text-[#8B82F6]" />
          <span className="hidden sm:inline">Projects</span>
        </button>

        {isEditingName ? (
          <input
            type="text"
            data-testid="project-name-input"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') {
                setNameInput(project.name);
                setIsEditingName(false);
              }
            }}
            autoFocus
            className="h-7 px-2 bg-[#0B0F16] border border-[#8B82F6] rounded-md text-xs text-white font-medium focus:outline-none w-36 sm:w-44 shrink-0"
          />
        ) : (
          <button
            type="button"
            data-testid="project-name-display"
            onClick={() => {
              setNameInput(project.name);
              setIsEditingName(true);
            }}
            className="h-7 px-2 hover:bg-[#141A23] border border-transparent hover:border-[#2A3341] rounded-md text-xs font-medium text-[#E8EDF5] flex items-center gap-1.5 transition-colors whitespace-nowrap truncate max-w-[150px] cursor-pointer"
            title="Click to rename sequence"
          >
            <span className="truncate">{project.name}</span>
          </button>
        )}

        {/* Save Status Pill */}
        <div
          data-testid="save-status-indicator"
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#141A23] border border-[#2A3341] text-[10px] text-[#94A3B8] whitespace-nowrap shrink-0"
        >
          {saveStatus === 'saved' && (
            <>
              <CheckCircle2 className="w-3 h-3 text-[#36C6A3] shrink-0" />
              <span className="hidden md:inline">Saved</span>
            </>
          )}
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-3 h-3 text-[#8B82F6] animate-spin shrink-0" />
              <span className="hidden md:inline">Saving</span>
            </>
          )}
          {saveStatus === 'unsaved' && (
            <>
              <AlertCircle className="w-3 h-3 text-[#E8B45A] shrink-0" />
              <span className="hidden md:inline">Unsaved</span>
            </>
          )}
        </div>
      </div>

      {/* Center: 5 Dedicated Workspace Switcher Tabs */}
      <nav
        aria-label="Workspaces"
        className="flex items-center bg-[#141A23] border border-[#2A3341] rounded-lg p-0.5 gap-0.5 shrink-0"
      >
        {WORKSPACE_TABS.map((tab) => {
          const isActive = activeWorkspace === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`workspace-tab-${tab.id}`}
              onClick={() => setActiveWorkspace(tab.id)}
              className={`h-7 px-2.5 rounded-md flex items-center gap-1.5 text-[11px] font-semibold tracking-wide transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#8B82F6] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#E8EDF5] hover:bg-[#1D2531]'
              }`}
              title={`Switch to ${tab.label} Workspace (${tab.shortcut})`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Controls: Format Selectors, History, Command Palette, AI & Export */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Quick Command Palette Button */}
        <button
          type="button"
          data-testid="command-palette-btn"
          onClick={toggleCommandPalette}
          className="h-7 px-2 bg-[#141A23] hover:bg-[#1D2531] border border-[#2A3341] rounded-md flex items-center gap-1 text-[11px] font-medium text-[#94A3B8] hover:text-[#E8EDF5] transition-colors whitespace-nowrap cursor-pointer"
          title="Open Command Palette (Ctrl+K or Cmd+K)"
        >
          <Search className="w-3.5 h-3.5 text-[#8B82F6]" />
          <kbd className="hidden lg:inline text-[9px] font-mono px-1 py-0.2 bg-[#0B0F16] border border-[#2A3341] rounded text-[#94A3B8]">
            ⌘K
          </kbd>
        </button>

        {/* History (Undo / Redo) */}
        <div className="flex items-center bg-[#141A23] border border-[#2A3341] rounded-md p-0.5">
          <button
            type="button"
            data-testid="undo-btn"
            onClick={undo}
            disabled={past.length === 0}
            className="h-6 w-6 flex items-center justify-center text-[#94A3B8] hover:text-[#E8EDF5] hover:bg-[#1D2531] disabled:opacity-30 disabled:pointer-events-none rounded transition-colors cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-[#2A3341]" />
          <button
            type="button"
            data-testid="redo-btn"
            onClick={redo}
            disabled={future.length === 0}
            className="h-6 w-6 flex items-center justify-center text-[#94A3B8] hover:text-[#E8EDF5] hover:bg-[#1D2531] disabled:opacity-30 disabled:pointer-events-none rounded transition-colors cursor-pointer"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Save Button */}
        <button
          type="button"
          data-testid="save-project-btn"
          onClick={() => void saveCurrentProject()}
          className="h-7 px-2 bg-[#141A23] hover:bg-[#1D2531] border border-[#2A3341] rounded-md hidden md:flex items-center gap-1 text-[11px] font-medium text-[#E8EDF5] transition-colors whitespace-nowrap cursor-pointer"
          title="Save Project (Ctrl+S)"
        >
          <Save className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span>Save</span>
        </button>

        {/* Sequence Format Group */}
        <div className="hidden xl:flex items-center bg-[#141A23] border border-[#2A3341] rounded-md px-1 py-0.5 gap-1">
          <select
            aria-label="Aspect Ratio"
            data-testid="aspect-ratio-select"
            value={project.aspectRatio}
            onChange={(e) =>
              setProjectFormat({ aspectRatio: e.target.value as AspectRatio })
            }
            className="h-6 pl-1.5 pr-5 bg-transparent hover:bg-[#1D2531] rounded text-[11px] font-mono text-[#E8EDF5] focus:outline-none cursor-pointer"
          >
            <option value="16:9" className="bg-[#141A23]">16:9</option>
            <option value="9:16" className="bg-[#141A23]">9:16</option>
            <option value="1:1" className="bg-[#141A23]">1:1</option>
            <option value="4:5" className="bg-[#141A23]">4:5</option>
            {project.aspectRatio === 'custom' && (
              <option value="custom" className="bg-[#141A23]">
                {project.customWidth && project.customHeight
                  ? `${project.customWidth}×${project.customHeight}`
                  : 'Custom'}
              </option>
            )}
          </select>

          <div className="w-px h-3.5 bg-[#2A3341]" />

          <select
            aria-label="Resolution"
            data-testid="resolution-select"
            value={project.resolution}
            onChange={(e) =>
              setProjectFormat({
                resolution: e.target.value as ResolutionPreset,
              })
            }
            className="h-6 pl-1.5 pr-5 bg-transparent hover:bg-[#1D2531] rounded text-[11px] font-mono text-[#E8EDF5] focus:outline-none cursor-pointer"
          >
            <option value="1080p" className="bg-[#141A23]">1080p</option>
            <option value="720p" className="bg-[#141A23]">720p</option>
          </select>

          <div className="w-px h-3.5 bg-[#2A3341]" />

          <select
            aria-label="Frame Rate"
            data-testid="fps-select"
            value={project.fps}
            onChange={(e) =>
              setProjectFormat({ fps: Number(e.target.value) as FrameRate })
            }
            className="h-6 pl-1.5 pr-5 bg-transparent hover:bg-[#1D2531] rounded text-[11px] font-mono text-[#E8EDF5] focus:outline-none cursor-pointer"
          >
            <option value={24} className="bg-[#141A23]">24 fps</option>
            <option value={30} className="bg-[#141A23]">30 fps</option>
            <option value={60} className="bg-[#141A23]">60 fps</option>
          </select>
        </div>

        {/* AI Copilot Drawer Toggle */}
        <button
          type="button"
          data-testid="toggle-ai-drawer-btn"
          onClick={toggleAiDrawer}
          className={`h-7 px-2 rounded-md border text-[11px] font-medium flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
            isAiDrawerOpen
              ? 'bg-[#8B82F6]/20 border-[#8B82F6] text-white'
              : 'bg-[#141A23] hover:bg-[#1D2531] border-[#2A3341] text-[#E8EDF5]'
          }`}
          title="Toggle AI & MCP Copilot Drawer"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#8B82F6]" />
          <span className="hidden sm:inline">AI Copilot</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              mcpBridgeConnected ? 'bg-[#36C6A3]' : 'bg-[#8B82F6]'
            }`}
          />
        </button>

        {/* MCP Setup */}
        <button
          type="button"
          data-testid="topbar-mcp-btn"
          onClick={() => setMcpModalOpen(true)}
          className="h-7 px-2 bg-[#141A23] hover:bg-[#1D2531] border border-[#2A3341] text-[#94A3B8] hover:text-[#E8EDF5] font-medium text-[11px] rounded-md hidden lg:flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
          title="MCP Bridge & Server Configuration"
        >
          <Cpu className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span>MCP</span>
        </button>

        {/* Export MP4 Master */}
        <button
          type="button"
          data-testid="open-export-btn"
          onClick={() => setExportModalOpen(true)}
          className="h-7 px-2.5 bg-[#8B82F6] hover:bg-[#7a71f0] text-white font-medium text-[11px] rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-xs cursor-pointer"
          title="Export Sequence to MP4"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};

export default TopBar;
