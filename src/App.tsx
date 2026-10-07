/**
 * App.tsx — Application root.
 *
 * Minimal wiring changes for slice 3:
 * - Creates PaperStore alongside StrokeStore and ToolStore.
 * - Passes paperStore to Toolbar.
 * - Applies paper CSS to the .paper element via applyPaperCSS() on spec change.
 * - Sets data-paper-family on the root so the toolbar CSS can adapt its surface.
 *
 * The StrokeStore and contract.ts are NOT touched.
 */

import { useMemo, useEffect, useRef } from 'react';
import { StrokeStore } from './canvas/strokeStore';
import { ToolStore } from './canvas/toolState';
import { PaperStore } from './canvas/paperStore';
import { CanvasPage } from './canvas/CanvasPage';
import { Toolbar } from './components/Toolbar';
import { applyPaperCSS } from './canvas/paperTexture';
import './styles/paper.css';
import './App.css';

/** Root application shell. */
function App() {
  const store = useMemo(() => new StrokeStore(), []);
  const toolStore = useMemo(() => new ToolStore(), []);
  const paperStore = useMemo(() => new PaperStore(), []);

  const paperRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);

  // Apply paper CSS when the spec changes (never per frame)
  useEffect(() => {
    const apply = () => {
      if (paperRef.current) {
        applyPaperCSS(paperRef.current, paperStore.spec);
      }
      // Set data-paper-family on the root so the toolbar knows the surface colour
      if (appRef.current) {
        appRef.current.dataset['paperFamily'] = paperStore.family;
      }
    };
    // Apply immediately on mount
    apply();
    // Subscribe to future changes
    return paperStore.subscribe(apply);
  }, [paperStore]);

  // Sync ink palette colour: when the paper family changes, update penColor
  // to the same palette index in the new palette (existing strokes untouched)
  useEffect(() => {
    let prevFamily = paperStore.family;
    let paletteIndex = 0;

    // Track current palette index by comparing stored colour to palette
    const syncPaletteIndex = () => {
      const palette = paperStore.inkPalette.colors;
      const idx = palette.indexOf(toolStore.penColor as typeof palette[number]);
      if (idx !== -1) paletteIndex = idx;
    };
    syncPaletteIndex();

    return paperStore.subscribe((state) => {
      syncPaletteIndex();
      const newFamily = state.spec.toneSpec.family;
      if (newFamily !== prevFamily) {
        prevFamily = newFamily;
        // Switch to same index in the new palette
        const newPalette = state.spec.toneSpec.inkPalette.colors;
        const newColor = newPalette[paletteIndex] ?? newPalette[0];
        if (newColor) toolStore.setPenColor(newColor);
      }
    });
  }, [paperStore, toolStore]);

  return (
    <div className="app" ref={appRef}>
      <Toolbar store={store} toolStore={toolStore} paperStore={paperStore} />
      <main className="page">
        {/* Paper surface — CSS background set by applyPaperCSS */}
        <div className="paper" ref={paperRef} aria-hidden="true" />
        {/* Stacked canvas layers */}
        <CanvasPage store={store} toolStore={toolStore} />
      </main>
    </div>
  );
}

export default App;
