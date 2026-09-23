'use client';

import Image from 'next/image';
import { useActionState, useEffect, useState } from 'react';
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
import WelcomeOverlay from './WelcomeOverlay';

const initialState: AuthActionState = {};

const GOLD = 'linear-gradient(135deg,#F3DFA2,#D4AF37 60%,#C79A2A)';
const GOLD_INK = '#241A05';

const inputBase =
  'h-12 w-full rounded-xl border border-[#0B1020]/10 bg-[#F7F8FB] text-sm text-[#0B1020] outline-none transition placeholder:text-[#5A6173]/70 hover:border-[#D4AF37]/45 focus-visible:border-[#D4AF37]/60 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-[#D4AF37]/15 read-only:border-[#0B1020]/[0.06] read-only:bg-[#F0F1F5] read-only:text-[#5A6173]';

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
  const [welcoming, setWelcoming] = useState(false);

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

  useEffect(() => {
    if (!state.ok) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWelcoming(true);
  }, [state.ok]);

  return (
    <>
      {welcoming && (
        <WelcomeOverlay
          firstName={state.firstName?.trim() || ''}
          mode={state.mode === 'setup' ? 'setup' : 'signIn'}
        />
      )}

      <div
        aria-hidden={welcoming}
        className={`auth-card w-full max-w-[460px] overflow-hidden rounded-[28px] border border-[#D4AF37]/25 bg-white shadow-[0_30px_70px_rgba(11,16,32,0.10)] ${
          welcoming ? 'is-handing-over' : ''
        }`}
        style={{
          fontFamily: 'var(--font-space-grotesk), ui-sans-serif, system-ui',
        }}
      >
        <div
          className="h-[3px] w-full"
          style={{
            background:
              'linear-gradient(to right, transparent, #D4AF37 45%, #14B8A6 80%, transparent)',
          }}
        />

        <div className="px-7 py-9 sm:px-9">
          {/* Logo sits at the top and carries the only motion on the page. */}
          <div className="flex flex-col items-center text-center">
            <span className="logo-mark">
              <Image
                src="/images/syntra-logo.png"
                alt="Syntra Grid"
                width={240}
                height={240}
                priority
                className="h-24 w-auto object-contain"
              />
            </span>

            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#14B8A6]/30 bg-[#14B8A6]/10 px-3 py-1 text-[11px] font-semibold text-[#0F766E]">
              {mode === 'setup' ? (
                <ShieldCheck size={13} />
              ) : (
                <LockKeyhole size={13} />
              )}
              {mode === 'setup' ? 'One time setup' : 'Secure area'}
            </span>

            <h1 className="mt-4 text-[28px] font-bold leading-tight tracking-tight text-[#0B1020]">
              {mode === 'setup' ? 'Create owner account' : 'Welcome back'}
            </h1>

            <p className="mt-2 max-w-[40ch] text-sm leading-6 text-[#5A6173]">
              {mode === 'setup'
                ? 'Set up the CentraGrid owner account. You only do this once.'
                : 'Sign in to manage clients, projects, deployments and system health.'}
            </p>
          </div>

          {state.error && (
            <div className="mt-7 rounded-2xl border border-red-500/25 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {state.error}
            </div>
          )}

          <form
            action={mode === 'login' ? loginAction : setupAction}
            className={`space-y-4 ${state.error ? 'mt-5' : 'mt-8'}`}
          >
            {mode === 'setup' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <div className="relative">
                    <User
                      size={16}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5A6173]"
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
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5A6173]"
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
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5A6173]"
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
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#5A6173] outline-none transition hover:bg-[#0B1020]/[0.05] hover:text-[#0B1020] focus-visible:ring-2 focus-visible:ring-[#D4AF37]/50"
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
              disabled={pending || welcoming}
              style={{
                background: GOLD,
                color: GOLD_INK,
                boxShadow: '0 12px 28px rgba(212,175,55,0.30)',
              }}
              className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold outline-none transition hover:brightness-[1.05] focus-visible:ring-4 focus-visible:ring-[#D4AF37]/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending || welcoming ? (
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
              className="mt-5 w-full rounded-lg py-2 text-center text-sm font-semibold text-[#0F766E] outline-none transition hover:text-[#0B1020] focus-visible:ring-2 focus-visible:ring-[#D4AF37]/50"
            >
              Return to sign in
            </button>
          )}

          {ownerNeedsSetup && (
            <div className="mt-6 border-t border-[#0B1020]/[0.08] pt-5">
              <button
                type="button"
                onClick={() =>
                  setMode((current) => (current === 'setup' ? 'login' : 'setup'))
                }
                className="w-full rounded-lg py-2 text-center text-sm font-semibold text-[#0F766E] outline-none transition hover:text-[#0B1020] focus-visible:ring-2 focus-visible:ring-[#D4AF37]/50"
              >
                {mode === 'setup'
                  ? 'Account already configured? Sign in'
                  : 'Complete initial owner setup'}
              </button>
            </div>
          )}
        </div>

        <style jsx>{`
          .auth-card {
            animation: card-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
          }

          .auth-card.is-handing-over {
            animation: none;
            opacity: 0;
            transform: scale(0.98);
            transition: opacity 0.3s ease, transform 0.3s ease;
          }

          /* The mark stands on its own, lit by a soft gold halo. */
          .logo-mark {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 4px 10px;
            animation: mark-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both,
              mark-float 6s ease-in-out 0.6s infinite;
          }

          .logo-mark::before {
            content: '';
            position: absolute;
            left: 50%;
            top: 50%;
            height: 150%;
            width: 150%;
            transform: translate(-50%, -50%);
            border-radius: 9999px;
            background: radial-gradient(
              circle,
              rgba(212, 175, 55, 0.3) 0%,
              rgba(20, 184, 166, 0.14) 42%,
              transparent 70%
            );
            animation: halo-pulse 3.6s ease-in-out 0.6s infinite;
          }

          .logo-mark :global(img) {
            position: relative;
            z-index: 1;
          }

          @keyframes card-in {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes mark-in {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes mark-float {
            0%,
            100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-6px);
            }
          }

          @keyframes halo-pulse {
            0%,
            100% {
              opacity: 0.65;
              transform: translate(-50%, -50%) scale(0.94);
            }
            50% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1.06);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .auth-card,
            .logo-mark,
            .logo-mark::before {
              animation: none;
            }
          }
        `}</style>
      </div>
    </>
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
      <span className="mb-2 block text-[13px] font-medium text-[#5A6173]">
        {label}
      </span>

      {children}
    </label>
  );
}