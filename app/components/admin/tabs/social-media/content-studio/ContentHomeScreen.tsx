"use client";

// Content Home — the front door to the Content Studio. Phase 1 built
// the creation input, quick-action tiles and pipeline (see
// /Users/hvss/.claude/plans/cuddly-gathering-willow.md). Phase 2
// upgraded the creation input to real AI generation
// (AiGenerationPanel) while explicitly preserving the Phase 1 plain
// pre-fill as "Write it myself" — AI being unconfigured (no provider
// key set) never blocks manual post creation. Two of the five
// quick-action tiles still depend on tooling that doesn't exist yet
// and render as honest, clearly-labelled unavailable states, never a
// simulated/fake editor. The pipeline itself — rendered via
// ContentPipeline (./legacy/ContentPipeline.tsx) — is completely
// unchanged, as is ProjectsPanel.
//
// This screen is the page header rather than another bordered card on
// top of two bordered cards: the brief, the starters and the five ways
// in sit directly on the page, so the first thing below them is real
// content rather than more chrome.
//
// Internal roadmap vocabulary ("Phase 5") never reaches the screen.
// The admin using this is a client, and a phase number tells them
// nothing; what an unavailable tile owes them is what to do instead.

import { useId, useRef, useState, type ComponentType, type RefObject } from "react";

import { ArrowRight, GalleryHorizontal, Image as ImageIcon, PenLine, Presentation, Sparkles, Video } from "lucide-react";

import { BTN_PRIMARY, BTN_SECONDARY, cx, FOCUS, INPUT } from "../shared/styles";
import type { ContentFilter, Counts, LibraryLayout, PlatformFilter, SocialPost } from "../shared/types";
import { ContentPipeline } from "./legacy/ContentPipeline";
import { AiGenerationPanel } from "./panels/AiGenerationPanel";
import { ProjectsPanel } from "./panels/ProjectsPanel";

type QuickAction = {
  id: string;
  label: string;
  /** One line under the label, so five icons read as five decisions. */
  blurb: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** Internal only — never rendered. null means available now. */
  phase: string | null;
  /** Shown when an unavailable tile is pressed. Says what to do
   *  instead, which is the only useful thing an unavailable tile can
   *  offer. Never mentions phases or roadmaps. */
  unavailableNote?: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "post", label: "Write a post", blurb: "Caption, platforms, schedule", icon: PenLine, phase: null },
  { id: "graphic", label: "Generate a graphic", blurb: "An image from a brief", icon: ImageIcon, phase: null },
  {
    id: "carousel",
    label: "Create a carousel",
    blurb: "Multi slide posts",
    icon: GalleryHorizontal,
    phase: "Phase 5",
    unavailableNote: "Carousels are not here yet. You can make each slide in the Graphic Studio and attach them to one post in the meantime.",
  },
  { id: "video", label: "Create a video", blurb: "Short form, scene by scene", icon: Video, phase: null },
  {
    id: "showcase",
    label: "Showcase a project",
    blurb: "Case study style posts",
    icon: Presentation,
    phase: "Phase 4",
    unavailableNote: "Project showcases are not here yet. A written post with a graphic covers most of it for now.",
  },
];

/** Starter briefs. They are examples, not templates: clicking one
 *  fills the box so it can be edited, because the hardest part of a
 *  blank creation box is knowing how much detail it wants. */
const STARTERS: { label: string; brief: string }[] = [
  { label: "Announce something", brief: "Announce our new school admissions system, launching in time for the September intake" },
  { label: "Share a result", brief: "Share a client result: we cut their admissions admin by about 70 percent in the first term" },
  { label: "Explain the work", brief: "Explain why we build custom platforms for clients instead of forcing them into generic software" },
  { label: "Behind the scenes", brief: "A behind the scenes look at how we onboard a new client in their first week with us" },
];

const HOME_CSS = `
.ch-in { animation: ch-in 320ms cubic-bezier(0.22,1,0.36,1) both; }
@keyframes ch-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.ch-fade { animation: ch-fade 180ms ease-out both; }
@keyframes ch-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .ch-in, .ch-fade { animation: none !important; }
}
`;

