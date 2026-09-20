import { redirect } from 'next/navigation';

import AdminHome from '@/app/components/admin/AdminHome';
import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { data: session } = await auth.getSession();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const admin = await prisma.adminUser.findUnique({
    where: {
      authUserId: session.user.id,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      active: true,
    },
  });

  if (!admin?.active) {
    redirect('/login');
  }

  const fullName =
    [admin.firstName, admin.lastName]
      .filter(Boolean)
      .join(' ') ||
    session.user.name ||
    admin.email;

  return (
    <AdminHome
      admin={{
        id: admin.id,
        fullName,
        email: admin.email,
        role: admin.role,
      }}
    />
  );
}