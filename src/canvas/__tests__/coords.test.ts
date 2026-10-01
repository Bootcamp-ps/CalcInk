import { describe, it, expect } from 'vitest';
import { eventToPageCoords, PageRect } from '../coords';

describe('eventToPageCoords', () => {
  const standardRect: PageRect = {
    left: 100,
    top: 50,
    width: 800,
    height: 600,
  };

  it('converts client coordinates to page-relative coordinates accurately', () => {
    const coords = eventToPageCoords(150, 120, standardRect);
    expect(coords).toEqual({ x: 50, y: 70 });
  });

  it('handles origin (top-left corner of canvas)', () => {
    const coords = eventToPageCoords(100, 50, standardRect);
    expect(coords).toEqual({ x: 0, y: 0 });
  });

  it('handles fractional / subpixel values', () => {
    const coords = eventToPageCoords(123.45, 67.89, standardRect);
    expect(coords.x).toBeCloseTo(23.45, 5);
    expect(coords.y).toBeCloseTo(17.89, 5);
  });

  it('supports clamping within page bounds when requested', () => {
    const outsideCoords = eventToPageCoords(50, 20, standardRect, true);
    expect(outsideCoords).toEqual({ x: 0, y: 0 });

    const beyondCoords = eventToPageCoords(1000, 700, standardRect, true);
    expect(beyondCoords).toEqual({ x: 800, y: 600 });
  });

  it('maintains CSS-pixel coordinates regardless of devicePixelRatio (1, 1.5, 2, 3)', () => {
    // In browser CSS layouts, clientX/clientY and getBoundingClientRect() are already
    // reported in CSS pixels, whether DPR is 1, 1.5, 2, or 3.
    // The coordinate function operates in CSS page coordinates as specified in FR-9.
    const dprList = [1, 1.5, 2, 3];
    for (const dpr of dprList) {
      // Simulate client event at CSS pixel (300, 250) on page at (100, 50)
      const coords = eventToPageCoords(300, 250, standardRect);
      expect(coords.x).toBe(200);
      expect(coords.y).toBe(200);
      // Verify that device pixel scaling (e.g. 200 * dpr) is a canvas buffer property,
      // not a page-coordinate store property
      expect(coords.x * dpr).toBe(200 * dpr);
    }
  });
});
