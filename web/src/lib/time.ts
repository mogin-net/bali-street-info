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
