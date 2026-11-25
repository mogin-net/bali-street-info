// No "@/..." imports: web/scripts/vote.check.ts runs this file directly in Node.

export function formatAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);

  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} mnt lalu`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} jam lalu`;
  return `${Math.floor(minutes / (60 * 24))} hari lalu`;
}

const clockFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Makassar",
});

export function formatClock(iso: string): string {
  return clockFormat.format(new Date(iso));
}

// YYYY-MM-DD in Bali time, to tell whether two instants share a day.
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" });
const dayFormat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Makassar",
});

// Multi-day reports (perbaikan, bencana) need the date, not just "11.12".
export function formatReportedAt(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const clock = clockFormat.format(date);
  return dayKey.format(date) === dayKey.format(now)
    ? clock
    : `${dayFormat.format(date)}, ${clock}`;
}
