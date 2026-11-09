import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

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
  onOpenLocation: (point?: "start" | "end") => void;
}

const formatCoordinate = (point: LocationPoint) =>
  `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;

const ReportList = ({
  startPoint,
  endPoint,
  onOpenLocation,
}: ReportFormProps) => {
  const navigate = useNavigate();

  // STATE POPUP
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  // REDIRECT KE HOMEPAGE SETELAH NOTIFIKASI
  useEffect(() => {
    if (!isSuccessOpen) return;

    const timer = window.setTimeout(() => {
      navigate("/");
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [isSuccessOpen, navigate]);

  // VALIDASI FORM
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;

    // Validasi kategori wajib
    if (!form.reportValidity()) return;

    // Validasi lokasi
    if (!startPoint || !endPoint) {
      alert("Silakan pilih lokasi titik awal dan titik akhir.");
      return;
    }

    // Validasi akses kendaraan
    const formData = new FormData(form);
    const vehicles = formData.getAll("vehicle");

    if (vehicles.length === 0) {
      alert("Silakan pilih minimal satu akses kendaraan.");
      return;
    }

    // Semua validasi berhasil
    setIsConfirmOpen(true);
  };

  // KONFIRMASI PENGIRIMAN
  const handleConfirmSubmit = () => {
    setIsConfirmOpen(false);

    // TODO: Proses pengiriman laporan ke database
    console.log("Laporan dikonfirmasi");

    // Tampilkan notifikasi berhasil
    setIsSuccessOpen(true);
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
              <MapPreview startPoint={startPoint} endPoint={endPoint} />
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
                onClick={() => onOpenLocation()}
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
                onClick={() => onOpenLocation()}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-gray-50"
              >
                <RouteIcon className="flex shrink-0 items-center justify-center" />

                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-xs font-semibold">Titik Awal</p>
                    <p className="break-all text-[11px] text-gray-500">
                      {formatCoordinate(startPoint)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold">Titik Akhir</p>
                    <p className="break-all text-[11px] text-gray-500">
                      {formatCoordinate(endPoint)}
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
          <Button type="submit" className="h-11 w-full rounded-xl">
            <Send className="mr-2 size-4" />
            Kirim Laporan
          </Button>
        </div>
      </form>

      {/* POPUP KONFIRMASI */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Apakah anda sudah yakin?
            </DialogTitle>

            <DialogDescription className="text-xs leading-relaxed">
              Pastikan seluruh informasi laporan yang Anda masukkan sudah benar
              sebelum mengirim laporan.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
            >
              Tidak
            </Button>

            <Button type="button" onClick={handleConfirmSubmit}>
              Iya
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* POPUP LAPORAN DITERIMA */}
      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogContent className="max-w-sm rounded-xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-center text-base font-semibold">
              Laporan diterima
            </DialogTitle>

            <DialogDescription className="text-center text-xs leading-relaxed">
              Terima kasih telah berkontribusi memberikan informasi penutupan
              jalan.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportList;
