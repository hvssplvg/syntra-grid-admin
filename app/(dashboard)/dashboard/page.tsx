import { redirect } from 'next/navigation';

import AdminHome from '@/app/components/admin/AdminHome';
import { getCurrentIdentity } from '@/lib/auth/current-admin';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let identity;

  try {
    identity = await getCurrentIdentity();
  } catch {
    redirect('/login');
  }

  const { admin, employee, isFullAccess, permissions } = identity;

  const fullName =
    [admin.firstName, admin.lastName].filter(Boolean).join(' ') ||
    admin.email;

  const flatPermissions = Array.from(permissions.entries()).flatMap(
    ([module, actions]) =>
      Array.from(actions.entries()).map(([action, scope]) => ({
        module,
        action,
        scope,
      })),
  );

  return (
    <AdminHome
      admin={{
        id: admin.id,
        fullName,
        email: admin.email,
        role: admin.role,
      }}
      identity={{
        isFullAccess,
        employeeId: employee?.id ?? null,
        departmentId: employee?.departmentId ?? null,
        permissions: flatPermissions,
      }}
    />
  );
}
