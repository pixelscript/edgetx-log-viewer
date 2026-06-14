import React, { useRef, useMemo, useEffect, useState } from 'react';
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
import { selectFileSettings } from '../state/settingsSlice';
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

// Time constant (seconds) for the camera-position low-pass filter. The plane
// position is piecewise-linear between data points, so its velocity jumps at
// each point; easing the camera toward it smooths out that forward lurch.
const CAMERA_POS_SMOOTH_TAU = 0.25;

// Time constant (seconds) for the plane's own position/attitude low-pass
// filter. Attitude angles are interpolated linearly between samples, so their
// velocity jumps at each data point; easing the displayed plane toward the raw
// pose tweens out that jerkiness. Kept small so the plane still tracks closely.
const PLANE_SMOOTH_TAU = 0.12;

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

// Position of the flight path at a fractional index. Uses a Catmull-Rom spline
// through the four surrounding data points so the path curves smoothly through
// turns instead of cutting straight-line facets between samples. Used for both
// the plane pose and for sampling a continuous travel direction for the cameras.
const interpolatePosition = (points: PlanePoint[], t: number): THREE.Vector3 => {
  const maxIndex = points.length - 1;
  const clamped = Math.max(0, Math.min(t, maxIndex));
  const i = Math.floor(clamped);
  const frac = clamped - i;

  const p0 = points[Math.max(0, i - 1)].position;
  const p1 = points[i].position;
  const p2 = points[Math.min(maxIndex, i + 1)].position;
  const p3 = points[Math.min(maxIndex, i + 2)].position;

  // Uniform Catmull-Rom basis evaluated per component.
  const t2 = frac * frac;
  const t3 = t2 * frac;
  const catmull = (a: number, b: number, c: number, d: number): number =>
    0.5 * ((2 * b) + (-a + c) * frac + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);

  return new THREE.Vector3(
    catmull(p0.x, p1.x, p2.x, p3.x),
    catmull(p0.y, p1.y, p2.y, p3.y),
    catmull(p0.z, p1.z, p2.z, p3.z),
  );
};

