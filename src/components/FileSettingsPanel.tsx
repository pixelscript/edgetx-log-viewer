import { Paper, Title, Group, NumberInput, Stack, Button, Text, Checkbox } from "@mantine/core";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../state/store";
import {
  selectFileSettings,
  setFileSettings,
  resetFileSettings,
  DEFAULT_FILE_SETTINGS,
  FileSettings,
} from "../state/settingsSlice";

export default function FileSettingsPanel() {
  const dispatch = useDispatch();
  const selectedLogFilename = useSelector((state: RootState) => state.logs.selectedLogFilename);
  const settings = useSelector(selectFileSettings(selectedLogFilename));

  if (!selectedLogFilename) {
    return null;
  }

  const update = (change: Partial<FileSettings>) => {
    dispatch(setFileSettings({ filename: selectedLogFilename, settings: change }));
  };

  const toNumber = (value: number | string): number => {
    const parsed = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const isModified =
    settings.verticalOffset !== DEFAULT_FILE_SETTINGS.verticalOffset ||
    settings.rotationX !== DEFAULT_FILE_SETTINGS.rotationX ||
    settings.rotationY !== DEFAULT_FILE_SETTINGS.rotationY ||
    settings.rotationZ !== DEFAULT_FILE_SETTINGS.rotationZ ||
    settings.interpolateGps !== DEFAULT_FILE_SETTINGS.interpolateGps;

  return (
    <Paper withBorder shadow="sm" p="sm" mb="md">
      <Group justify="space-between" mb="sm">
        <Title order={4}>Adjustments</Title>
        <Button
          variant="subtle"
          size="compact-xs"
          onClick={() => dispatch(resetFileSettings(selectedLogFilename))}
          disabled={!isModified}
        >
          Reset
        </Button>
      </Group>

      <Stack gap="sm">
        <NumberInput
          label="Vertical offset"
          description="Raise or lower the flight path (metres)"
          value={settings.verticalOffset}
          onChange={(value) => update({ verticalOffset: toNumber(value) })}
          step={1}
          size="sm"
        />

        <Text size="xs" c="dimmed">
          Plane rotation (degrees)
        </Text>
        <Group grow>
          <NumberInput
            label="X"
            value={settings.rotationX}
            onChange={(value) => update({ rotationX: toNumber(value) })}
            step={1}
            min={-180}
            max={180}
            size="sm"
          />
          <NumberInput
            label="Y"
            value={settings.rotationY}
            onChange={(value) => update({ rotationY: toNumber(value) })}
            step={1}
            min={-180}
            max={180}
            size="sm"
          />
          <NumberInput
            label="Z"
            value={settings.rotationZ}
            onChange={(value) => update({ rotationZ: toNumber(value) })}
            step={1}
            min={-180}
            max={180}
            size="sm"
          />
        </Group>

        <Checkbox
          label="Interpolate slow to update GPS"
          description="Smooths playback for logs whose GPS lags the sample rate"
          checked={settings.interpolateGps}
          onChange={(event) => update({ interpolateGps: event.currentTarget.checked })}
          size="sm"
          mt="xs"
        />
      </Stack>
    </Paper>
  );
}
