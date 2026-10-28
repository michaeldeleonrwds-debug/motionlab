import { useEditorStore } from '../store/useEditorStore';
import {
  getCompositedVisualClipsAtTime,
  getProjectDuration,
  getResolutionDimensions,
} from './timelineEngine';
import { evaluateClipTransform } from './keyframeEngine';
import { generateExportCompositionSpec } from './exportEngine';
import {
  createDefaultColorEffects,
  createDefaultCrop,
  createDefaultMask,
} from './projectFactory';
import { importMediaFile } from './mediaImportEngine';
import type {
  AspectRatio,
  FrameRate,
  KeyframeEasing,
  KeyframeProperty,
  MaskShape,
  ProceduralShapeType,
  ResolutionPreset,
  ShapeStyle,
  TextAnimationPreset,
  TimelineClip,
  TrackType,
  TransitionType,
} from '../types/editor';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpToolExecutionLog {
  id: string;
  timestamp: number;
  source: 'antigravity' | 'chatgpt-codex' | 'claude' | 'custom-ai' | 'mcp-bridge' | 'user-console';
  toolName: string;
  args: Record<string, unknown>;
  status: 'success' | 'error';
  result: unknown;
  durationMs: number;
}

export const MOTIONLAB_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'get_state',
    description:
      'Inspect the complete current MotionLab project state, including sequence format, tracks, clips, media assets, playhead timecode, and selection.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'command_list',
    description:
      'List all available MotionLab NLE engine commands and their parameter schemas.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'command_run',
    description:
      'Run any MotionLab engine command by id with JSON params. All edits are undoable.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Command ID (e.g. project.create, project.buildAngoraBeyondOrdinary, clip.addShape, clip.addMedia, clip.addText, clip.setMask, clip.setParent, preview.capture, keyframe.add, time.set)',
        },
        params: {
          type: 'object',
          description: 'Command parameters object',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'command_batch',
    description:
      'Execute a sequential batch of MotionLab commands or MCP tool calls atomically in order.',
    inputSchema: {
      type: 'object',
      properties: {
        commands: {
          type: 'array',
          description: 'Array of { name, arguments } or { id, params } steps to run sequentially',
          items: {
            type: 'object',
          },
        },
      },
      required: ['commands'],
    },
  },
  {
    name: 'create_project',
    description:
      'Create a new video editing project sequence with specified name, aspect ratio (16:9, 9:16, 1:1, 4:5), resolution (1080p, 720p), and frame rate (24, 30, 60) while preserving existing projects in IndexedDB.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project sequence name' },
        aspectRatio: {
          type: 'string',
          enum: ['16:9', '9:16', '1:1', '4:5'],
          description: 'Sequence aspect ratio',
        },
        resolution: {
          type: 'string',
          enum: ['1080p', '720p'],
          description: 'Output resolution preset',
        },
        fps: {
          type: 'number',
          enum: [24, 30, 60],
          description: 'Sequence frame rate',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'set_project_format',
    description:
      'Update the current project aspect ratio, output resolution, or frame rate.',
    inputSchema: {
      type: 'object',
      properties: {
        aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:5'] },
        resolution: { type: 'string', enum: ['1080p', '720p'] },
        fps: { type: 'number', enum: [24, 30, 60] },
      },
    },
  },
  {
    name: 'load_studio_media',
    description:
      'Import the locally generated studio test media assets (clip-a-studio.mp4, clip-b-motion.mp4, ambient-score.wav, graphic-card.png) into the Media Library.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'build_angora_promo',
    description:
      'Construct and load the 15-second ANGORA — Agency Promo V2 motion graphics advertisement and save it to IndexedDB.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'build_angora_beyond_ordinary',
    description:
      'Construct and load the 23.0-second (690 frames @ 30 FPS, 1080×1920 9:16) "ANGORA — BEYOND ORDINARY | Motion Design Film" across 10 tracks (V1-V8, A1-A2) with 5 distinct sequences while preserving existing Angora projects in IndexedDB.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'build_angora_editorial_promo',
    description:
      'Construct and load the 15.0-second (450 frames @ 30 FPS, 1080×1920 9:16) "ANGORA — Editorial Kinetic Promo (15s)" featuring all 7 art-directed scenes across 8 tracks (V1-V6, A1-A2) with collage cutouts, Swiss typography, filmstrip UI, web mockups, automation nodes, and sound design.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'add_shape_layer',
    description:
      'Add a procedural vector/architectural shape layer clip (rectangle, circle, ring, line, grid, crosshair, polygon, angora-chevron, browser-world, poster-world, timeline-world, node-world, explosion-lattice) with Trim Paths (trimEnd) and 2.5D skew support.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        trackId: { type: 'string' },
        shapeType: {
          type: 'string',
          enum: [
            'rectangle',
            'circle',
            'ring',
            'line',
            'grid',
            'crosshair',
            'polygon',
            'angora-chevron',
            'browser-world',
            'poster-world',
            'timeline-world',
            'node-world',
            'explosion-lattice',
          ],
        },
        startTime: { type: 'number' },
        duration: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        fillColor: { type: 'string' },
        fillOpacity: { type: 'number' },
        strokeColor: { type: 'string' },
        strokeWidth: { type: 'number' },
        cornerRadius: { type: 'number' },
        trimEnd: { type: 'number' },
        x: { type: 'number' },
        y: { type: 'number' },
        scale: { type: 'number' },
        rotation: { type: 'number' },
        skewX: { type: 'number' },
        skewY: { type: 'number' },
        motionBlur: { type: 'boolean' },
      },
      required: ['shapeType'],
    },
  },
  {
    name: 'set_clip_mask',
    description:
      'Configure an animated geometric reveal mask (none, rectangle, ellipse, circle, linear-wipe, radial-reveal) on a clip.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        shape: {
          type: 'string',
          enum: ['none', 'rectangle', 'ellipse', 'circle', 'linear-wipe', 'radial-reveal'],
        },
        centerX: { type: 'number' },
        centerY: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        radius: { type: 'number' },
        feather: { type: 'number' },
        rotation: { type: 'number' },
        invert: { type: 'boolean' },
      },
      required: ['shape'],
    },
  },
  {
    name: 'set_clip_parent',
    description:
      'Link a child clip to a parent clip ID for hierarchical parent-child transform inheritance.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        parentId: { type: 'string' },
      },
      required: ['clipId'],
    },
  },
  {
    name: 'capture_preview_frame',
    description:
      'Seek the timeline to a timestamp (in seconds), render the composition on the 1080×1920 preview canvas, and return visual telemetry (non-black ratio, lime/white pixel metrics, active layers, and evaluated transforms).',
    inputSchema: {
      type: 'object',
      properties: {
        time: { type: 'number', description: 'Timestamp in seconds to inspect' },
      },
    },
  },
  {
    name: 'add_media_clip',
    description:
      'Add an imported media asset (by assetId or filename) onto a timeline track at an optional startTime (in seconds).',
    inputSchema: {
      type: 'object',
      properties: {
        assetIdOrName: {
          type: 'string',
          description: 'Media asset ID or filename (e.g. "clip-a-studio.mp4")',
        },
        trackId: {
          type: 'string',
          description: 'Optional target track ID',
        },
        startTime: {
          type: 'number',
          description: 'Optional timeline start time in seconds',
        },
      },
      required: ['assetIdOrName'],
    },
  },
  {
    name: 'add_text_layer',
    description:
      'Add an animated text/title overlay clip to the timeline with customizable typography, colors, stroke, shadow, and motion preset.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Text content to display' },
        startTime: { type: 'number', description: 'Start time in seconds' },
        duration: { type: 'number', description: 'Duration in seconds (default 3.0)' },
        fontFamily: { type: 'string', description: 'Font family (Inter, JetBrains Mono, Georgia, Impact, Arial)' },
        fontSize: { type: 'number', description: 'Font size in pt (default 64)' },
        color: { type: 'string', description: 'Hex text color (e.g. #ffffff)' },
        backgroundColor: { type: 'string', description: 'Hex background plate color' },
        backgroundOpacity: { type: 'number', description: 'Background opacity 0..1' },
        animationIn: {
          type: 'string',
          enum: ['none', 'fade-in', 'slide-in', 'zoom-in', 'typewriter', 'char-stagger', 'word-stagger', 'tracking-pull'],
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
      'Trim a timeline clip by adjusting its startTime (left trim) or duration (right trim).',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: {
          type: 'string',
          description: 'Target clip ID (or omit to use currently selected clip)',
        },
        newStartTime: {
          type: 'number',
          description: 'Optional new start time in seconds (left trim)',
        },
        newDuration: {
          type: 'number',
          description: 'Optional new duration in seconds (right trim)',
        },
      },
    },
  },
  {
    name: 'split_clip',
    description:
      'Split a timeline clip into two contiguous clips at splitTime (or at the current playhead if omitted).',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: {
          type: 'string',
          description: 'Optional clip ID to split (defaults to selected clip or clip under playhead)',
        },
        splitTime: {
          type: 'number',
          description: 'Timeline timestamp in seconds where the split occurs',
        },
      },
    },
  },
  {
    name: 'move_clip',
    description:
      'Move a clip horizontally to a new startTime or vertically to another compatible track.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'Target clip ID' },
        startTime: { type: 'number', description: 'New timeline startTime in seconds' },
        trackId: { type: 'string', description: 'Optional target track ID' },
      },
      required: ['startTime'],
    },
  },
  {
    name: 'delete_clip',
    description: 'Delete a clip from the timeline by clipId (or delete the currently selected clip).',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'Optional clip ID to delete' },
      },
    },
  },
  {
    name: 'set_transition',
    description:
      'Apply a visual transition (cross-dissolve, fade-from-black, fade-to-black, slide-left, wipe-right) to a clip.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: {
          type: 'string',
          description: 'Optional clip ID (defaults to selected clip or second video clip)',
        },
        edge: {
          type: 'string',
          enum: ['in', 'out'],
          description: 'Transition edge (in or out)',
        },
        type: {
          type: 'string',
          enum: ['none', 'cross-dissolve', 'fade-from-black', 'fade-to-black', 'slide-left', 'wipe-right'],
        },
        duration: {
          type: 'number',
          description: 'Transition duration in seconds (0.1 to 2.5)',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'set_color_effects',
    description:
      'Adjust optical and color grading parameters (brightness, contrast, saturation, exposure, blur, grayscale, sepia, flipH, flipV) on a clip.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'Optional clip ID (defaults to selected clip)' },
        brightness: { type: 'number', description: '-100 to 100' },
        contrast: { type: 'number', description: '-100 to 100' },
        saturation: { type: 'number', description: '-100 to 100' },
        exposure: { type: 'number', description: '-100 to 100' },
        blur: { type: 'number', description: '0 to 40 px' },
        grayscale: { type: 'number', description: '0 to 100 %' },
        sepia: { type: 'number', description: '0 to 100 %' },
        flipH: { type: 'boolean' },
        flipV: { type: 'boolean' },
      },
    },
  },
  {
    name: 'set_transform_and_crop',
    description:
      'Update position (x, y), scale, rotation, skewX, skewY, opacity, playbackSpeed, or non-destructive crop (left, right, top, bottom %) on a clip.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        scale: { type: 'number' },
        rotation: { type: 'number' },
        skewX: { type: 'number' },
        skewY: { type: 'number' },
        opacity: { type: 'number' },
        playbackSpeed: { type: 'number' },
        cropLeft: { type: 'number' },
        cropRight: { type: 'number' },
        cropTop: { type: 'number' },
        cropBottom: { type: 'number' },
      },
    },
  },
  {
    name: 'add_keyframe',
    description:
      'Insert or update a time-based animation keyframe (x, y, scale, rotation, opacity, skewX, skewY, trimEnd, maskX, maskY, maskWidth, maskHeight) on a clip.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        property: {
          type: 'string',
          enum: [
            'x',
            'y',
            'scale',
            'rotation',
            'opacity',
            'skewX',
            'skewY',
            'trimEnd',
            'maskX',
            'maskY',
            'maskWidth',
            'maskHeight',
          ],
        },
        time: {
          type: 'number',
          description: 'Time offset in seconds from clip start',
        },
        value: { type: 'number', description: 'Keyframe target value' },
        easing: {
          type: 'string',
          enum: [
            'linear',
            'ease-in',
            'ease-out',
            'ease-in-out',
            'cubic-bezier',
            'expo-out',
            'back-out',
          ],
        },
      },
      required: ['property', 'time', 'value'],
    },
  },
  {
    name: 'set_audio_envelope',
    description:
      'Adjust clip audio volume (0..2), mute state, fadeIn duration (s), and fadeOut duration (s).',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'Optional clip ID (defaults to selected or first audio clip)' },
        volume: { type: 'number', description: '0.0 to 2.0 (1.0 = 100%)' },
        muted: { type: 'boolean' },
        fadeIn: { type: 'number', description: 'Fade in seconds' },
        fadeOut: { type: 'number', description: 'Fade out seconds' },
      },
    },
  },
  {
    name: 'seek_playhead',
    description: 'Move the timeline playhead to a specific timestamp in seconds or control playback.',
    inputSchema: {
      type: 'object',
      properties: {
        time: { type: 'number', description: 'Target timestamp in seconds' },
        playing: { type: 'boolean', description: 'Optional play/pause state' },
      },
    },
  },
  {
    name: 'undo_redo',
    description: 'Perform undo or redo on the timeline history stack, or add a new track.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['undo', 'redo', 'add_track'],
        },
        trackType: {
          type: 'string',
          enum: ['video', 'overlay', 'text', 'audio'],
        },
      },
      required: ['action'],
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

