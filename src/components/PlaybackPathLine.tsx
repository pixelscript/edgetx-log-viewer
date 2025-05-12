import React, { useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as THREE from 'three';
import { useControlsContext } from '../contexts/ControlsContext';
import { useThree } from '@react-three/fiber';
import { RootState } from '../state/store';
import { usePlayback } from '../contexts/PlaybackContext';
import { latLongToCartesian } from '../utils/latLongToCartesian';
import { LogEntry, GPS } from '../state/types/logTypes';
import { EARTH_CENTER } from '../consts';
import { isEqual } from 'lodash';
import { ColoredPathLine } from './ColoredPathLine';
export type PlanePoint = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  roll: number;
  pitch: number;
  yaw: number;
}

const PlaybackPathLine: React.FC = () => {
  const selectedLogFilename = useSelector((state: RootState) => state.logs.selectedLogFilename);
  const loadedLogs = useSelector((state: RootState) => state.logs.loadedLogs, isEqual);
  const targetCenterFromStore = useSelector((state: RootState) => state.logs.targetCenter);
  const { playbackProgress: progress, followPlane } = usePlayback();
  const { controlsRef } = useControlsContext();
  const { camera } = useThree();

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

  const currentPlaneData = useMemo(() => {
    if (currentFlightSegment.length === 0) return undefined;
    const dataIndex = Math.min(progress, currentFlightSegment.length - 1);
    return currentFlightSegment[dataIndex];
  }, [currentFlightSegment, progress]);

  useEffect(() => {
    if (controlsRef && controlsRef.current && camera) {
      if (followPlane && currentPlaneData && currentPlaneData.position) {
        const offset = camera.position.clone().sub(controlsRef.current.target);
        controlsRef.current.target.copy(currentPlaneData.position);
        camera.position.copy(currentPlaneData.position).add(offset);
        controlsRef.current.update();
      }
    }
  }, [currentPlaneData, controlsRef, camera, followPlane, targetCenterFromStore]);

  if (linePoints.length < 2 && !currentPlaneData) {
    return null;
  }

  const clampedPlaneScale = 5

  return (
    <>
      {linePoints.length >= 2 && (
        <ColoredPathLine points={linePoints} color={'white'} lineWidth={5} />
      )}
      {currentPlaneData && (
        <mesh
          position={currentPlaneData.position}
          quaternion={currentPlaneData.quaternion}
        >
          <mesh rotation={[currentPlaneData.roll, -currentPlaneData.yaw - Math.PI, -currentPlaneData.pitch, 'YXZ']}>
            <mesh name="planeBody">
              <boxGeometry args={[clampedPlaneScale * 2, clampedPlaneScale * 0.5, clampedPlaneScale * 0.5]} />
              <meshStandardMaterial color={'#cccccc'} roughness={0.5} metalness={0.2} />
            </mesh>
            <mesh name="planeWing" position={[0, 0, 0]}>
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