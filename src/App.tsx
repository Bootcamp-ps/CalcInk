// ─── CalcInk App ───────────────────────────────────────────────────
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { StrokeStore } from './canvas/strokeStore';
import { Point } from './canvas/strokeModel';
import {
  setupCanvas,
  renderStrokes,
  drawLiveStroke,
  eventToCanvasCoords,
} from './canvas/renderer';
import { RecognitionPipeline, RowResult } from './recognition/pipeline';
import { calculateResultPosition, renderResult, renderConfidenceIndicators, clearOverlay } from './render';
// import { evaluateTokens } from './parser'; // parser is now called inside pipeline
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';

type Tool = 'pen' | 'strokeEraser' | 'pixelEraser';

export const App: React.FC = () => {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // State
  const [tool, setTool] = useState<Tool>('pen');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [recognizedTokens, setRecognizedTokens] = useState<string[]>([]);
  const [result, setResult] = useState<string>('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [, forceUpdate] = useState(0);

  // Singletons
  const store = useMemo(() => new StrokeStore(), []);
  const pipeline = useMemo(() => new RecognitionPipeline(600), []);

  // Drawing state (refs to avoid re-renders during drawing)
  const isDrawing = useRef(false);
  const currentPoints = useRef<Point[]>([]);
  const dprRef = useRef(1);

  // Canvas setup
  const setupCanvases = useCallback(() => {
    const container = containerRef.current;
    const strokeCanvas = strokeCanvasRef.current;
    const liveCanvas = liveCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!container || !strokeCanvas || !liveCanvas || !overlayCanvas) return;

    const { dpr } = setupCanvas(strokeCanvas, container);
    setupCanvas(liveCanvas, container);
    setupCanvas(overlayCanvas, container);
    dprRef.current = dpr;

    // Re-render all strokes
    const ctx = strokeCanvas.getContext('2d')!;
    renderStrokes(ctx, strokeCanvas, store.strokes);
  }, [store]);

  useEffect(() => {
    setupCanvases();
    const handleResize = () => setupCanvases();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvases]);

  // Subscribe to store changes
  useEffect(() => {
    const unsub = store.subscribe(() => {
      forceUpdate(n => n + 1);

      // Re-render strokes
      const strokeCanvas = strokeCanvasRef.current;
      if (strokeCanvas) {
        const ctx = strokeCanvas.getContext('2d')!;
        renderStrokes(ctx, strokeCanvas, store.strokes);
      }

      // Trigger recognition
      triggerRecognition();
    });
    return unsub;
  }, [store]);

  // Recognition callback
  const triggerRecognition = useCallback(() => {
    setIsRecognizing(true);
    pipeline.recognize(store.strokes, (rowsRes: RowResult[] | null, error?: string) => {
      setIsRecognizing(false);

      if (error || !rowsRes) {
        console.error('Recognition error:', error);
        return;
      }

      // Aggregate state for StatusBar (use the last row with tokens)
      const lastRow = rowsRes.filter(r => r.tokens.length > 0).pop();
      setRecognizedTokens(lastRow ? lastRow.tokens : []);
      setResult(lastRow && lastRow.result ? lastRow.result : '');

      // Calculate average confidence across all rows
      let totalConf = 0, countConf = 0;
      for (const r of rowsRes) {
        for (const c of r.confidences) {
           totalConf += c; countConf++;
        }
      }
      setConfidence(countConf > 0 ? totalConf / countConf : null);

      // Render results for ALL rows
      const overlayCanvas = overlayCanvasRef.current;
      if (overlayCanvas) {
        const octx = overlayCanvas.getContext('2d')!;
        clearOverlay(octx, overlayCanvas);

        for (const row of rowsRes) {
          if (row.groups.length > 0 && row.confidences.length > 0) {
            renderConfidenceIndicators(octx, row.groups, row.confidences);
          }

          if (row.result) {
            const pos = calculateResultPosition(row.groups, row.tokens);
            if (pos) {
              // Option 3: Calculate dynamic font size based on average symbol height
              let totalHeight = 0;
              for (const group of row.groups) {
                totalHeight += group.bounds.height;
              }
              const averageHeight = row.groups.length > 0 ? totalHeight / row.groups.length : 30;
              
              // Scale it slightly (1.2x) and clamp it between 20px and 80px for safety
              const rawFontSize = averageHeight * 1.2;
              const dynamicFontSize = Math.min(Math.max(rawFontSize, 20), 80);

              const isError = row.result === '?' || row.result.includes('error');
              renderResult(octx, overlayCanvas, row.result, pos, isError ? Math.max(20, dynamicFontSize * 0.8) : dynamicFontSize);
            }
          }
        }
      }
    });
  }, [store, pipeline]);

  // Pointer event handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = liveCanvasRef.current;
    if (!canvas) return;

    // Capture pointer for reliable tracking
    canvas.setPointerCapture(e.pointerId);

    isDrawing.current = true;
    const { x, y } = eventToCanvasCoords(e.nativeEvent, canvas);

    if (tool === 'pen') {
      currentPoints.current = [{
        x, y,
        pressure: e.pressure || 0.5,
        timestamp: Date.now(),
      }];
    } else if (tool === 'strokeEraser') {
      const hit = store.getStrokeAt(x, y, 15);
      if (hit) {
        store.removeStrokes([hit.id]);
      }
    } else if (tool === 'pixelEraser') {
      store.eraseAt(x, y, 15);
    }
  }, [tool, store]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = liveCanvasRef.current;
    if (!canvas) return;

    const { x, y } = eventToCanvasCoords(e.nativeEvent, canvas);

    if (tool === 'pen') {
      currentPoints.current.push({
        x, y,
        pressure: e.pressure || 0.5,
        timestamp: Date.now(),
      });

      // Draw live stroke
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawLiveStroke(ctx, currentPoints.current, strokeWidth, '#1a1a2e');
    } else if (tool === 'strokeEraser') {
      const hit = store.getStrokeAt(x, y, 15);
      if (hit) {
        store.removeStrokes([hit.id]);
      }
    } else if (tool === 'pixelEraser') {
      store.eraseAt(x, y, 15);
    }
  }, [tool, strokeWidth, store]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    isDrawing.current = false;

    const canvas = liveCanvasRef.current;
    if (!canvas) return;

    // Release pointer capture
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ok */ }

    if (tool === 'pen' && currentPoints.current.length > 0) {
      // Clear live canvas
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Commit stroke to store
      store.addStroke(currentPoints.current, strokeWidth, '#1a1a2e');
      currentPoints.current = [];
    }
  }, [tool, strokeWidth, store]);

  // Toolbar actions
  const handleUndo = useCallback(() => store.undo(), [store]);
  const handleRedo = useCallback(() => store.redo(), [store]);
  const handleClear = useCallback(() => {
    store.clear();
    // Clear overlay
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext('2d')!;
      clearOverlay(ctx, overlayCanvas);
    }
    setRecognizedTokens([]);
    setResult('');
    setConfidence(null);
    pipeline.cancel();
  }, [store, pipeline]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
        if (e.key === 'z' && e.shiftKey) { e.preventDefault(); handleRedo(); }
        if (e.key === 'y') { e.preventDefault(); handleRedo(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Cleanup
  useEffect(() => {
    return () => pipeline.destroy();
  }, [pipeline]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          <span className="app-title-calc">Calc</span>
          <span className="app-title-ink">Ink</span>
        </h1>
        <p className="app-subtitle">Handwritten Math Calculator</p>
      </header>

      <Toolbar
        tool={tool}
        setTool={setTool}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        canUndo={store.canUndo}
        canRedo={store.canRedo}
      />

      <div className="canvas-container" ref={containerRef}>
        {/* Paper-like grid lines */}
        <div className="canvas-paper-bg" />

        {/* Stroke canvas (committed strokes) */}
        <canvas
          id="stroke-canvas"
          ref={strokeCanvasRef}
          className="canvas-layer"
          style={{ zIndex: 1 }}
        />

        {/* Live drawing canvas */}
        <canvas
          id="live-canvas"
          ref={liveCanvasRef}
          className="canvas-layer canvas-interactive"
          style={{ zIndex: 2, cursor: tool === 'pen' ? 'crosshair' : 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        {/* Result overlay canvas */}
        <canvas
          id="overlay-canvas"
          ref={overlayCanvasRef}
          className="canvas-layer"
          style={{ zIndex: 3, pointerEvents: 'none' }}
        />

        {/* Watermark hint */}
        {store.strokes.length === 0 && (
          <div className="canvas-hint">
            Write a math expression ending with <span className="hint-eq">=</span>
          </div>
        )}
      </div>

      <StatusBar
        tokens={recognizedTokens}
        result={result}
        isRecognizing={isRecognizing}
        confidence={confidence}
      />
    </div>
  );
};
