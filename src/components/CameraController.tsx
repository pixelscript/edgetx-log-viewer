
import { OrbitControls} from '@react-three/drei';
import { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../state/store';
import { latLongToCartesian } from '../utils';
import { EARTH_RADIUS } from '../consts';
import { useThree, useFrame } from '@react-three/fiber';
import type { LogEntry, GPS } from '../state/types/logTypes';
import { setTargetCenter } from '../state/logsSlice';
import { isEqual } from 'lodash';
import { selectFocusCameraOnModel } from '../state/uiSlice';
import { usePlayback } from '../contexts/PlaybackContext';

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
  const { selectedLogFilename, loadedLogs } = useSelector((state: RootState) => {
    return {
      selectedLogFilename: state.logs.selectedLogFilename,
      loadedLogs: state.logs.loadedLogs
    };
  }, isEqual);

  const focusCameraOnModel = useSelector(selectFocusCameraOnModel);
  const { playbackProgress } = usePlayback();

  const pathCoordinates = useMemo(() => {
    const currentLog = selectedLogFilename ? loadedLogs[selectedLogFilename] : null;
    return currentLog ? getCoordinatesFromEntries(currentLog.entries) : [];
  }, [selectedLogFilename, loadedLogs]);


  // Effect for general camera setup (when not focusing on model)
  useEffect(() => {
    if (focusCameraOnModel) return; // Don't run if focus mode is active

    let points = pathCoordinates.map(coord =>
      latLongToCartesian(coord.latitude, coord.longitude, coord.altitude)
    );

    let camPos: THREE.Vector3;
    let targetCenter: THREE.Vector3;

    if (points.length === 0) {
      targetCenter = latLongToCartesian(51.509865, -0.118092, 0); // Default to London
      camPos = latLongToCartesian(51.509865, -0.118092, EARTH_RADIUS * 1.5);
    } else {
      const box = new THREE.Box3().setFromPoints(points);
      targetCenter = new THREE.Vector3();
      box.getCenter(targetCenter);
      // Position camera above the start of the path or center
      const startCoord = pathCoordinates[0];
      camPos = latLongToCartesian(startCoord.latitude, startCoord.longitude, startCoord.altitude + 2000); // Elevate camera
    }
    dispatch(setTargetCenter({x: targetCenter.x, y: targetCenter.y, z: targetCenter.z}));

    if (controlsRef.current) {
        controlsRef.current.target.copy(targetCenter);
        camera.position.copy(camPos);
        controlsRef.current.update();
    } else {
        // Fallback if controlsRef is not yet available (e.g., initial render)
        camera.position.copy(camPos);
        camera.lookAt(targetCenter);
    }
  }, [pathCoordinates, camera, controlsRef, focusCameraOnModel, dispatch]); // Removed gl.domElement from deps


  // useFrame for smooth camera following when focusCameraOnModel is true
  const lastDirectionOfTravelRef = useRef(new THREE.Vector3(0, 0, 1)); // Store last stable direction

  useFrame(() => {
    if (!focusCameraOnModel || !selectedLogFilename || !controlsRef.current) {
      return;
    }

    const currentLog = loadedLogs[selectedLogFilename];
    if (!currentLog || currentLog.entries.length === 0) {
      return;
    }

    const entryIndex = Math.floor(playbackProgress);
    const currentEntry = currentLog.entries[entryIndex];

    if (!currentEntry) return;

    const gps = currentEntry['gps'] as GPS | undefined;
    const alt = currentEntry['alt'] as number | undefined;

    if (gps && typeof alt === 'number') {
      const planePosition = latLongToCartesian(gps.lat, gps.long, alt);
      
      // Update directionOfTravel only if there's significant movement
      if (entryIndex > 0) {
        const prevEntry = currentLog.entries[entryIndex - 1];
        const prevGps = prevEntry['gps'] as GPS | undefined;
        const prevAlt = prevEntry['alt'] as number | undefined;
        if (prevGps && typeof prevAlt === 'number') {
          const previousPlanePosition = latLongToCartesian(prevGps.lat, prevGps.long, prevAlt);
          const travelVector = planePosition.clone().sub(previousPlanePosition);
          // Increased threshold for significant movement to avoid noise
          if (travelVector.lengthSq() > 0.1 * 0.1) {
            lastDirectionOfTravelRef.current = travelVector.normalize();
          }
        }
      }
      const directionOfTravel = lastDirectionOfTravelRef.current;

      // Camera target is the plane's position
      controlsRef.current.target.copy(planePosition);

      const earthUp = planePosition.clone().normalize(); // Local 'up' on the sphere
      
      // Ensure directionOfTravel is not parallel to earthUp (can happen at poles or if looking straight up/down)
      // If it is, pick an arbitrary perpendicular direction for 'side'.
      let sideVector: THREE.Vector3;
      if (Math.abs(directionOfTravel.dot(earthUp)) > 0.99) { // Vectors are nearly parallel
        // If directionOfTravel is aligned with earthUp, choose an arbitrary side (e.g., local East)
        // A common way is to cross with a non-parallel vector like (0,1,0) or (1,0,0) world space,
        // then ensure it's perpendicular to earthUp.
        const arbitraryNonParallel = earthUp.x === 0 && earthUp.z === 0 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,0,1); // Avoid crossing with itself if earthUp is Y
        sideVector = new THREE.Vector3().crossVectors(earthUp, arbitraryNonParallel).normalize();
      } else {
        sideVector = new THREE.Vector3().crossVectors(directionOfTravel, earthUp).normalize();
      }


      // Define camera offset relative to the plane's derived orientation
      // "in front and to the side"
      const frontDistance = -60; // Negative: camera is in front of the plane (along directionOfTravel)
      const sideDistance = 30;   // Positive: camera is to the right of the plane
      const upDistance = 15;     // Positive: camera is above the plane

      const offset = new THREE.Vector3();
      offset.addScaledVector(directionOfTravel, frontDistance);
      offset.addScaledVector(sideVector, sideDistance);
      offset.addScaledVector(earthUp, upDistance); // Use earthUp for the vertical component of the offset

      const cameraPosition = planePosition.clone().add(offset);
      camera.position.copy(cameraPosition);
      camera.up.copy(earthUp); // Set camera's up vector to keep it level with the horizon
      
      camera.lookAt(planePosition);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      camera={camera}
      domElement={gl.domElement}
      enabled={!focusCameraOnModel} // Disable controls when focusing on model
      enableDamping
      dampingFactor={1}
      zoomSpeed={0.4}
      rotateSpeed={0.3}
    />
  );
};