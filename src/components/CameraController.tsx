
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
  useEffect(() => {
    const dom = gl.domElement;
    const controls = controlsRef.current;
    if (!dom || !controls) {
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
  }, [camera, gl, controlsRef]);

  return (
    <ControlsContext.Provider value={{ controlsRef }}>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        camera={camera}
        domElement={gl.domElement}
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.5}
        zoomSpeed={0.6}
        panSpeed={0.8}
        zoomToCursor
        screenSpacePanning={false}
        minDistance={2}
        maxDistance={EARTH_RADIUS * 4}
        maxPolarAngle={1.48}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      />
      {children}
    </ControlsContext.Provider>
  );
};