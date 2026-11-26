import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { LocateFixed, RefreshCcw, X } from "lucide-react";
import {
  divIcon,
  type LeafletMouseEvent,
  type LatLngExpression,
} from "leaflet";

import { Button } from "../../ui/button";
import type { LocationPoint } from "../reportList";
import "./reportPopup.css";
// import { isInsideSanur } from "../sanurBonds";

interface ReportPopUpProps {
  startPoint: LocationPoint | null;
  endPoint: LocationPoint | null;
  startStreetName: string | null;
  endStreetName: string | null;
  isResolvingStart: boolean;
  isResolvingEnd: boolean;
  startStreetLookupFailed: boolean;
  endStreetLookupFailed: boolean;
  activePoint: "start" | "end";
  onChangeActive: (point: "start" | "end") => void;
  onChangeStart: (point: LocationPoint | null) => void;
  onChangeEnd: (point: LocationPoint | null) => void;
  onReset: () => void;
  onSave: () => void;
  onClose: () => void;
}

const sanurCenter: LatLngExpression = [-8.6925, 115.263];

// Membuat ikon pin lokasi
const createPinIcon = (point: "start" | "end") =>
  divIcon({
    className: "",
    html: `
      <div class="report-popup__pin report-popup__pin--${point}">
        <svg
          width="32"
          height="42"
          viewBox="0 0 32 42"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M16 1C7.7 1 1 7.7 1 16c0 11 15 25 15 25s15-14 15-25C31 7.7 24.3 1 16 1Z"
            class="report-popup__pin-shape"
          />
          <circle class="report-popup__pin-center" cx="16" cy="16" r="5" />
        </svg>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  });

const startPinIcon = createPinIcon("start");
const endPinIcon = createPinIcon("end");

// Menangani klik pada peta
const MapClickHandler = ({
  activePoint,
  onChangeStart,
  onChangeEnd,
  onSelectPoint,
}: Pick<ReportPopUpProps, "activePoint" | "onChangeStart" | "onChangeEnd"> & {
  onSelectPoint: () => void;
}) => {
  useMapEvents({
    click: (event: LeafletMouseEvent) => {
      const point: LocationPoint = {
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      };

      // Batasan Sanur dinonaktifkan: if (!isInsideSanur(point)) return;

      if (activePoint === "start") {
        onChangeStart(point);
      } else {
        onChangeEnd(point);
      }

      onSelectPoint();
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
  startStreetName,
  endStreetName,
  isResolvingStart,
  isResolvingEnd,
  startStreetLookupFailed,
  endStreetLookupFailed,
  activePoint,
  onChangeActive,
  onChangeStart,
  onChangeEnd,
  onReset,
  onSave,
  onClose,
}: ReportPopUpProps) => {
  const [isInitialView, setIsInitialView] = useState(true);
  const initialLocationRequested = useRef(false);

  useEffect(() => {
    if (
      startPoint ||
      initialLocationRequested.current ||
      !navigator.geolocation
    ) {
      return;
    }

    initialLocationRequested.current = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: LocationPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        // Batasan Sanur dinonaktifkan: if (!isInsideSanur(point)) return;

        onChangeStart(point);
      },
      () => {
        // Pengguna tetap dapat memilih titik secara manual.
      },
    );
  }, [startPoint, onChangeStart]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      alert("Browser tidak mendukung lokasi perangkat.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: LocationPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        // Batasan Sanur dinonaktifkan: if (!isInsideSanur(point)) return;
        onChangeStart(point);
        onChangeActive("start");
      },
      () => {
        alert("Lokasi tidak dapat diakses. Silakan pilih titik secara manual.");
      },
    );
  };

  const activeLocation = activePoint === "start" ? startPoint : endPoint;
  const viewportLocation = isInitialView ? startPoint : activeLocation;

  return (
    <div className="report-popup report-popup__overlay">
      <section className="report-popup__panel report-popup__surface">
        {/* HEADER POPUP */}
        <div className="report-popup__header">
          <div className="report-popup__drag-handle" />

          <div className="report-popup__header-content">
            <h2 className="report-popup__title">
              Pilih Lokasi Penutupan Jalan
            </h2>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label="Tutup"
            >
              <X className="report-popup__icon" />
            </Button>
          </div>

          <p className="report-popup__instructions">
            Pilih titik awal dan titik akhir pada peta.
          </p>
        </div>

        {/* PETA */}
        <div className="report-popup__map-container">
          <MapContainer
            center={sanurCenter}
            zoom={15}
            className="report-popup__map-canvas"
            zoomControl
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapResizeHandler />

            <MapViewportHandler point={viewportLocation} />

            <MapClickHandler
              activePoint={activePoint}
              onChangeStart={onChangeStart}
              onChangeEnd={onChangeEnd}
              onSelectPoint={() => {
                setIsInitialView(false);
              }}
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
            className="report-popup__gps-button"
            onClick={locateMe}
            aria-label="Gunakan lokasi saya"
          >
            <LocateFixed className="report-popup__icon" />
          </Button>
        </div>

        {/* PILIH TITIK */}
        <div className="report-popup__controls">
          <div className="report-popup__point-selector">
            <Button
              type="button"
              variant={activePoint === "start" ? "default" : "outline"}
              className="report-popup__point-selector-button"
              onClick={() => {
                setIsInitialView(false);
                onChangeActive("start");
              }}
            >
              Titik Awal
            </Button>

            <Button
              type="button"
              variant={activePoint === "end" ? "default" : "outline"}
              className="report-popup__point-selector-button"
              onClick={() => {
                setIsInitialView(false);
                onChangeActive("end");
              }}
            >
              Titik Akhir
            </Button>
          </div>

          <div className="report-popup__point-details">
            {/* DETAIL TITIK AWAL */}
            <div className="report-popup__point-row">
              <span className="report-popup__start-marker" />

              <div className="report-popup__point-copy">
                <p className="report-popup__point-title">Titik Awal</p>

                <p className="report-popup__street-name">
                  {startPoint
                    ? isResolvingStart
                      ? "Mencari nama jalan..."
                      : startStreetLookupFailed
                        ? "Nama jalan gagal diperiksa"
                        : (startStreetName ?? "Nama jalan tidak ditemukan")
                    : "Belum dipilih"}
                </p>
                {startPoint &&
                  !isResolvingStart &&
                  !startStreetLookupFailed &&
                  !startStreetName && (
                    <p
                      className="report-popup__lookup-warning"
                      role="status"
                    >
                      Nama jalan tidak ditemukan/berada di luar batas daerah.
                      Geser titik ke ruas jalan yang benar.
                    </p>
                  )}
                {startPoint && startStreetLookupFailed && (
                  <p className="report-popup__lookup-warning" role="status">
                    Nama jalan gagal didapat. Silahkan pilih ulang titik ini.
                  </p>
                )}
              </div>
            </div>

            {/* DETAIL TITIK AKHIR */}
            <div className="report-popup__point-row">
              <span className="report-popup__end-marker" />

              <div className="report-popup__point-copy">
                <p className="report-popup__point-title">Titik Akhir</p>

                <p className="report-popup__street-name">
                  {endPoint
                    ? isResolvingEnd
                      ? "Mencari nama jalan..."
                      : endStreetLookupFailed
                        ? "Nama jalan gagal diperiksa"
                        : (endStreetName ?? "Nama jalan tidak ditemukan")
                    : "Belum dipilih"}
                </p>
                {endPoint &&
                  !isResolvingEnd &&
                  !endStreetLookupFailed &&
                  !endStreetName && (
                    <p
                      className="report-popup__lookup-warning"
                      role="status"
                    >
                      Nama jalan tidak ditemukan/berada di luar batas daerah.
                      Geser titik ke ruas jalan yang benar.{" "}
                    </p>
                  )}
                {endPoint && endStreetLookupFailed && (
                  <p className="report-popup__lookup-warning" role="status">
                    Nama jalan gagal didapat. Silahkan pilih Nama jalan gagal
                    diperiksa. Silahkan pilih ulang titik ini. ulang titik ini.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* TOMBOL AKSI */}
          <div className="report-popup__point-selector">
            <Button
              type="button"
              variant="outline"
              className="report-popup__action-button"
              onClick={onReset}
            >
              <RefreshCcw className="report-popup__icon" />
              Reset
            </Button>

            <Button
              type="button"
              className="report-popup__action-button"
              disabled={
                !startPoint ||
                !endPoint ||
                isResolvingStart ||
                isResolvingEnd ||
                startStreetLookupFailed ||
                endStreetLookupFailed ||
                !startStreetName ||
                !endStreetName
              }
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
