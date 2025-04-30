import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Group, ColorSwatch, Text, Paper, useMantineTheme, Stack, Box } from '@mantine/core';
import { RootState } from '../state/store';
import { logValueTitles } from '../consts/logValueTitles';

const modeColorsData = [
  { mode: 'OK', color: 'green' },
  { mode: 'CRUZ', color: 'orange' },
  { mode: 'RTH', color: 'red' },
  { mode: 'HOR', color: 'cyan' },
  { mode: 'HOLD', color: 'magenta' },
  { mode: 'ANGL', color: 'greenyellow' },
  { mode: 'MANU', color: 'dodgerblue' },
  { mode: 'AIR', color: '#822EFF' },
];

const formatValue = (value: number | null): string => {
    if (value === null) return 'N/A';
    const precision = Math.abs(value) > 10 ? 1 : 2;
    return value.toFixed(precision);
};


function ModeColorKey() {
  const theme = useMantineTheme();
  const { selectedField, loadedLogs, selectedLogFilename } = useSelector((state: RootState) => state.logs);

  const currentLog = selectedLogFilename ? loadedLogs[selectedLogFilename] : null;
  const logEntries = currentLog?.entries ?? [];

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