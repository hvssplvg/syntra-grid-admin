"use client";

// In-composer AI writing assistant (Phase 2) — a single contextual
// popover next to the caption field, not a row of extra buttons.
// Operates ONLY on the one field it's handed (the shared caption, or a
// specific platform's override when adapting) — it never touches any
// other platform's customised caption, and the caller (SocialMediaTab's
// PostComposer) is responsible for confirming before an overwrite.

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, Sparkles } from "lucide-react";

import { AiApiError, generateAiTextApi } from "../api";
import { IconButton } from "../../shared/primitives";
import { BTN_PRIMARY, cx, FOCUS, FOCUS_INSET, INPUT } from "../../shared/styles";
import type { SocialPlatform } from "../../shared/types";

const TONE_OPTIONS: { id: "PROFESSIONAL" | "FRIENDLY" | "CONFIDENT" | "EDUCATIONAL" | "CONVERSATIONAL" | "PROMOTIONAL"; label: string }[] = [
  { id: "PROFESSIONAL", label: "Professional" },
  { id: "FRIENDLY", label: "Friendly" },
  { id: "CONFIDENT", label: "Confident" },
  { id: "EDUCATIONAL", label: "Educational" },
  { id: "CONVERSATIONAL", label: "Conversational" },
  { id: "PROMOTIONAL", label: "Promotional" },
];

function MenuRow({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11.5px] font-medium text-[var(--text)] transition-colors duration-150",
        FOCUS_INSET,
        disabled ? "cursor-not-allowed text-[var(--text-subtle)]" : "hover:bg-[var(--surface-muted)]",
      )}
    >
      {children}
    </button>
  );
}

export function AiWritingAssistant({
  text,
  platform,
  otherPlatforms,
  onApply,
}: {
  /** The caption text this assistant currently operates on. */
  text: string;
  /** The primary platform this caption is being written for (steers
   *  tone/limit guidance) — the first selected platform, or null. */
  platform: SocialPlatform | null;
  /** Platforms this caption could be adapted *into*, for the "Adapt for
   *  another platform" submenu — every selected platform except the
   *  current one. */
  otherPlatforms: { id: SocialPlatform; name: string }[];
  /** Writes the result back. targetPlatform is set only for "Adapt for
   *  another platform" — the caller decides whether that platform's
   *  existing override needs a confirm-overwrite step. */
  onApply: (text: string, targetPlatform?: SocialPlatform) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<"tone" | "platform" | "brief" | null>(null);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
        setSubmenu(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const run = async (
    action: "GENERATE" | "IMPROVE" | "SHORTEN" | "LENGTHEN" | "MORE_PROFESSIONAL" | "MORE_ENGAGING" | "CHANGE_TONE" | "GENERATE_HASHTAGS" | "ADAPT_PLATFORM" | "REGENERATE",
    extra?: { brief?: string; tone?: (typeof TONE_OPTIONS)[number]["id"]; targetPlatform?: SocialPlatform },
  ) => {
    setBusy(true);
    setError(null);
    try {
      const result = await generateAiTextApi({
        action,
        brief: extra?.brief,
        currentText: action === "GENERATE" ? undefined : text,
        platform: platform ?? undefined,
        targetPlatform: extra?.targetPlatform,
        tone: extra?.tone,
      });

      if (action === "GENERATE_HASHTAGS") {
        onApply(text ? `${text}\n\n${result}` : result);
      } else if (action === "ADAPT_PLATFORM" && extra?.targetPlatform) {
        onApply(result, extra.targetPlatform);
      } else {
        onApply(result);
      }
      setOpen(false);
      setSubmenu(null);
    } catch (caught) {
      setError(caught instanceof AiApiError ? caught.message : "AI request failed.");
    } finally {
      setBusy(false);
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <div ref={ref} className="relative">
      <IconButton label="AI writing assistant" onClick={() => setOpen((value) => !value)} expanded={open}>
        <Sparkles size={14} />
      </IconButton>

      {open && (
        <div
          role="menu"
          className="sg-pop absolute right-0 top-full z-30 mt-1.5 w-60 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]"
        >
          {busy ? (
            <div className="flex items-center justify-center gap-2 px-2.5 py-4 text-[11px] text-[var(--text-subtle)]">
              <Loader2 size={14} className="animate-spin" />
              Working…
            </div>
          ) : submenu === "tone" ? (
            <>
              {TONE_OPTIONS.map((tone) => (
                <MenuRow key={tone.id} onClick={() => run("CHANGE_TONE", { tone: tone.id })}>
                  {tone.label}
                </MenuRow>
              ))}
            </>
          ) : submenu === "brief" ? (
            <div className="p-1.5">
              <textarea
                autoFocus
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="Describe the post…"
                rows={3}
                className={cx(INPUT, "resize-none p-2 text-[11px] leading-5")}
              />
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <button type="button" onClick={() => setSubmenu(null)} className="text-[10.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text)]">
                  Back
                </button>
                <button
                  type="button"
                  disabled={!brief.trim()}
                  onClick={() => run("GENERATE", { brief: brief.trim() })}
                  className={cx(BTN_PRIMARY, FOCUS, "h-7 px-2.5 text-[10.5px]")}
                >
                  Generate
                </button>
              </div>
            </div>
          ) : submenu === "platform" ? (
            otherPlatforms.length === 0 ? (
              <p className="px-2.5 py-3 text-[10.5px] text-[var(--text-subtle)]">Select another channel first.</p>
            ) : (
              otherPlatforms.map((item) => (
                <MenuRow key={item.id} onClick={() => run("ADAPT_PLATFORM", { targetPlatform: item.id })}>
                  {item.name}
                </MenuRow>
              ))
            )
          ) : (
            <>
              {error && <p className="px-2.5 py-1.5 text-[10.5px] text-red-600">{error}</p>}
              <MenuRow onClick={() => setSubmenu("brief")}>Generate caption</MenuRow>
              <MenuRow disabled={!hasText} onClick={() => run("IMPROVE")}>
                Improve writing
              </MenuRow>
              <MenuRow disabled={!hasText} onClick={() => run("SHORTEN")}>
                Make shorter
              </MenuRow>
              <MenuRow disabled={!hasText} onClick={() => run("LENGTHEN")}>
                Make longer
              </MenuRow>
              <MenuRow disabled={!hasText} onClick={() => run("MORE_PROFESSIONAL")}>
                Make more professional
              </MenuRow>
              <MenuRow disabled={!hasText} onClick={() => run("MORE_ENGAGING")}>
                Make more engaging
              </MenuRow>
              <MenuRow disabled={!hasText} onClick={() => setSubmenu("tone")}>
                Change tone
                <ChevronRight size={13} />
              </MenuRow>
              <MenuRow disabled={!hasText} onClick={() => run("GENERATE_HASHTAGS")}>
                Generate hashtags
              </MenuRow>
              <MenuRow disabled={!hasText} onClick={() => setSubmenu("platform")}>
                Adapt for another platform
                <ChevronRight size={13} />
              </MenuRow>
              <MenuRow disabled={!hasText} onClick={() => run("REGENERATE")}>
                Regenerate
              </MenuRow>
            </>
          )}
        </div>
      )}
    </div>
  );
}
