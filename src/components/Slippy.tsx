import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useControlsContext } from '../contexts/ControlsContext';
import SlippyMapGlobe from 'three-slippy-map-globe';
import { EARTH_RADIUS } from '../consts';
import * as THREE from 'three';
export default function Slippy() {
  const groupRef = useRef(null)
  const { camera } = useThree();
  const { controlsRef } = useControlsContext();

  useEffect(() => {
    if (!controlsRef || !controlsRef.current) {
      // Controls not ready yet, or not provided
      return;
    }
    const currentControls = controlsRef.current;

    async function loadGlobe() {
      const globe = new SlippyMapGlobe(EARTH_RADIUS, {
        // https://tile.openstreetmap.org/${l}/${x}/${y}.png
        // https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
        tileUrl: (x, y, l) => `https://tile.openstreetmap.org/${l}/${x}/${y}.png`
      });
      if (groupRef.current) {
        (groupRef.current as THREE.Group).add(globe);
      }


      // camera.near = 1e-3;
      // camera.far = EARTH_RADIUS * 100;
      // camera.updateProjectionMatrix();
      // camera.position.z = EARTH_RADIUS * 6; // Position is now controlled by CameraController

      // currentControls.minDistance = EARTH_RADIUS * (1 + 5 / 2 ** globe.maxLevel);
      // currentControls.maxDistance = camera.far - EARTH_RADIUS;

      globe.updatePov(camera);
      const handleChange = () => {
        globe.updatePov(camera);
        // const distToSurface = camera.position.distanceTo(globe.position) - EARTH_RADIUS;
        // currentControls.rotateSpeed = distToSurface / EARTH_RADIUS * 0.4;
        // currentControls.zoomSpeed = Math.sqrt(distToSurface / EARTH_RADIUS) * 0.6;
      };
      currentControls.addEventListener('change', handleChange);

      // Cleanup function
      return () => {
        currentControls.removeEventListener('change', handleChange);
        if (groupRef.current && globe) {
          (groupRef.current as THREE.Group).remove(globe);
          // globe.dispose(); // If globe has a dispose method
        }
      };
    }

    loadGlobe();
  }, [camera, controlsRef]);

  return (
    <group ref={groupRef} rotateOnAxis={[0, 1, 0]} rotation={[0, Math.PI / 2, 0]}>
    </group>
  );
}