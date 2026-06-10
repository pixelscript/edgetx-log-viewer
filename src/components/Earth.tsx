import { Canvas } from '@react-three/fiber';
import { EarthSphere } from './EarthSphere';
import { PathLines } from './PathLines';
import PlaybackPathLine from './PlaybackPathLine';
import { Lights } from './Lights';
import { CameraController } from './CameraController';
import { useSelector } from 'react-redux';
import { RootState } from '../state/store';
import Slippy from './Slippy';
import Terrain from './Terrain';
const EarthScene = ({
  textureUrl,
}: {
  textureUrl?: string;
}) => {
  const viewMode = useSelector((state: RootState) => state.ui.viewMode);
  const showTerrain = useSelector((state: RootState) => state.ui.showTerrain);
  const isPlaybackMode = viewMode === 'playback';
  return (
    <Canvas camera={{ fov: 75, near: 0.1, far: 1e9 }} gl={{ logarithmicDepthBuffer: true, antialias: true }}>
      <CameraController>
        <color attach="background" args={[0x000000]} />
        <Lights />
        {!showTerrain && <Slippy />}
        {showTerrain && <Terrain />}
        <EarthSphere textureUrl={textureUrl} />
        {!isPlaybackMode && <PathLines />}
        {isPlaybackMode && <PlaybackPathLine />}
      </CameraController>
    </Canvas>
  );
};

export default EarthScene;
