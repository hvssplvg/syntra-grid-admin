// app/components/admin/notifications/sound.ts
//
// A tiny, synthesised notification chime — Web Audio API, no binary
// asset to source/commit, no library. Deliberately short and soft (two
// quiet descending sine tones, ~150ms total).

let sharedContext: AudioContext | null = null;

/**
 * Must be called from inside a real user-gesture handler (a click) —
 * browsers refuse to start an AudioContext otherwise. Safe to call
 * repeatedly; reuses the same context once created.
 */
export function unlockNotificationAudio(): void {
  try {
    if (!sharedContext) {
      sharedContext = new AudioContext();
    }
    if (sharedContext.state === "suspended") {
      void sharedContext.resume();
    }
  } catch {
    // Web Audio unavailable or blocked — chimes will just silently no-op.
  }
}

/**
 * Plays the chime if (and only if) a context has already been unlocked
 * by a prior user gesture. Never throws — a browser that blocks audio,
 * or a context that was never unlocked, is a silent no-op.
 */
export function playNotificationChime(): void {
  try {
    const ctx = sharedContext;
    if (!ctx || ctx.state !== "running") return;

    const now = ctx.currentTime;
    const notes: Array<{ freq: number; start: number }> = [
      { freq: 880, start: 0 },
      { freq: 660, start: 0.08 },
    ];

    for (const note of notes) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = note.freq;

      const start = now + note.start;
      const duration = 0.12;

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.08, start + 0.02);
      gain.gain.linearRampToValueAtTime(0, start + duration);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(start);
      oscillator.stop(start + duration);
    }
  } catch {
    // Never let a sound failure surface to the user.
  }
}

/**
 * Cross-tab dedupe: the first tab to notice a given notification id
 * "claims" it via localStorage, so a second open tab sees the claim and
 * skips playing. Returns true if THIS call should play the sound.
 */
export function claimNotificationSoundSlot(notificationId: string): boolean {
  try {
    const key = "syntragrid:last-notification-sound-id";
    if (window.localStorage.getItem(key) === notificationId) return false;
    window.localStorage.setItem(key, notificationId);
    return true;
  } catch {
    // If storage is unavailable, default to allowing the sound — a
    // missed cross-tab dedupe is much less noticeable than a page that
    // believes clean reduced-noise behaviour has guarantees it cannot
    // actually make without storage.
    return true;
  }
}
