"use client";

// Shared presentational components used across SocialMediaTab.tsx and
// the content-studio directory. Moved verbatim from SocialMediaTab.tsx
// as part of the circular-import cleanup described in
// /Users/hvss/.claude/plans/cuddly-gathering-willow.md — no markup,
// class name, or behaviour changed, only relocated.

import type { CSSProperties, ReactNode } from "react";

import { Play } from "lucide-react";

import { SocialPlatformIcon } from "../../../common/SocialPlatformIcon";
import { MARK_ICON_PIXELS, MARK_SIZES, REAL_STATUS_META } from "./constants";
import { platformDefinition } from "./format";
import { ACCENT_SOFT, cx, FOCUS, FOCUS_INSET, mix } from "./styles";
import type { IconType, RealPostStatus, SocialPlatform } from "./types";

export function PlatformMark({
  platform,
  size = "sm",
  ring,
  label,
}: {
  platform: SocialPlatform;
  size?: keyof typeof MARK_SIZES;
  ring?: boolean;
  /** Pass the name only when this mark is the sole identifier on screen. */
  label?: string;
}) {
  const definition = platformDefinition(platform);
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center leading-none",
        MARK_SIZES[size],
        ring && "ring-2 ring-[var(--surface)]",
      )}
      style={{ background: mix(definition.color, 13, "var(--surface)") }}
      aria-hidden={label ? undefined : true}
    >
      <SocialPlatformIcon platform={platform} size={MARK_ICON_PIXELS[size]} color={definition.color} label={label} />
    </span>
  );
}

export function PlatformStack({ platforms, size = "sm" }: { platforms: SocialPlatform[]; size?: "sm" | "md" }) {
  const names = platforms.map((platform) => platformDefinition(platform).name).join(", ");
  return (
    <span className="flex -space-x-1" title={names}>
      {platforms.map((platform) => (
        <PlatformMark key={platform} platform={platform} size={size} ring />
      ))}
      <span className="sr-only">{names}</span>
    </span>
  );
}

/** Always shows the real backend status, so a failed post never looks scheduled. */
export function StatusPill({ status, large }: { status: RealPostStatus; large?: boolean }) {
  const meta = REAL_STATUS_META[status];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        large ? "px-2.5 py-1 text-[10.5px]" : "px-2 py-0.5 text-[10px]",
      )}
      style={{ background: mix(meta.hue, 13), color: meta.hue }}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full bg-current", status === "PUBLISHING" && "animate-pulse")} />
      {meta.label}
    </span>
  );
}

export function MediaThumb({
  src,
  type,
  className,
}: {
  src: string;
  type: "IMAGE" | "VIDEO" | null;
  className?: string;
}) {
  if (type === "VIDEO") {
    return (
      <span className={cx("relative block overflow-hidden bg-black", className)}>
        <video src={src} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Play size={14} className="text-white drop-shadow" fill="currentColor" />
        </span>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" className={cx("object-cover", className)} />;
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={cx("sg-skeleton block rounded-full", className)} style={style} />;
}

export function Dot({ color }: { color: string }) {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />;
}

export function Kbd({ children, inverse, className }: { children: ReactNode; inverse?: boolean; className?: string }) {
  return (
    <kbd
      className={cx(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 font-sans text-[10px] font-semibold",
        inverse
          ? "bg-white/20 text-white"
          : "border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  bordered,
  expanded,
  size = "md",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  bordered?: boolean;
  expanded?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      onClick={onClick}
      className={cx(
        "flex shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--surface-muted)] hover:text-[var(--text)] active:scale-[0.94]",
        FOCUS,
        size === "sm" ? "h-7 w-7" : "h-9 w-9",
        bordered && "rounded-xl border border-[var(--line)] bg-[var(--surface)]",
        expanded && "bg-[var(--surface-muted)] text-[var(--text)]",
      )}
    >
      {children}
    </button>
  );
}

export function Segmented({ label, children, compact }: { label: string; children: ReactNode; compact?: boolean }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(compact ? "h-7" : "h-9", "inline-flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-0.5")}
    >
      {children}
    </div>
  );
}

export function SegmentButton({
  active,
  onClick,
  children,
  title,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cx(
        "inline-flex h-full min-w-8 items-center justify-center gap-1.5 rounded-[9px] px-2.5 text-[11px] font-medium transition-[background-color,color,box-shadow] duration-150",
        FOCUS_INSET,
        active
          ? "bg-[var(--surface)] text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
          : "text-[var(--text-muted)] hover:text-[var(--text)]",
        disabled && "cursor-not-allowed opacity-60 hover:text-[var(--text-muted)]",
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: IconType;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
      <span className={cx("flex h-12 w-12 items-center justify-center rounded-2xl", ACCENT_SOFT)}>
        <Icon size={20} />
      </span>
      <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.015em] text-[var(--text)]">{title}</h3>
      <p className="mt-1.5 max-w-[340px] text-[11.5px] leading-5 text-[var(--text-muted)]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
