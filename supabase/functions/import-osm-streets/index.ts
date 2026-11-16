
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const OVERPASS_URL =
  "https://overpass.private.coffee/api/interpreter";

// Batas area percobaan di sekitar Sanur.
// Urutan: selatan, barat, utara, timur.
const BOUNDING_BOX =
  "-8.70,115.25,-8.66,115.27";

export default {
  fetch: withSupabase(
    { auth: ["secret"] },
    async (req, ctx) => {
      // Hanya menerima POST
      if (req.method !== "POST") {
        return Response.json(
          { error: "Method not allowed" },
          { status: 405 }
        );
      }

      try {
        // 1. Query untuk mengambil jalan dari OSM
        const query = `
          [out:json][timeout:60];

          way["highway"]
            (${BOUNDING_BOX});

          out tags geom;
        `;

        // 2. Meminta data ke Overpass API
        
const response = await fetch(OVERPASS_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json",
    "User-Agent":
      "BaliStreetInfo/0.1 (contact: GANTI_DENGAN_EMAIL_KAMU)",
  },
  body: new URLSearchParams({
    data: query,
  }),
});

if (!response.ok) {
  const errorDetail = await response.text();

  console.error("Overpass error:", {
    status: response.status,
    detail: errorDetail.slice(0, 1000),
  });

  throw new Error(
    `Overpass API error: ${response.status} - ${errorDetail.slice(0, 300)}`
  );
}


        if (!response.ok) {
          throw new Error(
            `Overpass API error: ${response.status}`
          );
        }

        const osmData = await response.json();

        if (!Array.isArray(osmData.elements)) {
          throw new Error(
            "Format respons Overpass tidak valid"
          );
        }

        // 3. Mengubah data OSM menjadi GeoJSON
        const streets = osmData.elements
          .filter((way: any) =>
            way.type === "way" &&
            Array.isArray(way.geometry) &&
            way.geometry.length >= 2
          )
          .map((way: any) => ({
            osm_way_id: way.id,
            name: way.tags?.name ?? null,
            geometry: {
              type: "LineString",
              coordinates: way.geometry.map(
                (point: any) => [
                  point.lon,
                  point.lat,
                ]
              ),
            },
          }));

        // 4. Jika tidak ada jalan ditemukan
        if (streets.length === 0) {
          return Response.json({
            message: "Tidak ada data jalan ditemukan",
            total: 0,
          });
        }

        // 5. Simpan ke database secara bertahap
        let totalImported = 0;
        const batchSize = 100;

        for (
          let i = 0;
          i < streets.length;
          i += batchSize
        ) {
          const batch = streets.slice(
            i,
            i + batchSize
          );

          const { data, error } =
            await ctx.supabaseAdmin.rpc(
              "import_osm_streets",
              {
                p_streets: batch,
              }
            );

          if (error) {
            throw error;
          }

          totalImported += data ?? 0;
        }

        // 6. Kirim hasil ke pemanggil function
        return Response.json({
          message: "Import data OSM berhasil",
          totalFound: streets.length,
          totalImported,
        });

      } catch (error) {
        console.error("Import OSM error:", error);

        return Response.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Terjadi kesalahan",
          },
          { status: 500 }
        );
      }
    }
  ),
};
