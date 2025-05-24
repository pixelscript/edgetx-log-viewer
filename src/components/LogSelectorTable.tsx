import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Table, Paper, Title, ScrollArea, UnstyledButton, Group, Center, rem, Button } from '@mantine/core';
import { IconSelector, IconChevronDown, IconChevronUp, IconTrash } from '@tabler/icons-react';
import { RootState } from '../state/store';
import { setSelectedLog, removeLog } from '../state/logsSlice';
import { LoadedLog } from '../state/types';
import { isEqual } from 'lodash';
import classes from './LogSelectorTable.module.css';

type SortKey = keyof LoadedLog | 'flightDurationMinutes' | 'maxAltitudeM' | 'maxDistanceKm' | null;

interface ThProps {
  children: React.ReactNode;
  reversed: boolean;
  sorted: boolean;
  onSort(): void;
}

function Th({ children, reversed, sorted, onSort }: ThProps) {
  const Icon = sorted ? (reversed ? IconChevronUp : IconChevronDown) : IconSelector;
  return (
    <Table.Th className={classes.th}>
      <UnstyledButton onClick={onSort} className={classes.control}>
        <Group  gap="xs">
          <span className={classes.labelText}>{children}</span>
          <Center className={classes.icon}>
            <Icon style={{ width: rem(16), height: rem(16) }} stroke={1.5} />
          </Center>
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}


const LogSelectorTable: React.FC = () => {
  const dispatch = useDispatch();
  const { loadedLogs, selectedLogFilename } = useSelector((state: RootState) => {
    return {
      loadedLogs: state.logs.loadedLogs,
      selectedLogFilename: state.logs.selectedLogFilename
    };
  }, isEqual);
  const [sortBy, setSortBy] = useState<SortKey>(null);
  const [reverseSortDirection, setReverseSortDirection] = useState(false);

  const logFiles = Object.values(loadedLogs);

  const setSorting = (field: SortKey) => {
    const reversed = field === sortBy ? !reverseSortDirection : false;
    setReverseSortDirection(reversed);
    setSortBy(field);
  };

  const sortedData = useMemo(() => {
    return [...logFiles].sort((a, b) => {
      if (!sortBy) return 0;

      let aValue: any;
      let bValue: any;

      if (sortBy === 'flightDurationMinutes' || sortBy === 'maxAltitudeM' || sortBy === 'maxDistanceKm') {
        aValue = a.stats?.[sortBy];
        bValue = b.stats?.[sortBy];
      } else if (sortBy in a) {
        aValue = a[sortBy as keyof LoadedLog];
        bValue = b[sortBy as keyof LoadedLog];
      }

      if (aValue === null || aValue === undefined) return reverseSortDirection ? -1 : 1;
      if (bValue === null || bValue === undefined) return reverseSortDirection ? 1 : -1;


      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return reverseSortDirection ? bValue - aValue : aValue - bValue;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return reverseSortDirection ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
      }
      if (sortBy === 'logDate') {
        const dateA = a.logDate ? new Date(a.logDate).getTime() : 0;
        const dateB = b.logDate ? new Date(b.logDate).getTime() : 0;
        return reverseSortDirection ? dateB - dateA : dateA - dateB;
      }


      return 0;
    });
  }, [logFiles, sortBy, reverseSortDirection]);


  const handleRowClick = (filename: string) => {
    dispatch(setSelectedLog(filename));
  };

  const handleRemoveLog = () => {
    if (selectedLogFilename) {
      dispatch(removeLog(selectedLogFilename));
    }
  };

  const rows = sortedData.map((log) => {
    const stats = log.stats || { maxDistanceKm: null, maxAltitudeM: null, flightDurationMinutes: null, mostUsedMode: null };
    return (
        <Table.Tr
          key={log.filename}
          onClick={() => handleRowClick(log.filename)}
          className={log.filename === selectedLogFilename ? classes.selectedRow : classes.row}
        >
          <Table.Td>{log.modelName || 'N/A'}</Table.Td>
          <Table.Td>{log.logDate || 'N/A'}</Table.Td>
          <Table.Td>{stats.flightDurationMinutes !== null ? stats.flightDurationMinutes : 'N/A'}</Table.Td>
          <Table.Td>{stats.maxAltitudeM !== null ? stats.maxAltitudeM : 'N/A'}</Table.Td>
          <Table.Td>{stats.maxDistanceKm !== null ? stats.maxDistanceKm : 'N/A'}</Table.Td>
        </Table.Tr>
    );
  });

  if (logFiles.length === 0) {
    return null;
  }

  return (
    <Paper withBorder shadow="sm" p="md" mb="md">
       <Group justify="space-between" mb="sm">
         <Title order={4}>Logs</Title>
         <Button
           size="xs"
           color="red"
           variant="light"
           onClick={handleRemoveLog}
           disabled={!selectedLogFilename}
           leftSection={<IconTrash size={14} />}
         >
           Remove Selected
         </Button>
       </Group>
      <ScrollArea h={500}>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Th
                sorted={sortBy === 'modelName'}
                reversed={reverseSortDirection}
                onSort={() => setSorting('modelName')}
              >
                Model
              </Th>
              <Th
                sorted={sortBy === 'logDate'}
                reversed={reverseSortDirection}
                onSort={() => setSorting('logDate')}
              >
                Date
              </Th>
              <Th
                sorted={sortBy === 'flightDurationMinutes'}
                reversed={reverseSortDirection}
                onSort={() => setSorting('flightDurationMinutes')}
              >
                Dur
              </Th>
              <Th
                sorted={sortBy === 'maxAltitudeM'}
                reversed={reverseSortDirection}
                onSort={() => setSorting('maxAltitudeM')}
              >
                Max Alt
              </Th>
              <Th
                sorted={sortBy === 'maxDistanceKm'}
                reversed={reverseSortDirection}
                onSort={() => setSorting('maxDistanceKm')}
              >
                Max Dist
              </Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      </ScrollArea>
    </Paper>
  );
};

export default LogSelectorTable;