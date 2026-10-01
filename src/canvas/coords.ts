/**
 * coords.ts — Coordinate conversion utilities for the CalcInk canvas.
 *
 * Requirements: FR-9, FR-9b.
 * Coordinates are stored strictly in CSS pixels in logical page space.
 * This guarantees rendering and recognition stay independent of devicePixelRatio
 * or viewport scaling.
 */

export interface PageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Converts client (viewport) coordinates to page-relative coordinates in CSS pixels.
 *
 * @param clientX The pointer event's clientX.
 * @param clientY The pointer event's clientY.
 * @param pageRect The bounding client rectangle of the page / canvas element.
 * @param clamp Whether to clamp coordinates to the page boundary (default false).
 * @returns Point `{ x, y }` in logical page coordinates (CSS pixels).
 */
export function eventToPageCoords(
  clientX: number,
  clientY: number,
  pageRect: PageRect,
  clamp: boolean = false
): { x: number; y: number } {
  let x = clientX - pageRect.left;
  let y = clientY - pageRect.top;

  if (clamp) {
    x = Math.max(0, Math.min(x, pageRect.width));
    y = Math.max(0, Math.min(y, pageRect.height));
  }

  return { x, y };
}
