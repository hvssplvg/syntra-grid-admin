'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

import AuthBackdrop from './Authbackdrop';

const GOLD = 'linear-gradient(135deg,#F3DFA2,#D4AF37 60%,#C79A2A)';

const STEPS = [
  'Verifying your session',
  'Loading your workspace',
  'Preparing the dashboard',
];

/** The whole handover, from the first frame to the dashboard. */
const TOTAL_MS = 5000;

/** When each step is allowed to tick, measured from the first frame. */
const STEP_AT_MS = [1300, 3000, 4400];

/** The real fetch is given until this point before the second step ticks. */
const WORKSPACE_DEADLINE_MS = 4100;

/** The content clears just before the route changes, leaving a plain field
    for the dashboard to rise into. The backdrop itself never fades, so there
    is no moment where the login page shows through. */
const EXIT_LEAD_MS = 420;

/** If a soft navigation has not unmounted us by then, force a hard one. */
const FALLBACK_MS = 1200;

/** Last resort, in case the sequence itself never reaches the end. */
const WATCHDOG_MS = 2600;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * Pulls the dashboard's payload down while the overlay plays, so the steps
 * measure real work instead of counting to themselves.
 */
async function warmDashboard() {
  try {
    const response = await fetch('/dashboard', {
      headers: { RSC: '1' },
      cache: 'no-store',
      credentials: 'same-origin',
    });

    await response.text();
  } catch {
    /* A failed warm up only costs us the head start. */
  }
}

