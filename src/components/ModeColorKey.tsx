import { useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Group, ColorSwatch, Text, Paper, useMantineTheme, Stack, Box, Select } from '@mantine/core';
import { RootState } from '../state/store';
import { logValueTitles, LogValueInfo } from '../consts/logValueTitles';
import { setSelectedField } from '../state/logsSlice';
import { isEqual } from 'lodash';

export const MODE_COLOURS = {
  OK: 'green',
  CRUZ: 'orange',
  RTH: 'pink',
  HOR: 'cyan',
  HOLD: 'magenta',
  ANGL: 'greenyellow',
  MANU: 'dodgerblue',
  '!ERR': 'red',
  AIR: '#822EFF',
  UNKNOWN: 'white',
};

const modeColorsData = [
  { mode: 'OK', color: MODE_COLOURS.OK },
  { mode: 'CRUZ', color: MODE_COLOURS.CRUZ },
  { mode: 'RTH', color: MODE_COLOURS.RTH },
  { mode: 'HOR', color: MODE_COLOURS.HOR },
  { mode: 'HOLD', color: MODE_COLOURS.HOLD },
  { mode: 'ANGL', color: MODE_COLOURS.ANGL },
  { mode: 'MANU', color: MODE_COLOURS.MANU },
  { mode: '!ERR', color: MODE_COLOURS['!ERR'] },
  { mode: 'AIR', color: MODE_COLOURS.AIR },
  { mode: 'UNKNOWN', color: MODE_COLOURS.UNKNOWN },
];

const formatValue = (value: number | null): string => {
  if (value === null) return 'N/A';
  const precision = Math.abs(value) > 10 ? 1 : 2;
  return value.toFixed(precision);
};

function ModeColorKey() {
  const theme = useMantineTheme();
  const { selectedField, loadedLogs, selectedLogFilename } = useSelector((state: RootState) => {
    return {
      selectedField: state.logs.selectedField,
      loadedLogs: state.logs.loadedLogs,
      selectedLogFilename: state.logs.selectedLogFilename,
    }
  }, isEqual);
  const currentLog = selectedLogFilename ? loadedLogs[selectedLogFilename] : null;
  const numericalFields = currentLog?.numericalFields ?? [];
  const dispatch = useDispatch();
  const logEntries = currentLog?.entries ?? [];
  const selectData = numericalFields.map(field => {
    const info: LogValueInfo | undefined = logValueTitles[field];
    const label = info
      ? `${info.title}${info.unit ? ` (${info.unit})` : ''} - ${info.description}`
      : field;
    return { value: field, label: label };
  });

  const handleFieldChange = (value: string | null) => {
    dispatch(setSelectedField(value));
  };


  const { minVal, maxVal } = useMemo(() => {
    if (!selectedField || logEntries.length === 0) {
      return { minVal: null, maxVal: null };
    }
    const values = logEntries
      .map(entry => entry[selectedField])
      .filter(val => typeof val === 'number' && isFinite(val)) as number[];

    if (values.length === 0) return { minVal: null, maxVal: null };

    const min = Math.min(...values);
    const max = Math.max(...values);
    return { minVal: min, maxVal: max === min ? min + 0.000001 : max };
  }, [logEntries, selectedField]);

  if (selectedField && minVal !== null && maxVal !== null) {
    const fieldInfo = logValueTitles[selectedField];
    const title = fieldInfo?.title || selectedField;
    const unit = fieldInfo?.unit ? ` (${fieldInfo.unit})` : '';
    const gradient = `linear-gradient(to right, hsl(0, 0%, 50%), hsl(0, 100%, 50%))`;

    return (
      <Paper shadow="xs" p="md" withBorder>
        <Text size="lg" fw={500} mb="sm">
          Value Color Key: {title}{unit}
        </Text>
        {numericalFields.length > 0 && (
          <Select
            label="Color Path By"
            placeholder="Select field (or use Mode colors)"
            value={selectedField}
            onChange={handleFieldChange}
            data={selectData}
            clearable
            mb="md"
            disabled={!currentLog}
          />
        )}
        <Stack gap="xs">
          <Box h={20} style={{ background: gradient, borderRadius: theme.radius.sm }} />
          <Group justify="space-between">
            <Text size="xs">{formatValue(minVal)}</Text>
            <Text size="xs">{formatValue(maxVal)}</Text>
          </Group>
        </Stack>
      </Paper>
    );
  }

  const lightSwatchBorderColor = theme.colors.gray[3];
  return (
    <Paper shadow="xs" p="md" withBorder>
      <Text size="lg" fw={500} mb="sm">
        Mode Color Key
      </Text>
      {numericalFields.length > 0 && (
        <Select
          label="Color Path By"
          placeholder="Select field (or use Mode colors)"
          value={selectedField}
          onChange={handleFieldChange}
          data={selectData}
          clearable
          mb="md"
          disabled={!currentLog}
        />
      )}
      <Group gap="md">
        {modeColorsData.map((item) => (
          <Group key={item.mode} gap="xs" wrap="nowrap">
            <ColorSwatch
              color={item.color}
              size={18}
              style={{
                border: (item.color === 'white' || item.color === 'lightblue')
                  ? `1px solid ${lightSwatchBorderColor}`
                  : 'none',
              }}
            />
            <Text size="sm">{item.mode}</Text>
          </Group>
        ))}
      </Group>
    </Paper>
  );
}

export default ModeColorKey;