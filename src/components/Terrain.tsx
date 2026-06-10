import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as THREE from 'three';
import { isEqual } from 'lodash';
import { RootState } from '../state/store';
import { selectMapType, setTerrainElevationOffset } from '../state/uiSlice';
import type { LogEntry, GPS } from '../state/types/logTypes';
import { latLongToCartesian } from '../utils/latLongToCartesian';
import { getMapTileUrl } from '../utils/mapTiles';
import {
  HeightField,
  listTiles,
  loadHeightField,
  sampleHeightField,
  selectTileRange,
  tileXToLongitude,
  tileYToLatitude,
} from '../utils/terrainTiles';

const TILE_SEGMENTS = 16;
// Imagery is fetched at a high zoom for detail; the elevation grid is loaded at
// a coarser zoom (capped below) so terrain stays smooth without many fetches.
const IMAGERY_OPTIONS = { minZoom: 11, maxZoom: 17, maxTiles: 80, padTiles: 1 };
const ELEVATION_OPTIONS = { minZoom: 9, maxZoom: 13, maxTiles: 24, padTiles: 1 };

const getFirstGpsPoint = (entries: LogEntry[]): GPS | null => {
  for (const entry of entries) {
    const gps = entry['gps'] as GPS | undefined;
    if (gps && typeof gps.lat === 'number' && typeof gps.long === 'number') {
      return gps;
    }
  }
  return null;
};

const getBounds = (entries: LogEntry[]) => {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLong = Infinity;
  let maxLong = -Infinity;

  for (const entry of entries) {
    const gps = entry['gps'] as GPS | undefined;
    if (gps && typeof gps.lat === 'number' && typeof gps.long === 'number') {
      minLat = Math.min(minLat, gps.lat);
      maxLat = Math.max(maxLat, gps.lat);
      minLong = Math.min(minLong, gps.long);
      maxLong = Math.max(maxLong, gps.long);
    }
  }

  if (minLat === Infinity) {
    return null;
  }
  return { minLat, maxLat, minLong, maxLong };
};

/**
 * Builds a displaced terrain mesh for a single imagery tile, draped with that
 * tile's imagery and lifted onto elevation sampled from the height field.
 */
const buildTileMesh = (
  x: number,
  y: number,
  z: number,
  heightField: HeightField,
  texture: THREE.Texture | null,
): THREE.Mesh => {
  const verts = TILE_SEGMENTS + 1;
  const positions = new Float32Array(verts * verts * 3);
  const uvs = new Float32Array(verts * verts * 2);

  for (let j = 0; j < verts; j++) {
    const fracY = j / TILE_SEGMENTS;
    const latitude = tileYToLatitude(y + fracY, z);
    for (let i = 0; i < verts; i++) {
      const fracX = i / TILE_SEGMENTS;
      const longitude = tileXToLongitude(x + fracX, z);
      const elevation = sampleHeightField(heightField, latitude, longitude);
      const point = latLongToCartesian(latitude, longitude, elevation);

      const vi = (j * verts + i) * 3;
      positions[vi] = point.x;
      positions[vi + 1] = point.y;
      positions[vi + 2] = point.z;

      const ui = (j * verts + i) * 2;
      uvs[ui] = fracX;
      // Tile row 0 is the northern edge; with flipY textures that maps to v = 1.
      uvs[ui + 1] = 1 - fracY;
    }
  }

  const indices: number[] = [];
  for (let j = 0; j < TILE_SEGMENTS; j++) {
    for (let i = 0; i < TILE_SEGMENTS; i++) {
      const a = j * verts + i;
      const b = j * verts + i + 1;
      const c = (j + 1) * verts + i;
      const d = (j + 1) * verts + i + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: texture ?? undefined,
    color: texture ? 0xffffff : 0x808080,
    roughness: 1,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  return new THREE.Mesh(geometry, material);
};

const loadTexture = (url: string): Promise<THREE.Texture | null> =>
  new Promise((resolve) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        resolve(texture);
      },
      undefined,
      () => resolve(null),
    );
  });

const disposeGroup = (group: THREE.Group) => {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const material = object.material as THREE.MeshStandardMaterial;
      material.map?.dispose();
      material.dispose();
    }
  });
};

export default function Terrain() {
  const groupRef = useRef<THREE.Group>(null);
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const mapType = useSelector(selectMapType);
  const dispatch = useDispatch();
  const { selectedLogFilename, loadedLogs } = useSelector((state: RootState) => ({
    selectedLogFilename: state.logs.selectedLogFilename,
    loadedLogs: state.logs.loadedLogs,
  }), isEqual);

  const bounds = useMemo(() => {
    const log = selectedLogFilename ? loadedLogs[selectedLogFilename] : null;
    return log ? getBounds(log.entries) : null;
  }, [selectedLogFilename, loadedLogs]);

  const homePoint = useMemo(() => {
    const log = selectedLogFilename ? loadedLogs[selectedLogFilename] : null;
    return log ? getFirstGpsPoint(log.entries) : null;
  }, [selectedLogFilename, loadedLogs]);

  useEffect(() => {
    if (!bounds) {
      setGroup(null);
      return;
    }

    let cancelled = false;
    const imageryRange = selectTileRange(bounds, IMAGERY_OPTIONS);
    const elevationRange = selectTileRange(bounds, ELEVATION_OPTIONS);
    const imageryTiles = listTiles(imageryRange);

    const build = async () => {
      const heightField = await loadHeightField(elevationRange);
      if (cancelled) {
        return;
      }

      if (homePoint) {
        const elevation = sampleHeightField(heightField, homePoint.lat, homePoint.long);
        dispatch(setTerrainElevationOffset(elevation));
      }

      const built = new THREE.Group();
      await Promise.all(
        imageryTiles.map(async ({ x, y }) => {
          const texture = await loadTexture(getMapTileUrl(mapType, x, y, imageryRange.z));
          if (cancelled) {
            texture?.dispose();
            return;
          }
          built.add(buildTileMesh(x, y, imageryRange.z, heightField, texture));
        }),
      );

      if (cancelled) {
        disposeGroup(built);
        return;
      }
      setGroup(built);
    };

    build();

    return () => {
      cancelled = true;
    };
  }, [bounds, homePoint, mapType, dispatch]);

  useEffect(() => {
    return () => {
      dispatch(setTerrainElevationOffset(0));
    };
  }, [dispatch]);

  useEffect(() => {
    return () => {
      if (group) {
        disposeGroup(group);
      }
    };
  }, [group]);

  if (!group) {
    return null;
  }
  return <primitive ref={groupRef} object={group} />;
}
