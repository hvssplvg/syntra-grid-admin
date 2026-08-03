'use client';

// app/(dashboard)/finance/statements/StatementControls.tsx
//
// Filters write to the URL rather than local state, so the server component
// re-renders with the right data and any view can be bookmarked.

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';

export function StatementControls({
  month,
  direction,
  query,
  earliest,
  latest,
}: {
  month: string;
  direction: string;
  query: string;
  earliest: string | null;
  latest: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(query);

  // Keep the box in step when the URL changes from elsewhere (back button).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setText(query), [query]);

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || value === 'all') next.delete(key);
      else next.set(key, value);
    }
 
    startTransition(() => router.push(`?${next.toString()}`, { scroll: false }));
  }

  const months = buildMonthOptions(earliest, latest, month);
  const position = months.findIndex((option) => option.value === month);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#0B1020]/[0.06] bg-white p-4 lg:flex-row lg:items-center">
      {/* Month stepper */}
      <div className="flex items-center gap-1">
        <StepButton
          direction="back"
          disabled={position >= months.length - 1 || pending}
          onClick={() => apply({ month: months[position + 1]?.value ?? null })}
        />

        <select
          value={month}
          onChange={(event) => apply({ month: event.target.value })}
          className="h-10 min-w-44 rounded-xl border border-[#0B1020]/[0.08] bg-[#FAFAF9] px-3 text-sm font-bold text-[#0B1020] outline-none focus:border-[#0D9488] focus:bg-white"
        >
          {months.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <StepButton
          direction="forward"
          disabled={position <= 0 || pending}
          onClick={() => apply({ month: months[position - 1]?.value ?? null })}
        />
      </div>

      {/* Direction */}
      <div className="inline-flex rounded-xl bg-[#0B1020]/[0.04] p-1">
        {[
          ['all', 'All'],
          ['in', 'In'],
          ['out', 'Out'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => apply({ direction: value })}
            className={`h-8 rounded-lg px-3.5 text-xs font-bold transition-colors ${
              direction === value
                ? 'bg-white text-[#0B1020] shadow-sm'
                : 'text-[#5A6173] hover:text-[#0B1020]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form
        className="relative flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q: text.trim() });
        }}
      >
        <Search
          size={14}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A6173]"
        />

        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Search name, description or note"
          className="h-10 w-full rounded-xl border border-[#0B1020]/[0.08] bg-[#FAFAF9] pl-10 pr-10 text-sm text-[#0B1020] outline-none placeholder:text-[#5A6173]/60 focus:border-[#0D9488] focus:bg-white"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setText('');
              apply({ q: null });
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A6173] hover:text-[#0B1020]"
          >
            <X size={14} />
          </button>
        )}
      </form>

      {pending && <Loader2 size={15} className="animate-spin text-[#5A6173]" />}
    </div>
  );
}

function StepButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'back' | 'forward';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'back' ? 'Previous month' : 'Next month'}
      className="flex h-10 w-9 items-center justify-center rounded-xl border border-[#0B1020]/[0.08] bg-white text-[#5A6173] transition-colors hover:text-[#0B1020] disabled:opacity-35"
    >
      {direction === 'back' ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
    </button>
  );
}

/** Newest first, covering every month that has data. */
function buildMonthOptions(
  earliest: string | null,
  latest: string | null,
  current: string,
) {
  const end = latest ? new Date(latest) : new Date();
  const start = earliest ? new Date(earliest) : end;

  const options: { value: string; label: string }[] = [];
  const cursor = new Date(end.getFullYear(), end.getMonth(), 1);
  const floor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor >= floor && options.length < 60) {
    options.push({
      value: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('en-GB', {
        month: 'long',
        year: 'numeric',
      }).format(cursor),
    });

    cursor.setMonth(cursor.getMonth() - 1);
  }

  // The current month may sit outside the data range — keep it selectable.
  if (!options.some((option) => option.value === current)) {
    const [year, month] = current.split('-').map(Number);
    const date = new Date(year, month - 1, 1);

    options.unshift({
      value: current,
      label: new Intl.DateTimeFormat('en-GB', {
        month: 'long',
        year: 'numeric',
      }).format(date),
    });
  }

  return options;
}