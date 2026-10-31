/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Content Home's AI generation panel (Phase 2, refined). Opened by the
// creation input's "Generate" action. Never auto-publishes — the only
// way out is "Continue to composer" (hands the final, admin-edited text
// to the existing composer via the exact same openCreate(null, text)
// path Phase 1 already wired for the plain-text brief) or "Discard".
//
// The textarea stays mounted and editable whenever there's existing
// text, regardless of status — a failed Regenerate/tone-change/
// feedback request shows an error banner ABOVE it, never replaces it,
// so the admin's current caption is never hidden by a failure.

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, RefreshCw, Sparkles, X } from "lucide-react";

import { AiApiError, generateAiTextApi } from "../api";
import { BTN_PRIMARY, BTN_SECONDARY, cx, FOCUS, INPUT } from "../../shared/styles";
import { IconButton, Segmented, SegmentButton } from "../../shared/primitives";
import { PLATFORMS } from "../../shared/constants";
import type { SocialPlatform } from "../../shared/types";
import { detectPlatformFromBrief } from "@/lib/ai/platformDetection";

const TONE_OPTIONS: { id: "PROFESSIONAL" | "FRIENDLY" | "CONFIDENT" | "EDUCATIONAL" | "CONVERSATIONAL" | "PROMOTIONAL"; label: string }[] = [
  { id: "PROFESSIONAL", label: "Professional" },
  { id: "FRIENDLY", label: "Friendly" },
  { id: "CONFIDENT", label: "Confident" },
  { id: "EDUCATIONAL", label: "Educational" },
  { id: "CONVERSATIONAL", label: "Conversational" },
  { id: "PROMOTIONAL", label: "Promotional" },
];

type Status = "loading" | "ready" | "error" | "not-configured";
type Tone = (typeof TONE_OPTIONS)[number]["id"];

