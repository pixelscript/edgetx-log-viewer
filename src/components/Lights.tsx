import * as THREE from 'three';
import { useSelector } from 'react-redux';
import { RootState } from '../state/store';
import { isEqual } from 'lodash';
export const Lights = () => {
  const targetCenter = useSelector((state: RootState) => state.logs.targetCenter, isEqual);
  const pos = new THREE.Vector3(targetCenter?.x, targetCenter?.y, targetCenter?.z)
  return pos && (
  <>
    <ambientLight intensity={0.4} />
    <directionalLight position={pos} intensity={2} />
  </>
  );
};
