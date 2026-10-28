import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Sparkles,
  Terminal,
  CheckCircle2,
  KeyRound,
  Play,
  Code2,
  Trash2,
  X,
  Bot,
  Database,
  Layers,
} from 'lucide-react';
import {
  useEditorStore,
  type AiProviderId,
} from '../store/useEditorStore';
import {
  buildCompactProjectSummary,
  executeMcpToolCall,
  MOTIONLAB_MCP_TOOLS,
  planAutonomousMcpStepsFromPrompt,
} from '../engine/mcpEngine';
import { MemoryVaultPanel } from './MemoryVaultPanel';
import { SkillsLibraryPanel } from './SkillsLibraryPanel';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  provider: AiProviderId;
  text: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    status: 'success' | 'error';
  }>;
  timestamp: number;
}

const PROVIDERS: Array<{
  id: AiProviderId;
  name: string;
  shortName: string;
  badge: string;
  defaultModel: string;
  dotColor: string;
}> = [
  {
    id: 'antigravity',
    name: 'Antigravity',
    shortName: 'Antigravity',
    badge: 'Google DeepMind',
    defaultModel: 'gemini-2.5-flash',
    dotColor: 'bg-[#7c86ff]',
  },
  {
    id: 'chatgpt-codex',
    name: 'ChatGPT (Codex)',
    shortName: 'ChatGPT Codex',
    badge: 'OpenAI Tool Use',
    defaultModel: 'gpt-4o',
    dotColor: 'bg-emerald-400',
  },
  {
    id: 'claude',
    name: 'Claude',
    shortName: 'Claude',
    badge: 'Anthropic MCP',
    defaultModel: 'claude-3-7-sonnet-latest',
    dotColor: 'bg-amber-400',
  },
  {
    id: 'custom',
    name: 'Other AI / Local',
    shortName: 'Local / Custom',
    badge: 'OpenRouter / Ollama',
    defaultModel: 'deepseek-chat',
    dotColor: 'bg-purple-400',
  },
];

const QUICK_AI_PROMPTS = [
  {
    label: 'Auto-Assemble Commercial Cut',
    prompt:
      'Assemble a complete commercial sequence with studio media, trim the first clip to 2s, add a cross dissolve transition, overlay title "MOTIONLAB AI CUT", and mix background audio.',
  },
  {
    label: 'Add Typewriter Title',
    prompt: 'Add a typewriter title "DIRECTOR CUT // SCENE 01" onto the timeline.',
  },
  {
    label: 'Apply Cross Dissolve',
    prompt: 'Apply a cross dissolve transition between the video clips.',
  },
  {
    label: 'Monochrome Noir Grade',
    prompt: 'Apply a monochrome noir black and white high contrast grade to the selected clip.',
  },
];

