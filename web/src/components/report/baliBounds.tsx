import { useEffect } from "react";
import { useMap } from "react-leaflet";

import { limitToBali } from "@/lib/baliBounds";

// Drop inside a react-leaflet <MapContainer> to keep that map on Bali.
export function BaliBounds() {
  const map = useMap();
  useEffect(() => limitToBali(map), [map]);
  return null;
}
