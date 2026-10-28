import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ObsidianVaultManager } from './memory/obsidianVault';
import { GraphifyService } from './memory/graphifyService';
import { MemoryConsolidator } from '../src/memory/MemoryConsolidator';

const obsidianVault = new ObsidianVaultManager();
const graphifyService = new GraphifyService();

interface PendingBridgeCall {
  requestId: string;
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const sseClients = new Set<ServerResponse>();
const pendingCalls = new Map<string, PendingBridgeCall>();
let latestProjectState: Record<string, unknown> = {
  projectName: 'Studio Master 1080p',
  aspectRatio: '16:9',
  resolution: '1080p',
  fps: 30,
  clips: [],
  tracks: [],
};

const MCP_SERVER_TOOLS_SCHEMA = [
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
        id: { type: 'string', description: 'Command id (e.g. create_project, add_text_layer, trim_clip, split_clip, set_transition)' },
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
    description: 'Create a new project sequence with name, aspectRatio (16:9, 9:16, 1:1, 4:5), resolution (1080p, 720p), and fps (24, 30, 60).',
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
    description: 'Import locally generated studio test media assets into the Media Library.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'add_media_clip',
    description: 'Add a media asset (by assetId or filename) onto a timeline track at an optional startTime.',
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
        animationIn: { type: 'string', enum: ['none', 'fade-in', 'slide-in', 'zoom-in', 'typewriter'] },
        animationOut: { type: 'string', enum: ['none', 'fade-out', 'slide-out'] },
      },
      required: ['content'],
    },
  },
  {
    name: 'trim_clip',
    description: 'Trim a clip left edge (newStartTime) or right edge (newDuration).',
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
    description: 'Apply a transition (cross-dissolve, fade-from-black, fade-to-black, slide-left, wipe-right) to a clip.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        edge: { type: 'string', enum: ['in', 'out'] },
        type: { type: 'string', enum: ['none', 'cross-dissolve', 'fade-from-black', 'fade-to-black', 'slide-left', 'wipe-right'] },
        duration: { type: 'number' },
      },
      required: ['type'],
    },
  },
  {
    name: 'set_color_effects',
    description: 'Adjust brightness, contrast, saturation, exposure, blur, grayscale, sepia, flipH, flipV on a clip.',
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
    description: 'Add or update a keyframe (x, y, scale, rotation, opacity) on a clip.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        property: { type: 'string', enum: ['x', 'y', 'scale', 'rotation', 'opacity'] },
        time: { type: 'number' },
        value: { type: 'number' },
        easing: { type: 'string', enum: ['linear', 'ease-in', 'ease-out', 'ease-in-out'] },
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

function readBodyJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      try {
        const str = Buffer.concat(chunks).toString('utf-8');
        resolve(str ? JSON.parse(str) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(payload));
}

async function executeMemoryOrGraphifyTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case 'memory_search': {
      const query = String(args.query || '');
      const results = await obsidianVault.searchMemories(query, {
        category: args.category as any,
        type: args.type as any,
        projectId: args.projectId ? String(args.projectId) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : 10,
      });
      return { ok: true, results };
    }
    case 'memory_get': {
      const id = String(args.id || '');
      const record = await obsidianVault.getMemory(id);
      return { ok: Boolean(record), record };
    }
    case 'memory_propose': {
      const record = await obsidianVault.saveMemory({
        title: String(args.title || 'Untitled Proposal'),
        content: String(args.content || ''),
        category: (args.category || 'ai-skill') as any,
        type: (args.type || 'ai-suggestion') as any,
        tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
        sourceType: (args.sourceType || 'ai-observation') as any,
        projectId: args.projectId ? String(args.projectId) : undefined,
        confidence: typeof args.confidence === 'number' ? args.confidence : 0.85,
        approvalStatus: 'proposed',
        validationStatus: 'pending',
      });
      return { ok: true, record };
    }
    case 'memory_save': {
      const record = await obsidianVault.saveMemory({
        title: String(args.title || 'Untitled Memory'),
        content: String(args.content || ''),
        category: (args.category || 'design-principle') as any,
        type: (args.type || 'design-principle') as any,
        tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
        sourceType: (args.sourceType || 'user-instruction') as any,
        projectId: args.projectId ? String(args.projectId) : undefined,
        confidence: typeof args.confidence === 'number' ? args.confidence : 0.95,
        approvalStatus: 'approved',
        validationStatus: 'validated',
      });
      return { ok: true, record };
    }
    case 'memory_update': {
      const id = String(args.id || '');
      const updates = (args.updates || {}) as any;
      const record = await obsidianVault.updateMemory(id, updates);
      return { ok: Boolean(record), record };
    }
    case 'memory_link': {
      const sourceId = String(args.sourceId || '');
      const targetId = String(args.targetId || '');
      const source = await obsidianVault.getMemory(sourceId);
      if (!source) return { ok: false, error: `Memory ${sourceId} not found` };
      const related = new Set(source.relatedMemoryIds || []);
      related.add(targetId);
      const updated = await obsidianVault.updateMemory(sourceId, {
        relatedMemoryIds: Array.from(related),
      });
      return { ok: true, record: updated };
    }
    case 'memory_list': {
      const records = await obsidianVault.listMemories({
        category: args.category as any,
        type: args.type as any,
        approvalStatus: args.approvalStatus as any,
        projectId: args.projectId ? String(args.projectId) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : 50,
      });
      return { ok: true, count: records.length, records };
    }
    case 'memory_get_project_context': {
      const projectId = args.projectId ? String(args.projectId) : undefined;
      const summary = await obsidianVault.getLatestSessionSummary(projectId);
      const brandRules = await obsidianVault.listMemories({ category: 'brand-guideline', limit: 10 });
      const typography = await obsidianVault.listMemories({ category: 'typography', limit: 10 });
      return { ok: true, summary, brandRules, typography };
    }
    case 'memory_get_design_preferences': {
      const designPrinciples = await obsidianVault.listMemories({ category: 'design-principle' });
      const typography = await obsidianVault.listMemories({ category: 'typography' });
      const brandRules = await obsidianVault.listMemories({ category: 'brand-guideline' });
      const motionPrinciples = await obsidianVault.listMemories({ category: 'motion-principle' });
      return { ok: true, designPrinciples, typography, brandRules, motionPrinciples };
    }
    case 'memory_get_lessons': {
      const lessons = await obsidianVault.listMemories({ category: 'lesson-learned' });
      return { ok: true, count: lessons.length, lessons };
    }
    case 'memory_consolidate': {
      const records = await obsidianVault.listMemories();
      const clusters = MemoryConsolidator.findDuplicateClusters(records);
      return { ok: true, clusterCount: clusters.length, clusters };
    }
    case 'memory_archive': {
      const id = String(args.id || '');
      const ok = await obsidianVault.archiveMemory(id);
      return { ok, id };
    }
    case 'memory_delete': {
      const id = String(args.id || '');
      const ok = await obsidianVault.deleteMemory(id);
      return { ok, id };
    }
    case 'memory_health': {
      const obsHealth = await obsidianVault.getStatus();
      const graphHealth = await graphifyService.getStatus();
      return {
        ok: true,
        obsidian: obsHealth,
        graphify: graphHealth,
        status: obsHealth.connected && graphHealth.available ? 'healthy' : 'degraded',
      };
    }
    case 'graphify_query': {
      const res = await graphifyService.query(args);
      return { ok: true, ...res };
    }
    case 'graphify_status': {
      const status = await graphifyService.getStatus();
      return { ok: true, status };
    }
    case 'graphify_reindex': {
      const res = await graphifyService.reindex();
      return { ...res };
    }
    default:
      throw new Error(`Unknown memory tool: ${toolName}`);
  }
}

