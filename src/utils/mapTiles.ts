import { MapType } from '../consts/earth';

function tileXYToQuadKey(tileX: number, tileY: number, levelOfDetail: number): string {
  let quadKey = '';
  for (let i = levelOfDetail; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((tileX & mask) !== 0) {
      digit++;
    }
    if ((tileY & mask) !== 0) {
      digit++;
      digit++;
    }
    quadKey += digit.toString();
  }
  return quadKey;
}

function getBingMapsServerNum(tileX: number, tileY: number): number {
  return (tileX + tileY) % 4;
}

/**
 * Builds the imagery tile URL for a given map type and XYZ tile coordinate.
 */
export function getMapTileUrl(mapType: MapType, x: number, y: number, z: number): string {
  switch (mapType) {
    case MapType.EsriWorld:
      return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    case MapType.BingMap: {
      const quadKey = tileXYToQuadKey(x, y, z);
      const serverNum = getBingMapsServerNum(x, y);
      return `https://ecn.t${serverNum}.tiles.virtualearth.net/tiles/a${quadKey}.jpeg?g=563&mkt=en-US&device=mobile`;
    }
    case MapType.BingMapHybrid: {
      const quadKey = tileXYToQuadKey(x, y, z);
      const serverNum = getBingMapsServerNum(x, y);
      return `https://ecn.t${serverNum}.tiles.virtualearth.net/tiles/h${quadKey}.jpeg?g=563&mkt=en-US&device=mobile`;
    }
    case MapType.OpenStreetMap:
    default:
      return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }
}
