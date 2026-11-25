import type { LocationPoint } from "@/components/report/reportList";
import { supabase } from "@/lib/supabase";
import { ensureAnonymousSession } from "@/services/anonymousSession";

const reportErrorMessages: Record<string, string> = {
  P1001: "Koordinat lokasi tidak valid. Pilih ulang titik awal dan titik akhir.",
  P1002: "Tidak ditemukan jalan dalam radius pencarian. Silakan pilih titik lain.",
  P1003: "Titik terlalu jauh dari jalan. Pilih titik maksimal 5 meter dari garis jalan.",
  P1004: "Jaringan jalan belum memiliki data konektivitas. Impor ulang data OSM terlebih dahulu.",
  P1005: "Tidak ditemukan jalur jalan yang terhubung antara kedua titik.",
  P1006: "Data jalan berubah setelah preview. Periksa kembali jalur sebelum mengirim.",
  P2001: "Sesi anonim belum tersedia. Coba lagi beberapa saat lagi.",
  P2002: "Laporan tidak ditemukan.",
  P2003: "Laporan ini sudah kedaluwarsa dan tidak menerima konfirmasi baru.",
  P2004: "Kamu baru saja vote untuk laporan ini. Coba lagi setelah 30 menit.",
};

export function getReportErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return (
      reportErrorMessages[error.code] ??
      "Permintaan belum dapat diproses. Periksa koneksi lalu coba lagi."
    );
  }

  return "Permintaan belum dapat diproses. Periksa koneksi lalu coba lagi.";
}

interface ReportPayload {
  startPoint: LocationPoint;
  endPoint: LocationPoint;
  category: string;
  isCarForbidden: boolean;
  isMotorcycleForbidden: boolean;
  description: string | null;
  networkVersion: string;
  routeSignature: string;
}

export interface RoutePreview {
  original_start: GeoJSONPoint;
  original_end: GeoJSONPoint;
  snapped_start: GeoJSONPoint;
  snapped_end: GeoJSONPoint;
  start_street_name: string;
  end_street_name: string;
  start_snap_distance_m: number;
  end_snap_distance_m: number;
  start_candidate_count: number;
  end_candidate_count: number;
  start_near_candidate_count: number;
  end_near_candidate_count: number;
  network_version: string;
  route_signature: string;
  route_length_m: number;
  segments: RoutePreviewSegment[];
}

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface RoutePreviewSegment {
  segment_order: number;
  street_uuid: string;
  osm_way_id: number;
  street_name: string | null;
  start_fraction: number;
  end_fraction: number;
  is_reversed: boolean;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
}

export async function resolveStreetRoute(
  startPoint: LocationPoint,
  endPoint: LocationPoint,
): Promise<RoutePreview> {
  const { data, error } = await supabase.rpc("resolve_street_report_route", {
    p_start_lat: startPoint.lat,
    p_start_lng: startPoint.lng,
    p_end_lat: endPoint.lat,
    p_end_lng: endPoint.lng,
  });

  if (error) {
    console.error("Gagal menentukan jalur jalan:", error);
    throw error;
  }

  return data as RoutePreview;
}

export async function submitReport(payload: ReportPayload) {
  await ensureAnonymousSession();

  const { data, error } = await supabase.rpc("submit_street_report", {
    p_start_lat: payload.startPoint.lat,
    p_start_lng: payload.startPoint.lng,
    p_end_lat: payload.endPoint.lat,
    p_end_lng: payload.endPoint.lng,
    p_category: payload.category,
    p_is_car_forbidden: payload.isCarForbidden,
    p_is_motorcycle_forbidden: payload.isMotorcycleForbidden,
    p_description: payload.description?.trim() || null,
    p_network_version: payload.networkVersion,
    p_route_signature: payload.routeSignature,
  });

  if (error) {
    console.error("Gagal menyimpan laporan:", error);
    throw error;
  }

  return data;
}

export async function getNearestStreetName(point: LocationPoint) {
  const { data, error } = await supabase.rpc("get_nearest_street_name", {
    p_lat: point.lat,
    p_lng: point.lng,
  });

  if (error) throw error;

  return data;
}
