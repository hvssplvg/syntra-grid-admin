import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { getCurrentAdmin } from '@/lib/auth/current-admin';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // getCurrentAdmin() is React-cache()'d: this call and any later one made
  // by a page/component further down the tree during the same request
  // (e.g. dashboard/page.tsx's getCurrentIdentity()) share one session
  // lookup and one AdminUser query instead of each repeating both. Reusing
  // it here (rather than this layout's own separate session+query check)
  // also means a freshly-invited admin's first sign-in gets the same
  // invite-claiming behaviour this layout used to skip.
  try {
    await getCurrentAdmin();
  } catch {
    redirect('/login');
  }

  return <>{children}</>;
}