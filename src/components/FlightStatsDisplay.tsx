import React, { useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../state/store';
import { Paper, Text, Group, Stack, Select } from '@mantine/core';
import { setSelectedField } from '../state/logsSlice';
import { logValueTitles, LogValueInfo } from '../consts/logValueTitles';

const FlightStatsDisplay: React.FC = () => {
  const dispatch = useDispatch();
  const { loadedLogs, selectedLogFilename, selectedField } = useSelector((state: RootState) => state.logs);
  const currentLog = selectedLogFilename ? loadedLogs[selectedLogFilename] : null;
  const logEntries = currentLog?.entries ?? [];
  const numericalFields = currentLog?.numericalFields ?? [];
  const stats = currentLog?.stats || { maxDistanceKm: null, maxAltitudeM: null, flightDurationMinutes: null, mostUsedMode: null };
  
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
    return { minVal: min, maxVal: max };
  }, [logEntries, selectedField]);


  const formatStat = (value: number | string | null, unit: string = '', precision: number = 1): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      return `${value.toFixed(precision)} ${unit}`;
    }
    return `${value} ${unit}`;
  };

  const handleFieldChange = (value: string | null) => {
    dispatch(setSelectedField(value));
  };

  const selectData = numericalFields.map(field => {
    const info: LogValueInfo | undefined = logValueTitles[field];
    const label = info
      ? `${info.title}${info.unit ? ` (${info.unit})` : ''} - ${info.description}`
      : field;
    return { value: field, label: label };
  });

  return (
    <Paper shadow="xs" p="md" withBorder>
      <Text size="lg" fw={500} mb="sm">
        Flight Statistics
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

      {selectedField !== null && minVal !== null && maxVal !== null && (
        <Group grow align="flex-start" mb="md">
          <Stack gap="xs">
            <Text size="sm" c="dimmed">Min Value ({logValueTitles[selectedField]?.unit || ''})</Text>
            <Text size="md">{formatStat(minVal, '', 2)}</Text>
          </Stack>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">Max Value ({logValueTitles[selectedField]?.unit || ''})</Text>
            <Text size="md">{formatStat(maxVal, '', 2)}</Text>
          </Stack>
          <Stack gap="xs"></Stack>
          <Stack gap="xs"></Stack>
        </Group>
      )}

      {currentLog && (
          <Group grow align="flex-start">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Max Distance Reached</Text>
              <Text size="md">{formatStat(stats.maxDistanceKm, 'km', 2)}</Text>
            </Stack>
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Max Altitude Reached</Text>
              <Text size="md">{formatStat(stats.maxAltitudeM, 'm', 1)}</Text>
            </Stack>
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Length of Flight</Text>
              <Text size="md">{formatStat(stats.flightDurationMinutes, 'minutes', 1)}</Text>
            </Stack>
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Most Used Mode</Text>
              <Text size="md">{stats.mostUsedMode ?? 'N/A'}</Text>
            </Stack>
          </Group>
      )}
      {!currentLog && (
          <Text c="dimmed">Load a log file to view statistics.</Text>
      )}
    </Paper>
  );
};

export default FlightStatsDisplay;