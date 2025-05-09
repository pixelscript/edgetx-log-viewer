import React, { createContext, useState, useContext, ReactNode } from 'react';

interface PlaybackContextType {
  playbackProgress: number;
  setPlaybackProgress: React.Dispatch<React.SetStateAction<number>>;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

export const PlaybackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [playbackProgress, setPlaybackProgress] = useState(0);

  return (
    <PlaybackContext.Provider value={{ playbackProgress, setPlaybackProgress }}>
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