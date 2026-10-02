// ─── Stroke Data Model ─────────────────────────────────────────────
// Pure data model — no rendering logic here.

export interface Point {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  width: number;
  color: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getStrokeBounds(stroke: Stroke): BoundingBox | null {
  if (stroke.points.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function getGroupBounds(strokes: Stroke[]): BoundingBox | null {
  if (strokes.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of strokes) {
    const b = getStrokeBounds(stroke);
    if (!b) continue;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

let _nextId = 0;
export function generateStrokeId(): string {
  return `s_${Date.now()}_${_nextId++}`;
}
