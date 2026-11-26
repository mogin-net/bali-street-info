import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, useMap } from "react-leaflet";
import type { RoutePreview } from "@/services/reportService";

type LocationPoint = {
  lat: number;
  lng: number;
};

type MapPreviewProps = {
  startPoint: LocationPoint | null;
  endPoint: LocationPoint | null;
  routePreview?: RoutePreview | null;
  isResolvingRoute?: boolean;
};

const PreviewMapController = ({ startPoint, endPoint, routePreview }: MapPreviewProps) => {
  const map = useMap();

  useEffect(() => {
    if (startPoint && endPoint) {
      // Menampilkan kedua titik sekaligus
      const routePositions = routePreview?.segments.flatMap((segment) =>
        segment.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
      ) ?? [];
      map.fitBounds(
        [
          [startPoint.lat, startPoint.lng],
          [endPoint.lat, endPoint.lng],
          ...routePositions,
        ],
        {
          padding: [30, 30],
          maxZoom: 16,
        },
      );
    } else if (startPoint) {
      map.setView([startPoint.lat, startPoint.lng], 16);
    } else if (endPoint) {
      map.setView([endPoint.lat, endPoint.lng], 16);
    }

    map.invalidateSize();
  }, [map, startPoint, endPoint, routePreview]);

  return null;
};

const MapPreview = ({ startPoint, endPoint, routePreview }: MapPreviewProps) => {
  if (!startPoint || !endPoint) {
    return (
      <div className="report-form__map-placeholder"></div>
    );
  }

  return (
    <div className="report-form__map-preview">
      <MapContainer
        center={[startPoint.lat, startPoint.lng]}
        zoom={15}
        className="report-form__map-canvas"
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <PreviewMapController
          startPoint={startPoint}
          endPoint={endPoint}
          routePreview={routePreview}
        />

        {routePreview?.segments.map((segment) => (
          <Polyline
            key={`${segment.segment_order}-${segment.street_uuid}`}
            positions={segment.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{ className: "report-form__route-line" }}
          />
        ))}

        {/* MARKER TITIK AWAL */}
        <CircleMarker
          center={[startPoint.lat, startPoint.lng]}
          radius={7}
          pathOptions={{
            className: "report-form__start-marker",
          }}
        />

        {routePreview && (
          <>
            <CircleMarker
              center={[routePreview.snapped_start.coordinates[1], routePreview.snapped_start.coordinates[0]]}
              radius={4}
              pathOptions={{ className: "report-form__snapped-start-marker" }}
            />
            <CircleMarker
              center={[routePreview.snapped_end.coordinates[1], routePreview.snapped_end.coordinates[0]]}
              radius={4}
              pathOptions={{ className: "report-form__snapped-end-marker" }}
            />
          </>
        )}

        {/* MARKER TITIK AKHIR */}
        <CircleMarker
          center={[endPoint.lat, endPoint.lng]}
          radius={7}
          pathOptions={{
            className: "report-form__end-marker",
          }}
        />
      </MapContainer>
    </div>
  );
};

export default MapPreview;
