import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useControlsContext } from '../contexts/ControlsContext';
import SlippyMapGlobe from 'three-slippy-map-globe';
import { EARTH_RADIUS } from '../consts';
import * as THREE from 'three';
import { selectMapType } from '../state/uiSlice';
import { MapType } from '../consts/earth';

function tileXYToQuadKey(tileX: number, tileY: number, levelOfDetail: number): string {
  let quadKey = '';
  for (let i = levelOfDetail; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((tileX & mask) !== 0) {
      digit++;
    }
    if ((tileY & mask) !== 0) {
      digit++;
      digit++;
    }
    quadKey += digit.toString();
  }
  return quadKey;
}

function getBingMapsServerNum(tileX: number, tileY: number): number {
  return (tileX + tileY) % 4;
}

export default function Slippy() {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { controlsRef } = useControlsContext();
  const currentMapType = useSelector(selectMapType);

  const getTileUrl = (mapType: MapType, x: number, y: number, l: number): string => {
    switch (mapType) {
      case MapType.MapBox:
        console.warn('MapBox tile URL requires an access token and style. Using OpenStreetMap as fallback.');
        return `https://tile.openstreetmap.org/${l}/${x}/${y}.png`;
      case MapType.EsriWorld:
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l}/${y}/${x}`;
      case MapType.BingMap:
        const quadKey = tileXYToQuadKey(x, y, l);
        const serverNum = getBingMapsServerNum(x,y);
        return `https://ecn.t${serverNum}.tiles.virtualearth.net/tiles/a${quadKey}.jpeg?g=563&mkt=en-US&device=mobile`;
      case MapType.BingMapHybrid:
        const quadKeyHybrid = tileXYToQuadKey(x, y, l);
        const serverNumHybrid = getBingMapsServerNum(x,y);
        return `https://ecn.t${serverNumHybrid}.tiles.virtualearth.net/tiles/h${quadKeyHybrid}.jpeg?g=563&mkt=en-US&device=mobile`;
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

    while (currentGroup.children.length > 0) {
      const child = currentGroup.children[0];
      currentGroup.remove(child);
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