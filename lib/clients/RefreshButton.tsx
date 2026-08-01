
'use client';

// components/clients/RefreshButton.tsx
//
// The old page used <Link href="/clients/esteem-learning-centre"> as a
// "Refresh" control. Next.js treats that as a no-op navigation and serves the
// cached RSC payload, so the numbers never changed. router.refresh() re-runs
// the server component and re-fetches Firestore.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D4AF37]/15 bg-white px-4 text-sm font-bold text-[#5A6173] transition-all duration-200 hover:border-[#D4AF37]/25 hover:bg-[#0B1020]/[0.03] hover:text-[#0B1020] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488] disabled:opacity-60"
    >
      <RefreshCw
        size={15}
        className={pending ? 'animate-spin' : undefined}
        aria-hidden
      />
      {pending ? 'Refreshing' : 'Refresh'}
    </button>
  );
}