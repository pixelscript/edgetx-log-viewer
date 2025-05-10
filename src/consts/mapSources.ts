export interface MapSource {
  id: string;
  name: string;
  minZoomLevel: number;
  maxZoomLevel: number;
  tileSize: number;
  projection: 'MERCATOR';
  licenseUri?: string;
  urlTemplate: string;
  license?: string;
  subdomains?: string[];
  isQuadKey?: boolean;
}

// Attempt to get MapBox token from environment variables, otherwise use a placeholder.
// For Vite, it would be import.meta.env.VITE_MAPBOX_TOKEN
// For Create React App, it would be process.env.REACT_APP_MAPBOX_TOKEN
// Using a generic placeholder for now.
const MAPBOX_ACCESS_TOKEN = (window as any).VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_ACCESS_TOKEN_PLACEHOLDER';

export const mapSources: MapSource[] = [
  {
    id: 'osm_standard',
    name: 'OpenStreetMap',
    minZoomLevel: 0,
    maxZoomLevel: 19,
    tileSize: 256,
    projection: 'MERCATOR',
    urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    license: '© OpenStreetMap contributors',
    licenseUri: 'https://www.openstreetmap.org/copyright',
    isQuadKey: false,
  },
  {
    id: 'mapbox_satellite',
    name: 'MapBox Satellite',
    minZoomLevel: 0,
    maxZoomLevel: 19,
    projection: 'MERCATOR',
    tileSize: 256,
    licenseUri: 'https://mapbox.com/',
    urlTemplate: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.png?access_token=${MAPBOX_ACCESS_TOKEN}`,
    license: '(c) Mapbox & partners',
    isQuadKey: false,
  },
  {
    id: 'esri_clarity',
    name: 'ESRI World Imagery (Clarity)',
    license: '© 2021 Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, Aerogrid, IGN, IGP, and the GIS User Community',
    licenseUri: 'https://www.esriuk.com/en-gb/content/products?esri-world-imagery-service',
    minZoomLevel: 0,
    maxZoomLevel: 18,
    tileSize: 256,
    projection: 'MERCATOR',
    urlTemplate: 'https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    isQuadKey: false,
  },
  {
    id: 'bing_aerial',
    name: 'Bing Aerial',
    minZoomLevel: 1,
    maxZoomLevel: 19,
    tileSize: 256,
    projection: 'MERCATOR',
    license: '© Microsoft Corporation',
    licenseUri: 'https://www.microsoft.com/en-us/maps/product',
    urlTemplate: 'http://ecn.t{s}.tiles.virtualearth.net/tiles/a{quadkey}.jpeg?g=13205&mkt=en-US&n=z',
    subdomains: ['0', '1', '2', '3'],
    isQuadKey: true,
  },
  {
    id: 'bing_hybrid',
    name: 'Bing Hybrid',
    minZoomLevel: 1,
    maxZoomLevel: 19,
    tileSize: 256,
    projection: 'MERCATOR',
    license: '© Microsoft Corporation',
    licenseUri: 'https://www.microsoft.com/en-us/maps/product',
    urlTemplate: 'http://ecn.t{s}.tiles.virtualearth.net/tiles/h{quadkey}.jpeg?g=13205&mkt=en-US&n=z',
    subdomains: ['0', '1', '2', '3'],
    isQuadKey: true,
  },
];

export const DEFAULT_MAP_SOURCE_ID = mapSources[0].id; // Default to OpenStreetMap