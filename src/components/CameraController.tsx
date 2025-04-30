
import { OrbitControls} from '@react-three/drei';
import { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../state/store';
import { latLongToCartesian } from '../utils';
import { EARTH_RADIUS } from '../consts';
import { useThree } from '@react-three/fiber';
import type { LogEntry, GPS } from '../state/types/logTypes';
import { setTargetCenter } from '../state/logsSlice';
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


export const CameraController = () => {
  const controlsRef = useRef<any>(null);
  const { camera, gl } = useThree();
  const dispatch = useDispatch();
  const { selectedLogFilename, loadedLogs } = useSelector((state: RootState) => state.logs);
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
      const startCoord = pathCoordinates[0];
      camPos = latLongToCartesian(startCoord.latitude, startCoord.longitude,  2000);
    }
    dispatch(setTargetCenter({x: targetCenter.x, y: targetCenter.y, z: targetCenter.z}));
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
  );
};