// Resolve the plane pose at a fractional index: position follows the Catmull-Rom
// spline through the data points, the surface-alignment quaternion is rebuilt
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

  const position = interpolatePosition(points, clamped);
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
  const fileSettings = useSelector(selectFileSettings(selectedLogFilename));
  const { progressClockRef, cameraView, selectedModel } = usePlayback();
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
  // Low-pass-filtered position the camera rig follows; eased toward the plane's
  // true position so the camera does not jump forward at each data point.
  const smoothedPosRef = useRef<THREE.Vector3 | null>(null);
  // Low-pass-filtered pose actually rendered for the plane mesh, eased toward
  // the raw interpolated pose so its motion and banking tween smoothly rather
  // than changing velocity abruptly at each data point.
  const planePosRef = useRef<THREE.Vector3 | null>(null);
  const planeAttitudeQuatRef = useRef<THREE.Quaternion | null>(null);
  // Scalar mirror of the plane's position lag: eased toward the raw playback
  // clock with the same filter as the rendered plane, so the trail can end at
  // the plane instead of running ahead of it. Drives `trailEndIndex`, which is
  // only the integer data point so the trail geometry rebuilds at most once per
  // step rather than every frame.
  const planeClockRef = useRef<number | null>(null);
  const [trailEndIndex, setTrailEndIndex] = useState(0);

  let rotation = new THREE.Euler(0, -Math.PI / 2, 0);
  let scale = 1;
  if (selectedModel === 'Jet') {
    rotation = new THREE.Euler(0, Math.PI / 2, 0);
  }
  if (selectedModel === 'Drone') {
    scale = 10;
  }

  // User-tuned orientation correction (degrees -> radians) applied on top of the
  // model's base mounting rotation so a mis-aligned model can be pointed correctly.
  const userRotation = useMemo(
    () => new THREE.Euler(
      THREE.MathUtils.degToRad(fileSettings.rotationX),
      THREE.MathUtils.degToRad(fileSettings.rotationY),
      THREE.MathUtils.degToRad(fileSettings.rotationZ),
    ),
    [fileSettings.rotationX, fileSettings.rotationY, fileSettings.rotationZ],
  );

  const allFlightDataPoints = useMemo(() => {
    if (!selectedLogFilename) return [];
    const logData = loadedLogs[selectedLogFilename];
    const altOffset = Math.max(0 - (logData?.stats.minAltitudeM ?? 0), 0) + terrainElevationOffset + fileSettings.verticalOffset;
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
  }, [selectedLogFilename, loadedLogs, terrainElevationOffset, fileSettings.verticalOffset]);

  // Trail of points already flown, split into contiguous same-mode segments so
  // it can be colour-coded by flight mode like the Stats page. Ends at
  // `trailEndIndex`, the plane's lagged position, so the line stays attached to
  // the eased plane rather than racing ahead of it. Keyed off the integer index
  // so the geometry only rebuilds when a new data point is reached, not on every
  // interpolated animation frame.
  const trailSegments = useMemo(() => {
    if (allFlightDataPoints.length === 0) return [];
    const endIndex = Math.min(allFlightDataPoints.length, trailEndIndex + 1);
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
  }, [allFlightDataPoints, trailEndIndex]);

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

    // Ease the rendered plane toward the raw interpolated pose with a frame-rate
    // independent low-pass filter, so its position and banking tween smoothly
    // instead of changing velocity abruptly at each data point.
    const planeAlpha = 1 - Math.exp(-delta / PLANE_SMOOTH_TAU);
    const planePos = planePosRef.current
      ? planePosRef.current.lerp(pose.position, planeAlpha)
      : pose.position.clone();
    planePosRef.current = planePos;

    const targetAttitude = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pose.roll, -pose.yaw - Math.PI, -pose.pitch, 'YXZ'),
    );
    const planeAttitude = planeAttitudeQuatRef.current ?? targetAttitude.clone();
    planeAttitude.slerp(targetAttitude, planeAlpha);
    planeAttitudeQuatRef.current = planeAttitude;

    // Mirror the plane's position lag as a scalar clock so the trail can end at
    // the plane. Eased with the same alpha as the rendered position, then
    // published as an integer data index (only when it changes) to keep the
    // trail geometry from rebuilding every frame.
    const planeClock = planeClockRef.current ?? progressClockRef.current;
    const nextPlaneClock = planeClock + (progressClockRef.current - planeClock) * planeAlpha;
    planeClockRef.current = nextPlaneClock;
    const nextTrailEnd = Math.floor(nextPlaneClock);
    setTrailEndIndex(prev => (prev === nextTrailEnd ? prev : nextTrailEnd));

    if (planeRootRef.current) {
      planeRootRef.current.position.copy(planePos);
      planeRootRef.current.quaternion.copy(pose.quaternion);
    }
    if (planeAttitudeRef.current) {
      planeAttitudeRef.current.quaternion.copy(planeAttitude);
    }

    const controls = controlsRef?.current;
    if (!controls || !camera) return;

    // Anchor the camera to a low-pass-filtered version of the plane position so
    // the rig glides forward instead of stepping with the path's per-point
    // velocity changes. The plane itself still uses its exact interpolated pose.
    const posAlpha = 1 - Math.exp(-delta / CAMERA_POS_SMOOTH_TAU);
    const pos = smoothedPosRef.current
      ? smoothedPosRef.current.lerp(pose.position, posAlpha)
      : pose.position.clone();
    smoothedPosRef.current = pos;
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
    smoothedPosRef.current = null;
    planePosRef.current = null;
    planeAttitudeQuatRef.current = null;
    planeClockRef.current = null;
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
          <group rotation={userRotation}>
            <group ref={groupRef} name="plane" rotateOnAxis={[0, 1, 0]} rotation={rotation} scale={scale}></group>
          </group>
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