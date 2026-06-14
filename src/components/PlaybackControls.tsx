import React, { useState, useEffect, useCallback } from 'react';
import { Slider, Button, Group, Box, Select } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';
import { useSelector } from 'react-redux';
import { RootState } from '../state/store';
import { isEqual } from 'lodash';
import { usePlayback, PlaybackCameraView } from '../contexts/PlaybackContext';
import { LogEntry } from '../state/types/logTypes';

const speedOptions = [
  { value: '0.5', label: '0.5x' },
  { value: '1', label: '1x' },
  { value: '1.5', label: '1.5x' },
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

const cameraViewOptions: { value: PlaybackCameraView; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'follow', label: 'Follow' },
  { value: 'fpv', label: 'FPV' },
];

// Advance the fractional playback position by a budget of flight-time (ms),
// consuming each data point's own timeDelta so the clock tracks real flight
// timing rather than a fixed frame cadence. Returns a fractional index that
// downstream rendering interpolates between integer data points.
const advanceProgress = (
  current: number,
  budgetMs: number,
  entries: LogEntry[],
  duration: number,
): number => {
  let position = current;
  let remainingBudget = budgetMs;
  while (remainingBudget > 0 && position < duration) {
    const index = Math.floor(position);
    const stepMs = Math.max(1, entries[index].timeDelta as number);
    const msLeftInStep = (1 - (position - index)) * stepMs;
    if (remainingBudget >= msLeftInStep) {
      remainingBudget -= msLeftInStep;
      position = index + 1;
    } else {
      position += remainingBudget / stepMs;
      remainingBudget = 0;
    }
  }
  return Math.min(position, duration);
};

const PlaybackControls: React.FC = () => {
  const {
    playbackProgress: progress,
    setPlaybackProgress,
    progressClockRef,
    cameraView,
    setCameraView,
    selectedModel,
    setSelectedModel,
  } = usePlayback();
  const [isPlaying, setIsPlaying] = useState(false);
  const [multiplier, setMultiplier] = useState(10);
  const selectedLogData = useSelector((state: RootState) =>
    state.logs.selectedLogFilename ? state.logs.loadedLogs[state.logs.selectedLogFilename] : null
    , isEqual);
  const duration = selectedLogData?.entries.length ? selectedLogData.entries.length - 1 : 100;

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleSliderChange = (value: number) => {
    progressClockRef.current = value;
    setPlaybackProgress(value);
    if (isPlaying) {
      setIsPlaying(false);
    }
  };

  // Continuous playback clock. Each animation frame we advance the fractional
  // position by the elapsed wall-clock time scaled by the speed multiplier, and
  // only push the integer index into React state when it changes (which is all
  // the trail/slider need). The fractional clock lives in a ref so the plane and
  // camera can interpolate smoothly without re-rendering on every frame.
  useEffect(() => {
    if (!isPlaying || !selectedLogData) {
      return;
    }
    if (progressClockRef.current >= duration) {
      setIsPlaying(false);
      return;
    }
    const entries = selectedLogData.entries;
    let frameId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - lastTime;
      lastTime = now;
      const next = advanceProgress(progressClockRef.current, elapsed * multiplier, entries, duration);
      progressClockRef.current = next;
      const flooredNext = Math.min(Math.floor(next), duration);
      setPlaybackProgress((prev) => (prev === flooredNext ? prev : flooredNext));
      if (next >= duration) {
        progressClockRef.current = duration;
        setPlaybackProgress(duration);
        setIsPlaying(false);
        return;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, duration, multiplier, selectedLogData, setPlaybackProgress, progressClockRef]);

  useEffect(() => {
    progressClockRef.current = 0;
    setPlaybackProgress(0);
    setIsPlaying(false);
  }, [selectedLogData, setPlaybackProgress, progressClockRef]);

  return (
    <Box p="md">
      <Group>
        <Select
          size="xs"
          data={speedOptions}
          defaultValue="10"
          onChange={(value) => {
            if (value) {
              setMultiplier(parseFloat(value));
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
        <Select
          size="xs"
          data={cameraViewOptions}
          value={cameraView}
          onChange={(value) => {
            if (value) {
              setCameraView(value as PlaybackCameraView);
            }
          }}
          disabled={!selectedLogData}
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