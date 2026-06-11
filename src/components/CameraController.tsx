
import { OrbitControls } from '@react-three/drei';
import { useEffect, useRef, useMemo, PropsWithChildren } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ControlsContext } from '../contexts/ControlsContext';
import * as THREE from 'three';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../state/store';
import { latLongToCartesian } from '../utils';
import { EARTH_RADIUS, EARTH_CENTER } from '../consts';
import { useThree } from '@react-three/fiber';
import type { LogEntry, GPS } from '../state/types/logTypes';
import { setTargetCenter } from '../state/logsSlice';
import { isEqual } from 'lodash';

// Maximum tilt from the local vertical: stop just short of 90° so the camera
// can look to the horizon but never swing under the planet.
const MAX_POLAR_ANGLE = 1.48;

const getCoordinatesFromEntries = (entries: LogEntry[]): { latitude: number; longitude: number; altitude: number }[] => {
  return entries
    .map(entry => {
      const gps = entry['gps'] as GPS | undefined;
      const alt = entry['alt'] as number | undefined;
      if (gps && typeof alt === 'number' && typeof gps.lat === 'number' && typeof gps.long === 'number') {
        return { latitude: gps.lat, longitude: gps.long, altitude: alt };
      }
      return null;
    })
    .filter((coord): coord is { latitude: number; longitude: number; altitude: number } => coord !== null);
};


