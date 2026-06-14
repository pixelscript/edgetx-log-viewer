import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';

// Per-file viewing adjustments the user can tune to compensate for inaccurate
// GPS altitude or a model whose mounting orientation does not match the flight
// data. Rotation values are in degrees.
export interface FileSettings {
  verticalOffset: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  // Reconstruct smooth motion for logs whose GPS updates slower than the log
  // sample rate (the position sits still for several rows, then jumps). When on,
  // playback eases the craft between distinct GPS fixes over their real time gap.
  interpolateGps: boolean;
}

export const DEFAULT_FILE_SETTINGS: FileSettings = {
  verticalOffset: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  interpolateGps: true,
};

const STORAGE_KEY = 'edgetx-log-viewer:file-settings';

const loadSettings = (): Record<string, FileSettings> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, FileSettings>;
    }
  } catch (error) {
    console.warn('Failed to load file settings from localStorage', error);
  }
  return {};
};

export const persistSettings = (settings: Record<string, FileSettings>): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to persist file settings to localStorage', error);
  }
};

interface SettingsState {
  byFilename: Record<string, FileSettings>;
}

const initialState: SettingsState = {
  byFilename: loadSettings(),
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setFileSettings: (
      state,
      action: PayloadAction<{ filename: string; settings: Partial<FileSettings> }>,
    ) => {
      const { filename, settings } = action.payload;
      const existing = state.byFilename[filename] ?? DEFAULT_FILE_SETTINGS;
      state.byFilename[filename] = { ...existing, ...settings };
    },
    resetFileSettings: (state, action: PayloadAction<string>) => {
      delete state.byFilename[action.payload];
    },
  },
});

export const { setFileSettings, resetFileSettings } = settingsSlice.actions;

export const selectFileSettings = (filename: string | null) =>
  (state: RootState): FileSettings => {
    const stored = filename ? state.settings.byFilename[filename] : undefined;
    // Merge over the defaults so settings saved before a field existed still
    // pick up its default value rather than reading as undefined.
    return stored ? { ...DEFAULT_FILE_SETTINGS, ...stored } : DEFAULT_FILE_SETTINGS;
  };

export default settingsSlice.reducer;
