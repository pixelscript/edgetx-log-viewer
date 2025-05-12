import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Group, Text, rem, Button, Stack } from '@mantine/core';
import { IconUpload, IconFileText, IconX } from '@tabler/icons-react';
import { Dropzone, DropzoneProps, FileWithPath } from '@mantine/dropzone';
import { LoadedLogs } from '../state/types';
import { addLog } from '../state/logsSlice';
import { showErrorModal } from '../state/uiSlice';
import { store } from '../state/store';
import { parseCSV } from '../state/utils/logUtils';

const LogFileUploader: React.FC<Partial<DropzoneProps>> = (props) => {
  const dispatch = useDispatch();
  const loadedLogs = useSelector((state: { logs: LoadedLogs }) => state.logs.loadedLogs);
  const noLogsLoaded = Object.keys(loadedLogs).length === 0;

  const processFileContent = (content: string, fileName: string) => {
    try {
      const parsedEntries = parseCSV(content);
      if (parsedEntries.length === 0) {
        dispatch(showErrorModal(`Log file "${fileName}" appears to be empty or incorrectly formatted.`));
        return;
      }
      dispatch(addLog({ filename: fileName, entries: parsedEntries }));
      const currentLogs = store.getState().logs.loadedLogs;
      if (!currentLogs[fileName]) {
        dispatch(showErrorModal(`Log file "${fileName}" contained no valid flight data after processing (e.g., duplicate entries or missing GPS) and was not loaded.`));
      }
    } catch (error) {
      console.error(`Error parsing CSV for ${fileName}:`, error);
      dispatch(showErrorModal(`Error parsing CSV file "${fileName}". Please ensure it's a valid log file.`));
    }
  };

  const handleDrop = (files: FileWithPath[]) => {
    files.forEach(file => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          processFileContent(text, file.name);
        }
      };
      reader.onerror = (error) => {
        console.error(`Error reading file ${file.name}:`, error);
        dispatch(showErrorModal(`Error reading file "${file.name}".`));
      };
      reader.readAsText(file);
    });
  };

  const handleLoadSample = async () => {
    try {
      const response = await fetch('./Flik-Wing-2025-04-12-134607.csv');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      const fileName = 'Flik-Wing-2025-04-12-134607.csv';
      processFileContent(text, fileName);

    } catch (error) {
      console.error('Error loading sample file:', error);
      dispatch(showErrorModal('Could not load the sample log file. Please try again or check the console.'));
    }
  };

  return (
    <>
      <Dropzone
        onDrop={handleDrop}
        onReject={(files) => console.log('rejected files', files)}
        maxSize={50 * 1024 ** 2}
        accept={['text/csv']}
        {...props}
        style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '200px', borderStyle: 'dashed' }}
      >
        <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-blue-6)' }}
              stroke={1.5}
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-red-6)' }}
              stroke={1.5}
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconFileText
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-dimmed)' }}
              stroke={1.5}
            />
          </Dropzone.Idle>

          <div>
            <Text size="xl" inline>
              Add your logs here
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Drag & drop .csv log files here, or click to select files
            </Text>
          </div>
        </Group>
      </Dropzone>
      {noLogsLoaded && (
        <Stack>
        <Text size="sm" c="dimmed" inline mt={10} style={{ textAlign: 'center', width: '100%' }}>
          --- or ---
        </Text>
        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); handleLoadSample(); }}>Load Sample</Button>
        </Stack>
      )}
    </>
  );
};

export default LogFileUploader;
