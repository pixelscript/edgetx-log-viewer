import * as THREE from 'three';
import { useSelector } from 'react-redux';
import { RootState } from '../state/store';
export const Lights = () => {
  const pos = useSelector((state: RootState) => new THREE.Vector3(state.logs.targetCenter?.x, state.logs.targetCenter?.y, state.logs.targetCenter?.z));
  return pos && (
  <>
    <ambientLight intensity={0.4} />
    <directionalLight position={pos} intensity={2} />
  </>
  );
};
