import { useState, useRef } from 'react';
import { Button, Modal, TextInput, Group, Stack, Box, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../state/store';
import { usePlayback } from '../contexts/PlaybackContext';
import { setLiveState } from '../state/uiSlice';
import { startNewLiveLog, addLiveLogEntry } from '../state/logsSlice';
import { showNotification } from '@mantine/notifications';
export default function LiveControls() {
  const [opened, { open, close }] = useDisclosure(false);
  const [url, setUrl] = useState('ws://192.168.4.1/ws');

  const [craftName, setCraftName] = useState('');
  const dispatch = useDispatch();
  const maxEntries = useSelector((state: RootState) => {
    if (state.logs.liveLogFilename) {
      return (state.logs.loadedLogs[state.logs.liveLogFilename].entries.length ?? 1) - 1;
    }
    return 0;
  });
  const liveState = useSelector((state: RootState) => state.ui.liveState);
  const wsRef = useRef<WebSocket | null>(null);
  const { setPlaybackProgress, setFollowPlane } = usePlayback();
  setFollowPlane(true);


  const handleConnect = () => {
    close();
    let ws = new WebSocket(url);
    wsRef.current = ws;
    dispatch(setLiveState('connecting'));
    ws.onopen = () => {
      setPlaybackProgress(0);
      dispatch(setLiveState('waiting'));
      dispatch(startNewLiveLog({ craftName }));
      showNotification({
        title: 'Connection Successful',
        message: 'Successfully connected to the live data stream.',
        color: 'green',
      });
    };

    ws.onmessage = event => {
      let newData = {}
      try {
        newData = JSON.parse(event.data);
      } catch (e) {
        console.warn(e);
        return;
      }
      dispatch(addLiveLogEntry({ newData }));
      setPlaybackProgress(maxEntries);
    };

    ws.onclose = () => {
      dispatch(setLiveState('disconnected'));
      showNotification({
        title: 'Connection Error',
        message: 'An error occurred with the live data connection.',
        color: 'red',
      });
    };

    ws.onerror = event => {
      console.warn('WebSocket error:', event);
      dispatch(setLiveState('disconnected'));
    };
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      dispatch(setLiveState('disconnected'));
      showNotification({
        title: 'Disconnected',
        message: 'Successfully disconnected from the live data stream.',
        color: 'blue',
      });
    }
  };

  return (
    <>
      <Box p="md">
        <Stack>
          <Text size="sm">
            Live view requires an ESP32 broadcasting data via WebSocket. For more information see <a href="">here</a>.
          </Text>
          <Group>
            <Text size="sm">
              Live Stream Status: {liveState === 'waiting' ? 'waiting for GPS connection' : liveState}
            </Text>
          </Group>
          <Button onClick={liveState !== 'disconnected' ? handleDisconnect : open} color={liveState !== 'disconnected' ? 'red' : 'blue'}>
            {liveState !== 'disconnected' ? 'Disconnect' : 'Connect'}
          </Button>
        </Stack>
      </Box>

      <Modal opened={opened} onClose={close} title="Connect to Live Stream">
        <Stack>
          <TextInput
            label="WebSocket URL"
            placeholder="ws://192.168.4.1/ws"
            value={url}
            onChange={(event) => setUrl(event.currentTarget.value)}
          />
          <TextInput
            label="Craft Name"
            placeholder="Enter craft name"
            value={craftName}
            onChange={(event) => setCraftName(event.currentTarget.value)}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={close}>Cancel</Button>
            <Button onClick={handleConnect}>Connect</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}