
import { OrbitControls } from '@react-three/drei';
import { useEffect, useRef, useMemo, PropsWithChildren } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ControlsContext } from '../contexts/ControlsContext';
import * as THREE from 'three';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../state/store';
import { latLongToCartesian } from '../utils';
import { EARTH_RADIUS } from '../consts';
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
    if (controlsRef.current) {
      controlsRef.current.target.copy(targetCenter);
      camera.position.copy(camPos);
      controlsRef.current.update();
    } else {
      camera.position.copy(camPos);
      camera.lookAt(targetCenter);
    }

  }, [pathCoordinates, camera, controlsRef]);

  return (
    <ControlsContext.Provider value={{ controlsRef }}>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        camera={camera}
        domElement={gl.domElement}
        enableDamping
        dampingFactor={1}
        zoomSpeed={0.4}
        rotateSpeed={0.3}
      />
      {children}
    </ControlsContext.Provider>
  );
};