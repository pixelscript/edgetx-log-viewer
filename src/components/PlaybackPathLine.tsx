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
  const allPoints = useMemo(() => {
    if (!selectedLogFilename) return [];
    const logData = loadedLogs[selectedLogFilename];
    if (!logData || !logData.entries || logData.entries.length === 0) return [];
    const pathPoints: THREE.Vector3[] = [];
    logData.entries.forEach((entry: LogEntry) => {
      const gps = entry['gps'] as GPS | undefined;
      const altitude = entry['alt'] as number | undefined;
      if(gps) {
        const cartesianPoint = latLongToCartesian(gps.lat, gps.long, altitude);
        pathPoints.push(cartesianPoint);
      }
    });
    return pathPoints;
  }, [selectedLogFilename, loadedLogs]);

  const points = useMemo(() => {
    if (allPoints.length === 0) return [];
    const endIndex = Math.min(allPoints.length - 1, progress);
    return allPoints.slice(0, endIndex);
  }, [allPoints, progress]);

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
        <mesh position={points[points.length - 1]}>
          <sphereGeometry args={[10, 16, 16]} />
          <meshStandardMaterial color={'white'} roughness={1.0} metalness={0.0} />
        </mesh>
        <mesh position={allPoints[0]}>
          <sphereGeometry args={[10, 16, 16]} />
          <meshStandardMaterial color={'green'} roughness={1.0} metalness={0.0} />
        </mesh>
      </line>
  );
};

export default PlaybackPathLine;