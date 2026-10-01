/**
 * paperSpec.ts — Single source of truth for all paper data.
 *
 * Requirements: FR-16, FR-17, FR-20.
 *
 * This module is intentionally framework-agnostic and has zero side-effects.
 * Both the CSS layer (via CSS variables) and the future PNG/SVG export (FR-39)
 * read from the same constants so on-screen and exported paper always match.
 *
 * Nothing in this file touches the DOM, React, or StrokeStore.
 */

// ---------------------------------------------------------------------------
// Spacing constants
// ---------------------------------------------------------------------------

/** Ruled-line vertical spacing in CSS pixels. Also serves as the row-height guide. */
export const RULED_SPACING = 48;

/** Dot-grid horizontal and vertical spacing in CSS pixels. */
export const DOT_SPACING = 32;

/** Dot radius in CSS pixels for dot-grid paper. */
export const DOT_RADIUS = 1.5;

// ---------------------------------------------------------------------------
// Paper types
// ---------------------------------------------------------------------------

export type PaperType = 'plain' | 'ruled' | 'dot';

// ---------------------------------------------------------------------------
// Paper tones
// ---------------------------------------------------------------------------

/**
 * 5 light tones + 1 dark tone.
 * Tone IDs are stable identifiers; don't rename them (used as CSS data-attrs).
 */
export type PaperTone =
  | 'cream'
  | 'white'
  | 'blue-grey'
  | 'sage'
  | 'blush'
  | 'chalkboard';

export type PaperFamily = 'light' | 'dark';

export interface InkPalette {
  /** Five ink colours, ordered by palette index 0–4. */
  readonly colors: readonly [string, string, string, string, string];
}

export interface ToneSpec {
  readonly tone: PaperTone;
  readonly family: PaperFamily;
  /** Base paper background colour. */
  readonly bg: string;
  /** Saturated preview colour for UI swatches (more vivid than bg). */
  readonly preview: string;
  /** Ambient wrap / app chrome colour (slightly darker / lighter than bg). */
  readonly chrome: string;
  /** Ruled-line / dot colour. */
  readonly lineColor: string;
  /** Thin separator / border colour in UI elements. */
  readonly borderColor: string;
  /** Primary UI text colour (used by toolbar labels). */
  readonly textColor: string;
  /** Ink palette for new strokes drawn on this tone. */
  readonly inkPalette: InkPalette;
}

// ---------------------------------------------------------------------------
// Ink palettes
// ---------------------------------------------------------------------------

/** Palette for light-family paper tones — all colours readable on pale backgrounds. */
export const LIGHT_PALETTE: InkPalette = {
  colors: [
    '#1a1a2e', // near-black navy
    '#1d4ed8', // blue
    '#15803d', // green
    '#b91c1c', // red
    '#7c3aed', // purple
  ],
};

/** Palette for dark-family (chalkboard) paper tone — all colours readable on dark. */
export const DARK_PALETTE: InkPalette = {
  colors: [
    '#f1f5f9', // chalk white
    '#7dd3fc', // sky blue
    '#86efac', // mint green
    '#fca5a5', // soft red
    '#c4b5fd', // lavender
  ],
};

/** Returns the ink palette for a given paper family. */
export function getPaletteForFamily(family: PaperFamily): InkPalette {
  return family === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}

// ---------------------------------------------------------------------------
// Tone specifications
// ---------------------------------------------------------------------------

