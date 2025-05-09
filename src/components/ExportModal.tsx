import { useState } from 'react';
import { Modal, NumberInput, Button, Group, Stack, Radio } from '@mantine/core';
import { useSelector } from 'react-redux';
import { RootState } from '../state/store';
import { generateGpx, generateKml } from '../utils/exportUtils';
import { isEqual } from 'lodash';
interface ExportModalProps {
  opened: boolean;
  close: () => void;
}

export default function ExportModal({ opened, close }: ExportModalProps) {
  const [offset, setOffset] = useState<number>(0);
  const [format, setFormat] = useState<'gpx' | 'kml'>('gpx');
  const selectedLogFilename = useSelector((state: RootState) => state.logs.selectedLogFilename);
  const selectedLog = useSelector((state: RootState) => {
    if (!selectedLogFilename) return null;
    return state.logs.loadedLogs[selectedLogFilename];
  }, isEqual);


  const handleExport = () => {
    if (!selectedLog || !selectedLogFilename) {
        console.error("Export cancelled: No selected log or filename.");
        return;
    }

    try {
        let fileContent = '';
        let fileExtension = '';
        let mimeType = '';
        const baseFilename = selectedLogFilename
            .replace(/\.[^/.]+$/, "")
            .replace(/[^a-z0-9_\-\.]/gi, '_');
        if (format === 'gpx') {
          fileContent = generateGpx(selectedLog, offset);
          fileExtension = 'gpx';
          mimeType = 'application/gpx+xml';
        } else {
          fileContent = generateKml(selectedLog, offset);
          fileExtension = 'kml';
          mimeType = 'application/vnd.google-earth.kml+xml';
        }

        if (!fileContent) {
            console.error("Failed to generate export file content (empty or null).");
            close();
            return;
        }
        const blob = new Blob([fileContent], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const exportFilename = `${baseFilename}_offset_${offset}m.${fileExtension}`;
        link.download = exportFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href)
        close();
    } catch (error) {
        console.error("Error during export process:", error);
        close();
    }
  };

  return (
    <Modal opened={opened} onClose={close} title="Export Log" centered>
      <Stack>
        <NumberInput
          label="Ground Level Altitude Offset (m)"
          description="Adds this value to all altitude points."
          value={offset}
          onChange={(value) => setOffset(Number(value) || 0)}
          min={-1000}
          max={10000}
          step={1}
          allowDecimal={false}
        />
        <Radio.Group
          name="exportFormat"
          label="Select export format"
          value={format}
          onChange={(value) => setFormat(value as 'gpx' | 'kml')}
          withAsterisk
        >
          <Group mt="xs">
            <Radio value="gpx" label="GPX" />
            <Radio value="kml" label="KML" />
          </Group>
        </Radio.Group>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!selectedLog}>
            Export
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}