const STORAGE_KEY = "ctrms_notif_sound_muted";

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    if (muted) {
      localStorage.setItem(STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable — ignore
  }
}

/**
 * Plays a brief two-tone chime using the Web Audio API.
 * Gracefully no-ops when:
 * - the user has muted sounds
 * - autoplay is blocked by the browser (no prior user interaction)
 * - AudioContext is unsupported
 */
export function playNotificationSound(): void {
  if (isSoundMuted()) return;
  try {
    // AudioContext must be created/resumed after a user gesture; this will
    // throw or be suspended if autoplay policy blocks it — we catch silently.
    const ctx = new AudioContext();
    if (ctx.state === "suspended") {
      void ctx.close();
      return;
    }
    const now = ctx.currentTime;
    const schedule: Array<{ freq: number; startAt: number; dur: number }> = [
      { freq: 880, startAt: now, dur: 0.12 },
      { freq: 1108, startAt: now + 0.13, dur: 0.18 },
    ];
    for (const note of schedule) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, note.startAt);
      gain.gain.setValueAtTime(0, note.startAt);
      gain.gain.linearRampToValueAtTime(0.08, note.startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, note.startAt + note.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(note.startAt);
      osc.stop(note.startAt + note.dur);
    }
    // Auto-close context after playback finishes to release resources
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // Autoplay blocked or AudioContext unavailable — no-op
  }
}
