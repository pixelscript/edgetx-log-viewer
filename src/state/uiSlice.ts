import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';

export type ViewMode = 'stats' | 'playback';

interface ErrorStatus {
  message: string | null;
  isModalVisible: boolean;
}

interface UiState {
  viewMode: ViewMode;
  errorStatus: ErrorStatus;
  isPlaybackSettingsOpen: boolean;
  yawOffset: number; // in radians
  focusCameraOnModel: boolean;
}

const initialState: UiState = {
  viewMode: 'stats',
  errorStatus: {
    message: null,
    isModalVisible: false,
  },
  isPlaybackSettingsOpen: false,
  yawOffset: 0,
  focusCameraOnModel: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setViewMode: (state, action: PayloadAction<ViewMode>) => {
      state.viewMode = action.payload;
    },
    setErrorStatus: (state, action: PayloadAction<Partial<ErrorStatus>>) => {
      state.errorStatus = { ...state.errorStatus, ...action.payload };
    },
    showErrorModal: (state, action: PayloadAction<string>) => {
      state.errorStatus.message = action.payload;
      state.errorStatus.isModalVisible = true;
    },
    hideErrorModal: (state) => {
      state.errorStatus.isModalVisible = false;
    },
    togglePlaybackSettings: (state) => {
      state.isPlaybackSettingsOpen = !state.isPlaybackSettingsOpen;
    },
    setYawOffset: (state, action: PayloadAction<number>) => {
      state.yawOffset = action.payload;
    },
    toggleFocusCameraOnModel: (state) => {
      state.focusCameraOnModel = !state.focusCameraOnModel;
    },
  },
});

export const {
  setViewMode,
  setErrorStatus,
  showErrorModal,
  hideErrorModal,
  togglePlaybackSettings,
  setYawOffset,
  toggleFocusCameraOnModel,
} = uiSlice.actions;

export const selectViewMode = (state: RootState) => state.ui.viewMode;
export const selectErrorStatus = (state: RootState) => state.ui.errorStatus;
export const selectErrorMessage = (state: RootState) => state.ui.errorStatus.message;
export const selectIsErrorModalVisible = (state: RootState) => state.ui.errorStatus.isModalVisible;
export const selectIsPlaybackSettingsOpen = (state: RootState) => state.ui.isPlaybackSettingsOpen;
export const selectYawOffset = (state: RootState) => state.ui.yawOffset;
export const selectFocusCameraOnModel = (state: RootState) => state.ui.focusCameraOnModel;

export default uiSlice.reducer;