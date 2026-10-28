import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Play,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Type,
  Maximize2,
  Activity,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { initializeCoreSkills, type SkillMetadata, type SkillExecutionResult } from '../mcie';

export const SkillsLibraryPanel: React.FC = () => {
  const store = useEditorStore();
  const [skills, setSkills] = useState<SkillMetadata[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('creative-direction');
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>('creative-direction');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<SkillExecutionResult | null>(null);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [viewingSpec, setViewingSpec] = useState(false);

  useEffect(() => {
    const registry = initializeCoreSkills();
    setSkills(registry.listSkills());
  }, []);

  const selectedSkill = skills.find((s) => s.id === selectedSkillId) || skills[0];

  const handleRunWorkflow = async (skillId: string, workflowId: string) => {
    setIsExecuting(true);
    setActiveWorkflowId(workflowId);
    setExecutionResult(null);

    try {
      const registry = initializeCoreSkills();
      const targetClip = store.selectedClipId
        ? store.project.clips.find((c) => c.id === store.selectedClipId)
        : store.project.clips[0];

      // Provide appropriate parameters based on workflow
      let parameters: Record<string, unknown> = {};
      if (workflowId === 'analyze_brief' || workflowId === 'generate_treatment' || workflowId === 'build_production_plan') {
        parameters = {
          prompt: 'Create a premium 15-second kinetic commercial for Angora Web Services with precision typography and geometric motion',
        };
      } else if (workflowId === 'generate_scale') {
        parameters = { baseSize: 20, scaleType: 'major-third' };
      } else if (workflowId === 'apply_preset') {
        parameters = { presetName: 'refined-title-entrance', overshoot: 0.15 };
      } else if (workflowId === 'critique_project' || workflowId === 'auto_refine') {
        parameters = {
          project: store.project,
          brandColors: ['#D7E83F', '#0B0F0B', '#172018', '#FFFFFF'],
        };
      }

      const res = await registry.executeWorkflow(skillId, workflowId, {
        targetClip,
        allClips: store.project.clips,
        allTracks: store.project.tracks,
        currentTime: store.currentTime,
        parameters,
      });

      setExecutionResult(res);

      // If auto_refine produced a project, load it into store
      if (workflowId === 'auto_refine' && res.output && (res.output as any).project) {
        store.loadProject((res.output as any).project);
        store.saveProject();
      }

      // If motion preset applied, reload clip
      if (workflowId === 'apply_preset' && targetClip && res.output) {
        store.updateClip(targetClip.id, { keyframes: (res.output as any).keyframes });
        store.saveProject();
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setExecutionResult({
        success: false,
        skillId,
        workflowId,
        output: null,
        critiqueNotes: [errMsg],
        appliedChangesSummary: `Execution error: ${errMsg}`,
        durationMs: 0,
      });
    } finally {
      setIsExecuting(false);
      setActiveWorkflowId(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'creative-direction':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'typography':
        return <Type className="w-4 h-4 text-cyan-400" />;
      case 'composition':
        return <Maximize2 className="w-4 h-4 text-purple-400" />;
      case 'motion-design':
        return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'quality-critique':
        return <CheckSquare className="w-4 h-4 text-rose-400" />;
      default:
        return <Layers className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0f12] text-zinc-200 overflow-hidden text-xs">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 bg-[#12151b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-[#D7E83F]/10 border border-[#D7E83F]/30 text-[#D7E83F]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-zinc-100 flex items-center gap-1.5">
              AI Skills Library
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                {skills.length} Skills Active
              </span>
            </h2>
            <p className="text-[10px] text-zinc-400">
              Deterministic Creative Director agent workflows & design systems
            </p>
          </div>
        </div>
      </div>

      {/* Main split: Skills List on Left, Detail & Actions on Right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Skills Accordion */}
        <div className="w-1/2 border-r border-zinc-800 overflow-y-auto p-2 space-y-2">
          {skills.map((skill) => {
            const isSelected = selectedSkillId === skill.id;
            return (
              <div
                key={skill.id}
                onClick={() => setSelectedSkillId(skill.id)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#D7E83F]/60 bg-[#D7E83F]/5'
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {getCategoryIcon(skill.category)}
                    <span className="font-medium text-zinc-200">{skill.name}</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                    v{skill.version}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 line-clamp-2 mb-2 leading-relaxed">
                  {skill.description}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-300">
                    {skill.executableWorkflows.length} Workflows
                  </span>
                  <span>{skill.qualityRubricFocus.join(' • ')}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Workflows & Live Execution */}
        <div className="w-1/2 flex flex-col overflow-y-auto p-3 space-y-4">
          {selectedSkill && (
            <>
              {/* Skill Header */}
              <div className="space-y-1.5 pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(selectedSkill.category)}
                  <h3 className="font-semibold text-sm text-zinc-100">{selectedSkill.name}</h3>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  {selectedSkill.description}
                </p>
                <div className="text-[10px] text-zinc-400 flex items-center gap-3 pt-1">
                  <span>Author: {selectedSkill.author || 'MotionLab AI'}</span>
                  <span>Category: {selectedSkill.category}</span>
                </div>
              </div>

              {/* Creative Principles */}
              <div className="space-y-1.5 bg-zinc-900/70 p-2.5 rounded-lg border border-zinc-800">
                <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#D7E83F]" />
                  Creative Principles
                </h4>
                <ul className="space-y-1 pl-4 list-disc text-zinc-400 text-[10px] leading-relaxed">
                  {selectedSkill.creativePrinciples.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>

              {/* Workflows */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  Executable Workflows
                </h4>
                <div className="space-y-1.5">
                  {selectedSkill.executableWorkflows.map((wf) => {
                    const isRunning = isExecuting && activeWorkflowId === wf.id;
                    return (
                      <div
                        key={wf.id}
                        className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between hover:border-zinc-700 transition"
                      >
                        <div className="space-y-0.5 pr-2">
                          <div className="font-medium text-zinc-200 text-[11px]">{wf.name}</div>
                          <div className="text-[10px] text-zinc-400">{wf.description}</div>
                        </div>
                        <button
                          onClick={() => handleRunWorkflow(selectedSkill.id, wf.id)}
                          disabled={isExecuting}
                          className={`px-3 py-1.5 rounded-md font-medium text-[10px] flex items-center gap-1.5 transition-all shadow-sm ${
                            isRunning
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-wait'
                              : 'bg-[#D7E83F] hover:bg-[#c8ff20] text-black font-semibold shadow-emerald-950/20 active:scale-95'
                          }`}
                        >
                          {isRunning ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Running...
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current" />
                              Run
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Execution Output Result */}
              {executionResult && (
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    {executionResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    Execution Result ({executionResult.durationMs}ms)
                  </h4>
                  <div
                    className={`p-2.5 rounded-lg border text-[11px] font-mono ${
                      executionResult.success
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                        : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                    }`}
                  >
                    <p className="font-semibold mb-1">{executionResult.appliedChangesSummary}</p>
                    {executionResult.critiqueNotes && executionResult.critiqueNotes.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-zinc-800 text-[10px] text-zinc-400">
                        {executionResult.critiqueNotes.map((note, i) => (
                          <div key={i}>• {note}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
