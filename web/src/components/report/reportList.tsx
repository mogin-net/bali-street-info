import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getReportErrorMessage, submitReport } from "@/services/reportService";
import { markReportAsked } from "@/lib/askedReports";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";

import {
  MapPin,
  Send,
  CarFront,
  Motorbike,
  RouteIcon,
  Construction,
  Ticket,
  SquareExclamationPoint,
  SportShoe,
  ListPlus,
} from "lucide-react";

import MapPreview from "./mapPreview";
import type { RoutePreview } from "@/services/reportService";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import "./style.css";

export interface LocationPoint {
  lat: number;
  lng: number;
}

interface ReportFormProps {
  startPoint: LocationPoint | null;
  endPoint: LocationPoint | null;
  startStreetName: string | null;
  endStreetName: string | null;
  isResolvingStart: boolean;
  isResolvingEnd: boolean;
  startStreetLookupFailed: boolean;
  endStreetLookupFailed: boolean;
  routePreview: RoutePreview | null;
  isResolvingRoute: boolean;
  routePreviewError: string | null;
  onOpenLocation: (point?: "start" | "end") => void;
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

const ReportList = ({
  startPoint,
  endPoint,
  startStreetName,
  endStreetName,
  isResolvingStart,
  isResolvingEnd,
  startStreetLookupFailed,
  endStreetLookupFailed,
  routePreview,
  isResolvingRoute,
  routePreviewError,
  onOpenLocation,
}: ReportFormProps) => {
  const navigate = useNavigate();

  // STATE POPUP
  const [pendingReport, setPendingReport] = useState<ReportPayload | null>(
    null,
  );

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const successNavigationStarted = useRef(false);

  // STATE PENGIRIMAN
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuccessOpen) return;

