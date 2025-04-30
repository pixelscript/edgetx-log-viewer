import getFresnelMat from "../shaders/getFresnelMat";
import * as THREE from "three";
import { EARTH_RADIUS } from "../consts";
export const EarthSphere = ({ textureUrl }: { textureUrl?: string }) => {
  const fresnelMat = getFresnelMat();
  const materialProps = textureUrl
    ? { map: new THREE.TextureLoader().load(textureUrl) }
    : { color: 0x808080 };
  return (
    <group>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS * 1.01, 128, 128]} />
        <shaderMaterial {...fresnelMat}/>
      </mesh>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
        <meshStandardMaterial {...materialProps} roughness={1.0} metalness={0.0} />
      </mesh>
    </group>
  );
};