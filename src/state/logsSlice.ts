import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LogEntry, LogsState } from './types/logTypes';
import { calculateFlightStats } from '../utils/statsUtils';

const isNumericalField = (key: string, value: any): boolean => {
  if (typeof value !== 'number') return false;
  const excludedKeys = ['Date', 'Time', 'GPS', 'FM'];
  if (excludedKeys.includes(key) || key.includes('GPS')) return false;
  return true;
};

const removeDuplicates = (entries: LogEntry[]): LogEntry[] => {
  const uniqueEntries: LogEntry[] = [];
  let previousEntry: LogEntry | null = null;
  for (const entry of entries) {
    if (previousEntry !== null) {
      const isDuplicate = Object.keys(entry).every(key => {
        if (key === 'time') return true;
        return entry[key] === previousEntry?.[key];
      });
      if (!isDuplicate) {
        uniqueEntries.push(entry);
      }
    } else {
      uniqueEntries.push(entry);
    }
    previousEntry = entry;
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
  }
  console.log(`Filtered ${entries.length - validEntries.length} invalid entries based on GPS.`);
  return validEntries;
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
  playbackProgress: 0, // Initialize playback progress
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
      if (entries.length > 0 && !state.loadedLogs[filename]) {
        const firstEntry = entries[0];
        const numericalFields = Object.keys(firstEntry).filter(key =>
          isNumericalField(key, firstEntry[key])
        );
        const uniqueEntries = removeDuplicates(entries);
        const validEntries = removeInvalidGPSAndFormat(uniqueEntries);
        const stats = calculateFlightStats(validEntries);
        const { modelName, logDate, logTime } = parseFilename(filename);
        state.loadedLogs[filename] = { filename, entries: validEntries, numericalFields, stats, modelName, logDate, logTime };
        state.selectedLogFilename = filename;
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
    setPlaybackProgress: (state, action: PayloadAction<number>) => {
      if (state.selectedLogFilename) {
        const log = state.loadedLogs[state.selectedLogFilename];
        if (log) {
          // Clamp progress between 0 and the number of entries - 1
          const maxProgress = log.entries.length > 0 ? log.entries.length - 1 : 0;
          state.playbackProgress = Math.max(0, Math.min(action.payload, maxProgress));
        }
      } else {
        state.playbackProgress = 0; // Reset if no log selected
      }
    },
  },
});

export const { addLog, setSelectedLog, clearLogs, setSelectedField, removeLog, setTargetCenter, setPlaybackProgress } = logsSlice.actions; // Export new action
export default logsSlice.reducer;