export type ContentHomeScreenProps = {
  posts: SocialPost[];
  counts: Counts;
  loading: boolean;
  failed: boolean;
  highlightId: string | null;
  nextScheduled: SocialPost | null;
  query: string;
  statusFilter: ContentFilter;
  platformFilter: PlatformFilter;
  layout: LibraryLayout;
  searchRef: RefObject<HTMLInputElement | null>;
  onRetry: () => void;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: ContentFilter) => void;
  onPlatformFilterChange: (value: PlatformFilter) => void;
  onLayoutChange: (value: LibraryLayout) => void;
  onClearFilters: () => void;
  onCreate: () => void;
  /** Opens the existing composer with this text pre-filled as the
   *  caption — a plain pass-through, not an AI classifier (Phase 2+). */
  onCreateWithBrief: (brief: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Opens the Graphic Studio wizard — owned by SocialMediaTab (not
   *  here) so the full-workspace editor it eventually opens can take
   *  over the whole tab, not just this screen. */
  onOpenGraphicWizard: () => void;
  /** Opens the Video Studio wizard — same ownership rationale as
   *  onOpenGraphicWizard above. */
  onOpenVideoWizard: () => void;
  onOpenSavedProject: (id: string) => void;
  /** Bumped by SocialMediaTab whenever the Graphic Studio closes or
   *  publishes, so the saved-projects list refreshes. */
  projectsRefreshKey: number;
};

