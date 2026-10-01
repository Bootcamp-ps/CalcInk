/**
 * strokeStore.ts — Framework-agnostic store for CalcInk drawing strokes.
 *
 * Requirements: FR-11, FR-14.
 * - Monotonically increasing version counter.
 * - Immutable strokes.
 * - Undo/redo history capped at 100 actions.
 * - Supports add, remove, replace, and clear actions.
 * - Undo/redo restores exact affected strokes in-place without full snapshots.
 * - Pub-sub event reporting with changed stroke IDs.
 * - Zero React imports.
 */

import type { Stroke, StrokeAction } from '../contract';

export interface StrokeStoreEvent {
  action:
    | StrokeAction
    | { type: 'undo'; revertedAction: StrokeAction }
    | { type: 'redo'; appliedAction: StrokeAction };
  changedStrokeIds: readonly string[];
  version: number;
}

export type StrokeStoreListener = (event: StrokeStoreEvent) => void;

export class StrokeStore {
  public static readonly MAX_HISTORY = 100;

  private _strokes: readonly Stroke[] = [];
  private _undoStack: StrokeAction[] = [];
  private _redoStack: StrokeAction[] = [];
  private _version = 0;
  private readonly _listeners = new Set<StrokeStoreListener>();

  /** All currently active strokes on the canvas in render order. */
  public get strokes(): readonly Stroke[] {
    return this._strokes;
  }

  /** Monotonically increasing version counter. */
  public get version(): number {
    return this._version;
  }