async function dispatchToolToBrowserBridge(
  toolName: string,
  args: Record<string, unknown>,
  source = 'mcp-bridge'
): Promise<unknown> {
  if (toolName.startsWith('memory_') || toolName.startsWith('graphify_')) {
    const memResult = await executeMemoryOrGraphifyTool(toolName, args);
    // Broadcast event to connected browser clients so UI refreshes live
    const eventPayload = JSON.stringify({
      type: 'memory_event',
      toolName,
      args,
      result: memResult,
    });
    for (const client of sseClients) {
      client.write(`data: ${eventPayload}\n\n`);
    }
    return memResult;
  }

  if (sseClients.size === 0) {
    if (toolName === 'get_state' || toolName === 'get_project') {
      return { ok: true, headless: true, state: latestProjectState };
    }
    if (toolName === 'command_list') {
      return { ok: true, tools: MCP_SERVER_TOOLS_SCHEMA };
    }
    return {
      ok: true,
      queued: false,
      note: 'Executed in headless MCP mode (open http://localhost:5173 in browser for live canvas synchronization).',
      toolName,
      args,
    };
  }

  const requestId = `mcp-req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const payload = JSON.stringify({
    type: 'mcp_tool_call',
    requestId,
    toolName,
    args,
    source,
  });

  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCalls.delete(requestId);
      resolve({
        ok: true,
        timeoutFallback: true,
        state: latestProjectState,
      });
    }, 6000);

    pendingCalls.set(requestId, {
      requestId,
      resolve,
      reject,
      timer,
    });
  });
}

async function callExternalAiProvider(body: {
  provider: 'openai' | 'anthropic' | 'gemini' | 'custom';
  apiKey: string;
  model: string;
  endpoint?: string;
  prompt: string;
  projectState: unknown;
  tools: unknown[];
}): Promise<{
  reply: string;
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
}> {
  const systemPrompt = `You are the AI Video Editing Agent integrated into MotionLab Professional NLE via Model Context Protocol (MCP).
Current sequence state: ${JSON.stringify(body.projectState)}
When the user asks to create, edit, trim, split, add titles, apply transitions, adjust color, or mix audio, call the appropriate MotionLab MCP tools.`;

  if (body.provider === 'openai' || body.provider === 'custom') {
    const url =
      body.provider === 'custom' && body.endpoint
        ? body.endpoint
        : 'https://api.openai.com/v1/chat/completions';

    const openAiTools = (body.tools as Array<{ name: string; description: string; inputSchema: unknown }>).map(
      (t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      })
    );

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${body.apiKey}`,
      },
      body: JSON.stringify({
        model: body.model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: body.prompt },
        ],
        tools: openAiTools,
        tool_choice: 'auto',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI/Codex API error (${res.status}): ${errText.slice(0, 240)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };
    const msg = data.choices?.[0]?.message;
    const toolCalls = (msg?.tool_calls || []).map((tc) => ({
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || '{}'),
    }));

    return {
      reply:
        msg?.content ||
        `Executed ${toolCalls.length} MCP tool call(s) via ${body.model}.`,
      toolCalls,
    };
  }

  if (body.provider === 'anthropic') {
    const claudeTools = (body.tools as Array<{ name: string; description: string; inputSchema: unknown }>).map(
      (t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      })
    );

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': body.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: body.model || 'claude-3-7-sonnet-latest',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: body.prompt }],
        tools: claudeTools,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API error (${res.status}): ${errText.slice(0, 240)}`);
    }

    const data = (await res.json()) as {
      content?: Array<{
        type: string;
        text?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;
    };

    const textParts: string[] = [];
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    for (const block of data.content || []) {
      if (block.type === 'text' && block.text) textParts.push(block.text);
      if (block.type === 'tool_use' && block.name) {
        toolCalls.push({
          name: block.name,
          arguments: block.input || {},
        });
      }
    }

    return {
      reply:
        textParts.join('\n') ||
        `Executed ${toolCalls.length} MCP tool call(s) via Claude.`,
      toolCalls,
    };
  }

  // Gemini / Antigravity API
  const geminiModel = body.model || 'gemini-2.5-flash';
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(
    body.apiKey
  )}`;

  const functionDeclarations = (body.tools as Array<{ name: string; description: string; inputSchema: unknown }>).map(
    (t) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    })
  );

  const res = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: body.prompt }] }],
      tools: [{ functionDeclarations }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 240)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name: string; args: Record<string, unknown> };
        }>;
      };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts || [];
  const textParts: string[] = [];
  const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

  for (const part of parts) {
    if (part.text) textParts.push(part.text);
    if (part.functionCall) {
      toolCalls.push({
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
      });
    }
  }

  return {
    reply:
      textParts.join('\n') ||
      `Executed ${toolCalls.length} MCP tool call(s) via Gemini.`,
    toolCalls,
  };
}