function resolveTargetClipId(explicitClipId?: unknown): string | null {
  const state = useEditorStore.getState();
  if (typeof explicitClipId === 'string' && explicitClipId.trim()) {
    const exact = state.project.clips.find(
      (c) =>
        c.id === explicitClipId ||
        c.name.toLowerCase() === explicitClipId.toLowerCase()
    );
    if (exact) return exact.id;
    // Support "#1", "#2" 1-based index notation like EffectCraft
    if (explicitClipId.startsWith('#')) {
      const idx = parseInt(explicitClipId.slice(1), 10) - 1;
      if (idx >= 0 && idx < state.project.clips.length) {
        return state.project.clips[idx].id;
      }
    }
  }
  if (state.selectedClipId) return state.selectedClipId;
  if (state.project.clips.length > 0) {
    return state.project.clips[state.project.clips.length - 1].id;
  }
  return null;
}

export function buildCompactProjectSummary() {
  const state = useEditorStore.getState();
  const { project, currentTime, isPlaying, selectedClipId, projectList } = state;
  const dims = getResolutionDimensions(project.aspectRatio, project.resolution);
  return {
    projectId: project.id,
    name: project.name,
    aspectRatio: project.aspectRatio,
    resolution: project.resolution,
    dimensions: dims,
    fps: project.fps,
    durationSeconds: getProjectDuration(project.clips),
    currentTime,
    isPlaying,
    selectedClipId,
    savedProjectsInDB: projectList.map((p) => ({
      id: p.id,
      name: p.name,
      aspectRatio: p.aspectRatio,
      resolution: p.resolution,
      fps: p.fps,
      clipCount: p.clipCount,
    })),
    tracks: project.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      order: t.order,
      muted: t.muted,
      visible: t.visible,
      locked: t.locked,
    })),
    mediaAssets: project.mediaAssets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      duration: a.duration,
      width: a.width,
      height: a.height,
      hasAudio: a.hasAudio,
      codecInfo: a.codecInfo,
    })),
    clips: project.clips.map((c, idx) => ({
      index: `#${idx + 1}`,
      id: c.id,
      name: c.name,
      type: c.type,
      trackId: c.trackId,
      parentId: c.parentId,
      motionBlur: c.motionBlur,
      startTime: c.startTime,
      duration: c.duration,
      inPoint: c.inPoint,
      outPoint: c.outPoint,
      playbackSpeed: c.playbackSpeed,
      transform: {
        x: c.x,
        y: c.y,
        scale: c.scale,
        rotation: c.rotation,
        skewX: c.skewX ?? 0,
        skewY: c.skewY ?? 0,
        opacity: c.opacity,
      },
      mask: c.mask,
      shapeStyle: c.shapeStyle,
      effects: c.effects,
      crop: c.crop,
      audio: {
        volume: c.volume,
        muted: c.muted,
        fadeIn: c.fadeIn,
        fadeOut: c.fadeOut,
      },
      transitionIn: c.transitionIn,
      transitionOut: c.transitionOut,
      textStyle: c.textStyle,
      keyframeCount: c.keyframes.length,
    })),
  };
}

/**
 * Executes a single MCP tool or engine command deterministically against the live MotionLab store.
 */
