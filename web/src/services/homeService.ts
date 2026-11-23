import { supabase } from "../lib/supabase";

type LatLng = [number, number];

// Struktur data dari PostgreSQL RPC
interface HomeRoadSegmentRow {
  street_id: string;
  street_name: string | null;
  report_id: string;
  segment_id: string;
  segment_order: number;
  status: "closed" | "open";
  category: string;
  road_geojson: {
    type: "LineString";
    coordinates: [number, number][];
  };
  marker_geojson: {
    type: "Point";
    coordinates: [number, number];
  };
  start_marker_geojson: { type: "Point"; coordinates: [number, number] } | null;
  end_marker_geojson: { type: "Point"; coordinates: [number, number] } | null;
}

// Struktur data untuk halaman Home
export interface HomeRoadSegment {
  streetId: string;
  streetName: string | null;
  reportId: string;
  segmentId: string;
  segmentOrder: number;
  status: "closed" | "open";
  category: string;
  roadPath: LatLng[];
  markerPosition: LatLng;
  startMarkerPosition: LatLng | null;
  endMarkerPosition: LatLng | null;
  tooltipText: string;
}

export async function getHomeRoadSegments(
  category: string = "Semua",
): Promise<HomeRoadSegment[]> {
  const { data, error } = await supabase.rpc(
    "get_home_road_segments",
    {
      // Form laporan menyimpan kategori huruf kecil ("perbaikan"), label UI kapital.
      p_category: category === "Semua" ? null : category.toLowerCase(),
    }
  );

  if (error) {
    console.error("Error mengambil data Home:", error);
    throw error;
  }

  const rows = (data ?? []) as HomeRoadSegmentRow[];

  return rows.map((item) => ({
    streetId: item.street_id,
    streetName: item.street_name,
    reportId: item.report_id,
    segmentId: item.segment_id,
    segmentOrder: item.segment_order,
    status: item.status,
    category: item.category,

    // GeoJSON [longitude, latitude]
    // Diubah menjadi [latitude, longitude]
    roadPath: item.road_geojson.coordinates.map(
      ([lng, lat]): LatLng => [lat, lng]
    ),

    markerPosition: [
      item.marker_geojson.coordinates[1],
      item.marker_geojson.coordinates[0],
    ],
    startMarkerPosition: item.start_marker_geojson
      ? [item.start_marker_geojson.coordinates[1], item.start_marker_geojson.coordinates[0]]
      : null,
    endMarkerPosition: item.end_marker_geojson
      ? [item.end_marker_geojson.coordinates[1], item.end_marker_geojson.coordinates[0]]
      : null,

    tooltipText:
      `${item.street_name ?? "Jalan tanpa nama"} ${
        item.status === "closed"
          ? "sedang ditutup"
          : "sudah dibuka kembali"
      }`,
  }));
}
