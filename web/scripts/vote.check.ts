// Self-check for pure vote helpers. Run: node web/scripts/vote.check.ts
import assert from "node:assert/strict";
import { formatAgo } from "../src/lib/time.ts";
import { distanceToPathMeters, findNearestReport } from "../src/pages/home/proximity.ts";

const now = new Date("2026-11-23T10:00:00Z");
assert.equal(formatAgo("2026-11-23T09:59:30Z", now), "baru saja");
assert.equal(formatAgo("2026-11-23T09:35:00Z", now), "25 mnt lalu");
assert.equal(formatAgo("2026-11-23T08:00:00Z", now), "2 jam lalu");
assert.equal(formatAgo("2026-11-20T09:00:00Z", now), "3 hari lalu");

const line: [number, number][] = [[-8.7, 115.25], [-8.7, 115.26]];
assert.ok(distanceToPathMeters([-8.7, 115.255], line) < 1, "on the line");
assert.ok(Math.abs(distanceToPathMeters([-8.699, 115.255], line) - 111) < 3, "~111 m north");
assert.ok(Math.abs(distanceToPathMeters([-8.7, 115.261], line) - 110) < 3, "past the end → end point");
assert.equal(distanceToPathMeters([-8.7, 115.25], []), Infinity, "empty path");

const seg = (reportId: string, status: string, lat: number) => ({
  reportId,
  status,
  roadPath: [[lat, 115.25], [lat, 115.26]] as [number, number][],
});
const near = seg("near", "closed", -8.7005);
const far = seg("far", "maybe_open", -8.7015);
const open = seg("open", "open", -8.7);
const here: [number, number] = [-8.7, 115.255];
assert.equal(findNearestReport(here, [far, near, open], 200, new Set())?.segment.reportId, "near");
assert.equal(findNearestReport(here, [far, near], 200, new Set(["near"]))?.segment.reportId, "far");
assert.equal(findNearestReport(here, [open], 200, new Set()), null, "open reports are not asked");
assert.equal(findNearestReport([-8.69, 115.255], [near], 200, new Set()), null, "~1.1 km away");

console.log("vote checks ok");