export async function executeMcpToolCall(
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const store = useEditorStore.getState();

  switch (toolName) {
    case 'get_state':
    case 'get_project':
    case 'doc_inspect': {
      return {
        ok: true,
        state: buildCompactProjectSummary(),
      };
    }

    case 'command_list':
    case 'list_commands': {
      return {
        ok: true,
        tools: MOTIONLAB_MCP_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        })),
      };
    }

    case 'command_run':
    case 'execute_command': {
      const cmdId = String(args.id || args.name || '');
      const params = (args.params || args.arguments || {}) as Record<string, unknown>;
      // Map EffectCraft-style dot commands as well as direct MCP tool names
      const aliasMap: Record<string, string> = {
        'comp.new': 'create_project',
        'project.create': 'create_project',
        'project.format': 'set_project_format',
        'project.buildAngoraPromo': 'build_angora_promo',
        'project.buildAngoraBeyondOrdinary': 'build_angora_beyond_ordinary',
        'project.buildAngoraEditorialPromo': 'build_angora_editorial_promo',
        'media.loadStudioFixtures': 'load_studio_media',
        'clip.addMedia': 'add_media_clip',
        'layer.newText': 'add_text_layer',
        'clip.addText': 'add_text_layer',
        'layer.newShape': 'add_shape_layer',
        'clip.addShape': 'add_shape_layer',
        'clip.setMask': 'set_clip_mask',
        'mask.set': 'set_clip_mask',
        'clip.setParent': 'set_clip_parent',
        'preview.capture': 'capture_preview_frame',
        'clip.trim': 'trim_clip',
        'clip.split': 'split_clip',
        'clip.move': 'move_clip',
        'clip.delete': 'delete_clip',
        'transition.set': 'set_transition',
        'effect.apply': 'set_color_effects',
        'effect.set': 'set_color_effects',
        'transform.set': 'set_transform_and_crop',
        'keyframe.add': 'add_keyframe',
        'audio.set': 'set_audio_envelope',
        'time.set': 'seek_playhead',
      };
      const resolvedTool = aliasMap[cmdId] || cmdId;
      if (resolvedTool === 'command_run') {
        throw new Error('Recursive command_run is not allowed');
      }
      return executeMcpToolCall(resolvedTool, params);
    }

    case 'command_batch':
    case 'batch': {
      const list = Array.isArray(args.commands) ? args.commands : [];
      const results: unknown[] = [];
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const step = item as Record<string, unknown>;
        const stepName = String(step.name || step.id || '');
        const stepArgs = (step.arguments || step.params || {}) as Record<
          string,
          unknown
        >;
        if (!stepName) continue;
        const res = await executeMcpToolCall(stepName, stepArgs);
        results.push({ tool: stepName, result: res });
      }
      return {
        ok: true,
        executedCount: results.length,
        results,
        state: buildCompactProjectSummary(),
      };
    }

    case 'create_project': {
      const name = String(args.name || 'AI Generated Sequence');
      const aspectRatio = (args.aspectRatio as AspectRatio) || '16:9';
      const resolution = (args.resolution as ResolutionPreset) || '1080p';
      const fps = (Number(args.fps) as FrameRate) || 30;
      await store.createNewProjectAction({ name, aspectRatio, resolution, fps });
      return {
        ok: true,
        message: `Created project "${name}" (${aspectRatio} ${resolution} @ ${fps}fps)`,
        state: buildCompactProjectSummary(),
      };
    }

    case 'set_project_format': {
      store.setProjectFormat({
        aspectRatio: args.aspectRatio as AspectRatio | undefined,
        resolution: args.resolution as ResolutionPreset | undefined,
        fps: args.fps ? (Number(args.fps) as FrameRate) : undefined,
      });
      return {
        ok: true,
        state: buildCompactProjectSummary(),
      };
    }

    case 'load_studio_media': {
      const fixtureFiles = [
        { url: '/test-media/clip-a-studio.mp4', name: 'clip-a-studio.mp4', type: 'video/mp4' },
        { url: '/test-media/clip-b-motion.mp4', name: 'clip-b-motion.mp4', type: 'video/mp4' },
        { url: '/test-media/ambient-score.wav', name: 'ambient-score.wav', type: 'audio/wav' },
        { url: '/test-media/graphic-card.png', name: 'graphic-card.png', type: 'image/png' },
      ];
      const currentAssets = useEditorStore.getState().project.mediaAssets;
      const newlyImported = [];
      for (const item of fixtureFiles) {
        if (currentAssets.some((a) => a.name === item.name)) continue;
        const res = await fetch(item.url);
        if (!res.ok) continue;
        const blob = await res.blob();
        const file = new File([blob], item.name, { type: item.type });
        const asset = await importMediaFile(file);
        newlyImported.push(asset);
      }
      if (newlyImported.length > 0) {
        useEditorStore.getState().addMediaAssets(newlyImported);
      }
      return {
        ok: true,
        importedCount: newlyImported.length,
        totalAssets: useEditorStore.getState().project.mediaAssets.length,
        assets: useEditorStore.getState().project.mediaAssets.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          duration: a.duration,
        })),
      };
    }

    case 'add_media_clip': {
      const query = String(args.assetIdOrName || '').trim();
      let currentAssets = useEditorStore.getState().project.mediaAssets;
      let asset = currentAssets.find(
        (a) =>
          a.id === query ||
          a.name.toLowerCase() === query.toLowerCase() ||
          a.name.toLowerCase().includes(query.toLowerCase())
      );

      // Auto-load studio media if asset is one of the studio fixtures and not yet loaded
      if (!asset && typeof window !== 'undefined') {
        await executeMcpToolCall('load_studio_media', {});
        currentAssets = useEditorStore.getState().project.mediaAssets;
        asset = currentAssets.find(
          (a) =>
            a.id === query ||
            a.name.toLowerCase() === query.toLowerCase() ||
            a.name.toLowerCase().includes(query.toLowerCase())
        );
      }

      if (!asset) {
        throw new Error(`Media asset "${query}" not found in project library.`);
      }

      const startTime =
        args.startTime !== undefined ? Number(args.startTime) : undefined;
      const targetTrackId =
        typeof args.trackId === 'string' ? args.trackId : undefined;

      const clipId = useEditorStore
        .getState()
        .addMediaClipToTimeline(asset.id, targetTrackId, startTime);
      return {
        ok: true,
        clipId,
        assetName: asset.name,
        state: buildCompactProjectSummary(),
      };
    }

    case 'add_text_layer': {
      const content = String(args.content || args.text || 'MotionLab Title');
      const startTime =
        args.startTime !== undefined ? Number(args.startTime) : undefined;
      const clipId = useEditorStore.getState().addTextClipToTimeline(
        content,
        {
          fontFamily: typeof args.fontFamily === 'string' ? args.fontFamily : 'Inter',
          fontSize: typeof args.fontSize === 'number' ? args.fontSize : 68,
          fontWeight: typeof args.fontWeight === 'number' ? args.fontWeight : 700,
          color: typeof args.color === 'string' ? args.color : '#ffffff',
          backgroundColor:
            typeof args.backgroundColor === 'string'
              ? args.backgroundColor
              : '#000000',
          backgroundOpacity:
            typeof args.backgroundOpacity === 'number'
              ? args.backgroundOpacity
              : 0.45,
          animationIn:
            (args.animationIn as TextAnimationPreset) || 'fade-in',
          animationOut:
            (args.animationOut as TextAnimationPreset) || 'fade-out',
        },
        startTime
      );

      if (typeof args.duration === 'number' && args.duration > 0.2) {
        useEditorStore.getState().updateClipProperties(clipId, {
          duration: args.duration,
          outPoint: args.duration,
        });
      }

      return {
        ok: true,
        clipId,
        content,
        state: buildCompactProjectSummary(),
      };
    }

    case 'trim_clip': {
      const clipId = resolveTargetClipId(args.clipId);
      if (!clipId) throw new Error('No target clip found to trim.');
      if (typeof args.newStartTime === 'number') {
        useEditorStore.getState().trimClipLeftAction(clipId, args.newStartTime);
      }
      if (typeof args.newDuration === 'number') {
        useEditorStore.getState().trimClipRightAction(clipId, args.newDuration);
      }
      return {
        ok: true,
        clipId,
        state: buildCompactProjectSummary(),
      };
    }

    case 'split_clip': {
      const splitTime =
        typeof args.splitTime === 'number'
          ? args.splitTime
          : useEditorStore.getState().currentTime;
      const clipId = resolveTargetClipId(args.clipId);
      let didSplit = false;
      if (clipId) {
        didSplit = useEditorStore.getState().splitClipById(clipId, splitTime);
      }
      if (!didSplit) {
        useEditorStore.getState().setCurrentTime(splitTime);
        didSplit = useEditorStore.getState().splitSelectedClipAtPlayhead();
      }
      return {
        ok: didSplit,
        splitTime,
        state: buildCompactProjectSummary(),
      };
    }

    case 'move_clip': {
      const clipId = resolveTargetClipId(args.clipId);
      if (!clipId) throw new Error('No clip found to move.');
      const startTime = Number(args.startTime ?? 0);
      const trackId =
        typeof args.trackId === 'string' ? args.trackId : undefined;
      useEditorStore.getState().moveClip(clipId, startTime, trackId);
      return {
        ok: true,
        clipId,
        startTime,
        state: buildCompactProjectSummary(),
      };
    }

    case 'delete_clip': {
      const clipId = resolveTargetClipId(args.clipId);
      if (!clipId) throw new Error('No clip found to delete.');
      useEditorStore.getState().deleteClip(clipId);
      return {
        ok: true,
        deletedClipId: clipId,
        state: buildCompactProjectSummary(),
      };
    }

    case 'duplicate_clip': {
      const clipId = resolveTargetClipId(args.clipId);
      if (!clipId) throw new Error('No clip found to duplicate.');
      const newId = useEditorStore.getState().duplicateClip(clipId);
      return {
        ok: true,
        duplicatedClipId: newId,
        state: buildCompactProjectSummary(),
      };
    }

    case 'set_transition': {
      const transitionType =
        (args.type as TransitionType) || 'cross-dissolve';
      const duration =
        typeof args.duration === 'number' ? args.duration : 0.6;
      const edge =
        args.edge === 'out' || transitionType === 'fade-to-black'
          ? 'out'
          : 'in';

      let clipId = resolveTargetClipId(args.clipId);
      const clips = useEditorStore.getState().project.clips;
      const videoClips = clips
        .filter((c) => c.type === 'video' || c.type === 'image')
        .sort((a, b) => a.startTime - b.startTime);

      if (!args.clipId && videoClips.length >= 2 && edge === 'in') {
        clipId = videoClips[1].id;
      }

      if (!clipId) throw new Error('No visual clip found for transition.');
      useEditorStore
        .getState()
        .setClipTransition(clipId, edge, { type: transitionType, duration });

      return {
        ok: true,
        clipId,
        edge,
        transitionType,
        duration,
        state: buildCompactProjectSummary(),
      };
    }

    case 'set_color_effects': {
      const clipId = resolveTargetClipId(args.clipId);
      if (!clipId) throw new Error('No clip found for color/optical effects.');
      if (args.reset === true) {
        useEditorStore
          .getState()
          .updateClipColorEffects(clipId, createDefaultColorEffects());
      } else {
        const updates: Record<string, unknown> = {};
        for (const k of [
          'brightness',
          'contrast',
          'saturation',
          'exposure',
          'blur',
          'grayscale',
          'sepia',
          'flipH',
          'flipV',
        ]) {
          if (args[k] !== undefined) updates[k] = args[k];
        }
        useEditorStore.getState().updateClipColorEffects(clipId, updates);
      }
      return {
        ok: true,
        clipId,
        state: buildCompactProjectSummary(),
      };
    }

    case 'set_transform_and_crop': {
      const clipId = resolveTargetClipId(args.clipId);
      if (!clipId) throw new Error('No clip found for transform/crop update.');
      const propUpdates: Record<string, unknown> = {};
      for (const k of ['x', 'y', 'scale', 'rotation', 'skewX', 'skewY', 'opacity']) {
        if (typeof args[k] === 'number') propUpdates[k] = args[k];
      }
      if (typeof args.motionBlur === 'boolean') {
        propUpdates.motionBlur = args.motionBlur;
      }
      if (Object.keys(propUpdates).length > 0) {
        useEditorStore.getState().updateClipProperties(clipId, propUpdates);
      }
      if (typeof args.playbackSpeed === 'number') {
        useEditorStore.getState().updateClipSpeed(clipId, args.playbackSpeed);
      }
      const cropUpdates: Record<string, number> = {};
      if (typeof args.cropLeft === 'number') cropUpdates.left = args.cropLeft;
      if (typeof args.cropRight === 'number') cropUpdates.right = args.cropRight;
      if (typeof args.cropTop === 'number') cropUpdates.top = args.cropTop;
      if (typeof args.cropBottom === 'number')
        cropUpdates.bottom = args.cropBottom;
      if (Object.keys(cropUpdates).length > 0) {
        useEditorStore.getState().updateClipCrop(clipId, cropUpdates);
      }
      return {
        ok: true,
        clipId,
        state: buildCompactProjectSummary(),
      };
    }

    case 'add_shape_layer': {
      const st = useEditorStore.getState();
      st.pushHistory();
      const shapeType =
        (args.shapeType as ProceduralShapeType) || 'rectangle';
      const videoTrack =
        st.project.tracks.find((t) => t.id === args.trackId) ||
        st.project.tracks.find((t) => t.type === 'video' || t.type === 'overlay') ||
        st.project.tracks[0];
      const clipId =
        typeof args.id === 'string' && args.id.trim()
          ? args.id.trim()
          : `clip-shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const startTime =
        typeof args.startTime === 'number' ? args.startTime : st.currentTime;
      const duration =
        typeof args.duration === 'number' ? Math.max(0.2, args.duration) : 3.0;
      const shapeStyle: ShapeStyle = {
        shapeType,
        width: typeof args.width === 'number' ? args.width : 480,
        height: typeof args.height === 'number' ? args.height : 480,
        fillColor: typeof args.fillColor === 'string' ? args.fillColor : '#D7E83F',
        fillOpacity: typeof args.fillOpacity === 'number' ? args.fillOpacity : 0.25,
        strokeColor:
          typeof args.strokeColor === 'string' ? args.strokeColor : '#C8FF20',
        strokeWidth: typeof args.strokeWidth === 'number' ? args.strokeWidth : 3,
        cornerRadius: typeof args.cornerRadius === 'number' ? args.cornerRadius : 0,
        sides: typeof args.sides === 'number' ? args.sides : 24,
        gridCols: typeof args.gridCols === 'number' ? args.gridCols : 6,
        gridRows: typeof args.gridRows === 'number' ? args.gridRows : 6,
        trimStart: typeof args.trimStart === 'number' ? args.trimStart : 0,
        trimEnd: typeof args.trimEnd === 'number' ? args.trimEnd : 100,
        accentColor:
          typeof args.accentColor === 'string' ? args.accentColor : '#C8FF20',
      };

      const newClip: TimelineClip = {
        id: clipId,
        name:
          typeof args.name === 'string'
            ? args.name
            : `Shape • ${shapeType.toUpperCase()}`,
        trackId: videoTrack.id,
        type: 'image',
        startTime,
        duration,
        inPoint: 0,
        outPoint: duration,
        sourceDuration: Infinity,
        playbackSpeed: 1,
        x: typeof args.x === 'number' ? args.x : 0,
        y: typeof args.y === 'number' ? args.y : 0,
        scale: typeof args.scale === 'number' ? args.scale : 1,
        rotation: typeof args.rotation === 'number' ? args.rotation : 0,
        skewX: typeof args.skewX === 'number' ? args.skewX : 0,
        skewY: typeof args.skewY === 'number' ? args.skewY : 0,
        opacity: typeof args.opacity === 'number' ? args.opacity : 1,
        crop: createDefaultCrop(),
        mask: createDefaultMask(),
        effects: createDefaultColorEffects(),
        volume: 1,
        muted: true,
        fadeIn: typeof args.fadeIn === 'number' ? args.fadeIn : 0,
        fadeOut: typeof args.fadeOut === 'number' ? args.fadeOut : 0,
        transitionIn: { type: 'none', duration: 0 },
        transitionOut: { type: 'none', duration: 0 },
        parentId: typeof args.parentId === 'string' ? args.parentId : undefined,
        motionBlur: Boolean(args.motionBlur),
        shapeStyle,
        keyframes: [],
      };

      useEditorStore.setState((prev) => ({
        project: {
          ...prev.project,
          clips: [...prev.project.clips.filter((c) => c.id !== clipId), newClip],
          updatedAt: Date.now(),
        },
        selectedClipId: clipId,
      }));
      await useEditorStore.getState().saveCurrentProject();

      return {
        ok: true,
        clipId,
        shapeStyle,
        state: buildCompactProjectSummary(),
      };
    }

    case 'set_clip_mask': {
      const clipId = resolveTargetClipId(args.clipId);
      if (!clipId) throw new Error('No clip found for mask update.');
      const maskUpdates: Record<string, unknown> = {};
      if (typeof args.shape === 'string') {
        maskUpdates.shape = args.shape as MaskShape;
      }
      for (const k of [
        'centerX',
        'centerY',
        'width',
        'height',
        'radius',
        'feather',
        'rotation',
        'expansion',
      ]) {
        if (typeof args[k] === 'number') maskUpdates[k] = args[k];
      }
      if (typeof args.invert === 'boolean') maskUpdates.invert = args.invert;
      useEditorStore.getState().updateClipMask(clipId, maskUpdates);
      return {
        ok: true,
        clipId,
        mask: useEditorStore.getState().project.clips.find((c) => c.id === clipId)?.mask,
      };
    }

    case 'set_clip_parent': {
      const clipId = resolveTargetClipId(args.clipId);
      if (!clipId) throw new Error('No clip found for parent assignment.');
      const parentId =
        typeof args.parentId === 'string' && args.parentId.trim()
          ? args.parentId.trim()
          : undefined;
      useEditorStore.getState().updateClipProperties(clipId, { parentId });
      return {
        ok: true,
        clipId,
        parentId: parentId || null,
      };
    }

    case 'capture_preview_frame': {
      if (typeof args.time === 'number') {
        useEditorStore.getState().setCurrentTime(args.time);
        await new Promise((r) => setTimeout(r, 45));
      }
      const st = useEditorStore.getState();
      const t = st.currentTime;
      const activeVisual = getCompositedVisualClipsAtTime(
        st.project.tracks,
        st.project.clips,
        t
      ).map((item) => {
        const evaluated = evaluateClipTransform(
          item.clip,
          item.localTime,
          st.project.clips,
          t
        );
        return {
          id: item.clip.id,
          name: item.clip.name,
          type: item.clip.type,
          shapeType: item.clip.shapeStyle?.shapeType ?? null,
          localTime: Number(item.localTime.toFixed(3)),
          evaluatedTransform: {
            x: Math.round(evaluated.x),
            y: Math.round(evaluated.y),
            scale: Number(evaluated.scale.toFixed(3)),
            rotation: Math.round(evaluated.rotation),
            skewX: Math.round(evaluated.skewX),
            skewY: Math.round(evaluated.skewY),
            trimEnd: Math.round(evaluated.trimEnd),
            opacity: Number(evaluated.opacity.toFixed(3)),
          },
        };
      });

      let canvasMetrics = {
        canvasFound: false,
        width: 1080,
        height: 1920,
        nonBlackRatio: 0,
        limePixelCount: 0,
        whitePixelCount: 0,
      };
      if (typeof document !== 'undefined') {
        const canvas = document.querySelector(
          '[data-testid="preview-canvas"]'
        ) as HTMLCanvasElement | null;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx && canvas.width > 0 && canvas.height > 0) {
            const { width, height } = canvas;
            const data = ctx.getImageData(0, 0, width, height).data;
            let nonBlack = 0;
            let lime = 0;
            let white = 0;
            let total = 0;
            const step = 12;
            for (let y = 0; y < height; y += step) {
              for (let x = 0; x < width; x += step) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                total++;
                if (r > 18 || g > 24 || b > 18) nonBlack++;
                if (g > 180 && r > 150 && b < 110) lime++;
                if (r > 225 && g > 225 && b > 225) white++;
              }
            }
            canvasMetrics = {
              canvasFound: true,
              width,
              height,
              nonBlackRatio: Number((nonBlack / Math.max(1, total)).toFixed(4)),
              limePixelCount: lime,
              whitePixelCount: white,
            };
          }
        }
      }

      return {
        ok: true,
        timestamp: t,
        frameIndex: Math.round(t * st.project.fps),
        activeLayerCount: activeVisual.length,
        activeVisualClips: activeVisual,
        canvasMetrics,
      };
    }

    case 'add_keyframe': {
      const clipId = resolveTargetClipId(args.clipId);
      if (!clipId) throw new Error('No clip found for keyframe insertion.');
      const property = (args.property as KeyframeProperty) || 'scale';
      const time = Number(args.time ?? 0);
      const value = Number(args.value ?? 1);
      const easing = (args.easing as KeyframeEasing) || 'ease-in-out';
      useEditorStore
        .getState()
        .setClipKeyframe(clipId, property, time, value, easing);
      return {
        ok: true,
        clipId,
        property,
        time,
        value,
        easing,
      };
    }

    case 'set_audio_envelope': {
      let clipId = resolveTargetClipId(args.clipId);
      const audioClips = useEditorStore
        .getState()
        .project.clips.filter((c) => c.type === 'audio' || c.type === 'video');
      if (!args.clipId && audioClips.length > 0) {
        const dedicatedAudio = audioClips.find((c) => c.type === 'audio');
        clipId = (dedicatedAudio || audioClips[0]).id;
      }
      if (!clipId) throw new Error('No audio/video clip found.');

      const updates: Record<string, unknown> = {};
      if (typeof args.volume === 'number') updates.volume = args.volume;
      if (typeof args.muted === 'boolean') updates.muted = args.muted;
      if (typeof args.fadeIn === 'number') updates.fadeIn = args.fadeIn;
      if (typeof args.fadeOut === 'number') updates.fadeOut = args.fadeOut;
      useEditorStore.getState().updateClipProperties(clipId, updates);
      return {
        ok: true,
        clipId,
        updates,
        state: buildCompactProjectSummary(),
      };
    }

    case 'seek_playhead': {
      if (typeof args.time === 'number') {
        useEditorStore.getState().setCurrentTime(args.time);
      }
      if (typeof args.playing === 'boolean') {
        useEditorStore.getState().setIsPlaying(args.playing);
      }
      return {
        ok: true,
        currentTime: useEditorStore.getState().currentTime,
        isPlaying: useEditorStore.getState().isPlaying,
      };
    }

    case 'undo_redo':
    case 'undo':
    case 'redo': {
      const action =
        toolName === 'undo' || toolName === 'redo'
          ? toolName
          : String(args.action || 'undo');
      if (action === 'undo') {
        useEditorStore.getState().undo();
      } else if (action === 'redo') {
        useEditorStore.getState().redo();
      } else if (action === 'add_track') {
        const trackType = (args.trackType as TrackType) || 'video';
        useEditorStore.getState().addTrack(trackType);
      }
      return {
        ok: true,
        action,
        state: buildCompactProjectSummary(),
      };
    }

    case 'build_angora_worldclass': {
      const { buildAngoraWorldclass, WORLDCLASS_ID } = await import('./angoraWorldclass');
      const { saveProjectToDB, listProjectsFromDB, loadProjectFromDB } = await import('../storage/projectStorage');
      const current = useEditorStore.getState().project;
      const target = await loadProjectFromDB(WORLDCLASS_ID);
      if (!target || target.name !== 'Instagram Story / Reels') throw new Error('The requested Instagram Story / Reels project was not found.');
      await useEditorStore.getState().saveCurrentProject();
      if(current.id !== WORLDCLASS_ID) await useEditorStore.getState().openExistingProject(WORLDCLASS_ID);
      const project = await buildAngoraWorldclass();
      useEditorStore.getState().pushHistory();
      useEditorStore.setState({project,currentTime:2.8,isPlaying:false,selectedClipId:null,selectedKeyframeId:null,showSafeGuides:false,saveStatus:'saving'});
      await saveProjectToDB(project);
      useEditorStore.setState({projectList:await listProjectsFromDB(),saveStatus:'saved',lastSavedAt:Date.now()});
      return {ok:true,state:buildCompactProjectSummary()};
    }

    case 'build_angora_worldclass_snapshot': {
      const { serializeProjectToJson } = await import('../storage/projectStorage');
      return {ok:true,projectJson:serializeProjectToJson(useEditorStore.getState().project)};
    }

    case 'load_angora_editorial': {
      const { buildAngoraEditorial } = await import('./angoraEditorial');
      const { saveProjectToDB, listProjectsFromDB } = await import('../storage/projectStorage');
      // Save the user's current cut before activating a separately named revision.
      await useEditorStore.getState().saveCurrentProject();
      const project = await buildAngoraEditorial();
      await saveProjectToDB(project);
      useEditorStore.setState({ project, projectList: await listProjectsFromDB(),
        past: [], future: [], currentTime: 1.7, isPlaying: false,
        selectedClipId: null, selectedKeyframeId: null, showSafeGuides: false,
        saveStatus: 'saved', lastSavedAt: Date.now() });
      return { ok: true, state: buildCompactProjectSummary() };
    }

    case 'build_angora_promo': {
      await useEditorStore.getState().loadAngoraPromoProject();
      return {
        ok: true,
        project: buildCompactProjectSummary(),
      };
    }

    case 'build_angora_beyond_ordinary': {
      await useEditorStore.getState().loadAngoraBeyondOrdinaryFilm();
      return {
        ok: true,
        message:
          'Constructed and loaded 23.0-second ANGORA — BEYOND ORDINARY | Motion Design Film (690 frames @ 30fps, 1080×1920 9:16) while preserving ANGORA — Agency Promo 2026 and ANGORA — Agency Promo V2 in IndexedDB.',
        project: buildCompactProjectSummary(),
      };
    }

    case 'build_angora_editorial_promo': {
      await useEditorStore.getState().loadAngoraEditorialPromo();
      return {
        ok: true,
        message:
          'Constructed and loaded 15.0-second ANGORA — Editorial Kinetic Promo (15s) (450 frames @ 30fps, 1080×1920 9:16) with all 7 scenes, collage cutouts, Swiss typography, filmstrip UI, web mockups, automation nodes, and sound design.',
        project: buildCompactProjectSummary(),
      };
    }

    case 'export_composition_spec': {
      const project = useEditorStore.getState().project;
      const spec = generateExportCompositionSpec(project, {
        format: 'mp4',
        videoCodec: 'H.264',
        audioCodec: 'AAC',
        resolution: (args.resolution as ResolutionPreset) || project.resolution,
        fps: (Number(args.fps) as FrameRate) || project.fps,
        quality: 'high',
      });
      if (args.openExportModal === true) {
        useEditorStore.getState().setExportModalOpen(true);
      }
      return {
        ok: true,
        exportSpec: spec,
      };
    }

    case 'memory_search': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const results = await orchestrator.search(String(args.query || ''), {
        category: args.category as any,
        type: args.type as any,
        projectId: args.projectId ? String(args.projectId) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : 10,
      });
      return { ok: true, count: results.length, results };
    }

    case 'memory_get': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const record = await orchestrator.getMemory(String(args.id || ''));
      return { ok: Boolean(record), record };
    }

    case 'memory_propose': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const record = await orchestrator.proposeMemory({
        title: String(args.title || 'Untitled Proposal'),
        content: String(args.content || ''),
        category: (args.category || 'ai-skill') as any,
        type: (args.type || 'ai-suggestion') as any,
        tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
        confidence: typeof args.confidence === 'number' ? args.confidence : 0.85,
        projectId: args.projectId ? String(args.projectId) : undefined,
      });
      return { ok: true, record };
    }

    case 'memory_save': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const record = await orchestrator.saveApprovedMemory({
        title: String(args.title || 'Untitled Memory'),
        content: String(args.content || ''),
        category: (args.category || 'design-principle') as any,
        type: (args.type || 'design-principle') as any,
        tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
        confidence: typeof args.confidence === 'number' ? args.confidence : 0.95,
        projectId: args.projectId ? String(args.projectId) : undefined,
      });
      return { ok: true, record };
    }

    case 'memory_approve': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const record = await orchestrator.approveProposal(String(args.id || ''));
      return { ok: true, record };
    }

    case 'memory_list': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const records = await orchestrator.obsidian.listMemories({
        category: args.category as any,
        type: args.type as any,
        approvalStatus: args.approvalStatus as any,
        limit: typeof args.limit === 'number' ? args.limit : 50,
      });
      return { ok: true, count: records.length, records };
    }

    case 'memory_get_project_context': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const summary = await orchestrator.obsidian.getLatestSessionSummary(
        args.projectId ? String(args.projectId) : undefined
      );
      const brandRules = await orchestrator.obsidian.listMemories({ category: 'brand-guideline' });
      const typography = await orchestrator.obsidian.listMemories({ category: 'typography' });
      return { ok: true, summary, brandRules, typography };
    }

    case 'memory_get_design_preferences': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const designPrinciples = await orchestrator.obsidian.listMemories({ category: 'design-principle' });
      const typography = await orchestrator.obsidian.listMemories({ category: 'typography' });
      const brandRules = await orchestrator.obsidian.listMemories({ category: 'brand-guideline' });
      const motionPrinciples = await orchestrator.obsidian.listMemories({ category: 'motion-principle' });
      return { ok: true, designPrinciples, typography, brandRules, motionPrinciples };
    }

    case 'memory_get_lessons': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const lessons = await orchestrator.obsidian.listMemories({ category: 'lesson-learned' });
      return { ok: true, count: lessons.length, lessons };
    }

    case 'memory_consolidate': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const res = orchestrator.consolidateRecords();
      return { ok: true, ...res };
    }

    case 'memory_archive': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const ok = await orchestrator.obsidian.archiveMemory(String(args.id || ''));
      return { ok, id: args.id };
    }

    case 'memory_delete': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const ok = await orchestrator.obsidian.deleteMemory(String(args.id || ''));
      return { ok, id: args.id };
    }

    case 'memory_health': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const health = await orchestrator.getSystemHealth();
      return { ok: true, ...health };
    }

    case 'graphify_query': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const res = await orchestrator.graphify.query(args);
      return { ok: true, ...res };
    }

    case 'graphify_status': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const status = await orchestrator.graphify.getStatus();
      return { ok: true, status };
    }

    case 'graphify_reindex': {
      const { MemoryOrchestrator } = await import('../memory/MemoryOrchestrator');
      const orchestrator = MemoryOrchestrator.getInstance();
      const res = await orchestrator.graphify.reindex();
      return { ok: true, ...res };
    }

    // ==========================================
    // MotionLab Creative Intelligence Engine (MCIE) Handlers
    // ==========================================
    case 'analyze_creative_brief': {
      const { CreativeDirector } = await import('../mcie');
      const brief = CreativeDirector.analyzeBrief((args.prompt as string) || (args as any));
      return { ok: true, brief };
    }

    case 'generate_creative_treatment': {
      const { CreativeDirector } = await import('../mcie');
      const brief = (args.brief as any) || CreativeDirector.analyzeBrief((args.prompt as string) || {});
      const treatment = CreativeDirector.generateTreatment(brief);
      return { ok: true, treatment };
    }

    case 'create_storyboard': {
      const { CreativeDirector } = await import('../mcie');
      const brief = (args.brief as any) || CreativeDirector.analyzeBrief((args.prompt as string) || {});
      const treatment = (args.treatment as any) || CreativeDirector.generateTreatment(brief);
      const scenes = CreativeDirector.createStoryboard(treatment, brief);
      return { ok: true, scenes };
    }

    case 'create_production_plan': {
      const { CreativeDirector } = await import('../mcie');
      const plan = CreativeDirector.createProductionPlan((args.prompt as string) || (args.brief as any) || {});
      return { ok: true, plan };
    }

    case 'produce_project': {
      const { CreativeDirector } = await import('../mcie');
      const prompt = (args.prompt as string) || 'Create a cinematic commercial for Angora Web Services';
      const result = CreativeDirector.produceProject(prompt);
      if (args.loadIntoEditor !== false) {
        store.loadProject(result.project);
        store.saveProject();
      }
      return {
        ok: true,
        projectId: result.project.id,
        name: result.project.name,
        duration: result.project.clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0),
        clipCount: result.project.clips.length,
        rubricScore: result.report.rubric.overallScore,
        grade: result.report.rubric.grade,
        isPassing: result.report.isPassing,
        project: result.project,
        report: result.report,
        plan: result.plan,
      };
    }

    case 'apply_motion_preset': {
      const { MotionPresetEngine } = await import('../mcie');
      const clipId = resolveTargetClipId(args.clipId);
      if (!clipId) throw new Error('No clip specified or selected.');
      const clip = store.project.clips.find((c) => c.id === clipId);
      if (!clip) throw new Error(`Clip ${clipId} not found.`);
      const presetName = String(args.presetName || 'refined-title-entrance');
      const updated = MotionPresetEngine.applyPresetToClip(clip, presetName, args as any);
      store.updateClip(clipId, { keyframes: updated.keyframes });
      store.saveProject();
      return { ok: true, clipId, presetName, keyframeCount: updated.keyframes.length };
    }

    case 'list_motion_presets': {
      const { MotionPresetEngine } = await import('../mcie');
      return { ok: true, presets: MotionPresetEngine.listPresets() };
    }

    case 'diagnose_typography': {
      const { TypographyEngine } = await import('../mcie');
      const clipId = args.clipId ? resolveTargetClipId(args.clipId) : store.selectedClipId;
      const clip = clipId ? store.project.clips.find((c) => c.id === clipId) : undefined;
      const text = (args.text as string) || clip?.textStyle?.content || 'Sample Headline';
      const fontSize = (args.fontSize as number) || clip?.textStyle?.fontSize || 48;
      const textColorHex = (args.textColorHex as string) || clip?.textStyle?.color || '#FFFFFF';
      const backgroundColorHex = (args.backgroundColorHex as string) || clip?.textStyle?.backgroundColor || '#0B0F0B';
      const diag = TypographyEngine.diagnose(text, { fontSize, textColorHex, backgroundColorHex });
      return { ok: true, diagnosis: diag };
    }

    case 'generate_type_scale': {
      const { TypographyEngine } = await import('../mcie');
      const base = (args.baseSize as number) || 16;
      const scaleType = (args.scaleType as any) || 'major-third';
      const scale = TypographyEngine.generateScale(base, scaleType);
      return { ok: true, scale };
    }

    case 'analyze_composition': {
      const { CompositionEngine } = await import('../mcie');
      const time = typeof args.timestamp === 'number' ? args.timestamp : store.currentTime;
      const dims = CompositionEngine.getSequenceDimensions(store.project.resolution, store.project.aspectRatio);
      const diag = CompositionEngine.analyzeComposition(store.project.clips, dims, time, store.project.aspectRatio);
      return { ok: true, time, composition: diag };
    }

    case 'critique_project': {
      const { VisualCritic } = await import('../mcie');
      const brandColors = args.targetBrandColors as string[] | undefined;
      const report = VisualCritic.critiqueProject(store.project, brandColors);
      return { ok: true, report };
    }

    case 'auto_refine_project': {
      const { IterativeRefinementEngine } = await import('../mcie');
      const brandColors = args.targetBrandColors as string[] | undefined;
      const maxIter = typeof args.maxIterations === 'number' ? args.maxIterations : 3;
      const res = IterativeRefinementEngine.autoRefine(store.project, brandColors, maxIter);
      store.loadProject(res.project);
      store.saveProject();
      return { ok: true, ...res };
    }

    case 'list_skills': {
      const { initializeCoreSkills } = await import('../mcie');
      const registry = initializeCoreSkills();
      return { ok: true, skills: registry.listSkills() };
    }

    case 'execute_skill_workflow': {
      const { initializeCoreSkills } = await import('../mcie');
      const registry = initializeCoreSkills();
      const skillId = String(args.skillId || '');
      const workflowId = String(args.workflowId || '');
      const targetClip = store.selectedClipId ? store.project.clips.find((c) => c.id === store.selectedClipId) : undefined;
      const res = await registry.executeWorkflow(skillId, workflowId, {
        targetClip,
        allClips: store.project.clips,
        allTracks: store.project.tracks,
        currentTime: store.currentTime,
        parameters: args.parameters as any,
      });
      return { ok: true, result: res };
    }

    // ==========================================
    // Voicebox AI Voice Studio MCP Handlers
    // ==========================================
    case 'voice_list_engines': {
      const { VoiceboxAdapter } = await import('../voicebox');
      const adapter = VoiceboxAdapter.getInstance();
      return { ok: true, engines: adapter.listEngines() };
    }

    case 'voice_list_profiles': {
      const { VoiceboxAdapter } = await import('../voicebox');
      const adapter = VoiceboxAdapter.getInstance();
      const profiles = adapter.listProfiles({
        engine: args.engine as any,
        voiceType: args.voiceType as any,
        language: args.language as any,
      });
      return { ok: true, profiles };
    }

    case 'voice_generate': {
      const { VoiceboxAdapter } = await import('../voicebox');
      const adapter = VoiceboxAdapter.getInstance();
      const text = String(args.text || '').trim();
      if (!text) throw new Error('Script text cannot be empty');
      const result = await adapter.generateSpeech({
        text,
        profileId: (args.profileId as string) || 'angora-exec-male',
        engine: args.engine as any,
        speed: typeof args.speed === 'number' ? args.speed : 1.0,
        emotionInstruction: args.emotionInstruction as string,
      });
      return {
        ok: true,
        result: {
          id: result.id,
          profileId: result.profileId,
          profileName: result.profileName,
          engine: result.engine,
          durationSeconds: result.durationSeconds,
          sampleRate: result.sampleRate,
          peakLevelDb: result.peakLevelDb,
          rmsLevelDb: result.rmsLevelDb,
          waveformPeaks: result.waveformPeaks.slice(0, 50),
          qualityReport: result.qualityReport,
        },
      };
    }

    case 'voice_create_profile': {
      const { VoiceboxAdapter } = await import('../voicebox');
      const adapter = VoiceboxAdapter.getInstance();
      const name = String(args.name || '').trim();
      if (!name) throw new Error('Voice profile name is required');
      const consentConfirmed = Boolean(args.consentConfirmed);
      if (!consentConfirmed) {
        return {
          ok: false,
          error:
            'Voice cloning requires explicit user confirmation of voice ownership or written authorization.',
        };
      }
      const profile = adapter.createProfile(
        {
          name,
          voiceType: 'cloned',
          engine: (args.engine as any) || 'qwen3-tts',
          language: (args.language as string) || 'en',
          gender: (args.gender as any) || 'neutral',
          description: (args.description as string) || 'Custom cloned voice profile',
          authorizedForCommercialUse: true,
          tags: ['custom', 'cloned'],
        },
        true
      );
      return { ok: true, profile };
    }

    case 'voice_add_to_timeline': {
      const { VoiceboxAdapter } = await import('../voicebox');
      const adapter = VoiceboxAdapter.getInstance();
      const text = String(args.text || '').trim();
      if (!text) throw new Error('Script text cannot be empty');

      const result = await adapter.generateSpeech({
        text,
        profileId: (args.profileId as string) || 'angora-exec-male',
        speed: typeof args.speed === 'number' ? args.speed : 1.0,
      });

      const audioUrl =
        typeof window !== 'undefined' && window.URL
          ? URL.createObjectURL(result.audioBlob)
          : '';
      const assetId = `asset-vo-${Date.now().toString(36)}`;
      const duration = result.durationSeconds;
      const startTime =
        typeof args.startTime === 'number' ? args.startTime : store.currentTime;

      // Ensure media asset exists in project
      const mediaAsset = {
        id: assetId,
        name: `Voiceover: ${result.profileName} (${duration.toFixed(1)}s)`,
        type: 'audio' as const,
        mimeType: 'audio/wav',
        size: result.audioBlob.size,
        duration,
        width: 0,
        height: 0,
        hasAudio: true,
        codecInfo: 'PCM 16-bit 44.1kHz',
        thumbnails: [],
        waveform: result.waveformPeaks,
        objectUrl: audioUrl,
        blob: result.audioBlob,
        createdAt: Date.now(),
      };
      store.addMediaAssets([mediaAsset]);

      // Ensure Audio track exists
      let targetTrackId =
        typeof args.trackId === 'string' ? args.trackId : undefined;
      let targetTrack = targetTrackId
        ? store.project.tracks.find((t) => t.id === targetTrackId)
        : store.project.tracks.find(
            (t) =>
              t.type === 'audio' &&
              (t.name.toLowerCase().includes('voice') ||
                t.name.toLowerCase().includes('narration'))
          );
      if (!targetTrack) {
        const newTrackId = store.addTrack('audio', 'Voiceover');
        targetTrack = store.project.tracks.find((t) => t.id === newTrackId);
      }
      targetTrackId =
        targetTrack?.id || store.project.tracks[0]?.id || 'track-audio';

      const clipId = store.addMediaClipToTimeline(
        assetId,
        targetTrackId,
        startTime
      );
      store.saveProject();

      return {
        ok: true,
        clipId,
        assetId,
        trackId: targetTrackId,
        startTime,
        duration,
        profileName: result.profileName,
        qualityReport: result.qualityReport,
      };
    }

    case 'voice_apply_effect': {
      const { DEFAULT_VOICE_EFFECTS } = await import('../voicebox');
      return {
        ok: true,
        appliedSettings: {
          ...DEFAULT_VOICE_EFFECTS,
          ...args,
        },
        notes:
          'DSP vocal chain configured: 80Hz rumble cut, 2.5:1 compression, and peak normalization.',
      };
    }

    case 'voice_generate_script': {
      const { VoiceDirectionEngine } = await import('../voicebox');
      const topic = String(args.topicOrBrief || 'Angora Web Services Commercial');
      const targetDur =
        typeof args.targetDurationSeconds === 'number'
          ? args.targetDurationSeconds
          : 15;
      const preset = (args.preset as string) || 'premium-commercial';
      const plan = VoiceDirectionEngine.planVoiceover(topic, preset, targetDur);
      return { ok: true, plan };
    }

    case 'voice_sync_to_animation': {
      const { VoiceboxAdapter, VoiceSyncEngine } = await import('../voicebox');
      const adapter = VoiceboxAdapter.getInstance();
      const text = String(args.text || '').trim();
      if (!text) throw new Error('Script text cannot be empty');

      const result = await adapter.generateSpeech({
        text,
        profileId: (args.profileId as string) || 'angora-exec-male',
      });
      const analysis = VoiceSyncEngine.analyzeSpeech(result);

      // Find or create subtitle text track
      let textTrack = args.targetTrackId
        ? store.project.tracks.find((t) => t.id === args.targetTrackId)
        : store.project.tracks.find(
            (t) => t.type === 'text' || t.type === 'overlay'
          );
      if (!textTrack) {
        const newTrackId = store.addTrack('text', 'Voice Captions');
        textTrack = store.project.tracks.find((t) => t.id === newTrackId);
      }
      const targetTrackId =
        textTrack?.id || store.project.tracks[0]?.id || 'track-text';

      const captionClips = VoiceSyncEngine.generateSynchronizedCaptions(
        analysis,
        store.currentTime,
        { targetTrackId, fontSize: 32, textColor: '#D7E83F' }
      );

      store.pushHistory();
      store.project.clips.push(...captionClips);
      store.saveProject();

      return {
        ok: true,
        audioDuration: result.durationSeconds,
        segmentCount: analysis.segments.length,
        beatMarkers: analysis.beatMarkers,
        generatedClipsCount: captionClips.length,
        segments: analysis.segments,
      };
    }

    default:
      throw new Error(`Unknown MotionLab MCP tool: "${toolName}"`);
  }
}

/**
 * Built-in deterministic Natural Language -> MCP Tool Call Planner so users can run
 * AI timeline workflows immediately even without an external LLM API key configured.
 */
export function planAutonomousMcpStepsFromPrompt(prompt: string): {
  explanation: string;
  calls: Array<{ name: string; arguments: Record<string, unknown> }>;
} {
  const lower = prompt.toLowerCase();
  const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  const explanations: string[] = [];

  if (lower.includes('angora')) {
    calls.push({ name: 'build_angora_promo', arguments: {} });
    explanations.push(
      'Built and loaded the 15-second (450 frames @ 30 FPS, 1080×1920 9:16) ANGORA — Agency Promo 2026 motion graphics sequence across 8 tracks.'
    );
    return { explanation: explanations.join(' '), calls };
  }

  // 1. Check if user asks to build a complete sequence / demo / commercial / montage
  if (
    lower.includes('commercial') ||
    lower.includes('demo') ||
    lower.includes('sequence') ||
    lower.includes('assemble') ||
    lower.includes('auto edit') ||
    lower.includes('full cut') ||
    lower.includes('benchmark')
  ) {
    calls.push({ name: 'load_studio_media', arguments: {} });
    calls.push({
      name: 'add_media_clip',
      arguments: { assetIdOrName: 'clip-a-studio.mp4', startTime: 0 },
    });
    calls.push({
      name: 'trim_clip',
      arguments: { newDuration: 2.0 },
    });
    calls.push({
      name: 'add_media_clip',
      arguments: { assetIdOrName: 'clip-b-motion.mp4', startTime: 2.0 },
    });
    calls.push({
      name: 'set_transition',
      arguments: { type: 'cross-dissolve', duration: 0.6, edge: 'in' },
    });
    const titleMatch = prompt.match(/["'“”]([^"'“”]+)["'“”]/);
    const titleText = titleMatch ? titleMatch[1] : 'MOTIONLAB AI STUDIO';
    calls.push({
      name: 'add_text_layer',
      arguments: {
        content: titleText,
        startTime: 0.4,
        duration: 3.2,
        fontSize: 72,
        color: '#38bdf8',
        animationIn: 'zoom-in',
        animationOut: 'fade-out',
      },
    });
    calls.push({
      name: 'add_media_clip',
      arguments: { assetIdOrName: 'ambient-score.wav', startTime: 0 },
    });
    calls.push({
      name: 'set_audio_envelope',
      arguments: { volume: 0.9, fadeIn: 0.5, fadeOut: 0.8 },
    });
    explanations.push(
      `Assembled a complete multitrack sequence: imported studio media, placed & trimmed clip-a-studio.mp4 (2.0s), appended clip-b-motion.mp4 with a 0.6s Cross Dissolve transition, overlaid animated title "${titleText}", and mixed ambient-score.wav with fade envelopes.`
    );
    return { explanation: explanations.join(' '), calls };
  }

  // Aspect ratio / format
  if (lower.includes('9:16') || lower.includes('vertical') || lower.includes('reel') || lower.includes('shorts')) {
    calls.push({
      name: 'set_project_format',
      arguments: { aspectRatio: '9:16', resolution: '1080p' },
    });
    explanations.push('Switched sequence aspect ratio to 9:16 Vertical (1080×1920).');
  } else if (lower.includes('1:1') || lower.includes('square')) {
    calls.push({
      name: 'set_project_format',
      arguments: { aspectRatio: '1:1' },
    });
    explanations.push('Switched sequence aspect ratio to 1:1 Square.');
  } else if (lower.includes('16:9') || lower.includes('widescreen')) {
    calls.push({
      name: 'set_project_format',
      arguments: { aspectRatio: '16:9' },
    });
    explanations.push('Switched sequence aspect ratio to 16:9 Widescreen.');
  }

  // Load media
  if (lower.includes('import') || lower.includes('load media') || lower.includes('studio media')) {
    calls.push({ name: 'load_studio_media', arguments: {} });
    explanations.push('Loaded studio media assets into the Media Library.');
  }

  // Add text / title
  if (lower.includes('text') || lower.includes('title') || lower.includes('caption') || lower.includes('headline')) {
    const quoted = prompt.match(/["'“”]([^"'“”]+)["'“”]/);
    const content = quoted ? quoted[1] : 'AI GENERATED TITLE';
    const animIn: TextAnimationPreset = lower.includes('typewriter')
      ? 'typewriter'
      : lower.includes('slide')
        ? 'slide-in'
        : lower.includes('zoom')
          ? 'zoom-in'
          : 'fade-in';
    calls.push({
      name: 'add_text_layer',
      arguments: {
        content,
        animationIn: animIn,
        animationOut: 'fade-out',
        fontSize: 68,
        color: '#ffffff',
      },
    });
    explanations.push(`Added animated text layer "${content}" (${animIn}).`);
  }

  // Transitions
  if (
    lower.includes('transition') ||
    lower.includes('dissolve') ||
    lower.includes('wipe') ||
    lower.includes('slide') ||
    lower.includes('fade to black') ||
    lower.includes('fade from black')
  ) {
    const type: TransitionType = lower.includes('wipe')
      ? 'wipe-right'
      : lower.includes('slide')
        ? 'slide-left'
        : lower.includes('fade to black')
          ? 'fade-to-black'
          : lower.includes('fade from black')
            ? 'fade-from-black'
            : 'cross-dissolve';
    calls.push({
      name: 'set_transition',
      arguments: { type, duration: 0.6 },
    });
    explanations.push(`Applied ${type} transition (0.6s).`);
  }

  // Split
  if (lower.includes('split') || lower.includes('razor') || lower.includes('cut at')) {
    const timeMatch = lower.match(/(\d+(?:\.\d+)?)\s*s/);
    const splitTime = timeMatch ? Number(timeMatch[1]) : undefined;
    calls.push({
      name: 'split_clip',
      arguments: splitTime !== undefined ? { splitTime } : {},
    });
    explanations.push(
      splitTime !== undefined
        ? `Split clip at ${splitTime}s.`
        : 'Split clip at current playhead.'
    );
  }

  // Trim
  if (lower.includes('trim') || lower.includes('shorten') || lower.includes('duration to')) {
    const durMatch = lower.match(/(\d+(?:\.\d+)?)\s*s/);
    const newDuration = durMatch ? Number(durMatch[1]) : 2.0;
    calls.push({
      name: 'trim_clip',
      arguments: { newDuration },
    });
    explanations.push(`Trimmed clip duration to ${newDuration}s.`);
  }

  // Color / Filters
  if (
    lower.includes('noir') ||
    lower.includes('grayscale') ||
    lower.includes('black and white') ||
    lower.includes('sepia') ||
    lower.includes('blur') ||
    lower.includes('contrast') ||
    lower.includes('exposure') ||
    lower.includes('grade')
  ) {
    const fx: Record<string, unknown> = {};
    if (lower.includes('noir') || lower.includes('grayscale') || lower.includes('black and white')) {
      fx.grayscale = 100;
      fx.contrast = 22;
    }
    if (lower.includes('sepia') || lower.includes('vintage')) {
      fx.sepia = 85;
    }
    if (lower.includes('blur')) {
      fx.blur = 8;
    }
    if (lower.includes('contrast') || lower.includes('grade') || lower.includes('cinema')) {
      fx.contrast = 20;
      fx.saturation = 25;
      fx.exposure = 10;
    }
    calls.push({
      name: 'set_color_effects',
      arguments: fx,
    });
    explanations.push(`Applied color/optical adjustments (${Object.keys(fx).join(', ')}).`);
  }

  // Audio
  if (lower.includes('mute') || lower.includes('volume') || lower.includes('fade out') || lower.includes('fade in')) {
    const audioArgs: Record<string, unknown> = {};
    if (lower.includes('mute')) audioArgs.muted = true;
    if (lower.includes('unmute')) audioArgs.muted = false;
    if (lower.includes('fade in')) audioArgs.fadeIn = 0.6;
    if (lower.includes('fade out')) audioArgs.fadeOut = 0.8;
    calls.push({
      name: 'set_audio_envelope',
      arguments: audioArgs,
    });
    explanations.push('Updated audio gain and fade envelope.');
  }

  // Undo / Redo
  if (lower === 'undo' || lower.includes('undo last')) {
    calls.push({ name: 'undo_redo', arguments: { action: 'undo' } });
    explanations.push('Reverted last timeline action.');
  } else if (lower === 'redo') {
    calls.push({ name: 'undo_redo', arguments: { action: 'redo' } });
    explanations.push('Re-applied timeline action.');
  }

  // Export
  if (lower.includes('export') || lower.includes('render mp4')) {
    calls.push({
      name: 'export_composition_spec',
      arguments: { openExportModal: true },
    });
    explanations.push('Generated MP4 export specification and opened the Export Master dialog.');
  }

  if (calls.length === 0) {
    calls.push({ name: 'get_state', arguments: {} });
    explanations.push(
      'Inspected current sequence state via MCP `get_state`. Try commands like "Assemble a commercial sequence with studio media and a cross dissolve", "Add a typewriter title \'SCENE 01\'", or "Apply monochrome noir grade".'
    );
  }

  return {
    explanation: explanations.join(' '),
    calls,
  };
}
