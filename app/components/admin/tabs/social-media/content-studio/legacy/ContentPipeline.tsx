"use client";

// Phase 1, Step A extraction (content-studio plan, cuddly-gathering-willow):
// this is the existing Content view's pipeline/list UI, moved out of
// SocialMediaTab.tsx verbatim — same markup, same state shape, same
// behaviour, only relocated. SocialMediaTab.tsx's "content" branch now
// renders ContentHomeScreen (../ContentHomeScreen.tsx), which renders
// this component unchanged beneath the new Content Home UI. Nothing
// here was rewritten; only names changed are the top-level export
// (ContentStudio → ContentPipeline, to avoid colliding with the new
// Content Studio entry point) and the import source for shared
// primitives/types/constants, which now come from the social-media/shared/
// modules (not SocialMediaTab.tsx directly — see that cleanup's note in
// the plan file for why).

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Clock3,
  Copy,
  Edit3,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { PLATFORMS, STATUS_META, STATUS_ORDER } from "../../shared/constants";
import { editedLabel, formatDateTime, relativeTime } from "../../shared/format";
import {
  Dot,
  EmptyState,
  IconButton,
  Kbd,
  MediaThumb,
  PlatformMark,
  PlatformStack,
  Segmented,
  SegmentButton,
  Skeleton,
  StatusPill,
} from "../../shared/primitives";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, cx, FOCUS, FOCUS_INSET, INPUT } from "../../shared/styles";
import type { ContentFilter, Counts, IconType, LibraryLayout, PlatformFilter, SocialPost } from "../../shared/types";

export function ContentPipeline({
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
  onEdit,
  onDuplicate,
  onDelete,
}: {
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
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const filtering =
    query.trim() !== "" || statusFilter !== "ALL" || platformFilter !== "ALL";

  let body: ReactNode;
  if (loading) {
    body = <PostSkeleton layout={layout} />;
  } else if (failed) {
    body = (
      <EmptyState
        icon={AlertCircle}
        title="Posts couldn't be loaded"
        description="Check your connection, then try again."
        action={
          <button type="button" onClick={onRetry} className={cx(BTN_SECONDARY, FOCUS)}>
            <RefreshCw size={14} />
            Try again
          </button>
        }
      />
    );
  } else if (posts.length === 0) {
    body = (
      <EmptyState
        icon={filtering ? Search : Edit3}
        title={filtering ? "No posts match" : "Write your first post"}
        description={
          filtering
            ? "Try another search term, or clear the filters to see everything."
            : "Drafts, posts waiting for review and scheduled posts all collect here."
        }
        action={
          filtering ? (
            <button type="button" onClick={onClearFilters} className={cx(BTN_SECONDARY, FOCUS)}>
              Clear filters
            </button>
          ) : (
            <button type="button" onClick={onCreate} className={cx(BTN_PRIMARY, FOCUS)}>
              <Plus size={15} />
              Create post
            </button>
          )
        }
      />
    );
  } else if (layout === "list") {
    body = (
      <div className="divide-y divide-[var(--line)] [&>*:last-child]:rounded-b-[22px]">
        {posts.map((post) => (
          <PostRow
            key={post.id}
            post={post}
            highlighted={post.id === highlightId}
            onEdit={() => onEdit(post.id)}
            onDuplicate={() => onDuplicate(post.id)}
            onDelete={() => onDelete(post.id)}
          />
        ))}
      </div>
    );
  } else {
    body = (
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            highlighted={post.id === highlightId}
            onEdit={() => onEdit(post.id)}
            onDuplicate={() => onDuplicate(post.id)}
            onDelete={() => onDelete(post.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Pipeline
        counts={counts}
        loading={loading}
        active={statusFilter}
        onSelect={onStatusFilterChange}
        nextScheduled={nextScheduled}
        onOpen={onEdit}
        onCreate={onCreate}
      />

      <section className={CARD}>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--text)]">
              Posts
            </h2>
            <span className="text-[11px] tabular-nums text-[var(--text-subtle)]">
              {loading ? "" : filtering ? `${posts.length} of ${counts.total}` : counts.total}
            </span>
            {filtering && (
              <button
                type="button"
                onClick={onClearFilters}
                className={cx(
                  "sg-fade rounded-md text-[11px] font-medium text-[var(--accent)] hover:underline",
                  FOCUS,
                )}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[240px]">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
              />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    onQueryChange("");
                    event.currentTarget.blur();
                  }
                }}
                placeholder="Search posts"
                aria-label="Search posts"
                className={cx(INPUT, "h-9 bg-[var(--surface-muted)] pl-9 pr-9 text-[11.5px]")}
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => onQueryChange("")}
                  className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-subtle)] hover:text-[var(--text)]"
                >
                  <X size={12} />
                </button>
              ) : (
                <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">/</Kbd>
              )}
            </div>

            <Segmented label="Filter by channel">
              <SegmentButton
                active={platformFilter === "ALL"}
                onClick={() => onPlatformFilterChange("ALL")}
              >
                All
              </SegmentButton>
              {PLATFORMS.map((platform) => (
                <SegmentButton
                  key={platform.id}
                  active={platformFilter === platform.id}
                  onClick={() => onPlatformFilterChange(platform.id)}
                  title={platform.name}
                >
                  <PlatformMark platform={platform.id} size="xs" />
                  <span className="sr-only">{platform.name}</span>
                </SegmentButton>
              ))}
            </Segmented>

            <Segmented label="Layout">
              <SegmentButton
                active={layout === "list"}
                onClick={() => onLayoutChange("list")}
                title="List view"
              >
                <List size={14} />
                <span className="sr-only">List view</span>
              </SegmentButton>
              <SegmentButton
                active={layout === "grid"}
                onClick={() => onLayoutChange("grid")}
                title="Grid view"
              >
                <LayoutGrid size={14} />
                <span className="sr-only">Grid view</span>
              </SegmentButton>
            </Segmented>
          </div>
        </div>

        <div key={`${layout}-${loading ? "loading" : "ready"}`} className="sg-fade">
          {body}
        </div>
      </section>
    </div>
  );
}

