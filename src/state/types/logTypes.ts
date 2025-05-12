export type LogValue = string | number | { lat: number; long: number };

export type XYZ = {
  x: number;
  y: number;
  z: number;
}

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

export type LoadedLogs = Record<string, LoadedLog>;

export type LogsState = {
  loadedLogs: LoadedLogs;
  selectedLogFilename: string | null;
  selectedField: string | null;
  targetCenter: XYZ | null;
};

export type FlightStats = {
  maxDistanceKm: number | null;
  maxAltitudeM: number | null;
  minAltitudeM: number | null;
  flightDurationMinutes: number | null;
  mostUsedMode: string | null;
};