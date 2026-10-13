"use server";

// Server action for the one genuinely sensitive Account Security
// mutation — change-password. Calls Neon Auth's auth.changePassword()
// directly, server-side, the same "server action calls auth.* directly"
// pattern app/(auth)/login/actions.ts already establishes for sign-in.
// Never builds a separate password store — Neon Auth remains the only
// place a password is ever checked or written.

import { auth } from "@/lib/auth/server";

export async function changeMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!currentPassword || !newPassword) {
    return { ok: false, error: "Enter your current and new password." };
  }

  if (newPassword.length < 8) {
    return { ok: false, error: "Your new password must be at least 8 characters." };
  }

  const result = await auth.changePassword({ currentPassword, newPassword });

  if (result.error) {
    return { ok: false, error: result.error.message || "Unable to change your password." };
  }

  return { ok: true };
}
