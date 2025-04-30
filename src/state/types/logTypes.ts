export type LogValue = string | number | { lat: number; long: number };

export type LogEntry = {
  [key: string]: LogValue;
};

export type GPS = {
  lat: number;
  long: number;
}

export type LoadedLog = {
  filename: string;
  entries: LogEntry[];
  numericalFields: string[];
  stats: FlightStats;
  modelName: string | null;
  logDate: string | null;
  logTime: string | null;
};

export type LogsState = {
  loadedLogs: Record<string, LoadedLog>;
  selectedLogFilename: string | null;
  selectedField: string | null;
};

export type FlightStats = {
  maxDistanceKm: number | null;
  maxAltitudeM: number | null;
  flightDurationMinutes: number | null;
  mostUsedMode: string | null;
};