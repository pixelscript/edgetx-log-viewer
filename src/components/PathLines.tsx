import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import * as THREE from 'three';
import { RootState } from '../state/store';
import type { Path } from '../state/types/generatedTypes';
import type { LogEntry, GPS } from '../state/types/logTypes';
import { latLongToCartesian } from '../utils/latLongToCartesian';
import { isEqual } from 'lodash';
import { ColoredPathLine } from './ColoredPathLine';
import ValueColoredPath from './ValueColoredPath';

import { MODE_COLOURS } from './ModeColorKey';

const getModeColor = (mode: string): THREE.ColorRepresentation => {
  console.log(`Mode: ${mode}`);
  const color = MODE_COLOURS[mode as keyof typeof MODE_COLOURS];
  if (color) {
    return color;
  } else {
    console.warn(`No color found for mode: ${mode}`);
    return MODE_COLOURS.UNKNOWN;
  }

};

const groupEntriesByMode = (logEntries: LogEntry[], altOffset: number = 0): { mode: string; path: Path }[] => {
  if (!logEntries || logEntries.length === 0) return [];

  const sections: { mode: string; path: Path }[] = [];
  let currentSection: { mode: string; path: Path } | null = null;

  for (const entry of logEntries) {
    const mode = entry['fm'] as string ?? 'UNKNOWN';
    const gps = entry['gps'] as GPS | undefined;
    const alt = entry['alt'] as number | undefined;

    if (gps && typeof alt === 'number') {
       const coordinate = { latitude: gps.lat, longitude: gps.long, altitude: alt+altOffset};
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
  const altOffset = Math.max(0-(currentLog?.stats.minAltitudeM ?? 0), 0);
  const modePaths = useMemo(() => {
      if (!selectedField && logEntries.length > 0) {
          return groupEntriesByMode(logEntries, altOffset);
      }
      return [];
  }, [logEntries, selectedField]);


  if (!currentLog) {
    return null;
  }

  if (selectedField && logEntries.length > 1) {
    return <ValueColoredPath logEntries={logEntries} selectedField={selectedField} altOffset={altOffset}/>;
  } else if (modePaths.length > 0) {
    return (
      <>
        {modePaths.map((pathSection, index) => {
          const points = pathSection.path
            .filter(coord => typeof coord.latitude === 'number' && typeof coord.longitude === 'number')
            .map(coord => latLongToCartesian(coord.latitude, coord.longitude, coord.altitude));
          const color = getModeColor(pathSection.mode);
          return (
            <ColoredPathLine
              key={`${pathSection.mode}-${index}-${selectedLogFilename}`}
              points={points}
              color={color}
              lineWidth={5}
              depthTest={true}
            />
          );
        })}
      </>
    );
  } else {
      return null;
  }
};