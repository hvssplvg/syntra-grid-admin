"use client";

// Branded handover shown whenever the selected workspace changes
// (Syntra Grid <-> a client, or client <-> client) — the in-app
// counterpart to app/(auth)/login/WelcomeOverlay.tsx's full-screen
// animation.
//
// This used to be a small translucent card reading "Preparing X
// workspace…" for ~560ms. Switching workspace is the single most
// consequential thing in the admin: everything underneath changes
// owner. It now reads as a handover rather than a notification —
// full screen, the workspace you are leaving handing off to the one
// you are entering, with the destination named.
//
// Still no extra dependencies (plain CSS + styled-jsx, matching
// WelcomeOverlay's convention) and still gated only on the already-warm
// client list cache.
//
// Mounted once in AdminShell.tsx. Reads SelectedClientContext's
// `lastSwitch`, which only ever fires from a real selectClient() call
// that changed the id — never from hydration (e.g. refreshing a
// ?client=<id> URL), so this never appears on page load.

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { CLIENTS_ENDPOINT, fetchClientsPayload } from "@/lib/clients/clientsApi";
import { ClientMark } from "@/lib/clients/ClientMark";
import { useSelectedClient } from "./SelectedClientContext";

type Phase = "idle" | "enter" | "hold" | "exit";

/* Retimed to the product target of ~300-500ms total for a normal
   workspace switch (was 1,360ms — premium should read as instant, not as
   a wait). Matches WelcomeOverlay.tsx's own easing curves (see the .to/
   .from/.bar transitions below), just compressed: enough to register the
   handover and read a short name, never long enough to feel like a block
   on navigation. */
const ENTER_MS = 150;
const HOLD_MS = 180;
const EXIT_MS = 130;

const HOUSE = { name: "Syntra Grid", logo: "/images/syntra-logo.png" };

type ClientLite = { id: string; name: string; displayName?: string | null; logo?: string | null; logoUrl?: string | null };

/** The ids involved in the switch being animated. Only ids are held in
 *  state: the names and logos are resolved during render, so if the
 *  client list arrives from SWR part way through the animation the
 *  labels fill themselves in rather than staying on the fallback. */
type SwitchIds = {
  token: number;
  toId: string | null;
  /** undefined on the first switch of a session, where the origin is
   *  genuinely unknown and the handover is drawn as a single mark. */
  fromId: string | null | undefined;
};

