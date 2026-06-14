import React, { useRef, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as THREE from 'three';
import { useControlsContext } from '../contexts/ControlsContext';
import { useThree } from '@react-three/fiber';
import { RootState } from '../state/store';
import { usePlayback, PlaybackCameraView } from '../contexts/PlaybackContext';
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

// Camera rig offsets (metres) used when first entering Follow / FPV views.
const FOLLOW_DISTANCE_BACK = 60;
const FOLLOW_DISTANCE_UP = 22;
const FOLLOW_LOOK_AHEAD = 40;
const FPV_FORWARD = 6;
const FPV_UP = 2.5;
const FPV_LOOK_AHEAD = 500;

const PlaybackPathLine: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const selectedLogFilename = useSelector((state: RootState) => state.logs.selectedLogFilename);
  const loadedLogs = useSelector((state: RootState) => state.logs.loadedLogs, isEqual);
  const targetCenterFromStore = useSelector((state: RootState) => state.logs.targetCenter);
  const terrainElevationOffset = useSelector((state: RootState) => state.ui.terrainElevationOffset);
  const { playbackProgress: progress, cameraView, selectedModel } = usePlayback();
  const { controlsRef } = useControlsContext();
  const { camera } = useThree();

  // Tracks which view we last framed, plus the plane's previous pose, so we can
  // carry the camera rig along with the plane's motion between playback steps.
  const framedViewRef = useRef<PlaybackCameraView | null>(null);
  const prevPosRef = useRef<THREE.Vector3 | null>(null);
  const prevQuatRef = useRef<THREE.Quaternion | null>(null);

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
    const altOffset = Math.max(0 - (logData?.stats.minAltitudeM ?? 0), 0) + terrainElevationOffset;
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
  }, [selectedLogFilename, loadedLogs, terrainElevationOffset]);

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

  // Orientation of the plane at the current frame, used to drive Follow/FPV cameras.
  // `followQuat` keeps the horizon level (heading from the smoothed travel direction);
  // `fpvQuat` uses the craft's full attitude so the view banks with roll.
  const planeOrientation = useMemo(() => {
    const pts = allFlightDataPoints;
    if (pts.length < 2 || !currentPlaneData?.position) return undefined;
    const idx = Math.min(progress, pts.length - 1);
    const window = 3;
    const before = pts[Math.max(0, idx - window)].position;
    const after = pts[Math.min(pts.length - 1, idx + window)].position;
    const forward = after.clone().sub(before);
    if (forward.lengthSq() < 1e-6) return undefined;
    forward.normalize();
    const up = currentPlaneData.position.clone().sub(EARTH_CENTER).normalize();
    const followQuat = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(new THREE.Vector3(), forward.clone().negate(), up),
    );
    const headingEuler = new THREE.Euler(
      currentPlaneData.roll ?? 0,
      -(currentPlaneData.yaw ?? 0) - Math.PI,
      -(currentPlaneData.pitch ?? 0),
      'YXZ',
    );
    const fpvQuat = currentPlaneData.quaternion.clone().multiply(
      new THREE.Quaternion().setFromEuler(headingEuler),
    );
    return { forward, up, followQuat, fpvQuat };
  }, [allFlightDataPoints, progress, currentPlaneData]);

  useEffect(() => {
    const controls = controlsRef?.current;
    if (!controls || !camera || !currentPlaneData?.position) return;
    const pos = currentPlaneData.position;
    controls.enabled = true;

    // Default: trail the plane while preserving the user's world-space offset.
    if (cameraView === 'default') {
      framedViewRef.current = 'default';
      prevPosRef.current = null;
      prevQuatRef.current = null;
      const offset = camera.position.clone().sub(controls.target);
      controls.target.copy(pos);
      camera.position.copy(pos).add(offset);
      controls.update();
      return;
    }

    if (!planeOrientation) return; // wait until we have a valid heading
    const { forward, up, followQuat, fpvQuat } = planeOrientation;
    const frameQuat = cameraView === 'fpv' ? fpvQuat : followQuat;

    // First frame after entering Follow/FPV: place the camera rig once.
    if (framedViewRef.current !== cameraView) {
      camera.up.copy(up);
      if (cameraView === 'follow') {
        camera.position.copy(pos)
          .addScaledVector(forward, -FOLLOW_DISTANCE_BACK)
          .addScaledVector(up, FOLLOW_DISTANCE_UP);
        controls.target.copy(pos).addScaledVector(forward, FOLLOW_LOOK_AHEAD);
      } else {
        camera.position.copy(pos)
          .addScaledVector(forward, FPV_FORWARD)
          .addScaledVector(up, FPV_UP);
        controls.target.copy(pos).addScaledVector(forward, FPV_LOOK_AHEAD);
      }
      framedViewRef.current = cameraView;
      prevPosRef.current = pos.clone();
      prevQuatRef.current = frameQuat.clone();
      controls.update();
      return;
    }

    // Subsequent frames: rigidly carry camera + target with the plane's motion
    // (translation + rotation) so the craft drives the view, while any orbiting
    // the user did between steps is preserved within the plane's frame.
    const prevPos = prevPosRef.current;
    const prevQuat = prevQuatRef.current;
    if (!prevPos || !prevQuat) {
      prevPosRef.current = pos.clone();
      prevQuatRef.current = frameQuat.clone();
      return;
    }
    const delta = frameQuat.clone().multiply(prevQuat.clone().invert());
    const camOffset = camera.position.clone().sub(prevPos).applyQuaternion(delta);
    camera.position.copy(pos).add(camOffset);
    const targetOffset = controls.target.clone().sub(prevPos).applyQuaternion(delta);
    controls.target.copy(pos).add(targetOffset);
    camera.up.applyQuaternion(delta).normalize();
    prevPosRef.current = pos.clone();
    prevQuatRef.current = frameQuat.clone();
    controls.update();
  }, [currentPlaneData, planeOrientation, controlsRef, camera, cameraView, targetCenterFromStore]);

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