import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LogEntry, LogsState } from './types/logTypes';
import { calculateFlightStats } from '../utils/statsUtils';

  const parseTimeToMs = (entry: LogEntry): number => {
    const dateStr = entry.date;
    const timeStr = entry.time;

    if (typeof dateStr === 'string' && typeof timeStr === 'string') {
      const dateTimeString = `${dateStr}T${timeStr}Z`;
      const date = new Date(dateTimeString);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
    return 0;
  };


const isNumericalField = (key: string, value: any): boolean => {
  if (typeof value !== 'number') return false;
  const excludedKeys = ['Date', 'Time', 'GPS', 'FM'];
  if (excludedKeys.includes(key) || key.includes('GPS')) return false;
  return true;
};

const removeDuplicates = (entries: LogEntry[]): LogEntry[] => {
  if (entries.length === 0) return [];
  const uniqueEntries: LogEntry[] = [entries[0]];
  let previousEntryJson = JSON.stringify({ ...entries[0], time: undefined });

  for (let i = 1; i < entries.length; i++) {
    const currentEntry = entries[i];
    const currentEntryJson = JSON.stringify({ ...currentEntry, time: undefined });

    if (currentEntryJson !== previousEntryJson) {
      uniqueEntries.push(currentEntry);
      previousEntryJson = currentEntryJson;
    }
  }
  console.log(`Filtered ${entries.length - uniqueEntries.length} duplicate entries.`);
  return uniqueEntries;
};

const removeInvalidGPSAndFormat = (entries: LogEntry[]): LogEntry[] => {
  const validEntries: LogEntry[] = [];
  for (const entry of entries) {
    const gps = entry.gps;
    if (gps && typeof gps === 'string' && gps.length > 0) {
      let [lat, long] = gps.split(' ').map(coord => parseFloat(coord));
      entry.gps = { lat, long };
      validEntries.push(entry);
    } else {
      console.warn(`Invalid GPS data in entry: ${JSON.stringify(entry)}`);
    }
    if (entry.time && typeof entry.time === 'string') {
      entry.timeMs = parseTimeToMs(entry);
    }
  }
  console.log(`Filtered ${entries.length - validEntries.length} invalid entries based on GPS.`);
  return validEntries;
};

const addTimeDelta = (entries: LogEntry[]): LogEntry[] => {
  if (entries.length === 0) return [];
  const updatedEntries = entries.map((entry, index) => {
    const timeDelta = (entries[Math.min(index + 1, entries.length-1)].timeMs as number) - (entry.timeMs as number);
    return {
      ...entry,
      timeDelta
    };
  });
  return updatedEntries;
};


const parseFilename = (filename: string): { modelName: string | null; logDate: string | null; logTime: string | null } => {
  const baseName = filename.replace(/\.csv$/i, '');
  const parts = baseName.split('-');

  if (parts.length < 5) {
    console.warn(`Filename "${filename}" does not match expected format <model_name>-YYYY-MM-DD-HHMMSS.csv`);
    return { modelName: baseName, logDate: null, logTime: null };
  }

  const potentialTime = parts[parts.length - 1];
  const logTime = /^\d{6}$/.test(potentialTime) ? potentialTime : null;

  const potentialDate = `${parts[parts.length - 4]}-${parts[parts.length - 3]}-${parts[parts.length - 2]}`;
  const logDate = /^\d{4}-\d{2}-\d{2}$/.test(potentialDate) ? potentialDate : null;

  const modelNameParts = parts.slice(0, parts.length - 4);
  const modelName = modelNameParts.length > 0 ? modelNameParts.join('-') : null;

  if (!logDate || !logTime) {
    console.warn(`Could not reliably parse date/time from filename "${filename}". Found: date=${potentialDate}, time=${potentialTime}`);
    return { modelName: baseName, logDate: null, logTime: null };
  }

  return { modelName, logDate, logTime };
};

const initialState: LogsState = {
  loadedLogs: {},
  selectedLogFilename: null,
  selectedField: null,
  targetCenter: null,
};

const logsSlice = createSlice({
  name: 'logs',
  initialState,
  reducers: {
    setTargetCenter: (state, action: PayloadAction<any>) => {
      state.targetCenter = action.payload;
    },
    addLog: (state, action: PayloadAction<{ filename: string; entries: LogEntry[] }>) => {
      const { filename, entries } = action.payload;

      if (entries.length === 0 || state.loadedLogs[filename]) {
        if (state.loadedLogs[filename]) {
          console.log(`Log file "${filename}" is already loaded.`);
        } else {
          console.warn(`Attempted to add log file "${filename}" which is empty or has no initial entries.`);
        }
        return;
      }

      const firstEntry = entries[0];
      const numericalFields = Object.keys(firstEntry).filter(key =>
        isNumericalField(key, firstEntry[key])
      );
      const uniqueEntries = removeDuplicates(entries);
      const processedEntries = removeInvalidGPSAndFormat(uniqueEntries);
      const entriesWithTimeDelta = addTimeDelta(processedEntries);

      if (entriesWithTimeDelta.length > 0) {
        const stats = calculateFlightStats(entriesWithTimeDelta);
        const { modelName, logDate, logTime } = parseFilename(filename);
        state.loadedLogs[filename] = {
          filename,
          entries: entriesWithTimeDelta,
          numericalFields,
          stats,
          modelName,
          logDate,
          logTime
        };
        state.selectedLogFilename = filename;
      } else {
        console.warn(`Log file "${filename}" resulted in no valid entries after filtering and was not added.`);
      }
    },
    setSelectedLog: (state, action: PayloadAction<string | null>) => {
      const filename = action.payload;
      if (filename !== null && state.loadedLogs[filename]) {
        state.selectedLogFilename = filename;
        const { numericalFields } = state.loadedLogs[filename];
        if (state.selectedField && !numericalFields.includes(state.selectedField)) {
          state.selectedField = null;
        }
      }
    },
    clearLogs: (state) => {
      state.loadedLogs = {};
      state.selectedLogFilename = null;
      state.selectedField = null;
    },
    setSelectedField: (state, action: PayloadAction<string | null>) => {
      if (state.selectedLogFilename) {
        state.selectedField = action.payload;
      }
    },
    removeLog: (state, action: PayloadAction<string>) => {
      const filenameToRemove = action.payload;
      if (state.loadedLogs[filenameToRemove]) {
        delete state.loadedLogs[filenameToRemove];
        if (state.selectedLogFilename === filenameToRemove) {
          state.selectedLogFilename = null;
          state.selectedField = null;
        }
      }
    },
  },
});

export const { addLog, setSelectedLog, clearLogs, setSelectedField, removeLog, setTargetCenter } = logsSlice.actions;
export default logsSlice.reducer;