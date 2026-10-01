/**
 * inkRenderer.ts — Rendering pipeline for CalcInk strokes using perfect-freehand.
 *
 * Requirements: FR-3.
 * - Pressure-aware outlines via `perfect-freehand`.
 * - SVG path generation via midpoint quadratic beziers.
 * - WeakMap caching of `Path2D` instances per Stroke object.
 * - Live and committed strokes render with identical options so there is zero "pop".
 */

import { getStroke } from 'perfect-freehand';
import type { Point, Stroke } from '../contract';

const pathCache = new WeakMap<Stroke, Path2D>();

/**
 * Converts a polygon outline (array of [x, y] points) into an SVG path string
 * using midpoint quadratic bezier curves, as recommended by perfect-freehand.
 */
export function outlineToSvgPath(outline: number[][]): string {
  if (outline.length === 0) return '';
  const first = outline[0];
  if (!first || first.length < 2) return '';

  if (outline.length === 1) {
    const x = first[0];
    const y = first[1];
    if (x === undefined || y === undefined) return '';
    return `M ${x} ${y} A 0.5 0.5 0 1 0 ${x + 0.01} ${y}`;
  }

  const startX = first[0];
  const startY = first[1];
  if (startX === undefined || startY === undefined) return '';

  let d = `M ${startX} ${startY}`;

  for (let i = 0; i < outline.length - 1; i++) {
    const p0 = outline[i];
    const p1 = outline[i + 1];
    if (!p0 || !p1) continue;

    const p0x = p0[0];
    const p0y = p0[1];
    const p1x = p1[0];
    const p1y = p1[1];
    if (p0x === undefined || p0y === undefined || p1x === undefined || p1y === undefined) continue;

    const mx = (p0x + p1x) / 2;
    const my = (p0y + p1y) / 2;
    d += ` Q ${p0x} ${p0y}, ${mx} ${my}`;
  }

  d += ` Z`;
  return d;
}

/**
 * Options passed to `getStroke` from perfect-freehand.
 * Ensures committed and live strokes share the exact same visual properties.
 */
export function getStrokeOptions(width: number, pointerType: 'pen' | 'mouse' | 'touch') {
  return {
    size: width * 2,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: pointerType !== 'pen',
  };
}

/**
 * Computes or retrieves from cache the Path2D object for a committed Stroke.
 */
export function getStrokePath(stroke: Stroke): Path2D {
  let path = pathCache.get(stroke);
  if (path) return path;

  const pointsInput = stroke.points.map((pt) => [pt.x, pt.y, pt.pressure]);
  const outline = getStroke(pointsInput, getStrokeOptions(stroke.width, stroke.pointerType));
  const svgPath = outlineToSvgPath(outline);
  path = new Path2D(svgPath);
  pathCache.set(stroke, path);
  return path;
}

/**
 * Renders a single committed stroke onto a canvas 2D context.
 */
export function renderCommittedStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const path = getStrokePath(stroke);
  ctx.save();
  ctx.fillStyle = stroke.color;
  ctx.fill(path);
  ctx.restore();
}

/**
 * Redraws all committed strokes onto the canvas 2D context.
 * Used for undo, redo, clear, resize, and DPR change.
 */
export function renderAllStrokes(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[]): void {
  for (const stroke of strokes) {
    renderCommittedStroke(ctx, stroke);
  }
}

/**
 * Renders an active, in-progress stroke onto the live canvas 2D context.
 */
export function renderLiveStroke(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  width: number,
  color: string,
  pointerType: 'pen' | 'mouse' | 'touch'
): void {
  if (points.length === 0) return;

  const pointsInput = points.map((pt) => [pt.x, pt.y, pt.pressure]);
  const outline = getStroke(pointsInput, getStrokeOptions(width, pointerType));
  const svgPath = outlineToSvgPath(outline);
  const path = new Path2D(svgPath);

  ctx.save();
  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.restore();
}
