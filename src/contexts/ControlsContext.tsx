import { createContext, useContext, RefObject } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'; // This is the type for the instance

type ControlsContextType = {
  controlsRef: RefObject<OrbitControlsImpl | null> | null;
};

export const ControlsContext = createContext<ControlsContextType>({
  controlsRef: null,
});

export const useControlsContext = () => {
  const context = useContext(ControlsContext);
  if (!context) {
    throw new Error('useControlsContext must be used within a ControlsProvider');
  }
  return context;
};