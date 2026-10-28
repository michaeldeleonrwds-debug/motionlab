import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Database,
  FileText,
  GitBranch,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  X,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { MemoryOrchestrator } from '../memory/MemoryOrchestrator';
import type {
  MemoryCategory,
  MemoryHealthReport,
  MemoryRecord,
  SessionSummaryRecord,
} from '../memory/types';
import { useEditorStore } from '../store/useEditorStore';

const CATEGORY_TABS: Array<{ id: string; label: string; cat?: MemoryCategory }> = [
  { id: 'all', label: 'All Records' },
  { id: 'brand', label: 'Brand & Typography', cat: 'brand-guideline' },
  { id: 'motion', label: 'Motion Rules', cat: 'motion-principle' },
  { id: 'lessons', label: 'Lessons Learned', cat: 'lesson-learned' },
  { id: 'decisions', label: 'Decisions', cat: 'creative-decision' },
  { id: 'summaries', label: 'Session Summaries', cat: 'session-summary' },
];

export const MemoryVaultPanel: React.FC = () => {
  const orchestrator = MemoryOrchestrator.getInstance();
  const currentProjectName = useEditorStore((s) => s.project.name);

  const [health, setHealth] = useState<MemoryHealthReport | null>(null);
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [activeCategoryTab, setActiveCategoryTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // New Memory Modal / Inline Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('brand-guideline');
  const [newTags, setNewTags] = useState('brand, style');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status message
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const refreshData = async () => {
    try {
      const h = await orchestrator.getSystemHealth();
      setHealth(h);

      const filterCat =
        activeCategoryTab === 'all'
          ? undefined
          : CATEGORY_TABS.find((t) => t.id === activeCategoryTab)?.cat;

      if (searchQuery.trim()) {
        setIsSearching(true);
        const searchResults = await orchestrator.search(searchQuery.trim(), {
          category: filterCat,
        });
        setRecords(searchResults.map((r) => r.memory));
        setIsSearching(false);
      } else {
        const list = await orchestrator.obsidian.listMemories({
          category: filterCat,
        });
        setRecords(list);
      }
    } catch (err) {
      console.warn('[MemoryVaultPanel] Error refreshing data:', err);
    }
  };

  useEffect(() => {
    void orchestrator.initialize();
    void refreshData();
    const unsub = orchestrator.subscribe(() => {
      void refreshData();
    });
    return unsub;
  }, [activeCategoryTab, searchQuery]);

  const handleApprove = async (id: string) => {
    try {
      await orchestrator.approveProposal(id);
      setActionNotice('Proposal approved & validated into Obsidian vault.');
      setTimeout(() => setActionNotice(null), 3500);
      void refreshData();
    } catch (err) {
      setActionNotice(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await orchestrator.rejectProposal(id);
      setActionNotice('Proposal archived to 99-Archive.');
      setTimeout(() => setActionNotice(null), 3500);
      void refreshData();
    } catch (err) {
      setActionNotice(err instanceof Error ? err.message : 'Failed to archive');
    }
  };

  const handleSaveNewMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setIsSubmitting(true);
    try {
      await orchestrator.saveApprovedMemory({
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        type:
          newCategory === 'brand-guideline'
            ? 'design-principle'
            : newCategory === 'typography'
              ? 'user-preference'
              : 'motion-technique',
        tags: newTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        projectId: currentProjectName,
      });
      setNewTitle('');
      setNewContent('');
      setShowAddForm(false);
      setActionNotice('Saved new memory note to Obsidian.');
      setTimeout(() => setActionNotice(null), 3500);
      void refreshData();
    } catch (err) {
      setActionNotice(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSessionCheckpoint = async () => {
    try {
      await orchestrator.createSessionCheckpoint({
        projectId: currentProjectName,
        completedWork: [
          `Working on sequence "${currentProjectName}"`,
          'Reviewed and persisted brand & motion standards',
        ],
        importantDecisions: [
          'Using Swiss typography hierarchy & locked color palette',
          'Standardized motion easing curves to snappy ease-out',
        ],
        outstandingProblems: [],
        userApprovedVisualDirections: [
          'Dark background #0B0F0B with #D7E83F lime accents',
        ],
        technicalConstraints: ['Maintain Canvas2D 60fps rendering'],
        nextPlannedOperations: ['Generate Phase 1 creative director workflows'],
      });
      setActionNotice('Session summary checkpoint created in 15-Session-Summaries/.');
      setTimeout(() => setActionNotice(null), 3500);
      void refreshData();
    } catch (err) {
      setActionNotice(err instanceof Error ? err.message : 'Checkpoint failed');
    }
  };

  const pendingProposals = records.filter((r) => r.approvalStatus === 'proposed');
  const approvedRecords = records.filter((r) => r.approvalStatus === 'approved');

  return (
    <div className="flex flex-col h-full text-[#f4f4f5] bg-[#0b0b0e] select-text">
      {/* Vault Status Header */}
      <div className="p-3 border-b border-[#1f1f26] bg-[#121217] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#f4f4f5]">
            <Database className="w-3.5 h-3.5 text-[#D7E83F]" />
            <span>AI Memory & Knowledge Vault</span>
          </div>

          <button
            type="button"
            onClick={refreshData}
            className="p-1 hover:bg-[#202028] text-[#8e8e98] hover:text-[#f4f4f5] rounded transition-colors"
            title="Refresh Vault Records & Status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Status Pills */}
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="p-1.5 rounded bg-[#181820] border border-[#23232e] flex items-center justify-between">
            <span className="flex items-center gap-1 text-[#a1a1aa]">
              <BookOpen className="w-3 h-3 text-[#D7E83F]" />
              Obsidian Vault:
            </span>
            <span
              className={`font-mono text-[10px] px-1 py-0.5 rounded ${
                health?.obsidian.connected
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {health?.obsidian.connected
                ? `${health.obsidian.totalNotes} Notes`
                : 'Offline'}
            </span>
          </div>

          <div className="p-1.5 rounded bg-[#181820] border border-[#23232e] flex items-center justify-between">
            <span className="flex items-center gap-1 text-[#a1a1aa]">
              <GitBranch className="w-3 h-3 text-[#38bdf8]" />
              Graphify AST:
            </span>
            <span
              className={`font-mono text-[10px] px-1 py-0.5 rounded ${
                health?.graphify.available
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {health?.graphify.available
                ? `${health.graphify.nodeCount ?? 0} Nodes`
                : 'Pending'}
            </span>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex-1 py-1 px-2 rounded bg-[#1c1c24] hover:bg-[#272733] border border-[#2e2e3d] text-xs font-medium text-[#f4f4f5] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3 text-[#D7E83F]" />
            <span>Add Memory Note</span>
          </button>

          <button
            type="button"
            onClick={handleSaveSessionCheckpoint}
            className="py-1 px-2.5 rounded bg-[#5e6ad2]/20 hover:bg-[#5e6ad2]/30 border border-[#5e6ad2]/50 text-xs font-medium text-[#b4bcff] flex items-center gap-1 transition-colors cursor-pointer"
            title="Create session checkpoint summary in Obsidian"
          >
            <Clock className="w-3 h-3" />
            <span>Checkpoint</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className="px-3 py-1.5 bg-[#D7E83F]/10 border-b border-[#D7E83F]/30 text-xs text-[#D7E83F] flex items-center justify-between animate-fadeIn">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-0.5 text-[#D7E83F] hover:opacity-80"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Add Memory Note Modal / Form */}
      {showAddForm && (
        <form
          onSubmit={handleSaveNewMemory}
          className="p-3 border-b border-[#1f1f26] bg-[#14141b] flex flex-col gap-2 animate-fadeIn"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#f4f4f5]">
            <span>Save New Knowledge Note</span>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-[#8e8e98] hover:text-[#f4f4f5]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Title (e.g. Angora Kinetic Text Pacing)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-2 py-1 rounded bg-[#0d0d12] border border-[#272733] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#D7E83F]"
            required
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
              className="px-2 py-1 rounded bg-[#0d0d12] border border-[#272733] text-xs text-[#f4f4f5] focus:outline-none"
            >
              <option value="brand-guideline">06-Brand-Guidelines</option>
              <option value="typography">05-Typography</option>
              <option value="motion-principle">04-Motion-Principles</option>
              <option value="design-principle">03-Design-Principles</option>
              <option value="lesson-learned">11-Lessons-Learned</option>
              <option value="creative-decision">08-Creative-Decisions</option>
            </select>

            <input
              type="text"
              placeholder="Tags (comma separated)"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="px-2 py-1 rounded bg-[#0d0d12] border border-[#272733] text-xs text-[#f4f4f5] focus:outline-none"
            />
          </div>

          <textarea
            placeholder="Detailed rule or knowledge note in markdown..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            className="w-full px-2 py-1 rounded bg-[#0d0d12] border border-[#272733] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#D7E83F] resize-none"
            required
          />

          <div className="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-2 py-1 rounded bg-[#1f1f26] text-xs text-[#a1a1aa]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1 rounded bg-[#D7E83F] hover:bg-[#c8ff20] text-black font-semibold text-xs transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Save to Vault'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Category Filter */}
      <div className="p-2 border-b border-[#1f1f26] flex flex-col gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#71717a]" />
          <input
            type="text"
            placeholder="Search vault rules, tags, or lessons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 rounded-md bg-[#16161d] border border-[#272733] text-xs text-[#f4f4f5] placeholder-[#71717a] focus:outline-none focus:border-[#D7E83F]"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategoryTab(tab.id)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeCategoryTab === tab.id
                  ? 'bg-[#D7E83F] text-black font-semibold'
                  : 'bg-[#181820] text-[#a1a1aa] hover:text-[#f4f4f5]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Records Scrollable Feed */}
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5">
        {/* Pending Proposals Section (Priority Callout) */}
        {pendingProposals.length > 0 && (
          <div className="flex flex-col gap-1.5 pb-2 border-b border-[#2a2a38]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pending AI Proposals ({pendingProposals.length})</span>
            </div>

            {pendingProposals.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-lg bg-[#1a1708] border border-amber-500/40 flex flex-col gap-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-amber-200">{item.title}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    Proposed
                  </span>
                </div>

                <p className="text-[11px] text-[#d4d4d8] leading-relaxed whitespace-pre-wrap">
                  {item.content}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-amber-500/20">
                  <div className="flex items-center gap-1 text-[10px] text-[#a1a1aa]">
                    <Tag className="w-3 h-3" />
                    <span>{item.tags.join(', ') || 'no-tags'}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleReject(item.id)}
                      className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-medium transition-colors"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(item.id)}
                      className="px-2.5 py-0.5 rounded bg-[#D7E83F] hover:bg-[#c8ff20] text-black text-[10px] font-semibold transition-colors"
                    >
                      Approve & Validate
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Approved Records Section */}
        {approvedRecords.length === 0 && pendingProposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-[#71717a] gap-2">
            <BookOpen className="w-8 h-8 opacity-40 text-[#D7E83F]" />
            <p className="text-xs">
              {searchQuery
                ? `No memory notes matching "${searchQuery}"`
                : 'No notes in this category yet. Click "Add Memory Note" to store a creative rule or brand guideline.'}
            </p>
          </div>
        ) : (
          approvedRecords.map((item) => {
            const isExpanded = expandedRecordId === item.id;
            return (
              <div
                key={item.id}
                className="p-2.5 rounded-lg bg-[#14141a] border border-[#23232e] hover:border-[#353545] transition-colors flex flex-col gap-1.5 text-xs"
              >
                <div
                  className="flex items-start justify-between gap-2 cursor-pointer"
                  onClick={() => setExpandedRecordId(isExpanded ? null : item.id)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[#f4f4f5] hover:text-[#D7E83F] transition-colors">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-[#71717a] font-mono">
                      {item.category} • {new Date(item.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                    Validated
                  </span>
                </div>

                <p
                  className={`text-[11px] text-[#a1a1aa] leading-relaxed whitespace-pre-wrap ${
                    isExpanded ? '' : 'line-clamp-2'
                  }`}
                >
                  {item.content}
                </p>

                {item.tags?.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1c1c26] text-[#8e8e98]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