export default function ClientSwitchOverlay() {
  const selection = useSelectedClient();
  const { lastSwitch } = selection;

  /* The first switch after a page load has no remembered origin, so it
     would draw a single mark instead of a handover. The shell does know
     which workspace is open, so this reads it if the context exposes it
     and falls back to the single mark if it does not. A narrow optional
     read: nothing breaks if the field is absent or named otherwise. */
  const currentId = (selection as { selectedId?: string | null }).selectedId;

  // Same SWR key AdminHeader.tsx / ClientsTab.tsx already use for the
  // client list — reusing the cache, not issuing a second fetch. By the
  // time any real switch can happen, the user has already seen this list
  // (it's what they clicked), so it's warm in practice.
  const { data: clientsPayload } = useSWR(CLIENTS_ENDPOINT, fetchClientsPayload, {
    dedupingInterval: 60_000,
  });

  const clients = useMemo(() => (clientsPayload?.clients ?? []) as unknown as ClientLite[], [clientsPayload]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [ids, setIds] = useState<SwitchIds | null>(null);

  const seenTokenRef = useRef<number | null>(null);
  const previousIdRef = useRef<string | null | undefined>(undefined);

  // Captured once on mount, before any switch can have happened, so the
  // origin of the first handover is the workspace that was already open.
  // Lazy state rather than a ref, because a ref must not be written
  // during render.
  const [seedId] = useState<string | null | undefined>(() => currentId);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const frameRef = useRef<number | null>(null);

  /* `clients` is deliberately NOT a dependency of the effect below.
     It used to be, and that was a hang: when SWR revalidated the client
     list during the animation, React ran the effect's cleanup (clearing
     the timers that advance the phase), then re-ran the body, which
     returned early on the already-seen token and so never rescheduled
     them. The overlay stayed on screen over the whole dashboard, with
     nothing able to dismiss it. */
  useEffect(() => {
    if (!lastSwitch || lastSwitch.token === seenTokenRef.current) return;
    seenTokenRef.current = lastSwitch.token;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    const toId = lastSwitch.toClientId ?? null;
    const fromId = previousIdRef.current !== undefined ? previousIdRef.current : seedId;
    setIds({ token: lastSwitch.token, toId, fromId });
    previousIdRef.current = toId;

    setPhase("enter");

    // Double-rAF so the "prepare" styles paint before the enter
    // transition is allowed to run — the same trick AdminShell.tsx's own
    // content-transition effect uses.
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => {
        setPhase("hold");
        frameRef.current = null;
      });
    });

    timersRef.current.push(
      setTimeout(() => setPhase("exit"), ENTER_MS + HOLD_MS),
      setTimeout(() => setPhase("idle"), ENTER_MS + HOLD_MS + EXIT_MS),
    );
  }, [lastSwitch, seedId]);

  // Timers are only torn down when the overlay itself goes away, never
  // on an unrelated re-render.
  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const face = (id: string | null) => {
    if (id === null) return HOUSE;
    const match = clients.find((client) => client.id === id);
    return {
      name: match?.displayName || match?.name || "Client workspace",
      logo: match?.logoUrl || match?.logo || null,
    };
  };

  if (phase === "idle" || !ids) return null;

  const to = face(ids.toId);
  const from = ids.fromId === undefined ? null : face(ids.fromId);
  const isReturning = ids.toId === null;
  const total = ENTER_MS + HOLD_MS;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={isReturning ? "Returning to the Syntra Grid workspace" : `Opening the ${to.name} workspace`}
      className={`cso fixed inset-0 z-[95] flex flex-col items-center justify-center px-6 phase-${phase}`}
    >
      {/* The handover itself: what you are leaving, and what you are
          arriving at. A single destination mark on the first switch of a
          session, where there is no honest origin to show. */}
      <div className="marks" aria-hidden>
        {from && (
          <span className="mark from">
            <ClientMark logo={from.logo} name={from.name} size="lg" />
          </span>
        )}

        {from && (
          <span className="trail">
            <span className="dot" />
          </span>
        )}

        <span className="mark to">
          <span className="halo" />
          <ClientMark logo={to.logo} name={to.name} size="lg" priority />
        </span>
      </div>

      <p className="label">{isReturning ? "Returning to" : "Switching to"}</p>
      <h2 className="name">{to.name}</h2>

      <div className="bar" aria-hidden>
        <span />
      </div>

      <style jsx>{`
        .cso {
          background: color-mix(in srgb, var(--canvas, #fbfbfd) 98%, transparent);
          backdrop-filter: blur(20px) saturate(118%);
          -webkit-backdrop-filter: blur(20px) saturate(118%);
          opacity: 0;
          transition: opacity ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .phase-enter,
        .phase-hold {
          opacity: 1;
        }

        .phase-exit {
          opacity: 0;
          transition: opacity ${EXIT_MS}ms cubic-bezier(0.4, 0, 0.9, 1);
        }

        .marks {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          /* ClientMark sizes itself, so the composition is scaled here
             rather than by guessing at a size prop it may not have. */
          transform: scale(1.3);
          transform-origin: center;
        }

        .mark {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        /* What you are leaving: present, then quietly stepping back. */
        .from {
          transform: scale(0.74);
          opacity: 0.9;
          transition: transform ${total}ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity ${total}ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .phase-hold .from,
        .phase-exit .from {
          transform: scale(0.64);
          opacity: 0.38;
        }

        /* What you are arriving at: settles in, then leans forward as the
           overlay lifts, so the exit reads as entering rather than as a
           dialog closing. */
        .to {
          transform: scale(0.86);
          opacity: 0;
          transition: transform ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .phase-enter .to,
        .phase-hold .to {
          transform: scale(1);
          opacity: 1;
        }

        .phase-exit .to {
          transform: scale(1.12);
          opacity: 0;
          transition: transform ${EXIT_MS}ms cubic-bezier(0.4, 0, 0.9, 1),
            opacity ${EXIT_MS}ms cubic-bezier(0.4, 0, 0.9, 1);
        }

        .halo {
          position: absolute;
          inset: -9px;
          border-radius: 26%;
          border: 1.5px solid color-mix(in srgb, var(--accent, #b88a24) 42%, transparent);
          opacity: 0;
        }

        .phase-hold .halo {
          /* Was a hardcoded 900ms sized for the old 700ms hold — now
             scaled to the full visible window so the bloom completes by
             the time exit starts, instead of being cut off mid-animation. */
          animation: cso-halo ${ENTER_MS + HOLD_MS}ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @keyframes cso-halo {
          0% {
            opacity: 0.9;
            transform: scale(0.9);
          }
          70% {
            opacity: 0;
            transform: scale(1.18);
          }
          100% {
            opacity: 0;
            transform: scale(1.18);
          }
        }

        /* The line between the two, with a single point of light crossing
           it. This is the part that actually says "switching". */
        .trail {
          position: relative;
          display: block;
          width: 72px;
          height: 2px;
          border-radius: 2px;
          background: color-mix(in srgb, var(--text, #0b1020) 12%, transparent);
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .phase-enter .trail,
        .phase-hold .trail,
        .phase-exit .trail {
          transform: scaleX(1);
        }

        .dot {
          position: absolute;
          top: 50%;
          left: 0;
          width: 7px;
          height: 7px;
          margin-top: -3.5px;
          border-radius: 999px;
          background: var(--accent, #b88a24);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #b88a24) 18%, transparent);
          opacity: 0;
        }

        .phase-hold .dot {
          animation: cso-travel ${HOLD_MS}ms cubic-bezier(0.5, 0, 0.3, 1) forwards;
        }

        @keyframes cso-travel {
          0% {
            left: 0;
            opacity: 0;
          }
          18% {
            opacity: 1;
          }
          82% {
            opacity: 1;
          }
          100% {
            left: 72px;
            opacity: 0;
          }
        }

        .label {
          margin-top: 38px;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-subtle, #98a2b3);
          opacity: 0;
          transform: translateY(6px);
          transition: opacity ${ENTER_MS}ms ease-out ${Math.round(ENTER_MS * 0.35)}ms,
            transform ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${Math.round(ENTER_MS * 0.35)}ms;
        }

        .name {
          margin-top: 8px;
          max-width: 22ch;
          text-align: center;
          font-size: 32px;
          font-weight: 600;
          letter-spacing: -0.035em;
          line-height: 1.15;
          color: var(--text, #0b1020);
          opacity: 0;
          transform: translateY(8px);
          transition: opacity ${ENTER_MS}ms ease-out ${Math.round(ENTER_MS * 0.5)}ms,
            transform ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${Math.round(ENTER_MS * 0.5)}ms;
        }

        .phase-enter .label,
        .phase-hold .label,
        .phase-exit .label,
        .phase-enter .name,
        .phase-hold .name,
        .phase-exit .name {
          opacity: 1;
          transform: none;
        }

        .bar {
          margin-top: 26px;
          width: 148px;
          height: 2px;
          border-radius: 2px;
          overflow: hidden;
          background: color-mix(in srgb, var(--text, #0b1020) 9%, transparent);
        }

        .bar > span {
          display: block;
          height: 100%;
          width: 0;
          border-radius: 2px;
          background: var(--accent, #b88a24);
        }

        .phase-enter .bar > span,
        .phase-hold .bar > span {
          animation: cso-fill ${total}ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .phase-exit .bar > span {
          width: 100%;
        }

        @keyframes cso-fill {
          from {
            width: 0;
          }
          to {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .trail {
            width: 48px;
          }
          @keyframes cso-travel {
            0% {
              left: 0;
              opacity: 0;
            }
            18% {
              opacity: 1;
            }
            82% {
              opacity: 1;
            }
            100% {
              left: 48px;
              opacity: 0;
            }
          }
          .name {
            font-size: 23px;
          }
          .marks {
            transform: scale(1.08);
          }
        }

        /* Nothing travels, pulses or slides. The handover still happens,
           it is simply stated rather than performed. */
        @media (prefers-reduced-motion: reduce) {
          .cso,
          .from,
          .to,
          .trail,
          .label,
          .name {
            transition: none;
            opacity: 1;
            transform: none;
          }
          .phase-exit {
            opacity: 0;
          }
          .from {
            opacity: 0.45;
          }
          .halo,
          .dot {
            display: none;
          }
          .bar > span {
            animation: none;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}