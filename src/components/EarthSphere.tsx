import getFresnelMat from "../shaders/getFresnelMat";
import { useTexture } from "@react-three/drei";
import { EARTH_RADIUS } from "../consts";

// The base globe sits just beneath the true sphere surface (where the slippy
// map and terrain are draped) so it never pokes through, while staying close
// enough not to leave a visible "cliff" at the edge of the loaded map area. The
// scene's logarithmic depth buffer keeps this small offset free of z-fighting.
const BASE_SURFACE_DROP_M = 200;
// Across such a large radius, flat triangle faces sag far below the true
// surface between vertices (the sagitta is ~1.9 km at 128 segments, but only
// ~120 m at 512), so the base globe needs fine tessellation to hug the surface.
const BASE_SPHERE_SEGMENTS = 512;

export const EarthSphere = ({ textureUrl }: { textureUrl?: string }) => {
  const fresnelMat = getFresnelMat();
  const texture = textureUrl ? useTexture(textureUrl) : null;
  const materialProps = texture ? { map: texture } : { color: 0x808080 };
  return (
    <group>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS * 1.01, 128, 128]} />
        <shaderMaterial {...fresnelMat}/>
      </mesh>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS - BASE_SURFACE_DROP_M, BASE_SPHERE_SEGMENTS, BASE_SPHERE_SEGMENTS]} />
        <meshStandardMaterial {...materialProps} roughness={1.0} metalness={0.0} />
      </mesh>
    </group>
  );
};