import { describe, it, expect } from 'vitest';
import {
  distancePointToSegment,
  distancePointToPolyline,
  isStrokeHitByEraser,
  interpolatePoints,
  splitStrokeByCircle,
} from './eraser';
import type { Point, Stroke } from '../contract';

describe('eraser geometry: distancePointToSegment', () => {
  it('calculates perpendicular distance to segment', () => {
    // Segment from (0, 0) to (10, 0), point at (5, 5)
    const dist = distancePointToSegment(5, 5, 0, 0, 10, 0);
    expect(dist).toBeCloseTo(5);
  });

  it('calculates distance to start endpoint when projection falls before start', () => {
    // Segment from (0, 0) to (10, 0), point at (-3, 4) -> distance to (0, 0) is 5
    const dist = distancePointToSegment(-3, 4, 0, 0, 10, 0);
    expect(dist).toBeCloseTo(5);
  });

  it('calculates distance to end endpoint when projection falls after end', () => {
    // Segment from (0, 0) to (10, 0), point at (13, 4) -> distance to (10, 0) is 5
    const dist = distancePointToSegment(13, 4, 0, 0, 10, 0);
    expect(dist).toBeCloseTo(5);
  });

  it('handles zero-length segment (degenerate line)', () => {
    const dist = distancePointToSegment(3, 4, 0, 0, 0, 0);
    expect(dist).toBeCloseTo(5);
  });
});

describe('eraser geometry: distancePointToPolyline', () => {
  it('returns Infinity for empty polyline', () => {
    expect(distancePointToPolyline({ x: 0, y: 0 }, [])).toBe(Infinity);
  });

  it('calculates distance to single-point polyline', () => {
    const pts: Point[] = [{ x: 10, y: 10, pressure: 0.5, t: 0 }];
    expect(distancePointToPolyline({ x: 10, y: 14 }, pts)).toBeCloseTo(4);
  });

  it('calculates minimum distance across multiple segments', () => {
    const pts: Point[] = [
      { x: 0, y: 0, pressure: 0.5, t: 0 },
      { x: 10, y: 0, pressure: 0.5, t: 10 },
      { x: 10, y: 20, pressure: 0.5, t: 20 },
    ];
    // Point at (15, 10) is 5 units from segment (10,0)-(10,20)
    expect(distancePointToPolyline({ x: 15, y: 10 }, pts)).toBeCloseTo(5);
  });
});

describe('stroke eraser: isStrokeHitByEraser', () => {
  const stroke: Stroke = {
    id: 's1',
    points: [
      { x: 0, y: 50, pressure: 0.5, t: 0 },
      { x: 100, y: 50, pressure: 0.5, t: 100 },
    ],
    width: 4,
    color: '#000',
    pointerType: 'mouse',
  };

  it('returns true when eraser center is within eraserRadius + stroke.width / 2', () => {
    // Stroke centerline at y=50, width=4 (half-width = 2).
    // Eraser at y=60, radius=10 -> threshold = 10 + 2 = 12. Distance is 10 <= 12 -> HIT
    expect(isStrokeHitByEraser(stroke, { x: 50, y: 60 }, 10)).toBe(true);
  });

  it('returns false when eraser center is outside eraserRadius + stroke.width / 2', () => {
    // Eraser at y=65, radius=10 -> threshold = 12. Distance is 15 > 12 -> MISS
    expect(isStrokeHitByEraser(stroke, { x: 50, y: 65 }, 10)).toBe(false);
  });

  it('returns false for stroke with no points', () => {
    const emptyStroke: Stroke = { ...stroke, points: [] };
    expect(isStrokeHitByEraser(emptyStroke, { x: 50, y: 50 }, 10)).toBe(false);
  });
});

