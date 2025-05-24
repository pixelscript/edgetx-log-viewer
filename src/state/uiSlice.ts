import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { MapType } from '../consts/earth';

export type ViewMode = 'stats' | 'playback' | 'live';

interface ErrorStatus {
  message: string | null;
  isModalVisible: boolean;
}

interface UiState {
  viewMode: ViewMode;
  errorStatus: ErrorStatus;
  mapType: MapType;
  liveConnected: boolean;
}

const initialState: UiState = {
  viewMode: 'stats',
  errorStatus: {
    message: null,
    isModalVisible: false,
  },
  mapType: MapType.BingMapHybrid,
  liveConnected: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setViewMode: (state, action: PayloadAction<ViewMode>) => {
      state.viewMode = action.payload;
    },
    setMapType: (state, action: PayloadAction<MapType>) => {
      state.mapType = action.payload;
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
    setLiveConnected: (state, action: PayloadAction<boolean>) => {
      state.liveConnected = action.payload;
    },
  },
});

export const { setViewMode, setMapType, setErrorStatus, showErrorModal, hideErrorModal, setLiveConnected } = uiSlice.actions;

export const selectViewMode = (state: RootState) => state.ui.viewMode;
export const selectMapType = (state: RootState) => state.ui.mapType;
export const selectErrorStatus = (state: RootState) => state.ui.errorStatus;
export const selectErrorMessage = (state: RootState) => state.ui.errorStatus.message;
export const selectIsErrorModalVisible = (state: RootState) => state.ui.errorStatus.isModalVisible;
export const selectLiveConnected = (state: RootState) => state.ui.liveConnected;

export default uiSlice.reducer;