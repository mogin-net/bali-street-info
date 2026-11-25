import { LatLngBounds, type Map as LeafletMap } from "leaflet";

// Bali with Nusa Penida/Lembongan/Ceningan and Menjangan, plus a thin sea margin.
export const BALI_BOUNDS = new LatLngBounds([-8.88, 114.4], [-8.03, 115.73]);

// Keeps a map on Bali: it can't be dragged off the island, and zooming out
// stops once all of Bali fits. That zoom depends on the map's size, so it is
// recomputed on resize (phone vs desktop, popups that open animated).
export function limitToBali(map: LeafletMap) {
  const fitMinZoom = () => map.setMinZoom(map.getBoundsZoom(BALI_BOUNDS));

  map.options.maxBoundsViscosity = 1;
  map.setMaxBounds(BALI_BOUNDS);
  fitMinZoom();
  map.on("resize", fitMinZoom);

  return () => {
    map.off("resize", fitMinZoom);
  };
}
