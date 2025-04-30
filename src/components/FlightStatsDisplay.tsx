import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../state/store';
import { Paper, Text, Group, Stack } from '@mantine/core';

const FlightStatsDisplay: React.FC = () => {
  const { loadedLogs, selectedLogFilename } = useSelector((state: RootState) => state.logs);
  const currentLog = selectedLogFilename ? loadedLogs[selectedLogFilename] : null;
  const stats = currentLog?.stats || { maxDistanceKm: null, maxAltitudeM: null, flightDurationMinutes: null, mostUsedMode: null };
  const formatStat = (value: number | string | null, unit: string = '', precision: number = 1): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      return `${value.toFixed(precision)} ${unit}`;
    }
    return `${value} ${unit}`;
  };

  return (
    <Paper shadow="xs" p="md" withBorder>
      <Text size="lg" fw={500} mb="sm">
        Flight Statistics
      </Text>

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