export function mcpBridgePlugin(): Plugin {
  const handleMcp = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ) => {
    const url = req.url || '';
    if (
      !url.startsWith('/api/mcp') &&
      !url.startsWith('/api/memory') &&
      !url.startsWith('/api/voicebox')
    ) {
      next();
      return;
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.end();
      return;
    }

    try {
      const parsedUrl = new URL(url, 'http://localhost');
      const pathname = parsedUrl.pathname;

      // ==========================================
      // Voicebox Local REST Proxy (with SSRF Protection)
      // ==========================================
      if (pathname.startsWith('/api/voicebox')) {
        const VOICEBOX_UPSTREAM = process.env.VOICEBOX_URL || 'http://127.0.0.1:17493';
        // Enforce SSRF protection: only loopback host allowed
        const upstreamUrl = new URL(VOICEBOX_UPSTREAM);
        if (
          upstreamUrl.hostname !== '127.0.0.1' &&
          upstreamUrl.hostname !== 'localhost'
        ) {
          sendJson(res, 403, { ok: false, error: 'SSRF blocked: Voicebox upstream must be a local loopback address' });
          return;
        }

        const subPath = pathname.replace('/api/voicebox', '') || '/';

        if (subPath === '/health') {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2000);
            const check = await fetch(`${VOICEBOX_UPSTREAM}/health`, {
              signal: controller.signal,
            }).finally(() => clearTimeout(timer));

            if (check.ok) {
              const data = (await check.json()) as Record<string, any>;
              sendJson(res, 200, {
                ok: true,
                connected: true,
                engine: data.engine || 'kokoro',
                version: data.version || '0.19-onnx',
                model: data.model || 'Kokoro-82M',
                engines: data.engines || ['kokoro'],
                voices: data.voices || [],
              });
              return;
            }
          } catch {
            // Service offline
          }

          sendJson(res, 200, {
            ok: false,
            connected: false,
            version: 'offline',
            error: 'Neural Voice Engine Offline — Ensure Kokoro-82M service is running on port 17493',
            engines: [],
          });
          return;
        }

        // Proxy other requests to local Kokoro/Voicebox backend
        try {
          const bodyData = (req.method === 'POST' || req.method === 'PUT') ? await readBodyJson(req) : undefined;
          const upstreamRes = await fetch(`${VOICEBOX_UPSTREAM}${subPath}${parsedUrl.search}`, {
            method: req.method,
            headers: {
              'Content-Type': 'application/json',
              Accept: req.headers.accept || '*/*',
            },
            body: bodyData ? JSON.stringify(bodyData) : undefined,
          });

          res.statusCode = upstreamRes.status;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader(
            'Access-Control-Expose-Headers',
            'X-Audio-Duration, X-Audio-Sample-Rate, X-Audio-Quality, Content-Length'
          );
          const contentType = upstreamRes.headers.get('content-type');
          if (contentType) res.setHeader('Content-Type', contentType);
          const duration = upstreamRes.headers.get('x-audio-duration');
          if (duration) res.setHeader('X-Audio-Duration', duration);
          const sampleRate = upstreamRes.headers.get('x-audio-sample-rate');
          if (sampleRate) res.setHeader('X-Audio-Sample-Rate', sampleRate);
          const quality = upstreamRes.headers.get('x-audio-quality');
          if (quality) res.setHeader('X-Audio-Quality', quality);

          const arrayBuf = await upstreamRes.arrayBuffer();
          res.end(Buffer.from(arrayBuf));
          return;
        } catch (err: unknown) {
          sendJson(res, 503, {
            ok: false,
            error: 'Kokoro Neural TTS backend unreachable',
            fallbackAvailable: false,
          });
          return;
        }
      }

      // Memory API routes
      if (pathname.startsWith('/api/memory')) {
        if (pathname === '/api/memory/health' && req.method === 'GET') {
          const obsHealth = await obsidianVault.getStatus();
          const graphHealth = await graphifyService.getStatus();
          sendJson(res, 200, {
            ok: true,
            obsidian: obsHealth,
            graphify: graphHealth,
            status: obsHealth.connected && graphHealth.available ? 'healthy' : 'degraded',
          });
          return;
        }

        if (pathname === '/api/memory/list' && req.method === 'GET') {
          const category = parsedUrl.searchParams.get('category');
          const type = parsedUrl.searchParams.get('type');
          const approvalStatus = parsedUrl.searchParams.get('approvalStatus');
          const projectId = parsedUrl.searchParams.get('projectId');
          const limitStr = parsedUrl.searchParams.get('limit');
          const records = await obsidianVault.listMemories({
            category: category ? (category.includes(',') ? (category.split(',') as any) : (category as any)) : undefined,
            type: type ? (type.includes(',') ? (type.split(',') as any) : (type as any)) : undefined,
            approvalStatus: (approvalStatus as any) || undefined,
            projectId: projectId || undefined,
            limit: limitStr ? parseInt(limitStr, 10) : undefined,
          });
          sendJson(res, 200, { ok: true, count: records.length, records });
          return;
        }

        if (pathname === '/api/memory/get' && req.method === 'GET') {
          const id = parsedUrl.searchParams.get('id');
          if (!id) {
            sendJson(res, 400, { ok: false, error: 'Missing id query parameter' });
            return;
          }
          const record = await obsidianVault.getMemory(id);
          if (!record) {
            sendJson(res, 404, { ok: false, error: `Memory ${id} not found` });
            return;
          }
          sendJson(res, 200, { ok: true, record });
          return;
        }

        if (pathname === '/api/memory/search' && (req.method === 'POST' || req.method === 'GET')) {
          let query = '';
          let options: Record<string, unknown> = {};
          if (req.method === 'POST') {
            const body = await readBodyJson(req);
            query = String(body.query || '');
            options = body;
          } else {
            query = parsedUrl.searchParams.get('query') || '';
            options = {
              category: parsedUrl.searchParams.get('category') || undefined,
              type: parsedUrl.searchParams.get('type') || undefined,
              limit: parsedUrl.searchParams.get('limit') ? parseInt(parsedUrl.searchParams.get('limit')!, 10) : undefined,
            };
          }
          const results = await obsidianVault.searchMemories(query, options as any);
          sendJson(res, 200, { ok: true, results });
          return;
        }

        if (pathname === '/api/memory/save' && req.method === 'POST') {
          const body = await readBodyJson(req);
          const record = await obsidianVault.saveMemory({
            title: String(body.title || 'Untitled Memory'),
            content: String(body.content || ''),
            category: (body.category || 'design-principle') as any,
            type: (body.type || 'design-principle') as any,
            tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
            sourceType: (body.sourceType || 'user-instruction') as any,
            projectId: body.projectId ? String(body.projectId) : undefined,
            confidence: typeof body.confidence === 'number' ? body.confidence : 0.95,
            approvalStatus: (body.approvalStatus as any) || 'approved',
            validationStatus: (body.validationStatus as any) || 'validated',
          });
          sendJson(res, 200, { ok: true, record });
          return;
        }

        if (pathname === '/api/memory/propose' && req.method === 'POST') {
          const body = await readBodyJson(req);
          const record = await obsidianVault.saveMemory({
            title: String(body.title || 'Untitled Proposal'),
            content: String(body.content || ''),
            category: (body.category || 'ai-skill') as any,
            type: (body.type || 'ai-suggestion') as any,
            tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
            sourceType: (body.sourceType || 'ai-observation') as any,
            projectId: body.projectId ? String(body.projectId) : undefined,
            confidence: typeof body.confidence === 'number' ? body.confidence : 0.85,
            approvalStatus: 'proposed',
            validationStatus: 'pending',
          });
          sendJson(res, 200, { ok: true, record });
          return;
        }

        if (pathname === '/api/memory/approve' && req.method === 'POST') {
          const body = await readBodyJson(req);
          const id = String(body.id || '');
          if (!id) {
            sendJson(res, 400, { ok: false, error: 'Missing id in body' });
            return;
          }
          const record = await obsidianVault.approveMemory(id);
          sendJson(res, 200, { ok: true, record });
          return;
        }

        if (pathname === '/api/memory/archive' && req.method === 'POST') {
          const body = await readBodyJson(req);
          const id = String(body.id || '');
          const ok = await obsidianVault.archiveMemory(id);
          sendJson(res, 200, { ok, id });
          return;
        }

        if (pathname === '/api/memory/delete' && (req.method === 'POST' || req.method === 'DELETE')) {
          const body = req.method === 'POST' ? await readBodyJson(req) : {};
          const id = String(body.id || parsedUrl.searchParams.get('id') || '');
          const ok = await obsidianVault.deleteMemory(id);
          sendJson(res, 200, { ok, id });
          return;
        }

        if (pathname === '/api/memory/consolidate' && req.method === 'POST') {
          const records = await obsidianVault.listMemories();
          const clusters = MemoryConsolidator.findDuplicateClusters(records);
          sendJson(res, 200, { ok: true, clusterCount: clusters.length, clusters });
          return;
        }

        if (pathname === '/api/memory/session-summary') {
          if (req.method === 'POST') {
            const body = await readBodyJson(req);
            const summary = await obsidianVault.saveSessionSummary(body as any);
            sendJson(res, 200, { ok: true, summary });
            return;
          }
          if (req.method === 'GET') {
            const projectId = parsedUrl.searchParams.get('projectId') || undefined;
            const summary = await obsidianVault.getLatestSessionSummary(projectId);
            sendJson(res, 200, { ok: true, summary });
            return;
          }
        }

        if (pathname === '/api/memory/graphify/query' && req.method === 'POST') {
          const body = await readBodyJson(req);
          const result = await graphifyService.query(body);
          sendJson(res, 200, { ok: true, ...result });
          return;
        }

        if (pathname === '/api/memory/graphify/status' && req.method === 'GET') {
          const status = await graphifyService.getStatus();
          sendJson(res, 200, { ok: true, status });
          return;
        }

        if (pathname === '/api/memory/graphify/reindex' && req.method === 'POST') {
          const result = await graphifyService.reindex();
          sendJson(res, 200, { ...result });
          return;
        }

        sendJson(res, 404, { ok: false, error: 'Unknown memory endpoint' });
        return;
      }
      // 1. Browser SSE Bridge Connection
      if (url.startsWith('/api/mcp/bridge-stream') && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        res.write(
          `data: ${JSON.stringify({
            type: 'bridge_connected',
            connectedClients: sseClients.size + 1,
          })}\n\n`
        );
        sseClients.add(res);
        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      // 2. Browser State Sync
      if (url === '/api/mcp/sync-state' && req.method === 'POST') {
        const body = await readBodyJson(req);
        if (body.state && typeof body.state === 'object') {
          latestProjectState = body.state as Record<string, unknown>;
        }
        sendJson(res, 200, { ok: true, connectedClients: sseClients.size });
        return;
      }

      // 3. Browser Tool Call Result Callback
      if (url === '/api/mcp/bridge-result' && req.method === 'POST') {
        const body = await readBodyJson(req);
        const requestId = String(body.requestId || '');
        const pending = pendingCalls.get(requestId);
        if (pending) {
          clearTimeout(pending.timer);
          pendingCalls.delete(requestId);
          pending.resolve(body.result);
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      // 4. MCP Status & Tool Discovery REST Endpoint
      if (url === '/api/mcp/status' && req.method === 'GET') {
        sendJson(res, 200, {
          ok: true,
          serverName: 'MotionLab-MCP',
          protocolVersion: '2024-11-05',
          bridgeConnected: sseClients.size > 0,
          activeClients: sseClients.size,
          toolCount: MCP_SERVER_TOOLS_SCHEMA.length,
          supportedAgents: [
            'Antigravity (Google DeepMind)',
            'ChatGPT / OpenAI Codex',
            'Claude Desktop / Claude Code',
            'Cursor / Windsurf',
            'Custom OpenAI / MCP Client',
          ],
          tools: MCP_SERVER_TOOLS_SCHEMA,
        });
        return;
      }

      // 5. Direct HTTP Tool Execution Endpoint (used by stdio MCP bridge or REST clients)
      if (url === '/api/mcp/call' && req.method === 'POST') {
        const body = await readBodyJson(req);
        const toolName = String(body.name || body.toolName || 'get_state');
        const args = (body.arguments || body.args || {}) as Record<string, unknown>;
        const source = String(body.source || 'mcp-bridge');
        const result = await dispatchToolToBrowserBridge(toolName, args, source);
        sendJson(res, 200, { ok: true, result });
        return;
      }

      // 6. Standard MCP JSON-RPC 2.0 Endpoint (Streamable HTTP for Antigravity / Claude / Codex / Cursor)
      if (url === '/api/mcp/rpc' && req.method === 'POST') {
        const rpc = await readBodyJson(req);
        const id = rpc.id ?? null;
        const method = String(rpc.method || '');
        const params = (rpc.params || {}) as Record<string, unknown>;

        if (method === 'initialize') {
          sendJson(res, 200, {
            jsonrpc: '2.0',
            id,
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
          return;
        }

        if (method === 'notifications/initialized') {
          sendJson(res, 200, { jsonrpc: '2.0', id, result: {} });
          return;
        }

        if (method === 'tools/list') {
          sendJson(res, 200, {
            jsonrpc: '2.0',
            id,
            result: {
              tools: MCP_SERVER_TOOLS_SCHEMA,
            },
          });
          return;
        }

        if (method === 'resources/list') {
          sendJson(res, 200, {
            jsonrpc: '2.0',
            id,
            result: {
              resources: [
                {
                  uri: 'motionlab://project/current',
                  name: 'Current MotionLab Sequence State',
                  mimeType: 'application/json',
                  description: 'Live timeline tracks, clips, media assets, and format settings',
                },
              ],
            },
          });
          return;
        }

        if (method === 'resources/read') {
          sendJson(res, 200, {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri: 'motionlab://project/current',
                  mimeType: 'application/json',
                  text: JSON.stringify(latestProjectState, null, 2),
                },
              ],
            },
          });
          return;
        }

        if (method === 'tools/call') {
          const toolName = String(params.name || '');
          const toolArgs = (params.arguments || {}) as Record<string, unknown>;
          const toolResult = await dispatchToolToBrowserBridge(
            toolName,
            toolArgs,
            'mcp-bridge'
          );
          sendJson(res, 200, {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(toolResult, null, 2),
                },
              ],
            },
          });
          return;
        }

        sendJson(res, 200, {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
        return;
      }

      // 7. Multi-Provider AI Agent Proxy (ChatGPT/Codex, Claude, Antigravity/Gemini, Custom)
      if (url === '/api/mcp/ai-chat' && req.method === 'POST') {
        const body = (await readBodyJson(req)) as unknown as Parameters<
          typeof callExternalAiProvider
        >[0];
        const aiResult = await callExternalAiProvider(body);
        sendJson(res, 200, { ok: true, ...aiResult });
        return;
      }

      sendJson(res, 404, { error: 'Unknown MCP endpoint' });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : 'MCP Server Error',
      });
    }
  };

  return {
    name: 'motionlab-mcp-bridge',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleMcp(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleMcp(req, res, next);
      });
    },
  };
}
