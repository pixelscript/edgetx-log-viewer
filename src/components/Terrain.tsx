import { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useFrame } from '@react-three/fiber';
import { isEqual } from 'lodash';
import { RootState } from '../state/store';
import { selectMapType, setTerrainElevationOffset } from '../state/uiSlice';
import type { LogEntry, GPS } from '../state/types/logTypes';
import {
  listWorldTiles,
  loadHeightField,
  sampleHeightField,
  selectTileRange,
} from '../utils/terrainTiles';
import { TerrainQuadtree } from '../utils/terrainQuadtree';

// The quadtree is seeded with whole-world root tiles at this zoom so terrain can
// stream in anywhere the camera goes, refining towards it up to MAX_ZOOM. Only
// tiles near the camera actually load, so global coverage stays cheap.
const ROOT_ZOOM = 3;
// Elevation is loaded once at a moderate resolution and shared by every LOD, so
// neighbouring tiles always agree on edge heights (no terrain cracks). Imagery
// is what streams progressively with distance.
const ELEVATION_OPTIONS = { minZoom: 9, maxZoom: 13, maxTiles: 24, padTiles: 1 };
const MAX_ZOOM = 18;

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

export default function Terrain() {
  const [quadtree, setQuadtree] = useState<TerrainQuadtree | null>(null);
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
      setQuadtree(null);
      return;
    }

    let cancelled = false;
    let created: TerrainQuadtree | null = null;

    const build = async () => {
      const elevationRange = selectTileRange(bounds, ELEVATION_OPTIONS);
      const field = await loadHeightField(elevationRange);
      if (cancelled) {
        return;
      }

      if (homePoint) {
        const elevation = sampleHeightField(field, homePoint.lat, homePoint.long);
        dispatch(setTerrainElevationOffset(elevation));
      }

      created = new TerrainQuadtree({
        mapType,
        field,
        rootZoom: ROOT_ZOOM,
        rootTiles: listWorldTiles(ROOT_ZOOM),
        maxZoom: MAX_ZOOM,
      });
      setQuadtree(created);
    };

    build();

    return () => {
      cancelled = true;
      created?.dispose();
      setQuadtree(null);
    };
  }, [bounds, homePoint, mapType, dispatch]);

  useEffect(() => {
    return () => {
      dispatch(setTerrainElevationOffset(0));
    };
  }, [dispatch]);

  useFrame(({ camera }) => {
    quadtree?.update(camera);
  });

  if (!quadtree) {
    return null;
  }
  return <primitive object={quadtree.group} />;
}
