/**
 * eraser.ts — Pure geometry algorithms for CalcInk erasers.
 *
 * Requirements: FR-10, FR-14.
 * - Distance from point to segment and polyline.
 * - Stroke eraser hit testing (distance <= eraserRadius + stroke.width / 2).
 * - Linear interpolation along long segments before cutting.
 * - Pixel eraser stroke splitting by circular hit area.
 * - Fragments with fewer than 2 points are dropped.
 * - Zero DOM / React dependencies.
 */

import type { Point, Stroke } from '../contract';

/**
 * Calculates Euclidean distance between two 2D points.
 */
export function distanceBetweenPoints(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * Calculates the shortest distance from a point (px, py) to a line segment (x1, y1) - (x2, y2).
 */
export function distancePointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  // Projection parameter clamped to [0, 1]
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.hypot(px - projX, py - projY);
}

/**
 * Calculates the shortest distance from a point to a stroke's polyline.
 */
export function distancePointToPolyline(
  point: { x: number; y: number },
  points: readonly Point[]
): number {
  if (points.length === 0) return Infinity;

  const first = points[0];
  if (!first) return Infinity;

  if (points.length === 1) {
    return Math.hypot(point.x - first.x, point.y - first.y);
  }

  let minDistance = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (!p1 || !p2) continue;

    const dist = distancePointToSegment(point.x, point.y, p1.x, p1.y, p2.x, p2.y);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

/**
 * Hit-test for the stroke eraser.
 * A stroke is hit when distance from stroke polyline to eraser point <= eraserRadius + stroke.width / 2.
 */
export function isStrokeHitByEraser(
  stroke: Stroke,
  center: { x: number; y: number },
  eraserRadius: number
): boolean {
  if (stroke.points.length === 0) return false;

  const dist = distancePointToPolyline(center, stroke.points);
  const threshold = eraserRadius + stroke.width / 2;

  return dist <= threshold;
}

/**
 * Inserts linearly interpolated points along any segment whose length exceeds maxDistance.
 * Ensures cuts are clean and reliable regardless of how fast the pen moved.
 */
export function interpolatePoints(
  points: readonly Point[],
  maxDistance: number
): Point[] {
  if (points.length <= 1 || maxDistance <= 0) {
    return points.map((p) => ({ ...p }));
  }

  const result: Point[] = [];
  const first = points[0];
  if (!first) return [];

  result.push({ ...first });

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (!p0 || !p1) continue;

    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);

    if (dist > maxDistance) {
      const steps = Math.ceil(dist / maxDistance);
      for (let s = 1; s < steps; s++) {
        const fraction = s / steps;
        result.push({
          x: p0.x + (p1.x - p0.x) * fraction,
          y: p0.y + (p1.y - p0.y) * fraction,
          pressure: p0.pressure + (p1.pressure - p0.pressure) * fraction,
          t: p0.t + (p1.t - p0.t) * fraction,
        });
      }
    }

    result.push({ ...p1 });
  }

  return result;
}

let nextFragmentCounter = 1;

/**
 * Cuts a stroke with a circular eraser.
 * - Long segments are interpolated first so cuts are clean.
 * - Points inside the circle are dropped.
 * - Continuous sequences of points outside the circle form new fragments.
 * - Fragments with fewer than 2 points are dropped.
 * - If no points fall inside the circle, the original stroke is returned untouched.
 */
export function splitStrokeByCircle(
  stroke: Stroke,
  center: { x: number; y: number },
  radius: number,
  maxInterpolationStep?: number
): Stroke[] {
  if (stroke.points.length === 0 || radius <= 0) {
    return [stroke];
  }

  // Adaptive interpolation step based on eraser radius
  const step = maxInterpolationStep ?? Math.max(2, Math.min(radius / 2, 4));
  const densePoints = interpolatePoints(stroke.points, step);

  let anyInside = false;
  const isInside = (pt: Point) => {
    const d = Math.hypot(pt.x - center.x, pt.y - center.y);
    return d <= radius;
  };

  for (const pt of densePoints) {
    if (isInside(pt)) {
      anyInside = true;
      break;
    }
  }

  // If no points fall inside the eraser circle, return the stroke untouched
  if (!anyInside) {
    return [stroke];
  }

  const fragments: Point[][] = [];
  let currentFragment: Point[] = [];

  for (const pt of densePoints) {
    if (!isInside(pt)) {
      currentFragment.push(pt);
    } else {
      if (currentFragment.length >= 2) {
        fragments.push(currentFragment);
      }
      currentFragment = [];
    }
  }

  if (currentFragment.length >= 2) {
    fragments.push(currentFragment);
  }

  // Convert fragments into new immutable Stroke objects
  return fragments.map((pts, idx) => ({
    id: `${stroke.id}_f${idx}_${nextFragmentCounter++}`,
    points: pts,
    width: stroke.width,
    color: stroke.color,
    pointerType: stroke.pointerType,
  }));
}
