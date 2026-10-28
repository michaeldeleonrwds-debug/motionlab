#!/usr/bin/env node
/**
 * MotionLab — Model Context Protocol (MCP) Stdio Server
 * Compatible with:
 * - Google Antigravity (~/.gemini/config/mcp_config.json)
 * - Claude Desktop & Claude Code
 * - OpenAI ChatGPT Desktop & Codex CLI
 * - Cursor, Windsurf, and any standard MCP host
 *
 * Bridges stdio JSON-RPC 2.0 requests directly to the running MotionLab instance
 * at http://localhost:5173/api/mcp/rpc (or MOTIONLAB_URL env variable), with full
 * built-in tool schema discovery even if the browser server is still starting up.
 */
import readline from 'node:readline';

const MOTIONLAB_URL = process.env.MOTIONLAB_URL || 'http://localhost:5173';

const BUILTIN_TOOLS = [
  {
    name: 'get_state',
    description:
      'Inspect the complete current MotionLab project state, including sequence format, tracks, clips, media assets, playhead timecode, and selection.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'command_list',
    description:
      'List all available MotionLab NLE engine commands and their parameter schemas.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'command_run',
    description:
      'Run any MotionLab engine command by id with JSON params; edits are undoable.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Command id (e.g. create_project, add_text_layer, trim_clip, split_clip, set_transition)',
        },
        params: { type: 'object', description: 'Command parameters' },
      },
      required: ['id'],
    },
  },
  {
    name: 'command_batch',
    description:
      'Execute a sequential batch of MotionLab commands or MCP tool calls in order.',
    inputSchema: {
      type: 'object',
      properties: {
        commands: { type: 'array', items: { type: 'object' } },
      },
      required: ['commands'],
    },
  },
  {
    name: 'create_project',
    description:
      'Create a new project sequence with name, aspectRatio (16:9, 9:16, 1:1, 4:5), resolution (1080p, 720p), and fps (24, 30, 60).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:5'] },
        resolution: { type: 'string', enum: ['1080p', '720p'] },
        fps: { type: 'number', enum: [24, 30, 60] },
      },
      required: ['name'],
    },
  },
  {
    name: 'load_studio_media',
    description:
      'Import locally generated studio test media assets into the Media Library.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'add_media_clip',
    description:
      'Add a media asset (by assetId or filename) onto a timeline track at an optional startTime.',
    inputSchema: {
      type: 'object',
      properties: {
        assetIdOrName: { type: 'string' },
        trackId: { type: 'string' },
        startTime: { type: 'number' },
      },
      required: ['assetIdOrName'],
    },
  },
  {
    name: 'add_text_layer',
    description: 'Add an animated text/title overlay clip to the timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        startTime: { type: 'number' },
        duration: { type: 'number' },
        fontFamily: { type: 'string' },
        fontSize: { type: 'number' },
        color: { type: 'string' },
        animationIn: {
          type: 'string',
          enum: ['none', 'fade-in', 'slide-in', 'zoom-in', 'typewriter'],
        },
        animationOut: {
          type: 'string',
          enum: ['none', 'fade-out', 'slide-out'],
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'trim_clip',
    description:
      'Trim a clip left edge (newStartTime) or right edge (newDuration).',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        newStartTime: { type: 'number' },
        newDuration: { type: 'number' },
      },
    },
  },
  {
    name: 'split_clip',
    description: 'Split a clip into two segments at splitTime (or current playhead).',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        splitTime: { type: 'number' },
      },
    },
  },
  {
    name: 'set_transition',
    description:
      'Apply a transition (cross-dissolve, fade-from-black, fade-to-black, slide-left, wipe-right) to a clip.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        edge: { type: 'string', enum: ['in', 'out'] },
        type: {
          type: 'string',
          enum: [
            'none',
            'cross-dissolve',
            'fade-from-black',
            'fade-to-black',
            'slide-left',
            'wipe-right',
          ],
        },
        duration: { type: 'number' },
      },
      required: ['type'],
    },
  },
  {
    name: 'set_color_effects',
    description:
      'Adjust brightness, contrast, saturation, exposure, blur, grayscale, sepia, flipH, flipV on a clip.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        brightness: { type: 'number' },
        contrast: { type: 'number' },
        saturation: { type: 'number' },
        exposure: { type: 'number' },
        blur: { type: 'number' },
        grayscale: { type: 'number' },
        sepia: { type: 'number' },
        flipH: { type: 'boolean' },
        flipV: { type: 'boolean' },
      },
    },
  },
  {
    name: 'add_keyframe',
    description:
      'Add or update a keyframe (x, y, scale, rotation, opacity) on a clip.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        property: {
          type: 'string',
          enum: ['x', 'y', 'scale', 'rotation', 'opacity'],
        },
        time: { type: 'number' },
        value: { type: 'number' },
        easing: {
          type: 'string',
          enum: ['linear', 'ease-in', 'ease-out', 'ease-in-out'],
        },
      },
      required: ['property', 'time', 'value'],
    },
  },
  {
    name: 'set_audio_envelope',
    description: 'Adjust clip volume, mute, fadeIn, and fadeOut.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        volume: { type: 'number' },
        muted: { type: 'boolean' },
        fadeIn: { type: 'number' },
        fadeOut: { type: 'number' },
      },
    },
  },
  {
    name: 'memory_search',
    description:
      'Search the MotionLab persistent Obsidian knowledge vault for brand rules, typography standards, motion design principles, and project memories.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords or natural language query' },
        category: { type: 'string', description: 'Optional memory category' },
        type: { type: 'string', description: 'Optional memory type' },
        limit: { type: 'number', description: 'Maximum results to return' },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_get',
    description: 'Retrieve a specific memory record by its unique ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique memory record ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'memory_propose',
    description:
      'Propose a new creative suggestion, technique, or observation for user/director review (marked proposed/pending).',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short descriptive title' },
        content: { type: 'string', description: 'Detailed knowledge content in markdown' },
        category: { type: 'string', description: 'Memory category' },
        type: { type: 'string', description: 'Memory type' },
        tags: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'number', description: 'Confidence score (0.0 to 1.0)' },
      },
      required: ['title', 'content', 'category', 'type'],
    },
  },
  {
    name: 'memory_save',
    description:
      'Persist a validated, approved design rule, brand guideline, typography spec, or decision directly into the Obsidian vault.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short descriptive title' },
        content: { type: 'string', description: 'Detailed knowledge content in markdown' },
        category: { type: 'string', description: 'Memory category' },
        type: { type: 'string', description: 'Memory type' },
        tags: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'number', description: 'Confidence score (0.0 to 1.0)' },
      },
      required: ['title', 'content', 'category', 'type'],
    },
  },
  {
    name: 'memory_update',
    description: 'Update content, tags, or validation status of an existing memory in the vault.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Memory record ID' },
        updates: { type: 'object', description: 'Fields to update' },
      },
      required: ['id', 'updates'],
    },
  },
  {
    name: 'memory_link',
    description: 'Create a cross-reference relationship between two memory records in Obsidian.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceId: { type: 'string', description: 'Source memory ID' },
        targetId: { type: 'string', description: 'Target memory ID' },
      },
      required: ['sourceId', 'targetId'],
    },
  },
  {
    name: 'memory_list',
    description: 'List memory records from the Obsidian vault with optional category, type, or status filters.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        type: { type: 'string' },
        approvalStatus: { type: 'string', enum: ['approved', 'proposed', 'archived'] },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'memory_get_project_context',
    description: 'Retrieve project context including session summaries, active brand rules, and typography specifications.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Optional project ID or name' },
      },
    },
  },
  {
    name: 'memory_get_design_preferences',
    description: 'Retrieve all approved design principles, typography guidelines, and brand colors.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'memory_get_lessons',
    description: 'Retrieve all confirmed lessons learned and mistakes to avoid.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'memory_consolidate',
    description: 'Scan the vault for duplicate or highly similar memories and cluster them for consolidation.',
    inputSchema: {
      type: 'object',
      properties: {
        dryRun: { type: 'boolean' },
      },
    },
  },
  {
    name: 'memory_archive',
    description: 'Move a memory note to 99-Archive.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Memory ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'memory_delete',
    description: 'Permanently remove a memory note from the vault.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Memory ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'memory_health',
    description: 'Check connectivity, sync status, and integrity of Obsidian vault and Graphify code graph.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'graphify_query',
    description: 'Query the Graphify repository knowledge graph for modules, classes, functions, and call relationships.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Symbol or concept to search' },
        kind: { type: 'string', enum: ['module', 'function', 'class', 'interface', 'variable', 'file'] },
        filePath: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'graphify_status',
    description: 'Check Graphify code intelligence status, node count, edge count, and index staleness.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'graphify_reindex',
    description: 'Trigger a fresh local AST extraction and index generation using Graphify.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // ==========================================
  // MotionLab Creative Intelligence Engine (MCIE) Tools
  // ==========================================
  {
    name: 'analyze_creative_brief',
    description: 'Synthesize an unstructured creative prompt or brief into a structured, validated CreativeBrief.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Natural language brief or campaign goal' },
        brandName: { type: 'string' },
        durationSeconds: { type: 'number' },
        aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:5'] },
        resolution: { type: 'string', enum: ['1080p', '720p'] },
      },
    },
  },
  {
    name: 'generate_creative_treatment',
    description: 'Create an artistic CreativeTreatment with type scales, color roles, composition grids, and 4-act scene breakdown.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        brief: { type: 'object' },
      },
    },
  },
  {
    name: 'create_storyboard',
    description: 'Construct detailed storyboard scenes with layer layouts, typography, shapes, and motion tokens.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        treatment: { type: 'object' },
        brief: { type: 'object' },
      },
    },
  },
  {
    name: 'create_production_plan',
    description: 'Generate an end-to-end production plan with brief, treatment, and scenes.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
      },
    },
  },
  {
    name: 'produce_project',
    description: 'End-to-end autonomous motion design: compiles full commercial timeline, critiques quality, auto-refines defects, and loads directly into MotionLab editor.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Creative direction prompt or brief' },
        loadIntoEditor: { type: 'boolean', description: 'Whether to immediately load compiled project into active editor (default true)' },
      },
    },
  },
  {
    name: 'apply_motion_preset',
    description: 'Inject studio-calibrated keyframes (refined-title-entrance, editorial-reveal, brand-logo-reveal, camera-push, ui-card-entrance, cta-reveal, kinetic-mask-wipe) onto a clip.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'Target clip ID or name (defaults to selected)' },
        presetName: { type: 'string', description: 'Motion preset ID' },
        enterDuration: { type: 'number' },
        exitDuration: { type: 'number' },
        overshoot: { type: 'number' },
        direction: { type: 'string', enum: ['up', 'down', 'left', 'right', 'scale', 'fade'] },
      },
      required: ['presetName'],
    },
  },
  {
    name: 'list_motion_presets',
    description: 'List all available studio-grade motion presets and their parameters.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'diagnose_typography',
    description: 'Evaluate font sizing, text bounds, safe area compliance, and WCAG AA contrast ratio.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        text: { type: 'string' },
        fontSize: { type: 'number' },
        textColorHex: { type: 'string' },
        backgroundColorHex: { type: 'string' },
      },
    },
  },
  {
    name: 'generate_type_scale',
    description: 'Calculate harmonic font sizes using classical type scale ratios (major-third, perfect-fourth, golden-ratio).',
    inputSchema: {
      type: 'object',
      properties: {
        baseSize: { type: 'number', description: 'Base font size (e.g. 16 or 24)' },
        scaleType: { type: 'string', enum: ['major-second', 'major-third', 'perfect-fourth', 'augmented-fourth', 'golden-ratio'] },
      },
    },
  },
  {
    name: 'analyze_composition',
    description: 'Evaluate active frame layout for element collisions, offscreen clipping, and visual balance.',
    inputSchema: {
      type: 'object',
      properties: {
        timestamp: { type: 'number' },
      },
    },
  },
  {
    name: 'critique_project',
    description: 'Execute multi-dimensional quality rubric score, identify defect findings, and check broadcast standard readiness.',
    inputSchema: {
      type: 'object',
      properties: {
        targetBrandColors: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'auto_refine_project',
    description: 'Iteratively audit and synthesize targeted corrective diffs to fix contrast, safe margin, collision, and keyframe defects.',
    inputSchema: {
      type: 'object',
      properties: {
        targetBrandColors: { type: 'array', items: { type: 'string' } },
        maxIterations: { type: 'number' },
      },
    },
  },
  {
    name: 'list_skills',
    description: 'List all modular AI Creative Director agent skills registered in MotionLab.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'execute_skill_workflow',
    description: 'Execute a specific workflow from a registered skill.',
    inputSchema: {
      type: 'object',
      properties: {
        skillId: { type: 'string' },
        workflowId: { type: 'string' },
        parameters: { type: 'object' },
      },
      required: ['skillId', 'workflowId'],
    },
  },
  // ==========================================
  // Voicebox AI Voice Studio MCP Tools
  // ==========================================
  {
    name: 'voice_list_engines',
    description: 'List all Voicebox TTS engines with capability manifests (cloning, streaming, sample rates, model sizes).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'voice_list_profiles',
    description: 'List available voice profiles (preset studio voices and custom cloned profiles).',
    inputSchema: {
      type: 'object',
      properties: {
        engine: { type: 'string' },
        voiceType: { type: 'string', enum: ['preset', 'cloned', 'designed'] },
        language: { type: 'string' },
      },
    },
  },
  {
    name: 'voice_generate',
    description: 'Synthesize speech audio from text using Voicebox or MotionLab studio engine, with audio quality report.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Script text to speak' },
        profileId: { type: 'string', description: 'Voice profile ID' },
        engine: { type: 'string', description: 'TTS engine ID' },
        speed: { type: 'number', description: 'Pacing speed multiplier (0.75 to 1.5)' },
        emotionInstruction: { type: 'string', description: 'Optional delivery instruction' },
      },
      required: ['text'],
    },
  },
  {
    name: 'voice_create_profile',
    description: 'Create and register a custom voice profile (requires explicit user consent validation).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        gender: { type: 'string', enum: ['male', 'female', 'neutral'] },
        language: { type: 'string' },
        consentConfirmed: { type: 'boolean', description: 'Confirmation of voice ownership or written authorization' },
      },
      required: ['name', 'consentConfirmed'],
    },
  },
  {
    name: 'voice_add_to_timeline',
    description: 'Synthesize voiceover and immediately place it as a managed audio clip onto the MotionLab timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        profileId: { type: 'string' },
        startTime: { type: 'number' },
        trackId: { type: 'string' },
        speed: { type: 'number' },
      },
      required: ['text'],
    },
  },
  {
    name: 'voice_apply_effect',
    description: 'Apply DSP mastering effects (high-pass filter, compression, reverb, peak normalization) to speech.',
    inputSchema: {
      type: 'object',
      properties: {
        lowCutHz: { type: 'number' },
        compressionRatio: { type: 'number' },
        reverbWet: { type: 'number' },
        normalizePeakDb: { type: 'number' },
      },
    },
  },
  {
    name: 'voice_generate_script',
    description: 'Generate and plan a voiceover script calibrated to target scene duration and brand tone.',
    inputSchema: {
      type: 'object',
      properties: {
        topicOrBrief: { type: 'string' },
        targetDurationSeconds: { type: 'number' },
        preset: { type: 'string' },
      },
      required: ['topicOrBrief'],
    },
  },
  {
    name: 'voice_sync_to_animation',
    description: 'Analyze speech timing and generate synchronized kinetic typography text overlay clips on the timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        profileId: { type: 'string' },
        targetTrackId: { type: 'string' },
      },
      required: ['text'],
    },
  },
];

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

function sendResponse(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }

  // Notifications without an id do not expect a JSON-RPC response
  if (msg.id === undefined) {
    return;
  }

  try {
    const response = await fetch(`${MOTIONLAB_URL}/api/mcp/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    });

    if (response.ok) {
      const data = await response.json();
      sendResponse(data);
      return;
    }
  } catch {
    // Fallback if browser dev server is not currently reachable
  }

  if (msg.method === 'initialize') {
    sendResponse({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
        },
        serverInfo: {
          name: 'MotionLab-NLE-MCP',
          version: '1.0.0',
        },
      },
    });
  } else if (msg.method === 'tools/list') {
    sendResponse({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        tools: BUILTIN_TOOLS,
      },
    });
  } else {
    sendResponse({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              error: `MotionLab dev server is not reachable at ${MOTIONLAB_URL}. Start it with "npm run dev".`,
            }),
          },
        ],
      },
    });
  }
});