export function AiGenerationPanel({
  brief,
  onClose,
  onContinueToComposer,
}: {
  brief: string;
  onClose: () => void;
  onContinueToComposer: (text: string) => void;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [missingEnvVars, setMissingEnvVars] = useState<string[]>([]);
  const [platform, setPlatform] = useState<SocialPlatform | null>(() => detectPlatformFromBrief(brief));
  const [platformTouched, setPlatformTouched] = useState(false);
  const [tone, setTone] = useState<Tone | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);

  const run = async (
    action: "GENERATE" | "REGENERATE" | "CHANGE_TONE",
    extra?: { tone?: Tone; feedback?: string },
  ) => {
    setStatus("loading");
    setError(null);
    try {
      const result = await generateAiTextApi({
        action,
        brief: action === "GENERATE" ? brief : undefined,
        currentText: action === "GENERATE" ? undefined : text,
        platform: platform ?? undefined,
        tone: extra?.tone,
        feedback: extra?.feedback,
      });
      setText(result);
      setStatus("ready");
      setFeedbackOpen(false);
      setFeedback("");
    } catch (caught) {
      if (caught instanceof AiApiError && caught.missingEnvVars?.length) {
        setMissingEnvVars(caught.missingEnvVars);
        setStatus("not-configured");
        return;
      }
      setError(caught instanceof Error ? caught.message : "AI generation failed.");
      setStatus("error");
    }
  };

  // Fires once, on mount — intentionally not re-run on platform change,
  // the admin uses Regenerate for that. Same accepted "kick off an async
  // fetch on mount" shape used elsewhere in this codebase.
  useEffect(() => {
    void run("GENERATE");
  }, []);

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy failed. Check clipboard permissions.");
    }
  };

  const limit = platform ? PLATFORMS.find((item) => item.id === platform)?.limit : undefined;
  const overLimit = Boolean(limit && text.length > limit);
  const hasText = text.trim().length > 0;
  const firstLoad = status === "loading" && !hasText;

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-generation-title"
        className="sg-dialog flex w-full max-w-[560px] flex-col overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-4">
          <h2 id="ai-generation-title" className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]">
            <Sparkles size={16} className="text-[var(--accent)]" />
            AI-generated caption
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <p className="mb-3 text-[11.5px] leading-5 text-[var(--text-subtle)]">
            Brief: <span className="text-[var(--text-muted)]">{brief}</span>
          </p>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] font-medium text-[var(--text-muted)]">Write for:</span>
            <Segmented label="Target platform">
              <SegmentButton
                active={platform === null}
                onClick={() => {
                  setPlatform(null);
                  setPlatformTouched(true);
                }}
              >
                General
              </SegmentButton>
              {PLATFORMS.map((item) => (
                <SegmentButton
                  key={item.id}
                  active={platform === item.id}
                  onClick={() => {
                    setPlatform(item.id);
                    setPlatformTouched(true);
                  }}
                >
                  {item.name}
                </SegmentButton>
              ))}
            </Segmented>
            {!platformTouched && platform && (
              <span className="text-[10px] text-[var(--text-subtle)]">(detected from your brief)</span>
            )}
          </div>

          {hasText && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[10.5px] font-medium text-[var(--text-muted)]">Tone:</span>
              <Segmented label="Tone">
                {TONE_OPTIONS.map((option) => (
                  <SegmentButton
                    key={option.id}
                    active={tone === option.id}
                    onClick={() => {
                      setTone(option.id);
                      void run("CHANGE_TONE", { tone: option.id });
                    }}
                  >
                    {option.label}
                  </SegmentButton>
                ))}
              </Segmented>
            </div>
          )}

          {firstLoad && (
            <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-[var(--text-subtle)]">
              <Loader2 size={22} className="animate-spin text-[var(--accent)]" />
              <p className="text-[11.5px]">Writing a caption from your brief…</p>
            </div>
          )}

          {status === "not-configured" && (
            <div className="rounded-xl border border-dashed border-[var(--line)] p-4 text-[11.5px] leading-5 text-[var(--text-muted)]">
              <p className="font-semibold text-[var(--text)]">AI generation isn&apos;t configured yet.</p>
              <p className="mt-1">
                Missing environment variable{missingEnvVars.length > 1 ? "s" : ""}: {missingEnvVars.join(", ") || "unknown"}.
              </p>
              <p className="mt-2">You can still write this post manually — close this panel and use the composer directly.</p>
            </div>
          )}

          {status === "error" && (
            <div className="mb-2 rounded-xl border border-dashed border-red-500/40 p-3 text-[11px] leading-5 text-red-600">
              {error}
            </div>
          )}

          {status === "loading" && hasText && (
            <div className="mb-2 flex items-center gap-2 text-[11px] text-[var(--text-subtle)]">
              <Loader2 size={12} className="animate-spin" />
              Working…
            </div>
          )}

          {hasText && (
            <>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={8}
                className={cx(INPUT, "resize-none p-3 text-[12.5px] leading-6")}
              />
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px]">
                <span className={overLimit ? "font-semibold text-red-600" : "text-[var(--text-subtle)]"}>
                  {text.length.toLocaleString("en-GB")}
                  {limit ? ` / ${limit.toLocaleString("en-GB")}` : ""} characters
                  {overLimit && " — over the limit for this platform"}
                </span>
                <button type="button" onClick={copyCaption} className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline">
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="mt-3 border-t border-[var(--line)] pt-3">
                {feedbackOpen ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      autoFocus
                      value={feedback}
                      onChange={(event) => setFeedback(event.target.value)}
                      placeholder="e.g. Make this less promotional, focus more on admissions"
                      className={cx(INPUT, "h-9 flex-1 text-[11.5px]")}
                    />
                    <button
                      type="button"
                      disabled={!feedback.trim()}
                      onClick={() => run("REGENERATE", { feedback: feedback.trim() })}
                      className={cx(BTN_SECONDARY, FOCUS, "h-9 shrink-0 px-3 text-[11px]")}
                    >
                      Apply
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFeedbackOpen(true)}
                    className="text-[10.5px] font-medium text-[var(--accent)] hover:underline"
                  >
                    Regenerate with feedback…
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-5 py-3.5">
          <button type="button" onClick={onClose} className={cx(BTN_SECONDARY, FOCUS)}>
            Discard
          </button>
          <div className="flex items-center gap-2">
            {hasText && (
              <button type="button" onClick={() => run("REGENERATE")} className={cx(BTN_SECONDARY, FOCUS)}>
                <RefreshCw size={14} />
                Regenerate
              </button>
            )}
            {hasText && (
              <button type="button" onClick={() => onContinueToComposer(text)} className={cx(BTN_PRIMARY, FOCUS)}>
                Continue to composer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
