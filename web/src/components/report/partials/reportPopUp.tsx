import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { LocateFixed, X } from "lucide-react";
import {
  divIcon,
  type LeafletMouseEvent,
  type LatLngExpression,
} from "leaflet";

import { Button } from "../../ui/button";
import type { LocationPoint } from "../reportList";

interface ReportPopUpProps {
  startPoint: LocationPoint | null;
  endPoint: LocationPoint | null;
  activePoint: "start" | "end";
  onChangeActive: (point: "start" | "end") => void;
  onChangeStart: (point: LocationPoint) => void;
  onChangeEnd: (point: LocationPoint) => void;
  onReset: () => void;
  onSave: () => void;
  onClose: () => void;
}

const sanurCenter: LatLngExpression = [-8.6925, 115.263];

// Membuat ikon pin lokasi
const createPinIcon = (color: string) =>
  divIcon({
    className: "",
    html: `
      <div style="
        width: 32px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35));
      ">
        <svg
          width="32"
          height="42"
          viewBox="0 0 32 42"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M16 1C7.7 1 1 7.7 1 16c0 11 15 25 15 25s15-14 15-25C31 7.7 24.3 1 16 1Z"
            fill="${color}"
            stroke="white"
            stroke-width="2"
          />
          <circle cx="16" cy="16" r="5" fill="white" />
        </svg>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  });

const startPinIcon = createPinIcon("#171717");
const endPinIcon = createPinIcon("#DC2626");

// Menangani klik pada peta
const MapClickHandler = ({
  activePoint,
  onChangeStart,
  onChangeEnd,
}: Pick<ReportPopUpProps, "activePoint" | "onChangeStart" | "onChangeEnd">) => {
  useMapEvents({
    click: (event: LeafletMouseEvent) => {
      const point: LocationPoint = {
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      };

      if (activePoint === "start") {
        onChangeStart(point);
      } else {
        onChangeEnd(point);
      }
    },
  });

  return null;
};

// Memperbarui ukuran peta ketika popup ditampilkan
const MapResizeHandler = () => {
  const map = useMap();

  useEffect(() => {
    const resizeMap = () => {
      map.invalidateSize({ pan: false });
    };

    const timeout = window.setTimeout(resizeMap, 250);

    const observer = new ResizeObserver(() => {
      resizeMap();
    });

    observer.observe(map.getContainer());

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, [map]);

  return null;
};

// Mengarahkan peta ke titik yang sedang dipilih
const MapViewportHandler = ({ point }: { point: LocationPoint | null }) => {
  const map = useMap();

  useEffect(() => {
    if (!point) return;

    map.setView([point.lat, point.lng], Math.max(map.getZoom(), 15), {
      animate: true,
    });
  }, [map, point?.lat, point?.lng]);

  return null;
};

const ReportPopUp = ({
  startPoint,
  endPoint,
  activePoint,
  onChangeActive,
  onChangeStart,
  onChangeEnd,
  onReset,
  onSave,
  onClose,
}: ReportPopUpProps) => {
  const locateMe = () => {
    if (!navigator.geolocation) {
      alert("Browser tidak mendukung lokasi perangkat.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChangeStart({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        onChangeActive("start");
      },
      () => {
        alert("Lokasi tidak dapat diakses. Silakan pilih titik secara manual.");
      },
    );
  };

  const activeLocation = activePoint === "start" ? startPoint : endPoint;

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col justify-end bg-black/50">
      <section className="flex h-[82dvh] flex-col overflow-hidden rounded-t-3xl bg-white">
        {/* HEADER POPUP */}
        <div className="relative shrink-0 px-5 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-gray-300" />

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Pilih Lokasi Penutupan Jalan
            </h2>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label="Tutup"
            >
              <X className="size-5" />
            </Button>
          </div>

          <p className="text-[11px] text-gray-500">
            Pilih titik awal dan titik akhir pada peta.
          </p>
        </div>

        {/* PETA */}
        <div className="relative min-h-0 flex-1">
          <MapContainer
            center={sanurCenter}
            zoom={15}
            className="h-full w-full"
            zoomControl
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapResizeHandler />

            <MapViewportHandler point={activeLocation} />

            <MapClickHandler
              activePoint={activePoint}
              onChangeStart={onChangeStart}
              onChangeEnd={onChangeEnd}
            />

            {startPoint && (
              <Marker
                position={[startPoint.lat, startPoint.lng]}
                icon={startPinIcon}
                zIndexOffset={1000}
              />
            )}

            {endPoint && (
              <Marker
                position={[endPoint.lat, endPoint.lng]}
                icon={endPinIcon}
                zIndexOffset={1000}
              />
            )}
          </MapContainer>

          {/* TOMBOL LOKASI SAYA */}
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute bottom-4 right-4 z-[1000] rounded-full bg-white shadow-md"
            onClick={locateMe}
            aria-label="Gunakan lokasi saya"
          >
            <LocateFixed className="size-5" />
          </Button>
        </div>

        {/* PILIH TITIK */}
        <div className="shrink-0 space-y-3 bg-white p-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={activePoint === "start" ? "default" : "outline"}
              className="h-10 text-xs"
              onClick={() => onChangeActive("start")}
            >
              Titik Awal
            </Button>

            <Button
              type="button"
              variant={activePoint === "end" ? "default" : "outline"}
              className="h-10 text-xs"
              onClick={() => onChangeActive("end")}
            >
              Titik Akhir
            </Button>
          </div>

          <div className="space-y-2 text-xs">
            {/* DETAIL TITIK AWAL */}
            <div className="flex items-center gap-3">
              <span className="size-3 rounded-full bg-black" />

              <div className="min-w-0">
                <p className="font-semibold">Titik Awal</p>

                <p className="truncate text-[10px] text-gray-500">
                  {startPoint
                    ? `${startPoint.lat.toFixed(5)}, ${startPoint.lng.toFixed(5)}`
                    : "Belum dipilih"}
                </p>
              </div>
            </div>

            {/* DETAIL TITIK AKHIR */}
            <div className="flex items-center gap-3">
              <span className="size-3 rounded-full bg-red-600" />

              <div className="min-w-0">
                <p className="font-semibold">Titik Akhir</p>

                <p className="truncate text-[10px] text-gray-500">
                  {endPoint
                    ? `${endPoint.lat.toFixed(5)}, ${endPoint.lng.toFixed(5)}`
                    : "Belum dipilih"}
                </p>
              </div>
            </div>
          </div>

          {/* TOMBOL AKSI */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={onReset}
            >
              Reset
            </Button>

            <Button
              type="button"
              className="h-11"
              disabled={!startPoint || !endPoint}
              onClick={onSave}
            >
              Simpan Lokasi
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ReportPopUp;
