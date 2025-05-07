import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import * as THREE from 'three';
import { RootState } from '../state/store';
import { latLongToCartesian } from '../utils/latLongToCartesian';
import { LogEntry, GPS } from '../state/types/logTypes';
import { EARTH_CENTER } from '../consts';

export type PlanePoint = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  roll: number;
  pitch: number;
  yaw: number;
}

const PlaybackPathLine: React.FC = () => {
  const selectedLogFilename = useSelector((state: RootState) => state.logs.selectedLogFilename);
  const loadedLogs = useSelector((state: RootState) => state.logs.loadedLogs);
  const progress = useSelector((state: RootState) => state.logs.playbackProgress);

  const allFlightDataPoints = useMemo(() => {
    if (!selectedLogFilename) return [];
    const logData = loadedLogs[selectedLogFilename];
    if (!logData || !logData.entries || logData.entries.length === 0) return [];
    const flightPoints = logData.entries
      .map((entry: LogEntry) => {
        const gps = entry['gps'] as GPS | undefined;
        const altitude = entry['alt'] as number | undefined;
        if (gps) {
          const position = latLongToCartesian(gps.lat, gps.long, altitude ?? 0);
          const normal = new THREE.Vector3().subVectors(position, EARTH_CENTER).normalize()
          const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)
          return { position, quaternion, roll: entry['roll'], pitch: entry['ptch'], yaw: entry['yaw'] };
        }
      })
      .filter(Boolean) as PlanePoint[];
    return flightPoints;
  }, [selectedLogFilename, loadedLogs]);

  const currentFlightSegment = useMemo(() => {
    if (allFlightDataPoints.length === 0) return [];
    const endIndex = Math.min(allFlightDataPoints.length, progress + 1);
    return allFlightDataPoints.slice(0, endIndex);
  }, [allFlightDataPoints, progress]);


  const linePoints = useMemo(() => {
    return currentFlightSegment.map(p => p.position);
  }, [currentFlightSegment]);

  const lineGeometry = useMemo(() => {
    if (linePoints.length < 2) return undefined;
    return new THREE.BufferGeometry().setFromPoints(linePoints);
  }, [linePoints]);

  const currentPlaneData = useMemo(() => {
    if (currentFlightSegment.length === 0) return undefined;
    const dataIndex = Math.min(progress, currentFlightSegment.length - 1);
    return currentFlightSegment[dataIndex];
  }, [currentFlightSegment, progress]);


  if (!lineGeometry && !currentPlaneData) {
    return null;
  }

  const clampedPlaneScale = 5


  return (
    <>
      {lineGeometry && linePoints.length >= 2 && (
        <line geometry={lineGeometry}>
          <lineBasicMaterial attach="material" color={'white'} linewidth={1} linecap={'round'} linejoin={'round'} />
        </line>
      )}
      {currentPlaneData && (
        <mesh
          position={currentPlaneData.position}
          quaternion={currentPlaneData.quaternion}
         
          >
            <mesh rotation={[currentPlaneData.roll, -currentPlaneData.yaw-Math.PI, -currentPlaneData.pitch]}>

            <mesh name="planeBody">
              <boxGeometry args={[clampedPlaneScale * 2, clampedPlaneScale * 0.5, clampedPlaneScale * 0.5]} />
              <meshStandardMaterial color={'#cccccc'} roughness={0.5} metalness={0.2} />
            </mesh>
            <mesh name="plan  eWing" position={[0, 0, 0]}>
              <boxGeometry args={[clampedPlaneScale * 0.5, clampedPlaneScale * 0.2, clampedPlaneScale * 3]} />
              <meshStandardMaterial color={'#aaaaaa'} roughness={0.5} metalness={0.2} />
            </mesh>
            <mesh name="planeTail" position={[-clampedPlaneScale * 1.2, clampedPlaneScale * 0.3, 0]}>
              <boxGeometry args={[clampedPlaneScale * 0.4, clampedPlaneScale * 0.6, clampedPlaneScale * 0.2]} />
              <meshStandardMaterial color={'#999999'} roughness={0.5} metalness={0.2} />
            </mesh>
            </mesh>
        </mesh>
      )}
      {allFlightDataPoints.length > 0 && (
        <>
          <mesh position={allFlightDataPoints[0].position}>
            <sphereGeometry args={[Math.max(2, clampedPlaneScale * 0.2), 16, 16]} />
            <meshStandardMaterial color={'lime'} roughness={1.0} metalness={0.0} />
          </mesh>
          {allFlightDataPoints.length > 1 && (
            <mesh position={allFlightDataPoints[allFlightDataPoints.length - 1].position}>
              <sphereGeometry args={[Math.max(2, clampedPlaneScale * 0.2), 16, 16]} />
              <meshStandardMaterial color={'red'} roughness={1.0} metalness={0.0} />
            </mesh>
          )}
        </>
      )}
    </>
  );
};

export default PlaybackPathLine;