/**
 * toolState.ts — Framework-agnostic tool state management for CalcInk.
 *
 * Requirements: FR-10, FR-12, FR-13.
 * - Active tool: 'pen' | 'stroke-eraser' | 'pixel-eraser'.
 * - Pen width with fine / medium / bold presets.
 * - Pen color with 5 swatches.
 * - Eraser radius control.
 * - Zero React imports.
 */

export type ToolType = 'pen' | 'stroke-eraser' | 'pixel-eraser';

export interface WidthPreset {
  label: 'fine' | 'medium' | 'bold';
  value: number;
}

export const WIDTH_PRESETS: readonly WidthPreset[] = [
  { label: 'fine', value: 1.5 },
  { label: 'medium', value: 2.5 },
  { label: 'bold', value: 5.0 },
] as const;

export const COLOR_SWATCHES: readonly string[] = [
  '#1a1a2e', // Ink navy / black
  '#2563eb', // Blue
  '#16a34a', // Green
  '#dc2626', // Red
  '#7c3aed', // Purple
] as const;

export interface ToolState {
  tool: ToolType;
  penWidth: number;
  penColor: string;
  eraserRadius: number;
}

export type ToolStateListener = (state: Readonly<ToolState>) => void;

export class ToolStore {
  private _state: ToolState = {
    tool: 'pen',
    penWidth: 2.5,
    penColor: COLOR_SWATCHES[0] ?? '#1a1a2e',
    eraserRadius: 16,
  };

  private readonly _listeners = new Set<ToolStateListener>();

  public get state(): Readonly<ToolState> {
    return this._state;
  }

  public get tool(): ToolType {
    return this._state.tool;
  }

  public get penWidth(): number {
    return this._state.penWidth;
  }

  public get penColor(): string {
    return this._state.penColor;
  }

  public get eraserRadius(): number {
    return this._state.eraserRadius;
  }

  public setTool(tool: ToolType): void {
    if (this._state.tool === tool) return;
    this._state = { ...this._state, tool };
    this._notify();
  }

  public setPenWidth(penWidth: number): void {
    const clamped = Math.max(1, Math.min(20, penWidth));
    if (this._state.penWidth === clamped) return;
    this._state = { ...this._state, penWidth: clamped };
    this._notify();
  }

  public setPenColor(penColor: string): void {
    if (this._state.penColor === penColor) return;
    this._state = { ...this._state, penColor };
    this._notify();
  }

  public setEraserRadius(eraserRadius: number): void {
    const clamped = Math.max(4, Math.min(60, eraserRadius));
    if (this._state.eraserRadius === clamped) return;
    this._state = { ...this._state, eraserRadius: clamped };
    this._notify();
  }

  public subscribe(listener: ToolStateListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener(this._state);
    }
  }
}
