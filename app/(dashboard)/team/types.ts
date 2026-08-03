// app/(dashboard)/team/types.ts
//
// A 'use server' module may only export async functions, so the shared state
// shape and its initial value cannot live in actions.ts.

export type NewCredentials = {
  name: string;
  email: string;
  password: string;
};

export type FormState = {
  ok: boolean;
  errors: Record<string, string>;
  message: string | null;
  /** Shown once, immediately after creation. Never stored anywhere. */
  credentials?: NewCredentials | null;
  /** True when creating the account replaced the current admin's session. */
  sessionReplaced?: boolean;
};

export const EMPTY_STATE: FormState = {
  ok: false,
  errors: {},
  message: null,
  credentials: null,
};