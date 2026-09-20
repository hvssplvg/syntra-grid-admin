'use client';

import {
  Building2,
  Plus,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';

export default function ClientsTab() {
  return (
    <div className="space-y-5">
      {/* ================================================================
          TOP ACTION BAR
      ================================================================ */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[320px]">
          <Search
            size={14}
            strokeWidth={1.8}
            className="
              pointer-events-none
              absolute
              left-3.5
              top-1/2
              -translate-y-1/2
              text-[var(--text-subtle)]
            "
          />

          <input
            type="text"
            placeholder="Search clients..."
            disabled
            className="
              h-10
              w-full
              rounded-xl
              border
              border-[var(--line)]
              bg-[var(--surface)]
              pl-10
              pr-4
              text-[11px]
              text-[var(--text)]
              outline-none
              placeholder:text-[var(--text-subtle)]
              disabled:cursor-default
              disabled:opacity-70
            "
          />
        </div>

        <button
          type="button"
          disabled
          className="
            inline-flex
            h-10
            shrink-0
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-[var(--primary)]
            px-4
            text-[10px]
            font-semibold
            text-[var(--primary-foreground)]
            opacity-60
          "
        >
          <Plus
            size={14}
            strokeWidth={2}
          />

          Add client
        </button>
      </div>

      {/* ================================================================
          PLACEHOLDER
      ================================================================ */}

      <div
        className="
          relative
          overflow-hidden
          rounded-[24px]
          border
          border-[var(--line)]
          bg-[var(--surface)]
          shadow-[var(--shadow-soft)]
        "
      >
        {/* subtle background */}

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            -right-20
            -top-24
            h-64
            w-64
            rounded-full
            bg-[var(--accent-tint)]
            blur-3xl
          "
        />

        <div
          className="
            relative
            flex
            min-h-[430px]
            flex-col
            items-center
            justify-center
            px-6
            py-16
            text-center
          "
        >
          {/* icon */}

          <div
            className="
              relative
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-[20px]
              border
              border-[var(--line)]
              bg-[var(--surface-muted)]
              text-[var(--text)]
              shadow-sm
            "
          >
            <Building2
              size={25}
              strokeWidth={1.65}
            />

            <span
              className="
                absolute
                -right-1
                -top-1
                flex
                h-6
                w-6
                items-center
                justify-center
                rounded-full
                border-[3px]
                border-[var(--surface)]
                bg-[var(--accent)]
                text-white
              "
            >
              <Sparkles
                size={10}
                strokeWidth={2.2}
              />
            </span>
          </div>

          {/* copy */}

          <h2
            className="
              mt-5
              text-[17px]
              font-semibold
              tracking-[-0.025em]
              text-[var(--text)]
            "
          >
            Client workspace is being connected
          </h2>

          <p
            className="
              mt-2
              max-w-[460px]
              text-[11px]
              leading-5
              text-[var(--text-muted)]
            "
          >
            The new Syntra Grid client workspace is ready. We&apos;re
            reconnecting the existing client data and integrations to the new
            admin architecture.
          </p>

          {/* status */}

          <div
            className="
              mt-6
              inline-flex
              items-center
              gap-2
              rounded-full
              border
              border-[var(--line)]
              bg-[var(--surface-muted)]
              px-3
              py-2
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
                text-[8px]
                font-bold
                uppercase
                tracking-[0.1em]
                text-[var(--text-muted)]
              "
            >
              Integration in progress
            </span>
          </div>

          {/* future feature preview */}

          <div
            className="
              mt-8
              grid
              w-full
              max-w-[580px]
              grid-cols-1
              gap-2
              sm:grid-cols-3
            "
          >
            <PreviewCard
              icon={Building2}
              label="Client accounts"
            />

            <PreviewCard
              icon={Users}
              label="Contacts"
            />

            <PreviewCard
              icon={Sparkles}
              label="Client 360"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   PREVIEW CARD
============================================================================ */

function PreviewCard({
  icon: Icon,
  label,
}: {
  icon: typeof Building2;
  label: string;
}) {
  return (
    <div
      className="
        flex
        items-center
        gap-3
        rounded-2xl
        border
        border-[var(--line)]
        bg-[var(--surface-muted)]
        px-4
        py-3
        text-left
      "
    >
      <span
        className="
          flex
          h-8
          w-8
          shrink-0
          items-center
          justify-center
          rounded-xl
          bg-[var(--surface)]
          text-[var(--text-muted)]
          shadow-sm
        "
      >
        <Icon
          size={13}
          strokeWidth={1.8}
        />
      </span>

      <span
        className="
          text-[9px]
          font-semibold
          text-[var(--text-muted)]
        "
      >
        {label}
      </span>
    </div>
  );
}