import { describe, it, expect } from 'vitest';
import { eventToPageCoords } from './coords';

describe('eventToPageCoords', () => {
  const rect = {
    left: 100,
    top: 50,
    width: 800,
    height: 600,
  };

  it('converts client coordinates to page coordinates', () => {
    const coords = eventToPageCoords(150, 120, rect);
    expect(coords.x).toBe(50);
    expect(coords.y).toBe(70);
  });

  it('clamps coordinates to boundary when clamp is true', () => {
    const outLeft = eventToPageCoords(50, 200, rect, true);
    expect(outLeft.x).toBe(0);

    const outRight = eventToPageCoords(1000, 200, rect, true);
    expect(outRight.x).toBe(800);

    const outBottom = eventToPageCoords(200, 800, rect, true);
    expect(outBottom.y).toBe(600);
  });

  it('allows coordinates outside bounds when clamp is false', () => {
    const coords = eventToPageCoords(50, 20, rect, false);
    expect(coords.x).toBe(-50);
    expect(coords.y).toBe(-30);
  });
});