describe('interpolation: interpolatePoints', () => {
  it('returns original points if distance is within maxDistance', () => {
    const pts: Point[] = [
      { x: 0, y: 0, pressure: 0.5, t: 0 },
      { x: 2, y: 0, pressure: 0.5, t: 10 },
    ];
    const result = interpolatePoints(pts, 5);
    expect(result).toHaveLength(2);
    expect(result[0]?.x).toBe(0);
    expect(result[1]?.x).toBe(2);
  });

  it('inserts interpolated points along long segments', () => {
    const pts: Point[] = [
      { x: 0, y: 0, pressure: 0.2, t: 0 },
      { x: 100, y: 0, pressure: 0.8, t: 100 },
    ];
    // maxDistance = 25 -> 4 steps -> 5 points total (x=0, 25, 50, 75, 100)
    const result = interpolatePoints(pts, 25);
    expect(result).toHaveLength(5);
    expect(result[0]?.x).toBe(0);
    expect(result[1]?.x).toBeCloseTo(25);
    expect(result[2]?.x).toBeCloseTo(50);
    expect(result[3]?.x).toBeCloseTo(75);
    expect(result[4]?.x).toBe(100);

    // Checks linear interpolation of pressure and time
    expect(result[2]?.pressure).toBeCloseTo(0.5);
    expect(result[2]?.t).toBeCloseTo(50);
  });
});

describe('pixel eraser: splitStrokeByCircle', () => {
  // A horizontal stroke from (0, 0) to (100, 0)
  const stroke: Stroke = {
    id: 'stroke-1',
    points: [
      { x: 0, y: 0, pressure: 0.5, t: 0 },
      { x: 100, y: 0, pressure: 0.5, t: 100 },
    ],
    width: 2,
    color: '#1a1a2e',
    pointerType: 'mouse',
  };

  it('middle cut gives two strokes', () => {
    // Cut in the middle at (50, 0) with radius 10 (step 2)
    const frags = splitStrokeByCircle(stroke, { x: 50, y: 0 }, 10, 2);
    expect(frags).toHaveLength(2);

    const f0 = frags[0]!;
    const f1 = frags[1]!;

    expect(f0.id).not.toBe(stroke.id);
    expect(f1.id).not.toBe(stroke.id);
    expect(f0.id).not.toBe(f1.id);

    // Left fragment ends around x <= 40
    expect(f0.points[0]?.x).toBe(0);
    expect(f0.points[f0.points.length - 1]?.x).toBeLessThanOrEqual(40);
    expect(f0.points.length).toBeGreaterThanOrEqual(2);

    // Right fragment starts around x >= 60 and ends at 100
    expect(f1.points[0]?.x).toBeGreaterThanOrEqual(60);
    expect(f1.points[f1.points.length - 1]?.x).toBe(100);
    expect(f1.points.length).toBeGreaterThanOrEqual(2);

    // Preserves stroke properties
    expect(f0.width).toBe(stroke.width);
    expect(f0.color).toBe(stroke.color);
    expect(f0.pointerType).toBe(stroke.pointerType);
  });

  it('edge cut gives one stroke', () => {
    // Eraser covers the beginning at (0, 0) with radius 15
    const frags = splitStrokeByCircle(stroke, { x: 0, y: 0 }, 15, 2);
    expect(frags).toHaveLength(1);

    const f = frags[0]!;
    expect(f.points[0]?.x).toBeGreaterThanOrEqual(15);
    expect(f.points[f.points.length - 1]?.x).toBe(100);
    expect(f.points.length).toBeGreaterThanOrEqual(2);
  });

  it('full cover gives none', () => {
    // Eraser covers the entire stroke at (50, 0) with radius 80
    const frags = splitStrokeByCircle(stroke, { x: 50, y: 0 }, 80, 2);
    expect(frags).toHaveLength(0);
  });

  it('drops fragments under 2 points', () => {
    // Stroke with points at x=0, x=5, x=10
    const shortStroke: Stroke = {
      id: 'short-1',
      points: [
        { x: 0, y: 0, pressure: 0.5, t: 0 },
        { x: 5, y: 0, pressure: 0.5, t: 5 },
        { x: 10, y: 0, pressure: 0.5, t: 10 },
      ],
      width: 2,
      color: '#000',
      pointerType: 'mouse',
    };

    // If an eraser cuts everything except x=0 (1 point left), that fragment must be dropped
    // Place eraser at (8, 0) with radius 6 -> covers points at x=5 and x=10.
    // Only x=0 remains outside circle. Since it has only 1 point, it is dropped.
    const frags = splitStrokeByCircle(shortStroke, { x: 8, y: 0 }, 6, 10);
    expect(frags).toHaveLength(0);
  });

  it('returns original stroke untouched when eraser does not touch it', () => {
    const frags = splitStrokeByCircle(stroke, { x: 50, y: 200 }, 10, 2);
    expect(frags).toHaveLength(1);
    expect(frags[0]).toBe(stroke); // Exact reference preserved
  });
});
