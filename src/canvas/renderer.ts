// ─── Canvas Renderer ───────────────────────────────────────────────
// Renders strokes to a canvas with smooth midpoint-quadratic curves.
// Handles DPR scaling. Pure rendering — no state management.

import { Stroke, Point } from './strokeModel';

export function setupCanvas(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
): { ctx: CanvasRenderingContext2D; dpr: number } {
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return { ctx, dpr };
}

export function clearCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/** Draw a single stroke with midpoint-quadratic smoothing */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const { points, width, color } = stroke;
  if (points.length < 2) {
    if (points.length === 1) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
  } else {
    // Midpoint-quadratic smoothing
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    // Last segment
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  ctx.stroke();
}

/** Render all strokes */
export function renderStrokes(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, strokes: readonly Stroke[]) {
  clearCanvas(ctx, canvas);
  for (const stroke of strokes) {
    drawStroke(ctx, stroke);
  }
}

/** Draw the currently in-progress stroke (for live feedback) */
export function drawLiveStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  color: string = '#1a1a2e',
) {
  drawStroke(ctx, { id: 'live', points, width, color });
}

/** Convert DOM event coordinates to canvas coordinates */
export function eventToCanvasCoords(
  e: PointerEvent | MouseEvent | TouchEvent,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  let clientX: number, clientY: number;
  if ('touches' in e && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = (e as PointerEvent).clientX;
    clientY = (e as PointerEvent).clientY;
  }
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}
