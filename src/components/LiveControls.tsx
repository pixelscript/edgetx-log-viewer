import { useState, useRef } from 'react';
import { Button, Modal, TextInput, Group, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../state/store';
import { usePlayback } from '../contexts/PlaybackContext';
import { setLiveConnected } from '../state/uiSlice';
import { startNewLiveLog, addLiveLogEntry } from '../state/logsSlice';
import { showNotification } from '@mantine/notifications';
export default function LiveControls() {
  const [opened, { open, close }] = useDisclosure(false);
  const [url, setUrl] = useState('ws://192.168.4.1/ws');

  const [craftName, setCraftName] = useState('');
  const dispatch = useDispatch();
  const maxEntries = useSelector((state: RootState) => {
    if ( state.logs.liveLogFilename ) {
      return (state.logs.loadedLogs[state.logs.liveLogFilename].entries.length ?? 1) - 1;
    }
    return 0;
  });
  const isLiveConnected = useSelector((state: RootState) => state.ui.liveConnected);
  const wsRef = useRef<WebSocket | null>(null);
  const { setPlaybackProgress, setFollowPlane } = usePlayback();
  setFollowPlane(true);
  const handleConnect = () => {
    console.log('Connecting to:', url, 'with craft name:', craftName);
    close();
    let ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      setPlaybackProgress(0);
      dispatch(setLiveConnected(true));
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
      dispatch(setLiveConnected(false));
      showNotification({
        title: 'Connection Error',
        message: 'An error occurred with the live data connection.',
        color: 'red',
      });
    };

    ws.onerror = event => {
      console.warn('WebSocket error:', event);
      dispatch(setLiveConnected(false));
    };
  };

  const handleDisconnect = () => {
  if (wsRef.current) {
    wsRef.current.close();
    wsRef.current = null;
    dispatch(setLiveConnected(false));
    showNotification({
      title: 'Disconnected',
      message: 'Successfully disconnected from the live data stream.',
      color: 'blue',
    });
  }
};

  return (
    <>
      <Stack>
        <Title order={4}>Live Connection</Title>
        <Button onClick={isLiveConnected ? handleDisconnect : open} color={isLiveConnected ? 'red' : 'blue'}>
          {isLiveConnected ? 'Disconnect' : 'Connect'}
        </Button>
      </Stack>

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