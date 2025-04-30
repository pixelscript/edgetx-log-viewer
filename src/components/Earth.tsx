import { Canvas } from '@react-three/fiber';
import { EarthSphere } from './EarthSphere';
import { PathLines } from './PathLines';
import { Lights } from './Lights';
import { CameraController } from './CameraController';

const EarthScene = ({
  textureUrl,
}: {
  textureUrl?: string;
}) => {
  return (
    <Canvas camera={{ fov: 75, near: 0.1, far: 1e9 }} gl={{ logarithmicDepthBuffer: true, antialias: true }}>
      <color attach="background" args={[0x000000]} />
      <Lights />
      <EarthSphere textureUrl={textureUrl} />
      <PathLines />
      <CameraController />
    </Canvas>
  );
};

export default EarthScene;
