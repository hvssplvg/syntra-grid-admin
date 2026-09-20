'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Plus,
  ReceiptText,
  Sparkles,
  TrendingUp,
  WalletCards,
} from 'lucide-react';

export default function FinanceTab() {
  return (
    <div className="space-y-5">
      {/* ================================================================
          SUMMARY PLACEHOLDERS
      ================================================================ */}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Landmark}
          label="Account balance"
          value="—"
          hint="Banking connection"
        />

        <MetricCard
          icon={TrendingUp}
          label="Revenue"
          value="—"
          hint="Financial reporting"
        />

        <MetricCard
          icon={ReceiptText}
          label="Outstanding"
          value="—"
          hint="Invoices & receivables"
        />

        <MetricCard
          icon={WalletCards}
          label="Expenses"
          value="—"
          hint="Company expenditure"
        />
      </div>

      {/* ================================================================
          MAIN PLACEHOLDER
      ================================================================ */}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        <section
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
          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              -right-20
              -top-20
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
              py-14
              text-center
            "
          >
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
              <CircleDollarSign
                size={26}
                strokeWidth={1.6}
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

            <h2
              className="
                mt-5
                text-[17px]
                font-semibold
                tracking-[-0.025em]
                text-[var(--text)]
              "
            >
              Finance workspace is being connected
            </h2>

            <p
              className="
                mt-2
                max-w-[500px]
                text-[11px]
                leading-5
                text-[var(--text-muted)]
              "
            >
              The new finance interface is ready. Your existing banking,
              transaction and financial data will be reconnected through the
              server layer without exposing Prisma or database access to the
              browser.
            </p>

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
                Server integration pending
              </span>
            </div>

            <div
              className="
                mt-8
                grid
                w-full
                max-w-[620px]
                grid-cols-1
                gap-2
                sm:grid-cols-3
              "
            >
              <FeaturePreview
                icon={Landmark}
                label="Banking"
              />

              <FeaturePreview
                icon={CreditCard}
                label="Transactions"
              />

              <FeaturePreview
                icon={ReceiptText}
                label="Statements"
              />
            </div>
          </div>
        </section>

        {/* ================================================================
            QUICK ACTIONS
        ================================================================ */}

        <section
          className="
            rounded-[24px]
            border
            border-[var(--line)]
            bg-[var(--surface)]
            p-4
            shadow-[var(--shadow-soft)]
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className="
                  text-[12px]
                  font-semibold
                  text-[var(--text)]
                "
              >
                Quick actions
              </p>

              <p
                className="
                  mt-1
                  text-[9px]
                  text-[var(--text-muted)]
                "
              >
                Available when finance is connected
              </p>
            </div>

            <Banknote
              size={17}
              strokeWidth={1.7}
              className="text-[var(--text-subtle)]"
            />
          </div>

          <div className="mt-4 space-y-2">
            <QuickAction
              icon={Plus}
              title="Record transaction"
              description="Add an income or expense"
            />

            <QuickAction
              icon={ArrowDownLeft}
              title="Record income"
              description="Add incoming company funds"
            />

            <QuickAction
              icon={ArrowUpRight}
              title="Record expense"
              description="Add company expenditure"
            />

            <QuickAction
              icon={ReceiptText}
              title="View statements"
              description="Review financial statements"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ============================================================================
   METRIC CARD
============================================================================ */

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Landmark;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      className="
        rounded-[20px]
        border
        border-[var(--line)]
        bg-[var(--surface)]
        p-4
        shadow-[var(--shadow-soft)]
      "
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-xl
            bg-[var(--surface-muted)]
            text-[var(--text-muted)]
          "
        >
          <Icon
            size={15}
            strokeWidth={1.8}
          />
        </div>

        <span
          className="
            rounded-full
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
          Pending
        </span>
      </div>

      <p
        className="
          mt-4
          text-[9px]
          font-medium
          text-[var(--text-muted)]
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1
          text-[22px]
          font-semibold
          tracking-[-0.04em]
          text-[var(--text)]
        "
      >
        {value}
      </p>

      <p
        className="
          mt-1
          text-[8px]
          text-[var(--text-subtle)]
        "
      >
        {hint}
      </p>
    </div>
  );
}

/* ============================================================================
   FEATURE PREVIEW
============================================================================ */

function FeaturePreview({
  icon: Icon,
  label,
}: {
  icon: typeof Landmark;
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

/* ============================================================================
   QUICK ACTION
============================================================================ */

function QuickAction({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Plus;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      disabled
      className="
        flex
        w-full
        items-center
        gap-3
        rounded-2xl
        border
        border-transparent
        px-3
        py-3
        text-left
        opacity-65
      "
    >
      <span
        className="
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          rounded-xl
          bg-[var(--surface-muted)]
          text-[var(--text-muted)]
        "
      >
        <Icon
          size={14}
          strokeWidth={1.8}
        />
      </span>

      <span className="min-w-0">
        <span
          className="
            block
            text-[10px]
            font-semibold
            text-[var(--text)]
          "
        >
          {title}
        </span>

        <span
          className="
            mt-0.5
            block
            text-[8px]
            text-[var(--text-muted)]
          "
        >
          {description}
        </span>
      </span>
    </button>
  );
}