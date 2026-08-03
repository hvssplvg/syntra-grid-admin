'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import Header from '../layout/Header';
import Sidebar from '../layout/Sidebar';
import { authClient } from '@/lib/auth/client';

type DashboardShellProps = {
  children: ReactNode;
  admin: {
    name: string;
    email: string;
    role: string;
  };
};

export default function DashboardShell({
  children,
  admin,
}: DashboardShellProps) {
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;

    try {
      setSigningOut(true);
      await authClient.signOut();
      router.replace('/login');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F8FD]">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        onCloseMobile={() => setMobileOpen(false)}
        onSignOut={handleSignOut}
      />

      <Header
        adminName={admin.name}
        adminEmail={admin.email}
        adminRole={admin.role}
        collapsed={collapsed}
        onOpenMobile={() => setMobileOpen(true)}
        onSignOut={handleSignOut}
      />

      <main
        className={`min-h-screen pt-20 transition-all duration-300 ${
          collapsed ? 'lg:pl-[88px]' : 'lg:pl-[270px]'
        }`}
      >
        <div className="mx-auto w-full max-w-[1600px] p-5 sm:p-7 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}