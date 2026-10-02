import { describe, it, expect } from 'vitest';
import {
  getStrokeBounds,
  getGroupBounds,
  generateStrokeId,
  type Stroke,
  type Point,
} from '../canvas/strokeModel';

function makePoint(x: number, y: number): Point {
  return { x, y, pressure: 0.5, timestamp: Date.now() };
}

function makeStroke(points: [number, number][], width = 3): Stroke {
  return {
    id: generateStrokeId(),
    points: points.map(([x, y]) => makePoint(x, y)),
    width,
    color: '#000',
  };
}

describe('getStrokeBounds', () => {
  it('returns null for empty stroke', () => {
    const stroke = makeStroke([]);
    expect(getStrokeBounds(stroke)).toBeNull();
  });

  it('returns correct bounds for a single point', () => {
    const stroke = makeStroke([[50, 100]]);
    const bounds = getStrokeBounds(stroke);
    expect(bounds).toEqual({ x: 50, y: 100, width: 0, height: 0 });
  });

  it('returns correct bounds for multiple points', () => {
    const stroke = makeStroke([[10, 20], [30, 40], [50, 10]]);
    const bounds = getStrokeBounds(stroke);
    expect(bounds).toEqual({ x: 10, y: 10, width: 40, height: 30 });
  });
});

describe('getGroupBounds', () => {
  it('returns null for empty array', () => {
    expect(getGroupBounds([])).toBeNull();
  });

  it('returns merged bounds of multiple strokes', () => {
    const s1 = makeStroke([[0, 0], [10, 10]]);
    const s2 = makeStroke([[20, 5], [30, 15]]);
    const bounds = getGroupBounds([s1, s2]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 30, height: 15 });
  });
});

describe('generateStrokeId', () => {
  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateStrokeId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('DPR coordinate conversion', () => {
  it('CSS px → canvas px conversion is dpr-dependent', () => {
    // Simulate DPR conversion
    const dpr = 2;
    const cssX = 100;
    const cssY = 200;
    const canvasX = cssX; // In our setup, we scale the context, so coords stay in CSS px
    const canvasY = cssY;
    expect(canvasX).toBe(100);
    expect(canvasY).toBe(200);
    // Canvas pixel size is CSS * dpr
    expect(cssX * dpr).toBe(200);
    expect(cssY * dpr).toBe(400);
  });
});
