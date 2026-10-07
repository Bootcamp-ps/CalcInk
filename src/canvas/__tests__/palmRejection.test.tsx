/**
 * palmRejection.test.tsx — Unit tests for FR-5 Palm rejection and multi-touch guards.
 */

import React, { useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCanvasInput } from '../useCanvasInput';
import { StrokeStore } from '../strokeStore';
import { ToolStore } from '../toolState';

let container: HTMLDivElement;
let root: ReturnType<typeof ReactDOM.createRoot>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = ReactDOM.createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

function setupTestCanvas() {
  const store = new StrokeStore();
  const toolStore = new ToolStore();
  let hookReturn: ReturnType<typeof useCanvasInput> | null = null;

  function TestComponent() {
    const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const strokeCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const dimensionsRef = { current: { width: 800, height: 600, dpr: 1 } };
    const redrawCommittedCanvas = vi.fn();

    const input = useCanvasInput({
      store,
      toolStore,
      liveCanvasRef,
      strokeCanvasRef,
      dimensionsRef,
      redrawCommittedCanvas,
    });
    hookReturn = input;

    return (
      <div>
        <canvas ref={strokeCanvasRef} width={800} height={600} />
        <canvas
          ref={liveCanvasRef}
          width={800}
          height={600}
          onPointerDown={input.handlePointerDown}
          onPointerMove={input.handlePointerMove}
          onPointerUp={input.handlePointerUp}
          onPointerCancel={input.handlePointerCancel}
          onLostPointerCapture={input.handleLostPointerCapture}
        />
      </div>
    );
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return { store, toolStore, getHook: () => hookReturn! };
}

describe('FR-5 Palm rejection & multi-touch handling', () => {
  it('allows touch pointerdown when pen has not been seen', () => {
    const { getHook } = setupTestCanvas();
    const hook = getHook();

    expect(hook.penSeenRef.current).toBe(false);

    act(() => {
      hook.handlePointerDown({
        button: 0,
        pointerId: 1,
        pointerType: 'touch',
        clientX: 100,
        clientY: 100,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    expect(hook.isInteractingRef.current).toBe(true);

    act(() => {
      hook.handlePointerUp({
        pointerId: 1,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    expect(hook.isInteractingRef.current).toBe(false);
  });

  it('sets penSeenRef to true when pen pointerdown is received', () => {
    const { getHook } = setupTestCanvas();
    const hook = getHook();

    expect(hook.penSeenRef.current).toBe(false);

    act(() => {
      hook.handlePointerDown({
        button: 0,
        pointerId: 2,
        pointerType: 'pen',
        clientX: 150,
        clientY: 150,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    expect(hook.penSeenRef.current).toBe(true);
    expect(hook.isInteractingRef.current).toBe(true);

    act(() => {
      hook.handlePointerUp({
        pointerId: 2,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });
  });

  it('sets penSeenRef to true when stylus pen hovers (pointermove)', () => {
    const { getHook } = setupTestCanvas();
    const hook = getHook();

    expect(hook.penSeenRef.current).toBe(false);

    act(() => {
      hook.handlePointerMove({
        pointerId: 3,
        pointerType: 'pen',
        clientX: 200,
        clientY: 200,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    expect(hook.penSeenRef.current).toBe(true);
    expect(hook.isInteractingRef.current).toBe(false);
  });

  it('rejects touch pointerdown once pen has been seen (FR-5)', () => {
    const { getHook } = setupTestCanvas();
    const hook = getHook();

    // Stylus hover
    act(() => {
      hook.handlePointerMove({
        pointerId: 10,
        pointerType: 'pen',
        clientX: 50,
        clientY: 50,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });
    expect(hook.penSeenRef.current).toBe(true);

    // Palm / touch lands on screen
    act(() => {
      hook.handlePointerDown({
        button: 0,
        pointerId: 11,
        pointerType: 'touch',
        clientX: 300,
        clientY: 300,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    // Ignored!
    expect(hook.isInteractingRef.current).toBe(false);
  });

  it('always allows mouse pointerdown even after pen has been seen (FR-5)', () => {
    const { getHook } = setupTestCanvas();
    const hook = getHook();

    // Pen seen
    act(() => {
      hook.handlePointerDown({
        button: 0,
        pointerId: 20,
        pointerType: 'pen',
        clientX: 50,
        clientY: 50,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });
    act(() => {
      hook.handlePointerUp({
        pointerId: 20,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });
    expect(hook.penSeenRef.current).toBe(true);

    // Mouse draws
    act(() => {
      hook.handlePointerDown({
        button: 0,
        pointerId: 21,
        pointerType: 'mouse',
        clientX: 120,
        clientY: 120,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    expect(hook.isInteractingRef.current).toBe(true);

    act(() => {
      hook.handlePointerUp({
        pointerId: 21,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });
    expect(hook.isInteractingRef.current).toBe(false);
  });

  it('guards against secondary pointerdown (multi-touch palm landing while drawing)', () => {
    const { getHook } = setupTestCanvas();
    const hook = getHook();

    // Primary pen starts stroke
    act(() => {
      hook.handlePointerDown({
        button: 0,
        pointerId: 30,
        pointerType: 'pen',
        clientX: 100,
        clientY: 100,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });
    expect(hook.isInteractingRef.current).toBe(true);

    // Secondary touch or palm down
    act(() => {
      hook.handlePointerDown({
        button: 0,
        pointerId: 31,
        pointerType: 'touch',
        clientX: 400,
        clientY: 400,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    // Still interacting with original pointer, not hijacked
    expect(hook.isInteractingRef.current).toBe(true);

    // Releasing the secondary touch does not finish the pen stroke
    act(() => {
      hook.handlePointerUp({
        pointerId: 31,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });
    expect(hook.isInteractingRef.current).toBe(true);

    // Releasing primary pen finishes the stroke
    act(() => {
      hook.handlePointerUp({
        pointerId: 30,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });
    expect(hook.isInteractingRef.current).toBe(false);
  });

  it('auto-recovers and starts new stroke if previous pointerup was dropped by tablet', () => {
    const { store, getHook } = setupTestCanvas();
    const hook = getHook();

    // Pen stroke 1 touches down and moves, but pointerup is NEVER called (dropped by tablet/flick)
    act(() => {
      hook.handlePointerDown({
        pointerId: 40,
        pointerType: 'pen',
        clientX: 100,
        clientY: 100,
        pressure: 0.8,
        preventDefault: () => {},
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });
    expect(hook.isInteractingRef.current).toBe(true);

    // Pen stroke 2 arrives (pointerId 41). Should auto-commit stroke 1 and immediately begin stroke 2
    act(() => {
      hook.handlePointerDown({
        pointerId: 41,
        pointerType: 'pen',
        clientX: 200,
        clientY: 200,
        pressure: 0.9,
        preventDefault: () => {},
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    // Stroke 1 was committed to store
    expect(store.strokes.length).toBe(1);
    expect(store.strokes[0]!.points[0]!.x).toBe(100);

    // Stroke 2 is actively drawing (not dropped!)
    expect(hook.isInteractingRef.current).toBe(true);

    // Finishing stroke 2
    act(() => {
      hook.handlePointerUp({
        pointerId: 41,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });
    expect(hook.isInteractingRef.current).toBe(false);
    expect(store.strokes.length).toBe(2);
  });

  it('handles lost pointer capture by committing active stroke', () => {
    const { store, getHook } = setupTestCanvas();
    const hook = getHook();

    act(() => {
      hook.handlePointerDown({
        pointerId: 50,
        pointerType: 'pen',
        clientX: 150,
        clientY: 150,
        pressure: 0.7,
        preventDefault: () => {},
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });
    expect(hook.isInteractingRef.current).toBe(true);

    // Browser fires lostpointercapture
    act(() => {
      hook.handleLostPointerCapture({
        pointerId: 50,
      } as unknown as React.PointerEvent<HTMLCanvasElement>);
    });

    expect(hook.isInteractingRef.current).toBe(false);
    expect(store.strokes.length).toBe(1);
  });
});
