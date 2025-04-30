import { useSelector } from 'react-redux';
import { RootState } from '../state/store';
export const Lights = () => {
  const pos = useSelector((state: RootState) => state.logs.targetCenter);
  return pos && (
  <>
    <ambientLight intensity={0.4} />
    <directionalLight position={pos} intensity={2} />
  </>
  );
};
