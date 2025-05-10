import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { DEFAULT_MAP_SOURCE_ID } from '../consts/mapSources';

export type ViewMode = 'stats' | 'playback';

interface ErrorStatus {
  message: string | null;
  isModalVisible: boolean;
}

interface UiState {
  viewMode: ViewMode;
  errorStatus: ErrorStatus;
  selectedMapSourceId: string;
}

const initialState: UiState = {
  viewMode: 'stats',
  errorStatus: {
    message: null,
    isModalVisible: false,
  },
  selectedMapSourceId: DEFAULT_MAP_SOURCE_ID,
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
    setSelectedMapSourceId: (state, action: PayloadAction<string>) => {
      state.selectedMapSourceId = action.payload;
    },
  },
});

export const {
  setViewMode,
  setErrorStatus,
  showErrorModal,
  hideErrorModal,
  setSelectedMapSourceId,
} = uiSlice.actions;

export const selectViewMode = (state: RootState) => state.ui.viewMode;
export const selectErrorStatus = (state: RootState) => state.ui.errorStatus;
export const selectErrorMessage = (state: RootState) => state.ui.errorStatus.message;
export const selectIsErrorModalVisible = (state: RootState) => state.ui.errorStatus.isModalVisible;
export const selectSelectedMapSourceId = (state: RootState) => state.ui.selectedMapSourceId;

export default uiSlice.reducer;