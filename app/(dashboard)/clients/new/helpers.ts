import type { FormState } from "./actions";

export const EMPTY_STATE: FormState = {
  ok: false,
  errors: {},
  message: null,
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}