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
}

const initialState: UiState = {
  viewMode: 'stats', // Default view mode
  errorStatus: {
    message: null,
    isModalVisible: false,
  },
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
      // Optionally clear the message when hiding, or keep it for reference
      // state.errorStatus.message = null;
    },
  },
});

export const { setViewMode, setErrorStatus, showErrorModal, hideErrorModal } = uiSlice.actions;

// Selectors
export const selectViewMode = (state: RootState) => state.ui.viewMode;
export const selectErrorStatus = (state: RootState) => state.ui.errorStatus;
export const selectErrorMessage = (state: RootState) => state.ui.errorStatus.message;
export const selectIsErrorModalVisible = (state: RootState) => state.ui.errorStatus.isModalVisible;

export default uiSlice.reducer;