export const TONE_SPECS: readonly ToneSpec[] = [
  {
    tone: 'cream',
    family: 'light',
    bg: '#faf8f5',
    preview: '#e8d5b0',
    chrome: '#f0ede8',
    lineColor: '#d9c8a8',
    borderColor: '#d9d5cf',
    textColor: '#1a1a2e',
    inkPalette: LIGHT_PALETTE,
  },
  {
    tone: 'white',
    family: 'light',
    bg: '#ffffff',
    preview: '#e8eaed',
    chrome: '#f3f4f6',
    lineColor: '#d1d5db',
    borderColor: '#e5e7eb',
    textColor: '#111827',
    inkPalette: LIGHT_PALETTE,
  },
  {
    tone: 'blue-grey',
    family: 'light',
    bg: '#f0f4f8',
    preview: '#a8c4e0',
    chrome: '#e2e8f0',
    lineColor: '#b0c4d8',
    borderColor: '#cbd5e1',
    textColor: '#1e293b',
    inkPalette: LIGHT_PALETTE,
  },
  {
    tone: 'sage',
    family: 'light',
    bg: '#f2f5f0',
    preview: '#a0c8a0',
    chrome: '#e8ede5',
    lineColor: '#a8c4a0',
    borderColor: '#c8d5c4',
    textColor: '#1a2e1a',
    inkPalette: LIGHT_PALETTE,
  },
  {
    tone: 'blush',
    family: 'light',
    bg: '#fdf2f2',
    preview: '#f0a0a8',
    chrome: '#fbe8e8',
    lineColor: '#f4b8b8',
    borderColor: '#f0c8c8',
    textColor: '#2e1a1a',
    inkPalette: LIGHT_PALETTE,
  },
  {
    tone: 'chalkboard',
    family: 'dark',
    bg: '#1e2d25',
    preview: '#2a4030',
    chrome: '#162019',
    lineColor: '#2e4a38',
    borderColor: '#334d3d',
    textColor: '#e8f5eb',
    inkPalette: DARK_PALETTE,
  },
] as const;

/** Lookup a tone spec by tone id. Throws if tone is invalid (programmer error). */
export function getToneSpec(tone: PaperTone): ToneSpec {
  const spec = TONE_SPECS.find((s) => s.tone === tone);
  if (!spec) throw new Error(`Unknown paper tone: ${tone}`);
  return spec;
}

// ---------------------------------------------------------------------------
// Full paper specification (type + tone together)
// ---------------------------------------------------------------------------

export interface PaperSpec {
  readonly type: PaperType;
  readonly toneSpec: ToneSpec;
}

// ---------------------------------------------------------------------------
// Default paper (respects prefers-color-scheme at call time)
// ---------------------------------------------------------------------------

/**
 * Returns the default PaperSpec for the current environment.
 * Called once at app init; not reactive.
 */
export function getDefaultPaperSpec(): PaperSpec {
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  const tone: PaperTone = prefersDark ? 'chalkboard' : 'cream';
  return { type: 'ruled', toneSpec: getToneSpec(tone) };
}

// ---------------------------------------------------------------------------
// Pure drawPaper() — used by export (FR-39) and tested with a mock context
// ---------------------------------------------------------------------------

/**
 * Paints the complete paper surface onto a 2D canvas context.
 *
 * Pure function: no side-effects, no DOM access, no React.
 * The CSS layer renders the same design via gradients; this function reproduces
 * it pixel-accurately for PNG/SVG export.
 *
 * @param ctx   - Canvas 2D rendering context (real or mock).
 * @param spec  - Paper specification (type + tone).
 * @param width - Canvas logical width in pixels.
 * @param height - Canvas logical height in pixels.
 */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  spec: PaperSpec,
  width: number,
  height: number
): void {
  const { toneSpec, type } = spec;

  // 1. Base fill
  ctx.fillStyle = toneSpec.bg;
  ctx.fillRect(0, 0, width, height);

  // 2. Type-specific lines / dots
  ctx.save();
  ctx.globalAlpha = 0.6;

  if (type === 'ruled') {
    ctx.strokeStyle = toneSpec.lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = RULED_SPACING; y < height; y += RULED_SPACING) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  } else if (type === 'dot') {
    ctx.fillStyle = toneSpec.lineColor;
    for (let y = DOT_SPACING; y < height; y += DOT_SPACING) {
      for (let x = DOT_SPACING; x < width; x += DOT_SPACING) {
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // 'plain' draws only the base fill — no lines or dots

  ctx.restore();

  // 3. Soft vignette (radial gradient darkening the edges slightly)
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(
    1,
    toneSpec.family === 'dark' ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.06)'
  );
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