export const CameraController = ({ children }: PropsWithChildren) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera, gl } = useThree();
  const dispatch = useDispatch();
  const { selectedLogFilename, loadedLogs } = useSelector((state: RootState) => {
    return {
      selectedLogFilename: state.logs.selectedLogFilename,
      loadedLogs: state.logs.loadedLogs
    };
  }, isEqual);
  const viewMode = useSelector((state: RootState) => state.ui.viewMode);
  const pathCoordinates = useMemo(() => {
    const currentLog = selectedLogFilename ? loadedLogs[selectedLogFilename] : null;
    return currentLog ? getCoordinatesFromEntries(currentLog.entries) : [];
  }, [selectedLogFilename, loadedLogs]);


  useEffect(() => {
    let points = pathCoordinates.map(coord =>
      latLongToCartesian(coord.latitude, coord.longitude, coord.altitude)
    );

    let camPos: THREE.Vector3;
    let targetCenter: THREE.Vector3;

    if (points.length === 0) {
      targetCenter = latLongToCartesian(51.509865, -0.118092, 0);
      camPos = latLongToCartesian(51.509865, -0.118092, EARTH_RADIUS * 1.5);
    } else {
      const box = new THREE.Box3().setFromPoints(points);
      targetCenter = new THREE.Vector3();
      box.getCenter(targetCenter);

      const size = new THREE.Vector3();
      box.getSize(size);
      const radius = size.length() / 2;

      if (!(camera instanceof THREE.PerspectiveCamera)) {
        throw new Error('Camera is not a PerspectiveCamera, fov is unavailable.');
      }
      const fov = (camera.fov * Math.PI) / 180;
      const aspect = camera.aspect;
      const distanceY = radius / Math.sin(fov / 2);
      const distanceX = radius / Math.sin(Math.atan(Math.tan(fov / 2) * aspect));
      const distance = Math.max(distanceX, distanceY);
      const direction = targetCenter.clone().normalize();
      camPos = direction.multiplyScalar(targetCenter.length() + distance);
    }
    dispatch(setTargetCenter({ x: targetCenter.x, y: targetCenter.y, z: targetCenter.z }));
    // Align the camera's up axis to the local surface normal so the orbit pole
    // is "straight up" at the flight location. This keeps the horizon level and
    // makes tilt/rotation feel natural, like Google Earth, instead of orbiting
    // around the globe's fixed Y axis.
    camera.up.copy(targetCenter).normalize();
    if (controlsRef.current) {
      controlsRef.current.target.copy(targetCenter);
      camera.position.copy(camPos);
      controlsRef.current.update();
    } else {
      camera.position.copy(camPos);
      camera.lookAt(targetCenter);
    }

  }, [pathCoordinates, camera, controlsRef]);

  // Google Earth-style interaction: when a drag begins, move the orbit pivot to
  // the surface point at the centre of the view. Because the camera already
  // looks at its target, the new pivot lies on the same view ray, so only the
  // pivot distance changes — rotation then happens around what is in front of
  // the camera without the view jumping. Zoom still tracks the cursor.
  // Disabled during playback, where the camera follows the plane and the orbit
  // target is driven externally; re-pivoting there would fight that and jump.
  useEffect(() => {
    const dom = gl.domElement;
    const controls = controlsRef.current;
    if (!dom || !controls || viewMode === 'playback') {
      return;
    }

    const raycaster = new THREE.Raycaster();
    const globe = new THREE.Sphere(EARTH_CENTER, EARTH_RADIUS);
    const center = new THREE.Vector2(0, 0);
    const hit = new THREE.Vector3();

    const repivot = () => {
      raycaster.setFromCamera(center, camera);
      if (!raycaster.ray.intersectSphere(globe, hit)) {
        return;
      }
      controls.target.copy(hit);
      controls.update();
    };

    dom.addEventListener('pointerdown', repivot);
    return () => dom.removeEventListener('pointerdown', repivot);
  }, [camera, gl, controlsRef, viewMode]);

  // Dedicated tilt control: middle-button drag changes only the pitch (polar
  // angle) around the orbit pivot, clamped to the same horizon limit as the
  // controls. Middle has no OrbitControls mapping, so there is no conflict.
  useEffect(() => {
    const dom = gl.domElement;
    const controls = controlsRef.current;
    if (!dom || !controls) {
      return;
    }

    const MIN_POLAR = 0.02;
    const MAX_POLAR = MAX_POLAR_ANGLE;
    const TILT_SPEED = 0.005;

    const target = new THREE.Vector3();
    const offset = new THREE.Vector3();
    const up = new THREE.Vector3();
    const right = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    let dragging = false;
    let lastY = 0;

    const onDown = (event: PointerEvent) => {
      if (event.button !== 1) {
        return;
      }
      event.preventDefault();
      dragging = true;
      lastY = event.clientY;
      dom.setPointerCapture(event.pointerId);
    };

    const onMove = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }
      const deltaY = event.clientY - lastY;
      lastY = event.clientY;

      target.copy(controls.target);
      offset.copy(camera.position).sub(target);
      up.copy(camera.up).normalize();
      // Use the camera's own horizontal axis (local X) as the tilt axis. Unlike
      // forward × up, this stays valid when looking straight down (forward
      // anti-parallel to up), which is the initial view — so tilt works on
      // first load without needing a rotate first.
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      right.addScaledVector(up, -right.dot(up));
      if (right.lengthSq() < 1e-8) {
        return;
      }
      right.normalize();

      // Dragging down tilts towards the horizon (larger polar angle).
      const currentPolar = offset.angleTo(up);
      const targetPolar = THREE.MathUtils.clamp(
        currentPolar + deltaY * TILT_SPEED,
        MIN_POLAR,
        MAX_POLAR,
      );
      const deltaPolar = targetPolar - currentPolar;

      // Rotating about the right axis changes the polar angle by ±deltaPolar;
      // pick the sign that actually moves towards the requested angle.
      quaternion.setFromAxisAngle(right, deltaPolar);
      if (Math.abs(offset.clone().applyQuaternion(quaternion).angleTo(up) - targetPolar) > 1e-3) {
        quaternion.setFromAxisAngle(right, -deltaPolar);
      }
      offset.applyQuaternion(quaternion);

      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      controls.update();
    };

    const onUp = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }
      dragging = false;
      if (dom.hasPointerCapture(event.pointerId)) {
        dom.releasePointerCapture(event.pointerId);
      }
    };

    dom.addEventListener('pointerdown', onDown, { capture: true });
    dom.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      dom.removeEventListener('pointerdown', onDown, { capture: true });
      dom.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [camera, gl, controlsRef]);

  return (
    <ControlsContext.Provider value={{ controlsRef }}>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        camera={camera}
        domElement={gl.domElement}
        enableDamping={false}
        dampingFactor={0.12}
        rotateSpeed={0.5}
        zoomSpeed={0.6}
        panSpeed={0.8}
        zoomToCursor
        screenSpacePanning={false}
        minDistance={2}
        maxDistance={EARTH_RADIUS * 4}
        maxPolarAngle={MAX_POLAR_ANGLE}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      />
      {children}
    </ControlsContext.Provider>
  );
};