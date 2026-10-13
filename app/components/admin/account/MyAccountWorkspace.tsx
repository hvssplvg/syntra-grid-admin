"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Loader2,
  LogOut,
  Monitor,
  ShieldCheck,
} from "lucide-react";

import { authClient } from "@/lib/auth/client";
import {
  fetchMyNotificationPreferences,
  fetchMyProfile,
  removeMyAvatar,
  updateMyNotificationPreferences,
  updateMyProfile,
  uploadMyAvatar,
  type MyProfile,
  type NotificationPreferences,
} from "./api";
import { changeMyPassword } from "./actions";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

function announceProfileUpdated() {
  window.dispatchEvent(new Event("syntragrid:employee-profile-updated"));
}

function announceAvatarUpdated() {
  window.dispatchEvent(new Event("syntragrid:employee-avatar-updated"));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[var(--line)] py-6 last:border-b-0">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-[13px]">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-right font-medium text-[var(--text)]">{value}</span>
    </div>
  );
}

export default function MyAccountWorkspace({ onBack }: { onBack: () => void }) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(() => {
    fetchMyProfile()
      .then((result) => {
        setProfile(result);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex h-full min-h-[calc(100vh-56px)] w-full flex-col bg-[var(--surface)]">
      <header className="border-b border-[var(--line)] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
        >
          <ArrowLeft size={15} />
          Back to Command Overview
        </button>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-[18px] font-semibold text-[var(--text)]">My Account</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">Manage your personal information and account settings.</p>

        {status === "loading" ? (
          <div className="flex justify-center py-16">
            <Loader2 size={20} className="animate-spin text-[var(--text-subtle)]" />
          </div>
        ) : status === "error" || !profile ? (
          <p className="py-16 text-center text-[13px] text-[var(--danger)]">Unable to load your account right now.</p>
        ) : (
          <>
            <ProfileHeader profile={profile} onAvatarChanged={load} />
            <EmploymentOverview profile={profile} />
            <PersonalInformation profile={profile} onSaved={load} />
            <AccountSecurity />
            <NotificationPreferencesSection />
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   PROFILE HEADER
============================================================================ */

function ProfileHeader({ profile, onAvatarChanged }: { profile: MyProfile; onAvatarChanged: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setUploading(true);
      setError(null);

      uploadMyAvatar(file)
        .then(() => {
          announceAvatarUpdated();
          onAvatarChanged();
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Couldn't upload that photo."))
        .finally(() => setUploading(false));
    },
    [onAvatarChanged],
  );

  const handleRemove = useCallback(() => {
    setUploading(true);
    removeMyAvatar()
      .then(() => {
        announceAvatarUpdated();
        onAvatarChanged();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't remove your photo."))
      .finally(() => setUploading(false));
  }, [onAvatarChanged]);

  const displayName = profile.preferredName || profile.fullName;

  return (
    <Section title="Profile">
      <div className="flex items-center gap-4">
        <div className="group relative">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt={displayName} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-tint)] text-[18px] font-semibold text-[var(--accent-strong)]">
              {initials(displayName)}
            </span>
          )}

          <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) handleFile(file);
              }}
            />
          </label>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-[var(--text)]">{displayName}</p>
          {profile.jobTitle && <p className="text-[12.5px] text-[var(--text-muted)]">{profile.jobTitle}</p>}
          {profile.department && <p className="text-[11.5px] text-[var(--text-subtle)]">{profile.department.name}</p>}
          <p className="mt-1 text-[11.5px] text-[var(--text-subtle)]">{profile.email}</p>
        </div>

        {profile.avatarUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="shrink-0 text-[11.5px] font-medium text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-50"
          >
            Remove photo
          </button>
        )}
      </div>

      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--success-soft)] px-2 py-1 text-[10px] font-bold text-[var(--success)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
        {profile.accountStatus}
      </span>

      {error && <p className="mt-2 text-[11.5px] text-[var(--danger)]">{error}</p>}
    </Section>
  );
}

/* ============================================================================
   EMPLOYMENT OVERVIEW
============================================================================ */

