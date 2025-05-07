import React, { useState, useEffect, useCallback } from 'react';
import { Slider, Button, Group, Box, Textarea } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../state/store';
import { setPlaybackProgress } from '../state/logsSlice';

const PlaybackControls: React.FC = () => {
  const dispatch = useDispatch();
  const [isPlaying, setIsPlaying] = useState(false);
  const progress = useSelector((state: RootState) => state.logs.playbackProgress);
  const selectedLogData = useSelector((state: RootState) =>
    state.logs.selectedLogFilename ? state.logs.loadedLogs[state.logs.selectedLogFilename] : null
  );
  const duration = selectedLogData?.entries.length ? selectedLogData.entries.length - 1 : 100;

  // Timer interval reference
  const intervalRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleSliderChange = (value: number) => {
    dispatch(setPlaybackProgress(value));
    if (isPlaying) {
      setIsPlaying(false); // Pause if scrubbing
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
        dispatch(setPlaybackProgress(progress + 1));
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
    if (progress >= duration) {
      setIsPlaying(false);
    }
  }, [progress, duration]);

  useEffect(() => {
    dispatch(setPlaybackProgress(0));
    setIsPlaying(false);
  }, [selectedLogData, dispatch]);


  return (
    <Box p="md">
      <Group>
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
      {/* <Textarea
          label="Log"
          value={JSON.stringify(selectedLogData?.entries?.[progress], null, 2)}
          autosize={true}
        /> */}
    </Box>
  );
};

export default PlaybackControls;