export function ContentHomeScreen({
  posts,
  counts,
  loading,
  failed,
  highlightId,
  nextScheduled,
  query,
  statusFilter,
  platformFilter,
  layout,
  searchRef,
  onRetry,
  onQueryChange,
  onStatusFilterChange,
  onPlatformFilterChange,
  onLayoutChange,
  onClearFilters,
  onCreate,
  onCreateWithBrief,
  onEdit,
  onDuplicate,
  onDelete,
  onOpenGraphicWizard,
  onOpenVideoWizard,
  onOpenSavedProject,
  projectsRefreshKey,
}: ContentHomeScreenProps) {
  const [brief, setBrief] = useState("");
  const [unavailableTile, setUnavailableTile] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const inputId = useId();
  const briefRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = brief.trim();

  /** The Phase 1 path, preserved exactly: plain pre-fill, no AI. Always
   *  available, regardless of whether an AI provider is configured. */
  const writeManually = () => {
    if (!trimmed) {
      onCreate();
      return;
    }
    onCreateWithBrief(trimmed);
    setBrief("");
  };

  const generate = () => {
    if (trimmed) setGenerating(true);
  };

  const applyStarter = (starter: string) => {
    setBrief(starter);
    setUnavailableTile(null);
    briefRef.current?.focus();
  };

  const noteForTile = QUICK_ACTIONS.find((action) => action.id === unavailableTile)?.unavailableNote ?? null;

  return (
    <div className="space-y-5">
      <style>{HOME_CSS}</style>

      {/* ------------------------- create ------------------------- */}
      {/* Sits on the page rather than in a card, so the first bordered
          thing below is real content and not more chrome. */}
      <section className="ch-in">
        <label htmlFor={inputId} className="block text-[17px] font-semibold tracking-[-0.015em] text-[var(--text)]">
          What would you like to create today?
        </label>
        <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
          A sentence is enough. Say what it is about and who it is for, and the rest can be fixed afterwards.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            generate();
          }}
          className="mt-3"
        >
          <div className="rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)] p-2 transition-colors duration-150 focus-within:border-[var(--accent)]">
            <textarea
              id={inputId}
              ref={briefRef}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              onKeyDown={(event) => {
                // Enter makes a new line in a textarea, so the submit
                // gesture is the one every composer already uses.
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  generate();
                }
              }}
              rows={2}
              placeholder="For example: a LinkedIn post about how we build custom school management systems, aimed at head teachers"
              className={cx(INPUT, "resize-none border-0 bg-transparent p-2 text-[13px] leading-6 focus:bg-transparent", "focus-visible:ring-0 focus-visible:ring-offset-0")}
            />

            <div className="flex flex-wrap items-center gap-2 px-1 pt-1 pb-0.5">
              <span className="hidden text-[10.5px] text-[var(--text-subtle)] sm:inline">
                {trimmed ? "Cmd and Enter to generate" : "Or pick a starting point below"}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <button type="button" onClick={writeManually} className={cx(BTN_SECONDARY, "h-9 px-3 text-[11.5px]")}>
                  {trimmed ? "Write it myself" : "Open a blank post"}
                </button>
                <button
                  type="submit"
                  disabled={!trimmed}
                  className={cx(
                    BTN_PRIMARY,
                    "h-9 px-4 text-[12px]",
                    // An inert slab of the primary colour reads as the
                    // loudest thing on screen while doing nothing.
                    "disabled:border disabled:border-[var(--line-strong)] disabled:bg-transparent disabled:text-[var(--text-subtle)] disabled:opacity-100",
                  )}
                >
                  <Sparkles size={14} />
                  Generate
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Starters — the fastest cure for a blank box is showing what a
            good brief looks like, not telling someone to write one. */}
        {!trimmed && (
          <div className="ch-fade mt-2.5 flex flex-wrap gap-1.5">
            {STARTERS.map((starter) => (
              <button
                key={starter.label}
                type="button"
                onClick={() => applyStarter(starter.brief)}
                className={cx(
                  "inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] transition duration-150 hover:border-[var(--accent)] hover:bg-[var(--accent-tint)] hover:text-[var(--accent)]",
                  FOCUS,
                )}
              >
                {starter.label}
                <ArrowRight size={11} className="opacity-50" />
              </button>
            ))}
          </div>
        )}

        {/* ---------------------- ways in ---------------------- */}
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-semibold tracking-[0.07em] text-[var(--text-subtle)] uppercase">Or start from a format</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {QUICK_ACTIONS.map((action, index) => {
              const Icon = action.icon;
              const available = action.phase === null;
              const pressed = unavailableTile === action.id;

              return (
                <button
                  key={action.id}
                  type="button"
                  aria-expanded={available ? undefined : pressed}
                  onClick={() => {
                    if (action.id === "graphic") {
                      onOpenGraphicWizard();
                      return;
                    }
                    if (action.id === "video") {
                      onOpenVideoWizard();
                      return;
                    }
                    if (available) {
                      // Routed through writeManually, not onCreate, so a
                      // brief already typed above is carried into the
                      // composer rather than silently dropped.
                      writeManually();
                      return;
                    }
                    setUnavailableTile((current) => (current === action.id ? null : action.id));
                  }}
                  style={{ animationDelay: `${60 + index * 35}ms` }}
                  className={cx(
                    "ch-in group flex flex-col items-start gap-2.5 rounded-xl border bg-[var(--surface)] p-3 text-left transition duration-150",
                    FOCUS,
                    available
                      ? "border-[var(--line)] hover:border-[var(--accent)] hover:bg-[var(--accent-tint)]"
                      : pressed
                        ? "border-[var(--line-strong)] border-dashed"
                        : "border-dashed border-[var(--line)] hover:border-[var(--line-strong)]",
                  )}
                >
                  <span
                    className={cx(
                      "flex h-9 w-9 items-center justify-center rounded-lg transition duration-150",
                      available ? "bg-[var(--accent-tint)] text-[var(--accent)]" : "bg-[var(--surface-muted)] text-[var(--text-subtle)]",
                    )}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className={cx("block text-[12px] font-semibold", available ? "text-[var(--text)]" : "text-[var(--text-muted)]")}>{action.label}</span>
                    <span className="mt-0.5 block text-[10.5px] leading-4 text-[var(--text-subtle)]">{available ? action.blurb : "Not available yet"}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* One shared note under the grid rather than a popover per
              tile: a popover anchored to the fifth of five columns ran
              off the right edge, and this can never clip. */}
          {noteForTile && (
            <div role="status" className="ch-fade mt-2 flex items-start gap-2 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-muted)] p-2.5">
              <p className="min-w-0 flex-1 text-[11px] leading-5 text-[var(--text-muted)]">{noteForTile}</p>
              <button
                type="button"
                onClick={() => setUnavailableTile(null)}
                className={cx("shrink-0 rounded text-[10.5px] font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]", FOCUS)}
              >
                Got it
              </button>
            </div>
          )}
        </div>
      </section>

      <ProjectsPanel key={projectsRefreshKey} onOpen={onOpenSavedProject} />

      {/* Existing pipeline — unchanged */}
      <ContentPipeline
        posts={posts}
        counts={counts}
        loading={loading}
        failed={failed}
        highlightId={highlightId}
        nextScheduled={nextScheduled}
        query={query}
        statusFilter={statusFilter}
        platformFilter={platformFilter}
        layout={layout}
        searchRef={searchRef}
        onRetry={onRetry}
        onQueryChange={onQueryChange}
        onStatusFilterChange={onStatusFilterChange}
        onPlatformFilterChange={onPlatformFilterChange}
        onLayoutChange={onLayoutChange}
        onClearFilters={onClearFilters}
        onCreate={onCreate}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />

      {generating && (
        <AiGenerationPanel
          brief={brief}
          onClose={() => setGenerating(false)}
          onContinueToComposer={(text) => {
            setGenerating(false);
            onCreateWithBrief(text);
            setBrief("");
          }}
        />
      )}
    </div>
  );
}