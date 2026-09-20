'use client';

import Image from 'next/image';
import { useActionState, useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react';

import {
  setupOwnerAction,
  signInAction,
  type AuthActionState,
} from './actions';

const initialState: AuthActionState = {};

const inputBase =
  'h-12 w-full rounded-xl border border-white/10 bg-[#0E1428] text-sm text-[#F5F7FF] outline-none transition placeholder:text-[#8A93B2]/60 hover:border-white/20 focus-visible:border-[#14B8A6]/60 focus-visible:ring-4 focus-visible:ring-[#14B8A6]/15 read-only:border-white/5 read-only:bg-[#0B1020] read-only:text-[#8A93B2]';

export default function LoginForm({
  ownerNeedsSetup,
  ownerEmail,
}: {
  ownerNeedsSetup: boolean;
  ownerEmail: string;
}) {
  const [mode, setMode] = useState<'login' | 'setup'>(
    ownerNeedsSetup ? 'setup' : 'login'
  );

  const [showPassword, setShowPassword] = useState(false);

  const [loginState, loginAction, loginPending] = useActionState(
    signInAction,
    initialState
  );

  const [setupState, setupAction, setupPending] = useActionState(
    setupOwnerAction,
    initialState
  );

  const state = mode === 'login' ? loginState : setupState;
  const pending = mode === 'login' ? loginPending : setupPending;

  return (
    <div
      className="w-full max-w-[460px] overflow-hidden rounded-3xl border border-white/10 bg-[#0B1020] shadow-2xl shadow-black/40"
      style={{ fontFamily: 'var(--font-space-grotesk), ui-sans-serif, system-ui' }}
    >
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

      <div className="px-7 py-9 sm:px-9">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#0E1428]">
              <Image
                src="/images/syntra-logo.png"
                alt="Syntra Grid"
                width={32}
                height={32}
                priority
                className="h-8 w-8 object-contain"
              />
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#14B8A6]/25 bg-[#14B8A6]/10 px-3 py-1 text-[11px] font-medium text-[#5EEAD4]">
              {mode === 'setup' ? (
                <ShieldCheck size={13} />
              ) : (
                <LockKeyhole size={13} />
              )}
              {mode === 'setup' ? 'One time setup' : 'Secure area'}
            </span>
          </div>

          <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-tight text-[#F5F7FF]">
            {mode === 'setup' ? 'Create owner account' : 'Welcome back'}
          </h1>

          <p className="mt-2 max-w-[38ch] text-sm leading-6 text-[#8A93B2]">
            {mode === 'setup'
              ? 'Set up the CentraGrid owner account. You only do this once.'
              : 'Sign in to manage clients, projects, deployments and system health.'}
          </p>
        </div>

        {state.error && (
          <div className="mb-5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
            {state.error}
          </div>
        )}

        <form
          action={mode === 'login' ? loginAction : setupAction}
          className="space-y-4"
        >
          {mode === 'setup' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name">
                <div className="relative">
                  <User
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A93B2]"
                  />

                  <input
                    name="firstName"
                    defaultValue="Hassan"
                    required
                    autoComplete="given-name"
                    className={`${inputBase} pl-11 pr-4`}
                  />
                </div>
              </Field>

              <Field label="Last name">
                <input
                  name="lastName"
                  autoComplete="family-name"
                  className={`${inputBase} px-4`}
                />
              </Field>
            </div>
          )}

          <Field label="Email address">
            <div className="relative">
              <Mail
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A93B2]"
              />

              <input
                name="email"
                type="email"
                defaultValue={ownerEmail}
                readOnly={mode === 'setup'}
                required
                autoComplete="email"
                placeholder="admin@centragrid.com"
                className={`${inputBase} pl-11 pr-4`}
              />
            </div>
          </Field>

          <Field label="Password">
            <div className="relative">
              <KeyRound
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A93B2]"
              />

              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={mode === 'setup' ? 12 : undefined}
                autoComplete={
                  mode === 'setup' ? 'new-password' : 'current-password'
                }
                placeholder={
                  mode === 'setup'
                    ? 'Create a secure password'
                    : 'Enter your password'
                }
                className={`${inputBase} pl-11 pr-12`}
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#8A93B2] outline-none transition hover:bg-white/5 hover:text-[#F5F7FF] focus-visible:ring-2 focus-visible:ring-[#14B8A6]/50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          {mode === 'setup' && (
            <>
              <Field label="Confirm password">
                <input
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  placeholder="Enter the password again"
                  className={`${inputBase} px-4`}
                />
              </Field>

              <Field label="Owner setup code">
                <input
                  name="setupSecret"
                  type="password"
                  required
                  autoComplete="off"
                  placeholder="Enter the setup code from .env.local"
                  className={`${inputBase} px-4`}
                />
              </Field>
            </>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-5 text-sm font-bold text-[#0B1020] outline-none shadow-lg shadow-[#D4AF37]/15 transition hover:bg-[#E2C257] focus-visible:ring-4 focus-visible:ring-[#D4AF37]/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {mode === 'setup' ? 'Creating account' : 'Signing in'}
              </>
            ) : (
              <>
                {mode === 'setup' ? 'Create owner account' : 'Sign in'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {!ownerNeedsSetup && mode === 'setup' && (
          <button
            type="button"
            onClick={() => setMode('login')}
            className="mt-5 w-full rounded-lg py-2 text-center text-sm font-semibold text-[#14B8A6] outline-none transition hover:text-[#5EEAD4] focus-visible:ring-2 focus-visible:ring-[#14B8A6]/50"
          >
            Return to sign in
          </button>
        )}

        {ownerNeedsSetup && (
          <div className="mt-6 border-t border-white/[0.07] pt-5">
            <button
              type="button"
              onClick={() =>
                setMode((current) => (current === 'setup' ? 'login' : 'setup'))
              }
              className="w-full rounded-lg py-2 text-center text-sm font-semibold text-[#14B8A6] outline-none transition hover:text-[#5EEAD4] focus-visible:ring-2 focus-visible:ring-[#14B8A6]/50"
            >
              {mode === 'setup'
                ? 'Account already configured? Sign in'
                : 'Complete initial owner setup'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-medium text-[#8A93B2]">
        {label}
      </span>

      {children}
    </label>
  );
}