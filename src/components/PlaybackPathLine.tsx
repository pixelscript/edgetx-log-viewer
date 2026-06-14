import React, { useRef, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as THREE from 'three';
import { useControlsContext } from '../contexts/ControlsContext';
import { useThree, useFrame } from '@react-three/fiber';
import { RootState } from '../state/store';
import { usePlayback, PlaybackCameraView } from '../contexts/PlaybackContext';
import { latLongToCartesian } from '../utils/latLongToCartesian';
import { LogEntry, GPS } from '../state/types/logTypes';
import { EARTH_CENTER } from '../consts';
import { isEqual } from 'lodash';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ColoredPathLine } from './ColoredPathLine';
import { MODE_COLOURS } from './ModeColorKey';
export type PlanePoint = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  roll: number;
  pitch: number;
  yaw: number;
  mode: string;
}

// Trail colour for a flight mode, matching the Stats page's mode key.
const getModeColor = (mode: string): THREE.ColorRepresentation =>
  MODE_COLOURS[mode as keyof typeof MODE_COLOURS] ?? MODE_COLOURS.UNKNOWN;

// Camera rig offsets (metres) used when first entering Follow / FPV views.
const FOLLOW_DISTANCE_BACK = 60;
const FOLLOW_DISTANCE_UP = 22;
const FOLLOW_LOOK_AHEAD = 40;
const FPV_FORWARD = 6;
const FPV_UP = 2.5;
const FPV_LOOK_AHEAD = 500;

// Number of data points either side of the current frame used to derive a
// smoothed travel direction for the Follow/FPV cameras.
const HEADING_WINDOW = 3;

// Time constant (seconds) for the camera-orientation low-pass filter. Larger
// values ease the camera toward its target attitude more slowly, damping the
// up/down swings that come from vertical wobble in the flight path.
const CAMERA_SMOOTH_TAU = 0.35;

const UP_AXIS = new THREE.Vector3(0, 1, 0);

// Shortest-path interpolation between two angles (radians), so attitude values
// that straddle the ±π wrap (notably yaw) blend smoothly instead of spinning
// the long way around.
const lerpAngle = (a: number, b: number, t: number): number => {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
};

type InterpolatedPose = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  roll: number;
  pitch: number;
  yaw: number;
};

// Position of the flight path at a fractional index, lerped between the two
// surrounding data points. Used both for the plane pose and for sampling a
// continuous travel direction for the cameras.
const interpolatePosition = (points: PlanePoint[], t: number): THREE.Vector3 => {
  const maxIndex = points.length - 1;
  const clamped = Math.max(0, Math.min(t, maxIndex));
  const lower = Math.floor(clamped);
  const upper = Math.min(lower + 1, maxIndex);
  return points[lower].position.clone().lerp(points[upper].position, clamped - lower);
};

// Resolve the plane pose at a fractional index by blending the two surrounding
// data points: position is lerped, the surface-alignment quaternion is rebuilt
// from the interpolated position's normal, and the attitude angles are blended
// along their shortest path.
const interpolatePose = (points: PlanePoint[], t: number): InterpolatedPose => {
  const maxIndex = points.length - 1;
  const clamped = Math.max(0, Math.min(t, maxIndex));
  const lower = Math.floor(clamped);
  const upper = Math.min(lower + 1, maxIndex);
  const frac = clamped - lower;
  const a = points[lower];
  const b = points[upper];

  const position = a.position.clone().lerp(b.position, frac);
  const normal = position.clone().sub(EARTH_CENTER).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP_AXIS, normal);
  return {
    position,
    quaternion,
    roll: lerpAngle(a.roll ?? 0, b.roll ?? 0, frac),
    pitch: lerpAngle(a.pitch ?? 0, b.pitch ?? 0, frac),
    yaw: lerpAngle(a.yaw ?? 0, b.yaw ?? 0, frac),
  };
};

