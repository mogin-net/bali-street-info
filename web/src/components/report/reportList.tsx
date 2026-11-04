import { MapPin, Send, CarFront, Motorbike } from "lucide-react";
import MapPreview from "./mapPreview";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

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

const ReportForm = ({
  startPoint,
  endPoint,
  onOpenLocation,
}: ReportFormProps) => {
  return (
    <form
      className="flex flex-1 flex-col gap-5 overflow-y-auto bg-white p-4"
      onSubmit={(event) => event.preventDefault()}
    >
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

        <button
          type="button"
          onClick={() => onOpenLocation("start")}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border bg-white px-3 text-left hover:bg-gray-50"
        >
          <MapPin className="size-5 shrink-0 text-gray-500" />

          <span className="flex-1 text-xs text-gray-500">
            {startPoint && endPoint
              ? "Lokasi penutupan sudah dipilih"
              : "Klik untuk pilih lokasi penutupan"}
          </span>

          <span className="text-xs text-gray-400">◎</span>
        </button>

        {/* DETAIL TITIK AWAL DAN AKHIR */}
        {startPoint && endPoint && (
          <button
            type="button"
            onClick={() => onOpenLocation()}
            className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-gray-50"
          >
            {/* SVG INDIKATOR LOKASI */}
            <div className="flex shrink-0 items-center justify-center">
              <svg
                width="23"
                height="20"
                viewBox="0 0 23 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6.58131 15.6812C6.58131 17.2368 5.32025 18.4978 3.76466 18.4978C2.20906 18.4978 0.947998 17.2368 0.947998 15.6812C0.947998 14.1256 2.20906 12.8645 3.76466 12.8645C5.32025 12.8645 6.58131 14.1256 6.58131 15.6812Z"
                  strokeWidth="1.89583"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  stroke="#202020"
                />
                <path
                  d="M21.7478 3.76456C21.7478 5.32016 20.4868 6.58122 18.9312 6.58122C17.3756 6.58122 16.1145 5.32016 16.1145 3.76456C16.1145 2.20897 17.3756 0.947906 18.9312 0.947906C20.4868 0.947906 21.7478 2.20897 21.7478 3.76456Z"
                  strokeWidth="1.89583"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  stroke="#202020"
                />
                <path
                  d="M6.36475 14.0562L16.223 5.38956"
                  strokeWidth="1.89583"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  stroke="#202020"
                />
              </svg>
            </div>

            {/* INFORMASI TITIK */}
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
        <label className="text-xs font-semibold">
          Kategori <span className="text-red-500">*</span>
        </label>

        <Select>
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Pilih Kategori" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="perbaikan">Perbaikan</SelectItem>

            <SelectItem value="upacara">Upacara</SelectItem>

            <SelectItem value="bencana">Bencana</SelectItem>

            <SelectItem value="lainnya">Lainnya</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* AKSES KENDARAAN */}
      <div className="space-y-2">
        <div>
          <label className="text-xs font-semibold">Akses Kendaraan</label>

          <p className="text-[11px] text-gray-400">
            Pilih kendaraan yang tidak dapat melewati jalan ini.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* MOBIL */}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 has-[:checked]:border-black has-[:checked]:bg-gray-50">
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
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 has-[:checked]:border-black has-[:checked]:bg-gray-50">
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

      {/* DESKRIPSI */}
      <div className="space-y-2">
        <label className="text-xs font-semibold">Deskripsi Masalah</label>

        <Textarea
          placeholder="Tulis deskripsi masalah dengan singkat dan jelas..."
          maxLength={280}
          className="min-h-28 resize-none"
        />
      </div>

      {/* TOMBOL KIRIM */}
      <Button type="submit" className="h-11 w-full rounded-xl">
        <Send className="mr-2 size-4" />
        Kirim Laporan
      </Button>
    </form>
  );
};

export default ReportForm;
