import React, { createContext, useState, useContext, useRef, ReactNode } from 'react';

export type PlaybackCameraView = 'default' | 'follow' | 'fpv';

interface PlaybackContextType {
  playbackProgress: number;
  setPlaybackProgress: React.Dispatch<React.SetStateAction<number>>;
  // Continuous, fractional playback position (e.g. 12.37) used to interpolate
  // the plane pose and camera between data points each render frame. Kept in a
  // ref so the high-frequency animation clock never triggers React re-renders.
  progressClockRef: React.MutableRefObject<number>;
  cameraView: PlaybackCameraView;
  setCameraView: React.Dispatch<React.SetStateAction<PlaybackCameraView>>;
  selectedModel: string;
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
  // Playback speed multiplier (e.g. 10 = 10x real time). Shared so the camera
  // smoothing can react to how fast data points pass in wall-clock time.
  multiplier: number;
  setMultiplier: React.Dispatch<React.SetStateAction<number>>;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

export const PlaybackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const progressClockRef = useRef(0);
  const [cameraView, setCameraView] = useState<PlaybackCameraView>('default');
  const [selectedModel, setSelectedModel] = useState('Small_Airplane'); 
  const [multiplier, setMultiplier] = useState(10);

  return (
    <PlaybackContext.Provider value={{ playbackProgress, setPlaybackProgress, progressClockRef, cameraView, setCameraView, selectedModel, setSelectedModel, multiplier, setMultiplier }}>
      {children}
    </PlaybackContext.Provider>
  );
};

export const usePlayback = (): PlaybackContextType => {
  const context = useContext(PlaybackContext);
  if (context === undefined) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
};