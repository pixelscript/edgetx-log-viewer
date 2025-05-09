import React, { useState, useEffect, useCallback } from 'react';
import { Slider, Button, Group, Box, Select } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../state/store';
import { setPlaybackProgress } from '../state/logsSlice';
import { isEqual } from 'lodash';
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
  { value: '200', label: '200x' },
  { value: '300', label: '300x' },
  { value: '400', label: '400x' },
  { value: '500', label: '500x' },
]
const PlaybackControls: React.FC = () => {
  const dispatch = useDispatch();
  const [isPlaying, setIsPlaying] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const progress = useSelector((state: RootState) => state.logs.playbackProgress);
  const selectedLogData = useSelector((state: RootState) =>
    state.logs.selectedLogFilename ? state.logs.loadedLogs[state.logs.selectedLogFilename] : null
  , isEqual);
  const duration = selectedLogData?.entries.length ? selectedLogData.entries.length - 1 : 100;
  const intervalRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleSliderChange = (value: number) => {
    dispatch(setPlaybackProgress(value));
    if (isPlaying) {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      if (progress >= duration) {
          setIsPlaying(false);
          dispatch(setPlaybackProgress(duration));
          return;
      }
      intervalRef.current = setInterval(() => {
        dispatch(setPlaybackProgress(progress + multiplier));
      }, 0);
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
  }, [isPlaying, progress, duration, dispatch]);

  useEffect(() => {
    dispatch(setPlaybackProgress(0));
    setIsPlaying(false);
  }, [selectedLogData, dispatch]);


  return (
    <Box p="md">
      <Group>
        <Select
          size="xs"
          data={speedOptions}
          defaultValue="1"
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
      </Group>
    </Box>
  );
};

export default PlaybackControls;