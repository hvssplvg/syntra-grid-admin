import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { data: session } = await auth.getSession();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const admin = await prisma.adminUser.findUnique({
    where: {
      authUserId: session.user.id,
    },
    select: {
      active: true,
    },
  });

  if (!admin?.active) {
    redirect('/login');
  }

  return <>{children}</>;
}