import React, { useState, useEffect, useCallback } from 'react';
import { Slider, Button, Group, Box, Select, ActionIcon, Text, Checkbox } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause, IconSettings } from '@tabler/icons-react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../state/store';
import { isEqual } from 'lodash';
import { usePlayback } from '../contexts/PlaybackContext';
import { togglePlaybackSettings, setYawOffset, selectIsPlaybackSettingsOpen, selectYawOffset, toggleFocusCameraOnModel, selectFocusCameraOnModel } from '../state/uiSlice';
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
  const [progress, setPlaybackProgress] = useState(0);
  const { setPlaybackProgress: setGlobalPlaybackProgress } = usePlayback();
  const [isPlaying, setIsPlaying] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const selectedLogData = useSelector((state: RootState) =>
    state.logs.selectedLogFilename ? state.logs.loadedLogs[state.logs.selectedLogFilename] : null
  , isEqual);
  const duration = selectedLogData?.entries.length ? selectedLogData.entries.length - 1 : 100;
  const intervalRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPlaybackSettingsOpen = useSelector(selectIsPlaybackSettingsOpen);
  const yawOffset = useSelector(selectYawOffset);
  const focusCameraOnModel = useSelector(selectFocusCameraOnModel);

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

  const handleYawOffsetChange = (value: number) => {
    dispatch(setYawOffset(value));
  };

  const handleToggleSettings = () => {
    dispatch(togglePlaybackSettings());
  };

  const handleFocusCameraToggle = () => {
    dispatch(toggleFocusCameraOnModel());
  };

  useEffect(() => {
    if (isPlaying) {
      if (progress >= duration) {
          setIsPlaying(false);
          setPlaybackProgress(duration);
          setGlobalPlaybackProgress(duration);
          return;
      }
      intervalRef.current = setInterval(() => {
        setPlaybackProgress(prevProgress => Math.min(prevProgress + multiplier, duration));
        setGlobalPlaybackProgress(progress);
      }, 1);
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
  }, [isPlaying, progress, duration, setPlaybackProgress, multiplier, setGlobalPlaybackProgress]); // Added setGlobalPlaybackProgress to dependency array

  useEffect(() => {
    setPlaybackProgress(0);
    setGlobalPlaybackProgress(0);
    setIsPlaying(false);
  }, [selectedLogData, setPlaybackProgress, setGlobalPlaybackProgress]); // Added setGlobalPlaybackProgress to dependency array


  return (
    <Box p="md">
      <Group > {/* Removed noWrap, position, spacing */}
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
        <ActionIcon onClick={handleToggleSettings} variant="light" size="lg" > {/* Changed size to lg to match button */}
          <IconSettings size={16} />
        </ActionIcon>
      </Group>
      {isPlaybackSettingsOpen && (
        <Box mt="md" p="sm" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-sm)'}}>
          <Text size="sm" fw={500} mb="xs">Playback Settings</Text>
          <Group > {/* Removed noWrap, position, spacing */}
            <Text size="xs" style={{width: '100px'}}>Yaw Offset:</Text>
            <Slider
              value={yawOffset}
              onChange={handleYawOffsetChange}
              min={-Math.PI}
              max={Math.PI}
              step={0.01} // Smaller step for finer control
              label={(value) => `${(value * 180 / Math.PI).toFixed(0)}°`}
              style={{ flex: 1 }}
              disabled={!selectedLogData}
            />
          </Group>
          <Group mt="xs">
            <Checkbox
              label="Focus camera on model"
              checked={focusCameraOnModel}
              onChange={handleFocusCameraToggle}
              size="xs"
              disabled={!selectedLogData}
            />
          </Group>
        </Box>
      )}
    </Box>
  );
};

export default PlaybackControls;