import React, { useRef, useMemo, useEffect } from 'react';
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
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ColoredPathLine } from './ColoredPathLine';
export type PlanePoint = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  roll: number;
  pitch: number;
  yaw: number;
}

const PlaybackPathLine: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const selectedLogFilename = useSelector((state: RootState) => state.logs.selectedLogFilename);
  const loadedLogs = useSelector((state: RootState) => state.logs.loadedLogs, isEqual);
  const targetCenterFromStore = useSelector((state: RootState) => state.logs.targetCenter);
  const { playbackProgress: progress, followPlane, selectedModel } = usePlayback();
  const { controlsRef } = useControlsContext();
  const { camera } = useThree();

  let rotation = new THREE.Euler(0, -Math.PI / 2, 0);
  let scale = 1;
  if (selectedModel === 'Jet') {
    rotation = new THREE.Euler(0, Math.PI / 2, 0);
  }
  if (selectedModel === 'Drone') {
    scale = 10;
  }
  const allFlightDataPoints = useMemo(() => {
    if (!selectedLogFilename) return [];
    const logData = loadedLogs[selectedLogFilename];
    const altOffset = Math.max(0 - (logData?.stats.minAltitudeM ?? 0), 0);
    if (!logData || !logData.entries || logData.entries.length === 0) return [];
    const flightPoints = logData.entries
      .map((entry: LogEntry) => {
        const gps = entry['gps'] as GPS | undefined;
        const altitude = entry['alt'] as number | undefined;
        if (gps) {
          const position = latLongToCartesian(gps.lat, gps.long, (altitude ?? 0) + altOffset);
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

  useEffect(() => {
    if (!groupRef.current || !selectedModel) {
      return;
    }

    const loader = new GLTFLoader();
    const currentGroup = groupRef.current;

    while (currentGroup.children.length > 0) {
      currentGroup.remove(currentGroup.children[0]);
    }

    const modelPath = `./models/${selectedModel}.glb`;

    loader.load(
      modelPath,
      function (gltf) {
        if (groupRef.current) {
          groupRef.current.add(gltf.scene);
        }
      },
      function (xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
      },
      function (error) {
        console.log('An error happened', error);
      }
    );
  }, [groupRef, selectedModel]);

if (linePoints.length < 2 && !currentPlaneData) {
  return null;
}

const clampedPlaneScale = 5

return (
  <>
    {linePoints.length >= 2 && (
      <ColoredPathLine points={linePoints} color={'white'} lineWidth={5} depthTest={true} />
    )}
    {currentPlaneData && (
      <mesh
        position={currentPlaneData.position}
        quaternion={currentPlaneData.quaternion}
      >
        <mesh rotation={[currentPlaneData.roll, -currentPlaneData.yaw - Math.PI, -currentPlaneData.pitch, 'YXZ']}>
          <group ref={groupRef} name="plane" rotateOnAxis={[0, 1, 0]} rotation={rotation} scale={scale}></group>
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