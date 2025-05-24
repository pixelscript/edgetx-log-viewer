import { LogEntry, GPS, FlightStats, LogValue } from '../state/types';
import { EARTH_RADIUS } from '../consts';
/**
 * Calculates the Haversine distance between two points on the Earth.
 * @param gps1 First GPS coordinate { lat, long }
 * @param gps2 Second GPS coordinate { lat, long }
 * @returns Distance in kilometers.
 */
function calculateHaversineDistance(gps1: GPS, gps2: GPS): number {
  const R = EARTH_RADIUS / 1000;
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

    const modeValue = getValue(entry, ['flightMode', 'mode', 'fm']);
    if (modeValue !== undefined && typeof modeValue === 'string' && modeValue.trim() !== '') {
      const modeStr = modeValue.trim();
      modeCounts[modeStr] = (modeCounts[modeStr] || 0) + 1;
    }
  }

  const durationMs = (logEntries[logEntries.length - 1].timeMs as number) - (logEntries[0].timeMs as number);
  const flightDurationMinutes = durationMs / (1000 * 60);

  let mostUsedMode: string | null = null;
  let maxCount = 0;
  for (const mode in modeCounts) {
    if (modeCounts[mode] > maxCount) {
      mostUsedMode = mode;
      maxCount = modeCounts[mode];
    }
  }

  return {
    maxDistanceKm: isValidNum(maxDistanceKm) ? parseFloat(maxDistanceKm.toFixed(2)) : null,
    maxAltitudeM: isValidNum(maxAltitudeM) ? parseFloat(maxAltitudeM.toFixed(1)) : null,
    minAltitudeM: isValidNum(minAltitudeM) ? parseFloat(minAltitudeM.toFixed(1)) : null,
    flightDurationMinutes: isValidNum(flightDurationMinutes) ? parseFloat(flightDurationMinutes.toFixed(1)) : null,
    mostUsedMode,
  };
}

function isValidNum(value: unknown) {
  return value !== null && !isNaN(value) && value > 0;
}