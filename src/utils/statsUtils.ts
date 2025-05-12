import { LogEntry, GPS, FlightStats, LogValue} from '../state/types';
import { EARTH_RADIUS } from '../consts';
/**
 * Calculates the Haversine distance between two points on the Earth.
 * @param gps1 First GPS coordinate { lat, long }
 * @param gps2 Second GPS coordinate { lat, long }
 * @returns Distance in kilometers.
 */
function calculateHaversineDistance(gps1: GPS, gps2: GPS): number {
  const R = EARTH_RADIUS/1000;
  const dLat = (gps2.lat - gps1.lat) * Math.PI / 180;
  const dLon = (gps2.long - gps1.long) * Math.PI / 180;
  const lat1Rad = gps1.lat * Math.PI / 180;
  const lat2Rad = gps2.lat * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


export function calculateFlightStats(logEntries: LogEntry[]): FlightStats {
  if (logEntries.length === 0) {
    return {
      maxDistanceKm: null,
      maxAltitudeM: null,
      minAltitudeM: null,
      flightDurationMinutes: null,
      mostUsedMode: null,
    };
  }

  let maxDistanceKm: number | null = null;
  let maxAltitudeM: number | null = null;
  let minAltitudeM: number | null = null;
  let firstTimestampMs: number | null = null;
  let lastTimestampMs: number | null = null;
  const modeCounts: { [mode: string]: number } = {};
  let startGps: GPS | null = null;

  const getValue = (entry: LogEntry, keys: string[]): LogValue | undefined => {
    for (const key of keys) {
      if (entry[key] !== undefined) {
        return entry[key];
      }
    }
    return undefined;
  };

  const parseTimeToMs = (entry: LogEntry): number | null => {
    const dateStr = entry.date;
    const timeStr = entry.time;

    if (typeof dateStr === 'string' && typeof timeStr === 'string') {
      const dateTimeString = `${dateStr}T${timeStr}Z`;
      const date = new Date(dateTimeString);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }

    const timeValue = getValue(entry, ['timestamp', 'dateTime']);
    if (timeValue !== undefined) {
      if (typeof timeValue === 'number') {
        return timeValue > 10000000000 ? timeValue : timeValue * 1000;
      }
      if (typeof timeValue === 'string') {
        const date = new Date(timeValue);
        if (!isNaN(date.getTime())) {
          return date.getTime();
        }
      }
    }
    return null;
  };


  for (const entry of logEntries) {
    const gpsValue = getValue(entry, ['gps']);
    if (gpsValue && typeof gpsValue === 'object' && 'lat' in gpsValue && 'long' in gpsValue) {
      const currentGps = gpsValue as GPS;
      if (!startGps) {
        startGps = currentGps;
        maxDistanceKm = 0;
      }
      if (startGps) {
        const currentDistance = calculateHaversineDistance(startGps, currentGps);
        if (maxDistanceKm === null || currentDistance > maxDistanceKm) {
          maxDistanceKm = currentDistance;
        }
      }
    }

    const altitudeValue = getValue(entry, ['altitude', 'alt', 'altMeters', 'altitudeMeters']);
    if (altitudeValue !== undefined && typeof altitudeValue === 'number' && !isNaN(altitudeValue)) {
      if (maxAltitudeM === null || altitudeValue > maxAltitudeM) {
        maxAltitudeM = altitudeValue;
      }
      if (minAltitudeM === null || altitudeValue < minAltitudeM) {
        minAltitudeM = altitudeValue;
      }
    }

    const currentTimestampMs = parseTimeToMs(entry);

    if (currentTimestampMs !== null) {
      if (firstTimestampMs === null) {
        firstTimestampMs = currentTimestampMs;
      }
      if (lastTimestampMs === null || currentTimestampMs >= lastTimestampMs) {
        lastTimestampMs = currentTimestampMs;
      } else if (currentTimestampMs < firstTimestampMs) {
        firstTimestampMs = currentTimestampMs;
      }
    }

    const modeValue = getValue(entry, ['flightMode', 'mode', 'fm']);
    if (modeValue !== undefined && typeof modeValue === 'string' && modeValue.trim() !== '') {
      const modeStr = modeValue.trim();
      modeCounts[modeStr] = (modeCounts[modeStr] || 0) + 1;
    }
  }

  let flightDurationMinutes: number | null = null;
  if (firstTimestampMs !== null && lastTimestampMs !== null && lastTimestampMs >= firstTimestampMs) {
    const durationMs = lastTimestampMs - firstTimestampMs;
    flightDurationMinutes = durationMs / (1000 * 60);
    if (flightDurationMinutes < 0) flightDurationMinutes = null;
  }

  let mostUsedMode: string | null = null;
  let maxCount = 0;
  for (const mode in modeCounts) {
    if (modeCounts[mode] > maxCount) {
      mostUsedMode = mode;
      maxCount = modeCounts[mode];
    }
  }

  return {
    maxDistanceKm: maxDistanceKm !== null ? parseFloat(maxDistanceKm.toFixed(2)) : null,
    maxAltitudeM: maxAltitudeM !== null ? parseFloat(maxAltitudeM.toFixed(1)) : null,
    minAltitudeM: minAltitudeM !== null ? parseFloat(minAltitudeM.toFixed(1)) : null,
    flightDurationMinutes: flightDurationMinutes !== null ? parseFloat(flightDurationMinutes.toFixed(1)) : null,
    mostUsedMode,
  };
}