/**
 * paperTexture.ts — Grain tile generation and CSS paper application.
 *
 * Requirements: FR-16.
 *
 * The grain tile (≤ 128×128) is generated ONCE at module load into a data URL.
 * The `applyPaperCSS` function writes CSS custom properties and background
 * shorthand onto the paper element — called only when the paper spec changes,
 * never per-frame.
 *
 * No image files, no network requests, no React imports.
 */

import {
  type PaperSpec,
  RULED_SPACING,
  DOT_SPACING,
  DOT_RADIUS,
} from './paperSpec';

// ---------------------------------------------------------------------------
// Grain tile — generated once, reused forever
// ---------------------------------------------------------------------------

const GRAIN_SIZE = 96; // px — well under the 128 px limit

/**
 * Generates a small tileable noise texture and returns it as a `data:` URL.
 * Uses a seeded PRNG so the tile is deterministic and consistent across renders.
 */
function generateGrainTile(): string {
  // Tiny offline canvas — never attached to the document
  const offscreen = document.createElement('canvas');
  offscreen.width = GRAIN_SIZE;
  offscreen.height = GRAIN_SIZE;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return '';

  // Simple xorshift32 PRNG — deterministic, seed = 0xdeadbeef
  let state = 0xdeadbeef;
  function rand(): number {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    // Normalise to [0, 1)
    return (state >>> 0) / 4294967296;
  }

  const imageData = ctx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    // Low alpha so the grain is extremely subtle
    data[i + 3] = Math.floor(rand() * 18);
  }
  ctx.putImageData(imageData, 0, 0);
  return offscreen.toDataURL('image/png');
}

/**
 * The grain data URL, generated exactly once when the module is first imported.
 * `null` in SSR / non-browser environments.
 */
export const GRAIN_TILE: string | null =
  typeof document !== 'undefined' ? generateGrainTile() : null;

// ---------------------------------------------------------------------------
// CSS background builder
// ---------------------------------------------------------------------------

/**
 * Builds the `background` shorthand value for the paper `<div>`.
 *
 * Layers (CSS paints last-to-first):
 *   1. Grain noise tile (top, very low opacity)
 *   2. Radial-gradient vignette
 *   3. Ruled lines  OR  dot grid  (type-specific)
 *   4. Solid base colour (bottom)
 */
function buildBackground(spec: PaperSpec): string {
  const { toneSpec, type } = spec;
  const layers: string[] = [];

  // Layer 1 — grain (topmost)
  if (GRAIN_TILE) {
    layers.push(`url("${GRAIN_TILE}") repeat`);
  }

  // Layer 2 — vignette
  const vignetteAlpha =
    toneSpec.family === 'dark' ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.05)';
  layers.push(
    `radial-gradient(ellipse at center, transparent 40%, ${vignetteAlpha} 100%)`
  );

  // Layer 3 — type-specific pattern
  if (type === 'ruled') {
    // One horizontal line per RULED_SPACING px using a gradient
    layers.push(
      `repeating-linear-gradient(` +
        `to bottom,` +
        `transparent 0px,` +
        `transparent ${RULED_SPACING - 1}px,` +
        `${toneSpec.lineColor}99 ${RULED_SPACING - 1}px,` +
        `${toneSpec.lineColor}99 ${RULED_SPACING}px` +
        `)`
    );
  } else if (type === 'dot') {
    // Dot grid via radial-gradient tiling
    const d = DOT_SPACING;
    const r = DOT_RADIUS;
    layers.push(
      `radial-gradient(circle, ${toneSpec.lineColor}bb ${r}px, transparent ${r + 0.5}px)` +
        ` ${d}px ${d}px / ${d}px ${d}px`
    );
  }
  // 'plain' — no pattern layer

  // Layer 4 — base colour (bottommost)
  layers.push(toneSpec.bg);

  return layers.join(', ');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Applies the paper spec to the given paper element by writing inline CSS
 * custom properties and the background shorthand.
 *
 * Must be called only when the spec changes — never per frame.
 *
 * @param el   - The paper `<div>` element.
 * @param spec - The current paper specification.
 */
export function applyPaperCSS(el: HTMLElement, spec: PaperSpec): void {
  const { toneSpec } = spec;

  // CSS custom properties so child elements (toolbar, etc.) can read the tone
  el.style.setProperty('--paper-bg', toneSpec.bg);
  el.style.setProperty('--paper-chrome', toneSpec.chrome);
  el.style.setProperty('--paper-line', toneSpec.lineColor);
  el.style.setProperty('--paper-border', toneSpec.borderColor);
  el.style.setProperty('--paper-text', toneSpec.textColor);
  el.style.background = buildBackground(spec);
}
