// app/clients/new/page.tsx

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { NewClientForm } from './NewClientForm';

export const metadata = { title: 'Add client · Syntra Grid' };

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-[#5A6173]">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 font-semibold transition-colors hover:text-[#0D9488]"
        >
          <ArrowLeft size={14} aria-hidden />
          Clients
        </Link>
        <span className="text-[#5A6173]/35">/</span>
        <span className="font-medium text-[#0B1020]">Add client</span>
      </nav>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[#0B1020]">Add a client</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-[#5A6173]">
          Only the name and what you built are required — everything else can be filled
          in later from the client workspace.
        </p>
      </header>

      <NewClientForm />
    </div>
  );
}