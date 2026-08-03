'use client';

// app/(dashboard)/team/InviteAdmin.tsx

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  KeyRound,
  Loader2,
  UserPlus,
} from 'lucide-react';

import { inviteAdmin } from './actions';
import { EMPTY_STATE, type NewCredentials } from './types';

const GOLD = 'linear-gradient(135deg,#F3DFA2,#D4AF37 60%,#C79A2A)';

const ROLES: [string, string][] = [
  ['VIEWER', 'Viewer — read only'],
  ['SUPPORT', 'Support — tickets and clients'],
  ['DEVELOPER', 'Developer — projects and integrations'],
  ['FINANCE', 'Finance — banking and invoices'],
  ['ADMIN', 'Admin — everything except owners'],
  ['OWNER', 'Owner — everything'],
];

export function InviteAdmin({ isOwner }: { isOwner: boolean }) {
  const [state, action] = useActionState(inviteAdmin, EMPTY_STATE);
  const [open, setOpen] = useState(false);

  const roles = isOwner ? ROLES : ROLES.filter(([value]) => value !== 'OWNER');

  return (
    <section className="rounded-3xl border border-[#D4AF37]/15 bg-white shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
      >
        <div>
          <h2 className="text-base font-bold text-[#0B1020]">Add someone</h2>
          <p className="mt-1 text-sm text-[#5A6173]">
            Creates their login and gives you a temporary password to pass on.
          </p>
        </div>

        <ChevronDown
          size={17}
          className={`shrink-0 text-[#5A6173] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-[#0B1020]/[0.06] p-5 sm:p-6">
          {state.sessionReplaced && (
            <p className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>
                Creating the account may have replaced your own session. Copy the
                password below first, then sign out and back in.
              </span>
            </p>
          )}

          {state.credentials ? (
            <Credentials credentials={state.credentials} />
          ) : (
            <form action={action}>
              {state.message && !state.ok && (
                <p className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  {state.message}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" name="firstName" placeholder="Aisha" />
                <Field label="Last name" name="lastName" placeholder="Bello" />

                <div className="sm:col-span-2">
                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    required
                    error={state.errors.email}
                    placeholder="name@syntragrid.com"
                    hint="This becomes their username."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="field-role"
                    className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6173]"
                  >
                    Role
                  </label>

                  <select
                    id="field-role"
                    name="role"
                    defaultValue="VIEWER"
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#0B1020]/[0.08] bg-[#FAFAF9] px-3.5 text-sm font-semibold text-[#0B1020] outline-none focus:border-[#0D9488] focus:bg-white"
                  >
                    {roles.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>

                  {state.errors.role ? (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">
                      {state.errors.role}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-[#5A6173]">
                      Can be changed later. Start narrow.
                    </p>
                  )}
                </div>
              </div>

              <Submit />
            </form>
          )}
        </div>
      )}
    </section>
  );
}

/** Shown once. Nothing stores the password, so this is the only chance. */
function Credentials({ credentials }: { credentials: NewCredentials }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
    } catch {
      /* clipboard blocked — the values are on screen to copy by hand */
    }
  }

  const message = [
    `Hi ${credentials.name.split(' ')[0]},`,
    '',
    'Your Syntra Grid account is ready.',
    '',
    `Email: ${credentials.email}`,
    `Temporary password: ${credentials.password}`,
    '',
    'Please change your password after signing in for the first time.',
  ].join('\n');

  return (
    <div className="rounded-2xl border border-[#14B8A6]/25 bg-[#14B8A6]/[0.05] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#0D9488]">
          <KeyRound size={17} />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-bold text-[#0D9488]">
            {credentials.name} can sign in now
          </p>
          <p className="mt-0.5 text-xs leading-5 text-[#5A6173]">
            This password is shown once and stored nowhere. Copy it before you leave
            this page.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-2.5">
        <Credential
          label="Email"
          value={credentials.email}
          copied={copied === 'email'}
          onCopy={() => void copy('email', credentials.email)}
        />
        <Credential
          label="Temporary password"
          value={credentials.password}
          copied={copied === 'password'}
          onCopy={() => void copy('password', credentials.password)}
        />
      </dl>

      <button
        type="button"
        onClick={() => void copy('message', message)}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B1020] px-4 text-xs font-bold text-white transition hover:bg-[#151D34]"
      >
        {copied === 'message' ? <Check size={14} /> : <Copy size={14} />}
        {copied === 'message' ? 'Copied' : 'Copy message to send'}
      </button>
    </div>
  );
}

function Credential({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-3.5">
      <div className="min-w-0">
        <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6173]">
          {label}
        </dt>
        <dd className="mt-1 truncate font-mono text-sm font-bold text-[#0B1020]">
          {value}
        </dd>
      </div>

      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label}`}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
          copied
            ? 'bg-[#14B8A6]/12 text-[#0D9488]'
            : 'bg-[#FAFAF9] text-[#5A6173] ring-1 ring-[#0B1020]/[0.06] hover:text-[#0B1020]'
        }`}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();

  return (
    <div className="mt-5 flex justify-end border-t border-[#0B1020]/[0.06] pt-5">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold text-[#241A05] transition hover:brightness-[1.04] disabled:opacity-60"
        style={{ background: GOLD, boxShadow: '0 10px 26px rgba(212,175,55,0.3)' }}
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
        {pending ? 'Creating account' : 'Create account'}
      </button>
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  error,
  hint,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  const id = `field-${name}`;

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6173]"
      >
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={`mt-1.5 h-11 w-full rounded-xl border bg-[#FAFAF9] px-3.5 text-sm text-[#0B1020] outline-none transition-colors placeholder:text-[#5A6173]/60 focus:bg-white ${
          error
            ? 'border-red-300 focus:border-red-500'
            : 'border-[#0B1020]/[0.08] focus:border-[#0D9488]'
        }`}
      />

      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-[#5A6173]">{hint}</p>
      ) : null}
    </div>
  );
}