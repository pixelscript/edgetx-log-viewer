import { ColoredValuePathLine } from './ColoredValuePathLine';
import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { LogEntry, GPS } from '../state/types/logTypes';
import { latLongToCartesian } from '../utils/latLongToCartesian';

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

  const segments = useMemo(() => {
    if (logEntries.length < 2) return [];

    const segmentData: { startPoint: THREE.Vector3; endPoint: THREE.Vector3; value: number }[] = [];

    for (let i = 1; i < logEntries.length; i++) {
      const prevEntry = logEntries[i - 1];
      const currentEntry = logEntries[i];

      const prevGps = prevEntry['gps'] as GPS | undefined;
      const currentGps = currentEntry['gps'] as GPS | undefined;
      const prevAlt = prevEntry['alt'] as number | undefined;
      const currentAlt = currentEntry['alt'] as number | undefined;
      const value = prevEntry[selectedField];

      if (!prevGps || !currentGps || typeof prevAlt !== 'number' || typeof currentAlt !== 'number' || typeof value !== 'number' || !isFinite(value)) {
        continue;
      }

      try {
        const startPoint = latLongToCartesian(prevGps.lat, prevGps.long, prevAlt);
        const endPoint = latLongToCartesian(currentGps.lat, currentGps.long, currentAlt);
        segmentData.push({ startPoint, endPoint, value });
      } catch (error) {
        console.error(`Error processing segment ${i} for ValueColoredPath:`, error, { prevEntry, currentEntry });
      }
    }
    return segmentData;
  }, [logEntries, selectedField]);

  const valuePathColorScaleFn = (normalizedValue: number): THREE.Color => {
    const hue = 0 / 360;
    const saturation = 0.2 + Math.max(0, Math.min(1, normalizedValue)) * 0.8;
    return new THREE.Color().setHSL(hue, saturation, 0.5);
  };

  if (segments.length === 0) return null;

  return (
    <ColoredValuePathLine
      segments={segments}
      minVal={minVal}
      maxVal={maxVal}
      lineWidth={5} // Default thickness
      colorScaleFn={valuePathColorScaleFn}
    />
  );
};

export default ValueColoredPath;