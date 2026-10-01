/**
 * fontsReady.ts — Font readiness helper.
 *
 * Requirements: FR-18.
 *
 * The answer layer uses Caveat for handwritten-style numbers.
 * This helper lets the answer renderer await font load before drawing text.
 * No new dependencies; uses the standard FontFace API.
 */

/**
 * Resolves when Caveat 600 (the answer font) is ready.
 *
 * - In a non-browser environment (SSR, test) resolves immediately.
 * - Calls `document.fonts.load()` which deduplicates concurrent calls
 *   and uses the browser cache on subsequent calls.
 */
export async function ensureFontsReady(): Promise<void> {
  if (typeof document === 'undefined') return;
  try {
    await document.fonts.load('600 1em Caveat');
  } catch {
    // Font load failures must never crash the app — draw with fallback.
  }
}
