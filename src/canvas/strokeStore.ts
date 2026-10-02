// ─── Stroke Store ──────────────────────────────────────────────────
// Manages strokes with undo/redo. Pure state, no rendering.

import { Stroke, Point, generateStrokeId } from './strokeModel';

export type StrokeAction =
  | { type: 'add'; stroke: Stroke }
  | { type: 'remove'; strokeIds: string[] }
  | { type: 'clear'; strokes: Stroke[] };

const MAX_UNDO_STACK = 100;

export class StrokeStore {
  private _strokes: Stroke[] = [];
  private _undoStack: StrokeAction[] = [];
  private _redoStack: StrokeAction[] = [];
  private _listeners: Set<() => void> = new Set();

  get strokes(): readonly Stroke[] {
    return this._strokes;
  }

  get canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify() {
    for (const l of this._listeners) l();
  }

  private _pushUndo(action: StrokeAction) {
    this._undoStack.push(action);
    if (this._undoStack.length > MAX_UNDO_STACK) {
      this._undoStack.shift();
    }
    // Any new action clears the redo stack
    this._redoStack = [];
  }

  addStroke(points: Point[], width: number, color: string = '#1a1a2e'): Stroke {
    const stroke: Stroke = {
      id: generateStrokeId(),
      points: [...points],
      width,
      color,
    };
    this._strokes.push(stroke);
    this._pushUndo({ type: 'add', stroke });
    this._notify();
    return stroke;
  }

  removeStrokes(ids: string[]): void {
    const removed = this._strokes.filter(s => ids.includes(s.id));
    if (removed.length === 0) return;
    this._strokes = this._strokes.filter(s => !ids.includes(s.id));
    this._pushUndo({ type: 'remove', strokeIds: ids });
    // Store removed strokes in the action for redo
    this._undoStack[this._undoStack.length - 1] = {
      type: 'remove',
      strokeIds: ids,
      // @ts-expect-error — extending the type for undo
      _removedStrokes: removed,
    };
    this._notify();
  }

  clear(): void {
    if (this._strokes.length === 0) return;
    const oldStrokes = [...this._strokes];
    this._strokes = [];
    this._pushUndo({ type: 'clear', strokes: oldStrokes });
    this._notify();
  }

  undo(): void {
    const action = this._undoStack.pop();
    if (!action) return;

    switch (action.type) {
      case 'add':
        this._strokes = this._strokes.filter(s => s.id !== action.stroke.id);
        break;
      case 'remove': {
        // @ts-expect-error — accessing extended property
        const removedStrokes: Stroke[] = action._removedStrokes || [];
        this._strokes.push(...removedStrokes);
        break;
      }
      case 'clear':
        this._strokes = [...action.strokes];
        break;
    }

    this._redoStack.push(action);
    this._notify();
  }

  redo(): void {
    const action = this._redoStack.pop();
    if (!action) return;

    switch (action.type) {
      case 'add':
        this._strokes.push(action.stroke);
        break;
      case 'remove':
        this._strokes = this._strokes.filter(s => !action.strokeIds.includes(s.id));
        break;
      case 'clear':
        this._strokes = [];
        break;
    }

    this._undoStack.push(action);
    this._notify();
  }

  /** Get stroke at a given point (for eraser). Returns the topmost stroke. */
  getStrokeAt(x: number, y: number, radius: number = 10): Stroke | null {
    for (let i = this._strokes.length - 1; i >= 0; i--) {
      const stroke = this._strokes[i];
      for (const p of stroke.points) {
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < radius * radius) {
          return stroke;
        }
      }
    }
    return null;
  }

  /** Pixel eraser: remove points near (x,y) from all strokes. Splits strokes if needed. */
  eraseAt(x: number, y: number, radius: number = 10): void {
    const affected: string[] = [];
    const newStrokes: Stroke[] = [];

    for (const stroke of this._strokes) {
      const remaining = stroke.points.filter(p => {
        const dx = p.x - x;
        const dy = p.y - y;
        return dx * dx + dy * dy >= radius * radius;
      });

      if (remaining.length === stroke.points.length) {
        newStrokes.push(stroke);
      } else if (remaining.length > 0) {
        affected.push(stroke.id);
        // Keep the surviving points as a new stroke
        newStrokes.push({
          ...stroke,
          id: generateStrokeId(),
          points: remaining,
        });
      } else {
        affected.push(stroke.id);
      }
    }

    if (affected.length > 0) {
      const oldStrokes = [...this._strokes];
      this._strokes = newStrokes;
      this._pushUndo({ type: 'clear', strokes: oldStrokes });
      this._notify();
    }
  }
}
