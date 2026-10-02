# CalcInk: Canvas Implementation Details

This document details the exact flow, data structures, and functions used to render high-performance, 60-FPS ink in CalcInk.

## 1. Core Data Structures

### A. The Data Models (TypeScript Interfaces)
* **`Point`**: The atomic unit of input. Stores `{ x, y, pressure, t }`.
* **`Stroke`**: An immutable object representing a finished line. Contains an ID, color, width, and an array of `Point`s.
* **`StrokeAction`**: Used for the Undo/Redo stack. Records atomic changes like `{ type: 'add', stroke }` or `{ type: 'replace', before, after }`.

### B. The Memory Storage
* **`livePointsRef`**: A React `useRef<Point[]>` holding the dots of the line currently being drawn. It is used to mutate data without triggering React re-renders.
* **`StrokeStore._strokes`**: A framework-agnostic array holding all finalized `Stroke` objects.
* **`pathCache`**: A `WeakMap<Stroke, Path2D>`. It links a mathematical `Stroke` object to its calculated `Path2D` geometry. If a stroke is deleted (erased or undone), the `WeakMap` automatically garbage-collects the heavy `Path2D` memory.

---

## 2. The Two-Canvas System (Bypassing React)

To prevent React from re-rendering the Virtual DOM 60+ times a second (which causes severe pen lag), we use `useRef` to store our drawing data and manipulate the DOM directly.

We stack two transparent canvases using CSS:
1. **`live-canvas` (Top)**: Temporary whiteboard. Constantly wiped and redrawn while dragging. Holds exactly ONE stroke.
2. **`stroke-canvas` (Bottom)**: Permanent ink. Holds hundreds of strokes but is never touched while actively drawing. Only redrawn on Undo, Eraser, or Pen Up.

---

## 3. Default Browser APIs Used (Native Functions)

We rely on native HTML5 and DOM APIs to achieve hardware-accelerated drawing:

* **`canvas.setPointerCapture(id)`**: Forces the browser to keep tracking the pen even if the user drags off the edge of the canvas.
* **`PointerEvent.getCoalescedEvents()`**: Retrieves micro-movements of a high-end stylus that occurred faster than the browser's Javascript event loop.
* **`requestAnimationFrame(callback)`**: Syncs our drawing code to the physical refresh rate of the monitor (e.g., 60Hz), preventing wasted CPU cycles.
* **`CanvasRenderingContext2D`**: The native drawing toolkit (`canvas.getContext('2d')`).
  * **`ctx.clearRect(x, y, w, h)`**: Instantly wipes the pixels clean.
  * **`ctx.fill(path)`**: Hardware-accelerated paint dump into a shape.
* **`Path2D`**: A native browser object that reads a string of SVG math instructions (like `"M 10 10 Q 15 20, 30 30"`) and compiles it into a geometric shape the graphics card can render.

---

## 4. Core Custom Functions

These are the functions we wrote to wire the inputs to the graphics engine.

### A. Event Handlers (`useCanvasInput.ts`)
* **`handlePointerDown`**: Captures the pointer and starts pushing the first `Point` into `livePointsRef`.
* **`handlePointerMove`**: Pushes new `Point`s into `livePointsRef` and calls `scheduleRaf()`.
* **`scheduleRaf()`**: Checks if a frame is already queued. If not, it uses `requestAnimationFrame` to run the native `ctx.clearRect` and `ctx.fill` functions for the `live-canvas`.

### B. The Handoff (`finishInteraction`)
Triggered on `pointerup`. 
1. Clears the top `live-canvas`.
2. Packages `livePointsRef` into an immutable `Stroke` object.
3. Paints that exact stroke onto the bottom `stroke-canvas`.
4. Saves the `Stroke` to the `StrokeStore` and empties `livePointsRef`.

### C. The Geometry Math (`inkRenderer.ts`)
When we need to draw a stroke, we do not simply connect the points. 

1. **`perfect-freehand` integration**: We pass the center points to this library, which outputs an array of dots tracing the **outer perimeter** (width/thickness) of the line based on stylus pressure.
2. **`outlineToSvgPath(outline)`**: Our custom algorithm that converts the jagged perimeter dots into perfectly smooth curves. It loops through the perimeter, calculates the **Midpoint** between dots, and generates **Quadratic Bézier Curve (`Q`)** SVG commands. The original dots act as "magnets" pulling the line outward to round off sharp corners. This generates the final SVG string fed to `Path2D`.