export const AiMcpPanel: React.FC = () => {
  const {
    activeAiProvider,
    setActiveAiProvider,
    mcpBridgeConnected,
    mcpLogs,
    addMcpLog,
    clearMcpLogs,
    setMcpModalOpen,
    setAiDrawerOpen,
  } = useEditorStore();

  const chatStreamRef = useRef<HTMLDivElement>(null);
  const [promptInput, setPromptInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState(
    'http://localhost:11434/v1/chat/completions'
  );
  const [modelName, setModelName] = useState('gemini-2.5-flash');
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'vault' | 'skills'>('chat');
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      provider: 'antigravity',
      text: 'MotionLab MCP Copilot ready (20 timeline tools registered). Select Antigravity, ChatGPT (Codex), Claude, or a local LLM to edit your sequence.',
      timestamp: Date.now(),
    },
  ]);

  useEffect(() => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
    }
  }, [messages]);

  const currentProviderMeta =
    PROVIDERS.find((p) => p.id === activeAiProvider) || PROVIDERS[0];

  const handleProviderSelect = (id: AiProviderId) => {
    setActiveAiProvider(id);
    const found = PROVIDERS.find((p) => p.id === id);
    if (found) setModelName(found.defaultModel);
  };

  const handleSendPrompt = async (explicitPrompt?: string) => {
    const text = (explicitPrompt ?? promptInput).trim();
    if (!text || isBusy) return;

    if (!explicitPrompt) setPromptInput('');
    setIsBusy(true);

    const userMsg: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      provider: activeAiProvider,
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      let plannedCalls: Array<{
        name: string;
        arguments: Record<string, unknown>;
      }> = [];
      let assistantReply = '';

      if (apiKey.trim().length > 5) {
        const providerKey =
          activeAiProvider === 'chatgpt-codex'
            ? 'openai'
            : activeAiProvider === 'claude'
              ? 'anthropic'
              : activeAiProvider === 'antigravity'
                ? 'gemini'
                : 'custom';

        const res = await fetch('/api/mcp/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: providerKey,
            apiKey: apiKey.trim(),
            model: modelName,
            endpoint: customEndpoint,
            prompt: text,
            projectState: buildCompactProjectSummary(),
            tools: MOTIONLAB_MCP_TOOLS,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'External AI provider call failed');
        }
        plannedCalls = data.toolCalls || [];
        assistantReply = data.reply || 'Completed MCP tool execution.';
      } else {
        const planned = planAutonomousMcpStepsFromPrompt(text);
        plannedCalls = planned.calls;
        assistantReply = `[${currentProviderMeta.name} MCP Agent] ${planned.explanation}`;
      }

      const executedCalls: NonNullable<ChatTurn['toolCalls']> = [];

      for (const call of plannedCalls) {
        const t0 = performance.now();
        try {
          const result = await executeMcpToolCall(call.name, call.arguments);
          const durationMs = Math.round(performance.now() - t0);
          executedCalls.push({
            name: call.name,
            arguments: call.arguments,
            status: 'success',
          });
          addMcpLog({
            id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: Date.now(),
            source: activeAiProvider,
            toolName: call.name,
            args: call.arguments,
            status: 'success',
            resultSummary: JSON.stringify(result).slice(0, 140),
            durationMs,
          });
        } catch (err) {
          const durationMs = Math.round(performance.now() - t0);
          executedCalls.push({
            name: call.name,
            arguments: call.arguments,
            status: 'error',
          });
          addMcpLog({
            id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: Date.now(),
            source: activeAiProvider,
            toolName: call.name,
            args: call.arguments,
            status: 'error',
            resultSummary:
              err instanceof Error ? err.message : 'Execution error',
            durationMs,
          });
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          provider: activeAiProvider,
          text: assistantReply,
          toolCalls: executedCalls,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          provider: activeAiProvider,
          text:
            err instanceof Error
              ? `Error: ${err.message}`
              : 'Failed to run AI MCP command.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <aside
      data-testid="ai-mcp-panel"
      className="w-[376px] border-l border-[#1f1f26] bg-[#0b0b0e] flex flex-col h-full shrink-0 select-none overflow-hidden"
    >
      {/* Top Drawer Header */}
      <div className="h-10 px-3.5 border-b border-[#1f1f26] flex items-center justify-between gap-2 shrink-0 bg-[#0d0d12]">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded bg-[#5e6ad2]/15 border border-[#5e6ad2]/40 flex items-center justify-center shrink-0">
            <Sparkles className="w-3 h-3 text-[#8b93ff]" />
          </div>
          <span className="text-xs font-semibold tracking-tight text-[#f4f4f5] whitespace-nowrap">
            AI Copilot
          </span>
          <span
            data-testid="mcp-bridge-status-badge"
            className="px-1.5 py-0.5 text-[10px] font-mono rounded-full bg-[#14141a] border border-[#252530] text-[#a1a1aa] flex items-center gap-1 whitespace-nowrap"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                mcpBridgeConnected ? 'bg-emerald-400' : 'bg-[#7c86ff]'
              }`}
            />
            MCP Ready
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            data-testid="open-mcp-config-btn"
            onClick={() => setMcpModalOpen(true)}
            className="h-6 px-2 bg-[#16161d] hover:bg-[#20202a] border border-[#272732] text-[11px] font-medium text-[#d4d4d8] rounded-md flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
            title="Configure External MCP Clients (Antigravity, Claude, ChatGPT Codex) & Run Tools"
          >
            <Terminal className="w-3 h-3 text-[#8b93ff]" />
            <span>MCP Setup</span>
          </button>

          <button
            type="button"
            onClick={() => setAiDrawerOpen(false)}
            className="h-6 w-6 rounded-md bg-[#16161d] hover:bg-[#20202a] border border-[#272732] text-[#8e8e98] hover:text-[#f4f4f5] flex items-center justify-center transition-colors cursor-pointer"
            title="Close AI Copilot & Return to Clip Inspector"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sub Tabs: Copilot Chat vs Memory & Knowledge Vault */}
      <div className="h-8 px-2 border-b border-[#1f1f26] bg-[#111116] flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setActiveSubTab('chat')}
          className={`flex-1 py-1 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'chat'
              ? 'bg-[#1e1e28] text-[#f4f4f5] shadow-xs'
              : 'text-[#8e8e98] hover:text-[#d4d4d8]'
          }`}
        >
          <Sparkles className="w-3 h-3 text-[#8b93ff]" />
          <span>Copilot</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('vault')}
          className={`flex-1 py-1 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'vault'
              ? 'bg-[#1e1e28] text-[#D7E83F] shadow-xs'
              : 'text-[#8e8e98] hover:text-[#d4d4d8]'
          }`}
        >
          <Database className="w-3 h-3 text-[#D7E83F]" />
          <span>Memory Vault</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('skills')}
          className={`flex-1 py-1 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'skills'
              ? 'bg-[#1e1e28] text-purple-300 shadow-xs'
              : 'text-[#8e8e98] hover:text-[#d4d4d8]'
          }`}
        >
          <Layers className="w-3 h-3 text-purple-400" />
          <span>Skills</span>
        </button>
      </div>

      {activeSubTab === 'vault' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <MemoryVaultPanel />
        </div>
      ) : activeSubTab === 'skills' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <SkillsLibraryPanel />
        </div>
      ) : (
        <>
      {/* Compact Segmented AI Provider Bar + Model Config */}
      <div className="p-3 border-b border-[#1f1f26] space-y-2 shrink-0 bg-[#0d0d11]">
        <div className="grid grid-cols-2 gap-1.5">
          {PROVIDERS.map((p) => {
            const isSelected = activeAiProvider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                data-testid={`ai-provider-btn-${p.id}`}
                onClick={() => handleProviderSelect(p.id)}
                className={`px-2.5 py-1.5 rounded-md border text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                  isSelected
                    ? 'bg-[#171721] border-[#5e6ad2]/70 text-[#f4f4f5] shadow-xs'
                    : 'bg-[#111116] border-[#1f1f27] text-[#8e8e98] hover:text-[#d4d4d8] hover:border-[#2a2a35]'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-medium truncate whitespace-nowrap">
                    {p.shortName}
                  </div>
                  <div className="text-[9px] font-mono text-[#71717a] truncate whitespace-nowrap">
                    {p.badge}
                  </div>
                </div>
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isSelected ? p.dotColor : 'bg-[#272730]'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Model & Optional API Key Toggle */}
        <div className="flex items-center justify-between px-2 py-1 rounded-md bg-[#111116] border border-[#1f1f27]">
          <span className="text-[10px] font-mono text-[#8e8e98] truncate">
            Model: <strong className="text-[#e4e4e7] font-normal">{modelName}</strong>
          </span>
          <button
            type="button"
            data-testid="toggle-ai-key-config-btn"
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            className="text-[10px] font-medium text-[#8b93ff] hover:text-[#a5acff] flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            <KeyRound className="w-3 h-3" />
            <span>{showKeyConfig ? 'Hide Key' : 'API Key'}</span>
          </button>
        </div>

        {showKeyConfig && (
          <div className="p-2.5 rounded-md bg-[#111116] border border-[#24242e] space-y-2 text-[11px]">
            <div>
              <label className="block text-[10px] text-[#8e8e98] mb-1">
                Model ID ({currentProviderMeta.name})
              </label>
              <input
                type="text"
                data-testid="ai-model-input"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full h-7 px-2 bg-[#09090b] border border-[#272732] rounded text-[11px] font-mono text-[#f4f4f5] focus:outline-none focus:border-[#5e6ad2]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#8e8e98] mb-1">
                API Key (Optional — blank uses built-in local MCP planner)
              </label>
              <input
                type="password"
                data-testid="ai-api-key-input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-... / AIza... / sk-ant-..."
                className="w-full h-7 px-2 bg-[#09090b] border border-[#272732] rounded text-[11px] font-mono text-[#f4f4f5] focus:outline-none focus:border-[#5e6ad2]"
              />
            </div>
            {activeAiProvider === 'custom' && (
              <div>
                <label className="block text-[10px] text-[#8e8e98] mb-1">
                  OpenAI-Compatible Endpoint URL
                </label>
                <input
                  type="text"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  className="w-full h-7 px-2 bg-[#09090b] border border-[#272732] rounded text-[11px] font-mono text-[#f4f4f5] focus:outline-none focus:border-[#5e6ad2]"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spacious Scrollable Chat & MCP Execution Feed */}
      <div
        ref={chatStreamRef}
        data-testid="ai-chat-stream"
        className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 bg-[#09090c]"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg p-3 space-y-2 border ${
              m.role === 'user'
                ? 'bg-[#161722] border-[#2b2d42] text-[#f4f4f5] ml-5'
                : 'bg-[#111116] border-[#1f1f27] text-[#d4d4d8] mr-2'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-mono text-[#71717a]">
              <span className="flex items-center gap-1.5 font-medium text-[#a1a1aa]">
                <Bot className="w-3 h-3 text-[#8b93ff]" />
                {m.role === 'user' ? 'You' : `${m.provider.toUpperCase()} • MCP`}
              </span>
              <span>
                {new Date(m.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>

            <div className="text-xs leading-relaxed text-[#e4e4e7]">{m.text}</div>

            {m.toolCalls && m.toolCalls.length > 0 && (
              <div className="pt-2 space-y-1.5 border-t border-[#1f1f27]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#71717a]">
                  Executed MCP Tool Calls ({m.toolCalls.length})
                </div>
                {m.toolCalls.map((tc, idx) => (
                  <div
                    key={idx}
                    data-testid={`executed-mcp-call-${tc.name}`}
                    className="px-2.5 py-1.5 bg-[#0b0b0f] border border-[#22222c] rounded-md flex items-center justify-between text-[11px] font-mono"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[#e4e4e7] truncate">{tc.name}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ml-2 shrink-0">
                      200 OK
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Live MCP Call Audit Bar */}
      {mcpLogs.length > 0 && (
        <div className="px-3.5 py-1.5 bg-[#0e0e13] border-t border-[#1f1f26] flex items-center justify-between text-[10px] font-mono text-[#8e8e98] shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <Code2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">
              {mcpLogs.length} calls executed • Latest: {mcpLogs[0].toolName}
            </span>
          </div>
          <button
            type="button"
            onClick={clearMcpLogs}
            className="text-[#71717a] hover:text-rose-400 p-0.5 cursor-pointer"
            title="Clear MCP Log"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Bottom Quick Actions + Prompt Composer */}
      <div className="p-3 border-t border-[#1f1f26] bg-[#0d0d11] space-y-2.5 shrink-0">
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-[#71717a]">
            One-Click MCP Workflows
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_AI_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                data-testid={`ai-quick-prompt-${idx}`}
                onClick={() => void handleSendPrompt(qp.prompt)}
                className="px-2 py-1.5 bg-[#13131a] hover:bg-[#1b1b24] border border-[#24242f] rounded-md text-[10px] font-medium text-[#d4d4d8] hover:text-white flex items-center gap-1.5 transition-colors truncate cursor-pointer"
                title={qp.prompt}
              >
                <Play className="w-2.5 h-2.5 text-[#8b93ff] shrink-0" />
                <span className="truncate">{qp.label}</span>
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendPrompt();
          }}
          className="flex gap-1.5"
        >
          <input
            type="text"
            data-testid="ai-prompt-input"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            disabled={isBusy}
            placeholder={`Ask ${currentProviderMeta.shortName} to edit timeline...`}
            className="flex-1 h-8 px-2.5 bg-[#09090b] border border-[#262630] rounded-md text-xs text-[#f4f4f5] placeholder-[#63636e] focus:outline-none focus:border-[#5e6ad2]"
          />
          <button
            type="submit"
            data-testid="ai-prompt-submit-btn"
            disabled={isBusy || !promptInput.trim()}
            className="h-8 px-3 bg-[#5e6ad2] hover:bg-[#6e79de] disabled:opacity-35 text-white rounded-md flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            title="Execute AI MCP Command"
          >
            {isBusy ? (
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>
      </>
      )}
    </aside>
  );
};