    const timer = window.setTimeout(() => {
      if (successNavigationStarted.current) return;

      successNavigationStarted.current = true;
      setIsSuccessOpen(false);
      navigate("/");
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [isSuccessOpen, navigate]);

  const navigateHomeFromSuccess = () => {
    if (!isSuccessOpen || successNavigationStarted.current) return;

    successNavigationStarted.current = true;
    setIsSuccessOpen(false);
    navigate("/");
  };

  const handleSuccessOpenChange = (open: boolean) => {
    if (open) {
      successNavigationStarted.current = false;
      setIsSuccessOpen(true);
      return;
    }

    navigateHomeFromSuccess();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    const form = event.currentTarget;

    // Validasi kategori wajib
    if (!form.reportValidity()) {
      setValidationError("Silakan pilih kategori laporan.");
      return;
    }

    // Validasi lokasi
    if (!startPoint || !endPoint) {
      setValidationError("Silakan pilih lokasi titik awal dan titik akhir.");
      return;
    }

    if (isResolvingStart || isResolvingEnd) {
      setValidationError(
        "Tunggu sampai nama jalan kedua titik selesai diperiksa.",
      );
      return;
    }

    if (startStreetLookupFailed || endStreetLookupFailed) {
      setValidationError(
        "Nama jalan gagal diperiksa. Silakan buka kembali peta dan pilih ulang titik yang bermasalah.",
      );
      return;
    }

    if (isResolvingRoute) {
      setValidationError("Tunggu sampai jalur jalan selesai diperiksa.");
      return;
    }

    if (!routePreview || routePreviewError) {
      setValidationError(
        routePreviewError ?? "Jalur jalan belum berhasil diperiksa. Silakan pilih ulang titik.",
      );
      return;
    }

    const missingStreetPoints = [
      !startStreetName ? "titik awal" : null,
      !endStreetName ? "titik akhir" : null,
    ].filter((point): point is string => point !== null);

    if (missingStreetPoints.length > 0) {
      setValidationError(
        `Nama jalan ${missingStreetPoints.join(" dan ")} tidak ditemukan. Silakan pilih ulang titik tersebut di peta sebelum mengirim laporan.`,
      );
      return;
    }

    // Ambil data formulir
    const formData = new FormData(form);
    const vehicles = formData.getAll("vehicle").map(String);

    // Validasi akses kendaraan
    if (vehicles.length === 0) {
      setValidationError("Silakan pilih minimal satu akses kendaraan.");
      return;
    }

    // Ambil deskripsi (opsional)
    const description = String(formData.get("description") ?? "").trim();

    // Susun data laporan
    const reportData: ReportPayload = {
      startPoint,
      endPoint,
      category: String(formData.get("category")),
      isCarForbidden: vehicles.includes("mobil"),
      isMotorcycleForbidden: vehicles.includes("motor"),
      description: description || null,
      networkVersion: routePreview.network_version,
      routeSignature: routePreview.route_signature,
    };

    // Simpan data sementara
    setPendingReport(reportData);
    setSubmitError(null);

    // Tampilkan popup konfirmasi
    setIsConfirmOpen(true);
  };

  const handleOpenLocation = (point?: "start" | "end") => {
    setValidationError(null);
    onOpenLocation(point);
  };

  const handleConfirmSubmit = async () => {
    if (!pendingReport || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Kirim laporan ke Supabase
      const result = await submitReport(pendingReport);

      console.log("Laporan berhasil disimpan:", result);

      // The reporter is on-site: the nearby card must not ask about their own report.
      if (typeof result === "string") markReportAsked(result);

      // Tutup popup konfirmasi
      setIsConfirmOpen(false);

      // Tampilkan popup laporan diterima
      successNavigationStarted.current = false;
      setIsSuccessOpen(true);
    } catch (error) {
      console.error("Gagal mengirim laporan:", error);

      setSubmitError(getReportErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form
        className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
        onSubmit={handleSubmit}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          {/* MAP PREVIEW */}
          <div className="space-y-2">
            {startPoint && endPoint && (
              <MapPreview
                startPoint={startPoint}
                endPoint={endPoint}
                routePreview={routePreview}
                isResolvingRoute={isResolvingRoute}
              />
            )}
            {routePreview && (
              <p className="text-xs text-gray-500" role="status">
                Titik menempel ke jalan: awal {routePreview.start_snap_distance_m.toFixed(1)} m,
                akhir {routePreview.end_snap_distance_m.toFixed(1)} m. Panjang jalur sekitar {Math.round(routePreview.route_length_m)} m.
              </p>
            )}
            {routePreviewError && (
              <p className="text-xs text-red-600" role="alert">{routePreviewError}</p>
            )}
          </div>

          {/* LOKASI JALAN */}
          <div className="space-y-2">
            <label className="text-xs font-semibold">
              Lokasi Jalan <span className="text-red-500">*</span>
            </label>

            {!(startPoint && endPoint) && (
              <button
                type="button"
                onClick={() => handleOpenLocation()}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border bg-white px-3 text-left hover:bg-gray-50"
              >
                <MapPin className="size-5 shrink-0 text-gray-500" />

                <span className="flex-1 text-xs text-gray-500">
                  Klik untuk pilih lokasi penutupan
                </span>

                <span className="text-xs text-gray-400">◎</span>
              </button>
            )}

            {/* DETAIL TITIK AWAL DAN AKHIR */}
            {startPoint && endPoint && (
              <button
                type="button"
                onClick={() => handleOpenLocation()}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-gray-50"
              >
                <RouteIcon className="flex shrink-0 items-center justify-center" />

                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-xs font-semibold">Titik Awal</p>
                    <p className="break-all text-[11px] text-gray-500">
                      {isResolvingStart
                        ? "Mencari nama jalan..."
                        : startStreetLookupFailed
                          ? "Nama jalan gagal diperiksa"
                          : (startStreetName ?? "Nama jalan tidak ditemukan")}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold">Titik Akhir</p>
                    <p className="break-all text-[11px] text-gray-500">
                      {isResolvingEnd
                        ? "Mencari nama jalan..."
                        : endStreetLookupFailed
                          ? "Nama jalan gagal diperiksa"
                          : (endStreetName ?? "Nama jalan tidak ditemukan")}
                    </p>
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* KATEGORI */}
          <div className="space-y-2">
            <div>
              <label className="text-xs font-semibold">
                Kategori <span className="text-red-500">*</span>
              </label>

              <p className="text-[11px] text-gray-400">
                Pilih penyebab penutupan jalan yang terjadi di lokasi ini.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* PERBAIKAN */}
              <label className="label_category">
                <input
                  type="radio"
                  name="category"
                  value="perbaikan"
                  required
                  className="sr-only"
                />

                <Construction className="size-6 shrink-0" />

                <span>
                  <span className="block text-xs font-semibold">Perbaikan</span>
                </span>
              </label>

              {/* UPACARA */}
              <label className="label_category">
                <input
                  type="radio"
                  name="category"
                  value="upacara"
                  className="sr-only"
                />

                <Ticket className="size-6 shrink-0" />

                <span>
                  <span className="block text-xs font-semibold">Upacara</span>
                </span>
              </label>

              {/* BENCANA */}
              <label className="label_category">
                <input
                  type="radio"
                  name="category"
                  value="bencana"
                  className="sr-only"
                />

                <SquareExclamationPoint className="size-6 shrink-0" />

                <span>
                  <span className="block text-xs font-semibold">Bencana</span>
                </span>
              </label>

              {/* EVENT */}
              <label className="label_category">
                <input
                  type="radio"
                  name="category"
                  value="event"
                  className="sr-only"
                />

                <SportShoe className="size-6 shrink-0" />

                <span>
                  <span className="block text-xs font-semibold">Event</span>
                </span>
              </label>

              {/* LAINNYA */}
              <label className="label_category col-span-2 mx-auto w-1/2 justify-center">
                <input
                  type="radio"
                  name="category"
                  value="lainnya"
                  className="sr-only"
                />

                <ListPlus className="size-6 shrink-0" />

                <span>
                  <span className="block text-xs font-semibold">Lainnya</span>
                </span>
              </label>
            </div>
          </div>

          {/* AKSES KENDARAAN */}
          <div className="space-y-2">
            <div>
              <label className="text-xs font-semibold">
                Akses Kendaraan <span className="text-red-500">*</span>
              </label>

              <p className="text-[11px] text-gray-400">
                Pilih kendaraan yang tidak dapat melewati jalan ini.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* MOBIL */}
              <label className="label_accessibility_vehicle">
                <input
                  type="checkbox"
                  name="vehicle"
                  value="mobil"
                  defaultChecked
                  className="size-4 accent-black"
                />

                <CarFront className="size-6 shrink-0" />

                <span>
                  <span className="block text-xs font-semibold">Mobil</span>

                  <span className="block text-[10px] text-gray-500">
                    Dilarang lewat
                  </span>
                </span>
              </label>

              {/* MOTOR */}
              <label className="label_accessibility_vehicle">
                <input
                  type="checkbox"
                  name="vehicle"
                  value="motor"
                  defaultChecked
                  className="size-4 accent-black"
                />

                <Motorbike className="size-6 shrink-0" />

                <span>
                  <span className="block text-xs font-semibold">Motor</span>

                  <span className="block text-[10px] text-gray-500">
                    Dilarang lewat
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* DESKRIPSI OPSIONAL */}
          <div className="space-y-2">
            <label className="text-xs font-semibold">Deskripsi Masalah</label>

            <Textarea
              name="description"
              placeholder="Tulis deskripsi masalah dengan singkat dan jelas..."
              maxLength={280}
              className="min-h-28 resize-none"
            />
          </div>
        </div>

        {/* TOMBOL KIRIM */}
        <div className="shrink-0 border-t bg-white p-4">
          {validationError && (
            <p className="mb-3 text-xs text-red-600" role="alert">
              {validationError}
            </p>
          )}
          <Button type="submit" className="h-11 w-full rounded-xl">
            <Send className="mr-2 size-4" />
            Kirim Laporan
          </Button>
        </div>
      </form>

      {/* POPUP KONFIRMASI */}
      <Dialog
        open={isConfirmOpen}
        disablePointerDismissal
        onOpenChange={(open) => {
          if (open) setIsConfirmOpen(true);
        }}
      >
        <DialogContent
          className="max-w-sm rounded-xl p-4"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Apakah anda sudah yakin?
            </DialogTitle>

            <DialogDescription className="text-xs leading-relaxed">
              Pastikan seluruh informasi laporan yang Anda masukkan sudah benar
              sebelum mengirim laporan.
            </DialogDescription>
            {submitError && (
              <p className="text-xs text-red-600" role="alert">
                {submitError}
              </p>
            )}
          </DialogHeader>

          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
            >
              Tidak
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Mengirim..." : "Iya"}
            </Button>{" "}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* POPUP LAPORAN DITERIMA */}
      <Dialog open={isSuccessOpen} onOpenChange={handleSuccessOpenChange}>
        <DialogContent
          className="max-w-sm rounded-xl"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="text-center text-base font-semibold">
              Laporan diterima
            </DialogTitle>

            <DialogDescription className="text-center text-xs leading-relaxed">
              Terima kasih telah mengisi informasi penutupan jalan.
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            aria-label="Kembali ke Homepage"
            onClick={navigateHomeFromSuccess}
            className="absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportList;
