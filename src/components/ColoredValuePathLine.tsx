import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

interface SegmentData {
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
  value: number;
}

interface ColoredValuePathLineProps {
  segments: SegmentData[];
  minVal: number;
  maxVal: number;
  lineWidth?: number;
  colorScaleFn?: (normalizedValue: number) => THREE.Color;
}

const defaultColorScaleFn = (normalizedValue: number): THREE.Color => {
  const hue = (1 - normalizedValue) * 240 / 360;
  return new THREE.Color().setHSL(hue, 1, 0.5);
};

export const ColoredValuePathLine: React.FC<ColoredValuePathLineProps> = ({
  segments,
  minVal,
  maxVal,
  lineWidth = 5,
  colorScaleFn = defaultColorScaleFn,
}) => {
  const { size } = useThree();

  const { geometry, colorsArray, offset } = useMemo(() => {
    if (segments.length === 0) return { geometry: null, colorsArray: null, offset: null };

    const pathOffset = segments[0].startPoint.clone();
    const positions: number[] = [];
    const colors: number[] = [];
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    segments.forEach(segment => {
      const relativeStart = segment.startPoint.clone().sub(pathOffset);
      const relativeEnd = segment.endPoint.clone().sub(pathOffset);

      positions.push(relativeStart.x, relativeStart.y, relativeStart.z);
      positions.push(relativeEnd.x, relativeEnd.y, relativeEnd.z);

      const normalizedValue = Math.max(0, Math.min(1, (segment.value - minVal) / range));
      const color = colorScaleFn(normalizedValue);

      colors.push(color.r, color.g, color.b);
      colors.push(color.r, color.g, color.b);
    });

    if (positions.length === 0) return { geometry: null, colorsArray: null, offset: null };

    const lineGeom = new LineGeometry();
    lineGeom.setPositions(positions);
    lineGeom.setColors(colors);

    return { geometry: lineGeom, colorsArray: colors, offset: pathOffset };
  }, [segments, minVal, maxVal, colorScaleFn]);

  const material = useMemo(() => {
    if (!geometry) return null;
    return new LineMaterial({
      linewidth: lineWidth,
      vertexColors: true,
      dashed: false,
      alphaToCoverage: true,
      resolution: new THREE.Vector2(size.width, size.height),
    });
  }, [geometry, lineWidth, size]);

  const line = useMemo(() => {
    if (!geometry || !material || !colorsArray || !offset) return null;
    const lineSegments = new LineSegments2(geometry, material);
    lineSegments.position.copy(offset);
    lineSegments.computeLineDistances();
    return lineSegments;
  }, [geometry, material, colorsArray, offset]);

  if (!line) return null;

  return <primitive object={line} />;
};