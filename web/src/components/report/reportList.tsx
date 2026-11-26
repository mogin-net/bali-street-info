import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getReportErrorMessage, submitReport } from "@/services/reportService";

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
import "./report.css";

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
        routePreviewError ??
          "Jalur jalan belum berhasil diperiksa. Silakan pilih ulang titik.",
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
        className="report-form report-form__surface"
        onSubmit={handleSubmit}
      >
        <div className="report-form__content report-form__scroll-content">
          {/* MAP PREVIEW */}
          <div className="report-form__section">
            {startPoint && endPoint && (
              <MapPreview
                startPoint={startPoint}
                endPoint={endPoint}
                routePreview={routePreview}
                isResolvingRoute={isResolvingRoute}
              />
            )}
            {routePreview && (
              <p className="report-form__status-note" role="status">
                Titik menempel ke jalan: awal{" "}
                {routePreview.start_snap_distance_m.toFixed(1)} m, akhir{" "}
                {routePreview.end_snap_distance_m.toFixed(1)} m. Panjang jalur
                sekitar {Math.round(routePreview.route_length_m)} m.
              </p>
            )}
            {routePreviewError && (
              <p className="report-form__error-note" role="alert">
                {routePreviewError}
              </p>
            )}
          </div>

          {/* LOKASI JALAN */}
          <div className="report-form__section">
            <label className="report-form__section-label">
              Lokasi Jalan <span className="report-form__required-mark">*</span>
            </label>

            {!(startPoint && endPoint) && (
              <button
                type="button"
                onClick={() => handleOpenLocation()}
                className="report-form__location-picker"
              >
                <MapPin className="report-form__location-icon" />

                <span className="report-form__location-picker-copy">
                  Klik untuk pilih lokasi penutupan
                </span>

                <span className="report-form__location-picker-indicator">
                  ◎
                </span>
              </button>
            )}

            {/* DETAIL TITIK AWAL DAN AKHIR */}
            {startPoint && endPoint && (
              <button
                type="button"
                onClick={() => handleOpenLocation()}
                className="report-form__selected-route"
              >
                <RouteIcon className="report-form__route-icon" />

                <div className="report-form__route-details">
                  <div>
                    <p className="report-form__section-label">Titik Awal</p>
                    <p className="report-form__street-name">
                      {isResolvingStart
                        ? "Mencari nama jalan..."
                        : startStreetLookupFailed
                          ? "Nama jalan gagal diperiksa"
                          : (startStreetName ?? "Nama jalan tidak ditemukan")}
                    </p>
                  </div>

                  <div>
                    <p className="report-form__section-label">Titik Akhir</p>
                    <p className="report-form__street-name">
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
          <div className="report-form__section">
            <div>
              <label className="report-form__section-label">
                Kategori <span className="report-form__required-mark">*</span>
              </label>

              <p className="report-form__section-hint">
                Pilih penyebab penutupan jalan yang terjadi di lokasi ini.
              </p>
            </div>

            <div className="report-form__option-grid">
              {/* PERBAIKAN */}
              <label className="report-form__category-option">
                <input
                  type="radio"
                  name="category"
                  value="perbaikan"
                  required
                  className="report-form__visually-hidden"
                />

                <Construction className="report-form__option-icon" />

                <span>
                  <span className="report-form__option-label">Perbaikan</span>
                </span>
              </label>

              {/* UPACARA */}
              <label className="report-form__category-option">
                <input
                  type="radio"
                  name="category"
                  value="upacara"
                  className="report-form__visually-hidden"
                />

                <Ticket className="report-form__option-icon" />

                <span>
                  <span className="report-form__option-label">Upacara</span>
                </span>
              </label>

              {/* BENCANA */}
              <label className="report-form__category-option">
                <input
                  type="radio"
                  name="category"
                  value="bencana"
                  className="report-form__visually-hidden"
                />

                <SquareExclamationPoint className="report-form__option-icon" />

                <span>
                  <span className="report-form__option-label">Bencana</span>
                </span>
              </label>

              {/* EVENT */}
              <label className="report-form__category-option">
                <input
                  type="radio"
                  name="category"
                  value="event"
                  className="report-form__visually-hidden"
                />

                <SportShoe className="report-form__option-icon" />

                <span>
                  <span className="report-form__option-label">Event</span>
                </span>
              </label>

              {/* LAINNYA */}
              <label className="report-form__category-option report-form__category-option--other">
                <input
                  type="radio"
                  name="category"
                  value="lainnya"
                  className="report-form__visually-hidden"
                />

                <ListPlus className="report-form__option-icon" />

                <span>
                  <span className="report-form__option-label">Lainnya</span>
                </span>
              </label>
            </div>
          </div>

          {/* AKSES KENDARAAN */}
          <div className="report-form__section">
            <div>
              <label className="report-form__section-label">
                Akses Kendaraan{" "}
                <span className="report-form__required-mark">*</span>
              </label>

              <p className="report-form__section-hint">
                Pilih kendaraan yang tidak dapat melewati jalan ini.
              </p>
            </div>

            <div className="report-form__option-grid">
              {/* MOBIL */}
              <label className="report-form__vehicle-option">
                <input
                  type="checkbox"
                  name="vehicle"
                  value="mobil"
                  defaultChecked
                  className="report-form__vehicle-checkbox"
                />

                <CarFront className="report-form__option-icon" />

                <span>
                  <span className="report-form__option-label">Mobil</span>

                  <span className="report-form__vehicle-hint">
                    Dilarang lewat
                  </span>
                </span>
              </label>

              {/* MOTOR */}
              <label className="report-form__vehicle-option">
                <input
                  type="checkbox"
                  name="vehicle"
                  value="motor"
                  defaultChecked
                  className="report-form__vehicle-checkbox"
                />

                <Motorbike className="report-form__option-icon" />

                <span>
                  <span className="report-form__option-label">Motor</span>

                  <span className="report-form__vehicle-hint">
                    Dilarang lewat
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* DESKRIPSI OPSIONAL */}
          <div className="report-form__section">
            <label className="report-form__section-label">
              Deskripsi Masalah
            </label>

            <Textarea
              name="description"
              placeholder="Tulis deskripsi masalah dengan singkat dan jelas..."
              maxLength={280}
              className="report-form__description-input"
            />
          </div>
        </div>

        {/* TOMBOL KIRIM */}
        <div className="report-form__submit-footer">
          {validationError && (
            <p className="report-form__validation-error" role="alert">
              {validationError}
            </p>
          )}
          <Button type="submit" className="report-form__submit-button">
            <Send className="report-form__submit-icon" />
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
          className="report-form__confirmation-dialog"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="report-form__dialog-title">
              Apakah anda sudah yakin?
            </DialogTitle>

            <DialogDescription className="report-form__dialog-description">
              Pastikan seluruh informasi laporan yang Anda masukkan sudah benar
              sebelum mengirim laporan.
            </DialogDescription>
            {submitError && (
              <p className="report-form__error-note" role="alert">
                {submitError}
              </p>
            )}
          </DialogHeader>

          <DialogFooter className="report-form__dialog-actions">
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
          className="report-form__success-dialog"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="report-form__success-title">
              Laporan diterima
            </DialogTitle>

            <DialogDescription className="report-form__success-description">
              Terima kasih telah mengisi informasi penutupan jalan.
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            aria-label="Kembali ke Homepage"
            onClick={navigateHomeFromSuccess}
            className="report-form__success-overlay-button"
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportList;
