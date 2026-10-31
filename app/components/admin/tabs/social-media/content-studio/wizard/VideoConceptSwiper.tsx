"use client";

// Swipeable picker for AI-generated video concepts (Content Studio
// Video Studio). Deliberately a thin, fast step before the real
// editor: no Konva render here, just the storyboard text + a cost
// badge, so picking a direction costs nothing beyond the one text
// generation call that produced all 3 concepts. Uses framer-motion's
// drag gesture (already a dependency, already used elsewhere in the
// admin) rather than a hand-rolled pointer-event implementation —
// this is exactly the Tinder-card idiom it exists for.

import { useState } from "react";
import { motion, type PanInfo } from "framer-motion";
import { Clock, Sparkles, Wand2, X } from "lucide-react";

import { BTN_PRIMARY, BTN_SECONDARY, cx } from "../../shared/styles";
import type { VideoConcept } from "@/lib/ai/types";

const SWIPE_THRESHOLD_PX = 120;
const SWIPE_VELOCITY_THRESHOLD = 500;

function conceptTotalSeconds(concept: VideoConcept): number {
  return concept.scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
}

function CostBadge({ concept }: { concept: VideoConcept }) {
  const free = concept.estimatedCostUsd <= 0;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        free ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600",
      )}
    >
      {free ? "Free" : `~$${concept.estimatedCostUsd.toFixed(3)} est.`}
    </span>
  );
}

function ConceptCard({ concept, onSwipe }: { concept: VideoConcept; onSwipe: (direction: "left" | "right") => void }) {
  const totalSeconds = conceptTotalSeconds(concept);

  function handleDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD_PX || info.velocity.x > SWIPE_VELOCITY_THRESHOLD) {
      onSwipe("right");
    } else if (info.offset.x < -SWIPE_THRESHOLD_PX || info.velocity.x < -SWIPE_VELOCITY_THRESHOLD) {
      onSwipe("left");
    }
  }

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02 }}
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="absolute inset-0 flex flex-col rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.25)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
          <Sparkles className="h-3 w-3" /> Hook
        </span>
        <CostBadge concept={concept} />
      </div>

      <p className="mt-3 text-[16px] font-semibold leading-snug text-[var(--text)]">{concept.hook}</p>

      <div className="mt-4 flex items-center gap-1.5 text-[11px] text-[var(--text-subtle)]">
        <Clock className="h-3.5 w-3.5" />
        {concept.scenes.length} scenes · ~{totalSeconds}s total
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
        {concept.scenes.map((scene, index) => (
          <div key={index} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
              <span>Scene {index + 1}</span>
              <span>
                {scene.durationSeconds}s · {scene.backgroundStyle === "ai-image" ? "AI image" : "Brand color"}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] text-[var(--text)]">{scene.text}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 line-clamp-2 text-[11.5px] text-[var(--text-subtle)]">{concept.caption}</p>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button type="button" onClick={() => onSwipe("left")} className={cx(BTN_SECONDARY, "!h-11 !w-11 !rounded-full !p-0")} aria-label="Skip this concept">
          <X className="h-4.5 w-4.5" />
        </button>
        <button type="button" onClick={() => onSwipe("right")} className={cx(BTN_PRIMARY, "!h-11 !w-11 !rounded-full !p-0")} aria-label="Use this concept">
          <Wand2 className="h-4.5 w-4.5" />
        </button>
      </div>
    </motion.div>
  );
}

export function VideoConceptSwiper({
  concepts,
  onSelect,
  onExhausted,
}: {
  concepts: VideoConcept[];
  /** Admin swiped right (or tapped the wand) on this concept. */
  onSelect: (concept: VideoConcept) => void;
  /** Every concept was discarded — the caller shows a "Generate 3 more" action. */
  onExhausted: () => void;
}) {
  const [index, setIndex] = useState(0);

  function handleSwipe(direction: "left" | "right") {
    const concept = concepts[index];
    if (direction === "right" && concept) onSelect(concept);

    const next = index + 1;
    if (next >= concepts.length) {
      onExhausted();
    } else {
      setIndex(next);
    }
  }

  const active = concepts[index];
  if (!active) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-[420px] w-full max-w-sm">
        {concepts.slice(index, index + 2).map((concept, offset) =>
          offset === 0 ? (
            <ConceptCard key={concept.hook + index} concept={concept} onSwipe={handleSwipe} />
          ) : (
            <div key={concept.hook + index + offset} className="absolute inset-0 -z-10 translate-y-2 scale-[0.97] rounded-[22px] border border-[var(--line)] bg-[var(--surface-muted)]" />
          ),
        )}
      </div>
      <p className="text-[11px] text-[var(--text-subtle)]">
        {index + 1} of {concepts.length} — swipe right to use, left to skip
      </p>
    </div>
  );
}
