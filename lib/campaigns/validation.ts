// lib/campaigns/validation.ts
//
// Small, dependency-free request-body parsers shared by every Campaigns
// API route. No Zod (or any other validation library) is installed in
// this project — these mirror the inline parsing style already used by
// lib/brand-assets and lib/social-media's own routes instead of adding a
// new dependency for this alone.

export function parseEnumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseRequiredString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseOptionalId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Parses a non-negative monetary amount. Returns undefined (not a valid
 *  number), null (explicitly cleared) or a finite number >= 0. Never
 *  returns NaN/Infinity — callers must treat undefined as "reject". */
export function parseOptionalAmount(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return value;
}

export function parseRequiredAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}
