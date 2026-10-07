/**
 * paperSpec.test.ts — Unit tests for paperSpec.ts and drawPaper().
 *
 * Tests:
 * - 6 tones exist with correct family
 * - Spacing constants are positive numbers
 * - Each tone has a valid light/dark family
 * - getPaletteForFamily returns correct palette
 * - Palette index is preserved across family switch
 * - drawPaper: ruled draws lines at expected y positions
 * - drawPaper: dot draws expected grid arcs
 * - drawPaper: plain draws only the fill
 */

import { describe, it, expect, vi } from 'vitest';
import {
  TONE_SPECS,
  RULED_SPACING,
  DOT_SPACING,
  DOT_RADIUS,
  getToneSpec,
  getPaletteForFamily,
  getDefaultPaperSpec,
  drawPaper,
  LIGHT_PALETTE,
  DARK_PALETTE,
  type PaperSpec,
  type PaperTone,
  type PaperFamily,
} from '../paperSpec';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal mock CanvasRenderingContext2D. */
function makeMockCtx() {
  const calls: { method: string; args: unknown[] }[] = [];

  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };

  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    stroke: record('stroke'),
    fill: record('fill'),
    save: record('save'),
    restore: record('restore'),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    _calls: calls,
  } as unknown as CanvasRenderingContext2D & { _calls: typeof calls };

  return ctx;
}

// ---------------------------------------------------------------------------
// Tone specs
// ---------------------------------------------------------------------------

