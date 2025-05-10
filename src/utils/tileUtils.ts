import { MapSource } from '../consts/mapSources';

/**
 * Converts latitude and longitude to Slippy Map tile X and Y coordinates.
 * @param lat Latitude in degrees.
 * @param lon Longitude in degrees.
 * @param zoom Zoom level.
 * @returns Tile X and Y coordinates.
 */
export function latLonToTileCoords(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const latRad = lat * Math.PI / 180;
  const n = Math.pow(2, zoom);
  const xTile = Math.floor((lon + 180) / 360 * n);
  const yTile = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x: xTile, y: yTile };
}

/**
 * Converts Slippy Map tile X and Y coordinates to a Bing Maps quadkey.
 * @param x Tile X coordinate.
 * @param y Tile Y coordinate.
 * @param zoom Zoom level.
 * @returns Quadkey string.
 */
export function tileCoordsToQuadKey(x: number, y: number, zoom: number): string {
  let quadKey = '';
  for (let i = zoom; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) {
      digit++;
    }
    if ((y & mask) !== 0) {
      digit++;
      digit++;
    }
    quadKey += digit.toString();
  }
  return quadKey;
}

/**
 * Constructs the URL for a map tile based on the map source and tile coordinates.
 * @param source The MapSource object.
 * @param x Tile X coordinate.
 * @param y Tile Y coordinate.
 * @param z Zoom level.
 * @returns The fully formed tile URL.
 */
export function getTileUrl(source: MapSource, x: number, y: number, z: number): string {
  let url = source.urlTemplate;
  url = url.replace('{z}', z.toString());
  url = url.replace('{x}', x.toString());
  url = url.replace('{y}', y.toString());

  if (source.isQuadKey) {
    const quadKey = tileCoordsToQuadKey(x, y, z);
    url = url.replace('{quadkey}', quadKey);
  }

  if (source.subdomains && source.subdomains.length > 0) {
    // Simple round-robin for subdomains
    const subdomainIndex = (x + y + z) % source.subdomains.length;
    url = url.replace('{s}', source.subdomains[subdomainIndex]);
  }
  return url;
}

/**
 * Calculates the number of tiles at a given zoom level.
 * @param zoom The zoom level.
 * @returns The number of tiles (width or height) at this zoom level.
 */
export function numTilesAtZoom(zoom: number): number {
  return Math.pow(2, zoom);
}

/**
 * Converts geographic coordinates (latitude, longitude) to a 3D Cartesian point on a sphere.
 * @param lat Latitude in degrees.
 * @param lon Longitude in degrees.
 * @param radius The radius of the sphere.
 * @returns An object with x, y, z coordinates.
 */
export function sphericalToCartesian(lat: number, lon: number, radius: number): { x: number; y: number; z: number } {
  const phi = (90 - lat) * (Math.PI / 180); // Convert latitude to polar angle (co-latitude)
  const theta = (lon + 180) * (Math.PI / 180); // Convert longitude to azimuthal angle

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta); // Z is up in Three.js by default, but map coords often have Y up
  const y = radius * Math.cos(phi);                  // So we map spherical Y to Cartesian Z, and spherical Z to Cartesian Y

  return { x, y, z };
}

/**
 * Calculates the corners of a tile in geographic coordinates.
 * @param x Tile X coordinate.
 * @param y Tile Y coordinate.
 * @param z Zoom level.
 * @returns An object with { north, south, east, west } latitudes and longitudes.
 */
export function tileToBoundingBox(x: number, y: number, z: number): { north: number; south: number; east: number; west: number } {
  const n = Math.pow(2, z);
  const lonDegWest = x / n * 360 - 180;
  const latRadNorth = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const latDegNorth = latRadNorth * 180 / Math.PI;

  const lonDegEast = (x + 1) / n * 360 - 180;
  const latRadSouth = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));
  const latDegSouth = latRadSouth * 180 / Math.PI;

  return {
    north: latDegNorth,
    south: latDegSouth,
    east: lonDegEast,
    west: lonDegWest,
  };
}