  public get canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  public get canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  /**
   * Subscribe to store mutations.
   * Returns an unsubscribe function.
   */
  public subscribe(listener: StrokeStoreListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Commits a new stroke to the canvas.
   * Clears redo history and increments version.
   */
  public add(stroke: Stroke): void {
    const action: StrokeAction = { type: 'add', stroke };
    this._strokes = [...this._strokes, stroke];
    this._pushUndoAction(action);
    this._redoStack = [];
    this._version += 1;

    this._notify({
      action,
      changedStrokeIds: [stroke.id],
      version: this._version,
    });
  }

  /**
   * Removes one or more strokes from the canvas (e.g. via stroke eraser).
   * Clears redo history and increments version.
   */
  public remove(strokes: readonly Stroke[]): void {
    if (strokes.length === 0) return;

    const removeIds = new Set(strokes.map((s) => s.id));
    const toRemove: Stroke[] = [];
    const indices: number[] = [];

    this._strokes.forEach((stroke, index) => {
      if (removeIds.has(stroke.id)) {
        toRemove.push(stroke);
        indices.push(index);
      }
    });

    if (toRemove.length === 0) return;

    this._strokes = this._strokes.filter((s) => !removeIds.has(s.id));
    const action: StrokeAction = { type: 'remove', strokes: toRemove, indices };
    this._pushUndoAction(action);
    this._redoStack = [];
    this._version += 1;

    this._notify({
      action,
      changedStrokeIds: toRemove.map((s) => s.id),
      version: this._version,
    });
  }

  /**
   * Replaces strokes in-place (e.g. via pixel eraser splitting a stroke).
   * Restores exact before/after on undo/redo with no full canvas snapshot.
   */
  public replace(before: readonly Stroke[], after: readonly Stroke[]): void {
    if (before.length === 0 && after.length === 0) return;

    const beforeIds = new Set(before.map((s) => s.id));
    const newStrokes: Stroke[] = [];
    let replaced = false;

    for (const stroke of this._strokes) {
      if (beforeIds.has(stroke.id)) {
        if (!replaced) {
          newStrokes.push(...after);
          replaced = true;
        }
      } else {
        newStrokes.push(stroke);
      }
    }

    if (!replaced) return;

    this._strokes = newStrokes;
    const action: StrokeAction = {
      type: 'replace',
      before: [...before],
      after: [...after],
    };

    this._pushUndoAction(action);
    this._redoStack = [];
    this._version += 1;

    const changedIds = Array.from(
      new Set([...before.map((s) => s.id), ...after.map((s) => s.id)])
    );

    this._notify({
      action,
      changedStrokeIds: changedIds,
      version: this._version,
    });
  }

  /**
   * Clears all strokes on the canvas.
   * Cleared strokes can be restored via undo (FR-11).
   */
  public clear(): void {
    if (this._strokes.length === 0) return;

    const cleared = this._strokes;
    const action: StrokeAction = { type: 'clear', strokes: [...cleared] };
    this._strokes = [];
    this._pushUndoAction(action);
    this._redoStack = [];
    this._version += 1;

    this._notify({
      action,
      changedStrokeIds: cleared.map((s) => s.id),
      version: this._version,
    });
  }

  /**
   * Undoes the most recent action.
   */
  public undo(): boolean {
    const action = this._undoStack.pop();
    if (!action) return false;

    let changedIds: string[] = [];

    switch (action.type) {
      case 'add': {
        this._strokes = this._strokes.filter((s) => s.id !== action.stroke.id);
        changedIds = [action.stroke.id];
        break;
      }
      case 'remove': {
        if (action.indices) {
          const newStrokes = [...this._strokes];
          for (let i = 0; i < action.strokes.length; i++) {
            const idx = action.indices[i] ?? newStrokes.length;
            const stroke = action.strokes[i]!;
            newStrokes.splice(idx, 0, stroke);
          }
          this._strokes = newStrokes;
        } else {
          this._strokes = [...this._strokes, ...action.strokes];
        }
        changedIds = action.strokes.map((s) => s.id);
        break;
      }
      case 'replace': {
        const afterIds = new Set(action.after.map((s) => s.id));
        const newStrokes: Stroke[] = [];
        let replaced = false;

        for (const stroke of this._strokes) {
          if (afterIds.has(stroke.id)) {
            if (!replaced) {
              newStrokes.push(...action.before);
              replaced = true;
            }
          } else {
            newStrokes.push(stroke);
          }
        }

        if (!replaced) {
          newStrokes.push(...action.before);
        }

        this._strokes = newStrokes;
        changedIds = Array.from(
          new Set([...action.before.map((s) => s.id), ...action.after.map((s) => s.id)])
        );
        break;
      }
      case 'clear': {
        this._strokes = [...action.strokes];
        changedIds = action.strokes.map((s) => s.id);
        break;
      }
    }

    this._redoStack.push(action);
    this._version += 1;

    this._notify({
      action: { type: 'undo', revertedAction: action },
      changedStrokeIds: changedIds,
      version: this._version,
    });

    return true;
  }

  /**
   * Redoes the most recently undone action.
   */
  public redo(): boolean {
    const action = this._redoStack.pop();
    if (!action) return false;

    let changedIds: string[] = [];

    switch (action.type) {
      case 'add': {
        this._strokes = [...this._strokes, action.stroke];
        changedIds = [action.stroke.id];
        break;
      }
      case 'remove': {
        const removeIds = new Set(action.strokes.map((s) => s.id));
        this._strokes = this._strokes.filter((s) => !removeIds.has(s.id));
        changedIds = action.strokes.map((s) => s.id);
        break;
      }
      case 'replace': {
        const beforeIds = new Set(action.before.map((s) => s.id));
        const newStrokes: Stroke[] = [];
        let replaced = false;

        for (const stroke of this._strokes) {
          if (beforeIds.has(stroke.id)) {
            if (!replaced) {
              newStrokes.push(...action.after);
              replaced = true;
            }
          } else {
            newStrokes.push(stroke);
          }
        }

        if (!replaced) {
          newStrokes.push(...action.after);
        }

        this._strokes = newStrokes;
        changedIds = Array.from(
          new Set([...action.before.map((s) => s.id), ...action.after.map((s) => s.id)])
        );
        break;
      }
      case 'clear': {
        const clearedIds = action.strokes.map((s) => s.id);
        this._strokes = [];
        changedIds = clearedIds;
        break;
      }
    }

    this._undoStack.push(action);
    this._version += 1;

    this._notify({
      action: { type: 'redo', appliedAction: action },
      changedStrokeIds: changedIds,
      version: this._version,
    });

    return true;
  }

  private _pushUndoAction(action: StrokeAction): void {
    this._undoStack.push(action);
    if (this._undoStack.length > StrokeStore.MAX_HISTORY) {
      this._undoStack.shift();
    }
  }

  private _notify(event: StrokeStoreEvent): void {
    for (const listener of this._listeners) {
      listener(event);
    }
  }
}
