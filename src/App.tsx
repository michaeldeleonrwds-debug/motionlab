import React, { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { LeftPanel } from './components/LeftPanel';
import { CenterPreview } from './components/CenterPreview';
import { RightInspector } from './components/RightInspector';
import { TimelinePanel } from './components/TimelinePanel';
import { AiMcpPanel } from './components/AiMcpPanel';
import { ExportModal } from './components/ExportModal';
import { ProjectModal } from './components/ProjectModal';
import { McpConfigModal } from './components/McpConfigModal';
import { useEditorStore } from './store/useEditorStore';
import {
  buildCompactProjectSummary,
  executeMcpToolCall,
  MOTIONLAB_MCP_TOOLS,
} from './engine/mcpEngine';

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

  // Global NLE Keyboard Shortcuts (Section 13)
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
        !state.isMcpModalOpen
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

      // Escape: close active modal or deselect clip
      if (e.key === 'Escape') {
        e.preventDefault();
        if (state.isExportModalOpen) {
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
        state.isMcpModalOpen
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
  }, []);

  return (
    <div
      data-testid="motionlab-app"
      className="h-screen w-screen flex flex-col bg-[#09090b] text-[#f4f4f5] overflow-hidden select-none"
    >
      {/* Top Application Bar */}
      <TopBar />

      {/* Main Workspace: Full-Height Left Sidebar + Center Workspace + Full-Height Right Copilot Drawer */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Full-Height Left Sidebar: Linear Dock + Media / Titles / Audio / SFX / Voice / Color / FX / Bins */}
        <LeftPanel />

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Upper Editor: Center Program Monitor + Right Inspector */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <CenterPreview />
            {!isAiDrawerOpen && <RightInspector />}
          </div>

          {/* Bottom Multitrack Timeline */}
          <TimelinePanel />
        </div>

        {/* Full-Height AI & MCP Copilot Drawer */}
        {isAiDrawerOpen && <AiMcpPanel />}
      </div>

      {/* Modals */}
      <ProjectModal />
      <ExportModal />
      <McpConfigModal />
    </div>
  );
};

export default App;
