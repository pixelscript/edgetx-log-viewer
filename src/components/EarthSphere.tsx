import React, { Suspense } from 'react';
import { useSelector } from 'react-redux';
import { useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

import getFresnelMat from '../shaders/getFresnelMat';
import { EARTH_RADIUS } from '../consts';
import { RootState } from '../state/store';
import { selectSelectedMapSourceId } from '../state/uiSlice';
import { mapSources, MapSource } from '../consts/mapSources';
import { getTileUrl, tileToBoundingBox, sphericalToCartesian, numTilesAtZoom } from '../utils/tileUtils';

const TILE_RENDERING_ZOOM_LEVEL = 2; // Start with a low zoom level (e.g., 2 -> 4x4 = 16 tiles)

interface TileMeshProps {
  tileX: number;
  tileY: number;
  tileZ: number;
  source: MapSource;
}

const TileMesh: React.FC<TileMeshProps> = ({ tileX, tileY, tileZ, source }) => {
  const tileUrl = getTileUrl(source, tileX, tileY, tileZ);
  const texture = useTexture(tileUrl);

  // Calculate tile's geographic bounding box and center
  const bbox = tileToBoundingBox(tileX, tileY, tileZ);
  const centerLat = (bbox.north + bbox.south) / 2;
  const centerLon = (bbox.east + bbox.west) / 2;

  // Convert center to Cartesian coordinates for positioning
  const position = sphericalToCartesian(centerLat, centerLon, EARTH_RADIUS);

  // Calculate plane dimensions based on geographic extent
  // This is an approximation for flat planes on a sphere
  const latSpanRad = (bbox.north - bbox.south) * Math.PI / 180;
  const lonSpanRad = (bbox.east - bbox.west) * Math.PI / 180;
  
  const planeHeight = EARTH_RADIUS * latSpanRad;
  // Apply cosine correction for longitude span based on latitude
  const planeWidth = EARTH_RADIUS * lonSpanRad * Math.cos(centerLat * Math.PI / 180);

  const meshRef = React.useRef<THREE.Mesh>(null!);

  React.useLayoutEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.set(position.x, position.y, position.z);
      meshRef.current.lookAt(0, 0, 0); // Point towards the center of the Earth
    }
  }, [position.x, position.y, position.z]);

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[planeWidth, planeHeight, 1, 1]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} transparent />
    </mesh>
  );
};

const MemoizedTileMesh = React.memo(TileMesh);

export const EarthSphere = () => {
  const fresnelMat = getFresnelMat();
  const selectedMapId = useSelector(selectSelectedMapSourceId);
  const selectedSource = mapSources.find(s => s.id === selectedMapId) || mapSources[0]; // Fallback to first source

  const tiles = [];
  const numTiles = numTilesAtZoom(TILE_RENDERING_ZOOM_LEVEL);

  // Determine the actual zoom level to render, respecting source limits
  const renderZoom = Math.min(TILE_RENDERING_ZOOM_LEVEL, selectedSource.maxZoomLevel);
  const actualNumTiles = numTilesAtZoom(renderZoom);

  for (let y = 0; y < actualNumTiles; y++) {
    for (let x = 0; x < actualNumTiles; x++) {
      tiles.push(
        <Suspense fallback={null} key={`${selectedSource.id}-${renderZoom}-${x}-${y}`}>
          <MemoizedTileMesh tileX={x} tileY={y} tileZ={renderZoom} source={selectedSource} />
        </Suspense>
      );
    }
  }

  return (
    <group>
      {/* Atmosphere */}
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS * 1.015, 64, 64]} />
        <shaderMaterial {...fresnelMat} transparent />
      </mesh>

      {/* Base Earth sphere (fallback or underneath tiles) */}
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS -1, 64, 64]} /> {/* Slightly smaller to avoid z-fighting */}
        <meshStandardMaterial color={0x33404F} roughness={1.0} metalness={0.0} />
      </mesh>

      {/* Dynamic Tiles */}
      {tiles}
    </group>
  );
};