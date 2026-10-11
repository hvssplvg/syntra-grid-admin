'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';

import { claimInviteAction, type ClaimActionState } from './actions';

const inputBase =
  'h-12 w-full rounded-xl border border-[#0B1020]/10 bg-[#F7F8FB] text-sm text-[#0B1020] outline-none transition placeholder:text-[#5A6173]/70 hover:border-[#D4AF37]/45 focus-visible:border-[#D4AF37]/60 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-[#D4AF37]/15 read-only:border-[#0B1020]/[0.06] read-only:bg-[#F0F1F5] read-only:text-[#5A6173]';

const initialState: ClaimActionState = {};

export default function ClaimForm({
  token,
  email,
  name,
}: {
  token: string;
  email: string;
  name: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const boundAction = claimInviteAction.bind(null, token);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  if (state.success) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-[#0B1020]/10 bg-white p-8 text-center shadow-[0_24px_60px_-20px_rgba(11,16,32,0.25)]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#14B8A6]/15 text-[#0E7C6B]">
          <ShieldCheck size={22} />
        </span>

        <h1 className="mt-4 text-lg font-semibold text-[#0B1020]">
          Check your email
        </h1>

        <p className="mt-2 text-sm leading-6 text-[#5A6173]">
          We&apos;ve sent a verification link to <strong>{state.email}</strong>.
          Click it, then sign in, to activate your dashboard access.
        </p>

        <a
          href="/login"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#0B1020] text-sm font-semibold text-white transition hover:opacity-90"
        >
          Go to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-[#0B1020]/10 bg-white p-8 shadow-[0_24px_60px_-20px_rgba(11,16,32,0.25)]">
      <h1 className="text-lg font-semibold text-[#0B1020]">
        {name ? `Welcome, ${name}` : 'Set up your access'}
      </h1>
      <p className="mt-1 text-sm text-[#5A6173]">
        Choose a password to activate your Syntra Grid dashboard access.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <label className="block text-xs font-medium text-[#5A6173]">
          Email
          <div className="relative mt-1.5">
            <Mail
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A6173]/70"
            />
            <input
              type="email"
              value={email}
              readOnly
              className={`${inputBase} pl-10`}
            />
          </div>
        </label>

        <label className="block text-xs font-medium text-[#5A6173]">
          Password
          <div className="relative mt-1.5">
            <KeyRound
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A6173]/70"
            />
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              minLength={12}
              required
              autoComplete="new-password"
              placeholder="At least 12 characters"
              className={`${inputBase} pl-10 pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5A6173]/70 hover:text-[#0B1020]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="block text-xs font-medium text-[#5A6173]">
          Confirm password
          <div className="relative mt-1.5">
            <KeyRound
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A6173]/70"
            />
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              minLength={12}
              required
              autoComplete="new-password"
              className={`${inputBase} pl-10`}
            />
          </div>
        </label>

        {state.error ? (
          <p className="text-sm text-red-600">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B1020] text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Setting up
            </>
          ) : (
            'Activate access'
          )}
        </button>
      </form>
    </div>
  );
}
