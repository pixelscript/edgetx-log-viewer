import getFresnelMat from "../shaders/getFresnelMat";
import { useTexture } from "@react-three/drei";
import { EARTH_RADIUS } from "../consts";
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
        <sphereGeometry args={[EARTH_RADIUS * 0.998, 128, 128]} />
        <meshStandardMaterial {...materialProps} roughness={1.0} metalness={0.0} />
      </mesh>
    </group>
  );
};