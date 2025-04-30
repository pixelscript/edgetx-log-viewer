import React from 'react';
import { useDispatch } from 'react-redux';
import { Group, Text, rem } from '@mantine/core';
import { IconUpload, IconFileText, IconX } from '@tabler/icons-react';
import { Dropzone, DropzoneProps, FileWithPath } from '@mantine/dropzone';
import { addLog } from '../state/logsSlice';
import { parseCSV } from '../state/utils/logUtils';

const LogFileUploader: React.FC<Partial<DropzoneProps>> = (props) => {
  const dispatch = useDispatch();

  const handleDrop = (files: FileWithPath[]) => {
    files.forEach(file => {
      if (!file) return;

      const reader = new FileReader();

      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          try {
            const parsed = parseCSV(text);
            dispatch(addLog({ filename: file.name, entries: parsed }));
          } catch (error) {
            console.error(`Error parsing CSV for ${file.name}:`, error);
          }
        }
      };

      reader.onerror = (error) => {
        console.error(`Error reading file ${file.name}:`, error);
      };

      reader.readAsText(file);
    });
  };

  return (
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
  );
};

export default LogFileUploader;
