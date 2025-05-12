import React, { useState, useEffect, useCallback } from 'react';
import { Slider, Button, Group, Box, Select, Checkbox } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';
import { useSelector } from 'react-redux';
import { RootState } from '../state/store';
import { isEqual } from 'lodash';
import { usePlayback } from '../contexts/PlaybackContext';

const speedOptions = [
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '3', label: '3x' },
  { value: '4', label: '4x' },
  { value: '5', label: '5x' },
  { value: '10', label: '10x' },
  { value: '20', label: '20x' },
  { value: '30', label: '30x' },
  { value: '40', label: '40x' },
  { value: '50', label: '50x' },
  { value: '100', label: '100x' },
]

const modelOptions = [
  { value: 'Small_Airplane', label: 'Airplane' },
  { value: 'Jet', label: 'Jet' },
  { value: 'Drone', label: 'Drone' },
];

const PlaybackControls: React.FC = () => {
  const [progress, setPlaybackProgress] = useState(0);
  const { setPlaybackProgress: setGlobalPlaybackProgress, followPlane, setFollowPlane, selectedModel, setSelectedModel } = usePlayback();
  const [isPlaying, setIsPlaying] = useState(false);
  const [multiplier, setMultiplier] = useState(10);
  const selectedLogData = useSelector((state: RootState) =>
    state.logs.selectedLogFilename ? state.logs.loadedLogs[state.logs.selectedLogFilename] : null
    , isEqual);
  const duration = selectedLogData?.entries.length ? selectedLogData.entries.length - 1 : 100;
  const intervalRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleSliderChange = (value: number) => {
    setPlaybackProgress(value);
    setGlobalPlaybackProgress(value);
    if (isPlaying) {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      if (progress >= duration) {
        setIsPlaying(false);
        setPlaybackProgress(duration);
        setGlobalPlaybackProgress(duration);
        return;
      }
      const intValLength = Math.max(selectedLogData?.entries[progress].timeDelta as number, 1) / multiplier;
      intervalRef.current = setTimeout(() => {
        setPlaybackProgress(prevProgress => Math.min(prevProgress + 1, duration));
        setGlobalPlaybackProgress(progress);
      }, intValLength);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, progress, duration, setPlaybackProgress, multiplier]);

  useEffect(() => {
    setPlaybackProgress(0);
    setGlobalPlaybackProgress(0);
    setIsPlaying(false);
  }, [selectedLogData, setPlaybackProgress]);

  return (
    <Box p="md">
      <Group>
        <Select
          size="xs"
          data={speedOptions}
          defaultValue="10"
          onChange={(value) => {
            if (value) {
              setMultiplier(parseInt(value));
            }
          }}
        />
        <Button onClick={handlePlayPause} variant="light" size="xs" disabled={!selectedLogData || progress >= duration}>
          {isPlaying ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
        </Button>
        <Slider
          value={progress}
          onChange={handleSliderChange}
          min={0}
          max={duration}
          step={1}
          label={(value) => `${Math.round((value / duration) * 100)}%`}
          style={{ flex: 1 }}
          disabled={!selectedLogData}
        />
        <Checkbox
          label="Follow Plane"
          checked={followPlane}
          onChange={(event) => setFollowPlane(event.currentTarget.checked)}
          disabled={!selectedLogData}
          size="xs"
        />
        <Select
          size="xs"
          data={modelOptions}
          value={selectedModel}
          onChange={(value) => {
            if (value) {
              setSelectedModel(value);
            }
          }}
          disabled={!selectedLogData}
        />
      </Group>
    </Box>
  );
};

export default PlaybackControls;