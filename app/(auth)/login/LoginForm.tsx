'use client';

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
    <div className="w-full max-w-[460px]">
      <div className="mb-8">
        <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F6A4B] text-white shadow-lg shadow-[#0F6A4B]/20">
          {mode === 'setup' ? (
            <ShieldCheck size={22} />
          ) : (
            <LockKeyhole size={21} />
          )}
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-[#102A22]">
          {mode === 'setup' ? 'Create owner account' : 'Welcome back'}
        </h1>

        <p className="mt-2 text-sm leading-6 text-[#5F6F68]">
          {mode === 'setup'
            ? 'Complete the one-time setup for the CentraGrid owner account.'
            : 'Sign in to manage clients, projects, deployments and system health.'}
        </p>
      </div>

      {state.error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
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
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5F6F68]/60"
                />

                <input
                  name="firstName"
                  defaultValue="Hassan"
                  required
                  autoComplete="given-name"
                  className="h-12 w-full rounded-xl border border-[#102A22]/10 bg-white pl-11 pr-4 text-sm text-[#102A22] outline-none transition focus:border-[#0F6A4B]/40 focus:ring-4 focus:ring-[#0F6A4B]/[0.07]"
                />
              </div>
            </Field>

            <Field label="Last name">
              <input
                name="lastName"
                autoComplete="family-name"
                className="h-12 w-full rounded-xl border border-[#102A22]/10 bg-white px-4 text-sm text-[#102A22] outline-none transition focus:border-[#0F6A4B]/40 focus:ring-4 focus:ring-[#0F6A4B]/[0.07]"
              />
            </Field>
          </div>
        )}

        <Field label="Email address">
          <div className="relative">
            <Mail
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5F6F68]/60"
            />

            <input
              name="email"
              type="email"
              defaultValue={ownerEmail}
              readOnly={mode === 'setup'}
              required
              autoComplete="email"
              placeholder="admin@centragrid.com"
              className="h-12 w-full rounded-xl border border-[#102A22]/10 bg-white pl-11 pr-4 text-sm text-[#102A22] outline-none transition placeholder:text-[#5F6F68]/45 read-only:bg-[#F4F8FD] focus:border-[#0F6A4B]/40 focus:ring-4 focus:ring-[#0F6A4B]/[0.07]"
            />
          </div>
        </Field>

        <Field label="Password">
          <div className="relative">
            <KeyRound
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5F6F68]/60"
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
              className="h-12 w-full rounded-xl border border-[#102A22]/10 bg-white pl-11 pr-12 text-sm text-[#102A22] outline-none transition placeholder:text-[#5F6F68]/45 focus:border-[#0F6A4B]/40 focus:ring-4 focus:ring-[#0F6A4B]/[0.07]"
            />

            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#5F6F68] transition hover:bg-[#102A22]/5"
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
                className="h-12 w-full rounded-xl border border-[#102A22]/10 bg-white px-4 text-sm text-[#102A22] outline-none transition placeholder:text-[#5F6F68]/45 focus:border-[#0F6A4B]/40 focus:ring-4 focus:ring-[#0F6A4B]/[0.07]"
              />
            </Field>

            <Field label="Owner setup code">
              <input
                name="setupSecret"
                type="password"
                required
                autoComplete="off"
                placeholder="Enter the setup code from .env.local"
                className="h-12 w-full rounded-xl border border-[#102A22]/10 bg-white px-4 text-sm text-[#102A22] outline-none transition placeholder:text-[#5F6F68]/45 focus:border-[#0F6A4B]/40 focus:ring-4 focus:ring-[#0F6A4B]/[0.07]"
              />
            </Field>
          </>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F6A4B] px-5 text-sm font-bold text-white shadow-lg shadow-[#0F6A4B]/20 transition hover:bg-[#0d5a3f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {mode === 'setup' ? 'Creating account...' : 'Signing in...'}
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
          className="mt-5 w-full text-center text-sm font-semibold text-[#0F6A4B]"
        >
          Return to sign in
        </button>
      )}

      {ownerNeedsSetup && (
        <div className="mt-6 border-t border-[#102A22]/[0.07] pt-5">
          <button
            type="button"
            onClick={() =>
              setMode((current) => (current === 'setup' ? 'login' : 'setup'))
            }
            className="w-full text-center text-sm font-semibold text-[#0F6A4B]"
          >
            {mode === 'setup'
              ? 'The account is already configured? Sign in'
              : 'Complete initial owner setup'}
          </button>
        </div>
      )}
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
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#5F6F68]">
        {label}
      </span>

      {children}
    </label>
  );
}