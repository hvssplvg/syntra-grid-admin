'use client';

// app/(dashboard)/clients/new/NewClientForm.tsx

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  AlertTriangle,
  Building2,
  CreditCard,
  Plus,
  UserRound,
} from 'lucide-react';

import {
  createClient,
  type FormState,
} from './actions';

const PREMIUM_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const GOLD =
  'linear-gradient(135deg,#F3DFA2,#D4AF37 60%,#C79A2A)';

const EMPTY_STATE: FormState = {
  ok: false,
  errors: {},
  message: null,
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function NewClientForm() {
  const [state, action] = useActionState(
    createClient,
    EMPTY_STATE,
  );

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  const effectiveSlug = slugTouched
    ? slugify(slug)
    : slugify(name);

  return (
    <form action={action} className="space-y-6">
      {state.message && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle
            size={17}
            className="mt-0.5 shrink-0 text-red-600"
            aria-hidden
          />

          <p className="text-sm font-semibold text-red-800">
            {state.message}
          </p>
        </div>
      )}

      {/* ── Identity ── */}
      <Section
        icon={Building2}
        title="The client"
        description="Who they are and what you built for them."
      >
        <Field
          label="Client name"
          name="name"
          required
          error={state.errors.name}
          value={name}
          onChange={setName}
          placeholder="Esteem Learning Centre"
        />

        <Field
          label="What you built"
          name="productName"
          required
          error={state.errors.productName}
          placeholder="School Management Platform"
          hint="Shown under the client name across the admin."
        />

        <div className="sm:col-span-2">
          <Field
            label="Workspace URL"
            name="slug"
            error={state.errors.slug}
            value={slugTouched ? slug : effectiveSlug}
            onChange={(next) => {
              setSlugTouched(true);
              setSlug(next);
            }}
            placeholder="esteem-learning-centre"
            hint={
              effectiveSlug
                ? `Their workspace will live at /clients/${effectiveSlug}`
                : 'Generated from the client name. Change it if you prefer.'
            }
            mono
          />
        </div>

        <Field
          label="Industry"
          name="industry"
          placeholder="Education"
        />

        <Field
          label="Country"
          name="country"
          placeholder="Nigeria"
        />

        <Field
          label="Production domain"
          name="domain"
          placeholder="esteemlearningcentre.com.ng"
          hint="No https:// needed."
        />

        <Field
          label="Admin sign-in URL"
          name="adminUrl"
          placeholder="https://example.com/portal/staff-login"
        />

        <Field
          label="Logo path"
          name="logoUrl"
          placeholder="/images/esteem.png"
          hint="Drop the file in /public first."
        />

        <Select
          label="Status"
          name="status"
          defaultValue="ONBOARDING"
          options={[
            ['LEAD', 'Lead'],
            ['ONBOARDING', 'Onboarding'],
            ['ACTIVE', 'Active client'],
            ['PAUSED', 'Paused'],
            ['ARCHIVED', 'Archived'],
          ]}
        />
      </Section>

      {/* ── Commercial ── */}
      <Section
        icon={CreditCard}
        title="Commercial terms"
        description="Drives renewal warnings and portfolio value. All of it can be edited later."
      >
        <Field
          label="Plan name"
          name="plan"
          placeholder="Founding Partner"
        />

        <Select
          label="Billing cycle"
          name="billingCycle"
          defaultValue="ANNUAL"
          options={[
            ['MONTHLY', 'Monthly'],
            ['QUARTERLY', 'Quarterly'],
            ['ANNUAL', 'Annual'],
            ['CUSTOM', 'Custom'],
          ]}
        />

        <Select
          label="Currency"
          name="currency"
          defaultValue="NGN"
          options={[
            ['NGN', 'Nigerian Naira'],
            ['GBP', 'Pound Sterling'],
            ['USD', 'US Dollar'],
            ['EUR', 'Euro'],
          ]}
        />

        <Field
          label="Contract value"
          name="contractValue"
          error={state.errors.contractValue}
          placeholder="1500000"
          hint="Per billing cycle. Numbers only."
        />

        <Field
          label="Live since"
          name="liveSince"
          type="date"
        />

        <Field
          label="Renews on"
          name="renewalAt"
          type="date"
          hint="You get a warning 90 days out."
        />
      </Section>

      {/* ── Contact ── */}
      <Section
        icon={UserRound}
        title="Main contact"
        description="The person you actually speak to."
      >
        <Field
          label="Name"
          name="contactName"
          placeholder="Aisha Bello"
        />

        <Field
          label="Role"
          name="contactRole"
          placeholder="Head of Administration"
        />

        <Field
          label="Email"
          name="contactEmail"
          type="email"
          error={state.errors.contactEmail}
          placeholder="admin@example.com"
        />

        <Field
          label="Phone"
          name="contactPhone"
          placeholder="+234 803 123 4567"
        />
      </Section>

      <Submit />
    </form>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function Submit() {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-col gap-3 border-t border-[#0B1020]/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-[#5A6173]">
        Next you will connect their data source. Nothing goes live
        until then.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-[#241A05] transition hover:brightness-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A87B1B] disabled:opacity-60"
        style={{
          background: GOLD,
          boxShadow: '0 10px 26px rgba(212,175,55,0.3)',
        }}
      >
        <Plus size={15} aria-hidden />

        {pending ? 'Creating…' : 'Create client'}
      </button>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-3xl border border-[#D4AF37]/15 bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)] sm:p-6">
      <legend className="sr-only">{title}</legend>

      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1020]/[0.05] text-[#5A6173]">
          <Icon size={16} aria-hidden />
        </div>

        <div>
          <h2 className="text-base font-bold text-[#0B1020]">
            {title}
          </h2>

          <p className="mt-1 text-sm text-[#5A6173]">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {children}
      </div>
    </fieldset>
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
  value,
  onChange,
  mono = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  mono?: boolean;
}) {
  const id = `field-${name}`;

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6173]"
      >
        {label}

        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error
            ? `${id}-error`
            : hint
              ? `${id}-hint`
              : undefined
        }
        {...(onChange
          ? {
              value: value ?? '',
              onChange: (
                event: React.ChangeEvent<HTMLInputElement>,
              ) => onChange(event.target.value),
            }
          : {
              defaultValue: value,
            })}
        className={`mt-1.5 h-11 w-full rounded-xl border bg-[#FAFAF9] px-3.5 text-sm text-[#0B1020] outline-none transition-colors placeholder:text-[#5A6173]/60 focus:bg-white ${
          mono ? 'font-mono' : ''
        } ${
          error
            ? 'border-red-300 focus:border-red-500'
            : 'border-[#0B1020]/[0.08] focus:border-[#0D9488]'
        }`}
      />

      {error ? (
        <p
          id={`${id}-error`}
          className="mt-1.5 text-xs font-semibold text-red-600"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          className="mt-1.5 text-xs text-[#5A6173]"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: [string, string][];
}) {
  const id = `field-${name}`;

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6173]"
      >
        {label}
      </label>

      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="mt-1.5 h-11 w-full rounded-xl border border-[#0B1020]/[0.08] bg-[#FAFAF9] px-3 text-sm font-semibold text-[#0B1020] outline-none transition-colors focus:border-[#0D9488] focus:bg-white"
        style={{
          transitionTimingFunction: PREMIUM_EASE,
        }}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}