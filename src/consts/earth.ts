import * as THREE from 'three';

export const EARTH_RADIUS = 6371000;
export const EARTH_CENTER = new THREE.Vector3(0, 0, 0);
export enum MapType {
  OpenStreetMap = "OpenStreetMap",
  // MapBox = "MapBox",
  EsriWorld = "EsriWorld",
  BingMap = "BingMap",
  BingMapHybrid = "BingMapHybrid",
}