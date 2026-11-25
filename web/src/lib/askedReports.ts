// Reports the nearby-vote card must not ask about this session: answered,
// skipped, voted on in the detail panel, or just reported by this user.
// No "@/..." imports: web/scripts/vote.check.ts runs this file directly in Node.

const STORAGE_KEY = "nearby-vote-asked";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

// Fallback when sessionStorage is blocked (e.g. some private modes).
const memory = new Set<string>();

const sessionStore = (): StorageLike | undefined => globalThis.sessionStorage;

export function readAskedIds(storage = sessionStore()): Set<string> {
  const ids = new Set(memory);
  try {
    const stored = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "[]") as string[];
    stored.forEach((id) => ids.add(id));
  } catch {
    // Unreadable storage: memory alone still prevents asking twice per page load.
  }
  return ids;
}

export function markReportAsked(reportId: string, storage = sessionStore()) {
  memory.add(reportId);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify([...readAskedIds(storage)]));
  } catch {
    // Without storage the report may be asked again after a reload; nothing else breaks.
  }
}
