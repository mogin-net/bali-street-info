// Self-check for pure vote helpers. Run: node web/scripts/vote.check.ts
import assert from "node:assert/strict";
import { formatAgo } from "../src/lib/time.ts";

const now = new Date("2026-11-23T10:00:00Z");
assert.equal(formatAgo("2026-11-23T09:59:30Z", now), "baru saja");
assert.equal(formatAgo("2026-11-23T09:35:00Z", now), "25 mnt lalu");
assert.equal(formatAgo("2026-11-23T08:00:00Z", now), "2 jam lalu");
assert.equal(formatAgo("2026-11-20T09:00:00Z", now), "3 hari lalu");

console.log("vote checks ok");
