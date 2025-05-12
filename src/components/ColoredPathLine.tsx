import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

interface ColoredPathLineProps {
  points: THREE.Vector3[];
  color: THREE.ColorRepresentation;
  lineWidth?: number;
}

export const ColoredPathLine: React.FC<ColoredPathLineProps> = ({ points, color, lineWidth = 5 }) => {
  const { size } = useThree();

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const lineSegmentsGeometry = new LineGeometry();
    const positions = points.flatMap(point => [point.x, point.y, point.z]);
    lineSegmentsGeometry.setPositions(positions);
    return lineSegmentsGeometry;
  }, [points]);

  const material = useMemo(() => {
    if (!geometry) return null;
    return new LineMaterial({
      linewidth: lineWidth,
      color: color,
      alphaToCoverage: true,
      resolution: new THREE.Vector2(size.width, size.height),
      depthTest: true,
      transparent: true,
    });
  }, [geometry, color, lineWidth, size]);

  const line = useMemo(() => {
    if (!geometry || !material) return null;
    const lineSegments = new LineSegments2(geometry, material);
    return lineSegments;
  }, [geometry, material]);

  if (!line) return null;

  return <primitive object={line} />;
};