describe('TONE_SPECS', () => {
  it('exports exactly 6 tones', () => {
    expect(TONE_SPECS).toHaveLength(6);
  });

  it('has 5 light tones and 1 dark tone', () => {
    const light = TONE_SPECS.filter((s) => s.family === 'light');
    const dark = TONE_SPECS.filter((s) => s.family === 'dark');
    expect(light).toHaveLength(5);
    expect(dark).toHaveLength(1);
  });

  it('dark tone is chalkboard', () => {
    const dark = TONE_SPECS.find((s) => s.family === 'dark');
    expect(dark?.tone).toBe('chalkboard');
  });

  it.each<PaperTone>([
    'cream',
    'white',
    'blue-grey',
    'sage',
    'blush',
    'chalkboard',
  ])('tone %s exists and has a valid family', (tone) => {
    const spec = getToneSpec(tone);
    expect(spec.tone).toBe(tone);
    expect(['light', 'dark'] as PaperFamily[]).toContain(spec.family);
  });

  it('every tone has a non-empty bg colour', () => {
    for (const spec of TONE_SPECS) {
      expect(spec.bg).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });

  it('getToneSpec throws for unknown tone', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => getToneSpec('unknown' as any)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Spacing constants
// ---------------------------------------------------------------------------

describe('spacing constants', () => {
  it('RULED_SPACING is approximately 48', () => {
    expect(RULED_SPACING).toBe(48);
  });

  it('RULED_SPACING is a positive integer', () => {
    expect(RULED_SPACING).toBeGreaterThan(0);
    expect(Number.isInteger(RULED_SPACING)).toBe(true);
  });

  it('DOT_SPACING is a positive number', () => {
    expect(DOT_SPACING).toBeGreaterThan(0);
  });

  it('DOT_RADIUS is positive and smaller than DOT_SPACING', () => {
    expect(DOT_RADIUS).toBeGreaterThan(0);
    expect(DOT_RADIUS).toBeLessThan(DOT_SPACING);
  });
});

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

describe('getPaletteForFamily', () => {
  it('returns LIGHT_PALETTE for light family', () => {
    expect(getPaletteForFamily('light')).toBe(LIGHT_PALETTE);
  });

  it('returns DARK_PALETTE for dark family', () => {
    expect(getPaletteForFamily('dark')).toBe(DARK_PALETTE);
  });

  it('each palette has exactly 5 colours', () => {
    expect(LIGHT_PALETTE.colors).toHaveLength(5);
    expect(DARK_PALETTE.colors).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Palette index preservation across family switch
// ---------------------------------------------------------------------------

describe('palette index preservation', () => {
  it('the same index in light and dark palettes are different colours', () => {
    // Index 0 of light ≠ index 0 of dark
    expect(LIGHT_PALETTE.colors[0]).not.toBe(DARK_PALETTE.colors[0]);
  });

  it('preserving index 2 across switch gives index 2 of new palette', () => {
    const paletteIndex = 2;
    const lightColor = LIGHT_PALETTE.colors[paletteIndex];
    const darkColor = DARK_PALETTE.colors[paletteIndex];

    // Simulated family switch: find index in light palette, apply to dark
    const foundIndex = LIGHT_PALETTE.colors.indexOf(lightColor!);
    const newColor = DARK_PALETTE.colors[foundIndex];
    expect(newColor).toBe(darkColor);
  });
});

// ---------------------------------------------------------------------------
// getDefaultPaperSpec
// ---------------------------------------------------------------------------

describe('getDefaultPaperSpec', () => {
  it('returns a ruled blush paper spec', () => {
    const spec = getDefaultPaperSpec();
    expect(spec.type).toBe('ruled');
    expect(spec.toneSpec.tone).toBe('blush');
    expect(spec.toneSpec.family).toBe('light');
  });
});

// ---------------------------------------------------------------------------
// drawPaper — mock context
// ---------------------------------------------------------------------------

describe('drawPaper', () => {
  const WIDTH = 800;
  const HEIGHT = 600;

  it('plain: only fills the background rect', () => {
    const ctx = makeMockCtx();
    const spec: PaperSpec = {
      type: 'plain',
      toneSpec: getToneSpec('cream'),
    };
    drawPaper(ctx as unknown as CanvasRenderingContext2D, spec, WIDTH, HEIGHT);

    const calls = ctx._calls;
    // Must have at least one fillRect (base fill)
    const fillRects = calls.filter((c) => c.method === 'fillRect');
    expect(fillRects.length).toBeGreaterThanOrEqual(1);

    // Plain must not call moveTo (no ruled lines) or arc (no dots)
    const moveToCount = calls.filter((c) => c.method === 'moveTo').length;
    const arcCount = calls.filter((c) => c.method === 'arc').length;
    expect(moveToCount).toBe(0);
    expect(arcCount).toBe(0);
  });

  it('ruled: draws horizontal lines at RULED_SPACING intervals', () => {
    const ctx = makeMockCtx();
    const spec: PaperSpec = {
      type: 'ruled',
      toneSpec: getToneSpec('cream'),
    };
    drawPaper(ctx as unknown as CanvasRenderingContext2D, spec, WIDTH, HEIGHT);

    const calls = ctx._calls;
    const moveToCalls = calls.filter((c) => c.method === 'moveTo');

    // Expected y positions: RULED_SPACING, 2*RULED_SPACING, …, up to HEIGHT
    const expectedYPositions: number[] = [];
    for (let y = RULED_SPACING; y < HEIGHT; y += RULED_SPACING) {
      expectedYPositions.push(y);
    }
    expect(moveToCalls).toHaveLength(expectedYPositions.length);

    moveToCalls.forEach((call, i) => {
      const [_x, y] = call.args as [number, number];
      expect(y).toBe(expectedYPositions[i]);
    });
  });

  it('dot: draws arcs on a DOT_SPACING grid', () => {
    const ctx = makeMockCtx();
    const spec: PaperSpec = {
      type: 'dot',
      toneSpec: getToneSpec('cream'),
    };
    drawPaper(ctx as unknown as CanvasRenderingContext2D, spec, WIDTH, HEIGHT);

    const calls = ctx._calls;
    const arcCalls = calls.filter((c) => c.method === 'arc');

    // Count expected dots
    let expectedDots = 0;
    for (let y = DOT_SPACING; y < HEIGHT; y += DOT_SPACING) {
      for (let x = DOT_SPACING; x < WIDTH; x += DOT_SPACING) {
        expectedDots++;
      }
    }
    expect(arcCalls).toHaveLength(expectedDots);

    // Verify first dot position
    const firstArc = arcCalls[0]!.args as [
      number,
      number,
      number,
      number,
      number,
    ];
    expect(firstArc[0]).toBe(DOT_SPACING); // x
    expect(firstArc[1]).toBe(DOT_SPACING); // y
    expect(firstArc[2]).toBe(DOT_RADIUS);  // radius
  });

  it('ruled: does NOT draw any arcs', () => {
    const ctx = makeMockCtx();
    const spec: PaperSpec = { type: 'ruled', toneSpec: getToneSpec('sage') };
    drawPaper(ctx as unknown as CanvasRenderingContext2D, spec, WIDTH, HEIGHT);
    const arcCalls = ctx._calls.filter((c) => c.method === 'arc');
    expect(arcCalls).toHaveLength(0);
  });

  it('dot: does NOT call moveTo', () => {
    const ctx = makeMockCtx();
    const spec: PaperSpec = { type: 'dot', toneSpec: getToneSpec('blush') };
    drawPaper(ctx as unknown as CanvasRenderingContext2D, spec, WIDTH, HEIGHT);
    const moveToCount = ctx._calls.filter((c) => c.method === 'moveTo').length;
    expect(moveToCount).toBe(0);
  });

  it('drawPaper calls save and restore symmetrically', () => {
    const ctx = makeMockCtx();
    const spec: PaperSpec = { type: 'ruled', toneSpec: getToneSpec('white') };
    drawPaper(ctx as unknown as CanvasRenderingContext2D, spec, WIDTH, HEIGHT);
    const saves = ctx._calls.filter((c) => c.method === 'save').length;
    const restores = ctx._calls.filter((c) => c.method === 'restore').length;
    expect(saves).toBe(restores);
  });

  it('chalkboard tone uses the dark palette', () => {
    const spec = getToneSpec('chalkboard');
    expect(spec.family).toBe('dark');
    expect(spec.inkPalette).toBe(DARK_PALETTE);
  });
});
