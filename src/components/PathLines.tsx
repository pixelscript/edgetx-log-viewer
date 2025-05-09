import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import * as THREE from 'three';
import { RootState } from '../state/store';
import type { Path } from '../state/types/generatedTypes';
import type { LogEntry, GPS } from '../state/types/logTypes';
import { latLongToCartesian } from '../utils/latLongToCartesian';
import { isEqual } from 'lodash';
const getModeColor = (mode: string): THREE.ColorRepresentation => {
  switch (mode) {
    case 'OK': return 'green';
    case 'CRUZ': return 'orange';
    case 'RTH': return 'red';
    case 'HOR': return 'cyan';
    case 'HOLD': return 'magenta';
    case 'ANGL': return 'greenyellow';
    case 'MANU': return 'dodgerblue';
    case 'AIR': return '#822EFF';
    default: return 'white';
  }
};

const ModePathLine: React.FC<{ pathCoordinates: Path; mode: string }> = ({ pathCoordinates, mode }) => {
  const points = useMemo(() => {
    return pathCoordinates
      .filter(coord => typeof coord.latitude === 'number' && typeof coord.longitude === 'number')
      .map(coord => latLongToCartesian(coord.latitude, coord.longitude, coord.altitude));
  }, [pathCoordinates]);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  const color = useMemo(() => getModeColor(mode), [mode]);
  const material = useMemo(() => new THREE.LineBasicMaterial({ color }), [color]);

  if (!geometry) return null;
  const line = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);

  return <primitive object={line} />;
};

const ValueColoredPath: React.FC<{ logEntries: LogEntry[]; selectedField: string }> = ({ logEntries, selectedField }) => {
  const { minVal, maxVal } = useMemo(() => {
    const values = logEntries
      .map(entry => entry[selectedField])
      .filter(val => typeof val === 'number' && isFinite(val)) as number[];

    if (values.length === 0) return { minVal: 0, maxVal: 1 };

    const min = Math.min(...values);
    const max = Math.max(...values);
    return { minVal: min, maxVal: max === min ? min + 0.000001 : max };
  }, [logEntries, selectedField]);

  const lineSegments = useMemo(() => {
    if (logEntries.length < 2) return [];

    const segments: React.ReactNode[] = [];
    const hue = 0 / 360;

    for (let i = 1; i < logEntries.length; i++) {
      const prevEntry = logEntries[i - 1];
      const currentEntry = logEntries[i];

      const prevGps = prevEntry['gps'] as GPS | undefined;
      const currentGps = currentEntry['gps'] as GPS | undefined;
      const prevAlt = prevEntry['alt'] as number | undefined;
      const currentAlt = currentEntry['alt'] as number | undefined;

      if (!prevGps || !currentGps || typeof prevAlt !== 'number' || typeof currentAlt !== 'number') {
        continue;
      }

      try {
        const startPoint = latLongToCartesian(prevGps.lat, prevGps.long, prevAlt);
        const endPoint = latLongToCartesian(currentGps.lat, currentGps.long, currentAlt);

        const value = prevEntry[selectedField];

        let saturation = 0.2;
        if (typeof value === 'number' && isFinite(value)) {
          const normalizedValue = (value - minVal) / (maxVal - minVal);
          const clampedValue = Math.max(0, Math.min(1, normalizedValue));
          saturation = 0.2 + clampedValue * 0.8;
        }

        const color = new THREE.Color().setHSL(hue, saturation, 0.5);
        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const material = new THREE.LineBasicMaterial({ color });

        const key = `${i}-${prevGps.lat}-${prevGps.long}-${currentGps.lat}-${currentGps.long}-${color.getHexString()}`;

        segments.push(
          <primitive key={key} object={new THREE.Line(geometry, material)} />
        );
      } catch (error) {
        console.error(`Error processing segment ${i}:`, error, { prevEntry, currentEntry });
      }
    }
    return segments;
  }, [logEntries, selectedField, minVal, maxVal]);

  return <group>{lineSegments}</group>;
};


const groupEntriesByMode = (logEntries: LogEntry[]): { mode: string; path: Path }[] => {
  if (!logEntries || logEntries.length === 0) return [];

  const sections: { mode: string; path: Path }[] = [];
  let currentSection: { mode: string; path: Path } | null = null;

  for (const entry of logEntries) {
    const mode = entry['fm'] as string ?? 'UNKNOWN';
    const gps = entry['gps'] as GPS | undefined;
    const alt = entry['alt'] as number | undefined;

    if (gps && typeof alt === 'number') {
       const coordinate = { latitude: gps.lat, longitude: gps.long, altitude: alt };
      if (!currentSection || currentSection.mode !== mode) {
        currentSection = { mode, path: [coordinate] };
        sections.push(currentSection);
      } else {
         currentSection.path.push(coordinate);
      }
    }
  }
  return sections.filter(section => section.path.length >= 2);
};

export const PathLines: React.FC = () => {
  const { selectedLogFilename, loadedLogs, selectedField } = useSelector((state: RootState) => {
    return {
      selectedLogFilename: state.logs.selectedLogFilename,
      loadedLogs: state.logs.loadedLogs,
      selectedField: state.logs.selectedField,
    };
  }, isEqual);
  const currentLog = selectedLogFilename ? loadedLogs[selectedLogFilename] : null;
  const logEntries = currentLog?.entries ?? [];
  const modePaths = useMemo(() => {
      if (!selectedField && logEntries.length > 0) {
          return groupEntriesByMode(logEntries);
      }
      return [];
  }, [logEntries, selectedField]);


  if (!currentLog) {
    return null;
  }

  if (selectedField && logEntries.length > 1) {
    return <ValueColoredPath logEntries={logEntries} selectedField={selectedField} />;
  } else if (modePaths.length > 0) {
    return (
      <>
        {modePaths.map((pathSection, index) => (
          <ModePathLine key={`${pathSection.mode}-${index}-${selectedLogFilename}`} pathCoordinates={pathSection.path} mode={pathSection.mode} />
        ))}
      </>
    );
  } else {
      return null;
  }
};