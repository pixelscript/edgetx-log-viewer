import { configureStore } from '@reduxjs/toolkit';
import logsReducer from './logsSlice';
import uiReducer from './uiSlice';

export const store = configureStore({
  reducer: {
    logs: logsReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
