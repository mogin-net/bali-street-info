
import { supabase } from "../lib/supabase";

type LatLng = [number, number];

// Struktur data dari PostgreSQL RPC
interface HomeRoadSegmentRow {
  street_id: string;
  street_name: string | null;
  report_id: string;
  segment_id: string;
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
}

// Struktur data untuk halaman Home
export interface HomeRoadSegment {
  streetId: string;
  streetName: string | null;
  reportId: string;
  segmentId: string;
  status: "closed" | "open";
  category: string;
  roadPath: LatLng[];
  markerPosition: LatLng;
  tooltipText: string;
}

export async function getHomeRoadSegments(
  category: string = "Semua",
): Promise<HomeRoadSegment[]> {

  const { data, error } = await supabase.rpc(
    "get_home_road_segments",
    {
      p_category:
        category === "Semua" ? null : category,
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

    tooltipText:
      `${item.street_name ?? "Jalan tanpa nama"} ${
        item.status === "closed"
          ? "sedang ditutup"
          : "sudah dibuka kembali"
      }`,
  }));
}

export interface HomeStreetSearchResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

export async function searchHomeStreets(
  query: string,
): Promise<HomeStreetSearchResult[]> {
  const { data, error } = await supabase.rpc("search_home_streets", {
    p_query: query.trim(),
  });

  if (error) throw error;
  return (data ?? []) as HomeStreetSearchResult[];
}
