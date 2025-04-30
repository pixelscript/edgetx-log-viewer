import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import * as THREE from 'three';
import { RootState } from '../state/store';
import { latLongToCartesian } from '../utils/latLongToCartesian';
import { LogEntry, GPS } from '../state/types/logTypes';

const PlaybackPathLine: React.FC = () => {
  const selectedLogFilename = useSelector((state: RootState) => state.logs.selectedLogFilename);
  const loadedLogs = useSelector((state: RootState) => state.logs.loadedLogs);
  const progress = useSelector((state: RootState) => state.logs.playbackProgress);
  const points = useMemo(() => {
    if (!selectedLogFilename) return [];

    const logData = loadedLogs[selectedLogFilename];
    if (!logData || !logData.entries || logData.entries.length === 0) return [];

    const pathPoints: THREE.Vector3[] = [];
    const endIndex = Math.min(progress + 1, logData.entries.length);
    const entriesToShow = logData.entries.slice(0, endIndex);

    entriesToShow.forEach((entry: LogEntry) => {
      const gps = entry['gps'] as GPS | undefined;
      const altitude = entry['alt'] as number | undefined;

      if (gps && typeof gps.lat === 'number' && typeof gps.long === 'number' && typeof altitude === 'number') {
        const cartesianPoint = latLongToCartesian(gps.lat, gps.long, altitude);
        pathPoints.push(cartesianPoint);
      }
    });

    if (pathPoints.length === 1) {
        pathPoints.push(pathPoints[0].clone());
    }
    return pathPoints;
  }, [selectedLogFilename, loadedLogs, progress]);

  const lineGeometry = useMemo(() => {
    if (points.length < 2) return undefined;
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  if (!lineGeometry || points.length < 2) {
    return null;
  }

  return (
      <line geometry={lineGeometry}>
        <lineBasicMaterial attach="material" color={'white'} linewidth={1} linecap={'round'} linejoin={'round'} />
      </line>
  );
};

export default PlaybackPathLine;