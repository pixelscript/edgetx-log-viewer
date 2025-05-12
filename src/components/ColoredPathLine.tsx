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
    if (points.length < 2) return null; // Need at least two points for a line

    // Calculate offset from the first point
    const offset = points[0].clone();

    // Create points relative to the offset
    const relativePoints = points.map(p => p.clone().sub(offset));

    const lineSegmentsGeometry = new LineGeometry();
    const positions = relativePoints.flatMap(point => [point.x, point.y, point.z]);
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
    if (!geometry || !material || points.length === 0) return null;

    const lineSegments = new LineSegments2(geometry, material);
    const offset = points[0];
    lineSegments.position.copy(offset);

    return lineSegments;
  }, [geometry, material, points]);

  if (!line) return null;

  return <primitive object={line} />;
};