import type { LocationPoint } from "@/components/report/reportList";
import { supabase } from "@/lib/supabase";
import { ensureAnonymousSession } from "@/services/anonymousSession";

const reportErrorMessages: Record<string, string> = {
  P1001: "Koordinat lokasi tidak valid. Pilih ulang titik awal dan titik akhir.",
  P1002: "Jalan tidak ditemukan di sekitar titik yang dipilih. Silakan pilih ulang lokasi.",
  P2001: "Sesi anonim belum tersedia. Coba lagi beberapa saat lagi.",
  P2002: "Laporan tidak ditemukan.",
  P2003: "Laporan ini sudah kedaluwarsa dan tidak menerima konfirmasi baru.",
  P2004: "Anda sudah mengirim konfirmasi untuk laporan ini.",
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
