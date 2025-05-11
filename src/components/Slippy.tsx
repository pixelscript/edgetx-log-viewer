import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useControlsContext } from '../contexts/ControlsContext';
import SlippyMapGlobe from 'three-slippy-map-globe';
import { EARTH_RADIUS } from '../consts';
import * as THREE from 'three';
import { selectMapType } from '../state/uiSlice';
import { MapType } from '../consts/earth';

export default function Slippy() {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { controlsRef } = useControlsContext();
  const currentMapType = useSelector(selectMapType);

  const getTileUrl = (mapType: MapType, x: number, y: number, l: number): string => {
    switch (mapType) {
      case MapType.MapBox:
        // Replace with your MapBox access token and style
        // Example: return `https://api.mapbox.com/styles/v1/your_username/your_style_id/tiles/${l}/${x}/${y}?access_token=YOUR_MAPBOX_ACCESS_TOKEN`;
        console.warn('MapBox tile URL requires an access token and style. Using OpenStreetMap as fallback.');
        return `https://tile.openstreetmap.org/${l}/${x}/${y}.png`;
      case MapType.EsriWorld:
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l}/${y}/${x}`;
      case MapType.BingMap:
        // Bing Maps requires a more complex setup for tile URLs, often involving a QuadKey.
        // This is a placeholder and might need a specific library or utility for Bing.
        console.warn('Bing Maps tile URL is not fully implemented, using OpenStreetMap as fallback.');
        return `https://tile.openstreetmap.org/${l}/${x}/${y}.png`;
      case MapType.OpenStreetMap:
      default:
        return `https://tile.openstreetmap.org/${l}/${x}/${y}.png`;
    }
  };

  useEffect(() => {
    if (!controlsRef || !controlsRef.current || !groupRef.current) {
      return;
    }
    const currentControls = controlsRef.current;
    const currentGroup = groupRef.current;

    // Clear previous globe if any
    while (currentGroup.children.length > 0) {
      const child = currentGroup.children[0];
      currentGroup.remove(child);
      if (child instanceof SlippyMapGlobe) {
        // If you have a dispose method for SlippyMapGlobe, call it here
        // child.dispose();
      }
    }

    let globe: SlippyMapGlobe | null = null;

    async function loadGlobe() {
      globe = new SlippyMapGlobe(EARTH_RADIUS, {
        tileUrl: (x, y, l) => getTileUrl(currentMapType, x, y, l),
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
          // If you have a dispose method for SlippyMapGlobe, call it here
          // globe.dispose();
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