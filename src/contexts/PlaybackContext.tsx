import React, { createContext, useState, useContext, ReactNode } from 'react';

interface PlaybackContextType {
  playbackProgress: number;
  setPlaybackProgress: React.Dispatch<React.SetStateAction<number>>;
  followPlane: boolean;
  setFollowPlane: React.Dispatch<React.SetStateAction<boolean>>;
  selectedModel: string;
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

export const PlaybackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [followPlane, setFollowPlane] = useState(true);
  const [selectedModel, setSelectedModel] = useState('Small_Airplane'); 

  return (
    <PlaybackContext.Provider value={{ playbackProgress, setPlaybackProgress, followPlane, setFollowPlane, selectedModel, setSelectedModel }}>
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