'use client';

import {
  Clock3,
} from 'lucide-react';

import type {
  AdminSection,
  AdminTabDefinition,
} from './adminNav';

/* ============================================================================
   TYPES
============================================================================ */

type AdminPageIdentityProps = {
  section: AdminSection;
  tab: AdminTabDefinition;
  compact?: boolean;
};

/* ============================================================================
   COMPONENT
============================================================================ */

export default function AdminPageIdentity({
  section,
  tab,
  compact = false,
}: AdminPageIdentityProps) {
  const TabIcon = tab.icon;

  return (
    <section
      className="
        min-w-0
        border-b
        border-[var(--line)]
        pb-5
        sm:pb-6
      "
      aria-labelledby="admin-page-title"
    >
      <div
        className="
          flex
          min-w-0
          items-start
          justify-between
          gap-4
        "
      >
        {/* ================================================================
            PAGE
        ================================================================ */}

        <div
          className="
            flex
            min-w-0
            items-start
            gap-3
            sm:gap-3.5
          "
        >
          {/* --------------------------------------------------------------
              ICON
          -------------------------------------------------------------- */}

          <div
            className={`
              flex
              shrink-0
              items-center
              justify-center

              border
              border-[var(--line)]

              bg-[var(--surface)]

              text-[var(--text-muted)]

              shadow-sm

              ${
                compact
                  ? 'h-10 w-10 rounded-[13px]'
                  : 'h-11 w-11 rounded-[14px]'
              }
            `}
          >
            <TabIcon
              size={
                compact ? 17 : 18
              }
              strokeWidth={1.8}
            />
          </div>

          {/* --------------------------------------------------------------
              TEXT
          -------------------------------------------------------------- */}

          <div className="min-w-0">
            <div
              className="
                flex
                min-w-0
                flex-wrap
                items-center
                gap-2
              "
            >
              <h1
                id="admin-page-title"
                className={`
                  min-w-0

                  font-semibold
                  tracking-[-0.035em]

                  text-[var(--text)]

                  ${
                    compact
                      ? 'text-[21px]'
                      : 'text-[24px] sm:text-[25px]'
                  }
                `}
              >
                {tab.title}
              </h1>

              <ModuleStatus
                status={tab.status}
              />
            </div>

            <p
              className={`
                max-w-[760px]

                text-[var(--text-muted)]

                ${
                  compact
                    ? 'mt-1 text-[11px] leading-5'
                    : 'mt-1.5 text-[12px] leading-5'
                }
              `}
            >
              {tab.description}
            </p>
          </div>
        </div>

        {/* ================================================================
            WORKSPACE LABEL

            Desktop only.

            This is intentionally very subtle. It provides context without
            creating another large pill/badge.
        ================================================================ */}

        {!compact && (
          <div
            className="
              hidden
              shrink-0
              items-center
              gap-2
              pt-1
              lg:flex
            "
          >
            <span
              className="
                h-1.5
                w-1.5
                rounded-full
                bg-[var(--accent)]
              "
            />

            <span
              className="
                text-[9px]
                font-semibold
                uppercase
                tracking-[0.12em]
                text-[var(--text-subtle)]
              "
            >
              {section.label}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ============================================================================
   MODULE STATUS
============================================================================ */

function ModuleStatus({
  status = 'planned',
}: {
  status?: 'live' | 'planned';
}) {
  if (status === 'live') {
    return (
      <span
        className="
          inline-flex
          shrink-0
          items-center
          gap-1.5

          rounded-full

          border
          border-[var(--success)]/15

          bg-[var(--success-soft)]

          px-2
          py-1

          text-[7px]
          font-bold
          uppercase
          tracking-[0.08em]

          text-[var(--success)]
        "
      >
        <span
          className="
            h-1.5
            w-1.5
            rounded-full
            bg-[var(--success)]
          "
        />

        Live
      </span>
    );
  }

  return (
    <span
      className="
        inline-flex
        shrink-0
        items-center
        gap-1.5

        rounded-full

        border
        border-[var(--line)]

        bg-[var(--surface-muted)]

        px-2
        py-1

        text-[7px]
        font-bold
        uppercase
        tracking-[0.08em]

        text-[var(--text-subtle)]
      "
    >
      <Clock3
        size={8}
        strokeWidth={2}
      />

      Soon
    </span>
  );
}