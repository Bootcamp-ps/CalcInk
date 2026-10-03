/**
 * useCanvasInput.ts — Pointer event and rAF-batched drawing/erasing handlers.
 *
 * Requirements: FR-1, FR-3, FR-10, FR-14.
 * - rAF-batched pointermove samples (no per-point React state).
 * - Eraser drag session commits exactly ONE action on pointerup.
 * - Guards rapid tool switching, multi-touch, and pointercancel without throwing.
 */

import { useRef, useEffect, type RefObject } from 'react';
import type { StrokeStore } from './strokeStore';
import type { ToolStore } from './toolState';
import type { Point, Stroke } from '../contract';
import type { CanvasDimensions } from './useCanvasDpr';
import { eventToPageCoords } from './coords';
import { renderLiveStroke, renderCommittedStroke } from './inkRenderer';
import { EraserSession } from './eraserSession';

export interface UseCanvasInputProps {
  store: StrokeStore;
  toolStore: ToolStore;
  liveCanvasRef: RefObject<HTMLCanvasElement | null>;
  strokeCanvasRef: RefObject<HTMLCanvasElement | null>;
  dimensionsRef: { readonly current: CanvasDimensions };
  redrawCommittedCanvas: (strokesToRender?: readonly Stroke[]) => void;
}

