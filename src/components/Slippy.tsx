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

      globe.updatePov(camera);
      const handleChange = () => {
        globe.updatePov(camera);
      };
      currentControls.addEventListener('change', handleChange);

      return () => {
        currentControls.removeEventListener('change', handleChange);
        if (groupRef.current && globe) {
          (groupRef.current as THREE.Group).remove(globe);
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