function PostSkeleton({ layout }: { layout: LibraryLayout }) {
  if (layout === "grid") {
    return (
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3" aria-busy="true" aria-label="Loading posts">
        {[0, 1, 2].map((index) => (
          <div key={index} className="rounded-[18px] border border-[var(--line)] p-4">
            <Skeleton className="h-7 w-16 rounded-[9px]" />
            <Skeleton className="mt-4 h-2.5 w-full" />
            <Skeleton className="mt-2 h-2.5 w-4/5" />
            <Skeleton className="mt-2 h-2.5 w-3/5" />
            <Skeleton className="mt-6 h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--line)]" aria-busy="true" aria-label="Loading posts">
      {[78, 62, 70, 54].map((width, index) => (
        <div key={index} className="flex gap-4 px-4 py-4 sm:px-5">
          <Skeleton className="h-7 w-7 rounded-[9px]" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-2.5" style={{ width: `${width}%` }} />
            <Skeleton className="mt-2 h-2.5 w-2/5" />
            <Skeleton className="mt-3.5 h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* =============================================================================
   PIPELINE (draft → review → scheduled)
============================================================================= */

function Pipeline({
  counts,
  loading,
  active,
  onSelect,
  nextScheduled,
  onOpen,
  onCreate,
}: {
  counts: Counts;
  loading: boolean;
  active: ContentFilter;
  onSelect: (value: ContentFilter) => void;
  nextScheduled: SocialPost | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <section className={cx(CARD, "grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px]")}>
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold text-[var(--text)]">Content pipeline</h2>
          {active !== "ALL" && (
            <button
              type="button"
              onClick={() => onSelect("ALL")}
              className={cx(
                "sg-fade rounded-md text-[11px] font-medium text-[var(--accent)] hover:underline",
                FOCUS,
              )}
            >
              Show all posts
            </button>
          )}
        </div>

        <div className="mt-4 flex items-stretch gap-1.5">
          {STATUS_ORDER.map((status, index) => {
            const meta = STATUS_META[status];
            const selected = active === status;
            const value = counts[status];

            return (
              <div key={status} className="flex min-w-0 flex-1 items-stretch gap-1.5">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(selected ? "ALL" : status)}
                  className={cx(
                    "min-w-0 flex-1 rounded-2xl border p-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 active:scale-[0.985] sm:p-4",
                    FOCUS,
                    selected
                      ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_12%,transparent)]"
                      : "border-[var(--line)] hover:border-[color-mix(in_srgb,var(--text)_22%,var(--line))]",
                  )}
                >
                  <span className="flex items-center gap-2 truncate text-[11px] font-medium text-[var(--text-muted)]">
                    <Dot color={meta.hue} />
                    {meta.short}
                  </span>
                  {loading ? (
                    <Skeleton className="mt-2 h-[26px] w-10 rounded-lg sm:h-[30px]" />
                  ) : (
                    <span className="mt-2 block text-[26px] font-semibold leading-none tabular-nums tracking-[-0.04em] text-[var(--text)] sm:text-[30px]">
                      {value}
                    </span>
                  )}
                  <span className="mt-2 hidden truncate text-[10.5px] text-[var(--text-subtle)] sm:block">
                    {meta.description}
                  </span>
                </button>

                {index < STATUS_ORDER.length - 1 && (
                  <ChevronRight
                    size={14}
                    aria-hidden
                    className="hidden shrink-0 self-center text-[var(--text-subtle)] sm:block"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div
          className="mt-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
          aria-hidden
        >
          {counts.total > 0 &&
            STATUS_ORDER.map((status) =>
              counts[status] > 0 ? (
                <span
                  key={status}
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${(counts[status] / counts.total) * 100}%`,
                    background: STATUS_META[status].hue,
                    opacity: status === "DRAFT" ? 0.45 : 1,
                  }}
                />
              ) : null,
            )}
        </div>
      </div>

      {/* Next up */}
      <div className="flex flex-col border-t border-[var(--line)] bg-[var(--surface-muted)] p-4 sm:p-5 lg:border-l lg:border-t-0">
        <p className="text-[11px] font-medium text-[var(--text-muted)]">Next scheduled</p>

        {loading ? (
          <div className="mt-2 flex-1">
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="mt-2 h-2.5 w-36" />
            <Skeleton className="mt-4 h-2.5 w-full" />
            <Skeleton className="mt-2 h-2.5 w-3/4" />
          </div>
        ) : nextScheduled?.scheduledAt ? (
          <button
            type="button"
            onClick={() => onOpen(nextScheduled.id)}
            className={cx("group mt-2 flex flex-1 flex-col rounded-xl text-left", FOCUS)}
          >
            <span className="text-[18px] font-semibold tracking-[-0.025em] text-[var(--text)]">
              {relativeTime(nextScheduled.scheduledAt)}
            </span>
            <span className="mt-0.5 text-[11px] tabular-nums text-[var(--text-muted)]">
              {formatDateTime(nextScheduled.scheduledAt)}
            </span>
            <span className="mt-3 line-clamp-2 text-[11.5px] leading-5 text-[var(--text)]">
              {nextScheduled.caption}
            </span>
            <span className="mt-auto flex items-center justify-between gap-2 pt-3">
              <PlatformStack platforms={nextScheduled.platforms} />
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)]">
                Open
                <ChevronRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </span>
          </button>
        ) : (
          <div className="mt-2 flex flex-1 flex-col">
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              Nothing scheduled
            </span>
            <span className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
              Give a post a date and time and it will show up here.
            </span>
            <button
              type="button"
              onClick={onCreate}
              className={cx(BTN_SECONDARY, FOCUS, "mt-auto h-9 self-start px-3 text-[11px]")}
            >
              <CalendarDays size={13} />
              Plan a post
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* =============================================================================
   POST ROW / CARD
============================================================================= */

function PostRow({
  post,
  highlighted,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  post: SocialPost;
  highlighted: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cx(
        "group flex gap-3.5 px-4 py-4 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--surface-muted)_70%,transparent)] sm:gap-4 sm:px-5",
        highlighted && "sg-flash",
      )}
    >
      <div className="pt-0.5">
        <PlatformStack platforms={post.platforms} size="md" />
      </div>

      <button
        type="button"
        onClick={onEdit}
        className={cx("min-w-0 flex-1 rounded-lg text-left", FOCUS)}
      >
        {post.title && (
          <p className="mb-0.5 truncate text-[11px] font-semibold text-[var(--text-muted)]">{post.title}</p>
        )}
        <p className="line-clamp-2 whitespace-pre-wrap text-[12.5px] leading-6 text-[var(--text)]">
          {post.caption}
        </p>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10.5px] text-[var(--text-muted)]">
          <StatusPill status={post.realStatus} />
          {post.scheduledAt && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock3 size={11} />
              {formatDateTime(post.scheduledAt)}
            </span>
          )}
          <span className="text-[var(--text-subtle)]">{editedLabel(post.updatedAt)}</span>
        </span>
      </button>

      {post.image && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit post"
          className={cx("relative hidden shrink-0 overflow-hidden rounded-xl border border-[var(--line)] sm:block", FOCUS)}
        >
          <MediaThumb src={post.image} type={post.imageType} className="h-14 w-14" />
          {post.assetIds.length > 1 && (
            <span className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1 text-[9px] font-semibold text-white">
              +{post.assetIds.length - 1}
            </span>
          )}
        </button>
      )}

      <div className="flex shrink-0 items-start gap-1 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <IconButton label="Edit post" onClick={onEdit}>
          <Edit3 size={14} />
        </IconButton>
        <RowMenu onDuplicate={onDuplicate} onDelete={onDelete} deleteDisabled={post.realStatus === "PUBLISHING"} />
      </div>
    </div>
  );
}

function PostCard({
  post,
  highlighted,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  post: SocialPost;
  highlighted: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={cx(
        "flex flex-col rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))] hover:shadow-[0_14px_30px_-18px_rgba(0,0,0,0.35)]",
        highlighted && "sg-flash",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <PlatformStack platforms={post.platforms} size="md" />
        <RowMenu onDuplicate={onDuplicate} onDelete={onDelete} deleteDisabled={post.realStatus === "PUBLISHING"} />
      </div>

      {post.image && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit post"
          className={cx("relative mt-3 overflow-hidden rounded-xl border border-[var(--line)]", FOCUS)}
        >
          <MediaThumb src={post.image} type={post.imageType} className="aspect-[4/3] w-full" />
          {post.assetIds.length > 1 && (
            <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              1 / {post.assetIds.length}
            </span>
          )}
        </button>
      )}

      <button type="button" onClick={onEdit} className={cx("mt-3 flex-1 rounded-lg text-left", FOCUS)}>
        {post.title && (
          <p className="mb-1 truncate text-[11px] font-semibold text-[var(--text-muted)]">{post.title}</p>
        )}
        <p className={cx(post.image ? "line-clamp-3" : "line-clamp-5", "whitespace-pre-wrap text-[12.5px] leading-6 text-[var(--text)]")}>
          {post.caption}
        </p>
      </button>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <StatusPill status={post.realStatus} />
        <span className="truncate text-[10.5px] tabular-nums text-[var(--text-subtle)]">
          {post.scheduledAt ? formatDateTime(post.scheduledAt) : editedLabel(post.updatedAt)}
        </span>
      </div>
    </article>
  );
}

function RowMenu({
  onDuplicate,
  onDelete,
  deleteDisabled,
}: {
  onDuplicate: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <IconButton label="More actions" onClick={() => setOpen((value) => !value)} expanded={open}>
        <MoreHorizontal size={15} />
      </IconButton>

      {open && (
        <div
          role="menu"
          className="sg-pop absolute right-0 top-full z-30 mt-1.5 w-48 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]"
        >
          <MenuItem
            icon={Copy}
            onClick={() => {
              setOpen(false);
              onDuplicate();
            }}
          >
            Duplicate as draft
          </MenuItem>
          <MenuItem
            icon={Trash2}
            danger
            disabled={deleteDisabled}
            title={deleteDisabled ? "This post is currently publishing and can't be deleted yet." : undefined}
            onClick={() => {
              if (deleteDisabled) return;
              setOpen(false);
              onDelete();
            }}
          >
            {deleteDisabled ? "Publishing…" : "Delete post"}
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  danger,
  disabled,
  title,
  onClick,
  children,
}: {
  icon: IconType;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11.5px] font-medium transition-colors duration-150",
        FOCUS_INSET,
        disabled
          ? "cursor-not-allowed text-[var(--text-subtle)]"
          : danger
            ? "text-red-600 hover:bg-red-500/10"
            : "text-[var(--text)] hover:bg-[var(--surface-muted)]",
      )}
    >
      <Icon size={14} />
      {children}
    </button>
  );
}
