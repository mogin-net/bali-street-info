import { LatLngBounds } from "leaflet";

export const SANUR_BOUNDS = new LatLngBounds(
  [-8.721, 115.238],
  [-8.668, 115.283],
);

export type LocationPoint = {
  lat: number;
  lng: number;
};

export const isInsideSanur = (point: LocationPoint): boolean => {
  return SANUR_BOUNDS.contains([point.lat, point.lng]);
};
