import { configureStore } from '@reduxjs/toolkit';
import logsReducer from './logsSlice';

export const store = configureStore({
  reducer: {
    logs: logsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
