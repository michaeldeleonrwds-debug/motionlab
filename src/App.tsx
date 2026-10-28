import React, { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { LeftPanel } from './components/LeftPanel';
import { CenterPreview } from './components/CenterPreview';
import { RightInspector } from './components/RightInspector';
import { TimelinePanel } from './components/TimelinePanel';
import { AiMcpPanel } from './components/AiMcpPanel';
import { VideoFxStudioPanel } from './components/VideoFxStudioPanel';
import { ScopesPanel } from './components/ScopesPanel';
import { SoundFxStudioPanel } from './sfx/SoundFxStudioPanel';
import { VoiceStudioPanel } from './voicebox/VoiceStudioPanel';
import { MemoryVaultPanel } from './components/MemoryVaultPanel';
import { SkillsLibraryPanel } from './components/SkillsLibraryPanel';
import { AudioMeters } from './components/workspace/AudioMeters';
import { SplitResizer } from './components/workspace/SplitResizer';
import { CommandPalette } from './components/workspace/CommandPalette';
import { ExportModal } from './components/ExportModal';
import { ProjectModal } from './components/ProjectModal';
import { McpConfigModal } from './components/McpConfigModal';
import { useEditorStore } from './store/useEditorStore';
import { useWorkspaceStore } from './store/useWorkspaceStore';
import {
  buildCompactProjectSummary,
  executeMcpToolCall,
  MOTIONLAB_MCP_TOOLS,
} from './engine/mcpEngine';
import { Minimize2, Volume2, Mic } from 'lucide-react';

declare global {
  interface Window {
    __MOTIONLAB_MCP__?: {
      tools: typeof MOTIONLAB_MCP_TOOLS;
      callTool: typeof executeMcpToolCall;
      getState: typeof buildCompactProjectSummary;
    };
    __MOTIONLAB_STORE__?: typeof useEditorStore;
  }
}

export const App: React.FC = () => {
  const initFromStorage = useEditorStore((s) => s.initFromStorage);
  const project = useEditorStore((s) => s.project);
  const isAiDrawerOpen = useEditorStore((s) => s.isAiDrawerOpen);

  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const panelSizes = useWorkspaceStore((s) => s.panelSizes);
  const setPanelSize = useWorkspaceStore((s) => s.setPanelSize);
  const resetPanelSizes = useWorkspaceStore((s) => s.resetPanelSizes);
  const isMonitorMaximized = useWorkspaceStore((s) => s.isMonitorMaximized);
  const toggleMonitorMaximized = useWorkspaceStore((s) => s.toggleMonitorMaximized);
  const isCommandPaletteOpen = useWorkspaceStore((s) => s.isCommandPaletteOpen);
  const toggleCommandPalette = useWorkspaceStore((s) => s.toggleCommandPalette);
  const setCommandPaletteOpen = useWorkspaceStore((s) => s.setCommandPaletteOpen);

  // Audio workspace sub-tab: 'sfx' or 'voice'
  const [audioSubTab, setAudioSubTab] = useState<'sfx' | 'voice'>('sfx');

  useEffect(() => {
    void initFromStorage();
  }, [initFromStorage]);

  // Expose window.__MOTIONLAB_MCP__ and connect bidirectional SSE MCP Bridge
  useEffect(() => {
    window.__MOTIONLAB_STORE__ = useEditorStore;
    window.__MOTIONLAB_MCP__ = {
      tools: MOTIONLAB_MCP_TOOLS,
      callTool: executeMcpToolCall,
      getState: buildCompactProjectSummary,
    };

    if (typeof EventSource === 'undefined') return;

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/mcp/bridge-stream');
      es.onopen = () => {
        useEditorStore.getState().setMcpBridgeConnected(true);
      };
      es.onerror = () => {
        useEditorStore.getState().setMcpBridgeConnected(false);
      };
      es.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            type: string;
            requestId?: string;
            toolName?: string;
            args?: Record<string, unknown>;
            source?: string;
          };

          if (msg.type === 'bridge_connected') {
            useEditorStore.getState().setMcpBridgeConnected(true);
            return;
          }

          if (msg.type === 'mcp_tool_call' && msg.requestId && msg.toolName) {
            const t0 = performance.now();
            try {
              const result = await executeMcpToolCall(
                msg.toolName,
                msg.args || {}
              );
              const durationMs = Math.round(performance.now() - t0);
              useEditorStore.getState().addMcpLog({
                id: msg.requestId,
                timestamp: Date.now(),
                source: msg.source || 'mcp-bridge',
                toolName: msg.toolName,
                args: msg.args || {},
                status: 'success',
                resultSummary: JSON.stringify(result).slice(0, 140),
                durationMs,
              });
              await fetch('/api/mcp/bridge-result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  requestId: msg.requestId,
                  result,
                }),
              });
            } catch (err) {
              const errorMsg =
                err instanceof Error ? err.message : 'MCP execution failed';
              await fetch('/api/mcp/bridge-result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  requestId: msg.requestId,
                  result: { ok: false, error: errorMsg },
                }),
              });
            }
          }
        } catch {
          // Ignore malformed bridge events
        }
      };
    } catch {
      // Ignore SSE errors in unit test environment
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  // Keep server-side MCP resource state synchronized with browser timeline edits
  useEffect(() => {
    const summary = buildCompactProjectSummary();
    fetch('/api/mcp/sync-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: summary }),
    }).catch(() => {});
  }, [project]);

  // Global NLE Keyboard Shortcuts & Workspace Switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inputType =
        target && target.tagName === 'INPUT'
          ? ((target as HTMLInputElement).type || 'text').toLowerCase()
          : '';

      const isTextTypingTarget = Boolean(
        target &&
          (target.tagName === 'TEXTAREA' ||
            target.isContentEditable ||
            (target.tagName === 'INPUT' &&
              ['text', 'search', 'url', 'email', 'password'].includes(inputType)))
      );

      const isAnyInputTarget = Boolean(
        target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
      );

      // Ctrl/Cmd + K: Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // Alt + 1..5: Workspace Switching
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveWorkspace('edit');
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          setActiveWorkspace('motion');
          return;
        }
        if (e.key === '3') {
          e.preventDefault();
          setActiveWorkspace('color');
          return;
        }
        if (e.key === '4') {
          e.preventDefault();
          setActiveWorkspace('audio');
          return;
        }
        if (e.key === '5') {
          e.preventDefault();
          setActiveWorkspace('ai');
          return;
        }
      }

      // Ctrl/Cmd + S always saves even inside inputs
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void useEditorStore.getState().saveCurrentProject();
        return;
      }

      const state = useEditorStore.getState();

      // Space: Play / Pause anywhere unless actively typing in a text field or modal is open
      if (
        (e.code === 'Space' || e.key === ' ') &&
        !isTextTypingTarget &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !state.isExportModalOpen &&
        !state.isProjectModalOpen &&
        !state.isMcpModalOpen &&
        !isCommandPaletteOpen
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (
          target &&
          (target.tagName === 'BUTTON' ||
            target.tagName === 'SELECT' ||
            target.tagName === 'INPUT')
        ) {
          target.blur();
        }
        state.togglePlayPause();
        return;
      }

      if (isAnyInputTarget) {
        if (e.key === 'Escape' && target) {
          target.blur();
        }
        return;
      }

      // Escape: close active modal, command palette, maximized preview, or deselect clip
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isCommandPaletteOpen) {
          setCommandPaletteOpen(false);
        } else if (isMonitorMaximized) {
          toggleMonitorMaximized();
        } else if (state.isExportModalOpen) {
          state.setExportModalOpen(false);
        } else if (state.isProjectModalOpen) {
          state.setProjectModalOpen(false);
        } else if (state.isMcpModalOpen) {
          state.setMcpModalOpen(false);
        } else {
          state.selectClip(null);
        }
        return;
      }

      // Do not trigger timeline shortcuts while a modal is open
      if (
        state.isExportModalOpen ||
        state.isProjectModalOpen ||
        state.isMcpModalOpen ||
        isCommandPaletteOpen
      ) {
        return;
      }

      // S: Split at playhead
      if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        state.splitSelectedClipAtPlayhead();
        return;
      }

      // Delete or Backspace: Delete selected clip
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        state.deleteClip();
        return;
      }

      // Ctrl/Cmd + Shift + Z or Ctrl + Y: Redo
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        state.redo();
        return;
      }

      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        state.undo();
        return;
      }

      // Left / Right Arrow: Frame stepping
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        state.stepFrames(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        state.stepFrames(1);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    isCommandPaletteOpen,
    isMonitorMaximized,
    setActiveWorkspace,
    setCommandPaletteOpen,
    toggleCommandPalette,
    toggleMonitorMaximized,
  ]);

  return (
    <div
      data-testid="motionlab-app"
      className="h-screen w-screen flex flex-col bg-[#0B0F16] text-[#E8EDF5] overflow-hidden select-none"
    >
      {/* Top Application Bar */}
      <TopBar />

      {/* Main Production Workspace Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Full-Screen Maximized Program Monitor Mode */}
        {isMonitorMaximized ? (
          <div className="flex-1 flex flex-col h-full relative bg-[#070A0F]">
            <CenterPreview />
            <button
              type="button"
              onClick={toggleMonitorMaximized}
              className="absolute top-12 right-4 z-40 bg-[#141A23]/90 hover:bg-[#1D2531] border border-[#2A3341] text-[#E8EDF5] px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xl cursor-pointer backdrop-blur-xs"
              title="Exit Maximized View (Esc)"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Restore Workspace (Esc)</span>
            </button>
          </div>
        ) : (
          <>
            {/* 1. EDIT WORKSPACE: Left Sidebar + Center Monitor + Right Inspector + Bottom Timeline */}
            {activeWorkspace === 'edit' && (
              <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
                <LeftPanel />
                <SplitResizer
                  direction="horizontal"
                  onResize={(delta) =>
                    setPanelSize(
                      'leftSidebarWidth',
                      panelSizes.leftSidebarWidth + delta
                    )
                  }
                  onReset={resetPanelSizes}
                />

                <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
                  <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
                    <CenterPreview />
                    {!isAiDrawerOpen && (
                      <>
                        <SplitResizer
                          direction="horizontal"
                          onResize={(delta) =>
                            setPanelSize(
                              'rightInspectorWidth',
                              panelSizes.rightInspectorWidth - delta
                            )
                          }
                          onReset={resetPanelSizes}
                        />
                        <RightInspector />
                      </>
                    )}
                  </div>

                  <SplitResizer
                    direction="vertical"
                    onResize={(delta) =>
                      setPanelSize(
                        'timelineHeight',
                        panelSizes.timelineHeight - delta
                      )
                    }
                    onReset={resetPanelSizes}
                  />
                  <TimelinePanel />
                </div>
              </div>
            )}

            {/* 2. MOTION WORKSPACE: Left Motion/Titles + Center Monitor + Right Motion Inspector + Bottom Timeline */}
            {activeWorkspace === 'motion' && (
              <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
                <LeftPanel />
                <SplitResizer
                  direction="horizontal"
                  onResize={(delta) =>
                    setPanelSize(
                      'leftSidebarWidth',
                      panelSizes.leftSidebarWidth + delta
                    )
                  }
                  onReset={resetPanelSizes}
                />

                <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
                  <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
                    <CenterPreview />
                    {!isAiDrawerOpen && (
                      <>
                        <SplitResizer
                          direction="horizontal"
                          onResize={(delta) =>
                            setPanelSize(
                              'rightInspectorWidth',
                              panelSizes.rightInspectorWidth - delta
                            )
                          }
                          onReset={resetPanelSizes}
                        />
                        <RightInspector />
                      </>
                    )}
                  </div>

                  <SplitResizer
                    direction="vertical"
                    onResize={(delta) =>
                      setPanelSize(
                        'timelineHeight',
                        panelSizes.timelineHeight - delta
                      )
                    }
                    onReset={resetPanelSizes}
                  />
                  <TimelinePanel />
                </div>
              </div>
            )}

            {/* 3. COLOR WORKSPACE: Center Monitor + Right Video FX Studio + Bottom Video Scopes */}
            {activeWorkspace === 'color' && (
              <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
                <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
                  <CenterPreview />
                  <SplitResizer
                    direction="horizontal"
                    onResize={(delta) =>
                      setPanelSize(
                        'rightInspectorWidth',
                        panelSizes.rightInspectorWidth - delta
                      )
                    }
                    onReset={resetPanelSizes}
                  />
                  <div
                    style={{
                      width: `${Math.max(380, panelSizes.rightInspectorWidth)}px`,
                    }}
                    className="flex shrink-0 h-full overflow-hidden bg-[#141A23] border-l border-[#2A3341]"
                  >
                    <VideoFxStudioPanel />
                  </div>
                </div>

                <SplitResizer
                  direction="vertical"
                  onResize={(delta) =>
                    setPanelSize(
                      'timelineHeight',
                      panelSizes.timelineHeight - delta
                    )
                  }
                  onReset={resetPanelSizes}
                />
                <div
                  style={{ height: `${panelSizes.timelineHeight}px` }}
                  className="bg-[#0B0F16] border-t border-[#2A3341] flex flex-col shrink-0 overflow-hidden"
                >
                  <ScopesPanel />
                </div>
              </div>
            )}

            {/* 4. AUDIO WORKSPACE: Left Sound & Voice Studio + Center Monitor + Stereo Meters + Right Audio DSP + Bottom Timeline */}
            {activeWorkspace === 'audio' && (
              <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
                {/* Left Sound FX & Voice Studio Panel with Tabs */}
                <div
                  style={{
                    width: `${Math.max(380, panelSizes.leftSidebarWidth)}px`,
                  }}
                  className="flex flex-col h-full bg-[#141A23] border-r border-[#2A3341] shrink-0 overflow-hidden"
                >
                  {/* Top Tab Switcher */}
                  <div className="h-9 px-3 border-b border-[#2A3341] bg-[#0B0F16] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-1 bg-[#141A23] border border-[#2A3341] rounded-md p-0.5">
                      <button
                        type="button"
                        onClick={() => setAudioSubTab('sfx')}
                        className={`h-6 px-2.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                          audioSubTab === 'sfx'
                            ? 'bg-[#8B82F6] text-white'
                            : 'text-[#94A3B8] hover:text-[#E8EDF5]'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Sound FX</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAudioSubTab('voice')}
                        className={`h-6 px-2.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                          audioSubTab === 'voice'
                            ? 'bg-[#8B82F6] text-white'
                            : 'text-[#94A3B8] hover:text-[#E8EDF5]'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>Voice Studio</span>
                      </button>
                    </div>
                    <span className="text-[10px] font-mono text-[#94A3B8]">
                      {audioSubTab === 'sfx' ? 'Soundbox AI' : 'Kokoro Neural TTS'}
                    </span>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    {audioSubTab === 'sfx' ? (
                      <SoundFxStudioPanel />
                    ) : (
                      <VoiceStudioPanel />
                    )}
                  </div>
                </div>

                <SplitResizer
                  direction="horizontal"
                  onResize={(delta) =>
                    setPanelSize(
                      'leftSidebarWidth',
                      panelSizes.leftSidebarWidth + delta
                    )
                  }
                  onReset={resetPanelSizes}
                />

                <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
                  <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
                    <CenterPreview />

                    {/* Master Stereo Peak & RMS Meter Column */}
                    <div className="w-44 bg-[#141A23] border-l border-[#2A3341] p-2.5 flex flex-col shrink-0 justify-center overflow-hidden">
                      <AudioMeters />
                    </div>

                    <SplitResizer
                      direction="horizontal"
                      onResize={(delta) =>
                        setPanelSize(
                          'rightInspectorWidth',
                          panelSizes.rightInspectorWidth - delta
                        )
                      }
                      onReset={resetPanelSizes}
                    />
                    <RightInspector />
                  </div>

                  <SplitResizer
                    direction="vertical"
                    onResize={(delta) =>
                      setPanelSize(
                        'timelineHeight',
                        panelSizes.timelineHeight - delta
                      )
                    }
                    onReset={resetPanelSizes}
                  />
                  <TimelinePanel />
                </div>
              </div>
            )}

            {/* 5. AI WORKSPACE: Left MCIE Skills + Center AI Copilot + Right Memory Vault */}
            {activeWorkspace === 'ai' && (
              <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
                {/* Left MCIE Skills Library */}
                <div
                  style={{
                    width: `${panelSizes.leftSidebarWidth}px`,
                  }}
                  className="h-full bg-[#141A23] border-r border-[#2A3341] flex flex-col shrink-0 overflow-hidden"
                >
                  <SkillsLibraryPanel />
                </div>

                <SplitResizer
                  direction="horizontal"
                  onResize={(delta) =>
                    setPanelSize(
                      'leftSidebarWidth',
                      panelSizes.leftSidebarWidth + delta
                    )
                  }
                  onReset={resetPanelSizes}
                />

                {/* Center AI Copilot */}
                <div className="flex-1 h-full overflow-hidden bg-[#0B0F16] flex flex-col min-w-0">
                  <AiMcpPanel />
                </div>

                <SplitResizer
                  direction="horizontal"
                  onResize={(delta) =>
                    setPanelSize(
                      'rightInspectorWidth',
                      panelSizes.rightInspectorWidth - delta
                    )
                  }
                  onReset={resetPanelSizes}
                />

                {/* Right Obsidian Memory Vault & Graphify */}
                <div
                  style={{
                    width: `${Math.max(380, panelSizes.rightInspectorWidth)}px`,
                  }}
                  className="h-full bg-[#141A23] border-l border-[#2A3341] flex flex-col shrink-0 overflow-hidden"
                >
                  <MemoryVaultPanel />
                </div>
              </div>
            )}

            {/* Full-Height Right AI & MCP Copilot Drawer (accessible from edit/motion/color/audio) */}
            {isAiDrawerOpen && activeWorkspace !== 'ai' && (
              <div className="w-[420px] h-full shrink-0 border-l border-[#2A3341] bg-[#141A23] flex flex-col overflow-hidden z-30 shadow-2xl">
                <AiMcpPanel />
              </div>
            )}
          </>
        )}
      </div>

      {/* Global Command Palette (Cmd/Ctrl + K) */}
      <CommandPalette />

      {/* Modals */}
      <ProjectModal />
      <ExportModal />
      <McpConfigModal />
    </div>
  );
};

export default App;
