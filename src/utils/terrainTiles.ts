/**
 * Helpers for working with Web Mercator (XYZ / "slippy") tiles and decoding
 * elevation from the free, keyless AWS Terrain Tiles dataset.
 *
 * Elevation source: https://registry.opendata.aws/terrain-tiles/
 * Terrarium-encoded PNG tiles, CORS-enabled, no API key required:
 *   https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
 */

export const TERRARIUM_TILE_SIZE = 256;

/** Builds the Terrarium elevation tile URL for an XYZ tile coordinate. */
export function getTerrariumTileUrl(x: number, y: number, z: number): string {
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
}

export interface TileCoord {
  x: number;
  y: number;
}

export interface TileRange {
  z: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Longitude (degrees) of the left edge of a tile column at the given zoom. */
export function tileXToLongitude(x: number, z: number): number {
  const n = 2 ** z;
  return (x / n) * 360 - 180;
}

/** Latitude (degrees) of the top edge of a tile row at the given zoom. */
export function tileYToLatitude(y: number, z: number): number {
  const n = 2 ** z;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return (latRad * 180) / Math.PI;
}

/** Tile column containing the given longitude at the given zoom. */
export function longitudeToTileX(longitude: number, z: number): number {
  const n = 2 ** z;
  return Math.floor(((longitude + 180) / 360) * n);
}

/** Tile row containing the given latitude at the given zoom. */
export function latitudeToTileY(latitude: number, z: number): number {
  const n = 2 ** z;
  const latRad = (latitude * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n,
  );
}

/**
 * Chooses the highest zoom level at which a lat/long bounding box (padded by
 * `padTiles` on each side) is still covered by at most `maxTiles` tiles, then
 * returns the resulting tile range.
 */
export function selectTileRange(
  bounds: { minLat: number; maxLat: number; minLong: number; maxLong: number },
  options: { minZoom: number; maxZoom: number; maxTiles: number; padTiles: number },
): TileRange {
  const { minZoom, maxZoom, maxTiles, padTiles } = options;

  let chosen: TileRange | null = null;
  for (let z = maxZoom; z >= minZoom; z--) {
    const minX = longitudeToTileX(bounds.minLong, z) - padTiles;
    const maxX = longitudeToTileX(bounds.maxLong, z) + padTiles;
    // Latitude increases northward but tile Y increases southward, so the
    // northern (max) latitude maps to the smaller Y.
    const minY = latitudeToTileY(bounds.maxLat, z) - padTiles;
    const maxY = latitudeToTileY(bounds.minLat, z) + padTiles;

    const tileCount = (maxX - minX + 1) * (maxY - minY + 1);
    const range: TileRange = { z, minX, maxX, minY, maxY };
    chosen = range;
    if (tileCount <= maxTiles) {
      break;
    }
  }

  return chosen ?? {
    z: minZoom,
    minX: longitudeToTileX(bounds.minLong, minZoom) - padTiles,
    maxX: longitudeToTileX(bounds.maxLong, minZoom) + padTiles,
    minY: latitudeToTileY(bounds.maxLat, minZoom) - padTiles,
    maxY: latitudeToTileY(bounds.minLat, minZoom) + padTiles,
  };
}

/** Lists every tile coordinate contained in a tile range. */
export function listTiles(range: TileRange): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let x = range.minX; x <= range.maxX; x++) {
    for (let y = range.minY; y <= range.maxY; y++) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/** Lists every tile covering the whole world at the given zoom level. */
export function listWorldTiles(z: number): TileCoord[] {
  const count = 2 ** z;
  const tiles: TileCoord[] = [];
  for (let x = 0; x < count; x++) {
    for (let y = 0; y < count; y++) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/**
 * A decoded elevation tile: a square grid of metre elevations sampled from a
 * Terrarium PNG.
 */
export interface HeightTile {
  size: number;
  /** Row-major elevations in metres, length `size * size`. */
  elevations: Float32Array;
}

/** Decodes a single Terrarium pixel (RGB) into metres. */
function decodeTerrariumPixel(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/**
 * Loads a Terrarium elevation tile and decodes it into a height grid.
 * Returns `null` if the tile cannot be loaded (e.g. ocean / out of coverage).
 */
export async function loadHeightTile(
  x: number,
  y: number,
  z: number,
): Promise<HeightTile | null> {
  const image = await loadCorsImage(getTerrariumTileUrl(x, y, z));
  if (!image) {
    return null;
  }

  const size = TERRARIUM_TILE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  ctx.drawImage(image, 0, 0, size, size);

  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, size, size).data;
  } catch {
    // Canvas was tainted (missing CORS headers) — cannot read elevation.
    return null;
  }

  const elevations = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const p = i * 4;
    elevations[i] = decodeTerrariumPixel(pixels[p], pixels[p + 1], pixels[p + 2]);
  }

  return { size, elevations };
}

/** Bilinearly samples an elevation grid at normalised coordinates [0, 1]. */
export function sampleHeight(tile: HeightTile, u: number, v: number): number {
  const max = tile.size - 1;
  const fx = Math.min(Math.max(u, 0), 1) * max;
  const fy = Math.min(Math.max(v, 0), 1) * max;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, max);
  const y1 = Math.min(y0 + 1, max);
  const tx = fx - x0;
  const ty = fy - y0;

  const e = tile.elevations;
  const s = tile.size;
  const e00 = e[y0 * s + x0];
  const e10 = e[y0 * s + x1];
  const e01 = e[y1 * s + x0];
  const e11 = e[y1 * s + x1];

  const top = e00 + (e10 - e00) * tx;
  const bottom = e01 + (e11 - e01) * tx;
  return top + (bottom - top) * ty;
}

function loadCorsImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/**
 * A collection of decoded elevation tiles at a single zoom level, allowing
 * elevation to be sampled at any lat/long within the loaded area. This lets the
 * imagery be rendered at a higher zoom (more detail) than the elevation grid,
 * keeping the number of elevation fetches low.
 */
export interface HeightField {
  z: number;
  tiles: Map<string, HeightTile | null>;
}

/** Loads every elevation tile in a range into a sampleable height field. */
export async function loadHeightField(range: TileRange): Promise<HeightField> {
  const tiles = new Map<string, HeightTile | null>();
  await Promise.all(
    listTiles(range).map(async ({ x, y }) => {
      tiles.set(`${x}/${y}`, await loadHeightTile(x, y, range.z));
    }),
  );
  return { z: range.z, tiles };
}

/** Samples ground elevation (metres) from a height field; 0 outside coverage. */
export function sampleHeightField(
  field: HeightField,
  latitude: number,
  longitude: number,
): number {
  const x = longitudeToTileX(longitude, field.z);
  const y = latitudeToTileY(latitude, field.z);
  const tile = field.tiles.get(`${x}/${y}`);
  if (!tile) {
    return 0;
  }

  const lonLeft = tileXToLongitude(x, field.z);
  const lonRight = tileXToLongitude(x + 1, field.z);
  const latTop = tileYToLatitude(y, field.z);
  const latBottom = tileYToLatitude(y + 1, field.z);

  const u = (longitude - lonLeft) / (lonRight - lonLeft);
  const v = (latitude - latTop) / (latBottom - latTop);
  return sampleHeight(tile, u, v);
}
