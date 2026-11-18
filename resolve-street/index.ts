// import { createClient } from "npm:@supabase/supabase-js@2";

// const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
// const SEARCH_RADIUS = 50;
// const MAX_ROAD_DISTANCE = 5;

// const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");

// const SUPABASE_SECRET_KEY =
//   secretKeys.default ?? Deno.env.get("SUPABASE_SECRET_KEY");

// if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
//   throw new Error("Supabase environment variables tidak tersedia.");
// }

// const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

// // =====================================================
// // CORS
// // =====================================================

// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers":
//     "authorization, x-client-info, apikey, content-type",
//   "Access-Control-Allow-Methods": "POST, OPTIONS",
// };

// function jsonResponse(data: Record<string, unknown>, status = 200) {
//   return new Response(JSON.stringify(data), {
//     status,
//     headers: {
//       ...corsHeaders,
//       "Content-Type": "application/json",
//     },
//   });
// }

// // =====================================================
// // TYPES
// // =====================================================

// interface OSMNode {
//   lat: number;
//   lon: number;
// }

// interface OSMWay {
//   type: "way";
//   id: number;
//   tags?: {
//     name?: string;
//     highway?: string;
//   };
//   geometry?: OSMNode[];
// }

// // =====================================================
// // DISTANCE CALCULATION
// // Menghitung jarak titik ke segmen garis dalam meter.
// // =====================================================

// function distanceToSegment(
//   pointLat: number,
//   pointLng: number,
//   start: OSMNode,
//   end: OSMNode,
// ): number {
//   const earthRadius = 6371000;

//   const toXY = (lat: number, lng: number) => {
//     const x =
//       (((lng - pointLng) * Math.PI) / 180) *
//       earthRadius *
//       Math.cos((pointLat * Math.PI) / 180);

//     const y = (((lat - pointLat) * Math.PI) / 180) * earthRadius;

//     return { x, y };
//   };

//   const a = toXY(start.lat, start.lon);
//   const b = toXY(end.lat, end.lon);

//   const dx = b.x - a.x;
//   const dy = b.y - a.y;

//   const lengthSquared = dx * dx + dy * dy;

//   if (lengthSquared === 0) {
//     return Math.hypot(a.x, a.y);
//   }

//   const t = Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared));

//   const closestX = a.x + t * dx;
//   const closestY = a.y + t * dy;

//   return Math.hypot(closestX, closestY);
// }

// // =====================================================
// // FIND NEAREST OSM WAY
// // =====================================================

// async function findNearestRoad(
//   lat: number,
//   lng: number,
// ): Promise<{
//   way: OSMWay;
//   distance: number;
// } | null> {
//   const query = `
//     [out:json][timeout:25];
//     way(around:${SEARCH_RADIUS},${lat},${lng})
//       ["highway"]
//       ["area"!="yes"];
//     out tags geom;
//   `;

//   const response = await fetch(OVERPASS_URL, {
//     method: "POST",
//     headers: {
//       Accept: "application/json",
//       "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
//       "User-Agent":
//         "SanurRoadClosureMap/1.0 (contact: azazelios6656@gmail.com)",
//     },
//     body: new URLSearchParams({
//       data: query,
//     }),
//     signal: AbortSignal.timeout(90000),
//   });

//   if (!response.ok) {
//     const errorBody = await response.text();

//     throw new Error(
//       `Overpass API gagal: HTTP ${response.status}. ` + errorBody.slice(0, 300),
//     );
//   }

//   const result = await response.json();

//   const ways: OSMWay[] = (result.elements ?? []).filter(
//     (element: OSMWay) =>
//       element.type === "way" &&
//       Array.isArray(element.geometry) &&
//       element.geometry.length >= 2,
//   );

//   let nearest: {
//     way: OSMWay;
//     distance: number;
//   } | null = null;

//   for (const way of ways) {
//     const geometry = way.geometry!;

//     for (let i = 0; i < geometry.length - 1; i++) {
//       const distance = distanceToSegment(
//         lat,
//         lng,
//         geometry[i],
//         geometry[i + 1],
//       );

//       if (!nearest || distance < nearest.distance) {
//         nearest = {
//           way,
//           distance,
//         };
//       }
//     }
//   }

//   if (!nearest || nearest.distance > MAX_ROAD_DISTANCE) {
//     return null;
//   }

//   return nearest;
// }

// // =====================================================
// // MAIN EDGE FUNCTION
// // =====================================================

// Deno.serve(async (request: Request) => {
//   // Handle CORS preflight.
//   if (request.method === "OPTIONS") {
//     return new Response("ok", {
//       headers: corsHeaders,
//     });
//   }

//   if (request.method !== "POST") {
//     return jsonResponse({ error: "Method not allowed" }, 405);
//   }

//   try {
//     // -----------------------------------------------
//     // 1. Validate input
//     // -----------------------------------------------

//     const body = await request.json();

//     const lat = Number(body.lat);
//     const lng = Number(body.lng);

//     if (
//       !Number.isFinite(lat) ||
//       !Number.isFinite(lng) ||
//       lat < -90 ||
//       lat > 90 ||
//       lng < -180 ||
//       lng > 180
//     ) {
//       return jsonResponse({ error: "Koordinat tidak valid." }, 400);
//     }

//     // -----------------------------------------------
//     // 2. Find nearest OSM road
//     // -----------------------------------------------

//     const nearest = await findNearestRoad(lat, lng);

//     if (!nearest) {
//       return jsonResponse(
//         {
//           error: "Ruas jalan tidak ditemukan di sekitar lokasi.",
//           search_radius_m: SEARCH_RADIUS,
//           max_distance_m: MAX_ROAD_DISTANCE,
//         },
//         404,
//       );
//     }

//     const { way, distance } = nearest;

//     // -----------------------------------------------
//     // 3. Convert OSM geometry to GeoJSON
//     // -----------------------------------------------

//     const geojson = {
//       type: "LineString",
//       coordinates: way.geometry!.map((point) => [point.lon, point.lat]),
//     };

//     // -----------------------------------------------
//     // 4. Save or update street
//     // -----------------------------------------------

//     const { data, error } = await supabase.rpc("upsert_osm_street", {
//       p_osm_way_id: way.id,
//       p_name: way.tags?.name ?? null,
//       p_coordinates: geojson,
//     });

//     if (error) {
//       console.error("Database error:", error);

//       throw new Error(`Gagal menyimpan data jalan: ${error.message}`);
//     }

//     const street = Array.isArray(data) ? data[0] : data;

//     if (!street) {
//       throw new Error("Database tidak mengembalikan data jalan.");
//     }

//     // -----------------------------------------------
//     // 5. Return result
//     // -----------------------------------------------

//     return jsonResponse({
//       success: true,
//       message: "Ruas jalan berhasil ditemukan.",
//       street: {
//         uuid: street.uuid,
//         osm_way_id: street.osm_way_id,
//         name: street.name,
//         coordinates: geojson,
//       },
//       distance_from_selected_point_m: Number(distance.toFixed(2)),
//     });
//   } catch (error) {
//     console.error("resolve-street error:", error);

//     return jsonResponse(
//       {
//         error: "Terjadi kesalahan ketika mencari ruas jalan.",
//         detail: error instanceof Error ? error.message : "Unknown error",
//       },
//       500,
//     );
//   }
// });
