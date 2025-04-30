import * as THREE from "three";
import { EARTH_RADIUS } from "../consts";

export const latLongToCartesian = (latitude: number, longitude: number, altitude = 0) => {
  const phi = (90 - latitude) * Math.PI / 180;
  const theta = (longitude + 180) * Math.PI / 180;
  const r = EARTH_RADIUS + altitude;

  const x = -r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
};