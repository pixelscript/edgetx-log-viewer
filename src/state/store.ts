import { configureStore } from '@reduxjs/toolkit';
import logsReducer from './logsSlice';
import uiReducer from './uiSlice';
import settingsReducer, { persistSettings } from './settingsSlice';

export const store = configureStore({
  reducer: {
    logs: logsReducer,
    ui: uiReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Persist per-file settings whenever they change so adjustments survive reloads.
let lastPersistedSettings = store.getState().settings.byFilename;
store.subscribe(() => {
  const { byFilename } = store.getState().settings;
  if (byFilename !== lastPersistedSettings) {
    lastPersistedSettings = byFilename;
    persistSettings(byFilename);
  }
});