export default function WelcomeOverlay({
  firstName,
  mode,
}: {
  firstName: string;
  mode: 'signIn' | 'setup';
}) {
  const router = useRouter();

  const [done, setDone] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    /**
     * No mount guard here on purpose. React runs effects twice in development,
     * and a ref based guard makes the second pass skip the sequence that the
     * first pass just cancelled, which leaves the overlay spinning forever.
     * Every run is self contained and the cleanup cancels only its own work.
     */
    let cancelled = false;

    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const startedAt = Date.now();
    const holdUntil = (mark: number) => wait(mark - (Date.now() - startedAt));

    const leave = () => {
      window.location.assign('/dashboard');
    };

    const warm = warmDashboard();

    router.prefetch('/dashboard');

    // Independent safety net. If the sequence below stalls for any reason,
    // this still puts the person on the dashboard.
    timers.push(
      setTimeout(() => {
        if (!cancelled) leave();
      }, TOTAL_MS + WATCHDOG_MS)
    );

    const run = async () => {
      await holdUntil(STEP_AT_MS[0]);
      if (cancelled) return;
      setDone(1);

      // The workspace step waits on the real payload, within reason.
      await Promise.race([warm, holdUntil(WORKSPACE_DEADLINE_MS)]);
      await holdUntil(STEP_AT_MS[1]);
      if (cancelled) return;
      setDone(2);

      await holdUntil(STEP_AT_MS[2]);
      if (cancelled) return;
      setDone(3);

      await holdUntil(TOTAL_MS - EXIT_LEAD_MS);
      if (cancelled) return;
      setLeaving(true);

      await holdUntil(TOTAL_MS);
      if (cancelled) return;

      router.replace('/dashboard');
      router.refresh();

      // A soft navigation unmounts this component, which clears the timer
      // below. If it is still running, the router did not move.
      timers.push(
        setTimeout(() => {
          if (!cancelled) leave();
        }, FALLBACK_MS)
      );
    };

    void run();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [router]);

  const greeting =
    mode === 'setup'
      ? firstName
        ? `You are all set, ${firstName}`
        : 'Your account is ready'
      : firstName
        ? `Welcome back, ${firstName}`
        : 'Welcome back';

  const [lead, name] = firstName
    ? [
        mode === 'setup' ? 'You are all set,' : 'Welcome back,',
        firstName,
      ]
    : [greeting, ''];

  return (
    <div
      role="status"
      aria-live="polite"
      className="overlay fixed inset-0 z-[80] overflow-hidden bg-[#FBFBFD] px-6"
    >
      <div className={`layer ${leaving ? 'is-clearing' : ''}`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-44 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[#D4AF37]/25 blur-[120px]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 left-1/4 h-[460px] w-[460px] rounded-full bg-[#14B8A6]/20 blur-[120px]"
        />

        <AuthBackdrop />

        <div className="relative flex flex-col items-center text-center">
        <span className="mark">
          <Image
            src="/images/syntra-logo.png"
            alt="Syntra Grid"
            width={320}
            height={320}
            priority
            className="h-28 w-auto object-contain sm:h-32"
          />
        </span>

        <p className="lead mt-8 text-sm font-semibold tracking-[0.02em] text-[#5A6173]">
          {lead}
        </p>

        {name ? (
          <span className="name-mask mt-1 block overflow-hidden">
            <span className="name block text-[40px] font-bold leading-[1.1] tracking-tight text-[#0B1020] sm:text-[52px]">
              {name}
            </span>
          </span>
        ) : null}

        <ul className="steps mt-10 flex flex-col gap-2.5 text-left">
          {STEPS.map((label, index) => {
            const complete = done > index;
            const current = done === index;

            return (
              <li
                key={label}
                className={`step flex items-center gap-2.5 text-sm transition-colors duration-300 ${
                  complete
                    ? 'text-[#0B1020]'
                    : current
                      ? 'text-[#5A6173]'
                      : 'text-[#5A6173]/45'
                }`}
                style={{ animationDelay: `${180 + index * 70}ms` }}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${
                    complete
                      ? 'border-[#14B8A6]/40 bg-[#14B8A6]/15 text-[#0F766E]'
                      : 'border-[#0B1020]/12 text-[#5A6173]'
                  }`}
                >
                  {complete ? (
                    <Check size={12} strokeWidth={3} />
                  ) : current ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : null}
                </span>

                {label}
              </li>
            );
          })}
        </ul>

          <div className="track mt-9 h-1 w-56 overflow-hidden rounded-full bg-[#0B1020]/[0.07]">
            <span className="bar block h-full w-full rounded-full" />
          </div>
        </div>
      </div>

      <style jsx>{`
        .overlay {
          animation: overlay-in 0.3s ease-out both;
        }

        .layer {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        /* The content lifts away and the field stays, so the dashboard has
           somewhere to arrive. */
        .layer.is-clearing {
          animation: layer-out ${EXIT_LEAD_MS}ms cubic-bezier(0.4, 0, 0.9, 1)
            both;
        }

        /* Everything below lands inside the same half second, so the screen
           arrives as one movement rather than a queue of reveals. */
        .mark {
          position: relative;
          display: inline-flex;
          animation: mark-in 0.65s cubic-bezier(0.22, 1, 0.36, 1) both,
            mark-float 6s ease-in-out 0.65s infinite;
        }

        .mark::before {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          height: 190%;
          width: 190%;
          transform: translate(-50%, -50%);
          border-radius: 9999px;
          background: radial-gradient(
            circle,
            rgba(212, 175, 55, 0.32) 0%,
            rgba(20, 184, 166, 0.15) 42%,
            transparent 70%
          );
          animation: halo-bloom 1s cubic-bezier(0.22, 1, 0.36, 1) both,
            halo-pulse 3.6s ease-in-out 1s infinite;
        }

        .mark :global(img) {
          position: relative;
          z-index: 1;
        }

        .lead {
          animation: slide-left 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.06s both;
        }

        .name {
          animation: slide-up 0.62s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
        }

        .name-mask {
          padding-bottom: 0.12em;
        }

        .step {
          animation: fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .track {
          animation: fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both;
        }

        .bar {
          background: ${GOLD};
          transform-origin: left;
          animation: bar-fill ${TOTAL_MS}ms cubic-bezier(0.32, 0, 0.2, 1) both;
        }

        @keyframes overlay-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes layer-out {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(-10px) scale(0.99);
          }
        }

        @keyframes mark-in {
          from {
            opacity: 0;
            transform: scale(0.84);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes mark-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-7px);
          }
        }

        @keyframes halo-bloom {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.55);
          }
          60% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
          }
          100% {
            opacity: 0.85;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes halo-pulse {
          0%,
          100% {
            opacity: 0.7;
            transform: translate(-50%, -50%) scale(0.95);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.06);
          }
        }

        @keyframes slide-left {
          from {
            opacity: 0;
            transform: translateX(-16px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(110%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bar-fill {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .overlay,
          .layer.is-clearing,
          .mark,
          .mark::before,
          .lead,
          .name,
          .step,
          .track {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}