import { EARTH_RADIUS } from "../consts";

export function latLongToMeters(lat: number, lon: number, originLat: number, originLon: number) {
  const R = EARTH_RADIUS;
  const toRad = (deg: number) => deg * Math.PI / 180;

  const dLat = toRad(lat - originLat);
  const dLon = toRad(lon - originLon);

  const x = dLon * R * Math.cos(toRad(originLat));
  const z = dLat * R;

  return [x, z];
}
