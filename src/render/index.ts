// ─── Result Renderer ───────────────────────────────────────────────
// Draws the computed result on a separate overlay canvas,
// positioned next to the "=" symbol's bounding box.
// Uses a handwriting-style font. Result never becomes part of input strokes.

import { BoundingBox } from '../canvas/strokeModel';
import { SymbolGroup } from '../recognition/symbolGrouper';

export interface ResultDisplay {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

/**
 * Calculate where to place the result text based on the "=" symbol's position.
 */
export function calculateResultPosition(
  groups: SymbolGroup[],
  tokens: string[],
): { x: number; y: number; baselineY: number } | null {
  // Find the "=" token and its corresponding group
  const equalsIdx = tokens.lastIndexOf('=');
  if (equalsIdx < 0 || equalsIdx >= groups.length) return null;

  const equalsGroup = groups[equalsIdx];
  const bounds = equalsGroup.bounds;

  return {
    x: bounds.x + bounds.width + 15,
    y: bounds.y,
    baselineY: bounds.y + bounds.height / 2,
  };
}

/**
 * Render the result on the overlay canvas.
 */
export function renderResult(
  ctx: CanvasRenderingContext2D,
  _canvas: HTMLCanvasElement,
  result: string,
  position: { x: number; y: number; baselineY: number },
  fontSize: number = 36,
): void {
  // Draw result text in handwritten style
  ctx.font = `${fontSize}px 'Caveat', 'Segoe Script', 'Comic Sans MS', cursive`;
  ctx.fillStyle = '#2563eb';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  ctx.fillText(result, position.x, position.baselineY);
}

/**
 * Render confidence indicator as small dots under each symbol group.
 */
export function renderConfidenceIndicators(
  ctx: CanvasRenderingContext2D,
  groups: SymbolGroup[],
  confidences: number[],
): void {
  for (let i = 0; i < groups.length && i < confidences.length; i++) {
    const group = groups[i];
    const confidence = confidences[i];
    const bounds = group.bounds;

    // Color based on confidence: green > 0.8, yellow > 0.5, red < 0.5
    let color: string;
    if (confidence >= 0.8) color = 'rgba(34, 197, 94, 0.6)';
    else if (confidence >= 0.5) color = 'rgba(234, 179, 8, 0.6)';
    else color = 'rgba(239, 68, 68, 0.6)';

    // Draw a small dot centered under the group
    const dotX = bounds.x + bounds.width / 2;
    const dotY = bounds.y + bounds.height + 8;
    const radius = 3;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Clear the overlay canvas.
 */
export function clearOverlay(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
