import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EARTH_RADIUS } from '../consts';

const SKY_BLUE = new THREE.Color(0x87b9e6);
const SPACE_BLACK = new THREE.Color(0x000000);

// Altitude (metres) at which the sky is fully blue, and at which it has fully
// faded to the black of space.
const SKY_ALTITUDE_M = 1_000;
const SPACE_ALTITUDE_M = 200_000;

/**
 * Drives the scene background from the camera's altitude: blue sky near the
 * ground, fading to black as the camera climbs towards space.
 */
export const SkyBackground = () => {
  const { camera, scene } = useThree();
  const color = useRef(new THREE.Color());

  useFrame(() => {
    const altitude = camera.position.length() - EARTH_RADIUS;
    const t = THREE.MathUtils.clamp(
      (altitude - SKY_ALTITUDE_M) / (SPACE_ALTITUDE_M - SKY_ALTITUDE_M),
      0,
      1,
    );
    color.current.copy(SKY_BLUE).lerp(SPACE_BLACK, t);
    scene.background = color.current;
  });

  return null;
};
