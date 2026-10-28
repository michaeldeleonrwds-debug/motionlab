import React, { useState } from 'react';
import {
  X,
  Cpu,
  Copy,
  Check,
  Play,
  Terminal,
  Code2,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import {
  executeMcpToolCall,
  MOTIONLAB_MCP_TOOLS,
} from '../engine/mcpEngine';

type ModalTab = 'clients' | 'explorer' | 'logs';
type ClientGuideId = 'antigravity' | 'chatgpt-codex' | 'claude' | 'cursor-other';

const CLIENT_GUIDES: Record<
  ClientGuideId,
  {
    title: string;
    subtitle: string;
    configPath: string;
    snippet: string;
    cliCommand?: string;
  }
> = {
  antigravity: {
    title: 'Google Antigravity IDE / CLI',
    subtitle:
      'Connect Antigravity directly to MotionLab via stdio or HTTP JSON-RPC 2.0 MCP server.',
    configPath: '~/.gemini/config/mcp_config.json',
    cliCommand: 'node c:/Users/REYMARK/Documents/Sites/MotionLab/mcp/motionlab-mcp-server.mjs',
    snippet: JSON.stringify(
      {
        mcpServers: {
          MotionLab: {
            command: 'node',
            args: [
              'c:/Users/REYMARK/Documents/Sites/MotionLab/mcp/motionlab-mcp-server.mjs',
            ],
            env: {
              MOTIONLAB_URL: 'http://localhost:5173',
            },
          },
        },
      },
      null,
      2
    ),
  },
  'chatgpt-codex': {
    title: 'ChatGPT Desktop & OpenAI Codex CLI',
    subtitle:
      'Enable OpenAI Codex CLI or ChatGPT Desktop MCP integration to run timeline edits.',
    configPath: '~/.codex/config.toml (or ChatGPT Developer MCP Settings)',
    cliCommand: 'codex --mcp-server "node c:/Users/REYMARK/Documents/Sites/MotionLab/mcp/motionlab-mcp-server.mjs"',
    snippet: `# ~/.codex/config.toml
[mcp_servers.motionlab]
command = "node"
args = ["c:/Users/REYMARK/Documents/Sites/MotionLab/mcp/motionlab-mcp-server.mjs"]
env = { MOTIONLAB_URL = "http://localhost:5173" }`,
  },
  claude: {
    title: 'Claude Desktop & Claude Code (Anthropic)',
    subtitle:
      'Register MotionLab as a local MCP server in Claude Desktop or Claude Code CLI.',
    configPath: 'claude_desktop_config.json',
    cliCommand:
      'claude mcp add motionlab -- node c:/Users/REYMARK/Documents/Sites/MotionLab/mcp/motionlab-mcp-server.mjs',
    snippet: JSON.stringify(
      {
        mcpServers: {
          motionlab: {
            command: 'node',
            args: [
              'c:/Users/REYMARK/Documents/Sites/MotionLab/mcp/motionlab-mcp-server.mjs',
            ],
            env: {
              MOTIONLAB_URL: 'http://localhost:5173',
            },
          },
        },
      },
      null,
      2
    ),
  },
  'cursor-other': {
    title: 'Cursor / Windsurf / Any HTTP or Stdio MCP Client',
    subtitle:
      'Connect via Streamable HTTP JSON-RPC 2.0 endpoint or standard stdio transport.',
    configPath: '.cursor/mcp.json  |  POST http://localhost:5173/api/mcp/rpc',
    cliCommand: 'curl -X POST http://localhost:5173/api/mcp/rpc -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","id":1,"method":"tools/list"}\'',
    snippet: JSON.stringify(
      {
        mcpServers: {
          motionlab: {
            url: 'http://localhost:5173/api/mcp/rpc',
            command: 'node',
            args: [
              'c:/Users/REYMARK/Documents/Sites/MotionLab/mcp/motionlab-mcp-server.mjs',
            ],
          },
        },
      },
      null,
      2
    ),
  },
};

export const McpConfigModal: React.FC = () => {
  const {
    isMcpModalOpen,
    setMcpModalOpen,
    mcpBridgeConnected,
    mcpLogs,
    addMcpLog,
  } = useEditorStore();

  const [activeTab, setActiveTab] = useState<ModalTab>('clients');
  const [selectedClient, setSelectedClient] =
    useState<ClientGuideId>('antigravity');
  const [copied, setCopied] = useState(false);

  const [selectedToolName, setSelectedToolName] = useState<string>('get_state');
  const [toolArgsJson, setToolArgsJson] = useState<string>('{}');
  const [toolOutputJson, setToolOutputJson] = useState<string>(
    '// Click "Execute MCP Tool" to run against the live timeline'
  );

  if (!isMcpModalOpen) return null;

  const currentGuide = CLIENT_GUIDES[selectedClient];
  const currentToolSchema =
    MOTIONLAB_MCP_TOOLS.find((t) => t.name === selectedToolName) ||
    MOTIONLAB_MCP_TOOLS[0];

  const handleCopy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSelectTool = (name: string) => {
    setSelectedToolName(name);
    const sampleArgs: Record<string, Record<string, unknown>> = {
      get_state: {},
      command_list: {},
      command_run: {
        id: 'layer.newText',
        params: { content: 'HELLO FROM MCP', fontSize: 72, animationIn: 'zoom-in' },
      },
      command_batch: {
        commands: [
          { name: 'load_studio_media', arguments: {} },
          {
            name: 'add_text_layer',
            arguments: { content: 'MCP BATCH CUT', animationIn: 'slide-in' },
          },
        ],
      },
      create_project: {
        name: 'AI MCP Master 1080p',
        aspectRatio: '16:9',
        resolution: '1080p',
        fps: 30,
      },
      add_text_layer: {
        content: 'MCP GENERATED TITLE',
        fontSize: 68,
        color: '#38bdf8',
        animationIn: 'fade-in',
      },
      set_transition: {
        type: 'cross-dissolve',
        duration: 0.6,
        edge: 'in',
      },
      set_color_effects: {
        contrast: 20,
        saturation: 30,
      },
    };
    setToolArgsJson(JSON.stringify(sampleArgs[name] || {}, null, 2));
  };

  const handleRunExplorerTool = async () => {
    const t0 = performance.now();
    try {
      const parsedArgs = JSON.parse(toolArgsJson || '{}') as Record<
        string,
        unknown
      >;
      const result = await executeMcpToolCall(selectedToolName, parsedArgs);
      const durationMs = Math.round(performance.now() - t0);
      setToolOutputJson(JSON.stringify(result, null, 2));
      addMcpLog({
        id: `console-${Date.now()}`,
        timestamp: Date.now(),
        source: 'user-console',
        toolName: selectedToolName,
        args: parsedArgs,
        status: 'success',
        resultSummary: JSON.stringify(result).slice(0, 140),
        durationMs,
      });
    } catch (err) {
      setToolOutputJson(
        JSON.stringify(
          {
            ok: false,
            error: err instanceof Error ? err.message : 'Invalid JSON or execution error',
          },
          null,
          2
        )
      );
    }
  };

  return (
    <div
      data-testid="mcp-config-modal"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 select-none"
    >
      <div className="w-full max-w-3xl bg-[#0d0d11] border border-[#24242f] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="h-11 px-4 bg-[#111116] border-b border-[#22222c] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4 text-[#8b93ff]" />
            <span className="text-xs font-semibold tracking-tight text-[#f4f4f5]">
              MotionLab Model Context Protocol (MCP) Studio
            </span>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full">
              {mcpBridgeConnected ? 'Live Bridge Connected' : '20 Tools Active'}
            </span>
          </div>
          <button
            type="button"
            data-testid="close-mcp-modal-btn"
            onClick={() => setMcpModalOpen(false)}
            className="p-1 text-[#71717a] hover:text-[#f4f4f5] rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="h-9 px-4 bg-[#0f0f14] border-b border-[#1f1f27] flex items-center gap-5 text-xs">
          <button
            type="button"
            data-testid="mcp-tab-clients"
            onClick={() => setActiveTab('clients')}
            className={`h-full flex items-center gap-1.5 border-b-2 font-medium cursor-pointer transition-colors ${
              activeTab === 'clients'
                ? 'border-[#5e6ad2] text-[#f4f4f5]'
                : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Connect AI Clients (Antigravity / Codex / Claude)</span>
          </button>

          <button
            type="button"
            data-testid="mcp-tab-explorer"
            onClick={() => setActiveTab('explorer')}
            className={`h-full flex items-center gap-1.5 border-b-2 font-medium cursor-pointer transition-colors ${
              activeTab === 'explorer'
                ? 'border-[#5e6ad2] text-[#f4f4f5]'
                : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>MCP Tool Runner ({MOTIONLAB_MCP_TOOLS.length} Tools)</span>
          </button>

          <button
            type="button"
            data-testid="mcp-tab-logs"
            onClick={() => setActiveTab('logs')}
            className={`h-full flex items-center gap-1.5 border-b-2 font-medium cursor-pointer transition-colors ${
              activeTab === 'logs'
                ? 'border-[#5e6ad2] text-[#f4f4f5]'
                : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Live MCP Execution Log ({mcpLogs.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* TAB 1: AI CLIENT CONFIGURATIONS */}
          {activeTab === 'clients' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { id: 'antigravity', label: 'Antigravity' },
                    { id: 'chatgpt-codex', label: 'ChatGPT / Codex' },
                    { id: 'claude', label: 'Claude Desktop/Code' },
                    { id: 'cursor-other', label: 'Cursor / HTTP RPC' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`mcp-client-select-${item.id}`}
                    onClick={() => setSelectedClient(item.id)}
                    className={`h-8 px-2 rounded-md border font-medium text-xs transition-colors cursor-pointer ${
                      selectedClient === item.id
                        ? 'bg-[#5e6ad2]/15 border-[#5e6ad2] text-[#f4f4f5]'
                        : 'bg-[#121217] border-[#22222c] text-[#8e8e98] hover:text-[#f4f4f5]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="bg-[#121217] border border-[#22222c] rounded-lg p-3.5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[#f4f4f5]">
                      {currentGuide.title}
                    </div>
                    <div className="text-[11px] text-[#8e8e98] mt-0.5">
                      {currentGuide.subtitle}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="copy-mcp-config-btn"
                    onClick={() => handleCopy(currentGuide.snippet)}
                    className="h-7 px-3 bg-[#5e6ad2] hover:bg-[#6e79de] text-white rounded-md text-[11px] font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Config</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-[11px] font-mono text-[#a5acff]">
                  Config Location: {currentGuide.configPath}
                </div>

                <pre
                  data-testid="mcp-config-codeblock"
                  className="p-3 bg-[#09090c] border border-[#1f1f27] rounded-md font-mono text-[11px] text-[#e4e4e7] overflow-x-auto"
                >
                  {currentGuide.snippet}
                </pre>

                {currentGuide.cliCommand && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold uppercase text-[#71717a]">
                      Quick CLI Command
                    </div>
                    <div className="p-2.5 bg-[#09090c] border border-[#1f1f27] rounded-md font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      {currentGuide.cliCommand}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE MCP TOOL RUNNER */}
          {activeTab === 'explorer' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-96">
              {/* Left Tool List */}
              <div className="bg-[#09090c] border border-[#22222c] rounded-lg overflow-y-auto divide-y divide-[#181820]">
                {MOTIONLAB_MCP_TOOLS.map((tool) => (
                  <button
                    key={tool.name}
                    type="button"
                    data-testid={`mcp-explorer-tool-${tool.name}`}
                    onClick={() => handleSelectTool(tool.name)}
                    className={`w-full px-3 py-2 text-left transition-colors cursor-pointer ${
                      selectedToolName === tool.name
                        ? 'bg-[#191a26] text-[#f4f4f5]'
                        : 'text-[#8e8e98] hover:bg-[#121217] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <div className="font-mono text-[11px] font-medium text-[#a5acff]">
                      {tool.name}
                    </div>
                    <div className="text-[10px] line-clamp-1 text-[#71717a]">
                      {tool.description}
                    </div>
                  </button>
                ))}
              </div>

              {/* Right Tool Runner & Output */}
              <div className="md:col-span-2 flex flex-col gap-2.5 h-full">
                <div className="bg-[#121217] border border-[#22222c] p-3 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-semibold text-[#f4f4f5]">
                        {currentToolSchema.name}
                      </span>
                      <p className="text-[11px] text-[#8e8e98] mt-0.5">
                        {currentToolSchema.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="execute-mcp-tool-btn"
                      onClick={() => void handleRunExplorerTool()}
                      className="h-7 px-3 bg-[#5e6ad2] hover:bg-[#6e79de] text-white font-medium text-xs rounded-md flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Execute MCP Tool</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-[#71717a] mb-1">
                      JSON Arguments (params)
                    </label>
                    <textarea
                      data-testid="mcp-tool-args-textarea"
                      rows={4}
                      value={toolArgsJson}
                      onChange={(e) => setToolArgsJson(e.target.value)}
                      className="w-full p-2 bg-[#09090c] border border-[#262632] rounded-md font-mono text-[11px] text-[#f4f4f5] focus:outline-none focus:border-[#5e6ad2]"
                    />
                  </div>
                </div>

                <div className="flex-1 bg-[#09090c] border border-[#22222c] rounded-lg p-3 overflow-auto">
                  <div className="text-[10px] font-mono text-[#71717a] mb-1">
                    JSON-RPC Tool Execution Output:
                  </div>
                  <pre
                    data-testid="mcp-tool-output-pre"
                    className="font-mono text-[11px] text-emerald-400 whitespace-pre-wrap"
                  >
                    {toolOutputJson}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LIVE MCP EXECUTION LOG */}
          {activeTab === 'logs' && (
            <div className="space-y-2">
              {mcpLogs.length === 0 ? (
                <div className="p-8 text-center text-[#71717a] bg-[#121217] border border-[#22222c] rounded-lg">
                  No MCP tool calls recorded in this session yet. Run an AI command or execute a tool in the MCP Tool Runner.
                </div>
              ) : (
                mcpLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2.5 bg-[#121217] border border-[#22222c] rounded-lg flex items-center justify-between font-mono text-[11px]"
                  >
                    <div className="space-y-0.5 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-[#f4f4f5] font-semibold">
                          {entry.toolName}
                        </span>
                        <span className="px-1.5 py-0.5 text-[9px] bg-[#191a26] text-[#a5acff] rounded uppercase">
                          {entry.source}
                        </span>
                        <span className="text-[10px] text-[#71717a]">
                          {entry.durationMs}ms
                        </span>
                      </div>
                      <div className="text-[10px] text-[#8e8e98] truncate">
                        Args: {JSON.stringify(entry.args)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
