// @ts-nocheck
// ─── Symbol Grouping ───────────────────────────────────────────────
// Groups strokes into individual symbols using spatial/temporal clustering.
// Sorts groups left-to-right for expression ordering.

import { Stroke, BoundingBox, getStrokeBounds } from '../canvas/strokeModel';

export interface SymbolGroup {
  strokes: Stroke[];
  bounds: BoundingBox;
  centroidX: number;
}

/**
 * Group strokes into symbols by spatial proximity.
 * Strokes whose bounding boxes overlap or are within `gapThreshold` pixels
 * of each other are merged into a single symbol group.
 */
export function groupStrokesIntoSymbols(
  strokes: Stroke[],
  gapThreshold: number = 30,
): SymbolGroup[] {
  if (strokes.length === 0) return [];

  // Get bounds for each stroke
  const items = strokes.map(s => ({
    stroke: s,
    bounds: getStrokeBounds(s),
  })).filter(item => item.bounds !== null) as { stroke: Stroke; bounds: BoundingBox }[];

  if (items.length === 0) return [];

  // Sort by leftmost x first
  items.sort((a, b) => a.bounds.x - b.bounds.x);

  // Union-Find for grouping
  const parent = items.map((_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  }
  function union(a: number, b: number) {
    parent[find(a)] = find(b);
  }

  // Merge strokes that belong to the same symbol
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (shouldGroupStrokes(items[i].stroke, items[i].bounds, items[j].stroke, items[j].bounds, gapThreshold)) {
        union(i, j);
      }
    }
  }

  // Collect groups
  const groupMap = new Map<number, { strokes: Stroke[]; bounds: BoundingBox[] }>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    if (!groupMap.has(root)) {
      groupMap.set(root, { strokes: [], bounds: [] });
    }
    groupMap.get(root)!.strokes.push(items[i].stroke);
    groupMap.get(root)!.bounds.push(items[i].bounds);
  }

  // Build SymbolGroup objects
  const groups: SymbolGroup[] = [];
  for (const group of groupMap.values()) {
    const merged = mergeBounds(group.bounds);
    groups.push({
      strokes: group.strokes,
      bounds: merged,
      centroidX: merged.x + merged.width / 2,
    });
  }

  // Sort left-to-right by centroid
  groups.sort((a, b) => a.centroidX - b.centroidX);

  return groups;
}

function shouldGroupStrokes(
  s1: Stroke,
  b1: BoundingBox,
  s2: Stroke,
  b2: BoundingBox,
  gapThreshold: number,
): boolean {
  // Quick reject if bounding boxes are far apart
  const maxGapX = Math.max(gapThreshold, 30);
  const maxGapY = Math.max(gapThreshold, 60);
  if (
    b1.x > b2.x + b2.width + maxGapX ||
    b2.x > b1.x + b1.width + maxGapX ||
    b1.y > b2.y + b2.height + maxGapY ||
    b2.y > b1.y + b1.height + maxGapY
  ) {
    return false;
  }

  // 1. Direct segment intersection (e.g. '+', '×', '4', crossed '7')
  if (doStrokesIntersect(s1, s2)) {
    return true;
  }

  // 2. Physical touching / close contact
  const minDist = minDistanceBetweenStrokes(s1, s2);
  const touchLimit = Math.min(gapThreshold, 10);
  if (minDist <= touchLimit) {
    return true;
  }

  // Horizontal overlap & vertical gap
  const overlapX = Math.min(b1.x + b1.width, b2.x + b2.width) - Math.max(b1.x, b2.x);
  const minW = Math.min(b1.width, b2.width);
  const vertGap = Math.max(0, Math.max(b1.y, b2.y) - Math.min(b1.y + b1.height, b2.y + b2.height));
  const maxH = Math.max(b1.height, b2.height);

  // 3. Vertically stacked parallel/sub-strokes (e.g. '=' sign, '÷' dots, '5' hat)
  // Must have substantial horizontal overlap: at least 30% of the narrower stroke
  if (overlapX > 0.30 * minW && minW > 0) {
    if (vertGap <= Math.max(50, maxH * 3.0)) {
      return true;
    }
  }

  // 4. Strong 2D containment (one stroke inside the other's bounding box)
  const overlapY = Math.min(b1.y + b1.height, b2.y + b2.height) - Math.max(b1.y, b2.y);
  const minH = Math.min(b1.height, b2.height);
  if (overlapX > 0.6 * minW && overlapY > 0.6 * minH) {
    return true;
  }

  return false;
}

function minDistanceBetweenStrokes(s1: Stroke, s2: Stroke): number {
  let minDistSq = Infinity;
  for (const p1 of s1.points) {
    for (const p2 of s2.points) {
      const dSq = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        if (minDistSq === 0) return 0;
      }
    }
  }
  return Math.sqrt(minDistSq);
}

function segmentsIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): boolean {
  function ccw(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  }
  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

function doStrokesIntersect(s1: Stroke, s2: Stroke): boolean {
  for (let i = 0; i < s1.points.length - 1; i++) {
    for (let j = 0; j < s2.points.length - 1; j++) {
      if (segmentsIntersect(s1.points[i], s1.points[i + 1], s2.points[j], s2.points[j + 1])) {
        return true;
      }
    }
  }
  return false;
}

function mergeBounds(boxes: BoundingBox[]): BoundingBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boxes) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}
