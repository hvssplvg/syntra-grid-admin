import { redirect } from 'next/navigation';

import DashboardShell from '../constants/layout/DashboardShell';
import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
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
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      active: true,
    },
  });

  if (!admin || !admin.active) {
    redirect('/login');
  }

  const name =
    [admin.firstName, admin.lastName].filter(Boolean).join(' ') ||
    session.user.name ||
    admin.email;

  return (
    <DashboardShell
      admin={{
        name,
        email: admin.email,
        role: admin.role,
      }}
    >
      {children}
    </DashboardShell>
  );
}