const PlaybackPathLine: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const planeRootRef = useRef<THREE.Group>(null);
  const planeAttitudeRef = useRef<THREE.Group>(null);
  const selectedLogFilename = useSelector((state: RootState) => state.logs.selectedLogFilename);
  const loadedLogs = useSelector((state: RootState) => state.logs.loadedLogs, isEqual);
  const targetCenterFromStore = useSelector((state: RootState) => state.logs.targetCenter);
  const terrainElevationOffset = useSelector((state: RootState) => state.ui.terrainElevationOffset);
  const { playbackProgress: progress, progressClockRef, cameraView, selectedModel } = usePlayback();
  const { controlsRef } = useControlsContext();
  const { camera } = useThree();

  // Tracks which view we last framed, plus the plane's previous pose, so we can
  // carry the camera rig along with the plane's motion between frames.
  const framedViewRef = useRef<PlaybackCameraView | null>(null);
  const prevPosRef = useRef<THREE.Vector3 | null>(null);
  const prevQuatRef = useRef<THREE.Quaternion | null>(null);
  // Low-pass-filtered camera frame orientation; eased toward the raw target
  // attitude each frame so the camera does not lurch up and down on every step.
  const smoothedQuatRef = useRef<THREE.Quaternion | null>(null);

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
          return { position, quaternion, roll: entry['roll'], pitch: entry['ptch'], yaw: entry['yaw'], mode: (entry['fm'] as string) ?? 'UNKNOWN' };
        }
      })
      .filter(Boolean) as PlanePoint[];
    return flightPoints;
  }, [selectedLogFilename, loadedLogs, terrainElevationOffset]);

  // Trail of points already flown, split into contiguous same-mode segments so
  // it can be colour-coded by flight mode like the Stats page. Keyed off the
  // integer progress so the geometry only rebuilds when a new data point is
  // reached, not on every interpolated animation frame.
  const trailSegments = useMemo(() => {
    if (allFlightDataPoints.length === 0) return [];
    const endIndex = Math.min(allFlightDataPoints.length, progress + 1);
    const segments: { mode: string; points: THREE.Vector3[] }[] = [];
    let current: { mode: string; points: THREE.Vector3[] } | null = null;
    for (let i = 0; i < endIndex; i++) {
      const point = allFlightDataPoints[i];
      if (!current || current.mode !== point.mode) {
        current = { mode: point.mode, points: [point.position] };
        segments.push(current);
      } else {
        current.points.push(point.position);
      }
    }
    return segments.filter(segment => segment.points.length >= 2);
  }, [allFlightDataPoints, progress]);

  const hasPlane = allFlightDataPoints.length > 0;

  // Smoothed travel direction at a fractional index, used to orient the
  // Follow/FPV cameras. Sampling interpolated positions a window of points
  // either side keeps the direction continuous between data points (so the
  // camera pans smoothly) while still averaging out noisy GPS samples.
  const getHeading = (points: PlanePoint[], t: number, position: THREE.Vector3) => {
    const maxIndex = points.length - 1;
    const clamped = Math.max(0, Math.min(t, maxIndex));
    const before = interpolatePosition(points, clamped - HEADING_WINDOW);
    const after = interpolatePosition(points, clamped + HEADING_WINDOW);
    const forward = after.sub(before);
    if (forward.lengthSq() < 1e-6) return undefined;
    forward.normalize();
    const up = position.clone().sub(EARTH_CENTER).normalize();
    return { forward, up };
  };

  // Drive the plane pose and the playback camera every render frame by sampling
  // the continuous progress clock and interpolating between data points. Working
  // imperatively here (rather than via React state) keeps the animation smooth
  // and decoupled from the data sample rate.
  useFrame((_, delta) => {
    const points = allFlightDataPoints;
    if (points.length === 0) return;

    const pose = interpolatePose(points, progressClockRef.current);

    if (planeRootRef.current) {
      planeRootRef.current.position.copy(pose.position);
      planeRootRef.current.quaternion.copy(pose.quaternion);
    }
    if (planeAttitudeRef.current) {
      planeAttitudeRef.current.rotation.set(pose.roll, -pose.yaw - Math.PI, -pose.pitch, 'YXZ');
    }

    const controls = controlsRef?.current;
    if (!controls || !camera) return;
    const pos = pose.position;
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

    const heading = getHeading(points, progressClockRef.current, pos);
    if (!heading) return; // wait until we have a valid heading
    const { forward, up } = heading;

    // `followQuat` keeps the horizon level (heading from the smoothed travel
    // direction); `fpvQuat` uses the craft's full attitude so the view banks
    // with roll.
    const followQuat = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(new THREE.Vector3(), forward.clone().negate(), up),
    );
    const fpvQuat = pose.quaternion.clone().multiply(
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(pose.roll, -pose.yaw - Math.PI, -pose.pitch, 'YXZ'),
      ),
    );
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
      smoothedQuatRef.current = frameQuat.clone();
      controls.update();
      return;
    }

    // Ease the camera attitude toward the raw target with a frame-rate
    // independent low-pass filter, so vertical wobble in the path no longer
    // produces large tilt swings each step. The smoothed orientation, not the
    // raw one, is what carries the camera rig below.
    const smoothedQuat = smoothedQuatRef.current ?? frameQuat.clone();
    const alpha = 1 - Math.exp(-delta / CAMERA_SMOOTH_TAU);
    smoothedQuat.slerp(frameQuat, alpha);
    smoothedQuatRef.current = smoothedQuat;

    // Subsequent frames: rigidly carry camera + target with the plane's motion
    // (translation + rotation) so the craft drives the view, while any orbiting
    // the user did between frames is preserved within the plane's frame.
    const prevPos = prevPosRef.current;
    const prevQuat = prevQuatRef.current;
    if (!prevPos || !prevQuat) {
      prevPosRef.current = pos.clone();
      prevQuatRef.current = smoothedQuat.clone();
      return;
    }
    const deltaQuat = smoothedQuat.clone().multiply(prevQuat.clone().invert());
    const camOffset = camera.position.clone().sub(prevPos).applyQuaternion(deltaQuat);
    camera.position.copy(pos).add(camOffset);
    const targetOffset = controls.target.clone().sub(prevPos).applyQuaternion(deltaQuat);
    controls.target.copy(pos).add(targetOffset);
    camera.up.applyQuaternion(deltaQuat).normalize();
    prevPosRef.current = pos.clone();
    prevQuatRef.current = smoothedQuat.clone();
    controls.update();
  });

  // Reset the camera rig framing when the view or flight changes so the next
  // frame re-seats the camera from scratch rather than carrying a stale offset.
  useEffect(() => {
    framedViewRef.current = null;
    prevPosRef.current = null;
    prevQuatRef.current = null;
    smoothedQuatRef.current = null;
  }, [cameraView, targetCenterFromStore]);

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

if (trailSegments.length === 0 && !hasPlane) {
  return null;
}

const clampedPlaneScale = 5

return (
  <>
    {trailSegments.map((segment, index) => (
      <ColoredPathLine
        key={`${segment.mode}-${index}`}
        points={segment.points}
        color={getModeColor(segment.mode)}
        lineWidth={5}
        depthTest={true}
      />
    ))}
    {hasPlane && (
      <group ref={planeRootRef}>
        <group ref={planeAttitudeRef}>
          <group ref={groupRef} name="plane" rotateOnAxis={[0, 1, 0]} rotation={rotation} scale={scale}></group>
        </group>
      </group>
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