export function useCanvasInput({
  store,
  toolStore,
  liveCanvasRef,
  strokeCanvasRef,
  dimensionsRef,
  redrawCommittedCanvas,
}: UseCanvasInputProps) {
  const isInteractingRef = useRef<boolean>(false);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerTypeRef = useRef<'pen' | 'mouse' | 'touch'>('mouse');

  // Pen live stroke points
  const livePointsRef = useRef<Point[]>([]);

  // Eraser drag session and queued sample points
  const eraserSessionRef = useRef<EraserSession | null>(null);
  const pendingEraserPointsRef = useRef<{ x: number; y: number }[]>([]);

  const rAFIdRef = useRef<number | null>(null);

  // Guard rapid tool switching: cancel active gesture cleanly
  useEffect(() => {
    const unsubscribe = toolStore.subscribe(() => {
      if (isInteractingRef.current) {
        if (rAFIdRef.current !== null) {
          cancelAnimationFrame(rAFIdRef.current);
          rAFIdRef.current = null;
        }
        livePointsRef.current = [];
        eraserSessionRef.current = null;
        pendingEraserPointsRef.current = [];
        isInteractingRef.current = false;
        activePointerIdRef.current = null;

        const liveCanvas = liveCanvasRef.current;
        if (liveCanvas) {
          const ctx = liveCanvas.getContext('2d');
          if (ctx) {
            const dims = dimensionsRef.current;
            ctx.clearRect(0, 0, dims.width, dims.height);
          }
        }
        redrawCommittedCanvas();
      }
    });
    return unsubscribe;
  }, [toolStore, liveCanvasRef, dimensionsRef, redrawCommittedCanvas]);

  // Clean up pending animation frame on unmount
  useEffect(() => {
    return () => {
      if (rAFIdRef.current !== null) {
        cancelAnimationFrame(rAFIdRef.current);
        rAFIdRef.current = null;
      }
    };
  }, []);

  const scheduleRaf = () => {
    if (rAFIdRef.current !== null) return;

    rAFIdRef.current = requestAnimationFrame(() => {
      rAFIdRef.current = null;
      const currentTool = toolStore.tool;

      if (currentTool === 'pen') {
        const liveCanvas = liveCanvasRef.current;
        if (!liveCanvas) return;
        const ctx = liveCanvas.getContext('2d');
        if (!ctx) return;

        const dims = dimensionsRef.current;
        if (dims) {
          ctx.clearRect(0, 0, dims.width, dims.height);
        }

        renderLiveStroke(
          ctx,
          livePointsRef.current,
          toolStore.penWidth,
          toolStore.penColor,
          pointerTypeRef.current
        );
      } else {
        const session = eraserSessionRef.current;
        const points = pendingEraserPointsRef.current;
        pendingEraserPointsRef.current = [];

        if (session && points.length > 0) {
          const modified = session.processPoints(points);
          if (modified) {
            redrawCommittedCanvas(session.currentStrokes);
          }
        }
      }
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;

    const liveCanvas = liveCanvasRef.current;
    if (!liveCanvas) return;

    try {
      liveCanvas.setPointerCapture(e.pointerId);
    } catch {
      // Safe fallback
    }

    isInteractingRef.current = true;
    activePointerIdRef.current = e.pointerId;
    pointerTypeRef.current = (e.pointerType as 'pen' | 'mouse' | 'touch') || 'mouse';

    const rect = liveCanvas.getBoundingClientRect();
    const coords = eventToPageCoords(e.clientX, e.clientY, rect);
    const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;

    const currentTool = toolStore.tool;

    if (currentTool === 'pen') {
      livePointsRef.current = [
        {
          x: coords.x,
          y: coords.y,
          pressure,
          t: performance.now(),
        },
      ];
      scheduleRaf();
    } else {
      eraserSessionRef.current = new EraserSession(
        store,
        currentTool,
        toolStore.eraserRadius
      );
      pendingEraserPointsRef.current = [{ x: coords.x, y: coords.y }];
      scheduleRaf();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isInteractingRef.current || activePointerIdRef.current !== e.pointerId) return;

    const liveCanvas = liveCanvasRef.current;
    if (!liveCanvas) return;

    const rect = liveCanvas.getBoundingClientRect();
    const nativeEvt = e.nativeEvent;
    const rawEvents: Array<{ clientX: number; clientY: number; pressure?: number }> =
      typeof (nativeEvt as PointerEvent).getCoalescedEvents === 'function' &&
      (nativeEvt as PointerEvent).getCoalescedEvents().length > 0
        ? (nativeEvt as PointerEvent).getCoalescedEvents()
        : [e];

    const currentTool = toolStore.tool;

    if (currentTool === 'pen') {
      for (const evt of rawEvents) {
        const coords = eventToPageCoords(evt.clientX, evt.clientY, rect);
        const pressure = evt.pressure !== undefined && evt.pressure > 0 ? evt.pressure : 0.5;
        livePointsRef.current.push({
          x: coords.x,
          y: coords.y,
          pressure,
          t: performance.now(),
        });
      }
    } else {
      for (const evt of rawEvents) {
        const coords = eventToPageCoords(evt.clientX, evt.clientY, rect);
        pendingEraserPointsRef.current.push({ x: coords.x, y: coords.y });
      }
    }

    scheduleRaf();
  };

  const finishInteraction = (commit: boolean, pointerId: number) => {
    if (!isInteractingRef.current || activePointerIdRef.current !== pointerId) return;

    const liveCanvas = liveCanvasRef.current;
    if (liveCanvas) {
      try {
        if (liveCanvas.hasPointerCapture(pointerId)) {
          liveCanvas.releasePointerCapture(pointerId);
        }
      } catch {
        // Safe fallback
      }
    }

    if (rAFIdRef.current !== null) {
      cancelAnimationFrame(rAFIdRef.current);
      rAFIdRef.current = null;
    }

    const currentTool = toolStore.tool;

    if (currentTool === 'pen') {
      if (liveCanvas) {
        const ctx = liveCanvas.getContext('2d');
        if (ctx) {
          const dims = dimensionsRef.current;
          if (dims) {
            ctx.clearRect(0, 0, dims.width, dims.height);
          }
        }
      }

      const points = livePointsRef.current;
      livePointsRef.current = [];
      isInteractingRef.current = false;
      activePointerIdRef.current = null;

      if (commit && points.length > 0) {
        const newStroke: Stroke = {
          id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          points,
          width: toolStore.penWidth,
          color: toolStore.penColor,
          pointerType: pointerTypeRef.current,
        };

        const strokeCanvas = strokeCanvasRef.current;
        if (strokeCanvas) {
          const ctx = strokeCanvas.getContext('2d');
          if (ctx) {
            renderCommittedStroke(ctx, newStroke);
          }
        }

        store.add(newStroke);
      }
    } else {
      const session = eraserSessionRef.current;
      const leftoverPoints = pendingEraserPointsRef.current;
      pendingEraserPointsRef.current = [];
      eraserSessionRef.current = null;
      isInteractingRef.current = false;
      activePointerIdRef.current = null;

      if (session) {
        if (commit) {
          if (leftoverPoints.length > 0) {
            session.processPoints(leftoverPoints);
          }
          session.commit();
        } else {
          redrawCommittedCanvas();
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    finishInteraction(true, e.pointerId);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    finishInteraction(false, e.pointerId);
  };

  return {
    isInteractingRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  };
}
