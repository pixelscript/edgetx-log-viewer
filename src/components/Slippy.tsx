import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useControlsContext } from '../contexts/ControlsContext';
import SlippyMapGlobe from 'three-slippy-map-globe';
import { EARTH_RADIUS } from '../consts';
import * as THREE from 'three';
import { selectMapType } from '../state/uiSlice';
import { getMapTileUrl } from '../utils/mapTiles';

export default function Slippy() {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { controlsRef } = useControlsContext();
  const currentMapType = useSelector(selectMapType);

  useEffect(() => {
    if (!controlsRef || !controlsRef.current || !groupRef.current) {
      return;
    }
    const currentControls = controlsRef.current;
    const currentGroup = groupRef.current;

    while (currentGroup.children.length > 0) {
      const child = currentGroup.children[0];
      currentGroup.remove(child);
    }

    let globe: SlippyMapGlobe | null = null;

    async function loadGlobe() {
      globe = new SlippyMapGlobe(EARTH_RADIUS, {
        tileUrl: (x, y, l) => getMapTileUrl(currentMapType, x, y, l),
      });
      currentGroup.add(globe);

      globe.updatePov(camera);
      const handleChange = () => {
        if (globe) {
          globe.updatePov(camera);
        }
      };
      currentControls.addEventListener('change', handleChange);

      return () => {
        currentControls.removeEventListener('change', handleChange);
        if (currentGroup && globe) {
          currentGroup.remove(globe);
        }
      };
    }

    const cleanupPromise = loadGlobe();

    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, [camera, controlsRef, currentMapType]);

  return (
    <group ref={groupRef} rotateOnAxis={[0, 1, 0]} rotation={[0, Math.PI / 2, 0]}>
    </group>
  );
}