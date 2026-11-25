// No "@/..." imports: web/scripts/vote.check.ts runs this file directly in Node.

export type LatLng = [number, number]; // [lat, lng], same order as roadPath

const EARTH_RADIUS_M = 6371000;

// Equirectangular projection around `point`: accurate to well under a meter
// at the 200 m scale the nearby-vote card works at.
export function distanceToPathMeters(point: LatLng, path: LatLng[]): number {
  const cosLat = Math.cos((point[0] * Math.PI) / 180);
  const toXY = ([lat, lng]: LatLng) => [
    ((lng - point[1]) * Math.PI * EARTH_RADIUS_M * cosLat) / 180,
    ((lat - point[0]) * Math.PI * EARTH_RADIUS_M) / 180,
  ];

  if (path.length === 1) return Math.hypot(...toXY(path[0]));

  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = toXY(path[i - 1]);
    const [bx, by] = toXY(path[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    // The point sits at the origin; clamp its projection onto the segment.
    const t =
      lengthSq === 0
        ? 0
        : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

export function findNearestReport<
  T extends { reportId: string; status: string; roadPath: LatLng[] },
>(
  point: LatLng,
  segments: T[],
  maxMeters: number,
  skipIds: ReadonlySet<string>,
): { segment: T; distanceM: number } | null {
  let nearest: { segment: T; distanceM: number } | null = null;

  for (const segment of segments) {
    if (segment.status !== "closed" && segment.status !== "maybe_open") continue;
    if (skipIds.has(segment.reportId)) continue;

    const distanceM = distanceToPathMeters(point, segment.roadPath);
    if (distanceM <= maxMeters && (!nearest || distanceM < nearest.distanceM)) {
      nearest = { segment, distanceM };
    }
  }
  return nearest;
}
