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
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import type { AspectRatio, FrameRate, ResolutionPreset } from '../types/editor';

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
    <header className="h-11 bg-[#0b0b0e] border-b border-[#1f1f26] px-3.5 flex items-center justify-between gap-3 select-none shrink-0">
      {/* Left: Brand + Workspace / Project Switcher */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-2 pr-2.5 border-r border-[#1f1f26] shrink-0">
          <div className="w-6 h-6 bg-[#18181f] border border-[#2c2c38] rounded-md flex items-center justify-center text-[#f4f4f5] shadow-xs">
            <Layers className="w-3.5 h-3.5 text-[#7c86ff] stroke-[2.2]" />
          </div>
          <span className="font-semibold text-[13px] tracking-[-0.02em] text-[#f4f4f5] whitespace-nowrap">
            MotionLab
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-[#141419] text-[#71717a] border border-[#23232b] rounded whitespace-nowrap">
            Studio
          </span>
        </div>

        <button
          type="button"
          data-testid="open-projects-modal-btn"
          onClick={() => setProjectModalOpen(true)}
          className="h-7 px-2.5 bg-[#141418] hover:bg-[#1c1c22] border border-[#24242c] rounded-md flex items-center gap-1.5 text-[11px] font-medium text-[#d4d4d8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Manage Projects (Create, Open, Duplicate, Delete)"
        >
          <FolderKanban className="w-3.5 h-3.5 text-[#8b93ff]" />
          <span>Projects</span>
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
            className="h-7 px-2.5 bg-[#09090b] border border-[#5e6ad2] rounded-md text-xs text-white font-medium focus:outline-none w-48 shrink-0"
          />
        ) : (
          <button
            type="button"
            data-testid="project-name-display"
            onClick={() => {
              setNameInput(project.name);
              setIsEditingName(true);
            }}
            className="h-7 px-2.5 hover:bg-[#16161b] border border-transparent hover:border-[#24242c] rounded-md text-xs font-medium text-[#f4f4f5] flex items-center gap-1.5 transition-colors whitespace-nowrap truncate max-w-[200px] cursor-pointer"
            title="Click to rename sequence"
          >
            <span className="truncate">{project.name}</span>
          </button>
        )}

        {/* Save Status Pill */}
        <div
          data-testid="save-status-indicator"
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#121216] border border-[#1f1f26] text-[11px] text-[#8e8e98] whitespace-nowrap shrink-0"
        >
          {saveStatus === 'saved' && (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Saved</span>
            </>
          )}
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-3 h-3 text-[#7c86ff] animate-spin shrink-0" />
              <span>Saving</span>
            </>
          )}
          {saveStatus === 'unsaved' && (
            <>
              <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Unsaved</span>
            </>
          )}
        </div>
      </div>

      {/* Center: History & Sequence Format Pill Bar */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center bg-[#121216] border border-[#22222a] rounded-md p-0.5">
          <button
            type="button"
            data-testid="undo-btn"
            onClick={undo}
            disabled={past.length === 0}
            className="h-6 w-6 flex items-center justify-center text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#1c1c23] disabled:opacity-30 disabled:pointer-events-none rounded transition-colors cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-[#22222a]" />
          <button
            type="button"
            data-testid="redo-btn"
            onClick={redo}
            disabled={future.length === 0}
            className="h-6 w-6 flex items-center justify-center text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#1c1c23] disabled:opacity-30 disabled:pointer-events-none rounded transition-colors cursor-pointer"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          data-testid="save-project-btn"
          onClick={() => void saveCurrentProject()}
          className="h-7 px-2.5 bg-[#121216] hover:bg-[#1a1a21] border border-[#22222a] rounded-md flex items-center gap-1.5 text-[11px] font-medium text-[#d4d4d8] transition-colors whitespace-nowrap cursor-pointer"
          title="Save Project (Ctrl+S)"
        >
          <Save className="w-3.5 h-3.5 text-[#71717a]" />
          <span>Save</span>
        </button>

        <div className="h-4 w-px bg-[#1f1f26] mx-0.5" />

        {/* Unified Format Control Group */}
        <div className="flex items-center bg-[#121216] border border-[#22222a] rounded-md px-1 py-0.5 gap-1">
          <select
            aria-label="Aspect Ratio"
            data-testid="aspect-ratio-select"
            value={project.aspectRatio}
            onChange={(e) =>
              setProjectFormat({ aspectRatio: e.target.value as AspectRatio })
            }
            className="h-6 pl-2 pr-6 bg-transparent hover:bg-[#1a1a22] rounded text-[11px] font-mono text-[#e4e4e7] focus:outline-none cursor-pointer"
          >
            <option value="16:9" className="bg-[#121216]">16:9</option>
            <option value="9:16" className="bg-[#121216]">9:16</option>
            <option value="1:1" className="bg-[#121216]">1:1</option>
            <option value="4:5" className="bg-[#121216]">4:5</option>
            {project.aspectRatio === 'custom' && (
              <option value="custom" className="bg-[#121216]">
                {project.customWidth && project.customHeight
                  ? `${project.customWidth}×${project.customHeight}`
                  : 'Custom'}
              </option>
            )}
          </select>

          <div className="w-px h-3.5 bg-[#22222a]" />

          <select
            aria-label="Resolution"
            data-testid="resolution-select"
            value={project.resolution}
            onChange={(e) =>
              setProjectFormat({
                resolution: e.target.value as ResolutionPreset,
              })
            }
            className="h-6 pl-2 pr-6 bg-transparent hover:bg-[#1a1a22] rounded text-[11px] font-mono text-[#e4e4e7] focus:outline-none cursor-pointer"
          >
            <option value="1080p" className="bg-[#121216]">1080p</option>
            <option value="720p" className="bg-[#121216]">720p</option>
          </select>

          <div className="w-px h-3.5 bg-[#22222a]" />

          <select
            aria-label="Frame Rate"
            data-testid="fps-select"
            value={project.fps}
            onChange={(e) =>
              setProjectFormat({ fps: Number(e.target.value) as FrameRate })
            }
            className="h-6 pl-2 pr-6 bg-transparent hover:bg-[#1a1a22] rounded text-[11px] font-mono text-[#e4e4e7] focus:outline-none cursor-pointer"
          >
            <option value={24} className="bg-[#121216]">24 fps</option>
            <option value={30} className="bg-[#121216]">30 fps</option>
            <option value={60} className="bg-[#121216]">60 fps</option>
          </select>
        </div>
      </div>

      {/* Right: AI Copilot Drawer Toggle, MCP Server Config & Export */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          data-testid="toggle-ai-drawer-btn"
          onClick={toggleAiDrawer}
          className={`h-7 px-2.5 rounded-md border text-[11px] font-medium flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
            isAiDrawerOpen
              ? 'bg-[#5e6ad2]/15 border-[#5e6ad2]/60 text-[#c7ceff]'
              : 'bg-[#141418] hover:bg-[#1c1c22] border-[#24242c] text-[#d4d4d8]'
          }`}
          title="Toggle AI & MCP Copilot Drawer (Antigravity, ChatGPT Codex, Claude)"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#8b93ff]" />
          <span>AI Copilot</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              mcpBridgeConnected ? 'bg-emerald-400' : 'bg-[#7c86ff]'
            }`}
          />
        </button>

        <button
          type="button"
          data-testid="topbar-mcp-btn"
          onClick={() => setMcpModalOpen(true)}
          className="h-7 px-2.5 bg-[#141418] hover:bg-[#1c1c22] border border-[#24242c] text-[#a1a1aa] hover:text-[#f4f4f5] font-medium text-[11px] rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          title="MCP Server Setup & Tool Explorer"
        >
          <Cpu className="w-3.5 h-3.5 text-[#71717a]" />
          <span>MCP Bridge</span>
        </button>

        <button
          type="button"
          data-testid="open-export-btn"
          onClick={() => setExportModalOpen(true)}
          className="h-7 px-3 bg-[#5e6ad2] hover:bg-[#6e79de] text-white font-medium text-[11px] rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-xs cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export MP4</span>
        </button>
      </div>
    </header>
  );
};