function EmploymentOverview({ profile }: { profile: MyProfile }) {
  if (!profile.hasEmployeeRecord) {
    return (
      <Section title="Employment overview">
        <p className="text-[12.5px] text-[var(--text-muted)]">No employment record is linked to this account.</p>
      </Section>
    );
  }

  return (
    <Section title="Employment overview">
      <div className="divide-y divide-[var(--line)]">
        <Field label="Employee ID" value={profile.employeeId ?? "Not recorded"} />
        <Field label="Department" value={profile.department?.name ?? "Not recorded"} />
        <Field label="Job title" value={profile.jobTitle ?? "Not recorded"} />
        <Field label="Employment type" value={profile.employmentType ?? "Not recorded"} />
        <Field label="Start date" value={profile.startDate ? new Date(profile.startDate).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "Not recorded"} />
        <Field label="Length of service" value={profile.lengthOfService ?? "Not recorded"} />
        <Field label="Reports to" value={profile.reportsTo ?? "Not assigned"} />
        <Field label="Work location" value={profile.workLocation ?? "Not recorded"} />
        <Field label="Account status" value={profile.accountStatus} />
      </div>
    </Section>
  );
}

/* ============================================================================
   PERSONAL INFORMATION
============================================================================ */

function PersonalInformation({ profile, onSaved }: { profile: MyProfile; onSaved: () => void }) {
  const [preferredName, setPreferredName] = useState(profile.preferredName ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const dirty =
    preferredName !== (profile.preferredName ?? "") ||
    phone !== (profile.phone ?? "") ||
    city !== (profile.city ?? "") ||
    country !== (profile.country ?? "");

  const save = useCallback(() => {
    setSaving(true);
    setFeedback(null);

    updateMyProfile({ preferredName, phone, city, country })
      .then(() => {
        announceProfileUpdated();
        onSaved();
        setFeedback({ tone: "success", message: "Saved." });
      })
      .catch((err) => setFeedback({ tone: "error", message: err instanceof Error ? err.message : "Couldn't save your changes." }))
      .finally(() => setSaving(false));
  }, [preferredName, phone, city, country, onSaved]);

  return (
    <Section title="Personal information">
      <div className="grid gap-3">
        <LabeledInput label="Full name" value={`${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()} readOnly />
        <LabeledInput label="Preferred name" value={preferredName} onChange={setPreferredName} placeholder="How you'd like to be addressed" />
        <LabeledInput label="Work email" value={profile.email} readOnly />
        <LabeledInput label="Phone number" value={phone} onChange={setPhone} placeholder="Not recorded" />
        <LabeledInput label="City" value={city} onChange={setCity} placeholder="Not recorded" />
        <LabeledInput label="Country" value={country} onChange={setCountry} placeholder="Not recorded" />
      </div>

      {feedback && (
        <p className={cx("mt-2 text-[11.5px]", feedback.tone === "success" ? "text-[var(--success)]" : "text-[var(--danger)]")}>
          {feedback.message}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!dirty || saving}
        className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </Section>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-[var(--text-subtle)]">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        readOnly={readOnly || !onChange}
        onChange={(event) => onChange?.(event.target.value)}
        className={cx(
          "h-9 w-full rounded-lg border px-3 text-[13px] outline-none",
          readOnly || !onChange
            ? "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]"
            : "border-[var(--line)] bg-[var(--surface)] text-[var(--text)] focus:border-[var(--accent)]",
        )}
      />
    </label>
  );
}

/* ============================================================================
   ACCOUNT SECURITY
============================================================================ */

type AuthSession = { id: string; token: string; createdAt: string; userAgent?: string | null; isCurrent: boolean };

function describeUserAgent(userAgent?: string | null): string {
  if (!userAgent) return "Unknown device";
  if (/Mobile|Android|iPhone/i.test(userAgent)) return "Mobile browser";
  if (/Macintosh/i.test(userAgent)) return "Mac — browser";
  if (/Windows/i.test(userAgent)) return "Windows — browser";
  return "Browser session";
}

function AccountSecurity() {
  const [sessions, setSessions] = useState<AuthSession[] | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void (async () => {
      const [sessionResult, listResult] = await Promise.all([authClient.getSession(), authClient.listSessions()]);
      const currentToken = sessionResult.data?.session?.token;

      if (listResult.data) {
        setSessions(
          listResult.data.map((session) => ({
            id: session.id,
            token: session.token,
            createdAt: new Date(session.createdAt).toISOString(),
            userAgent: session.userAgent,
            isCurrent: session.token === currentToken,
          })),
        );
      }
    })();
  }, []);

  const revoke = useCallback((token: string) => {
    void authClient.revokeSession({ token }).then(() => {
      setSessions((current) => current?.filter((session) => session.token !== token) ?? null);
    });
  }, []);

  const submitPasswordChange = useCallback(() => {
    setChangingPassword(true);
    setPasswordFeedback(null);

    void changeMyPassword(currentPassword, newPassword)
      .then((result) => {
        if (result.ok) {
          setPasswordFeedback({ tone: "success", message: "Password changed." });
          setCurrentPassword("");
          setNewPassword("");
        } else {
          setPasswordFeedback({ tone: "error", message: result.error ?? "Unable to change your password." });
        }
      })
      .finally(() => setChangingPassword(false));
  }, [currentPassword, newPassword]);

  const signOut = useCallback(() => {
    setSigningOut(true);
    void fetch("/api/admin/signout", { method: "POST", credentials: "include" }).then(() => {
      window.location.replace("/login");
    });
  }, []);

  return (
    <Section title="Account security">
      <div className="mb-4 flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
        <ShieldCheck size={14} />
        Signed in with email and password (Neon Auth)
      </div>

      <div className="mb-4 rounded-lg border border-[var(--line)] p-3">
        <p className="mb-2 text-[11px] font-semibold text-[var(--text)]">Change password</p>
        <div className="grid gap-2">
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Current password"
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-[13px] outline-none focus:border-[var(--accent)]"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password"
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-[13px] outline-none focus:border-[var(--accent)]"
          />
        </div>

        {passwordFeedback && (
          <p className={cx("mt-2 text-[11.5px]", passwordFeedback.tone === "success" ? "text-[var(--success)]" : "text-[var(--danger)]")}>
            {passwordFeedback.message}
          </p>
        )}

        <button
          type="button"
          onClick={submitPasswordChange}
          disabled={!currentPassword || !newPassword || changingPassword}
          className="mt-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
        >
          {changingPassword ? "Changing…" : "Change password"}
        </button>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-[11px] font-semibold text-[var(--text)]">Active sessions</p>
        {sessions === null ? (
          <p className="text-[12px] text-[var(--text-muted)]">Loading…</p>
        ) : (
          <div className="flex flex-col gap-1">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <Monitor size={13} className="text-[var(--text-subtle)]" />
                  <div>
                    <p className="text-[12px] text-[var(--text)]">
                      {describeUserAgent(session.userAgent)}
                      {session.isCurrent && <span className="ml-1.5 text-[var(--text-subtle)]">(this device)</span>}
                    </p>
                    <p className="text-[10.5px] text-[var(--text-subtle)]">
                      Signed in {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button type="button" onClick={() => revoke(session.token)} className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--danger)]">
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mb-4 text-[11.5px] text-[var(--text-subtle)]">Last login: not available.</p>

      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-[12.5px] font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:opacity-50"
      >
        <LogOut size={14} />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </Section>
  );
}

/* ============================================================================
   NOTIFICATION PREFERENCES
============================================================================ */

const PREFERENCE_LABELS: { key: keyof NotificationPreferences; label: string }[] = [
  { key: "inAppEnabled", label: "In-app notifications" },
  { key: "soundEnabled", label: "Notification sounds" },
  { key: "messagesEnabled", label: "Message notifications" },
  { key: "tasksEnabled", label: "Task notifications" },
  { key: "approvalsEnabled", label: "Approval notifications" },
  { key: "campaignsEnabled", label: "Campaign notifications" },
  { key: "socialMediaEnabled", label: "Social Media notifications" },
  { key: "leaveEnabled", label: "Leave notifications" },
];

function NotificationPreferencesSection() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchMyNotificationPreferences().then(setPreferences).catch(() => {});
  }, []);

  const toggle = useCallback((key: keyof NotificationPreferences, next: boolean) => {
    setPreferences((current) => (current ? { ...current, [key]: next } : current));
    setSavingKey(key);

    updateMyNotificationPreferences({ [key]: next })
      .catch(() => {
        setPreferences((current) => (current ? { ...current, [key]: !next } : current));
      })
      .finally(() => setSavingKey(null));
  }, []);

  if (!preferences) {
    return (
      <Section title="Notification preferences">
        <p className="text-[12.5px] text-[var(--text-muted)]">Loading…</p>
      </Section>
    );
  }

  return (
    <Section title="Notification preferences">
      <div className="divide-y divide-[var(--line)]">
        {PREFERENCE_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-[13px] text-[var(--text)]">{label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={preferences[key]}
              onClick={() => toggle(key, !preferences[key])}
              disabled={savingKey === key}
              className={cx(
                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
                preferences[key] ? "bg-[var(--accent)]" : "bg-[var(--surface-muted)]",
              )}
            >
              <span
                className={cx(
                  "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                  preferences[key] ? "translate-x-5" : "translate-x-1",
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}
