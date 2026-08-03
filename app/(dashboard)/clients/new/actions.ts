'use server';

// app/(dashboard)/clients/new/actions.ts

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';

export type FormState = {
  ok: boolean;
  /** Field name → message. Rendered next to the input. */
  errors: Record<string, string>;
  /** Anything that isn't tied to one field. */
  message: string | null;
};

const STATUSES = ['LEAD', 'ONBOARDING', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
const CYCLES = ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM'] as const;
const CURRENCIES = ['NGN', 'GBP', 'USD', 'EUR'] as const;

/* ───────────────────────── helpers ───────────────────────── */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** "Esteem Learning Centre" → "ELC". Falls back to the first three letters. */
function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);

  const letters =
    words.length >= 2
      ? words.slice(0, 3).map((word) => word[0])
      : name.replace(/[^a-zA-Z]/g, '').slice(0, 3).split('');

  return letters.join('').toUpperCase().padEnd(2, 'X');
}

/** SYN-ELC-001, skipping any suffix already taken. */
async function nextClientRef(name: string): Promise<string> {
  const prefix = `SYN-${initials(name)}`;

  const taken = await prisma.client.findMany({
    where: {
      clientRef: {
        startsWith: prefix,
      },
    },
    select: {
      clientRef: true,
    },
  });

  const used = new Set(taken.map((row) => row.clientRef));

  for (let n = 1; n < 1000; n += 1) {
    const candidate = `${prefix}-${String(n).padStart(3, '0')}`;

    if (!used.has(candidate)) {
      return candidate;
    }
  }

  return `${prefix}-${Date.now()}`;
}

/** Env-var prefix derived from the slug, matching lib/integrations/credentials.ts. */
function envPrefix(slug: string): string {
  return slug
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function text(data: FormData, key: string): string {
  return String(data.get(key) ?? '').trim();
}

function optional(data: FormData, key: string): string | null {
  const value = text(data, key);
  return value === '' ? null : value;
}

function date(data: FormData, key: string): Date | null {
  const value = text(data, key);

  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function oneOf<T extends readonly string[]>(
  data: FormData,
  key: string,
  allowed: T,
  fallback: T[number],
): T[number] {
  const value = text(data, key);

  return (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

/* ───────────────────────── action ───────────────────────── */

export async function createClient(
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const errors: Record<string, string> = {};

  const name = text(data, 'name');
  const productName = text(data, 'productName');
  const rawSlug = text(data, 'slug');
  const slug = rawSlug ? slugify(rawSlug) : slugify(name);

  if (!name) {
    errors.name = 'Give the client a name.';
  }

  if (!productName) {
    errors.productName = 'What did you build for them?';
  }

  if (!slug) {
    errors.slug =
      'Could not build a URL from that name — set one manually.';
  }

  const contactEmail = optional(data, 'contactEmail');

  if (
    contactEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
  ) {
    errors.contactEmail = 'That email address does not look right.';
  }

  const rawValue = text(data, 'contractValue');
  const contractValue =
    rawValue === '' ? '0' : rawValue.replace(/[, ]/g, '');

  if (!/^\d+(\.\d{1,2})?$/.test(contractValue)) {
    errors.contractValue =
      'Use a plain number, for example 1500000.';
  }

  const domain =
    optional(data, 'domain')?.replace(/^https?:\/\//, '') ?? null;

  if (slug && !errors.slug) {
    const clash = await prisma.client.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    });

    if (clash) {
      errors.slug = `"${slug}" is already in use. Pick a different URL.`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      message: 'Fix the highlighted fields and try again.',
    };
  }

  let created: { slug: string };

  try {
    created = await prisma.client.create({
      data: {
        clientRef: await nextClientRef(name),
        name,
        slug,
        logoUrl: optional(data, 'logoUrl'),
        productName,
        industry: optional(data, 'industry'),
        country: optional(data, 'country'),
        status: oneOf(data, 'status', STATUSES, 'ONBOARDING'),

        domain,
        adminUrl: optional(data, 'adminUrl'),

        plan: optional(data, 'plan'),
        billingCycle: oneOf(
          data,
          'billingCycle',
          CYCLES,
          'ANNUAL',
        ),
        currency: oneOf(data, 'currency', CURRENCIES, 'NGN'),
        contractValue,
        renewalAt: date(data, 'renewalAt'),
        liveSince: date(data, 'liveSince'),

        // Set now so the connect step knows which env vars to ask for.
        integrationKey: envPrefix(slug),
        integrationLive: false,

        contactName: optional(data, 'contactName'),
        contactRole: optional(data, 'contactRole'),
        contactEmail,
        contactPhone: optional(data, 'contactPhone'),

        billing: {
          create: {},
        },
      },
      select: {
        slug: true,
      },
    });
  } catch (error) {
    console.error('Client create failed:', error);

    return {
      ok: false,
      errors: {},
      message:
        error instanceof Error
          ? `Could not save the client: ${error.message}`
          : 'Could not save the client.',
    };
  }

  revalidatePath('/clients');
  revalidatePath('/dashboard');

  // Straight into connecting a data source — the client record on its own
  // shows no live figures.
  redirect(`/clients/${created.slug}/connect`);
}