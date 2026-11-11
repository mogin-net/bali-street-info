import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";

type LocationPoint = {
  lat: number;
  lng: number;
};

type MapPreviewProps = {
  startPoint: LocationPoint | null;
  endPoint: LocationPoint | null;
};

const PreviewMapController = ({ startPoint, endPoint }: MapPreviewProps) => {
  const map = useMap();

  useEffect(() => {
    if (startPoint && endPoint) {
      // Menampilkan kedua titik sekaligus
      map.fitBounds(
        [
          [startPoint.lat, startPoint.lng],
          [endPoint.lat, endPoint.lng],
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
  }, [map, startPoint, endPoint]);

  return null;
};

const mapPreview = ({ startPoint, endPoint }: MapPreviewProps) => {
  if (!startPoint || !endPoint) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border bg-gray-50 text-sm text-gray-400"></div>
    );
  }

  return (
    <div className="h-40 w-full overflow-hidden rounded-xl border">
      <MapContainer
        center={[startPoint.lat, startPoint.lng]}
        zoom={15}
        className="h-full w-full"
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

        <PreviewMapController startPoint={startPoint} endPoint={endPoint} />

        {/* MARKER TITIK AWAL */}
        <CircleMarker
          center={[startPoint.lat, startPoint.lng]}
          radius={7}
          pathOptions={{
            color: "#FFFFFF",
            fillColor: "#202020",
            fillOpacity: 1,
            weight: 2,
          }}
        />

        {/* MARKER TITIK AKHIR */}
        <CircleMarker
          center={[endPoint.lat, endPoint.lng]}
          radius={7}
          pathOptions={{
            color: "#FFFFFF",
            fillColor: "#DC2626",
            fillOpacity: 1,
            weight: 2,
          }}
        />
      </MapContainer>
    </div>
  );
};

export default mapPreview;
